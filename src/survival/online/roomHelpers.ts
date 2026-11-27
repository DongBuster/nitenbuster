import type { AnimalId } from '../../engine/types.ts';
import type {
  GearId,
  SurvivalInput,
  WeaponId,
} from '../sim/types.ts';
import {
  SURVIVAL_MAX_PLAYERS,
  isSafeId,
  sanitizeAnimal,
  sanitizeDisplayName,
  sanitizeGear,
  sanitizeWeapon,
  type SurvivalRoomMember,
  type SurvivalRoomPhase,
} from './protocol.ts';

export const BOT_ANIMALS: readonly AnimalId[] = [
  'cat',
  'dog',
  'duck',
  'panda',
  'bunny',
  'dino',
  'shark',
  'chicken',
];

export const BOT_ANIMAL_NAMES: Record<AnimalId, string> = {
  dog: 'Bot Cún',
  cat: 'Bot Mèo',
  duck: 'Bot Vịt',
  shark: 'Bot Cá Mập',
  dino: 'Bot Khủng Long',
  panda: 'Bot Gấu Trúc',
  chicken: 'Bot Gà',
  bunny: 'Bot Thỏ',
};

export const BOT_WEAPONS: readonly WeaponId[] = [
  'frost_bow',
  'candy_smg',
  'lightning_staff',
  'chestnut_shotgun',
];

export const BOT_GEARS: readonly GearId[] = [
  'plush_armor',
  'ice_skates',
  'crystal_magnet',
  'golden_scope',
];

export function clampBotCount(rawCount: number, humanCount: number): number {
  const maxForRoom = Math.max(
    0,
    Math.min(3, SURVIVAL_MAX_PLAYERS - Math.max(1, humanCount)),
  );
  const safe = Number.isFinite(rawCount) ? Math.floor(rawCount) : 0;
  return Math.max(0, Math.min(maxForRoom, safe));
}

/**
 * Parses Supabase Realtime Presence state into sorted `SurvivalRoomMember`
 * records, binding every member's `peerId` strictly to its Presence key rather
 * than trusting client-supplied `peerId` inside the payload.
 */
export function parsePresenceMembers(
  presenceState: Record<string, unknown[]>,
): SurvivalRoomMember[] {
  const byPeer = new Map<string, SurvivalRoomMember>();
  for (const [presenceKey, entries] of Object.entries(presenceState)) {
    if (!isSafeId(presenceKey, 64) || !Array.isArray(entries)) continue;
    for (const raw of entries) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const m = raw as Record<string, unknown>;

      const candidate: SurvivalRoomMember = {
        peerId: presenceKey,
        name: sanitizeDisplayName(m.name),
        animal: sanitizeAnimal(m.animal),
        weaponId: sanitizeWeapon(m.weaponId),
        gearId: sanitizeGear(m.gearId),
        isHost: Boolean(m.isHost),
        ready: Boolean(m.ready),
        joinedAt:
          typeof m.joinedAt === 'number' &&
          Number.isFinite(m.joinedAt) &&
          m.joinedAt >= 0
            ? m.joinedAt
            : Number.MAX_SAFE_INTEGER,
      };

      const existing = byPeer.get(presenceKey);
      if (!existing || candidate.joinedAt < existing.joinedAt) {
        byPeer.set(presenceKey, candidate);
      }
    }
  }

  return Array.from(byPeer.values()).sort((a, b) => {
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
    return a.peerId.localeCompare(b.peerId);
  });
}

/**
 * Extracts the Host's advertised `roomState` (`'lobby' | 'playing'`) from
 * Realtime Presence, keyed strictly by Presence entry key.
 */
export function extractHostRoomState(
  presenceState: Record<string, unknown[]>,
  hostPeerId?: string,
): Exclude<SurvivalRoomPhase, 'idle'> | null {
  for (const [presenceKey, entries] of Object.entries(presenceState)) {
    if (!isSafeId(presenceKey, 64) || !Array.isArray(entries)) continue;
    if (hostPeerId && presenceKey !== hostPeerId) continue;

    for (const raw of entries) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const m = raw as Record<string, unknown>;
      if (!m.isHost) continue;
      if (m.roomState === 'lobby' || m.roomState === 'playing') {
        return m.roomState;
      }
    }
  }
  return null;
}

/**
 * Normalizes Host flags across sorted lobby members. Never promotes a Guest to
 * Host when no explicit Host exists unless `allowFallbackPromotion` is true
 * (i.e., a confirmed Host was previously in this lobby session and left).
 */
export function normalizeLobbyHostFlags(
  sortedMembers: readonly SurvivalRoomMember[],
  allowFallbackPromotion = false,
): { normalized: SurvivalRoomMember[]; hostPeerId: string } {
  if (sortedMembers.length === 0) {
    return { normalized: [], hostPeerId: '' };
  }

  const explicitHost = sortedMembers.find((m) => m.isHost);
  const resolvedHostId = explicitHost
    ? explicitHost.peerId
    : allowFallbackPromotion
      ? sortedMembers[0].peerId
      : '';

  const normalized = sortedMembers.map((m) => ({
    ...m,
    isHost: resolvedHostId !== '' && m.peerId === resolvedHostId,
  }));

  return { normalized, hostPeerId: resolvedHostId };
}

export function inputsEqual(a: SurvivalInput, b: SurvivalInput): boolean {
  return (
    a.moveX === b.moveX &&
    a.moveY === b.moveY &&
    a.aimX === b.aimX &&
    a.aimY === b.aimY &&
    a.manualAim === b.manualAim &&
    a.dashPressed === b.dashPressed
  );
}
