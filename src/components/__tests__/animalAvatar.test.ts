import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ANIMALS } from '../../engine/types.ts';
import {
  ANIMAL_AVATAR_THEMES,
  getAnimalAvatarTheme,
} from '../animalAvatarMeta.ts';

describe('AnimalAvatar metadata & theme coverage', () => {
  it('1. provides a complete avatar theme for every playable animal in ANIMALS', () => {
    for (const animal of ANIMALS) {
      const theme = getAnimalAvatarTheme(animal.id);
      assert.equal(theme.id, animal.id);
      assert.equal(theme.label, animal.name);
      assert.match(theme.bgStart, /^#[0-9A-Fa-f]{6}$/);
      assert.match(theme.bgEnd, /^#[0-9A-Fa-f]{6}$/);
      assert.match(theme.ringHex, /^#[0-9A-Fa-f]{6}$/);
    }
    assert.equal(Object.keys(ANIMAL_AVATAR_THEMES).length, ANIMALS.length);
  });

  it('2. keeps every animal visually distinct across bgEnd / ringHex combinations', () => {
    const signatures = new Set(
      ANIMALS.map((a) => {
        const t = getAnimalAvatarTheme(a.id);
        return `${t.bgStart}|${t.bgEnd}`;
      }),
    );
    assert.equal(signatures.size, ANIMALS.length);
  });
});
