import type { AnimalId } from '../../engine/types.ts';
import { GEARS, SKILLS, WEAPONS } from '../sim/catalog.ts';
import { isSurvivalMapId } from '../sim/maps.ts';
import type {
  BossKind,
  CrateEntity,
  EnemyEntity,
  EnemyKind,
  GearId,
  HazardTelegraph,
  LightningArcFx,
  MapZone,
  PickupItemEntity,
  PlayerEntity,
  ProjectileEntity,
  SkillId,
  SkillOffer,
  SkillRarity,
  SurvivalInput,
  SurvivalMapId,
  SurvivalPhase,
  SurvivalWorldState,
  WeaponId,
  XpGemEntity,
} from '../sim/types.ts';

export const SURVIVAL_MAX_PLAYERS = 4;
export const SURVIVAL_INPUT_INTERVAL_MS = 72;
export const SURVIVAL_SNAPSHOT_INTERVAL_MS = 75;
export const SURVIVAL_INTERPOLATION_DELAY_MS = 80;
export const SURVIVAL_DISCONNECT_BOT_MS = 6000;
export const SURVIVAL_MAX_SNAPSHOT_ENEMIES = 160;
export const SURVIVAL_MAX_SNAPSHOT_PROJECTILES = 120;
export const SURVIVAL_MAX_SNAPSHOT_GEMS = 120;

const MAX_DISPLAY_NAME_LEN = 24;
const MAX_ID_LEN = 128;
const MAX_WIRE_ENEMIES = 200;
const MAX_WIRE_PROJECTILES = 200;
const MAX_WIRE_GEMS = 200;
const MAX_WIRE_CRATES = 64;
const MAX_WIRE_PICKUPS = 64;
const MAX_WIRE_HAZARDS = 64;
const MAX_WIRE_ARCS = 64;
const MAX_WIRE_ZONES = 32;

const VALID_ANIMALS: ReadonlySet<AnimalId> = new Set([
  'dog',
  'cat',
  'duck',
  'shark',
  'dino',
  'panda',
  'chicken',
  'bunny',
]);

const VALID_WEAPONS: ReadonlySet<WeaponId> = new Set(WEAPONS.map((w) => w.id));
const VALID_GEARS: ReadonlySet<GearId> = new Set(GEARS.map((g) => g.id));
const VALID_SKILLS: ReadonlySet<SkillId> = new Set(SKILLS.map((s) => s.id));

const MAP_IDS: readonly SurvivalMapId[] = [
  'winter_cabin',
  'candy_canyon',
  'crystal_cavern',
  'endless_abyss',
];

const PHASE_IDS: readonly SurvivalPhase[] = [
  'playing',
  'levelup',
  'victory',
  'gameover',
];

const BOSS_KINDS: readonly BossKind[] = [
  'boss_slime_king',
  'boss_frost_bear',
  'boss_snow_dragon',
  'boss_jelly_king',
  'boss_candy_scorpion',
  'boss_sugar_pharaoh',
  'boss_quartz_lord',
  'boss_crystal_golem',
  'boss_void_dragon',
];

const ENEMY_KINDS: readonly EnemyKind[] = [
  'slime',
  'bat',
  'wolf',
  'owl_mage',
  'golem',
  'bomber',
  ...BOSS_KINDS,
];

const TELEGRAPH_KINDS: readonly EnemyEntity['telegraphKind'][] = [
  'none',
  'lunge',
  'explode',
  'slam',
  'charge',
  'volley',
];

const PROJECTILE_WEAPON_IDS: readonly ProjectileEntity['weaponId'][] = [
  'candy_smg',
  'chestnut_shotgun',
  'frost_bow',
  'lightning_staff',
  'candy_launcher',
  'snow_boomerang',
  'drone',
  'enemy_orb',
  'enemy_dragon',
];

const XP_GEM_TIERS: readonly XpGemEntity['tier'][] = [
  'green',
  'blue',
  'purple',
  'gold',
];

const PICKUP_KINDS: readonly PickupItemEntity['kind'][] = ['heal', 'magnet'];
const HAZARD_SHAPES: readonly PackedHazard['shape'][] = ['circle', 'line'];

const SKILL_IDS: readonly SkillId[] = SKILLS.map((s) => s.id);

const SKILL_RARITIES: readonly SkillRarity[] = ['common', 'rare', 'epic'];

const KNOWN_COLORS: readonly string[] = [
  '#f472b6',
  '#fb923c',
  '#38bdf8',
  '#facc15',
  '#c084fc',
  '#67e8f9',
  '#34d399',
  '#fb7185',
  '#f97316',
  '#60a5fa',
  '#ef4444',
  '#f59e0b',
  '#e879f9',
  '#fbbf24',
  '#a855f7',
  '#ea580c',
];

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

export type SurvivalConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export type SurvivalRoomPhase = 'idle' | 'lobby' | 'playing';

export interface SurvivalRoomMember {
  peerId: string;
  name: string;
  animal: AnimalId;
  weaponId: WeaponId;
  gearId: GearId;
  isHost: boolean;
  ready: boolean;
  joinedAt: number;
}

export interface SnapshotPlayerMeta {
  id: string;
  name: string;
  animal: AnimalId;
  weaponId: WeaponId;
  gearId: GearId;
  isBot: boolean;
}

export type SnapshotRosterLookup =
  | ReadonlyMap<string, SnapshotPlayerMeta>
  | Readonly<Record<string, SnapshotPlayerMeta>>;

export interface PackedPlayer {
  id: string;
  name: string;
  animal: AnimalId;
  weaponId: WeaponId;
  gearId: GearId;
  isBot: boolean;
  botTakeover: boolean;
  x: number;
  y: number;
  aimAngle: number;
  hp: number;
  maxHp: number;
  downed: boolean;
  reviveProgress: number;
  invulnTimer: number;
  dashTimer: number;
  dashCooldownTimer: number;
  dashCooldownMax: number;
  hitFlashTimer: number;
  kills: number;
  damageDealt: number;
  score: number;
  revives: number;
  rerollsLeft: number;
  comboCount: number;
  orbitalAngle: number;
  orbitalLevel: number;
  warmAuraLevel: number;
  droneLevel: number;
  droneAngle: number;
  teamAuraLevel: number;
  pylonBuffTimer: number;
  skills: Partial<Record<SkillId, number>>;
}

export interface PackedEnemy {
  id: string;
  kind: EnemyKind;
  isBoss: boolean;
  bossTier: number;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  hitFlashTimer: number;
  slowTimer: number;
  telegraphKind: EnemyEntity['telegraphKind'];
  telegraphTimer: number;
}

export interface PackedProjectile {
  id: string;
  fromEnemy: boolean;
  weaponId: ProjectileEntity['weaponId'];
  x: number;
  y: number;
  radius: number;
  color: string;
  boomerang: boolean;
  angle?: number;
}

export interface PackedXpGem {
  id: string;
  x: number;
  y: number;
  tier: XpGemEntity['tier'];
  value: number;
}

export interface PackedCrate {
  id: string;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  hitFlashTimer: number;
}

export interface PackedPickup {
  id: string;
  x: number;
  y: number;
  kind: PickupItemEntity['kind'];
}

export interface PackedHazard {
  id: string;
  x: number;
  y: number;
  radius: number;
  endX?: number;
  endY?: number;
  shape: 'circle' | 'line';
  elapsed: number;
  duration: number;
  fromEnemy: boolean;
  color: string;
}

export interface PackedLightningArc {
  points: Array<{ x: number; y: number }>;
  color: string;
  ttl: number;
  maxTtl: number;
}

export interface PackedZoneState {
  id: string;
  cooldownSec: number;
  activeTimerSec: number;
}

export interface SurvivalSnapshotPayload {
  matchId: string;
  mapId: SurvivalMapId;
  seed: number;
  tick: number;
  elapsedSec: number;
  phase: SurvivalPhase;
  isEndlessActive: boolean;
  score: number;
  teamLevel: number;
  teamXp: number;
  xpToNext: number;
  bossesSlain: number;
  nextBossAtSec: number;
  bossWarningSec: number;
  bossWarningKind: BossKind | null;
  activeBossId: string | null;
  sandstormActive: boolean;
  levelUpTimerSec: number;
  pendingOffersByPlayer: Record<string, SkillOffer[]>;
  pickedPlayerIds: string[];
  players: PackedPlayer[];
  enemies: PackedEnemy[];
  projectiles: PackedProjectile[];
  xpGems: PackedXpGem[];
  crates: PackedCrate[];
  pickups: PackedPickup[];
  hazards: PackedHazard[];
  lightningArcs: PackedLightningArc[];
  zones: PackedZoneState[];
}

export type WireSkillPair = [number, number];
export type WireSkillOfferTuple = [number, number, number, number, number];
export type WirePlayerTuple = [
  string, // 0 id
  number, // 1 flags (botTakeover | downed << 1)
  number, // 2 x
  number, // 3 y
  number, // 4 aimAngle
  number, // 5 hp
  number, // 6 maxHp
  number, // 7 reviveProgress
  number, // 8 invulnTimer
  number, // 9 dashTimer
  number, // 10 dashCooldownTimer
  number, // 11 dashCooldownMax
  number, // 12 hitFlashTimer
  number, // 13 kills
  number, // 14 damageDealt
  number, // 15 score
  number, // 16 revives
  number, // 17 rerollsLeft
  number, // 18 comboCount
  number, // 19 orbitalAngle
  number, // 20 orbitalLevel
  number, // 21 warmAuraLevel
  number, // 22 droneLevel
  number, // 23 droneAngle
  number, // 24 teamAuraLevel
  number, // 25 pylonBuffTimer
  WireSkillPair[], // 26 skills
];

