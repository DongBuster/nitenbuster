import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AnimalId } from '../../engine/types';
import {
  generateRoomCode,
  normalizeRoomCode,
} from '../../online/sanitize';
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '../../online/supabaseClient';
import {
  normalizeAccessories,
  type AccessorySelection,
} from '../../scene3d/accessoryCatalog';
import { matchReducer } from '../sim/matchStore';
import type { FighterInput, MatchState } from '../sim/types';
import {
  BRAWL_INPUT_STALE_MS,
  BRAWL_MAX_ROOM_PLAYERS,
  buildBrawlRoundKey,
  type BrawlInputPayload,
  type BrawlMatchSyncPayload,
  type BrawlRoomConfigPayload,
  type BrawlRoomMember,
  type BrawlRoomPhase,
  type BrawlRoomSettings,
  type BrawlSnapshotPayload,
} from './protocol';
import { createBrawlInputSender } from './inputSync';
import {
  buildOnlineBrawlRoster,
  canStartBrawlRoom,
  DEFAULT_BRAWL_ROOM_SETTINGS,
  electBrawlHost,
  sortRoomMembers,
} from './roomRoster';
import { BrawlSnapshotInterpolator } from './snapshotInterpolation';

export type BrawlConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

const BRAWL_PEER_STORAGE_KEY = 'paws_brawl_online_peer_id_v1';

const NEUTRAL_INPUT: FighterInput = {
  moveX: 0,
  moveZ: 0,
  sprint: false,
  jump: false,
  punch: false,
  headbutt: false,
  grabHeld: false,
  roll: false,
  emote: null,
};

