import {
  BOSS_NAMES,
  MAX_REROLLS_PER_MATCH,
  computeDerivedStats,
  getSkillSpec,
  getWeaponSpec,
  rollSkillOffers,
  xpForNextLevel,
} from './catalog.ts';
import { pickBotSkillIndex, computeBotInput } from './botBrain.ts';
import { WORLD_SIZE, generateMapLayout, getSurvivalMapMeta } from './maps.ts';
import { SpatialGrid } from './spatialGrid.ts';
import type {
  BossKind,
  CrateEntity,
  EnemyEntity,
  EnemyKind,
  MapZone,
  PlayerEntity,
  SkillOffer,
  SurvivalHudSnapshot,
  SurvivalInput,
  SurvivalMapId,
  SurvivalMatchSummary,
  SurvivalMode,
  SurvivalPlayerSummary,
  SurvivalSimEvent,
  SurvivalWorldState,
  WeaponId,
  GearId,
  XpGemEntity,
} from './types.ts';
import type { AnimalId } from '../../engine/types.ts';

export interface CreateWorldPlayerConfig {
  id: string;
  name: string;
  animal: AnimalId;
  weaponId: WeaponId;
  gearId: GearId;
  isBot: boolean;
}

export interface CreateWorldConfig {
  matchId: string;
  mode: SurvivalMode;
  mapId: SurvivalMapId;
  seed: number;
  players: CreateWorldPlayerConfig[];
}

const PLAYER_RADIUS = 18;
const WORLD_EDGE_PADDING = 16;
const DASH_DISTANCE = 220;
const DASH_DURATION_SEC = 0.18;
const DASH_IFRAMES_SEC = 0.24;
const REVIVE_RADIUS = 85;
const REVIVE_DURATION_SEC = 3.0;
const TEAM_AURA_RADIUS = 220;
const ORBITAL_RADIUS = 82;
const DRONE_ORBIT_RADIUS = 44;
const DRONE_RANGE = 440;
const RICOCHET_RANGE = 180;
const XP_MAGNET_SPEED = 560;
const MAX_XP_GEMS = 160;
const MAX_FLOATING_TEXTS = 40;
const MAX_PARTICLES = 120;
const MAX_LIGHTNING_ARCS = 20;

const CAMPAIGN_BOSS_TIMINGS = [90, 210, 330] as const;

const BOSS_KIND_SET: ReadonlySet<EnemyKind> = new Set<BossKind>([
  'boss_slime_king',
  'boss_frost_bear',
  'boss_snow_dragon',
  'boss_jelly_king',
  'boss_candy_scorpion',
  'boss_sugar_pharaoh',
  'boss_quartz_lord',
  'boss_crystal_golem',
  'boss_void_dragon',
]);

function isBossKind(kind: EnemyKind): kind is BossKind {
  return BOSS_KIND_SET.has(kind);
}

const ZERO_INPUT: SurvivalInput = {
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  manualAim: false,
  dashPressed: false,
};

interface EnemyTemplate {
  radius: number;
  baseHp: number;
  speed: number;
  damage: number;
  xpValue: number;
  scoreValue: number;
  flying: boolean;
}

const ENEMY_TEMPLATES: Record<EnemyKind, EnemyTemplate> = {
  slime: { radius: 17, baseHp: 34, speed: 92, damage: 10, xpValue: 10, scoreValue: 10, flying: false },
  bat: { radius: 14, baseHp: 24, speed: 158, damage: 9, xpValue: 10, scoreValue: 15, flying: true },
  wolf: { radius: 19, baseHp: 58, speed: 130, damage: 15, xpValue: 30, scoreValue: 25, flying: false },
  owl_mage: { radius: 18, baseHp: 50, speed: 82, damage: 14, xpValue: 30, scoreValue: 35, flying: true },
  golem: { radius: 28, baseHp: 165, speed: 62, damage: 24, xpValue: 80, scoreValue: 60, flying: false },
  bomber: { radius: 18, baseHp: 48, speed: 118, damage: 28, xpValue: 30, scoreValue: 45, flying: false },
  // Map 1 Bosses (Winter Cabin)
  boss_slime_king: { radius: 44, baseHp: 1400, speed: 76, damage: 26, xpValue: 250, scoreValue: 1500, flying: false },
  boss_frost_bear: { radius: 46, baseHp: 1800, speed: 88, damage: 30, xpValue: 250, scoreValue: 1500, flying: false },
  boss_snow_dragon: { radius: 50, baseHp: 2100, speed: 96, damage: 34, xpValue: 250, scoreValue: 1500, flying: true },
  // Map 2 Bosses (Candy Canyon)
  boss_jelly_king: { radius: 45, baseHp: 1480, speed: 82, damage: 27, xpValue: 250, scoreValue: 1600, flying: false },
  boss_candy_scorpion: { radius: 46, baseHp: 1880, speed: 96, damage: 31, xpValue: 250, scoreValue: 1700, flying: false },
  boss_sugar_pharaoh: { radius: 50, baseHp: 2200, speed: 98, damage: 35, xpValue: 250, scoreValue: 1900, flying: true },
  // Map 3 Bosses (Crystal Cavern)
  boss_quartz_lord: { radius: 45, baseHp: 1560, speed: 84, damage: 28, xpValue: 250, scoreValue: 1700, flying: false },
  boss_crystal_golem: { radius: 48, baseHp: 1980, speed: 92, damage: 32, xpValue: 250, scoreValue: 1850, flying: false },
  boss_void_dragon: { radius: 52, baseHp: 2350, speed: 102, damage: 36, xpValue: 250, scoreValue: 2100, flying: true },
};

const MAX_ENEMY_RADIUS = Math.max(
  ...Object.values(ENEMY_TEMPLATES).map((tpl) => tpl.radius),
);
const ORBITAL_HIT_COOLDOWN_SEC = 0.25;

const enemyGrid = new SpatialGrid<EnemyEntity>(160);
const gridScratch: EnemyEntity[] = [];
const aoeGridScratch: EnemyEntity[] = [];
const orbitalLastHitByEnemy = new WeakMap<EnemyEntity, Map<string, number>>();

function nextRng(world: SurvivalWorldState): number {
  const a = (world.rngState + 0x6d2b79f5) | 0;
  world.rngState = a >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function allocId(world: SurvivalWorldState, prefix: string): string {
  const id = `${prefix}_${world.nextEntityId}`;
  world.nextEntityId += 1;
  return id;
}

function clampCoord(val: number, radius: number): number {
  const min = radius + WORLD_EDGE_PADDING;
  const max = WORLD_SIZE - radius - WORLD_EDGE_PADDING;
  if (!Number.isFinite(val)) return (min + max) * 0.5;
  return Math.max(min, Math.min(max, val));
}

function pushOutOfObstacles(
  world: SurvivalWorldState,
  entity: { x: number; y: number; radius: number },
): void {
  for (let i = 0; i < world.obstacles.length; i++) {
    const obs = world.obstacles[i];
    const dx = entity.x - obs.x;
    const dy = entity.y - obs.y;
    const minDist = entity.radius + obs.radius;
    const distSq = dx * dx + dy * dy;
    if (distSq < minDist * minDist) {
      if (distSq > 1e-8) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        entity.x += (dx / dist) * overlap;
        entity.y += (dy / dist) * overlap;
      } else {
        entity.x += minDist;
      }
    }
  }
  entity.x = clampCoord(entity.x, entity.radius);
  entity.y = clampCoord(entity.y, entity.radius);
}

function spawnCrateSafe(world: SurvivalWorldState, minCenterClearance = 300): void {
  const center = WORLD_SIZE / 2;
  const crateRadius = 20;
  const margin = 180;

  for (let attempt = 0; attempt < 60; attempt++) {
    const x = Math.round(margin + nextRng(world) * (WORLD_SIZE - margin * 2));
    const y = Math.round(margin + nextRng(world) * (WORLD_SIZE - margin * 2));

    if (Math.hypot(x - center, y - center) < minCenterClearance) continue;

    let blocked = false;
    for (let i = 0; i < world.obstacles.length; i++) {
      const obs = world.obstacles[i];
      if (Math.hypot(x - obs.x, y - obs.y) < obs.radius + crateRadius + 24) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    for (let i = 0; i < world.crates.length; i++) {
      const other = world.crates[i];
      if (Math.hypot(x - other.x, y - other.y) < other.radius + crateRadius + 80) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    const roll = nextRng(world);
    const dropKind: CrateEntity['dropKind'] =
      roll < 0.45 ? 'heal' : roll < 0.72 ? 'magnet' : 'xp_chest';

    world.crates.push({
      id: allocId(world, 'crate'),
      x,
      y,
      radius: crateRadius,
      hp: 35,
      maxHp: 35,
      dropKind,
      hitFlashTimer: 0,
    });
    return;
  }
}

export function createSurvivalWorld(config: CreateWorldConfig): SurvivalWorldState {
  const layout = generateMapLayout(config.mapId, config.seed);
  const mapMeta = getSurvivalMapMeta(config.mapId);
  const rngState = (config.seed || 1) >>> 0;

  const players: PlayerEntity[] = config.players.map((cfg, idx) => {
    const sp = layout.spawnPoints[idx % layout.spawnPoints.length];
    const stats = computeDerivedStats(cfg.weaponId, cfg.gearId, {}, {});
    return {
      id: cfg.id,
      name: cfg.name,
      animal: cfg.animal,
      weaponId: cfg.weaponId,
      gearId: cfg.gearId,
      isBot: cfg.isBot,
      botTakeover: false,
      x: sp.x,
      y: sp.y,
      vx: 0,
      vy: 0,
      radius: PLAYER_RADIUS,
      aimAngle: 0,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      downed: false,
      reviveProgress: 0,
      invulnTimer: 0,
      dashTimer: 0,
      dashCooldownTimer: 0,
      dashDirX: 1,
      dashDirY: 0,
      fireCooldown: 0,
      hitFlashTimer: 0,
      skills: {},
      skillPower: {},
      rerollsLeft: MAX_REROLLS_PER_MATCH,
      kills: 0,
      damageDealt: 0,
      score: 0,
      revives: 0,
      vampirismKillCounter: 0,
      orbitalAngle: 0,
      warmAuraTimer: 0,
      meteorTimer: 0,
      droneTimer: 0,
      droneAngle: 0,
      frostNovaTimer: 0,
      caramelNovaTimer: 0,
      prismChainTimer: 0,
      voidPulseTimer: 0,
      crystalShieldCooldown: 0,
      teamAuraHealTimer: 0,
      teamAuraBuffTimer: 0,
      pylonBuffTimer: 0,
      comboCount: 0,
      comboTimer: 0,
      stats,
    };
  });

  const world: SurvivalWorldState = {
    matchId: config.matchId,
    mode: config.mode,
    mapId: config.mapId,
    seed: config.seed,
    rngState,
    nextEntityId: 1,
    phase: 'playing',
    elapsedSec: 0,
    isEndlessActive: mapMeta.isEndless,
    score: 0,
    teamLevel: 1,
    teamXp: 0,
    xpToNext: xpForNextLevel(1),
    pendingOffersByPlayer: {},
    pickedPlayerIds: [],
    levelUpTimerSec: 0,
    levelUpGuaranteeRare: false,
    activeLevelUpGuaranteeRare: false,
    bossScheduleIndex: 0,
    nextBossAtSec: 90,
    bossWarningSec: 0,
    bossWarningKind: null,
    activeBossId: null,
    bossesSlain: 0,
    sandstormTimer: 75,
    sandstormActiveTimer: 0,
    sandstormDirX: 1,
    sandstormDirY: 0,
    spawnTimer: 0.6,
    crateSpawnTimer: 16,
    obstacles: layout.obstacles,
    zones: layout.zones,
    players,
    enemies: [],
    projectiles: [],
    xpGems: [],
    crates: [],
    pickups: [],
    hazards: [],
    floatingTexts: [],
    particles: [],
    lightningArcs: [],
  };

  for (let i = 0; i < 8; i++) {
    spawnCrateSafe(world, 300);
  }

  return world;
}

function addFloatingText(
  world: SurvivalWorldState,
  x: number,
  y: number,
  text: string,
  color: string,
  isCrit = false,
): void {
  world.floatingTexts.push({
    id: allocId(world, 'ft'),
    x,
    y,
    text,
    color,
    ttl: 0.65,
    maxTtl: 0.65,
    isCrit,
  });
}

function spawnParticles(
  world: SurvivalWorldState,
  x: number,
  y: number,
  color: string,
  count: number,
  speedScale = 120,
): void {
  for (let i = 0; i < count; i++) {
    const angle = nextRng(world) * Math.PI * 2;
    const speed = (0.35 + nextRng(world) * 0.65) * speedScale;
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + nextRng(world) * 3,
      color,
      ttl: 0.25 + nextRng(world) * 0.25,
      maxTtl: 0.5,
    });
  }
}

function decayVisualFx(world: SurvivalWorldState, dt: number): void {
  let ftWrite = 0;
  for (let i = 0; i < world.floatingTexts.length; i++) {
    const ft = world.floatingTexts[i];
    ft.ttl -= dt;
    ft.y -= 24 * dt;
    if (ft.ttl > 0) {
      world.floatingTexts[ftWrite++] = ft;
    }
  }
  world.floatingTexts.length = ftWrite;
  if (world.floatingTexts.length > MAX_FLOATING_TEXTS) {
    world.floatingTexts.splice(0, world.floatingTexts.length - MAX_FLOATING_TEXTS);
  }

  let pWrite = 0;
  for (let i = 0; i < world.particles.length; i++) {
    const pt = world.particles[i];
    pt.ttl -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.ttl > 0) {
      world.particles[pWrite++] = pt;
    }
  }
  world.particles.length = pWrite;
  if (world.particles.length > MAX_PARTICLES) {
    world.particles.splice(0, world.particles.length - MAX_PARTICLES);
  }

  let arcWrite = 0;
  for (let i = 0; i < world.lightningArcs.length; i++) {
    const arc = world.lightningArcs[i];
    arc.ttl -= dt;
    if (arc.ttl > 0) {
      world.lightningArcs[arcWrite++] = arc;
    }
  }
  world.lightningArcs.length = arcWrite;
  if (world.lightningArcs.length > MAX_LIGHTNING_ARCS) {
    world.lightningArcs.splice(0, world.lightningArcs.length - MAX_LIGHTNING_ARCS);
  }
}

function isPlayerInsideZoneKind(
  zones: readonly MapZone[],
  player: PlayerEntity,
  kind: MapZone['kind'],
): boolean {
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (z.kind !== kind) continue;
    if (Math.hypot(player.x - z.x, player.y - z.y) <= z.radius) {
      return true;
    }
  }
  return false;
}

