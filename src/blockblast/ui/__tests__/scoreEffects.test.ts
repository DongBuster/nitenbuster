import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRollDurationMs,
  interpolateScoreCounter,
  isBeatingBestScore,
  resolveScorePulseTier,
} from '../scoreEffects.ts';

describe('Block Blast score effects helpers', () => {
  it('1. classifies pulse tiers across allClear, bomb, combo, multi, and normal moves', () => {
    assert.equal(
      resolveScorePulseTier(
        {
          allClear: true,
          stageUp: true,
          clearedRows: [0],
          clearedCols: [],
          streakAfter: 2,
          destroyedByBomb: [],
        },
        'place',
      ),
      'allClear',
    );

    assert.equal(
      resolveScorePulseTier(
        {
          allClear: false,
          stageUp: false,
          clearedRows: [],
          clearedCols: [],
          streakAfter: 3,
          destroyedByBomb: [{ r: 2, c: 2 }],
        },
        'bomb',
      ),
      'bomb',
    );

    assert.equal(
      resolveScorePulseTier(
        {
          allClear: false,
          stageUp: false,
          clearedRows: [1],
          clearedCols: [],
          streakAfter: 2,
          destroyedByBomb: [],
        },
        'place',
      ),
      'combo',
    );

    assert.equal(
      resolveScorePulseTier(
        {
          allClear: false,
          stageUp: false,
          clearedRows: [1, 2],
          clearedCols: [],
          streakAfter: 1,
          destroyedByBomb: [],
        },
        'place',
      ),
      'multi',
    );

    assert.equal(
      resolveScorePulseTier(
        {
          allClear: false,
          stageUp: false,
          clearedRows: [],
          clearedCols: [],
          streakAfter: 0,
          destroyedByBomb: [],
        },
        'place',
      ),
      'normal',
    );
  });

  it('2. interpolates rolling score counter monotonically with clamped endpoints', () => {
    assert.equal(interpolateScoreCounter(100, 500, -0.2), 100);
    assert.equal(interpolateScoreCounter(100, 500, 0), 100);

    const early = interpolateScoreCounter(100, 500, 0.25);
    const mid = interpolateScoreCounter(100, 500, 0.5);
    const late = interpolateScoreCounter(100, 500, 0.8);
    assert.ok(early > 100 && early < mid);
    assert.ok(mid > 300, 'ease-out curve should pass halfway mark before t=0.5');
    assert.ok(late > mid && late < 500);

    assert.equal(interpolateScoreCounter(100, 500, 1), 500);
    assert.equal(interpolateScoreCounter(100, 500, 1.4), 500);
  });

  it('3. computes bounded roll durations scaled by delta and tier', () => {
    assert.equal(computeRollDurationMs(0, 'normal'), 0);
    assert.equal(computeRollDurationMs(-20, 'normal'), 0);

    const small = computeRollDurationMs(30, 'normal');
    const big = computeRollDurationMs(1200, 'allClear');
    assert.ok(small >= 220 && small <= 400);
    assert.ok(big > small && big <= 580);
  });

  it('4. detects overtaking an existing personal best score accurately', () => {
    assert.equal(isBeatingBestScore(120, 0), false);
    assert.equal(isBeatingBestScore(500, 500), false);
    assert.equal(isBeatingBestScore(510, 500), true);
  });
});
