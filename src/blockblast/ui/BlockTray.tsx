import { memo, type PointerEvent } from 'react';
import { Bomb, Sparkles } from 'lucide-react';
import type { TrayPiece } from '../engine/types.ts';
import {
  resolveStageColorToken,
  STAGE_THEMES,
  type BoardStageTheme,
} from '../engine/stages.ts';

export interface PieceMiniGridProps {
  piece: TrayPiece;
  cellSizePx?: number;
  colorblindMode?: boolean;
  stageTheme?: BoardStageTheme;
  className?: string;
}

/**
 * Renders either a Candy Bomb badge tile or an exact mini-grid of a TrayPiece.
 * Reused inside BlockTray slots and the floating pointer-drag layer.
 */
export function PieceMiniGrid({
  piece,
  cellSizePx,
  colorblindMode = false,
  stageTheme = STAGE_THEMES[0],
  className = '',
}: PieceMiniGridProps) {
  if (piece.kind === 'candyBomb') {
    const bombSize = cellSizePx ? Math.max(30, Math.round(cellSizePx - 2)) : 44;
    const iconSize = Math.max(16, Math.round(bombSize * 0.48));
    return (
      <div
        aria-hidden="true"
        className={`relative flex items-center justify-center rounded-xl border-2 border-amber-200 bg-gradient-to-br from-rose-500 via-fuchsia-500 to-amber-400 shadow-[0_4px_0_#9D174D,0_0_16px_rgba(244,63,94,0.5)] ${className}`}
        style={{ width: `${bombSize}px`, height: `${bombSize}px` }}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[10px] bg-gradient-to-b from-white/30 to-transparent" />
        <Bomb
          className="relative z-10 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
          style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
        />
        <Sparkles className="absolute right-1 top-1 h-2.5 w-2.5 text-amber-100 drop-shadow" />
        <span className="absolute -bottom-1.5 -right-1.5 rounded-full border border-amber-300/80 bg-[#26140B] px-1.5 py-0.5 text-[9px] font-black leading-none text-amber-200 shadow">
          3×3
        </span>
      </div>
    );
  }

  const maxDim = Math.max(piece.width, piece.height);
  const gapPx = cellSizePx
    ? Math.max(2, Math.round(cellSizePx * 0.09))
    : maxDim <= 2
      ? 3
      : 2;
  const tilePx = cellSizePx
    ? Math.max(12, Math.round(cellSizePx - gapPx))
    : maxDim >= 5
      ? 14
      : maxDim === 4
        ? 16
        : maxDim === 3
          ? 19
          : 22;

  const token = resolveStageColorToken(piece.color, stageTheme);
  const filledSet = new Set(piece.cells.map((c) => `${c.dr},${c.dc}`));
  const glyphSizeClass =
    tilePx <= 15 ? 'text-[8px]' : tilePx <= 20 ? 'text-[10px]' : 'text-xs';

  const cells = [];
  for (let r = 0; r < piece.height; r++) {
    for (let c = 0; c < piece.width; c++) {
      const key = `${r}-${c}`;
      if (filledSet.has(`${r},${c}`)) {
        cells.push(
          <div
            key={key}
            aria-hidden="true"
            className={`relative flex items-center justify-center overflow-hidden rounded-[4px] border ${stageTheme.tileFinishClass}`}
            style={{
              backgroundColor: token.bgHex,
              borderColor: token.borderHex,
              borderRadius: tilePx >= 28 ? '7px' : '4px',
              boxShadow: `inset 0 2px 0 ${token.topHex}, inset 0 -2px 0 ${token.shadowHex}, 0 1px 2px rgba(0,0,0,0.45)`,
            }}
          >
            {colorblindMode && (
              <span
                className={`relative z-10 select-none font-black leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${glyphSizeClass}`}
              >
                {token.patternGlyph}
              </span>
            )}
          </div>,
        );
      } else {
        cells.push(<div key={key} aria-hidden="true" />);
      }
    }
  }

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${piece.width}, ${tilePx}px)`,
        gridTemplateRows: `repeat(${piece.height}, ${tilePx}px)`,
        gap: `${gapPx}px`,
      }}
    >
      {cells}
    </div>
  );
}

export { PieceMiniGrid as PieceVisual };

export interface BlockTrayProps {
  tray: readonly (TrayPiece | null)[];
  draggingSlot: number | null;
  selectedSlot: number | null;
  fitStatus: readonly boolean[];
  disabled: boolean;
  colorblindMode: boolean;
  stageTheme?: BoardStageTheme;
  onSlotPointerDown: (
    slotIndex: number,
    e: PointerEvent<HTMLButtonElement>,
  ) => void;
  onSlotKeySelect?: (slotIndex: number) => void;
}

/**
 * Three-slot tactile piece tray supporting pointer drag-and-drop (.bb-drag-handle),
 * keyboard/click selection via native buttons, and progressive stage theming.
 */
export const BlockTray = memo(function BlockTray({
  tray,
  draggingSlot,
  selectedSlot,
  fitStatus,
  disabled,
  colorblindMode,
  stageTheme = STAGE_THEMES[0],
  onSlotPointerDown,
  onSlotKeySelect,
}: BlockTrayProps) {
  return (
    <div
      role="group"
      aria-label="Khay 3 mảnh ghép"
      className="grid w-full max-w-[492px] grid-cols-3 gap-2 sm:gap-3"
    >
      {[0, 1, 2].map((idx) => {
        const piece = tray[idx] ?? null;

        if (!piece) {
          return (
            <div
              key={`slot-${idx}`}
              aria-hidden="true"
              className={`flex min-h-[88px] items-center justify-center rounded-2xl border opacity-85 shadow-[inset_0_3px_8px_rgba(0,0,0,0.6)] transition-[background-color,border-color,box-shadow] duration-500 sm:min-h-[108px] ${stageTheme.wellClass}`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-white/15 shadow-inner" />
            </div>
          );
        }

        const canFit = fitStatus[idx] ?? true;
        const isDragging = draggingSlot === idx;
        const isSelected = selectedSlot === idx;
        const colorLabel = resolveStageColorToken(piece.color, stageTheme).label;
        const ariaLabel =
          piece.kind === 'candyBomb'
            ? `Ô khay ${idx + 1}: Bom Kẹo 3×3 (${colorLabel})${
                canFit ? '' : ', hiện chưa đặt được'
              }`
            : `Ô khay ${idx + 1}: Khối ${piece.width}×${piece.height} (${
                piece.cells.length
              } ô, màu ${colorLabel})${
                canFit ? '' : ', chưa có chỗ trống phù hợp'
              }`;

        return (
          <button
            key={piece.uid}
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-pressed={isSelected}
            aria-description={
              !canFit
                ? 'Mảnh này hiện chưa có vị trí trống phù hợp trên bàn cờ'
                : undefined
            }
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              if (disabled) return;
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              onSlotPointerDown(idx, e);
            }}
            onClick={(e) => {
              if (disabled) return;
              // Keyboard activation (Enter/Space) and AT clicks fire click with detail === 0 without pointerdown;
              // pointer taps are handled in pointerup to avoid double-toggling selectedSlot.
              if (e.detail === 0) {
                onSlotKeySelect?.(idx);
              }
            }}
            className={`bb-drag-handle ${
              isDragging ? 'is-dragging' : ''
            } relative flex min-h-[88px] flex-col items-center justify-center rounded-2xl border-2 p-2 transition-[background-color,border-color,box-shadow,opacity,filter] duration-500 motion-safe:transition-[background-color,border-color,box-shadow,opacity,transform,filter] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-50 sm:min-h-[108px] sm:p-2.5 ${
              stageTheme.traySlotClass
            } ${
              isDragging
                ? 'motion-safe:scale-95 opacity-20'
                : isSelected
                  ? 'motion-safe:-translate-y-0.5 ring-2 ring-amber-300/75 shadow-[0_5px_0_rgba(0,0,0,0.55),0_0_20px_rgba(251,191,36,0.4)] brightness-110'
                  : canFit
                    ? 'shadow-[0_5px_0_rgba(0,0,0,0.48),0_8px_18px_rgba(0,0,0,0.45)] hover:brightness-110'
                    : 'opacity-55 shadow-[0_4px_0_rgba(0,0,0,0.45),0_6px_14px_rgba(0,0,0,0.35)]'
            }`}
            style={
              isSelected && !isDragging
                ? { borderColor: '#FCD34D' }
                : isDragging
                  ? { borderColor: 'rgba(252, 211, 77, 0.4)' }
                  : undefined
            }
          >
            <PieceMiniGrid
              piece={piece}
              colorblindMode={colorblindMode}
              stageTheme={stageTheme}
            />
            {!canFit && !isDragging && (
              <span
                aria-hidden="true"
                className="mt-1.5 rounded-full border border-amber-400/25 bg-black/50 px-2 py-0.5 text-[10px] font-bold leading-none tracking-wide text-amber-200/85"
              >
                Chờ ô
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});
