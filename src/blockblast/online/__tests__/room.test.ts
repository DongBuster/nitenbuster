import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canPlacePiece,
  createEmptyGrid,
  createInitialState,
  placePiece,
} from '../../engine/game.ts';
import { BLOCK_COLORS } from '../../engine/pieces.ts';
import { BOARD_SIZE } from '../../engine/types.ts';
import type { MatchAction, MatchReceipt } from '../../engine/verify.ts';
import {
  appendChatMessage,
  BB_CHAT_MAX_HISTORY,
  BB_CHAT_MAX_LENGTH,
  BB_CHAT_MIN_INTERVAL_MS,
  canSendChatAt,
  parseIncomingChatMessage,
  sanitizeChatText,
} from '../chat.ts';
import {
  decodeGrid,
  EMPTY_COMPACT_GRID,
  encodeGrid,
} from '../gridCodec.ts';
import {
  BB_DISCONNECT_GRACE_MS,
  BB_PROGRESS_THROTTLE_MS,
  type BbParticipantInfo,
  type BbPlayerProgress,
  type BbRoomMember,
} from '../protocol.ts';
import {
  computeRoomStandings,
  electRoomHost,
  isRoomMatchComplete,
  shouldApplyProgressEvent,
  shouldMarkPeerDisconnected,
  verifyRoomSubmission,
} from '../ranking.ts';

function playPureSkillMatch(seed: number, matchId: string): MatchReceipt {
  let state = createInitialState(seed);
  const actions: MatchAction[] = [];

  for (let step = 0; step < 500 && state.phase === 'playing'; step++) {
    let placed = false;
    for (let slotIndex = 0; slotIndex < state.tray.length && !placed; slotIndex++) {
      const piece = state.tray[slotIndex];
      if (!piece) continue;
      for (let r = 0; r < BOARD_SIZE && !placed; r++) {
        for (let c = 0; c < BOARD_SIZE && !placed; c++) {
          if (canPlacePiece(state.grid, piece, r, c)) {
            const outcome = placePiece(state, slotIndex, r, c, false);
            assert.ok(outcome);
            actions.push({
              seq: actions.length,
              type: 'place',
              slotIndex,
              row: r,
              col: c,
            });
            state = outcome.nextState;
            placed = true;
          }
        }
      }
    }
    if (!placed) break;
  }

  assert.equal(state.phase, 'gameOver');
  return {
    matchId,
    seed,
    actions,
    claimedScore: state.score,
    elapsedMs: Math.max(1000, actions.length * 400),
    bombPaidCount: 0,
    rescueEligible: false,
  };
}

function makeMember(
  peerId: string,
  name: string,
  joinedAt: number,
  ready = true,
): BbRoomMember {
  return {
    peerId,
    name,
    animal: 'dog',
    accessory: [],
    joinedAt,
    ready,
  };
}

function makeProgress(
  overrides: Partial<BbPlayerProgress> & { peerId: string; matchId: string },
): BbPlayerProgress {
  return {
    seq: 1,
    score: 0,
    stage: 1,
    allClears: 0,
    streak: 0,
    maxStreak: 0,
    linesCleared: 0,
    movesCount: 0,
    compactGrid: EMPTY_COMPACT_GRID,
    status: 'playing',
    updatedAt: 1000,
    ...overrides,
  };
}

describe('blockblast online gridCodec', () => {
  it('round-trips empty and mixed 6-color grids cleanly and handles malformed input safely', () => {
    const empty = createEmptyGrid();
    const encodedEmpty = encodeGrid(empty);
    assert.equal(encodedEmpty, EMPTY_COMPACT_GRID);
    assert.equal(encodedEmpty.length, 64);
    assert.deepEqual(decodeGrid(encodedEmpty), empty);

    const grid = createEmptyGrid();
    BLOCK_COLORS.forEach((color, idx) => {
      grid[idx][idx] = { color };
    });
    grid[7][0] = { color: 'orange' };
    const encodedMixed = encodeGrid(grid);
    assert.equal(encodedMixed.length, 64);
    assert.deepEqual(decodeGrid(encodedMixed), grid);

    // Malformed strings should return a valid empty 8x8 grid without throwing
    assert.deepEqual(decodeGrid('short'), empty);
    assert.deepEqual(decodeGrid('x'.repeat(65)), empty);

    const unknownCharEncoded = `?${encodedMixed.slice(1)}`;
    const decodedUnknown = decodeGrid(unknownCharEncoded);
    assert.equal(decodedUnknown[0][0], null);
    assert.equal(decodedUnknown[1][1]?.color, 'rose');
  });
});

