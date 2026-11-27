import type { AnimalId, BotDifficulty, GameDeckMode } from '../engine/types.ts';
import {
  DEFAULT_UNLOCKED_ACCESSORIES,
  normalizeAccessories,
  type AccessorySelection,
} from '../scene3d/accessoryCatalog.ts';
import { calculateCookieReward } from '../blockblast/engine/game.ts';
import { verifyMatchReceipt, type MatchReceipt } from '../blockblast/engine/verify.ts';
import {
  ALL_PLAYABLE_STAGE_KEYS,
  COOP_MAP_IDS,
  DEFAULT_COOP_MAP_ID,
  calculateCoopLevelResult,
  calculateCoopResult,
  getCoopLevelMeta,
  getCoopMapMeta,
  getCoopMapPack,
  getDefaultMapPackId,
  getUnlockedLevelForPack,
  isCoopLevelNumber,
  isCoopMapId,
  isNewCoopBest,
  makeCoopStageKey,
  type CoopLevelNumber,
  type CoopMapId,
  type CoopMapRecord,
} from '../coop/maps/registry.ts';
import { getEventCookieReward } from '../event/scoring.ts';
import { getSurvivalMapMeta, isSurvivalMapId } from '../survival/sim/maps.ts';
import type { SurvivalMapId } from '../survival/sim/types.ts';

export const MAX_COOKIES = 1_000_000;
export const MAX_BLOCK_BLAST_SCORE = 10_000_000;
export const MAX_GAMES = 1_000_000;
export const MAX_SETTLED_MATCH_IDS = 20;
export const MAX_GLASS_TIME_SEC = 86_400;

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
  glassBestTimeSec: number | null;
  glassBestStars: number;
  coopRecords: Partial<Record<CoopMapId, CoopMapRecord>>;
  coopLevelRecords: Record<string, CoopMapRecord>;
  survivalBestScore: number;
  survivalBestTimeSec: number;
  survivalWins: number;
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

export interface GlassSettlementResult {
  nextProfile: PlayerProfile;
  ok: boolean;
  reward: number;
  stars: 1 | 2 | 3;
  isNewBest: boolean;
}

export interface CoopSettlementResult {
  nextProfile: PlayerProfile;
  ok: boolean;
  mapId: CoopMapId;
  mapPackId: string;
  level: CoopLevelNumber;
  stageKey: string;
  reward: number;
  stars: 1 | 2 | 3;
  isNewBest: boolean;
  unlockedNextLevel: CoopLevelNumber | null;
}

export interface EventSettlementResult {
  nextProfile: PlayerProfile;
  ok: boolean;
  reward: number;
}

export interface SurvivalSettlementResult {
  nextProfile: PlayerProfile;
  ok: boolean;
  reward: number;
  isNewBestScore: boolean;
  isNewBestTime: boolean;
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
  glassBestTimeSec: null,
  glassBestStars: 0,
  coopRecords: {},
  coopLevelRecords: {},
  survivalBestScore: 0,
  survivalBestTimeSec: 0,
  survivalWins: 0,
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

function sanitizeCoopRecordEntry(entry: unknown): CoopMapRecord | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;

  const rec = entry as Record<string, unknown>;
  if (typeof rec.bestStars !== 'number' || !Number.isFinite(rec.bestStars)) {
    return null;
  }
  const flooredStars = Math.floor(rec.bestStars);
  if (flooredStars < 1) return null;
  const bestStars = Math.min(3, flooredStars);

  if (
    typeof rec.bestTimeSec !== 'number' ||
    !Number.isFinite(rec.bestTimeSec) ||
    rec.bestTimeSec <= 0
  ) {
    return null;
  }
  const bestTimeSec = Math.min(
    MAX_GLASS_TIME_SEC,
    Math.round(rec.bestTimeSec * 100) / 100,
  );
  if (bestTimeSec <= 0) return null;

  return { bestStars, bestTimeSec };
}

function sanitizeCoopRecords(raw: unknown): Partial<Record<CoopMapId, CoopMapRecord>> {
  const out: Partial<Record<CoopMapId, CoopMapRecord>> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return out;
  }

  const rawMap = raw as Record<string, unknown>;
  for (const mapId of COOP_MAP_IDS) {
    if (!Object.hasOwn(rawMap, mapId)) continue;
    const cleaned = sanitizeCoopRecordEntry(rawMap[mapId]);
    if (cleaned) {
      out[mapId] = cleaned;
    }
  }

  return out;
}

