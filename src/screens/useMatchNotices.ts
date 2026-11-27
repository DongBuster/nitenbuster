import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, Player } from '../engine/types.ts';
import type { PawsShoutInfo } from '../components/Modals/PawsShoutOverlay.tsx';

export const PENALTY_NOTICE_DURATION_MS = 2800;
export const PAWS_SHOUT_DURATION_MS = 1700;

export interface PenaltyNoticeInfo {
  key: string;
  message: string;
}

export interface ComputePenaltyNoticeInput {
  gameState: GameState;
  prevHandLength: number | null;
  currHandLength: number;
}

/**
 * Compute a penalty/extra-cards toast message when the local player's hand grows
 * from a notable card effect or penalty, or null when no toast should appear.
 */
export function computePenaltyNoticeMessage({
  gameState,
  prevHandLength,
  currHandLength,
}: ComputePenaltyNoticeInput): string | null {
  if (
    prevHandLength === null ||
    gameState.turnCount === 0 ||
    gameState.winnerId !== null ||
    currHandLength <= prevHandLength
  ) {
    return null;
  }

  const delta = currHandLength - prevHandLength;
  const latestLog =
    gameState.logs.length > 0
      ? gameState.logs[gameState.logs.length - 1]
      : null;
  const reason = gameState.lastEffectBanner ?? latestLog?.text ?? '';
  if (!reason) {
    return null;
  }

  // Bombs always deal +4 cards; ignore a +1 normal draw on a turn another player exploded.
  if (reason.includes('BÙM!') && delta < 4) {
    return null;
  }

  const isNotableEvent =
    delta >= 2 ||
    latestLog?.type === 'penalty' ||
    reason.includes('Nỏ Thần') ||
    reason.includes('PAWS') ||
    reason.includes('Bom') ||
    reason.includes('Vỏ Chuối') ||
    reason.includes('Tia Chớp') ||
    reason.includes('hết giờ') ||
    reason.includes('Bot đi hộ');

  return isNotableEvent ? `+${delta} lá — ${reason}` : null;
}

/**
 * Return the first player who newly called PAWS relative to previously seen caller IDs.
 */
export function findNewlyCalledPawsPlayer(
  players: readonly Player[],
  prevCalledIds: ReadonlySet<string>,
): Player | null {
  return players.find((p) => p.calledPaws && !prevCalledIds.has(p.id)) ?? null;
}

export interface UseMatchNoticesOptions {
  gameState: GameState | null;
  humanPlayer: Player | null;
  onPawsShout?: (player: Player) => void;
}

/**
 * Manage transient penalty and PAWS shout notices with isolated auto-dismiss timers
 * so subsequent turn updates never cancel active dismissal timeouts.
 */
export function useMatchNotices({
  gameState,
  humanPlayer,
  onPawsShout,
}: UseMatchNoticesOptions) {
  const [penaltyNotice, setPenaltyNotice] = useState<PenaltyNoticeInfo | null>(
    null,
  );
  const [pawsShout, setPawsShout] = useState<PawsShoutInfo | null>(null);

  const prevHandLenRef = useRef<number | null>(null);
  const prevCalledPawsRef = useRef<Set<string> | null>(null);
  const noticeSeqRef = useRef(0);
  const onPawsShoutRef = useRef(onPawsShout);
  onPawsShoutRef.current = onPawsShout;

  useEffect(() => {
    if (!gameState || !humanPlayer) {
      prevHandLenRef.current = null;
      setPenaltyNotice(null);
      return;
    }

    const prevLen = prevHandLenRef.current;
    const currLen = humanPlayer.hand.length;
    prevHandLenRef.current = currLen;

    if (gameState.turnCount === 0 || gameState.winnerId !== null) {
      setPenaltyNotice(null);
      return;
    }

    const message = computePenaltyNoticeMessage({
      gameState,
      prevHandLength: prevLen,
      currHandLength: currLen,
    });
    if (message) {
      noticeSeqRef.current += 1;
      setPenaltyNotice({
        key: `${gameState.turnCount}-${noticeSeqRef.current}`,
        message,
      });
    }
  }, [gameState, humanPlayer]);

  useEffect(() => {
    if (!penaltyNotice) return;
    const timer = window.setTimeout(() => {
      setPenaltyNotice(null);
    }, PENALTY_NOTICE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [penaltyNotice]);

  useEffect(() => {
    if (!gameState) {
      prevCalledPawsRef.current = null;
      setPawsShout(null);
      return;
    }

    const currentSet = new Set(
      gameState.players.filter((p) => p.calledPaws).map((p) => p.id),
    );

    if (prevCalledPawsRef.current === null) {
      prevCalledPawsRef.current = currentSet;
      return;
    }

    const newlyCalled = findNewlyCalledPawsPlayer(
      gameState.players,
      prevCalledPawsRef.current,
    );
    prevCalledPawsRef.current = currentSet;

    if (gameState.turnCount === 0 || gameState.winnerId !== null) {
      setPawsShout(null);
      return;
    }

    if (newlyCalled) {
      onPawsShoutRef.current?.(newlyCalled);
      noticeSeqRef.current += 1;
      setPawsShout({
        key: `${gameState.turnCount}-${newlyCalled.id}-${noticeSeqRef.current}`,
        playerName: newlyCalled.name,
        animal: newlyCalled.animal,
      });
    }
  }, [gameState]);

  useEffect(() => {
    if (!pawsShout) return;
    const timer = window.setTimeout(() => {
      setPawsShout(null);
    }, PAWS_SHOUT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [pawsShout]);

  const clearNotices = useCallback(() => {
    setPenaltyNotice(null);
    setPawsShout(null);
  }, []);

  return {
    penaltyNotice: penaltyNotice?.message ?? null,
    pawsShout,
    clearNotices,
  };
}
