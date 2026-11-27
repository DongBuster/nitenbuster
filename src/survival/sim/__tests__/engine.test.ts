import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySkillPick,
  buildHudSnapshot,
  buildMatchSummary,
  continueEndlessMode,
  createSurvivalWorld,
  rerollSkillOffers,
  stepSurvivalWorld,
} from '../engine.ts';
import {
  MAX_REROLLS_PER_MATCH,
  SKILLS,
  computeDerivedStats,
  getWeaponSpec,
  xpForNextLevel,
} from '../catalog.ts';
import { WORLD_SIZE } from '../maps.ts';
import type {
  EnemyEntity,
  SurvivalInput,
  SurvivalWorldState,
} from '../types.ts';

const IDLE_INPUT: SurvivalInput = {
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  manualAim: false,
  dashPressed: false,
};

function makeEnemy(
  world: SurvivalWorldState,
  overrides: Partial<EnemyEntity> = {},
): EnemyEntity {
  const id = `test_enemy_${world.nextEntityId++}`;
  return {
    id,
    kind: 'slime',
    isBoss: false,
    bossTier: 0,
    x: 1800,
    y: 1800,
    vx: 0,
    vy: 0,
    radius: 17,
    hp: 100,
    maxHp: 100,
    speed: 0,
    damage: 10,
    xpValue: 10,
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

describe('survival simulation engine', () => {
  it('initializes world deterministically with spawn points, derived stats, and 8 safe crates', () => {
    const cfg = {
      matchId: 'match-init-1',
      mode: 'solo' as const,
      mapId: 'winter_cabin' as const,
      seed: 12345,
      players: [
        {
          id: 'p1',
          name: 'Mochi',
          animal: 'cat' as const,
          weaponId: 'candy_smg' as const,
          gearId: 'plush_armor' as const,
          isBot: false,
        },
      ],
    };

    const worldA = createSurvivalWorld(cfg);
    const worldB = createSurvivalWorld(cfg);
    assert.deepEqual(worldA, worldB);

    assert.equal(worldA.phase, 'playing');
    assert.equal(worldA.isEndlessActive, false);
    assert.equal(worldA.teamLevel, 1);
    assert.equal(worldA.teamXp, 0);
    assert.equal(worldA.xpToNext, xpForNextLevel(1));
    assert.equal(worldA.nextBossAtSec, 90);
    assert.equal(worldA.players.length, 1);
    assert.equal(worldA.players[0].hp, 155); // 120 + 35 plush_armor
    assert.equal(worldA.players[0].maxHp, 155);
    assert.equal(worldA.players[0].rerollsLeft, MAX_REROLLS_PER_MATCH);
    assert.equal(worldA.crates.length, 8);

    for (const crate of worldA.crates) {
      const distCenter = Math.hypot(crate.x - WORLD_SIZE / 2, crate.y - WORLD_SIZE / 2);
      assert.ok(distCenter >= 260, 'crate should stay outside spawn center clearance');
      for (const obs of worldA.obstacles) {
        const d = Math.hypot(crate.x - obs.x, crate.y - obs.y);
        assert.ok(d >= obs.radius + crate.radius, 'crate should not overlap obstacle');
      }
    }
  });

  it('clamps player inside WORLD_SIZE bounds and slides cleanly around obstacles', () => {
    const world = createSurvivalWorld({
      matchId: 'm-bounds',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 42,
      players: [
        {
          id: 'p1',
          name: 'P1',
          animal: 'dog',
          weaponId: 'candy_smg',
          gearId: 'ice_skates',
          isBot: false,
        },
      ],
    });
    const p1 = world.players[0];
    p1.x = WORLD_SIZE - 10;
    p1.y = 20;
    world.obstacles = [{ id: 'obs_test', x: 1800, y: 1800, radius: 50, kind: 'rock' }];
    world.crates = [];

    stepSurvivalWorld(
      world,
      { p1: { ...IDLE_INPUT, moveX: 1, moveY: -1 } },
      0.05,
    );
    assert.ok(p1.x <= WORLD_SIZE - p1.radius - 16 + 0.001);
    assert.ok(p1.y >= p1.radius + 16 - 0.001);

    // Move diagonally into an obstacle directly east of player -> must stay outside & slide in Y
    p1.x = 1730;
    p1.y = 1800;
    for (let i = 0; i < 15; i++) {
      stepSurvivalWorld(
        world,
        { p1: { ...IDLE_INPUT, moveX: 1, moveY: 0.4 } },
        0.04,
      );
      const dist = Math.hypot(p1.x - 1800, p1.y - 1800);
      assert.ok(dist >= p1.radius + 50 - 0.01, `player overlapped obstacle: dist=${dist}`);
    }
    assert.ok(p1.y > 1810, 'player should slide tangentially around obstacle');
  });

  it('executes dash burst (~220px) with i-frames blocking enemy contact damage', () => {
    const world = createSurvivalWorld({
      matchId: 'm-dash',
      mode: 'solo',
      mapId: 'candy_canyon',
      seed: 7,
      players: [
        {
          id: 'p1',
          name: 'Dasher',
          animal: 'bunny',
          weaponId: 'candy_smg',
          gearId: 'ice_skates',
          isBot: false,
        },
      ],
    });
    world.obstacles = [];
    world.crates = [];
    const p1 = world.players[0];
    p1.x = 1600;
    p1.y = 1800;
    const startHp = p1.hp;

    // Place a deadly enemy directly along the dash path
    world.enemies.push(
      makeEnemy(world, { x: 1700, y: 1800, radius: 22, damage: 40, speed: 0 }),
    );

    const events = stepSurvivalWorld(
      world,
      { p1: { ...IDLE_INPUT, moveX: 1, moveY: 0, dashPressed: true } },
      0.04,
    );
    assert.ok(events.some((e) => e.type === 'dash'));
    assert.ok(p1.invulnTimer > 0.15);
    assert.ok(p1.dashCooldownTimer > 0);

    // Finish the 0.18s dash (another 0.14s across 4 steps)
    for (let i = 0; i < 4; i++) {
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.04);
    }
    const traveled = p1.x - 1600;
    assert.ok(traveled >= 210 && traveled <= 235, `expected ~220px dash, got ${traveled}`);
    assert.equal(p1.hp, startHp, 'dash i-frames should prevent enemy contact damage');

    // Without i-frames, overlapping enemy damages player
    p1.invulnTimer = 0;
    p1.x = 1700;
    p1.y = 1800;
    stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.02);
    assert.ok(p1.hp < startHp, 'contact without i-frames should deal damage');
  });

  it('auto-aims at nearest enemy in range and respects manualAim cursor override', () => {
    const world = createSurvivalWorld({
      matchId: 'm-aim',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 11,
      players: [
        {
          id: 'p1',
          name: 'Archer',
          animal: 'cat',
          weaponId: 'frost_bow', // spreadDeg: 0 -> exact angle
          gearId: 'golden_scope',
          isBot: false,
        },
      ],
    });
    world.obstacles = [];
    world.crates = [];
    const p1 = world.players[0];
    p1.x = 1800;
    p1.y = 1800;

    // Far enemy north, near enemy east
    world.enemies.push(makeEnemy(world, { x: 1800, y: 1400 }));
    world.enemies.push(makeEnemy(world, { x: 1960, y: 1800 }));

    const evAuto = stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.02);
    assert.ok(evAuto.some((e) => e.type === 'shoot'));
    assert.ok(Math.abs(p1.aimAngle) < 0.05, 'auto-aim should lock onto east enemy');
    assert.ok(world.projectiles[0].vx > 700);

    // Clear cooldown and shoot manually south
    world.projectiles = [];
    p1.fireCooldown = 0;
    const evManual = stepSurvivalWorld(
      world,
      {
        p1: {
          ...IDLE_INPUT,
          manualAim: true,
          aimX: 1800,
          aimY: 2200,
        },
      },
      0.02,
    );
    assert.ok(evManual.some((e) => e.type === 'shoot'));
    assert.ok(Math.abs(p1.aimAngle - Math.PI / 2) < 0.05);
    assert.ok(world.projectiles[0].vy > 700);
  });

  it('supports all 6 weapons: SMG, Shotgun knockback, Frost Bow slow, Chain Lightning, Launcher AoE, Boomerang return', () => {
    // 1. candy_smg & chestnut_shotgun
    const wShotgun = createSurvivalWorld({
      matchId: 'm-w-shotgun',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 1,
      players: [
        { id: 'p1', name: 'S', animal: 'dog', weaponId: 'chestnut_shotgun', gearId: 'ice_skates', isBot: false },
      ],
    });
    wShotgun.obstacles = [];
    wShotgun.crates = [];
    const eShot = makeEnemy(wShotgun, { x: wShotgun.players[0].x + 90, y: wShotgun.players[0].y, hp: 500, maxHp: 500 });
    wShotgun.enemies.push(eShot);
    stepSurvivalWorld(wShotgun, { p1: IDLE_INPUT }, 0.02);
    assert.equal(wShotgun.projectiles.length, 5, 'shotgun fires 5 pellets');
    for (let i = 0; i < 6; i++) stepSurvivalWorld(wShotgun, { p1: IDLE_INPUT }, 0.02);
    assert.ok(eShot.hp < 500, 'shotgun pellets deal damage');
    assert.ok(eShot.x > wShotgun.players[0].x + 95, 'shotgun applies knockback');

    // 2. candy_smg fires rapidly
    const wSmg = createSurvivalWorld({
      matchId: 'm-w-smg',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 2,
      players: [
        { id: 'p1', name: 'Smg', animal: 'cat', weaponId: 'candy_smg', gearId: 'ice_skates', isBot: false },
      ],
    });
    wSmg.obstacles = [];
    wSmg.crates = [];
    const eSmg = makeEnemy(wSmg, { x: wSmg.players[0].x + 120, y: wSmg.players[0].y, hp: 300, maxHp: 300 });
    wSmg.enemies.push(eSmg);
    for (let i = 0; i < 20; i++) stepSurvivalWorld(wSmg, { p1: IDLE_INPUT }, 0.02);
    assert.ok(eSmg.hp < 300, 'candy_smg hits target');

    // 3. frost_bow pierces & slows
    const wBow = createSurvivalWorld({
      matchId: 'm-w-bow',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 3,
      players: [
        { id: 'p1', name: 'Bow', animal: 'duck', weaponId: 'frost_bow', gearId: 'ice_skates', isBot: false },
      ],
    });
    wBow.obstacles = [];
    wBow.crates = [];
    const bowP = wBow.players[0];
    const eBow1 = makeEnemy(wBow, { x: bowP.x + 80, y: bowP.y, hp: 200, maxHp: 200 });
    const eBow2 = makeEnemy(wBow, { x: bowP.x + 150, y: bowP.y, hp: 200, maxHp: 200 });
    wBow.enemies.push(eBow1, eBow2);
    for (let i = 0; i < 12; i++) stepSurvivalWorld(wBow, { p1: IDLE_INPUT }, 0.02);
    assert.ok(eBow1.hp < 200 && eBow2.hp < 200, 'frost_bow pierces through multiple enemies');
    assert.ok(eBow1.slowTimer > 0 && Math.abs(eBow1.slowFactor - 0.3) < 0.01);

    // 4. lightning_staff instant chain lightning & LightningArcFx
    const wStaff = createSurvivalWorld({
      matchId: 'm-w-staff',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 4,
      players: [
        { id: 'p1', name: 'Mage', animal: 'panda', weaponId: 'lightning_staff', gearId: 'ice_skates', isBot: false },
      ],
    });
    wStaff.obstacles = [];
    wStaff.crates = [];
    const sp = wStaff.players[0];
    const chain1 = makeEnemy(wStaff, { x: sp.x + 100, y: sp.y, hp: 200, maxHp: 200 });
    const chain2 = makeEnemy(wStaff, { x: sp.x + 200, y: sp.y, hp: 200, maxHp: 200 });
    const chain3 = makeEnemy(wStaff, { x: sp.x + 300, y: sp.y, hp: 200, maxHp: 200 });
    wStaff.enemies.push(chain1, chain2, chain3);
    stepSurvivalWorld(wStaff, { p1: IDLE_INPUT }, 0.02);
    assert.equal(wStaff.lightningArcs.length, 1);
    assert.equal(wStaff.lightningArcs[0].points.length, 4);
    assert.ok(chain1.hp < 200 && chain2.hp < 200 && chain3.hp < 200);
    assert.ok(chain2.hp > chain1.hp, 'chain damage decays 15% per hop');

    // 5. candy_launcher AoE explosion
    const wLauncher = createSurvivalWorld({
      matchId: 'm-w-launcher',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 5,
      players: [
        { id: 'p1', name: 'Boom', animal: 'shark', weaponId: 'candy_launcher', gearId: 'ice_skates', isBot: false },
      ],
    });
    wLauncher.obstacles = [];
    wLauncher.crates = [];
    const lp = wLauncher.players[0];
    const centerEnemy = makeEnemy(wLauncher, { x: lp.x + 140, y: lp.y, hp: 200, maxHp: 200 });
    const splashEnemy = makeEnemy(wLauncher, { x: lp.x + 140, y: lp.y + 70, hp: 200, maxHp: 200 });
    wLauncher.enemies.push(centerEnemy, splashEnemy);
    for (let i = 0; i < 18; i++) stepSurvivalWorld(wLauncher, { p1: IDLE_INPUT }, 0.02);
    assert.ok(centerEnemy.hp < 200);
    assert.ok(splashEnemy.hp < 200, 'launcher AoE damages nearby clustered enemy');

    // 6. snow_boomerang hits going out AND coming back
    const wBoomer = createSurvivalWorld({
      matchId: 'm-w-boomer',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 6,
      players: [
        { id: 'p1', name: 'Boomer', animal: 'dino', weaponId: 'snow_boomerang', gearId: 'ice_skates', isBot: false },
      ],
    });
    wBoomer.obstacles = [];
    wBoomer.crates = [];
    const bp = wBoomer.players[0];
    bp.skills = { fire_rate: 0 };
    const eBoomer = makeEnemy(wBoomer, { x: bp.x + 220, y: bp.y, hp: 300, maxHp: 300 });
    wBoomer.enemies.push(eBoomer);
    // Fire once then prevent a second shot via manualAim away or big cooldown
    stepSurvivalWorld(wBoomer, { p1: IDLE_INPUT }, 0.02);
    bp.fireCooldown = 99;
    let sawReturning = false;
    for (let i = 0; i < 80; i++) {
      stepSurvivalWorld(wBoomer, { p1: IDLE_INPUT }, 0.02);
      if (wBoomer.projectiles.some((pr) => pr.returning)) {
        sawReturning = true;
      }
    }
    assert.equal(sawReturning, true, 'boomerang should enter returning phase');
    assert.equal(eBoomer.hp, 240, 'boomerang (30 dmg) should hit once outbound and once returning');
    assert.equal(wBoomer.projectiles.length, 0, 'boomerang despawns after returning to owner');
  });

  it('activates secondary auto-weapons (orbital_ice, warm_aura, candy_meteor, plush_drone), team_aura & vampirism', () => {
    const world = createSurvivalWorld({
      matchId: 'm-sec',
      mode: 'bot_team',
      mapId: 'winter_cabin',
      seed: 19,
      players: [
        { id: 'p1', name: 'Sec', animal: 'chicken', weaponId: 'candy_smg', gearId: 'ice_skates', isBot: false },
        { id: 'p2', name: 'Mate', animal: 'panda', weaponId: 'candy_smg', gearId: 'plush_armor', isBot: false },
      ],
    });
    world.obstacles = [];
    world.crates = [];
    const [p1, p2] = world.players;
    p1.fireCooldown = 999; // isolate secondary weapons
    p2.fireCooldown = 999;
    p2.x = p1.x - 100; // stay safely within TEAM_AURA_RADIUS (220px) away from enemies on +X
    p2.y = p1.y;
    p1.skills = {
      orbital_ice: 2,
      warm_aura: 2,
      candy_meteor: 2,
      plush_drone: 2,
      vampirism: 2,
      team_aura: 2,
    };
    p1.stats = {
      ...p1.stats,
      orbitalLevel: 2,
      warmAuraLevel: 2,
      meteorLevel: 2,
      droneLevel: 2,
      vampirismLevel: 2,
      teamAuraLevel: 2,
    };
    p1.hp = 60;
    p2.hp = 60;
    p1.vampirismKillCounter = 11;

    // Enemy inside warm_aura & orbital_ice orbit (82px), plus 1 low-HP slime to trigger 12th vampirism kill
    const eNear = makeEnemy(world, { x: p1.x + 82, y: p1.y, hp: 500, maxHp: 500 });
    const eWeak = makeEnemy(world, { x: p1.x + 30, y: p1.y, hp: 5, maxHp: 5 });
    // Enemy at 260px for plush_drone & candy_meteor
    const eFar = makeEnemy(world, { x: p1.x + 260, y: p1.y, hp: 500, maxHp: 500 });
    world.enemies.push(eNear, eWeak, eFar);

    for (let i = 0; i < 60; i++) {
      stepSurvivalWorld(world, { p1: IDLE_INPUT, p2: IDLE_INPUT }, 0.02);
      p1.fireCooldown = 999;
      p2.fireCooldown = 999;
    }
    assert.ok(eNear.hp < 500, 'warm_aura and orbital_ice damage close enemy');
    assert.ok(eFar.hp < 500, 'plush_drone / candy_meteor damage ranged enemy');
    assert.ok(p1.damageDealt > 0);
    // team_aura healed p2 (4 HP over 1.2s) and vampirism + team_aura healed p1 (8 + 4 = 12 HP)
    assert.ok(p2.hp > 60, `team_aura should heal teammate, got hp=${p2.hp}`);
    assert.ok(p1.hp >= 70, `vampirism + team_aura should heal p1, got hp=${p1.hp}`);
  });

  it('orbital_ice deals framerate-independent damage across dt=1/60 vs dt=1/120 and scales strictly across levels', () => {
    const runOrbitalTest = (level: number, stepHz: number): { dmg: number; hits: number } => {
      const w = createSurvivalWorld({
        matchId: `m-orb-${level}-${stepHz}`,
        mode: 'solo',
        mapId: 'winter_cabin',
        seed: 77,
        players: [
          { id: 'p1', name: 'Orb', animal: 'cat', weaponId: 'candy_smg', gearId: 'ice_skates', isBot: false },
        ],
      });
      w.obstacles = [];
      w.crates = [];
      w.nextBossAtSec = 9999;
      w.spawnTimer = 9999;
      const p = w.players[0];
      p.skills = { orbital_ice: level };
      p.stats = { ...p.stats, orbitalLevel: level };
      p.fireCooldown = 9999;
      const target = makeEnemy(w, {
        kind: 'golem',
        x: p.x + 82,
        y: p.y,
        radius: 28,
        hp: 1000,
        maxHp: 1000,
        speed: 0,
      });
      w.enemies.push(target);

      const dt = 1 / stepHz;
      let hits = 0;
      for (let i = 0; i < stepHz; i++) {
        p.hp = p.maxHp;
        p.invulnTimer = 1;
        p.fireCooldown = 9999;
        const ev = stepSurvivalWorld(w, { p1: IDLE_INPUT }, dt);
        hits += ev.filter((e) => e.type === 'hit').length;
      }
      return { dmg: 1000 - target.hp, hits };
    };

    const lv1At60 = runOrbitalTest(1, 60);
    const lv1At120 = runOrbitalTest(1, 120);
    const lv2At60 = runOrbitalTest(2, 60);

    assert.ok(lv1At60.dmg > 0);
    assert.equal(lv1At60.dmg, lv1At120.dmg, 'orbital_ice damage must match between 60Hz and 120Hz');
    assert.equal(lv1At60.hits, lv1At120.hits, 'orbital_ice hit count must match between 60Hz and 120Hz');
    assert.ok(lv1At60.hits <= 5, `orbital_ice should gate hits cleanly, got ${lv1At60.hits}`);
    assert.ok(lv2At60.dmg > lv1At60.dmg, `Lv.2 (${lv2At60.dmg}) must deal strictly more damage than Lv.1 (${lv1At60.dmg})`);
  });

  it('drops XP gems, magnetizes, triggers levelup, applies skill picks & rerolls, and respects online_coop timeout', () => {
    const world = createSurvivalWorld({
      matchId: 'm-xp',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 25,
      players: [
        { id: 'p1', name: 'Hero', animal: 'cat', weaponId: 'candy_smg', gearId: 'crystal_magnet', isBot: false },
      ],
    });
    world.obstacles = [];
    world.crates = [];
    const p1 = world.players[0];

    // Enemy right next to player with low HP -> dies quickly and drops high-XP gem
    const elite = makeEnemy(world, {
      kind: 'golem',
      x: p1.x + 70,
      y: p1.y,
      hp: 10,
      maxHp: 10,
      xpValue: 120,
    });
    world.enemies.push(elite);

    let gotLevelUp = false;
    for (let i = 0; i < 30; i++) {
      const ev = stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.03);
      if (ev.some((e) => e.type === 'level_up')) {
        gotLevelUp = true;
        break;
      }
    }
    assert.equal(gotLevelUp, true, 'collecting XP should trigger level_up');
    assert.equal(world.phase, 'levelup');
    assert.equal(world.pendingOffersByPlayer.p1.length, 3);

    // Reroll once
    assert.equal(rerollSkillOffers(world, 'p1'), true);
    assert.equal(p1.rerollsLeft, 1);
    assert.equal(world.pendingOffersByPlayer.p1.length, 3);
    assert.equal(rerollSkillOffers(world, 'p1'), true);
    assert.equal(p1.rerollsLeft, 0);
    assert.equal(rerollSkillOffers(world, 'p1'), false, 'cannot reroll after charges exhausted');

    // In solo mode, levelup waits calmly even if stepped for 25s
    for (let i = 0; i < 500; i++) {
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
    }
    assert.equal(world.phase, 'levelup', 'solo levelup must not auto-timeout');

    // Reject non-integer offer indices cleanly
    assert.equal(applySkillPick(world, 'p1', 1.5), false);
    assert.equal(applySkillPick(world, 'p1', Number.NaN), false);
    assert.equal(world.phase, 'levelup');

    // Pick skill 0 -> resumes playing
    const pickedOffer = world.pendingOffersByPlayer.p1[0];
    assert.equal(applySkillPick(world, 'p1', 0), true);
    assert.equal(world.phase, 'playing');
    assert.equal(p1.skills[pickedOffer.skillId], pickedOffer.nextLevel);
    assert.equal(applySkillPick(world, 'p1', 0), false, 'cannot pick outside levelup');

    // Online coop mode auto-picks after 15s timeout
    const coopWorld = createSurvivalWorld({
      matchId: 'm-coop-xp',
      mode: 'online_coop',
      mapId: 'winter_cabin',
      seed: 33,
      players: [
        { id: 'h1', name: 'H1', animal: 'cat', weaponId: 'candy_smg', gearId: 'ice_skates', isBot: false },
        { id: 'h2', name: 'H2', animal: 'dog', weaponId: 'frost_bow', gearId: 'plush_armor', isBot: false },
      ],
    });
    coopWorld.xpGems.push({
      id: 'g_big',
      x: coopWorld.players[0].x,
      y: coopWorld.players[0].y,
      value: 150,
      tier: 'gold',
      magnetizedBy: 'h1',
    });
    stepSurvivalWorld(coopWorld, {}, 0.05);
    assert.equal(coopWorld.phase, 'levelup');
    for (let i = 0; i < 310; i++) {
      stepSurvivalWorld(coopWorld, {}, 0.05);
      if (buildHudSnapshot(coopWorld, 'h1').phase === 'playing') break;
    }
    assert.equal(buildHudSnapshot(coopWorld, 'h1').phase, 'playing', 'online_coop levelup should auto-pick after 15s');
  });

  it('supports team 3s revive and transitions to gameover when all players are downed', () => {
    const world = createSurvivalWorld({
      matchId: 'm-revive',
      mode: 'bot_team',
      mapId: 'winter_cabin',
      seed: 99,
      players: [
        { id: 'p1', name: 'H1', animal: 'cat', weaponId: 'candy_smg', gearId: 'ice_skates', isBot: false },
        { id: 'p2', name: 'H2', animal: 'dog', weaponId: 'frost_bow', gearId: 'plush_armor', isBot: false },
      ],
    });
    world.obstacles = [];
    world.crates = [];
    const [p1, p2] = world.players;
    p1.downed = true;
    p1.hp = 0;
    p2.x = p1.x + 40;
    p2.y = p1.y;

    let revived = false;
    for (let i = 0; i < 70; i++) {
      const ev = stepSurvivalWorld(world, { p1: IDLE_INPUT, p2: IDLE_INPUT }, 0.05);
      if (ev.some((e) => e.type === 'player_revive')) {
        revived = true;
        break;
      }
    }
    assert.equal(revived, true, 'teammate standing within 85px for 3s should revive downed player');
    assert.equal(p1.downed, false);
    assert.equal(p1.hp, Math.round(p1.maxHp * 0.5));
    assert.equal(p2.revives, 1);

    // Now down both players via lethal enemy contact -> gameover
    p1.downed = true;
    p1.hp = 0;
    p2.invulnTimer = 0;
    p2.hp = 5;
    world.enemies.push(makeEnemy(world, { x: p2.x, y: p2.y, damage: 50, radius: 30 }));
    const evOver = stepSurvivalWorld(world, { p1: IDLE_INPUT, p2: IDLE_INPUT }, 0.05);
    assert.equal(world.phase, 'gameover');
    assert.ok(evOver.some((e) => e.type === 'gameover'));

    const hud = buildHudSnapshot(world, 'p1');
    assert.equal(hud.phase, 'gameover');
    assert.equal(hud.teammates.length, 1);
    const summary = buildMatchSummary(world);
    assert.equal(summary.victory, false);
    assert.equal(summary.players.length, 2);
  });

  it('prioritizes gameover over levelup when the last living player is downed on the same tick as a Boss kill / XP threshold', () => {
    const world = createSurvivalWorld({
      matchId: 'm-gameover-prio',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 108,
      players: [
        { id: 'p1', name: 'Hero', animal: 'cat', weaponId: 'lightning_staff', gearId: 'ice_skates', isBot: false },
      ],
    });
    world.obstacles = [];
    world.crates = [];
    const p1 = world.players[0];
    p1.hp = 5;
    p1.invulnTimer = 0;
    p1.fireCooldown = 0;

    // Boss at 1 HP dies instantly to lightning_staff in updatePrimaryWeapons (granting xpToNext),
    // while a lethal enemy overlaps p1 in updateEnemies on the exact same tick.
    const boss = makeEnemy(world, {
      kind: 'boss_slime_king',
      isBoss: true,
      bossTier: 1,
      x: p1.x + 80,
      y: p1.y,
      radius: 44,
      hp: 1,
      maxHp: 1400,
      speed: 0,
    });
    world.activeBossId = boss.id;
    const killerSlime = makeEnemy(world, {
      kind: 'slime',
      x: p1.x,
      y: p1.y,
      radius: 24,
      hp: 500,
      maxHp: 500,
      damage: 50,
      speed: 0,
    });
    world.enemies.push(boss, killerSlime);

    const events = stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
    assert.ok(events.some((e) => e.type === 'boss_kill'));
    assert.equal(p1.downed, true);
    assert.equal(world.phase, 'gameover', 'gameover must win over levelup when all players go down on same tick');
    assert.ok(events.some((e) => e.type === 'gameover'));
    assert.equal(events.some((e) => e.type === 'level_up'), false);
  });

  it('applies map mechanics: ice speed boost, candy_canyon sandstorm, crystal_cavern pylon, score_pad', () => {
    // winter_cabin ice zone +18% speed
    const wIce = createSurvivalWorld({
      matchId: 'm-ice',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 12,
      players: [{ id: 'p1', name: 'Ice', animal: 'cat', weaponId: 'candy_smg', gearId: 'plush_armor', isBot: false }],
    });
    wIce.obstacles = [];
    const iceZone = wIce.zones[0];
    wIce.players[0].x = iceZone.x;
    wIce.players[0].y = iceZone.y;
    stepSurvivalWorld(wIce, { p1: { ...IDLE_INPUT, moveX: 1, moveY: 0 } }, 0.05);
    const expectedIceDist = wIce.players[0].stats.moveSpeed * 1.18 * 0.05;
    assert.ok(Math.abs((wIce.players[0].x - iceZone.x) - expectedIceDist) < 0.05);

    // crystal_cavern pylon activates on player entry and gives pylonBuffTimer
    const wCrystal = createSurvivalWorld({
      matchId: 'm-crys',
      mode: 'solo',
      mapId: 'crystal_cavern',
      seed: 13,
      players: [{ id: 'p1', name: 'Cry', animal: 'cat', weaponId: 'candy_smg', gearId: 'plush_armor', isBot: false }],
    });
    wCrystal.obstacles = [];
    const pylon = wCrystal.zones[0];
    wCrystal.players[0].x = pylon.x;
    wCrystal.players[0].y = pylon.y;
    stepSurvivalWorld(wCrystal, { p1: IDLE_INPUT }, 0.05);
    assert.ok(pylon.activeTimerSec > 0);
    assert.ok(wCrystal.players[0].pylonBuffTimer > 0);
    assert.ok(pylon.cooldownSec > 20);

    // candy_canyon triggers sandstorm at 75s
    const wSand = createSurvivalWorld({
      matchId: 'm-sand',
      mode: 'solo',
      mapId: 'candy_canyon',
      seed: 14,
      players: [{ id: 'p1', name: 'Sand', animal: 'cat', weaponId: 'candy_smg', gearId: 'plush_armor', isBot: false }],
    });
    wSand.obstacles = [];
    wSand.sandstormTimer = 0.02;
    const pSand = wSand.players[0];
    const origX = pSand.x;
    const origY = pSand.y;
    stepSurvivalWorld(wSand, { p1: IDLE_INPUT }, 0.05);
    assert.ok(wSand.sandstormActiveTimer > 0);
    assert.ok(Math.hypot(pSand.x - origX, pSand.y - origY) > 1, 'sandstorm pushes stationary player');

    // endless_abyss score_pad gives +10% move speed & +15% kill score
    const wPad = createSurvivalWorld({
      matchId: 'm-pad',
      mode: 'solo',
      mapId: 'endless_abyss',
      seed: 15,
      players: [{ id: 'p1', name: 'Pad', animal: 'cat', weaponId: 'frost_bow', gearId: 'plush_armor', isBot: false }],
    });
    wPad.obstacles = [];
    wPad.crates = [];
    const padZone = wPad.zones[0];
    const pPad = wPad.players[0];
    pPad.x = padZone.x;
    pPad.y = padZone.y;
    wPad.enemies.push(makeEnemy(wPad, { x: pPad.x + 30, y: pPad.y, hp: 10, maxHp: 10, scoreValue: 100 }));
    for (let i = 0; i < 4; i++) {
      stepSurvivalWorld(wPad, { p1: { ...IDLE_INPUT, moveX: 1, moveY: 0 } }, 0.05);
    }
    const expectedPadMove = pPad.stats.moveSpeed * 1.1 * 0.2;
    assert.ok(Math.abs((pPad.x - padZone.x) - expectedPadMove) < 0.05);
    assert.equal(pPad.score, 121, '100 * 1.05 (combo=1) * 1.15 (score_pad) = 120.75 -> 121');
  });

  it('activates each of the 4 secondary weapons in isolation (orbital_ice, warm_aura, candy_meteor, plush_drone)', () => {
    const makeIsolatedWorld = (
      skillId: 'orbital_ice' | 'warm_aura' | 'candy_meteor' | 'plush_drone',
    ) => {
      const w = createSurvivalWorld({
        matchId: `m-iso-${skillId}`,
        mode: 'solo',
        mapId: 'winter_cabin',
        seed: 55,
        players: [
          { id: 'p1', name: 'Iso', animal: 'cat', weaponId: 'candy_smg', gearId: 'ice_skates', isBot: false },
        ],
      });
      w.obstacles = [];
      w.crates = [];
      w.spawnTimer = 9999;
      w.nextBossAtSec = 9999;
      const p = w.players[0];
      p.skills = { [skillId]: 2 };
      p.stats = computeDerivedStats('candy_smg', 'ice_skates', p.skills);
      p.fireCooldown = 9999;
      return { w, p };
    };

    // 1. orbital_ice alone
    {
      const { w, p } = makeIsolatedWorld('orbital_ice');
      const target = makeEnemy(w, { x: p.x + 82, y: p.y, hp: 500, maxHp: 500 });
      w.enemies.push(target);
      for (let i = 0; i < 40; i++) {
        p.fireCooldown = 9999;
        p.invulnTimer = 1;
        stepSurvivalWorld(w, { p1: IDLE_INPUT }, 0.025);
      }
      assert.ok(target.hp < 500, 'orbital_ice alone should damage orbiting target');
    }

    // 2. warm_aura alone (hits inside aura radius, ignores outside)
    {
      const { w, p } = makeIsolatedWorld('warm_aura');
      const inside = makeEnemy(w, { x: p.x + 100, y: p.y, hp: 500, maxHp: 500 });
      const outside = makeEnemy(w, { x: p.x + 260, y: p.y, hp: 500, maxHp: 500 });
      w.enemies.push(inside, outside);
      for (let i = 0; i < 25; i++) {
        p.fireCooldown = 9999;
        p.invulnTimer = 1;
        stepSurvivalWorld(w, { p1: IDLE_INPUT }, 0.04);
      }
      assert.ok(inside.hp < 500, 'warm_aura alone should burn nearby enemy');
      assert.equal(outside.hp, 500, 'warm_aura must not damage distant enemy');
    }

    // 3. candy_meteor alone
    {
      const { w, p } = makeIsolatedWorld('candy_meteor');
      const target = makeEnemy(w, { x: p.x + 280, y: p.y, hp: 500, maxHp: 500 });
      w.enemies.push(target);
      let sawMeteorHazard = false;
      for (let i = 0; i < 30; i++) {
        p.fireCooldown = 9999;
        stepSurvivalWorld(w, { p1: IDLE_INPUT }, 0.04);
        if (w.hazards.some((h) => !h.fromEnemy && h.ownerId === p.id)) {
          sawMeteorHazard = true;
        }
      }
      assert.equal(sawMeteorHazard, true, 'candy_meteor alone should spawn player meteor hazard');
      assert.ok(target.hp < 500, 'candy_meteor alone should resolve AoE damage');
    }

    // 4. plush_drone alone
    {
      const { w, p } = makeIsolatedWorld('plush_drone');
      const target = makeEnemy(w, { x: p.x + 240, y: p.y, hp: 500, maxHp: 500 });
      w.enemies.push(target);
      let sawDroneProj = false;
      for (let i = 0; i < 30; i++) {
        p.fireCooldown = 9999;
        stepSurvivalWorld(w, { p1: IDLE_INPUT }, 0.04);
        if (w.projectiles.some((pr) => pr.weaponId === 'drone')) {
          sawDroneProj = true;
        }
      }
      assert.equal(sawDroneProj, true, 'plush_drone alone should fire drone projectile');
      assert.ok(target.hp < 500, 'plush_drone alone should damage enemy');
    }
  });

  it('sanitizes NaN/Infinity rawDt and SurvivalInput without producing NaN world coordinates', () => {
    const world = createSurvivalWorld({
      matchId: 'm-sanitize',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 12,
      players: [
        { id: 'p1', name: 'Safe', animal: 'cat', weaponId: 'candy_smg', gearId: 'ice_skates', isBot: false },
      ],
    });
    world.obstacles = [];
    world.crates = [];
    const p1 = world.players[0];
    const startX = p1.x;
    const startY = p1.y;

    stepSurvivalWorld(
      world,
      {
        p1: {
          moveX: Number.NaN,
          moveY: Number.POSITIVE_INFINITY,
          aimX: Number.NaN,
          aimY: Number.NEGATIVE_INFINITY,
          manualAim: true,
          dashPressed: false,
        },
      },
      Number.NaN,
    );

    assert.equal(Number.isFinite(world.elapsedSec), true);
    assert.equal(world.elapsedSec, 0);
    assert.equal(Number.isFinite(p1.x), true);
    assert.equal(Number.isFinite(p1.y), true);
    assert.equal(Number.isFinite(p1.aimAngle), true);
    assert.equal(p1.x, startX);
    assert.equal(p1.y, startY);

    // Negative / Infinity dt and out-of-range moveX (>1) are clamped cleanly
    stepSurvivalWorld(world, { p1: { ...IDLE_INPUT, moveX: 50, moveY: 0 } }, -5);
    assert.equal(world.elapsedSec, 0);
    assert.equal(p1.x, startX);

    stepSurvivalWorld(world, { p1: { ...IDLE_INPUT, moveX: 50, moveY: 0 } }, Number.POSITIVE_INFINITY);
    assert.equal(world.elapsedSec, 0);

    stepSurvivalWorld(world, { p1: { ...IDLE_INPUT, moveX: 50, moveY: 0 } }, 2.0);
    assert.ok(Math.abs(world.elapsedSec - 0.05) < 1e-6);
    assert.ok(Math.abs(p1.x - startX - p1.stats.moveSpeed * 0.05) < 0.05);
  });

  it('mergeExcessXpGems reduces gem count locally without cross-map teleportation or merging magnetized gems', () => {
    const world = createSurvivalWorld({
      matchId: 'm-gems',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 17,
      players: [
        { id: 'p1', name: 'Gem', animal: 'cat', weaponId: 'candy_smg', gearId: 'ice_skates', isBot: false },
      ],
    });
    world.obstacles = [];
    world.crates = [];
    world.spawnTimer = 9999;
    world.players[0].x = 1800;
    world.players[0].y = 1800;

    // 90 gems clustered near west (220, 220), 90 near east (3380, 3380), plus 5 magnetized
    for (let i = 0; i < 90; i++) {
      world.xpGems.push({
        id: `west_${i}`,
        x: 220 + (i % 5) * 10,
        y: 220 + (i % 4) * 10,
        value: 10,
        tier: 'green',
        magnetizedBy: null,
      });
      world.xpGems.push({
        id: `east_${i}`,
        x: 3380 + (i % 5) * 10,
        y: 3380 + (i % 4) * 10,
        value: 10,
        tier: 'green',
        magnetizedBy: null,
      });
    }
    for (let i = 0; i < 5; i++) {
      world.xpGems.push({
        id: `mag_${i}`,
        x: 1800,
        y: 1880 + i * 20,
        value: 25,
        tier: 'blue',
        magnetizedBy: 'p1',
      });
    }

    const totalXpBefore = world.xpGems.reduce((sum, g) => sum + g.value, 0);
    // Step with dt=0 so magnetized gems aren't collected while mergeExcessXpGems runs
    stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0);

    assert.ok(world.xpGems.length <= 160, `expected <= 160 gems after merge, got ${world.xpGems.length}`);
    const totalXpAfter = world.xpGems.reduce((sum, g) => sum + g.value, 0);
    assert.equal(totalXpAfter, totalXpBefore, 'total XP value must be conserved');

    // Magnetized gems remain untouched
    const magGems = world.xpGems.filter((g) => g.magnetizedBy === 'p1');
    assert.equal(magGems.length, 5);

    // Every unmagnetized gem must stay in either west (< 500, < 500) or east (> 3100, > 3100) — zero mid-map teleport!
    for (const g of world.xpGems) {
      if (g.magnetizedBy !== null) continue;
      const inWest = g.x < 500 && g.y < 500;
      const inEast = g.x > 3100 && g.y > 3100;
      assert.equal(inWest || inEast, true, `gem teleported across map to (${g.x}, ${g.y})`);
    }
  });

  it('fireLightningStaff with multishot skips enemies killed by bolt 1 in both auto-aim and manual-aim', () => {
    for (const manualAim of [false, true]) {
      const world = createSurvivalWorld({
        matchId: `m-bolt-${manualAim}`,
        mode: 'solo',
        mapId: 'winter_cabin',
        seed: 21,
        players: [
          { id: 'p1', name: 'Bolt', animal: 'panda', weaponId: 'lightning_staff', gearId: 'ice_skates', isBot: false },
        ],
      });
      world.obstacles = [];
      world.crates = [];
      const p1 = world.players[0];
      p1.skills = { multishot: 1 };
      p1.stats = computeDerivedStats('lightning_staff', 'ice_skates', p1.skills);

      // e1 at +100px (hp 1, dies on bolt 1), e2 at +320px (> chainRange 150px from e1, so only bolt 2 hits it!)
      const e1 = makeEnemy(world, { x: p1.x + 100, y: p1.y, hp: 1, maxHp: 1 });
      const e2 = makeEnemy(world, { x: p1.x + 320, y: p1.y, hp: 200, maxHp: 200 });
      world.enemies.push(e1, e2);

      stepSurvivalWorld(
        world,
        {
          p1: {
            ...IDLE_INPUT,
            manualAim,
            aimX: p1.x + 400,
            aimY: p1.y,
          },
        },
        0.02,
      );

      assert.equal(e1.hp, 0, 'bolt 1 kills e1');
      assert.ok(e2.hp < 200, `bolt 2 must hit living e2 when manualAim=${manualAim}`);
      assert.equal(world.lightningArcs.length, 2);
      assert.deepEqual(world.lightningArcs[1].points[1], { x: e2.x, y: e2.y });
    }

    // Crate fallback with multishot: bolt 1 breaks crate 1, bolt 2 skips broken crate 1 and hits crate 2
    const crateWorld = createSurvivalWorld({
      matchId: 'm-bolt-crate',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 22,
      players: [
        { id: 'p1', name: 'Bolt', animal: 'panda', weaponId: 'lightning_staff', gearId: 'ice_skates', isBot: false },
      ],
    });
    crateWorld.obstacles = [];
    crateWorld.crates = [
      { id: 'c1', x: crateWorld.players[0].x + 100, y: crateWorld.players[0].y, radius: 20, hp: 1, maxHp: 35, dropKind: 'heal', hitFlashTimer: 0 },
      { id: 'c2', x: crateWorld.players[0].x + 220, y: crateWorld.players[0].y, radius: 20, hp: 35, maxHp: 35, dropKind: 'magnet', hitFlashTimer: 0 },
    ];
    crateWorld.players[0].skills = { multishot: 1 };
    crateWorld.players[0].stats = computeDerivedStats('lightning_staff', 'ice_skates', crateWorld.players[0].skills);
    stepSurvivalWorld(crateWorld, { p1: IDLE_INPUT }, 0.02);
    assert.equal(crateWorld.lightningArcs.length, 2);
    assert.deepEqual(crateWorld.lightningArcs[1].points[1], { x: crateWorld.crates[0].x, y: crateWorld.crates[0].y });
    assert.ok(crateWorld.crates[0].hp < 35, 'bolt 2 should skip broken crate c1 and hit c2');
  });

  it('auto-aim matches weapon edge reach (dist - radius <= range) without blank shots', () => {
    const world = createSurvivalWorld({
      matchId: 'm-reach',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 23,
      players: [
        { id: 'p1', name: 'Bow', animal: 'cat', weaponId: 'frost_bow', gearId: 'ice_skates', isBot: false },
      ],
    });
    world.obstacles = [];
    world.crates = [];
    const p1 = world.players[0];
    const bowRange = getWeaponSpec('frost_bow').range; // 680

    // Enemy at 720px (previously inside 680*1.15=782, but dist - 17 = 703 > 680) -> must NOT fire
    const unreachable = makeEnemy(world, { x: p1.x + bowRange + 40, y: p1.y, radius: 17, hp: 100 });
    world.enemies.push(unreachable);
    stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.02);
    assert.equal(world.projectiles.length, 0, 'must not fire blank shots at unreachable enemy');

    // Boss with radius 50 at bowRange + 30 -> edge is at bowRange - 20 <= bowRange -> MUST fire and hit!
    world.enemies = [];
    const edgeBoss = makeEnemy(world, {
      kind: 'boss_snow_dragon',
      isBoss: true,
      bossTier: 1,
      x: p1.x + bowRange + 30,
      y: p1.y,
      radius: 50,
      hp: 500,
      maxHp: 500,
      attackCooldown: 99,
    });
    world.activeBossId = edgeBoss.id;
    world.enemies.push(edgeBoss);
    p1.fireCooldown = 0;
    stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.02);
    assert.equal(world.projectiles.length, 1, 'should lock onto large boss whose edge is within range');
    for (let i = 0; i < 45; i++) {
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.02);
    }
    assert.ok(edgeBoss.hp < 500, 'projectile should reach edge-range boss and deal damage');
  });

  it('grants mechanical advantage for Rare/Epic offers and preserves Boss Chest guaranteeRare across rerolls', () => {
    for (const skill of SKILLS) {
      const makeWorldWithOffer = (rarity: 'common' | 'rare') => {
        const w = createSurvivalWorld({
          matchId: `m-rar-${skill.id}-${rarity}`,
          mode: 'solo',
          mapId: 'winter_cabin',
          seed: 31,
          players: [
            { id: 'p1', name: 'P', animal: 'cat', weaponId: 'candy_smg', gearId: 'ice_skates', isBot: false },
          ],
        });
        w.phase = 'levelup';
        w.pendingOffersByPlayer = {
          p1: [{ skillId: skill.id, rarity, currentLevel: 0, nextLevel: 1, levelGain: 1 }],
        };
        applySkillPick(w, 'p1', 0);
        return w.players[0].stats;
      };

      const commonStats = makeWorldWithOffer('common');
      const rareStats = makeWorldWithOffer('rare');
      const strictlyHigher =
        rareStats.maxHp > commonStats.maxHp ||
        rareStats.moveSpeed > commonStats.moveSpeed ||
        rareStats.dashCooldown < commonStats.dashCooldown ||
        rareStats.pickupRadius > commonStats.pickupRadius ||
        rareStats.xpMultiplier > commonStats.xpMultiplier ||
        rareStats.fireRate > commonStats.fireRate ||
        rareStats.damageMultiplier > commonStats.damageMultiplier ||
        rareStats.projectileScale > commonStats.projectileScale;
      assert.equal(strictlyHigher, true, `Rare ${skill.id} pick should beat Common`);
    }

    // Boss chest reroll must preserve guaranteeRare: true until level-up closes
    const bossWorld = createSurvivalWorld({
      matchId: 'm-boss-reroll',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 44,
      players: [
        { id: 'p1', name: 'P', animal: 'cat', weaponId: 'lightning_staff', gearId: 'ice_skates', isBot: false },
      ],
    });
    bossWorld.obstacles = [];
    bossWorld.crates = [];
    const boss = makeEnemy(bossWorld, {
      kind: 'boss_slime_king',
      isBoss: true,
      bossTier: 1,
      x: bossWorld.players[0].x + 80,
      y: bossWorld.players[0].y,
      hp: 1,
      maxHp: 1400,
    });
    bossWorld.activeBossId = boss.id;
    bossWorld.enemies.push(boss);

    for (let i = 0; i < 20; i++) {
      stepSurvivalWorld(bossWorld, { p1: IDLE_INPUT }, 0.05);
      if (bossWorld.phase === 'levelup') break;
    }
    assert.equal(bossWorld.phase, 'levelup');
    assert.equal(bossWorld.activeLevelUpGuaranteeRare, true);

    assert.equal(rerollSkillOffers(bossWorld, 'p1'), true);
    for (const offer of bossWorld.pendingOffersByPlayer.p1) {
      assert.notEqual(offer.rarity, 'common', 'reroll on Boss Chest must still guarantee rare/epic');
    }
    applySkillPick(bossWorld, 'p1', 0);
    assert.equal(bossWorld.activeLevelUpGuaranteeRare, false);
  });

  it('cancels Boss line-charge hazards if Boss dies mid-windup without dealing phantom damage', () => {
    const world = createSurvivalWorld({
      matchId: 'm-boss-cancel',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 61,
      players: [
        { id: 'p1', name: 'P', animal: 'cat', weaponId: 'candy_smg', gearId: 'ice_skates', isBot: false },
      ],
    });
    world.obstacles = [];
    world.crates = [];
    world.spawnTimer = 9999;
    world.nextBossAtSec = 9999;
    const p1 = world.players[0];
    p1.fireCooldown = 9999;

    const bear = makeEnemy(world, {
      kind: 'boss_frost_bear',
      isBoss: true,
      bossTier: 1,
      x: p1.x + 150,
      y: p1.y,
      radius: 46,
      hp: 500,
      maxHp: 500,
      speed: 88,
      damage: 40,
      attackCooldown: 0,
    });
    world.activeBossId = bear.id;
    world.enemies.push(bear);

    // Step once so Frost Bear initiates line charge telegraph over p1
    stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.02);
    p1.fireCooldown = 9999;
    const lineHazard = world.hazards.find((h) => h.shape === 'line' && h.fromEnemy);
    assert.ok(lineHazard, 'frost bear should create line charge hazard');
    assert.equal(lineHazard.ownerId, bear.id);

    // Kill the boss mid-windup
    bear.hp = 0;
    const startHp = p1.hp;
    for (let i = 0; i < 25; i++) {
      p1.fireCooldown = 9999;
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
    }
    assert.equal(p1.hp, startHp, 'dead boss line-charge hazard must not deal phantom damage');
    assert.equal(world.hazards.some((h) => h.id === lineHazard.id), false);
  });

  it('extends ricochet range near maxRange and keeps snow_boomerang return trajectory & infinite pierce', () => {
    // 1. Ricochet near maxRange hits nearby 2nd enemy
    const wRic = createSurvivalWorld({
      matchId: 'm-ricochet',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 67,
      players: [
        { id: 'p1', name: 'Ric', animal: 'cat', weaponId: 'frost_bow', gearId: 'ice_skates', isBot: false },
      ],
    });
    wRic.obstacles = [];
    wRic.crates = [];
    wRic.spawnTimer = 9999;
    const pRic = wRic.players[0];
    pRic.skills = { ricochet: 1 };
    pRic.stats = computeDerivedStats('frost_bow', 'ice_skates', pRic.skills);

    const bowRange = getWeaponSpec('frost_bow').range; // 680
    const e1 = makeEnemy(wRic, { x: pRic.x + bowRange - 8, y: pRic.y, hp: 200, maxHp: 200 });
    const e2 = makeEnemy(wRic, { x: pRic.x + bowRange + 110, y: pRic.y + 40, hp: 200, maxHp: 200 });
    wRic.enemies.push(e1, e2);

    stepSurvivalWorld(wRic, { p1: { ...IDLE_INPUT, manualAim: true, aimX: e1.x, aimY: e1.y } }, 0.02);
    pRic.fireCooldown = 9999;
    for (let i = 0; i < 65; i++) {
      pRic.fireCooldown = 9999;
      stepSurvivalWorld(wRic, { p1: IDLE_INPUT }, 0.02);
    }
    assert.ok(e1.hp < 200, 'arrow should hit first enemy near maxRange');
    assert.ok(e2.hp < 200, 'ricochet should extend range/ttl and reach second enemy');

    // 2. snow_boomerang with ricochet does not veer off-course and pierces infinitely (> 99)
    const wBoom = createSurvivalWorld({
      matchId: 'm-boom-ric',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 68,
      players: [
        { id: 'p1', name: 'Boom', animal: 'dino', weaponId: 'snow_boomerang', gearId: 'ice_skates', isBot: false },
      ],
    });
    wBoom.obstacles = [];
    wBoom.crates = [];
    wBoom.spawnTimer = 9999;
    const pBoom = wBoom.players[0];
    pBoom.skills = { ricochet: 2 };
    pBoom.stats = computeDerivedStats('snow_boomerang', 'ice_skates', pBoom.skills);

    const mainTarget = makeEnemy(wBoom, { x: pBoom.x + 220, y: pBoom.y, hp: 500, maxHp: 500 });
    const offAxisTarget = makeEnemy(wBoom, { x: pBoom.x + 220, y: pBoom.y + 130, hp: 500, maxHp: 500 });
    wBoom.enemies.push(mainTarget, offAxisTarget);

    stepSurvivalWorld(wBoom, { p1: { ...IDLE_INPUT, manualAim: true, aimX: mainTarget.x, aimY: mainTarget.y } }, 0.02);
    pBoom.fireCooldown = 9999;
    const proj = wBoom.projectiles[0];
    assert.ok(proj);
    // Force pierceLeft = 1 to verify boomerang ignores pierceLeft decrement
    proj.pierceLeft = 1;

    let sawReturning = false;
    for (let i = 0; i < 80; i++) {
      pBoom.fireCooldown = 9999;
      stepSurvivalWorld(wBoom, { p1: IDLE_INPUT }, 0.02);
      if (wBoom.projectiles.some((pr) => pr.returning)) {
        sawReturning = true;
      }
    }
    assert.equal(sawReturning, true, 'boomerang must still return when ricochet skill is active');
    assert.equal(mainTarget.hp, 440, 'boomerang hits outbound and returning without losing pierce');
    assert.equal(offAxisTarget.hp, 500, 'boomerang must not ricochet into off-axis target');
    assert.equal(wBoom.projectiles.length, 0, 'boomerang returns cleanly to owner');
  });

  it('decays hitFlashTimer while downed, handles botTakeover mid-levelup, and guards continueEndlessMode', () => {
    const world = createSurvivalWorld({
      matchId: 'm-down-takeover',
      mode: 'online_coop',
      mapId: 'winter_cabin',
      seed: 73,
      players: [
        { id: 'h1', name: 'H1', animal: 'cat', weaponId: 'candy_smg', gearId: 'ice_skates', isBot: false },
        { id: 'h2', name: 'H2', animal: 'dog', weaponId: 'frost_bow', gearId: 'plush_armor', isBot: false },
      ],
    });
    world.obstacles = [];
    world.crates = [];
    world.spawnTimer = 9999;
    const [h1, h2] = world.players;

    // continueEndlessMode must no-op outside 'victory'
    continueEndlessMode(world);
    assert.equal(world.isEndlessActive, false);
    assert.equal(world.phase, 'playing');

    // Down h1 with enemy contact -> hitFlashTimer > 0 must decay to 0 while downed
    h1.hp = 1;
    h1.invulnTimer = 0;
    world.enemies.push(makeEnemy(world, { x: h1.x, y: h1.y, damage: 40, radius: 24 }));
    stepSurvivalWorld(world, { h1: IDLE_INPUT, h2: IDLE_INPUT }, 0.05);
    assert.equal(h1.downed, true);
    assert.ok(h1.hitFlashTimer > 0);
    for (let i = 0; i < 6; i++) {
      stepSurvivalWorld(world, { h1: IDLE_INPUT, h2: IDLE_INPUT }, 0.05);
    }
    assert.equal(h1.hitFlashTimer, 0, 'hitFlashTimer must decay to 0 even while player is downed');

    // Trigger levelup; h1 picks, then h2 disconnects (botTakeover = true) mid-levelup
    world.enemies = [];
    world.xpGems.push({
      id: 'g_lvl',
      x: h2.x,
      y: h2.y,
      value: 200,
      tier: 'gold',
      magnetizedBy: 'h2',
    });
    stepSurvivalWorld(world, { h1: IDLE_INPUT, h2: IDLE_INPUT }, 0.05);
    assert.equal(world.phase, 'levelup');
    assert.equal(applySkillPick(world, 'h1', 0), true);
    assert.equal(world.phase, 'levelup');

    h2.botTakeover = true;
    stepSurvivalWorld(world, { h1: IDLE_INPUT, h2: IDLE_INPUT }, 0.05);
    assert.equal(world.phase, 'playing', 'botTakeover mid-levelup should auto-pick and resume playing');
    assert.equal(Object.keys(h2.skills).length > 0, true, 'botTakeover player should receive auto-picked skill');
  });

  it('activates all 10 new map-exclusive skills and enforces active map skill pools on levelup', () => {
    // Map 1: frost_nova slows & damages; ice_shatter amplifies damage against slowed enemies
    const wWinter = createSurvivalWorld({
      matchId: 'm-new-winter',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 10,
      players: [
        { id: 'p1', name: 'Frost', animal: 'cat', weaponId: 'frost_bow', gearId: 'ice_skates', isBot: false },
      ],
    });
    wWinter.obstacles = [];
    wWinter.crates = [];
    wWinter.spawnTimer = 9999;
    const pWin = wWinter.players[0];
    pWin.fireCooldown = 9999;
    pWin.skills = { frost_nova: 2, ice_shatter: 2 };
    pWin.stats = computeDerivedStats('frost_bow', 'ice_skates', pWin.skills);
    const frostTarget = makeEnemy(wWinter, { x: pWin.x + 110, y: pWin.y, hp: 500, maxHp: 500 });
    wWinter.enemies.push(frostTarget);
    stepSurvivalWorld(wWinter, { p1: IDLE_INPUT }, 0.05);
    assert.ok(frostTarget.hp < 500, 'frost_nova deals AoE damage');
    assert.ok(frostTarget.slowTimer > 0 && frostTarget.slowFactor >= 0.45, 'frost_nova applies slow');

    // Verify map-exclusive pool on levelup in candy_canyon never rolls winter_cabin-only skills
    const wCandy = createSurvivalWorld({
      matchId: 'm-new-candy',
      mode: 'solo',
      mapId: 'candy_canyon',
      seed: 20,
      players: [
        { id: 'p1', name: 'Candy', animal: 'dog', weaponId: 'candy_smg', gearId: 'plush_armor', isBot: false },
      ],
    });
    wCandy.obstacles = [];
    wCandy.crates = [];
    wCandy.spawnTimer = 9999;
    const pCan = wCandy.players[0];
    pCan.fireCooldown = 9999;

    // Trigger pepper_bomb + caramel_nova + sugar_rush
    pCan.skills = { pepper_bomb: 2, caramel_nova: 2, sugar_rush: 2 };
    pCan.stats = computeDerivedStats('candy_smg', 'plush_armor', pCan.skills);
    pCan.comboCount = 10;
    const oneHit = makeEnemy(wCandy, { x: pCan.x + 80, y: pCan.y, hp: 20, maxHp: 200 });
    const neighbor = makeEnemy(wCandy, { x: pCan.x + 125, y: pCan.y, hp: 300, maxHp: 300 });
    wCandy.enemies.push(oneHit, neighbor);
    pCan.fireCooldown = 0;
    stepSurvivalWorld(wCandy, { p1: IDLE_INPUT }, 0.05);
    assert.ok(oneHit.hp <= 0, 'primary hit kills target');
    assert.ok(neighbor.hp < 300, 'pepper_bomb & caramel_nova damage clustered enemy');

    // Trigger crystal_cavern exclusives: crystal_shield, prism_chain, void_pulse, gem_greed, overcharge
    const wCrystal = createSurvivalWorld({
      matchId: 'm-new-crystal',
      mode: 'solo',
      mapId: 'crystal_cavern',
      seed: 30,
      players: [
        { id: 'p1', name: 'Prism', animal: 'panda', weaponId: 'candy_smg', gearId: 'crystal_magnet', isBot: false },
      ],
    });
    wCrystal.obstacles = [];
    wCrystal.crates = [];
    wCrystal.spawnTimer = 9999;
    const pCry = wCrystal.players[0];
    pCry.fireCooldown = 9999;
    pCry.skills = { overcharge: 2, crystal_shield: 2, prism_chain: 2, gem_greed: 2, void_pulse: 2 };
    pCry.stats = computeDerivedStats('candy_smg', 'crystal_magnet', pCry.skills);
    pCry.hp = 60;
    pCry.invulnTimer = 0;

    // Nearby attacker triggers crystal_shield counter-shock + prism_chain + void_pulse
    const attacker = makeEnemy(wCrystal, { x: pCry.x, y: pCry.y, hp: 600, maxHp: 600, damage: 20, radius: 22 });
    const secondTarget = makeEnemy(wCrystal, { x: pCry.x + 120, y: pCry.y, hp: 600, maxHp: 600 });
    wCrystal.enemies.push(attacker, secondTarget);
    wCrystal.xpGems.push({
      id: 'cry_purple_gem',
      x: pCry.x,
      y: pCry.y,
      value: 60,
      tier: 'purple',
      magnetizedBy: 'p1',
    });

    stepSurvivalWorld(wCrystal, { p1: IDLE_INPUT }, 0.05);
    assert.ok(attacker.hp < 600, 'crystal_shield counter-shock + void_pulse + prism_chain damage attacker');
    assert.ok(secondTarget.hp < 600, 'prism_chain / void_pulse hits secondary enemy');
    assert.ok(wCrystal.lightningArcs.length >= 1, 'prism_chain emits prism lightning arc');
    assert.ok(pCry.crystalShieldCooldown > 0, 'crystal_shield enters cooldown after retaliating');
    assert.equal(wCrystal.xpGems.length, 0, 'purple XP gem collected');

    // Trigger XP levelup on crystal_cavern -> offers must come exclusively from crystal pool (never winter/candy skills)
    wCrystal.teamXp = wCrystal.xpToNext + 10;
    stepSurvivalWorld(wCrystal, { p1: IDLE_INPUT }, 0.05);
    assert.equal(wCrystal.phase, 'levelup');
    const forbiddenScopes = new Set(['winter_cabin', 'candy_canyon']);
    for (const offer of wCrystal.pendingOffersByPlayer.p1) {
      const spec = SKILLS.find((s) => s.id === offer.skillId)!;
      assert.equal(
        forbiddenScopes.has(spec.mapScope),
        false,
        `crystal_cavern levelup leaked out-of-map skill ${spec.id}`,
      );
    }
  });
});
