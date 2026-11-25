import type { AnimalId, BotDifficulty, GameDeckMode } from '../engine/types.ts';
import {
  DEFAULT_UNLOCKED_ACCESSORIES,
  normalizeAccessories,
  type AccessorySelection,
} from '../scene3d/accessoryCatalog.ts';
import { calculateCookieReward } from '../blockblast/engine/game.ts';
import { verifyMatchReceipt, type MatchReceipt } from '../blockblast/engine/verify.ts';

export const MAX_COOKIES = 1_000_000;
export const MAX_BLOCK_BLAST_SCORE = 10_000_000;
export const MAX_GAMES = 1_000_000;
export const MAX_SETTLED_MATCH_IDS = 20;

export interface ProfileSettings {
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  colorblindMode: boolean;
  reducedMotion: boolean;
  botCount: number;
  difficulty: BotDifficulty;
  deckMode: GameDeckMode;
}

export interface PlayerProfile {
  cookies: number;
  gamesPlayed: number;
  gamesWon: number;
  blockBlastBestScore: number;
  settledMatchIds: string[];
  selectedAnimal: AnimalId;
  unlockedAccessories: string[];
  equippedAccessory: Partial<Record<AnimalId, string[]>>;
  settings: ProfileSettings;
}

export interface BlockBlastSettlementResult {
  nextProfile: PlayerProfile;
  ok: boolean;
  reward: number;
  isNewBest: boolean;
  verifiedScore: number;
}

export const VALID_ANIMALS: AnimalId[] = [
  'dog',
  'cat',
  'duck',
  'shark',
  'dino',
  'panda',
  'chicken',
  'bunny',
];

export const DEFAULT_PROFILE: PlayerProfile = {
  cookies: 100,
  gamesPlayed: 0,
  gamesWon: 0,
  blockBlastBestScore: 0,
  settledMatchIds: [],
  selectedAnimal: 'dog',
  unlockedAccessories: [...DEFAULT_UNLOCKED_ACCESSORIES],
  equippedAccessory: {},
  settings: {
    sfxEnabled: true,
    bgmEnabled: false,
    colorblindMode: false,
    reducedMotion: false,
    botCount: 3,
    difficulty: 'medium',
    deckMode: 'full',
  },
};

function clampNonNegInt(val: unknown, max: number, fallback: number): number {
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
    return Math.min(max, Math.floor(val));
  }
  return fallback;
}

function sanitizeSettledMatchIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (item.trim().length < 4 || item.length > 80) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out.slice(-MAX_SETTLED_MATCH_IDS);
}

function sanitizeSettings(raw: unknown): ProfileSettings {
  const rawSettings =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    sfxEnabled:
      typeof rawSettings.sfxEnabled === 'boolean'
        ? rawSettings.sfxEnabled
        : DEFAULT_PROFILE.settings.sfxEnabled,
    bgmEnabled:
      typeof rawSettings.bgmEnabled === 'boolean'
        ? rawSettings.bgmEnabled
        : DEFAULT_PROFILE.settings.bgmEnabled,
    colorblindMode:
      typeof rawSettings.colorblindMode === 'boolean'
        ? rawSettings.colorblindMode
        : DEFAULT_PROFILE.settings.colorblindMode,
    reducedMotion:
      typeof rawSettings.reducedMotion === 'boolean'
        ? rawSettings.reducedMotion
        : DEFAULT_PROFILE.settings.reducedMotion,
    botCount:
      typeof rawSettings.botCount === 'number' && Number.isFinite(rawSettings.botCount)
        ? Math.min(7, Math.max(1, Math.floor(rawSettings.botCount)))
        : DEFAULT_PROFILE.settings.botCount,
    difficulty:
      rawSettings.difficulty === 'easy' ||
      rawSettings.difficulty === 'medium' ||
      rawSettings.difficulty === 'hard'
        ? rawSettings.difficulty
        : DEFAULT_PROFILE.settings.difficulty,
    deckMode:
      rawSettings.deckMode === 'mvp' || rawSettings.deckMode === 'full'
        ? rawSettings.deckMode
        : DEFAULT_PROFILE.settings.deckMode,
  };
}

