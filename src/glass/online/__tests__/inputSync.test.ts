import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PlayerInput } from '../../sim/types.ts';
import { GlassInputRelay } from '../inputSync.ts';
import { GLASS_INPUT_INTERVAL_MS } from '../protocol.ts';

function makeInput(overrides: Partial<PlayerInput> = {}): PlayerInput {
  return {
    moveX: 0,
    moveZ: 0,
    jump: false,
    lift: 0,
    ...overrides,
  };
}

describe('GlassInputRelay', () => {
  it('latches jump and lift impulses across throttled intervals and deduplicates idle heartbeats', () => {
    const relay = new GlassInputRelay();

    const first = relay.evaluate('m1', makeInput({ moveZ: 1 }), 1000);
    assert.equal(first.action, 'send');
    assert.equal(first.seq, 1);

    // Within cooldown: press jump + lift=-1, then release -> should latch into pending
    const wait1 = relay.evaluate(
      'm1',
      makeInput({ moveZ: 1, jump: true, lift: -1 }),
      1020,
    );
    assert.equal(wait1.action, 'defer');
    assert.equal(wait1.pending?.jump, true);
    assert.equal(wait1.pending?.lift, -1);

    const wait2 = relay.evaluate('m1', makeInput({ moveZ: 1 }), 1040);
    assert.equal(wait2.action, 'defer');
    assert.equal(wait2.pending?.jump, true);
    assert.equal(wait2.pending?.lift, -1);

    // After interval: flushes merged latched input
    const flush = relay.evaluate(
      'm1',
      makeInput({ moveX: 0.5, moveZ: 1 }),
      1000 + GLASS_INPUT_INTERVAL_MS,
    );
    assert.equal(flush.action, 'send');
    assert.equal(flush.input?.jump, true);
    assert.equal(flush.input?.lift, -1);
    assert.equal(flush.input?.moveX, 0.5);
    assert.equal(flush.input?.moveZ, 1);

    // Identical input after 1x interval -> deferred to 2x heartbeat
    const idleEarly = relay.evaluate(
      'm1',
      flush.input!,
      1000 + GLASS_INPUT_INTERVAL_MS * 2 + 5,
    );
    assert.equal(idleEarly.action, 'defer');

    const heartbeat = relay.evaluate(
      'm1',
      flush.input!,
      1000 + GLASS_INPUT_INTERVAL_MS * 3,
    );
    assert.equal(heartbeat.action, 'send');

    // Match switch clears stale latches cleanly
    relay.evaluate('m1', makeInput({ jump: true }), 1000 + GLASS_INPUT_INTERVAL_MS * 3 + 10);
    const nextMatch = relay.evaluate(
      'm2',
      makeInput(),
      1000 + GLASS_INPUT_INTERVAL_MS * 3 + 20,
    );
    assert.equal(nextMatch.action, 'send');
    assert.equal(nextMatch.input?.jump, false);
  });
});
