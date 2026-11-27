import { ANIMALS, type AnimalId } from '../../engine/types';
import {
  normalizeAccessories,
  type AccessorySelection,
} from '../../scene3d/accessoryCatalog';
import {
  BOT_ANIMAL_TITLES,
  ROUND_POINTS,
  TOTAL_ROUNDS,
} from './constants';
import type {
  BrawlDifficulty,
  FighterConfig,
  FighterScore,
  MatchState,
  RoundRankingEntry,
} from './types';

export type MatchAction =
  | {
      type: 'START_MATCH';
      humanAnimal: AnimalId;
      humanAccessory: AccessorySelection;
      botCount: number;
      difficulty: BrawlDifficulty;
    }
  | {
      type: 'START_ONLINE_MATCH';
      fighters: FighterConfig[];
      difficulty: BrawlDifficulty;
    }
  | { type: 'TICK_COUNTDOWN' }
  | { type: 'ELIMINATE_BATCH'; ids: string[] }
  | { type: 'ADVANCE_AFTER_ROUND' }
  | { type: 'RETURN_TO_SETUP' };

export function createSetupMatchState(
  difficulty: BrawlDifficulty = 'medium',
  botCount: number = 3,
): MatchState {
  return {
    phase: 'setup',
    round: 1,
    totalRounds: TOTAL_ROUNDS,
    countdownSec: 3,
    fighters: [],
    aliveIds: [],
    eliminationGroups: [],
    scores: {},
    lastRoundRankings: [],
    difficulty,
    botCount,
  };
}

function buildRoster(
  humanAnimal: AnimalId,
  humanAccessory: AccessorySelection,
  botCount: number,
): FighterConfig[] {
  const humanMeta = ANIMALS.find((a) => a.id === humanAnimal) ?? ANIMALS[0];
  const roster: FighterConfig[] = [
    {
      id: 'human',
      name: 'Bạn',
      animal: humanMeta.id,
      accessory: normalizeAccessories(humanAccessory),
      isBot: false,
      spawnIndex: 0,
      accentHex: humanMeta.accentHex,
    },
  ];

  const remainingAnimals = ANIMALS.filter((a) => a.id !== humanMeta.id);
  const clampedBots = Math.min(7, Math.max(3, botCount));

  for (let i = 0; i < clampedBots; i++) {
    const meta = remainingAnimals[i % remainingAnimals.length];
    const baseName = BOT_ANIMAL_TITLES[meta.id] ?? meta.name;
    const duplicateIdx = Math.floor(i / remainingAnimals.length);
    const name = duplicateIdx > 0 ? `${baseName} ${duplicateIdx + 1}` : baseName;

    roster.push({
      id: `bot_${i + 1}`,
      name,
      animal: meta.id,
      accessory: [],
      isBot: true,
      spawnIndex: i + 1,
      accentHex: meta.accentHex,
    });
  }

  return roster;
}

