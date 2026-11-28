import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSurvivalWorld } from '../../sim/engine.ts';
import type {
  EnemyEntity,
  ProjectileEntity,
  XpGemEntity,
} from '../../sim/types.ts';
import {
  SURVIVAL_INPUT_INTERVAL_MS,
  SURVIVAL_INPUT_STALE_MS,
  SURVIVAL_MAX_SNAPSHOT_ENEMIES,
  SURVIVAL_MAX_SNAPSHOT_GEMS,
  SURVIVAL_MAX_SNAPSHOT_PROJECTILES,
  SURVIVAL_SNAPSHOT_INTERVAL_MS,
  decodeSnapshotWire,
  encodeSnapshotWire,
  isSnapshotWirePayload,
  packSurvivalSnapshot,
  sanitizeSurvivalInput,
  validateSurvivalInputPayload,
  validateSurvivalLobbySyncPayload,
  validateSurvivalSkillActionPayload,
  validateSurvivalSnapshotPayload,
  validateSurvivalStartPayload,
  type SnapshotPlayerMeta,
} from '../protocol.ts';
import {
  clampBotCount,
  consumeRemoteSurvivalInputs,
  extractHostRoomState,
  normalizeLobbyHostFlags,
  parsePresenceMembers,
} from '../roomHelpers.ts';

