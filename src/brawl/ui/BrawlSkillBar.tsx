import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUp,
  Flame,
  Footprints,
  Grab,
  Hand,
  RotateCw,
  Shield,
  Wind,
  Zap,
} from 'lucide-react';
import { canTriggerWeaponSpin, ITEM_META } from '../sim/combat';
import { formatCooldownLabel } from '../sim/cooldowns';
import type {
  BrawlSkillId,
  HudSnapshot,
  PressedSkillState,
} from '../sim/types';

export interface BrawlSkillBarProps {
  hud: HudSnapshot;
  controlsEnabled: boolean;
  pressedSkills: PressedSkillState;
  onTriggerSkill: (skill: 'punch' | 'headbutt' | 'roll' | 'jump') => void;
  onVirtualHold: (skill: 'grab' | 'sprint', held: boolean) => void;
  compact?: boolean;
}

interface SkillSlotDescriptor {
  id: BrawlSkillId;
  keyBadge: string;
  label: string;
  title: string;
  ariaLabel: string;
  icon: ReactNode;
  readyPct: number;
  cooldownLeft: number;
  disabled: boolean;
  active: boolean;
  isToggleOrHold: boolean;
  accentClass: string;
  fillClass: string;
  badgeCount?: number;
}

/**
 * Party-brawler bottom HUD with Balance meter, interactive 6-slot ability bar
 * backed by real cooldown telemetry, and active buff chips.
 */
