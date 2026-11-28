import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  DEFAULT_PROFILE,
  MAX_BLOCK_BLAST_SCORE,
  MAX_COOKIES,
  MAX_GAMES,
  MAX_GLASS_TIME_SEC,
  MAX_SETTLED_MATCH_IDS,
  applyBlockBlastStageProgress,
  sanitizeProfileData,
  settleBlockBlastMatch,
  settleCoopMatch,
  settleGlassCarryMatch,
  settleSurvivalMatch,
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

    const spoofedV2Fields = [
      { cookies: 9999, survivalBestScore: 50000 },
      { cookies: 9999, survivalBestTimeSec: 900 },
      { cookies: 9999, survivalWins: 5 },
      { cookies: 9999, coopRecords: { glass_carry: { bestStars: 3, bestTimeSec: 90 } } },
      { cookies: 9999, glassBestTimeSec: 90 },
      { cookies: 9999, glassBestStars: 3 },
    ];
    for (const payload of spoofedV2Fields) {
      assert.equal(unwrapSignedProfile(JSON.stringify(payload)).status, 'tampered');
    }
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

  it('unlocks Stage 5/10/15/20 avatar frames via applyBlockBlastStageProgress and sanitizes equipped frame', () => {
    const s4 = applyBlockBlastStageProgress(DEFAULT_PROFILE, 4);
    assert.equal(s4.nextProfile.blockBlastBestStage, 4);
    assert.deepEqual(s4.newlyUnlockedFrames, []);
    assert.equal(s4.nextProfile.equippedAvatarFrame, null);

    const s5 = applyBlockBlastStageProgress(s4.nextProfile, 5);
    assert.deepEqual(s5.newlyUnlockedFrames, ['frame_stage_5']);
    assert.deepEqual(s5.nextProfile.unlockedAvatarFrames, ['frame_stage_5']);
    assert.equal(s5.nextProfile.equippedAvatarFrame, 'frame_stage_5');

    const s15 = applyBlockBlastStageProgress(s5.nextProfile, 15);
    assert.deepEqual(s15.newlyUnlockedFrames, ['frame_stage_10', 'frame_stage_15']);
    assert.deepEqual(s15.nextProfile.unlockedAvatarFrames, [
      'frame_stage_5',
      'frame_stage_10',
      'frame_stage_15',
    ]);
    // Keeps user's previously equipped frame rather than clobbering their choice
    assert.equal(s15.nextProfile.equippedAvatarFrame, 'frame_stage_5');

    // Sanitizer rejects locked or forged equippedAvatarFrame
    const tampered = sanitizeProfileData({
      ...DEFAULT_PROFILE,
      blockBlastBestStage: 2,
      unlockedAvatarFrames: ['bogus_frame'],
      equippedAvatarFrame: 'frame_stage_20',
    });
    assert.deepEqual(tampered.unlockedAvatarFrames, []);
    assert.equal(tampered.equippedAvatarFrame, null);
  });
});