export type WireEnemyTuple = [
  string, // 0 id
  number, // 1 kindIdx
  number, // 2 x
  number, // 3 y
  number, // 4 radius
  number, // 5 hp
  number, // 6 maxHp
  ...number[] // 7?: flags, 8?: bossTier, 9?: hitFlashTimer, 10?: slowTimer, 11?: telegraphTimer
];

export type WireProjectileTuple =
  | [string, number, number, number, number, number | string, number]
  | [string, number, number, number, number, number | string, number, number];

export type WireXpGemTuple = [string, number, number, number, number];

export type WireCrateTuple =
  | [string, number, number, number, number, number]
  | [string, number, number, number, number, number, number];

export type WirePickupTuple = [string, number, number, number];

export type WireHazardTuple =
  | [string, number, number, number, number, number, number, number | string]
  | [
      string,
      number,
      number,
      number,
      number,
      number,
      number,
      number | string,
      number | null,
      number | null,
    ];

export type WireLightningArcTuple = [number[], number | string, number, number];

export type WireZoneTuple = [string, number, number];

export interface SurvivalSnapshotWirePayload {
  v: 1;
  m: string;
  mp: number;
  s: number;
  t: number;
  e: number;
  ph: number;
  en?: 1;
  sc: number;
  lv: number;
  xp: number;
  nx: number;
  bs: number;
  nb: number;
  bw?: number;
  bk?: number;
  ab?: string;
  ss?: 1;
  lt?: number;
  po?: Record<string, WireSkillOfferTuple[]>;
  pk?: string[];
  p: WirePlayerTuple[];
  em: WireEnemyTuple[];
  pr: WireProjectileTuple[];
  xg: WireXpGemTuple[];
  cr?: WireCrateTuple[];
  pi?: WirePickupTuple[];
  hz?: WireHazardTuple[];
  la?: WireLightningArcTuple[];
  zn?: WireZoneTuple[];
}

export interface SurvivalInputPayload {
  matchId: string;
  peerId: string;
  input: SurvivalInput;
  seq: number;
  sentAt: number;
}

export interface SurvivalSkillActionPayload {
  matchId: string;
  peerId: string;
  action: 'pick' | 'reroll';
  offerIndex?: number;
}

export interface SurvivalStartPayload {
  matchId: string;
  hostPeerId: string;
  mapId: SurvivalMapId;
  seed: number;
  players: Array<{
    id: string;
    name: string;
    animal: AnimalId;
    weaponId: WeaponId;
    gearId: GearId;
    isBot: boolean;
  }>;
}

export interface SurvivalLobbySyncPayload {
  mapId: SurvivalMapId;
  botFillCount: number;
  members: SurvivalRoomMember[];
  hostPeerId?: string;
}

export interface SurvivalReturnLobbyPayload {
  hostPeerId: string;
}

export interface SurvivalContinueEndlessPayload {
  matchId: string;
  hostPeerId: string;
}

export interface SurvivalHostLeftPayload {
  hostPeerId: string;
  matchId?: string;
}

export interface SurvivalLobbyRequestPayload {
  requesterPeerId: string;
}

export interface SurvivalMatchInProgressPayload {
  hostPeerId: string;
  targetPeerId: string;
}

export interface SurvivalHeartbeatPayload {
  matchId: string;
  peerId: string;
  sentAt: number;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) {
    return false;
  }
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

/**
 * Checks that `val` is a non-empty bounded string not colliding with
 * prototype chain property names (`__proto__`, `constructor`, `prototype`).
 */
export function isSafeId(val: unknown, maxLen: number = MAX_ID_LEN): val is string {
  return (
    typeof val === 'string' &&
    val.length > 0 &&
    val.length <= maxLen &&
    !FORBIDDEN_KEYS.has(val)
  );
}

export function sanitizeAnimal(val: unknown): AnimalId {
  return typeof val === 'string' && VALID_ANIMALS.has(val as AnimalId)
    ? (val as AnimalId)
    : 'dog';
}

export function sanitizeWeapon(val: unknown): WeaponId {
  return typeof val === 'string' && VALID_WEAPONS.has(val as WeaponId)
    ? (val as WeaponId)
    : 'candy_smg';
}

export function sanitizeGear(val: unknown): GearId {
  return typeof val === 'string' && VALID_GEARS.has(val as GearId)
    ? (val as GearId)
    : 'ice_skates';
}

export function sanitizeDisplayName(
  val: unknown,
  fallback: string = 'Người chơi',
): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim().slice(0, MAX_DISPLAY_NAME_LEN);
  return trimmed.length > 0 ? trimmed : fallback;
}

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function isNonNegNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0;
}

function isNonNegInt(val: unknown): val is number {
  return (
    typeof val === 'number' &&
    Number.isSafeInteger(val) &&
    val >= 0
  );
}

function cleanZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function round1(value: number): number {
  return cleanZero(Math.round(value * 10) / 10);
}

function round2(value: number): number {
  return cleanZero(Math.round(value * 100) / 100);
}

function roundInt(value: number): number {
  return cleanZero(Math.round(value));
}

function encodeColor(color: string): number | string {
  const idx = KNOWN_COLORS.indexOf(color);
  return idx >= 0 ? idx : color;
}

function decodeColor(raw: unknown): string | null {
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || raw < 0 || raw >= KNOWN_COLORS.length) {
      return null;
    }
    return KNOWN_COLORS[raw];
  }
  if (typeof raw === 'string' && raw.length > 0 && raw.length <= 32) {
    return raw;
  }
  return null;
}

function isBossKind(val: unknown): val is BossKind {
  return (
    val === 'boss_slime_king' ||
    val === 'boss_frost_bear' ||
    val === 'boss_snow_dragon'
  );
}

function isSurvivalPhase(val: unknown): val is SurvivalPhase {
  return (
    val === 'playing' ||
    val === 'levelup' ||
    val === 'victory' ||
    val === 'gameover'
  );
}

function isEnemyKind(val: unknown): val is EnemyKind {
  return typeof val === 'string' && ENEMY_KINDS.includes(val as EnemyKind);
}

function isTelegraphKind(val: unknown): val is EnemyEntity['telegraphKind'] {
  return (
    typeof val === 'string' &&
    TELEGRAPH_KINDS.includes(val as EnemyEntity['telegraphKind'])
  );
}

function isProjectileWeaponId(
  val: unknown,
): val is ProjectileEntity['weaponId'] {
  return (
    typeof val === 'string' &&
    PROJECTILE_WEAPON_IDS.includes(val as ProjectileEntity['weaponId'])
  );
}

function isXpGemTier(val: unknown): val is XpGemEntity['tier'] {
  return (
    typeof val === 'string' &&
    XP_GEM_TIERS.includes(val as XpGemEntity['tier'])
  );
}

function isSkillRarity(val: unknown): val is SkillRarity {
  return val === 'common' || val === 'rare' || val === 'epic';
}

function isSkillId(val: unknown): val is SkillId {
  return typeof val === 'string' && VALID_SKILLS.has(val as SkillId);
}

function lookupRosterMeta(
  rosterById: SnapshotRosterLookup,
  id: string,
): SnapshotPlayerMeta | undefined {
  if (!isSafeId(id)) return undefined;
  if (rosterById instanceof Map) {
    return rosterById.get(id);
  }
  const record = rosterById as Record<string, SnapshotPlayerMeta>;
  return Object.prototype.hasOwnProperty.call(record, id) ? record[id] : undefined;
}

function sanitizeRoomMember(raw: unknown): SurvivalRoomMember | null {
  if (!isPlainObject(raw)) return null;
  if (!isSafeId(raw.peerId, 64)) return null;
  return {
    peerId: raw.peerId,
    name: sanitizeDisplayName(raw.name),
    animal: sanitizeAnimal(raw.animal),
    weaponId: sanitizeWeapon(raw.weaponId),
    gearId: sanitizeGear(raw.gearId),
    isHost: Boolean(raw.isHost),
    ready: Boolean(raw.ready),
    joinedAt: isNonNegNumber(raw.joinedAt) ? raw.joinedAt : 0,
  };
}

/**
 * Sanitizes an untrusted `SurvivalInput` payload, rejecting non-objects and
 * clamping axes/aim coordinates to safe finite values.
 */
export function sanitizeSurvivalInput(raw: unknown): SurvivalInput | null {
  if (!isPlainObject(raw)) return null;

  const moveX = isFiniteNumber(raw.moveX)
    ? cleanZero(Math.max(-1, Math.min(1, raw.moveX)))
    : 0;
  const moveY = isFiniteNumber(raw.moveY)
    ? cleanZero(Math.max(-1, Math.min(1, raw.moveY)))
    : 0;
  const aimX = isFiniteNumber(raw.aimX) ? cleanZero(raw.aimX) : 0;
  const aimY = isFiniteNumber(raw.aimY) ? cleanZero(raw.aimY) : 0;

  return {
    moveX,
    moveY,
    aimX,
    aimY,
    manualAim: Boolean(raw.manualAim),
    dashPressed: Boolean(raw.dashPressed),
  };
}

/**
 * Validates a Guest input broadcast packet against the active match ID and
 * authoritative non-bot Guest roster.
 */
export function validateSurvivalInputPayload(
  raw: unknown,
  allowedGuestIds: ReadonlySet<string>,
  activeMatchId: string,
): SurvivalInputPayload | null {
  if (!isPlainObject(raw) || !isSafeId(activeMatchId)) return null;
  if (raw.matchId !== activeMatchId) return null;
  if (!isSafeId(raw.peerId, 64) || !allowedGuestIds.has(raw.peerId)) {
    return null;
  }

  let seq: number;
  let sentAt: number;

  if (raw.seq !== undefined) {
    if (!isNonNegInt(raw.seq)) return null;
    seq = raw.seq;
    sentAt = isNonNegNumber(raw.sentAt) ? raw.sentAt : 0;
  } else {
    if (!isNonNegNumber(raw.sentAt)) return null;
    sentAt = raw.sentAt;
    seq = Math.floor(raw.sentAt);
  }

  const input = sanitizeSurvivalInput(raw.input);
  if (!input) return null;

  return {
    matchId: activeMatchId,
    peerId: raw.peerId,
    input,
    seq,
    sentAt,
  };
}

