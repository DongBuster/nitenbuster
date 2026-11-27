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
  {
    id: 'multishot',
    name: 'Đạn Đa Tia',
    category: 'weapon',
    maxLevel: 5,
    description: 'Bắn thêm tia đạn mỗi phát theo hình quạt gọn.',
    perLevelSummary: '+1 tia đạn',
    color: '#f472b6',
  },
  {
    id: 'fire_rate',
    name: 'Bắn Siêu Tốc',
    category: 'weapon',
    maxLevel: 5,
    description: 'Tăng mạnh tốc độ xả đạn cho vũ khí chính.',
    perLevelSummary: '+18% tốc bắn',
    color: '#fb7185',
  },
  {
    id: 'damage_up',
    name: 'Sát Thương Lõi',
    category: 'weapon',
    maxLevel: 5,
    description: 'Cường hóa sức mạnh cho mọi đòn tấn công.',
    perLevelSummary: '+22% sát thương',
    color: '#ef4444',
  },
  {
    id: 'pierce_up',
    name: 'Đạn Xuyên Phá',
    category: 'weapon',
    maxLevel: 5,
    description: 'Đạn to hơn, nổ rộng hơn và xuyên qua thêm quái.',
    perLevelSummary: '+1 xuyên & đạn to hơn',
    color: '#38bdf8',
  },
  {
    id: 'ricochet',
    name: 'Đạn Nảy Mục Tiêu',
    category: 'weapon',
    maxLevel: 5,
    description: 'Đạn trúng quái sẽ tự bật nảy sang mục tiêu ở gần.',
    perLevelSummary: '+1 lần bật nảy',
    color: '#facc15',
  },
  {
    id: 'orbital_ice',
    name: 'Quả Cầu Băng Xoay',
    category: 'secondary',
    maxLevel: 5,
    description: 'Triệu hồi các quả cầu băng quay quanh người, hất lùi quái áp sát.',
    perLevelSummary: '+1 quả cầu & sát thương',
    color: '#67e8f9',
  },
  {
    id: 'warm_aura',
    name: 'Vòng Lửa Ấm',
    category: 'secondary',
    maxLevel: 5,
    description: 'Tỏa vòng lửa rực cháy quanh người thiêu đốt mọi quái lại gần.',
    perLevelSummary: 'Vòng lửa rộng & mạnh hơn',
    color: '#fb923c',
  },
  {
    id: 'candy_meteor',
    name: 'Mưa Thiên Thạch Kẹo',
    category: 'secondary',
    maxLevel: 5,
    description: 'Gọi thiên thạch kẹo rơi nổ diện rộng xuống cụm quái gần nhất.',
    perLevelSummary: 'Rơi nhanh & nhiều hơn',
    color: '#c084fc',
  },
  {
    id: 'plush_drone',
    name: 'Thú Bông Drone',
    category: 'secondary',
    maxLevel: 5,
    description: 'Drone mini bay theo người tự tỉa tia sáng vào quái gần nhất.',
    perLevelSummary: 'Drone bắn nhanh & mạnh hơn',
    color: '#34d399',
  },
  {
    id: 'max_hp',
    name: 'Máu Dồi Dào',
    category: 'survival',
    maxLevel: 5,
    description: 'Tăng lượng máu tối đa và hồi phục ngay lập tức.',
    perLevelSummary: '+30 máu tối đa & hồi máu',
    color: '#4ade80',
  },
  {
    id: 'vampirism',
    name: 'Hút Máu Chiến Đấu',
    category: 'survival',
    maxLevel: 5,
    description: 'Hồi lại sinh lực mỗi khi hạ gục liên tiếp 12 quái.',
    perLevelSummary: 'Tăng lượng máu hồi lại',
    color: '#f43f5e',
  },
  {
    id: 'magnet_range',
    name: 'Nam Châm Hút Rộng',
    category: 'survival',
    maxLevel: 5,
    description: 'Mở rộng tầm hút ngọc và tăng lượng kinh nghiệm nhận được.',
    perLevelSummary: '+40% tầm hút & +10% XP',
    color: '#a855f7',
  },
  {
    id: 'agility',
    name: 'Đôi Chân Nhanh Nhẹn',
    category: 'survival',
    maxLevel: 5,
    description: 'Di chuyển linh hoạt hơn và hồi chiêu lướt né nhanh hơn.',
    perLevelSummary: '+12% tốc chạy & lướt nhanh',
    color: '#22d3ee',
  },
  {
    id: 'team_aura',
    name: 'Hào Quang Đồng Đội',
    category: 'survival',
    maxLevel: 5,
    description: 'Tỏa vòng sáng tăng sát thương và hồi máu liên tục cho cả đội ở gần.',
    perLevelSummary: 'Tăng sức mạnh & hồi máu đội',
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
