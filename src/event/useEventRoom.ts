import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  BRAWL_INPUT_INTERVAL_MS,
  BRAWL_SNAPSHOT_INTERVAL_MS,
} from '../brawl/online/protocol';
import type { AnimalId } from '../engine/types';
import { HostStarTransport } from '../online/p2p/starTransport';
import {
  generateRoomCode,
  normalizeRoomCode,
} from '../online/sanitize';
import { getSupabaseClient, isSupabaseConfigured } from '../online/supabaseClient';
import {
  normalizeAccessories,
  type AccessorySelection,
} from '../scene3d/accessoryCatalog';
import {
  DEFAULT_EVENT_SETTINGS,
  EVENT_INTRO_DURATION_SEC,
  EVENT_MAX_PLAYERS,
  EVENT_MIN_PLAYERS,
  sanitizeEventSettings,
  type EventConfigBroadcast,
  type EventMember,
  type EventPhase,
  type EventRoundConfig,
  type EventRoundPlayerResult,
  type EventRoundSummary,
  type EventSettings,
  type EventStanding,
  type EventStateBroadcast,
} from './protocol';
import {
  applyRoundToStandings,
  assignGlassPairs,
  createInitialStandings,
} from './scoring';

export type EventConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

interface GameMsgEnvelope {
  roundId: string;
  kind: string;
  payload: unknown;
}

const PEER_STORAGE_KEY = 'paws_online_peer_id_v1';

