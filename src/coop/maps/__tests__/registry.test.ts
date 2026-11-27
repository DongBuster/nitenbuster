import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_PLAYABLE_STAGE_KEYS,
  COOP_COOKIE_REWARDS,
  COOP_LEVEL_NUMBERS,
  COOP_MAPS,
  COOP_MAP_IDS,
  DEFAULT_COOP_MAP_ID,
  MAX_COOP_STARS,
  TOTAL_PLAYABLE_COOP_LEVELS,
  buildUnlockedByPackMap,
  calculateCoopLevelResult,
  calculateCoopResult,
  countCoopActionStars,
  countCoopPackStars,
  countTotalCoopLevelStars,
  countTotalCoopStars,
  getCoopLevelMeta,
  getCoopMapMeta,
  getCoopMapPack,
  getDefaultMapPackId,
  getMaxPlayableLevelForPack,
  getNextCoopMapId,
  getNextPlayableCoopStage,
  getUnlockedLevelForPack,
  isCoopLevelNumber,
  isCoopLevelUnlocked,
  isCoopMapId,
  isNewCoopBest,
  makeCoopPackKey,
  makeCoopStageKey,
} from '../registry.ts';

describe('coop/maps/registry metadata', () => {
  it('defines all 4 maps in expected order with consistent constants', () => {
    assert.equal(DEFAULT_COOP_MAP_ID, 'glass_carry');
    assert.equal(TOTAL_PLAYABLE_COOP_LEVELS, 18);
    assert.equal(MAX_COOP_STARS, 54);
    assert.equal(ALL_PLAYABLE_STAGE_KEYS.length, 18);
    assert.deepEqual(COOP_LEVEL_NUMBERS, [1, 2, 3, 4, 5]);
    assert.deepEqual(COOP_COOKIE_REWARDS, { 3: 50, 2: 30, 1: 15 });
    assert.deepEqual(COOP_MAP_IDS, [
      'glass_carry',
      'raft_rapids',
      'rope_tether',
      'minecart_rails',
    ]);
    assert.equal(COOP_MAPS.length, 4);

    const expectedMeta = [
      {
        id: 'glass_carry',
        order: 1,
        title: 'Bê Kính Pha Lê',
        shortTitle: 'Bê Kính',
        mechanicBadge: 'Khiêng Kính · Nâng & Hạ',
        failureLabel: 'Vỡ kính',
        finishZ: 140,
        accentHex: '#22d3ee',
        three: { maxElapsedSec: 180, maxFailures: 2 },
        two: { maxElapsedSec: 300, maxFailures: 6 },
      },
      {
        id: 'raft_rapids',
        order: 2,
        title: 'Chèo Phao Vượt Thác',
        shortTitle: 'Chèo Phao',
        mechanicBadge: '1 Phao · 2 Mái Chèo',
        failureLabel: 'Lật phao',
        finishZ: 160,
        accentHex: '#38bdf8',
        three: { maxElapsedSec: 140, maxFailures: 2 },
        two: { maxElapsedSec: 240, maxFailures: 6 },
      },
      {
        id: 'rope_tether',
        order: 3,
        title: 'Dây Thừng Buộc Chung',
        shortTitle: 'Dây Thừng',
        mechanicBadge: 'Chained · Neo & Kéo Dây',
        failureLabel: 'Đứt / Rơi',
        finishZ: 135,
        accentHex: '#fbbf24',
        three: { maxElapsedSec: 180, maxFailures: 2 },
        two: { maxElapsedSec: 300, maxFailures: 6 },
      },
      {
        id: 'minecart_rails',
        order: 4,
        title: 'Xe Goòng Đường Ray',
        shortTitle: 'Xe Goòng',
        mechanicBadge: '3 Làn Ray · Bơm & Cúi',
        failureLabel: 'Trật bánh',
        finishZ: 180,
        accentHex: '#fb7185',
        three: { maxElapsedSec: 145, maxFailures: 2 },
        two: { maxElapsedSec: 240, maxFailures: 6 },
      },
    ] as const;

    for (let i = 0; i < expectedMeta.length; i++) {
      const actual = COOP_MAPS[i];
      const expected = expectedMeta[i];
      assert.equal(actual.id, expected.id);
      assert.equal(actual.order, expected.order);
      assert.equal(actual.title, expected.title);
      assert.equal(actual.shortTitle, expected.shortTitle);
      assert.equal(actual.mechanicBadge, expected.mechanicBadge);
      assert.equal(actual.failureLabel, expected.failureLabel);
      assert.equal(actual.finishZ, expected.finishZ);
      assert.equal(actual.accentHex, expected.accentHex);
      assert.deepEqual(actual.starThresholds.three, expected.three);
      assert.deepEqual(actual.starThresholds.two, expected.two);
      assert.ok(actual.tagline.trim().length > 0);
      assert.ok(actual.controls.length >= 4 && actual.controls.length <= 5);
      for (const hint of actual.controls) {
        assert.ok(hint.keys.trim().length > 0);
        assert.ok(hint.label.trim().length > 0);
      }
    }
  });

  it('validates CoopMapId via isCoopMapId and retrieves metadata via getCoopMapMeta', () => {
    for (const id of COOP_MAP_IDS) {
      assert.equal(isCoopMapId(id), true);
      const meta = getCoopMapMeta(id);
      assert.equal(meta.id, id);
    }

    assert.equal(isCoopMapId('unknown_map'), false);
    assert.equal(isCoopMapId(''), false);
    assert.equal(isCoopMapId(null), false);
    assert.equal(isCoopMapId(undefined), false);
    assert.equal(isCoopMapId(123), false);
  });

  it('cycles through maps in order via getNextCoopMapId', () => {
    assert.equal(getNextCoopMapId('glass_carry'), 'raft_rapids');
    assert.equal(getNextCoopMapId('raft_rapids'), 'rope_tether');
    assert.equal(getNextCoopMapId('rope_tether'), 'minecart_rails');
    assert.equal(getNextCoopMapId('minecart_rails'), 'glass_carry');
  });
});

