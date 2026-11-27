import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Anchor,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpFromLine,
  ChevronDown,
  Flame,
  Gauge,
  Link2,
  Waves,
  Zap,
} from 'lucide-react';
import { playSfx } from '../../audio/soundEngine';
import {
  clearAllVirtualInputs,
  getCombinedPressedState,
  setVirtualHold,
  subscribePressedState,
  triggerVirtualPulse,
  type CoopPressedState,
  type CoopVirtualSkillKey,
} from '../../glass/input/coopVirtualInput';
import { GLASS_EMOTES } from '../../glass/online/protocol';
import type { GlassHudSnapshot } from '../../glass/render/renderTypes';
import type { PlayerSlot } from '../../glass/sim/types';
import type { CoopMapId } from '../maps/registry';

export interface CoopSkillBarProps {
  mapId: CoopMapId;
  mySlot: PlayerSlot;
  hud: GlassHudSnapshot;
  controlsEnabled: boolean;
  onSendEmote: (emoteIndex: number) => void;
  compact?: boolean;
  showEmotes?: boolean;
}

interface CoopSkillSlot {
  id: string;
  virtualKey: CoopVirtualSkillKey;
  keyBadge: string;
  label: string;
  title: string;
  ariaLabel: string;
  mode: 'hold' | 'tap';
  icon: ReactNode;
  active: boolean;
  highlight?: boolean;
  statusChip?: string;
  accentClass: string;
  activeRingClass: string;
}

const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300';

/**
 * Interactive RPG/party-style skill toolbar at the bottom of PAWS Duo Co-op 3D.
 * Adapts skill slots, icons, and live turn/boost/rescue highlights to the active
 * co-op map, mirrors keyboard presses in real time, and lets players tap or hold
 * skill slots directly without stealing keyboard focus from WASD movement.
 */
