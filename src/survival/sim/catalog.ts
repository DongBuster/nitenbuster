import type {
  BossKind,
  DerivedPlayerStats,
  EnemyKind,
  GearId,
  GearSpec,
  PlayerEntity,
  SkillCooldownState,
  SkillId,
  SkillMapScope,
  SkillOffer,
  SkillRarity,
  SkillSpec,
  SurvivalMapId,
  WeaponId,
  WeaponSpec,
} from './types.ts';

export const BASE_PLAYER_HP = 120;
export const BASE_MOVE_SPEED = 235;
export const BASE_DASH_COOLDOWN = 2.4;
export const BASE_PICKUP_RADIUS = 110;
export const BASE_CRIT_MULTIPLIER = 1.8;
export const MAX_REROLLS_PER_MATCH = 2;

export const BOSS_NAMES: Record<BossKind, string> = {
  boss_slime_king: 'Vua Slime Tuyết',
  boss_frost_bear: 'Gấu Băng Khổng Lồ',
  boss_snow_dragon: 'Rồng Tuyết Cổ Đại',
  boss_jelly_king: 'Vua Kẹo Dẻo',
  boss_candy_scorpion: 'Bọ Cạp Đá Đường',
  boss_sugar_pharaoh: 'Pharaoh Kẹo Lửa',
  boss_quartz_lord: 'Chúa Tể Thạch Anh',
  boss_crystal_golem: 'Gấu Giáp Pha Lê',
  boss_void_dragon: 'Rồng Pha Lê Hư Không',
};

export const ENEMY_NAMES: Record<EnemyKind, string> = {
  slime: 'Slime Tuyết',
  bat: 'Dơi Băng',
  wolf: 'Sói Tuyết',
  owl_mage: 'Cú Pháp Sư Băng',
  golem: 'Người Đá Băng',
  bomber: 'Bom Tuyết',
  ...BOSS_NAMES,
};

export type RegularEnemyKind = 'slime' | 'bat' | 'wolf' | 'owl_mage' | 'golem' | 'bomber';

export const BIOME_ENEMY_NAMES: Record<
  SurvivalMapId,
  Record<RegularEnemyKind, string>
> = {
  winter_cabin: {
    slime: 'Slime Tuyết',
    bat: 'Dơi Băng',
    wolf: 'Sói Tuyết',
    owl_mage: 'Cú Pháp Sư Băng',
    golem: 'Người Đá Băng',
    bomber: 'Bom Tuyết',
  },
  candy_canyon: {
    slime: 'Slime Caramel',
    bat: 'Ong Đường',
    wolf: 'Bọ Cạp Kẹo',
    owl_mage: 'Pháp Sư Cát Ngọt',
    golem: 'Golem Kẹo Đá',
    bomber: 'Kẹo Nổ Cay',
  },
  crystal_cavern: {
    slime: 'Slime Thạch Anh',
    bat: 'Dơi Pha Lê',
    wolf: 'Sói Tinh Thể',
    owl_mage: 'Pháp Sư Lăng Kính',
    golem: 'Golem Kim Cương',
    bomber: 'Tinh Thể Nổ',
  },
  endless_abyss: {
    slime: 'Slime Hư Không',
    bat: 'Dơi Bóng Đêm',
    wolf: 'Sói Vô Cực',
    owl_mage: 'Pháp Sư Tinh Vân',
    golem: 'Golem Hắc Ám',
    bomber: 'Hạt Nhân Hỗn Mang',
  },
};

export function getEnemyNameForMap(
  kind: EnemyKind,
  mapId: SurvivalMapId,
): string {
  if (kind in BOSS_NAMES) {
    return BOSS_NAMES[kind as BossKind];
  }
  return BIOME_ENEMY_NAMES[mapId][kind as RegularEnemyKind] ?? ENEMY_NAMES[kind];
}

export const SKILL_SCOPE_LABELS: Record<SkillMapScope, string> = {
  core: 'Mặc định',
  winter_cabin: 'Rừng Tuyết',
  candy_canyon: 'Kẹo Đá',
  crystal_cavern: 'Pha Lê',
};

