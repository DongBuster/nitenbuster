import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Check,
  Cookie,
  Flame,
  ShoppingBag,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import {
  ANIMALS,
  COLORS,
  type CardType,
  type Color,
} from '../../engine/types';
import {
  CARD_META,
  COLORED_CARD_TYPES,
  COLOR_THEME,
  WILD_CARD_TYPES,
} from '../Card/cardMeta';
import { SHOP_ITEMS, useProfileStore } from '../../store/profileStore';
import { playSfx } from '../../audio/soundEngine';

const CARD_TYPE_EMOJI: Record<CardType, string> = {
  basic: '7',
  arrow: '🏹',
  freeze: '❄️',
  boomerang: '🔄',
  shovel: '⛏️',
  crossbow: '🎯',
  taser: '⚡',
  banana: '🍌',
  bomb: '💣',
  egg: '🥚',
  potion: '🧪',
};

function MiniCardBadge({
  type,
  color,
}: {
  type: CardType;
  color?: Color;
}) {
  const meta = CARD_META[type];
  const isWild = meta.isWild || !color;
  const theme = !isWild && color ? COLOR_THEME[color] : null;

  return (
    <div
      className="relative flex h-[104px] w-[78px] shrink-0 flex-col items-center justify-between rounded-xl border-[3px] border-white p-1.5 shadow-md select-none"
      style={{
        background: isWild
          ? 'linear-gradient(155deg, #2E1065 0%, #1E1B4B 100%)'
          : `linear-gradient(155deg, ${theme!.primary} 0%, ${theme!.secondary} 100%)`,
      }}
    >
      <div
        className="self-start text-[10px] font-black leading-none"
        style={{ color: isWild ? '#F8FAFC' : theme!.cornerText }}
      >
        {isWild ? '✦' : theme!.shapeSymbol}
      </div>

      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full text-lg font-black shadow-inner ${
          isWild ? 'bg-[#16103B] text-white ring-2 ring-purple-300/70' : 'bg-[#FFFDF9]'
        }`}
        style={!isWild ? { color: theme!.ink } : undefined}
      >
        {CARD_TYPE_EMOJI[type]}
      </div>

      <span
        className="w-full rounded-full px-1 py-0.5 text-center text-[8px] font-extrabold uppercase leading-[1.1] tracking-tight whitespace-nowrap"
        style={{
          backgroundColor: isWild ? '#0F172A' : theme!.pillBg,
          color: isWild ? '#F8FAFC' : theme!.pillText,
        }}
      >
        {meta.shortLabel}
      </span>
    </div>
  );
}

export interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RulesModal({ isOpen, onClose }: RulesModalProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border-2 border-amber-900/40 bg-[#24160f] text-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-amber-900/40 px-6 py-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300">
                  <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                  <span>Cẩm Nang Trò Chơi</span>
                </span>
                <h2
                  id="rules-modal-title"
                  className="font-display text-2xl font-black text-amber-50"
                >
                  Luật Chơi PAWS 3D
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng luật chơi"
                className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1 rounded-xl border border-white/20 px-3.5 py-2 text-xs font-black text-white"
              >
                <X className="h-4 w-4" />
                <span>Đóng</span>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="space-y-6 overflow-y-auto px-6 py-5">
              {/* Basic Flow + PAWS Rule */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <section className="rounded-2xl border border-amber-900/40 bg-black/25 p-4">
                  <h3 className="inline-flex items-center gap-2 text-base font-black text-amber-200">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    <span>Cách Chơi Cơ Bản</span>
                  </h3>
                  <ul className="mt-2.5 space-y-2 text-sm text-amber-100/90 leading-relaxed">
                    <li>• Mỗi người bắt đầu với <strong>7 lá bài</strong>.</li>
                    <li>
                      • Đến lượt: đánh lá <strong>cùng màu</strong>, <strong>cùng số</strong> hoặc{' '}
                      <strong>cùng ký hiệu</strong> với lá trên bàn (hoặc đánh lá Wild bất kỳ).
                    </li>
                    <li>
                      • Không có lá hợp lệ: bấm chồng rút 3D hoặc nhấn phím <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-xs font-bold text-amber-300">Space</kbd> để rút 1 lá.
                    </li>
                    <li>• Ai <strong>hết bài trên tay đầu tiên</strong> sẽ giành chiến thắng!</li>
                  </ul>
                </section>

                <section className="rounded-2xl border border-amber-400/30 bg-amber-950/40 p-4">
                  <h3 className="inline-flex items-center gap-2 text-base font-black text-amber-200">
                    <Flame className="h-4 w-4 text-amber-400" />
                    <span>Luật Hô &quot;PAWS!&quot; &amp; Biểu Tượng Mù Màu</span>
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-amber-100/90">
                    Khi chỉ còn <strong>1 lá bài</strong>, hãy nhanh tay bấm nút{' '}
                    <strong className="text-amber-300">Hô PAWS!</strong> trước khi đối thủ kịp bắt bài phạt bạn rút thêm 2 lá!
                  </p>
                  <div className="mt-3.5 grid grid-cols-2 gap-2">
                    {COLORS.map((c) => {
                      const theme = COLOR_THEME[c];
                      return (
                        <div
                          key={c}
                          className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/35 px-2.5 py-1.5 text-xs font-bold"
                        >
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-lg text-sm font-black"
                            style={{
                              backgroundColor: theme.primary,
                              color: theme.cornerText,
                            }}
                          >
                            {theme.shapeSymbol}
                          </span>
                          <span>
                            {theme.label} ({theme.shapeName})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* 6 Colored Card Types */}
              <section>
                <h3 className="mb-3 text-base font-black text-sky-200">
                  6 Loại Lá Bài Màu
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {COLORED_CARD_TYPES.map((type, idx) => {
                    const meta = CARD_META[type];
                    const sampleColor = COLORS[idx % COLORS.length];
                    return (
                      <div
                        key={type}
                        className="flex items-center gap-3 rounded-2xl border border-amber-900/40 bg-black/25 p-3"
                      >
                        <MiniCardBadge type={type} color={sampleColor} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-black text-white">
                              {meta.name}
                            </span>
                            <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                              {meta.phase}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-300">
                            {meta.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 5 Wild Card Types */}
              <section>
                <h3 className="mb-3 text-base font-black text-purple-200">
                  5 Loại Lá Wild Đặc Biệt (Đánh Lên Mọi Màu)
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {WILD_CARD_TYPES.map((type) => {
                    const meta = CARD_META[type];
                    return (
                      <div
                        key={type}
                        className="flex items-center gap-3 rounded-2xl border border-purple-400/20 bg-purple-950/35 p-3"
                      >
                        <MiniCardBadge type={type} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-black text-white">
                              {meta.name}
                            </span>
                            <span className="rounded-full bg-purple-400/25 px-1.5 py-0.5 text-[10px] font-bold text-purple-200">
                              {meta.phase}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-300">
                            {meta.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface CookieShopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CookieShopModal({ isOpen, onClose }: CookieShopModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const {
    cookies,
    selectedAnimal,
    unlockedAccessories,
    equippedAccessory,
    selectAnimal,
    buyAccessory,
    equipAccessory,
  } = useProfileStore();

  const currentAnimalMeta =
    ANIMALS.find((a) => a.id === selectedAnimal) ?? ANIMALS[0];
  const currentEquippedId = equippedAccessory[selectedAnimal] ?? null;
  const currentEquippedItem = SHOP_ITEMS.find((i) => i.id === currentEquippedId);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-shop-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-2 border-amber-900/40 bg-[#24160f] text-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-amber-900/40 px-6 py-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300">
                  <ShoppingBag className="h-3.5 w-3.5 text-amber-400" />
                  <span>Phụ Kiện Winter Cabin</span>
                </span>
                <h2
                  id="cookie-shop-title"
                  className="font-display text-2xl font-black text-amber-50"
                >
                  Cửa Hàng Cookies
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-950/70 px-3.5 py-1.5 text-sm font-black text-amber-200">
                  <Cookie className="h-4 w-4 text-amber-400" />
                  <span>{cookies.toLocaleString()}</span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Đóng cửa hàng"
                  className="btn-tactile-wood inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/20 p-2 text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="space-y-5 overflow-y-auto px-6 py-5">
              {/* Active Animal Preview + Selector */}
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-amber-900/40 bg-black/25 p-4 sm:flex-row">
                <div className="relative flex shrink-0 items-center justify-center">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-amber-400 shadow-md"
                    style={{ backgroundColor: currentAnimalMeta.accentHex }}
                  />
                  {currentEquippedItem && (
                    <span
                      title={`Đang đeo: ${currentEquippedItem.name}`}
                      className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-300 bg-[#29170f] text-sm shadow-md"
                    >
                      <Sparkles className="h-4 w-4 text-amber-300" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="text-xs font-bold text-amber-200/70">
                    Đang chọn ({currentAnimalMeta.personality}):
                  </p>
                  <h3 className="text-base font-black text-amber-100">
                    {currentAnimalMeta.name}
                    {currentEquippedItem && (
                      <span className="ml-2 text-xs font-bold text-amber-300">
                        (Đeo: {currentEquippedItem.name})
                      </span>
                    )}
                  </h3>
                  <div className="mt-2.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                    {ANIMALS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          playSfx('click');
                          selectAnimal(a.id);
                        }}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-black transition ${
                          selectedAnimal === a.id
                            ? 'btn-tactile-amber'
                            : 'bg-white/8 text-slate-200 hover:bg-white/16'
                        }`}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Shop Items Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SHOP_ITEMS.map((item) => {
                  const isUnlocked = unlockedAccessories.includes(item.id);
                  const isEquipped = currentEquippedId === item.id;
                  const canAfford = cookies >= item.price;

                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                        isEquipped
                          ? 'border-amber-400 bg-amber-950/40'
                          : isUnlocked
                            ? 'border-emerald-400/35 bg-emerald-950/20'
                            : 'border-amber-900/40 bg-black/25'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-black/40 text-xl shadow-inner">
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-white">
                            {item.name}
                          </h4>
                          <p className="mt-1 text-xs leading-relaxed text-amber-100/75">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                        <span className="inline-flex items-center gap-1 text-xs font-black text-amber-300">
                          {isUnlocked ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span>Đã sở hữu</span>
                            </>
                          ) : (
                            <>
                              <Cookie className="h-3.5 w-3.5 text-amber-400" />
                              <span>{item.price.toLocaleString()}</span>
                            </>
                          )}
                        </span>

                        {isUnlocked ? (
                          <button
                            type="button"
                            onClick={() => {
                              playSfx('click');
                              equipAccessory(
                                selectedAnimal,
                                isEquipped ? null : item.id,
                              );
                            }}
                            className={`cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                              isEquipped
                                ? 'btn-tactile-wood border border-amber-400/40 text-amber-200'
                                : 'btn-tactile-emerald'
                            }`}
                          >
                            {isEquipped ? 'Tháo ra' : 'Trang bị'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => {
                              const ok = buyAccessory(item.id);
                              if (ok) {
                                playSfx('win');
                                equipAccessory(selectedAnimal, item.id);
                              }
                            }}
                            className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                              canAfford
                                ? 'btn-tactile-amber cursor-pointer'
                                : 'cursor-not-allowed bg-white/10 text-white/40'
                            }`}
                          >
                            {canAfford ? 'Mua ngay' : 'Chưa đủ Cookie'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
