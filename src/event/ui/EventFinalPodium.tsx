import { useEffect, useRef, useState } from 'react';
import { Cookie, Crown, Home, RotateCcw, Trophy } from 'lucide-react';
import { playSfx } from '../../audio/soundEngine';
import { ANIMALS } from '../../engine/types';
import { useProfileStore } from '../../store/profileStore';
import {
  EVENT_GAME_META,
  type EventRoundSummary,
  type EventStanding,
} from '../protocol';
import { getEventCookieReward } from '../scoring';

export interface EventFinalPodiumProps {
  eventMatchId: string;
  standings: EventStanding[];
  roundHistory: EventRoundSummary[];
  myPeerId: string;
  isHost: boolean;
  onPlayAgain: () => void;
  onLeaveEvent: () => void;
}

export function EventFinalPodium({
  eventMatchId,
  standings,
  roundHistory,
  myPeerId,
  isHost,
  onPlayAgain,
  onLeaveEvent,
}: EventFinalPodiumProps) {
  const { recordEventResult } = useProfileStore();
  const [rewardedCookies, setRewardedCookies] = useState<number>(0);
  const settledIdRef = useRef<string>('');

  const myIndex = standings.findIndex((s) => s.peerId === myPeerId);
  const myFinalRank = myIndex >= 0 ? myIndex + 1 : standings.length || 1;

  useEffect(() => {
    if (!eventMatchId || standings.length < 2) return;
    if (settledIdRef.current === eventMatchId) return;
    settledIdRef.current = eventMatchId;

    playSfx(myFinalRank === 1 ? 'win' : 'roundStart');
    const res = recordEventResult({
      matchId: eventMatchId,
      rank: myFinalRank,
      totalPlayers: standings.length,
    });
    setRewardedCookies(res.ok ? res.reward : getEventCookieReward(myFinalRank));
  }, [eventMatchId, myFinalRank, recordEventResult, standings.length]);

  const top3 = standings.slice(0, 3);
  // Visual podium order: 2nd - 1st - 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(
    (x): x is EventStanding => Boolean(x),
  );

  return (
    <div className="min-h-screen bg-[#160d09] bg-[radial-gradient(circle_at_50%_0%,_#4d2b15_0%,_transparent_54%),linear-gradient(180deg,_#1e120c_0%,_#0d0806_100%)] px-4 py-8 text-[#FFF9F0]">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Title Banner */}
        <header className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/45 bg-amber-500/20 px-4 py-1.5 text-xs font-black tracking-wide text-amber-200">
            <Trophy className="h-4 w-4 text-amber-300" />
            <span>TỔNG KẾT PAWS EVENT CUP</span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-black text-white sm:text-5xl">
            {standings[0]
              ? `Nhà Vô Địch: ${standings[0].name}!`
              : 'Kết Thúc Giải Đấu'}
          </h1>
          <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-black/40 px-4 py-2 text-sm font-black text-amber-200">
            <Cookie className="h-4 w-4 text-amber-400" />
            <span>
              Hạng #{myFinalRank} của bạn nhận +{rewardedCookies} Cookies!
            </span>
          </div>
        </header>

        {/* Top 3 Podium */}
        <section className="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
          {podiumOrder.map((entry) => {
            const rank = standings.findIndex((s) => s.peerId === entry.peerId) + 1;
            const animalMeta =
              ANIMALS.find((a) => a.id === entry.animal) ?? ANIMALS[0];
            const isFirst = rank === 1;
            const heightClass =
              rank === 1
                ? 'sm:min-h-[220px] border-amber-300/70 bg-gradient-to-b from-amber-500/30 to-[#28160d]'
                : rank === 2
                  ? 'sm:min-h-[180px] border-slate-300/45 bg-gradient-to-b from-slate-300/20 to-[#22130c]'
                  : 'sm:min-h-[155px] border-amber-700/60 bg-gradient-to-b from-amber-800/30 to-[#1f120b]';

            return (
              <div
                key={entry.peerId}
                className={`flex flex-col items-center justify-between rounded-3xl border-2 p-5 text-center shadow-2xl ${heightClass}`}
              >
                <div className="flex flex-col items-center">
                  {isFirst ? (
                    <Crown className="mb-1 h-8 w-8 text-amber-300" />
                  ) : (
                    <span className="mb-1 text-xs font-black uppercase tracking-wider text-amber-200/75">
                      Hạng #{rank}
                    </span>
                  )}
                  <div
                    className="mt-1 flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-white/30 text-sm font-black text-white shadow-inner"
                    style={{ backgroundColor: animalMeta.accentHex }}
                  >
                    {animalMeta.name.slice(0, 2).toUpperCase()}
                  </div>
                  <h2 className="mt-2 font-display text-xl font-black text-white">
                    {entry.name}
                    {entry.peerId === myPeerId ? ' (Bạn)' : ''}
                  </h2>
                  <div className="text-xs font-bold text-amber-100/70">
                    {animalMeta.name} · {entry.firstPlaces} lần nhất
                  </div>
                </div>
                <div className="mt-4 rounded-2xl bg-black/40 px-4 py-1.5 font-display text-2xl font-black text-amber-300">
                  {entry.totalPoints} điểm
                </div>
              </div>
            );
          })}
        </section>

        {/* Full Breakdown Table */}
        <section className="overflow-x-auto rounded-3xl border border-white/15 bg-[#22130c]/95 p-5 shadow-xl">
          <h3 className="mb-3 font-display text-lg font-black text-amber-200">
            Bảng Điểm Chi Tiết Từng Vòng
          </h3>
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-amber-200/70">
                <th className="py-2 pr-3 font-black">Hạng</th>
                <th className="py-2 pr-3 font-black">Người Chơi</th>
                {roundHistory.map((r) => (
                  <th key={r.roundIndex} className="px-2 py-2 text-center font-black">
                    V{r.roundIndex + 1} · {EVENT_GAME_META[r.gameId].shortTitle}
                  </th>
                ))}
                <th className="py-2 pl-3 text-right font-black text-amber-300">Tổng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {standings.map((s, idx) => (
                <tr
                  key={s.peerId}
                  className={s.peerId === myPeerId ? 'bg-amber-400/10' : ''}
                >
                  <td className="py-2.5 pr-3 font-black text-amber-300">#{idx + 1}</td>
                  <td className="py-2.5 pr-3 font-bold text-white">
                    {s.name} {s.peerId === myPeerId ? '(Bạn)' : ''}
                  </td>
                  {roundHistory.map((r) => (
                    <td
                      key={r.roundIndex}
                      className="px-2 py-2.5 text-center font-bold text-amber-100/85"
                    >
                      +{s.roundPoints[r.roundIndex] ?? 0}
                    </td>
                  ))}
                  <td className="py-2.5 pl-3 text-right font-display text-sm font-black text-amber-300">
                    {s.totalPoints} đ
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Footer Actions */}
        <footer className="flex flex-wrap items-center justify-center gap-3">
          {isHost ? (
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onPlayAgain();
              }}
              className="btn-tactile-amber inline-flex cursor-pointer items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black text-[#26160b]"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Chơi Giải Mới (Về Sảnh Event)</span>
            </button>
          ) : (
            <div className="rounded-2xl border border-amber-400/30 bg-black/35 px-4 py-3 text-xs font-bold text-amber-200">
              Chờ Host mở giải mới hoặc rời phòng...
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              playSfx('click');
              onLeaveEvent();
            }}
            className="btn-tactile-wood inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/20 px-5 py-3.5 text-sm font-black text-amber-100"
          >
            <Home className="h-4 w-4" />
            <span>Rời Phòng Event</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
