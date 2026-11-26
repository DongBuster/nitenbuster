import {
  COYOTE_TIME_SEC,
  FALL_Y_LIMIT,
  GLASS_BREAK_DIST,
  GLASS_HALF_HEIGHT,
  GLASS_MAX_HP,
  GLASS_SAFE_MAX_DIST,
  GLASS_SAFE_MIN_DIST,
  GLASS_THICKNESS,
  GRAVITY,
  HAND_BASE_Y,
  ICE_ACCEL,
  ICE_FRICTION,
  INVULN_AFTER_CRACK_SEC,
  INVULN_AFTER_RESPAWN_SEC,
  JUMP_BUFFER_SEC,
  JUMP_VELOCITY,
  LIFT_DOWN_OFFSET,
  LIFT_SPEED,
  LIFT_UP_OFFSET,
  MAX_HAND_DY,
  PLAYER_CROUCH_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_MAX_SPEED,
  PLAYER_RADIUS,
  SHATTER_RESPAWN_SEC,
  STRESS_DECAY_PER_SEC,
  WOOD_ACCEL,
  WOOD_FRICTION,
} from './constants.ts';
import { GLASS_COURSE, evaluateDynamicObstacles } from './course.ts';
import type {
  Aabb3,
  CourseDef,
  EvaluatedBarrier,
  EvaluatedCourseObstacles,
  EvaluatedPendulum,
  EvaluatedPlatform,
  EvaluatedSpinner,
  EvaluatedWindZone,
  GlassSimPhase,
  GlassSimState,
  GlassState,
  PlayerInput,
  PlayerSimState,
  PlayerSlot,
  ShatterReason,
  SimEvent,
  SimEventKind,
} from './types.ts';

const GLASS_SAMPLE_TS = [0.1, 0.3, 0.5, 0.7, 0.9] as const;
const TIMER_EPS = 1e-9;
const LANDING_EDGE_MARGIN = 0.28;
const LANDING_SNAP_TOLERANCE = 0.18;
const STANDING_Y_TOLERANCE = 0.1;
const YAW_TURN_RATE = 14;
const SPRING_PULL_RATE = 7.5;
const SPRING_PUSH_RATE = 6.0;
const STRETCH_STRESS_RATE = 0.95;
const SQUISH_STRESS_RATE = 0.85;
const TILT_STRESS_RATE = 1.65;
const BOUNCE_BACK_VZ = 2.2;

/** Neutral zeroed player input constant. */
export const NEUTRAL_INPUT: PlayerInput = {
  moveX: 0,
  moveZ: 0,
  jump: false,
  lift: 0,
};

type Vec3 = { x: number; y: number; z: number };

type GlassTransform = {
  centerX: number;
  centerY: number;
  centerZ: number;
  yaw: number;
  pitch: number;
  length: number;
  h1: number;
  h2: number;
};

type ObstacleHit = {
  hitPoint: Vec3;
  damage: number;
  obstacleCenterZ: number;
};

type EventEmitter = (
  kind: SimEventKind,
  x: number,
  y: number,
  z: number,
  extra?: { checkpointIndex?: number; reason?: ShatterReason },
) => void;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

/**
 * Returns the world-space hand height `Y` for a player, combining feet elevation,
 * base carry height (`HAND_BASE_Y`), and smoothed vertical lift offset.
 */
export function getPlayerHandY(player: PlayerSimState): number {
  return player.y + HAND_BASE_Y + player.liftOffset;
}

/**
 * Computes the carried glass pane transform from P1 to P2 hand positions.
 *
 * Orientation convention for Three.js `rotation={[0, yaw, pitch]}` (XYZ Euler):
 * - `yaw = Math.atan2(-dz, dx) || 0` rotates local `+X` onto `(dx/dist, 0, dz/dist)`.
 * - `pitch = Math.atan2(dy, dist) || 0` tilts local `+X` vertically from P1 toward P2.
 * - `length = dist` is the horizontal XZ span between players.
 */
