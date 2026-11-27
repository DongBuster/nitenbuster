import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialSimState } from '../../sim/physics.ts';
import type { GlassSimState } from '../../sim/types.ts';
import {
  GLASS_INTERPOLATION_DELAY_MS,
  packSimSnapshot,
  sortGlassRoomMembers,
  type GlassRoomMember,
  type GlassSnapshotPayload,
} from '../protocol.ts';
import { SnapshotInterpolator, lerpAngle } from '../snapshotInterpolation.ts';

function assertClose(actual: number, expected: number, eps = 1e-6): void {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `Expected ${actual} to be within ${eps} of ${expected}`,
  );
}

function makeSnapshot(
  tick: number,
  matchTime: number,
  overrides: {
    p1?: Partial<GlassSnapshotPayload['p1']>;
    p2?: Partial<GlassSnapshotPayload['p2']>;
    glass?: Partial<GlassSnapshotPayload['glass']>;
    phase?: GlassSnapshotPayload['phase'];
    checkpointIndex?: number;
    shatters?: number;
    events?: GlassSnapshotPayload['events'];
    matchId?: string;
  } = {},
): GlassSnapshotPayload {
  return {
    matchId: overrides.matchId ?? 'match-1',
    tick,
    matchTime,
    phase: overrides.phase ?? 'playing',
    checkpointIndex: overrides.checkpointIndex ?? 0,
    shatters: overrides.shatters ?? 0,
    p1: {
      x: -1.6,
      y: 0,
      z: 2,
      vx: 0,
      vy: 0,
      vz: 1,
      yaw: 0,
      grounded: true,
      liftOffset: 0,
      onIce: false,
      inWind: false,
      ...overrides.p1,
    },
    p2: {
      x: 1.6,
      y: 0,
      z: 2,
      vx: 0,
      vy: 0,
      vz: 1,
      yaw: 0,
      grounded: true,
      liftOffset: 0,
      onIce: false,
      inWind: false,
      ...overrides.p2,
    },
    glass: {
      hp: 3,
      stress: 0,
      centerX: 0,
      centerY: 0.95,
      centerZ: 2,
      yaw: 0,
      pitch: 0,
      length: 3.2,
      invulnTimer: 0,
      shatterTimer: 0,
      shatterReason: null,
      lastImpactX: 0,
      lastImpactY: 0,
      lastImpactZ: 0,
      ...overrides.glass,
    },
    events: overrides.events ?? [],
  };
}

describe('lerpAngle', () => {
  it('interpolates standard angles and endpoints cleanly', () => {
    assertClose(lerpAngle(0, 1, 0), 0);
    assertClose(lerpAngle(0, 1, 0.5), 0.5);
    assertClose(lerpAngle(0, 1, 1), 1);
  });

  it('wraps shortest arc from +pi side across boundary to -pi side', () => {
    const a = Math.PI - 0.1;
    const b = -Math.PI + 0.3; // shortest delta is +0.4 rad across +pi/-pi
    const mid = lerpAngle(a, b, 0.5);
    assertClose(mid, -Math.PI + 0.1, 1e-5);

    const symMid = lerpAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
    assertClose(Math.abs(symMid), Math.PI, 1e-5);
  });

  it('wraps shortest arc from -pi side across boundary to +pi side', () => {
    const a = -Math.PI + 0.1;
    const b = Math.PI - 0.3; // shortest delta is -0.4 rad across -pi/+pi
    const mid = lerpAngle(a, b, 0.5);
    assertClose(mid, Math.PI - 0.1, 1e-5);
  });
});

