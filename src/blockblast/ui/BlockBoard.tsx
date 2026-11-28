import { Fragment, memo, useMemo, type CSSProperties, type RefObject } from 'react';
import { Crosshair } from 'lucide-react';
import {
  BOARD_SIZE,
  type Grid,
  type PlacementPreview,
} from '../engine/types.ts';
import {
  resolveStageColorToken,
  type BoardStageTheme,
} from '../engine/stages.ts';
import { StageFrameOrnaments } from './StageFrameOrnaments.tsx';

export interface BurstParticle {
  id: string;
  dx: number;
  dy: number;
  rot: number;
  colorHex: string;
  sizePx: number;
  star?: boolean;
  originXPct?: number;
  originYPct?: number;
}

export interface BurstCallout {
  title: string;
  subtitle?: string;
  tier: 'normal' | 'multi' | 'combo' | 'bomb' | 'allClear';
}

export interface BurstEffect {
  id: string;
  cells: readonly { r: number; c: number }[];
  colorHex: string;
  label?: string;
  xPct: number;
  yPct: number;
  kind: 'clear' | 'bomb';
  clearedRows?: readonly number[];
  clearedCols?: readonly number[];
  particles?: readonly BurstParticle[];
  shockwaveCount?: number;
  callout?: BurstCallout;
  isAllClear?: boolean;
}

export interface BlockBoardProps {
  boardRef: RefObject<HTMLDivElement | null>;
  grid: Grid;
  preview: PlacementPreview | null;
  bombHoverCell: { r: number; c: number } | null;
  bombAiming: boolean;
  colorblindMode: boolean;
  reducedMotion: boolean;
  bursts: readonly BurstEffect[];
  stageTheme: BoardStageTheme;
  boardShake?: 'none' | 'sm' | 'lg';
  recentPlacedCells?: readonly { r: number; c: number }[];
  onBoardCellClick?: (r: number, c: number) => void;
  onBoardPointerMove?: (clientX: number, clientY: number) => void;
  onBoardPointerLeave?: () => void;
}

type ParticleStyleVars = CSSProperties &
  Record<'--bb-dx' | '--bb-dy' | '--bb-rot', string>;

const STAR_CLIP_PATH =
  'polygon(50% 0%, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0% 50%, 38% 38%)';

const BOMB_AIMING_FRAME_STYLE: CSSProperties = {
  borderColor: 'rgba(251, 113, 133, 0.85)',
  boxShadow:
    '0 18px 40px rgba(0, 0, 0, 0.58), 0 0 26px rgba(244, 63, 94, 0.3)',
};

const CALLOUT_TIER_STYLES: Record<
  Exclude<BurstCallout['tier'], 'normal'>,
  {
    boxClass: string;
    titleClass: string;
    subtitleClass: string;
  }
> = {
  multi: {
    boxClass:
      'border-sky-200/90 bg-gradient-to-b from-sky-500/95 via-blue-600/95 to-indigo-800/95 shadow-[0_10px_28px_rgba(14,165,233,0.5),0_0_20px_rgba(56,189,248,0.45)]',
    titleClass:
      'text-sm text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)] sm:text-lg',
    subtitleClass: 'text-sky-100',
  },
  combo: {
    boxClass:
      'border-amber-200/95 bg-gradient-to-b from-amber-500/95 via-orange-600/95 to-rose-700/95 shadow-[0_10px_30px_rgba(245,158,11,0.55),0_0_24px_rgba(251,191,36,0.55)]',
    titleClass:
      'text-sm text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] sm:text-lg',
    subtitleClass: 'text-amber-100',
  },
  bomb: {
    boxClass:
      'border-rose-200/95 bg-gradient-to-b from-rose-500/95 via-fuchsia-600/95 to-rose-900/95 shadow-[0_10px_30px_rgba(244,63,94,0.55),0_0_24px_rgba(251,113,133,0.55)]',
    titleClass:
      'text-sm text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] sm:text-lg',
    subtitleClass: 'text-rose-100',
  },
  allClear: {
    boxClass:
      'border-yellow-200 bg-gradient-to-b from-amber-500 via-rose-600 to-violet-800 ring-2 ring-amber-100/75 shadow-[0_14px_40px_rgba(250,204,21,0.65),0_0_32px_rgba(244,114,182,0.55)]',
    titleClass:
      'text-base text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)] sm:text-xl',
    subtitleClass: 'text-yellow-100',
  },
};

