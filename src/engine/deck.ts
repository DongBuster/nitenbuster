import {
  COLORS,
  type CardData,
  type GameDeckMode,
  type GameState,
} from './types.ts';

/**
 * Mulberry32 deterministic PRNG when seed is provided; falls back to Math.random.
 */
export function createSeededRng(seed?: number): () => number {
  if (seed === undefined) {
    return () => Math.random();
  }
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Creates a fresh PAWS card deck.
 * - 'mvp': 4 colors × (basic 0×1, 1..9×2, freeze×2, boomerang×2, shovel×2, arrow×1) + wilds (banana×4, taser×4) = 112 cards
 * - 'full': adds crossbow×1 per color (+4) + wilds (egg×2, bomb×2, potion×2) (+6) = 122 cards
 */
export function createDeck(mode: GameDeckMode = 'full'): CardData[] {
  const deck: CardData[] = [];
  let seq = 1;
  const nextId = (prefix: string) => `${prefix}-${seq++}`;

  for (const color of COLORS) {
    // Basic 0 × 1
    deck.push({ id: nextId(`basic-${color}-0`), type: 'basic', color, value: 0 });

    // Basic 1..9 × 2
    for (let value = 1; value <= 9; value++) {
      deck.push({ id: nextId(`basic-${color}-${value}`), type: 'basic', color, value });
      deck.push({ id: nextId(`basic-${color}-${value}`), type: 'basic', color, value });
    }

    // Action colored cards: freeze ×2, boomerang ×2, shovel ×2, arrow ×1
    for (let i = 0; i < 2; i++) {
      deck.push({ id: nextId(`freeze-${color}`), type: 'freeze', color });
      deck.push({ id: nextId(`boomerang-${color}`), type: 'boomerang', color });
      deck.push({ id: nextId(`shovel-${color}`), type: 'shovel', color });
    }
    deck.push({ id: nextId(`arrow-${color}`), type: 'arrow', color });

    if (mode === 'full') {
      deck.push({ id: nextId(`crossbow-${color}`), type: 'crossbow', color });
    }
  }

  // Wild cards (MVP: banana ×4, taser ×4)
  for (let i = 0; i < 4; i++) {
    deck.push({ id: nextId('banana'), type: 'banana' });
    deck.push({ id: nextId('taser'), type: 'taser' });
  }

  if (mode === 'full') {
    for (let i = 0; i < 2; i++) {
      deck.push({ id: nextId('egg'), type: 'egg' });
      deck.push({ id: nextId('bomb'), type: 'bomb' });
      deck.push({ id: nextId('potion'), type: 'potion' });
    }
  }

  return deck;
}

/**
 * Pure Fisher-Yates shuffle returning a new array.
 */
export function shuffleDeck(cards: CardData[], seed?: number): CardData[] {
  const rng = createSeededRng(seed);
  const result = cards.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/**
 * Card conservation invariant helper: total cards across drawPile, discardPile, and all hands.
 */
export function totalCardsInState(state: GameState): number {
  const handsTotal = state.players.reduce((sum, p) => sum + p.hand.length, 0);
  return state.drawPile.length + state.discardPile.length + handsTotal;
}
