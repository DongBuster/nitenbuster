import type { AnimalId } from '../../engine/types.ts';

export type SurvivalMapId =
  | 'winter_cabin'
  | 'candy_canyon'
  | 'crystal_cavern'
  | 'endless_abyss';

export type SurvivalMode = 'solo' | 'bot_team' | 'online_coop';

export type WeaponId =
  | 'candy_smg'
  | 'chestnut_shotgun'
  | 'frost_bow'
  | 'lightning_staff'
  | 'candy_launcher'
  | 'snow_boomerang';

export type GearId =
  | 'ice_skates'
  | 'plush_armor'
  | 'crystal_magnet'
  | 'golden_scope';

export type SkillId =
  | 'multishot'
  | 'fire_rate'
  | 'damage_up'
  | 'pierce_up'
  | 'ricochet'
  | 'orbital_ice'
  | 'warm_aura'
  | 'candy_meteor'
  | 'plush_drone'
  | 'max_hp'
  | 'vampirism'
  | 'magnet_range'
  | 'agility'
  | 'team_aura'
  | 'whirlwind_blade'
  | 'vital_regen'
  // Map 1: Winter Cabin exclusives
  | 'frost_nova'
  | 'ice_shatter'
  | 'glacial_spear'
  | 'blizzard_ward'
  // Map 2: Candy Canyon exclusives
  | 'sugar_rush'
  | 'pepper_bomb'
  | 'caramel_nova'
  | 'popcorn_barrage'
  | 'honey_shield'
  // Map 3: Crystal Cavern exclusives
  | 'overcharge'
  | 'crystal_shield'
  | 'prism_chain'
  | 'gem_greed'
  | 'void_pulse'
  | 'laser_turret'
  | 'prism_focus';

export type SkillCategory = 'weapon' | 'secondary' | 'survival';

export type SkillRarity = 'common' | 'rare' | 'epic';

export type SkillMapScope = 'core' | 'winter_cabin' | 'candy_canyon' | 'crystal_cavern';

export type BossKind =
  // Winter Cabin
  | 'boss_slime_king'
  | 'boss_frost_bear'
  | 'boss_snow_dragon'
  // Candy Canyon
  | 'boss_jelly_king'
  | 'boss_candy_scorpion'
  | 'boss_sugar_pharaoh'
  // Crystal Cavern
  | 'boss_quartz_lord'
  | 'boss_crystal_golem'
  | 'boss_void_dragon';

export type EnemyKind =
  | 'slime'
  | 'bat'
  | 'wolf'
  | 'owl_mage'
  | 'golem'
  | 'bomber'
  | BossKind;

export type SurvivalPhase = 'playing' | 'levelup' | 'victory' | 'gameover';

export interface SurvivalInput {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  manualAim: boolean;
  dashPressed: boolean;
}

export interface SkillOffer {
  skillId: SkillId;
  rarity: SkillRarity;
  currentLevel: number;
  nextLevel: number;
  levelGain: number;
}

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  shortName: string;
  description: string;
  color: string;
  damage: number;
  fireRate: number;
  projectilesPerShot: number;
  pierce: number;
  range: number;
  projectileSpeed: number;
  spreadDeg: number;
  knockback: number;
  aoeRadius: number;
  slowPct: number;
  slowDurationSec: number;
  chainCount: number;
  chainRange: number;
  boomerang: boolean;
  statBars: {
    damage: number;
    speed: number;
    crowd: number;
  };
}

export interface GearSpec {
  id: GearId;
  name: string;
  description: string;
  badge: string;
  color: string;
  moveSpeedPct: number;
  dashCooldownPct: number;
  maxHpBonus: number;
  damageReductionPct: number;
  pickupRadiusPct: number;
  xpBonusPct: number;
  critChance: number;
  fireRatePct: number;
}

