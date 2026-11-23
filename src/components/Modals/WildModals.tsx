import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ANIMALS,
  COLORS,
  type AnimalId,
  type CardType,
  type Color,
  type GameState,
  type Player,
} from '../../engine/types';
import { CARD_META, COLOR_THEME } from '../Card/cardMeta';

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

function AnimalBadge({
  animal,
  size = 'md',
  highlight = false,
}: {
  animal: AnimalId;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean;
}) {
  const meta = ANIMALS.find((a) => a.id === animal) ?? ANIMALS[0];
  const dims =
    size === 'sm'
      ? 'h-10 w-10 text-lg'
      : size === 'lg'
        ? 'h-24 w-24 text-5xl'
        : 'h-14 w-14 text-2xl';

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-2xl border-2 shadow-md ${dims} ${
        highlight ? 'border-amber-300 ring-4 ring-amber-400/35' : 'border-white/30'
      }`}
      style={{
        background: `linear-gradient(145deg, ${meta.accentHex}, #1E293B)`,
      }}
      title={`${meta.name} — ${meta.personality}`}
    >
      <span aria-hidden="true">{ANIMAL_EMOJI[animal]}</span>
    </div>
  );
}

export interface ColorPickerModalProps {
  isOpen: boolean;
  cardType?: CardType;
  onSelectColor: (color: Color) => void;
  onCancel?: () => void;
}

