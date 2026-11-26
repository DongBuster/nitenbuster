import { ArrowRight, Crown, Medal, Sparkles, Trophy } from 'lucide-react';
import { playSfx } from '../../audio/soundEngine';
import { ANIMALS } from '../../engine/types';
import {
  EVENT_GAME_META,
  type EventMember,
  type EventRoundConfig,
  type EventRoundSummary,
  type EventStanding,
} from '../protocol';

export interface EventRoundResultProps {
  round: EventRoundConfig;
  summary: EventRoundSummary;
  roster: EventMember[];
  standings: EventStanding[];
  myPeerId: string;
  isHost: boolean;
  autoAdvanceSecondsLeft: number;
  onAdvanceNext: () => void;
}

export function EventRoundResult({
  round,
  summary,
  roster,
  standings,
  myPeerId,
  isHost,
  autoAdvanceSecondsLeft,
  onAdvanceNext,
}: EventRoundResultProps) {
  const meta = EVENT_GAME_META[round.gameId];
  const memberById = new Map(roster.map((m) => [m.peerId, m]));
  const isFinalRound = round.roundIndex + 1 >= round.totalRounds;

  return (
    <div className="min-h-screen bg-[#160d09] bg-[radial-gradient(circle_at_50%_0%,_#3d2113_0%,_transparent_52%),linear-gradient(180deg,_#1c110c_0%,_#100906_100%)] px-4 py-6 text-[#FFF9F0]">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Header */}
        <header className="flex flex-col gap-3 rounded-3xl border border-amber-400/35 bg-[#26150d]/95 px-6 py-5 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>
                KẾT THÚC VÒNG {round.roundIndex + 1}/{round.totalRounds} · {meta.title}
              </span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-black text-white sm:text-3xl">
              {summary.aborted ? 'Vòng Đấu Bị Gián Đoạn' : 'Kết Quả Vòng Đấu & Bảng Điểm Tổng'}
            </h1>
            {summary.reason && (
              <p className="mt-1 text-xs font-bold text-rose-300">{summary.reason}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isHost ? (
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  onAdvanceNext();
                }}
                className="btn-tactile-amber inline-flex cursor-pointer items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-[#26160b] focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                <span>
                  {isFinalRound ? 'Xem Bục Vinh Quang' : 'Vòng Tiếp Theo'}
                  {autoAdvanceSecondsLeft > 0 ? ` (${autoAdvanceSecondsLeft}s)` : ''}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="rounded-2xl border border-amber-400/30 bg-black/35 px-4 py-2.5 text-xs font-bold text-amber-200">
                {autoAdvanceSecondsLeft > 0
                  ? `Tự động chuyển sau ${autoAdvanceSecondsLeft}s...`
                  : 'Đang chờ Host chuyển vòng...'}
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Round Placement Card */}
          <section className="rounded-3xl border border-white/15 bg-[#22130c]/90 p-5 shadow-xl">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-black text-amber-200">
              <Medal className="h-5 w-5 text-amber-400" />
              <span>Thứ Hạng Vòng Này</span>
            </h2>
            <div className="space-y-2">
              {summary.results.map((r) => {
                const m = memberById.get(r.peerId);
                const animalMeta =
                  ANIMALS.find((a) => a.id === m?.animal) ?? ANIMALS[0];
                const isMe = r.peerId === myPeerId;
                return (
                  <div
                    key={r.peerId}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 ${
                      isMe
                        ? 'border-amber-400/55 bg-amber-400/15'
                        : 'border-white/10 bg-black/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                          r.rank === 1
                            ? 'bg-amber-400 text-[#26160b]'
                            : r.rank === 2
                              ? 'bg-slate-200 text-slate-900'
                              : r.rank === 3
                                ? 'bg-amber-700 text-amber-50'
                                : 'bg-white/10 text-amber-100/80'
                        }`}
                      >
                        #{r.rank}
                      </span>
                      <span
                        className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white/25"
                        style={{ backgroundColor: animalMeta.accentHex }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-white">
                          {m?.name ?? r.peerId} {isMe ? '(Bạn)' : ''}
                        </div>
                        <div className="text-[11px] font-semibold text-amber-100/70">
                          {r.metricLabel}
                        </div>
                      </div>
                    </div>
                    <span className="ml-3 shrink-0 rounded-xl bg-emerald-500/20 px-2.5 py-1 text-xs font-black text-emerald-300">
                      +{r.pointsAwarded} đ
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Cumulative Standings Card */}
          <section className="rounded-3xl border border-amber-400/30 bg-[#22130c]/90 p-5 shadow-xl">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-black text-amber-200">
              <Trophy className="h-5 w-5 text-amber-400" />
              <span>Bảng Điểm Tổng Giải Đấu</span>
            </h2>
            <div className="space-y-2">
              {standings.map((s, idx) => {
                const animalMeta =
                  ANIMALS.find((a) => a.id === s.animal) ?? ANIMALS[0];
                const isMe = s.peerId === myPeerId;
                return (
                  <div
                    key={s.peerId}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 ${
                      isMe
                        ? 'border-amber-400/60 bg-amber-400/15'
                        : 'border-white/10 bg-black/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-black/45 text-xs font-black text-amber-300">
                        {idx === 0 ? <Crown className="h-4 w-4 text-amber-400" /> : `#${idx + 1}`}
                      </span>
                      <span
                        className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white/25"
                        style={{ backgroundColor: animalMeta.accentHex }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-white">
                          {s.name} {isMe ? '(Bạn)' : ''}
                        </div>
                        <div className="text-[11px] font-semibold text-amber-100/65">
                          {s.firstPlaces} lần hạng nhất
                        </div>
                      </div>
                    </div>
                    <span className="ml-3 shrink-0 font-display text-lg font-black text-amber-300">
                      {s.totalPoints} đ
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
