import {
  ArrowRight,
  Bot,
  Boxes,
  Cookie,
  Flame,
  Gamepad2,
  Globe,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react';
import { playSfx } from '../audio/soundEngine';
import { ANIMALS } from '../engine/types';
import { useProfileStore } from '../store/profileStore';

export interface ModeSelectScreenProps {
  onSelectPawsCards: () => void;
  onSelectBrawlArena: () => void;
  onOpenStudio3D: () => void;
}

export function ModeSelectScreen({
  onSelectPawsCards,
  onSelectBrawlArena,
  onOpenStudio3D,
}: ModeSelectScreenProps) {
  const { cookies, gamesWon, gamesPlayed, selectedAnimal } = useProfileStore();
  const animalMeta =
    ANIMALS.find((a) => a.id === selectedAnimal) ?? ANIMALS[0];

  return (
    <div className="min-h-screen bg-[#1c120c] bg-[radial-gradient(circle_at_50%_0%,_#382419_0%,_#1a0f0a_70%)] text-[#FFF9F0] selection:bg-amber-300 selection:text-[#2C1B11]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-950/70 px-3.5 py-1 text-xs font-bold tracking-wide text-amber-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Winter Cabin Arcade</span>
            </div>
            <h1 className="mt-2 font-display text-3xl font-black tracking-tight text-[#FFFBF4] sm:text-4xl">
              PAWS ARCADE 3D
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Animal Profile Pill */}
            <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-900/50 bg-[#29170f]/90 px-3.5 py-2 text-xs font-extrabold text-amber-100 shadow-md">
              <span
                className="h-3 w-3 rounded-full ring-2 ring-white/30"
                style={{ backgroundColor: animalMeta.accentHex }}
              />
              <span>{animalMeta.name}</span>
            </div>

            {/* Cookies Stat */}
            <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-[#29170f]/90 px-3.5 py-2 text-sm font-black text-amber-200 shadow-md">
              <Cookie className="h-4 w-4 text-amber-400" />
              <span>{cookies.toLocaleString()} Cookies</span>
            </div>

            {/* Win/Played Stat */}
            <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-900/50 bg-[#29170f]/90 px-3.5 py-2 text-xs font-bold text-amber-100/90 shadow-md">
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
              className="btn-tactile-wood inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-sky-400/30 px-3.5 py-2 text-xs font-extrabold text-sky-100 focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              <Boxes className="h-3.5 w-3.5 text-sky-300" />
              <span>3D Studio</span>
            </button>
          </div>
        </header>

        {/* Hero Mode Cards */}
        <main className="my-8 grid flex-1 grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          {/* Card 1: PAWS Cards */}
          <div
            onClick={() => {
              playSfx('click');
              onSelectPawsCards();
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                playSfx('click');
                onSelectPawsCards();
              }
            }}
            className="group flex cursor-pointer flex-col justify-between rounded-3xl border-2 border-amber-500/30 bg-[#2b180f] p-7 text-left shadow-[0_12px_32px_rgba(0,0,0,0.4)] transition-all duration-200 hover:-translate-y-1 hover:border-amber-400 hover:shadow-[0_20px_40px_rgba(251,191,36,0.18)] focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-xs font-black text-amber-200">
                  <Gamepad2 className="h-3.5 w-3.5 text-amber-300" />
                  <span>Thẻ Bài Chiến Thuật</span>
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-950/60 text-amber-300 shadow-inner transition-transform group-hover:scale-110">
                  <Gamepad2 className="h-6 w-6" />
                </div>
              </div>

              <h2 className="mt-5 font-display text-3xl font-black text-white">
                PAWS Cards 3D
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-amber-100/85">
                Đấu bài chiến thuật kiểu UNO trên bàn cabin ấm cúng. Sở hữu 11 lá đặc biệt (Xẻng Tuyết, Tia Chớp, Vỏ Chuối, Bom Kẹo...) cùng chế độ phòng Online kịch tính.
              </p>

              <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-amber-200/90">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-900/40 bg-black/25 px-3 py-1.5">
                  <Bot className="h-3.5 w-3.5 text-amber-400" />
                  <span>3–7 Đối thủ Bot</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-900/40 bg-black/25 px-3 py-1.5">
                  <Globe className="h-3.5 w-3.5 text-sky-400" />
                  <span>Phòng đấu Online</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-900/40 bg-black/25 px-3 py-1.5">
                  <ShoppingBag className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Cửa hàng phụ kiện</span>
                </span>
              </div>
            </div>

            <div className="btn-tactile-amber mt-8 flex items-center justify-between rounded-2xl px-5 py-3.5 text-sm font-black text-[#26160b]">
              <span>Vào Sảnh PAWS Cards</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* Card 2: Brawl Arena */}
          <div
            onClick={() => {
              playSfx('click');
              onSelectBrawlArena();
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                playSfx('click');
                onSelectBrawlArena();
              }
            }}
            className="group flex cursor-pointer flex-col justify-between rounded-3xl border-2 border-sky-500/30 bg-[#122234] p-7 text-left shadow-[0_12px_32px_rgba(0,0,0,0.4)] transition-all duration-200 hover:-translate-y-1 hover:border-sky-400 hover:shadow-[0_20px_40px_rgba(56,189,248,0.18)] focus-visible:outline-2 focus-visible:outline-sky-300"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/15 px-3 py-1 text-xs font-black text-sky-200">
                  <Swords className="h-3.5 w-3.5 text-sky-300" />
                  <span>Đấu Trường Sinh Tồn</span>
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/25 bg-slate-900/60 text-sky-300 shadow-inner transition-transform group-hover:scale-110">
                  <Swords className="h-6 w-6" />
                </div>
              </div>

              <h2 className="mt-5 font-display text-3xl font-black text-white">
                Brawl Arena 3D
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-sky-100/85">
                Đấu trường sinh tồn kiểu Party Animals! Đấm, nắm, ném đối thủ khỏi sàn lục giác sụp dần và nhặt lá bài PAWS rơi từ trời qua 3 hiệp tính điểm.
              </p>

              <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-sky-200/95">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-900/40 bg-black/25 px-3 py-1.5">
                  <Flame className="h-3.5 w-3.5 text-rose-400" />
                  <span>Vật lý 3D Rapier</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-900/40 bg-black/25 px-3 py-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                  <span>Sàn sụp thu hẹp dần</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-900/40 bg-black/25 px-3 py-1.5">
                  <Trophy className="h-3.5 w-3.5 text-sky-300" />
                  <span>3 Hiệp tính điểm</span>
                </span>
              </div>
            </div>

            <div className="btn-tactile-sky mt-8 flex items-center justify-between rounded-2xl px-5 py-3.5 text-sm font-black text-white">
              <span>Vào Đấu Trường Brawl Arena</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </main>

        {/* Footer note */}
        <footer className="text-center text-xs text-amber-200/50">
          Dùng chung bộ 8 nhân vật 3D, phụ kiện và ví Cookies giữa cả hai minigame.
        </footer>
      </div>
    </div>
  );
}