function updateMapZonesAndEnvironment(world: SurvivalWorldState, dt: number): void {
  if (world.mapId === 'candy_canyon') {
    if (world.sandstormActiveTimer > 0) {
      world.sandstormActiveTimer = Math.max(0, world.sandstormActiveTimer - dt);
    } else {
      world.sandstormTimer -= dt;
      if (world.sandstormTimer <= 0) {
        world.sandstormActiveTimer = 14;
        world.sandstormTimer = 75;
        const angle = nextRng(world) * Math.PI * 2;
        world.sandstormDirX = Math.cos(angle);
        world.sandstormDirY = Math.sin(angle);
      }
    }
  }

  if (world.mapId === 'crystal_cavern') {
    for (let i = 0; i < world.zones.length; i++) {
      const zone = world.zones[i];
      if (zone.kind !== 'crystal_pylon') continue;

      if (zone.activeTimerSec > 0) {
        zone.activeTimerSec = Math.max(0, zone.activeTimerSec - dt);
      } else if (zone.cooldownSec > 0) {
        zone.cooldownSec = Math.max(0, zone.cooldownSec - dt);
      }

      if (zone.activeTimerSec <= 0 && zone.cooldownSec <= 0) {
        const triggered = world.players.some(
          (p) => !p.downed && Math.hypot(p.x - zone.x, p.y - zone.y) <= zone.radius,
        );
        if (triggered) {
          zone.activeTimerSec = 10;
          zone.cooldownSec = 30;
        }
      }

      if (zone.activeTimerSec > 0) {
        for (let j = 0; j < world.players.length; j++) {
          const p = world.players[j];
          if (!p.downed && Math.hypot(p.x - zone.x, p.y - zone.y) <= zone.radius + 40) {
            p.pylonBuffTimer = Math.max(p.pylonBuffTimer, 0.35);
          }
        }
      }
    }
  }

  if (world.mapId === 'endless_abyss') {
    for (let i = 0; i < world.zones.length; i++) {
      const zone = world.zones[i];
      if (zone.kind !== 'score_pad') continue;
      const occupied = world.players.some(
        (p) => !p.downed && Math.hypot(p.x - zone.x, p.y - zone.y) <= zone.radius,
      );
      zone.activeTimerSec = occupied ? 1 : 0;
    }
  }
}

function getEffectiveTeamAuraLevel(
  world: SurvivalWorldState,
  receiver: PlayerEntity,
): number {
  let maxLv = 0;
  for (let i = 0; i < world.players.length; i++) {
    const src = world.players[i];
    if (src.downed || src.stats.teamAuraLevel <= 0) continue;
    if (Math.hypot(receiver.x - src.x, receiver.y - src.y) <= TEAM_AURA_RADIUS) {
      maxLv = Math.max(maxLv, src.stats.teamAuraLevel);
    }
  }
  return maxLv;
}

function updateTeamAura(world: SurvivalWorldState, dt: number): void {
  for (let i = 0; i < world.players.length; i++) {
    const receiver = world.players[i];
    if (receiver.downed) {
      receiver.teamAuraHealTimer = 0;
      continue;
    }
    const maxLv = getEffectiveTeamAuraLevel(world, receiver);
    if (maxLv > 0) {
      receiver.teamAuraBuffTimer = 0.5;
      receiver.teamAuraHealTimer += dt;
      while (receiver.teamAuraHealTimer >= 1.0) {
        receiver.teamAuraHealTimer -= 1.0;
        receiver.hp = Math.min(receiver.maxHp, receiver.hp + 2 * maxLv);
      }
    } else {
      receiver.teamAuraHealTimer = 0;
    }
  }
}

function sanitizeInput(
  raw: SurvivalInput | undefined,
  player: PlayerEntity,
): SurvivalInput {
  if (!raw) {
    return {
      moveX: 0,
      moveY: 0,
      aimX: player.x,
      aimY: player.y,
      manualAim: false,
      dashPressed: false,
    };
  }
  return {
    moveX: Number.isFinite(raw.moveX) ? Math.max(-1, Math.min(1, raw.moveX)) : 0,
    moveY: Number.isFinite(raw.moveY) ? Math.max(-1, Math.min(1, raw.moveY)) : 0,
    aimX: Number.isFinite(raw.aimX) ? raw.aimX : player.x,
    aimY: Number.isFinite(raw.aimY) ? raw.aimY : player.y,
    manualAim: Boolean(raw.manualAim),
    dashPressed: Boolean(raw.dashPressed),
  };
}

function resolvePlayerInput(
  world: SurvivalWorldState,
  player: PlayerEntity,
  inputs: Record<string, SurvivalInput>,
): SurvivalInput {
  if (player.isBot || player.botTakeover) {
    return sanitizeInput(computeBotInput(world, player), player);
  }
  return sanitizeInput(inputs[player.id], player);
}

function updatePlayers(
  world: SurvivalWorldState,
  inputs: Record<string, SurvivalInput>,
  dt: number,
  events: SurvivalSimEvent[],
): Record<string, SurvivalInput> {
  const resolvedInputs: Record<string, SurvivalInput> = {};

  for (let i = 0; i < world.players.length; i++) {
    const p = world.players[i];
    const input = resolvePlayerInput(world, p, inputs);
    resolvedInputs[p.id] = input;

    p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    p.dashCooldownTimer = Math.max(0, p.dashCooldownTimer - dt);
    p.hitFlashTimer = Math.max(0, p.hitFlashTimer - dt);
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    p.pylonBuffTimer = Math.max(0, p.pylonBuffTimer - dt);
    p.teamAuraBuffTimer = Math.max(0, p.teamAuraBuffTimer - dt);
    p.crystalShieldCooldown = Math.max(0, p.crystalShieldCooldown - dt);
    p.comboTimer = Math.max(0, p.comboTimer - dt);
    if (p.comboTimer === 0) {
      p.comboCount = 0;
    }

    if (p.downed) {
      p.vx = 0;
      p.vy = 0;
      p.dashTimer = 0;
      let rescuer: PlayerEntity | null = null;
      let bestDist = REVIVE_RADIUS;
      for (let j = 0; j < world.players.length; j++) {
        const other = world.players[j];
        if (other.id === p.id || other.downed) continue;
        const d = Math.hypot(other.x - p.x, other.y - p.y);
        if (d <= bestDist) {
          bestDist = d;
          rescuer = other;
        }
      }

      if (rescuer) {
        p.reviveProgress += dt / REVIVE_DURATION_SEC;
        if (p.reviveProgress >= 1.0) {
          p.downed = false;
          p.hp = Math.round(p.maxHp * 0.5);
          p.invulnTimer = 2.0;
          p.reviveProgress = 0;
          rescuer.revives += 1;
          events.push({ type: 'player_revive' });
        }
      } else {
        p.reviveProgress = Math.max(0, p.reviveProgress - dt * 0.25);
      }
      continue;
    }

    if (input.dashPressed && p.dashCooldownTimer <= 0 && p.dashTimer <= 0) {
      const moveLen = Math.hypot(input.moveX, input.moveY);
      if (moveLen > 0.01) {
        p.dashDirX = input.moveX / moveLen;
        p.dashDirY = input.moveY / moveLen;
      } else {
        p.dashDirX = Math.cos(p.aimAngle);
        p.dashDirY = Math.sin(p.aimAngle);
      }
      p.dashTimer = DASH_DURATION_SEC;
      p.invulnTimer = Math.max(p.invulnTimer, DASH_IFRAMES_SEC);
      p.dashCooldownTimer = p.stats.dashCooldown;
      events.push({ type: 'dash' });
    }

    let remDt = dt;
    if (p.dashTimer > 0) {
      const dashSpeed = DASH_DISTANCE / DASH_DURATION_SEC;
      const dashStep = Math.min(dt, p.dashTimer);
      p.vx = p.dashDirX * dashSpeed;
      p.vy = p.dashDirY * dashSpeed;
      p.x += p.vx * dashStep;
      p.y += p.vy * dashStep;
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      remDt = dt - dashStep;
    }

    if (remDt > 0) {
      let zoneSpeedMult = 1;
      if (world.mapId === 'winter_cabin' && isPlayerInsideZoneKind(world.zones, p, 'ice')) {
        zoneSpeedMult *= 1.18;
      } else if (
        world.mapId === 'endless_abyss' &&
        isPlayerInsideZoneKind(world.zones, p, 'score_pad')
      ) {
        zoneSpeedMult *= 1.1;
      }

      const sugarRushSpeedMult =
        p.stats.sugarRushLevel > 0 && p.comboCount > 0
          ? 1 + Math.min(0.45, p.comboCount * 0.025 * p.stats.sugarRushLevel)
          : 1;

      const len = Math.hypot(input.moveX, input.moveY);
      if (len > 1e-4) {
        const scale = Math.max(1, len);
        const nx = input.moveX / scale;
        const ny = input.moveY / scale;
        const speed = p.stats.moveSpeed * zoneSpeedMult * sugarRushSpeedMult;
        p.vx = nx * speed;
        p.vy = ny * speed;
        p.x += p.vx * remDt;
        p.y += p.vy * remDt;
      } else {
        p.vx = 0;
        p.vy = 0;
      }
    }

    if (world.mapId === 'candy_canyon' && world.sandstormActiveTimer > 0) {
      p.x += world.sandstormDirX * 55 * dt;
      p.y += world.sandstormDirY * 55 * dt;
    }

    pushOutOfObstacles(world, p);
  }

  return resolvedInputs;
}

function rebuildEnemyGrid(world: SurvivalWorldState): void {
  enemyGrid.clear();
  for (let i = 0; i < world.enemies.length; i++) {
    const e = world.enemies[i];
    if (e.hp > 0) {
      enemyGrid.insert(e);
    }
  }
}

function gemTierForValue(value: number): XpGemEntity['tier'] {
  if (value >= 200) return 'gold';
  if (value >= 60) return 'purple';
  if (value >= 25) return 'blue';
  return 'green';
}

function handleEnemyDeath(
  world: SurvivalWorldState,
  enemy: EnemyEntity,
  killerId: string,
  events: SurvivalSimEvent[],
  allowPepperChain = true,
): void {
  const killer = world.players.find((p) => p.id === killerId) ?? null;

  if (killer) {
    killer.kills += 1;
    killer.comboCount += 1;
    killer.comboTimer = 4.0;
    if (killer.stats.vampirismLevel > 0) {
      killer.vampirismKillCounter += 1;
      if (killer.vampirismKillCounter >= 12) {
        killer.vampirismKillCounter = 0;
        if (!killer.downed) {
          const healAmt = 4 + killer.stats.vampirismLevel * 2;
          killer.hp = Math.min(killer.maxHp, killer.hp + healAmt);
        }
      }
    }
  }

  if (enemy.isBoss) {
    world.bossesSlain += 1;
    world.activeBossId = null;
    const bossScore = 1500 * Math.max(1, enemy.bossTier);
    world.score += bossScore;
    if (killer) killer.score += bossScore;

    world.xpGems.push({
      id: allocId(world, 'gem'),
      x: enemy.x,
      y: enemy.y,
      value: 250,
      tier: 'gold',
      magnetizedBy: null,
    });
    world.pickups.push({
      id: allocId(world, 'pk'),
      x: clampCoord(enemy.x + 24, 16),
      y: enemy.y,
      kind: 'magnet',
      ttl: 40,
    });
    spawnParticles(world, enemy.x, enemy.y, '#fbbf24', 18, 220);
    events.push({ type: 'boss_kill', bossKind: enemy.kind as BossKind });

    const finalBossKind = getSurvivalMapMeta(world.mapId).finalBossKind;
    if (!world.isEndlessActive && enemy.kind === finalBossKind) {
      world.bossScheduleIndex = Math.max(world.bossScheduleIndex + 1, 3);
      world.nextBossAtSec = Math.max(world.elapsedSec + 90, 420);
      world.phase = 'victory';
      events.push({ type: 'victory' });
      return;
    }

    world.levelUpGuaranteeRare = true;
    world.teamXp += world.xpToNext;
    world.bossScheduleIndex += 1;

    if (!world.isEndlessActive) {
      const scheduled = CAMPAIGN_BOSS_TIMINGS[world.bossScheduleIndex];
      world.nextBossAtSec =
        scheduled !== undefined
          ? Math.max(world.elapsedSec + 25, scheduled)
          : world.elapsedSec + 90;
    } else {
      world.nextBossAtSec = Math.max(
        world.elapsedSec + 15,
        (world.bossScheduleIndex + 1) * 90,
      );
    }
    return;
  }

  const comboMult = killer ? 1 + Math.min(0.5, killer.comboCount * 0.05) : 1;
  const padMult =
    killer &&
    world.mapId === 'endless_abyss' &&
    isPlayerInsideZoneKind(world.zones, killer, 'score_pad')
      ? 1.15
      : 1;
  const killScore = Math.round(enemy.scoreValue * comboMult * padMult);

  world.score += killScore;
  if (killer) killer.score += killScore;

  world.xpGems.push({
    id: allocId(world, 'gem'),
    x: enemy.x,
    y: enemy.y,
    value: enemy.xpValue,
    tier: gemTierForValue(enemy.xpValue),
    magnetizedBy: null,
  });

  if (enemy.kind === 'golem' && nextRng(world) < 0.08) {
    world.pickups.push({
      id: allocId(world, 'pk'),
      x: enemy.x,
      y: enemy.y,
      kind: 'heal',
      ttl: 30,
    });
  }

  if (allowPepperChain && killer && killer.stats.pepperBombLevel > 0) {
    const lv = killer.stats.pepperBombLevel;
    const blastRadius = 78 + lv * 14;
    const blastDmg =
      (22 + lv * 11) * getPlayerDamageMultiplier(world, killer);
    const nearby = enemyGrid.queryRadius(
      enemy.x,
      enemy.y,
      blastRadius + MAX_ENEMY_RADIUS,
      aoeGridScratch,
    );
    for (let i = 0; i < nearby.length; i++) {
      const other = nearby[i];
      if (other.id === enemy.id || other.hp <= 0) continue;
      const dx = other.x - enemy.x;
      const dy = other.y - enemy.y;
      const d = Math.hypot(dx, dy);
      if (d <= blastRadius + other.radius) {
        const nx = d > 1e-4 ? dx / d : 1;
        const ny = d > 1e-4 ? dy / d : 0;
        damageEnemy(
          world,
          other,
          blastDmg,
          killer.id,
          false,
          36,
          nx,
          ny,
          0,
          0,
          events,
          true,
          false,
        );
      }
    }
    spawnParticles(world, enemy.x, enemy.y, '#fb7185', 10, 175);
  }

  spawnParticles(world, enemy.x, enemy.y, '#f87171', 6, 110);
  events.push({ type: 'enemy_kill' });
}

function damageEnemy(
  world: SurvivalWorldState,
  enemy: EnemyEntity,
  amount: number,
  ownerId: string,
  isCrit: boolean,
  knockback: number,
  kbDirX: number,
  kbDirY: number,
  slowPct: number,
  slowDurationSec: number,
  events: SurvivalSimEvent[],
  showFloatingText = true,
  allowPepperChain = true,
): void {
  if (enemy.hp <= 0) return;

  const owner = world.players.find((p) => p.id === ownerId);
  const shatterMult =
    owner && owner.stats.iceShatterLevel > 0 && enemy.slowTimer > 0
      ? 1 + owner.stats.iceShatterLevel * 0.18
      : 1;
  const actualDamage = Math.max(1, Math.round(amount * shatterMult));
  enemy.hp -= actualDamage;
  enemy.hitFlashTimer = 0.12;

  if (owner) {
    owner.damageDealt += actualDamage;
  }

  if (slowPct > 0 && slowDurationSec > 0) {
    enemy.slowFactor = Math.max(enemy.slowFactor, slowPct);
    enemy.slowTimer = Math.max(enemy.slowTimer, slowDurationSec);
  }

  if (knockback > 0) {
    const resistance = enemy.isBoss ? 0.18 : enemy.kind === 'golem' ? 0.4 : 1.0;
    const push = knockback * 0.14 * resistance;
    enemy.x = clampCoord(enemy.x + kbDirX * push, enemy.radius);
    enemy.y = clampCoord(enemy.y + kbDirY * push, enemy.radius);
  }

  if (showFloatingText) {
    addFloatingText(
      world,
      enemy.x,
      enemy.y - enemy.radius,
      `${actualDamage}`,
      isCrit || shatterMult > 1 ? '#facc15' : '#ffffff',
      isCrit || shatterMult > 1,
    );
  }

  events.push({ type: 'hit' });

  if (enemy.hp <= 0) {
    enemy.hp = 0;
    handleEnemyDeath(world, enemy, ownerId, events, allowPepperChain);
  }
}

