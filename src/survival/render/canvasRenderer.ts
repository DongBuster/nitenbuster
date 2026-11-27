import { getAnimalAvatarTheme } from '../../components/animalAvatarMeta.ts';
import type { AnimalId } from '../../engine/types.ts';
import type {
  PackedZoneState,
  SurvivalSnapshotPayload,
} from '../online/protocol.ts';
import { WORLD_SIZE, getSurvivalMapMeta } from '../sim/maps.ts';
import type {
  EnemyKind,
  FloatingText,
  LightningArcFx,
  MapObstacle,
  MapZone,
  ParticleFx,
  ProjectileEntity,
  SurvivalMapId,
  SurvivalMapMeta,
  SurvivalWorldState,
  WeaponId,
  XpGemEntity,
} from '../sim/types.ts';

export interface RenderPlayer {
  id: string;
  name: string;
  animal: AnimalId;
  weaponId: WeaponId;
  isBot: boolean;
  botTakeover: boolean;
  x: number;
  y: number;
  radius?: number;
  aimAngle: number;
  hp: number;
  maxHp: number;
  downed: boolean;
  reviveProgress: number;
  invulnTimer: number;
  dashTimer: number;
  hitFlashTimer: number;
  orbitalAngle: number;
  droneAngle: number;
  pylonBuffTimer: number;
  orbitalLevel?: number;
  warmAuraLevel?: number;
  droneLevel?: number;
  teamAuraLevel?: number;
  stats?: {
    orbitalLevel: number;
    warmAuraLevel: number;
    droneLevel: number;
    teamAuraLevel: number;
  };
}

export interface RenderEnemy {
  id: string;
  kind: EnemyKind;
  isBoss: boolean;
  bossTier: number;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  hitFlashTimer: number;
  slowTimer: number;
  telegraphKind: 'none' | 'lunge' | 'explode' | 'slam' | 'charge' | 'volley';
  telegraphTimer: number;
  telegraphX?: number;
  telegraphY?: number;
}

export interface RenderProjectile {
  id: string;
  fromEnemy: boolean;
  weaponId: ProjectileEntity['weaponId'];
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  angle?: number;
  radius: number;
  color: string;
  boomerang: boolean;
}

export interface RenderXpGem {
  id: string;
  x: number;
  y: number;
  value: number;
  tier: XpGemEntity['tier'];
}

export interface RenderCrate {
  id: string;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  hitFlashTimer: number;
}

export interface RenderPickup {
  id: string;
  x: number;
  y: number;
  kind: 'heal' | 'magnet';
}

export interface RenderHazard {
  id: string;
  x: number;
  y: number;
  radius: number;
  endX?: number;
  endY?: number;
  shape: 'circle' | 'line';
  elapsed: number;
  duration: number;
  fromEnemy: boolean;
  color: string;
}

export interface SurvivalRenderView {
  mapId: SurvivalMapId;
  elapsedSec: number;
  sandstormActive: boolean;
  obstacles: readonly MapObstacle[];
  zones: readonly MapZone[];
  players: readonly RenderPlayer[];
  enemies: readonly RenderEnemy[];
  projectiles: readonly RenderProjectile[];
  xpGems: readonly RenderXpGem[];
  crates: readonly RenderCrate[];
  pickups: readonly RenderPickup[];
  hazards: readonly RenderHazard[];
  floatingTexts: readonly FloatingText[];
  particles: readonly ParticleFx[];
  lightningArcs: readonly LightningArcFx[];
}

const VIEWPORT_MARGIN = 140;
const PLAYER_DEFAULT_RADIUS = 18;
const REVIVE_RADIUS = 85;
const ORBITAL_RADIUS = 82;
const DRONE_ORBIT_RADIUS = 44;
const TEAM_AURA_RADIUS = 220;
const MINIMAP_SIZE = 136;
const MINIMAP_TOP = 76;
const MINIMAP_RIGHT = 14;

const EMPTY_FLOATING_TEXTS: readonly FloatingText[] = [];
const EMPTY_PARTICLES: readonly ParticleFx[] = [];
const GRADIENT_CACHE = new WeakMap<
  CanvasRenderingContext2D,
  Map<string, CanvasGradient>
>();
const ZONE_STATE_SCRATCH = new Map<string, PackedZoneState>();

function getCachedCenteredRadialGradient(
  ctx: CanvasRenderingContext2D,
  key: string,
  x0: number,
  y0: number,
  r0: number,
  r1: number,
  stops: ReadonlyArray<readonly [number, string]>,
): CanvasGradient {
  let cache = GRADIENT_CACHE.get(ctx);
  if (!cache) {
    cache = new Map();
    GRADIENT_CACHE.set(ctx, cache);
  }
  const existing = cache.get(key);
  if (existing) return existing;
  if (cache.size > 96) {
    cache.clear();
  }
  const grad = ctx.createRadialGradient(x0, y0, r0, 0, 0, r1);
  for (let i = 0; i < stops.length; i += 1) {
    grad.addColorStop(stops[i][0], stops[i][1]);
  }
  cache.set(key, grad);
  return grad;
}

const GEM_COLORS: Record<
  XpGemEntity['tier'],
  { fill: string; stroke: string; size: number }
> = {
  green: { fill: '#4ade80', stroke: '#15803d', size: 6.5 },
  blue: { fill: '#38bdf8', stroke: '#0369a1', size: 8 },
  purple: { fill: '#c084fc', stroke: '#6b21a8', size: 9.5 },
  gold: { fill: '#facc15', stroke: '#b45309', size: 12 },
};

function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val));
}