function computeGlassTransform(p1: PlayerSimState, p2: PlayerSimState): GlassTransform {
  const h1 = getPlayerHandY(p1);
  const h2 = getPlayerHandY(p2);
  const dx = p2.x - p1.x;
  const dy = h2 - h1;
  const dz = p2.z - p1.z;
  const dist = Math.hypot(dx, dz) || 0.0001;

  return {
    centerX: (p1.x + p2.x) * 0.5,
    centerY: (h1 + h2) * 0.5,
    centerZ: (p1.z + p2.z) * 0.5,
    yaw: Math.atan2(-dz, dx) || 0,
    pitch: Math.atan2(dy, dist) || 0,
    length: dist,
    h1,
    h2,
  };
}

function getGlassSamplePoint(p1: Vec3, p2: Vec3, t: number): Vec3 {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
    z: p1.z + (p2.z - p1.z) * t,
  };
}

function findGlassSegmentBoxHitPoint(p1: Vec3, p2: Vec3, box: Aabb3): Vec3 | null {
  const halfThick = GLASS_THICKNESS * 0.5;
  const halfH = GLASS_HALF_HEIGHT;

  for (const t of GLASS_SAMPLE_TS) {
    const sample = getGlassSamplePoint(p1, p2, t);
    if (
      sample.x + halfThick >= box.minX &&
      sample.x - halfThick <= box.maxX &&
      sample.y + halfH >= box.minY &&
      sample.y - halfH <= box.maxY &&
      sample.z + halfThick >= box.minZ &&
      sample.z - halfThick <= box.maxZ
    ) {
      return sample;
    }
  }
  return null;
}

/**
 * Tests 5 sample points (`t = 0.1, 0.3, 0.5, 0.7, 0.9`) along the carried glass segment
 * with half-extents `(GLASS_THICKNESS * 0.5, GLASS_HALF_HEIGHT, GLASS_THICKNESS * 0.5)`
 * against an axis-aligned bounding box.
 */
export function checkGlassSegmentBoxHit(p1: Vec3, p2: Vec3, box: Aabb3): boolean {
  return findGlassSegmentBoxHitPoint(p1, p2, box) !== null;
}

function findGlassPendulumHitPoint(
  p1: Vec3,
  p2: Vec3,
  pendulum: EvaluatedPendulum,
): Vec3 | null {
  const halfThick = GLASS_THICKNESS * 0.5;
  const halfH = GLASS_HALF_HEIGHT;
  const radiusSq = pendulum.bobRadius * pendulum.bobRadius;

  for (const t of GLASS_SAMPLE_TS) {
    const sample = getGlassSamplePoint(p1, p2, t);
    const cx = clamp(pendulum.bobX, sample.x - halfThick, sample.x + halfThick);
    const cy = clamp(pendulum.bobY, sample.y - halfH, sample.y + halfH);
    const cz = clamp(pendulum.bobZ, sample.z - halfThick, sample.z + halfThick);

    const dx = pendulum.bobX - cx;
    const dy = pendulum.bobY - cy;
    const dz = pendulum.bobZ - cz;
    if (dx * dx + dy * dy + dz * dz <= radiusSq) {
      return sample;
    }
  }
  return null;
}

function findGlassSpinnerHitPoint(
  p1: Vec3,
  p2: Vec3,
  spinner: EvaluatedSpinner,
): Vec3 | null {
  const halfThick = GLASS_THICKNESS * 0.5;
  const halfH = GLASS_HALF_HEIGHT;
  const cosA = Math.cos(spinner.angle);
  const sinA = Math.sin(spinner.angle);

  for (const t of GLASS_SAMPLE_TS) {
    const sample = getGlassSamplePoint(p1, p2, t);
    const wx = sample.x - spinner.centerX;
    const wy = sample.y - spinner.centerY;
    const wz = sample.z - spinner.centerZ;

    // Rotate world offset by -spinner.angle around Y into spinner local space.
    const localX = wx * cosA - wz * sinA;
    const localZ = wx * sinA + wz * cosA;

    if (
      Math.abs(localX) <= spinner.halfLength + halfThick &&
      Math.abs(wy) <= spinner.halfHeight + halfH &&
      Math.abs(localZ) <= spinner.halfThickness + halfThick
    ) {
      return sample;
    }
  }
  return null;
}

