import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  DEFAULT_COOP_MAP_ID,
  buildUnlockedByPackMap,
  getCoopLevelMeta,
  getCoopMapPack,
  getDefaultMapPackId,
  getNextPlayableCoopStage,
  isCoopLevelNumber,
  isCoopLevelUnlocked,
  isCoopMapId,
  type CoopLevelNumber,
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
import { createGlassInputSender } from './inputSync.ts';
import {
  GLASS_COUNTDOWN_MS,
  GLASS_DISCONNECT_GRACE_MS,
  GLASS_EMOTES,
  GLASS_MAX_PLAYERS,
  sortGlassRoomMembers,
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
  unlockedByPack?: Record<string, number>;
};

export type GlassFinalResult = {
  matchId: string;
  mapId: CoopMapId;
  mapPackId: string;
  level: CoopLevelNumber;
  elapsedSec: number;
  shatters: number;
};

export interface GlassRoomController {
  isConfigured: boolean;
  connectionStatus: GlassConnectionStatus;
  phase: GlassRoomPhase;
  selectedMap: CoopMapId;
  selectedMapPack: string;
  selectedLevel: CoopLevelNumber;
  hostUnlockedByPack: Record<string, number>;
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
  selectStage(
    actionId: CoopMapId,
    mapPackId: string,
    level: CoopLevelNumber,
  ): void;
  syncHostUnlocks(unlockedByPack: Record<string, number>): void;
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

function sanitizeUnlockedByPack(
  raw: unknown,
): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === 'number' && Number.isFinite(val)) {
      out[key] = val;
    }
  }
  return out;
}

