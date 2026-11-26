import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROFILE,
  settleEventMatch,
} from '../profileSchema.ts';

describe('settleEventMatch', () => {
  it('awards tiered Cookies by rank and increments gamesWon only for rank 1', () => {
    const win = settleEventMatch(DEFAULT_PROFILE, {
      matchId: 'evt-match-001',
      rank: 1,
      totalPlayers: 4,
    });
    assert.equal(win.ok, true);
    assert.equal(win.reward, 80);
    assert.equal(win.nextProfile.cookies, DEFAULT_PROFILE.cookies + 80);
    assert.equal(win.nextProfile.gamesPlayed, 1);
    assert.equal(win.nextProfile.gamesWon, 1);

    const second = settleEventMatch(win.nextProfile, {
      matchId: 'evt-match-002',
      rank: 2,
      totalPlayers: 4,
    });
    assert.equal(second.ok, true);
    assert.equal(second.reward, 50);
    assert.equal(second.nextProfile.gamesPlayed, 2);
    assert.equal(second.nextProfile.gamesWon, 1);

    const third = settleEventMatch(second.nextProfile, {
      matchId: 'evt-match-003',
      rank: 3,
      totalPlayers: 4,
    });
    assert.equal(third.reward, 30);

    const fifth = settleEventMatch(third.nextProfile, {
      matchId: 'evt-match-004',
      rank: 5,
      totalPlayers: 6,
    });
    assert.equal(fifth.reward, 15);
  });

  it('rejects duplicate matchId settlement idempotently and rejects invalid payloads', () => {
    const first = settleEventMatch(DEFAULT_PROFILE, {
      matchId: 'evt-match-dup',
      rank: 1,
      totalPlayers: 3,
    });
    assert.equal(first.ok, true);

    const dup = settleEventMatch(first.nextProfile, {
      matchId: 'evt-match-dup',
      rank: 1,
      totalPlayers: 3,
    });
    assert.equal(dup.ok, false);
    assert.equal(dup.reward, 0);
    assert.equal(dup.nextProfile.cookies, first.nextProfile.cookies);

    const invalid = settleEventMatch(DEFAULT_PROFILE, {
      matchId: 'x',
      rank: 0,
      totalPlayers: 1,
    });
    assert.equal(invalid.ok, false);
  });
});
