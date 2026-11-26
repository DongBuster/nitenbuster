import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  HelpCircle,
  Pause,
  Play,
  ShieldAlert,
  Swords,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { playSfx } from '../../audio/soundEngine';
import { getSortedStandings } from '../sim/matchStore';
import type { HudSnapshot, MatchState, PressedSkillState } from '../sim/types';
import { BrawlSkillBar } from './BrawlSkillBar';

export interface BrawlHudProps {
  match: MatchState;
  hud: HudSnapshot;
  paused: boolean;
  controlsEnabled: boolean;
  pressedSkills: PressedSkillState;
  onTriggerSkill: (skill: 'punch' | 'headbutt' | 'roll' | 'jump') => void;
  onVirtualHold: (skill: 'grab' | 'sprint', held: boolean) => void;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  onTogglePause: () => void;
  onExit: () => void;
}

export function BrawlHud({
  match,
  hud,
  paused,
  controlsEnabled,
  pressedSkills,
  onTriggerSkill,
  onVirtualHold,
  sfxEnabled,
  onToggleSfx,
  onTogglePause,
  onExit,
}: BrawlHudProps) {
  const [showHelp, setShowHelp] = useState(false);
  const topScores = getSortedStandings(match.scores).slice(0, 4);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* TOP HUD: Header bar + Top-edge Notifications (keeps center arena unobstructed) */}
      <div className="flex flex-col gap-2">
        <header className="flex flex-wrap items-start justify-between gap-2">
          {/* Top-left: Exit, Round, Alive count, Collapse timer */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-2" data-brawl-ui="true">
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onExit();
              }}
              className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/20 px-3 py-1.5 text-xs font-black text-amber-100 shadow-md transition-colors focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-amber-300" />
              <span>Thoát</span>
            </button>

            <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-slate-950/85 px-3 py-1.5 text-xs font-black text-amber-200 shadow-md">
              <Swords className="h-3.5 w-3.5 text-amber-400" />
              <span>Hiệp {match.round}/{match.totalRounds}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/35 bg-slate-950/85 px-3 py-1.5 text-xs font-black text-emerald-200 shadow-md">
              <Users className="h-3.5 w-3.5 text-emerald-400" />
              <span>Còn sống: {hud.aliveCount}/{hud.totalFighters}</span>
            </div>

            {hud.nextCollapseRing !== null && hud.nextCollapseInSec !== null && (
              <div
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black shadow-md transition-colors ${
                  hud.isRingWarning
                    ? 'animate-pulse border-rose-300 bg-rose-600/90 text-white'
                    : 'border-sky-300/35 bg-slate-950/85 text-sky-200'
                }`}
              >
                {hud.isRingWarning ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-white" />
                    <span>Sàn vòng {hud.nextCollapseRing} SỤP!</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5 text-sky-300" />
                    <span>Sàn vòng {hud.nextCollapseRing} sụp ({Math.ceil(hud.nextCollapseInSec)}s)</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Top-right: Audio, Help (+ anchored popover), Pause */}
          <div className="pointer-events-auto relative flex items-center gap-2" data-brawl-ui="true">
            <button
              type="button"
              onClick={onToggleSfx}
              aria-label={sfxEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
              className="btn-tactile-wood cursor-pointer rounded-xl border border-white/20 p-2 text-amber-100 shadow-md"
            >
              {sfxEnabled ? (
                <Volume2 className="h-4 w-4 text-amber-300" />
              ) : (
                <VolumeX className="h-4 w-4 text-white/50" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              aria-label="Xem phím điều khiển"
              aria-expanded={showHelp}
              aria-controls="brawl-controls-popover"
              className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1 rounded-xl border border-white/20 px-2.5 py-2 text-xs font-black text-amber-100 shadow-md"
            >
              <HelpCircle className="h-4 w-4 text-amber-300" />
              <span>Phím</span>
            </button>

            <button
              type="button"
              onClick={onTogglePause}
              aria-label="Tạm dừng"
              className="btn-tactile-wood cursor-pointer rounded-xl border border-white/20 p-2 text-amber-100 shadow-md"
            >
              <Pause className="h-4 w-4 text-amber-300" />
            </button>

            {showHelp && (
              <div
                id="brawl-controls-popover"
                role="dialog"
                aria-label="Phím điều khiển"
                data-brawl-ui="true"
                className="pointer-events-auto absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-white/20 bg-slate-950/95 p-4 text-xs text-slate-100 shadow-2xl backdrop-blur-md"
              >
                <div className="mb-2 flex items-center justify-between gap-4 font-black text-amber-300">
                  <span>Phím Điều Khiển</span>
                  <button
                    type="button"
                    onClick={() => setShowHelp(false)}
                    className="cursor-pointer rounded bg-white/10 px-2 py-0.5 text-[10px] hover:bg-white/20"
                  >
                    Đóng
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-y-1 sm:grid-cols-2 sm:gap-x-4">
                  <span><strong>WASD + Shift</strong>: Chạy / Nước rút</span>
                  <span><strong>Space</strong>: Nhảy</span>
                  <span><strong>J / Chuột trái</strong>: Đấm / Dùng vũ khí (Trên không: Đá bay!)</span>
                  <span><strong>H / Chuột phải</strong>: Húc đầu (Kiếm/Xẻng: Xoay 360°)</span>
                  <span><strong>Giữ/Nhả K</strong>: Nắm & Xoay ném</span>
                  <span><strong>L</strong>: Lăn né · <strong>1–4</strong>: Emote</span>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Sub-header HUD strip: KO feed (top-left), event banner (top-center), standings (top-right) */}
        <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-3">
          {/* Top-left KO Feed (auto-expires after 3.5s) */}
          <div
            role="region"
            aria-label="Thông báo loại khỏi sàn"
            aria-live="polite"
            className="order-2 flex min-w-0 flex-col items-start gap-1 md:order-1 md:justify-self-start"
          >
            {hud.koFeed.slice(0, 2).map((item) => (
              <div
                key={item.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-rose-300/40 bg-rose-950/85 px-3 py-1 text-[11px] font-bold text-rose-100 shadow-md backdrop-blur-sm"
              >
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden="true" />
                <span className="truncate">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Top-center Event Banner (Ring collapse / Item pickup) */}
          <div
            role="status"
            aria-live="polite"
            className={
              hud.bannerText
                ? 'order-1 flex justify-center sm:col-span-2 md:order-2 md:col-span-1 md:justify-self-center'
                : 'sr-only md:not-sr-only md:order-2 md:justify-self-center'
            }
          >
            {hud.bannerText && (
              <div className="max-w-md rounded-full border border-amber-300/60 bg-slate-950/90 px-4 py-1.5 text-center text-xs font-black text-amber-200 shadow-lg backdrop-blur-md">
                {hud.bannerText}
              </div>
            )}
          </div>

          {/* Top-right Mini Standings */}
          <div className="order-3 hidden justify-self-end sm:block">
            <div className="rounded-2xl border border-white/15 bg-slate-950/85 px-3 py-2 text-xs shadow-xl">
              <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-sky-200">
                Bảng Điểm
              </div>
              <div className="space-y-0.5">
                {topScores.map((s, idx) => (
                  <div key={s.id} className="flex items-center justify-between gap-4 font-bold">
                    <span className={s.id === 'human' ? 'text-amber-300' : 'text-slate-200'}>
                      #{idx + 1} {s.name}
                    </span>
                    <span className="font-mono font-black text-amber-200">{s.points}đ</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* COUNTDOWN OVERLAY (3-2-1) */}
      {match.phase === 'countdown' && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-amber-300/70 bg-slate-950/85 px-10 py-6 text-center shadow-2xl backdrop-blur-md">
            <span className="text-xs font-black uppercase tracking-widest text-sky-200">
              Hiệp {match.round} / {match.totalRounds}
            </span>
            <div className="font-display text-6xl font-black text-amber-300 drop-shadow">
              {match.countdownSec > 0 ? match.countdownSec : 'CHIẾN!!'}
            </div>
          </div>
        </div>
      )}

      {/* ROUND OVER RANKING OVERLAY */}
      {match.phase === 'roundOver' && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-amber-300/70 bg-slate-950/92 p-6 text-white shadow-2xl backdrop-blur-md">
            <h2 className="text-center font-display text-2xl font-black text-amber-300">
              Hết Hiệp {match.round}/{match.totalRounds}!
            </h2>
            <p className="mt-1 text-center text-xs text-slate-300">
              Chuẩn bị sang {match.round < match.totalRounds ? `Hiệp ${match.round + 1}` : 'Tổng Kết'}...
            </p>
            <div className="mt-4 space-y-1.5">
              {match.lastRoundRankings.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold ${
                    r.id === 'human'
                      ? 'border border-amber-300/60 bg-amber-400/20 text-amber-200'
                      : 'bg-white/8 text-slate-200'
                  }`}
                >
                  <span>
                    Hạng #{r.rank} · {r.name}
                  </span>
                  <span className="font-mono font-black">
                    {r.pointsAwarded > 0 ? `+${r.pointsAwarded}đ` : '0đ'} (Tổng: {r.totalPoints}đ)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PAUSE OVERLAY */}
      {paused && (match.phase === 'fighting' || match.phase === 'countdown') && (
        <div
          data-brawl-ui="true"
          className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-slate-900 p-6 text-center text-white shadow-2xl">
            <h2 className="font-display text-2xl font-black text-amber-300">
              Tạm Dừng
            </h2>
            <p className="mt-2 text-xs text-slate-300">
              WASD + Shift chạy · Space nhảy · J đấm / đá bay · H húc đầu (Kiếm/Xẻng: xoay 360°) · K nắm ném · L lăn né
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onTogglePause}
                className="btn-tactile-amber inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-[#1B110B]"
              >
                <Play className="h-4 w-4" />
                <span>Tiếp Tục</span>
              </button>
              <button
                type="button"
                onClick={onExit}
                className="btn-tactile-wood inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/20 px-5 py-2.5 text-xs font-bold text-slate-200"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
                <span>Rời Đấu Trường</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM PLAYER STATUS DOCK */}
      <footer className="flex flex-col items-center gap-2">
        {!hud.playerAlive && match.phase === 'fighting' && (
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/60 bg-rose-950/90 px-4 py-1.5 text-xs font-black text-rose-100 shadow-xl">
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            <span>Bạn đã rơi khỏi sàn! Đang theo dõi các đối thủ còn lại...</span>
          </div>
        )}

        <BrawlSkillBar
          hud={hud}
          controlsEnabled={controlsEnabled}
          pressedSkills={pressedSkills}
          onTriggerSkill={onTriggerSkill}
          onVirtualHold={onVirtualHold}
        />
      </footer>
    </div>
  );
}