function serializeUnlockedByPack(
  map: Readonly<Record<string, number>>,
): string {
  const keys = Object.keys(map).sort();
  return JSON.stringify(keys.map((k) => [k, map[k]]));
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
      const selectedMapPack =
        typeof m.selectedMapPack === 'string' &&
        m.selectedMapPack.trim().length > 0
          ? m.selectedMapPack.trim()
          : undefined;
      const unlockedByPack = sanitizeUnlockedByPack(m.unlockedByPack);
      const candidate: GlassRoomMember = {
        peerId: m.peerId,
        name: m.name,
        animal: (m.animal ?? 'dog') as AnimalId,
        accessory: normalizeAccessories(m.accessory as AccessorySelection),
        ready: Boolean(m.ready),
        joinedAt: typeof m.joinedAt === 'number' ? m.joinedAt : Date.now(),
        ...(typeof m.isHost === 'boolean' ? { isHost: m.isHost } : {}),
        ...(isCoopMapId(m.selectedMap) ? { selectedMap: m.selectedMap } : {}),
        ...(selectedMapPack ? { selectedMapPack } : {}),
        ...(isCoopLevelNumber(m.selectedLevel)
          ? { selectedLevel: m.selectedLevel }
          : {}),
        ...(unlockedByPack ? { unlockedByPack } : {}),
      };
      if (!existing || candidate.joinedAt <= existing.joinedAt) {
        byPeer.set(m.peerId, candidate);
      }
    }
  }
  return sortGlassRoomMembers(Array.from(byPeer.values()));
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
  const [selectedMapPack, setSelectedMapPack] = useState<string>(() =>
    getDefaultMapPackId(DEFAULT_COOP_MAP_ID),
  );
  const [selectedLevel, setSelectedLevel] = useState<CoopLevelNumber>(1);
  const [hostUnlockedByPack, setHostUnlockedByPack] = useState<
    Record<string, number>
  >(() => buildUnlockedByPackMap(undefined));
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
  const selectedMapPackRef = useRef<string>(
    getDefaultMapPackId(DEFAULT_COOP_MAP_ID),
  );
  const selectedLevelRef = useRef<CoopLevelNumber>(1);
  const localUnlockedByPackRef = useRef<Record<string, number>>(
    buildUnlockedByPackMap(undefined),
  );
  const hostUnlockedByPackRef = useRef<Record<string, number>>(
    buildUnlockedByPackMap(undefined),
  );
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

  const updateSelectedStage = useCallback(
    (
      nextMap: CoopMapId,
      nextMapPack?: string,
      nextLevel?: CoopLevelNumber,
    ) => {
      const pack = getCoopMapPack(nextMap, nextMapPack);
      const lvlMeta = getCoopLevelMeta(nextMap, pack.id, nextLevel);
      selectedMapRef.current = nextMap;
      selectedMapPackRef.current = pack.id;
      selectedLevelRef.current = lvlMeta.level;
      setSelectedMap(nextMap);
      setSelectedMapPack(pack.id);
      setSelectedLevel(lvlMeta.level);
    },
    [],
  );

  const lastGuestSeqRef = useRef<number>(0);
  const inputSenderRef = useRef(createGlassInputSender());

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
    inputSenderRef.current.reset();
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
      inputSenderRef.current.reset();
      clearEmoteTimers();

      matchIdRef.current = '';
      matchRosterRef.current = null;
      matchMembersRef.current = { p1: null, p2: null };
      lastSnapshotRef.current = null;
      finalResultRef.current = null;
      partnerLeftPermanentlyRef.current = false;
      lastGuestSeqRef.current = 0;
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
        mapPackId: selectedMapPackRef.current,
        level: selectedLevelRef.current,
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
      mapPackId?: string,
      level?: CoopLevelNumber,
    ) => {
      if (!finishedMatchId || finishedMatchId !== matchIdRef.current) return;
      clearCountdownTimer();
      clearDisconnectTimer();
      inputSenderRef.current.reset();

      const resolvedMapId = isCoopMapId(mapId) ? mapId : selectedMapRef.current;
      const resolvedPackId = getCoopMapPack(
        resolvedMapId,
        mapPackId ??
          (resolvedMapId === selectedMapRef.current
            ? selectedMapPackRef.current
            : undefined),
      ).id;
      const resolvedLevel = getCoopLevelMeta(
        resolvedMapId,
        resolvedPackId,
        isCoopLevelNumber(level)
          ? level
          : resolvedMapId === selectedMapRef.current &&
              resolvedPackId === selectedMapPackRef.current
            ? selectedLevelRef.current
            : 1,
      ).level;
      const result: GlassFinalResult = {
        matchId: finishedMatchId,
        mapId: resolvedMapId,
        mapPackId: resolvedPackId,
        level: resolvedLevel,
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
    [clearCountdownTimer, clearDisconnectTimer],
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
      inputSenderRef.current.reset();

      const nextMap: CoopMapId = isCoopMapId(evt.mapId)
        ? evt.mapId
        : DEFAULT_COOP_MAP_ID;
      const nextPack =
        typeof evt.mapPackId === 'string' && evt.mapPackId.trim().length > 0
          ? getCoopMapPack(nextMap, evt.mapPackId.trim()).id
          : getDefaultMapPackId(nextMap);
      const nextLevel: CoopLevelNumber = isCoopLevelNumber(evt.level)
        ? evt.level
        : 1;
      updateSelectedStage(nextMap, nextPack, nextLevel);

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
      lastGuestSeqRef.current = 0;

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
      startCountdownOrPlay,
      syncRoleStates,
      updateSelectedStage,
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
      const resolvedPackId =
        typeof evt.mapPackId === 'string' && evt.mapPackId.trim().length > 0
          ? getCoopMapPack(resolvedMapId, evt.mapPackId.trim()).id
          : getDefaultMapPackId(resolvedMapId);
      const resolvedLevel: CoopLevelNumber = isCoopLevelNumber(evt.level)
        ? evt.level
        : 1;
      updateSelectedStage(resolvedMapId, resolvedPackId, resolvedLevel);

      const roster: MatchRoster = {
        hostPeerId: evt.hostPeerId,
        guestPeerId: evt.guestPeerId,
      };

      const isSameMatch = matchIdRef.current === evt.matchId;
      matchIdRef.current = evt.matchId;
      matchRosterRef.current = roster;
      partnerLeftPermanentlyRef.current = false;

      if (!isSameMatch) {
        inputSenderRef.current.reset();
        lastGuestSeqRef.current = 0;
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
          mapPackId: resolvedPackId,
          level: resolvedLevel,
          elapsedSec: incomingSnapshot?.matchTime ?? 0,
          shatters: incomingSnapshot ? getSnapshotFailures(incomingSnapshot) : 0,
        };
        applyMatchFinished(
          evt.matchId,
          res.elapsedSec,
          res.shatters,
          res.mapId ?? resolvedMapId,
          res.mapPackId ?? resolvedPackId,
          res.level ?? resolvedLevel,
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
      updateSelectedStage,
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

    const defaultUnlocks = buildUnlockedByPackMap(undefined);
    hostUnlockedByPackRef.current = defaultUnlocks;
    setHostUnlockedByPack(defaultUnlocks);

    setRoomCode('');
    setMembers([]);
    setConnectionStatus('disconnected');
    setError(null);
    updateSelectedStage(
      DEFAULT_COOP_MAP_ID,
      getDefaultMapPackId(DEFAULT_COOP_MAP_ID),
      1,
    );
    resetMatchState('idle');
  }, [resetMatchState, teardownChannel, updateSelectedStage]);

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
      const defaultPackId = getDefaultMapPackId(DEFAULT_COOP_MAP_ID);
      updateSelectedStage(DEFAULT_COOP_MAP_ID, defaultPackId, 1);

      const sanitizedProfileUnlocks = sanitizeUnlockedByPack(
        profile.unlockedByPack,
      );
      if (sanitizedProfileUnlocks) {
        localUnlockedByPackRef.current = sanitizedProfileUnlocks;
      }
      const initialUnlocks = asHost
        ? localUnlockedByPackRef.current
        : buildUnlockedByPackMap(undefined);
      hostUnlockedByPackRef.current = initialUnlocks;
      setHostUnlockedByPack(initialUnlocks);

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
        isHost: asHost,
        ...(asHost
          ? {
              selectedMap: DEFAULT_COOP_MAP_ID,
              selectedMapPack: defaultPackId,
              selectedLevel: 1 as CoopLevelNumber,
              unlockedByPack: initialUnlocks,
            }
          : {}),
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
          const defaultUnlocks = buildUnlockedByPackMap(undefined);
          hostUnlockedByPackRef.current = defaultUnlocks;
          setHostUnlockedByPack(defaultUnlocks);
          updateSelectedStage(
            DEFAULT_COOP_MAP_ID,
            getDefaultMapPackId(DEFAULT_COOP_MAP_ID),
            1,
          );
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

            const hostMember = capped[0];
            if (!isHostRef.current && hostMember) {
              if (hostMember.unlockedByPack) {
                const nextUnlocks = hostMember.unlockedByPack;
                if (
                  serializeUnlockedByPack(nextUnlocks) !==
                  serializeUnlockedByPack(hostUnlockedByPackRef.current)
                ) {
                  hostUnlockedByPackRef.current = nextUnlocks;
                  setHostUnlockedByPack(nextUnlocks);
                }
              }
              if (
                phaseRef.current === 'lobby' &&
                (hostMember.selectedMap !== undefined ||
                  hostMember.selectedMapPack !== undefined ||
                  hostMember.selectedLevel !== undefined)
              ) {
                const targetAction = isCoopMapId(hostMember.selectedMap)
                  ? hostMember.selectedMap
                  : selectedMapRef.current;
                const pack = getCoopMapPack(
                  targetAction,
                  hostMember.selectedMapPack ??
                    (targetAction === selectedMapRef.current
                      ? selectedMapPackRef.current
                      : undefined),
                );
                const rawLevel = isCoopLevelNumber(hostMember.selectedLevel)
                  ? hostMember.selectedLevel
                  : targetAction === selectedMapRef.current &&
                      pack.id === selectedMapPackRef.current
                    ? selectedLevelRef.current
                    : 1;
                const lvlMeta = getCoopLevelMeta(targetAction, pack.id, rawLevel);
                if (
                  targetAction !== selectedMapRef.current ||
                  pack.id !== selectedMapPackRef.current ||
                  lvlMeta.level !== selectedLevelRef.current
                ) {
                  updateSelectedStage(targetAction, pack.id, lvlMeta.level);
                }
              }
            } else if (
              isHostRef.current &&
              myProfileRef.current &&
              !myProfileRef.current.unlockedByPack
            ) {
              const localUnlocks = localUnlockedByPackRef.current;
              if (
                serializeUnlockedByPack(localUnlocks) !==
                serializeUnlockedByPack(hostUnlockedByPackRef.current)
              ) {
                hostUnlockedByPackRef.current = localUnlocks;
                setHostUnlockedByPack(localUnlocks);
              }
              const promotedProfile: GlassRoomMember = {
                ...myProfileRef.current,
                selectedMap: selectedMapRef.current,
                selectedMapPack: selectedMapPackRef.current,
                selectedLevel: selectedLevelRef.current,
                unlockedByPack: localUnlocks,
              };
              myProfileRef.current = promotedProfile;
              void channel.track(promotedProfile);
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
            const nextPackId =
              typeof evt.mapPackId === 'string' && evt.mapPackId.trim().length > 0
                ? evt.mapPackId.trim()
                : getDefaultMapPackId(evt.mapId);
            const nextLevel: CoopLevelNumber = isCoopLevelNumber(evt.level)
              ? evt.level
              : 1;
            updateSelectedStage(evt.mapId, nextPackId, nextLevel);
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
                selectedMapPackRef.current,
                selectedLevelRef.current,
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
              evt.mapPackId,
              evt.level,
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
      updateSelectedStage,
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

      const nextUnlocks =
        patch.unlockedByPack !== undefined
          ? sanitizeUnlockedByPack(patch.unlockedByPack)
          : current.unlockedByPack;
      if (nextUnlocks) {
        localUnlockedByPackRef.current = nextUnlocks;
        if (isHostRef.current) {
          hostUnlockedByPackRef.current = nextUnlocks;
          setHostUnlockedByPack(nextUnlocks);
        }
      }

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
        ...(nextUnlocks ? { unlockedByPack: nextUnlocks } : {}),
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

  const syncHostUnlocks = useCallback(
    (unlockedByPack: Record<string, number>) => {
      const sanitized =
        sanitizeUnlockedByPack(unlockedByPack) ??
        buildUnlockedByPackMap(undefined);
      localUnlockedByPackRef.current = sanitized;

      if (!isHostRef.current) {
        return;
      }

      const nextSerialized = serializeUnlockedByPack(sanitized);
      const prevHostSerialized = serializeUnlockedByPack(
        hostUnlockedByPackRef.current,
      );
      if (nextSerialized !== prevHostSerialized) {
        hostUnlockedByPackRef.current = sanitized;
        setHostUnlockedByPack(sanitized);
      }

      const current = myProfileRef.current;
      const channel = channelRef.current;
      if (current) {
        const prevProfileSerialized = current.unlockedByPack
          ? serializeUnlockedByPack(current.unlockedByPack)
          : '';
        if (nextSerialized !== prevProfileSerialized) {
          const updated: GlassRoomMember = {
            ...current,
            unlockedByPack: sanitized,
          };
          myProfileRef.current = updated;
          if (channel) {
            void channel.track(updated);
          }
        }
      }
    },
    [],
  );

  const selectStage = useCallback(
    (actionId: CoopMapId, mapPackId: string, level: CoopLevelNumber) => {
      if (!isHostRef.current || !isCoopMapId(actionId)) return;
      if (phaseRef.current !== 'lobby' && phaseRef.current !== 'finished') {
        return;
      }

      const pack = getCoopMapPack(actionId, mapPackId);
      const resolvedLevel: CoopLevelNumber = isCoopLevelNumber(level)
        ? level
        : 1;
      const lvlMeta = getCoopLevelMeta(actionId, pack.id, resolvedLevel);
      if (
        lvlMeta.comingSoon ||
        !isCoopLevelUnlocked(
          undefined,
          actionId,
          pack.id,
          lvlMeta.level,
          hostUnlockedByPackRef.current,
        )
      ) {
        return;
      }

      updateSelectedStage(actionId, pack.id, lvlMeta.level);

      const current = myProfileRef.current;
      const channel = channelRef.current;
      if (current) {
        const updated: GlassRoomMember = {
          ...current,
          ready: false,
          selectedMap: actionId,
          selectedMapPack: pack.id,
          selectedLevel: lvlMeta.level,
        };
        myProfileRef.current = updated;
        if (channel) {
          void channel.track(updated);
        }
      }

      if (channel) {
        const payload: CoopSelectMapPayload = {
          hostPeerId: myPeerId,
          mapId: actionId,
          mapPackId: pack.id,
          level: lvlMeta.level,
        };
        void channel.send({
          type: 'broadcast',
          event: 'coop:select_map',
          payload,
        });
      }
    },
    [myPeerId, updateSelectedStage],
  );

  const selectMap = useCallback(
    (mapId: CoopMapId) => {
      if (!isCoopMapId(mapId)) return;
      selectStage(mapId, getDefaultMapPackId(mapId), 1);
    },
    [selectStage],
  );

  const launchMatch = useCallback(
    (
      eventName: 'glass:start' | 'glass:restart',
      requireReady: boolean,
      mapIdOverride?: CoopMapId,
      mapPackOverride?: string,
      levelOverride?: CoopLevelNumber,
    ) => {
      if (!isHostRef.current) return;
      const active = membersRef.current.slice(0, GLASS_MAX_PLAYERS);
      if (active.length < GLASS_MAX_PLAYERS) return;
      if (requireReady && !active.every((m) => m.ready)) return;

      const targetMap = mapIdOverride ?? selectedMapRef.current;
      const targetPack = getCoopMapPack(
        targetMap,
        mapPackOverride ??
          (mapIdOverride && mapIdOverride !== selectedMapRef.current
            ? undefined
            : selectedMapPackRef.current),
      ).id;
      const targetLevel = getCoopLevelMeta(
        targetMap,
        targetPack,
        levelOverride ??
          (mapIdOverride && mapIdOverride !== selectedMapRef.current
            ? 1
            : selectedLevelRef.current),
      ).level;

      const nextMatchId = `glass-${roomCodeRef.current}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const payload: GlassStartPayload = {
        matchId: nextMatchId,
        hostPeerId: active[0].peerId,
        guestPeerId: active[1].peerId,
        countdownMs: GLASS_COUNTDOWN_MS,
        startedAt: Date.now(),
        mapId: targetMap,
        mapPackId: targetPack,
        level: targetLevel,
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

    const next = getNextPlayableCoopStage(
      selectedMapRef.current,
      selectedMapPackRef.current,
      selectedLevelRef.current,
    );
    updateSelectedStage(next.actionId, next.mapPackId, next.level);

    const current = myProfileRef.current;
    const channel = channelRef.current;
    if (current) {
      const updated: GlassRoomMember = {
        ...current,
        selectedMap: next.actionId,
        selectedMapPack: next.mapPackId,
        selectedLevel: next.level,
      };
      myProfileRef.current = updated;
      if (channel) {
        void channel.track(updated);
      }
    }

    if (channel) {
      const selectPayload: CoopSelectMapPayload = {
        hostPeerId: myPeerId,
        mapId: next.actionId,
        mapPackId: next.mapPackId,
        level: next.level,
      };
      void channel.send({
        type: 'broadcast',
        event: 'coop:select_map',
        payload: selectPayload,
      });
    }

    launchMatch('glass:start', false, next.actionId, next.mapPackId, next.level);
  }, [launchMatch, myPeerId, updateSelectedStage]);

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

  const sendGuestInput = useCallback(
    (input: PlayerInput) => {
      const currentMatchId = matchIdRef.current;
      if (
        isHostRef.current ||
        phaseRef.current !== 'playing' ||
        !currentMatchId ||
        !channelRef.current
      ) {
        return;
      }

      inputSenderRef.current.send(
        currentMatchId,
        input,
        Date.now(),
        (seq, payloadInput, activeMatchId) => {
          const channel = channelRef.current;
          if (
            !channel ||
            phaseRef.current !== 'playing' ||
            isHostRef.current ||
            matchIdRef.current !== activeMatchId
          ) {
            return;
          }
          const payload: GlassInputPayload = {
            matchId: activeMatchId,
            peerId: myPeerId,
            seq,
            moveX: payloadInput.moveX,
            moveZ: payloadInput.moveZ,
            jump: payloadInput.jump,
            lift: payloadInput.lift,
          };
          void channel.send({
            type: 'broadcast',
            event: 'glass:input',
            payload,
          });
        },
      );
    },
    [myPeerId],
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
          selectedMapPackRef.current,
          selectedLevelRef.current,
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
      const currentPackId = selectedMapPackRef.current;
      const currentLevel = selectedLevelRef.current;
      applyMatchFinished(
        currentMatchId,
        elapsedSec,
        shatters,
        currentMapId,
        currentPackId,
        currentLevel,
      );

      if (isHostRef.current && channelRef.current) {
        const payload: GlassFinishPayload = {
          matchId: currentMatchId,
          mapId: currentMapId,
          mapPackId: currentPackId,
          level: currentLevel,
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
    selectedMapPack,
    selectedLevel,
    hostUnlockedByPack,
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
    selectStage,
    syncHostUnlocks,
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
