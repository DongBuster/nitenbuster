import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AnimalId } from '../../engine/types.ts';
import {
  generateRoomCode,
  normalizeRoomCode,
} from '../../online/sanitize.ts';
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '../../online/supabaseClient.ts';
import {
  normalizeAccessories,
  type AccessorySelection,
} from '../../scene3d/accessoryCatalog.ts';
import { getStageNumber } from '../engine/stages.ts';
import type { BlastGameState } from '../engine/types.ts';
import type { MatchReceipt } from '../engine/verify.ts';
import { EMPTY_COMPACT_GRID, encodeGrid } from './gridCodec.ts';
import {
  BB_COUNTDOWN_MS,
  BB_DISCONNECT_GRACE_MS,
  BB_MAX_ROOM_PLAYERS,
  BB_MIN_START_PLAYERS,
  BB_PROGRESS_THROTTLE_MS,
  type BbEmoteEvent,
  type BbFinishEvent,
  type BbMatchStartEvent,
  type BbParticipantInfo,
  type BbPlayerProgress,
  type BbProgressEvent,
  type BbReturnLobbyEvent,
  type BbRoomMember,
  type BbRoomPhase,
  type BbRoomStanding,
  type BbRoomSyncEvent,
  type BbSyncRequestEvent,
} from './protocol.ts';
import {
  computeRoomStandings,
  electRoomHost,
  isRoomMatchComplete,
} from './ranking.ts';

export type BbConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

const BB_PEER_STORAGE_KEY = 'paws_bb_online_peer_id_v1';

