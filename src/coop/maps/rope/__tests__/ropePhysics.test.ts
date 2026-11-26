import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROPE_COURSE,
  ROPE_FALL_LIMIT_Y,
  ROPE_FINISH_Z,
  ROPE_MAX_LEN,
  ROPE_REEL_MIN_LEN,
  ROPE_RESPAWN_SEC,
  evaluateRopeCourse,
  getRopeStageNumberForZ,
} from '../course.ts';
import {
  createInitialRopeSimState,
  packRopeSnapshot,
  stepRopeSim,
} from '../physics.ts';
import type { RopeCourseDef, RopeSimEvent, RopeSimState } from '../types.ts';
import type { PlayerInput } from '../../../../glass/sim/types.ts';

const FIXED_DT = 1 / 60;

const NEUTRAL_INPUT: PlayerInput = {
  moveX: 0,
  moveZ: 0,
  jump: false,
  lift: 0,
};

function stepMany(
  initial: RopeSimState,
  steps: number,
  p1Input: PlayerInput | ((s: RopeSimState, i: number) => PlayerInput),
  p2Input: PlayerInput | ((s: RopeSimState, i: number) => PlayerInput),
  dt: number = FIXED_DT,
  course: RopeCourseDef = ROPE_COURSE,
): { state: RopeSimState; events: RopeSimEvent[] } {
  let state = initial;
  const events: RopeSimEvent[] = [];
  for (let i = 0; i < steps; i += 1) {
    const in1 = typeof p1Input === 'function' ? p1Input(state, i) : p1Input;
    const in2 = typeof p2Input === 'function' ? p2Input(state, i) : p2Input;
    state = stepRopeSim(state, in1, in2, dt, course);
    events.push(...state.events);
  }
  return { state, events };
}

function makeTestCourse(overrides: Partial<RopeCourseDef> = {}): RopeCourseDef {
  return {
    finishZ: ROPE_FINISH_Z,
    stages: [
      { number: 1, name: 'Test Stage 1', startZ: 0, endZ: 27 },
      { number: 2, name: 'Test Stage 2', startZ: 27, endZ: ROPE_FINISH_Z },
    ],
    checkpoints: [
      {
        index: 0,
        stageNumber: 1,
        stageName: 'Test Stage 1',
        triggerZ: 0,
        p1Spawn: { x: -1.2, y: 0, z: 0.5 },
        p2Spawn: { x: 1.2, y: 0, z: 0.5 },
      },
      {
        index: 1,
        stageNumber: 2,
        stageName: 'Test Stage 2',
        triggerZ: 27,
        p1Spawn: { x: -1.2, y: 0.8, z: 27.5 },
        p2Spawn: { x: 1.2, y: 0.8, z: 27.5 },
      },
    ],
    islands: [
      {
        id: 'test-island-1',
        surface: 'wood',
        box: { minX: -5, maxX: 5, minY: -1, maxY: 0, minZ: -2, maxZ: 12 },
      },
      {
        id: 'test-island-2',
        surface: 'wood',
        box: { minX: -5, maxX: 5, minY: -0.2, maxY: 0.8, minZ: 26, maxZ: 40 },
      },
      {
        id: 'test-finish',
        surface: 'wood',
        box: { minX: -5, maxX: 5, minY: 3.5, maxY: 4.5, minZ: 128, maxZ: 142 },
      },
    ],
    movingIslands: [],
    windZones: [],
    pendulums: [],
    ...overrides,
  };
}

