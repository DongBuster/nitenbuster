import type { LiftIntent, PlayerInput } from '../sim/types.ts';

export type CoopVirtualSkillKey =
  | 'liftUp'
  | 'liftDown'
  | 'jump'
  | 'moveLeft'
  | 'moveRight'
  | 'moveForward'
  | 'moveBackward';

export interface CoopPressedState {
  liftUp: boolean;
  liftDown: boolean;
  jump: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  moveForward: boolean;
  moveBackward: boolean;
}

const ALL_KEYS: readonly CoopVirtualSkillKey[] = [
  'liftUp',
  'liftDown',
  'jump',
  'moveLeft',
  'moveRight',
  'moveForward',
  'moveBackward',
];

const EMPTY_PRESSED: CoopPressedState = {
  liftUp: false,
  liftDown: false,
  jump: false,
  moveLeft: false,
  moveRight: false,
  moveForward: false,
  moveBackward: false,
};

const virtualHolds: CoopPressedState = { ...EMPTY_PRESSED };
const virtualPulseUntil: Record<CoopVirtualSkillKey, number> = {
  liftUp: 0,
  liftDown: 0,
  jump: 0,
  moveLeft: 0,
  moveRight: 0,
  moveForward: 0,
  moveBackward: 0,
};
const keyboardMirror: CoopPressedState = { ...EMPTY_PRESSED };

let lastNotified: CoopPressedState = { ...EMPTY_PRESSED };
const listeners = new Set<(state: CoopPressedState) => void>();
const pulseExpireTimers: Partial<
  Record<CoopVirtualSkillKey, ReturnType<typeof setTimeout>>
> = {};

function getNowMs(overrideMs?: number): number {
  if (overrideMs !== undefined) return overrideMs;
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function isVirtualKeyActive(key: CoopVirtualSkillKey, nowMs: number): boolean {
  return virtualHolds[key] || virtualPulseUntil[key] > nowMs;
}

function statesEqual(a: CoopPressedState, b: CoopPressedState): boolean {
  return (
    a.liftUp === b.liftUp &&
    a.liftDown === b.liftDown &&
    a.jump === b.jump &&
    a.moveLeft === b.moveLeft &&
    a.moveRight === b.moveRight &&
    a.moveForward === b.moveForward &&
    a.moveBackward === b.moveBackward
  );
}

function computeCombined(nowMs: number): CoopPressedState {
  return {
    liftUp: keyboardMirror.liftUp || isVirtualKeyActive('liftUp', nowMs),
    liftDown: keyboardMirror.liftDown || isVirtualKeyActive('liftDown', nowMs),
    jump: keyboardMirror.jump || isVirtualKeyActive('jump', nowMs),
    moveLeft: keyboardMirror.moveLeft || isVirtualKeyActive('moveLeft', nowMs),
    moveRight:
      keyboardMirror.moveRight || isVirtualKeyActive('moveRight', nowMs),
    moveForward:
      keyboardMirror.moveForward || isVirtualKeyActive('moveForward', nowMs),
    moveBackward:
      keyboardMirror.moveBackward || isVirtualKeyActive('moveBackward', nowMs),
  };
}

function emitIfChanged(nowMs?: number): void {
  const next = computeCombined(getNowMs(nowMs));
  if (statesEqual(next, lastNotified)) return;
  lastNotified = next;
  listeners.forEach((fn) => fn(next));
}

export function setVirtualHold(
  key: CoopVirtualSkillKey,
  held: boolean,
  nowMs?: number,
): void {
  if (virtualHolds[key] === held) return;
  virtualHolds[key] = held;
  emitIfChanged(nowMs);
}

export function setVirtualMoveDpad(
  dirs: { up: boolean; down: boolean; left: boolean; right: boolean },
  nowMs?: number,
): void {
  if (
    virtualHolds.moveForward === dirs.up &&
    virtualHolds.moveBackward === dirs.down &&
    virtualHolds.moveLeft === dirs.left &&
    virtualHolds.moveRight === dirs.right
  ) {
    return;
  }
  virtualHolds.moveForward = dirs.up;
  virtualHolds.moveBackward = dirs.down;
  virtualHolds.moveLeft = dirs.left;
  virtualHolds.moveRight = dirs.right;
  emitIfChanged(nowMs);
}

export function triggerVirtualPulse(
  key: CoopVirtualSkillKey,
  durationMs = 130,
  nowMs?: number,
): void {
  const currentNow = getNowMs(nowMs);
  virtualPulseUntil[key] = Math.max(
    virtualPulseUntil[key],
    currentNow + Math.max(16, durationMs),
  );
  emitIfChanged(currentNow);

  if (nowMs === undefined && typeof setTimeout === 'function') {
    const prevTimer = pulseExpireTimers[key];
    if (prevTimer !== undefined) {
      clearTimeout(prevTimer);
    }
    pulseExpireTimers[key] = setTimeout(() => {
      delete pulseExpireTimers[key];
      emitIfChanged();
    }, durationMs + 16);
  }
}

export function clearAllVirtualInputs(nowMs?: number): void {
  for (const key of ALL_KEYS) {
    virtualHolds[key] = false;
    virtualPulseUntil[key] = 0;
    const prevTimer = pulseExpireTimers[key];
    if (prevTimer !== undefined) {
      clearTimeout(prevTimer);
      delete pulseExpireTimers[key];
    }
  }
  emitIfChanged(nowMs);
}

export function setKeyboardPressedMirror(
  next: CoopPressedState,
  nowMs?: number,
): void {
  if (statesEqual(next, keyboardMirror)) return;
  keyboardMirror.liftUp = next.liftUp;
  keyboardMirror.liftDown = next.liftDown;
  keyboardMirror.jump = next.jump;
  keyboardMirror.moveLeft = next.moveLeft;
  keyboardMirror.moveRight = next.moveRight;
  keyboardMirror.moveForward = next.moveForward;
  keyboardMirror.moveBackward = next.moveBackward;
  emitIfChanged(nowMs);
}

export function getCombinedPressedState(nowMs?: number): CoopPressedState {
  return computeCombined(getNowMs(nowMs));
}

export function readVirtualInput(nowMs?: number): PlayerInput {
  const currentNow = getNowMs(nowMs);
  const left = isVirtualKeyActive('moveLeft', currentNow);
  const right = isVirtualKeyActive('moveRight', currentNow);
  const forward = isVirtualKeyActive('moveForward', currentNow);
  const backward = isVirtualKeyActive('moveBackward', currentNow);
  const moveX = (left ? 1 : 0) + (right ? -1 : 0);
  const moveZ = (forward ? 1 : 0) + (backward ? -1 : 0);
  const jump = isVirtualKeyActive('jump', currentNow);
  const liftUp = isVirtualKeyActive('liftUp', currentNow);
  const liftDown = isVirtualKeyActive('liftDown', currentNow);
  const lift: LiftIntent =
    liftUp && !liftDown ? 1 : liftDown && !liftUp ? -1 : 0;

  return {
    moveX,
    moveZ,
    jump,
    lift,
  };
}

export function subscribePressedState(
  listener: (state: CoopPressedState) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
