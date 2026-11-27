import type {
  BossKind,
  DerivedPlayerStats,
  EnemyKind,
  GearId,
  GearSpec,
  SkillId,
  SkillOffer,
  SkillRarity,
  SkillSpec,
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
  boss_slime_king: 'Vua Slime Khổng Lồ',
  boss_frost_bear: 'Gấu Băng Bạo Chúa',
  boss_snow_dragon: 'Rồng Tuyết Cổ Đại',
};

export const ENEMY_NAMES: Record<EnemyKind, string> = {
  slime: 'Slime Tuyết',
  bat: 'Dơi Băng',
  wolf: 'Sói Hoang',
  owl_mage: 'Pháp Sư Cú',
  golem: 'Người Đá Băng',
  bomber: 'Kẻ Đánh Bom Kẹo',
  boss_slime_king: 'Vua Slime Khổng Lồ',
  boss_frost_bear: 'Gấu Băng Bạo Chúa',
  boss_snow_dragon: 'Rồng Tuyết Cổ Đại',
};

export const WEAPONS: readonly WeaponSpec[] = [
  {
    id: 'candy_smg',
    name: 'Súng Kẹo Liên Thanh',
    shortName: 'SMG Kẹo',
    description: 'Tốc độ bắn cực nhanh với độ lệch nhẹ ±3°, ổn định mọi cự ly.',
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
    description: 'Bắn quạt 5 viên tầm gần 28° kèm lực đẩy lùi cực mạnh.',
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
    description: 'Mũi tên xuyên 3 mục tiêu ở tầm xa và làm chậm quái 30% trong 1.5s.',
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
    description: 'Phóng tia sét tức thì nhảy chuỗi tối đa 3 quái trong bán kính 150 px.',
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
    description: 'Đạn pháo hạng nặng nổ AOE bán kính 95 px và hất văng quái.',
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
    description: 'Bay ra rồi quay ngược về người bắn, xuyên vô hạn cả lượt đi lẫn lượt về.',
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
    description: 'Tăng +15% tốc chạy và giảm -25% thời gian hồi Dash.',
    badge: '+15% Tốc · -25% Dash',
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
    description: 'Tăng +35 Máu tối đa và giảm 15% sát thương nhận vào.',
    badge: '+35 HP · -15% Sát thương',
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
    description: 'Tăng +60% tầm hút ngọc XP và +12% XP nhận được.',
    badge: '+60% Hút · +12% XP',
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
    description: 'Tăng +15% tỉ lệ Chí mạng (×1.8) và +12% tốc độ bắn.',
    badge: '+15% Crit · +12% Bắn',
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
  {
    id: 'multishot',
    name: 'Đạn Đa Tia',
    category: 'weapon',
    maxLevel: 5,
    description: 'Bắn thêm +1 tia đạn mỗi cấp theo hình quạt gọn.',
    perLevelSummary: '+1 tia đạn / cấp',
    color: '#f472b6',
  },
  {
    id: 'fire_rate',
    name: 'Bắn Siêu Tốc',
    category: 'weapon',
    maxLevel: 5,
    description: 'Tăng +18% tốc độ khai hỏa cho vũ khí chính.',
    perLevelSummary: '+18% tốc bắn / cấp',
    color: '#fb7185',
  },
  {
    id: 'damage_up',
    name: 'Sát Thương Lõi',
    category: 'weapon',
    maxLevel: 5,
    description: 'Tăng +22% sát thương từ mọi nguồn tấn công.',
    perLevelSummary: '+22% sát thương / cấp',
    color: '#ef4444',
  },
  {
    id: 'pierce_up',
    name: 'Đạn Xuyên Phá',
    category: 'weapon',
    maxLevel: 5,
    description: 'Tăng +1 lần xuyên mục tiêu và +12% kích thước đạn/vùng nổ.',
    perLevelSummary: '+1 xuyên & +12% cỡ đạn / cấp',
    color: '#38bdf8',
  },
  {
    id: 'ricochet',
    name: 'Đạn Nảy Mục Tiêu',
    category: 'weapon',
    maxLevel: 5,
    description: 'Đạn tự bật nảy sang quái lân cận trong phạm vi 180 px.',
    perLevelSummary: '+1 lần nảy / cấp',
    color: '#facc15',
  },
  {
    id: 'orbital_ice',
    name: 'Quả Cầu Băng Xoay',
    category: 'secondary',
    maxLevel: 5,
    description: 'Tạo 2 + cấp quả cầu băng xoay bán kính 82 px gây sát thương & đẩy lùi nhẹ.',
    perLevelSummary: '+1 quả cầu băng & sát thương / cấp',
    color: '#67e8f9',
  },
  {
    id: 'warm_aura',
    name: 'Vòng Lửa Ấm',
    category: 'secondary',
    maxLevel: 5,
    description: 'Hào quang bán kính 95 + cấp×16 px đốt sát thương mỗi 0.4 giây.',
    perLevelSummary: '+16 px tầm & sát thương đốt / cấp',
    color: '#fb923c',
  },
  {
    id: 'candy_meteor',
    name: 'Mưa Thiên Thạch Kẹo',
    category: 'secondary',
    maxLevel: 5,
    description: 'Định kỳ thả thiên thạch nổ AOE 105 px xuống cụm quái gần nhất.',
    perLevelSummary: 'Giảm 0.4s hồi & tăng số thiên thạch',
    color: '#c084fc',
  },
  {
    id: 'plush_drone',
    name: 'Thú Bông Drone',
    category: 'secondary',
    maxLevel: 5,
    description: 'Drone bay quanh người chơi tự bắn tia laser vào quái gần nhất.',
    perLevelSummary: 'Tăng tốc bắn & sát thương Drone',
    color: '#34d399',
  },
  {
    id: 'max_hp',
    name: 'Máu Dồi Dào',
    category: 'survival',
    maxLevel: 5,
    description: 'Tăng +30 Máu tối đa và hồi ngay 30 HP khi chọn.',
    perLevelSummary: '+30 Max HP & hồi 30 HP / cấp',
    color: '#4ade80',
  },
  {
    id: 'vampirism',
    name: 'Hút Máu Chiến Đấu',
    category: 'survival',
    maxLevel: 5,
    description: 'Hồi 4 + cấp×2 HP mỗi khi hạ gục đủ 12 quái.',
    perLevelSummary: '+2 HP hồi mỗi 12 mạng / cấp',
    color: '#f43f5e',
  },
  {
    id: 'magnet_range',
    name: 'Nam Châm Hút Rộng',
    category: 'survival',
    maxLevel: 5,
    description: 'Tăng +40% tầm hút ngọc XP và +10% lượng XP nhận.',
    perLevelSummary: '+40% tầm hút & +10% XP / cấp',
    color: '#a855f7',
  },
  {
    id: 'agility',
    name: 'Đôi Chân Nhanh Nhẹn',
    category: 'survival',
    maxLevel: 5,
    description: 'Tăng +12% tốc độ di chuyển và giảm -12% hồi chiêu Dash.',
    perLevelSummary: '+12% tốc chạy & -12% Dash / cấp',
    color: '#22d3ee',
  },
  {
    id: 'team_aura',
    name: 'Hào Quang Đồng Đội',
    category: 'survival',
    maxLevel: 5,
    description: 'Tỏa vòng bán kính 220 px tăng +10% sát thương và hồi 2 HP/s cho đội.',
    perLevelSummary: 'Tăng cường buff & hồi phục đồng đội',
    color: '#fbbf24',
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

export function xpForNextLevel(level: number): number {
  return Math.round(60 + level * 35 + level * level * 6);
}

export function rollSkillOffers(
  currentSkills: Partial<Record<SkillId, number>>,
  rng: () => number,
  guaranteeRare: boolean,
): SkillOffer[] {
  const eligible = SKILLS.filter((skill) => {
    const current = currentSkills[skill.id] ?? 0;
    return current < skill.maxLevel;
  });

  if (eligible.length === 0) {
    return [];
  }

  const pool = [...eligible];
  const pickCount = Math.min(3, pool.length);
  const offers: SkillOffer[] = [];

  for (let i = 0; i < pickCount; i++) {
    const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    const [spec] = pool.splice(idx, 1);
    const currentLevel = currentSkills[spec.id] ?? 0;

    let rarity: SkillRarity;
    const roll = rng();
    if (guaranteeRare) {
      rarity = roll < 0.65 ? 'rare' : 'epic';
    } else if (roll < 0.6) {
      rarity = 'common';
    } else if (roll < 0.9) {
      rarity = 'rare';
    } else {
      rarity = 'epic';
    }

    const levelGain = rarity === 'epic' ? Math.min(2, spec.maxLevel - currentLevel) : 1;
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
      0.6,
      BASE_DASH_COOLDOWN * (1 + gear.dashCooldownPct - agilityPower * 0.12),
    ),
    damageReduction: Math.min(0.6, gear.damageReductionPct),
    pickupRadius:
      BASE_PICKUP_RADIUS * (1 + gear.pickupRadiusPct + magnetPower * 0.4),
    xpMultiplier: 1 + gear.xpBonusPct + magnetPower * 0.1,
    critChance: Math.min(0.85, gear.critChance),
    critMultiplier: BASE_CRIT_MULTIPLIER,
    fireRate: weapon.fireRate * (1 + gear.fireRatePct + fireRatePower * 0.18),
    damageMultiplier: 1 + damagePower * 0.22 + rarityDamageBonus,
    bonusProjectiles: lv('multishot'),
    bonusPierce: lv('pierce_up'),
    projectileScale: 1 + piercePower * 0.12,
    ricochetCount: lv('ricochet'),
    orbitalLevel: lv('orbital_ice'),
    warmAuraLevel: lv('warm_aura'),
    meteorLevel: lv('candy_meteor'),
    droneLevel: lv('plush_drone'),
    vampirismLevel: lv('vampirism'),
    teamAuraLevel: lv('team_aura'),
  };
}
