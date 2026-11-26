import type { PartyActionKind } from '../sim/partyMotion.ts';
import type {
  EmoteKind,
  FighterInput,
  HeldWeaponKind,
  ItemKind,
} from '../sim/types.ts';

export const BRAWL_SNAPSHOT_INTERVAL_MS = 50; // 20Hz
export const BRAWL_INPUT_INTERVAL_MS = 50; // 20Hz
export const BRAWL_INPUT_STALE_MS = 350;
export const BRAWL_INTERPOLATION_DELAY_MS = 70;

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
