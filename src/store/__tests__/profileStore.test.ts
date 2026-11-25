import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  DEFAULT_PROFILE,
  MAX_BLOCK_BLAST_SCORE,
  MAX_COOKIES,
  MAX_GAMES,
  MAX_SETTLED_MATCH_IDS,
  sanitizeProfileData,
  settleBlockBlastMatch,
} from '../profileSchema.ts';
import {
  computeHmacSha256Hex,
  safeJsonParse,
  unwrapSignedProfile,
  wrapSignedProfile,
} from '../profileIntegrity.ts';
import {
  calculateCookieReward,
  canPlacePiece,
  createInitialState,
  declineRescue,
  detonateCandyBombAt,
  placePiece,
} from '../../blockblast/engine/game.ts';
import type { MatchAction, MatchReceipt } from '../../blockblast/engine/verify.ts';

function playDeterministicMatchToEnd(
  seed: number,
  options: {
    rescueEligible?: boolean;
    rescueAction?: 'declineRescue' | 'bomb';
  } = {},
): {
  actions: MatchAction[];
  finalScore: number;
  bombPaidCount: number;
} {
  const rescueEligible = options.rescueEligible ?? false;
  const rescueAction = options.rescueAction ?? 'declineRescue';
  let state = createInitialState(seed);
  const actions: MatchAction[] = [];
  let seq = 0;
  let bombPaidCount = 0;

  while (state.phase !== 'gameOver' && seq < 500) {
    if (state.phase === 'rescuePrompt') {
      if (rescueAction === 'bomb') {
        const out = detonateCandyBombAt(state, 3, 3)!;
        actions.push({ seq: seq++, type: 'bomb', row: 3, col: 3 });
        bombPaidCount++;
        state = out.nextState;
        continue;
      }
      actions.push({ seq: seq++, type: 'declineRescue' });
      state = declineRescue(state);
      break;
    }

    let placed = false;
    for (let slotIndex = 0; slotIndex < state.tray.length && !placed; slotIndex++) {
      const piece = state.tray[slotIndex];
      if (!piece) continue;
      for (let r = 0; r < 8 && !placed; r++) {
        for (let c = 0; c < 8 && !placed; c++) {
          if (canPlacePiece(state.grid, piece, r, c)) {
            const out = placePiece(state, slotIndex, r, c, rescueEligible)!;
            actions.push({ seq: seq++, type: 'place', slotIndex, row: r, col: c });
            state = out.nextState;
            placed = true;
          }
        }
      }
    }
    if (!placed) break;
  }

  return { actions, finalScore: state.score, bombPaidCount };
}

describe('profileSchema accessory migration', () => {
  it('unlocks mu_jersey by default on fresh profile', () => {
    assert.ok(DEFAULT_PROFILE.unlockedAccessories.includes('mu_jersey'));
    const fresh = sanitizeProfileData({});
    assert.ok(fresh.unlockedAccessories.includes('mu_jersey'));
    assert.deepEqual(fresh.equippedAccessory, {});
  });

  it('always unlocks mu_jersey and migrates legacy single-string equippedAccessory', () => {
    const migrated = sanitizeProfileData({
      cookies: 40,
      selectedAnimal: 'dino',
      unlockedAccessories: ['scarf'],
      equippedAccessory: { dino: 'scarf' },
    });

    assert.equal(migrated.cookies, 40);
    assert.equal(migrated.selectedAnimal, 'dino');
    assert.ok(migrated.unlockedAccessories.includes('mu_jersey'));
    assert.ok(migrated.unlockedAccessories.includes('scarf'));
    assert.deepEqual(migrated.equippedAccessory.dino, ['scarf']);
  });

  it('normalizes multi-slot equippedAccessory records and drops invalid ids', () => {
    const migrated = sanitizeProfileData({
      unlockedAccessories: ['mu_jersey', 'scarf', 'crown'],
      equippedAccessory: {
        dog: ['mu_jersey', 'scarf', 'crown', 'bad_id'],
        cat: 'invalid_legacy_id',
      },
    });
    assert.deepEqual(migrated.equippedAccessory.dog, [
      'mu_jersey',
      'scarf',
      'crown',
    ]);
    assert.equal(migrated.equippedAccessory.cat, undefined);
  });
});

