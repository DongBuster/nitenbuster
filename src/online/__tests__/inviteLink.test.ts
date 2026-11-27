import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoomInviteUrl,
  INVITE_PARAM_KEYS,
} from '../inviteLink.ts';

describe('buildRoomInviteUrl', () => {
  it('builds clean normalized invite URLs for event and cards rooms', () => {
    assert.equal(
      buildRoomInviteUrl('event', ' ab12c ', 'https://paws.game', '/arcade'),
      'https://paws.game/arcade?eventRoom=AB12C',
    );
    assert.equal(
      buildRoomInviteUrl('cards', 'k9p2x', 'https://paws.game', '/'),
      'https://paws.game/?cardsRoom=K9P2X',
    );
  });

  it('returns empty string for invalid or too-short room codes', () => {
    assert.equal(buildRoomInviteUrl('event', 'ab', 'https://paws.game', '/'), '');
    assert.equal(buildRoomInviteUrl('cards', '', 'https://paws.game', '/'), '');
  });

  it('exposes consistent query param names for all supported modes', () => {
    assert.equal(INVITE_PARAM_KEYS.event, 'eventRoom');
    assert.equal(INVITE_PARAM_KEYS.cards, 'cardsRoom');
  });
});
