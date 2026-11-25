import type { ReactNode } from 'react';
import {
  ArrowRight,
  Boxes,
  Cookie,
  Gamepad2,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react';
import { playSfx } from '../audio/soundEngine';
import { ANIMALS } from '../engine/types';
import { formatEquippedSummary } from '../scene3d/accessoryCatalog';
import { useProfileStore } from '../store/profileStore';

export interface ModeSelectScreenProps {
  onSelectPawsCards: () => void;
  onSelectBrawlArena: () => void;
  onOpenStudio3D: () => void;
}

interface ModeSpecItem {
  label: string;
  value: string;
}

interface GameModeEntry {
  id: 'cards' | 'brawl';
  title: string;
  genreBadge: string;
  badgeIcon: ReactNode;
  description: string;
  bannerWebp: string;
  bannerJpg: string;
  bannerAlt: string;
  ctaLabel: string;
  cardClass: string;
  badgeClass: string;
  specClass: string;
  ctaClass: string;
  ctaTextClass: string;
  specs: readonly ModeSpecItem[];
  onEnter: () => void;
}

/**
 * Arcade mode hub with bespoke 16:9 key-art banners and explicit genre specs
 * so players immediately distinguish turn-based card strategy from physics brawl.
 */
export function ModeSelectScreen({
  onSelectPawsCards,
  onSelectBrawlArena,
  onOpenStudio3D,
}: ModeSelectScreenProps) {
  const { cookies, gamesWon, gamesPlayed, selectedAnimal, equippedAccessory } =
    useProfileStore();
  const animalMeta =
    ANIMALS.find((a) => a.id === selectedAnimal) ?? ANIMALS[0];
  const equippedSummary = formatEquippedSummary(
    equippedAccessory[selectedAnimal],
  );

  const gameModes: readonly GameModeEntry[] = [
    {
      id: 'cards',
      title: 'PAWS Cards 3D',
      genreBadge: 'Thẻ Bài Chiến Thuật · Theo Lượt',
      badgeIcon: <Gamepad2 className="h-3.5 w-3.5 text-amber-300" />,
      description:
        'Đấu bài kiểu UNO quanh bàn gỗ cabin ấm áp. Tung 11 lá kỹ năng (Xẻng Tuyết, Tia Chớp, Bom Kẹo...) để về nhất trước mọi đối thủ.',
      bannerWebp: '/banners/paws-cards-banner.webp',
      bannerJpg: '/banners/paws-cards-banner.jpg',
      bannerAlt:
        'Các nhân vật thú bông ngồi quanh bàn gỗ cabin chơi bài PAWS nhiều màu dưới ánh đèn lồng ấm',
      ctaLabel: 'Vào Sảnh PAWS Cards',
      cardClass:
        'border-amber-500/35 bg-[#27150d] hover:border-amber-400 hover:shadow-[0_22px_46px_rgba(251,191,36,0.2)] has-[button:focus-visible]:outline-amber-300',
      badgeClass: 'border-amber-400/35 bg-amber-400/15 text-amber-200',
      specClass: 'border-amber-900/45 bg-black/25',
      ctaClass: 'btn-tactile-amber',
      ctaTextClass: 'text-[#26160b]',
      specs: [
        { label: 'Lối chơi', value: 'Đấu bài theo lượt' },
        { label: 'Kỹ năng', value: '11 lá bài đặc biệt' },
        { label: 'Phòng đấu', value: '3–7 Bot & Online' },
      ],
      onEnter: onSelectPawsCards,
    },
    {
      id: 'brawl',
      title: 'Brawl Arena 3D',
      genreBadge: 'Hỗn Chiến Vật Lý · Thời Gian Thực',
      badgeIcon: <Swords className="h-3.5 w-3.5 text-sky-300" />,
      description:
        'Đấu trường sinh tồn kiểu Party Animals! Di chuyển, đấm, tóm và ném đối thủ khỏi sàn băng lục giác sụp dần để giành cúp qua 3 hiệp.',
      bannerWebp: '/banners/brawl-arena-banner.webp',
      bannerJpg: '/banners/brawl-arena-banner.jpg',
      bannerAlt:
        'Nhân vật thú bông va chạm đấm bay đối thủ trên đấu trường băng lục giác sụp dần dưới cực quang',
      ctaLabel: 'Vào Đấu Trường Brawl Arena',
      cardClass:
        'border-sky-500/35 bg-[#102033] hover:border-sky-400 hover:shadow-[0_22px_46px_rgba(56,189,248,0.2)] has-[button:focus-visible]:outline-sky-300',
      badgeClass: 'border-sky-400/35 bg-sky-400/15 text-sky-200',
      specClass: 'border-sky-900/50 bg-black/25',
      ctaClass: 'btn-tactile-sky',
      ctaTextClass: 'text-white',
      specs: [
        { label: 'Lối chơi', value: 'Thời gian thực' },
        { label: 'Kỹ năng', value: 'Đấm · Tóm · Húc · Lăn' },
        { label: 'Mục tiêu', value: 'Trụ sàn qua 3 hiệp' },
      ],
      onEnter: onSelectBrawlArena,
    },
  ];

  return (
    <div className="min-h-screen bg-[#1a100b] bg-[radial-gradient(circle_at_22%_0%,_#3a2114_0%,_transparent_48%),radial-gradient(circle_at_78%_0%,_#112840_0%,_transparent_48%),linear-gradient(180deg,_#1c110c_0%,_#120b08_100%)] text-[#FFF9F0] selection:bg-amber-300 selection:text-[#2C1B11]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between gap-5 px-4 py-5 sm:px-6 lg:px-8">
        {/* Hero Showcase Header */}
        <header className="relative overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-r from-[#341c11]/95 via-[#211517]/95 to-[#12263c]/95 px-6 py-4 shadow-[0_14px_34px_rgba(0,0,0,0.42)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-950/75 px-3 py-1 text-xs font-bold tracking-wide text-amber-200">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Winter Cabin Arcade</span>
              </div>
              <h1 className="mt-1.5 font-display text-3xl font-black tracking-tight text-[#FFFBF4] sm:text-4xl">
                PAWS ARCADE 3D
              </h1>
              <p className="mt-1 text-sm text-amber-100/80">
                Chọn <span className="font-bold text-amber-300">Đấu Bài</span> cân não bên lò sưởi hoặc{' '}
                <span className="font-bold text-sky-300">Hỗn Chiến</span> vật lý trên sàn băng tuyết.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
              {/* Active Character + Equipped Summary */}
              <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-900/50 bg-black/35 px-3.5 py-2 text-xs font-extrabold text-amber-100 shadow-inner">
                <span
                  className="h-3 w-3 rounded-full ring-2 ring-white/30"
                  style={{ backgroundColor: animalMeta.accentHex }}
                />
                <span>{animalMeta.name}</span>
                {equippedSummary && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-200">
                    {equippedSummary.primaryName}
                    {equippedSummary.extraCount > 0
                      ? ` +${equippedSummary.extraCount}`
                      : ''}
                  </span>
                )}
              </div>

              {/* Cookies Stat */}
              <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-black/35 px-3.5 py-2 text-sm font-black text-amber-200 shadow-inner">
                <Cookie className="h-4 w-4 text-amber-400" />
                <span>{cookies.toLocaleString()} Cookies</span>
              </div>

              {/* Win/Played Stat */}
              <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-900/50 bg-black/35 px-3.5 py-2 text-xs font-bold text-amber-100/90 shadow-inner">
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                <span>
                  {gamesWon} thắng / {gamesPlayed} ván
                </span>
              </div>

              {/* 3D Studio Button */}
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  onOpenStudio3D();
                }}
                className="btn-tactile-wood inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-sky-400/35 px-3.5 py-2 text-xs font-extrabold text-sky-100 focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                <Boxes className="h-3.5 w-3.5 text-sky-300" />
                <span>3D Studio</span>
              </button>
            </div>
          </div>
        </header>

        {/* Two Distinct Game Mode Cards */}
        <main className="grid flex-1 grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          {gameModes.map((mode) => (
            <article
              key={mode.id}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 shadow-[0_14px_36px_rgba(0,0,0,0.45)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 motion-reduce:transition-colors motion-reduce:hover:translate-y-0 has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-2 ${mode.cardClass}`}
            >
              <picture className="block border-b border-white/10 bg-black/40">
                <source srcSet={mode.bannerWebp} type="image/webp" />
                <img
                  src={mode.bannerJpg}
                  alt={mode.bannerAlt}
                  width={1376}
                  height={768}
                  fetchPriority="high"
                  decoding="async"
                  className="aspect-[16/9] w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
              </picture>

              <header className="px-6 pt-5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${mode.badgeClass}`}
                >
                  {mode.badgeIcon}
                  <span>{mode.genreBadge}</span>
                </span>
                <h2 className="mt-3 font-display text-3xl font-black text-white">
                  {mode.title}
                </h2>
              </header>

              <div className="flex flex-1 flex-col justify-between gap-4 px-6 pt-2.5 pb-5">
                <p className="text-sm leading-relaxed text-amber-50/85">
                  {mode.description}
                </p>

                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {mode.specs.map((spec) => (
                    <div
                      key={spec.label}
                      className={`rounded-xl border px-3 py-2 ${mode.specClass}`}
                    >
                      <dt className="text-[11px] font-bold text-white/55">
                        {spec.label}
                      </dt>
                      <dd className="mt-0.5 text-xs font-black text-white/95">
                        {spec.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <footer className="px-6 pb-6">
                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    mode.onEnter();
                  }}
                  className="block w-full cursor-pointer rounded-2xl text-left focus-visible:outline-none after:absolute after:inset-0 after:z-10 after:content-['']"
                >
                  <span
                    className={`${mode.ctaClass} ${mode.ctaTextClass} pointer-events-none flex w-full items-center justify-between rounded-2xl px-5 py-3.5 text-sm font-black group-active:translate-y-[3px] motion-reduce:group-active:translate-y-0`}
                  >
                    <span>{mode.ctaLabel}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
                  </span>
                </button>
              </footer>
            </article>
          ))}
        </main>

        {/* Footer note */}
        <footer className="text-center text-xs text-amber-200/55">
          Dùng chung bộ 8 nhân vật 3D, 15 phụ kiện phối đồ và ví Cookies giữa cả hai chế độ.
        </footer>
      </div>
    </div>
  );
}
