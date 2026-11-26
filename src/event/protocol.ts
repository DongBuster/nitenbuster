import type { AnimalId } from '../engine/types.ts';

export type EventGameId = 'cards' | 'blockblast' | 'brawl' | 'glassCarry';

export type EventPhase =
  | 'idle'
  | 'lobby'
  | 'roundIntro'
  | 'playing'
  | 'roundResult'
  | 'finalPodium';

export const ALL_EVENT_GAMES: readonly EventGameId[] = [
  'cards',
  'blockblast',
  'brawl',
  'glassCarry',
] as const;

export const EVENT_MIN_PLAYERS = 2;
export const EVENT_MAX_PLAYERS = 8;
export const EVENT_INTRO_DURATION_SEC = 5;

export const EVENT_TIME_LIMIT_BOUNDS: Record<
  EventGameId,
  { min: number; max: number; step: number; defaultSec: number }
> = {
  cards: { min: 90, max: 300, step: 15, defaultSec: 180 },
  blockblast: { min: 60, max: 240, step: 15, defaultSec: 120 },
  brawl: { min: 45, max: 180, step: 15, defaultSec: 90 },
  glassCarry: { min: 90, max: 300, step: 15, defaultSec: 150 },
};

export interface EventGameMeta {
  id: EventGameId;
  title: string;
  shortTitle: string;
  tagline: string;
  tieBreakSummary: string;
  bannerWebp: string;
  bannerJpg: string;
  accentColor: string;
  badgeClass: string;
}

export const EVENT_GAME_META: Record<EventGameId, EventGameMeta> = {
  cards: {
    id: 'cards',
    title: 'PAWS Cards 3D',
    shortTitle: 'Đấu Bài',
    tagline: 'Đấu bài chiến thuật kiểu UNO — 0 Bot, toàn người thật.',
    tieBreakSummary: 'Hết bài trước → Ít lá trên tay nhất → Tổng điểm bài thấp hơn.',
    bannerWebp: '/banners/paws-cards-banner.webp',
    bannerJpg: '/banners/paws-cards-banner.jpg',
    accentColor: '#F59E0B',
    badgeClass: 'border-amber-400/40 bg-amber-500/20 text-amber-200',
  },
  blockblast: {
    id: 'blockblast',
    title: 'Block Blast PAWS',
    shortTitle: 'Xếp Khối',
    tagline: 'Chung một seed khối gạch 8×8, đua điểm số cao nhất trước khi hết giờ.',
    tieBreakSummary: 'Điểm cao nhất → Số hàng xóa nhiều hơn → Thời gian trụ lâu hơn.',
    bannerWebp: '/banners/block-blast-banner.webp',
    bannerJpg: '/banners/block-blast-banner.jpg',
    accentColor: '#10B981',
    badgeClass: 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200',
  },
  brawl: {
    id: 'brawl',
    title: 'Brawl Arena 3D',
    shortTitle: 'Hỗn Chiến',
    tagline: 'Đẩy nhau khỏi sàn băng lục giác sụp dần trong thời gian thực.',
    tieBreakSummary: 'Trụ sàn cuối cùng → Nếu hết giờ: Balance cao hơn → Gần tâm sàn hơn.',
    bannerWebp: '/banners/brawl-arena-banner.webp',
    bannerJpg: '/banners/brawl-arena-banner.jpg',
    accentColor: '#38BDF8',
    badgeClass: 'border-sky-400/40 bg-sky-500/20 text-sky-200',
  },
  glassCarry: {
    id: 'glassCarry',
    title: 'Glass Carry',
    shortTitle: 'Khiêng Kính',
    tagline: 'Chia cặp 2 người đua tốc độ qua 5 chặng cầu kính (lẻ người tự cân bằng).',
    tieBreakSummary: 'Về đích nhanh nhất → % chặng xa nhất → Số lần vỡ kính ít nhất.',
    bannerWebp: '/banners/glass-carry-banner.webp',
    bannerJpg: '/banners/glass-carry-banner.jpg',
    accentColor: '#22D3EE',
    badgeClass: 'border-cyan-400/40 bg-cyan-500/20 text-cyan-200',
  },
};

export interface EventSettings {
  games: EventGameId[];
  timeLimits: Record<EventGameId, number>;
  brawlRounds: 1 | 2 | 3;
  autoAdvanceSec: 0 | 10;
}

