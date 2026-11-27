import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FighterInput } from '../../sim/types.ts';
import { BrawlInputRelay } from '../inputSync.ts';
import { BRAWL_INPUT_INTERVAL_MS } from '../protocol.ts';

function makeInput(overrides: Partial<FighterInput> = {}): FighterInput {
  return {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    jump: false,
    punch: false,
    headbutt: false,
    grabHeld: false,
    roll: false,
    emote: null,
    ...overrides,
  };
}

describe('BrawlInputRelay', () => {
  it('throttles continuous input to BRAWL_INPUT_INTERVAL_MS and deduplicates idle heartbeats to 2x interval', () => {
    const sent: Array<{ roundKey: string; seq: number; input: FighterInput }> = [];
    const relay = new BrawlInputRelay();

    const step = (roundKey: string, input: FighterInput, nowMs: number) => {
      const payload = relay.push('peer-g', roundKey, input, nowMs);
      if (payload) {
        sent.push({
          roundKey: payload.roundKey,
          seq: payload.seq,
          input: payload.input,
        });
      }
    };

    // First push sends immediately
    step('r1', makeInput({ moveX: 1 }), 1000);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].seq, 1);

    // Within throttle window -> suppressed even if movement changes
    step('r1', makeInput({ moveX: -1 }), 1000 + BRAWL_INPUT_INTERVAL_MS - 10);
    assert.equal(sent.length, 1);

    // At interval -> flushes latest pending input
    step('r1', makeInput({ moveX: -1 }), 1000 + BRAWL_INPUT_INTERVAL_MS);
    assert.equal(sent.length, 2);
    assert.equal(sent[1].input.moveX, -1);

    // Identical input after 1x interval -> deduplicated (no spam)
    step('r1', makeInput({ moveX: -1 }), 1000 + BRAWL_INPUT_INTERVAL_MS * 2 + 5);
    assert.equal(sent.length, 2);

    // Idle heartbeat flushes after 2x interval
    step('r1', makeInput({ moveX: -1 }), 1000 + BRAWL_INPUT_INTERVAL_MS * 3);
    assert.equal(sent.length, 3);
  });

  it('latches one-shot impulses across throttled frames and resets cleanly on roundKey change', () => {
    const relay = new BrawlInputRelay();

    const first = relay.push('peer-g', 'r1', makeInput(), 1000);
    assert.ok(first);

    // Impulse pressed during cooldown frame, followed by release frame before cooldown ends
    const ignored = relay.push(
      'peer-g',
      'r1',
      makeInput({ jump: true, punch: true, roll: true, emote: 'cheer' }),
      1020,
    );
    assert.equal(ignored, null);

    const releaseWhileWaiting = relay.push('peer-g', 'r1', makeInput(), 1040);
    assert.equal(releaseWhileWaiting, null);

    // When throttle window expires, latched impulses are preserved and sent
    const flushed = relay.push(
      'peer-g',
      'r1',
      makeInput({ moveZ: 1 }),
      1000 + BRAWL_INPUT_INTERVAL_MS,
    );
    assert.ok(flushed);
    assert.equal(flushed.input.jump, true);
    assert.equal(flushed.input.punch, true);
    assert.equal(flushed.input.roll, true);
    assert.equal(flushed.input.emote, 'cheer');
    assert.equal(flushed.input.moveZ, 1);

    // Next round immediately resets throttle/latches and preserves monotonic seq
    const round2 = relay.push(
      'peer-g',
      'r2',
      makeInput({ headbutt: true }),
      1000 + BRAWL_INPUT_INTERVAL_MS + 10,
    );
    assert.ok(round2);
    assert.equal(round2.roundKey, 'r2');
    assert.equal(round2.input.headbutt, true);
    assert.equal(round2.input.jump, false);
    assert.ok(round2.seq > flushed.seq);
  });
});
