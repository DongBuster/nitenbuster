import { useCallback, useEffect, useState } from 'react';
import type { AnimalId, BotDifficulty, GameDeckMode } from '../engine/types';
import { setAudioPreferences } from '../audio/soundEngine';

const STORAGE_KEY = 'paws_3d_profile_v1';

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  price: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'scarf',
    name: 'Khăn Len Mùa Đông',
    icon: '🧣',
    description: 'Khăn len ấm áp phong cách Winter Cabin cực dễ thương.',
    price: 60,
  },
  {
    id: 'glasses',
    name: 'Kính Râm Siêu Ngầu',
    icon: '🕶️',
    description: 'Phong thái cao thủ đánh bài không để lộ cảm xúc.',
    price: 80,
  },
  {
    id: 'party_hat',
    name: 'Mũ Tiệc Lễ Hội',
    icon: '🥳',
    description: 'Mũ chóp sặc sỡ mang lại may mắn khi rút bài.',
    price: 90,
  },
  {
    id: 'crown',
    name: 'Vương Miện Quán Quân',
    icon: '👑',
    description: 'Vương miện vàng lấp lánh dành cho nhà vô địch PAWS.',
    price: 150,
  },
];

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
  equippedAccessory: Partial<Record<AnimalId, string | null>>;
  settings: ProfileSettings;
}

const DEFAULT_PROFILE: PlayerProfile = {
  cookies: 100,
  gamesPlayed: 0,
  gamesWon: 0,
  selectedAnimal: 'dog',
  unlockedAccessories: [],
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

const VALID_ANIMALS: AnimalId[] = [
  'dog',
  'cat',
  'duck',
  'shark',
  'dino',
  'panda',
  'chicken',
  'bunny',
];

function loadProfile(): PlayerProfile {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_PROFILE;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const selectedAnimal =
      parsed.selectedAnimal && VALID_ANIMALS.includes(parsed.selectedAnimal)
        ? parsed.selectedAnimal
        : DEFAULT_PROFILE.selectedAnimal;

    return {
      cookies:
        typeof parsed.cookies === 'number' && Number.isFinite(parsed.cookies)
          ? Math.max(0, Math.floor(parsed.cookies))
          : DEFAULT_PROFILE.cookies,
      gamesPlayed:
        typeof parsed.gamesPlayed === 'number' && parsed.gamesPlayed >= 0
          ? Math.floor(parsed.gamesPlayed)
          : 0,
      gamesWon:
        typeof parsed.gamesWon === 'number' && parsed.gamesWon >= 0
          ? Math.floor(parsed.gamesWon)
          : 0,
      selectedAnimal,
      unlockedAccessories: Array.isArray(parsed.unlockedAccessories)
        ? parsed.unlockedAccessories.filter((x): x is string => typeof x === 'string')
        : [],
      equippedAccessory:
        parsed.equippedAccessory && typeof parsed.equippedAccessory === 'object'
          ? parsed.equippedAccessory
          : {},
      settings: {
        ...DEFAULT_PROFILE.settings,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

let currentProfile: PlayerProfile = loadProfile();
const listeners = new Set<() => void>();

function persistAndNotify(next: PlayerProfile): void {
  currentProfile = next;
  setAudioPreferences({
    sfxEnabled: next.settings.sfxEnabled,
    bgmEnabled: next.settings.bgmEnabled,
  });
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota / storage errors
    }
  }
  listeners.forEach((fn) => fn());
}

export function useProfileStore() {
  const [profile, setProfile] = useState<PlayerProfile>(() => currentProfile);

  useEffect(() => {
    setAudioPreferences({
      sfxEnabled: currentProfile.settings.sfxEnabled,
      bgmEnabled: currentProfile.settings.bgmEnabled,
    });
    const onUpdate = () => setProfile(currentProfile);
    listeners.add(onUpdate);
    return () => {
      listeners.delete(onUpdate);
    };
  }, []);

  const selectAnimal = useCallback((animal: AnimalId) => {
    persistAndNotify({
      ...currentProfile,
      selectedAnimal: animal,
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<ProfileSettings>) => {
    persistAndNotify({
      ...currentProfile,
      settings: {
        ...currentProfile.settings,
        ...patch,
      },
    });
  }, []);

  const recordMatchResult = useCallback((won: boolean): number => {
    const reward = won ? 50 : 15;
    persistAndNotify({
      ...currentProfile,
      cookies: currentProfile.cookies + reward,
      gamesPlayed: currentProfile.gamesPlayed + 1,
      gamesWon: currentProfile.gamesWon + (won ? 1 : 0),
    });
    return reward;
  }, []);

  const buyAccessory = useCallback((id: string): boolean => {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (!item) return false;
    if (currentProfile.unlockedAccessories.includes(id)) return false;
    if (currentProfile.cookies < item.price) return false;

    persistAndNotify({
      ...currentProfile,
      cookies: currentProfile.cookies - item.price,
      unlockedAccessories: [...currentProfile.unlockedAccessories, id],
    });
    return true;
  }, []);

  const equipAccessory = useCallback((animal: AnimalId, id: string | null) => {
    if (id !== null && !currentProfile.unlockedAccessories.includes(id)) {
      return;
    }
    persistAndNotify({
      ...currentProfile,
      equippedAccessory: {
        ...currentProfile.equippedAccessory,
        [animal]: id,
      },
    });
  }, []);

  return {
    ...profile,
    profile,
    selectAnimal,
    updateSettings,
    recordMatchResult,
    buyAccessory,
    equipAccessory,
  };
}
