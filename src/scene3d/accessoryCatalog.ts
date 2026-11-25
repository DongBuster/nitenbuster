export type EquipCategory = 'outfit' | 'neck' | 'eyes' | 'hat' | 'back';

export type AccessorySelection = string | readonly string[] | null | undefined;

export interface ShopItem {
  id: string;
  category: EquipCategory;
  name: string;
  icon: string;
  description: string;
  price: number;
  isDefaultUnlocked?: boolean;
}

export const EQUIP_CATEGORIES: ReadonlyArray<{
  id: EquipCategory;
  label: string;
}> = [
  { id: 'outfit', label: 'Áo' },
  { id: 'neck', label: 'Cổ' },
  { id: 'eyes', label: 'Mắt' },
  { id: 'hat', label: 'Đầu' },
  { id: 'back', label: 'Lưng' },
];

export const SHOP_ITEMS: ShopItem[] = [
  // Outfit (Áo)
  {
    id: 'mu_jersey',
    category: 'outfit',
    name: 'Áo Đấu MU',
    icon: '⚽',
    description:
      'Áo đấu đỏ Manchester United cổ chữ V huyền thoại — tặng sẵn miễn phí cho mọi người chơi!',
    price: 0,
    isDefaultUnlocked: true,
  },
  {
    id: 'cozy_hoodie',
    category: 'outfit',
    name: 'Áo Hoodie Ấm Áp',
    icon: '🧥',
    description: 'Hoodie nỉ mùa đông kèm túi trước bụng và mũ trùm sau gáy.',
    price: 90,
  },

  // Neck (Cổ)
  {
    id: 'scarf',
    category: 'neck',
    name: 'Khăn Len Mùa Đông',
    icon: '🧣',
    description: 'Khăn len ấm áp phong cách Winter Cabin cực dễ thương.',
    price: 60,
  },
  {
    id: 'bowtie',
    category: 'neck',
    name: 'Nơ Bướm Quý Ông',
    icon: '🎀',
    description: 'Chiếc nơ nhung lịch lãm cho phong thái đánh bài đỉnh cao.',
    price: 70,
  },
  {
    id: 'gold_chain',
    category: 'neck',
    name: 'Dây Chuyền Vàng',
    icon: '🪙',
    description: 'Vòng xích vàng lấp lánh kèm mặt huy chương ngôi sao cá tính.',
    price: 110,
  },

  // Eyes (Mắt)
  {
    id: 'glasses',
    category: 'eyes',
    name: 'Kính Râm Siêu Ngầu',
    icon: '🕶️',
    description: 'Phong thái cao thủ đánh bài không để lộ cảm xúc.',
    price: 80,
  },
  {
    id: 'round_glasses',
    category: 'eyes',
    name: 'Kính Tròn Tri Thức',
    icon: '👓',
    description: 'Gọng đồng tròn thanh lịch, nhìn xuyên thấu mọi lá bài đối thủ.',
    price: 75,
  },
  {
    id: 'pixel_shades',
    category: 'eyes',
    name: 'Kính Pixel 8-Bit',
    icon: '👾',
    description: 'Kính râm khối pixel chuẩn phong cách "Deal With It" siêu ngầu.',
    price: 100,
  },

  // Hat (Đầu)
  {
    id: 'party_hat',
    category: 'hat',
    name: 'Mũ Tiệc Lễ Hội',
    icon: '🥳',
    description: 'Mũ chóp sặc sỡ mang lại may mắn khi rút bài.',
    price: 90,
  },
  {
    id: 'beanie',
    category: 'hat',
    name: 'Mũ Len Quả Bông',
    icon: '🧶',
    description: 'Mũ len đan xanh thông vành kem giữ ấm cực đỉnh.',
    price: 85,
  },
  {
    id: 'headphones',
    category: 'hat',
    name: 'Tai Nghe Gaming',
    icon: '🎧',
    description: 'Tai nghe chụp tai đệm êm có vòng LED neon nổi bật.',
    price: 120,
  },
  {
    id: 'crown',
    category: 'hat',
    name: 'Vương Miện Quán Quân',
    icon: '👑',
    description: 'Vương miện vàng lấp lánh dành cho nhà vô địch PAWS.',
    price: 150,
  },

  // Back (Lưng)
  {
    id: 'backpack',
    category: 'back',
    name: 'Ba Lô Thám Hiểm',
    icon: '🎒',
    description: 'Ba lô da kèm cuộn túi ngủ gọn gàng cho hành trình Winter Cabin.',
    price: 100,
  },
  {
    id: 'angel_wings',
    category: 'back',
    name: 'Đôi Cánh Thiên Thần',
    icon: '🪽',
    description: 'Cặp cánh lông vũ trắng ngà viền ánh vàng tung bay theo từng bước.',
    price: 130,
  },
  {
    id: 'royal_cape',
    category: 'back',
    name: 'Áo Choàng Hoàng Gia',
    icon: '🦸',
    description: 'Áo choàng nhung đỏ cổ lông trắng đính khuy vàng uy quyền.',
    price: 140,
  },
];

