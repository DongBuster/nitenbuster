import { useCallback, useEffect, useState } from 'react';
import type { AnimalId } from '../engine/types.ts';
import { setAudioPreferences } from '../audio/soundEngine.ts';
import { CANDY_BOMB_COST } from '../blockblast/engine/types.ts';
import type { MatchReceipt } from '../blockblast/engine/verify.ts';
import {
  SHOP_ITEMS,
  toggleSlotAccessory,
  type ShopItem,
} from '../scene3d/accessoryCatalog.ts';
import type { CoopMapId, CoopMapRecord } from '../coop/maps/registry.ts';
import { unwrapSignedProfile, wrapSignedProfile } from './profileIntegrity.ts';
import {
  DEFAULT_PROFILE,
  sanitizeProfileData,
  settleBlockBlastMatch,
  settleCoopMatch,
  settleEventMatch,
  settleGlassCarryMatch,
  type BlockBlastSettlementResult,
  type CoopSettlementResult,
  type EventSettlementResult,
  type GlassSettlementResult,
  type PlayerProfile,
  type ProfileSettings,
} from './profileSchema.ts';

export {
  SHOP_ITEMS,
  settleBlockBlastMatch,
  settleCoopMatch,
  settleEventMatch,
  settleGlassCarryMatch,
  type BlockBlastSettlementResult,
  type CoopMapRecord,
  type CoopSettlementResult,
  type EventSettlementResult,
  type GlassSettlementResult,
  type PlayerProfile,
  type ProfileSettings,
  type ShopItem,
};

const STORAGE_KEY = 'paws_3d_profile_v1';
const MAX_AUTHORIZED_BOMB_ENTRIES = 50;

let integrityTampered = false;
const authorizedBombsByMatchId = new Map<string, number>();

function writeSignedProfile(profile: PlayerProfile): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, wrapSignedProfile(profile));
  } catch {
    // Ignore quota / storage errors
  }
}

function loadProfile(): PlayerProfile {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_PROFILE;
  }

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_PROFILE;
  }

  const unwrapped = unwrapSignedProfile(raw);
  if (unwrapped.status === 'empty') {
    return DEFAULT_PROFILE;
  }
  if (unwrapped.status === 'legacy_v1' && unwrapped.data) {
    const migrated = sanitizeProfileData(unwrapped.data);
    writeSignedProfile(migrated);
    return migrated;
  }
  if (unwrapped.status === 'valid_v2' && unwrapped.data) {
    return sanitizeProfileData(unwrapped.data);
  }

  integrityTampered = true;
  writeSignedProfile(DEFAULT_PROFILE);
  return DEFAULT_PROFILE;
}

let currentProfile: PlayerProfile = loadProfile();
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((fn) => fn());
}

function persistAndNotify(next: PlayerProfile): void {
  const sanitized = sanitizeProfileData(
    next as unknown as Record<string, unknown>,
  );
  currentProfile = sanitized;
  setAudioPreferences({
    sfxEnabled: sanitized.settings.sfxEnabled,
    bgmEnabled: sanitized.settings.bgmEnabled,
  });
  writeSignedProfile(sanitized);
  notifyListeners();
}

export function useProfileStore() {
  const [profile, setProfile] = useState<PlayerProfile>(() => currentProfile);
  const [integrityWarning, setIntegrityWarning] = useState<boolean>(
    () => integrityTampered,
  );

  useEffect(() => {
    setAudioPreferences({
      sfxEnabled: currentProfile.settings.sfxEnabled,
      bgmEnabled: currentProfile.settings.bgmEnabled,
    });
    const onUpdate = () => {
      setProfile(currentProfile);
      setIntegrityWarning(integrityTampered);
    };
    listeners.add(onUpdate);
    onUpdate();
    return () => {
      listeners.delete(onUpdate);
    };
  }, []);

  const dismissIntegrityWarning = useCallback(() => {
    if (!integrityTampered) return;
    integrityTampered = false;
    notifyListeners();
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

  const spendBlockBlastBomb = useCallback((matchId: string): boolean => {
    if (
      typeof matchId !== 'string' ||
      matchId.trim().length < 4 ||
      matchId.length > 80
    ) {
      return false;
    }
    if (currentProfile.settledMatchIds.includes(matchId)) {
      return false;
    }
    if ((authorizedBombsByMatchId.get(matchId) ?? 0) > 0) {
      return false;
    }
    if (currentProfile.cookies < CANDY_BOMB_COST) {
      return false;
    }

    persistAndNotify({
      ...currentProfile,
      cookies: currentProfile.cookies - CANDY_BOMB_COST,
    });

    if (authorizedBombsByMatchId.size >= MAX_AUTHORIZED_BOMB_ENTRIES) {
      const oldest = authorizedBombsByMatchId.keys().next().value;
      if (oldest !== undefined) {
        authorizedBombsByMatchId.delete(oldest);
      }
    }
    authorizedBombsByMatchId.set(matchId, 1);
    return true;
  }, []);

  const recordBlockBlastResult = useCallback(
    (
      receipt: MatchReceipt,
    ): {
      ok: boolean;
      reward: number;
      isNewBest: boolean;
      verifiedScore: number;
    } => {
      const matchId =
        receipt && typeof receipt === 'object' && typeof receipt.matchId === 'string'
          ? receipt.matchId
          : '';
      const authorizedBombs = matchId
        ? (authorizedBombsByMatchId.get(matchId) ?? 0)
        : 0;
      const settlement = settleBlockBlastMatch(
        currentProfile,
        receipt,
        authorizedBombs,
      );
      if (settlement.ok) {
        persistAndNotify(settlement.nextProfile);
        authorizedBombsByMatchId.delete(matchId);
      }
      return {
        ok: settlement.ok,
        reward: settlement.reward,
        isNewBest: settlement.isNewBest,
        verifiedScore: settlement.verifiedScore,
      };
    },
    [],
  );

  const recordGlassMatchResult = useCallback(
    (payload: { matchId: string; elapsedSec: number; shatters: number }) => {
      const settlement = settleGlassCarryMatch(currentProfile, payload);
      if (settlement.ok) {
        persistAndNotify(settlement.nextProfile);
      }
      return {
        ok: settlement.ok,
        reward: settlement.reward,
        stars: settlement.stars,
        isNewBest: settlement.isNewBest,
      };
    },
    [],
  );

  const recordCoopMatchResult = useCallback(
    (payload: {
      matchId: string;
      mapId: CoopMapId;
      elapsedSec: number;
      failures: number;
    }) => {
      const settlement = settleCoopMatch(currentProfile, payload);
      if (settlement.ok) {
        persistAndNotify(settlement.nextProfile);
      }
      return {
        ok: settlement.ok,
        mapId: settlement.mapId,
        reward: settlement.reward,
        stars: settlement.stars,
        isNewBest: settlement.isNewBest,
      };
    },
    [],
  );

  const recordEventResult = useCallback(
    (payload: { matchId: string; rank: number; totalPlayers: number }) => {
      const settlement = settleEventMatch(currentProfile, payload);
      if (settlement.ok) {
        persistAndNotify(settlement.nextProfile);
      }
      return {
        ok: settlement.ok,
        reward: settlement.reward,
      };
    },
    [],
  );

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
    integrityWarning,
    dismissIntegrityWarning,
    selectAnimal,
    updateSettings,
    recordMatchResult,
    recordBrawlResult,
    spendBlockBlastBomb,
    recordBlockBlastResult,
    recordGlassMatchResult,
    recordCoopMatchResult,
    recordEventResult,
    buyAccessory,
    equipAccessory,
    clearAccessories,
  };
}
