import {
  ROPE_COURSE,
  ROPE_FALL_LIMIT_Y,
  ROPE_GRAVITY,
  ROPE_JUMP_VEL,
  ROPE_MAX_LEN,
  ROPE_MAX_SPEED,
  ROPE_REEL_MIN_LEN,
  ROPE_REEL_SPEED,
  ROPE_RESPAWN_SEC,
  evaluateRopeCourse,
} from './course.ts';
import type {
  EvaluatedPendulum,
  EvaluatedRopeCourse,
  EvaluatedRopeIsland,
  EvaluatedWindZone,
  PlayerInput,
  PlayerSlot,
  RopeCourseDef,
  RopePlayerState,
  RopeSimEvent,
  RopeSimEventKind,
  RopeSimState,
  RopeSnapshotPayload,
  RopeSnapshotPlayer,
} from './types.ts';

const TIMER_EPS = 1e-9;
const COYOTE_TIME_SEC = 0.1;
const JUMP_BUFFER_SEC = 0.1;
const WOOD_ACCEL = 32;
const WOOD_FRICTION = 26;
const ICE_ACCEL = 11.2;
const ICE_FRICTION = 3.9;
const ANCHOR_FRICTION_MULT = 5;
const ANCHOR_WIND_TRANSMIT = 0.15;
const YAW_TURN_RATE = 14;
const WAIST_HEIGHT = 0.65;
const LANDING_EDGE_MARGIN = 0.3;
const LANDING_SNAP_TOLERANCE = 0.22;
const STANDING_Y_TOLERANCE = 0.15;
const ANCHOR_WEIGHT = 0.06;
const GROUNDED_WEIGHT = 0.55;
const AIR_WEIGHT = 1.0;
const REEL_RELAX_SPEED = 4.0;
const REEL_PULL_EVENT_INTERVAL = 0.45;
const RESCUE_UP_VY = 3.8;
const RESCUE_HORIZ_SPEED = 2.6;
const RESCUE_HORIZ_ACCEL = 12;
const HANGING_DY_THRESHOLD = 1.2;
const HANGING_SLACK_TOLERANCE = 0.45;
const HANGING_STRAIN_RATE = 0.15;
const STRAIN_DECAY_RATE = 0.6;
const PENDULUM_HIT_EXTRA_RADIUS = 0.48;
const PENDULUM_STRAIN_HIT = 0.45;
const PENDULUM_INVULN_SEC = 0.6;
const PENDULUM_KNOCKBACK_SPEED = 6.0;
const PENDULUM_KNOCKBACK_VY = 2.2;

type EventEmitter = (
  kind: RopeSimEventKind,
  x: number,
  y: number,
  z: number,
  checkpointIndex?: number,
) => void;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function moveToward(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

function decrementTimer(value: number, dt: number): number {
  const next = value - dt;
  return next <= TIMER_EPS ? 0 : next;
}

function normalizeAngle(rad: number): number {
  let angle = rad;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle <= -Math.PI) angle += Math.PI * 2;
  return angle;
}

function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function computeWaistDistance(p1: RopePlayerState, p2: RopePlayerState): number {
  const dx = p2.x - p1.x;
  const dy = p2.y + WAIST_HEIGHT - (p1.y + WAIST_HEIGHT);
  const dz = p2.z - p1.z;
  return Math.hypot(dx, dy, dz);
}

function isWithinIslandFootprint(
  x: number,
  z: number,
  island: EvaluatedRopeIsland,
): boolean {
  return (
    x >= island.box.minX - LANDING_EDGE_MARGIN &&
    x <= island.box.maxX + LANDING_EDGE_MARGIN &&
    z >= island.box.minZ - LANDING_EDGE_MARGIN &&
    z <= island.box.maxZ + LANDING_EDGE_MARGIN
  );
}

function findStandingIsland(
  x: number,
  y: number,
  z: number,
  vy: number,
  islands: readonly EvaluatedRopeIsland[],
): EvaluatedRopeIsland | null {
  if (vy > 0.1) return null;

  let bestExact: EvaluatedRopeIsland | null = null;
  let bestMargin: EvaluatedRopeIsland | null = null;

  for (const isl of islands) {
    if (Math.abs(y - isl.box.maxY) > STANDING_Y_TOLERANCE) continue;

    const insideExact =
      x >= isl.box.minX &&
      x <= isl.box.maxX &&
      z >= isl.box.minZ &&
      z <= isl.box.maxZ;
    if (insideExact) {
      if (!bestExact || isl.box.maxY > bestExact.box.maxY) bestExact = isl;
      continue;
    }

    if (isWithinIslandFootprint(x, z, isl)) {
      if (!bestMargin || isl.box.maxY > bestMargin.box.maxY) bestMargin = isl;
    }
  }

  return bestExact ?? bestMargin;
}

