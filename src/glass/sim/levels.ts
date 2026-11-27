import type {
  Aabb3,
  BarrierDef,
  CheckpointDef,
  CourseDef,
  FragilePlatformConfig,
  GlassMapTheme,
  MovingPlatformDef,
  PendulumDef,
  PlatformDef,
  SpinnerDef,
  SurfaceKind,
  WindZoneDef,
} from './types.ts';

function box(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number,
): Aabb3 {
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

function deck(
  id: string,
  minZ: number,
  maxZ: number,
  opts: {
    minX?: number;
    maxX?: number;
    topY?: number;
    thickness?: number;
    surface?: SurfaceKind;
    conveyorVx?: number;
    conveyorVz?: number;
    fragile?: FragilePlatformConfig;
  } = {},
): PlatformDef {
  const minX = opts.minX ?? -4.6;
  const maxX = opts.maxX ?? 4.6;
  const topY = opts.topY ?? 0;
  const thickness = opts.thickness ?? 0.6;
  return {
    id,
    surface: opts.surface ?? 'wood',
    box: box(minX, maxX, topY - thickness, topY, minZ, maxZ),
    ...(opts.conveyorVx !== undefined ? { conveyorVx: opts.conveyorVx } : {}),
    ...(opts.conveyorVz !== undefined ? { conveyorVz: opts.conveyorVz } : {}),
    ...(opts.fragile !== undefined ? { fragile: opts.fragile } : {}),
  };
}

function lowGap(
  id: string,
  z: number,
  baseY: number = 0,
  opts: {
    minX?: number;
    maxX?: number;
    depth?: number;
    moveAxis?: 'x' | 'y' | 'z';
    moveAmplitude?: number;
    moveSpeed?: number;
    movePhase?: number;
  } = {},
): BarrierDef {
  const depth = opts.depth ?? 0.6;
  return {
    id,
    kind: 'lowGap',
    box: box(
      opts.minX ?? -4.6,
      opts.maxX ?? 4.6,
      baseY + 0.95,
      baseY + 2.6,
      z,
      z + depth,
    ),
    damage: 1,
    blocksPlayers: false,
    ...(opts.moveAxis !== undefined ? { moveAxis: opts.moveAxis } : {}),
    ...(opts.moveAmplitude !== undefined ? { moveAmplitude: opts.moveAmplitude } : {}),
    ...(opts.moveSpeed !== undefined ? { moveSpeed: opts.moveSpeed } : {}),
    ...(opts.movePhase !== undefined ? { movePhase: opts.movePhase } : {}),
  };
}

function highWall(
  id: string,
  z: number,
  opts: {
    halfWidth?: number;
    depth?: number;
    moveAxis?: 'x' | 'y' | 'z';
    moveAmplitude?: number;
    moveSpeed?: number;
    movePhase?: number;
  } = {},
): BarrierDef {
  const halfW = opts.halfWidth ?? 1.1;
  const depth = opts.depth ?? 0.6;
  return {
    id,
    kind: 'highWall',
    box: box(-halfW, halfW, 0, 1.25, z, z + depth),
    damage: 1,
    blocksPlayers: true,
    ...(opts.moveAxis !== undefined ? { moveAxis: opts.moveAxis } : {}),
    ...(opts.moveAmplitude !== undefined ? { moveAmplitude: opts.moveAmplitude } : {}),
    ...(opts.moveSpeed !== undefined ? { moveSpeed: opts.moveSpeed } : {}),
    ...(opts.movePhase !== undefined ? { movePhase: opts.movePhase } : {}),
  };
}

function narrowGate(
  idPrefix: string,
  z: number,
  gapWidth: number,
  halfDeckWidth: number = 4.6,
  baseY: number = 0,
): readonly BarrierDef[] {
  const halfGap = gapWidth * 0.5;
  return [
    {
      id: `${idPrefix}-left`,
      kind: 'wall',
      box: box(-halfDeckWidth, -halfGap, baseY, baseY + 2.6, z, z + 1.0),
      damage: 1,
      blocksPlayers: true,
    },
    {
      id: `${idPrefix}-right`,
      kind: 'wall',
      box: box(halfGap, halfDeckWidth, baseY, baseY + 2.6, z, z + 1.0),
      damage: 1,
      blocksPlayers: true,
    },
  ];
}

function pillar(
  id: string,
  minX: number,
  maxX: number,
  z: number,
  baseY: number = 0,
): BarrierDef {
  return {
    id,
    kind: 'pillar',
    box: box(minX, maxX, baseY, baseY + 2.0, z, z + 0.7),
    damage: 1,
    blocksPlayers: true,
  };
}

function tiltGate(
  idPrefix: string,
  z: number,
  flipped: boolean = false,
): readonly BarrierDef[] {
  const lowMinX = flipped ? -4.6 : 0.9;
  const lowMaxX = flipped ? -0.9 : 4.6;
  const highMinX = flipped ? 0.9 : -4.6;
  const highMaxX = flipped ? 4.6 : -0.9;

  return [
    {
      id: `${idPrefix}-low`,
      kind: 'lowGap',
      box: box(lowMinX, lowMaxX, 0.95, 2.6, z, z + 0.6),
      damage: 1,
      blocksPlayers: false,
    },
    {
      id: `${idPrefix}-high`,
      kind: 'highWall',
      box: box(highMinX, highMaxX, 0, 1.25, z, z + 0.6),
      damage: 1,
      blocksPlayers: false,
    },
  ];
}

function candyPiston(
  id: string,
  z: number,
  moveSpeed: number,
  movePhase: number = 0,
  moveAmplitude: number = 0.75,
): BarrierDef {
  return {
    id,
    kind: 'lowGap',
    box: box(-4.6, 4.6, 1.45, 3.05, z, z + 0.8),
    damage: 1,
    blocksPlayers: false,
    moveAxis: 'y',
    moveAmplitude,
    moveSpeed,
    movePhase,
  };
}

function verticalElevator(
  id: string,
  minZ: number,
  maxZ: number,
  fromY: number,
  toY: number,
  speed: number,
  phase: number = 0,
  halfWidth: number = 4.2,
): MovingPlatformDef {
  const midY = (fromY + toY) * 0.5;
  const amplitude = Math.abs(toY - fromY) * 0.5;
  return {
    id,
    surface: 'wood',
    baseBox: box(-halfWidth, halfWidth, midY - 0.6, midY, minZ, maxZ),
    axis: 'y',
    amplitude,
    speed,
    phase,
  };
}

function horizontalMover(
  id: string,
  minZ: number,
  maxZ: number,
  amplitude: number,
  speed: number,
  phase: number = 0,
  topY: number = 0,
  halfWidth: number = 3.2,
): MovingPlatformDef {
  return {
    id,
    surface: 'wood',
    baseBox: box(-halfWidth, halfWidth, topY - 0.6, topY, minZ, maxZ),
    axis: 'x',
    amplitude,
    speed,
    phase,
  };
}

function windZone(
  id: string,
  minZ: number,
  maxZ: number,
  forceX: number,
  phaseOffsetSec: number = 0,
  baseY: number = 0,
  halfWidth: number = 4.2,
): WindZoneDef {
  return {
    id,
    box: box(-halfWidth, halfWidth, baseY, baseY + 3.0, minZ, maxZ),
    forceX,
    periodSec: 5.5,
    warnDurationSec: 1.5,
    activeDurationSec: 2.2,
    phaseOffsetSec,
  };
}

function pendulum(
  id: string,
  pivotZ: number,
  speed: number,
  phase: number = 0,
  baseY: number = 0,
  pivotX: number = 0,
): PendulumDef {
  return {
    id,
    pivotX,
    pivotY: baseY + 5.4,
    pivotZ,
    armLength: 4.1,
    maxAngleRad: 0.78,
    speed,
    phase,
    bobRadius: 0.62,
    damage: 2,
  };
}

function spinner(
  id: string,
  centerZ: number,
  angularSpeed: number,
  opts: {
    centerY?: number;
    halfLength?: number;
    halfHeight?: number;
    phase?: number;
  } = {},
): SpinnerDef {
  return {
    id,
    centerX: 0,
    centerY: opts.centerY ?? 0.65,
    centerZ,
    halfLength: opts.halfLength ?? 3.2,
    halfHeight: opts.halfHeight ?? 0.28,
    halfThickness: 0.22,
    angularSpeed,
    phase: opts.phase ?? 0,
    damage: 2,
  };
}

interface StageSpec {
  readonly name: string;
  readonly startZ: number;
  readonly endZ: number;
  readonly spawnY?: number;
}

function buildStagesAndCheckpoints(specs: readonly StageSpec[]): {
  stages: CourseDef['stages'];
  checkpoints: readonly CheckpointDef[];
} {
  const stages = specs.map((s, idx) => ({
    number: idx + 1,
    name: s.name,
    startZ: s.startZ,
    endZ: s.endZ,
  }));
  const checkpoints: CheckpointDef[] = specs.map((s, idx) => {
    const spawnY = s.spawnY ?? 0;
    const spawnZ = s.startZ === 0 ? 1.5 : s.startZ + 0.5;
    return {
      index: idx,
      stageNumber: idx + 1,
      stageName: s.name,
      triggerZ: s.startZ,
      p1Spawn: { x: -1.6, y: spawnY, z: spawnZ },
      p2Spawn: { x: 1.6, y: spawnY, z: spawnZ },
    };
  });
  return { stages, checkpoints };
}

/** Visual color themes for the three Glass Carry map packs. */
export const GLASS_MAP_THEMES: Readonly<
  Record<'cabin_bridge' | 'sky_scaffold' | 'candy_factory', GlassMapTheme>
> = {
  cabin_bridge: {
    id: 'cabin_bridge',
    skyHex: '#0d1b2e',
    fogHex: '#12233b',
    abyssHex: '#0a1526',
    deckPrimaryHex: '#8c5633',
    deckStripeHex: '#724326',
    curbHex: '#57331d',
    hazardPrimaryHex: '#facc15',
    hazardStripeHex: '#1e293b',
    lanternCoolHex: '#38bdf8',
    lanternWarmHex: '#fde047',
    ambientLightHex: '#bfdbfe',
    sunLightHex: '#fff3d6',
  },
  sky_scaffold: {
    id: 'sky_scaffold',
    skyHex: '#261835',
    fogHex: '#331e42',
    abyssHex: '#160d24',
    deckPrimaryHex: '#b45309',
    deckStripeHex: '#475569',
    curbHex: '#1e293b',
    hazardPrimaryHex: '#fbbf24',
    hazardStripeHex: '#111827',
    lanternCoolHex: '#60a5fa',
    lanternWarmHex: '#fb923c',
    ambientLightHex: '#fed7aa',
    sunLightHex: '#ffedd5',
  },
  candy_factory: {
    id: 'candy_factory',
    skyHex: '#1f1135',
    fogHex: '#2c1648',
    abyssHex: '#140924',
    deckPrimaryHex: '#f472b6',
    deckStripeHex: '#fbcfe8',
    curbHex: '#a855f7',
    hazardPrimaryHex: '#5eead4',
    hazardStripeHex: '#831843',
    lanternCoolHex: '#5eead4',
    lanternWarmHex: '#fde047',
    ambientLightHex: '#fbcfe8',
    sunLightHex: '#fef3c7',
  },
};

function makeCourse(
  theme: GlassMapTheme,
  finishZ: number,
  stageSpecs: readonly StageSpec[],
  obstacles: {
    platforms: readonly PlatformDef[];
    movingPlatforms?: readonly MovingPlatformDef[];
    barriers?: readonly BarrierDef[];
    windZones?: readonly WindZoneDef[];
    pendulums?: readonly PendulumDef[];
    spinners?: readonly SpinnerDef[];
  },
): CourseDef {
  const { stages, checkpoints } = buildStagesAndCheckpoints(stageSpecs);
  return {
    finishZ,
    theme,
    stages,
    checkpoints,
    platforms: obstacles.platforms,
    movingPlatforms: obstacles.movingPlatforms ?? [],
    barriers: obstacles.barriers ?? [],
    windZones: obstacles.windZones ?? [],
    pendulums: obstacles.pendulums ?? [],
    spinners: obstacles.spinners ?? [],
  };
}

const CABIN_1 = makeCourse(
  GLASS_MAP_THEMES.cabin_bridge,
  65,
  [
    { name: 'Cổng Gỗ Khởi Động', startZ: 0, endZ: 32 },
    { name: 'Nước Rút Về Đích', startZ: 32, endZ: 65 },
  ],
  {
    platforms: [deck('c1-main-bridge', -1.5, 69.0)],
    barriers: [
      lowGap('c1-low-1', 8.5),
      highWall('c1-high-1', 16.0),
      ...narrowGate('c1-gate-1', 24.0, 2.6),
      lowGap('c1-low-2', 41.0),
      highWall('c1-high-2', 51.0),
    ],
  },
);

const CABIN_2 = makeCourse(
  GLASS_MAP_THEMES.cabin_bridge,
  90,
  [
    { name: 'Cổng Gỗ Khởi Động', startZ: 0, endZ: 30 },
    { name: 'Sàn Băng & Gió Đông', startZ: 30, endZ: 60 },
    { name: 'Combo Về Đích', startZ: 60, endZ: 90 },
  ],
  {
    platforms: [
      deck('c2-s1-wood', -1.5, 32.5),
      deck('c2-s2-ice', 32.5, 58.5, { minX: -4.2, maxX: 4.2, surface: 'ice' }),
      deck('c2-s3-wood', 58.5, 94.0),
    ],
    barriers: [
      lowGap('c2-s1-low', 8.0),
      highWall('c2-s1-high', 15.0),
      ...narrowGate('c2-s1-gate', 22.0, 2.3),
      pillar('c2-s2-pil-1', 3.4, 4.1, 37.0),
      pillar('c2-s2-pil-2', -4.1, -3.4, 41.5),
      pillar('c2-s2-pil-3', -4.1, -3.4, 48.0),
      pillar('c2-s2-pil-4', 3.4, 4.1, 53.0),
      lowGap('c2-s3-low-1', 67.5),
      highWall('c2-s3-high-1', 75.5),
      lowGap('c2-s3-low-2', 82.5),
    ],
    windZones: [
      windZone('c2-wind-1', 34.0, 44.0, 8.0, 0),
      windZone('c2-wind-2', 46.0, 56.0, -8.0, 2.75),
    ],
  },
);

const CABIN_3 = makeCourse(
  GLASS_MAP_THEMES.cabin_bridge,
  110,
  [
    { name: 'Khởi Động Rào Gỗ', startZ: 0, endZ: 36 },
    { name: 'Xưởng Búa & Trụ Xoay', startZ: 36, endZ: 74 },
    { name: 'Bệ Bay Qua Vực', startZ: 74, endZ: 110 },
  ],
  {
    platforms: [
      deck('c3-s1-wood', -1.5, 38.0),
      deck('c3-s2-wood', 38.0, 79.0),
      deck('c3-s3-finish', 94.3, 114.0, { minX: -4.8, maxX: 4.8 }),
    ],
    movingPlatforms: [
      horizontalMover('c3-s3-mover-1', 80.1, 86.1, 1.5, 1.0, 0),
      horizontalMover('c3-s3-mover-2', 87.2, 93.2, 1.5, 1.0, Math.PI),
    ],
    barriers: [
      lowGap('c3-s1-low', 10.0),
      highWall('c3-s1-high', 19.0),
      lowGap('c3-s1-low-2', 28.0),
      highWall('c3-s3-high', 101.5),
    ],
    pendulums: [
      pendulum('c3-pend-1', 46.0, 1.6, 0),
      pendulum('c3-pend-2', 56.0, 1.6, Math.PI),
    ],
    spinners: [
      spinner('c3-spin-1', 66.0, 1.05),
    ],
  },
);

const CABIN_4 = makeCourse(
  GLASS_MAP_THEMES.cabin_bridge,
  130,
  [
    { name: 'Sàn Băng Gió Mạnh', startZ: 0, endZ: 32 },
    { name: 'Rào Di Động & Cổng Hẹp', startZ: 32, endZ: 64 },
    { name: 'Cầu Lồng Đèn & Búa Lắc', startZ: 64, endZ: 98 },
    { name: 'Bệ Bay Về Đích', startZ: 98, endZ: 130 },
  ],
  {
    platforms: [
      deck('c4-s1-start', -1.5, 5.0),
      deck('c4-s1-ice', 5.0, 31.0, { minX: -4.2, maxX: 4.2, surface: 'ice' }),
      deck('c4-s2-wood', 31.0, 66.5),
      deck('c4-s3-cat-left', 66.5, 83.0, { minX: -3.6, maxX: 2.2 }),
      deck('c4-s3-cat-right', 82.2, 102.0, { minX: -2.2, maxX: 3.6 }),
      deck('c4-s4-finish', 119.9, 134.0, { minX: -4.8, maxX: 4.8 }),
    ],
    movingPlatforms: [
      horizontalMover('c4-s4-mover-1', 103.1, 107.6, 1.7, 1.1, 0),
      horizontalMover('c4-s4-mover-2', 108.7, 113.2, 1.7, 1.1, Math.PI),
      horizontalMover('c4-s4-mover-3', 114.3, 118.8, 1.7, 1.1, Math.PI * 0.5),
    ],
    barriers: [
      pillar('c4-s1-pil-1', 3.4, 4.1, 11.0),
      pillar('c4-s1-pil-2', -4.1, -3.4, 21.0),
      lowGap('c4-s2-mov-low', 40.0, 0, {
        moveAxis: 'z',
        moveAmplitude: 1.4,
        moveSpeed: 1.1,
        movePhase: 0,
      }),
      highWall('c4-s2-mov-high', 48.5, {
        moveAxis: 'z',
        moveAmplitude: 1.3,
        moveSpeed: 1.1,
        movePhase: Math.PI,
      }),
      ...narrowGate('c4-s2-gate', 57.0, 2.2),
      pillar('c4-s3-lantern-1', 1.5, 2.1, 72.0),
      pillar('c4-s3-lantern-2', -2.1, -1.5, 89.0),
    ],
    windZones: [
      windZone('c4-wind-1', 7.0, 17.0, 10.5, 0),
      windZone('c4-wind-2', 19.0, 29.0, -10.5, 2.5),
    ],
    pendulums: [
      pendulum('c4-pend-1', 77.0, 1.85, 0, 0, -0.7),
      pendulum('c4-pend-2', 93.0, 1.85, Math.PI * 0.7, 0, 0.7),
    ],
  },
);

const CABIN_5 = makeCourse(
  GLASS_MAP_THEMES.cabin_bridge,
  145,
  [
    { name: 'Cổng Siêu Hẹp', startZ: 0, endZ: 28 },
    { name: 'Bão Tuyết Sàn Băng', startZ: 28, endZ: 56 },
    { name: 'Liên Hoàn Búa & Trụ', startZ: 56, endZ: 86 },
    { name: 'Bệ So Le Vượt Vực', startZ: 86, endZ: 116 },
    { name: 'Nước Rút Đỉnh Bão', startZ: 116, endZ: 145 },
  ],
  {
    platforms: [
      deck('c5-s1-wood', -1.5, 30.5),
      deck('c5-s2-ice', 30.5, 55.0, { minX: -4.2, maxX: 4.2, surface: 'ice' }),
      deck('c5-s3-wood', 55.0, 90.0),
      deck('c5-s4-bridge', 107.9, 136.0),
      deck('c5-s5-finish', 137.1, 149.0, { minX: -4.8, maxX: 4.8 }),
    ],
    movingPlatforms: [
      horizontalMover('c5-s4-mover-1', 91.1, 95.6, 1.75, 1.15, 0),
      horizontalMover('c5-s4-mover-2', 96.7, 101.2, 1.75, 1.15, Math.PI),
      horizontalMover('c5-s4-mover-3', 102.3, 106.8, 1.75, 1.15, Math.PI * 0.5),
    ],
    barriers: [
      lowGap('c5-s1-low', 8.0),
      highWall('c5-s1-high', 14.5),
      ...narrowGate('c5-s1-gate', 21.5, 2.15),
      pillar('c5-s2-pil-1', 3.4, 4.1, 36.0),
      pillar('c5-s2-pil-2', -4.1, -3.4, 45.0),
      lowGap('c5-s5-mov-low', 122.5, 0, {
        moveAxis: 'z',
        moveAmplitude: 1.5,
        moveSpeed: 1.2,
        movePhase: 0,
      }),
      highWall('c5-s5-high', 130.5),
    ],
    windZones: [
      windZone('c5-wind-1', 32.5, 42.0, 11.0, 0),
      windZone('c5-wind-2', 44.0, 53.5, -11.0, 2.4),
      windZone('c5-wind-3', 124.5, 134.5, 9.5, 1.0),
    ],
    pendulums: [
      pendulum('c5-pend-1', 61.5, 2.0, 0),
      pendulum('c5-pend-2', 68.5, 2.0, Math.PI),
      pendulum('c5-pend-3', 75.5, 2.0, Math.PI * 0.5),
    ],
    spinners: [
      spinner('c5-spin-1', 82.0, 1.35),
    ],
  },
);

const SKY_1 = makeCourse(
  GLASS_MAP_THEMES.sky_scaffold,
  70,
  [
    { name: 'Giàn Giáo Tầng 1', startZ: 0, endZ: 35, spawnY: 0 },
    { name: 'Sàn Thép Tầng Trên', startZ: 35, endZ: 70, spawnY: 1.6 },
  ],
  {
    platforms: [
      deck('s1-lower-start', -1.5, 10.0),
      deck('s1-fragile-1', 11.0, 16.5, {
        fragile: { fallDelaySec: 2.0, respawnDelaySec: 3.0 },
      }),
      deck('s1-lower-mid', 17.5, 27.5),
      deck('s1-upper-mid', 34.5, 48.0, { topY: 1.6 }),
      deck('s1-fragile-2', 49.1, 55.1, {
        topY: 1.6,
        fragile: { fallDelaySec: 2.0, respawnDelaySec: 3.0 },
      }),
      deck('s1-upper-finish', 56.2, 74.0, { minX: -4.8, maxX: 4.8, topY: 1.6 }),
    ],
    movingPlatforms: [
      verticalElevator('s1-elev-1', 28.3, 33.8, 0, 1.6, 1.25),
    ],
    barriers: [
      highWall('s1-high-1', 21.0),
      lowGap('s1-low-1', 42.0, 1.6),
    ],
  },
);

const SKY_2 = makeCourse(
  GLASS_MAP_THEMES.sky_scaffold,
  95,
  [
    { name: 'Cầu Ván Giòn Tầng 1', startZ: 0, endZ: 32 },
    { name: 'Cần Cẩu Hoàng Hôn', startZ: 32, endZ: 64 },
    { name: 'Dầm Thép Về Đích', startZ: 64, endZ: 95 },
  ],
  {
    platforms: [
      deck('s2-d1', -1.5, 14.0),
      deck('s2-fragile-1', 15.0, 21.0, {
        fragile: { fallDelaySec: 1.7, respawnDelaySec: 3.0 },
      }),
      deck('s2-d2', 22.0, 44.0),
      deck('s2-fragile-2', 45.1, 51.1, {
        fragile: { fallDelaySec: 1.7, respawnDelaySec: 3.0 },
      }),
      deck('s2-d3', 52.2, 74.0),
      deck('s2-fragile-3', 75.1, 81.1, {
        fragile: { fallDelaySec: 1.7, respawnDelaySec: 3.0 },
      }),
      deck('s2-finish', 82.2, 99.0, { minX: -4.8, maxX: 4.8 }),
    ],
    barriers: [
      lowGap('s2-low-1', 8.0),
      highWall('s2-high-1', 27.0),
      lowGap('s2-low-2', 88.0),
    ],
    spinners: [
      spinner('s2-crane-1', 39.0, 1.1, { centerY: 1.65, halfHeight: 0.3 }),
      spinner('s2-crane-2', 58.0, -1.15, { centerY: 1.65, halfHeight: 0.3 }),
    ],
  },
);

const SKY_3 = makeCourse(
  GLASS_MAP_THEMES.sky_scaffold,
  115,
  [
    { name: 'Thang Nâng Tầng 1', startZ: 0, endZ: 38, spawnY: 0 },
    { name: 'Gió Cao Tầng 2', startZ: 38, endZ: 76, spawnY: 1.8 },
    { name: 'Cần Cẩu Đỉnh Tháp', startZ: 76, endZ: 115, spawnY: 3.4 },
  ],
  {
    platforms: [
      deck('s3-tier0', -1.5, 29.0),
      deck('s3-tier1-a', 37.0, 56.0, { topY: 1.8 }),
      deck('s3-fragile-1', 57.1, 63.1, {
        topY: 1.8,
        fragile: { fallDelaySec: 1.6, respawnDelaySec: 3.0 },
      }),
      deck('s3-tier1-b', 64.2, 68.5, { topY: 1.8 }),
      deck('s3-tier2-a', 75.5, 96.0, { topY: 3.4 }),
      deck('s3-fragile-2', 97.1, 102.5, {
        topY: 3.4,
        fragile: { fallDelaySec: 1.6, respawnDelaySec: 3.0 },
      }),
      deck('s3-tier2-finish', 103.6, 119.0, { minX: -4.8, maxX: 4.8, topY: 3.4 }),
    ],
    movingPlatforms: [
      verticalElevator('s3-elev-1', 29.8, 36.2, 0, 1.8, 1.2),
      verticalElevator('s3-elev-2', 69.3, 74.7, 1.8, 3.4, 1.25, Math.PI * 0.5),
    ],
    barriers: [
      lowGap('s3-low-1', 9.0),
      highWall('s3-high-1', 16.5),
      ...narrowGate('s3-gate-1', 23.0, 2.25),
      lowGap('s3-low-2', 45.0, 1.8),
    ],
    windZones: [
      windZone('s3-wind-1', 42.0, 53.0, 8.5, 0, 1.8),
      windZone('s3-wind-2', 80.0, 90.0, -8.5, 2.5, 3.4),
    ],
    spinners: [
      spinner('s3-crane-1', 92.0, 1.2, { centerY: 3.4 + 1.65, halfHeight: 0.3 }),
    ],
  },
);

const SKY_4 = makeCourse(
  GLASS_MAP_THEMES.sky_scaffold,
  135,
  [
    { name: 'Ván Giòn Xen Bệ Bay', startZ: 0, endZ: 34 },
    { name: 'Cần Cẩu Giàn Thép', startZ: 34, endZ: 68 },
    { name: 'Bao Cát Lắc & Cần Cẩu', startZ: 68, endZ: 102 },
    { name: 'Dầm Thép Cuối Tuyến', startZ: 102, endZ: 135 },
  ],
  {
    platforms: [
      deck('s4-d1', -1.5, 10.0),
      deck('s4-fragile-1', 11.0, 16.5, {
        fragile: { fallDelaySec: 1.5, respawnDelaySec: 3.0 },
      }),
      deck('s4-fragile-2', 23.2, 28.7, {
        fragile: { fallDelaySec: 1.5, respawnDelaySec: 3.0 },
      }),
      deck('s4-d2', 29.8, 42.0),
      deck('s4-fragile-3', 43.1, 48.6, {
        fragile: { fallDelaySec: 1.5, respawnDelaySec: 3.0 },
      }),
      deck('s4-fragile-4', 55.3, 60.8, {
        fragile: { fallDelaySec: 1.5, respawnDelaySec: 3.0 },
      }),
      deck('s4-d3', 61.9, 110.0),
      deck('s4-finish', 122.3, 139.0, { minX: -4.8, maxX: 4.8 }),
    ],
    movingPlatforms: [
      horizontalMover('s4-mover-1', 17.6, 22.1, 1.5, 1.1, 0),
      horizontalMover('s4-mover-2', 49.7, 54.2, 1.5, 1.1, Math.PI),
      horizontalMover('s4-mover-3', 111.1, 115.6, 1.6, 1.15, 0),
      horizontalMover('s4-mover-4', 116.7, 121.2, 1.6, 1.15, Math.PI),
    ],
    barriers: [
      lowGap('s4-low-1', 7.0),
      highWall('s4-high-1', 32.0),
      lowGap('s4-low-2', 128.0),
    ],
    pendulums: [
      pendulum('s4-sandbag-1', 77.0, 1.8, 0),
      pendulum('s4-sandbag-2', 86.0, 1.8, Math.PI),
    ],
    spinners: [
      spinner('s4-crane-1', 39.0, 1.2, { centerY: 1.65, halfHeight: 0.3 }),
      spinner('s4-crane-2', 95.0, -1.25, { centerY: 1.65, halfHeight: 0.3 }),
    ],
  },
);

const SKY_5 = makeCourse(
  GLASS_MAP_THEMES.sky_scaffold,
  150,
  [
    { name: 'Thang Nâng Tầng Hạ', startZ: 0, endZ: 30, spawnY: 0 },
    { name: 'Gió Lốc Giàn Giáo', startZ: 30, endZ: 60, spawnY: 2.0 },
    { name: 'Cần Cẩu Đối Nghịch', startZ: 60, endZ: 90, spawnY: 2.0 },
    { name: 'Chuỗi Ván Siêu Giòn', startZ: 90, endZ: 120, spawnY: 3.8 },
    { name: 'Dầm Hẹp Nóc Tòa Nhà', startZ: 120, endZ: 150, spawnY: 3.8 },
  ],
  {
    platforms: [
      deck('s5-t0-a', -1.5, 12.0),
      deck('s5-fragile-1', 13.0, 18.0, {
        fragile: { fallDelaySec: 1.35, respawnDelaySec: 3.0 },
      }),
      deck('s5-t0-b', 19.0, 23.0),
      deck('s5-t1-a', 29.5, 44.0, { topY: 2.0 }),
      deck('s5-fragile-2', 45.1, 50.1, {
        topY: 2.0,
        fragile: { fallDelaySec: 1.35, respawnDelaySec: 3.0 },
      }),
      deck('s5-t1-b', 51.2, 76.0, { topY: 2.0 }),
      deck('s5-t2-a', 82.8, 97.0, { topY: 3.8 }),
      deck('s5-fragile-3', 98.1, 103.1, {
        topY: 3.8,
        fragile: { fallDelaySec: 1.35, respawnDelaySec: 3.0 },
      }),
      deck('s5-fragile-4', 109.8, 114.8, {
        topY: 3.8,
        fragile: { fallDelaySec: 1.35, respawnDelaySec: 3.0 },
      }),
      deck('s5-t2-b', 115.9, 124.0, { topY: 3.8 }),
      deck('s5-narrow-beam', 124.0, 141.0, { minX: -2.6, maxX: 2.6, topY: 3.8 }),
      deck('s5-finish', 141.0, 154.0, { minX: -4.8, maxX: 4.8, topY: 3.8 }),
    ],
    movingPlatforms: [
      verticalElevator('s5-elev-1', 23.8, 28.8, 0, 2.0, 1.3),
      verticalElevator('s5-elev-2', 76.8, 82.0, 2.0, 3.8, 1.35, Math.PI * 0.5),
      horizontalMover('s5-mover-1', 104.2, 108.7, 1.5, 1.2, 0, 3.8),
    ],
    barriers: [
      lowGap('s5-low-1', 7.0),
      highWall('s5-high-1', 21.0),
      lowGap('s5-low-2', 127.0, 3.8, { minX: -2.6, maxX: 2.6 }),
    ],
    windZones: [
      windZone('s5-wind-1', 33.0, 42.0, 11.0, 0, 2.0),
      windZone('s5-wind-2', 64.0, 74.0, -11.0, 2.2, 2.0),
      windZone('s5-wind-3', 126.0, 138.0, 10.5, 1.0, 3.8, 2.6),
    ],
    spinners: [
      spinner('s5-crane-1', 56.0, 1.3, { centerY: 2.0 + 1.65, halfHeight: 0.3 }),
      spinner('s5-crane-2', 68.0, -1.35, { centerY: 2.0 + 1.65, halfHeight: 0.3 }),
      spinner('s5-crane-3', 134.0, 1.35, {
        centerY: 3.8 + 1.65,
        halfHeight: 0.3,
        halfLength: 2.4,
      }),
    ],
  },
);

const CANDY_1 = makeCourse(
  GLASS_MAP_THEMES.candy_factory,
  70,
  [
    { name: 'Băng Chuyền Kẹo Dẻo', startZ: 0, endZ: 35 },
    { name: 'Piston Dập Kẹo Chậm', startZ: 35, endZ: 70 },
  ],
  {
    platforms: [
      deck('cf1-start', -1.5, 8.0),
      deck('cf1-conv-1', 8.0, 21.0, { conveyorVz: 2.0 }),
      deck('cf1-mid', 21.0, 42.0),
      deck('cf1-conv-2', 42.0, 56.0, { conveyorVx: 2.0 }),
      deck('cf1-finish', 56.0, 74.0, { minX: -4.8, maxX: 4.8 }),
    ],
    barriers: [
      lowGap('cf1-low-1', 26.0),
      highWall('cf1-high-1', 31.0),
      candyPiston('cf1-piston-1', 63.0, 1.4, 0, 0.75),
    ],
  },
);

const CANDY_2 = makeCourse(
  GLASS_MAP_THEMES.candy_factory,
  95,
  [
    { name: 'Cổng Chéo Bạc Hà 1', startZ: 0, endZ: 32 },
    { name: 'Băng Chuyền Ngược & Cổng Chéo 2', startZ: 32, endZ: 64 },
    { name: 'Dây Chuyền Về Đích', startZ: 64, endZ: 95 },
  ],
  {
    platforms: [
      deck('cf2-s1-solid', -1.5, 16.0),
      deck('cf2-s1-conv', 16.0, 28.0, { conveyorVz: 2.2 }),
      deck('cf2-s2-solid-a', 28.0, 40.0),
      deck('cf2-s2-conv-rev', 40.0, 56.0, { conveyorVz: -2.0 }),
      deck('cf2-s2-finish', 56.0, 99.0, { minX: -4.8, maxX: 4.8 }),
    ],
    barriers: [
      ...tiltGate('cf2-tilt-1', 11.5, false),
      ...tiltGate('cf2-tilt-2', 49.0, false),
      lowGap('cf2-low-1', 73.0),
      highWall('cf2-high-1', 83.0),
    ],
  },
);

const CANDY_3 = makeCourse(
  GLASS_MAP_THEMES.candy_factory,
  115,
  [
    { name: 'Băng Chuyền Ngang & Piston 1', startZ: 0, endZ: 38 },
    { name: 'Piston Kép & Kẹo Mút Xoay', startZ: 38, endZ: 76 },
    { name: 'Dập Kẹo Về Đích', startZ: 76, endZ: 115 },
  ],
  {
    platforms: [
      deck('cf3-s1-start', -1.5, 10.0),
      deck('cf3-s1-conv-r', 10.0, 24.0, { conveyorVx: 2.6 }),
      deck('cf3-s1-solid', 24.0, 45.0),
      deck('cf3-s2-conv-l', 45.0, 61.0, { conveyorVx: -2.6 }),
      deck('cf3-s3-finish', 61.0, 119.0, { minX: -4.8, maxX: 4.8 }),
    ],
    barriers: [
      candyPiston('cf3-piston-1', 31.0, 1.8, 0, 0.75),
      candyPiston('cf3-piston-2', 66.0, 1.8, Math.PI * 0.6, 0.75),
      candyPiston('cf3-piston-3', 88.0, 1.8, Math.PI * 1.2, 0.75),
      highWall('cf3-high-1', 102.0),
    ],
    spinners: [
      spinner('cf3-lollipop-1', 72.5, 1.15),
    ],
  },
);

const CANDY_4 = makeCourse(
  GLASS_MAP_THEMES.candy_factory,
  135,
  [
    { name: 'Băng Chuyền Nhanh & Cổng Chéo', startZ: 0, endZ: 34 },
    { name: 'Trượt Ngang & Cổng Hẹp', startZ: 34, endZ: 68 },
    { name: 'Băng Chuyền Ngược & Cổng Chéo Đảo', startZ: 68, endZ: 102 },
    { name: 'Bệ Nhảy Đóng Gói', startZ: 102, endZ: 135 },
  ],
  {
    platforms: [
      deck('cf4-s1-start', -1.5, 8.0),
      deck('cf4-s1-conv', 8.0, 26.0, { conveyorVz: 3.4 }),
      deck('cf4-s2-solid-a', 26.0, 42.0),
      deck('cf4-s2-conv-lat', 42.0, 56.0, { conveyorVx: -3.4 }),
      deck('cf4-s2-solid-b', 56.0, 76.0),
      deck('cf4-s3-conv-rev', 76.0, 94.0, { conveyorVz: -3.4 }),
      deck('cf4-s4-solid-a', 94.0, 108.0),
      deck('cf4-s4-finish', 121.3, 139.0, { minX: -4.8, maxX: 4.8 }),
    ],
    movingPlatforms: [
      horizontalMover('cf4-mover-1', 109.1, 114.1, 1.6, 1.15, 0),
      horizontalMover('cf4-mover-2', 115.2, 120.2, 1.6, 1.15, Math.PI),
    ],
    barriers: [
      ...tiltGate('cf4-tilt-1', 21.0, false),
      ...narrowGate('cf4-gate-1', 62.0, 2.2),
      ...tiltGate('cf4-tilt-2', 87.0, true),
      lowGap('cf4-low-1', 128.0),
    ],
  },
);

const CANDY_5 = makeCourse(
  GLASS_MAP_THEMES.candy_factory,
  150,
  [
    { name: 'Băng Chuyền Ngược Tốc Độ Cao', startZ: 0, endZ: 30 },
    { name: 'Cặp Cổng Chéo Đối Nghịch', startZ: 30, endZ: 60 },
    { name: 'Piston Siêu Tốc & Búa Kẹo', startZ: 60, endZ: 90 },
    { name: 'Trượt Ngang & Bệ Bay', startZ: 90, endZ: 120 },
    { name: 'Nước Rút Băng Chuyền', startZ: 120, endZ: 150 },
  ],
  {
    platforms: [
      deck('cf5-s1-start', -1.5, 7.0),
      deck('cf5-s1-conv-rev', 7.0, 24.0, { conveyorVz: -3.6 }),
      deck('cf5-s2-solid-a', 24.0, 36.0),
      deck('cf5-s2-conv-lat', 36.0, 54.0, { conveyorVx: 3.6 }),
      deck('cf5-s3-solid', 54.0, 96.0),
      deck('cf5-s4-conv-lat', 96.0, 108.0, { conveyorVx: -3.6 }),
      deck('cf5-s5-landing', 119.8, 124.0),
      deck('cf5-s5-conv-dash', 124.0, 142.0, { conveyorVz: 3.6 }),
      deck('cf5-s5-finish', 142.0, 154.0, { minX: -4.8, maxX: 4.8 }),
    ],
    movingPlatforms: [
      horizontalMover('cf5-mover-1', 109.1, 113.6, 1.7, 1.2, 0),
      horizontalMover('cf5-mover-2', 114.6, 119.1, 1.7, 1.2, Math.PI),
    ],
    barriers: [
      candyPiston('cf5-piston-1', 16.0, 2.3, 0, 0.75),
      ...tiltGate('cf5-tilt-qe', 42.0, true),
      ...tiltGate('cf5-tilt-eq', 50.0, false),
      candyPiston('cf5-piston-2', 68.0, 2.3, 0.7, 0.75),
      candyPiston('cf5-piston-3', 76.0, 2.3, Math.PI, 0.75),
      lowGap('cf5-low-final', 139.0),
    ],
    pendulums: [
      pendulum('cf5-candy-pend-1', 84.0, 1.9, 0),
      pendulum('cf5-candy-pend-2', 133.0, 2.0, Math.PI * 0.5),
    ],
  },
);

/** All 15 handcrafted Glass Carry courses keyed by `"${mapPackId}:${level}"`. */
export const GLASS_LEVEL_COURSES: Readonly<Record<string, CourseDef>> = {
  'cabin_bridge:1': CABIN_1,
  'cabin_bridge:2': CABIN_2,
  'cabin_bridge:3': CABIN_3,
  'cabin_bridge:4': CABIN_4,
  'cabin_bridge:5': CABIN_5,
  'sky_scaffold:1': SKY_1,
  'sky_scaffold:2': SKY_2,
  'sky_scaffold:3': SKY_3,
  'sky_scaffold:4': SKY_4,
  'sky_scaffold:5': SKY_5,
  'candy_factory:1': CANDY_1,
  'candy_factory:2': CANDY_2,
  'candy_factory:3': CANDY_3,
  'candy_factory:4': CANDY_4,
  'candy_factory:5': CANDY_5,
};

/** Returns the CourseDef for a Glass Carry map pack and level number, falling back to `cabin_bridge:1`. */
export function getGlassCourseForStage(
  mapPackId: string,
  level: number,
): CourseDef {
  return (
    GLASS_LEVEL_COURSES[`${mapPackId}:${level}`] ??
    GLASS_LEVEL_COURSES[`${mapPackId}:1`] ??
    CABIN_1
  );
}
