import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Globe, MessageCircle, Send, Users, Wifi, WifiOff, X } from 'lucide-react';
import { playSfx } from '../../audio/soundEngine.ts';
import { AnimalAvatar } from '../../components/AnimalAvatar.tsx';
import {
  BB_CHAT_MAX_LENGTH,
  BB_QUICK_CHAT_PRESETS,
  type BbChatChannel,
  type BbChatMessage,
} from '../online/chat.ts';

export interface ChatChannelFeed {
  configured: boolean;
  connected: boolean;
  myPeerId: string;
  messages: readonly BbChatMessage[];
  rateLimited?: boolean;
  onSend: (text: string) => boolean;
}

export interface BlockBlastChatPanelProps {
  /** Room-scoped chat feed when inside an online room; omitted in Solo mode. */
  roomFeed?: ChatChannelFeed | null;
  /** Global Block Blast lobby chat feed available for both Solo and Room players. */
  globalFeed: ChatChannelFeed;
  /** 'embedded' renders inline (Lobby/Spectator); 'drawer' renders a compact floating button + overlay drawer. */
  mode?: 'embedded' | 'drawer';
  roomCode?: string;
  className?: string;
}

const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';

function formatShortTime(ts: number): string {
  const date = new Date(ts);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Shared Realtime Online Chat panel supporting Room Chat + Global Chat tabs,
 * quick-reply chips, spam throttling feedback, and sender Avatar Frames.
 */
export function BlockBlastChatPanel({
  roomFeed = null,
  globalFeed,
  mode = 'embedded',
  roomCode,
  className = '',
}: BlockBlastChatPanelProps) {
  const [activeTab, setActiveTab] = useState<BbChatChannel>(
    roomFeed ? 'room' : 'global',
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const prevTotalRef = useRef<number>(
    (roomFeed?.messages.length ?? 0) + globalFeed.messages.length,
  );

  // Switch away from room tab cleanly if user leaves room
  useEffect(() => {
    if (!roomFeed && activeTab === 'room') {
      setActiveTab('global');
    }
  }, [activeTab, roomFeed]);

  const activeFeed =
    activeTab === 'room' && roomFeed ? roomFeed : globalFeed;

  // Track unread count while drawer is closed
  useEffect(() => {
    const total = (roomFeed?.messages.length ?? 0) + globalFeed.messages.length;
    if (mode === 'drawer' && !drawerOpen && total > prevTotalRef.current) {
      setUnreadCount((c) => Math.min(99, c + (total - prevTotalRef.current)));
    }
    prevTotalRef.current = total;
  }, [drawerOpen, globalFeed.messages.length, mode, roomFeed?.messages.length]);

  useEffect(() => {
    if (drawerOpen) {
      setUnreadCount(0);
    }
  }, [drawerOpen]);

  // Auto-scroll to latest message when panel is visible
  useEffect(() => {
    if (mode === 'drawer' && !drawerOpen) return;
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [activeFeed.messages.length, activeTab, drawerOpen, mode]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    if (activeFeed.onSend(draft)) {
      playSfx('click');
      setDraft('');
    }
  };

  const handleQuickSend = (preset: string) => {
    if (activeFeed.onSend(preset)) {
      playSfx('click');
    }
  };

  const panelBody = (
    <div
      className={`flex flex-col rounded-2xl border border-amber-500/30 bg-[#22130c]/95 text-[#FFF9F0] shadow-xl sm:rounded-3xl ${
        mode === 'drawer' ? 'h-[min(72dvh,460px)] w-[min(92vw,360px)]' : 'h-[310px] w-full'
      } ${className}`}
    >
      {/* Header + Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-amber-900/50 px-3 py-2">
        <div className="flex items-center gap-1.5">
          {roomFeed ? (
            <div className="inline-flex rounded-xl border border-amber-900/60 bg-[#160c07] p-0.5 text-[11px] font-black">
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  setActiveTab('room');
                }}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 transition-colors ${FOCUS_RING_CLASS} ${
                  activeTab === 'room'
                    ? 'bg-emerald-500/25 text-emerald-100'
                    : 'text-amber-200/65 hover:text-amber-100'
                }`}
              >
                <Users aria-hidden="true" className="h-3 w-3" />
                <span>{roomCode ? `Phòng ${roomCode}` : 'Phòng'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  setActiveTab('global');
                }}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 transition-colors ${FOCUS_RING_CLASS} ${
                  activeTab === 'global'
                    ? 'bg-sky-500/25 text-sky-100'
                    : 'text-amber-200/65 hover:text-amber-100'
                }`}
              >
                <Globe aria-hidden="true" className="h-3 w-3" />
                <span>Sảnh Chung</span>
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-sky-200">
              <Globe aria-hidden="true" className="h-3.5 w-3.5 text-sky-400" />
              <span>Chat Sảnh Chung</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
              !activeFeed.configured
                ? 'bg-amber-950 text-amber-300/80'
                : activeFeed.connected
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'bg-slate-700/40 text-slate-300'
            }`}
          >
            {activeFeed.connected ? (
              <Wifi aria-hidden="true" className="h-2.5 w-2.5" />
            ) : (
              <WifiOff aria-hidden="true" className="h-2.5 w-2.5" />
            )}
            <span>
              {!activeFeed.configured
                ? 'Offline'
                : activeFeed.connected
                  ? 'Online'
                  : 'Đang nối'}
            </span>
          </span>

          {mode === 'drawer' && (
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                setDrawerOpen(false);
              }}
              aria-label="Đóng khung chat"
              className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-amber-800/60 bg-[#170d08] text-amber-200 hover:border-amber-400/60 ${FOCUS_RING_CLASS}`}
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div
        ref={listRef}
        aria-live="polite"
        className="flex-1 space-y-2 overflow-y-auto px-3 py-2.5"
      >
        {!activeFeed.configured ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-xs text-amber-200/70">
            <p className="font-bold text-amber-100">Chat Online cần cấu hình Supabase</p>
            <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed">
              Thêm <code className="rounded bg-white/10 px-1">VITE_SUPABASE_URL</code> và{' '}
              <code className="rounded bg-white/10 px-1">VITE_SUPABASE_ANON_KEY</code> để bật chat thời gian thực.
            </p>
          </div>
        ) : activeFeed.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-xs text-amber-200/60">
            <MessageCircle aria-hidden="true" className="mb-1.5 h-6 w-6 opacity-45" />
            <p className="font-bold">Chưa có tin nhắn nào</p>
            <p className="mt-0.5 text-[11px]">Gửi lời chào hoặc chọn câu chat nhanh bên dưới!</p>
          </div>
        ) : (
          activeFeed.messages.map((msg) => {
            const isSelf = msg.peerId === activeFeed.myPeerId;
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2 ${isSelf ? 'flex-row-reverse' : ''}`}
              >
                <div className="pt-0.5">
                  <AnimalAvatar
                    animal={msg.animal}
                    size="sm"
                    frameId={msg.avatarFrame}
                  />
                </div>
                <div
                  className={`max-w-[78%] rounded-2xl border px-2.5 py-1.5 ${
                    isSelf
                      ? 'border-amber-400/40 bg-amber-500/20 text-amber-50'
                      : 'border-white/10 bg-[#170d08] text-amber-50'
                  }`}
                >
                  <div
                    className={`flex items-center gap-1.5 text-[10px] font-black ${
                      isSelf ? 'justify-end text-amber-200' : 'text-sky-200'
                    }`}
                  >
                    <span className="truncate max-w-[130px]">{msg.name}</span>
                    <span className="font-semibold text-white/40 tabular-nums">
                      {formatShortTime(msg.at)}
                    </span>
                  </div>
                  <p className="mt-0.5 break-words text-xs leading-snug text-amber-50">
                    {msg.text}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Presets */}
      {activeFeed.configured && (
        <div className="flex gap-1 overflow-x-auto border-t border-amber-900/40 px-2.5 py-1.5">
          {BB_QUICK_CHAT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={!activeFeed.connected}
              onClick={() => handleQuickSend(preset)}
              className={`shrink-0 cursor-pointer rounded-full border border-amber-500/25 bg-[#170d08] px-2 py-0.5 text-[10px] font-bold text-amber-200 hover:border-amber-300/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING_CLASS}`}
            >
              {preset}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-1.5 border-t border-amber-900/50 p-2"
      >
        <input
          type="text"
          value={draft}
          maxLength={BB_CHAT_MAX_LENGTH}
          disabled={!activeFeed.configured || !activeFeed.connected}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            activeFeed.rateLimited
              ? 'Chờ 1 giây rồi nhắn tiếp...'
              : activeFeed.connected
                ? 'Nhắn tin online...'
                : 'Chưa kết nối chat...'
          }
          aria-label="Nhập tin nhắn chat online"
          className={`min-w-0 flex-1 rounded-xl border border-amber-900/60 bg-[#140b07] px-2.5 py-1.5 text-xs font-semibold text-amber-50 placeholder:text-amber-200/40 disabled:opacity-50 ${FOCUS_RING_CLASS}`}
        />
        <button
          type="submit"
          disabled={!activeFeed.configured || !activeFeed.connected || !draft.trim()}
          aria-label="Gửi tin nhắn"
          className={`inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-amber-400/55 bg-amber-500/25 text-amber-100 hover:bg-amber-500/35 disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING_CLASS}`}
        >
          <Send aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );

  if (mode === 'embedded') {
    return panelBody;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {drawerOpen && panelBody}
      <button
        type="button"
        onClick={() => {
          playSfx('click');
          setDrawerOpen((open) => !open);
        }}
        aria-expanded={drawerOpen}
        aria-label={drawerOpen ? 'Thu gọn Chat Online' : 'Mở Chat Online'}
        className={`relative inline-flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-amber-400/60 bg-[#26150d]/95 px-3.5 py-2 text-xs font-black text-amber-100 shadow-[0_10px_28px_rgba(0,0,0,0.55)] backdrop-blur-sm transition-transform hover:scale-105 ${FOCUS_RING_CLASS}`}
      >
        <MessageCircle aria-hidden="true" className="h-4 w-4 text-amber-300" />
        <span>Chat Online</span>
        {unreadCount > 0 && (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
