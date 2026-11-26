import {
  BRAWL_INTERPOLATION_DELAY_MS,
  type BrawlFighterSnapshot,
  type BrawlSnapshotPayload,
} from './protocol.ts';

interface TimedBrawlSnapshot {
  snapshot: BrawlSnapshotPayload;
  receivedAtMs: number;
}

const MAX_BUFFER_ENTRIES = 5;

export function lerpBrawlAngle(a: number, b: number, t: number): number {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  let result = a + delta * t;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result <= -Math.PI) result += Math.PI * 2;
  return result;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateFighter(
  a: BrawlFighterSnapshot | undefined,
  b: BrawlFighterSnapshot,
  t: number,
): BrawlFighterSnapshot {
  if (!a) return { ...b };
  return {
    ...b,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    yaw: lerpBrawlAngle(a.yaw, b.yaw, t),
    speedNorm: lerp(a.speedNorm, b.speedNorm, t),
    walkPhase: lerp(a.walkPhase, b.walkPhase, t),
    balance: lerp(a.balance, b.balance, t),
    actionProgress: lerp(a.actionProgress, b.actionProgress, t),
  };
}

export class BrawlSnapshotInterpolator {
  private buffer: TimedBrawlSnapshot[] = [];

  push(snapshot: BrawlSnapshotPayload, receivedAtMs: number): void {
    const last = this.buffer[this.buffer.length - 1];
    if (last && snapshot.tick <= last.snapshot.tick) {
      return;
    }
    this.buffer.push({ snapshot, receivedAtMs });
    if (this.buffer.length > MAX_BUFFER_ENTRIES) {
      this.buffer.splice(0, this.buffer.length - MAX_BUFFER_ENTRIES);
    }
  }

  sample(nowMs: number): BrawlSnapshotPayload | null {
    if (this.buffer.length === 0) return null;
    if (this.buffer.length === 1) return this.buffer[0].snapshot;

    const renderTime = nowMs - BRAWL_INTERPOLATION_DELAY_MS;
    if (renderTime <= this.buffer[0].receivedAtMs) {
      return this.buffer[0].snapshot;
    }

    const latest = this.buffer[this.buffer.length - 1];
    if (renderTime >= latest.receivedAtMs) {
      return latest.snapshot;
    }

    let lower = this.buffer[0];
    let upper = latest;
    for (let i = 0; i < this.buffer.length - 1; i++) {
      const a = this.buffer[i];
      const b = this.buffer[i + 1];
      if (renderTime >= a.receivedAtMs && renderTime <= b.receivedAtMs) {
        lower = a;
        upper = b;
        break;
      }
    }

    const span = upper.receivedAtMs - lower.receivedAtMs;
    const t = span > 0 ? Math.max(0, Math.min(1, (renderTime - lower.receivedAtMs) / span)) : 1;

    const lowerById = new Map<string, BrawlFighterSnapshot>();
    for (const f of lower.snapshot.fighters) {
      lowerById.set(f.id, f);
    }

    return {
      ...upper.snapshot,
      nowSec: lerp(lower.snapshot.nowSec, upper.snapshot.nowSec, t),
      roundElapsedSec: lerp(
        lower.snapshot.roundElapsedSec,
        upper.snapshot.roundElapsedSec,
        t,
      ),
      fighters: upper.snapshot.fighters.map((f) =>
        interpolateFighter(lowerById.get(f.id), f, t),
      ),
    };
  }

  reset(): void {
    this.buffer = [];
  }
}
