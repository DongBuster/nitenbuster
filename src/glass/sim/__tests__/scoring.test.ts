import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateGlassResult, isNewGlassBest } from '../scoring.ts';

describe('calculateGlassResult', () => {
  it('awards 3 stars and 50 cookies when elapsedSec <= 180 and shatters <= 2', () => {
    assert.deepEqual(calculateGlassResult(120, 0), {
      stars: 3,
      cookies: 50,
      elapsedSec: 120,
      shatters: 0,
    });
    assert.deepEqual(calculateGlassResult(180, 2), {
      stars: 3,
      cookies: 50,
      elapsedSec: 180,
      shatters: 2,
    });
  });

  it('awards 2 stars and 30 cookies when exceeding 3-star thresholds but within <= 300s and <= 6 shatters', () => {
    assert.deepEqual(calculateGlassResult(180.1, 2), {
      stars: 2,
      cookies: 30,
      elapsedSec: 180.1,
      shatters: 2,
    });
    assert.deepEqual(calculateGlassResult(150, 3), {
      stars: 2,
      cookies: 30,
      elapsedSec: 150,
      shatters: 3,
    });
    assert.deepEqual(calculateGlassResult(300, 6), {
      stars: 2,
      cookies: 30,
      elapsedSec: 300,
      shatters: 6,
    });
  });

  it('awards 1 star and 15 cookies when exceeding 2-star time or shatter thresholds', () => {
    assert.deepEqual(calculateGlassResult(300.1, 6), {
      stars: 1,
      cookies: 15,
      elapsedSec: 300.1,
      shatters: 6,
    });
    assert.deepEqual(calculateGlassResult(200, 7), {
      stars: 1,
      cookies: 15,
      elapsedSec: 200,
      shatters: 7,
    });
    assert.deepEqual(calculateGlassResult(420, 12), {
      stars: 1,
      cookies: 15,
      elapsedSec: 420,
      shatters: 12,
    });
  });
});

describe('isNewGlassBest', () => {
  it('returns true when there is no previous best time', () => {
    assert.equal(isNewGlassBest(null, 0, 250, 1), true);
  });

  it('returns true when nextStars is higher than prevBestStars regardless of time', () => {
    assert.equal(isNewGlassBest(140, 2, 175, 3), true);
    assert.equal(isNewGlassBest(250, 1, 290, 2), true);
  });

  it('returns true when stars are equal and nextElapsedSec is strictly faster', () => {
    assert.equal(isNewGlassBest(180, 3, 179.5, 3), true);
    assert.equal(isNewGlassBest(250, 2, 240, 2), true);
  });

  it('returns false when stars are lower or time is equal or slower at equal stars', () => {
    assert.equal(isNewGlassBest(180, 3, 180, 3), false);
    assert.equal(isNewGlassBest(180, 3, 185, 3), false);
    assert.equal(isNewGlassBest(200, 3, 120, 2), false);
  });
});
