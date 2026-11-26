import {
  MINECART_BASE_SPEED,
  MINECART_COURSE,
  MINECART_FALL_LIMIT_Y,
  MINECART_GRAVITY,
  MINECART_INVULN_SEC,
  MINECART_JUMP_SYNC_WINDOW,
  MINECART_JUMP_VEL,
  MINECART_LANE_COOLDOWN_SEC,
  MINECART_LANE_HOLD_SEC,
  MINECART_MAX_HP,
  MINECART_MAX_SPEED,
  MINECART_MIN_SPEED,
  MINECART_PUMP_BOOST,
  MINECART_RESPAWN_SEC,
  MINECART_SPEED_DECAY,
  evaluateMinecartObstacles,
} from './course.ts';
import type {
  MinecartCourseDef,
  MinecartLane,
  MinecartSimEvent,
  MinecartSimEventKind,
  MinecartSimState,
  MinecartSnapshotPayload,
  MinecartState,
  PlayerInput,
} from './types.ts';

const TIMER_EPS = 1e-9;
const RESPAWN_INVULN_SEC = 1.0;
const GAP_EDGE_MARGIN = 0.35;
const LANDING_Y_TOLERANCE = -0.35;
const BLOCKER_HALF_DEPTH_PAD = 0.7;
const BLOCKER_HALF_WIDTH_PAD = 1.15;
const BLOCKER_HEIGHT_LIMIT = 1.0;
const BLOCKER_SPEED_PENALTY = 0.55;
const BEAM_HALF_DEPTH_PAD = 0.6;
const SWEEPER_HALF_DEPTH_PAD = 0.6;
const SWEEPER_HALF_WIDTH_PAD = 0.75;
const SWEEPER_HEIGHT_LIMIT = 1.1;
const ROCKFALL_HALF_DEPTH_PAD = 1.1;
const ROCKFALL_HALF_WIDTH_PAD = 1.15;
const LEAN_THRESHOLD = 0.4;
const LANE_SNAP_RATE = 18;
const WOBBLE_RISE_RATE = 3.5;
const WOBBLE_DECAY_RATE = 2.5;

