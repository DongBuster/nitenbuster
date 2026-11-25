import { useCallback, useEffect, useState } from 'react';
import type { AnimalId } from '../engine/types';
import { setAudioPreferences } from '../audio/soundEngine';
import {
  SHOP_ITEMS,
  toggleSlotAccessory,
  type ShopItem,
} from '../scene3d/accessoryCatalog';
import {
  DEFAULT_PROFILE,
  sanitizeProfileData,
  type PlayerProfile,
  type ProfileSettings,
} from './profileSchema';

export { SHOP_ITEMS, type PlayerProfile, type ProfileSettings, type ShopItem };

const STORAGE_KEY = 'paws_3d_profile_v1';

function loadProfile(): PlayerProfile {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_PROFILE;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PROFILE;
    return sanitizeProfileData(parsed as Record<string, unknown>);
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

  const recordBrawlResult = useCallback((rank: number): number => {
    const reward = rank === 1 ? 40 : rank === 2 ? 25 : rank === 3 ? 15 : 5;
    persistAndNotify({
      ...currentProfile,
      cookies: currentProfile.cookies + reward,
      gamesPlayed: currentProfile.gamesPlayed + 1,
      gamesWon: currentProfile.gamesWon + (rank === 1 ? 1 : 0),
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
    const nextLoadout =
      id === null
        ? []
        : toggleSlotAccessory(currentProfile.equippedAccessory[animal], id);

    persistAndNotify({
      ...currentProfile,
      equippedAccessory: {
        ...currentProfile.equippedAccessory,
        [animal]: nextLoadout,
      },
    });
  }, []);

  const clearAccessories = useCallback((animal: AnimalId) => {
    persistAndNotify({
      ...currentProfile,
      equippedAccessory: {
        ...currentProfile.equippedAccessory,
        [animal]: [],
      },
    });
  }, []);

  return {
    ...profile,
    profile,
    selectAnimal,
    updateSettings,
    recordMatchResult,
    recordBrawlResult,
    buyAccessory,
    equipAccessory,
    clearAccessories,
  };
}