describe('rope course definition & determinism', () => {
  it('defines 5 ascending stages, 5 safe checkpoints, obstacles per stage, and deterministic evaluation', () => {
    assert.equal(ROPE_COURSE.finishZ, 135);
    assert.equal(ROPE_COURSE.stages.length, 5);
    assert.equal(ROPE_COURSE.checkpoints.length, 5);

    const expectedTriggers = [0, 27, 54, 81, 108];
    for (let i = 0; i < expectedTriggers.length; i += 1) {
      const cp = ROPE_COURSE.checkpoints[i];
      assert.equal(cp.triggerZ, expectedTriggers[i]);
      const dx = Math.abs(cp.p2Spawn.x - cp.p1Spawn.x);
      assert.ok(Math.abs(dx - 2.4) < 1e-6, `Checkpoint ${i} spawn dx should be 2.4m`);

      const p1Island = ROPE_COURSE.islands.find(
        (isl) =>
          cp.p1Spawn.x >= isl.box.minX &&
          cp.p1Spawn.x <= isl.box.maxX &&
          cp.p1Spawn.z >= isl.box.minZ &&
          cp.p1Spawn.z <= isl.box.maxZ &&
          Math.abs(cp.p1Spawn.y - isl.box.maxY) < 1e-6,
      );
      const p2Island = ROPE_COURSE.islands.find(
        (isl) =>
          cp.p2Spawn.x >= isl.box.minX &&
          cp.p2Spawn.x <= isl.box.maxX &&
          cp.p2Spawn.z >= isl.box.minZ &&
          cp.p2Spawn.z <= isl.box.maxZ &&
          Math.abs(cp.p2Spawn.y - isl.box.maxY) < 1e-6,
      );
      assert.ok(p1Island, `Checkpoint ${i} p1Spawn must stand on an island`);
      assert.ok(p2Island, `Checkpoint ${i} p2Spawn must stand on an island`);
    }

    assert.equal(ROPE_COURSE.windZones.length, 2);
    assert.equal(ROPE_COURSE.pendulums.length, 2);
    assert.equal(ROPE_COURSE.movingIslands.length, 2);

    const peakIsland = ROPE_COURSE.islands.find(
      (isl) => isl.box.minZ <= 135 && isl.box.maxZ >= 135,
    );
    assert.ok(peakIsland, 'Expected Lantern Peak island covering finishZ=135');
    assert.equal(peakIsland.box.maxY, 4.5);

    assert.equal(getRopeStageNumberForZ(ROPE_COURSE, 0), 1);
    assert.equal(getRopeStageNumberForZ(ROPE_COURSE, 27), 2);
    assert.equal(getRopeStageNumberForZ(ROPE_COURSE, 54), 3);
    assert.equal(getRopeStageNumberForZ(ROPE_COURSE, 81), 4);
    assert.equal(getRopeStageNumberForZ(ROPE_COURSE, 108), 5);

    const evalA = evaluateRopeCourse(ROPE_COURSE, 2.5);
    const evalB = evaluateRopeCourse(ROPE_COURSE, 2.5);
    assert.deepEqual(evalA, evalB);
  });
});

