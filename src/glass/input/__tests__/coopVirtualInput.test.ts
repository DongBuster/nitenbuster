import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearAllVirtualInputs,
  getCombinedPressedState,
  readVirtualInput,
  setKeyboardPressedMirror,
  setVirtualHold,
  setVirtualMoveDpad,
  subscribePressedState,
  triggerVirtualPulse,
  type CoopPressedState,
} from '../coopVirtualInput.ts';

function resetBus(): void {
  clearAllVirtualInputs();
  setKeyboardPressedMirror({
    liftUp: false,
    liftDown: false,
    jump: false,
    moveLeft: false,
    moveRight: false,
    moveForward: false,
    moveBackward: false,
  });
}

describe('coopVirtualInput bus', () => {
  it('merges virtual holds into PlayerInput with right-handed +X left / -X right convention', () => {
    resetBus();
    setVirtualHold('liftUp', true);
    setVirtualHold('moveLeft', true);
    const snap = readVirtualInput(1000);
    assert.equal(snap.lift, 1);
    assert.equal(snap.moveX, 1);
    assert.equal(snap.jump, false);

    setVirtualHold('moveLeft', false);
    setVirtualHold('moveRight', true);
    setVirtualHold('liftUp', false);
    setVirtualHold('liftDown', true);
    const snap2 = readVirtualInput(1010);
    assert.equal(snap2.lift, -1);
    assert.equal(snap2.moveX, -1);

    // Opposite holds cancel cleanly
    setVirtualHold('liftUp', true);
    setVirtualHold('moveLeft', true);
    const canceled = readVirtualInput(1020);
    assert.equal(canceled.lift, 0);
    assert.equal(canceled.moveX, 0);
  });

  it('activates virtual pulses for the pulse window and expires automatically', () => {
    resetBus();
    triggerVirtualPulse('jump', 140, 2000);
    assert.equal(readVirtualInput(2050).jump, true);
    assert.equal(getCombinedPressedState(2050).jump, true);

    assert.equal(readVirtualInput(2150).jump, false);
    assert.equal(getCombinedPressedState(2150).jump, false);
  });

  it('notifies subscribers only when combined pressed state changes', () => {
    resetBus();
    const snapshots: CoopPressedState[] = [];
    const unsubscribe = subscribePressedState((next) => {
      snapshots.push({ ...next });
    });

    setKeyboardPressedMirror({
      liftUp: true,
      liftDown: false,
      jump: false,
      moveLeft: false,
      moveRight: false,
      moveForward: false,
      moveBackward: false,
    });
    // Identical update should NOT fire a duplicate notification
    setKeyboardPressedMirror({
      liftUp: true,
      liftDown: false,
      jump: false,
      moveLeft: false,
      moveRight: false,
      moveForward: false,
      moveBackward: false,
    });
    setVirtualHold('jump', true);
    clearAllVirtualInputs();

    unsubscribe();

    assert.equal(snapshots.length, 3);
    assert.equal(snapshots[0]?.liftUp, true);
    assert.equal(snapshots[1]?.jump, true);
    assert.equal(snapshots[2]?.jump, false);
    assert.equal(snapshots[2]?.liftUp, true);
  });

  it('maps D-pad forward/backward/left/right into moveZ (+1/-1) and moveX (+1/-1)', () => {
    resetBus();
    setVirtualMoveDpad({ up: true, down: false, left: true, right: false });
    const diag = readVirtualInput(3000);
    assert.equal(diag.moveZ, 1);
    assert.equal(diag.moveX, 1);

    setVirtualMoveDpad({ up: false, down: true, left: false, right: true });
    const backRight = readVirtualInput(3010);
    assert.equal(backRight.moveZ, -1);
    assert.equal(backRight.moveX, -1);

    setVirtualMoveDpad({ up: false, down: false, left: false, right: false });
    const idle = readVirtualInput(3020);
    assert.equal(idle.moveZ, 0);
    assert.equal(idle.moveX, 0);
  });
});
