import { useEffect, useId, useRef, useState } from 'react';
import {
  BookOpen,
  Compass,
  Cookie,
  Infinity as InfinityIcon,
  Layers,
  Skull,
  Sparkles,
  Swords,
  X,
  Zap,
} from 'lucide-react';
import { playSfx } from '../../audio/soundEngine.ts';
import {
  BOSS_NAMES,
  SKILL_SCOPE_LABELS,
  getEnemyNameForMap,
  getSkillPoolForMap,
  getSkillTimingLabel,
} from '../sim/catalog.ts';
import { getSurvivalMapMeta } from '../sim/maps.ts';
import type {
  EnemyKind,
  SkillRarity,
  SkillSpec,
  SurvivalMapId,
} from '../sim/types.ts';
import { SURVIVAL_FOCUS_RING_CLASS } from './LevelUpModal.tsx';
import { MapArt, SkillArt } from './SurvivalIcons.tsx';

export interface MapScenarioModalProps {
  mapId: SurvivalMapId | null;
  onClose: () => void;
}

type SkillFilterTab = 'all' | 'secondary' | 'passive';

const REGULAR_ENEMY_ORDER: readonly EnemyKind[] = [
  'slime',
  'bat',
  'wolf',
  'owl_mage',
  'golem',
  'bomber',
];

const RARITY_STYLE: Record<
  SkillRarity,
  { label: string; badgeClass: string; borderClass: string }
> = {
  common: {
    label: 'Thường',
    badgeClass: 'border-slate-400/40 bg-slate-700/55 text-slate-200',
    borderClass: 'border-white/12 bg-[#0b1120]/90',
  },
  rare: {
    label: 'Hiếm',
    badgeClass: 'border-cyan-400/55 bg-cyan-500/20 text-cyan-200',
    borderClass: 'border-cyan-400/35 bg-cyan-950/25',
  },
  epic: {
    label: 'Sử Thi',
    badgeClass: 'border-amber-300/70 bg-gradient-to-r from-amber-500/25 to-fuchsia-500/25 text-amber-200',
    borderClass: 'border-amber-400/45 bg-fuchsia-950/25',
  },
};