/**
 * Validates a Guest level-up skill pick or reroll broadcast packet.
 */
export function validateSurvivalSkillActionPayload(
  raw: unknown,
  allowedGuestIds: ReadonlySet<string>,
  activeMatchId: string,
): SurvivalSkillActionPayload | null {
  if (!isPlainObject(raw) || !isSafeId(activeMatchId)) return null;
  if (raw.matchId !== activeMatchId) return null;
  if (!isSafeId(raw.peerId, 64) || !allowedGuestIds.has(raw.peerId)) {
    return null;
  }

  if (raw.action === 'reroll') {
    return {
      matchId: activeMatchId,
      peerId: raw.peerId,
      action: 'reroll',
    };
  }

  if (raw.action === 'pick') {
    if (
      typeof raw.offerIndex !== 'number' ||
      !Number.isInteger(raw.offerIndex) ||
      raw.offerIndex < 0 ||
      raw.offerIndex >= 6
    ) {
      return null;
    }
    return {
      matchId: activeMatchId,
      peerId: raw.peerId,
      action: 'pick',
      offerIndex: raw.offerIndex,
    };
  }

  return null;
}

/**
 * Validates and sanitizes a `survival_start` broadcast payload from the Host.
 */
export function validateSurvivalStartPayload(
  raw: unknown,
  expectedHostPeerId: string | null,
): SurvivalStartPayload | null {
  if (!isPlainObject(raw)) return null;
  if (!isSafeId(raw.matchId)) return null;
  if (!isSafeId(raw.hostPeerId, 64)) return null;
  if (expectedHostPeerId && raw.hostPeerId !== expectedHostPeerId) {
    return null;
  }
  if (!isFiniteNumber(raw.seed)) return null;
  if (!isSurvivalMapId(raw.mapId)) return null;
  if (
    !Array.isArray(raw.players) ||
    raw.players.length < 1 ||
    raw.players.length > SURVIVAL_MAX_PLAYERS
  ) {
    return null;
  }

  const seenIds = new Set<string>();
  const players: SurvivalStartPayload['players'] = [];

  for (let i = 0; i < raw.players.length; i += 1) {
    const entry = raw.players[i];
    if (!isPlainObject(entry)) return null;
    if (!isSafeId(entry.id, 64) || seenIds.has(entry.id)) return null;
    seenIds.add(entry.id);

    players.push({
      id: entry.id,
      name: sanitizeDisplayName(entry.name),
      animal: sanitizeAnimal(entry.animal),
      weaponId: sanitizeWeapon(entry.weaponId),
      gearId: sanitizeGear(entry.gearId),
      isBot: Boolean(entry.isBot),
    });
  }

  return {
    matchId: raw.matchId,
    hostPeerId: raw.hostPeerId,
    mapId: raw.mapId,
    seed: cleanZero(raw.seed),
    players,
  };
}

/**
 * Validates and sanitizes a `survival_lobby_sync` broadcast payload.
 */
export function validateSurvivalLobbySyncPayload(
  raw: unknown,
): SurvivalLobbySyncPayload | null {
  if (!isPlainObject(raw)) return null;
  if (!isSurvivalMapId(raw.mapId)) return null;
  if (!isFiniteNumber(raw.botFillCount)) return null;
  if (!Array.isArray(raw.members)) return null;

  if (raw.hostPeerId !== undefined && !isSafeId(raw.hostPeerId, 64)) {
    return null;
  }

  const botFillCount = Math.max(0, Math.min(3, Math.floor(raw.botFillCount)));
  const seenPeers = new Set<string>();
  const members: SurvivalRoomMember[] = [];

  for (
    let i = 0;
    i < raw.members.length && members.length < SURVIVAL_MAX_PLAYERS;
    i += 1
  ) {
    const member = sanitizeRoomMember(raw.members[i]);
    if (!member || seenPeers.has(member.peerId)) continue;
    seenPeers.add(member.peerId);
    members.push(member);
  }

  return {
    mapId: raw.mapId,
    botFillCount,
    members,
    ...(typeof raw.hostPeerId === 'string'
      ? { hostPeerId: raw.hostPeerId }
      : {}),
  };
}

function validateSkillOffer(raw: unknown): SkillOffer | null {
  if (!isPlainObject(raw)) return null;
  if (!isSkillId(raw.skillId) || !isSkillRarity(raw.rarity)) return null;
  if (
    !isNonNegInt(raw.currentLevel) ||
    !isNonNegInt(raw.nextLevel) ||
    !isNonNegInt(raw.levelGain)
  ) {
    return null;
  }
  return {
    skillId: raw.skillId,
    rarity: raw.rarity,
    currentLevel: raw.currentLevel,
    nextLevel: raw.nextLevel,
    levelGain: raw.levelGain,
  };
}

function validatePendingOffers(
  raw: unknown,
): Record<string, SkillOffer[]> | null {
  if (!isPlainObject(raw)) return null;
  const out: Record<string, SkillOffer[]> = {};
  for (const [playerId, rawList] of Object.entries(raw)) {
    if (!isSafeId(playerId, 64) || !Array.isArray(rawList) || rawList.length > 6) {
      return null;
    }
    const offers: SkillOffer[] = [];
    for (let i = 0; i < rawList.length; i += 1) {
      const offer = validateSkillOffer(rawList[i]);
      if (!offer) return null;
      offers.push(offer);
    }
    out[playerId] = offers;
  }
  return out;
}

function validatePackedPlayer(raw: unknown): PackedPlayer | null {
  if (!isPlainObject(raw)) return null;
  if (!isSafeId(raw.id, 64)) return null;
  if (
    !isFiniteNumber(raw.x) ||
    !isFiniteNumber(raw.y) ||
    !isFiniteNumber(raw.aimAngle) ||
    !isNonNegNumber(raw.hp) ||
    !isNonNegNumber(raw.maxHp) ||
    !isNonNegNumber(raw.reviveProgress) ||
    !isNonNegNumber(raw.invulnTimer) ||
    !isNonNegNumber(raw.dashTimer) ||
    !isNonNegNumber(raw.dashCooldownTimer) ||
    !isNonNegNumber(raw.dashCooldownMax) ||
    !isNonNegNumber(raw.hitFlashTimer) ||
    !isNonNegNumber(raw.kills) ||
    !isNonNegNumber(raw.damageDealt) ||
    !isNonNegNumber(raw.score) ||
    !isNonNegNumber(raw.revives) ||
    !isNonNegNumber(raw.rerollsLeft) ||
    !isNonNegNumber(raw.comboCount) ||
    !isFiniteNumber(raw.orbitalAngle) ||
    !isNonNegNumber(raw.orbitalLevel) ||
    !isNonNegNumber(raw.warmAuraLevel) ||
    !isNonNegNumber(raw.droneLevel) ||
    !isFiniteNumber(raw.droneAngle) ||
    !isNonNegNumber(raw.teamAuraLevel) ||
    !isNonNegNumber(raw.pylonBuffTimer) ||
    !isPlainObject(raw.skills)
  ) {
    return null;
  }

  const skills: Partial<Record<SkillId, number>> = {};
  for (const [key, val] of Object.entries(raw.skills)) {
    if (!isSkillId(key) || !isNonNegNumber(val)) return null;
    skills[key] = val;
  }

  return {
    id: raw.id,
    name: sanitizeDisplayName(raw.name),
    animal: sanitizeAnimal(raw.animal),
    weaponId: sanitizeWeapon(raw.weaponId),
    gearId: sanitizeGear(raw.gearId),
    isBot: Boolean(raw.isBot),
    botTakeover: Boolean(raw.botTakeover),
    x: cleanZero(raw.x),
    y: cleanZero(raw.y),
    aimAngle: cleanZero(raw.aimAngle),
    hp: cleanZero(raw.hp),
    maxHp: cleanZero(raw.maxHp),
    downed: Boolean(raw.downed),
    reviveProgress: cleanZero(raw.reviveProgress),
    invulnTimer: cleanZero(raw.invulnTimer),
    dashTimer: cleanZero(raw.dashTimer),
    dashCooldownTimer: cleanZero(raw.dashCooldownTimer),
    dashCooldownMax: cleanZero(raw.dashCooldownMax),
    hitFlashTimer: cleanZero(raw.hitFlashTimer),
    kills: cleanZero(raw.kills),
    damageDealt: cleanZero(raw.damageDealt),
    score: cleanZero(raw.score),
    revives: cleanZero(raw.revives),
    rerollsLeft: cleanZero(raw.rerollsLeft),
    comboCount: cleanZero(raw.comboCount),
    orbitalAngle: cleanZero(raw.orbitalAngle),
    orbitalLevel: cleanZero(raw.orbitalLevel),
    warmAuraLevel: cleanZero(raw.warmAuraLevel),
    droneLevel: cleanZero(raw.droneLevel),
    droneAngle: cleanZero(raw.droneAngle),
    teamAuraLevel: cleanZero(raw.teamAuraLevel),
    pylonBuffTimer: cleanZero(raw.pylonBuffTimer),
    skills,
  };
}

