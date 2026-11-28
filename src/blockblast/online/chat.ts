import type { AnimalId } from '../../engine/types.ts';
import {
  isAvatarFrameId,
  type AvatarFrameId,
} from '../engine/avatarFrames.ts';

export const BB_CHAT_MAX_LENGTH = 120;
export const BB_CHAT_MAX_HISTORY = 60;
export const BB_CHAT_MIN_INTERVAL_MS = 1200;
export const BB_GLOBAL_CHAT_CHANNEL = 'bb-global-chat';

export type BbChatChannel = 'room' | 'global';

export interface BbChatMessage {
  readonly id: string;
  readonly peerId: string;
  readonly name: string;
  readonly animal: AnimalId;
  readonly avatarFrame: AvatarFrameId | null;
  readonly text: string;
  readonly at: number;
  readonly channel: BbChatChannel;
}

export const BB_QUICK_CHAT_PRESETS = [
  '🔥 Quá đỉnh!',
  '👏 GG mọi người!',
  '🎉 Lên Stage rồi!',
  '💪 Cố lên nào!',
  '😱 Suýt kẹt!',
] as const;

const VALID_ANIMALS = new Set<AnimalId>([
  'dog',
  'cat',
  'duck',
  'shark',
  'dino',
  'panda',
  'chicken',
  'bunny',
]);

/** Strips control characters, collapses excessive whitespace, and clamps chat text to 120 chars. */
export function sanitizeChatText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length === 0) return '';
  return cleaned.slice(0, BB_CHAT_MAX_LENGTH);
}

export function sanitizeChatDisplayName(raw: unknown): string {
  const cleaned = sanitizeChatText(raw).slice(0, 24);
  return cleaned.length > 0 ? cleaned : 'Người chơi';
}

export function canSendChatAt(
  lastSentAtMs: number,
  nowMs: number,
  minIntervalMs = BB_CHAT_MIN_INTERVAL_MS,
): boolean {
  if (!Number.isFinite(lastSentAtMs) || lastSentAtMs <= 0) return true;
  return nowMs - lastSentAtMs >= minIntervalMs;
}

/** Validates and normalizes an incoming Realtime broadcast chat payload. */
export function parseIncomingChatMessage(
  raw: unknown,
  fallbackChannel: BbChatChannel,
): BbChatMessage | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const text = sanitizeChatText(obj.text);
  if (!text) return null;
  const peerId =
    typeof obj.peerId === 'string' && obj.peerId.trim().length > 0
      ? obj.peerId.trim().slice(0, 48)
      : '';
  if (!peerId) return null;

  const at =
    typeof obj.at === 'number' && Number.isFinite(obj.at) && obj.at > 0
      ? Math.floor(obj.at)
      : Date.now();
  const id =
    typeof obj.id === 'string' && obj.id.trim().length > 0
      ? obj.id.trim().slice(0, 80)
      : `${peerId}-${at}`;
  const animal: AnimalId =
    typeof obj.animal === 'string' && VALID_ANIMALS.has(obj.animal as AnimalId)
      ? (obj.animal as AnimalId)
      : 'dog';
  const avatarFrame = isAvatarFrameId(obj.avatarFrame) ? obj.avatarFrame : null;
  const channel: BbChatChannel =
    obj.channel === 'room' || obj.channel === 'global'
      ? obj.channel
      : fallbackChannel;

  return {
    id,
    peerId,
    name: sanitizeChatDisplayName(obj.name),
    animal,
    avatarFrame,
    text,
    at,
    channel,
  };
}

/** Appends a chat message while deduplicating by id and capping history to BB_CHAT_MAX_HISTORY. */
export function appendChatMessage(
  history: readonly BbChatMessage[],
  incoming: BbChatMessage,
  maxItems = BB_CHAT_MAX_HISTORY,
): BbChatMessage[] {
  if (history.some((m) => m.id === incoming.id)) {
    return [...history];
  }
  const next = [...history, incoming];
  return next.length > maxItems ? next.slice(-maxItems) : next;
}
