export type AnimalId =
  | 'dog'
  | 'cat'
  | 'duck'
  | 'shark'
  | 'dino'
  | 'panda'
  | 'chicken'
  | 'bunny';

export type Emotion = 'idle' | 'happy' | 'sad' | 'shock' | 'win';

export type Color = 'pink' | 'blue' | 'green' | 'yellow';

export type CardType =
  | 'basic'
  | 'arrow'
  | 'freeze'
  | 'boomerang'
  | 'shovel'
  | 'taser'
  | 'banana'
  | 'bomb'
  | 'egg'
  | 'crossbow'
  | 'potion';

export interface CardData {
  id: string;
  type: CardType;
  color?: Color;
  value?: number;
  trapped?: boolean;
}

export interface AnimalMeta {
  id: AnimalId;
  name: string;
  colorLabel: string;
  accentHex: string;
  personality: string;
}

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export type GameDeckMode = 'mvp' | 'full';

export interface Player {
  id: string;
  name: string;
  animal: AnimalId;
  isBot: boolean;
  hand: CardData[];
  emotion: Emotion;
  calledPaws: boolean;
  quip?: string | null;
}

export type PendingEffect =
  | { kind: 'draw'; count: number; source: 'shovel' }
  | null;

export interface BombState {
  fuse: number;
  color: Color;
  ownerId: string;
}

export interface GameLogEntry {
  id: string;
  text: string;
  type: 'play' | 'draw' | 'effect' | 'penalty' | 'win';
}

export interface PlayOptions {
  chosenColor?: Color;
  targetPlayerId?: string;
  seed?: number;
}

export interface GameState {
  players: Player[];
  drawPile: CardData[];
  discardPile: CardData[];
  direction: 1 | -1;
  currentIndex: number;
  currentColor: Color;
  pending: PendingEffect;
  activeBomb: BombState | null;
  winnerId: string | null;
  logs: GameLogEntry[];
  turnCount: number;
  deckMode: GameDeckMode;
  difficulty: BotDifficulty;
  lastEffectBanner?: string | null;
}

export const ANIMALS: AnimalMeta[] = [
  {
    id: 'dog',
    name: 'Chó Corgi',
    colorLabel: 'Nâu vàng',
    accentHex: '#F59E0B',
    personality: 'Hiền lành, nhiệt tình',
  },
  {
    id: 'cat',
    name: 'Mèo Xám',
    colorLabel: 'Xám',
    accentHex: '#64748B',
    personality: 'Kiêu kỳ, lém lỉnh',
  },
  {
    id: 'duck',
    name: 'Vịt Trắng',
    colorLabel: 'Trắng/vàng',
    accentHex: '#FBBF24',
    personality: 'Ồn ào, vui tính',
  },
  {
    id: 'shark',
    name: 'Cá Mập',
    colorLabel: 'Xanh dương',
    accentHex: '#3B82F6',
    personality: 'Ngầu nhưng dễ thương',
  },
  {
    id: 'dino',
    name: 'Khủng Long',
    colorLabel: 'Xanh lá',
    accentHex: '#22C55E',
    personality: 'Ham ăn, thân thiện',
  },
  {
    id: 'panda',
    name: 'Panda',
    colorLabel: 'Trắng/đen',
    accentHex: '#374151',
    personality: 'Lười nhưng may mắn',
  },
  {
    id: 'chicken',
    name: 'Gà Trắng',
    colorLabel: 'Trắng/cam',
    accentHex: '#FB7185',
    personality: 'Năng động, hay giật mình',
  },
  {
    id: 'bunny',
    name: 'Thỏ Trắng',
    colorLabel: 'Trắng/hồng',
    accentHex: '#F472B6',
    personality: 'Nhút nhát, đáng yêu',
  },
];

export const EMOTIONS: Emotion[] = ['idle', 'happy', 'sad', 'shock', 'win'];

export const COLORS: Color[] = ['pink', 'blue', 'green', 'yellow'];