describe('settleGlassCarryMatch', () => {
  it('defaults glassBestTimeSec to null and glassBestStars to 0 on fresh/legacy profiles and sanitizes bounds', () => {
    assert.equal(DEFAULT_PROFILE.glassBestTimeSec, null);
    assert.equal(DEFAULT_PROFILE.glassBestStars, 0);

    const legacy = sanitizeProfileData({ cookies: 80, selectedAnimal: 'cat' });
    assert.equal(legacy.glassBestTimeSec, null);
    assert.equal(legacy.glassBestStars, 0);

    const invalid = sanitizeProfileData({
      glassBestTimeSec: -10,
      glassBestStars: 99,
    });
    assert.equal(invalid.glassBestTimeSec, null);
    assert.equal(invalid.glassBestStars, 3);

    const roundedAndClamped = sanitizeProfileData({
      glassBestTimeSec: MAX_GLASS_TIME_SEC + 500,
      glassBestStars: -2,
    });
    assert.equal(roundedAndClamped.glassBestTimeSec, MAX_GLASS_TIME_SEC);
    assert.equal(roundedAndClamped.glassBestStars, 0);

    const twoDecimals = sanitizeProfileData({
      glassBestTimeSec: 123.4567,
      glassBestStars: 2.9,
    });
    assert.equal(twoDecimals.glassBestTimeSec, 123.46);
    assert.equal(twoDecimals.glassBestStars, 2);
  });

  it('awards 3/2/1 star cookie rewards (50/30/15), increments gamesPlayed/gamesWon, and updates best time & stars', () => {
    const threeStar = settleGlassCarryMatch(DEFAULT_PROFILE, {
      matchId: 'glass-3star-1',
      elapsedSec: 120.345,
      shatters: 1,
    });
    assert.equal(threeStar.ok, true);
    assert.equal(threeStar.stars, 3);
    assert.equal(threeStar.reward, 50);
    assert.equal(threeStar.isNewBest, true);
    assert.equal(threeStar.nextProfile.cookies, DEFAULT_PROFILE.cookies + 50);
    assert.equal(threeStar.nextProfile.gamesPlayed, 1);
    assert.equal(threeStar.nextProfile.gamesWon, 1);
    assert.equal(threeStar.nextProfile.glassBestStars, 3);
    assert.equal(threeStar.nextProfile.glassBestTimeSec, 120.35);
    assert.deepEqual(threeStar.nextProfile.settledMatchIds, ['glass-3star-1']);

    const twoStar = settleGlassCarryMatch(DEFAULT_PROFILE, {
      matchId: 'glass-2star-1',
      elapsedSec: 250,
      shatters: 4,
    });
    assert.equal(twoStar.ok, true);
    assert.equal(twoStar.stars, 2);
    assert.equal(twoStar.reward, 30);
    assert.equal(twoStar.isNewBest, true);
    assert.equal(twoStar.nextProfile.cookies, DEFAULT_PROFILE.cookies + 30);
    assert.equal(twoStar.nextProfile.glassBestStars, 2);
    assert.equal(twoStar.nextProfile.glassBestTimeSec, 250);

    const oneStar = settleGlassCarryMatch(DEFAULT_PROFILE, {
      matchId: 'glass-1star-1',
      elapsedSec: 400,
      shatters: 8,
    });
    assert.equal(oneStar.ok, true);
    assert.equal(oneStar.stars, 1);
    assert.equal(oneStar.reward, 15);
    assert.equal(oneStar.isNewBest, true);
    assert.equal(oneStar.nextProfile.cookies, DEFAULT_PROFILE.cookies + 15);
    assert.equal(oneStar.nextProfile.glassBestStars, 1);
    assert.equal(oneStar.nextProfile.glassBestTimeSec, 400);
  });

  it('rejects duplicate matchId and invalid payloads without modifying profile', () => {
    const first = settleGlassCarryMatch(DEFAULT_PROFILE, {
      matchId: 'glass-dup-01',
      elapsedSec: 150,
      shatters: 0,
    });
    assert.equal(first.ok, true);

    const duplicate = settleGlassCarryMatch(first.nextProfile, {
      matchId: 'glass-dup-01',
      elapsedSec: 90,
      shatters: 0,
    });
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.reward, 0);
    assert.equal(duplicate.stars, 1);
    assert.equal(duplicate.isNewBest, false);
    assert.deepEqual(duplicate.nextProfile, first.nextProfile);

    const badPayloads = [
      { matchId: 'ab', elapsedSec: 100, shatters: 0 },
      { matchId: 'x'.repeat(81), elapsedSec: 100, shatters: 0 },
      { matchId: 'glass-bad-time', elapsedSec: 0, shatters: 0 },
      { matchId: 'glass-bad-time-2', elapsedSec: MAX_GLASS_TIME_SEC + 1, shatters: 0 },
      { matchId: 'glass-bad-shatter', elapsedSec: 100, shatters: -1 },
      { matchId: 'glass-bad-shatter-2', elapsedSec: 100, shatters: Number.NaN },
    ];
    for (const payload of badPayloads) {
      const res = settleGlassCarryMatch(DEFAULT_PROFILE, payload);
      assert.equal(res.ok, false);
      assert.equal(res.reward, 0);
      assert.deepEqual(res.nextProfile, DEFAULT_PROFILE);
    }
  });

  it('preserves better stars and faster time on slower/lower-star runs while still awarding cookies for a new matchId', () => {
    const initial = settleGlassCarryMatch(DEFAULT_PROFILE, {
      matchId: 'glass-run-1',
      elapsedSec: 140,
      shatters: 1,
    });
    assert.equal(initial.ok, true);
    assert.equal(initial.stars, 3);
    assert.equal(initial.nextProfile.glassBestStars, 3);
    assert.equal(initial.nextProfile.glassBestTimeSec, 140);

    // Slower & lower-star run with a new matchId
    const slowerLower = settleGlassCarryMatch(initial.nextProfile, {
      matchId: 'glass-run-2',
      elapsedSec: 320,
      shatters: 7,
    });
    assert.equal(slowerLower.ok, true);
    assert.equal(slowerLower.stars, 1);
    assert.equal(slowerLower.reward, 15);
    assert.equal(slowerLower.isNewBest, false);
    assert.equal(slowerLower.nextProfile.cookies, initial.nextProfile.cookies + 15);
    assert.equal(slowerLower.nextProfile.gamesPlayed, 2);
    assert.equal(slowerLower.nextProfile.gamesWon, 2);
    assert.equal(slowerLower.nextProfile.glassBestStars, 3);
    assert.equal(slowerLower.nextProfile.glassBestTimeSec, 140);

    // Faster time with 3 stars beats previous 140s best
    const fasterBest = settleGlassCarryMatch(slowerLower.nextProfile, {
      matchId: 'glass-run-3',
      elapsedSec: 98.42,
      shatters: 0,
    });
    assert.equal(fasterBest.ok, true);
    assert.equal(fasterBest.stars, 3);
    assert.equal(fasterBest.reward, 50);
    assert.equal(fasterBest.isNewBest, true);
    assert.equal(fasterBest.nextProfile.glassBestStars, 3);
    assert.equal(fasterBest.nextProfile.glassBestTimeSec, 98.42);
    assert.deepEqual(fasterBest.nextProfile.coopRecords.glass_carry, {
      bestStars: 3,
      bestTimeSec: 98.42,
    });
  });
});

