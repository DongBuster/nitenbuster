import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpatialGrid } from '../spatialGrid.ts';
import { computeBotInput, pickBotSkillIndex } from '../botBrain.ts';
import { computeDerivedStats } from '../catalog.ts';
import { WORLD_SIZE } from '../maps.ts';
import type {
  EnemyEntity,
  HazardTelegraph,
  PlayerEntity,
  SkillOffer,
  SurvivalWorldState,
} from '../types.ts';

interface PointItem {
  id: string;
  x: number;
  y: number;
  tag?: string;
}

function makePlayer(overrides: Partial<PlayerEntity> = {}): PlayerEntity {
  const weaponId = overrides.weaponId ?? 'candy_smg';
  const gearId = overrides.gearId ?? 'ice_skates';
  const skills = overrides.skills ?? {};
  const stats = overrides.stats ?? computeDerivedStats(weaponId, gearId, skills);

  return {
    id: 'p1',
    name: 'Bot',
    animal: 'cat',
    weaponId,
    gearId,
    isBot: true,
    botTakeover: false,
    x: 1800,
    y: 1800,
    vx: 0,
    vy: 0,
    radius: 20,
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
    skills,
    skillPower: {},
    rerollsLeft: 2,
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
    whirlwindBladeTimer: 0,
    glacialSpearTimer: 0,
    popcornBarrageTimer: 0,
    laserTurretTimer: 0,
    vitalRegenTimer: 0,
    crystalShieldCooldown: 0,
    blizzardWardCooldown: 0,
    honeyShieldCooldown: 0,
    honeyShieldReady: false,
    teamAuraHealTimer: 0,
    teamAuraBuffTimer: 0,
    pylonBuffTimer: 0,
    comboCount: 0,
    comboTimer: 0,
    stats,
    ...overrides,
  };
}

function makeEnemy(overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  return {
    id: 'e1',
    kind: 'slime',
    isBoss: false,
    bossTier: 0,
    x: 1800,
    y: 1800,
    vx: 0,
    vy: 0,
    radius: 18,
    hp: 40,
    maxHp: 40,
    speed: 100,
    damage: 10,
    xpValue: 5,
    scoreValue: 10,
    hitFlashTimer: 0,
    slowTimer: 0,
    slowFactor: 0,
    attackCooldown: 0,
    stateTimer: 0,
    dashVx: 0,
    dashVy: 0,
    telegraphX: 0,
    telegraphY: 0,
    telegraphTimer: 0,
    telegraphRadius: 0,
    telegraphKind: 'none',
    chargeRemaining: 0,
    ...overrides,
  };
}

function makeWorld(overrides: Partial<SurvivalWorldState> = {}): SurvivalWorldState {
  return {
    matchId: 'm1',
    mode: 'bot_team',
    mapId: 'winter_cabin',
    seed: 1,
    rngState: 1,
    nextEntityId: 100,
    phase: 'playing',
    elapsedSec: 10,
    isEndlessActive: false,
    score: 0,
    teamLevel: 1,
    teamXp: 0,
    xpToNext: 101,
    pendingOffersByPlayer: {},
    pickedPlayerIds: [],
    levelUpTimerSec: 0,
    levelUpGuaranteeRare: false,
    activeLevelUpGuaranteeRare: false,
    bossScheduleIndex: 0,
    nextBossAtSec: 120,
    bossWarningSec: 0,
    bossWarningKind: null,
    activeBossId: null,
    bossesSlain: 0,
    sandstormTimer: 75,
    sandstormActiveTimer: 0,
    sandstormDirX: 1,
    sandstormDirY: 0,
    spawnTimer: 1,
    crateSpawnTimer: 10,
    obstacles: [],
    zones: [],
    players: [],
    enemies: [],
    projectiles: [],
    xpGems: [],
    crates: [],
    pickups: [],
    hazards: [],
    floatingTexts: [],
    particles: [],
    lightningArcs: [],
    visualEffects: [],
    ...overrides,
  };
}

