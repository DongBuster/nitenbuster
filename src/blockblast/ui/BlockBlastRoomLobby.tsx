import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Globe,
  Link2,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { playSfx } from '../../audio/soundEngine.ts';
import { AnimalAvatar } from '../../components/AnimalAvatar';
import { ANIMALS, type AnimalId } from '../../engine/types.ts';
import { normalizeRoomCode } from '../../online/sanitize.ts';
import { formatEquippedSummary } from '../../scene3d/accessoryCatalog.ts';
import { useProfileStore } from '../../store/profileStore.ts';
import { BB_MAX_ROOM_PLAYERS, BB_MIN_START_PLAYERS } from '../online/protocol.ts';
import type { BlockBlastRoomController } from '../online/useBlockBlastRoom.ts';

export interface BlockBlastRoomLobbyProps {
  room: BlockBlastRoomController;
  initialRoomCode?: string;
  onSwitchToSolo: () => void;
  onBackToModeSelect: () => void;
}

const NAME_STORAGE_KEY = 'paws_online_display_name_v1';

const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';

function loadSavedName(): string {
  if (typeof window === 'undefined') return 'Người chơi';
  try {
    return window.localStorage.getItem(NAME_STORAGE_KEY) || 'Người chơi';
  } catch {
    return 'Người chơi';
  }
}

/**
 * Create/Join lobby screen and pre-match waiting room for 2-8 player
 * shared-seed Block Blast PAWS competitions.
 */
