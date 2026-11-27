import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  Compass,
  Copy,
  Crown,
  Globe,
  Link2,
  Lock,
  Play,
  Sparkles,
  Star,
  Timer,
  Users,
} from 'lucide-react';
import { playSfx } from '../../audio/soundEngine';
import { AnimalAvatar } from '../../components/AnimalAvatar';
import {
  COOP_MAPS,
  MAX_COOP_STARS,
  buildUnlockedByPackMap,
  countCoopActionStars,
  countCoopPackStars,
  countTotalCoopLevelStars,
  getCoopLevelMeta,
  getCoopMapMeta,
  getCoopMapPack,
  getDefaultMapPackId,
  isCoopLevelUnlocked,
  type CoopLevelNumber,
  type CoopMapId,
  type CoopMapRecord,
} from '../../coop/maps/registry';
import { ANIMALS, type AnimalId } from '../../engine/types';
import { buildRoomInviteUrl, copyTextSafe } from '../../online/inviteLink';
import { normalizeRoomCode } from '../../online/sanitize';
import { formatEquippedSummary } from '../../scene3d/accessoryCatalog';
import { useProfileStore } from '../../store/profileStore';
import type { GlassRoomMember } from '../online/protocol';
import type { GlassRoomController } from '../online/useGlassRoom';

export interface GlassLobbyProps {
  room: GlassRoomController;
  initialRoomCode?: string;
  onBackToModeSelect: () => void;
}

const NAME_STORAGE_KEY = 'paws_online_display_name_v1';

const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300';

function loadSavedName(): string {
  if (typeof window === 'undefined') return 'Người chơi';
  try {
    return window.localStorage.getItem(NAME_STORAGE_KEY) || 'Người chơi';
  } catch {
    return 'Người chơi';
  }
}

