import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ANIMALS, type AnimalId } from '../../engine/types';

export interface PawsShoutInfo {
  key: string;
  playerName: string;
  animal: AnimalId;
}

const ANIMAL_EMOJI: Record<AnimalId, string> = {
  dog: '🐶',
  cat: '🐱',
  duck: '🦆',
  shark: '🦈',
  dino: '🦖',
  panda: '🐼',
  chicken: '🐔',
  bunny: '🐰',
};

export function PawsShoutOverlay({ shout }: { shout: PawsShoutInfo | null }) {
  const prefersReducedMotion = useReducedMotion();
  const meta = shout
    ? ANIMALS.find((a) => a.id === shout.animal) ?? ANIMALS[0]
    : ANIMALS[0];

  return (
    <AnimatePresence>
      {shout && (
        <motion.div
          key={shout.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-live="polite"
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden"
        >
          {/* Full-screen golden-amber radial spotlight pulse */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0.7 } : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.34)_0%,_rgba(249,115,22,0.16)_40%,_rgba(15,23,42,0.45)_100%)]"
          />

          {/* Center Hero Banner */}
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.55, y: 24, rotate: -4 }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, y: 0, rotate: 0 }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 1.08, y: -16 }
            }
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            className="relative mx-4 flex flex-col items-center gap-2 rounded-3xl border-4 border-amber-200 bg-gradient-to-b from-amber-400 via-orange-400 to-amber-500 px-8 py-5 text-center text-[#2C1B11] shadow-[0_20px_70px_rgba(251,191,36,0.65)]"
          >
            <div className="flex items-center gap-2 rounded-full bg-[#2C1B11]/90 px-4 py-1 text-xs font-black uppercase tracking-wider text-amber-200">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: meta.accentHex }}
              />
              <span>{ANIMAL_EMOJI[shout.animal]}</span>
              <span>{shout.playerName}</span>
            </div>

            <div className="font-display text-4xl font-black tracking-tight drop-shadow-sm sm:text-5xl">
              🐾 PAWS!!
            </div>

            <p className="text-xs font-extrabold text-[#2C1B11]/90 sm:text-sm">
              Chỉ còn đúng 1 lá bài trên tay!
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
