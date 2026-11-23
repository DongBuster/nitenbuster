import type {
  AnimalId,
  BotDifficulty,
  CardData,
  GameDeckMode,
  GameState,
  Player,
  PlayOptions,
} from '../engine/types.ts';

export type RoomPhase = 'idle' | 'lobby' | 'playing';

export interface RoomSettings {
  maxPlayers: number;
  fillWithBots: boolean;
  difficulty: BotDifficulty;
  deckMode: GameDeckMode;
  turnTimeSec: number;
}

export interface LobbyPresenceMember {
  peerId: string;
  name: string;
  animal: AnimalId;
  accessory: string | null;
  isHost: boolean;
  ready: boolean;
  joinedAt: number;
}

export type PublicPlayer = Omit<Player, 'hand'> & {
  handCount: number;
};

export type PublicGameState = Omit<GameState, 'players' | 'drawPile'> & {
  players: PublicPlayer[];
  drawPileCount: number;
};

export interface GameSnapshotEvent {
  seq: number;
  hostId: string;
  publicState: PublicGameState;
  turnDeadlineMs: number;
  accessories: Partial<Record<AnimalId, string | null>>;
}

export interface HandSyncEvent {
  seq: number;
  targetPeerId: string;
  hand: CardData[];
}

export interface PlayerActionEvent {
  peerId: string;
  turnCount: number;
  action: 'play' | 'draw' | 'call_paws' | 'catch_paws';
  cardId?: string;
  options?: PlayOptions;
  targetPlayerId?: string;
}

export interface EmoteEvent {
  peerId: string;
  emote: string;
  text: string;
  at: number;
}

export interface RoomConfigEvent {
  hostId: string;
  settings: RoomSettings;
}

export const ONLINE_EMOTES = [
  { emote: '😂', text: 'Ha ha!' },
  { emote: '😱', text: 'Ối giời ơi!' },
  { emote: '🔥', text: 'Căng quá!' },
  { emote: '👏', text: 'Hay quá!' },
  { emote: '🐾', text: 'PAWS!' },
] as const;
