import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_DASH_COOLDOWN,
  BASE_MOVE_SPEED,
  BASE_PICKUP_RADIUS,
  BASE_PLAYER_HP,
  BOSS_NAMES,
  ENEMY_NAMES,
  GEARS,
  SKILLS,
  WEAPONS,
  computeDerivedStats,
  getGearSpec,
  getSkillSpec,
  getWeaponSpec,
  rollSkillOffers,
  xpForNextLevel,
} from '../catalog.ts';
import {
  SURVIVAL_MAPS,
  WORLD_SIZE,
  generateMapLayout,
  getSurvivalMapMeta,
  isSurvivalMapId,
} from '../maps.ts';
import type { SkillId } from '../types.ts';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('survival catalog & map registry', () => {
  it('exposes exact counts for 6 weapons, 4 gears, 14 skills, and 4 maps', () => {
    assert.equal(WEAPONS.length, 6);
    assert.equal(GEARS.length, 4);
    assert.equal(SKILLS.length, 14);
    assert.equal(SURVIVAL_MAPS.length, 4);

    assert.equal(new Set(WEAPONS.map((w) => w.id)).size, 6);
    assert.equal(new Set(GEARS.map((g) => g.id)).size, 4);
    assert.equal(new Set(SKILLS.map((s) => s.id)).size, 14);
    assert.equal(new Set(SURVIVAL_MAPS.map((m) => m.id)).size, 4);

    for (const skill of SKILLS) {
      assert.equal(skill.maxLevel, 5);
    }

    assert.equal(getWeaponSpec('candy_smg').fireRate, 5.2);
    assert.equal(getWeaponSpec('chestnut_shotgun').projectilesPerShot, 5);
    assert.equal(getWeaponSpec('frost_bow').pierce, 3);
    assert.equal(getWeaponSpec('lightning_staff').chainCount, 3);
    assert.equal(getWeaponSpec('candy_launcher').aoeRadius, 95);
    assert.equal(getWeaponSpec('snow_boomerang').boomerang, true);

    assert.equal(getGearSpec('crystal_magnet').pickupRadiusPct, 0.6);
    assert.equal(getSkillSpec('orbital_ice').category, 'secondary');
    assert.equal(BOSS_NAMES.boss_snow_dragon, 'Rồng Tuyết Cổ Đại');
    assert.ok(ENEMY_NAMES.slime.length > 0);
  });

  it('defines 3 campaign 6-minute maps and 1 endless_abyss map', () => {
    assert.deepEqual(
      SURVIVAL_MAPS.map((m) => m.id),
      ['winter_cabin', 'candy_canyon', 'crystal_cavern', 'endless_abyss'],
    );
    assert.equal(isSurvivalMapId('winter_cabin'), true);
    assert.equal(isSurvivalMapId('invalid_map'), false);

    for (const map of SURVIVAL_MAPS) {
      const fetched = getSurvivalMapMeta(map.id);
      assert.equal(fetched.id, map.id);
      if (map.id === 'endless_abyss') {
        assert.equal(map.isEndless, true);
        assert.equal(map.targetDurationSec, 0);
      } else {
        assert.equal(map.isEndless, false);
        assert.equal(map.targetDurationSec, 360);
      }
    }
  });

  it('computes xpForNextLevel(1) === 101 and grows strictly', () => {
    assert.equal(xpForNextLevel(1), 101);
    let prev = xpForNextLevel(1);
    for (let lv = 2; lv <= 30; lv++) {
      const next = xpForNextLevel(lv);
      assert.ok(next > prev, `xpForNextLevel(${lv}) should exceed level ${lv - 1}`);
      prev = next;
    }
  });

  it('rolls up to 3 unique eligible skill offers and respects guaranteeRare', () => {
    const rng = mulberry32(42);
    const offers = rollSkillOffers({}, rng, false);
    assert.equal(offers.length, 3);
    assert.equal(new Set(offers.map((o) => o.skillId)).size, 3);

    for (let i = 0; i < 30; i++) {
      const rareOffers = rollSkillOffers({ multishot: 5, fire_rate: 5 }, rng, true);
      assert.equal(rareOffers.length, 3);
      for (const offer of rareOffers) {
        assert.notEqual(offer.skillId, 'multishot');
        assert.notEqual(offer.skillId, 'fire_rate');
        assert.notEqual(offer.rarity, 'common');
        assert.ok(offer.nextLevel <= 5);
        assert.equal(offer.nextLevel, offer.currentLevel + offer.levelGain);
      }
    }

    const almostMaxed: Partial<Record<SkillId, number>> = {
      multishot: 5,
      fire_rate: 5,
      damage_up: 5,
      pierce_up: 5,
      ricochet: 5,
      orbital_ice: 5,
      warm_aura: 5,
      candy_meteor: 5,
      plush_drone: 5,
      max_hp: 5,
      vampirism: 5,
      magnet_range: 5,
      agility: 4,
      team_aura: 5,
    };
    const lastOffer = rollSkillOffers(almostMaxed, rng, true);
    assert.equal(lastOffer.length, 1);
    assert.equal(lastOffer[0].skillId, 'agility');
    assert.equal(lastOffer[0].nextLevel, 5);
  });

  it('computeDerivedStats applies weapon, gear, and stacked skills accurately', () => {
    const iceStats = computeDerivedStats('candy_smg', 'ice_skates', {});
    assert.equal(iceStats.maxHp, BASE_PLAYER_HP);
    assert.ok(Math.abs(iceStats.moveSpeed - BASE_MOVE_SPEED * 1.15) < 1e-6);
    assert.ok(Math.abs(iceStats.dashCooldown - BASE_DASH_COOLDOWN * 0.75) < 1e-6);

    const armorStats = computeDerivedStats('frost_bow', 'plush_armor', {
      max_hp: 2,
      damage_up: 3,
    });
    assert.equal(armorStats.maxHp, BASE_PLAYER_HP + 35 + 60);
    assert.equal(armorStats.damageReduction, 0.15);
    assert.ok(Math.abs(armorStats.damageMultiplier - (1 + 3 * 0.22)) < 1e-6);

    const magnetStats = computeDerivedStats('candy_launcher', 'crystal_magnet', {
      magnet_range: 1,
    });
    assert.ok(Math.abs(magnetStats.pickupRadius - BASE_PICKUP_RADIUS * (1 + 0.6 + 0.4)) < 1e-6);
    assert.ok(Math.abs(magnetStats.xpMultiplier - (1 + 0.12 + 0.1)) < 1e-6);

    const scopeStats = computeDerivedStats('candy_smg', 'golden_scope', {
      multishot: 2,
      fire_rate: 2,
    });
    assert.ok(Math.abs(scopeStats.critChance - 0.15) < 1e-6);
    assert.equal(scopeStats.bonusProjectiles, 2);
    assert.ok(Math.abs(scopeStats.fireRate - 5.2 * (1 + 0.12 + 0.36)) < 1e-6);
  });

  it('generateMapLayout is deterministic, keeps center clear, and bounds obstacles', () => {
    const layoutA = generateMapLayout('winter_cabin', 12345);
    const layoutB = generateMapLayout('winter_cabin', 12345);
    assert.deepEqual(layoutA, layoutB);

    assert.equal(layoutA.spawnPoints.length, 4);
    for (const sp of layoutA.spawnPoints) {
      const distFromCenter = Math.hypot(sp.x - WORLD_SIZE / 2, sp.y - WORLD_SIZE / 2);
      assert.ok(distFromCenter < 200);
    }

    for (const map of SURVIVAL_MAPS) {
      const layout = generateMapLayout(map.id, 999);
      assert.ok(layout.obstacles.length >= 28 && layout.obstacles.length <= 38);
      assert.ok(layout.zones.length >= 3);

      for (const obs of layout.obstacles) {
        assert.ok(obs.x >= 140 && obs.x <= WORLD_SIZE - 140);
        assert.ok(obs.y >= 140 && obs.y <= WORLD_SIZE - 140);
        const dist = Math.hypot(obs.x - WORLD_SIZE / 2, obs.y - WORLD_SIZE / 2);
        assert.ok(dist - obs.radius >= 260, `obstacle too close to center on ${map.id}`);
      }
    }
  });

  it('computeDerivedStats makes rare skillPower strictly stronger than common across all 14 skills', () => {
    for (const skill of SKILLS) {
      const commonStats = computeDerivedStats(
        'candy_smg',
        'ice_skates',
        { [skill.id]: 1 },
        { [skill.id]: 1.0 },
      );
      const rareStats = computeDerivedStats(
        'candy_smg',
        'ice_skates',
        { [skill.id]: 1 },
        { [skill.id]: 1.25 },
      );
      const epicCapStats = computeDerivedStats(
        'candy_smg',
        'ice_skates',
        { [skill.id]: 5 },
        { [skill.id]: 5.5 },
      );
      const commonCapStats = computeDerivedStats(
        'candy_smg',
        'ice_skates',
        { [skill.id]: 5 },
        { [skill.id]: 5.0 },
      );

      const isStrictlyBetter = (
        a: ReturnType<typeof computeDerivedStats>,
        b: ReturnType<typeof computeDerivedStats>,
      ): boolean =>
        a.maxHp > b.maxHp ||
        a.moveSpeed > b.moveSpeed ||
        a.dashCooldown < b.dashCooldown ||
        a.pickupRadius > b.pickupRadius ||
        a.xpMultiplier > b.xpMultiplier ||
        a.fireRate > b.fireRate ||
        a.damageMultiplier > b.damageMultiplier ||
        a.projectileScale > b.projectileScale;

      assert.equal(
        isStrictlyBetter(rareStats, commonStats),
        true,
        `Rare ${skill.id} should be strictly stronger than Common`,
      );
      assert.equal(
        isStrictlyBetter(epicCapStats, commonCapStats),
        true,
        `Epic Lv.4->5 ${skill.id} should be strictly stronger than Common Lv.4->5`,
      );
    }
  });

  it('keeps weapon, gear, and skill copy player-friendly with zero FE/math jargon (px, AOE, degree formulas)', () => {
    const forbidden = /\bpx\b|\bAOE\b|±|°|cấp×|HP\/s|\bMax HP\b/i;
    for (const w of WEAPONS) {
      assert.equal(
        forbidden.test(w.description),
        false,
        `Weapon ${w.id} description contains technical jargon: "${w.description}"`,
      );
    }
    for (const g of GEARS) {
      assert.equal(
        forbidden.test(g.description),
        false,
        `Gear ${g.id} description contains technical jargon: "${g.description}"`,
      );
      assert.equal(
        forbidden.test(g.badge),
        false,
        `Gear ${g.id} badge contains technical jargon: "${g.badge}"`,
      );
    }
    for (const s of SKILLS) {
      assert.equal(
        forbidden.test(s.description),
        false,
        `Skill ${s.id} description contains technical jargon: "${s.description}"`,
      );
      assert.equal(
        forbidden.test(s.perLevelSummary),
        false,
        `Skill ${s.id} summary contains technical jargon: "${s.perLevelSummary}"`,
      );
    }
  });
});
