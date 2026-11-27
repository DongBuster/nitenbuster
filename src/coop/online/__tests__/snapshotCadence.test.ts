import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GLASS_SNAPSHOT_INTERVAL_MS } from '../../../glass/online/protocol.ts';
import { CoopSnapshotPacer } from '../snapshotCadence.ts';

describe('CoopSnapshotPacer', () => {
  it('batches non-critical frame events into regular snapshot cadence without bursting above rate limit', () => {
    const pacer = new CoopSnapshotPacer<{ id: number; kind: string }>();

    // Regular start frame sends immediately if interval already elapsed
    const t0 = pacer.step(1000, [{ id: 1, kind: 'paddle_p1' }], false, (e) => e.kind === 'checkpoint');
    assert.equal(t0.shouldBroadcast, true);
    assert.equal(t0.events.length, 1);

    // Rapid follow-up frames at 1016ms, 1033ms, 1050ms with non-critical events get queued, NOT immediately broadcast
    const f1 = pacer.step(1016, [{ id: 2, kind: 'paddle_p2' }], false, (e) => e.kind === 'checkpoint');
    const f2 = pacer.step(1033, [{ id: 3, kind: 'glass_crack' }], false, (e) => e.kind === 'checkpoint');
    assert.equal(f1.shouldBroadcast, false);
    assert.equal(f2.shouldBroadcast, false);

    // When interval (67ms) elapses at 1067ms, all queued events drain together in one snapshot
    const f3 = pacer.step(1067, [{ id: 4, kind: 'cart_pump' }], false, (e) => e.kind === 'checkpoint');
    assert.equal(f3.shouldBroadcast, true);
    assert.deepEqual(
      f3.events.map((e) => e.id),
      [2, 3, 4],
    );
  });

  it('fast-flushes critical events with burst protection and always flushes justFinished immediately', () => {
    const pacer = new CoopSnapshotPacer<{ id: number; kind: string }>();
    const isCritical = (e: { kind: string }) => e.kind === 'checkpoint' || e.kind === 'shatter';

    pacer.step(1000, [], false, isCritical);

    // Immediate burst 5ms later with critical event respects min critical spacing
    const tooSoon = pacer.step(1005, [{ id: 10, kind: 'shatter' }], false, isCritical);
    assert.equal(tooSoon.shouldBroadcast, false);

    // At 1035ms (>= half interval) critical event flushes early with queued critical event
    const fast = pacer.step(1035, [], false, isCritical);
    assert.equal(fast.shouldBroadcast, true);
    assert.deepEqual(
      fast.events.map((e) => e.id),
      [10],
    );

    // justFinished always flushes immediately regardless of last send time
    const finish = pacer.step(1038, [{ id: 11, kind: 'checkpoint' }], true, isCritical);
    assert.equal(finish.shouldBroadcast, true);
    assert.deepEqual(
      finish.events.map((e) => e.id),
      [11],
    );

    // Normal interval still bounded by GLASS_SNAPSHOT_INTERVAL_MS
    assert.equal(pacer.step(1038 + GLASS_SNAPSHOT_INTERVAL_MS - 1, [], false, isCritical).shouldBroadcast, false);
    assert.equal(pacer.step(1038 + GLASS_SNAPSHOT_INTERVAL_MS, [], false, isCritical).shouldBroadcast, true);
  });
});