function validatePackedEnemy(raw: unknown): PackedEnemy | null {
  if (!isPlainObject(raw)) return null;
  if (!isSafeId(raw.id) || !isEnemyKind(raw.kind)) return null;
  if (
    !isNonNegInt(raw.bossTier) ||
    !isFiniteNumber(raw.x) ||
    !isFiniteNumber(raw.y) ||
    !isNonNegNumber(raw.radius) ||
    !isNonNegNumber(raw.hp) ||
    !isNonNegNumber(raw.maxHp) ||
    !isNonNegNumber(raw.hitFlashTimer) ||
    !isNonNegNumber(raw.slowTimer) ||
    !isTelegraphKind(raw.telegraphKind) ||
    !isNonNegNumber(raw.telegraphTimer)
  ) {
    return null;
  }
  return {
    id: raw.id,
    kind: raw.kind,
    isBoss: Boolean(raw.isBoss),
    bossTier: raw.bossTier,
    x: cleanZero(raw.x),
    y: cleanZero(raw.y),
    radius: cleanZero(raw.radius),
    hp: cleanZero(raw.hp),
    maxHp: cleanZero(raw.maxHp),
    hitFlashTimer: cleanZero(raw.hitFlashTimer),
    slowTimer: cleanZero(raw.slowTimer),
    telegraphKind: raw.telegraphKind,
    telegraphTimer: cleanZero(raw.telegraphTimer),
  };
}

function validatePackedProjectile(raw: unknown): PackedProjectile | null {
  if (!isPlainObject(raw)) return null;
  if (!isSafeId(raw.id) || !isProjectileWeaponId(raw.weaponId)) return null;
  if (
    !isFiniteNumber(raw.x) ||
    !isFiniteNumber(raw.y) ||
    !isNonNegNumber(raw.radius) ||
    typeof raw.color !== 'string' ||
    raw.color.length === 0 ||
    raw.color.length > 32
  ) {
    return null;
  }
  if (raw.angle !== undefined && !isFiniteNumber(raw.angle)) {
    return null;
  }
  return {
    id: raw.id,
    fromEnemy: Boolean(raw.fromEnemy),
    weaponId: raw.weaponId,
    x: cleanZero(raw.x),
    y: cleanZero(raw.y),
    radius: cleanZero(raw.radius),
    color: raw.color,
    boomerang: Boolean(raw.boomerang),
    ...(raw.angle !== undefined ? { angle: cleanZero(raw.angle) } : {}),
  };
}

function validatePackedXpGem(raw: unknown): PackedXpGem | null {
  if (!isPlainObject(raw)) return null;
  if (!isSafeId(raw.id) || !isXpGemTier(raw.tier)) return null;
  if (
    !isFiniteNumber(raw.x) ||
    !isFiniteNumber(raw.y) ||
    !isNonNegNumber(raw.value)
  ) {
    return null;
  }
  return {
    id: raw.id,
    x: cleanZero(raw.x),
    y: cleanZero(raw.y),
    tier: raw.tier,
    value: cleanZero(raw.value),
  };
}

function validatePackedCrate(raw: unknown): PackedCrate | null {
  if (!isPlainObject(raw)) return null;
  if (!isSafeId(raw.id)) return null;
  if (
    !isFiniteNumber(raw.x) ||
    !isFiniteNumber(raw.y) ||
    !isNonNegNumber(raw.radius) ||
    !isNonNegNumber(raw.hp) ||
    !isNonNegNumber(raw.maxHp) ||
    !isNonNegNumber(raw.hitFlashTimer)
  ) {
    return null;
  }
  return {
    id: raw.id,
    x: cleanZero(raw.x),
    y: cleanZero(raw.y),
    radius: cleanZero(raw.radius),
    hp: cleanZero(raw.hp),
    maxHp: cleanZero(raw.maxHp),
    hitFlashTimer: cleanZero(raw.hitFlashTimer),
  };
}

function validatePackedPickup(raw: unknown): PackedPickup | null {
  if (!isPlainObject(raw)) return null;
  if (!isSafeId(raw.id)) return null;
  if (raw.kind !== 'heal' && raw.kind !== 'magnet') return null;
  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) return null;
  return {
    id: raw.id,
    x: cleanZero(raw.x),
    y: cleanZero(raw.y),
    kind: raw.kind,
  };
}

function validatePackedHazard(raw: unknown): PackedHazard | null {
  if (!isPlainObject(raw)) return null;
  if (!isSafeId(raw.id)) return null;
  if (raw.shape !== 'circle' && raw.shape !== 'line') return null;
  if (
    !isFiniteNumber(raw.x) ||
    !isFiniteNumber(raw.y) ||
    !isNonNegNumber(raw.radius) ||
    !isNonNegNumber(raw.elapsed) ||
    !isNonNegNumber(raw.duration) ||
    typeof raw.color !== 'string' ||
    raw.color.length === 0 ||
    raw.color.length > 32
  ) {
    return null;
  }
  if (raw.endX !== undefined && !isFiniteNumber(raw.endX)) return null;
  if (raw.endY !== undefined && !isFiniteNumber(raw.endY)) return null;

  return {
    id: raw.id,
    x: cleanZero(raw.x),
    y: cleanZero(raw.y),
    radius: cleanZero(raw.radius),
    ...(raw.endX !== undefined ? { endX: cleanZero(raw.endX) } : {}),
    ...(raw.endY !== undefined ? { endY: cleanZero(raw.endY) } : {}),
    shape: raw.shape,
    elapsed: cleanZero(raw.elapsed),
    duration: cleanZero(raw.duration),
    fromEnemy: Boolean(raw.fromEnemy),
    color: raw.color,
  };
}

function validatePackedLightningArc(raw: unknown): PackedLightningArc | null {
  if (!isPlainObject(raw)) return null;
  if (
    !Array.isArray(raw.points) ||
    raw.points.length > 32 ||
    typeof raw.color !== 'string' ||
    raw.color.length === 0 ||
    raw.color.length > 32 ||
    !isNonNegNumber(raw.ttl) ||
    !isNonNegNumber(raw.maxTtl)
  ) {
    return null;
  }
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < raw.points.length; i += 1) {
    const pt = raw.points[i];
    if (!isPlainObject(pt) || !isFiniteNumber(pt.x) || !isFiniteNumber(pt.y)) {
      return null;
    }
    points.push({ x: cleanZero(pt.x), y: cleanZero(pt.y) });
  }
  return {
    points,
    color: raw.color,
    ttl: cleanZero(raw.ttl),
    maxTtl: cleanZero(raw.maxTtl),
  };
}

function validatePackedZone(raw: unknown): PackedZoneState | null {
  if (!isPlainObject(raw)) return null;
  if (!isSafeId(raw.id)) return null;
  if (!isNonNegNumber(raw.cooldownSec) || !isNonNegNumber(raw.activeTimerSec)) {
    return null;
  }
  return {
    id: raw.id,
    cooldownSec: cleanZero(raw.cooldownSec),
    activeTimerSec: cleanZero(raw.activeTimerSec),
  };
}

function validateArrayWithCap<T>(
  raw: unknown,
  cap: number,
  validateItem: (item: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(raw) || raw.length > cap) return null;
  const out: T[] = new Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    const item = validateItem(raw[i]);
    if (item === null) return null;
    out[i] = item;
  }
  return out;
}

/**
 * Validates an untrusted uncompressed `SurvivalSnapshotPayload` before passing
 * it into `SurvivalSnapshotInterpolator`.
 */
export function validateSurvivalSnapshotPayload(
  raw: unknown,
  activeMatchId: string,
): SurvivalSnapshotPayload | null {
  if (!isPlainObject(raw) || !isSafeId(activeMatchId)) return null;
  if (raw.matchId !== activeMatchId) return null;
  if (!isSurvivalMapId(raw.mapId)) return null;
  if (!isFiniteNumber(raw.seed)) return null;
  if (!isNonNegInt(raw.tick)) return null;
  if (!isNonNegNumber(raw.elapsedSec)) return null;
  if (!isSurvivalPhase(raw.phase)) return null;
  if (
    !isNonNegNumber(raw.score) ||
    !isNonNegInt(raw.teamLevel) ||
    raw.teamLevel < 1 ||
    !isNonNegNumber(raw.teamXp) ||
    !isNonNegNumber(raw.xpToNext) ||
    !isNonNegInt(raw.bossesSlain) ||
    !isNonNegNumber(raw.nextBossAtSec) ||
    !isNonNegNumber(raw.bossWarningSec) ||
    !isNonNegNumber(raw.levelUpTimerSec)
  ) {
    return null;
  }

  if (raw.bossWarningKind !== null && !isBossKind(raw.bossWarningKind)) {
    return null;
  }
  if (raw.activeBossId !== null && !isSafeId(raw.activeBossId)) {
    return null;
  }

  const pendingOffersByPlayer = validatePendingOffers(raw.pendingOffersByPlayer);
  if (!pendingOffersByPlayer) return null;

  if (!Array.isArray(raw.pickedPlayerIds) || raw.pickedPlayerIds.length > SURVIVAL_MAX_PLAYERS) {
    return null;
  }
  const pickedPlayerIds: string[] = [];
  for (let i = 0; i < raw.pickedPlayerIds.length; i += 1) {
    const pid = raw.pickedPlayerIds[i];
    if (!isSafeId(pid, 64)) return null;
    pickedPlayerIds.push(pid);
  }

  const players = validateArrayWithCap(
    raw.players,
    SURVIVAL_MAX_PLAYERS,
    validatePackedPlayer,
  );
  const enemies = validateArrayWithCap(
    raw.enemies,
    MAX_WIRE_ENEMIES,
    validatePackedEnemy,
  );
  const projectiles = validateArrayWithCap(
    raw.projectiles,
    MAX_WIRE_PROJECTILES,
    validatePackedProjectile,
  );
  const xpGems = validateArrayWithCap(
    raw.xpGems,
    MAX_WIRE_GEMS,
    validatePackedXpGem,
  );
  const crates = validateArrayWithCap(
    raw.crates,
    MAX_WIRE_CRATES,
    validatePackedCrate,
  );
  const pickups = validateArrayWithCap(
    raw.pickups,
    MAX_WIRE_PICKUPS,
    validatePackedPickup,
  );
  const hazards = validateArrayWithCap(
    raw.hazards,
    MAX_WIRE_HAZARDS,
    validatePackedHazard,
  );
  const lightningArcs = validateArrayWithCap(
    raw.lightningArcs,
    MAX_WIRE_ARCS,
    validatePackedLightningArc,
  );
  const zones = validateArrayWithCap(
    raw.zones,
    MAX_WIRE_ZONES,
    validatePackedZone,
  );

  if (
    !players ||
    !enemies ||
    !projectiles ||
    !xpGems ||
    !crates ||
    !pickups ||
    !hazards ||
    !lightningArcs ||
    !zones
  ) {
    return null;
  }

  return {
    matchId: activeMatchId,
    mapId: raw.mapId,
    seed: cleanZero(raw.seed),
    tick: raw.tick,
    elapsedSec: cleanZero(raw.elapsedSec),
    phase: raw.phase,
    isEndlessActive: Boolean(raw.isEndlessActive),
    score: cleanZero(raw.score),
    teamLevel: raw.teamLevel,
    teamXp: cleanZero(raw.teamXp),
    xpToNext: cleanZero(raw.xpToNext),
    bossesSlain: raw.bossesSlain,
    nextBossAtSec: cleanZero(raw.nextBossAtSec),
    bossWarningSec: cleanZero(raw.bossWarningSec),
    bossWarningKind: raw.bossWarningKind,
    activeBossId: raw.activeBossId,
    sandstormActive: Boolean(raw.sandstormActive),
    levelUpTimerSec: cleanZero(raw.levelUpTimerSec),
    pendingOffersByPlayer,
    pickedPlayerIds,
    players,
    enemies,
    projectiles,
    xpGems,
    crates,
    pickups,
    hazards,
    lightningArcs,
    zones,
  };
}

