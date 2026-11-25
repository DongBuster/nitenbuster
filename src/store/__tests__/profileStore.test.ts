import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROFILE, sanitizeProfileData } from '../profileSchema.ts';

describe('profileSchema accessory migration', () => {
  it('unlocks mu_jersey by default on fresh profile', () => {
    assert.ok(DEFAULT_PROFILE.unlockedAccessories.includes('mu_jersey'));
    const fresh = sanitizeProfileData({});
    assert.ok(fresh.unlockedAccessories.includes('mu_jersey'));
    assert.deepEqual(fresh.equippedAccessory, {});
  });

  it('always unlocks mu_jersey and migrates legacy single-string equippedAccessory', () => {
    const migrated = sanitizeProfileData({
      cookies: 40,
      selectedAnimal: 'dino',
      unlockedAccessories: ['scarf'],
      equippedAccessory: { dino: 'scarf' },
    });

    assert.equal(migrated.cookies, 40);
    assert.equal(migrated.selectedAnimal, 'dino');
    assert.ok(migrated.unlockedAccessories.includes('mu_jersey'));
    assert.ok(migrated.unlockedAccessories.includes('scarf'));
    assert.deepEqual(migrated.equippedAccessory.dino, ['scarf']);
  });

  it('normalizes multi-slot equippedAccessory records and drops invalid ids', () => {
    const migrated = sanitizeProfileData({
      unlockedAccessories: ['mu_jersey', 'scarf', 'crown'],
      equippedAccessory: {
        dog: ['mu_jersey', 'scarf', 'crown', 'bad_id'],
        cat: 'invalid_legacy_id',
      },
    });
    assert.deepEqual(migrated.equippedAccessory.dog, [
      'mu_jersey',
      'scarf',
      'crown',
    ]);
    assert.equal(migrated.equippedAccessory.cat, undefined);
  });
});
