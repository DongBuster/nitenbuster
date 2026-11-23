import { useId, useState } from 'react';
import type { CardType, Color } from '../../engine/types';
import { CARD_META, COLOR_THEME } from './cardMeta';

export interface CardInfoButtonProps {
  type: CardType;
  color?: Color;
  value?: number;
  placement?: 'top' | 'bottom';
  size?: 'xs' | 'sm';
  className?: string;
}

/**
 * Compact "!" button that reveals a card's name, color/wild badge, and effect description
 * on hover or keyboard focus without triggering underlying card play clicks.
 */
export function CardInfoButton({
  type,
  color,
  value,
  placement = 'top',
  size = 'xs',
  className = '',
}: CardInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  const meta = CARD_META[type];
  const isWild = meta.isWild || !color;
  const theme = !isWild && color ? COLOR_THEME[color] : null;
  const title =
    type === 'basic' && value !== undefined ? `Lá Số ${value}` : meta.name;

  const btnDims =
    size === 'sm' ? 'h-5 w-5 text-[11px]' : 'h-[18px] w-[18px] text-[10px]';

  const tooltipPos =
    placement === 'bottom'
      ? 'top-full left-1/2 mt-2 -translate-x-1/2'
      : 'bottom-full left-1/2 mb-2 -translate-x-1/2';

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`Thông tin lá ${title}`}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={`pointer-events-auto inline-flex cursor-help items-center justify-center rounded-full border border-amber-200/80 bg-[#1F120C]/92 font-black leading-none text-amber-200 shadow-md transition hover:scale-110 hover:border-amber-300 hover:bg-amber-400 hover:text-[#2C1B11] focus-visible:outline-2 focus-visible:outline-amber-300 ${btnDims}`}
      >
        !
      </button>

      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute z-50 w-56 rounded-2xl border border-amber-200/45 bg-[#19100B]/96 p-3 text-left text-white shadow-[0_12px_32px_rgba(0,0,0,0.65)] backdrop-blur-md ${tooltipPos}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-amber-100">{title}</span>
            {isWild ? (
              <span className="shrink-0 rounded-full border border-purple-300/50 bg-purple-700/80 px-2 py-0.5 text-[10px] font-extrabold text-purple-100">
                ✦ Wild
              </span>
            ) : (
              theme && (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                  style={{
                    backgroundColor: theme.pillBg,
                    color: theme.pillText,
                  }}
                >
                  {theme.shapeSymbol} {theme.label}
                </span>
              )
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed font-medium text-amber-50/90">
            {meta.description}
          </p>
        </div>
      )}
    </span>
  );
}