describe('settleCoopMatch & multi-map coopRecords migration', () => {
  it('defaults coopRecords to {} and sanitizes valid/invalid coopRecords entries', () => {
    assert.deepEqual(DEFAULT_PROFILE.coopRecords, {});

    const sanitized = sanitizeProfileData({
      coopRecords: {
        raft_rapids: { bestStars: 99, bestTimeSec: 125.678 },
        rope_tether: { bestStars: 2.9, bestTimeSec: MAX_GLASS_TIME_SEC + 100 },
        minecart_rails: { bestStars: 0, bestTimeSec: 110 },
        glass_carry: { bestStars: 3, bestTimeSec: -5 },
        invalid_map: { bestStars: 3, bestTimeSec: 100 },
      },
    });

    assert.deepEqual(sanitized.coopRecords, {
      raft_rapids: { bestStars: 3, bestTimeSec: 125.68 },
      rope_tether: { bestStars: 2, bestTimeSec: MAX_GLASS_TIME_SEC },
    });
  });

  it('migrates legacy glassBestStars/glassBestTimeSec into coopRecords.glass_carry and vice versa', () => {
    const fromLegacy = sanitizeProfileData({
      glassBestStars: 2,
      glassBestTimeSec: 210.5,
    });
    assert.deepEqual(fromLegacy.coopRecords.glass_carry, {
      bestStars: 2,
      bestTimeSec: 210.5,
    });
    assert.equal(fromLegacy.glassBestStars, 2);
    assert.equal(fromLegacy.glassBestTimeSec, 210.5);

    const fromCoopRecords = sanitizeProfileData({
      coopRecords: {
        glass_carry: { bestStars: 3, bestTimeSec: 132.4 },
      },
    });
    assert.equal(fromCoopRecords.glassBestStars, 3);
    assert.equal(fromCoopRecords.glassBestTimeSec, 132.4);
    assert.deepEqual(fromCoopRecords.coopRecords.glass_carry, {
      bestStars: 3,
      bestTimeSec: 132.4,
    });
  });

  it('settles matches across all co-op maps independently, syncing glass_carry legacy fields', () => {
    const raftRun = settleCoopMatch(DEFAULT_PROFILE, {
      matchId: 'coop-raft-1',
      mapId: 'raft_rapids',
      elapsedSec: 135.456,
      failures: 1,
    });
    assert.equal(raftRun.ok, true);
    assert.equal(raftRun.mapId, 'raft_rapids');
    assert.equal(raftRun.stars, 3);
    assert.equal(raftRun.reward, 50);
    assert.equal(raftRun.isNewBest, true);
    assert.equal(raftRun.nextProfile.cookies, DEFAULT_PROFILE.cookies + 50);
    assert.deepEqual(raftRun.nextProfile.coopRecords.raft_rapids, {
      bestStars: 3,
      bestTimeSec: 135.46,
    });
    // Legacy glass fields remain untouched for non-glass maps
    assert.equal(raftRun.nextProfile.glassBestStars, 0);
    assert.equal(raftRun.nextProfile.glassBestTimeSec, null);

    // Slower run on raft_rapids preserves best time & stars
    const slowerRaft = settleCoopMatch(raftRun.nextProfile, {
      matchId: 'coop-raft-2',
      mapId: 'raft_rapids',
      elapsedSec: 190,
      failures: 4,
    });
    assert.equal(slowerRaft.ok, true);
    assert.equal(slowerRaft.stars, 2);
    assert.equal(slowerRaft.reward, 30);
    assert.equal(slowerRaft.isNewBest, false);
    assert.deepEqual(slowerRaft.nextProfile.coopRecords.raft_rapids, {
      bestStars: 3,
      bestTimeSec: 135.46,
    });

    // Settling glass_carry via settleCoopMatch also updates legacy fields
    const glassRun = settleCoopMatch(slowerRaft.nextProfile, {
      matchId: 'coop-glass-1',
      mapId: 'glass_carry',
      elapsedSec: 150,
      failures: 0,
    });
    assert.equal(glassRun.ok, true);
    assert.equal(glassRun.mapId, 'glass_carry');
    assert.equal(glassRun.stars, 3);
    assert.equal(glassRun.nextProfile.glassBestStars, 3);
    assert.equal(glassRun.nextProfile.glassBestTimeSec, 150);
    assert.deepEqual(glassRun.nextProfile.coopRecords.glass_carry, {
      bestStars: 3,
      bestTimeSec: 150,
    });
  });

  it('rejects duplicate matchId and invalid payloads in settleCoopMatch without mutating profile', () => {
    const first = settleCoopMatch(DEFAULT_PROFILE, {
      matchId: 'coop-minecart-1',
      mapId: 'minecart_rails',
      elapsedSec: 140,
      failures: 0,
    });
    assert.equal(first.ok, true);

    const dup = settleCoopMatch(first.nextProfile, {
      matchId: 'coop-minecart-1',
      mapId: 'minecart_rails',
      elapsedSec: 100,
      failures: 0,
    });
    assert.equal(dup.ok, false);
    assert.equal(dup.reward, 0);
    assert.deepEqual(dup.nextProfile, first.nextProfile);

    const invalidMap = settleCoopMatch(DEFAULT_PROFILE, {
      matchId: 'coop-bad-map',
      mapId: 'unknown_map' as never,
      elapsedSec: 100,
      failures: 0,
    });
    assert.equal(invalidMap.ok, false);
    assert.deepEqual(invalidMap.nextProfile, DEFAULT_PROFILE);

    const invalidElapsed = settleCoopMatch(DEFAULT_PROFILE, {
      matchId: 'coop-bad-time',
      mapId: 'rope_tether',
      elapsedSec: 0,
      failures: 0,
    });
    assert.equal(invalidElapsed.ok, false);
    assert.deepEqual(invalidElapsed.nextProfile, DEFAULT_PROFILE);

    const invalidFailures = settleCoopMatch(DEFAULT_PROFILE, {
      matchId: 'coop-bad-fail',
      mapId: 'rope_tether',
      elapsedSec: 120,
      failures: -1,
    });
    assert.equal(invalidFailures.ok, false);
    assert.deepEqual(invalidFailures.nextProfile, DEFAULT_PROFILE);
  });
});