function detectGlassObstacleHit(
  p1Hand: Vec3,
  p2Hand: Vec3,
  obs: EvaluatedCourseObstacles,
): ObstacleHit | null {
  for (const barrier of obs.barriers) {
    const hitPoint = findGlassSegmentBoxHitPoint(p1Hand, p2Hand, barrier.box);
    if (hitPoint) {
      return {
        hitPoint,
        damage: barrier.damage,
        obstacleCenterZ: (barrier.box.minZ + barrier.box.maxZ) * 0.5,
      };
    }
  }

  for (const pendulum of obs.pendulums) {
    const hitPoint = findGlassPendulumHitPoint(p1Hand, p2Hand, pendulum);
    if (hitPoint) {
      return { hitPoint, damage: pendulum.damage, obstacleCenterZ: pendulum.bobZ };
    }
  }

  for (const spinner of obs.spinners) {
    const hitPoint = findGlassSpinnerHitPoint(p1Hand, p2Hand, spinner);
    if (hitPoint) {
      return { hitPoint, damage: spinner.damage, obstacleCenterZ: spinner.centerZ };
    }
  }

  return null;
}

function findStandingPlatform(
  x: number,
  y: number,
  z: number,
  vy: number,
  platforms: readonly EvaluatedPlatform[],
): EvaluatedPlatform | null {
  if (vy > 0.1) return null;

  let bestExact: EvaluatedPlatform | null = null;
  let bestMargin: EvaluatedPlatform | null = null;

  for (const plat of platforms) {
    if (Math.abs(y - plat.box.maxY) > STANDING_Y_TOLERANCE) continue;

    const insideExact =
      x >= plat.box.minX &&
      x <= plat.box.maxX &&
      z >= plat.box.minZ &&
      z <= plat.box.maxZ;
    if (insideExact) {
      if (!bestExact || plat.box.maxY > bestExact.box.maxY) bestExact = plat;
      continue;
    }

    const insideFootprint =
      x >= plat.box.minX - PLAYER_RADIUS &&
      x <= plat.box.maxX + PLAYER_RADIUS &&
      z >= plat.box.minZ - PLAYER_RADIUS &&
      z <= plat.box.maxZ + PLAYER_RADIUS;
    if (insideFootprint) {
      if (!bestMargin || plat.box.maxY > bestMargin.box.maxY) bestMargin = plat;
    }
  }

  return bestExact ?? bestMargin;
}

function resolveLandingPlatform(
  prevY: number,
  x: number,
  newY: number,
  z: number,
  vy: number,
  platforms: readonly EvaluatedPlatform[],
): EvaluatedPlatform | null {
  if (vy > 0) return null;

  let best: EvaluatedPlatform | null = null;
  for (const plat of platforms) {
    if (prevY < plat.box.maxY - LANDING_SNAP_TOLERANCE) continue;
    if (newY > plat.box.maxY) continue;
    if (
      x < plat.box.minX - LANDING_EDGE_MARGIN ||
      x > plat.box.maxX + LANDING_EDGE_MARGIN ||
      z < plat.box.minZ - LANDING_EDGE_MARGIN ||
      z > plat.box.maxZ + LANDING_EDGE_MARGIN
    ) {
      continue;
    }
    if (!best || plat.box.maxY > best.box.maxY) best = plat;
  }
  return best;
}

