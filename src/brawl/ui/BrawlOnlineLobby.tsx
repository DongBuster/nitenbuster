import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Cookie,
  Copy,
  Crown,
  Link2,
  LogOut,
  Plus,
  Sparkles,
  Swords,
  Users,
  Wifi,
} from 'lucide-react';
import { playSfx } from '../../audio/soundEngine';
import { AnimalAvatar } from '../../components/AnimalAvatar';
import { ANIMALS, type AnimalId } from '../../engine/types';
import { normalizeRoomCode } from '../../online/sanitize';
import {
  formatEquippedSummary,
  type AccessorySelection,
} from '../../scene3d/accessoryCatalog';
import {
  buildOnlineBrawlRoster,
} from '../online/roomRoster';
import type { BrawlRoomHandle } from '../online/useBrawlRoom';
import type { BrawlDifficulty } from '../sim/types';

export interface BrawlOnlineLobbyProps {
  room: BrawlRoomHandle;
  initialRoomCode?: string;
  selectedAnimal: AnimalId;
  equippedAccessory: Partial<Record<AnimalId, AccessorySelection>>;
  cookies: number;
  onSelectAnimal: (animal: AnimalId) => void;
  onSwitchToOffline: () => void;
  onBackToModeSelect: () => void;
}

const NAME_STORAGE_KEY = 'paws_brawl_player_name_v1';
const TARGET_PLAYER_COUNTS = [2, 3, 4, 5, 6, 7, 8] as const;
const DIFFICULTIES: Array<{ id: BrawlDifficulty; label: string }> = [
  { id: 'easy', label: 'Dễ' },
  { id: 'medium', label: 'Vừa' },
  { id: 'hard', label: 'Khó' },
];

