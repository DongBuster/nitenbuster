import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RAFT_BOOST_DURATION,
  RAFT_COURSE,
  RAFT_FINISH_Z,
  RAFT_INVULN_SEC,
  RAFT_MAX_HP,
  RAFT_RESPAWN_SEC,
  RAFT_RIVER_HALF_WIDTH,
  evaluateRaftObstacles,
  getRaftStageNumberForZ,
} from '../course.ts';
import {
  createInitialRaftSimState,
  packRaftSnapshot,
  stepRaftSim,
} from '../physics.ts';
import type { RaftCourseDef, RaftSimEvent, RaftSimState } from '../types.ts';
import type { PlayerInput } from '../../../../glass/sim/types.ts';

const FIXED_DT = 1 / 60;

const NEUTRAL_INPUT: PlayerInput = {
  moveX: 0,
  moveZ: 0,
  jump: false,
  lift: 0,
};

function stepMany(
  initial: RaftSimState,
  steps: number,
  p1Input: PlayerInput | ((s: RaftSimState, i: number) => PlayerInput),
  p2Input: PlayerInput | ((s: RaftSimState, i: number) => PlayerInput),
  dt: number = FIXED_DT,
  course: RaftCourseDef = RAFT_COURSE,
): { state: RaftSimState; events: RaftSimEvent[] } {
  let state = initial;
  const events: RaftSimEvent[] = [];
  for (let i = 0; i < steps; i += 1) {
    const in1 = typeof p1Input === 'function' ? p1Input(state, i) : p1Input;
    const in2 = typeof p2Input === 'function' ? p2Input(state, i) : p2Input;
    state = stepRaftSim(state, in1, in2, dt, course);
    events.push(...state.events);
  }
  return { state, events };
}

function makeTestCourse(overrides: Partial<RaftCourseDef> = {}): RaftCourseDef {
  return {
    finishZ: RAFT_FINISH_Z,
    riverHalfWidth: RAFT_RIVER_HALF_WIDTH,
    stages: [
      { number: 1, name: 'Test Stage 1', startZ: 0, endZ: 32 },
      { number: 2, name: 'Test Stage 2', startZ: 32, endZ: RAFT_FINISH_Z },
    ],
    checkpoints: [
      {
        index: 0,
        stageNumber: 1,
        stageName: 'Test Stage 1',
        triggerZ: 0,
        spawnX: 0,
        spawnZ: 0,
      },
      {
        index: 1,
        stageNumber: 2,
        stageName: 'Test Stage 2',
        triggerZ: 32,
        spawnX: 0,
        spawnZ: 32,
      },
    ],
    rocks: [],
    logs: [],
    whirlpools: [],
    currentZones: [],
    ...overrides,
  };
}

describe('raft course definition & determinism', () => {
  it('defines 5 stages, 5 safe checkpoints, Stage 4 fast current, and deterministic obstacles', () => {
    assert.equal(RAFT_COURSE.finishZ, 160);
    assert.equal(RAFT_COURSE.riverHalfWidth, 6.5);
    assert.equal(RAFT_COURSE.stages.length, 5);
    assert.equal(RAFT_COURSE.checkpoints.length, 5);
    for (const cp of RAFT_COURSE.checkpoints) {
      assert.equal(cp.spawnX, 0);
    }

    assert.equal(getRaftStageNumberForZ(RAFT_COURSE, 0), 1);
    assert.equal(getRaftStageNumberForZ(RAFT_COURSE, 32), 2);
    assert.equal(getRaftStageNumberForZ(RAFT_COURSE, 64), 3);
    assert.equal(getRaftStageNumberForZ(RAFT_COURSE, 96), 4);
    assert.equal(getRaftStageNumberForZ(RAFT_COURSE, 128), 5);

    const stage4Current = RAFT_COURSE.currentZones.find(
      (z) => z.minZ === 96 && z.maxZ === 128,
    );
    assert.ok(stage4Current, 'Expected Stage 4 current zone 96..128');
    assert.equal(stage4Current.currentZ, 4.2);

    const stage3Whirlpools = RAFT_COURSE.whirlpools.filter(
      (w) => w.z >= 64 && w.z < 96,
    );
    const stage5Whirlpools = RAFT_COURSE.whirlpools.filter(
      (w) => w.z >= 128 && w.z <= 160,
    );
    assert.ok(stage3Whirlpools.length >= 2);
    assert.ok(stage5Whirlpools.length >= 1);

    const obsA = evaluateRaftObstacles(RAFT_COURSE, 3.75);
    const obsB = evaluateRaftObstacles(RAFT_COURSE, 3.75);
    assert.deepEqual(obsA, obsB);
  });
});