function resolveLandingIsland(
  prevY: number,
  x: number,
  newY: number,
  z: number,
  vy: number,
  islands: readonly EvaluatedRopeIsland[],
): EvaluatedRopeIsland | null {
  if (vy > 0) return null;

  let best: EvaluatedRopeIsland | null = null;
  for (const isl of islands) {
    if (prevY < isl.box.maxY - LANDING_SNAP_TOLERANCE) continue;
    if (newY > isl.box.maxY) continue;
    if (!isWithinIslandFootprint(x, z, isl)) continue;
    if (!best || isl.box.maxY > best.box.maxY) best = isl;
  }
  return best;
}

function computeActiveWindForceX(
  x: number,
  y: number,
  z: number,
  windZones: readonly EvaluatedWindZone[],
): { inWind: boolean; forceX: number } {
  const centerY = y + WAIST_HEIGHT;
  let inWind = false;
  let forceX = 0;

  for (const wind of windZones) {
    if (wind.state !== 'blowing') continue;
    if (
      x >= wind.box.minX &&
      x <= wind.box.maxX &&
      centerY >= wind.box.minY &&
      centerY <= wind.box.maxY &&
      z >= wind.box.minZ &&
      z <= wind.box.maxZ
    ) {
      inWind = true;
      forceX += wind.forceX;
    }
  }

  return { inWind, forceX };
}

function createSpawnedPlayer(
  slot: PlayerSlot,
  spawn: { x: number; y: number; z: number },
  islands: readonly EvaluatedRopeIsland[],
): RopePlayerState {
  const standing = findStandingIsland(spawn.x, spawn.y, spawn.z, 0, islands);
  return {
    slot,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    grounded: true,
    coyoteTimer: COYOTE_TIME_SEC,
    jumpBufferTimer: 0,
    pendulumInvulnTimer: 0,
    anchored: false,
    reeling: false,
    hanging: false,
    onIce: standing?.surface === 'ice',
    inWind: false,
  };
}