function packPlayer(p: PlayerEntity): PackedPlayer {
  return {
    id: p.id,
    name: p.name,
    animal: p.animal,
    weaponId: p.weaponId,
    gearId: p.gearId,
    isBot: p.isBot,
    botTakeover: p.botTakeover,
    x: round1(p.x),
    y: round1(p.y),
    aimAngle: round2(p.aimAngle),
    hp: round1(p.hp),
    maxHp: round1(p.maxHp),
    downed: p.downed,
    reviveProgress: round2(p.reviveProgress),
    invulnTimer: round2(p.invulnTimer),
    dashTimer: round2(p.dashTimer),
    dashCooldownTimer: round2(p.dashCooldownTimer),
    dashCooldownMax: round2(p.stats.dashCooldown),
    hitFlashTimer: round2(p.hitFlashTimer),
    kills: p.kills,
    damageDealt: roundInt(p.damageDealt),
    score: roundInt(p.score),
    revives: p.revives,
    rerollsLeft: p.rerollsLeft,
    comboCount: p.comboCount,
    orbitalAngle: round2(p.orbitalAngle),
    orbitalLevel: p.stats.orbitalLevel,
    warmAuraLevel: p.stats.warmAuraLevel,
    droneLevel: p.stats.droneLevel,
    droneAngle: round2(p.droneAngle),
    teamAuraLevel: p.stats.teamAuraLevel,
    pylonBuffTimer: round2(p.pylonBuffTimer),
    skills: { ...p.skills },
  };
}

function packEnemy(e: EnemyEntity): PackedEnemy {
  return {
    id: e.id,
    kind: e.kind,
    isBoss: e.isBoss,
    bossTier: e.bossTier,
    x: round1(e.x),
    y: round1(e.y),
    radius: round1(e.radius),
    hp: round1(e.hp),
    maxHp: round1(e.maxHp),
    hitFlashTimer: round2(e.hitFlashTimer),
    slowTimer: round2(e.slowTimer),
    telegraphKind: e.telegraphKind,
    telegraphTimer: round2(e.telegraphTimer),
  };
}

function packEnemiesCapped(
  enemies: readonly EnemyEntity[],
  players: readonly PlayerEntity[],
): PackedEnemy[] {
  if (enemies.length <= SURVIVAL_MAX_SNAPSHOT_ENEMIES) {
    return enemies.map(packEnemy);
  }

  const bossIndices: number[] = [];
  const normalIndices: number[] = [];
  for (let i = 0; i < enemies.length; i += 1) {
    if (enemies[i].isBoss) {
      bossIndices.push(i);
    } else {
      normalIndices.push(i);
    }
  }

  if (bossIndices.length >= SURVIVAL_MAX_SNAPSHOT_ENEMIES) {
    return bossIndices
      .slice(0, SURVIVAL_MAX_SNAPSHOT_ENEMIES)
      .map((idx) => packEnemy(enemies[idx]));
  }

  const livingPlayers = players.filter((p) => !p.downed);
  const anchors = livingPlayers.length > 0 ? livingPlayers : players;

  const scoredNormals = normalIndices.map((idx) => {
    const e = enemies[idx];
    let minDistSq = Infinity;
    if (anchors.length > 0) {
      for (let j = 0; j < anchors.length; j += 1) {
        const dx = e.x - anchors[j].x;
        const dy = e.y - anchors[j].y;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistSq) {
          minDistSq = distSq;
        }
      }
    } else {
      minDistSq = idx;
    }
    return { idx, minDistSq };
  });

  scoredNormals.sort((a, b) => a.minDistSq - b.minDistSq || a.idx - b.idx);

  const remaining = SURVIVAL_MAX_SNAPSHOT_ENEMIES - bossIndices.length;
  const keptIndices = [...bossIndices];
  for (let i = 0; i < remaining && i < scoredNormals.length; i += 1) {
    keptIndices.push(scoredNormals[i].idx);
  }
  keptIndices.sort((a, b) => a - b);

  return keptIndices.map((idx) => packEnemy(enemies[idx]));
}

function packProjectile(proj: ProjectileEntity): PackedProjectile {
  const hasVelocity =
    Number.isFinite(proj.vx) &&
    Number.isFinite(proj.vy) &&
    (proj.vx !== 0 || proj.vy !== 0);
  return {
    id: proj.id,
    fromEnemy: proj.fromEnemy,
    weaponId: proj.weaponId,
    x: round1(proj.x),
    y: round1(proj.y),
    radius: round1(proj.radius),
    color: proj.color,
    boomerang: proj.boomerang,
    ...(hasVelocity ? { angle: round2(Math.atan2(proj.vy, proj.vx)) } : {}),
  };
}

function packProjectilesCapped(
  projectiles: readonly ProjectileEntity[],
): PackedProjectile[] {
  if (projectiles.length <= SURVIVAL_MAX_SNAPSHOT_PROJECTILES) {
    return projectiles.map(packProjectile);
  }

  const enemyIndices: number[] = [];
  const playerIndices: number[] = [];
  for (let i = 0; i < projectiles.length; i += 1) {
    if (projectiles[i].fromEnemy) {
      enemyIndices.push(i);
    } else {
      playerIndices.push(i);
    }
  }

  let keptIndices: number[];
  if (enemyIndices.length >= SURVIVAL_MAX_SNAPSHOT_PROJECTILES) {
    keptIndices = enemyIndices.slice(-SURVIVAL_MAX_SNAPSHOT_PROJECTILES);
  } else {
    const remaining = SURVIVAL_MAX_SNAPSHOT_PROJECTILES - enemyIndices.length;
    const newestPlayers =
      remaining > 0 ? playerIndices.slice(-remaining) : [];
    keptIndices = [...enemyIndices, ...newestPlayers].sort((a, b) => a - b);
  }

  return keptIndices.map((idx) => packProjectile(projectiles[idx]));
}

function packXpGem(gem: XpGemEntity): PackedXpGem {
  return {
    id: gem.id,
    x: round1(gem.x),
    y: round1(gem.y),
    tier: gem.tier,
    value: gem.value,
  };
}

function packXpGemsCapped(gems: readonly XpGemEntity[]): PackedXpGem[] {
  if (gems.length <= SURVIVAL_MAX_SNAPSHOT_GEMS) {
    return gems.map(packXpGem);
  }

  const buckets: Record<XpGemEntity['tier'], number[]> = {
    gold: [],
    purple: [],
    blue: [],
    green: [],
  };

  for (let i = 0; i < gems.length; i += 1) {
    buckets[gems[i].tier].push(i);
  }

  const tierOrder: readonly XpGemEntity['tier'][] = [
    'gold',
    'purple',
    'blue',
    'green',
  ];
  const keptIndices: number[] = [];

  for (const tier of tierOrder) {
    const remaining = SURVIVAL_MAX_SNAPSHOT_GEMS - keptIndices.length;
    if (remaining <= 0) break;
    const bucket = buckets[tier];
    if (bucket.length <= remaining) {
      for (let i = 0; i < bucket.length; i += 1) {
        keptIndices.push(bucket[i]);
      }
    } else {
      const sorted = [...bucket].sort(
        (a, b) => gems[b].value - gems[a].value || b - a,
      );
      for (let i = 0; i < remaining; i += 1) {
        keptIndices.push(sorted[i]);
      }
    }
  }

  keptIndices.sort((a, b) => a - b);
  return keptIndices.map((idx) => packXpGem(gems[idx]));
}

function packCrate(crate: CrateEntity): PackedCrate {
  return {
    id: crate.id,
    x: round1(crate.x),
    y: round1(crate.y),
    radius: round1(crate.radius),
    hp: round1(crate.hp),
    maxHp: round1(crate.maxHp),
    hitFlashTimer: round2(crate.hitFlashTimer),
  };
}

function packPickup(pickup: PickupItemEntity): PackedPickup {
  return {
    id: pickup.id,
    x: round1(pickup.x),
    y: round1(pickup.y),
    kind: pickup.kind,
  };
}

