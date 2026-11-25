import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  computeBlinkScaleY,
  getCatForeheadStripesGeometry,
  getCatTailGeometry,
  getCatWhiskersGeometry,
  getChickenPearGeometry,
  getDinoBodyGeometry,
  getDinoClawsGeometry,
  getDinoPlateGeometry,
  getDuckBillGeometry,
  getFloppyBunnyEarGeometry,
  getPawPadGeometry,
  getSharkDorsalFinGeometry,
  getSharkGillsGeometry,
  getSharkHoodGeometry,
  getSharkTailFinGeometry,
  getSharkTeethGeometry,
  getSharedStarEyeGeometry,
  getUprightBunnyEarGeometry,
} from '../plushCurves.ts';

function assertValidCachedGeometry(
  label: string,
  getter: () => THREE.BufferGeometry,
) {
  const g1 = getter();
  const g2 = getter();
  assert.equal(g1, g2, `${label} must return cached singleton geometry`);

  const pos = g1.getAttribute('position');
  assert.ok(pos && pos.count >= 12, `${label} must contain vertices`);
  const norm = g1.getAttribute('normal');
  assert.ok(norm && norm.count === pos.count, `${label} must have vertex normals`);

  for (let i = 0; i < pos.count; i++) {
    assert.ok(
      Number.isFinite(pos.getX(i)) &&
        Number.isFinite(pos.getY(i)) &&
        Number.isFinite(pos.getZ(i)),
      `${label} vertex ${i} must be finite`,
    );
  }
}

describe('plushCurves blink solver & cached sculpted geometries', () => {
  it('1. computes smooth periodic blinking for idle/sad and disables blinking on happy/shock/win', () => {
    // Mid-cycle (not blinking) stays fully open at 1
    assert.equal(computeBlinkScaleY(1.0, 0, 'idle'), 1);

    // Sample across a full 4.5s blink period and ensure a crisp blink dip occurs
    let minIdleScale = 1;
    for (let t = 0; t <= 4.5; t += 0.01) {
      const sy = computeBlinkScaleY(t, 0, 'idle');
      assert.ok(sy >= 0.08 && sy <= 1, `blink scale ${sy} out of bounds`);
      if (sy < minIdleScale) minIdleScale = sy;
    }
    assert.ok(
      minIdleScale <= 0.16,
      `idle blink should close eye cleanly (got min ${minIdleScale})`,
    );

    // Non-blinking emotions stay open at 1 at every timestamp
    for (const emotion of ['happy', 'shock', 'win'] as const) {
      for (let t = 0; t <= 4.5; t += 0.05) {
        assert.equal(computeBlinkScaleY(t, 0, emotion), 1);
      }
    }
  });

  it('2. caches shared sculpted body, fin, plate, tail, bill, ear, and star geometries', () => {
    assertValidCachedGeometry('starEye', getSharedStarEyeGeometry);
    assertValidCachedGeometry('sharkHood', getSharkHoodGeometry);
    assertValidCachedGeometry('sharkDorsalFin', getSharkDorsalFinGeometry);
    assertValidCachedGeometry('sharkTailFin', getSharkTailFinGeometry);
    assertValidCachedGeometry('dinoBody', getDinoBodyGeometry);
    assertValidCachedGeometry('dinoPlate', getDinoPlateGeometry);
    assertValidCachedGeometry('chickenPear', getChickenPearGeometry);
    assertValidCachedGeometry('catTail', getCatTailGeometry);
    assertValidCachedGeometry('duckBill', getDuckBillGeometry);
    assertValidCachedGeometry('uprightBunnyEar', getUprightBunnyEarGeometry);
    assertValidCachedGeometry('floppyBunnyEar', getFloppyBunnyEarGeometry);
  });

  it('3. merges repetitive multi-part details into single draw-call cached geometries', () => {
    assertValidCachedGeometry('sharkTeeth', getSharkTeethGeometry);
    assertValidCachedGeometry('sharkGills', getSharkGillsGeometry);
    assertValidCachedGeometry('catWhiskers', getCatWhiskersGeometry);
    assertValidCachedGeometry('catForeheadStripes', getCatForeheadStripesGeometry);
    assertValidCachedGeometry('pawPad', getPawPadGeometry);
    assertValidCachedGeometry('dinoClaws', getDinoClawsGeometry);
  });
});
