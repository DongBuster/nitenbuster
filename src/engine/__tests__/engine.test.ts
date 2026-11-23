import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDeck,
  shuffleDeck,
  totalCardsInState,
} from '../deck.ts';
import {
  getPredictedBombVictim,
  isPlayable,
  needsColorChoice,
  needsTargetChoice,
} from '../rules.ts';
import {
  callPaws,
  catchMissedPaws,
  dealGame,
  drawTurnAction,
  playCard,
} from '../game.ts';
import { chooseBotAction, shouldBotCallPaws } from '../bot.ts';
import type { CardData, GameState, Player } from '../types.ts';

function makePlayer(
  id: string,
  hand: CardData[],
  isBot = true,
  animal: Player['animal'] = 'dog'
): Player {
  return {
    id,
    name: id,
    animal,
    isBot,
    hand,
    emotion: 'idle',
    calledPaws: false,
    quip: null,
  };
}

function makeCustomState(overrides: Partial<GameState>): GameState {
  const baseDraw: CardData[] = Array.from({ length: 20 }, (_, i) => ({
    id: `draw-${i}`,
    type: 'basic',
    color: (['pink', 'blue', 'green', 'yellow'] as const)[i % 4],
    value: (i % 9) + 1,
  }));

  return {
    players: [
      makePlayer('p0', [{ id: 'p0-1', type: 'basic', color: 'pink', value: 5 }], false, 'dog'),
      makePlayer('p1', [{ id: 'p1-1', type: 'basic', color: 'blue', value: 3 }], true, 'cat'),
      makePlayer('p2', [{ id: 'p2-1', type: 'basic', color: 'green', value: 4 }], true, 'duck'),
      makePlayer('p3', [{ id: 'p3-1', type: 'basic', color: 'yellow', value: 6 }], true, 'shark'),
    ],
    drawPile: baseDraw,
    discardPile: [{ id: 'top-0', type: 'basic', color: 'pink', value: 2 }],
    direction: 1,
    currentIndex: 0,
    currentColor: 'pink',
    pending: null,
    activeBomb: null,
    winnerId: null,
    logs: [],
    turnCount: 0,
    deckMode: 'full',
    difficulty: 'medium',
    lastEffectBanner: null,
    ...overrides,
  };
}

