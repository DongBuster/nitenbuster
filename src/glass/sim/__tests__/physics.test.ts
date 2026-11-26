import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COURSE_FINISH_Z,
  FALL_Y_LIMIT,
  FIXED_DT,
  GLASS_BREAK_DIST,
  GLASS_MAX_HP,
  GLASS_SAFE_MAX_DIST,
  HAND_BASE_Y,
  INVULN_AFTER_CRACK_SEC,
  INVULN_AFTER_RESPAWN_SEC,
  LIFT_DOWN_OFFSET,
  LIFT_UP_OFFSET,
  PLAYER_MAX_SPEED,
  SHATTER_RESPAWN_SEC,
} from '../constants.ts';
import { GLASS_COURSE } from '../course.ts';
import {
  NEUTRAL_INPUT,
  checkGlassSegmentBoxHit,
  createInitialSimState,
  getPlayerHandY,
  stepGlassSim,
} from '../physics.ts';
import type { CourseDef, GlassSimState, PlayerInput } from '../types.ts';

function stepMany(
  initial: GlassSimState,
  steps: number,
  p1Input: PlayerInput | ((s: GlassSimState, i: number) => PlayerInput),
  p2Input: PlayerInput | ((s: GlassSimState, i: number) => PlayerInput),
  dt: number = FIXED_DT,
  course: CourseDef = GLASS_COURSE,
): { state: GlassSimState; events: GlassSimState['events'] } {
  let state = initial;
  const events: GlassSimState['events'] = [];
  for (let i = 0; i < steps; i += 1) {
    const in1 = typeof p1Input === 'function' ? p1Input(state, i) : p1Input;
    const in2 = typeof p2Input === 'function' ? p2Input(state, i) : p2Input;
    state = stepGlassSim(state, in1, in2, dt, course);
    events.push(...state.events);
  }
  return { state, events };
}

function makeSimpleCourse(overrides: Partial<CourseDef> = {}): CourseDef {
  return {
    finishZ: COURSE_FINISH_Z,
    stages: [{ number: 1, name: 'Test Stage', startZ: 0, endZ: COURSE_FINISH_Z }],
    checkpoints: [
      {
        index: 0,
        stageNumber: 1,
        stageName: 'Test Stage',
        triggerZ: 0,
        p1Spawn: { x: -1.6, y: 0, z: 1.5 },
        p2Spawn: { x: 1.6, y: 0, z: 1.5 },
      },
    ],
    platforms: [
      {
        id: 'test-wood',
        surface: 'wood',
        box: { minX: -5, maxX: 5, minY: -1, maxY: 0, minZ: -2, maxZ: 30 },
      },
    ],
    movingPlatforms: [],
    barriers: [],
    windZones: [],
    pendulums: [],
    spinners: [],
    ...overrides,
  };
}