describe('blockblast online host election & submission verification', () => {
  it('elects host by earliest joinedAt with peerId tie-break and fails over cleanly', () => {
    assert.equal(electRoomHost([]), '');
    const m1 = makeMember('peer-b', 'Bo', 200);
    const m2 = makeMember('peer-a', 'An', 200);
    const m3 = makeMember('peer-c', 'Chi', 100);
    assert.equal(electRoomHost([m1, m2, m3]), 'peer-c');

    // Host leaves -> earliest tie breaks deterministically by peerId
    assert.equal(electRoomHost([m1, m2]), 'peer-a');
  });

  it('verifies legitimate Pure Skill match receipts and rejects tampered/mismatched ones', () => {
    const matchId = 'bb-room-ABCD12-r1-2026';
    const seed = 2026;
    const validReceipt = playPureSkillMatch(seed, matchId);

    const ok = verifyRoomSubmission(validReceipt, matchId, seed);
    assert.equal(ok.valid, true);
    assert.equal(ok.verifiedScore, validReceipt.claimedScore);

    assert.equal(verifyRoomSubmission(validReceipt, 'wrong-match', seed).valid, false);
    assert.equal(verifyRoomSubmission(validReceipt, matchId, seed + 1).valid, false);
    assert.equal(
      verifyRoomSubmission({ ...validReceipt, rescueEligible: true }, matchId, seed).valid,
      false,
    );
    assert.equal(
      verifyRoomSubmission({ ...validReceipt, bombPaidCount: 1 }, matchId, seed).valid,
      false,
    );
    assert.equal(
      verifyRoomSubmission(
        { ...validReceipt, claimedScore: validReceipt.claimedScore + 500 },
        matchId,
        seed,
      ).valid,
      false,
    );
    assert.equal(
      verifyRoomSubmission({ ...validReceipt, elapsedMs: 50 }, matchId, seed).valid,
      false,
    );
  });
});

