import { useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Heart,
  Link2,
  ShieldAlert,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  Zap,
} from 'lucide-react';
import { playSfx } from '../../audio/soundEngine';
import { getCoopMapMeta, type CoopMapId } from '../../coop/maps/registry';
import { CoopSkillBar } from '../../coop/ui/CoopSkillBar';
import type { GlassRoomController } from '../online/useGlassRoom';
import type { GlassHudSnapshot } from '../render/renderTypes';
import type { ShatterReason } from '../sim/types';

export interface GlassHudProps {
  room: GlassRoomController;
  hud: GlassHudSnapshot;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  onLeaveRoom: () => void;
  onBackToModeSelect?: () => void;
}

const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300';

const STAGE_NUMBERS = [1, 2, 3, 4, 5] as const;

const MINECART_JUMP_THRESHOLD_PCT = 35;

const SHATTER_REASON_LABEL: Record<ShatterReason, string> = {
  impact: 'Va chạm chướng ngại vật!',
  stretch: 'Hai người đi quá xa nhau!',
  tilt: 'Độ nghiêng tấm kính quá giới hạn!',
  fall: 'Rơi khỏi đường đua!',
};

const FAILURE_FLASH_TITLE: Record<CoopMapId, string> = {
  glass_carry: 'Kính vỡ! Hồi sinh tại Checkpoint...',
  raft_rapids: 'Phao lật! Hồi sinh tại Checkpoint...',
  rope_tether: 'Đứt dây / Rơi vực! Hồi sinh tại Checkpoint...',
  minecart_rails: 'Xe trật bánh! Hồi sinh tại Checkpoint...',
};

const DURABILITY_LABEL: Record<CoopMapId, string> = {
  glass_carry: 'Kính',
  raft_rapids: 'Phao',
  rope_tether: 'Độ bền dây',
  minecart_rails: 'Xe ray',
};

