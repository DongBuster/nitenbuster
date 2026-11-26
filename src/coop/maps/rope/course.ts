import type {
  Aabb3,
  EvaluatedPendulum,
  EvaluatedRopeCourse,
  EvaluatedRopeIsland,
  EvaluatedWindZone,
  RopeCourseDef,
} from './types.ts';

export const ROPE_FINISH_Z = 135;
export const ROPE_MAX_LEN = 4.5;
export const ROPE_REEL_MIN_LEN = 1.2;
export const ROPE_REEL_SPEED = 3.4;
export const ROPE_FALL_LIMIT_Y = -6;
export const ROPE_RESPAWN_SEC = 1.2;
export const ROPE_GRAVITY = -20;
export const ROPE_JUMP_VEL = 7.8;
export const ROPE_MAX_SPEED = 5.4;

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

function shiftBox(source: Aabb3, axis: 'x' | 'y' | 'z', offset: number): Aabb3 {
  if (offset === 0) return source;
  if (axis === 'x') {
    return {
      ...source,
      minX: source.minX + offset,
      maxX: source.maxX + offset,
    };
  }
  if (axis === 'y') {
    return {
      ...source,
      minY: source.minY + offset,
      maxY: source.maxY + offset,
    };
  }
  return {
    ...source,
    minZ: source.minZ + offset,
    maxZ: source.maxZ + offset,
  };
}

/** Deterministic 5-stage ascending snow/ice island course for Rope Tether Co-op (`z = 0..135`). */
export const ROPE_COURSE: RopeCourseDef = {
  finishZ: ROPE_FINISH_Z,
  stages: [
    { number: 1, name: 'Bậc Đá Khởi Động', startZ: 0, endZ: 27 },
    { number: 2, name: 'Sàn Băng Nghiêng & Gió Hất', startZ: 27, endZ: 54 },
    { number: 3, name: 'Chuỗi Đảo Bập Bênh', startZ: 54, endZ: 81 },
    { number: 4, name: 'Vực Đu Dây', startZ: 81, endZ: 108 },
    { number: 5, name: 'Đỉnh Tháp Đèn Lồng', startZ: 108, endZ: ROPE_FINISH_Z },
  ],
  checkpoints: [
    {
      index: 0,
      stageNumber: 1,
      stageName: 'Bậc Đá Khởi Động',
      triggerZ: 0,
      p1Spawn: { x: -1.2, y: 0, z: 0.5 },
      p2Spawn: { x: 1.2, y: 0, z: 0.5 },
    },
    {
      index: 1,
      stageNumber: 2,
      stageName: 'Sàn Băng Nghiêng & Gió Hất',
      triggerZ: 27,
      p1Spawn: { x: -1.2, y: 0.8, z: 28.0 },
      p2Spawn: { x: 1.2, y: 0.8, z: 28.0 },
    },
    {
      index: 2,
      stageNumber: 3,
      stageName: 'Chuỗi Đảo Bập Bênh',
      triggerZ: 54,
      p1Spawn: { x: -1.2, y: 1.6, z: 55.0 },
      p2Spawn: { x: 1.2, y: 1.6, z: 55.0 },
    },
    {
      index: 3,
      stageNumber: 4,
      stageName: 'Vực Đu Dây',
      triggerZ: 81,
      p1Spawn: { x: -1.2, y: 2.6, z: 81.8 },
      p2Spawn: { x: 1.2, y: 2.6, z: 81.8 },
    },
    {
      index: 4,
      stageNumber: 5,
      stageName: 'Đỉnh Tháp Đèn Lồng',
      triggerZ: 108,
      p1Spawn: { x: -1.2, y: 3.2, z: 109.0 },
      p2Spawn: { x: 1.2, y: 3.2, z: 109.0 },
    },
  ],
  islands: [
    // Stage 1 (y = 0 -> 0.4)
    { id: 's1-start', surface: 'wood', box: box(-4.5, 4.5, -1.0, 0, -2.0, 10.0) },
    { id: 's1-mid', surface: 'wood', box: box(-3.6, 3.6, -1.0, 0, 12.2, 20.0) },
    { id: 's1-step', surface: 'wood', box: box(-3.8, 3.8, -0.6, 0.4, 21.8, 25.6) },

    // Stage 2 (y = 0.8)
    { id: 's2-cp', surface: 'wood', box: box(-4.4, 4.4, -0.2, 0.8, 26.8, 31.2) },
    { id: 's2-ice-1', surface: 'ice', box: box(-3.8, 3.8, -0.2, 0.8, 32.8, 41.5) },
    { id: 's2-ice-2', surface: 'ice', box: box(-3.8, 3.8, -0.2, 0.8, 43.3, 52.5) },

    // Stage 3 (y = 1.6)
    { id: 's3-cp', surface: 'wood', box: box(-4.4, 4.4, 0.6, 1.6, 53.8, 59.5) },
    { id: 's3-bridge-1', surface: 'wood', box: box(-3.6, 3.6, 0.6, 1.6, 61.3, 69.0) },
    { id: 's3-bridge-2', surface: 'wood', box: box(-3.6, 3.6, 0.6, 1.6, 70.8, 79.2) },

    // Stage 4 (y = 2.6)
    { id: 's4-cp', surface: 'wood', box: box(-4.4, 4.4, 1.6, 2.6, 80.5, 86.0) },
    { id: 's4-far', surface: 'wood', box: box(-3.8, 3.8, 1.6, 2.6, 102.0, 106.5) },

    // Stage 5: Ascending Lantern Peak (y = 3.2 -> 3.8 -> 4.5)
    { id: 's5-cp', surface: 'wood', box: box(-4.4, 4.4, 2.2, 3.2, 107.8, 115.0) },
    { id: 's5-step-mid', surface: 'wood', box: box(-4.0, 4.0, 2.8, 3.8, 116.8, 126.0) },
    { id: 's5-lantern-peak', surface: 'wood', box: box(-5.0, 5.0, 3.5, 4.5, 127.8, 141.0) },
  ],
  movingIslands: [
    {
      id: 's4-mover-1',
      surface: 'wood',
      baseBox: box(-3.0, 3.0, 1.6, 2.6, 88.0, 93.0),
      axis: 'x',
      amplitude: 1.8,
      speed: 1.1,
      phase: 0,
    },
    {
      id: 's4-mover-2',
      surface: 'ice',
      baseBox: box(-3.0, 3.0, 1.6, 2.6, 95.0, 100.2),
      axis: 'y',
      amplitude: 0.5,
      speed: 1.2,
      phase: Math.PI * 0.5,
    },
  ],
  windZones: [
    {
      id: 's2-wind-1',
      box: box(-4.2, 4.2, 0.6, 3.6, 33.5, 41.0),
      forceX: 9.0,
      periodSec: 5.5,
      warnDurationSec: 1.5,
      activeDurationSec: 2.2,
      phaseOffsetSec: 0,
    },
    {
      id: 's2-wind-2',
      box: box(-4.2, 4.2, 0.6, 3.6, 44.0, 51.8),
      forceX: -9.0,
      periodSec: 5.5,
      warnDurationSec: 1.5,
      activeDurationSec: 2.2,
      phaseOffsetSec: 2.75,
    },
  ],
  pendulums: [
    {
      id: 's3-pendulum-1',
      pivotX: 0,
      pivotY: 6.4,
      pivotZ: 65.0,
      armLength: 4.1,
      maxAngleRad: 0.78,
      speed: 1.75,
      phase: 0,
      bobRadius: 0.62,
      damage: 1,
    },
    {
      id: 's3-pendulum-2',
      pivotX: 0,
      pivotY: 6.4,
      pivotZ: 75.0,
      armLength: 4.1,
      maxAngleRad: 0.78,
      speed: 1.75,
      phase: Math.PI,
      bobRadius: 0.62,
      damage: 1,
    },
  ],
};

