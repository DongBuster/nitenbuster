import type { ReactNode } from 'react';
import {
  ArrowRight,
  Boxes,
  Cookie,
  Gamepad2,
  LayoutGrid,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { playSfx } from '../audio/soundEngine';
import { MAX_COOP_STARS, countTotalCoopStars } from '../coop/maps/registry';
import { ANIMALS } from '../engine/types';
import { formatEquippedSummary } from '../scene3d/accessoryCatalog';
import { useProfileStore } from '../store/profileStore';

export interface ModeSelectScreenProps {
  onSelectPawsCards: () => void;
  onSelectBrawlArena: () => void;
  onSelectBlockBlast: () => void;
  onSelectGlassCarry: () => void;
  onSelectEventCup: () => void;
  onOpenStudio3D: () => void;
}

interface ModeSpecItem {
  label: string;
  value: string;
}

interface GameModeEntry {
  id: 'cards' | 'brawl' | 'blockblast' | 'glassCarry';
  title: string;
  genreBadge: string;
  badgeIcon: ReactNode;
  description: string;
  bannerWebp?: string;
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
 * so players immediately distinguish turn-based card strategy, physics brawl,
 * 8x8 block puzzle, and 2-player online co-op glass carry modes.
 */
export function ModeSelectScreen({
  onSelectPawsCards,
  onSelectBrawlArena,
  onSelectBlockBlast,
  onSelectGlassCarry,
  onSelectEventCup,
  onOpenStudio3D,
}: ModeSelectScreenProps) {
  const {
    cookies,
    gamesWon,
    gamesPlayed,
    blockBlastBestScore,
    coopRecords,
    selectedAnimal,
    equippedAccessory,
  } = useProfileStore();
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
    {
      id: 'blockblast',
      title: 'Block Blast PAWS',
      genreBadge: 'Giải Đố Xếp Khối · 8×8',
      badgeIcon: <LayoutGrid className="h-3.5 w-3.5 text-emerald-300" />,
      description:
        'Kéo thả 29 hình khối kẹo gỗ lên lưới 8×8, dọn sạch bàn lên Stage mới hoặc tạo Phòng Đấu chung seed so tài với bạn bè!',
      bannerWebp: '/banners/block-blast-banner.webp',
      bannerJpg: '/banners/block-blast-banner.jpg',
      bannerAlt:
        'Các khối gạch kẹo nhiều màu rực rỡ xếp trên bàn gỗ Winter Cabin cùng thú bông cổ vũ dưới ánh đèn lồng ấm',
      ctaLabel: 'Chơi Block Blast PAWS',
      cardClass:
        'border-emerald-500/35 bg-[#0f241d] hover:border-emerald-400 hover:shadow-[0_22px_46px_rgba(52,211,153,0.2)] has-[button:focus-visible]:outline-emerald-300',
      badgeClass: 'border-emerald-400/35 bg-emerald-400/15 text-emerald-200',
      specClass: 'border-emerald-900/50 bg-black/25',
      ctaClass: 'btn-tactile-emerald',
      ctaTextClass: 'text-white',
      specs: [
        { label: 'Lối chơi', value: 'Giải đố lưới 8×8' },
        { label: 'Phòng đấu', value: 'Solo & 2–8 người Online' },
        { label: 'Kỷ lục', value: `${blockBlastBestScore.toLocaleString()} điểm` },
      ],
      onEnter: onSelectBlockBlast,
    },
    {
      id: 'glassCarry',
      title: 'PAWS Duo Co-op 3D',
      genreBadge: 'Co-op 2 Người · 4 Map Hợp Tác',
      badgeIcon: <Users className="h-3.5 w-3.5 text-cyan-300" />,
      description:
        'Phối hợp cùng đồng đội Online qua 4 kiểu chơi khác hẳn nhau: Bê Kính Pha Lê, Chèo Phao Vượt Thác, Dây Thừng Buộc Chung & Xe Goòng Đường Ray!',
      bannerWebp: '/banners/glass-carry-banner.webp',
      bannerJpg: '/banners/glass-carry-banner.jpg',
      bannerAlt:
        'Hai thú bông 3D cẩn thận khiêng tấm kính pha lê sáng lấp lánh qua cây cầu gỗ tuyết có búa lắc và đèn lồng ấm',
      ctaLabel: 'Vào Sảnh Duo Co-op',
      cardClass:
        'border-cyan-500/35 bg-[#0c212b] hover:border-cyan-400 hover:shadow-[0_22px_46px_rgba(34,211,238,0.22)] has-[button:focus-visible]:outline-cyan-300',
      badgeClass: 'border-cyan-400/35 bg-cyan-400/15 text-cyan-200',
      specClass: 'border-cyan-900/50 bg-black/25',
      ctaClass: 'btn-tactile-cyan',
      ctaTextClass: 'text-[#06222c]',
      specs: [
        { label: 'Chế độ', value: '4 Map · 2 Người Online' },
        { label: 'Thử thách', value: '5 chặng · Checkpoint' },
        {
          label: 'Tổng sao',
          value: `${countTotalCoopStars(coopRecords)} / ${MAX_COOP_STARS}★`,
        },
      ],
      onEnter: onSelectGlassCarry,
    },
  ];

  return (
    <div className="min-h-dvh bg-[#1a100b] bg-[radial-gradient(circle_at_18%_0%,_#3a2114_0%,_transparent_44%),radial-gradient(circle_at_50%_0%,_#112840_0%,_transparent_44%),radial-gradient(circle_at_84%_0%,_#103326_0%,_transparent_44%),linear-gradient(180deg,_#1c110c_0%,_#120b08_100%)] text-[#FFF9F0] selection:bg-amber-300 selection:text-[#2C1B11]">
      <div className="mx-auto flex min-h-dvh max-w-[92rem] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        {/* Hero Showcase Header */}
        <header className="relative overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-r from-[#341c11]/95 via-[#182235]/95 to-[#0f2920]/95 px-6 py-4 shadow-[0_14px_34px_rgba(0,0,0,0.42)]">
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
                Chọn <span className="font-bold text-amber-300">Đấu Bài</span> cân não,{' '}
                <span className="font-bold text-sky-300">Hỗn Chiến</span> vật lý,{' '}
                <span className="font-bold text-emerald-300">Xếp Khối 8×8</span> hoặc{' '}
                <span className="font-bold text-cyan-300">Duo Co-op 4 Map</span> cùng thú bông 3D.
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

        {/* Featured Tournament Event Banner */}
        <section className="relative overflow-hidden rounded-3xl border-2 border-amber-400/50 bg-gradient-to-r from-[#3e1d0f]/95 via-[#2a1929]/95 to-[#102935]/95 px-6 py-4 shadow-[0_18px_42px_rgba(251,191,36,0.16)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/55 bg-amber-400/20 px-3 py-1 text-xs font-black text-amber-200">
                  <Trophy className="h-3.5 w-3.5 text-amber-300" />
                  <span>CHẾ ĐỘ MỚI · GIẢI ĐẤU LIÊN HOÀN</span>
                </span>
                <span className="rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[11px] font-bold text-amber-100/85">
                  2–8 Người Thật · Không Bot · Tùy Chỉnh Thời Gian Từng Game
                </span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-black text-white sm:text-3xl">
                PAWS Event Cup — Phòng Thi Đấu 4 Trò Chơi
              </h2>
              <p className="mt-1 text-sm text-amber-100/85">
                Tạo 1 phòng duy nhất mời bạn bè thi đấu Grand Prix liên tiếp qua cả{' '}
                <strong className="text-amber-300">PAWS Cards</strong>,{' '}
                <strong className="text-emerald-300">Block Blast</strong>,{' '}
                <strong className="text-sky-300">Brawl Arena Online</strong> và{' '}
                <strong className="text-cyan-300">Glass Carry</strong> để tranh cúp vô địch!
              </p>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  onSelectEventCup();
                }}
                className="btn-tactile-amber inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black text-[#26160b] shadow-lg focus-visible:outline-2 focus-visible:outline-amber-300 lg:w-auto"
              >
                <Trophy className="h-4 w-4" />
                <span>Vào Phòng Event Cup</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Four Distinct Game Mode Cards */}
        <main className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {gameModes.map((mode) => (
            <article
              key={mode.id}
              className={`arcade-mode-card group relative overflow-clip rounded-3xl border-2 shadow-[0_14px_36px_rgba(0,0,0,0.45)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 motion-reduce:transition-colors motion-reduce:hover:translate-y-0 has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-2 ${mode.cardClass}`}
            >
              <picture className="block border-b border-white/10 bg-black/40">
                {mode.bannerWebp && (
                  <source srcSet={mode.bannerWebp} type="image/webp" />
                )}
                <img
                  src={mode.bannerJpg}
                  alt={mode.bannerAlt}
                  width={1376}
                  height={768}
                  fetchPriority="high"
                  decoding="async"
                  className="block aspect-[16/9] w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
              </picture>

              <header className="px-5 pt-4">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${mode.badgeClass}`}
                >
                  {mode.badgeIcon}
                  <span>{mode.genreBadge}</span>
                </span>
                <h2 className="mt-2.5 font-display text-2xl font-black text-white">
                  {mode.title}
                </h2>
              </header>

              <div className="flex flex-col justify-between gap-4 px-5 pt-2.5 pb-4">
                <p className="text-sm leading-relaxed text-amber-50/85">
                  {mode.description}
                </p>

                <dl className="grid grid-cols-1 gap-1.5 @[24rem]:grid-cols-3 @[24rem]:gap-2">
                  {mode.specs.map((spec) => (
                    <div
                      key={spec.label}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 @[24rem]:block @[24rem]:py-2 ${mode.specClass}`}
                    >
                      <dt className="text-[11px] font-bold text-white/55">
                        {spec.label}
                      </dt>
                      <dd className="text-right text-xs font-black text-white/95 @[24rem]:mt-0.5 @[24rem]:text-left">
                        {spec.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <footer className="px-5 pb-5">
                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    mode.onEnter();
                  }}
                  className="block w-full cursor-pointer rounded-2xl text-left focus-visible:outline-none after:absolute after:inset-0 after:z-10 after:content-['']"
                >
                  <span
                    className={`${mode.ctaClass} ${mode.ctaTextClass} pointer-events-none flex w-full items-center justify-between rounded-2xl px-5 py-3 text-sm font-black group-active:translate-y-[3px] motion-reduce:group-active:translate-y-0`}
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
        <footer className="mt-auto pt-2 text-center text-xs text-amber-200/55">
          Dùng chung bộ 8 nhân vật 3D, 15 phụ kiện phối đồ và ví Cookies giữa cả bốn chế độ.
        </footer>
      </div>
    </div>
  );
}
