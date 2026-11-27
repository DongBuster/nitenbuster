export type PlayerSlot = 'p1' | 'p2';

export type LiftIntent = -1 | 0 | 1;

export type PlayerInput = {
  moveX: number;
  moveZ: number;
  jump: boolean;
  lift: LiftIntent;
};

export type PlayerSimState = {
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
  liftOffset: number;
  liftIntent: LiftIntent;
  onIce: boolean;
  inWind: boolean;
};

export type ShatterReason = 'impact' | 'stretch' | 'tilt' | 'fall';

export type GlassState = {
  hp: number;
  maxHp: number;
  stress: number;
  centerX: number;
  centerY: number;
  centerZ: number;
  yaw: number;
  pitch: number;
  length: number;
  invulnTimer: number;
  shatterTimer: number;
  shatterReason: ShatterReason | null;
  lastImpactX: number;
  lastImpactY: number;
  lastImpactZ: number;
};

export type SimEventKind =
  | 'glass_crack'
  | 'glass_shatter'
  | 'checkpoint'
  | 'respawn'
  | 'course_clear';

export type SimEvent = {
  id: number;
  kind: SimEventKind;
  x: number;
  y: number;
  z: number;
  checkpointIndex?: number;
  reason?: ShatterReason;
};

export type SurfaceKind = 'wood' | 'ice';

export interface GlassMapTheme {
  readonly id: 'cabin_bridge' | 'sky_scaffold' | 'candy_factory';
  readonly skyHex: string;
  readonly fogHex: string;
  readonly abyssHex: string;
  readonly deckPrimaryHex: string;
  readonly deckStripeHex: string;
  readonly curbHex: string;
  readonly hazardPrimaryHex: string;
  readonly hazardStripeHex: string;
  readonly lanternCoolHex: string;
  readonly lanternWarmHex: string;
  readonly ambientLightHex: string;
  readonly sunLightHex: string;
}

export interface FragilePlatformConfig {
  readonly fallDelaySec: number;
  readonly respawnDelaySec: number;
}

export interface FragilePlatformState {
  state: 'solid' | 'shaking' | 'gone';
  timer: number;
}

export type Aabb3 = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export type PlatformDef = {
  id: string;
  surface: SurfaceKind;
  box: Aabb3;
  conveyorVx?: number;
  conveyorVz?: number;
  fragile?: FragilePlatformConfig;
};

export type MovingPlatformDef = {
  id: string;
  surface: SurfaceKind;
  baseBox: Aabb3;
  axis: 'x' | 'y' | 'z';
  amplitude: number;
  speed: number;
  phase: number;
};

export type BarrierKind = 'lowGap' | 'highWall' | 'wall' | 'pillar';

export type BarrierDef = {
  id: string;
  kind: BarrierKind;
  box: Aabb3;
  damage: number;
  blocksPlayers: boolean;
  moveAxis?: 'x' | 'y' | 'z';
  moveAmplitude?: number;
  moveSpeed?: number;
  movePhase?: number;
};

export type WindZoneDef = {
  id: string;
  box: Aabb3;
  forceX: number;
  periodSec: number;
  warnDurationSec: number;
  activeDurationSec: number;
  phaseOffsetSec: number;
};

export type PendulumDef = {
  id: string;
  pivotX: number;
  pivotY: number;
  pivotZ: number;
  armLength: number;
  maxAngleRad: number;
  speed: number;
  phase: number;
  bobRadius: number;
  damage: number;
};

export type SpinnerDef = {
  id: string;
  centerX: number;
  centerY: number;
  centerZ: number;
  halfLength: number;
  halfHeight: number;
  halfThickness: number;
  angularSpeed: number;
  phase: number;
  damage: number;
};

export type CheckpointDef = {
  index: number;
  stageNumber: number;
  stageName: string;
  triggerZ: number;
  p1Spawn: { x: number; y: number; z: number };
  p2Spawn: { x: number; y: number; z: number };
};

export type CourseDef = {
  finishZ: number;
  theme?: GlassMapTheme;
  stages: readonly {
    number: number;
    name: string;
    startZ: number;
    endZ: number;
  }[];
  checkpoints: readonly CheckpointDef[];
  platforms: readonly PlatformDef[];
  movingPlatforms: readonly MovingPlatformDef[];
  barriers: readonly BarrierDef[];
  windZones: readonly WindZoneDef[];
  pendulums: readonly PendulumDef[];
  spinners: readonly SpinnerDef[];
};

export type EvaluatedPlatform = {
  id: string;
  surface: SurfaceKind;
  box: Aabb3;
  vx: number;
  vy?: number;
  vz: number;
  conveyorVx?: number;
  conveyorVz?: number;
  fragile?: FragilePlatformConfig;
};

export type EvaluatedBarrier = {
  id: string;
  kind: BarrierKind;
  box: Aabb3;
  damage: number;
  blocksPlayers: boolean;
};

export type EvaluatedWindZone = {
  id: string;
  box: Aabb3;
  forceX: number;
  state: 'idle' | 'warning' | 'blowing';
  intensity: number;
};

export type EvaluatedPendulum = {
  id: string;
  pivotX: number;
  pivotY: number;
  pivotZ: number;
  angle: number;
  bobX: number;
  bobY: number;
  bobZ: number;
  bobRadius: number;
  damage: number;
};

export type EvaluatedSpinner = {
  id: string;
  centerX: number;
  centerY: number;
  centerZ: number;
  angle: number;
  halfLength: number;
  halfHeight: number;
  halfThickness: number;
  damage: number;
};

export type EvaluatedCourseObstacles = {
  platforms: EvaluatedPlatform[];
  barriers: EvaluatedBarrier[];
  windZones: EvaluatedWindZone[];
  pendulums: EvaluatedPendulum[];
  spinners: EvaluatedSpinner[];
};

export type GlassSimPhase = 'playing' | 'finished';

export type GlassSimState = {
  phase: GlassSimPhase;
  tick: number;
  matchTime: number;
  checkpointIndex: number;
  shatters: number;
  p1: PlayerSimState;
  p2: PlayerSimState;
  glass: GlassState;
  fragileStates: Record<string, FragilePlatformState>;
  nextEventId: number;
  events: SimEvent[];
};

export type GlassResultSummary = {
  stars: 1 | 2 | 3;
  cookies: number;
  elapsedSec: number;
  shatters: number;
};
