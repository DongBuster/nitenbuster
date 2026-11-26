import {
  RAFT_BOOST_DURATION,
  RAFT_COURSE,
  RAFT_INVULN_SEC,
  RAFT_JUMP_SYNC_WINDOW_SEC,
  RAFT_MAX_HP,
  RAFT_RADIUS,
  RAFT_RESPAWN_SEC,
  RAFT_STROKE_COOLDOWN,
  RAFT_SYNC_WINDOW_SEC,
  evaluateRaftObstacles,
} from './course.ts';
import type {
  PlayerInput,
  RaftCourseDef,
  RaftSimEvent,
  RaftSimEventKind,
  RaftSimState,
  RaftSnapshotPayload,
  RaftState,
} from './types.ts';

const TIMER_EPS = 1e-9;
const GRAVITY = 22;
const JUMP_VELOCITY = 8.4;
const JUMP_GROUND_EPS = 0.02;
const BASE_CURRENT_Z = 2.6;
const BOOST_CURRENT_Z = 3.5;
const FORWARD_THRUST = 2.4;
const BACK_THRUST = 1.4;
const SYNC_BOOST_KICK = 2.2;
const FORWARD_TURN_ANG_VEL = 1.45;
const FORWARD_TURN_YAW = 0.14;
const BACK_TURN_ANG_VEL = 1.25;
const LEAN_ACCEL_X = 6.5;
const WATER_LATERAL_DRAG = 2.4;
const WATER_CURRENT_BLEND = 2.2;
const ANGULAR_DRAG = 3.5;
const MAX_YAW_RAD = Math.PI * 0.45;
const BANK_BOUNCE_DAMP = 0.45;
const ROCK_HIT_HEIGHT_LIMIT = 1.1;
const LOG_HIT_HEIGHT_LIMIT = 0.78;
const WHIRLPOOL_HEIGHT_LIMIT = 0.6;
const RESPAWN_INVULN_SEC = 1.0;

type EventEmitter = (
  kind: RaftSimEventKind,
  x: number,
  y: number,
  z: number,
  checkpointIndex?: number,
) => void;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function decrementTimer(timer: number, dt: number): number {
  const next = timer - dt;
  return next <= TIMER_EPS ? 0 : next;
}

function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function createSpawnedRaft(x: number, z: number, invulnTimer = 0): RaftState {
  return {
    x,
    y: 0,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    angularVel: 0,
    hp: RAFT_MAX_HP,
    maxHp: RAFT_MAX_HP,
    invulnTimer,
    respawnTimer: 0,
    boostTimer: 0,
    p1StrokeCd: 0,
    p2StrokeCd: 0,
    p1StrokeAnim: 0,
    p2StrokeAnim: 0,
    lastP1StrokeAt: -10,
    lastP2StrokeAt: -10,
    lastP1JumpAt: -10,
    lastP2JumpAt: -10,
    p1LeanX: 0,
    p2LeanX: 0,
    inWhirlpool: false,
  };
}

function getCurrentZAt(course: RaftCourseDef, z: number): number {
  for (const zone of course.currentZones) {
    if (z >= zone.minZ && z <= zone.maxZ) {
      return zone.currentZ;
    }
  }
  return BASE_CURRENT_Z;
}

function applyPaddleStroke(
  input: PlayerInput,
  cooldown: number,
  anim: number,
  lastStrokeAt: number,
  sideSign: -1 | 1,
  kind: 'paddle_p1' | 'paddle_p2',
  matchTime: number,
  raft: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vz: number;
    yaw: number;
    angularVel: number;
  },
  emit: EventEmitter,
): {
  cooldown: number;
  anim: number;
  lastStrokeAt: number;
  strokedForward: boolean;
} {
  const fwd = input.lift > 0 || input.moveZ > 0.35;
  const back = !fwd && (input.lift < 0 || input.moveZ < -0.35);

  if (cooldown > 0 || (!fwd && !back)) {
    return { cooldown, anim, lastStrokeAt, strokedForward: false };
  }

  const dirX = Math.sin(raft.yaw);
  const dirZ = Math.cos(raft.yaw);

  emit(kind, raft.x, raft.y, raft.z);

  if (fwd) {
    raft.vx += dirX * FORWARD_THRUST;
    raft.vz += dirZ * FORWARD_THRUST;
    raft.angularVel += sideSign * FORWARD_TURN_ANG_VEL;
    raft.yaw = clamp(raft.yaw + sideSign * FORWARD_TURN_YAW, -MAX_YAW_RAD, MAX_YAW_RAD);
    return {
      cooldown: RAFT_STROKE_COOLDOWN,
      anim: 1,
      lastStrokeAt: matchTime,
      strokedForward: true,
    };
  }

  raft.vx -= dirX * BACK_THRUST;
  raft.vz -= dirZ * BACK_THRUST;
  raft.angularVel -= sideSign * BACK_TURN_ANG_VEL;
  return {
    cooldown: RAFT_STROKE_COOLDOWN,
    anim: 1,
    lastStrokeAt,
    strokedForward: false,
  };
}

