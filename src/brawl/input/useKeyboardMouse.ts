import { useCallback, useEffect, useRef, useState } from 'react';
import type { EmoteKind, FighterInput, PressedSkillState } from '../sim/types';

const IDLE_SKILLS: PressedSkillState = {
  punch: false,
  headbutt: false,
  grab: false,
  roll: false,
  jump: false,
  sprint: false,
};

function mapCodeToSkill(code: string): keyof PressedSkillState | null {
  switch (code) {
    case 'KeyJ':
      return 'punch';
    case 'KeyE':
    case 'KeyH':
      return 'headbutt';
    case 'KeyK':
      return 'grab';
    case 'KeyL':
      return 'roll';
    case 'Space':
      return 'jump';
    case 'ShiftLeft':
    case 'ShiftRight':
      return 'sprint';
    default:
      return null;
  }
}

export function useKeyboardMouse(enabled: boolean) {
  const keysRef = useRef<Set<string>>(new Set());
  const jumpBufferedUntilRef = useRef<number>(0);
  const punchQueuedRef = useRef<boolean>(false);
  const headbuttQueuedRef = useRef<boolean>(false);
  const rollQueuedRef = useRef<boolean>(false);
  const emoteQueuedRef = useRef<EmoteKind | null>(null);
  const virtualGrabRef = useRef<boolean>(false);
  const virtualSprintRef = useRef<boolean>(false);
  const pulseTimersRef = useRef<Partial<Record<keyof PressedSkillState, number>>>({});
  const enabledRef = useRef<boolean>(enabled);
  enabledRef.current = enabled;

  const [pressedSkills, setPressedSkills] = useState<PressedSkillState>(IDLE_SKILLS);

  const setSkillVisual = useCallback(
    (skill: keyof PressedSkillState, active: boolean) => {
      setPressedSkills((prev) =>
        prev[skill] === active ? prev : { ...prev, [skill]: active },
      );
    },
    [],
  );

  const pulseSkillVisual = useCallback(
    (skill: keyof PressedSkillState) => {
      setSkillVisual(skill, true);
      const prevTimer = pulseTimersRef.current[skill];
      if (prevTimer !== undefined) {
        window.clearTimeout(prevTimer);
      }
      pulseTimersRef.current[skill] = window.setTimeout(() => {
        delete pulseTimersRef.current[skill];
        setSkillVisual(skill, false);
      }, 140);
    },
    [setSkillVisual],
  );

  const resetAll = useCallback(() => {
    keysRef.current.clear();
    jumpBufferedUntilRef.current = 0;
    punchQueuedRef.current = false;
    headbuttQueuedRef.current = false;
    rollQueuedRef.current = false;
    emoteQueuedRef.current = null;
    virtualGrabRef.current = false;
    virtualSprintRef.current = false;
    for (const timer of Object.values(pulseTimersRef.current)) {
      if (timer !== undefined) window.clearTimeout(timer);
    }
    pulseTimersRef.current = {};
    setPressedSkills(IDLE_SKILLS);
  }, []);

  const triggerSkill = useCallback(
    (skill: 'punch' | 'headbutt' | 'roll' | 'jump') => {
      if (!enabledRef.current) return;
      if (skill === 'jump') {
        jumpBufferedUntilRef.current = performance.now() + 130;
      } else if (skill === 'punch') {
        punchQueuedRef.current = true;
      } else if (skill === 'headbutt') {
        headbuttQueuedRef.current = true;
      } else if (skill === 'roll') {
        rollQueuedRef.current = true;
      }
      pulseSkillVisual(skill);
    },
    [pulseSkillVisual],
  );

  const setVirtualHold = useCallback(
    (skill: 'grab' | 'sprint', held: boolean) => {
      if (!enabledRef.current && held) return;
      if (skill === 'grab') {
        virtualGrabRef.current = held;
        setSkillVisual('grab', held || keysRef.current.has('KeyK'));
      } else {
        virtualSprintRef.current = held;
        setSkillVisual(
          'sprint',
          held ||
            keysRef.current.has('ShiftLeft') ||
            keysRef.current.has('ShiftRight'),
        );
      }
    },
    [setSkillVisual],
  );

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

        const skill = mapCodeToSkill(e.code);
        if (skill) setSkillVisual(skill, true);
      }

      keysRef.current.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
      const skill = mapCodeToSkill(e.code);
      if (!skill) return;

      if (skill === 'sprint') {
        setSkillVisual(
          'sprint',
          virtualSprintRef.current ||
            keysRef.current.has('ShiftLeft') ||
            keysRef.current.has('ShiftRight'),
        );
      } else if (skill === 'grab') {
        setSkillVisual('grab', virtualGrabRef.current);
      } else {
        setSkillVisual(skill, false);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, a, input, [data-brawl-ui]')) {
        return;
      }
      if (e.button === 0) {
        punchQueuedRef.current = true;
        pulseSkillVisual('punch');
      } else if (e.button === 2) {
        headbuttQueuedRef.current = true;
        pulseSkillVisual('headbutt');
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, a, input, [data-brawl-ui]')) {
        return;
      }
      e.preventDefault();
    };

    const onVisibility = () => {
      if (document.hidden) resetAll();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', resetAll);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', resetAll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, pulseSkillVisual, resetAll, setSkillVisual]);

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

    const grabHeld = keys.has('KeyK') || virtualGrabRef.current;
    const sprint =
      keys.has('ShiftLeft') ||
      keys.has('ShiftRight') ||
      virtualSprintRef.current;

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

  return { consumeInput, pressedSkills, triggerSkill, setVirtualHold };
}
