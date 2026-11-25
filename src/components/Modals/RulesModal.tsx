import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Check,
  Cookie,
  Eye,
  Flame,
  ShoppingBag,
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
import {
  EQUIP_CATEGORIES,
  formatEquippedSummary,
  getAccessoryMeta,
  normalizeAccessories,
  toggleSlotAccessory,
  type EquipCategory,
} from '../../scene3d/accessoryCatalog';
import { playSfx } from '../../audio/soundEngine';
import { ShopCharacterPreview } from './ShopCharacterPreview';

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
          exit={{ opacity: 0, transition: { duration: 0.14 } }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0, transition: { duration: 0.12 } }
                : { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.14 } }
            }
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
    clearAccessories,
  } = useProfileStore();

  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | EquipCategory>(
    'all',
  );

  useEffect(() => {
    if (!isOpen) {
      setPreviewItemId(null);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const currentAnimalMeta =
    ANIMALS.find((a) => a.id === selectedAnimal) ?? ANIMALS[0];
  const currentEquippedList = normalizeAccessories(
    equippedAccessory[selectedAnimal],
  );
  const previewMeta = previewItemId ? getAccessoryMeta(previewItemId) : null;
  const isPreviewOnly =
    previewMeta !== null && !currentEquippedList.includes(previewMeta.id);

  // Merge previewed item into active multi-slot outfit (replacing only its own slot)
  const displayedLoadout = isPreviewOnly
    ? toggleSlotAccessory(currentEquippedList, previewMeta.id)
    : currentEquippedList;

  const equippedSummary = formatEquippedSummary(currentEquippedList);
  const equippedLabel = equippedSummary
    ? equippedSummary.extraCount > 0
      ? `${equippedSummary.primaryName} +${equippedSummary.extraCount}`
      : equippedSummary.primaryName
    : null;

  const visibleItems =
    activeCategory === 'all'
      ? SHOP_ITEMS
      : SHOP_ITEMS.filter((item) => item.category === activeCategory);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-shop-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.14 } }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0, transition: { duration: 0.12 } }
                : { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.14 } }
            }
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border-2 border-amber-900/40 bg-[#24160f] text-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-amber-900/40 px-6 py-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300">
                  <ShoppingBag className="h-3.5 w-3.5 text-amber-400" />
                  <span>Phụ Kiện Winter Cabin · Phối 5 Vùng</span>
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
            <div className="grid grid-cols-1 gap-5 overflow-y-auto overscroll-contain px-6 py-5 lg:grid-cols-12">
              {/* Left: Live 3D Preview + 5-Slot Loadout + Animal Selector */}
              <div className="flex flex-col gap-3 lg:col-span-5">
                <ShopCharacterPreview
                  animal={selectedAnimal}
                  animalName={currentAnimalMeta.name}
                  accentHex={currentAnimalMeta.accentHex}
                  accessories={displayedLoadout}
                  equippedLabel={equippedLabel}
                  previewItemName={isPreviewOnly ? previewMeta.name : null}
                />

                {/* 5-Slot Active Loadout Bar */}
                <div className="rounded-2xl border border-amber-900/40 bg-black/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                      Đang phối ({currentEquippedList.length}/5 vùng)
                    </span>
                    {currentEquippedList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          playSfx('click');
                          setPreviewItemId(null);
                          clearAccessories(selectedAnimal);
                        }}
                        className="cursor-pointer rounded-lg border border-rose-400/35 bg-rose-950/40 px-2 py-0.5 text-[11px] font-bold text-rose-200 transition hover:bg-rose-900/50"
                      >
                        Tháo hết
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-2">
                    {EQUIP_CATEGORIES.map((cat) => {
                      const equippedInSlot = currentEquippedList
                        .map((id) => getAccessoryMeta(id))
                        .find((m) => m?.category === cat.id);

                      if (equippedInSlot) {
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              playSfx('click');
                              equipAccessory(selectedAnimal, equippedInSlot.id);
                            }}
                            title={`Bấm để tháo ${equippedInSlot.name}`}
                            className="flex cursor-pointer items-center justify-between gap-1 rounded-xl border border-amber-400/45 bg-amber-950/45 px-2.5 py-1 text-left text-[11px] font-bold text-amber-100 transition hover:border-rose-400/60 hover:bg-rose-950/35"
                          >
                            <span className="truncate">
                              <span className="text-amber-300">{cat.label}:</span>{' '}
                              {equippedInSlot.name}
                            </span>
                            <X className="h-3 w-3 shrink-0 text-amber-300/80" />
                          </button>
                        );
                      }

                      return (
                        <div
                          key={cat.id}
                          className="rounded-xl border border-dashed border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/45"
                        >
                          {cat.label}: Trống
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Animal Selector */}
                <div className="rounded-2xl border border-amber-900/40 bg-black/25 p-3">
                  <p className="text-[11px] font-bold text-amber-200/75">
                    Chọn nhân vật ({currentAnimalMeta.personality}):
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ANIMALS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          playSfx('click');
                          setPreviewItemId(null);
                          selectAnimal(a.id);
                        }}
                        className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-black transition ${
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

              {/* Right: Category Filter + Shop Items Grid */}
              <div className="flex flex-col gap-3 lg:col-span-7">
                {/* Category Filter Tabs */}
                <div
                  role="tablist"
                  aria-label="Lọc theo vùng phụ kiện"
                  className="flex flex-wrap gap-1.5"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === 'all'}
                    onClick={() => {
                      playSfx('click');
                      setActiveCategory('all');
                    }}
                    className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-black transition ${
                      activeCategory === 'all'
                        ? 'btn-tactile-amber'
                        : 'bg-white/8 text-amber-100 hover:bg-white/16'
                    }`}
                  >
                    Tất cả ({SHOP_ITEMS.length})
                  </button>
                  {EQUIP_CATEGORIES.map((cat) => {
                    const count = SHOP_ITEMS.filter(
                      (i) => i.category === cat.id,
                    ).length;
                    const active = activeCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          playSfx('click');
                          setActiveCategory(cat.id);
                        }}
                        className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-black transition ${
                          active
                            ? 'btn-tactile-amber'
                            : 'bg-white/8 text-amber-100 hover:bg-white/16'
                        }`}
                      >
                        {cat.label} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Items Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {visibleItems.map((item) => {
                    const isUnlocked =
                      Boolean(item.isDefaultUnlocked) ||
                      unlockedAccessories.includes(item.id);
                    const isEquipped = currentEquippedList.includes(item.id);
                    const isPreviewing = isPreviewOnly && previewItemId === item.id;
                    const canAfford = cookies >= item.price;
                    const catLabel =
                      EQUIP_CATEGORIES.find((c) => c.id === item.category)
                        ?.label ?? '';

                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                          isEquipped
                            ? 'border-amber-400 bg-amber-950/40'
                            : isPreviewing
                              ? 'border-sky-400 bg-sky-950/30'
                              : isUnlocked
                                ? 'border-emerald-400/35 bg-emerald-950/20'
                                : 'border-amber-900/40 bg-black/25'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-black/40 text-xl shadow-inner">
                            {item.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h4 className="text-sm font-black text-white">
                                {item.name}
                              </h4>
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                                {catLabel}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-amber-100/75">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
                          <span className="inline-flex items-center gap-1 text-xs font-black text-amber-300">
                            {isUnlocked ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                <span>
                                  {item.price === 0
                                    ? 'Mặc định miễn phí'
                                    : 'Đã sở hữu'}
                                </span>
                              </>
                            ) : (
                              <>
                                <Cookie className="h-3.5 w-3.5 text-amber-400" />
                                <span>{item.price.toLocaleString()}</span>
                              </>
                            )}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {!isEquipped && (
                              <button
                                type="button"
                                onClick={() => {
                                  playSfx('click');
                                  setPreviewItemId((prev) =>
                                    prev === item.id ? null : item.id,
                                  );
                                }}
                                aria-pressed={isPreviewing}
                                title="Xem thử phối trên nhân vật 3D"
                                className={`inline-flex cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                                  isPreviewing
                                    ? 'border-sky-300 bg-sky-500/30 text-sky-100'
                                    : 'border-white/15 bg-white/8 text-slate-200 hover:bg-white/16'
                                }`}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>{isPreviewing ? 'Tắt thử' : 'Thử'}</span>
                              </button>
                            )}

                            {isUnlocked ? (
                              <button
                                type="button"
                                onClick={() => {
                                  playSfx('click');
                                  setPreviewItemId(null);
                                  equipAccessory(selectedAnimal, item.id);
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
                                    setPreviewItemId(null);
                                    equipAccessory(selectedAnimal, item.id);
                                  }
                                }}
                                className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                                  canAfford
                                    ? 'btn-tactile-amber cursor-pointer'
                                    : 'cursor-not-allowed bg-white/10 text-white/40'
                                }`}
                              >
                                {canAfford ? 'Mua ngay' : 'Chưa đủ'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
