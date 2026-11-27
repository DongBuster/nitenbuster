import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Link2,
  Play,
  Share2,
  Shuffle,
  Sparkles,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { playSfx } from '../../audio/soundEngine';
import { AnimalAvatar } from '../../components/AnimalAvatar';
import { ANIMALS, type AnimalId } from '../../engine/types';
import {
  buildRoomInviteUrl,
  canUseNativeShare,
  copyTextSafe,
  shareRoomInvite,
} from '../../online/inviteLink';
import { normalizeRoomCode } from '../../online/sanitize';
import { useProfileStore } from '../../store/profileStore';
import {
  ALL_EVENT_GAMES,
  EVENT_GAME_META,
  EVENT_MAX_PLAYERS,
  EVENT_MIN_PLAYERS,
  EVENT_TIME_LIMIT_BOUNDS,
  type EventGameId,
} from '../protocol';
import { formatSecondsClock } from '../scoring';
import type { EventRoomController } from '../useEventRoom';

export interface EventLobbyScreenProps {
  room: EventRoomController;
  initialRoomCode?: string;
  onBackToModeSelect: () => void;
}

const NAME_STORAGE_KEY = 'paws_online_player_name_v1';

function loadSavedName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function EventLobbyScreen({
  room,
  initialRoomCode = '',
  onBackToModeSelect,
}: EventLobbyScreenProps) {
  const { selectedAnimal, equippedAccessory, selectAnimal } = useProfileStore();
  const [playerName, setPlayerName] = useState<string>(
    () => loadSavedName() || 'Cao Thủ PAWS',
  );
  const [joinCode, setJoinCode] = useState<string>(() =>
    normalizeRoomCode(initialRoomCode),
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sharedStatus, setSharedStatus] = useState(false);
  const autoJoinedRef = useRef(false);

  const myMember = room.members.find((m) => m.peerId === room.myPeerId);
  const myAccessories = equippedAccessory[selectedAnimal] ?? [];
  const nativeShareSupported = canUseNativeShare();

  // One-click auto-join when arriving via ?eventRoom=<CODE> invite link
  useEffect(() => {
    const clean = normalizeRoomCode(initialRoomCode);
    if (
      autoJoinedRef.current ||
      clean.length < 4 ||
      !room.configured ||
      room.phase !== 'idle'
    ) {
      return;
    }
    autoJoinedRef.current = true;
    room.joinRoom(clean, {
      name: playerName.trim() || 'Người Chơi',
      animal: selectedAnimal,
      accessory: myAccessories,
    });
  }, [
    initialRoomCode,
    myAccessories,
    playerName,
    room,
    selectedAnimal,
  ]);

  useEffect(() => {
    if (typeof window !== 'undefined' && playerName.trim()) {
      try {
        window.localStorage.setItem(NAME_STORAGE_KEY, playerName.trim());
      } catch {
        // Ignore storage error
      }
    }
  }, [playerName]);

  const handleCreateRoom = () => {
    playSfx('click');
    room.createRoom({
      name: playerName.trim() || 'Chủ Phòng',
      animal: selectedAnimal,
      accessory: myAccessories,
    });
  };

  const handleJoinRoom = () => {
    playSfx('click');
    room.joinRoom(joinCode, {
      name: playerName.trim() || 'Người Chơi',
      animal: selectedAnimal,
      accessory: myAccessories,
    });
  };

  const handleSelectAnimal = (animal: AnimalId) => {
    playSfx('click');
    selectAnimal(animal);
    if (room.phase === 'lobby') {
      room.updateMyProfile({
        animal,
        accessory: equippedAccessory[animal] ?? [],
      });
    }
  };

  const handleCopyCode = async () => {
    if (!room.roomCode) return;
    playSfx('click');
    if (await copyTextSafe(room.roomCode)) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!room.roomCode) return;
    playSfx('click');
    const url = buildRoomInviteUrl('event', room.roomCode);
    if (await copyTextSafe(url)) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    }
  };

  const handleShareInvite = async () => {
    if (!room.roomCode) return;
    playSfx('click');
    const outcome = await shareRoomInvite({
      kind: 'event',
      roomCode: room.roomCode,
      title: 'PAWS Event Cup — Mời vào giải đấu',
      text: `Vào phòng PAWS Event Cup (${room.roomCode}) thi đấu liên hoàn 4 trò chơi với mình nhé!`,
    });
    if (outcome === 'shared' || outcome === 'copied') {
      setSharedStatus(true);
      setTimeout(() => setSharedStatus(false), 1800);
    }
  };

  const handleNameChange = (nextName: string) => {
    setPlayerName(nextName);
    if (room.phase === 'lobby') {
      room.updateMyProfile({ name: nextName.trim() || 'Người Chơi' });
    }
  };

  const toggleGameEnabled = (gameId: EventGameId) => {
    if (!room.isHost) return;
    playSfx('click');
    const cur = room.settings.games;
    if (cur.includes(gameId)) {
      if (cur.length <= 1) return; // Must keep at least 1 game
      room.updateSettings({ games: cur.filter((g) => g !== gameId) });
    } else {
      room.updateSettings({ games: [...cur, gameId] });
    }
  };

  const moveGameOrder = (gameId: EventGameId, delta: -1 | 1) => {
    if (!room.isHost) return;
    const cur = [...room.settings.games];
    const idx = cur.indexOf(gameId);
    const nextIdx = idx + delta;
    if (idx < 0 || nextIdx < 0 || nextIdx >= cur.length) return;
    playSfx('click');
    const tmp = cur[idx];
    cur[idx] = cur[nextIdx];
    cur[nextIdx] = tmp;
    room.updateSettings({ games: cur });
  };

  const shuffleGames = () => {
    if (!room.isHost || room.settings.games.length < 2) return;
    playSfx('click');
    const arr = [...room.settings.games];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    room.updateSettings({ games: arr });
  };

  const updateGameTimeLimit = (gameId: EventGameId, nextSec: number) => {
    if (!room.isHost) return;
    const bounds = EVENT_TIME_LIMIT_BOUNDS[gameId];
    const clamped = Math.max(bounds.min, Math.min(bounds.max, nextSec));
    room.updateSettings({
      timeLimits: {
        ...room.settings.timeLimits,
        [gameId]: clamped,
      },
    });
  };

  const allGuestsReady = room.members.every(
    (m) => m.peerId === room.hostId || m.ready,
  );
  const canHostStart =
    room.isHost &&
    room.members.length >= EVENT_MIN_PLAYERS &&
    room.members.length <= EVENT_MAX_PLAYERS &&
    allGuestsReady &&
    room.settings.games.length >= 1;

  return (
    <div className="min-h-screen bg-[#1a100b] bg-[radial-gradient(circle_at_15%_0%,_#4b2612_0%,_transparent_46%),radial-gradient(circle_at_85%_10%,_#112e3d_0%,_transparent_46%),linear-gradient(180deg,_#1c110c_0%,_#110a07_100%)] px-4 py-6 text-[#FFF9F0]">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Top bar */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-amber-400/30 bg-[#27150d]/95 px-5 py-4 shadow-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                if (room.phase === 'lobby') {
                  room.leaveRoom();
                } else {
                  onBackToModeSelect();
                }
              }}
              className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-white/15 px-3.5 py-2 text-xs font-black text-amber-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{room.phase === 'lobby' ? 'Rời Sảnh' : 'Chọn Chế Độ'}</span>
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-black text-amber-200">
                <Trophy className="h-3 w-3 text-amber-300" />
                <span>PAWS EVENT CUP · 2–8 NGƯỜI THẬT (0 BOT)</span>
              </div>
              <h1 className="mt-0.5 font-display text-2xl font-black text-white sm:text-3xl">
                Phòng Thi Đấu Liên Hoàn
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {room.connectionStatus === 'connected' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-200">
                <Wifi className="h-3.5 w-3.5" />
                <span>Đã kết nối Realtime</span>
              </span>
            ) : room.connectionStatus === 'connecting' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-200">
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                <span>Đang kết nối...</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs font-bold text-amber-100/70">
                <WifiOff className="h-3.5 w-3.5" />
                <span>Chưa vào phòng</span>
              </span>
            )}
          </div>
        </header>

        {/* Notices & Errors */}
        {!room.configured && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-400/45 bg-amber-950/60 p-4 text-xs text-amber-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="font-black text-amber-200">
                Chưa cấu hình Supabase Realtime (.env.local)
              </p>
              <p className="mt-1 text-amber-100/80">
                Vui lòng cấu hình <code>VITE_SUPABASE_URL</code> và{' '}
                <code>VITE_SUPABASE_ANON_KEY</code> theo hướng dẫn trong{' '}
                <code>SUPABASE_SETUP.md</code> để chơi phòng Event trực tuyến.
              </p>
            </div>
          </div>
        )}

        {room.error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-400/50 bg-rose-950/70 px-4 py-3 text-xs font-bold text-rose-100">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
            <span>{room.error}</span>
          </div>
        )}

        {/* IDLE STATE: Create or Join */}
        {room.phase === 'idle' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Profile card */}
            <section className="rounded-3xl border border-amber-500/25 bg-[#24140d]/95 p-5 shadow-xl lg:col-span-5">
              <h2 className="font-display text-lg font-black text-amber-200">
                1. Hồ Sơ Tuyển Thủ
              </h2>

              <label className="mt-4 block text-xs font-bold text-amber-200/80">
                Tên hiển thị trong giải
                <input
                  type="text"
                  maxLength={18}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Nhập tên của bạn..."
                  className="mt-1.5 w-full rounded-2xl border border-amber-400/35 bg-black/45 px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-amber-300"
                />
              </label>

              <div className="mt-4">
                <div className="mb-2 text-xs font-bold text-amber-200/80">
                  Chọn nhân vật thú bông 3D
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {ANIMALS.map((a) => {
                    const active = a.id === selectedAnimal;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleSelectAnimal(a.id)}
                        className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border px-2 py-2.5 text-[11px] font-black transition ${
                          active
                            ? 'border-amber-300 bg-amber-400/25 text-white shadow-md'
                            : 'border-white/10 bg-black/30 text-amber-100/75 hover:border-amber-400/40'
                        }`}
                      >
                        <AnimalAvatar animal={a.id} size="md" />
                        <span className="truncate">{a.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Create / Join card */}
            <section className="flex flex-col justify-between gap-5 rounded-3xl border border-amber-500/30 bg-[#24140d]/95 p-5 shadow-xl lg:col-span-7">
              <div>
                <h2 className="font-display text-lg font-black text-amber-200">
                  2. Tạo Hoặc Tham Gia Phòng Event
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/75">
                  Một phòng duy nhất cho cả giải đấu liên hoàn qua 4 trò chơi:{' '}
                  <strong className="text-amber-300">PAWS Cards</strong>,{' '}
                  <strong className="text-emerald-300">Block Blast</strong>,{' '}
                  <strong className="text-sky-300">Brawl Arena Online</strong> và{' '}
                  <strong className="text-cyan-300">Glass Carry</strong>. Chủ phòng toàn quyền chọn game, thứ tự và thời gian giới hạn từng game.
                </p>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Create room box */}
                  <div className="flex flex-col justify-between rounded-2xl border border-amber-400/35 bg-gradient-to-b from-amber-500/15 to-black/35 p-4">
                    <div>
                      <div className="text-sm font-black text-amber-200">
                        Tạo Phòng Event Mới
                      </div>
                      <p className="mt-1 text-xs text-amber-100/75">
                        Bạn làm Chủ Phòng (Host), nhận mã 5 ký tự & link mời bạn bè vào đấu Grand Prix.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!room.configured}
                      onClick={handleCreateRoom}
                      className="btn-tactile-amber mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-[#26160b] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Crown className="h-4 w-4" />
                      <span>Tạo Phòng Event</span>
                    </button>
                  </div>

                  {/* Join room box */}
                  <div className="flex flex-col justify-between rounded-2xl border border-sky-400/35 bg-gradient-to-b from-sky-500/15 to-black/35 p-4">
                    <div>
                      <div className="text-sm font-black text-sky-200">
                        Vào Bằng Mã Phòng
                      </div>
                      <label className="mt-2 block text-[11px] font-bold text-sky-100/75">
                        Mã phòng Event (4–6 ký tự)
                        <input
                          type="text"
                          maxLength={6}
                          value={joinCode}
                          onChange={(e) =>
                            setJoinCode(normalizeRoomCode(e.target.value))
                          }
                          placeholder="VD: K9P2X"
                          className="mt-1 w-full rounded-xl border border-sky-400/40 bg-black/50 px-3 py-2 text-center font-mono text-base font-black tracking-widest text-white uppercase outline-none focus:border-sky-300"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={!room.configured || joinCode.length < 4}
                      onClick={handleJoinRoom}
                      className="btn-tactile-sky mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Users className="h-4 w-4" />
                      <span>Tham Gia Phòng</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-amber-100/75">
                <strong className="text-amber-300">Thang điểm Grand Prix mỗi vòng:</strong>{' '}
                Hạng 1 (+10) · Hạng 2 (+7) · Hạng 3 (+5) · Hạng 4 (+4) · Hạng 5 (+3) · Hạng 6 (+2) · Hạng 7–8 (+1).
              </div>
            </section>
          </div>
        )}

        {/* LOBBY STATE */}
        {room.phase === 'lobby' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left column: Room Code + Roster */}
            <section className="space-y-4 lg:col-span-5">
              {/* Room invite card */}
              <div className="rounded-3xl border border-amber-400/35 bg-[#25140d]/95 p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wide text-amber-300">
                    Mã Phòng Event
                  </span>
                  <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-black text-amber-200">
                    {room.members.length}/{EVENT_MAX_PLAYERS} người
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-amber-400/35 bg-black/45 px-4 py-3">
                  <span className="font-mono text-2xl font-black tracking-[0.22em] text-amber-300">
                    {room.roomCode}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/20"
                    >
                      {copiedCode ? (
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedCode ? 'Đã copy' : 'Mã'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyInviteLink}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-amber-400/40 bg-amber-400/20 px-2.5 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-400/30"
                    >
                      {copiedLink ? (
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                      ) : (
                        <Link2 className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedLink ? 'Đã copy link' : 'Link mời'}</span>
                    </button>
                    {nativeShareSupported && (
                      <button
                        type="button"
                        onClick={handleShareInvite}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-sky-400/40 bg-sky-500/20 px-2.5 py-1.5 text-xs font-bold text-sky-100 hover:bg-sky-500/30"
                      >
                        {sharedStatus ? (
                          <Check className="h-3.5 w-3.5 text-emerald-300" />
                        ) : (
                          <Share2 className="h-3.5 w-3.5" />
                        )}
                        <span>{sharedStatus ? 'Đã gửi' : 'Chia sẻ'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick profile edit inside lobby (especially handy after 1-click invite auto-join) */}
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  <label className="flex items-center gap-2 text-[11px] font-bold text-amber-200/80">
                    <span className="shrink-0">Tên của bạn:</span>
                    <input
                      type="text"
                      maxLength={18}
                      value={playerName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full rounded-xl border border-amber-400/30 bg-black/40 px-2.5 py-1 text-xs font-bold text-white outline-none focus:border-amber-300"
                    />
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ANIMALS.map((a) => {
                      const active = a.id === selectedAnimal;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => handleSelectAnimal(a.id)}
                          className={`inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl border px-1.5 py-1 text-[10px] font-black transition ${
                            active
                              ? 'border-amber-300 bg-amber-400/25 text-white'
                              : 'border-white/10 bg-black/30 text-amber-100/70 hover:border-amber-400/35'
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: a.accentHex }}
                          />
                          <span className="truncate">{a.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Members roster */}
              <div className="rounded-3xl border border-white/15 bg-[#23130c]/95 p-5 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-display text-lg font-black text-white">
                    <Users className="h-5 w-5 text-amber-300" />
                    <span>Danh Sách Tuyển Thủ</span>
                  </h2>
                  <span className="text-[11px] font-bold text-amber-200/70">
                    Tối thiểu {EVENT_MIN_PLAYERS} · Tối đa {EVENT_MAX_PLAYERS} · Không Bot
                  </span>
                </div>

                {room.members.length > EVENT_MAX_PLAYERS && (
                  <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-950/60 px-3 py-2 text-[11px] font-bold text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
                    <span>
                      Phòng đang vượt quá {EVENT_MAX_PLAYERS} người — 8 người vào sớm nhất sẽ thi đấu, người vào sau xem ở chế độ Khán giả.
                    </span>
                  </div>
                )}

                {room.members.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-xs text-amber-100/70">
                    Đang đồng bộ danh sách người chơi...
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {room.members.map((m) => {
                      const animalMeta =
                        ANIMALS.find((a) => a.id === m.animal) ?? ANIMALS[0];
                      const isMe = m.peerId === room.myPeerId;
                      const isRoomHost = m.peerId === room.hostId;
                      return (
                        <li
                          key={m.peerId}
                          className={`flex items-center justify-between rounded-2xl border px-3.5 py-2.5 ${
                            isMe
                              ? 'border-amber-400/55 bg-amber-400/15'
                              : 'border-white/10 bg-black/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AnimalAvatar animal={animalMeta.id} size="md" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 truncate text-sm font-black text-white">
                                <span className="truncate">
                                  {m.name} {isMe ? '(Bạn)' : ''}
                                </span>
                                {isRoomHost && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-[#26160b]">
                                    <Crown className="h-2.5 w-2.5" />
                                    HOST
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-semibold text-amber-100/65">
                                {animalMeta.name}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${
                              isRoomHost || m.ready
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-white/10 text-amber-100/60'
                            }`}
                          >
                            {isRoomHost ? 'Chủ phòng' : m.ready ? 'Sẵn sàng' : 'Chưa sẵn sàng'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Ready / Start button */}
                <div className="mt-4">
                  {room.isHost ? (
                    <button
                      type="button"
                      disabled={!canHostStart}
                      onClick={() => {
                        playSfx('click');
                        room.startEvent();
                      }}
                      className="btn-tactile-amber inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-[#26160b] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>
                        {room.members.length < EVENT_MIN_PLAYERS
                          ? `Chờ thêm người (cần ít nhất ${EVENT_MIN_PLAYERS})`
                          : !allGuestsReady
                            ? 'Chờ mọi người bấm Sẵn Sàng...'
                            : `Bắt Đầu Giải Event (${room.settings.games.length} vòng)`}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        playSfx('click');
                        room.updateMyProfile({ ready: !myMember?.ready });
                      }}
                      className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black ${
                        myMember?.ready
                          ? 'btn-tactile-wood border border-emerald-400/50 text-emerald-200'
                          : 'btn-tactile-emerald text-white'
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        {myMember?.ready ? 'Đã Sẵn Sàng (Bấm để hủy)' : 'Bấm Sẵn Sàng'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Right column: Tournament Settings (Game list, Order & Per-Game Time Limits) */}
            <section className="rounded-3xl border border-amber-500/30 bg-[#23130c]/95 p-5 shadow-xl lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-black text-amber-200">
                    Cài Đặt Giải Đấu & Thời Gian Từng Game
                  </h2>
                  <p className="text-xs text-amber-100/70">
                    {room.isHost
                      ? 'Chọn trò chơi, sắp xếp thứ tự thi đấu và giới hạn thời gian riêng cho từng game.'
                      : 'Chủ phòng đang cấu hình danh sách trò chơi và thời gian giới hạn.'}
                  </p>
                </div>

                {room.isHost && (
                  <button
                    type="button"
                    onClick={shuffleGames}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-400/15 px-3 py-1.5 text-xs font-black text-amber-200 hover:bg-amber-400/25"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    <span>Xáo Trộn Thứ Tự</span>
                  </button>
                )}
              </div>

              {/* Enabled games in order + Disabled games below */}
              <div className="mt-4 space-y-2.5">
                {[
                  ...room.settings.games,
                  ...ALL_EVENT_GAMES.filter(
                    (g) => !room.settings.games.includes(g),
                  ),
                ].map((gameId) => {
                  const meta = EVENT_GAME_META[gameId];
                  const bounds = EVENT_TIME_LIMIT_BOUNDS[gameId];
                  const orderIdx = room.settings.games.indexOf(gameId);
                  const enabled = orderIdx >= 0;
                  const timeLimitSec = room.settings.timeLimits[gameId];

                  return (
                    <div
                      key={gameId}
                      className={`rounded-2xl border p-3.5 transition ${
                        enabled
                          ? 'border-amber-400/35 bg-black/35'
                          : 'border-white/10 bg-black/20 opacity-60'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            disabled={!room.isHost}
                            onClick={() => toggleGameEnabled(gameId)}
                            aria-pressed={enabled}
                            className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border text-xs font-black disabled:cursor-default ${
                              enabled
                                ? 'border-emerald-300 bg-emerald-500 text-[#072219]'
                                : 'border-white/25 bg-black/40 text-transparent'
                            }`}
                          >
                            ✓
                          </button>

                          {enabled && (
                            <span className="rounded-lg bg-amber-400/20 px-2 py-0.5 text-[11px] font-black text-amber-300">
                              Vòng {orderIdx + 1}
                            </span>
                          )}

                          <div>
                            <div className="text-sm font-black text-white">
                              {meta.title}
                            </div>
                            <div className="text-[11px] text-amber-100/65">
                              {meta.tagline}
                            </div>
                          </div>
                        </div>

                        {room.isHost && enabled && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={orderIdx === 0}
                              onClick={() => moveGameOrder(gameId, -1)}
                              aria-label={`Đưa ${meta.title} lên trên`}
                              className="cursor-pointer rounded-lg border border-white/15 bg-white/10 p-1.5 text-amber-100 hover:bg-white/20 disabled:opacity-30"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={orderIdx === room.settings.games.length - 1}
                              onClick={() => moveGameOrder(gameId, 1)}
                              aria-label={`Đưa ${meta.title} xuống dưới`}
                              className="cursor-pointer rounded-lg border border-white/15 bg-white/10 p-1.5 text-amber-100 hover:bg-white/20 disabled:opacity-30"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Per-game time limit control */}
                      {enabled && (
                        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-2.5">
                          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-200">
                            <Clock className="h-3.5 w-3.5 text-amber-300" />
                            <span>
                              {gameId === 'brawl'
                                ? 'Giới hạn / hiệp:'
                                : 'Giới hạn thời gian:'}
                            </span>
                            <span className="rounded-lg bg-black/50 px-2 py-0.5 font-mono font-black text-amber-300">
                              {formatSecondsClock(timeLimitSec)} ({timeLimitSec}s)
                            </span>
                          </div>

                          {room.isHost && (
                            <div className="flex flex-1 items-center gap-2 min-w-[180px]">
                              <button
                                type="button"
                                onClick={() =>
                                  updateGameTimeLimit(gameId, timeLimitSec - bounds.step)
                                }
                                className="cursor-pointer rounded-lg border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-black text-white hover:bg-white/20"
                              >
                                -{bounds.step}s
                              </button>
                              <input
                                type="range"
                                min={bounds.min}
                                max={bounds.max}
                                step={bounds.step}
                                value={timeLimitSec}
                                aria-label={`Thời gian giới hạn cho ${meta.title}`}
                                onChange={(e) =>
                                  updateGameTimeLimit(gameId, Number(e.target.value))
                                }
                                className="h-2 flex-1 cursor-pointer accent-amber-400"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateGameTimeLimit(gameId, timeLimitSec + bounds.step)
                                }
                                className="cursor-pointer rounded-lg border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-black text-white hover:bg-white/20"
                              >
                                +{bounds.step}s
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Extra tournament options */}
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs font-black text-sky-200">
                    Số hiệp Brawl Arena
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {([1, 2, 3] as const).map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        disabled={!room.isHost}
                        onClick={() => {
                          playSfx('click');
                          room.updateSettings({ brawlRounds: cnt });
                        }}
                        className={`flex-1 cursor-pointer rounded-xl border py-1.5 text-xs font-black disabled:cursor-default ${
                          room.settings.brawlRounds === cnt
                            ? 'border-sky-300 bg-sky-500/30 text-white'
                            : 'border-white/10 bg-black/35 text-amber-100/70'
                        }`}
                      >
                        {cnt} hiệp
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs font-black text-amber-200">
                    Chuyển vòng sau bảng điểm
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {([10, 0] as const).map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        disabled={!room.isHost}
                        onClick={() => {
                          playSfx('click');
                          room.updateSettings({ autoAdvanceSec: sec });
                        }}
                        className={`flex-1 cursor-pointer rounded-xl border py-1.5 text-xs font-black disabled:cursor-default ${
                          room.settings.autoAdvanceSec === sec
                            ? 'border-amber-300 bg-amber-400/25 text-white'
                            : 'border-white/10 bg-black/35 text-amber-100/70'
                        }`}
                      >
                        {sec === 10 ? 'Tự động (10s)' : 'Host bấm tay'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