function stepRespawnLock(
  state: RaftSimState,
  course: RaftCourseDef,
  dt: number,
  nextTick: number,
  nextMatchTime: number,
): RaftSimState {
  const nextRespawnTimer = decrementTimer(state.raft.respawnTimer, dt);
  if (nextRespawnTimer > 0) {
    return {
      ...state,
      tick: nextTick,
      matchTime: nextMatchTime,
      raft: { ...state.raft, respawnTimer: nextRespawnTimer },
      events: [],
    };
  }

  const cp = course.checkpoints[state.checkpointIndex] ?? course.checkpoints[0];
  const respawned = createSpawnedRaft(cp.spawnX, cp.spawnZ, RESPAWN_INVULN_SEC);
  const event: RaftSimEvent = {
    id: state.nextEventId,
    kind: 'respawn',
    x: respawned.x,
    y: respawned.y,
    z: respawned.z,
    checkpointIndex: state.checkpointIndex,
  };

  return {
    ...state,
    tick: nextTick,
    matchTime: nextMatchTime,
    raft: respawned,
    nextEventId: state.nextEventId + 1,
    events: [event],
  };
}

/** Creates the deterministic initial simulation state at checkpoint 0 of `course`. */
export function createInitialRaftSimState(
  course: RaftCourseDef = RAFT_COURSE,
): RaftSimState {
  const cp0 = course.checkpoints[0];
  return {
    phase: 'playing',
    tick: 0,
    matchTime: 0,
    checkpointIndex: 0,
    failures: 0,
    raft: createSpawnedRaft(cp0.spawnX, cp0.spawnZ),
    nextEventId: 1,
    events: [],
  };
}

/**
 * Advances the deterministic Raft Rapids Co-op simulation by `dt` seconds without
 * mutating `state`. Returns fresh state containing only events emitted during this step.
 */