describe('packSimSnapshot', () => {
  it('rounds floats to 2 decimal places while preserving exact discrete fields and events', () => {
    const base: GlassSimState = createInitialSimState();
    const state: GlassSimState = {
      ...base,
      phase: 'playing',
      tick: 42,
      matchTime: 12.3456,
      checkpointIndex: 2,
      shatters: 3,
      p1: {
        ...base.p1,
        x: -1.2345,
        y: -0.001,
        z: 35.6789,
        vx: 1.999,
        vy: -2.344,
        vz: 4.566,
        yaw: 1.574,
        grounded: false,
        liftOffset: 0.849,
        onIce: true,
        inWind: true,
      },
      p2: {
        ...base.p2,
        x: 1.876,
        y: 0.124,
        z: 36.112,
        vx: -0.556,
        vy: 0.444,
        vz: 3.333,
        yaw: -3.139,
        grounded: true,
        liftOffset: -0.546,
        onIce: false,
        inWind: true,
      },
      glass: {
        ...base.glass,
        hp: 2,
        stress: 0.4567,
        centerX: 0.321,
        centerY: 1.119,
        centerZ: 35.895,
        yaw: -0.7854,
        pitch: 0.129,
        length: 3.418,
        invulnTimer: 0.694,
        shatterTimer: 1.196,
        shatterReason: 'impact',
        lastImpactX: 0.116,
        lastImpactY: 1.224,
        lastImpactZ: 35.999,
      },
      events: [
        {
          id: 9,
          kind: 'glass_crack',
          x: 0.116,
          y: 1.224,
          z: 35.999,
          reason: 'impact',
        },
      ],
    };

    const packed = packSimSnapshot('match-42', state);

    assert.equal(packed.matchId, 'match-42');
    assert.equal(packed.tick, 42);
    assert.equal(packed.matchTime, 12.35);
    assert.equal(packed.phase, 'playing');
    assert.equal(packed.checkpointIndex, 2);
    assert.equal(packed.shatters, 3);

    assert.equal(packed.p1.x, -1.23);
    assert.equal(Object.is(packed.p1.y, -0), false);
    assert.equal(packed.p1.y, 0);
    assert.equal(packed.p1.z, 35.68);
    assert.equal(packed.p1.vx, 2);
    assert.equal(packed.p1.vy, -2.34);
    assert.equal(packed.p1.vz, 4.57);
    assert.equal(packed.p1.yaw, 1.57);
    assert.equal(packed.p1.grounded, false);
    assert.equal(packed.p1.liftOffset, 0.85);
    assert.equal(packed.p1.onIce, true);
    assert.equal(packed.p1.inWind, true);

    assert.equal(packed.p2.x, 1.88);
    assert.equal(packed.p2.liftOffset, -0.55);

    assert.equal(packed.glass.hp, 2);
    assert.equal(packed.glass.stress, 0.46);
    assert.equal(packed.glass.centerX, 0.32);
    assert.equal(packed.glass.centerY, 1.12);
    assert.equal(packed.glass.centerZ, 35.9);
    assert.equal(packed.glass.yaw, -0.79);
    assert.equal(packed.glass.pitch, 0.13);
    assert.equal(packed.glass.length, 3.42);
    assert.equal(packed.glass.invulnTimer, 0.69);
    assert.equal(packed.glass.shatterTimer, 1.2);
    assert.equal(packed.glass.shatterReason, 'impact');
    assert.equal(packed.glass.lastImpactX, 0.12);
    assert.equal(packed.glass.lastImpactY, 1.22);
    assert.equal(packed.glass.lastImpactZ, 36);

    assert.deepEqual(packed.events, state.events);
  });
});