export function ColorPickerModal({
  isOpen,
  cardType,
  onSelectColor,
  onCancel,
}: ColorPickerModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const cardName = cardType ? CARD_META[cardType].name : 'Lá Wild';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="color-picker-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="w-full max-w-md rounded-3xl border border-amber-200/25 bg-slate-900/95 p-6 text-white shadow-2xl"
          >
            <div className="mb-5 text-center">
              <span className="inline-block rounded-full bg-purple-500/25 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-purple-200">
                {cardName}
              </span>
              <h2
                id="color-picker-title"
                className="mt-2 text-2xl font-black tracking-tight text-amber-50"
              >
                Chọn Màu Tiếp Theo
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Mỗi màu đều có biểu tượng hình học riêng cho chế độ mù màu.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {COLORS.map((c) => {
                const theme = COLOR_THEME[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onSelectColor(c)}
                    style={{
                      background: `linear-gradient(145deg, ${theme.primary}, ${theme.secondary})`,
                      color: theme.cornerText,
                    }}
                    className="group flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-white/80 px-4 py-5 font-black shadow-lg transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
                  >
                    <span className="text-3xl leading-none" aria-hidden="true">
                      {theme.shapeSymbol}
                    </span>
                    <span className="text-lg leading-none">
                      {theme.label} {theme.shapeSymbol}
                    </span>
                    <span className="text-xs font-bold opacity-85">
                      Hình {theme.shapeName}
                    </span>
                  </button>
                );
              })}
            </div>

            {onCancel && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={onCancel}
                  className="cursor-pointer rounded-xl border border-white/20 bg-white/10 px-5 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/20"
                >
                  Hủy chọn
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface TargetPickerModalProps {
  isOpen: boolean;
  opponents: Player[];
  onSelectTarget: (playerId: string) => void;
  onCancel?: () => void;
}

export function TargetPickerModal({
  isOpen,
  opponents,
  onSelectTarget,
  onCancel,
}: TargetPickerModalProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="target-picker-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="w-full max-w-lg rounded-3xl border border-rose-300/30 bg-slate-900/95 p-6 text-white shadow-2xl"
          >
            <div className="mb-5 text-center">
              <span className="inline-block rounded-full bg-rose-500/25 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-rose-200">
                🎯 Nỏ Thần
              </span>
              <h2
                id="target-picker-title"
                className="mt-2 text-2xl font-black tracking-tight text-amber-50"
              >
                Chọn Đối Thủ Bị Bắn
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Người bị chọn sẽ nhận thêm 1 lá bài từ chồng rút vào tay!
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {opponents.map((opp) => {
                const isLow = opp.hand.length <= 2;
                const animalMeta = ANIMALS.find((a) => a.id === opp.animal);
                return (
                  <button
                    key={opp.id}
                    type="button"
                    onClick={() => onSelectTarget(opp.id)}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/15 bg-white/8 p-3 text-left transition hover:-translate-y-0.5 hover:border-rose-400 hover:bg-rose-500/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-300"
                  >
                    <AnimalBadge animal={opp.animal} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-base font-black text-white">
                          {opp.name}
                        </span>
                        {opp.hand.length === 1 && (
                          <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
                            PAWS!
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-slate-400">
                        {animalMeta?.personality}
                      </p>
                      <p
                        className={`mt-0.5 text-xs font-bold ${
                          isLow ? 'text-rose-300' : 'text-slate-300'
                        }`}
                      >
                        🎴 Còn {opp.hand.length} lá
                      </p>
                    </div>
                    <span className="rounded-xl bg-rose-500 px-2.5 py-1 text-xs font-black text-white">
                      Bắn!
                    </span>
                  </button>
                );
              })}
            </div>

            {onCancel && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={onCancel}
                  className="cursor-pointer rounded-xl border border-white/20 bg-white/10 px-5 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/20"
                >
                  Hủy chọn
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface ResultModalProps {
  isOpen: boolean;
  state: GameState;
  humanPlayerId: string;
  cookiesEarned?: number;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
}

export function ResultModal({
  isOpen,
  state,
  humanPlayerId,
  cookiesEarned,
  onPlayAgain,
  onBackToMenu,
}: ResultModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const winner = state.players.find((p) => p.id === state.winnerId) ?? state.players[0];
  const didHumanWin = state.winnerId === humanPlayerId;
  const reward = cookiesEarned ?? (didHumanWin ? 50 : 15);

  const standings = [...state.players].sort((a, b) => {
    if (a.id === state.winnerId) return -1;
    if (b.id === state.winnerId) return 1;
    return a.hand.length - b.hand.length;
  });

  return (
    <AnimatePresence>
      {isOpen && winner && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="result-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/78 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="w-full max-w-lg rounded-3xl border border-amber-300/35 bg-gradient-to-b from-slate-900/98 to-slate-950/98 p-6 text-white shadow-2xl"
          >
            <div className="flex flex-col items-center text-center">
              <span
                className={`rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-wider ${
                  didHumanWin
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-sky-500/25 text-sky-200'
                }`}
              >
                {didHumanWin ? '🏆 Chiến Thắng Tuyệt Đối!' : '❄️ Kết Thúc Ván Đấu'}
              </span>

              <div className="my-4">
                <AnimalBadge animal={winner.animal} size="lg" highlight />
              </div>

              <h2
                id="result-modal-title"
                className="text-2xl font-black text-amber-50"
              >
                {didHumanWin
                  ? 'Bạn đã thắng ván bài PAWS!'
                  : `${winner.name} đã về nhất!`}
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Tổng số lượt: <strong className="text-white">{state.turnCount}</strong>
              </p>

              {/* Cookies reward badge */}
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-400/15 px-4 py-1.5 text-sm font-black text-amber-200">
                <span>🍪</span>
                <span>+{reward} Cookies thưởng!</span>
              </div>
            </div>

            {/* Standings */}
            <div className="mt-5 max-h-52 space-y-2 overflow-y-auto pr-1">
              {standings.map((p, idx) => {
                const isMe = p.id === humanPlayerId;
                const isWinner = p.id === state.winnerId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between rounded-2xl border px-3.5 py-2 ${
                      isWinner
                        ? 'border-amber-300/50 bg-amber-400/15'
                        : isMe
                          ? 'border-sky-300/35 bg-sky-500/15'
                          : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 text-center text-sm font-black text-amber-300">
                        #{idx + 1}
                      </span>
                      <AnimalBadge
                        animal={p.animal}
                        size="sm"
                        highlight={isWinner}
                      />
                      <span className="text-sm font-extrabold text-white">
                        {p.name}
                        {isMe && (
                          <span className="ml-1.5 rounded bg-sky-400/25 px-1.5 py-0.5 text-[10px] font-black text-sky-200">
                            BẠN
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-300">
                      {isWinner ? 'Hết bài 🏆' : `Còn ${p.hand.length} lá`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={onPlayAgain}
                className="flex-1 cursor-pointer rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:brightness-110"
              >
                🔄 Chơi Lại Ván Mới
              </button>
              <button
                type="button"
                onClick={onBackToMenu}
                className="flex-1 cursor-pointer rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
              >
                🏠 Về Menu Chính
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