describe('rope tether constraint, anchoring, and reeling', () => {
  it('pulls players back when walking apart past 4.5m', () => {
    const course = makeTestCourse({
      islands: [
        {
          id: 'wide-deck',
          surface: 'wood',
          box: { minX: -20, maxX: 20, minY: -1, maxY: 0, minZ: -5, maxZ: 25 },
        },
      ],
    });
    const init = createInitialRopeSimState(course);

    const res = stepMany(
      init,
      120,
      { ...NEUTRAL_INPUT, moveX: -1 },
      { ...NEUTRAL_INPUT, moveX: 1 },
      FIXED_DT,
      course,
    );

    assert.ok(
      res.state.ropeLength <= ROPE_MAX_LEN + 0.08,
      `Expected rope constraint to hold separation near ${ROPE_MAX_LEN}m, got ${res.state.ropeLength}`,
    );
    assert.ok(
      res.state.ropeLength >= ROPE_MAX_LEN - 0.25,
      `Expected rope to be taut near max length, got ${res.state.ropeLength}`,
    );
  });

  it('anchoring (lift: -1) holds a falling partner hanging safely without dragging anchor off island', () => {
    const course = makeTestCourse({
      islands: [
        {
          id: 'ledge',
          surface: 'wood',
          box: { minX: -4, maxX: 4, minY: -1, maxY: 0, minZ: -2, maxZ: 4.0 },
        },
      ],
    });
    let state = createInitialRopeSimState(course);
    // Position P1 safely near the ledge (z = 2.6), P2 already stepping off edge (z = 4.6)
    state = {
      ...state,
      p1: { ...state.p1, x: 0, y: 0, z: 2.6, grounded: true },
      p2: { ...state.p2, x: 0, y: 0, z: 4.6, grounded: false },
    };

    const res = stepMany(
      state,
      120, // 2 seconds while P1 holds anchor
      { ...NEUTRAL_INPUT, moveZ: 1, jump: true, lift: -1 },
      { ...NEUTRAL_INPUT, moveZ: 0.5 },
      FIXED_DT,
      course,
    );

    assert.ok(
      res.events.some((e) => e.kind === 'rope_anchor'),
      'Expected rope_anchor event when anchoring begins',
    );
    assert.equal(res.state.p1.anchored, true);
    assert.equal(res.state.p1.grounded, true, 'Anchored player must remain on the island');
    assert.ok(
      res.state.p1.z <= 4.0,
      `Anchored player should not be dragged off ledge (z=${res.state.p1.z})`,
    );
    assert.ok(res.state.p1.y >= 0, 'Anchored player must not be pulled into the island');

    assert.equal(res.state.p2.hanging, true, 'Partner should be hanging on the rope');
    assert.ok(
      res.state.p2.y > ROPE_FALL_LIMIT_Y,
      `Partner should be suspended above fall limit, got y=${res.state.p2.y}`,
    );
    assert.ok(
      res.state.ropeStrain > 0 && res.state.ropeStrain < 1,
      `Expected non-zero manageable ropeStrain while hanging, got ${res.state.ropeStrain}`,
    );
    assert.equal(res.state.failures, 0);
  });

  it('reeling (lift: +1) pulls a hanging partner back up onto the island', () => {
    const course = makeTestCourse({
      islands: [
        {
          id: 'rescue-ledge',
          surface: 'wood',
          box: { minX: -5, maxX: 5, minY: -1, maxY: 0, minZ: -2, maxZ: 6.0 },
        },
      ],
    });
    let state = createInitialRopeSimState(course);
    state = {
      ...state,
      p1: { ...state.p1, x: 0, y: 0, z: 4.2, grounded: true },
      p2: { ...state.p2, x: 0, y: -2.6, z: 6.8, grounded: false, hanging: true },
      ropeLength: Math.hypot(2.6, 2.6),
    };

    const res = stepMany(
      state,
      150, // 2.5s of reeling
      { ...NEUTRAL_INPUT, lift: 1 },
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );

    const pullEvents = res.events.filter((e) => e.kind === 'rope_pull');
    assert.ok(pullEvents.length >= 1, 'Expected rope_pull events while reeling');
    assert.ok(
      pullEvents.length <= 7,
      `Expected rope_pull events throttled (~0.45s), got ${pullEvents.length}`,
    );
    assert.ok(
      res.state.effectiveMaxLen <= ROPE_REEL_MIN_LEN + 0.05,
      `Expected effectiveMaxLen shortened to ${ROPE_REEL_MIN_LEN}, got ${res.state.effectiveMaxLen}`,
    );
    assert.ok(
      res.state.p2.y >= 0,
      `Expected hanging partner to be pulled back up >= 0, got y=${res.state.p2.y}`,
    );
    assert.equal(res.state.p2.grounded, true, 'Rescued partner should land grounded on island');
    assert.equal(res.state.p1.grounded, true, 'Reeler should stay safely on island');

    // Releasing reel relaxes effectiveMaxLen smoothly back to ROPE_MAX_LEN
    const relaxRes = stepMany(
      res.state,
      60,
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );
    assert.ok(
      Math.abs(relaxRes.state.effectiveMaxLen - ROPE_MAX_LEN) < 1e-6,
      `Expected effectiveMaxLen to relax back to ${ROPE_MAX_LEN}, got ${relaxRes.state.effectiveMaxLen}`,
    );
  });
});