function packHazard(hazard: HazardTelegraph): PackedHazard {
  return {
    id: hazard.id,
    x: round1(hazard.x),
    y: round1(hazard.y),
    radius: round1(hazard.radius),
    ...(hazard.endX !== undefined ? { endX: round1(hazard.endX) } : {}),
    ...(hazard.endY !== undefined ? { endY: round1(hazard.endY) } : {}),
    shape: hazard.shape,
    elapsed: round2(hazard.elapsed),
    duration: round2(hazard.duration),
    fromEnemy: hazard.fromEnemy,
    color: hazard.color,
  };
}

function packLightningArc(arc: LightningArcFx): PackedLightningArc {
  return {
    points: arc.points.map((pt) => ({
      x: round1(pt.x),
      y: round1(pt.y),
    })),
    color: arc.color,
    ttl: round2(arc.ttl),
    maxTtl: round2(arc.maxTtl),
  };
}

function packZone(zone: MapZone): PackedZoneState {
  return {
    id: zone.id,
    cooldownSec: round2(zone.cooldownSec),
    activeTimerSec: round2(zone.activeTimerSec),
  };
}

function clonePendingOffers(
  pending: Record<string, SkillOffer[]>,
): Record<string, SkillOffer[]> {
  const cloned: Record<string, SkillOffer[]> = {};
  for (const [playerId, offers] of Object.entries(pending)) {
    cloned[playerId] = offers.map((offer) => ({ ...offer }));
  }
  return cloned;
}

/**
 * Compresses a Host `SurvivalWorldState` into a snapshot by rounding
 * coordinates to 1 decimal place and capping enemies (160, Boss-first),
 * projectiles (120), and XP gems (120) without mutating the source world.
 */
export function packSurvivalSnapshot(
  world: SurvivalWorldState,
  tick: number,
): SurvivalSnapshotPayload {
  return {
    matchId: world.matchId,
    mapId: world.mapId,
    seed: world.seed,
    tick,
    elapsedSec: round2(world.elapsedSec),
    phase: world.phase,
    isEndlessActive: world.isEndlessActive,
    score: roundInt(world.score),
    teamLevel: world.teamLevel,
    teamXp: roundInt(world.teamXp),
    xpToNext: roundInt(world.xpToNext),
    bossesSlain: world.bossesSlain,
    nextBossAtSec: round2(world.nextBossAtSec),
    bossWarningSec: round2(world.bossWarningSec),
    bossWarningKind: world.bossWarningKind,
    activeBossId: world.activeBossId,
    sandstormActive:
      world.mapId === 'candy_canyon' && world.sandstormActiveTimer > 0,
    levelUpTimerSec: round2(world.levelUpTimerSec),
    pendingOffersByPlayer: clonePendingOffers(world.pendingOffersByPlayer),
    pickedPlayerIds: [...world.pickedPlayerIds],
    players: world.players.map(packPlayer),
    enemies: packEnemiesCapped(world.enemies, world.players),
    projectiles: packProjectilesCapped(world.projectiles),
    xpGems: packXpGemsCapped(world.xpGems),
    crates: world.crates.map(packCrate),
    pickups: world.pickups.map(packPickup),
    hazards: world.hazards.map(packHazard),
    lightningArcs: world.lightningArcs.map(packLightningArc),
    zones: world.zones.map(packZone),
  };
}

function encodePlayerTuple(p: PackedPlayer): WirePlayerTuple {
  const flags = (p.botTakeover ? 1 : 0) | (p.downed ? 2 : 0);
  const skillPairs: WireSkillPair[] = [];
  for (const [skillId, level] of Object.entries(p.skills)) {
    if (level === undefined) continue;
    const idx = SKILL_IDS.indexOf(skillId as SkillId);
    if (idx >= 0) {
      skillPairs.push([idx, level]);
    }
  }
  return [
    p.id,
    flags,
    p.x,
    p.y,
    p.aimAngle,
    p.hp,
    p.maxHp,
    p.reviveProgress,
    p.invulnTimer,
    p.dashTimer,
    p.dashCooldownTimer,
    p.dashCooldownMax,
    p.hitFlashTimer,
    p.kills,
    p.damageDealt,
    p.score,
    p.revives,
    p.rerollsLeft,
    p.comboCount,
    p.orbitalAngle,
    p.orbitalLevel,
    p.warmAuraLevel,
    p.droneLevel,
    p.droneAngle,
    p.teamAuraLevel,
    p.pylonBuffTimer,
    skillPairs,
  ];
}

function encodeEnemyTuple(e: PackedEnemy): WireEnemyTuple {
  const kindIdx = Math.max(0, ENEMY_KINDS.indexOf(e.kind));
  const teleIdx = Math.max(0, TELEGRAPH_KINDS.indexOf(e.telegraphKind));
  const flags = (e.isBoss ? 1 : 0) | (teleIdx << 1);

  const tail = [
    flags,
    e.bossTier,
    e.hitFlashTimer,
    e.slowTimer,
    e.telegraphTimer,
  ];
  let end = tail.length;
  while (end > 0 && tail[end - 1] === 0) {
    end -= 1;
  }

  const tuple: WireEnemyTuple = [
    e.id,
    kindIdx,
    e.x,
    e.y,
    e.radius,
    e.hp,
    e.maxHp,
  ];
  for (let i = 0; i < end; i += 1) {
    tuple.push(tail[i]);
  }
  return tuple;
}

function encodeProjectileTuple(pr: PackedProjectile): WireProjectileTuple {
  const weaponIdx = Math.max(0, PROJECTILE_WEAPON_IDS.indexOf(pr.weaponId));
  const colorVal = encodeColor(pr.color);
  const flags = (pr.fromEnemy ? 1 : 0) | (pr.boomerang ? 2 : 0);
  if (pr.angle !== undefined) {
    return [pr.id, weaponIdx, pr.x, pr.y, pr.radius, colorVal, flags, pr.angle];
  }
  return [pr.id, weaponIdx, pr.x, pr.y, pr.radius, colorVal, flags];
}

function encodeHazardTuple(h: PackedHazard): WireHazardTuple {
  const shapeIdx = h.shape === 'line' ? 1 : 0;
  const shapeFlags = shapeIdx | (h.fromEnemy ? 2 : 0);
  const colorVal = encodeColor(h.color);
  if (h.endX !== undefined || h.endY !== undefined) {
    return [
      h.id,
      h.x,
      h.y,
      h.radius,
      shapeFlags,
      h.elapsed,
      h.duration,
      colorVal,
      h.endX ?? null,
      h.endY ?? null,
    ];
  }
  return [
    h.id,
    h.x,
    h.y,
    h.radius,
    shapeFlags,
    h.elapsed,
    h.duration,
    colorVal,
  ];
}

/**
 * Encodes a `SurvivalSnapshotPayload` into a compact wire tuple packet,
 * stripping static player roster metadata and default zero/empty fields.
 */
export function encodeSnapshotWire(
  snapshot: SurvivalSnapshotPayload,
): SurvivalSnapshotWirePayload {
  const wire: SurvivalSnapshotWirePayload = {
    v: 1,
    m: snapshot.matchId,
    mp: Math.max(0, MAP_IDS.indexOf(snapshot.mapId)),
    s: snapshot.seed,
    t: snapshot.tick,
    e: snapshot.elapsedSec,
    ph: Math.max(0, PHASE_IDS.indexOf(snapshot.phase)),
    sc: snapshot.score,
    lv: snapshot.teamLevel,
    xp: snapshot.teamXp,
    nx: snapshot.xpToNext,
    bs: snapshot.bossesSlain,
    nb: snapshot.nextBossAtSec,
    p: snapshot.players.map(encodePlayerTuple),
    em: snapshot.enemies.map(encodeEnemyTuple),
    pr: snapshot.projectiles.map(encodeProjectileTuple),
    xg: snapshot.xpGems.map((g) => [
      g.id,
      g.x,
      g.y,
      Math.max(0, XP_GEM_TIERS.indexOf(g.tier)),
      g.value,
    ]),
  };

  if (snapshot.isEndlessActive) wire.en = 1;
  if (snapshot.bossWarningSec !== 0) wire.bw = snapshot.bossWarningSec;
  if (snapshot.bossWarningKind !== null) {
    const bk = BOSS_KINDS.indexOf(snapshot.bossWarningKind);
    if (bk >= 0) wire.bk = bk;
  }
  if (snapshot.activeBossId !== null) wire.ab = snapshot.activeBossId;
  if (snapshot.sandstormActive) wire.ss = 1;
  if (snapshot.levelUpTimerSec !== 0) wire.lt = snapshot.levelUpTimerSec;

  const offerEntries = Object.entries(snapshot.pendingOffersByPlayer);
  if (offerEntries.length > 0) {
    const po: Record<string, WireSkillOfferTuple[]> = {};
    for (const [playerId, offers] of offerEntries) {
      if (!isSafeId(playerId, 64)) continue;
      po[playerId] = offers.map((o) => [
        Math.max(0, SKILL_IDS.indexOf(o.skillId)),
        Math.max(0, SKILL_RARITIES.indexOf(o.rarity)),
        o.currentLevel,
        o.nextLevel,
        o.levelGain,
      ]);
    }
    wire.po = po;
  }

  if (snapshot.pickedPlayerIds.length > 0) {
    wire.pk = [...snapshot.pickedPlayerIds];
  }
  if (snapshot.crates.length > 0) {
    wire.cr = snapshot.crates.map((c) =>
      c.hitFlashTimer !== 0
        ? [c.id, c.x, c.y, c.radius, c.hp, c.maxHp, c.hitFlashTimer]
        : [c.id, c.x, c.y, c.radius, c.hp, c.maxHp],
    );
  }
  if (snapshot.pickups.length > 0) {
    wire.pi = snapshot.pickups.map((pk) => [
      pk.id,
      pk.x,
      pk.y,
      pk.kind === 'magnet' ? 1 : 0,
    ]);
  }
  if (snapshot.hazards.length > 0) {
    wire.hz = snapshot.hazards.map(encodeHazardTuple);
  }
  if (snapshot.lightningArcs.length > 0) {
    wire.la = snapshot.lightningArcs.map((arc) => {
      const flat: number[] = new Array(arc.points.length * 2);
      for (let i = 0; i < arc.points.length; i += 1) {
        flat[i * 2] = arc.points[i].x;
        flat[i * 2 + 1] = arc.points[i].y;
      }
      return [flat, encodeColor(arc.color), arc.ttl, arc.maxTtl];
    });
  }
  if (snapshot.zones.length > 0) {
    wire.zn = snapshot.zones.map((z) => [z.id, z.cooldownSec, z.activeTimerSec]);
  }

  return wire;
}