function damageCrate(
  world: SurvivalWorldState,
  crate: CrateEntity,
  amount: number,
  events: SurvivalSimEvent[],
): void {
  if (crate.hp <= 0) return;
  crate.hp -= Math.max(1, Math.round(amount));
  crate.hitFlashTimer = 0.12;

  if (crate.hp <= 0) {
    crate.hp = 0;
    events.push({ type: 'crate_break' });
    spawnParticles(world, crate.x, crate.y, '#fbbf24', 8, 130);
    if (crate.dropKind === 'xp_chest') {
      world.xpGems.push({
        id: allocId(world, 'gem'),
        x: crate.x,
        y: crate.y,
        value: 80,
        tier: 'purple',
        magnetizedBy: null,
      });
    } else {
      world.pickups.push({
        id: allocId(world, 'pk'),
        x: crate.x,
        y: crate.y,
        kind: crate.dropKind,
        ttl: 35,
      });
    }
  }
}

function findAutoAimTarget(
  world: SurvivalWorldState,
  player: PlayerEntity,
  range: number,
): { x: number; y: number; enemy: EnemyEntity | null; crate: CrateEntity | null } | null {
  const searchRange = range + MAX_ENEMY_RADIUS;
  const nearestEnemy = enemyGrid.findNearest(
    player.x,
    player.y,
    searchRange,
    (e) => e.hp > 0 && Math.hypot(e.x - player.x, e.y - player.y) - e.radius <= range,
  );

  let chosenEnemy = nearestEnemy;
  if (world.activeBossId !== null) {
    const boss = world.enemies.find(
      (e) => e.id === world.activeBossId && e.hp > 0,
    );
    if (boss) {
      const bossDist = Math.hypot(boss.x - player.x, boss.y - player.y);
      if (bossDist - boss.radius <= range) {
        if (!nearestEnemy) {
          chosenEnemy = boss;
        } else {
          const nearestDist = Math.hypot(
            nearestEnemy.x - player.x,
            nearestEnemy.y - player.y,
          );
          if (bossDist <= nearestDist + 140) {
            chosenEnemy = boss;
          }
        }
      }
    }
  }

  if (chosenEnemy) {
    return { x: chosenEnemy.x, y: chosenEnemy.y, enemy: chosenEnemy, crate: null };
  }

  let nearestCrate: CrateEntity | null = null;
  let bestCrateDist = Infinity;
  for (let i = 0; i < world.crates.length; i++) {
    const c = world.crates[i];
    if (c.hp <= 0) continue;
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (d - c.radius <= range && d < bestCrateDist) {
      bestCrateDist = d;
      nearestCrate = c;
    }
  }
  if (nearestCrate) {
    return { x: nearestCrate.x, y: nearestCrate.y, enemy: null, crate: nearestCrate };
  }
  return null;
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

function fireLightningStaff(
  world: SurvivalWorldState,
  player: PlayerEntity,
  totalShots: number,
  baseDamage: number,
  baseDamageMult: number,
  autoTarget: { enemy: EnemyEntity | null; crate: CrateEntity | null } | null,
  manualAim: boolean,
  events: SurvivalSimEvent[],
): void {
  const weapon = getWeaponSpec('lightning_staff');
  const maxHops = weapon.chainCount + player.stats.bonusPierce;
  const coneTargets = enemyGrid
    .queryRadius(player.x, player.y, weapon.range + MAX_ENEMY_RADIUS, gridScratch)
    .filter(
      (e) =>
        e.hp > 0 &&
        Math.hypot(e.x - player.x, e.y - player.y) - e.radius <= weapon.range,
    )
    .sort((a, b) => {
      const adx = a.x - player.x;
      const ady = a.y - player.y;
      const bdx = b.x - player.x;
      const bdy = b.y - player.y;
      return adx * adx + ady * ady - (bdx * bdx + bdy * bdy);
    });

  for (let s = 0; s < totalShots; s++) {
    const isCrit = nextRng(world) < player.stats.critChance;
    let hopDamage =
      baseDamage * baseDamageMult * (isCrit ? player.stats.critMultiplier : 1);

    let firstEnemy: EnemyEntity | null = null;
    if (manualAim) {
      firstEnemy =
        coneTargets.find(
          (e) =>
            e.hp > 0 &&
            angleDiff(Math.atan2(e.y - player.y, e.x - player.x), player.aimAngle) <=
              Math.PI / 4,
        ) ?? null;
    } else if (s === 0 && autoTarget?.enemy && autoTarget.enemy.hp > 0) {
      firstEnemy = autoTarget.enemy;
    } else {
      const livingTargets = coneTargets.filter((e) => e.hp > 0);
      if (livingTargets.length > 0) {
        firstEnemy = livingTargets[s % livingTargets.length];
      }
    }

    if (!firstEnemy) {
      const autoCrate =
        autoTarget?.crate && autoTarget.crate.hp > 0 ? autoTarget.crate : null;
      const targetCrate =
        autoCrate ??
        world.crates.find(
          (c) =>
            c.hp > 0 &&
            Math.hypot(c.x - player.x, c.y - player.y) - c.radius <= weapon.range &&
            (!manualAim ||
              angleDiff(Math.atan2(c.y - player.y, c.x - player.x), player.aimAngle) <=
                Math.PI / 4),
        ) ??
        null;

      if (targetCrate) {
        damageCrate(world, targetCrate, hopDamage, events);
        world.lightningArcs.push({
          points: [
            { x: player.x, y: player.y },
            { x: targetCrate.x, y: targetCrate.y },
          ],
          color: weapon.color,
          ttl: 0.16,
          maxTtl: 0.16,
        });
      } else if (manualAim) {
        world.lightningArcs.push({
          points: [
            { x: player.x, y: player.y },
            {
              x: player.x + Math.cos(player.aimAngle) * weapon.range * 0.55,
              y: player.y + Math.sin(player.aimAngle) * weapon.range * 0.55,
            },
          ],
          color: weapon.color,
          ttl: 0.12,
          maxTtl: 0.12,
        });
      }
      continue;
    }

    const points: Array<{ x: number; y: number }> = [
      { x: player.x, y: player.y },
      { x: firstEnemy.x, y: firstEnemy.y },
    ];
    const visited = new Set<string>([firstEnemy.id]);
    let current: EnemyEntity = firstEnemy;

    damageEnemy(
      world,
      current,
      hopDamage,
      player.id,
      isCrit,
      0,
      0,
      0,
      0,
      0,
      events,
    );

    for (let hop = 0; hop < maxHops; hop++) {
      hopDamage *= 0.85;
      const next = enemyGrid.findNearest(
        current.x,
        current.y,
        weapon.chainRange,
        (cand) => cand.hp > 0 && !visited.has(cand.id),
      );
      if (!next) break;
      visited.add(next.id);
      points.push({ x: next.x, y: next.y });
      damageEnemy(world, next, hopDamage, player.id, isCrit, 0, 0, 0, 0, 0, events);
      current = next;
    }

    world.lightningArcs.push({
      points,
      color: weapon.color,
      ttl: 0.16,
      maxTtl: 0.16,
    });
  }
}

function fireProjectileWeapon(
  world: SurvivalWorldState,
  player: PlayerEntity,
  totalShots: number,
  baseDamageMult: number,
): void {
  const weapon = getWeaponSpec(player.weaponId);
  const scale = player.stats.projectileScale;
  const baseRadius =
    player.weaponId === 'candy_launcher'
      ? 10
      : player.weaponId === 'snow_boomerang'
        ? 12
        : player.weaponId === 'frost_bow'
          ? 6
          : 5;

  const totalArcDeg =
    totalShots === 1
      ? 0
      : weapon.spreadDeg > 0
        ? weapon.spreadDeg
        : Math.min(36, 8 * (totalShots - 1));

  for (let i = 0; i < totalShots; i++) {
    let angleOffsetDeg = 0;
    if (totalShots === 1) {
      if (weapon.spreadDeg > 0) {
        angleOffsetDeg = (nextRng(world) - 0.5) * 2 * weapon.spreadDeg;
      }
    } else {
      angleOffsetDeg = -totalArcDeg / 2 + (totalArcDeg * i) / (totalShots - 1);
      if (player.weaponId === 'candy_smg') {
        angleOffsetDeg += (nextRng(world) - 0.5) * weapon.spreadDeg;
      }
    }

    const angle = player.aimAngle + (angleOffsetDeg * Math.PI) / 180;
    const isCrit = nextRng(world) < player.stats.critChance;
    const damage =
      weapon.damage * baseDamageMult * (isCrit ? player.stats.critMultiplier : 1);

    const ttl = weapon.boomerang
      ? 4.5
      : weapon.range / Math.max(1, weapon.projectileSpeed) + 0.5;

    world.projectiles.push({
      id: allocId(world, 'proj'),
      ownerId: player.id,
      fromEnemy: false,
      weaponId: player.weaponId,
      x: player.x,
      y: player.y,
      vx: Math.cos(angle) * weapon.projectileSpeed,
      vy: Math.sin(angle) * weapon.projectileSpeed,
      startX: player.x,
      startY: player.y,
      radius: baseRadius * scale,
      damage,
      isCrit,
      pierceLeft: weapon.pierce + player.stats.bonusPierce,
      ricochetLeft: player.stats.ricochetCount,
      maxRange: weapon.range,
      traveled: 0,
      ttl,
      knockback: weapon.knockback,
      aoeRadius: weapon.aoeRadius * scale,
      slowPct: weapon.slowPct,
      slowDurationSec: weapon.slowDurationSec,
      boomerang: weapon.boomerang,
      returning: false,
      hitIds: [],
      color: weapon.color,
    });
  }
}

function getPlayerDamageMultiplier(
  world: SurvivalWorldState,
  player: PlayerEntity,
): number {
  const auraLv = Math.max(
    getEffectiveTeamAuraLevel(world, player),
    player.teamAuraBuffTimer > 0 ? 1 : 0,
  );
  const auraDamageMult = player.teamAuraBuffTimer > 0 ? 1 + 0.1 * auraLv : 1;
  return player.stats.damageMultiplier * auraDamageMult;
}

function updatePrimaryWeapons(
  world: SurvivalWorldState,
  resolvedInputs: Record<string, SurvivalInput>,
  events: SurvivalSimEvent[],
): void {
  for (let i = 0; i < world.players.length; i++) {
    const p = world.players[i];
    if (p.downed) continue;

    const input = resolvedInputs[p.id] ?? ZERO_INPUT;
    const weapon = getWeaponSpec(p.weaponId);

    let autoTarget: ReturnType<typeof findAutoAimTarget> = null;
    if (input.manualAim) {
      const dx = input.aimX - p.x;
      const dy = input.aimY - p.y;
      if (Math.hypot(dx, dy) > 1e-4) {
        p.aimAngle = Math.atan2(dy, dx);
      }
    } else {
      autoTarget = findAutoAimTarget(world, p, weapon.range);
      if (autoTarget) {
        p.aimAngle = Math.atan2(autoTarget.y - p.y, autoTarget.x - p.x);
      }
    }

    if (p.fireCooldown > 0) continue;
    if (!input.manualAim && !autoTarget) continue;

    const sugarRushFireMult =
      p.stats.sugarRushLevel > 0 && p.comboCount > 0
        ? 1 + Math.min(0.5, p.comboCount * 0.03 * p.stats.sugarRushLevel)
        : 1;
    const effectiveFireRate =
      p.stats.fireRate * (p.pylonBuffTimer > 0 ? 1.2 : 1) * sugarRushFireMult;
    p.fireCooldown = 1 / Math.max(0.1, effectiveFireRate);

    const baseDamageMult = getPlayerDamageMultiplier(world, p);
    const totalShots = weapon.projectilesPerShot + p.stats.bonusProjectiles;

    if (p.weaponId === 'lightning_staff') {
      fireLightningStaff(
        world,
        p,
        totalShots,
        weapon.damage,
        baseDamageMult,
        autoTarget,
        input.manualAim,
        events,
      );
    } else {
      fireProjectileWeapon(world, p, totalShots, baseDamageMult);
    }

    events.push({ type: 'shoot', weaponId: p.weaponId });
  }
}

function updateSecondaryWeapons(
  world: SurvivalWorldState,
  dt: number,
  events: SurvivalSimEvent[],
): void {
  for (let i = 0; i < world.players.length; i++) {
    const p = world.players[i];
    if (p.downed) continue;

    const {
      orbitalLevel,
      warmAuraLevel,
      meteorLevel,
      droneLevel,
      frostNovaLevel,
      caramelNovaLevel,
      prismChainLevel,
      voidPulseLevel,
    } = p.stats;
    const damageMultiplier = getPlayerDamageMultiplier(world, p);

    if (orbitalLevel > 0) {
      p.orbitalAngle += dt * (2.6 + 0.25 * orbitalLevel);
      const count = 2 + orbitalLevel;
      const orbDamage = Math.round((36 + orbitalLevel * 18) * damageMultiplier * 0.25);
      const orbHitIds = new Set<string>();

      for (let b = 0; b < count; b++) {
        const angle = p.orbitalAngle + (b * Math.PI * 2) / count;
        const ox = p.x + Math.cos(angle) * ORBITAL_RADIUS;
        const oy = p.y + Math.sin(angle) * ORBITAL_RADIUS;
        const hits = enemyGrid.queryRadius(ox, oy, 16 + MAX_ENEMY_RADIUS, gridScratch);

        for (let h = 0; h < hits.length; h++) {
          const e = hits[h];
          if (e.hp <= 0 || orbHitIds.has(e.id)) continue;
          if (Math.hypot(e.x - ox, e.y - oy) <= 16 + e.radius) {
            let playerHits = orbitalLastHitByEnemy.get(e);
            const lastHitSec = playerHits?.get(p.id);
            if (
              lastHitSec !== undefined &&
              world.elapsedSec - lastHitSec < ORBITAL_HIT_COOLDOWN_SEC - 1e-6
            ) {
              continue;
            }
            if (!playerHits) {
              playerHits = new Map<string, number>();
              orbitalLastHitByEnemy.set(e, playerHits);
            }
            playerHits.set(p.id, world.elapsedSec);
            orbHitIds.add(e.id);

            const dx = e.x - p.x;
            const dy = e.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            damageEnemy(
              world,
              e,
              orbDamage,
              p.id,
              false,
              24,
              dx / d,
              dy / d,
              0,
              0,
              events,
              true,
            );
          }
        }
      }
    }

    if (warmAuraLevel > 0) {
      p.warmAuraTimer -= dt;
      if (p.warmAuraTimer <= 0) {
        p.warmAuraTimer = 0.4;
        const auraRadius = 95 + warmAuraLevel * 16;
        const auraDmg = (8 + warmAuraLevel * 6) * damageMultiplier;
        const hits = enemyGrid.queryRadius(p.x, p.y, auraRadius + MAX_ENEMY_RADIUS, gridScratch);
        for (let h = 0; h < hits.length; h++) {
          const e = hits[h];
          if (e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) <= auraRadius + e.radius) {
            damageEnemy(world, e, auraDmg, p.id, false, 0, 0, 0, 0, 0, events);
          }
        }
      }
    }

    if (meteorLevel > 0) {
      p.meteorTimer -= dt;
      if (p.meteorTimer <= 0) {
        const nearby = enemyGrid
          .queryRadius(p.x, p.y, 620, gridScratch)
          .filter((e) => e.hp > 0);
        if (nearby.length > 0) {
          p.meteorTimer = Math.max(1.2, 3.8 - meteorLevel * 0.4);
          const count = 1 + Math.floor(meteorLevel / 2);
          const dmg = (48 + meteorLevel * 22) * damageMultiplier;
          if (nearby.length > 1) {
            nearby.sort((a, b) => {
              const adx = a.x - p.x;
              const ady = a.y - p.y;
              const bdx = b.x - p.x;
              const bdy = b.y - p.y;
              return adx * adx + ady * ady - (bdx * bdx + bdy * bdy);
            });
          }
          for (let m = 0; m < count; m++) {
            const target = nearby[m % nearby.length];
            world.hazards.push({
              id: allocId(world, 'haz'),
              x: target.x,
              y: target.y,
              radius: 105,
              shape: 'circle',
              elapsed: 0,
              duration: 0.55,
              damage: dmg,
              fromEnemy: false,
              ownerId: p.id,
              color: '#c084fc',
              resolved: false,
            });
          }
        }
      }
    }

    if (droneLevel > 0) {
      p.droneAngle += dt * 2.1;
      p.droneTimer -= dt;
      if (p.droneTimer <= 0) {
        const target = enemyGrid.findNearest(
          p.x,
          p.y,
          DRONE_RANGE,
          (e) => e.hp > 0,
        );
        if (target) {
          p.droneTimer = Math.max(0.28, 0.9 - droneLevel * 0.12);
          const dx = p.x + Math.cos(p.droneAngle) * DRONE_ORBIT_RADIUS;
          const dy = p.y + Math.sin(p.droneAngle) * DRONE_ORBIT_RADIUS;
          const angle = Math.atan2(target.y - dy, target.x - dx);
          const speed = 820;
          world.projectiles.push({
            id: allocId(world, 'proj'),
            ownerId: p.id,
            fromEnemy: false,
            weaponId: 'drone',
            x: dx,
            y: dy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            startX: dx,
            startY: dy,
            radius: 5,
            damage: (14 + droneLevel * 7) * damageMultiplier,
            isCrit: false,
            pierceLeft: 1,
            ricochetLeft: 0,
            maxRange: 520,
            traveled: 0,
            ttl: 0.8,
            knockback: 18,
            aoeRadius: 0,
            slowPct: 0,
            slowDurationSec: 0,
            boomerang: false,
            returning: false,
            hitIds: [],
            color: '#34d399',
          });
        }
      }
    }

    if (frostNovaLevel > 0) {
      p.frostNovaTimer -= dt;
      if (p.frostNovaTimer <= 0) {
        const radius = 145 + frostNovaLevel * 22;
        const hits = enemyGrid.queryRadius(
          p.x,
          p.y,
          radius + MAX_ENEMY_RADIUS,
          gridScratch,
        );
        if (hits.some((e) => e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) <= radius + e.radius)) {
          p.frostNovaTimer = Math.max(2.0, 4.6 - frostNovaLevel * 0.45);
          const dmg = (26 + frostNovaLevel * 14) * damageMultiplier;
          for (let h = 0; h < hits.length; h++) {
            const e = hits[h];
            if (e.hp <= 0) continue;
            const dx = e.x - p.x;
            const dy = e.y - p.y;
            const d = Math.hypot(dx, dy);
            if (d <= radius + e.radius) {
              const nx = d > 1e-4 ? dx / d : 1;
              const ny = d > 1e-4 ? dy / d : 0;
              damageEnemy(
                world,
                e,
                dmg,
                p.id,
                false,
                55,
                nx,
                ny,
                0.45,
                2.6,
                events,
              );
            }
          }
          spawnParticles(world, p.x, p.y, '#7dd3fc', 14, 210);
        }
      }
    }

    if (caramelNovaLevel > 0) {
      p.caramelNovaTimer -= dt;
      if (p.caramelNovaTimer <= 0) {
        const target = enemyGrid.findNearest(
          p.x,
          p.y,
          560,
          (e) => e.hp > 0,
        );
        if (target) {
          p.caramelNovaTimer = Math.max(2.2, 5.0 - caramelNovaLevel * 0.5);
          const radius = 130 + caramelNovaLevel * 16;
          const dmg = (38 + caramelNovaLevel * 18) * damageMultiplier;
          const cx = target.x;
          const cy = target.y;
          const hits = enemyGrid.queryRadius(
            cx,
            cy,
            radius + MAX_ENEMY_RADIUS,
            aoeGridScratch,
          );
          for (let h = 0; h < hits.length; h++) {
            const e = hits[h];
            if (e.hp <= 0) continue;
            const dx = cx - e.x;
            const dy = cy - e.y;
            const d = Math.hypot(dx, dy);
            if (d <= radius + e.radius) {
              if (!e.isBoss && d > 8) {
                const pull = Math.min(d * 0.55, 42 + caramelNovaLevel * 6);
                e.x = clampCoord(e.x + (dx / d) * pull, e.radius);
                e.y = clampCoord(e.y + (dy / d) * pull, e.radius);
              }
              damageEnemy(world, e, dmg, p.id, false, 0, 0, 0, 0.25, 1.4, events);
            }
          }
          spawnParticles(world, cx, cy, '#ea580c', 14, 180);
        }
      }
    }

    if (prismChainLevel > 0) {
      p.prismChainTimer -= dt;
      if (p.prismChainTimer <= 0) {
        const first = enemyGrid.findNearest(
          p.x,
          p.y,
          420,
          (e) => e.hp > 0,
        );
        if (first) {
          p.prismChainTimer = Math.max(1.1, 3.0 - prismChainLevel * 0.35);
          const hops = 2 + prismChainLevel;
          let hopDmg = (28 + prismChainLevel * 14) * damageMultiplier;
          const visited = new Set<string>([first.id]);
          const points: Array<{ x: number; y: number }> = [
            { x: p.x, y: p.y },
            { x: first.x, y: first.y },
          ];
          damageEnemy(world, first, hopDmg, p.id, false, 0, 0, 0, 0, 0, events);
          let current = first;
          for (let h = 1; h < hops; h++) {
            hopDmg *= 0.88;
            const next = enemyGrid.findNearest(
              current.x,
              current.y,
              240,
              (cand) => cand.hp > 0 && !visited.has(cand.id),
            );
            if (!next) break;
            visited.add(next.id);
            points.push({ x: next.x, y: next.y });
            damageEnemy(world, next, hopDmg, p.id, false, 0, 0, 0, 0, 0, events);
            current = next;
          }
          world.lightningArcs.push({
            points,
            color: '#e879f9',
            ttl: 0.2,
            maxTtl: 0.2,
          });
        }
      }
    }

    if (voidPulseLevel > 0) {
      p.voidPulseTimer -= dt;
      if (p.voidPulseTimer <= 0) {
        const radius = 185 + voidPulseLevel * 26;
        const hits = enemyGrid.queryRadius(
          p.x,
          p.y,
          radius + MAX_ENEMY_RADIUS,
          gridScratch,
        );
        if (hits.some((e) => e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) <= radius + e.radius)) {
          p.voidPulseTimer = Math.max(2.4, 5.2 - voidPulseLevel * 0.5);
          const dmg = (46 + voidPulseLevel * 24) * damageMultiplier;
          for (let h = 0; h < hits.length; h++) {
            const e = hits[h];
            if (e.hp <= 0) continue;
            const dx = e.x - p.x;
            const dy = e.y - p.y;
            const d = Math.hypot(dx, dy);
            if (d <= radius + e.radius) {
              const nx = d > 1e-4 ? dx / d : 1;
              const ny = d > 1e-4 ? dy / d : 0;
              damageEnemy(
                world,
                e,
                dmg,
                p.id,
                false,
                150,
                nx,
                ny,
                0,
                0,
                events,
              );
            }
          }
          spawnParticles(world, p.x, p.y, '#9333ea', 16, 240);
        }
      }
    }
  }
}

