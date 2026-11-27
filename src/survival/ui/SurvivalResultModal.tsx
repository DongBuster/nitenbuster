import { useId } from 'react';
import {
  ArrowLeft,
  Cookie,
  Crown,
  Flame,
  HeartHandshake,
  Infinity as InfinityIcon,
  RotateCcw,
  Skull,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import { playSfx } from '../../audio/soundEngine.ts';
import { AnimalAvatar } from '../../components/AnimalAvatar.tsx';
import { getWeaponSpec } from '../sim/catalog.ts';
import { getSurvivalMapMeta } from '../sim/maps.ts';
import type { SurvivalMatchSummary, SurvivalMode } from '../sim/types.ts';
import {
  SURVIVAL_FOCUS_RING_CLASS,
  SurvivalDialogShell,
  setNativeAutofocus,
} from './LevelUpModal.tsx';

export interface SurvivalResultModalProps {
  open: boolean;
  summary: SurvivalMatchSummary | null;
  cookiesEarned: number;
  isNewBestScore: boolean;
  isNewBestTime: boolean;
  isHostOrOffline: boolean;
  hostLeft?: boolean;
  onContinueEndless: () => void;
  onPlayAgain: () => void;
  onReturnLobby: () => void;
}

const MODE_LABELS: Record<SurvivalMode, string> = {
  solo: 'Solo',
  bot_team: 'Team + Bot AI',
  online_coop: 'Phòng Online Co-op',
};

function formatClock(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? Math.floor(sec) : 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Native modal dialog displaying PAWS Survival match victory/end summary,
 * earned Cookies, core combat stats, sorted 1-4 player leaderboard, and Endless/Replay controls.
 */
export function SurvivalResultModal({
  open,
  summary,
  cookiesEarned,
  isNewBestScore,
  isNewBestTime,
  isHostOrOffline,
  hostLeft = false,
  onContinueEndless,
  onPlayAgain,
  onReturnLobby,
}: SurvivalResultModalProps) {
  const titleId = useId();
  const descId = useId();

  const isOpen = open && summary !== null;
  const mapMeta = summary ? getSurvivalMapMeta(summary.mapId) : null;
  const isCampaignVictory = Boolean(summary?.victory && !summary.isEndless);

  const sortedPlayers = summary
    ? [...summary.players].sort(
        (a, b) =>
          b.score - a.score ||
          b.kills - a.kills ||
          b.damageDealt - a.damageDealt,
      )
    : [];

  return (
    <SurvivalDialogShell
      open={isOpen}
      titleId={titleId}
      describedById={descId}
      dialogClassName={`m-auto max-h-[92dvh] w-[min(95vw,44rem)] overflow-y-auto rounded-3xl border-2 bg-[#121826] p-0 text-[#FFF9F0] shadow-2xl ${
        isCampaignVictory
          ? 'border-amber-400/75 bg-[radial-gradient(circle_at_50%_0%,_rgba(251,191,36,0.2)_0%,_rgba(18,24,38,0.98)_65%)]'
          : 'border-amber-500/40 bg-[radial-gradient(circle_at_50%_0%,_rgba(244,63,94,0.14)_0%,_rgba(18,24,38,0.98)_65%)]'
      }`}
    >
      {summary && mapMeta && (
        <>
          {/* Header */}
          <header className="text-center">
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border shadow-inner ${
                isCampaignVictory
                  ? 'border-amber-300/60 bg-amber-400/20 text-amber-300'
                  : 'border-rose-400/45 bg-rose-500/15 text-rose-300'
              }`}
            >
              {isCampaignVictory ? (
                <Crown aria-hidden="true" className="h-7 w-7 text-amber-300" />
              ) : (
                <Trophy aria-hidden="true" className="h-7 w-7 text-amber-300" />
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
              <span
                className="rounded-full border px-2.5 py-0.5"
                style={{
                  borderColor: `${mapMeta.theme.accent}66`,
                  backgroundColor: `${mapMeta.theme.accent}1f`,
                  color: mapMeta.theme.accent,
                }}
              >
                {mapMeta.name}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-slate-300">
                {MODE_LABELS[summary.mode]}
              </span>
              {(summary.isEndless || mapMeta.isEndless) && (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/50 bg-violet-500/20 px-2.5 py-0.5 text-violet-200">
                  <InfinityIcon aria-hidden="true" className="h-3 w-3" />
                  <span>Endless</span>
                </span>
              )}
            </div>

            <h1
              id={titleId}
              className={`mt-2.5 font-display text-2xl font-black sm:text-3xl ${
                isCampaignVictory ? 'text-amber-300' : 'text-amber-50'
              }`}
            >
              {isCampaignVictory ? 'CHIẾN THẮNG!' : 'KẾT THÚC SINH TỒN'}
            </h1>

            <p id={descId} className="mt-1 text-xs font-bold text-slate-300">
              {isCampaignVictory
                ? summary.mode === 'solo'
                  ? `Bạn đã hạ gục Rồng Tuyết Cổ Đại và chinh phục ${mapMeta.name}!`
                  : `Cả đội đã hạ gục Rồng Tuyết Cổ Đại và chinh phục ${mapMeta.name}!`
                : summary.victory && summary.isEndless
                  ? `Hoàn thành chiến dịch và chinh phục chế độ Vô Tận tại ${mapMeta.name}.`
                  : `Tổng kết hành trình sinh tồn tại ${mapMeta.name}.`}
            </p>

            {(isNewBestScore || isNewBestTime) && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {isNewBestScore && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/75 bg-gradient-to-r from-amber-400 to-orange-400 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#24130a] shadow">
                    <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                    <span>KỶ LỤC ĐIỂM MỚI!</span>
                  </span>
                )}
                {isNewBestTime && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/70 bg-gradient-to-r from-cyan-400 to-emerald-400 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#07212a] shadow">
                    <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                    <span>KỶ LỤC THỜI GIAN MỚI!</span>
                  </span>
                )}
              </div>
            )}
          </header>

          {/* Rewards & Core Stats Grid */}
          <section
            aria-label="Thông số trận đấu"
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
          >
            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-950/35 px-3.5 py-2.5 text-center">
              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-200/85">
                <Cookie aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
                <span>Cookies nhận</span>
              </div>
              <div className="mt-0.5 font-mono text-xl font-black text-emerald-200 tabular-nums">
                +{cookiesEarned.toLocaleString('vi-VN')}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-400/40 bg-[#1c120c]/90 px-3.5 py-2.5 text-center">
              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-200/85">
                <Trophy aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
                <span>Tổng Điểm</span>
              </div>
              <div className="mt-0.5 font-mono text-xl font-black text-amber-200 tabular-nums">
                {summary.score.toLocaleString('vi-VN')}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-400/35 bg-[#0c1524] px-3.5 py-2.5 text-center">
              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-200/85">
                <Timer aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
                <span>Thời gian</span>
              </div>
              <div className="mt-0.5 font-mono text-xl font-black text-white tabular-nums">
                {formatClock(summary.elapsedSec)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0d1422] px-3.5 py-2.5 text-center">
              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-300">
                <Zap aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />
                <span>Cấp đội</span>
              </div>
              <div className="mt-0.5 font-mono text-lg font-black text-white tabular-nums">
                LV.{summary.teamLevel}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0d1422] px-3.5 py-2.5 text-center">
              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-300">
                <Swords aria-hidden="true" className="h-3.5 w-3.5 text-rose-300" />
                <span>Quái hạ</span>
              </div>
              <div className="mt-0.5 font-mono text-lg font-black text-white tabular-nums">
                {summary.totalKills.toLocaleString('vi-VN')}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0d1422] px-3.5 py-2.5 text-center">
              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-300">
                <Skull aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
                <span>Boss hạ</span>
              </div>
              <div className="mt-0.5 font-mono text-lg font-black text-white tabular-nums">
                {summary.bossesSlain.toLocaleString('vi-VN')}
              </div>
            </div>
          </section>

          {/* Team Leaderboard */}
          <section aria-label="Bảng so kè thành viên" className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">
                Bảng So Kè Thành Viên
              </h2>
              <span className="text-[11px] font-bold text-slate-400">
                Xếp theo điểm đóng góp
              </span>
            </div>

            <div className="space-y-2">
              {sortedPlayers.map((player, idx) => {
                const rank = idx + 1;
                const weapon = getWeaponSpec(player.weaponId);
                return (
                  <div
                    key={player.id}
                    className={`flex flex-col gap-2 rounded-2xl border px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
                      rank === 1
                        ? 'border-amber-400/50 bg-amber-500/12'
                        : 'border-white/10 bg-[#0d1422]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`w-6 shrink-0 text-center font-mono text-sm font-black ${
                          rank === 1 ? 'text-amber-300' : 'text-slate-400'
                        }`}
                      >
                        #{rank}
                      </span>

                      <AnimalAvatar animal={player.animal} size="sm" />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-black text-white">
                            {player.name}
                          </span>
                          {player.isBot && (
                            <span className="rounded-md border border-sky-400/40 bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-black text-sky-200">
                              Bot
                            </span>
                          )}
                        </div>
                        <div
                          className="text-[11px] font-bold"
                          style={{ color: weapon.color }}
                        >
                          {weapon.name}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 border-t border-white/10 pt-2 text-center text-[11px] sm:border-t-0 sm:pt-0 sm:text-right">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400">
                          Điểm
                        </div>
                        <div className="font-mono font-black text-amber-200 tabular-nums">
                          {player.score.toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400">
                          Quái hạ
                        </div>
                        <div className="font-mono font-black text-white tabular-nums">
                          {player.kills.toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400">
                          Sát thương
                        </div>
                        <div className="font-mono font-black text-rose-200 tabular-nums">
                          {player.damageDealt.toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <div>
                        <div className="inline-flex items-center justify-center gap-0.5 text-[10px] font-bold text-slate-400 sm:justify-end">
                          <HeartHandshake
                            aria-hidden="true"
                            className="h-3 w-3 text-emerald-300"
                          />
                          <span>Cứu</span>
                        </div>
                        <div className="font-mono font-black text-emerald-200 tabular-nums">
                          {player.revives}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Action Buttons */}
          <footer className="flex flex-col gap-2.5 border-t border-white/10 pt-4">
            {isHostOrOffline ? (
              <>
                {isCampaignVictory && (
                  <button
                    ref={setNativeAutofocus}
                    autoFocus
                    type="button"
                    onClick={() => {
                      playSfx('roundStart');
                      onContinueEndless();
                    }}
                    className={`btn-tactile-amber inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${SURVIVAL_FOCUS_RING_CLASS}`}
                  >
                    <Flame aria-hidden="true" className="h-4 w-4" />
                    <span>Chơi Tiếp Endless</span>
                  </button>
                )}

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <button
                    ref={!isCampaignVictory ? setNativeAutofocus : undefined}
                    autoFocus={!isCampaignVictory}
                    type="button"
                    onClick={() => {
                      playSfx('roundStart');
                      onPlayAgain();
                    }}
                    className={`btn-tactile-emerald inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black ${SURVIVAL_FOCUS_RING_CLASS}`}
                  >
                    <RotateCcw aria-hidden="true" className="h-4 w-4" />
                    <span>Chơi Lại</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      onReturnLobby();
                    }}
                    className={`btn-tactile-wood inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-amber-400/35 px-4 py-2.5 text-sm font-black text-amber-100 ${SURVIVAL_FOCUS_RING_CLASS}`}
                  >
                    <ArrowLeft aria-hidden="true" className="h-4 w-4 text-amber-300" />
                    <span>Về Sảnh</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <div
                  className={`rounded-2xl border px-4 py-3 text-center text-xs font-bold ${
                    hostLeft
                      ? 'border-rose-400/45 bg-rose-950/35 text-rose-200'
                      : 'border-cyan-400/30 bg-[#0b1322] text-cyan-200'
                  }`}
                >
                  {hostLeft
                    ? 'Chủ phòng đã rời trận — hãy quay về sảnh.'
                    : 'Chờ chủ phòng chọn Chơi tiếp Endless hoặc Chơi lại'}
                </div>
                <button
                  ref={setNativeAutofocus}
                  autoFocus
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    onReturnLobby();
                  }}
                  className={`btn-tactile-wood inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-amber-400/35 px-4 py-2.5 text-sm font-black text-amber-100 ${SURVIVAL_FOCUS_RING_CLASS}`}
                >
                  <ArrowLeft aria-hidden="true" className="h-4 w-4 text-amber-300" />
                  <span>Về Sảnh</span>
                </button>
              </div>
            )}
          </footer>
        </>
      )}
    </SurvivalDialogShell>
  );
}
