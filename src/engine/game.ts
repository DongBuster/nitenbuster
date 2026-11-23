import {
  ANIMALS,
  type AnimalId,
  type BotDifficulty,
  type CardData,
  type Color,
  type Emotion,
  type GameDeckMode,
  type GameLogEntry,
  type GameState,
  type Player,
  type PlayOptions,
} from './types.ts';
import { createDeck, createSeededRng, shuffleDeck } from './deck.ts';
import { isPlayable, isWildCard } from './rules.ts';

export interface DealGameConfig {
  humanAnimal: AnimalId;
  humanName?: string;
  botCount?: number;
  difficulty?: BotDifficulty;
  deckMode?: GameDeckMode;
  seed?: number;
}

export interface OnlineHumanSeat {
  id: string;
  name: string;
  animal: AnimalId;
}

export interface DealOnlineGameConfig {
  humans: OnlineHumanSeat[];
  fillToCount?: number;
  difficulty?: BotDifficulty;
  deckMode?: GameDeckMode;
  seed?: number;
}

const COLOR_VI: Record<Color, string> = {
  pink: 'Hồng',
  blue: 'Xanh dương',
  green: 'Xanh lá',
  yellow: 'Vàng',
};

const MAX_LOGS = 24;

function appendLog(
  logs: GameLogEntry[],
  turnCount: number,
  text: string,
  type: GameLogEntry['type'],
): GameLogEntry[] {
  const entry: GameLogEntry = {
    id: `log-${turnCount}-${logs.length}-${Math.abs(text.length * 31)}`,
    text,
    type,
  };
  const next = [...logs, entry];
  return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
}

function getNextIndex(
  currentIndex: number,
  direction: 1 | -1,
  playerCount: number,
  skip = 0,
): number {
  const step = direction * (1 + skip);
  return (((currentIndex + step) % playerCount) + playerCount) % playerCount;
}

function updatePlayerAt(
  players: Player[],
  index: number,
  patch: Partial<Player>,
): Player[] {
  return players.map((p, i) => (i === index ? { ...p, ...patch } : p));
}

export function dealGame(config: DealGameConfig): GameState {
  const {
    humanAnimal,
    humanName = 'Bạn',
    botCount = 3,
    difficulty = 'medium',
    deckMode = 'full',
    seed,
  } = config;

  const clampedBots = Math.max(1, Math.min(7, botCount));
  const otherAnimals = ANIMALS.filter((a) => a.id !== humanAnimal);
  const rng = createSeededRng(seed);

  // Shuffle bot animal selection deterministically
  const botPool = otherAnimals.slice();
  for (let i = botPool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = botPool[i];
    botPool[i] = botPool[j];
    botPool[j] = tmp;
  }

  const players: Player[] = [
    {
      id: 'human',
      name: humanName,
      animal: humanAnimal,
      isBot: false,
      hand: [],
      emotion: 'idle',
      calledPaws: false,
      quip: null,
    },
  ];

  for (let i = 0; i < clampedBots; i++) {
    const meta = botPool[i % botPool.length];
    players.push({
      id: `bot-${i + 1}`,
      name: meta.name,
      animal: meta.id,
      isBot: true,
      hand: [],
      emotion: 'idle',
      calledPaws: false,
      quip: null,
    });
  }

  let drawPile = shuffleDeck(createDeck(deckMode), seed);

  // Deal 7 cards to each player
  for (let pIdx = 0; pIdx < players.length; pIdx++) {
    const hand = drawPile.slice(0, 7);
    drawPile = drawPile.slice(7);
    players[pIdx] = { ...players[pIdx], hand };
  }

  // Pick a clean non-wild starting card for discardPile
  let startIdx = drawPile.findIndex((c) => c.type === 'basic' && c.color);
  if (startIdx === -1) {
    startIdx = drawPile.findIndex((c) => Boolean(c.color));
  }
  if (startIdx === -1) startIdx = 0;

  const firstDiscard = drawPile[startIdx];
  drawPile = [
    ...drawPile.slice(0, startIdx),
    ...drawPile.slice(startIdx + 1),
  ];

  const currentColor: Color = firstDiscard.color ?? 'pink';

  return {
    players,
    drawPile,
    discardPile: [firstDiscard],
    direction: 1,
    currentIndex: 0,
    currentColor,
    pending: null,
    activeBomb: null,
    winnerId: null,
    logs: [
      {
        id: 'log-start',
        text: `Ván đấu bắt đầu! Màu đầu tiên: ${COLOR_VI[currentColor]}.`,
        type: 'effect',
      },
    ],
    turnCount: 0,
    deckMode,
    difficulty,
    lastEffectBanner: null,
  };
}