function clampPct(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Interactive 8x8 tactile Block Blast board with progressive stage themes,
 * ghost placement preview, full-line sweep beams, Candy Bomb 3x3 aiming overlay,
 * and decoupled multi-layer burst VFX.
 */
export const BlockBoard = memo(function BlockBoard({
  boardRef,
  grid,
  preview,
  bombHoverCell,
  bombAiming,
  colorblindMode,
  reducedMotion,
  bursts,
  stageTheme,
  boardShake = 'none',
  recentPlacedCells,
  onBoardCellClick,
  onBoardPointerMove,
  onBoardPointerLeave,
}: BlockBoardProps) {
  const previewCellKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!preview) return keys;
    for (const cell of preview.cells) {
      keys.add(`${cell.r},${cell.c}`);
    }
    return keys;
  }, [preview]);

  const recentPlacedKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!recentPlacedCells) return keys;
    for (const cell of recentPlacedCells) {
      keys.add(`${cell.r},${cell.c}`);
    }
    return keys;
  }, [recentPlacedCells]);

  const clearingRowSet = useMemo(
    () => new Set<number>(preview?.valid ? preview.clearedRows : []),
    [preview],
  );

  const clearingColSet = useMemo(
    () => new Set<number>(preview?.valid ? preview.clearedCols : []),
    [preview],
  );

  const motionFlagClass = reducedMotion ? ' bb-no-motion' : '';
  const shakeClass =
    boardShake === 'lg'
      ? `bb-board-shake-lg${motionFlagClass}`
      : boardShake === 'sm'
        ? `bb-board-shake-sm${motionFlagClass}`
        : '';

  return (
    <div
      className={`relative my-1.5 w-full max-w-[492px] rounded-3xl border-2 p-2.5 ring-1 ring-inset transition-[background-color,border-color,box-shadow] duration-500 sm:p-3.5 ${
        stageTheme.frameClass
      } ${stageTheme.frameRimClass} ${
        bombAiming ? 'ring-rose-300/20' : 'ring-white/10'
      } ${shakeClass}`}
      style={bombAiming ? BOMB_AIMING_FRAME_STYLE : undefined}
    >
      <StageFrameOrnaments stageId={stageTheme.id} />

      {/* Compositor-only breathing ambient halo unlocked on high stages (Stage 6+) */}
      {stageTheme.tier >= 6 && (
        <div
          aria-hidden="true"
          className={`bb-stage-aura${motionFlagClass} pointer-events-none absolute -inset-1 rounded-[28px]`}
          style={{
            boxShadow: `0 0 ${24 + (stageTheme.tier - 5) * 4}px ${stageTheme.accentHex}66, inset 0 0 18px ${stageTheme.sweepColorHex}44`,
            border: `1px solid ${stageTheme.accentHex}77`,
          }}
        />
      )}

      {/* Recessed 8x8 board well */}
      <div
        className={`relative z-10 rounded-2xl border p-1 shadow-[inset_0_4px_12px_rgba(0,0,0,0.75)] transition-[background-color,border-color,box-shadow] duration-500 sm:p-2 ${stageTheme.wellClass} ${stageTheme.wellAmbientClass}`}
      >
        <div className="relative">
          {/* boardRef targets the 8x8 grid directly for 1:1 drag coordinate mapping */}
          <div
            ref={boardRef}
            role="group"
            aria-label="Bàn cờ Block Blast 8 nhân 8"
            onPointerMove={
              onBoardPointerMove
                ? (e) => onBoardPointerMove(e.clientX, e.clientY)
                : undefined
            }
            onPointerLeave={onBoardPointerLeave}
            className="grid touch-none select-none grid-cols-8 gap-[3px] sm:gap-1.5"
          >
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const key = `${r},${c}`;
                const isPreviewTarget = previewCellKeys.has(key);
                const isRecentPlaced = recentPlacedKeys.has(key);
                const isLineClearing =
                  clearingRowSet.has(r) || clearingColSet.has(c);
                const isBombZone =
                  bombAiming &&
                  bombHoverCell !== null &&
                  Math.abs(r - bombHoverCell.r) <= 1 &&
                  Math.abs(c - bombHoverCell.c) <= 1;
                const isBombCenter =
                  bombAiming &&
                  bombHoverCell !== null &&
                  r === bombHoverCell.r &&
                  c === bombHoverCell.c;

                const token = cell
                  ? resolveStageColorToken(cell.color, stageTheme)
                  : null;
                let statusText = 'trống';
                if (bombAiming && isBombZone) {
                  statusText = token
                    ? `trong vùng nổ Bom Kẹo, có khối ${token.label}`
                    : 'trong vùng nổ Bom Kẹo';
                } else if (token) {
                  statusText = `đã có khối ${token.label}`;
                } else if (isPreviewTarget && preview?.valid) {
                  statusText = isLineClearing
                    ? 'vị trí đặt hợp lệ, sẽ ăn dòng'
                    : 'vị trí đặt hợp lệ';
                } else if (isPreviewTarget && preview && !preview.valid) {
                  statusText = 'vị trí đặt không hợp lệ';
                }

                const isCheckerEven = (r + c) % 2 === 0;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onBoardCellClick?.(r, c)}
                    aria-label={`Ô hàng ${r + 1} cột ${c + 1}, ${statusText}`}
                    className={`relative aspect-square w-full min-h-[36px] min-w-0 min-[360px]:min-w-[36px] rounded-[7px] border transition-[background-color,border-color,box-shadow] duration-500 focus-visible:z-30 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-300 sm:min-h-[44px] sm:min-w-[44px] sm:rounded-[9px] ${
                      isCheckerEven
                        ? stageTheme.cellEvenClass
                        : stageTheme.cellOddClass
                    } shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] ${
                      bombAiming
                        ? 'cursor-crosshair'
                        : onBoardCellClick
                          ? 'cursor-pointer'
                          : 'cursor-default'
                    }`}
                  >
                    {/* Occupied tactile stage-themed tile */}
                    {token && (
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-[1px] flex items-center justify-center overflow-hidden rounded-[6px] border sm:rounded-[8px] ${
                          stageTheme.tileFinishClass
                        } ${
                          isRecentPlaced
                            ? `bb-place-pop${motionFlagClass}`
                            : ''
                        }`}
                        style={{
                          backgroundColor: token.bgHex,
                          borderColor: token.borderHex,
                          boxShadow: `inset 0 2px 0 ${token.topHex}, inset 0 -3px 0 ${token.shadowHex}, 0 2px 3px rgba(0,0,0,0.45)`,
                        }}
                      >
                        {colorblindMode && (
                          <span className="relative z-10 select-none text-[11px] font-black leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:text-sm">
                            {token.patternGlyph}
                          </span>
                        )}
                      </span>
                    )}

                    {/* Line-clear golden illumination across full clearing rows/cols */}
                    {isLineClearing && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-10 rounded-[6px] bg-amber-200/20 ring-2 ring-inset ring-amber-200 shadow-[inset_0_0_10px_rgba(253,230,138,0.65),0_0_12px_rgba(251,191,36,0.45)] sm:rounded-[8px]"
                      />
                    )}

                    {/* Ghost placement preview */}
                    {isPreviewTarget && preview && (
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-[2px] z-10 rounded-[5px] border-2 sm:rounded-[7px] ${
                          preview.valid
                            ? isLineClearing
                              ? 'border-amber-100 bg-amber-300/60 shadow-[inset_0_2px_0_rgba(255,255,255,0.75),0_0_12px_rgba(253,224,71,0.75)]'
                              : 'border-amber-200/90 bg-amber-300/45 shadow-[inset_0_2px_0_rgba(255,255,255,0.5),0_0_8px_rgba(251,191,36,0.45)]'
                            : 'border-rose-300/95 bg-rose-500/45 shadow-[inset_0_0_8px_rgba(244,63,94,0.65)]'
                        }`}
                      />
                    )}

                    {/* Candy Bomb 3x3 aiming target zone */}
                    {isBombZone && (
                      <span
                        aria-hidden="true"
                        className={`bb-bomb-pulse${motionFlagClass} pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[6px] border-2 sm:rounded-[8px] ${
                          isBombCenter
                            ? 'border-amber-200 bg-rose-500/50 shadow-[inset_0_0_14px_rgba(251,191,36,0.65),0_0_16px_rgba(244,63,94,0.65)]'
                            : 'border-rose-300/90 bg-rose-500/30 shadow-[inset_0_0_10px_rgba(244,63,94,0.5)]'
                        }`}
                      >
                        {isBombCenter && (
                          <Crosshair
                            aria-hidden="true"
                            className="h-4 w-4 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:h-5 sm:w-5"
                          />
                        )}
                      </span>
                    )}
                  </button>
                );
              }),
            )}
          </div>

          {/* Decoupled burst, sweep, shockwave, particle & callout overlay */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-30 overflow-visible"
          >
            {bursts.map((burst) => {
              const ringCount = burst.shockwaveCount
                ? Math.min(6, Math.max(0, Math.floor(burst.shockwaveCount)))
                : 0;
              const callout = burst.callout;
              const fallbackLabel = !callout ? burst.label : undefined;

              return (
                <Fragment key={burst.id}>
                  {/* Full-board supernova glow on All Clear */}
                  {burst.isAllClear && (
                    <div
                      className={`bb-allclear-supernova${motionFlagClass} absolute -inset-1 rounded-2xl`}
                      style={{
                        background: `radial-gradient(circle at 50% 50%, ${stageTheme.sweepColorHex}66 0%, ${stageTheme.accentHex}40 48%, transparent 78%)`,
                        boxShadow: `inset 0 0 32px ${stageTheme.accentHex}88, 0 0 36px ${stageTheme.accentHex}55`,
                      }}
                    />
                  )}

                  {/* Horizontal row sweep beams */}
                  {burst.clearedRows?.map((r) => (
                    <div
                      key={`${burst.id}-row-${r}`}
                      className={`bb-line-sweep-h${motionFlagClass} absolute inset-x-0 rounded-full`}
                      style={{
                        top: `${((r + 0.14) / BOARD_SIZE) * 100}%`,
                        height: `${(0.72 / BOARD_SIZE) * 100}%`,
                        background: `linear-gradient(90deg, transparent 0%, ${stageTheme.sweepColorHex}CC 18%, #FFFFFFF2 50%, ${stageTheme.sweepColorHex}CC 82%, transparent 100%)`,
                        boxShadow: `0 0 18px ${stageTheme.accentHex}`,
                      }}
                    />
                  ))}

                  {/* Vertical column sweep beams */}
                  {burst.clearedCols?.map((c) => (
                    <div
                      key={`${burst.id}-col-${c}`}
                      className={`bb-line-sweep-v${motionFlagClass} absolute inset-y-0 rounded-full`}
                      style={{
                        left: `${((c + 0.14) / BOARD_SIZE) * 100}%`,
                        width: `${(0.72 / BOARD_SIZE) * 100}%`,
                        background: `linear-gradient(180deg, transparent 0%, ${stageTheme.sweepColorHex}CC 18%, #FFFFFFF2 50%, ${stageTheme.sweepColorHex}CC 82%, transparent 100%)`,
                        boxShadow: `0 0 18px ${stageTheme.accentHex}`,
                      }}
                    />
                  ))}

                  {/* Individual cleared/bombed cell flashes */}
                  {burst.cells.map(({ r, c }) => (
                    <div
                      key={`${burst.id}-${r}-${c}`}
                      className={`bb-cell-burst${motionFlagClass} absolute p-[2px]`}
                      style={{
                        left: `${(c / BOARD_SIZE) * 100}%`,
                        top: `${(r / BOARD_SIZE) * 100}%`,
                        width: `${100 / BOARD_SIZE}%`,
                        height: `${100 / BOARD_SIZE}%`,
                      }}
                    >
                      <div
                        className={`h-full w-full rounded-[6px] sm:rounded-[8px] ${
                          burst.kind === 'bomb'
                            ? 'ring-2 ring-amber-200 shadow-[0_0_16px_rgba(251,113,133,0.9)]'
                            : 'ring-1 ring-white/80 shadow-[0_0_12px_rgba(251,191,36,0.75)]'
                        }`}
                        style={{ backgroundColor: burst.colorHex }}
                      />
                    </div>
                  ))}

                  {/* 1..3 concentric shockwave rings */}
                  {Array.from({ length: ringCount }, (_, idx) => {
                    const ringSizePx = 88 + idx * 24;
                    const ringColor =
                      burst.kind === 'bomb'
                        ? idx === 0
                          ? '#FDE68A'
                          : '#FB7185'
                        : idx % 2 === 0
                          ? stageTheme.accentHex
                          : stageTheme.sweepColorHex;

                    return (
                      <div
                        key={`${burst.id}-ring-${idx}`}
                        className={`bb-shockwave-ring${motionFlagClass} absolute rounded-full border-2`}
                        style={{
                          left: `${burst.xPct}%`,
                          top: `${burst.yPct}%`,
                          width: `${ringSizePx}px`,
                          height: `${ringSizePx}px`,
                          borderColor: ringColor,
                          boxShadow: `0 0 14px ${ringColor}, inset 0 0 10px ${ringColor}66`,
                          animationDelay: reducedMotion
                            ? undefined
                            : `${idx * 90}ms`,
                        }}
                      />
                    );
                  })}

                  {/* Flying stars & candy shards */}
                  {burst.particles?.map((p) => {
                    const particleStyle: ParticleStyleVars = {
                      left: `${p.originXPct ?? burst.xPct}%`,
                      top: `${p.originYPct ?? burst.yPct}%`,
                      width: `${p.sizePx}px`,
                      height: `${p.sizePx}px`,
                      backgroundColor: p.colorHex,
                      clipPath: p.star ? STAR_CLIP_PATH : undefined,
                      boxShadow: p.star
                        ? undefined
                        : `0 0 6px ${p.colorHex}AA`,
                      '--bb-dx': `${p.dx}px`,
                      '--bb-dy': `${p.dy}px`,
                      '--bb-rot': `${p.rot}deg`,
                    };

                    return (
                      <div
                        key={`${burst.id}-p-${p.id}`}
                        className={`bb-particle-fly${motionFlagClass} absolute ${
                          p.star ? '' : 'rounded-[2px]'
                        }`}
                        style={particleStyle}
                      />
                    );
                  })}

                  {/* Tiered Arcade Callout Banner or compact floating score */}
                  {callout && callout.tier !== 'normal' && (
                    <div
                      data-tier={callout.tier}
                      className={`bb-combo-banner${
                        callout.tier === 'allClear' ? ' bb-allclear' : ''
                      }${motionFlagClass} absolute z-40 max-w-[90%] rounded-2xl border-2 px-3.5 py-1.5 text-center sm:px-5 sm:py-2 ${
                        CALLOUT_TIER_STYLES[callout.tier].boxClass
                      }`}
                      style={{
                        left: `${
                          callout.tier === 'allClear'
                            ? 50
                            : clampPct(burst.xPct, 28, 72)
                        }%`,
                        top: `${
                          callout.tier === 'allClear'
                            ? 46
                            : clampPct(burst.yPct, 22, 78)
                        }%`,
                      }}
                    >
                      <div
                        className={`font-display whitespace-normal font-black uppercase leading-tight tracking-wide sm:whitespace-nowrap ${
                          CALLOUT_TIER_STYLES[callout.tier].titleClass
                        }`}
                      >
                        {callout.title}
                      </div>
                      {callout.subtitle && (
                        <div
                          className={`mt-0.5 text-[10px] font-extrabold uppercase leading-tight tracking-wider sm:text-xs ${
                            CALLOUT_TIER_STYLES[callout.tier].subtitleClass
                          }`}
                        >
                          {callout.subtitle}
                        </div>
                      )}
                    </div>
                  )}

                  {((callout && callout.tier === 'normal') ||
                    fallbackLabel) && (
                    <div
                      className={`bb-float-score${motionFlagClass} absolute z-40 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-black tracking-wide shadow-[0_6px_16px_rgba(0,0,0,0.65)] sm:text-sm ${
                        burst.kind === 'bomb'
                          ? 'border-rose-200/90 bg-gradient-to-b from-rose-600/95 to-rose-800/95 text-white'
                          : 'border-amber-200/85 bg-[#26140B]/95 text-amber-200'
                      }`}
                      style={{
                        left: `${burst.xPct}%`,
                        top: `${burst.yPct}%`,
                      }}
                    >
                      {callout
                        ? callout.subtitle
                          ? `${callout.title} · ${callout.subtitle}`
                          : callout.title
                        : fallbackLabel}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
