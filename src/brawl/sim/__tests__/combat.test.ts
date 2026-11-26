import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTriggerWeaponSpin,
  ITEM_META,
  pickRandomItemKind,
} from '../combat.ts';

describe('brawl combat item pool & spin weapon rules', () => {
  it('excludes cocoa and card_boomerang and includes sword and shovel in ITEM_META', () => {
    const keys = Object.keys(ITEM_META);
    assert.ok(keys.includes('sword'), 'ITEM_META should include sword');
    assert.ok(keys.includes('shovel'), 'ITEM_META should include shovel');
    assert.ok(!keys.includes('cocoa'), 'ITEM_META should not include cocoa');
    assert.ok(
      !keys.includes('card_boomerang'),
      'ITEM_META should not include card_boomerang',
    );
  });

  it('pickRandomItemKind never rolls cocoa or card_boomerang and can roll sword', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const kind = pickRandomItemKind(() => i / 100);
      seen.add(kind);
    }
    assert.ok(seen.has('sword'), 'item pool should roll sword');
    assert.ok(!seen.has('cocoa'), 'item pool must not roll cocoa');
    assert.ok(!seen.has('card_boomerang'), 'item pool must not roll card_boomerang');
  });

  it('allows spin attack only when holding sword or shovel with remaining ammo', () => {
    assert.equal(canTriggerWeaponSpin('sword', 5), true);
    assert.equal(canTriggerWeaponSpin('shovel', 1), true);
    assert.equal(canTriggerWeaponSpin('sword', 0), false);
    assert.equal(canTriggerWeaponSpin('snowball', 3), false);
    assert.equal(canTriggerWeaponSpin('candy_bomb', 1), false);
    assert.equal(canTriggerWeaponSpin(null, 0), false);
  });
});