export function dealOnlineGame(config: DealOnlineGameConfig): GameState {
  const {
    humans,
    fillToCount,
    difficulty = 'medium',
    deckMode = 'full',
    seed,
  } = config;

  const clampedHumans = humans.slice(0, 8);
  const targetCount = Math.max(
    2,
    Math.min(8, Math.max(clampedHumans.length, fillToCount ?? clampedHumans.length)),
  );
  const rng = createSeededRng(seed);

  const usedAnimals = new Set<AnimalId>(clampedHumans.map((h) => h.animal));
  const availableBotAnimals = ANIMALS.filter((a) => !usedAnimals.has(a.id));

  // Shuffle unused animals deterministically for bot seats
  const botPool = (availableBotAnimals.length > 0 ? availableBotAnimals : ANIMALS).slice();
  for (let i = botPool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = botPool[i];
    botPool[i] = botPool[j];
    botPool[j] = tmp;
  }

  const players: Player[] = clampedHumans.map((h) => ({
    id: h.id,
    name: h.name,
    animal: h.animal,
    isBot: false,
    hand: [],
    emotion: 'idle',
    calledPaws: false,
    quip: null,
  }));

  const botsNeeded = Math.max(0, targetCount - players.length);
  for (let i = 0; i < botsNeeded; i++) {
    const meta = botPool[i % botPool.length];
    players.push({
      id: `bot-${i + 1}`,
      name: `${meta.name} (Bot)`,
      animal: meta.id,
      isBot: true,
      hand: [],
      emotion: 'idle',
      calledPaws: false,
      quip: null,
    });
  }

  let drawPile = shuffleDeck(createDeck(deckMode), seed);

  // Deal 7 cards to each player
  for (let pIdx = 0; pIdx < players.length; pIdx++) {
    const hand = drawPile.slice(0, 7);
    drawPile = drawPile.slice(7);
    players[pIdx] = { ...players[pIdx], hand };
  }

  // Flip 1 colored non-wild starting card
  let startIdx = drawPile.findIndex((c) => c.type === 'basic' && c.color);
  if (startIdx === -1) {
    startIdx = drawPile.findIndex((c) => Boolean(c.color));
  }
  if (startIdx === -1) startIdx = 0;

  const firstDiscard = drawPile[startIdx];
  drawPile = [
    ...drawPile.slice(0, startIdx),
    ...drawPile.slice(startIdx + 1),
  ];

  const currentColor: Color = firstDiscard.color ?? 'pink';

  return {
    players,
    drawPile,
    discardPile: [firstDiscard],
    direction: 1,
    currentIndex: 0,
    currentColor,
    pending: null,
    activeBomb: null,
    winnerId: null,
    logs: [
      {
        id: 'log-online-start',
        text: `🌐 Ván Online bắt đầu (${players.length} người)! Màu đầu tiên: ${COLOR_VI[currentColor]}.`,
        type: 'effect',
      },
    ],
    turnCount: 0,
    deckMode,
    difficulty,
    lastEffectBanner: null,
  };
}

export function reshuffleIfNeeded(state: GameState, seed?: number): GameState {
  if (state.drawPile.length > 0 || state.discardPile.length <= 1) {
    return state;
  }

  const topCard = state.discardPile[state.discardPile.length - 1];
  const recyclable = state.discardPile.slice(0, -1).map((c) =>
    c.trapped ? { ...c, trapped: false } : c,
  );
  const shuffled = shuffleDeck(
    recyclable,
    seed !== undefined ? seed + state.turnCount * 17 : undefined,
  );

  return {
    ...state,
    drawPile: shuffled,
    discardPile: [topCard],
  };
}