function detonateAoe(
  world: SurvivalWorldState,
  x: number,
  y: number,
  radius: number,
  damage: number,
  knockback: number,
  ownerId: string,
  isCrit: boolean,
  events: SurvivalSimEvent[],
): void {
  const hits = enemyGrid.queryRadius(x, y, radius + MAX_ENEMY_RADIUS, aoeGridScratch);
  for (let i = 0; i < hits.length; i++) {
    const e = hits[i];
    if (e.hp <= 0) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = Math.hypot(dx, dy);
    if (d <= radius + e.radius) {
      const nx = d > 1e-4 ? dx / d : 1;
      const ny = d > 1e-4 ? dy / d : 0;
      damageEnemy(world, e, damage, ownerId, isCrit, knockback, nx, ny, 0, 0, events);
    }
  }

  for (let i = 0; i < world.crates.length; i++) {
    const c = world.crates[i];
    if (c.hp > 0 && Math.hypot(c.x - x, c.y - y) <= radius + c.radius) {
      damageCrate(world, c, damage, events);
    }
  }

  spawnParticles(world, x, y, '#c084fc', 10, 180);
}

function damagePlayer(
  world: SurvivalWorldState,
  player: PlayerEntity,
  rawDamage: number,
  events: SurvivalSimEvent[],
): void {
  if (player.downed || player.invulnTimer > 0) return;

  const dmg = Math.max(1, Math.round(rawDamage * (1 - player.stats.damageReduction)));
  player.hp = Math.max(0, player.hp - dmg);
  player.invulnTimer = 0.5;
  player.hitFlashTimer = 0.2;
  player.comboCount = 0;
  player.comboTimer = 0;
  addFloatingText(world, player.x, player.y - player.radius, `-${dmg}`, '#f87171', false);

  if (
    player.hp > 0 &&
    player.stats.crystalShieldLevel > 0 &&
    player.crystalShieldCooldown <= 0
  ) {
    const lv = player.stats.crystalShieldLevel;
    player.crystalShieldCooldown = Math.max(2.5, 6.0 - lv * 0.65);
    const shockRadius = 130 + lv * 18;
    const shockDmg = (28 + lv * 14) * getPlayerDamageMultiplier(world, player);
    const nearby = enemyGrid.queryRadius(
      player.x,
      player.y,
      shockRadius + MAX_ENEMY_RADIUS,
      aoeGridScratch,
    );
    for (let i = 0; i < nearby.length; i++) {
      const e = nearby[i];
      if (e.hp <= 0) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d <= shockRadius + e.radius) {
        const nx = d > 1e-4 ? dx / d : 1;
        const ny = d > 1e-4 ? dy / d : 0;
        damageEnemy(world, e, shockDmg, player.id, false, 95, nx, ny, 0, 0, events);
      }
    }
    spawnParticles(world, player.x, player.y, '#818cf8', 12, 190);
  }

  if (player.hp <= 0) {
    player.downed = true;
    player.reviveProgress = 0;
    player.dashTimer = 0;
    events.push({ type: 'player_down' });
  }
}

function hitsObstacleSegment(
  world: SurvivalWorldState,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius: number,
): boolean {
  for (let i = 0; i < world.obstacles.length; i++) {
    const obs = world.obstacles[i];
    if (closestPointOnSegmentDist(obs.x, obs.y, ax, ay, bx, by) <= radius + obs.radius) {
      return true;
    }
  }
  return false;
}

