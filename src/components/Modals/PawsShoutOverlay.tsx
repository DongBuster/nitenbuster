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
    <div
      role="region"
      aria-label="Thông báo hô PAWS"
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      <AnimatePresence>
        {shout && (
          <motion.div
            key={shout.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
          >
            {/* Subtle full-screen edge glow frame (center stays 100% clear) */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0.85 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 border-4 border-amber-300/50 shadow-[inset_0_0_72px_rgba(251,191,36,0.42)]"
            />

            {/* Compact Top-Right Banner (stays clear of center timer, characters & chat bubbles) */}
            <div className="absolute top-16 right-3 sm:top-16 sm:right-4">
              <motion.div
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.86, x: 24 }
                }
                animate={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : { opacity: 1, scale: 1, x: 0 }
                }
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.94, x: 16 }
                }
                transition={{ type: 'spring', stiffness: 440, damping: 28 }}
                className="flex items-center gap-2 rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 px-3.5 py-2 text-[#2C1B11] shadow-[0_10px_32px_rgba(251,191,36,0.5)]"
              >
                <div className="flex items-center gap-1 rounded-full bg-[#2C1B11]/90 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-200">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: meta.accentHex }}
                  />
                  <span>{ANIMAL_EMOJI[shout.animal]}</span>
                  <span className="max-w-[96px] truncate">{shout.playerName}</span>
                </div>

                <div className="font-display text-lg font-black leading-none tracking-tight drop-shadow-sm sm:text-xl">
                  🐾 PAWS!!
                </div>

                <span className="rounded-full bg-white/40 px-2 py-0.5 text-[10px] font-extrabold text-[#2C1B11]">
                  1 lá!
                </span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