describe('SnapshotInterpolator', () => {
  it('returns null when empty and exact snapshot when only 1 entry exists', () => {
    const interp = new SnapshotInterpolator();
    assert.equal(interp.sample(1000), null);

    const s1 = makeSnapshot(1, 0.5, {
      p1: { x: -2, z: 4 },
      events: [{ id: 1, kind: 'checkpoint', x: 0, y: 1, z: 28, checkpointIndex: 1 }],
    });
    interp.push(s1, 1000);

    assert.deepEqual(interp.sample(1000), s1);
    assert.deepEqual(interp.sample(1500), s1);
  });

  it('interpolates midpoint smoothly at now - 120ms including shortest-arc yaw and upper discrete fields', () => {
    assert.equal(GLASS_INTERPOLATION_DELAY_MS, 120);

    const interp = new SnapshotInterpolator();
    const s1 = makeSnapshot(10, 1.0, {
      checkpointIndex: 0,
      shatters: 0,
      p1: {
        x: -2,
        y: 0,
        z: 10,
        vx: 0,
        vy: 0,
        vz: 2,
        yaw: Math.PI - 0.1,
        grounded: true,
        liftOffset: 0,
        onIce: false,
        inWind: false,
      },
      p2: {
        x: 2,
        y: 1,
        z: 10,
        vx: 1,
        vy: 2,
        vz: 2,
        yaw: -Math.PI + 0.1,
        grounded: false,
        liftOffset: 0.4,
        onIce: false,
        inWind: false,
      },
      glass: {
        hp: 3,
        stress: 0.2,
        centerX: 0,
        centerY: 1,
        centerZ: 10,
        yaw: Math.PI - 0.1,
        pitch: 0.1,
        length: 4.0,
      },
      events: [{ id: 1, kind: 'glass_crack', x: 0, y: 1, z: 9 }],
    });

    const s2 = makeSnapshot(14, 1.1, {
      checkpointIndex: 1,
      shatters: 1,
      phase: 'finished',
      p1: {
        x: -1,
        y: 2,
        z: 14,
        vx: 2,
        vy: 4,
        vz: 4,
        yaw: -Math.PI + 0.3,
        grounded: false,
        liftOffset: 0.8,
        onIce: true,
        inWind: true,
      },
      p2: {
        x: 3,
        y: 3,
        z: 14,
        vx: 3,
        vy: 0,
        vz: 4,
        yaw: Math.PI - 0.3,
        grounded: true,
        liftOffset: -0.4,
        onIce: true,
        inWind: true,
      },
      glass: {
        hp: 2,
        stress: 0.8,
        centerX: 1,
        centerY: 2,
        centerZ: 14,
        yaw: -Math.PI + 0.3,
        pitch: 0.3,
        length: 3.0,
        invulnTimer: 0.7,
        shatterTimer: 1.2,
        shatterReason: 'stretch',
        lastImpactX: 0.5,
        lastImpactY: 1.5,
        lastImpactZ: 13.5,
      },
      events: [{ id: 2, kind: 'checkpoint', x: 0.5, y: 1.5, z: 28, checkpointIndex: 1 }],
    });

    interp.push(s1, 1000);
    interp.push(s2, 1100);

    // Before earliest snapshot -> exact s1
    assert.deepEqual(interp.sample(1050), s1);

    // Midpoint: renderTime = 1170 - 120 = 1050 -> t = 0.5 between 1000 and 1100
    const mid = interp.sample(1170);
    assert.ok(mid);
    assertClose(mid.matchTime, 1.05);
    assertClose(mid.p1.x, -1.5);
    assertClose(mid.p1.y, 1);
    assertClose(mid.p1.z, 12);
    assertClose(mid.p1.vx, 1);
    assertClose(mid.p1.vy, 2);
    assertClose(mid.p1.vz, 3);
    assertClose(mid.p1.liftOffset, 0.4);
    assertClose(mid.p1.yaw, -Math.PI + 0.1, 1e-5);

    assertClose(mid.p2.x, 2.5);
    assertClose(mid.p2.y, 2);
    assertClose(mid.p2.z, 12);
    assertClose(mid.p2.liftOffset, 0);
    assertClose(mid.p2.yaw, Math.PI - 0.1, 1e-5);

    assertClose(mid.glass.centerX, 0.5);
    assertClose(mid.glass.centerY, 1.5);
    assertClose(mid.glass.centerZ, 12);
    assertClose(mid.glass.stress, 0.5);
    assertClose(mid.glass.pitch, 0.2);
    assertClose(mid.glass.length, 3.5);
    assertClose(mid.glass.yaw, -Math.PI + 0.1, 1e-5);

    // Discrete fields and events come from upper bracket without duplicating s1 events
    assert.equal(mid.phase, 'finished');
    assert.equal(mid.checkpointIndex, 1);
    assert.equal(mid.shatters, 1);
    assert.equal(mid.p1.grounded, false);
    assert.equal(mid.p1.onIce, true);
    assert.equal(mid.p1.inWind, true);
    assert.equal(mid.glass.hp, 2);
    assert.equal(mid.glass.shatterTimer, 1.2);
    assert.equal(mid.glass.shatterReason, 'stretch');
    assert.deepEqual(mid.events, s2.events);

    // After latest snapshot -> exact s2 (renderTime = 1130 >= 1100)
    assert.deepEqual(interp.sample(1250), s2);
  });

  it('drops out-of-order/duplicate ticks, caps buffer to 8 entries, and clears on reset()', () => {
    const interp = new SnapshotInterpolator();
    interp.push(makeSnapshot(10, 1.0, { p1: { z: 10 } }), 1000);
    interp.push(makeSnapshot(9, 0.9, { p1: { z: 99 } }), 1050); // out-of-order dropped
    interp.push(makeSnapshot(10, 1.0, { p1: { z: 88 } }), 1060); // duplicate tick dropped

    assert.equal(interp.sample(1200)?.p1.z, 10);

    // Push 8 newer ticks (total 9 valid pushes -> oldest tick 10 should be evicted)
    for (let tick = 20; tick <= 90; tick += 10) {
      interp.push(
        makeSnapshot(tick, tick / 10, { p1: { z: tick } }),
        1000 + (tick - 10) * 10,
      );
    }

    // Buffer now starts at tick 20 (receivedAt 1100), so renderTime = 1050 clamps to z = 20
    assert.equal(interp.sample(1170)?.p1.z, 20);

    // Reset clears buffer and allows low tick numbers again
    interp.reset();
    assert.equal(interp.sample(1500), null);

    interp.push(makeSnapshot(1, 0.1, { p1: { z: 1.5 } }), 2000);
    assert.equal(interp.sample(2100)?.p1.z, 1.5);
  });

  it('sorts glass room members with explicit isHost priority ahead of clock-skewed joinedAt', () => {
    const makeMember = (
      peerId: string,
      joinedAt: number,
      isHost?: boolean,
    ): GlassRoomMember => ({
      peerId,
      name: peerId,
      animal: 'dog',
      accessory: [],
      ready: true,
      joinedAt,
      ...(isHost !== undefined ? { isHost } : {}),
    });

    const sorted = sortGlassRoomMembers([
      makeMember('guest-skew', 50, false),
      makeMember('host-creator', 500, true),
    ]);
    assert.equal(sorted[0].peerId, 'host-creator');
    assert.equal(sorted[1].peerId, 'guest-skew');

    const fallbackSorted = sortGlassRoomMembers([
      makeMember('b', 100),
      makeMember('a', 100),
    ]);
    assert.equal(fallbackSorted[0].peerId, 'a');
  });
});
