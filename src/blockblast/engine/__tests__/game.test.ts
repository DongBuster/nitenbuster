import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOCK_COLORS,
  BLOCK_PIECES,
  COLOR_TOKENS,
  createCandyBombPiece,
  createTrayPieceFromDef,
  getPieceDefById,
} from '../pieces.ts';
import {
  calculateCookieReward,
  canPlacePiece,
  createEmptyGrid,
  createInitialState,
  declineRescue,
  detonateCandyBombAt,
  getPlacementPreview,
  hasAnyValidMove,
  pickStageColor,
  placePiece,
  rerollTray,
  spawnSmartTray,
} from '../game.ts';
import {
  getStageNumber,
  getStageTheme,
  resolveStageColorToken,
  STAGE_THEMES,
} from '../stages.ts';
import {
  verifyMatchReceipt,
  type MatchAction,
  type MatchReceipt,
} from '../verify.ts';

describe('blockblast piece catalog', () => {
  it('defines 29 unique symmetric polyominoes with accurate bounding boxes', () => {
    assert.equal(BLOCK_PIECES.length, 29);
    const ids = new Set(BLOCK_PIECES.map((p) => p.id));
    assert.equal(ids.size, 29);

    for (const piece of BLOCK_PIECES) {
      assert.ok(piece.cells.length >= 1 && piece.cells.length <= 9);
      const maxR = Math.max(...piece.cells.map((c) => c.dr));
      const maxC = Math.max(...piece.cells.map((c) => c.dc));
      const minR = Math.min(...piece.cells.map((c) => c.dr));
      const minC = Math.min(...piece.cells.map((c) => c.dc));
      assert.equal(minR, 0, `${piece.id} minR should be 0`);
      assert.equal(minC, 0, `${piece.id} minC should be 0`);
      assert.equal(piece.height, maxR + 1, `${piece.id} height mismatch`);
      assert.equal(piece.width, maxC + 1, `${piece.id} width mismatch`);
    }
  });

  it('defines 6 color tokens with distinct pattern glyphs and creates candy bomb', () => {
    assert.equal(BLOCK_COLORS.length, 6);
    const glyphs = new Set(BLOCK_COLORS.map((c) => COLOR_TOKENS[c].patternGlyph));
    assert.equal(glyphs.size, 6);
    const bomb = createCandyBombPiece('bomb_1', 'rose');
    assert.equal(bomb.kind, 'candyBomb');
    assert.equal(bomb.cells.length, 1);
  });

  it('looks up piece definitions by id and creates normal tray pieces', () => {
    const def = getPieceDefById('square_2');
    assert.ok(def);
    assert.equal(def.group, 'medium');
    assert.equal(getPieceDefById('non_existent'), undefined);

    const trayPiece = createTrayPieceFromDef(def, 'piece_1', 'amber');
    assert.equal(trayPiece.uid, 'piece_1');
    assert.equal(trayPiece.defId, 'square_2');
    assert.equal(trayPiece.kind, 'normal');
    assert.equal(trayPiece.color, 'amber');
    assert.equal(trayPiece.width, 2);
    assert.equal(trayPiece.height, 2);
    assert.equal(trayPiece.cells.length, 4);
  });
});