export interface SkillSpec {
  id: SkillId;
  name: string;
  category: SkillCategory;
  rarity: SkillRarity;
  mapScope: SkillMapScope;
  maxLevel: number;
  description: string;
  perLevelSummary: string;
  color: string;
}

export interface DerivedPlayerStats {
  maxHp: number;
  moveSpeed: number;
  dashCooldown: number;
  damageReduction: number;
  pickupRadius: number;
  xpMultiplier: number;
  critChance: number;
  critMultiplier: number;
  fireRate: number;
  damageMultiplier: number;
  bonusProjectiles: number;
  bonusPierce: number;
  projectileScale: number;
  ricochetCount: number;
  hpRegenPerSec: number;
  orbitalLevel: number;
  warmAuraLevel: number;
  meteorLevel: number;
  droneLevel: number;
  vampirismLevel: number;
  teamAuraLevel: number;
  whirlwindBladeLevel: number;
  vitalRegenLevel: number;
  frostNovaLevel: number;
  iceShatterLevel: number;
  glacialSpearLevel: number;
  blizzardWardLevel: number;
  sugarRushLevel: number;
  pepperBombLevel: number;
  caramelNovaLevel: number;
  popcornBarrageLevel: number;
  honeyShieldLevel: number;
  overchargeLevel: number;
  crystalShieldLevel: number;
  prismChainLevel: number;
  gemGreedLevel: number;
  voidPulseLevel: number;
  laserTurretLevel: number;
  prismFocusLevel: number;
}

export interface MapObstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
  kind: 'tree' | 'rock' | 'cabin' | 'cactus' | 'crystal' | 'pillar';
}

export interface MapZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  kind: 'ice' | 'sandstorm_beacon' | 'crystal_pylon' | 'score_pad';
  cooldownSec: number;
  activeTimerSec: number;
}

export interface ScenarioChapterMeta {
  id: 'wave1' | 'wave2' | 'wave3';
  order: 1 | 2 | 3;
  title: string;
  timeRangeLabel: string;
  bossAtSec: number;
  bossKind: BossKind;
  summary: string;
  enemyHint: string;
  bossRewardLabel: string;
}

export interface MapScenarioMeta {
  headline: string;
  chapters: readonly ScenarioChapterMeta[];
  endlessSummary?: string;
}

export interface SurvivalMapMeta {
  id: SurvivalMapId;
  order: number;
  name: string;
  subtitle: string;
  description: string;
  mechanicSummary: string;
  scenario: MapScenarioMeta;
  isEndless: boolean;
  targetDurationSec: number;
  difficultyStars: 1 | 2 | 3 | 4;
  difficultyLabel: string;
  difficulty: {
    hpMult: number;
    damageMult: number;
    spawnRateMult: number;
    bossHpMult: number;
  };
  cookieMultiplier: number;
  bossRotation: readonly BossKind[];
  finalBossKind: BossKind;
  theme: {
    bg: string;
    grid: string;
    accent: string;
    obstaclePrimary: string;
    obstacleSecondary: string;
    zoneColor: string;
  };
}

export interface PlayerEntity {
  id: string;
  name: string;
  animal: AnimalId;
  weaponId: WeaponId;
  gearId: GearId;
  isBot: boolean;
  botTakeover: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  aimAngle: number;
  hp: number;
  maxHp: number;
  downed: boolean;
  reviveProgress: number;
  invulnTimer: number;
  dashTimer: number;
  dashCooldownTimer: number;
  dashDirX: number;
  dashDirY: number;
  fireCooldown: number;
  hitFlashTimer: number;
  skills: Partial<Record<SkillId, number>>;
  skillPower: Partial<Record<SkillId, number>>;
  rerollsLeft: number;
  kills: number;
  damageDealt: number;
  score: number;
  revives: number;
  vampirismKillCounter: number;
  orbitalAngle: number;
  warmAuraTimer: number;
  meteorTimer: number;
  droneTimer: number;
  droneAngle: number;
  frostNovaTimer: number;
  caramelNovaTimer: number;
  prismChainTimer: number;
  voidPulseTimer: number;
  whirlwindBladeTimer: number;
  glacialSpearTimer: number;
  popcornBarrageTimer: number;
  laserTurretTimer: number;
  vitalRegenTimer: number;
  crystalShieldCooldown: number;
  blizzardWardCooldown: number;
  honeyShieldCooldown: number;
  honeyShieldReady: boolean;
  teamAuraHealTimer: number;
  teamAuraBuffTimer: number;
  pylonBuffTimer: number;
  comboCount: number;
  comboTimer: number;
  stats: DerivedPlayerStats;
}