describe('coop/maps/registry scoring & records', () => {
  it('calculates stars and cookie rewards using map-specific thresholds', () => {
    // glass_carry: 3* <= 180s & <=2, 2* <= 300s & <=6
    assert.deepEqual(calculateCoopResult('glass_carry', 180, 2), {
      mapId: 'glass_carry',
      stars: 3,
      cookies: 50,
      elapsedSec: 180,
      failures: 2,
    });
    assert.deepEqual(calculateCoopResult('glass_carry', 181, 0), {
      mapId: 'glass_carry',
      stars: 2,
      cookies: 30,
      elapsedSec: 181,
      failures: 0,
    });

    // raft_rapids: 3* <= 140s & <=2, 2* <= 240s & <=6
    assert.deepEqual(calculateCoopResult('raft_rapids', 140, 2), {
      mapId: 'raft_rapids',
      stars: 3,
      cookies: 50,
      elapsedSec: 140,
      failures: 2,
    });
    assert.deepEqual(calculateCoopResult('raft_rapids', 145, 1), {
      mapId: 'raft_rapids',
      stars: 2,
      cookies: 30,
      elapsedSec: 145,
      failures: 1,
    });
    assert.deepEqual(calculateCoopResult('raft_rapids', 241, 0), {
      mapId: 'raft_rapids',
      stars: 1,
      cookies: 15,
      elapsedSec: 241,
      failures: 0,
    });

    // minecart_rails: 3* <= 145s & <=2, 2* <= 240s & <=6
    assert.deepEqual(calculateCoopResult('minecart_rails', 145, 2), {
      mapId: 'minecart_rails',
      stars: 3,
      cookies: 50,
      elapsedSec: 145,
      failures: 2,
    });
    assert.deepEqual(calculateCoopResult('minecart_rails', 120, 7), {
      mapId: 'minecart_rails',
      stars: 1,
      cookies: 15,
      elapsedSec: 120,
      failures: 7,
    });
  });

  it('determines new best record via isNewCoopBest', () => {
    assert.equal(isNewCoopBest(undefined, 200, 1), true);
    assert.equal(isNewCoopBest({ bestStars: 2, bestTimeSec: 120 }, 175, 3), true);
    assert.equal(isNewCoopBest({ bestStars: 3, bestTimeSec: 140 }, 139.5, 3), true);
    assert.equal(isNewCoopBest({ bestStars: 3, bestTimeSec: 140 }, 140, 3), false);
    assert.equal(isNewCoopBest({ bestStars: 3, bestTimeSec: 140 }, 150, 3), false);
    assert.equal(isNewCoopBest({ bestStars: 3, bestTimeSec: 140 }, 90, 2), false);
  });

  it('counts total co-op stars across maps safely via countTotalCoopStars', () => {
    assert.equal(countTotalCoopStars(undefined), 0);
    assert.equal(countTotalCoopStars({}), 0);
    assert.equal(
      countTotalCoopStars({
        glass_carry: { bestStars: 3, bestTimeSec: 120 },
        raft_rapids: { bestStars: 2, bestTimeSec: 190 },
        rope_tether: { bestStars: 3, bestTimeSec: 150 },
        minecart_rails: { bestStars: 3, bestTimeSec: 130 },
      }),
      11,
    );
  });
});

