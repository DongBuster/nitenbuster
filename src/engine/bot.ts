import { createSeededRng } from './deck.ts';
import { getPlayableCards, needsColorChoice, needsTargetChoice } from './rules.ts';
import type {
  AnimalId,
  BotDifficulty,
  CardData,
  CardType,
  Color,
  GameState,
  PlayOptions,
  Player,
} from './types.ts';

export type BotAction =
  | { action: 'play'; cardId: string; options: PlayOptions; quip: string }
  | { action: 'draw'; quip: string };

const ALL_COLORS: readonly Color[] = ['pink', 'blue', 'green', 'yellow'];

const ATTACK_TYPES: ReadonlySet<CardType> = new Set([
  'shovel',
  'taser',
  'banana',
  'bomb',
  'crossbow',
  'freeze',
]);

const WILD_TYPES: ReadonlySet<CardType> = new Set([
  'taser',
  'banana',
  'bomb',
  'egg',
  'potion',
]);

interface QuipSet {
  play: readonly string[];
  attack: readonly string[];
  draw: readonly string[];
}

const ANIMAL_QUIPS: Record<AnimalId, QuipSet> = {
  dog: {
    play: ['Gâu gâu! Đánh lá này nha!', 'Chơi vui quá, tới lượt bạn kìa!'],
    attack: ['Xin lỗi bạn nhưng mà... nhận chiêu nè!', 'Corgi tung chiêu, đỡ đi bạn ơi!'],
    draw: ['Ủa hết bài ghép rồi, rút nhẹ một lá!', 'Rút bài thôi, lát nữa lật kèo!'],
  },
  cat: {
    play: ['Meo... quá dễ đối với ta.', 'Thả nhẹ một lá, nhìn cho kỹ nhé.'],
    attack: ['Hừm, tặng ngươi chút rắc rối nè.', 'Mèo ta không nương tay đâu nhé!'],
    draw: ['Chậc, phải rút thêm bài rồi.', 'Rút một lá cho có lệ thôi...'],
  },
  duck: {
    play: ['Quạc quạc! Lá này cực hợp luôn!', 'Vịt ra bài đây, tránh đường nào!'],
    attack: ['QUẠC QUẠC! Nhận quà bất ngờ nè!', 'Đỡ cú này đi bạn hiền ơi!'],
    draw: ['Quạc... xui ghê, phải rút rồi!', 'Rút bài nạp năng lượng quạc!'],
  },
  shark: {
    play: ['Cá mập lướt nhẹ một lá.', 'Ngầu chưa? Tới lượt tiếp theo!'],
    attack: ['Cắn nhẹ một phát cho tỉnh ngủ nè!', 'Hàm cá mập tung chiêu!'],
    draw: ['Lặn xuống rút thêm một lá vậy.', 'Tạm rút, lát nữa săn mồi tiếp!'],
  },
  dino: {
    play: ['Roar~ Khủng long thả bài đây!', 'Lá này nhìn ngon lành quá!'],
    attack: ['Dậm chân cái rầm! Nhận bài đi nhé!', 'Khủng long nổi giận rồi đó nha!'],
    draw: ['Hic, rút thêm bài ăn tạm vậy...', 'Không có lá hợp, rút thôi!'],
  },
  panda: {
    play: ['Ngáp... thả đại lá này cũng trúng.', 'Lười nghĩ quá, đánh luôn cho khỏe.'],
    attack: ['Xin lỗi nha, tay lỡ bấm trúng lá phạt~', 'Hên quá có lá này để tặng bạn!'],
    draw: ['Rút thêm lá rồi ngủ tiếp...', 'Thôi rút bài, khỏi phải suy nghĩ.'],
  },
  chicken: {
    play: ['Cục tác! Đánh nhanh không kịp nghĩ!', 'Ôi may quá có lá hợp màu!'],
    attack: ['Á á á tung chiêu phòng thủ nè!', 'Cục tác! Đừng giận gà nha!'],
    draw: ['Ối giời ơi phải rút bài rồi!', 'Hết đường rồi, rút gấp rút gấp!'],
  },
  bunny: {
    play: ['Thỏ... thỏ xin phép đánh lá này ạ.', 'Nhẹ nhàng đặt một lá xuống nè~'],
    attack: ['Đừng ghét thỏ nhé, thỏ phải đánh lá này...', 'Xin lỗi bạn nhiều lắm luôn!'],
    draw: ['Huhu phải rút thêm bài rồi...', 'Thỏ rút một lá ngoan ngoãn nè.'],
  },
};

function pickFrom<T>(items: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * items.length) % items.length;
  return items[idx];
}

function getNextPlayerIndex(state: GameState): number {
  const n = state.players.length;
  return (state.currentIndex + state.direction + n) % n;
}

function countHandColors(hand: readonly CardData[], excludeCardId?: string): Record<Color, number> {
  const counts: Record<Color, number> = { pink: 0, blue: 0, green: 0, yellow: 0 };
  for (const card of hand) {
    if (card.id === excludeCardId) continue;
    if (card.color) {
      counts[card.color] += 1;
    }
  }
  return counts;
}

