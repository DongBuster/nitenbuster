import type { MoveOutcome } from '../engine/types.ts';

export type ScorePulseTier = 'normal' | 'multi' | 'combo' | 'bomb' | 'allClear';

export interface ScorePulseEvent {
  seq: number;
  points: number;
  tier: ScorePulseTier;
}

/**
 * Determine visual celebration intensity for the scoreboard pulse from a move outcome.
 */
export function resolveScorePulseTier(
  outcome: Pick<
    MoveOutcome,
    'allClear' | 'stageUp' | 'clearedRows' | 'clearedCols' | 'streakAfter' | 'destroyedByBomb'
  >,
  source: 'place' | 'bomb',
): ScorePulseTier {
  if (outcome.allClear || outcome.stageUp) {
    return 'allClear';
  }
  if (source === 'bomb' || outcome.destroyedByBomb.length > 0) {
    return 'bomb';
  }
  const lineCount = outcome.clearedRows.length + outcome.clearedCols.length;
  if (lineCount > 0 && outcome.streakAfter >= 2) {
    return 'combo';
  }
  if (lineCount >= 2) {
    return 'multi';
  }
  return 'normal';
}

/**
 * Compute bounded roll animation duration scaled by points gained and move tier.
 */
export function computeRollDurationMs(
  delta: number,
  tier: ScorePulseTier,
): number {
  if (!Number.isFinite(delta) || delta <= 0) {
    return 0;
  }
  const tierBonus =
    tier === 'allClear'
      ? 80
      : tier === 'combo' || tier === 'bomb'
        ? 45
        : tier === 'multi'
          ? 25
          : 0;
  const raw = 240 + Math.min(220, Math.round(Math.sqrt(delta) * 11)) + tierBonus;
  return Math.min(580, raw);
}

/**
 * Ease-out cubic interpolation for the rolling scoreboard digit display.
 */
export function interpolateScoreCounter(
  fromScore: number,
  toScore: number,
  progress: number,
): number {
  if (!Number.isFinite(progress) || progress <= 0) {
    return Math.round(fromScore);
  }
  if (progress >= 1) {
    return Math.round(toScore);
  }
  const eased = 1 - Math.pow(1 - progress, 3);
  return Math.round(fromScore + (toScore - fromScore) * eased);
}

/**
 * Return true only once the player overtakes a non-zero prior personal best score.
 */
export function isBeatingBestScore(score: number, bestScore: number): boolean {
  return (
    Number.isFinite(score) &&
    Number.isFinite(bestScore) &&
    bestScore > 0 &&
    score > bestScore
  );
}