describe('SpatialGrid', () => {
  it('queryRadius finds items across cell boundaries and respects radius & out buffer', () => {
    const grid = new SpatialGrid<PointItem>(160);
    const items: PointItem[] = [
      { id: 'a', x: 158, y: 159 },
      { id: 'b', x: 162, y: 161 }, // crosses 160px cell boundary from (158, 159)
      { id: 'c', x: 260, y: 160 }, // distance 100 from (160, 160)
      { id: 'd', x: 261, y: 160 }, // distance 101 from (160, 160)
    ];
    for (const item of items) {
      grid.insert(item);
    }

    const out: PointItem[] = [{ id: 'stale', x: 0, y: 0 }];
    const result = grid.queryRadius(160, 160, 100, out);
    assert.equal(result, out);
    const ids = result.map((i) => i.id).sort();
    assert.deepEqual(ids, ['a', 'b', 'c']);

    grid.clear();
    assert.deepEqual(grid.queryRadius(160, 160, 500), []);

    // Verify grid works properly on reuse after clearing bucket arrays in-place
    grid.insert({ id: 'reused', x: 160, y: 160 });
    const reused = grid.queryRadius(160, 160, 10);
    assert.deepEqual(reused.map((r) => r.id), ['reused']);
  });

  it('findNearest returns closest matching item across cell boundaries and applies filter', () => {
    const grid = new SpatialGrid<PointItem>(160);
    grid.insert({ id: 'skip', x: 161, y: 160, tag: 'blocked' });
    grid.insert({ id: 'far', x: 319, y: 160, tag: 'ok' });
    grid.insert({ id: 'near_cross_cell', x: 155, y: 160, tag: 'ok' });

    const nearestAny = grid.findNearest(162, 160, 200);
    assert.equal(nearestAny?.id, 'skip');

    const nearestFiltered = grid.findNearest(
      162,
      160,
      200,
      (item) => item.tag === 'ok',
    );
    assert.equal(nearestFiltered?.id, 'near_cross_cell');

    const noneInRange = grid.findNearest(162, 160, 4, (item) => item.tag === 'ok');
    assert.equal(noneInRange, null);
  });
});