describe('raft paddling & synchronized boost', () => {
  it('steers opposite directions when P1 (+X left) or P2 (-X right) paddles alone', () => {
    const course = makeTestCourse();
    const init = createInitialRaftSimState(course);

    const p1Only = stepMany(
      init,
      45,
      { ...NEUTRAL_INPUT, lift: 1 },
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );
    assert.ok(
      p1Only.events.some((e) => e.kind === 'paddle_p1'),
      'Expected paddle_p1 event',
    );
    assert.ok(
      p1Only.state.raft.yaw < -0.1,
      `Expected P1 left-side forward stroke to turn nose right (yaw < 0), got ${p1Only.state.raft.yaw}`,
    );
    assert.ok(
      p1Only.state.raft.x < -0.1,
      `Expected P1 forward strokes to drift right (-X), got ${p1Only.state.raft.x}`,
    );

    const p2Only = stepMany(
      init,
      45,
      NEUTRAL_INPUT,
      { ...NEUTRAL_INPUT, lift: 1 },
      FIXED_DT,
      course,
    );
    assert.ok(
      p2Only.events.some((e) => e.kind === 'paddle_p2'),
      'Expected paddle_p2 event',
    );
    assert.ok(
      p2Only.state.raft.yaw > 0.1,
      `Expected P2 right-side forward stroke to turn nose left (yaw > 0), got ${p2Only.state.raft.yaw}`,
    );
    assert.ok(
      p2Only.state.raft.x > 0.1,
      `Expected P2 forward strokes to drift left (+X), got ${p2Only.state.raft.x}`,
    );
  });

  it('triggers synchronized boost once when P1 and P2 paddle forward within 0.25s', () => {
    const course = makeTestCourse();
    let state = createInitialRaftSimState(course);

    // P1 strokes at tick 1
    state = stepRaftSim(
      state,
      { ...NEUTRAL_INPUT, lift: 1 },
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );
    assert.equal(
      state.events.filter((e) => e.kind === 'raft_boost').length,
      0,
    );

    // 0.15s later (9 ticks at 60Hz), P2 strokes forward -> within 0.25s window
    const mid = stepMany(state, 8, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);
    const boosted = stepRaftSim(
      mid.state,
      NEUTRAL_INPUT,
      { ...NEUTRAL_INPUT, moveZ: 1 },
      FIXED_DT,
      course,
    );

    assert.equal(
      boosted.events.filter((e) => e.kind === 'raft_boost').length,
      1,
      'Expected exactly one raft_boost event on sync pair',
    );
    assert.equal(boosted.raft.boostTimer, RAFT_BOOST_DURATION);

    // Simultaneous stroke in single tick also produces only 1 boost event
    const simInit = createInitialRaftSimState(course);
    const simStep = stepRaftSim(
      simInit,
      { ...NEUTRAL_INPUT, lift: 1 },
      { ...NEUTRAL_INPUT, lift: 1 },
      FIXED_DT,
      course,
    );
    assert.equal(
      simStep.events.filter((e) => e.kind === 'raft_boost').length,
      1,
      'Expected no double-trigger on simultaneous forward strokes',
    );
  });
});

