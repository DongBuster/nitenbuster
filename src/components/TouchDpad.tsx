import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import {
  IDLE_DPAD_DIRECTIONS,
  computeDpadStateFromOffset,
  dpadDirectionsToVector,
  type DpadDirections,
  type DpadVector,
} from './dpadMath';

export interface TouchDpadProps {
  enabled: boolean;
  onChange: (vec: DpadVector, dirs: DpadDirections) => void;
  accent?: 'amber' | 'cyan' | 'emerald';
  className?: string;
}

const ACCENT_STYLES: Record<
  NonNullable<TouchDpadProps['accent']>,
  { ring: string; activePad: string; idlePad: string }
> = {
  amber: {
    ring: 'border-amber-300/30 bg-slate-950/65',
    activePad:
      'border-amber-300 bg-amber-400/35 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.45)]',
    idlePad: 'border-white/20 bg-slate-900/85 text-amber-100/90',
  },
  cyan: {
    ring: 'border-cyan-300/35 bg-[#081526]/70',
    activePad:
      'border-cyan-300 bg-cyan-400/35 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.45)]',
    idlePad: 'border-cyan-300/25 bg-[#0e1e33]/90 text-cyan-100/90',
  },
  emerald: {
    ring: 'border-emerald-300/35 bg-slate-950/70',
    activePad:
      'border-emerald-300 bg-emerald-400/35 text-emerald-50 shadow-[0_0_16px_rgba(52,211,153,0.45)]',
    idlePad: 'border-white/20 bg-slate-900/85 text-emerald-100/90',
  },
};

function dirsEqual(a: DpadDirections, b: DpadDirections): boolean {
  return (
    a.up === b.up &&
    a.down === b.down &&
    a.left === b.left &&
    a.right === b.right
  );
}

/**
 * Tablet 4-way (with diagonal slide support) virtual D-pad for WASD movement.
 * Uses pointer capture on the pad container so thumbs can glide smoothly between
 * cardinal and diagonal directions without dropping input.
 */
export function TouchDpad({
  enabled,
  onChange,
  accent = 'amber',
  className = '',
}: TouchDpadProps) {
  const [dirs, setDirs] = useState<DpadDirections>(IDLE_DPAD_DIRECTIONS);
  const dirsRef = useRef<DpadDirections>(IDLE_DPAD_DIRECTIONS);
  const pointerIdRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const commitDirs = useCallback((next: DpadDirections) => {
    if (dirsEqual(dirsRef.current, next)) return;
    dirsRef.current = next;
    setDirs(next);
    onChangeRef.current(dpadDirectionsToVector(next), next);
  }, []);

  const resetDpad = useCallback(() => {
    pointerIdRef.current = null;
    commitDirs(IDLE_DPAD_DIRECTIONS);
  }, [commitDirs]);

  useEffect(() => {
    if (!enabled) {
      resetDpad();
    }
  }, [enabled, resetDpad]);

  useEffect(() => {
    const onBlur = () => resetDpad();
    const onVisibility = () => {
      if (document.hidden) resetDpad();
    };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      resetDpad();
    };
  }, [resetDpad]);

  const updateFromPointer = (
    el: HTMLDivElement,
    clientX: number,
    clientY: number,
  ) => {
    const rect = el.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width * 0.5);
    const dy = clientY - (rect.top + rect.height * 0.5);
    commitDirs(computeDpadStateFromOffset(dx, dy));
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!enabled) return;
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e.currentTarget, e.clientX, e.clientY);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    if (!enabled) {
      resetDpad();
      return;
    }
    updateFromPointer(e.currentTarget, e.clientX, e.clientY);
  };

  const handlePointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    resetDpad();
  };

  const theme = ACCENT_STYLES[accent];
  const padBase =
    'pointer-events-none flex h-12 w-12 items-center justify-center rounded-2xl border-2 transition-colors duration-75 motion-reduce:transition-none';

  return (
    <div
      data-brawl-ui="true"
      role="group"
      aria-label="Phím di chuyển D-pad"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      className={`pointer-events-auto grid h-[156px] w-[156px] touch-none select-none grid-cols-3 grid-rows-3 place-items-center gap-1 rounded-full border p-2 shadow-2xl backdrop-blur-md ${theme.ring} ${
        enabled ? '' : 'opacity-45'
      } ${className}`}
    >
      {/* Row 1: Up (W) */}
      <div />
      <div
        aria-hidden="true"
        className={`${padBase} ${dirs.up ? theme.activePad : theme.idlePad}`}
      >
        <ChevronUp className="h-6 w-6" />
      </div>
      <div />

      {/* Row 2: Left (A) - Center - Right (D) */}
      <div
        aria-hidden="true"
        className={`${padBase} ${dirs.left ? theme.activePad : theme.idlePad}`}
      >
        <ChevronLeft className="h-6 w-6" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-[9px] font-black tracking-tighter text-white/55"
      >
        WASD
      </div>
      <div
        aria-hidden="true"
        className={`${padBase} ${dirs.right ? theme.activePad : theme.idlePad}`}
      >
        <ChevronRight className="h-6 w-6" />
      </div>

      {/* Row 3: Down (S) */}
      <div />
      <div
        aria-hidden="true"
        className={`${padBase} ${dirs.down ? theme.activePad : theme.idlePad}`}
      >
        <ChevronDown className="h-6 w-6" />
      </div>
      <div />
    </div>
  );
}