export const WEAPONS: readonly WeaponSpec[] = [
  {
    id: 'candy_smg',
    name: 'Súng Kẹo Liên Thanh',
    shortName: 'SMG Kẹo',
    description: 'Bắn liên thanh tốc độ cao, linh hoạt mọi cự ly.',
    color: '#f472b6',
    damage: 18,
    fireRate: 5.2,
    projectilesPerShot: 1,
    pierce: 1,
    range: 540,
    projectileSpeed: 760,
    spreadDeg: 3,
    knockback: 25,
    aoeRadius: 0,
    slowPct: 0,
    slowDurationSec: 0,
    chainCount: 0,
    chainRange: 0,
    boomerang: false,
    statBars: { damage: 3, speed: 5, crowd: 3 },
  },
  {
    id: 'chestnut_shotgun',
    name: 'Shotgun Hạt Dẻ',
    shortName: 'Shotgun',
    description: 'Bắn chùm 5 viên tầm gần, đẩy lùi đàn quái áp sát.',
    color: '#fb923c',
    damage: 13,
    fireRate: 1.35,
    projectilesPerShot: 5,
    pierce: 1,
    range: 340,
    projectileSpeed: 680,
    spreadDeg: 28,
    knockback: 140,
    aoeRadius: 0,
    slowPct: 0,
    slowDurationSec: 0,
    chainCount: 0,
    chainRange: 0,
    boomerang: false,
    statBars: { damage: 4, speed: 3, crowd: 5 },
  },
  {
    id: 'frost_bow',
    name: 'Cung Băng Xuyên Thấu',
    shortName: 'Cung Băng',
    description: 'Mũi tên tầm xa xuyên 3 mục tiêu và làm chậm quái.',
    color: '#38bdf8',
    damage: 42,
    fireRate: 1.5,
    projectilesPerShot: 1,
    pierce: 3,
    range: 680,
    projectileSpeed: 860,
    spreadDeg: 0,
    knockback: 45,
    aoeRadius: 0,
    slowPct: 0.3,
    slowDurationSec: 1.5,
    chainCount: 0,
    chainRange: 0,
    boomerang: false,
    statBars: { damage: 5, speed: 4, crowd: 3 },
  },
  {
    id: 'lightning_staff',
    name: 'Gậy Sét Chuỗi',
    shortName: 'Gậy Sét',
    description: 'Phóng tia sét truyền chuỗi sang nhiều quái gần nhau.',
    color: '#facc15',
    damage: 26,
    fireRate: 1.65,
    projectilesPerShot: 1,
    pierce: 1,
    range: 460,
    projectileSpeed: 0,
    spreadDeg: 0,
    knockback: 0,
    aoeRadius: 0,
    slowPct: 0,
    slowDurationSec: 0,
    chainCount: 3,
    chainRange: 150,
    boomerang: false,
    statBars: { damage: 4, speed: 4, crowd: 5 },
  },
  {
    id: 'candy_launcher',
    name: 'Pháo Cối Kẹo Nổ',
    shortName: 'Pháo Kẹo',
    description: 'Đạn pháo kẹo nổ diện rộng và hất văng quái.',
    color: '#c084fc',
    damage: 52,
    fireRate: 0.85,
    projectilesPerShot: 1,
    pierce: 1,
    range: 560,
    projectileSpeed: 500,
    spreadDeg: 0,
    knockback: 110,
    aoeRadius: 95,
    slowPct: 0,
    slowDurationSec: 0,
    chainCount: 0,
    chainRange: 0,
    boomerang: false,
    statBars: { damage: 5, speed: 2, crowd: 5 },
  },
  {
    id: 'snow_boomerang',
    name: 'Boomerang Tuyết',
    shortName: 'Boomerang',
    description: 'Bay ra rồi quay về, xuyên qua đàn quái cả hai chiều.',
    color: '#67e8f9',
    damage: 30,
    fireRate: 1.45,
    projectilesPerShot: 1,
    pierce: 99,
    range: 420,
    projectileSpeed: 620,
    spreadDeg: 0,
    knockback: 35,
    aoeRadius: 0,
    slowPct: 0,
    slowDurationSec: 0,
    chainCount: 0,
    chainRange: 0,
    boomerang: true,
    statBars: { damage: 4, speed: 3, crowd: 4 },
  },
] as const;

export const GEARS: readonly GearSpec[] = [
  {
    id: 'ice_skates',
    name: 'Giày Lướt Băng',
    description: 'Chạy nhanh hơn và lướt né hồi chiêu sớm hơn.',
    badge: '+15% Tốc · Lướt nhanh',
    color: '#38bdf8',
    moveSpeedPct: 0.15,
    dashCooldownPct: -0.25,
    maxHpBonus: 0,
    damageReductionPct: 0,
    pickupRadiusPct: 0,
    xpBonusPct: 0,
    critChance: 0,
    fireRatePct: 0,
  },
  {
    id: 'plush_armor',
    name: 'Áo Giáp Gấu Bông',
    description: 'Tăng máu tối đa và giảm sát thương phải chịu.',
    badge: '+35 Máu · -15% Sát thương',
    color: '#f59e0b',
    moveSpeedPct: 0,
    dashCooldownPct: 0,
    maxHpBonus: 35,
    damageReductionPct: 0.15,
    pickupRadiusPct: 0,
    xpBonusPct: 0,
    critChance: 0,
    fireRatePct: 0,
  },
  {
    id: 'crystal_magnet',
    name: 'Nam Châm Pha Lê',
    description: 'Hút ngọc kinh nghiệm từ xa hơn và lên cấp nhanh hơn.',
    badge: '+60% Tầm hút · +12% XP',
    color: '#a855f7',
    moveSpeedPct: 0,
    dashCooldownPct: 0,
    maxHpBonus: 0,
    damageReductionPct: 0,
    pickupRadiusPct: 0.6,
    xpBonusPct: 0.12,
    critChance: 0,
    fireRatePct: 0,
  },
  {
    id: 'golden_scope',
    name: 'Ống Ngắm Vàng',
    description: 'Tăng tỉ lệ đòn chí mạng và tốc độ bắn.',
    badge: '+15% Chí mạng · +12% Bắn',
    color: '#eab308',
    moveSpeedPct: 0,
    dashCooldownPct: 0,
    maxHpBonus: 0,
    damageReductionPct: 0,
    pickupRadiusPct: 0,
    xpBonusPct: 0,
    critChance: 0.15,
    fireRatePct: 0.12,
  },
] as const;