function readSavedPlayerName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function BrawlOnlineLobby({
  room,
  initialRoomCode = '',
  selectedAnimal,
  equippedAccessory,
  cookies,
  onSelectAnimal,
  onSwitchToOffline,
  onBackToModeSelect,
}: BrawlOnlineLobbyProps) {
  const [playerName, setPlayerName] = useState<string>(() => {
    const saved = readSavedPlayerName();
    if (saved.trim()) return saved;
    const meta = ANIMALS.find((a) => a.id === selectedAnimal) ?? ANIMALS[0];
    return meta.name;
  });
  const [joinCodeInput, setJoinCodeInput] = useState<string>(() =>
    normalizeRoomCode(initialRoomCode),
  );
  const [copiedMode, setCopiedMode] = useState<'code' | 'link' | null>(null);

  useEffect(() => {
    if (initialRoomCode) {
      setJoinCodeInput(normalizeRoomCode(initialRoomCode));
    }
  }, [initialRoomCode]);

  const savePlayerName = (name: string) => {
    setPlayerName(name);
    try {
      window.localStorage.setItem(NAME_STORAGE_KEY, name);
    } catch {
      // Ignore storage errors
    }
  };

  const handleAnimalPick = (animal: AnimalId) => {
    playSfx('click');
    onSelectAnimal(animal);
    if (room.phase === 'lobby') {
      room.updateProfile(animal, equippedAccessory[animal] ?? []);
    }
  };

  const handleCopy = async (mode: 'code' | 'link') => {
    if (!room.roomCode || typeof navigator === 'undefined') return;
    const text =
      mode === 'code'
        ? room.roomCode
        : `${window.location.origin}${window.location.pathname}?brawlRoom=${room.roomCode}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMode(mode);
      playSfx('click');
      window.setTimeout(() => setCopiedMode(null), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const equippedSummary = formatEquippedSummary(equippedAccessory[selectedAnimal]);
  const previewRoster =
    room.phase === 'lobby'
      ? buildOnlineBrawlRoster(room.members, room.settings)
      : [];
  const botPreviewCount = previewRoster.filter((f) => f.isBot).length;
  const unreadyGuestCount = room.members.filter(
    (m) => m.peerId !== room.hostPeerId && !m.ready,
  ).length;

  return (
    <div className="min-h-dvh bg-[#0e1724] bg-[radial-gradient(circle_at_50%_0%,_#1e3650_0%,_#0a101a_70%)] text-[#F8FAFC] selection:bg-amber-300 selection:text-[#1B110B]">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-between px-4 py-7 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {room.phase === 'lobby' ? (
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  room.leaveRoom();
                }}
                className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-rose-400/35 px-3.5 py-2 text-xs font-black text-rose-100 shadow-md"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-300" />
                <span>Rời Phòng</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    onBackToModeSelect();
                  }}
                  className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-sky-400/30 px-3.5 py-2 text-xs font-black text-amber-100 shadow-md"
                >
                  <ArrowLeft className="h-3.5 w-3.5 text-amber-300" />
                  <span>Chọn Chế Độ</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    onSwitchToOffline();
                  }}
                  className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-white/20 px-3.5 py-2 text-xs font-black text-sky-200 shadow-md"
                >
                  <Bot className="h-3.5 w-3.5 text-sky-300" />
                  <span>Chơi Offline với Bot</span>
                </button>
              </>
            )}

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/35 bg-cyan-950/70 px-3 py-0.5 text-[11px] font-bold tracking-wide text-cyan-200">
                <Wifi className="h-3.5 w-3.5 text-cyan-300" />
                <span>Brawl Arena 3D · Phòng Online</span>
              </div>
              <h1 className="mt-1 font-display text-2xl font-black tracking-tight text-white sm:text-3xl">
                {room.phase === 'lobby'
                  ? `Phòng Đấu #${room.roomCode}`
                  : 'Đấu Trường Online Bạn Bè'}
              </h1>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-[#142030]/90 px-4 py-2 text-sm font-black text-amber-200 shadow-md">
            <Cookie className="h-4 w-4 text-amber-400" />
            <span>{cookies.toLocaleString()} Cookies</span>
          </div>
        </header>

        {/* Error / Config Notice */}
        {(room.errorMessage || !room.configured) && (
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-rose-400/50 bg-rose-950/75 px-4 py-3 text-xs font-bold text-rose-100 shadow-lg">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
            <span>
              {room.errorMessage ||
                'Chế độ Online cần cấu hình VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY. Bạn vẫn có thể chơi Offline với Bot ngay lập tức.'}
            </span>
          </div>
        )}

        {/* IDLE: Create or Join Room */}
        {room.phase === 'idle' && (
          <main className="my-6 grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Player Name + Character Selection */}
            <section className="flex flex-col justify-between rounded-3xl border-2 border-sky-900/40 bg-[#132032] p-5 shadow-2xl sm:p-6 lg:col-span-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-sky-300">
                  Tên Hiển Thị Trong Phòng
                  <input
                    type="text"
                    maxLength={18}
                    value={playerName}
                    onChange={(e) => savePlayerName(e.target.value)}
                    placeholder="Nhập tên của bạn..."
                    className="mt-2 w-full rounded-2xl border border-sky-400/30 bg-[#0b1523] px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-amber-300"
                  />
                </label>

                <div className="mt-5 flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-wider text-sky-300">
                    Chọn Chiến Binh Thú Cưng
                  </h2>
                  {equippedSummary && (
                    <span
                      title={equippedSummary.fullNames.join(', ')}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-950/80 px-2.5 py-0.5 text-xs font-bold text-amber-200"
                    >
                      <Sparkles className="h-3 w-3 text-amber-400" />
                      <span>
                        {equippedSummary.primaryName}
                        {equippedSummary.extraCount > 0
                          ? ` +${equippedSummary.extraCount}`
                          : ''}
                      </span>
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {ANIMALS.map((a) => {
                    const active = a.id === selectedAnimal;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleAnimalPick(a.id)}
                        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                          active
                            ? 'btn-tactile-amber border-amber-300'
                            : 'border-sky-900/40 bg-black/25 text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        <AnimalAvatar
                          animal={a.id}
                          size="lg"
                          className={active ? 'ring-amber-950/35' : ''}
                        />
                        <span
                          className={`text-xs font-black ${
                            active ? 'text-[#26160b]' : 'text-white'
                          }`}
                        >
                          {a.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-sky-900/50 bg-[#0c1624] p-3.5 text-xs text-sky-100/90">
                Phòng hỗ trợ <strong>2–8 người chơi thời gian thực</strong>, có thể bật tự động bù thêm Bot AI nếu chưa đủ người.
              </div>
            </section>

            {/* Right: Create / Join actions */}
            <section className="flex flex-col justify-between rounded-3xl border-2 border-cyan-500/30 bg-[#132032] p-5 shadow-2xl sm:p-6 lg:col-span-6">
              <div className="space-y-6">
                <div className="rounded-2xl border border-amber-400/30 bg-[#0d1828] p-5">
                  <h2 className="font-display text-lg font-black text-amber-300">
                    Tạo Phòng Mới
                  </h2>
                  <p className="mt-1 text-xs text-slate-300">
                    Mở phòng đấu 3 hiệp, nhận mã phòng 6 ký tự & link mời bạn bè vào chiến ngay.
                  </p>
                  <button
                    type="button"
                    disabled={!room.configured || room.status === 'connecting'}
                    onClick={() => {
                      playSfx('click');
                      room.createRoom(
                        playerName,
                        selectedAnimal,
                        equippedAccessory[selectedAnimal] ?? [],
                      );
                    }}
                    className="btn-tactile-amber mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-[#1B110B] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    <span>
                      {room.status === 'connecting'
                        ? 'Đang tạo phòng...'
                        : 'TẠO PHÒNG ĐẤU TRƯỜNG'}
                    </span>
                  </button>
                </div>

                <div className="rounded-2xl border border-sky-400/30 bg-[#0d1828] p-5">
                  <h2 className="font-display text-lg font-black text-sky-300">
                    Tham Gia Bằng Mã Phòng
                  </h2>
                  <p className="mt-1 text-xs text-slate-300">
                    Nhập mã phòng từ chủ phòng (VD: <span className="font-mono text-amber-200">PAWS88</span>).
                  </p>
                  <form
                    className="mt-3 flex flex-col gap-2.5 sm:flex-row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      playSfx('click');
                      room.joinRoom(
                        joinCodeInput,
                        playerName,
                        selectedAnimal,
                        equippedAccessory[selectedAnimal] ?? [],
                      );
                    }}
                  >
                    <input
                      type="text"
                      maxLength={8}
                      value={joinCodeInput}
                      onChange={(e) =>
                        setJoinCodeInput(normalizeRoomCode(e.target.value))
                      }
                      placeholder="NHẬP MÃ PHÒNG..."
                      className="flex-1 rounded-2xl border border-sky-400/35 bg-[#08101c] px-4 py-3 font-mono text-base font-black tracking-widest text-amber-200 uppercase outline-none focus:border-sky-300"
                    />
                    <button
                      type="submit"
                      disabled={
                        !room.configured ||
                        room.status === 'connecting' ||
                        joinCodeInput.length < 4
                      }
                      className="btn-tactile-sky inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Swords className="h-4 w-4" />
                      <span>Vào Phòng</span>
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-3.5 text-[11px] text-slate-300">
                <strong className="text-amber-200">Mẹo:</strong> Chủ phòng chạy vật lý đồng bộ cho cả phòng (20Hz). Bấm <strong>H</strong> khi cầm <strong>Kiếm Băng / Xẻng Tuyết</strong> để tung chiêu <strong>Xoay 360°</strong>!
              </div>
            </section>
          </main>
        )}

        {/* LOBBY: Waiting Room */}
        {room.phase === 'lobby' && (
          <main className="my-6 grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Room Code + Live Players List */}
            <section className="flex flex-col justify-between rounded-3xl border-2 border-cyan-500/35 bg-[#132032] p-5 shadow-2xl sm:p-6 lg:col-span-7">
              <div>
                {/* Room Code Hero + Invite Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/30 bg-[#0b1523] p-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                      Mã Phòng Mời Bạn Bè
                    </div>
                    <div className="mt-0.5 font-mono text-3xl font-black tracking-[0.2em] text-amber-300">
                      {room.roomCode}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopy('code')}
                      className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/20 px-3 py-2 text-xs font-black text-amber-100"
                    >
                      {copiedMode === 'code' ? (
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-amber-300" />
                      )}
                      <span>{copiedMode === 'code' ? 'Đã chép mã' : 'Chép Mã'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopy('link')}
                      className="btn-tactile-sky inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black text-white"
                    >
                      {copiedMode === 'link' ? (
                        <Check className="h-3.5 w-3.5 text-white" />
                      ) : (
                        <Link2 className="h-3.5 w-3.5 text-white" />
                      )}
                      <span>{copiedMode === 'link' ? 'Đã chép link!' : 'Link Mời'}</span>
                    </button>
                  </div>
                </div>

                {/* Members Roster */}
                <div className="mt-5 flex items-center justify-between">
                  <h2 className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-300">
                    <Users className="h-4 w-4 text-sky-400" />
                    <span>
                      Người Chơi Trong Phòng ({room.members.length}/8)
                      {botPreviewCount > 0 ? ` · +${botPreviewCount} Bot AI` : ''}
                    </span>
                  </h2>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                    {room.status === 'connected' ? 'Đã kết nối' : 'Đang đồng bộ...'}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {room.members.map((m) => {
                    const meta = ANIMALS.find((a) => a.id === m.animal) ?? ANIMALS[0];
                    const isMemberHost = m.peerId === room.hostPeerId;
                    const isMe = m.peerId === room.myPeerId;
                    return (
                      <div
                        key={m.peerId}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 text-sm ${
                          isMe
                            ? 'border-amber-400/55 bg-amber-400/12'
                            : 'border-white/10 bg-black/25'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <AnimalAvatar animal={m.animal} size="md" />
                          <div>
                            <div className="flex items-center gap-1.5 font-black text-white">
                              <span>{m.name}</span>
                              {isMe && (
                                <span className="rounded bg-amber-400/25 px-1.5 py-0.5 text-[10px] font-black text-amber-200">
                                  Bạn
                                </span>
                              )}
                              {isMemberHost && (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                                  <Crown className="h-3 w-3" />
                                  Chủ phòng
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-semibold text-slate-400">
                              {meta.name}
                            </div>
                          </div>
                        </div>

                        {isMemberHost ? (
                          <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-[11px] font-black text-amber-200">
                            Sẵn sàng mở trận
                          </span>
                        ) : m.ready ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/45 bg-emerald-500/20 px-3 py-1 text-[11px] font-black text-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Sẵn sàng
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-slate-300">
                            Đang chờ...
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Animal Switcher inside Lobby */}
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="text-[11px] font-black uppercase tracking-wider text-sky-300">
                  Đổi Thú Cưng Nhanh
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {ANIMALS.map((a) => {
                    const active = a.id === selectedAnimal;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleAnimalPick(a.id)}
                        title={a.name}
                        className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-2 text-[10px] font-black transition ${
                          active
                            ? 'btn-tactile-amber border-amber-300 text-[#26160b]'
                            : 'border-white/10 bg-black/25 text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        <AnimalAvatar
                          animal={a.id}
                          size="sm"
                          className={active ? 'ring-amber-950/35' : ''}
                        />
                        <span className="truncate">{a.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Right: Host Room Settings & Start/Ready CTA */}
            <section className="flex flex-col justify-between rounded-3xl border-2 border-sky-900/40 bg-[#132032] p-5 shadow-2xl sm:p-6 lg:col-span-5">
              <div className="space-y-5">
                <h2 className="text-xs font-black uppercase tracking-wider text-sky-300">
                  Cài Đặt Phòng Đấu {room.isHost ? '(Chủ phòng)' : '(Chỉ xem)'}
                </h2>

                {/* Fill with Bots toggle */}
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0b1523] p-3.5">
                  <div>
                    <div className="text-xs font-black text-white">
                      Tự động bù Bot AI
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      Thêm Bot cho đủ sĩ số đấu trường
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!room.isHost}
                    aria-pressed={room.settings.fillWithBots}
                    onClick={() => {
                      playSfx('click');
                      room.updateSettings({
                        fillWithBots: !room.settings.fillWithBots,
                      });
                    }}
                    className={`cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      room.settings.fillWithBots
                        ? 'btn-tactile-emerald'
                        : 'border border-white/20 bg-white/10 text-slate-300'
                    }`}
                  >
                    {room.settings.fillWithBots ? 'Đang Bật' : 'Đang Tắt'}
                  </button>
                </div>

                {/* Target players count (when fillWithBots is on) */}
                {room.settings.fillWithBots && (
                  <>
                    <div>
                      <div className="text-xs font-black text-sky-200">
                        Tổng Số Đấu Thủ ({room.settings.targetPlayers} người)
                      </div>
                      <div className="mt-2 grid grid-cols-7 gap-1.5">
                        {TARGET_PLAYER_COUNTS.map((n) => (
                          <button
                            key={n}
                            type="button"
                            disabled={!room.isHost}
                            onClick={() => {
                              playSfx('click');
                              room.updateSettings({ targetPlayers: n });
                            }}
                            className={`cursor-pointer rounded-xl py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              room.settings.targetPlayers === n
                                ? 'btn-tactile-amber text-[#1B110B]'
                                : 'border border-sky-900/40 bg-black/25 text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-black text-sky-200">
                        Độ Khó Bot AI
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {DIFFICULTIES.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            disabled={!room.isHost}
                            onClick={() => {
                              playSfx('click');
                              room.updateSettings({ difficulty: d.id });
                            }}
                            className={`cursor-pointer rounded-xl py-2.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              room.settings.difficulty === d.id
                                ? 'btn-tactile-sky text-white'
                                : 'border border-sky-900/40 bg-black/25 text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="rounded-2xl border border-amber-400/25 bg-[#0e1724] p-3.5 text-xs text-slate-200">
                  <div className="font-black text-amber-300">Thể Thức 3 Hiệp</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                    Đấm (<kbd className="rounded bg-white/10 px-1 font-mono">J</kbd>), Húc đầu / Xoay 360° (<kbd className="rounded bg-white/10 px-1 font-mono">H</kbd>), Nắm ném (<kbd className="rounded bg-white/10 px-1 font-mono">K</kbd>), Lăn né (<kbd className="rounded bg-white/10 px-1 font-mono">L</kbd>).
                  </p>
                </div>
              </div>

              {/* Start (Host) or Ready (Guest) Button */}
              <div className="mt-6 space-y-2">
                {room.isHost ? (
                  <>
                    <button
                      type="button"
                      disabled={!room.canStart}
                      onClick={() => {
                        playSfx('roundStart');
                        room.startOnlineMatch();
                      }}
                      className="btn-tactile-amber inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-black text-[#1B110B] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Swords className="h-5 w-5" />
                      <span>BẮT ĐẦU ĐẤU TRƯỜNG ({previewRoster.length} ĐẤU THỦ)</span>
                    </button>
                    {!room.canStart && (
                      <p className="text-center text-xs font-semibold text-amber-200/90">
                        {unreadyGuestCount > 0
                          ? `Còn ${unreadyGuestCount} người chơi chưa bấm Sẵn sàng.`
                          : 'Cần ít nhất 2 đấu thủ — bật Bù Bot AI hoặc mời thêm bạn.'}
                      </p>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      room.toggleReady();
                    }}
                    className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-black ${
                      room.myMember?.ready
                        ? 'btn-tactile-wood border border-emerald-400/45 text-emerald-200'
                        : 'btn-tactile-emerald text-white'
                    }`}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    <span>
                      {room.myMember?.ready
                        ? 'ĐÃ SẴN SÀNG (Bấm để hủy)'
                        : 'BẤM SẴN SÀNG'}
                    </span>
                  </button>
                )}
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
