import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AnimalId, CardData, GameState, PlayOptions } from '../engine/types';
import {
  callPaws,
  catchMissedPaws,
  dealOnlineGame,
  drawTurnAction,
  playCard,
} from '../engine/game';
import { chooseBotAction, shouldBotCallPaws } from '../engine/bot';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import {
  generateRoomCode,
  normalizeRoomCode,
  reconstructClientGameState,
  sanitizeStateForBroadcast,
} from './sanitize';
import type {
  EmoteEvent,
  GameSnapshotEvent,
  HandSyncEvent,
  LobbyPresenceMember,
  PlayerActionEvent,
  RoomConfigEvent,
  RoomPhase,
  RoomSettings,
} from './protocol';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

const PEER_STORAGE_KEY = 'paws_online_peer_id_v1';

const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 4,
  fillWithBots: true,
  difficulty: 'medium',
  deckMode: 'full',
  turnTimeSec: 20,
};

function getOrCreatePeerId(): string {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const existing = window.sessionStorage.getItem(PEER_STORAGE_KEY);
      if (existing && existing.trim().length > 0) {
        return existing;
      }
      const generated = `peer-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(PEER_STORAGE_KEY, generated);
      return generated;
    } catch {
      // Fallback below
    }
  }
  return `peer-${Math.random().toString(36).slice(2, 10)}`;
}

function parsePresenceMembers(
  presenceState: Record<string, unknown[]>,
): LobbyPresenceMember[] {
  const byPeer = new Map<string, LobbyPresenceMember>();
  for (const entries of Object.values(presenceState)) {
    if (!Array.isArray(entries)) continue;
    for (const raw of entries) {
      if (!raw || typeof raw !== 'object') continue;
      const m = raw as Partial<LobbyPresenceMember>;
      if (typeof m.peerId !== 'string' || typeof m.name !== 'string') continue;
      const existing = byPeer.get(m.peerId);
      const candidate: LobbyPresenceMember = {
        peerId: m.peerId,
        name: m.name,
        animal: (m.animal ?? 'dog') as AnimalId,
        accessory: m.accessory ?? null,
        isHost: Boolean(m.isHost),
        ready: Boolean(m.ready),
        joinedAt: typeof m.joinedAt === 'number' ? m.joinedAt : Date.now(),
      };
      if (!existing || candidate.joinedAt <= existing.joinedAt) {
        byPeer.set(m.peerId, candidate);
      }
    }
  }
  return Array.from(byPeer.values()).sort((a, b) => a.joinedAt - b.joinedAt);
}

export function useOnlineRoom() {
  const configured = isSupabaseConfigured();
  const [myPeerId] = useState<string>(() => getOrCreatePeerId());
  const [roomCode, setRoomCode] = useState<string>('');
  const [phase, setPhase] = useState<RoomPhase>('idle');
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<LobbyPresenceMember[]>([]);
  const [hostId, setHostId] = useState<string>('');
  const [roomSettings, setRoomSettings] = useState<RoomSettings>(
    DEFAULT_ROOM_SETTINGS,
  );
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number>(
    DEFAULT_ROOM_SETTINGS.turnTimeSec,
  );
  const [roomAccessories, setRoomAccessories] = useState<
    Partial<Record<AnimalId, string | null>>
  >({});
  const [lastEmote, setLastEmote] = useState<EmoteEvent | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const myProfileRef = useRef<LobbyPresenceMember | null>(null);
  const hostStateRef = useRef<GameState | null>(null);
  const seqRef = useRef<number>(0);
  const lastSnapshotRef = useRef<GameSnapshotEvent | null>(null);
  const myHandRef = useRef<CardData[]>([]);
  const turnDeadlineRef = useRef<number>(0);
  const membersRef = useRef<LobbyPresenceMember[]>([]);
  const hostIdRef = useRef<string>('');
  const roomSettingsRef = useRef<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const phaseRef = useRef<RoomPhase>('idle');
  const roomAccessoriesRef = useRef<Partial<Record<AnimalId, string | null>>>(
    {},
  );
  const autoTimeoutFiredTurnRef = useRef<number>(-1);

  membersRef.current = members;
  hostIdRef.current = hostId;
  roomSettingsRef.current = roomSettings;
  phaseRef.current = phase;
  roomAccessoriesRef.current = roomAccessories;

  const isHost = Boolean(hostId && hostId === myPeerId);

  const broadcastStateFromHost = useCallback(
    (nextState: GameState, resetTimer = true) => {
      const channel = channelRef.current;
      hostStateRef.current = nextState;

      const nextSeq = seqRef.current + 1;
      seqRef.current = nextSeq;

      const deadline =
        nextState.winnerId !== null
          ? 0
          : resetTimer
            ? Date.now() + roomSettingsRef.current.turnTimeSec * 1000
            : turnDeadlineRef.current;
      turnDeadlineRef.current = deadline;
      autoTimeoutFiredTurnRef.current = -1;

      setGameState(nextState);
      setPhase('playing');
      setTurnSecondsLeft(
        deadline > 0
          ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
          : 0,
      );

      if (!channel) return;

      const snapshot: GameSnapshotEvent = {
        seq: nextSeq,
        hostId: myPeerId,
        publicState: sanitizeStateForBroadcast(nextState),
        turnDeadlineMs: deadline,
        accessories: roomAccessoriesRef.current,
      };
      lastSnapshotRef.current = snapshot;

      void channel.send({
        type: 'broadcast',
        event: 'game_snapshot',
        payload: snapshot,
      });

      for (const player of nextState.players) {
        if (player.isBot) continue;
        if (player.id === myPeerId) {
          myHandRef.current = player.hand.slice();
          continue;
        }
        const handSync: HandSyncEvent = {
          seq: nextSeq,
          targetPeerId: player.id,
          hand: player.hand,
        };
        void channel.send({
          type: 'broadcast',
          event: 'hand_sync',
          payload: handSync,
        });
      }
    },
    [myPeerId],
  );

  const applyAuthoritativeAction = useCallback(
    (evt: PlayerActionEvent) => {
      if (hostIdRef.current !== myPeerId) return;
      const state = hostStateRef.current;
      if (!state || state.winnerId !== null) return;

      const currentPlayer = state.players[state.currentIndex];
      const actor = state.players.find((p) => p.id === evt.peerId);
      if (!actor) return;

      if (evt.action === 'play') {
        if (evt.turnCount !== state.turnCount) return;
        if (!currentPlayer || currentPlayer.id !== evt.peerId) return;
        if (!evt.cardId) return;
        const nextState = playCard(state, evt.peerId, evt.cardId, evt.options);
        if (nextState !== state) {
          broadcastStateFromHost(nextState, true);
        }
        return;
      }

      if (evt.action === 'draw') {
        if (evt.turnCount !== state.turnCount) return;
        if (!currentPlayer || currentPlayer.id !== evt.peerId) return;
        const nextState = drawTurnAction(state, evt.peerId);
        if (nextState !== state) {
          broadcastStateFromHost(nextState, true);
        }
        return;
      }

      if (evt.action === 'call_paws') {
        const nextState = callPaws(state, evt.peerId);
        if (nextState !== state) {
          broadcastStateFromHost(nextState, false);
        }
        return;
      }

      if (evt.action === 'catch_paws') {
        if (!evt.targetPlayerId) return;
        const nextState = catchMissedPaws(state, evt.targetPlayerId, actor.name);
        if (nextState !== state) {
          broadcastStateFromHost(nextState, false);
        }
      }
    },
    [broadcastStateFromHost, myPeerId],
  );

  const applyEmoteLocally = useCallback((evt: EmoteEvent) => {
    setLastEmote(evt);
    const bubbleText = `${evt.emote} ${evt.text}`.trim();

    if (hostStateRef.current) {
      hostStateRef.current = {
        ...hostStateRef.current,
        players: hostStateRef.current.players.map((p) =>
          p.id === evt.peerId ? { ...p, quip: bubbleText } : p,
        ),
      };
    }

    setGameState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map((p) =>
          p.id === evt.peerId ? { ...p, quip: bubbleText } : p,
        ),
      };
    });

    setTimeout(() => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === evt.peerId && p.quip === bubbleText
              ? { ...p, quip: null }
              : p,
          ),
        };
      });
    }, 2600);
  }, []);

  const teardownChannel = useCallback(() => {
    const client = getSupabaseClient();
    const ch = channelRef.current;
    channelRef.current = null;
    if (ch && client) {
      void client.removeChannel(ch);
    } else if (ch) {
      void ch.unsubscribe();
    }
  }, []);

  const leaveRoom = useCallback(() => {
    teardownChannel();
    hostStateRef.current = null;
    lastSnapshotRef.current = null;
    myHandRef.current = [];
    myProfileRef.current = null;
    turnDeadlineRef.current = 0;
    seqRef.current = 0;
    setRoomCode('');
    setPhase('idle');
    setConnectionStatus('disconnected');
    setError(null);
    setMembers([]);
    setHostId('');
    setGameState(null);
    setRoomAccessories({});
    setLastEmote(null);
    setRoomSettings(DEFAULT_ROOM_SETTINGS);
  }, [teardownChannel]);

  const connectToRoom = useCallback(
    (
      rawCode: string,
      profile: { name: string; animal: AnimalId; accessory: string | null },
      asHost: boolean,
    ) => {
      const client = getSupabaseClient();
      if (!client) {
        setError(
          'Chưa cấu hình Supabase Realtime (.env.local). Xem hướng dẫn thiết lập bên trên.',
        );
        setConnectionStatus('error');
        return;
      }

      const code = normalizeRoomCode(rawCode);
      if (code.length < 4) {
        setError('Mã phòng không hợp lệ (cần 4–6 ký tự).');
        return;
      }

      teardownChannel();
      setError(null);
      setRoomCode(code);
      setConnectionStatus('connecting');
      setPhase('lobby');

      const trimmedName = profile.name.trim() || 'Người chơi';
      const initialMember: LobbyPresenceMember = {
        peerId: myPeerId,
        name: trimmedName,
        animal: profile.animal,
        accessory: profile.accessory,
        isHost: asHost,
        ready: asHost,
        joinedAt: Date.now(),
      };
      myProfileRef.current = initialMember;
      if (asHost) {
        setHostId(myPeerId);
        hostIdRef.current = myPeerId;
      }

      const channel = client.channel(`paws-room:${code}`, {
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
          setMembers(parsed);
          membersRef.current = parsed;

          const explicitHost = parsed.find((m) => m.isHost);
          const resolvedHost = explicitHost?.peerId ?? parsed[0]?.peerId ?? '';
          if (resolvedHost) {
            setHostId(resolvedHost);
            hostIdRef.current = resolvedHost;
          }

          // Sync accessories map from current lobby presence
          const accMap: Partial<Record<AnimalId, string | null>> = {};
          for (const m of parsed) {
            if (m.accessory) {
              accMap[m.animal] = m.accessory;
            }
          }
          setRoomAccessories(accMap);
          roomAccessoriesRef.current = accMap;

          // If we are host, re-broadcast current room config so late joiners see it
          if (resolvedHost === myPeerId && phaseRef.current === 'lobby') {
            const cfg: RoomConfigEvent = {
              hostId: myPeerId,
              settings: roomSettingsRef.current,
            };
            void channel.send({
              type: 'broadcast',
              event: 'room_config',
              payload: cfg,
            });
          }
        })
        .on('broadcast', { event: 'room_config' }, ({ payload }) => {
          const evt = payload as RoomConfigEvent | undefined;
          if (!evt || !evt.settings) return;
          setRoomSettings(evt.settings);
          roomSettingsRef.current = evt.settings;
        })
        .on('broadcast', { event: 'game_snapshot' }, ({ payload }) => {
          const evt = payload as GameSnapshotEvent | undefined;
          if (!evt || !evt.publicState) return;
          if (evt.hostId === myPeerId && hostStateRef.current) {
            return;
          }
          if (lastSnapshotRef.current && evt.seq < lastSnapshotRef.current.seq) {
            return;
          }
          lastSnapshotRef.current = evt;
          turnDeadlineRef.current = evt.turnDeadlineMs;
          setRoomAccessories(evt.accessories ?? {});
          roomAccessoriesRef.current = evt.accessories ?? {};
          setPhase('playing');
          setTurnSecondsLeft(
            evt.turnDeadlineMs > 0
              ? Math.max(0, Math.ceil((evt.turnDeadlineMs - Date.now()) / 1000))
              : 0,
          );
          const rebuilt = reconstructClientGameState(
            evt.publicState,
            myPeerId,
            myHandRef.current,
          );
          setGameState(rebuilt);
        })
        .on('broadcast', { event: 'hand_sync' }, ({ payload }) => {
          const evt = payload as HandSyncEvent | undefined;
          if (!evt || evt.targetPeerId !== myPeerId) return;
          myHandRef.current = evt.hand.slice();
          if (lastSnapshotRef.current) {
            const rebuilt = reconstructClientGameState(
              lastSnapshotRef.current.publicState,
              myPeerId,
              myHandRef.current,
            );
            setGameState(rebuilt);
          }
        })
        .on('broadcast', { event: 'player_action' }, ({ payload }) => {
          const evt = payload as PlayerActionEvent | undefined;
          if (!evt) return;
          applyAuthoritativeAction(evt);
        })
        .on('broadcast', { event: 'emote' }, ({ payload }) => {
          const evt = payload as EmoteEvent | undefined;
          if (!evt) return;
          applyEmoteLocally(evt);
        })
        .on('broadcast', { event: 'return_lobby' }, () => {
          hostStateRef.current = null;
          lastSnapshotRef.current = null;
          myHandRef.current = [];
          turnDeadlineRef.current = 0;
          setGameState(null);
          setPhase('lobby');
        });

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          setError(null);
          if (myProfileRef.current) {
            await channel.track(myProfileRef.current);
          }
          if (asHost) {
            const cfg: RoomConfigEvent = {
              hostId: myPeerId,
              settings: roomSettingsRef.current,
            };
            void channel.send({
              type: 'broadcast',
              event: 'room_config',
              payload: cfg,
            });
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('error');
          setError('Không thể kết nối tới Supabase Realtime. Vui lòng kiểm tra mạng hoặc cấu hình.');
        } else if (status === 'CLOSED') {
          setConnectionStatus('disconnected');
        }
      });
    },
    [applyAuthoritativeAction, applyEmoteLocally, myPeerId, teardownChannel],
  );

  const createRoom = useCallback(
    (profile: { name: string; animal: AnimalId; accessory: string | null }) => {
      const code = generateRoomCode(5);
      connectToRoom(code, profile, true);
    },
    [connectToRoom],
  );

  const joinRoom = useCallback(
    (
      code: string,
      profile: { name: string; animal: AnimalId; accessory: string | null },
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
        accessory: string | null;
        ready: boolean;
      }>,
    ) => {
      const current = myProfileRef.current;
      const channel = channelRef.current;
      if (!current) return;
      const updated: LobbyPresenceMember = {
        ...current,
        ...patch,
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

  const updateRoomSettings = useCallback(
    (patch: Partial<RoomSettings>) => {
      if (hostIdRef.current !== myPeerId) return;
      const next: RoomSettings = {
        ...roomSettingsRef.current,
        ...patch,
      };
      roomSettingsRef.current = next;
      setRoomSettings(next);

      const channel = channelRef.current;
      if (channel) {
        const cfg: RoomConfigEvent = {
          hostId: myPeerId,
          settings: next,
        };
        void channel.send({
          type: 'broadcast',
          event: 'room_config',
          payload: cfg,
        });
      }
    },
    [myPeerId],
  );

  const startOnlineMatch = useCallback(() => {
    if (hostIdRef.current !== myPeerId) return;
    const currentMembers = membersRef.current;
    const settings = roomSettingsRef.current;

    const humans =
      currentMembers.length > 0
        ? currentMembers.slice(0, settings.maxPlayers).map((m) => ({
            id: m.peerId,
            name: m.name,
            animal: m.animal,
          }))
        : myProfileRef.current
          ? [
              {
                id: myProfileRef.current.peerId,
                name: myProfileRef.current.name,
                animal: myProfileRef.current.animal,
              },
            ]
          : [];

    if (humans.length === 0) return;

    const accMap: Partial<Record<AnimalId, string | null>> = {};
    for (const m of currentMembers) {
      if (m.accessory) {
        accMap[m.animal] = m.accessory;
      }
    }
    setRoomAccessories(accMap);
    roomAccessoriesRef.current = accMap;

    const fillToCount = settings.fillWithBots
      ? Math.max(2, Math.min(8, settings.maxPlayers))
      : Math.max(2, humans.length);

    const dealt = dealOnlineGame({
      humans,
      fillToCount,
      difficulty: settings.difficulty,
      deckMode: settings.deckMode,
    });

    broadcastStateFromHost(dealt, true);
  }, [broadcastStateFromHost, myPeerId]);

  const returnToLobby = useCallback(() => {
    if (hostIdRef.current !== myPeerId) return;
    const channel = channelRef.current;
    hostStateRef.current = null;
    lastSnapshotRef.current = null;
    myHandRef.current = [];
    turnDeadlineRef.current = 0;
    setGameState(null);
    setPhase('lobby');
    if (channel) {
      void channel.send({
        type: 'broadcast',
        event: 'return_lobby',
        payload: { hostId: myPeerId },
      });
    }
  }, [myPeerId]);

  const dispatchAction = useCallback(
    (action: Omit<PlayerActionEvent, 'peerId' | 'turnCount'>) => {
      const currentState = hostStateRef.current ?? gameState;
      const evt: PlayerActionEvent = {
        peerId: myPeerId,
        turnCount: currentState?.turnCount ?? 0,
        ...action,
      };
      if (hostIdRef.current === myPeerId) {
        applyAuthoritativeAction(evt);
        return;
      }
      const channel = channelRef.current;
      if (channel) {
        void channel.send({
          type: 'broadcast',
          event: 'player_action',
          payload: evt,
        });
      }
    },
    [applyAuthoritativeAction, gameState, myPeerId],
  );

  const sendPlayCard = useCallback(
    (cardId: string, options?: PlayOptions) => {
      dispatchAction({ action: 'play', cardId, options });
    },
    [dispatchAction],
  );

  const sendDrawCard = useCallback(() => {
    dispatchAction({ action: 'draw' });
  }, [dispatchAction]);

  const sendCallPaws = useCallback(() => {
    dispatchAction({ action: 'call_paws' });
  }, [dispatchAction]);

  const sendCatchPaws = useCallback(
    (targetPlayerId: string) => {
      dispatchAction({ action: 'catch_paws', targetPlayerId });
    },
    [dispatchAction],
  );

  const sendEmote = useCallback(
    (emote: string, text: string) => {
      const evt: EmoteEvent = {
        peerId: myPeerId,
        emote,
        text,
        at: Date.now(),
      };
      const channel = channelRef.current;
      if (channel) {
        void channel.send({
          type: 'broadcast',
          event: 'emote',
          payload: evt,
        });
      } else {
        applyEmoteLocally(evt);
      }
    },
    [applyEmoteLocally, myPeerId],
  );

  // Turn countdown ticker + Host AFK auto-draw timeout
  useEffect(() => {
    if (phase !== 'playing') return;

    const timer = setInterval(() => {
      const deadline = turnDeadlineRef.current;
      if (deadline <= 0) {
        setTurnSecondsLeft(0);
        return;
      }
      const remainingMs = deadline - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setTurnSecondsLeft(remainingSec);

      if (remainingMs <= 0 && hostIdRef.current === myPeerId) {
        const state = hostStateRef.current;
        if (!state || state.winnerId !== null) return;
        const active = state.players[state.currentIndex];
        if (!active || active.isBot) return;
        if (autoTimeoutFiredTurnRef.current === state.turnCount) return;

        autoTimeoutFiredTurnRef.current = state.turnCount;
        const nextState = drawTurnAction(state, active.id);
        if (nextState !== state) {
          broadcastStateFromHost(nextState, true);
        }
      }
    }, 250);

    return () => clearInterval(timer);
  }, [broadcastStateFromHost, myPeerId, phase]);

  // Host Authoritative Bot AI loop (950ms) + Disconnected Human fallback (2000ms)
  useEffect(() => {
    if (!isHost || phase !== 'playing') return;
    const state = hostStateRef.current;
    if (!state || state.winnerId !== null) return;

    const currentPlayer = state.players[state.currentIndex];
    if (!currentPlayer) return;

    const isDisconnectedHuman =
      !currentPlayer.isBot &&
      currentPlayer.id !== myPeerId &&
      !members.some((m) => m.peerId === currentPlayer.id);

    if (!currentPlayer.isBot && !isDisconnectedHuman) return;

    const delayMs = currentPlayer.isBot ? 950 : 2000;
    const scheduledTurn = state.turnCount;

    const timeout = setTimeout(() => {
      const latest = hostStateRef.current;
      if (!latest || latest.winnerId !== null) return;
      if (latest.turnCount !== scheduledTurn) return;

      const active = latest.players[latest.currentIndex];
      if (!active || active.id !== currentPlayer.id) return;

      const decision = chooseBotAction(latest);
      let nextState =
        decision.action === 'play'
          ? playCard(latest, active.id, decision.cardId, decision.options)
          : drawTurnAction(latest, active.id);

      const updatedActive = nextState.players.find((p) => p.id === active.id);
      if (
        updatedActive &&
        updatedActive.hand.length <= 2 &&
        !updatedActive.calledPaws &&
        shouldBotCallPaws(updatedActive, nextState.difficulty)
      ) {
        nextState = callPaws(nextState, active.id);
      }

      if (decision.quip) {
        nextState = {
          ...nextState,
          players: nextState.players.map((p) =>
            p.id === active.id && !p.quip ? { ...p, quip: decision.quip } : p,
          ),
        };
      }

      broadcastStateFromHost(nextState, true);
    }, delayMs);

    return () => clearTimeout(timeout);
  }, [
    broadcastStateFromHost,
    gameState?.currentIndex,
    gameState?.turnCount,
    gameState?.winnerId,
    isHost,
    members,
    myPeerId,
    phase,
  ]);

  // Cleanup Supabase channel on unmount
  useEffect(() => {
    return () => {
      teardownChannel();
    };
  }, [teardownChannel]);

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
    roomSettings,
    gameState,
    turnSecondsLeft,
    roomAccessories,
    lastEmote,
    createRoom,
    joinRoom,
    leaveRoom,
    updateMyProfile,
    updateRoomSettings,
    startOnlineMatch,
    returnToLobby,
    sendPlayCard,
    sendDrawCard,
    sendCallPaws,
    sendCatchPaws,
    sendEmote,
  };
}

export type OnlineRoomController = ReturnType<typeof useOnlineRoom>;
