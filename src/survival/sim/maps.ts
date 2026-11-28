import type {
  MapObstacle,
  MapZone,
  SurvivalMapId,
  SurvivalMapMeta,
} from './types.ts';

export const WORLD_SIZE = 3600;

export const SURVIVAL_MAPS: readonly SurvivalMapMeta[] = [
  {
    id: 'winter_cabin',
    order: 1,
    name: 'Rừng Tuyết Cabin',
    subtitle: 'Chiến dịch 3 Boss · Dễ',
    description:
      'Rừng thông phủ tuyết quanh căn cabin ấm áp với nhiều mảng băng trượt tăng tốc.',
    mechanicSummary: 'Sàn băng trượt giúp chạy nhanh hơn',
    scenario: {
      headline: 'Giữ vững khu rừng tuyết qua 3 đợt bầy trước khi hạ Rồng Tuyết Cổ Đại.',
      chapters: [
        {
          id: 'wave1',
          order: 1,
          title: 'Chương 1: Khởi Đầu Rừng Tuyết',
          timeRangeLabel: '0:00 – 1:30',
          bossAtSec: 90,
          bossKind: 'boss_slime_king',
          summary: 'Tiêu diệt Slime Tuyết & Dơi Tuyết để tích cấp nhanh quanh các mảng băng.',
          enemyHint: 'Quái nhẹ mở màn · Mở khóa thêm bầy lúc 0:45',
          bossRewardLabel: 'Hạ Vua Slime Băng để mở Rương Hiếm',
        },
        {
          id: 'wave2',
          order: 2,
          title: 'Chương 2: Đàn Sói & Pháp Sư Băng',
          timeRangeLabel: '1:30 – 3:30',
          bossAtSec: 210,
          bossKind: 'boss_frost_bear',
          summary: 'Sói Băng lao vồ và Cú Tuyết bắn đạn từ xa; tận dụng sàn băng để né vòng vây.',
          enemyHint: 'Sói vồ nhanh & Pháp sư tầm xa áp sát',
          bossRewardLabel: 'Hạ Gấu Băng Khổng Lồ nhận Rương Hiếm',
        },
        {
          id: 'wave3',
          order: 3,
          title: 'Chương 3: Bão Tuyết Tổng Lực',
          timeRangeLabel: '3:30 – 5:30+',
          bossAtSec: 330,
          bossKind: 'boss_snow_dragon',
          summary: 'Golem Băng bọc giáp và Băng Nổ tràn lên chuẩn bị cho trận quyết đấu Boss Cuối.',
          enemyHint: 'Quái cảm tử nổ & Golem máu trâu',
          bossRewardLabel: 'Hạ Rồng Tuyết Cổ Đại để Chiến thắng',
        },
      ],
    },
    isEndless: false,
    targetDurationSec: 360,
    difficultyStars: 1,
    difficultyLabel: 'Dễ',
    difficulty: {
      hpMult: 1.0,
      damageMult: 1.0,
      spawnRateMult: 1.0,
      bossHpMult: 1.0,
    },
    cookieMultiplier: 1.0,
    bossRotation: ['boss_slime_king', 'boss_frost_bear', 'boss_snow_dragon'],
    finalBossKind: 'boss_snow_dragon',
    theme: {
      bg: '#0f1d2e',
      grid: '#1a2f47',
      accent: '#38bdf8',
      obstaclePrimary: '#1e3a5f',
      obstacleSecondary: '#93c5fd',
      zoneColor: '#7dd3fc',
    },
  },
  {
    id: 'candy_canyon',
    order: 2,
    name: 'Hoang Mạc Kẹo Đá',
    subtitle: 'Chiến dịch 3 Boss · Trung bình',
    description:
      'Hẻm núi kẹo đường rộng mở, nơi bão cát ngọt định kỳ thổi qua kèm hòm tiếp tế.',
    mechanicSummary: 'Bão cát ngọt thổi qua & nhân đôi hòm tiếp tế',
    scenario: {
      headline: 'Sống sót giữa sa mạc đường nóng bỏng và lật đổ Pharaoh Kẹo Lửa.',
      chapters: [
        {
          id: 'wave1',
          order: 1,
          title: 'Chương 1: Hẻm Núi Ngọt Ngào',
          timeRangeLabel: '0:00 – 1:30',
          bossAtSec: 90,
          bossKind: 'boss_jelly_king',
          summary: 'Quái Caramel mở đường và trận Bão Cát Ngọt đầu tiên thổi kèm hòm đồ.',
          enemyHint: 'Slime Caramel & Ong Đường linh hoạt',
          bossRewardLabel: 'Hạ Vua Kẹo Dẻo nhận Rương Hiếm',
        },
        {
          id: 'wave2',
          order: 2,
          title: 'Chương 2: Cơn Bão Sa Mạc Kẹo',
          timeRangeLabel: '1:30 – 3:30',
          bossAtSec: 210,
          bossKind: 'boss_candy_scorpion',
          summary: 'Bọ Cạp Kẹo lao chớp nhoáng và Pháp Sư Cát Ngọt khống chế tầm xa.',
          enemyHint: 'Tốc độ bầy tăng & hòm tiếp tế xuất hiện dày hơn',
          bossRewardLabel: 'Hạ Bọ Cạp Đá Đường mở Rương Hiếm',
        },
        {
          id: 'wave3',
          order: 3,
          title: 'Chương 3: Lửa Đường Phán Quyết',
          timeRangeLabel: '3:30 – 5:30+',
          bossAtSec: 330,
          bossKind: 'boss_sugar_pharaoh',
          summary: 'Kẹo Nổ Cay & Golem Kẹo Đá dồn ép trước khi Pharaoh Kẹo Lửa giáng thế.',
          enemyHint: 'Cẩn thận Kẹo Nổ Cay tự kích nổ sát thương cao',
          bossRewardLabel: 'Hạ Pharaoh Kẹo Lửa để Chiến thắng',
        },
      ],
    },
    isEndless: false,
    targetDurationSec: 360,
    difficultyStars: 2,
    difficultyLabel: 'Trung bình',
    difficulty: {
      hpMult: 1.3,
      damageMult: 1.2,
      spawnRateMult: 1.15,
      bossHpMult: 1.3,
    },
    cookieMultiplier: 1.25,
    bossRotation: [
      'boss_jelly_king',
      'boss_candy_scorpion',
      'boss_sugar_pharaoh',
    ],
    finalBossKind: 'boss_sugar_pharaoh',
    theme: {
      bg: '#26171d',
      grid: '#3a232b',
      accent: '#fb923c',
      obstaclePrimary: '#7c3f2c',
      obstacleSecondary: '#fdba74',
      zoneColor: '#f59e0b',
    },
  },
  {
    id: 'crystal_cavern',
    order: 3,
    name: 'Hầm Mỏ Pha Lê',
    subtitle: 'Chiến dịch 3 Boss · Khó',
    description:
      'Hang động pha lê phát sáng với các trụ năng lượng kích hoạt hào quang bắn siêu nhanh.',
    mechanicSummary: 'Chạm Trụ Pha Lê để kích hoạt tăng tốc bắn',
    scenario: {
      headline: 'Chinh phục hầm mỏ năng lượng cao và tiêu diệt Rồng Pha Lê Hư Không.',
      chapters: [
        {
          id: 'wave1',
          order: 1,
          title: 'Chương 1: Tầng Mỏ Thạch Anh',
          timeRangeLabel: '0:00 – 1:30',
          bossAtSec: 90,
          bossKind: 'boss_quartz_lord',
          summary: 'Tận dụng Trụ Pha Lê trên bản đồ để xóa nhanh đàn Slime & Dơi Pha Lê.',
          enemyHint: 'Quái mạnh hơn hẳn các map trước ngay từ phút đầu',
          bossRewardLabel: 'Hạ Chúa Tể Thạch Anh mở Rương Hiếm',
        },
        {
          id: 'wave2',
          order: 2,
          title: 'Chương 2: Mạng Lưới Lăng Kính',
          timeRangeLabel: '1:30 – 3:30',
          bossAtSec: 210,
          bossKind: 'boss_crystal_golem',
          summary: 'Sói Tinh Thể & Pháp Sư Lăng Kính khóa góc di chuyển quanh các trụ đá.',
          enemyHint: 'Di chuyển giữa các Trụ Pha Lê để duy trì tốc bắn',
          bossRewardLabel: 'Hạ Gấu Giáp Pha Lê nhận Rương Hiếm',
        },
        {
          id: 'wave3',
          order: 3,
          title: 'Chương 3: Lỗ Hổng Hư Không',
          timeRangeLabel: '3:30 – 5:30+',
          bossAtSec: 330,
          bossKind: 'boss_void_dragon',
          summary: 'Tinh Thể Nổ và Golem Kim Cương ồ ạt trước trận chiến Rồng Pha Lê Hư Không.',
          enemyHint: 'Mật độ đạn Boss dày · Giữ Lướt né đòn hiểm',
          bossRewardLabel: 'Hạ Rồng Pha Lê Hư Không để Chiến thắng',
        },
      ],
    },
    isEndless: false,
    targetDurationSec: 360,
    difficultyStars: 3,
    difficultyLabel: 'Khó',
    difficulty: {
      hpMult: 1.65,
      damageMult: 1.38,
      spawnRateMult: 1.3,
      bossHpMult: 1.65,
    },
    cookieMultiplier: 1.55,
    bossRotation: [
      'boss_quartz_lord',
      'boss_crystal_golem',
      'boss_void_dragon',
    ],
    finalBossKind: 'boss_void_dragon',
    theme: {
      bg: '#16132b',
      grid: '#262147',
      accent: '#c084fc',
      obstaclePrimary: '#4c1d95',
      obstacleSecondary: '#d8b4fe',
      zoneColor: '#a855f7',
    },
  },
  {
    id: 'endless_abyss',
    order: 4,
    name: 'Đấu Trường Vô Cực',
    subtitle: 'Vô tận · Cực khó · Đủ 32 kỹ năng',
    description:
      'Đấu trường không giới hạn với đủ 9 Boss xoay vòng liên tục và độ khó leo thang.',
    mechanicSummary: 'Đủ 32 kỹ năng · 9 Boss xoay vòng · Bệ ấn nhân điểm',
    scenario: {
      headline: 'Đấu trường sinh tử không hồi kết — tích điểm kỷ lục với toàn bộ 32 kỹ năng.',
      endlessSummary:
        'Cứ mỗi 90 giây xuất hiện 1 Boss xoay vòng trong 9 Boss; sau 6:00 tốc độ & sức mạnh quái leo thang không giới hạn.',
      chapters: [
        {
          id: 'wave1',
          order: 1,
          title: 'Vòng 1: Khởi Động Đấu Trường',
          timeRangeLabel: '0:00 – 1:30',
          bossAtSec: 90,
          bossKind: 'boss_slime_king',
          summary: 'Chọn lọc bộ trang bị từ cả 32 kỹ năng ngay trong những cấp đầu tiên.',
          enemyHint: 'Đứng trên Bệ Ấn vàng để cộng thêm điểm khi hạ quái',
          bossRewardLabel: 'Hạ Boss Vòng 1 nhận Rương Hiếm',
        },
        {
          id: 'wave2',
          order: 2,
          title: 'Vòng 2+: Chuỗi Boss Xoay Vòng',
          timeRangeLabel: '1:30 – 6:00',
          bossAtSec: 210,
          bossKind: 'boss_frost_bear',
          summary: 'Mỗi 90 giây sẽ triệu hồi Boss kế tiếp từ cả 3 vùng đất với độ khó tăng dần.',
          enemyHint: 'Đủ 6 chủng loại quái Hư Không áp sát liên tục',
          bossRewardLabel: 'Mỗi Boss hạ được thưởng Ngọc Vàng & Rương Hiếm',
        },
        {
          id: 'wave3',
          order: 3,
          title: 'Vô Tận: Hố Đen Tăng Tốc',
          timeRangeLabel: '6:00+',
          bossAtSec: 330,
          bossKind: 'boss_void_dragon',
          summary: 'Mọi chỉ số quái vật & nhịp xuất hiện leo thang mãi mãi để thử thách giới hạn.',
          enemyHint: 'Sống sót càng lâu, hệ số điểm & Cookies càng cao',
          bossRewardLabel: 'Thiết lập kỷ lục sinh tồn mới',
        },
      ],
    },
    isEndless: true,
    targetDurationSec: 0,
    difficultyStars: 4,
    difficultyLabel: 'Cực khó',
    difficulty: {
      hpMult: 1.35,
      damageMult: 1.22,
      spawnRateMult: 1.2,
      bossHpMult: 1.35,
    },
    cookieMultiplier: 1.4,
    bossRotation: [
      'boss_slime_king',
      'boss_jelly_king',
      'boss_quartz_lord',
      'boss_frost_bear',
      'boss_candy_scorpion',
      'boss_crystal_golem',
      'boss_snow_dragon',
      'boss_sugar_pharaoh',
      'boss_void_dragon',
    ],
    finalBossKind: 'boss_void_dragon',
    theme: {
      bg: '#0b101b',
      grid: '#182238',
      accent: '#f43f5e',
      obstaclePrimary: '#334155',
      obstacleSecondary: '#94a3b8',
      zoneColor: '#fbbf24',
    },
  },
] as const;

