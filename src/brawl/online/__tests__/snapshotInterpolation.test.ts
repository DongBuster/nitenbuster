import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAWL_INTERPOLATION_DELAY_MS,
  type BrawlSnapshotPayload,
} from '../protocol.ts';
import {
  BrawlSnapshotInterpolator,
  lerpBrawlAngle,
} from '../snapshotInterpolation.ts';

function makeSnapshot(
  tick: number,
  roundElapsedSec: number,
  overrides: Partial<BrawlSnapshotPayload> = {},
): BrawlSnapshotPayload {
  return {
    roundKey: 'evt-brawl-r1',
    tick,
    nowSec: roundElapsedSec,
    roundElapsedSec,
    fighters: [
      {
        id: 'p1',
        x: 0,
        y: 0.9,
        z: 0,
        yaw: 0,
        speedNorm: 0.5,
        walkPhase: 1,
        grounded: true,
        alive: true,
        balance: 100,
        maxBalance: 100,
        stunned: false,
        frozen: false,
        shielded: false,
        speedBoosted: false,
        heldItem: null,
        heldAmmo: 0,
        emote: null,
        action: 'idle',
        actionProgress: 0,
      },
    ],
    items: [],
    projectiles: [],
    koFeed: [],
    bannerText: null,
    ...overrides,
  };
}

describe('lerpBrawlAngle', () => {
  it('wraps shortest arc across +pi / -pi boundary', () => {
    const mid = lerpBrawlAngle(Math.PI - 0.1, -Math.PI + 0.3, 0.5);
    assert.ok(Math.abs(mid - (-Math.PI + 0.1)) < 1e-5);
  });
});

describe('BrawlSnapshotInterpolator', () => {
  it('interpolates fighter coordinates and yaw smoothly at now - delay', () => {
    assert.equal(BRAWL_INTERPOLATION_DELAY_MS, 70);
    const interp = new BrawlSnapshotInterpolator();

    const s1 = makeSnapshot(10, 1.0, {
      fighters: [
        {
          id: 'p1',
          x: -2,
          y: 1,
          z: 0,
          yaw: Math.PI - 0.1,
          speedNorm: 0.2,
          walkPhase: 1.0,
          grounded: true,
          alive: true,
          balance: 100,
          maxBalance: 100,
          stunned: false,
          frozen: false,
          shielded: false,
          speedBoosted: false,
          heldItem: null,
          heldAmmo: 0,
          emote: null,
          action: 'idle',
          actionProgress: 0,
        },
      ],
    });
    const s2 = makeSnapshot(12, 1.1, {
      fighters: [
        {
          id: 'p1',
          x: 2,
          y: 3,
          z: 4,
          yaw: -Math.PI + 0.3,
          speedNorm: 1.0,
          walkPhase: 2.0,
          grounded: false,
          alive: true,
          balance: 70,
          maxBalance: 100,
          stunned: true,
          frozen: false,
          shielded: false,
          speedBoosted: true,
          heldItem: 'sword',
          heldAmmo: 3,
          emote: 'cheer',
          action: 'punch_right',
          actionProgress: 0.6,
        },
      ],
    });

    interp.push(s1, 1000);
    interp.push(s2, 1100);

    // renderTime = 1120 - 70 = 1050 -> t = 0.5
    const mid = interp.sample(1120);
    assert.ok(mid);
    assert.equal(mid.fighters.length, 1);
    assert.ok(Math.abs(mid.fighters[0].x - 0) < 1e-6);
    assert.ok(Math.abs(mid.fighters[0].y - 2) < 1e-6);
    assert.ok(Math.abs(mid.fighters[0].z - 2) < 1e-6);
    assert.ok(Math.abs(mid.fighters[0].yaw - (-Math.PI + 0.1)) < 1e-5);
    assert.equal(mid.fighters[0].stunned, true);
    assert.equal(mid.fighters[0].heldItem, 'sword');
  });

  it('drops out-of-order ticks and clears cleanly on reset()', () => {
    const interp = new BrawlSnapshotInterpolator();
    interp.push(makeSnapshot(5, 0.5), 1000);
    interp.push(makeSnapshot(4, 0.4), 1050);
    assert.equal(interp.sample(1200)?.tick, 5);

    interp.reset();
    assert.equal(interp.sample(1200), null);
  });
});