function computeActiveWindForceX(
  x: number,
  y: number,
  z: number,
  windZones: readonly EvaluatedWindZone[],
): { inWind: boolean; forceX: number } {
  const centerY = y + PLAYER_HEIGHT * 0.5;
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

function resolvePlayerBarriers(
  player: PlayerSimState,
  barriers: readonly EvaluatedBarrier[],
): PlayerSimState {
  let { x, z, vx, vz } = player;
  const effectiveHeight =
    player.liftOffset < -0.1 ? PLAYER_CROUCH_HEIGHT : PLAYER_HEIGHT;
  const minPlayerY = player.y + 0.1;
  const maxPlayerY = player.y + effectiveHeight;

  for (const barrier of barriers) {
    if (!barrier.blocksPlayers) continue;
    const { box } = barrier;
    if (maxPlayerY <= box.minY || minPlayerY >= box.maxY) continue;

    const closestX = clamp(x, box.minX, box.maxX);
    const closestZ = clamp(z, box.minZ, box.maxZ);
    const dx = x - closestX;
    const dz = z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= PLAYER_RADIUS * PLAYER_RADIUS) continue;

    if (distSq > 1e-12) {
      const d = Math.sqrt(distSq);
      const nx = dx / d;
      const nz = dz / d;
      const pen = PLAYER_RADIUS - d;
      x += nx * pen;
      z += nz * pen;
      const vn = vx * nx + vz * nz;
      if (vn < 0) {
        vx -= vn * nx;
        vz -= vn * nz;
      }
      continue;
    }

    // Center embedded inside AABB: push out along minimum penetration axis.
    const leftPen = x - box.minX;
    const rightPen = box.maxX - x;
    const backPen = z - box.minZ;
    const frontPen = box.maxZ - z;
    const minPen = Math.min(leftPen, rightPen, backPen, frontPen);

    if (minPen === leftPen) {
      x = box.minX - PLAYER_RADIUS;
      if (vx > 0) vx = 0;
    } else if (minPen === rightPen) {
      x = box.maxX + PLAYER_RADIUS;
      if (vx < 0) vx = 0;
    } else if (minPen === backPen) {
      z = box.minZ - PLAYER_RADIUS;
      if (vz > 0) vz = 0;
    } else {
      z = box.maxZ + PLAYER_RADIUS;
      if (vz < 0) vz = 0;
    }
  }

  return x === player.x && z === player.z && vx === player.vx && vz === player.vz
    ? player
    : { ...player, x, z, vx, vz };
}

function stepPlayer(
  player: PlayerSimState,
  input: PlayerInput,
  dt: number,
  obs: EvaluatedCourseObstacles,
): PlayerSimState {
  const rawMag = Math.hypot(input.moveX, input.moveZ);
  const moveX = rawMag > 1 ? input.moveX / rawMag : input.moveX;
  const moveZ = rawMag > 1 ? input.moveZ / rawMag : input.moveZ;
  const inputMag = Math.min(1, rawMag);

  const standingPlat = findStandingPlatform(
    player.x,
    player.y,
    player.z,
    player.vy,
    obs.platforms,
  );
  const onIce = standingPlat?.surface === 'ice';
  const accel = onIce ? ICE_ACCEL : WOOD_ACCEL;
  const friction = onIce ? ICE_FRICTION : WOOD_FRICTION;

  let x = player.x + (standingPlat ? standingPlat.vx * dt : 0);
  let z = player.z + (standingPlat ? standingPlat.vz * dt : 0);
  let y = player.y;
  let vx = player.vx;
  let vz = player.vz;
  let vy = player.vy;
  let yaw = player.yaw;

  // Accelerate along input direction while damping perpendicular drift with surface friction.
  if (inputMag > 1e-4) {
    const ux = moveX / inputMag;
    const uz = moveZ / inputMag;
    const vParallel = vx * ux + vz * uz;
    const vPerp = -vx * uz + vz * ux;

    const nextParallel = moveToward(vParallel, inputMag * PLAYER_MAX_SPEED, accel * dt);
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

  const wind = computeActiveWindForceX(x, y, z, obs.windZones);
  if (wind.inWind) vx += wind.forceX * dt;

  let coyoteTimer = player.grounded
    ? COYOTE_TIME_SEC
    : decrementTimer(player.coyoteTimer, dt);
  let jumpBufferTimer = input.jump
    ? JUMP_BUFFER_SEC
    : decrementTimer(player.jumpBufferTimer, dt);
  let grounded = player.grounded;

  if (jumpBufferTimer > 0 && coyoteTimer > 0) {
    vy = JUMP_VELOCITY;
    grounded = false;
    coyoteTimer = 0;
    jumpBufferTimer = 0;
  }

  const prevY = y;
  vy += GRAVITY * dt;
  x += vx * dt;
  z += vz * dt;
  y += vy * dt;

  const landedPlat = resolveLandingPlatform(prevY, x, y, z, vy, obs.platforms);
  if (landedPlat) {
    y = landedPlat.box.maxY;
    vy = 0;
    grounded = true;
  } else {
    grounded = false;
  }

  const targetLift =
    input.lift > 0 ? LIFT_UP_OFFSET : input.lift < 0 ? LIFT_DOWN_OFFSET : 0;
  const liftOffset = moveToward(player.liftOffset, targetLift, LIFT_SPEED * dt);

  return resolvePlayerBarriers(
    {
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
      liftOffset,
      liftIntent: input.lift,
      onIce,
      inWind: wind.inWind,
    },
    obs.barriers,
  );
}

function createSpawnedPlayer(
  slot: PlayerSlot,
  spawn: Vec3,
  platforms: readonly EvaluatedPlatform[],
): PlayerSimState {
  const standingPlat = findStandingPlatform(spawn.x, spawn.y, spawn.z, 0, platforms);
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
    liftOffset: 0,
    liftIntent: 0,
    onIce: standingPlat?.surface === 'ice',
    inWind: false,
  };
}