function sanitizeCoopLevelRecords(raw: unknown): Record<string, CoopMapRecord> {
  const out: Record<string, CoopMapRecord> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return out;
  }

  const rawMap = raw as Record<string, unknown>;
  for (const stageKey of ALL_PLAYABLE_STAGE_KEYS) {
    if (!Object.hasOwn(rawMap, stageKey)) continue;
    const cleaned = sanitizeCoopRecordEntry(rawMap[stageKey]);
    if (cleaned) {
      out[stageKey] = cleaned;
    }
  }

  return out;
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

  const glassBestTimeSec =
    typeof safeRaw.glassBestTimeSec === 'number' &&
    Number.isFinite(safeRaw.glassBestTimeSec) &&
    safeRaw.glassBestTimeSec > 0
      ? Math.min(
          MAX_GLASS_TIME_SEC,
          Math.round(safeRaw.glassBestTimeSec * 100) / 100,
        )
      : null;

  const coopRecords = sanitizeCoopRecords(safeRaw.coopRecords);
  const coopLevelRecords = sanitizeCoopLevelRecords(safeRaw.coopLevelRecords);
  let glassBestStars = clampNonNegInt(safeRaw.glassBestStars, 3, 0);
  let syncedGlassBestTimeSec = glassBestTimeSec;

  if (
    !coopRecords.glass_carry &&
    glassBestStars > 0 &&
    syncedGlassBestTimeSec !== null
  ) {
    coopRecords.glass_carry = {
      bestStars: glassBestStars,
      bestTimeSec: syncedGlassBestTimeSec,
    };
  } else if (coopRecords.glass_carry) {
    if (glassBestStars === 0) {
      glassBestStars = coopRecords.glass_carry.bestStars;
      syncedGlassBestTimeSec = coopRecords.glass_carry.bestTimeSec;
    } else if (syncedGlassBestTimeSec === null) {
      syncedGlassBestTimeSec = coopRecords.glass_carry.bestTimeSec;
    }
  }

  for (const actionId of COOP_MAP_IDS) {
    const defaultL1Key = makeCoopStageKey(
      actionId,
      getDefaultMapPackId(actionId),
      1,
    );
    const actionRec = coopRecords[actionId];
    const levelRec = coopLevelRecords[defaultL1Key];

    if (actionRec && !levelRec) {
      coopLevelRecords[defaultL1Key] = { ...actionRec };
    } else if (levelRec && !actionRec) {
      coopRecords[actionId] = { ...levelRec };
      if (actionId === 'glass_carry') {
        if (glassBestStars === 0) {
          glassBestStars = levelRec.bestStars;
          syncedGlassBestTimeSec = levelRec.bestTimeSec;
        } else if (syncedGlassBestTimeSec === null) {
          syncedGlassBestTimeSec = levelRec.bestTimeSec;
        }
      }
    }
  }

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
    glassBestTimeSec: syncedGlassBestTimeSec,
    glassBestStars,
    coopRecords,
    coopLevelRecords,
    survivalBestScore: clampNonNegInt(
      safeRaw.survivalBestScore,
      MAX_BLOCK_BLAST_SCORE,
      0,
    ),
    survivalBestTimeSec: clampNonNegInt(
      safeRaw.survivalBestTimeSec,
      MAX_GLASS_TIME_SEC,
      0,
    ),
    survivalWins: clampNonNegInt(safeRaw.survivalWins, MAX_GAMES, 0),
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

