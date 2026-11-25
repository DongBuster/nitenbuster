import {
  createInitialState,
  declineRescue,
  detonateCandyBombAt,
  placePiece,
  rerollTray,
} from './game.ts';

export const MAX_MATCH_ACTIONS = 2000;
export const MIN_MS_PER_ACTION = 80;

export type MatchAction =
  | { seq: number; type: 'place'; slotIndex: number; row: number; col: number }
  | { seq: number; type: 'bomb'; row: number; col: number }
  | { seq: number; type: 'reroll' }
  | { seq: number; type: 'declineRescue' };

export interface MatchReceipt {
  matchId: string;
  seed: number;
  actions: readonly MatchAction[];
  claimedScore: number;
  elapsedMs: number;
  bombPaidCount: number;
  rescueEligible: boolean;
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
  verifiedScore: number;
  linesCleared: number;
  maxStreak: number;
}

function fail(reason: string): VerifyResult {
  return { valid: false, reason, verifiedScore: 0, linesCleared: 0, maxStreak: 0 };
}

export function verifyMatchReceipt(receipt: MatchReceipt): VerifyResult {
  if (!receipt || typeof receipt !== 'object') return fail('Invalid receipt');
  if (typeof receipt.matchId !== 'string' || receipt.matchId.trim().length < 4 || receipt.matchId.length > 80) {
    return fail('Invalid matchId');
  }
  if (!Number.isFinite(receipt.seed)) return fail('Invalid seed');
  if (!Array.isArray(receipt.actions) || receipt.actions.length === 0 || receipt.actions.length > MAX_MATCH_ACTIONS) {
    return fail('Invalid action count');
  }
  if (!Number.isSafeInteger(receipt.claimedScore) || receipt.claimedScore < 0) {
    return fail('Invalid claimedScore');
  }
  if (!Number.isFinite(receipt.elapsedMs) || receipt.elapsedMs < receipt.actions.length * MIN_MS_PER_ACTION) {
    return fail('Implausible match duration');
  }
  if (!Number.isSafeInteger(receipt.bombPaidCount) || receipt.bombPaidCount < 0 || receipt.bombPaidCount > 1) {
    return fail('Invalid bombPaidCount');
  }
  if (typeof receipt.rescueEligible !== 'boolean') {
    return fail('Invalid rescueEligible');
  }

  let state = createInitialState(receipt.seed);
  let bombActions = 0;
  let rerollActions = 0;
  const canOfferRescue = receipt.rescueEligible;

  for (let i = 0; i < receipt.actions.length; i++) {
    const action = receipt.actions[i];
    if (!action || action.seq !== i) return fail(`Invalid action sequence at ${i}`);

    if (action.type === 'place') {
      const outcome = placePiece(state, action.slotIndex, action.row, action.col, canOfferRescue);
      if (!outcome) return fail(`Illegal placement at seq ${i}`);
      state = outcome.nextState;
    } else if (action.type === 'bomb') {
      bombActions++;
      if (bombActions > 1 || bombActions > receipt.bombPaidCount) {
        return fail('Unauthorized candy bomb action');
      }
      const outcome = detonateCandyBombAt(state, action.row, action.col);
      if (!outcome) return fail(`Illegal bomb action at seq ${i}`);
      state = outcome.nextState;
    } else if (action.type === 'reroll') {
      rerollActions++;
      if (rerollActions > 1) return fail('Multiple rerolls');
      const next = rerollTray(state, canOfferRescue);
      if (!next) return fail(`Illegal reroll at seq ${i}`);
      state = next;
    } else if (action.type === 'declineRescue') {
      if (state.phase !== 'rescuePrompt') return fail(`Unexpected declineRescue at seq ${i}`);
      state = declineRescue(state);
    } else {
      return fail(`Unknown action at seq ${i}`);
    }
  }

  if (bombActions !== receipt.bombPaidCount) {
    return fail('Bomb payment mismatch');
  }
  if (state.phase !== 'gameOver') {
    return fail('Match did not reach gameOver');
  }
  if (state.score !== receipt.claimedScore) {
    return fail('Score mismatch');
  }

  return {
    valid: true,
    verifiedScore: state.score,
    linesCleared: state.linesCleared,
    maxStreak: state.maxStreak,
  };
}
