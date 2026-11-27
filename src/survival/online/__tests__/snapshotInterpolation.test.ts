import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INVITE_PARAM_KEYS,
  buildRoomInviteUrl,
} from '../../../online/inviteLink.ts';
import { createSurvivalWorld } from '../../sim/engine.ts';
import type {
  EnemyEntity,
  ProjectileEntity,
  SurvivalWorldState,
  XpGemEntity,
} from '../../sim/types.ts';
import {
  SURVIVAL_INTERPOLATION_DELAY_MS,
  SURVIVAL_MAX_SNAPSHOT_ENEMIES,
  SURVIVAL_MAX_SNAPSHOT_GEMS,
  SURVIVAL_MAX_SNAPSHOT_PROJECTILES,
  packSurvivalSnapshot,
  type SurvivalSnapshotPayload,
} from '../protocol.ts';
import {
  SurvivalSnapshotInterpolator,
  lerpAngle,
} from '../snapshotInterpolation.ts';

function assertClose(actual: number, expected: number, eps = 1e-6): void {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `Expected ${actual} to be within ${eps} of ${expected}`,
  );
}

function makeEnemyEntity(
  id: string,
  overrides: Partial<EnemyEntity> = {},
): EnemyEntity {
  return {
    id,
    kind: 'slime',
    isBoss: false,
    bossTier: 0,
    x: 1500,
    y: 1600,
    vx: 0,
    vy: 0,
    radius: 17,
    hp: 34,
    maxHp: 34,
    speed: 92,
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

function makeProjectileEntity(
  id: string,
  overrides: Partial<ProjectileEntity> = {},
): ProjectileEntity {
  return {
    id,
    ownerId: 'p1',
    fromEnemy: false,
    weaponId: 'candy_smg',
    x: 1800,
    y: 1800,
    vx: 100,
    vy: 0,
    startX: 1800,
    startY: 1800,
    radius: 6,
    damage: 18,
    isCrit: false,
    pierceLeft: 1,
    ricochetLeft: 0,
    maxRange: 500,
    traveled: 0,
    ttl: 0.7,
    knockback: 25,
    aoeRadius: 0,
    slowPct: 0,
    slowDurationSec: 0,
    boomerang: false,
    returning: false,
    hitIds: [],
    color: '#f472b6',
    ...overrides,
  };
}

function makeXpGemEntity(
  id: string,
  tier: XpGemEntity['tier'],
  value: number,
  overrides: Partial<XpGemEntity> = {},
): XpGemEntity {
  return {
    id,
    x: 1850,
    y: 1850,
    tier,
    value,
    magnetizedBy: null,
    ...overrides,
  };
}

function makeSnapshot(
  tick: number,
  elapsedSec: number,
  overrides: Partial<SurvivalSnapshotPayload> = {},
): SurvivalSnapshotPayload {
  return {
    matchId: overrides.matchId ?? 'surv-match-1',
    mapId: overrides.mapId ?? 'winter_cabin',
    seed: overrides.seed ?? 12345,
    tick,
    elapsedSec,
    phase: overrides.phase ?? 'playing',
    isEndlessActive: overrides.isEndlessActive ?? false,
    score: overrides.score ?? 100,
    teamLevel: overrides.teamLevel ?? 1,
    teamXp: overrides.teamXp ?? 10,
    xpToNext: overrides.xpToNext ?? 101,
    bossesSlain: overrides.bossesSlain ?? 0,
    nextBossAtSec: overrides.nextBossAtSec ?? 90,
    bossWarningSec: overrides.bossWarningSec ?? 0,
    bossWarningKind: overrides.bossWarningKind ?? null,
    activeBossId: overrides.activeBossId ?? null,
    sandstormActive: overrides.sandstormActive ?? false,
    levelUpTimerSec: overrides.levelUpTimerSec ?? 0,
    pendingOffersByPlayer: overrides.pendingOffersByPlayer ?? {},
    pickedPlayerIds: overrides.pickedPlayerIds ?? [],
    players: overrides.players ?? [
      {
        id: 'p1',
        name: 'Mochi',
        animal: 'cat',
        weaponId: 'candy_smg',
        gearId: 'ice_skates',
        isBot: false,
        botTakeover: false,
        x: 1000,
        y: 1000,
        aimAngle: 0,
        hp: 120,
        maxHp: 120,
        downed: false,
        reviveProgress: 0,
        invulnTimer: 0,
        dashTimer: 0,
        dashCooldownTimer: 0,
        dashCooldownMax: 1.8,
        hitFlashTimer: 0,
        kills: 0,
        damageDealt: 0,
        score: 0,
        revives: 0,
        rerollsLeft: 2,
        comboCount: 0,
        orbitalAngle: 0,
        orbitalLevel: 1,
        warmAuraLevel: 0,
        droneLevel: 1,
        droneAngle: 0,
        teamAuraLevel: 0,
        pylonBuffTimer: 0,
        skills: { orbital_ice: 1, plush_drone: 1 },
      },
    ],
    enemies: overrides.enemies ?? [],
    projectiles: overrides.projectiles ?? [],
    xpGems: overrides.xpGems ?? [],
    crates: overrides.crates ?? [],
    pickups: overrides.pickups ?? [],
    hazards: overrides.hazards ?? [],
    lightningArcs: overrides.lightningArcs ?? [],
    zones: overrides.zones ?? [],
  };
}

describe('lerpAngle', () => {
  it('interpolates standard endpoints and wraps shortest arc across -pi / +pi', () => {
    assertClose(lerpAngle(0, 1, 0), 0);
    assertClose(lerpAngle(0, 1, 0.5), 0.5);
    assertClose(lerpAngle(0, 1, 1), 1);

    // +pi side -> -pi side (delta = +0.4)
    const midForward = lerpAngle(Math.PI - 0.1, -Math.PI + 0.3, 0.5);
    assertClose(midForward, -Math.PI + 0.1, 1e-5);

    // -pi side -> +pi side (delta = -0.4)
    const midBackward = lerpAngle(-Math.PI + 0.1, Math.PI - 0.3, 0.5);
    assertClose(midBackward, Math.PI - 0.1, 1e-5);
  });
});

describe('packSurvivalSnapshot', () => {
  it('packs deterministic snapshot with 1-decimal coordinate rounding without mutating world', () => {
    const world: SurvivalWorldState = createSurvivalWorld({
      matchId: 'match-pack-1',
      mode: 'online_coop',
      mapId: 'candy_canyon',
      seed: 9876,
      players: [
        {
          id: 'p1',
          name: 'Mochi',
          animal: 'cat',
          weaponId: 'candy_smg',
          gearId: 'ice_skates',
          isBot: false,
        },
      ],
    });

    world.elapsedSec = 42.375;
    world.score = 1234.6;
    world.sandstormActiveTimer = 5.2;
    world.players[0].x = 1234.567;
    world.players[0].y = -0.02;
    world.players[0].aimAngle = 1.234;
    world.players[0].skills = { multishot: 2 };
    world.enemies.push(
      makeEnemyEntity('e1', {
        x: 1500.44,
        y: 1600.89,
        hp: 25,
        telegraphKind: 'lunge',
        telegraphTimer: 0.456,
      }),
    );
    world.hazards.push({
      id: 'haz1',
      x: 1100.16,
      y: 1200.24,
      radius: 95.34,
      endX: 1300.77,
      endY: 1400.88,
      shape: 'line',
      elapsed: 0.25,
      duration: 0.8,
      damage: 20,
      fromEnemy: true,
      color: '#f97316',
      resolved: false,
    });
    world.lightningArcs.push({
      points: [
        { x: 100.14, y: 200.26 },
        { x: 300.38, y: 400.44 },
      ],
      color: '#facc15',
      ttl: 0.14,
      maxTtl: 0.16,
    });
    world.pendingOffersByPlayer = {
      p1: [
        {
          skillId: 'damage_up',
          rarity: 'rare',
          currentLevel: 0,
          nextLevel: 1,
          levelGain: 1,
        },
      ],
    };
    world.pickedPlayerIds = ['p2'];

    const packedA = packSurvivalSnapshot(world, 77);
    const packedB = packSurvivalSnapshot(world, 77);
    assert.deepEqual(packedA, packedB);

    assert.equal(packedA.matchId, 'match-pack-1');
    assert.equal(packedA.mapId, 'candy_canyon');
    assert.equal(packedA.tick, 77);
    assert.equal(packedA.sandstormActive, true);
    assert.equal(packedA.players[0].x, 1234.6);
    assert.equal(packedA.players[0].y, 0);
    assert.equal(Object.is(packedA.players[0].y, -0), false);
    assert.equal(packedA.players[0].dashCooldownMax, 1.8);
    assert.equal(packedA.enemies[0].x, 1500.4);
    assert.equal(packedA.enemies[0].y, 1600.9);
    assert.equal(packedA.hazards[0].x, 1100.2);
    assert.equal(packedA.hazards[0].endX, 1300.8);
    assert.equal(packedA.hazards[0].endY, 1400.9);
    assert.equal(packedA.lightningArcs[0].points[0].x, 100.1);
    assert.equal(packedA.lightningArcs[0].points[1].y, 400.4);
    assert.equal(packedA.zones.length, world.zones.length);

    // Mutating packed snapshot does not mutate world
    packedA.players[0].skills.multishot = 5;
    packedA.pendingOffersByPlayer.p1[0].nextLevel = 99;
    packedA.pickedPlayerIds.push('p3');
    assert.equal(world.players[0].skills.multishot, 2);
    assert.equal(world.pendingOffersByPlayer.p1[0].nextLevel, 1);
    assert.deepEqual(world.pickedPlayerIds, ['p2']);
  });

  it('caps excess projectiles to 120 prioritizing enemy projectiles and newest player projectiles', () => {
    assert.equal(SURVIVAL_MAX_SNAPSHOT_PROJECTILES, 120);

    const world = createSurvivalWorld({
      matchId: 'match-proj-cap',
      mode: 'online_coop',
      mapId: 'winter_cabin',
      seed: 101,
      players: [
        {
          id: 'p1',
          name: 'Mochi',
          animal: 'cat',
          weaponId: 'candy_smg',
          gearId: 'ice_skates',
          isBot: false,
        },
      ],
    });

    // Add 140 player projectiles (p_0 .. p_139) and 20 enemy projectiles (e_0 .. e_19)
    for (let i = 0; i < 140; i++) {
      world.projectiles.push(
        makeProjectileEntity(`p_${i}`, { fromEnemy: false, x: 100 + i }),
      );
    }
    for (let i = 0; i < 20; i++) {
      world.projectiles.push(
        makeProjectileEntity(`e_${i}`, {
          fromEnemy: true,
          weaponId: 'enemy_orb',
          x: 500 + i,
        }),
      );
    }

    const packed = packSurvivalSnapshot(world, 12);

    assert.equal(world.projectiles.length, 160);
    assert.equal(packed.projectiles.length, 120);

    const packedIds = new Set(packed.projectiles.map((p) => p.id));
    // All 20 enemy projectiles must be preserved
    for (let i = 0; i < 20; i++) {
      assert.equal(packedIds.has(`e_${i}`), true);
    }
    // Newest 100 player projectiles (p_40 .. p_139) must be preserved; older (p_0 .. p_39) dropped
    for (let i = 0; i < 40; i++) {
      assert.equal(packedIds.has(`p_${i}`), false);
    }
    for (let i = 40; i < 140; i++) {
      assert.equal(packedIds.has(`p_${i}`), true);
    }

    // If > 120 enemy projectiles exist, keep newest 120 enemy projectiles only
    const enemyFlood = createSurvivalWorld({
      matchId: 'match-enemy-proj-cap',
      mode: 'online_coop',
      mapId: 'winter_cabin',
      seed: 102,
      players: [
        {
          id: 'p1',
          name: 'Mochi',
          animal: 'cat',
          weaponId: 'candy_smg',
          gearId: 'ice_skates',
          isBot: false,
        },
      ],
    });
    enemyFlood.projectiles.push(makeProjectileEntity('player_1', { fromEnemy: false }));
    for (let i = 0; i < 135; i++) {
      enemyFlood.projectiles.push(
        makeProjectileEntity(`ep_${i}`, {
          fromEnemy: true,
          weaponId: 'enemy_orb',
        }),
      );
    }
    const packedEnemyFlood = packSurvivalSnapshot(enemyFlood, 13);
    assert.equal(packedEnemyFlood.projectiles.length, 120);
    const enemyFloodIds = new Set(packedEnemyFlood.projectiles.map((p) => p.id));
    assert.equal(enemyFloodIds.has('player_1'), false);
    assert.equal(enemyFloodIds.has('ep_0'), false);
    assert.equal(enemyFloodIds.has('ep_14'), false);
    assert.equal(enemyFloodIds.has('ep_15'), true);
    assert.equal(enemyFloodIds.has('ep_134'), true);
  });

  it('caps excess XP gems to 120 prioritizing gold, purple, and blue tiers over green', () => {
    assert.equal(SURVIVAL_MAX_SNAPSHOT_GEMS, 120);

    const world = createSurvivalWorld({
      matchId: 'match-gem-cap',
      mode: 'online_coop',
      mapId: 'winter_cabin',
      seed: 202,
      players: [
        {
          id: 'p1',
          name: 'Mochi',
          animal: 'cat',
          weaponId: 'candy_smg',
          gearId: 'ice_skates',
          isBot: false,
        },
      ],
    });

    // 130 green gems, 15 blue, 8 purple, 3 gold = 156 total
    for (let i = 0; i < 130; i++) {
      world.xpGems.push(makeXpGemEntity(`green_${i}`, 'green', 10));
    }
    for (let i = 0; i < 15; i++) {
      world.xpGems.push(makeXpGemEntity(`blue_${i}`, 'blue', 30));
    }
    for (let i = 0; i < 8; i++) {
      world.xpGems.push(makeXpGemEntity(`purple_${i}`, 'purple', 80));
    }
    for (let i = 0; i < 3; i++) {
      world.xpGems.push(makeXpGemEntity(`gold_${i}`, 'gold', 250));
    }

    const packed = packSurvivalSnapshot(world, 15);

    assert.equal(world.xpGems.length, 156);
    assert.equal(packed.xpGems.length, 120);

    const packedIds = new Set(packed.xpGems.map((g) => g.id));
    for (let i = 0; i < 3; i++) {
      assert.equal(packedIds.has(`gold_${i}`), true);
    }
    for (let i = 0; i < 8; i++) {
      assert.equal(packedIds.has(`purple_${i}`), true);
    }
    for (let i = 0; i < 15; i++) {
      assert.equal(packedIds.has(`blue_${i}`), true);
    }
    const greenKeptCount = packed.xpGems.filter((g) => g.tier === 'green').length;
    assert.equal(greenKeptCount, 120 - 3 - 8 - 15);
  });

  it('caps excess enemies to 160 prioritizing bosses first and closest enemies to living players, and packs projectile angle', () => {
    assert.equal(SURVIVAL_MAX_SNAPSHOT_ENEMIES, 160);

    const world = createSurvivalWorld({
      matchId: 'match-enemy-cap',
      mode: 'online_coop',
      mapId: 'winter_cabin',
      seed: 303,
      players: [
        {
          id: 'p1',
          name: 'Mochi',
          animal: 'cat',
          weaponId: 'frost_bow',
          gearId: 'ice_skates',
          isBot: false,
        },
        {
          id: 'p2',
          name: 'Bông',
          animal: 'dog',
          weaponId: 'candy_smg',
          gearId: 'plush_armor',
          isBot: false,
        },
      ],
    });

    world.players[0].x = 1000;
    world.players[0].y = 1000;
    world.players[1].x = 2500;
    world.players[1].y = 2500;
    world.players[1].downed = true; // downed player should not pull enemy cap focus over living player

    // Add 1 far boss and 180 normal enemies (159 near living p1, 21 far near downed p2)
    world.enemies.push(
      makeEnemyEntity('boss_far', {
        kind: 'boss_slime_king',
        isBoss: true,
        bossTier: 1,
        x: 3400,
        y: 3400,
        hp: 1400,
        maxHp: 1400,
      }),
    );
    for (let i = 0; i < 159; i++) {
      world.enemies.push(
        makeEnemyEntity(`near_${i}`, {
          x: 1020 + i,
          y: 1020,
        }),
      );
    }
    for (let i = 0; i < 21; i++) {
      world.enemies.push(
        makeEnemyEntity(`far_${i}`, {
          x: 2510 + i,
          y: 2510,
        }),
      );
    }

    world.projectiles.push(
      makeProjectileEntity('arrow_1', {
        weaponId: 'frost_bow',
        vx: 0,
        vy: 860,
      }),
      makeProjectileEntity('static_1', {
        weaponId: 'candy_smg',
        vx: 0,
        vy: 0,
      }),
    );

    const packed = packSurvivalSnapshot(world, 21);
    assert.equal(world.enemies.length, 181);
    assert.equal(packed.enemies.length, 160);

    const keptEnemyIds = new Set(packed.enemies.map((e) => e.id));
    assert.equal(keptEnemyIds.has('boss_far'), true);
    for (let i = 0; i < 159; i++) {
      assert.equal(keptEnemyIds.has(`near_${i}`), true);
    }
    assert.equal(keptEnemyIds.has('far_0'), false);

    assertClose(packed.projectiles[0].angle ?? 0, 1.57, 1e-6);
    assert.equal('angle' in packed.projectiles[1], false);
  });
});

describe('SurvivalSnapshotInterpolator', () => {
  it('returns null when empty and cloned snapshot when single entry exists', () => {
    const interp = new SurvivalSnapshotInterpolator();
    assert.equal(interp.sample(1000), null);

    const s1 = makeSnapshot(1, 0.5);
    interp.push(s1, 1000);

    const sampled = interp.sample(1050);
    assert.deepEqual(sampled, s1);
    assert.notEqual(sampled, s1);
  });

  it('interpolates players (position + shortest-arc angles), enemies, projectiles, gems, and elapsedSec at midpoint', () => {
    assert.equal(SURVIVAL_INTERPOLATION_DELAY_MS, 125);

    const interp = new SurvivalSnapshotInterpolator();

    const s1 = makeSnapshot(10, 10.0, {
      players: [
        {
          id: 'p1',
          name: 'Mochi',
          animal: 'cat',
          weaponId: 'candy_smg',
          gearId: 'ice_skates',
          isBot: false,
          botTakeover: false,
          x: 100,
          y: 200,
          aimAngle: Math.PI - 0.1,
          hp: 120,
          maxHp: 120,
          downed: false,
          reviveProgress: 0,
          invulnTimer: 0,
          dashTimer: 0,
          dashCooldownTimer: 0,
          dashCooldownMax: 1.8,
          hitFlashTimer: 0,
          kills: 2,
          damageDealt: 100,
          score: 50,
          revives: 0,
          rerollsLeft: 2,
          comboCount: 1,
          orbitalAngle: Math.PI - 0.2,
          orbitalLevel: 1,
          warmAuraLevel: 0,
          droneLevel: 1,
          droneAngle: -Math.PI + 0.1,
          teamAuraLevel: 0,
          pylonBuffTimer: 0,
          skills: { orbital_ice: 1, plush_drone: 1 },
        },
      ],
      enemies: [
        {
          id: 'e1',
          kind: 'slime',
          isBoss: false,
          bossTier: 0,
          x: 400,
          y: 500,
          radius: 17,
          hp: 34,
          maxHp: 34,
          hitFlashTimer: 0,
          slowTimer: 0,
          telegraphKind: 'none',
          telegraphTimer: 0,
        },
      ],
      projectiles: [
        {
          id: 'proj_1',
          fromEnemy: false,
          weaponId: 'candy_smg',
          x: 200,
          y: 300,
          radius: 6,
          color: '#f472b6',
          boomerang: false,
        },
      ],
      xpGems: [
        {
          id: 'gem_1',
          x: 600,
          y: 700,
          tier: 'green',
          value: 10,
        },
      ],
    });

    const s2 = makeSnapshot(14, 12.0, {
      players: [
        {
          ...s1.players[0],
          x: 140,
          y: 280,
          aimAngle: -Math.PI + 0.3,
          orbitalAngle: -Math.PI + 0.2,
          droneAngle: Math.PI - 0.3,
          hp: 90,
          kills: 5,
        },
      ],
      enemies: [
        {
          ...s1.enemies[0],
          x: 420,
          y: 560,
          hp: 18,
        },
        {
          ...s1.enemies[0],
          id: 'e2_new',
          x: 900,
          y: 900,
        },
      ],
      projectiles: [
        {
          ...s1.projectiles[0],
          x: 260,
          y: 340,
        },
      ],
      xpGems: [
        {
          ...s1.xpGems[0],
          x: 560,
          y: 660,
        },
      ],
    });

    interp.push(s1, 1000);
    interp.push(s2, 1100);

    // targetTime = 1175 - 125 = 1050 -> t = 0.5 between 1000 and 1100
    const mid = interp.sample(1175);
    assert.ok(mid);
    assertClose(mid.elapsedSec, 11.0);
    assertClose(mid.players[0].x, 120);
    assertClose(mid.players[0].y, 240);
    assertClose(mid.players[0].aimAngle, -Math.PI + 0.1, 1e-5);
    assertClose(Math.abs(mid.players[0].orbitalAngle), Math.PI, 1e-5);
    assertClose(mid.players[0].droneAngle, Math.PI - 0.1, 1e-5);
    assert.equal(mid.players[0].hp, 90);
    assert.equal(mid.players[0].kills, 5);

    assert.equal(mid.enemies.length, 2);
    assertClose(mid.enemies[0].x, 410);
    assertClose(mid.enemies[0].y, 530);
    assert.equal(mid.enemies[0].hp, 18);
    assert.equal(mid.enemies[1].id, 'e2_new');
    assert.equal(mid.enemies[1].x, 900);

    assertClose(mid.projectiles[0].x, 230);
    assertClose(mid.projectiles[0].y, 320);

    assertClose(mid.xpGems[0].x, 580);
    assertClose(mid.xpGems[0].y, 680);

    // Past latest snapshot clamps cleanly without runaway extrapolation
    const future = interp.sample(2000);
    assert.ok(future);
    assert.equal(future.players[0].x, 140);
    assert.equal(future.players[0].y, 280);
  });

  it('ignores out-of-order and duplicate ticks, caps buffer to 8, and resets on matchId change', () => {
    const interp = new SurvivalSnapshotInterpolator();

    interp.push(makeSnapshot(10, 1.0, { score: 100 }), 1000);
    interp.push(makeSnapshot(9, 0.9, { score: 999 }), 1050); // out-of-order ignored
    interp.push(makeSnapshot(10, 1.0, { score: 888 }), 1060); // duplicate ignored

    assert.equal(interp.sample(1200)?.score, 100);

    // Push 8 newer ticks -> oldest (tick 10) evicted, buffer holds [20..90]
    for (let tick = 20; tick <= 90; tick += 10) {
      interp.push(
        makeSnapshot(tick, tick / 10, { score: tick * 10 }),
        1000 + (tick - 10) * 10,
      );
    }

    // targetTime = 1175 - 125 = 1050 <= earliest (1100) -> clamps to tick 20
    assert.equal(interp.sample(1175)?.tick, 20);

    // Match ID change resets buffer and accepts tick 1 again
    interp.push(makeSnapshot(1, 0.1, { matchId: 'surv-match-2', score: 12 }), 1500);
    const afterMatchChange = interp.sample(1600);
    assert.ok(afterMatchChange);
    assert.equal(afterMatchChange.matchId, 'surv-match-2');
    assert.equal(afterMatchChange.tick, 1);
    assert.equal(afterMatchChange.score, 12);

    // Explicit reset clears buffer
    interp.reset();
    assert.equal(interp.sample(2000), null);
  });

  it('interpolates projectile angle cleanly across wraparound and isolates repeated samples when reusing scratch maps', () => {
    const interp = new SurvivalSnapshotInterpolator();

    const s1 = makeSnapshot(1, 1.0, {
      projectiles: [
        {
          id: 'arrow_1',
          fromEnemy: false,
          weaponId: 'frost_bow',
          x: 100,
          y: 100,
          radius: 6,
          color: '#38bdf8',
          boomerang: false,
          angle: Math.PI - 0.1,
        },
      ],
    });
    const s2 = makeSnapshot(2, 2.0, {
      projectiles: [
        {
          id: 'arrow_1',
          fromEnemy: false,
          weaponId: 'frost_bow',
          x: 200,
          y: 200,
          radius: 6,
          color: '#38bdf8',
          boomerang: false,
          angle: -Math.PI + 0.3,
        },
      ],
    });

    interp.push(s1, 1000);
    interp.push(s2, 1100);

    const frameA = interp.sample(1175); // targetTime 1050 -> t=0.5
    assert.ok(frameA);
    assertClose(frameA.projectiles[0].angle ?? 0, -Math.PI + 0.1, 1e-5);

    // Mutating returned frame does not poison subsequent sample calls
    frameA.players[0].x = -9999;
    frameA.projectiles[0].x = -9999;

    const frameB = interp.sample(1175);
    assert.ok(frameB);
    assertClose(frameB.players[0].x, 1000);
    assertClose(frameB.projectiles[0].x, 150);
    assertClose(frameB.projectiles[0].angle ?? 0, -Math.PI + 0.1, 1e-5);
  });
});

describe('survival invite link integration', () => {
  it('registers survival query param key and builds clean invite URLs', () => {
    assert.equal(INVITE_PARAM_KEYS.survival, 'survivalRoom');
    assert.equal(
      buildRoomInviteUrl('survival', ' surv42 ', 'https://paws.game', '/'),
      'https://paws.game/?survivalRoom=SURV42',
    );
  });
});
