export interface DpadDirections {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface DpadVector {
  x: number;
  y: number;
}

export const IDLE_DPAD_DIRECTIONS: DpadDirections = {
  up: false,
  down: false,
  left: false,
  right: false,
};

const DIAGONAL_TAN_THRESHOLD = Math.SQRT2 - 1; // tan(22.5 deg) ≈ 0.4142

/**
 * Converts a pointer offset from the D-pad center into 8-way cardinal/diagonal flags.
 */
export function computeDpadStateFromOffset(
  dx: number,
  dy: number,
  deadzonePx = 12,
): DpadDirections {
  if (Math.hypot(dx, dy) < deadzonePx) {
    return IDLE_DPAD_DIRECTIONS;
  }

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const activeX = absX > absY * DIAGONAL_TAN_THRESHOLD;
  const activeY = absY > absX * DIAGONAL_TAN_THRESHOLD;

  return {
    up: activeY && dy < 0,
    down: activeY && dy > 0,
    left: activeX && dx < 0,
    right: activeX && dx > 0,
  };
}

/**
 * Maps D-pad directional flags to a unit-clamped screen-space vector.
 */
export function dpadDirectionsToVector(dirs: DpadDirections): DpadVector {
  let x = (dirs.right ? 1 : 0) - (dirs.left ? 1 : 0);
  let y = (dirs.down ? 1 : 0) - (dirs.up ? 1 : 0);
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.SQRT2;
    x *= inv;
    y *= inv;
  }
  return { x, y };
}
