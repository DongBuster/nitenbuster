import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MINECART_BASE_SPEED,
  MINECART_COURSE,
  MINECART_FINISH_Z,
  MINECART_INVULN_SEC,
  MINECART_LANE_X,
  MINECART_MAX_HP,
  MINECART_PUMP_BOOST,
  MINECART_RESPAWN_SEC,
  evaluateMinecartObstacles,
  getMinecartStageNumberForZ,
} from '../course.ts';
import {
  createInitialMinecartSimState,
  packMinecartSnapshot,
  stepMinecartSim,
} from '../physics.ts';
import type {
  MinecartCourseDef,
  MinecartSimEvent,
  MinecartSimState,
} from '../types.ts';
import type { PlayerInput } from '../../../../glass/sim/types.ts';

const FIXED_DT = 1 / 60;

const NEUTRAL_INPUT: PlayerInput = {
  moveX: 0,
  moveZ: 0,
  jump: false,
  lift: 0,
};

function stepMany(
  initial: MinecartSimState,
  steps: number,
  p1Input: PlayerInput | ((s: MinecartSimState, i: number) => PlayerInput),
  p2Input: PlayerInput | ((s: MinecartSimState, i: number) => PlayerInput),
  dt: number = FIXED_DT,
  course: MinecartCourseDef = MINECART_COURSE,
): { state: MinecartSimState; events: MinecartSimEvent[] } {
  let state = initial;
  const events: MinecartSimEvent[] = [];
  for (let i = 0; i < steps; i += 1) {
    const in1 = typeof p1Input === 'function' ? p1Input(state, i) : p1Input;
    const in2 = typeof p2Input === 'function' ? p2Input(state, i) : p2Input;
    state = stepMinecartSim(state, in1, in2, dt, course);
    events.push(...state.events);
  }
  return { state, events };
}

function makeTestCourse(
  overrides: Partial<MinecartCourseDef> = {},
): MinecartCourseDef {
  return {
    finishZ: MINECART_FINISH_Z,
    laneX: MINECART_LANE_X,
    stages: [
      { number: 1, name: 'Test Stage 1', startZ: 0, endZ: 36 },
      { number: 2, name: 'Test Stage 2', startZ: 36, endZ: MINECART_FINISH_Z },
    ],
    checkpoints: [
      {
        index: 0,
        stageNumber: 1,
        stageName: 'Test Stage 1',
        triggerZ: 0,
        spawnLane: 1,
        spawnZ: 0,
      },
      {
        index: 1,
        stageNumber: 2,
        stageName: 'Test Stage 2',
        triggerZ: 36,
        spawnLane: 1,
        spawnZ: 36,
      },
    ],
    blockers: [],
    beams: [],
    gaps: [],
    sweepers: [],
    rockfalls: [],
    ...overrides,
  };
}

describe('minecart course definition & determinism', () => {
  it('defines 5 stages, 5 checkpoints, gaps, sweepers, rockfalls, and deterministic obstacles', () => {
    assert.equal(MINECART_COURSE.finishZ, 180);
    assert.deepEqual(MINECART_COURSE.laneX, [3.2, 0, -3.2]);
    assert.equal(MINECART_COURSE.stages.length, 5);
    assert.equal(MINECART_COURSE.checkpoints.length, 5);
    for (const cp of MINECART_COURSE.checkpoints) {
      assert.equal(cp.spawnLane, 1);
    }

    assert.equal(getMinecartStageNumberForZ(MINECART_COURSE, 0), 1);
    assert.equal(getMinecartStageNumberForZ(MINECART_COURSE, 36), 2);
    assert.equal(getMinecartStageNumberForZ(MINECART_COURSE, 72), 3);
    assert.equal(getMinecartStageNumberForZ(MINECART_COURSE, 108), 4);
    assert.equal(getMinecartStageNumberForZ(MINECART_COURSE, 144), 5);

    const stage3Gaps = MINECART_COURSE.gaps.filter(
      (g) => g.startZ >= 72 && g.endZ <= 108,
    );
    const stage5Gaps = MINECART_COURSE.gaps.filter(
      (g) => g.startZ >= 144 && g.endZ <= 180,
    );
    assert.equal(stage3Gaps.length, 3);
    assert.equal(stage5Gaps.length, 1);
    for (const gap of MINECART_COURSE.gaps) {
      assert.ok(Math.abs(gap.endZ - gap.startZ - 4.8) < 1e-6);
    }

    const stage4Sweepers = MINECART_COURSE.sweepers.filter(
      (s) => s.z >= 108 && s.z <= 144,
    );
    const stage4Rockfalls = MINECART_COURSE.rockfalls.filter(
      (r) => r.z >= 108 && r.z <= 144,
    );
    assert.equal(stage4Sweepers.length, 2);
    assert.equal(stage4Rockfalls.length, 3);

    const obsA = evaluateMinecartObstacles(MINECART_COURSE, 4.25);
    const obsB = evaluateMinecartObstacles(MINECART_COURSE, 4.25);
    assert.deepEqual(obsA, obsB);
  });
});