function updateProjectiles(
  world: SurvivalWorldState,
  dt: number,
  events: SurvivalSimEvent[],
): void {
  let writeIdx = 0;

  for (let i = 0; i < world.projectiles.length; i++) {
    const proj = world.projectiles[i];
    const prevX = proj.x;
    const prevY = proj.y;
    let alive = true;
    let reachedRangeEnd = false;
    proj.ttl -= dt;

    if (proj.ttl <= 0) {
      if (proj.aoeRadius > 0 && !proj.fromEnemy) {
        detonateAoe(
          world,
          proj.x,
          proj.y,
          proj.aoeRadius,
          proj.damage,
          proj.knockback,
          proj.ownerId,
          proj.isCrit,
          events,
        );
      }
      alive = false;
    }

    if (alive) {
      if (proj.boomerang) {
        if (!proj.returning) {
          const sx = proj.vx * dt;
          const sy = proj.vy * dt;
          proj.x += sx;
          proj.y += sy;
          proj.traveled += Math.hypot(sx, sy);
          if (proj.traveled >= proj.maxRange) {
            proj.returning = true;
            proj.hitIds = [];
          }
        } else {
          const owner = world.players.find((p) => p.id === proj.ownerId);
          if (!owner) {
            alive = false;
          } else {
            const dx = owner.x - proj.x;
            const dy = owner.y - proj.y;
            const dist = Math.hypot(dx, dy);
            const speed = Math.hypot(proj.vx, proj.vy) || 620;
            if (dist <= Math.max(24, speed * dt + 12)) {
              proj.x = owner.x;
              proj.y = owner.y;
              alive = false;
            } else {
              proj.vx = (dx / dist) * speed;
              proj.vy = (dy / dist) * speed;
              proj.x += proj.vx * dt;
              proj.y += proj.vy * dt;
            }
          }
        }
      } else {
        const sx = proj.vx * dt;
        const sy = proj.vy * dt;
        proj.x += sx;
        proj.y += sy;
        proj.traveled += Math.hypot(sx, sy);

        if (
          proj.x < 0 ||
          proj.x > WORLD_SIZE ||
          proj.y < 0 ||
          proj.y > WORLD_SIZE ||
          proj.traveled >= proj.maxRange
        ) {
          reachedRangeEnd = true;
        }
      }
    }

    if (
      alive &&
      !proj.boomerang &&
      proj.weaponId !== 'enemy_dragon' &&
      hitsObstacleSegment(world, prevX, prevY, proj.x, proj.y, proj.radius)
    ) {
      if (proj.aoeRadius > 0 && !proj.fromEnemy) {
        detonateAoe(
          world,
          proj.x,
          proj.y,
          proj.aoeRadius,
          proj.damage,
          proj.knockback,
          proj.ownerId,
          proj.isCrit,
          events,
        );
      }
      alive = false;
    }

    if (alive && proj.fromEnemy) {
      for (let j = 0; j < world.players.length; j++) {
        const p = world.players[j];
        if (!p.downed && p.invulnTimer <= 0) {
          if (
            closestPointOnSegmentDist(p.x, p.y, prevX, prevY, proj.x, proj.y) <=
            proj.radius + p.radius
          ) {
            damagePlayer(world, p, proj.damage, events);
            alive = false;
            break;
          }
        }
      }
    } else if (alive) {
      for (let c = 0; c < world.crates.length; c++) {
        const crate = world.crates[c];
        if (crate.hp <= 0 || proj.hitIds.includes(crate.id)) continue;
        if (
          closestPointOnSegmentDist(crate.x, crate.y, prevX, prevY, proj.x, proj.y) <=
          proj.radius + crate.radius
        ) {
          proj.hitIds.push(crate.id);
          if (proj.aoeRadius > 0) {
            detonateAoe(
              world,
              crate.x,
              crate.y,
              proj.aoeRadius,
              proj.damage,
              proj.knockback,
              proj.ownerId,
              proj.isCrit,
              events,
            );
            proj.pierceLeft = 0;
            alive = false;
            break;
          }
          damageCrate(world, crate, proj.damage, events);
          if (!proj.boomerang) {
            proj.pierceLeft -= 1;
            if (proj.pierceLeft <= 0) {
              alive = false;
              break;
            }
          }
        }
      }

      if (alive) {
        const segMidX = (prevX + proj.x) * 0.5;
        const segMidY = (prevY + proj.y) * 0.5;
        const halfStep = Math.hypot(proj.x - prevX, proj.y - prevY) * 0.5;
        const candidates = enemyGrid.queryRadius(
          segMidX,
          segMidY,
          proj.radius + MAX_ENEMY_RADIUS + halfStep,
          gridScratch,
        );
        if (candidates.length > 1) {
          candidates.sort((a, b) => {
            const adx = a.x - prevX;
            const ady = a.y - prevY;
            const bdx = b.x - prevX;
            const bdy = b.y - prevY;
            return adx * adx + ady * ady - (bdx * bdx + bdy * bdy);
          });
        }

        for (let k = 0; k < candidates.length; k++) {
          const enemy = candidates[k];
          if (enemy.hp <= 0 || proj.hitIds.includes(enemy.id)) continue;
          if (
            closestPointOnSegmentDist(enemy.x, enemy.y, prevX, prevY, proj.x, proj.y) >
            proj.radius + enemy.radius
          ) {
            continue;
          }

          proj.hitIds.push(enemy.id);

          if (proj.aoeRadius > 0) {
            detonateAoe(
              world,
              enemy.x,
              enemy.y,
              proj.aoeRadius,
              proj.damage,
              proj.knockback,
              proj.ownerId,
              proj.isCrit,
              events,
            );
            proj.pierceLeft = 0;
            alive = false;
            break;
          }

          const speed = Math.hypot(proj.vx, proj.vy) || 1;
          damageEnemy(
            world,
            enemy,
            proj.damage,
            proj.ownerId,
            proj.isCrit,
            proj.knockback,
            proj.vx / speed,
            proj.vy / speed,
            proj.slowPct,
            proj.slowDurationSec,
            events,
          );

          if (!proj.boomerang && proj.ricochetLeft > 0) {
            proj.ricochetLeft -= 1;
            const bounceTarget = enemyGrid.findNearest(
              enemy.x,
              enemy.y,
              RICOCHET_RANGE,
              (cand) => cand.hp > 0 && !proj.hitIds.includes(cand.id),
            );
            if (bounceTarget) {
              proj.x = enemy.x;
              proj.y = enemy.y;
              const ang = Math.atan2(bounceTarget.y - proj.y, bounceTarget.x - proj.x);
              proj.vx = Math.cos(ang) * speed;
              proj.vy = Math.sin(ang) * speed;
              proj.maxRange += 220;
              proj.ttl = Math.max(proj.ttl, 0.45);
              reachedRangeEnd = false;
              break;
            }
          }

          if (!proj.boomerang) {
            proj.pierceLeft -= 1;
            if (proj.pierceLeft <= 0) {
              alive = false;
              break;
            }
          }
        }
      }
    }

    if (alive && reachedRangeEnd) {
      if (proj.aoeRadius > 0 && !proj.fromEnemy) {
        detonateAoe(
          world,
          proj.x,
          proj.y,
          proj.aoeRadius,
          proj.damage,
          proj.knockback,
          proj.ownerId,
          proj.isCrit,
          events,
        );
      }
      alive = false;
    }

    if (alive) {
      world.projectiles[writeIdx++] = proj;
    }
  }

  world.projectiles.length = writeIdx;
}

function closestPointOnSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq <= 1e-6) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / abLenSq));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function updateHazards(
  world: SurvivalWorldState,
  dt: number,
  events: SurvivalSimEvent[],
): void {
  let writeIdx = 0;

  for (let i = 0; i < world.hazards.length; i++) {
    const h = world.hazards[i];
    if (h.fromEnemy && h.ownerId && !h.resolved) {
      const owner = world.enemies.find((e) => e.id === h.ownerId);
      if (!owner || owner.hp <= 0) {
        continue;
      }
    }

    h.elapsed += dt;

    if (h.elapsed >= h.duration && !h.resolved) {
      h.resolved = true;
      if (!h.fromEnemy) {
        const hits = enemyGrid.queryRadius(h.x, h.y, h.radius + MAX_ENEMY_RADIUS, gridScratch);
        for (let k = 0; k < hits.length; k++) {
          const e = hits[k];
          if (e.hp <= 0) continue;
          const dx = e.x - h.x;
          const dy = e.y - h.y;
          const d = Math.hypot(dx, dy);
          if (d <= h.radius + e.radius) {
            const nx = d > 1e-4 ? dx / d : 1;
            const ny = d > 1e-4 ? dy / d : 0;
            damageEnemy(
              world,
              e,
              h.damage,
              h.ownerId ?? '',
              false,
              90,
              nx,
              ny,
              0,
              0,
              events,
            );
          }
        }
        for (let c = 0; c < world.crates.length; c++) {
          const crate = world.crates[c];
          if (
            crate.hp > 0 &&
            Math.hypot(crate.x - h.x, crate.y - h.y) <= h.radius + crate.radius
          ) {
            damageCrate(world, crate, h.damage, events);
          }
        }
      } else {
        for (let j = 0; j < world.players.length; j++) {
          const p = world.players[j];
          if (p.downed || p.invulnTimer > 0) continue;
          const dist =
            h.shape === 'circle'
              ? Math.hypot(p.x - h.x, p.y - h.y)
              : closestPointOnSegmentDist(
                  p.x,
                  p.y,
                  h.x,
                  h.y,
                  h.endX ?? h.x,
                  h.endY ?? h.y,
                );
          if (dist <= h.radius + p.radius) {
            damagePlayer(world, p, h.damage, events);
          }
        }
      }
      spawnParticles(world, h.x, h.y, h.color, 10, 170);
    }

    if (h.elapsed < h.duration + 0.22) {
      world.hazards[writeIdx++] = h;
    }
  }

  world.hazards.length = writeIdx;
}

function createEnemy(
  world: SurvivalWorldState,
  kind: EnemyKind,
  x: number,
  y: number,
  bossTier = 0,
): EnemyEntity {
  const tpl = ENEMY_TEMPLATES[kind];
  const isBoss = isBossKind(kind);
  const mapMeta = getSurvivalMapMeta(world.mapId);
  const teamSize = Math.max(1, world.players.length);
  const teamHpMult = 1 + (teamSize - 1) * 0.45;

  let hp: number;
  let damage: number;
  if (isBoss) {
    const tier = Math.max(1, bossTier);
    hp = Math.round(
      tpl.baseHp *
        mapMeta.difficulty.bossHpMult *
        teamHpMult *
        (1 + (tier - 1) * 0.65),
    );
    damage = Math.round(
      tpl.damage * mapMeta.difficulty.damageMult * (1 + (tier - 1) * 0.25),
    );
  } else {
    const timeMult =
      1 +
      (world.elapsedSec / 60) * 0.18 +
      (world.elapsedSec > 360 ? ((world.elapsedSec - 360) / 60) * 0.35 : 0);
    hp = Math.round(
      tpl.baseHp * mapMeta.difficulty.hpMult * teamHpMult * timeMult,
    );
    damage = Math.round(
      tpl.damage *
        mapMeta.difficulty.damageMult *
        (1 + (world.elapsedSec / 180) * 0.15),
    );
  }

  return {
    id: allocId(world, isBoss ? 'boss' : 'enemy'),
    kind,
    isBoss,
    bossTier: isBoss ? Math.max(1, bossTier) : 0,
    x: clampCoord(x, tpl.radius),
    y: clampCoord(y, tpl.radius),
    vx: 0,
    vy: 0,
    radius: tpl.radius,
    hp,
    maxHp: hp,
    speed: tpl.speed,
    damage,
    xpValue: tpl.xpValue,
    scoreValue: tpl.scoreValue,
    hitFlashTimer: 0,
    slowTimer: 0,
    slowFactor: 0,
    attackCooldown: isBoss ? 2.5 : 1.0,
    stateTimer: 0,
    dashVx: 0,
    dashVy: 0,
    telegraphX: 0,
    telegraphY: 0,
    telegraphTimer: 0,
    telegraphRadius: 0,
    telegraphKind: 'none',
    chargeRemaining: 0,
  };
}

function findNearestLivingPlayer(
  world: SurvivalWorldState,
  x: number,
  y: number,
): { player: PlayerEntity; dist: number } | null {
  let best: PlayerEntity | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < world.players.length; i++) {
    const p = world.players[i];
    if (p.downed) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best ? { player: best, dist: bestDist } : null;
}

function getMaxEnemiesForTeam(world: SurvivalWorldState): number {
  const teamSize = Math.max(1, world.players.length);
  return Math.min(220, 160 + (teamSize - 1) * 20);
}

function startBossLineCharge(
  world: SurvivalWorldState,
  boss: EnemyEntity,
  target: PlayerEntity,
  length: number,
  radius: number,
  duration: number,
  damageMult: number,
  dashTime: number,
  color: string,
): void {
  const dx = target.x - boss.x;
  const dy = target.y - boss.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  const endX = clampCoord(boss.x + nx * length, boss.radius);
  const endY = clampCoord(boss.y + ny * length, boss.radius);
  const dashSpeed = length / dashTime;

  boss.telegraphKind = 'charge';
  boss.telegraphTimer = duration;
  boss.telegraphX = endX;
  boss.telegraphY = endY;
  boss.telegraphRadius = radius;
  boss.dashVx = nx * dashSpeed;
  boss.dashVy = ny * dashSpeed;

  world.hazards.push({
    id: allocId(world, 'haz'),
    x: boss.x,
    y: boss.y,
    endX,
    endY,
    radius,
    shape: 'line',
    elapsed: 0,
    duration,
    damage: Math.round(boss.damage * damageMult),
    fromEnemy: true,
    ownerId: boss.id,
    color,
    resolved: false,
  });
}

function stepSlimeKingAi(
  world: SurvivalWorldState,
  boss: EnemyEntity,
  target: PlayerEntity,
  nx: number,
  ny: number,
  effSpeed: number,
  dt: number,
): void {
  boss.vx = nx * effSpeed;
  boss.vy = ny * effSpeed;
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;

  if (boss.telegraphTimer > 0) {
    boss.telegraphTimer = Math.max(0, boss.telegraphTimer - dt);
    if (boss.telegraphTimer === 0) boss.telegraphKind = 'none';
  }

  if (boss.attackCooldown > 0) return;

  boss.attackCooldown = 4.5;
  boss.telegraphKind = 'slam';
  boss.telegraphX = target.x;
  boss.telegraphY = target.y;
  boss.telegraphRadius = 130;
  boss.telegraphTimer = 0.9;
  world.hazards.push({
    id: allocId(world, 'haz'),
    x: target.x,
    y: target.y,
    radius: 130,
    shape: 'circle',
    elapsed: 0,
    duration: 0.9,
    damage: Math.round(boss.damage * 1.4),
    fromEnemy: true,
    ownerId: boss.id,
    color: '#ef4444',
    resolved: false,
  });

  const maxEnemies = getMaxEnemiesForTeam(world);
  const miniCount = 4 + Math.floor(nextRng(world) * 3);
  for (let m = 0; m < miniCount && world.enemies.length < maxEnemies; m++) {
    const ang = (m * Math.PI * 2) / miniCount + nextRng(world) * 0.4;
    const rad = 75 + nextRng(world) * 35;
    world.enemies.push(
      createEnemy(
        world,
        'slime',
        boss.x + Math.cos(ang) * rad,
        boss.y + Math.sin(ang) * rad,
      ),
    );
  }
}

function stepFrostBearAi(
  world: SurvivalWorldState,
  boss: EnemyEntity,
  target: PlayerEntity,
  nx: number,
  ny: number,
  effSpeed: number,
  dt: number,
): void {
  if (boss.stateTimer > 0) {
    boss.vx = boss.dashVx;
    boss.vy = boss.dashVy;
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;
    boss.stateTimer = Math.max(0, boss.stateTimer - dt);
    if (boss.stateTimer === 0) {
      if (boss.chargeRemaining > 0) {
        startBossLineCharge(world, boss, target, 360, 42, 0.75, 1.35, 0.42, '#38bdf8');
      } else {
        world.hazards.push({
          id: allocId(world, 'haz'),
          x: boss.x,
          y: boss.y,
          radius: 115,
          shape: 'circle',
          elapsed: 0,
          duration: 0.55,
          damage: Math.round(boss.damage * 1.2),
          fromEnemy: true,
          ownerId: boss.id,
          color: '#60a5fa',
          resolved: false,
        });
      }
    }
    return;
  }

  if (boss.telegraphKind === 'charge' && boss.telegraphTimer > 0) {
    boss.vx = 0;
    boss.vy = 0;
    boss.telegraphTimer = Math.max(0, boss.telegraphTimer - dt);
    if (boss.telegraphTimer === 0) {
      boss.telegraphKind = 'none';
      boss.stateTimer = 0.42;
      boss.chargeRemaining = Math.max(0, boss.chargeRemaining - 1);
    }
    return;
  }

  boss.vx = nx * effSpeed;
  boss.vy = ny * effSpeed;
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;

  if (boss.attackCooldown <= 0) {
    boss.attackCooldown = 4.0;
    boss.chargeRemaining = 3;
    startBossLineCharge(world, boss, target, 360, 42, 0.75, 1.35, 0.42, '#38bdf8');
  }
}