function formatBestTime(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const totalHundredths = Math.round(safe * 100);
  const hundredths = totalHundredths % 100;
  const totalSeconds = Math.floor(totalHundredths / 100);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

function renderSlotCard(
  slot: 'p1' | 'p2',
  member: GlassRoomMember | null,
  myPeerId: string,
  isConnecting: boolean,
) {
  const isHostSlot = slot === 'p1';
  const isSelf = member !== null && member.peerId === myPeerId;
  const animalMeta = member
    ? (ANIMALS.find((a) => a.id === member.animal) ?? ANIMALS[0])
    : null;
  const accessorySummary = member
    ? formatEquippedSummary(member.accessory)
    : null;

  const containerClass = isHostSlot
    ? 'border-amber-400/50 bg-gradient-to-b from-amber-500/12 to-[#0e1827]'
    : 'border-cyan-400/45 bg-gradient-to-b from-cyan-500/12 to-[#0e1827]';

  const headerBadgeClass = isHostSlot
    ? 'border-amber-300/50 bg-amber-400/20 text-amber-200'
    : 'border-cyan-300/50 bg-cyan-400/20 text-cyan-200';

  return (
    <div
      className={`flex min-h-[11.5rem] flex-col justify-between rounded-3xl border-2 p-5 shadow-xl ${containerClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${headerBadgeClass}`}
        >
          {isHostSlot ? (
            <Crown aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
          ) : (
            <Users aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
          )}
          <span>{isHostSlot ? 'P1 — Chủ Phòng' : 'P2 — Đồng Đội'}</span>
        </span>

        {member ? (
          member.ready ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-black text-emerald-200">
              <Check aria-hidden="true" className="h-3 w-3" />
              <span>Sẵn sàng</span>
            </span>
          ) : (
            <span className="rounded-full border border-slate-500/40 bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold text-slate-300">
              Chưa sẵn sàng
            </span>
          )
        ) : (
          <span className="rounded-full border border-cyan-500/30 bg-[#0a1320] px-2.5 py-1 text-[11px] font-bold text-cyan-200/75">
            {isHostSlot && isConnecting ? 'Đang vào...' : 'Trống'}
          </span>
        )}
      </div>

      {member && animalMeta ? (
        <div className="mt-4 flex items-center gap-3.5">
          <AnimalAvatar animal={animalMeta.id} size="lg" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-display text-lg font-black text-white">
                {member.name}
              </span>
              {isSelf && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                    isHostSlot
                      ? 'bg-amber-400/25 text-amber-200'
                      : 'bg-cyan-400/25 text-cyan-200'
                  }`}
                >
                  Bạn
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs font-bold text-slate-300">
              {animalMeta.name}
              {accessorySummary ? (
                <span className="text-cyan-200/85">
                  {' · '}
                  {accessorySummary.primaryName}
                  {accessorySummary.extraCount > 0
                    ? ` +${accessorySummary.extraCount}`
                    : ''}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan-400/30 bg-[#0a1320]/70 px-4 py-4 text-center">
          <div
            aria-hidden="true"
            className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent motion-reduce:animate-none"
          />
          <p className="text-xs font-bold text-cyan-100/85">
            {isHostSlot && isConnecting
              ? 'Đang thiết lập vị trí Chủ phòng...'
              : 'Gửi mã hoặc link mời cho đồng đội!'}
          </p>
        </div>
      )}

      <div className="mt-4 border-t border-white/10 pt-2.5 text-[11px] font-bold text-slate-300/80">
        {isHostSlot
          ? 'Vị trí P1 · Chọn Kiểu, Map & Màn chơi'
          : 'Vị trí P2 · Phối hợp ăn ý cùng đồng đội'}
      </div>
    </div>
  );
}

interface CoopStageSelectorProps {
  mode: 'preview' | 'lobby';
  isHost: boolean;
  selectedActionId: CoopMapId;
  selectedPackId: string;
  selectedLevel: CoopLevelNumber;
  coopLevelRecords: Readonly<Record<string, CoopMapRecord>>;
  unlockedByPack: Readonly<Record<string, number>>;
  onSelectAction: (actionId: CoopMapId) => void;
  onSelectPack: (packId: string) => void;
  onSelectLevel: (level: CoopLevelNumber) => void;
}

function CoopStageSelector({
  mode,
  isHost,
  selectedActionId,
  selectedPackId,
  selectedLevel,
  coopLevelRecords,
  unlockedByPack,
  onSelectAction,
  onSelectPack,
  onSelectLevel,
}: CoopStageSelectorProps) {
  const canInteract = mode === 'preview' || isHost;
  const headingId = useId();
  const activeAction = getCoopMapMeta(selectedActionId);
  const activePack = getCoopMapPack(activeAction.id, selectedPackId);
  const activeLevelMeta = getCoopLevelMeta(
    activeAction.id,
    activePack.id,
    selectedLevel,
  );

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-3xl border border-cyan-400/25 bg-[#121d2d]/95 p-4 shadow-xl sm:p-5"
    >
      {/* Tier 1: 4 Co-op Actions */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass aria-hidden="true" className="h-4 w-4 text-cyan-300" />
            <h2
              id={headingId}
              className="text-xs font-black uppercase tracking-wider text-cyan-300"
            >
              4 KIỂU HÀNH ĐỘNG HỢP TÁC
            </h2>
          </div>

          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black ${
              mode === 'preview'
                ? 'border-cyan-400/35 bg-cyan-950/70 text-cyan-200'
                : isHost
                  ? 'border-amber-400/45 bg-amber-400/15 text-amber-200'
                  : 'border-cyan-400/35 bg-cyan-950/70 text-cyan-200'
            }`}
          >
            {mode === 'preview'
              ? 'Xem trước · Bấm để duyệt từng Kiểu'
              : isHost
                ? 'Chủ phòng chọn Kiểu · Map · Màn'
                : 'Chủ phòng đang chọn'}
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {COOP_MAPS.map((action) => {
            const isSelected = activeAction.id === action.id;
            const stars = countCoopActionStars(coopLevelRecords, action.id);
            const cardClass = `flex h-full flex-col justify-between rounded-2xl border-2 p-3 text-left transition-all motion-reduce:transition-none ${
              isSelected
                ? 'border-cyan-300 bg-cyan-500/18 shadow-[0_0_20px_rgba(34,211,238,0.25)]'
                : 'border-white/10 bg-[#0a1320]/90'
            }`;

            const body = (
              <>
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className="rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase"
                      style={{
                        borderColor: `${action.accentHex}66`,
                        backgroundColor: `${action.accentHex}1f`,
                        color: action.accentHex,
                      }}
                    >
                      KIỂU {action.order}
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-black text-amber-200 tabular-nums">
                      <Star
                        aria-hidden="true"
                        className="h-3 w-3 fill-amber-400 text-amber-300"
                      />
                      <span>
                        {stars.earned} / {stars.max}★
                      </span>
                    </span>
                  </div>

                  <div className="mt-1.5 font-display text-sm font-black text-white">
                    {action.title}
                  </div>
                  <div className="mt-0.5 text-[11px] font-bold text-cyan-200/85">
                    {action.mechanicBadge}
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-2 border-t border-white/10 pt-1.5 text-right">
                    <span className="rounded-md bg-cyan-400/25 px-1.5 py-0.5 text-[10px] font-black text-cyan-200">
                      Đang chọn
                    </span>
                  </div>
                )}
              </>
            );

            if (canInteract) {
              return (
                <button
                  key={action.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    playSfx('click');
                    onSelectAction(action.id);
                  }}
                  className={`${cardClass} cursor-pointer hover:border-cyan-400/60 ${FOCUS_RING_CLASS}`}
                >
                  {body}
                </button>
              );
            }

            return (
              <div
                key={action.id}
                aria-current={isSelected ? 'true' : undefined}
                className={cardClass}
              >
                {body}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tier 2: Map Packs inside Selected Action */}
      <div className="border-t border-white/10 pt-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-300">
            CHỌN MAP · {activeAction.shortTitle}
          </h3>
          <span className="text-[11px] font-bold text-slate-300">
            {activeAction.maps.length} bản đồ bối cảnh
          </span>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {activeAction.maps.map((pack) => {
            const isPackSelected = activePack.id === pack.id;
            const packStars = countCoopPackStars(
              coopLevelRecords,
              activeAction.id,
              pack.id,
            );
            const packClass = `flex flex-col justify-between rounded-2xl border-2 p-3 text-left transition-all motion-reduce:transition-none ${
              isPackSelected
                ? 'border-amber-300 bg-amber-400/15 shadow-[0_0_16px_rgba(251,191,36,0.2)]'
                : 'border-white/10 bg-[#0a1320]/90'
            }`;

            const packBody = (
              <>
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className="rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase"
                      style={{
                        borderColor: `${pack.accentHex}66`,
                        backgroundColor: `${pack.accentHex}1f`,
                        color: pack.accentHex,
                      }}
                    >
                      Map {pack.order}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-200 tabular-nums">
                      <Star
                        aria-hidden="true"
                        className="h-3 w-3 fill-amber-400 text-amber-300"
                      />
                      <span>
                        {packStars.earned}/{packStars.max}★
                      </span>
                    </span>
                  </div>

                  <div className="mt-1.5 font-display text-sm font-black text-white">
                    {pack.title}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-300">
                    {pack.tagline}
                  </p>
                </div>
              </>
            );

            if (canInteract) {
              return (
                <button
                  key={pack.id}
                  type="button"
                  aria-pressed={isPackSelected}
                  onClick={() => {
                    playSfx('click');
                    onSelectPack(pack.id);
                  }}
                  className={`${packClass} cursor-pointer hover:border-amber-300/60 ${FOCUS_RING_CLASS}`}
                >
                  {packBody}
                </button>
              );
            }

            return (
              <div
                key={pack.id}
                aria-current={isPackSelected ? 'true' : undefined}
                className={packClass}
              >
                {packBody}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tier 3: 5 Levels inside Selected Map Pack */}
      <div className="border-t border-white/10 pt-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300">
            CHỌN MÀN (DỄ → SIÊU KHÓ)
          </h3>
          <span className="text-[11px] font-bold text-slate-300">
            Mở khóa tuần tự theo tiến độ Chủ phòng
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {activePack.levels.map((lvl) => {
            const isLevelSelected = activeLevelMeta.level === lvl.level;
            const comingSoon = Boolean(lvl.comingSoon);
            const unlocked =
              !comingSoon &&
              isCoopLevelUnlocked(
                coopLevelRecords,
                activeAction.id,
                activePack.id,
                lvl.level,
                unlockedByPack,
              );
            const rec = coopLevelRecords[lvl.key];
            const bestStars = rec?.bestStars ?? 0;

            const levelClass = `flex min-h-[7.25rem] flex-col justify-between rounded-2xl border-2 p-2.5 text-left transition-all motion-reduce:transition-none ${
              comingSoon || !unlocked
                ? 'border-white/10 bg-[#080f1a]/85 opacity-60'
                : isLevelSelected
                  ? 'border-cyan-300 bg-cyan-500/20 shadow-[0_0_18px_rgba(34,211,238,0.28)]'
                  : 'border-white/15 bg-[#0a1320]/95'
            }`;

            const levelBody = (
              <>
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-black text-white">
                      Màn {lvl.level}
                    </span>
                    <span
                      className="rounded-md border px-1.5 py-0.5 text-[9px] font-black"
                      style={{
                        borderColor: `${lvl.difficultyColorHex}66`,
                        backgroundColor: `${lvl.difficultyColorHex}1f`,
                        color: lvl.difficultyColorHex,
                      }}
                    >
                      {lvl.difficultyLabel}
                    </span>
                  </div>

                  <div className="mt-1 line-clamp-2 text-[11px] font-extrabold leading-tight text-slate-100">
                    {lvl.title}
                  </div>
                </div>

                {comingSoon ? (
                  <div className="mt-2 inline-flex items-center gap-1 border-t border-white/10 pt-1.5 text-[10px] font-bold text-slate-400">
                    <Clock aria-hidden="true" className="h-3 w-3 shrink-0" />
                    <span>Sắp ra mắt</span>
                  </div>
                ) : !unlocked ? (
                  <div className="mt-2 inline-flex items-center gap-1 border-t border-white/10 pt-1.5 text-[10px] font-bold text-amber-200/80">
                    <Lock aria-hidden="true" className="h-3 w-3 shrink-0" />
                    <span>Qua Màn {lvl.level - 1}</span>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between gap-1 border-t border-white/10 pt-1.5">
                    <span className="inline-flex items-center gap-0.5">
                      <span className="sr-only">{bestStars} trên 3 sao</span>
                      {[1, 2, 3].map((idx) => (
                        <Star
                          key={idx}
                          aria-hidden="true"
                          className={`h-3 w-3 ${
                            idx <= bestStars
                              ? 'fill-amber-400 text-amber-300'
                              : 'text-slate-600'
                          }`}
                        />
                      ))}
                    </span>
                    {rec ? (
                      <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold text-cyan-200 tabular-nums">
                        <Timer
                          aria-hidden="true"
                          className="h-2.5 w-2.5 text-cyan-300"
                        />
                        <span>{formatBestTime(rec.bestTimeSec)}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">
                        Mở
                      </span>
                    )}
                  </div>
                )}
              </>
            );

            if (canInteract) {
              const disabled = comingSoon || !unlocked;
              return (
                <button
                  key={lvl.key}
                  type="button"
                  disabled={disabled}
                  aria-pressed={!disabled && isLevelSelected}
                  onClick={() => {
                    if (disabled) return;
                    playSfx('click');
                    onSelectLevel(lvl.level);
                  }}
                  className={`${levelClass} ${
                    disabled
                      ? 'cursor-not-allowed'
                      : 'cursor-pointer hover:border-cyan-300/70'
                  } ${FOCUS_RING_CLASS}`}
                >
                  {levelBody}
                </button>
              );
            }

            return (
              <div
                key={lvl.key}
                aria-current={isLevelSelected ? 'true' : undefined}
                className={levelClass}
              >
                {levelBody}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * Create/Join lobby and 2-player waiting room for PAWS Duo Co-op 3D
 * featuring a 3-level hierarchy selector (4 Actions -> Map Packs -> 5 Levels).
 */
export function GlassLobby({
  room,
  initialRoomCode = '',
  onBackToModeSelect,
}: GlassLobbyProps) {
  const {
    selectedAnimal,
    equippedAccessory,
    coopLevelRecords,
    selectAnimal,
  } = useProfileStore();
  const totalStars = countTotalCoopLevelStars(coopLevelRecords);
  const localUnlockedByPack = useMemo(
    () => buildUnlockedByPackMap(coopLevelRecords),
    [coopLevelRecords],
  );

  const [displayName, setDisplayName] = useState<string>(() => loadSavedName());
  const [joinCodeInput, setJoinCodeInput] = useState<string>(() =>
    normalizeRoomCode(initialRoomCode),
  );
  const [copiedMode, setCopiedMode] = useState<'code' | 'link' | null>(null);

  const [previewAction, setPreviewAction] = useState<CoopMapId>(
    room.selectedMap,
  );
  const [previewPack, setPreviewPack] = useState<string>(
    () => room.selectedMapPack || getDefaultMapPackId(room.selectedMap),
  );
  const [previewLevel, setPreviewLevel] = useState<CoopLevelNumber>(
    room.selectedLevel,
  );

  const nameInputId = useId();
  const joinInputId = useId();
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clean = normalizeRoomCode(initialRoomCode);
    if (clean) {
      setJoinCodeInput(clean);
    }
  }, [initialRoomCode]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

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
    void room.createRoom({
      name: displayName.trim() || 'Chủ phòng',
      animal: selectedAnimal,
      accessory: myAccessory,
      unlockedByPack: localUnlockedByPack,
    });
  };

  const handleJoinRoom = () => {
    const clean = normalizeRoomCode(joinCodeInput);
    if (clean.length < 4) return;
    playSfx('click');
    void room.joinRoom(clean, {
      name: displayName.trim() || 'Người chơi',
      animal: selectedAnimal,
      accessory: myAccessory,
      unlockedByPack: localUnlockedByPack,
    });
  };

  const handleCopy = async (mode: 'code' | 'link') => {
    if (!room.roomCode) return;
    playSfx('click');
    const inviteUrl = buildRoomInviteUrl('glass', room.roomCode);
    const text =
      mode === 'link'
        ? inviteUrl ||
          (typeof window !== 'undefined'
            ? `${window.location.origin}${window.location.pathname}?coopRoom=${room.roomCode}`
            : room.roomCode)
        : room.roomCode;
    const ok = await copyTextSafe(text);
    if (ok) {
      setCopiedMode(mode);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        copyTimerRef.current = null;
        setCopiedMode(null);
      }, 1800);
    }
  };

  // 1. Supabase Not Configured State
  if (!room.isConfigured) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0e1827] bg-[radial-gradient(circle_at_50%_0%,_rgba(56,189,248,0.18)_0%,_#0e1827_70%)] p-4 text-[#FFF9F0]">
        <main className="w-full max-w-xl rounded-3xl border-2 border-cyan-400/35 bg-[#121d2d] p-6 shadow-2xl sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/35 bg-cyan-950/70 px-3 py-1 text-xs font-black text-cyan-200">
              <Globe aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
              <span>PAWS Duo Co-op 3D · 4 Kiểu Hợp Tác · 2 Người Online</span>
            </span>
          </div>

          <h1 className="mt-4 font-display text-2xl font-black text-white">
            Cần Cấu Hình Supabase Realtime
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Chế độ <strong className="text-cyan-200">PAWS Duo Co-op 3D</strong>{' '}
            sử dụng <strong className="text-cyan-200">Supabase Realtime</strong>{' '}
            để đồng bộ vị trí và cơ chế hợp tác theo thời gian thực. Vui lòng xem
            hướng dẫn trong{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-amber-200">
              SUPABASE_SETUP.md
            </code>{' '}
            và thêm khóa dự án vào{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-amber-200">
              .env.local
            </code>
            :
          </p>

          <pre className="mt-4 overflow-x-auto rounded-2xl border border-cyan-500/25 bg-[#09111d] p-4 font-mono text-xs text-cyan-300">
{`VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>`}
          </pre>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onBackToModeSelect();
              }}
              className={`btn-tactile-amber inline-flex cursor-pointer items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-black text-[#26160b] ${FOCUS_RING_CLASS}`}
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              <span>Quay Lại Chọn Chế Độ</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // 2. Idle (Create / Join) State
  if (room.phase === 'idle') {
    const cleanJoinCode = normalizeRoomCode(joinCodeInput);
    const isConnecting = room.connectionStatus === 'connecting';
    const canJoin = cleanJoinCode.length >= 4 && !isConnecting;
    const equippedSummary = formatEquippedSummary(myAccessory);

    return (
      <div className="min-h-dvh bg-[#0e1827] bg-[radial-gradient(circle_at_18%_0%,_rgba(56,189,248,0.18)_0%,_transparent_46%),radial-gradient(circle_at_84%_0%,_rgba(251,191,36,0.14)_0%,_transparent_46%),linear-gradient(180deg,_#121d2d_0%,_#0e1827_100%)] p-4 text-[#FFF9F0] sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/35 bg-cyan-950/65 px-3.5 py-1 text-xs font-bold text-cyan-200">
                <Users aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
                <span>4 Kiểu Hợp Tác · Nhiều Màn · 2 Người Online</span>
              </div>
              <h1 className="mt-2 font-display text-2xl font-black text-white sm:text-3xl">
                PAWS Duo Co-op 3D
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-400/40 bg-[#121d2d] px-3.5 py-2 text-xs font-black text-amber-200 shadow-lg">
                <Star
                  aria-hidden="true"
                  className="h-4 w-4 fill-amber-400 text-amber-300"
                />
                <span className="tabular-nums">
                  {totalStars} / {MAX_COOP_STARS}★
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  onBackToModeSelect();
                }}
                className={`btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-amber-900/50 px-4 py-2 text-xs font-black text-amber-100 ${FOCUS_RING_CLASS}`}
              >
                <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
                <span>Quay Lại Chọn Chế Độ</span>
              </button>
            </div>
          </header>

          {/* 3-Tier Interactive Preview */}
          <main className="space-y-5">
            <CoopStageSelector
              mode="preview"
              isHost
              selectedActionId={previewAction}
              selectedPackId={previewPack}
              selectedLevel={previewLevel}
              coopLevelRecords={coopLevelRecords}
              unlockedByPack={localUnlockedByPack}
              onSelectAction={(actionId) => {
                setPreviewAction(actionId);
                setPreviewPack(getDefaultMapPackId(actionId));
                setPreviewLevel(1);
              }}
              onSelectPack={(packId) => {
                setPreviewPack(packId);
                setPreviewLevel(1);
              }}
              onSelectLevel={(level) => {
                setPreviewLevel(level);
              }}
            />

            {room.error && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-400/50 bg-rose-500/20 px-4 py-3 text-sm font-bold text-rose-100"
              >
                {room.error}
              </div>
            )}

            {/* Profile & 8-Animal Picker */}
            <section className="rounded-3xl border-2 border-cyan-400/25 bg-[#121d2d] p-5 shadow-2xl">
              <h2 className="text-xs font-black uppercase tracking-wider text-cyan-300">
                Hồ Sơ &amp; Thú Bông Đại Diện
              </h2>

              <div className="mt-3">
                <label
                  htmlFor={nameInputId}
                  className="block text-xs font-bold text-slate-300"
                >
                  Tên hiển thị trong phòng
                </label>
                <input
                  id={nameInputId}
                  type="text"
                  maxLength={18}
                  value={displayName}
                  onChange={(e) => saveName(e.target.value)}
                  placeholder="Nhập tên của bạn..."
                  className={`mt-1.5 w-full rounded-2xl border border-cyan-500/30 bg-[#0a1320] px-4 py-2.5 text-sm font-bold text-white placeholder:text-slate-400 ${FOCUS_RING_CLASS}`}
                />
              </div>

              <div className="mt-4">
                <div className="text-xs font-bold text-slate-300">
                  Chọn nhân vật (
                  {equippedSummary
                    ? `${equippedSummary.primaryName}${equippedSummary.extraCount > 0 ? ` +${equippedSummary.extraCount}` : ''}`
                    : 'Mặc định'}
                  )
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
                        className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-extrabold transition-colors motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                          active
                            ? 'border-cyan-300 bg-cyan-500/20 text-white shadow'
                            : 'border-white/10 bg-[#0a1320] text-slate-300 hover:border-cyan-400/40'
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

            {/* Left Card: Create Room | Right Card: Join Room */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <section className="flex flex-col justify-between rounded-3xl border-2 border-cyan-400/35 bg-[#121d2d] p-5 shadow-2xl">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-cyan-300">
                    Tạo Phòng Mới (P1)
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                    Tạo phòng riêng 2 người, nhận mã 6 ký tự hoặc link mời nhanh
                    cho đồng đội cùng phối hợp qua 4 kiểu hợp tác và nhiều màn chơi.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={handleCreateRoom}
                  className={`btn-tactile-sky mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
                >
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                  <span>Tạo Phòng 2 Người</span>
                </button>
              </section>

              <section className="flex flex-col justify-between rounded-3xl border-2 border-amber-400/35 bg-[#121d2d] p-5 shadow-2xl">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">
                    Vào Phòng Bằng Mã (P2)
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                    Nhập mã phòng 6 ký tự từ bạn bè để vào ngay sảnh chờ ghép
                    cặp.
                  </p>
                </div>
                <div className="mt-4 space-y-2.5">
                  <label htmlFor={joinInputId} className="sr-only">
                    Mã phòng 6 ký tự
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={joinInputId}
                      type="text"
                      maxLength={6}
                      value={joinCodeInput}
                      onChange={(e) =>
                        setJoinCodeInput(normalizeRoomCode(e.target.value))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canJoin) handleJoinRoom();
                      }}
                      placeholder="VD: AB3K9Z"
                      className={`min-w-0 flex-1 rounded-2xl border border-amber-400/35 bg-[#0a1320] px-3.5 py-2.5 text-center font-mono text-base font-black tracking-widest text-amber-200 uppercase placeholder:text-slate-500 ${FOCUS_RING_CLASS}`}
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
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // 3. Waiting Room (Lobby) State
  const bothPresent = room.members.length === 2;
  const bothReady = bothPresent && room.members.every((m) => m.ready);
  const canStart = room.isHost && bothReady;
  const activeActionMeta = getCoopMapMeta(room.selectedMap);
  const activePackMeta = getCoopMapPack(room.selectedMap, room.selectedMapPack);
  const activeLevelMeta = getCoopLevelMeta(
    room.selectedMap,
    activePackMeta.id,
    room.selectedLevel,
  );
  const activeUnlockedByPack = room.isHost
    ? localUnlockedByPack
    : room.hostUnlockedByPack;

  const stageLabel = `${activeActionMeta.shortTitle} · ${activePackMeta.shortTitle} · Màn ${activeLevelMeta.level}`;

  const hostHintText = !bothPresent
    ? 'Đang chờ đủ 2 người chơi trong phòng...'
    : !bothReady
      ? 'Cả 2 người chơi cần bấm Sẵn Sàng để xuất phát!'
      : `Cả đội đã sẵn sàng — bấm để bắt đầu ${stageLabel}!`;

  return (
    <div className="min-h-dvh bg-[#0e1827] bg-[radial-gradient(circle_at_18%_0%,_rgba(56,189,248,0.18)_0%,_transparent_46%),radial-gradient(circle_at_84%_0%,_rgba(251,191,36,0.14)_0%,_transparent_46%),linear-gradient(180deg,_#121d2d_0%,_#0e1827_100%)] p-4 text-[#FFF9F0] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-cyan-400/30 bg-[#121d2d]/95 px-5 py-4 shadow-xl">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-wider text-cyan-300">
                <h1 className="font-display text-sm font-black uppercase tracking-wider text-cyan-300">
                  Sảnh Chờ PAWS Duo Co-op 3D
                </h1>
                <span className="rounded-full border border-white/10 bg-[#0a1320] px-2 py-0.5 text-[10px] font-bold text-slate-300 normal-case">
                  {room.connectionStatus === 'connected'
                    ? 'Đã kết nối'
                    : 'Đang kết nối...'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-200 normal-case tabular-nums">
                  <Star
                    aria-hidden="true"
                    className="h-3 w-3 fill-amber-400 text-amber-300"
                  />
                  <span>
                    {totalStars} / {MAX_COOP_STARS}★
                  </span>
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-xl border border-amber-400/35 bg-[#0a1320] px-3 py-1 font-mono text-xl font-black tracking-widest text-amber-200">
                  {room.roomCode}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopy('code')}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-400/35 bg-[#0a1320] px-3 py-1.5 text-xs font-bold text-amber-200 hover:border-amber-300 ${FOCUS_RING_CLASS}`}
                >
                  {copiedMode === 'code' ? (
                    <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {copiedMode === 'code' ? 'Đã sao chép!' : 'Sao chép Mã'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy('link')}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-cyan-400/35 bg-cyan-950/60 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:border-cyan-300 ${FOCUS_RING_CLASS}`}
                >
                  {copiedMode === 'link' ? (
                    <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {copiedMode === 'link'
                      ? 'Đã sao chép!'
                      : 'Sao chép Link Mời'}
                  </span>
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

        <main className="space-y-5">
          {/* 2 Player Slots side-by-side */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {renderSlotCard(
              'p1',
              room.p1Member,
              room.myPeerId,
              room.connectionStatus === 'connecting',
            )}
            {renderSlotCard(
              'p2',
              room.p2Member,
              room.myPeerId,
              room.connectionStatus === 'connecting',
            )}
          </div>

          {/* 3-Tier Action -> Map Pack -> Level Selector */}
          <CoopStageSelector
            mode="lobby"
            isHost={room.isHost}
            selectedActionId={room.selectedMap}
            selectedPackId={activePackMeta.id}
            selectedLevel={activeLevelMeta.level}
            coopLevelRecords={coopLevelRecords}
            unlockedByPack={activeUnlockedByPack}
            onSelectAction={(actionId) => {
              room.selectStage(actionId, getDefaultMapPackId(actionId), 1);
            }}
            onSelectPack={(packId) => {
              room.selectStage(activeActionMeta.id, packId, 1);
            }}
            onSelectLevel={(level) => {
              room.selectStage(activeActionMeta.id, activePackMeta.id, level);
            }}
          />

          {/* Animal Switcher & Ready / Start Actions */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            <section className="rounded-3xl border border-cyan-400/25 bg-[#121d2d] p-5 shadow-xl lg:col-span-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-cyan-300">
                Đổi Thú Bông Trong Sảnh
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ANIMALS.map((animal) => {
                  const active = animal.id === selectedAnimal;
                  return (
                    <button
                      key={animal.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleSelectAnimal(animal.id)}
                      className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-extrabold transition-colors motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                        active
                          ? 'border-cyan-300 bg-cyan-500/20 text-white shadow'
                          : 'border-white/10 bg-[#0a1320] text-slate-300 hover:border-cyan-400/40'
                      }`}
                    >
                      <AnimalAvatar animal={animal.id} size="sm" />
                      <span className="truncate">{animal.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col justify-between gap-3 rounded-3xl border border-amber-400/30 bg-[#121d2d] p-5 shadow-xl lg:col-span-2">
              <div className="space-y-2.5">
                <button
                  type="button"
                  aria-pressed={Boolean(myMember?.ready)}
                  onClick={() => {
                    playSfx('click');
                    room.toggleReady();
                  }}
                  className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-black transition-colors motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                    myMember?.ready
                      ? 'border-emerald-300 bg-emerald-600/90 text-white shadow-lg hover:bg-emerald-600'
                      : 'btn-tactile-amber border-amber-300 text-[#26160b]'
                  }`}
                >
                  <Check aria-hidden="true" className="h-4 w-4" />
                  <span>
                    {myMember?.ready ? 'Hủy Sẵn Sàng' : 'Sẵn Sàng'}
                  </span>
                </button>

                {room.isHost ? (
                  <>
                    <button
                      type="button"
                      disabled={!canStart}
                      onClick={() => {
                        playSfx('click');
                        room.startMatch();
                      }}
                      className={`btn-tactile-sky inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING_CLASS}`}
                    >
                      <Play aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span>Bắt Đầu: {stageLabel}!</span>
                    </button>
                    <p className="text-center text-xs font-bold text-slate-300">
                      {hostHintText}
                    </p>
                  </>
                ) : (
                  <p className="rounded-2xl border border-cyan-500/20 bg-[#0a1320] px-3 py-2.5 text-center text-xs font-bold text-cyan-200/85">
                    {myMember?.ready
                      ? `Bạn đã sẵn sàng! Chờ Chủ phòng bắt đầu ${stageLabel}...`
                      : 'Bấm Sẵn Sàng khi bạn đã chuẩn bị xong.'}
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* Dynamic Keyboard Controls Strip */}
          <footer className="rounded-2xl border border-cyan-400/25 bg-[#0a1320]/90 px-4 py-3 text-center text-xs font-bold text-slate-200 shadow-lg">
            <span className="mr-2 font-black uppercase tracking-wider text-amber-300">
              Hướng Dẫn Phím Tắt ({activeActionMeta.shortTitle}):
            </span>
            <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {activeActionMeta.controls.map((ctrl, idx) => (
                <span key={ctrl.keys} className="inline-flex items-center gap-1">
                  {idx > 0 && (
                    <span aria-hidden="true" className="text-slate-500">
                      ·
                    </span>
                  )}
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">
                    {ctrl.keys}
                  </kbd>
                  <span>{ctrl.label}</span>
                </span>
              ))}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