export function settleCoopMatch(
  profile: PlayerProfile,
  payload: {
    matchId: string;
    mapId: CoopMapId;
    mapPackId?: string;
    level?: CoopLevelNumber;
    elapsedSec: number;
    failures: number;
  },
): CoopSettlementResult {
  const safeMapId =
    payload && typeof payload === 'object' && isCoopMapId(payload.mapId)
      ? payload.mapId
      : DEFAULT_COOP_MAP_ID;
  const fallbackPack = getCoopMapPack(
    safeMapId,
    payload && typeof payload === 'object' && typeof payload.mapPackId === 'string'
      ? payload.mapPackId
      : undefined,
  );
  const safeLevel: CoopLevelNumber =
    payload && typeof payload === 'object' && isCoopLevelNumber(payload.level)
      ? payload.level
      : 1;
  const fail: CoopSettlementResult = {
    nextProfile: profile,
    ok: false,
    mapId: safeMapId,
    mapPackId: fallbackPack.id,
    level: safeLevel,
    stageKey: makeCoopStageKey(safeMapId, fallbackPack.id, safeLevel),
    reward: 0,
    stars: 1,
    isNewBest: false,
    unlockedNextLevel: null,
  };

  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.matchId !== 'string' ||
    payload.matchId.trim().length < 4 ||
    payload.matchId.length > 80 ||
    !isCoopMapId(payload.mapId) ||
    (payload.mapPackId !== undefined &&
      (typeof payload.mapPackId !== 'string' ||
        !getCoopMapMeta(payload.mapId).maps.some(
          (p) => p.id === payload.mapPackId,
        ))) ||
    (payload.level !== undefined && !isCoopLevelNumber(payload.level)) ||
    typeof payload.elapsedSec !== 'number' ||
    !Number.isFinite(payload.elapsedSec) ||
    payload.elapsedSec <= 0 ||
    payload.elapsedSec > MAX_GLASS_TIME_SEC ||
    typeof payload.failures !== 'number' ||
    !Number.isFinite(payload.failures) ||
    payload.failures < 0 ||
    payload.failures > 10_000
  ) {
    return fail;
  }

  const pack = getCoopMapPack(payload.mapId, payload.mapPackId);
  const levelMeta = getCoopLevelMeta(
    payload.mapId,
    pack.id,
    payload.level ?? 1,
  );
  if (levelMeta.comingSoon) {
    return fail;
  }

  if (profile.settledMatchIds.includes(payload.matchId)) {
    return fail;
  }

  const prevUnlocked = getUnlockedLevelForPack(
    profile.coopLevelRecords,
    payload.mapId,
    pack.id,
  );
  const isExplicitStage =
    payload.mapPackId !== undefined || payload.level !== undefined;
  const cleanFailures = Math.floor(payload.failures);
  const res = isExplicitStage
    ? calculateCoopLevelResult(
        payload.mapId,
        pack.id,
        levelMeta.level,
        payload.elapsedSec,
        cleanFailures,
      )
    : calculateCoopResult(payload.mapId, payload.elapsedSec, cleanFailures);

  const roundedElapsedSec = Math.max(
    0.01,
    Math.min(
      MAX_GLASS_TIME_SEC,
      Math.round(payload.elapsedSec * 100) / 100,
    ),
  );

  const existingActionRecord =
    profile.coopRecords?.[payload.mapId] ??
    (payload.mapId === 'glass_carry' &&
    profile.glassBestStars > 0 &&
    profile.glassBestTimeSec !== null
      ? {
          bestStars: profile.glassBestStars,
          bestTimeSec: profile.glassBestTimeSec,
        }
      : undefined);

  const isDefaultPackL1 =
    levelMeta.level === 1 && pack.id === getDefaultMapPackId(payload.mapId);
  const existingLevelRecord =
    profile.coopLevelRecords?.[levelMeta.key] ??
    (isDefaultPackL1 ? existingActionRecord : undefined);

  const isNewBest = isNewCoopBest(
    existingLevelRecord,
    roundedElapsedSec,
    res.stars,
  );
  const nextLevelBestStars = existingLevelRecord
    ? Math.max(existingLevelRecord.bestStars, res.stars)
    : res.stars;
  const nextLevelBestTimeSec = existingLevelRecord
    ? Math.min(existingLevelRecord.bestTimeSec, roundedElapsedSec)
    : roundedElapsedSec;

  const nextLevelRecords: Record<string, CoopMapRecord> = {
    ...profile.coopLevelRecords,
    [levelMeta.key]: {
      bestStars: nextLevelBestStars,
      bestTimeSec: nextLevelBestTimeSec,
    },
  };

  const nextUnlocked = getUnlockedLevelForPack(
    nextLevelRecords,
    payload.mapId,
    pack.id,
  );
  const unlockedNextLevel: CoopLevelNumber | null =
    nextUnlocked > prevUnlocked ? nextUnlocked : null;

  const nextActionBestStars = existingActionRecord
    ? Math.max(existingActionRecord.bestStars, res.stars)
    : res.stars;
  const nextActionBestTimeSec = existingActionRecord
    ? Math.min(existingActionRecord.bestTimeSec, roundedElapsedSec)
    : roundedElapsedSec;

  const nextCoopRecords: Partial<Record<CoopMapId, CoopMapRecord>> = {
    ...profile.coopRecords,
    [payload.mapId]: {
      bestStars: nextActionBestStars,
      bestTimeSec: nextActionBestTimeSec,
    },
  };

  const nextGamesPlayed = Math.min(MAX_GAMES, profile.gamesPlayed + 1);
  const nextGamesWon = Math.min(
    nextGamesPlayed,
    Math.min(MAX_GAMES, profile.gamesWon + 1),
  );
  const nextSettled = [...profile.settledMatchIds, payload.matchId].slice(
    -MAX_SETTLED_MATCH_IDS,
  );

  const nextProfile: PlayerProfile = {
    ...profile,
    cookies: Math.min(MAX_COOKIES, profile.cookies + res.cookies),
    gamesPlayed: nextGamesPlayed,
    gamesWon: nextGamesWon,
    glassBestStars:
      payload.mapId === 'glass_carry'
        ? Math.max(profile.glassBestStars, nextActionBestStars)
        : profile.glassBestStars,
    glassBestTimeSec:
      payload.mapId === 'glass_carry'
        ? profile.glassBestTimeSec === null
          ? nextActionBestTimeSec
          : Math.min(profile.glassBestTimeSec, nextActionBestTimeSec)
        : profile.glassBestTimeSec,
    coopRecords: nextCoopRecords,
    coopLevelRecords: nextLevelRecords,
    settledMatchIds: nextSettled,
  };

  return {
    nextProfile,
    ok: true,
    mapId: payload.mapId,
    mapPackId: pack.id,
    level: levelMeta.level,
    stageKey: levelMeta.key,
    reward: res.cookies,
    stars: res.stars,
    isNewBest,
    unlockedNextLevel,
  };
}