describe('raft jump, log collision, and invulnerability', () => {
  it('clears a floating log cleanly with synchronized jump', () => {
    const course = makeTestCourse({
      logs: [
        {
          id: 'test-log',
          baseX: 0,
          z: 4.65,
          halfLength: 5,
          radius: 0.42,
          moveAmpX: 0,
          moveSpeed: 0,
          phase: 0,
        },
      ],
    });
    let state = createInitialRaftSimState(course);

    // Build forward speed first
    const accel = stepMany(
      state,
      19,
      { ...NEUTRAL_INPUT, lift: 1 },
      { ...NEUTRAL_INPUT, lift: 1 },
      FIXED_DT,
      course,
    );
    state = accel.state;

    // Trigger synchronized jump slightly staggered (within 0.30s) right before log
    state = stepRaftSim(
      state,
      { ...NEUTRAL_INPUT, jump: true },
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );
    state = stepRaftSim(
      state,
      NEUTRAL_INPUT,
      { ...NEUTRAL_INPUT, jump: true },
      FIXED_DT,
      course,
    );
    assert.ok(
      state.events.some((e) => e.kind === 'raft_jump'),
      'Expected raft_jump event',
    );
    assert.ok(state.raft.vy > 7);

    // Continue until well past z = 5.5 + 2
    const crossed = stepMany(
      state,
      80,
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );
    assert.ok(
      crossed.state.raft.z > 7,
      `Expected raft to cross log, z=${crossed.state.raft.z}`,
    );
    assert.equal(crossed.state.raft.hp, RAFT_MAX_HP);
    assert.equal(
      crossed.events.filter((e) => e.kind === 'raft_hit').length,
      0,
    );
    // Gravity lands raft back on water y = 0
    assert.equal(crossed.state.raft.y, 0);
  });

  it('takes 1 HP damage when hitting a log without jumping and grants 0.8s invulnerability', () => {
    const course = makeTestCourse({
      logs: [
        {
          id: 'test-log',
          baseX: 0,
          z: 2.2,
          halfLength: 5,
          radius: 0.42,
          moveAmpX: 0,
          moveSpeed: 0,
          phase: 0,
        },
      ],
      rocks: [
        {
          id: 'followup-rock',
          x: 0,
          z: 2.2,
          radius: 1.0,
        },
      ],
    });
    const init = createInitialRaftSimState(course);
    const res = stepMany(init, 40, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);

    const hitEvents = res.events.filter((e) => e.kind === 'raft_hit');
    assert.equal(hitEvents.length, 1, 'Expected exactly 1 hit due to 0.8s invuln');
    assert.equal(res.state.raft.hp, RAFT_MAX_HP - 1);
    assert.ok(res.state.raft.invulnTimer > 0 && res.state.raft.invulnTimer <= RAFT_INVULN_SEC);
  });
});