describe('blockblast online ranking & completion state', () => {
  it('detects match completion only when all roster peers are finished or disconnected', () => {
    const matchId = 'm1';
    const roster = ['p1', 'p2', 'p3'];
    assert.equal(isRoomMatchComplete([], {}), false);
    assert.equal(
      isRoomMatchComplete(roster, {
        p1: makeProgress({ peerId: 'p1', matchId, status: 'finished' }),
        p2: makeProgress({ peerId: 'p2', matchId, status: 'playing' }),
        p3: makeProgress({ peerId: 'p3', matchId, status: 'disconnected' }),
      }),
      false,
    );
    assert.equal(
      isRoomMatchComplete(roster, {
        p1: makeProgress({ peerId: 'p1', matchId, status: 'finished' }),
        p2: makeProgress({ peerId: 'p2', matchId, status: 'finished' }),
        p3: makeProgress({ peerId: 'p3', matchId, status: 'disconnected' }),
      }),
      true,
    );
  });

  it('sorts verified standings with tie-breakers and demotes invalid submissions', () => {
    const matchId = 'bb-room-XYZ999-r1-777';
    const seed = 777;
    const realReceiptA = playPureSkillMatch(seed, matchId);
    const realReceiptB = playPureSkillMatch(seed, matchId);

    const roster = ['p1', 'p2', 'p3', 'p4'];
    const snapshots: Record<string, BbParticipantInfo> = {
      p1: { peerId: 'p1', name: 'An', animal: 'dog', accessory: [], joinedAt: 10 },
      p2: { peerId: 'p2', name: 'Bình', animal: 'cat', accessory: [], joinedAt: 20 },
      p3: { peerId: 'p3', name: 'Cường', animal: 'duck', accessory: [], joinedAt: 30 },
      p4: { peerId: 'p4', name: 'Hack', animal: 'shark', accessory: [], joinedAt: 40 },
    };
    const progressByPeer: Record<string, BbPlayerProgress> = {
      p1: makeProgress({ peerId: 'p1', matchId, score: realReceiptA.claimedScore, stage: 2, allClears: 1, status: 'finished' }),
      p2: makeProgress({ peerId: 'p2', matchId, score: realReceiptB.claimedScore, stage: 1, allClears: 0, status: 'finished' }),
      p3: makeProgress({ peerId: 'p3', matchId, score: 450, status: 'disconnected' }),
      p4: makeProgress({ peerId: 'p4', matchId, score: 999999, status: 'finished' }),
    };
    const receiptsByPeer: Record<string, MatchReceipt> = {
      p1: realReceiptA,
      p2: realReceiptB,
      p4: { ...realReceiptA, claimedScore: 999999 },
    };

    const standings = computeRoomStandings(
      roster,
      snapshots,
      progressByPeer,
      receiptsByPeer,
      matchId,
      seed,
      true,
    );

    // p1 & p2 share score from identical moves, p1 wins tie-break on allClears (1 > 0)
    assert.equal(standings[0].peerId, 'p1');
    assert.equal(standings[0].verification, 'verified');
    assert.equal(standings[0].rank, 1);

    assert.equal(standings[1].peerId, 'p2');
    assert.equal(standings[1].verification, 'verified');
    assert.equal(standings[1].rank, 2);

    // Disconnected sits after verified, invalid is forced to the bottom regardless of high claimed score
    assert.equal(standings[2].peerId, 'p3');
    assert.equal(standings[2].verification, 'disconnected');

    assert.equal(standings[3].peerId, 'p4');
    assert.equal(standings[3].verification, 'invalid');
    assert.equal(standings[3].rank, 4);
  });

  it('memoizes verifyRoomSubmission per receipt so repeated standings recomputations do not replay matches on Main Thread', () => {
    const matchId = 'bb-room-CACHE1-r1-2026';
    const seed = 2026;
    const receipt = playPureSkillMatch(seed, matchId);

    const first = verifyRoomSubmission(receipt, matchId, seed);
    const second = verifyRoomSubmission(receipt, matchId, seed);
    assert.equal(first.valid, true);
    assert.equal(second, first, 'expected exact cached VerifyResult reference');

    const roster = ['p1', 'p2'];
    const snapshots: Record<string, BbParticipantInfo> = {
      p1: { peerId: 'p1', name: 'Finished', animal: 'dog', accessory: [], joinedAt: 10 },
      p2: { peerId: 'p2', name: 'Playing', animal: 'cat', accessory: [], joinedAt: 20 },
    };
    const receiptsByPeer: Record<string, MatchReceipt> = { p1: receipt };

    const start = performance.now();
    for (let seq = 1; seq <= 50; seq++) {
      computeRoomStandings(
        roster,
        snapshots,
        {
          p1: makeProgress({ peerId: 'p1', matchId, seq: 10, score: receipt.claimedScore, status: 'finished' }),
          p2: makeProgress({ peerId: 'p2', matchId, seq, score: seq * 120, status: 'playing' }),
        },
        receiptsByPeer,
        matchId,
        seed,
        false,
      );
    }
    const elapsedMs = performance.now() - start;
    assert.ok(
      elapsedMs < 30,
      `expected 50 cached standings computations to take <30ms, took ${elapsedMs.toFixed(1)}ms`,
    );
  });

  it('rejects duplicate progress seq echoes and protects active peers from premature disconnect', () => {
    assert.ok(BB_DISCONNECT_GRACE_MS >= 15000);
    assert.ok(BB_PROGRESS_THROTTLE_MS >= 300);

    const matchId = 'm-seq';
    const prevPlaying = makeProgress({
      peerId: 'p2',
      matchId,
      seq: 12,
      score: 1200,
      status: 'playing',
      updatedAt: 10_000,
    });

    // Duplicate echo with identical seq must be ignored
    assert.equal(
      shouldApplyProgressEvent(prevPlaying, { ...prevPlaying, seq: 12 }),
      false,
    );
    // Stale lower seq ignored
    assert.equal(
      shouldApplyProgressEvent(prevPlaying, { ...prevPlaying, seq: 11 }),
      false,
    );
    // Newer seq accepted
    assert.equal(
      shouldApplyProgressEvent(prevPlaying, { ...prevPlaying, seq: 13 }),
      true,
    );
    // Transition from playing -> finished accepted even at same seq
    assert.equal(
      shouldApplyProgressEvent(prevPlaying, {
        ...prevPlaying,
        seq: 12,
        status: 'finished',
      }),
      true,
    );
    // Duplicate finished echo rejected and regression finished -> playing rejected
    const prevFinished = { ...prevPlaying, seq: 12, status: 'finished' as const };
    assert.equal(
      shouldApplyProgressEvent(prevFinished, { ...prevFinished, seq: 12 }),
      false,
    );
    assert.equal(
      shouldApplyProgressEvent(prevFinished, {
        ...prevFinished,
        seq: 15,
        status: 'playing',
      }),
      false,
    );

    // Self must never be marked disconnected by local presence timer
    assert.equal(
      shouldMarkPeerDisconnected('p1', 'p1', prevPlaying, 99_999, BB_DISCONNECT_GRACE_MS),
      false,
    );
    // Active peer whose progress updated within grace window must not be marked disconnected
    assert.equal(
      shouldMarkPeerDisconnected(
        'p2',
        'p1',
        prevPlaying,
        10_000 + BB_DISCONNECT_GRACE_MS - 1000,
        BB_DISCONNECT_GRACE_MS,
      ),
      false,
    );
    // Silent peer past grace window is marked disconnected
    assert.equal(
      shouldMarkPeerDisconnected(
        'p2',
        'p1',
        prevPlaying,
        10_000 + BB_DISCONNECT_GRACE_MS + 100,
        BB_DISCONNECT_GRACE_MS,
      ),
      true,
    );
  });

  it('sanitizes online chat messages, enforces rate limits, deduplicates history, and preserves avatarFrame in standings', () => {
    assert.equal(sanitizeChatText('  Xin\t\nchào\u0007   mọi người  '), 'Xin chào mọi người');
    assert.equal(sanitizeChatText('   \u0000\n  '), '');
    assert.equal(sanitizeChatText('a'.repeat(200)).length, BB_CHAT_MAX_LENGTH);

    assert.equal(canSendChatAt(0, 1000), true);
    assert.equal(canSendChatAt(1000, 1000 + BB_CHAT_MIN_INTERVAL_MS - 1), false);
    assert.equal(canSendChatAt(1000, 1000 + BB_CHAT_MIN_INTERVAL_MS), true);

    const parsed = parseIncomingChatMessage(
      {
        id: 'm1',
        peerId: 'p1',
        name: 'Mèo Pro',
        animal: 'cat',
        avatarFrame: 'frame_stage_10',
        text: 'Lên Stage 10 rồi!',
        at: 5000,
        channel: 'room',
      },
      'global',
    );
    assert.ok(parsed);
    assert.equal(parsed.avatarFrame, 'frame_stage_10');
    assert.equal(parsed.channel, 'room');

    // Invalid avatarFrame is sanitized to null
    const badFrame = parseIncomingChatMessage(
      { peerId: 'p2', name: 'Guest', animal: 'dog', avatarFrame: 'hacked_frame', text: 'Hi' },
      'global',
    );
    assert.ok(badFrame);
    assert.equal(badFrame.avatarFrame, null);

    // Deduplicate + cap at BB_CHAT_MAX_HISTORY
    let history = appendChatMessage([], parsed);
    history = appendChatMessage(history, parsed);
    assert.equal(history.length, 1);
    for (let i = 0; i < BB_CHAT_MAX_HISTORY + 10; i++) {
      history = appendChatMessage(history, { ...parsed, id: `msg-${i}` });
    }
    assert.equal(history.length, BB_CHAT_MAX_HISTORY);

    // Standings propagate avatarFrame cleanly
    const standings = computeRoomStandings(
      ['p1'],
      {
        p1: {
          peerId: 'p1',
          name: 'Mèo Pro',
          animal: 'cat',
          accessory: [],
          avatarFrame: 'frame_stage_15',
          joinedAt: 1,
        },
      },
      { p1: makeProgress({ peerId: 'p1', matchId: 'm-frame', score: 1200 }) },
      {},
      'm-frame',
      42,
      false,
    );
    assert.equal(standings[0].avatarFrame, 'frame_stage_15');
  });
});
