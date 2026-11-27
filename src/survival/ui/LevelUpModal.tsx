import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { RefreshCw, Sparkles, Timer, Zap } from 'lucide-react';
import { SKILL_SCOPE_LABELS, getSkillSpec } from '../sim/catalog.ts';
import type {
  SkillCategory,
  SkillMapScope,
  SkillOffer,
  SkillRarity,
} from '../sim/types.ts';
import { SkillArt } from './SurvivalIcons.tsx';

const PROGRAMMATIC_CLOSE = '__programmatic__';
const LEVEL_UP_MAX_TIMER_SEC = 15;

export const SURVIVAL_FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';

/**
 * Ensures HTML `autofocus` content attribute is present on the primary button
 * so native `dialog.showModal()` focuses it reliably whenever opened.
 */
export function setNativeAutofocus(el: HTMLButtonElement | null): void {
  if (el) {
    el.autofocus = true;
  }
}

export interface SurvivalDialogShellProps {
  open: boolean;
  titleId: string;
  describedById?: string;
  dialogClassName?: string;
  innerClassName?: string;
  children: ReactNode;
}

/**
 * Shared non-dismissible native top-layer `<dialog>` shell for PAWS Survival modals.
 * Uses `showModal()`, `closedby="none"`, and `onCancel` prevention without adding
 * redundant `role="dialog"` or `aria-modal`, and keeps layout classes off `<dialog>`.
 */
export function SurvivalDialogShell({
  open,
  titleId,
  describedById,
  dialogClassName = 'm-auto max-h-[92dvh] w-[min(94vw,52rem)] overflow-y-auto rounded-3xl border-2 border-amber-400/45 bg-[#121826] p-0 text-[#FFF9F0] shadow-2xl',
  innerClassName = 'flex flex-col gap-5 p-5 sm:p-7',
  children,
}: SurvivalDialogShellProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      if (!dialog.isConnected) return;
      dialog.returnValue = '';
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close(PROGRAMMATIC_CLOSE);
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) {
        dialog.close(PROGRAMMATIC_CLOSE);
      }
    };
  }, []);

  const handleCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
  };

  const handleClose = (e: SyntheticEvent<HTMLDialogElement>) => {
    const dialog = e.currentTarget;
    const action = dialog.returnValue;
    dialog.returnValue = '';

    if (action !== PROGRAMMATIC_CLOSE && openRef.current && dialog.isConnected) {
      dialog.showModal();
    }
  };

  const closedByAttr = { closedby: 'none' } as Record<string, string>;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={describedById}
      onCancel={handleCancel}
      onClose={handleClose}
      {...closedByAttr}
      className={dialogClassName}
    >
      <div className={innerClassName}>{children}</div>
    </dialog>
  );
}

export interface LevelUpModalProps {
  open: boolean;
  teamLevel: number;
  offers: readonly SkillOffer[];
  rerollsLeft: number;
  isOnlineCoop: boolean;
  hasLocalPicked: boolean;
  pickedCount: number;
  humanCount: number;
  timerSec: number;
  onPickSkill: (offerIndex: number) => void;
  onReroll: () => void;
}

const CATEGORY_META: Record<
  SkillCategory,
  { label: string; badgeClass: string }
> = {
  weapon: {
    label: 'Vũ khí',
    badgeClass: 'border-rose-400/45 bg-rose-500/20 text-rose-200',
  },
  secondary: {
    label: 'Vũ khí phụ',
    badgeClass: 'border-violet-400/45 bg-violet-500/20 text-violet-200',
  },
  survival: {
    label: 'Sinh tồn',
    badgeClass: 'border-emerald-400/45 bg-emerald-500/20 text-emerald-200',
  },
};

const SCOPE_BADGE_CLASSES: Record<SkillMapScope, string> = {
  core: 'border-white/15 bg-white/8 text-slate-300',
  winter_cabin: 'border-sky-400/45 bg-sky-500/20 text-sky-200',
  candy_canyon: 'border-orange-400/45 bg-orange-500/20 text-orange-200',
  crystal_cavern: 'border-fuchsia-400/45 bg-fuchsia-500/20 text-fuchsia-200',
};

const RARITY_STYLES: Record<
  SkillRarity,
  {
    label: string;
    cardClass: string;
    badgeClass: string;
    keyClass: string;
  }
