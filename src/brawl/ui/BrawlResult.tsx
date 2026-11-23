import { playSfx } from '../../audio/soundEngine';
import { BRAWL_ANIMAL_EMOJI } from '../sim/constants';
import { getHumanFinalRank, getSortedStandings } from '../sim/matchStore';
import type { MatchState } from '../sim/types';

export interface BrawlResultProps {
  match: MatchState;
  cookiesEarned: number;
  onPlayAgain: () => void;
  onChangeSettings: () => void;
  onBackToModeSelect: () => void;
}

export function BrawlResult({
  match,
  cookiesEarned,
  onPlayAgain,
  onChangeSettings,
  onBackToModeSelect,
}: BrawlResultProps) {
  const standings = getSortedStandings(match.scores);
  const humanRank = getHumanFinalRank(match.scores);
  const champion = standings[0];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(30,58,95,0.92)_0%,_rgba(11,20,34,0.97)_100%)] p-4 text-white backdrop-blur-md">
      <div className="w-full max-w-xl rounded-3xl border-2 border-amber-300/60 bg-slate-900/95 p-6 shadow-2xl sm:p-8">
        <div className="text-center">
          <div className="text-4xl">{humanRank === 1 ? '🏆' : humanRank <= 3 ? '🥈' : '🐾'}</div>
          <h2 className="mt-2 font-display text-3xl font-black text-amber-300">
            {humanRank === 1
              ? 'NHÀ VÔ ĐỊCH ĐẤU TRƯỜNG!'
              : `Hạng #${humanRank} Chung Cuộc!`}
          </h2>
          {champion && (
            <p className="mt-1 text-sm font-semibold text-slate-300">
              Quán quân: {BRAWL_ANIMAL_EMOJI[champion.animal]} <strong>{champion.name}</strong> ({champion.points} điểm)
            </p>
          )}
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/15 px-4 py-1 text-sm font-black text-amber-200">
            <span>🍪</span>
            <span>+{cookiesEarned} Cookies đã lưu vào hồ sơ!</span>
          </div>
        </div>

        {/* Full 3-round standings table */}
        <div className="mt-6 space-y-2">
          {standings.map((entry, idx) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 text-sm font-bold ${
                entry.id === 'human'
                  ? 'border-amber-300/70 bg-amber-400/15 text-amber-100'
                  : 'border-white/10 bg-white/5 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 text-center font-mono text-base font-black text-amber-300">
                  #{idx + 1}
                </span>
                <span className="text-xl">{BRAWL_ANIMAL_EMOJI[entry.animal]}</span>
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

        <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              playSfx('roundStart');
              onPlayAgain();
            }}
            className="cursor-pointer rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-3 text-sm font-black text-[#1B110B] shadow-lg hover:brightness-105"
          >
            🔄 Chơi Lại
          </button>
          <button
            type="button"
            onClick={() => {
              playSfx('click');
              onChangeSettings();
            }}
            className="cursor-pointer rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20"
          >
            ⚙️ Đổi Cài Đặt
          </button>
          <button
            type="button"
            onClick={() => {
              playSfx('click');
              onBackToModeSelect();
            }}
            className="cursor-pointer rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-white/20"
          >
            ← Chọn Chế Độ
          </button>
        </div>
      </div>
    </div>
  );
}
