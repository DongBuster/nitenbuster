import type { AnimalId, BotDifficulty } from '../../engine/types';

export type BrawlDifficulty = BotDifficulty;

export type MatchPhase =
  | 'setup'
  | 'countdown'
  | 'fighting'
  | 'roundOver'
  | 'matchOver';

export type ItemKind =
  | 'snowball'
  | 'sword'
  | 'shovel'
  | 'skates'
  | 'shield'
  | 'candy_bomb'
  | 'card_freeze'
  | 'card_taser';

export type HeldWeaponKind = 'snowball' | 'sword' | 'shovel' | 'candy_bomb' | null;

export type EmoteKind = 'wave' | 'dance' | 'taunt' | 'cheer';

export interface FighterConfig {
  id: string;
  name: string;
  animal: AnimalId;
  accessory: string[];
  isBot: boolean;
  spawnIndex: number;
  accentHex: string;
}

export interface FighterStatus {
  id: string;
  alive: boolean;
  balance: number;
  maxBalance: number;
  stunnedUntil: number;
  stunImmuneUntil: number;
  frozenUntil: number;
  speedBoostUntil: number;
  shieldUntil: number;
  rollCooldownUntil: number;
  punchCooldownUntil: number;
  headbuttCooldownUntil: number;
  spinCooldownUntil: number;
  dropkickCooldownUntil: number;
  heldItem: HeldWeaponKind;
  heldAmmo: number;
  grabbingTargetId: string | null;
  grabbedById: string | null;
  grabStartedAt: number;
  emote: EmoteKind | null;
  emoteUntil: number;
}

export interface FighterScore {
  id: string;
  name: string;
  animal: AnimalId;
  isBot: boolean;
  points: number;
  firstPlaces: number;
  lastRoundRank: number;
  roundPointsHistory: number[];
}

export interface RoundRankingEntry {
  id: string;
  name: string;
  animal: AnimalId;
  isBot: boolean;
  rank: number;
  pointsAwarded: number;
  totalPoints: number;
}

export interface MatchState {
  phase: MatchPhase;
  round: number;
  totalRounds: number;
  countdownSec: number;
  fighters: FighterConfig[];
  aliveIds: string[];
  eliminationGroups: string[][];
  scores: Record<string, FighterScore>;
  lastRoundRankings: RoundRankingEntry[];
  difficulty: BrawlDifficulty;
  botCount: number;
}

export interface FighterInput {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  jump: boolean;
  punch: boolean;
  headbutt: boolean;
  grabHeld: boolean;
  roll: boolean;
  emote: EmoteKind | null;
}

export interface HexTileSpec {
  id: string;
  q: number;
  r: number;
  x: number;
  z: number;
  ring: number;
  warnAtSec: number;
  collapseAtSec: number;
}

export interface WorldItem {
  id: string;
  kind: ItemKind;
  x: number;
  y: number;
  z: number;
  spawnedAt: number;
}

export interface Projectile {
  id: string;
  kind: 'snowball' | 'candy_bomb';
  ownerId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuseSec: number;
  createdAt: number;
}

export interface HitEffect {
  id: string;
  x: number;
  y: number;
  z: number;
  color: string;
  kind: 'punch' | 'bomb' | 'freeze' | 'taser' | 'pickup' | 'spin' | 'dust';
  createdAt: number;
}

export interface KnockoutPopup {
  id: string;
  name: string;
  animal: AnimalId;
  x: number;
  y: number;
  z: number;
  createdAt: number;
}

export type BrawlSkillId =
  | 'punch'
  | 'headbutt'
  | 'grab'
  | 'roll'
  | 'jump'
  | 'sprint';

export type PressedSkillState = Record<BrawlSkillId, boolean>;

export interface HudSnapshot {
  aliveCount: number;
  totalFighters: number;
  roundElapsedSec: number;
  nextCollapseRing: number | null;
  nextCollapseInSec: number | null;
  isRingWarning: boolean;
  playerAlive: boolean;
  playerGrounded: boolean;
  playerBalance: number;
  playerMaxBalance: number;
  playerStunned: boolean;
  playerFrozen: boolean;
  playerSpeedLeft: number;
  playerShieldLeft: number;
  playerRollReadyPct: number;
  playerRollCooldownLeft: number;
  playerPunchReadyPct: number;
  playerPunchCooldownLeft: number;
  playerHeadbuttReadyPct: number;
  playerHeadbuttCooldownLeft: number;
  playerHeldItem: HeldWeaponKind;
  playerHeldAmmo: number;
  playerGrabbingName: string | null;
  bannerText: string | null;
  koFeed: Array<{ id: string; text: string }>;
}