function drawCardsForPlayer(
  initialState: GameState,
  targetIndex: number,
  count: number,
  seed?: number,
): { state: GameState; drawnCards: CardData[]; hitBanana: boolean } {
  let state = initialState;
  const drawnCards: CardData[] = [];
  let hitBanana = false;
  let remaining = count;
  let step = 0;

  while (remaining > 0) {
    remaining -= 1;
    step += 1;
    state = reshuffleIfNeeded(
      state,
      seed !== undefined ? seed + step * 31 : undefined,
    );
    if (state.drawPile.length === 0) {
      break;
    }

    const [rawCard, ...restDraw] = state.drawPile;
    const isTrappedBanana = Boolean(rawCard.trapped);
    const cleanCard: CardData = isTrappedBanana
      ? { ...rawCard, trapped: false }
      : rawCard;

    const target = state.players[targetIndex];
    const nextHand = [...target.hand, cleanCard];
    let nextPlayers = updatePlayerAt(state.players, targetIndex, {
      hand: nextHand,
      calledPaws: nextHand.length <= 1 ? target.calledPaws : false,
    });

    let nextLogs = state.logs;
    let nextBanner = state.lastEffectBanner;

    if (isTrappedBanana) {
      hitBanana = true;
      remaining += 3;
      nextPlayers = updatePlayerAt(nextPlayers, targetIndex, {
        emotion: 'shock',
      });
      nextLogs = appendLog(
        nextLogs,
        state.turnCount,
        `🍌 ${target.name} trượt Vỏ Chuối! Rút thêm 3 lá phạt!`,
        'penalty',
      );
      nextBanner = `🍌 ${target.name} dính Vỏ Chuối (+3 lá)!`;
    }

    state = {
      ...state,
      drawPile: restDraw,
      players: nextPlayers,
      logs: nextLogs,
      lastEffectBanner: nextBanner,
    };
    drawnCards.push(cleanCard);
  }

  return { state, drawnCards, hitBanana };
}

function tickActiveBomb(state: GameState, seed?: number): GameState {
  if (!state.activeBomb || state.winnerId !== null) {
    return state;
  }

  const nextFuse = state.activeBomb.fuse - 1;
  if (nextFuse > 0) {
    return {
      ...state,
      activeBomb: { ...state.activeBomb, fuse: nextFuse },
    };
  }

  // Bomb explodes on the player whose turn it just landed on!
  const victimIdx = state.currentIndex;
  const victim = state.players[victimIdx];
  const { state: afterDraw } = drawCardsForPlayer(state, victimIdx, 4, seed);
  const nextPlayers = updatePlayerAt(afterDraw.players, victimIdx, {
    emotion: 'shock',
  });

  return {
    ...afterDraw,
    players: nextPlayers,
    activeBomb: null,
    logs: appendLog(
      afterDraw.logs,
      afterDraw.turnCount,
      `💣 Bom Kẹo phát nổ ngay trước mặt ${victim.name}! Rút +4 lá!`,
      'penalty',
    ),
    lastEffectBanner: `💣 BÙM! ${victim.name} rút +4 lá!`,
  };
}