function buildGlassState(
  transform: GlassTransform,
  overrides: Partial<GlassState> = {},
): GlassState {
  return {
    hp: GLASS_MAX_HP,
    maxHp: GLASS_MAX_HP,
    stress: 0,
    centerX: transform.centerX,
    centerY: transform.centerY,
    centerZ: transform.centerZ,
    yaw: transform.yaw,
    pitch: transform.pitch,
    length: transform.length,
    invulnTimer: 0,
    shatterTimer: 0,
    shatterReason: null,
    lastImpactX: 0,
    lastImpactY: 0,
    lastImpactZ: 0,
    ...overrides,
  };
}

function stepShatterLock(
  state: GlassSimState,
  course: CourseDef,
  obs: EvaluatedCourseObstacles,
  dt: number,
  nextTick: number,
  nextMatchTime: number,
  nextEventId: number,
): GlassSimState {
  const nextShatterTimer = decrementTimer(state.glass.shatterTimer, dt);
  if (nextShatterTimer > 0) {
    return {
      ...state,
      tick: nextTick,
      matchTime: nextMatchTime,
      p1: { ...state.p1 },
      p2: { ...state.p2 },
      glass: { ...state.glass, shatterTimer: nextShatterTimer },
      nextEventId,
      events: [],
    };
  }

  const cp = course.checkpoints[state.checkpointIndex] ?? course.checkpoints[0];
  const respawnedP1 = createSpawnedPlayer('p1', cp.p1Spawn, obs.platforms);
  const respawnedP2 = createSpawnedPlayer('p2', cp.p2Spawn, obs.platforms);
  const transform = computeGlassTransform(respawnedP1, respawnedP2);
  const respawnedGlass = buildGlassState(transform, {
    invulnTimer: INVULN_AFTER_RESPAWN_SEC,
    lastImpactX: state.glass.lastImpactX,
    lastImpactY: state.glass.lastImpactY,
    lastImpactZ: state.glass.lastImpactZ,
  });

  const events: SimEvent[] = [
    {
      id: nextEventId,
      kind: 'respawn',
      x: respawnedGlass.centerX,
      y: respawnedGlass.centerY,
      z: respawnedGlass.centerZ,
      checkpointIndex: state.checkpointIndex,
    },
  ];

  return {
    ...state,
    tick: nextTick,
    matchTime: nextMatchTime,
    p1: respawnedP1,
    p2: respawnedP2,
    glass: respawnedGlass,
    nextEventId: nextEventId + 1,
    events,
  };
}