function stepPlayer(
  player: RopePlayerState,
  input: PlayerInput,
  dt: number,
  obs: EvaluatedRopeCourse,
  emit: EventEmitter,
): { player: RopePlayerState; landedIsland: EvaluatedRopeIsland | null } {
  const standing = player.grounded
    ? findStandingIsland(player.x, player.y, player.z, player.vy, obs.islands)
    : null;
  const onIce = standing?.surface === 'ice';
  const anchoredStart = player.grounded && input.lift < 0;
  const reelingStart = player.grounded && input.lift > 0;

  if (anchoredStart && !player.anchored) {
    emit('rope_anchor', player.x, player.y, player.z);
  }

  let x = player.x + (standing ? standing.vx * dt : 0);
  let y = player.y + (standing ? standing.vy * dt : 0);
  let z = player.z + (standing ? standing.vz * dt : 0);
  let vx = player.vx;
  let vy = player.vy;
  let vz = player.vz;
  let yaw = player.yaw;

  const accel = onIce ? ICE_ACCEL : WOOD_ACCEL;
  const baseFriction = onIce ? ICE_FRICTION : WOOD_FRICTION;
  const friction = anchoredStart ? baseFriction * ANCHOR_FRICTION_MULT : baseFriction;

  if (anchoredStart) {
    const damp = Math.exp(-friction * dt);
    vx *= damp;
    vz *= damp;
  } else {
    const rawMag = Math.hypot(input.moveX, input.moveZ);
    const moveX = rawMag > 1 ? input.moveX / rawMag : input.moveX;
    const moveZ = rawMag > 1 ? input.moveZ / rawMag : input.moveZ;
    const inputMag = Math.min(1, rawMag);

    if (inputMag > 1e-4) {
      const ux = moveX / inputMag;
      const uz = moveZ / inputMag;
      const vParallel = vx * ux + vz * uz;
      const vPerp = -vx * uz + vz * ux;

      const nextParallel = moveToward(vParallel, inputMag * ROPE_MAX_SPEED, accel * dt);
      const nextPerp = vPerp * Math.exp(-friction * dt);

      vx = nextParallel * ux - nextPerp * uz;
      vz = nextParallel * uz + nextPerp * ux;

      const targetYaw = Math.atan2(moveX, moveZ) || 0;
      const yawDiff = normalizeAngle(targetYaw - yaw);
      yaw = normalizeAngle(yaw + yawDiff * (1 - Math.exp(-YAW_TURN_RATE * dt))) || 0;
    } else {
      const damp = Math.exp(-friction * dt);
      vx *= damp;
      vz *= damp;
    }
  }

  const wind = computeActiveWindForceX(x, y, z, obs.windZones);
  if (wind.inWind) {
    vx += wind.forceX * (anchoredStart ? ANCHOR_WIND_TRANSMIT : 1) * dt;
  }

  let coyoteTimer = player.grounded
    ? COYOTE_TIME_SEC
    : decrementTimer(player.coyoteTimer, dt);
  let jumpBufferTimer =
    input.jump && !anchoredStart
      ? JUMP_BUFFER_SEC
      : decrementTimer(player.jumpBufferTimer, dt);
  let grounded = player.grounded;

  if (!anchoredStart && jumpBufferTimer > 0 && coyoteTimer > 0) {
    vy = ROPE_JUMP_VEL;
    grounded = false;
    coyoteTimer = 0;
    jumpBufferTimer = 0;
  }

  const prevY = y;
  vy += ROPE_GRAVITY * dt;
  x += vx * dt;
  z += vz * dt;
  y += vy * dt;

  const landedIsland = resolveLandingIsland(prevY, x, y, z, vy, obs.islands);
  if (landedIsland) {
    y = landedIsland.box.maxY;
    vy = 0;
    grounded = true;
  } else {
    grounded = false;
  }

  return {
    player: {
      slot: player.slot,
      x,
      y,
      z,
      vx,
      vy,
      vz,
      yaw,
      grounded,
      coyoteTimer,
      jumpBufferTimer,
      pendulumInvulnTimer: decrementTimer(player.pendulumInvulnTimer, dt),
      anchored: grounded && anchoredStart,
      reeling: grounded && reelingStart,
      hanging: false,
      onIce: landedIsland ? landedIsland.surface === 'ice' : onIce,
      inWind: wind.inWind,
    },
    landedIsland,
  };
}

function getMassWeight(player: RopePlayerState): number {
  if (player.anchored) return ANCHOR_WEIGHT;
  if (player.grounded) return GROUNDED_WEIGHT;
  return AIR_WEIGHT;
}

function clampToIslandFloor(
  player: RopePlayerState,
  island: EvaluatedRopeIsland | null,
): void {
  if (!island) return;
  if (!player.anchored && !isWithinIslandFootprint(player.x, player.z, island)) {
    return;
  }
  if (player.y < island.box.maxY) {
    player.y = island.box.maxY;
    if (player.vy < 0) player.vy = 0;
  }
}

function applyRescueAssist(
  reeler: RopePlayerState,
  other: RopePlayerState,
  dt: number,
): void {
  if (!reeler.reeling || other.grounded || other.y >= reeler.y + 0.25) {
    return;
  }
  other.vy = Math.max(other.vy, RESCUE_UP_VY);
  const hdx = reeler.x - other.x;
  const hdz = reeler.z - other.z;
  const hDist = Math.hypot(hdx, hdz);
  if (hDist > 0.25) {
    const ux = hdx / hDist;
    const uz = hdz / hDist;
    const step = Math.min(hDist - 0.25, RESCUE_HORIZ_SPEED * dt);
    other.x += ux * step;
    other.z += uz * step;
    other.vx += ux * RESCUE_HORIZ_ACCEL * dt;
    other.vz += uz * RESCUE_HORIZ_ACCEL * dt;
  }
}