describe('computeBotInput', () => {
  it('returns zero input when bot is downed', () => {
    const bot = makePlayer({ id: 'bot1', x: 500, y: 600, downed: true });
    const world = makeWorld({ players: [bot] });
    const input = computeBotInput(world, bot);
    assert.deepEqual(input, {
      moveX: 0,
      moveY: 0,
      aimX: 500,
      aimY: 600,
      manualAim: false,
      dashPressed: false,
    });
  });

  it('evades imminent circle and line hazards and dashes when telegraph nearly expires', () => {
    const bot = makePlayer({ id: 'bot1', x: 1800, y: 1800, dashCooldownTimer: 0 });
    const circleHazard: HazardTelegraph = {
      id: 'h1',
      x: 1780,
      y: 1800,
      radius: 90,
      shape: 'circle',
      elapsed: 0.7,
      duration: 1.0, // remaining 0.30 <= 0.35
      damage: 30,
      fromEnemy: true,
      color: '#ff0000',
      resolved: false,
    };
    const worldCircle = makeWorld({ players: [bot], hazards: [circleHazard] });
    const evadeCircle = computeBotInput(worldCircle, bot);
    assert.ok(evadeCircle.moveX > 0.5, `expected moveX > 0.5 away from hazard, got ${evadeCircle.moveX}`);
    assert.equal(evadeCircle.dashPressed, true);
    assert.equal(evadeCircle.manualAim, false);
    assert.ok(Math.hypot(evadeCircle.moveX, evadeCircle.moveY) <= 1.0001);

    const lineHazard: HazardTelegraph = {
      id: 'h2',
      x: 1600,
      y: 1790,
      endX: 2000,
      endY: 1790,
      radius: 30,
      shape: 'line',
      elapsed: 0.2,
      duration: 1.0, // remaining 0.80 > 0.35 -> no dash
      damage: 25,
      fromEnemy: true,
      color: '#ff0000',
      resolved: false,
    };
    const worldLine = makeWorld({ players: [bot], hazards: [lineHazard] });
    const evadeLine = computeBotInput(worldLine, bot);
    assert.ok(evadeLine.moveY > 0.5, `expected moveY > 0.5 away from line hazard, got ${evadeLine.moveY}`);
    assert.equal(evadeLine.dashPressed, false);
  });

  it('steers toward downed teammate within 1100px and prefers downed human over downed bot', () => {
    const bot = makePlayer({ id: 'bot1', x: 1800, y: 1800 });
    const downedOtherBot = makePlayer({
      id: 'bot2',
      isBot: true,
      x: 1950,
      y: 1800,
      downed: true,
    });
    const downedHuman = makePlayer({
      id: 'human',
      isBot: false,
      x: 1800,
      y: 2250,
      downed: true,
    });

    const world = makeWorld({
      players: [bot, downedOtherBot, downedHuman],
    });
    const input = computeBotInput(world, bot);
    assert.ok(input.moveY > 0.8, `expected bot to steer +Y toward downed human, got moveY=${input.moveY}`);
    assert.ok(Math.abs(input.moveX) < 0.25);
  });

  it('kites nearby enemies and triggers dash when cornered or low HP', () => {
    const bot = makePlayer({
      id: 'bot1',
      x: 1800,
      y: 1800,
      hp: 40,
      maxHp: 120, // < 45%
      dashCooldownTimer: 0,
    });
    const enemy = makeEnemy({ id: 'e1', x: 1745, y: 1800 });
    const world = makeWorld({ players: [bot], enemies: [enemy] });

    const input = computeBotInput(world, bot);
    assert.ok(input.moveX > 0.5, `expected kiting away +X, got ${input.moveX}`);
    assert.equal(input.dashPressed, true);
  });

  it('seeks heal pickup when wounded, avoids obstacles, and stays inside bounds', () => {
    const bot = makePlayer({
      id: 'bot1',
      x: WORLD_SIZE - 40,
      y: 1800,
      hp: 60,
      maxHp: 120,
    });
    const worldBounds = makeWorld({ players: [bot] });
    const boundsInput = computeBotInput(worldBounds, bot);
    assert.ok(boundsInput.moveX < -0.5, `expected push inward from right edge, got ${boundsInput.moveX}`);

    const healBot = makePlayer({
      id: 'bot2',
      x: 1800,
      y: 1800,
      hp: 60,
      maxHp: 120,
    });
    const worldHeal = makeWorld({
      players: [healBot],
      pickups: [{ id: 'pk1', x: 1800, y: 1500, kind: 'heal', ttl: 15 }],
    });
    const healInput = computeBotInput(worldHeal, healBot);
    assert.ok(healInput.moveY < -0.6, `expected bot to move toward heal pickup, got ${healInput.moveY}`);

    const obstacleWorld = makeWorld({
      players: [
        makePlayer({ id: 'bot3', x: 1800, y: 1800 }),
        makePlayer({ id: 'human', isBot: false, x: 2500, y: 1800 }),
      ],
      obstacles: [{ id: 'obs1', x: 1852, y: 1800, radius: 24, kind: 'rock' }],
    });
    const slideInput = computeBotInput(obstacleWorld, obstacleWorld.players[0]);
    assert.ok(
      Math.abs(slideInput.moveY) > 0.2,
      `expected tangential obstacle slide in Y, got moveY=${slideInput.moveY}`,
    );
    assert.ok(Math.hypot(slideInput.moveX, slideInput.moveY) <= 1.0001);
  });

  it('evades incoming enemy projectiles within 140px and ignores receding projectiles', () => {
    const bot = makePlayer({ id: 'bot1', x: 1800, y: 1800, dashCooldownTimer: 0 });
    const incomingWorld = makeWorld({
      players: [bot],
      projectiles: [
        {
          id: 'ep_in',
          ownerId: 'owl1',
          fromEnemy: true,
          weaponId: 'enemy_orb',
          x: 1740,
          y: 1800,
          vx: 270,
          vy: 0,
          startX: 1600,
          startY: 1800,
          radius: 8,
          damage: 14,
          isCrit: false,
          pierceLeft: 1,
          ricochetLeft: 0,
          maxRange: 520,
          traveled: 140,
          ttl: 1.5,
          knockback: 0,
          aoeRadius: 0,
          slowPct: 0,
          slowDurationSec: 0,
          boomerang: false,
          returning: false,
          hitIds: [],
          color: '#fb7185',
        },
      ],
    });
    const evadeInput = computeBotInput(incomingWorld, bot);
    assert.ok(
      Math.abs(evadeInput.moveY) > 0.7,
      `expected perpendicular evasion along Y, got moveY=${evadeInput.moveY}`,
    );
    assert.equal(evadeInput.dashPressed, true, 'close lethal projectile should trigger dash');

    const recedingWorld = makeWorld({
      players: [bot],
      projectiles: [
        {
          ...incomingWorld.projectiles[0],
          id: 'ep_out',
          x: 1700,
          vx: -270,
        },
      ],
    });
    const recedingInput = computeBotInput(recedingWorld, bot);
    assert.equal(recedingInput.moveX, 0);
    assert.equal(recedingInput.moveY, 0);
    assert.equal(recedingInput.dashPressed, false);
  });
});

