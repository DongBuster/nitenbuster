export type CoopMapId =
  | 'glass_carry'
  | 'raft_rapids'
  | 'rope_tether'
  | 'minecart_rails';

export type CoopActionId = CoopMapId;

export type CoopLevelNumber = 1 | 2 | 3 | 4 | 5;

export const COOP_LEVEL_NUMBERS: readonly CoopLevelNumber[] = [
  1, 2, 3, 4, 5,
] as const;

export type CoopDifficultyId =
  | 'easy'
  | 'medium'
  | 'hard'
  | 'very_hard'
  | 'extreme';

export const DEFAULT_COOP_MAP_ID: CoopMapId = 'glass_carry';

export const COOP_MAP_IDS: readonly CoopMapId[] = [
  'glass_carry',
  'raft_rapids',
  'rope_tether',
  'minecart_rails',
] as const;

export const COOP_COOKIE_REWARDS = {
  3: 50,
  2: 30,
  1: 15,
} as const;

export interface CoopControlHint {
  readonly keys: string;
  readonly label: string;
}

export interface CoopStarThresholds {
  readonly three: { readonly maxElapsedSec: number; readonly maxFailures: number };
  readonly two: { readonly maxElapsedSec: number; readonly maxFailures: number };
}

export interface CoopLevelMeta {
  readonly level: CoopLevelNumber;
  readonly key: string;
  readonly title: string;
  readonly difficulty: CoopDifficultyId;
  readonly difficultyLabel: string;
  readonly difficultyColorHex: string;
  readonly finishZ: number;
  readonly stageCount: number;
  readonly comingSoon?: boolean;
  readonly starThresholds: CoopStarThresholds;
}

export interface CoopMapPackMeta {
  readonly id: string;
  readonly actionId: CoopMapId;
  readonly order: number;
  readonly title: string;
  readonly shortTitle: string;
  readonly tagline: string;
  readonly accentHex: string;
  readonly levels: readonly CoopLevelMeta[];
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
  readonly starThresholds: CoopStarThresholds;
  readonly controls: readonly CoopControlHint[];
  readonly maps: readonly CoopMapPackMeta[];
}

export interface CoopResultSummary {
  mapId: CoopMapId;
  stars: 1 | 2 | 3;
  cookies: number;
  elapsedSec: number;
  failures: number;
}

export interface CoopLevelResultSummary extends CoopResultSummary {
  mapPackId: string;
  level: CoopLevelNumber;
  stageKey: string;
}

export interface CoopMapRecord {
  bestStars: number;
  bestTimeSec: number;
}

const DIFFICULTY_META: Readonly<
  Record<CoopDifficultyId, { readonly label: string; readonly colorHex: string }>
> = {
  easy: { label: 'Dễ', colorHex: '#4ade80' },
  medium: { label: 'Trung Bình', colorHex: '#38bdf8' },
  hard: { label: 'Khá Khó', colorHex: '#fbbf24' },
  very_hard: { label: 'Khó', colorHex: '#fb923c' },
  extreme: { label: 'Siêu Khó', colorHex: '#fb7185' },
};

const LEVEL_DIFFICULTY_BY_NUMBER: Readonly<
  Record<CoopLevelNumber, CoopDifficultyId>
> = {
  1: 'easy',
  2: 'medium',
  3: 'hard',
  4: 'very_hard',
  5: 'extreme',
};

/** Builds a pack key string `"actionId:mapPackId"`. */
export function makeCoopPackKey(
  actionId: CoopMapId,
  mapPackId: string,
): string {
  return `${actionId}:${mapPackId}`;
}

/** Builds a stage key string `"actionId:mapPackId:level"`. */
export function makeCoopStageKey(
  actionId: CoopMapId,
  mapPackId: string,
  level: CoopLevelNumber,
): string {
  return `${actionId}:${mapPackId}:${level}`;
}

