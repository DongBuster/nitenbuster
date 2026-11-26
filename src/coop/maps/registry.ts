export type CoopMapId =
  | 'glass_carry'
  | 'raft_rapids'
  | 'rope_tether'
  | 'minecart_rails';

export const DEFAULT_COOP_MAP_ID: CoopMapId = 'glass_carry';

export const COOP_MAP_IDS: readonly CoopMapId[] = [
  'glass_carry',
  'raft_rapids',
  'rope_tether',
  'minecart_rails',
] as const;

export const MAX_COOP_STARS = 12;

export const COOP_COOKIE_REWARDS = {
  3: 50,
  2: 30,
  1: 15,
} as const;

export interface CoopControlHint {
  readonly keys: string;
  readonly label: string;
}

export interface CoopMapMeta {
  readonly id: CoopMapId;
  readonly order: number;
  readonly title: string;
  readonly shortTitle: string;
  readonly tagline: string;
  readonly mechanicBadge: string;
  readonly failureLabel: string;
  readonly finishZ: number;
  readonly accentHex: string;
  readonly starThresholds: {
    readonly three: { readonly maxElapsedSec: number; readonly maxFailures: number };
    readonly two: { readonly maxElapsedSec: number; readonly maxFailures: number };
  };
  readonly controls: readonly CoopControlHint[];
}

export interface CoopResultSummary {
  mapId: CoopMapId;
  stars: 1 | 2 | 3;
  cookies: number;
  elapsedSec: number;
  failures: number;
}

export interface CoopMapRecord {
  bestStars: number;
  bestTimeSec: number;
}

export const COOP_MAPS: readonly CoopMapMeta[] = [
  {
    id: 'glass_carry',
    order: 1,
    title: 'Bê Kính Pha Lê',
    shortTitle: 'Bê Kính',
    tagline:
      'Cùng đồng đội giữ thăng bằng và khiêng tấm kính pha lê qua chướng ngại về đích.',
    mechanicBadge: 'Khiêng Kính · Nâng & Hạ',
    failureLabel: 'Vỡ kính',
    finishZ: 140,
    accentHex: '#22d3ee',
    starThresholds: {
      three: { maxElapsedSec: 180, maxFailures: 2 },
      two: { maxElapsedSec: 300, maxFailures: 6 },
    },
    controls: [
      { keys: 'WASD / Mũi tên', label: 'Di chuyển' },
      { keys: 'Space', label: 'Nhảy qua bệ' },
      { keys: 'E / Chuột trái', label: 'Nâng kính lên cao' },
      { keys: 'Q / Chuột phải', label: 'Hạ kính thấp xuống' },
      { keys: '1–4', label: 'Biểu cảm nhanh' },
    ],
  },
  {
    id: 'raft_rapids',
    order: 2,
    title: 'Chèo Phao Vượt Thác',
    shortTitle: 'Chèo Phao',
    tagline:
      'Phối hợp nhịp mái chèo hai bên mạn phao vượt ghềnh thác xoáy và đá ngầm.',
    mechanicBadge: '1 Phao · 2 Mái Chèo',
    failureLabel: 'Lật phao',
    finishZ: 160,
    accentHex: '#38bdf8',
    starThresholds: {
      three: { maxElapsedSec: 140, maxFailures: 2 },
      two: { maxElapsedSec: 240, maxFailures: 6 },
    },
    controls: [
      { keys: 'A / D (← / →)', label: 'Nghiêng người lách phao' },
      { keys: 'E / W / Chuột trái', label: 'Quẫy chèo tới (đồng nhịp = Boost)' },
      { keys: 'Q / S / Chuột phải', label: 'Chèo ngược / Phanh chỉnh mũi' },
      { keys: 'Space', label: 'Cùng nhún nhảy qua khúc gỗ' },
      { keys: '1–4', label: 'Biểu cảm nhanh' },
    ],
  },
  {
    id: 'rope_tether',
    order: 3,
    title: 'Dây Thừng Buộc Chung',
    shortTitle: 'Dây Thừng',
    tagline:
      'Gắn kết bằng dây thừng — luân phiên cắm neo chân, nhảy qua vực và kéo đồng đội lên đảo.',
    mechanicBadge: 'Chained · Neo & Kéo Dây',
    failureLabel: 'Đứt / Rơi',
    finishZ: 135,
    accentHex: '#fbbf24',
    starThresholds: {
      three: { maxElapsedSec: 180, maxFailures: 2 },
      two: { maxElapsedSec: 300, maxFailures: 6 },
    },
    controls: [
      { keys: 'WASD / Mũi tên', label: 'Di chuyển' },
      { keys: 'Space', label: 'Nhảy qua vực' },
      { keys: 'Q / Chuột phải', label: 'Cắm Neo chân giữ đồng đội' },
      { keys: 'E / Chuột trái', label: 'Kéo dây ròng rọc cứu đồng đội' },
      { keys: '1–4', label: 'Biểu cảm nhanh' },
    ],
  },
  {
    id: 'minecart_rails',
    order: 4,
    title: 'Xe Goòng Đường Ray',
    shortTitle: 'Xe Goòng',
    tagline:
      'Thay phiên bơm tay tăng tốc, cùng nghiêng đổi 3 làn ray, cúi né xà gỗ và nhảy qua cầu gãy.',
    mechanicBadge: '3 Làn Ray · Bơm & Cúi',
    failureLabel: 'Trật bánh',
    finishZ: 180,
    accentHex: '#fb7185',
    starThresholds: {
      three: { maxElapsedSec: 145, maxFailures: 2 },
      two: { maxElapsedSec: 240, maxFailures: 6 },
    },
    controls: [
      { keys: 'A / D (← / →)', label: 'Cùng nghiêng đổi 3 làn ray' },
      { keys: 'E / Chuột trái', label: 'Bơm tay tăng tốc theo lượt' },
      { keys: 'Q / Chuột phải', label: 'Cùng cúi đầu né xà gỗ' },
      { keys: 'Space', label: 'Cùng nhảy qua cầu ray gãy' },
      { keys: '1–4', label: 'Biểu cảm nhanh' },
    ],
  },
] as const;

