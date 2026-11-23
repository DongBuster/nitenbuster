import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Play,
} from 'lucide-react';

export interface TutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TutorialStep {
  number: number;
  region: string;
  icon: string;
  title: string;
  summary: string;
  bullets: string[];
  accent: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    number: 1,
    region: 'Vùng giữa bàn 3D',
    icon: '🎯',
    title: 'Vòng Sáng Màu & Chiều Đánh',
    summary:
      'Vòng tròn phát sáng giữa bàn hiển thị màu hiện tại và 3 mũi tên xoay cho biết chiều đánh (thuận hoặc ngược chiều kim đồng hồ).',
    bullets: [
      'Đánh lá cùng màu, cùng số (0–9) hoặc cùng ký hiệu với lá trên cùng của chồng bỏ.',
      'Mỗi màu có biểu tượng hình học riêng: Hồng ● · Xanh dương ■ · Xanh lá ▲ · Vàng ★.',
      'Lá Vòng Xoay đảo chiều vòng sáng ngay lập tức!',
    ],
    accent: 'from-amber-400/25 to-orange-500/15 border-amber-300/35',
  },
  {
    number: 2,
    region: 'Tay bài 3D phía trước',
    icon: '🎴',
    title: 'Tay Bài 3D Thông Minh',
    summary:
      'Toàn bộ bài trên tay bạn được xếp quạt 3D nổi ngay phía trước bàn chơi để thao tác trực tiếp.',
    bullets: [
      'Khi đến lượt bạn: các lá hợp lệ sáng rực và tự nâng lên khi rê chuột — bấm để đánh ngay!',
      'Các lá chưa thể đánh sẽ tự tối đi giúp bạn nhận diện nước đi trong tích tắc.',
      'Khi bot đang đi, bài trên tay vẫn sáng rõ để bạn dễ tính trước nước tiếp theo.',
    ],
    accent: 'from-sky-400/25 to-indigo-500/15 border-sky-300/35',
  },
  {
    number: 3,
    region: 'Chồng rút 3D & Phím Space',
    icon: '📥',
    title: 'Rút Bài & Phạt Cộng Dồn',
    summary:
      'Không có lá hợp lệ? Bấm thẳng vào chồng rút 3D bên trái hoặc nhấn phím Space để rút 1 lá và qua lượt.',
    bullets: [
      'Xẻng Tuyết (+2) ép người kế rút 2 lá — có thể đánh chồng Xẻng Tuyết khác để cộng dồn (+4, +6...)!',
      'Dùng Thuốc Tàng Hình khi đang dính phạt cộng dồn để chuyển toàn bộ hình phạt sang người kế tiếp!',
    ],
    accent: 'from-emerald-400/25 to-teal-500/15 border-emerald-300/35',
  },
  {
    number: 4,
    region: 'Lá Wild & Chọn Mục Tiêu',
    icon: '✨',
    title: 'Lá Wild Đổi Màu & Nỏ Thần',
    summary:
      '5 lá Wild nền tím đêm đánh được lên MỌI màu và cho phép bạn đổi màu bàn chơi theo ý muốn:',
    bullets: [
      'Tia Chớp: chọn màu, người kế rút đến khi ra màu đó (hoặc Wild) và mất lượt!',
      'Vỏ Chuối: giấu bẫy vào chồng rút — ai rút trúng bị phạt +3 lá!',
      'Bom Kẹo: hẹn giờ nổ +4 lá · Trứng Bất Ngờ: nở hiệu ứng ngẫu nhiên · Tàng Hình: lá chắn đổi màu.',
      'Nỏ Thần: chọn thẳng 1 đối thủ trên bàn 3D để bắn thêm 1 lá vào tay họ!',
    ],
    accent: 'from-purple-400/25 to-fuchsia-500/15 border-purple-300/35',
  },
  {
    number: 5,
    region: 'Nút Hô PAWS! & Huy hiệu Bot',
    icon: '🐾',
    title: 'Luật Hô "PAWS!" & Bắt Lỗi (+2)',
    summary:
      'Ai đánh hết bài trên tay đầu tiên sẽ thắng và nhận +50 Cookies (tham gia vẫn nhận +15 Cookies)!',
    bullets: [
      'Khi còn đúng 1 lá bài, bấm ngay nút Hô PAWS! ở thanh dưới để khỏi bị đối thủ bắt lỗi.',
      'Nếu quên hô khi còn 1 lá, bot (mức Vừa/Khó) sẽ phạt bạn rút +2 lá!',
      'Thấy bot chỉ còn 1 lá mà quên hô? Bấm ngay nút Bắt lỗi PAWS! phía trên đầu bot để phạt chúng!',
    ],
    accent: 'from-rose-400/25 to-amber-500/15 border-rose-300/35',
  },
];