function stepSnowDragonAi(
  world: SurvivalWorldState,
  boss: EnemyEntity,
  target: PlayerEntity,
  nx: number,
  ny: number,
  effSpeed: number,
  dt: number,
): void {
  if (boss.stateTimer > 0) {
    boss.vx = boss.dashVx;
    boss.vy = boss.dashVy;
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;
    boss.stateTimer = Math.max(0, boss.stateTimer - dt);
    return;
  }

  if (boss.telegraphKind === 'charge' && boss.telegraphTimer > 0) {
    boss.vx = 0;
    boss.vy = 0;
    boss.telegraphTimer = Math.max(0, boss.telegraphTimer - dt);
    if (boss.telegraphTimer === 0) {
      boss.telegraphKind = 'none';
      boss.stateTimer = 0.4;
    }
    return;
  }

  if (boss.telegraphTimer > 0) {
    boss.telegraphTimer = Math.max(0, boss.telegraphTimer - dt);
    if (boss.telegraphTimer === 0) boss.telegraphKind = 'none';
  }

  boss.vx = nx * effSpeed;
  boss.vy = ny * effSpeed;
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;

  if (boss.attackCooldown > 0) return;

  const pattern = boss.chargeRemaining % 3;
  boss.chargeRemaining += 1;

  if (pattern === 0) {
    boss.attackCooldown = 3.2;
    boss.telegraphKind = 'volley';
    boss.telegraphTimer = 0.5;
    const bullets = 12;
    const baseAngle = world.elapsedSec * 0.7;
    for (let b = 0; b < bullets; b++) {
      const ang = baseAngle + (b * Math.PI * 2) / bullets;
      const speed = 260;
      world.projectiles.push({
        id: allocId(world, 'eproj'),
        ownerId: boss.id,
        fromEnemy: true,
        weaponId: 'enemy_dragon',
        x: boss.x,
        y: boss.y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        startX: boss.x,
        startY: boss.y,
        radius: 9,
        damage: boss.damage,
        isCrit: false,
        pierceLeft: 1,
        ricochetLeft: 0,
        maxRange: 720,
        traveled: 0,
        ttl: 2.9,
        knockback: 0,
        aoeRadius: 0,
        slowPct: 0,
        slowDurationSec: 0,
        boomerang: false,
        returning: false,
        hitIds: [],
        color: '#38bdf8',
      });
    }
  } else if (pattern === 1) {
    boss.attackCooldown = 3.4;
    const count = 3 + Math.floor(nextRng(world) * 3);
    for (let c = 0; c < count; c++) {
      const tx = clampCoord(target.x + (nextRng(world) - 0.5) * 260, 85);
      const ty = clampCoord(target.y + (nextRng(world) - 0.5) * 260, 85);
      world.hazards.push({
        id: allocId(world, 'haz'),
        x: tx,
        y: ty,
        radius: 85,
        shape: 'circle',
        elapsed: 0,
        duration: 1.0,
        damage: Math.round(boss.damage * 1.3),
        fromEnemy: true,
        color: '#38bdf8',
        resolved: false,
      });
    }
  } else {
    boss.attackCooldown = 3.6;
    startBossLineCharge(world, boss, target, 420, 46, 0.75, 1.4, 0.4, '#60a5fa');
  }
}

function fireBossRadialVolley(
  world: SurvivalWorldState,
  boss: EnemyEntity,
  bullets: number,
  speed: number,
  color: string,
  baseAngle: number,
): void {
  for (let b = 0; b < bullets; b++) {
    const ang = baseAngle + (b * Math.PI * 2) / bullets;
    world.projectiles.push({
      id: allocId(world, 'eproj'),
      ownerId: boss.id,
      fromEnemy: true,
      weaponId: 'enemy_dragon',
      x: boss.x,
      y: boss.y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      startX: boss.x,
      startY: boss.y,
      radius: 9,
      damage: boss.damage,
      isCrit: false,
      pierceLeft: 1,
      ricochetLeft: 0,
      maxRange: 740,
      traveled: 0,
      ttl: 2.9,
      knockback: 0,
      aoeRadius: 0,
      slowPct: 0,
      slowDurationSec: 0,
      boomerang: false,
      returning: false,
      hitIds: [],
      color,
    });
  }
}

function stepJellyKingAi(
  world: SurvivalWorldState,
  boss: EnemyEntity,
  target: PlayerEntity,
  nx: number,
  ny: number,
  effSpeed: number,
  dt: number,
): void {
  boss.vx = nx * effSpeed;
  boss.vy = ny * effSpeed;
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;

  if (boss.telegraphTimer > 0) {
    boss.telegraphTimer = Math.max(0, boss.telegraphTimer - dt);
    if (boss.telegraphTimer === 0) boss.telegraphKind = 'none';
  }
  if (boss.attackCooldown > 0) return;

  boss.attackCooldown = 4.0;
  boss.telegraphKind = 'slam';
  boss.telegraphX = target.x;
  boss.telegraphY = target.y;
  boss.telegraphRadius = 135;
  boss.telegraphTimer = 0.85;

  // Twin caramel slam rings (on target + around boss)
  for (let i = 0; i < 2; i++) {
    const hx = i === 0 ? target.x : boss.x;
    const hy = i === 0 ? target.y : boss.y;
    world.hazards.push({
      id: allocId(world, 'haz'),
      x: hx,
      y: hy,
      radius: i === 0 ? 125 : 115,
      shape: 'circle',
      elapsed: 0,
      duration: 0.85,
      damage: Math.round(boss.damage * 1.35),
      fromEnemy: true,
      ownerId: boss.id,
      color: '#fb923c',
      resolved: false,
    });
  }

  const maxEnemies = getMaxEnemiesForTeam(world);
  const count = 3 + Math.floor(nextRng(world) * 2);
  for (let m = 0; m < count && world.enemies.length < maxEnemies; m++) {
    const ang = (m * Math.PI * 2) / count + nextRng(world) * 0.4;
    const kind: EnemyKind = m === 0 ? 'bomber' : 'slime';
    world.enemies.push(
      createEnemy(world, kind, boss.x + Math.cos(ang) * 88, boss.y + Math.sin(ang) * 88),
    );
  }
}

function stepCandyScorpionAi(
  world: SurvivalWorldState,
  boss: EnemyEntity,
  target: PlayerEntity,
  nx: number,
  ny: number,
  effSpeed: number,
  dt: number,
): void {
  if (boss.stateTimer > 0) {
    boss.vx = boss.dashVx;
    boss.vy = boss.dashVy;
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;
    boss.stateTimer = Math.max(0, boss.stateTimer - dt);
    if (boss.stateTimer === 0 && boss.chargeRemaining > 0) {
      startBossLineCharge(world, boss, target, 390, 40, 0.65, 1.35, 0.36, '#f59e0b');
    }
    return;
  }

  if (boss.telegraphKind === 'charge' && boss.telegraphTimer > 0) {
    boss.vx = 0;
    boss.vy = 0;
    boss.telegraphTimer = Math.max(0, boss.telegraphTimer - dt);
    if (boss.telegraphTimer === 0) {
      boss.telegraphKind = 'none';
      boss.stateTimer = 0.36;
      boss.chargeRemaining = Math.max(0, boss.chargeRemaining - 1);
    }
    return;
  }

  boss.vx = nx * effSpeed;
  boss.vy = ny * effSpeed;
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;

  if (boss.attackCooldown > 0) return;

  boss.attackCooldown = 3.5;
  boss.chargeRemaining = 2;
  startBossLineCharge(world, boss, target, 390, 40, 0.65, 1.35, 0.36, '#f59e0b');

  // Fan of 5 amber venom orbs toward target
  const aim = Math.atan2(target.y - boss.y, target.x - boss.x);
  for (let i = -2; i <= 2; i++) {
    const ang = aim + i * 0.22;
    const speed = 290;
    world.projectiles.push({
      id: allocId(world, 'eproj'),
      ownerId: boss.id,
      fromEnemy: true,
      weaponId: 'enemy_orb',
      x: boss.x,
      y: boss.y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      startX: boss.x,
      startY: boss.y,
      radius: 8,
      damage: Math.round(boss.damage * 0.9),
      isCrit: false,
      pierceLeft: 1,
      ricochetLeft: 0,
      maxRange: 640,
      traveled: 0,
      ttl: 2.3,
      knockback: 0,
      aoeRadius: 0,
      slowPct: 0,
      slowDurationSec: 0,
      boomerang: false,
      returning: false,
      hitIds: [],
      color: '#fbbf24',
    });
  }
}

function stepSugarPharaohAi(
  world: SurvivalWorldState,
  boss: EnemyEntity,
  target: PlayerEntity,
  nx: number,
  ny: number,
  effSpeed: number,
  dt: number,
): void {
  if (boss.stateTimer > 0) {
    boss.vx = boss.dashVx;
    boss.vy = boss.dashVy;
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;
    boss.stateTimer = Math.max(0, boss.stateTimer - dt);
    return;
  }
  if (boss.telegraphKind === 'charge' && boss.telegraphTimer > 0) {
    boss.vx = 0;
    boss.vy = 0;
    boss.telegraphTimer = Math.max(0, boss.telegraphTimer - dt);
    if (boss.telegraphTimer === 0) {
      boss.telegraphKind = 'none';
      boss.stateTimer = 0.38;
    }
    return;
  }
  if (boss.telegraphTimer > 0) {
    boss.telegraphTimer = Math.max(0, boss.telegraphTimer - dt);
    if (boss.telegraphTimer === 0) boss.telegraphKind = 'none';
  }

  boss.vx = nx * effSpeed;
  boss.vy = ny * effSpeed;
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;
  if (boss.attackCooldown > 0) return;

  const pattern = boss.chargeRemaining % 3;
  boss.chargeRemaining += 1;

  if (pattern === 0) {
    boss.attackCooldown = 2.9;
    boss.telegraphKind = 'volley';
    boss.telegraphTimer = 0.45;
    fireBossRadialVolley(world, boss, 14, 275, '#fb923c', world.elapsedSec * 0.9);
  } else if (pattern === 1) {
    boss.attackCooldown = 3.1;
    const count = 4 + Math.floor(nextRng(world) * 2);
    for (let c = 0; c < count; c++) {
      const tx = clampCoord(target.x + (nextRng(world) - 0.5) * 280, 88);
      const ty = clampCoord(target.y + (nextRng(world) - 0.5) * 280, 88);
      world.hazards.push({
        id: allocId(world, 'haz'),
        x: tx,
        y: ty,
        radius: 88,
        shape: 'circle',
        elapsed: 0,
        duration: 0.92,
        damage: Math.round(boss.damage * 1.35),
        fromEnemy: true,
        color: '#f97316',
        resolved: false,
      });
    }
  } else {
    boss.attackCooldown = 3.2;
    startBossLineCharge(world, boss, target, 450, 48, 0.7, 1.45, 0.38, '#fbbf24');
  }
}

function stepQuartzLordAi(
  world: SurvivalWorldState,
  boss: EnemyEntity,
  target: PlayerEntity,
  nx: number,
  ny: number,
  effSpeed: number,
  dt: number,
): void {
  boss.vx = nx * effSpeed;
  boss.vy = ny * effSpeed;
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;

  if (boss.telegraphTimer > 0) {
    boss.telegraphTimer = Math.max(0, boss.telegraphTimer - dt);
    if (boss.telegraphTimer === 0) boss.telegraphKind = 'none';
  }
  if (boss.attackCooldown > 0) return;

  boss.attackCooldown = 3.6;
  boss.telegraphKind = 'volley';
  boss.telegraphTimer = 0.5;
  fireBossRadialVolley(world, boss, 10, 285, '#c084fc', world.elapsedSec);

  world.hazards.push({
    id: allocId(world, 'haz'),
    x: target.x,
    y: target.y,
    radius: 118,
    shape: 'circle',
    elapsed: 0,
    duration: 0.85,
    damage: Math.round(boss.damage * 1.35),
    fromEnemy: true,
    ownerId: boss.id,
    color: '#c084fc',
    resolved: false,
  });

  const maxEnemies = getMaxEnemiesForTeam(world);
  if (world.enemies.length + 2 < maxEnemies) {
    world.enemies.push(createEnemy(world, 'owl_mage', boss.x + 85, boss.y));
    world.enemies.push(createEnemy(world, 'bat', boss.x - 85, boss.y));
  }
}

function stepCrystalGolemAi(
  world: SurvivalWorldState,
  boss: EnemyEntity,
  target: PlayerEntity,
  nx: number,
  ny: number,
  effSpeed: number,
  dt: number,
): void {
  if (boss.stateTimer > 0) {
    boss.vx = boss.dashVx;
    boss.vy = boss.dashVy;
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;
    boss.stateTimer = Math.max(0, boss.stateTimer - dt);
    if (boss.stateTimer === 0) {
      if (boss.chargeRemaining > 0) {
        startBossLineCharge(world, boss, target, 400, 48, 0.68, 1.45, 0.38, '#a855f7');
      } else {
        for (let i = 0; i < 2; i++) {
          world.hazards.push({
            id: allocId(world, 'haz'),
            x: i === 0 ? boss.x : target.x,
            y: i === 0 ? boss.y : target.y,
            radius: 122,
            shape: 'circle',
            elapsed: 0,
            duration: 0.65,
            damage: Math.round(boss.damage * 1.3),
            fromEnemy: true,
            ownerId: boss.id,
            color: '#e879f9',
            resolved: false,
          });
        }
      }
    }
    return;
  }

  if (boss.telegraphKind === 'charge' && boss.telegraphTimer > 0) {
    boss.vx = 0;
    boss.vy = 0;
    boss.telegraphTimer = Math.max(0, boss.telegraphTimer - dt);
    if (boss.telegraphTimer === 0) {
      boss.telegraphKind = 'none';
      boss.stateTimer = 0.38;
      boss.chargeRemaining = Math.max(0, boss.chargeRemaining - 1);
    }
    return;
  }

  boss.vx = nx * effSpeed;
  boss.vy = ny * effSpeed;
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;

  if (boss.attackCooldown <= 0) {
    boss.attackCooldown = 3.5;
    boss.chargeRemaining = 3;
    startBossLineCharge(world, boss, target, 400, 48, 0.68, 1.45, 0.38, '#a855f7');
  }
}

function stepVoidDragonAi(
  world: SurvivalWorldState,
  boss: EnemyEntity,
  target: PlayerEntity,
  nx: number,
  ny: number,
  effSpeed: number,
  dt: number,
): void {
  if (boss.stateTimer > 0) {
    boss.vx = boss.dashVx;
    boss.vy = boss.dashVy;
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;
    boss.stateTimer = Math.max(0, boss.stateTimer - dt);
    return;
  }
  if (boss.telegraphKind === 'charge' && boss.telegraphTimer > 0) {
    boss.vx = 0;
    boss.vy = 0;
    boss.telegraphTimer = Math.max(0, boss.telegraphTimer - dt);
    if (boss.telegraphTimer === 0) {
      boss.telegraphKind = 'none';
      boss.stateTimer = 0.36;
    }
    return;
  }
  if (boss.telegraphTimer > 0) {
    boss.telegraphTimer = Math.max(0, boss.telegraphTimer - dt);
    if (boss.telegraphTimer === 0) boss.telegraphKind = 'none';
  }

  boss.vx = nx * effSpeed;
  boss.vy = ny * effSpeed;
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;
  if (boss.attackCooldown > 0) return;

  const pattern = boss.chargeRemaining % 3;
  boss.chargeRemaining += 1;

  if (pattern === 0) {
    boss.attackCooldown = 2.6;
    boss.telegraphKind = 'volley';
    boss.telegraphTimer = 0.45;
    fireBossRadialVolley(world, boss, 16, 295, '#e879f9', world.elapsedSec * 1.1);
  } else if (pattern === 1) {
    boss.attackCooldown = 2.8;
    const count = 5 + Math.floor(nextRng(world) * 2);
    for (let c = 0; c < count; c++) {
      const tx = clampCoord(target.x + (nextRng(world) - 0.5) * 300, 90);
      const ty = clampCoord(target.y + (nextRng(world) - 0.5) * 300, 90);
      world.hazards.push({
        id: allocId(world, 'haz'),
        x: tx,
        y: ty,
        radius: 90,
        shape: 'circle',
        elapsed: 0,
        duration: 0.88,
        damage: Math.round(boss.damage * 1.4),
        fromEnemy: true,
        color: '#c084fc',
        resolved: false,
      });
    }
  } else {
    boss.attackCooldown = 2.9;
    startBossLineCharge(world, boss, target, 480, 52, 0.65, 1.5, 0.36, '#e879f9');
  }
}