export function sanitizeProfileData(
  raw: Record<string, unknown>,
): PlayerProfile {
  const safeRaw =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

  const selectedAnimal =
    typeof safeRaw.selectedAnimal === 'string' &&
    VALID_ANIMALS.includes(safeRaw.selectedAnimal as AnimalId)
      ? (safeRaw.selectedAnimal as AnimalId)
      : DEFAULT_PROFILE.selectedAnimal;

  const rawUnlocked = Array.isArray(safeRaw.unlockedAccessories)
    ? safeRaw.unlockedAccessories.filter((x): x is string => typeof x === 'string')
    : [];
  const unlockedSet = new Set<string>([
    ...DEFAULT_UNLOCKED_ACCESSORIES,
    ...rawUnlocked,
  ]);

  const equippedAccessory: Partial<Record<AnimalId, string[]>> = {};
  if (
    safeRaw.equippedAccessory &&
    typeof safeRaw.equippedAccessory === 'object' &&
    !Array.isArray(safeRaw.equippedAccessory)
  ) {
    const rawMap = safeRaw.equippedAccessory as Record<string, unknown>;
    for (const animal of VALID_ANIMALS) {
      if (!Object.hasOwn(rawMap, animal)) continue;
      const normalized = normalizeAccessories(rawMap[animal] as AccessorySelection);
      if (normalized.length > 0) {
        equippedAccessory[animal] = normalized;
      }
    }
  }

  const gamesPlayed = clampNonNegInt(safeRaw.gamesPlayed, MAX_GAMES, 0);
  const gamesWon = Math.min(
    gamesPlayed,
    clampNonNegInt(safeRaw.gamesWon, MAX_GAMES, 0),
  );

  return {
    cookies: clampNonNegInt(
      safeRaw.cookies,
      MAX_COOKIES,
      DEFAULT_PROFILE.cookies,
    ),
    gamesPlayed,
    gamesWon,
    blockBlastBestScore: clampNonNegInt(
      safeRaw.blockBlastBestScore,
      MAX_BLOCK_BLAST_SCORE,
      0,
    ),
    settledMatchIds: sanitizeSettledMatchIds(safeRaw.settledMatchIds),
    selectedAnimal,
    unlockedAccessories: Array.from(unlockedSet),
    equippedAccessory,
    settings: sanitizeSettings(safeRaw.settings),
  };
}

export function settleBlockBlastMatch(
  profile: PlayerProfile,
  receipt: MatchReceipt,
  authorizedBombCount: number,
): BlockBlastSettlementResult {
  const fail: BlockBlastSettlementResult = {
    nextProfile: profile,
    ok: false,
    reward: 0,
    isNewBest: false,
    verifiedScore: 0,
  };

  if (!receipt || typeof receipt !== 'object' || typeof receipt.matchId !== 'string') {
    return fail;
  }
  if (profile.settledMatchIds.includes(receipt.matchId)) {
    return fail;
  }
  if (
    !Number.isSafeInteger(authorizedBombCount) ||
    authorizedBombCount < 0 ||
    !Number.isSafeInteger(receipt.bombPaidCount) ||
    receipt.bombPaidCount > authorizedBombCount
  ) {
    return fail;
  }

  const verified = verifyMatchReceipt(receipt);
  if (!verified.valid) {
    return fail;
  }

  const { reward, isNewBest } = calculateCookieReward(
    verified.verifiedScore,
    profile.blockBlastBestScore,
  );
  const nextSettled = [...profile.settledMatchIds, receipt.matchId].slice(
    -MAX_SETTLED_MATCH_IDS,
  );
  const nextGamesPlayed = Math.min(MAX_GAMES, profile.gamesPlayed + 1);
  const nextGamesWon = Math.min(
    nextGamesPlayed,
    profile.gamesWon + (isNewBest ? 1 : 0),
  );

  const nextProfile: PlayerProfile = {
    ...profile,
    cookies: Math.min(MAX_COOKIES, profile.cookies + reward),
    blockBlastBestScore: Math.min(
      MAX_BLOCK_BLAST_SCORE,
      Math.max(profile.blockBlastBestScore, verified.verifiedScore),
    ),
    gamesPlayed: nextGamesPlayed,
    gamesWon: nextGamesWon,
    settledMatchIds: nextSettled,
  };

  return {
    nextProfile,
    ok: true,
    reward,
    isNewBest,
    verifiedScore: verified.verifiedScore,
  };
}