function getOrCreatePeerId(): string {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const existing = window.sessionStorage.getItem(PEER_STORAGE_KEY);
      if (existing && existing.trim().length > 0) return existing;
      const generated = `peer-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(PEER_STORAGE_KEY, generated);
      return generated;
    } catch {
      // Fallback
    }
  }
  return `peer-${Math.random().toString(36).slice(2, 10)}`;
}

function generateSeed32(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] || 1;
  }
  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
}

function generateMatchId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parsePresenceMembers(
  presenceState: Record<string, unknown[]>,
): EventMember[] {
  const byPeer = new Map<string, EventMember>();
  for (const entries of Object.values(presenceState)) {
    if (!Array.isArray(entries)) continue;
    for (const raw of entries) {
      if (!raw || typeof raw !== 'object') continue;
      const m = raw as Partial<EventMember>;
      if (typeof m.peerId !== 'string' || typeof m.name !== 'string') continue;
      const candidate: EventMember = {
        peerId: m.peerId,
        name: m.name,
        animal: (m.animal ?? 'dog') as AnimalId,
        accessory: normalizeAccessories(m.accessory as AccessorySelection),
        isHost: Boolean(m.isHost),
        ready: Boolean(m.ready),
        joinedAt: typeof m.joinedAt === 'number' ? m.joinedAt : Date.now(),
      };
      const existing = byPeer.get(m.peerId);
      if (!existing || candidate.joinedAt <= existing.joinedAt) {
        byPeer.set(m.peerId, candidate);
      }
    }
  }
  return Array.from(byPeer.values()).sort((a, b) => a.joinedAt - b.joinedAt);
}

export function useEventRoom() {
  const configured = isSupabaseConfigured();
  const [myPeerId] = useState<string>(() => getOrCreatePeerId());
  const [roomCode, setRoomCode] = useState<string>('');
  const [eventMatchId, setEventMatchId] = useState<string>('');
  const [phase, setPhase] = useState<EventPhase>('idle');
  const [connectionStatus, setConnectionStatus] =
    useState<EventConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [members, setMembers] = useState<EventMember[]>([]);
  const [roster, setRoster] = useState<EventMember[]>([]);
  const [hostId, setHostId] = useState<string>('');
  const [settings, setSettings] = useState<EventSettings>(DEFAULT_EVENT_SETTINGS);
  const [currentRound, setCurrentRound] = useState<EventRoundConfig | null>(null);
  const [roundHistory, setRoundHistory] = useState<EventRoundSummary[]>([]);
  const [standings, setStandings] = useState<EventStanding[]>([]);
  const [introSecondsLeft, setIntroSecondsLeft] = useState<number>(0);
  const [roundSecondsLeft, setRoundSecondsLeft] = useState<number>(0);
  const [resultAdvanceSecondsLeft, setResultAdvanceSecondsLeft] =
    useState<number>(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const transportRef = useRef<HostStarTransport | null>(null);
  const myProfileRef = useRef<EventMember | null>(null);
  const seqRef = useRef<number>(0);
  const membersRef = useRef<EventMember[]>([]);
  const rosterRef = useRef<EventMember[]>([]);
  const hostIdRef = useRef<string>('');
  const roomCodeRef = useRef<string>('');
  const eventMatchIdRef = useRef<string>('');
  const phaseRef = useRef<EventPhase>('idle');
  const settingsRef = useRef<EventSettings>(DEFAULT_EVENT_SETTINGS);
  const currentRoundRef = useRef<EventRoundConfig | null>(null);
  const roundHistoryRef = useRef<EventRoundSummary[]>([]);
  const standingsRef = useRef<EventStanding[]>([]);
  const resultAdvanceAtRef = useRef<number>(0);
  const gameListenersRef = useRef<Map<string, Set<(payload: unknown) => void>>>(
    new Map(),
  );
  const realtimeListenersRef = useRef<
    Map<string, Set<(payload: unknown) => void>>
  >(new Map());

  membersRef.current = members;
  rosterRef.current = roster;
  hostIdRef.current = hostId;
  roomCodeRef.current = roomCode;
  eventMatchIdRef.current = eventMatchId;
  phaseRef.current = phase;
  settingsRef.current = settings;
  currentRoundRef.current = currentRound;
  roundHistoryRef.current = roundHistory;
  standingsRef.current = standings;

  const isHost = Boolean(hostId && hostId === myPeerId);

  const applyBroadcastState = useCallback((evt: EventStateBroadcast) => {
    if (evt.seq < seqRef.current) return;
    seqRef.current = evt.seq;
    eventMatchIdRef.current = evt.eventMatchId;
    phaseRef.current = evt.phase;
    settingsRef.current = sanitizeEventSettings(evt.settings);
    rosterRef.current = evt.roster;
    currentRoundRef.current = evt.currentRound;
    roundHistoryRef.current = evt.roundHistory;
    standingsRef.current = evt.standings;
    resultAdvanceAtRef.current = evt.resultAdvanceAtMs;

    setEventMatchId(evt.eventMatchId);
    setPhase(evt.phase);
    setSettings(settingsRef.current);
    setRoster(evt.roster);
    setCurrentRound(evt.currentRound);
    setRoundHistory(evt.roundHistory);
    setStandings(evt.standings);
    if (evt.notice) {
      setNotice(evt.notice);
    }
  }, []);

  const broadcastStateFromHost = useCallback(
    (next: Omit<EventStateBroadcast, 'seq' | 'hostId'>) => {
      const nextSeq = seqRef.current + 1;
      const payload: EventStateBroadcast = {
        seq: nextSeq,
        hostId: myPeerId,
        ...next,
      };
      applyBroadcastState(payload);
      const ch = channelRef.current;
      if (ch) {
        void ch.send({
          type: 'broadcast',
          event: 'event_state',
          payload,
        });
      }
    },
    [applyBroadcastState, myPeerId],
  );

  const buildRoundConfig = useCallback(
    (
      roundIndex: number,
      activeSettings: EventSettings,
      activeRoster: EventMember[],
    ): EventRoundConfig => {
      const gameId = activeSettings.games[roundIndex];
      const seed = generateSeed32();
      const timeLimitSec = activeSettings.timeLimits[gameId];
      const now = Date.now();
      const introEndsAtMs = now + EVENT_INTRO_DURATION_SEC * 1000;
      const glassPairs =
        gameId === 'glassCarry'
          ? assignGlassPairs(
              activeRoster,
              seed,
              roomCodeRef.current || 'EVENT',
              roundIndex,
            )
          : [];

      const effectiveDurationSec =
        gameId === 'brawl'
          ? timeLimitSec * activeSettings.brawlRounds +
            activeSettings.brawlRounds * 6
          : timeLimitSec;

      return {
        roundIndex,
        totalRounds: activeSettings.games.length,
        gameId,
        roundId: generateMatchId(`r${roundIndex}-${gameId}`),
        seed,
        timeLimitSec,
        brawlRounds: activeSettings.brawlRounds,
        introEndsAtMs,
        roundDeadlineMs: introEndsAtMs + effectiveDurationSec * 1000,
        glassPairs,
      };
    },
    [],
  );

  const teardownChannel = useCallback(() => {
    transportRef.current?.dispose();
    transportRef.current = null;
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
    seqRef.current = 0;
    myProfileRef.current = null;
    resultAdvanceAtRef.current = 0;
    setRoomCode('');
    setEventMatchId('');
    setPhase('idle');
    setConnectionStatus('disconnected');
    setError(null);
    setNotice(null);
    setMembers([]);
    setRoster([]);
    setHostId('');
    setSettings(DEFAULT_EVENT_SETTINGS);
    setCurrentRound(null);
    setRoundHistory([]);
    setStandings([]);
  }, [teardownChannel]);

  const connectToRoom = useCallback(
    (
      rawCode: string,
      profile: { name: string; animal: AnimalId; accessory: AccessorySelection },
      asHost: boolean,
    ) => {
      const client = getSupabaseClient();
      if (!client) {
        setError(
          'Chưa cấu hình Supabase Realtime (.env.local). Không thể tạo phòng Event trực tuyến.',
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
      seqRef.current = 0;
      setError(null);
      setNotice(null);
      setRoomCode(code);
      roomCodeRef.current = code;
      setConnectionStatus('connecting');
      setPhase('lobby');
      phaseRef.current = 'lobby';

      const initialMember: EventMember = {
        peerId: myPeerId,
        name: profile.name.trim() || 'Người chơi',
        animal: profile.animal,
        accessory: normalizeAccessories(profile.accessory),
        isHost: asHost,
        ready: asHost,
        joinedAt: Date.now(),
      };
      myProfileRef.current = initialMember;

      if (asHost) {
        setHostId(myPeerId);
        hostIdRef.current = myPeerId;
      }

      const channel = client.channel(`paws-event:${code}`, {
        config: {
          broadcast: { self: false },
          presence: { key: myPeerId },
        },
      });
      channelRef.current = channel;

      const transport = new HostStarTransport({
        channel,
        myPeerId,
        fallbackBaseSnapshotIntervalMs: BRAWL_SNAPSHOT_INTERVAL_MS,
        fallbackBaseInputIntervalMs: BRAWL_INPUT_INTERVAL_MS,
      });
      transportRef.current = transport;
      transport.onMessage('event_rt', (payload) => {
        const env = payload as GameMsgEnvelope | undefined;
        if (!env || typeof env.kind !== 'string') return;
        const activeId = currentRoundRef.current?.roundId;
        if (activeId && env.roundId !== activeId) return;
        const set = realtimeListenersRef.current.get(env.kind);
        if (!set) return;
        set.forEach((handler) => handler(env.payload));
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const parsed = parsePresenceMembers(
            channel.presenceState() as Record<string, unknown[]>,
          );
          setMembers(parsed);
          membersRef.current = parsed;

          const prevHostId = hostIdRef.current;
          const explicitHost = parsed.find((m) => m.isHost);
          const resolvedHost = explicitHost?.peerId ?? parsed[0]?.peerId ?? '';

          if (resolvedHost) {
            setHostId(resolvedHost);
            hostIdRef.current = resolvedHost;
          }

          // Promote self as explicit host if previous host vanished
          if (
            resolvedHost === myPeerId &&
            prevHostId &&
            prevHostId !== myPeerId &&
            myProfileRef.current &&
            !myProfileRef.current.isHost
          ) {
            const promoted: EventMember = {
              ...myProfileRef.current,
              isHost: true,
              ready: true,
            };
            myProfileRef.current = promoted;
            void channel.track(promoted);

            // If previous host dropped mid-round, abort interrupted round safely
            if (
              (phaseRef.current === 'playing' ||
                phaseRef.current === 'roundIntro') &&
              currentRoundRef.current
            ) {
              const abortedRound = currentRoundRef.current;
              const zeroResults: EventRoundPlayerResult[] = rosterRef.current.map(
                (m) => ({
                  peerId: m.peerId,
                  rank: rosterRef.current.length,
                  pointsAwarded: 0,
                  metricLabel: 'Hủy do Host rời phòng',
                }),
              );
              const nextHistory: EventRoundSummary[] = [
                ...roundHistoryRef.current,
                {
                  roundIndex: abortedRound.roundIndex,
                  gameId: abortedRound.gameId,
                  aborted: true,
                  reason: 'Host đã rời phòng giữa vòng đấu.',
                  results: zeroResults,
                },
              ];
              broadcastStateFromHost({
                eventMatchId: eventMatchIdRef.current,
                phase: 'roundResult',
                settings: settingsRef.current,
                roster: rosterRef.current,
                currentRound: abortedRound,
                roundHistory: nextHistory,
                standings: standingsRef.current,
                resultAdvanceAtMs: 0,
                notice: 'Host cũ đã rời phòng — bạn trở thành Host mới. Vòng dang dở được chuyển về bảng điểm.',
              });
            }
          }

          // Sync current config/state to late joiners
          if (resolvedHost === myPeerId) {
            if (phaseRef.current === 'lobby') {
              const cfg: EventConfigBroadcast = {
                hostId: myPeerId,
                settings: settingsRef.current,
              };
              void channel.send({
                type: 'broadcast',
                event: 'event_config',
                payload: cfg,
              });
            } else if (phaseRef.current !== 'idle') {
              const snap: EventStateBroadcast = {
                seq: seqRef.current,
                hostId: myPeerId,
                eventMatchId: eventMatchIdRef.current,
                phase: phaseRef.current,
                settings: settingsRef.current,
                roster: rosterRef.current,
                currentRound: currentRoundRef.current,
                roundHistory: roundHistoryRef.current,
                standings: standingsRef.current,
                resultAdvanceAtMs: resultAdvanceAtRef.current,
              };
              void channel.send({
                type: 'broadcast',
                event: 'event_state',
                payload: snap,
              });
            }
          }
        })
        .on('broadcast', { event: 'event_config' }, ({ payload }) => {
          const evt = payload as EventConfigBroadcast | undefined;
          if (!evt || !evt.settings) return;
          const clean = sanitizeEventSettings(evt.settings);
          setSettings(clean);
          settingsRef.current = clean;
        })
        .on('broadcast', { event: 'event_state' }, ({ payload }) => {
          const evt = payload as EventStateBroadcast | undefined;
          if (!evt || typeof evt.seq !== 'number') return;
          applyBroadcastState(evt);
        })
        .on('broadcast', { event: 'event_game_msg' }, ({ payload }) => {
          const env = payload as GameMsgEnvelope | undefined;
          if (!env || typeof env.kind !== 'string') return;
          const activeId = currentRoundRef.current?.roundId;
          if (activeId && env.roundId !== activeId) return;
          const set = gameListenersRef.current.get(env.kind);
          if (!set) return;
          set.forEach((handler) => handler(env.payload));
        });

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          setError(null);
          if (myProfileRef.current) {
            await channel.track(myProfileRef.current);
          }
          if (asHost) {
            const cfg: EventConfigBroadcast = {
              hostId: myPeerId,
              settings: settingsRef.current,
            };
            void channel.send({
              type: 'broadcast',
              event: 'event_config',
              payload: cfg,
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
    [applyBroadcastState, broadcastStateFromHost, myPeerId, teardownChannel],
  );

  const createRoom = useCallback(
    (profile: { name: string; animal: AnimalId; accessory: AccessorySelection }) => {
      const code = generateRoomCode(5);
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
      const cur = myProfileRef.current;
      const ch = channelRef.current;
      if (!cur) return;
      const updated: EventMember = {
        ...cur,
        ...patch,
        name:
          patch.name !== undefined ? patch.name.trim() || cur.name : cur.name,
        accessory:
          patch.accessory !== undefined
            ? normalizeAccessories(patch.accessory)
            : cur.accessory,
      };
      myProfileRef.current = updated;
      if (ch) {
        void ch.track(updated);
      }
    },
    [],
  );

  const updateSettings = useCallback(
    (patch: Partial<EventSettings>) => {
      if (hostIdRef.current !== myPeerId) return;
      const next = sanitizeEventSettings({
        ...settingsRef.current,
        ...patch,
        timeLimits: {
          ...settingsRef.current.timeLimits,
          ...(patch.timeLimits ?? {}),
        },
      });
      settingsRef.current = next;
      setSettings(next);

      const ch = channelRef.current;
      if (ch) {
        const cfg: EventConfigBroadcast = {
          hostId: myPeerId,
          settings: next,
        };
        void ch.send({
          type: 'broadcast',
          event: 'event_config',
          payload: cfg,
        });
      }
    },
    [myPeerId],
  );

  const startEvent = useCallback(() => {
    if (hostIdRef.current !== myPeerId) return;
    const currentMembers = membersRef.current.slice(0, EVENT_MAX_PLAYERS);
    if (currentMembers.length < EVENT_MIN_PLAYERS) {
      setError(`Cần tối thiểu ${EVENT_MIN_PLAYERS} người chơi thật để bắt đầu Event.`);
      return;
    }
    const allGuestsReady = currentMembers.every(
      (m) => m.peerId === myPeerId || m.ready,
    );
    if (!allGuestsReady) {
      setError('Tất cả người chơi trong phòng cần bấm Sẵn sàng trước khi bắt đầu.');
      return;
    }

    const activeSettings = sanitizeEventSettings(settingsRef.current);
    const matchId = generateMatchId('evt');
    const firstRound = buildRoundConfig(0, activeSettings, currentMembers);
    const initialStandings = createInitialStandings(currentMembers);

    setError(null);
    setNotice(null);
    broadcastStateFromHost({
      eventMatchId: matchId,
      phase: 'roundIntro',
      settings: activeSettings,
      roster: currentMembers,
      currentRound: firstRound,
      roundHistory: [],
      standings: initialStandings,
      resultAdvanceAtMs: 0,
    });
  }, [broadcastStateFromHost, buildRoundConfig, myPeerId]);

  const submitHostRoundComplete = useCallback(
    (
      roundId: string,
      results: EventRoundPlayerResult[],
      meta?: { aborted?: boolean; reason?: string },
    ) => {
      if (hostIdRef.current !== myPeerId) return;
      if (phaseRef.current !== 'playing') return;
      const activeRound = currentRoundRef.current;
      if (!activeRound || activeRound.roundId !== roundId) return;

      const updatedStandings = applyRoundToStandings(
        rosterRef.current,
        standingsRef.current,
        activeRound.gameId,
        activeRound.roundIndex,
        results,
      );

      const summary: EventRoundSummary = {
        roundIndex: activeRound.roundIndex,
        gameId: activeRound.gameId,
        aborted: meta?.aborted,
        reason: meta?.reason,
        results,
      };
      const nextHistory = [...roundHistoryRef.current, summary];
      const autoSec = settingsRef.current.autoAdvanceSec;
      const advanceAt = autoSec > 0 ? Date.now() + autoSec * 1000 : 0;

      broadcastStateFromHost({
        eventMatchId: eventMatchIdRef.current,
        phase: 'roundResult',
        settings: settingsRef.current,
        roster: rosterRef.current,
        currentRound: activeRound,
        roundHistory: nextHistory,
        standings: updatedStandings,
        resultAdvanceAtMs: advanceAt,
      });
    },
    [broadcastStateFromHost, myPeerId],
  );

  const advanceToNextRound = useCallback(() => {
    if (hostIdRef.current !== myPeerId) return;
    if (phaseRef.current !== 'roundResult') return;
    const activeRound = currentRoundRef.current;
    const activeSettings = settingsRef.current;
    if (!activeRound) return;

    const nextIndex = activeRound.roundIndex + 1;
    if (nextIndex >= activeSettings.games.length) {
      broadcastStateFromHost({
        eventMatchId: eventMatchIdRef.current,
        phase: 'finalPodium',
        settings: activeSettings,
        roster: rosterRef.current,
        currentRound: activeRound,
        roundHistory: roundHistoryRef.current,
        standings: standingsRef.current,
        resultAdvanceAtMs: 0,
      });
      return;
    }

    const nextRound = buildRoundConfig(
      nextIndex,
      activeSettings,
      rosterRef.current,
    );
    broadcastStateFromHost({
      eventMatchId: eventMatchIdRef.current,
      phase: 'roundIntro',
      settings: activeSettings,
      roster: rosterRef.current,
      currentRound: nextRound,
      roundHistory: roundHistoryRef.current,
      standings: standingsRef.current,
      resultAdvanceAtMs: 0,
    });
  }, [broadcastStateFromHost, buildRoundConfig, myPeerId]);

  const resetEventToLobby = useCallback(() => {
    if (hostIdRef.current !== myPeerId) return;
    broadcastStateFromHost({
      eventMatchId: '',
      phase: 'lobby',
      settings: settingsRef.current,
      roster: [],
      currentRound: null,
      roundHistory: [],
      standings: [],
      resultAdvanceAtMs: 0,
      notice: undefined,
    });
  }, [broadcastStateFromHost, myPeerId]);

  const sendGameEvent = useCallback(
    (kind: string, payload: unknown, opts?: { localEcho?: boolean }) => {
      const ch = channelRef.current;
      const roundId = currentRoundRef.current?.roundId;
      if (!ch || !roundId) return;
      const env: GameMsgEnvelope = { roundId, kind, payload };
      if (opts?.localEcho) {
        const set = gameListenersRef.current.get(kind);
        set?.forEach((handler) => handler(payload));
      }
      void ch.send({
        type: 'broadcast',
        event: 'event_game_msg',
        payload: env,
      });
    },
    [],
  );

  const subscribeGameEvent = useCallback(
    (kind: string, handler: (payload: unknown) => void): (() => void) => {
      let set = gameListenersRef.current.get(kind);
      if (!set) {
        set = new Set();
        gameListenersRef.current.set(kind, set);
      }
      set.add(handler);
      return () => {
        set?.delete(handler);
      };
    },
    [],
  );

  const sendRealtimeFromHost = useCallback((kind: string, payload: unknown) => {
    const transport = transportRef.current;
    const roundId = currentRoundRef.current?.roundId;
    if (!transport || !roundId) return;
    const env: GameMsgEnvelope = { roundId, kind, payload };
    transport.sendFromHost('event_rt', env);
  }, []);

  const sendRealtimeToHost = useCallback((kind: string, payload: unknown) => {
    const transport = transportRef.current;
    const roundId = currentRoundRef.current?.roundId;
    if (!transport || !roundId) return;
    const env: GameMsgEnvelope = { roundId, kind, payload };
    transport.sendToHost('event_rt', env);
  }, []);

  const subscribeRealtimeEvent = useCallback(
    (kind: string, handler: (payload: unknown) => void): (() => void) => {
      let set = realtimeListenersRef.current.get(kind);
      if (!set) {
        set = new Set();
        realtimeListenersRef.current.set(kind, set);
      }
      set.add(handler);
      return () => {
        set?.delete(handler);
      };
    },
    [],
  );

  // Keep WebRTC P2P star topology synced once the Event channel is subscribed
  useEffect(() => {
    if (connectionStatus !== 'connected' || !hostId) return;
    transportRef.current?.syncPeers({
      isHost,
      hostPeerId: hostId,
      peerIds: members.map((m) => m.peerId),
    });
  }, [connectionStatus, hostId, isHost, members]);

  // Synchronized countdown ticker for roundIntro, playing, and roundResult auto-advance
  useEffect(() => {
    if (
      phase !== 'roundIntro' &&
      phase !== 'playing' &&
      phase !== 'roundResult'
    ) {
      setIntroSecondsLeft(0);
      setRoundSecondsLeft(0);
      setResultAdvanceSecondsLeft(0);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const round = currentRoundRef.current;

      if (phaseRef.current === 'roundIntro' && round) {
        const remMs = round.introEndsAtMs - now;
        setIntroSecondsLeft(Math.max(0, Math.ceil(remMs / 1000)));
        if (remMs <= 0 && hostIdRef.current === myPeerId) {
          const totalRoundSec =
            round.gameId === 'brawl'
              ? round.timeLimitSec * round.brawlRounds + round.brawlRounds * 6
              : round.timeLimitSec;
          const startedRound: EventRoundConfig = {
            ...round,
            roundDeadlineMs: now + totalRoundSec * 1000,
          };
          broadcastStateFromHost({
            eventMatchId: eventMatchIdRef.current,
            phase: 'playing',
            settings: settingsRef.current,
            roster: rosterRef.current,
            currentRound: startedRound,
            roundHistory: roundHistoryRef.current,
            standings: standingsRef.current,
            resultAdvanceAtMs: 0,
          });
        }
        return;
      }

      if (phaseRef.current === 'playing' && round) {
        const remMs = round.roundDeadlineMs - now;
        setRoundSecondsLeft(Math.max(0, Math.ceil(remMs / 1000)));
        return;
      }

      if (phaseRef.current === 'roundResult') {
        const advAt = resultAdvanceAtRef.current;
        if (advAt > 0) {
          const remMs = advAt - now;
          setResultAdvanceSecondsLeft(Math.max(0, Math.ceil(remMs / 1000)));
          if (remMs <= 0 && hostIdRef.current === myPeerId) {
            resultAdvanceAtRef.current = 0;
            advanceToNextRound();
          }
        } else {
          setResultAdvanceSecondsLeft(0);
        }
      }
    };

    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [advanceToNextRound, broadcastStateFromHost, myPeerId, phase]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      teardownChannel();
    };
  }, [teardownChannel]);

  const clearNotice = useCallback(() => setNotice(null), []);

  return {
    configured,
    myPeerId,
    roomCode,
    eventMatchId,
    phase,
    connectionStatus,
    error,
    notice,
    clearNotice,
    members,
    roster,
    hostId,
    isHost,
    settings,
    currentRound,
    roundHistory,
    standings,
    introSecondsLeft,
    roundSecondsLeft,
    resultAdvanceSecondsLeft,
    createRoom,
    joinRoom,
    leaveRoom,
    updateMyProfile,
    updateSettings,
    startEvent,
    submitHostRoundComplete,
    advanceToNextRound,
    resetEventToLobby,
    sendGameEvent,
    subscribeGameEvent,
    sendRealtimeFromHost,
    sendRealtimeToHost,
    subscribeRealtimeEvent,
  };
}

export type EventRoomController = ReturnType<typeof useEventRoom>;