export const SKILLS: readonly SkillSpec[] = [
  // =========================================================================
  // 6 CORE DEFAULT SKILLS (Available on every map — 50% of each campaign pool)
  // =========================================================================
  {
    id: 'damage_up',
    name: 'Sát Thương Lõi',
    category: 'weapon',
    rarity: 'common',
    mapScope: 'core',
    maxLevel: 5,
    description: 'Cường hóa sức mạnh cho mọi đòn tấn công.',
    perLevelSummary: '+22% sát thương',
    color: '#ef4444',
  },
  {
    id: 'fire_rate',
    name: 'Bắn Siêu Tốc',
    category: 'weapon',
    rarity: 'common',
    mapScope: 'core',
    maxLevel: 5,
    description: 'Tăng mạnh tốc độ xả đạn cho vũ khí chính.',
    perLevelSummary: '+18% tốc bắn',
    color: '#fb7185',
  },
  {
    id: 'max_hp',
    name: 'Máu Dồi Dào',
    category: 'survival',
    rarity: 'common',
    mapScope: 'core',
    maxLevel: 5,
    description: 'Tăng lượng máu tối đa và hồi phục ngay lập tức.',
    perLevelSummary: '+30 máu tối đa & hồi máu',
    color: '#4ade80',
  },
  {
    id: 'agility',
    name: 'Đôi Chân Nhanh Nhẹn',
    category: 'survival',
    rarity: 'common',
    mapScope: 'core',
    maxLevel: 5,
    description: 'Di chuyển linh hoạt hơn và hồi chiêu lướt né nhanh hơn.',
    perLevelSummary: '+12% tốc chạy & lướt nhanh',
    color: '#22d3ee',
  },
  {
    id: 'magnet_range',
    name: 'Nam Châm Hút Rộng',
    category: 'survival',
    rarity: 'rare',
    mapScope: 'core',
    maxLevel: 5,
    description: 'Mở rộng tầm hút ngọc và tăng lượng kinh nghiệm nhận được.',
    perLevelSummary: '+40% tầm hút & +10% kinh nghiệm',
    color: '#a855f7',
  },
  {
    id: 'multishot',
    name: 'Đạn Đa Tia',
    category: 'weapon',
    rarity: 'epic',
    mapScope: 'core',
    maxLevel: 5,
    description: 'Bắn thêm tia đạn mỗi phát theo hình quạt gọn.',
    perLevelSummary: '+1 tia đạn mỗi phát',
    color: '#f472b6',
  },
  {
    id: 'whirlwind_blade',
    name: 'Phi Tiêu Xoáy',
    category: 'secondary',
    rarity: 'rare',
    mapScope: 'core',
    maxLevel: 5,
    description: 'Định kỳ phóng phi tiêu gió xoay tròn bay xuyên bầy quái rồi quay về.',
    perLevelSummary: 'Sát thương cao, xoay rộng & phóng nhanh hơn',
    color: '#22d3ee',
  },
  {
    id: 'vital_regen',
    name: 'Hồi Sinh Lực',
    category: 'survival',
    rarity: 'rare',
    mapScope: 'core',
    maxLevel: 5,
    description: 'Tự hồi phục sinh lực đều đặn theo thời gian và tăng hiệu quả mọi nguồn hồi máu.',
    perLevelSummary: 'Hồi máu đều mỗi giây & tăng trị liệu',
    color: '#10b981',
  },

  // =========================================================================
  // 8 MAP 1 EXCLUSIVES: Rừng Tuyết Cabin (50% of Map 1 pool)
  // =========================================================================
  {
    id: 'pierce_up',
    name: 'Đạn Xuyên Phá',
    category: 'weapon',
    rarity: 'common',
    mapScope: 'winter_cabin',
    maxLevel: 5,
    description: 'Đạn to hơn, nổ rộng hơn và xuyên qua thêm quái.',
    perLevelSummary: '+1 xuyên & đạn to hơn',
    color: '#38bdf8',
  },
  {
    id: 'orbital_ice',
    name: 'Quả Cầu Băng Xoay',
    category: 'secondary',
    rarity: 'rare',
    mapScope: 'winter_cabin',
    maxLevel: 5,
    description: 'Triệu hồi các quả cầu băng quay quanh người, hất lùi quái áp sát.',
    perLevelSummary: '+1 quả cầu & sát thương',
    color: '#67e8f9',
  },
  {
    id: 'warm_aura',
    name: 'Vòng Lửa Ấm',
    category: 'secondary',
    rarity: 'rare',
    mapScope: 'winter_cabin',
    maxLevel: 5,
    description: 'Tỏa vòng lửa rực cháy quanh người thiêu đốt mọi quái lại gần.',
    perLevelSummary: 'Vòng lửa rộng & mạnh hơn',
    color: '#fb923c',
  },
  {
    id: 'team_aura',
    name: 'Hào Quang Đồng Đội',
    category: 'survival',
    rarity: 'rare',
    mapScope: 'winter_cabin',
    maxLevel: 5,
    description: 'Tỏa vòng sáng tăng sát thương và hồi máu liên tục cho cả đội ở gần.',
    perLevelSummary: 'Tăng sức mạnh & hồi máu đội',
    color: '#fbbf24',
  },
  {
    id: 'frost_nova',
    name: 'Sóng Băng Giá',
    category: 'secondary',
    rarity: 'rare',
    mapScope: 'winter_cabin',
    maxLevel: 5,
    description: 'Định kỳ bung vòng sóng băng làm chậm mạnh và gây sát thương quái quanh người.',
    perLevelSummary: 'Sóng băng rộng & nổ nhanh hơn',
    color: '#7dd3fc',
  },
  {
    id: 'ice_shatter',
    name: 'Băng Vỡ Chí Mạng',
    category: 'weapon',
    rarity: 'epic',
    mapScope: 'winter_cabin',
    maxLevel: 5,
    description: 'Tăng mạnh tỉ lệ chí mạng và gây sát thương đột phá lên quái đang bị làm chậm.',
    perLevelSummary: '+8% chí mạng & vỡ băng đau hơn',
    color: '#0ea5e9',
  },
  {
    id: 'glacial_spear',
    name: 'Thương Băng Rơi',
    category: 'secondary',
    rarity: 'rare',
    mapScope: 'winter_cabin',
    maxLevel: 5,
    description: 'Phóng chùm thương băng sắc nhọn xuyên hàng quái gần nhất và làm chậm sâu.',
    perLevelSummary: 'Thêm thương băng, xuyên sâu & làm chậm hơn',
    color: '#38bdf8',
  },
  {
    id: 'blizzard_ward',
    name: 'Giáp Băng Giá',
    category: 'survival',
    rarity: 'common',
    mapScope: 'winter_cabin',
    maxLevel: 5,
    description: 'Giảm sát thương nhận vào và phản hơi lạnh làm chậm quái đánh trúng bạn.',
    perLevelSummary: '+5% giảm sát thương & phản làm chậm',
    color: '#bae6fd',
  },

  // =========================================================================
  // 8 MAP 2 EXCLUSIVES: Hoang Mạc Kẹo Đá (50% of Map 2 pool)
  // =========================================================================
  {
    id: 'sugar_rush',
    name: 'Cơn Sốt Đường',
    category: 'survival',
    rarity: 'common',
    mapScope: 'candy_canyon',
    maxLevel: 5,
    description: 'Giữ chuỗi hạ quái càng dài, tốc độ di chuyển và tốc độ bắn càng bùng nổ.',
    perLevelSummary: 'Cộng mạnh tốc chạy & bắn theo chuỗi',
    color: '#f59e0b',
  },
  {
    id: 'ricochet',
    name: 'Đạn Nảy Mục Tiêu',
    category: 'weapon',
    rarity: 'rare',
    mapScope: 'candy_canyon',
    maxLevel: 5,
    description: 'Đạn trúng quái sẽ tự bật nảy sang mục tiêu ở gần.',
    perLevelSummary: '+1 lần bật nảy',
    color: '#facc15',
  },
  {
    id: 'vampirism',
    name: 'Hút Máu Chiến Đấu',
    category: 'survival',
    rarity: 'rare',
    mapScope: 'candy_canyon',
    maxLevel: 5,
    description: 'Hồi lại sinh lực mỗi khi hạ gục liên tiếp 12 quái.',
    perLevelSummary: 'Tăng lượng máu hồi lại',
    color: '#f43f5e',
  },
  {
    id: 'pepper_bomb',
    name: 'Kẹo Nổ Cay',
    category: 'weapon',
    rarity: 'rare',
    mapScope: 'candy_canyon',
    maxLevel: 5,
    description: 'Quái bị hạ sẽ nổ tung thành vụ nổ kẹo cay thiêu đốt bầy xung quanh.',
    perLevelSummary: 'Vụ nổ lan rộng & sát thương cao hơn',
    color: '#fb7185',
  },
  {
    id: 'candy_meteor',
    name: 'Mưa Thiên Thạch Kẹo',
    category: 'secondary',
    rarity: 'epic',
    mapScope: 'candy_canyon',
    maxLevel: 5,
    description: 'Gọi thiên thạch kẹo rơi nổ diện rộng xuống cụm quái gần nhất.',
    perLevelSummary: 'Rơi nhanh & nhiều hơn',
    color: '#c084fc',
  },
  {
    id: 'caramel_nova',
    name: 'Lốc Đường Ngọt',
    category: 'secondary',
    rarity: 'epic',
    mapScope: 'candy_canyon',
    maxLevel: 5,
    description: 'Gọi xoáy bão caramel quét ngang đàn quái, hút gom và nghiền sát thương lớn.',
    perLevelSummary: 'Xoáy mạnh, hút rộng & đánh đau hơn',
    color: '#ea580c',
  },
  {
    id: 'popcorn_barrage',
    name: 'Pháo Bỏng Ngô',
    category: 'secondary',
    rarity: 'rare',
    mapScope: 'candy_canyon',
    maxLevel: 5,
    description: 'Bắn loạt hạt bắp rang nảy bật giữa đàn quái kèm vụ nổ giòn lan nhẹ.',
    perLevelSummary: 'Thêm hạt nảy & nổ lan rộng hơn',
    color: '#fde047',
  },
  {
    id: 'honey_shield',
    name: 'Lớp Mật Dẻo',
    category: 'survival',
    rarity: 'common',
    mapScope: 'candy_canyon',
    maxLevel: 5,
    description: 'Định kỳ tạo lớp màng mật ong chắn trọn một đòn đánh và hồi lại một ít máu.',
    perLevelSummary: 'Hồi khiên nhanh hơn & hồi máu khi vỡ',
    color: '#fbbf24',
  },

  // =========================================================================
  // 8 MAP 3 EXCLUSIVES: Hầm Mỏ Pha Lê (50% of Map 3 pool)
  // =========================================================================
  {
    id: 'overcharge',
    name: 'Nạp Năng Lượng',
    category: 'weapon',
    rarity: 'common',
    mapScope: 'crystal_cavern',
    maxLevel: 5,
    description: 'Khuếch đại lõi pha lê giúp bắn nhanh hơn, đạn lớn hơn và lướt né gọn hơn.',
    perLevelSummary: '+12% tốc bắn, đạn to & hồi lướt',
    color: '#2dd4bf',
  },
  {
    id: 'gem_greed',
    name: 'Khai Khoáng Tinh Thể',
    category: 'survival',
    rarity: 'common',
    mapScope: 'crystal_cavern',
    maxLevel: 5,
    description: 'Tăng mạnh kinh nghiệm nhặt được và hồi sinh lực nhẹ khi nhặt ngọc quý.',
    perLevelSummary: '+16% kinh nghiệm & hồi máu từ ngọc',
    color: '#a3e635',
  },
  {
    id: 'plush_drone',
    name: 'Thú Bông Drone',
    category: 'secondary',
    rarity: 'rare',
    mapScope: 'crystal_cavern',
    maxLevel: 5,
    description: 'Drone mini bay theo người tự tỉa tia sáng vào quái gần nhất.',
    perLevelSummary: 'Drone bắn nhanh & mạnh hơn',
    color: '#34d399',
  },
  {
    id: 'crystal_shield',
    name: 'Giáp Pha Lê',
    category: 'survival',
    rarity: 'rare',
    mapScope: 'crystal_cavern',
    maxLevel: 5,
    description: 'Tạo lớp tinh thể giảm sát thương nhận vào và bung sóng phản đòn khi bị chạm.',
    perLevelSummary: '+7% giảm sát thương & phản đòn mạnh hơn',
    color: '#818cf8',
  },
  {
    id: 'prism_chain',
    name: 'Sét Lăng Kính',
    category: 'secondary',
    rarity: 'rare',
    mapScope: 'crystal_cavern',
    maxLevel: 5,
    description: 'Định kỳ phóng tia sét pha lê giật truyền qua liên tiếp nhiều quái vật.',
    perLevelSummary: 'Nhảy thêm mục tiêu & giật nhanh hơn',
    color: '#e879f9',
  },
  {
    id: 'void_pulse',
    name: 'Xung Pha Lê Hủy Diệt',
    category: 'secondary',
    rarity: 'epic',
    mapScope: 'crystal_cavern',
    maxLevel: 5,
    description: 'Kích hoạt vòng xung năng lượng cực đại đẩy lùi và nghiền nát cả bầy quái.',
    perLevelSummary: 'Sóng cực rộng & sát thương hủy diệt',
    color: '#9333ea',
  },
  {
    id: 'laser_turret',
    name: 'Tháp Tia Pha Lê',
    category: 'secondary',
    rarity: 'rare',
    mapScope: 'crystal_cavern',
    maxLevel: 5,
    description: 'Triệu hồi tinh thể pha lê bay cùng bạn, định kỳ quét chùm tia laser xuyên hàng quái.',
    perLevelSummary: 'Tia laser dài mạnh & bắn nhanh hơn',
    color: '#d946ef',
  },
  {
    id: 'prism_focus',
    name: 'Khúc Xạ Chí Mạng',
    category: 'weapon',
    rarity: 'common',
    mapScope: 'crystal_cavern',
    maxLevel: 5,
    description: 'Điều chỉnh góc khúc xạ pha lê tăng mạnh tỉ lệ và sát thương đòn chí mạng.',
    perLevelSummary: '+5.5% chí mạng & +15% lực chí mạng',
    color: '#f0abfc',
  },
] as const;