describe('glass physics helpers & initialization', () => {
  it('computes getPlayerHandY from player y, HAND_BASE_Y, and liftOffset', () => {
    const initial = createInitialSimState();
    assert.ok(Math.abs(getPlayerHandY(initial.p1) - HAND_BASE_Y) < 1e-9);

    const lowered = { ...initial.p1, y: 0.5, liftOffset: LIFT_DOWN_OFFSET };
    assert.ok(Math.abs(getPlayerHandY(lowered) - (0.5 + HAND_BASE_Y + LIFT_DOWN_OFFSET)) < 1e-9);

    const raised = { ...initial.p1, y: 0, liftOffset: LIFT_UP_OFFSET };
    assert.ok(Math.abs(getPlayerHandY(raised) - (HAND_BASE_Y + LIFT_UP_OFFSET)) < 1e-9);
  });

  it('checks glass 5-sample OBB collision accurately against AABB boxes', () => {
    // Side-by-side glass at z = 7.3, y = 0.95 (span y in [0.60, 1.30])
    const hitLowGap = checkGlassSegmentBoxHit(
      { x: -1.6, y: 0.95, z: 7.3 },
      { x: 1.6, y: 0.95, z: 7.3 },
      { minX: -4.6, maxX: 4.6, minY: 0.95, maxY: 2.6, minZ: 7.0, maxZ: 7.6 },
    );
    assert.equal(hitLowGap, true);

    // Lowered glass at y = 0.40 (span y in [0.05, 0.75]) clears lowGap [0.95, 2.60]
    const clearLowGap = checkGlassSegmentBoxHit(
      { x: -1.6, y: 0.4, z: 7.3 },
      { x: 1.6, y: 0.4, z: 7.3 },
      { minX: -4.6, maxX: 4.6, minY: 0.95, maxY: 2.6, minZ: 7.0, maxZ: 7.6 },
    );
    assert.equal(clearLowGap, false);
  });

  it('creates initial state at checkpoint 0 without mutating inputs across steps', () => {
    const init = createInitialSimState();
    const snapshot = structuredClone(init);

    assert.equal(init.phase, 'playing');
    assert.equal(init.tick, 0);
    assert.equal(init.matchTime, 0);
    assert.equal(init.checkpointIndex, 0);
    assert.equal(init.glass.hp, GLASS_MAX_HP);
    assert.equal(init.glass.stress, 0);
    assert.equal(init.events.length, 0);

    const next = stepGlassSim(
      init,
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      FIXED_DT,
    );
    assert.deepEqual(init, snapshot);
    assert.equal(next.tick, 1);
    assert.ok(next.p1.z > init.p1.z);
  });
});