/**
 * Checks whether an unknown broadcast payload uses the compact `v: 1` wire format.
 */
export function isSnapshotWirePayload(raw: unknown): boolean {
  return isPlainObject(raw) && raw.v === 1;
}

function decodePlayerTuple(
  tuple: unknown,
  rosterById: SnapshotRosterLookup,
): PackedPlayer | null {
  if (!Array.isArray(tuple) || tuple.length !== 27) return null;
  const id = tuple[0];
  if (!isSafeId(id, 64)) return null;

  const flags = tuple[1];
  if (!isNonNegInt(flags)) return null;

  for (let i = 2; i <= 25; i += 1) {
    if (!isFiniteNumber(tuple[i])) return null;
  }
  // Ensure non-negative counters/timers/hp
  for (const idx of [
    5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 24, 25,
  ]) {
    if ((tuple[idx] as number) < 0) return null;
  }

  const rawSkills = tuple[26];
  if (!Array.isArray(rawSkills) || rawSkills.length > SKILL_IDS.length) {
    return null;
  }
  const skills: Partial<Record<SkillId, number>> = {};
  for (let i = 0; i < rawSkills.length; i += 1) {
    const pair = rawSkills[i];
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const skillIdx = pair[0];
    const level = pair[1];
    if (
      !isNonNegInt(skillIdx) ||
      skillIdx >= SKILL_IDS.length ||
      !isNonNegNumber(level)
    ) {
      return null;
    }
    skills[SKILL_IDS[skillIdx]] = cleanZero(level);
  }

  const meta = lookupRosterMeta(rosterById, id);

  return {
    id,
    name: meta ? sanitizeDisplayName(meta.name) : 'Người chơi',
    animal: meta ? sanitizeAnimal(meta.animal) : 'dog',
    weaponId: meta ? sanitizeWeapon(meta.weaponId) : 'candy_smg',
    gearId: meta ? sanitizeGear(meta.gearId) : 'ice_skates',
    isBot: meta ? Boolean(meta.isBot) : false,
    botTakeover: (flags & 1) !== 0,
    x: cleanZero(tuple[2] as number),
    y: cleanZero(tuple[3] as number),
    aimAngle: cleanZero(tuple[4] as number),
    hp: cleanZero(tuple[5] as number),
    maxHp: cleanZero(tuple[6] as number),
    downed: (flags & 2) !== 0,
    reviveProgress: cleanZero(tuple[7] as number),
    invulnTimer: cleanZero(tuple[8] as number),
    dashTimer: cleanZero(tuple[9] as number),
    dashCooldownTimer: cleanZero(tuple[10] as number),
    dashCooldownMax: cleanZero(tuple[11] as number),
    hitFlashTimer: cleanZero(tuple[12] as number),
    kills: cleanZero(tuple[13] as number),
    damageDealt: cleanZero(tuple[14] as number),
    score: cleanZero(tuple[15] as number),
    revives: cleanZero(tuple[16] as number),
    rerollsLeft: cleanZero(tuple[17] as number),
    comboCount: cleanZero(tuple[18] as number),
    orbitalAngle: cleanZero(tuple[19] as number),
    orbitalLevel: cleanZero(tuple[20] as number),
    warmAuraLevel: cleanZero(tuple[21] as number),
    droneLevel: cleanZero(tuple[22] as number),
    droneAngle: cleanZero(tuple[23] as number),
    teamAuraLevel: cleanZero(tuple[24] as number),
    pylonBuffTimer: cleanZero(tuple[25] as number),
    skills,
  };
}

function decodeEnemyTuple(tuple: unknown): PackedEnemy | null {
  if (!Array.isArray(tuple) || tuple.length < 7 || tuple.length > 12) {
    return null;
  }
  const id = tuple[0];
  const kindIdx = tuple[1];
  const x = tuple[2];
  const y = tuple[3];
  const radius = tuple[4];
  const hp = tuple[5];
  const maxHp = tuple[6];
  if (
    !isSafeId(id) ||
    !isNonNegInt(kindIdx) ||
    kindIdx >= ENEMY_KINDS.length ||
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isNonNegNumber(radius) ||
    !isNonNegNumber(hp) ||
    !isNonNegNumber(maxHp)
  ) {
    return null;
  }

  const flags = tuple.length > 7 ? tuple[7] : 0;
  const bossTier = tuple.length > 8 ? tuple[8] : 0;
  const hitFlashTimer = tuple.length > 9 ? tuple[9] : 0;
  const slowTimer = tuple.length > 10 ? tuple[10] : 0;
  const telegraphTimer = tuple.length > 11 ? tuple[11] : 0;

  if (
    !isNonNegInt(flags) ||
    !isNonNegInt(bossTier) ||
    !isNonNegNumber(hitFlashTimer) ||
    !isNonNegNumber(slowTimer) ||
    !isNonNegNumber(telegraphTimer)
  ) {
    return null;
  }

  const telegraphIdx = (flags >> 1) & 7;
  if (telegraphIdx >= TELEGRAPH_KINDS.length) return null;

  return {
    id,
    kind: ENEMY_KINDS[kindIdx],
    isBoss: (flags & 1) !== 0,
    bossTier,
    x: cleanZero(x),
    y: cleanZero(y),
    radius: cleanZero(radius),
    hp: cleanZero(hp),
    maxHp: cleanZero(maxHp),
    hitFlashTimer: cleanZero(hitFlashTimer),
    slowTimer: cleanZero(slowTimer),
    telegraphKind: TELEGRAPH_KINDS[telegraphIdx],
    telegraphTimer: cleanZero(telegraphTimer),
  };
}

function decodeProjectileTuple(tuple: unknown): PackedProjectile | null {
  if (!Array.isArray(tuple) || (tuple.length !== 7 && tuple.length !== 8)) {
    return null;
  }
  const id = tuple[0];
  const weaponIdx = tuple[1];
  const x = tuple[2];
  const y = tuple[3];
  const radius = tuple[4];
  const color = decodeColor(tuple[5]);
  const flags = tuple[6];

  if (
    !isSafeId(id) ||
    !isNonNegInt(weaponIdx) ||
    weaponIdx >= PROJECTILE_WEAPON_IDS.length ||
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isNonNegNumber(radius) ||
    color === null ||
    !isNonNegInt(flags)
  ) {
    return null;
  }

  let angle: number | undefined;
  if (tuple.length === 8) {
    if (!isFiniteNumber(tuple[7])) return null;
    angle = cleanZero(tuple[7]);
  }

  return {
    id,
    fromEnemy: (flags & 1) !== 0,
    weaponId: PROJECTILE_WEAPON_IDS[weaponIdx],
    x: cleanZero(x),
    y: cleanZero(y),
    radius: cleanZero(radius),
    color,
    boomerang: (flags & 2) !== 0,
    ...(angle !== undefined ? { angle } : {}),
  };
}

function decodeXpGemTuple(tuple: unknown): PackedXpGem | null {
  if (!Array.isArray(tuple) || tuple.length !== 5) return null;
  const id = tuple[0];
  const x = tuple[1];
  const y = tuple[2];
  const tierIdx = tuple[3];
  const value = tuple[4];
  if (
    !isSafeId(id) ||
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isNonNegInt(tierIdx) ||
    tierIdx >= XP_GEM_TIERS.length ||
    !isNonNegNumber(value)
  ) {
    return null;
  }
  return {
    id,
    x: cleanZero(x),
    y: cleanZero(y),
    tier: XP_GEM_TIERS[tierIdx],
    value: cleanZero(value),
  };
}

function decodeCrateTuple(tuple: unknown): PackedCrate | null {
  if (!Array.isArray(tuple) || (tuple.length !== 6 && tuple.length !== 7)) {
    return null;
  }
  const id = tuple[0];
  const x = tuple[1];
  const y = tuple[2];
  const radius = tuple[3];
  const hp = tuple[4];
  const maxHp = tuple[5];
  const hitFlashTimer = tuple.length === 7 ? tuple[6] : 0;
  if (
    !isSafeId(id) ||
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isNonNegNumber(radius) ||
    !isNonNegNumber(hp) ||
    !isNonNegNumber(maxHp) ||
    !isNonNegNumber(hitFlashTimer)
  ) {
    return null;
  }
  return {
    id,
    x: cleanZero(x),
    y: cleanZero(y),
    radius: cleanZero(radius),
    hp: cleanZero(hp),
    maxHp: cleanZero(maxHp),
    hitFlashTimer: cleanZero(hitFlashTimer),
  };
}

function decodePickupTuple(tuple: unknown): PackedPickup | null {
  if (!Array.isArray(tuple) || tuple.length !== 4) return null;
  const id = tuple[0];
  const x = tuple[1];
  const y = tuple[2];
  const kindIdx = tuple[3];
  if (
    !isSafeId(id) ||
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isNonNegInt(kindIdx) ||
    kindIdx >= PICKUP_KINDS.length
  ) {
    return null;
  }
  return {
    id,
    x: cleanZero(x),
    y: cleanZero(y),
    kind: PICKUP_KINDS[kindIdx],
  };
}