function resolveCardEffect(
  state: GameState,
  playerIndex: number,
  effectType: CardData['type'],
  cardColor: Color | undefined,
  options: PlayOptions | undefined,
  rng: () => number,
): { state: GameState; skipBombTick: boolean } {
  const player = state.players[playerIndex];
  const playerCount = state.players.length;
  const chosenColor: Color =
    options?.chosenColor ?? cardColor ?? state.currentColor;

  if (effectType === 'freeze') {
    const skippedIdx = getNextIndex(playerIndex, state.direction, playerCount, 0);
    const skippedPlayer = state.players[skippedIdx];
    const nextIdx = getNextIndex(playerIndex, state.direction, playerCount, 1);
    const nextPlayers = updatePlayerAt(state.players, skippedIdx, {
      emotion: 'sad',
    });

    return {
      state: {
        ...state,
        players: nextPlayers,
        currentColor: cardColor ?? state.currentColor,
        currentIndex: nextIdx,
        logs: appendLog(
          state.logs,
          state.turnCount,
          `❄️ ${player.name} đóng băng ${skippedPlayer.name} bằng Kem Đá!`,
          'effect',
        ),
        lastEffectBanner: `❄️ ${skippedPlayer.name} bị đóng băng mất lượt!`,
      },
      skipBombTick: false,
    };
  }

  if (effectType === 'boomerang') {
    if (playerCount === 2) {
      // With 2 players, Boomerang acts as skip (turn stays with current player)
      const otherIdx = getNextIndex(playerIndex, state.direction, playerCount, 0);
      const nextPlayers = updatePlayerAt(state.players, otherIdx, {
        emotion: 'sad',
      });
      return {
        state: {
          ...state,
          players: nextPlayers,
          currentColor: cardColor ?? state.currentColor,
          currentIndex: playerIndex,
          logs: appendLog(
            state.logs,
            state.turnCount,
            `🪃 ${player.name} ném Vòng Xoay! (2 người: được đánh tiếp!)`,
            'effect',
          ),
          lastEffectBanner: `🪃 Vòng Xoay! ${player.name} đi tiếp!`,
        },
        skipBombTick: false,
      };
    }

    const nextDir = (state.direction * -1) as 1 | -1;
    const nextIdx = getNextIndex(playerIndex, nextDir, playerCount, 0);
    return {
      state: {
        ...state,
        direction: nextDir,
        currentColor: cardColor ?? state.currentColor,
        currentIndex: nextIdx,
        logs: appendLog(
          state.logs,
          state.turnCount,
          `🪃 ${player.name} đảo chiều bàn chơi với Vòng Xoay!`,
          'effect',
        ),
        lastEffectBanner: `🪃 Đảo chiều lượt chơi!`,
      },
      skipBombTick: false,
    };
  }

  if (effectType === 'shovel') {
    const stackedCount = (state.pending?.count ?? 0) + 2;
    const nextIdx = getNextIndex(playerIndex, state.direction, playerCount, 0);
    return {
      state: {
        ...state,
        currentColor: cardColor ?? state.currentColor,
        pending: { kind: 'draw', count: stackedCount, source: 'shovel' },
        currentIndex: nextIdx,
        logs: appendLog(
          state.logs,
          state.turnCount,
          `⛏️ ${player.name} đánh Xẻng Tuyết! Cộng dồn phạt +${stackedCount} lá!`,
          'effect',
        ),
        lastEffectBanner: `⛏️ Phạt cộng dồn +${stackedCount} lá!`,
      },
      skipBombTick: false,
    };
  }

  if (effectType === 'taser') {
    const targetIdx = getNextIndex(playerIndex, state.direction, playerCount, 0);
    const target = state.players[targetIdx];
    let nextState: GameState = {
      ...state,
      currentColor: chosenColor,
    };

    let drawnCount = 0;
    const maxSafeDraws =
      nextState.drawPile.length + Math.max(0, nextState.discardPile.length - 1) + 4;

    while (drawnCount < maxSafeDraws) {
      const res = drawCardsForPlayer(
        nextState,
        targetIdx,
        1,
        options?.seed !== undefined ? options.seed + drawnCount * 13 : undefined,
      );
      nextState = res.state;
      if (res.drawnCards.length === 0) break;
      drawnCount += res.drawnCards.length;
      const firstDrawn = res.drawnCards[0];
      if (firstDrawn.color === chosenColor || isWildCard(firstDrawn.type)) {
        break;
      }
    }

    const nextPlayers = updatePlayerAt(nextState.players, targetIdx, {
      emotion: 'shock',
    });
    const nextIdx = getNextIndex(playerIndex, nextState.direction, playerCount, 1);

    return {
      state: {
        ...nextState,
        players: nextPlayers,
        currentIndex: nextIdx,
        logs: appendLog(
          nextState.logs,
          nextState.turnCount,
          `⚡ ${player.name} giật Tia Chớp màu ${COLOR_VI[chosenColor]}! ${target.name} phải rút ${drawnCount} lá và mất lượt!`,
          'penalty',
        ),
        lastEffectBanner: `⚡ Tia Chớp (${COLOR_VI[chosenColor]})! ${target.name} rút ${drawnCount} lá!`,
      },
      skipBombTick: false,
    };
  }

  if (effectType === 'banana') {
    const nextIdx = getNextIndex(playerIndex, state.direction, playerCount, 0);
    return {
      state: {
        ...state,
        currentColor: chosenColor,
        currentIndex: nextIdx,
        logs: appendLog(
          state.logs,
          state.turnCount,
          `🍌 ${player.name} giấu Vỏ Chuối vào chồng rút & đổi sang màu ${COLOR_VI[chosenColor]}!`,
          'effect',
        ),
        lastEffectBanner: `🍌 Vỏ Chuối đã được giấu vào chồng rút!`,
      },
      skipBombTick: false,
    };
  }

  if (effectType === 'bomb') {
    const nextIdx = getNextIndex(playerIndex, state.direction, playerCount, 0);
    return {
      state: {
        ...state,
        currentColor: chosenColor,
        activeBomb: {
          fuse: playerCount,
          color: chosenColor,
          ownerId: player.id,
        },
        currentIndex: nextIdx,
        logs: appendLog(
          state.logs,
          state.turnCount,
          `💣 ${player.name} đặt Bom Kẹo (nổ sau ${playerCount} lượt) & chọn màu ${COLOR_VI[chosenColor]}!`,
          'effect',
        ),
        lastEffectBanner: `💣 Bom Kẹo đang đếm ngược (${playerCount} lượt)!`,
      },
      skipBombTick: true,
    };
  }

  if (effectType === 'crossbow') {
    let targetIdx = state.players.findIndex(
      (p) => p.id === options?.targetPlayerId && p.id !== player.id,
    );
    if (targetIdx === -1) {
      targetIdx = getNextIndex(playerIndex, state.direction, playerCount, 0);
    }
    const target = state.players[targetIdx];
    const { state: afterGift } = drawCardsForPlayer(
      state,
      targetIdx,
      1,
      options?.seed,
    );
    const nextPlayers = updatePlayerAt(afterGift.players, targetIdx, {
      emotion: 'sad',
    });
    const nextIdx = getNextIndex(playerIndex, afterGift.direction, playerCount, 0);

    return {
      state: {
        ...afterGift,
        players: nextPlayers,
        currentColor: cardColor ?? afterGift.currentColor,
        currentIndex: nextIdx,
        logs: appendLog(
          afterGift.logs,
          afterGift.turnCount,
          `🏹 ${player.name} bắn Nỏ Thần! Tặng ${target.name} 1 lá bài!`,
          'effect',
        ),
        lastEffectBanner: `🏹 Nỏ Thần bắn trúng ${target.name} (+1 lá)!`,
      },
      skipBombTick: false,
    };
  }

  if (effectType === 'potion') {
    const nextIdx = getNextIndex(playerIndex, state.direction, playerCount, 0);
    const deflected = state.pending?.kind === 'draw';
    return {
      state: {
        ...state,
        currentColor: chosenColor,
        pending: deflected ? state.pending : null,
        currentIndex: nextIdx,
        logs: appendLog(
          state.logs,
          state.turnCount,
          deflected
            ? `🧪 ${player.name} uống Thuốc Tàng Hình! Chuyển phạt +${state.pending?.count} lá sang người kế!`
            : `🧪 ${player.name} dùng Thuốc Tàng Hình đổi sang màu ${COLOR_VI[chosenColor]}!`,
          'effect',
        ),
        lastEffectBanner: deflected
          ? `🧪 Phản đòn! Chuyển +${state.pending?.count} lá sang người kế!`
          : `🧪 Đổi màu sang ${COLOR_VI[chosenColor]}!`,
      },
      skipBombTick: false,
    };
  }

  if (effectType === 'egg') {
    const outcomes: Array<'freeze' | 'boomerang' | 'shovel' | 'taser' | 'basic'> = [
      'freeze',
      'boomerang',
      'shovel',
      'taser',
      'basic',
    ];
    const picked = outcomes[Math.floor(rng() * outcomes.length)];

    if (picked === 'basic') {
      const nextIdx = getNextIndex(playerIndex, state.direction, playerCount, 0);
      return {
        state: {
          ...state,
          currentColor: chosenColor,
          currentIndex: nextIdx,
          logs: appendLog(
            state.logs,
            state.turnCount,
            `🥚 ${player.name} đập Trứng Bất Ngờ → nở ra Lá Thường màu ${COLOR_VI[chosenColor]}!`,
            'effect',
          ),
          lastEffectBanner: `🥚 Trứng Bất Ngờ → Đổi màu ${COLOR_VI[chosenColor]}!`,
        },
        skipBombTick: false,
      };
    }

    const withEggLog: GameState = {
      ...state,
      currentColor: chosenColor,
      logs: appendLog(
        state.logs,
        state.turnCount,
        `🥚 ${player.name} đập Trứng Bất Ngờ → nở ra hiệu ứng ${picked.toUpperCase()}!`,
        'effect',
      ),
    };
    return resolveCardEffect(
      withEggLog,
      playerIndex,
      picked,
      chosenColor,
      { ...options, chosenColor },
      rng,
    );
  }

  // basic & arrow
  const nextIdx = getNextIndex(playerIndex, state.direction, playerCount, 0);
  return {
    state: {
      ...state,
      currentColor: cardColor ?? state.currentColor,
      currentIndex: nextIdx,
      logs: appendLog(
        state.logs,
        state.turnCount,
        `${player.name} đánh lá ${effectType === 'arrow' ? 'Mũi Tên' : `số ${state.discardPile[state.discardPile.length - 1]?.value ?? ''}`} (${COLOR_VI[cardColor ?? state.currentColor]}).`,
        'play',
      ),
      lastEffectBanner: null,
    },
    skipBombTick: false,
  };
}