describe('coopLevelRecords multi-level persistence, migration & settlement', () => {
  it('defaults coopLevelRecords to {} and sanitizes only playable stage keys with clamped stats', () => {
    assert.deepEqual(DEFAULT_PROFILE.coopLevelRecords, {});

    const sanitized = sanitizeProfileData({
      coopLevelRecords: {
        'glass_carry:cabin_bridge:1': { bestStars: 5, bestTimeSec: 64.129 },
        'glass_carry:sky_scaffold:3': { bestStars: 2.7, bestTimeSec: MAX_GLASS_TIME_SEC + 50 },
        'raft_rapids:glacier_river:2': { bestStars: 3, bestTimeSec: 90 }, // comingSoon -> dropped
        'glass_carry:cabin_bridge:6': { bestStars: 3, bestTimeSec: 90 }, // invalid level -> dropped
        'unknown_action:pack:1': { bestStars: 3, bestTimeSec: 90 }, // unknown action -> dropped
        'glass_carry:candy_factory:1': { bestStars: 0, bestTimeSec: 70 }, // < 1 star -> dropped
        'glass_carry:candy_factory:2': { bestStars: 2, bestTimeSec: -5 }, // <= 0 time -> dropped
      },
    });

    assert.deepEqual(sanitized.coopLevelRecords, {
      'glass_carry:cabin_bridge:1': { bestStars: 3, bestTimeSec: 64.13 },
      'glass_carry:sky_scaffold:3': { bestStars: 2, bestTimeSec: MAX_GLASS_TIME_SEC },
    });
  });

  it('migrates legacy coopRecords/glass fields into default pack L1 and vice versa', () => {
    const fromLegacy = sanitizeProfileData({
      glassBestStars: 3,
      glassBestTimeSec: 142.5,
      coopRecords: {
        raft_rapids: { bestStars: 2, bestTimeSec: 185 },
      },
    });
    assert.deepEqual(fromLegacy.coopLevelRecords['glass_carry:cabin_bridge:1'], {
      bestStars: 3,
      bestTimeSec: 142.5,
    });
    assert.deepEqual(fromLegacy.coopLevelRecords['raft_rapids:glacier_river:1'], {
      bestStars: 2,
      bestTimeSec: 185,
    });

    const fromLevelRecords = sanitizeProfileData({
      coopLevelRecords: {
        'glass_carry:cabin_bridge:1': { bestStars: 3, bestTimeSec: 68.4 },
        'rope_tether:lantern_peaks:1': { bestStars: 2, bestTimeSec: 210 },
      },
    });
    assert.deepEqual(fromLevelRecords.coopRecords.glass_carry, {
      bestStars: 3,
      bestTimeSec: 68.4,
    });
    assert.equal(fromLevelRecords.glassBestStars, 3);
    assert.equal(fromLevelRecords.glassBestTimeSec, 68.4);
    assert.deepEqual(fromLevelRecords.coopRecords.rope_tether, {
      bestStars: 2,
      bestTimeSec: 210,
    });
  });

  it('settles explicit pack & level stages using level thresholds, unlocks next level, and rejects comingSoon/invalid stages', () => {
    // L1 cabin_bridge: 3* <= 75s & <=1 failure, 2* <= 125s & <=4 failures
    const l1Run = settleCoopMatch(DEFAULT_PROFILE, {
      matchId: 'coop-3lvl-l1-1',
      mapId: 'glass_carry',
      mapPackId: 'cabin_bridge',
      level: 1,
      elapsedSec: 70.126,
      failures: 1,
    });
    assert.equal(l1Run.ok, true);
    assert.equal(l1Run.mapId, 'glass_carry');
    assert.equal(l1Run.mapPackId, 'cabin_bridge');
    assert.equal(l1Run.level, 1);
    assert.equal(l1Run.stageKey, 'glass_carry:cabin_bridge:1');
    assert.equal(l1Run.stars, 3);
    assert.equal(l1Run.reward, 50);
    assert.equal(l1Run.isNewBest, true);
    assert.equal(l1Run.unlockedNextLevel, 2);
    assert.deepEqual(l1Run.nextProfile.coopLevelRecords['glass_carry:cabin_bridge:1'], {
      bestStars: 3,
      bestTimeSec: 70.13,
    });
    assert.deepEqual(l1Run.nextProfile.coopRecords.glass_carry, {
      bestStars: 3,
      bestTimeSec: 70.13,
    });
    assert.equal(l1Run.nextProfile.glassBestStars, 3);
    assert.equal(l1Run.nextProfile.glassBestTimeSec, 70.13);

    // Re-running L1 does not re-announce unlockedNextLevel
    const l1Replay = settleCoopMatch(l1Run.nextProfile, {
      matchId: 'coop-3lvl-l1-2',
      mapId: 'glass_carry',
      mapPackId: 'cabin_bridge',
      level: 1,
      elapsedSec: 95,
      failures: 1,
    });
    assert.equal(l1Replay.ok, true);
    assert.equal(l1Replay.stars, 2);
    assert.equal(l1Replay.isNewBest, false);
    assert.equal(l1Replay.unlockedNextLevel, null);

    // Settling L2 unlocks L3
    const l2Run = settleCoopMatch(l1Replay.nextProfile, {
      matchId: 'coop-3lvl-l2-1',
      mapId: 'glass_carry',
      mapPackId: 'cabin_bridge',
      level: 2,
      elapsedSec: 100,
      failures: 1,
    });
    assert.equal(l2Run.ok, true);
    assert.equal(l2Run.level, 2);
    assert.equal(l2Run.stageKey, 'glass_carry:cabin_bridge:2');
    assert.equal(l2Run.stars, 3);
    assert.equal(l2Run.unlockedNextLevel, 3);

    // Settling L5 on candy_factory has no next level to unlock
    const l5Run = settleCoopMatch(DEFAULT_PROFILE, {
      matchId: 'coop-3lvl-candy-l5',
      mapId: 'glass_carry',
      mapPackId: 'candy_factory',
      level: 5,
      elapsedSec: 200,
      failures: 2,
    });
    assert.equal(l5Run.ok, true);
    assert.equal(l5Run.mapPackId, 'candy_factory');
    assert.equal(l5Run.level, 5);
    assert.equal(l5Run.stars, 3);
    assert.equal(l5Run.unlockedNextLevel, null);

    // Rejects comingSoon level (raft_rapids level 2)
    const comingSoonRes = settleCoopMatch(DEFAULT_PROFILE, {
      matchId: 'coop-coming-soon',
      mapId: 'raft_rapids',
      mapPackId: 'glacier_river',
      level: 2,
      elapsedSec: 100,
      failures: 0,
    });
    assert.equal(comingSoonRes.ok, false);
    assert.equal(comingSoonRes.reward, 0);
    assert.equal(comingSoonRes.unlockedNextLevel, null);
    assert.deepEqual(comingSoonRes.nextProfile, DEFAULT_PROFILE);

    // Rejects invalid level and unknown pack
    const invalidLevel = settleCoopMatch(DEFAULT_PROFILE, {
      matchId: 'coop-bad-lvl',
      mapId: 'glass_carry',
      mapPackId: 'cabin_bridge',
      level: 99 as never,
      elapsedSec: 60,
      failures: 0,
    });
    assert.equal(invalidLevel.ok, false);
    assert.deepEqual(invalidLevel.nextProfile, DEFAULT_PROFILE);

    const invalidPack = settleCoopMatch(DEFAULT_PROFILE, {
      matchId: 'coop-bad-pack',
      mapId: 'glass_carry',
      mapPackId: 'nonexistent_pack',
      level: 1,
      elapsedSec: 60,
      failures: 0,
    });
    assert.equal(invalidPack.ok, false);
    assert.deepEqual(invalidPack.nextProfile, DEFAULT_PROFILE);
  });
});

