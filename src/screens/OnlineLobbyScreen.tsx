import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Check,
  Clock,
  Copy,
  Crown,
  Globe,
  Link2,
  Minus,
  Play,
  Plus,
  Settings,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react';
import { ANIMALS, type AnimalId, type BotDifficulty, type GameDeckMode } from '../engine/types';
import {
  buildRoomInviteUrl,
  canUseNativeShare,
  copyTextSafe,
  shareRoomInvite,
} from '../online/inviteLink';
import { normalizeRoomCode } from '../online/sanitize';
import type { OnlineRoomController } from '../online/useOnlineRoom';
import { useProfileStore } from '../store/profileStore';
import { formatEquippedSummary } from '../scene3d/accessoryCatalog';
import { playSfx } from '../audio/soundEngine';
import { AnimalAvatar } from '../components/AnimalAvatar';

export interface OnlineLobbyScreenProps {
  room: OnlineRoomController;
  initialRoomCode?: string;
  onBackToMenu: () => void;
}

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
  initialRoomCode = '',
  onBackToMenu,
}: OnlineLobbyScreenProps) {
  const { selectedAnimal, equippedAccessory, selectAnimal } = useProfileStore();
  const [displayName, setDisplayName] = useState<string>(() => loadSavedName());
  const [joinCodeInput, setJoinCodeInput] = useState<string>(() =>
    normalizeRoomCode(initialRoomCode),
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [sharedLink, setSharedLink] = useState<boolean>(false);
  const autoJoinedRef = useRef<boolean>(false);

  const myAccessory = equippedAccessory[selectedAnimal] ?? [];
  const nativeShareSupported = canUseNativeShare();
  const myMember = useMemo(
    () => room.members.find((m) => m.peerId === room.myPeerId) ?? null,
    [room.members, room.myPeerId],
  );

  // One-click auto-join when arriving via ?cardsRoom=<CODE> invite link
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
      name: displayName.trim() || 'Người chơi',
      animal: selectedAnimal,
      accessory: myAccessory,
    });
  }, [
    displayName,
    initialRoomCode,
    myAccessory,
    room,
    selectedAnimal,
  ]);

  const saveName = (val: string) => {
    setDisplayName(val);
    if (room.phase === 'lobby') {
      room.updateMyProfile({ name: val.trim() || 'Người chơi' });
    }
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
        accessory: equippedAccessory[animal] ?? [],
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
    if (await copyTextSafe(room.roomCode)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!room.roomCode) return;
    playSfx('click');
    const url = buildRoomInviteUrl('cards', room.roomCode);
    if (await copyTextSafe(url)) {
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
    }
  };

  const handleShareInvite = async () => {
    if (!room.roomCode) return;
    playSfx('click');
    const outcome = await shareRoomInvite({
      kind: 'cards',
      roomCode: room.roomCode,
      title: 'PAWS Cards 3D — Mời vào bàn đấu',
      text: `Vào bàn PAWS Cards Online (${room.roomCode}) chơi bài với mình nhé!`,
    });
    if (outcome === 'shared' || outcome === 'copied') {
      setSharedLink(true);
      window.setTimeout(() => setSharedLink(false), 1800);
    }
  };

  const handleLeave = () => {
    playSfx('click');
    room.leaveRoom();
  };

  // 1. Supabase Not Configured Setup Card
  if (!room.configured) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#1c120c] bg-[radial-gradient(circle_at_50%_0%,_#382419_0%,_#1a0f0a_70%)] p-4 text-white">
        <div className="w-full max-w-xl rounded-3xl border-2 border-amber-900/40 bg-[#29170f] p-6 shadow-2xl sm:p-8">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-950/70 px-3 py-1 text-xs font-black tracking-wide text-sky-300">
              <Globe className="h-3.5 w-3.5 text-sky-400" />
              <span>PAWS Online Multiplayer</span>
            </span>
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onBackToMenu();
              }}
              className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/20 px-3.5 py-1.5 text-xs font-black text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-amber-300" />
              <span>Menu</span>
            </button>
          </div>

          <h1 className="mt-4 text-2xl font-black text-amber-50 sm:text-3xl">
            Cần Cấu Hình Supabase Realtime
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Chế độ chơi Online dùng <strong>Supabase Realtime Free Tier</strong>. Bạn chỉ cần thêm 2 biến môi trường sau vào file{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-amber-200">
              paws-game/.env.local
            </code>
            :
          </p>

          <pre className="mt-4 overflow-x-auto rounded-2xl border border-amber-900/40 bg-black/40 p-4 text-xs font-mono text-emerald-300">
{`VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>`}
          </pre>

          <ol className="mt-4 space-y-2 text-sm text-slate-200">
            <li>
              <strong>Bước 1:</strong> Tạo dự án miễn phí tại{' '}
              <span className="text-sky-300">supabase.com</span>.
            </li>
            <li>
              <strong>Bước 2:</strong> Vào <em>Project Settings → API</em> sao chép URL và Anon Key dán vào <code className="text-amber-200">.env.local</code>.
            </li>
            <li>
              <strong>Bước 3:</strong> Khởi động lại server dev là sẵn sàng chơi Online cùng bạn bè!
            </li>
          </ol>
        </div>
      </div>
    );
  }

  // 2. Idle State: Create or Join Room
  const canJoin = normalizeRoomCode(joinCodeInput).length >= 4;

  if (room.phase === 'idle') {
    return (
      <div className="min-h-dvh bg-[#1c120c] bg-[radial-gradient(circle_at_50%_0%,_#382419_0%,_#1a0f0a_70%)] p-4 text-white sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-950/70 px-3.5 py-1 text-xs font-bold text-sky-200">
                <Globe className="h-3.5 w-3.5 text-sky-400" />
                <span>Winter Cabin · Sảnh Đấu Online</span>
              </div>
              <h1 className="mt-2 font-display text-2xl font-black text-[#FFFBF4] sm:text-3xl">
                Chơi Cùng Bạn Bè Qua Mã Phòng
              </h1>
            </div>
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onBackToMenu();
              }}
              className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-amber-900/40 px-4 py-2 text-xs font-black text-amber-100 shadow-md"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-amber-300" />
              <span>Quay Lại Menu</span>
            </button>
          </div>

          {room.error && (
            <div className="mt-4 rounded-2xl border border-rose-400/50 bg-rose-500/20 px-4 py-3 text-sm font-bold text-rose-100">
              {room.error}
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-5">
            {/* Profile & Animal Picker */}
            <section className="rounded-3xl border-2 border-amber-900/40 bg-[#29170f] p-5 shadow-2xl lg:col-span-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">
                Hồ Sơ &amp; Nhân Vật Đại Diện
              </h2>

              <label className="mt-3 block">
                <span className="text-xs font-bold text-amber-200/80">
                  Tên hiển thị trong phòng
                </span>
                <input
                  type="text"
                  maxLength={18}
                  value={displayName}
                  onChange={(e) => saveName(e.target.value)}
                  placeholder="Nhập tên của bạn..."
                  className="mt-1.5 w-full rounded-2xl border border-amber-900/40 bg-black/30 px-4 py-2.5 text-sm font-bold text-white outline-none transition focus:border-amber-400"
                />
              </label>

              <div className="mt-5">
                <span className="text-xs font-bold text-amber-200/80">
                  Chọn thú bông 3D
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ANIMALS.map((a) => {
                    const active = selectedAnimal === a.id;
                    const eqSummary = formatEquippedSummary(
                      equippedAccessory[a.id],
                    );

                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleSelectAnimal(a.id)}
                        className={`relative flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                          active
                            ? 'btn-tactile-amber border-amber-300'
                            : 'border-amber-900/40 bg-black/25 text-amber-100 hover:bg-white/10'
                        }`}
                      >
                        <AnimalAvatar
                          animal={a.id}
                          size="lg"
                          className={active ? 'ring-amber-950/35' : ''}
                        />
                        <span className={`text-xs font-black ${active ? 'text-[#26160b]' : 'text-white'}`}>
                          {a.name}
                        </span>
                        {eqSummary && (
                          <span
                            title={eqSummary.fullNames.join(', ')}
                            className="absolute top-1.5 right-1.5 rounded-full bg-amber-950/80 px-1 py-0.5 text-[10px] font-bold text-amber-300"
                          >
                            <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Create or Join Actions */}
            <section className="flex flex-col justify-between gap-4 rounded-3xl border-2 border-sky-900/40 bg-[#162234] p-5 shadow-2xl lg:col-span-2">
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-sky-300">
                  Tham Gia Phòng Đấu
                </h2>
                <p className="mt-1.5 text-xs text-sky-100/80">
                  Tạo phòng mới để nhận mã chia sẻ cho bạn bè, hoặc nhập mã phòng để vào ngay!
                </p>

                <button
                  type="button"
                  disabled={room.connectionStatus === 'connecting'}
                  onClick={handleCreateRoom}
                  className="btn-tactile-amber mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-[#26160b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    {room.connectionStatus === 'connecting'
                      ? 'Đang tạo phòng...'
                      : 'Tạo Phòng Mới'}
                  </span>
                </button>
              </div>

              <div className="border-t border-sky-900/40 pt-4">
                <label className="block">
                  <span className="text-xs font-bold text-sky-200/90">
                    Vào phòng bằng mã (5 ký tự)
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
                      className="w-full rounded-2xl border border-sky-900/40 bg-black/40 px-3.5 py-2.5 text-center font-mono text-base font-black tracking-[0.22em] text-amber-300 uppercase outline-none focus:border-sky-400"
                    />
                    <button
                      type="button"
                      disabled={!canJoin}
                      onClick={handleJoinRoom}
                      className="btn-tactile-sky shrink-0 cursor-pointer rounded-2xl px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
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
  const humanCount = room.members.length;
  const maxBotsAllowed = Math.max(0, 8 - humanCount);
  const effectiveBotCount = Math.min(
    Math.max(0, room.roomSettings.botCount ?? 0),
    maxBotsAllowed,
  );
  const totalPlayers = humanCount + effectiveBotCount;
  const canHostStart = room.isHost && totalPlayers >= 2;

  const connectionPill =
    room.connectionStatus === 'connected'
      ? { label: 'Đã kết nối', cls: 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200' }
      : room.connectionStatus === 'connecting'
        ? { label: 'Đang kết nối...', cls: 'border-amber-400/40 bg-amber-500/20 text-amber-200' }
        : { label: 'Mất kết nối', cls: 'border-rose-400/40 bg-rose-500/20 text-rose-200' };

  return (
    <div className="min-h-dvh bg-[#1c120c] bg-[radial-gradient(circle_at_50%_0%,_#382419_0%,_#1a0f0a_70%)] p-4 text-white sm:p-6">
      <div className="mx-auto max-w-5xl">
        {/* Lobby Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-amber-900/40 bg-[#29170f] p-4 shadow-xl">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleLeave}
              className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/20 px-3.5 py-2 text-xs font-black text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-amber-300" />
              <span>Rời Phòng</span>
            </button>

            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-950/70 px-3.5 py-1.5 shadow-md">
              <span className="text-xs font-bold text-amber-300">MÃ PHÒNG:</span>
              <span className="font-mono text-lg font-black tracking-[0.2em] text-white">
                {room.roomCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="btn-tactile-amber inline-flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-black text-slate-950"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-950" />
                    <span>Đã copy mã!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Mã</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-sky-400/50 bg-sky-500/20 px-2.5 py-1 text-xs font-black text-sky-100 transition hover:bg-sky-500/35"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Đã copy link!</span>
                  </>
                ) : (
                  <>
                    <Link2 className="h-3.5 w-3.5 text-sky-300" />
                    <span>Link mời</span>
                  </>
                )}
              </button>
              {nativeShareSupported && (
                <button
                  type="button"
                  onClick={handleShareInvite}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-1 text-xs font-black text-emerald-100 transition hover:bg-emerald-500/35"
                >
                  {sharedLink ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                      <span>Đã gửi</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="h-3.5 w-3.5 text-emerald-300" />
                      <span>Chia sẻ</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${connectionPill.cls}`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            <span>{connectionPill.label}</span>
          </span>
        </div>

        {room.error && (
          <div className="mt-4 rounded-2xl border border-rose-400/50 bg-rose-500/20 px-4 py-3 text-sm font-bold text-rose-100">
            {room.error}
          </div>
        )}

        {/* Quick profile customization inside lobby (useful after 1-click invite join) */}
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-900/40 bg-[#29170f]/95 p-3.5 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-xs font-bold text-amber-200/85 sm:min-w-[230px]">
            <span className="shrink-0">Tên bạn:</span>
            <input
              type="text"
              maxLength={18}
              value={displayName}
              onChange={(e) => saveName(e.target.value)}
              placeholder="Nhập tên..."
              className="w-full rounded-xl border border-amber-400/35 bg-black/35 px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-amber-300"
            />
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {ANIMALS.map((a) => {
              const active = selectedAnimal === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleSelectAnimal(a.id)}
                  className={`inline-flex cursor-pointer items-center gap-1 rounded-xl border px-2 py-1 text-[11px] font-black transition ${
                    active
                      ? 'border-amber-300 bg-amber-400/25 text-white'
                      : 'border-white/10 bg-black/30 text-amber-100/75 hover:border-amber-400/40'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: a.accentHex }}
                  />
                  <span>{a.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* Live Presence Seats */}
          <section className="rounded-3xl border-2 border-amber-900/40 bg-[#29170f] p-5 shadow-xl lg:col-span-3">
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
                <Users className="h-4 w-4 text-amber-400" />
                <span>Người Chơi Trong Phòng ({totalPlayers}/8)</span>
              </h2>
              <span className="text-xs font-bold text-amber-200/70">
                {effectiveBotCount > 0
                  ? `${humanCount} người thật + ${effectiveBotCount} Bot`
                  : `${humanCount} người thật`}
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {room.members.map((member) => {
                const animalMeta =
                  ANIMALS.find((a) => a.id === member.animal) ?? ANIMALS[0];
                const eqSummary = formatEquippedSummary(member.accessory);
                const isMe = member.peerId === room.myPeerId;

                return (
                  <div
                    key={member.peerId}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 shadow-md ${
                      isMe
                        ? 'border-amber-400/50 bg-amber-950/40'
                        : 'border-amber-900/40 bg-black/25'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AnimalAvatar animal={animalMeta.id} size="md" />
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
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/25 px-2 py-0.5 text-[10px] font-black text-amber-200">
                              <Crown className="h-3 w-3 text-amber-300" />
                              <span>Chủ phòng</span>
                            </span>
                          )}
                          {eqSummary && (
                            <span
                              title={eqSummary.fullNames.join(', ')}
                              className="rounded-full bg-white/10 px-1.5 py-0.5 text-xs text-amber-200"
                            >
                              {eqSummary.primaryName}
                              {eqSummary.extraCount > 0
                                ? ` +${eqSummary.extraCount}`
                                : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-amber-200/70">
                          {animalMeta.name} · {animalMeta.personality}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${
                        member.isHost || member.ready
                          ? 'bg-emerald-500/25 text-emerald-200'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {member.isHost || member.ready ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-300" />
                          <span>Sẵn sàng</span>
                        </>
                      ) : (
                        <span>Đang chờ...</span>
                      )}
                    </span>
                  </div>
                );
              })}

              {effectiveBotCount > 0 &&
                Array.from({ length: effectiveBotCount }).map((_, idx) => (
                  <div
                    key={`bot-slot-${idx}`}
                    className="flex items-center justify-between rounded-2xl border border-dashed border-amber-900/50 bg-black/15 px-4 py-3 text-amber-200/70"
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                      <Bot className="h-4 w-4 text-amber-400" />
                      <span>Bot AI #{idx + 1}</span>
                    </span>
                    <span className="text-[11px] font-semibold text-amber-200/50">
                      Tự động tham gia khi bắt đầu
                    </span>
                  </div>
                ))}
            </div>
          </section>

          {/* Host Settings / Guest Ready Panel */}
          <section className="flex flex-col justify-between gap-4 rounded-3xl border-2 border-amber-900/40 bg-[#29170f] p-5 shadow-xl lg:col-span-2">
            {room.isHost ? (
              <div className="space-y-4">
                <h2 className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
                  <Settings className="h-4 w-4 text-amber-400" />
                  <span>Cài Đặt Phòng (Chủ Phòng)</span>
                </h2>

                {/* Explicit Bot Count Control */}
                <div className="space-y-2 rounded-2xl border border-amber-900/40 bg-black/25 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="inline-flex items-center gap-1.5 text-xs font-black text-white">
                        <Bot className="h-3.5 w-3.5 text-amber-400" />
                        <span>Thêm Bot vào phòng</span>
                      </div>
                      <div className="text-[11px] text-amber-200/60">
                        Tối đa 8 người ({humanCount} thật + {effectiveBotCount} Bot)
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={effectiveBotCount <= 0}
                        onClick={() => {
                          playSfx('click');
                          const next = Math.max(0, effectiveBotCount - 1);
                          room.updateRoomSettings({
                            botCount: next,
                            fillWithBots: next > 0,
                          });
                        }}
                        aria-label="Giảm 1 Bot"
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white/10 text-sm font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-black text-amber-300">
                        {effectiveBotCount}
                      </span>
                      <button
                        type="button"
                        disabled={effectiveBotCount >= maxBotsAllowed}
                        onClick={() => {
                          playSfx('click');
                          const next = Math.min(maxBotsAllowed, effectiveBotCount + 1);
                          room.updateRoomSettings({
                            botCount: next,
                            fillWithBots: next > 0,
                          });
                        }}
                        aria-label="Thêm 1 Bot"
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-amber-400 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8 sm:gap-1">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((cnt) => {
                      const disabled = cnt > maxBotsAllowed;
                      const active = effectiveBotCount === cnt;
                      return (
                        <button
                          key={cnt}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            playSfx('click');
                            room.updateRoomSettings({
                              botCount: cnt,
                              fillWithBots: cnt > 0,
                            });
                          }}
                          className={`min-h-[40px] cursor-pointer rounded-lg py-1 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-30 sm:min-h-[32px] ${
                            active
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-white/10 text-slate-200 hover:bg-white/20'
                          }`}
                        >
                          {cnt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bot Difficulty */}
                <div>
                  <span className="text-xs font-bold text-amber-200/80">
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
                            ? 'btn-tactile-amber'
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
                  <span className="text-xs font-bold text-amber-200/80">
                    Bộ bài
                  </span>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {(
                      [
                        ['mvp', 'Cơ bản (6 loại)'],
                        ['full', 'Đầy đủ (11 loại)'],
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
                            ? 'btn-tactile-amber'
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
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-200/80">
                    <Clock className="h-3 w-3 text-amber-400" />
                    <span>Thời gian mỗi lượt</span>
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
                            ? 'btn-tactile-amber'
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
                <h2 className="text-xs font-black uppercase tracking-wider text-sky-300">
                  Thông Tin Phòng
                </h2>
                <div className="space-y-2 rounded-2xl border border-amber-900/40 bg-black/25 p-3.5 text-xs text-slate-200">
                  <div className="flex justify-between">
                    <span className="text-amber-200/70">Tổng người chơi:</span>
                    <strong>{totalPlayers}/8 người</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-200/70">Số Bot thêm:</span>
                    <strong>{effectiveBotCount} Bot</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-200/70">Bộ bài:</span>
                    <strong>
                      {room.roomSettings.deckMode === 'full'
                        ? 'Đầy đủ (11 loại)'
                        : 'Cơ bản (6 loại)'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-200/70">Thời gian lượt:</span>
                    <strong>{room.roomSettings.turnTimeSec} giây</strong>
                  </div>
                </div>
                <p className="text-xs text-amber-200/60">
                  Chờ chủ phòng bấm <strong>Bắt Đầu Trận Đấu</strong> sau khi mọi người đã sẵn sàng!
                </p>
              </div>
            )}

            {/* Primary Start / Ready Action */}
            {room.isHost ? (
              <div className="space-y-2">
                {!canHostStart && (
                  <p className="text-center text-xs font-bold text-amber-300">
                    Cần ít nhất 2 người (mời thêm bạn hoặc tăng số Bot)
                  </p>
                )}
                <button
                  type="button"
                  disabled={!canHostStart}
                  onClick={() => {
                    playSfx('click');
                    room.startOnlineMatch();
                  }}
                  className="btn-tactile-amber inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-black text-[#26160b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play className="h-5 w-5" />
                  <span>Bắt Đầu Trận Đấu 3D</span>
                </button>
              </div>
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
                    : 'btn-tactile-emerald'
                }`}
              >
                {myMember?.ready ? 'Đã Sẵn Sàng (Bấm để hủy)' : 'Sẵn Sàng'}
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
