import { useState } from 'react';
import { playSfx } from '../../audio/soundEngine';
import { ITEM_META } from '../sim/combat';
import { BRAWL_ANIMAL_EMOJI } from '../sim/constants';
import { getSortedStandings } from '../sim/matchStore';
import type { HudSnapshot, MatchState } from '../sim/types';

export interface BrawlHudProps {
  match: MatchState;
  hud: HudSnapshot;
  paused: boolean;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  onTogglePause: () => void;
  onExit: () => void;
}

export function BrawlHud({
  match,
  hud,
  paused,
  sfxEnabled,
  onToggleSfx,
  onTogglePause,
  onExit,
}: BrawlHudProps) {
  const [showHelp, setShowHelp] = useState(false);
  const topScores = getSortedStandings(match.scores).slice(0, 4);
  const balancePct = Math.max(
    0,
    Math.min(100, (hud.playerBalance / Math.max(1, hud.playerMaxBalance)) * 100),
  );
  const heldMeta = hud.playerHeldItem ? ITEM_META[hud.playerHeldItem] : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* TOP BAR */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        {/* Top-left: Exit, Round, Alive count, Collapse timer */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2" data-brawl-ui="true">
          <button
            type="button"
            onClick={() => {
              playSfx('click');
              onExit();
            }}
            className="cursor-pointer rounded-xl border border-white/20 bg-slate-950/80 px-3 py-1.5 text-xs font-extrabold text-amber-100 shadow-lg backdrop-blur-md hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            ← Thoát
          </button>

          <div className="rounded-xl border border-amber-300/40 bg-slate-950/80 px-3 py-1.5 text-xs font-black text-amber-200 shadow-lg backdrop-blur-md">
            🥊 Hiệp {match.round}/{match.totalRounds}
          </div>

          <div className="rounded-xl border border-emerald-300/35 bg-slate-950/80 px-3 py-1.5 text-xs font-black text-emerald-200 shadow-lg backdrop-blur-md">
            🐾 Còn sống: {hud.aliveCount}/{hud.totalFighters}
          </div>

          {hud.nextCollapseRing !== null && hud.nextCollapseInSec !== null && (
            <div
              className={`rounded-xl border px-3 py-1.5 text-xs font-black shadow-lg backdrop-blur-md transition-colors ${
                hud.isRingWarning
                  ? 'animate-pulse border-rose-300 bg-rose-600/90 text-white'
                  : 'border-sky-300/35 bg-slate-950/80 text-sky-200'
              }`}
            >
              {hud.isRingWarning
                ? `⚠️ Sàn vòng ${hud.nextCollapseRing} SỤP!`
                : `⏳ Sàn vòng ${hud.nextCollapseRing} sụp sau ${Math.ceil(hud.nextCollapseInSec)}s`}
            </div>
          )}
        </div>

        {/* Top-right: Mini Standings + Controls */}
        <div className="pointer-events-auto flex items-start gap-2" data-brawl-ui="true">
          <div className="hidden rounded-2xl border border-white/15 bg-slate-950/80 px-3 py-2 text-xs shadow-xl backdrop-blur-md sm:block">
            <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-sky-200">
              Bảng Điểm
            </div>
            <div className="space-y-0.5">
              {topScores.map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between gap-4 font-bold">
                  <span className={s.id === 'human' ? 'text-amber-300' : 'text-slate-200'}>
                    #{idx + 1} {BRAWL_ANIMAL_EMOJI[s.animal]} {s.name}
                  </span>
                  <span className="font-mono font-black text-amber-200">{s.points}đ</span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleSfx}
            aria-label={sfxEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            className="cursor-pointer rounded-xl border border-white/20 bg-slate-950/80 px-2.5 py-2 text-xs font-bold text-amber-100 shadow-lg backdrop-blur-md hover:bg-slate-800"
          >
            {sfxEnabled ? '🔊' : '🔇'}
          </button>

          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="cursor-pointer rounded-xl border border-white/20 bg-slate-950/80 px-2.5 py-2 text-xs font-extrabold text-amber-100 shadow-lg backdrop-blur-md hover:bg-slate-800"
          >
            ❓ Phím
          </button>

          <button
            type="button"
            onClick={onTogglePause}
            className="cursor-pointer rounded-xl border border-white/20 bg-slate-950/80 px-2.5 py-2 text-xs font-extrabold text-amber-100 shadow-lg backdrop-blur-md hover:bg-slate-800"
          >
            ⏸
          </button>
        </div>
      </header>

      {/* Center Dynamic Banners & Controls Popover */}
      <div className="pointer-events-none flex flex-col items-center gap-2">
        {hud.bannerText && (
          <div className="rounded-full border border-amber-300/60 bg-slate-950/90 px-4 py-1.5 text-xs font-black text-amber-200 shadow-2xl backdrop-blur-md sm:text-sm">
            {hud.bannerText}
          </div>
        )}

        {hud.koFeed.length > 0 && (
          <div className="flex flex-col items-center gap-1">
            {hud.koFeed.slice(0, 2).map((item) => (
              <div
                key={item.id}
                className="rounded-full border border-rose-300/40 bg-rose-950/80 px-3 py-0.5 text-[11px] font-bold text-rose-100 shadow-md"
              >
                {item.text}
              </div>
            ))}
          </div>
        )}

        {showHelp && (
          <div
            data-brawl-ui="true"
            className="pointer-events-auto rounded-2xl border border-white/20 bg-slate-950/95 p-4 text-xs text-slate-100 shadow-2xl backdrop-blur-md"
          >
            <div className="mb-2 flex items-center justify-between gap-4 font-black text-amber-300">
              <span>Phím Điều Khiển</span>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="cursor-pointer rounded bg-white/10 px-2 py-0.5 text-[10px]"
              >
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-1">
              <span><strong>WASD + Shift</strong>: Chạy / Nước rút</span>
              <span><strong>Space</strong>: Nhảy</span>
              <span><strong>J / Chuột trái</strong>: Đấm (Trên không: Đá bay!)</span>
              <span><strong>E / Chuột phải</strong>: Húc đầu</span>
              <span><strong>Giữ/Nhả K</strong>: Nắm & Xoay ném</span>
              <span><strong>L</strong>: Lăn né · <strong>1–4</strong>: Emote</span>
            </div>
          </div>
        )}
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
              🏁 Hết Hiệp {match.round}/{match.totalRounds}!
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
                    Hạng #{r.rank} · {BRAWL_ANIMAL_EMOJI[r.animal]} {r.name}
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
              ⏸ Tạm Dừng
            </h2>
            <p className="mt-2 text-xs text-slate-300">
              WASD + Shift chạy · Space nhảy · J đấm (trên không: đá bay) · E húc đầu · K nắm ném · L lăn né
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onTogglePause}
                className="cursor-pointer rounded-2xl bg-amber-400 px-5 py-3 text-sm font-black text-[#1B110B] hover:bg-amber-300"
              >
                ▶ Tiếp Tục
              </button>
              <button
                type="button"
                onClick={onExit}
                className="cursor-pointer rounded-2xl border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/20"
              >
                ← Rời Đấu Trường
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM PLAYER STATUS DOCK */}
      <footer className="flex flex-col items-center gap-2">
        {!hud.playerAlive && match.phase === 'fighting' && (
          <div className="rounded-full border border-rose-300/60 bg-rose-950/90 px-4 py-1.5 text-xs font-black text-rose-100 shadow-xl">
            💀 Bạn đã rơi khỏi sàn! Đang theo dõi các bot còn lại...
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-slate-950/85 px-4 py-2.5 text-xs text-white shadow-2xl backdrop-blur-md">
          {/* Balance / Stun Meter */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3 text-[11px] font-black">
              <span>
                {hud.playerFrozen
                  ? '🧊 ĐÓNG BĂNG!'
                  : hud.playerStunned
                    ? '💫 CHOÁNG NGÃ!'
                    : '⚖️ Thăng Bằng'}
              </span>
              <span className="font-mono text-amber-200">{Math.round(balancePct)}%</span>
            </div>
            <div className="h-2 w-36 overflow-hidden rounded-full bg-white/15">
              <div
                className={`h-full transition-all duration-150 ${
                  hud.playerStunned || balancePct < 35
                    ? 'bg-rose-500'
                    : hud.playerFrozen
                      ? 'bg-sky-400'
                      : 'bg-emerald-400'
                }`}
                style={{ width: `${balancePct}%` }}
              />
            </div>
          </div>

          <div className="h-7 w-px bg-white/15" />

          {/* Roll Cooldown */}
          <div className="flex items-center gap-1.5">
            <span className="rounded-lg bg-white/10 px-2 py-1 font-mono text-[11px] font-black text-sky-200">
              L
            </span>
            <span className="font-bold">
              {hud.playerRollReadyPct >= 0.99 ? 'Lăn: Sẵn sàng' : 'Đang hồi...'}
            </span>
          </div>

          <div className="h-7 w-px bg-white/15" />

          {/* Held Item / Grabbing */}
          <div className="flex items-center gap-1.5">
            {hud.playerGrabbingName ? (
              <span className="font-black text-amber-300">
                🤜 Đang giữ {hud.playerGrabbingName} (Nhả K để ném!)
              </span>
            ) : heldMeta ? (
              <span className="font-black text-amber-200">
                {heldMeta.emoji} {heldMeta.label} ×{hud.playerHeldAmmo} (J)
              </span>
            ) : (
              <span className="text-slate-300">✊ J đấm / đá bay · E húc đầu · K nắm/ném · Shift chạy nhanh</span>
            )}
          </div>

          {/* Active Buffs / Debuffs */}
          {(hud.playerSpeedLeft > 0 || hud.playerShieldLeft > 0 || hud.playerInverted) && (
            <>
              <div className="h-7 w-px bg-white/15" />
              <div className="flex items-center gap-2 font-black">
                {hud.playerSpeedLeft > 0 && (
                  <span className="rounded-full bg-cyan-500/25 px-2 py-0.5 text-cyan-200">
                    ⛸️ {hud.playerSpeedLeft.toFixed(1)}s
                  </span>
                )}
                {hud.playerShieldLeft > 0 && (
                  <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-amber-200">
                    🛡️ {hud.playerShieldLeft.toFixed(1)}s
                  </span>
                )}
                {hud.playerInverted && (
                  <span className="rounded-full bg-purple-500/35 px-2 py-0.5 text-purple-200">
                    🪃 Đảo phím!
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
