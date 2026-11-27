import { GLASS_INTERPOLATION_DELAY_MS } from '../../glass/online/protocol.ts';
import { lerpAngle } from '../../glass/online/snapshotInterpolation.ts';
import type { MinecartSnapshotPayload } from '../maps/minecart/types.ts';
import type { RaftSnapshotPayload } from '../maps/raft/types.ts';
import type {
  RopeSnapshotPayload,
  RopeSnapshotPlayer,
} from '../maps/rope/types.ts';

export type CoopInterpolatableSnapshot =
  | RaftSnapshotPayload
  | RopeSnapshotPayload
  | MinecartSnapshotPayload;

const MAX_BUFFER_SIZE = 8;

type SnapshotEntry<T extends CoopInterpolatableSnapshot> = {
  snapshot: T;
  receivedAtMs: number;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function cloneSnapshot<T extends CoopInterpolatableSnapshot>(snapshot: T): T {
  switch (snapshot.mapId) {
    case 'raft_rapids':
      return {
        ...snapshot,
        raft: { ...snapshot.raft },
        events: snapshot.events.map((evt) => ({ ...evt })),
      } as T;
    case 'rope_tether':
      return {
        ...snapshot,
        p1: { ...snapshot.p1 },
        p2: { ...snapshot.p2 },
        events: snapshot.events.map((evt) => ({ ...evt })),
      } as T;
    case 'minecart_rails':
      return {
        ...snapshot,
        cart: { ...snapshot.cart },
        events: snapshot.events.map((evt) => ({ ...evt })),
      } as T;
  }
}

function interpolateRaft(
  a: RaftSnapshotPayload,
  b: RaftSnapshotPayload,
  t: number,
): RaftSnapshotPayload {
  return {
    mapId: 'raft_rapids',
    matchId: b.matchId,
    tick: b.tick,
    matchTime: lerp(a.matchTime, b.matchTime, t),
    phase: b.phase,
    checkpointIndex: b.checkpointIndex,
    failures: b.failures,
    raft: {
      x: lerp(a.raft.x, b.raft.x, t),
      y: lerp(a.raft.y, b.raft.y, t),
      z: lerp(a.raft.z, b.raft.z, t),
      vx: lerp(a.raft.vx, b.raft.vx, t),
      vy: lerp(a.raft.vy, b.raft.vy, t),
      vz: lerp(a.raft.vz, b.raft.vz, t),
      yaw: lerpAngle(a.raft.yaw, b.raft.yaw, t),
      hp: b.raft.hp,
      invulnTimer: b.raft.invulnTimer,
      respawnTimer: b.raft.respawnTimer,
      boostTimer: b.raft.boostTimer,
      p1StrokeAnim: lerp(a.raft.p1StrokeAnim, b.raft.p1StrokeAnim, t),
      p2StrokeAnim: lerp(a.raft.p2StrokeAnim, b.raft.p2StrokeAnim, t),
      p1LeanX: lerp(a.raft.p1LeanX, b.raft.p1LeanX, t),
      p2LeanX: lerp(a.raft.p2LeanX, b.raft.p2LeanX, t),
      inWhirlpool: b.raft.inWhirlpool,
    },
    events: b.events.map((evt) => ({ ...evt })),
  };
}

function interpolateRopePlayer(
  a: RopeSnapshotPlayer,
  b: RopeSnapshotPlayer,
  t: number,
): RopeSnapshotPlayer {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    vx: lerp(a.vx, b.vx, t),
    vy: lerp(a.vy, b.vy, t),
    vz: lerp(a.vz, b.vz, t),
    yaw: lerpAngle(a.yaw, b.yaw, t),
    grounded: b.grounded,
    anchored: b.anchored,
    reeling: b.reeling,
    hanging: b.hanging,
  };
}

function interpolateRope(
  a: RopeSnapshotPayload,
  b: RopeSnapshotPayload,
  t: number,
): RopeSnapshotPayload {
  return {
    mapId: 'rope_tether',
    matchId: b.matchId,
    tick: b.tick,
    matchTime: lerp(a.matchTime, b.matchTime, t),
    phase: b.phase,
    checkpointIndex: b.checkpointIndex,
    failures: b.failures,
    p1: interpolateRopePlayer(a.p1, b.p1, t),
    p2: interpolateRopePlayer(a.p2, b.p2, t),
    ropeLength: lerp(a.ropeLength, b.ropeLength, t),
    ropeStrain: lerp(a.ropeStrain, b.ropeStrain, t),
    respawnTimer: b.respawnTimer,
    events: b.events.map((evt) => ({ ...evt })),
  };
}