function getOrCreatePeerId(): string {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const existing = window.sessionStorage.getItem(BB_PEER_STORAGE_KEY);
      if (existing && existing.trim().length > 0) {
        return existing;
      }
      const generated = `bb-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(BB_PEER_STORAGE_KEY, generated);
      return generated;
    } catch {
      // Fallback below
    }
  }
  return `bb-${Math.random().toString(36).slice(2, 10)}`;
}

function generateSeed32(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] || 1;
  }
  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
}

function parsePresenceMembers(
  presenceState: Record<string, unknown[]>,
): BbRoomMember[] {
  const byPeer = new Map<string, BbRoomMember>();
  for (const entries of Object.values(presenceState)) {
    if (!Array.isArray(entries)) continue;
    for (const raw of entries) {
      if (!raw || typeof raw !== 'object') continue;
      const m = raw as Partial<BbRoomMember>;
      if (typeof m.peerId !== 'string' || typeof m.name !== 'string') continue;
      const existing = byPeer.get(m.peerId);
      const candidate: BbRoomMember = {
        peerId: m.peerId,
        name: m.name,
        animal: (m.animal ?? 'dog') as AnimalId,
        accessory: normalizeAccessories(m.accessory as AccessorySelection),
        ready: Boolean(m.ready),
        joinedAt: typeof m.joinedAt === 'number' ? m.joinedAt : Date.now(),
      };
      if (!existing || candidate.joinedAt <= existing.joinedAt) {
        byPeer.set(m.peerId, candidate);
      }
    }
  }
  return Array.from(byPeer.values()).sort((a, b) => {
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
    return a.peerId.localeCompare(b.peerId);
  });
}

function buildInitialProgressMap(
  matchId: string,
  rosterPeerIds: readonly string[],
): Record<string, BbPlayerProgress> {
  const now = Date.now();
  const map: Record<string, BbPlayerProgress> = {};
  for (const peerId of rosterPeerIds) {
    map[peerId] = {
      matchId,
      peerId,
      seq: 0,
      score: 0,
      stage: 1,
      allClears: 0,
      streak: 0,
      maxStreak: 0,
      linesCleared: 0,
      movesCount: 0,
      compactGrid: EMPTY_COMPACT_GRID,
      status: 'playing',
      updatedAt: now,
    };
  }
  return map;
}

/**
 * Manages an ephemeral 2-8 player Block Blast competitive score room over
 * Supabase Realtime Presence & Broadcast with host failover and anti-cheat replay.
 */
export function useBlockBlastRoom() {
  const configured = isSupabaseConfigured();
  const [myPeerId] = useState<string>(() => getOrCreatePeerId());
  const [roomCode, setRoomCode] = useState<string>('');
  const [phase, setPhase] = useState<BbRoomPhase>('idle');
  const [connectionStatus, setConnectionStatus] =
    useState<BbConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<BbRoomMember[]>([]);
  const [hostId, setHostId] = useState<string>('');
  const [matchId, setMatchId] = useState<string>('');
  const [seed, setSeed] = useState<number>(0);
  const [roundNumber, setRoundNumber] = useState<number>(0);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [rosterPeerIds, setRosterPeerIds] = useState<string[]>([]);
  const [rosterSnapshots, setRosterSnapshots] = useState<
    Record<string, BbParticipantInfo>
  >({});
  const [progressByPeer, setProgressByPeer] = useState<
    Record<string, BbPlayerProgress>
  >({});
  const [receiptsByPeer, setReceiptsByPeer] = useState<
    Record<string, MatchReceipt>
  >({});
  const [lastEmote, setLastEmote] = useState<BbEmoteEvent | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const myProfileRef = useRef<BbRoomMember | null>(null);
  const asHostRef = useRef<boolean>(false);
  const phaseRef = useRef<BbRoomPhase>('idle');
  const roomCodeRef = useRef<string>('');
  const membersRef = useRef<BbRoomMember[]>([]);
  const hostIdRef = useRef<string>('');
  const matchIdRef = useRef<string>('');
  const seedRef = useRef<number>(0);
  const roundNumberRef = useRef<number>(0);
  const rosterPeerIdsRef = useRef<string[]>([]);
  const rosterSnapshotsRef = useRef<Record<string, BbParticipantInfo>>({});
  const progressByPeerRef = useRef<Record<string, BbPlayerProgress>>({});
  const receiptsByPeerRef = useRef<Record<string, MatchReceipt>>({});

  const countdownTimerRef = useRef<number | null>(null);
  const emoteTimerRef = useRef<number | null>(null);
  const progressSeqRef = useRef<number>(0);
  const lastProgressSentAtRef = useRef<number>(0);
  const pendingProgressRef = useRef<BbProgressEvent | null>(null);
  const progressThrottleTimerRef = useRef<number | null>(null);
  const disconnectTimersRef = useRef<Map<string, number>>(new Map());

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const clearProgressThrottle = useCallback(() => {
    if (progressThrottleTimerRef.current !== null) {
      window.clearTimeout(progressThrottleTimerRef.current);
      progressThrottleTimerRef.current = null;
    }
    pendingProgressRef.current = null;
  }, []);

  const clearEmoteTimer = useCallback(() => {
    if (emoteTimerRef.current !== null) {
      window.clearTimeout(emoteTimerRef.current);
      emoteTimerRef.current = null;
    }
  }, []);

  const clearDisconnectTimers = useCallback(() => {
    disconnectTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    disconnectTimersRef.current.clear();
  }, []);

  const teardownChannel = useCallback(() => {
    clearCountdownTimer();
    clearProgressThrottle();
    clearEmoteTimer();
    clearDisconnectTimers();
    const client = getSupabaseClient();
    const ch = channelRef.current;
    channelRef.current = null;
    if (ch && client) {
      void client.removeChannel(ch);
    } else if (ch) {
      void ch.unsubscribe();
    }
  }, [
    clearCountdownTimer,
    clearDisconnectTimers,
    clearEmoteTimer,
    clearProgressThrottle,
  ]);

  const resetMatchState = useCallback(
    (nextPhase: BbRoomPhase) => {
      clearCountdownTimer();
      clearProgressThrottle();
      clearDisconnectTimers();
      progressSeqRef.current = 0;
      lastProgressSentAtRef.current = 0;
      matchIdRef.current = '';
      seedRef.current = 0;
      rosterPeerIdsRef.current = [];
      rosterSnapshotsRef.current = {};
      progressByPeerRef.current = {};
      receiptsByPeerRef.current = {};
      phaseRef.current = nextPhase;

      setMatchId('');
      setSeed(0);
      setCountdownSeconds(0);
      setRosterPeerIds([]);
      setRosterSnapshots({});
      setProgressByPeer({});
      setReceiptsByPeer({});
      setPhase(nextPhase);
    },
    [clearCountdownTimer, clearDisconnectTimers, clearProgressThrottle],
  );

  const checkAndFinalizeMatch = useCallback(
    (nextProgressMap: Record<string, BbPlayerProgress>) => {
      if (
        phaseRef.current !== 'playing' &&
        phaseRef.current !== 'countdown'
      ) {
        return;
      }
      if (isRoomMatchComplete(rosterPeerIdsRef.current, nextProgressMap)) {
        clearCountdownTimer();
        clearProgressThrottle();
        clearDisconnectTimers();
        phaseRef.current = 'results';
        setPhase('results');
        setCountdownSeconds(0);
      }
    },
    [clearCountdownTimer, clearDisconnectTimers, clearProgressThrottle],
  );

  const applyProgressUpdate = useCallback(
    (evt: BbProgressEvent) => {
      if (!evt.matchId || evt.matchId !== matchIdRef.current) return;
      if (!rosterPeerIdsRef.current.includes(evt.peerId)) return;

      const prev = progressByPeerRef.current[evt.peerId];
      if (prev && evt.seq < prev.seq && evt.status !== 'finished') {
        return;
      }

      const nextEntry: BbPlayerProgress = {
        ...evt,
        updatedAt: Date.now(),
      };
      const nextMap: Record<string, BbPlayerProgress> = {
        ...progressByPeerRef.current,
        [evt.peerId]: nextEntry,
      };
      progressByPeerRef.current = nextMap;
      setProgressByPeer(nextMap);
      checkAndFinalizeMatch(nextMap);
    },
    [checkAndFinalizeMatch],
  );

  const applyFinishSubmission = useCallback(
    (evt: BbFinishEvent) => {
      if (!evt.matchId || evt.matchId !== matchIdRef.current) return;
      if (!rosterPeerIdsRef.current.includes(evt.peerId)) return;

      const nextReceipts: Record<string, MatchReceipt> = {
        ...receiptsByPeerRef.current,
        [evt.peerId]: evt.receipt,
      };
      receiptsByPeerRef.current = nextReceipts;
      setReceiptsByPeer(nextReceipts);

      const prevProg = progressByPeerRef.current[evt.peerId];
      const nextMap: Record<string, BbPlayerProgress> = {
        ...progressByPeerRef.current,
        [evt.peerId]: {
          matchId: evt.matchId,
          peerId: evt.peerId,
          seq: (prevProg?.seq ?? 0) + 1,
          score: evt.receipt.claimedScore,
          stage: prevProg?.stage ?? 1,
          allClears: prevProg?.allClears ?? 0,
          streak: prevProg?.streak ?? 0,
          maxStreak: prevProg?.maxStreak ?? 0,
          linesCleared: prevProg?.linesCleared ?? 0,
          movesCount: prevProg?.movesCount ?? 0,
          compactGrid: prevProg?.compactGrid ?? EMPTY_COMPACT_GRID,
          status: 'finished',
          updatedAt: Date.now(),
        },
      };
      progressByPeerRef.current = nextMap;
      setProgressByPeer(nextMap);
      checkAndFinalizeMatch(nextMap);
    },
    [checkAndFinalizeMatch],
  );

  const applyMatchStart = useCallback(
    (evt: BbMatchStartEvent) => {
      if (!evt || !evt.matchId || matchIdRef.current === evt.matchId) return;

      clearCountdownTimer();
      clearProgressThrottle();
      clearDisconnectTimers();
      progressSeqRef.current = 0;
      lastProgressSentAtRef.current = 0;

      const initialProgress = buildInitialProgressMap(
        evt.matchId,
        evt.rosterPeerIds,
      );

      matchIdRef.current = evt.matchId;
      seedRef.current = evt.seed;
      roundNumberRef.current = evt.roundNumber;
      rosterPeerIdsRef.current = evt.rosterPeerIds.slice();
      rosterSnapshotsRef.current = { ...evt.rosterSnapshots };
      progressByPeerRef.current = initialProgress;
      receiptsByPeerRef.current = {};

      setMatchId(evt.matchId);
      setSeed(evt.seed);
      setRoundNumber(evt.roundNumber);
      setRosterPeerIds(rosterPeerIdsRef.current);
      setRosterSnapshots(rosterSnapshotsRef.current);
      setProgressByPeer(initialProgress);
      setReceiptsByPeer({});

      const durationMs = Math.max(0, evt.countdownMs || BB_COUNTDOWN_MS);
      if (durationMs <= 0) {
        phaseRef.current = 'playing';
        setPhase('playing');
        setCountdownSeconds(0);
        return;
      }

      phaseRef.current = 'countdown';
      setPhase('countdown');
      const endTime = Date.now() + durationMs;
      setCountdownSeconds(Math.max(1, Math.ceil(durationMs / 1000)));

      const capturedMatchId = evt.matchId;
      countdownTimerRef.current = window.setInterval(() => {
        if (matchIdRef.current !== capturedMatchId) {
          clearCountdownTimer();
          return;
        }
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
          clearCountdownTimer();
          setCountdownSeconds(0);
          if (phaseRef.current === 'countdown') {
            phaseRef.current = 'playing';
            setPhase('playing');
          }
        } else {
          setCountdownSeconds(Math.ceil(remaining / 1000));
        }
      }, 150);
    },
    [clearCountdownTimer, clearDisconnectTimers, clearProgressThrottle],
  );

  const applyRoomSync = useCallback(
    (evt: BbRoomSyncEvent) => {
      if (evt.targetPeerId !== myPeerId) return;
      if (matchIdRef.current) return;

      clearCountdownTimer();
      clearProgressThrottle();
      clearDisconnectTimers();

      const resolvedPhase: BbRoomPhase =
        evt.phase === 'countdown' ? 'playing' : evt.phase;

      matchIdRef.current = evt.matchId;
      seedRef.current = evt.seed;
      roundNumberRef.current = evt.roundNumber;
      rosterPeerIdsRef.current = evt.rosterPeerIds.slice();
      rosterSnapshotsRef.current = { ...evt.rosterSnapshots };
      progressByPeerRef.current = { ...evt.progressByPeer };
      receiptsByPeerRef.current = { ...evt.receiptsByPeer };
      phaseRef.current = resolvedPhase;

      setMatchId(evt.matchId);
      setSeed(evt.seed);
      setRoundNumber(evt.roundNumber);
      setCountdownSeconds(0);
      setRosterPeerIds(rosterPeerIdsRef.current);
      setRosterSnapshots(rosterSnapshotsRef.current);
      setProgressByPeer(progressByPeerRef.current);
      setReceiptsByPeer(receiptsByPeerRef.current);
      setPhase(resolvedPhase);
    },
    [clearCountdownTimer, clearDisconnectTimers, clearProgressThrottle, myPeerId],
  );

  const leaveRoom = useCallback(() => {
    teardownChannel();
    myProfileRef.current = null;
    asHostRef.current = false;
    roomCodeRef.current = '';
    hostIdRef.current = '';
    membersRef.current = [];
    roundNumberRef.current = 0;

    setRoomCode('');
    setConnectionStatus('disconnected');
    setError(null);
    setMembers([]);
    setHostId('');
    setRoundNumber(0);
    setLastEmote(null);
    resetMatchState('idle');
  }, [resetMatchState, teardownChannel]);

  const connectToRoom = useCallback(
    (
      rawCode: string,
      profile: { name: string; animal: AnimalId; accessory: AccessorySelection },
      asHost: boolean,
    ) => {
      const client = getSupabaseClient();
      if (!client) {
        setError(
          'Chưa cấu hình Supabase Realtime (.env.local). Bạn có thể chơi Solo hoặc cấu hình Supabase để mở phòng.',
        );
        setConnectionStatus('error');
        return;
      }

      const code = normalizeRoomCode(rawCode);
      if (code.length < 4) {
        setError('Mã phòng cần có từ 4 đến 6 ký tự.');
        return;
      }

      teardownChannel();
      resetMatchState('lobby');
      asHostRef.current = asHost;
      roomCodeRef.current = code;
      roundNumberRef.current = 0;

      setError(null);
      setRoomCode(code);
      setRoundNumber(0);
      setConnectionStatus('connecting');

      const initialMember: BbRoomMember = {
        peerId: myPeerId,
        name: profile.name.trim() || 'Người chơi',
        animal: profile.animal,
        accessory: normalizeAccessories(profile.accessory),
        ready: asHost,
        joinedAt: Date.now(),
      };
      myProfileRef.current = initialMember;

      if (asHost) {
        hostIdRef.current = myPeerId;
        setHostId(myPeerId);
      } else {
        hostIdRef.current = '';
        setHostId('');
      }

      const channel = client.channel(`bb-room:${code}`, {
        config: {
          broadcast: { self: true },
          presence: { key: myPeerId },
        },
      });
      channelRef.current = channel;

      channel
        .on('presence', { event: 'sync' }, () => {
          const parsed = parsePresenceMembers(
            channel.presenceState() as Record<string, unknown[]>,
          );

          // Enforce 8-player room cap cleanly in lobby
          if (
            !asHostRef.current &&
            phaseRef.current === 'lobby' &&
            parsed.length > BB_MAX_ROOM_PLAYERS
          ) {
            const admitted = parsed
              .slice(0, BB_MAX_ROOM_PLAYERS)
              .some((m) => m.peerId === myPeerId);
            if (!admitted) {
              teardownChannel();
              resetMatchState('idle');
              roomCodeRef.current = '';
              setRoomCode('');
              setMembers([]);
              setHostId('');
              setConnectionStatus('disconnected');
              setError(`Phòng ${code} đã đủ ${BB_MAX_ROOM_PLAYERS} người.`);
              return;
            }
          }

          membersRef.current = parsed;
          setMembers(parsed);

          const nextHost = electRoomHost(parsed);
          if (nextHost) {
            hostIdRef.current = nextHost;
            setHostId(nextHost);
          }

          // Track disconnects with 5s grace period during active matches
          if (
            phaseRef.current === 'countdown' ||
            phaseRef.current === 'playing'
          ) {
            const presentIds = new Set(parsed.map((m) => m.peerId));
            const capturedMatchId = matchIdRef.current;

            for (const rosterId of rosterPeerIdsRef.current) {
              if (presentIds.has(rosterId)) {
                const pendingTimer = disconnectTimersRef.current.get(rosterId);
                if (pendingTimer !== undefined) {
                  window.clearTimeout(pendingTimer);
                  disconnectTimersRef.current.delete(rosterId);
                }
                continue;
              }

              const currentProg = progressByPeerRef.current[rosterId];
              if (
                currentProg?.status === 'playing' &&
                !disconnectTimersRef.current.has(rosterId)
              ) {
                const timerId = window.setTimeout(() => {
                  disconnectTimersRef.current.delete(rosterId);
                  if (matchIdRef.current !== capturedMatchId) return;
                  const latest = progressByPeerRef.current[rosterId];
                  if (!latest || latest.status !== 'playing') return;

                  const nextMap: Record<string, BbPlayerProgress> = {
                    ...progressByPeerRef.current,
                    [rosterId]: {
                      ...latest,
                      status: 'disconnected',
                      updatedAt: Date.now(),
                    },
                  };
                  progressByPeerRef.current = nextMap;
                  setProgressByPeer(nextMap);
                  checkAndFinalizeMatch(nextMap);
                }, BB_DISCONNECT_GRACE_MS);

                disconnectTimersRef.current.set(rosterId, timerId);
              }
            }
          }
        })
        .on('broadcast', { event: 'bb_match_start' }, ({ payload }) => {
          const evt = payload as BbMatchStartEvent | undefined;
          if (!evt) return;
          applyMatchStart(evt);
        })
        .on('broadcast', { event: 'bb_progress' }, ({ payload }) => {
          const evt = payload as BbProgressEvent | undefined;
          if (!evt) return;
          applyProgressUpdate(evt);
        })
        .on('broadcast', { event: 'bb_finish' }, ({ payload }) => {
          const evt = payload as BbFinishEvent | undefined;
          if (!evt) return;
          applyFinishSubmission(evt);
        })
        .on('broadcast', { event: 'bb_emote' }, ({ payload }) => {
          const evt = payload as BbEmoteEvent | undefined;
          if (!evt) return;
          clearEmoteTimer();
          setLastEmote(evt);
          emoteTimerRef.current = window.setTimeout(() => {
            emoteTimerRef.current = null;
            setLastEmote((curr) => (curr?.at === evt.at ? null : curr));
          }, 2800);
        })
        .on('broadcast', { event: 'bb_return_lobby' }, ({ payload }) => {
          const evt = payload as BbReturnLobbyEvent | undefined;
          if (!evt) return;
          resetMatchState('lobby');
        })
        .on('broadcast', { event: 'bb_sync_request' }, ({ payload }) => {
          const evt = payload as BbSyncRequestEvent | undefined;
          if (!evt || evt.requesterPeerId === myPeerId) return;
          if (hostIdRef.current !== myPeerId) return;
          if (
            phaseRef.current === 'idle' ||
            phaseRef.current === 'lobby' ||
            !matchIdRef.current
          ) {
            return;
          }
          const syncPayload: BbRoomSyncEvent = {
            targetPeerId: evt.requesterPeerId,
            hostId: myPeerId,
            phase: phaseRef.current,
            matchId: matchIdRef.current,
            seed: seedRef.current,
            roundNumber: roundNumberRef.current,
            rosterPeerIds: rosterPeerIdsRef.current,
            rosterSnapshots: rosterSnapshotsRef.current,
            progressByPeer: progressByPeerRef.current,
            receiptsByPeer: receiptsByPeerRef.current,
          };
          void channel.send({
            type: 'broadcast',
            event: 'bb_room_sync',
            payload: syncPayload,
          });
        })
        .on('broadcast', { event: 'bb_room_sync' }, ({ payload }) => {
          const evt = payload as BbRoomSyncEvent | undefined;
          if (!evt) return;
          applyRoomSync(evt);
        });

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          setError(null);
          if (myProfileRef.current) {
            await channel.track(myProfileRef.current);
          }
          if (!asHost) {
            const req: BbSyncRequestEvent = { requesterPeerId: myPeerId };
            void channel.send({
              type: 'broadcast',
              event: 'bb_sync_request',
              payload: req,
            });
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('error');
          setError(
            'Không thể kết nối tới Supabase Realtime. Vui lòng kiểm tra mạng hoặc cấu hình.',
          );
        } else if (status === 'CLOSED') {
          setConnectionStatus('disconnected');
        }
      });
    },
    [
      applyFinishSubmission,
      applyMatchStart,
      applyProgressUpdate,
      applyRoomSync,
      checkAndFinalizeMatch,
      clearEmoteTimer,
      myPeerId,
      resetMatchState,
      teardownChannel,
    ],
  );

  const createRoom = useCallback(
    (profile: { name: string; animal: AnimalId; accessory: AccessorySelection }) => {
      const code = generateRoomCode(6);
      connectToRoom(code, profile, true);
    },
    [connectToRoom],
  );

  const joinRoom = useCallback(
    (
      code: string,
      profile: { name: string; animal: AnimalId; accessory: AccessorySelection },
    ) => {
      connectToRoom(code, profile, false);
    },
    [connectToRoom],
  );

  const updateMyProfile = useCallback(
    (
      patch: Partial<{
        name: string;
        animal: AnimalId;
        accessory: AccessorySelection;
        ready: boolean;
      }>,
    ) => {
      const current = myProfileRef.current;
      const channel = channelRef.current;
      if (!current) return;
      const updated: BbRoomMember = {
        ...current,
        ...patch,
        accessory:
          patch.accessory !== undefined
            ? normalizeAccessories(patch.accessory)
            : current.accessory,
        name:
          patch.name !== undefined
            ? patch.name.trim() || current.name
            : current.name,
      };
      myProfileRef.current = updated;
      if (channel) {
        void channel.track(updated);
      }
    },
    [],
  );

  const startMatch = useCallback(() => {
    if (hostIdRef.current !== myPeerId) return;
    if (phaseRef.current !== 'lobby' && phaseRef.current !== 'results') return;

    const activeMembers = membersRef.current.slice(0, BB_MAX_ROOM_PLAYERS);
    if (activeMembers.length < BB_MIN_START_PLAYERS) return;
    if (
      phaseRef.current === 'lobby' &&
      !activeMembers.every((m) => m.peerId === myPeerId || m.ready)
    ) {
      return;
    }

    const nextRound = roundNumberRef.current + 1;
    const nextSeed = generateSeed32();
    const nextMatchId = `bb-room-${roomCodeRef.current}-r${nextRound}-${nextSeed}`;

    const snapshots: Record<string, BbParticipantInfo> = {};
    const peerIds: string[] = [];
    for (const m of activeMembers) {
      peerIds.push(m.peerId);
      snapshots[m.peerId] = {
        peerId: m.peerId,
        name: m.name,
        animal: m.animal,
        accessory: m.accessory,
        joinedAt: m.joinedAt,
      };
    }

    const evt: BbMatchStartEvent = {
      matchId: nextMatchId,
      seed: nextSeed,
      roundNumber: nextRound,
      hostId: myPeerId,
      countdownMs: BB_COUNTDOWN_MS,
      rosterPeerIds: peerIds,
      rosterSnapshots: snapshots,
    };

    applyMatchStart(evt);

    const channel = channelRef.current;
    if (channel) {
      void channel.send({
        type: 'broadcast',
        event: 'bb_match_start',
        payload: evt,
      });
    }
  }, [applyMatchStart, myPeerId]);

  const publishProgress = useCallback(
    (state: BlastGameState) => {
      const currentMatchId = matchIdRef.current;
      if (!currentMatchId) return;

      const seq = ++progressSeqRef.current;
      const evt: BbProgressEvent = {
        matchId: currentMatchId,
        peerId: myPeerId,
        seq,
        score: state.score,
        stage: getStageNumber(state.allClears),
        allClears: state.allClears,
        streak: state.streak,
        maxStreak: state.maxStreak,
        linesCleared: state.linesCleared,
        movesCount: state.movesCount,
        compactGrid: encodeGrid(state.grid),
        status: state.phase === 'gameOver' ? 'finished' : 'playing',
      };

      applyProgressUpdate(evt);

      const channel = channelRef.current;
      if (!channel) return;

      const elapsed = Date.now() - lastProgressSentAtRef.current;
      if (evt.status === 'finished' || elapsed >= BB_PROGRESS_THROTTLE_MS) {
        clearProgressThrottle();
        lastProgressSentAtRef.current = Date.now();
        void channel.send({
          type: 'broadcast',
          event: 'bb_progress',
          payload: evt,
        });
        return;
      }

      pendingProgressRef.current = evt;
      if (progressThrottleTimerRef.current === null) {
        const waitMs = Math.max(16, BB_PROGRESS_THROTTLE_MS - elapsed);
        progressThrottleTimerRef.current = window.setTimeout(() => {
          progressThrottleTimerRef.current = null;
          const pending = pendingProgressRef.current;
          pendingProgressRef.current = null;
          const activeChannel = channelRef.current;
          if (!pending || !activeChannel || pending.matchId !== matchIdRef.current) {
            return;
          }
          lastProgressSentAtRef.current = Date.now();
          void activeChannel.send({
            type: 'broadcast',
            event: 'bb_progress',
            payload: pending,
          });
        }, waitMs);
      }
    },
    [applyProgressUpdate, clearProgressThrottle, myPeerId],
  );

  const publishFinish = useCallback(
    (receipt: MatchReceipt, finalState: BlastGameState) => {
      const currentMatchId = matchIdRef.current;
      if (!currentMatchId) return;

      publishProgress({
        ...finalState,
        phase: 'gameOver',
      });

      const finishEvt: BbFinishEvent = {
        matchId: currentMatchId,
        peerId: myPeerId,
        receipt,
      };
      applyFinishSubmission(finishEvt);

      const channel = channelRef.current;
      if (channel) {
        void channel.send({
          type: 'broadcast',
          event: 'bb_finish',
          payload: finishEvt,
        });
      }
    },
    [applyFinishSubmission, myPeerId, publishProgress],
  );

  const returnToLobby = useCallback(() => {
    if (hostIdRef.current !== myPeerId) return;
    resetMatchState('lobby');
    const channel = channelRef.current;
    if (channel) {
      const evt: BbReturnLobbyEvent = { hostId: myPeerId };
      void channel.send({
        type: 'broadcast',
        event: 'bb_return_lobby',
        payload: evt,
      });
    }
  }, [myPeerId, resetMatchState]);

  const sendEmote = useCallback(
    (emote: string, text: string) => {
      const channel = channelRef.current;
      const myName =
        membersRef.current.find((m) => m.peerId === myPeerId)?.name ??
        myProfileRef.current?.name ??
        'Người chơi';
      const evt: BbEmoteEvent = {
        peerId: myPeerId,
        name: myName,
        emote,
        text,
        at: Date.now(),
      };
      if (channel) {
        void channel.send({
          type: 'broadcast',
          event: 'bb_emote',
          payload: evt,
        });
      }
    },
    [myPeerId],
  );

  useEffect(() => {
    return () => {
      teardownChannel();
    };
  }, [teardownChannel]);

  const isHost = Boolean(hostId && hostId === myPeerId);
  const isParticipant = rosterPeerIds.includes(myPeerId);
  const myFinished =
    progressByPeer[myPeerId]?.status === 'finished' ||
    Boolean(receiptsByPeer[myPeerId]);

  const canStartMatch =
    isHost &&
    members.length >= BB_MIN_START_PLAYERS &&
    (phase === 'results' ||
      (phase === 'lobby' &&
        members.every((m) => m.peerId === myPeerId || m.ready)));

  const standings: BbRoomStanding[] = useMemo(
    () =>
      computeRoomStandings(
        rosterPeerIds,
        rosterSnapshots,
        progressByPeer,
        receiptsByPeer,
        matchId,
        seed,
        phase === 'results',
      ),
    [
      matchId,
      phase,
      progressByPeer,
      receiptsByPeer,
      rosterPeerIds,
      rosterSnapshots,
      seed,
    ],
  );

  return {
    configured,
    myPeerId,
    roomCode,
    phase,
    connectionStatus,
    error,
    members,
    hostId,
    isHost,
    matchId,
    seed,
    roundNumber,
    countdownSeconds,
    rosterPeerIds,
    isParticipant,
    myFinished,
    canStartMatch,
    standings,
    lastEmote,
    createRoom,
    joinRoom,
    leaveRoom,
    updateMyProfile,
    startMatch,
    publishProgress,
    publishFinish,
    returnToLobby,
    sendEmote,
  };
}

export type BlockBlastRoomController = ReturnType<typeof useBlockBlastRoom>;
