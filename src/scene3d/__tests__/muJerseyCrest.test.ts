import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCESSORY_ANCHORS } from '../accessoryAnchors.ts';
import {
  computeJerseyChestMount,
  getCurvedBadgeGeometry,
  getMuCrestTexture,
  getMuKitMarkTexture,
} from '../accessories/muCrestGeometry.ts';

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

describe('MU Jersey crest geometry and chest mount math', () => {
  it('1. creates cached curved badge geometry with finite vertices, normals, and UVs', () => {
    const g1 = getCurvedBadgeGeometry(0.18, 0.2);
    const g2 = getCurvedBadgeGeometry(0.18, 0.2);
    assert.equal(g1, g2, 'curved badge geometry must be cached');

    const pos = g1.getAttribute('position');
    const uv = g1.getAttribute('uv');
    const norm = g1.getAttribute('normal');
    assert.ok(pos && pos.count >= 25);
    assert.ok(uv && uv.count === pos.count);
    assert.ok(norm && norm.count === pos.count);

    // Outer edges should bend backward (-Z) relative to center (z = 0)
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      assert.ok(Number.isFinite(z));
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    assert.ok(maxZ >= -0.0001 && minZ < -0.002, 'badge must curve softly around torso');
  });

  it('2. mounts MU crest cleanly proud of the jersey shell surface on all 8 animals', () => {
    for (const animal of ALL_ANIMALS) {
      const outfit = ACCESSORY_ANCHORS[animal].outfit;
      const mount = computeJerseyChestMount(outfit, 1);

      const [, , sz] = outfit.scale;
      // Outer shell surface at yNorm=0.16, theta=0.29 rad sits at anchor.z + ~0.967 * sz
      const shellSurfaceZ = outfit.z + 0.967 * sz;
      assert.ok(
        mount.position[2] > shellSurfaceZ + 0.008,
        `${animal} MU crest Z (${mount.position[2]}) must clear jersey surface (${shellSurfaceZ})`,
      );
      assert.ok(
        mount.position[0] > 0.1 && mount.position[0] < 0.22,
        `${animal} left-chest crest X (${mount.position[0]}) must sit on wearer's left chest`,
      );
      assert.ok(
        mount.rotation[0] < -0.3 && mount.rotation[0] > -0.6,
        `${animal} crest pitch (${mount.rotation[0]}) must match upward chest slope`,
      );
    }
  });

  it('3. mounts right-chest kit mark symmetrically and guards canvas textures in Node', () => {
    for (const animal of ALL_ANIMALS) {
      const outfit = ACCESSORY_ANCHORS[animal].outfit;
      const left = computeJerseyChestMount(outfit, 1);
      const right = computeJerseyChestMount(outfit, -1);

      assert.ok(Math.abs(left.position[0] + right.position[0]) < 1e-6);
      assert.ok(Math.abs(left.position[1] - right.position[1]) < 1e-6);
      assert.ok(Math.abs(left.position[2] - right.position[2]) < 1e-6);
      assert.ok(Math.abs(left.rotation[1] + right.rotation[1]) < 1e-6);
    }

    assert.equal(getMuCrestTexture(), null);
    assert.equal(getMuKitMarkTexture(), null);
  });
});
