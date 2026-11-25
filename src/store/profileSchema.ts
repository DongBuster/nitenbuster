import type { AnimalId, BotDifficulty, GameDeckMode } from '../engine/types.ts';
import {
  DEFAULT_UNLOCKED_ACCESSORIES,
  normalizeAccessories,
  type AccessorySelection,
} from '../scene3d/accessoryCatalog.ts';

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
  selectedAnimal: AnimalId;
  unlockedAccessories: string[];
  equippedAccessory: Partial<Record<AnimalId, string[]>>;
  settings: ProfileSettings;
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

export function sanitizeProfileData(
  raw: Record<string, unknown>,
): PlayerProfile {
  const selectedAnimal =
    typeof raw.selectedAnimal === 'string' &&
    VALID_ANIMALS.includes(raw.selectedAnimal as AnimalId)
      ? (raw.selectedAnimal as AnimalId)
      : DEFAULT_PROFILE.selectedAnimal;

  const rawUnlocked = Array.isArray(raw.unlockedAccessories)
    ? raw.unlockedAccessories.filter((x): x is string => typeof x === 'string')
    : [];
  const unlockedSet = new Set<string>([
    ...DEFAULT_UNLOCKED_ACCESSORIES,
    ...rawUnlocked,
  ]);

  const equippedAccessory: Partial<Record<AnimalId, string[]>> = {};
  if (raw.equippedAccessory && typeof raw.equippedAccessory === 'object') {
    const rawMap = raw.equippedAccessory as Record<string, unknown>;
    for (const animal of VALID_ANIMALS) {
      const normalized = normalizeAccessories(rawMap[animal] as AccessorySelection);
      if (normalized.length > 0) {
        equippedAccessory[animal] = normalized;
      }
    }
  }

  const rawSettings =
    raw.settings && typeof raw.settings === 'object'
      ? (raw.settings as Partial<ProfileSettings>)
      : {};

  return {
    cookies:
      typeof raw.cookies === 'number' && Number.isFinite(raw.cookies)
        ? Math.max(0, Math.floor(raw.cookies))
        : DEFAULT_PROFILE.cookies,
    gamesPlayed:
      typeof raw.gamesPlayed === 'number' && raw.gamesPlayed >= 0
        ? Math.floor(raw.gamesPlayed)
        : 0,
    gamesWon:
      typeof raw.gamesWon === 'number' && raw.gamesWon >= 0
        ? Math.floor(raw.gamesWon)
        : 0,
    selectedAnimal,
    unlockedAccessories: Array.from(unlockedSet),
    equippedAccessory,
    settings: {
      ...DEFAULT_PROFILE.settings,
      ...rawSettings,
    },
  };
}
