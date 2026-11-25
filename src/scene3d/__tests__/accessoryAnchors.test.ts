import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESSORY_ANCHORS,
  BONE_ROOT_OFFSETS,
  getAccessorySlot,
} from '../accessoryAnchors.ts';
import { SHOP_ITEMS } from '../accessoryCatalog.ts';

const ALL_ANIMALS = [
  'dog',
  'cat',
  'duck',
  'shark',
  'dino',
  'panda',
  'chicken',
  'bunny',
] as const;

describe('Accessory3D bone slots and anchors', () => {
  it('routes every accessory to an animated rig bone (`body` or `head`) for all 8 animals', () => {
    for (const animal of ALL_ANIMALS) {
      assert.equal(getAccessorySlot('scarf', animal), 'body');
      assert.equal(getAccessorySlot('glasses', animal), 'head');

      const expectedHatSlot =
        animal === 'shark' || animal === 'chicken' ? 'body' : 'head';
      assert.equal(getAccessorySlot('party_hat', animal), expectedHatSlot);
      assert.equal(getAccessorySlot('crown', animal), expectedHatSlot);
    }
  });

  it('angles scarf tails forward (negative X pitch) and places scarves at neck height rather than waist', () => {
    for (const animal of ALL_ANIMALS) {
      const { scarf } = ACCESSORY_ANCHORS[animal];
      const { body, head } = BONE_ROOT_OFFSETS[animal];

      assert.ok(
        (scarf.tailPitch ?? 0) < 0,
        `${animal} scarf tailPitch must be negative so tails drape forward over chest`,
      );
      assert.ok(
        scarf.scale[0] > 1 && scarf.scale[2] > 1,
        `${animal} scarf horizontal scale should exceed 1 to avoid sinking into torso`,
      );

      const worldScarfY = body[1] + scarf.y;
      assert.ok(
        worldScarfY >= 0.72 && worldScarfY <= 0.96,
        `${animal} scarf world Y (${worldScarfY}) must sit around neck/collar height`,
      );
      assert.ok(
        worldScarfY < head[1] + 0.1,
        `${animal} scarf world Y (${worldScarfY}) must stay below head center (${head[1]})`,
      );
    }
  });

  it('aligns glasses with positive eye spacing and wide-enough temples for every animal', () => {
    for (const animal of ALL_ANIMALS) {
      const { glasses } = ACCESSORY_ANCHORS[animal];
      assert.ok(glasses.spread >= 0.12 && glasses.spread <= 0.35);
      assert.ok(glasses.scale >= 0.7 && glasses.scale <= 1.0);
      assert.ok(
        (glasses.templeX ?? 0) >= glasses.spread + 0.05,
        `${animal} templeX must clear outer lens spread`,
      );
    }
  });

  it('routes all 15 catalog accessories to body or head for every animal', () => {
    for (const animal of ALL_ANIMALS) {
      for (const item of SHOP_ITEMS) {
        const slot = getAccessorySlot(item.id, animal);
        if (item.category === 'eyes') {
          assert.equal(slot, 'head');
        } else if (item.category === 'hat') {
          const expected =
            animal === 'shark' || animal === 'chicken' ? 'body' : 'head';
          assert.equal(slot, expected);
        } else {
          assert.equal(slot, 'body');
        }
      }
    }
  });

  it('provides outfit, back, and symmetric headphones anchors for all 8 animals', () => {
    for (const animal of ALL_ANIMALS) {
      const anchors = ACCESSORY_ANCHORS[animal];
      assert.ok(
        anchors.outfit.scale[0] >= 0.5 && anchors.outfit.chestZ > 0.35,
        `${animal} outfit anchor must wrap torso and protrude cleanly`,
      );
      assert.ok(
        anchors.back.z <= -0.35 && anchors.back.scale > 0.8,
        `${animal} back anchor must sit behind torso above tail`,
      );
      assert.ok(
        anchors.headphones.earSpread >= 0.35,
        `${animal} headphones earSpread must clear head sides`,
      );
    }
  });
});
