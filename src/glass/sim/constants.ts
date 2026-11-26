export const FIXED_DT = 1 / 60;

export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.25;
export const PLAYER_CROUCH_HEIGHT = 0.85;

export const PLAYER_MAX_SPEED = 5.4;
export const WOOD_ACCEL = 32;
export const WOOD_FRICTION = 26;
export const ICE_ACCEL = 11.2;
export const ICE_FRICTION = 3.9;

export const GRAVITY = -20;
export const JUMP_VELOCITY = 7.6;
export const COYOTE_TIME_SEC = 0.1;
export const JUMP_BUFFER_SEC = 0.1;

export const GLASS_REST_LENGTH = 3.4;
export const GLASS_SAFE_MIN_DIST = 2.5;
export const GLASS_SAFE_MAX_DIST = 3.9;
export const GLASS_BREAK_DIST = 4.9;

export const GLASS_HEIGHT = 0.7;
export const GLASS_HALF_HEIGHT = 0.35;
export const GLASS_THICKNESS = 0.12;
export const GLASS_MAX_HP = 3;

export const HAND_BASE_Y = 0.95;
export const LIFT_UP_OFFSET = 0.85;
export const LIFT_DOWN_OFFSET = -0.55;
export const LIFT_SPEED = 9;

export const MAX_HAND_DY = 1.8;
export const STRESS_DECAY_PER_SEC = 0.8;

export const INVULN_AFTER_CRACK_SEC = 0.7;
export const INVULN_AFTER_RESPAWN_SEC = 1.0;
export const SHATTER_RESPAWN_SEC = 1.2;
export const FALL_Y_LIMIT = -5;
export const COURSE_FINISH_Z = 140;

export const STAR_THRESHOLDS = {
  three: { maxElapsedSec: 180, maxShatters: 2 },
  two: { maxElapsedSec: 300, maxShatters: 6 },
} as const;

export const COOKIE_REWARDS = {
  3: 50,
  2: 30,
  1: 15,
} as const;