const WEAPON_BY_ID: Record<WeaponId, WeaponSpec> = Object.fromEntries(
  WEAPONS.map((w) => [w.id, w]),
) as Record<WeaponId, WeaponSpec>;

const GEAR_BY_ID: Record<GearId, GearSpec> = Object.fromEntries(
  GEARS.map((g) => [g.id, g]),
) as Record<GearId, GearSpec>;

const SKILL_BY_ID: Record<SkillId, SkillSpec> = Object.fromEntries(
  SKILLS.map((s) => [s.id, s]),
) as Record<SkillId, SkillSpec>;

export function getWeaponSpec(id: WeaponId): WeaponSpec {
  return WEAPON_BY_ID[id];
}

export function getGearSpec(id: GearId): GearSpec {
  return GEAR_BY_ID[id];
}

export function getSkillSpec(id: SkillId): SkillSpec {
  return SKILL_BY_ID[id];
}

const SKILL_TIMING_LABELS: Partial<Record<SkillId, string>> = {
  orbital_ice: 'Quay liên tục quanh thân',
  warm_aura: 'Tỏa nhiệt liên tục quanh thân',
  plush_drone: 'Bay theo & bắn tự động',
  whirlwind_blade: 'Tự phóng theo nhịp · Bay đi & về',
  frost_nova: 'Tự nổ sóng băng theo nhịp',
  glacial_spear: 'Tự phóng thương băng theo nhịp',
  candy_meteor: 'Tự gọi thiên thạch theo nhịp',
  caramel_nova: 'Tự cuốn xoáy hút quái theo nhịp',
  popcorn_barrage: 'Tự bắn bắp nảy theo nhịp',
  prism_chain: 'Tự giật sét chuỗi theo nhịp',
  void_pulse: 'Tự nổ sóng trọng lực theo nhịp',
  laser_turret: 'Vệ tinh tự quét laser theo nhịp',
};

