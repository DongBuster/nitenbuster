import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Flame, Sparkles, Trophy } from 'lucide-react';
import type { BoardStageTheme } from '../engine/stages.ts';
import {
  buildScoreSparks,
  computeRollDurationMs,
  getStageScoreVisual,
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

type SparkStyleVars = CSSProperties & Record<'--bb-dx' | '--bb-dy', string>;

const STAR_CLIP_PATH =
  'polygon(50% 0%, 64% 36%, 100% 50%, 64% 64%, 50% 100%, 36% 64%, 0% 50%, 36% 36%)';

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
 * Stage-reactive scoreboard mounted above the 8x8 Block Blast board with
 * metallic/prism stage-colored digits, rolling ease-out counter, spring pop,
 * sweeping light beam, and radial starlight sparks on point gains.
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
  const [stageFlashSeq, setStageFlashSeq] = useState<number>(0);

  const displayedRef = useRef<number>(score);
  const lastSeqRef = useRef<number>(0);
  const prevStageRef = useRef<number>(stageNumber);
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

  useEffect(() => {
    if (stageNumber > prevStageRef.current) {
      setStageFlashSeq((seq) => seq + 1);
    }
    prevStageRef.current = stageNumber;
  }, [stageNumber]);

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

  const stageVisual = getStageScoreVisual(stageTheme.id);
  const motionFlagClass = reducedMotion ? ' bb-no-motion' : '';
  const beatingBest = isBeatingBestScore(score, bestScore);
  const showHalo =
    visiblePulse !== null && HALO_GLOW_TIERS.has(visiblePulse.tier);
  const showShimmer = streak >= 2 || stageTheme.tier >= 4 || beatingBest;

  const sparks = useMemo(
    () =>
      visiblePulse
        ? buildScoreSparks(
            visiblePulse.tier,
            visiblePulse.points,
            stageTheme.id,
          )
        : [],
    [stageTheme.id, visiblePulse],
  );

  const haloStyle: CSSProperties | undefined = showHalo
    ? {
        borderColor: stageTheme.accentHex,
        boxShadow: `inset 0 0 22px ${stageTheme.accentHex}66, 0 0 26px ${stageTheme.accentHex}66`,
      }
    : undefined;

  const digitStyle: CSSProperties = {
    backgroundImage: stageVisual.digitGradient,
    filter: stageVisual.digitGlow,
  };

  const deltaStyle: CSSProperties = {
    borderColor: `${stageTheme.sweepColorHex}CC`,
    backgroundColor: `${stageTheme.accentHex}33`,
    color: '#FFFFFF',
    boxShadow: `0 0 12px ${stageTheme.accentHex}66`,
  };

  const beamKey =
    showHalo && visiblePulse
      ? `beam-pulse-${visiblePulse.seq}`
      : stageFlashSeq > 0
        ? `beam-stage-${stageFlashSeq}`
        : null;

  return (
    <section
      aria-label="Bảng điểm hiện tại trên bàn cờ"
      className={`relative w-full max-w-[492px] overflow-hidden rounded-2xl border-2 px-3.5 py-2.5 transition-[background,border-color,box-shadow] duration-500 sm:rounded-3xl sm:px-4 sm:py-3 ${stageVisual.cardClass}`}
    >
      {/* Compositor glow ring when clearing lines, combos, or All Clear */}
      {showHalo && visiblePulse && (
        <span
          key={`halo-${visiblePulse.seq}`}
          aria-hidden="true"
          className={`bb-score-halo${motionFlagClass} pointer-events-none absolute inset-0 rounded-[inherit] border-2`}
          style={haloStyle}
        />
      )}

      {/* Diagonal light beam sweep on big clears or Stage Up */}
      {beamKey && (
        <span
          key={beamKey}
          aria-hidden="true"
          className={`bb-score-beam${motionFlagClass} pointer-events-none absolute inset-y-0 left-0 w-2/3`}
          style={{ background: stageVisual.beamGradient }}
        />
      )}

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wider transition-colors duration-500 sm:text-[11px] ${stageVisual.labelClass}`}
            >
              Điểm Hiện Tại
            </span>
            {beatingBest ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-yellow-200/80 bg-gradient-to-r from-amber-400 to-orange-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#24130a] shadow-sm">
                <Sparkles aria-hidden="true" className="h-2.5 w-2.5" />
                <span>New Best!</span>
              </span>
            ) : (
              bestScore > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/75 sm:text-[11px]">
                  <Trophy
                    aria-hidden="true"
                    className="h-3 w-3"
                    style={{ color: stageTheme.accentHex }}
                  />
                  <span className="tabular-nums">
                    {bestScore.toLocaleString('vi-VN')}đ
                  </span>
                </span>
              )
            )}
          </div>

          <div className="mt-0.5 flex items-baseline gap-2.5">
            <div className="relative inline-flex items-baseline">
              {/* Radial starlight sparks bursting around the score digits */}
              {visiblePulse && sparks.length > 0 && (
                <span
                  key={`sparks-${visiblePulse.seq}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 overflow-visible"
                >
                  {sparks.map((spark) => {
                    const style: SparkStyleVars = {
                      left: '50%',
                      top: '50%',
                      width: `${spark.sizePx}px`,
                      height: `${spark.sizePx}px`,
                      backgroundColor: spark.colorHex,
                      boxShadow: `0 0 8px ${spark.colorHex}`,
                      animationDelay: `${spark.delayMs}ms`,
                      borderRadius: spark.star ? '0px' : '999px',
                      clipPath: spark.star ? STAR_CLIP_PATH : undefined,
                      '--bb-dx': `${spark.dx}px`,
                      '--bb-dy': `${spark.dy}px`,
                    };
                    return (
                      <span
                        key={spark.id}
                        className={`bb-score-spark${motionFlagClass} absolute`}
                        style={style}
                      />
                    );
                  })}
                </span>
              )}

              <span
                key={lastSeqRef.current}
                data-tier={visiblePulse?.tier ?? 'normal'}
                className={`bb-score-digits bb-score-pop${motionFlagClass}${
                  visiblePulse ? ' is-active' : ''
                }${
                  showShimmer ? ` bb-score-shimmer${motionFlagClass}` : ''
                } relative z-10 font-display text-3xl font-black leading-none tracking-tight tabular-nums sm:text-4xl`}
                style={digitStyle}
              >
                {displayedScore.toLocaleString('vi-VN')}
              </span>
            </div>

            {visiblePulse && (
              <span
                key={`delta-${visiblePulse.seq}`}
                aria-hidden="true"
                className={`bb-score-delta${motionFlagClass} inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-black tracking-tight`}
                style={deltaStyle}
              >
                +{visiblePulse.points.toLocaleString('vi-VN')}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <div
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-black transition-all duration-300 sm:rounded-2xl ${
              streak > 0
                ? stageVisual.streakActiveClass
                : 'border-white/10 bg-black/30 text-white/60'
            }`}
          >
            <Flame
              aria-hidden="true"
              className="h-3.5 w-3.5 sm:h-4 sm:w-4"
              style={{
                color: streak > 0 ? stageTheme.sweepColorHex : 'rgba(255,255,255,0.35)',
              }}
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