describe('profileIntegrity & anti-hack boundaries', () => {
  it('computes RFC 2104 HMAC-SHA256 matching node:crypto including UTF-8 payloads', () => {
    const msg = 'nonce123|1700000000|{"name":"Mèo Ú 🐾","cookies":120}';
    const expected = createHmac('sha256', 'PAWS-ARCADE-CABIN-INTEGRITY-2026-V2')
      .update(msg)
      .digest('hex');
    assert.equal(computeHmacSha256Hex(msg), expected);
  });

  it('wraps and verifies signed v2 profile envelope and rejects tampered cookies', () => {
    const wrapped = wrapSignedProfile({
      cookies: 120,
      blockBlastBestScore: 450,
      optionalField: undefined,
    });
    const ok = unwrapSignedProfile(wrapped);
    assert.equal(ok.status, 'valid_v2');
    assert.equal(ok.data?.cookies, 120);
    assert.equal(ok.data?.blockBlastBestScore, 450);

    const parsed = JSON.parse(wrapped) as {
      v: number;
      data: Record<string, unknown>;
      nonce: string;
      savedAt: number;
      sig: string;
    };
    parsed.data.cookies = 999999; // DevTools edit attack
    const tampered = unwrapSignedProfile(JSON.stringify(parsed));
    assert.equal(tampered.status, 'tampered');

    assert.equal(unwrapSignedProfile(null).status, 'empty');
    assert.equal(unwrapSignedProfile('   ').status, 'empty');
    assert.equal(unwrapSignedProfile('{not-json').status, 'tampered');
  });

  it('allows one-time migration of legitimate v1 legacy profiles but rejects spoofed v1 downgrades', () => {
    const legitV1 = JSON.stringify({ cookies: 80, selectedAnimal: 'cat', gamesPlayed: 2 });
    const migrated = unwrapSignedProfile(legitV1);
    assert.equal(migrated.status, 'legacy_v1');
    assert.equal(migrated.data?.cookies, 80);

    const spoofedScore = JSON.stringify({
      cookies: 9999,
      blockBlastBestScore: 50000,
    });
    assert.equal(unwrapSignedProfile(spoofedScore).status, 'tampered');

    const spoofedSettled = JSON.stringify({
      cookies: 9999,
      settledMatchIds: ['match-1'],
    });
    assert.equal(unwrapSignedProfile(spoofedSettled).status, 'tampered');

    const spoofedVersion = JSON.stringify({
      v: 1,
      cookies: 9999,
    });
    assert.equal(unwrapSignedProfile(spoofedVersion).status, 'tampered');

    const spoofedSig = JSON.stringify({
      sig: 'deadbeef',
      cookies: 9999,
    });
    assert.equal(unwrapSignedProfile(spoofedSig).status, 'tampered');
  });

  it('strips prototype pollution keys during JSON parse and clamps impossible bounds', () => {
    const malicious =
      '{"cookies": 50000000, "gamesWon": 99, "gamesPlayed": 2, "blockBlastBestScore": 99999999, "__proto__": {"polluted": true}, "constructor": {"prototype": {"hacked": true}}, "nested": {"prototype": {"x": 1}}}';
    const clean = safeJsonParse(malicious) as Record<string, unknown>;
    assert.equal(Object.hasOwn(clean, '__proto__'), false);
    assert.equal(Object.hasOwn(clean, 'constructor'), false);
    assert.equal(Object.hasOwn(clean.nested as Record<string, unknown>, 'prototype'), false);
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
    assert.equal(({} as Record<string, unknown>).hacked, undefined);

    const sanitized = sanitizeProfileData(clean);
    assert.equal(sanitized.cookies, MAX_COOKIES);
    assert.equal(sanitized.gamesWon, 2);
    assert.equal(sanitized.blockBlastBestScore, MAX_BLOCK_BLAST_SCORE);
    assert.deepEqual(sanitized.settledMatchIds, []);

    const zeroCookies = sanitizeProfileData({ cookies: 0 });
    assert.equal(zeroCookies.cookies, 0);

    const negCookies = sanitizeProfileData({ cookies: -50 });
    assert.equal(negCookies.cookies, DEFAULT_PROFILE.cookies);

    const ids = Array.from({ length: 25 }, (_, i) => `match-${String(i).padStart(2, '0')}`);
    const withIds = sanitizeProfileData({
      settledMatchIds: ['ab', ...ids, 'match-24', 123, 'x'.repeat(81)],
    });
    assert.equal(withIds.settledMatchIds.length, MAX_SETTLED_MATCH_IDS);
    assert.equal(withIds.settledMatchIds[0], 'match-05');
    assert.equal(withIds.settledMatchIds[MAX_SETTLED_MATCH_IDS - 1], 'match-24');

    const cappedGames = sanitizeProfileData({
      gamesPlayed: MAX_GAMES + 500,
      gamesWon: MAX_GAMES + 999,
      settings: {
        botCount: Number.NaN,
        difficulty: 'nightmare',
        sfxEnabled: 'yes',
      },
    });
    assert.equal(cappedGames.gamesPlayed, MAX_GAMES);
    assert.equal(cappedGames.gamesWon, MAX_GAMES);
    assert.equal(cappedGames.settings.botCount, DEFAULT_PROFILE.settings.botCount);
    assert.equal(cappedGames.settings.difficulty, DEFAULT_PROFILE.settings.difficulty);
    assert.equal(cappedGames.settings.sfxEnabled, DEFAULT_PROFILE.settings.sfxEnabled);
  });
});

