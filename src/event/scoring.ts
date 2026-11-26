import type { CardData } from '../engine/types.ts';
import type {
  EventGameId,
  EventMember,
  EventRoundPlayerResult,
  EventStanding,
  GlassPairAssignment,
} from './protocol.ts';

export const EVENT_GRAND_PRIX_POINTS: readonly number[] = [
  10, 7, 5, 4, 3, 2, 1, 1,
] as const;

export interface RoundRankingInput {
  peerId: string;
  /** Higher is better. */
  primaryScore: number;
  /** Higher is better. */
  secondaryScore?: number;
  /** Higher is better. */
  tertiaryScore?: number;
  metricLabel: string;
}

export function getGrandPrixPointsForRank(rank: number): number {
  if (!Number.isFinite(rank) || rank < 1) return 1;
  return EVENT_GRAND_PRIX_POINTS[Math.floor(rank) - 1] ?? 1;
}

export function getEventCookieReward(finalRank: number): number {
  if (finalRank === 1) return 80;
  if (finalRank === 2) return 50;
  if (finalRank === 3) return 30;
  return 15;
}

/**
 * Ranks players descending by (primaryScore, secondaryScore, tertiaryScore)
 * using standard 1224 competition ranking so tied players share the higher rank & points.
 */
export function rankEventRound(
  entries: readonly RoundRankingInput[],
): EventRoundPlayerResult[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.primaryScore !== a.primaryScore) return b.primaryScore - a.primaryScore;
    const secA = a.secondaryScore ?? 0;
    const secB = b.secondaryScore ?? 0;
    if (secB !== secA) return secB - secA;
    const terA = a.tertiaryScore ?? 0;
    const terB = b.tertiaryScore ?? 0;
    if (terB !== terA) return terB - terA;
    return a.peerId.localeCompare(b.peerId);
  });

  const out: EventRoundPlayerResult[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1];
      const isTied =
        cur.primaryScore === prev.primaryScore &&
        (cur.secondaryScore ?? 0) === (prev.secondaryScore ?? 0) &&
        (cur.tertiaryScore ?? 0) === (prev.tertiaryScore ?? 0);
      if (!isTied) {
        currentRank = i + 1;
      }
    }

    out.push({
      peerId: cur.peerId,
      rank: currentRank,
      pointsAwarded: getGrandPrixPointsForRank(currentRank),
      metricLabel: cur.metricLabel,
    });
  }

  return out;
}

export function createInitialStandings(
  roster: readonly EventMember[],
): EventStanding[] {
  return roster
    .map((m) => ({
      peerId: m.peerId,
      name: m.name,
      animal: m.animal,
      accessory: [...m.accessory],
      joinedAt: m.joinedAt,
      totalPoints: 0,
      firstPlaces: 0,
      lastRoundRank: 99,
      roundPoints: {},
    }))
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

/**
 * Merges a finished round's placements into cumulative standings and sorts
 * by totalPoints → firstPlaces → latest round rank → joinedAt.
 */
export function applyRoundToStandings(
  roster: readonly EventMember[],
  previousStandings: readonly EventStanding[],
  _gameId: EventGameId,
  roundIndex: number,
  roundResults: readonly EventRoundPlayerResult[],
): EventStanding[] {
  const byPeer = new Map<string, EventStanding>();

  for (const prev of previousStandings) {
    byPeer.set(prev.peerId, {
      ...prev,
      accessory: [...prev.accessory],
      roundPoints: { ...prev.roundPoints },
    });
  }

  for (const member of roster) {
    const existing = byPeer.get(member.peerId);
    if (!existing) {
      byPeer.set(member.peerId, {
        peerId: member.peerId,
        name: member.name,
        animal: member.animal,
        accessory: [...member.accessory],
        joinedAt: member.joinedAt,
        totalPoints: 0,
        firstPlaces: 0,
        lastRoundRank: 99,
        roundPoints: {},
      });
    } else {
      existing.name = member.name;
      existing.animal = member.animal;
      existing.accessory = [...member.accessory];
    }
  }

  for (const res of roundResults) {
    const entry = byPeer.get(res.peerId);
    if (!entry) continue;
    entry.totalPoints += res.pointsAwarded;
    if (res.rank === 1) {
      entry.firstPlaces += 1;
    }
    entry.lastRoundRank = res.rank;
    entry.roundPoints[roundIndex] = res.pointsAwarded;
  }

  return Array.from(byPeer.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
    if (a.lastRoundRank !== b.lastRoundRank) return a.lastRoundRank - b.lastRoundRank;
    return a.joinedAt - b.joinedAt;
  });
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically shuffles the roster with `seed` and groups players into
 * 2-player pairs plus at most one solo slot when player count is odd.
 */
export function assignGlassPairs(
  roster: readonly EventMember[],
  seed: number,
  roomCode = 'EVENT',
  roundIndex = 0,
): GlassPairAssignment[] {
  const rng = mulberry32(seed || 1);
  const shuffled = [...roster];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }

  const pairs: GlassPairAssignment[] = [];
  let idx = 0;
  let pairNum = 1;

  while (idx < shuffled.length) {
    const first = shuffled[idx];
    const second = shuffled[idx + 1];
    const pairId = `pair-${pairNum}`;
    const subChannelCode = `${roomCode}:r${roundIndex}:${pairId}`;

    if (second) {
      pairs.push({
        pairId,
        mode: 'pair',
        memberIds: [first.peerId, second.peerId],
        subChannelCode,
      });
      idx += 2;
    } else {
      pairs.push({
        pairId,
        mode: 'solo',
        memberIds: [first.peerId],
        subChannelCode,
      });
      idx += 1;
    }
    pairNum += 1;
  }

  return pairs;
}

/**
 * Calculates penalty points of remaining cards in hand for PAWS Cards tie-break.
 * Basic card = face value; colored action = 20; colorless wild/special = 30.
 */
export function scoreCardsHandPenalty(hand: readonly CardData[]): number {
  let total = 0;
  for (const card of hand) {
    if (card.type === 'basic') {
      total += typeof card.value === 'number' ? card.value : 0;
    } else if (!card.color) {
      total += 30;
    } else {
      total += 20;
    }
  }
  return total;
}

export function formatSecondsClock(totalSec: number): string {
  const clamped = Math.max(0, Math.ceil(totalSec));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