describe('coop/maps/registry 3-level packs, progression, and level scoring', () => {
  it('defines 3 packs x 5 playable levels for glass_carry and 1 playable + 4 comingSoon for other actions', () => {
    const glass = getCoopMapMeta('glass_carry');
    assert.equal(glass.maps.length, 3);
    assert.deepEqual(
      glass.maps.map((m) => m.id),
      ['cabin_bridge', 'sky_scaffold', 'candy_factory'],
    );
    assert.equal(glass.maps[0].title, 'Cầu Gỗ Cabin Tuyết');
    assert.equal(glass.maps[0].shortTitle, 'Cầu Gỗ Cabin');
    assert.equal(glass.maps[0].accentHex, '#22d3ee');
    assert.equal(glass.maps[1].title, 'Công Trường Cao Ốc');
    assert.equal(glass.maps[1].accentHex, '#f59e0b');
    assert.equal(glass.maps[2].title, 'Xưởng Kẹo Băng Chuyền');
    assert.equal(glass.maps[2].accentHex, '#f472b6');

    for (const pack of glass.maps) {
      assert.equal(pack.levels.length, 5);
      assert.equal(getMaxPlayableLevelForPack('glass_carry', pack.id), 5);
      for (const lvl of pack.levels) {
        assert.notEqual(lvl.comingSoon, true);
        assert.equal(lvl.key, makeCoopStageKey('glass_carry', pack.id, lvl.level));
        assert.ok(ALL_PLAYABLE_STAGE_KEYS.includes(lvl.key));
      }
    }

    const cabinL1 = getCoopLevelMeta('glass_carry', 'cabin_bridge', 1);
    assert.equal(cabinL1.title, 'Khởi Động Cổng Gỗ');
    assert.equal(cabinL1.finishZ, 65);
    assert.equal(cabinL1.stageCount, 2);
    assert.equal(cabinL1.difficulty, 'easy');
    assert.equal(cabinL1.difficultyLabel, 'Dễ');
    assert.equal(cabinL1.difficultyColorHex, '#4ade80');
    assert.deepEqual(cabinL1.starThresholds, {
      three: { maxElapsedSec: 75, maxFailures: 1 },
      two: { maxElapsedSec: 125, maxFailures: 4 },
    });

    const cabinL5 = getCoopLevelMeta('glass_carry', 'cabin_bridge', 5);
    assert.equal(cabinL5.title, 'Đỉnh Bão Tuyết Cabin');
    assert.equal(cabinL5.finishZ, 145);
    assert.equal(cabinL5.stageCount, 5);
    assert.equal(cabinL5.difficulty, 'extreme');
    assert.equal(cabinL5.difficultyLabel, 'Siêu Khó');
    assert.equal(cabinL5.difficultyColorHex, '#fb7185');

    const skyL5 = getCoopLevelMeta('glass_carry', 'sky_scaffold', 5);
    assert.equal(skyL5.finishZ, 150);
    assert.deepEqual(skyL5.starThresholds, {
      three: { maxElapsedSec: 205, maxFailures: 2 },
      two: { maxElapsedSec: 325, maxFailures: 6 },
    });

    const candyL3 = getCoopLevelMeta('glass_carry', 'candy_factory', 3);
    assert.equal(candyL3.title, 'Dập Piston Kẹo Cứng');
    assert.equal(candyL3.finishZ, 115);
    assert.equal(candyL3.difficulty, 'hard');
    assert.equal(candyL3.difficultyLabel, 'Khá Khó');
    assert.equal(candyL3.difficultyColorHex, '#fbbf24');

    const singleLevelActions = [
      { id: 'raft_rapids' as const, packId: 'glacier_river', finishZ: 160, threeSec: 140 },
      { id: 'rope_tether' as const, packId: 'lantern_peaks', finishZ: 135, threeSec: 180 },
      { id: 'minecart_rails' as const, packId: 'frost_mine', finishZ: 180, threeSec: 145 },
    ];
    for (const item of singleLevelActions) {
      assert.equal(getDefaultMapPackId(item.id), item.packId);
      assert.equal(getMaxPlayableLevelForPack(item.id, item.packId), 1);
      const pack = getCoopMapPack(item.id, item.packId);
      assert.equal(pack.levels.length, 5);
      assert.notEqual(pack.levels[0].comingSoon, true);
      assert.equal(pack.levels[0].finishZ, item.finishZ);
      assert.equal(pack.levels[0].starThresholds.three.maxElapsedSec, item.threeSec);
      for (let i = 1; i < 5; i++) {
        assert.equal(pack.levels[i].comingSoon, true);
        assert.equal(ALL_PLAYABLE_STAGE_KEYS.includes(pack.levels[i].key), false);
      }
    }
  });

  it('validates level numbers, pack keys, and fallback getters', () => {
    assert.equal(makeCoopPackKey('glass_carry', 'cabin_bridge'), 'glass_carry:cabin_bridge');
    assert.equal(makeCoopStageKey('glass_carry', 'cabin_bridge', 3), 'glass_carry:cabin_bridge:3');
    for (const n of [1, 2, 3, 4, 5]) {
      assert.equal(isCoopLevelNumber(n), true);
    }
    for (const bad of [0, 6, 1.5, '1', null, undefined]) {
      assert.equal(isCoopLevelNumber(bad), false);
    }

    assert.equal(getDefaultMapPackId('glass_carry'), 'cabin_bridge');
    assert.equal(getCoopMapPack('glass_carry', 'missing_pack').id, 'cabin_bridge');
    assert.equal(getCoopLevelMeta('glass_carry', 'sky_scaffold').level, 1);
  });

  it('unlocks levels sequentially per pack and respects comingSoon and overrides', () => {
    assert.equal(getUnlockedLevelForPack(undefined, 'glass_carry', 'cabin_bridge'), 1);
    assert.equal(isCoopLevelUnlocked(undefined, 'glass_carry', 'cabin_bridge', 1), true);
    assert.equal(isCoopLevelUnlocked(undefined, 'glass_carry', 'cabin_bridge', 2), false);
    assert.equal(isCoopLevelUnlocked(undefined, 'raft_rapids', 'glacier_river', 2), false);

    // Skipping level 2 does not unlock level 3
    const skippedL2 = {
      'glass_carry:cabin_bridge:1': { bestStars: 2, bestTimeSec: 110 },
      'glass_carry:cabin_bridge:3': { bestStars: 3, bestTimeSec: 90 },
    };
    assert.equal(getUnlockedLevelForPack(skippedL2, 'glass_carry', 'cabin_bridge'), 2);
    assert.equal(isCoopLevelUnlocked(skippedL2, 'glass_carry', 'cabin_bridge', 2), true);
    assert.equal(isCoopLevelUnlocked(skippedL2, 'glass_carry', 'cabin_bridge', 3), false);

    // Sequential progression unlocks up to 5
    const upTo5 = {
      'glass_carry:cabin_bridge:1': { bestStars: 1, bestTimeSec: 150 },
      'glass_carry:cabin_bridge:2': { bestStars: 2, bestTimeSec: 140 },
      'glass_carry:cabin_bridge:3': { bestStars: 3, bestTimeSec: 120 },
      'glass_carry:cabin_bridge:4': { bestStars: 1, bestTimeSec: 280 },
      'raft_rapids:glacier_river:1': { bestStars: 3, bestTimeSec: 120 },
    };
    assert.equal(getUnlockedLevelForPack(upTo5, 'glass_carry', 'cabin_bridge'), 5);
    assert.equal(isCoopLevelUnlocked(upTo5, 'glass_carry', 'cabin_bridge', 5), true);
    // ComingSoon level 2 of raft_rapids stays locked even after clearing level 1
    assert.equal(getUnlockedLevelForPack(upTo5, 'raft_rapids', 'glacier_river'), 1);
    assert.equal(isCoopLevelUnlocked(upTo5, 'raft_rapids', 'glacier_river', 2), false);

    const unlockedMap = buildUnlockedByPackMap(upTo5);
    assert.equal(unlockedMap['glass_carry:cabin_bridge'], 5);
    assert.equal(unlockedMap['glass_carry:sky_scaffold'], 1);
    assert.equal(unlockedMap['raft_rapids:glacier_river'], 1);

    assert.equal(
      isCoopLevelUnlocked(undefined, 'glass_carry', 'sky_scaffold', 3, {
        'glass_carry:sky_scaffold': 3,
      }),
      true,
    );
  });

  it('cycles through playable stages across levels, packs, and actions via getNextPlayableCoopStage', () => {
    assert.deepEqual(getNextPlayableCoopStage('glass_carry', 'cabin_bridge', 1), {
      actionId: 'glass_carry',
      mapPackId: 'cabin_bridge',
      level: 2,
    });
    assert.deepEqual(getNextPlayableCoopStage('glass_carry', 'cabin_bridge', 5), {
      actionId: 'glass_carry',
      mapPackId: 'sky_scaffold',
      level: 1,
    });
    assert.deepEqual(getNextPlayableCoopStage('glass_carry', 'candy_factory', 5), {
      actionId: 'raft_rapids',
      mapPackId: 'glacier_river',
      level: 1,
    });
    assert.deepEqual(getNextPlayableCoopStage('raft_rapids', 'glacier_river', 1), {
      actionId: 'rope_tether',
      mapPackId: 'lantern_peaks',
      level: 1,
    });
    assert.deepEqual(getNextPlayableCoopStage('minecart_rails', 'frost_mine', 1), {
      actionId: 'glass_carry',
      mapPackId: 'cabin_bridge',
      level: 1,
    });
  });

  it('computes per-level results and pack/action/total star counts', () => {
    assert.deepEqual(
      calculateCoopLevelResult('glass_carry', 'cabin_bridge', 1, 75, 1),
      {
        mapId: 'glass_carry',
        mapPackId: 'cabin_bridge',
        level: 1,
        stageKey: 'glass_carry:cabin_bridge:1',
        stars: 3,
        cookies: 50,
        elapsedSec: 75,
        failures: 1,
      },
    );
    assert.deepEqual(
      calculateCoopLevelResult('glass_carry', 'cabin_bridge', 1, 80, 1),
      {
        mapId: 'glass_carry',
        mapPackId: 'cabin_bridge',
        level: 1,
        stageKey: 'glass_carry:cabin_bridge:1',
        stars: 2,
        cookies: 30,
        elapsedSec: 80,
        failures: 1,
      },
    );
    assert.deepEqual(
      calculateCoopLevelResult('glass_carry', 'cabin_bridge', 1, 130, 0),
      {
        mapId: 'glass_carry',
        mapPackId: 'cabin_bridge',
        level: 1,
        stageKey: 'glass_carry:cabin_bridge:1',
        stars: 1,
        cookies: 15,
        elapsedSec: 130,
        failures: 0,
      },
    );

    const fullRecords: Record<string, { bestStars: number; bestTimeSec: number }> = {};
    for (const key of ALL_PLAYABLE_STAGE_KEYS) {
      fullRecords[key] = { bestStars: 3, bestTimeSec: 50 };
    }
    // Add invalid/comingSoon key that must be ignored
    fullRecords['raft_rapids:glacier_river:2'] = { bestStars: 3, bestTimeSec: 50 };

    assert.deepEqual(countCoopPackStars(fullRecords, 'glass_carry', 'cabin_bridge'), {
      earned: 15,
      max: 15,
    });
    assert.deepEqual(countCoopActionStars(fullRecords, 'glass_carry'), {
      earned: 45,
      max: 45,
    });
    assert.deepEqual(countCoopActionStars(fullRecords, 'raft_rapids'), {
      earned: 3,
      max: 3,
    });
    assert.equal(countTotalCoopLevelStars(fullRecords), 54);
    assert.equal(countTotalCoopLevelStars(undefined), 0);
  });
});
