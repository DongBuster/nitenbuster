import type { AnimalId } from '../../engine/types.ts';
import type { AvatarFrameId } from '../engine/avatarFrames.ts';
import type { MatchReceipt } from '../engine/verify.ts';

export const BB_MAX_ROOM_PLAYERS = 8;
export const BB_MIN_START_PLAYERS = 2;
export const BB_DISCONNECT_GRACE_MS = 15000;
export const BB_COUNTDOWN_MS = 2600;
export const BB_PROGRESS_THROTTLE_MS = 350;

export const BB_ROOM_EMOTES = [
  { emote: '🔥', text: 'Căng quá!' },
  { emote: '👏', text: 'Hay quá!' },
  { emote: '😱', text: 'Sắp kẹt!' },
  { emote: '💪', text: 'Cố lên!' },
  { emote: '🐾', text: 'PAWS!' },
] as const;

export type BbRoomPhase = 'idle' | 'lobby' | 'countdown' | 'playing' | 'results';

export type BbPlayerStatus = 'playing' | 'finished' | 'disconnected';

export type BbVerificationStatus =
  | 'verified'
  | 'invalid'
  | 'pending'
  | 'disconnected';

export interface BbParticipantInfo {
  peerId: string;
  name: string;
  animal: AnimalId;
  accessory: string[];
  avatarFrame?: AvatarFrameId | null;
  joinedAt: number;
}

export interface BbRoomMember extends BbParticipantInfo {
  ready: boolean;
}

export interface BbPlayerProgress {
  matchId: string;
  peerId: string;
  seq: number;
  score: number;
  stage: number;
  allClears: number;
  streak: number;
  maxStreak: number;
  linesCleared: number;
  movesCount: number;
  compactGrid: string;
  status: BbPlayerStatus;
  updatedAt: number;
}

export interface BbMatchStartEvent {
  matchId: string;
  seed: number;
  roundNumber: number;
  hostId: string;
  countdownMs: number;
  rosterPeerIds: string[];
  rosterSnapshots: Record<string, BbParticipantInfo>;
}

export type BbProgressEvent = Omit<BbPlayerProgress, 'updatedAt'>;

export interface BbFinishEvent {
  matchId: string;
  peerId: string;
  receipt: MatchReceipt;
}

export interface BbEmoteEvent {
  peerId: string;
  name: string;
  emote: string;
  text: string;
  at: number;
}

export interface BbReturnLobbyEvent {
  hostId: string;
}

export interface BbSyncRequestEvent {
  requesterPeerId: string;
}

export interface BbRoomSyncEvent {
  targetPeerId: string;
  hostId: string;
  phase: Exclude<BbRoomPhase, 'idle' | 'lobby'>;
  matchId: string;
  seed: number;
  roundNumber: number;
  rosterPeerIds: string[];
  rosterSnapshots: Record<string, BbParticipantInfo>;
  progressByPeer: Record<string, BbPlayerProgress>;
  receiptsByPeer: Record<string, MatchReceipt>;
}

export interface BbRoomStanding {
  rank: number;
  peerId: string;
  name: string;
  animal: AnimalId;
  accessory: string[];
  avatarFrame: AvatarFrameId | null;
  joinedAt: number;
  status: BbPlayerStatus;
  verification: BbVerificationStatus;
  verificationReason?: string;
  score: number;
  stage: number;
  allClears: number;
  streak: number;
  maxStreak: number;
  linesCleared: number;
  movesCount: number;
  compactGrid: string;
}