export function BlockBlastRoomLobby({
  room,
  initialRoomCode = '',
  onSwitchToSolo,
  onBackToModeSelect,
}: BlockBlastRoomLobbyProps) {
  const { selectedAnimal, equippedAccessory, selectAnimal } = useProfileStore();
  const [displayName, setDisplayName] = useState<string>(() => loadSavedName());
  const [joinCodeInput, setJoinCodeInput] = useState<string>(() =>
    normalizeRoomCode(initialRoomCode),
  );
  const [copiedMode, setCopiedMode] = useState<'code' | 'link' | null>(null);

  const myAccessory = equippedAccessory[selectedAnimal] ?? [];
  const myMember =
    room.members.find((m) => m.peerId === room.myPeerId) ?? null;

  const saveName = (val: string) => {
    setDisplayName(val);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(NAME_STORAGE_KEY, val);
      } catch {
        // Ignore storage errors
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

  const handleCopy = async (mode: 'code' | 'link') => {
    if (!room.roomCode) return;
    playSfx('click');
    const text =
      mode === 'link' && typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?bbRoom=${room.roomCode}`
        : room.roomCode;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMode(mode);
      window.setTimeout(() => setCopiedMode(null), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  if (!room.configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a100b] bg-[radial-gradient(circle_at_50%_0%,_#382419_0%,_#120b08_75%)] p-4 text-[#FFF9F0]">
        <div className="w-full max-w-xl rounded-3xl border-2 border-amber-500/30 bg-[#24150e] p-6 shadow-2xl sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-950/75 px-3 py-1 text-xs font-black text-emerald-200">
              <Globe aria-hidden="true" className="h-3.5 w-3.5 text-emerald-400" />
              <span>Phòng Đấu Block Blast PAWS</span>
            </span>

            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onSwitchToSolo();
              }}
              className={`btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-900/50 px-3.5 py-1.5 text-xs font-black text-amber-100 ${FOCUS_RING_CLASS}`}
            >
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
              <span>Về Chơi Đơn</span>
            </button>
          </div>

          <h1 className="mt-4 font-display text-2xl font-black text-amber-50">
            Cần Cấu Hình Supabase Realtime
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-amber-100/80">
            Phòng đấu so tài điểm Block Blast dùng{' '}
            <strong>Supabase Realtime Free Tier</strong>. Hãy thêm 2 biến môi
            trường vào <code className="rounded bg-white/10 px-1.5 py-0.5 text-amber-200">.env.local</code> rồi khởi động lại server:
          </p>

          <pre className="mt-4 overflow-x-auto rounded-2xl border border-amber-900/45 bg-black/45 p-4 text-xs font-mono text-emerald-300">
{`VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>`}
          </pre>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onSwitchToSolo();
              }}
              className={`btn-tactile-emerald cursor-pointer rounded-2xl px-4 py-2 text-xs font-black text-white ${FOCUS_RING_CLASS}`}
            >
              Chơi Block Blast Solo
            </button>
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onBackToModeSelect();
              }}
              className={`btn-tactile-wood cursor-pointer rounded-2xl border border-amber-900/50 px-4 py-2 text-xs font-black text-amber-100 ${FOCUS_RING_CLASS}`}
            >
              Đổi Chế Độ
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (room.phase === 'idle') {
    const canJoin = normalizeRoomCode(joinCodeInput).length >= 4;

    return (
      <div className="min-h-screen bg-[#1a100b] bg-[radial-gradient(circle_at_18%_0%,_#3a2114_0%,_transparent_46%),radial-gradient(circle_at_82%_0%,_#112c24_0%,_transparent_46%),linear-gradient(180deg,_#1c110c_0%,_#120b08_100%)] p-4 text-[#FFF9F0] sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-950/70 px-3.5 py-1 text-xs font-bold text-emerald-200">
                <Users aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />
                <span>Block Blast PAWS · Phòng So Tài 2–8 Người</span>
              </div>
              <h1 className="mt-2 font-display text-2xl font-black text-[#FFFBF4] sm:text-3xl">
                Đấu Sinh Tồn Chung Seed
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  onSwitchToSolo();
                }}
                className={`btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-amber-900/50 px-3.5 py-2 text-xs font-black text-amber-100 ${FOCUS_RING_CLASS}`}
              >
                <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
                <span>Chơi Solo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  onBackToModeSelect();
                }}
                className={`btn-tactile-wood inline-flex cursor-pointer items-center rounded-2xl border border-amber-900/50 px-3.5 py-2 text-xs font-black text-amber-100 ${FOCUS_RING_CLASS}`}
              >
                Đổi Chế Độ
              </button>
            </div>
          </div>

          <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-950/40 px-3.5 py-2 text-xs font-bold text-emerald-100">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-300" />
            <span>
              Chung Seed · Tối đa 8 người · Không Bom Cứu Nguy Cookies · Chống hack tự động
            </span>
          </div>

          {room.error && (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-rose-400/50 bg-rose-500/20 px-4 py-3 text-sm font-bold text-rose-100"
            >
              {room.error}
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
            {/* Profile & Animal Picker */}
            <section className="rounded-3xl border-2 border-amber-500/25 bg-[#24150e] p-5 shadow-2xl lg:col-span-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">
                Hồ Sơ &amp; Thú Bông Đại Diện
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
                  className={`mt-1.5 w-full rounded-2xl border border-amber-800/60 bg-[#170d08] px-4 py-2.5 text-sm font-bold text-white placeholder:text-amber-200/40 ${FOCUS_RING_CLASS}`}
                />
              </label>

              <div className="mt-4">
                <div className="text-xs font-bold text-amber-200/80">
                  {(() => {
                    const summary = formatEquippedSummary(myAccessory);
                    const suffix = summary
                      ? `${summary.primaryName}${summary.extraCount > 0 ? ` +${summary.extraCount}` : ''}`
                      : 'Mặc định';
                    return `Chọn nhân vật (${suffix})`;
                  })()}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ANIMALS.map((animal) => {
                    const active = animal.id === selectedAnimal;
                    return (
                      <button
                        key={animal.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleSelectAnimal(animal.id)}
                        className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-extrabold transition-all ${FOCUS_RING_CLASS} ${
                          active
                            ? 'border-amber-300 bg-amber-500/20 text-white shadow'
                            : 'border-amber-900/50 bg-[#170d08] text-amber-100/75 hover:border-amber-500/40'
                        }`}
                      >
                        <AnimalAvatar animal={animal.id} size="sm" />
                        <span className="truncate">{animal.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Create or Join */}
            <div className="flex flex-col gap-4 lg:col-span-2">
              <section className="rounded-3xl border-2 border-emerald-400/35 bg-[#12261e] p-5 shadow-2xl">
                <h2 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  Mở Phòng Mới
                </h2>
                <p className="mt-1.5 text-xs text-emerald-100/80">
                  Tạo mã 6 ký tự và gửi cho bạn bè cùng vào đọ điểm trên chung một seed.
                </p>
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  className={`btn-tactile-emerald mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white ${FOCUS_RING_CLASS}`}
                >
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                  <span>Tạo Phòng Mới</span>
                </button>
              </section>

              <section className="rounded-3xl border-2 border-amber-500/30 bg-[#24150e] p-5 shadow-2xl">
                <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Vào Phòng Bằng Mã
                </h2>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(normalizeRoomCode(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canJoin) handleJoinRoom();
                    }}
                    placeholder="VD: AB3K9Z"
                    aria-label="Nhập mã phòng 6 ký tự"
                    className={`min-w-0 flex-1 rounded-2xl border border-amber-800/60 bg-[#170d08] px-3.5 py-2.5 text-center font-mono text-base font-black tracking-widest text-amber-200 uppercase placeholder:text-amber-200/35 ${FOCUS_RING_CLASS}`}
                  />
                  <button
                    type="button"
                    disabled={!canJoin}
                    onClick={handleJoinRoom}
                    className={`btn-tactile-amber shrink-0 cursor-pointer rounded-2xl px-4 py-2.5 text-sm font-black text-[#26160b] disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING_CLASS}`}
                  >
                    Vào Phòng
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lobby waiting room
  const unreadyCount = room.members.filter(
    (m) => m.peerId !== room.hostId && !m.ready,
  ).length;

  return (
    <div className="min-h-screen bg-[#1a100b] bg-[radial-gradient(circle_at_18%_0%,_#3a2114_0%,_transparent_46%),radial-gradient(circle_at_82%_0%,_#112c24_0%,_transparent_46%),linear-gradient(180deg,_#1c110c_0%,_#120b08_100%)] p-4 text-[#FFF9F0] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-amber-500/25 bg-[#24150e]/95 px-5 py-4 shadow-xl">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                Sảnh Chờ Block Blast
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="font-mono text-2xl font-black tracking-widest text-amber-200">
                  {room.roomCode}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopy('code')}
                  className={`inline-flex cursor-pointer items-center gap-1 rounded-xl border border-amber-500/35 bg-[#170d08] px-2.5 py-1 text-xs font-bold text-amber-200 hover:border-amber-300 ${FOCUS_RING_CLASS}`}
                >
                  {copiedMode === 'code' ? (
                    <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedMode === 'code' ? 'Đã chép' : 'Copy Mã'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy('link')}
                  className={`inline-flex cursor-pointer items-center gap-1 rounded-xl border border-sky-400/35 bg-sky-950/60 px-2.5 py-1 text-xs font-bold text-sky-200 hover:border-sky-300 ${FOCUS_RING_CLASS}`}
                >
                  {copiedMode === 'link' ? (
                    <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedMode === 'link' ? 'Đã chép link' : 'Link Mời'}</span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playSfx('click');
              room.leaveRoom();
            }}
            className={`btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-rose-500/40 px-4 py-2 text-xs font-black text-rose-200 ${FOCUS_RING_CLASS}`}
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Rời Phòng</span>
          </button>
        </header>

        {room.error && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-400/50 bg-rose-500/20 px-4 py-3 text-sm font-bold text-rose-100"
          >
            {room.error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Roster */}
          <section className="rounded-3xl border-2 border-amber-500/25 bg-[#24150e] p-5 shadow-2xl lg:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black uppercase tracking-wider text-amber-300">
                Người Chơi ({room.members.length}/{BB_MAX_ROOM_PLAYERS})
              </h2>
              <span className="text-xs font-bold text-amber-200/70">
                {room.connectionStatus === 'connected' ? 'Đã kết nối Realtime' : 'Đang kết nối...'}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {room.members.map((member) => {
                const animalMeta =
                  ANIMALS.find((a) => a.id === member.animal) ?? ANIMALS[0];
                const isHostMember = member.peerId === room.hostId;
                const isSelf = member.peerId === room.myPeerId;

                return (
                  <div
                    key={member.peerId}
                    className={`flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-3 ${
                      isSelf
                        ? 'border-amber-400/60 bg-amber-500/12'
                        : 'border-amber-900/50 bg-[#170d08]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <AnimalAvatar animal={animalMeta.id} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-extrabold text-amber-50">
                            {member.name}
                          </span>
                          {isSelf && (
                            <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-bold text-amber-200/65">
                          {animalMeta.name}
                        </div>
                      </div>
                    </div>

                    {isHostMember ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-yellow-400/50 bg-yellow-500/20 px-2.5 py-1 text-[11px] font-black text-yellow-200">
                        <Crown aria-hidden="true" className="h-3 w-3" />
                        Chủ phòng
                      </span>
                    ) : member.ready ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/45 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-black text-emerald-200">
                        <Check aria-hidden="true" className="h-3 w-3" />
                        Sẵn sàng
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-amber-800/50 bg-black/35 px-2.5 py-1 text-[11px] font-bold text-amber-200/65">
                        Đang chờ
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Controls */}
          <aside className="flex flex-col justify-between gap-4 rounded-3xl border-2 border-emerald-400/30 bg-[#13261f] p-5 shadow-2xl">
            <div className="space-y-2.5">
              <h2 className="text-sm font-black uppercase tracking-wider text-emerald-300">
                Thể Thức Thi Đấu
              </h2>
              <ul className="space-y-1.5 text-xs leading-relaxed text-emerald-100/85">
                <li>• Cùng chơi trên 1 <strong>seed giống nhau</strong>.</li>
                <li>• Không giới hạn giờ, ai trụ lâu điểm cao sẽ thắng.</li>
                <li>• Đấu Pure Skill: tắt Bom 15 Cookies, giữ 1 Đổi Khay.</li>
                <li>• Người xong trước xem trực tiếp bàn 8×8 người còn trụ.</li>
              </ul>
            </div>

            <div className="space-y-2.5 border-t border-emerald-500/20 pt-4">
              {room.isHost ? (
                <>
                  <button
                    type="button"
                    disabled={!room.canStartMatch}
                    onClick={() => {
                      playSfx('click');
                      room.startMatch();
                    }}
                    className={`btn-tactile-emerald inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING_CLASS}`}
                  >
                    <Play aria-hidden="true" className="h-4 w-4" />
                    <span>Bắt Đầu Đấu</span>
                  </button>
                  <p className="text-center text-xs font-bold text-emerald-200/80">
                    {room.members.length < BB_MIN_START_PLAYERS
                      ? `Cần tối thiểu ${BB_MIN_START_PLAYERS} người trong phòng`
                      : unreadyCount > 0
                        ? `Đang chờ ${unreadyCount} người bấm Sẵn sàng`
                        : 'Cả phòng đã sẵn sàng xuất phát!'}
                  </p>
                </>
              ) : (
                <button
                  type="button"
                  aria-pressed={Boolean(myMember?.ready)}
                  onClick={() => {
                    playSfx('click');
                    room.updateMyProfile({ ready: !myMember?.ready });
                  }}
                  className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3.5 text-sm font-black transition-all ${FOCUS_RING_CLASS} ${
                    myMember?.ready
                      ? 'border-emerald-300 bg-emerald-600 text-white shadow-lg'
                      : 'btn-tactile-amber border-amber-300 text-[#26160b]'
                  }`}
                >
                  <Check aria-hidden="true" className="h-4 w-4" />
                  <span>{myMember?.ready ? 'Đã Sẵn Sàng (Nhấn để hủy)' : 'Sẵn Sàng Thi Đấu'}</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
