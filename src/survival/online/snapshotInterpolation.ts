import type { SkillOffer } from '../sim/types.ts';
import {
  SURVIVAL_INTERPOLATION_DELAY_MS,
  type PackedCrate,
  type PackedEnemy,
  type PackedHazard,
  type PackedLightningArc,
  type PackedPickup,
  type PackedPlayer,
  type PackedProjectile,
  type PackedVisualFx,
  type PackedXpGem,
  type PackedZoneState,
  type SurvivalSnapshotPayload,
} from './protocol.ts';

const MAX_BUFFER_SIZE = 8;

interface SnapshotEntry {
  snapshot: SurvivalSnapshotPayload;
  receivedAtMs: number;
}

function wrapAngle(rad: number): number {
  const twoPi = Math.PI * 2;
  let angle = (((rad + Math.PI) % twoPi) + twoPi) % twoPi - Math.PI;
  if (angle === -Math.PI && rad > 0) {
    angle = Math.PI;
  }
  return Object.is(angle, -0) ? 0 : angle;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Shortest-arc angular interpolation between angles `a` and `b` (in radians),
 * wrapping cleanly across the `-π / +π` discontinuity.
 */
export function lerpAngle(a: number, b: number, t: number): number {
  const delta = wrapAngle(b - a);
  return wrapAngle(a + delta * t);
}

function cloneSecondaryCooldowns(
  cds: PackedPlayer['secondaryCooldowns'],
): PackedPlayer['secondaryCooldowns'] {
  if (!cds) return undefined;
  const out: NonNullable<PackedPlayer['secondaryCooldowns']> = {};
  for (const [k, v] of Object.entries(cds)) {
    if (v) {
      out[k as keyof typeof out] = { ...v };
    }
  }
  return out;
}

function clonePlayer(p: PackedPlayer): PackedPlayer {
  return {
    ...p,
    skills: { ...p.skills },
    ...(p.secondaryCooldowns !== undefined
      ? { secondaryCooldowns: cloneSecondaryCooldowns(p.secondaryCooldowns) }
      : {}),
  };
}

function clonePendingOffers(
  pending: Record<string, SkillOffer[]>,
): Record<string, SkillOffer[]> {
  const cloned: Record<string, SkillOffer[]> = {};
  for (const [playerId, offers] of Object.entries(pending)) {
    const nextOffers = new Array<SkillOffer>(offers.length);
    for (let i = 0; i < offers.length; i += 1) {
      nextOffers[i] = { ...offers[i] };
    }
    cloned[playerId] = nextOffers;
  }
  return cloned;
}

function cloneCrates(crates: readonly PackedCrate[]): PackedCrate[] {
  const out = new Array<PackedCrate>(crates.length);
  for (let i = 0; i < crates.length; i += 1) {
    out[i] = { ...crates[i] };
  }
  return out;
}

function clonePickups(pickups: readonly PackedPickup[]): PackedPickup[] {
  const out = new Array<PackedPickup>(pickups.length);
  for (let i = 0; i < pickups.length; i += 1) {
    out[i] = { ...pickups[i] };
  }
  return out;
}

function cloneHazards(hazards: readonly PackedHazard[]): PackedHazard[] {
  const out = new Array<PackedHazard>(hazards.length);
  for (let i = 0; i < hazards.length; i += 1) {
    out[i] = { ...hazards[i] };
  }
  return out;
}

function cloneLightningArcs(
  arcs: readonly PackedLightningArc[],
): PackedLightningArc[] {
  const out = new Array<PackedLightningArc>(arcs.length);
  for (let i = 0; i < arcs.length; i += 1) {
    const arc = arcs[i];
    const points = new Array<{ x: number; y: number }>(arc.points.length);
    for (let j = 0; j < arc.points.length; j += 1) {
      points[j] = { ...arc.points[j] };
    }
    out[i] = { ...arc, points };
  }
  return out;
}

function cloneVisualEffects(
  effects: readonly PackedVisualFx[],
): PackedVisualFx[] {
  const out = new Array<PackedVisualFx>(effects.length);
  for (let i = 0; i < effects.length; i += 1) {
    out[i] = { ...effects[i] };
  }
  return out;
}

function cloneZones(zones: readonly PackedZoneState[]): PackedZoneState[] {
  const out = new Array<PackedZoneState>(zones.length);
  for (let i = 0; i < zones.length; i += 1) {
    out[i] = { ...zones[i] };
  }
  return out;
}

function cloneSnapshot(s: SurvivalSnapshotPayload): SurvivalSnapshotPayload {
  const players = new Array<PackedPlayer>(s.players.length);
  for (let i = 0; i < s.players.length; i += 1) {
    players[i] = clonePlayer(s.players[i]);
  }

  const enemies = new Array<PackedEnemy>(s.enemies.length);
  for (let i = 0; i < s.enemies.length; i += 1) {
    enemies[i] = { ...s.enemies[i] };
  }

  const projectiles = new Array<PackedProjectile>(s.projectiles.length);
  for (let i = 0; i < s.projectiles.length; i += 1) {
    projectiles[i] = { ...s.projectiles[i] };
  }

  const xpGems = new Array<PackedXpGem>(s.xpGems.length);
  for (let i = 0; i < s.xpGems.length; i += 1) {
    xpGems[i] = { ...s.xpGems[i] };
  }

  return {
    matchId: s.matchId,
    mapId: s.mapId,
    seed: s.seed,
    tick: s.tick,
    elapsedSec: s.elapsedSec,
    phase: s.phase,
    isEndlessActive: s.isEndlessActive,
    score: s.score,
    teamLevel: s.teamLevel,
    teamXp: s.teamXp,
    xpToNext: s.xpToNext,
    bossesSlain: s.bossesSlain,
    nextBossAtSec: s.nextBossAtSec,
    bossWarningSec: s.bossWarningSec,
    bossWarningKind: s.bossWarningKind,
    activeBossId: s.activeBossId,
    sandstormActive: s.sandstormActive,
    levelUpTimerSec: s.levelUpTimerSec,
    pendingOffersByPlayer: clonePendingOffers(s.pendingOffersByPlayer),
    pickedPlayerIds: [...s.pickedPlayerIds],
    players,
    enemies,
    projectiles,
    xpGems,
    crates: cloneCrates(s.crates),
    pickups: clonePickups(s.pickups),
    hazards: cloneHazards(s.hazards),
    lightningArcs: cloneLightningArcs(s.lightningArcs),
    visualEffects: cloneVisualEffects(s.visualEffects),
    zones: cloneZones(s.zones),
  };
}

function interpolatePlayer(
  a: PackedPlayer | undefined,
  b: PackedPlayer,
  t: number,
): PackedPlayer {
  if (!a) return clonePlayer(b);
  return {
    ...b,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    aimAngle: lerpAngle(a.aimAngle, b.aimAngle, t),
    orbitalAngle: lerpAngle(a.orbitalAngle, b.orbitalAngle, t),
    droneAngle: lerpAngle(a.droneAngle, b.droneAngle, t),
    skills: { ...b.skills },
    ...(b.secondaryCooldowns !== undefined
      ? { secondaryCooldowns: cloneSecondaryCooldowns(b.secondaryCooldowns) }
      : {}),
  };
}

function interpolateEnemy(
  a: PackedEnemy | undefined,
  b: PackedEnemy,
  t: number,
): PackedEnemy {
  if (!a) return { ...b };
  return {
    ...b,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
}

function interpolateProjectile(
  a: PackedProjectile | undefined,
  b: PackedProjectile,
  t: number,
): PackedProjectile {
  if (!a) return { ...b };
  const aAngle = a.angle;
  const bAngle = b.angle;
  if (aAngle !== undefined && bAngle !== undefined) {
    return {
      ...b,
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      angle: lerpAngle(aAngle, bAngle, t),
    };
  }
  return {
    ...b,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
}

function interpolateXpGem(
  a: PackedXpGem | undefined,
  b: PackedXpGem,
  t: number,
): PackedXpGem {
  if (!a) return { ...b };
  return {
    ...b,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
}

/**
 * Guest-side snapshot jitter buffer storing up to 4 recent Host snapshots
 * and interpolating smoothly at `localNowMs - delayMs`.
 */
export class SurvivalSnapshotInterpolator {
  private entries: SnapshotEntry[] = [];
  private readonly playerScratch = new Map<string, PackedPlayer>();
  private readonly enemyScratch = new Map<string, PackedEnemy>();
  private readonly projScratch = new Map<string, PackedProjectile>();
  private readonly gemScratch = new Map<string, PackedXpGem>();

  reset(): void {
    this.entries.length = 0;
    this.playerScratch.clear();
    this.enemyScratch.clear();
    this.projScratch.clear();
    this.gemScratch.clear();
  }

  push(snapshot: SurvivalSnapshotPayload, localNowMs: number): void {
    const safeNowMs = Number.isFinite(localNowMs) ? localNowMs : 0;
    if (!Number.isFinite(snapshot.tick)) return;

    const prev = this.entries[this.entries.length - 1];
    if (prev && prev.snapshot.matchId !== snapshot.matchId) {
      this.entries.length = 0;
    }

    const last = this.entries[this.entries.length - 1];
    if (last && snapshot.tick <= last.snapshot.tick) {
      return;
    }

    const monotonicReceivedAtMs = last
      ? Math.max(safeNowMs, last.receivedAtMs)
      : safeNowMs;

    this.entries.push({
      snapshot: cloneSnapshot(snapshot),
      receivedAtMs: monotonicReceivedAtMs,
    });

    while (this.entries.length > MAX_BUFFER_SIZE) {
      this.entries.shift();
    }
  }

  private interpolateSnapshots(
    a: SurvivalSnapshotPayload,
    b: SurvivalSnapshotPayload,
    t: number,
  ): SurvivalSnapshotPayload {
    const playerById = this.playerScratch;
    const enemyById = this.enemyScratch;
    const projById = this.projScratch;
    const gemById = this.gemScratch;

    playerById.clear();
    for (let i = 0; i < a.players.length; i += 1) {
      const p = a.players[i];
      playerById.set(p.id, p);
    }

    enemyById.clear();
    for (let i = 0; i < a.enemies.length; i += 1) {
      const e = a.enemies[i];
      enemyById.set(e.id, e);
    }

    projById.clear();
    for (let i = 0; i < a.projectiles.length; i += 1) {
      const pr = a.projectiles[i];
      projById.set(pr.id, pr);
    }

    gemById.clear();
    for (let i = 0; i < a.xpGems.length; i += 1) {
      const g = a.xpGems[i];
      gemById.set(g.id, g);
    }

    const players = new Array<PackedPlayer>(b.players.length);
    for (let i = 0; i < b.players.length; i += 1) {
      const p = b.players[i];
      players[i] = interpolatePlayer(playerById.get(p.id), p, t);
    }

    const enemies = new Array<PackedEnemy>(b.enemies.length);
    for (let i = 0; i < b.enemies.length; i += 1) {
      const e = b.enemies[i];
      enemies[i] = interpolateEnemy(enemyById.get(e.id), e, t);
    }

    const projectiles = new Array<PackedProjectile>(b.projectiles.length);
    for (let i = 0; i < b.projectiles.length; i += 1) {
      const pr = b.projectiles[i];
      projectiles[i] = interpolateProjectile(projById.get(pr.id), pr, t);
    }

    const xpGems = new Array<PackedXpGem>(b.xpGems.length);
    for (let i = 0; i < b.xpGems.length; i += 1) {
      const g = b.xpGems[i];
      xpGems[i] = interpolateXpGem(gemById.get(g.id), g, t);
    }

    playerById.clear();
    enemyById.clear();
    projById.clear();
    gemById.clear();

    return {
      matchId: b.matchId,
      mapId: b.mapId,
      seed: b.seed,
      tick: b.tick,
      elapsedSec: lerp(a.elapsedSec, b.elapsedSec, t),
      phase: b.phase,
      isEndlessActive: b.isEndlessActive,
      score: b.score,
      teamLevel: b.teamLevel,
      teamXp: b.teamXp,
      xpToNext: b.xpToNext,
      bossesSlain: b.bossesSlain,
      nextBossAtSec: b.nextBossAtSec,
      bossWarningSec: b.bossWarningSec,
      bossWarningKind: b.bossWarningKind,
      activeBossId: b.activeBossId,
      sandstormActive: b.sandstormActive,
      levelUpTimerSec: b.levelUpTimerSec,
      pendingOffersByPlayer: clonePendingOffers(b.pendingOffersByPlayer),
      pickedPlayerIds: [...b.pickedPlayerIds],
      players,
      enemies,
      projectiles,
      xpGems,
      crates: cloneCrates(b.crates),
      pickups: clonePickups(b.pickups),
      hazards: cloneHazards(b.hazards),
      lightningArcs: cloneLightningArcs(b.lightningArcs),
      visualEffects: cloneVisualEffects(b.visualEffects),
      zones: cloneZones(b.zones),
    };
  }

  sample(
    localNowMs: number,
    delayMs: number = SURVIVAL_INTERPOLATION_DELAY_MS,
  ): SurvivalSnapshotPayload | null {
    const count = this.entries.length;
    if (count === 0) {
      return null;
    }
    if (count === 1) {
      return cloneSnapshot(this.entries[0].snapshot);
    }

    const targetTime = localNowMs - delayMs;
    const first = this.entries[0];
    const last = this.entries[count - 1];

    if (targetTime <= first.receivedAtMs) {
      return cloneSnapshot(first.snapshot);
    }
    if (targetTime >= last.receivedAtMs) {
      return cloneSnapshot(last.snapshot);
    }

    for (let i = 0; i < count - 1; i += 1) {
      const lower = this.entries[i];
      const upper = this.entries[i + 1];
      if (targetTime >= lower.receivedAtMs && targetTime <= upper.receivedAtMs) {
        const span = upper.receivedAtMs - lower.receivedAtMs;
        if (span <= 0) {
          return cloneSnapshot(upper.snapshot);
        }
        const t = Math.max(
          0,
          Math.min(1, (targetTime - lower.receivedAtMs) / span),
        );
        return this.interpolateSnapshots(lower.snapshot, upper.snapshot, t);
      }
    }

    return cloneSnapshot(last.snapshot);
  }
}
