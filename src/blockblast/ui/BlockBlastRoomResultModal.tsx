import { useId } from 'react';
import {
  CheckCircle2,
  Cookie,
  Crown,
  Medal,
  Play,
  RotateCcw,
  ShieldAlert,
  Users,
  WifiOff,
} from 'lucide-react';
import { AnimalAvatar } from '../../components/AnimalAvatar.tsx';
import type { BbRoomStanding } from '../online/protocol.ts';
import { NativeModalShell, setNativeAutofocus } from './BlockBlastModals.tsx';

export interface BlockBlastRoomResultModalProps {
  open: boolean;
  roomCode: string;
  roundNumber: number;
  standings: readonly BbRoomStanding[];
  myPeerId: string;
  isHost: boolean;
  canRematch: boolean;
  settlement: { reward: number; isNewBest: boolean; valid: boolean } | null;
  onRematch: () => void;
  onReturnLobby: () => void;
  onLeaveRoom: () => void;
}

const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';

/**
 * End-of-round competitive room summary modal presenting Top-3 podium cards,
 * verified player standings, personal Cookie settlement, and rematch controls.
 */
export function BlockBlastRoomResultModal({
  open,
  roomCode,
  roundNumber,
  standings,
  myPeerId,
  isHost,
  canRematch,
  settlement,
  onRematch,
  onReturnLobby,
  onLeaveRoom,
}: BlockBlastRoomResultModalProps) {
  const titleId = useId();
  const descId = useId();

  const topThree = standings.slice(0, 3);
  const winner = standings[0] ?? null;

  return (
    <NativeModalShell
      open={open}
      titleId={titleId}
      describedById={descId}
      dialogClassName="m-auto max-h-[92dvh] w-[min(94vw,36rem)] overflow-y-auto rounded-3xl border-2 border-amber-400/45 bg-[#23140d] p-0 text-[#FFF9F0] shadow-2xl"
      onResult={(action) => {
        if (action === 'rematch' && isHost && canRematch) {
          onRematch();
          return;
        }
        if (action === 'lobby' && isHost) {
          onReturnLobby();
          return;
        }
        if (action === 'leave') {
          onLeaveRoom();
        }
      }}
    >
      <form method="dialog" className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-300/45 bg-yellow-500/15 px-3 py-0.5 text-xs font-black text-yellow-200">
              <Crown aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Phòng {roomCode} · Kết Quả Ván #{roundNumber}</span>
            </span>
            <h2 id={titleId} className="mt-2 font-display text-2xl font-black text-amber-50">
              {winner && winner.verification === 'verified'
                ? `${winner.name} Giành Quán Quân!`
                : 'Hoàn Thành Ván Đấu!'}
            </h2>
          </div>
        </div>

        <p id={descId} className="text-xs leading-relaxed text-amber-100/80">
          Bảng xếp hạng đã được kiểm chứng tự động qua replay seed chung. Điểm
          không hợp lệ tự động bị đẩy xuống cuối bảng.
        </p>

        {/* Top 3 Podium Cards */}
        {topThree.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {topThree.map((entry) => {
              const cardBorder =
                entry.rank === 1
                  ? 'border-yellow-300/65 bg-gradient-to-b from-yellow-500/20 to-[#180e09]'
                  : entry.rank === 2
                    ? 'border-slate-300/50 bg-gradient-to-b from-slate-300/15 to-[#180e09]'
                    : 'border-orange-400/45 bg-gradient-to-b from-orange-500/15 to-[#180e09]';
              return (
                <div
                  key={entry.peerId}
                  className={`rounded-2xl border p-3 text-center ${cardBorder}`}
                >
                  <div className="inline-flex items-center gap-1 text-xs font-black text-amber-200">
                    <Medal aria-hidden="true" className="h-3.5 w-3.5 text-yellow-300" />
                    <span>Hạng #{entry.rank}</span>
                  </div>
                  <div className="mt-2 flex justify-center">
                    <AnimalAvatar
                      animal={entry.animal}
                      size="md"
                      frameId={entry.avatarFrame}
                    />
                  </div>
                  <div className="mt-1.5 truncate text-sm font-black text-white">
                    {entry.name}
                    {entry.peerId === myPeerId ? ' (Bạn)' : ''}
                  </div>
                  <div className="mt-0.5 font-display text-lg font-black text-amber-300 tabular-nums">
                    {entry.score.toLocaleString('vi-VN')}đ
                  </div>
                  <div className="text-[11px] font-bold text-amber-200/70">
                    Stage {entry.stage} · {entry.linesCleared} dòng
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full Standings Table */}
        <div className="space-y-1.5 rounded-2xl border border-amber-900/50 bg-[#170d08] p-3">
          {standings.map((entry) => {
            const isSelf = entry.peerId === myPeerId;
            return (
              <div
                key={entry.peerId}
                className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                  isSelf
                    ? 'border-amber-400/55 bg-amber-500/12'
                    : 'border-amber-900/35 bg-[#20120c]'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 font-black text-amber-300 tabular-nums">
                    #{entry.rank}
                  </span>
                  <span className="truncate font-extrabold text-amber-50">
                    {entry.name}
                    {isSelf ? ' (Bạn)' : ''}
                  </span>
                  {entry.verification === 'verified' ? (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                      <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                      Đã xác thực
                    </span>
                  ) : entry.verification === 'invalid' ? (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
                      <ShieldAlert aria-hidden="true" className="h-3 w-3" />
                      Không hợp lệ
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-slate-600/30 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                      <WifiOff aria-hidden="true" className="h-3 w-3" />
                      Rời trận
                    </span>
                  )}
                </div>

                <div className="shrink-0 text-right font-extrabold text-amber-200 tabular-nums">
                  {entry.score.toLocaleString('vi-VN')}đ
                </div>
              </div>
            );
          })}
        </div>

        {/* Personal Cookie Reward */}
        {settlement && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-400/35 bg-emerald-950/50 px-4 py-2.5 text-xs font-extrabold">
            <span className="flex items-center gap-1.5 text-emerald-200">
              <Cookie aria-hidden="true" className="h-4 w-4 text-amber-300" />
              <span>
                {settlement.isNewBest
                  ? 'Thưởng trận & Phá kỷ lục cá nhân!'
                  : 'Thưởng Cookies cá nhân:'}
              </span>
            </span>
            <span className="font-black text-emerald-300 tabular-nums">
              {settlement.valid ? `+${settlement.reward} Cookies` : '0 Cookies'}
            </span>
          </div>
        )}

        {/* Actions */}
        {isHost ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              ref={setNativeAutofocus}
              type="submit"
              value="rematch"
              disabled={!canRematch}
              className={`btn-tactile-emerald inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING_CLASS}`}
            >
              <Play aria-hidden="true" className="h-4 w-4" />
              <span>Đấu Ván Mới (Seed Mới)</span>
            </button>
            <button
              type="submit"
              value="lobby"
              className={`btn-tactile-amber inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-sm font-black text-[#26160b] ${FOCUS_RING_CLASS}`}
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              <span>Về Sảnh Phòng</span>
            </button>
            <button
              type="submit"
              value="leave"
              className={`btn-tactile-wood inline-flex cursor-pointer items-center justify-center rounded-2xl border border-rose-500/40 px-4 py-3 text-xs font-black text-rose-200 ${FOCUS_RING_CLASS}`}
            >
              Rời Phòng
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-200/80">
              <Users aria-hidden="true" className="h-4 w-4 text-amber-300" />
              <span>Đang chờ chủ phòng bắt đầu ván mới hoặc quay về sảnh...</span>
            </div>
            <button
              ref={setNativeAutofocus}
              type="submit"
              value="leave"
              className={`btn-tactile-wood inline-flex cursor-pointer items-center justify-center rounded-2xl border border-rose-500/40 px-5 py-2.5 text-sm font-black text-rose-200 ${FOCUS_RING_CLASS}`}
            >
              Rời Phòng
            </button>
          </div>
        )}
      </form>
    </NativeModalShell>
  );
}
