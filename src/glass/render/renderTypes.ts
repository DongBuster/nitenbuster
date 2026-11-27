import type { CoopMapId } from '../../coop/maps/registry';
import type {
  GlassSnapshotPayload,
  PackedPlayerState,
} from '../online/protocol';
import { createInitialSimState } from '../sim/physics';
import type {
  FragilePlatformState,
  GlassSimState,
  PlayerSimState,
  PlayerSlot,
  ShatterReason,
} from '../sim/types';

export interface GlassHudSnapshot {
  matchTime: number;
  stageNumber: number;
  stageName: string;
  totalStages?: number;
  level?: number;
  mapPackTitle?: string;
  checkpointIndex: number;
  totalCheckpoints: number;
  shatters: number;
  glassHp: number;
  glassMaxHp: number;
  glassStress: number;
  shatterTimer: number;
  shatterReason: ShatterReason | null;
  p1Lift: number;
  p2Lift: number;
  progressPct: number;
  mapId?: CoopMapId;
  failureLabel?: string;
  primaryMeterPct?: number;
  primaryMeterLabel?: string;
  statusBadge?: string | null;
  pumpTurn?: PlayerSlot | null;
  boostActive?: boolean;
}

export interface GlassRenderState {
  matchTime: number;
  checkpointIndex: number;
  p1: PackedPlayerState;
  p2: PackedPlayerState;
  glass: GlassSnapshotPayload['glass'];
  fragileStates: Record<string, FragilePlatformState>;
  cameraShake: number;
  lastCrackAt: number;
  shatterBurstId: number;
  shatterOrigin: [number, number, number];
}

function toPackedPlayer(p: PlayerSimState): PackedPlayerState {
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    vx: p.vx,
    vy: p.vy,
    vz: p.vz,
    yaw: p.yaw,
    grounded: p.grounded,
    liftOffset: p.liftOffset,
    onIce: p.onIce,
    inWind: p.inWind,
  };
}

/** Creates an initialized mutable `GlassRenderState` at Checkpoint 0. */
export function createInitialRenderState(
  sim: GlassSimState = createInitialSimState(),
): GlassRenderState {
  const fragileStates: Record<string, FragilePlatformState> = {};
  for (const [id, entry] of Object.entries(sim.fragileStates)) {
    fragileStates[id] = { state: entry.state, timer: entry.timer };
  }

  return {
    matchTime: sim.matchTime,
    checkpointIndex: sim.checkpointIndex,
    p1: toPackedPlayer(sim.p1),
    p2: toPackedPlayer(sim.p2),
    glass: {
      hp: sim.glass.hp,
      stress: sim.glass.stress,
      centerX: sim.glass.centerX,
      centerY: sim.glass.centerY,
      centerZ: sim.glass.centerZ,
      yaw: sim.glass.yaw,
      pitch: sim.glass.pitch,
      length: sim.glass.length,
      invulnTimer: sim.glass.invulnTimer,
      shatterTimer: sim.glass.shatterTimer,
      shatterReason: sim.glass.shatterReason,
      lastImpactX: sim.glass.lastImpactX,
      lastImpactY: sim.glass.lastImpactY,
      lastImpactZ: sim.glass.lastImpactZ,
    },
    fragileStates,
    cameraShake: 0,
    lastCrackAt: 0,
    shatterBurstId: 0,
    shatterOrigin: [sim.glass.centerX, sim.glass.centerY, sim.glass.centerZ],
  };
}