function applyRopeConstraint(
  p1: RopePlayerState,
  p2: RopePlayerState,
  p1Island: EvaluatedRopeIsland | null,
  p2Island: EvaluatedRopeIsland | null,
  effectiveMaxLen: number,
  dt: number,
): void {
  const dx = p2.x - p1.x;
  const dy = p2.y + WAIST_HEIGHT - (p1.y + WAIST_HEIGHT);
  const dz = p2.z - p1.z;
  const dist = Math.hypot(dx, dy, dz);

  if (dist > effectiveMaxLen && dist > 1e-6) {
    const excess = dist - effectiveMaxLen;
    const nx = dx / dist;
    const ny = dy / dist;
    const nz = dz / dist;

    const w1 = getMassWeight(p1);
    const w2 = getMassWeight(p2);
    const totalW = w1 + w2;
    const share1 = w1 / totalW;
    const share2 = w2 / totalW;

    p1.x += nx * excess * share1;
    p1.y += ny * excess * share1;
    p1.z += nz * excess * share1;

    p2.x -= nx * excess * share2;
    p2.y -= ny * excess * share2;
    p2.z -= nz * excess * share2;

    const sepVel =
      (p2.vx - p1.vx) * nx + (p2.vy - p1.vy) * ny + (p2.vz - p1.vz) * nz;
    if (sepVel > 0) {
      p1.vx += nx * sepVel * share1;
      p1.vy += ny * sepVel * share1;
      p1.vz += nz * sepVel * share1;

      p2.vx -= nx * sepVel * share2;
      p2.vy -= ny * sepVel * share2;
      p2.vz -= nz * sepVel * share2;
    }

    clampToIslandFloor(p1, p1Island);
    clampToIslandFloor(p2, p2Island);
  }

  if (dist >= effectiveMaxLen - 0.25) {
    applyRescueAssist(p1, p2, dt);
    applyRescueAssist(p2, p1, dt);
  }
}

function applyPendulumHits(
  player: RopePlayerState,
  pendulums: readonly EvaluatedPendulum[],
): number {
  if (player.pendulumInvulnTimer > 0) return 0;

  for (const pend of pendulums) {
    const dx = player.x - pend.bobX;
    const dy = player.y + WAIST_HEIGHT - pend.bobY;
    const dz = player.z - pend.bobZ;
    const dist3 = Math.hypot(dx, dy, dz);
    const hitDist = pend.bobRadius + PENDULUM_HIT_EXTRA_RADIUS;
    if (dist3 < hitDist) {
      const horizLen = Math.hypot(dx, dz);
      const nx = horizLen > 1e-4 ? dx / horizLen : 0;
      const nz = horizLen > 1e-4 ? dz / horizLen : -1;
      const targetHoriz = Math.sqrt(Math.max(0, hitDist * hitDist - dy * dy)) + 0.04;
      const pushOut = Math.max(0, targetHoriz - horizLen);
      if (!player.anchored) {
        player.x += nx * pushOut;
        player.z += nz * pushOut;
        player.vx = nx * PENDULUM_KNOCKBACK_SPEED;
        player.vz = nz * PENDULUM_KNOCKBACK_SPEED;
        player.vy = Math.max(player.vy, PENDULUM_KNOCKBACK_VY);
        player.grounded = false;
      } else {
        player.x += nx * pushOut * 0.25;
        player.z += nz * pushOut * 0.25;
      }
      player.pendulumInvulnTimer = PENDULUM_INVULN_SEC;
      return PENDULUM_STRAIN_HIT;
    }
  }
  return 0;
}

function stepRespawnLock(
  state: RopeSimState,
  course: RopeCourseDef,
  dt: number,
  nextTick: number,
  nextMatchTime: number,
): RopeSimState {
  const nextRespawnTimer = decrementTimer(state.respawnTimer, dt);
  if (nextRespawnTimer > 0) {
    return {
      ...state,
      tick: nextTick,
      matchTime: nextMatchTime,
      p1: { ...state.p1 },
      p2: { ...state.p2 },
      respawnTimer: nextRespawnTimer,
      events: [],
    };
  }

  const cp = course.checkpoints[state.checkpointIndex] ?? course.checkpoints[0];
  const obs = evaluateRopeCourse(course, nextMatchTime);
  const p1 = createSpawnedPlayer('p1', cp.p1Spawn, obs.islands);
  const p2 = createSpawnedPlayer('p2', cp.p2Spawn, obs.islands);
  const ropeLength = computeWaistDistance(p1, p2);
  const respawnEvent: RopeSimEvent = {
    id: state.nextEventId,
    kind: 'respawn',
    x: (p1.x + p2.x) * 0.5,
    y: (p1.y + p2.y) * 0.5,
    z: (p1.z + p2.z) * 0.5,
    checkpointIndex: state.checkpointIndex,
  };

  return {
    ...state,
    tick: nextTick,
    matchTime: nextMatchTime,
    p1,
    p2,
    ropeLength,
    effectiveMaxLen: ROPE_MAX_LEN,
    ropeStrain: 0,
    respawnTimer: 0,
    nextEventId: state.nextEventId + 1,
    events: [respawnEvent],
  };
}

