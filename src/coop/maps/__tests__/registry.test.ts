import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COOP_COOKIE_REWARDS,
  COOP_MAPS,
  COOP_MAP_IDS,
  DEFAULT_COOP_MAP_ID,
  MAX_COOP_STARS,
  calculateCoopResult,
  countTotalCoopStars,
  getCoopMapMeta,
  getNextCoopMapId,
  isCoopMapId,
  isNewCoopBest,
} from '../registry.ts';

describe('coop/maps/registry metadata', () => {
  it('defines all 4 maps in expected order with consistent constants', () => {
    assert.equal(DEFAULT_COOP_MAP_ID, 'glass_carry');
    assert.equal(MAX_COOP_STARS, 12);
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