function decodeHazardTuple(tuple: unknown): PackedHazard | null {
  if (!Array.isArray(tuple) || (tuple.length !== 8 && tuple.length !== 10)) {
    return null;
  }
  const id = tuple[0];
  const x = tuple[1];
  const y = tuple[2];
  const radius = tuple[3];
  const shapeFlags = tuple[4];
  const elapsed = tuple[5];
  const duration = tuple[6];
  const color = decodeColor(tuple[7]);

  if (
    !isSafeId(id) ||
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isNonNegNumber(radius) ||
    !isNonNegInt(shapeFlags) ||
    !isNonNegNumber(elapsed) ||
    !isNonNegNumber(duration) ||
    color === null
  ) {
    return null;
  }

  const shapeIdx = shapeFlags & 1;
  if (shapeIdx >= HAZARD_SHAPES.length) return null;

  let endX: number | undefined;
  let endY: number | undefined;
  if (tuple.length === 10) {
    if (tuple[8] !== null) {
      if (!isFiniteNumber(tuple[8])) return null;
      endX = cleanZero(tuple[8]);
    }
    if (tuple[9] !== null) {
      if (!isFiniteNumber(tuple[9])) return null;
      endY = cleanZero(tuple[9]);
    }
  }

  return {
    id,
    x: cleanZero(x),
    y: cleanZero(y),
    radius: cleanZero(radius),
    ...(endX !== undefined ? { endX } : {}),
    ...(endY !== undefined ? { endY } : {}),
    shape: HAZARD_SHAPES[shapeIdx],
    elapsed: cleanZero(elapsed),
    duration: cleanZero(duration),
    fromEnemy: (shapeFlags & 2) !== 0,
    color,
  };
}

function decodeLightningArcTuple(tuple: unknown): PackedLightningArc | null {
  if (!Array.isArray(tuple) || tuple.length !== 4) return null;
  const flatPoints = tuple[0];
  const color = decodeColor(tuple[1]);
  const ttl = tuple[2];
  const maxTtl = tuple[3];

  if (
    !Array.isArray(flatPoints) ||
    flatPoints.length % 2 !== 0 ||
    flatPoints.length > 64 ||
    color === null ||
    !isNonNegNumber(ttl) ||
    !isNonNegNumber(maxTtl)
  ) {
    return null;
  }

  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < flatPoints.length; i += 2) {
    const px = flatPoints[i];
    const py = flatPoints[i + 1];
    if (!isFiniteNumber(px) || !isFiniteNumber(py)) return null;
    points.push({ x: cleanZero(px), y: cleanZero(py) });
  }

  return {
    points,
    color,
    ttl: cleanZero(ttl),
    maxTtl: cleanZero(maxTtl),
  };
}

function decodeZoneTuple(tuple: unknown): PackedZoneState | null {
  if (!Array.isArray(tuple) || tuple.length !== 3) return null;
  const id = tuple[0];
  const cooldownSec = tuple[1];
  const activeTimerSec = tuple[2];
  if (
    !isSafeId(id) ||
    !isNonNegNumber(cooldownSec) ||
    !isNonNegNumber(activeTimerSec)
  ) {
    return null;
  }
  return {
    id,
    cooldownSec: cleanZero(cooldownSec),
    activeTimerSec: cleanZero(activeTimerSec),
  };
}

/**
 * Validates and decodes a compact `v: 1` wire snapshot packet into a verified
 * `SurvivalSnapshotPayload`, hydrating static player fields from `rosterById`.
 */
export function decodeSnapshotWire(
  raw: unknown,
  rosterById: SnapshotRosterLookup,
  activeMatchId: string,
): SurvivalSnapshotPayload | null {
  if (!isPlainObject(raw) || raw.v !== 1 || !isSafeId(activeMatchId)) {
    return null;
  }
  if (raw.m !== activeMatchId) return null;

  const mapIdx = raw.mp;
  const phaseIdx = raw.ph;
  if (
    !isNonNegInt(mapIdx) ||
    mapIdx >= MAP_IDS.length ||
    !isFiniteNumber(raw.s) ||
    !isNonNegInt(raw.t) ||
    !isNonNegNumber(raw.e) ||
    !isNonNegInt(phaseIdx) ||
    phaseIdx >= PHASE_IDS.length ||
    !isNonNegNumber(raw.sc) ||
    !isNonNegInt(raw.lv) ||
    raw.lv < 1 ||
    !isNonNegNumber(raw.xp) ||
    !isNonNegNumber(raw.nx) ||
    !isNonNegInt(raw.bs) ||
    !isNonNegNumber(raw.nb)
  ) {
    return null;
  }

  const bossWarningSec = raw.bw !== undefined ? raw.bw : 0;
  const levelUpTimerSec = raw.lt !== undefined ? raw.lt : 0;
  if (!isNonNegNumber(bossWarningSec) || !isNonNegNumber(levelUpTimerSec)) {
    return null;
  }

  let bossWarningKind: BossKind | null = null;
  if (raw.bk !== undefined) {
    if (!isNonNegInt(raw.bk) || raw.bk >= BOSS_KINDS.length) return null;
    bossWarningKind = BOSS_KINDS[raw.bk];
  }

  let activeBossId: string | null = null;
  if (raw.ab !== undefined) {
    if (!isSafeId(raw.ab)) return null;
    activeBossId = raw.ab;
  }

  const pendingOffersByPlayer: Record<string, SkillOffer[]> = {};
  if (raw.po !== undefined) {
    if (!isPlainObject(raw.po)) return null;
    for (const [playerId, rawOffers] of Object.entries(raw.po)) {
      if (
        !isSafeId(playerId, 64) ||
        !Array.isArray(rawOffers) ||
        rawOffers.length > 6
      ) {
        return null;
      }
      const offers: SkillOffer[] = [];
      for (let i = 0; i < rawOffers.length; i += 1) {
        const tuple = rawOffers[i];
        if (!Array.isArray(tuple) || tuple.length !== 5) return null;
        const skillIdx = tuple[0];
        const rarityIdx = tuple[1];
        const currentLevel = tuple[2];
        const nextLevel = tuple[3];
        const levelGain = tuple[4];
        if (
          !isNonNegInt(skillIdx) ||
          skillIdx >= SKILL_IDS.length ||
          !isNonNegInt(rarityIdx) ||
          rarityIdx >= SKILL_RARITIES.length ||
          !isNonNegInt(currentLevel) ||
          !isNonNegInt(nextLevel) ||
          !isNonNegInt(levelGain)
        ) {
          return null;
        }
        offers.push({
          skillId: SKILL_IDS[skillIdx],
          rarity: SKILL_RARITIES[rarityIdx],
          currentLevel,
          nextLevel,
          levelGain,
        });
      }
      pendingOffersByPlayer[playerId] = offers;
    }
  }

  const pickedPlayerIds: string[] = [];
  if (raw.pk !== undefined) {
    if (!Array.isArray(raw.pk) || raw.pk.length > SURVIVAL_MAX_PLAYERS) {
      return null;
    }
    for (let i = 0; i < raw.pk.length; i += 1) {
      const pid = raw.pk[i];
      if (!isSafeId(pid, 64)) return null;
      pickedPlayerIds.push(pid);
    }
  }

  const players = validateArrayWithCap(raw.p, SURVIVAL_MAX_PLAYERS, (item) =>
    decodePlayerTuple(item, rosterById),
  );
  const enemies = validateArrayWithCap(
    raw.em,
    MAX_WIRE_ENEMIES,
    decodeEnemyTuple,
  );
  const projectiles = validateArrayWithCap(
    raw.pr,
    MAX_WIRE_PROJECTILES,
    decodeProjectileTuple,
  );
  const xpGems = validateArrayWithCap(raw.xg, MAX_WIRE_GEMS, decodeXpGemTuple);
  const crates =
    raw.cr !== undefined
      ? validateArrayWithCap(raw.cr, MAX_WIRE_CRATES, decodeCrateTuple)
      : [];
  const pickups =
    raw.pi !== undefined
      ? validateArrayWithCap(raw.pi, MAX_WIRE_PICKUPS, decodePickupTuple)
      : [];
  const hazards =
    raw.hz !== undefined
      ? validateArrayWithCap(raw.hz, MAX_WIRE_HAZARDS, decodeHazardTuple)
      : [];
  const lightningArcs =
    raw.la !== undefined
      ? validateArrayWithCap(raw.la, MAX_WIRE_ARCS, decodeLightningArcTuple)
      : [];
  const zones =
    raw.zn !== undefined
      ? validateArrayWithCap(raw.zn, MAX_WIRE_ZONES, decodeZoneTuple)
      : [];

  if (
    !players ||
    !enemies ||
    !projectiles ||
    !xpGems ||
    !crates ||
    !pickups ||
    !hazards ||
    !lightningArcs ||
    !zones
  ) {
    return null;
  }

  return {
    matchId: activeMatchId,
    mapId: MAP_IDS[mapIdx],
    seed: cleanZero(raw.s),
    tick: raw.t,
    elapsedSec: cleanZero(raw.e),
    phase: PHASE_IDS[phaseIdx],
    isEndlessActive: raw.en === 1,
    score: cleanZero(raw.sc),
    teamLevel: raw.lv,
    teamXp: cleanZero(raw.xp),
    xpToNext: cleanZero(raw.nx),
    bossesSlain: raw.bs,
    nextBossAtSec: cleanZero(raw.nb),
    bossWarningSec: cleanZero(bossWarningSec),
    bossWarningKind,
    activeBossId,
    sandstormActive: raw.ss === 1,
    levelUpTimerSec: cleanZero(levelUpTimerSec),
    pendingOffersByPlayer,
    pickedPlayerIds,
    players,
    enemies,
    projectiles,
    xpGems,
    crates,
    pickups,
    hazards,
    lightningArcs,
    zones,
  };
}