/** Evaluates all static islands, moving islands, wind zones, and pendulums deterministically at `matchTime`. */
export function evaluateRopeCourse(
  course: RopeCourseDef,
  matchTime: number,
): EvaluatedRopeCourse {
  const islands: EvaluatedRopeIsland[] = course.islands.map((isl) => ({
    id: isl.id,
    surface: isl.surface,
    box: isl.box,
    vx: 0,
    vy: 0,
    vz: 0,
  }));

  for (const m of course.movingIslands) {
    const theta = matchTime * m.speed + m.phase;
    const offset = Math.sin(theta) * m.amplitude;
    const vel = Math.cos(theta) * m.amplitude * m.speed;
    islands.push({
      id: m.id,
      surface: m.surface,
      box: shiftBox(m.baseBox, m.axis, offset),
      vx: m.axis === 'x' ? vel : 0,
      vy: m.axis === 'y' ? vel : 0,
      vz: m.axis === 'z' ? vel : 0,
    });
  }

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

  return { islands, windZones, pendulums };
}

/** Returns the 1-based stage number (1..5) corresponding to longitudinal coordinate `z`. */
export function getRopeStageNumberForZ(course: RopeCourseDef, z: number): number {
  for (let i = course.stages.length - 1; i >= 0; i -= 1) {
    const stage = course.stages[i];
    if (z >= stage.startZ) {
      return stage.number;
    }
  }
  return course.stages[0]?.number ?? 1;
}