function finalizeRoundRankings(
  fighters: FighterConfig[],
  aliveIds: string[],
  eliminationGroups: string[][],
  scores: Record<string, FighterScore>,
): {
  nextScores: Record<string, FighterScore>;
  rankings: RoundRankingEntry[];
} {
  // Tiers from rank 1 down: alive survivors first, then reverse elimination order
  const tiers: string[][] = [];
  if (aliveIds.length > 0) {
    tiers.push([...aliveIds]);
  }
  for (let i = eliminationGroups.length - 1; i >= 0; i--) {
    if (eliminationGroups[i].length > 0) {
      tiers.push(eliminationGroups[i]);
    }
  }

  const nextScores: Record<string, FighterScore> = { ...scores };
  const rankings: RoundRankingEntry[] = [];
  let cursorRank = 1;

  for (const tier of tiers) {
    const rank = cursorRank;
    const pointsAwarded = ROUND_POINTS[rank - 1] ?? 0;

    for (const id of tier) {
      const fighter = fighters.find((f) => f.id === id);
      const prev = nextScores[id];
      if (!fighter || !prev) continue;

      const nextTotal = prev.points + pointsAwarded;
      nextScores[id] = {
        ...prev,
        points: nextTotal,
        firstPlaces: prev.firstPlaces + (rank === 1 ? 1 : 0),
        lastRoundRank: rank,
        roundPointsHistory: [...prev.roundPointsHistory, pointsAwarded],
      };

      rankings.push({
        id,
        name: fighter.name,
        animal: fighter.animal,
        isBot: fighter.isBot,
        rank,
        pointsAwarded,
        totalPoints: nextTotal,
      });
    }

    cursorRank += tier.length;
  }

  return { nextScores, rankings };
}

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case 'START_MATCH': {
      const fighters = buildRoster(
        action.humanAnimal,
        action.humanAccessory,
        action.botCount,
      );
      const scores: Record<string, FighterScore> = {};
      for (const f of fighters) {
        scores[f.id] = {
          id: f.id,
          name: f.name,
          animal: f.animal,
          isBot: f.isBot,
          points: 0,
          firstPlaces: 0,
          lastRoundRank: fighters.length,
          roundPointsHistory: [],
        };
      }

      return {
        phase: 'countdown',
        round: 1,
        totalRounds: TOTAL_ROUNDS,
        countdownSec: 3,
        fighters,
        aliveIds: fighters.map((f) => f.id),
        eliminationGroups: [],
        scores,
        lastRoundRankings: [],
        difficulty: action.difficulty,
        botCount: action.botCount,
      };
    }

    case 'START_ONLINE_MATCH': {
      const fighters = action.fighters;
      const scores: Record<string, FighterScore> = {};
      for (const f of fighters) {
        scores[f.id] = {
          id: f.id,
          name: f.name,
          animal: f.animal,
          isBot: f.isBot,
          points: 0,
          firstPlaces: 0,
          lastRoundRank: fighters.length,
          roundPointsHistory: [],
        };
      }
      const botCount = fighters.filter((f) => f.isBot).length;
      return {
        phase: 'countdown',
        round: 1,
        totalRounds: TOTAL_ROUNDS,
        countdownSec: 3,
        fighters,
        aliveIds: fighters.map((f) => f.id),
        eliminationGroups: [],
        scores,
        lastRoundRankings: [],
        difficulty: action.difficulty,
        botCount,
      };
    }

    case 'TICK_COUNTDOWN': {
      if (state.phase !== 'countdown') return state;
      const nextCount = state.countdownSec - 1;
      if (nextCount <= 0) {
        return {
          ...state,
          countdownSec: 0,
          phase: 'fighting',
        };
      }
      return {
        ...state,
        countdownSec: nextCount,
      };
    }

    case 'ELIMINATE_BATCH': {
      if (state.phase !== 'fighting') return state;
      const validIds = action.ids.filter((id) => state.aliveIds.includes(id));
      if (validIds.length === 0) return state;

      const eliminatedSet = new Set(validIds);
      const nextAlive = state.aliveIds.filter((id) => !eliminatedSet.has(id));
      const nextGroups = [...state.eliminationGroups, validIds];

      if (nextAlive.length <= 1) {
        const { nextScores, rankings } = finalizeRoundRankings(
          state.fighters,
          nextAlive,
          nextGroups,
          state.scores,
        );
        return {
          ...state,
          aliveIds: nextAlive,
          eliminationGroups: nextGroups,
          scores: nextScores,
          lastRoundRankings: rankings,
          phase: 'roundOver',
        };
      }

      return {
        ...state,
        aliveIds: nextAlive,
        eliminationGroups: nextGroups,
      };
    }

    case 'ADVANCE_AFTER_ROUND': {
      if (state.phase !== 'roundOver') return state;
      if (state.round >= state.totalRounds) {
        return {
          ...state,
          phase: 'matchOver',
        };
      }
      return {
        ...state,
        round: state.round + 1,
        countdownSec: 3,
        aliveIds: state.fighters.map((f) => f.id),
        eliminationGroups: [],
        phase: 'countdown',
      };
    }

    case 'RETURN_TO_SETUP':
      return {
        ...state,
        phase: 'setup',
      };
  }
}

export function getSortedStandings(
  scores: Record<string, FighterScore>,
): FighterScore[] {
  return Object.values(scores).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
    if (a.lastRoundRank !== b.lastRoundRank) return a.lastRoundRank - b.lastRoundRank;
    if (a.isBot !== b.isBot) return a.isBot ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

export function getHumanFinalRank(
  scores: Record<string, FighterScore>,
  localFighterId = 'human',
): number {
  const sorted = getSortedStandings(scores);
  const idx = sorted.findIndex((s) => s.id === localFighterId);
  return idx >= 0 ? idx + 1 : sorted.length;
}
