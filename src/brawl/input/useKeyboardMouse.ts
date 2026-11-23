import { useCallback, useEffect, useRef } from 'react';
import type { EmoteKind, FighterInput } from '../sim/types';

export function useKeyboardMouse(enabled: boolean) {
  const keysRef = useRef<Set<string>>(new Set());
  const jumpBufferedUntilRef = useRef<number>(0);
  const punchQueuedRef = useRef<boolean>(false);
  const headbuttQueuedRef = useRef<boolean>(false);
  const rollQueuedRef = useRef<boolean>(false);
  const emoteQueuedRef = useRef<EmoteKind | null>(null);
  const mouseDownRef = useRef<boolean>(false);

  const resetAll = useCallback(() => {
    keysRef.current.clear();
    jumpBufferedUntilRef.current = 0;
    punchQueuedRef.current = false;
    headbuttQueuedRef.current = false;
    rollQueuedRef.current = false;
    emoteQueuedRef.current = null;
    mouseDownRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled) {
      resetAll();
      return;
    }

    const isFormTarget = (target: EventTarget | null) =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isFormTarget(e.target)) return;

      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      if (!e.repeat) {
        if (e.code === 'Space') {
          jumpBufferedUntilRef.current = performance.now() + 130;
        } else if (e.code === 'KeyJ') {
          punchQueuedRef.current = true;
        } else if (e.code === 'KeyE' || e.code === 'KeyH') {
          headbuttQueuedRef.current = true;
        } else if (e.code === 'KeyL') {
          rollQueuedRef.current = true;
        } else if (e.code === 'Digit1') {
          emoteQueuedRef.current = 'wave';
        } else if (e.code === 'Digit2') {
          emoteQueuedRef.current = 'dance';
        } else if (e.code === 'Digit3') {
          emoteQueuedRef.current = 'taunt';
        } else if (e.code === 'Digit4') {
          emoteQueuedRef.current = 'cheer';
        }
      }

      keysRef.current.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, a, input, [data-brawl-ui]')) {
        return;
      }
      if (e.button === 0) {
        mouseDownRef.current = true;
        punchQueuedRef.current = true;
      } else if (e.button === 2) {
        headbuttQueuedRef.current = true;
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, a, input, [data-brawl-ui]')) {
        return;
      }
      e.preventDefault();
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        mouseDownRef.current = false;
      }
    };

    const onVisibility = () => {
      if (document.hidden) resetAll();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', resetAll);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', resetAll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, resetAll]);

  const consumeInput = useCallback((): FighterInput => {
    const keys = keysRef.current;
    let moveX = 0;
    let moveZ = 0;

    if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;

    if (moveX !== 0 && moveZ !== 0) {
      const inv = 1 / Math.SQRT2;
      moveX *= inv;
      moveZ *= inv;
    }

    const nowMs = performance.now();
    const jump = nowMs <= jumpBufferedUntilRef.current;
    if (jump) {
      jumpBufferedUntilRef.current = 0;
    }

    const punch = punchQueuedRef.current;
    punchQueuedRef.current = false;

    const headbutt = headbuttQueuedRef.current;
    headbuttQueuedRef.current = false;

    const roll = rollQueuedRef.current;
    rollQueuedRef.current = false;

    const emote = emoteQueuedRef.current;
    emoteQueuedRef.current = null;

    const grabHeld = keys.has('KeyK');
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');

    return {
      moveX,
      moveZ,
      sprint,
      jump,
      punch,
      headbutt,
      grabHeld,
      roll,
      emote,
    };
  }, []);

  return { consumeInput };
}