/**
 * Returns player-friendly cadence summary for active secondary skills (`null` for passives).
 */
export function getSkillTimingLabel(skillId: SkillId): string | null {
  return SKILL_TIMING_LABELS[skillId] ?? null;
}

/**
 * Returns the skill pool available on a given map:
 * - Campaign maps expose 8 Core Default skills + 8 Map-Exclusive skills (50/50 split = 16 skills).
 * - Endless Abyss (or unspecified map) unlocks all 32 skills.
 */
export function getSkillPoolForMap(
  mapId?: SurvivalMapId,
): readonly SkillSpec[] {
  if (!mapId || mapId === 'endless_abyss') {
    return SKILLS;
  }
  return SKILLS.filter(
    (skill) => skill.mapScope === 'core' || skill.mapScope === mapId,
  );
}

export function xpForNextLevel(level: number): number {
  return Math.round(60 + level * 35 + level * level * 6);
}

const NORMAL_RARITY_WEIGHT: Record<SkillRarity, number> = {
  common: 1.0,
  rare: 0.72,
  epic: 0.45,
};

const RARE_CHEST_WEIGHT: Record<SkillRarity, number> = {
  common: 0.0,
  rare: 1.0,
  epic: 0.8,
};

export function rollSkillOffers(
  currentSkills: Partial<Record<SkillId, number>>,
  rng: () => number,
  guaranteeRare: boolean,
  mapId?: SurvivalMapId,
): SkillOffer[] {
  const mapPool = getSkillPoolForMap(mapId);
  const allEligible = mapPool.filter((skill) => {
    const current = currentSkills[skill.id] ?? 0;
    return current < skill.maxLevel;
  });

  if (allEligible.length === 0) {
    return [];
  }

  // Boss Chest (guaranteeRare): offer only fixed Rare & Epic skills when available,
  // gracefully falling back to remaining Common skills only if all Rare/Epic skills are Lv.5.
  const rareOrEpicEligible = guaranteeRare
    ? allEligible.filter((skill) => skill.rarity !== 'common')
    : [];
  const pool =
    guaranteeRare && rareOrEpicEligible.length > 0
      ? [...rareOrEpicEligible]
      : [...allEligible];

  const weights =
    guaranteeRare && rareOrEpicEligible.length > 0
      ? RARE_CHEST_WEIGHT
      : NORMAL_RARITY_WEIGHT;

  const pickCount = Math.min(3, pool.length);
  const offers: SkillOffer[] = [];

  for (let i = 0; i < pickCount; i++) {
    let totalWeight = 0;
    for (let j = 0; j < pool.length; j++) {
      totalWeight += Math.max(0.05, weights[pool[j].rarity]);
    }
    let roll = rng() * totalWeight;
    let pickedIdx = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      roll -= Math.max(0.05, weights[pool[j].rarity]);
      if (roll <= 0) {
        pickedIdx = j;
        break;
      }
    }

    const [spec] = pool.splice(pickedIdx, 1);
    const currentLevel = currentSkills[spec.id] ?? 0;
    // Fixed skill rarity: a Rare/Epic skill NEVER downgrades to Common on re-appearance
    const rarity: SkillRarity = spec.rarity;
    const levelGain =
      rarity === 'epic' ? Math.min(2, spec.maxLevel - currentLevel) : 1;
    const nextLevel = currentLevel + levelGain;

    offers.push({
      skillId: spec.id,
      rarity,
      currentLevel,
      nextLevel,
      levelGain,
    });
  }

  return offers;
}