function getOrCreatePeerId(): string {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const existing = window.sessionStorage.getItem(BRAWL_PEER_STORAGE_KEY);
      if (existing && existing.trim().length > 0) return existing;
      const generated = `brawl-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(BRAWL_PEER_STORAGE_KEY, generated);
      return generated;
    } catch {
      // Fallback below
    }
  }
  return `brawl-${Math.random().toString(36).slice(2, 10)}`;
}

function parsePresenceMembers(
  presenceState: Record<string, unknown[]>,
): BrawlRoomMember[] {
  const byPeer = new Map<string, BrawlRoomMember>();
  for (const entries of Object.values(presenceState)) {
    if (!Array.isArray(entries)) continue;
    for (const raw of entries) {
      if (!raw || typeof raw !== 'object') continue;
      const m = raw as Partial<BrawlRoomMember>;
      if (typeof m.peerId !== 'string' || typeof m.name !== 'string') continue;
      const candidate: BrawlRoomMember = {
        peerId: m.peerId,
        name: m.name,
        animal: (m.animal ?? 'dog') as AnimalId,
        accessory: normalizeAccessories(m.accessory as AccessorySelection),
        ready: Boolean(m.ready),
        joinedAt: typeof m.joinedAt === 'number' ? m.joinedAt : Date.now(),
        ...(typeof m.isHost === 'boolean' ? { isHost: m.isHost } : {}),
      };
      const existing = byPeer.get(m.peerId);
      if (!existing || candidate.joinedAt <= existing.joinedAt) {
        byPeer.set(m.peerId, candidate);
      }
    }
  }
  return sortRoomMembers(Array.from(byPeer.values()));
}

export function useBrawlRoom() {
  const myPeerId = useMemo(() => getOrCreatePeerId(), []);
  const configured = isSupabaseConfigured();

  const [status, setStatus] = useState<BrawlConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [phase, setPhase] = useState<BrawlRoomPhase>('idle');
  const [members, setMembers] = useState<BrawlRoomMember[]>([]);
  const [settings, setSettings] = useState<BrawlRoomSettings>(
    DEFAULT_BRAWL_ROOM_SETTINGS,
  );
  const [match, setMatch] = useState<MatchState | null>(null);
  const [matchNonce, setMatchNonce] = useState<number>(0);
  const [lockedHostPeerId, setLockedHostPeerId] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const myProfileRef = useRef<BrawlRoomMember | null>(null);
  const roomCodeRef = useRef<string>(roomCode);
  roomCodeRef.current = roomCode;
  const settingsRef = useRef<BrawlRoomSettings>(settings);
  settingsRef.current = settings;
  const phaseRef = useRef<BrawlRoomPhase>(phase);
  phaseRef.current = phase;
  const matchRef = useRef<MatchState | null>(match);
  matchRef.current = match;
  const matchNonceRef = useRef<number>(matchNonce);
  matchNonceRef.current = matchNonce;
  const membersRef = useRef<BrawlRoomMember[]>(members);
  membersRef.current = members;
  const isHostRef = useRef<boolean>(false);

  const interpolatorRef = useRef<BrawlSnapshotInterpolator>(
    new BrawlSnapshotInterpolator(),
  );
  const remoteInputsRef = useRef<
    Record<string, { input: FighterInput; seq: number; receivedAtMs: number }>
  >({});
  const inputSenderRef = useRef(createBrawlInputSender());

  const hostPeerId = useMemo(
    () =>
      phase === 'playing' && lockedHostPeerId
        ? lockedHostPeerId
        : electBrawlHost(members),
    [lockedHostPeerId, members, phase],
  );
  const isHost = hostPeerId !== null && hostPeerId === myPeerId;
  isHostRef.current = isHost;

  const canStart = useMemo(
    () => isHost && canStartBrawlRoom(members, settings),
    [isHost, members, settings],
  );

  const broadcast = useCallback((event: string, payload: unknown) => {
    const ch = channelRef.current;
    if (!ch) return;
    void ch.send({
      type: 'broadcast',
      event,
      payload,
    });
  }, []);

  const cleanupChannel = useCallback(() => {
    const ch = channelRef.current;
    channelRef.current = null;
    if (ch) {
      const supabase = getSupabaseClient();
      if (supabase) {
        void supabase.removeChannel(ch);
      } else {
        void ch.unsubscribe();
      }
    }
    remoteInputsRef.current = {};
    interpolatorRef.current.reset();
    inputSenderRef.current.reset();
  }, []);

  useEffect(() => {
    return () => {
      cleanupChannel();
    };
  }, [cleanupChannel]);

  const connectToRoom = useCallback(
    (
      rawCode: string,
      playerName: string,
      animal: AnimalId,
      accessory: AccessorySelection,
      asHost = false,
    ) => {
      if (!configured) {
        setErrorMessage(
          'Chưa cấu hình Supabase Realtime (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).',
        );
        setStatus('error');
        return;
      }

      const cleanCode = normalizeRoomCode(rawCode);
      if (cleanCode.length < 4) {
        setErrorMessage('Mã phòng cần ít nhất 4 ký tự.');
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        setErrorMessage('Không thể khởi tạo kết nối Supabase Realtime.');
        setStatus('error');
        return;
      }

      cleanupChannel();
      roomCodeRef.current = cleanCode;
      phaseRef.current = 'lobby';
      matchRef.current = null;
      matchNonceRef.current = 0;
      setLockedHostPeerId(null);
      setErrorMessage(null);
      setStatus('connecting');
      setRoomCode(cleanCode);
      setPhase('lobby');
      setMatch(null);
      setMatchNonce(0);

      const profile: BrawlRoomMember = {
        peerId: myPeerId,
        name: playerName.trim() || 'Người chơi',
        animal,
        accessory: normalizeAccessories(accessory),
        ready: false,
        joinedAt: Date.now(),
        isHost: asHost,
      };
      myProfileRef.current = profile;

      const channel = supabase.channel(`brawl-arena-room:${cleanCode}`, {
        config: {
          broadcast: { self: false },
          presence: { key: myPeerId },
        },
      });
      channelRef.current = channel;

      channel.on('presence', { event: 'sync' }, () => {
        const parsed = parsePresenceMembers(channel.presenceState());
        setMembers(parsed);
      });

      channel.on('broadcast', { event: 'brawl_config' }, ({ payload }) => {
        if (isHostRef.current) return;
        const data = payload as BrawlRoomConfigPayload;
        if (data?.settings) {
          setSettings(data.settings);
        }
      });

      channel.on('broadcast', { event: 'brawl_match_state' }, ({ payload }) => {
        if (isHostRef.current) return;
        const data = payload as BrawlMatchSyncPayload;
        if (!data) return;
        const prevMatch = matchRef.current;
        if (
          data.matchNonce !== matchNonceRef.current ||
          data.match?.round !== prevMatch?.round ||
          data.phase !== phaseRef.current
        ) {
          interpolatorRef.current.reset();
          inputSenderRef.current.reset();
        }
        matchNonceRef.current = data.matchNonce;
        phaseRef.current = data.phase;
        matchRef.current = data.match;
        if (data.phase === 'playing' && data.hostPeerId) {
          setLockedHostPeerId(data.hostPeerId);
        } else if (data.phase === 'lobby') {
          setLockedHostPeerId(null);
        }
        setMatchNonce(data.matchNonce);
        setPhase(data.phase);
        setMatch(data.match);
      });

      channel.on('broadcast', { event: 'brawl_snapshot' }, ({ payload }) => {
        if (isHostRef.current) return;
        const snap = payload as BrawlSnapshotPayload;
        if (!snap || typeof snap.tick !== 'number') return;
        const currentMatch = matchRef.current;
        const expectedRoundKey = currentMatch
          ? buildBrawlRoundKey(
              roomCodeRef.current,
              matchNonceRef.current,
              currentMatch.round,
            )
          : '';
        if (
          phaseRef.current !== 'playing' ||
          !expectedRoundKey ||
          snap.roundKey !== expectedRoundKey
        ) {
          return;
        }
        interpolatorRef.current.push(snap, performance.now());
      });

      channel.on('broadcast', { event: 'brawl_input' }, ({ payload }) => {
        if (!isHostRef.current) return;
        const evt = payload as BrawlInputPayload;
        if (!evt || evt.peerId === myPeerId) return;
        const prev = remoteInputsRef.current[evt.peerId];
        if (prev && evt.seq <= prev.seq) return;
        remoteInputsRef.current[evt.peerId] = {
          input: evt.input,
          seq: evt.seq,
          receivedAtMs: performance.now(),
        };
      });

      channel.on('broadcast', { event: 'brawl_sync_request' }, () => {
        if (!isHostRef.current) return;
        broadcast('brawl_config', {
          settings: settingsRef.current,
        } satisfies BrawlRoomConfigPayload);
        if (phaseRef.current === 'playing' && matchRef.current) {
          broadcast('brawl_match_state', {
            matchNonce: matchNonceRef.current,
            hostPeerId: myPeerId,
            phase: phaseRef.current,
            match: matchRef.current,
          } satisfies BrawlMatchSyncPayload);
        }
      });

      channel.subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          const currentMembers = parsePresenceMembers(channel.presenceState());
          if (
            currentMembers.length >= BRAWL_MAX_ROOM_PLAYERS &&
            !currentMembers.some((m) => m.peerId === myPeerId)
          ) {
            setErrorMessage('Phòng đã đủ tối đa 8 người chơi.');
            setStatus('error');
            setPhase('idle');
            cleanupChannel();
            return;
          }
          setStatus('connected');
          void channel.track(profile).then(() => {
            broadcast('brawl_sync_request', { peerId: myPeerId });
          });
        } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
          setStatus('error');
          setErrorMessage('Mất kết nối tới phòng đấu. Vui lòng thử lại.');
        }
      });
    },
    [broadcast, cleanupChannel, configured, myPeerId],
  );

  const createRoom = useCallback(
    (playerName: string, animal: AnimalId, accessory: AccessorySelection) => {
      const code = generateRoomCode();
      connectToRoom(code, playerName, animal, accessory, true);
    },
    [connectToRoom],
  );

  const joinRoom = useCallback(
    (
      code: string,
      playerName: string,
      animal: AnimalId,
      accessory: AccessorySelection,
    ) => {
      connectToRoom(code, playerName, animal, accessory, false);
    },
    [connectToRoom],
  );

  const leaveRoom = useCallback(() => {
    cleanupChannel();
    myProfileRef.current = null;
    roomCodeRef.current = '';
    setLockedHostPeerId(null);
    setStatus('disconnected');
    setErrorMessage(null);
    setRoomCode('');
    setPhase('idle');
    setMembers([]);
    setMatch(null);
    setMatchNonce(0);
  }, [cleanupChannel]);

  const updateProfile = useCallback(
    (animal: AnimalId, accessory: AccessorySelection) => {
      const prev = myProfileRef.current;
      if (!prev || !channelRef.current) return;
      const next: BrawlRoomMember = {
        ...prev,
        animal,
        accessory: normalizeAccessories(accessory),
      };
      myProfileRef.current = next;
      void channelRef.current.track(next);
    },
    [],
  );

  const toggleReady = useCallback(() => {
    const prev = myProfileRef.current;
    if (!prev || !channelRef.current) return;
    const next: BrawlRoomMember = {
      ...prev,
      ready: !prev.ready,
    };
    myProfileRef.current = next;
    void channelRef.current.track(next);
  }, []);

  const updateSettings = useCallback(
    (partial: Partial<BrawlRoomSettings>) => {
      if (!isHostRef.current) return;
      setSettings((prev) => {
        const next: BrawlRoomSettings = {
          ...prev,
          ...partial,
          targetPlayers: Math.min(
            BRAWL_MAX_ROOM_PLAYERS,
            Math.max(2, partial.targetPlayers ?? prev.targetPlayers),
          ),
        };
        broadcast('brawl_config', {
          settings: next,
        } satisfies BrawlRoomConfigPayload);
        return next;
      });
    },
    [broadcast],
  );

  const applyHostMatchState = useCallback(
    (nextMatch: MatchState, nextNonce?: number) => {
      if (!isHostRef.current) return;
      const resolvedNonce = nextNonce ?? matchNonceRef.current;
      if (nextNonce !== undefined) {
        matchNonceRef.current = nextNonce;
        setMatchNonce(nextNonce);
      }
      matchRef.current = nextMatch;
      phaseRef.current = 'playing';
      setLockedHostPeerId(myPeerId);
      setMatch(nextMatch);
      setPhase('playing');
      broadcast('brawl_match_state', {
        matchNonce: resolvedNonce,
        hostPeerId: myPeerId,
        phase: 'playing',
        match: nextMatch,
      } satisfies BrawlMatchSyncPayload);
    },
    [broadcast, myPeerId],
  );

  const startOnlineMatch = useCallback(() => {
    if (!isHostRef.current) return;
    if (!canStartBrawlRoom(membersRef.current, settingsRef.current)) return;

    const fighters = buildOnlineBrawlRoster(
      membersRef.current,
      settingsRef.current,
    );
    remoteInputsRef.current = {};
    interpolatorRef.current.reset();

    const baseState: MatchState = {
      phase: 'setup',
      round: 1,
      totalRounds: 3,
      countdownSec: 3,
      fighters: [],
      aliveIds: [],
      eliminationGroups: [],
      scores: {},
      lastRoundRankings: [],
      difficulty: settingsRef.current.difficulty,
      botCount: 0,
    };
    const started = matchReducer(baseState, {
      type: 'START_ONLINE_MATCH',
      fighters,
      difficulty: settingsRef.current.difficulty,
    });
    const nextNonce = matchNonceRef.current + 1;
    applyHostMatchState(started, nextNonce);
  }, [applyHostMatchState]);

  const dispatchHostMatchAction = useCallback(
    (action: Parameters<typeof matchReducer>[1]) => {
      if (!isHostRef.current || !matchRef.current) return;
      const next = matchReducer(matchRef.current, action);
      if (next === matchRef.current) return;
      if (next.round !== matchRef.current.round) {
        remoteInputsRef.current = {};
      }
      applyHostMatchState(next);
    },
    [applyHostMatchState],
  );

  const returnToLobby = useCallback(() => {
    if (!isHostRef.current) return;
    remoteInputsRef.current = {};
    interpolatorRef.current.reset();
    inputSenderRef.current.reset();
    phaseRef.current = 'lobby';
    matchRef.current = null;
    setLockedHostPeerId(null);
    setPhase('lobby');
    setMatch(null);
    broadcast('brawl_match_state', {
      matchNonce: matchNonceRef.current,
      hostPeerId: myPeerId,
      phase: 'lobby',
      match: null,
    } satisfies BrawlMatchSyncPayload);
  }, [broadcast, myPeerId]);

  const broadcastSnapshot = useCallback(
    (snapshot: BrawlSnapshotPayload) => {
      if (!isHostRef.current) return;
      broadcast('brawl_snapshot', snapshot);
    },
    [broadcast],
  );

  const sendClientInput = useCallback(
    (roundKey: string, input: FighterInput) => {
      if (isHostRef.current) return;
      inputSenderRef.current.send(
        roundKey,
        input,
        performance.now(),
        (seq, payloadInput, activeRoundKey) => {
          broadcast('brawl_input', {
            roundKey: activeRoundKey,
            peerId: myPeerId,
            seq,
            input: payloadInput,
          } satisfies BrawlInputPayload);
        },
      );
    },
    [broadcast, myPeerId],
  );

  const getRemoteInputs = useCallback((): Record<string, FighterInput> => {
    const nowMs = performance.now();
    const out: Record<string, FighterInput> = {};
    const currentFighters = matchRef.current?.fighters ?? [];

    for (const fighter of currentFighters) {
      if (fighter.isBot || fighter.id === myPeerId) continue;
      const rec = remoteInputsRef.current[fighter.id];
      if (!rec || nowMs - rec.receivedAtMs > BRAWL_INPUT_STALE_MS) {
        out[fighter.id] = NEUTRAL_INPUT;
      } else {
        out[fighter.id] = rec.input;
        // Consume one-shot button impulses after one simulation tick
        remoteInputsRef.current[fighter.id] = {
          ...rec,
          input: {
            ...rec.input,
            jump: false,
            punch: false,
            headbutt: false,
            roll: false,
            emote: null,
          },
        };
      }
    }
    return out;
  }, [myPeerId]);

  const myMember = useMemo(
    () => members.find((m) => m.peerId === myPeerId) ?? null,
    [members, myPeerId],
  );

  return {
    configured,
    myPeerId,
    status,
    errorMessage,
    roomCode,
    phase,
    members,
    myMember,
    hostPeerId,
    isHost,
    settings,
    canStart,
    match,
    matchNonce,
    interpolatorRef,
    createRoom,
    joinRoom,
    leaveRoom,
    updateProfile,
    toggleReady,
    updateSettings,
    startOnlineMatch,
    dispatchHostMatchAction,
    returnToLobby,
    broadcastSnapshot,
    sendClientInput,
    getRemoteInputs,
  };
}

export type BrawlRoomHandle = ReturnType<typeof useBrawlRoom>;
