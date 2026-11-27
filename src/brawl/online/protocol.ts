import type { AnimalId } from '../../engine/types.ts';
import type { PartyActionKind } from '../sim/partyMotion.ts';
import type {
  BrawlDifficulty,
  EmoteKind,
  FighterInput,
  HeldWeaponKind,
  ItemKind,
  MatchState,
} from '../sim/types.ts';

export const BRAWL_SNAPSHOT_INTERVAL_MS = 60; // ~16.7Hz
export const BRAWL_INPUT_INTERVAL_MS = 60; // ~16.7Hz
export const BRAWL_INPUT_STALE_MS = 450;
export const BRAWL_INTERPOLATION_DELAY_MS = 110;
export const BRAWL_MAX_ROOM_PLAYERS = 8;

export type BrawlRoomPhase = 'idle' | 'lobby' | 'playing';

export function buildBrawlRoundKey(
  roomCode: string,
  matchNonce: number,
  round: number,
): string {
  return `brawl_online_${roomCode}_m${matchNonce}_r${round}`;
}

export interface BrawlRoomMember {
  peerId: string;
  name: string;
  animal: AnimalId;
  accessory: string[];
  ready: boolean;
  joinedAt: number;
  isHost?: boolean;
}

export interface BrawlRoomSettings {
  fillWithBots: boolean;
  targetPlayers: number;
  difficulty: BrawlDifficulty;
}

export interface BrawlRoomConfigPayload {
  settings: BrawlRoomSettings;
}

export interface BrawlMatchSyncPayload {
  matchNonce: number;
  hostPeerId: string;
  phase: BrawlRoomPhase;
  match: MatchState | null;
}

export interface BrawlInputPayload {
  roundKey: string;
  peerId: string;
  seq: number;
  input: FighterInput;
}

export interface BrawlFighterSnapshot {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speedNorm: number;
  walkPhase: number;
  grounded: boolean;
  alive: boolean;
  balance: number;
  maxBalance: number;
  stunned: boolean;
  frozen: boolean;
  shielded: boolean;
  speedBoosted: boolean;
  heldItem: HeldWeaponKind;
  heldAmmo: number;
  emote: EmoteKind | null;
  action: PartyActionKind;
  actionProgress: number;
}

export interface BrawlWorldItemSnapshot {
  id: string;
  kind: ItemKind;
  x: number;
  y: number;
  z: number;
}

export interface BrawlProjectileSnapshot {
  id: string;
  kind: 'snowball' | 'candy_bomb';
  ownerId: string;
  x: number;
  y: number;
  z: number;
  fuseSec: number;
}

export interface BrawlSnapshotPayload {
  roundKey: string;
  tick: number;
  nowSec: number;
  roundElapsedSec: number;
  fighters: BrawlFighterSnapshot[];
  items: BrawlWorldItemSnapshot[];
  projectiles: BrawlProjectileSnapshot[];
  koFeed: Array<{ id: string; text: string }>;
  bannerText: string | null;
}

export function round2(v: number): number {
  const n = Math.round(v * 100) / 100;
  return Object.is(n, -0) ? 0 : n;
}