const RARITY_EXCESS_SKILLS: readonly SkillId[] = [
  'multishot',
  'pierce_up',
  'ricochet',
  'orbital_ice',
  'warm_aura',
  'candy_meteor',
  'plush_drone',
  'vampirism',
  'team_aura',
  'whirlwind_blade',
  'vital_regen',
  'frost_nova',
  'ice_shatter',
  'glacial_spear',
  'blizzard_ward',
  'sugar_rush',
  'pepper_bomb',
  'caramel_nova',
  'popcorn_barrage',
  'honey_shield',
  'overcharge',
  'crystal_shield',
  'prism_chain',
  'gem_greed',
  'void_pulse',
  'laser_turret',
  'prism_focus',
];

export function computeDerivedStats(
  weaponId: WeaponId,
  gearId: GearId,
  skills: Partial<Record<SkillId, number>>,
  skillPower?: Partial<Record<SkillId, number>>,
): DerivedPlayerStats {
  const weapon = getWeaponSpec(weaponId);
  const gear = getGearSpec(gearId);

  const lv = (id: SkillId): number => {
    const raw = skills[id] ?? 0;
    return Math.max(0, Math.min(5, raw));
  };

  const eff = (id: SkillId): number => {
    const base = lv(id);
    const rawPower = skillPower?.[id];
    if (rawPower === undefined || !Number.isFinite(rawPower)) {
      return base;
    }
    return Math.max(base, Math.min(7.5, rawPower));
  };

  const agilityPower = eff('agility');
  const maxHpPower = eff('max_hp');
  const magnetPower = eff('magnet_range');
  const fireRatePower = eff('fire_rate');
  const damagePower = eff('damage_up');
  const piercePower = eff('pierce_up');
  const overchargePower = eff('overcharge');
  const iceShatterPower = eff('ice_shatter');
  const crystalShieldPower = eff('crystal_shield');
  const gemGreedPower = eff('gem_greed');
  const vitalRegenPower = eff('vital_regen');
  const blizzardWardPower = eff('blizzard_ward');
  const prismFocusPower = eff('prism_focus');

  let rarityDamageBonus = 0;
  for (let i = 0; i < RARITY_EXCESS_SKILLS.length; i++) {
    const id = RARITY_EXCESS_SKILLS[i];
    const excess = Math.max(0, eff(id) - lv(id));
    rarityDamageBonus += excess * 0.24;
  }

  return {
    maxHp: Math.round(BASE_PLAYER_HP + gear.maxHpBonus + maxHpPower * 30),
    moveSpeed: BASE_MOVE_SPEED * (1 + gear.moveSpeedPct + agilityPower * 0.12),
    dashCooldown: Math.max(
      0.55,
      BASE_DASH_COOLDOWN *
        (1 + gear.dashCooldownPct - agilityPower * 0.12 - overchargePower * 0.06),
    ),
    damageReduction: Math.min(
      0.65,
      gear.damageReductionPct + crystalShieldPower * 0.07 + blizzardWardPower * 0.05,
    ),
    pickupRadius:
      BASE_PICKUP_RADIUS * (1 + gear.pickupRadiusPct + magnetPower * 0.4),
    xpMultiplier:
      1 + gear.xpBonusPct + magnetPower * 0.1 + gemGreedPower * 0.16,
    critChance: Math.min(
      0.85,
      gear.critChance + iceShatterPower * 0.08 + prismFocusPower * 0.055,
    ),
    critMultiplier:
      BASE_CRIT_MULTIPLIER + iceShatterPower * 0.18 + prismFocusPower * 0.15,
    fireRate:
      weapon.fireRate *
      (1 + gear.fireRatePct + fireRatePower * 0.18 + overchargePower * 0.12),
    damageMultiplier: 1 + damagePower * 0.22 + rarityDamageBonus,
    bonusProjectiles: lv('multishot'),
    bonusPierce: lv('pierce_up'),
    projectileScale: 1 + piercePower * 0.12 + overchargePower * 0.08,
    ricochetCount: lv('ricochet'),
    hpRegenPerSec: vitalRegenPower * 1.5,
    orbitalLevel: lv('orbital_ice'),
    warmAuraLevel: lv('warm_aura'),
    meteorLevel: lv('candy_meteor'),
    droneLevel: lv('plush_drone'),
    vampirismLevel: lv('vampirism'),
    teamAuraLevel: lv('team_aura'),
    whirlwindBladeLevel: lv('whirlwind_blade'),
    vitalRegenLevel: lv('vital_regen'),
    frostNovaLevel: lv('frost_nova'),
    iceShatterLevel: lv('ice_shatter'),
    glacialSpearLevel: lv('glacial_spear'),
    blizzardWardLevel: lv('blizzard_ward'),
    sugarRushLevel: lv('sugar_rush'),
    pepperBombLevel: lv('pepper_bomb'),
    caramelNovaLevel: lv('caramel_nova'),
    popcornBarrageLevel: lv('popcorn_barrage'),
    honeyShieldLevel: lv('honey_shield'),
    overchargeLevel: lv('overcharge'),
    crystalShieldLevel: lv('crystal_shield'),
    prismChainLevel: lv('prism_chain'),
    gemGreedLevel: lv('gem_greed'),
    voidPulseLevel: lv('void_pulse'),
    laserTurretLevel: lv('laser_turret'),
    prismFocusLevel: lv('prism_focus'),
  };
}

