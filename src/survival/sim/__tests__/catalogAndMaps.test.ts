import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_DASH_COOLDOWN,
  BASE_MOVE_SPEED,
  BASE_PICKUP_RADIUS,
  BASE_PLAYER_HP,
  BIOME_ENEMY_NAMES,
  BOSS_NAMES,
  ENEMY_NAMES,
  GEARS,
  SKILLS,
  WEAPONS,
  computeDerivedStats,
  getEnemyNameForMap,
  getGearSpec,
  getSkillPoolForMap,
  getSkillSpec,
  getSkillTimingLabel,
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
  it('exposes exact counts for 6 weapons, 4 gears, 32 skills (8 core + 24 map-exclusive), 9 bosses, and 4 maps', () => {
    assert.equal(WEAPONS.length, 6);
    assert.equal(GEARS.length, 4);
    assert.equal(SKILLS.length, 32);
    assert.equal(SKILLS.filter((s) => s.category === 'secondary').length, 12);
    assert.equal(SURVIVAL_MAPS.length, 4);
    assert.equal(Object.keys(BOSS_NAMES).length, 9);

    assert.equal(new Set(WEAPONS.map((w) => w.id)).size, 6);
    assert.equal(new Set(GEARS.map((g) => g.id)).size, 4);
    assert.equal(new Set(SKILLS.map((s) => s.id)).size, 32);
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
    assert.equal(BOSS_NAMES.boss_sugar_pharaoh, 'Pharaoh Kẹo Lửa');
    assert.equal(BOSS_NAMES.boss_void_dragon, 'Rồng Pha Lê Hư Không');
    assert.ok(ENEMY_NAMES.slime.length > 0);
  });

  it('defines progressive difficulty across 3 campaign maps + 1 endless_abyss and distinct biome enemies', () => {
    assert.deepEqual(
      SURVIVAL_MAPS.map((m) => m.id),
      ['winter_cabin', 'candy_canyon', 'crystal_cavern', 'endless_abyss'],
    );
    assert.equal(isSurvivalMapId('winter_cabin'), true);
    assert.equal(isSurvivalMapId('invalid_map'), false);

    const winter = getSurvivalMapMeta('winter_cabin');
    const candy = getSurvivalMapMeta('candy_canyon');
    const crystal = getSurvivalMapMeta('crystal_cavern');
    const endless = getSurvivalMapMeta('endless_abyss');

    assert.ok(winter.difficultyStars < candy.difficultyStars);
    assert.ok(candy.difficultyStars < crystal.difficultyStars);
    assert.ok(crystal.difficultyStars < endless.difficultyStars);
    assert.ok(winter.difficulty.hpMult < candy.difficulty.hpMult);
    assert.ok(candy.difficulty.hpMult < crystal.difficulty.hpMult);
    assert.ok(winter.difficulty.damageMult < candy.difficulty.damageMult);
    assert.ok(candy.difficulty.damageMult < crystal.difficulty.damageMult);
    assert.ok(winter.cookieMultiplier < candy.cookieMultiplier);
    assert.ok(candy.cookieMultiplier < crystal.cookieMultiplier);

    assert.equal(winter.finalBossKind, 'boss_snow_dragon');
    assert.equal(candy.finalBossKind, 'boss_sugar_pharaoh');
    assert.equal(crystal.finalBossKind, 'boss_void_dragon');
    assert.equal(endless.isEndless, true);
    assert.equal(endless.bossRotation.length, 9);

    assert.notEqual(
      getEnemyNameForMap('slime', 'winter_cabin'),
      getEnemyNameForMap('slime', 'candy_canyon'),
    );
    assert.notEqual(
      BIOME_ENEMY_NAMES.candy_canyon.wolf,
      BIOME_ENEMY_NAMES.crystal_cavern.wolf,
    );

    for (const map of SURVIVAL_MAPS) {
      assert.ok(map.scenario.headline.length > 0);
      assert.equal(map.scenario.chapters.length, 3);
      for (let i = 0; i < map.scenario.chapters.length; i++) {
        const ch = map.scenario.chapters[i];
        assert.equal(ch.order, i + 1);
        assert.ok(ch.title.length > 0 && ch.summary.length > 0);
        assert.ok(map.bossRotation.includes(ch.bossKind));
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

  it('enforces 50/50 map skill pools (8 core + 8 exclusive), fixed rarity (never downgrades), and guaranteeRare', () => {
    const rng = mulberry32(42);

    // 1. 50/50 split on every campaign map; all 32 on endless_abyss
    for (const mapId of ['winter_cabin', 'candy_canyon', 'crystal_cavern'] as const) {
      const mapPool = getSkillPoolForMap(mapId);
      assert.equal(mapPool.length, 16, `${mapId} should have 16 total skills`);
      const coreCount = mapPool.filter((s) => s.mapScope === 'core').length;
      const exclCount = mapPool.filter((s) => s.mapScope === mapId).length;
      assert.equal(coreCount, 8, `${mapId} should include all 8 core skills`);
      assert.equal(exclCount, 8, `${mapId} should include 8 exclusive skills`);

      const allowedIds = new Set(mapPool.map((s) => s.id));
      for (let i = 0; i < 40; i++) {
        const rolled = rollSkillOffers({}, rng, i % 2 === 0, mapId);
        assert.equal(rolled.length, 3);
        assert.equal(new Set(rolled.map((o) => o.skillId)).size, 3);
        for (const offer of rolled) {
          assert.equal(
            allowedIds.has(offer.skillId),
            true,
            `skill ${offer.skillId} leaked into ${mapId}`,
          );
          assert.equal(
            offer.rarity,
            getSkillSpec(offer.skillId).rarity,
            `rarity for ${offer.skillId} must match its fixed catalog rarity`,
          );
        }
      }
    }
    assert.equal(getSkillPoolForMap('endless_abyss').length, 32);

    // 2. Fixed rarity NEVER downgrades when a Rare/Epic skill re-appears at higher levels
    for (let lv = 0; lv <= 4; lv++) {
      const offers = rollSkillOffers(
        { multishot: lv, orbital_ice: lv },
        rng,
        false,
        'winter_cabin',
      );
      for (const o of offers) {
        assert.equal(o.rarity, getSkillSpec(o.skillId).rarity);
      }
    }

    // 3. guaranteeRare strictly offers Rare/Epic when eligible
    for (let i = 0; i < 30; i++) {
      const rareOffers = rollSkillOffers(
        { multishot: 5, fire_rate: 5 },
        rng,
        true,
        'winter_cabin',
      );
      assert.equal(rareOffers.length, 3);
      for (const offer of rareOffers) {
        assert.notEqual(offer.skillId, 'multishot');
        assert.notEqual(offer.skillId, 'fire_rate');
        assert.notEqual(offer.rarity, 'common');
        assert.ok(offer.nextLevel <= 5);
        assert.equal(offer.nextLevel, offer.currentLevel + offer.levelGain);
      }
    }

    // 4. Exhausted pool down to 1 skill on winter_cabin returns only that remaining skill
    const almostMaxed: Partial<Record<SkillId, number>> = {
      damage_up: 5,
      fire_rate: 5,
      max_hp: 5,
      agility: 4,
      magnet_range: 5,
      multishot: 5,
      whirlwind_blade: 5,
      vital_regen: 5,
      pierce_up: 5,
      orbital_ice: 5,
      warm_aura: 5,
      team_aura: 5,
      frost_nova: 5,
      ice_shatter: 5,
      glacial_spear: 5,
      blizzard_ward: 5,
    };
    const lastOffer = rollSkillOffers(almostMaxed, rng, true, 'winter_cabin');
    assert.equal(lastOffer.length, 1);
    assert.equal(lastOffer[0].skillId, 'agility');
    assert.equal(lastOffer[0].rarity, 'common');
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

    const newPassiveStats = computeDerivedStats('candy_smg', 'ice_skates', {
      vital_regen: 2,
      blizzard_ward: 3,
      prism_focus: 2,
    });
    assert.ok(newPassiveStats.hpRegenPerSec >= 3);
    assert.ok(newPassiveStats.damageReduction >= 0.14);
    assert.ok(newPassiveStats.critChance >= 0.1);
    assert.ok(newPassiveStats.critMultiplier > 1.75);
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

  it('computeDerivedStats makes rare skillPower strictly stronger than common across all 32 skills', () => {
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
      const timing = getSkillTimingLabel(s.id);
      if (s.category === 'secondary') {
        assert.ok(timing && timing.length > 0, `Secondary skill ${s.id} must have timing label`);
        assert.equal(forbidden.test(timing), false);
      } else {
        assert.equal(timing, null);
      }
    }
  });
});
