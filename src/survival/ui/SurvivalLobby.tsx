import { useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  Compass,
  Cookie,
  Copy,
  Crown,
  Flame,
  Infinity as InfinityIcon,
  Keyboard,
  Link2,
  Play,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  Users,
} from 'lucide-react';
import { playSfx } from '../../audio/soundEngine.ts';
import { AnimalAvatar } from '../../components/AnimalAvatar.tsx';
import { ANIMALS, type AnimalId } from '../../engine/types.ts';
import { copyTextSafe, shareRoomInvite } from '../../online/inviteLink.ts';
import { normalizeRoomCode } from '../../online/sanitize.ts';
import type { SurvivalRoomController } from '../online/useSurvivalRoom.ts';
import {
  GEARS,
  WEAPONS,
  getGearSpec,
  getWeaponSpec,
} from '../sim/catalog.ts';
import { SURVIVAL_MAPS, getSurvivalMapMeta } from '../sim/maps.ts';
import type {
  GearId,
  SurvivalMapId,
  SurvivalMode,
  WeaponId,
} from '../sim/types.ts';
import {
  GearArt,
  HeroLoadoutPreview,
  MapArt,
  ModeArt,
  WeaponArt,
} from './SurvivalIcons.tsx';

export interface SurvivalLobbyProps {
  mode: SurvivalMode;
  onModeChange: (mode: SurvivalMode) => void;
  selectedMap: SurvivalMapId;
  onSelectMap: (mapId: SurvivalMapId) => void;
  selectedAnimal: AnimalId;
  onSelectAnimal: (animal: AnimalId) => void;
  selectedWeapon: WeaponId;
  onSelectWeapon: (weapon: WeaponId) => void;
  selectedGear: GearId;
  onSelectGear: (gear: GearId) => void;
  botCount: number;
  onBotCountChange: (count: number) => void;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  cookies: number;
  bestScore: number;
  bestTimeSec: number;
  wins: number;
  room: SurvivalRoomController;
  initialRoomCode?: string;
  onStartOffline: () => void;
  onBackToModeSelect: () => void;
}

const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';

const BOT_TEAM_COUNTS = [1, 2, 3] as const;
const ONLINE_BOT_FILL_OPTIONS = [0, 1, 2, 3] as const;
const STAT_SEGMENTS = [1, 2, 3, 4, 5] as const;

const MODE_TABS: ReadonlyArray<{
  id: SurvivalMode;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'solo',
    label: 'Solo',
    subtitle: '1 thú bông sinh tồn độc lập',
  },
  {
    id: 'bot_team',
    label: 'Team + Bot AI',
    subtitle: 'Cùng 1–3 đồng đội Bot thông minh',
  },
  {
    id: 'online_coop',
    label: 'Phòng Online 2–4p',
    subtitle: 'Lập phòng & chiến đấu thời gian thực',
  },
];

