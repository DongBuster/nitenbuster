import type {
  Aabb3,
  EvaluatedPendulum,
  EvaluatedWindZone,
  PendulumDef,
  PlayerInput,
  PlayerSlot,
  SurfaceKind,
  WindZoneDef,
} from '../../../glass/sim/types.ts';

export type {
  Aabb3,
  EvaluatedPendulum,
  EvaluatedWindZone,
  PendulumDef,
  PlayerInput,
  PlayerSlot,
  SurfaceKind,
  WindZoneDef,
};

export type RopeSimEventKind =
  | 'rope_anchor'
  | 'rope_pull'
  | 'rope_snap'
  | 'checkpoint'
  | 'respawn'
  | 'course_clear';

export type RopeSimEvent = {
  id: number;
  kind: RopeSimEventKind;
  x: number;
  y: number;
  z: number;
  checkpointIndex?: number;
};

export type RopeIslandDef = {
  id: string;
  surface: SurfaceKind;
  box: Aabb3;
};

export type RopeMovingIslandDef = {
  id: string;
  surface: SurfaceKind;
  baseBox: Aabb3;
  axis: 'x' | 'y' | 'z';
  amplitude: number;
  speed: number;
  phase: number;
};

export type RopeCheckpointDef = {
  index: number;
  stageNumber: number;
  stageName: string;
  triggerZ: number;
  p1Spawn: { x: number; y: number; z: number };
  p2Spawn: { x: number; y: number; z: number };
};

export type RopeCourseDef = {
  finishZ: number;
  stages: readonly {
    number: number;
    name: string;
    startZ: number;
    endZ: number;
  }[];
  checkpoints: readonly RopeCheckpointDef[];
  islands: readonly RopeIslandDef[];
  movingIslands: readonly RopeMovingIslandDef[];
  windZones: readonly WindZoneDef[];
  pendulums: readonly PendulumDef[];
};

export type EvaluatedRopeIsland = {
  id: string;
  surface: SurfaceKind;
  box: Aabb3;
  vx: number;
  vy: number;
  vz: number;
};

export type EvaluatedRopeCourse = {
  islands: EvaluatedRopeIsland[];
  windZones: EvaluatedWindZone[];
  pendulums: EvaluatedPendulum[];
};

export type RopePlayerState = {
  slot: PlayerSlot;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  grounded: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  pendulumInvulnTimer: number;
  anchored: boolean;
  reeling: boolean;
  hanging: boolean;
  onIce: boolean;
  inWind: boolean;
};

export type RopeSimState = {
  phase: 'playing' | 'finished';
  tick: number;
  matchTime: number;
  checkpointIndex: number;
  failures: number;
  p1: RopePlayerState;
  p2: RopePlayerState;
  ropeLength: number;
  effectiveMaxLen: number;
  ropeStrain: number;
  respawnTimer: number;
  nextEventId: number;
  events: RopeSimEvent[];
};

export type RopeSnapshotPlayer = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  grounded: boolean;
  anchored: boolean;
  reeling: boolean;
  hanging: boolean;
};

export type RopeSnapshotPayload = {
  mapId: 'rope_tether';
  matchId: string;
  tick: number;
  matchTime: number;
  phase: 'playing' | 'finished';
  checkpointIndex: number;
  failures: number;
  p1: RopeSnapshotPlayer;
  p2: RopeSnapshotPlayer;
  ropeLength: number;
  ropeStrain: number;
  respawnTimer: number;
  events: RopeSimEvent[];
};
