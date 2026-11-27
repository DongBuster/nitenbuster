import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOnlineBrawlRoster,
  canStartBrawlRoom,
  electBrawlHost,
} from '../roomRoster.ts';
import {
  buildBrawlRoundKey,
  type BrawlRoomMember,
  type BrawlRoomSettings,
} from '../protocol.ts';

function makeMember(
  peerId: string,
  joinedAt: number,
  overrides: Partial<BrawlRoomMember> = {},
): BrawlRoomMember {
  return {
    peerId,
    name: `Player ${peerId}`,
    animal: 'dog',
    accessory: [],
    ready: true,
    joinedAt,
    ...overrides,
  };
}

describe('brawl online room roster & host election', () => {
  it('elects the earliest joined member as host, tie-breaking by peerId', () => {
    assert.equal(electBrawlHost([]), null);
    const members = [
      makeMember('p2', 200),
      makeMember('p1', 100),
      makeMember('p0', 100),
    ];
    assert.equal(electBrawlHost(members), 'p0');
  });

  it('builds a roster with humans first and fills bots up to targetPlayers when enabled', () => {
    const members = [
      makeMember('host', 100, { animal: 'dog', name: 'Đông' }),
      makeMember('guest', 200, { animal: 'cat', name: 'Linh' }),
    ];
    const settings: BrawlRoomSettings = {
      fillWithBots: true,
      targetPlayers: 4,
      difficulty: 'medium',
    };

    const roster = buildOnlineBrawlRoster(members, settings);
    assert.equal(roster.length, 4);
    assert.equal(roster[0].id, 'host');
    assert.equal(roster[0].isBot, false);
    assert.equal(roster[1].id, 'guest');
    assert.equal(roster[1].isBot, false);
    assert.equal(roster[2].isBot, true);
    assert.equal(roster[3].isBot, true);
    // Bots avoid picking animals already chosen by humans when alternatives exist
    assert.notEqual(roster[2].animal, 'dog');
    assert.notEqual(roster[2].animal, 'cat');
  });

  it('builds a human-only roster when fillWithBots is disabled', () => {
    const members = [
      makeMember('host', 100, { animal: 'shark' }),
      makeMember('guest', 200, { animal: 'duck' }),
    ];
    const roster = buildOnlineBrawlRoster(members, {
      fillWithBots: false,
      targetPlayers: 6,
      difficulty: 'hard',
    });

    assert.equal(roster.length, 2);
    assert.ok(roster.every((f) => !f.isBot));
  });

  it('enforces readiness and minimum fighter count before host can start', () => {
    const hostOnly = [makeMember('host', 100, { ready: false })];
    assert.equal(
      canStartBrawlRoom(hostOnly, {
        fillWithBots: true,
        targetPlayers: 4,
        difficulty: 'medium',
      }),
      true,
    );
    assert.equal(
      canStartBrawlRoom(hostOnly, {
        fillWithBots: false,
        targetPlayers: 4,
        difficulty: 'medium',
      }),
      false,
    );

    const twoWithUnreadyGuest = [
      makeMember('host', 100, { ready: false }),
      makeMember('guest', 200, { ready: false }),
    ];
    assert.equal(
      canStartBrawlRoom(twoWithUnreadyGuest, {
        fillWithBots: false,
        targetPlayers: 4,
        difficulty: 'medium',
      }),
      false,
    );

    const twoAllReady = [
      makeMember('host', 100, { ready: false }),
      makeMember('guest', 200, { ready: true }),
    ];
    assert.equal(
      canStartBrawlRoom(twoAllReady, {
        fillWithBots: false,
        targetPlayers: 4,
        difficulty: 'medium',
      }),
      true,
    );
  });

  it('prioritizes explicit isHost flag over client clock skew in joinedAt', () => {
    const members = [
      makeMember('guest-skew', 50, { isHost: false }),
      makeMember('creator-host', 1000, { isHost: true }),
    ];
    assert.equal(electBrawlHost(members), 'creator-host');

    const roster = buildOnlineBrawlRoster(members, {
      fillWithBots: false,
      targetPlayers: 2,
      difficulty: 'medium',
    });
    assert.equal(roster[0].id, 'creator-host');
    assert.equal(roster[1].id, 'guest-skew');
  });

  it('builds consistent Brawl round keys from room code, match nonce, and round', () => {
    assert.equal(
      buildBrawlRoundKey('ROOM1', 2, 3),
      'brawl_online_ROOM1_m2_r3',
    );
  });
});
