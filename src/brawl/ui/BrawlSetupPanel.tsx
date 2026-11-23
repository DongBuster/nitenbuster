import { ANIMALS, type AnimalId } from '../../engine/types';
import { playSfx } from '../../audio/soundEngine';
import { SHOP_ITEMS } from '../../store/profileStore';
import { BRAWL_ANIMAL_EMOJI } from '../sim/constants';
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
  { id: 'medium', label: 'Trung bình', desc: 'Cân bằng vui nhộn' },
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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1e3a5f_0%,_#14243a_55%,_#0b1422_100%)] text-[#F8FAFC] selection:bg-amber-300 selection:text-[#1B110B]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onBackToModeSelect();
              }}
              className="cursor-pointer rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-extrabold text-amber-100 backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              ← Chọn Chế Độ
            </button>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/35 bg-sky-400/15 px-3 py-0.5 text-[11px] font-black tracking-wide text-sky-200">
                <span>🥊</span>
                <span>MINIGAME 2 · ĐẤU TRƯỜNG 3D</span>
              </div>
              <h1 className="mt-1 font-display text-2xl font-black tracking-tight text-white sm:text-3xl">
                ❄️ BRAWL ARENA — WINTER CABIN
              </h1>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/35 bg-[#1B110B]/80 px-4 py-2 text-sm font-black text-amber-200 shadow-lg">
            <span aria-hidden="true">🍪</span>
            <span>{cookies} Cookies</span>
          </div>
        </header>

        {/* Main 2-column setup card */}
        <main className="my-6 grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Character Selection */}
          <section className="flex flex-col justify-between rounded-3xl border border-white/15 bg-slate-900/65 p-5 shadow-2xl backdrop-blur-md lg:col-span-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-wider text-sky-200">
                  Chọn Chiến Binh Thú Cưng
                </h2>
                {equippedItem && (
                  <span className="rounded-full border border-amber-300/40 bg-amber-400/15 px-2.5 py-0.5 text-xs font-bold text-amber-200">
                    {equippedItem.icon} {equippedItem.name}
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
                      className={`cursor-pointer flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                        active
                          ? 'border-amber-300 bg-amber-400/20 shadow-lg ring-2 ring-amber-300/60'
                          : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-3xl">{BRAWL_ANIMAL_EMOJI[a.id] ?? '🐾'}</span>
                      <span className="text-xs font-black text-white">{a.name}</span>
                      <span
                        className="h-1.5 w-8 rounded-full"
                        style={{ backgroundColor: a.accentHex }}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3.5 text-xs text-sky-100/90">
                <span className="font-black text-amber-300">
                  {BRAWL_ANIMAL_EMOJI[selectedMeta.id]} {selectedMeta.name}:
                </span>{' '}
                {selectedMeta.personality} · Dùng chung phụ kiện & Cookies với PAWS Cards.
              </div>
            </div>

            {/* PC Controls */}
            <div className="mt-5 rounded-2xl border border-sky-300/25 bg-sky-950/50 p-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-sky-200">
                🎮 Điều Khiển Bàn Phím 2 Tay (Gọn Tay)
              </h3>
              <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-200">
                <div><kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold text-amber-200">WASD</kbd> / Mũi tên: Di chuyển</div>
                <div><kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold text-amber-200">Space</kbd>: Nhảy qua khe sàn</div>
                <div><kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold text-amber-200">J</kbd> (hoặc Click): Đấm / Dùng đồ</div>
                <div><kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold text-amber-200">Giữ / Nhả K</kbd>: Nắm & Ném</div>
                <div><kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold text-amber-200">L</kbd>: Lăn né (1.5s)</div>
                <div><kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold text-amber-200">1 – 4</kbd>: Biểu cảm · <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono font-bold text-amber-200">Esc</kbd>: Tạm dừng</div>
              </div>
            </div>
          </section>

          {/* Right: Match Settings & Rules */}
          <section className="flex flex-col justify-between rounded-3xl border border-white/15 bg-slate-900/65 p-5 shadow-2xl backdrop-blur-md lg:col-span-6">
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-sky-200">
                  Số Bot Đối Thủ ({botCount + 1} chiến binh trên sàn)
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
                      className={`cursor-pointer flex-1 rounded-xl border px-3 py-2 text-xs font-black transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                        botCount === n
                          ? 'border-amber-300 bg-amber-400 text-[#1B110B] shadow-md'
                          : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/15'
                      }`}
                    >
                      {n} Bot
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-sky-200">
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
                      className={`cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                        difficulty === d.id
                          ? 'border-sky-300 bg-sky-400/20 text-white ring-2 ring-sky-300/50'
                          : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/15'
                      }`}
                    >
                      <div className="text-xs font-black">{d.label}</div>
                      <div className="mt-0.5 text-[11px] text-slate-300">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Match Format & Items */}
              <div className="rounded-2xl border border-amber-300/25 bg-[#1B110B]/65 p-4 text-xs leading-relaxed text-amber-100/90">
                <div className="font-black text-amber-300">
                  🏆 Thể Thức 3 Hiệp Tính Điểm · Liên Kết Lá Bài PAWS
                </div>
                <ul className="mt-2 space-y-1 text-slate-200">
                  <li>• Chơi đúng <strong>3 hiệp</strong>: Hạng 1 <strong>+3đ</strong> · Hạng 2 <strong>+2đ</strong> · Hạng 3 <strong>+1đ</strong>. Tổng điểm cao nhất vô địch!</li>
                  <li>• Đánh hết thanh thăng bằng để <strong>choáng ngã</strong> rồi <strong>giữ K</strong> nắm kéo ra mép, <strong>nhả K</strong> để ném!</li>
                  <li>• Sàn lục giác <strong>sụp dần từ ngoài vào</strong> sau mỗi 12s (cảnh báo rung đỏ 2s).</li>
                  <li>• Nhặt <strong>thẻ PAWS rơi từ trời</strong>: 🧊 Kem Đá, ⚡ Tia Chớp, 🪃 Vòng Xoay + vũ khí mùa đông!</li>
                </ul>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playSfx('roundStart');
                onStart();
              }}
              className="mt-5 w-full cursor-pointer rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 px-6 py-4 text-base font-black text-[#1B110B] shadow-[0_12px_35px_rgba(251,191,36,0.35)] transition-transform hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-white"
            >
              🥊 BẮT ĐẦU ĐẤU TRƯỜNG!
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}
