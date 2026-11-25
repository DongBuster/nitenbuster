import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Flame, Sparkles, Trophy } from 'lucide-react';
import type { BoardStageTheme } from '../engine/stages.ts';
import {
  computeRollDurationMs,
  interpolateScoreCounter,
  isBeatingBestScore,
  type ScorePulseEvent,
  type ScorePulseTier,
} from './scoreEffects.ts';

export interface ScoreHeaderCardProps {
  score: number;
  bestScore: number;
  streak: number;
  stageNumber: number;
  stageTheme: BoardStageTheme;
  pulse: ScorePulseEvent | null;
  reducedMotion: boolean;
}

const DELTA_BADGE_STYLES: Record<ScorePulseTier, string> = {
  normal: 'border-amber-300/60 bg-amber-500/20 text-amber-200',
  multi: 'border-sky-300/80 bg-sky-500/30 text-sky-100',
  combo: 'border-amber-200/90 bg-gradient-to-r from-amber-500/40 to-orange-500/40 text-amber-50',
  bomb: 'border-rose-300/85 bg-rose-500/35 text-rose-100',
  allClear:
    'border-yellow-200 bg-gradient-to-r from-amber-500/45 via-rose-500/40 to-violet-500/45 text-yellow-50',
};

const HALO_GLOW_TIERS = new Set<ScorePulseTier>([
  'multi',
  'combo',
  'bomb',
  'allClear',
]);

function readOsReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Tactile scoreboard mounted directly above the 8x8 Block Blast board with
 * ease-out score counter rolling, spring scale pop, floating +points delta,
 * and stage-tinted glow pulses.
 */
export function ScoreHeaderCard({
  score,
  bestScore,
  streak,
  stageNumber,
  stageTheme,
  pulse,
  reducedMotion,
}: ScoreHeaderCardProps) {
  const [osReducedMotion, setOsReducedMotion] = useState<boolean>(
    readOsReducedMotion,
  );
  const [displayedScore, setDisplayedScore] = useState<number>(score);
  const [visiblePulse, setVisiblePulse] = useState<ScorePulseEvent | null>(
    null,
  );

  const displayedRef = useRef<number>(score);
  const lastSeqRef = useRef<number>(0);
  const pulseRef = useRef<ScorePulseEvent | null>(pulse);
  pulseRef.current = pulse;

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => {
      setOsReducedMotion(event.matches);
    };
    setOsReducedMotion(mql.matches);
    mql.addEventListener('change', handleChange);
    return () => {
      mql.removeEventListener('change', handleChange);
    };
  }, []);

  const effectiveReducedMotion = reducedMotion || osReducedMotion;

  useEffect(() => {
    if (score === displayedRef.current) return;

    if (score < displayedRef.current || effectiveReducedMotion) {
      displayedRef.current = score;
      setDisplayedScore(score);
      return;
    }

    const startValue = displayedRef.current;
    const activeTier = pulseRef.current?.tier ?? 'normal';
    const durationMs = computeRollDurationMs(score - startValue, activeTier);
    if (durationMs <= 0) {
      displayedRef.current = score;
      setDisplayedScore(score);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const nextValue = interpolateScoreCounter(startValue, score, progress);
      if (nextValue !== displayedRef.current) {
        displayedRef.current = nextValue;
        setDisplayedScore(nextValue);
      }
      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [score, effectiveReducedMotion]);

  useEffect(() => {
    if (!pulse || pulse.points <= 0) {
      setVisiblePulse(null);
      return;
    }
    lastSeqRef.current = pulse.seq;
    setVisiblePulse(pulse);
    const timer = window.setTimeout(() => {
      setVisiblePulse(null);
    }, 920);
    return () => {
      window.clearTimeout(timer);
    };
  }, [pulse]);

  const motionFlagClass = reducedMotion ? ' bb-no-motion' : '';
  const beatingBest = isBeatingBestScore(score, bestScore);
  const showHalo =
    visiblePulse !== null && HALO_GLOW_TIERS.has(visiblePulse.tier);
  const haloStyle: CSSProperties | undefined = showHalo
    ? {
        borderColor:
          visiblePulse.tier === 'bomb' ? '#FB7185' : stageTheme.accentHex,
        boxShadow: `inset 0 0 18px ${
          visiblePulse.tier === 'bomb' ? '#FB7185' : stageTheme.accentHex
        }55, 0 0 22px ${
          visiblePulse.tier === 'bomb' ? '#FB7185' : stageTheme.accentHex
        }55`,
      }
    : undefined;

  return (
    <section
      aria-label="Bảng điểm hiện tại trên bàn cờ"
      className="relative w-full max-w-[492px] overflow-hidden rounded-2xl border-2 border-amber-500/35 bg-gradient-to-b from-[#2a1810] to-[#1e110b] px-3.5 py-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.45)] sm:rounded-3xl sm:px-4 sm:py-3"
    >
      {/* Compositor glow ring when clearing lines, combos, bombs, or all clear */}
      {showHalo && visiblePulse && (
        <span
          key={`halo-${visiblePulse.seq}`}
          aria-hidden="true"
          className={`bb-score-halo${motionFlagClass} pointer-events-none absolute inset-0 rounded-[inherit] border-2`}
          style={haloStyle}
        />
      )}

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300/80 sm:text-[11px]">
              Điểm Hiện Tại
            </span>
            {beatingBest ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-gradient-to-r from-amber-400 to-orange-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#24130a] shadow-sm">
                <Sparkles aria-hidden="true" className="h-2.5 w-2.5" />
                <span>New Best!</span>
              </span>
            ) : (
              bestScore > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-200/70 sm:text-[11px]">
                  <Trophy
                    aria-hidden="true"
                    className="h-3 w-3 text-amber-400/80"
                  />
                  <span className="tabular-nums">
                    {bestScore.toLocaleString('vi-VN')}đ
                  </span>
                </span>
              )
            )}
          </div>

          <div className="mt-0.5 flex items-baseline gap-2">
            <span
              key={lastSeqRef.current}
              data-tier={visiblePulse?.tier ?? 'normal'}
              className={`bb-score-pop${motionFlagClass}${
                visiblePulse ? ' is-active' : ''
              } font-display text-3xl font-black leading-none tracking-tight tabular-nums sm:text-4xl ${
                beatingBest ? 'text-amber-200' : 'text-amber-50'
              }`}
            >
              {displayedScore.toLocaleString('vi-VN')}
            </span>

            {visiblePulse && (
              <span
                key={`delta-${visiblePulse.seq}`}
                aria-hidden="true"
                className={`bb-score-delta${motionFlagClass} inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-black tracking-tight shadow-sm ${
                  DELTA_BADGE_STYLES[visiblePulse.tier]
                }`}
              >
                +{visiblePulse.points.toLocaleString('vi-VN')}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <div
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-black transition-colors sm:rounded-2xl ${
              streak > 0
                ? 'border-amber-300/60 bg-gradient-to-b from-amber-500/25 to-orange-500/20 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.2)]'
                : 'border-amber-900/50 bg-[#180e09] text-amber-200/65'
            }`}
          >
            <Flame
              aria-hidden="true"
              className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                streak > 0 ? 'text-amber-300' : 'text-amber-500/40'
              }`}
            />
            <span className="tabular-nums">Streak {streak}×</span>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-black transition-colors duration-500 sm:rounded-2xl sm:text-xs ${stageTheme.badgeClass}`}
          >
            <span>Stage {stageNumber}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
