import type {
  EvaluatedRaftObstacles,
  RaftCourseDef,
} from './types.ts';

export const RAFT_FINISH_Z = 160;
export const RAFT_RIVER_HALF_WIDTH = 6.5;
export const RAFT_RADIUS = 1.25;
export const RAFT_MAX_HP = 3;
export const RAFT_STROKE_COOLDOWN = 0.35;
export const RAFT_SYNC_WINDOW_SEC = 0.25;
export const RAFT_JUMP_SYNC_WINDOW_SEC = 0.30;
export const RAFT_BOOST_DURATION = 1.1;
export const RAFT_INVULN_SEC = 0.8;
export const RAFT_RESPAWN_SEC = 1.1;

export const RAFT_COURSE: RaftCourseDef = {
  finishZ: RAFT_FINISH_Z,
  riverHalfWidth: RAFT_RIVER_HALF_WIDTH,
  stages: [
    { number: 1, name: 'Thượng Nguồn Êm Ả', startZ: 0, endZ: 32 },
    { number: 2, name: 'Khúc Gỗ Trôi', startZ: 32, endZ: 64 },
    { number: 3, name: 'Xoáy Nước Đôi', startZ: 64, endZ: 96 },
    { number: 4, name: 'Thác Ghềnh Chia Đôi', startZ: 96, endZ: 128 },
    { number: 5, name: 'Vịnh Đích Hải Đăng', startZ: 128, endZ: RAFT_FINISH_Z },
  ],
  checkpoints: [
    {
      index: 0,
      stageNumber: 1,
      stageName: 'Thượng Nguồn Êm Ả',
      triggerZ: 0,
      spawnX: 0,
      spawnZ: 0,
    },
    {
      index: 1,
      stageNumber: 2,
      stageName: 'Khúc Gỗ Trôi',
      triggerZ: 32,
      spawnX: 0,
      spawnZ: 32,
    },
    {
      index: 2,
      stageNumber: 3,
      stageName: 'Xoáy Nước Đôi',
      triggerZ: 64,
      spawnX: 0,
      spawnZ: 64,
    },
    {
      index: 3,
      stageNumber: 4,
      stageName: 'Thác Ghềnh Chia Đôi',
      triggerZ: 96,
      spawnX: 0,
      spawnZ: 96,
    },
    {
      index: 4,
      stageNumber: 5,
      stageName: 'Vịnh Đích Hải Đăng',
      triggerZ: 128,
      spawnX: 0,
      spawnZ: 128,
    },
  ],
  rocks: [
    // Stage 1: gentle slalom
    { id: 'rock-s1-1', x: -2.4, z: 11, radius: 1.0 },
    { id: 'rock-s1-2', x: 2.6, z: 19, radius: 1.1 },
    { id: 'rock-s1-3', x: -0.8, z: 26, radius: 0.95 },

    // Stage 2: side rocks framing drifting logs
    { id: 'rock-s2-1', x: 3.8, z: 46, radius: 1.0 },
    { id: 'rock-s2-2', x: -4.0, z: 55, radius: 1.05 },

    // Stage 3: flanking rocks around dual whirlpools
    { id: 'rock-s3-1', x: 3.9, z: 72, radius: 1.1 },
    { id: 'rock-s3-2', x: -3.8, z: 81, radius: 1.1 },
    { id: 'rock-s3-3', x: 0.0, z: 90, radius: 0.95 },

    // Stage 4: split rapids (central divider boulders)
    { id: 'rock-s4-1', x: 0.0, z: 104, radius: 1.35 },
    { id: 'rock-s4-2', x: -0.4, z: 112, radius: 1.25 },
    { id: 'rock-s4-3', x: 4.6, z: 112, radius: 0.95 },
    { id: 'rock-s4-4', x: 0.5, z: 121, radius: 1.3 },
    { id: 'rock-s4-5', x: -4.6, z: 121, radius: 0.95 },

    // Stage 5: final bay hazards
    { id: 'rock-s5-1', x: 3.2, z: 135, radius: 1.1 },
    { id: 'rock-s5-2', x: -3.4, z: 146, radius: 1.1 },
    { id: 'rock-s5-3', x: 2.4, z: 154, radius: 1.0 },
  ],
  logs: [
    // Floating logs: radius = 0.42 (water surface y = 0, top around y = 0.75)
    {
      id: 'log-s2-1',
      baseX: 0,
      z: 41,
      halfLength: 2.6,
      radius: 0.42,
      moveAmpX: 2.0,
      moveSpeed: 1.2,
      phase: 0,
    },
    {
      id: 'log-s2-2',
      baseX: -1.0,
      z: 51,
      halfLength: 2.5,
      radius: 0.42,
      moveAmpX: 2.1,
      moveSpeed: 1.4,
      phase: 1.6,
    },
    {
      id: 'log-s2-3',
      baseX: 1.0,
      z: 58,
      halfLength: 2.7,
      radius: 0.42,
      moveAmpX: 1.9,
      moveSpeed: 1.5,
      phase: 3.1,
    },
    {
      id: 'log-s4-1',
      baseX: 0,
      z: 117,
      halfLength: 2.7,
      radius: 0.42,
      moveAmpX: 1.8,
      moveSpeed: 1.7,
      phase: 0.8,
    },
    {
      id: 'log-s5-1',
      baseX: 0.2,
      z: 149,
      halfLength: 2.6,
      radius: 0.42,
      moveAmpX: 2.1,
      moveSpeed: 1.8,
      phase: 2.2,
    },
  ],
  whirlpools: [
    // Stage 3: Xoáy Nước Đôi
    {
      id: 'wp-s3-1',
      x: -2.3,
      z: 75,
      radius: 3.6,
      pullStrength: 4.8,
      spinDir: 1,
    },
    {
      id: 'wp-s3-2',
      x: 2.3,
      z: 86,
      radius: 3.8,
      pullStrength: 5.2,
      spinDir: -1,
    },
    // Stage 5: Vịnh Đích Hải Đăng
    {
      id: 'wp-s5-1',
      x: -1.6,
      z: 140,
      radius: 3.5,
      pullStrength: 5.4,
      spinDir: 1,
    },
  ],
  currentZones: [
    {
      id: 'current-s4-rapids',
      minZ: 96,
      maxZ: 128,
      currentZ: 4.2,
    },
  ],
};

/** Returns the 1-based stage number containing downstream coordinate `z`. */
export function getRaftStageNumberForZ(
  course: RaftCourseDef,
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

/** Deterministically evaluates animated log positions and whirlpool angles at `matchTime`. */
export function evaluateRaftObstacles(
  course: RaftCourseDef,
  matchTime: number,
): EvaluatedRaftObstacles {
  const logs = course.logs.map((log) => ({
    id: log.id,
    x: log.baseX + Math.sin(matchTime * log.moveSpeed + log.phase) * log.moveAmpX,
    z: log.z,
    halfLength: log.halfLength,
    radius: log.radius,
  }));

  const whirlpools = course.whirlpools.map((wp) => ({
    id: wp.id,
    x: wp.x,
    z: wp.z,
    radius: wp.radius,
    pullStrength: wp.pullStrength,
    spinDir: wp.spinDir,
    angle: matchTime * 2.2 * wp.spinDir,
  }));

  return { logs, whirlpools };
}