function createCoopLevel(
  actionId: CoopMapId,
  mapPackId: string,
  level: CoopLevelNumber,
  title: string,
  finishZ: number,
  stageCount: number,
  threeSec: number,
  threeFail: number,
  twoSec: number,
  twoFail: number,
  comingSoon?: boolean,
): CoopLevelMeta {
  const difficulty = LEVEL_DIFFICULTY_BY_NUMBER[level];
  const diffMeta = DIFFICULTY_META[difficulty];
  return {
    level,
    key: makeCoopStageKey(actionId, mapPackId, level),
    title,
    difficulty,
    difficultyLabel: diffMeta.label,
    difficultyColorHex: diffMeta.colorHex,
    finishZ,
    stageCount,
    ...(comingSoon ? { comingSoon: true } : {}),
    starThresholds: {
      three: { maxElapsedSec: threeSec, maxFailures: threeFail },
      two: { maxElapsedSec: twoSec, maxFailures: twoFail },
    },
  };
}

function createSinglePlayablePackLevels(
  actionId: CoopMapId,
  mapPackId: string,
  l1Title: string,
  finishZ: number,
  stageCount: number,
  threeSec: number,
  threeFail: number,
  twoSec: number,
  twoFail: number,
): readonly CoopLevelMeta[] {
  return [
    createCoopLevel(
      actionId,
      mapPackId,
      1,
      l1Title,
      finishZ,
      stageCount,
      threeSec,
      threeFail,
      twoSec,
      twoFail,
    ),
    createCoopLevel(
      actionId,
      mapPackId,
      2,
      `Chặng 2 · Sắp Ra Mắt`,
      finishZ,
      stageCount,
      threeSec,
      threeFail,
      twoSec,
      twoFail,
      true,
    ),
    createCoopLevel(
      actionId,
      mapPackId,
      3,
      `Chặng 3 · Sắp Ra Mắt`,
      finishZ,
      stageCount,
      threeSec,
      threeFail,
      twoSec,
      twoFail,
      true,
    ),
    createCoopLevel(
      actionId,
      mapPackId,
      4,
      `Chặng 4 · Sắp Ra Mắt`,
      finishZ,
      stageCount,
      threeSec,
      threeFail,
      twoSec,
      twoFail,
      true,
    ),
    createCoopLevel(
      actionId,
      mapPackId,
      5,
      `Chặng 5 · Sắp Ra Mắt`,
      finishZ,
      stageCount,
      threeSec,
      threeFail,
      twoSec,
      twoFail,
      true,
    ),
  ] as const;
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
    maps: [
      {
        id: 'cabin_bridge',
        actionId: 'glass_carry',
        order: 1,
        title: 'Cầu Gỗ Cabin Tuyết',
        shortTitle: 'Cầu Gỗ Cabin',
        tagline:
          'Cây cầu gỗ băng tuyết cổ điển với xà gỗ, búa lắc và bệ gió đông.',
        accentHex: '#22d3ee',
        levels: [
          createCoopLevel('glass_carry', 'cabin_bridge', 1, 'Khởi Động Cổng Gỗ', 65, 2, 75, 1, 125, 4),
          createCoopLevel('glass_carry', 'cabin_bridge', 2, 'Sàn Băng & Gió Đông', 90, 3, 105, 2, 170, 5),
          createCoopLevel('glass_carry', 'cabin_bridge', 3, 'Xưởng Búa & Bệ Bay', 110, 3, 135, 2, 215, 6),
          createCoopLevel('glass_carry', 'cabin_bridge', 4, 'Cầu Hẹp & Rào Di Động', 130, 4, 165, 2, 265, 6),
          createCoopLevel('glass_carry', 'cabin_bridge', 5, 'Đỉnh Bão Tuyết Cabin', 145, 5, 195, 2, 310, 6),
        ],
      },
      {
        id: 'sky_scaffold',
        actionId: 'glass_carry',
        order: 2,
        title: 'Công Trường Cao Ốc',
        shortTitle: 'Công Trường',
        tagline:
          'Giàn giáo thép trên cao với cần cẩu xoay, thang nâng và dầm thép chênh vênh.',
        accentHex: '#f59e0b',
        levels: [
          createCoopLevel('glass_carry', 'sky_scaffold', 1, 'Giàn Giáo Tầng 1', 70, 2, 80, 1, 130, 4),
          createCoopLevel('glass_carry', 'sky_scaffold', 2, 'Cần Cẩu Hoàng Hôn', 95, 3, 110, 2, 180, 5),
          createCoopLevel('glass_carry', 'sky_scaffold', 3, 'Tháp Thang Nâng', 115, 3, 140, 2, 225, 6),
          createCoopLevel('glass_carry', 'sky_scaffold', 4, 'Dầm Thép Chênh Vênh', 135, 4, 170, 2, 275, 6),
          createCoopLevel('glass_carry', 'sky_scaffold', 5, 'Nóc Nhà Chọc Trời', 150, 5, 205, 2, 325, 6),
        ],
      },
      {
        id: 'candy_factory',
        actionId: 'glass_carry',
        order: 3,
        title: 'Xưởng Kẹo Băng Chuyền',
        shortTitle: 'Xưởng Kẹo',
        tagline:
          'Băng chuyền kẹo dẻo, cổng bạc hà trượt chéo và dập piston kẹo cứng.',
        accentHex: '#f472b6',
        levels: [
          createCoopLevel('glass_carry', 'candy_factory', 1, 'Dây Chuyền Kẹo Dẻo', 70, 2, 80, 1, 130, 4),
          createCoopLevel('glass_carry', 'candy_factory', 2, 'Cổng Chéo Kẹo Bạc Hà', 95, 3, 110, 2, 180, 5),
          createCoopLevel('glass_carry', 'candy_factory', 3, 'Dập Piston Kẹo Cứng', 115, 3, 140, 2, 225, 6),
          createCoopLevel('glass_carry', 'candy_factory', 4, 'Mê Cung Đóng Gói', 135, 4, 170, 2, 275, 6),
          createCoopLevel('glass_carry', 'candy_factory', 5, 'Đại Tiệc Xưởng Kẹo', 150, 5, 205, 2, 325, 6),
        ],
      },
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
    maps: [
      {
        id: 'glacier_river',
        actionId: 'raft_rapids',
        order: 1,
        title: 'Sông Băng Thác Ghềnh',
        shortTitle: 'Sông Băng',
        tagline: 'Dòng sông băng cuồn cuộn với đá ngầm, xoáy nước và khúc gỗ trôi.',
        accentHex: '#38bdf8',
        levels: createSinglePlayablePackLevels(
          'raft_rapids',
          'glacier_river',
          'Ghềnh Băng Thác Xiết',
          160,
          5,
          140,
          2,
          240,
          6,
        ),
      },
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
    maps: [
      {
        id: 'lantern_peaks',
        actionId: 'rope_tether',
        order: 1,
        title: 'Đỉnh Tháp Đèn Lồng',
        shortTitle: 'Tháp Đèn Lồng',
        tagline: 'Chuỗi đảo lơ lửng thắp đèn lồng vàng trên mây gió lộng.',
        accentHex: '#fbbf24',
        levels: createSinglePlayablePackLevels(
          'rope_tether',
          'lantern_peaks',
          'Chuỗi Đảo Đèn Lồng',
          135,
          5,
          180,
          2,
          300,
          6,
        ),
      },
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
    maps: [
      {
        id: 'frost_mine',
        actionId: 'minecart_rails',
        order: 1,
        title: 'Hầm Mỏ Băng Giá',
        shortTitle: 'Hầm Mỏ Băng',
        tagline: 'Đường ray pha lê băng xuyên hầm mỏ với cầu gãy và xà gỗ thấp.',
        accentHex: '#fb7185',
        levels: createSinglePlayablePackLevels(
          'minecart_rails',
          'frost_mine',
          'Đường Ray Pha Lê Băng',
          180,
          5,
          145,
          2,
          240,
          6,
        ),
      },
    ],
  },
] as const;

export const ALL_PLAYABLE_STAGE_KEYS: readonly string[] = COOP_MAPS.flatMap(
  (action) =>
    action.maps.flatMap((pack) =>
      pack.levels.filter((lvl) => !lvl.comingSoon).map((lvl) => lvl.key),
    ),
);

const PLAYABLE_STAGE_KEY_SET: ReadonlySet<string> = new Set(
  ALL_PLAYABLE_STAGE_KEYS,
);

export const TOTAL_PLAYABLE_COOP_LEVELS = ALL_PLAYABLE_STAGE_KEYS.length;

export const MAX_COOP_STARS = TOTAL_PLAYABLE_COOP_LEVELS * 3;

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

/** Type guard checking whether an unknown value is a valid Co-op level number (1..5). */
export function isCoopLevelNumber(val: unknown): val is CoopLevelNumber {
  return (
    typeof val === 'number' &&
    Number.isInteger(val) &&
    val >= 1 &&
    val <= 5
  );
}

/** Returns whether a stage key belongs to a playable (non-comingSoon) Co-op level. */
export function isPlayableCoopStageKey(key: string): boolean {
  return PLAYABLE_STAGE_KEY_SET.has(key);
}

/** Returns the metadata entry for a Co-op map identifier. */
export function getCoopMapMeta(id: CoopMapId): CoopMapMeta {
  return COOP_MAP_BY_ID[id] ?? COOP_MAPS[0];
}

/** Returns the default map pack identifier for a Co-op action. */
export function getDefaultMapPackId(actionId: CoopMapId): string {
  return getCoopMapMeta(actionId).maps[0].id;
}

/** Returns the map pack metadata for an action, falling back to its first pack. */
export function getCoopMapPack(
  actionId: CoopMapId,
  mapPackId?: string,
): CoopMapPackMeta {
  const actionMeta = getCoopMapMeta(actionId);
  if (mapPackId) {
    const found = actionMeta.maps.find((p) => p.id === mapPackId);
    if (found) return found;
  }
  return actionMeta.maps[0];
}

/** Returns the level metadata inside a Co-op map pack, falling back to Level 1. */
export function getCoopLevelMeta(
  actionId: CoopMapId,
  mapPackId?: string,
  level?: CoopLevelNumber,
): CoopLevelMeta {
  const pack = getCoopMapPack(actionId, mapPackId);
  if (level !== undefined) {
    const found = pack.levels.find((l) => l.level === level);
    if (found) return found;
  }
  return pack.levels[0];
}

/** Returns the highest non-comingSoon level number available in a map pack. */
export function getMaxPlayableLevelForPack(
  actionId: CoopMapId,
  mapPackId?: string,
): CoopLevelNumber {
  const pack = getCoopMapPack(actionId, mapPackId);
  let maxLevel: CoopLevelNumber = 1;
  for (const lvl of pack.levels) {
    if (!lvl.comingSoon && lvl.level > maxLevel) {
      maxLevel = lvl.level;
    }
  }
  return maxLevel;
}

/** Returns the highest unlocked level (1..5) for a pack based on sequential clears. */
export function getUnlockedLevelForPack(
  levelRecords: Readonly<Record<string, CoopMapRecord>> | undefined,
  actionId: CoopMapId,
  mapPackId?: string,
): CoopLevelNumber {
  const pack = getCoopMapPack(actionId, mapPackId);
  let unlocked: CoopLevelNumber = 1;
  for (let i = 0; i < pack.levels.length - 1; i++) {
    const current = pack.levels[i];
    const next = pack.levels[i + 1];
    if (current.comingSoon || next.comingSoon) break;
    const rec = levelRecords?.[current.key];
    if (
      rec &&
      typeof rec.bestStars === 'number' &&
      Number.isFinite(rec.bestStars) &&
      rec.bestStars >= 1
    ) {
      unlocked = next.level;
    } else {
      break;
    }
  }
  return unlocked;
}

/** Builds a lookup map of `"actionId:mapPackId"` -> highest unlocked level (1..5). */
export function buildUnlockedByPackMap(
  levelRecords: Readonly<Record<string, CoopMapRecord>> | undefined,
): Record<string, CoopLevelNumber> {
  const out: Record<string, CoopLevelNumber> = {};
  for (const action of COOP_MAPS) {
    for (const pack of action.maps) {
      out[makeCoopPackKey(action.id, pack.id)] = getUnlockedLevelForPack(
        levelRecords,
        action.id,
        pack.id,
      );
    }
  }
  return out;
}

/** Returns whether a specific Co-op level is playable and unlocked. */
export function isCoopLevelUnlocked(
  levelRecords: Readonly<Record<string, CoopMapRecord>> | undefined,
  actionId: CoopMapId,
  mapPackId: string,
  level: CoopLevelNumber,
  unlockedByPackOverride?: Readonly<Record<string, number>>,
): boolean {
  const pack = getCoopMapPack(actionId, mapPackId);
  const levelMeta = getCoopLevelMeta(actionId, pack.id, level);
  if (levelMeta.comingSoon) return false;
  if (level === 1) return true;
  const packKey = makeCoopPackKey(actionId, pack.id);
  const override = unlockedByPackOverride?.[packKey];
  const unlockedLevel =
    typeof override === 'number' && Number.isFinite(override)
      ? override
      : getUnlockedLevelForPack(levelRecords, actionId, pack.id);
  return level <= unlockedLevel;
}

/** Cycles to the next Co-op map identifier in canonical order. */
export function getNextCoopMapId(id: CoopMapId): CoopMapId {
  const index = COOP_MAP_IDS.indexOf(id);
  if (index === -1) return DEFAULT_COOP_MAP_ID;
  return COOP_MAP_IDS[(index + 1) % COOP_MAP_IDS.length];
}

/** Cycles to the next playable stage: next level in pack -> next pack in action -> next action's first pack L1. */
export function getNextPlayableCoopStage(
  actionId: CoopMapId,
  mapPackId: string,
  level: CoopLevelNumber,
): { actionId: CoopMapId; mapPackId: string; level: CoopLevelNumber } {
  const actionMeta = getCoopMapMeta(actionId);
  const pack = getCoopMapPack(actionId, mapPackId);

  const nextInPack = pack.levels.find(
    (l) => l.level > level && !l.comingSoon,
  );
  if (nextInPack) {
    return {
      actionId: actionMeta.id,
      mapPackId: pack.id,
      level: nextInPack.level,
    };
  }

  const packIndex = actionMeta.maps.findIndex((p) => p.id === pack.id);
  for (let i = packIndex + 1; i < actionMeta.maps.length; i++) {
    const candidatePack = actionMeta.maps[i];
    const firstPlayable = candidatePack.levels.find((l) => !l.comingSoon);
    if (firstPlayable) {
      return {
        actionId: actionMeta.id,
        mapPackId: candidatePack.id,
        level: firstPlayable.level,
      };
    }
  }

  const nextActionId = getNextCoopMapId(actionMeta.id);
  const nextActionMeta = getCoopMapMeta(nextActionId);
  const nextFirstPack = nextActionMeta.maps[0];
  const nextFirstLevel =
    nextFirstPack.levels.find((l) => !l.comingSoon)?.level ?? 1;

  return {
    actionId: nextActionMeta.id,
    mapPackId: nextFirstPack.id,
    level: nextFirstLevel,
  };
}

function computeStarsFromThresholds(
  starThresholds: CoopStarThresholds,
  elapsedSec: number,
  failures: number,
): 1 | 2 | 3 {
  if (
    elapsedSec <= starThresholds.three.maxElapsedSec &&
    failures <= starThresholds.three.maxFailures
  ) {
    return 3;
  }
  if (
    elapsedSec <= starThresholds.two.maxElapsedSec &&
    failures <= starThresholds.two.maxFailures
  ) {
    return 2;
  }
  return 1;
}

/** Computes star rating and cookie reward for a completed Co-op map run. */
export function calculateCoopResult(
  mapId: CoopMapId,
  elapsedSec: number,
  failures: number,
): CoopResultSummary {
  const { starThresholds } = getCoopMapMeta(mapId);
  const stars = computeStarsFromThresholds(starThresholds, elapsedSec, failures);

  return {
    mapId,
    stars,
    cookies: COOP_COOKIE_REWARDS[stars],
    elapsedSec,
    failures,
  };
}

/** Computes star rating and cookie reward for a specific Co-op pack level run. */
export function calculateCoopLevelResult(
  actionId: CoopMapId,
  mapPackId: string,
  level: CoopLevelNumber,
  elapsedSec: number,
  failures: number,
): CoopLevelResultSummary {
  const pack = getCoopMapPack(actionId, mapPackId);
  const levelMeta = getCoopLevelMeta(actionId, pack.id, level);
  const stars = computeStarsFromThresholds(
    levelMeta.starThresholds,
    elapsedSec,
    failures,
  );

  return {
    mapId: actionId,
    mapPackId: pack.id,
    level: levelMeta.level,
    stageKey: levelMeta.key,
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

function getSafeRecordStars(rec: CoopMapRecord | undefined): number {
  if (
    rec &&
    typeof rec.bestStars === 'number' &&
    Number.isFinite(rec.bestStars) &&
    rec.bestStars > 0
  ) {
    return Math.min(3, Math.floor(rec.bestStars));
  }
  return 0;
}

/** Sums best stars earned across legacy action-level Co-op map records. */
export function countTotalCoopStars(
  records: Partial<Record<CoopMapId, CoopMapRecord>> | undefined,
): number {
  if (!records) return 0;
  let total = 0;
  for (const id of COOP_MAP_IDS) {
    total += getSafeRecordStars(records[id]);
  }
  return total;
}

/** Counts earned and maximum stars across playable levels of a single map pack. */
export function countCoopPackStars(
  levelRecords: Readonly<Record<string, CoopMapRecord>> | undefined,
  actionId: CoopMapId,
  mapPackId: string,
): { earned: number; max: number } {
  const pack = getCoopMapPack(actionId, mapPackId);
  let earned = 0;
  let max = 0;
  for (const lvl of pack.levels) {
    if (lvl.comingSoon) continue;
    max += 3;
    earned += getSafeRecordStars(levelRecords?.[lvl.key]);
  }
  return { earned, max };
}

/** Counts earned and maximum stars across all map packs of a Co-op action. */
export function countCoopActionStars(
  levelRecords: Readonly<Record<string, CoopMapRecord>> | undefined,
  actionId: CoopMapId,
): { earned: number; max: number } {
  const actionMeta = getCoopMapMeta(actionId);
  let earned = 0;
  let max = 0;
  for (const pack of actionMeta.maps) {
    const packStars = countCoopPackStars(levelRecords, actionId, pack.id);
    earned += packStars.earned;
    max += packStars.max;
  }
  return { earned, max };
}

/** Sums best stars earned across all playable Co-op level records (0..54). */
export function countTotalCoopLevelStars(
  levelRecords: Readonly<Record<string, CoopMapRecord>> | undefined,
): number {
  if (!levelRecords) return 0;
  let total = 0;
  for (const key of ALL_PLAYABLE_STAGE_KEYS) {
    total += getSafeRecordStars(levelRecords[key]);
  }
  return total;
}
