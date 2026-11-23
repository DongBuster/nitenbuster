import type { CardData, CardType, GameState } from './types.ts';

const WILD_TYPES = new Set<CardType>([
  'taser',
  'banana',
  'bomb',
  'egg',
  'potion',
]);

export function isWildCard(type: CardType): boolean {
  return WILD_TYPES.has(type);
}

export function getTopCard(state: GameState): CardData | undefined {
  if (state.discardPile.length === 0) return undefined;
  return state.discardPile[state.discardPile.length - 1];
}

export function isPlayable(card: CardData, state: GameState): boolean {
  if (state.winnerId !== null) return false;

  // Under stacked Shovel draw penalty: only another Shovel (to stack) or Potion (to deflect)
  if (state.pending?.kind === 'draw') {
    return card.type === 'shovel' || card.type === 'potion';
  }

  // Wild cards are always playable
  if (isWildCard(card.type) || !card.color) {
    return true;
  }

  // Match active color
  if (card.color === state.currentColor) {
    return true;
  }

  // Match top card type (and value for basic number cards)
  const topCard = getTopCard(state);
  if (topCard && card.type === topCard.type) {
    if (card.type !== 'basic') {
      return true;
    }
    return card.value !== undefined && card.value === topCard.value;
  }

  return false;
}

export function getPlayableCards(
  hand: CardData[],
  state: GameState,
): CardData[] {
  return hand.filter((card) => isPlayable(card, state));
}

export function needsColorChoice(type: CardType): boolean {
  return (
    type === 'taser' ||
    type === 'banana' ||
    type === 'bomb' ||
    type === 'egg' ||
    type === 'potion'
  );
}

export function needsTargetChoice(type: CardType): boolean {
  return type === 'crossbow';
}