describe('raft whirlpools, capsize respawn, checkpoints, and finish', () => {
  it('pulls and spins raft inside whirlpool radius when on water', () => {
    const course = makeTestCourse({
      whirlpools: [
        {
          id: 'wp-right',
          x: 2.5,
          z: 2.5,
          radius: 4.5,
          pullStrength: 8.0,
          spinDir: 1,
        },
      ],
    });
    const init = createInitialRaftSimState(course);
    const res = stepMany(init, 45, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);

    assert.equal(res.state.raft.inWhirlpool, true);
    assert.ok(
      res.state.raft.x > 0.1,
      `Expected whirlpool pull toward x=2.5, got x=${res.state.raft.x}`,
    );
    assert.ok(
      res.state.raft.yaw > 0.1 && res.state.raft.angularVel > 0.1,
      'Expected spinDir=1 whirlpool to spin raft positively',
    );

    const ccwCourse = makeTestCourse({
      whirlpools: [
        {
          id: 'wp-ccw',
          x: 2.5,
          z: 2.5,
          radius: 4.5,
          pullStrength: 8.0,
          spinDir: -1,
        },
      ],
    });
    const ccwRes = stepMany(
      createInitialRaftSimState(ccwCourse),
      45,
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
      FIXED_DT,
      ccwCourse,
    );
    assert.ok(
      ccwRes.state.raft.yaw < -0.1,
      'Expected spinDir=-1 whirlpool to spin raft negatively',
    );
  });

  it('capsizes at 0 HP, locks for 1.1s, then respawns at current checkpoint with full HP', () => {
    const course = makeTestCourse({
      rocks: [
        { id: 'r1', x: 0, z: 2.0, radius: 1.0 },
      ],
    });
    let state = createInitialRaftSimState(course);
    state = {
      ...state,
      checkpointIndex: 0,
      raft: { ...state.raft, hp: 1, z: 1.5 },
    };

    // Hit rock to reach 0 HP
    const hitRes = stepMany(
      state,
      20,
      { ...NEUTRAL_INPUT, lift: 1 },
      { ...NEUTRAL_INPUT, lift: 1 },
      FIXED_DT,
      course,
    );
    assert.ok(
      hitRes.events.some((e) => e.kind === 'raft_capsize'),
      'Expected raft_capsize event',
    );
    assert.equal(hitRes.state.failures, 1);
    assert.equal(hitRes.state.raft.hp, 0);
    assert.ok(hitRes.state.raft.respawnTimer > 0);

    // Wait just under 1.1s -> still respawning
    const capsizeTickIdx = hitRes.events.findIndex((e) => e.kind === 'raft_capsize');
    assert.ok(capsizeTickIdx >= 0);

    // Create fresh 0-HP capsize at exact timer to test 1.1s duration cleanly
    const lockedState: RaftSimState = {
      ...hitRes.state,
      raft: {
        ...hitRes.state.raft,
        x: 3.0,
        z: 10.0,
        respawnTimer: RAFT_RESPAWN_SEC,
      },
    };
    const beforeDone = stepMany(
      lockedState,
      60, // 1.0s < 1.1s
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
      FIXED_DT,
      course,
    );
    assert.ok(beforeDone.state.raft.respawnTimer > 0);
    assert.equal(
      beforeDone.events.filter((e) => e.kind === 'respawn').length,
      0,
    );

    let respawnState = beforeDone.state;
    const respawnEvents: RaftSimEvent[] = [];
    for (let i = 0; i < 10; i += 1) {
      respawnState = stepRaftSim(
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
    assert.equal(respawnState.raft.respawnTimer, 0);
    assert.equal(respawnState.raft.hp, RAFT_MAX_HP);
    assert.equal(respawnState.raft.x, course.checkpoints[0].spawnX);
    assert.equal(respawnState.raft.z, course.checkpoints[0].spawnZ);
    assert.equal(respawnState.raft.vx, 0);
    assert.equal(respawnState.raft.vz, 0);
    assert.equal(respawnState.raft.yaw, 0);
    assert.equal(respawnState.raft.invulnTimer, 1.0);
    assert.equal(
      respawnEvents.filter((e) => e.kind === 'respawn').length,
      1,
    );
  });

  it('restores HP to 3 when crossing next checkpoint and finishes at z >= 160', () => {
    const course = makeTestCourse();
    let state = createInitialRaftSimState(course);
    state = {
      ...state,
      raft: {
        ...state.raft,
        hp: 1,
        z: 31.8,
        vz: 4.0,
      },
    };

    const cpRes = stepMany(state, 10, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, course);
    assert.equal(cpRes.state.checkpointIndex, 1);
    assert.equal(cpRes.state.raft.hp, RAFT_MAX_HP);
    const cpEvt = cpRes.events.find((e) => e.kind === 'checkpoint');
    assert.ok(cpEvt, 'Expected checkpoint event');
    assert.equal(cpEvt.checkpointIndex, 1);

    // Near finish line z = 160
    const nearFinish: RaftSimState = {
      ...cpRes.state,
      raft: {
        ...cpRes.state.raft,
        z: 159.8,
        vz: 4.0,
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

    // Further stepping after finish emits no events and stays finished
    const postFinish = stepRaftSim(
      finRes.state,
      { ...NEUTRAL_INPUT, lift: 1 },
      { ...NEUTRAL_INPUT, lift: 1 },
      FIXED_DT,
      course,
    );
    assert.equal(postFinish.phase, 'finished');
    assert.equal(postFinish.events.length, 0);
  });

  it('packs compact RaftSnapshotPayload with 2-decimal rounding and -0 normalization', () => {
    const init = createInitialRaftSimState();
    const skewed: RaftSimState = {
      ...init,
      tick: 12,
      matchTime: 0.20000000000000004,
      raft: {
        ...init.raft,
        x: -0.0001,
        y: 1.23456,
        z: 14.999,
        yaw: -0,
      },
    };
    const snap = packRaftSnapshot('match-42', skewed);
    assert.equal(snap.mapId, 'raft_rapids');
    assert.equal(snap.matchId, 'match-42');
    assert.equal(snap.tick, 12);
    assert.equal(snap.matchTime, 0.2);
    assert.ok(Object.is(snap.raft.x, 0), 'Expected -0 normalized to +0');
    assert.ok(Object.is(snap.raft.yaw, 0), 'Expected -0 normalized to +0');
    assert.equal(snap.raft.y, 1.23);
    assert.equal(snap.raft.z, 15);
  });
});
