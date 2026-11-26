import {
  GLASS_INTERPOLATION_DELAY_MS,
  type GlassSnapshotPayload,
  type PackedPlayerState,
} from './protocol.ts';

const MAX_BUFFER_SIZE = 4;

type SnapshotEntry = {
  snapshot: GlassSnapshotPayload;
  receivedAtMs: number;
};

function wrapAngle(rad: number): number {
  const twoPi = Math.PI * 2;
  let angle = (((rad + Math.PI) % twoPi) + twoPi) % twoPi - Math.PI;
  if (angle === -Math.PI && rad > 0) {
    angle = Math.PI;
  }
  return Object.is(angle, -0) ? 0 : angle;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Shortest-arc angular interpolation between angles `a` and `b` (in radians),
 * wrapping cleanly across the `-π / +π` discontinuity.
 */
export function lerpAngle(a: number, b: number, t: number): number {
  const delta = wrapAngle(b - a);
  return wrapAngle(a + delta * t);
}

function clonePlayer(p: PackedPlayerState): PackedPlayerState {
  return { ...p };
}

function cloneSnapshot(s: GlassSnapshotPayload): GlassSnapshotPayload {
  return {
    ...s,
    p1: clonePlayer(s.p1),
    p2: clonePlayer(s.p2),
    glass: { ...s.glass },
    events: s.events.map((evt) => ({ ...evt })),
  };
}

function interpolatePlayer(
  a: PackedPlayerState,
  b: PackedPlayerState,
  t: number,
): PackedPlayerState {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    vx: lerp(a.vx, b.vx, t),
    vy: lerp(a.vy, b.vy, t),
    vz: lerp(a.vz, b.vz, t),
    yaw: lerpAngle(a.yaw, b.yaw, t),
    grounded: b.grounded,
    liftOffset: lerp(a.liftOffset, b.liftOffset, t),
    onIce: b.onIce,
    inWind: b.inWind,
  };
}

function interpolateSnapshots(
  a: GlassSnapshotPayload,
  b: GlassSnapshotPayload,
  t: number,
): GlassSnapshotPayload {
  return {
    matchId: b.matchId,
    tick: b.tick,
    matchTime: lerp(a.matchTime, b.matchTime, t),
    phase: b.phase,
    checkpointIndex: b.checkpointIndex,
    shatters: b.shatters,
    p1: interpolatePlayer(a.p1, b.p1, t),
    p2: interpolatePlayer(a.p2, b.p2, t),
    glass: {
      hp: b.glass.hp,
      stress: lerp(a.glass.stress, b.glass.stress, t),
      centerX: lerp(a.glass.centerX, b.glass.centerX, t),
      centerY: lerp(a.glass.centerY, b.glass.centerY, t),
      centerZ: lerp(a.glass.centerZ, b.glass.centerZ, t),
      yaw: lerpAngle(a.glass.yaw, b.glass.yaw, t),
      pitch: lerp(a.glass.pitch, b.glass.pitch, t),
      length: lerp(a.glass.length, b.glass.length, t),
      invulnTimer: b.glass.invulnTimer,
      shatterTimer: b.glass.shatterTimer,
      shatterReason: b.glass.shatterReason,
      lastImpactX: b.glass.lastImpactX,
      lastImpactY: b.glass.lastImpactY,
      lastImpactZ: b.glass.lastImpactZ,
    },
    events: b.events.map((evt) => ({ ...evt })),
  };
}

/**
 * Guest-side snapshot jitter buffer storing up to 4 recent Host snapshots
 * and sampling smoothly at `localNowMs - delayMs`.
 */
export class SnapshotInterpolator {
  private entries: SnapshotEntry[] = [];

  push(snapshot: GlassSnapshotPayload, localNowMs: number): void {
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
  ): GlassSnapshotPayload | null {
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
        const t = Math.max(0, Math.min(1, (renderTime - lower.receivedAtMs) / span));
        return interpolateSnapshots(lower.snapshot, upper.snapshot, t);
      }
    }

    return cloneSnapshot(last.snapshot);
  }

  reset(): void {
    this.entries = [];
  }
}
