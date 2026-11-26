import type {
  EvaluatedMinecartObstacles,
  MinecartCourseDef,
} from './types.ts';

export const MINECART_FINISH_Z = 180;
export const MINECART_LANE_X = [3.2, 0, -3.2] as const;
export const MINECART_MAX_HP = 3;
export const MINECART_BASE_SPEED = 4.2;
export const MINECART_MIN_SPEED = 3.5;
export const MINECART_MAX_SPEED = 13.5;
export const MINECART_PUMP_BOOST = 2.8;
export const MINECART_SPEED_DECAY = 1.65;
export const MINECART_JUMP_VEL = 8.8;
export const MINECART_GRAVITY = -22;
export const MINECART_JUMP_SYNC_WINDOW = 0.30;
export const MINECART_LANE_HOLD_SEC = 0.10;
export const MINECART_LANE_COOLDOWN_SEC = 0.32;
export const MINECART_INVULN_SEC = 0.8;
export const MINECART_RESPAWN_SEC = 1.1;
export const MINECART_FALL_LIMIT_Y = -4;

const SWEEPER_SWING_HALF_RANGE = 3.4;

export const MINECART_COURSE: MinecartCourseDef = {
  finishZ: MINECART_FINISH_Z,
  laneX: MINECART_LANE_X,
  stages: [
    { number: 1, name: 'Hầm Mỏ Khởi Hành', startZ: 0, endZ: 36 },
    { number: 2, name: 'Đoạn Xà Gỗ Thấp', startZ: 36, endZ: 72 },
    { number: 3, name: 'Cầu Ray Gãy', startZ: 72, endZ: 108 },
    { number: 4, name: 'Ray Đá Lở & Cột Xoay', startZ: 108, endZ: 144 },
    { number: 5, name: 'Đoạn Tăng Tốc Về Ga Đích', startZ: 144, endZ: MINECART_FINISH_Z },
  ],
  checkpoints: [
    {
      index: 0,
      stageNumber: 1,
      stageName: 'Hầm Mỏ Khởi Hành',
      triggerZ: 0,
      spawnLane: 1,
      spawnZ: 0,
    },
    {
      index: 1,
      stageNumber: 2,
      stageName: 'Đoạn Xà Gỗ Thấp',
      triggerZ: 36,
      spawnLane: 1,
      spawnZ: 36,
    },
    {
      index: 2,
      stageNumber: 3,
      stageName: 'Cầu Ray Gãy',
      triggerZ: 72,
      spawnLane: 1,
      spawnZ: 72,
    },
    {
      index: 3,
      stageNumber: 4,
      stageName: 'Ray Đá Lở & Cột Xoay',
      triggerZ: 108,
      spawnLane: 1,
      spawnZ: 108,
    },
    {
      index: 4,
      stageNumber: 5,
      stageName: 'Đoạn Tăng Tốc Về Ga Đích',
      triggerZ: 144,
      spawnLane: 1,
      spawnZ: 144,
    },
  ],
  blockers: [
    // Stage 1: lane-switching intro
    { id: 'blk-s1-1', lane: 1, z: 12, halfDepth: 0.7 },
    { id: 'blk-s1-2', lane: 0, z: 21, halfDepth: 0.7 },
    { id: 'blk-s1-3', lane: 0, z: 30, halfDepth: 0.7 },
    { id: 'blk-s1-4', lane: 2, z: 30, halfDepth: 0.7 },

    // Stage 2: blockers paired with low overhead beams
    { id: 'blk-s2-1', lane: 1, z: 48, halfDepth: 0.7 },
    { id: 'blk-s2-2', lane: 2, z: 62, halfDepth: 0.7 },

    // Stage 4: slalom between sweepers & rockfalls
    { id: 'blk-s4-1', lane: 0, z: 114, halfDepth: 0.7 },
    { id: 'blk-s4-2', lane: 2, z: 130, halfDepth: 0.7 },

    // Stage 5: high-speed sprint blockers away from final gap (166..170.8)
    { id: 'blk-s5-1', lane: 1, z: 150, halfDepth: 0.7 },
    { id: 'blk-s5-2', lane: 0, z: 158, halfDepth: 0.7 },
    { id: 'blk-s5-3', lane: 2, z: 175, halfDepth: 0.7 },
  ],
  beams: [
    // Stage 2: Đoạn Xà Gỗ Thấp
    { id: 'beam-s2-1', lanes: [0, 1, 2], z: 42, halfDepth: 0.5 },
    { id: 'beam-s2-2', lanes: [0, 2], z: 54, halfDepth: 0.5 },
    { id: 'beam-s2-3', lanes: [0, 1, 2], z: 66, halfDepth: 0.5 },

    // Stage 5: Đoạn Tăng Tốc Về Ga Đích
    { id: 'beam-s5-1', lanes: [0, 1, 2], z: 154, halfDepth: 0.5 },
    { id: 'beam-s5-2', lanes: [0, 1, 2], z: 162, halfDepth: 0.5 },
  ],
  gaps: [
    // Stage 3: Cầu Ray Gãy (three 4.8m broken-rail chasms)
    { id: 'gap-s3-1', startZ: 79, endZ: 83.8 },
    { id: 'gap-s3-2', startZ: 91, endZ: 95.8 },
    { id: 'gap-s3-3', startZ: 101, endZ: 105.8 },

    // Stage 5: final 4.8m jump
    { id: 'gap-s5-1', startZ: 166, endZ: 170.8 },
  ],
  sweepers: [
    // Stage 4: 2 cross-lane sweepers
    {
      id: 'sw-s4-1',
      z: 118,
      speed: 1.5,
      phase: 0,
      halfWidth: 0.85,
      halfDepth: 0.45,
    },
    {
      id: 'sw-s4-2',
      z: 136,
      speed: 1.85,
      phase: 1.7,
      halfWidth: 0.85,
      halfDepth: 0.45,
    },
  ],
  rockfalls: [
    // Stage 4: 3 telegraphed rockfalls
    {
      id: 'rf-s4-1',
      lane: 1,
      z: 123,
      periodSec: 4.5,
      warnSec: 1.4,
      activeSec: 1.3,
      phaseOffsetSec: 0,
    },
    {
      id: 'rf-s4-2',
      lane: 0,
      z: 128,
      periodSec: 4.5,
      warnSec: 1.4,
      activeSec: 1.3,
      phaseOffsetSec: 1.5,
    },
    {
      id: 'rf-s4-3',
      lane: 2,
      z: 140,
      periodSec: 4.2,
      warnSec: 1.3,
      activeSec: 1.3,
      phaseOffsetSec: 2.8,
    },
  ],
};