describe('blockblast core engine', () => {
  it('places pieces, detects simultaneous row+col clears, and enforces bounds', () => {
    const state = createInitialState(12345);
    const bar4 = createTrayPieceFromDef(getPieceDefById('bar_h4')!, 'p0', 'amber');
    const dot1 = createTrayPieceFromDef(getPieceDefById('dot_1')!, 'p1', 'sky');

    // Fill row 0 cols 0..6 and col 7 rows 1..7 so placing dot1 at (0,7) clears 1 row + 1 col
    for (let c = 0; c < 7; c++) state.grid[0][c] = { color: 'amber' };
    for (let r = 1; r < 8; r++) state.grid[r][7] = { color: 'sky' };
    state.tray = [dot1, bar4, null];

    assert.equal(canPlacePiece(state.grid, bar4, 0, 5), false); // out of bounds
    assert.equal(canPlacePiece(state.grid, dot1, 0, 0), false); // occupied
    const preview = getPlacementPreview(state.grid, dot1, 0, 7);
    assert.equal(preview.valid, true);
    assert.deepEqual(preview.clearedRows, [0]);
    assert.deepEqual(preview.clearedCols, [7]);

    const outcome = placePiece(state, 0, 0, 7, false);
    assert.ok(outcome);
    // 10 (1 cell) + 100*2*3/2 (300 for 2 lines) + 1000 (All Clear!) = 1310
    assert.equal(outcome.allClear, true);
    assert.equal(outcome.pointsEarned, 1310);
    assert.equal(outcome.nextState.score, 1310);
    assert.equal(outcome.nextState.linesCleared, 2);
    assert.equal(outcome.nextState.streak, 1);
  });

  it('keeps streak for 1 grace turn and resets on 2nd consecutive non-clear move', () => {
    const state = createInitialState(77);
    const dot1 = createTrayPieceFromDef(getPieceDefById('dot_1')!, 'p0', 'rose');
    const dot2 = createTrayPieceFromDef(getPieceDefById('dot_1')!, 'p1', 'rose');
    const dot3 = createTrayPieceFromDef(getPieceDefById('dot_1')!, 'p2', 'rose');
    for (let c = 0; c < 7; c++) state.grid[0][c] = { color: 'amber' };
    state.tray = [dot1, dot2, dot3];

    const s1 = placePiece(state, 0, 0, 7, false)!.nextState;
    assert.equal(s1.streak, 1);
    assert.equal(s1.graceUsed, false);

    // 1st non-clearing move uses grace
    const s2 = placePiece(s1, 1, 4, 4, false)!.nextState;
    assert.equal(s2.streak, 1);
    assert.equal(s2.graceUsed, true);

    // 2nd consecutive non-clearing move resets streak
    const s3 = placePiece(s2, 2, 5, 5, false)!.nextState;
    assert.equal(s3.streak, 0);
    assert.equal(s3.graceUsed, false);
  });

  it('detonates 3x3 candy bomb from tray and active skill without breaking streak', () => {
    const state = createInitialState(99);
    state.streak = 2;
    state.grid[2][2] = { color: 'sky' };
    state.grid[2][3] = { color: 'sky' };
    state.grid[3][3] = { color: 'amber' };
    state.grid[6][6] = { color: 'rose' }; // outside 3x3 around (3,3)

    const bombOutcome = detonateCandyBombAt(state, 3, 3);
    assert.ok(bombOutcome);
    assert.equal(bombOutcome.destroyedByBomb.length, 3);
    assert.equal(bombOutcome.nextState.grid[2][2], null);
    assert.equal(bombOutcome.nextState.grid[6][6]?.color, 'rose');
    assert.equal(bombOutcome.nextState.candyBombUsed, true);
    assert.equal(bombOutcome.nextState.streak, 2);
    // Second active bomb in same match is blocked
    assert.equal(detonateCandyBombAt(bombOutcome.nextState, 6, 6), null);

    // Also test tray candyBomb piece placement
    const trayBomb = createCandyBombPiece('tb0', 'orange');
    const state2 = createInitialState(101);
    state2.streak = 3;
    state2.grid[0][1] = { color: 'emerald' };
    state2.grid[1][0] = { color: 'violet' };
    state2.tray = [trayBomb, null, null];
    const trayOutcome = placePiece(state2, 0, 0, 0, false);
    assert.ok(trayOutcome);
    assert.equal(trayOutcome.destroyedByBomb.length, 2);
    assert.equal(trayOutcome.pointsEarned, 10 + 30);
    assert.equal(trayOutcome.nextState.streak, 3);
    assert.equal(trayOutcome.nextState.candyBombUsed, false);
  });

  it('offers rescuePrompt when stuck and affordable, transitions to gameOver when declined', () => {
    const state = createInitialState(5);
    const grid = createEmptyGrid();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        grid[r][c] = { color: 'emerald' };
      }
    }
    // Leave scattered single empty cells so placing dot at (0,0) does not clear any line and bar3 still cannot fit
    for (let i = 0; i < 8; i++) grid[i][i] = null;
    grid[0][2] = null;
    grid[2][0] = null;
    const dot = createTrayPieceFromDef(getPieceDefById('dot_1')!, 'd0', 'amber');
    const bar3 = createTrayPieceFromDef(getPieceDefById('bar_h3')!, 'b1', 'sky');
    state.grid = grid;
    state.tray = [dot, bar3, null];

    // Placing dot fills (0,0) without clearing any line; bar3 cannot fit -> stuck!
    const stuck = placePiece(state, 0, 0, 0, true)!;
    assert.equal(stuck.nextState.phase, 'rescuePrompt');
    const afterDecline = declineRescue(stuck.nextState);
    assert.equal(afterDecline.phase, 'gameOver');
    assert.equal(hasAnyValidMove(afterDecline.grid, afterDecline.tray), false);
  });

  it('allows one free reroll, preserves fairness on spawn, and computes cookie rewards', () => {
    const state = createInitialState(42);
    const rerolled = rerollTray(state, false);
    assert.ok(rerolled);
    assert.equal(rerolled.rerollUsed, true);
    assert.equal(rerollTray(rerolled, false), null);

    assert.deepEqual(calculateCookieReward(250, 0), { reward: 5, isNewBest: true });
    assert.deepEqual(calculateCookieReward(1200, 900), { reward: 27, isNewBest: true });
    assert.deepEqual(calculateCookieReward(5200, 5000), { reward: 50, isNewBest: true });
    assert.deepEqual(calculateCookieReward(5200, 6000), { reward: 45, isNewBest: false });
  });
});