function cellHash(gx: number, gy: number): number {
  let n =
    (Math.imul(gx | 0, 374761393) +
      Math.imul(gy | 0, 668265263) +
      0x9e3779b9) |
    0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function isInView(
  x: number,
  y: number,
  radius: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): boolean {
  return (
    x + radius >= minX &&
    x - radius <= maxX &&
    y + radius >= minY &&
    y - radius <= maxY
  );
}

/**
 * Wraps a local Host/Offline `SurvivalWorldState` into a zero-copy
 * `SurvivalRenderView` for `renderSurvivalFrame`.
 */
export function worldToRenderView(world: SurvivalWorldState): SurvivalRenderView {
  return {
    mapId: world.mapId,
    elapsedSec: world.elapsedSec,
    sandstormActive:
      world.mapId === 'candy_canyon' && world.sandstormActiveTimer > 0,
    obstacles: world.obstacles,
    zones: world.zones,
    players: world.players,
    enemies: world.enemies,
    projectiles: world.projectiles,
    xpGems: world.xpGems,
    crates: world.crates,
    pickups: world.pickups,
    hazards: world.hazards,
    floatingTexts: world.floatingTexts,
    particles: world.particles,
    lightningArcs: world.lightningArcs,
  };
}

/**
 * Converts a Guest interpolated `SurvivalSnapshotPayload` and deterministic
 * map layout into a `SurvivalRenderView`.
 */
export function snapshotToRenderView(
  snap: SurvivalSnapshotPayload,
  layout: { obstacles: MapObstacle[]; zones: MapZone[] },
  reusableZones?: MapZone[],
): SurvivalRenderView {
  ZONE_STATE_SCRATCH.clear();
  for (let i = 0; i < snap.zones.length; i += 1) {
    const zs = snap.zones[i];
    ZONE_STATE_SCRATCH.set(zs.id, zs);
  }

  let zones: MapZone[];
  if (reusableZones && reusableZones.length === layout.zones.length) {
    zones = reusableZones;
    for (let i = 0; i < layout.zones.length; i += 1) {
      const base = layout.zones[i];
      const state = ZONE_STATE_SCRATCH.get(base.id);
      const dst = zones[i];
      dst.cooldownSec = state ? state.cooldownSec : base.cooldownSec;
      dst.activeTimerSec = state ? state.activeTimerSec : base.activeTimerSec;
    }
  } else {
    zones = layout.zones.map((z) => {
      const state = ZONE_STATE_SCRATCH.get(z.id);
      return state
        ? {
            ...z,
            cooldownSec: state.cooldownSec,
            activeTimerSec: state.activeTimerSec,
          }
        : z;
    });
  }

  return {
    mapId: snap.mapId,
    elapsedSec: snap.elapsedSec,
    sandstormActive: snap.sandstormActive,
    obstacles: layout.obstacles,
    zones,
    players: snap.players,
    enemies: snap.enemies,
    projectiles: snap.projectiles,
    xpGems: snap.xpGems,
    crates: snap.crates,
    pickups: snap.pickups,
    hazards: snap.hazards,
    floatingTexts: EMPTY_FLOATING_TEXTS,
    particles: EMPTY_PARTICLES,
    lightningArcs: snap.lightningArcs,
  };
}

function drawArenaFloor(
  ctx: CanvasRenderingContext2D,
  mapMeta: SurvivalMapMeta,
  viewMinX: number,
  viewMaxX: number,
  viewMinY: number,
  viewMaxY: number,
  nowMs: number,
  reducedMotion: boolean,
): void {
  const fillMinX = Math.max(0, viewMinX);
  const fillMaxX = Math.min(WORLD_SIZE, viewMaxX);
  const fillMinY = Math.max(0, viewMinY);
  const fillMaxY = Math.min(WORLD_SIZE, viewMaxY);

  if (fillMaxX > fillMinX && fillMaxY > fillMinY) {
    ctx.fillStyle = mapMeta.theme.bg;
    ctx.fillRect(fillMinX, fillMinY, fillMaxX - fillMinX, fillMaxY - fillMinY);
  }

  // Subtle 120px grid + 600px major guide lines
  const gridStep = 120;
  const gxStart = Math.max(0, Math.floor(fillMinX / gridStep) * gridStep);
  const gxEnd = Math.min(WORLD_SIZE, Math.ceil(fillMaxX / gridStep) * gridStep);
  const gyStart = Math.max(0, Math.floor(fillMinY / gridStep) * gridStep);
  const gyEnd = Math.min(WORLD_SIZE, Math.ceil(fillMaxY / gridStep) * gridStep);

  ctx.lineWidth = 1;
  ctx.strokeStyle = mapMeta.theme.grid;
  ctx.beginPath();
  for (let x = gxStart; x <= gxEnd; x += gridStep) {
    ctx.moveTo(x, fillMinY);
    ctx.lineTo(x, fillMaxY);
  }
  for (let y = gyStart; y <= gyEnd; y += gridStep) {
    ctx.moveTo(fillMinX, y);
    ctx.lineTo(fillMaxX, y);
  }
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = mapMeta.theme.accent;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (let x = gxStart; x <= gxEnd; x += gridStep) {
    if (x % 600 === 0 && x > 0 && x < WORLD_SIZE) {
      ctx.moveTo(x, fillMinY);
      ctx.lineTo(x, fillMaxY);
    }
  }
  for (let y = gyStart; y <= gyEnd; y += gridStep) {
    if (y % 600 === 0 && y > 0 && y < WORLD_SIZE) {
      ctx.moveTo(fillMinX, y);
      ctx.lineTo(fillMaxX, y);
    }
  }
  ctx.stroke();
  ctx.restore();

  // Per-map deterministic ambient ground textures in 240px tiles
  const tile = 240;
  const tx0 = Math.max(0, Math.floor(fillMinX / tile));
  const tx1 = Math.min(WORLD_SIZE / tile - 1, Math.floor(fillMaxX / tile));
  const ty0 = Math.max(0, Math.floor(fillMinY / tile));
  const ty1 = Math.min(WORLD_SIZE / tile - 1, Math.floor(fillMaxY / tile));

  ctx.save();
  for (let tx = tx0; tx <= tx1; tx += 1) {
    for (let ty = ty0; ty <= ty1; ty += 1) {
      const h1 = cellHash(tx, ty);
      const h2 = cellHash(tx + 37, ty + 91);
      const cx = (tx + 0.25 + h1 * 0.5) * tile;
      const cy = (ty + 0.25 + h2 * 0.5) * tile;

      if (mapMeta.id === 'winter_cabin') {
        if (h1 > 0.35) {
          ctx.fillStyle = 'rgba(186, 230, 253, 0.06)';
          ctx.beginPath();
          ctx.ellipse(cx, cy, 42 + h2 * 26, 24 + h1 * 14, h2 * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (h2 > 0.72) {
          ctx.strokeStyle = 'rgba(224, 242, 254, 0.12)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 18, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
        }
      } else if (mapMeta.id === 'candy_canyon') {
        if (h1 > 0.32) {
          ctx.strokeStyle = 'rgba(251, 146, 60, 0.1)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 52 + h1 * 28, 22 + h2 * 14, -0.35, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (h2 > 0.5) {
          ctx.fillStyle = h1 > 0.65 ? 'rgba(244, 114, 182, 0.18)' : 'rgba(253, 224, 71, 0.15)';
          ctx.beginPath();
          ctx.arc(cx + 28, cy - 16, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (mapMeta.id === 'crystal_cavern') {
        if (h1 > 0.35) {
          ctx.fillStyle = h2 > 0.5 ? 'rgba(192, 132, 252, 0.08)' : 'rgba(103, 232, 249, 0.07)';
          ctx.beginPath();
          ctx.moveTo(cx, cy - 18);
          ctx.lineTo(cx + 13, cy);
          ctx.lineTo(cx, cy + 18);
          ctx.lineTo(cx - 13, cy);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // endless_abyss starfield speckles
        const twinkle = reducedMotion
          ? 0.25
          : 0.16 + 0.16 * Math.sin(nowMs * 0.002 + h1 * 12);
        ctx.fillStyle = `rgba(148, 163, 184, ${twinkle.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5 + h2 * 1.8, 0, Math.PI * 2);
        ctx.fill();
        if (h2 > 0.6) {
          ctx.fillStyle = 'rgba(244, 63, 94, 0.16)';
          ctx.beginPath();
          ctx.arc(cx - 48, cy + 36, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Center landmark accents per map
  const center = WORLD_SIZE * 0.5;
  if (isInView(center, center, 340, viewMinX, viewMaxX, viewMinY, viewMaxY)) {
    if (mapMeta.id === 'winter_cabin') {
      // Cozy central wooden cabin deck markings
      ctx.fillStyle = 'rgba(120, 53, 15, 0.24)';
      roundedRectPath(ctx, center - 120, center - 90, 240, 180, 22);
      ctx.fill();
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.22)';
      ctx.lineWidth = 2;
      for (let py = center - 68; py <= center + 68; py += 22) {
        ctx.beginPath();
        ctx.moveTo(center - 110, py);
        ctx.lineTo(center + 110, py);
        ctx.stroke();
      }
    } else if (mapMeta.id === 'endless_abyss') {
      const radii = [180, 340, 520];
      for (let rIdx = 0; rIdx < radii.length; rIdx += 1) {
        ctx.strokeStyle =
          rIdx === 0 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(244, 63, 94, 0.14)';
        ctx.lineWidth = rIdx === 0 ? 2.5 : 1.5;
        ctx.setLineDash(rIdx === 1 ? [14, 12] : []);
        ctx.beginPath();
        ctx.arc(center, center, radii[rIdx], 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }
  ctx.restore();

  // Outer hazard margin outside [0, WORLD_SIZE] + glowing arena boundary wall
  ctx.save();
  ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
  if (viewMinX < 0) {
    ctx.fillRect(viewMinX, viewMinY, Math.min(0, viewMaxX) - viewMinX, viewMaxY - viewMinY);
  }
  if (viewMaxX > WORLD_SIZE) {
    const startX = Math.max(WORLD_SIZE, viewMinX);
    ctx.fillRect(startX, viewMinY, viewMaxX - startX, viewMaxY - viewMinY);
  }
  if (viewMinY < 0) {
    ctx.fillRect(fillMinX, viewMinY, fillMaxX - fillMinX, Math.min(0, viewMaxY) - viewMinY);
  }
  if (viewMaxY > WORLD_SIZE) {
    const startY = Math.max(WORLD_SIZE, viewMinY);
    ctx.fillRect(fillMinX, startY, fillMaxX - fillMinX, viewMaxY - startY);
  }

  ctx.strokeStyle = mapMeta.theme.accent;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 12;
  ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#f8fafc';
  ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
  ctx.restore();
}

function drawZone(
  ctx: CanvasRenderingContext2D,
  zone: MapZone,
  sandstormActive: boolean,
  nowMs: number,
  reducedMotion: boolean,
): void {
  const pulse = reducedMotion ? 0 : Math.sin(nowMs * 0.004 + zone.x * 0.01);

  ctx.save();
  ctx.translate(zone.x, zone.y);
  if (zone.kind === 'ice') {
    const grad = getCachedCenteredRadialGradient(
      ctx,
      `zone_ice_${Math.round(zone.radius)}`,
      -zone.radius * 0.2,
      -zone.radius * 0.2,
      10,
      zone.radius,
      [
        [0, 'rgba(186, 230, 253, 0.26)'],
        [0.7, 'rgba(125, 211, 252, 0.16)'],
        [1, 'rgba(56, 189, 248, 0.28)'],
      ],
    );
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(186, 230, 253, 0.72)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Specular ice sheen streaks clipped inside patch
    ctx.beginPath();
    ctx.arc(0, 0, zone.radius - 4, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-zone.radius * 0.75, -zone.radius * 0.15);
    ctx.lineTo(zone.radius * 0.25, -zone.radius * 0.78);
    ctx.moveTo(-zone.radius * 0.35, zone.radius * 0.65);
    ctx.lineTo(zone.radius * 0.68, -zone.radius * 0.12);
    ctx.stroke();
  } else if (zone.kind === 'sandstorm_beacon') {
    ctx.fillStyle = sandstormActive
      ? 'rgba(245, 158, 11, 0.28)'
      : 'rgba(245, 158, 11, 0.13)';
    ctx.beginPath();
    ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = sandstormActive ? '#fbbf24' : 'rgba(245, 158, 11, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(253, 186, 116, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 26 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
  } else if (zone.kind === 'crystal_pylon') {
    const isActive = zone.activeTimerSec > 0;
    const isReady = !isActive && zone.cooldownSec <= 0;

    if (isActive) {
      const grad = getCachedCenteredRadialGradient(
        ctx,
        `zone_pylon_${Math.round(zone.radius)}`,
        0,
        0,
        12,
        zone.radius,
        [
          [0, 'rgba(34, 211, 238, 0.32)'],
          [0.65, 'rgba(217, 70, 239, 0.22)'],
          [1, 'rgba(168, 85, 247, 0.06)'],
        ],
      );
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Active remaining progress arc
      const activeRatio = clamp01(zone.activeTimerSec / 10);
      ctx.strokeStyle = '#f0abfc';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        zone.radius - 8,
        -Math.PI * 0.5,
        -Math.PI * 0.5 + activeRatio * Math.PI * 2,
      );
      ctx.stroke();
    } else if (isReady) {
      ctx.fillStyle = 'rgba(192, 132, 252, 0.14)';
      ctx.beginPath();
      ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.65 + pulse * 0.25;
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    } else {
      // Recharging
      ctx.fillStyle = 'rgba(76, 29, 149, 0.14)';
      ctx.beginPath();
      ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
      ctx.lineWidth = 2;
      ctx.stroke();

      const chargeRatio = clamp01(1 - zone.cooldownSec / 30);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        zone.radius - 7,
        -Math.PI * 0.5,
        -Math.PI * 0.5 + chargeRatio * Math.PI * 2,
      );
      ctx.stroke();
    }

    // Center crystal beacon core
    const coreColor = isActive ? '#22d3ee' : isReady ? '#e879f9' : '#64748b';
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(11, 0);
    ctx.lineTo(0, 16);
    ctx.lineTo(-11, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // score_pad (endless_abyss)
    const occupied = zone.activeTimerSec > 0;
    const grad = getCachedCenteredRadialGradient(
      ctx,
      `zone_score_${occupied ? 1 : 0}_${Math.round(zone.radius)}`,
      0,
      0,
      10,
      zone.radius,
      [
        [
          0,
          occupied ? 'rgba(250, 204, 21, 0.28)' : 'rgba(168, 85, 247, 0.14)',
        ],
        [1, 'rgba(250, 204, 21, 0.04)'],
      ],
    );
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = occupied ? '#facc15' : 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = occupied ? 3 : 2;
    ctx.stroke();

    // Inner rune ring
    ctx.strokeStyle = occupied ? '#c084fc' : 'rgba(192, 132, 252, 0.45)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, zone.radius * 0.64, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawPlayerGroundAuras(
  ctx: CanvasRenderingContext2D,
  player: RenderPlayer,
  nowMs: number,
  reducedMotion: boolean,
): void {
  const radius = player.radius ?? PLAYER_DEFAULT_RADIUS;
  const pulse = reducedMotion ? 0 : Math.sin(nowMs * 0.006 + player.x * 0.02);

  if (player.downed) {
    ctx.save();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, REVIVE_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.55 + pulse * 0.2;
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    if (player.reviveProgress > 0) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(
        player.x,
        player.y,
        REVIVE_RADIUS - 4,
        -Math.PI * 0.5,
        -Math.PI * 0.5 + clamp01(player.reviveProgress) * Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  const teamAuraLevel = player.teamAuraLevel ?? player.stats?.teamAuraLevel ?? 0;
  if (teamAuraLevel > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(74, 222, 128, 0.06)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, TEAM_AURA_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  const warmAuraLevel = player.warmAuraLevel ?? player.stats?.warmAuraLevel ?? 0;
  if (warmAuraLevel > 0) {
    const auraRadius = 95 + warmAuraLevel * 16;
    ctx.save();
    ctx.translate(player.x, player.y);
    const grad = getCachedCenteredRadialGradient(
      ctx,
      `warm_aura_${Math.round(radius)}_${Math.round(auraRadius)}`,
      0,
      0,
      radius,
      auraRadius,
      [
        [0, 'rgba(251, 146, 60, 0.04)'],
        [0.75, 'rgba(251, 146, 60, 0.14)'],
        [1, 'rgba(249, 115, 22, 0.28)'],
      ],
    );
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.58 + pulse * 0.16;
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (player.pylonBuffTimer > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(232, 121, 249, 0.68)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, radius + 12 + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawHazard(ctx: CanvasRenderingContext2D, h: RenderHazard): void {
  const ratio = clamp01(h.elapsed / Math.max(0.01, h.duration));
  const resolved = h.elapsed >= h.duration;
  const strokeColor = h.fromEnemy ? h.color || '#ef4444' : '#f59e0b';
  const fillRgba = h.fromEnemy
    ? 'rgba(239, 68, 68, 0.16)'
    : 'rgba(245, 158, 11, 0.18)';
  const innerRgba = h.fromEnemy
    ? 'rgba(239, 68, 68, 0.34)'
    : 'rgba(192, 132, 252, 0.35)';

  ctx.save();
  if (h.shape === 'circle') {
    if (resolved) {
      const postFade = clamp01(1 - (h.elapsed - h.duration) / 0.22);
      ctx.globalAlpha = postFade;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius * (1 + (1 - postFade) * 0.22), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.fillStyle = fillRgba;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = innerRgba;
    ctx.beginPath();
    ctx.arc(h.x, h.y, Math.max(4, h.radius * ratio), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    const endX = h.endX ?? h.x;
    const endY = h.endY ?? h.y;
    const dx = endX - h.x;
    const dy = endY - h.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) {
      ctx.restore();
      return;
    }
    const angle = Math.atan2(dy, dx);

    ctx.translate(h.x, h.y);
    ctx.rotate(angle);

    if (resolved) {
      const postFade = clamp01(1 - (h.elapsed - h.duration) / 0.22);
      ctx.globalAlpha = postFade;
      ctx.fillStyle = innerRgba;
      roundedRectPath(ctx, 0, -h.radius, len, h.radius * 2, h.radius);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.fillStyle = fillRgba;
    roundedRectPath(ctx, 0, -h.radius, len, h.radius * 2, h.radius);
    ctx.fill();

    // Expanding charge fill across lane width
    const innerHalf = Math.max(3, h.radius * ratio);
    ctx.fillStyle = innerRgba;
    roundedRectPath(ctx, 0, -innerHalf, len, innerHalf * 2, innerHalf);
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 7]);
    roundedRectPath(ctx, 0, -h.radius, len, h.radius * 2, h.radius);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawXpGem(
  ctx: CanvasRenderingContext2D,
  gem: RenderXpGem,
  nowMs: number,
  reducedMotion: boolean,
): void {
  const style = GEM_COLORS[gem.tier];
  const s = style.size;

  if (gem.tier === 'gold') {
    const pulse = reducedMotion ? 1 : 1 + Math.sin(nowMs * 0.008 + gem.x) * 0.14;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.24)';
    ctx.beginPath();
    ctx.arc(gem.x, gem.y, s * 1.65 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = style.fill;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(gem.x, gem.y - s);
  ctx.lineTo(gem.x + s * 0.78, gem.y);
  ctx.lineTo(gem.x, gem.y + s);
  ctx.lineTo(gem.x - s * 0.78, gem.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Top-left crystal glint
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.moveTo(gem.x, gem.y - s * 0.72);
  ctx.lineTo(gem.x - s * 0.42, gem.y - s * 0.06);
  ctx.lineTo(gem.x, gem.y - s * 0.14);
  ctx.closePath();
  ctx.fill();
}

function drawPickup(
  ctx: CanvasRenderingContext2D,
  pk: RenderPickup,
  nowMs: number,
  reducedMotion: boolean,
): void {
  const bob = reducedMotion ? 0 : Math.sin(nowMs * 0.0055 + pk.x * 0.03) * 3.5;
  const py = pk.y + bob;

  ctx.save();
  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(pk.x, pk.y + 13, 11, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (pk.kind === 'heal') {
    ctx.fillStyle = 'rgba(251, 113, 133, 0.25)';
    ctx.beginPath();
    ctx.arc(pk.x, py, 18, 0, Math.PI * 2);
    ctx.fill();

    // Cute glowing Cookie Heart
    ctx.fillStyle = '#fb7185';
    ctx.strokeStyle = '#9f1239';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pk.x, py + 9);
    ctx.bezierCurveTo(pk.x - 14, py + 1, pk.x - 13, py - 11, pk.x - 4.5, py - 10);
    ctx.bezierCurveTo(pk.x - 1, py - 9.5, pk.x, py - 6, pk.x, py - 5);
    ctx.bezierCurveTo(pk.x, py - 6, pk.x + 1, py - 9.5, pk.x + 4.5, py - 10);
    ctx.bezierCurveTo(pk.x + 13, py - 11, pk.x + 14, py + 1, pk.x, py + 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cookie icing sheen
    ctx.fillStyle = 'rgba(255, 241, 242, 0.8)';
    ctx.beginPath();
    ctx.arc(pk.x - 4.5, py - 4.5, 2.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(34, 211, 238, 0.24)';
    ctx.beginPath();
    ctx.arc(pk.x, py, 18, 0, Math.PI * 2);
    ctx.fill();

    // Cyan U-Magnet
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#0e7490';
    ctx.lineWidth = 8.5;
    ctx.beginPath();
    ctx.arc(pk.x, py + 1, 7.5, Math.PI, 0, true);
    ctx.moveTo(pk.x - 7.5, py + 1);
    ctx.lineTo(pk.x - 7.5, py - 7);
    ctx.moveTo(pk.x + 7.5, py + 1);
    ctx.lineTo(pk.x + 7.5, py - 7);
    ctx.stroke();

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.arc(pk.x, py + 1, 7.5, Math.PI, 0, true);
    ctx.moveTo(pk.x - 7.5, py + 1);
    ctx.lineTo(pk.x - 7.5, py - 6.5);
    ctx.moveTo(pk.x + 7.5, py + 1);
    ctx.lineTo(pk.x + 7.5, py - 6.5);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(pk.x - 10.2, py - 9, 5.4, 3.5);
    ctx.fillRect(pk.x + 4.8, py - 9, 5.4, 3.5);
  }
  ctx.restore();
}

function drawCrate(ctx: CanvasRenderingContext2D, crate: RenderCrate): void {
  const half = crate.radius * 0.92;
  const size = half * 2;

  ctx.save();
  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  roundedRectPath(ctx, crate.x - half + 3, crate.y - half + 5, size, size, 6);
  ctx.fill();

  // Crate wooden body
  ctx.fillStyle = '#b45309';
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 2.5;
  roundedRectPath(ctx, crate.x - half, crate.y - half, size, size, 6);
  ctx.fill();
  ctx.stroke();

  // Inner wood inset
  const inset = half - 4;
  ctx.fillStyle = '#d97706';
  roundedRectPath(ctx, crate.x - inset, crate.y - inset, inset * 2, inset * 2, 3);
  ctx.fill();

  // Diagonal plank strap
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(crate.x - inset + 2, crate.y + inset - 2);
  ctx.lineTo(crate.x + inset - 2, crate.y - inset + 2);
  ctx.stroke();

  // Corner bolts
  ctx.fillStyle = '#fde68a';
  const b = inset - 2;
  ctx.fillRect(crate.x - b - 1.5, crate.y - b - 1.5, 3, 3);
  ctx.fillRect(crate.x + b - 1.5, crate.y - b - 1.5, 3, 3);
  ctx.fillRect(crate.x - b - 1.5, crate.y + b - 1.5, 3, 3);
  ctx.fillRect(crate.x + b - 1.5, crate.y + b - 1.5, 3, 3);

  if (crate.hitFlashTimer > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    roundedRectPath(ctx, crate.x - half, crate.y - half, size, size, 6);
    ctx.fill();
  }

  if (crate.hp < crate.maxHp) {
    const barW = size;
    const barH = 4.5;
    const bx = crate.x - barW * 0.5;
    const by = crate.y + half + 5;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    roundedRectPath(ctx, bx, by, barW, barH, 2);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    roundedRectPath(
      ctx,
      bx,
      by,
      barW * clamp01(crate.hp / Math.max(1, crate.maxHp)),
      barH,
      2,
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  obs: MapObstacle,
  mapMeta: SurvivalMapMeta,
): void {
  const { x, y, radius: r, kind } = obs;

  ctx.save();
  // Soft 2.5D ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(x + 5, y + 7, r * 1.02, r * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();

  if (kind === 'tree') {
    // 2.5D Layered pine tree with fluffy snow cap
    ctx.fillStyle = '#14532d';
    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(x - 2, y - 3, r * 0.74, 0, Math.PI * 2);
    ctx.fill();

    // Snow cap crown
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(x - 3, y - 5, r * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 5, y - 7, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'rock') {
    // Faceted 2.5D boulder
    ctx.fillStyle = mapMeta.theme.obstaclePrimary;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < 7; i += 1) {
      const ang = (i * Math.PI * 2) / 7;
      const rad = r * (i % 2 === 0 ? 1 : 0.86);
      const px = x + Math.cos(ang) * rad;
      const py = y + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Top bevel face
    ctx.fillStyle = mapMeta.theme.obstacleSecondary;
    ctx.globalAlpha = 0.48;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.16, y - r * 0.2, r * 0.56, r * 0.4, -0.35, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'cabin') {
    // Cozy snow-topped cabin roof
    const w = r * 1.72;
    const h = r * 1.48;
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2.4;
    roundedRectPath(ctx, x - w * 0.5, y - h * 0.5, w, h, 8);
    ctx.fill();
    ctx.stroke();

    // Roof shingles + snow crest
    ctx.fillStyle = '#991b1b';
    roundedRectPath(ctx, x - w * 0.46, y - h * 0.46, w * 0.92, h * 0.84, 6);
    ctx.fill();

    ctx.fillStyle = '#f0f9ff';
    roundedRectPath(ctx, x - w * 0.38, y - h * 0.36, w * 0.76, h * 0.38, 5);
    ctx.fill();

    // Roof ridge beam
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.4, y - 2);
    ctx.lineTo(x + w * 0.4, y - 2);
    ctx.stroke();
  } else if (kind === 'cactus') {
    // Cute saguaro cactus with arms + pink candy blossom
    ctx.fillStyle = '#15803d';
    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - r * 0.56, y - 4, r * 0.26, 0, Math.PI * 2);
    ctx.arc(x + r * 0.56, y + 4, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ribs
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.48, 0, Math.PI * 2);
    ctx.stroke();

    // Pink flower crown
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(x - 3, y - 4, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(x - 3, y - 4, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'crystal') {
    // Faceted glowing crystal cluster
    ctx.fillStyle = 'rgba(192, 132, 252, 0.22)';
    ctx.beginPath();
    ctx.arc(x, y, r * 1.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = mapMeta.theme.obstaclePrimary;
    ctx.strokeStyle = mapMeta.theme.obstacleSecondary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const ang = (i * Math.PI * 2) / 6 + 0.25;
      const rad = i % 2 === 0 ? r * 1.02 : r * 0.76;
      const px = x + Math.cos(ang) * rad;
      const py = y + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = mapMeta.theme.obstacleSecondary;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.25, y - r * 0.45);
    ctx.lineTo(x + r * 0.35, y - r * 0.1);
    ctx.lineTo(x - r * 0.05, y + r * 0.35);
    ctx.closePath();
    ctx.fill();
  } else {
    // pillar
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const ang = (i * Math.PI * 2) / 8 + Math.PI / 8;
      const px = x + Math.cos(ang) * r;
      const py = y + Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = mapMeta.theme.accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.56, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = mapMeta.theme.accent;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: RenderEnemy,
  nowMs: number,
  reducedMotion: boolean,
): void {
  const { x, y, radius: r, kind } = enemy;
  const isSlowed = enemy.slowTimer > 0;
  const hitFlash = enemy.hitFlashTimer > 0;
  const anim = reducedMotion ? 0 : Math.sin(nowMs * 0.008 + x * 0.04);

  ctx.save();
  // Boss pulsing aura
  if (enemy.isBoss) {
    const pulse = reducedMotion ? 1 : 1 + Math.sin(nowMs * 0.006) * 0.1;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
    ctx.beginPath();
    ctx.arc(x, y, r * 1.38 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.85, r * 0.86, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  if (kind === 'slime' || kind === 'boss_slime_king') {
    const squash = 1 + anim * 0.05;
    const rx = r * squash;
    const ry = r * (2 - squash) * 0.92;
    const bodyColor = kind === 'boss_slime_king' ? '#2dd4bf' : '#34d399';
    const rimColor = kind === 'boss_slime_king' ? '#0f766e' : '#047857';

    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = isSlowed ? '#38bdf8' : rimColor;
    ctx.lineWidth = isSlowed ? 3.5 : 2.4;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.08, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glossy jelly highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.32, y - r * 0.28, r * 0.28, r * 0.16, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Mischievous eyes
    ctx.fillStyle = '#0f172a';
    const eyeSpread = r * 0.32;
    const eyeR = Math.max(2.2, r * 0.12);
    ctx.beginPath();
    ctx.arc(x - eyeSpread, y, eyeR, 0, Math.PI * 2);
    ctx.arc(x + eyeSpread, y, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - eyeSpread - eyeR * 0.25, y - eyeR * 0.25, eyeR * 0.36, 0, Math.PI * 2);
    ctx.arc(x + eyeSpread - eyeR * 0.25, y - eyeR * 0.25, eyeR * 0.36, 0, Math.PI * 2);
    ctx.fill();

    if (kind === 'boss_slime_king') {
      // Suspended ice crystals & angry brow
      ctx.fillStyle = 'rgba(224, 242, 254, 0.55)';
      ctx.beginPath();
      ctx.arc(x - r * 0.42, y + r * 0.28, 4.5, 0, Math.PI * 2);
      ctx.arc(x + r * 0.46, y + r * 0.22, 3.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(x - eyeSpread - 6, y - eyeR - 4);
      ctx.lineTo(x - eyeSpread + 5, y - eyeR - 1);
      ctx.moveTo(x + eyeSpread + 6, y - eyeR - 4);
      ctx.lineTo(x + eyeSpread - 5, y - eyeR - 1);
      ctx.stroke();

      // Golden Royal Crown
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.48, y - r * 0.7);
      ctx.lineTo(x - r * 0.54, y - r * 1.18);
      ctx.lineTo(x - r * 0.18, y - r * 0.92);
      ctx.lineTo(x, y - r * 1.28);
      ctx.lineTo(x + r * 0.18, y - r * 0.92);
      ctx.lineTo(x + r * 0.54, y - r * 1.18);
      ctx.lineTo(x + r * 0.48, y - r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x, y - r * 0.88, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'bat') {
    const flap = reducedMotion ? 0 : Math.sin(nowMs * 0.02 + y * 0.05) * 6;
    // Bat wings
    ctx.fillStyle = '#5b21b6';
    ctx.strokeStyle = isSlowed ? '#38bdf8' : '#2e1065';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3, y);
    ctx.lineTo(x - r * 1.55, y - 6 + flap);
    ctx.lineTo(x - r * 0.95, y + r * 0.55);
    ctx.closePath();
    ctx.moveTo(x + r * 0.3, y);
    ctx.lineTo(x + r * 1.55, y - 6 + flap);
    ctx.lineTo(x + r * 0.95, y + r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fuzzy round bat body + ears
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.65, y - r * 0.4);
    ctx.lineTo(x - r * 0.5, y - r * 1.15);
    ctx.lineTo(x - r * 0.1, y - r * 0.7);
    ctx.moveTo(x + r * 0.65, y - r * 0.4);
    ctx.lineTo(x + r * 0.5, y - r * 1.15);
    ctx.lineTo(x + r * 0.1, y - r * 0.7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.82, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(x - 4.2, y - 1, 2.3, 0, Math.PI * 2);
    ctx.arc(x + 4.2, y - 1, 2.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'wolf') {
    const lunging = enemy.telegraphKind === 'lunge';
    if (lunging) {
      if (
        typeof enemy.telegraphX === 'number' &&
        typeof enemy.telegraphY === 'number' &&
        (enemy.telegraphX !== 0 || enemy.telegraphY !== 0)
      ) {
        const ldx = enemy.telegraphX - x;
        const ldy = enemy.telegraphY - y;
        const lLen = Math.hypot(ldx, ldy);
        if (lLen > 8) {
          const ux = ldx / lLen;
          const uy = ldy / lLen;
          const reach = Math.min(220, Math.max(120, lLen));
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.78)';
          ctx.lineWidth = 4;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + ux * reach, y + uy * reach);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(x, y, r + 6 + (reducedMotion ? 0 : Math.abs(anim) * 3), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Pointed wolf ears
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = isSlowed ? '#38bdf8' : lunging ? '#fca5a5' : '#1e293b';
    ctx.lineWidth = isSlowed ? 3 : 2.2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.75, y - r * 0.2);
    ctx.lineTo(x - r * 0.88, y - r * 1.15);
    ctx.lineTo(x - r * 0.15, y - r * 0.68);
    ctx.closePath();
    ctx.moveTo(x + r * 0.75, y - r * 0.2);
    ctx.lineTo(x + r * 0.88, y - r * 1.15);
    ctx.lineTo(x + r * 0.15, y - r * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wolf head & snout
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.34, r * 0.45, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = lunging ? '#ef4444' : '#facc15';
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - 2, 2.6, 0, Math.PI * 2);
    ctx.arc(x + r * 0.32, y - 2, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'owl_mage') {
    // Hooded mage owl
    ctx.fillStyle = '#312e81';
    ctx.strokeStyle = isSlowed ? '#38bdf8' : '#1e1b4b';
    ctx.lineWidth = isSlowed ? 3 : 2.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hooded point & feather horns
    ctx.fillStyle = '#4338ca';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.8, y - r * 0.35);
    ctx.lineTo(x, y - r * 1.25);
    ctx.lineTo(x + r * 0.8, y - r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing eyes + beak
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(x - 5, y - 1, 3, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 1, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 3);
    ctx.lineTo(x + 3, y + 3);
    ctx.lineTo(x, y + 8);
    ctx.closePath();
    ctx.fill();

    // Floating staff gem on side
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.9, y + r * 0.6);
    ctx.lineTo(x + r * 1.05, y - r * 0.7);
    ctx.stroke();
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(x + r * 1.05, y - r * 0.78, 4.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'golem') {
    // Chunky faceted ice-stone shoulders & torso
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = isSlowed ? '#38bdf8' : '#0f172a';
    ctx.lineWidth = isSlowed ? 3.5 : 2.6;

    // Ice shoulder crystals
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.moveTo(x - r * 1.15, y - r * 0.1);
    ctx.lineTo(x - r * 0.9, y - r * 0.85);
    ctx.lineTo(x - r * 0.35, y - r * 0.45);
    ctx.closePath();
    ctx.moveTo(x + r * 1.15, y - r * 0.1);
    ctx.lineTo(x + r * 0.9, y - r * 0.85);
    ctx.lineTo(x + r * 0.35, y - r * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hexagonal stone body
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const ang = (i * Math.PI * 2) / 6;
      const px = x + Math.cos(ang) * r * 0.96;
      const py = y + Math.sin(ang) * r * 0.92;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing ice chest core & eyes
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(x, y + 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 9, y - 7, 6, 3.5);
    ctx.fillRect(x + 3, y - 7, 6, 3.5);
  } else if (kind === 'bomber') {
    const exploding = enemy.telegraphKind === 'explode';
    const blink = exploding && !reducedMotion && Math.sin(nowMs * 0.04) > 0;
    ctx.fillStyle = blink ? '#fb923c' : '#e11d48';
    ctx.strokeStyle = isSlowed ? '#38bdf8' : '#881337';
    ctx.lineWidth = isSlowed ? 3 : 2.3;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Candy stripe band
    ctx.strokeStyle = '#fecdd3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.62, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();

    // Fuse stem + pulsing spark
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.9);
    ctx.quadraticCurveTo(x + 6, y - r * 1.25, x + 10, y - r * 1.15);
    ctx.stroke();

    const sparkR = exploding ? 5.5 : 3.6 + anim * 0.9;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(x + 10, y - r * 1.15, Math.max(2, sparkR), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 5, y - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'boss_frost_bear') {
    // Spiked frost armor shoulders
    ctx.fillStyle = '#bae6fd';
    ctx.strokeStyle = '#0369a1';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.95, y - r * 0.15);
    ctx.lineTo(x - r * 1.2, y - r * 0.72);
    ctx.lineTo(x - r * 0.55, y - r * 0.65);
    ctx.closePath();
    ctx.moveTo(x + r * 0.95, y - r * 0.15);
    ctx.lineTo(x + r * 1.2, y - r * 0.72);
    ctx.lineTo(x + r * 0.55, y - r * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Round bear ears
    ctx.fillStyle = '#e0f2fe';
    ctx.strokeStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.arc(x - r * 0.66, y - r * 0.66, r * 0.28, 0, Math.PI * 2);
    ctx.arc(x + r * 0.66, y - r * 0.66, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Frost bear body
    ctx.fillStyle = '#f0f9ff';
    ctx.strokeStyle = isSlowed ? '#38bdf8' : '#1e3a8a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ice Club
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0c4a6e';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.72, y + r * 0.35);
    ctx.lineTo(x + r * 1.35, y - r * 0.55);
    ctx.lineTo(x + r * 1.55, y - r * 0.35);
    ctx.lineTo(x + r * 0.9, y + r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Snout & fierce eyes
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.26, r * 0.36, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.16, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.12, 4, 0, Math.PI * 2);
    ctx.arc(x + r * 0.3, y - r * 0.12, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // boss_snow_dragon
    const isVolley = enemy.telegraphKind === 'volley';
    const wingBeat = reducedMotion ? 0 : Math.sin(nowMs * 0.008) * 10;
    if (isVolley) {
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 4;
      ctx.globalAlpha = reducedMotion ? 0.75 : 0.55 + Math.abs(Math.sin(nowMs * 0.02)) * 0.4;
      ctx.beginPath();
      ctx.arc(x, y, r + 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Wide spread dragon wings
    ctx.fillStyle = isVolley ? '#38bdf8' : '#0284c7';
    ctx.strokeStyle = isVolley ? '#e0f2fe' : '#0c4a6e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.45, y);
    ctx.lineTo(x - r * 1.78, y - r * 0.7 + wingBeat);
    ctx.lineTo(x - r * 1.45, y + r * 0.35 + wingBeat * 0.5);
    ctx.lineTo(x - r * 0.7, y + r * 0.35);
    ctx.closePath();
    ctx.moveTo(x + r * 0.45, y);
    ctx.lineTo(x + r * 1.78, y - r * 0.7 + wingBeat);
    ctx.lineTo(x + r * 1.45, y + r * 0.35 + wingBeat * 0.5);
    ctx.lineTo(x + r * 0.7, y + r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ice horns
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.48, y - r * 0.55);
    ctx.lineTo(x - r * 0.85, y - r * 1.32);
    ctx.lineTo(x - r * 0.18, y - r * 0.8);
    ctx.closePath();
    ctx.moveTo(x + r * 0.48, y - r * 0.55);
    ctx.lineTo(x + r * 0.85, y - r * 1.32);
    ctx.lineTo(x + r * 0.18, y - r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Dragon body
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = isSlowed ? '#bae6fd' : '#0c4a6e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.94, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing arcane chest + fierce eyes
    ctx.fillStyle = '#cffafe';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.3, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.14, 4.5, 0, Math.PI * 2);
    ctx.arc(x + r * 0.3, y - r * 0.14, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Slow frost tint & hit flash overlay
  if (isSlowed) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (hitFlash) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.98, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enemy HP Bar
  if (enemy.isBoss || enemy.hp < enemy.maxHp) {
    const barW = enemy.isBoss ? Math.max(96, r * 2.2) : Math.max(30, r * 1.7);
    const barH = enemy.isBoss ? 8 : 4.5;
    const bx = x - barW * 0.5;
    const by = y + r + (enemy.isBoss ? 10 : 5);
    const hpRatio = clamp01(enemy.hp / Math.max(1, enemy.maxHp));

    if (enemy.isBoss) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      roundedRectPath(ctx, bx - 1, by - 1, barW + 2, barH + 2, 4);
      ctx.fill();

      ctx.fillStyle = '#ef4444';
      roundedRectPath(ctx, bx, by, barW * hpRatio, barH, 3);
      ctx.fill();

      ctx.strokeStyle = 'rgba(254, 226, 226, 0.8)';
      ctx.lineWidth = 1.2;
      roundedRectPath(ctx, bx - 1, by - 1, barW + 2, barH + 2, 4);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
      ctx.fillStyle = '#fb7185';
      ctx.fillRect(bx, by, barW * hpRatio, barH);
    }
  }

  ctx.restore();
}

function drawAnimalSilhouettes(
  ctx: CanvasRenderingContext2D,
  animal: AnimalId,
  x: number,
  y: number,
  r: number,
  aimAngle: number,
  downed: boolean,
): void {
  const lookX = Math.cos(aimAngle) * 4.2;
  const lookY = Math.sin(aimAngle) * 3.2;

  ctx.save();
  // 1. Animal-specific ears/crests (drawn before or around face)
  if (animal === 'dog') {
    ctx.fillStyle = '#e89541';
    ctx.strokeStyle = '#9a5316';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.78, y - r * 0.25);
    ctx.lineTo(x - r * 0.96, y - r * 1.15);
    ctx.lineTo(x - r * 0.25, y - r * 0.75);
    ctx.closePath();
    ctx.moveTo(x + r * 0.78, y - r * 0.25);
    ctx.lineTo(x + r * 0.96, y - r * 1.15);
    ctx.lineTo(x + r * 0.25, y - r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (animal === 'cat') {
    ctx.fillStyle = '#777a84';
    ctx.strokeStyle = '#3f424b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.76, y - r * 0.3);
    ctx.lineTo(x - r * 0.82, y - r * 1.18);
    ctx.lineTo(x - r * 0.2, y - r * 0.8);
    ctx.closePath();
    ctx.moveTo(x + r * 0.76, y - r * 0.3);
    ctx.lineTo(x + r * 0.82, y - r * 1.18);
    ctx.lineTo(x + r * 0.2, y - r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#efa8b2';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.65, y - r * 0.42);
    ctx.lineTo(x - r * 0.7, y - r * 0.96);
    ctx.lineTo(x - r * 0.32, y - r * 0.72);
    ctx.closePath();
    ctx.moveTo(x + r * 0.65, y - r * 0.42);
    ctx.lineTo(x + r * 0.7, y - r * 0.96);
    ctx.lineTo(x + r * 0.32, y - r * 0.72);
    ctx.closePath();
    ctx.fill();
  } else if (animal === 'bunny') {
    ctx.fillStyle = '#faf5f0';
    ctx.strokeStyle = '#be5b85';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.38, y - r * 1.12, r * 0.26, r * 0.62, -0.18, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.38, y - r * 1.12, r * 0.26, r * 0.62, 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f4b2be';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.38, y - r * 1.12, r * 0.13, r * 0.42, -0.18, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.38, y - r * 1.12, r * 0.13, r * 0.42, 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (animal === 'panda') {
    ctx.fillStyle = '#262626';
    ctx.beginPath();
    ctx.arc(x - r * 0.68, y - r * 0.68, r * 0.36, 0, Math.PI * 2);
    ctx.arc(x + r * 0.68, y - r * 0.68, r * 0.36, 0, Math.PI * 2);
    ctx.fill();
  } else if (animal === 'shark') {
    ctx.fillStyle = '#5275a1';
    ctx.strokeStyle = '#274060';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3, y - r * 0.82);
    ctx.quadraticCurveTo(x - r * 0.1, y - r * 1.48, x + r * 0.38, y - r * 1.24);
    ctx.lineTo(x + r * 0.22, y - r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (animal === 'dino') {
    ctx.fillStyle = '#efe9be';
    ctx.strokeStyle = '#4d7426';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.45, y - r * 0.8);
    ctx.lineTo(x - r * 0.55, y - r * 1.2);
    ctx.lineTo(x - r * 0.15, y - r * 0.9);
    ctx.lineTo(x, y - r * 1.32);
    ctx.lineTo(x + r * 0.18, y - r * 0.9);
    ctx.lineTo(x + r * 0.52, y - r * 1.18);
    ctx.lineTo(x + r * 0.45, y - r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (animal === 'chicken') {
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x - r * 0.24, y - r * 0.94, r * 0.22, 0, Math.PI * 2);
    ctx.arc(x, y - r * 1.05, r * 0.24, 0, Math.PI * 2);
    ctx.arc(x + r * 0.24, y - r * 0.94, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // duck feather tuft
    ctx.fillStyle = '#faf5ec';
    ctx.strokeStyle = '#b47818';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x - 2, y - r * 0.96, r * 0.22, 0, Math.PI * 2);
    ctx.arc(x + 3, y - r * 0.92, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 2. Plush round body with AnimalAvatarTheme cached radial gradient
  const theme = getAnimalAvatarTheme(animal);
  const grad = getCachedCenteredRadialGradient(
    ctx,
    `animal_${animal}_${Math.round(r)}`,
    -r * 0.28,
    -r * 0.32,
    r * 0.12,
    r,
    [
      [0, theme.bgStart],
      [1, theme.bgEnd],
    ],
  );

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#1e1b18';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Inner face details
  const fx = x + lookX;
  const fy = y + lookY;

  if (animal === 'panda') {
    ctx.fillStyle = '#262626';
    ctx.beginPath();
    ctx.ellipse(fx - 5.2, fy - 1.5, 4.2, 4.8, 0.25, 0, Math.PI * 2);
    ctx.ellipse(fx + 5.2, fy - 1.5, 4.2, 4.8, -0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (animal === 'dog') {
    ctx.fillStyle = '#faf1e2';
    ctx.beginPath();
    ctx.ellipse(fx, fy + 3.5, 8.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyes (X-eyes if downed, glossy eyes if alive)
  if (downed) {
    ctx.strokeStyle = '#1f1815';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx - 7.5, fy - 4);
    ctx.lineTo(fx - 3.5, fy);
    ctx.moveTo(fx - 3.5, fy - 4);
    ctx.lineTo(fx - 7.5, fy);
    ctx.moveTo(fx + 3.5, fy - 4);
    ctx.lineTo(fx + 7.5, fy);
    ctx.moveTo(fx + 7.5, fy - 4);
    ctx.lineTo(fx + 3.5, fy);
    ctx.stroke();
  } else {
    const eyeFill = animal === 'panda' ? '#ffffff' : '#1f1815';
    ctx.fillStyle = eyeFill;
    ctx.beginPath();
    ctx.arc(fx - 5.2, fy - 2, 2.6, 0, Math.PI * 2);
    ctx.arc(fx + 5.2, fy - 2, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = animal === 'panda' ? '#111827' : '#ffffff';
    ctx.beginPath();
    ctx.arc(
      fx - 5.2 + (animal === 'panda' ? 0 : -0.7),
      fy - 2 + (animal === 'panda' ? 0 : -0.8),
      animal === 'panda' ? 1.5 : 1,
      0,
      Math.PI * 2,
    );
    ctx.arc(
      fx + 5.2 + (animal === 'panda' ? 0 : -0.7),
      fy - 2 + (animal === 'panda' ? 0 : -0.8),
      animal === 'panda' ? 1.5 : 1,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Beak / nose / shark grin accent
  if (animal === 'duck' || animal === 'chicken') {
    ctx.fillStyle = '#f58b16';
    ctx.beginPath();
    ctx.ellipse(fx, fy + 3.5, animal === 'duck' ? 6 : 4.2, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (animal === 'shark') {
    ctx.fillStyle = '#f6f4f0';
    ctx.beginPath();
    ctx.arc(fx, fy + 2.5, 7, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.fill();
  } else {
    ctx.fillStyle = animal === 'cat' || animal === 'bunny' ? '#ec4899' : '#1f1815';
    ctx.beginPath();
    ctx.arc(fx, fy + 2.8, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWeaponSilhouette(
  ctx: CanvasRenderingContext2D,
  weaponId: WeaponId,
  x: number,
  y: number,
  radius: number,
  aimAngle: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(aimAngle);
  const offset = radius + 4;

  switch (weaponId) {
    case 'candy_smg':
      ctx.fillStyle = '#f472b6';
      ctx.strokeStyle = '#831843';
      ctx.lineWidth = 1.6;
      roundedRectPath(ctx, offset - 5, -3.5, 17, 7, 2.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.fillRect(offset + 10, -2, 5, 4);
      break;

    case 'chestnut_shotgun':
      ctx.fillStyle = '#b45309';
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.6;
      roundedRectPath(ctx, offset - 6, -4, 12, 8, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(offset + 4, -4, 11, 3);
      ctx.fillRect(offset + 4, 1, 11, 3);
      break;

    case 'frost_bow':
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(offset - 2, 0, 12, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(offset - 1, -11);
      ctx.lineTo(offset - 1, 11);
      ctx.stroke();
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(offset - 2, -1.2, 15, 2.4);
      break;

    case 'lightning_staff':
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(offset - 6, 0);
      ctx.lineTo(offset + 12, 0);
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(offset + 14, 0, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;

    case 'candy_launcher':
      ctx.fillStyle = '#c084fc';
      ctx.strokeStyle = '#4c1d95';
      ctx.lineWidth = 1.8;
      roundedRectPath(ctx, offset - 6, -5.5, 20, 11, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(offset + 11, -6, 4, 12);
      break;

    case 'snow_boomerang':
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(offset + 2, -9);
      ctx.quadraticCurveTo(offset + 12, 0, offset + 2, 9);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: RenderPlayer,
  isLocal: boolean,
  nowMs: number,
  reducedMotion: boolean,
): void {
  const r = player.radius ?? PLAYER_DEFAULT_RADIUS;

  ctx.save();
  // Invulnerability blink
  if (!player.downed && player.invulnTimer > 0) {
    ctx.globalAlpha = reducedMotion
      ? 0.72
      : Math.sin(nowMs * 0.035) > 0
        ? 0.55
        : 1;
  }

  // Dash trail shimmer
  if (!player.downed && player.dashTimer > 0) {
    const backX = -Math.cos(player.aimAngle);
    const backY = -Math.sin(player.aimAngle);
    const prevAlpha = ctx.globalAlpha;
    ctx.fillStyle = '#67e8f9';
    for (let t = 1; t <= 2; t += 1) {
      ctx.globalAlpha = prevAlpha * (0.32 - t * 0.1);
      ctx.beginPath();
      ctx.arc(
        player.x + backX * t * 14,
        player.y + backY * t * 14,
        r * (1 - t * 0.14),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = prevAlpha;
  }

  // Ground shadow + local player gold ring
  ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + r * 0.82, r * 0.88, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isLocal) {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 4, r + 5, r + 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawAnimalSilhouettes(
    ctx,
    player.animal,
    player.x,
    player.y,
    r,
    player.aimAngle,
    player.downed,
  );

  if (!player.downed) {
    drawWeaponSilhouette(
      ctx,
      player.weaponId,
      player.x,
      player.y,
      r,
      player.aimAngle,
    );
  } else {
    // Muted downed tint
    ctx.fillStyle = 'rgba(15, 23, 42, 0.48)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (player.hitFlashTimer > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Secondary weapons (Orbital Ice & Plush Drone) when living
  if (!player.downed) {
    const orbitalLevel = player.orbitalLevel ?? player.stats?.orbitalLevel ?? 0;
    if (orbitalLevel > 0) {
      const count = 2 + orbitalLevel;
      for (let b = 0; b < count; b += 1) {
        const ang = player.orbitalAngle + (b * Math.PI * 2) / count;
        const ox = player.x + Math.cos(ang) * ORBITAL_RADIUS;
        const oy = player.y + Math.sin(ang) * ORBITAL_RADIUS;

        ctx.fillStyle = 'rgba(103, 232, 249, 0.35)';
        ctx.beginPath();
        ctx.arc(ox, oy, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#67e8f9';
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ox, oy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    const droneLevel = player.droneLevel ?? player.stats?.droneLevel ?? 0;
    if (droneLevel > 0) {
      const dx = player.x + Math.cos(player.droneAngle) * DRONE_ORBIT_RADIUS;
      const dy = player.y + Math.sin(player.droneAngle) * DRONE_ORBIT_RADIUS;

      ctx.fillStyle = '#34d399';
      ctx.strokeStyle = '#064e3b';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(dx, dy, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Drone ears / rotor wings
      ctx.fillStyle = '#a7f3d0';
      ctx.beginPath();
      ctx.ellipse(dx - 8, dy - 4, 4, 2, -0.4, 0, Math.PI * 2);
      ctx.ellipse(dx + 8, dy - 4, 4, 2, 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;

  // Mini HP bar beneath player
  const barW = 40;
  const barH = 5;
  const bx = player.x - barW * 0.5;
  const by = player.y + r + 8;
  const hpRatio = clamp01(player.hp / Math.max(1, player.maxHp));

  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  roundedRectPath(ctx, bx - 1, by - 1, barW + 2, barH + 2, 3);
  ctx.fill();

  ctx.fillStyle = player.downed
    ? '#10b981'
    : hpRatio > 0.5
      ? '#4ade80'
      : hpRatio > 0.25
        ? '#facc15'
        : '#f43f5e';
  roundedRectPath(ctx, bx, by, barW * (player.downed ? clamp01(player.reviveProgress) : hpRatio), barH, 2.5);
  ctx.fill();

  // Name tag
  ctx.font = '700 11px Nunito, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const label =
    player.isBot || player.botTakeover ? `${player.name} [BOT]` : player.name;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeText(label, player.x, by + 7);
  ctx.fillStyle = isLocal ? '#fde047' : '#f8fafc';
  ctx.fillText(label, player.x, by + 7);

  // "CỨU!" badge above downed teammate
  if (player.downed) {
    const badgeW = 54;
    const badgeH = 20;
    const badgeX = player.x - badgeW * 0.5;
    const badgeY = player.y - r - 30;
    ctx.fillStyle = '#065f46';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    roundedRectPath(ctx, badgeX, badgeY, badgeW, badgeH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = '800 11px Fredoka, Nunito, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ecfdf5';
    ctx.fillText('CỨU!', player.x, badgeY + badgeH * 0.5 + 0.5);
  }
  ctx.restore();
}

function drawProjectile(
  ctx: CanvasRenderingContext2D,
  proj: RenderProjectile,
  nowMs: number,
  reducedMotion: boolean,
): void {
  ctx.save();
  if (proj.boomerang) {
    ctx.translate(proj.x, proj.y);
    ctx.rotate(reducedMotion ? 0.4 : nowMs * 0.016);
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, proj.radius, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else if (proj.weaponId === 'candy_launcher') {
    ctx.fillStyle = 'rgba(192, 132, 252, 0.32)';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius * 1.65, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = proj.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (proj.weaponId === 'frost_bow') {
    const hasAngle = typeof proj.angle === 'number' && Number.isFinite(proj.angle);
    const hasVel =
      typeof proj.vx === 'number' &&
      typeof proj.vy === 'number' &&
      (proj.vx !== 0 || proj.vy !== 0);
    if (hasAngle || hasVel) {
      const ang = hasAngle ? proj.angle! : Math.atan2(proj.vy!, proj.vx!);
      ctx.translate(proj.x, proj.y);
      ctx.rotate(ang);
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(proj.radius * 2.2, 0);
      ctx.lineTo(-proj.radius * 1.4, -proj.radius * 0.7);
      ctx.lineTo(-proj.radius * 0.9, 0);
      ctx.lineTo(-proj.radius * 1.4, proj.radius * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (proj.fromEnemy) {
    ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius * 1.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = proj.color || '#fb7185';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = proj.color || '#f472b6';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, Math.max(1.5, proj.radius * 0.45), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLightningArc(
  ctx: CanvasRenderingContext2D,
  arc: LightningArcFx,
  nowMs: number,
  reducedMotion: boolean,
): void {
  if (arc.points.length < 2) return;
  const fade = clamp01(arc.ttl / Math.max(0.01, arc.maxTtl));
  const seed = reducedMotion ? 1 : Math.floor(nowMs / 45);

  const traceJagged = () => {
    ctx.beginPath();
    ctx.moveTo(arc.points[0].x, arc.points[0].y);
    for (let i = 0; i < arc.points.length - 1; i += 1) {
      const a = arc.points[i];
      const b = arc.points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      for (let step = 1; step <= 2; step += 1) {
        const t = step / 3;
        const jitter =
          (cellHash(seed + i * 7 + step, Math.round(a.x + b.y)) - 0.5) * 18;
        ctx.lineTo(a.x + dx * t + nx * jitter, a.y + dy * t + ny * jitter);
      }
      ctx.lineTo(b.x, b.y);
    }
  };

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  traceJagged();
  ctx.strokeStyle = arc.color || '#facc15';
  ctx.globalAlpha = fade * 0.45;
  ctx.lineWidth = 6.5;
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = fade;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.restore();
}

function drawBossOffscreenIndicators(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: { x: number; y: number },
  enemies: readonly RenderEnemy[],
  nowMs: number,
  reducedMotion: boolean,
): void {
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const pulse = reducedMotion ? 1 : 0.82 + 0.18 * Math.sin(nowMs * 0.009);
  const minX = 44;
  const maxX = Math.max(minX, width - 44);
  const minY = Math.min(height - 44, 88);
  const maxY = Math.max(minY, height - 44);

  for (let i = 0; i < enemies.length; i += 1) {
    const e = enemies[i];
    if (!e.isBoss || e.hp <= 0) continue;

    const sx = e.x - camera.x + halfW;
    const sy = e.y - camera.y + halfH;
    if (sx >= 24 && sx <= width - 24 && sy >= 24 && sy <= height - 24) {
      continue;
    }

    const dx = sx - halfW;
    const dy = sy - halfH;
    const angle = Math.atan2(dy, dx);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const scaleX =
      cos > 1e-4
        ? (maxX - halfW) / cos
        : cos < -1e-4
          ? (minX - halfW) / cos
          : Infinity;
    const scaleY =
      sin > 1e-4
        ? (maxY - halfH) / sin
        : sin < -1e-4
          ? (minY - halfH) / sin
          : Infinity;
    const scale = Math.max(0, Math.min(scaleX, scaleY));

    let ix = Math.max(minX, Math.min(maxX, halfW + cos * scale));
    let iy = Math.max(minY, Math.min(maxY, halfH + sin * scale));

    // Avoid overlapping top-right minimap box by displacing along shortest axis
    const mapLeft = width - MINIMAP_RIGHT - MINIMAP_SIZE - 26;
    const mapBottom = MINIMAP_TOP + MINIMAP_SIZE + 26;
    if (ix > mapLeft && iy < mapBottom) {
      const shiftLeft = ix - mapLeft;
      const shiftDown = mapBottom - iy;
      if (shiftLeft <= shiftDown && mapLeft >= minX) {
        ix = mapLeft;
      } else {
        iy = Math.min(maxY, mapBottom);
      }
    }

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.translate(ix, iy);

    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#fecaca';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Directional triangle pointer
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = '#fef2f2';
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(13, -6);
    ctx.lineTo(13, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.font = '800 9px Fredoka, Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('BOSS', 0, 0.5);
    ctx.restore();
  }
}

function drawSandstormOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  nowMs: number,
  reducedMotion: boolean,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(217, 119, 6, 0.14)';
  ctx.fillRect(0, 0, width, height);

  if (!reducedMotion) {
    ctx.strokeStyle = 'rgba(253, 186, 116, 0.24)';
    ctx.lineWidth = 2;
    const t = nowMs * 0.9;
    ctx.beginPath();
    for (let i = 0; i < 20; i += 1) {
      const span = width + 240;
      const x = (((i * 197 + t * (1 + (i % 3) * 0.25)) % span) + span) % span - 120;
      const y = ((i * 89 + t * 0.18) % height + height) % height;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 95, y + 22);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: SurvivalRenderView,
  camera: { x: number; y: number },
  localPlayerId: string,
  nowMs: number,
  reducedMotion: boolean,
): void {
  if (width < 320 || height < 240) return;

  const mapSize = MINIMAP_SIZE;
  const mx = Math.max(8, width - MINIMAP_RIGHT - mapSize);
  const my = MINIMAP_TOP;
  const scale = mapSize / WORLD_SIZE;

  ctx.save();
  roundedRectPath(ctx, mx, my, mapSize, mapSize, 12);
  ctx.fillStyle = 'rgba(10, 15, 28, 0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.clip();

  // Subtle zones
  ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
  for (let i = 0; i < view.zones.length; i += 1) {
    const z = view.zones[i];
    ctx.beginPath();
    ctx.arc(mx + z.x * scale, my + z.y * scale, Math.max(2, z.radius * scale), 0, Math.PI * 2);
    ctx.fill();
  }

  // Obstacles
  ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
  for (let i = 0; i < view.obstacles.length; i += 1) {
    const o = view.obstacles[i];
    ctx.beginPath();
    ctx.arc(mx + o.x * scale, my + o.y * scale, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crates
  ctx.fillStyle = '#fbbf24';
  for (let i = 0; i < view.crates.length; i += 1) {
    const c = view.crates[i];
    if (c.hp <= 0) continue;
    ctx.fillRect(mx + c.x * scale - 1.2, my + c.y * scale - 1.2, 2.4, 2.4);
  }

  // Camera viewport frame box
  const camLeft = mx + (camera.x - width * 0.5) * scale;
  const camTop = my + (camera.y - height * 0.5) * scale;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.lineWidth = 1;
  ctx.strokeRect(camLeft, camTop, width * scale, height * scale);

  // Boss indicator
  const bossPulse = reducedMotion ? 1 : 1 + Math.sin(nowMs * 0.01) * 0.25;
  for (let i = 0; i < view.enemies.length; i += 1) {
    const e = view.enemies[i];
    if (!e.isBoss || e.hp <= 0) continue;
    const bx = mx + e.x * scale;
    const by = my + e.y * scale;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.beginPath();
    ctx.arc(bx, by, 7 * bossPulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(bx, by, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Teammates (with downed emerald ring) & local player (gold dot + white ring)
  let localPlayer: RenderPlayer | null = null;
  for (let i = 0; i < view.players.length; i += 1) {
    const p = view.players[i];
    if (p.id === localPlayerId) {
      localPlayer = p;
      continue;
    }
    const px = mx + p.x * scale;
    const py = my + p.y * scale;
    if (p.downed) {
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(px, py, 5.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = p.downed ? '#10b981' : '#38bdf8';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (localPlayer) {
    const lx = mx + localPlayer.x * scale;
    const ly = my + localPlayer.y * scale;
    if (localPlayer.downed) {
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lx, ly, 6.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(lx, ly, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Renders one complete 2D Canvas frame of Survival mode in PAWS arcade style
 * with viewport culling, map themes, telegraphs, silhouettes, and minimap.
 */
export function renderSurvivalFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: SurvivalRenderView,
  camera: { x: number; y: number },
  localPlayerId: string,
  aimCursorWorld: { x: number; y: number } | null,
  manualAim: boolean,
  nowMs: number,
  reducedMotion: boolean,
): void {
  if (width <= 0 || height <= 0) return;

  const mapMeta = getSurvivalMapMeta(view.mapId);
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const viewMinX = camera.x - halfW - VIEWPORT_MARGIN;
  const viewMaxX = camera.x + halfW + VIEWPORT_MARGIN;
  const viewMinY = camera.y - halfH - VIEWPORT_MARGIN;
  const viewMaxY = camera.y + halfH + VIEWPORT_MARGIN;

  // Outer void background
  ctx.fillStyle = '#060911';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(halfW - camera.x, halfH - camera.y);

  // 1. Arena floor, grid & borders
  drawArenaFloor(
    ctx,
    mapMeta,
    viewMinX,
    viewMaxX,
    viewMinY,
    viewMaxY,
    nowMs,
    reducedMotion,
  );

  // 2. Environmental zones
  for (let i = 0; i < view.zones.length; i += 1) {
    const z = view.zones[i];
    if (isInView(z.x, z.y, z.radius, viewMinX, viewMaxX, viewMinY, viewMaxY)) {
      drawZone(ctx, z, view.sandstormActive, nowMs, reducedMotion);
    }
  }

  // 3. Player ground auras & revive rings
  for (let i = 0; i < view.players.length; i += 1) {
    const p = view.players[i];
    if (isInView(p.x, p.y, 240, viewMinX, viewMaxX, viewMinY, viewMaxY)) {
      drawPlayerGroundAuras(ctx, p, nowMs, reducedMotion);
    }
  }

  // 4. Hazard telegraphs
  for (let i = 0; i < view.hazards.length; i += 1) {
    const h = view.hazards[i];
    const minHX = h.endX !== undefined ? Math.min(h.x, h.endX) : h.x;
    const maxHX = h.endX !== undefined ? Math.max(h.x, h.endX) : h.x;
    const minHY = h.endY !== undefined ? Math.min(h.y, h.endY) : h.y;
    const maxHY = h.endY !== undefined ? Math.max(h.y, h.endY) : h.y;
    if (
      maxHX + h.radius >= viewMinX &&
      minHX - h.radius <= viewMaxX &&
      maxHY + h.radius >= viewMinY &&
      minHY - h.radius <= viewMaxY
    ) {
      drawHazard(ctx, h);
    }
  }

  // 5. XP Gems, Pickups & Crates
  for (let i = 0; i < view.xpGems.length; i += 1) {
    const gem = view.xpGems[i];
    if (isInView(gem.x, gem.y, 20, viewMinX, viewMaxX, viewMinY, viewMaxY)) {
      drawXpGem(ctx, gem, nowMs, reducedMotion);
    }
  }

  for (let i = 0; i < view.pickups.length; i += 1) {
    const pk = view.pickups[i];
    if (isInView(pk.x, pk.y, 24, viewMinX, viewMaxX, viewMinY, viewMaxY)) {
      drawPickup(ctx, pk, nowMs, reducedMotion);
    }
  }

  for (let i = 0; i < view.crates.length; i += 1) {
    const crate = view.crates[i];
    if (
      crate.hp > 0 &&
      isInView(crate.x, crate.y, crate.radius + 16, viewMinX, viewMaxX, viewMinY, viewMaxY)
    ) {
      drawCrate(ctx, crate);
    }
  }

  // 6. Obstacles
  for (let i = 0; i < view.obstacles.length; i += 1) {
    const obs = view.obstacles[i];
    if (isInView(obs.x, obs.y, obs.radius + 20, viewMinX, viewMaxX, viewMinY, viewMaxY)) {
      drawObstacle(ctx, obs, mapMeta);
    }
  }

  // 7. Enemies (non-bosses first, bosses on top)
  for (let i = 0; i < view.enemies.length; i += 1) {
    const e = view.enemies[i];
    if (
      !e.isBoss &&
      e.hp > 0 &&
      isInView(e.x, e.y, e.radius + 32, viewMinX, viewMaxX, viewMinY, viewMaxY)
    ) {
      drawEnemy(ctx, e, nowMs, reducedMotion);
    }
  }
  for (let i = 0; i < view.enemies.length; i += 1) {
    const e = view.enemies[i];
    if (
      e.isBoss &&
      e.hp > 0 &&
      isInView(e.x, e.y, e.radius + 64, viewMinX, viewMaxX, viewMinY, viewMaxY)
    ) {
      drawEnemy(ctx, e, nowMs, reducedMotion);
    }
  }

  // 8. Players (remote/bots first, local player on top)
  let localPlayerRef: RenderPlayer | null = null;
  for (let i = 0; i < view.players.length; i += 1) {
    const p = view.players[i];
    if (p.id === localPlayerId) {
      localPlayerRef = p;
      continue;
    }
    if (isInView(p.x, p.y, 120, viewMinX, viewMaxX, viewMinY, viewMaxY)) {
      drawPlayer(ctx, p, false, nowMs, reducedMotion);
    }
  }
  if (
    localPlayerRef &&
    isInView(localPlayerRef.x, localPlayerRef.y, 120, viewMinX, viewMaxX, viewMinY, viewMaxY)
  ) {
    drawPlayer(ctx, localPlayerRef, true, nowMs, reducedMotion);
  }

  // 9. Projectiles, Lightning Arcs, Particles & Floating Damage Numbers
  for (let i = 0; i < view.projectiles.length; i += 1) {
    const proj = view.projectiles[i];
    if (isInView(proj.x, proj.y, proj.radius + 16, viewMinX, viewMaxX, viewMinY, viewMaxY)) {
      drawProjectile(ctx, proj, nowMs, reducedMotion);
    }
  }

  for (let i = 0; i < view.lightningArcs.length; i += 1) {
    const arc = view.lightningArcs[i];
    let anyVisible = false;
    for (let k = 0; k < arc.points.length; k += 1) {
      if (
        isInView(
          arc.points[k].x,
          arc.points[k].y,
          40,
          viewMinX,
          viewMaxX,
          viewMinY,
          viewMaxY,
        )
      ) {
        anyVisible = true;
        break;
      }
    }
    if (anyVisible) {
      drawLightningArc(ctx, arc, nowMs, reducedMotion);
    }
  }

  for (let i = 0; i < view.particles.length; i += 1) {
    const pt = view.particles[i];
    if (!isInView(pt.x, pt.y, pt.radius + 8, viewMinX, viewMaxX, viewMinY, viewMaxY)) {
      continue;
    }
    const fade = clamp01(pt.ttl / Math.max(0.01, pt.maxTtl));
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.radius * (0.4 + 0.6 * fade), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < view.floatingTexts.length; i += 1) {
    const ft = view.floatingTexts[i];
    if (!isInView(ft.x, ft.y, 48, viewMinX, viewMaxX, viewMinY, viewMaxY)) {
      continue;
    }
    const fade = clamp01(ft.ttl / Math.max(0.01, ft.maxTtl));
    ctx.globalAlpha = Math.min(1, fade * 1.35);
    ctx.font = ft.isCrit
      ? '800 17px Fredoka, Nunito, sans-serif'
      : '700 13px Nunito, system-ui, sans-serif';
    ctx.lineWidth = ft.isCrit ? 4 : 3;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.92)';
    const txt = ft.isCrit ? `${ft.text}!` : ft.text;
    ctx.strokeText(txt, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(txt, ft.x, ft.y);
  }
  ctx.restore();

  // 10. Manual Aim Crosshair in World Space
  if (manualAim && aimCursorWorld) {
    ctx.save();
    ctx.translate(aimCursorWorld.x, aimCursorWorld.y);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-9, 0);
    ctx.moveTo(9, 0);
    ctx.lineTo(18, 0);
    ctx.moveTo(0, -18);
    ctx.lineTo(0, -9);
    ctx.moveTo(0, 9);
    ctx.lineTo(0, 18);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore(); // End world-space transform

  // Screen-space overlays
  if (view.sandstormActive) {
    drawSandstormOverlay(ctx, width, height, nowMs, reducedMotion);
  }

  drawBossOffscreenIndicators(
    ctx,
    width,
    height,
    camera,
    view.enemies,
    nowMs,
    reducedMotion,
  );

  // 11. Top-Right Minimap
  drawMinimap(
    ctx,
    width,
    height,
    view,
    camera,
    localPlayerId,
    nowMs,
    reducedMotion,
  );
}
