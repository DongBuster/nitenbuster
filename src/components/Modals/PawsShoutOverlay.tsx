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
          className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center overflow-hidden pt-28 sm:pt-32"
        >
          {/* Full-screen edge glow frame (center stays 100% clear so table & cards remain visible) */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0.85 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 border-4 border-amber-300/55 shadow-[inset_0_0_90px_rgba(251,191,36,0.5)]"
          />

          {/* Compact Upper Banner (doesn't cover the 3D discard pile) */}
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.8, y: -20 }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.95, y: -12 }
            }
            transition={{ type: 'spring', stiffness: 440, damping: 26 }}
            className="relative mx-4 flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 px-5 py-2.5 text-[#2C1B11] shadow-[0_12px_40px_rgba(251,191,36,0.55)]"
          >
            <div className="flex items-center gap-1.5 rounded-full bg-[#2C1B11]/90 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-200">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: meta.accentHex }}
              />
              <span>{ANIMAL_EMOJI[shout.animal]}</span>
              <span>{shout.playerName}</span>
            </div>

            <div className="font-display text-2xl font-black tracking-tight drop-shadow-sm sm:text-3xl">
              🐾 PAWS!!
            </div>

            <span className="rounded-full bg-white/35 px-2.5 py-0.5 text-xs font-extrabold text-[#2C1B11]">
              Còn 1 lá!
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