type EventEmitter = (
  kind: MinecartSimEventKind,
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

function getLeanDir(moveX: number): -1 | 0 | 1 {
  if (moveX > LEAN_THRESHOLD) return -1;
  if (moveX < -LEAN_THRESHOLD) return 1;
  return 0;
}

function createSpawnedCart(
  lane: MinecartLane,
  z: number,
  course: MinecartCourseDef,
  invulnTimer = 0,
): MinecartState {
  return {
    lane,
    x: course.laneX[lane],
    y: 0,
    z,
    vy: 0,
    speed: MINECART_BASE_SPEED,
    hp: MINECART_MAX_HP,
    maxHp: MINECART_MAX_HP,
    invulnTimer,
    respawnTimer: 0,
    pumpTurn: 'p1',
    pumpTilt: 0,
    p1PrevLiftUp: false,
    p2PrevLiftUp: false,
    laneHoldDir: 0,
    laneHoldTimer: 0,
    laneCooldown: 0,
    wobble: 0,
    p1Ducking: false,
    p2Ducking: false,
    lastP1JumpAt: -10,
    lastP2JumpAt: -10,
    grounded: true,
  };
}

function stepRespawnLock(
  state: MinecartSimState,
  course: MinecartCourseDef,
  dt: number,
  nextTick: number,
  nextMatchTime: number,
): MinecartSimState {
  const nextRespawnTimer = decrementTimer(state.cart.respawnTimer, dt);
  if (nextRespawnTimer > 0) {
    return {
      ...state,
      tick: nextTick,
      matchTime: nextMatchTime,
      cart: { ...state.cart, respawnTimer: nextRespawnTimer },
      events: [],
    };
  }

  const cp = course.checkpoints[state.checkpointIndex] ?? course.checkpoints[0];
  const respawned = createSpawnedCart(
    cp.spawnLane,
    cp.spawnZ,
    course,
    RESPAWN_INVULN_SEC,
  );
  const event: MinecartSimEvent = {
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
    cart: respawned,
    nextEventId: state.nextEventId + 1,
    events: [event],
  };
}

function detectObstacleHit(
  cart: MinecartState,
  course: MinecartCourseDef,
  matchTime: number,
): { hit: boolean; hitBlocker: boolean } {
  for (const b of course.blockers) {
    if (
      Math.abs(cart.z - b.z) < b.halfDepth + BLOCKER_HALF_DEPTH_PAD &&
      Math.abs(cart.x - course.laneX[b.lane]) < BLOCKER_HALF_WIDTH_PAD &&
      cart.y < BLOCKER_HEIGHT_LIMIT
    ) {
      return { hit: true, hitBlocker: true };
    }
  }

  for (const bm of course.beams) {
    if (
      Math.abs(cart.z - bm.z) < bm.halfDepth + BEAM_HALF_DEPTH_PAD &&
      bm.lanes.includes(cart.lane) &&
      !(cart.p1Ducking && cart.p2Ducking)
    ) {
      return { hit: true, hitBlocker: false };
    }
  }

  const obs = evaluateMinecartObstacles(course, matchTime);

  for (const sw of obs.sweepers) {
    if (
      Math.abs(cart.z - sw.z) < sw.halfDepth + SWEEPER_HALF_DEPTH_PAD &&
      Math.abs(cart.x - sw.x) < sw.halfWidth + SWEEPER_HALF_WIDTH_PAD &&
      cart.y < SWEEPER_HEIGHT_LIMIT
    ) {
      return { hit: true, hitBlocker: false };
    }
  }

  for (const rf of obs.rockfalls) {
    if (
      rf.state === 'active' &&
      Math.abs(cart.z - rf.z) < ROCKFALL_HALF_DEPTH_PAD &&
      Math.abs(cart.x - rf.x) < ROCKFALL_HALF_WIDTH_PAD
    ) {
      return { hit: true, hitBlocker: false };
    }
  }

  return { hit: false, hitBlocker: false };
}

/** Creates the deterministic initial Minecart Rails simulation state at checkpoint 0. */
export function createInitialMinecartSimState(
  course: MinecartCourseDef = MINECART_COURSE,
): MinecartSimState {
  const cp0 = course.checkpoints[0];
  return {
    phase: 'playing',
    tick: 0,
    matchTime: 0,
    checkpointIndex: 0,
    failures: 0,
    cart: createSpawnedCart(cp0.spawnLane, cp0.spawnZ, course),
    nextEventId: 1,
    events: [],
  };
}

/**
 * Advances the deterministic Minecart Rails Co-op simulation by `dt` seconds
 * without mutating `state`. Returns fresh state with events from this step only.
 */
export function stepMinecartSim(
  state: MinecartSimState,
  p1Input: PlayerInput,
  p2Input: PlayerInput,
  dt: number,
  course: MinecartCourseDef = MINECART_COURSE,
): MinecartSimState {
  if (state.phase === 'finished' || dt <= 0) {
    return {
      ...state,
      cart: { ...state.cart },
      events: [],
    };
  }

  const nextTick = state.tick + 1;
  const nextMatchTime = state.matchTime + dt;

  if (state.cart.respawnTimer > 0) {
    return stepRespawnLock(state, course, dt, nextTick, nextMatchTime);
  }

  const events: MinecartSimEvent[] = [];
  let nextEventId = state.nextEventId;
  const emit: EventEmitter = (kind, x, y, z, checkpointIndex) => {
    const evt: MinecartSimEvent = { id: nextEventId++, kind, x, y, z };
    if (checkpointIndex !== undefined) {
      evt.checkpointIndex = checkpointIndex;
    }
    events.push(evt);
  };

  const cart: MinecartState = {
    ...state.cart,
    invulnTimer: decrementTimer(state.cart.invulnTimer, dt),
    laneCooldown: decrementTimer(state.cart.laneCooldown, dt),
  };

  // Alternating pump on rising edge of lift > 0
  const p1LiftUp = p1Input.lift > 0 && !cart.p1PrevLiftUp;
  const p2LiftUp = p2Input.lift > 0 && !cart.p2PrevLiftUp;
  if (
    (cart.pumpTurn === 'p1' && p1LiftUp) ||
    (cart.pumpTurn === 'p2' && p2LiftUp)
  ) {
    const pumpedBy = cart.pumpTurn;
    cart.pumpTurn = pumpedBy === 'p1' ? 'p2' : 'p1';
    cart.speed = Math.min(MINECART_MAX_SPEED, cart.speed + MINECART_PUMP_BOOST);
    cart.pumpTilt = pumpedBy === 'p1' ? 1 : -1;
    emit('cart_pump', cart.x, cart.y, cart.z);
  }
  cart.p1PrevLiftUp = p1Input.lift > 0;
  cart.p2PrevLiftUp = p2Input.lift > 0;

  if (cart.speed > MINECART_BASE_SPEED) {
    cart.speed = Math.max(
      MINECART_BASE_SPEED,
      cart.speed - MINECART_SPEED_DECAY * dt,
    );
  }

  // Synchronized lane switch (+X is screen-left = lane - 1; -X is screen-right = lane + 1)
  const p1Dir = getLeanDir(p1Input.moveX);
  const p2Dir = getLeanDir(p2Input.moveX);

  if (p1Dir !== 0 && p1Dir === p2Dir && cart.laneCooldown <= 0) {
    if (cart.laneHoldDir !== p1Dir) {
      cart.laneHoldDir = p1Dir;
      cart.laneHoldTimer = dt;
    } else {
      cart.laneHoldTimer += dt;
    }

    if (cart.laneHoldTimer >= MINECART_LANE_HOLD_SEC) {
      const nextLane = clamp(cart.lane + p1Dir, 0, 2) as MinecartLane;
      cart.laneHoldTimer = 0;
      if (nextLane !== cart.lane) {
        cart.lane = nextLane;
        cart.laneCooldown = MINECART_LANE_COOLDOWN_SEC;
        emit('cart_lane', cart.x, cart.y, cart.z);
      }
    }
  } else {
    cart.laneHoldDir = 0;
    cart.laneHoldTimer = 0;
  }

  if (p1Dir !== 0 && p2Dir !== 0 && p1Dir !== p2Dir) {
    cart.wobble = Math.min(1, cart.wobble + WOBBLE_RISE_RATE * dt);
  } else {
    cart.wobble = Math.max(0, cart.wobble - WOBBLE_DECAY_RATE * dt);
  }

  const targetX = course.laneX[cart.lane];
  cart.x += (targetX - cart.x) * (1 - Math.exp(-LANE_SNAP_RATE * dt));

  // Synchronized duck
  cart.p1Ducking = p1Input.lift < 0;
  cart.p2Ducking = p2Input.lift < 0;

  // Synchronized jump
  if (cart.grounded) {
    if (p1Input.jump) {
      cart.lastP1JumpAt = nextMatchTime;
    }
    if (p2Input.jump) {
      cart.lastP2JumpAt = nextMatchTime;
    }
    if (
      cart.lastP1JumpAt >= 0 &&
      cart.lastP2JumpAt >= 0 &&
      Math.abs(cart.lastP1JumpAt - cart.lastP2JumpAt) <= MINECART_JUMP_SYNC_WINDOW
    ) {
      cart.vy = MINECART_JUMP_VEL;
      cart.grounded = false;
      cart.lastP1JumpAt = -10;
      cart.lastP2JumpAt = -10;
      emit('cart_jump', cart.x, cart.y, cart.z);
    }
  }

  // Forward motion & broken-rail gap handling
  cart.z += cart.speed * dt;
  const prevY = cart.y;
  const overGap = course.gaps.some(
    (gap) =>
      cart.z > gap.startZ + GAP_EDGE_MARGIN &&
      cart.z < gap.endZ - GAP_EDGE_MARGIN,
  );

  if (overGap) {
    cart.grounded = false;
  }

  if (!cart.grounded) {
    cart.vy += MINECART_GRAVITY * dt;
    cart.y += cart.vy * dt;
  }

  if (
    !overGap &&
    cart.y <= 0 &&
    prevY >= LANDING_Y_TOLERANCE &&
    cart.vy <= 0
  ) {
    cart.y = 0;
    cart.vy = 0;
    cart.grounded = true;
  }

  let failures = state.failures;
  if (cart.y < MINECART_FALL_LIMIT_Y) {
    failures += 1;
    cart.hp = 0;
    cart.respawnTimer = MINECART_RESPAWN_SEC;
    emit('cart_derail', cart.x, cart.y, cart.z);
  }

  // Obstacle collisions
  if (
    cart.hp > 0 &&
    cart.invulnTimer <= 0 &&
    cart.respawnTimer <= 0 &&
    cart.y >= LANDING_Y_TOLERANCE
  ) {
    const { hit, hitBlocker } = detectObstacleHit(cart, course, nextMatchTime);
    if (hit) {
      if (hitBlocker) {
        cart.speed = Math.max(
          MINECART_MIN_SPEED,
          cart.speed * BLOCKER_SPEED_PENALTY,
        );
      }
      cart.hp = Math.max(0, cart.hp - 1);
      if (cart.hp <= 0) {
        failures += 1;
        cart.respawnTimer = MINECART_RESPAWN_SEC;
        emit('cart_derail', cart.x, cart.y, cart.z);
      } else {
        cart.invulnTimer = MINECART_INVULN_SEC;
        emit('cart_hit', cart.x, cart.y, cart.z);
      }
    }
  }

  // Checkpoints & finish
  let phase: MinecartSimState['phase'] = state.phase;
  let checkpointIndex = state.checkpointIndex;

  if (cart.hp > 0 && cart.respawnTimer <= 0) {
    const nextCp = course.checkpoints[checkpointIndex + 1];
    if (nextCp && cart.z >= nextCp.triggerZ && cart.grounded) {
      checkpointIndex = nextCp.index;
      cart.hp = MINECART_MAX_HP;
      emit('checkpoint', cart.x, cart.y, cart.z, nextCp.index);
    }

    if (cart.z >= course.finishZ && cart.hp > 0) {
      phase = 'finished';
      emit('course_clear', cart.x, cart.y, cart.z);
    }
  }

  return {
    phase,
    tick: nextTick,
    matchTime: nextMatchTime,
    checkpointIndex,
    failures,
    cart,
    nextEventId,
    events,
  };
}

/**
 * Compresses a `MinecartSimState` into a compact network snapshot by rounding
 * floating-point fields to 2 decimals and normalizing `-0` to `0`.
 */
export function packMinecartSnapshot(
  matchId: string,
  state: MinecartSimState,
): MinecartSnapshotPayload {
  return {
    mapId: 'minecart_rails',
    matchId,
    tick: state.tick,
    matchTime: round2(state.matchTime),
    phase: state.phase,
    checkpointIndex: state.checkpointIndex,
    failures: state.failures,
    cart: {
      lane: state.cart.lane,
      x: round2(state.cart.x),
      y: round2(state.cart.y),
      z: round2(state.cart.z),
      vy: round2(state.cart.vy),
      speed: round2(state.cart.speed),
      hp: state.cart.hp,
      invulnTimer: round2(state.cart.invulnTimer),
      respawnTimer: round2(state.cart.respawnTimer),
      pumpTurn: state.cart.pumpTurn,
      pumpTilt: round2(state.cart.pumpTilt),
      wobble: round2(state.cart.wobble),
      p1Ducking: state.cart.p1Ducking,
      p2Ducking: state.cart.p2Ducking,
      grounded: state.cart.grounded,
    },
    events: state.events.map((evt) => ({ ...evt })),
  };
}