> = {
  common: {
    label: 'Thường',
    cardClass:
      'border-slate-400/45 bg-gradient-to-b from-slate-800/80 to-[#131a29] hover:border-slate-300/80',
    badgeClass: 'border-slate-400/45 bg-slate-700/60 text-slate-200',
    keyClass: 'border-slate-500/50 bg-slate-800/90 text-slate-200',
  },
  rare: {
    label: 'Hiếm',
    cardClass:
      'border-cyan-400/70 bg-gradient-to-b from-cyan-950/70 via-[#122033] to-[#0f1726] shadow-[0_0_24px_rgba(34,211,238,0.2)] hover:border-cyan-300',
    badgeClass: 'border-cyan-300/60 bg-cyan-500/20 text-cyan-200',
    keyClass: 'border-cyan-400/60 bg-cyan-950/90 text-cyan-200',
  },
  epic: {
    label: 'Sử Thi',
    cardClass:
      'border-amber-400/85 bg-gradient-to-b from-fuchsia-950/65 via-[#24162c] to-[#1a1220] shadow-[0_0_28px_rgba(251,191,36,0.28)] hover:border-amber-300',
    badgeClass:
      'border-amber-300/75 bg-gradient-to-r from-amber-500/30 to-fuchsia-500/30 text-amber-200',
    keyClass: 'border-amber-400/70 bg-amber-950/90 text-amber-200',
  },
};

function isFormTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * Native modal dialog presenting 3 roguelike skill cards upon team level-up,
 * supporting keyboard shortcuts (`1`/`2`/`3`, `R` reroll) and online co-op sync.
 */