export function stepRaftSim(
  state: RaftSimState,
  p1Input: PlayerInput,
  p2Input: PlayerInput,
  dt: number,
  course: RaftCourseDef = RAFT_COURSE,
): RaftSimState {
  if (state.phase === 'finished' || dt <= 0) {
    return {
      ...state,
      raft: { ...state.raft },
      events: [],
    };
  }

  const nextTick = state.tick + 1;
  const nextMatchTime = state.matchTime + dt;

  if (state.raft.respawnTimer > 0) {
    return stepRespawnLock(state, course, dt, nextTick, nextMatchTime);
  }

  const events: RaftSimEvent[] = [];
  let nextEventId = state.nextEventId;
  const emit: EventEmitter = (kind, x, y, z, checkpointIndex) => {
    const evt: RaftSimEvent = { id: nextEventId++, kind, x, y, z };
    if (checkpointIndex !== undefined) {
      evt.checkpointIndex = checkpointIndex;
    }
    events.push(evt);
  };

  const raft: RaftState = {
    ...state.raft,
    invulnTimer: decrementTimer(state.raft.invulnTimer, dt),
    boostTimer: decrementTimer(state.raft.boostTimer, dt),
    p1StrokeCd: decrementTimer(state.raft.p1StrokeCd, dt),
    p2StrokeCd: decrementTimer(state.raft.p2StrokeCd, dt),
    p1StrokeAnim: decrementTimer(state.raft.p1StrokeAnim, dt * 3),
    p2StrokeAnim: decrementTimer(state.raft.p2StrokeAnim, dt * 3),
    inWhirlpool: false,
  };

  const p1Stroke = applyPaddleStroke(
    p1Input,
    raft.p1StrokeCd,
    raft.p1StrokeAnim,
    raft.lastP1StrokeAt,
    -1,
    'paddle_p1',
    nextMatchTime,
    raft,
    emit,
  );
  raft.p1StrokeCd = p1Stroke.cooldown;
  raft.p1StrokeAnim = p1Stroke.anim;
  raft.lastP1StrokeAt = p1Stroke.lastStrokeAt;

  const p2Stroke = applyPaddleStroke(
    p2Input,
    raft.p2StrokeCd,
    raft.p2StrokeAnim,
    raft.lastP2StrokeAt,
    1,
    'paddle_p2',
    nextMatchTime,
    raft,
    emit,
  );
  raft.p2StrokeCd = p2Stroke.cooldown;
  raft.p2StrokeAnim = p2Stroke.anim;
  raft.lastP2StrokeAt = p2Stroke.lastStrokeAt;

  // Synchronized forward boost (reset both timestamps on pair to prevent double-trigger)
  const p1Synced =
    p1Stroke.strokedForward &&
    raft.lastP2StrokeAt >= 0 &&
    nextMatchTime - raft.lastP2StrokeAt <= RAFT_SYNC_WINDOW_SEC;
  const p2Synced =
    p2Stroke.strokedForward &&
    raft.lastP1StrokeAt >= 0 &&
    nextMatchTime - raft.lastP1StrokeAt <= RAFT_SYNC_WINDOW_SEC;

  if (p1Synced || p2Synced) {
    raft.angularVel *= 0.25;
    raft.boostTimer = RAFT_BOOST_DURATION;
    raft.vx += Math.sin(raft.yaw) * SYNC_BOOST_KICK;
    raft.vz += Math.cos(raft.yaw) * SYNC_BOOST_KICK;
    raft.lastP1StrokeAt = -10;
    raft.lastP2StrokeAt = -10;
    emit('raft_boost', raft.x, raft.y, raft.z);
  }

  // Lean steering
  raft.p1LeanX = clamp(p1Input.moveX, -1, 1);
  raft.p2LeanX = clamp(p2Input.moveX, -1, 1);
  const avgLeanX = (raft.p1LeanX + raft.p2LeanX) * 0.5;
  raft.vx += avgLeanX * LEAN_ACCEL_X * dt;

  // Synchronized jump
  if (raft.y <= JUMP_GROUND_EPS) {
    if (p1Input.jump) {
      raft.lastP1JumpAt = nextMatchTime;
    }
    if (p2Input.jump) {
      raft.lastP2JumpAt = nextMatchTime;
    }
    if (
      raft.lastP1JumpAt >= 0 &&
      raft.lastP2JumpAt >= 0 &&
      Math.abs(raft.lastP1JumpAt - raft.lastP2JumpAt) <= RAFT_JUMP_SYNC_WINDOW_SEC
    ) {
      raft.vy = JUMP_VELOCITY;
      raft.lastP1JumpAt = -10;
      raft.lastP2JumpAt = -10;
      emit('raft_jump', raft.x, raft.y, raft.z);
    }
  }

  // Vertical integration + gravity
  if (raft.y > 0 || raft.vy > 0) {
    raft.vy -= GRAVITY * dt;
    raft.y += raft.vy * dt;
    if (raft.y <= 0) {
      raft.y = 0;
      raft.vy = 0;
    }
  }

  // Water drag & river current (applied when on/near water)
  raft.yaw = clamp(raft.yaw + raft.angularVel * dt, -MAX_YAW_RAD, MAX_YAW_RAD);
  raft.angularVel *= Math.max(0, 1 - ANGULAR_DRAG * dt);

  const obs = evaluateRaftObstacles(course, nextMatchTime);

  if (raft.y <= 0.05) {
    const baseCurrentZ = getCurrentZAt(course, raft.z);
    const targetCurrentZ =
      baseCurrentZ + (raft.boostTimer > 0 ? BOOST_CURRENT_Z : 0);
    raft.vx *= Math.max(0, 1 - WATER_LATERAL_DRAG * dt);
    raft.vz += (targetCurrentZ - raft.vz) * Math.min(1, WATER_CURRENT_BLEND * dt);
  }

  // Whirlpool pull & spin
  for (const wp of obs.whirlpools) {
    const dx = wp.x - raft.x;
    const dz = wp.z - raft.z;
    const dist = Math.hypot(dx, dz);
    if (dist < wp.radius && raft.y < WHIRLPOOL_HEIGHT_LIMIT) {
      raft.inWhirlpool = true;
      const nx = dist > 1e-4 ? dx / dist : 0;
      const nz = dist > 1e-4 ? dz / dist : 0;
      const falloff = 1 - (dist / wp.radius) * 0.4;
      raft.vx += nx * wp.pullStrength * falloff * dt;
      raft.vz += nz * wp.pullStrength * falloff * dt;
      raft.vx += -nz * wp.spinDir * wp.pullStrength * 0.65 * dt;
      raft.vz += nx * wp.spinDir * wp.pullStrength * 0.65 * dt;
      raft.angularVel += wp.spinDir * 3.8 * dt;
    }
  }

  // Integrate horizontal position & river bank bounds
  raft.x += raft.vx * dt;
  raft.z = Math.max(0, raft.z + raft.vz * dt);

  const maxBankX = course.riverHalfWidth - RAFT_RADIUS;
  if (raft.x > maxBankX) {
    raft.x = maxBankX;
    if (raft.vx > 0) raft.vx = -raft.vx * BANK_BOUNCE_DAMP;
  } else if (raft.x < -maxBankX) {
    raft.x = -maxBankX;
    if (raft.vx < 0) raft.vx = -raft.vx * BANK_BOUNCE_DAMP;
  }

  // Obstacle collisions (skipped during invulnerability)
  let failures = state.failures;
  if (raft.invulnTimer <= 0) {
    let hitDetected = false;

    for (const rock of course.rocks) {
      const dx = raft.x - rock.x;
      const dz = raft.z - rock.z;
      const dist = Math.hypot(dx, dz);
      const minDist = RAFT_RADIUS + rock.radius;
      if (dist < minDist && raft.y < ROCK_HIT_HEIGHT_LIMIT) {
        const nx = dist > 1e-4 ? dx / dist : 0;
        const nz = dist > 1e-4 ? dz / dist : -1;
        raft.x = clamp(rock.x + nx * minDist, -maxBankX, maxBankX);
        raft.z = Math.max(0, rock.z + nz * minDist);
        raft.vx = nx * 2.8;
        raft.vz = nz * 2.8;
        hitDetected = true;
        break;
      }
    }

    if (!hitDetected) {
      for (const log of obs.logs) {
        const dz = raft.z - log.z;
        const dx = raft.x - log.x;
        if (
          Math.abs(dz) < RAFT_RADIUS + log.radius &&
          Math.abs(dx) < log.halfLength + RAFT_RADIUS * 0.6 &&
          raft.y < LOG_HIT_HEIGHT_LIMIT
        ) {
          const pushSign = dz <= 0 ? -1 : 1;
          raft.z = Math.max(0, log.z + pushSign * (RAFT_RADIUS + log.radius));
          raft.vz = pushSign * 2.6;
          hitDetected = true;
          break;
        }
      }
    }

    if (hitDetected) {
      raft.hp = Math.max(0, raft.hp - 1);
      raft.invulnTimer = RAFT_INVULN_SEC;
      if (raft.hp <= 0) {
        failures += 1;
        raft.respawnTimer = RAFT_RESPAWN_SEC;
        emit('raft_capsize', raft.x, raft.y, raft.z);
      } else {
        emit('raft_hit', raft.x, raft.y, raft.z);
      }
    }
  }

  // Checkpoints & finish
  let phase: RaftSimState['phase'] = state.phase;
  let checkpointIndex = state.checkpointIndex;

  if (raft.hp > 0 && raft.respawnTimer <= 0) {
    const nextCp = course.checkpoints[checkpointIndex + 1];
    if (nextCp && raft.z >= nextCp.triggerZ) {
      checkpointIndex = nextCp.index;
      raft.hp = RAFT_MAX_HP;
      emit('checkpoint', raft.x, raft.y, raft.z, nextCp.index);
    }

    if (raft.z >= course.finishZ) {
      phase = 'finished';
      emit('course_clear', raft.x, raft.y, raft.z);
    }
  }

  return {
    phase,
    tick: nextTick,
    matchTime: nextMatchTime,
    checkpointIndex,
    failures,
    raft,
    nextEventId,
    events,
  };
}