describe('Task 3 required physics scenarios', () => {
  it('1. handles movement normalization, jumping, landing, and coyote time', () => {
    const ledgeCourse = makeSimpleCourse({
      platforms: [
        {
          id: 'ledge',
          surface: 'wood',
          box: { minX: -5, maxX: 5, minY: -1, maxY: 0, minZ: -2, maxZ: 3 },
        },
      ],
    });

    // Diagonal input is normalized so horizontal speed does not exceed PLAYER_MAX_SPEED
    const runCourse = makeSimpleCourse();
    const { state: diagState } = stepMany(
      createInitialSimState(runCourse),
      40,
      { moveX: 1, moveZ: 1, jump: false, lift: 0 },
      { moveX: 1, moveZ: 1, jump: false, lift: 0 },
      FIXED_DT,
      runCourse,
    );
    const diagSpeed = Math.hypot(diagState.p1.vx, diagState.p1.vz);
    assert.ok(diagSpeed <= PLAYER_MAX_SPEED + 1e-4, `Expected speed <= ${PLAYER_MAX_SPEED}, got ${diagSpeed}`);
    assert.ok(diagSpeed > PLAYER_MAX_SPEED * 0.9);

    // Jump from ground, ascend, and land cleanly
    let jumpState = stepGlassSim(
      createInitialSimState(runCourse),
      { moveX: 0, moveZ: 0, jump: true, lift: 0 },
      NEUTRAL_INPUT,
      FIXED_DT,
      runCourse,
    );
    assert.equal(jumpState.p1.grounded, false);
    assert.ok(jumpState.p1.vy > 0);
    assert.ok(jumpState.p1.y > 0);

    ({ state: jumpState } = stepMany(jumpState, 60, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, runCourse));
    assert.equal(jumpState.p1.grounded, true);
    assert.equal(jumpState.p1.y, 0);

    // Coyote time: step off ledge (maxZ = 3, landing tolerance +0.28 -> airborne past z > 3.28)
    let edgeState = createInitialSimState(ledgeCourse);
    edgeState = {
      ...edgeState,
      p1: { ...edgeState.p1, z: 3.35, vz: 3.0, grounded: true },
      p2: { ...edgeState.p2, z: 3.35, vz: 3.0, grounded: true },
    };
    // 1 tick with no jump -> falls off ledge, grounded becomes false
    edgeState = stepGlassSim(edgeState, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, ledgeCourse);
    assert.equal(edgeState.p1.grounded, false);
    assert.ok(edgeState.p1.y < 0);

    // Wait 3 more ticks (total 0.067s < COYOTE_TIME_SEC = 0.1s), then jump -> coyote jump succeeds!
    ({ state: edgeState } = stepMany(edgeState, 3, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, ledgeCourse));
    const coyoteJump = stepGlassSim(
      edgeState,
      { moveX: 0, moveZ: 0, jump: true, lift: 0 },
      NEUTRAL_INPUT,
      FIXED_DT,
      ledgeCourse,
    );
    assert.ok(coyoteJump.p1.vy > 0, 'Coyote jump within 0.1s off ledge should launch upward');

    // Waiting > 0.1s off ledge expires coyote timer so jump does not trigger
    const { state: expiredState } = stepMany(edgeState, 5, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, ledgeCourse);
    const lateJump = stepGlassSim(
      expiredState,
      { moveX: 0, moveZ: 0, jump: true, lift: 0 },
      NEUTRAL_INPUT,
      FIXED_DT,
      ledgeCourse,
    );
    assert.ok(lateJump.p1.vy < 0, 'Jump after coyote window expires should not launch upward');
  });

  it('2. distinguishes ice vs wood acceleration and friction', () => {
    const woodCourse = makeSimpleCourse({
      platforms: [
        { id: 'wood', surface: 'wood', box: { minX: -5, maxX: 5, minY: -1, maxY: 0, minZ: -2, maxZ: 60 } },
      ],
    });
    const iceCourse = makeSimpleCourse({
      platforms: [
        { id: 'ice', surface: 'ice', box: { minX: -5, maxX: 5, minY: -1, maxY: 0, minZ: -2, maxZ: 60 } },
      ],
    });

    // Acceleration phase: wood reaches higher velocity faster than ice
    const { state: woodAccel } = stepMany(
      createInitialSimState(woodCourse),
      12,
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      FIXED_DT,
      woodCourse,
    );
    const { state: iceAccel } = stepMany(
      createInitialSimState(iceCourse),
      12,
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      FIXED_DT,
      iceCourse,
    );
    assert.equal(woodAccel.p1.onIce, false);
    assert.equal(iceAccel.p1.onIce, true);
    assert.ok(woodAccel.p1.vz > iceAccel.p1.vz);

    // Braking / coasting phase from identical top speed: ice slides much farther than wood
    const woodStart: GlassSimState = {
      ...createInitialSimState(woodCourse),
      p1: { ...createInitialSimState(woodCourse).p1, vz: PLAYER_MAX_SPEED },
      p2: { ...createInitialSimState(woodCourse).p2, vz: PLAYER_MAX_SPEED },
    };
    const iceStart: GlassSimState = {
      ...createInitialSimState(iceCourse),
      p1: { ...createInitialSimState(iceCourse).p1, vz: PLAYER_MAX_SPEED },
      p2: { ...createInitialSimState(iceCourse).p2, vz: PLAYER_MAX_SPEED },
    };

    const { state: woodCoast } = stepMany(woodStart, 18, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, woodCourse);
    const { state: iceCoast } = stepMany(iceStart, 18, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT, iceCourse);

    assert.ok(iceCoast.p1.vz > woodCoast.p1.vz * 3, 'Ice velocity should decay much more slowly than wood');
    assert.ok(iceCoast.p1.z > woodCoast.p1.z + 0.5, 'Ice should slide significantly farther than wood');
  });

  it('3. builds stress when stretched past 3.9m, shatters, and respawns after 1.2s at checkpoint', () => {
    const init = createInitialSimState();
    let state = init;
    let sawStress = false;
    let shatterEvent: GlassSimState['events'][number] | undefined;

    for (let i = 0; i < 180; i += 1) {
      state = stepGlassSim(
        state,
        { moveX: -1, moveZ: 0, jump: false, lift: 0 },
        { moveX: 1, moveZ: 0, jump: false, lift: 0 },
        FIXED_DT,
      );
      if (state.glass.length > GLASS_SAFE_MAX_DIST && state.glass.stress > 0 && state.glass.shatterTimer === 0) {
        sawStress = true;
      }
      const ev = state.events.find((e) => e.kind === 'glass_shatter');
      if (ev) {
        shatterEvent = ev;
        break;
      }
    }

    assert.equal(sawStress, true, 'Expected glass stress to accumulate when stretched past 3.9m');
    assert.ok(shatterEvent, 'Expected glass_shatter event');
    assert.equal(shatterEvent.reason, 'stretch');
    assert.equal(state.shatters, 1);
    assert.equal(state.glass.shatterTimer, SHATTER_RESPAWN_SEC);

    // During shatter lock (< 1.2s), inputs are ignored and players stay frozen
    const frozenPos = { x1: state.p1.x, x2: state.p2.x };
    const { state: lockedState, events: lockedEvents } = stepMany(
      state,
      71,
      { moveX: 0, moveZ: 1, jump: true, lift: 1 },
      { moveX: 0, moveZ: 1, jump: true, lift: 1 },
      FIXED_DT,
    );
    assert.ok(lockedState.glass.shatterTimer > 0);
    assert.equal(lockedState.p1.x, frozenPos.x1);
    assert.equal(lockedState.p2.x, frozenPos.x2);
    assert.equal(lockedEvents.length, 0);

    // Tick 72 completes 1.2s and respawns at checkpoint 0
    const respawned = stepGlassSim(
      lockedState,
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      FIXED_DT,
    );
    const respawnEv = respawned.events.find((e) => e.kind === 'respawn');
    assert.ok(respawnEv, 'Expected respawn event once shatterTimer hits 0');
    assert.equal(respawnEv.checkpointIndex, 0);
    assert.equal(respawned.glass.shatterTimer, 0);
    assert.equal(respawned.glass.shatterReason, null);
    assert.equal(respawned.glass.hp, GLASS_MAX_HP);
    assert.equal(respawned.glass.stress, 0);
    assert.equal(respawned.glass.invulnTimer, INVULN_AFTER_RESPAWN_SEC);
    assert.equal(respawned.p1.x, GLASS_COURSE.checkpoints[0].p1Spawn.x);
    assert.equal(respawned.p1.z, GLASS_COURSE.checkpoints[0].p1Spawn.z);
    assert.equal(respawned.p2.x, GLASS_COURSE.checkpoints[0].p2Spawn.x);
    assert.equal(respawned.p2.z, GLASS_COURSE.checkpoints[0].p2Spawn.z);
  });

  it('4. cracks glass on lowGap (y in [0.95, 2.60]) at neutral height, but clears cleanly with lift: -1', () => {
    const start = createInitialSimState();

    // Neutral lift hits s1-low-gap-1 (z in [7.0, 7.6])
    const { state: neutralEnd, events: neutralEvents } = stepMany(
      start,
      90,
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
    );
    assert.ok(neutralEnd.p1.z > 8.0);
    assert.equal(neutralEnd.glass.hp, 2);
    assert.equal(neutralEvents.filter((e) => e.kind === 'glass_crack').length, 1);

    // Holding lift: -1 lowers hands to 0.40m (top 0.75m < 0.95m) and clears cleanly
    const { state: crouchedEnd, events: crouchedEvents } = stepMany(
      start,
      90,
      { moveX: 0, moveZ: 1, jump: false, lift: -1 },
      { moveX: 0, moveZ: 1, jump: false, lift: -1 },
    );
    assert.ok(crouchedEnd.p1.z > 8.0);
    assert.equal(crouchedEnd.glass.hp, GLASS_MAX_HP);
    assert.equal(crouchedEvents.length, 0);
  });

  it('5. cracks glass on center highWall (y in [0, 1.25]) at neutral height, but clears cleanly with lift: +1', () => {
    const base = createInitialSimState();
    const beforeHighWall: GlassSimState = {
      ...base,
      p1: { ...base.p1, x: -1.6, z: 10.6 },
      p2: { ...base.p2, x: 1.6, z: 10.6 },
    };

    // Neutral lift hits s1-high-wall-1 (z in [12.0, 12.6], y in [0, 1.25])
    const { state: neutralEnd, events: neutralEvents } = stepMany(
      beforeHighWall,
      45,
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
    );
    assert.ok(neutralEnd.p1.z > 13.0);
    assert.equal(neutralEnd.glass.hp, 2);
    assert.equal(neutralEvents.filter((e) => e.kind === 'glass_crack').length, 1);

    // Holding lift: +1 raises hands to 1.80m (bottom 1.45m > 1.25m) and clears cleanly
    const { state: raisedEnd, events: raisedEvents } = stepMany(
      beforeHighWall,
      45,
      { moveX: 0, moveZ: 1, jump: false, lift: 1 },
      { moveX: 0, moveZ: 1, jump: false, lift: 1 },
    );
    assert.ok(raisedEnd.p1.z > 13.0);
    assert.equal(raisedEnd.glass.hp, GLASS_MAX_HP);
    assert.equal(raisedEvents.length, 0);
  });

  it('6. blocks side-by-side glass at narrow 2.2m gate, while rotated single-file clears with hp === 3', () => {
    const base = createInitialSimState();

    // Symmetric side-by-side (dx = 3.2m) is blocked by s1-gate-left / s1-gate-right (opening x in [-1.1, 1.1])
    const sideBlocked: GlassSimState = {
      ...base,
      p1: { ...base.p1, x: -1.6, z: 20.5 },
      p2: { ...base.p2, x: 1.6, z: 20.5 },
    };
    const { state: blockedEnd } = stepMany(
      sideBlocked,
      45,
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
    );
    assert.ok(blockedEnd.p1.z < 22.0 && blockedEnd.p2.z < 22.0);

    // Side-by-side (dx = 3.2m) with one player entering the 2.2m opening hits the gate wall and cracks glass
    const sideSkewed: GlassSimState = {
      ...base,
      p1: { ...base.p1, x: -0.6, z: 20.5 },
      p2: { ...base.p2, x: 2.6, z: 20.5 },
    };
    const { state: sideEnd, events: sideEvents } = stepMany(
      sideSkewed,
      45,
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
    );
    assert.ok(sideEnd.glass.hp < GLASS_MAX_HP);
    assert.ok(sideEvents.some((e) => e.kind === 'glass_crack'));

    // Single-file (dx = 0, dz = 3.2m) walks cleanly through center opening
    const singleFile: GlassSimState = {
      ...base,
      p1: { ...base.p1, x: 0, z: 18.0 },
      p2: { ...base.p2, x: 0, z: 21.2 },
    };
    const { state: singleEnd, events: singleEvents } = stepMany(
      singleFile,
      80,
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
    );
    assert.ok(singleEnd.p1.z > 24.0 && singleEnd.p2.z > 24.0);
    assert.equal(singleEnd.glass.hp, GLASS_MAX_HP);
    assert.equal(singleEvents.length, 0);
  });

  it('7. enforces 0.7s invulnerability window after crack to prevent multi-hit drain', () => {
    const invulnCourse = makeSimpleCourse({
      barriers: [
        {
          id: 'wide-low-gap',
          kind: 'lowGap',
          box: { minX: -5, maxX: 5, minY: 0.95, maxY: 2.6, minZ: 5.0, maxZ: 12.0 },
          damage: 1,
          blocksPlayers: false,
        },
      ],
    });

    const start: GlassSimState = {
      ...createInitialSimState(invulnCourse),
      p1: { ...createInitialSimState(invulnCourse).p1, z: 4.8 },
      p2: { ...createInitialSimState(invulnCourse).p2, z: 4.8 },
    };

    // Step forward into barrier to trigger first crack
    let state = start;
    let firstCrackTick = -1;
    for (let i = 0; i < 30; i += 1) {
      state = stepGlassSim(
        state,
        { moveX: 0, moveZ: 1, jump: false, lift: 0 },
        { moveX: 0, moveZ: 1, jump: false, lift: 0 },
        FIXED_DT,
        invulnCourse,
      );
      if (state.events.some((e) => e.kind === 'glass_crack')) {
        firstCrackTick = i;
        break;
      }
    }
    assert.ok(firstCrackTick >= 0);
    assert.equal(state.glass.hp, 2);
    assert.equal(state.glass.invulnTimer, INVULN_AFTER_CRACK_SEC);

    // Continue pushing forward inside the 7m-deep barrier for 0.5s (30 ticks < 0.7s) -> no extra damage
    const { state: duringInvuln, events: invulnEvents } = stepMany(
      state,
      30,
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      FIXED_DT,
      invulnCourse,
    );
    assert.equal(duringInvuln.glass.hp, 2);
    assert.ok(duringInvuln.glass.invulnTimer > 0);
    assert.equal(invulnEvents.length, 0);

    // Finish remaining ~0.25s (15 ticks) while still overlapping barrier -> second crack lands
    const { state: afterInvuln, events: afterEvents } = stepMany(
      duringInvuln,
      15,
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      FIXED_DT,
      invulnCourse,
    );
    assert.equal(afterInvuln.glass.hp, 1);
    assert.equal(afterEvents.filter((e) => e.kind === 'glass_crack').length, 1);
  });

  it('8. restores hp = 3 at Checkpoint 1 and respawns at Checkpoint 1 (not 0) after falling below -5', () => {
    const base = createInitialSimState();
    const approachingCp1: GlassSimState = {
      ...base,
      p1: { ...base.p1, x: -1.6, z: 27.6 },
      p2: { ...base.p2, x: 1.6, z: 27.6 },
      glass: { ...base.glass, hp: 1, stress: 0.4 },
    };

    const { state: cpState, events: cpEvents } = stepMany(
      approachingCp1,
      15,
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
    );

    const cpEv = cpEvents.find((e) => e.kind === 'checkpoint');
    assert.ok(cpEv, 'Expected checkpoint event when crossing z >= 28');
    assert.equal(cpEv.checkpointIndex, 1);
    assert.equal(cpState.checkpointIndex, 1);
    assert.equal(cpState.glass.hp, GLASS_MAX_HP);
    assert.equal(cpState.glass.stress, 0);

    // Place P2 off the right edge of the ice runway while keeping P1 safely on it until falling below FALL_Y_LIMIT (-5)
    let fallState: GlassSimState = {
      ...cpState,
      p1: { ...cpState.p1, x: 2.3, z: 32.0 },
      p2: { ...cpState.p2, x: 5.5, z: 32.0 },
    };
    let fellEvent: GlassSimState['events'][number] | undefined;
    for (let i = 0; i < 120; i += 1) {
      fallState = stepGlassSim(fallState, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT);
      const ev = fallState.events.find((e) => e.kind === 'glass_shatter');
      if (ev) {
        fellEvent = ev;
        break;
      }
    }
    assert.ok(fellEvent);
    assert.equal(fellEvent.reason, 'fall');
    assert.ok(fallState.p2.y < FALL_Y_LIMIT || fallState.p1.y < FALL_Y_LIMIT);

    // Step through 1.2s respawn lock -> spawns at Checkpoint 1 (z = 28.5), not Checkpoint 0 (z = 1.5)
    const { state: respawned, events: respawnEvents } = stepMany(
      fallState,
      72,
      NEUTRAL_INPUT,
      NEUTRAL_INPUT,
    );
    const respawnEv = respawnEvents.find((e) => e.kind === 'respawn');
    assert.ok(respawnEv);
    assert.equal(respawnEv.checkpointIndex, 1);
    assert.equal(respawned.p1.x, GLASS_COURSE.checkpoints[1].p1Spawn.x);
    assert.equal(respawned.p1.z, GLASS_COURSE.checkpoints[1].p1Spawn.z);
    assert.equal(respawned.p2.x, GLASS_COURSE.checkpoints[1].p2Spawn.x);
    assert.equal(respawned.p2.z, GLASS_COURSE.checkpoints[1].p2Spawn.z);
  });

  it('9. transitions to phase = finished and emits course_clear when crossing finishZ = 140 with hp > 0', () => {
    const base = createInitialSimState();
    const nearFinish: GlassSimState = {
      ...base,
      checkpointIndex: 4,
      p1: { ...base.p1, x: -1.6, z: 138.8 },
      p2: { ...base.p2, x: 1.6, z: 138.8 },
    };

    const { state: finished, events } = stepMany(
      nearFinish,
      30,
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
    );

    assert.equal(finished.phase, 'finished');
    assert.ok(finished.p1.z >= COURSE_FINISH_Z && finished.p2.z >= COURSE_FINISH_Z);
    assert.equal(events.filter((e) => e.kind === 'course_clear').length, 1);

    // Further steps while finished produce a clone with empty events and frozen state
    const afterFinish = stepGlassSim(
      finished,
      { moveX: 0, moveZ: 1, jump: true, lift: 1 },
      { moveX: 0, moveZ: 1, jump: true, lift: 1 },
      FIXED_DT,
    );
    assert.notEqual(afterFinish, finished);
    assert.equal(afterFinish.phase, 'finished');
    assert.equal(afterFinish.tick, finished.tick);
    assert.equal(afterFinish.matchTime, finished.matchTime);
    assert.equal(afterFinish.events.length, 0);
  });
});

