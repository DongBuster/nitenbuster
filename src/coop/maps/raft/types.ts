import type { PlayerInput } from '../../../glass/sim/types.ts';

export type { PlayerInput };

export type RaftSimEventKind =
  | 'paddle_p1'
  | 'paddle_p2'
  | 'raft_boost'
  | 'raft_jump'
  | 'raft_hit'
  | 'raft_capsize'
  | 'checkpoint'
  | 'respawn'
  | 'course_clear';

export type RaftSimEvent = {
  id: number;
  kind: RaftSimEventKind;
  x: number;
  y: number;
  z: number;
  checkpointIndex?: number;
};

export type RaftRockDef = {
  id: string;
  x: number;
  z: number;
  radius: number;
};

export type RaftLogDef = {
  id: string;
  baseX: number;
  z: number;
  halfLength: number;
  radius: number;
  moveAmpX: number;
  moveSpeed: number;
  phase: number;
};

export type RaftWhirlpoolDef = {
  id: string;
  x: number;
  z: number;
  radius: number;
  pullStrength: number;
  spinDir: 1 | -1;
};

export type RaftCurrentZoneDef = {
  id: string;
  minZ: number;
  maxZ: number;
  currentZ: number;
};

export type RaftCheckpointDef = {
  index: number;
  stageNumber: number;
  stageName: string;
  triggerZ: number;
  spawnX: number;
  spawnZ: number;
};

export type RaftCourseDef = {
  finishZ: number;
  riverHalfWidth: number;
  stages: readonly {
    number: number;
    name: string;
    startZ: number;
    endZ: number;
  }[];
  checkpoints: readonly RaftCheckpointDef[];
  rocks: readonly RaftRockDef[];
  logs: readonly RaftLogDef[];
  whirlpools: readonly RaftWhirlpoolDef[];
  currentZones: readonly RaftCurrentZoneDef[];
};

export type EvaluatedRaftObstacles = {
  logs: {
    id: string;
    x: number;
    z: number;
    halfLength: number;
    radius: number;
  }[];
  whirlpools: {
    id: string;
    x: number;
    z: number;
    radius: number;
    pullStrength: number;
    spinDir: 1 | -1;
    angle: number;
  }[];
};

export type RaftState = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  angularVel: number;
  hp: number;
  maxHp: number;
  invulnTimer: number;
  respawnTimer: number;
  boostTimer: number;
  p1StrokeCd: number;
  p2StrokeCd: number;
  p1StrokeAnim: number;
  p2StrokeAnim: number;
  lastP1StrokeAt: number;
  lastP2StrokeAt: number;
  lastP1JumpAt: number;
  lastP2JumpAt: number;
  p1LeanX: number;
  p2LeanX: number;
  inWhirlpool: boolean;
};

export type RaftSimState = {
  phase: 'playing' | 'finished';
  tick: number;
  matchTime: number;
  checkpointIndex: number;
  failures: number;
  raft: RaftState;
  nextEventId: number;
  events: RaftSimEvent[];
};

export type RaftSnapshotPayload = {
  mapId: 'raft_rapids';
  matchId: string;
  tick: number;
  matchTime: number;
  phase: 'playing' | 'finished';
  checkpointIndex: number;
  failures: number;
  raft: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    yaw: number;
    hp: number;
    invulnTimer: number;
    respawnTimer: number;
    boostTimer: number;
    p1StrokeAnim: number;
    p2StrokeAnim: number;
    p1LeanX: number;
    p2LeanX: number;
    inWhirlpool: boolean;
  };
  events: RaftSimEvent[];
};