describe('rope snap, hazards, checkpoints, and finish', () => {
  it('triggers rope_snap when both players fall below -6 and respawns at checkpoint after 1.2s', () => {
    const course = makeTestCourse();
    let state = createInitialRopeSimState(course);
    state = {
      ...state,
      checkpointIndex: 0,
      p1: { ...state.p1, x: -1, y: -5.9, z: 16, vy: -5, grounded: false },
      p2: { ...state.p2, x: 1, y: -5.9, z: 16, vy: -5, grounded: false },
    };

    const fallRes = stepMany(state, 10, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);
    assert.ok(
      fallRes.events.some((e) => e.kind === 'rope_snap'),
      'Expected rope_snap event when both players fall below -6',
    );
    assert.equal(fallRes.state.failures, 1);
    assert.ok(fallRes.state.respawnTimer > 0 && fallRes.state.respawnTimer <= ROPE_RESPAWN_SEC);

    // Wait 1.0s (60 ticks) -> still locked
    const waitRes = stepMany(
      { ...fallRes.state, respawnTimer: ROPE_RESPAWN_SEC },
      60,
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );
    assert.ok(waitRes.state.respawnTimer > 0);
    assert.equal(waitRes.events.filter((e) => e.kind === 'respawn').length, 0);

    // Wait remaining ticks -> respawns at checkpoint 0
    const respawnRes = stepMany(
      waitRes.state,
      15,
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );
    assert.equal(respawnRes.state.respawnTimer, 0);
    assert.equal(respawnRes.events.filter((e) => e.kind === 'respawn').length, 1);
    assert.equal(respawnRes.state.ropeStrain, 0);
    assert.equal(respawnRes.state.effectiveMaxLen, ROPE_MAX_LEN);
    assert.equal(respawnRes.state.p1.grounded, true);
    assert.equal(respawnRes.state.p2.grounded, true);
    assert.equal(respawnRes.state.p1.z, course.checkpoints[0].p1Spawn.z);
    assert.equal(respawnRes.state.p2.z, course.checkpoints[0].p2Spawn.z);
  });

  it('triggers rope_snap when ropeStrain reaches 1.0 or pendulum hits increase strain', () => {
    const course = makeTestCourse({
      pendulums: [
        {
          id: 'test-pend',
          pivotX: 0,
          pivotY: 4.65,
          pivotZ: 0.5,
          armLength: 4.0,
          maxAngleRad: 0.5,
          speed: 0,
          phase: 0,
          bobRadius: 0.65,
          damage: 1,
        },
      ],
    });
    let state = createInitialRopeSimState(course);
    state = {
      ...state,
      p1: { ...state.p1, x: 0, y: 0, z: 0.5, grounded: true },
      p2: { ...state.p2, x: 2.4, y: 0, z: 0.5, grounded: true },
      ropeStrain: 0.6,
    };

    // Bob is at (0, 0.65, 0.5), hitting P1 waist at (0, 0.65, 0.5) -> adds +0.45 -> strain = 1.0 -> snap!
    const hitState = stepRopeSim(state, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);
    assert.ok(
      hitState.events.some((e) => e.kind === 'rope_snap'),
      'Expected rope_snap when pendulum hit pushes ropeStrain to 1.0',
    );
    assert.equal(hitState.failures, 1);
  });

  it('does not stack pendulum strain across consecutive ticks when anchored inside bob', () => {
    const course = makeTestCourse({
      pendulums: [
        {
          id: 'anchored-pend',
          pivotX: 0,
          pivotY: 4.65,
          pivotZ: 0.5,
          armLength: 4.0,
          maxAngleRad: 0.5,
          speed: 0,
          phase: 0,
          bobRadius: 0.65,
          damage: 1,
        },
      ],
    });
    let state = createInitialRopeSimState(course);
    state = {
      ...state,
      p1: { ...state.p1, x: 0, y: 0, z: 0.5, grounded: true },
      p2: { ...state.p2, x: 2.4, y: 0, z: 0.5, grounded: true },
    };

    // Anchored P1 stays overlapping the pendulum bob for 10 ticks (0.167s < 0.6s cooldown)
    const res = stepMany(
      state,
      10,
      { ...NEUTRAL_INPUT, lift: -1 },
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );

    assert.equal(res.state.failures, 0, 'Single pendulum contact must not instant-snap');
    assert.equal(
      res.events.filter((e) => e.kind === 'rope_snap').length,
      0,
      'Must not emit rope_snap from single contact',
    );
    assert.ok(
      res.state.ropeStrain > 0.3 && res.state.ropeStrain <= 0.45,
      `Expected +0.45 strain applied once then decaying slightly, got ${res.state.ropeStrain}`,
    );
  });

  it('advances checkpoints and finishes on Lantern Peak with course_clear, packing clean snapshot', () => {
    const course = makeTestCourse();
    let state = createInitialRopeSimState(course);

    // Move both players onto checkpoint 1 island (z >= 27, y = 0.8)
    state = {
      ...state,
      ropeStrain: 0.4,
      p1: { ...state.p1, x: -1.2, y: 0.8, z: 27.2, grounded: true },
      p2: { ...state.p2, x: 1.2, y: 0.8, z: 27.2, grounded: true },
    };
    const cpState = stepRopeSim(state, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);
    assert.equal(cpState.checkpointIndex, 1);
    assert.equal(cpState.ropeStrain, 0);
    const cpEvt = cpState.events.find((e) => e.kind === 'checkpoint');
    assert.ok(cpEvt, 'Expected checkpoint event');
    assert.equal(cpEvt.checkpointIndex, 1);

    // Move both players onto Lantern Peak finish island (z >= 135, y = 4.5)
    const peakState: RopeSimState = {
      ...cpState,
      p1: { ...cpState.p1, x: -1.2, y: 4.5, z: 135.2, grounded: true },
      p2: { ...cpState.p2, x: 1.2, y: 4.5, z: 135.2, grounded: true },
    };
    const finState = stepRopeSim(peakState, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);
    assert.equal(finState.phase, 'finished');
    assert.equal(finState.events.filter((e) => e.kind === 'course_clear').length, 1);

    const snap = packRopeSnapshot('match-rope-1', {
      ...finState,
      p1: { ...finState.p1, x: -0.0001, yaw: -0 },
    });
    assert.equal(snap.mapId, 'rope_tether');
    assert.equal(snap.matchId, 'match-rope-1');
    assert.ok(Object.is(snap.p1.x, 0), 'Expected -0 normalized to +0');
    assert.ok(Object.is(snap.p1.yaw, 0), 'Expected -0 normalized to +0');

    const postFinish = stepRopeSim(finState, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);
    assert.equal(postFinish.phase, 'finished');
    assert.equal(postFinish.events.length, 0);
  });

  it('resists wind 85% while anchored, carries players on moving islands, and supports coyote/buffer jump', () => {
    const windCourse = makeTestCourse({
      islands: [
        {
          id: 'wind-deck',
          surface: 'ice',
          box: { minX: -10, maxX: 10, minY: -1, maxY: 0, minZ: -2, maxZ: 10 },
        },
      ],
      windZones: [
        {
          id: 'test-wind',
          box: { minX: -10, maxX: 10, minY: -0.5, maxY: 4, minZ: -2, maxZ: 10 },
          forceX: 10,
          periodSec: 5,
          warnDurationSec: 0,
          activeDurationSec: 5,
          phaseOffsetSec: 0,
        },
      ],
    });
    const windInit = createInitialRopeSimState(windCourse);
    // P1 anchors while P2 does not; run for 0.5s
    const windRes = stepMany(
      windInit,
      30,
      { ...NEUTRAL_INPUT, lift: -1, jump: true },
      NEUTRAL_INPUT,
      FIXED_DT,
      windCourse,
    );
    assert.equal(windRes.state.p1.inWind, true);
    assert.equal(windRes.state.p2.inWind, true);
    assert.equal(windRes.state.p1.onIce, true);
    assert.equal(windRes.state.p1.grounded, true, 'Jump should be blocked while anchored');
    const p1Drift = Math.abs(windRes.state.p1.x - windInit.p1.x);
    const p2Drift = Math.abs(windRes.state.p2.x - windInit.p2.x);
    assert.ok(
      p1Drift < p2Drift * 0.25,
      `Anchored player should resist wind strongly (p1Drift=${p1Drift}, p2Drift=${p2Drift})`,
    );

    // Moving island carry test (horizontal + vertical)
    const movingCourse = makeTestCourse({
      islands: [],
      movingIslands: [
        {
          id: 'mover-x',
          surface: 'wood',
          baseBox: { minX: -4, maxX: 4, minY: -1, maxY: 0, minZ: -2, maxZ: 4 },
          axis: 'x',
          amplitude: 2,
          speed: 1.5,
          phase: 0,
        },
      ],
    });
    const moverInit = createInitialRopeSimState(movingCourse);
    const moverRes = stepMany(
      moverInit,
      30,
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
      FIXED_DT,
      movingCourse,
    );
    assert.ok(
      moverRes.state.p1.x > moverInit.p1.x + 0.5,
      `Expected moving island to carry P1 in +X, got ${moverRes.state.p1.x}`,
    );
    assert.equal(moverRes.state.p1.grounded, true);

    // Coyote jump & deep-fall (< -9) single-player snap test + immutability check
    const snapshotBefore = JSON.stringify(moverInit);
    const edgeState: RopeSimState = {
      ...moverInit,
      p1: { ...moverInit.p1, grounded: false, coyoteTimer: 0.08 },
    };
    const coyoteJump = stepRopeSim(
      edgeState,
      { ...NEUTRAL_INPUT, jump: true },
      NEUTRAL_INPUT,
      FIXED_DT,
      makeTestCourse(),
    );
    assert.ok(coyoteJump.p1.vy > 7, 'Expected coyote jump to trigger');
    assert.equal(JSON.stringify(moverInit), snapshotBefore, 'stepRopeSim must not mutate input state');

    const deepBase = createInitialRopeSimState(makeTestCourse());
    const deepFallState: RopeSimState = {
      ...deepBase,
      p1: { ...deepBase.p1, y: -9.2, grounded: false },
      p2: { ...deepBase.p2, y: -5.5, grounded: false },
    };
    const deepSnap = stepRopeSim(
      deepFallState,
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
      FIXED_DT,
      makeTestCourse(),
    );
    assert.ok(deepSnap.events.some((e) => e.kind === 'rope_snap'));
    assert.equal(deepSnap.failures, 1);
  });
});
