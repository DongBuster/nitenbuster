import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Crown,
  Eye,
  Flame,
  ShieldAlert,
  Trophy,
  WifiOff,
} from 'lucide-react';
import { ANIMALS } from '../../engine/types.ts';
import type { BbRoomStanding } from '../online/protocol.ts';

export interface BlockBlastLiveLeaderboardProps {
  standings: readonly BbRoomStanding[];
  myPeerId: string;
  selectedPeerId?: string | null;
  onSelectPeer?: (peerId: string) => void;
  compactMobile?: boolean;
  roomCode: string;
  roundNumber: number;
}

const ANIMAL_ACCENT_BY_ID = new Map(ANIMALS.map((a) => [a.id, a.accentHex]));

function renderStandingRowContent(
  entry: BbRoomStanding,
  isSelf: boolean,
  isWatching: boolean,
) {
  const accentHex = ANIMAL_ACCENT_BY_ID.get(entry.animal) ?? '#F59E0B';
  const rankBadgeClass =
    entry.rank === 1
      ? 'border-yellow-300/60 bg-yellow-400/20 text-yellow-200'
      : entry.rank === 2
        ? 'border-slate-300/50 bg-slate-300/15 text-slate-100'
        : entry.rank === 3
          ? 'border-orange-400/50 bg-orange-500/20 text-orange-200'
          : 'border-amber-800/60 bg-[#1a0f0a] text-amber-200/80';

  let statusPill = (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/35 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Đang chơi
    </span>
  );
  if (entry.verification === 'invalid') {
    statusPill = (
      <span className="inline-flex items-center gap-0.5 rounded-md border border-rose-400/45 bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
        <ShieldAlert aria-hidden="true" className="h-3 w-3" />
        Lỗi
      </span>
    );
  } else if (entry.status === 'disconnected') {
    statusPill = (
      <span className="inline-flex items-center gap-0.5 rounded-md border border-slate-500/45 bg-slate-700/35 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
        <WifiOff aria-hidden="true" className="h-3 w-3" />
        Rời
      </span>
    );
  } else if (entry.status === 'finished') {
    statusPill = (
      <span className="inline-flex items-center rounded-md border border-amber-400/35 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
        Xong
      </span>
    );
  }

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-black tabular-nums ${rankBadgeClass}`}
        >
          {entry.rank === 1 ? (
            <Crown aria-hidden="true" className="h-3.5 w-3.5 text-yellow-300" />
          ) : (
            entry.rank
          )}
        </span>

        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/40"
          style={{ backgroundColor: accentHex }}
        />

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-extrabold text-amber-50">
              {entry.name}
            </span>
            {isSelf && (
              <span className="shrink-0 rounded bg-amber-400/20 px-1 py-0.5 text-[10px] font-black text-amber-300">
                Bạn
              </span>
            )}
            {isWatching && (
              <Eye aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-sky-300" />
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-amber-200/70">
            <span>Stage {entry.stage}</span>
            {entry.streak >= 2 && (
              <span className="inline-flex items-center gap-0.5 text-amber-300">
                <Flame aria-hidden="true" className="h-3 w-3" />
                {entry.streak}x
              </span>
            )}
            {statusPill}
          </div>
        </div>
      </div>

      <div className="shrink-0 text-right font-display text-sm font-black text-amber-100 tabular-nums">
        {entry.score.toLocaleString('vi-VN')}
      </div>
    </>
  );
}

/**
 * Real-time room standings card. Renders as a full list on desktop or when
 * compactMobile is false, and as a collapsible summary bar on compact mobile viewports.
 */
export function BlockBlastLiveLeaderboard({
  standings,
  myPeerId,
  selectedPeerId = null,
  onSelectPeer,
  compactMobile = false,
  roomCode,
  roundNumber,
}: BlockBlastLiveLeaderboardProps) {
  const [expanded, setExpanded] = useState(false);

  const activeCount = standings.filter((s) => s.status === 'playing').length;
  const topLeader = standings[0] ?? null;
  const myEntry = standings.find((s) => s.peerId === myPeerId) ?? null;

  const listMarkup = (
    <div className="space-y-1.5" aria-live="polite">
      {standings.map((entry) => {
        const isSelf = entry.peerId === myPeerId;
        const isSelected = selectedPeerId === entry.peerId;
        const baseRowClass = `flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
          isSelected
            ? 'border-sky-400 bg-sky-950/55 ring-1 ring-sky-300/60'
            : isSelf
              ? 'border-amber-400/50 bg-amber-500/12'
              : 'border-amber-900/45 bg-[#190e09]/90'
        }`;

        if (onSelectPeer) {
          return (
            <button
              key={entry.peerId}
              type="button"
              onClick={() => onSelectPeer(entry.peerId)}
              aria-pressed={isSelected}
              className={`${baseRowClass} cursor-pointer hover:border-sky-300/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300`}
            >
              {renderStandingRowContent(entry, isSelf, isSelected)}
            </button>
          );
        }

        return (
          <div key={entry.peerId} className={baseRowClass}>
            {renderStandingRowContent(entry, isSelf, false)}
          </div>
        );
      })}
    </div>
  );

  if (compactMobile) {
    return (
      <section
        aria-label="Bảng xếp hạng phòng thu gọn"
        className="w-full max-w-[492px] rounded-2xl border border-amber-500/30 bg-[#24150e]/95 px-3 py-2 shadow-md"
      >
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="flex w-full cursor-pointer items-center justify-between gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          <div className="flex min-w-0 items-center gap-2 text-xs font-extrabold text-amber-100">
            <Trophy aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span className="truncate">
              {myEntry
                ? `Hạng #${myEntry.rank}/${standings.length}`
                : `${standings.length} người đấu`}
              {topLeader
                ? ` · Top 1: ${topLeader.name} (${topLeader.score.toLocaleString('vi-VN')}đ)`
                : ''}
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-amber-300">
            <span>{activeCount} sống</span>
            {expanded ? (
              <ChevronUp aria-hidden="true" className="h-4 w-4" />
            ) : (
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            )}
          </span>
        </button>

        {expanded && <div className="mt-2.5 border-t border-amber-900/40 pt-2">{listMarkup}</div>}
      </section>
    );
  }

  return (
    <section
      aria-label="Bảng xếp hạng trực tiếp"
      className="rounded-2xl border border-amber-500/25 bg-[#24150e]/95 p-3 shadow-lg sm:rounded-3xl sm:p-4"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Trophy aria-hidden="true" className="h-4 w-4 text-amber-400" />
          <h2 className="text-xs font-black uppercase tracking-wider text-amber-200">
            Phòng {roomCode} · Ván #{roundNumber}
          </h2>
        </div>
        <span className="rounded-full border border-emerald-400/35 bg-emerald-950/70 px-2 py-0.5 text-[11px] font-bold text-emerald-200">
          {activeCount}/{standings.length} đang chơi
        </span>
      </div>

      <div className="max-h-[290px] overflow-y-auto pr-0.5">{listMarkup}</div>
    </section>
  );
}