/** Creates the deterministic initial Rope Tether simulation state at checkpoint 0. */
export function createInitialRopeSimState(
  course: RopeCourseDef = ROPE_COURSE,
): RopeSimState {
  const cp0 = course.checkpoints[0];
  const obs = evaluateRopeCourse(course, 0);
  const p1 = createSpawnedPlayer('p1', cp0.p1Spawn, obs.islands);
  const p2 = createSpawnedPlayer('p2', cp0.p2Spawn, obs.islands);

  return {
    phase: 'playing',
    tick: 0,
    matchTime: 0,
    checkpointIndex: 0,
    failures: 0,
    p1,
    p2,
    ropeLength: computeWaistDistance(p1, p2),
    effectiveMaxLen: ROPE_MAX_LEN,
    ropeStrain: 0,
    respawnTimer: 0,
    nextEventId: 1,
    events: [],
  };
}

/**
 * Advances the deterministic Rope Tether Co-op simulation by `dt` seconds without
 * mutating `state`. Returns a fresh state containing only events emitted during this step.
 */
export function stepRopeSim(
  state: RopeSimState,
  p1Input: PlayerInput,
  p2Input: PlayerInput,
  dt: number,
  course: RopeCourseDef = ROPE_COURSE,
): RopeSimState {
  if (state.phase === 'finished' || dt <= 0) {
    return {
      ...state,
      p1: { ...state.p1 },
      p2: { ...state.p2 },
      events: [],
    };
  }

  const nextTick = state.tick + 1;
  const nextMatchTime = state.matchTime + dt;

  if (state.respawnTimer > 0) {
    return stepRespawnLock(state, course, dt, nextTick, nextMatchTime);
  }

  const events: RopeSimEvent[] = [];
  let nextEventId = state.nextEventId;
  const emit: EventEmitter = (kind, x, y, z, checkpointIndex) => {
    const evt: RopeSimEvent = { id: nextEventId++, kind, x, y, z };
    if (checkpointIndex !== undefined) {
      evt.checkpointIndex = checkpointIndex;
    }
    events.push(evt);
  };

  const obs = evaluateRopeCourse(course, nextMatchTime);
  const step1 = stepPlayer(state.p1, p1Input, dt, obs, emit);
  const step2 = stepPlayer(state.p2, p2Input, dt, obs, emit);
  const p1 = step1.player;
  const p2 = step2.player;

  // Reel / relax effective rope length
  const wasReeling = state.p1.reeling || state.p2.reeling;
  const isReeling = p1.reeling || p2.reeling;
  let effectiveMaxLen = state.effectiveMaxLen;

  if (isReeling) {
    effectiveMaxLen = Math.max(ROPE_REEL_MIN_LEN, effectiveMaxLen - ROPE_REEL_SPEED * dt);
    const shouldEmitPull =
      !wasReeling ||
      Math.floor(nextMatchTime / REEL_PULL_EVENT_INTERVAL) >
        Math.floor(state.matchTime / REEL_PULL_EVENT_INTERVAL);
    if (shouldEmitPull) {
      const reeler = p1.reeling ? p1 : p2;
      emit('rope_pull', reeler.x, reeler.y, reeler.z);
    }
  } else {
    effectiveMaxLen = Math.min(ROPE_MAX_LEN, effectiveMaxLen + REEL_RELAX_SPEED * dt);
  }

  // 3D inverse-mass weighted elastic rope constraint + rescue assist
  applyRopeConstraint(p1, p2, step1.landedIsland, step2.landedIsland, effectiveMaxLen, dt);

  // Re-check island landing if rescue assist lifted/pulled a player onto an island
  if (!p1.grounded && p1.vy <= 0.1) {
    const landed1 = resolveLandingIsland(state.p1.y, p1.x, p1.y, p1.z, p1.vy, obs.islands);
    if (landed1) {
      p1.y = landed1.box.maxY;
      p1.vy = 0;
      p1.grounded = true;
      p1.onIce = landed1.surface === 'ice';
    }
  }
  if (!p2.grounded && p2.vy <= 0.1) {
    const landed2 = resolveLandingIsland(state.p2.y, p2.x, p2.y, p2.z, p2.vy, obs.islands);
    if (landed2) {
      p2.y = landed2.box.maxY;
      p2.vy = 0;
      p2.grounded = true;
      p2.onIce = landed2.surface === 'ice';
    }
  }

  // Pendulum collisions
  let ropeStrain = state.ropeStrain;
  ropeStrain += applyPendulumHits(p1, obs.pendulums);
  ropeStrain += applyPendulumHits(p2, obs.pendulums);

  // Hanging detection & strain update
  const ropeLength = computeWaistDistance(p1, p2);
  p1.hanging =
    !p1.grounded &&
    p1.y < p2.y - HANGING_DY_THRESHOLD &&
    ropeLength >= effectiveMaxLen - HANGING_SLACK_TOLERANCE;
  p2.hanging =
    !p2.grounded &&
    p2.y < p1.y - HANGING_DY_THRESHOLD &&
    ropeLength >= effectiveMaxLen - HANGING_SLACK_TOLERANCE;

  if (p1.hanging || p2.hanging) {
    ropeStrain = Math.min(1, ropeStrain + HANGING_STRAIN_RATE * dt);
  } else {
    ropeStrain = Math.max(0, ropeStrain - STRAIN_DECAY_RATE * dt);
  }
  ropeStrain = clamp(ropeStrain, 0, 1);

  // Fail condition
  let failures = state.failures;
  let respawnTimer = 0;
  const bothBelowLimit = p1.y < ROPE_FALL_LIMIT_Y && p2.y < ROPE_FALL_LIMIT_Y;
  const deepFall = p1.y < ROPE_FALL_LIMIT_Y - 3 || p2.y < ROPE_FALL_LIMIT_Y - 3;
  if (bothBelowLimit || ropeStrain >= 1.0 || deepFall) {
    failures += 1;
    respawnTimer = ROPE_RESPAWN_SEC;
    emit(
      'rope_snap',
      (p1.x + p2.x) * 0.5,
      (p1.y + p2.y) * 0.5,
      (p1.z + p2.z) * 0.5,
    );
  }

  // Checkpoints & finish
  let phase: RopeSimState['phase'] = state.phase;
  let checkpointIndex = state.checkpointIndex;

  if (respawnTimer <= 0) {
    const nextCp = course.checkpoints[checkpointIndex + 1];
    if (
      nextCp &&
      p1.z >= nextCp.triggerZ &&
      p2.z >= nextCp.triggerZ &&
      p1.grounded &&
      p2.grounded
    ) {
      checkpointIndex = nextCp.index;
      ropeStrain = 0;
      emit(
        'checkpoint',
        (p1.x + p2.x) * 0.5,
        (p1.y + p2.y) * 0.5,
        (p1.z + p2.z) * 0.5,
        nextCp.index,
      );
    }

    if (
      p1.z >= course.finishZ &&
      p2.z >= course.finishZ &&
      p1.grounded &&
      p2.grounded
    ) {
      phase = 'finished';
      emit(
        'course_clear',
        (p1.x + p2.x) * 0.5,
        (p1.y + p2.y) * 0.5,
        (p1.z + p2.z) * 0.5,
      );
    }
  }

  return {
    phase,
    tick: nextTick,
    matchTime: nextMatchTime,
    checkpointIndex,
    failures,
    p1,
    p2,
    ropeLength,
    effectiveMaxLen,
    ropeStrain,
    respawnTimer,
    nextEventId,
    events,
  };
}

