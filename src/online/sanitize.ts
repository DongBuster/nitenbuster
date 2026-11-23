import type { CardData, GameState, Player } from '../engine/types.ts';
import type { PublicGameState, PublicPlayer } from './protocol.ts';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 5): string {
  const safeLen = Math.max(1, Math.min(8, Math.floor(length)));
  let code = '';
  for (let i = 0; i < safeLen; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[idx];
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw
    .replace(/[\s-]+/g, '')
    .toUpperCase()
    .slice(0, 6);
}

export function sanitizeStateForBroadcast(state: GameState): PublicGameState {
  const { players, drawPile, ...rest } = state;

  const publicPlayers: PublicPlayer[] = players.map(({ hand, ...playerRest }) => ({
    ...playerRest,
    handCount: hand.length,
  }));

  return {
    ...rest,
    players: publicPlayers,
    drawPileCount: drawPile.length,
  };
}

function makeHiddenCards(prefix: string, count: number): CardData[] {
  const safeCount = Math.max(0, Math.floor(count));
  const cards: CardData[] = [];
  for (let i = 0; i < safeCount; i++) {
    cards.push({
      id: `${prefix}-${i}`,
      type: 'basic',
    });
  }
  return cards;
}

export function reconstructClientGameState(
  publicState: PublicGameState,
  myPeerId: string,
  myHand: CardData[]
): GameState {
  const { players, drawPileCount, ...rest } = publicState;

  const reconstructedPlayers: Player[] = players.map(({ handCount, ...playerRest }) => ({
    ...playerRest,
    hand:
      playerRest.id === myPeerId
        ? myHand.slice()
        : makeHiddenCards(`hidden-${playerRest.id}`, handCount),
  }));

  return {
    ...rest,
    players: reconstructedPlayers,
    drawPile: makeHiddenCards('hidden-draw', drawPileCount),
  };
}
