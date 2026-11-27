import { useState } from 'react';
import { Clock, LogOut, Trophy, X } from 'lucide-react';
import { playSfx } from '../../audio/soundEngine';
import { AnimalAvatar } from '../../components/AnimalAvatar';
import { ANIMALS } from '../../engine/types';
import { EVENT_GAME_META, type EventRoundConfig, type EventStanding } from '../protocol';
import { formatSecondsClock } from '../scoring';

export interface EventTimerHudProps {
  round: EventRoundConfig;
  secondsLeft: number;
  standings: EventStanding[];
  myPeerId: string;
  extraStatusText?: string | null;
  onLeaveEvent: () => void;
}

/**
 * Shared floating top bar overlaid above each active game adapter during Event play.
 * Keeps pointer events disabled except on interactive controls so gameplay is unobstructed.
 */
export function EventTimerHud({
  round,
  secondsLeft,
  standings,
  myPeerId,
  extraStatusText,
  onLeaveEvent,
}: EventTimerHudProps) {
  const [showStandings, setShowStandings] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const meta = EVENT_GAME_META[round.gameId];
  const isUrgent = secondsLeft <= 15 && secondsLeft > 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2.5 z-50 flex flex-col items-center px-3">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-amber-400/35 bg-[#1b110b]/92 px-3 py-1.5 text-amber-50 shadow-[0_12px_30px_rgba(0,0,0,0.55)] backdrop-blur-md">
        {/* Round badge */}
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-500/20 px-2.5 py-1 text-[11px] font-black text-amber-200">
          <Trophy className="h-3.5 w-3.5 text-amber-300" />
          <span>
            EVENT · VÒNG {round.roundIndex + 1}/{round.totalRounds}
          </span>
        </span>

        {/* Active game title */}
        <span
          className={`inline-flex items-center rounded-xl border px-2.5 py-1 text-[11px] font-extrabold ${meta.badgeClass}`}
        >
          {meta.shortTitle}
        </span>

        {extraStatusText && (
          <span className="rounded-xl border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/90">
            {extraStatusText}
          </span>
        )}

        {/* Synchronized countdown clock */}
        <div
          aria-live="polite"
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-black tabular-nums ${
            isUrgent
              ? 'animate-pulse border-rose-400/60 bg-rose-500/30 text-rose-100'
              : 'border-white/20 bg-black/45 text-amber-100'
          }`}
        >
          <Clock className={`h-3.5 w-3.5 ${isUrgent ? 'text-rose-300' : 'text-amber-300'}`} />
          <span>{formatSecondsClock(secondsLeft)}</span>
        </div>

        {/* Toggle cumulative standings drawer */}
        <button
          type="button"
          onClick={() => {
            playSfx('click');
            setShowStandings((v) => !v);
          }}
          className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-extrabold text-amber-100 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-amber-300"
        >
          <Trophy className="h-3.5 w-3.5 text-amber-300" />
          <span>BXH</span>
        </button>

        {/* Leave event button */}
        {!confirmLeave ? (
          <button
            type="button"
            onClick={() => {
              playSfx('click');
              setConfirmLeave(true);
            }}
            aria-label="Rời phòng Event"
            className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-rose-400/35 bg-rose-500/15 px-2.5 py-1 text-[11px] font-extrabold text-rose-200 transition hover:bg-rose-500/30 focus-visible:outline-2 focus-visible:outline-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Rời</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-1 rounded-xl border border-rose-400/60 bg-rose-950/90 px-2 py-0.5 text-[11px] font-bold text-rose-100">
            <span>Thoát giải?</span>
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onLeaveEvent();
              }}
              className="cursor-pointer rounded-lg bg-rose-500 px-2 py-0.5 font-black text-white hover:bg-rose-400"
            >
              Rời
            </button>
            <button
              type="button"
              onClick={() => setConfirmLeave(false)}
              className="cursor-pointer rounded-lg bg-white/15 px-1.5 py-0.5 font-bold text-white hover:bg-white/25"
            >
              Hủy
            </button>
          </div>
        )}
      </div>

      {/* Expandable quick standings popover */}
      {showStandings && (
        <div className="pointer-events-auto mt-2 w-full max-w-xs rounded-2xl border border-amber-400/35 bg-[#1b110b]/95 p-3 text-amber-50 shadow-2xl backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wide text-amber-300">
              Bảng Điểm Tổng Event
            </span>
            <button
              type="button"
              onClick={() => setShowStandings(false)}
              aria-label="Đóng bảng điểm"
              className="cursor-pointer rounded-lg p-1 text-amber-200/70 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="space-y-1">
            {standings.map((s, idx) => {
              const animalMeta =
                ANIMALS.find((a) => a.id === s.animal) ?? ANIMALS[0];
              const isMe = s.peerId === myPeerId;
              return (
                <li
                  key={s.peerId}
                  className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs ${
                    isMe
                      ? 'border border-amber-400/50 bg-amber-400/15 font-black text-amber-100'
                      : 'bg-white/5 font-bold text-amber-100/85'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 text-center font-black text-amber-300">
                      #{idx + 1}
                    </span>
                    <AnimalAvatar animal={animalMeta.id} size="xs" />
                    <span className="truncate">
                      {s.name} {isMe ? '(Bạn)' : ''}
                    </span>
                  </div>
                  <span className="ml-2 shrink-0 font-black text-amber-300">
                    {s.totalPoints} đ
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