const COOP_MAP_BY_ID: Readonly<Record<CoopMapId, CoopMapMeta>> = {
  glass_carry: COOP_MAPS[0],
  raft_rapids: COOP_MAPS[1],
  rope_tether: COOP_MAPS[2],
  minecart_rails: COOP_MAPS[3],
};

/** Type guard checking whether an unknown value is a valid Co-op map identifier. */
export function isCoopMapId(val: unknown): val is CoopMapId {
  return (
    typeof val === 'string' &&
    (COOP_MAP_IDS as readonly string[]).includes(val)
  );
}

/** Returns the metadata entry for a Co-op map identifier. */
export function getCoopMapMeta(id: CoopMapId): CoopMapMeta {
  return COOP_MAP_BY_ID[id] ?? COOP_MAPS[0];
}

/** Cycles to the next Co-op map identifier in canonical order. */
export function getNextCoopMapId(id: CoopMapId): CoopMapId {
  const index = COOP_MAP_IDS.indexOf(id);
  if (index === -1) return DEFAULT_COOP_MAP_ID;
  return COOP_MAP_IDS[(index + 1) % COOP_MAP_IDS.length];
}

/** Computes star rating and cookie reward for a completed Co-op map run. */
export function calculateCoopResult(
  mapId: CoopMapId,
  elapsedSec: number,
  failures: number,
): CoopResultSummary {
  const { starThresholds } = getCoopMapMeta(mapId);
  let stars: 1 | 2 | 3 = 1;
  if (
    elapsedSec <= starThresholds.three.maxElapsedSec &&
    failures <= starThresholds.three.maxFailures
  ) {
    stars = 3;
  } else if (
    elapsedSec <= starThresholds.two.maxElapsedSec &&
    failures <= starThresholds.two.maxFailures
  ) {
    stars = 2;
  }

  return {
    mapId,
    stars,
    cookies: COOP_COOKIE_REWARDS[stars],
    elapsedSec,
    failures,
  };
}

/** Returns whether the new run beats the recorded best stars or fastest time at equal stars. */
export function isNewCoopBest(
  prev: CoopMapRecord | undefined,
  nextElapsedSec: number,
  nextStars: number,
): boolean {
  if (!prev || prev.bestStars <= 0 || !Number.isFinite(prev.bestTimeSec)) {
    return true;
  }
  if (nextStars !== prev.bestStars) {
    return nextStars > prev.bestStars;
  }
  return nextElapsedSec < prev.bestTimeSec;
}

/** Sums best stars earned across all valid Co-op map records (0..12). */
export function countTotalCoopStars(
  records: Partial<Record<CoopMapId, CoopMapRecord>> | undefined,
): number {
  if (!records) return 0;
  let total = 0;
  for (const id of COOP_MAP_IDS) {
    const rec = records[id];
    if (
      rec &&
      typeof rec.bestStars === 'number' &&
      Number.isFinite(rec.bestStars) &&
      rec.bestStars > 0
    ) {
      total += Math.min(3, Math.floor(rec.bestStars));
    }
  }
  return total;
}
