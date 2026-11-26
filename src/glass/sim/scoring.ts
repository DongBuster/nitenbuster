import { COOKIE_REWARDS, STAR_THRESHOLDS } from './constants.ts';
import type { GlassResultSummary } from './types.ts';

/** Computes star rating and cookie reward for a completed Glass Carry run. */
export function calculateGlassResult(
  elapsedSec: number,
  shatters: number,
): GlassResultSummary {
  let stars: 1 | 2 | 3 = 1;
  if (
    elapsedSec <= STAR_THRESHOLDS.three.maxElapsedSec &&
    shatters <= STAR_THRESHOLDS.three.maxShatters
  ) {
    stars = 3;
  } else if (
    elapsedSec <= STAR_THRESHOLDS.two.maxElapsedSec &&
    shatters <= STAR_THRESHOLDS.two.maxShatters
  ) {
    stars = 2;
  }

  return {
    stars,
    cookies: COOKIE_REWARDS[stars],
    elapsedSec,
    shatters,
  };
}

/** Returns whether the new run beats the recorded best stars or fastest time at equal stars. */
export function isNewGlassBest(
  prevBestTimeSec: number | null,
  prevBestStars: number,
  nextElapsedSec: number,
  nextStars: number,
): boolean {
  if (prevBestTimeSec === null) return true;
  if (nextStars !== prevBestStars) return nextStars > prevBestStars;
  return nextElapsedSec < prevBestTimeSec;
}
