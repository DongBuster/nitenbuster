import {
  ArrowLeft,
  Cookie,
  Gamepad2,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react';
import { ANIMALS, type AnimalId } from '../../engine/types';
import { playSfx } from '../../audio/soundEngine';
import { SHOP_ITEMS } from '../../store/profileStore';
import type { BrawlDifficulty } from '../sim/types';

export interface BrawlSetupPanelProps {
  selectedAnimal: AnimalId;
  equippedAccessory: Partial<Record<AnimalId, string | null>>;
  cookies: number;
  botCount: number;
  difficulty: BrawlDifficulty;
  onSelectAnimal: (animal: AnimalId) => void;
  onChangeBotCount: (count: number) => void;
  onChangeDifficulty: (diff: BrawlDifficulty) => void;
  onStart: () => void;
  onBackToModeSelect: () => void;
}

const BOT_COUNTS = [3, 4, 5, 6, 7] as const;

const DIFFICULTIES: Array<{ id: BrawlDifficulty; label: string; desc: string }> = [
  { id: 'easy', label: 'Dễ', desc: 'Bot vụng về' },
  { id: 'medium', label: 'Vừa', desc: 'Cân bằng vui nhộn' },
  { id: 'hard', label: 'Khó', desc: 'Rình xô mép & né' },
];

export function BrawlSetupPanel({
  selectedAnimal,
  equippedAccessory,
  cookies,
  botCount,
  difficulty,
  onSelectAnimal,
  onChangeBotCount,
  onChangeDifficulty,
  onStart,
  onBackToModeSelect,
}: BrawlSetupPanelProps) {
  const selectedMeta = ANIMALS.find((a) => a.id === selectedAnimal) ?? ANIMALS[0];
  const equippedId = equippedAccessory[selectedAnimal] ?? null;
  const equippedItem = SHOP_ITEMS.find((i) => i.id === equippedId) ?? null;

  return (
    <div className="min-h-screen bg-[#0e1724] bg-[radial-gradient(circle_at_50%_0%,_#1e3650_0%,_#0a101a_70%)] text-[#F8FAFC] selection:bg-amber-300 selection:text-[#1B110B]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onBackToModeSelect();
              }}
              className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-sky-400/30 px-3.5 py-2 text-xs font-black text-amber-100 shadow-md transition-colors focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-amber-300" />
              <span>Chọn Chế Độ</span>
            </button>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-950/70 px-3.5 py-0.5 text-xs font-bold tracking-wide text-sky-200">
                <Swords className="h-3.5 w-3.5 text-sky-300" />
                <span>Winter Cabin · Brawl Arena 3D</span>
              </div>
              <h1 className="mt-1 font-display text-2xl font-black tracking-tight text-white sm:text-3xl">
                Sảnh Chờ Đấu Trường
              </h1>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-[#142030]/90 px-4 py-2 text-sm font-black text-amber-200 shadow-md">
            <Cookie className="h-4 w-4 text-amber-400" />
            <span>{cookies.toLocaleString()} Cookies</span>
          </div>
        </header>

        {/* Main 2-column setup card */}
        <main className="my-6 grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Character Selection */}
          <section className="flex flex-col justify-between rounded-3xl border-2 border-sky-900/40 bg-[#132032] p-5 shadow-2xl sm:p-6 lg:col-span-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-sky-300">
                  Chọn Chiến Binh Thú Cưng
                </h2>
                {equippedItem && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-950/80 px-2.5 py-0.5 text-xs font-bold text-amber-200">
                    <Sparkles className="h-3 w-3 text-amber-400" />
                    <span>{equippedItem.name}</span>
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {ANIMALS.map((a) => {
                  const active = a.id === selectedAnimal;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        playSfx('click');
                        onSelectAnimal(a.id);
                      }}
                      className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                        active
                          ? 'btn-tactile-amber border-amber-300'
                          : 'border-sky-900/40 bg-black/25 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      <span
                        className="h-6 w-6 rounded-full ring-2 ring-white/30 shadow-md"
                        style={{ backgroundColor: a.accentHex }}
                      />
                      <span className={`text-xs font-black ${active ? 'text-[#26160b]' : 'text-white'}`}>{a.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-sky-900/40 bg-black/30 p-3.5 text-xs text-sky-100/90">
                <span className="font-black text-amber-300">
                  {selectedMeta.name}:
                </span>{' '}
                {selectedMeta.personality} · Dùng chung phụ kiện & ví Cookies với PAWS Cards.
              </div>
            </div>

            {/* PC Controls */}
            <div className="mt-5 rounded-2xl border border-sky-900/50 bg-[#0c1624] p-4">
              <h3 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-sky-300">
                <Gamepad2 className="h-4 w-4 text-sky-400" />
                <span>Phím Điều Khiển Bàn Phím</span>
              </h3>
              <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-200">
                <div><kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold text-amber-300">WASD</kbd>: Di chuyển</div>
                <div><kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold text-amber-300">Space</kbd>: Nhảy qua khe sàn</div>
                <div><kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold text-amber-300">J</kbd> (Chuột Trái): Đấm / Dùng đồ</div>
                <div><kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold text-amber-300">K</kbd>: Giữ để nắm, nhả để ném</div>
                <div><kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold text-amber-300">L</kbd>: Lăn né (1.5s hồi)</div>
                <div><kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold text-amber-300">Esc</kbd>: Tạm dừng</div>
              </div>
            </div>
          </section>

          {/* Right: Match Settings & Rules */}
          <section className="flex flex-col justify-between rounded-3xl border-2 border-sky-900/40 bg-[#132032] p-5 shadow-2xl sm:p-6 lg:col-span-6">
            <div className="space-y-5">
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-sky-300">
                  Số Bot Đối Thủ ({botCount + 1} người chơi)
                </h2>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {BOT_COUNTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        playSfx('click');
                        onChangeBotCount(n);
                      }}
                      className={`cursor-pointer flex-1 rounded-xl px-3 py-2 text-xs font-black transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                        botCount === n
                          ? 'btn-tactile-amber'
                          : 'border border-sky-900/40 bg-black/25 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      {n} Bot
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-sky-300">
                  Độ Khó Bot AI
                </h2>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        playSfx('click');
                        onChangeDifficulty(d.id);
                      }}
                      className={`cursor-pointer rounded-xl p-3 text-left transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                        difficulty === d.id
                          ? 'btn-tactile-sky'
                          : 'border border-sky-900/40 bg-black/25 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-black">{d.label}</div>
                      <div className="mt-0.5 text-[11px] opacity-85">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Match Format & Items */}
              <div className="rounded-2xl border border-amber-400/30 bg-[#0e1724] p-4 text-xs leading-relaxed text-amber-100/90 shadow-md">
                <div className="inline-flex items-center gap-2 font-black text-amber-300">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span>Thể Thức 3 Hiệp Tính Điểm</span>
                </div>
                <ul className="mt-2 space-y-1.5 text-slate-200">
                  <li>• Đúng <strong>3 hiệp đấu</strong>: Hạng 1 <strong>+3đ</strong> · Hạng 2 <strong>+2đ</strong> · Hạng 3 <strong>+1đ</strong>.</li>
                  <li>• Đánh hết thanh thăng bằng để đối phương <strong>choáng ngã</strong>, sau đó <strong>giữ K</strong> kéo ném ra khỏi mép sàn!</li>
                  <li>• Vành đai sàn lục giác <strong>sụp dần sau mỗi 12s</strong> thu hẹp diện tích.</li>
                  <li>• Nhặt lá bài PAWS rơi tự do: Kem Đá, Tia Chớp, Vỏ Chuối để lật ngược tình thế.</li>
                </ul>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playSfx('roundStart');
                onStart();
              }}
              className="btn-tactile-amber mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-black text-[#1B110B] focus-visible:outline-2 focus-visible:outline-white"
            >
              <Swords className="h-5 w-5" />
              <span>BẮT ĐẦU ĐẤU TRƯỜNG</span>
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}
