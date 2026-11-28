import {
  verifyMatchReceipt,
  type MatchReceipt,
  type VerifyResult,
} from '../engine/verify.ts';
import { EMPTY_COMPACT_GRID } from './gridCodec.ts';
import type {
  BbParticipantInfo,
  BbPlayerProgress,
  BbPlayerStatus,
  BbProgressEvent,
  BbRoomMember,
  BbRoomStanding,
  BbVerificationStatus,
} from './protocol.ts';

const verificationCache = new WeakMap<MatchReceipt, Map<string, VerifyResult>>();

function verificationBucket(
  verification: BbVerificationStatus,
  isFinal: boolean,
): number {
  if (isFinal) {
    if (verification === 'verified') return 0;
    if (verification === 'invalid') return 2;
    return 1;
  }
  return verification === 'invalid' ? 1 : 0;
}

/** Elects the deterministic room Host by earliest join timestamp, breaking ties by peerId. */
export function electRoomHost(members: readonly BbRoomMember[]): string {
  if (members.length === 0) return '';
  const sorted = [...members].sort((a, b) => {
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
    return a.peerId.localeCompare(b.peerId);
  });
  return sorted[0].peerId;
}

/**
 * Trustlessly verifies a competitor's MatchReceipt against the room's shared
 * matchId, seed, and Pure Skill policy (no paid Candy Bomb rescue allowed).
 */
function invalidRoomResult(reason: string): VerifyResult {
  return {
    valid: false,
    reason,
    verifiedScore: 0,
    linesCleared: 0,
    maxStreak: 0,
    allClears: 0,
    stageReached: 1,
  };
}

export function verifyRoomSubmission(
  receipt: MatchReceipt,
  expectedMatchId: string,
  expectedSeed: number,
): VerifyResult {
  if (!receipt || typeof receipt !== 'object') {
    return invalidRoomResult('Invalid receipt');
  }

  const cacheKey = `${expectedMatchId}:${expectedSeed}`;
  let byKey = verificationCache.get(receipt);
  const cached = byKey?.get(cacheKey);
  if (cached) return cached;

  let result: VerifyResult;
  if (receipt.matchId !== expectedMatchId) {
    result = invalidRoomResult('Match ID mismatch');
  } else if (receipt.seed !== expectedSeed) {
    result = invalidRoomResult('Seed mismatch');
  } else if (receipt.rescueEligible !== false || receipt.bombPaidCount !== 0) {
    result = invalidRoomResult(
      'Paid Candy Bomb rescue is disabled in competitive rooms',
    );
  } else {
    result = verifyMatchReceipt(receipt);
  }

  if (!byKey) {
    byKey = new Map<string, VerifyResult>();
    verificationCache.set(receipt, byKey);
  }
  byKey.set(cacheKey, result);
  return result;
}

/**
 * Returns true if an incoming progress event advances a peer's known state,
 * ignoring stale or duplicate-seq echoes while always allowing transition to 'finished'.
 */
export function shouldApplyProgressEvent(
  prev: BbPlayerProgress | undefined,
  evt: BbProgressEvent,
): boolean {
  if (!prev) return true;
  if (evt.status === 'finished' && prev.status !== 'finished') return true;
  if (prev.status === 'finished' && evt.status !== 'finished') return false;
  return evt.seq > prev.seq;
}

/**
 * Guards against false-positive disconnects caused by transient Presence flickers:
 * never disconnects self and spares peers whose progress updated within the grace window.
 */
export function shouldMarkPeerDisconnected(
  rosterId: string,
  myPeerId: string,
  latest: BbPlayerProgress | undefined,
  nowMs: number,
  graceMs: number,
): boolean {
  if (rosterId === myPeerId) return false;
  if (!latest || latest.status !== 'playing') return false;
  if (nowMs - latest.updatedAt < graceMs) return false;
  return true;
}

/** Returns true once every participant in the match roster has finished or disconnected. */
export function isRoomMatchComplete(
  rosterPeerIds: readonly string[],
  progressByPeer: Readonly<Record<string, BbPlayerProgress>>,
): boolean {
  if (rosterPeerIds.length === 0) return false;
  return rosterPeerIds.every((peerId) => {
    const status = progressByPeer[peerId]?.status;
    return status === 'finished' || status === 'disconnected';
  });
}

/** Computes ranked leaderboard entries with independent receipt verification and tie-breaks. */
export function computeRoomStandings(
  rosterPeerIds: readonly string[],
  rosterSnapshots: Readonly<Record<string, BbParticipantInfo>>,
  progressByPeer: Readonly<Record<string, BbPlayerProgress>>,
  receiptsByPeer: Readonly<Record<string, MatchReceipt>>,
  expectedMatchId: string,
  expectedSeed: number,
  isFinal: boolean,
): BbRoomStanding[] {
  const rows: BbRoomStanding[] = rosterPeerIds.map((peerId) => {
    const info = rosterSnapshots[peerId];
    const prog = progressByPeer[peerId];
    const receipt = receiptsByPeer[peerId];

    let status: BbPlayerStatus = prog?.status ?? 'playing';
    let verification: BbVerificationStatus =
      status === 'disconnected' ? 'disconnected' : 'pending';
    let verificationReason: string | undefined;
    let score = prog?.score ?? 0;
    let linesCleared = prog?.linesCleared ?? 0;
    let maxStreak = prog?.maxStreak ?? 0;

    if (receipt) {
      const check = verifyRoomSubmission(
        receipt,
        expectedMatchId,
        expectedSeed,
      );
      status = 'finished';
      if (check.valid) {
        verification = 'verified';
        score = check.verifiedScore;
        linesCleared = check.linesCleared;
        maxStreak = check.maxStreak;
      } else {
        verification = 'invalid';
        verificationReason = check.reason;
      }
    }

    return {
      rank: 0,
      peerId,
      name: info?.name ?? 'Người chơi',
      animal: info?.animal ?? 'dog',
      accessory: info?.accessory ?? [],
      avatarFrame: info?.avatarFrame ?? null,
      joinedAt: info?.joinedAt ?? 0,
      status,
      verification,
      verificationReason,
      score,
      stage: prog?.stage ?? 1,
      allClears: prog?.allClears ?? 0,
      streak: prog?.streak ?? 0,
      maxStreak,
      linesCleared,
      movesCount: prog?.movesCount ?? 0,
      compactGrid: prog?.compactGrid ?? EMPTY_COMPACT_GRID,
    };
  });

  rows.sort((a, b) => {
    const bucketDiff =
      verificationBucket(a.verification, isFinal) -
      verificationBucket(b.verification, isFinal);
    if (bucketDiff !== 0) return bucketDiff;
    if (b.score !== a.score) return b.score - a.score;
    if (b.allClears !== a.allClears) return b.allClears - a.allClears;
    if (b.maxStreak !== a.maxStreak) return b.maxStreak - a.maxStreak;
    if (b.linesCleared !== a.linesCleared) return b.linesCleared - a.linesCleared;
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
    return a.peerId.localeCompare(b.peerId);
  });

  return rows.map((row, idx) => ({
    ...row,
    rank: idx + 1,
  }));
}