function SkillCodexGrid({ skills }: { skills: readonly SkillSpec[] }) {
  if (skills.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-[#0a101d] px-3 py-4 text-center text-xs font-bold text-slate-400">
        Không có kỹ năng nào trong bộ lọc này.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {skills.map((skill) => {
        const rarity = RARITY_STYLE[skill.rarity];
        const isSecondary = skill.category === 'secondary';
        const timing = getSkillTimingLabel(skill.id);

        return (
          <div
            key={skill.id}
            className={`flex items-start gap-2.5 rounded-2xl border p-2.5 ${rarity.borderClass}`}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-[#090e1a] p-1"
              style={{ borderColor: `${skill.color}66` }}
            >
              <SkillArt skillId={skill.id} className="h-9 w-9" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="font-display text-xs font-black text-white">
                  {skill.name}
                </span>
                <span
                  className={`rounded-md border px-1.5 py-0.25 text-[9px] font-black uppercase ${rarity.badgeClass}`}
                >
                  {rarity.label}
                </span>
                <span
                  className={`rounded-md border px-1.5 py-0.25 text-[9px] font-black ${
                    isSecondary
                      ? 'border-violet-400/55 bg-violet-500/20 text-violet-200'
                      : 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                  }`}
                >
                  {isSecondary ? 'Chiêu phụ' : 'Nội tại'}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-300">
                {skill.description}
              </p>
              {timing && (
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-cyan-200/90">
                  <Zap aria-hidden="true" className="h-2.5 w-2.5" />
                  <span>{timing}</span>
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Dismissible native modal showing a PAWS Survival map's full match scenario
 * (3 Chapters & Boss timeline, themed monster roster, terrain mechanic, and complete skill pool).
 */
export function MapScenarioModal({ mapId, onClose }: MapScenarioModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState<SkillFilterTab>('all');

  const isOpen = mapId !== null;
  const map = mapId ? getSurvivalMapMeta(mapId) : null;

  useEffect(() => {
    setFilter('all');
  }, [mapId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      if (dialog.isConnected) {
        dialog.showModal();
      }
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const pool = map ? getSkillPoolForMap(map.id) : [];
  const filteredPool = pool.filter((s) => {
    if (filter === 'secondary') return s.category === 'secondary';
    if (filter === 'passive') return s.category !== 'secondary';
    return true;
  });
  const coreSkills = filteredPool.filter((s) => s.mapScope === 'core');
  const mapExclusiveSkills = filteredPool.filter((s) => s.mapScope !== 'core');

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
      className="m-auto max-h-[90dvh] w-[min(95vw,56rem)] overflow-y-auto rounded-3xl border-2 border-amber-400/45 bg-[#111827] p-0 text-[#FFF9F0] shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-xs"
    >
      {map && (
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          {/* Header Banner */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="hidden w-28 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-[#080d18] sm:block">
                <MapArt mapId={map.id} className="aspect-[2/1] w-full" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/45 bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-amber-200">
                    {map.isEndless ? (
                      <InfinityIcon aria-hidden="true" className="h-3 w-3" />
                    ) : (
                      <Compass aria-hidden="true" className="h-3 w-3" />
                    )}
                    <span>{map.subtitle}</span>
                  </span>
                  {map.cookieMultiplier > 1 && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-200">
                      <Cookie aria-hidden="true" className="h-3 w-3" />
                      <span>Cookies ×{map.cookieMultiplier}</span>
                    </span>
                  )}
                </div>
                <h2
                  id={titleId}
                  className="mt-1 font-display text-xl font-black text-white sm:text-2xl"
                >
                  Kịch Bản: {map.name}
                </h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-300 sm:text-sm">
                  {map.scenario.headline}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onClose();
              }}
              aria-label="Đóng bảng kịch bản bản đồ"
              className={`inline-flex min-h-[38px] min-w-[38px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-[#0b1120] text-slate-200 hover:border-amber-300/60 hover:text-white ${SURVIVAL_FOCUS_RING_CLASS}`}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </header>

          {/* 3-Chapter Timeline & Bosses */}
          <section className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300">
                <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Lộ Trình Trận Đấu &amp; Chuỗi Boss</span>
              </h3>
              <span className="rounded-lg border border-cyan-400/35 bg-cyan-950/40 px-2.5 py-0.5 text-[11px] font-bold text-cyan-200">
                Cơ chế map: {map.mechanicSummary}
              </span>
            </div>

            {map.scenario.endlessSummary && (
              <p className="rounded-xl border border-violet-400/35 bg-violet-950/35 px-3 py-2 text-xs font-bold text-violet-100">
                {map.scenario.endlessSummary}
              </p>
            )}

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
              {map.scenario.chapters.map((ch) => {
                const isFinal = !map.isEndless && ch.order === 3;
                return (
                  <div
                    key={ch.id}
                    className={`flex flex-col justify-between rounded-2xl border p-3 ${
                      isFinal
                        ? 'border-rose-400/50 bg-gradient-to-b from-rose-950/40 to-[#0c1220]'
                        : 'border-white/12 bg-[#0b1120]/90'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md border border-white/15 bg-white/8 px-2 py-0.5 font-mono text-[10px] font-black text-cyan-200 tabular-nums">
                          {ch.timeRangeLabel}
                        </span>
                        <span className="text-[10px] font-black uppercase text-amber-300">
                          {map.isEndless ? `Mốc ${ch.order}` : `Chương ${ch.order}/3`}
                        </span>
                      </div>
                      <h4 className="mt-1.5 font-display text-sm font-black text-white">
                        {ch.title}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300">
                        {ch.summary}
                      </p>
                      <p className="mt-1.5 text-[11px] font-bold text-sky-200/85">
                        {ch.enemyHint}
                      </p>
                    </div>

                    <div className="mt-3 space-y-1 border-t border-white/10 pt-2">
                      <div className="inline-flex items-center gap-1.5 text-xs font-black text-rose-200">
                        <Skull aria-hidden="true" className="h-3.5 w-3.5 text-rose-400" />
                        <span>
                          {isFinal ? 'Boss Cuối: ' : `Boss ${ch.order}: `}
                          {BOSS_NAMES[ch.bossKind]}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-amber-200/85">
                        {ch.bossRewardLabel}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Biome Monsters */}
          <section className="space-y-2">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-rose-300">
              <Swords aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Quái Vật Đặc Trưng Của Bản Đồ</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {REGULAR_ENEMY_ORDER.map((enemyKind) => (
                <span
                  key={enemyKind}
                  className="rounded-xl border border-white/12 bg-[#0b1120] px-2.5 py-1 text-xs font-bold text-slate-200"
                >
                  {getEnemyNameForMap(enemyKind, map.id)}
                </span>
              ))}
            </div>
          </section>

          {/* Skill Pool Codex */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-cyan-300">
                <Layers aria-hidden="true" className="h-3.5 w-3.5" />
                <span>
                  Kho Kỹ Năng Bản Đồ ({pool.length} kỹ năng)
                </span>
              </h3>

              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: `Tất cả (${pool.length})` },
                    {
                      id: 'secondary',
                      label: `Chiêu phụ tự động (${pool.filter((s) => s.category === 'secondary').length})`,
                    },
                    {
                      id: 'passive',
                      label: `Nội tại (${pool.filter((s) => s.category !== 'secondary').length})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={filter === tab.id}
                    onClick={() => {
                      playSfx('click');
                      setFilter(tab.id);
                    }}
                    className={`cursor-pointer rounded-xl border px-2.5 py-1 text-[11px] font-black transition-colors motion-reduce:transition-none ${SURVIVAL_FOCUS_RING_CLASS} ${
                      filter === tab.id
                        ? 'border-amber-300 bg-amber-400/20 text-amber-100'
                        : 'border-white/12 bg-[#0b1120] text-slate-300 hover:border-white/30'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {map.isEndless ? (
              <SkillCodexGrid skills={filteredPool} />
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-amber-200">
                    <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                    <span>
                      Riêng bản đồ{' '}
                      {map.id === 'endless_abyss'
                        ? map.name
                        : SKILL_SCOPE_LABELS[map.id]}{' '}
                      ({mapExclusiveSkills.length})
                    </span>
                  </p>
                  <SkillCodexGrid skills={mapExclusiveSkills} />
                </div>

                <div className="space-y-2 border-t border-white/10 pt-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-300">
                    Bộ kỹ năng Mặc định dùng chung ({coreSkills.length})
                  </p>
                  <SkillCodexGrid skills={coreSkills} />
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </dialog>
  );
}
