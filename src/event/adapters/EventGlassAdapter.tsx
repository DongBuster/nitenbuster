import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { CheckCircle2, ShieldAlert, Users } from 'lucide-react';
import {
  GLASS_INPUT_INTERVAL_MS,
  type CoopSnapshotPayload,
  type GlassEmotePayload,
  type GlassInputPayload,
  type GlassRoomMember,
} from '../../glass/online/protocol';
import type { GlassRoomController } from '../../glass/online/useGlassRoom';
import { GlassScene } from '../../glass/render/GlassScene';
import type { GlassHudSnapshot } from '../../glass/render/renderTypes';
import { GLASS_MAX_HP } from '../../glass/sim/constants';
import { GLASS_COURSE } from '../../glass/sim/course';
import type { PlayerInput } from '../../glass/sim/types';
import { getSupabaseClient } from '../../online/supabaseClient';
import type { GlassPairAssignment } from '../protocol';
import { rankEventRound } from '../scoring';
import type { EventAdapterProps } from './types';

interface GlassTeamProgressPayload {
  pairId: string;
  memberIds: string[];
  progressPct: number;
  shatters: number;
  finished: boolean;
  elapsedSec: number;
}

const PARTNER_DISCONNECT_FALLBACK_MS = 5000;

function createInitialHud(): GlassHudSnapshot {
  const firstStage = GLASS_COURSE.stages[0];
  return {
    matchTime: 0,
    stageNumber: firstStage?.number ?? 1,
    stageName: firstStage?.name ?? 'Cổng Gỗ Khởi Động',
    checkpointIndex: 0,
    totalCheckpoints: Math.max(0, GLASS_COURSE.checkpoints.length - 1),
    shatters: 0,
    glassHp: GLASS_MAX_HP,
    glassMaxHp: GLASS_MAX_HP,
    glassStress: 0,
    shatterTimer: 0,
    shatterReason: null,
    p1Lift: 0,
    p2Lift: 0,
    progressPct: 0,
  };
}

/**
 * Runs Glass Carry in parallel pairs (or Solo Auto-Balance for an odd player).
 * Each pair syncs physics on an isolated sub-channel and reports team progress/finish
 * back to the main Event channel for unified room-wide ranking.
 */