export function playCard(
  state: GameState,
  playerId: string,
  cardId: string,
  options?: PlayOptions,
): GameState {
  if (state.winnerId !== null) return state;

  const currentPlayer = state.players[state.currentIndex];
  if (!currentPlayer || currentPlayer.id !== playerId) return state;

  const cardIdx = currentPlayer.hand.findIndex((c) => c.id === cardId);
  if (cardIdx === -1) return state;

  const card = currentPlayer.hand[cardIdx];
  if (!isPlayable(card, state)) return state;

  const rng = createSeededRng(
    options?.seed !== undefined ? options.seed + state.turnCount * 23 : undefined,
  );

  // Remove card from hand
  const remainingHand = [
    ...currentPlayer.hand.slice(0, cardIdx),
    ...currentPlayer.hand.slice(cardIdx + 1),
  ];

  // Reset other players' transient emotions softly to idle; acting player feels happy
  const updatedPlayers: Player[] = state.players.map((p, idx) => {
    if (idx === state.currentIndex) {
      return {
        ...p,
        hand: remainingHand,
        emotion: (remainingHand.length === 0 ? 'win' : 'happy') as Emotion,
        calledPaws: remainingHand.length <= 1 ? p.calledPaws : false,
      };
    }
    return {
      ...p,
      emotion: 'idle' as Emotion,
      quip: null,
    };
  });

  // Strict card conservation: Banana goes into drawPile (trapped), all others go into discardPile
  let nextDrawPile = state.drawPile;
  let nextDiscardPile = state.discardPile;

  if (card.type === 'banana') {
    const trappedCard: CardData = { ...card, trapped: true };
    const insertAt = Math.floor(rng() * (nextDrawPile.length + 1));
    nextDrawPile = [
      ...nextDrawPile.slice(0, insertAt),
      trappedCard,
      ...nextDrawPile.slice(insertAt),
    ];
  } else {
    const cleanDiscard: CardData = card.trapped ? { ...card, trapped: false } : card;
    nextDiscardPile = [...nextDiscardPile, cleanDiscard];
  }

  const nextTurnCount = state.turnCount + 1;
  const resolvedColor: Color =
    options?.chosenColor ?? card.color ?? state.currentColor;

  const baseNext: GameState = {
    ...state,
    players: updatedPlayers,
    drawPile: nextDrawPile,
    discardPile: nextDiscardPile,
    currentColor: resolvedColor,
    turnCount: nextTurnCount,
  };

  // Immediate win check (even on action cards like Freeze / Shovel)
  if (remainingHand.length === 0) {
    const winPlayers: Player[] = baseNext.players.map((p) => ({
      ...p,
      emotion: (p.id === playerId ? 'win' : 'sad') as Emotion,
    }));
    return {
      ...baseNext,
      players: winPlayers,
      winnerId: playerId,
      pending: null,
      activeBomb: null,
      logs: appendLog(
        baseNext.logs,
        nextTurnCount,
        `🏆 ${currentPlayer.name} đã hết bài và CHIẾN THẮNG!`,
        'win',
      ),
      lastEffectBanner: `🏆 ${currentPlayer.name} chiến thắng!`,
    };
  }

  const { state: afterEffect, skipBombTick } = resolveCardEffect(
    baseNext,
    state.currentIndex,
    card.type,
    card.color,
    options,
    rng,
  );

  return skipBombTick ? afterEffect : tickActiveBomb(afterEffect, options?.seed);
}