describe('additional physics mechanics: wind, moving platforms, pendulum/spinner, tilt, extreme break', () => {
  it('applies WindZone force only while blowing and carries players on moving platforms', () => {
    // Stage 2 wind zone 1 blows during cycle [1.5, 3.7)
    const base = createInitialSimState();
    const inWindState: GlassSimState = {
      ...base,
      matchTime: 2.0,
      p1: { ...base.p1, x: -1.6, z: 36.0 },
      p2: { ...base.p2, x: 1.6, z: 36.0 },
    };
    const blown = stepGlassSim(inWindState, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT);
    assert.equal(blown.p1.inWind, true);
    assert.ok(blown.p1.vx > 0);

    // Idle phase (t = 4.5): no wind force
    const idleWindState: GlassSimState = { ...inWindState, matchTime: 4.5 };
    const calm = stepGlassSim(idleWindState, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT);
    assert.equal(calm.p1.inWind, false);
    assert.equal(calm.p1.vx, 0);

    // Moving platform s4-mover-1 at t = 0 moves along +X (vx = 1.7 * 1.1 = 1.87 m/s)
    const onMover: GlassSimState = {
      ...base,
      matchTime: 0,
      p1: { ...base.p1, x: -1.6, z: 92.6 },
      p2: { ...base.p2, x: 1.6, z: 92.6 },
    };
    const carried = stepGlassSim(onMover, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT);
    assert.ok(carried.p1.x > onMover.p1.x + 0.02);
    assert.ok(carried.p2.x > onMover.p2.x + 0.02);
  });

  it('applies damage = 2 from pendulums and rotated spinners, and shatters on extreme tilt or break dist', () => {
    const base = createInitialSimState();

    // Spinner at z = 79.0, centerY = 0.65, angle = 0 -> extends along X [-3.2, 3.2]
    const atSpinner: GlassSimState = {
      ...base,
      checkpointIndex: 2,
      matchTime: 0,
      p1: { ...base.p1, x: -1.6, z: 78.6 },
      p2: { ...base.p2, x: 1.6, z: 78.6 },
    };
    const { state: spinnerHit } = stepMany(
      atSpinner,
      20,
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
      { moveX: 0, moveZ: 1, jump: false, lift: 0 },
    );
    assert.equal(spinnerHit.glass.hp, 1, 'Spinner should deal 2 damage (3 -> 1)');

    // Pendulum s3-pendulum-1 at t = 0 hangs straight down at (0, 1.30, 63.0), bobRadius = 0.62
    const atPendulum: GlassSimState = {
      ...base,
      checkpointIndex: 2,
      matchTime: 0,
      p1: { ...base.p1, x: -1.6, z: 62.95 },
      p2: { ...base.p2, x: 1.6, z: 62.95 },
    };
    const pendulumHit = stepGlassSim(atPendulum, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT);
    assert.equal(pendulumHit.glass.hp, 1, 'Pendulum should deal 2 damage (3 -> 1)');

    // Jump buffer pressed slightly before landing triggers jump on touchdown
    const fallingNearGround: GlassSimState = {
      ...base,
      p1: { ...base.p1, y: 0.05, vy: -3.0, grounded: false, coyoteTimer: 0 },
    };
    const buffered = stepGlassSim(
      fallingNearGround,
      { moveX: 0, moveZ: 0, jump: true, lift: 0 },
      NEUTRAL_INPUT,
      FIXED_DT,
    );
    assert.equal(buffered.p1.grounded, true);
    const autoJumped = stepGlassSim(buffered, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT);
    assert.equal(autoJumped.p1.grounded, false);
    assert.ok(autoJumped.p1.vy > 0, 'Buffered jump should fire immediately upon landing');

    // Extreme break distance > GLASS_BREAK_DIST immediately shatters
    const overStretched: GlassSimState = {
      ...base,
      p1: { ...base.p1, x: -(GLASS_BREAK_DIST * 0.5 + 0.1), z: 1.5 },
      p2: { ...base.p2, x: GLASS_BREAK_DIST * 0.5 + 0.1, z: 1.5 },
    };
    const snapped = stepGlassSim(overStretched, NEUTRAL_INPUT, NEUTRAL_INPUT, FIXED_DT);
    assert.equal(snapped.shatters, 1);
    assert.equal(snapped.glass.shatterReason, 'stretch');

    // Extreme tilt (|dy| > MAX_HAND_DY with safe horizontal distance) shatters with reason 'tilt'
    const tiltCourse = makeSimpleCourse({
      platforms: [
        { id: 'low', surface: 'wood', box: { minX: -5, maxX: 0, minY: -1, maxY: 0, minZ: -2, maxZ: 20 } },
        { id: 'high', surface: 'wood', box: { minX: 0, maxX: 5, minY: 0, maxY: 1.5, minZ: -2, maxZ: 20 } },
      ],
    });
    let tiltState: GlassSimState = {
      ...createInitialSimState(tiltCourse),
      p1: { ...createInitialSimState(tiltCourse).p1, x: -1.6, y: 0, z: 1.5 },
      p2: { ...createInitialSimState(tiltCourse).p2, x: 1.6, y: 1.5, z: 1.5 },
    };
    const { events: tiltEvents } = stepMany(
      tiltState,
      60,
      { moveX: 0, moveZ: 0, jump: false, lift: -1 },
      { moveX: 0, moveZ: 0, jump: false, lift: 1 },
      FIXED_DT,
      tiltCourse,
    );
    const tiltShatter = tiltEvents.find((e) => e.kind === 'glass_shatter');
    assert.ok(tiltShatter);
    assert.equal(tiltShatter.reason, 'tilt');
  });
});
