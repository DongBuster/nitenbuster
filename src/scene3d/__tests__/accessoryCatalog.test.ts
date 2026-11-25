import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_UNLOCKED_ACCESSORIES,
  EQUIP_CATEGORIES,
  SHOP_ITEMS,
  formatEquippedSummary,
  normalizeAccessories,
  toggleSlotAccessory,
} from '../accessoryCatalog.ts';

describe('accessoryCatalog 5-slot system', () => {
  it('defines 15 items across 5 categories with mu_jersey unlocked by default', () => {
    assert.equal(EQUIP_CATEGORIES.length, 5);
    assert.equal(SHOP_ITEMS.length, 15);
    const mu = SHOP_ITEMS.find((i) => i.id === 'mu_jersey');
    assert.ok(mu);
    assert.equal(mu.category, 'outfit');
    assert.equal(mu.price, 0);
    assert.equal(mu.isDefaultUnlocked, true);
    assert.ok(DEFAULT_UNLOCKED_ACCESSORIES.includes('mu_jersey'));
  });

  it('normalizes legacy single strings, nulls, invalid ids, and enforces one item per slot', () => {
    assert.deepEqual(normalizeAccessories(null), []);
    assert.deepEqual(normalizeAccessories('scarf'), ['scarf']);
    assert.deepEqual(normalizeAccessories(['unknown_id', 'mu_jersey']), ['mu_jersey']);
    assert.deepEqual(
      normalizeAccessories([
        'mu_jersey',
        'scarf',
        'glasses',
        'cozy_hoodie',
        'crown',
        'angel_wings',
      ]),
      ['cozy_hoodie', 'scarf', 'glasses', 'crown', 'angel_wings'],
    );
  });

  it('toggles items on/off and swaps items only within the same category', () => {
    let loadout = toggleSlotAccessory([], 'mu_jersey');
    loadout = toggleSlotAccessory(loadout, 'scarf');
    loadout = toggleSlotAccessory(loadout, 'glasses');
    loadout = toggleSlotAccessory(loadout, 'crown');
    loadout = toggleSlotAccessory(loadout, 'angel_wings');
    assert.equal(loadout.length, 5);

    loadout = toggleSlotAccessory(loadout, 'bowtie');
    assert.deepEqual(loadout, [
      'mu_jersey',
      'bowtie',
      'glasses',
      'crown',
      'angel_wings',
    ]);

    loadout = toggleSlotAccessory(loadout, 'bowtie');
    assert.deepEqual(loadout, ['mu_jersey', 'glasses', 'crown', 'angel_wings']);
  });

  it('formats summary concisely for UI badges', () => {
    assert.equal(formatEquippedSummary([]), null);
    assert.deepEqual(formatEquippedSummary(['mu_jersey']), {
      primaryName: 'Áo Đấu MU',
      extraCount: 0,
      fullNames: ['Áo Đấu MU'],
    });
    assert.deepEqual(formatEquippedSummary(['mu_jersey', 'scarf', 'crown']), {
      primaryName: 'Áo Đấu MU',
      extraCount: 2,
      fullNames: ['Áo Đấu MU', 'Khăn Len Mùa Đông', 'Vương Miện Quán Quân'],
    });
  });
});
