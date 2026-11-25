import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { GameState, Player } from '../../engine/types.ts';
import {
  computePenaltyNoticeMessage,
  findNewlyCalledPawsPlayer,
} from '../useMatchNotices.ts';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p0',
    name: 'Bạn',
    animal: 'dog',
    isBot: false,
    hand: [],
    emotion: 'idle',
    calledPaws: false,
    quip: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    players: [makePlayer()],
    drawPile: [],
    discardPile: [{ id: 'top', type: 'basic', color: 'green', value: 2 }],
    direction: 1,
    currentIndex: 0,
    currentColor: 'green',
    pending: null,
    activeBomb: null,
    winnerId: null,
    logs: [],
    turnCount: 4,
    deckMode: 'full',
    difficulty: 'medium',
    lastEffectBanner: null,
    ...overrides,
  };
}

describe('matchNotices helpers', () => {
  it('1. reports Crossbow (+1 card) penalty notice and ignores subsequent turns with unchanged hand', () => {
    const state = makeState({
      turnCount: 5,
      lastEffectBanner: '🏹 Nỏ Thần bắn trúng Bạn (+1 lá)!',
    });

    const onHit = computePenaltyNoticeMessage({
      gameState: state,
      prevHandLength: 6,
      currHandLength: 7,
    });
    assert.equal(onHit, '+1 lá — 🏹 Nỏ Thần bắn trúng Bạn (+1 lá)!');

    const nextTurnState = makeState({
      turnCount: 6,
      lastEffectBanner: null,
    });
    const onNextTurn = computePenaltyNoticeMessage({
      gameState: nextTurnState,
      prevHandLength: 7,
      currHandLength: 7,
    });
    assert.equal(onNextTurn, null);
  });

  it('2. ignores normal +1 card draw and ignores +1 normal draw when another player triggers BÙM!', () => {
    const normalDraw = computePenaltyNoticeMessage({
      gameState: makeState({
        turnCount: 8,
        lastEffectBanner: null,
        logs: [{ id: 'l-8', text: 'Bạn rút 1 lá bài và qua lượt.', type: 'draw' }],
      }),
      prevHandLength: 5,
      currHandLength: 6,
    });
    assert.equal(normalDraw, null);

    const otherBombDraw = computePenaltyNoticeMessage({
      gameState: makeState({
        turnCount: 9,
        lastEffectBanner: '💣 BÙM! Bot 1 rút +4 lá!',
        logs: [
          { id: 'l-9a', text: 'Bạn rút 1 lá bài và qua lượt.', type: 'draw' },
          {
            id: 'l-9b',
            text: '💥 BÙM! Bom Kẹo phát nổ! Bot 1 chịu +4 lá phạt!',
            type: 'penalty',
          },
        ],
      }),
      prevHandLength: 5,
      currHandLength: 6,
    });
    assert.equal(otherBombDraw, null);
  });

  it('3. reports Shovel (+2), PAWS catch (+2), and Bomb (+4) penalties', () => {
    const shovel = computePenaltyNoticeMessage({
      gameState: makeState({
        turnCount: 3,
        lastEffectBanner: '📥 Bạn chịu phạt và rút 2 lá bài!',
        logs: [
          {
            id: 'l-3',
            text: '📥 Bạn chịu phạt và rút 2 lá bài!',
            type: 'penalty',
          },
        ],
      }),
      prevHandLength: 4,
      currHandLength: 6,
    });
    assert.equal(shovel, '+2 lá — 📥 Bạn chịu phạt và rút 2 lá bài!');

    const bomb = computePenaltyNoticeMessage({
      gameState: makeState({
        turnCount: 7,
        lastEffectBanner: '💣 BÙM! Bạn rút +4 lá!',
      }),
      prevHandLength: 3,
      currHandLength: 7,
    });
    assert.equal(bomb, '+4 lá — 💣 BÙM! Bạn rút +4 lá!');
  });

  it('4. returns null on initial turn, unknown previous length, or completed game', () => {
    const active = makeState({
      turnCount: 5,
      lastEffectBanner: '🏹 Nỏ Thần bắn trúng Bạn (+1 lá)!',
    });
    assert.equal(
      computePenaltyNoticeMessage({
        gameState: active,
        prevHandLength: null,
        currHandLength: 7,
      }),
      null,
    );
    assert.equal(
      computePenaltyNoticeMessage({
        gameState: makeState({ ...active, turnCount: 0 }),
        prevHandLength: 6,
        currHandLength: 7,
      }),
      null,
    );
    assert.equal(
      computePenaltyNoticeMessage({
        gameState: makeState({ ...active, winnerId: 'p1' }),
        prevHandLength: 6,
        currHandLength: 7,
      }),
      null,
    );
  });

  it('5. findNewlyCalledPawsPlayer detects only newly shouted PAWS players', () => {
    const players = [
      makePlayer({ id: 'p0', calledPaws: true }),
      makePlayer({ id: 'p1', name: 'Mèo', animal: 'cat', calledPaws: true }),
    ];

    const first = findNewlyCalledPawsPlayer(players, new Set(['p0']));
    assert.equal(first?.id, 'p1');

    const none = findNewlyCalledPawsPlayer(players, new Set(['p0', 'p1']));
    assert.equal(none, null);
  });
});
