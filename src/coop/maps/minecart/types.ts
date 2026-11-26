import type { PlayerInput, PlayerSlot } from '../../../glass/sim/types.ts';

export type { PlayerInput, PlayerSlot };

export type MinecartLane = 0 | 1 | 2;

export type MinecartSimEventKind =
  | 'cart_pump'
  | 'cart_lane'
  | 'cart_jump'
  | 'cart_hit'
  | 'cart_derail'
  | 'checkpoint'
  | 'respawn'
  | 'course_clear';

export type MinecartSimEvent = {
  id: number;
  kind: MinecartSimEventKind;
  x: number;
  y: number;
  z: number;
  checkpointIndex?: number;
};

export type MinecartBlockerDef = {
  id: string;
  lane: MinecartLane;
  z: number;
  halfDepth: number;
};

export type MinecartBeamDef = {
  id: string;
  lanes: readonly MinecartLane[];
  z: number;
  halfDepth: number;
};

export type MinecartGapDef = {
  id: string;
  startZ: number;
  endZ: number;
};

export type MinecartSweeperDef = {
  id: string;
  z: number;
  speed: number;
  phase: number;
  halfWidth: number;
  halfDepth: number;
};

export type MinecartRockfallDef = {
  id: string;
  lane: MinecartLane;
  z: number;
  periodSec: number;
  warnSec: number;
  activeSec: number;
  phaseOffsetSec: number;
};

export type MinecartCheckpointDef = {
  index: number;
  stageNumber: number;
  stageName: string;
  triggerZ: number;
  spawnLane: MinecartLane;
  spawnZ: number;
};

export type MinecartCourseDef = {
  finishZ: number;
  laneX: readonly [number, number, number];
  stages: readonly {
    number: number;
    name: string;
    startZ: number;
    endZ: number;
  }[];
  checkpoints: readonly MinecartCheckpointDef[];
  blockers: readonly MinecartBlockerDef[];
  beams: readonly MinecartBeamDef[];
  gaps: readonly MinecartGapDef[];
  sweepers: readonly MinecartSweeperDef[];
  rockfalls: readonly MinecartRockfallDef[];
};

export type EvaluatedMinecartObstacles = {
  sweepers: {
    id: string;
    x: number;
    z: number;
    halfWidth: number;
    halfDepth: number;
  }[];
  rockfalls: {
    id: string;
    lane: MinecartLane;
    x: number;
    z: number;
    state: 'idle' | 'warning' | 'active';
    intensity: number;
  }[];
};

export type MinecartState = {
  lane: MinecartLane;
  x: number;
  y: number;
  z: number;
  vy: number;
  speed: number;
  hp: number;
  maxHp: number;
  invulnTimer: number;
  respawnTimer: number;
  pumpTurn: PlayerSlot;
  pumpTilt: number;
  p1PrevLiftUp: boolean;
  p2PrevLiftUp: boolean;
  laneHoldDir: -1 | 0 | 1;
  laneHoldTimer: number;
  laneCooldown: number;
  wobble: number;
  p1Ducking: boolean;
  p2Ducking: boolean;
  lastP1JumpAt: number;
  lastP2JumpAt: number;
  grounded: boolean;
};

export type MinecartSimState = {
  phase: 'playing' | 'finished';
  tick: number;
  matchTime: number;
  checkpointIndex: number;
  failures: number;
  cart: MinecartState;
  nextEventId: number;
  events: MinecartSimEvent[];
};

export type MinecartSnapshotPayload = {
  mapId: 'minecart_rails';
  matchId: string;
  tick: number;
  matchTime: number;
  phase: 'playing' | 'finished';
  checkpointIndex: number;
  failures: number;
  cart: {
    lane: MinecartLane;
    x: number;
    y: number;
    z: number;
    vy: number;
    speed: number;
    hp: number;
    invulnTimer: number;
    respawnTimer: number;
    pumpTurn: PlayerSlot;
    pumpTilt: number;
    wobble: number;
    p1Ducking: boolean;
    p2Ducking: boolean;
    grounded: boolean;
  };
  events: MinecartSimEvent[];
};