/**
 * Authoritative base recharge duration in seconds for periodic secondary and shield skills
 * (`0` denotes continuous always-on abilities).
 */
export function getSecondarySkillMaxCooldown(skillId: SkillId, level: number): number {
  const lv = Math.max(1, level);
  switch (skillId) {
    case 'whirlwind_blade':
      return Math.max(2.1, 4.4 - lv * 0.42);
    case 'frost_nova':
      return Math.max(2.0, 4.6 - lv * 0.45);
    case 'glacial_spear':
      return Math.max(2.0, 4.2 - lv * 0.4);
    case 'candy_meteor':
      return Math.max(1.2, 3.8 - lv * 0.4);
    case 'caramel_nova':
      return Math.max(2.2, 5.0 - lv * 0.5);
    case 'popcorn_barrage':
      return Math.max(2.2, 4.5 - lv * 0.4);
    case 'prism_chain':
      return Math.max(1.1, 3.0 - lv * 0.35);
    case 'void_pulse':
      return Math.max(2.4, 5.2 - lv * 0.5);
    case 'laser_turret':
      return Math.max(2.0, 4.0 - lv * 0.35);
    case 'crystal_shield':
      return Math.max(2.5, 6.0 - lv * 0.65);
    case 'honey_shield':
      return Math.max(5.5, 11.0 - lv * 1.0);
    case 'blizzard_ward':
      return 3.5;
    default:
      return 0;
  }
}

