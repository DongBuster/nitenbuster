export type PartyActionKind =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'punch_left'
  | 'punch_right'
  | 'headbutt'
  | 'spin_attack'
  | 'dropkick'
  | 'dropkick_slide'
  | 'roll'
  | 'grab_hold'
  | 'grabbed'
  | 'stunned'
  | 'wakeup';

export interface Spring1D {
  value: number;
  velocity: number;
}

export interface PartyMotionState {
  /** Forward/back torso lean in local character space (radians) */
  tiltX: Spring1D;
  /** Lateral torso lean / roll in local character space (radians) */
  tiltZ: Spring1D;
  /** Head/ear/tail pitch inertial lag (radians) */
  headLagX: Spring1D;
  /** Head/ear/tail roll/yaw inertial lag (radians) */
  headLagZ: Spring1D;
  /** Vertical squash-and-stretch factor (1.0 = neutral, <1 = squashed, >1 = stretched) */
  squashY: Spring1D;
  /** Current high-priority action state */
  action: PartyActionKind;
  /** Normalized 0..1 progress within timed actions (punch, headbutt, dropkick, roll, wakeup) */
  actionProgress: number;
  /** Normalized horizontal speed (0..1.6) */
  speedNorm: number;
  /** Continuous phase angle for waddle walk & arm swing */
  walkPhase: number;
  /** True when holding sprint while moving */
  sprinting: boolean;
}