function stepBossAi(
  world: SurvivalWorldState,
  boss: EnemyEntity,
  target: PlayerEntity,
  dist: number,
  effSpeed: number,
  dt: number,
): void {
  const nx = dist > 1e-4 ? (target.x - boss.x) / dist : 1;
  const ny = dist > 1e-4 ? (target.y - boss.y) / dist : 0;

  switch (boss.kind) {
    case 'boss_slime_king':
      stepSlimeKingAi(world, boss, target, nx, ny, effSpeed, dt);
      break;
    case 'boss_frost_bear':
      stepFrostBearAi(world, boss, target, nx, ny, effSpeed, dt);
      break;
    case 'boss_snow_dragon':
      stepSnowDragonAi(world, boss, target, nx, ny, effSpeed, dt);
      break;
    case 'boss_jelly_king':
      stepJellyKingAi(world, boss, target, nx, ny, effSpeed, dt);
      break;
    case 'boss_candy_scorpion':
      stepCandyScorpionAi(world, boss, target, nx, ny, effSpeed, dt);
      break;
    case 'boss_sugar_pharaoh':
      stepSugarPharaohAi(world, boss, target, nx, ny, effSpeed, dt);
      break;
    case 'boss_quartz_lord':
      stepQuartzLordAi(world, boss, target, nx, ny, effSpeed, dt);
      break;
    case 'boss_crystal_golem':
      stepCrystalGolemAi(world, boss, target, nx, ny, effSpeed, dt);
      break;
    default:
      stepVoidDragonAi(world, boss, target, nx, ny, effSpeed, dt);
      break;
  }
}

function updateEnemies(
  world: SurvivalWorldState,
  dt: number,
  events: SurvivalSimEvent[],
): void {
  let writeIdx = 0;

  for (let i = 0; i < world.enemies.length; i++) {
    const e = world.enemies[i];
    if (e.hp <= 0) continue;

    e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
    e.slowTimer = Math.max(0, e.slowTimer - dt);
    if (e.slowTimer === 0) e.slowFactor = 0;
    e.attackCooldown = Math.max(0, e.attackCooldown - dt);

    const effSpeed = e.speed * (1 - e.slowFactor);
    const nearest = findNearestLivingPlayer(world, e.x, e.y);

    if (nearest) {
      const { player: target, dist } = nearest;
      const nx = dist > 1e-4 ? (target.x - e.x) / dist : 1;
      const ny = dist > 1e-4 ? (target.y - e.y) / dist : 0;

      if (e.isBoss) {
        stepBossAi(world, e, target, dist, effSpeed, dt);
      } else if (e.kind === 'wolf') {
        if (e.stateTimer > 0) {
          e.vx = e.dashVx;
          e.vy = e.dashVy;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.stateTimer = Math.max(0, e.stateTimer - dt);
        } else if (e.telegraphKind === 'lunge' && e.telegraphTimer > 0) {
          e.vx = 0;
          e.vy = 0;
          e.telegraphTimer = Math.max(0, e.telegraphTimer - dt);
          if (e.telegraphTimer === 0) {
            e.telegraphKind = 'none';
            e.stateTimer = 0.28;
            e.attackCooldown = 3.2;
          }
        } else if (dist <= 185 && e.attackCooldown <= 0) {
          e.telegraphKind = 'lunge';
          e.telegraphTimer = 0.45;
          e.telegraphX = target.x;
          e.telegraphY = target.y;
          e.telegraphRadius = 26;
          e.dashVx = nx * effSpeed * 2.8;
          e.dashVy = ny * effSpeed * 2.8;
        } else {
          e.vx = nx * effSpeed;
          e.vy = ny * effSpeed;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
        }
      } else if (e.kind === 'owl_mage') {
        if (dist > 340) {
          e.vx = nx * effSpeed;
          e.vy = ny * effSpeed;
        } else if (dist < 200) {
          e.vx = -nx * effSpeed * 0.7;
          e.vy = -ny * effSpeed * 0.7;
        } else {
          e.vx = -ny * effSpeed * 0.6;
          e.vy = nx * effSpeed * 0.6;
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;

        if (dist <= 460 && e.attackCooldown <= 0) {
          e.attackCooldown = 2.6;
          const speed = 270;
          world.projectiles.push({
            id: allocId(world, 'eproj'),
            ownerId: e.id,
            fromEnemy: true,
            weaponId: 'enemy_orb',
            x: e.x,
            y: e.y,
            vx: nx * speed,
            vy: ny * speed,
            startX: e.x,
            startY: e.y,
            radius: 8,
            damage: e.damage,
            isCrit: false,
            pierceLeft: 1,
            ricochetLeft: 0,
            maxRange: 520,
            traveled: 0,
            ttl: 2.1,
            knockback: 0,
            aoeRadius: 0,
            slowPct: 0,
            slowDurationSec: 0,
            boomerang: false,
            returning: false,
            hitIds: [],
            color: '#fb7185',
          });
        }
      } else if (e.kind === 'bomber') {
        if (e.telegraphKind === 'explode') {
          e.vx = 0;
          e.vy = 0;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            e.hp = 0;
            spawnParticles(world, e.x, e.y, '#f97316', 10, 160);
            continue;
          }
        } else if (dist <= 82) {
          e.telegraphKind = 'explode';
          e.telegraphTimer = 0.8;
          e.telegraphX = e.x;
          e.telegraphY = e.y;
          e.telegraphRadius = 92;
          world.hazards.push({
            id: allocId(world, 'haz'),
            x: e.x,
            y: e.y,
            radius: 92,
            shape: 'circle',
            elapsed: 0,
            duration: 0.8,
            damage: e.damage,
            fromEnemy: true,
            ownerId: e.id,
            color: '#f97316',
            resolved: false,
          });
        } else {
          e.vx = nx * effSpeed;
          e.vy = ny * effSpeed;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
        }
      } else {
        // slime, bat, golem
        e.vx = nx * effSpeed;
        e.vy = ny * effSpeed;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }
    }

    if (!ENEMY_TEMPLATES[e.kind].flying) {
      pushOutOfObstacles(world, e);
    } else {
      e.x = clampCoord(e.x, e.radius);
      e.y = clampCoord(e.y, e.radius);
    }

    // Contact damage against living players
    for (let j = 0; j < world.players.length; j++) {
      const p = world.players[j];
      if (!p.downed && p.invulnTimer <= 0) {
        if (Math.hypot(p.x - e.x, p.y - e.y) <= p.radius + e.radius) {
          damagePlayer(world, p, e.damage, events);
        }
      }
    }

    world.enemies[writeIdx++] = e;
  }

  world.enemies.length = writeIdx;
}

function getUnlockedEnemyPool(elapsedSec: number): EnemyKind[] {
  const pool: EnemyKind[] = ['slime'];
  if (elapsedSec >= 45) pool.push('bat');
  if (elapsedSec >= 90) pool.push('wolf');
  if (elapsedSec >= 150) pool.push('owl_mage');
  if (elapsedSec >= 210) pool.push('golem');
  if (elapsedSec >= 270) pool.push('bomber');
  return pool;
}

function pickSpawnRingPos(
  world: SurvivalWorldState,
  minDist = 560,
  maxDist = 760,
): { x: number; y: number } {
  const living = world.players.filter((p) => !p.downed);
  const anchor =
    living.length > 0
      ? living[Math.floor(nextRng(world) * living.length)]
      : world.players[0];
  const ax = anchor ? anchor.x : WORLD_SIZE / 2;
  const ay = anchor ? anchor.y : WORLD_SIZE / 2;
  const angle = nextRng(world) * Math.PI * 2;
  const dist = minDist + nextRng(world) * (maxDist - minDist);
  return {
    x: clampCoord(ax + Math.cos(angle) * dist, 48),
    y: clampCoord(ay + Math.sin(angle) * dist, 48),
  };
}

function updateSpawnersAndBosses(
  world: SurvivalWorldState,
  dt: number,
  events: SurvivalSimEvent[],
): void {
  const mapMeta = getSurvivalMapMeta(world.mapId);
  const teamSize = Math.max(1, world.players.length);
  const spawnRateMult =
    (1 + (teamSize - 1) * 0.35) * mapMeta.difficulty.spawnRateMult;
  const maxEnemies = getMaxEnemiesForTeam(world);
  const endlessRamp =
    world.elapsedSec > 360 ? 1 + (world.elapsedSec - 360) / 180 : 1;

  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0) {
    const bossCalmFactor = world.activeBossId !== null ? 1.45 : 1;
    const baseInterval =
      Math.max(0.22, 1.15 - (world.elapsedSec / 360) * 0.65) * bossCalmFactor;
    world.spawnTimer = baseInterval / (spawnRateMult * endlessRamp);

    const unlockProgressSec =
      world.elapsedSec * (1 + (mapMeta.difficultyStars - 1) * 0.14);
    const pool = getUnlockedEnemyPool(unlockProgressSec);
    const batch = 1 + Math.floor(Math.min(4, world.elapsedSec / 75));

    for (let b = 0; b < batch && world.enemies.length < maxEnemies; b++) {
      const kind = pool[Math.floor(nextRng(world) * pool.length)];
      const pos = pickSpawnRingPos(world);
      world.enemies.push(createEnemy(world, kind, pos.x, pos.y));
    }
  }

  const crateCadenceMult =
    world.mapId === 'candy_canyon' && world.sandstormActiveTimer > 0 ? 2 : 1;
  world.crateSpawnTimer -= dt * crateCadenceMult;
  if (world.crateSpawnTimer <= 0) {
    world.crateSpawnTimer = 18;
    if (world.crates.length < 14) {
      spawnCrateSafe(world, 260);
    }
  }

  // Boss Schedule & Warning
  if (world.activeBossId !== null) {
    const stillAlive = world.enemies.some(
      (e) => e.id === world.activeBossId && e.hp > 0,
    );
    if (!stillAlive) {
      world.activeBossId = null;
    }
  }

  if (world.activeBossId === null) {
    const rotation = mapMeta.bossRotation;
    const upcomingKind = rotation[world.bossScheduleIndex % rotation.length];
    const timeUntilBoss = world.nextBossAtSec - world.elapsedSec;

    if (timeUntilBoss <= 5 && timeUntilBoss > 0) {
      if (world.bossWarningSec <= 0 || world.bossWarningKind !== upcomingKind) {
        events.push({ type: 'boss_warn', bossKind: upcomingKind });
      }
      world.bossWarningSec = timeUntilBoss;
      world.bossWarningKind = upcomingKind;
    } else if (timeUntilBoss > 5) {
      world.bossWarningSec = 0;
      world.bossWarningKind = null;
    }

    if (world.elapsedSec >= world.nextBossAtSec) {
      const bossTier = world.bossScheduleIndex + 1;
      const pos = pickSpawnRingPos(world, 560, 660);
      const boss = createEnemy(world, upcomingKind, pos.x, pos.y, bossTier);
      world.enemies.push(boss);
      world.activeBossId = boss.id;
      world.bossWarningSec = 0;
      world.bossWarningKind = null;
      events.push({ type: 'boss_spawn', bossKind: upcomingKind });
    }
  }
}

const XP_MERGE_TARGET = 140;

function mergeXpGemPass(
  world: SurvivalWorldState,
  cellSize: number,
  targetCount: number,
): void {
  const len = world.xpGems.length;
  if (len <= targetCount) return;

  const pendingByCell = new Map<number, XpGemEntity>();
  const consumed = new Uint8Array(len);
  let remaining = len;

  for (let i = 0; i < len; i++) {
    if (remaining <= targetCount) break;
    const gem = world.xpGems[i];
    if (gem.magnetizedBy !== null) continue;

    const cx = Math.floor(gem.x / cellSize);
    const cy = Math.floor(gem.y / cellSize);
    const key = (cx + 32768) * 65536 + (cy + 32768);
    const partner = pendingByCell.get(key);
    if (!partner) {
      pendingByCell.set(key, gem);
    } else {
      partner.value += gem.value;
      partner.tier = gemTierForValue(partner.value);
      partner.x = clampCoord((partner.x + gem.x) * 0.5, 12);
      partner.y = clampCoord((partner.y + gem.y) * 0.5, 12);
      consumed[i] = 1;
      pendingByCell.delete(key);
      remaining -= 1;
    }
  }

  if (remaining < len) {
    let writeIdx = 0;
    for (let i = 0; i < len; i++) {
      if (!consumed[i]) {
        world.xpGems[writeIdx++] = world.xpGems[i];
      }
    }
    world.xpGems.length = writeIdx;
  }
}

function mergeExcessXpGems(world: SurvivalWorldState): void {
  if (world.xpGems.length <= MAX_XP_GEMS) return;
  mergeXpGemPass(world, 180, XP_MERGE_TARGET);
  if (world.xpGems.length > MAX_XP_GEMS) {
    mergeXpGemPass(world, 360, XP_MERGE_TARGET);
  }
}

function applyOfferToPlayer(player: PlayerEntity, offer: SkillOffer): void {
  const spec = getSkillSpec(offer.skillId);
  const prevLv = player.skills[offer.skillId] ?? 0;
  const actualGain = Math.max(0, Math.min(offer.levelGain, spec.maxLevel - prevLv));
  const nextLv = prevLv + actualGain;
  player.skills[offer.skillId] = nextLv;

  if (actualGain > 0) {
    let powerGain: number;
    if (offer.rarity === 'common') {
      powerGain = 1.0 * actualGain;
    } else if (offer.rarity === 'rare') {
      powerGain = 1.25 * actualGain;
    } else {
      powerGain =
        spec.category === 'secondary' && actualGain === 2
          ? 2.0
          : 1.5 * actualGain;
    }
    player.skillPower[offer.skillId] =
      (player.skillPower[offer.skillId] ?? prevLv) + powerGain;
  }

  const prevMaxHp = player.maxHp;
  player.stats = computeDerivedStats(
    player.weaponId,
    player.gearId,
    player.skills,
    player.skillPower,
  );
  player.maxHp = player.stats.maxHp;

  const hpDelta = player.maxHp - prevMaxHp;
  if (hpDelta > 0 && !player.downed) {
    player.hp = Math.min(player.maxHp, player.hp + hpDelta);
  }
}

function closeLevelUpPhase(world: SurvivalWorldState): void {
  world.pendingOffersByPlayer = {};
  world.pickedPlayerIds = [];
  world.activeLevelUpGuaranteeRare = false;
  world.phase = 'playing';
}