function chooseBestColor(
  hand: readonly CardData[],
  excludeCardId: string,
  difficulty: BotDifficulty,
  rng: () => number
): Color {
  if (difficulty === 'easy') {
    return pickFrom(ALL_COLORS, rng);
  }
  const counts = countHandColors(hand, excludeCardId);
  let bestColor: Color = ALL_COLORS[0];
  let bestCount = -1;
  for (const color of ALL_COLORS) {
    const score = counts[color] + (difficulty === 'hard' ? rng() * 0.25 : rng() * 0.1);
    if (score > bestCount) {
      bestCount = score;
      bestColor = color;
    }
  }
  return bestColor;
}

function chooseCrossbowTarget(
  state: GameState,
  botId: string,
  difficulty: BotDifficulty,
  rng: () => number
): string {
  const opponents = state.players.filter((p) => p.id !== botId);
  if (opponents.length === 0) return botId;

  if (difficulty === 'easy') {
    return pickFrom(opponents, rng).id;
  }

  // Medium & Hard: target opponent with the fewest cards (tie-break by next player / RNG)
  const nextId = state.players[getNextPlayerIndex(state)]?.id;
  const sorted = [...opponents].sort((a, b) => {
    if (a.hand.length !== b.hand.length) return a.hand.length - b.hand.length;
    if (a.id === nextId) return -1;
    if (b.id === nextId) return 1;
    return rng() - 0.5;
  });
  return sorted[0].id;
}

function scoreCard(
  card: CardData,
  state: GameState,
  bot: Player,
  difficulty: BotDifficulty,
  rng: () => number
): number {
  const nextPlayer = state.players[getNextPlayerIndex(state)];
  const nextLow = nextPlayer && nextPlayer.hand.length <= 3;
  const anyCritical = state.players.some((p) => p.id !== bot.id && p.hand.length <= 2);
  const isWild = WILD_TYPES.has(card.type);
  const isAttack = ATTACK_TYPES.has(card.type);

  let score = 10;

  // Always prefer shedding the last card immediately to win
  if (bot.hand.length === 1) {
    return 1000;
  }

  // If facing a pending Shovel draw penalty, prefer Shovel over Potion on hard (save Potion)
  if (state.pending?.kind === 'draw') {
    if (card.type === 'shovel') return 90;
    if (card.type === 'potion') return difficulty === 'hard' ? 75 : 85;
  }

  if (isWild) {
    // Save wilds when colored cards are available, unless opponent is about to win
    score = anyCritical && isAttack ? 55 : 4;
    if (card.type === 'potion' && difficulty === 'hard') {
      // Hold potion as defensive shield unless it's the only option
      score = 1;
    }
  } else {
    // Colored cards: prefer matching color & shedding high-value or action cards
    if (isAttack) {
      score = nextLow || anyCritical ? 70 : 28;
    } else if (card.type === 'boomerang') {
      score = nextLow ? 45 : 22;
    } else if (card.type === 'arrow') {
      score = 26;
    } else {
      // Basic number card: shed higher numbers slightly earlier on hard
      score = 20 + (difficulty === 'hard' ? (card.value ?? 0) * 0.6 : 0);
    }
  }

  // Hard mode: if bot holds multiple cards of card.color, slight bonus to keep color momentum
  if (difficulty === 'hard' && card.color) {
    const colorCounts = countHandColors(bot.hand, card.id);
    score += colorCounts[card.color] * 2;
  }

  return score + rng() * 1.5;
}

export function chooseBotAction(state: GameState, seed?: number): BotAction {
  const bot = state.players[state.currentIndex];
  const rng = createSeededRng(seed ?? (state.turnCount * 9973 + state.currentIndex * 31 + 17));
  const quips = ANIMAL_QUIPS[bot.animal] ?? ANIMAL_QUIPS.dog;

  const playable = getPlayableCards(bot.hand, state);
  if (playable.length === 0) {
    return {
      action: 'draw',
      quip: pickFrom(quips.draw, rng),
    };
  }

  let chosen: CardData;
  if (state.difficulty === 'easy') {
    chosen = pickFrom(playable, rng);
  } else {
    let bestCard = playable[0];
    let bestScore = -Infinity;
    for (const card of playable) {
      const s = scoreCard(card, state, bot, state.difficulty, rng);
      if (s > bestScore) {
        bestScore = s;
        bestCard = card;
      }
    }
    chosen = bestCard;
  }

  const options: PlayOptions = {};
  if (needsColorChoice(chosen.type)) {
    options.chosenColor = chooseBestColor(bot.hand, chosen.id, state.difficulty, rng);
  }
  if (needsTargetChoice(chosen.type)) {
    options.targetPlayerId = chooseCrossbowTarget(state, bot.id, state.difficulty, rng);
  }
  if (seed !== undefined) {
    options.seed = seed + 1;
  }

  const isAttack = ATTACK_TYPES.has(chosen.type);
  return {
    action: 'play',
    cardId: chosen.id,
    options,
    quip: pickFrom(isAttack ? quips.attack : quips.play, rng),
  };
}

export function shouldBotCallPaws(
  player: Player,
  difficulty: BotDifficulty,
  seed?: number
): boolean {
  if (player.calledPaws) return false;
  if (player.hand.length < 1 || player.hand.length > 2) return false;
  if (difficulty === 'hard') return true;

  const rng = createSeededRng(seed ?? (player.hand.length * 131 + player.name.length * 17));
  if (difficulty === 'medium') return rng() < 0.8;
  return rng() < 0.4;
}