export function BrawlSkillBar({
  hud,
  controlsEnabled,
  pressedSkills,
  onTriggerSkill,
  onVirtualHold,
  compact = false,
}: BrawlSkillBarProps) {
  const [sprintToggled, setSprintToggled] = useState(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!controlsEnabled && sprintToggled) {
      setSprintToggled(false);
    }
  }, [controlsEnabled, sprintToggled]);

  // Progressive fallback for browsers lacking native CSS/HTML focusgroup support
  useEffect(() => {
    const bar = toolbarRef.current;
    if (!bar || 'focusGroup' in HTMLElement.prototype) return;

    const getButtons = () =>
      Array.from(bar.querySelectorAll<HTMLButtonElement>('button'));

    const items = getButtons();
    items.forEach((b, i) => {
      b.tabIndex = i === 0 ? 0 : -1;
    });

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      const list = getButtons();
      if (target instanceof HTMLButtonElement && list.includes(target)) {
        list.forEach((b) => {
          b.tabIndex = b === target ? 0 : -1;
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
  }, []);

  const balancePct = Math.max(
    0,
    Math.min(100, (hud.playerBalance / Math.max(1, hud.playerMaxBalance)) * 100),
  );
  const heldMeta = hud.playerHeldItem ? ITEM_META[hud.playerHeldItem] : null;
  const isGrabbing = Boolean(hud.playerGrabbingName);
  const actionsLocked = !controlsEnabled || !hud.playerAlive;

  const punchReady = hud.playerPunchReadyPct >= 0.99;
  const headbuttReady = hud.playerHeadbuttReadyPct >= 0.99;
  const rollReady = hud.playerRollReadyPct >= 0.99;
  const isAirDropkick = !hud.playerGrounded && !heldMeta;
  const canWeaponSpin = canTriggerWeaponSpin(hud.playerHeldItem, hud.playerHeldAmmo);
  const isSwordSpin = canWeaponSpin && hud.playerHeldItem === 'sword';

  const skills: readonly SkillSlotDescriptor[] = [
    {
      id: 'punch',
      keyBadge: 'J',
      label:
        heldMeta && hud.playerHeldAmmo > 0
          ? heldMeta.label
          : isAirDropkick
            ? 'Đá bay'
            : 'Đấm',
      title: 'Đấm / Đá bay trên không / Dùng vũ khí (Phím J hoặc Chuột trái)',
      ariaLabel:
        heldMeta && hud.playerHeldAmmo > 0
          ? `Dùng ${heldMeta.label}, còn ${hud.playerHeldAmmo} lần (Phím J)`
          : isAirDropkick
            ? 'Đá bay trên không (Phím J)'
            : 'Đấm cận chiến (Phím J)',
      icon:
        heldMeta && hud.playerHeldAmmo > 0 ? (
          <span className="text-base leading-none" aria-hidden="true">
            {heldMeta.emoji}
          </span>
        ) : isAirDropkick ? (
          <Zap className="h-4 w-4 text-sky-300" aria-hidden="true" />
        ) : (
          <Hand className="h-4 w-4 text-amber-300" aria-hidden="true" />
        ),
      readyPct: hud.playerPunchReadyPct,
      cooldownLeft: hud.playerPunchCooldownLeft,
      disabled: actionsLocked || isGrabbing,
      active: pressedSkills.punch,
      isToggleOrHold: false,
      badgeCount:
        heldMeta && hud.playerHeldAmmo > 0 ? hud.playerHeldAmmo : undefined,
      accentClass:
        heldMeta && hud.playerHeldAmmo > 0
          ? 'border-amber-300/80 bg-amber-500/20 text-amber-100'
          : isAirDropkick
            ? 'border-sky-400/70 bg-sky-500/20 text-sky-100'
            : punchReady
              ? 'border-amber-400/55 bg-slate-900/90 text-amber-100 hover:border-amber-300'
              : 'border-white/15 bg-slate-900/80 text-slate-300',
      fillClass: isAirDropkick ? 'bg-sky-400/20' : 'bg-amber-400/20',
    },
    {
      id: 'headbutt',
      keyBadge: 'H',
      label: canWeaponSpin
        ? isSwordSpin
          ? 'Xoay kiếm'
          : 'Xoay xẻng'
        : 'Húc đầu',
      title: canWeaponSpin
        ? 'Xoay 360° quét văng mọi đối thủ xung quanh (Phím H hoặc Chuột phải)'
        : 'Lao người húc đầu hất văng đối thủ (Phím H hoặc Chuột phải)',
      ariaLabel: canWeaponSpin
        ? isSwordSpin
          ? 'Xoay kiếm 360 độ (Phím H)'
          : 'Xoay xẻng 360 độ (Phím H)'
        : 'Húc đầu hất văng (Phím H)',
      icon: canWeaponSpin ? (
        <RotateCw
          className={`h-4 w-4 ${isSwordSpin ? 'text-sky-300' : 'text-amber-300'}`}
          aria-hidden="true"
        />
      ) : (
        <Flame className="h-4 w-4 text-orange-300" aria-hidden="true" />
      ),
      readyPct: hud.playerHeadbuttReadyPct,
      cooldownLeft: hud.playerHeadbuttCooldownLeft,
      disabled: actionsLocked || isGrabbing,
      active: pressedSkills.headbutt,
      isToggleOrHold: false,
      accentClass: canWeaponSpin
        ? isSwordSpin
          ? 'border-sky-300/80 bg-sky-500/20 text-sky-100 hover:border-sky-200'
          : 'border-amber-300/80 bg-amber-500/20 text-amber-100 hover:border-amber-200'
        : headbuttReady
          ? 'border-orange-400/55 bg-slate-900/90 text-orange-100 hover:border-orange-300'
          : 'border-white/15 bg-slate-900/80 text-slate-300',
      fillClass: canWeaponSpin
        ? isSwordSpin
          ? 'bg-sky-400/24'
          : 'bg-amber-400/24'
        : 'bg-orange-400/22',
    },
    {
      id: 'grab',
      keyBadge: 'K',
      label: 'Nắm/Ném',
      title: 'Giữ để nắm đối thủ, thả ra để ném bay (Phím K)',
      ariaLabel: 'Giữ để nắm và ném đối thủ (Phím K)',
      icon: (
        <Grab
          className={`h-4 w-4 ${isGrabbing ? 'text-amber-200' : 'text-purple-300'}`}
          aria-hidden="true"
        />
      ),
      readyPct: 1,
      cooldownLeft: 0,
      disabled: actionsLocked,
      active: pressedSkills.grab || isGrabbing,
      isToggleOrHold: true,
      accentClass: isGrabbing
        ? 'border-amber-300 bg-amber-500/30 text-amber-100 ring-2 ring-amber-300/60'
        : 'border-purple-400/50 bg-slate-900/90 text-purple-100 hover:border-purple-300',
      fillClass: 'bg-purple-400/20',
    },
    {
      id: 'roll',
      keyBadge: 'L',
      label: 'Lăn né',
      title: 'Lăn né nhanh vượt đòn (Phím L)',
      ariaLabel: 'Lăn né nhanh (Phím L)',
      icon: <Wind className="h-4 w-4 text-sky-300" aria-hidden="true" />,
      readyPct: hud.playerRollReadyPct,
      cooldownLeft: hud.playerRollCooldownLeft,
      disabled: actionsLocked || isGrabbing,
      active: pressedSkills.roll,
      isToggleOrHold: false,
      accentClass: rollReady
        ? 'border-sky-400/55 bg-slate-900/90 text-sky-100 hover:border-sky-300'
        : 'border-white/15 bg-slate-900/80 text-slate-300',
      fillClass: 'bg-sky-400/22',
    },
    {
      id: 'jump',
      keyBadge: 'SPC',
      label: 'Nhảy',
      title: 'Nhảy lên hoặc kết hợp phím J trên không để Đá bay (Space)',
      ariaLabel: 'Nhảy (Phím Space)',
      icon: <ArrowUp className="h-4 w-4 text-emerald-300" aria-hidden="true" />,
      readyPct: 1,
      cooldownLeft: 0,
      disabled: actionsLocked,
      active: pressedSkills.jump,
      isToggleOrHold: false,
      accentClass:
        'border-emerald-400/50 bg-slate-900/90 text-emerald-100 hover:border-emerald-300',
      fillClass: 'bg-emerald-400/20',
    },
    {
      id: 'sprint',
      keyBadge: 'SHF',
      label: 'Chạy',
      title: 'Nước rút nhanh (Giữ phím Shift hoặc bấm để bật/tắt)',
      ariaLabel: 'Nước rút nhanh (Phím Shift)',
      icon: (
        <Footprints
          className={`h-4 w-4 ${
            pressedSkills.sprint || sprintToggled || hud.playerSpeedLeft > 0
              ? 'text-cyan-200'
              : 'text-slate-300'
          }`}
          aria-hidden="true"
        />
      ),
      readyPct: 1,
      cooldownLeft: 0,
      disabled: actionsLocked || isGrabbing,
      active: pressedSkills.sprint || sprintToggled || hud.playerSpeedLeft > 0,
      isToggleOrHold: true,
      accentClass:
        pressedSkills.sprint || sprintToggled || hud.playerSpeedLeft > 0
          ? 'border-cyan-300 bg-cyan-500/25 text-cyan-100'
          : 'border-white/25 bg-slate-900/90 text-slate-200 hover:border-cyan-300/60',
      fillClass: 'bg-cyan-400/20',
    },
  ];

  return (
    <div
      data-brawl-ui="true"
      className={`pointer-events-auto flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-slate-950/90 px-3 py-2.5 text-xs text-white shadow-2xl backdrop-blur-md ${
        compact
          ? 'w-[244px] flex-col items-stretch gap-2 p-2.5'
          : 'w-full max-w-[332px] sm:w-auto sm:max-w-none sm:px-3.5'
      }`}
    >
      {/* Balance / Stun Meter */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2 text-[11px] font-black">
          <span>
            {hud.playerFrozen
              ? 'ĐÓNG BĂNG!'
              : hud.playerStunned
                ? 'CHOÁNG NGÃ!'
                : 'Thăng Bằng'}
          </span>
          <span className="font-mono text-amber-200">
            {Math.round(balancePct)}%
          </span>
        </div>
        <div
          className={`h-2 overflow-hidden rounded-full bg-white/15 ${
            compact ? 'w-full' : 'w-28 sm:w-32'
          }`}
        >
          <div
            className={`h-full transition-[width,background-color] duration-150 motion-reduce:transition-none ${
              hud.playerStunned || balancePct < 35
                ? 'bg-rose-500'
                : hud.playerFrozen
                  ? 'bg-sky-400'
                  : 'bg-emerald-400'
            }`}
            style={{ width: `${balancePct}%` }}
          />
        </div>
      </div>

      {!compact && (
        <span
          role="separator"
          aria-orientation="vertical"
          className="hidden h-10 w-px bg-white/15 sm:block"
        />
      )}

      {/* 6-Button Skill Bar */}
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="Thanh chiêu thức chiến đấu"
        {...({ focusgroup: 'toolbar wrap' } as Record<string, string>)}
        className={
          compact
            ? 'grid w-full grid-cols-3 gap-1.5'
            : 'grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-center'
        }
      >
        {skills.map((skill) => {
          const isCooling = skill.readyPct < 0.99;
          const cdText = formatCooldownLabel(skill.cooldownLeft);

          return (
            <button
              key={skill.id}
              type="button"
              aria-label={skill.ariaLabel}
              aria-disabled={skill.disabled ? 'true' : undefined}
              aria-pressed={skill.isToggleOrHold ? skill.active : undefined}
              title={skill.title}
              onPointerDown={(e) => {
                // Keep keyboard focus on window so WASD/Space never lock after mouse click
                e.preventDefault();
                if (skill.disabled) return;
                if (skill.id === 'grab') {
                  onVirtualHold('grab', true);
                } else if (skill.id === 'sprint') {
                  const next = !sprintToggled;
                  setSprintToggled(next);
                  onVirtualHold('sprint', next);
                } else {
                  onTriggerSkill(skill.id);
                }
              }}
              onPointerUp={() => {
                if (skill.id === 'grab') onVirtualHold('grab', false);
              }}
              onPointerLeave={() => {
                if (skill.id === 'grab') onVirtualHold('grab', false);
              }}
              onPointerCancel={() => {
                if (skill.id === 'grab') onVirtualHold('grab', false);
              }}
              onClick={(e) => {
                // Keyboard activation via Enter/Space when focused through Tab
                if (e.detail !== 0 || skill.disabled) return;
                if (skill.id === 'sprint') {
                  const next = !sprintToggled;
                  setSprintToggled(next);
                  onVirtualHold('sprint', next);
                } else if (skill.id === 'grab') {
                  onVirtualHold('grab', true);
                  window.setTimeout(() => onVirtualHold('grab', false), 160);
                } else {
                  onTriggerSkill(skill.id);
                }
              }}
              className={`relative flex min-h-[52px] min-w-[60px] touch-manipulation select-none flex-col items-center justify-between overflow-hidden rounded-xl border px-2 py-1.5 transition-[transform,border-color,background-color,box-shadow] duration-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 motion-reduce:transition-none sm:min-w-[68px] ${
                skill.disabled
                  ? 'cursor-not-allowed opacity-45'
                  : 'cursor-pointer active:translate-y-0.5 motion-reduce:active:translate-y-0'
              } ${skill.accentClass} ${
                skill.active
                  ? 'translate-y-0.5 ring-2 ring-amber-300/80 shadow-inner motion-reduce:translate-y-0'
                  : 'shadow-[0_3px_0_rgba(0,0,0,0.45)]'
              } aria-[pressed=true]:ring-2 aria-[pressed=true]:ring-amber-300`}
            >
              {/* Cooldown recovery fill layer */}
              {isCooling && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-x-0 bottom-0 transition-[height] duration-100 motion-reduce:transition-none ${skill.fillClass}`}
                  style={{ height: `${Math.round(skill.readyPct * 100)}%` }}
                />
              )}

              {/* Top row: Keycap badge + ammo or cooldown seconds */}
              <div className="relative z-10 flex w-full items-center justify-between gap-1">
                <kbd className="rounded bg-black/55 px-1.5 py-0.5 font-mono text-[10px] font-black leading-none text-white/95 ring-1 ring-white/15">
                  {skill.keyBadge}
                </kbd>
                {cdText ? (
                  <span className="font-mono text-[10px] font-black leading-none text-amber-300">
                    {cdText}
                  </span>
                ) : skill.badgeCount !== undefined ? (
                  <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-black leading-none text-[#26160b]">
                    ×{skill.badgeCount}
                  </span>
                ) : null}
              </div>

              {/* Center Icon + Bottom Label */}
              <div className="relative z-10 mt-0.5 flex flex-col items-center gap-0.5">
                {skill.icon}
                <span className="max-w-[64px] truncate text-[10px] font-black leading-tight tracking-tight">
                  {skill.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Grab Target Notice + Active Buffs */}
      {(hud.playerGrabbingName ||
        hud.playerSpeedLeft > 0 ||
        hud.playerShieldLeft > 0) && (
        <>
          <span
            role="separator"
            aria-orientation="vertical"
            className="hidden h-10 w-px bg-white/15 sm:block"
          />
          <div className="flex flex-wrap items-center gap-1.5 font-black">
            {hud.playerGrabbingName && (
              <span className="rounded-full border border-amber-300/60 bg-amber-500/25 px-2.5 py-1 text-[11px] text-amber-200">
                Giữ {hud.playerGrabbingName} · Nhả K ném!
              </span>
            )}
            {hud.playerSpeedLeft > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/25 px-2 py-0.5 text-cyan-200">
                <Zap className="h-3 w-3" aria-hidden="true" />
                <span>{hud.playerSpeedLeft.toFixed(1)}s</span>
              </span>
            )}
            {hud.playerShieldLeft > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/25 px-2 py-0.5 text-amber-200">
                <Shield className="h-3 w-3" aria-hidden="true" />
                <span>{hud.playerShieldLeft.toFixed(1)}s</span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
