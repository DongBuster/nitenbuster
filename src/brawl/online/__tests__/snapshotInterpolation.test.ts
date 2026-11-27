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
    assert.equal(BRAWL_INTERPOLATION_DELAY_MS, 110);
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

    // renderTime = 1160 - 110 = 1050 -> t = 0.5
    const mid = interp.sample(1160);
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

  it('auto-resets on roundKey switch even when tick resets, caps buffer at 8, and avoids backward actionProgress lerp', () => {
    const interp = new BrawlSnapshotInterpolator();

    // Round 1 late tick 500 -> switches to Round 2 tick 2 (must NOT stay stuck on tick 500)
    interp.push(
      makeSnapshot(500, 25, {
        roundKey: 'brawl_online_ROOM_m1_r1',
        fighters: [
          {
            ...makeSnapshot(500, 25).fighters[0],
            action: 'idle',
            actionProgress: 0.9,
            x: -5,
          },
        ],
      }),
      1000,
    );
    interp.push(
      makeSnapshot(2, 0.1, {
        roundKey: 'brawl_online_ROOM_m1_r2',
        fighters: [
          {
            ...makeSnapshot(2, 0.1).fighters[0],
            action: 'punch_right',
            actionProgress: 0.15,
            x: 3,
          },
        ],
      }),
      1060,
    );

    const switched = interp.sample(1200);
    assert.ok(switched);
    assert.equal(switched.roundKey, 'brawl_online_ROOM_m1_r2');
    assert.equal(switched.tick, 2);

    // When fighter action changes between bracket A and B, actionProgress comes from B rather than lerping backwards
    const actionInterp = new BrawlSnapshotInterpolator();
    actionInterp.push(
      makeSnapshot(10, 1.0, {
        fighters: [
          {
            ...makeSnapshot(10, 1.0).fighters[0],
            action: 'idle',
            actionProgress: 0.9,
          },
        ],
      }),
      1000,
    );
    actionInterp.push(
      makeSnapshot(11, 1.1, {
        fighters: [
          {
            ...makeSnapshot(11, 1.1).fighters[0],
            action: 'punch_right',
            actionProgress: 0.2,
          },
        ],
      }),
      1100,
    );
    const actionMid = actionInterp.sample(1160); // renderTime = 1050 -> t = 0.5
    assert.ok(actionMid);
    assert.equal(actionMid.fighters[0].action, 'punch_right');
    assert.equal(actionMid.fighters[0].actionProgress, 0.2);

    // Buffer capacity is 8 entries: pushing 9 ticks evicts tick 1 and retains tick 2..9
    const capInterp = new BrawlSnapshotInterpolator();
    for (let i = 1; i <= 9; i++) {
      capInterp.push(makeSnapshot(i * 10, i, { fighters: [{ ...makeSnapshot(i, i).fighters[0], x: i * 10 }] }), 1000 + (i - 1) * 100);
    }
    const oldest = capInterp.sample(1000 + BRAWL_INTERPOLATION_DELAY_MS);
    assert.ok(oldest);
    assert.equal(oldest.tick, 20);
  });
});
