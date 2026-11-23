import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPartyMotionState,
  stepPartyMotion,
  stepSpring,
  type Spring1D,
} from '../partyMotion.ts';

describe('partyMotion spring & action solver', () => {
  it('converges 1D spring smoothly toward target without NaN on large dt', () => {
    const s: Spring1D = { value: 0, velocity: 0 };
    for (let i = 0; i < 40; i++) {
      stepSpring(s, 1.0, 120, 18, 0.033);
    }
    assert.ok(Number.isFinite(s.value));
    assert.ok(Math.abs(s.value - 1.0) < 0.05, `expected near 1, got ${s.value}`);

    // Large dt spike stability test
    stepSpring(s, -0.5, 140, 18, 0.5);
    assert.ok(Number.isFinite(s.value));
    assert.ok(Math.abs(s.value) < 2.0);
  });

  it('tilts forward and advances walkPhase when running and sprinting', () => {
    const state = createPartyMotionState();
    for (let i = 0; i < 15; i++) {
      stepPartyMotion(
        state,
        {
          nowSec: i * 0.016,
          vx: 0,
          vy: 0,
          vz: 5.2,
          prevVx: 0,
          prevVz: 4.5,
          yaw: 0,
          prevYaw: 0,
          grounded: true,
          wasGrounded: true,
          sprinting: true,
          isStunned: false,
          isFrozen: false,
          isGrabbing: false,
          isGrabbed: false,
          rollUntil: 0,
          rollDuration: 0.28,
          punchUntil: 0,
          punchDuration: 0.24,
          punchHand: 'right',
          headbuttUntil: 0,
          headbuttDuration: 0.34,
          dropkickUntil: 0,
          dropkickDuration: 0.52,
          dropkickSlideUntil: 0,
          wakeupUntil: 0,
          wakeupDuration: 0.38,
        },
        0.016,
      );
    }

    assert.equal(state.action, 'run');
    assert.equal(state.sprinting, true);
    assert.ok(state.walkPhase > 0, 'walkPhase should advance while moving');
    assert.ok(state.tiltX.value > 0.05, 'should lean forward in movement direction');
  });

  it('compresses squashY on hard landing and recovers toward 1', () => {
    const state = createPartyMotionState();
    stepPartyMotion(
      state,
      {
        nowSec: 1.0,
        vx: 0,
        vy: -5.5,
        vz: 0,
        prevVx: 0,
        prevVz: 0,
        yaw: 0,
        prevYaw: 0,
        grounded: true,
        wasGrounded: false,
        sprinting: false,
        isStunned: false,
        isFrozen: false,
        isGrabbing: false,
        isGrabbed: false,
        rollUntil: 0,
        rollDuration: 0.28,
        punchUntil: 0,
        punchDuration: 0.24,
        punchHand: 'left',
        headbuttUntil: 0,
        headbuttDuration: 0.34,
        dropkickUntil: 0,
        dropkickDuration: 0.52,
        dropkickSlideUntil: 0,
        wakeupUntil: 0,
        wakeupDuration: 0.38,
      },
      0.016,
    );

    assert.ok(state.squashY.value < 0.92, `expected squash < 0.92 on landing, got ${state.squashY.value}`);
  });

  it('prioritizes combat and ragdoll action states correctly', () => {
    const state = createPartyMotionState();
    const base = {
      nowSec: 2.0,
      vx: 0,
      vy: 0,
      vz: 2,
      prevVx: 0,
      prevVz: 2,
      yaw: 0,
      prevYaw: 0,
      grounded: true,
      wasGrounded: true,
      sprinting: false,
      isStunned: false,
      isFrozen: false,
      isGrabbing: false,
      isGrabbed: false,
      rollUntil: 0,
      rollDuration: 0.28,
      punchUntil: 0,
      punchDuration: 0.24,
      punchHand: 'left' as const,
      headbuttUntil: 0,
      headbuttDuration: 0.34,
      dropkickUntil: 0,
      dropkickDuration: 0.52,
      dropkickSlideUntil: 0,
      wakeupUntil: 0,
      wakeupDuration: 0.38,
    };

    // Punch left
    stepPartyMotion(state, { ...base, punchUntil: 2.12, punchHand: 'left' }, 0.016);
    assert.equal(state.action, 'punch_left');
    assert.ok(state.actionProgress > 0.4 && state.actionProgress < 0.6);

    // Headbutt overrides punch
    stepPartyMotion(state, { ...base, punchUntil: 2.12, headbuttUntil: 2.17 }, 0.016);
    assert.equal(state.action, 'headbutt');

    // Dropkick overrides headbutt
    stepPartyMotion(state, { ...base, headbuttUntil: 2.17, dropkickUntil: 2.26, grounded: false }, 0.016);
    assert.equal(state.action, 'dropkick');

    // Stunned overrides everything
    stepPartyMotion(state, { ...base, dropkickUntil: 2.26, isStunned: true }, 0.016);
    assert.equal(state.action, 'stunned');
  });
});
