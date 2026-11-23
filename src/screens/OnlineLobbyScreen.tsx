import { useMemo, useState } from 'react';
import { ANIMALS, type AnimalId, type BotDifficulty, type GameDeckMode } from '../engine/types';
import { normalizeRoomCode } from '../online/sanitize';
import type { OnlineRoomController } from '../online/useOnlineRoom';
import { SHOP_ITEMS, useProfileStore } from '../store/profileStore';
import { playSfx } from '../audio/soundEngine';

export interface OnlineLobbyScreenProps {
  room: OnlineRoomController;
  onBackToMenu: () => void;
}

const ANIMAL_EMOJI: Record<AnimalId, string> = {
  dog: '🐶',
  cat: '🐱',
  duck: '🦆',
  shark: '🦈',
  dino: '🦖',
  panda: '🐼',
  chicken: '🐔',
  bunny: '🐰',
};

const NAME_STORAGE_KEY = 'paws_online_display_name_v1';

function loadSavedName(): string {
  if (typeof window === 'undefined') return 'Người chơi';
  try {
    return window.localStorage.getItem(NAME_STORAGE_KEY) || 'Người chơi';
  } catch {
    return 'Người chơi';
  }
}

export function OnlineLobbyScreen({
  room,
  onBackToMenu,
}: OnlineLobbyScreenProps) {
  const { selectedAnimal, equippedAccessory, selectAnimal } = useProfileStore();
  const [displayName, setDisplayName] = useState<string>(() => loadSavedName());
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const myAccessory = equippedAccessory[selectedAnimal] ?? null;
  const myMember = useMemo(
    () => room.members.find((m) => m.peerId === room.myPeerId) ?? null,
    [room.members, room.myPeerId],
  );

  const saveName = (val: string) => {
    setDisplayName(val);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(NAME_STORAGE_KEY, val);
      } catch {
        // ignore storage errors
      }
    }
  };

  const handleSelectAnimal = (animal: AnimalId) => {
    playSfx('click');
    selectAnimal(animal);
    if (room.phase === 'lobby') {
      room.updateMyProfile({
        animal,
        accessory: equippedAccessory[animal] ?? null,
      });
    }
  };

  const handleCreateRoom = () => {
    playSfx('click');
    room.createRoom({
      name: displayName.trim() || 'Chủ phòng',
      animal: selectedAnimal,
      accessory: myAccessory,
    });
  };

  const handleJoinRoom = () => {
    const clean = normalizeRoomCode(joinCodeInput);
    if (clean.length < 4) return;
    playSfx('click');
    room.joinRoom(clean, {
      name: displayName.trim() || 'Người chơi',
      animal: selectedAnimal,
      accessory: myAccessory,
    });
  };

  const handleCopyCode = async () => {
    if (!room.roomCode) return;
    playSfx('click');
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleLeave = () => {
    playSfx('click');
    room.leaveRoom();
  };

  // 1. Supabase Not Configured Setup Card
  if (!room.configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#2A1A11] via-[#1D120C] to-[#120B07] p-4 text-white">
        <div className="w-full max-w-xl rounded-3xl border border-amber-300/30 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md sm:p-8">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-sky-300">
              🌐 PAWS Online Multiplayer
            </span>
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onBackToMenu();
              }}
              className="cursor-pointer rounded-xl border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-black text-white transition hover:bg-white/20"
            >
              ← Quay lại Menu
            </button>
          </div>

          <h1 className="mt-4 text-2xl font-black text-amber-50 sm:text-3xl">
            Cần Cấu Hình Supabase Realtime
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Chế độ chơi Online dùng <strong>Supabase Realtime Free Tier</strong> (không cần cài SQL hay đăng nhập). Bạn chỉ cần thêm 2 biến môi trường sau vào file{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-amber-200">
              paws-game/.env.local
            </code>
            :
          </p>

          <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/15 bg-slate-950/90 p-4 text-xs font-mono text-emerald-300">
{`VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>`}
          </pre>

          <ol className="mt-4 space-y-2 text-sm text-slate-200">
            <li>
              <strong>Bước 1:</strong> Tạo dự án miễn phí tại{' '}
              <span className="text-sky-300">supabase.com</span>.
            </li>
            <li>
              <strong>Bước 2:</strong> Vào <em>Project Settings → API</em>, copy{' '}
              <strong>Project URL</strong> và <strong>anon public key</strong> vào{' '}
              <code className="rounded bg-white/10 px-1 text-amber-200">.env.local</code>.
            </li>
            <li>
              <strong>Bước 3:</strong> Khởi động lại{' '}
              <code className="rounded bg-white/10 px-1 text-amber-200">npm run dev</code>{' '}
              và tạo mã phòng để mời bạn bè!
            </li>
          </ol>

          <p className="mt-4 text-xs text-slate-400">
            Xem hướng dẫn chi tiết trong file <code>SUPABASE_SETUP.md</code>. Chế độ chơi offline với Bot vẫn hoạt động bình thường!
          </p>
        </div>
      </div>
    );
  }

  // 2. Idle Screen (Create or Join Room)
  if (room.phase === 'idle') {
    const cleanCode = normalizeRoomCode(joinCodeInput);
    const canJoin = cleanCode.length >= 4 && room.connectionStatus !== 'connecting';

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#2A1A11] via-[#1D120C] to-[#120B07] p-4 text-white sm:p-6">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="inline-block rounded-full bg-sky-500/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-sky-300">
                🌐 Phòng Chơi Online 3D
              </span>
              <h1 className="mt-1.5 text-2xl font-black text-amber-50 sm:text-3xl">
                Chơi Cùng Bạn Bè Qua Mã Phòng
              </h1>
            </div>
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onBackToMenu();
              }}
              className="cursor-pointer rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/20"
            >
              ← Quay lại Menu
            </button>
          </div>

          {room.error && (
            <div className="mt-4 rounded-2xl border border-rose-400/50 bg-rose-500/20 px-4 py-3 text-sm font-bold text-rose-100">
              ⚠️ {room.error}
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-5">
            {/* Profile & Animal Picker */}
            <section className="rounded-3xl border border-amber-200/20 bg-slate-900/85 p-5 shadow-xl lg:col-span-3">
              <h2 className="text-base font-black text-amber-200">
                1. Chọn Tên &amp; Nhân Vật Thú Bông
              </h2>

              <label className="mt-3 block">
                <span className="text-xs font-bold text-slate-300">
                  Tên hiển thị trong phòng
                </span>
                <input
                  type="text"
                  maxLength={18}
                  value={displayName}
                  onChange={(e) => saveName(e.target.value)}
                  placeholder="Nhập tên của bạn..."
                  className="mt-1.5 w-full rounded-2xl border border-white/20 bg-slate-950/75 px-4 py-2.5 text-sm font-bold text-white outline-none transition focus:border-amber-400"
                />
              </label>

              <div className="mt-4">
                <span className="text-xs font-bold text-slate-300">
                  Chọn 1 trong 8 thú bông 3D
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ANIMALS.map((a) => {
                    const active = selectedAnimal === a.id;
                    const eqId = equippedAccessory[a.id];
                    const eqItem = eqId
                      ? SHOP_ITEMS.find((i) => i.id === eqId)
                      : null;

                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleSelectAnimal(a.id)}
                        className={`relative flex cursor-pointer flex-col items-center rounded-2xl border p-2.5 text-center transition ${
                          active
                            ? 'border-amber-300 bg-amber-400/20 shadow-md'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-xl shadow-inner"
                          style={{ backgroundColor: a.accentHex }}
                        >
                          {ANIMAL_EMOJI[a.id]}
                        </span>
                        <span className="mt-1.5 text-xs font-black text-white">
                          {a.name}
                        </span>
                        {eqItem && (
                          <span
                            title={eqItem.name}
                            className="absolute top-1.5 right-1.5 text-xs"
                          >
                            {eqItem.icon}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Create or Join Actions */}
            <section className="flex flex-col justify-between gap-4 rounded-3xl border border-sky-300/25 bg-slate-900/85 p-5 shadow-xl lg:col-span-2">
              <div>
                <h2 className="text-base font-black text-sky-200">
                  2. Tạo Hoặc Vào Phòng
                </h2>
                <p className="mt-1 text-xs text-slate-300">
                  Tạo phòng mới để nhận mã 5 ký tự gửi bạn bè, hoặc nhập mã để tham gia ngay!
                </p>

                <button
                  type="button"
                  disabled={room.connectionStatus === 'connecting'}
                  onClick={handleCreateRoom}
                  className="mt-4 w-full cursor-pointer rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3.5 text-base font-black text-slate-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {room.connectionStatus === 'connecting'
                    ? '⏳ Đang tạo phòng...'
                    : '🏠 Tạo Phòng Mới'}
                </button>
              </div>

              <div className="border-t border-white/10 pt-4">
                <label className="block">
                  <span className="text-xs font-bold text-slate-300">
                    🔑 Vào Phòng Bằng Mã (5 ký tự)
                  </span>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={joinCodeInput}
                      onChange={(e) =>
                        setJoinCodeInput(e.target.value.toUpperCase())
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canJoin) handleJoinRoom();
                      }}
                      placeholder="VD: PAWS7"
                      className="w-full rounded-2xl border border-white/20 bg-slate-950/75 px-3.5 py-2.5 text-center font-mono text-base font-black tracking-[0.22em] text-amber-200 uppercase outline-none focus:border-sky-400"
                    />
                    <button
                      type="button"
                      disabled={!canJoin}
                      onClick={handleJoinRoom}
                      className="shrink-0 cursor-pointer rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Vào!
                    </button>
                  </div>
                </label>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // 3. Lobby Room (Connected, Waiting to Start)
  const canHostStart =
    room.isHost &&
    (room.roomSettings.fillWithBots || room.members.length >= 2);
  const emptyBotSlots = Math.max(
    0,
    room.roomSettings.maxPlayers - room.members.length,
  );

  const connectionPill =
    room.connectionStatus === 'connected'
      ? { label: '🟢 Đã kết nối', cls: 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200' }
      : room.connectionStatus === 'connecting'
        ? { label: '🟡 Đang kết nối...', cls: 'border-amber-400/40 bg-amber-500/20 text-amber-200' }
        : { label: '🔴 Mất kết nối', cls: 'border-rose-400/40 bg-rose-500/20 text-rose-200' };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2A1A11] via-[#1D120C] to-[#120B07] p-4 text-white sm:p-6">
      <div className="mx-auto max-w-5xl">
        {/* Lobby Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-amber-200/20 bg-slate-900/90 p-4 shadow-xl">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleLeave}
              className="cursor-pointer rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-black text-white transition hover:bg-white/20"
            >
              ← Rời Phòng
            </button>

            <div className="flex items-center gap-2 rounded-2xl border border-amber-300/45 bg-amber-400/15 px-3.5 py-1.5">
              <span className="text-xs font-bold text-amber-200">MÃ PHÒNG:</span>
              <span className="font-mono text-lg font-black tracking-[0.2em] text-white">
                {room.roomCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="cursor-pointer rounded-xl bg-amber-400 px-2.5 py-1 text-xs font-black text-slate-950 transition hover:bg-amber-300"
              >
                {copied ? '✓ Đã sao chép!' : '📋 Sao chép mã'}
              </button>
            </div>
          </div>

          <span
            className={`rounded-full border px-3 py-1 text-xs font-extrabold ${connectionPill.cls}`}
          >
            {connectionPill.label}
          </span>
        </div>

        {room.error && (
          <div className="mt-4 rounded-2xl border border-rose-400/50 bg-rose-500/20 px-4 py-3 text-sm font-bold text-rose-100">
            ⚠️ {room.error}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* Live Presence Seats */}
          <section className="rounded-3xl border border-white/15 bg-slate-900/85 p-5 shadow-xl lg:col-span-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-amber-200">
                👥 Người Chơi Trong Phòng ({room.members.length}/{room.roomSettings.maxPlayers})
              </h2>
              <span className="text-xs font-bold text-slate-400">
                {room.roomSettings.fillWithBots
                  ? `Tự thêm ${emptyBotSlots} Bot khi bắt đầu`
                  : 'Chỉ chơi giữa người thật'}
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {room.members.map((member) => {
                const animalMeta =
                  ANIMALS.find((a) => a.id === member.animal) ?? ANIMALS[0];
                const eqItem = member.accessory
                  ? SHOP_ITEMS.find((i) => i.id === member.accessory)
                  : null;
                const isMe = member.peerId === room.myPeerId;

                return (
                  <div
                    key={member.peerId}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                      isMe
                        ? 'border-sky-400/45 bg-sky-500/15'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-xl shadow-md"
                        style={{ backgroundColor: animalMeta.accentHex }}
                      >
                        {ANIMAL_EMOJI[member.animal]}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-black text-white">
                            {member.name}
                          </span>
                          {isMe && (
                            <span className="rounded bg-sky-400/25 px-1.5 py-0.5 text-[10px] font-black text-sky-200">
                              BẠN
                            </span>
                          )}
                          {member.isHost && (
                            <span className="rounded-full bg-amber-400/25 px-2 py-0.5 text-[10px] font-black text-amber-200">
                              👑 Chủ phòng
                            </span>
                          )}
                          {eqItem && (
                            <span
                              title={eqItem.name}
                              className="rounded-full bg-white/10 px-1.5 py-0.5 text-xs"
                            >
                              {eqItem.icon}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {animalMeta.name} · {animalMeta.personality}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-black ${
                        member.isHost || member.ready
                          ? 'bg-emerald-500/25 text-emerald-200'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {member.isHost || member.ready
                        ? '✓ Sẵn sàng'
                        : 'Đang chờ...'}
                    </span>
                  </div>
                );
              })}

              {room.roomSettings.fillWithBots &&
                Array.from({ length: emptyBotSlots }).map((_, idx) => (
                  <div
                    key={`bot-slot-${idx}`}
                    className="flex items-center justify-between rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-slate-400"
                  >
                    <span className="text-xs font-bold">
                      🤖 Ghế Bot tự động #{idx + 1}
                    </span>
                    <span className="text-[11px] font-semibold">
                      Có thể mời thêm bạn bằng mã phòng
                    </span>
                  </div>
                ))}
            </div>
          </section>

          {/* Host Settings / Guest Ready Panel */}
          <section className="flex flex-col justify-between gap-4 rounded-3xl border border-amber-200/20 bg-slate-900/85 p-5 shadow-xl lg:col-span-2">
            {room.isHost ? (
              <div className="space-y-4">
                <h2 className="text-base font-black text-amber-200">
                  ⚙️ Cài Đặt Phòng (Chủ phòng)
                </h2>

                {/* Fill with Bots toggle */}
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5">
                  <div>
                    <div className="text-xs font-black text-white">
                      🤖 Lấp Bot tự động
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Thêm Bot cho đủ số ghế tối đa
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      room.updateRoomSettings({
                        fillWithBots: !room.roomSettings.fillWithBots,
                      });
                    }}
                    className={`cursor-pointer rounded-full px-3 py-1 text-xs font-black transition ${
                      room.roomSettings.fillWithBots
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-white/15 text-slate-300'
                    }`}
                  >
                    {room.roomSettings.fillWithBots ? 'Bật' : 'Tắt'}
                  </button>
                </div>

                {/* Max Players 4–8 */}
                <div>
                  <span className="text-xs font-bold text-slate-300">
                    Số người tối đa
                  </span>
                  <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                    {[4, 5, 6, 7, 8].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          playSfx('click');
                          room.updateRoomSettings({ maxPlayers: n });
                        }}
                        className={`cursor-pointer rounded-xl py-1.5 text-xs font-black transition ${
                          room.roomSettings.maxPlayers === n
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/10 text-slate-200 hover:bg-white/20'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bot Difficulty */}
                <div>
                  <span className="text-xs font-bold text-slate-300">
                    Độ khó Bot
                  </span>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ['easy', 'Dễ'],
                        ['medium', 'Vừa'],
                        ['hard', 'Khó'],
                      ] as Array<[BotDifficulty, string]>
                    ).map(([diff, label]) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => {
                          playSfx('click');
                          room.updateRoomSettings({ difficulty: diff });
                        }}
                        className={`cursor-pointer rounded-xl py-1.5 text-xs font-black transition ${
                          room.roomSettings.difficulty === diff
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/10 text-slate-200 hover:bg-white/20'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deck Mode */}
                <div>
                  <span className="text-xs font-bold text-slate-300">
                    Bộ bài
                  </span>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {(
                      [
                        ['mvp', 'MVP (6 loại)'],
                        ['full', 'Full (11 loại)'],
                      ] as Array<[GameDeckMode, string]>
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          playSfx('click');
                          room.updateRoomSettings({ deckMode: mode });
                        }}
                        className={`cursor-pointer rounded-xl py-1.5 text-xs font-black transition ${
                          room.roomSettings.deckMode === mode
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/10 text-slate-200 hover:bg-white/20'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Turn Timer */}
                <div>
                  <span className="text-xs font-bold text-slate-300">
                    ⏱️ Thời gian mỗi lượt
                  </span>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {[15, 20, 30].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          playSfx('click');
                          room.updateRoomSettings({ turnTimeSec: sec });
                        }}
                        className={`cursor-pointer rounded-xl py-1.5 text-xs font-black transition ${
                          room.roomSettings.turnTimeSec === sec
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/10 text-slate-200 hover:bg-white/20'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-base font-black text-sky-200">
                  📋 Thông Tin Phòng
                </h2>
                <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-xs text-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Số ghế tối đa:</span>
                    <strong>{room.roomSettings.maxPlayers} người</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Lấp Bot:</span>
                    <strong>
                      {room.roomSettings.fillWithBots ? 'Có' : 'Không'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bộ bài:</span>
                    <strong>
                      {room.roomSettings.deckMode === 'full'
                        ? 'Full 11 loại'
                        : 'MVP 6 loại'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Thời gian lượt:</span>
                    <strong>{room.roomSettings.turnTimeSec} giây</strong>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Chờ chủ phòng bấm <strong>Bắt Đầu Ván Online 3D</strong> sau khi mọi người sẵn sàng!
                </p>
              </div>
            )}

            {/* Primary Start / Ready Action */}
            {room.isHost ? (
              <button
                type="button"
                disabled={!canHostStart}
                onClick={() => {
                  playSfx('click');
                  room.startOnlineMatch();
                }}
                className="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3.5 text-base font-black text-slate-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                🚀 Bắt Đầu Ván Online 3D!
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  room.updateMyProfile({ ready: !myMember?.ready });
                }}
                className={`w-full cursor-pointer rounded-2xl px-5 py-3.5 text-base font-black shadow-lg transition ${
                  myMember?.ready
                    ? 'border border-emerald-400/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                    : 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 hover:brightness-110'
                }`}
              >
                {myMember?.ready ? '✓ Đã Sẵn Sàng (Bấm để hủy)' : '✓ Sẵn Sàng'}
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
