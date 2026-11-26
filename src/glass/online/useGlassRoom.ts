import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  DEFAULT_COOP_MAP_ID,
  getNextCoopMapId,
  isCoopMapId,
  type CoopMapId,
} from '../../coop/maps/registry.ts';
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
import type { PlayerInput, PlayerSlot } from '../sim/types.ts';
import {
  GLASS_COUNTDOWN_MS,
  GLASS_DISCONNECT_GRACE_MS,
  GLASS_EMOTES,
  GLASS_INPUT_INTERVAL_MS,
  GLASS_MAX_PLAYERS,
  type CoopSelectMapPayload,
  type CoopSnapshotPayload,
  type GlassConnectionStatus,
  type GlassEmotePayload,
  type GlassFinishPayload,
  type GlassInputPayload,
  type GlassReturnLobbyPayload,
  type GlassRoomMember,
  type GlassRoomPhase,
  type GlassStartPayload,
  type GlassSyncRequestPayload,
  type GlassSyncStatePayload,
} from './protocol.ts';

const GLASS_PEER_STORAGE_KEY = 'paws_glass_peer_id_v1';
const EMOTE_DISPLAY_MS = 2800;

export type GlassProfileInput = {
  name: string;
  animal: AnimalId;
  accessory: string[];
};

export type GlassFinalResult = {
  matchId: string;
  mapId: CoopMapId;
  elapsedSec: number;
  shatters: number;
};

export interface GlassRoomController {
  isConfigured: boolean;
  connectionStatus: GlassConnectionStatus;
  phase: GlassRoomPhase;
  selectedMap: CoopMapId;
  roomCode: string;
  matchId: string;
  myPeerId: string;
  mySlot: PlayerSlot | null;
  isHost: boolean;
  members: GlassRoomMember[];
  p1Member: GlassRoomMember | null;
  p2Member: GlassRoomMember | null;
  countdownSec: number;
  partnerDisconnectedSec: number | null;
  partnerLeftPermanently: boolean;
  activeEmotes: Partial<Record<PlayerSlot, GlassEmotePayload>>;
  finalResult: GlassFinalResult | null;
  error: string | null;
  createRoom(profile: GlassProfileInput): Promise<void>;
  joinRoom(code: string, profile: GlassProfileInput): Promise<void>;
  leaveRoom(): void;
  updateMyProfile(patch: Partial<GlassProfileInput>): void;
  toggleReady(): void;
  selectMap(mapId: CoopMapId): void;
  startMatch(): void;
  restartMatch(): void;
  startNextMap(): void;
  returnToLobby(): void;
  sendEmote(emoteIndex: number): void;
  sendGuestInput(input: PlayerInput): void;
  broadcastSnapshot(snapshot: CoopSnapshotPayload): void;
  notifyMatchFinished(elapsedSec: number, shatters: number): void;
  setSnapshotListener(
    fn: ((snapshot: CoopSnapshotPayload) => void) | null,
  ): void;
  setGuestInputListener(
    fn: ((input: GlassInputPayload) => void) | null,
  ): void;
}

type MatchRoster = {
  hostPeerId: string;
  guestPeerId: string;
};