export const DEFAULT_EVENT_SETTINGS: EventSettings = {
  games: ['cards', 'blockblast', 'brawl', 'glassCarry'],
  timeLimits: {
    cards: EVENT_TIME_LIMIT_BOUNDS.cards.defaultSec,
    blockblast: EVENT_TIME_LIMIT_BOUNDS.blockblast.defaultSec,
    brawl: EVENT_TIME_LIMIT_BOUNDS.brawl.defaultSec,
    glassCarry: EVENT_TIME_LIMIT_BOUNDS.glassCarry.defaultSec,
  },
  brawlRounds: 2,
  autoAdvanceSec: 10,
};

export interface EventMember {
  peerId: string;
  name: string;
  animal: AnimalId;
  accessory: string[];
  isHost: boolean;
  ready: boolean;
  joinedAt: number;
}

export interface GlassPairAssignment {
  pairId: string;
  mode: 'pair' | 'solo';
  memberIds: string[];
  subChannelCode: string;
}

export interface EventRoundConfig {
  roundIndex: number;
  totalRounds: number;
  gameId: EventGameId;
  roundId: string;
  seed: number;
  timeLimitSec: number;
  brawlRounds: 1 | 2 | 3;
  introEndsAtMs: number;
  roundDeadlineMs: number;
  glassPairs: GlassPairAssignment[];
}

export interface EventRoundPlayerResult {
  peerId: string;
  rank: number;
  pointsAwarded: number;
  metricLabel: string;
}

export interface EventRoundSummary {
  roundIndex: number;
  gameId: EventGameId;
  aborted?: boolean;
  reason?: string;
  results: EventRoundPlayerResult[];
}

export interface EventStanding {
  peerId: string;
  name: string;
  animal: AnimalId;
  accessory: string[];
  joinedAt: number;
  totalPoints: number;
  firstPlaces: number;
  lastRoundRank: number;
  roundPoints: Partial<Record<number, number>>;
}

export interface EventStateBroadcast {
  seq: number;
  hostId: string;
  eventMatchId: string;
  phase: EventPhase;
  settings: EventSettings;
  roster: EventMember[];
  currentRound: EventRoundConfig | null;
  roundHistory: EventRoundSummary[];
  standings: EventStanding[];
  resultAdvanceAtMs: number;
  notice?: string;
}

export interface EventConfigBroadcast {
  hostId: string;
  settings: EventSettings;
}

function isValidEventGameId(value: unknown): value is EventGameId {
  return (
    value === 'cards' ||
    value === 'blockblast' ||
    value === 'brawl' ||
    value === 'glassCarry'
  );
}

function clampTimeLimit(gameId: EventGameId, raw: unknown): number {
  const bounds = EVENT_TIME_LIMIT_BOUNDS[gameId];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return bounds.defaultSec;
  }
  return Math.max(bounds.min, Math.min(bounds.max, Math.round(raw)));
}

export function sanitizeEventSettings(raw: Partial<EventSettings> | null | undefined): EventSettings {
  const input = raw && typeof raw === 'object' ? raw : {};

  const seen = new Set<EventGameId>();
  const games: EventGameId[] = [];
  if (Array.isArray(input.games)) {
    for (const g of input.games) {
      if (isValidEventGameId(g) && !seen.has(g)) {
        seen.add(g);
        games.push(g);
      }
    }
  }

  const rawLimits =
    input.timeLimits && typeof input.timeLimits === 'object'
      ? input.timeLimits
      : ({} as Partial<Record<EventGameId, number>>);

  const timeLimits: Record<EventGameId, number> = {
    cards: clampTimeLimit('cards', rawLimits.cards),
    blockblast: clampTimeLimit('blockblast', rawLimits.blockblast),
    brawl: clampTimeLimit('brawl', rawLimits.brawl),
    glassCarry: clampTimeLimit('glassCarry', rawLimits.glassCarry),
  };

  const brawlRounds: 1 | 2 | 3 =
    input.brawlRounds === 1 || input.brawlRounds === 2 || input.brawlRounds === 3
      ? input.brawlRounds
      : DEFAULT_EVENT_SETTINGS.brawlRounds;

  const autoAdvanceSec: 0 | 10 =
    input.autoAdvanceSec === 0 || input.autoAdvanceSec === 10
      ? input.autoAdvanceSec
      : DEFAULT_EVENT_SETTINGS.autoAdvanceSec;

  return {
    games: games.length > 0 ? games : [...DEFAULT_EVENT_SETTINGS.games],
    timeLimits,
    brawlRounds,
    autoAdvanceSec,
  };
}
