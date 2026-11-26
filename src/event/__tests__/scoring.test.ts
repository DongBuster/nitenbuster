import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EVENT_SETTINGS,
  EVENT_TIME_LIMIT_BOUNDS,
  sanitizeEventSettings,
  type EventMember,
  type EventRoundPlayerResult,
} from '../protocol.ts';
import {
  applyRoundToStandings,
  assignGlassPairs,
  getEventCookieReward,
  rankEventRound,
  scoreCardsHandPenalty,
} from '../scoring.ts';

function makeMember(
  peerId: string,
  name: string,
  joinedAt: number,
  animal: EventMember['animal'] = 'dog',
): EventMember {
  return {
    peerId,
    name,
    animal,
    accessory: [],
    isHost: joinedAt === 1,
    ready: true,
    joinedAt,
  };
}

describe('sanitizeEventSettings', () => {
  it('returns defaults for missing or invalid input', () => {
    const clean = sanitizeEventSettings({});
    assert.deepEqual(clean, DEFAULT_EVENT_SETTINGS);
  });

  it('deduplicates games and clamps per-game time limits to valid bounds', () => {
    const clean = sanitizeEventSettings({
      games: ['brawl', 'cards', 'brawl', 'invalid' as never],
      timeLimits: {
        cards: 10,
        blockblast: 9999,
        brawl: 75,
        glassCarry: -5,
      },
      brawlRounds: 5 as never,
      autoAdvanceSec: 0,
    });

    assert.deepEqual(clean.games, ['brawl', 'cards']);
    assert.equal(clean.timeLimits.cards, EVENT_TIME_LIMIT_BOUNDS.cards.min);
    assert.equal(clean.timeLimits.blockblast, EVENT_TIME_LIMIT_BOUNDS.blockblast.max);
    assert.equal(clean.timeLimits.brawl, 75);
    assert.equal(clean.timeLimits.glassCarry, EVENT_TIME_LIMIT_BOUNDS.glassCarry.min);
    assert.equal(clean.brawlRounds, 2);
    assert.equal(clean.autoAdvanceSec, 0);
  });
});

describe('rankEventRound', () => {
  it('assigns Grand Prix points [10, 7, 5, 4, 3, 2, 1, 1] and 1224 competition ranking for ties', () => {
    const ranked = rankEventRound([
      { peerId: 'p1', primaryScore: 500, secondaryScore: 10, tertiaryScore: 60, metricLabel: '500 điểm' },
      { peerId: 'p2', primaryScore: 500, secondaryScore: 10, tertiaryScore: 60, metricLabel: '500 điểm' },
      { peerId: 'p3', primaryScore: 400, secondaryScore: 8, tertiaryScore: 55, metricLabel: '400 điểm' },
      { peerId: 'p4', primaryScore: 400, secondaryScore: 12, tertiaryScore: 40, metricLabel: '400 điểm' },
    ]);

    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[0].pointsAwarded, 10);
    assert.equal(ranked[1].rank, 1);
    assert.equal(ranked[1].pointsAwarded, 10);

    // Next after two tied 1st places is rank 3 (p4 beats p3 on secondaryScore)
    assert.equal(ranked[2].peerId, 'p4');
    assert.equal(ranked[2].rank, 3);
    assert.equal(ranked[2].pointsAwarded, 5);

    assert.equal(ranked[3].peerId, 'p3');
    assert.equal(ranked[3].rank, 4);
    assert.equal(ranked[3].pointsAwarded, 4);
  });
});

describe('applyRoundToStandings', () => {
  it('aggregates points across rounds and breaks ties by firstPlaces, latest rank, then joinedAt', () => {
    const members = [
      makeMember('p1', 'An', 1),
      makeMember('p2', 'Bình', 2),
      makeMember('p3', 'Chi', 3),
    ];

    const round1: EventRoundPlayerResult[] = [
      { peerId: 'p1', rank: 1, pointsAwarded: 10, metricLabel: 'Hạng 1' },
      { peerId: 'p2', rank: 2, pointsAwarded: 7, metricLabel: 'Hạng 2' },
      { peerId: 'p3', rank: 3, pointsAwarded: 5, metricLabel: 'Hạng 3' },
    ];

    const round2: EventRoundPlayerResult[] = [
      { peerId: 'p2', rank: 1, pointsAwarded: 10, metricLabel: 'Hạng 1' },
      { peerId: 'p1', rank: 2, pointsAwarded: 7, metricLabel: 'Hạng 2' },
      { peerId: 'p3', rank: 3, pointsAwarded: 5, metricLabel: 'Hạng 3' },
    ];

    const after1 = applyRoundToStandings(members, [], 'cards', 0, round1);
    const after2 = applyRoundToStandings(members, after1, 'blockblast', 1, round2);

    // Both p1 and p2 have 17 points and 1 firstPlace; p2 won the latest round (rank 1 vs rank 2)
    assert.equal(after2[0].peerId, 'p2');
    assert.equal(after2[0].totalPoints, 17);
    assert.equal(after2[0].firstPlaces, 1);
    assert.equal(after2[1].peerId, 'p1');
    assert.equal(after2[1].totalPoints, 17);
    assert.equal(after2[2].peerId, 'p3');
    assert.equal(after2[2].totalPoints, 10);
  });
});

describe('assignGlassPairs', () => {
  it('groups even player counts into 2-player pairs without leftover solo slots', () => {
    const members = [
      makeMember('p1', 'A', 1),
      makeMember('p2', 'B', 2),
      makeMember('p3', 'C', 3),
      makeMember('p4', 'D', 4),
    ];
    const pairs = assignGlassPairs(members, 12345);
    assert.equal(pairs.length, 2);
    assert.ok(pairs.every((p) => p.mode === 'pair' && p.memberIds.length === 2));
    const flat = pairs.flatMap((p) => p.memberIds).sort();
    assert.deepEqual(flat, ['p1', 'p2', 'p3', 'p4']);
  });

  it('groups odd player counts into pairs plus exactly one solo slot', () => {
    const members = [
      makeMember('p1', 'A', 1),
      makeMember('p2', 'B', 2),
      makeMember('p3', 'C', 3),
      makeMember('p4', 'D', 4),
      makeMember('p5', 'E', 5),
    ];
    const pairs = assignGlassPairs(members, 67890);
    assert.equal(pairs.length, 3);
    const pairSlots = pairs.filter((p) => p.mode === 'pair');
    const soloSlots = pairs.filter((p) => p.mode === 'solo');
    assert.equal(pairSlots.length, 2);
    assert.equal(soloSlots.length, 1);
    assert.equal(soloSlots[0].memberIds.length, 1);
  });
});

describe('scoreCardsHandPenalty & getEventCookieReward', () => {
  it('computes card hand penalties accurately (basic face value, colored action 20, colorless wild 30)', () => {
    assert.equal(
      scoreCardsHandPenalty([
        { id: 'c1', color: 'pink', type: 'basic', value: 7 },
        { id: 'c2', color: 'blue', type: 'freeze' },
        { id: 'c3', type: 'arrow' },
      ]),
      57,
    );
    assert.equal(scoreCardsHandPenalty([]), 0);
  });

  it('returns spec Cookie rewards by final rank', () => {
    assert.equal(getEventCookieReward(1), 80);
    assert.equal(getEventCookieReward(2), 50);
    assert.equal(getEventCookieReward(3), 30);
    assert.equal(getEventCookieReward(4), 15);
    assert.equal(getEventCookieReward(8), 15);
  });
});
