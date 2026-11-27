import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { AnimalAvatar } from './AnimalAvatar';

/**
 * Full-screen blocker shown on touch phone viewports so the game can only be
 * played on Tablets (with virtual D-pad + skill bars) or Desktop/Laptop.
 */
export function MobileBlockScreen() {
  return (
    <main className="safe-hud-inset flex min-h-dvh w-full items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_top,_#4a2816_0%,_#24130b_55%,_#140a05_100%)] p-5 text-amber-50">
      <section
        aria-labelledby="mobile-block-title"
        className="w-full max-w-md rounded-3xl border border-amber-400/35 bg-[#2a170e]/95 p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-md"
      >
        <div className="mx-auto flex w-fit items-center justify-center gap-2 rounded-2xl border border-amber-300/25 bg-black/25 px-4 py-2.5">
          <AnimalAvatar animal="dog" size="md" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-400/45 bg-rose-500/20 text-rose-300">
            <Smartphone className="h-5 w-5" aria-hidden="true" />
          </div>
          <AnimalAvatar animal="cat" size="md" />
        </div>

        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1 text-[11px] font-black tracking-wide text-rose-200 uppercase">
          Không hỗ trợ điện thoại
        </span>

        <h1
          id="mobile-block-title"
          className="mt-3 font-display text-2xl font-black text-amber-200"
        >
          Chưa hỗ trợ chơi trên Mobile
        </h1>

        <p className="mt-2.5 text-sm leading-relaxed text-amber-100/85">
          Các chế độ chiến đấu 3D và phối hợp của PAWS cần nhiều nút di chuyển
          và chiêu thức cùng lúc nên không chơi được trên màn hình điện thoại.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2.5 text-left">
          <div className="rounded-2xl border border-emerald-400/35 bg-emerald-950/35 p-3">
            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300">
              <Tablet className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Tablet / iPad</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-emerald-100/80">
              Hiển thị sẵn D-pad di chuyển &amp; cụm nút chiêu thức.
            </p>
          </div>

          <div className="rounded-2xl border border-sky-400/35 bg-sky-950/35 p-3">
            <div className="flex items-center gap-1.5 text-xs font-black text-sky-300">
              <Monitor className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>PC / Laptop</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-sky-100/80">
              Điều khiển đầy đủ bằng bàn phím &amp; chuột.
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs font-semibold text-amber-200/65">
          Vui lòng chuyển sang Tablet hoặc máy tính để tiếp tục chơi.
        </p>
      </section>
    </main>
  );
}