function playDeterministicMatchToEnd(
  seed: number,
  options: {
    rescueEligible?: boolean;
    rescueAction?: 'declineRescue' | 'bomb';
    useRerollAtSeq?: number;
  } = {},
): {
  actions: MatchAction[];
  finalScore: number;
  sawRescuePrompt: boolean;
  bombPaidCount: number;
} {
  const rescueEligible = options.rescueEligible ?? false;
  const rescueAction = options.rescueAction ?? 'declineRescue';
  let state = createInitialState(seed);
  const actions: MatchAction[] = [];
  let seq = 0;
  let sawRescuePrompt = false;
  let bombPaidCount = 0;

  while (state.phase !== 'gameOver' && seq < 500) {
    if (state.phase === 'rescuePrompt') {
      sawRescuePrompt = true;
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

    if (
      options.useRerollAtSeq !== undefined &&
      seq === options.useRerollAtSeq &&
      !state.rerollUsed
    ) {
      const rerolled = rerollTray(state, rescueEligible);
      if (rerolled) {
        actions.push({ seq: seq++, type: 'reroll' });
        state = rerolled;
        continue;
      }
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

  return { actions, finalScore: state.score, sawRescuePrompt, bombPaidCount };
}

describe('blockblast anti-cheat replay verifier', () => {
  it('accepts a legitimate full match transcript and rejects score tampering or 0ms bots', () => {
    const { actions, finalScore } = playDeterministicMatchToEnd(2026);
    const validReceipt: MatchReceipt = {
      matchId: 'match-legit-1',
      seed: 2026,
      actions,
      claimedScore: finalScore,
      elapsedMs: actions.length * 400,
      bombPaidCount: 0,
      rescueEligible: false,
    };
    const ok = verifyMatchReceipt(validReceipt);
    assert.equal(ok.valid, true);
    assert.equal(ok.verifiedScore, finalScore);

    // Spoofed higher score
    const spoofed = verifyMatchReceipt({ ...validReceipt, claimedScore: finalScore + 5000 });
    assert.equal(spoofed.valid, false);

    // Impossible speed (bot burst)
    const speedHack = verifyMatchReceipt({ ...validReceipt, elapsedMs: 10 });
    assert.equal(speedHack.valid, false);

    // Truncated transcript that has not reached gameOver
    const incomplete = verifyMatchReceipt({
      ...validReceipt,
      actions: actions.slice(0, 1),
      claimedScore: 0,
      elapsedMs: 1000,
    });
    assert.equal(incomplete.valid, false);
  });

  it('rejects duplicate reroll or unpaid candy bomb actions', () => {
    const state = createInitialState(11);
    const badBombReceipt: MatchReceipt = {
      matchId: 'match-hack-bomb',
      seed: state.prngState,
      actions: [{ seq: 0, type: 'bomb', row: 3, col: 3 }],
      claimedScore: 0,
      elapsedMs: 1000,
      bombPaidCount: 0,
      rescueEligible: false,
    };
    assert.equal(verifyMatchReceipt(badBombReceipt).valid, false);

    // Duplicate reroll
    const { actions, finalScore } = playDeterministicMatchToEnd(2026, { useRerollAtSeq: 0 });
    const reindexedDupReroll: MatchAction[] = [
      { seq: 0, type: 'reroll' },
      ...actions.map((a, idx) => ({ ...a, seq: idx + 1 })),
    ];
    const dupRerollReceipt: MatchReceipt = {
      matchId: 'match-hack-reroll',
      seed: 2026,
      actions: reindexedDupReroll,
      claimedScore: finalScore,
      elapsedMs: reindexedDupReroll.length * 400,
      bombPaidCount: 0,
      rescueEligible: false,
    };
    assert.equal(verifyMatchReceipt(dupRerollReceipt).valid, false);

    // Single legitimate reroll passes
    const validRerollReceipt: MatchReceipt = {
      matchId: 'match-legit-reroll',
      seed: 2026,
      actions,
      claimedScore: finalScore,
      elapsedMs: actions.length * 400,
      bombPaidCount: 0,
      rescueEligible: false,
    };
    assert.equal(verifyMatchReceipt(validRerollReceipt).valid, true);
  });

  it('verifies rescueEligible matches for both declineRescue and paid bomb rescue', () => {
    const declined = playDeterministicMatchToEnd(2026, {
      rescueEligible: true,
      rescueAction: 'declineRescue',
    });
    assert.equal(declined.sawRescuePrompt, true);
    assert.equal(declined.bombPaidCount, 0);
    const declinedResult = verifyMatchReceipt({
      matchId: 'match-rescue-decline',
      seed: 2026,
      actions: declined.actions,
      claimedScore: declined.finalScore,
      elapsedMs: declined.actions.length * 400,
      bombPaidCount: 0,
      rescueEligible: true,
    });
    assert.equal(declinedResult.valid, true);
    assert.equal(declinedResult.verifiedScore, declined.finalScore);

    const bombed = playDeterministicMatchToEnd(2026, {
      rescueEligible: true,
      rescueAction: 'bomb',
    });
    assert.equal(bombed.sawRescuePrompt, true);
    assert.equal(bombed.bombPaidCount, 1);
    const bombedResult = verifyMatchReceipt({
      matchId: 'match-rescue-bomb',
      seed: 2026,
      actions: bombed.actions,
      claimedScore: bombed.finalScore,
      elapsedMs: bombed.actions.length * 400,
      bombPaidCount: 1,
      rescueEligible: true,
    });
    assert.equal(bombedResult.valid, true);
    assert.equal(bombedResult.verifiedScore, bombed.finalScore);
  });

  it('replays deterministic matches consistently across additional seeds', () => {
    for (const seed of [777, 1337]) {
      const runA = playDeterministicMatchToEnd(seed);
      const runB = playDeterministicMatchToEnd(seed);
      assert.equal(runA.finalScore, runB.finalScore);
      assert.deepEqual(runA.actions, runB.actions);
      assert.ok(runA.actions.length > 0 && runA.actions.length < 500);

      const verified = verifyMatchReceipt({
        matchId: `match-seed-${seed}`,
        seed,
        actions: runA.actions,
        claimedScore: runA.finalScore,
        elapsedMs: runA.actions.length * 400,
        bombPaidCount: 0,
        rescueEligible: false,
      });
      assert.equal(verified.valid, true);
      assert.equal(verified.verifiedScore, runA.finalScore);
    }
  });
});

describe('blockblast stage themes & palette discipline', () => {
  it('defines 5 progressive themes with 2-3 harmonious colors and escalating VFX', () => {
    assert.equal(STAGE_THEMES.length, 5);
    const seenIds = new Set<string>();
    for (let i = 0; i < STAGE_THEMES.length; i++) {
      const theme = STAGE_THEMES[i];
      assert.equal(theme.tier, i + 1);
      assert.ok(!seenIds.has(theme.id), `duplicate theme id ${theme.id}`);
      seenIds.add(theme.id);
      assert.equal(theme.palette.length, 2);
      assert.equal(new Set(theme.palette).size, 2);
      assert.ok(theme.name.length > 0);
      assert.ok(theme.accentHex.startsWith('#'));
      assert.ok(theme.sweepColorHex.startsWith('#'));
      assert.ok(theme.frameClass.length > 0);
      assert.ok(theme.frameRimClass.length > 0);
      assert.ok(theme.wellClass.length > 0);
      assert.ok(theme.wellAmbientClass.length > 0);
      assert.ok(theme.cellEvenClass.length > 0);
      assert.ok(theme.cellOddClass.length > 0);
      assert.ok(theme.traySlotClass.length > 0);
      assert.ok(theme.badgeClass.length > 0);
      assert.ok(theme.tileFinishClass.length > 0);
      if (i > 0) {
        assert.ok(theme.particleCount > STAGE_THEMES[i - 1].particleCount);
        assert.ok(theme.allClearParticleCount >= STAGE_THEMES[i - 1].allClearParticleCount);
      }
    }
    assert.equal(getStageTheme(0).id, 'timber');
    assert.equal(getStageTheme(1).id, 'aurora');
    assert.equal(getStageTheme(2).id, 'sakura');
    assert.equal(getStageTheme(3).id, 'royal');
    assert.equal(getStageTheme(4).id, 'celestial');
    assert.equal(getStageTheme(9).id, 'celestial');
    assert.equal(getStageNumber(-2), 1);
    assert.equal(getStageNumber(0), 1);
    assert.equal(getStageNumber(9), 10);

    // Stage-specific visual color overrides preserve unique colorblind glyphs
    const royalTheme = getStageTheme(3);
    const royalGold = resolveStageColorToken('amber', royalTheme);
    const royalRuby = resolveStageColorToken('rose', royalTheme);
    assert.equal(royalGold.bgHex, '#EAB308');
    assert.equal(royalRuby.bgHex, '#E11D48');
    assert.equal(royalGold.patternGlyph, COLOR_TOKENS.amber.patternGlyph);
    assert.equal(royalRuby.patternGlyph, COLOR_TOKENS.rose.patternGlyph);

    const celestialTheme = getStageTheme(4);
    assert.equal(resolveStageColorToken('violet', celestialTheme).bgHex, '#6366F1');
    assert.equal(resolveStageColorToken('sky', celestialTheme).bgHex, '#06B6D4');
  });

  it('picks colors strictly from the active stage palette across PRNG draws', () => {
    for (let allClears = 0; allClears <= 5; allClears++) {
      const palette = getStageTheme(allClears).palette;
      let rng = 100 + allClears * 37;
      for (let step = 0; step < 25; step++) {
        const picked = pickStageColor(allClears, rng);
        rng = picked.nextState;
        assert.ok(
          palette.includes(picked.color),
          `color ${picked.color} not in stage ${allClears + 1} palette [${palette.join(', ')}]`,
        );
      }
    }
  });
});

describe('blockblast board-aware smart spawner & stage progression', () => {
  it('enforces stage palette on initial spawn and reroll', () => {
    const s0 = createInitialState(2026);
    assert.equal(s0.allClears, 0);
    const stage1Palette = getStageTheme(0).palette;
    for (const piece of s0.tray) {
      assert.ok(piece);
      assert.ok(stage1Palette.includes(piece.color));
    }

    const s2 = createInitialState(2026);
    s2.allClears = 2;
    const rerolled = rerollTray(s2, false)!;
    assert.ok(rerolled);
    const stage3Palette = getStageTheme(2).palette;
    for (const piece of rerolled.tray) {
      assert.ok(piece);
      assert.ok(stage3Palette.includes(piece.color));
    }
  });

  it('spawns gap-fitting / line-clearing pieces when fillRatio >= 0.12 with missing line gap', () => {
    const grid = createEmptyGrid();
    // Row 0 missing 2 cells (0,6) & (0,7), plus anchor blocks in row 1 so fillRatio = 10/64 >= 0.12
    for (let c = 0; c < 6; c++) grid[0][c] = { color: 'sky' };
    for (let c = 0; c < 4; c++) grid[1][c] = { color: 'emerald' };

    const stage2Palette = getStageTheme(1).palette;
    for (const seed of [11, 22, 33, 44, 55, 66, 77, 88]) {
      const { tray } = spawnSmartTray(grid, seed, 1, 1);
      assert.equal(tray.length, 3);
      for (const p of tray) {
        assert.ok(stage2Palette.includes(p.color));
      }

      const normalIds = tray.filter((p) => p.kind === 'normal').map((p) => p.defId);
      assert.equal(new Set(normalIds).size, normalIds.length, 'should avoid duplicate shape ids');

      const hasLineClearingOrTightFit = tray.some((piece) => {
        if (piece.kind === 'candyBomb') return true;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const preview = getPlacementPreview(grid, piece, r, c);
            if (preview.valid && (preview.clearedRows.length > 0 || preview.clearedCols.length > 0)) {
              return true;
            }
          }
        }
        return false;
      });
      assert.equal(
        hasLineClearingOrTightFit,
        true,
        `seed ${seed} should spawn at least one line-clearing piece for missing 2-cell row`,
      );
    }
  });

  it('fits L-shaped pockets and uses sequential simulation to open space without duplicates', () => {
    const grid = createEmptyGrid();
    // Fill entire board except row 0 cols 5..7 (3-cell line finisher) and 2 scattered single cells
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        grid[r][c] = { color: 'amber' };
      }
    }
    grid[0][5] = null;
    grid[0][6] = null;
    grid[0][7] = null;
    grid[3][3] = null;
    grid[6][6] = null;

    const { tray } = spawnSmartTray(grid, 909, 3, 0);
    assert.equal(tray.length, 3);
    assert.equal(hasAnyValidMove(grid, tray), true);

    // At least one piece clears row 0 or fits the remaining pocket on the dense board
    const canClearRow0 = tray.some((piece) => {
      if (piece.kind === 'candyBomb') return true;
      return getPlacementPreview(grid, piece, 0, 5).valid &&
        getPlacementPreview(grid, piece, 0, 5).clearedRows.includes(0);
    });
    assert.equal(canClearRow0, true);

    // Build an L-shaped pocket board (fillRatio >= 0.12) where an L-piece fits snug against blocks
    const pocketGrid = createEmptyGrid();
    for (let r = 2; r <= 5; r++) {
      for (let c = 2; c <= 5; c++) {
        pocketGrid[r][c] = { color: 'amber' };
      }
    }
    // Carve a 3-cell L-pocket inside the cluster at (3,3), (3,4), (4,3)
    pocketGrid[3][3] = null;
    pocketGrid[3][4] = null;
    pocketGrid[4][3] = null;

    let pocketFitCount = 0;
    for (const seed of [101, 202, 303, 404, 505]) {
      const spawned = spawnSmartTray(pocketGrid, seed, 2, 0);
      const fitsInsidePocket = spawned.tray.some((piece) => {
        if (piece.kind === 'candyBomb') return true;
        // Check if piece fits directly into the carved L-pocket cells
        return (
          piece.defId === 'corner_tl' && canPlacePiece(pocketGrid, piece, 3, 3)
        ) || (
          (piece.defId === 'bar_h2' || piece.defId === 'bar_v2' || piece.defId === 'dot_1') &&
          canPlacePiece(pocketGrid, piece, 3, 3)
        );
      });
      if (fitsInsidePocket) pocketFitCount++;
    }
    assert.ok(pocketFitCount >= 3, `expected smart spawner to target carved L-pocket, got ${pocketFitCount}/5`);
  });

  it('prioritizes All Clear finishers when occupied <= 16 and advances stage on All Clear', () => {
    const grid = createEmptyGrid();
    // 13 occupied cells: row 0 cols 0..5 + col 7 rows 1..7 -> placing bar_h2 at (0,6) clears entire board!
    for (let c = 0; c < 6; c++) grid[0][c] = { color: 'amber' };
    for (let r = 1; r < 8; r++) grid[r][7] = { color: 'orange' };

    let allClearSpawned = 0;
    for (const seed of [7, 14, 21, 28, 35]) {
      const { tray } = spawnSmartTray(grid, seed, 1, 0);
      const finishesBoard = tray.some((piece) => {
        if (piece.kind === 'candyBomb') return false;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const preview = getPlacementPreview(grid, piece, r, c);
            if (preview.valid && preview.clearedRows.includes(0) && preview.clearedCols.includes(7)) {
              return true;
            }
          }
        }
        return false;
      });
      if (finishesBoard) allClearSpawned++;
    }
    assert.ok(allClearSpawned >= 3, `expected All Clear finisher in <=16 occupied boards, got ${allClearSpawned}/5`);

    // Verify All Clear stage progression & re-tinting of remaining tray pieces
    const state = createInitialState(12345);
    const bar2 = createTrayPieceFromDef(getPieceDefById('bar_h2')!, 'p0', 'amber');
    const leftoverA = createTrayPieceFromDef(getPieceDefById('square_2')!, 'p1', 'orange');
    const leftoverB = createTrayPieceFromDef(getPieceDefById('dot_1')!, 'p2', 'amber');
    state.grid = grid;
    state.tray = [bar2, leftoverA, leftoverB];

    const outcome = placePiece(state, 0, 0, 6, false)!;
    assert.ok(outcome);
    assert.equal(outcome.allClear, true);
    assert.equal(outcome.stageUp, true);
    assert.equal(outcome.stageAfter, 2);
    assert.equal(outcome.nextState.allClears, 1);
    const stage2Palette = getStageTheme(1).palette;
    assert.ok(stage2Palette.includes(outcome.nextState.tray[1]!.color));
    assert.ok(stage2Palette.includes(outcome.nextState.tray[2]!.color));
  });

  it('advances stageUp and re-tints remaining tray when Candy Bomb empties an occupied board without +1000 line-clear bonus', () => {
    const stage2Palette = getStageTheme(1).palette;

    // 1) Tray Candy Bomb empties board
    const sTray = createInitialState(50);
    sTray.grid[0][1] = { color: 'amber' };
    sTray.grid[1][0] = { color: 'orange' };
    const trayBomb = createCandyBombPiece('tb_clear', 'amber');
    const leftover = createTrayPieceFromDef(getPieceDefById('dot_1')!, 'leftover', 'orange');
    sTray.tray = [trayBomb, leftover, null];

    const trayClearOutcome = placePiece(sTray, 0, 0, 0, false)!;
    assert.ok(trayClearOutcome);
    assert.equal(trayClearOutcome.allClear, false);
    assert.equal(trayClearOutcome.pointsEarned, 10 + 2 * 15);
    assert.equal(trayClearOutcome.stageUp, true);
    assert.equal(trayClearOutcome.stageAfter, 2);
    assert.equal(trayClearOutcome.nextState.allClears, 1);
    assert.ok(stage2Palette.includes(trayClearOutcome.nextState.tray[1]!.color));

    // 2) Active Candy Bomb empties board
    const sActive = createInitialState(51);
    sActive.grid[3][3] = { color: 'amber' };
    sActive.grid[3][4] = { color: 'orange' };
    const activeLeftover = createTrayPieceFromDef(getPieceDefById('bar_h2')!, 'left_active', 'amber');
    sActive.tray = [activeLeftover, null, null];

    const activeClearOutcome = detonateCandyBombAt(sActive, 3, 3)!;
    assert.ok(activeClearOutcome);
    assert.equal(activeClearOutcome.allClear, false);
    assert.equal(activeClearOutcome.pointsEarned, 2 * 15);
    assert.equal(activeClearOutcome.stageUp, true);
    assert.equal(activeClearOutcome.stageAfter, 2);
    assert.equal(activeClearOutcome.nextState.allClears, 1);
    assert.ok(stage2Palette.includes(activeClearOutcome.nextState.tray[0]!.color));

    // 3) Tray Candy Bomb on empty board does NOT advance stage
    const sEmpty = createInitialState(52);
    sEmpty.tray = [createCandyBombPiece('tb_empty', 'amber'), null, null];
    const emptyOutcome = placePiece(sEmpty, 0, 4, 4, false)!;
    assert.equal(emptyOutcome.stageUp, false);
    assert.equal(emptyOutcome.stageAfter, 1);
    assert.equal(emptyOutcome.nextState.allClears, 0);
  });

  it('keeps scoring gap-fitting & All Clear finishers even when 1..7 cells remain on board', () => {
    const grid = createEmptyGrid();
    // 6 occupied cells in row 0 (cols 0..5): bar_h2 finishes the row for an All Clear!
    for (let c = 0; c < 6; c++) grid[0][c] = { color: 'amber' };

    let finisherHits = 0;
    for (let seed = 10; seed < 20; seed++) {
      const { tray } = spawnSmartTray(grid, seed, 1, 0);
      if (tray.some((p) => p.defId === 'bar_h2')) finisherHits++;
    }
    assert.ok(
      finisherHits >= 5,
      `expected bar_h2 All Clear finisher in >=5/10 seeds for 6-cell board, got ${finisherHits}/10`,
    );
  });
});