function applySpringAndStress(
  p1In: PlayerSimState,
  p2In: PlayerSimState,
  prevStress: number,
  dt: number,
  barriers: readonly EvaluatedBarrier[],
): {
  p1: PlayerSimState;
  p2: PlayerSimState;
  stress: number;
  transform: GlassTransform;
  shatterReason: ShatterReason | null;
} {
  let p1 = p1In;
  let p2 = p2In;
  let stress = prevStress;

  const rawDx = p2.x - p1.x;
  const rawDz = p2.z - p1.z;
  const rawDist = Math.hypot(rawDx, rawDz);
  const dist = rawDist || 0.0001;
  const nx = rawDist > 1e-6 ? rawDx / rawDist : 1;
  const nz = rawDist > 1e-6 ? rawDz / rawDist : 0;
  const dy = getPlayerHandY(p2) - getPlayerHandY(p1);

  const brokeImmediateDist = dist > GLASS_BREAK_DIST;
  let stressed = false;

  if (dist > GLASS_SAFE_MAX_DIST) {
    stress += (dist - GLASS_SAFE_MAX_DIST) * STRETCH_STRESS_RATE * dt;
    stressed = true;
    if (!brokeImmediateDist) {
      const pull = (dist - GLASS_SAFE_MAX_DIST) * SPRING_PULL_RATE * dt;
      p1 = resolvePlayerBarriers(
        { ...p1, x: p1.x + nx * pull, z: p1.z + nz * pull },
        barriers,
      );
      p2 = resolvePlayerBarriers(
        { ...p2, x: p2.x - nx * pull, z: p2.z - nz * pull },
        barriers,
      );
    }
  } else if (dist < GLASS_SAFE_MIN_DIST) {
    stress += (GLASS_SAFE_MIN_DIST - dist) * SQUISH_STRESS_RATE * dt;
    stressed = true;
    const push = (GLASS_SAFE_MIN_DIST - dist) * SPRING_PUSH_RATE * dt;
    p1 = resolvePlayerBarriers(
      { ...p1, x: p1.x - nx * push, z: p1.z - nz * push },
      barriers,
    );
    p2 = resolvePlayerBarriers(
      { ...p2, x: p2.x + nx * push, z: p2.z + nz * push },
      barriers,
    );
  }

  if (Math.abs(dy) > MAX_HAND_DY) {
    stress += TILT_STRESS_RATE * dt;
    stressed = true;
  } else if (
    !stressed &&
    dist >= GLASS_SAFE_MIN_DIST + 0.1 &&
    dist <= GLASS_SAFE_MAX_DIST - 0.05 &&
    Math.abs(dy) <= MAX_HAND_DY - 0.2
  ) {
    stress = Math.max(0, stress - STRESS_DECAY_PER_SEC * dt);
  }

  const transform = computeGlassTransform(p1, p2);
  let shatterReason: ShatterReason | null = null;
  if (stress >= 1.0 || brokeImmediateDist || transform.length > GLASS_BREAK_DIST) {
    shatterReason =
      Math.abs(dy) > MAX_HAND_DY && dist <= GLASS_SAFE_MAX_DIST ? 'tilt' : 'stretch';
  }

  return { p1, p2, stress, transform, shatterReason };
}

function applyBounceImpulse(
  player: PlayerSimState,
  obstacleCenterZ: number,
  glassCenterZ: number,
): PlayerSimState {
  const vz =
    obstacleCenterZ >= glassCenterZ - 0.05
      ? Math.min(player.vz, -BOUNCE_BACK_VZ)
      : Math.max(player.vz, BOUNCE_BACK_VZ);
  return { ...player, vz };
}

/** Creates the deterministic initial simulation state at checkpoint 0 of `course`. */
export function createInitialSimState(course: CourseDef = GLASS_COURSE): GlassSimState {
  const cp0 = course.checkpoints[0];
  const obs = evaluateDynamicObstacles(course, 0);
  const p1 = createSpawnedPlayer('p1', cp0.p1Spawn, obs.platforms);
  const p2 = createSpawnedPlayer('p2', cp0.p2Spawn, obs.platforms);

  return {
    phase: 'playing',
    tick: 0,
    matchTime: 0,
    checkpointIndex: 0,
    shatters: 0,
    p1,
    p2,
    glass: buildGlassState(computeGlassTransform(p1, p2)),
    nextEventId: 1,
    events: [],
  };
}

/**
 * Advances the deterministic Glass Carry Co-op simulation by `dt` seconds without
 * mutating `state`. Returns fresh state containing only events emitted during this step.
 */
