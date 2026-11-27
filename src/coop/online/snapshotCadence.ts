import { GLASS_SNAPSHOT_INTERVAL_MS } from '../../glass/online/protocol.ts';

const MAX_QUEUED_EVENTS = 32;

const CRITICAL_COOP_EVENT_KINDS = new Set<string>([
  'glass_shatter',
  'raft_capsize',
  'rope_snap',
  'cart_derail',
  'checkpoint',
  'respawn',
  'course_clear',
]);

export function isCriticalCoopEvent(event: { kind: string }): boolean {
  return CRITICAL_COOP_EVENT_KINDS.has(event.kind);
}

export interface CoopSnapshotStepResult<TEvent> {
  shouldBroadcast: boolean;
  events: TEvent[];
}

/**
 * Accumulates Co-op simulation events between snapshot ticks so non-critical
 * audio/visual cues batch into the regular `GLASS_SNAPSHOT_INTERVAL_MS` cadence
 * without bursting past the shared Realtime rate limit, while critical state
 * events fast-flush with burst protection and match completion flushes at once.
 */
export class CoopSnapshotPacer<TEvent extends object> {
  private readonly intervalMs: number;
  private readonly criticalCooldownMs: number;
  private lastSentAtMs = -Infinity;
  private pendingEvents: TEvent[] = [];
  private hasPendingCritical = false;

  constructor(intervalMs = GLASS_SNAPSHOT_INTERVAL_MS) {
    this.intervalMs = intervalMs;
    this.criticalCooldownMs = Math.ceil(intervalMs * 0.5);
  }

  step(
    nowMs: number,
    frameEvents: readonly TEvent[],
    justFinished: boolean,
    isCritical: (evt: TEvent) => boolean,
  ): CoopSnapshotStepResult<TEvent> {
    for (const evt of frameEvents) {
      this.pendingEvents.push({ ...evt });
      if (isCritical(evt)) {
        this.hasPendingCritical = true;
      }
    }
    if (this.pendingEvents.length > MAX_QUEUED_EVENTS) {
      this.pendingEvents.splice(0, this.pendingEvents.length - MAX_QUEUED_EVENTS);
    }

    const elapsed = Number.isFinite(this.lastSentAtMs)
      ? Math.max(0, nowMs - this.lastSentAtMs)
      : Infinity;

    const shouldFlush =
      justFinished ||
      elapsed >= this.intervalMs ||
      (this.hasPendingCritical && elapsed >= this.criticalCooldownMs);

    if (!shouldFlush) {
      return { shouldBroadcast: false, events: [] };
    }

    const flushed = this.pendingEvents;
    this.pendingEvents = [];
    this.hasPendingCritical = false;
    this.lastSentAtMs = nowMs;
    return { shouldBroadcast: true, events: flushed };
  }

  reset(): void {
    this.lastSentAtMs = -Infinity;
    this.pendingEvents = [];
    this.hasPendingCritical = false;
  }
}
