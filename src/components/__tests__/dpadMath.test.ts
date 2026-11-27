import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDpadStateFromOffset,
  dpadDirectionsToVector,
} from '../dpadMath.ts';

describe('TouchDpad math', () => {
  it('returns neutral inside deadzone', () => {
    const state = computeDpadStateFromOffset(4, -5);
    assert.deepEqual(state, { up: false, down: false, left: false, right: false });
    assert.deepEqual(dpadDirectionsToVector(state), { x: 0, y: 0 });
  });

  it('detects cardinal directions cleanly', () => {
    assert.deepEqual(computeDpadStateFromOffset(0, -45), {
      up: true,
      down: false,
      left: false,
      right: false,
    });
    assert.deepEqual(computeDpadStateFromOffset(10, 45), {
      up: false,
      down: true,
      left: false,
      right: false,
    });
    assert.deepEqual(computeDpadStateFromOffset(-45, 5), {
      up: false,
      down: false,
      left: true,
      right: false,
    });
    assert.deepEqual(computeDpadStateFromOffset(45, -5), {
      up: false,
      down: false,
      left: false,
      right: true,
    });
  });

  it('detects diagonal directions and normalizes vector length to 1', () => {
    const state = computeDpadStateFromOffset(36, -36);
    assert.deepEqual(state, {
      up: true,
      down: false,
      left: false,
      right: true,
    });
    const vec = dpadDirectionsToVector(state);
    assert.ok(Math.abs(Math.hypot(vec.x, vec.y) - 1) < 1e-6);
    assert.ok(vec.x > 0 && vec.y < 0);
  });
});