describe('minecart alternating pump & synchronized lane switching', () => {
  it('boosts speed on alternating p1 -> p2 pumps and ignores out-of-turn pumps', () => {
    const course = makeTestCourse();
    let state = createInitialMinecartSimState(course);
    assert.equal(state.cart.pumpTurn, 'p1');
    assert.equal(state.cart.speed, MINECART_BASE_SPEED);

    // Out-of-turn pump by P2 when pumpTurn is 'p1' -> no boost
    state = stepMinecartSim(
      state,
      NEUTRAL_INPUT,
      { ...NEUTRAL_INPUT, lift: 1 },
      FIXED_DT,
      course,
    );
    assert.equal(state.cart.pumpTurn, 'p1');
    assert.equal(state.cart.speed, MINECART_BASE_SPEED);
    assert.equal(state.events.filter((e) => e.kind === 'cart_pump').length, 0);

    // Release P2, then P1 pumps on rising edge -> boosts and flips turn to 'p2'
    state = stepMinecartSim(state, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);
    state = stepMinecartSim(
      state,
      { ...NEUTRAL_INPUT, lift: 1 },
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );
    assert.equal(state.cart.pumpTurn, 'p2');
    assert.ok(
      state.cart.speed > MINECART_BASE_SPEED + MINECART_PUMP_BOOST - 0.1,
      `Expected pump boost, got speed=${state.cart.speed}`,
    );
    assert.equal(state.events.filter((e) => e.kind === 'cart_pump').length, 1);

    // P1 releases and tries to pump again out of turn -> ignored
    state = stepMinecartSim(state, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);
    const speedBeforeWrongP1 = state.cart.speed;
    state = stepMinecartSim(
      state,
      { ...NEUTRAL_INPUT, lift: 1 },
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );
    assert.equal(state.cart.pumpTurn, 'p2');
    assert.ok(state.cart.speed <= speedBeforeWrongP1);

    // P2 pumps on its turn -> boosts again and flips back to 'p1'
    const speedBeforeP2 = state.cart.speed;
    state = stepMinecartSim(
      state,
      NEUTRAL_INPUT,
      { ...NEUTRAL_INPUT, lift: 1 },
      FIXED_DT,
      course,
    );
    assert.equal(state.cart.pumpTurn, 'p1');
    assert.ok(
      state.cart.speed > speedBeforeP2 + 2.0,
      `Expected P2 alternating pump boost, got ${state.cart.speed}`,
    );
    assert.equal(state.events.filter((e) => e.kind === 'cart_pump').length, 1);
  });

  it('shifts lane 1->0 on synced left (+1), 1->2 on synced right (-1), and wobbles on opposing leans', () => {
    const course = makeTestCourse();
    const init = createInitialMinecartSimState(course);
    assert.equal(init.cart.lane, 1);
    assert.equal(init.cart.x, 0);

    // Synced left: moveX = +1 shifts lane 1 -> 0 (x -> +3.2)
    const leftRes = stepMany(
      init,
      25,
      { ...NEUTRAL_INPUT, moveX: 1 },
      { ...NEUTRAL_INPUT, moveX: 1 },
      FIXED_DT,
      course,
    );
    assert.equal(leftRes.state.cart.lane, 0);
    assert.ok(
      leftRes.state.cart.x > 2.8,
      `Expected x -> +3.2 in lane 0, got x=${leftRes.state.cart.x}`,
    );
    assert.ok(leftRes.events.some((e) => e.kind === 'cart_lane'));

    // Synced right from center lane 1: moveX = -1 shifts lane 1 -> 2 (x -> -3.2)
    const rightRes = stepMany(
      init,
      25,
      { ...NEUTRAL_INPUT, moveX: -1 },
      { ...NEUTRAL_INPUT, moveX: -1 },
      FIXED_DT,
      course,
    );
    assert.equal(rightRes.state.cart.lane, 2);
    assert.ok(
      rightRes.state.cart.x < -2.8,
      `Expected x -> -3.2 in lane 2, got x=${rightRes.state.cart.x}`,
    );

    // Opposing leans do not change lane and increase wobble
    const opposeRes = stepMany(
      init,
      15,
      { ...NEUTRAL_INPUT, moveX: 1 },
      { ...NEUTRAL_INPUT, moveX: -1 },
      FIXED_DT,
      course,
    );
    assert.equal(opposeRes.state.cart.lane, 1);
    assert.ok(
      opposeRes.state.cart.wobble > 0.5,
      `Expected wobble to increase on opposing leans, got ${opposeRes.state.cart.wobble}`,
    );
    assert.equal(
      opposeRes.events.filter((e) => e.kind === 'cart_lane').length,
      0,
    );
  });
});

