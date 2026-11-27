import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GLASS_INTERPOLATION_DELAY_MS } from '../../../glass/online/protocol.ts';
import type { MinecartSnapshotPayload } from '../../maps/minecart/types.ts';
import type { RaftSnapshotPayload } from '../../maps/raft/types.ts';
import type { RopeSnapshotPayload } from '../../maps/rope/types.ts';
import { CoopSnapshotInterpolator } from '../coopInterpolation.ts';

function assertClose(actual: number, expected: number, eps = 1e-6): void {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `Expected ${actual} to be within ${eps} of ${expected}`,
  );
}

function makeRaftSnapshot(
  tick: number,
  matchTime: number,
  overrides: {
    matchId?: string;
    phase?: RaftSnapshotPayload['phase'];
    checkpointIndex?: number;
    failures?: number;
    raft?: Partial<RaftSnapshotPayload['raft']>;
    events?: RaftSnapshotPayload['events'];
  } = {},
): RaftSnapshotPayload {
  return {
    mapId: 'raft_rapids',
    matchId: overrides.matchId ?? 'raft-match-1',
    tick,
    matchTime,
    phase: overrides.phase ?? 'playing',
    checkpointIndex: overrides.checkpointIndex ?? 0,
    failures: overrides.failures ?? 0,
    raft: {
      x: 0,
      y: 0,
      z: 4,
      vx: 0,
      vy: 0,
      vz: 2,
      yaw: 0,
      hp: 3,
      invulnTimer: 0,
      respawnTimer: 0,
      boostTimer: 0,
      p1StrokeAnim: 0,
      p2StrokeAnim: 0,
      p1LeanX: 0,
      p2LeanX: 0,
      inWhirlpool: false,
      ...overrides.raft,
    },
    events: overrides.events ?? [],
  };
}

function makeRopeSnapshot(
  tick: number,
  matchTime: number,
  overrides: {
    matchId?: string;
    phase?: RopeSnapshotPayload['phase'];
    checkpointIndex?: number;
    failures?: number;
    p1?: Partial<RopeSnapshotPayload['p1']>;
    p2?: Partial<RopeSnapshotPayload['p2']>;
    ropeLength?: number;
    ropeStrain?: number;
    respawnTimer?: number;
    events?: RopeSnapshotPayload['events'];
  } = {},
): RopeSnapshotPayload {
  return {
    mapId: 'rope_tether',
    matchId: overrides.matchId ?? 'rope-match-1',
    tick,
    matchTime,
    phase: overrides.phase ?? 'playing',
    checkpointIndex: overrides.checkpointIndex ?? 0,
    failures: overrides.failures ?? 0,
    p1: {
      x: -1.5,
      y: 0,
      z: 3,
      vx: 0,
      vy: 0,
      vz: 1,
      yaw: 0,
      grounded: true,
      anchored: false,
      reeling: false,
      hanging: false,
      ...overrides.p1,
    },
    p2: {
      x: 1.5,
      y: 0,
      z: 3,
      vx: 0,
      vy: 0,
      vz: 1,
      yaw: 0,
      grounded: true,
      anchored: false,
      reeling: false,
      hanging: false,
      ...overrides.p2,
    },
    ropeLength: overrides.ropeLength ?? 4,
    ropeStrain: overrides.ropeStrain ?? 0,
    respawnTimer: overrides.respawnTimer ?? 0,
    events: overrides.events ?? [],
  };
}

function makeMinecartSnapshot(
  tick: number,
  matchTime: number,
  overrides: {
    matchId?: string;
    phase?: MinecartSnapshotPayload['phase'];
    checkpointIndex?: number;
    failures?: number;
    cart?: Partial<MinecartSnapshotPayload['cart']>;
    events?: MinecartSnapshotPayload['events'];
  } = {},
): MinecartSnapshotPayload {
  return {
    mapId: 'minecart_rails',
    matchId: overrides.matchId ?? 'cart-match-1',
    tick,
    matchTime,
    phase: overrides.phase ?? 'playing',
    checkpointIndex: overrides.checkpointIndex ?? 0,
    failures: overrides.failures ?? 0,
    cart: {
      lane: 1,
      x: 0,
      y: 0,
      z: 5,
      vy: 0,
      speed: 8,
      hp: 3,
      invulnTimer: 0,
      respawnTimer: 0,
      pumpTurn: 'p1',
      pumpTilt: 0,
      wobble: 0,
      p1Ducking: false,
      p2Ducking: false,
      grounded: true,
      ...overrides.cart,
    },
    events: overrides.events ?? [],
  };
}

