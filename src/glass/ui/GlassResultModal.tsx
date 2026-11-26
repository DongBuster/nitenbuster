import {
  useEffect,
  useId,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Cookie,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Star,
  Timer,
  Trophy,
  Users,
} from 'lucide-react';
import { playSfx } from '../../audio/soundEngine';
import {
  calculateCoopResult,
  getCoopMapMeta,
  getNextCoopMapId,
  type CoopMapId,
} from '../../coop/maps/registry';
import type { GlassRoomController } from '../online/useGlassRoom';

export interface GlassResultModalProps {
  room: GlassRoomController;
  mapId?: CoopMapId;
  elapsedSec: number;
  shatters: number;
  settlement: {
    ok: boolean;
    reward: number;
    stars: 1 | 2 | 3;
    isNewBest: boolean;
  } | null;
  onBackToModeSelect: () => void;
}

const PROGRAMMATIC_CLOSE = '__programmatic__';

const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300';

function setNativeAutofocus(el: HTMLButtonElement | null): void {
  if (el) {
    el.autofocus = true;
  }
}

function formatTotalTime(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const totalHundredths = Math.round(safe * 100);
  const hundredths = totalHundredths % 100;
  const totalSeconds = Math.floor(totalHundredths / 100);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

/**
 * End-of-course modal for PAWS Duo Co-op 3D displaying 1-3 star rating,
 * completion time, map-adaptive failure count, Cookies reward, and next-map/rematch controls.
 */
export function GlassResultModal({
  room,
  mapId,
  elapsedSec,
  shatters,
  settlement,
  onBackToModeSelect,
}: GlassResultModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dismissed && !dialog.open && dialog.isConnected) {
      dialog.returnValue = '';
      dialog.showModal();
    } else if (dismissed && dialog.open) {
      dialog.close(PROGRAMMATIC_CLOSE);
    }
  }, [dismissed]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) {
        dialog.close(PROGRAMMATIC_CLOSE);
      }
    };
  }, []);

  const resolvedMapId = mapId ?? room.finalResult?.mapId ?? room.selectedMap;
  const mapMeta = getCoopMapMeta(resolvedMapId);
  const nextMapMeta = getCoopMapMeta(getNextCoopMapId(resolvedMapId));

  const fallback = calculateCoopResult(resolvedMapId, elapsedSec, shatters);
  const stars = settlement?.stars ?? fallback.stars;
  const cookies = settlement
    ? settlement.ok
      ? settlement.reward
      : 0
    : fallback.cookies;

  const handleClose = (e: SyntheticEvent<HTMLDialogElement>) => {
    const dialog = e.currentTarget;
    const action = dialog.returnValue;
    dialog.returnValue = '';

    if (action === PROGRAMMATIC_CLOSE) {
      return;
    }

    if (action === 'next' && room.isHost) {
      playSfx('roundStart');
      room.startNextMap();
      return;
    }

    if (action === 'restart' && room.isHost) {
      playSfx('roundStart');
      room.restartMatch();
      return;
    }

    if (action === 'lobby' && room.isHost) {
      playSfx('click');
      room.returnToLobby();
      return;
    }

    if (action === 'back') {
      playSfx('click');
      room.leaveRoom();
      onBackToModeSelect();
      return;
    }

    setDismissed(true);
  };

  const handleCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
  };

  return (
    <>
      {dismissed && (
        <div className="pointer-events-auto fixed bottom-5 right-5 z-40">
          <button
            type="button"
            onClick={() => {
              playSfx('click');
              setDismissed(false);
            }}
            className={`btn-tactile-amber inline-flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black text-[#26160b] shadow-xl ${FOCUS_RING_CLASS}`}
          >
            <Trophy aria-hidden="true" className="h-4 w-4" />
            <span>Xem Kết Quả</span>
          </button>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descId}
        onCancel={handleCancel}
        onClose={handleClose}
        {...({ closedby: 'none' } as Record<string, string>)}
        className="m-auto max-h-[92dvh] w-[min(94vw,34rem)] overflow-y-auto rounded-3xl border-2 border-cyan-400/45 bg-[#121d2d] p-0 text-[#FFF9F0] shadow-2xl"
      >
        <form method="dialog" className="flex flex-col gap-5 p-6 sm:p-7">
          {/* Header & Stars */}
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-400/15 text-amber-300 shadow-inner">
              <Trophy aria-hidden="true" className="h-7 w-7 text-amber-300" />
            </div>

            <div className="mt-4 flex items-center justify-center gap-2.5">
              <span className="sr-only">Đạt {stars} trên 3 sao</span>
              {[1, 2, 3].map((idx) => {
                const earned = idx <= stars;
                return (
                  <Star
                    key={idx}
                    aria-hidden="true"
                    className={`h-9 w-9 transition-transform motion-reduce:transition-none ${
                      earned
                        ? 'scale-105 fill-amber-400 text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)] motion-reduce:scale-100'
                        : 'fill-slate-800/80 text-slate-600'
                    }`}
                  />
                );
              })}
            </div>

            <h1
              id={titleId}
              className="mt-3 font-display text-2xl font-black text-white sm:text-3xl"
            >
              Hoàn Thành: {mapMeta.title}!
            </h1>

            <p id={descId} className="mt-1 text-xs font-bold text-slate-300">
              {room.p1Member?.name ?? 'P1'} &amp; {room.p2Member?.name ?? 'P2'}{' '}
              đã chinh phục chặng {mapMeta.shortTitle} an toàn.
            </p>

            {settlement?.isNewBest && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-gradient-to-r from-amber-400 to-orange-400 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#24130a] shadow">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Kỷ Lục Mới!</span>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-cyan-400/30 bg-[#0a1320] px-4 py-3 text-center">
              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-200/80">
                <Timer aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
                <span>Tổng Thời Gian</span>
              </div>
              <div className="mt-1 font-mono text-2xl font-black text-white tabular-nums">
                {formatTotalTime(elapsedSec)}
              </div>
            </div>

            <div className="rounded-2xl border border-rose-400/30 bg-[#0a1320] px-4 py-3 text-center">
              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-200/80">
                <ShieldAlert
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-rose-300"
                />
                <span>{mapMeta.failureLabel}</span>
              </div>
              <div className="mt-1 font-mono text-2xl font-black text-white tabular-nums">
                {shatters}
              </div>
            </div>
          </div>

          {/* Cookies Reward */}
          <div className="flex items-center justify-between rounded-2xl border border-amber-400/35 bg-amber-500/12 px-4 py-3 text-sm font-black">
            <span className="inline-flex items-center gap-2 text-amber-100">
              <Cookie aria-hidden="true" className="h-5 w-5 text-amber-300" />
              <span>
                {settlement && !settlement.ok
                  ? 'Trận đã được ghi nhận trước đó'
                  : 'Phần Thưởng Đồng Đội'}
              </span>
            </span>
            <span className="font-mono text-base font-black text-amber-300 tabular-nums">
              +{cookies} Cookies
            </span>
          </div>

          {/* Action Controls */}
          {room.isHost ? (
            <div className="flex flex-col gap-2.5">
              <button
                ref={setNativeAutofocus}
                autoFocus
                type="submit"
                value="next"
                className={`btn-tactile-cyan inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-[#06222c] ${FOCUS_RING_CLASS}`}
              >
                <span>Map Tiếp Theo ({nextMapMeta.shortTitle})</span>
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  type="submit"
                  value="restart"
                  className={`btn-tactile-amber inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-[#26160b] ${FOCUS_RING_CLASS}`}
                >
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />
                  <span>Chơi Lại</span>
                </button>

                <button
                  type="submit"
                  value="lobby"
                  className={`btn-tactile-wood inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-amber-100 ${FOCUS_RING_CLASS}`}
                >
                  <Users aria-hidden="true" className="h-4 w-4 text-amber-300" />
                  <span>Đổi Map (Về Sảnh)</span>
                </button>
              </div>

              <button
                type="submit"
                value="back"
                className={`btn-tactile-wood inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-2 text-xs font-black text-slate-200 ${FOCUS_RING_CLASS}`}
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4 text-slate-300" />
                <span>Về Chọn Chế Độ</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/25 bg-[#0a1320] px-4 py-3 text-xs font-bold text-cyan-200">
                <Users aria-hidden="true" className="h-4 w-4 text-cyan-300" />
                <span>
                  Đang chờ Chủ phòng chọn Map tiếp theo hoặc chơi lại...
                </span>
              </div>

              <button
                ref={setNativeAutofocus}
                autoFocus
                type="submit"
                value="back"
                className={`btn-tactile-wood inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-amber-100 ${FOCUS_RING_CLASS}`}
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4 text-amber-300" />
                <span>Về Chọn Chế Độ</span>
              </button>
            </div>
          )}
        </form>
      </dialog>
    </>
  );
}
