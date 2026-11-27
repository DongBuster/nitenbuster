import { ANIMALS } from '../../engine/types.ts';
import { BOT_ANIMAL_TITLES } from '../sim/constants.ts';
import type { FighterConfig } from '../sim/types.ts';
import {
  BRAWL_MAX_ROOM_PLAYERS,
  type BrawlRoomMember,
  type BrawlRoomSettings,
} from './protocol.ts';

export const DEFAULT_BRAWL_ROOM_SETTINGS: BrawlRoomSettings = {
  fillWithBots: true,
  targetPlayers: 4,
  difficulty: 'medium',
};

export function sortRoomMembers(
  members: readonly BrawlRoomMember[],
): BrawlRoomMember[] {
  return [...members].sort((a, b) => {
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
    return a.peerId.localeCompare(b.peerId);
  });
}

export function electBrawlHost(
  members: readonly BrawlRoomMember[],
): string | null {
  if (members.length === 0) return null;
  return sortRoomMembers(members)[0]?.peerId ?? null;
}

export function buildOnlineBrawlRoster(
  members: readonly BrawlRoomMember[],
  settings: BrawlRoomSettings,
): FighterConfig[] {
  const ordered = sortRoomMembers(members).slice(0, BRAWL_MAX_ROOM_PLAYERS);
  const usedAnimals = new Set<string>();

  const roster: FighterConfig[] = ordered.map((member, idx) => {
    const meta = ANIMALS.find((a) => a.id === member.animal) ?? ANIMALS[0];
    usedAnimals.add(meta.id);
    return {
      id: member.peerId,
      name: member.name.trim() || `Người chơi ${idx + 1}`,
      animal: meta.id,
      accessory: [...member.accessory],
      isBot: false,
      spawnIndex: idx,
      accentHex: meta.accentHex,
    };
  });

  if (!settings.fillWithBots) {
    return roster;
  }

  const desiredTotal = Math.min(
    BRAWL_MAX_ROOM_PLAYERS,
    Math.max(2, settings.targetPlayers),
  );
  const botNeeded = Math.max(0, desiredTotal - roster.length);
  if (botNeeded === 0) return roster;

  const preferredAnimals = ANIMALS.filter((a) => !usedAnimals.has(a.id));
  const botPool = preferredAnimals.length > 0 ? preferredAnimals : ANIMALS;

  for (let i = 0; i < botNeeded; i++) {
    const meta = botPool[i % botPool.length];
    const baseName = BOT_ANIMAL_TITLES[meta.id] ?? meta.name;
    const dupIdx = Math.floor(i / botPool.length);
    const name = dupIdx > 0 ? `${baseName} ${dupIdx + 1}` : baseName;
    roster.push({
      id: `bot_${i + 1}`,
      name,
      animal: meta.id,
      accessory: [],
      isBot: true,
      spawnIndex: roster.length,
      accentHex: meta.accentHex,
    });
  }

  return roster;
}

export function canStartBrawlRoom(
  members: readonly BrawlRoomMember[],
  settings: BrawlRoomSettings,
): boolean {
  if (members.length === 0) return false;
  const hostId = electBrawlHost(members);
  const totalCount = buildOnlineBrawlRoster(members, settings).length;
  if (totalCount < 2) return false;

  // All non-host human members must mark themselves ready
  for (const m of members) {
    if (m.peerId !== hostId && !m.ready) {
      return false;
    }
  }
  return true;
}
