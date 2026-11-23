import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { totalCardsInState } from '../../engine/deck.ts';
import { dealOnlineGame, playCard } from '../../engine/game.ts';
import {
  generateRoomCode,
  normalizeRoomCode,
  reconstructClientGameState,
  sanitizeStateForBroadcast,
} from '../sanitize.ts';
import type { CardData } from '../../engine/types.ts';

describe('PAWS Online Sanitize & Deal Suite', () => {
  it('1. dealOnlineGame with 2-8 humans + fillToCount preserves total card count and assigns distinct animals', () => {
    const mvpState = dealOnlineGame({
      humans: [
        { id: 'peer-a', name: 'An', animal: 'dog' },
        { id: 'peer-b', name: 'Bình', animal: 'cat' },
      ],
      fillToCount: 4,
      difficulty: 'medium',
      deckMode: 'mvp',
      seed: 101,
    });

    assert.equal(mvpState.players.length, 4);
    assert.equal(mvpState.players[0].id, 'peer-a');
    assert.equal(mvpState.players[0].isBot, false);
    assert.equal(mvpState.players[1].id, 'peer-b');
    assert.equal(mvpState.players[1].isBot, false);
    assert.equal(mvpState.players[2].isBot, true);
    assert.equal(mvpState.players[3].isBot, true);
    assert.equal(totalCardsInState(mvpState), 112);
    assert.equal(
      new Set(mvpState.players.map((p) => p.animal)).size,
      4,
      'All 4 seated players should have distinct animals'
    );

    const full8State = dealOnlineGame({
      humans: [
        { id: 'p1', name: 'P1', animal: 'dog' },
        { id: 'p2', name: 'P2', animal: 'cat' },
        { id: 'p3', name: 'P3', animal: 'duck' },
        { id: 'p4', name: 'P4', animal: 'shark' },
        { id: 'p5', name: 'P5', animal: 'dino' },
        { id: 'p6', name: 'P6', animal: 'panda' },
        { id: 'p7', name: 'P7', animal: 'chicken' },
        { id: 'p8', name: 'P8', animal: 'bunny' },
      ],
      fillToCount: 8,
      deckMode: 'full',
      seed: 202,
    });

    assert.equal(full8State.players.length, 8);
    assert.equal(full8State.players.every((p) => !p.isBot), true);
    assert.equal(full8State.players.every((p) => p.hand.length === 7), true);
    assert.equal(full8State.discardPile.length, 1);
    assert.equal(totalCardsInState(full8State), 122);
    assert.equal(new Set(full8State.players.map((p) => p.animal)).size, 8);
  });

  it('2. sanitizeStateForBroadcast strips opponent hands and hidden drawPile trapped flags while preserving public fields', () => {
    let state = dealOnlineGame({
      humans: [
        { id: 'peer-1', name: 'Host', animal: 'dog' },
        { id: 'peer-2', name: 'Guest', animal: 'shark' },
      ],
      fillToCount: 4,
      deckMode: 'full',
      seed: 303,
    });

    // Inject a banana into peer-1's hand and play it so drawPile contains a trapped card
    const bananaCard: CardData = { id: 'test-banana', type: 'banana' };
    state = {
      ...state,
      players: state.players.map((p, idx) =>
        idx === 0 ? { ...p, hand: [bananaCard, ...p.hand] } : p
      ),
      pending: { kind: 'draw', count: 2, source: 'shovel' },
      activeBomb: { fuse: 3, color: 'blue', ownerId: 'peer-1' },
    };
    state = {
      ...playCard(
        { ...state, pending: null },
        'peer-1',
        'test-banana',
        { chosenColor: 'green', seed: 44 }
      ),
      pending: { kind: 'draw', count: 2, source: 'shovel' },
      activeBomb: { fuse: 3, color: 'blue', ownerId: 'peer-1' },
    };

    // Confirm authoritative drawPile really has a trapped banana before sanitizing
    assert.equal(state.drawPile.some((c) => c.trapped === true), true);

    const pub = sanitizeStateForBroadcast(state);
    const serialized = JSON.stringify(pub);

    assert.equal('drawPile' in pub, false);
    assert.equal(pub.drawPileCount, state.drawPile.length);
    assert.equal(pub.currentColor, 'green');
    assert.deepEqual(pub.discardPile, state.discardPile);
    assert.deepEqual(pub.activeBomb, state.activeBomb);
    assert.deepEqual(pub.pending, state.pending);

    for (let i = 0; i < pub.players.length; i++) {
      assert.equal('hand' in pub.players[i], false);
      assert.equal(pub.players[i].handCount, state.players[i].hand.length);
    }

    // No trapped flag or secret drawPile card ID should leak into broadcast JSON
    assert.equal(serialized.includes('"trapped"'), false);
    assert.equal(serialized.includes('test-banana'), false);
  });

  it('3. reconstructClientGameState restores exact myHand for myPeerId and valid counts for all players & drawPile', () => {
    const state = dealOnlineGame({
      humans: [
        { id: 'peer-host', name: 'Host', animal: 'cat' },
        { id: 'peer-guest', name: 'Guest', animal: 'bunny' },
      ],
      fillToCount: 4,
      deckMode: 'full',
      seed: 404,
    });

    const pub = sanitizeStateForBroadcast(state);
    const guestHand = state.players[1].hand;
    const clientState = reconstructClientGameState(pub, 'peer-guest', guestHand);

    assert.equal(clientState.drawPile.length, state.drawPile.length);
    assert.equal(clientState.players.length, 4);
    assert.deepEqual(clientState.players[1].hand, guestHand);
    assert.equal(clientState.players[0].hand.length, state.players[0].hand.length);
    assert.notDeepEqual(clientState.players[0].hand, state.players[0].hand);
    assert.equal(totalCardsInState(clientState), totalCardsInState(state));
  });

  it('4. generateRoomCode and normalizeRoomCode produce clean uppercase codes with no ambiguous chars', () => {
    const ambiguous = /[0O1I]/;

    for (let i = 0; i < 40; i++) {
      const code = generateRoomCode();
      assert.equal(code.length, 5);
      assert.equal(code, code.toUpperCase());
      assert.equal(ambiguous.test(code), false, `Found ambiguous char in ${code}`);
    }

    assert.equal(generateRoomCode(6).length, 6);
    assert.equal(normalizeRoomCode(' ab-c 23 '), 'ABC23');
    assert.equal(normalizeRoomCode('paws-9999'), 'PAWS99');
  });
});