export type PlayerCooldownSource = Pick<
  PlayerEntity,
  | 'skills'
  | 'whirlwindBladeTimer'
  | 'frostNovaTimer'
  | 'glacialSpearTimer'
  | 'meteorTimer'
  | 'caramelNovaTimer'
  | 'popcornBarrageTimer'
  | 'prismChainTimer'
  | 'voidPulseTimer'
  | 'laserTurretTimer'
  | 'crystalShieldCooldown'
  | 'blizzardWardCooldown'
  | 'honeyShieldCooldown'
  | 'honeyShieldReady'
>;

const TIMED_SKILL_EXTRACTORS: ReadonlyArray<
  readonly [SkillId, (p: PlayerCooldownSource) => number]
> = [
  ['whirlwind_blade', (p) => p.whirlwindBladeTimer],
  ['frost_nova', (p) => p.frostNovaTimer],
  ['glacial_spear', (p) => p.glacialSpearTimer],
  ['candy_meteor', (p) => p.meteorTimer],
  ['caramel_nova', (p) => p.caramelNovaTimer],
  ['popcorn_barrage', (p) => p.popcornBarrageTimer],
  ['prism_chain', (p) => p.prismChainTimer],
  ['void_pulse', (p) => p.voidPulseTimer],
  ['laser_turret', (p) => p.laserTurretTimer],
  ['crystal_shield', (p) => p.crystalShieldCooldown],
  ['blizzard_ward', (p) => p.blizzardWardCooldown],
  ['honey_shield', (p) => (p.honeyShieldReady ? 0 : p.honeyShieldCooldown)],
];

const ALWAYS_ON_SECONDARY_IDS: readonly SkillId[] = [
  'orbital_ice',
  'warm_aura',
  'plush_drone',
];

function roundCooldown(sec: number): number {
  return Math.max(0, Math.round(sec * 100) / 100);
}

/**
 * Extracts per-skill cooldown telemetry for active secondary skills and reactive shield perks.
 */
export function buildPlayerSecondaryCooldowns(
  player: PlayerCooldownSource,
): Partial<Record<SkillId, SkillCooldownState>> {
  const out: Partial<Record<SkillId, SkillCooldownState>> = {};
  for (let i = 0; i < ALWAYS_ON_SECONDARY_IDS.length; i++) {
    const id = ALWAYS_ON_SECONDARY_IDS[i];
    if ((player.skills[id] ?? 0) > 0) {
      out[id] = { remaining: 0, max: 0 };
    }
  }
  for (let i = 0; i < TIMED_SKILL_EXTRACTORS.length; i++) {
    const [id, readRem] = TIMED_SKILL_EXTRACTORS[i];
    const lv = player.skills[id] ?? 0;
    if (lv <= 0) continue;
    const max = roundCooldown(getSecondarySkillMaxCooldown(id, lv));
    const remaining = Math.min(max, roundCooldown(readRem(player)));
    out[id] = { remaining, max };
  }
  return out;
}