describe('CoopSnapshotInterpolator', () => {
  it('returns null when empty and exact snapshot for single or out-of-range samples', () => {
    const interp = new CoopSnapshotInterpolator<RaftSnapshotPayload>();
    assert.equal(interp.sample(1000), null);

    const s1 = makeRaftSnapshot(1, 0.2, { raft: { z: 6 } });
    interp.push(s1, 1000);
    assert.deepEqual(interp.sample(1000), s1);
    assert.deepEqual(interp.sample(1500), s1);

    const s2 = makeRaftSnapshot(5, 0.4, { raft: { z: 10 } });
    interp.push(s2, 1100);
    assert.deepEqual(interp.sample(1050), s1); // renderTime = 930 <= 1000
    assert.deepEqual(interp.sample(1250), s2); // renderTime = 1130 >= 1100
  });

  it('interpolates raft_rapids continuous fields, shortest-arc yaw, and takes discrete fields from upper snapshot', () => {
    assert.equal(GLASS_INTERPOLATION_DELAY_MS, 120);
    const interp = new CoopSnapshotInterpolator<RaftSnapshotPayload>();

    const s1 = makeRaftSnapshot(10, 2.0, {
      checkpointIndex: 0,
      failures: 0,
      phase: 'playing',
      raft: {
        x: -2,
        y: 0,
        z: 20,
        vx: 1,
        vy: 0,
        vz: 4,
        yaw: Math.PI - 0.1,
        hp: 3,
        invulnTimer: 0,
        respawnTimer: 0,
        boostTimer: 0,
        p1StrokeAnim: 0.2,
        p2StrokeAnim: 0.4,
        p1LeanX: -0.5,
        p2LeanX: 0.2,
        inWhirlpool: false,
      },
      events: [{ id: 1, kind: 'paddle_p1', x: -2, y: 0, z: 20 }],
    });

    const s2 = makeRaftSnapshot(14, 2.2, {
      checkpointIndex: 1,
      failures: 1,
      phase: 'finished',
      raft: {
        x: 2,
        y: 1,
        z: 28,
        vx: 3,
        vy: 2,
        vz: 8,
        yaw: -Math.PI + 0.3,
        hp: 2,
        invulnTimer: 0.8,
        respawnTimer: 1.1,
        boostTimer: 0.5,
        p1StrokeAnim: 0.8,
        p2StrokeAnim: 1.0,
        p1LeanX: 0.5,
        p2LeanX: 0.8,
        inWhirlpool: true,
      },
      events: [{ id: 2, kind: 'raft_hit', x: 2, y: 1, z: 28 }],
    });

    interp.push(s1, 1000);
    interp.push(s2, 1100);

    // renderTime = 1170 - 120 = 1050 -> t = 0.5
    const mid = interp.sample(1170);
    assert.ok(mid);
    assert.equal(mid.mapId, 'raft_rapids');
    assertClose(mid.matchTime, 2.1);
    assertClose(mid.raft.x, 0);
    assertClose(mid.raft.y, 0.5);
    assertClose(mid.raft.z, 24);
    assertClose(mid.raft.vx, 2);
    assertClose(mid.raft.vy, 1);
    assertClose(mid.raft.vz, 6);
    assertClose(mid.raft.yaw, -Math.PI + 0.1, 1e-5);
    assertClose(mid.raft.p1StrokeAnim, 0.5);
    assertClose(mid.raft.p2StrokeAnim, 0.7);
    assertClose(mid.raft.p1LeanX, 0);
    assertClose(mid.raft.p2LeanX, 0.5);

    assert.equal(mid.raft.hp, 2);
    assert.equal(mid.raft.invulnTimer, 0.8);
    assert.equal(mid.raft.respawnTimer, 1.1);
    assert.equal(mid.raft.boostTimer, 0.5);
    assert.equal(mid.raft.inWhirlpool, true);
    assert.equal(mid.phase, 'finished');
    assert.equal(mid.checkpointIndex, 1);
    assert.equal(mid.failures, 1);
    assert.deepEqual(mid.events, s2.events);
  });

  it('interpolates rope_tether players, shortest-arc yaw, rope metrics, and preserves discrete flags', () => {
    const interp = new CoopSnapshotInterpolator<RopeSnapshotPayload>();

    const s1 = makeRopeSnapshot(20, 4.0, {
      checkpointIndex: 1,
      failures: 0,
      p1: {
        x: -2,
        y: 1,
        z: 30,
        vx: 0,
        vy: 1,
        vz: 2,
        yaw: -Math.PI + 0.1,
        grounded: true,
        anchored: false,
        reeling: false,
        hanging: false,
      },
      p2: {
        x: 2,
        y: 0,
        z: 28,
        vx: 2,
        vy: -1,
        vz: 0,
        yaw: Math.PI - 0.1,
        grounded: false,
        anchored: false,
        reeling: false,
        hanging: false,
      },
      ropeLength: 4,
      ropeStrain: 0.2,
      respawnTimer: 0,
      events: [{ id: 3, kind: 'rope_anchor', x: -2, y: 1, z: 30 }],
    });

    const s2 = makeRopeSnapshot(24, 4.4, {
      checkpointIndex: 2,
      failures: 1,
      phase: 'finished',
      p1: {
        x: 0,
        y: 3,
        z: 34,
        vx: 2,
        vy: 3,
        vz: 4,
        yaw: Math.PI - 0.3,
        grounded: false,
        anchored: true,
        reeling: true,
        hanging: false,
      },
      p2: {
        x: 4,
        y: 2,
        z: 32,
        vx: 4,
        vy: 1,
        vz: 2,
        yaw: -Math.PI + 0.3,
        grounded: true,
        anchored: false,
        reeling: false,
        hanging: true,
      },
      ropeLength: 6,
      ropeStrain: 0.8,
      respawnTimer: 0.9,
      events: [{ id: 4, kind: 'checkpoint', x: 0, y: 3, z: 34, checkpointIndex: 2 }],
    });

    interp.push(s1, 2000);
    interp.push(s2, 2100);

    const mid = interp.sample(2170); // renderTime = 2050 -> t = 0.5
    assert.ok(mid);
    assert.equal(mid.mapId, 'rope_tether');
    assertClose(mid.matchTime, 4.2);
    assertClose(mid.p1.x, -1);
    assertClose(mid.p1.y, 2);
    assertClose(mid.p1.z, 32);
    assertClose(mid.p1.vx, 1);
    assertClose(mid.p1.vy, 2);
    assertClose(mid.p1.vz, 3);
    assertClose(mid.p1.yaw, Math.PI - 0.1, 1e-5);

    assertClose(mid.p2.x, 3);
    assertClose(mid.p2.y, 1);
    assertClose(mid.p2.z, 30);
    assertClose(mid.p2.vx, 3);
    assertClose(mid.p2.vy, 0);
    assertClose(mid.p2.vz, 1);
    assertClose(mid.p2.yaw, -Math.PI + 0.1, 1e-5);

    assertClose(mid.ropeLength, 5);
    assertClose(mid.ropeStrain, 0.5);

    assert.equal(mid.p1.grounded, false);
    assert.equal(mid.p1.anchored, true);
    assert.equal(mid.p1.reeling, true);
    assert.equal(mid.p1.hanging, false);
    assert.equal(mid.p2.grounded, true);
    assert.equal(mid.p2.hanging, true);
    assert.equal(mid.respawnTimer, 0.9);
    assert.equal(mid.phase, 'finished');
    assert.equal(mid.checkpointIndex, 2);
    assert.equal(mid.failures, 1);
    assert.deepEqual(mid.events, s2.events);
  });

  it('interpolates minecart_rails cart kinematics and preserves discrete lane/duck/hp fields', () => {
    const interp = new CoopSnapshotInterpolator<MinecartSnapshotPayload>();

    const s1 = makeMinecartSnapshot(30, 5.0, {
      checkpointIndex: 0,
      failures: 0,
      cart: {
        lane: 0,
        x: -3,
        y: 0,
        z: 50,
        vy: 0,
        speed: 10,
        hp: 3,
        invulnTimer: 0,
        respawnTimer: 0,
        pumpTurn: 'p1',
        pumpTilt: -0.4,
        wobble: 0.1,
        p1Ducking: false,
        p2Ducking: false,
        grounded: true,
      },
      events: [{ id: 5, kind: 'cart_pump', x: -3, y: 0, z: 50 }],
    });

    const s2 = makeMinecartSnapshot(34, 5.2, {
      checkpointIndex: 1,
      failures: 2,
      phase: 'finished',
      cart: {
        lane: 2,
        x: 3,
        y: 2,
        z: 58,
        vy: 4,
        speed: 16,
        hp: 1,
        invulnTimer: 0.6,
        respawnTimer: 1.2,
        pumpTurn: 'p2',
        pumpTilt: 0.4,
        wobble: 0.5,
        p1Ducking: true,
        p2Ducking: true,
        grounded: false,
      },
      events: [{ id: 6, kind: 'cart_lane', x: 3, y: 2, z: 58 }],
    });

    interp.push(s1, 3000);
    interp.push(s2, 3100);

    const mid = interp.sample(3170); // renderTime = 3050 -> t = 0.5
    assert.ok(mid);
    assert.equal(mid.mapId, 'minecart_rails');
    assertClose(mid.matchTime, 5.1);
    assertClose(mid.cart.x, 0);
    assertClose(mid.cart.y, 1);
    assertClose(mid.cart.z, 54);
    assertClose(mid.cart.vy, 2);
    assertClose(mid.cart.speed, 13);
    assertClose(mid.cart.pumpTilt, 0);
    assertClose(mid.cart.wobble, 0.3);

    assert.equal(mid.cart.lane, 2);
    assert.equal(mid.cart.hp, 1);
    assert.equal(mid.cart.invulnTimer, 0.6);
    assert.equal(mid.cart.respawnTimer, 1.2);
    assert.equal(mid.cart.pumpTurn, 'p2');
    assert.equal(mid.cart.p1Ducking, true);
    assert.equal(mid.cart.p2Ducking, true);
    assert.equal(mid.cart.grounded, false);
    assert.equal(mid.phase, 'finished');
    assert.equal(mid.checkpointIndex, 1);
    assert.equal(mid.failures, 2);
    assert.deepEqual(mid.events, s2.events);
  });

  it('drops out-of-order ticks, caps buffer at 8, and auto-resets on matchId or mapId switch', () => {
    const interp = new CoopSnapshotInterpolator();

    interp.push(makeRaftSnapshot(10, 1.0, { raft: { z: 10 } }), 1000);
    interp.push(makeRaftSnapshot(9, 0.9, { raft: { z: 99 } }), 1050);
    interp.push(makeRaftSnapshot(10, 1.0, { raft: { z: 88 } }), 1060);
    const afterDrop = interp.sample(1200);
    assert.equal(afterDrop?.mapId, 'raft_rapids');
    if (afterDrop?.mapId === 'raft_rapids') {
      assert.equal(afterDrop.raft.z, 10);
    }

    // Cap buffer at 8 entries
    for (let tick = 20; tick <= 90; tick += 10) {
      interp.push(
        makeRaftSnapshot(tick, tick / 10, { raft: { z: tick } }),
        1000 + (tick - 10) * 10,
      );
    }
    const oldestRemaining = interp.sample(1170); // renderTime = 1050 <= 1100 -> tick 20
    if (oldestRemaining?.mapId === 'raft_rapids') {
      assert.equal(oldestRemaining.raft.z, 20);
    }

    // Auto-reset when matchId changes (even with lower tick)
    interp.push(
      makeRaftSnapshot(1, 0.1, { matchId: 'raft-match-2', raft: { z: 2.5 } }),
      1500,
    );
    const switchedMatch = interp.sample(1600);
    assert.equal(switchedMatch?.matchId, 'raft-match-2');
    if (switchedMatch?.mapId === 'raft_rapids') {
      assert.equal(switchedMatch.raft.z, 2.5);
    }

    // Auto-reset when mapId changes (even with same matchId and lower tick)
    interp.push(
      makeMinecartSnapshot(1, 0.1, {
        matchId: 'raft-match-2',
        cart: { z: 7.5 },
      }),
      1700,
    );
    const switchedMap = interp.sample(1800);
    assert.equal(switchedMap?.mapId, 'minecart_rails');
    if (switchedMap?.mapId === 'minecart_rails') {
      assert.equal(switchedMap.cart.z, 7.5);
    }

    interp.reset();
    assert.equal(interp.sample(1900), null);
  });
});
