export const HEX_RADIUS = 1.65;
export const HEX_GAP = 0.08;
export const HEX_HEIGHT = 0.65;
export const ARENA_RINGS = 4;
export const FALL_OUT_Y = -5.0;

export const TOTAL_ROUNDS = 3;
export const ROUND_POINTS = [3, 2, 1] as const;

export const RING_SCHEDULE: Record<number, { warnAt: number; collapseAt: number }> = {
  4: { warnAt: 30, collapseAt: 32 },
  3: { warnAt: 42, collapseAt: 44 },
  2: { warnAt: 54, collapseAt: 56 },
  1: { warnAt: 66, collapseAt: 68 },
};

export const SUDDEN_DEATH_START_SEC = 82;
export const SUDDEN_DEATH_INTERVAL_SEC = 4.0;

export const MOVE_SPEED = 4.3;
export const SPRINT_MULTIPLIER = 1.28;
export const SKATES_MULTIPLIER = 1.35;
export const JUMP_VELOCITY = 6.6;
export const GRAVITY = -24;
export const ROLL_SPEED = 8.6;
export const ROLL_DURATION = 0.28;
export const ROLL_COOLDOWN = 1.5;

export const MAX_BALANCE = 100;
export const BALANCE_REGEN_PER_SEC = 8.5;

export const PUNCH_RANGE = 1.85;
export const PUNCH_ARC_COS = 0.2;
export const PUNCH_COOLDOWN = 0.42;
export const PUNCH_KNOCKBACK = 5.4;
export const PUNCH_UP_BOOST = 2.0;
export const PUNCH_BALANCE_DMG = 34;
export const PUNCH_LUNGE_SPEED = 3.2;

export const HEADBUTT_RANGE = 1.95;
export const HEADBUTT_DURATION = 0.34;
export const HEADBUTT_COOLDOWN = 1.15;
export const HEADBUTT_LUNGE_SPEED = 7.8;
export const HEADBUTT_KNOCKBACK = 7.5;
export const HEADBUTT_UP_BOOST = 2.6;
export const HEADBUTT_BALANCE_DMG = 46;

export const DROPKICK_RANGE = 1.85;
export const DROPKICK_DURATION = 0.5;
export const DROPKICK_SLIDE_DURATION = 0.28;
export const DROPKICK_COOLDOWN = 0.95;
export const DROPKICK_SPEED = 9.4;
export const DROPKICK_KNOCKBACK = 9.2;
export const DROPKICK_UP_BOOST = 3.3;
export const DROPKICK_BALANCE_DMG = 58;

export const WAKEUP_ANIM_SEC = 0.38;

export const SHOVEL_RANGE = 2.65;
export const SHOVEL_KNOCKBACK = 8.2;
export const SHOVEL_UP_BOOST = 2.8;
export const SHOVEL_BALANCE_DMG = 50;
export const SHOVEL_AMMO = 4;

export const SNOWBALL_SPEED = 16;
export const SNOWBALL_KNOCKBACK = 5.8;
export const SNOWBALL_BALANCE_DMG = 34;
export const SNOWBALL_AMMO = 3;

export const BOMB_FUSE_SEC = 2.0;
export const BOMB_RADIUS = 4.4;
export const BOMB_KNOCKBACK = 10.5;
export const BOMB_UP_BOOST = 3.8;
export const BOMB_BALANCE_DMG = 68;

export const GRAB_RANGE = 1.8;
export const GRAB_MAX_DURATION = 2.6;
export const THROW_IMPULSE = 8.2;
export const THROW_UP_IMPULSE = 3.6;

export const STUN_BASE_SEC = 1.3;
export const STUN_MAX_SEC = 1.9;
export const WAKEUP_IMMUNITY_SEC = 1.25;
export const SHIELD_KNOCKBACK_MULT = 0.35;
export const SHIELD_DURATION = 5.0;
export const SKATES_DURATION = 6.0;

export const CARD_FREEZE_RANGE = 6.5;
export const CARD_FREEZE_SEC = 2.0;
export const CARD_TASER_RADIUS = 4.0;
export const CARD_TASER_STUN_SEC = 2.2;
export const CARD_BOOMERANG_RANGE = 9.0;
export const CARD_BOOMERANG_SEC = 5.0;

export const HIT_STOP_SEC = 0.06;
export const ITEM_SPAWN_INTERVAL_SEC = 4.5;
export const MAX_WORLD_ITEMS = 7;

export const BOT_ANIMAL_TITLES: Record<string, string> = {
  dog: 'Corgi Lửa',
  cat: 'Mèo Xám',
  duck: 'Vịt Vàng',
  shark: 'Cá Mập',
  dino: 'Khủng Long',
  panda: 'Gấu Panda',
  chicken: 'Gà Trắng',
  bunny: 'Thỏ Hồng',
};

export const BRAWL_ANIMAL_EMOJI: Record<string, string> = {
  dog: '🐶',
  cat: '🐱',
  duck: '🦆',
  shark: '🦈',
  dino: '🦖',
  panda: '🐼',
  chicken: '🐔',
  bunny: '🐰',
};