export function TutorialOverlay({ isOpen, onClose }: TutorialOverlayProps) {
  const prefersReducedMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
    }
  }, [isOpen]);

  const step = TUTORIAL_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-step-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.94, y: 18 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.95, y: 12 }
            }
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-3xl border-2 border-amber-900/40 bg-[#24160f] text-white shadow-2xl"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-amber-900/40 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-950/70 px-3 py-1 text-xs font-black text-amber-300">
                  <GraduationCap className="h-3.5 w-3.5 text-amber-400" />
                  <span>Hướng Dẫn Tân Thủ (Bước {step.number}/{TUTORIAL_STEPS.length})</span>
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1 rounded-xl border border-white/20 px-3 py-1 text-xs font-bold text-slate-300 transition hover:text-white"
              >
                <span>Bỏ qua</span>
              </button>
            </div>

            {/* Step Content */}
            <div className="px-6 py-5">
              <div
                className={`rounded-2xl border bg-black/35 p-5 ${step.accent}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[11px] font-extrabold text-amber-200">
                    <span>{step.region}</span>
                  </span>
                  <span className="text-2xl leading-none" aria-hidden="true">
                    {step.icon}
                  </span>
                </div>

                <h2
                  id="tutorial-step-title"
                  className="mt-3 font-display text-xl font-black tracking-tight text-amber-50 sm:text-2xl"
                >
                  {step.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-200">
                  {step.summary}
                </p>

                <ul className="mt-4 space-y-2 text-sm text-slate-100">
                  {step.bullets.map((line, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-xl bg-black/40 px-3 py-2 text-xs leading-relaxed sm:text-sm"
                    >
                      <span className="mt-0.5 text-amber-300 font-bold">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Step Progress Dots */}
              <div className="mt-5 flex items-center justify-center gap-2">
                {TUTORIAL_STEPS.map((s, idx) => (
                  <button
                    key={s.number}
                    type="button"
                    aria-label={`Chuyển đến bước ${s.number}: ${s.title}`}
                    onClick={() => setStepIndex(idx)}
                    className={`h-2.5 cursor-pointer rounded-full transition-all ${
                      idx === stepIndex
                        ? 'w-8 bg-amber-400'
                        : 'w-2.5 bg-white/25 hover:bg-white/45'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Footer Navigation */}
            <div className="flex items-center justify-between gap-3 border-t border-amber-900/40 bg-black/30 px-6 py-4">
              <button
                type="button"
                disabled={isFirst}
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition ${
                  isFirst
                    ? 'cursor-not-allowed bg-white/5 text-slate-500'
                    : 'btn-tactile-wood cursor-pointer border border-white/20 text-white'
                }`}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Trước</span>
              </button>

              {isLast ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-tactile-amber inline-flex cursor-pointer items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-black text-[#26160b]"
                >
                  <Play className="h-4 w-4" />
                  <span>Bắt Đầu Chơi Ngay!</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setStepIndex((i) => Math.min(TUTORIAL_STEPS.length - 1, i + 1))
                  }
                  className="btn-tactile-amber inline-flex cursor-pointer items-center gap-1.5 rounded-2xl px-5 py-2 text-sm font-black text-[#26160b]"
                >
                  <span>Tiếp theo</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