export interface EnemyEntity {
  id: string;
  kind: EnemyKind;
  isBoss: boolean;
  bossTier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  xpValue: number;
  scoreValue: number;
  hitFlashTimer: number;
  slowTimer: number;
  slowFactor: number;
  attackCooldown: number;
  stateTimer: number;
  dashVx: number;
  dashVy: number;
  telegraphX: number;
  telegraphY: number;
  telegraphTimer: number;
  telegraphRadius: number;
  telegraphKind: 'none' | 'lunge' | 'explode' | 'slam' | 'charge' | 'volley';
  chargeRemaining: number;
}

export interface ProjectileEntity {
  id: string;
  ownerId: string;
  fromEnemy: boolean;
  weaponId:
    | WeaponId
    | 'drone'
    | 'whirlwind_blade'
    | 'glacial_spear'
    | 'popcorn_barrage'
    | 'enemy_orb'
    | 'enemy_dragon';
  x: number;
  y: number;
  vx: number;
  vy: number;
  startX: number;
  startY: number;
  radius: number;
  damage: number;
  isCrit: boolean;
  pierceLeft: number;
  ricochetLeft: number;
  maxRange: number;
  traveled: number;
  ttl: number;
  knockback: number;
  aoeRadius: number;
  slowPct: number;
  slowDurationSec: number;
  boomerang: boolean;
  returning: boolean;
  hitIds: string[];
  color: string;
}

export interface XpGemEntity {
  id: string;
  x: number;
  y: number;
  value: number;
  tier: 'green' | 'blue' | 'purple' | 'gold';
  magnetizedBy: string | null;
}

export interface CrateEntity {
  id: string;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  dropKind: 'heal' | 'magnet' | 'xp_chest';
  hitFlashTimer: number;
}

export interface PickupItemEntity {
  id: string;
  x: number;
  y: number;
  kind: 'heal' | 'magnet';
  ttl: number;
}

export interface HazardTelegraph {
  id: string;
  x: number;
  y: number;
  radius: number;
  endX?: number;
  endY?: number;
  shape: 'circle' | 'line';
  elapsed: number;
  duration: number;
  damage: number;
  fromEnemy: boolean;
  ownerId?: string;
  color: string;
  resolved: boolean;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  ttl: number;
  maxTtl: number;
  isCrit: boolean;
}

export interface ParticleFx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  ttl: number;
  maxTtl: number;
}

export interface LightningArcFx {
  points: Array<{ x: number; y: number }>;
  color: string;
  ttl: number;
  maxTtl: number;
}

export type VisualFxKind =
  | 'frost_nova'
  | 'caramel_nova'
  | 'void_pulse'
  | 'meteor_impact'
  | 'popcorn_pop'
  | 'laser_beam'
  | 'shield_break'
  | 'blizzard_counter'
  | 'level_heal';

export interface VisualFxEntity {
  kind: VisualFxKind;
  x: number;
  y: number;
  radius: number;
  ttl: number;
  maxTtl: number;
  endX?: number;
  endY?: number;
}

export interface SkillCooldownState {
  remaining: number;
  max: number;
}

