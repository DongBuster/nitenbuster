import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  callPaws,
  catchMissedPaws,
  dealOnlineGame,
  drawTurnAction,
  playCard,
} from '../../engine/game';
import type { AnimalId, CardData, GameState, PlayOptions } from '../../engine/types';
import type {
  EmoteEvent,
  GameSnapshotEvent,
  HandSyncEvent,
  PlayerActionEvent,
} from '../../online/protocol';
import {
  reconstructClientGameState,
  sanitizeStateForBroadcast,
} from '../../online/sanitize';
import type { OnlineRoomController } from '../../online/useOnlineRoom';
import { OnlineGame3DScreen } from '../../screens/OnlineGame3DScreen';
import { rankEventRound, scoreCardsHandPenalty } from '../scoring';
import type { EventAdapterProps } from './types';

const CARDS_TURN_TIME_SEC = 18;

/**
 * Runs a 0-bot PAWS Cards 3D match inside an active Event round.
 * Host deals strictly to human roster members and resolves round placements
 * on natural win or when the Host-configured Event time limit expires.
 */
export function EventCardsAdapter({ room, round }: EventAdapterProps) {
  const {
    configured,
    myPeerId,
    roomCode,
    connectionStatus,
    error,
    roster,
    members,
    hostId,
    isHost,
    leaveRoom,
    sendGameEvent,
    subscribeGameEvent,
    submitHostRoundComplete,
  } = room;

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number>(CARDS_TURN_TIME_SEC);
  const [lastEmote, setLastEmote] = useState<EmoteEvent | null>(null);

  const hostStateRef = useRef<GameState | null>(null);
  const membersRef = useRef(members);
  membersRef.current = members;
  const seqRef = useRef<number>(0);
  const lastSnapshotRef = useRef<GameSnapshotEvent | null>(null);
  const myHandRef = useRef<CardData[]>([]);
  const turnDeadlineRef = useRef<number>(0);
  const submittedRef = useRef<boolean>(false);
  const autoTimeoutTurnRef = useRef<number>(-1);
  const finishTimerRef = useRef<number | null>(null);
  const emoteTimersRef = useRef<Set<number>>(new Set());

  const roomAccessories = useMemo(() => {
    const map: Partial<Record<AnimalId, string[]>> = {};
    for (const m of roster) {
      if (m.accessory.length > 0) {
        map[m.animal] = m.accessory;
      }
    }
    return map;
  }, [roster]);

  // Clear pending timers on unmount
  useEffect(() => {
    const emoteTimers = emoteTimersRef.current;
    return () => {
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
      emoteTimers.forEach((id) => window.clearTimeout(id));
      emoteTimers.clear();
    };
  }, []);

  const finalizeCardsRoundFromHost = useCallback(
    (finalState: GameState) => {
      if (!isHost || submittedRef.current) return;
      submittedRef.current = true;

      const ranked = rankEventRound(
        finalState.players.map((p) => {
          const isWinner = finalState.winnerId === p.id || p.hand.length === 0;
          const handCount = p.hand.length;
          const penalty = scoreCardsHandPenalty(p.hand);
          return {
            peerId: p.id,
            primaryScore: isWinner ? 1_000_000 : -handCount,
            secondaryScore: -penalty,
            metricLabel: isWinner
              ? 'Về nhất (0 lá)!'
              : `Còn ${handCount} lá (${penalty} đ phạt)`,
          };
        }),
      );

      submitHostRoundComplete(round.roundId, ranked);
    },
    [isHost, round.roundId, submitHostRoundComplete],
  );

  const sendSyncToPeer = useCallback(
    (targetPeerId: string) => {
      const state = hostStateRef.current;
      const snap = lastSnapshotRef.current;
      if (!isHost || !state || !snap) return;

      sendGameEvent('cards_snapshot', snap);
      const player = state.players.find((p) => p.id === targetPeerId);
      if (player) {
        const handSync: HandSyncEvent = {
          seq: snap.seq,
          targetPeerId: player.id,
          hand: player.hand,
        };
        sendGameEvent('cards_hand_sync', handSync);
      }
    },
    [isHost, sendGameEvent],
  );

  const broadcastStateFromHost = useCallback(
    (nextState: GameState, resetTurnTimer = true) => {
      hostStateRef.current = nextState;
      const nextSeq = seqRef.current + 1;
      seqRef.current = nextSeq;

      const deadline =
        nextState.winnerId !== null
          ? 0
          : resetTurnTimer
            ? Date.now() + CARDS_TURN_TIME_SEC * 1000
            : turnDeadlineRef.current;
      turnDeadlineRef.current = deadline;
      autoTimeoutTurnRef.current = -1;

      setGameState(nextState);
      setTurnSecondsLeft(
        deadline > 0 ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0,
      );

      const snapshot: GameSnapshotEvent = {
        seq: nextSeq,
        hostId: myPeerId,
        publicState: sanitizeStateForBroadcast(nextState),
        turnDeadlineMs: deadline,
        accessories: roomAccessories,
      };
      lastSnapshotRef.current = snapshot;
      sendGameEvent('cards_snapshot', snapshot);

      for (const player of nextState.players) {
        if (player.id === myPeerId) {
          myHandRef.current = player.hand.slice();
          continue;
        }
        const handSync: HandSyncEvent = {
          seq: nextSeq,
          targetPeerId: player.id,
          hand: player.hand,
        };
        sendGameEvent('cards_hand_sync', handSync);
      }

      if (nextState.winnerId !== null) {
        if (finishTimerRef.current !== null) {
          window.clearTimeout(finishTimerRef.current);
        }
        finishTimerRef.current = window.setTimeout(() => {
          finishTimerRef.current = null;
          finalizeCardsRoundFromHost(nextState);
        }, 1400);
      }
    },
    [finalizeCardsRoundFromHost, myPeerId, roomAccessories, sendGameEvent],
  );

  const applyAuthoritativeAction = useCallback(
    (evt: PlayerActionEvent) => {
      if (!isHost) return;
      const state = hostStateRef.current;
      if (!state || state.winnerId !== null || submittedRef.current) return;

      const currentPlayer = state.players[state.currentIndex];
      const actor = state.players.find((p) => p.id === evt.peerId);
      if (!actor) return;

      if (evt.action === 'play') {
        if (evt.turnCount !== state.turnCount) return;
        if (!currentPlayer || currentPlayer.id !== evt.peerId || !evt.cardId) return;
        const nextState = playCard(state, evt.peerId, evt.cardId, evt.options);
        if (nextState !== state) broadcastStateFromHost(nextState, true);
        return;
      }

      if (evt.action === 'draw') {
        if (evt.turnCount !== state.turnCount) return;
        if (!currentPlayer || currentPlayer.id !== evt.peerId) return;
        const nextState = drawTurnAction(state, evt.peerId);
        if (nextState !== state) broadcastStateFromHost(nextState, true);
        return;
      }

      if (evt.action === 'call_paws') {
        const nextState = callPaws(state, evt.peerId);
        if (nextState !== state) broadcastStateFromHost(nextState, false);
        return;
      }

      if (evt.action === 'catch_paws' && evt.targetPlayerId) {
        const nextState = catchMissedPaws(state, evt.targetPlayerId, actor.name);
        if (nextState !== state) broadcastStateFromHost(nextState, false);
      }
    },
    [broadcastStateFromHost, isHost],
  );

  const applyEmoteLocally = useCallback((evt: EmoteEvent) => {
    setLastEmote(evt);
    const bubbleText = `${evt.emote} ${evt.text}`.trim();
    setGameState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map((p) =>
          p.id === evt.peerId ? { ...p, quip: bubbleText } : p,
        ),
      };
    });
    const timerId = window.setTimeout(() => {
      emoteTimersRef.current.delete(timerId);
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
    }, 2400);
    emoteTimersRef.current.add(timerId);
  }, []);

  // Subscribe to event-scoped card messages using stable callbacks (never re-subscribes on timer ticks)
  useEffect(() => {
    const unsubSnap = subscribeGameEvent('cards_snapshot', (raw) => {
      const evt = raw as GameSnapshotEvent;
      if (!evt || !evt.publicState) return;
      if (evt.hostId === myPeerId && hostStateRef.current) return;
      if (lastSnapshotRef.current && evt.seq < lastSnapshotRef.current.seq) return;
      lastSnapshotRef.current = evt;
      turnDeadlineRef.current = evt.turnDeadlineMs;
      setTurnSecondsLeft(
        evt.turnDeadlineMs > 0
          ? Math.max(0, Math.ceil((evt.turnDeadlineMs - Date.now()) / 1000))
          : 0,
      );
      setGameState(
        reconstructClientGameState(evt.publicState, myPeerId, myHandRef.current),
      );
    });

    const unsubHand = subscribeGameEvent('cards_hand_sync', (raw) => {
      const evt = raw as HandSyncEvent;
      if (!evt || evt.targetPeerId !== myPeerId) return;
      myHandRef.current = evt.hand.slice();
      if (lastSnapshotRef.current) {
        setGameState(
          reconstructClientGameState(
            lastSnapshotRef.current.publicState,
            myPeerId,
            myHandRef.current,
          ),
        );
      }
    });

    const unsubAction = subscribeGameEvent('cards_action', (raw) => {
      applyAuthoritativeAction(raw as PlayerActionEvent);
    });

    const unsubEmote = subscribeGameEvent('cards_emote', (raw) => {
      applyEmoteLocally(raw as EmoteEvent);
    });

    const unsubSyncReq = subscribeGameEvent('cards_sync_request', (raw) => {
      const req = raw as { peerId?: string } | undefined;
      if (req?.peerId && req.peerId !== myPeerId) {
        sendSyncToPeer(req.peerId);
      }
    });

    // Guests explicitly request current hand + snapshot once subscribed to eliminate mount race
    if (!isHost) {
      sendGameEvent('cards_sync_request', { peerId: myPeerId });
    }

    return () => {
      unsubSnap();
      unsubHand();
      unsubAction();
      unsubEmote();
      unsubSyncReq();
    };
  }, [
    applyAuthoritativeAction,
    applyEmoteLocally,
    isHost,
    myPeerId,
    sendGameEvent,
    sendSyncToPeer,
    subscribeGameEvent,
  ]);

  // Host deals 0-bot match immediately on mount
  useEffect(() => {
    if (!isHost || hostStateRef.current) return;
    const humans = roster.map((m) => ({
      id: m.peerId,
      name: m.name,
      animal: m.animal,
    }));
    if (humans.length < 2) return;

    const dealt = dealOnlineGame({
      humans,
      fillToCount: humans.length,
      difficulty: 'medium',
      deckMode: 'full',
    });
    broadcastStateFromHost(dealt, true);
  }, [broadcastStateFromHost, isHost, roster]);

  // Turn countdown & AFK / Disconnected player auto-draw so human-only table never stalls
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const deadline = turnDeadlineRef.current;
      if (deadline > 0) {
        setTurnSecondsLeft(Math.max(0, Math.ceil((deadline - now) / 1000)));
      }

      if (!isHost || submittedRef.current) return;
      const state = hostStateRef.current;
      if (!state || state.winnerId !== null) return;

      // Global Event round time limit reached
      if (now >= round.roundDeadlineMs) {
        finalizeCardsRoundFromHost(state);
        return;
      }

      const active = state.players[state.currentIndex];
      if (!active) return;

      const isDisconnected = !membersRef.current.some(
        (m) => m.peerId === active.id,
      );
      const effectiveDeadline = isDisconnected
        ? deadline - Math.max(0, (CARDS_TURN_TIME_SEC - 6) * 1000)
        : deadline;

      if (effectiveDeadline > 0 && now >= effectiveDeadline) {
        if (autoTimeoutTurnRef.current === state.turnCount) return;
        autoTimeoutTurnRef.current = state.turnCount;
        const nextState = drawTurnAction(state, active.id);
        if (nextState !== state) {
          broadcastStateFromHost(nextState, true);
        }
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [
    broadcastStateFromHost,
    finalizeCardsRoundFromHost,
    isHost,
    round.roundDeadlineMs,
  ]);

  const dispatchAction = useCallback(
    (action: Omit<PlayerActionEvent, 'peerId' | 'turnCount'>) => {
      const cur = hostStateRef.current ?? gameState;
      const evt: PlayerActionEvent = {
        peerId: myPeerId,
        turnCount: cur?.turnCount ?? 0,
        ...action,
      };
      if (isHost) {
        applyAuthoritativeAction(evt);
      } else {
        sendGameEvent('cards_action', evt);
      }
    },
    [applyAuthoritativeAction, gameState, isHost, myPeerId, sendGameEvent],
  );

  const cardsController: OnlineRoomController = useMemo(
    () => ({
      configured,
      myPeerId,
      roomCode,
      phase: 'playing',
      connectionStatus,
      error,
      members: roster,
      hostId,
      isHost,
      roomSettings: {
        maxPlayers: roster.length,
        fillWithBots: false,
        botCount: 0,
        difficulty: 'medium',
        deckMode: 'full',
        turnTimeSec: CARDS_TURN_TIME_SEC,
      },
      gameState,
      turnSecondsLeft,
      roomAccessories,
      lastEmote,
      createRoom: () => {},
      joinRoom: () => {},
      leaveRoom,
      updateMyProfile: () => {},
      updateRoomSettings: () => {},
      startOnlineMatch: () => {},
      returnToLobby: () => {},
      sendPlayCard: (cardId: string, options?: PlayOptions) =>
        dispatchAction({ action: 'play', cardId, options }),
      sendDrawCard: () => dispatchAction({ action: 'draw' }),
      sendCallPaws: () => dispatchAction({ action: 'call_paws' }),
      sendCatchPaws: (targetPlayerId: string) =>
        dispatchAction({ action: 'catch_paws', targetPlayerId }),
      sendEmote: (emote: string, text: string) => {
        const evt: EmoteEvent = {
          peerId: myPeerId,
          emote,
          text,
          at: Date.now(),
        };
        sendGameEvent('cards_emote', evt);
      },
    }),
    [
      configured,
      connectionStatus,
      dispatchAction,
      error,
      gameState,
      hostId,
      isHost,
      lastEmote,
      leaveRoom,
      myPeerId,
      roomAccessories,
      roomCode,
      roster,
      sendGameEvent,
      turnSecondsLeft,
    ],
  );

  if (!gameState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a100b] text-amber-200">
        <div className="text-sm font-black">Đang chia bài PAWS Cards (0 Bot)...</div>
      </div>
    );
  }

  return (
    <OnlineGame3DScreen
      room={cardsController}
      onBackToMenu={leaveRoom}
      embeddedEvent={true}
    />
  );
}