describe('settleBlockBlastMatch anti-cheat settlement', () => {
  it('settles a legitimate MatchReceipt, awards cookies, updates best score, and records matchId', () => {
    const { actions, finalScore } = playDeterministicMatchToEnd(2026, {
      rescueEligible: true,
      rescueAction: 'declineRescue',
    });
    const receipt: MatchReceipt = {
      matchId: 'bb-legit-2026',
      seed: 2026,
      actions,
      claimedScore: finalScore,
      elapsedMs: actions.length * 400,
      bombPaidCount: 0,
      rescueEligible: true,
    };

    const expectedReward = calculateCookieReward(finalScore, DEFAULT_PROFILE.blockBlastBestScore);
    const result = settleBlockBlastMatch(DEFAULT_PROFILE, receipt, 0);

    assert.equal(result.ok, true);
    assert.equal(result.verifiedScore, finalScore);
    assert.equal(result.reward, expectedReward.reward);
    assert.equal(result.isNewBest, expectedReward.isNewBest);
    assert.equal(result.nextProfile.cookies, DEFAULT_PROFILE.cookies + expectedReward.reward);
    assert.equal(result.nextProfile.blockBlastBestScore, finalScore);
    assert.equal(result.nextProfile.gamesPlayed, 1);
    assert.equal(result.nextProfile.gamesWon, expectedReward.isNewBest ? 1 : 0);
    assert.deepEqual(result.nextProfile.settledMatchIds, ['bb-legit-2026']);
  });

  it('rejects double-claim with the same matchId', () => {
    const { actions, finalScore } = playDeterministicMatchToEnd(2026);
    const receipt: MatchReceipt = {
      matchId: 'bb-dup-1',
      seed: 2026,
      actions,
      claimedScore: finalScore,
      elapsedMs: actions.length * 400,
      bombPaidCount: 0,
      rescueEligible: false,
    };

    const first = settleBlockBlastMatch(DEFAULT_PROFILE, receipt, 0);
    assert.equal(first.ok, true);

    const second = settleBlockBlastMatch(first.nextProfile, receipt, 0);
    assert.equal(second.ok, false);
    assert.equal(second.reward, 0);
    assert.equal(second.verifiedScore, 0);
    assert.deepEqual(second.nextProfile, first.nextProfile);
  });

  it('rejects forged claimedScore without modifying profile', () => {
    const { actions, finalScore } = playDeterministicMatchToEnd(2026);
    const forged: MatchReceipt = {
      matchId: 'bb-forged-score',
      seed: 2026,
      actions,
      claimedScore: finalScore + 5000,
      elapsedMs: actions.length * 400,
      bombPaidCount: 0,
      rescueEligible: false,
    };

    const result = settleBlockBlastMatch(DEFAULT_PROFILE, forged, 0);
    assert.equal(result.ok, false);
    assert.equal(result.reward, 0);
    assert.deepEqual(result.nextProfile, DEFAULT_PROFILE);
  });

  it('rejects bombPaidCount: 1 when authorizedBombCount is 0, and accepts when authorizedBombCount is 1', () => {
    const { actions, finalScore, bombPaidCount } = playDeterministicMatchToEnd(2026, {
      rescueEligible: true,
      rescueAction: 'bomb',
    });
    assert.equal(bombPaidCount, 1);
    const receipt: MatchReceipt = {
      matchId: 'bb-bomb-auth-check',
      seed: 2026,
      actions,
      claimedScore: finalScore,
      elapsedMs: actions.length * 400,
      bombPaidCount: 1,
      rescueEligible: true,
    };

    const unauthorized = settleBlockBlastMatch(DEFAULT_PROFILE, receipt, 0);
    assert.equal(unauthorized.ok, false);
    assert.equal(unauthorized.reward, 0);
    assert.deepEqual(unauthorized.nextProfile, DEFAULT_PROFILE);

    const authorized = settleBlockBlastMatch(DEFAULT_PROFILE, receipt, 1);
    assert.equal(authorized.ok, true);
    assert.equal(authorized.verifiedScore, finalScore);
    assert.ok(authorized.nextProfile.settledMatchIds.includes('bb-bomb-auth-check'));
  });

  it('preserves higher bestScore when not beaten, rejects speed hacks, and caps settledMatchIds at 20', () => {
    const { actions, finalScore } = playDeterministicMatchToEnd(2026);
    const receipt: MatchReceipt = {
      matchId: 'bb-non-best-21',
      seed: 2026,
      actions,
      claimedScore: finalScore,
      elapsedMs: actions.length * 400,
      bombPaidCount: 0,
      rescueEligible: false,
    };

    const existingIds = Array.from(
      { length: MAX_SETTLED_MATCH_IDS },
      (_, i) => `prev-match-${String(i).padStart(2, '0')}`,
    );
    const higherBest = finalScore + 2500;
    const baseProfile = {
      ...DEFAULT_PROFILE,
      blockBlastBestScore: higherBest,
      gamesPlayed: 5,
      gamesWon: 2,
      settledMatchIds: existingIds,
    };

    const speedHack = settleBlockBlastMatch(
      baseProfile,
      { ...receipt, elapsedMs: 10 },
      0,
    );
    assert.equal(speedHack.ok, false);
    assert.deepEqual(speedHack.nextProfile, baseProfile);

    const expectedReward = calculateCookieReward(finalScore, higherBest);
    const settled = settleBlockBlastMatch(baseProfile, receipt, 0);
    assert.equal(settled.ok, true);
    assert.equal(settled.isNewBest, false);
    assert.equal(settled.reward, expectedReward.reward);
    assert.equal(settled.nextProfile.blockBlastBestScore, higherBest);
    assert.equal(settled.nextProfile.gamesPlayed, 6);
    assert.equal(settled.nextProfile.gamesWon, 2);
    assert.equal(settled.nextProfile.settledMatchIds.length, MAX_SETTLED_MATCH_IDS);
    assert.equal(settled.nextProfile.settledMatchIds[0], 'prev-match-01');
    assert.equal(settled.nextProfile.settledMatchIds[MAX_SETTLED_MATCH_IDS - 1], 'bb-non-best-21');
  });
});