function getOrCreatePeerId(): string {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const existing = window.sessionStorage.getItem(GLASS_PEER_STORAGE_KEY);
      if (existing && existing.trim().length > 0) {
        return existing;
      }
      const generated = `glass-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(GLASS_PEER_STORAGE_KEY, generated);
      return generated;
    } catch {
      // Fallback below
    }
  }
  return `glass-${Math.random().toString(36).slice(2, 10)}`;
}

function parsePresenceMembers(
  presenceState: Record<string, unknown[]>,
): GlassRoomMember[] {
  const byPeer = new Map<string, GlassRoomMember>();
  for (const entries of Object.values(presenceState)) {
    if (!Array.isArray(entries)) continue;
    for (const raw of entries) {
      if (!raw || typeof raw !== 'object') continue;
      const m = raw as Partial<GlassRoomMember>;
      if (typeof m.peerId !== 'string' || typeof m.name !== 'string') continue;
      const existing = byPeer.get(m.peerId);
      const candidate: GlassRoomMember = {
        peerId: m.peerId,
        name: m.name,
        animal: (m.animal ?? 'dog') as AnimalId,
        accessory: normalizeAccessories(m.accessory as AccessorySelection),
        ready: Boolean(m.ready),
        joinedAt: typeof m.joinedAt === 'number' ? m.joinedAt : Date.now(),
        ...(isCoopMapId(m.selectedMap) ? { selectedMap: m.selectedMap } : {}),
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

function inputsEqual(a: PlayerInput, b: PlayerInput): boolean {
  return (
    a.moveX === b.moveX &&
    a.moveZ === b.moveZ &&
    a.jump === b.jump &&
    a.lift === b.lift
  );
}

function getSnapshotFailures(snapshot: CoopSnapshotPayload): number {
  return 'shatters' in snapshot ? snapshot.shatters : snapshot.failures;
}

function getSnapshotMapId(snapshot: CoopSnapshotPayload): CoopMapId {
  return isCoopMapId(snapshot.mapId) ? snapshot.mapId : DEFAULT_COOP_MAP_ID;
}

/**
 * Manages an ephemeral 2-player Glass Carry Co-op room via Supabase Realtime
 * Presence and Broadcast. High-frequency 15Hz input and snapshot packets are
 * routed strictly through ref callbacks so they never cause React re-renders.
 */
export function useGlassRoom(): GlassRoomController {
  const isConfigured = isSupabaseConfigured();
  const [myPeerId] = useState<string>(() => getOrCreatePeerId());

  const [connectionStatus, setConnectionStatus] =
    useState<GlassConnectionStatus>('disconnected');
  const [phase, setPhase] = useState<GlassRoomPhase>('idle');
  const [selectedMap, setSelectedMap] = useState<CoopMapId>(DEFAULT_COOP_MAP_ID);
  const [roomCode, setRoomCode] = useState<string>('');
  const [matchId, setMatchId] = useState<string>('');
  const [members, setMembers] = useState<GlassRoomMember[]>([]);
  const [p1MemberState, setP1MemberState] = useState<GlassRoomMember | null>(
    null,
  );
  const [p2MemberState, setP2MemberState] = useState<GlassRoomMember | null>(
    null,
  );
  const [mySlotState, setMySlotState] = useState<PlayerSlot | null>(null);
  const [isHostState, setIsHostState] = useState<boolean>(false);
  const [countdownSec, setCountdownSec] = useState<number>(0);
  const [partnerDisconnectedSec, setPartnerDisconnectedSec] = useState<
    number | null
  >(null);
  const [partnerLeftPermanently, setPartnerLeftPermanently] =
    useState<boolean>(false);
  const [activeEmotes, setActiveEmotes] = useState<
    Partial<Record<PlayerSlot, GlassEmotePayload>>
  >({});
  const [finalResult, setFinalResult] = useState<GlassFinalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const connectResolveRef = useRef<(() => void) | null>(null);
  const myProfileRef = useRef<GlassRoomMember | null>(null);
  const asHostRef = useRef<boolean>(false);
  const phaseRef = useRef<GlassRoomPhase>('idle');
  const selectedMapRef = useRef<CoopMapId>(DEFAULT_COOP_MAP_ID);
  const roomCodeRef = useRef<string>('');
  const matchIdRef = useRef<string>('');
  const membersRef = useRef<GlassRoomMember[]>([]);
  const matchRosterRef = useRef<MatchRoster | null>(null);
  const matchMembersRef = useRef<{
    p1: GlassRoomMember | null;
    p2: GlassRoomMember | null;
  }>({ p1: null, p2: null });
  const isHostRef = useRef<boolean>(false);
  const mySlotRef = useRef<PlayerSlot | null>(null);

  const countdownTimerRef = useRef<number | null>(null);
  const countdownEndMsRef = useRef<number>(0);
  const disconnectTimerRef = useRef<number | null>(null);
  const lastDisconnectedSecRef = useRef<number | null>(null);
  const partnerLeftPermanentlyRef = useRef<boolean>(false);
  const emoteTimersRef = useRef<Partial<Record<PlayerSlot, number>>>({});

  const lastSnapshotRef = useRef<CoopSnapshotPayload | null>(null);
  const finalResultRef = useRef<GlassFinalResult | null>(null);

  const snapshotListenerRef = useRef<
    ((snapshot: CoopSnapshotPayload) => void) | null
  >(null);
  const guestInputListenerRef = useRef<
    ((input: GlassInputPayload) => void) | null
  >(null);

  const updateSelectedMap = useCallback((nextMap: CoopMapId) => {
    selectedMapRef.current = nextMap;
    setSelectedMap(nextMap);
  }, []);

  const inputSeqRef = useRef<number>(0);
  const lastGuestSeqRef = useRef<number>(0);
  const lastInputSentAtRef = useRef<number>(0);
  const lastSentInputRef = useRef<PlayerInput | null>(null);
  const pendingInputRef = useRef<PlayerInput | null>(null);
  const inputThrottleTimerRef = useRef<number | null>(null);

  const resolvePendingConnect = useCallback(() => {
    const resolve = connectResolveRef.current;
    connectResolveRef.current = null;
    resolve?.();
  }, []);

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    countdownEndMsRef.current = 0;
  }, []);

  const clearDisconnectTimer = useCallback(() => {
    if (disconnectTimerRef.current !== null) {
      window.clearInterval(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    lastDisconnectedSecRef.current = null;
  }, []);

  const clearInputThrottle = useCallback(() => {
    if (inputThrottleTimerRef.current !== null) {
      window.clearTimeout(inputThrottleTimerRef.current);
      inputThrottleTimerRef.current = null;
    }
    pendingInputRef.current = null;
  }, []);

  const clearEmoteTimers = useCallback(() => {
    for (const slot of ['p1', 'p2'] as const) {
      const timerId = emoteTimersRef.current[slot];
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
        delete emoteTimersRef.current[slot];
      }
    }
  }, []);

  const teardownChannel = useCallback(() => {
    resolvePendingConnect();
    clearCountdownTimer();
    clearDisconnectTimer();
    clearInputThrottle();
    clearEmoteTimers();
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
    clearDisconnectTimer,
    clearEmoteTimers,
    clearInputThrottle,
    resolvePendingConnect,
  ]);

  const syncRoleStates = useCallback(
    (
      activeMembers: GlassRoomMember[],
      roster: MatchRoster | null,
      fallbackAsHost: boolean,
    ) => {
      if (roster) {
        const presentP1 =
          activeMembers.find((m) => m.peerId === roster.hostPeerId) ?? null;
        const presentP2 =
          activeMembers.find((m) => m.peerId === roster.guestPeerId) ?? null;
        if (presentP1) matchMembersRef.current.p1 = presentP1;
        if (presentP2) matchMembersRef.current.p2 = presentP2;

        const p1 = presentP1 ?? matchMembersRef.current.p1;
        const p2 = presentP2 ?? matchMembersRef.current.p2;
        const slot: PlayerSlot | null =
          myPeerId === roster.hostPeerId
            ? 'p1'
            : myPeerId === roster.guestPeerId
              ? 'p2'
              : null;
        const host = myPeerId === roster.hostPeerId;

        isHostRef.current = host;
        mySlotRef.current = slot;
        setP1MemberState(p1);
        setP2MemberState(p2);
        setMySlotState(slot);
        setIsHostState(host);
        return;
      }

      const p1 = activeMembers[0] ?? null;
      const p2 = activeMembers[1] ?? null;
      const slot: PlayerSlot | null =
        p1?.peerId === myPeerId
          ? 'p1'
          : p2?.peerId === myPeerId
            ? 'p2'
            : fallbackAsHost && activeMembers.length === 0
              ? 'p1'
              : null;
      const host = p1 ? p1.peerId === myPeerId : fallbackAsHost;

      isHostRef.current = host;
      mySlotRef.current = slot;
      setP1MemberState(p1);
      setP2MemberState(p2);
      setMySlotState(slot);
      setIsHostState(host);
    },
    [myPeerId],
  );

  const resetMatchState = useCallback(
    (nextPhase: GlassRoomPhase) => {
      clearCountdownTimer();
      clearDisconnectTimer();
      clearInputThrottle();
      clearEmoteTimers();

      matchIdRef.current = '';
      matchRosterRef.current = null;
      matchMembersRef.current = { p1: null, p2: null };
      lastSnapshotRef.current = null;
      finalResultRef.current = null;
      partnerLeftPermanentlyRef.current = false;
      inputSeqRef.current = 0;
      lastGuestSeqRef.current = 0;
      lastInputSentAtRef.current = 0;
      lastSentInputRef.current = null;
      phaseRef.current = nextPhase;

      setMatchId('');
      setCountdownSec(0);
      setPartnerDisconnectedSec(null);
      setPartnerLeftPermanently(false);
      setActiveEmotes({});
      setFinalResult(null);
      setPhase(nextPhase);

      if (nextPhase === 'lobby' && myProfileRef.current?.ready) {
        const updated: GlassRoomMember = {
          ...myProfileRef.current,
          ready: false,
        };
        myProfileRef.current = updated;
        if (channelRef.current) {
          void channelRef.current.track(updated);
        }
      }

      syncRoleStates(membersRef.current, null, asHostRef.current);
    },
    [
      clearCountdownTimer,
      clearDisconnectTimer,
      clearEmoteTimers,
      clearInputThrottle,
      syncRoleStates,
    ],
  );

  const sendSyncStateToChannel = useCallback(
    (channel: RealtimeChannel, targetPeerId: string) => {
      if (!isHostRef.current || !matchIdRef.current || !matchRosterRef.current) {
        return;
      }
      const { hostPeerId, guestPeerId } = matchRosterRef.current;
      if (targetPeerId !== hostPeerId && targetPeerId !== guestPeerId) {
        return;
      }
      const activePhase = phaseRef.current;
      if (
        activePhase !== 'countdown' &&
        activePhase !== 'playing' &&
        activePhase !== 'finished'
      ) {
        return;
      }
      const remainingMs =
        activePhase === 'countdown'
          ? Math.max(0, countdownEndMsRef.current - Date.now())
          : 0;
      const syncPayload: GlassSyncStatePayload = {
        targetPeerId,
        matchId: matchIdRef.current,
        hostPeerId,
        guestPeerId,
        mapId: selectedMapRef.current,
        phase: activePhase,
        countdownRemainingMs: remainingMs,
        latestSnapshot: lastSnapshotRef.current,
        snapshot: lastSnapshotRef.current,
        finalResult: finalResultRef.current,
      };
      void channel.send({
        type: 'broadcast',
        event: 'glass:sync_state',
        payload: syncPayload,
      });
    },
    [],
  );

  const evaluatePartnerPresence = useCallback(
    (presentMembers: GlassRoomMember[]) => {
      if (
        phaseRef.current !== 'playing' ||
        !matchRosterRef.current ||
        !matchIdRef.current ||
        partnerLeftPermanentlyRef.current
      ) {
        return;
      }

      const roster = matchRosterRef.current;
      const partnerPeerId =
        myPeerId === roster.hostPeerId ? roster.guestPeerId : roster.hostPeerId;
      if (!partnerPeerId) return;

      const partnerOnline = presentMembers.some(
        (m) => m.peerId === partnerPeerId,
      );

      if (partnerOnline) {
        const wasDisconnected = disconnectTimerRef.current !== null;
        if (wasDisconnected) {
          clearDisconnectTimer();
          setPartnerDisconnectedSec(null);
          const channel = channelRef.current;
          if (channel) {
            if (isHostRef.current) {
              sendSyncStateToChannel(channel, partnerPeerId);
            } else {
              const req: GlassSyncRequestPayload = {
                requesterPeerId: myPeerId,
                matchId: matchIdRef.current,
              };
              void channel.send({
                type: 'broadcast',
                event: 'glass:sync_request',
                payload: req,
              });
            }
          }
        }
        return;
      }

      if (disconnectTimerRef.current !== null) {
        return;
      }

      const deadline = Date.now() + GLASS_DISCONNECT_GRACE_MS;
      const initialSec = Math.ceil(GLASS_DISCONNECT_GRACE_MS / 1000);
      lastDisconnectedSecRef.current = initialSec;
      setPartnerDisconnectedSec(initialSec);

      const capturedMatchId = matchIdRef.current;
      disconnectTimerRef.current = window.setInterval(() => {
        if (
          phaseRef.current !== 'playing' ||
          matchIdRef.current !== capturedMatchId
        ) {
          clearDisconnectTimer();
          return;
        }
        const remainingMs = deadline - Date.now();
        const nextSec = Math.max(0, Math.ceil(remainingMs / 1000));
        if (nextSec !== lastDisconnectedSecRef.current) {
          lastDisconnectedSecRef.current = nextSec;
          setPartnerDisconnectedSec(nextSec);
        }
        if (remainingMs <= 0) {
          clearDisconnectTimer();
          partnerLeftPermanentlyRef.current = true;
          setPartnerLeftPermanently(true);
        }
      }, 250);
    },
    [clearDisconnectTimer, myPeerId, sendSyncStateToChannel],
  );

  const applyMatchFinished = useCallback(
    (
      finishedMatchId: string,
      elapsedSec: number,
      shatters: number,
      mapId?: CoopMapId,
    ) => {
      if (!finishedMatchId || finishedMatchId !== matchIdRef.current) return;
      clearCountdownTimer();
      clearDisconnectTimer();
      clearInputThrottle();

      const resolvedMapId = isCoopMapId(mapId) ? mapId : selectedMapRef.current;
      const result: GlassFinalResult = {
        matchId: finishedMatchId,
        mapId: resolvedMapId,
        elapsedSec,
        shatters,
      };
      finalResultRef.current = result;
      phaseRef.current = 'finished';
      setFinalResult(result);
      setCountdownSec(0);
      setPartnerDisconnectedSec(null);
      setPhase('finished');
    },
    [clearCountdownTimer, clearDisconnectTimer, clearInputThrottle],
  );

  const startCountdownOrPlay = useCallback(
    (capturedMatchId: string, durationMs: number) => {
      clearCountdownTimer();
      if (durationMs <= 0) {
        phaseRef.current = 'playing';
        setPhase('playing');
        setCountdownSec(0);
        evaluatePartnerPresence(membersRef.current);
        return;
      }

      phaseRef.current = 'countdown';
      setPhase('countdown');
      const endTime = Date.now() + durationMs;
      countdownEndMsRef.current = endTime;
      let lastShownSec = Math.max(1, Math.ceil(durationMs / 1000));
      setCountdownSec(lastShownSec);

      countdownTimerRef.current = window.setInterval(() => {
        if (matchIdRef.current !== capturedMatchId) {
          clearCountdownTimer();
          return;
        }
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
          clearCountdownTimer();
          setCountdownSec(0);
          if (phaseRef.current === 'countdown') {
            phaseRef.current = 'playing';
            setPhase('playing');
            evaluatePartnerPresence(membersRef.current);
          }
          return;
        }
        const nextSec = Math.ceil(remaining / 1000);
        if (nextSec !== lastShownSec) {
          lastShownSec = nextSec;
          setCountdownSec(nextSec);
        }
      }, 150);
    },
    [clearCountdownTimer, evaluatePartnerPresence],
  );

  const applyMatchStart = useCallback(
    (evt: GlassStartPayload) => {
      if (!evt || !evt.matchId || matchIdRef.current === evt.matchId) return;

      clearCountdownTimer();
      clearDisconnectTimer();
      clearInputThrottle();

      const nextMap: CoopMapId = isCoopMapId(evt.mapId)
        ? evt.mapId
        : DEFAULT_COOP_MAP_ID;
      updateSelectedMap(nextMap);

      const roster: MatchRoster = {
        hostPeerId: evt.hostPeerId,
        guestPeerId: evt.guestPeerId,
      };

      matchIdRef.current = evt.matchId;
      matchRosterRef.current = roster;
      matchMembersRef.current = {
        p1:
          membersRef.current.find((m) => m.peerId === evt.hostPeerId) ??
          matchMembersRef.current.p1,
        p2:
          membersRef.current.find((m) => m.peerId === evt.guestPeerId) ??
          matchMembersRef.current.p2,
      };
      lastSnapshotRef.current = null;
      finalResultRef.current = null;
      partnerLeftPermanentlyRef.current = false;
      inputSeqRef.current = 0;
      lastGuestSeqRef.current = 0;
      lastInputSentAtRef.current = 0;
      lastSentInputRef.current = null;

      setMatchId(evt.matchId);
      setPartnerDisconnectedSec(null);
      setPartnerLeftPermanently(false);
      setFinalResult(null);
      syncRoleStates(membersRef.current, roster, asHostRef.current);

      const elapsedSinceStart =
        typeof evt.startedAt === 'number'
          ? Math.max(0, Date.now() - evt.startedAt)
          : 0;
      const baseDuration = Math.max(0, evt.countdownMs ?? GLASS_COUNTDOWN_MS);
      const remainingDuration = Math.max(0, baseDuration - elapsedSinceStart);
      startCountdownOrPlay(evt.matchId, remainingDuration);
    },
    [
      clearCountdownTimer,
      clearDisconnectTimer,
      clearInputThrottle,
      startCountdownOrPlay,
      syncRoleStates,
      updateSelectedMap,
    ],
  );

  const applySyncState = useCallback(
    (evt: GlassSyncStatePayload) => {
      if (!evt || evt.targetPeerId !== myPeerId || !evt.matchId) return;
      if (myPeerId !== evt.hostPeerId && myPeerId !== evt.guestPeerId) return;

      const incomingSnapshot = evt.latestSnapshot ?? evt.snapshot ?? null;
      const resolvedMapId: CoopMapId = isCoopMapId(evt.mapId)
        ? evt.mapId
        : incomingSnapshot && isCoopMapId(incomingSnapshot.mapId)
          ? incomingSnapshot.mapId
          : DEFAULT_COOP_MAP_ID;
      updateSelectedMap(resolvedMapId);

      const roster: MatchRoster = {
        hostPeerId: evt.hostPeerId,
        guestPeerId: evt.guestPeerId,
      };

      const isSameMatch = matchIdRef.current === evt.matchId;
      matchIdRef.current = evt.matchId;
      matchRosterRef.current = roster;
      partnerLeftPermanentlyRef.current = false;

      if (!isSameMatch) {
        inputSeqRef.current = 0;
        lastGuestSeqRef.current = 0;
        lastInputSentAtRef.current = 0;
        lastSentInputRef.current = null;
      }

      clearDisconnectTimer();
      setMatchId(evt.matchId);
      setPartnerDisconnectedSec(null);
      setPartnerLeftPermanently(false);
      syncRoleStates(membersRef.current, roster, asHostRef.current);

      if (evt.phase === 'finished') {
        if (incomingSnapshot) {
          lastSnapshotRef.current = incomingSnapshot;
          snapshotListenerRef.current?.(incomingSnapshot);
        }
        const res = evt.finalResult ?? {
          matchId: evt.matchId,
          mapId: resolvedMapId,
          elapsedSec: incomingSnapshot?.matchTime ?? 0,
          shatters: incomingSnapshot ? getSnapshotFailures(incomingSnapshot) : 0,
        };
        applyMatchFinished(
          evt.matchId,
          res.elapsedSec,
          res.shatters,
          res.mapId ?? resolvedMapId,
        );
        return;
      }

      if (evt.phase === 'countdown') {
        startCountdownOrPlay(evt.matchId, evt.countdownRemainingMs);
      } else {
        clearCountdownTimer();
        phaseRef.current = 'playing';
        setCountdownSec(0);
        setPhase('playing');
      }

      if (incomingSnapshot) {
        lastSnapshotRef.current = incomingSnapshot;
        snapshotListenerRef.current?.(incomingSnapshot);
      }
    },
    [
      applyMatchFinished,
      clearCountdownTimer,
      clearDisconnectTimer,
      myPeerId,
      startCountdownOrPlay,
      syncRoleStates,
      updateSelectedMap,
    ],
  );

  const applyEmote = useCallback((evt: GlassEmotePayload) => {
    if (evt.slot !== 'p1' && evt.slot !== 'p2') return;

    const prevTimer = emoteTimersRef.current[evt.slot];
    if (prevTimer !== undefined) {
      window.clearTimeout(prevTimer);
    }

    setActiveEmotes((prev) => ({
      ...prev,
      [evt.slot]: evt,
    }));

    emoteTimersRef.current[evt.slot] = window.setTimeout(() => {
      delete emoteTimersRef.current[evt.slot];
      setActiveEmotes((prev) => {
        const current = prev[evt.slot];
        if (!current || current.at !== evt.at || current.peerId !== evt.peerId) {
          return prev;
        }
        const next = { ...prev };
        delete next[evt.slot];
        return next;
      });
    }, EMOTE_DISPLAY_MS);
  }, []);

  const leaveRoom = useCallback(() => {
    teardownChannel();
    myProfileRef.current = null;
    asHostRef.current = false;
    roomCodeRef.current = '';
    membersRef.current = [];

    setRoomCode('');
    setMembers([]);
    setConnectionStatus('disconnected');
    setError(null);
    updateSelectedMap(DEFAULT_COOP_MAP_ID);
    resetMatchState('idle');
  }, [resetMatchState, teardownChannel, updateSelectedMap]);

  const connectToRoom = useCallback(
    (
      rawCode: string,
      profile: GlassProfileInput,
      asHost: boolean,
    ): Promise<void> => {
      const client = getSupabaseClient();
      if (!client) {
        setError(
          'Chưa cấu hình Supabase Realtime (.env.local). Vui lòng xem SUPABASE_SETUP.md.',
        );
        setConnectionStatus('error');
        return Promise.resolve();
      }

      const code = normalizeRoomCode(rawCode);
      if (code.length < 4) {
        setError('Mã phòng cần có từ 4 đến 6 ký tự.');
        return Promise.resolve();
      }

      teardownChannel();
      asHostRef.current = asHost;
      roomCodeRef.current = code;
      membersRef.current = [];
      setMembers([]);
      updateSelectedMap(DEFAULT_COOP_MAP_ID);
      resetMatchState('lobby');

      setError(null);
      setRoomCode(code);
      setConnectionStatus('connecting');

      const initialMember: GlassRoomMember = {
        peerId: myPeerId,
        name: profile.name.trim() || 'Người chơi',
        animal: profile.animal,
        accessory: normalizeAccessories(profile.accessory),
        ready: asHost,
        joinedAt: Date.now(),
        ...(asHost ? { selectedMap: DEFAULT_COOP_MAP_ID } : {}),
      };
      myProfileRef.current = initialMember;
      syncRoleStates([], null, asHost);

      const channel = client.channel(`glass-carry-room-${code}`, {
        config: {
          broadcast: { self: false },
          presence: { key: myPeerId },
        },
      });
      channelRef.current = channel;

      return new Promise<void>((resolve) => {
        connectResolveRef.current = resolve;

        const rejectAsRoomFull = () => {
          teardownChannel();
          myProfileRef.current = null;
          asHostRef.current = false;
          roomCodeRef.current = '';
          membersRef.current = [];
          setMembers([]);
          setRoomCode('');
          setConnectionStatus('disconnected');
          resetMatchState('idle');
          setError('Phòng đã đủ 2 người chơi.');
          resolvePendingConnect();
        };

        channel
          .on('presence', { event: 'sync' }, () => {
            const parsed = parsePresenceMembers(
              channel.presenceState() as Record<string, unknown[]>,
            );

            // Enforce 2-player room cap cleanly before or after own Presence track
            if (!asHostRef.current && !matchRosterRef.current) {
              const myEntry = parsed.find((m) => m.peerId === myPeerId);
              if (!myEntry && parsed.length >= GLASS_MAX_PLAYERS) {
                rejectAsRoomFull();
                return;
              }
              if (myEntry) {
                const earlierPeersCount = parsed.filter(
                  (m) =>
                    m.peerId !== myPeerId &&
                    (m.joinedAt < myEntry.joinedAt ||
                      (m.joinedAt === myEntry.joinedAt &&
                        m.peerId.localeCompare(myPeerId) < 0)),
                ).length;
                if (earlierPeersCount >= GLASS_MAX_PLAYERS) {
                  rejectAsRoomFull();
                  return;
                }
              }
            }

            const capped = parsed.slice(0, GLASS_MAX_PLAYERS);
            membersRef.current = capped;
            setMembers(capped);
            syncRoleStates(capped, matchRosterRef.current, asHostRef.current);
            if (
              phaseRef.current === 'lobby' &&
              !isHostRef.current &&
              capped[0]?.selectedMap &&
              isCoopMapId(capped[0].selectedMap) &&
              capped[0].selectedMap !== selectedMapRef.current
            ) {
              updateSelectedMap(capped[0].selectedMap);
            }
            evaluatePartnerPresence(parsed);
          })
          .on('broadcast', { event: 'coop:select_map' }, ({ payload }) => {
            const evt = payload as CoopSelectMapPayload | undefined;
            if (!evt || !isCoopMapId(evt.mapId)) return;
            const expectedHostPeerId =
              matchRosterRef.current?.hostPeerId ??
              membersRef.current[0]?.peerId;
            if (!expectedHostPeerId || evt.hostPeerId !== expectedHostPeerId) {
              return;
            }
            updateSelectedMap(evt.mapId);
            if (phaseRef.current === 'lobby' && myProfileRef.current?.ready) {
              const updated: GlassRoomMember = {
                ...myProfileRef.current,
                ready: false,
              };
              myProfileRef.current = updated;
              void channel.track(updated);
            }
          })
          .on('broadcast', { event: 'glass:start' }, ({ payload }) => {
            const evt = payload as GlassStartPayload | undefined;
            if (!evt) return;
            applyMatchStart(evt);
          })
          .on('broadcast', { event: 'glass:restart' }, ({ payload }) => {
            const evt = payload as GlassStartPayload | undefined;
            if (!evt) return;
            applyMatchStart(evt);
          })
          .on('broadcast', { event: 'glass:return_lobby' }, ({ payload }) => {
            const evt = payload as GlassReturnLobbyPayload | undefined;
            if (!evt) return;
            resetMatchState('lobby');
          })
          .on('broadcast', { event: 'glass:input' }, ({ payload }) => {
            if (!isHostRef.current) return;
            const evt = payload as GlassInputPayload | undefined;
            if (!evt || evt.peerId === myPeerId) return;
            if (!evt.matchId || evt.matchId !== matchIdRef.current) return;
            if (evt.seq <= lastGuestSeqRef.current) return;
            lastGuestSeqRef.current = evt.seq;
            guestInputListenerRef.current?.(evt);
          })
          .on('broadcast', { event: 'glass:snapshot' }, ({ payload }) => {
            if (isHostRef.current) return;
            const evt = payload as CoopSnapshotPayload | undefined;
            if (!evt || !evt.matchId || evt.matchId !== matchIdRef.current) {
              return;
            }
            lastSnapshotRef.current = evt;
            snapshotListenerRef.current?.(evt);
            if (
              evt.phase === 'finished' &&
              finalResultRef.current?.matchId !== evt.matchId
            ) {
              applyMatchFinished(
                evt.matchId,
                evt.matchTime,
                getSnapshotFailures(evt),
                getSnapshotMapId(evt),
              );
            }
          })
          .on('broadcast', { event: 'glass:finish' }, ({ payload }) => {
            const evt = payload as GlassFinishPayload | undefined;
            if (!evt || !evt.matchId || evt.matchId !== matchIdRef.current) {
              return;
            }
            applyMatchFinished(
              evt.matchId,
              evt.elapsedSec,
              evt.shatters,
              evt.mapId,
            );
          })
          .on('broadcast', { event: 'glass:emote' }, ({ payload }) => {
            const evt = payload as GlassEmotePayload | undefined;
            if (!evt) return;
            applyEmote(evt);
          })
          .on('broadcast', { event: 'glass:sync_request' }, ({ payload }) => {
            const evt = payload as GlassSyncRequestPayload | undefined;
            if (!evt || evt.requesterPeerId === myPeerId) return;
            sendSyncStateToChannel(channel, evt.requesterPeerId);
          })
          .on('broadcast', { event: 'glass:sync_state' }, ({ payload }) => {
            const evt = payload as GlassSyncStatePayload | undefined;
            if (!evt) return;
            applySyncState(evt);
          });

        channel.subscribe(async (status) => {
          if (channelRef.current !== channel) {
            resolvePendingConnect();
            return;
          }
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
            setError(null);
            if (myProfileRef.current) {
              await channel.track(myProfileRef.current);
            }
            if (channelRef.current === channel && !asHost) {
              const req: GlassSyncRequestPayload = {
                requesterPeerId: myPeerId,
                matchId: matchIdRef.current,
              };
              void channel.send({
                type: 'broadcast',
                event: 'glass:sync_request',
                payload: req,
              });
            }
            resolvePendingConnect();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionStatus('error');
            setError(
              'Không thể kết nối tới Supabase Realtime. Vui lòng kiểm tra mạng hoặc cấu hình.',
            );
            resolvePendingConnect();
          } else if (status === 'CLOSED') {
            setConnectionStatus('disconnected');
            resolvePendingConnect();
          }
        });
      });
    },
    [
      applyEmote,
      applyMatchFinished,
      applyMatchStart,
      applySyncState,
      evaluatePartnerPresence,
      myPeerId,
      resetMatchState,
      resolvePendingConnect,
      sendSyncStateToChannel,
      syncRoleStates,
      teardownChannel,
      updateSelectedMap,
    ],
  );

  const createRoom = useCallback(
    async (profile: GlassProfileInput): Promise<void> => {
      const code = generateRoomCode(6);
      await connectToRoom(code, profile, true);
    },
    [connectToRoom],
  );

  const joinRoom = useCallback(
    async (code: string, profile: GlassProfileInput): Promise<void> => {
      await connectToRoom(code, profile, false);
    },
    [connectToRoom],
  );

  const updateMyProfile = useCallback(
    (patch: Partial<GlassProfileInput>) => {
      const current = myProfileRef.current;
      const channel = channelRef.current;
      if (!current) return;

      const updated: GlassRoomMember = {
        ...current,
        name:
          patch.name !== undefined
            ? patch.name.trim() || current.name
            : current.name,
        animal: patch.animal ?? current.animal,
        accessory:
          patch.accessory !== undefined
            ? normalizeAccessories(patch.accessory)
            : current.accessory,
      };
      myProfileRef.current = updated;
      if (channel) {
        void channel.track(updated);
      }
    },
    [],
  );

  const toggleReady = useCallback(() => {
    const current = myProfileRef.current;
    const channel = channelRef.current;
    if (!current) return;

    const updated: GlassRoomMember = {
      ...current,
      ready: !current.ready,
    };
    myProfileRef.current = updated;
    if (channel) {
      void channel.track(updated);
    }
  }, []);

  const selectMap = useCallback(
    (mapId: CoopMapId) => {
      if (!isHostRef.current || !isCoopMapId(mapId)) return;
      if (phaseRef.current !== 'lobby' && phaseRef.current !== 'finished') {
        return;
      }

      updateSelectedMap(mapId);

      const current = myProfileRef.current;
      const channel = channelRef.current;
      if (current) {
        const updated: GlassRoomMember = {
          ...current,
          ready: false,
          selectedMap: mapId,
        };
        myProfileRef.current = updated;
        if (channel) {
          void channel.track(updated);
        }
      }

      if (channel) {
        const payload: CoopSelectMapPayload = {
          hostPeerId: myPeerId,
          mapId,
        };
        void channel.send({
          type: 'broadcast',
          event: 'coop:select_map',
          payload,
        });
      }
    },
    [myPeerId, updateSelectedMap],
  );

  const launchMatch = useCallback(
    (
      eventName: 'glass:start' | 'glass:restart',
      requireReady: boolean,
      mapIdOverride?: CoopMapId,
    ) => {
      if (!isHostRef.current) return;
      const active = membersRef.current.slice(0, GLASS_MAX_PLAYERS);
      if (active.length < GLASS_MAX_PLAYERS) return;
      if (requireReady && !active.every((m) => m.ready)) return;

      const targetMap = mapIdOverride ?? selectedMapRef.current;
      const nextMatchId = `glass-${roomCodeRef.current}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const payload: GlassStartPayload = {
        matchId: nextMatchId,
        hostPeerId: active[0].peerId,
        guestPeerId: active[1].peerId,
        countdownMs: GLASS_COUNTDOWN_MS,
        startedAt: Date.now(),
        mapId: targetMap,
      };

      applyMatchStart(payload);

      const channel = channelRef.current;
      if (channel) {
        void channel.send({
          type: 'broadcast',
          event: eventName,
          payload,
        });
      }
    },
    [applyMatchStart],
  );

  const startMatch = useCallback(() => {
    if (phaseRef.current !== 'lobby') return;
    launchMatch('glass:start', true);
  }, [launchMatch]);

  const restartMatch = useCallback(() => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'lobby') return;
    launchMatch('glass:restart', false);
  }, [launchMatch]);

  const startNextMap = useCallback(() => {
    if (!isHostRef.current || phaseRef.current !== 'finished') return;
    const active = membersRef.current.slice(0, GLASS_MAX_PLAYERS);
    if (active.length < GLASS_MAX_PLAYERS) return;

    const nextMap = getNextCoopMapId(selectedMapRef.current);
    updateSelectedMap(nextMap);

    const current = myProfileRef.current;
    const channel = channelRef.current;
    if (current) {
      const updated: GlassRoomMember = {
        ...current,
        selectedMap: nextMap,
      };
      myProfileRef.current = updated;
      if (channel) {
        void channel.track(updated);
      }
    }

    if (channel) {
      const selectPayload: CoopSelectMapPayload = {
        hostPeerId: myPeerId,
        mapId: nextMap,
      };
      void channel.send({
        type: 'broadcast',
        event: 'coop:select_map',
        payload: selectPayload,
      });
    }

    launchMatch('glass:start', false, nextMap);
  }, [launchMatch, myPeerId, updateSelectedMap]);

  const returnToLobby = useCallback(() => {
    if (!isHostRef.current) return;
    resetMatchState('lobby');
    const channel = channelRef.current;
    if (channel) {
      const payload: GlassReturnLobbyPayload = { hostPeerId: myPeerId };
      void channel.send({
        type: 'broadcast',
        event: 'glass:return_lobby',
        payload,
      });
    }
  }, [myPeerId, resetMatchState]);

  const sendEmote = useCallback(
    (emoteIndex: number) => {
      const emote = GLASS_EMOTES[emoteIndex];
      if (!emote) return;

      const slot: PlayerSlot =
        mySlotRef.current ?? (isHostRef.current ? 'p1' : 'p2');
      const payload: GlassEmotePayload = {
        peerId: myPeerId,
        slot,
        icon: emote.icon,
        text: emote.text,
        at: Date.now(),
      };
      applyEmote(payload);

      const channel = channelRef.current;
      if (channel) {
        void channel.send({
          type: 'broadcast',
          event: 'glass:emote',
          payload,
        });
      }
    },
    [applyEmote, myPeerId],
  );

  const flushGuestInput = useCallback(
    (input: PlayerInput, nowMs: number) => {
      const channel = channelRef.current;
      const currentMatchId = matchIdRef.current;
      if (
        !channel ||
        !currentMatchId ||
        phaseRef.current !== 'playing' ||
        isHostRef.current
      ) {
        return;
      }

      const seq = ++inputSeqRef.current;
      const payload: GlassInputPayload = {
        matchId: currentMatchId,
        peerId: myPeerId,
        seq,
        moveX: input.moveX,
        moveZ: input.moveZ,
        jump: input.jump,
        lift: input.lift,
      };

      lastInputSentAtRef.current = nowMs;
      lastSentInputRef.current = { ...input };

      void channel.send({
        type: 'broadcast',
        event: 'glass:input',
        payload,
      });
    },
    [myPeerId],
  );

  const sendGuestInput = useCallback(
    (input: PlayerInput) => {
      if (
        isHostRef.current ||
        phaseRef.current !== 'playing' ||
        !matchIdRef.current ||
        !channelRef.current
      ) {
        return;
      }

      const now = Date.now();
      const elapsed = now - lastInputSentAtRef.current;
      const latchedJump = Boolean(pendingInputRef.current?.jump || input.jump);
      const latchedLift =
        input.lift !== 0 ? input.lift : (pendingInputRef.current?.lift ?? 0);
      const mergedInput: PlayerInput =
        latchedJump === input.jump && latchedLift === input.lift
          ? input
          : { ...input, jump: latchedJump, lift: latchedLift };
      const changed =
        !lastSentInputRef.current ||
        !inputsEqual(mergedInput, lastSentInputRef.current);

      if (
        elapsed >= GLASS_INPUT_INTERVAL_MS &&
        (changed || elapsed >= GLASS_INPUT_INTERVAL_MS * 2)
      ) {
        clearInputThrottle();
        flushGuestInput(mergedInput, now);
        return;
      }

      pendingInputRef.current = {
        moveX: mergedInput.moveX,
        moveZ: mergedInput.moveZ,
        jump: latchedJump,
        lift: latchedLift,
      };

      const targetInterval = changed
        ? GLASS_INPUT_INTERVAL_MS
        : GLASS_INPUT_INTERVAL_MS * 2;
      const waitMs = Math.max(1, targetInterval - elapsed);

      if (changed && inputThrottleTimerRef.current !== null) {
        window.clearTimeout(inputThrottleTimerRef.current);
        inputThrottleTimerRef.current = null;
      }

      if (inputThrottleTimerRef.current === null) {
        inputThrottleTimerRef.current = window.setTimeout(() => {
          inputThrottleTimerRef.current = null;
          const pending = pendingInputRef.current;
          pendingInputRef.current = null;
          if (!pending) return;
          flushGuestInput(pending, Date.now());
        }, waitMs);
      }
    },
    [clearInputThrottle, flushGuestInput],
  );

  const broadcastSnapshot = useCallback(
    (snapshot: CoopSnapshotPayload) => {
      if (!isHostRef.current) return;
      if (!matchIdRef.current || snapshot.matchId !== matchIdRef.current) return;

      lastSnapshotRef.current = snapshot;
      const channel = channelRef.current;
      if (channel) {
        void channel.send({
          type: 'broadcast',
          event: 'glass:snapshot',
          payload: snapshot,
        });
      }

      if (
        snapshot.phase === 'finished' &&
        finalResultRef.current?.matchId !== snapshot.matchId
      ) {
        applyMatchFinished(
          snapshot.matchId,
          snapshot.matchTime,
          getSnapshotFailures(snapshot),
          getSnapshotMapId(snapshot),
        );
      }
    },
    [applyMatchFinished],
  );

  const notifyMatchFinished = useCallback(
    (elapsedSec: number, shatters: number) => {
      const currentMatchId = matchIdRef.current;
      if (!currentMatchId) return;

      const currentMapId = selectedMapRef.current;
      applyMatchFinished(currentMatchId, elapsedSec, shatters, currentMapId);

      if (isHostRef.current && channelRef.current) {
        const payload: GlassFinishPayload = {
          matchId: currentMatchId,
          mapId: currentMapId,
          elapsedSec,
          shatters,
        };
        void channelRef.current.send({
          type: 'broadcast',
          event: 'glass:finish',
          payload,
        });
      }
    },
    [applyMatchFinished],
  );

  const setSnapshotListener = useCallback(
    (fn: ((snapshot: CoopSnapshotPayload) => void) | null) => {
      snapshotListenerRef.current = fn;
    },
    [],
  );

  const setGuestInputListener = useCallback(
    (fn: ((input: GlassInputPayload) => void) | null) => {
      guestInputListenerRef.current = fn;
    },
    [],
  );

  useEffect(() => {
    return () => {
      teardownChannel();
    };
  }, [teardownChannel]);

  return {
    isConfigured,
    connectionStatus,
    phase,
    selectedMap,
    roomCode,
    matchId,
    myPeerId,
    mySlot: mySlotState,
    isHost: isHostState,
    members,
    p1Member: p1MemberState,
    p2Member: p2MemberState,
    countdownSec,
    partnerDisconnectedSec,
    partnerLeftPermanently,
    activeEmotes,
    finalResult,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    updateMyProfile,
    toggleReady,
    selectMap,
    startMatch,
    restartMatch,
    startNextMap,
    returnToLobby,
    sendEmote,
    sendGuestInput,
    broadcastSnapshot,
    notifyMatchFinished,
    setSnapshotListener,
    setGuestInputListener,
  };
}