describe('minecart overhead beams & obstacles', () => {
  it('drains 1 HP on overhead beam if one or both fail to duck, and clears cleanly when both duck', () => {
    const course = makeTestCourse({
      beams: [{ id: 'beam-1', lanes: [0, 1, 2], z: 2.0, halfDepth: 0.45 }],
    });
    const init = createInitialMinecartSimState(course);

    // Only P1 ducks -> still takes 1 HP hit
    const oneDuck = stepMany(
      init,
      40,
      { ...NEUTRAL_INPUT, lift: -1 },
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );
    assert.equal(oneDuck.state.cart.hp, MINECART_MAX_HP - 1);
    assert.equal(
      oneDuck.events.filter((e) => e.kind === 'cart_hit').length,
      1,
    );
    assert.ok(
      oneDuck.state.cart.invulnTimer > 0 &&
        oneDuck.state.cart.invulnTimer <= MINECART_INVULN_SEC,
    );

    // Both duck (lift: -1) -> clears cleanly with full HP
    const bothDuck = stepMany(
      init,
      40,
      { ...NEUTRAL_INPUT, lift: -1 },
      { ...NEUTRAL_INPUT, lift: -1 },
      FIXED_DT,
      course,
    );
    assert.equal(bothDuck.state.cart.hp, MINECART_MAX_HP);
    assert.equal(
      bothDuck.events.filter((e) => e.kind === 'cart_hit').length,
      0,
    );
  });

  it('hits lane blockers, sweepers, and active rockfalls while respecting invuln frames', () => {
    // Blocker slows speed and deals 1 HP
    const blockerCourse = makeTestCourse({
      blockers: [{ id: 'blk-1', lane: 1, z: 2.0, halfDepth: 0.7 }],
    });
    const blockerInit = {
      ...createInitialMinecartSimState(blockerCourse),
      cart: {
        ...createInitialMinecartSimState(blockerCourse).cart,
        speed: 8.0,
      },
    };
    const blockerRes = stepMany(
      blockerInit,
      30,
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
      FIXED_DT,
      blockerCourse,
    );
    assert.equal(blockerRes.state.cart.hp, MINECART_MAX_HP - 1);
    assert.equal(
      blockerRes.events.filter((e) => e.kind === 'cart_hit').length,
      1,
    );
    assert.ok(blockerRes.state.cart.speed < 5.0);

    // Sweeper at x=0 hits grounded cart
    const sweeperCourse = makeTestCourse({
      sweepers: [
        {
          id: 'sw-1',
          z: 2.0,
          speed: 0,
          phase: 0,
          halfWidth: 0.85,
          halfDepth: 0.45,
        },
      ],
    });
    const sweeperRes = stepMany(
      createInitialMinecartSimState(sweeperCourse),
      40,
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
      FIXED_DT,
      sweeperCourse,
    );
    assert.equal(sweeperRes.state.cart.hp, MINECART_MAX_HP - 1);

    // Active rockfall hits cart only during active window, not during warning
    const rockfallWarnCourse = makeTestCourse({
      rockfalls: [
        {
          id: 'rf-warn',
          lane: 1,
          z: 2.0,
          periodSec: 5.0,
          warnSec: 2.0,
          activeSec: 1.5,
          phaseOffsetSec: 0,
        },
      ],
    });
    const warnRes = stepMany(
      createInitialMinecartSimState(rockfallWarnCourse),
      40,
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
      FIXED_DT,
      rockfallWarnCourse,
    );
    assert.equal(warnRes.state.cart.hp, MINECART_MAX_HP);

    const rockfallActiveCourse = makeTestCourse({
      rockfalls: [
        {
          id: 'rf-active',
          lane: 1,
          z: 2.0,
          periodSec: 5.0,
          warnSec: 1.0,
          activeSec: 2.0,
          phaseOffsetSec: 1.1,
        },
      ],
    });
    const activeRes = stepMany(
      createInitialMinecartSimState(rockfallActiveCourse),
      40,
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
      FIXED_DT,
      rockfallActiveCourse,
    );
    assert.equal(activeRes.state.cart.hp, MINECART_MAX_HP - 1);
  });
});

