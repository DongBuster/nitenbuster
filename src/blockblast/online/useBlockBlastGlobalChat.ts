import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AnimalId } from '../../engine/types.ts';
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '../../online/supabaseClient.ts';
import type { AvatarFrameId } from '../engine/avatarFrames.ts';
import {
  BB_GLOBAL_CHAT_CHANNEL,
  appendChatMessage,
  canSendChatAt,
  parseIncomingChatMessage,
  sanitizeChatDisplayName,
  sanitizeChatText,
  type BbChatMessage,
} from './chat.ts';

const GLOBAL_CHAT_PEER_KEY = 'paws_bb_global_chat_peer_v1';

function getOrCreateGlobalPeerId(): string {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const existing = window.sessionStorage.getItem(GLOBAL_CHAT_PEER_KEY);
      if (existing && existing.trim().length > 0) return existing;
      const generated = `bbg-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(GLOBAL_CHAT_PEER_KEY, generated);
      return generated;
    } catch {
      // Fallback below
    }
  }
  return `bbg-${Math.random().toString(36).slice(2, 10)}`;
}

export interface GlobalChatSenderProfile {
  name: string;
  animal: AnimalId;
  avatarFrame: AvatarFrameId | null;
}

export interface GlobalChatController {
  configured: boolean;
  connected: boolean;
  myPeerId: string;
  messages: readonly BbChatMessage[];
  rateLimited: boolean;
  sendMessage: (rawText: string) => boolean;
}

/**
 * Connects to the shared Supabase Realtime broadcast channel `bb-global-chat`
 * so Solo and Lobby Block Blast players can chat online without a DB table.
 */
export function useBlockBlastGlobalChat(
  sender: GlobalChatSenderProfile,
  enabled = true,
): GlobalChatController {
  const configured = isSupabaseConfigured();
  const [myPeerId] = useState<string>(() => getOrCreateGlobalPeerId());
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<BbChatMessage[]>([]);
  const [rateLimited, setRateLimited] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const senderRef = useRef<GlobalChatSenderProfile>(sender);
  senderRef.current = sender;

  useEffect(() => {
    if (!configured || !enabled) {
      setConnected(false);
      return;
    }
    const client = getSupabaseClient();
    if (!client) {
      setConnected(false);
      return;
    }

    const channel = client.channel(BB_GLOBAL_CHAT_CHANNEL, {
      config: {
        broadcast: { self: false },
      },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'bb_chat' }, ({ payload }) => {
        const parsed = parseIncomingChatMessage(payload, 'global');
        if (!parsed) return;
        setMessages((prev) => appendChatMessage(prev, parsed));
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      channelRef.current = null;
      setConnected(false);
      void client.removeChannel(channel);
    };
  }, [configured, enabled]);

  const sendMessage = useCallback(
    (rawText: string): boolean => {
      const text = sanitizeChatText(rawText);
      if (!text) return false;
      const now = Date.now();
      if (!canSendChatAt(lastSentAtRef.current, now)) {
        setRateLimited(true);
        window.setTimeout(() => setRateLimited(false), 1200);
        return false;
      }

      lastSentAtRef.current = now;
      setRateLimited(false);
      const profile = senderRef.current;
      const msg: BbChatMessage = {
        id: `${myPeerId}-${now}-${Math.random().toString(36).slice(2, 6)}`,
        peerId: myPeerId,
        name: sanitizeChatDisplayName(profile.name),
        animal: profile.animal,
        avatarFrame: profile.avatarFrame,
        text,
        at: now,
        channel: 'global',
      };

      setMessages((prev) => appendChatMessage(prev, msg));
      const channel = channelRef.current;
      if (channel) {
        void channel.send({
          type: 'broadcast',
          event: 'bb_chat',
          payload: msg,
        });
      }
      return true;
    },
    [myPeerId],
  );

  return {
    configured,
    connected,
    myPeerId,
    messages,
    rateLimited,
    sendMessage,
  };
}
