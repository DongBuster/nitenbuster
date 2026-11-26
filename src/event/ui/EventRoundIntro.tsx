import { Clock, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { ANIMALS } from '../../engine/types';
import {
  EVENT_GAME_META,
  type EventMember,
  type EventRoundConfig,
} from '../protocol';
import { formatSecondsClock } from '../scoring';

export interface EventRoundIntroProps {
  round: EventRoundConfig;
  roster: EventMember[];
  myPeerId: string;
  secondsLeft: number;
}

export function EventRoundIntro({
  round,
  roster,
  myPeerId,
  secondsLeft,
}: EventRoundIntroProps) {
  const meta = EVENT_GAME_META[round.gameId];
  const memberById = new Map(roster.map((m) => [m.peerId, m]));

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#160d09] bg-[radial-gradient(circle_at_50%_15%,_#3f2314_0%,_transparent_58%),linear-gradient(180deg,_#1b100b_0%,_#0e0906_100%)] p-4 text-[#FFF9F0]">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border-2 border-amber-400/40 bg-[#24140d]/95 shadow-[0_24px_64px_rgba(0,0,0,0.65)]">
        {/* Banner Header */}
        <div className="relative">
          <picture className="block">
            <source srcSet={meta.bannerWebp} type="image/webp" />
            <img
              src={meta.bannerJpg}
              alt={meta.title}
              className="aspect-[16/7] w-full object-cover"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-[#24140d] via-[#24140d]/35 to-transparent" />
          <div className="absolute left-5 top-4 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-black/70 px-3.5 py-1.5 text-xs font-black tracking-wide text-amber-200 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>
              VÒNG {round.roundIndex + 1} / {round.totalRounds}
            </span>
          </div>
          <div className="absolute right-5 top-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/75 px-3.5 py-1.5 text-xs font-black text-white backdrop-blur-md">
            <Clock className="h-3.5 w-3.5 text-amber-300" />
            <span>
              Giới hạn: {formatSecondsClock(round.timeLimitSec)}
              {round.gameId === 'brawl' ? ` × ${round.brawlRounds} hiệp` : ''}
            </span>
          </div>
        </div>

        <div className="space-y-4 px-6 pb-6 pt-2">
          <div>
            <h1 className="font-display text-3xl font-black text-white sm:text-4xl">
              {meta.title}
            </h1>
            <p className="mt-1 text-sm text-amber-100/85">{meta.tagline}</p>
          </div>

          <div className="rounded-2xl border border-amber-500/25 bg-black/30 p-3.5 text-xs text-amber-100/90">
            <div className="flex items-center gap-1.5 font-black uppercase tracking-wide text-amber-300">
              <ShieldCheck className="h-4 w-4" />
              <span>Luật Xếp Hạng & Hết Giờ</span>
            </div>
            <p className="mt-1 leading-relaxed">{meta.tieBreakSummary}</p>
          </div>

          {/* Glass Carry pair preview */}
          {round.gameId === 'glassCarry' && round.glassPairs.length > 0 && (
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-950/35 p-3.5">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-cyan-200">
                <Users className="h-4 w-4 text-cyan-300" />
                <span>Phân Cặp Khiêng Kính Vòng Này</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {round.glassPairs.map((pair, idx) => {
                  const isMine = pair.memberIds.includes(myPeerId);
                  return (
                    <div
                      key={pair.pairId}
                      className={`rounded-xl border px-3 py-2 text-xs ${
                        isMine
                          ? 'border-cyan-300/60 bg-cyan-400/20 text-white'
                          : 'border-white/10 bg-black/30 text-cyan-100/85'
                      }`}
                    >
                      <div className="font-black text-cyan-300">
                        {pair.mode === 'solo'
                          ? `Đội #${idx + 1} · Solo Tự Cân Bằng`
                          : `Đội #${idx + 1} · Cặp 2 Người`}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {pair.memberIds.map((pid) => {
                          const m = memberById.get(pid);
                          const metaAnimal =
                            ANIMALS.find((a) => a.id === m?.animal) ?? ANIMALS[0];
                          return (
                            <span
                              key={pid}
                              className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 font-bold"
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: metaAnimal.accentHex }}
                              />
                              <span>
                                {m?.name ?? pid}
                                {pid === myPeerId ? ' (Bạn)' : ''}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Synchronized countdown footer */}
          <div className="flex items-center justify-between rounded-2xl border border-amber-400/35 bg-amber-500/15 px-5 py-3">
            <span className="text-sm font-extrabold text-amber-100">
              Chuẩn bị vào trận đấu...
            </span>
            <span className="font-display text-3xl font-black tabular-nums text-amber-300">
              {Math.max(1, secondsLeft)}s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