export function stepGlassSim(
  state: GlassSimState,
  p1Input: PlayerInput,
  p2Input: PlayerInput,
  dt: number,
  course: CourseDef = GLASS_COURSE,
): GlassSimState {
  if (state.phase === 'finished' || dt <= 0) {
    return {
      ...state,
      p1: { ...state.p1 },
      p2: { ...state.p2 },
      glass: { ...state.glass },
      events: [],
    };
  }

  const nextTick = state.tick + 1;
  const nextMatchTime = state.matchTime + dt;
  const obs = evaluateDynamicObstacles(course, nextMatchTime);

  if (state.glass.shatterTimer > 0) {
    return stepShatterLock(
      state,
      course,
      obs,
      dt,
      nextTick,
      nextMatchTime,
      state.nextEventId,
    );
  }

  const events: SimEvent[] = [];
  let nextEventId = state.nextEventId;
  const emit: EventEmitter = (kind, x, y, z, extra = {}) => {
    events.push({ id: nextEventId++, kind, x, y, z, ...extra });
  };

  const steppedP1 = stepPlayer(state.p1, p1Input, dt, obs);
  const steppedP2 = stepPlayer(state.p2, p2Input, dt, obs);

  const spring = applySpringAndStress(
    steppedP1,
    steppedP2,
    state.glass.stress,
    dt,
    obs.barriers,
  );
  let p1 = spring.p1;
  let p2 = spring.p2;
  let stress = spring.stress;
  const transform = spring.transform;

  let hp = state.glass.hp;
  let invulnTimer = decrementTimer(state.glass.invulnTimer, dt);
  let shatterTimer = 0;
  let shatterReason: ShatterReason | null = null;
  let shatters = state.shatters;
  let lastImpactX = state.glass.lastImpactX;
  let lastImpactY = state.glass.lastImpactY;
  let lastImpactZ = state.glass.lastImpactZ;

  const triggerShatter = (reason: ShatterReason, pos: Vec3): void => {
    shatters += 1;
    hp = 0;
    shatterTimer = SHATTER_RESPAWN_SEC;
    shatterReason = reason;
    emit('glass_shatter', pos.x, pos.y, pos.z, { reason });
  };

  if (p1.y < FALL_Y_LIMIT || p2.y < FALL_Y_LIMIT) {
    triggerShatter('fall', {
      x: transform.centerX,
      y: transform.centerY,
      z: transform.centerZ,
    });
  } else if (spring.shatterReason) {
    triggerShatter(spring.shatterReason, {
      x: transform.centerX,
      y: transform.centerY,
      z: transform.centerZ,
    });
  } else if (invulnTimer <= 0) {
    const p1Hand: Vec3 = { x: p1.x, y: transform.h1, z: p1.z };
    const p2Hand: Vec3 = { x: p2.x, y: transform.h2, z: p2.z };
    const hit = detectGlassObstacleHit(p1Hand, p2Hand, obs);

    if (hit) {
      hp = Math.max(0, hp - hit.damage);
      p1 = applyBounceImpulse(p1, hit.obstacleCenterZ, transform.centerZ);
      p2 = applyBounceImpulse(p2, hit.obstacleCenterZ, transform.centerZ);
      lastImpactX = hit.hitPoint.x;
      lastImpactY = hit.hitPoint.y;
      lastImpactZ = hit.hitPoint.z;

      if (hp <= 0) {
        triggerShatter('impact', hit.hitPoint);
      } else {
        invulnTimer = INVULN_AFTER_CRACK_SEC;
        emit('glass_crack', lastImpactX, lastImpactY, lastImpactZ);
      }
    }
  }

  let phase: GlassSimPhase = state.phase;
  let checkpointIndex = state.checkpointIndex;

  if (hp > 0 && shatterTimer <= 0) {
    const nextCheckpoint = course.checkpoints[checkpointIndex + 1];
    if (
      nextCheckpoint &&
      p1.z >= nextCheckpoint.triggerZ &&
      p2.z >= nextCheckpoint.triggerZ
    ) {
      checkpointIndex = nextCheckpoint.index;
      hp = GLASS_MAX_HP;
      stress = 0;
      emit('checkpoint', transform.centerX, transform.centerY, transform.centerZ, {
        checkpointIndex: nextCheckpoint.index,
      });
    }

    if (p1.z >= course.finishZ && p2.z >= course.finishZ) {
      phase = 'finished';
      emit('course_clear', transform.centerX, transform.centerY, transform.centerZ);
    }
  }

  return {
    phase,
    tick: nextTick,
    matchTime: nextMatchTime,
    checkpointIndex,
    shatters,
    p1,
    p2,
    glass: buildGlassState(transform, {
      hp,
      stress,
      invulnTimer,
      shatterTimer,
      shatterReason,
      lastImpactX,
      lastImpactY,
      lastImpactZ,
    }),
    nextEventId,
    events,
  };
}