export type SurvivalSimEvent =
  | { type: 'shoot'; weaponId?: WeaponId }
  | { type: 'hit' }
  | { type: 'enemy_kill' }
  | { type: 'xp_pickup' }
  | { type: 'level_up' }
  | { type: 'boss_warn'; bossKind?: BossKind }
  | { type: 'boss_spawn'; bossKind?: BossKind }
  | { type: 'boss_kill'; bossKind?: BossKind }
  | { type: 'dash' }
  | { type: 'player_down' }
  | { type: 'player_revive' }
  | { type: 'crate_break' }
  | { type: 'victory' }
  | { type: 'gameover' };

export interface SurvivalWorldState {
  matchId: string;
  mode: SurvivalMode;
  mapId: SurvivalMapId;
  seed: number;
  rngState: number;
  nextEntityId: number;
  phase: SurvivalPhase;
  elapsedSec: number;
  isEndlessActive: boolean;
  score: number;
  teamLevel: number;
  teamXp: number;
  xpToNext: number;
  pendingOffersByPlayer: Record<string, SkillOffer[]>;
  pickedPlayerIds: string[];
  levelUpTimerSec: number;
  levelUpGuaranteeRare: boolean;
  activeLevelUpGuaranteeRare: boolean;
  bossScheduleIndex: number;
  nextBossAtSec: number;
  bossWarningSec: number;
  bossWarningKind: BossKind | null;
  activeBossId: string | null;
  bossesSlain: number;
  sandstormTimer: number;
  sandstormActiveTimer: number;
  sandstormDirX: number;
  sandstormDirY: number;
  spawnTimer: number;
  crateSpawnTimer: number;
  obstacles: MapObstacle[];
  zones: MapZone[];
  players: PlayerEntity[];
  enemies: EnemyEntity[];
  projectiles: ProjectileEntity[];
  xpGems: XpGemEntity[];
  crates: CrateEntity[];
  pickups: PickupItemEntity[];
  hazards: HazardTelegraph[];
  floatingTexts: FloatingText[];
  particles: ParticleFx[];
  lightningArcs: LightningArcFx[];
  visualEffects: VisualFxEntity[];
}

export interface SurvivalPlayerSummary {
  id: string;
  name: string;
  animal: AnimalId;
  weaponId: WeaponId;
  gearId: GearId;
  isBot: boolean;
  hp: number;
  maxHp: number;
  downed: boolean;
  reviveProgress: number;
  kills: number;
  damageDealt: number;
  score: number;
  revives: number;
  skills: Partial<Record<SkillId, number>>;
  secondaryCooldowns: Partial<Record<SkillId, SkillCooldownState>>;
  rerollsLeft: number;
  dashCooldownPct: number;
  comboCount: number;
}

export interface SurvivalHudSnapshot {
  phase: SurvivalPhase;
  mode: SurvivalMode;
  mapId: SurvivalMapId;
  isEndlessActive: boolean;
  elapsedSec: number;
  score: number;
  teamLevel: number;
  teamXp: number;
  xpToNext: number;
  totalKills: number;
  bossesSlain: number;
  nextBossInSec: number;
  bossWarningSec: number;
  bossWarningName: string | null;
  activeBoss: {
    name: string;
    hp: number;
    maxHp: number;
    tier: number;
    isFinalBoss?: boolean;
  } | null;
  sandstormActive: boolean;
  localPlayer: SurvivalPlayerSummary;
  teammates: SurvivalPlayerSummary[];
  pendingOffers: SkillOffer[];
  hasLocalPicked: boolean;
  pickedCount: number;
  humanCount: number;
  levelUpTimerSec: number;
}

export interface SurvivalMatchSummary {
  matchId: string;
  mapId: SurvivalMapId;
  mode: SurvivalMode;
  victory: boolean;
  isEndless: boolean;
  elapsedSec: number;
  teamLevel: number;
  score: number;
  totalKills: number;
  bossesSlain: number;
  players: SurvivalPlayerSummary[];
}
