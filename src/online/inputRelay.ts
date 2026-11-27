export interface InputRelayOptions<TInput> {
  intervalMs: number;
  latch: (incoming: TInput, pending: TInput | null) => TInput;
  equals: (a: TInput, b: TInput) => boolean;
  clone: (input: TInput) => TInput;
}

export type InputRelayEvaluation<TInput> =
  | {
      action: 'send';
      seq: number;
      input: TInput;
    }
  | {
      action: 'defer';
      changed: boolean;
      waitMs: number;
      pending: TInput;
    };

/**
 * Throttles continuous real-time player inputs, latches one-shot impulses across
 * throttled frames, and deduplicates identical states up to a 2x heartbeat interval.
 */
export class InputRelay<TInput> {
  private readonly options: InputRelayOptions<TInput>;
  private contextKey = '';
  private seq = 0;
  private lastSentAtMs = -Infinity;
  private lastSentInput: TInput | null = null;
  private pending: TInput | null = null;

  constructor(options: InputRelayOptions<TInput>) {
    this.options = options;
  }

  evaluate(
    contextKey: string,
    input: TInput,
    nowMs: number,
  ): InputRelayEvaluation<TInput> {
    if (contextKey !== this.contextKey) {
      this.resetContext(contextKey);
    }

    const merged = this.options.latch(input, this.pending);
    const changed =
      this.lastSentInput === null || !this.options.equals(merged, this.lastSentInput);
    const elapsed = Number.isFinite(this.lastSentAtMs)
      ? Math.max(0, nowMs - this.lastSentAtMs)
      : Infinity;
    const heartbeatIntervalMs = this.options.intervalMs * 2;

    if (
      elapsed >= this.options.intervalMs &&
      (changed || elapsed >= heartbeatIntervalMs)
    ) {
      this.pending = null;
      this.lastSentAtMs = nowMs;
      const cloned = this.options.clone(merged);
      this.lastSentInput = this.options.clone(cloned);
      this.seq += 1;
      return { action: 'send', seq: this.seq, input: cloned };
    }

    this.pending = this.options.clone(merged);
    const targetInterval = changed ? this.options.intervalMs : heartbeatIntervalMs;
    const waitMs = Math.max(1, targetInterval - elapsed);
    return {
      action: 'defer',
      changed,
      waitMs,
      pending: this.options.clone(this.pending),
    };
  }

  flushPending(
    contextKey: string,
    nowMs: number,
  ): { seq: number; input: TInput } | null {
    if (contextKey !== this.contextKey || !this.pending) {
      return null;
    }
    const consumed = this.options.clone(this.pending);
    this.pending = null;
    this.lastSentAtMs = nowMs;
    this.lastSentInput = this.options.clone(consumed);
    this.seq += 1;
    return { seq: this.seq, input: consumed };
  }

  reset(): void {
    this.resetContext('');
  }

  private resetContext(nextKey: string): void {
    this.contextKey = nextKey;
    this.lastSentAtMs = -Infinity;
    this.lastSentInput = null;
    this.pending = null;
  }
}

/**
 * Wraps `InputRelay` with browser timer fallback so delayed impulses still
 * flush after `waitMs` even if the render loop pauses or skips a frame.
 */
export class ScheduledInputSender<TInput> {
  private readonly relay: InputRelay<TInput>;
  private timerId: number | null = null;
  private activeKey = '';

  constructor(options: InputRelayOptions<TInput>) {
    this.relay = new InputRelay(options);
  }

  send(
    contextKey: string,
    input: TInput,
    nowMs: number,
    onEmit: (seq: number, payloadInput: TInput, contextKey: string) => void,
  ): void {
    if (contextKey !== this.activeKey) {
      this.clearTimer();
      this.activeKey = contextKey;
    }

    const evalResult = this.relay.evaluate(contextKey, input, nowMs);
    if (evalResult.action === 'send') {
      this.clearTimer();
      onEmit(evalResult.seq, evalResult.input, contextKey);
      return;
    }

    if (evalResult.changed && this.timerId !== null) {
      this.clearTimer();
    }

    if (this.timerId === null) {
      const scheduledKey = contextKey;
      this.timerId = globalThis.setTimeout(() => {
        this.timerId = null;
        if (this.activeKey !== scheduledKey) return;
        const flushed = this.relay.flushPending(scheduledKey, performance.now());
        if (flushed) {
          onEmit(flushed.seq, flushed.input, scheduledKey);
        }
      }, evalResult.waitMs) as unknown as number;
    }
  }

  reset(): void {
    this.clearTimer();
    this.activeKey = '';
    this.relay.reset();
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      globalThis.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
