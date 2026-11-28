import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Crosshair,
  Flag,
  Infinity as InfinityIcon,
  Pause,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { AnimalAvatar } from '../../components/AnimalAvatar.tsx';
import {
  SKILLS,
  getGearSpec,
  getWeaponSpec,
} from '../sim/catalog.ts';
import { getSurvivalMapMeta } from '../sim/maps.ts';
import type { SurvivalHudSnapshot } from '../sim/types.ts';
import { GearArt, SkillArt, WeaponArt } from './SurvivalIcons.tsx';

export interface SurvivalHudProps {
  hud: SurvivalHudSnapshot;
  autoAim: boolean;
  onToggleAutoAim: () => void;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  onPause: () => void;
  touchControlsActive?: boolean;
}

const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';

function formatClock(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? Math.floor(sec) : 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const SKILL_RARITY_PILL_CLASS: Record<'common' | 'rare' | 'epic', string> = {
  common: 'border-white/15 bg-[#0a101d] text-slate-200',
  rare: 'border-cyan-400/55 bg-cyan-950/75 text-cyan-100',
  epic: 'border-amber-400/75 bg-gradient-to-r from-amber-950/75 to-fuchsia-950/75 text-amber-100',
};

const SKILL_RARITY_LABEL: Record<'common' | 'rare' | 'epic', string> = {
  common: 'Thường',
  rare: 'Hiếm',
  epic: 'Sử Thi',
};

/**
 * Non-blocking 2D gameplay HUD overlay for PAWS Survival.
 * Leaves the top-right quadrant below 72px clear for the 136x136 Canvas Minimap
 * and enables pointer events exclusively on interactive utility buttons.
 */
export function SurvivalHud({
  hud,
  autoAim,
  onToggleAutoAim,
  sfxEnabled,
  onToggleSfx,
  onPause,
  touchControlsActive = false,
}: SurvivalHudProps) {
  const xpRatio = Math.max(
    0,
    Math.min(1, hud.teamXp / Math.max(1, hud.xpToNext)),
  );
  const xpPct = Math.round(xpRatio * 100);

  const isEndlessHighlight =
    hud.mapId === 'endless_abyss' || hud.isEndlessActive;

  const hasNextBossCountdown =
    !hud.activeBoss &&
    typeof hud.nextBossInSec === 'number' &&
    Number.isFinite(hud.nextBossInSec) &&
    hud.nextBossInSec > 0;

  const local = hud.localPlayer;
  const localHpMax = Math.max(1, local.maxHp);
  const localHpPct = Math.max(0, Math.min(100, (local.hp / localHpMax) * 100));
  const dashReadyRatio = Math.max(
    0,
    Math.min(1, 1 - local.dashCooldownPct),
  );
  const dashReadyPct = Math.round(dashReadyRatio * 100);
  const isDashReady = local.dashCooldownPct <= 0.01;
  const localWeapon = getWeaponSpec(local.weaponId);
  const localGear = getGearSpec(local.gearId);
  const acquiredSkills = SKILLS.filter(
    (spec) => (local.skills[spec.id] ?? 0) > 0,
  );
  const secondarySkills = acquiredSkills.filter(
    (spec) => spec.category === 'secondary',
  );
  const passiveSkills = acquiredSkills.filter(
    (spec) => spec.category !== 'secondary',
  );

  const mapMeta = getSurvivalMapMeta(hud.mapId);
  const currentChapterIdx = isEndlessHighlight
    ? hud.elapsedSec >= 360
      ? 2
      : hud.elapsedSec >= 90
        ? 1
        : 0
    : Math.min(2, hud.bossesSlain);
  const activeChapter =
    mapMeta.scenario.chapters[currentChapterIdx] ?? mapMeta.scenario.chapters[0];

  const [scenarioBanner, setScenarioBanner] = useState<{
    title: string;
    subtitle: string;
    tone: 'chapter' | 'event' | 'boss';
  } | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const prevStateRef = useRef<{
    mapId: string;
    chapterIdx: number;
    sandstorm: boolean;
    activeBossName: string | null;
    initialized: boolean;
  }>({
    mapId: hud.mapId,
    chapterIdx: currentChapterIdx,
    sandstorm: hud.sandstormActive,
    activeBossName: hud.activeBoss?.name ?? null,
    initialized: false,
  });

  useEffect(() => {
    const showBanner = (
      title: string,
      subtitle: string,
      tone: 'chapter' | 'event' | 'boss',
    ) => {
      setScenarioBanner({ title, subtitle, tone });
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
      bannerTimerRef.current = window.setTimeout(() => {
        bannerTimerRef.current = null;
        setScenarioBanner(null);
      }, 3400);
    };

    const prev = prevStateRef.current;
    const bossName = hud.activeBoss?.name ?? null;

    if (!prev.initialized || prev.mapId !== hud.mapId) {
      prev.initialized = true;
      prev.mapId = hud.mapId;
      prev.chapterIdx = currentChapterIdx;
      prev.sandstorm = hud.sandstormActive;
      prev.activeBossName = bossName;
      if (hud.elapsedSec < 5) {
        showBanner(
          activeChapter.title,
          mapMeta.scenario.headline,
          'chapter',
        );
      }
      return;
    }

    if (bossName && bossName !== prev.activeBossName) {
      showBanner(
        hud.activeBoss?.isFinalBoss ? 'BOSS CUỐI XUẤT HIỆN!' : 'BOSS XUẤT HIỆN!',
        `${bossName} — ${hud.activeBoss?.isFinalBoss ? 'Tiêu diệt để chiến thắng!' : 'Hạ gục để mở Rương Hiếm!'}`,
        'boss',
      );
    } else if (hud.sandstormActive && !prev.sandstorm) {
      showBanner(
        'BÃO CÁT NGỌT THỔI QUA!',
        'Gió đẩy lùi nhẹ · Hòm tiếp tế xuất hiện gấp đôi!',
        'event',
      );
    } else if (currentChapterIdx > prev.chapterIdx) {
      showBanner(activeChapter.title, activeChapter.summary, 'chapter');
    }

    prev.chapterIdx = currentChapterIdx;
    prev.sandstorm = hud.sandstormActive;
    prev.activeBossName = bossName;
  }, [
    hud.mapId,
    hud.elapsedSec,
    hud.sandstormActive,
    hud.activeBoss?.name,
    hud.activeBoss?.isFinalBoss,
    currentChapterIdx,
    activeChapter.title,
    activeChapter.summary,
    mapMeta.scenario.headline,
  ]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const campaignNodes = !isEndlessHighlight
    ? [
        {
          id: 'ch1',
          label: 'Ch.1',
          done: hud.bossesSlain >= 1 || (hud.bossesSlain === 0 && Boolean(hud.activeBoss)),
          active: hud.bossesSlain === 0 && !hud.activeBoss,
          isBoss: false,
        },
        {
          id: 'b1',
          label: 'B1',
          done: hud.bossesSlain >= 1,
          active: hud.bossesSlain === 0 && Boolean(hud.activeBoss),
          isBoss: true,
        },
        {
          id: 'ch2',
          label: 'Ch.2',
          done: hud.bossesSlain >= 2 || (hud.bossesSlain === 1 && Boolean(hud.activeBoss)),
          active: hud.bossesSlain === 1 && !hud.activeBoss,
          isBoss: false,
        },
        {
          id: 'b2',
          label: 'B2',
          done: hud.bossesSlain >= 2,
          active: hud.bossesSlain === 1 && Boolean(hud.activeBoss),
          isBoss: true,
        },
        {
          id: 'ch3',
          label: 'Ch.3',
          done: hud.bossesSlain >= 3 || (hud.bossesSlain === 2 && Boolean(hud.activeBoss)),
          active: hud.bossesSlain === 2 && !hud.activeBoss,
          isBoss: false,
        },
        {
          id: 'b3',
          label: 'Boss Cuối',
          done: hud.bossesSlain >= 3,
          active: Boolean(hud.activeBoss?.isFinalBoss),
          isBoss: true,
        },
      ]
    : [];

  const missionHint = hud.activeBoss
    ? hud.activeBoss.isFinalBoss
      ? `Mục tiêu: Hạ ${hud.activeBoss.name} để chiến thắng màn chơi!`
      : `Mục tiêu: Hạ ${hud.activeBoss.name} nhận Rương Hiếm!`
    : isEndlessHighlight
      ? `Đấu Trường Vô Cực · Đã hạ ${hud.bossesSlain} Boss · Độ khó leo thang liên tục`
      : `${activeChapter.title} · ${activeChapter.enemyHint}`;

  const bossHpPct = hud.activeBoss
    ? Math.max(
        0,
        Math.min(
          100,
          (hud.activeBoss.hp / Math.max(1, hud.activeBoss.maxHp)) * 100,
        ),
      )
    : 0;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between select-none">
      {/* Top Full-Width XP Bar */}
      <div className="fixed inset-x-0 top-0 z-30">
        <div
          role="progressbar"
          aria-label={`Kinh nghiệm đội cấp ${hud.teamLevel}`}
          aria-valuemin={0}
          aria-valuemax={Math.max(1, hud.xpToNext)}
          aria-valuenow={Math.max(0, Math.round(hud.teamXp))}
          className="relative h-2.5 w-full overflow-hidden bg-[#070b14]/90 shadow-md"
        >
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 shadow-[0_0_14px_rgba(45,212,191,0.85)] transition-[width] duration-150 motion-reduce:transition-none"
            style={{ width: `${xpPct}%` }}
          />
        </div>
      </div>

      {/* Top Row: Utilities (Left) + Match Info Pill (Center) + Clear Top-Right Minimap Zone */}
      <div className="safe-top-bar flex flex-col gap-2 pt-4">
        <header className="grid grid-cols-1 items-start gap-2 md:grid-cols-[1fr_auto_1fr]">
          {/* Top-Left Utility Buttons */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 justify-self-start">
            <button
              type="button"
              onClick={(e) => {
                if (e.detail > 0) e.currentTarget.blur();
                onPause();
              }}
              aria-label="Tạm dừng"
              className={`btn-tactile-wood inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl border border-amber-400/35 px-3 py-1.5 text-xs font-black text-amber-100 shadow-md ${FOCUS_RING_CLASS}`}
            >
              <Pause aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
              <span className="hidden sm:inline">Tạm dừng</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                if (e.detail > 0) e.currentTarget.blur();
                onToggleSfx();
              }}
              aria-label="Âm thanh SFX"
              aria-pressed={sfxEnabled}
              className={`btn-tactile-wood inline-flex min-h-[38px] min-w-[38px] cursor-pointer items-center justify-center rounded-xl border border-white/20 p-2 text-amber-100 shadow-md ${FOCUS_RING_CLASS}`}
            >
              {sfxEnabled ? (
                <Volume2 aria-hidden="true" className="h-4 w-4 text-cyan-300" />
              ) : (
                <VolumeX aria-hidden="true" className="h-4 w-4 text-slate-400" />
              )}
            </button>

            <button
              type="button"
              aria-pressed={autoAim}
              onClick={(e) => {
                if (e.detail > 0) e.currentTarget.blur();
                onToggleAutoAim();
              }}
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black shadow-md backdrop-blur-md transition-colors motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                autoAim
                  ? 'border-emerald-400/60 bg-emerald-950/85 text-emerald-200 hover:bg-emerald-900/90'
                  : 'border-amber-400/65 bg-amber-950/85 text-amber-200 hover:bg-amber-900/90'
              }`}
            >
              <Crosshair
                aria-hidden="true"
                className={`h-3.5 w-3.5 ${
                  autoAim ? 'text-emerald-300' : 'text-amber-300'
                }`}
              />
              <span>Tự ngắm: {autoAim ? 'BẬT' : 'TẮT'} [Q]</span>
            </button>
          </div>

          {/* Top-Center Info Pill */}
          <div className="flex max-w-[calc(100vw-11rem)] flex-wrap items-center justify-start gap-2 justify-self-start rounded-2xl border border-white/15 bg-[#0d1424]/88 px-3 py-1.5 text-xs font-black text-white shadow-xl backdrop-blur-md md:max-w-none md:justify-center md:justify-self-center">
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/45 bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] font-black text-emerald-200 tabular-nums">
              <Zap aria-hidden="true" className="h-3 w-3 text-emerald-300" />
              <span>LV.{hud.teamLevel}</span>
            </span>

            <span className="inline-flex items-center gap-1 font-mono text-cyan-200 tabular-nums">
              <Clock aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
              <span className="sr-only">Thời gian: </span>
              <span>{formatClock(hud.elapsedSec)}</span>
            </span>

            <span className="text-white/20" aria-hidden="true">
              |
            </span>

            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-mono tabular-nums ${
                isEndlessHighlight
                  ? 'border border-amber-300/60 bg-amber-400/20 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                  : 'text-amber-200'
              }`}
            >
              {isEndlessHighlight ? (
                <InfinityIcon
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-amber-300"
                />
              ) : (
                <Sparkles
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-amber-300"
                />
              )}
              <span className="sr-only">Điểm số: </span>
              <span>{hud.score.toLocaleString('vi-VN')}</span>
            </span>

            <span className="text-white/20" aria-hidden="true">
              |
            </span>

            <span className="inline-flex items-center gap-1 font-mono text-rose-200 tabular-nums">
              <Swords aria-hidden="true" className="h-3.5 w-3.5 text-rose-300" />
              <span className="sr-only">Quái đã hạ: </span>
              <span>{hud.totalKills.toLocaleString('vi-VN')}</span>
            </span>

            {hud.activeBoss ? (
              <>
                <span className="text-white/20" aria-hidden="true">
                  |
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-rose-400/70 bg-rose-500/25 px-2 py-0.5 text-[11px] font-black text-rose-100">
                  <Skull aria-hidden="true" className="h-3 w-3 text-rose-300" />
                  <span>
                    {hud.activeBoss.isFinalBoss ? 'HẠ BOSS CUỐI' : 'ĐANG ĐẤU BOSS'}
                  </span>
                </span>
              </>
            ) : (
              hasNextBossCountdown && (
                <>
                  <span className="text-white/20" aria-hidden="true">
                    |
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 font-mono text-[11px] font-black text-rose-200 tabular-nums">
                    <Skull
                      aria-hidden="true"
                      className="h-3 w-3 text-rose-300"
                    />
                    <span>Boss sau {formatClock(Math.ceil(hud.nextBossInSec))}</span>
                  </span>
                </>
              )
            )}
          </div>

          {/* Right Spacer keeping top-right clear below top: 72px for the 136x136 Canvas Minimap */}
          <div className="hidden md:block" aria-hidden="true" />
        </header>

        {/* Center Alerts: Campaign Scenario Stepper, Chapter Banner, Boss Warning, Boss HP Bar, Sandstorm */}
        <div className="flex flex-col items-start gap-2 sm:items-center sm:px-40">
          {/* Compact Scenario Progression Strip */}
          <div className="hidden max-w-[calc(100vw-11rem)] flex-col items-center gap-1 rounded-2xl border border-white/12 bg-[#0c1322]/82 px-3 py-1.5 shadow-lg backdrop-blur-md sm:flex [@media(max-height:560px)]:hidden">
            {!isEndlessHighlight ? (
              <div className="flex items-center gap-1 text-[10px] font-black">
                {campaignNodes.map((node, idx) => (
                  <div key={node.id} className="flex items-center gap-1">
                    {idx > 0 && (
                      <span
                        aria-hidden="true"
                        className={`h-0.5 w-2.5 rounded-full ${
                          node.done || node.active ? 'bg-amber-400/75' : 'bg-white/15'
                        }`}
                      />
                    )}
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 ${
                        node.active
                          ? node.isBoss
                            ? 'border-rose-400/80 bg-rose-500/30 text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.35)]'
                            : 'border-amber-300/80 bg-amber-400/25 text-amber-100'
                          : node.done
                            ? 'border-emerald-400/45 bg-emerald-500/20 text-emerald-200'
                            : 'border-white/10 bg-white/5 text-slate-400'
                      }`}
                    >
                      {node.done && <Check aria-hidden="true" className="h-2.5 w-2.5" />}
                      {!node.done && node.isBoss && (
                        <Skull aria-hidden="true" className="h-2.5 w-2.5" />
                      )}
                      <span>{node.label}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-200">
                <InfinityIcon aria-hidden="true" className="h-3 w-3 text-amber-300" />
                <span>{activeChapter.title}</span>
              </div>
            )}
            <p className="max-w-md truncate text-[10px] font-bold text-slate-300">
              {missionHint}
            </p>
          </div>

          {/* Non-blocking Chapter / Event Announcement Toast */}
          {scenarioBanner && !hud.bossWarningSec && (
            <div
              role="status"
              aria-live="polite"
              className={`max-w-[calc(100vw-11rem)] rounded-2xl border px-3.5 py-1.5 text-center shadow-xl backdrop-blur-md transition-opacity motion-reduce:transition-none sm:max-w-md ${
                scenarioBanner.tone === 'boss'
                  ? 'border-rose-400/75 bg-rose-950/88 text-rose-100'
                  : scenarioBanner.tone === 'event'
                    ? 'border-amber-400/75 bg-amber-950/88 text-amber-100'
                    : 'border-cyan-400/65 bg-[#0c192d]/90 text-cyan-100'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 text-xs font-black">
                <Flag aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span>{scenarioBanner.title}</span>
              </div>
              <p className="mt-0.5 text-[10px] font-bold opacity-90">
                {scenarioBanner.subtitle}
              </p>
            </div>
          )}

          {hud.bossWarningSec > 0 && (
            <div className="max-w-[calc(100vw-10.5rem)] animate-pulse rounded-2xl border-2 border-rose-400/80 bg-rose-950/92 px-4 py-2 text-center text-xs font-black text-rose-100 shadow-2xl backdrop-blur-md motion-reduce:animate-none sm:max-w-md sm:text-sm">
              <span role="status" aria-live="polite" className="sr-only">
                Cảnh báo Boss {hud.bossWarningName ?? 'Boss'} sắp xuất hiện!
              </span>
              <div className="flex items-center justify-center gap-2">
                <AlertTriangle
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-rose-300"
                />
                <span>
                  CẢNH BÁO BOSS: {hud.bossWarningName ?? 'Boss'} sau{' '}
                  {Math.max(1, Math.ceil(hud.bossWarningSec))}s!
                </span>
              </div>
            </div>
          )}

          {hud.activeBoss && (
            <div className="w-[min(calc(100vw-10.5rem),28rem)] rounded-2xl border-2 border-rose-500/65 bg-[#1b0c12]/92 px-3.5 py-2 shadow-2xl backdrop-blur-md sm:w-[min(28rem,calc(100vw-21rem))]">
              <div className="flex items-center justify-between gap-2 text-xs font-black">
                <span className="inline-flex items-center gap-1.5 truncate text-rose-100">
                  <Skull
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-rose-400"
                  />
                  <span className="truncate">
                    {hud.activeBoss.name} (Bậc {hud.activeBoss.tier})
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-rose-200 tabular-nums">
                  {hud.activeBoss.hp.toLocaleString('vi-VN')}/
                  {hud.activeBoss.maxHp.toLocaleString('vi-VN')}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`Máu Boss ${hud.activeBoss.name}`}
                aria-valuemin={0}
                aria-valuemax={Math.max(1, hud.activeBoss.maxHp)}
                aria-valuenow={Math.max(0, hud.activeBoss.hp)}
                className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full border border-rose-300/25 bg-black/60"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-600 via-red-500 to-amber-400 transition-[width] duration-100 motion-reduce:transition-none"
                  style={{ width: `${bossHpPct}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-center text-[10px] font-black tracking-wide text-amber-200">
                {hud.activeBoss.isFinalBoss
                  ? 'Hạ Boss Cuối để chiến thắng màn chơi!'
                  : 'Hạ Boss để nhận rương kỹ năng Hiếm!'}
              </div>
            </div>
          )}

          {hud.sandstormActive && (
            <div
              role="status"
              aria-live="polite"
              className="inline-flex max-w-[calc(100vw-10.5rem)] items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-950/90 px-3.5 py-1 text-xs font-black text-amber-200 shadow-lg backdrop-blur-md"
            >
              <Wind aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
              <span>Bão cát — Hòm tiếp tế ×2</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom & Left Stack: Squad Teammates + Local Player Status Card */}
      <div className="safe-bottom-bar flex flex-col items-start gap-2 sm:gap-2.5">
        {/* Left Squad Stack (compact horizontal strip on narrow/short screens) */}
        {hud.teammates.length > 0 && (
          <section
            aria-label="Trạng thái đồng đội"
            className="flex max-w-[calc(100vw-1.5rem)] flex-row flex-wrap gap-1.5 sm:w-[14.5rem] sm:flex-col [@media(max-height:540px)]:flex-row"
          >
            {hud.teammates.map((mate) => {
              const mateHpMax = Math.max(1, mate.maxHp);
              const mateHpPct = Math.max(
                0,
                Math.min(100, (mate.hp / mateHpMax) * 100),
              );
              const revivePct = Math.round(
                Math.max(0, Math.min(1, mate.reviveProgress)) * 100,
              );

              return (
                <div
                  key={mate.id}
                  className={`min-w-[7.5rem] rounded-2xl border px-2 py-1.5 shadow-lg backdrop-blur-md sm:w-full sm:px-2.5 sm:py-2 ${
                    mate.downed
                      ? 'border-emerald-400/75 bg-emerald-950/88'
                      : 'border-white/15 bg-[#0d1424]/85'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AnimalAvatar animal={mate.animal} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex min-w-0 items-center gap-1">
                          <span className="truncate text-[11px] font-black text-white">
                            {mate.name}
                          </span>
                          {mate.isBot && (
                            <span className="hidden shrink-0 rounded bg-sky-500/25 px-1 py-0.5 text-[9px] font-black text-sky-200 sm:inline">
                              Bot
                            </span>
                          )}
                        </div>
                        <span className="hidden shrink-0 font-mono text-[10px] font-bold text-slate-300 tabular-nums sm:inline">
                          {Math.max(0, Math.ceil(mate.hp))}/{Math.ceil(mateHpMax)}
                        </span>
                      </div>

                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/50">
                        <div
                          className={`h-full rounded-full transition-[width] duration-100 motion-reduce:transition-none ${
                            mate.downed ? 'bg-rose-500' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${mateHpPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {mate.downed && (
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center justify-between gap-1 text-[10px] font-black text-emerald-200">
                        <span className="animate-pulse motion-reduce:animate-none">
                          CỨU NGAY!
                        </span>
                        <span className="font-mono tabular-nums">
                          {revivePct}%
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`Tiến độ hồi sinh ${mate.name}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={revivePct}
                        className="h-1.5 w-full overflow-hidden rounded-full bg-black/55"
                      >
                        <div
                          className="h-full rounded-full bg-emerald-300 transition-[width] duration-100 motion-reduce:transition-none"
                          style={{ width: `${revivePct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* Bottom-Left Local Player Status Card */}
        <section
          aria-label="Trạng thái nhân vật"
          className={`w-[min(21.5rem,calc(100vw-1.5rem))] rounded-3xl border border-amber-400/35 bg-[#121826]/90 p-2.5 text-white shadow-2xl backdrop-blur-md sm:p-3 ${
            touchControlsActive ? 'mb-44' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <AnimalAvatar animal={local.animal} size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-display text-sm font-black text-amber-50">
                    {local.name}
                  </span>
                  {local.downed && (
                    <span className="animate-pulse rounded-md border border-rose-400/60 bg-rose-500/25 px-1.5 py-0.5 text-[10px] font-black text-rose-200 motion-reduce:animate-none">
                      ĐANG GỤC
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] font-black">
                  <span
                    className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5"
                    style={{
                      borderColor: `${localWeapon.color}66`,
                      backgroundColor: `${localWeapon.color}1f`,
                      color: localWeapon.color,
                    }}
                  >
                    <WeaponArt weaponId={local.weaponId} className="h-3.5 w-3.5 shrink-0" />
                    <span>{localWeapon.shortName}</span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5"
                    style={{
                      borderColor: `${localGear.color}66`,
                      backgroundColor: `${localGear.color}1f`,
                      color: localGear.color,
                    }}
                  >
                    <GearArt gearId={local.gearId} className="h-3.5 w-3.5 shrink-0" />
                    <span>{localGear.name}</span>
                  </span>
                </div>
              </div>
            </div>

            {local.comboCount >= 3 && (
              <span className="shrink-0 rounded-xl border border-amber-300/65 bg-gradient-to-r from-amber-400 to-orange-400 px-2.5 py-1 font-mono text-xs font-black text-[#24130a] shadow">
                ×{local.comboCount}
              </span>
            )}
          </div>

          {/* HP & Dash Bars */}
          <div className="mt-2.5 space-y-1.5">
            <div>
              <div className="flex items-center justify-between text-[11px] font-black">
                <span className="text-emerald-200">Máu</span>
                <span className="font-mono text-white tabular-nums">
                  {Math.max(0, Math.ceil(local.hp))} / {Math.ceil(localHpMax)}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Máu hiện tại"
                aria-valuemin={0}
                aria-valuemax={Math.ceil(localHpMax)}
                aria-valuenow={Math.max(0, Math.ceil(local.hp))}
                className="mt-0.5 h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-[#080d18]"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-100 motion-reduce:transition-none ${
                    localHpPct <= 30
                      ? 'bg-gradient-to-r from-rose-600 to-rose-400'
                      : 'bg-gradient-to-r from-emerald-500 to-green-400'
                  }`}
                  style={{ width: `${localHpPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] font-extrabold">
                <span className="text-cyan-200/90">Lướt né [Space]</span>
                <span
                  className={`font-mono tabular-nums ${
                    isDashReady ? 'text-cyan-300' : 'text-slate-400'
                  }`}
                >
                  {isDashReady ? 'Sẵn sàng' : `${dashReadyPct}%`}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Hồi chiêu lướt né"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={dashReadyPct}
                className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full border border-white/10 bg-[#080d18]"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-75 motion-reduce:transition-none ${
                    isDashReady
                      ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.75)]'
                      : 'bg-sky-700'
                  }`}
                  style={{ width: `${dashReadyPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Split Skill Rack: Active Auto-Secondary Tray + Passive Pills */}
          {secondarySkills.length > 0 && (
            <div className="mt-2.5 border-t border-white/10 pt-2 [@media(max-height:480px)]:hidden">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-wide text-violet-200">
                <span className="inline-flex items-center gap-1">
                  <Zap aria-hidden="true" className="h-3 w-3 text-cyan-300" />
                  <span>Chiêu phụ tự động</span>
                </span>
                <span className="font-mono text-[9px] text-slate-400">
                  {secondarySkills.length} đang bật
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {secondarySkills.map((spec) => {
                  const lv = local.skills[spec.id] ?? 0;
                  const cd = local.secondaryCooldowns?.[spec.id];
                  const isAlwaysOn = !cd || cd.max <= 0;
                  const rem = cd ? Math.max(0, cd.remaining) : 0;
                  const isReady = isAlwaysOn || rem <= 0.05;
                  const cdPct =
                    !isAlwaysOn && cd && cd.max > 0
                      ? Math.max(0, Math.min(100, (rem / cd.max) * 100))
                      : 0;

                  return (
                    <div
                      key={spec.id}
                      title={`${spec.name} · Chiêu phụ tự động (${SKILL_RARITY_LABEL[spec.rarity]}, Cấp ${lv})`}
                      className={`relative flex h-12 w-12 flex-col items-center justify-center overflow-hidden rounded-xl border-2 bg-[#090e1a] shadow-md ${
                        isReady
                          ? 'border-cyan-300/85 shadow-[0_0_12px_rgba(34,211,238,0.3)]'
                          : 'border-white/20'
                      }`}
                    >
                      <SkillArt skillId={spec.id} className="h-7 w-7" />

                      {/* Cooldown Curtain Overlay */}
                      {!isReady && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#050811]/75 transition-[height] duration-75 motion-reduce:transition-none"
                          style={{ height: `${cdPct}%` }}
                        />
                      )}

                      {/* Level Badge */}
                      <span className="absolute right-0.5 top-0.5 rounded bg-black/80 px-1 font-mono text-[8px] font-black text-amber-300">
                        C.{lv}
                      </span>

                      {/* Ready / Active / Countdown Footer */}
                      <span
                        className={`relative z-10 mt-0.5 rounded px-1 font-mono text-[8px] font-black leading-none tabular-nums ${
                          isAlwaysOn
                            ? 'bg-emerald-500/25 text-emerald-200'
                            : isReady
                              ? 'bg-cyan-500/25 text-cyan-200'
                              : 'bg-black/75 text-amber-200'
                        }`}
                      >
                        {isAlwaysOn
                          ? 'BẬT'
                          : isReady
                            ? 'SẴN'
                            : `${rem.toFixed(1)}s`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {passiveSkills.length > 0 && (
            <div className="mt-2 hidden flex-col gap-1 border-t border-white/10 pt-2 sm:flex [@media(max-height:540px)]:hidden">
              <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                Nội tại ({passiveSkills.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {passiveSkills.map((spec) => {
                  const lv = local.skills[spec.id] ?? 0;
                  const shieldCd = local.secondaryCooldowns?.[spec.id];
                  const hasShieldTimer = Boolean(shieldCd && shieldCd.max > 0);
                  const shieldReady = hasShieldTimer && (shieldCd?.remaining ?? 0) <= 0.05;

                  return (
                    <span
                      key={spec.id}
                      title={`${spec.name} · Nội tại (${SKILL_RARITY_LABEL[spec.rarity]}, Cấp ${lv})`}
                      className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-bold ${SKILL_RARITY_PILL_CLASS[spec.rarity]}`}
                    >
                      <SkillArt skillId={spec.id} className="h-3.5 w-3.5 shrink-0" />
                      <span>{spec.name}</span>
                      <span className="font-mono font-black text-amber-300">
                        C.{lv}
                      </span>
                      {hasShieldTimer && (
                        <span
                          className={`inline-flex items-center gap-0.5 rounded px-1 font-mono text-[9px] font-black tabular-nums ${
                            shieldReady
                              ? 'bg-amber-400/25 text-amber-200'
                              : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          <Shield aria-hidden="true" className="h-2.5 w-2.5" />
                          <span>
                            {shieldReady ? 'Sẵn' : `${shieldCd!.remaining.toFixed(0)}s`}
                          </span>
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