export function settleGlassCarryMatch(
  profile: PlayerProfile,
  payload: { matchId: string; elapsedSec: number; shatters: number },
): GlassSettlementResult {
  const res = settleCoopMatch(profile, {
    matchId: payload?.matchId,
    mapId: 'glass_carry',
    elapsedSec: payload?.elapsedSec,
    failures: payload?.shatters,
  });

  return {
    nextProfile: res.nextProfile,
    ok: res.ok,
    reward: res.reward,
    stars: res.stars,
    isNewBest: res.isNewBest,
  };
}

export function settleEventMatch(
  profile: PlayerProfile,
  payload: { matchId: string; rank: number; totalPlayers: number },
): EventSettlementResult {
  const fail: EventSettlementResult = {
    nextProfile: profile,
    ok: false,
    reward: 0,
  };

  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.matchId !== 'string' ||
    payload.matchId.trim().length < 4 ||
    payload.matchId.length > 80 ||
    !Number.isSafeInteger(payload.rank) ||
    payload.rank < 1 ||
    payload.rank > 8 ||
    !Number.isSafeInteger(payload.totalPlayers) ||
    payload.totalPlayers < 2 ||
    payload.totalPlayers > 8 ||
    payload.rank > payload.totalPlayers
  ) {
    return fail;
  }

  if (profile.settledMatchIds.includes(payload.matchId)) {
    return fail;
  }

  const reward = getEventCookieReward(payload.rank);
  const nextGamesPlayed = Math.min(MAX_GAMES, profile.gamesPlayed + 1);
  const nextGamesWon = Math.min(
    nextGamesPlayed,
    profile.gamesWon + (payload.rank === 1 ? 1 : 0),
  );
  const nextSettled = [...profile.settledMatchIds, payload.matchId].slice(
    -MAX_SETTLED_MATCH_IDS,
  );

  const nextProfile: PlayerProfile = {
    ...profile,
    cookies: Math.min(MAX_COOKIES, profile.cookies + reward),
    gamesPlayed: nextGamesPlayed,
    gamesWon: nextGamesWon,
    settledMatchIds: nextSettled,
  };

  return {
    nextProfile,
    ok: true,
    reward,
  };
}