export function drawTurnAction(
  state: GameState,
  playerId: string,
  seed?: number,
): GameState {
  if (state.winnerId !== null) return state;

  const currentPlayer = state.players[state.currentIndex];
  if (!currentPlayer || currentPlayer.id !== playerId) return state;

  const nextTurnCount = state.turnCount + 1;
  const resetPlayers: Player[] = state.players.map((p, idx) =>
    idx === state.currentIndex ? p : { ...p, emotion: 'idle' as Emotion, quip: null },
  );

  const workingState: GameState = {
    ...state,
    players: resetPlayers,
    turnCount: nextTurnCount,
  };

  if (workingState.pending?.kind === 'draw') {
    const penaltyCount = workingState.pending.count;
    const {
      state: afterPenalty,
      drawnCards,
      hitBanana,
    } = drawCardsForPlayer(
      workingState,
      state.currentIndex,
      penaltyCount,
      seed,
    );
    const totalDrawn = drawnCards.length;
    const bananaExtra = Math.max(0, totalDrawn - penaltyCount);
    const nextIdx = getNextIndex(
      state.currentIndex,
      afterPenalty.direction,
      afterPenalty.players.length,
      0,
    );
    const nextPlayers = updatePlayerAt(afterPenalty.players, state.currentIndex, {
      emotion: hitBanana ? 'shock' : 'sad',
    });

    const summaryText = hitBanana
      ? `📥 ${currentPlayer.name} rút ${penaltyCount} (Xẻng) + ${bananaExtra} (🍌 Vỏ Chuối) = ${totalDrawn} lá!`
      : `📥 ${currentPlayer.name} chịu phạt và rút ${totalDrawn} lá bài!`;

    const settled: GameState = {
      ...afterPenalty,
      players: nextPlayers,
      pending: null,
      currentIndex: nextIdx,
      logs: appendLog(afterPenalty.logs, nextTurnCount, summaryText, 'penalty'),
      lastEffectBanner: summaryText,
    };

    return tickActiveBomb(settled, seed);
  }

  // Standard 1-card draw and pass turn
  const {
    state: afterDraw,
    drawnCards: normalDrawn,
    hitBanana,
  } = drawCardsForPlayer(
    workingState,
    state.currentIndex,
    1,
    seed,
  );
  const nextIdx = getNextIndex(
    state.currentIndex,
    afterDraw.direction,
    afterDraw.players.length,
    0,
  );

  const normalTotal = normalDrawn.length;
  const normalSummary = hitBanana
    ? `📥 ${currentPlayer.name} rút 1 + ${Math.max(0, normalTotal - 1)} (🍌 Vỏ Chuối) = ${normalTotal} lá!`
    : `${currentPlayer.name} rút 1 lá bài và qua lượt.`;

  const settled: GameState = {
    ...afterDraw,
    currentIndex: nextIdx,
    logs: hitBanana
      ? afterDraw.logs
      : appendLog(afterDraw.logs, nextTurnCount, normalSummary, 'draw'),
    lastEffectBanner: hitBanana ? normalSummary : null,
  };

  return tickActiveBomb(settled, seed);
}