export function CoopSkillBar({
  mapId,
  mySlot,
  hud,
  controlsEnabled,
  onSendEmote,
  compact = false,
  showEmotes = true,
}: CoopSkillBarProps) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [pressed, setPressed] = useState<CoopPressedState>(() =>
    getCombinedPressedState(),
  );

  useEffect(() => {
    setPressed(getCombinedPressedState());
    return subscribePressedState(setPressed);
  }, []);

  useEffect(() => {
    if (!controlsEnabled) {
      clearAllVirtualInputs();
    }
  }, [controlsEnabled]);

  useEffect(() => {
    return () => {
      clearAllVirtualInputs();
    };
  }, []);

  // Progressive roving-tabindex fallback only when native `focusgroup` is unsupported
  useEffect(() => {
    const bar = toolbarRef.current;
    if (!bar || 'focusGroup' in HTMLElement.prototype) return;

    const getButtons = () =>
      Array.from(bar.querySelectorAll<HTMLButtonElement>('button'));

    const items = getButtons();
    items.forEach((btn, idx) => {
      btn.tabIndex = idx === 0 ? 0 : -1;
    });

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      const list = getButtons();
      if (target instanceof HTMLButtonElement && list.includes(target)) {
        list.forEach((btn) => {
          btn.tabIndex = btn === target ? 0 : -1;
        });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const list = getButtons();
      const idx = list.indexOf(document.activeElement as HTMLButtonElement);
      if (idx === -1) return;

      const rtl = getComputedStyle(bar).direction === 'rtl';
      let nextIdx: number | null = null;
      if (e.key === 'ArrowRight') {
        nextIdx = (idx + (rtl ? -1 : 1) + list.length) % list.length;
      } else if (e.key === 'ArrowLeft') {
        nextIdx = (idx + (rtl ? 1 : -1) + list.length) % list.length;
      } else if (e.key === 'Home') {
        nextIdx = 0;
      } else if (e.key === 'End') {
        nextIdx = list.length - 1;
      }

      if (nextIdx !== null) {
        e.preventDefault();
        e.stopPropagation();
        list[nextIdx]?.focus();
      }
    };

    bar.addEventListener('focusin', onFocusIn);
    bar.addEventListener('keydown', onKeyDown);
    return () => {
      bar.removeEventListener('focusin', onFocusIn);
      bar.removeEventListener('keydown', onKeyDown);
    };
  }, [mapId]);

  const myLiftState = mySlot === 'p1' ? hud.p1Lift : hud.p2Lift;
  const isMyPumpTurn = mapId === 'minecart_rails' && hud.pumpTurn === mySlot;
  const isRescueUrgent =
    mapId === 'rope_tether' && Boolean(hud.statusBadge?.includes('Cứu'));
  const isMyAnchored = mapId === 'rope_tether' && myLiftState < 0;
  const isMyReeling = mapId === 'rope_tether' && myLiftState > 0;
  const isBoosted = mapId === 'raft_rapids' && Boolean(hud.boostActive);

  let skills: readonly CoopSkillSlot[];

  if (mapId === 'raft_rapids') {
    skills = [
      {
        id: 'paddle_fwd',
        virtualKey: 'liftUp',
        keyBadge: 'E',
        label: 'Quẫy Tới',
        title: 'Quẫy chèo tới — đồng nhịp với đồng đội để kích hoạt Boost! (E / W / Chuột trái)',
        ariaLabel: 'Quẫy chèo tới (Phím E hoặc W)',
        mode: 'tap',
        icon: isBoosted ? (
          <Zap aria-hidden="true" className="h-4 w-4 text-sky-200" />
        ) : (
          <Waves aria-hidden="true" className="h-4 w-4 text-sky-300" />
        ),
        active: pressed.liftUp,
        highlight: isBoosted,
        statusChip: isBoosted ? 'BOOST' : undefined,
        accentClass: isBoosted
          ? 'border-sky-300 bg-sky-500/30 text-sky-100'
          : 'border-sky-400/55 bg-slate-900/90 text-sky-100 hover:border-sky-300',
        activeRingClass: 'ring-sky-300/85',
      },
      {
        id: 'paddle_back',
        virtualKey: 'liftDown',
        keyBadge: 'Q',
        label: 'Chèo Ngược',
        title: 'Chèo ngược phanh & chỉnh mũi phao (Q / S / Chuột phải)',
        ariaLabel: 'Chèo ngược chỉnh mũi (Phím Q hoặc S)',
        mode: 'tap',
        icon: <ChevronDown aria-hidden="true" className="h-4 w-4 text-amber-300" />,
        active: pressed.liftDown,
        accentClass:
          'border-amber-400/50 bg-slate-900/90 text-amber-100 hover:border-amber-300',
        activeRingClass: 'ring-amber-300/85',
      },
      {
        id: 'raft_jump',
        virtualKey: 'jump',
        keyBadge: 'SPC',
        label: 'Nhảy Phao',
        title: 'Cùng bấm Space với đồng đội để nhún phao bay qua khúc gỗ nổi',
        ariaLabel: 'Nhảy phao vượt khúc gỗ (Phím Space)',
        mode: 'tap',
        icon: <ArrowUp aria-hidden="true" className="h-4 w-4 text-emerald-300" />,
        active: pressed.jump,
        accentClass:
          'border-emerald-400/50 bg-slate-900/90 text-emerald-100 hover:border-emerald-300',
        activeRingClass: 'ring-emerald-300/85',
      },
      {
        id: 'lean_left',
        virtualKey: 'moveLeft',
        keyBadge: 'A',
        label: 'Lái Trái',
        title: 'Nghiêng trọng tâm sang trái lách đá & xoáy nước (A / ←)',
        ariaLabel: 'Nghiêng lái trái (Phím A)',
        mode: 'hold',
        icon: <ArrowLeft aria-hidden="true" className="h-4 w-4 text-cyan-300" />,
        active: pressed.moveLeft,
        accentClass:
          'border-cyan-400/45 bg-slate-900/90 text-cyan-100 hover:border-cyan-300',
        activeRingClass: 'ring-cyan-300/85',
      },
      {
        id: 'lean_right',
        virtualKey: 'moveRight',
        keyBadge: 'D',
        label: 'Lái Phải',
        title: 'Nghiêng trọng tâm sang phải lách đá & xoáy nước (D / →)',
        ariaLabel: 'Nghiêng lái phải (Phím D)',
        mode: 'hold',
        icon: <ArrowRight aria-hidden="true" className="h-4 w-4 text-cyan-300" />,
        active: pressed.moveRight,
        accentClass:
          'border-cyan-400/45 bg-slate-900/90 text-cyan-100 hover:border-cyan-300',
        activeRingClass: 'ring-cyan-300/85',
      },
    ];
  } else if (mapId === 'rope_tether') {
    skills = [
      {
        id: 'rope_anchor',
        virtualKey: 'liftDown',
        keyBadge: 'Q',
        label: 'Cắm Neo',
        title: 'Giữ Q hoặc Chuột phải để bám chắc làm trụ giữ đồng đội khi rơi vực',
        ariaLabel: 'Giữ để cắm neo chân (Phím Q)',
        mode: 'hold',
        icon: (
          <Anchor
            aria-hidden="true"
            className={`h-4 w-4 ${isMyAnchored ? 'text-amber-200' : 'text-amber-300'}`}
          />
        ),
        active: pressed.liftDown || isMyAnchored,
        highlight: isMyAnchored,
        statusChip: isMyAnchored ? 'NEO' : undefined,
        accentClass: isMyAnchored
          ? 'border-amber-300 bg-amber-500/30 text-amber-100'
          : 'border-amber-400/55 bg-slate-900/90 text-amber-100 hover:border-amber-300',
        activeRingClass: 'ring-amber-300/85',
      },
      {
        id: 'rope_reel',
        virtualKey: 'liftUp',
        keyBadge: 'E',
        label: 'Kéo Dây',
        title: 'Giữ E hoặc Chuột trái để kéo ròng rọc cứu đồng đội lên đảo',
        ariaLabel: 'Giữ để kéo dây cứu đồng đội (Phím E)',
        mode: 'hold',
        icon: (
          <Link2
            aria-hidden="true"
            className={`h-4 w-4 ${isRescueUrgent ? 'text-rose-200' : 'text-cyan-300'}`}
          />
        ),
        active: pressed.liftUp || isMyReeling,
        highlight: isRescueUrgent || isMyReeling,
        statusChip: isRescueUrgent ? 'CỨU!' : isMyReeling ? 'KÉO' : undefined,
        accentClass: isRescueUrgent
          ? 'border-rose-300 bg-rose-500/30 text-rose-100 animate-pulse motion-reduce:animate-none'
          : 'border-cyan-400/55 bg-slate-900/90 text-cyan-100 hover:border-cyan-300',
        activeRingClass: isRescueUrgent ? 'ring-rose-300/90' : 'ring-cyan-300/85',
      },
      {
        id: 'rope_jump',
        virtualKey: 'jump',
        keyBadge: 'SPC',
        label: 'Nhảy Vực',
        title: 'Nhảy qua khoảng trống giữa các đảo băng (Space)',
        ariaLabel: 'Nhảy qua vực (Phím Space)',
        mode: 'tap',
        icon: <ArrowUp aria-hidden="true" className="h-4 w-4 text-emerald-300" />,
        active: pressed.jump,
        accentClass:
          'border-emerald-400/50 bg-slate-900/90 text-emerald-100 hover:border-emerald-300',
        activeRingClass: 'ring-emerald-300/85',
      },
    ];
  } else if (mapId === 'minecart_rails') {
    skills = [
      {
        id: 'cart_pump',
        virtualKey: 'liftUp',
        keyBadge: 'E',
        label: 'Bơm Tay',
        title: 'Bấm E hoặc Chuột trái khi tới lượt mình để bơm tăng tốc xe goòng!',
        ariaLabel: 'Bơm tay tăng tốc xe goòng (Phím E)',
        mode: 'tap',
        icon: isMyPumpTurn ? (
          <Flame aria-hidden="true" className="h-4 w-4 text-amber-200" />
        ) : (
          <Gauge aria-hidden="true" className="h-4 w-4 text-rose-300" />
        ),
        active: pressed.liftUp,
        highlight: isMyPumpTurn,
        statusChip: isMyPumpTurn ? 'BƠM!' : undefined,
        accentClass: isMyPumpTurn
          ? 'border-amber-300 bg-amber-500/30 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.45)]'
          : 'border-rose-400/45 bg-slate-900/90 text-rose-100 hover:border-rose-300',
        activeRingClass: 'ring-amber-300/90',
      },
      {
        id: 'cart_duck',
        virtualKey: 'liftDown',
        keyBadge: 'Q',
        label: 'Cúi Đầu',
        title: 'Cùng giữ Q hoặc Chuột phải để cúi rạp né xà gỗ ngang',
        ariaLabel: 'Giữ để cúi đầu né xà ngang (Phím Q)',
        mode: 'hold',
        icon: <ArrowDownToLine aria-hidden="true" className="h-4 w-4 text-purple-300" />,
        active: pressed.liftDown || myLiftState < 0,
        accentClass:
          'border-purple-400/50 bg-slate-900/90 text-purple-100 hover:border-purple-300',
        activeRingClass: 'ring-purple-300/85',
      },
      {
        id: 'cart_jump',
        virtualKey: 'jump',
        keyBadge: 'SPC',
        label: 'Nhảy Cầu',
        title: 'Cùng bấm Space khi đủ tốc độ ≥ 7.0 m/s để bay qua cầu ray gãy',
        ariaLabel: 'Nhảy xe qua cầu ray gãy (Phím Space)',
        mode: 'tap',
        icon: <ArrowUp aria-hidden="true" className="h-4 w-4 text-emerald-300" />,
        active: pressed.jump,
        accentClass:
          'border-emerald-400/50 bg-slate-900/90 text-emerald-100 hover:border-emerald-300',
        activeRingClass: 'ring-emerald-300/85',
      },
      {
        id: 'lane_left',
        virtualKey: 'moveLeft',
        keyBadge: 'A',
        label: 'Làn Trái',
        title: 'Cùng giữ A (←) với đồng đội để nhảy sang làn ray bên trái',
        ariaLabel: 'Chuyển làn ray trái (Phím A)',
        mode: 'hold',
        icon: <ArrowLeft aria-hidden="true" className="h-4 w-4 text-cyan-300" />,
        active: pressed.moveLeft,
        accentClass:
          'border-cyan-400/45 bg-slate-900/90 text-cyan-100 hover:border-cyan-300',
        activeRingClass: 'ring-cyan-300/85',
      },
      {
        id: 'lane_right',
        virtualKey: 'moveRight',
        keyBadge: 'D',
        label: 'Làn Phải',
        title: 'Cùng giữ D (→) với đồng đội để nhảy sang làn ray bên phải',
        ariaLabel: 'Chuyển làn ray phải (Phím D)',
        mode: 'hold',
        icon: <ArrowRight aria-hidden="true" className="h-4 w-4 text-cyan-300" />,
        active: pressed.moveRight,
        accentClass:
          'border-cyan-400/45 bg-slate-900/90 text-cyan-100 hover:border-cyan-300',
        activeRingClass: 'ring-cyan-300/85',
      },
    ];
  } else {
    // Map 1: glass_carry
    skills = [
      {
        id: 'glass_lift_up',
        virtualKey: 'liftUp',
        keyBadge: 'E',
        label: 'Nâng Kính',
        title: 'Giữ E hoặc Chuột trái để nâng cao đầu kính qua hàng rào thấp',
        ariaLabel: 'Giữ để nâng kính lên cao (Phím E)',
        mode: 'hold',
        icon: <ArrowUpFromLine aria-hidden="true" className="h-4 w-4 text-cyan-300" />,
        active: pressed.liftUp || myLiftState > 0.25,
        accentClass:
          'border-cyan-400/55 bg-slate-900/90 text-cyan-100 hover:border-cyan-300',
        activeRingClass: 'ring-cyan-300/85',
      },
      {
        id: 'glass_lift_down',
        virtualKey: 'liftDown',
        keyBadge: 'Q',
        label: 'Hạ Kính',
        title: 'Giữ Q hoặc Chuột phải để cúi hạ thấp đầu kính luồn qua rào cao',
        ariaLabel: 'Giữ để hạ kính thấp xuống (Phím Q)',
        mode: 'hold',
        icon: <ArrowDownToLine aria-hidden="true" className="h-4 w-4 text-amber-300" />,
        active: pressed.liftDown || myLiftState < -0.2,
        accentClass:
          'border-amber-400/55 bg-slate-900/90 text-amber-100 hover:border-amber-300',
        activeRingClass: 'ring-amber-300/85',
      },
      {
        id: 'glass_jump',
        virtualKey: 'jump',
        keyBadge: 'SPC',
        label: 'Nhảy Bệ',
        title: 'Nhảy vượt khoảng trống và bậc thang (Phím Space)',
        ariaLabel: 'Nhảy qua bệ (Phím Space)',
        mode: 'tap',
        icon: <ArrowUp aria-hidden="true" className="h-4 w-4 text-emerald-300" />,
        active: pressed.jump,
        accentClass:
          'border-emerald-400/50 bg-slate-900/90 text-emerald-100 hover:border-emerald-300',
        activeRingClass: 'ring-emerald-300/85',
      },
    ];
  }

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Thanh chiêu thức và biểu cảm phối hợp"
      {...({ focusgroup: 'toolbar wrap' } as Record<string, string>)}
      className={`pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-400/35 bg-[#0e1827]/92 text-white shadow-2xl backdrop-blur-md ${
        compact
          ? 'max-w-[280px] flex-col items-end gap-1.5 p-2'
          : 'justify-center px-3 py-2'
      }`}
    >
      {/* Skill Buttons Group */}
      <div
        role="group"
        aria-label="Chiêu thức hành động"
        className={`flex flex-wrap items-center gap-1.5 ${
          compact ? 'justify-end' : 'justify-center'
        }`}
      >
        {skills.map((skill) => {
          const isHold = skill.mode === 'hold';
          const isDisabled = !controlsEnabled;

          return (
            <button
              key={skill.id}
              type="button"
              aria-label={skill.ariaLabel}
              aria-disabled={isDisabled ? 'true' : undefined}
              aria-pressed={isHold ? skill.active : undefined}
              title={skill.title}
              onPointerDown={(e) => {
                // Keep keyboard focus on window so WASD movement never locks
                e.preventDefault();
                if (isDisabled) return;
                if (isHold) {
                  setVirtualHold(skill.virtualKey, true);
                } else {
                  triggerVirtualPulse(skill.virtualKey, 150);
                }
              }}
              onPointerUp={() => {
                if (isHold) setVirtualHold(skill.virtualKey, false);
              }}
              onPointerLeave={() => {
                if (isHold) setVirtualHold(skill.virtualKey, false);
              }}
              onPointerCancel={() => {
                if (isHold) setVirtualHold(skill.virtualKey, false);
              }}
              onClick={(e) => {
                // Keyboard activation via Enter/Space when focused through Tab
                if (e.detail !== 0 || isDisabled) return;
                triggerVirtualPulse(skill.virtualKey, isHold ? 240 : 150);
              }}
              className={`relative flex min-h-[54px] min-w-[64px] touch-manipulation select-none flex-col items-center justify-between overflow-hidden rounded-xl border px-2 py-1.5 transition-[transform,border-color,background-color,box-shadow] duration-75 motion-reduce:transition-none sm:min-w-[70px] ${FOCUS_RING_CLASS} ${
                isDisabled
                  ? 'cursor-not-allowed opacity-45'
                  : 'cursor-pointer active:translate-y-0.5 motion-reduce:active:translate-y-0'
              } ${skill.accentClass} ${
                skill.active
                  ? `translate-y-0.5 ring-2 ${skill.activeRingClass} shadow-inner motion-reduce:translate-y-0`
                  : skill.highlight
                    ? `ring-1 ${skill.activeRingClass} shadow-[0_3px_0_rgba(0,0,0,0.45)]`
                    : 'shadow-[0_3px_0_rgba(0,0,0,0.45)]'
              } aria-[pressed=true]:bg-cyan-500/25`}
            >
              {/* Top row: Keycap badge + live status/turn chip */}
              <div className="relative z-10 flex w-full items-center justify-between gap-1">
                <kbd className="rounded bg-black/55 px-1.5 py-0.5 font-mono text-[10px] font-black leading-none text-white/95 ring-1 ring-white/15">
                  {skill.keyBadge}
                </kbd>
                {skill.statusChip ? (
                  <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-black leading-none text-[#1e1208]">
                    {skill.statusChip}
                  </span>
                ) : isHold ? (
                  <span
                    aria-hidden="true"
                    className="text-[8px] font-black uppercase tracking-tight text-white/50"
                  >
                    Giữ
                  </span>
                ) : null}
              </div>

              {/* Center Icon + Bottom Label */}
              <div className="relative z-10 mt-0.5 flex flex-col items-center gap-0.5">
                {skill.icon}
                <span className="max-w-[66px] truncate text-[10px] font-black leading-tight tracking-tight">
                  {skill.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {showEmotes && (
        <>
          {/* Border-drawn separator (visible under forced-colors) */}
          {!compact && (
            <span
              role="separator"
              aria-orientation="vertical"
              className="hidden h-10 border-l border-white/15 sm:block"
            />
          )}

          {/* Compact 4-Slot Emote Buttons Group */}
          <div
            role="group"
            aria-label="Biểu cảm nhanh"
            className="flex items-center justify-center gap-1"
          >
            {GLASS_EMOTES.map((emote, index) => (
              <button
                key={emote.id}
                type="button"
                title={`${emote.text} (Phím ${emote.id})`}
                aria-label={`Gửi emote ${emote.text} (phím ${emote.id})`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  playSfx('click');
                  onSendEmote(index);
                }}
                onClick={(e) => {
                  if (e.detail !== 0) return;
                  e.currentTarget.blur();
                  playSfx('click');
                  onSendEmote(index);
                }}
                className={`relative flex min-h-[48px] min-w-[44px] cursor-pointer touch-manipulation select-none flex-col items-center justify-between rounded-xl border border-cyan-400/25 bg-[#152438]/90 px-1.5 py-1.5 text-white shadow-[0_3px_0_rgba(0,0,0,0.4)] transition-[transform,border-color,background-color] duration-75 hover:border-cyan-300 hover:bg-cyan-500/20 active:translate-y-0.5 motion-reduce:transition-none motion-reduce:active:translate-y-0 ${FOCUS_RING_CLASS}`}
              >
                <kbd className="self-start rounded bg-black/50 px-1 py-0.5 font-mono text-[9px] font-black leading-none text-amber-200">
                  {emote.id}
                </kbd>
                <span aria-hidden="true" className="text-base leading-none">
                  {emote.icon}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