export function settleSurvivalMatch(
  profile: PlayerProfile,
  payload: {
    matchId: string;
    mapId: SurvivalMapId;
    victory: boolean;
    score: number;
    elapsedSec: number;
    endlessContinuation?: boolean;
  },
): SurvivalSettlementResult {
  const fail: SurvivalSettlementResult = {
    nextProfile: profile,
    ok: false,
    reward: 0,
    isNewBestScore: false,
    isNewBestTime: false,
  };

  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.matchId !== 'string' ||
    payload.matchId.trim().length < 4 ||
    payload.matchId.length > 80 ||
    !isSurvivalMapId(payload.mapId) ||
    typeof payload.victory !== 'boolean' ||
    (payload.endlessContinuation !== undefined &&
      typeof payload.endlessContinuation !== 'boolean') ||
    typeof payload.score !== 'number' ||
    !Number.isFinite(payload.score) ||
    payload.score < 0 ||
    typeof payload.elapsedSec !== 'number' ||
    !Number.isFinite(payload.elapsedSec) ||
    payload.elapsedSec < 0
  ) {
    return fail;
  }

  if (profile.settledMatchIds.includes(payload.matchId)) {
    return fail;
  }

  const cleanScore = Math.min(MAX_BLOCK_BLAST_SCORE, Math.floor(payload.score));
  const cleanElapsed = Math.min(
    MAX_GLASS_TIME_SEC,
    Math.floor(payload.elapsedSec),
  );

  const mapMeta = getSurvivalMapMeta(payload.mapId);
  const cookieMult = mapMeta.cookieMultiplier;
  const isEndlessContinuation = payload.endlessContinuation === true;
  const isCampaignEndlessContinuation =
    isEndlessContinuation && payload.mapId !== 'endless_abyss';
  const effectiveVictory =
    payload.victory &&
    payload.mapId !== 'endless_abyss' &&
    !isEndlessContinuation;

  let reward: number;
  if (effectiveVictory) {
    const baseReward = Math.min(
      120,
      60 + Math.floor(Math.max(0, cleanElapsed - 360) / 60) * 10,
    );
    reward = Math.round(baseReward * cookieMult);
  } else if (isCampaignEndlessContinuation) {
    // Base +60*cookieMult victory Cookies & win counters were already settled at Campaign Victory;
    // award only the incremental Endless bonus delta up to the scaled 120*cookieMult run cap.
    const totalBase = Math.min(
      120,
      60 + Math.floor(Math.max(0, cleanElapsed - 360) / 60) * 10,
    );
    reward = Math.max(
      0,
      Math.round(totalBase * cookieMult) - Math.round(60 * cookieMult),
    );
  } else {
    const raw =
      Math.floor(cleanScore / 400) + Math.floor(cleanElapsed / 30) * 4;
    const baseReward =
      cleanElapsed >= 20
        ? Math.min(100, Math.max(5, raw))
        : Math.min(100, raw);
    reward = Math.round(baseReward * cookieMult);
  }

  const isNewBestScore =
    cleanScore > profile.survivalBestScore && cleanScore > 0;
  const isNewBestTime =
    cleanElapsed > profile.survivalBestTimeSec && cleanElapsed > 0;

  const nextGamesPlayed = Math.min(
    MAX_GAMES,
    profile.gamesPlayed + (isCampaignEndlessContinuation ? 0 : 1),
  );
  const nextGamesWon = Math.min(
    nextGamesPlayed,
    profile.gamesWon + (effectiveVictory ? 1 : 0),
  );
  const nextSurvivalWins = Math.min(
    MAX_GAMES,
    profile.survivalWins + (effectiveVictory ? 1 : 0),
  );
  const nextSettled = [...profile.settledMatchIds, payload.matchId].slice(
    -MAX_SETTLED_MATCH_IDS,
  );

  const nextProfile: PlayerProfile = {
    ...profile,
    cookies: Math.min(MAX_COOKIES, profile.cookies + reward),
    gamesPlayed: nextGamesPlayed,
    gamesWon: nextGamesWon,
    survivalWins: nextSurvivalWins,
    survivalBestScore: Math.max(profile.survivalBestScore, cleanScore),
    survivalBestTimeSec: Math.max(profile.survivalBestTimeSec, cleanElapsed),
    settledMatchIds: nextSettled,
  };

  return {
    nextProfile,
    ok: true,
    reward,
    isNewBestScore,
    isNewBestTime,
  };
}