describe('settleSurvivalMatch & survival profile migration', () => {
  it('defaults survival fields to 0 on fresh/legacy profiles and clamps bounds in sanitizeProfileData', () => {
    assert.equal(DEFAULT_PROFILE.survivalBestScore, 0);
    assert.equal(DEFAULT_PROFILE.survivalBestTimeSec, 0);
    assert.equal(DEFAULT_PROFILE.survivalWins, 0);

    const legacy = sanitizeProfileData({ cookies: 80, selectedAnimal: 'cat' });
    assert.equal(legacy.survivalBestScore, 0);
    assert.equal(legacy.survivalBestTimeSec, 0);
    assert.equal(legacy.survivalWins, 0);

    const clamped = sanitizeProfileData({
      survivalBestScore: MAX_BLOCK_BLAST_SCORE + 999,
      survivalBestTimeSec: MAX_GLASS_TIME_SEC + 50,
      survivalWins: MAX_GAMES + 100,
    });
    assert.equal(clamped.survivalBestScore, MAX_BLOCK_BLAST_SCORE);
    assert.equal(clamped.survivalBestTimeSec, MAX_GLASS_TIME_SEC);
    assert.equal(clamped.survivalWins, MAX_GAMES);

    const flooredAndNegative = sanitizeProfileData({
      survivalBestScore: 1234.9,
      survivalBestTimeSec: 365.7,
      survivalWins: -4,
    });
    assert.equal(flooredAndNegative.survivalBestScore, 1234);
    assert.equal(flooredAndNegative.survivalBestTimeSec, 365);
    assert.equal(flooredAndNegative.survivalWins, 0);
  });

  it('awards campaign victory cookies scaled by map difficulty multiplier (winter 1x, candy 1.25x, crystal 1.55x) and increments survivalWins', () => {
    const baseWin = settleSurvivalMatch(DEFAULT_PROFILE, {
      matchId: 'surv-win-360',
      mapId: 'winter_cabin',
      victory: true,
      score: 14500.8,
      elapsedSec: 360.9,
    });
    assert.equal(baseWin.ok, true);
    assert.equal(baseWin.reward, 60); // 60 * 1.0
    assert.equal(baseWin.isNewBestScore, true);
    assert.equal(baseWin.isNewBestTime, true);
    assert.equal(baseWin.nextProfile.cookies, DEFAULT_PROFILE.cookies + 60);
    assert.equal(baseWin.nextProfile.gamesPlayed, 1);
    assert.equal(baseWin.nextProfile.gamesWon, 1);
    assert.equal(baseWin.nextProfile.survivalWins, 1);
    assert.equal(baseWin.nextProfile.survivalBestScore, 14500);
    assert.equal(baseWin.nextProfile.survivalBestTimeSec, 360);
    assert.deepEqual(baseWin.nextProfile.settledMatchIds, ['surv-win-360']);

    const bonusWin = settleSurvivalMatch(baseWin.nextProfile, {
      matchId: 'surv-win-540',
      mapId: 'crystal_cavern',
      victory: true,
      score: 24000,
      elapsedSec: 540,
    });
    assert.equal(bonusWin.ok, true);
    assert.equal(bonusWin.reward, Math.round(90 * 1.55)); // 140
    assert.equal(bonusWin.nextProfile.survivalWins, 2);
    assert.equal(bonusWin.nextProfile.survivalBestScore, 24000);
    assert.equal(bonusWin.nextProfile.survivalBestTimeSec, 540);

    const cappedWin = settleSurvivalMatch(bonusWin.nextProfile, {
      matchId: 'surv-win-900',
      mapId: 'candy_canyon',
      victory: true,
      score: 20000,
      elapsedSec: 900,
    });
    assert.equal(cappedWin.ok, true);
    assert.equal(cappedWin.reward, Math.round(120 * 1.25)); // 150
    assert.equal(cappedWin.isNewBestScore, false);
    assert.equal(cappedWin.isNewBestTime, true);
    assert.equal(cappedWin.nextProfile.survivalBestScore, 24000);
    assert.equal(cappedWin.nextProfile.survivalBestTimeSec, 900);
    assert.equal(cappedWin.nextProfile.survivalWins, 3);
  });

  it('awards defeat and endless_abyss cookie formula scaled by map cookieMultiplier', () => {
    const shortDefeat = settleSurvivalMatch(DEFAULT_PROFILE, {
      matchId: 'surv-short-10',
      mapId: 'winter_cabin',
      victory: false,
      score: 250,
      elapsedSec: 12,
    });
    assert.equal(shortDefeat.ok, true);
    assert.equal(shortDefeat.reward, 0);
    assert.equal(shortDefeat.nextProfile.gamesPlayed, 1);
    assert.equal(shortDefeat.nextProfile.gamesWon, 0);
    assert.equal(shortDefeat.nextProfile.survivalWins, 0);
    assert.equal(shortDefeat.isNewBestScore, true);
    assert.equal(shortDefeat.isNewBestTime, true);

    const minFloorDefeat = settleSurvivalMatch(DEFAULT_PROFILE, {
      matchId: 'surv-floor-20',
      mapId: 'winter_cabin',
      victory: false,
      score: 100,
      elapsedSec: 20,
    });
    assert.equal(minFloorDefeat.ok, true);
    assert.equal(minFloorDefeat.reward, 5);

    const midDefeat = settleSurvivalMatch(DEFAULT_PROFILE, {
      matchId: 'surv-mid-180',
      mapId: 'candy_canyon',
      victory: false,
      score: 8400,
      elapsedSec: 185,
    });
    // round((floor(8400/400) + floor(185/30)*4) * 1.25) = round(45 * 1.25) = 56
    assert.equal(midDefeat.ok, true);
    assert.equal(midDefeat.reward, Math.round(45 * 1.25));
    assert.equal(midDefeat.nextProfile.survivalWins, 0);

    const endlessRun = settleSurvivalMatch(DEFAULT_PROFILE, {
      matchId: 'surv-endless-600',
      mapId: 'endless_abyss',
      victory: true,
      score: 50000,
      elapsedSec: 600,
    });
    assert.equal(endlessRun.ok, true);
    assert.equal(endlessRun.reward, Math.round(100 * 1.4)); // 140
    assert.equal(endlessRun.nextProfile.gamesPlayed, 1);
    assert.equal(endlessRun.nextProfile.gamesWon, 0);
    assert.equal(endlessRun.nextProfile.survivalWins, 0);
  });

  it('awards incremental endlessContinuation bonus without double-counting wins/games and scales cleanly', () => {
    const campaignWin = settleSurvivalMatch(DEFAULT_PROFILE, {
      matchId: 'surv-camp-01',
      mapId: 'winter_cabin',
      victory: true,
      score: 12000,
      elapsedSec: 360,
    });
    assert.equal(campaignWin.ok, true);
    assert.equal(campaignWin.reward, 60);
    assert.equal(campaignWin.nextProfile.cookies, DEFAULT_PROFILE.cookies + 60);
    assert.equal(campaignWin.nextProfile.gamesPlayed, 1);
    assert.equal(campaignWin.nextProfile.gamesWon, 1);
    assert.equal(campaignWin.nextProfile.survivalWins, 1);
    assert.equal(campaignWin.nextProfile.survivalBestScore, 12000);
    assert.equal(campaignWin.nextProfile.survivalBestTimeSec, 360);

    // Continue Endless until 540s (+3 min past 360s -> +30 delta -> 90 total for run)
    const endlessCont540 = settleSurvivalMatch(campaignWin.nextProfile, {
      matchId: 'surv-camp-01:endless',
      mapId: 'winter_cabin',
      victory: false,
      score: 26500,
      elapsedSec: 540,
      endlessContinuation: true,
    });
    assert.equal(endlessCont540.ok, true);
    assert.equal(endlessCont540.reward, 30);
    assert.equal(endlessCont540.isNewBestScore, true);
    assert.equal(endlessCont540.isNewBestTime, true);
    assert.equal(endlessCont540.nextProfile.cookies, DEFAULT_PROFILE.cookies + 90);
    assert.equal(endlessCont540.nextProfile.gamesPlayed, 1);
    assert.equal(endlessCont540.nextProfile.gamesWon, 1);
    assert.equal(endlessCont540.nextProfile.survivalWins, 1);
    assert.equal(endlessCont540.nextProfile.survivalBestScore, 26500);
    assert.equal(endlessCont540.nextProfile.survivalBestTimeSec, 540);
    assert.deepEqual(endlessCont540.nextProfile.settledMatchIds, [
      'surv-camp-01',
      'surv-camp-01:endless',
    ]);

    // Second Campaign run on crystal_cavern (1.55x): 93 base win + 93 endless delta = 186 total
    const secondCampWin = settleSurvivalMatch(endlessCont540.nextProfile, {
      matchId: 'surv-camp-02',
      mapId: 'crystal_cavern',
      victory: true,
      score: 15000,
      elapsedSec: 360,
    });
    assert.equal(secondCampWin.ok, true);
    assert.equal(secondCampWin.reward, 93);
    assert.equal(secondCampWin.nextProfile.gamesPlayed, 2);
    assert.equal(secondCampWin.nextProfile.gamesWon, 2);
    assert.equal(secondCampWin.nextProfile.survivalWins, 2);

    const endlessCont900 = settleSurvivalMatch(secondCampWin.nextProfile, {
      matchId: 'surv-camp-02:endless',
      mapId: 'crystal_cavern',
      victory: true,
      score: 48000,
      elapsedSec: 900,
      endlessContinuation: true,
    });
    assert.equal(endlessCont900.ok, true);
    assert.equal(endlessCont900.reward, Math.round(120 * 1.55) - 93);
    assert.equal(
      endlessCont900.nextProfile.cookies,
      DEFAULT_PROFILE.cookies + 90 + Math.round(120 * 1.55),
    );
    assert.equal(endlessCont900.nextProfile.gamesPlayed, 2);
    assert.equal(endlessCont900.nextProfile.gamesWon, 2);
    assert.equal(endlessCont900.nextProfile.survivalWins, 2);
    assert.equal(endlessCont900.nextProfile.survivalBestScore, 48000);
    assert.equal(endlessCont900.nextProfile.survivalBestTimeSec, 900);
  });

  it('yields isNewBestScore=false and isNewBestTime=false for zero-score/zero-time on DEFAULT_PROFILE', () => {
    const zeroRun = settleSurvivalMatch(DEFAULT_PROFILE, {
      matchId: 'surv-zero-01',
      mapId: 'winter_cabin',
      victory: false,
      score: 0,
      elapsedSec: 0,
    });
    assert.equal(zeroRun.ok, true);
    assert.equal(zeroRun.reward, 0);
    assert.equal(zeroRun.isNewBestScore, false);
    assert.equal(zeroRun.isNewBestTime, false);
    assert.equal(zeroRun.nextProfile.survivalBestScore, 0);
    assert.equal(zeroRun.nextProfile.survivalBestTimeSec, 0);
    assert.equal(zeroRun.nextProfile.gamesPlayed, 1);
    assert.equal(zeroRun.nextProfile.gamesWon, 0);
    assert.equal(zeroRun.nextProfile.survivalWins, 0);
  });

  it('rejects duplicate matchId, invalid payloads, preserves higher bests, and caps settledMatchIds', () => {
    const first = settleSurvivalMatch(DEFAULT_PROFILE, {
      matchId: 'surv-dup-01',
      mapId: 'winter_cabin',
      victory: false,
      score: 5000,
      elapsedSec: 150,
    });
    assert.equal(first.ok, true);

    const dup = settleSurvivalMatch(first.nextProfile, {
      matchId: 'surv-dup-01',
      mapId: 'winter_cabin',
      victory: true,
      score: 99999,
      elapsedSec: 400,
    });
    assert.equal(dup.ok, false);
    assert.equal(dup.reward, 0);
    assert.equal(dup.isNewBestScore, false);
    assert.equal(dup.isNewBestTime, false);
    assert.deepEqual(dup.nextProfile, first.nextProfile);

    const badPayloads = [
      { matchId: 'abc', mapId: 'winter_cabin' as const, victory: false, score: 100, elapsedSec: 30 },
      { matchId: 'x'.repeat(81), mapId: 'winter_cabin' as const, victory: false, score: 100, elapsedSec: 30 },
      { matchId: 'surv-bad-map', mapId: 'unknown_map' as never, victory: false, score: 100, elapsedSec: 30 },
      { matchId: 'surv-neg-score', mapId: 'winter_cabin' as const, victory: false, score: -1, elapsedSec: 30 },
      { matchId: 'surv-nan-time', mapId: 'winter_cabin' as const, victory: false, score: 100, elapsedSec: Number.NaN },
      { matchId: 'surv-bad-vic', mapId: 'winter_cabin' as const, victory: 'yes' as never, score: 100, elapsedSec: 30 },
      { matchId: 'surv-bad-cont', mapId: 'winter_cabin' as const, victory: false, score: 100, elapsedSec: 30, endlessContinuation: 'yes' as never },
    ];
    for (const payload of badPayloads) {
      const res = settleSurvivalMatch(DEFAULT_PROFILE, payload);
      assert.equal(res.ok, false);
      assert.equal(res.reward, 0);
      assert.deepEqual(res.nextProfile, DEFAULT_PROFILE);
    }

    const existingIds = Array.from(
      { length: MAX_SETTLED_MATCH_IDS },
      (_, i) => `prev-surv-${String(i).padStart(2, '0')}`,
    );
    const highProfile = {
      ...DEFAULT_PROFILE,
      survivalBestScore: 10000,
      survivalBestTimeSec: 300,
      settledMatchIds: existingIds,
    };
    const lowerRun = settleSurvivalMatch(highProfile, {
      matchId: 'surv-capped-21',
      mapId: 'endless_abyss',
      victory: false,
      score: 0,
      elapsedSec: 0,
    });
    assert.equal(lowerRun.ok, true);
    assert.equal(lowerRun.isNewBestScore, false);
    assert.equal(lowerRun.isNewBestTime, false);
    assert.equal(lowerRun.nextProfile.survivalBestScore, 10000);
    assert.equal(lowerRun.nextProfile.survivalBestTimeSec, 300);
    assert.equal(lowerRun.nextProfile.settledMatchIds.length, MAX_SETTLED_MATCH_IDS);
    assert.equal(lowerRun.nextProfile.settledMatchIds[0], 'prev-surv-01');
    assert.equal(lowerRun.nextProfile.settledMatchIds[MAX_SETTLED_MATCH_IDS - 1], 'surv-capped-21');
  });
});
