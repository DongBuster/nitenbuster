import type { CoopLevelNumber, CoopMapId } from '../../coop/maps/registry.ts';
import type { MinecartSnapshotPayload } from '../../coop/maps/minecart/types.ts';
import type { RaftSnapshotPayload } from '../../coop/maps/raft/types.ts';
import type { RopeSnapshotPayload } from '../../coop/maps/rope/types.ts';
import type { AnimalId } from '../../engine/types.ts';
import type {
  GlassSimState,
  LiftIntent,
  PlayerSimState,
  PlayerSlot,
  ShatterReason,
  SimEvent,
} from '../sim/types.ts';

export const GLASS_MAX_PLAYERS = 2;
export const GLASS_DISCONNECT_GRACE_MS = 8000;
export const GLASS_COUNTDOWN_MS = 2800;
export const GLASS_SNAPSHOT_INTERVAL_MS = 67;
export const GLASS_INPUT_INTERVAL_MS = 67;
export const GLASS_INPUT_STALE_MS = 400;
export const GLASS_INTERPOLATION_DELAY_MS = 75;

export const GLASS_EMOTES = [
  { id: 1, icon: '🐢', text: 'Chậm thôi!' },
  { id: 2, icon: '⬆️', text: 'Nhảy nào!' },
  { id: 3, icon: '🙌', text: 'Nâng lên!' },
  { id: 4, icon: '👇', text: 'Hạ xuống!' },
] as const;

export type GlassRoomPhase =
  | 'idle'
  | 'lobby'
  | 'countdown'
  | 'playing'
  | 'finished';

export type GlassConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export type GlassRoomMember = {
  peerId: string;
  name: string;
  animal: AnimalId;
  accessory: string[];
  ready: boolean;
  joinedAt: number;
  selectedMap?: CoopMapId;
  selectedMapPack?: string;
  selectedLevel?: CoopLevelNumber;
  unlockedByPack?: Record<string, number>;
};

export type PackedFragileState = {
  s: 0 | 1 | 2;
  t: number;
};

export type PackedPlayerState = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  grounded: boolean;
  liftOffset: number;
  onIce: boolean;
  inWind: boolean;
};

export type GlassSnapshotPayload = {
  mapId?: 'glass_carry';
  matchId: string;
  tick: number;
  matchTime: number;
  phase: 'playing' | 'finished';
  checkpointIndex: number;
  shatters: number;
  p1: PackedPlayerState;
  p2: PackedPlayerState;
  glass: {
    hp: number;
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
  events: SimEvent[];
  fragileStates?: Record<string, PackedFragileState>;
};

export type CoopSnapshotPayload =
  | (GlassSnapshotPayload & { mapId?: 'glass_carry' })
  | RaftSnapshotPayload
  | RopeSnapshotPayload
  | MinecartSnapshotPayload;

export type CoopSelectMapPayload = {
  hostPeerId: string;
  mapId: CoopMapId;
  mapPackId?: string;
  level?: CoopLevelNumber;
};

export type GlassInputPayload = {
  matchId: string;
  peerId: string;
  seq: number;
  moveX: number;
  moveZ: number;
  jump: boolean;
  lift: LiftIntent;
};

export type GlassStartPayload = {
  matchId: string;
  hostPeerId: string;
  guestPeerId: string;
  countdownMs: number;
  startedAt: number;
  mapId?: CoopMapId;
  mapPackId?: string;
  level?: CoopLevelNumber;
};

export type GlassEmotePayload = {
  peerId: string;
  slot: PlayerSlot;
  icon: string;
  text: string;
  at: number;
};

export type GlassFinishPayload = {
  matchId: string;
  mapId?: CoopMapId;
  mapPackId?: string;
  level?: CoopLevelNumber;
  elapsedSec: number;
  shatters: number;
};

export type GlassReturnLobbyPayload = {
  hostPeerId: string;
};

export type GlassSyncRequestPayload = {
  requesterPeerId: string;
  matchId: string;
};

export type GlassSyncStatePayload = {
  targetPeerId: string;
  matchId: string;
  hostPeerId: string;
  guestPeerId: string;
  mapId?: CoopMapId;
  mapPackId?: string;
  level?: CoopLevelNumber;
  phase: 'countdown' | 'playing' | 'finished';
  countdownRemainingMs: number;
  latestSnapshot: CoopSnapshotPayload | null;
  snapshot?: CoopSnapshotPayload | null;
  finalResult: GlassFinishPayload | null;
};

function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function packPlayerState(player: PlayerSimState): PackedPlayerState {
  return {
    x: round2(player.x),
    y: round2(player.y),
    z: round2(player.z),
    vx: round2(player.vx),
    vy: round2(player.vy),
    vz: round2(player.vz),
    yaw: round2(player.yaw),
    grounded: player.grounded,
    liftOffset: round2(player.liftOffset),
    onIce: player.onIce,
    inWind: player.inWind,
  };
}

function packFragileStates(
  fragileStates: GlassSimState['fragileStates'] | undefined,
): Record<string, PackedFragileState> | undefined {
  if (!fragileStates) return undefined;
  const entries = Object.entries(fragileStates);
  if (entries.length === 0) return undefined;
  const packed: Record<string, PackedFragileState> = {};
  for (const [id, entry] of entries) {
    const s: 0 | 1 | 2 =
      entry.state === 'shaking' ? 1 : entry.state === 'gone' ? 2 : 0;
    packed[id] = { s, t: round2(entry.timer) };
  }
  return packed;
}

/**
 * Compresses a 60Hz `GlassSimState` into a compact network snapshot by rounding
 * floating-point coordinates, angles, and timers to 2 decimals while preserving
 * exact tick, discrete counters, flags, and events.
 */
export function packSimSnapshot(
  matchId: string,
  state: GlassSimState,
): GlassSnapshotPayload {
  const fragileStates = packFragileStates(state.fragileStates);
  return {
    mapId: 'glass_carry',
    matchId,
    tick: state.tick,
    matchTime: round2(state.matchTime),
    phase: state.phase,
    checkpointIndex: state.checkpointIndex,
    shatters: state.shatters,
    p1: packPlayerState(state.p1),
    p2: packPlayerState(state.p2),
    glass: {
      hp: state.glass.hp,
      stress: round2(state.glass.stress),
      centerX: round2(state.glass.centerX),
      centerY: round2(state.glass.centerY),
      centerZ: round2(state.glass.centerZ),
      yaw: round2(state.glass.yaw),
      pitch: round2(state.glass.pitch),
      length: round2(state.glass.length),
      invulnTimer: round2(state.glass.invulnTimer),
      shatterTimer: round2(state.glass.shatterTimer),
      shatterReason: state.glass.shatterReason,
      lastImpactX: round2(state.glass.lastImpactX),
      lastImpactY: round2(state.glass.lastImpactY),
      lastImpactZ: round2(state.glass.lastImpactZ),
    },
    events: state.events.map((evt) => ({ ...evt })),
    ...(fragileStates ? { fragileStates } : {}),
  };
}
