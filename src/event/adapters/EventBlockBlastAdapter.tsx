import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import type { BlastGameState } from '../../blockblast/engine/types';
import type { MatchReceipt } from '../../blockblast/engine/verify';
import { AnimalAvatar } from '../../components/AnimalAvatar';
import BlockBlastScreen, {
  type BlockBlastRoomModeConfig,
} from '../../screens/BlockBlastScreen';
import { rankEventRound } from '../scoring';
import type { EventAdapterProps } from './types';

interface BbEventProgressPayload {
  peerId: string;
  score: number;
  linesCleared: number;
  alive: boolean;
  elapsedMs: number;
}

/**
 * Runs a shared-seed Block Blast PAWS round inside an Event room.
 * Freezes all boards when Host's Event time limit expires and ranks players
 * by score → linesCleared → survival time.
 */
export function EventBlockBlastAdapter({ room, round }: EventAdapterProps) {
  const {
    myPeerId,
    roomCode,
    roster,
    members,
    isHost,
    leaveRoom,
    sendGameEvent,
    subscribeGameEvent,
    submitHostRoundComplete,
  } = room;

  const [progressByPeer, setProgressByPeer] = useState<
    Record<string, BbEventProgressPayload>
  >(() => {
    const initial: Record<string, BbEventProgressPayload> = {};
    for (const m of roster) {
      initial[m.peerId] = {
        peerId: m.peerId,
        score: 0,
        linesCleared: 0,
        alive: true,
        elapsedMs: 0,
      };
    }
    return initial;
  });
  const [forceFinishToken, setForceFinishToken] = useState<number>(0);

  const progressRef = useRef(progressByPeer);
  progressRef.current = progressByPeer;
  const membersRef = useRef(members);
  membersRef.current = members;
  const startedAtRef = useRef<number>(Date.now());
  const submittedRef = useRef<boolean>(false);
  const lastSendAtRef = useRef<number>(0);

  const finalizeRoundFromHost = useCallback(() => {
    if (!isHost || submittedRef.current) return;
    submittedRef.current = true;

    const latest = progressRef.current;
    const ranked = rankEventRound(
      roster.map((m) => {
        const rec = latest[m.peerId] ?? {
          score: 0,
          linesCleared: 0,
          elapsedMs: 0,
        };
        return {
          peerId: m.peerId,
          primaryScore: rec.score,
          secondaryScore: rec.linesCleared,
          tertiaryScore: rec.elapsedMs,
          metricLabel: `${rec.score.toLocaleString()} điểm · ${rec.linesCleared} hàng`,
        };
      }),
    );

    submitHostRoundComplete(round.roundId, ranked);
  }, [isHost, roster, round.roundId, submitHostRoundComplete]);

  // Listen to peer progress updates with stable subscribeGameEvent callback
  useEffect(() => {
    return subscribeGameEvent('bb_progress', (raw) => {
      const evt = raw as BbEventProgressPayload;
      if (!evt || typeof evt.peerId !== 'string') return;
      setProgressByPeer((prev) => {
        const existing = prev[evt.peerId];
        if (existing && !existing.alive && evt.alive) return prev;
        const next = {
          ...prev,
          [evt.peerId]: evt,
        };
        progressRef.current = next;
        return next;
      });
    });
  }, [subscribeGameEvent]);

  // Trigger freeze on Event timeout & Host completion check when all active players finish
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (now >= round.roundDeadlineMs) {
        setForceFinishToken((t) => (t === 0 ? 1 : t));
        if (isHost && now >= round.roundDeadlineMs + 1100) {
          finalizeRoundFromHost();
        }
        return;
      }

      if (isHost && !submittedRef.current) {
        const connectedRoster = roster.filter((m) =>
          membersRef.current.some((live) => live.peerId === m.peerId),
        );
        if (
          connectedRoster.length > 0 &&
          connectedRoster.every(
            (m) => progressRef.current[m.peerId]?.alive === false,
          )
        ) {
          finalizeRoundFromHost();
        }
      }
    }, 300);

    return () => window.clearInterval(timer);
  }, [finalizeRoundFromHost, isHost, roster, round.roundDeadlineMs]);

  const handleProgress = useCallback(
    (state: BlastGameState) => {
      const now = Date.now();
      if (now - lastSendAtRef.current < 450 && state.phase === 'playing') return;
      lastSendAtRef.current = now;
      const payload: BbEventProgressPayload = {
        peerId: myPeerId,
        score: state.score,
        linesCleared: state.linesCleared,
        alive: state.phase !== 'gameOver',
        elapsedMs: Math.max(0, now - startedAtRef.current),
      };
      sendGameEvent('bb_progress', payload);
    },
    [myPeerId, sendGameEvent],
  );

  const handleFinish = useCallback(
    (receipt: MatchReceipt, finalState: BlastGameState) => {
      const payload: BbEventProgressPayload = {
        peerId: myPeerId,
        score: finalState.score,
        linesCleared: finalState.linesCleared,
        alive: false,
        elapsedMs: receipt.elapsedMs,
      };
      sendGameEvent('bb_progress', payload);
    },
    [myPeerId, sendGameEvent],
  );

  const liveStandings = useMemo(() => {
    return [...roster]
      .map((m) => ({
        member: m,
        stats: progressByPeer[m.peerId] ?? {
          peerId: m.peerId,
          score: 0,
          linesCleared: 0,
          alive: true,
          elapsedMs: 0,
        },
      }))
      .sort((a, b) => {
        if (b.stats.score !== a.stats.score) return b.stats.score - a.stats.score;
        return b.stats.linesCleared - a.stats.linesCleared;
      });
  }, [progressByPeer, roster]);

  const leaderboardNode = useMemo(
    () => (
      <div className="rounded-2xl border border-emerald-400/30 bg-[#0d1f19]/92 p-3 text-xs text-emerald-50 shadow-xl">
        <div className="mb-2 flex items-center gap-1.5 font-black uppercase tracking-wide text-emerald-300">
          <Trophy className="h-3.5 w-3.5" />
          <span>Điểm Vòng Xếp Khối</span>
        </div>
        <ul className="space-y-1.5">
          {liveStandings.map(({ member, stats }, idx) => {
            const isMe = member.peerId === myPeerId;
            return (
              <li
                key={member.peerId}
                className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 ${
                  isMe
                    ? 'border border-emerald-300/60 bg-emerald-400/20 font-black'
                    : 'bg-black/30 font-bold'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-emerald-300">#{idx + 1}</span>
                  <AnimalAvatar animal={member.animal} size="xs" />
                  <span className="truncate">
                    {member.name}
                    {!stats.alive ? ' (Xong)' : ''}
                  </span>
                </div>
                <span className="ml-2 shrink-0 font-mono font-black text-amber-300">
                  {stats.score.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    ),
    [liveStandings, myPeerId],
  );

  const roomModeConfig: BlockBlastRoomModeConfig = useMemo(
    () => ({
      roomCode,
      matchId: round.roundId,
      seed: round.seed,
      roundNumber: round.roundIndex + 1,
      isCountingDown: false,
      countdownSeconds: 0,
      leaderboardDesktop: leaderboardNode,
      leaderboardMobile: leaderboardNode,
      lastEmote: null,
      onProgress: handleProgress,
      onFinish: handleFinish,
      onLeaveRoom: leaveRoom,
      suppressStandaloneSettlement: true,
      forceFinishToken,
    }),
    [
      forceFinishToken,
      handleFinish,
      handleProgress,
      leaderboardNode,
      leaveRoom,
      roomCode,
      round.roundId,
      round.roundIndex,
      round.seed,
    ],
  );

  return (
    <div className="pt-12">
      <BlockBlastScreen
        onBackToModeSelect={leaveRoom}
        roomMode={roomModeConfig}
      />
    </div>
  );
}