function formatElapsedTenths(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const totalTenths = Math.floor(safe * 10);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

function CrystalPaneIcon({ intact }: { intact: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-5 w-5 transition-all motion-reduce:transition-none ${
        intact
          ? 'text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.7)]'
          : 'text-slate-600 opacity-50'
      }`}
      fill="none"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2.5"
        fill={intact ? 'rgba(103, 232, 249, 0.25)' : 'rgba(30, 41, 59, 0.45)'}
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {intact ? (
        <path
          d="M7 8.5L11.5 15.5M12 8.5L15 13"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M6.5 7.5L11 12L9 16.5M11 12L17 9.5"
          stroke="#fb7185"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/**
 * Non-blocking 3D gameplay HUD for Glass Carry Co-op showing glass durability,
 * tension bar, 5-stage stepper, countdown/checkpoint/shatter/disconnect notices,
 * and quick emote controls.
 */
export function GlassHud({
  room,
  hud,
  sfxEnabled,
  onToggleSfx,
  onLeaveRoom,
  onBackToModeSelect,
}: GlassHudProps) {
  const [checkpointBanner, setCheckpointBanner] = useState<number | null>(null);
  const prevCheckpointRef = useRef<number>(hud.checkpointIndex);
  const checkpointTimerRef = useRef<number | null>(null);
  const returnLobbyBtnRef = useRef<HTMLButtonElement | null>(null);
  const disconnectTitleId = useId();

  useEffect(() => {
    const prev = prevCheckpointRef.current;
    const next = hud.checkpointIndex;
    prevCheckpointRef.current = next;

    if (next === 0) {
      if (checkpointTimerRef.current !== null) {
        window.clearTimeout(checkpointTimerRef.current);
        checkpointTimerRef.current = null;
      }
      setCheckpointBanner(null);
      return;
    }

    if (next > prev && next > 0) {
      setCheckpointBanner(next);
      if (checkpointTimerRef.current !== null) {
        window.clearTimeout(checkpointTimerRef.current);
      }
      checkpointTimerRef.current = window.setTimeout(() => {
        checkpointTimerRef.current = null;
        setCheckpointBanner(null);
      }, 2200);
    }
  }, [hud.checkpointIndex]);

  useEffect(() => {
    return () => {
      if (checkpointTimerRef.current !== null) {
        window.clearTimeout(checkpointTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (room.partnerLeftPermanently) {
      returnLobbyBtnRef.current?.focus();
    }
  }, [room.partnerLeftPermanently]);

  const activeMapId: CoopMapId = hud.mapId ?? room.selectedMap;
  const activeMapMeta = getCoopMapMeta(activeMapId);

  const stressRatio = Math.max(
    0,
    Math.min(1, Number.isFinite(hud.glassStress) ? hud.glassStress : 0),
  );
  const meterPct = Math.max(
    0,
    Math.min(100, Math.round(hud.primaryMeterPct ?? stressRatio * 100)),
  );
  const meterLabel = hud.primaryMeterLabel ?? 'Độ căng';
  const failureLabel = hud.failureLabel ?? activeMapMeta.failureLabel;

  const isDangerMeter =
    activeMapId === 'raft_rapids'
      ? hud.statusBadge === 'Xoáy Nước!' || hud.shatterTimer > 0
      : activeMapId === 'minecart_rails'
        ? hud.shatterTimer > 0
        : meterPct > 72;
  const isWarnMeter =
    activeMapId === 'raft_rapids'
      ? false
      : activeMapId === 'minecart_rails'
        ? meterPct < MINECART_JUMP_THRESHOLD_PCT
        : meterPct > 45 && !isDangerMeter;

  let meterBarClass = 'bg-cyan-400';
  if (activeMapId === 'raft_rapids') {
    meterBarClass = hud.boostActive
      ? 'bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.85)]'
      : isDangerMeter
        ? 'bg-rose-500 animate-pulse motion-reduce:animate-none'
        : 'bg-cyan-400/80';
  } else if (activeMapId === 'minecart_rails') {
    meterBarClass = isDangerMeter
      ? 'bg-rose-500 animate-pulse motion-reduce:animate-none'
      : meterPct >= MINECART_JUMP_THRESHOLD_PCT
        ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]'
        : 'bg-amber-400';
  } else {
    meterBarClass = isDangerMeter
      ? 'bg-rose-500 animate-pulse motion-reduce:animate-none'
      : isWarnMeter
        ? 'bg-amber-400'
        : 'bg-cyan-400';
  }

  const meterValueClass =
    activeMapId === 'raft_rapids' && hud.boostActive
      ? 'text-sky-300'
      : isDangerMeter
        ? 'text-rose-300'
        : isWarnMeter
          ? 'text-amber-300'
          : 'text-cyan-200';

  const isHostSlot =
    room.mySlot === 'p1' || (room.mySlot === null && room.isHost);
  const maxHp = Math.max(1, hud.glassMaxHp || 3);
  const totalCheckpoints = Math.max(1, hud.totalCheckpoints || 4);
  const isDisconnected =
    room.partnerDisconnectedSec !== null || room.partnerLeftPermanently;

  return (
    <div className="safe-hud-inset pointer-events-none fixed inset-0 z-20 flex flex-col justify-between sm:p-4">
      {/* TOP HUD */}
      <header className="grid grid-cols-2 items-start gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {/* Top-left: Adaptive Map Status Card */}
        <div className="order-1 justify-self-start rounded-2xl border border-cyan-400/35 bg-[#0e1827]/90 px-3.5 py-2.5 text-white shadow-xl backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
              style={{
                borderColor: `${activeMapMeta.accentHex}70`,
                backgroundColor: `${activeMapMeta.accentHex}22`,
                color: activeMapMeta.accentHex,
              }}
            >
              {activeMapMeta.shortTitle}
            </span>

            <div className="flex items-center gap-1" aria-hidden="true">
              {Array.from({ length: maxHp }, (_, idx) => {
                const intact = idx < hud.glassHp;
                if (activeMapId === 'glass_carry') {
                  return <CrystalPaneIcon key={idx} intact={intact} />;
                }
                if (activeMapId === 'rope_tether') {
                  return (
                    <Link2
                      key={idx}
                      className={`h-4 w-4 transition-all motion-reduce:transition-none ${
                        intact
                          ? 'text-amber-300 drop-shadow-[0_0_5px_rgba(251,191,36,0.65)]'
                          : 'text-slate-600 opacity-45'
                      }`}
                    />
                  );
                }
                return (
                  <Heart
                    key={idx}
                    className={`h-4 w-4 transition-all motion-reduce:transition-none ${
                      intact
                        ? activeMapId === 'raft_rapids'
                          ? 'fill-sky-400 text-sky-300 drop-shadow-[0_0_5px_rgba(56,189,248,0.65)]'
                          : 'fill-rose-400 text-rose-300 drop-shadow-[0_0_5px_rgba(251,113,133,0.65)]'
                        : 'fill-slate-800 text-slate-600 opacity-50'
                    }`}
                  />
                );
              })}
            </div>

            <span className="font-mono text-xs font-black text-cyan-200 tabular-nums">
              {DURABILITY_LABEL[activeMapId]} {hud.glassHp}/{maxHp}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-slate-300">
              {meterLabel}
            </span>
            <div
              role="progressbar"
              aria-label={meterLabel}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={meterPct}
              className="relative h-2.5 w-28 overflow-hidden rounded-full border border-white/10 bg-[#08101b] sm:w-36"
            >
              <div
                className={`h-full rounded-full transition-[width,background-color] duration-100 motion-reduce:transition-none ${meterBarClass}`}
                style={{ width: `${meterPct}%` }}
              />
              {activeMapId === 'minecart_rails' && (
                <div
                  aria-hidden="true"
                  title="Ngưỡng nhảy ≥ 7.0 m/s"
                  className="absolute inset-y-0 w-0.5 bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.9)]"
                  style={{ left: `${MINECART_JUMP_THRESHOLD_PCT}%` }}
                />
              )}
            </div>
            <span
              className={`w-9 text-right font-mono text-[11px] font-black tabular-nums ${meterValueClass}`}
            >
              {meterPct}%
            </span>
          </div>

          {(activeMapId === 'minecart_rails' ||
            hud.pumpTurn ||
            hud.statusBadge ||
            hud.boostActive) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {hud.pumpTurn && (
                <span
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-black ${
                    hud.pumpTurn === 'p1'
                      ? 'border-amber-300/60 bg-amber-400/20 text-amber-200'
                      : 'border-cyan-300/60 bg-cyan-400/20 text-cyan-200'
                  }`}
                >
                  <Zap aria-hidden="true" className="h-3 w-3" />
                  <span>
                    LƯỢT BƠM: {hud.pumpTurn === 'p1' ? 'P1' : 'P2'}
                  </span>
                </span>
              )}

              {activeMapId === 'minecart_rails' && (
                <span
                  className={`rounded-lg border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                    meterPct >= MINECART_JUMP_THRESHOLD_PCT
                      ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-200'
                      : 'border-amber-400/35 bg-amber-500/10 text-amber-200/90'
                  }`}
                >
                  ≥ 7.0 m/s
                </span>
              )}

              {hud.statusBadge &&
                !(hud.pumpTurn && hud.statusBadge.startsWith('Lượt Bơm:')) && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-black ${
                      hud.boostActive
                        ? 'border-sky-300/60 bg-sky-400/25 text-sky-100'
                        : hud.statusBadge.includes('Hồi sinh') ||
                            hud.statusBadge.includes('Cứu') ||
                            hud.statusBadge.includes('Xoáy')
                          ? 'border-rose-400/55 bg-rose-500/20 text-rose-200'
                          : 'border-amber-300/45 bg-amber-400/15 text-amber-200'
                    }`}
                  >
                    {hud.boostActive && (
                      <Zap aria-hidden="true" className="h-3 w-3" />
                    )}
                    <span>{hud.statusBadge}</span>
                  </span>
                )}
            </div>
          )}
        </div>

        {/* Top-center: 5-Stage Progress Stepper + Time + Failures */}
        <div className="order-3 col-span-2 justify-self-center rounded-2xl border border-cyan-400/35 bg-[#0e1827]/90 px-3.5 py-2 text-white shadow-xl backdrop-blur-md lg:order-2 lg:col-span-1">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ol
              aria-label="Tiến độ 5 chặng"
              className="flex items-center gap-1"
            >
              {STAGE_NUMBERS.map((stageNum) => {
                const isActive = stageNum === hud.stageNumber;
                const isDone = stageNum < hud.stageNumber;
                return (
                  <li
                    key={stageNum}
                    aria-current={isActive ? 'step' : undefined}
                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-black transition-colors motion-reduce:transition-none ${
                      isActive
                        ? 'border-cyan-200 bg-cyan-400 text-[#081523] shadow-[0_0_10px_rgba(34,211,238,0.6)]'
                        : isDone
                          ? 'border-emerald-400/50 bg-emerald-500/25 text-emerald-200'
                          : 'border-white/15 bg-[#08101b] text-slate-400'
                    }`}
                  >
                    {stageNum}
                  </li>
                );
              })}
            </ol>

            <span className="text-xs font-black text-amber-200">
              {hud.stageName}
            </span>
          </div>

          <div className="mt-1.5 flex items-center justify-center gap-3 text-xs font-extrabold">
            <span className="inline-flex items-center gap-1 font-mono text-cyan-200 tabular-nums">
              <Clock aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
              <span>{formatElapsedTenths(hud.matchTime)}</span>
            </span>
            <span className="text-white/25" aria-hidden="true">
              |
            </span>
            <span className="inline-flex items-center gap-1 text-rose-200 tabular-nums">
              <ShieldAlert
                aria-hidden="true"
                className="h-3.5 w-3.5 text-rose-400"
              />
              <span>
                {failureLabel}: {hud.shatters}
              </span>
            </span>
          </div>
        </div>

        {/* Top-right: Role Pill + Room Code + SFX + Leave */}
        <div className="pointer-events-auto order-2 flex flex-wrap items-center justify-end gap-2 justify-self-end lg:order-3">
          <div
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black shadow-md backdrop-blur-md ${
              isHostSlot
                ? 'border-amber-400/50 bg-[#1c1a16]/90 text-amber-200'
                : 'border-cyan-400/50 bg-[#0e1e2b]/90 text-cyan-200'
            }`}
          >
            <Users aria-hidden="true" className="h-3.5 w-3.5" />
            <span>{isHostSlot ? 'P1 · Chủ phòng' : 'P2 · Đồng đội'}</span>
          </div>

          {room.roomCode && (
            <div className="rounded-xl border border-white/15 bg-[#0e1827]/90 px-2.5 py-1.5 font-mono text-xs font-black tracking-wider text-amber-200 shadow-md backdrop-blur-md">
              {room.roomCode}
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleSfx();
            }}
            aria-label={sfxEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            aria-pressed={!sfxEnabled}
            className={`btn-tactile-wood cursor-pointer rounded-xl border border-white/20 p-2 text-amber-100 shadow-md ${FOCUS_RING_CLASS}`}
          >
            {sfxEnabled ? (
              <Volume2 aria-hidden="true" className="h-4 w-4 text-cyan-300" />
            ) : (
              <VolumeX aria-hidden="true" className="h-4 w-4 text-slate-400" />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              playSfx('click');
              onLeaveRoom();
            }}
            className={`btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-400/35 px-3 py-1.5 text-xs font-black text-rose-200 shadow-md ${FOCUS_RING_CLASS}`}
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Rời phòng</span>
          </button>
        </div>
      </header>

      {/* CENTER OVERLAYS */}
      <div className="pointer-events-none fixed inset-0 z-30 flex flex-col items-center justify-center gap-3 p-4">
        {/* Countdown Overlay */}
        {room.phase === 'countdown' && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-2 rounded-3xl border-2 border-cyan-300/60 bg-[#0e1827]/90 px-10 py-6 text-center shadow-2xl backdrop-blur-md"
          >
            <span className="text-xs font-black uppercase tracking-widest text-cyan-200">
              Chuẩn Bị: {activeMapMeta.title}
            </span>
            <div className="font-display text-6xl font-black text-amber-300 drop-shadow">
              {room.countdownSec > 0 ? `${room.countdownSec}` : '1!'}
            </div>
          </div>
        )}

        {/* Adaptive Failure Flash Notice (suppressed while partner disconnect notice is active) */}
        {room.phase === 'playing' && hud.shatterTimer > 0 && !isDisconnected && (
          <div
            role="status"
            aria-live="assertive"
            className="rounded-3xl border-2 border-rose-400/75 bg-rose-950/90 px-6 py-4 text-center shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center justify-center gap-2 font-display text-xl font-black text-rose-100">
              <AlertTriangle
                aria-hidden="true"
                className="h-5 w-5 text-rose-300"
              />
              <span>{FAILURE_FLASH_TITLE[activeMapId]}</span>
            </div>
            {activeMapId === 'glass_carry' && hud.shatterReason && (
              <p className="mt-1 text-xs font-bold text-rose-200/90">
                {SHATTER_REASON_LABEL[hud.shatterReason]}
              </p>
            )}
          </div>
        )}

        {/* Brief Checkpoint Banner */}
        {room.phase === 'playing' &&
          checkpointBanner !== null &&
          hud.shatterTimer <= 0 &&
          !isDisconnected && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl border-2 border-emerald-300/70 bg-[#0e2422]/92 px-6 py-3 text-center shadow-2xl backdrop-blur-md"
            >
              <div className="flex items-center justify-center gap-2 font-display text-base font-black text-emerald-100 sm:text-lg">
                <CheckCircle2
                  aria-hidden="true"
                  className="h-5 w-5 text-emerald-300"
                />
                <span>
                  {activeMapId === 'glass_carry'
                    ? `Checkpoint ${checkpointBanner}/${totalCheckpoints} — Đã sửa kính 3/3!`
                    : `Checkpoint ${checkpointBanner}/${totalCheckpoints} — Đã lưu & hồi phục!`}
                </span>
              </div>
            </div>
          )}

        {/* Partner Disconnected Grace Banner / Permanent Leave Card */}
        {room.partnerDisconnectedSec !== null &&
          !room.partnerLeftPermanently && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-3xl border-2 border-amber-400/70 bg-[#1c1a15]/95 px-6 py-4 text-center shadow-2xl backdrop-blur-md"
            >
              <div className="flex items-center justify-center gap-2 text-sm font-black text-amber-200 sm:text-base">
                <WifiOff
                  aria-hidden="true"
                  className="h-5 w-5 text-amber-300"
                />
                <span>
                  Đồng đội bị mất kết nối! Đang chờ kết nối lại... (
                  {room.partnerDisconnectedSec}s)
                </span>
              </div>
            </div>
          )}

        {room.partnerLeftPermanently && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={disconnectTitleId}
            className="pointer-events-auto w-full max-w-md rounded-3xl border-2 border-rose-400/60 bg-[#121d2d] p-6 text-center text-white shadow-2xl"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/40 bg-rose-500/20 text-rose-300">
              <WifiOff aria-hidden="true" className="h-6 w-6" />
            </div>
            <h2
              id={disconnectTitleId}
              className="mt-3 font-display text-xl font-black text-rose-100"
            >
              Đồng Đội Đã Rời Phòng
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
              Kết nối với đồng đội đã hết thời gian chờ. Bạn có thể quay về sảnh
              chờ để ghép lại hoặc chọn chế độ chơi khác.
            </p>
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <button
                ref={returnLobbyBtnRef}
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  playSfx('click');
                  if (room.isHost) {
                    room.returnToLobby();
                  } else {
                    onLeaveRoom();
                  }
                }}
                className={`btn-tactile-sky flex-1 cursor-pointer rounded-2xl px-4 py-2.5 text-sm font-black text-white ${FOCUS_RING_CLASS}`}
              >
                Về Sảnh Chờ
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  playSfx('click');
                  (onBackToModeSelect ?? onLeaveRoom)();
                }}
                className={`btn-tactile-wood flex-1 cursor-pointer rounded-2xl border border-white/20 px-4 py-2.5 text-sm font-black text-amber-100 ${FOCUS_RING_CLASS}`}
              >
                Chọn Chế Độ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM-CENTER: Interactive Co-op Skill Bar + Emotes */}
      <footer className="flex flex-col items-center gap-2">
        <CoopSkillBar
          mapId={activeMapId}
          mySlot={isHostSlot ? 'p1' : 'p2'}
          hud={hud}
          controlsEnabled={
            room.phase === 'playing' &&
            !isDisconnected &&
            hud.shatterTimer <= 0
          }
          onSendEmote={room.sendEmote}
        />
      </footer>
    </div>
  );
}