export function EventGlassAdapter({
  room,
  round,
  onStatusTextChange,
}: EventAdapterProps) {
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

  const myPair: GlassPairAssignment = useMemo(() => {
    return (
      round.glassPairs.find((p) => p.memberIds.includes(myPeerId)) ?? {
        pairId: 'solo-fallback',
        mode: 'solo',
        memberIds: [myPeerId],
        subChannelCode: `${roomCode}:r${round.roundIndex}:solo`,
      }
    );
  }, [myPeerId, roomCode, round.glassPairs, round.roundIndex]);

  const isSoloAssigned = myPair.mode === 'solo' || myPair.memberIds.length === 1;
  const isPairHostInitially = myPair.memberIds[0] === myPeerId;
  const partnerPeerId = myPair.memberIds.find((id) => id !== myPeerId) ?? null;

  const [fallbackSolo, setFallbackSolo] = useState<boolean>(isSoloAssigned);
  const [localPhase, setLocalPhase] = useState<'playing' | 'finished'>('playing');
  const [hud, setHud] = useState<GlassHudSnapshot>(createInitialHud);
  const [teamProgress, setTeamProgress] = useState<
    Record<string, GlassTeamProgressPayload>
  >(() => {
    const init: Record<string, GlassTeamProgressPayload> = {};
    for (const pair of round.glassPairs) {
      init[pair.pairId] = {
        pairId: pair.pairId,
        memberIds: pair.memberIds,
        progressPct: 0,
        shatters: 0,
        finished: false,
        elapsedSec: 0,
      };
    }
    return init;
  });

  const subChannelRef = useRef<RealtimeChannel | null>(null);
  const subSubscribedRef = useRef<boolean>(false);
  const membersRef = useRef(members);
  membersRef.current = members;
  const snapshotListenerRef = useRef<
    ((snapshot: CoopSnapshotPayload) => void) | null
  >(null);
  const guestInputListenerRef = useRef<
    ((input: GlassInputPayload) => void) | null
  >(null);
  const inputSeqRef = useRef<number>(0);
  const lastInputSentAtRef = useRef<number>(0);
  const lastReportAtRef = useRef<number>(0);
  const teamProgressRef = useRef(teamProgress);
  teamProgressRef.current = teamProgress;
  const submittedEventRef = useRef<boolean>(false);
  const partnerAbsentSinceRef = useRef<number | null>(null);

  const effectiveIsHost = fallbackSolo || isPairHostInitially;

  useEffect(() => {
    onStatusTextChange?.(
      fallbackSolo
        ? 'Chế độ Solo Tự Cân Bằng'
        : `Đội 2 Người · Chặng ${hud.stageNumber}/5`,
    );
    return () => onStatusTextChange?.(null);
  }, [fallbackSolo, hud.stageNumber, onStatusTextChange]);

  // Detect partner disconnect (>5s) and seamlessly switch survivor to Solo Auto-Balance
  useEffect(() => {
    if (isSoloAssigned || fallbackSolo || !partnerPeerId) return;
    const timer = window.setInterval(() => {
      const partnerOnline = membersRef.current.some(
        (m) => m.peerId === partnerPeerId,
      );
      if (partnerOnline) {
        partnerAbsentSinceRef.current = null;
        return;
      }
      if (partnerAbsentSinceRef.current === null) {
        partnerAbsentSinceRef.current = Date.now();
        return;
      }
      if (Date.now() - partnerAbsentSinceRef.current >= PARTNER_DISCONNECT_FALLBACK_MS) {
        setFallbackSolo(true);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [fallbackSolo, isSoloAssigned, partnerPeerId]);

  // Isolated pair sub-channel for 2-player physics sync
  useEffect(() => {
    if (isSoloAssigned) return;
    const client = getSupabaseClient();
    if (!client) return;

    subSubscribedRef.current = false;
    const channel = client.channel(`paws-event-glass:${myPair.subChannelCode}`, {
      config: {
        broadcast: { self: false },
      },
    });
    subChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'glass_input' }, ({ payload }) => {
        if (!payload) return;
        guestInputListenerRef.current?.(payload as GlassInputPayload);
      })
      .on('broadcast', { event: 'glass_snapshot' }, ({ payload }) => {
        if (!payload) return;
        snapshotListenerRef.current?.(payload as CoopSnapshotPayload);
      })
      .on('broadcast', { event: 'glass_pair_finish' }, () => {
        setLocalPhase('finished');
      });

    channel.subscribe((status) => {
      subSubscribedRef.current = status === 'SUBSCRIBED';
    });

    return () => {
      subSubscribedRef.current = false;
      subChannelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [isSoloAssigned, myPair.subChannelCode]);

  const reportProgressToEvent = useCallback(
    (progressPct: number, shatters: number, finished: boolean, elapsedSec: number) => {
      const payload: GlassTeamProgressPayload = {
        pairId: myPair.pairId,
        memberIds: myPair.memberIds,
        progressPct: Math.round(progressPct * 10) / 10,
        shatters,
        finished,
        elapsedSec: Math.round(elapsedSec * 100) / 100,
      };
      sendGameEvent('glass_team_progress', payload);
    },
    [myPair.memberIds, myPair.pairId, sendGameEvent],
  );

  // Listen to all teams' progress on the main Event channel with stable subscribeGameEvent
  useEffect(() => {
    return subscribeGameEvent('glass_team_progress', (raw) => {
      const evt = raw as GlassTeamProgressPayload;
      if (!evt || typeof evt.pairId !== 'string') return;
      setTeamProgress((prev) => {
        const existing = prev[evt.pairId];
        if (existing?.finished && !evt.finished) return prev;
        const next = {
          ...prev,
          [evt.pairId]: evt,
        };
        teamProgressRef.current = next;
        return next;
      });
    });
  }, [subscribeGameEvent]);

  const finalizeGlassRoundFromHost = useCallback(() => {
    if (!isHost || submittedEventRef.current) return;
    submittedEventRef.current = true;

    const latest = teamProgressRef.current;
    const entries = roster.map((m) => {
      const pair = round.glassPairs.find((p) => p.memberIds.includes(m.peerId));
      const rec = pair ? latest[pair.pairId] : undefined;
      const finished = Boolean(rec?.finished);
      const elapsedSec = rec?.elapsedSec ?? round.timeLimitSec;
      const progressPct = rec?.progressPct ?? 0;
      const shatters = rec?.shatters ?? 0;

      return {
        peerId: m.peerId,
        // Finished teams always beat unfinished teams; faster elapsed time wins
        primaryScore: finished
          ? 1_000_000 - Math.round(elapsedSec * 100)
          : Math.round(progressPct * 10),
        secondaryScore: -shatters,
        metricLabel: finished
          ? `Về đích ${elapsedSec.toFixed(1)}s · ${shatters} vỡ kính`
          : `Đạt ${Math.round(progressPct)}% · ${shatters} vỡ kính`,
      };
    });

    const ranked = rankEventRound(entries);
    submitHostRoundComplete(round.roundId, ranked);
  }, [
    isHost,
    roster,
    round.glassPairs,
    round.roundId,
    round.timeLimitSec,
    submitHostRoundComplete,
  ]);

  // Host monitors completion (all connected teams finished OR Event timer expired)
  useEffect(() => {
    if (!isHost) return;
    const timer = window.setInterval(() => {
      if (submittedEventRef.current) return;
      const now = Date.now();
      if (now >= round.roundDeadlineMs) {
        finalizeGlassRoundFromHost();
        return;
      }

      const activePairs = round.glassPairs.filter((pair) =>
        pair.memberIds.some((id) =>
          membersRef.current.some((m) => m.peerId === id),
        ),
      );
      if (
        activePairs.length > 0 &&
        activePairs.every((p) => teamProgressRef.current[p.pairId]?.finished)
      ) {
        finalizeGlassRoundFromHost();
      }
    }, 350);

    return () => window.clearInterval(timer);
  }, [
    finalizeGlassRoundFromHost,
    isHost,
    round.glassPairs,
    round.roundDeadlineMs,
  ]);

  const handleHudSnapshot = useCallback(
    (nextHud: GlassHudSnapshot) => {
      setHud(nextHud);
      if (!effectiveIsHost || localPhase === 'finished') return;
      const now = Date.now();
      if (now - lastReportAtRef.current >= 900) {
        lastReportAtRef.current = now;
        reportProgressToEvent(
          nextHud.progressPct,
          nextHud.shatters,
          false,
          nextHud.matchTime,
        );
      }
    },
    [effectiveIsHost, localPhase, reportProgressToEvent],
  );

  const memberById = useMemo(
    () => new Map(roster.map((m) => [m.peerId, m])),
    [roster],
  );

  const p1Member: GlassRoomMember = useMemo(() => {
    const id = myPair.memberIds[0] ?? myPeerId;
    const m = memberById.get(id);
    return {
      peerId: id,
      name: m?.name ?? 'Người chơi 1',
      animal: m?.animal ?? 'dog',
      accessory: m?.accessory ?? [],
      ready: true,
      joinedAt: m?.joinedAt ?? 0,
    };
  }, [memberById, myPair.memberIds, myPeerId]);

  const p2Member: GlassRoomMember = useMemo(() => {
    const id = myPair.memberIds[1];
    const m = id ? memberById.get(id) : undefined;
    return {
      peerId: id ?? 'solo-stabilizer',
      name: fallbackSolo ? 'Tự Cân Bằng' : (m?.name ?? 'Đồng đội'),
      animal: m?.animal ?? p1Member.animal,
      accessory: m?.accessory ?? [],
      ready: true,
      joinedAt: m?.joinedAt ?? 1,
    };
  }, [fallbackSolo, memberById, myPair.memberIds, p1Member.animal]);

  const glassController: GlassRoomController = useMemo(
    () => ({
      isConfigured: true,
      connectionStatus: 'connected',
      phase: localPhase,
      selectedMap: 'glass_carry',
      roomCode,
      matchId: `${round.roundId}-${myPair.pairId}`,
      myPeerId,
      mySlot: effectiveIsHost ? 'p1' : 'p2',
      isHost: effectiveIsHost,
      members: [p1Member, p2Member],
      p1Member,
      p2Member,
      countdownSec: 0,
      partnerDisconnectedSec: null,
      partnerLeftPermanently: false,
      activeEmotes: {} as Partial<Record<'p1' | 'p2', GlassEmotePayload>>,
      finalResult: null,
      error: null,
      createRoom: async () => {},
      joinRoom: async () => {},
      leaveRoom,
      updateMyProfile: () => {},
      toggleReady: () => {},
      selectMap: () => {},
      startMatch: () => {},
      restartMatch: () => {},
      startNextMap: () => {},
      returnToLobby: () => {},
      sendEmote: () => {},
      sendGuestInput: (input: PlayerInput) => {
        if (effectiveIsHost) return;
        const ch = subChannelRef.current;
        if (!ch || !subSubscribedRef.current) return;
        const now = performance.now();
        if (now - lastInputSentAtRef.current < GLASS_INPUT_INTERVAL_MS) return;
        lastInputSentAtRef.current = now;
        inputSeqRef.current += 1;
        const payload: GlassInputPayload = {
          matchId: `${round.roundId}-${myPair.pairId}`,
          peerId: myPeerId,
          seq: inputSeqRef.current,
          moveX: input.moveX,
          moveZ: input.moveZ,
          jump: input.jump,
          lift: input.lift,
        };
        void ch.send({
          type: 'broadcast',
          event: 'glass_input',
          payload,
        });
      },
      broadcastSnapshot: (snapshot: CoopSnapshotPayload) => {
        const ch = subChannelRef.current;
        if (!ch || !subSubscribedRef.current || fallbackSolo) return;
        void ch.send({
          type: 'broadcast',
          event: 'glass_snapshot',
          payload: snapshot,
        });
      },
      notifyMatchFinished: (elapsedSec: number, shatters: number) => {
        setLocalPhase('finished');
        reportProgressToEvent(100, shatters, true, elapsedSec);
        const ch = subChannelRef.current;
        if (ch && subSubscribedRef.current) {
          void ch.send({
            type: 'broadcast',
            event: 'glass_pair_finish',
            payload: { elapsedSec, shatters },
          });
        }
      },
      setSnapshotListener: (fn) => {
        snapshotListenerRef.current = fn;
      },
      setGuestInputListener: (fn) => {
        guestInputListenerRef.current = fn;
      },
    }),
    [
      effectiveIsHost,
      fallbackSolo,
      leaveRoom,
      localPhase,
      myPair.pairId,
      myPeerId,
      p1Member,
      p2Member,
      reportProgressToEvent,
      roomCode,
      round.roundId,
    ],
  );

  const sortedTeams = useMemo(() => {
    return Object.values(teamProgress).sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished) return a.elapsedSec - b.elapsedSec;
      return b.progressPct - a.progressPct;
    });
  }, [teamProgress]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0d1b2e] select-none">
      <GlassScene
        room={glassController}
        paused={localPhase === 'finished'}
        onHudSnapshot={handleHudSnapshot}
        soloAutoBalance={fallbackSolo}
      />

      {/* Compact Glass Event HUD */}
      <div className="pointer-events-none fixed inset-x-0 top-14 z-20 flex items-start justify-between px-4">
        <div className="space-y-1.5 rounded-2xl border border-cyan-400/35 bg-[#081726]/88 p-3 text-xs text-cyan-50 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 font-black text-cyan-200">
            <Users className="h-3.5 w-3.5 text-cyan-300" />
            <span>
              Chặng {hud.stageNumber}/5 · {hud.stageName}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-bold">
            <span>Tiến độ: {Math.round(hud.progressPct)}%</span>
            <span>Độ bền kính: {hud.glassHp}/{hud.glassMaxHp}</span>
            <span>Vỡ: {hud.shatters}</span>
          </div>
          <div className="text-[10px] font-semibold text-cyan-200/75">
            WASD/Mũi tên: Đi · Space: Nhảy · E: Nâng kính · Q: Hạ kính
          </div>
          {fallbackSolo && !isSoloAssigned && (
            <div className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-200">
              <ShieldAlert className="h-3 w-3" />
              <span>Đồng đội mất kết nối — Đã bật Solo Tự Cân Bằng</span>
            </div>
          )}
        </div>

        {/* Live Teams Progress Leaderboard */}
        <div className="hidden w-64 rounded-2xl border border-cyan-400/30 bg-[#081726]/88 p-3 text-xs text-cyan-50 shadow-xl backdrop-blur-md sm:block">
          <div className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-300">
            Tiến Độ Các Đội
          </div>
          <ul className="space-y-1.5">
            {sortedTeams.map((team, idx) => {
              const names = team.memberIds
                .map((id) => memberById.get(id)?.name ?? id)
                .join(' & ');
              const isMine = team.pairId === myPair.pairId;
              return (
                <li
                  key={team.pairId}
                  className={`rounded-xl px-2.5 py-1.5 ${
                    isMine
                      ? 'border border-cyan-300/55 bg-cyan-400/20 font-black'
                      : 'bg-black/30 font-bold'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      #{idx + 1} {names}
                    </span>
                    <span className="shrink-0 font-mono text-amber-300">
                      {team.finished
                        ? `${team.elapsedSec.toFixed(1)}s`
                        : `${Math.round(team.progressPct)}%`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Finished waiting overlay */}
      {localPhase === 'finished' && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4">
          <div className="rounded-3xl border-2 border-emerald-400/55 bg-[#081726]/92 px-7 py-5 text-center shadow-2xl backdrop-blur-md">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
            <h2 className="mt-2 font-display text-2xl font-black text-white">
              Đội Bạn Đã Về Đích!
            </h2>
            <p className="mt-1 text-xs font-bold text-cyan-200/85">
              Đang chờ các đội khác hoàn thành hoặc hết giờ vòng đấu...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
