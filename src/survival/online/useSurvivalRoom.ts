import { useCallback, useEffect, useRef, useState } from 'react';
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
import { HostStarTransport } from '../../online/p2p/starTransport.ts';
import { isSurvivalMapId } from '../sim/maps.ts';
import type {
  GearId,
  SurvivalInput,
  SurvivalMapId,
  WeaponId,
} from '../sim/types.ts';
import {
  SURVIVAL_DISCONNECT_BOT_MS,
  SURVIVAL_INPUT_INTERVAL_MS,
  SURVIVAL_MAX_PLAYERS,
  SURVIVAL_SNAPSHOT_INTERVAL_MS,
  decodeSnapshotWire,
  encodeSnapshotWire,
  isSafeId,
  isSnapshotWirePayload,
  sanitizeAnimal,
  sanitizeDisplayName,
  sanitizeGear,
  sanitizeSurvivalInput,
  sanitizeWeapon,
  validateSurvivalInputPayload,
  validateSurvivalLobbySyncPayload,
  validateSurvivalSkillActionPayload,
  validateSurvivalSnapshotPayload,
  validateSurvivalStartPayload,
  type SnapshotPlayerMeta,
  type SurvivalConnectionStatus,
  type SurvivalContinueEndlessPayload,
  type SurvivalHeartbeatPayload,
  type SurvivalHostLeftPayload,
  type SurvivalInputPayload,
  type SurvivalLobbyRequestPayload,
  type SurvivalLobbySyncPayload,
  type SurvivalMatchInProgressPayload,
  type SurvivalReturnLobbyPayload,
  type SurvivalRoomMember,
  type SurvivalRoomPhase,
  type SurvivalSkillActionPayload,
  type SurvivalSnapshotPayload,
  type SurvivalStartPayload,
} from './protocol.ts';
import {
  BOT_ANIMALS,
  BOT_ANIMAL_NAMES,
  BOT_GEARS,
  BOT_WEAPONS,
  clampBotCount,
  extractHostRoomState,
  inputsEqual,
  normalizeLobbyHostFlags,
  parsePresenceMembers,
} from './roomHelpers.ts';

export { clampBotCount, normalizeLobbyHostFlags, parsePresenceMembers };

const SURVIVAL_PEER_STORAGE_KEY = 'paws_survival_peer_id_v1';
const DEFAULT_MAP_ID: SurvivalMapId = 'winter_cabin';
const GUEST_HEARTBEAT_INTERVAL_MS = 2000;
const GUEST_HOST_SYNC_TIMEOUT_MS = 2500;

export interface SurvivalProfileInput {
  name: string;
  animal: AnimalId;
  weaponId: WeaponId;
  gearId: GearId;
}

export interface SurvivalRoomController {
  isConfigured: boolean;
  connectionStatus: SurvivalConnectionStatus;
  phase: SurvivalRoomPhase;
  roomCode: string;
  matchId: string;
  seed: number;
  mapId: SurvivalMapId;
  botFillCount: number;
  myPeerId: string;
  isHost: boolean;
  hostPeerId: string;
  members: SurvivalRoomMember[];
  startConfig: SurvivalStartPayload | null;
  hostLeft: boolean;
  error: string | null;
  createRoom(profile: SurvivalProfileInput): Promise<void>;
  joinRoom(code: string, profile: SurvivalProfileInput): Promise<void>;
  leaveRoom(): void;
  updateMyLoadout(patch: Partial<SurvivalProfileInput>): void;
  selectMap(mapId: SurvivalMapId): void;
  setBotFillCount(count: number): void;
  toggleReady(): void;
  startMatch(): void;
  returnToLobby(): void;
  sendGuestInput(input: SurvivalInput): void;
  broadcastSnapshot(snapshot: SurvivalSnapshotPayload): void;
  sendSkillPick(offerIndex: number): void;
  sendReroll(): void;
  sendContinueEndless(): void;
  setSnapshotListener(
    fn: ((snapshot: SurvivalSnapshotPayload) => void) | null,
  ): void;
  setGuestInputListener(
    fn: ((payload: SurvivalInputPayload) => void) | null,
  ): void;
  setSkillActionListener(
    fn: ((payload: SurvivalSkillActionPayload) => void) | null,
  ): void;
  setContinueEndlessListener(fn: (() => void) | null): void;
  getDisconnectedGuestIds(nowMs?: number): string[];
}

function monotonicNowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function getOrCreatePeerId(): string {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const existing = window.sessionStorage.getItem(SURVIVAL_PEER_STORAGE_KEY);
      if (existing && existing.trim().length > 0) {
        return existing;
      }
      const generated = `surv-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SURVIVAL_PEER_STORAGE_KEY, generated);
      return generated;
    } catch {
      // Fallback below when sessionStorage is unavailable
    }
  }
  return `surv-${Math.random().toString(36).slice(2, 10)}`;
}

function generateSeed32(): number {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] || 1;
  }
  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
}

/**
 * Manages an ephemeral 1-4 player Survival Co-op room via Supabase Realtime
 * Presence and Broadcast. High-frequency input and snapshot packets flow strictly
 * through ref callbacks so they never cause React state churn.
 */
export function useSurvivalRoom(): SurvivalRoomController {
  const isConfigured = isSupabaseConfigured();
  const [myPeerId] = useState<string>(() => getOrCreatePeerId());

  const [connectionStatus, setConnectionStatus] =
    useState<SurvivalConnectionStatus>('idle');
  const [phase, setPhase] = useState<SurvivalRoomPhase>('idle');
  const [roomCode, setRoomCode] = useState<string>('');
  const [matchId, setMatchId] = useState<string>('');
  const [seed, setSeed] = useState<number>(0);
  const [mapId, setMapId] = useState<SurvivalMapId>(DEFAULT_MAP_ID);
  const [botFillCount, setBotFillCountState] = useState<number>(0);
  const [isHostState, setIsHostState] = useState<boolean>(false);
  const [hostPeerIdState, setHostPeerIdState] = useState<string>('');
  const [members, setMembers] = useState<SurvivalRoomMember[]>([]);
  const [startConfig, setStartConfig] = useState<SurvivalStartPayload | null>(
    null,
  );
  const [hostLeft, setHostLeft] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const transportRef = useRef<HostStarTransport | null>(null);
  const pendingTeardownRef = useRef<Promise<unknown> | null>(null);
  const connectAttemptIdRef = useRef<number>(0);
  const connectResolveRef = useRef<(() => void) | null>(null);
  const hostSyncTimerRef = useRef<number | null>(null);

  const myProfileRef = useRef<SurvivalRoomMember | null>(null);
  const asHostRef = useRef<boolean>(false);
  const isHostRef = useRef<boolean>(false);
  const hostPeerIdRef = useRef<string>('');
  const hadConfirmedHostRef = useRef<boolean>(false);
  const hasSubscribedRef = useRef<boolean>(false);
  const hostRoomStateRef = useRef<'lobby' | 'playing' | null>(null);
  const hostSeenInMatchRef = useRef<boolean>(false);
  const hostLeftRef = useRef<boolean>(false);

  const phaseRef = useRef<SurvivalRoomPhase>('idle');
  const roomCodeRef = useRef<string>('');
  const matchIdRef = useRef<string>('');
  const seedRef = useRef<number>(0);
  const mapIdRef = useRef<SurvivalMapId>(DEFAULT_MAP_ID);
  const botFillCountRef = useRef<number>(0);
  const membersRef = useRef<SurvivalRoomMember[]>([]);
  const startConfigRef = useRef<SurvivalStartPayload | null>(null);

  const activeGuestIdsRef = useRef<Set<string>>(new Set());
  const rosterByIdRef = useRef<Map<string, SnapshotPlayerMeta>>(new Map());
  const guestHeartbeatRef = useRef<Map<string, number>>(new Map());
  const lastGuestInputSeqRef = useRef<Map<string, number>>(new Map());
  const guestHeartbeatTimerRef = useRef<number | null>(null);

  const inputSeqRef = useRef<number>(0);
  const lastInputSentAtRef = useRef<number>(-Infinity);
  const lastSentInputRef = useRef<SurvivalInput | null>(null);
  const pendingInputRef = useRef<SurvivalInput | null>(null);
  const inputThrottleTimerRef = useRef<number | null>(null);

  const snapshotListenerRef = useRef<
    ((snapshot: SurvivalSnapshotPayload) => void) | null
  >(null);
  const guestInputListenerRef = useRef<
    ((payload: SurvivalInputPayload) => void) | null
  >(null);
  const skillActionListenerRef = useRef<
    ((payload: SurvivalSkillActionPayload) => void) | null
  >(null);
  const continueEndlessListenerRef = useRef<(() => void) | null>(null);

  const resolvePendingConnect = useCallback(() => {
    const resolve = connectResolveRef.current;
    connectResolveRef.current = null;
    resolve?.();
  }, []);

  const clearHostSyncTimer = useCallback(() => {
    if (hostSyncTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(hostSyncTimerRef.current);
      hostSyncTimerRef.current = null;
    }
  }, []);

  const clearInputThrottle = useCallback(() => {
    if (inputThrottleTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(inputThrottleTimerRef.current);
      inputThrottleTimerRef.current = null;
    }
    pendingInputRef.current = null;
  }, []);

  const clearHeartbeatTimer = useCallback(() => {
    if (guestHeartbeatTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearInterval(guestHeartbeatTimerRef.current);
      guestHeartbeatTimerRef.current = null;
    }
  }, []);

  const trackMemberPresence = useCallback(
    (channel: RealtimeChannel, member: SurvivalRoomMember) => {
      const payload = isHostRef.current
        ? {
            ...member,
            roomState: phaseRef.current === 'playing' ? 'playing' : 'lobby',
          }
        : member;
      return channel.track(payload);
    },
    [],
  );

  const teardownChannel = useCallback(() => {
    connectAttemptIdRef.current += 1;
    clearHostSyncTimer();
    resolvePendingConnect();
    clearInputThrottle();
    clearHeartbeatTimer();
    transportRef.current?.dispose();
    transportRef.current = null;
    const client = getSupabaseClient();
    const ch = channelRef.current;
    channelRef.current = null;
    if (ch && client) {
      const prevPending = pendingTeardownRef.current ?? Promise.resolve();
      const nextPending = prevPending
        .then(() => client.removeChannel(ch))
        .catch(() => undefined);
      const tracked = nextPending.finally(() => {
        if (pendingTeardownRef.current === tracked) {
          pendingTeardownRef.current = null;
        }
      });
      pendingTeardownRef.current = tracked;
    } else if (ch) {
      void ch.unsubscribe();
    }
  }, [
    clearHeartbeatTimer,
    clearHostSyncTimer,
    clearInputThrottle,
    resolvePendingConnect,
  ]);

  const broadcastLobbySync = useCallback(
    (
      nextMapId: SurvivalMapId,
      nextBotCount: number,
      nextMembers: SurvivalRoomMember[],
    ) => {
      const channel = channelRef.current;
      if (!channel || !isHostRef.current) return;
      const payload: SurvivalLobbySyncPayload = {
        mapId: nextMapId,
        botFillCount: nextBotCount,
        members: nextMembers,
        hostPeerId: myPeerId,
      };
      void channel.send({
        type: 'broadcast',
        event: 'survival_lobby_sync',
        payload,
      });
    },
    [myPeerId],
  );

  const markHostLeft = useCallback(
    (message: string) => {
      if (hostLeftRef.current) return;
      hostLeftRef.current = true;
      clearHeartbeatTimer();
      setHostLeft(true);
      setError(message);
    },
    [clearHeartbeatTimer],
  );

  const startGuestHeartbeatLoop = useCallback(() => {
    clearHeartbeatTimer();
    if (isHostRef.current || typeof window === 'undefined') return;

    guestHeartbeatTimerRef.current = window.setInterval(() => {
      const channel = channelRef.current;
      const currentMatchId = matchIdRef.current;
      if (
        !channel ||
        !currentMatchId ||
        phaseRef.current !== 'playing' ||
        isHostRef.current
      ) {
        clearHeartbeatTimer();
        return;
      }
      const payload: SurvivalHeartbeatPayload = {
        matchId: currentMatchId,
        peerId: myPeerId,
        sentAt: Date.now(),
      };
      transportRef.current?.sendToHost('survival_heartbeat', payload, {
        forceFallback: false,
      });
    }, GUEST_HEARTBEAT_INTERVAL_MS);
  }, [clearHeartbeatTimer, myPeerId]);

  const resetMatchState = useCallback(
    (nextPhase: SurvivalRoomPhase) => {
      clearInputThrottle();
      clearHeartbeatTimer();

      matchIdRef.current = '';
      seedRef.current = 0;
      startConfigRef.current = null;
      hostSeenInMatchRef.current = false;
      hostLeftRef.current = false;
      activeGuestIdsRef.current.clear();
      rosterByIdRef.current.clear();
      guestHeartbeatRef.current.clear();
      lastGuestInputSeqRef.current.clear();
      inputSeqRef.current = 0;
      lastInputSentAtRef.current = -Infinity;
      lastSentInputRef.current = null;
      hostRoomStateRef.current = nextPhase === 'lobby' ? 'lobby' : null;
      phaseRef.current = nextPhase;

      setMatchId('');
      setSeed(0);
      setStartConfig(null);
      setHostLeft(false);
      setPhase(nextPhase);

      if (nextPhase === 'lobby' && channelRef.current) {
        const parsed = parsePresenceMembers(
          channelRef.current.presenceState() as Record<string, unknown[]>,
        ).slice(0, SURVIVAL_MAX_PLAYERS);
        const { normalized } = normalizeLobbyHostFlags(
          parsed,
          asHostRef.current || hadConfirmedHostRef.current,
        );
        if (normalized.length > 0) {
          membersRef.current = normalized;
          setMembers(normalized);
        }

        if (myProfileRef.current) {
          const updated: SurvivalRoomMember =
            !myProfileRef.current.isHost && myProfileRef.current.ready
              ? { ...myProfileRef.current, ready: false }
              : myProfileRef.current;
          myProfileRef.current = updated;
          void trackMemberPresence(channelRef.current, updated);
        }
      }
    },
    [clearHeartbeatTimer, clearInputThrottle, trackMemberPresence],
  );

  const failConnection = useCallback(
    (nextStatus: SurvivalConnectionStatus, message: string) => {
      teardownChannel();
      myProfileRef.current = null;
      asHostRef.current = false;
      isHostRef.current = false;
      hostPeerIdRef.current = '';
      hadConfirmedHostRef.current = false;
      hasSubscribedRef.current = false;
      hostRoomStateRef.current = null;
      roomCodeRef.current = '';
      membersRef.current = [];
      mapIdRef.current = DEFAULT_MAP_ID;
      botFillCountRef.current = 0;

      setIsHostState(false);
      setHostPeerIdState('');
      setMembers([]);
      setRoomCode('');
      setMapId(DEFAULT_MAP_ID);
      setBotFillCountState(0);
      resetMatchState('idle');
      setConnectionStatus(nextStatus);
      setError(message);
    },
    [resetMatchState, teardownChannel],
  );

  const applyMatchStart = useCallback(
    (evt: SurvivalStartPayload) => {
      if (!evt || !evt.matchId || matchIdRef.current === evt.matchId) return;
      if (!isSurvivalMapId(evt.mapId)) return;

      clearHostSyncTimer();
      clearInputThrottle();
      clearHeartbeatTimer();

      const now = Date.now();
      const resolvedHostPeerId = evt.hostPeerId || hostPeerIdRef.current;
      const amHost = resolvedHostPeerId === myPeerId;

      isHostRef.current = amHost;
      hostPeerIdRef.current = resolvedHostPeerId;
      hadConfirmedHostRef.current = true;
      hostRoomStateRef.current = 'playing';
      hostSeenInMatchRef.current = membersRef.current.some(
        (m) => m.peerId === resolvedHostPeerId,
      );
      hostLeftRef.current = false;

      matchIdRef.current = evt.matchId;
      seedRef.current = evt.seed;
      mapIdRef.current = evt.mapId;
      startConfigRef.current = evt;
      phaseRef.current = 'playing';

      const nextGuestIds = new Set<string>();
      const nextRoster = new Map<string, SnapshotPlayerMeta>();
      for (let i = 0; i < evt.players.length; i += 1) {
        const p = evt.players[i];
        nextRoster.set(p.id, {
          id: p.id,
          name: p.name,
          animal: p.animal,
          weaponId: p.weaponId,
          gearId: p.gearId,
          isBot: p.isBot,
        });
        if (!p.isBot && p.id !== resolvedHostPeerId) {
          nextGuestIds.add(p.id);
        }
      }

      activeGuestIdsRef.current = nextGuestIds;
      rosterByIdRef.current = nextRoster;
      guestHeartbeatRef.current.clear();
      lastGuestInputSeqRef.current.clear();
      inputSeqRef.current = 0;
      lastInputSentAtRef.current = -Infinity;
      lastSentInputRef.current = null;

      if (amHost) {
        for (const guestId of nextGuestIds) {
          guestHeartbeatRef.current.set(guestId, now);
        }
        if (channelRef.current && myProfileRef.current) {
          void trackMemberPresence(channelRef.current, myProfileRef.current);
        }
      }

      setIsHostState(amHost);
      setHostPeerIdState(resolvedHostPeerId);
      setMatchId(evt.matchId);
      setSeed(evt.seed);
      setMapId(evt.mapId);
      setStartConfig(evt);
      setHostLeft(false);
      setError(null);
      setPhase('playing');

      if (!amHost) {
        startGuestHeartbeatLoop();
      }
    },
    [
      clearHeartbeatTimer,
      clearHostSyncTimer,
      clearInputThrottle,
      myPeerId,
      startGuestHeartbeatLoop,
      trackMemberPresence,
    ],
  );

  const leaveRoom = useCallback(() => {
    const channel = channelRef.current;
    if (isHostRef.current && phaseRef.current === 'playing' && channel) {
      const payload: SurvivalHostLeftPayload = {
        hostPeerId: myPeerId,
        matchId: matchIdRef.current || undefined,
      };
      void channel.send({
        type: 'broadcast',
        event: 'survival_host_left',
        payload,
      });
    }

    teardownChannel();
    myProfileRef.current = null;
    asHostRef.current = false;
    isHostRef.current = false;
    hostPeerIdRef.current = '';
    hadConfirmedHostRef.current = false;
    hasSubscribedRef.current = false;
    hostRoomStateRef.current = null;
    roomCodeRef.current = '';
    membersRef.current = [];
    mapIdRef.current = DEFAULT_MAP_ID;
    botFillCountRef.current = 0;

    setIsHostState(false);
    setHostPeerIdState('');
    setRoomCode('');
    setMembers([]);
    setMapId(DEFAULT_MAP_ID);
    setBotFillCountState(0);
    setConnectionStatus('idle');
    setError(null);
    resetMatchState('idle');
  }, [myPeerId, resetMatchState, teardownChannel]);

  const connectToRoom = useCallback(
    async (
      rawCode: string,
      profile: SurvivalProfileInput,
      asHost: boolean,
    ): Promise<void> => {
      const client = getSupabaseClient();
      if (!client) {
        setError(
          'Chưa cấu hình Supabase Realtime (.env.local). Vui lòng xem SUPABASE_SETUP.md.',
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
      const attemptId = connectAttemptIdRef.current;

      if (pendingTeardownRef.current) {
        await pendingTeardownRef.current;
      }
      if (connectAttemptIdRef.current !== attemptId) {
        return;
      }

      asHostRef.current = asHost;
      isHostRef.current = asHost;
      hostPeerIdRef.current = asHost ? myPeerId : '';
      hadConfirmedHostRef.current = asHost;
      hasSubscribedRef.current = false;
      hostRoomStateRef.current = null;
      roomCodeRef.current = code;
      membersRef.current = [];
      mapIdRef.current = DEFAULT_MAP_ID;
      botFillCountRef.current = 0;

      setIsHostState(asHost);
      setHostPeerIdState(asHost ? myPeerId : '');
      setMembers([]);
      setMapId(DEFAULT_MAP_ID);
      setBotFillCountState(0);
      resetMatchState('idle');
      setError(null);
      setRoomCode(code);
      setConnectionStatus('connecting');

      const initialMember: SurvivalRoomMember = {
        peerId: myPeerId,
        name: sanitizeDisplayName(profile.name),
        animal: sanitizeAnimal(profile.animal),
        weaponId: sanitizeWeapon(profile.weaponId),
        gearId: sanitizeGear(profile.gearId),
        isHost: asHost,
        ready: asHost,
        joinedAt: Date.now(),
      };
      myProfileRef.current = initialMember;

      const channel = client.channel(`survival-room-${code}`, {
        config: {
          broadcast: { self: false },
          presence: { key: myPeerId },
        },
      });
      channelRef.current = channel;

      const transport = new HostStarTransport({
        channel,
        myPeerId,
        fallbackBaseSnapshotIntervalMs: SURVIVAL_SNAPSHOT_INTERVAL_MS,
        fallbackBaseInputIntervalMs: SURVIVAL_INPUT_INTERVAL_MS,
      });
      transportRef.current = transport;

      transport.onMessage('survival_input', (payload) => {
        if (
          channelRef.current !== channel ||
          !isHostRef.current ||
          phaseRef.current !== 'playing'
        ) {
          return;
        }
        const evt = validateSurvivalInputPayload(
          payload,
          activeGuestIdsRef.current,
          matchIdRef.current,
        );
        if (!evt) return;

        const prevSeq = lastGuestInputSeqRef.current.get(evt.peerId);
        if (prevSeq !== undefined && evt.seq <= prevSeq) return;
        lastGuestInputSeqRef.current.set(evt.peerId, evt.seq);
        guestHeartbeatRef.current.set(evt.peerId, Date.now());
        guestInputListenerRef.current?.(evt);
      });

      transport.onMessage('survival_heartbeat', (payload) => {
        if (
          channelRef.current !== channel ||
          !isHostRef.current ||
          phaseRef.current !== 'playing'
        ) {
          return;
        }
        if (
          !payload ||
          typeof payload !== 'object' ||
          Array.isArray(payload)
        ) {
          return;
        }
        const evt = payload as Partial<SurvivalHeartbeatPayload>;
        if (
          typeof evt.matchId !== 'string' ||
          !matchIdRef.current ||
          evt.matchId !== matchIdRef.current ||
          !isSafeId(evt.peerId, 64) ||
          !activeGuestIdsRef.current.has(evt.peerId)
        ) {
          return;
        }
        guestHeartbeatRef.current.set(evt.peerId, Date.now());
      });

      transport.onMessage('survival_snapshot', (payload) => {
        if (
          channelRef.current !== channel ||
          isHostRef.current ||
          phaseRef.current !== 'playing'
        ) {
          return;
        }
        const activeMatchId = matchIdRef.current;
        if (!activeMatchId) return;
        const decoded = isSnapshotWirePayload(payload)
          ? decodeSnapshotWire(payload, rosterByIdRef.current, activeMatchId)
          : validateSurvivalSnapshotPayload(payload, activeMatchId);
        if (!decoded) return;
        snapshotListenerRef.current?.(decoded);
      });

      return new Promise<void>((resolve) => {
        connectResolveRef.current = resolve;

        const rejectAsRoomFull = () => {
          failConnection('idle', 'Phòng đã đủ 4 người chơi.');
        };

        const armHostSyncTimeout = () => {
          clearHostSyncTimer();
          if (typeof window === 'undefined' || asHostRef.current) return;
          hostSyncTimerRef.current = window.setTimeout(() => {
            hostSyncTimerRef.current = null;
            if (channelRef.current !== channel) return;
            if (phaseRef.current === 'playing' || isHostRef.current) return;

            if (hostRoomStateRef.current === 'playing') {
              failConnection(
                'error',
                'Phòng này đang trong trận đấu — không thể tham gia lúc này.',
              );
              return;
            }

            if (!hadConfirmedHostRef.current) {
              failConnection(
                'error',
                'Không tìm thấy phòng với mã này hoặc chủ phòng đã thoát.',
              );
            }
          }, GUEST_HOST_SYNC_TIMEOUT_MS);
        };

        channel
          .on('presence', { event: 'sync' }, () => {
            if (channelRef.current !== channel) return;
            const rawPresence = channel.presenceState() as Record<
              string,
              unknown[]
            >;
            const parsed = parsePresenceMembers(rawPresence);

            if (!asHostRef.current && !isHostRef.current && phaseRef.current !== 'playing') {
              const myIndex = parsed.findIndex((m) => m.peerId === myPeerId);
              if (
                (myIndex === -1 && parsed.length >= SURVIVAL_MAX_PLAYERS) ||
                myIndex >= SURVIVAL_MAX_PLAYERS
              ) {
                rejectAsRoomFull();
                return;
              }
            }

            const capped = parsed.slice(0, SURVIVAL_MAX_PLAYERS);

            if (phaseRef.current === 'playing') {
              const matchMembers = capped.filter((m) =>
                rosterByIdRef.current.has(m.peerId),
              );
              membersRef.current = matchMembers;
              setMembers(matchMembers);

              const activeHostId = hostPeerIdRef.current;
              if (activeHostId && !isHostRef.current) {
                const hostPresent = matchMembers.some(
                  (m) => m.peerId === activeHostId,
                );
                if (hostPresent) {
                  hostSeenInMatchRef.current = true;
                } else if (hostSeenInMatchRef.current) {
                  markHostLeft('Chủ phòng đã ngắt kết nối khỏi trận đấu.');
                }
              }
              return;
            }

            const explicitHost = capped.find((m) => m.isHost);
            if (explicitHost) {
              hadConfirmedHostRef.current = true;
              const advertisedState = extractHostRoomState(
                rawPresence,
                explicitHost.peerId,
              );
              if (advertisedState) {
                hostRoomStateRef.current = advertisedState;
              }
              if (advertisedState !== 'playing') {
                clearHostSyncTimer();
              }
            }

            const allowFallbackPromotion =
              asHostRef.current || hadConfirmedHostRef.current;
            const { normalized, hostPeerId } = normalizeLobbyHostFlags(
              capped,
              allowFallbackPromotion,
            );
            const prevMemberCount = membersRef.current.length;
            membersRef.current = normalized;
            setMembers(normalized);

            const resolvedHost =
              hostPeerId || (asHostRef.current ? myPeerId : '');
            const amHost = resolvedHost !== '' && resolvedHost === myPeerId;
            hostPeerIdRef.current = resolvedHost;
            isHostRef.current = amHost;
            setHostPeerIdState(resolvedHost);
            setIsHostState(amHost);

            if (
              amHost &&
              myProfileRef.current &&
              (!myProfileRef.current.isHost || !myProfileRef.current.ready)
            ) {
              const promoted: SurvivalRoomMember = {
                ...myProfileRef.current,
                isHost: true,
                ready: true,
              };
              myProfileRef.current = promoted;
              void trackMemberPresence(channel, promoted);
            }

            if (amHost) {
              const clampedBots = clampBotCount(
                botFillCountRef.current,
                normalized.length,
              );
              if (clampedBots !== botFillCountRef.current) {
                botFillCountRef.current = clampedBots;
                setBotFillCountState(clampedBots);
                broadcastLobbySync(mapIdRef.current, clampedBots, normalized);
              } else if (normalized.length !== prevMemberCount) {
                broadcastLobbySync(mapIdRef.current, clampedBots, normalized);
              }
            }
          })
          .on('presence', { event: 'leave' }, ({ key }) => {
            if (channelRef.current !== channel) return;
            if (phaseRef.current !== 'playing' || isHostRef.current) return;
            const activeHostId = hostPeerIdRef.current;
            if (!activeHostId || key !== activeHostId) return;

            const remaining = parsePresenceMembers(
              channel.presenceState() as Record<string, unknown[]>,
            );
            if (!remaining.some((m) => m.peerId === activeHostId)) {
              markHostLeft('Chủ phòng đã rời trận đấu.');
            }
          })
          .on('broadcast', { event: 'survival_lobby_request' }, ({ payload }) => {
            if (channelRef.current !== channel || !isHostRef.current) return;
            if (
              !payload ||
              typeof payload !== 'object' ||
              Array.isArray(payload)
            ) {
              return;
            }
            const req = payload as Partial<SurvivalLobbyRequestPayload>;
            if (
              !isSafeId(req.requesterPeerId, 64) ||
              req.requesterPeerId === myPeerId
            ) {
              return;
            }

            if (phaseRef.current === 'lobby') {
              const currentMembers =
                membersRef.current.length > 0
                  ? membersRef.current
                  : myProfileRef.current
                    ? [myProfileRef.current]
                    : [];
              broadcastLobbySync(
                mapIdRef.current,
                botFillCountRef.current,
                currentMembers,
              );
              return;
            }

            if (phaseRef.current === 'playing') {
              if (
                activeGuestIdsRef.current.has(req.requesterPeerId) &&
                startConfigRef.current
              ) {
                lastGuestInputSeqRef.current.delete(req.requesterPeerId);
                guestHeartbeatRef.current.set(req.requesterPeerId, Date.now());
                void channel.send({
                  type: 'broadcast',
                  event: 'survival_start',
                  payload: startConfigRef.current,
                });
              } else {
                const rejected: SurvivalMatchInProgressPayload = {
                  hostPeerId: myPeerId,
                  targetPeerId: req.requesterPeerId,
                };
                void channel.send({
                  type: 'broadcast',
                  event: 'survival_match_in_progress',
                  payload: rejected,
                });
              }
            }
          })
          .on('broadcast', { event: 'survival_lobby_sync' }, ({ payload }) => {
            if (channelRef.current !== channel || isHostRef.current) return;
            if (phaseRef.current !== 'lobby') return;
            const evt = validateSurvivalLobbySyncPayload(payload);
            if (!evt) return;

            if (hostPeerIdRef.current) {
              if (evt.hostPeerId !== hostPeerIdRef.current) return;
            } else if (evt.hostPeerId) {
              hostPeerIdRef.current = evt.hostPeerId;
              setHostPeerIdState(evt.hostPeerId);
            } else {
              return;
            }

            hadConfirmedHostRef.current = true;
            hostRoomStateRef.current = 'lobby';
            clearHostSyncTimer();

            mapIdRef.current = evt.mapId;
            setMapId(evt.mapId);

            const humanCount = Math.max(
              1,
              membersRef.current.length || evt.members.length || 1,
            );
            const clampedBots = clampBotCount(evt.botFillCount, humanCount);
            botFillCountRef.current = clampedBots;
            setBotFillCountState(clampedBots);
          })
          .on(
            'broadcast',
            { event: 'survival_match_in_progress' },
            ({ payload }) => {
              if (channelRef.current !== channel || isHostRef.current) return;
              if (phaseRef.current === 'playing') return;
              if (
                !payload ||
                typeof payload !== 'object' ||
                Array.isArray(payload)
              ) {
                return;
              }
              const evt = payload as Partial<SurvivalMatchInProgressPayload>;
              if (evt.targetPeerId && evt.targetPeerId !== myPeerId) return;
              if (
                !isSafeId(evt.hostPeerId, 64) ||
                (hostPeerIdRef.current && evt.hostPeerId !== hostPeerIdRef.current)
              ) {
                return;
              }
              failConnection(
                'error',
                'Phòng này đang trong trận đấu — không thể tham gia lúc này.',
              );
            },
          )
          .on('broadcast', { event: 'survival_start' }, ({ payload }) => {
            if (channelRef.current !== channel) return;
            if (isHostRef.current || phaseRef.current !== 'lobby') return;

            let expectedHost: string | null = hostPeerIdRef.current || null;
            if (!expectedHost) {
              const presentMembers = parsePresenceMembers(
                channel.presenceState() as Record<string, unknown[]>,
              );
              const presentHost = presentMembers.find((m) => m.isHost);
              if (presentHost) {
                expectedHost = presentHost.peerId;
              }
            }

            const evt = validateSurvivalStartPayload(payload, expectedHost);
            if (!evt || evt.hostPeerId === myPeerId) return;
            const hostInPlayers = evt.players.some(
              (p) => !p.isBot && p.id === evt.hostPeerId,
            );
            const selfInPlayers = evt.players.some(
              (p) => !p.isBot && p.id === myPeerId,
            );
            if (!hostInPlayers || !selfInPlayers) return;

            applyMatchStart(evt);
          })
          .on('broadcast', { event: 'survival_return_lobby' }, ({ payload }) => {
            if (channelRef.current !== channel || isHostRef.current) return;
            if (
              !payload ||
              typeof payload !== 'object' ||
              Array.isArray(payload)
            ) {
              return;
            }
            const evt = payload as Partial<SurvivalReturnLobbyPayload>;
            if (
              !isSafeId(evt.hostPeerId, 64) ||
              !hostPeerIdRef.current ||
              evt.hostPeerId !== hostPeerIdRef.current
            ) {
              return;
            }
            resetMatchState('lobby');
          })
          .on('broadcast', { event: 'survival_skill_action' }, ({ payload }) => {
            if (
              channelRef.current !== channel ||
              !isHostRef.current ||
              phaseRef.current !== 'playing'
            ) {
              return;
            }
            const evt = validateSurvivalSkillActionPayload(
              payload,
              activeGuestIdsRef.current,
              matchIdRef.current,
            );
            if (!evt) return;
            guestHeartbeatRef.current.set(evt.peerId, Date.now());
            skillActionListenerRef.current?.(evt);
          })
          .on(
            'broadcast',
            { event: 'survival_continue_endless' },
            ({ payload }) => {
              if (
                channelRef.current !== channel ||
                isHostRef.current ||
                phaseRef.current !== 'playing'
              ) {
                return;
              }
              if (
                !payload ||
                typeof payload !== 'object' ||
                Array.isArray(payload)
              ) {
                return;
              }
              const evt = payload as Partial<SurvivalContinueEndlessPayload>;
              if (
                typeof evt.matchId !== 'string' ||
                !matchIdRef.current ||
                evt.matchId !== matchIdRef.current ||
                !isSafeId(evt.hostPeerId, 64) ||
                !hostPeerIdRef.current ||
                evt.hostPeerId !== hostPeerIdRef.current
              ) {
                return;
              }
              continueEndlessListenerRef.current?.();
            },
          )
          .on('broadcast', { event: 'survival_host_left' }, ({ payload }) => {
            if (
              channelRef.current !== channel ||
              isHostRef.current ||
              phaseRef.current !== 'playing'
            ) {
              return;
            }
            if (
              !payload ||
              typeof payload !== 'object' ||
              Array.isArray(payload)
            ) {
              return;
            }
            const evt = payload as Partial<SurvivalHostLeftPayload>;
            if (
              !isSafeId(evt.hostPeerId, 64) ||
              !hostPeerIdRef.current ||
              evt.hostPeerId !== hostPeerIdRef.current
            ) {
              return;
            }
            if (evt.matchId && evt.matchId !== matchIdRef.current) {
              return;
            }
            markHostLeft('Chủ phòng đã rời trận đấu.');
          })
          .on('broadcast', { event: 'host_left' }, ({ payload }) => {
            if (
              channelRef.current !== channel ||
              isHostRef.current ||
              phaseRef.current !== 'playing'
            ) {
              return;
            }
            if (
              !payload ||
              typeof payload !== 'object' ||
              Array.isArray(payload)
            ) {
              return;
            }
            const evt = payload as Partial<SurvivalHostLeftPayload>;
            if (
              !isSafeId(evt.hostPeerId, 64) ||
              !hostPeerIdRef.current ||
              evt.hostPeerId !== hostPeerIdRef.current
            ) {
              return;
            }
            if (evt.matchId && evt.matchId !== matchIdRef.current) {
              return;
            }
            markHostLeft('Chủ phòng đã rời trận đấu.');
          });

        channel.subscribe(async (status) => {
          if (channelRef.current !== channel) {
            resolvePendingConnect();
            return;
          }
          if (status === 'SUBSCRIBED') {
            try {
              if (myProfileRef.current) {
                const trackStatus = await trackMemberPresence(
                  channel,
                  myProfileRef.current,
                );
                if (trackStatus === 'timed out') {
                  throw new Error('Presence track timed out');
                }
              }
              if (channelRef.current !== channel) {
                return;
              }
              hasSubscribedRef.current = true;
              if (phaseRef.current === 'idle') {
                phaseRef.current = 'lobby';
                setPhase('lobby');
              }
              setConnectionStatus('connected');
              setError(null);

              if (!asHost) {
                const req: SurvivalLobbyRequestPayload = {
                  requesterPeerId: myPeerId,
                };
                void channel.send({
                  type: 'broadcast',
                  event: 'survival_lobby_request',
                  payload: req,
                });
                if (
                  !hadConfirmedHostRef.current ||
                  hostRoomStateRef.current === 'playing'
                ) {
                  armHostSyncTimeout();
                }
              }
            } catch {
              if (channelRef.current === channel) {
                failConnection(
                  'error',
                  'Không thể đồng bộ trạng thái phòng trên Supabase Realtime.',
                );
              }
            } finally {
              resolvePendingConnect();
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (!hasSubscribedRef.current || phaseRef.current !== 'playing') {
              failConnection(
                'error',
                'Không thể kết nối tới Supabase Realtime. Vui lòng kiểm tra mạng hoặc cấu hình.',
              );
            } else {
              setConnectionStatus('error');
              setError(
                'Mất kết nối tới Supabase Realtime. Vui lòng kiểm tra mạng.',
              );
              resolvePendingConnect();
            }
          } else if (status === 'CLOSED') {
            if (!hasSubscribedRef.current) {
              failConnection('idle', 'Kết nối phòng đã đóng.');
            } else {
              setConnectionStatus('idle');
              resolvePendingConnect();
            }
          }
        });
      });
    },
    [
      applyMatchStart,
      broadcastLobbySync,
      clearHostSyncTimer,
      failConnection,
      markHostLeft,
      myPeerId,
      resetMatchState,
      resolvePendingConnect,
      teardownChannel,
      trackMemberPresence,
    ],
  );

  const createRoom = useCallback(
    async (profile: SurvivalProfileInput): Promise<void> => {
      const code = generateRoomCode(6);
      await connectToRoom(code, profile, true);
    },
    [connectToRoom],
  );

  const joinRoom = useCallback(
    async (code: string, profile: SurvivalProfileInput): Promise<void> => {
      await connectToRoom(code, profile, false);
    },
    [connectToRoom],
  );

  const updateMyLoadout = useCallback(
    (patch: Partial<SurvivalProfileInput>) => {
      const current = myProfileRef.current;
      const channel = channelRef.current;
      if (!current) return;

      const updated: SurvivalRoomMember = {
        ...current,
        name:
          patch.name !== undefined
            ? sanitizeDisplayName(patch.name, current.name)
            : current.name,
        animal:
          patch.animal !== undefined
            ? sanitizeAnimal(patch.animal)
            : current.animal,
        weaponId:
          patch.weaponId !== undefined
            ? sanitizeWeapon(patch.weaponId)
            : current.weaponId,
        gearId:
          patch.gearId !== undefined
            ? sanitizeGear(patch.gearId)
            : current.gearId,
      };
      myProfileRef.current = updated;

      if (membersRef.current.some((m) => m.peerId === myPeerId)) {
        const nextMembers = membersRef.current.map((m) =>
          m.peerId === myPeerId ? updated : m,
        );
        membersRef.current = nextMembers;
        setMembers(nextMembers);
      }

      if (channel) {
        void trackMemberPresence(channel, updated);
      }
    },
    [myPeerId, trackMemberPresence],
  );

  const toggleReady = useCallback(() => {
    if (isHostRef.current) return;
    const current = myProfileRef.current;
    const channel = channelRef.current;
    if (!current || phaseRef.current !== 'lobby') return;

    const updated: SurvivalRoomMember = {
      ...current,
      ready: !current.ready,
    };
    myProfileRef.current = updated;

    if (membersRef.current.some((m) => m.peerId === myPeerId)) {
      const nextMembers = membersRef.current.map((m) =>
        m.peerId === myPeerId ? updated : m,
      );
      membersRef.current = nextMembers;
      setMembers(nextMembers);
    }

    if (channel) {
      void trackMemberPresence(channel, updated);
    }
  }, [myPeerId, trackMemberPresence]);

  const selectMap = useCallback(
    (nextMapId: SurvivalMapId) => {
      if (!isHostRef.current || !isSurvivalMapId(nextMapId)) return;
      if (phaseRef.current !== 'lobby') return;

      mapIdRef.current = nextMapId;
      setMapId(nextMapId);
      broadcastLobbySync(
        nextMapId,
        botFillCountRef.current,
        membersRef.current,
      );
    },
    [broadcastLobbySync],
  );

  const setBotFillCount = useCallback(
    (count: number) => {
      if (!isHostRef.current || phaseRef.current !== 'lobby') return;

      const clamped = clampBotCount(count, membersRef.current.length);
      botFillCountRef.current = clamped;
      setBotFillCountState(clamped);
      broadcastLobbySync(mapIdRef.current, clamped, membersRef.current);
    },
    [broadcastLobbySync],
  );

  const startMatch = useCallback(() => {
    if (!isHostRef.current || phaseRef.current === 'idle') return;

    const rawHumans = (
      membersRef.current.length > 0
        ? membersRef.current
        : myProfileRef.current
          ? [myProfileRef.current]
          : []
    ).slice(0, SURVIVAL_MAX_PLAYERS);

    const activeHumans = [...rawHumans].sort((a, b) => {
      const aHost = a.peerId === hostPeerIdRef.current || a.isHost;
      const bHost = b.peerId === hostPeerIdRef.current || b.isHost;
      if (aHost !== bHost) return aHost ? -1 : 1;
      return 0;
    });

    if (activeHumans.length < 1) return;

    const players: SurvivalStartPayload['players'] = activeHumans.map((m) => ({
      id: m.peerId,
      name: m.name,
      animal: m.animal,
      weaponId: m.weaponId,
      gearId: m.gearId,
      isBot: false,
    }));

    const botCount = clampBotCount(botFillCountRef.current, players.length);
    const usedAnimals = new Set<AnimalId>(players.map((p) => p.animal));

    for (let i = 0; i < botCount; i += 1) {
      const unusedAnimal = BOT_ANIMALS.find((a) => !usedAnimals.has(a));
      const animal = unusedAnimal ?? BOT_ANIMALS[i % BOT_ANIMALS.length];
      usedAnimals.add(animal);

      players.push({
        id: `bot_${i + 1}`,
        name: BOT_ANIMAL_NAMES[animal],
        animal,
        weaponId: BOT_WEAPONS[i % BOT_WEAPONS.length],
        gearId: BOT_GEARS[i % BOT_GEARS.length],
        isBot: true,
      });
    }

    const nextSeed = generateSeed32();
    const nextMatchId = `surv-${roomCodeRef.current}-${nextSeed.toString(36)}-${Date.now().toString(36)}`;
    const payload: SurvivalStartPayload = {
      matchId: nextMatchId,
      hostPeerId: myPeerId,
      mapId: mapIdRef.current,
      seed: nextSeed,
      players,
    };

    applyMatchStart(payload);

    const channel = channelRef.current;
    if (channel) {
      void channel.send({
        type: 'broadcast',
        event: 'survival_start',
        payload,
      });
    }
  }, [applyMatchStart, myPeerId]);

  const returnToLobby = useCallback(() => {
    if (!isHostRef.current) return;
    resetMatchState('lobby');
    const channel = channelRef.current;
    if (channel) {
      const payload: SurvivalReturnLobbyPayload = { hostPeerId: myPeerId };
      void channel.send({
        type: 'broadcast',
        event: 'survival_return_lobby',
        payload,
      });
    }
  }, [myPeerId, resetMatchState]);

  const flushGuestInput = useCallback(
    (input: SurvivalInput, nowMs: number) => {
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

      const sanitized = sanitizeSurvivalInput(input);
      if (!sanitized) return;

      inputSeqRef.current += 1;
      const payload: SurvivalInputPayload = {
        matchId: currentMatchId,
        peerId: myPeerId,
        input: sanitized,
        seq: inputSeqRef.current,
        sentAt: Math.round(nowMs),
      };

      lastInputSentAtRef.current = nowMs;
      lastSentInputRef.current = sanitized;

      transportRef.current?.sendToHost('survival_input', payload);
    },
    [myPeerId],
  );

  const sendGuestInput = useCallback(
    (input: SurvivalInput) => {
      if (
        isHostRef.current ||
        phaseRef.current !== 'playing' ||
        !matchIdRef.current ||
        !channelRef.current
      ) {
        return;
      }

      const now = monotonicNowMs();
      const elapsed = now - lastInputSentAtRef.current;
      const latchedDash = Boolean(
        pendingInputRef.current?.dashPressed || input.dashPressed,
      );
      const mergedInput: SurvivalInput =
        latchedDash === input.dashPressed
          ? input
          : { ...input, dashPressed: latchedDash };
      const changed =
        !lastSentInputRef.current ||
        !inputsEqual(mergedInput, lastSentInputRef.current);

      if (
        mergedInput.dashPressed ||
        (elapsed >= SURVIVAL_INPUT_INTERVAL_MS &&
          (changed || elapsed >= SURVIVAL_INPUT_INTERVAL_MS * 2))
      ) {
        clearInputThrottle();
        flushGuestInput(mergedInput, now);
        return;
      }

      pendingInputRef.current = {
        ...mergedInput,
        dashPressed: latchedDash,
      };

      const targetInterval = changed
        ? SURVIVAL_INPUT_INTERVAL_MS
        : SURVIVAL_INPUT_INTERVAL_MS * 2;
      const waitMs = Math.max(1, targetInterval - elapsed);

      if (changed && inputThrottleTimerRef.current !== null) {
        window.clearTimeout(inputThrottleTimerRef.current);
        inputThrottleTimerRef.current = null;
      }

      if (inputThrottleTimerRef.current === null && typeof window !== 'undefined') {
        inputThrottleTimerRef.current = window.setTimeout(() => {
          inputThrottleTimerRef.current = null;
          const pending = pendingInputRef.current;
          pendingInputRef.current = null;
          if (!pending) return;
          flushGuestInput(pending, monotonicNowMs());
        }, waitMs);
      }
    },
    [clearInputThrottle, flushGuestInput],
  );

  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    const resolvedHostPeerId =
      hostPeerIdState || members.find((m) => m.isHost)?.peerId || '';
    if (!resolvedHostPeerId) return;
    transportRef.current?.syncPeers({
      isHost: isHostState,
      hostPeerId: resolvedHostPeerId,
      peerIds: members.map((m) => m.peerId),
    });
  }, [connectionStatus, hostPeerIdState, isHostState, members]);

  const broadcastSnapshot = useCallback((snapshot: SurvivalSnapshotPayload) => {
    if (!isHostRef.current || phaseRef.current !== 'playing') return;
    if (!matchIdRef.current || snapshot.matchId !== matchIdRef.current) return;
    const transport = transportRef.current;
    if (!transport) return;
    const wire = encodeSnapshotWire(snapshot);
    transport.sendFromHost('survival_snapshot', wire, {
      forceFallback: snapshot.phase !== 'playing',
    });
  }, []);

  const sendSkillPick = useCallback(
    (offerIndex: number) => {
      const currentMatchId = matchIdRef.current;
      if (!currentMatchId || phaseRef.current !== 'playing') return;

      const payload: SurvivalSkillActionPayload = {
        matchId: currentMatchId,
        peerId: myPeerId,
        action: 'pick',
        offerIndex,
      };

      if (isHostRef.current) {
        skillActionListenerRef.current?.(payload);
        return;
      }

      const channel = channelRef.current;
      if (channel) {
        void channel.send({
          type: 'broadcast',
          event: 'survival_skill_action',
          payload,
        });
      }
    },
    [myPeerId],
  );

  const sendReroll = useCallback(() => {
    const currentMatchId = matchIdRef.current;
    if (!currentMatchId || phaseRef.current !== 'playing') return;

    const payload: SurvivalSkillActionPayload = {
      matchId: currentMatchId,
      peerId: myPeerId,
      action: 'reroll',
    };

    if (isHostRef.current) {
      skillActionListenerRef.current?.(payload);
      return;
    }

    const channel = channelRef.current;
    if (channel) {
      void channel.send({
        type: 'broadcast',
        event: 'survival_skill_action',
        payload,
      });
    }
  }, [myPeerId]);

  const sendContinueEndless = useCallback(() => {
    if (!isHostRef.current || phaseRef.current !== 'playing') return;
    const currentMatchId = matchIdRef.current;
    if (!currentMatchId) return;

    const channel = channelRef.current;
    if (channel) {
      const payload: SurvivalContinueEndlessPayload = {
        matchId: currentMatchId,
        hostPeerId: myPeerId,
      };
      void channel.send({
        type: 'broadcast',
        event: 'survival_continue_endless',
        payload,
      });
    }
  }, [myPeerId]);

  const setSnapshotListener = useCallback(
    (fn: ((snapshot: SurvivalSnapshotPayload) => void) | null) => {
      snapshotListenerRef.current = fn;
    },
    [],
  );

  const setGuestInputListener = useCallback(
    (fn: ((payload: SurvivalInputPayload) => void) | null) => {
      guestInputListenerRef.current = fn;
    },
    [],
  );

  const setSkillActionListener = useCallback(
    (fn: ((payload: SurvivalSkillActionPayload) => void) | null) => {
      skillActionListenerRef.current = fn;
    },
    [],
  );

  const setContinueEndlessListener = useCallback((fn: (() => void) | null) => {
    continueEndlessListenerRef.current = fn;
  }, []);

  const getDisconnectedGuestIds = useCallback(
    (nowMs: number = Date.now()): string[] => {
      if (!isHostRef.current || phaseRef.current !== 'playing') return [];
      const disconnected: string[] = [];
      for (const [peerId, lastSeenMs] of guestHeartbeatRef.current.entries()) {
        if (
          activeGuestIdsRef.current.has(peerId) &&
          nowMs - lastSeenMs > SURVIVAL_DISCONNECT_BOT_MS
        ) {
          disconnected.push(peerId);
        }
      }
      return disconnected;
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
    roomCode,
    matchId,
    seed,
    mapId,
    botFillCount,
    myPeerId,
    isHost: isHostState,
    hostPeerId: hostPeerIdState,
    members,
    startConfig,
    hostLeft,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    updateMyLoadout,
    selectMap,
    setBotFillCount,
    toggleReady,
    startMatch,
    returnToLobby,
    sendGuestInput,
    broadcastSnapshot,
    sendSkillPick,
    sendReroll,
    sendContinueEndless,
    setSnapshotListener,
    setGuestInputListener,
    setSkillActionListener,
    setContinueEndlessListener,
    getDisconnectedGuestIds,
  };
}
