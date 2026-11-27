import {
  InputRelay,
  ScheduledInputSender,
  type InputRelayEvaluation,
} from '../../online/inputRelay.ts';
import type { PlayerInput } from '../sim/types.ts';
import { GLASS_INPUT_INTERVAL_MS } from './protocol.ts';

function cloneGlassInput(input: PlayerInput): PlayerInput {
  return { ...input };
}

function latchGlassInput(
  incoming: PlayerInput,
  pending: PlayerInput | null,
): PlayerInput {
  if (!pending) return cloneGlassInput(incoming);
  return {
    moveX: incoming.moveX,
    moveZ: incoming.moveZ,
    jump: Boolean(pending.jump || incoming.jump),
    lift: incoming.lift !== 0 ? incoming.lift : pending.lift,
  };
}

export function glassInputsEqual(a: PlayerInput, b: PlayerInput): boolean {
  return (
    a.moveX === b.moveX &&
    a.moveZ === b.moveZ &&
    a.jump === b.jump &&
    a.lift === b.lift
  );
}

/**
 * Throttles Glass/Co-op guest input packets to `GLASS_INPUT_INTERVAL_MS`,
 * latches transient jump/lift impulses across throttled frames, and
 * deduplicates steady states up to a 2x heartbeat interval.
 */
export class GlassInputRelay {
  private readonly relay = new InputRelay<PlayerInput>({
    intervalMs: GLASS_INPUT_INTERVAL_MS,
    latch: latchGlassInput,
    equals: glassInputsEqual,
    clone: cloneGlassInput,
  });

  evaluate(
    matchId: string,
    input: PlayerInput,
    nowMs: number,
  ): InputRelayEvaluation<PlayerInput> {
    return this.relay.evaluate(matchId, input, nowMs);
  }

  flushPending(
    matchId: string,
    nowMs: number,
  ): { seq: number; input: PlayerInput } | null {
    return this.relay.flushPending(matchId, nowMs);
  }

  reset(): void {
    this.relay.reset();
  }
}

export function createGlassInputSender(): ScheduledInputSender<PlayerInput> {
  return new ScheduledInputSender<PlayerInput>({
    intervalMs: GLASS_INPUT_INTERVAL_MS,
    latch: latchGlassInput,
    equals: glassInputsEqual,
    clone: cloneGlassInput,
  });
}