describe('PAWS Card Game Engine', () => {
  it('1. creates mvp (112) and full (122) decks with deterministic seeded shuffle', () => {
    const mvp = createDeck('mvp');
    const full = createDeck('full');
    assert.equal(mvp.length, 112);
    assert.equal(full.length, 122);

    const s1 = shuffleDeck(full, 42);
    const s2 = shuffleDeck(full, 42);
    const s3 = shuffleDeck(full, 99);

    assert.deepEqual(
      s1.map((c) => c.id),
      s2.map((c) => c.id)
    );
    assert.notDeepEqual(
      s1.map((c) => c.id),
      s3.map((c) => c.id)
    );
  });

  it('2. dealGame deals 7 cards per player + 1 discard card, preserving total card count', () => {
    const state = dealGame({
      humanAnimal: 'dog',
      humanName: 'Bạn',
      botCount: 3,
      difficulty: 'medium',
      deckMode: 'full',
      seed: 123,
    });

    assert.equal(state.players.length, 4);
    for (const p of state.players) {
      assert.equal(p.hand.length, 7);
    }
    assert.equal(state.discardPile.length, 1);
    assert.equal(totalCardsInState(state), 122);
    assert.equal(state.winnerId, null);
  });

  it('3. shovel stacked 3 times forces the next player to draw 6 cards', () => {
    let state = makeCustomState({
      players: [
        makePlayer('p0', [
          { id: 'sh0', type: 'shovel', color: 'pink' },
          { id: 'k0', type: 'basic', color: 'pink', value: 1 },
        ]),
        makePlayer('p1', [
          { id: 'sh1', type: 'shovel', color: 'blue' },
          { id: 'k1', type: 'basic', color: 'blue', value: 1 },
        ]),
        makePlayer('p2', [
          { id: 'sh2', type: 'shovel', color: 'green' },
          { id: 'k2', type: 'basic', color: 'green', value: 1 },
        ]),
        makePlayer('p3', [
          { id: 'k3', type: 'basic', color: 'yellow', value: 7 },
        ]),
      ],
    });
    const initialTotal = totalCardsInState(state);

    state = playCard(state, 'p0', 'sh0');
    assert.equal(state.pending?.kind, 'draw');
    assert.equal(state.pending?.count, 2);
    assert.equal(state.currentIndex, 1);
    assert.equal(isPlayable(state.players[1].hand[1], state), false);
    assert.equal(isPlayable(state.players[1].hand[0], state), true);

    state = playCard(state, 'p1', 'sh1');
    assert.equal(state.pending?.count, 4);
    assert.equal(state.currentIndex, 2);

    state = playCard(state, 'p2', 'sh2');
    assert.equal(state.pending?.count, 6);
    assert.equal(state.currentIndex, 3);

    const beforeHand = state.players[3].hand.length;
    state = drawTurnAction(state, 'p3', 7);
    assert.equal(state.players[3].hand.length, beforeHand + 6);
    assert.equal(state.pending, null);
    assert.equal(totalCardsInState(state), initialTotal);
  });

  it('4. boomerang acts as skip with 2 players and reverses direction with 4 players', () => {
    // 2 players: acts as skip so p0 keeps turn without index error
    const twoPlayer = makeCustomState({
      players: [
        makePlayer('p0', [
          { id: 'b0', type: 'boomerang', color: 'pink' },
          { id: 'k0', type: 'basic', color: 'pink', value: 3 },
        ]),
        makePlayer('p1', [{ id: 'k1', type: 'basic', color: 'blue', value: 4 }]),
      ],
    });
    const afterTwo = playCard(twoPlayer, 'p0', 'b0');
    assert.equal(afterTwo.currentIndex, 0);
    assert.equal(totalCardsInState(afterTwo), totalCardsInState(twoPlayer));

    // 4 players: reverses direction from 1 to -1 and moves to index 3
    const fourPlayer = makeCustomState({
      players: [
        makePlayer('p0', [
          { id: 'b0', type: 'boomerang', color: 'pink' },
          { id: 'k0', type: 'basic', color: 'pink', value: 3 },
        ]),
        makePlayer('p1', [{ id: 'k1', type: 'basic', color: 'blue', value: 4 }]),
        makePlayer('p2', [{ id: 'k2', type: 'basic', color: 'green', value: 5 }]),
        makePlayer('p3', [{ id: 'k3', type: 'basic', color: 'yellow', value: 6 }]),
      ],
    });
    const afterFour = playCard(fourPlayer, 'p0', 'b0');
    assert.equal(afterFour.direction, -1);
    assert.equal(afterFour.currentIndex, 3);
    assert.equal(totalCardsInState(afterFour), totalCardsInState(fourPlayer));
  });

  it('5. taser draws until matching color or wild, reshuffling discard pile when draw pile empties', () => {
    const state = makeCustomState({
      players: [
        makePlayer('p0', [
          { id: 'ts0', type: 'taser' },
          { id: 'k0', type: 'basic', color: 'pink', value: 1 },
        ]),
        makePlayer('p1', [{ id: 'k1', type: 'basic', color: 'yellow', value: 2 }]),
        makePlayer('p2', [{ id: 'k2', type: 'basic', color: 'green', value: 3 }]),
      ],
      // Only 1 non-matching card in drawPile; matching 'blue' card sits inside discardPile
      drawPile: [{ id: 'd1', type: 'basic', color: 'green', value: 4 }],
      discardPile: [
        { id: 'old-blue', type: 'basic', color: 'blue', value: 8 },
        { id: 'old-red', type: 'basic', color: 'pink', value: 5 },
        { id: 'top-0', type: 'basic', color: 'pink', value: 2 },
      ],
    });
    const initialTotal = totalCardsInState(state);

    assert.equal(needsColorChoice('taser'), true);
    const next = playCard(state, 'p0', 'ts0', { chosenColor: 'blue', seed: 11 });
    assert.equal(next.currentColor, 'blue');
    // p1 drew at least 2 cards (d1 + reshuffled cards until blue) and is skipped (turn advances to p2)
    assert.ok(next.players[1].hand.length >= 3);
    assert.ok(
      next.players[1].hand.some((c) => c.color === 'blue' || c.color === undefined)
    );
    assert.equal(next.currentIndex, 2);
    assert.equal(totalCardsInState(next), initialTotal);
  });

  it('6. winning on an action card (freeze / shovel) sets winnerId immediately', () => {
    const freezeWinState = makeCustomState({
      players: [
        makePlayer('p0', [{ id: 'fr0', type: 'freeze', color: 'pink' }]),
        makePlayer('p1', [{ id: 'k1', type: 'basic', color: 'blue', value: 2 }]),
      ],
    });
    const afterFreeze = playCard(freezeWinState, 'p0', 'fr0');
    assert.equal(afterFreeze.winnerId, 'p0');
    assert.equal(afterFreeze.players[0].hand.length, 0);

    const shovelWinState = makeCustomState({
      players: [
        makePlayer('p0', [{ id: 'sh0', type: 'shovel', color: 'pink' }]),
        makePlayer('p1', [{ id: 'k1', type: 'basic', color: 'blue', value: 2 }]),
      ],
    });
    const afterShovel = playCard(shovelWinState, 'p0', 'sh0');
    assert.equal(afterShovel.winnerId, 'p0');
    assert.equal(afterShovel.players[0].hand.length, 0);
  });

  it('7. banana reinserts trapped card into drawPile and triggers +3 draw when drawn, preserving total cards', () => {
    const state = makeCustomState({
      players: [
        makePlayer('p0', [
          { id: 'ban0', type: 'banana' },
          { id: 'k0', type: 'basic', color: 'pink', value: 1 },
        ]),
        makePlayer('p1', [{ id: 'k1', type: 'basic', color: 'green', value: 2 }]),
      ],
      drawPile: [
        { id: 'd1', type: 'basic', color: 'yellow', value: 1 },
        { id: 'd2', type: 'basic', color: 'yellow', value: 2 },
        { id: 'd3', type: 'basic', color: 'yellow', value: 3 },
        { id: 'd4', type: 'basic', color: 'yellow', value: 4 },
      ],
    });
    const initialTotal = totalCardsInState(state);

    const afterBanana = playCard(state, 'p0', 'ban0', { chosenColor: 'blue', seed: 5 });
    assert.equal(afterBanana.currentColor, 'blue');
    // Banana must be in drawPile with trapped: true, NOT in discardPile
    assert.ok(afterBanana.drawPile.some((c) => c.id === 'ban0' && c.trapped === true));
    assert.equal(afterBanana.discardPile.some((c) => c.id === 'ban0'), false);
    assert.equal(totalCardsInState(afterBanana), initialTotal);

    // Put the trapped banana at the front of drawPile (next card drawn) so p1 draws it immediately
    const bananaCard = afterBanana.drawPile.find((c) => c.id === 'ban0')!;
    const restDraw = afterBanana.drawPile.filter((c) => c.id !== 'ban0');
    const riggedDrawState: GameState = {
      ...afterBanana,
      drawPile: [bananaCard, ...restDraw],
    };

    const p1Before = riggedDrawState.players[1].hand.length;
    const afterTrap = drawTurnAction(riggedDrawState, 'p1', 9);
    // Drawing trapped banana gives banana (cleared trapped) + 3 penalty cards = +4 cards total
    assert.equal(afterTrap.players[1].hand.length, p1Before + 4);
    assert.equal(
      afterTrap.players[1].hand.some((c) => c.id === 'ban0' && !c.trapped),
      true
    );
    assert.equal(totalCardsInState(afterTrap), initialTotal);
  });

  it('8. bomb fuse ticks down each turn and explodes for +4 cards', () => {
    let state = makeCustomState({
      players: [
        makePlayer('p0', [
          { id: 'bm0', type: 'bomb' },
          { id: 'p0-k', type: 'basic', color: 'blue', value: 5 },
        ]),
        makePlayer('p1', [{ id: 'p1-k', type: 'basic', color: 'green', value: 2 }]),
      ],
    });
    const initialTotal = totalCardsInState(state);

    state = playCard(state, 'p0', 'bm0', { chosenColor: 'blue', seed: 3 });
    assert.ok(state.activeBomb !== null);
    assert.equal(state.activeBomb?.fuse, 2);
    assert.equal(state.currentIndex, 1);

    // Turn 1 (p1 draws -> fuse ticks from 2 to 1)
    state = drawTurnAction(state, 'p1', 4);
    assert.ok(state.activeBomb !== null);
    assert.equal(state.activeBomb?.fuse, 1);
    assert.equal(state.currentIndex, 0);

    // Turn 2 (p0 draws -> turn lands on p1 -> fuse hits 0 and explodes on p1 for +4!)
    const p1Before = state.players[1].hand.length;
    state = drawTurnAction(state, 'p0', 5);
    assert.equal(state.activeBomb, null);
    assert.equal(state.players[1].hand.length, p1Before + 4);
    assert.equal(state.players[1].emotion, 'shock');
    assert.equal(totalCardsInState(state), initialTotal);
  });

  it('9. crossbow transfers 1 card from drawPile to target opponent and preserves total cards', () => {
    const state = makeCustomState({
      players: [
        makePlayer('p0', [
          { id: 'cb0', type: 'crossbow', color: 'pink' },
          { id: 'k0', type: 'basic', color: 'pink', value: 1 },
        ]),
        makePlayer('p1', [{ id: 'k1', type: 'basic', color: 'blue', value: 2 }]),
        makePlayer('p2', [{ id: 'k2', type: 'basic', color: 'green', value: 3 }]),
      ],
    });
    const initialTotal = totalCardsInState(state);
    assert.equal(needsTargetChoice('crossbow'), true);

    const p2Before = state.players[2].hand.length;
    const next = playCard(state, 'p0', 'cb0', { targetPlayerId: 'p2', seed: 12 });
    assert.equal(next.players[2].hand.length, p2Before + 1);
    assert.equal(totalCardsInState(next), initialTotal);
  });

  it('10. potion deflects stacked shovel draw penalty to the next player', () => {
    let state = makeCustomState({
      players: [
        makePlayer('p0', [
          { id: 'sh0', type: 'shovel', color: 'pink' },
          { id: 'k0', type: 'basic', color: 'pink', value: 1 },
        ]),
        makePlayer('p1', [
          { id: 'pot1', type: 'potion' },
          { id: 'k1', type: 'basic', color: 'blue', value: 2 },
        ]),
        makePlayer('p2', [{ id: 'k2', type: 'basic', color: 'green', value: 3 }]),
      ],
    });
    const initialTotal = totalCardsInState(state);

    state = playCard(state, 'p0', 'sh0');
    assert.equal(state.pending?.kind, 'draw');
    assert.equal(state.pending?.count, 2);
    assert.equal(state.currentIndex, 1);

    // p1 deflects with potion
    assert.equal(isPlayable(state.players[1].hand[0], state), true);
    state = playCard(state, 'p1', 'pot1', { chosenColor: 'yellow' });
    assert.equal(state.currentColor, 'yellow');
    assert.equal(state.pending?.kind, 'draw');
    assert.equal(state.pending?.count, 2);
    assert.equal(state.currentIndex, 2);
    assert.equal(totalCardsInState(state), initialTotal);
  });

  it('11. egg resolves a valid surprise effect cleanly without breaking card invariant', () => {
    const state = makeCustomState({
      players: [
        makePlayer('p0', [
          { id: 'egg0', type: 'egg' },
          { id: 'k0', type: 'basic', color: 'pink', value: 1 },
        ]),
        makePlayer('p1', [{ id: 'k1', type: 'basic', color: 'blue', value: 2 }]),
        makePlayer('p2', [{ id: 'k2', type: 'basic', color: 'green', value: 3 }]),
      ],
    });
    const initialTotal = totalCardsInState(state);

    const next = playCard(state, 'p0', 'egg0', { chosenColor: 'green', seed: 42 });
    assert.equal(next.currentColor, 'green');
    assert.equal(next.players[0].hand.length, 1);
    assert.equal(totalCardsInState(next), initialTotal);
    assert.ok(next.logs.length > 0);
  });

  it('12. full 50-turn Bot-vs-Bot invariant simulation preserves total card count on every action', () => {
    let state = dealGame({
      humanAnimal: 'cat',
      humanName: 'Bot-0',
      botCount: 3,
      difficulty: 'hard',
      deckMode: 'full',
      seed: 2026,
    });
    // Mark all players as bots for simulation
    state = {
      ...state,
      players: state.players.map((p) => ({ ...p, isBot: true })),
    };
    const initialTotal = totalCardsInState(state);
    assert.equal(initialTotal, 122);

    for (let turn = 0; turn < 50 && state.winnerId === null; turn++) {
      const active = state.players[state.currentIndex];
      const decision = chooseBotAction(state, 5000 + turn);

      if (decision.action === 'play') {
        state = playCard(state, active.id, decision.cardId, decision.options);
      } else {
        state = drawTurnAction(state, active.id, 6000 + turn);
      }

      const updatedActive = state.players.find((p) => p.id === active.id);
      if (
        updatedActive &&
        state.winnerId === null &&
        shouldBotCallPaws(updatedActive, state.difficulty, 7000 + turn)
      ) {
        state = callPaws(state, updatedActive.id);
      }

      assert.equal(
        totalCardsInState(state),
        initialTotal,
        `Card count invariant broken on turn ${turn} (${decision.action})`
      );
    }
  });

  it('13. catchMissedPaws penalizes 1-card player without calledPaws by +2 and ignores calledPaws === true', () => {
    const baseState = makeCustomState({
      players: [
        makePlayer('p0', [{ id: 'p0-1', type: 'basic', color: 'pink', value: 5 }], false, 'dog'),
        {
          ...makePlayer('p1', [{ id: 'p1-1', type: 'basic', color: 'blue', value: 3 }], true, 'cat'),
          calledPaws: false,
        },
        {
          ...makePlayer('p2', [{ id: 'p2-1', type: 'basic', color: 'green', value: 4 }], true, 'duck'),
          calledPaws: true,
        },
      ],
    });
    const initialTotal = totalCardsInState(baseState);

    // Target p1 has 1 card and calledPaws === false -> receives +2 penalty cards & shock emotion
    const caught = catchMissedPaws(baseState, 'p1', 'Bạn', 19);
    assert.equal(caught.players[1].hand.length, 3);
    assert.equal(caught.players[1].emotion, 'shock');
    assert.equal(totalCardsInState(caught), initialTotal);

    // Target p2 has 1 card and calledPaws === true -> no penalty, state unchanged
    const ignored = catchMissedPaws(baseState, 'p2', 'Bạn', 19);
    assert.equal(ignored, baseState);
    assert.equal(ignored.players[2].hand.length, 1);
  });

  it('14. 50-Match automated Bot-vs-Bot balance & invariant suite finishes cleanly', () => {
    let completedMatches = 0;

    for (let match = 0; match < 50; match++) {
      let state = dealGame({
        humanAnimal: 'dog',
        humanName: 'Bot-0',
        botCount: 3,
        difficulty: match % 3 === 0 ? 'easy' : match % 3 === 1 ? 'medium' : 'hard',
        deckMode: match % 2 === 0 ? 'full' : 'mvp',
        seed: 10000 + match * 97,
      });
      state = {
        ...state,
        players: state.players.map((p) => ({ ...p, isBot: true })),
      };

      const initialTotal = totalCardsInState(state);

      for (let turn = 0; turn < 200 && state.winnerId === null; turn++) {
        const active = state.players[state.currentIndex];
        const decision = chooseBotAction(state, 20000 + match * 500 + turn);

        if (decision.action === 'play') {
          state = playCard(state, active.id, decision.cardId, decision.options);
        } else {
          state = drawTurnAction(state, active.id, 30000 + match * 500 + turn);
        }

        const updatedActive = state.players.find((p) => p.id === active.id);
        if (
          updatedActive &&
          state.winnerId === null &&
          shouldBotCallPaws(updatedActive, state.difficulty, 40000 + match * 500 + turn)
        ) {
          state = callPaws(state, updatedActive.id);
        }

        assert.equal(
          totalCardsInState(state),
          initialTotal,
          `Invariant broken in match ${match} turn ${turn}`
        );
      }

      if (state.winnerId !== null) {
        completedMatches += 1;
      }
    }

    // Vast majority of 50 4-player matches should reach a natural winner within 200 turns
    assert.ok(
      completedMatches >= 35,
      `Expected at least 35/50 matches to finish within 200 turns, got ${completedMatches}`
    );
  });

  it('15. getPredictedBombVictim matches the actual player hit when bomb explodes', () => {
    const state = makeCustomState({
      currentIndex: 0,
      direction: 1,
      players: [
        makePlayer('p0', [
          { id: 'bomb-1', type: 'bomb' },
          { id: 'p0-keep', type: 'basic', color: 'pink', value: 1 },
        ], false, 'dog'),
        makePlayer('p1', [{ id: 'p1-1', type: 'basic', color: 'pink', value: 2 }], true, 'cat'),
        makePlayer('p2', [{ id: 'p2-1', type: 'basic', color: 'pink', value: 3 }], true, 'duck'),
        makePlayer('p3', [{ id: 'p3-1', type: 'basic', color: 'pink', value: 4 }], true, 'shark'),
      ],
    });

    assert.equal(getPredictedBombVictim(state), null);

    let s = playCard(state, 'p0', 'bomb-1', { chosenColor: 'pink', seed: 11 });
    assert.equal(s.activeBomb?.fuse, 4);
    assert.equal(getPredictedBombVictim(s)?.id, 'p1');

    // Advance 3 turns by drawing: predicted victim stays p1 each step
    s = drawTurnAction(s, 'p1', 12);
    assert.equal(s.activeBomb?.fuse, 3);
    assert.equal(getPredictedBombVictim(s)?.id, 'p1');

    s = drawTurnAction(s, 'p2', 13);
    assert.equal(s.activeBomb?.fuse, 2);
    assert.equal(getPredictedBombVictim(s)?.id, 'p1');

    s = drawTurnAction(s, 'p3', 14);
    assert.equal(s.activeBomb?.fuse, 1);
    assert.equal(getPredictedBombVictim(s)?.id, 'p1');

    const p1Before = s.players.find((p) => p.id === 'p1')!.hand.length;
    s = drawTurnAction(s, 'p0', 15);
    assert.equal(s.activeBomb, null);
    assert.equal(getPredictedBombVictim(s), null);
    assert.equal(s.players.find((p) => p.id === 'p1')!.hand.length, p1Before + 4);
  });
});