export interface PartyMotionFrameInput {
  nowSec: number;
  vx: number;
  vy: number;
  vz: number;
  prevVx: number;
  prevVz: number;
  yaw: number;
  prevYaw: number;
  grounded: boolean;
  wasGrounded: boolean;
  sprinting: boolean;
  isStunned: boolean;
  isFrozen: boolean;
  isGrabbing: boolean;
  isGrabbed: boolean;
  rollUntil: number;
  rollDuration: number;
  punchUntil: number;
  punchDuration: number;
  punchHand: 'left' | 'right';
  headbuttUntil: number;
  headbuttDuration: number;
  spinUntil: number;
  spinDuration: number;
  dropkickUntil: number;
  dropkickDuration: number;
  dropkickSlideUntil: number;
  wakeupUntil: number;
  wakeupDuration: number;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Semi-implicit Euler spring-damper solver with sub-stepping for stability on frame spikes.
 */
export function stepSpring(
  spring: Spring1D,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): number {
  const safeDt = clamp(dt, 0.001, 0.05);
  const steps = safeDt > 0.02 ? 2 : 1;
  const h = safeDt / steps;

  for (let i = 0; i < steps; i++) {
    const force = (target - spring.value) * stiffness - spring.velocity * damping;
    spring.velocity += force * h;
    spring.value += spring.velocity * h;
  }

  return spring.value;
}

export function createPartyMotionState(): PartyMotionState {
  return {
    tiltX: { value: 0, velocity: 0 },
    tiltZ: { value: 0, velocity: 0 },
    headLagX: { value: 0, velocity: 0 },
    headLagZ: { value: 0, velocity: 0 },
    squashY: { value: 1, velocity: 0 },
    action: 'idle',
    actionProgress: 0,
    speedNorm: 0,
    walkPhase: Math.random() * Math.PI * 2,
    sprinting: false,
  };
}

export function stepPartyMotion(
  state: PartyMotionState,
  input: PartyMotionFrameInput,
  dt: number,
): void {
  const safeDt = clamp(dt, 0.001, 0.05);
  const now = input.nowSec;

  const fwdX = Math.sin(input.yaw);
  const fwdZ = Math.cos(input.yaw);
  const rightX = Math.cos(input.yaw);
  const rightZ = -Math.sin(input.yaw);

  const horizSpeed = Math.hypot(input.vx, input.vz);
  state.speedNorm = clamp(horizSpeed / 4.3, 0, 1.65);
  state.sprinting = input.sprinting && state.speedNorm > 0.15 && input.grounded;

  if (input.grounded && state.speedNorm > 0.08 && !input.isStunned && !input.isFrozen) {
    const cadence = state.sprinting ? 14.5 : 10.5;
    state.walkPhase += safeDt * (cadence + state.speedNorm * 4.2);
  }

  // Compute local velocity & acceleration projections
  const forwardSpeed = input.vx * fwdX + input.vz * fwdZ;
  const accelX = (input.vx - input.prevVx) / safeDt;
  const accelZ = (input.vz - input.prevVz) / safeDt;
  const forwardAccel = clamp((accelX * fwdX + accelZ * fwdZ) * 0.012, -0.35, 0.35);
  const lateralAccel = clamp((accelX * rightX + accelZ * rightZ) * 0.014, -0.38, 0.38);

  // Angular turn velocity for banking into turns like Party Animals
  let yawDelta = input.yaw - input.prevYaw;
  while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
  while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
  const yawRate = clamp(yawDelta / safeDt, -12, 12);

  // Landing squash impulse or jump stretch impulse
  if (input.grounded && !input.wasGrounded) {
    const impact = clamp(Math.abs(Math.min(0, input.vy)) * 0.055, 0.08, 0.32);
    state.squashY.value = Math.min(state.squashY.value, 1 - impact);
    state.squashY.velocity -= impact * 8.5;
    state.headLagX.velocity += impact * 12;
  } else if (!input.grounded && input.wasGrounded && input.vy > 2.0) {
    state.squashY.value = Math.max(state.squashY.value, 1.14);
    state.squashY.velocity += 1.8;
  }

  // Determine active PartyActionKind and normalized progress
  let action: PartyActionKind = 'idle';
  let progress = 0;

  if (input.isStunned) {
    action = 'stunned';
  } else if (input.isGrabbed) {
    action = 'grabbed';
  } else if (now < input.dropkickUntil) {
    action = 'dropkick';
    progress = clamp(1 - (input.dropkickUntil - now) / Math.max(0.05, input.dropkickDuration), 0, 1);
  } else if (now < input.dropkickSlideUntil) {
    action = 'dropkick_slide';
    progress = clamp(1 - (input.dropkickSlideUntil - now) / 0.28, 0, 1);
  } else if (now < input.rollUntil) {
    action = 'roll';
    progress = clamp(1 - (input.rollUntil - now) / Math.max(0.05, input.rollDuration), 0, 1);
  } else if (now < input.spinUntil) {
    action = 'spin_attack';
    progress = clamp(1 - (input.spinUntil - now) / Math.max(0.05, input.spinDuration), 0, 1);
  } else if (now < input.headbuttUntil) {
    action = 'headbutt';
    progress = clamp(1 - (input.headbuttUntil - now) / Math.max(0.05, input.headbuttDuration), 0, 1);
  } else if (now < input.punchUntil) {
    action = input.punchHand === 'left' ? 'punch_left' : 'punch_right';
    progress = clamp(1 - (input.punchUntil - now) / Math.max(0.05, input.punchDuration), 0, 1);
  } else if (now < input.wakeupUntil) {
    action = 'wakeup';
    progress = clamp(1 - (input.wakeupUntil - now) / Math.max(0.05, input.wakeupDuration), 0, 1);
  } else if (input.isGrabbing) {
    action = 'grab_hold';
  } else if (!input.grounded) {
    action = input.vy >= 0 ? 'jump' : 'fall';
  } else if (state.speedNorm > 0.08) {
    action = 'run';
  }

  state.action = action;
  state.actionProgress = progress;

  // Target forward/back lean (tiltX) and side bank/waddle (tiltZ)
  const waddleSway =
    input.grounded && state.speedNorm > 0.08
      ? Math.sin(state.walkPhase) * (state.sprinting ? 0.2 : 0.15) * Math.min(1.2, state.speedNorm)
      : 0;

  const targetTiltX = clamp(
    (forwardSpeed / 4.3) * (state.sprinting ? 0.26 : 0.17) + forwardAccel * 0.45,
    -0.42,
    0.45,
  );
  const targetTiltZ = clamp(
    waddleSway - yawRate * 0.025 * Math.min(1, state.speedNorm) - lateralAccel * 0.5,
    -0.45,
    0.45,
  );

  stepSpring(state.tiltX, targetTiltX, 135, 16, safeDt);
  stepSpring(state.tiltZ, targetTiltZ, 125, 15, safeDt);

  // Secondary floppy head/ear/tail inertia (lags behind torso tilt & vertical velocity)
  const targetHeadLagX = clamp(
    -forwardAccel * 0.85 - clamp(input.vy * 0.04, -0.28, 0.28) - state.tiltX.velocity * 0.045,
    -0.55,
    0.55,
  );
  const targetHeadLagZ = clamp(
    -lateralAccel * 0.85 - state.tiltZ.velocity * 0.055 + yawRate * 0.03,
    -0.55,
    0.55,
  );

  stepSpring(state.headLagX, targetHeadLagX, 95, 9.5, safeDt);
  stepSpring(state.headLagZ, targetHeadLagZ, 95, 9.5, safeDt);

  // Squash & stretch recovery toward 1.0
  const targetSquash =
    action === 'headbutt'
      ? 1.1
      : action === 'spin_attack'
        ? 0.94
        : action === 'dropkick'
          ? 1.08
          : state.sprinting
            ? 1 + Math.sin(state.walkPhase * 2) * 0.05
            : 1.0;
  stepSpring(state.squashY, targetSquash, 180, 17, safeDt);
}