function autoPickBotPlayersInLevelUp(world: SurvivalWorldState): void {
  for (let i = 0; i < world.players.length; i++) {
    const p = world.players[i];
    if ((p.isBot || p.botTakeover) && !world.pickedPlayerIds.includes(p.id)) {
      const offers = world.pendingOffersByPlayer[p.id];
      if (offers && offers.length > 0) {
        const botIdx = pickBotSkillIndex(p, offers);
        applyOfferToPlayer(p, offers[botIdx]);
      }
      world.pickedPlayerIds.push(p.id);
    }
  }
}

function areAllActiveHumansPicked(world: SurvivalWorldState): boolean {
  return world.players.every(
    (p) =>
      p.isBot ||
      p.botTakeover ||
      (world.pendingOffersByPlayer[p.id]?.length ?? 0) === 0 ||
      world.pickedPlayerIds.includes(p.id),
  );
}

function triggerLevelUpIfReady(
  world: SurvivalWorldState,
  events: SurvivalSimEvent[],
): void {
  if (world.teamXp < world.xpToNext || world.phase !== 'playing') return;
  if (world.players.length > 0 && world.players.every((p) => p.downed)) return;

  world.teamXp -= world.xpToNext;
  world.teamLevel += 1;
  world.xpToNext = xpForNextLevel(world.teamLevel);

  const guaranteeRare = world.levelUpGuaranteeRare;
  world.levelUpGuaranteeRare = false;
  world.activeLevelUpGuaranteeRare = guaranteeRare;
  world.pendingOffersByPlayer = {};
  world.pickedPlayerIds = [];
  world.levelUpTimerSec = 15;

  const rng = (): number => nextRng(world);

  for (let i = 0; i < world.players.length; i++) {
    const p = world.players[i];
    const offers = rollSkillOffers(p.skills, rng, guaranteeRare, world.mapId);
    world.pendingOffersByPlayer[p.id] = offers;

    if (p.isBot || p.botTakeover) {
      if (offers.length > 0) {
        const botIdx = pickBotSkillIndex(p, offers);
        applyOfferToPlayer(p, offers[botIdx]);
      }
      world.pickedPlayerIds.push(p.id);
    }
  }

  const humanPending = world.players.some(
    (p) =>
      !p.isBot &&
      !p.botTakeover &&
      (world.pendingOffersByPlayer[p.id]?.length ?? 0) > 0 &&
      !world.pickedPlayerIds.includes(p.id),
  );

  events.push({ type: 'level_up' });
  if (humanPending) {
    world.phase = 'levelup';
  } else {
    world.pendingOffersByPlayer = {};
    world.pickedPlayerIds = [];
    world.activeLevelUpGuaranteeRare = false;
  }
}

function updateXpAndPickups(
  world: SurvivalWorldState,
  dt: number,
  events: SurvivalSimEvent[],
): void {
  // Prune broken crates and tick hit flash
  let crateWrite = 0;
  for (let i = 0; i < world.crates.length; i++) {
    const c = world.crates[i];
    if (c.hp > 0) {
      c.hitFlashTimer = Math.max(0, c.hitFlashTimer - dt);
      world.crates[crateWrite++] = c;
    }
  }
  world.crates.length = crateWrite;

  mergeExcessXpGems(world);

  // Pull & collect XP gems
  let gemWrite = 0;
  for (let i = 0; i < world.xpGems.length; i++) {
    const gem = world.xpGems[i];
    let collector: PlayerEntity | null = null;

    if (gem.magnetizedBy !== null) {
      collector =
        world.players.find((p) => p.id === gem.magnetizedBy && !p.downed) ?? null;
      if (!collector) gem.magnetizedBy = null;
    }

    if (gem.magnetizedBy === null) {
      let bestDist = Infinity;
      for (let j = 0; j < world.players.length; j++) {
        const p = world.players[j];
        if (p.downed) continue;
        const d = Math.hypot(p.x - gem.x, p.y - gem.y);
        if (d <= p.stats.pickupRadius && d < bestDist) {
          bestDist = d;
          collector = p;
        }
      }
      if (collector) {
        gem.magnetizedBy = collector.id;
      }
    }

    let collected = false;
    if (collector) {
      const dx = collector.x - gem.x;
      const dy = collector.y - gem.y;
      const dist = Math.hypot(dx, dy);
      const step = XP_MAGNET_SPEED * dt;
      if (dist <= collector.radius + 12 + step) {
        world.teamXp += Math.round(gem.value * collector.stats.xpMultiplier);
        if (
          collector.stats.gemGreedLevel > 0 &&
          gem.tier !== 'green' &&
          !collector.downed
        ) {
          const heal = 1 + collector.stats.gemGreedLevel;
          collector.hp = Math.min(collector.maxHp, collector.hp + heal);
        }
        events.push({ type: 'xp_pickup' });
        collected = true;
      } else {
        gem.x += (dx / dist) * step;
        gem.y += (dy / dist) * step;
      }
    }

    if (!collected) {
      world.xpGems[gemWrite++] = gem;
    }
  }
  world.xpGems.length = gemWrite;

  // Pickups (heal / magnet)
  let pkWrite = 0;
  for (let i = 0; i < world.pickups.length; i++) {
    const pk = world.pickups[i];
    pk.ttl -= dt;
    if (pk.ttl <= 0) continue;

    let taken = false;
    for (let j = 0; j < world.players.length; j++) {
      const p = world.players[j];
      if (p.downed) continue;
      if (Math.hypot(p.x - pk.x, p.y - pk.y) <= p.radius + 22) {
        taken = true;
        if (pk.kind === 'heal') {
          p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.3));
          for (let k = 0; k < world.players.length; k++) {
            const mate = world.players[k];
            if (mate.id !== p.id && !mate.downed) {
              mate.hp = Math.min(mate.maxHp, mate.hp + Math.round(mate.maxHp * 0.15));
            }
          }
        } else {
          for (let g = 0; g < world.xpGems.length; g++) {
            world.xpGems[g].magnetizedBy = p.id;
          }
        }
        break;
      }
    }

    if (!taken) {
      world.pickups[pkWrite++] = pk;
    }
  }
  world.pickups.length = pkWrite;

  triggerLevelUpIfReady(world, events);
}

function pruneDeadEnemies(world: SurvivalWorldState): void {
  let writeIdx = 0;
  for (let i = 0; i < world.enemies.length; i++) {
    const e = world.enemies[i];
    if (e.hp > 0) {
      world.enemies[writeIdx++] = e;
    }
  }
  world.enemies.length = writeIdx;
}

function checkGameOver(
  world: SurvivalWorldState,
  events: SurvivalSimEvent[],
): boolean {
  if (world.players.length > 0 && world.players.every((p) => p.downed)) {
    world.phase = 'gameover';
    world.pendingOffersByPlayer = {};
    world.pickedPlayerIds = [];
    world.activeLevelUpGuaranteeRare = false;
    events.push({ type: 'gameover' });
    return true;
  }
  return false;
}

export function stepSurvivalWorld(
  world: SurvivalWorldState,
  inputs: Record<string, SurvivalInput>,
  rawDt: number,
): SurvivalSimEvent[] {
  const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0), 0.05) : 0;

  if (world.phase === 'victory' || world.phase === 'gameover') {
    decayVisualFx(world, dt);
    return [];
  }

  if (world.phase === 'levelup') {
    autoPickBotPlayersInLevelUp(world);
    if (areAllActiveHumansPicked(world)) {
      closeLevelUpPhase(world);
      return [];
    }

    if (world.mode === 'online_coop') {
      world.levelUpTimerSec -= dt;
      if (world.levelUpTimerSec <= 0) {
        for (let i = 0; i < world.players.length; i++) {
          const p = world.players[i];
          if (
            !p.isBot &&
            !p.botTakeover &&
            !world.pickedPlayerIds.includes(p.id)
          ) {
            applySkillPick(world, p.id, 0);
          }
        }
        if (world.phase === 'levelup') {
          closeLevelUpPhase(world);
        }
      }
    }
    return [];
  }

  const events: SurvivalSimEvent[] = [];
  world.elapsedSec += dt;

  updateMapZonesAndEnvironment(world, dt);
  updateTeamAura(world, dt);
  const resolvedInputs = updatePlayers(world, inputs, dt, events);
  rebuildEnemyGrid(world);

  const combatSteps: Array<() => void> = [
    () => updatePrimaryWeapons(world, resolvedInputs, events),
    () => updateSecondaryWeapons(world, dt, events),
    () => updateProjectiles(world, dt, events),
    () => updateHazards(world, dt, events),
    () => updateEnemies(world, dt, events),
  ];

  for (let i = 0; i < combatSteps.length; i++) {
    combatSteps[i]();
    if (world.phase === 'playing') {
      checkGameOver(world, events);
    }
    if (world.phase !== 'playing') {
      pruneDeadEnemies(world);
      decayVisualFx(world, dt);
      return events;
    }
  }

  updateSpawnersAndBosses(world, dt, events);
  updateXpAndPickups(world, dt, events);

  if (!checkGameOver(world, events) && world.phase === 'playing') {
    const endlessScoreMult =
      world.mapId === 'endless_abyss'
        ? 1 + Math.floor(world.elapsedSec / 60) * 0.15
        : 1;
    world.score += 5 * dt * endlessScoreMult;
  }

  decayVisualFx(world, dt);
  return events;
}

export function applySkillPick(
  world: SurvivalWorldState,
  playerId: string,
  offerIndex: number,
): boolean {
  if (world.phase !== 'levelup') return false;
  const player = world.players.find((p) => p.id === playerId);
  if (!player) return false;
  if (world.pickedPlayerIds.includes(playerId)) return false;

  const offers = world.pendingOffersByPlayer[playerId];
  if (
    !offers ||
    !Number.isInteger(offerIndex) ||
    offerIndex < 0 ||
    offerIndex >= offers.length
  ) {
    return false;
  }

  applyOfferToPlayer(player, offers[offerIndex]);
  world.pickedPlayerIds.push(playerId);

  autoPickBotPlayersInLevelUp(world);
  if (areAllActiveHumansPicked(world)) {
    closeLevelUpPhase(world);
  }

  return true;
}

export function rerollSkillOffers(
  world: SurvivalWorldState,
  playerId: string,
): boolean {
  if (world.phase !== 'levelup') return false;
  const player = world.players.find((p) => p.id === playerId);
  if (!player || player.rerollsLeft <= 0) return false;
  if (world.pickedPlayerIds.includes(playerId)) return false;

  const currentOffers = world.pendingOffersByPlayer[playerId];
  if (!currentOffers || currentOffers.length === 0) return false;

  player.rerollsLeft -= 1;
  world.pendingOffersByPlayer[playerId] = rollSkillOffers(
    player.skills,
    () => nextRng(world),
    world.activeLevelUpGuaranteeRare,
    world.mapId,
  );
  return true;
}

export function continueEndlessMode(world: SurvivalWorldState): void {
  if (world.phase !== 'victory') return;
  world.isEndlessActive = true;
  world.phase = 'playing';
  world.bossScheduleIndex = 3;
  world.nextBossAtSec = Math.max(world.elapsedSec + 45, 420);
  world.activeBossId = null;
  world.bossWarningSec = 0;
  world.bossWarningKind = null;

  for (let i = 0; i < world.players.length; i++) {
    const p = world.players[i];
    if (p.downed) {
      p.downed = false;
      p.reviveProgress = 0;
      p.hp = Math.round(p.maxHp * 0.6);
      p.invulnTimer = 2.0;
    }
  }
}

function toPlayerSummary(p: PlayerEntity): SurvivalPlayerSummary {
  return {
    id: p.id,
    name: p.name,
    animal: p.animal,
    weaponId: p.weaponId,
    gearId: p.gearId,
    isBot: p.isBot,
    hp: p.hp,
    maxHp: p.maxHp,
    downed: p.downed,
    reviveProgress: p.reviveProgress,
    kills: p.kills,
    damageDealt: Math.round(p.damageDealt),
    score: Math.round(p.score),
    revives: p.revives,
    skills: { ...p.skills },
    rerollsLeft: p.rerollsLeft,
    dashCooldownPct: Math.max(
      0,
      Math.min(1, p.dashCooldownTimer / Math.max(0.01, p.stats.dashCooldown)),
    ),
    comboCount: p.comboCount,
  };
}

export function buildHudSnapshot(
  world: SurvivalWorldState,
  localPlayerId: string,
): SurvivalHudSnapshot {
  const local =
    world.players.find((p) => p.id === localPlayerId) ?? world.players[0];
  const teammates = world.players
    .filter((p) => p.id !== local.id)
    .map(toPlayerSummary);

  let totalKills = 0;
  let humanCount = 0;
  let pickedCount = 0;
  for (let i = 0; i < world.players.length; i++) {
    const p = world.players[i];
    totalKills += p.kills;
    if (!p.isBot && !p.botTakeover) {
      humanCount += 1;
      if (world.pickedPlayerIds.includes(p.id)) {
        pickedCount += 1;
      }
    }
  }

  const bossEntity =
    world.activeBossId !== null
      ? world.enemies.find((e) => e.id === world.activeBossId && e.hp > 0) ?? null
      : null;

  return {
    phase: world.phase,
    mode: world.mode,
    mapId: world.mapId,
    isEndlessActive: world.isEndlessActive,
    elapsedSec: world.elapsedSec,
    score: Math.round(world.score),
    teamLevel: world.teamLevel,
    teamXp: world.teamXp,
    xpToNext: world.xpToNext,
    totalKills,
    bossesSlain: world.bossesSlain,
    nextBossInSec:
      world.activeBossId !== null
        ? 0
        : Math.max(0, world.nextBossAtSec - world.elapsedSec),
    bossWarningSec: world.bossWarningSec,
    bossWarningName: world.bossWarningKind
      ? BOSS_NAMES[world.bossWarningKind]
      : null,
    activeBoss: bossEntity
      ? {
          name: BOSS_NAMES[bossEntity.kind as BossKind],
          hp: Math.max(0, Math.ceil(bossEntity.hp)),
          maxHp: bossEntity.maxHp,
          tier: bossEntity.bossTier,
          isFinalBoss:
            !world.isEndlessActive &&
            bossEntity.kind === getSurvivalMapMeta(world.mapId).finalBossKind,
        }
      : null,
    sandstormActive:
      world.mapId === 'candy_canyon' && world.sandstormActiveTimer > 0,
    localPlayer: toPlayerSummary(local),
    teammates,
    pendingOffers: world.pendingOffersByPlayer[local.id] ?? [],
    hasLocalPicked: world.pickedPlayerIds.includes(local.id),
    pickedCount,
    humanCount,
    levelUpTimerSec: world.levelUpTimerSec,
  };
}

export function buildMatchSummary(
  world: SurvivalWorldState,
): SurvivalMatchSummary {
  const totalKills = world.players.reduce((sum, p) => sum + p.kills, 0);
  const campaignVictory =
    world.phase === 'victory' ||
    (!getSurvivalMapMeta(world.mapId).isEndless && world.isEndlessActive);

  return {
    matchId: world.matchId,
    mapId: world.mapId,
    mode: world.mode,
    victory: campaignVictory,
    isEndless: world.isEndlessActive,
    elapsedSec: world.elapsedSec,
    teamLevel: world.teamLevel,
    score: Math.round(world.score),
    totalKills,
    bossesSlain: world.bossesSlain,
    players: world.players.map(toPlayerSummary),
  };
}