function formatClock(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? Math.floor(sec) : 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function WeaponStatRow({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: number;
  accentColor: string;
}) {
  const clamped = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="font-bold text-slate-300">{label}</span>
      <div
        role="img"
        className="flex items-center gap-1"
        aria-label={`${label}: ${clamped} trên 5`}
      >
        {STAT_SEGMENTS.map((step) => {
          const filled = step <= clamped;
          return (
            <span
              key={step}
              aria-hidden="true"
              className="h-1.5 w-3.5 rounded-full transition-colors motion-reduce:transition-none"
              style={{
                backgroundColor: filled ? accentColor : 'rgba(255,255,255,0.12)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Full pre-match lobby and loadout configurator for PAWS Survival 2D.
 * Supports Solo, Team + Bot AI, and 1-4 player Online Co-op room management,
 * 4 distinct maps (3 Campaign + Endless Abyss), 8 animals, 6 weapons, and 4 gears.
 */
export function SurvivalLobby({
  mode,
  onModeChange,
  selectedMap,
  onSelectMap,
  selectedAnimal,
  onSelectAnimal,
  selectedWeapon,
  onSelectWeapon,
  selectedGear,
  onSelectGear,
  botCount,
  onBotCountChange,
  playerName,
  onPlayerNameChange,
  cookies,
  bestScore,
  bestTimeSec,
  wins,
  room,
  initialRoomCode = '',
  onStartOffline,
  onBackToModeSelect,
}: SurvivalLobbyProps) {
  const [joinCode, setJoinCode] = useState<string>(() =>
    normalizeRoomCode(initialRoomCode),
  );
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState<boolean>(false);

  const offlineNameId = useId();
  const onlineNameId = useId();
  const joinCodeId = useId();
  const feedbackTimerRef = useRef<number | null>(null);
  const codeCopyTimerRef = useRef<number | null>(null);
  const nameSyncTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    const clean = normalizeRoomCode(initialRoomCode);
    if (clean) {
      setJoinCode(clean);
    }
  }, [initialRoomCode]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      if (codeCopyTimerRef.current !== null) {
        window.clearTimeout(codeCopyTimerRef.current);
      }
      if (nameSyncTimerRef.current !== null) {
        window.clearTimeout(nameSyncTimerRef.current);
      }
    };
  }, []);

  const isInOnlineLobby =
    mode === 'online_coop' &&
    room.phase === 'lobby' &&
    room.connectionStatus !== 'error';
  const isOnlineGuest = isInOnlineLobby && !room.isHost;
  const activeMapId = isInOnlineLobby ? room.mapId : selectedMap;
  const activeMapMeta = getSurvivalMapMeta(activeMapId);
  const activeWeaponSpec = getWeaponSpec(selectedWeapon);
  const activeGearSpec = getGearSpec(selectedGear);
  const activeAnimalMeta =
    ANIMALS.find((a) => a.id === selectedAnimal) ?? ANIMALS[0];

  const myMember =
    room.members.find((m) => m.peerId === room.myPeerId) ?? null;
  const allMembersReady =
    room.members.length >= 1 && room.members.every((m) => m.ready);
  const isConnecting = room.connectionStatus === 'connecting';

  const handleSelectModeTab = (nextMode: SurvivalMode) => {
    if (nextMode === mode) return;
    playSfx('click');
    if (mode === 'online_coop' && room.phase !== 'idle') {
      room.leaveRoom();
    }
    onModeChange(nextMode);
  };

  const handleBack = () => {
    playSfx('click');
    if (room.phase !== 'idle') {
      room.leaveRoom();
    }
    onBackToModeSelect();
  };

  const handleNameChange = (nextName: string) => {
    onPlayerNameChange(nextName);
    if (nameSyncTimerRef.current !== null) {
      window.clearTimeout(nameSyncTimerRef.current);
      nameSyncTimerRef.current = null;
    }
    if (isInOnlineLobby) {
      const clean = nextName.trim() || 'Bạn';
      nameSyncTimerRef.current = window.setTimeout(() => {
        nameSyncTimerRef.current = null;
        if (!isMountedRef.current) return;
        room.updateMyLoadout({ name: clean });
      }, 300);
    }
  };

  const handleAnimalSelect = (animal: AnimalId) => {
    playSfx('click');
    onSelectAnimal(animal);
    if (isInOnlineLobby) {
      room.updateMyLoadout({ animal });
    }
  };

  const handleWeaponSelect = (weaponId: WeaponId) => {
    playSfx('click');
    onSelectWeapon(weaponId);
    if (isInOnlineLobby) {
      room.updateMyLoadout({ weaponId });
    }
  };

  const handleGearSelect = (gearId: GearId) => {
    playSfx('click');
    onSelectGear(gearId);
    if (isInOnlineLobby) {
      room.updateMyLoadout({ gearId });
    }
  };

  const handleMapSelect = (mapId: SurvivalMapId) => {
    if (isOnlineGuest) return;
    playSfx('click');
    onSelectMap(mapId);
    if (isInOnlineLobby && room.isHost) {
      room.selectMap(mapId);
    }
  };

  const handleCreateRoom = () => {
    if (isConnecting) return;
    playSfx('click');
    void room.createRoom({
      name: playerName.trim() || 'Bạn',
      animal: selectedAnimal,
      weaponId: selectedWeapon,
      gearId: selectedGear,
    });
  };

  const handleJoinRoom = () => {
    const clean = normalizeRoomCode(joinCode);
    if (clean.length < 4 || isConnecting) return;
    playSfx('click');
    void room.joinRoom(clean, {
      name: playerName.trim() || 'Bạn',
      animal: selectedAnimal,
      weaponId: selectedWeapon,
      gearId: selectedGear,
    });
  };

  const handleShareInvite = async () => {
    if (!room.roomCode) return;
    playSfx('click');
    const outcome = await shareRoomInvite({
      kind: 'survival',
      roomCode: room.roomCode,
      title: 'PAWS Survival — Sinh Tồn 2D',
      text: `Vào phòng PAWS Survival mã ${room.roomCode} chiến đấu cùng mình nhé!`,
    });

    if (!isMountedRef.current || outcome === 'cancelled') return;

    setInviteFeedback(
      outcome === 'shared'
        ? 'Đã chia sẻ!'
        : outcome === 'copied'
          ? 'Đã sao chép!'
          : 'Không thể sao chép',
    );
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      feedbackTimerRef.current = null;
      if (isMountedRef.current) {
        setInviteFeedback(null);
      }
    }, 2000);
  };

  const handleCopyCode = async () => {
    if (!room.roomCode) return;
    playSfx('click');
    const ok = await copyTextSafe(room.roomCode);
    if (!isMountedRef.current || !ok) return;
    setCodeCopied(true);
    if (codeCopyTimerRef.current !== null) {
      window.clearTimeout(codeCopyTimerRef.current);
    }
    codeCopyTimerRef.current = window.setTimeout(() => {
      codeCopyTimerRef.current = null;
      if (isMountedRef.current) {
        setCodeCopied(false);
      }
    }, 1800);
  };

  const cleanJoinCode = normalizeRoomCode(joinCode);
  const canJoinRoom = cleanJoinCode.length >= 4 && !isConnecting;
  const maxBotsAllowed = Math.max(0, 4 - Math.max(1, room.members.length));

  return (
    <div className="min-h-dvh bg-[#121826] bg-[radial-gradient(circle_at_15%_0%,_rgba(251,191,36,0.14)_0%,_transparent_44%),radial-gradient(circle_at_85%_0%,_rgba(56,189,248,0.14)_0%,_transparent_46%),linear-gradient(180deg,_#1c120c_0%,_#121826_48%,_#0b101b_100%)] text-[#FFF9F0] selection:bg-amber-300 selection:text-[#1c120c]">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {/* Top Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-amber-500/25 bg-[#1c120c]/80 px-4 py-3.5 shadow-xl backdrop-blur-md sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className={`btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-amber-400/30 px-3.5 py-2 text-xs font-black text-amber-100 ${FOCUS_RING_CLASS}`}
            >
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
              <span>Đổi Chế Độ</span>
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-950/70 px-3 py-0.5 text-[11px] font-black text-emerald-200">
                <Swords aria-hidden="true" className="h-3 w-3 text-emerald-300" />
                <span>Action Roguelike · 1–4 Thú Bông</span>
              </div>
              <h1 className="mt-1 font-display text-xl font-black tracking-tight text-amber-50 sm:text-2xl">
                PAWS Survival — Sinh Tồn 2D
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-400/35 bg-[#121826]/90 px-3 py-1.5 text-xs font-black text-amber-200 shadow">
              <Cookie aria-hidden="true" className="h-4 w-4 text-amber-400" />
              <span className="tabular-nums">
                {cookies.toLocaleString('vi-VN')} Cookies
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-2xl border border-violet-400/35 bg-[#121826]/90 px-3 py-1.5 text-xs font-black text-violet-200 shadow">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-violet-300" />
              <span className="tabular-nums">
                Kỷ lục điểm: {bestScore.toLocaleString('vi-VN')}
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-2xl border border-cyan-400/30 bg-[#121826]/90 px-3 py-1.5 text-xs font-black text-cyan-200 shadow">
              <Timer aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
              <span className="sr-only">Kỷ lục thời gian: </span>
              <span className="tabular-nums">
                {bestTimeSec > 0 ? formatClock(bestTimeSec) : '--:--'}
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-400/35 bg-[#121826]/90 px-3 py-1.5 text-xs font-black text-emerald-200 shadow">
              <Trophy aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />
              <span className="tabular-nums">
                Chiến thắng: {wins.toLocaleString('vi-VN')}
              </span>
            </div>
          </div>
        </header>

        {/* Mode Selector Tabs & Mode Configuration */}
        <section
          aria-label="Chọn chế độ chơi Survival"
          className="rounded-3xl border border-amber-500/25 bg-[#151c2c]/95 p-4 shadow-xl sm:p-5"
        >
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {MODE_TABS.map((tab) => {
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSelectModeTab(tab.id)}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                    active
                      ? 'border-amber-300 bg-gradient-to-br from-amber-500/20 to-[#1c120c] text-white shadow-[0_0_20px_rgba(251,191,36,0.18)]'
                      : 'border-white/10 bg-[#0d1320] text-slate-300 hover:border-amber-400/40'
                  }`}
                >
                  <span
                    className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border shadow-inner ${
                      active
                        ? 'border-amber-300/60 bg-amber-400/15'
                        : 'border-white/10 bg-[#080d18]'
                    }`}
                  >
                    <ModeArt mode={tab.id} className="h-11 w-11" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-sm font-black text-white">
                      {tab.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-bold text-slate-300/85">
                      {tab.subtitle}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mode-specific Controls */}
          {mode === 'solo' && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0d1320]/90 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-bold text-slate-300">
                Chế độ <strong className="text-amber-200">Solo</strong>: Tự mình
                chống chọi làn sóng quái vật, tự do chọn bản đồ và trang bị bên dưới.
              </div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor={offlineNameId}
                  className="shrink-0 text-xs font-black text-slate-300"
                >
                  Tên:
                </label>
                <input
                  id={offlineNameId}
                  type="text"
                  maxLength={18}
                  value={playerName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Tên người chơi..."
                  className={`w-44 rounded-xl border border-amber-400/30 bg-[#121826] px-3 py-1.5 text-xs font-bold text-white placeholder:text-slate-400 ${FOCUS_RING_CLASS}`}
                />
              </div>
            </div>
          )}

          {mode === 'bot_team' && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-400/25 bg-[#0d1320]/90 p-3.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-black uppercase tracking-wide text-emerald-300">
                  Số đồng đội Bot AI:
                </span>
                <div className="flex flex-wrap gap-2">
                  {BOT_TEAM_COUNTS.map((count) => {
                    const active = botCount === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          playSfx('click');
                          onBotCountChange(count);
                        }}
                        className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-black transition-colors motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                          active
                            ? 'border-emerald-300 bg-emerald-500/25 text-emerald-100 shadow'
                            : 'border-white/10 bg-[#141c2d] text-slate-300 hover:border-emerald-400/45'
                        }`}
                      >
                        {count} Bot (Đội {count + 1} thú bông)
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor={offlineNameId}
                  className="shrink-0 text-xs font-black text-slate-300"
                >
                  Tên bạn:
                </label>
                <input
                  id={offlineNameId}
                  type="text"
                  maxLength={18}
                  value={playerName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Tên người chơi..."
                  className={`w-44 rounded-xl border border-emerald-400/30 bg-[#121826] px-3 py-1.5 text-xs font-bold text-white placeholder:text-slate-400 ${FOCUS_RING_CLASS}`}
                />
              </div>
            </div>
          )}

          {mode === 'online_coop' && (
            <div className="mt-4 space-y-4">
              {!room.isConfigured ? (
                <div
                  role="alert"
                  className="rounded-2xl border-2 border-amber-400/45 bg-[#1c120c]/90 p-4 text-sm"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
                    />
                    <div className="space-y-2">
                      <div className="font-display text-base font-black text-amber-100">
                        Supabase Realtime chưa được cấu hình
                      </div>
                      <p className="text-xs leading-relaxed text-amber-100/85">
                        Chế độ <strong>Phòng Online 2–4p</strong> cần{' '}
                        <code className="rounded bg-black/40 px-1.5 py-0.5 text-amber-200">
                          VITE_SUPABASE_URL
                        </code>{' '}
                        và{' '}
                        <code className="rounded bg-black/40 px-1.5 py-0.5 text-amber-200">
                          VITE_SUPABASE_ANON_KEY
                        </code>{' '}
                        trong{' '}
                        <code className="rounded bg-black/40 px-1.5 py-0.5 text-amber-200">
                          .env.local
                        </code>{' '}
                        (xem{' '}
                        <code className="rounded bg-black/40 px-1.5 py-0.5 text-amber-200">
                          SUPABASE_SETUP.md
                        </code>
                        ). Bạn có thể chơi ngay chế độ <strong>Solo</strong> hoặc{' '}
                        <strong>Team + Bot AI</strong> mà không cần mạng!
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSelectModeTab('solo')}
                          className={`btn-tactile-amber cursor-pointer rounded-xl px-3.5 py-2 text-xs font-black ${FOCUS_RING_CLASS}`}
                        >
                          Chơi Solo Ngay
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectModeTab('bot_team')}
                          className={`btn-tactile-emerald cursor-pointer rounded-xl px-3.5 py-2 text-xs font-black ${FOCUS_RING_CLASS}`}
                        >
                          Chơi Team + Bot AI
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : room.phase === 'idle' || room.connectionStatus === 'error' ? (
                <div className="space-y-3 rounded-2xl border border-sky-400/25 bg-[#0d1320]/95 p-4">
                  {room.error && (
                    <div
                      role="alert"
                      className="rounded-xl border border-rose-400/50 bg-rose-500/20 px-3.5 py-2.5 text-xs font-bold text-rose-100"
                    >
                      {room.error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                    <div className="md:col-span-4">
                      <label
                        htmlFor={onlineNameId}
                        className="block text-xs font-black text-slate-200"
                      >
                        Tên người chơi
                      </label>
                      <input
                        id={onlineNameId}
                        type="text"
                        maxLength={18}
                        value={playerName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Nhập tên của bạn..."
                        className={`mt-1.5 w-full rounded-2xl border border-sky-400/35 bg-[#121826] px-3.5 py-2.5 text-sm font-bold text-white placeholder:text-slate-400 ${FOCUS_RING_CLASS}`}
                      />
                    </div>

                    <div className="flex flex-col justify-end md:col-span-3">
                      <button
                        type="button"
                        disabled={isConnecting}
                        onClick={handleCreateRoom}
                        className={`btn-tactile-sky inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
                      >
                        <Sparkles aria-hidden="true" className="h-4 w-4" />
                        <span>Tạo Phòng Co-op</span>
                      </button>
                    </div>

                    <div className="md:col-span-5">
                      <label
                        htmlFor={joinCodeId}
                        className="block text-xs font-black text-amber-200"
                      >
                        Hoặc nhập mã phòng 6 ký tự
                      </label>
                      <div className="mt-1.5 flex gap-2">
                        <input
                          id={joinCodeId}
                          type="text"
                          maxLength={6}
                          value={joinCode}
                          onChange={(e) =>
                            setJoinCode(normalizeRoomCode(e.target.value))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && canJoinRoom) {
                              handleJoinRoom();
                            }
                          }}
                          placeholder="VD: AB3K9Z"
                          className={`min-w-0 flex-1 rounded-2xl border border-amber-400/35 bg-[#121826] px-3 py-2 text-center font-mono text-base font-black tracking-widest text-amber-200 uppercase placeholder:text-slate-400 ${FOCUS_RING_CLASS}`}
                        />
                        <button
                          type="button"
                          disabled={!canJoinRoom}
                          onClick={handleJoinRoom}
                          className={`btn-tactile-amber shrink-0 cursor-pointer rounded-2xl px-4 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING_CLASS}`}
                        >
                          Vào Phòng
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Online Co-op Waiting Room (phase === 'lobby') */
                <div className="space-y-4 rounded-2xl border border-sky-400/35 bg-[#0d1320]/95 p-4">
                  {/* Room Code & Invite Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-sky-300">
                          Mã Phòng Co-op
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="rounded-xl border border-amber-400/45 bg-[#1c120c] px-3.5 py-1 font-mono text-2xl font-black tracking-widest text-amber-200">
                            {room.roomCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleCopyCode()}
                            aria-label={codeCopied ? 'Đã sao chép mã phòng' : 'Sao chép mã phòng'}
                            className={`inline-flex cursor-pointer items-center gap-1 rounded-xl border border-amber-400/35 bg-[#141c2d] px-2.5 py-1.5 text-xs font-bold text-amber-200 hover:border-amber-300 ${FOCUS_RING_CLASS}`}
                          >
                            {codeCopied ? (
                              <Check
                                aria-hidden="true"
                                className="h-3.5 w-3.5 text-emerald-300"
                              />
                            ) : (
                              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                            )}
                            <span>{codeCopied ? 'Đã chép mã' : 'Chép mã'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleShareInvite()}
                            className={`btn-tactile-sky inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black ${FOCUS_RING_CLASS}`}
                          >
                            {inviteFeedback === 'Đã sao chép!' ||
                            inviteFeedback === 'Đã chia sẻ!' ? (
                              <Check aria-hidden="true" className="h-3.5 w-3.5" />
                            ) : (
                              <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
                            )}
                            <span>
                              {inviteFeedback ?? 'Sao chép Link mời'}
                            </span>
                          </button>
                        </div>
                      </div>

                      <span className="rounded-full border border-white/15 bg-[#141c2d] px-2.5 py-1 text-[11px] font-bold text-slate-300">
                        {room.connectionStatus === 'connected'
                          ? 'Đã kết nối Realtime'
                          : 'Đang đồng bộ...'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        playSfx('click');
                        room.leaveRoom();
                      }}
                      className={`btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-rose-500/45 px-3.5 py-2 text-xs font-black text-rose-200 ${FOCUS_RING_CLASS}`}
                    >
                      <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>Rời Phòng</span>
                    </button>
                  </div>

                  {room.error && (
                    <div
                      role="alert"
                      className="rounded-xl border border-rose-400/50 bg-rose-500/20 px-3.5 py-2 text-xs font-bold text-rose-100"
                    >
                      {room.error}
                    </div>
                  )}

                  {/* 1-4 Room Members Grid */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-sky-300">
                        <Users aria-hidden="true" className="h-3.5 w-3.5" />
                        <span>
                          Thành Viên Trong Phòng ({room.members.length}/4 người
                          {room.botFillCount > 0
                            ? ` + ${room.botFillCount} Bot`
                            : ''}
                          )
                        </span>
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                      {room.members.map((member) => {
                        const mWeapon = getWeaponSpec(member.weaponId);
                        const mGear = getGearSpec(member.gearId);
                        const isSelf = member.peerId === room.myPeerId;

                        return (
                          <div
                            key={member.peerId}
                            className={`flex flex-col justify-between rounded-2xl border-2 p-3 ${
                              member.isHost
                                ? 'border-amber-400/55 bg-gradient-to-b from-amber-500/12 to-[#121826]'
                                : 'border-sky-400/40 bg-gradient-to-b from-sky-500/10 to-[#121826]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <AnimalAvatar animal={member.animal} size="md" />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1">
                                    <span className="truncate text-sm font-black text-white">
                                      {member.name}
                                    </span>
                                    {isSelf && (
                                      <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-black text-amber-200">
                                        Bạn
                                      </span>
                                    )}
                                  </div>
                                  {member.isHost && (
                                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-200">
                                      <Crown
                                        aria-hidden="true"
                                        className="h-2.5 w-2.5"
                                      />
                                      <span>Chủ phòng</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="mt-2.5 flex flex-wrap gap-1 text-[10px] font-black">
                              <span
                                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5"
                                style={{
                                  borderColor: `${mWeapon.color}66`,
                                  backgroundColor: `${mWeapon.color}1f`,
                                  color: mWeapon.color,
                                }}
                              >
                                <WeaponArt
                                  weaponId={member.weaponId}
                                  className="h-3.5 w-3.5 shrink-0"
                                />
                                <span>{mWeapon.shortName}</span>
                              </span>
                              <span
                                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5"
                                style={{
                                  borderColor: `${mGear.color}66`,
                                  backgroundColor: `${mGear.color}1f`,
                                  color: mGear.color,
                                }}
                              >
                                <GearArt
                                  gearId={member.gearId}
                                  className="h-3.5 w-3.5 shrink-0"
                                />
                                <span>{mGear.name}</span>
                              </span>
                            </div>

                            <div className="mt-2.5 border-t border-white/10 pt-2">
                              {member.ready ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-black text-emerald-200">
                                  <Check aria-hidden="true" className="h-3 w-3" />
                                  <span>Sẵn sàng</span>
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full border border-slate-500/40 bg-slate-900/80 px-2.5 py-0.5 text-[11px] font-bold text-slate-300">
                                  Chưa sẵn sàng
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bot Fill Selector + Ready / Start Controls */}
                  <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#121826]/90 p-3.5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-300">
                        <Bot aria-hidden="true" className="h-4 w-4" />
                        <span>Bot AI điền thêm:</span>
                      </span>

                      {room.isHost ? (
                        <div className="flex flex-wrap gap-1.5">
                          {ONLINE_BOT_FILL_OPTIONS.map((count) => {
                            const active = room.botFillCount === count;
                            const disabled = count > maxBotsAllowed;
                            return (
                              <button
                                key={count}
                                type="button"
                                disabled={disabled}
                                aria-pressed={active}
                                onClick={() => {
                                  playSfx('click');
                                  room.setBotFillCount(count);
                                }}
                                className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                                  active
                                    ? 'border-emerald-300 bg-emerald-500/25 text-emerald-100'
                                    : 'border-white/15 bg-[#0b111d] text-slate-300 hover:border-emerald-400/45'
                                }`}
                              >
                                {count} Bot
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="rounded-xl border border-white/10 bg-[#0b111d] px-3 py-1 text-xs font-bold text-slate-200">
                          {room.botFillCount} Bot (Chủ phòng chỉnh)
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {!room.isHost ? (
                        <button
                          type="button"
                          disabled={room.connectionStatus !== 'connected'}
                          aria-pressed={Boolean(myMember?.ready)}
                          onClick={() => {
                            playSfx('click');
                            room.toggleReady();
                          }}
                          className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-5 py-2.5 text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                            myMember?.ready
                              ? 'border-emerald-300 bg-emerald-600/90 text-white hover:bg-emerald-600'
                              : 'btn-tactile-amber border-amber-300'
                          }`}
                        >
                          <Check aria-hidden="true" className="h-4 w-4" />
                          <span>
                            {myMember?.ready ? 'Hủy Sẵn Sàng' : 'Sẵn Sàng'}
                          </span>
                        </button>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2.5">
                          {!allMembersReady && (
                            <span className="text-xs font-bold text-amber-200/85">
                              Đang chờ đồng đội bấm Sẵn Sàng...
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={
                              !allMembersReady ||
                              room.connectionStatus !== 'connected'
                            }
                            onClick={() => {
                              playSfx('roundStart');
                              room.startMatch();
                            }}
                            className={`btn-tactile-emerald inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING_CLASS}`}
                          >
                            <Play aria-hidden="true" className="h-4 w-4" />
                            <span>Bắt Đầu Sinh Tồn</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 4 Maps Selection */}
        <section
          aria-label="Chọn bản đồ sinh tồn"
          className="rounded-3xl border border-amber-500/25 bg-[#151c2c]/95 p-4 shadow-xl sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Compass aria-hidden="true" className="h-4 w-4 text-amber-300" />
              <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">
                Chọn Bản Đồ (3 Chiến Dịch Hạ Boss &amp; 1 Đấu Trường Vô Cực)
              </h2>
            </div>

            {isInOnlineLobby && (
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black ${
                  room.isHost
                    ? 'border-amber-400/45 bg-amber-400/15 text-amber-200'
                    : 'border-sky-400/35 bg-sky-950/70 text-sky-200'
                }`}
              >
                {room.isHost ? 'Chủ phòng chọn bản đồ' : 'Chủ phòng chọn'}
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SURVIVAL_MAPS.map((map) => {
              const isSelected = activeMapId === map.id;
              const isEndless = map.isEndless;

              const cardContent = (
                <>
                  {/* Top Biome Illustration Header */}
                  <span className="relative block w-full overflow-hidden border-b border-white/10 bg-[#080d18]">
                    <MapArt
                      mapId={map.id}
                      className="block aspect-[2/1] w-full transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0d1320] via-[#0d1320]/45 to-transparent"
                    />
                    <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                      {isEndless ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300/75 bg-[#190c22]/85 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-200 backdrop-blur-sm">
                          <InfinityIcon aria-hidden="true" className="h-3 w-3" />
                          <span>VÔ TẬN</span>
                        </span>
                      ) : (
                        <span
                          className="rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide backdrop-blur-sm"
                          style={{
                            borderColor: `${map.theme.accent}88`,
                            backgroundColor: 'rgba(11, 16, 28, 0.82)',
                            color: map.theme.accent,
                          }}
                        >
                          Chiến dịch · 3 Boss
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg border border-amber-300/80 bg-amber-400 px-2 py-0.5 text-[10px] font-black text-[#24130a] shadow">
                        <Check aria-hidden="true" className="h-3 w-3" />
                        <span>
                          {isOnlineGuest ? 'Chủ phòng' : 'Đang chọn'}
                        </span>
                      </span>
                    )}
                  </span>

                  {/* Card Body */}
                  <span className="flex flex-1 flex-col justify-between p-3.5">
                    <span className="block">
                      <span className="block font-display text-base font-black text-white">
                        {map.name}
                      </span>
                      <span className="mt-1 block text-xs leading-snug text-slate-300">
                        {map.description}
                      </span>
                    </span>

                    <span className="mt-3 block space-y-2 border-t border-white/10 pt-2.5">
                      <span className="block text-[11px] font-bold text-cyan-200/90">
                        {map.mechanicSummary}
                      </span>

                      <span className="flex items-center justify-between text-[11px] font-black">
                        {isEndless ? (
                          <span className="inline-flex items-center gap-1 text-amber-200 tabular-nums">
                            <Trophy
                              aria-hidden="true"
                              className="h-3.5 w-3.5 text-amber-300"
                            />
                            <span>
                              Kỷ lục: {bestScore.toLocaleString('vi-VN')}đ
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-200/90">
                            <Skull
                              aria-hidden="true"
                              className="h-3.5 w-3.5 text-rose-300"
                            />
                            <span>Hạ 3 Boss · Diệt Rồng Tuyết</span>
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                </>
              );

              const baseClass = `group flex h-full flex-col overflow-hidden rounded-2xl border-2 text-left transition-all motion-reduce:transition-none ${
                isSelected
                  ? isEndless
                    ? 'border-amber-300 bg-gradient-to-b from-violet-950/60 via-[#1c1220] to-[#121826] shadow-[0_0_24px_rgba(251,191,36,0.24)]'
                    : 'border-amber-300 bg-gradient-to-b from-amber-500/16 to-[#0f1624] shadow-[0_0_22px_rgba(251,191,36,0.2)]'
                  : isEndless
                    ? 'border-violet-400/35 bg-gradient-to-b from-violet-950/30 to-[#0d1320]'
                    : 'border-white/10 bg-[#0d1320]/90'
              }`;

              if (isOnlineGuest) {
                return (
                  <button
                    key={map.id}
                    type="button"
                    disabled
                    aria-pressed={isSelected}
                    className={`${baseClass} cursor-default opacity-95`}
                  >
                    {cardContent}
                  </button>
                );
              }

              return (
                <button
                  key={map.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleMapSelect(map.id)}
                  className={`${baseClass} cursor-pointer hover:border-amber-300/75 ${FOCUS_RING_CLASS}`}
                >
                  {cardContent}
                </button>
              );
            })}
          </div>
        </section>

        {/* Loadout: Animals (8), Weapons (6), Gears (4) */}
        <div className="space-y-5">
          {/* 8 Plush Animals */}
          <section
            aria-label="Chọn nhân vật thú bông"
            className="rounded-3xl border border-amber-500/25 bg-[#151c2c]/95 p-4 shadow-xl sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">
                1. Chọn Nhân Vật Thú Bông (Mở Sẵn 8/8)
              </h2>
              <span className="text-xs font-bold text-slate-300">
                Đang chọn:{' '}
                <strong className="text-amber-200">
                  {activeAnimalMeta.name}
                </strong>
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <HeroLoadoutPreview
                  animal={selectedAnimal}
                  weaponId={selectedWeapon}
                  gearId={selectedGear}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:col-span-8">
                {ANIMALS.map((animal) => {
                  const active = selectedAnimal === animal.id;
                  return (
                    <button
                      key={animal.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleAnimalSelect(animal.id)}
                      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2.5 py-3 text-center transition-all motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                        active
                          ? 'border-amber-300 bg-amber-500/20 text-white shadow-[0_0_16px_rgba(251,191,36,0.2)]'
                          : 'border-white/10 bg-[#0d1320] text-slate-300 hover:border-amber-400/45'
                      }`}
                    >
                      <AnimalAvatar animal={animal.id} size="md" />
                      <span className="max-w-full truncate text-xs font-black">
                        {animal.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 6 Primary Weapons */}
          <section
            aria-label="Chọn vũ khí chính"
            className="rounded-3xl border border-amber-500/25 bg-[#151c2c]/95 p-4 shadow-xl sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-rose-300">
                <Swords aria-hidden="true" className="h-4 w-4" />
                <span>2. Chọn Vũ Khí Chính (6 Vũ Khí)</span>
              </h2>
              <span className="text-xs font-bold text-slate-300">
                Đang chọn:{' '}
                <strong style={{ color: activeWeaponSpec.color }}>
                  {activeWeaponSpec.name}
                </strong>
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {WEAPONS.map((weapon) => {
                const active = selectedWeapon === weapon.id;
                return (
                  <button
                    key={weapon.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleWeaponSelect(weapon.id)}
                    className={`flex h-full cursor-pointer flex-col justify-between rounded-2xl border-2 p-3.5 text-left transition-all motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                      active
                        ? 'border-amber-300 bg-[#1c1412] shadow-[0_0_20px_rgba(251,191,36,0.2)]'
                        : 'border-white/10 bg-[#0d1320]/90 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border shadow-inner"
                        style={{
                          borderColor: `${weapon.color}66`,
                          background: `radial-gradient(circle at 50% 40%, ${weapon.color}2b 0%, rgba(11,16,28,0.95) 75%)`,
                        }}
                      >
                        <WeaponArt
                          weaponId={weapon.id}
                          className="h-14 w-14"
                        />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="block font-display text-sm font-black leading-snug text-white">
                            {weapon.name}
                          </span>
                          {active && (
                            <span className="shrink-0 rounded-md bg-amber-400/25 px-1.5 py-0.5 text-[10px] font-black text-amber-200">
                              Đang dùng
                            </span>
                          )}
                        </div>

                        <span className="mt-1 block text-xs leading-snug text-slate-300">
                          {weapon.description}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5">
                      <WeaponStatRow
                        label="Sát thương"
                        value={weapon.statBars.damage}
                        accentColor={weapon.color}
                      />
                      <WeaponStatRow
                        label="Tốc bắn"
                        value={weapon.statBars.speed}
                        accentColor={weapon.color}
                      />
                      <WeaponStatRow
                        label="Dọn đàn"
                        value={weapon.statBars.crowd}
                        accentColor={weapon.color}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 4 Support Gears */}
          <section
            aria-label="Chọn trang bị hỗ trợ"
            className="rounded-3xl border border-amber-500/25 bg-[#151c2c]/95 p-4 shadow-xl sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-cyan-300">
                <Shield aria-hidden="true" className="h-4 w-4" />
                <span>3. Chọn Trang Bị Hỗ Trợ (4 Trang Bị)</span>
              </h2>
              <span className="text-xs font-bold text-slate-300">
                Đang chọn:{' '}
                <strong style={{ color: activeGearSpec.color }}>
                  {activeGearSpec.name}
                </strong>
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {GEARS.map((gear) => {
                const active = selectedGear === gear.id;
                return (
                  <button
                    key={gear.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleGearSelect(gear.id)}
                    className={`flex h-full cursor-pointer flex-col justify-between rounded-2xl border-2 p-3.5 text-left transition-all motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                      active
                        ? 'border-cyan-300 bg-[#111c2c] shadow-[0_0_20px_rgba(34,211,238,0.18)]'
                        : 'border-white/10 bg-[#0d1320]/90 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-inner"
                        style={{
                          borderColor: `${gear.color}66`,
                          background: `radial-gradient(circle at 50% 40%, ${gear.color}2b 0%, rgba(11,16,28,0.95) 75%)`,
                        }}
                      >
                        <GearArt gearId={gear.id} className="h-12 w-12" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <span className="block font-display text-sm font-black leading-snug text-white">
                            {gear.name}
                          </span>
                          {active && (
                            <span className="shrink-0 rounded-md bg-cyan-400/25 px-1.5 py-0.5 text-[10px] font-black text-cyan-200">
                              Đang đeo
                            </span>
                          )}
                        </div>

                        <span
                          className="mt-1 inline-block rounded-lg border px-2 py-0.5 text-[10px] font-black"
                          style={{
                            borderColor: `${gear.color}66`,
                            backgroundColor: `${gear.color}1f`,
                            color: gear.color,
                          }}
                        >
                          {gear.badge}
                        </span>
                      </div>
                    </div>

                    <span className="mt-2.5 block text-xs leading-snug text-slate-300">
                      {gear.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Bottom Primary CTA & Loadout Summary */}
        <section className="flex flex-col justify-between gap-4 rounded-3xl border-2 border-amber-400/40 bg-gradient-to-r from-[#1c120c] via-[#171d2c] to-[#121826] p-4 shadow-2xl sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-3">
            <AnimalAvatar animal={selectedAnimal} size="md" />
            <div className="space-y-1">
              <div className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                Đội Hình Xuất Phát
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-black text-white">
                <span>{activeMapMeta.name}</span>
                <span aria-hidden="true" className="text-slate-500">
                  ·
                </span>
                <span className="text-amber-200">{activeAnimalMeta.name}</span>
                <span aria-hidden="true" className="text-slate-500">
                  ·
                </span>
                <span
                  className="inline-flex items-center gap-1"
                  style={{ color: activeWeaponSpec.color }}
                >
                  <WeaponArt
                    weaponId={selectedWeapon}
                    className="h-4 w-4 shrink-0"
                  />
                  <span>{activeWeaponSpec.shortName}</span>
                </span>
                <span aria-hidden="true" className="text-slate-500">
                  ·
                </span>
                <span
                  className="inline-flex items-center gap-1"
                  style={{ color: activeGearSpec.color }}
                >
                  <GearArt
                    gearId={selectedGear}
                    className="h-4 w-4 shrink-0"
                  />
                  <span>{activeGearSpec.name}</span>
                </span>
              </div>
            </div>
          </div>

          {mode !== 'online_coop' ? (
            <button
              type="button"
              onClick={() => {
                playSfx('roundStart');
                onStartOffline();
              }}
              className={`btn-tactile-amber inline-flex min-h-[50px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl px-7 py-3 text-base font-black ${FOCUS_RING_CLASS}`}
            >
              <Flame aria-hidden="true" className="h-5 w-5" />
              <span>Bắt Đầu Sinh Tồn</span>
            </button>
          ) : isInOnlineLobby ? (
            room.isHost ? (
              <button
                type="button"
                disabled={
                  !allMembersReady || room.connectionStatus !== 'connected'
                }
                onClick={() => {
                  playSfx('roundStart');
                  room.startMatch();
                }}
                className={`btn-tactile-emerald inline-flex min-h-[50px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl px-7 py-3 text-base font-black disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING_CLASS}`}
              >
                <Play aria-hidden="true" className="h-5 w-5" />
                <span>Bắt Đầu Sinh Tồn</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={room.connectionStatus !== 'connected'}
                aria-pressed={Boolean(myMember?.ready)}
                onClick={() => {
                  playSfx('click');
                  room.toggleReady();
                }}
                className={`inline-flex min-h-[50px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-6 py-3 text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                  myMember?.ready
                    ? 'border-emerald-300 bg-emerald-600/90 text-white hover:bg-emerald-600'
                    : 'btn-tactile-amber border-amber-300'
                }`}
              >
                <Check aria-hidden="true" className="h-4 w-4" />
                <span>{myMember?.ready ? 'Hủy Sẵn Sàng' : 'Sẵn Sàng'}</span>
              </button>
            )
          ) : (
            <div className="rounded-2xl border border-sky-400/35 bg-[#0d1320] px-4 py-2.5 text-xs font-bold text-sky-200">
              {room.isConfigured
                ? 'Hãy Tạo Phòng hoặc Nhập Mã ở phía trên để vào Sảnh Co-op.'
                : 'Chọn Solo hoặc Team + Bot AI để chơi ngay.'}
            </div>
          )}
        </section>

        {/* Compact Controls Hint Bar */}
        <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 rounded-2xl border border-white/10 bg-[#0b101b]/90 px-4 py-2.5 text-center text-xs font-bold text-slate-300">
          <Keyboard aria-hidden="true" className="h-4 w-4 text-amber-300" />
          <span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-amber-200">
              WASD / Mũi tên
            </kbd>
            : Di chuyển
          </span>
          <span aria-hidden="true" className="text-slate-500">
            ·
          </span>
          <span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">
              Space
            </kbd>
            : Lướt né
          </span>
          <span aria-hidden="true" className="text-slate-500">
            ·
          </span>
          <span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-emerald-200">
              Q / Giữ chuột trái
            </kbd>
            : Ngắm thủ công
          </span>
          <span aria-hidden="true" className="text-slate-500">
            ·
          </span>
          <span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-rose-200">
              1-2-3
            </kbd>
            : Chọn kỹ năng
          </span>
        </footer>
      </div>
    </div>
  );
}