/**
 * Compresses a `RaftSimState` into a compact network snapshot by rounding
 * floating-point fields to 2 decimals and normalizing `-0` to `0`.
 */
export function packRaftSnapshot(
  matchId: string,
  state: RaftSimState,
): RaftSnapshotPayload {
  return {
    mapId: 'raft_rapids',
    matchId,
    tick: state.tick,
    matchTime: round2(state.matchTime),
    phase: state.phase,
    checkpointIndex: state.checkpointIndex,
    failures: state.failures,
    raft: {
      x: round2(state.raft.x),
      y: round2(state.raft.y),
      z: round2(state.raft.z),
      vx: round2(state.raft.vx),
      vy: round2(state.raft.vy),
      vz: round2(state.raft.vz),
      yaw: round2(state.raft.yaw),
      hp: state.raft.hp,
      invulnTimer: round2(state.raft.invulnTimer),
      respawnTimer: round2(state.raft.respawnTimer),
      boostTimer: round2(state.raft.boostTimer),
      p1StrokeAnim: round2(state.raft.p1StrokeAnim),
      p2StrokeAnim: round2(state.raft.p2StrokeAnim),
      p1LeanX: round2(state.raft.p1LeanX),
      p2LeanX: round2(state.raft.p2LeanX),
      inWhirlpool: state.raft.inWhirlpool,
    },
    events: state.events.map((evt) => ({ ...evt })),
  };
}
