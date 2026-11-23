import {
  ARENA_RINGS,
  HEX_GAP,
  HEX_RADIUS,
  RING_SCHEDULE,
} from './constants';
import type { HexTileSpec } from './types';

const SQRT3 = Math.sqrt(3);

export function generateHexArena(): HexTileSpec[] {
  const tiles: HexTileSpec[] = [];
  const step = HEX_RADIUS + HEX_GAP;

  for (let q = -ARENA_RINGS; q <= ARENA_RINGS; q++) {
    const rMin = Math.max(-ARENA_RINGS, -q - ARENA_RINGS);
    const rMax = Math.min(ARENA_RINGS, -q + ARENA_RINGS);

    for (let r = rMin; r <= rMax; r++) {
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
      // Pointy-top axial to world (x, z)
      const x = step * SQRT3 * (q + r / 2);
      const z = step * 1.5 * r;

      const schedule = RING_SCHEDULE[ring];
      const stagger = ((Math.abs(q * 7 + r * 13)) % 5) * 0.14;

      tiles.push({
        id: `hex_${q}_${r}`,
        q,
        r,
        x,
        z,
        ring,
        warnAtSec: schedule ? schedule.warnAt : Infinity,
        collapseAtSec: schedule ? schedule.collapseAt + stagger : Infinity,
      });
    }
  }

  return tiles;
}

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export function getSpawnPoints(count: number): SpawnPoint[] {
  const safeTotal = Math.max(1, count);
  const spawnRadius = 6.6;
  const points: SpawnPoint[] = [];

  for (let i = 0; i < safeTotal; i++) {
    // Player 0 spawns toward +Z (facing camera-forward -Z)
    const angle = Math.PI / 2 + (i * Math.PI * 2) / safeTotal;
    const x = Math.cos(angle) * spawnRadius;
    const z = Math.sin(angle) * spawnRadius;
    // Facing center (0, 0) where Three.js +Z forward rotates via atan2(-x, -z)
    const yaw = Math.atan2(-x, -z);
    points.push({ x, y: 0.9, z, yaw });
  }

  return points;
}

export function getSafeRadiusAt(elapsedSec: number): number {
  const ringStep = HEX_RADIUS * SQRT3 + HEX_GAP;
  if (elapsedSec >= RING_SCHEDULE[1].warnAt - 1.5) return ringStep * 0.85;
  if (elapsedSec >= RING_SCHEDULE[2].warnAt - 1.5) return ringStep * 1.65;
  if (elapsedSec >= RING_SCHEDULE[3].warnAt - 1.5) return ringStep * 2.55;
  if (elapsedSec >= RING_SCHEDULE[4].warnAt - 1.5) return ringStep * 3.45;
  return ringStep * 4.25;
}

export function getNextCollapseInfo(elapsedSec: number): {
  ring: number | null;
  inSec: number | null;
  warning: boolean;
} {
  const ringsDescending = [4, 3, 2, 1];
  for (const ring of ringsDescending) {
    const sched = RING_SCHEDULE[ring];
    if (elapsedSec < sched.collapseAt + 0.6) {
      return {
        ring,
        inSec: Math.max(0, sched.collapseAt - elapsedSec),
        warning: elapsedSec >= sched.warnAt,
      };
    }
  }
  return { ring: null, inSec: null, warning: false };
}