function makeEnemy(id: string, overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  return {
    id,
    kind: 'slime',
    isBoss: false,
    bossTier: 0,
    x: 1523.4,
    y: 2412.6,
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

function makeProjectile(
  id: string,
  overrides: Partial<ProjectileEntity> = {},
): ProjectileEntity {
  return {
    id,
    ownerId: 'host_1',
    fromEnemy: false,
    weaponId: 'frost_bow',
    x: 1620.5,
    y: 1740.2,
    vx: 600,
    vy: 250,
    startX: 1500,
    startY: 1700,
    radius: 6,
    damage: 42,
    isCrit: false,
    pierceLeft: 2,
    ricochetLeft: 0,
    maxRange: 680,
    traveled: 120,
    ttl: 0.6,
    knockback: 45,
    aoeRadius: 0,
    slowPct: 0.3,
    slowDurationSec: 1.5,
    boomerang: false,
    returning: false,
    hitIds: [],
    color: '#38bdf8',
    ...overrides,
  };
}

function makeXpGem(
  id: string,
  tier: XpGemEntity['tier'],
  value: number,
  x: number,
  y: number,
): XpGemEntity {
  return {
    id,
    x,
    y,
    tier,
    value,
    magnetizedBy: null,
  };
}

describe('protocol cadence & caps', () => {
  it('aligns input and snapshot intervals safely under Supabase 15 events/sec limit', () => {
    assert.equal(SURVIVAL_INPUT_INTERVAL_MS, 72);
    assert.equal(SURVIVAL_SNAPSHOT_INTERVAL_MS, 75);
    assert.ok(1000 / SURVIVAL_INPUT_INTERVAL_MS < 15);
    assert.ok(1000 / SURVIVAL_SNAPSHOT_INTERVAL_MS < 15);
  });
});

describe('sanitizeSurvivalInput', () => {
  it('rejects non-objects and sanitizes Infinity, -Infinity, NaN, oversized vectors, and missing fields', () => {
    assert.equal(sanitizeSurvivalInput(null), null);
    assert.equal(sanitizeSurvivalInput(undefined), null);
    assert.equal(sanitizeSurvivalInput('bad'), null);
    assert.equal(sanitizeSurvivalInput(42), null);
    assert.equal(sanitizeSurvivalInput(true), null);
    assert.equal(sanitizeSurvivalInput([1, 2]), null);

    assert.deepEqual(sanitizeSurvivalInput({}), {
      moveX: 0,
      moveY: 0,
      aimX: 0,
      aimY: 0,
      manualAim: false,
      dashPressed: false,
    });

    assert.deepEqual(
      sanitizeSurvivalInput({
        moveX: Infinity,
        moveY: -Infinity,
        aimX: Number.NaN,
        aimY: Infinity,
        manualAim: 1,
        dashPressed: 'yes',
      }),
      {
        moveX: 0,
        moveY: 0,
        aimX: 0,
        aimY: 0,
        manualAim: true,
        dashPressed: true,
      },
    );

    assert.deepEqual(
      sanitizeSurvivalInput({
        moveX: 50,
        moveY: -12.5,
        aimX: 1420.5,
        aimY: 980.25,
        manualAim: 0,
        dashPressed: false,
      }),
      {
        moveX: 1,
        moveY: -1,
        aimX: 1420.5,
        aimY: 980.25,
        manualAim: false,
        dashPressed: false,
      },
    );
  });
});

describe('validateSurvivalInputPayload & validateSurvivalSkillActionPayload', () => {
  const allowedGuests = new Set(['guest-1', 'guest-2']);
  const matchId = 'match-online-1';

  it('validates input payloads and rejects unknown peers, __proto__, wrong matchId, and bad seq', () => {
    const valid = validateSurvivalInputPayload(
      {
        matchId,
        peerId: 'guest-1',
        seq: 12,
        sentAt: 5000,
        input: {
          moveX: 4,
          moveY: -0.5,
          aimX: Number.NaN,
          aimY: 300,
          manualAim: true,
          dashPressed: 1,
        },
      },
      allowedGuests,
      matchId,
    );
    assert.deepEqual(valid, {
      matchId,
      peerId: 'guest-1',
      seq: 12,
      sentAt: 5000,
      input: {
        moveX: 1,
        moveY: -0.5,
        aimX: 0,
        aimY: 300,
        manualAim: true,
        dashPressed: true,
      },
    });

    // Legacy packet without seq falls back to finite non-negative sentAt
    const legacy = validateSurvivalInputPayload(
      {
        matchId,
        peerId: 'guest-2',
        sentAt: 12345,
        input: { moveX: 0, moveY: 1, aimX: 10, aimY: 20, manualAim: false, dashPressed: false },
      },
      allowedGuests,
      matchId,
    );
    assert.equal(legacy?.seq, 12345);

    // Rejects Host spoofing, bots, unknown peers, prototype keys, wrong matchId, invalid seq
    assert.equal(
      validateSurvivalInputPayload(
        { matchId, peerId: 'host-1', seq: 1, input: {} },
        allowedGuests,
        matchId,
      ),
      null,
    );
    assert.equal(
      validateSurvivalInputPayload(
        { matchId, peerId: 'bot_1', seq: 1, input: {} },
        allowedGuests,
        matchId,
      ),
      null,
    );
    assert.equal(
      validateSurvivalInputPayload(
        { matchId, peerId: '__proto__', seq: 1, input: {} },
        new Set(['__proto__']),
        matchId,
      ),
      null,
    );
    assert.equal(
      validateSurvivalInputPayload(
        { matchId, peerId: 'constructor', seq: 1, input: {} },
        allowedGuests,
        matchId,
      ),
      null,
    );
    assert.equal(
      validateSurvivalInputPayload(
        { matchId: 'other-match', peerId: 'guest-1', seq: 1, input: {} },
        allowedGuests,
        matchId,
      ),
      null,
    );
    assert.equal(
      validateSurvivalInputPayload(
        { matchId, peerId: 'guest-1', seq: 1.5, input: {} },
        allowedGuests,
        matchId,
      ),
      null,
    );
    assert.equal(
      validateSurvivalInputPayload(
        { matchId, peerId: 'guest-1', seq: -1, input: {} },
        allowedGuests,
        matchId,
      ),
      null,
    );
    assert.equal(
      validateSurvivalInputPayload(
        { matchId, peerId: 'guest-1', seq: 1, input: null },
        allowedGuests,
        matchId,
      ),
      null,
    );
  });

  it('validates skill actions and rejects float/out-of-range offerIndex, __proto__, and unknown peers', () => {
    assert.deepEqual(
      validateSurvivalSkillActionPayload(
        { matchId, peerId: 'guest-1', action: 'pick', offerIndex: 2 },
        allowedGuests,
        matchId,
      ),
      { matchId, peerId: 'guest-1', action: 'pick', offerIndex: 2 },
    );

    assert.deepEqual(
      validateSurvivalSkillActionPayload(
        { matchId, peerId: 'guest-2', action: 'reroll' },
        allowedGuests,
        matchId,
      ),
      { matchId, peerId: 'guest-2', action: 'reroll' },
    );

    assert.equal(
      validateSurvivalSkillActionPayload(
        { matchId, peerId: 'guest-1', action: 'pick', offerIndex: 1.5 },
        allowedGuests,
        matchId,
      ),
      null,
    );
    assert.equal(
      validateSurvivalSkillActionPayload(
        { matchId, peerId: 'guest-1', action: 'pick', offerIndex: -1 },
        allowedGuests,
        matchId,
      ),
      null,
    );
    assert.equal(
      validateSurvivalSkillActionPayload(
        { matchId, peerId: 'guest-1', action: 'pick', offerIndex: 6 },
        allowedGuests,
        matchId,
      ),
      null,
    );
    assert.equal(
      validateSurvivalSkillActionPayload(
        { matchId, peerId: 'guest-1', action: 'pick' },
        allowedGuests,
        matchId,
      ),
      null,
    );
    assert.equal(
      validateSurvivalSkillActionPayload(
        { matchId, peerId: '__proto__', action: 'reroll' },
        allowedGuests,
        matchId,
      ),
      null,
    );
    assert.equal(
      validateSurvivalSkillActionPayload(
        { matchId: 'wrong-match', peerId: 'guest-1', action: 'reroll' },
        allowedGuests,
        matchId,
      ),
      null,
    );
  });
});

describe('validateSurvivalStartPayload & validateSurvivalLobbySyncPayload', () => {
  it('enforces hostPeerId, array bounds, mapId, and sanitizes loadout fields', () => {
    const validated = validateSurvivalStartPayload(
      {
        matchId: 'surv-ABC-1',
        hostPeerId: 'host-1',
        mapId: 'crystal_cavern',
        seed: 4242,
        players: [
          {
            id: 'host-1',
            name: '   ' + 'A'.repeat(40) + '   ',
            animal: 'alien_invalid',
            weaponId: 'bazooka_invalid',
            gearId: 'jetpack_invalid',
            isBot: 0,
          },
          {
            id: 'bot_1',
            name: 'Bot Mèo',
            animal: 'cat',
            weaponId: 'frost_bow',
            gearId: 'plush_armor',
            isBot: true,
          },
        ],
      },
      'host-1',
    );

    assert.ok(validated);
    assert.equal(validated.hostPeerId, 'host-1');
    assert.equal(validated.players[0].name, 'A'.repeat(24));
    assert.equal(validated.players[0].animal, 'dog');
    assert.equal(validated.players[0].weaponId, 'candy_smg');
    assert.equal(validated.players[0].gearId, 'ice_skates');
    assert.equal(validated.players[0].isBot, false);
    assert.equal(validated.players[1].weaponId, 'frost_bow');
    assert.equal(validated.players[1].gearId, 'plush_armor');

    // Mismatched hostPeerId
    assert.equal(
      validateSurvivalStartPayload(validated, 'other-host'),
      null,
    );

    // Oversized players array (5 > SURVIVAL_MAX_PLAYERS)
    const fivePlayers = Array.from({ length: 5 }, (_, i) => ({
      id: `p_${i}`,
      name: `Player ${i}`,
      animal: 'cat',
      weaponId: 'candy_smg',
      gearId: 'ice_skates',
      isBot: false,
    }));
    assert.equal(
      validateSurvivalStartPayload(
        {
          matchId: 'm1',
          hostPeerId: 'p_0',
          mapId: 'winter_cabin',
          seed: 1,
          players: fivePlayers,
        },
        'p_0',
      ),
      null,
    );

    // Empty players, NaN seed, bad mapId
    assert.equal(
      validateSurvivalStartPayload(
        {
          matchId: 'm1',
          hostPeerId: 'p_0',
          mapId: 'winter_cabin',
          seed: 1,
          players: [],
        },
        'p_0',
      ),
      null,
    );
    assert.equal(
      validateSurvivalStartPayload(
        {
          matchId: 'm1',
          hostPeerId: 'p_0',
          mapId: 'invalid_map',
          seed: 1,
          players: [fivePlayers[0]],
        },
        'p_0',
      ),
      null,
    );
    assert.equal(
      validateSurvivalStartPayload(
        {
          matchId: 'm1',
          hostPeerId: 'p_0',
          mapId: 'winter_cabin',
          seed: Number.NaN,
          players: [fivePlayers[0]],
        },
        'p_0',
      ),
      null,
    );
  });

  it('validates lobby sync payloads and clamps botFillCount 0..3', () => {
    const sync = validateSurvivalLobbySyncPayload({
      mapId: 'endless_abyss',
      botFillCount: 9,
      hostPeerId: 'host-1',
      members: [
        {
          peerId: 'host-1',
          name: 'Host',
          animal: 'invalid',
          weaponId: 'bad',
          gearId: 'bad',
          isHost: true,
          ready: true,
          joinedAt: 100,
        },
      ],
    });
    assert.ok(sync);
    assert.equal(sync.botFillCount, 3);
    assert.equal(sync.hostPeerId, 'host-1');
    assert.equal(sync.members[0].animal, 'dog');
    assert.equal(sync.members[0].weaponId, 'candy_smg');
    assert.equal(sync.members[0].gearId, 'ice_skates');

    assert.equal(
      validateSurvivalLobbySyncPayload({
        mapId: 'bad_map',
        botFillCount: 1,
        members: [],
      }),
      null,
    );
    assert.equal(
      validateSurvivalLobbySyncPayload({
        mapId: 'winter_cabin',
        botFillCount: Number.POSITIVE_INFINITY,
        members: [],
      }),
      null,
    );
    assert.equal(
      validateSurvivalLobbySyncPayload({
        mapId: 'winter_cabin',
        botFillCount: 1,
        hostPeerId: '__proto__',
        members: [],
      }),
      null,
    );
  });
});

describe('validateSurvivalSnapshotPayload & compact wire snapshot codec', () => {
  it('validates uncompressed snapshots and rejects missing entity arrays or prototype keys', () => {
    const world = createSurvivalWorld({
      matchId: 'match-val-1',
      mode: 'online_coop',
      mapId: 'winter_cabin',
      seed: 777,
      players: [
        {
          id: 'host-1',
          name: 'Mochi',
          animal: 'cat',
          weaponId: 'candy_smg',
          gearId: 'ice_skates',
          isBot: false,
        },
      ],
    });
    const packed = packSurvivalSnapshot(world, 10);

    assert.deepEqual(
      validateSurvivalSnapshotPayload(packed, 'match-val-1'),
      packed,
    );
    assert.equal(
      validateSurvivalSnapshotPayload(packed, 'wrong-match'),
      null,
    );
    assert.equal(
      validateSurvivalSnapshotPayload(
        { ...packed, enemies: { not: 'an-array' } },
        'match-val-1',
      ),
      null,
    );
    assert.equal(
      validateSurvivalSnapshotPayload(
        { ...packed, tick: Number.NaN },
        'match-val-1',
      ),
      null,
    );

    const poisonedOffers = JSON.parse('{"__proto__":[]}');
    assert.equal(
      validateSurvivalSnapshotPayload(
        { ...packed, pendingOffersByPlayer: poisonedOffers },
        'match-val-1',
      ),
      null,
    );

    const allBossKinds = [
      'boss_slime_king',
      'boss_frost_bear',
      'boss_snow_dragon',
      'boss_jelly_king',
      'boss_candy_scorpion',
      'boss_sugar_pharaoh',
      'boss_quartz_lord',
      'boss_crystal_golem',
      'boss_void_dragon',
    ] as const;
    for (const bossKind of allBossKinds) {
      const validated = validateSurvivalSnapshotPayload(
        { ...packed, bossWarningKind: bossKind },
        'match-val-1',
      );
      assert.ok(validated, `Expected ${bossKind} bossWarningKind to be valid`);
      assert.equal(validated.bossWarningKind, bossKind);
    }
  });

  it('round-trips rich snapshots faithfully through encodeSnapshotWire / decodeSnapshotWire', () => {
    const world = createSurvivalWorld({
      matchId: 'match-wire-roundtrip',
      mode: 'online_coop',
      mapId: 'candy_canyon',
      seed: 1337,
      players: [
        {
          id: 'host-1',
          name: 'Mochi',
          animal: 'cat',
          weaponId: 'frost_bow',
          gearId: 'golden_scope',
          isBot: false,
        },
        {
          id: 'guest-1',
          name: 'Bông',
          animal: 'panda',
          weaponId: 'candy_launcher',
          gearId: 'plush_armor',
          isBot: false,
        },
      ],
    });

    world.phase = 'levelup';
    world.isEndlessActive = true;
    world.elapsedSec = 95.45;
    world.score = 4250;
    world.teamLevel = 4;
    world.teamXp = 88;
    world.xpToNext = 296;
    world.bossesSlain = 1;
    world.nextBossAtSec = 210;
    world.bossWarningSec = 3.2;
    world.bossWarningKind = 'boss_sugar_pharaoh';
    world.activeBossId = 'boss_9';
    world.sandstormActiveTimer = 4.5;
    world.levelUpTimerSec = 11.2;
    world.pickedPlayerIds = ['host-1'];
    world.pendingOffersByPlayer = {
      'guest-1': [
        {
          skillId: 'void_pulse',
          rarity: 'epic',
          currentLevel: 1,
          nextLevel: 3,
          levelGain: 2,
        },
      ],
    };

    world.players[0].skills = { multishot: 2, orbital_ice: 1, caramel_nova: 1 };
    world.players[1].downed = true;
    world.players[1].botTakeover = true;
    world.players[1].hp = 0;
    world.players[1].reviveProgress = 0.45;

    world.enemies.push(
      makeEnemy('boss_9', {
        kind: 'boss_void_dragon',
        isBoss: true,
        bossTier: 2,
        radius: 46,
        hp: 1650.5,
        maxHp: 1800,
        hitFlashTimer: 0.08,
        slowTimer: 1.2,
        telegraphKind: 'slam',
        telegraphTimer: 0.55,
      }),
      makeEnemy('enemy_22', {
        kind: 'wolf',
        hitFlashTimer: 0,
        telegraphKind: 'lunge',
        telegraphTimer: 0.3,
      }),
    );

    world.projectiles.push(
      makeProjectile('proj_1', { weaponId: 'frost_bow', vx: 0, vy: 860 }),
      makeProjectile('proj_2', {
        weaponId: 'snow_boomerang',
        vx: 0,
        vy: 0,
        boomerang: true,
        color: '#abcdef',
      }),
    );

    world.xpGems.push(
      makeXpGem('gem_1', 'gold', 250, 1200.5, 1300.2),
      makeXpGem('gem_2', 'green', 10, 1400.1, 1500.9),
    );

    world.pickups.push({
      id: 'pk_1',
      x: 1100,
      y: 1200,
      kind: 'magnet',
      ttl: 15,
    });
    world.hazards.push(
      {
        id: 'haz_circle',
        x: 1700,
        y: 1800,
        radius: 90,
        shape: 'circle',
        elapsed: 0.25,
        duration: 0.9,
        damage: 25,
        fromEnemy: true,
        color: '#ef4444',
        resolved: false,
      },
      {
        id: 'haz_line',
        x: 1500,
        y: 1600,
        radius: 46,
        endX: 1920,
        endY: 1600,
        shape: 'line',
        elapsed: 0.4,
        duration: 0.75,
        damage: 34,
        fromEnemy: true,
        color: '#60a5fa',
        resolved: false,
      },
    );
    world.lightningArcs.push({
      points: [
        { x: 1000, y: 1000 },
        { x: 1120, y: 1060 },
      ],
      color: '#facc15',
      ttl: 0.12,
      maxTtl: 0.16,
    });
    world.players[0].skills = { frost_nova: 2, orbital_ice: 1, whirlwind_blade: 3 };
    world.players[0].frostNovaTimer = 1.45;
    world.players[0].whirlwindBladeTimer = 0.85;
    world.visualEffects.push(
      {
        kind: 'frost_nova',
        x: 1000.4,
        y: 1020.6,
        radius: 189,
        ttl: 0.35,
        maxTtl: 0.48,
      },
      {
        kind: 'laser_beam',
        x: 1100.2,
        y: 1150.8,
        radius: 14,
        ttl: 0.22,
        maxTtl: 0.28,
        endX: 1510.4,
        endY: 1210.9,
      },
    );

    const packed = packSurvivalSnapshot(world, 42);
    const wire = encodeSnapshotWire(packed);
    assert.equal(isSnapshotWirePayload(wire), true);
    assert.equal(packed.visualEffects.length, 2);
    assert.ok((packed.players[0].secondaryCooldowns?.frost_nova?.max ?? 0) > 0);
    assert.deepEqual(packed.players[0].secondaryCooldowns?.orbital_ice, {
      remaining: 0,
      max: 0,
    });

    const roster = new Map<string, SnapshotPlayerMeta>(
      world.players.map((p) => [
        p.id,
        {
          id: p.id,
          name: p.name,
          animal: p.animal,
          weaponId: p.weaponId,
          gearId: p.gearId,
          isBot: p.isBot,
        },
      ]),
    );

    const decoded = decodeSnapshotWire(
      JSON.parse(JSON.stringify(wire)),
      roster,
      'match-wire-roundtrip',
    );
    assert.deepEqual(decoded, packed);

    // Rejects mismatched matchId or malformed wire payload
    assert.equal(decodeSnapshotWire(wire, roster, 'other-match'), null);
    assert.equal(
      decodeSnapshotWire({ ...wire, v: 2 }, roster, 'match-wire-roundtrip'),
      null,
    );
    assert.equal(
      decodeSnapshotWire({ ...wire, mp: 99 }, roster, 'match-wire-roundtrip'),
      null,
    );
    assert.equal(
      decodeSnapshotWire({ ...wire, vf: [[999, 10, 10, 20, 0.2, 0.4]] }, roster, 'match-wire-roundtrip'),
      null,
    );
    assert.equal(
      decodeSnapshotWire(packed, roster, 'match-wire-roundtrip'),
      null,
    );
  });

  it('keeps worst-case wire snapshot (160 enemies + 120 projectiles + 120 gems + 4 players) strictly under 25 KB', () => {
    const world = createSurvivalWorld({
      matchId: 'match-worst-case',
      mode: 'online_coop',
      mapId: 'endless_abyss',
      seed: 99999,
      players: [
        {
          id: 'surv-host1234',
          name: 'Chủ Phòng Cún',
          animal: 'dog',
          weaponId: 'candy_smg',
          gearId: 'ice_skates',
          isBot: false,
        },
        {
          id: 'surv-guest234',
          name: 'Đồng Đội Mèo',
          animal: 'cat',
          weaponId: 'frost_bow',
          gearId: 'golden_scope',
          isBot: false,
        },
        {
          id: 'surv-guest345',
          name: 'Đồng Đội Vịt',
          animal: 'duck',
          weaponId: 'lightning_staff',
          gearId: 'crystal_magnet',
          isBot: false,
        },
        {
          id: 'surv-guest456',
          name: 'Đồng Đội Gấu',
          animal: 'panda',
          weaponId: 'candy_launcher',
          gearId: 'plush_armor',
          isBot: false,
        },
      ],
    });

    for (let i = 0; i < world.players.length; i += 1) {
      world.players[i].skills = {
        multishot: 3,
        fire_rate: 2,
        orbital_ice: 2,
        plush_drone: 1,
        team_aura: 1,
        frost_nova: 2,
        whirlwind_blade: 2,
        laser_turret: 2,
      };
      world.players[i].frostNovaTimer = 1.8;
      world.players[i].whirlwindBladeTimer = 0.9;
      world.players[i].laserTurretTimer = 1.4;
    }
    for (let i = 0; i < 20; i += 1) {
      world.visualEffects.push({
        kind: i % 2 === 0 ? 'frost_nova' : 'laser_beam',
        x: 1500 + i * 10,
        y: 1600 + i * 5,
        radius: 140,
        ttl: 0.25,
        maxTtl: 0.45,
        ...(i % 2 === 1 ? { endX: 1900 + i * 10, endY: 1650 + i * 5 } : {}),
      });
    }

    for (let i = 0; i < SURVIVAL_MAX_SNAPSHOT_ENEMIES; i += 1) {
      world.enemies.push(
        makeEnemy(`enemy_${1000 + i}`, {
          kind: i === 0 ? 'boss_snow_dragon' : 'wolf',
          isBoss: i === 0,
          bossTier: i === 0 ? 3 : 0,
          x: 1200 + (i % 20) * 45.3,
          y: 1300 + Math.floor(i / 20) * 52.7,
          hp: i === 0 ? 4200 : 58.5,
          maxHp: i === 0 ? 4500 : 58.5,
          hitFlashTimer: i % 4 === 0 ? 0.09 : 0,
          slowTimer: i % 5 === 0 ? 1.15 : 0,
          telegraphKind: i === 0 ? 'charge' : i % 10 === 0 ? 'lunge' : 'none',
          telegraphTimer: i === 0 || i % 10 === 0 ? 0.42 : 0,
        }),
      );
    }

    for (let i = 0; i < SURVIVAL_MAX_SNAPSHOT_PROJECTILES; i += 1) {
      world.projectiles.push(
        makeProjectile(`proj_${2000 + i}`, {
          fromEnemy: i % 6 === 0,
          weaponId: i % 6 === 0 ? 'enemy_orb' : 'frost_bow',
          x: 1400 + i * 3.1,
          y: 1600 + (i % 15) * 12.4,
          vx: 520,
          vy: -180 + (i % 7) * 50,
          color: i % 6 === 0 ? '#fb7185' : '#38bdf8',
        }),
      );
    }

    for (let i = 0; i < SURVIVAL_MAX_SNAPSHOT_GEMS; i += 1) {
      world.xpGems.push(
        makeXpGem(
          `gem_${3000 + i}`,
          i % 10 === 0 ? 'purple' : 'green',
          i % 10 === 0 ? 80 : 10,
          1500 + (i % 25) * 20.2,
          1400 + Math.floor(i / 25) * 30.6,
        ),
      );
    }

    const packed = packSurvivalSnapshot(world, 600);
    const encoder = new TextEncoder();
    const fullJsonBytes = encoder.encode(JSON.stringify(packed)).byteLength;
    const wire = encodeSnapshotWire(packed);
    const wireJson = JSON.stringify(wire);
    const wireBytes = encoder.encode(wireJson).byteLength;

    assert.equal(packed.enemies.length, 160);
    assert.equal(packed.projectiles.length, 120);
    assert.equal(packed.xpGems.length, 120);
    assert.equal(packed.players.length, 4);

    assert.ok(
      wireBytes < 25 * 1024,
      `Expected worst-case wire snapshot < 25600 bytes, got ${wireBytes} bytes (raw JSON was ${fullJsonBytes} bytes)`,
    );
    assert.ok(
      wireBytes < fullJsonBytes * 0.45,
      `Expected substantial compression over raw JSON (${wireBytes} vs ${fullJsonBytes})`,
    );

    const rosterRecord: Record<string, SnapshotPlayerMeta> = {};
    for (const p of world.players) {
      rosterRecord[p.id] = {
        id: p.id,
        name: p.name,
        animal: p.animal,
        weaponId: p.weaponId,
        gearId: p.gearId,
        isBot: p.isBot,
      };
    }

    const decoded = decodeSnapshotWire(
      JSON.parse(wireJson),
      rosterRecord,
      'match-worst-case',
    );
    assert.deepEqual(decoded, packed);
  });
});

describe('roomHelpers Presence parsing & Ghost-Host protection', () => {
  it('binds peerId strictly to Presence key, sorts isHost first, and sanitizes member fields', () => {
    const parsed = parsePresenceMembers({
      __proto__: [{ name: 'Evil', isHost: true }],
      'peer-guest-b': [
        {
          peerId: 'peer-host-spoof',
          name: 'Guest B',
          animal: 'unknown_pet',
          weaponId: 'invalid_gun',
          gearId: 'invalid_gear',
          isHost: false,
          ready: true,
          joinedAt: 200,
        },
      ],
      'peer-guest-a': [
        {
          peerId: 'peer-guest-a',
          name: 'Guest A',
          animal: 'cat',
          weaponId: 'frost_bow',
          gearId: 'plush_armor',
          isHost: false,
          ready: false,
          joinedAt: 150,
        },
      ],
      'peer-host': [
        {
          peerId: 'different-id',
          name: 'Host',
          animal: 'dog',
          weaponId: 'candy_smg',
          gearId: 'ice_skates',
          isHost: true,
          ready: true,
          joinedAt: 300,
        },
      ],
    });

    assert.equal(parsed.length, 3);
    assert.equal(parsed[0].peerId, 'peer-host');
    assert.equal(parsed[0].isHost, true);
    assert.equal(parsed[1].peerId, 'peer-guest-a');
    assert.equal(parsed[2].peerId, 'peer-guest-b');
    assert.equal(parsed[2].animal, 'dog');
    assert.equal(parsed[2].weaponId, 'candy_smg');
    assert.equal(parsed[2].gearId, 'ice_skates');
  });

  it('does not auto-promote Guest when no Host existed, and promotes only when allowFallbackPromotion is true', () => {
    const guestsOnly = parsePresenceMembers({
      'guest-1': [
        { name: 'Guest 1', isHost: false, ready: false, joinedAt: 100 },
      ],
      'guest-2': [
        { name: 'Guest 2', isHost: false, ready: true, joinedAt: 200 },
      ],
    });

    // Joining an empty/nonexistent room must NOT ghost-promote Guest 1 to Host
    const initial = normalizeLobbyHostFlags(guestsOnly, false);
    assert.equal(initial.hostPeerId, '');
    assert.equal(initial.normalized.every((m) => !m.isHost), true);

    // Pre-match Host departure after a Host was previously confirmed promotes earliest Guest
    const migrated = normalizeLobbyHostFlags(guestsOnly, true);
    assert.equal(migrated.hostPeerId, 'guest-1');
    assert.equal(migrated.normalized[0].isHost, true);
    assert.equal(migrated.normalized[1].isHost, false);
  });

  it('extracts Host roomState strictly from Host Presence key and clamps bot counts', () => {
    const state = {
      'guest-1': [{ isHost: false, roomState: 'playing' }],
      'host-1': [{ isHost: true, roomState: 'lobby' }],
    };
    assert.equal(extractHostRoomState(state, 'host-1'), 'lobby');
    assert.equal(extractHostRoomState(state, 'guest-1'), null);

    assert.equal(clampBotCount(5, 2), 2);
    assert.equal(clampBotCount(-1, 1), 0);
    assert.equal(clampBotCount(3, 4), 0);
  });

  it('expires stale guest movement after SURVIVAL_INPUT_STALE_MS and consumes one-shot dashPressed once', () => {
    const store = {
      'guest-active': {
        input: {
          moveX: 1,
          moveY: -0.5,
          aimX: 250,
          aimY: 300,
          manualAim: true,
          dashPressed: true,
        },
        receivedAtMs: 1000,
      },
      'guest-stale': {
        input: {
          moveX: -1,
          moveY: 1,
          aimX: 100,
          aimY: 100,
          manualAim: true,
          dashPressed: true,
        },
        receivedAtMs: 1000,
      },
    };

    const nowMs = 1000 + SURVIVAL_INPUT_STALE_MS + 1;
    store['guest-active'].receivedAtMs = nowMs - 40;

    const firstFrame = consumeRemoteSurvivalInputs(store, nowMs);
    assert.equal(firstFrame['guest-active'].moveX, 1);
    assert.equal(firstFrame['guest-active'].dashPressed, true);
    // Stale guest input resets movement & dash to neutral
    assert.equal(firstFrame['guest-stale'].moveX, 0);
    assert.equal(firstFrame['guest-stale'].moveY, 0);
    assert.equal(firstFrame['guest-stale'].dashPressed, false);

    // Subsequent frame does NOT re-trigger dashPressed without a fresh packet
    const secondFrame = consumeRemoteSurvivalInputs(store, nowMs + 16);
    assert.equal(secondFrame['guest-active'].dashPressed, false);
  });
});
