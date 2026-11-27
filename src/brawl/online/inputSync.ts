import {
  InputRelay,
  ScheduledInputSender,
  type InputRelayEvaluation,
} from '../../online/inputRelay.ts';
import type { FighterInput } from '../sim/types.ts';
import { BRAWL_INPUT_INTERVAL_MS, type BrawlInputPayload } from './protocol.ts';

function cloneBrawlInput(input: FighterInput): FighterInput {
  return { ...input };
}

function latchBrawlInput(
  incoming: FighterInput,
  pending: FighterInput | null,
): FighterInput {
  if (!pending) return cloneBrawlInput(incoming);
  return {
    ...incoming,
    jump: incoming.jump || pending.jump,
    punch: incoming.punch || pending.punch,
    headbutt: incoming.headbutt || pending.headbutt,
    roll: incoming.roll || pending.roll,
    emote: incoming.emote ?? pending.emote,
  };
}

export function brawlInputsEqual(a: FighterInput, b: FighterInput): boolean {
  return (
    a.moveX === b.moveX &&
    a.moveZ === b.moveZ &&
    a.sprint === b.sprint &&
    a.jump === b.jump &&
    a.punch === b.punch &&
    a.headbutt === b.headbutt &&
    a.grabHeld === b.grabHeld &&
    a.roll === b.roll &&
    a.emote === b.emote
  );
}

/**
 * Throttles Brawl client input packets to `BRAWL_INPUT_INTERVAL_MS`, latches
 * one-shot combat/jump impulses so short clicks between frames aren't dropped,
 * and deduplicates unchanged inputs up to a 2x heartbeat interval.
 */
export class BrawlInputRelay {
  private readonly relay = new InputRelay<FighterInput>({
    intervalMs: BRAWL_INPUT_INTERVAL_MS,
    latch: latchBrawlInput,
    equals: brawlInputsEqual,
    clone: cloneBrawlInput,
  });

  evaluate(
    roundKey: string,
    input: FighterInput,
    nowMs: number,
  ): InputRelayEvaluation<FighterInput> {
    return this.relay.evaluate(roundKey, input, nowMs);
  }

  flushPending(
    roundKey: string,
    nowMs: number,
  ): { seq: number; input: FighterInput } | null {
    return this.relay.flushPending(roundKey, nowMs);
  }

  push(
    peerId: string,
    roundKey: string,
    input: FighterInput,
    nowMs: number,
  ): BrawlInputPayload | null {
    const res = this.relay.evaluate(roundKey, input, nowMs);
    if (res.action !== 'send') return null;
    return {
      roundKey,
      peerId,
      seq: res.seq,
      input: res.input,
    };
  }

  reset(): void {
    this.relay.reset();
  }
}

export function createBrawlInputSender(): ScheduledInputSender<FighterInput> {
  return new ScheduledInputSender<FighterInput>({
    intervalMs: BRAWL_INPUT_INTERVAL_MS,
    latch: latchBrawlInput,
    equals: brawlInputsEqual,
    clone: cloneBrawlInput,
  });
}