export const DEFAULT_UNLOCKED_ACCESSORIES: readonly string[] = SHOP_ITEMS.filter(
  (item) => item.isDefaultUnlocked,
).map((item) => item.id);

const ITEM_BY_ID = new Map<string, ShopItem>(
  SHOP_ITEMS.map((item) => [item.id, item]),
);

const CATEGORY_ORDER: readonly EquipCategory[] = [
  'outfit',
  'neck',
  'eyes',
  'hat',
  'back',
];

export function getAccessoryMeta(id: string): ShopItem | null {
  return ITEM_BY_ID.get(id) ?? null;
}

/**
 * Normalizes single-string legacy values or mixed arrays into a deterministic
 * list containing at most one valid item per equipment category.
 */
export function normalizeAccessories(input: AccessorySelection): string[] {
  if (!input) return [];
  const rawList = typeof input === 'string' ? [input] : input;
  if (!Array.isArray(rawList)) return [];

  const byCategory = new Map<EquipCategory, string>();
  for (const id of rawList) {
    if (typeof id !== 'string') continue;
    const meta = ITEM_BY_ID.get(id);
    if (!meta) continue;
    byCategory.set(meta.category, meta.id);
  }

  const ordered: string[] = [];
  for (const cat of CATEGORY_ORDER) {
    const itemId = byCategory.get(cat);
    if (itemId) ordered.push(itemId);
  }
  return ordered;
}

/**
 * Toggles an item on/off within its equipment category while preserving all other slots.
 */
export function toggleSlotAccessory(
  current: AccessorySelection,
  itemId: string | null,
): string[] {
  if (itemId === null) return [];
  const target = ITEM_BY_ID.get(itemId);
  const existing = normalizeAccessories(current);
  if (!target) return existing;

  const alreadyEquipped = existing.includes(target.id);
  const withoutSameCategory = existing.filter((id) => {
    const meta = ITEM_BY_ID.get(id);
    return meta && meta.category !== target.category;
  });

  if (alreadyEquipped) {
    return withoutSameCategory;
  }

  return normalizeAccessories([...withoutSameCategory, target.id]);
}

export function formatEquippedSummary(equipped: AccessorySelection): {
  primaryName: string;
  extraCount: number;
  fullNames: string[];
} | null {
  const normalized = normalizeAccessories(equipped);
  if (normalized.length === 0) return null;

  const fullNames = normalized
    .map((id) => ITEM_BY_ID.get(id)?.name)
    .filter((name): name is string => Boolean(name));

  if (fullNames.length === 0) return null;
  return {
    primaryName: fullNames[0],
    extraCount: Math.max(0, fullNames.length - 1),
    fullNames,
  };
}