const MAP_BY_ID: Record<SurvivalMapId, SurvivalMapMeta> = Object.fromEntries(
  SURVIVAL_MAPS.map((m) => [m.id, m]),
) as Record<SurvivalMapId, SurvivalMapMeta>;

const MAP_SEED_OFFSETS: Record<SurvivalMapId, number> = {
  winter_cabin: 101,
  candy_canyon: 202,
  crystal_cavern: 303,
  endless_abyss: 404,
};

export function isSurvivalMapId(val: unknown): val is SurvivalMapId {
  return (
    val === 'winter_cabin' ||
    val === 'candy_canyon' ||
    val === 'crystal_cavern' ||
    val === 'endless_abyss'
  );
}

export function getSurvivalMapMeta(id: SurvivalMapId): SurvivalMapMeta {
  return MAP_BY_ID[id];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ObstacleTemplate {
  kinds: readonly MapObstacle['kind'][];
  targetCount: number;
  minRadius: number;
  maxRadius: number;
  zoneKind: MapZone['kind'];
  zoneCount: number;
  zoneRadius: number;
  zoneCooldownSec: number;
}

const MAP_LAYOUT_TEMPLATES: Record<SurvivalMapId, ObstacleTemplate> = {
  winter_cabin: {
    kinds: ['tree', 'rock', 'cabin'],
    targetCount: 34,
    minRadius: 34,
    maxRadius: 56,
    zoneKind: 'ice',
    zoneCount: 6,
    zoneRadius: 150,
    zoneCooldownSec: 0,
  },
  candy_canyon: {
    kinds: ['cactus', 'rock'],
    targetCount: 28,
    minRadius: 30,
    maxRadius: 48,
    zoneKind: 'sandstorm_beacon',
    zoneCount: 4,
    zoneRadius: 135,
    zoneCooldownSec: 0,
  },
  crystal_cavern: {
    kinds: ['crystal', 'rock', 'pillar'],
    targetCount: 36,
    minRadius: 32,
    maxRadius: 54,
    zoneKind: 'crystal_pylon',
    zoneCount: 4,
    zoneRadius: 130,
    zoneCooldownSec: 30,
  },
  endless_abyss: {
    kinds: ['pillar', 'crystal', 'rock'],
    targetCount: 30,
    minRadius: 34,
    maxRadius: 52,
    zoneKind: 'score_pad',
    zoneCount: 4,
    zoneRadius: 130,
    zoneCooldownSec: 20,
  },
};

export function generateMapLayout(
  mapId: SurvivalMapId,
  seed: number,
): {
  obstacles: MapObstacle[];
  zones: MapZone[];
  spawnPoints: Array<{ x: number; y: number }>;
} {
  const rng = mulberry32((seed ^ MAP_SEED_OFFSETS[mapId]) >>> 0);
  const template = MAP_LAYOUT_TEMPLATES[mapId];
  const center = WORLD_SIZE / 2;
  const margin = 140;
  const maxCoord = WORLD_SIZE - margin;

  const obstacles: MapObstacle[] = [];
  const maxAttempts = 600;
  let attempts = 0;

  while (obstacles.length < template.targetCount && attempts < maxAttempts) {
    attempts++;
    const x = Math.round(margin + rng() * (maxCoord - margin));
    const y = Math.round(margin + rng() * (maxCoord - margin));
    const kind =
      template.kinds[Math.floor(rng() * template.kinds.length)];
    const radius = Math.round(
      template.minRadius + rng() * (template.maxRadius - template.minRadius),
    );

    const distFromCenter = Math.hypot(x - center, y - center);
    if (distFromCenter - radius < 280) {
      continue;
    }

    const overlaps = obstacles.some(
      (other) => Math.hypot(x - other.x, y - other.y) < radius + other.radius + 95,
    );
    if (overlaps) {
      continue;
    }

    obstacles.push({
      id: `obs_${obstacles.length + 1}`,
      x,
      y,
      radius,
      kind,
    });
  }

  const zones: MapZone[] = [];
  const zoneAngleOffset = rng() * Math.PI * 2;

  for (let i = 0; i < template.zoneCount; i++) {
    const baseAngle = zoneAngleOffset + (i * Math.PI * 2) / template.zoneCount;
    const dist = 520 + (i % 2) * 320 + rng() * 140;
    let zx = Math.round(center + Math.cos(baseAngle) * dist);
    let zy = Math.round(center + Math.sin(baseAngle) * dist);

    zx = Math.max(260, Math.min(WORLD_SIZE - 260, zx));
    zy = Math.max(260, Math.min(WORLD_SIZE - 260, zy));

    // Nudge zone away if overlapping an obstacle
    for (const obs of obstacles) {
      const dx = zx - obs.x;
      const dy = zy - obs.y;
      const d = Math.hypot(dx, dy);
      const minGap = obs.radius + 36;
      if (d < minGap) {
        const nx = d > 0.001 ? dx / d : 1;
        const ny = d > 0.001 ? dy / d : 0;
        zx = Math.round(obs.x + nx * minGap);
        zy = Math.round(obs.y + ny * minGap);
      }
    }

    zones.push({
      id: `zone_${i + 1}`,
      x: zx,
      y: zy,
      radius: template.zoneRadius,
      kind: template.zoneKind,
      cooldownSec: 0,
      activeTimerSec: template.zoneKind === 'ice' ? 9999 : 0,
    });
  }

  const spawnPoints = [
    { x: center - 72, y: center - 54 },
    { x: center + 72, y: center - 54 },
    { x: center - 72, y: center + 54 },
    { x: center + 72, y: center + 54 },
  ];

  return { obstacles, zones, spawnPoints };
}
