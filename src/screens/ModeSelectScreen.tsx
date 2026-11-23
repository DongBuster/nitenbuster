import { playSfx } from '../audio/soundEngine';
import { BRAWL_ANIMAL_EMOJI } from '../brawl/sim/constants';
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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#4a3528_0%,_#241711_55%,_#110c0a_100%)] text-[#FFF9F0] selection:bg-amber-300 selection:text-[#2C1B11]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Bar */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-[11px] font-extrabold tracking-wide text-amber-200">
              <span>❄️</span>
              <span>WINTER CABIN · CHỌN MINIGAME</span>
            </div>
            <h1 className="mt-2 font-display text-3xl font-black tracking-tight text-[#FFFBF4] sm:text-4xl">
              🐾 PAWS ARCADE 3D
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 rounded-2xl border border-white/15 bg-[#26170F]/85 px-3.5 py-2 text-xs font-bold text-amber-100 shadow-lg">
              <span>{BRAWL_ANIMAL_EMOJI[animalMeta.id] ?? '🐾'}</span>
              <span>{animalMeta.name}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-300/35 bg-[#26170F]/85 px-3.5 py-2 text-sm font-black text-amber-200 shadow-lg">
              <span>🍪</span>
              <span>{cookies} Cookies</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-2xl border border-white/15 bg-[#26170F]/85 px-3.5 py-2 text-xs font-bold text-amber-100/90 shadow-lg">
              <span>🏆</span>
              <span>
                {gamesWon} thắng / {gamesPlayed} trận
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onOpenStudio3D();
              }}
              className="cursor-pointer rounded-2xl border border-sky-300/30 bg-sky-500/15 px-3.5 py-2 text-xs font-extrabold text-sky-100 transition-colors hover:bg-sky-500/25 focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              ✨ 3D Studio
            </button>
          </div>
        </header>

        {/* Hero Mode Cards */}
        <main className="my-8 grid flex-1 grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          {/* Minigame 1: PAWS Cards */}
          <button
            type="button"
            onClick={() => {
              playSfx('click');
              onSelectPawsCards();
            }}
            className="group cursor-pointer flex flex-col justify-between rounded-3xl border-2 border-amber-300/35 bg-[linear-gradient(155deg,_rgba(74,47,33,0.92)_0%,_rgba(38,23,15,0.96)_100%)] p-7 text-left shadow-2xl transition-all duration-200 hover:-translate-y-1 hover:border-amber-300 hover:shadow-[0_20px_50px_rgba(251,191,36,0.22)] focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-black text-amber-200">
                  MINIGAME 1 · ĐẤU BÀI
                </span>
                <span className="text-4xl transition-transform duration-200 group-hover:scale-110">
                  🃏
                </span>
              </div>

              <h2 className="mt-5 font-display text-3xl font-black text-white">
                PAWS Cards 3D
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-amber-100/85">
                Đấu bài chiến thuật kiểu UNO trên bàn cabin ấm cúng. Sở hữu 11 lá đặc biệt (Xẻng Tuyết, Tia Chớp, Vỏ Chuối, Bom Kẹo...) và chế độ Phòng Online.
              </p>

              <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-amber-200/90">
                <span className="rounded-xl bg-white/8 px-2.5 py-1">🤖 Chơi với 3–7 Bot</span>
                <span className="rounded-xl bg-white/8 px-2.5 py-1">🌐 Online theo mã phòng</span>
                <span className="rounded-xl bg-white/8 px-2.5 py-1">🛍️ Cửa hàng phụ kiện</span>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-5 py-3.5 text-sm font-black text-[#2C1B11] shadow-lg">
              <span>Vào Sảnh PAWS Cards</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </button>

          {/* Minigame 2: Brawl Arena */}
          <button
            type="button"
            onClick={() => {
              playSfx('click');
              onSelectBrawlArena();
            }}
            className="group cursor-pointer flex flex-col justify-between rounded-3xl border-2 border-sky-300/40 bg-[linear-gradient(155deg,_rgba(24,58,92,0.92)_0%,_rgba(15,28,46,0.96)_100%)] p-7 text-left shadow-2xl transition-all duration-200 hover:-translate-y-1 hover:border-sky-300 hover:shadow-[0_20px_50px_rgba(56,189,248,0.22)] focus-visible:outline-2 focus-visible:outline-sky-300"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-full bg-sky-400/20 px-3 py-1 text-xs font-black text-sky-200">
                  MỚI · MINIGAME 2 · VẬT LÝ 3D
                </span>
                <span className="text-4xl transition-transform duration-200 group-hover:scale-110">
                  🥊
                </span>
              </div>

              <h2 className="mt-5 font-display text-3xl font-black text-white">
                Brawl Arena 3D
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-sky-100/85">
                Đấu trường sinh tồn kiểu Party Animals! Đấm, nắm, ném đối thủ khỏi sàn lục giác sụp dần và nhặt lá bài PAWS rơi từ trời qua 3 hiệp tính điểm.
              </p>

              <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-sky-200/95">
                <span className="rounded-xl bg-white/8 px-2.5 py-1">🧊 Lá PAWS rơi từ trời</span>
                <span className="rounded-xl bg-white/8 px-2.5 py-1">💥 Vật lý Rapier 3D</span>
                <span className="rounded-xl bg-white/8 px-2.5 py-1">🏆 3 Hiệp tính điểm</span>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-5 py-3.5 text-sm font-black text-[#0B1726] shadow-lg">
              <span>Vào Đấu Trường Brawl Arena</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </button>
        </main>

        {/* Footer note */}
        <footer className="text-center text-xs text-amber-100/60">
          Dùng chung bộ 8 nhân vật 3D, phụ kiện và ví Cookies giữa cả hai minigame.
        </footer>
      </div>
    </div>
  );
}