describe('pickBotSkillIndex', () => {
  it('handles empty/single offers and prefers higher rarity at full HP', () => {
    const bot = makePlayer({ hp: 120, maxHp: 120 });
    assert.equal(pickBotSkillIndex(bot, []), 0);

    const single: SkillOffer[] = [
      { skillId: 'agility', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
    ];
    assert.equal(pickBotSkillIndex(bot, single), 0);

    const offers: SkillOffer[] = [
      { skillId: 'agility', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
      { skillId: 'damage_up', rarity: 'epic', currentLevel: 0, nextLevel: 2, levelGain: 2 },
      { skillId: 'magnet_range', rarity: 'rare', currentLevel: 0, nextLevel: 1, levelGain: 1 },
    ];
    assert.equal(pickBotSkillIndex(bot, offers), 1);

    const secondaryUnlockOffers: SkillOffer[] = [
      { skillId: 'agility', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
      { skillId: 'orbital_ice', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
      { skillId: 'magnet_range', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
    ];
    assert.equal(pickBotSkillIndex(bot, secondaryUnlockOffers), 1);
  });

  it('prefers survival healing skills (max_hp / vampirism) when HP is below 65%', () => {
    const lowHpBot = makePlayer({ hp: 50, maxHp: 120 });
    const offers: SkillOffer[] = [
      { skillId: 'agility', rarity: 'rare', currentLevel: 0, nextLevel: 1, levelGain: 1 },
      { skillId: 'max_hp', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
      { skillId: 'magnet_range', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
    ];
    assert.equal(pickBotSkillIndex(lowHpBot, offers), 1);

    const vampOffers: SkillOffer[] = [
      { skillId: 'magnet_range', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
      { skillId: 'vampirism', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
      { skillId: 'agility', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
    ];
    assert.equal(pickBotSkillIndex(lowHpBot, vampOffers), 1);

    const regenOffers: SkillOffer[] = [
      { skillId: 'agility', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
      { skillId: 'vital_regen', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
      { skillId: 'magnet_range', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
    ];
    assert.equal(pickBotSkillIndex(lowHpBot, regenOffers), 1);

    const newSecondaryOffers: SkillOffer[] = [
      { skillId: 'agility', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
      { skillId: 'whirlwind_blade', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
      { skillId: 'prism_focus', rarity: 'common', currentLevel: 0, nextLevel: 1, levelGain: 1 },
    ];
    assert.equal(pickBotSkillIndex(makePlayer({ hp: 120, maxHp: 120 }), newSecondaryOffers), 1);
  });
});
