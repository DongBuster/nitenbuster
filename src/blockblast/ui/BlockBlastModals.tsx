import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import {
  AlertTriangle,
  Bomb,
  Cookie,
  HelpCircle,
  Layers,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';

const PROGRAMMATIC_CLOSE = '__programmatic__';

const BASE_DIALOG_CLASS =
  'm-auto max-h-[90dvh] w-[min(92vw,28rem)] overflow-y-auto rounded-3xl border-2 border-amber-500/35 bg-[#23140d] p-0 text-[#FFF9F0] shadow-2xl';

const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';

/**
 * Ensures HTML `autofocus` content attribute is present on the safe/primary button
 * so native `dialog.showModal()` focuses it reliably even after prior mounts.
 */
export function setNativeAutofocus(el: HTMLButtonElement | null): void {
  if (el) {
    el.autofocus = true;
  }
}

function isOutsideDialogBounds(
  e: PointerEvent,
  dialog: HTMLDialogElement,
): boolean {
  const rect = dialog.getBoundingClientRect();
  return (
    e.clientX < rect.left ||
    e.clientX > rect.right ||
    e.clientY < rect.top ||
    e.clientY > rect.bottom
  );
}

/**
 * Synchronizes a declarative `open` boolean with a native top-layer `<dialog>`
 * using `.showModal()` / `.close()`, plus progressive light-dismiss fallback.
 */
function useNativeModal(
  dialogRef: RefObject<HTMLDialogElement | null>,
  open: boolean,
  lightDismiss = false,
): RefObject<boolean> {
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
  }, [dialogRef, open]);

  useEffect(() => {
    if (!lightDismiss) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if ('closedBy' in HTMLDialogElement.prototype) return;

    let pressedOutside = false;
    const handlePointerDown = (e: PointerEvent) => {
      pressedOutside = dialog.open && isOutsideDialogBounds(e, dialog);
    };
    const handlePointerUp = (e: PointerEvent) => {
      if (pressedOutside && dialog.open && isOutsideDialogBounds(e, dialog)) {
        dialog.close('dismiss');
      }
      pressedOutside = false;
    };

    dialog.addEventListener('pointerdown', handlePointerDown);
    dialog.addEventListener('pointerup', handlePointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', handlePointerDown);
      dialog.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dialogRef, lightDismiss]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) {
        dialog.close(PROGRAMMATIC_CLOSE);
      }
    };
  }, [dialogRef]);

  return openRef;
}

export interface NativeModalShellProps {
  open: boolean;
  titleId: string;
  describedById?: string;
  lightDismiss?: boolean;
  dialogClassName?: string;
  onResult: (returnValue: string) => void;
  children: ReactNode;
}

export function NativeModalShell({
  open,
  titleId,
  describedById,
  lightDismiss = false,
  dialogClassName,
  onResult,
  children,
}: NativeModalShellProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openRef = useNativeModal(dialogRef, open, lightDismiss);

  const handleClose = (e: SyntheticEvent<HTMLDialogElement>) => {
    const dialog = e.currentTarget;
    const action = dialog.returnValue;
    dialog.returnValue = '';

    if (dialog.open || !openRef.current || action === PROGRAMMATIC_CLOSE) {
      return;
    }
    onResult(action);
  };

  const extraAttrs = lightDismiss
    ? ({ closedby: 'any' } as Record<string, string>)
    : undefined;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={describedById}
      onClose={handleClose}
      {...extraAttrs}
      className={dialogClassName ?? BASE_DIALOG_CLASS}
    >
      <div className="p-6">{children}</div>
    </dialog>
  );
}

export interface RescueDialogProps {
  open: boolean;
  cookies: number;
  bombCost: number;
  onUseBomb: () => void;
  onDecline: () => void;
}

/**
 * Rescue prompt offering a once-per-match 3x3 Candy Bomb when no tray piece fits.
 */