describe('minecart broken-rail gaps, derailment, checkpoints, and finish', () => {
  it('clears a 4.8m broken-rail gap when jumping at speed >= 7.5', () => {
    const course = makeTestCourse({
      gaps: [{ id: 'gap-1', startZ: 8.0, endZ: 12.8 }],
    });
    let state = createInitialMinecartSimState(course);
    state = {
      ...state,
      cart: { ...state.cart, z: 7.4, speed: 8.0 },
    };

    // Synchronized jump right before gap
    state = stepMinecartSim(
      state,
      { ...NEUTRAL_INPUT, jump: true },
      { ...NEUTRAL_INPUT, jump: true },
      FIXED_DT,
      course,
    );
    assert.ok(state.events.some((e) => e.kind === 'cart_jump'));

    const res = stepMany(state, 70, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);
    assert.ok(res.state.cart.z > 13.5, `Expected z > 13.5, got ${res.state.cart.z}`);
    assert.equal(res.state.cart.y, 0);
    assert.equal(res.state.cart.grounded, true);
    assert.equal(res.state.failures, 0);
    assert.equal(
      res.events.filter((e) => e.kind === 'cart_derail').length,
      0,
    );
  });

  it('derails in a 4.8m gap when unjumped or jumping at base speed 4.2, then respawns after 1.1s', () => {
    const course = makeTestCourse({
      gaps: [{ id: 'gap-1', startZ: 8.0, endZ: 12.8 }],
    });

    // Case 1: unjumped at base speed 4.2
    const unjumpedInit = {
      ...createInitialMinecartSimState(course),
      cart: {
        ...createInitialMinecartSimState(course).cart,
        z: 7.5,
        speed: MINECART_BASE_SPEED,
      },
    };
    let state = unjumpedInit;
    const fallEvents: MinecartSimEvent[] = [];
    for (let i = 0; i < 90; i += 1) {
      state = stepMinecartSim(state, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);
      fallEvents.push(...state.events);
      if (state.events.some((e) => e.kind === 'cart_derail')) break;
    }
    assert.ok(
      fallEvents.some((e) => e.kind === 'cart_derail'),
      'Expected cart_derail event when driving off gap without jumping',
    );
    assert.equal(state.failures, 1);
    assert.ok(state.cart.y < -4);
    assert.equal(state.cart.respawnTimer, MINECART_RESPAWN_SEC);

    // Wait 1.0s (60 ticks < 1.1s) -> still locked in respawn
    const locked = stepMany(state, 60, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);
    assert.ok(locked.state.cart.respawnTimer > 0);
    assert.equal(
      locked.events.filter((e) => e.kind === 'respawn').length,
      0,
    );

    // Finish 1.1s respawn lock -> respawns at checkpoint 0 with full HP
    let respawnState = locked.state;
    const respawnEvents: MinecartSimEvent[] = [];
    for (let i = 0; i < 10; i += 1) {
      respawnState = stepMinecartSim(
        respawnState,
        NEUTRAL_INPUT,
        NEUTRAL_INPUT,
        FIXED_DT,
        course,
      );
      respawnEvents.push(...respawnState.events);
      if (respawnState.events.some((e) => e.kind === 'respawn')) {
        break;
      }
    }
    assert.equal(respawnState.cart.respawnTimer, 0);
    assert.equal(respawnState.cart.hp, MINECART_MAX_HP);
    assert.equal(respawnState.cart.lane, 1);
    assert.equal(respawnState.cart.x, 0);
    assert.equal(respawnState.cart.y, 0);
    assert.equal(respawnState.cart.z, 0);
    assert.equal(respawnState.cart.speed, MINECART_BASE_SPEED);
    assert.equal(respawnState.cart.invulnTimer, 1.0);
    assert.equal(respawnState.cart.grounded, true);
    assert.equal(
      respawnEvents.filter((e) => e.kind === 'respawn').length,
      1,
    );

    // Case 2: jumping at base speed 4.2 still falls short of 4.8m gap
    let shortJumpState: MinecartSimState = {
      ...createInitialMinecartSimState(course),
      cart: {
        ...createInitialMinecartSimState(course).cart,
        z: 7.9,
        speed: MINECART_BASE_SPEED,
      },
    };
    shortJumpState = stepMinecartSim(
      shortJumpState,
      { ...NEUTRAL_INPUT, jump: true },
      { ...NEUTRAL_INPUT, jump: true },
      FIXED_DT,
      course,
    );
    const shortRes = stepMany(
      shortJumpState,
      100,
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );
    assert.equal(shortRes.state.failures, 1);
    assert.ok(
      shortRes.events.some((e) => e.kind === 'cart_derail'),
      'Expected base-speed jump to fail 4.8m gap and derail',
    );
  });

  it('restores HP to 3 at checkpoint and finishes at z >= 180 with course_clear', () => {
    const course = makeTestCourse();
    let state = createInitialMinecartSimState(course);
    state = {
      ...state,
      cart: {
        ...state.cart,
        hp: 1,
        z: 35.8,
      },
    };

    const cpRes = stepMany(state, 10, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);
    assert.equal(cpRes.state.checkpointIndex, 1);
    assert.equal(cpRes.state.cart.hp, MINECART_MAX_HP);
    const cpEvt = cpRes.events.find((e) => e.kind === 'checkpoint');
    assert.ok(cpEvt, 'Expected checkpoint event');
    assert.equal(cpEvt.checkpointIndex, 1);

    // Finish line z = 180
    const nearFinish: MinecartSimState = {
      ...cpRes.state,
      cart: {
        ...cpRes.state.cart,
        z: 179.8,
      },
    };
    const finRes = stepMany(
      nearFinish,
      10,
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );
    assert.equal(finRes.state.phase, 'finished');
    assert.equal(
      finRes.events.filter((e) => e.kind === 'course_clear').length,
      1,
    );

    const postFinish = stepMinecartSim(
      finRes.state,
      { ...NEUTRAL_INPUT, lift: 1 },
      { ...NEUTRAL_INPUT, lift: 1 },
      FIXED_DT,
      course,
    );
    assert.equal(postFinish.phase, 'finished');
    assert.equal(postFinish.events.length, 0);
  });

  it('packs compact MinecartSnapshotPayload with 2-decimal rounding and -0 normalization', () => {
    const init = createInitialMinecartSimState();
    const skewed: MinecartSimState = {
      ...init,
      tick: 18,
      matchTime: 0.30000000000000004,
      cart: {
        ...init.cart,
        x: -0.0001,
        y: 1.23456,
        z: 24.999,
        wobble: -0,
      },
    };
    const snap = packMinecartSnapshot('match-99', skewed);
    assert.equal(snap.mapId, 'minecart_rails');
    assert.equal(snap.matchId, 'match-99');
    assert.equal(snap.tick, 18);
    assert.equal(snap.matchTime, 0.3);
    assert.ok(Object.is(snap.cart.x, 0), 'Expected -0 normalized to +0');
    assert.ok(Object.is(snap.cart.wobble, 0), 'Expected -0 normalized to +0');
    assert.equal(snap.cart.y, 1.23);
    assert.equal(snap.cart.z, 25);
  });
});
