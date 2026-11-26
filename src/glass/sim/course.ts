import { COURSE_FINISH_Z } from './constants.ts';
import type {
  Aabb3,
  CourseDef,
  EvaluatedBarrier,
  EvaluatedCourseObstacles,
  EvaluatedPendulum,
  EvaluatedPlatform,
  EvaluatedSpinner,
  EvaluatedWindZone,
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

function shiftBox(source: Aabb3, axis: 'x' | 'z', offset: number): Aabb3 {
  if (offset === 0) return source;
  if (axis === 'x') {
    return {
      ...source,
      minX: source.minX + offset,
      maxX: source.maxX + offset,
    };
  }
  return {
    ...source,
    minZ: source.minZ + offset,
    maxZ: source.maxZ + offset,
  };
}

/** Deterministic 5-stage obstacle course for Glass Carry Co-op (`z = 0..140`). */
export const GLASS_COURSE: CourseDef = {
  finishZ: COURSE_FINISH_Z,
  stages: [
    { number: 1, name: 'Cổng Gỗ Khởi Động', startZ: 0, endZ: 28 },
    { number: 2, name: 'Sàn Băng & Quạt Gió', startZ: 28, endZ: 56 },
    { number: 3, name: 'Xưởng Búa & Trụ Xoay', startZ: 56, endZ: 86 },
    { number: 4, name: 'Cầu Bập Bênh & Bệ Nhảy', startZ: 86, endZ: 116 },
    { number: 5, name: 'Nước Rút Về Đích', startZ: 116, endZ: 140 },
  ],
  checkpoints: [
    {
      index: 0,
      stageNumber: 1,
      stageName: 'Cổng Gỗ Khởi Động',
      triggerZ: 0,
      p1Spawn: { x: -1.6, y: 0, z: 1.5 },
      p2Spawn: { x: 1.6, y: 0, z: 1.5 },
    },
    {
      index: 1,
      stageNumber: 2,
      stageName: 'Sàn Băng & Quạt Gió',
      triggerZ: 28,
      p1Spawn: { x: -1.6, y: 0, z: 28.5 },
      p2Spawn: { x: 1.6, y: 0, z: 28.5 },
    },
    {
      index: 2,
      stageNumber: 3,
      stageName: 'Xưởng Búa & Trụ Xoay',
      triggerZ: 56,
      p1Spawn: { x: -1.6, y: 0, z: 56.5 },
      p2Spawn: { x: 1.6, y: 0, z: 56.5 },
    },
    {
      index: 3,
      stageNumber: 4,
      stageName: 'Cầu Bập Bênh & Bệ Nhảy',
      triggerZ: 86,
      p1Spawn: { x: -1.6, y: 0, z: 86.5 },
      p2Spawn: { x: 1.6, y: 0, z: 86.5 },
    },
    {
      index: 4,
      stageNumber: 5,
      stageName: 'Nước Rút Về Đích',
      triggerZ: 116,
      p1Spawn: { x: -1.6, y: 0, z: 116.5 },
      p2Spawn: { x: 1.6, y: 0, z: 116.5 },
    },
  ],
  platforms: [
    // Stage 1
    { id: 's1-wood-deck', surface: 'wood', box: box(-4.6, 4.6, -0.6, 0, -1.5, 29.5) },
    // Stage 2
    { id: 's2-wood-landing', surface: 'wood', box: box(-4.6, 4.6, -0.6, 0, 27.5, 30.5) },
    { id: 's2-ice-runway', surface: 'ice', box: box(-4.2, 4.2, -0.6, 0, 30.5, 55.0) },
    // Stage 3
    { id: 's3-wood-bridge', surface: 'wood', box: box(-4.4, 4.4, -0.6, 0, 55.0, 86.5) },
    // Stage 4
    { id: 's4-start-landing', surface: 'wood', box: box(-4.4, 4.4, -0.6, 0, 85.5, 89.5) },
    { id: 's4-catwalk-left', surface: 'wood', box: box(-3.6, 2.2, -0.6, 0, 105.6, 111.2) },
    { id: 's4-catwalk-right', surface: 'wood', box: box(-2.2, 3.6, -0.6, 0, 110.4, 116.5) },
    // Stage 5
    { id: 's5-runway', surface: 'wood', box: box(-4.4, 4.4, -0.6, 0, 115.5, 131.0) },
    { id: 's5-finish-deck', surface: 'wood', box: box(-4.8, 4.8, -0.6, 0, 132.3, 144.0) },
  ],
  movingPlatforms: [
    {
      id: 's4-mover-1',
      surface: 'wood',
      baseBox: box(-3.2, 3.2, -0.6, 0, 90.6, 94.6),
      axis: 'x',
      amplitude: 1.7,
      speed: 1.1,
      phase: 0,
    },
    {
      id: 's4-mover-2',
      surface: 'wood',
      baseBox: box(-3.2, 3.2, -0.6, 0, 95.7, 99.7),
      axis: 'x',
      amplitude: 1.7,
      speed: 1.1,
      phase: Math.PI,
    },
    {
      id: 's4-mover-3',
      surface: 'wood',
      baseBox: box(-3.2, 3.2, -0.6, 0, 100.8, 104.8),
      axis: 'x',
      amplitude: 1.7,
      speed: 1.1,
      phase: Math.PI * 0.5,
    },
  ],
  barriers: [
    // Stage 1
    {
      id: 's1-low-gap-1',
      kind: 'lowGap',
      box: box(-4.6, 4.6, 0.95, 2.6, 7.0, 7.6),
      damage: 1,
      blocksPlayers: false,
    },
    {
      id: 's1-high-wall-1',
      kind: 'highWall',
      box: box(-1.1, 1.1, 0, 1.25, 12.0, 12.6),
      damage: 1,
      blocksPlayers: true,
    },
    {
      id: 's1-low-gap-2',
      kind: 'lowGap',
      box: box(-4.6, 4.6, 0.95, 2.6, 17.0, 17.6),
      damage: 1,
      blocksPlayers: false,
    },
    {
      id: 's1-gate-left',
      kind: 'wall',
      box: box(-4.6, -1.1, 0, 2.6, 22.0, 23.0),
      damage: 1,
      blocksPlayers: true,
    },
    {
      id: 's1-gate-right',
      kind: 'wall',
      box: box(1.1, 4.6, 0, 2.6, 22.0, 23.0),
      damage: 1,
      blocksPlayers: true,
    },
    // Stage 2 edge bumper pillars
    {
      id: 's2-pillar-1',
      kind: 'pillar',
      box: box(3.4, 4.1, 0, 2.0, 36.0, 36.8),
      damage: 1,
      blocksPlayers: true,
    },
    {
      id: 's2-pillar-2',
      kind: 'pillar',
      box: box(-4.1, -3.4, 0, 2.0, 40.0, 40.8),
      damage: 1,
      blocksPlayers: true,
    },
    {
      id: 's2-pillar-3',
      kind: 'pillar',
      box: box(-4.1, -3.4, 0, 2.0, 47.0, 47.8),
      damage: 1,
      blocksPlayers: true,
    },
    {
      id: 's2-pillar-4',
      kind: 'pillar',
      box: box(3.4, 4.1, 0, 2.0, 51.0, 51.8),
      damage: 1,
      blocksPlayers: true,
    },
    // Stage 4 decorative lantern pillars
    {
      id: 's4-lantern-1',
      kind: 'pillar',
      box: box(1.6, 2.2, 0, 2.0, 108.0, 108.6),
      damage: 1,
      blocksPlayers: true,
    },
    {
      id: 's4-lantern-2',
      kind: 'pillar',
      box: box(-2.2, -1.6, 0, 2.0, 113.0, 113.6),
      damage: 1,
      blocksPlayers: true,
    },
    // Stage 5
    {
      id: 's5-moving-low-gap',
      kind: 'lowGap',
      box: box(-4.4, 4.4, 0.95, 2.6, 122.0, 122.6),
      damage: 1,
      blocksPlayers: false,
      moveAxis: 'z',
      moveAmplitude: 1.4,
      moveSpeed: 1.1,
      movePhase: 0,
    },
    {
      id: 's5-high-wall',
      kind: 'highWall',
      box: box(-1.1, 1.1, 0, 1.25, 127.5, 128.1),
      damage: 1,
      blocksPlayers: true,
    },
  ],
  windZones: [
    {
      id: 's2-wind-1',
      box: box(-4.2, 4.2, 0, 3.0, 33.0, 42.0),
      forceX: 9.5,
      periodSec: 5.5,
      warnDurationSec: 1.5,
      activeDurationSec: 2.2,
      phaseOffsetSec: 0,
    },
    {
      id: 's2-wind-2',
      box: box(-4.2, 4.2, 0, 3.0, 44.0, 53.0),
      forceX: -9.5,
      periodSec: 5.5,
      warnDurationSec: 1.5,
      activeDurationSec: 2.2,
      phaseOffsetSec: 2.75,
    },
    {
      id: 's5-wind-3',
      box: box(-4.4, 4.4, 0, 3.0, 124.0, 130.5),
      forceX: 6.5,
      periodSec: 5.0,
      warnDurationSec: 1.5,
      activeDurationSec: 1.8,
      phaseOffsetSec: 1.0,
    },
  ],
  pendulums: [
    {
      id: 's3-pendulum-1',
      pivotX: 0,
      pivotY: 5.4,
      pivotZ: 63.0,
      armLength: 4.1,
      maxAngleRad: 0.78,
      speed: 1.75,
      phase: 0,
      bobRadius: 0.62,
      damage: 2,
    },
    {
      id: 's3-pendulum-2',
      pivotX: 0,
      pivotY: 5.4,
      pivotZ: 70.5,
      armLength: 4.1,
      maxAngleRad: 0.78,
      speed: 1.75,
      phase: Math.PI,
      bobRadius: 0.62,
      damage: 2,
    },
  ],
  spinners: [
    {
      id: 's3-spinner-1',
      centerX: 0,
      centerY: 0.65,
      centerZ: 79.0,
      halfLength: 3.2,
      halfHeight: 0.28,
      halfThickness: 0.22,
      angularSpeed: 1.15,
      phase: 0,
      damage: 2,
    },
  ],
};

/** Evaluates all static and time-dependent course obstacles deterministically at `matchTime`. */
export function evaluateDynamicObstacles(
  course: CourseDef,
  matchTime: number,
): EvaluatedCourseObstacles {
  const platforms: EvaluatedPlatform[] = course.platforms.map((p) => ({
    id: p.id,
    surface: p.surface,
    box: p.box,
    vx: 0,
    vz: 0,
  }));

  for (const p of course.movingPlatforms) {
    const theta = matchTime * p.speed + p.phase;
    const offset = Math.sin(theta) * p.amplitude;
    const vel = Math.cos(theta) * p.amplitude * p.speed;
    platforms.push({
      id: p.id,
      surface: p.surface,
      box: shiftBox(p.baseBox, p.axis, offset),
      vx: p.axis === 'x' ? vel : 0,
      vz: p.axis === 'z' ? vel : 0,
    });
  }

  const barriers: EvaluatedBarrier[] = course.barriers.map((b) => {
    const evaluatedBox =
      b.moveAxis !== undefined &&
      b.moveAmplitude !== undefined &&
      b.moveSpeed !== undefined
        ? shiftBox(
            b.box,
            b.moveAxis,
            Math.sin(matchTime * b.moveSpeed + (b.movePhase ?? 0)) * b.moveAmplitude,
          )
        : b.box;
    return {
      id: b.id,
      kind: b.kind,
      box: evaluatedBox,
      damage: b.damage,
      blocksPlayers: b.blocksPlayers,
    };
  });

  const windZones: EvaluatedWindZone[] = course.windZones.map((w) => {
    const cycle =
      (((matchTime + w.phaseOffsetSec) % w.periodSec) + w.periodSec) % w.periodSec;
    let state: 'idle' | 'warning' | 'blowing' = 'idle';
    let intensity = 0;

    if (cycle < w.warnDurationSec) {
      state = 'warning';
      intensity = 0.25 + 0.25 * (cycle / w.warnDurationSec);
    } else if (cycle < w.warnDurationSec + w.activeDurationSec) {
      state = 'blowing';
      intensity = 1;
    }

    return {
      id: w.id,
      box: w.box,
      forceX: w.forceX,
      state,
      intensity,
    };
  });

  const pendulums: EvaluatedPendulum[] = course.pendulums.map((p) => {
    const angle = Math.sin(matchTime * p.speed + p.phase) * p.maxAngleRad;
    return {
      id: p.id,
      pivotX: p.pivotX,
      pivotY: p.pivotY,
      pivotZ: p.pivotZ,
      angle,
      bobX: p.pivotX + Math.sin(angle) * p.armLength,
      bobY: p.pivotY - Math.cos(angle) * p.armLength,
      bobZ: p.pivotZ,
      bobRadius: p.bobRadius,
      damage: p.damage,
    };
  });

  const spinners: EvaluatedSpinner[] = course.spinners.map((s) => ({
    id: s.id,
    centerX: s.centerX,
    centerY: s.centerY,
    centerZ: s.centerZ,
    angle: matchTime * s.angularSpeed + s.phase,
    halfLength: s.halfLength,
    halfHeight: s.halfHeight,
    halfThickness: s.halfThickness,
    damage: s.damage,
  }));

  return {
    platforms,
    barriers,
    windZones,
    pendulums,
    spinners,
  };
}

/** Returns the 1-based stage number (1..5) corresponding to longitudinal coordinate `z`. */
export function getStageNumberForZ(course: CourseDef, z: number): number {
  for (const stage of course.stages) {
    if (z < stage.endZ) return stage.number;
  }
  return course.stages[course.stages.length - 1]?.number ?? 1;
}