export function LevelUpModal({
  open,
  teamLevel,
  offers,
  rerollsLeft,
  isOnlineCoop,
  hasLocalPicked,
  pickedCount,
  humanCount,
  timerSec,
  onPickSkill,
  onReroll,
}: LevelUpModalProps) {
  const titleId = useId();
  const descId = useId();
  const [pendingAction, setPendingAction] = useState<'pick' | 'reroll' | null>(
    null,
  );
  const firstCardRef = useRef<HTMLButtonElement | null>(null);
  const prevRerollsRef = useRef<number>(rerollsLeft);
  const pendingTimeoutRef = useRef<number | null>(null);

  const offersSignature = offers
    .map((o) => `${o.skillId}:${o.rarity}:${o.nextLevel}`)
    .join('|');

  const clearPending = useCallback(() => {
    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    setPendingAction(null);
  }, []);

  // Clear RTT pending lock whenever modal state/offers/level/pick updates from Host
  useEffect(() => {
    clearPending();
  }, [open, hasLocalPicked, teamLevel, offersSignature, rerollsLeft, clearPending]);

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current !== null) {
        window.clearTimeout(pendingTimeoutRef.current);
      }
    };
  }, []);

  // Preserve keyboard focus when Reroll disables on last charge or refreshes cards
  useEffect(() => {
    const prev = prevRerollsRef.current;
    prevRerollsRef.current = rerollsLeft;
    if (open && !hasLocalPicked && rerollsLeft < prev && offers.length > 0) {
      firstCardRef.current?.focus();
    }
  }, [open, hasLocalPicked, rerollsLeft, offers.length, offersSignature]);

  const startOnlinePending = useCallback((action: 'pick' | 'reroll') => {
    if (!isOnlineCoop) return;
    setPendingAction(action);
    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
    }
    pendingTimeoutRef.current = window.setTimeout(() => {
      pendingTimeoutRef.current = null;
      setPendingAction(null);
    }, 3000);
  }, [isOnlineCoop]);

  const handlePick = useCallback(
    (idx: number) => {
      if (hasLocalPicked || pendingAction !== null || idx < 0 || idx >= offers.length) {
        return;
      }
      startOnlinePending('pick');
      onPickSkill(idx);
    },
    [hasLocalPicked, offers.length, onPickSkill, pendingAction, startOnlinePending],
  );

  const handleReroll = useCallback(() => {
    if (
      hasLocalPicked ||
      pendingAction !== null ||
      rerollsLeft <= 0 ||
      offers.length === 0
    ) {
      return;
    }
    startOnlinePending('reroll');
    onReroll();
  }, [
    hasLocalPicked,
    offers.length,
    onReroll,
    pendingAction,
    rerollsLeft,
    startOnlinePending,
  ]);

  useEffect(() => {
    if (!open || hasLocalPicked || pendingAction !== null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isFormTarget(e.target)) return;

      let pickIdx = -1;
      if (e.key === '1' || (!e.shiftKey && e.code === 'Digit1')) {
        pickIdx = 0;
      } else if (e.key === '2' || (!e.shiftKey && e.code === 'Digit2')) {
        pickIdx = 1;
      } else if (e.key === '3' || (!e.shiftKey && e.code === 'Digit3')) {
        pickIdx = 2;
      }

      if (pickIdx >= 0) {
        if (pickIdx < offers.length) {
          e.preventDefault();
          handlePick(pickIdx);
        }
        return;
      }

      if (e.key === 'r' || e.key === 'R' || e.code === 'KeyR') {
        if (rerollsLeft > 0 && offers.length > 0) {
          e.preventDefault();
          handleReroll();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    handlePick,
    handleReroll,
    hasLocalPicked,
    offers.length,
    open,
    pendingAction,
    rerollsLeft,
  ]);

  const safeTimerSec = Math.max(0, Number.isFinite(timerSec) ? timerSec : 0);
  const timerCeil = Math.ceil(safeTimerSec);
  const timerPct = Math.max(
    0,
    Math.min(100, (safeTimerSec / LEVEL_UP_MAX_TIMER_SEC) * 100),
  );

  return (
    <SurvivalDialogShell
      open={open}
      titleId={titleId}
      describedById={descId}
      dialogClassName="m-auto max-h-[92dvh] w-[min(95vw,56rem)] overflow-y-auto rounded-3xl border-2 border-amber-400/50 bg-[#121826] bg-[radial-gradient(circle_at_50%_0%,_rgba(251,191,36,0.16)_0%,_rgba(18,24,38,0.98)_65%)] p-0 text-[#FFF9F0] shadow-2xl"
    >
      {/* Header */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/45 bg-amber-500/20 text-amber-300 shadow-inner">
              <Zap aria-hidden="true" className="h-6 w-6" />
            </span>
            <div>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-200">
                <Sparkles aria-hidden="true" className="h-3 w-3" />
                <span>Thăng Cấp Đội</span>
              </span>
              <h1
                id={titleId}
                className="mt-1 font-display text-xl font-black tracking-tight text-amber-50 sm:text-2xl"
              >
                LÊN CẤP {teamLevel} — CHỌN KỸ NĂNG
              </h1>
            </div>
          </div>

          {isOnlineCoop && (
            <div className="flex items-center gap-2 rounded-2xl border border-cyan-400/40 bg-[#0b1322] px-3.5 py-2 text-xs font-black text-cyan-200 tabular-nums">
              <Timer aria-hidden="true" className="h-4 w-4 text-cyan-300" />
              <span>
                Còn {timerCeil}s · Đã chọn {pickedCount}/{humanCount}
              </span>
            </div>
          )}
        </div>

        <p id={descId} className="text-xs font-bold text-slate-300 sm:text-sm">
          Chọn 1 nâng cấp để cường hóa sức mạnh chiến đấu cho nhân vật của bạn.
        </p>

        {isOnlineCoop && (
          <div
            role="progressbar"
            aria-label="Thời gian chọn kỹ năng"
            aria-valuemin={0}
            aria-valuemax={LEVEL_UP_MAX_TIMER_SEC}
            aria-valuenow={timerCeil}
            className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-[#090f1c]"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-amber-400 transition-[width] duration-150 motion-reduce:transition-none"
              style={{ width: `${timerPct}%` }}
            />
          </div>
        )}
      </header>

      {/* Body: Waiting state (Online Co-op after local pick) vs 3 Skill Offer Cards */}
      {hasLocalPicked && isOnlineCoop ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-emerald-400/40 bg-emerald-950/35 px-6 py-10 text-center"
        >
          <div
            aria-hidden="true"
            className="h-9 w-9 animate-spin rounded-full border-3 border-emerald-300 border-t-transparent motion-reduce:animate-none"
          />
          <p className="font-display text-lg font-black text-emerald-100">
            Đã chọn kỹ năng! Đang chờ đồng đội ({pickedCount}/{humanCount})...
          </p>
          <p className="text-xs font-bold text-emerald-200/75">
            Trận đấu sẽ tự động tiếp tục khi tất cả người chơi chọn xong hoặc hết giờ.
          </p>
        </div>
      ) : offers.length === 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-slate-600/40 bg-[#0d1422] p-6 text-center text-sm font-bold text-slate-300"
        >
          {isOnlineCoop
            ? `Bạn đã nâng tối đa toàn bộ kỹ năng! Đang chờ đồng đội (${pickedCount}/${humanCount})...`
            : 'Tất cả kỹ năng đã đạt cấp tối đa.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {offers.map((offer, idx) => {
            const spec = getSkillSpec(offer.skillId);
            const cat = CATEGORY_META[spec.category];
            const rarityStyle = RARITY_STYLES[offer.rarity];
            const isEpicBoost = offer.rarity === 'epic' && offer.levelGain > 1;
            const rarityLabel = isEpicBoost
              ? `${rarityStyle.label} · +${offer.levelGain} Cấp`
              : rarityStyle.label;
            const levelText =
              offer.currentLevel === 0
                ? `MỚI! (Lv.0 → Lv.${offer.nextLevel})`
                : `Lv.${offer.currentLevel} → Lv.${offer.nextLevel}`;

            return (
              <button
                key={`${teamLevel}-${rerollsLeft}-${offer.skillId}-${idx}`}
                ref={
                  idx === 0
                    ? (el) => {
                        firstCardRef.current = el;
                        setNativeAutofocus(el);
                      }
                    : undefined
                }
                autoFocus={idx === 0}
                type="button"
                disabled={hasLocalPicked || pendingAction !== null}
                onClick={() => handlePick(idx)}
                className={`group flex h-full cursor-pointer flex-col justify-between rounded-3xl border-2 p-4 text-left transition-transform duration-100 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${rarityStyle.cardClass} ${SURVIVAL_FOCUS_RING_CLASS}`}
              >
                <div className="flex flex-col gap-3">
                  {/* Top Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <span
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${cat.badgeClass}`}
                      >
                        {cat.label}
                      </span>
                      <span
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-black tracking-wide ${SCOPE_BADGE_CLASSES[spec.mapScope]}`}
                      >
                        {SKILL_SCOPE_LABELS[spec.mapScope]}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${rarityStyle.badgeClass}`}
                    >
                      {offer.rarity === 'epic' && (
                        <Sparkles aria-hidden="true" className="h-3 w-3" />
                      )}
                      <span>{rarityLabel}</span>
                    </span>
                  </div>

                  {/* Abstract Skill Emblem + Title */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-[#0b101c]/90 p-1.5 shadow-inner"
                      style={{
                        borderColor: `${spec.color}70`,
                        boxShadow: `0 0 18px ${spec.color}26`,
                      }}
                    >
                      <SkillArt skillId={offer.skillId} className="h-13 w-13" />
                    </div>
                    <div className="min-w-0">
                      <span className="block font-display text-lg font-black leading-snug text-white">
                        {spec.name}
                      </span>
                      <span className="mt-1 inline-flex items-center rounded-lg border border-white/15 bg-black/35 px-2.5 py-0.5 font-mono text-xs font-black text-amber-200 tabular-nums">
                        {levelText}
                      </span>
                    </div>
                  </div>

                  {/* Short Visual-First Description */}
                  <span className="block text-xs font-semibold leading-relaxed text-slate-200/95">
                    {spec.description}
                  </span>
                </div>

                {/* Footer: Per-level summary & Key Hint */}
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                  <span className="text-[11px] font-bold text-amber-200/85">
                    {spec.perLevelSummary}
                  </span>
                  <kbd
                    className={`shrink-0 rounded-lg border px-2 py-0.5 font-mono text-[11px] font-black ${rarityStyle.keyClass}`}
                  >
                    Phím {idx + 1}
                  </kbd>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Footer Reroll Action */}
      {!(hasLocalPicked && isOnlineCoop) && offers.length > 0 && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          <span className="text-xs font-bold text-slate-400">
            {pendingAction === 'pick'
              ? 'Đang gửi lựa chọn kỹ năng...'
              : pendingAction === 'reroll'
                ? 'Đang đổi 3 thẻ kỹ năng mới...'
                : (
                  <>
                    Mẹo: Nhấn{' '}
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-amber-200">
                      1
                    </kbd>{' '}
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-amber-200">
                      2
                    </kbd>{' '}
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-amber-200">
                      3
                    </kbd>{' '}
                    để chọn nhanh
                  </>
                )}
          </span>

          <button
            type="button"
            disabled={
              rerollsLeft <= 0 ||
              hasLocalPicked ||
              pendingAction !== null ||
              offers.length === 0
            }
            onClick={handleReroll}
            className={`btn-tactile-wood inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-amber-400/40 px-4 py-2 text-xs font-black text-amber-100 disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm ${SURVIVAL_FOCUS_RING_CLASS}`}
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4 text-amber-300" />
            <span>
              {pendingAction === 'reroll'
                ? 'Đang đổi thẻ...'
                : `Đổi 3 thẻ khác (${rerollsLeft} lượt) [R]`}
            </span>
          </button>
        </footer>
      )}
    </SurvivalDialogShell>
  );
}