/** Returns the 1-based stage number containing longitudinal coordinate `z`. */
export function getMinecartStageNumberForZ(
  course: MinecartCourseDef,
  z: number,
): number {
  for (let i = course.stages.length - 1; i >= 0; i -= 1) {
    const stage = course.stages[i];
    if (z >= stage.startZ) {
      return stage.number;
    }
  }
  return course.stages[0]?.number ?? 1;
}

/** Deterministically evaluates animated sweepers and telegraphed rockfalls at `matchTime`. */
export function evaluateMinecartObstacles(
  course: MinecartCourseDef,
  matchTime: number,
): EvaluatedMinecartObstacles {
  const sweepers = course.sweepers.map((sw) => ({
    id: sw.id,
    x: Math.sin(matchTime * sw.speed + sw.phase) * SWEEPER_SWING_HALF_RANGE,
    z: sw.z,
    halfWidth: sw.halfWidth,
    halfDepth: sw.halfDepth,
  }));

  const rockfalls = course.rockfalls.map((rf) => {
    const cycle =
      (((matchTime + rf.phaseOffsetSec) % rf.periodSec) + rf.periodSec) %
      rf.periodSec;
    let state: 'idle' | 'warning' | 'active' = 'idle';
    let intensity = 0;

    if (cycle < rf.warnSec) {
      state = 'warning';
      intensity = 0.25 + 0.35 * (cycle / rf.warnSec);
    } else if (cycle < rf.warnSec + rf.activeSec) {
      state = 'active';
      intensity = 1;
    }

    return {
      id: rf.id,
      lane: rf.lane,
      x: course.laneX[rf.lane],
      z: rf.z,
      state,
      intensity,
    };
  });

  return { sweepers, rockfalls };
}
