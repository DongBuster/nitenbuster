import { useCallback, useEffect, useRef } from 'react';
import type { LiftIntent, PlayerInput } from '../sim/types';

export interface UseGlassInputOptions {
  enabled: boolean;
  onEmote: (emoteId: number) => void;
}

const EMOTE_DEBOUNCE_MS = 400;

const EMOTE_KEY_TO_ID: Record<string, number> = {
  Digit1: 1,
  Digit2: 2,
  Digit3: 3,
  Digit4: 4,
};

function isFormTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement
  ) {
    return true;
  }
  return (
    target.closest('[contenteditable="true"], [contenteditable=""]') !== null
  );
}

function isInteractiveHudTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('button, input, textarea, select, a, [role="button"]') !==
      null
  );
}

/**
 * Keyboard & mouse input reader for Glass Carry Co-op.
 *
 * Right-handed 3D coordinate mapping (camera sits behind at `-Z` looking along `+Z`,
 * with `+Y` up): `forward × up = (0, 0, 1) × (0, 1, 0) = (-1, 0, 0)`, so:
 * - Screen-forward (`W` / `ArrowUp`)    -> `moveZ = +1` (toward finish at `+Z`)
 * - Screen-back    (`S` / `ArrowDown`)  -> `moveZ = -1` (toward camera at `-Z`)
 * - Screen-right   (`D` / `ArrowRight`) -> `moveX = -1`
 * - Screen-left    (`A` / `ArrowLeft`)  -> `moveX = +1`
 */
export function useGlassInput({
  enabled,
  onEmote,
}: UseGlassInputOptions): { readInput: () => PlayerInput } {
  const keysRef = useRef<Set<string>>(new Set());
  const mouseButtonsRef = useRef<Set<number>>(new Set());
  const lastEmoteAtRef = useRef<number>(0);

  const enabledRef = useRef<boolean>(enabled);
  enabledRef.current = enabled;

  const onEmoteRef = useRef<(emoteId: number) => void>(onEmote);
  onEmoteRef.current = onEmote;

  const clearInputs = useCallback(() => {
    keysRef.current.clear();
    mouseButtonsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!enabled) {
      clearInputs();
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current || isFormTarget(e.target)) return;

      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      const emoteId = EMOTE_KEY_TO_ID[e.code];
      if (emoteId !== undefined && !e.repeat) {
        const nowMs = performance.now();
        if (nowMs - lastEmoteAtRef.current >= EMOTE_DEBOUNCE_MS) {
          lastEmoteAtRef.current = nowMs;
          onEmoteRef.current(emoteId);
        }
      }

      keysRef.current.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      if (isInteractiveHudTarget(e.target)) return;
      if (e.button === 0 || e.button === 2) {
        mouseButtonsRef.current.add(e.button);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        mouseButtonsRef.current.delete(e.button);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      if (!isInteractiveHudTarget(e.target)) {
        e.preventDefault();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearInputs();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInputs();
    };
  }, [clearInputs, enabled]);

  const readInput = useCallback((): PlayerInput => {
    if (!enabledRef.current) {
      return { moveX: 0, moveZ: 0, jump: false, lift: 0 };
    }

    const keys = keysRef.current;
    const mouse = mouseButtonsRef.current;

    let moveX = 0;
    let moveZ = 0;

    if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) moveX -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX += 1;

    if (moveX !== 0 && moveZ !== 0) {
      const inv = 1 / Math.SQRT2;
      moveX *= inv;
      moveZ *= inv;
    }

    const jump = keys.has('Space');
    const liftUp = keys.has('KeyE') || mouse.has(0);
    const liftDown = keys.has('KeyQ') || mouse.has(2);
    const lift: LiftIntent =
      liftUp && !liftDown ? 1 : liftDown && !liftUp ? -1 : 0;

    return {
      moveX,
      moveZ,
      jump,
      lift,
    };
  }, []);

  return { readInput };
}
