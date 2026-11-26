import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIXED_DT,
  GLASS_SAFE_MAX_DIST,
  GLASS_SAFE_MIN_DIST,
} from '../constants.ts';
import {
  computeSoloStabilizerInput,
  createInitialSimState,
  stepGlassSim,
} from '../physics.ts';

describe('computeSoloStabilizerInput (Solo Auto-Balance)', () => {
  it('keeps glass spacing safe and mirrors lift/jump as P1 walks forward', () => {
    let state = createInitialSimState();
    state = { ...state, phase: 'playing' };

    for (let i = 0; i < 90; i++) {
      const p1Input = {
        moveX: 0,
        moveZ: 1,
        jump: i === 20,
        lift: (i > 40 ? 1 : 0) as -1 | 0 | 1,
      };
      const p2Input = computeSoloStabilizerInput(state, p1Input);
      state = stepGlassSim(state, p1Input, p2Input, FIXED_DT);
    }

    assert.equal(state.shatters, 0);
    assert.ok(state.p1.z > 5, `Expected P1 to advance, got z=${state.p1.z}`);
    assert.ok(
      state.glass.length >= GLASS_SAFE_MIN_DIST &&
        state.glass.length <= GLASS_SAFE_MAX_DIST,
      `Expected safe glass length, got ${state.glass.length}`,
    );
    assert.ok(
      Math.abs(state.p1.liftOffset - state.p2.liftOffset) < 0.15,
      'Expected synchronized lift offset',
    );
  });

  it('pulls stabilizer back toward safe offset if displaced laterally', () => {
    const base = createInitialSimState();
    const stretched = {
      ...base,
      phase: 'playing' as const,
      p1: { ...base.p1, x: -2.0, z: 4.0 },
      p2: { ...base.p2, x: 2.4, z: 2.0 },
    };

    const p2Input = computeSoloStabilizerInput(stretched, {
      moveX: 0,
      moveZ: 0,
      jump: false,
      lift: -1,
    });

    assert.ok(p2Input.moveX < 0, 'Expected stabilizer to steer left toward P1 + rest offset');
    assert.ok(p2Input.moveZ > 0, 'Expected stabilizer to catch up forward along Z');
    assert.equal(p2Input.lift, -1);
  });
});