export function RescueDialog({
  open,
  cookies,
  bombCost,
  onUseBomb,
  onDecline,
}: RescueDialogProps) {
  const titleId = useId();
  const descId = useId();
  const canAfford = cookies >= bombCost;

  return (
    <NativeModalShell
      open={open}
      titleId={titleId}
      describedById={descId}
      onResult={(action) => {
        if (action === 'useBomb' && canAfford) {
          onUseBomb();
          return;
        }
        onDecline();
      }}
    >
      <form method="dialog" className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-400/40 bg-rose-500/20 text-rose-200 shadow-inner">
              <Bomb aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h1 id={titleId} className="text-xl font-black leading-tight text-amber-50">
                Hết Nước Đi Hợp Lệ!
              </h1>
              <p className="mt-0.5 text-xs font-bold text-amber-200/75">
                Giải cứu bàn cờ bằng Bom Kẹo 3×3
              </p>
            </div>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/35 bg-[#160c07] px-3 py-1 text-xs font-extrabold text-amber-200">
            <Cookie aria-hidden="true" className="h-3.5 w-3.5 text-amber-400" />
            <span>{cookies.toLocaleString('vi-VN')}</span>
          </span>
        </div>

        <p id={descId} className="text-sm font-medium leading-relaxed text-amber-100/90">
          Các mảnh hiện tại trong khay đều hết chỗ đặt trên bàn 8×8. Bạn có thể kích
          hoạt <strong>Bom Kẹo 3×3</strong> (tối đa 1 lần mỗi ván) để phá 9 ô dọn đường,
          hoặc kết thúc ván và nhận Cookies ngay.
        </p>

        {!canAfford && (
          <div
            role="note"
            className="flex items-center gap-2 rounded-2xl border border-rose-400/35 bg-rose-950/50 px-3.5 py-2.5 text-xs font-bold text-rose-200"
          >
            <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-300" />
            <span>
              Không đủ Cookies để dùng Bom Kẹo (cần {bombCost}, hiện có {cookies}).
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
          <button
            type="submit"
            value="useBomb"
            disabled={!canAfford}
            className={`btn-tactile-amber inline-flex min-h-[46px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING_CLASS}`}
          >
            <Bomb aria-hidden="true" className="h-4 w-4" />
            <span>Dùng Bom Kẹo 3×3 (-{bombCost} Cookies)</span>
          </button>

          <button
            ref={setNativeAutofocus}
            autoFocus
            type="submit"
            value="decline"
            className={`btn-tactile-wood inline-flex min-h-[46px] cursor-pointer items-center justify-center rounded-2xl border border-amber-900/60 px-4 py-2.5 text-sm font-bold ${FOCUS_RING_CLASS}`}
          >
            Kết Thúc Ván
          </button>
        </div>
      </form>
    </NativeModalShell>
  );
}

export interface GameOverDialogProps {
  open: boolean;
  score: number;
  bestScore: number;
  isNewBest: boolean;
  linesCleared: number;
  maxStreak: number;
  cookiesEarned: number;
  settlementValid: boolean;
  onPlayAgain: () => void;
  onBackToModes: () => void;
  onDismiss?: () => void;
}

/**
 * End-of-match summary modal presenting verified score, streaks, and Cookie rewards.
 */
export function GameOverDialog({
  open,
  score,
  bestScore,
  isNewBest,
  linesCleared,
  maxStreak,
  cookiesEarned,
  settlementValid,
  onPlayAgain,
  onBackToModes,
  onDismiss,
}: GameOverDialogProps) {
  const titleId = useId();

  return (
    <NativeModalShell
      open={open}
      titleId={titleId}
      onResult={(action) => {
        if (action === 'playAgain') {
          onPlayAgain();
          return;
        }
        if (action === 'backToModes') {
          onBackToModes();
          return;
        }
        if (onDismiss) {
          onDismiss();
        } else {
          onBackToModes();
        }
      }}
    >
      <form method="dialog" className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/20 text-amber-300 shadow-inner">
              <Trophy aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h1 id={titleId} className="text-2xl font-black leading-tight text-amber-50">
                Kết Thúc Ván
              </h1>
              {isNewBest && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-gradient-to-r from-amber-400 to-orange-400 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-[#24130a] shadow">
                  <Sparkles aria-hidden="true" className="h-3 w-3" />
                  <span>New Best!</span>
                </span>
              )}
            </div>
          </div>

          {onDismiss && (
            <button
              type="submit"
              value="dismiss"
              aria-label="Đóng bảng kết quả để xem lại bàn cờ"
              className={`inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-amber-800/60 bg-[#1a0f0a] text-amber-200/80 transition hover:border-amber-400/50 hover:text-amber-50 ${FOCUS_RING_CLASS}`}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-amber-500/25 bg-[#190e09] p-4 text-center shadow-inner">
          <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300/75">
            Tổng Điểm
          </div>
          <div className="mt-1 font-[var(--font-display)] text-4xl font-black tracking-tight text-amber-100">
            {score.toLocaleString('vi-VN')}
          </div>
          <div className="mt-1 text-xs font-bold text-amber-200/75">
            Kỷ lục: <span className="text-amber-200">{bestScore.toLocaleString('vi-VN')}đ</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-amber-900/50 bg-[#1b100a] px-3.5 py-2.5 text-center">
            <div className="text-[11px] font-bold text-amber-200/70">Dòng Đã Xóa</div>
            <div className="mt-0.5 text-lg font-black text-amber-50">
              {linesCleared.toLocaleString('vi-VN')}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-900/50 bg-[#1b100a] px-3.5 py-2.5 text-center">
            <div className="text-[11px] font-bold text-amber-200/70">Streak Tối Đa</div>
            <div className="mt-0.5 text-lg font-black text-amber-50">{maxStreak}×</div>
          </div>
        </div>

        {settlementValid ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-950/60 px-4 py-2.5 text-sm font-black text-emerald-200">
            <Cookie aria-hidden="true" className="h-4 w-4 text-amber-300" />
            <span>+{cookiesEarned} Cookies</span>
          </div>
        ) : (
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-2xl border border-amber-400/35 bg-amber-950/45 px-3.5 py-2.5 text-xs font-bold leading-relaxed text-amber-200"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>
              Không thể xác thực biên lai trận đấu hoặc ván đã được ghi nhận trước đó —
              chưa cộng thêm Cookies.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
          <button
            ref={setNativeAutofocus}
            autoFocus
            type="submit"
            value="playAgain"
            className={`btn-tactile-emerald inline-flex min-h-[46px] flex-1 cursor-pointer items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-black ${FOCUS_RING_CLASS}`}
          >
            Chơi Lại
          </button>

          <button
            type="submit"
            value="backToModes"
            className={`btn-tactile-wood inline-flex min-h-[46px] cursor-pointer items-center justify-center rounded-2xl border border-amber-900/60 px-4 py-2.5 text-sm font-bold ${FOCUS_RING_CLASS}`}
          >
            Đổi Chế Độ
          </button>
        </div>
      </form>
    </NativeModalShell>
  );
}

export interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Concise rules and scoring modal for PAWS Block Blast.
 */
export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const titleId = useId();

  return (
    <NativeModalShell
      open={open}
      titleId={titleId}
      lightDismiss
      onResult={() => onClose()}
    >
      <form method="dialog" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/35 bg-amber-500/20 text-amber-300">
              <HelpCircle aria-hidden="true" className="h-5 w-5" />
            </span>
            <h1 id={titleId} className="text-xl font-black text-amber-50">
              Luật Chơi Block Blast
            </h1>
          </div>

          <button
            type="submit"
            value="close"
            aria-label="Đóng hướng dẫn"
            className={`inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-amber-800/60 bg-[#1a0f0a] text-amber-200/80 transition hover:border-amber-400/50 hover:text-amber-50 ${FOCUS_RING_CLASS}`}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <ul className="flex flex-col gap-2.5 text-sm leading-relaxed text-amber-100/90">
          <li className="flex items-start gap-2.5 rounded-2xl border border-amber-900/40 bg-[#1a0f0a] p-3">
            <Layers aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>
              <strong>Lưới 8×8 &amp; Khay 3 mảnh:</strong> Kéo hoặc chạm chọn từng mảnh
              vào bàn cờ 8×8. Đặt hết cả 3 mảnh sẽ bốc bộ 3 mảnh mới.
            </span>
          </li>

          <li className="flex items-start gap-2.5 rounded-2xl border border-amber-900/40 bg-[#1a0f0a] p-3">
            <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <span>
              <strong>Ăn dòng đồng thời:</strong> Lấp đầy hàng ngang hoặc cột dọc để phá
              khối. Phá nhiều hàng/cột cùng lúc nhân điểm Combo; dọn sạch toàn bàn thưởng
              thêm <strong>+1.000đ</strong>.
            </span>
          </li>

          <li className="flex items-start gap-2.5 rounded-2xl border border-amber-900/40 bg-[#1a0f0a] p-3">
            <Trophy aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
            <span>
              <strong>Streak &amp; 1 lượt ân hạn:</strong> Ăn dòng liên tiếp để tăng chuỗi
              Streak. Nếu đặt 1 mảnh chưa ăn dòng, bạn vẫn giữ Streak nhờ{' '}
              <strong>1 lượt ân hạn</strong>.
            </span>
          </li>

          <li className="flex items-start gap-2.5 rounded-2xl border border-amber-900/40 bg-[#1a0f0a] p-3">
            <RotateCcw aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>
              <strong>1 lần Đổi Khay miễn phí:</strong> Dùng nút Đổi Khay (Reroll) một
              lần mỗi ván để làm mới bộ 3 mảnh vừa khít khoảng trống trên bàn.
            </span>
          </li>

          <li className="flex items-start gap-2.5 rounded-2xl border border-amber-900/40 bg-[#1a0f0a] p-3">
            <Cookie aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong>Thưởng 5–50 Cookies:</strong> Kết thúc ván nhận{' '}
              <strong>5–50 Cookies</strong> theo mốc điểm (cộng thêm 5 Cookies khi phá kỷ
              lục).
            </span>
          </li>
        </ul>

        <button
          ref={setNativeAutofocus}
          autoFocus
          type="submit"
          value="close"
          className={`btn-tactile-amber mt-1 inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-black ${FOCUS_RING_CLASS}`}
        >
          Đã Hiểu
        </button>
      </form>
    </NativeModalShell>
  );
}

export interface RestartConfirmDialogProps {
  open: boolean;
  currentScore: number;
  onConfirmRestart: () => void;
  onCancel: () => void;
}

/**
 * Confirmation modal guarding against accidental mid-match score reset.
 */
export function RestartConfirmDialog({
  open,
  currentScore,
  onConfirmRestart,
  onCancel,
}: RestartConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();

  return (
    <NativeModalShell
      open={open}
      titleId={titleId}
      describedById={descId}
      onResult={(action) => {
        if (action === 'confirm') {
          onConfirmRestart();
          return;
        }
        onCancel();
      }}
    >
      <form method="dialog" className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/35 bg-amber-500/20 text-amber-300 shadow-inner">
            <RotateCcw aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h1 id={titleId} className="text-xl font-black text-amber-50">
              Chơi Lại Ván Mới?
            </h1>
            <p className="mt-0.5 text-xs font-bold text-amber-200/75">
              Xác nhận đặt lại bàn cờ 8×8
            </p>
          </div>
        </div>

        <p id={descId} className="text-sm font-medium leading-relaxed text-amber-100/90">
          Ván hiện tại đang có{' '}
          <strong className="text-amber-300">
            {currentScore.toLocaleString('vi-VN')}đ
          </strong>{' '}
          và chưa kết thúc để quy đổi Cookies. Bắt đầu ván mới sẽ bỏ qua tiến trình ván
          đang chơi.
        </p>

        <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
          <button
            ref={setNativeAutofocus}
            autoFocus
            type="submit"
            value="cancel"
            className={`btn-tactile-emerald inline-flex min-h-[46px] flex-1 cursor-pointer items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-black ${FOCUS_RING_CLASS}`}
          >
            Tiếp Tục Chơi
          </button>

          <button
            type="submit"
            value="confirm"
            className={`btn-tactile-wood inline-flex min-h-[46px] cursor-pointer items-center justify-center rounded-2xl border border-amber-900/60 px-4 py-2.5 text-sm font-bold ${FOCUS_RING_CLASS}`}
          >
            Chơi Ván Mới
          </button>
        </div>
      </form>
    </NativeModalShell>
  );
}
