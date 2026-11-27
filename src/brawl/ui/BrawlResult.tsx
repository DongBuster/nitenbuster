import {
  ArrowLeft,
  Cookie,
  RotateCcw,
  Settings,
  Trophy,
} from 'lucide-react';
import { playSfx } from '../../audio/soundEngine';
import { AnimalAvatar } from '../../components/AnimalAvatar';
import { getHumanFinalRank, getSortedStandings } from '../sim/matchStore';
import type { MatchState } from '../sim/types';

export interface BrawlResultProps {
  match: MatchState;
  cookiesEarned: number;
  onPlayAgain: () => void;
  onChangeSettings: () => void;
  onBackToModeSelect: () => void;
  localFighterId?: string;
  isOnline?: boolean;
  isHost?: boolean;
  secondaryLabel?: string;
  exitLabel?: string;
}

export function BrawlResult({
  match,
  cookiesEarned,
  onPlayAgain,
  onChangeSettings,
  onBackToModeSelect,
  localFighterId = 'human',
  isOnline = false,
  isHost = true,
  secondaryLabel = 'Đổi Cài Đặt',
  exitLabel = 'Chọn Chế Độ',
}: BrawlResultProps) {
  const standings = getSortedStandings(match.scores);
  const humanRank = getHumanFinalRank(match.scores, localFighterId);
  const champion = standings[0];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 text-white backdrop-blur-md">
      <div className="w-full max-w-xl rounded-3xl border-2 border-amber-400/50 bg-[#132032] p-6 shadow-2xl sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/15 text-amber-300 shadow-inner">
            <Trophy className="h-8 w-8 text-amber-400" />
          </div>
          <h2 className="mt-3 font-display text-3xl font-black text-amber-300">
            {humanRank === 1
              ? 'NHÀ VÔ ĐỊCH ĐẤU TRƯỜNG!'
              : `Hạng #${humanRank} Chung Cuộc`}
          </h2>
          {champion && (
            <p className="mt-1 text-sm font-semibold text-slate-300">
              Quán quân: <strong>{champion.name}</strong> ({champion.points} điểm)
            </p>
          )}
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-4 py-1 text-sm font-black text-amber-200">
            <Cookie className="h-4 w-4 text-amber-400" />
            <span>+{cookiesEarned} Cookies đã cộng vào ví!</span>
          </div>
        </div>

        {/* Full 3-round standings table */}
        <div className="mt-6 space-y-2">
          {standings.map((entry, idx) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 text-sm font-bold ${
                entry.id === localFighterId
                  ? 'border-amber-400/60 bg-amber-400/15 text-amber-100'
                  : 'border-white/10 bg-white/5 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 text-center font-mono text-base font-black text-amber-300">
                  #{idx + 1}
                </span>
                <AnimalAvatar animal={entry.animal} size="sm" />
                <span>{entry.name}</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden gap-1 text-[11px] text-slate-400 sm:flex">
                  {entry.roundPointsHistory.map((pts, rIdx) => (
                    <span key={rIdx} className="rounded bg-white/10 px-1.5 py-0.5">
                      H{rIdx + 1}: +{pts}
                    </span>
                  ))}
                </div>
                <span className="rounded-xl bg-amber-400/20 px-2.5 py-1 font-mono text-sm font-black text-amber-200">
                  {entry.points}đ
                </span>
              </div>
            </div>
          ))}
        </div>

        {isOnline && !isHost ? (
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="w-full rounded-2xl border border-sky-400/30 bg-sky-950/50 px-4 py-3 text-center text-xs font-bold text-sky-200">
              Chờ chủ phòng bắt đầu ván mới hoặc quay về phòng chờ...
            </div>
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onBackToModeSelect();
              }}
              className="btn-tactile-wood inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/20 px-4 py-3 text-sm font-bold text-slate-200 sm:w-auto sm:px-6"
            >
              <ArrowLeft className="h-4 w-4 text-slate-400" />
              <span>{exitLabel}</span>
            </button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                playSfx('roundStart');
                onPlayAgain();
              }}
              className="btn-tactile-amber inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-[#1B110B]"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Chơi Lại</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onChangeSettings();
              }}
              className="btn-tactile-wood inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/20 px-4 py-3 text-sm font-bold text-white"
            >
              <Settings className="h-4 w-4 text-amber-300" />
              <span>{secondaryLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onBackToModeSelect();
              }}
              className="btn-tactile-wood inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/20 px-4 py-3 text-sm font-bold text-slate-200"
            >
              <ArrowLeft className="h-4 w-4 text-slate-400" />
              <span>{exitLabel}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