function packSnapshotPlayer(player: RopePlayerState): RopeSnapshotPlayer {
  return {
    x: round2(player.x),
    y: round2(player.y),
    z: round2(player.z),
    vx: round2(player.vx),
    vy: round2(player.vy),
    vz: round2(player.vz),
    yaw: round2(player.yaw),
    grounded: player.grounded,
    anchored: player.anchored,
    reeling: player.reeling,
    hanging: player.hanging,
  };
}

/**
 * Compresses a `RopeSimState` into a compact network snapshot by rounding
 * floating-point fields to 2 decimals and normalizing `-0` to `0`.
 */
export function packRopeSnapshot(
  matchId: string,
  state: RopeSimState,
): RopeSnapshotPayload {
  return {
    mapId: 'rope_tether',
    matchId,
    tick: state.tick,
    matchTime: round2(state.matchTime),
    phase: state.phase,
    checkpointIndex: state.checkpointIndex,
    failures: state.failures,
    p1: packSnapshotPlayer(state.p1),
    p2: packSnapshotPlayer(state.p2),
    ropeLength: round2(state.ropeLength),
    ropeStrain: round2(state.ropeStrain),
    respawnTimer: round2(state.respawnTimer),
    events: state.events.map((evt) => ({ ...evt })),
  };
}