export function callPaws(state: GameState, playerId: string): GameState {
  if (state.winnerId !== null) return state;

  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return state;

  const player = state.players[idx];
  if (player.hand.length > 2 || player.calledPaws) {
    return state;
  }

  const nextPlayers = updatePlayerAt(state.players, idx, {
    calledPaws: true,
    emotion: 'happy',
    quip: 'PAWS!! 🐾',
  });

  return {
    ...state,
    players: nextPlayers,
    logs: appendLog(
      state.logs,
      state.turnCount,
      `🐾 ${player.name} hô vang PAWS!`,
      'effect',
    ),
    lastEffectBanner: `🐾 ${player.name} hô PAWS!`,
  };
}

export function catchMissedPaws(
  state: GameState,
  targetPlayerId: string,
  catcherName = 'Đối thủ',
  seed?: number,
): GameState {
  if (state.winnerId !== null) return state;

  const targetIdx = state.players.findIndex((p) => p.id === targetPlayerId);
  if (targetIdx === -1) return state;

  const target = state.players[targetIdx];
  if (target.hand.length !== 1 || target.calledPaws) {
    return state;
  }

  const { state: afterPenalty } = drawCardsForPlayer(state, targetIdx, 2, seed);
  const nextPlayers = updatePlayerAt(afterPenalty.players, targetIdx, {
    emotion: 'shock',
    quip: 'Quên hô PAWS rồi!! 😱',
  });

  return {
    ...afterPenalty,
    players: nextPlayers,
    logs: appendLog(
      afterPenalty.logs,
      afterPenalty.turnCount,
      `🚨 ${catcherName} bắt lỗi ${target.name} quên hô PAWS! Phạt rút +2 lá!`,
      'penalty',
    ),
    lastEffectBanner: `🚨 ${catcherName} bắt lỗi ${target.name} quên hô PAWS! (+2 lá)`,
  };
}