function interpolateMinecart(
  a: MinecartSnapshotPayload,
  b: MinecartSnapshotPayload,
  t: number,
): MinecartSnapshotPayload {
  return {
    mapId: 'minecart_rails',
    matchId: b.matchId,
    tick: b.tick,
    matchTime: lerp(a.matchTime, b.matchTime, t),
    phase: b.phase,
    checkpointIndex: b.checkpointIndex,
    failures: b.failures,
    cart: {
      lane: b.cart.lane,
      x: lerp(a.cart.x, b.cart.x, t),
      y: lerp(a.cart.y, b.cart.y, t),
      z: lerp(a.cart.z, b.cart.z, t),
      vy: lerp(a.cart.vy, b.cart.vy, t),
      speed: lerp(a.cart.speed, b.cart.speed, t),
      hp: b.cart.hp,
      invulnTimer: b.cart.invulnTimer,
      respawnTimer: b.cart.respawnTimer,
      pumpTurn: b.cart.pumpTurn,
      pumpTilt: lerp(a.cart.pumpTilt, b.cart.pumpTilt, t),
      wobble: lerp(a.cart.wobble, b.cart.wobble, t),
      p1Ducking: b.cart.p1Ducking,
      p2Ducking: b.cart.p2Ducking,
      grounded: b.cart.grounded,
    },
    events: b.events.map((evt) => ({ ...evt })),
  };
}

function interpolateSnapshots<T extends CoopInterpolatableSnapshot>(
  a: T,
  b: T,
  t: number,
): T {
  if (a.mapId !== b.mapId) {
    return cloneSnapshot(b);
  }
  switch (b.mapId) {
    case 'raft_rapids':
      return interpolateRaft(a as RaftSnapshotPayload, b, t) as T;
    case 'rope_tether':
      return interpolateRope(a as RopeSnapshotPayload, b, t) as T;
    case 'minecart_rails':
      return interpolateMinecart(a as MinecartSnapshotPayload, b, t) as T;
  }
}

/**
 * Guest-side snapshot jitter buffer for multi-map Co-op modes (`raft_rapids`,
 * `rope_tether`, `minecart_rails`) storing up to 4 recent Host snapshots and
 * sampling smoothly at `localNowMs - delayMs`.
 */
export class CoopSnapshotInterpolator<
  T extends CoopInterpolatableSnapshot = CoopInterpolatableSnapshot,
> {
  private entries: SnapshotEntry<T>[] = [];

  push(snapshot: T, localNowMs: number): void {
    const prev = this.entries[this.entries.length - 1];
    if (
      prev &&
      (prev.snapshot.matchId !== snapshot.matchId ||
        prev.snapshot.mapId !== snapshot.mapId)
    ) {
      this.entries = [];
    }

    const last = this.entries[this.entries.length - 1];
    if (last && snapshot.tick <= last.snapshot.tick) {
      return;
    }

    const monotonicReceivedAtMs = last
      ? Math.max(localNowMs, last.receivedAtMs)
      : localNowMs;

    this.entries.push({
      snapshot: cloneSnapshot(snapshot),
      receivedAtMs: monotonicReceivedAtMs,
    });

    while (this.entries.length > MAX_BUFFER_SIZE) {
      this.entries.shift();
    }
  }

  sample(
    localNowMs: number,
    delayMs: number = GLASS_INTERPOLATION_DELAY_MS,
  ): T | null {
    const count = this.entries.length;
    if (count === 0) {
      return null;
    }
    if (count === 1) {
      return cloneSnapshot(this.entries[0].snapshot);
    }

    const renderTime = localNowMs - delayMs;
    const first = this.entries[0];
    const last = this.entries[count - 1];

    if (renderTime >= last.receivedAtMs) {
      return cloneSnapshot(last.snapshot);
    }
    if (renderTime <= first.receivedAtMs) {
      return cloneSnapshot(first.snapshot);
    }

    for (let i = 0; i < count - 1; i += 1) {
      const lower = this.entries[i];
      const upper = this.entries[i + 1];
      if (renderTime >= lower.receivedAtMs && renderTime <= upper.receivedAtMs) {
        const span = upper.receivedAtMs - lower.receivedAtMs;
        if (span <= 0) {
          return cloneSnapshot(upper.snapshot);
        }
        const t = Math.max(
          0,
          Math.min(1, (renderTime - lower.receivedAtMs) / span),
        );
        return interpolateSnapshots(lower.snapshot, upper.snapshot, t);
      }
    }

    return cloneSnapshot(last.snapshot);
  }

  reset(): void {
    this.entries = [];
  }
}
