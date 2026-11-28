import { WORLD_SIZE } from './maps.ts';
import type {
  EnemyEntity,
  MapObstacle,
  PlayerEntity,
  SkillId,
  SkillOffer,
  SurvivalInput,
  SurvivalWorldState,
} from './types.ts';

const BOUNDS_MARGIN = 120;
const REVIVE_SEARCH_RADIUS = 1100;
const REVIVE_HOLD_RADIUS = 38;
const KITE_RADIUS = 210;
const KITE_HARD_RADIUS = 115;
const MAGNET_PICKUP_RADIUS = 480;
const HEAL_PICKUP_RADIUS = 680;
const XP_GEM_RADIUS = 340;
const COHESION_RADIUS = 420;

interface Vec2 {
  x: number;
  y: number;
}

function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Vec2 {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq <= 1e-6) {
    return { x: ax, y: ay };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / abLenSq));
  return { x: ax + abx * t, y: ay + aby * t };
}

const PROJECTILE_EVADE_RANGE = 140;

function computeHazardEvasion(
  world: SurvivalWorldState,
  bot: PlayerEntity,
): { vx: number; vy: number; hasDanger: boolean; dash: boolean } {
  let vx = 0;
  let vy = 0;
  let hasDanger = false;
  let dash = false;

  for (let i = 0; i < world.hazards.length; i++) {
    const h = world.hazards[i];
    if (!h.fromEnemy || h.resolved) continue;

    if (h.shape === 'circle') {
      const dangerRadius = h.radius + bot.radius + 26;
      const dx = bot.x - h.x;
      const dy = bot.y - h.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= dangerRadius) {
        hasDanger = true;
        const nx = dist > 1e-4 ? dx / dist : 1;
        const ny = dist > 1e-4 ? dy / dist : 0;
        const weight = 1.6 + (dangerRadius - dist) / Math.max(1, dangerRadius);
        vx += nx * weight;
        vy += ny * weight;
        if (h.duration - h.elapsed <= 0.35 && bot.dashCooldownTimer <= 0) {
          dash = true;
        }
      }
    } else {
      const endX = h.endX ?? h.x;
      const endY = h.endY ?? h.y;
      const closest = closestPointOnSegment(bot.x, bot.y, h.x, h.y, endX, endY);
      const dangerRadius = h.radius + bot.radius + 20;
      const dx = bot.x - closest.x;
      const dy = bot.y - closest.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= dangerRadius) {
        hasDanger = true;
        let nx: number;
        let ny: number;
        if (dist > 1e-4) {
          nx = dx / dist;
          ny = dy / dist;
        } else {
          const sx = endX - h.x;
          const sy = endY - h.y;
          const sLen = Math.hypot(sx, sy);
          nx = sLen > 1e-4 ? -sy / sLen : 0;
          ny = sLen > 1e-4 ? sx / sLen : 1;
        }
        const weight = 1.6 + (dangerRadius - dist) / Math.max(1, dangerRadius);
        vx += nx * weight;
        vy += ny * weight;
        if (h.duration - h.elapsed <= 0.35 && bot.dashCooldownTimer <= 0) {
          dash = true;
        }
      }
    }
  }

  const evadeRangeSq = PROJECTILE_EVADE_RANGE * PROJECTILE_EVADE_RANGE;
  for (let i = 0; i < world.projectiles.length; i++) {
    const proj = world.projectiles[i];
    if (!proj.fromEnemy) continue;

    const toBotX = bot.x - proj.x;
    const toBotY = bot.y - proj.y;
    const distSq = toBotX * toBotX + toBotY * toBotY;
    if (distSq > evadeRangeSq) continue;

    const speedSq = proj.vx * proj.vx + proj.vy * proj.vy;
    if (speedSq <= 1e-4) continue;

    const dot = toBotX * proj.vx + toBotY * proj.vy;
    const hitOverlap = proj.radius + bot.radius + 8;
    if (dot <= 0 && distSq > hitOverlap * hitOverlap) continue;

    const speed = Math.sqrt(speedSq);
    const dirX = proj.vx / speed;
    const dirY = proj.vy / speed;
    const projAlong = Math.max(0, Math.min(PROJECTILE_EVADE_RANGE, toBotX * dirX + toBotY * dirY));
    const closestX = proj.x + dirX * projAlong;
    const closestY = proj.y + dirY * projAlong;
    const perpX = bot.x - closestX;
    const perpY = bot.y - closestY;
    const perpDist = Math.hypot(perpX, perpY);
    const dangerWidth = proj.radius + bot.radius + 22;

    if (perpDist <= dangerWidth) {
      hasDanger = true;
      const nx = perpDist > 1e-4 ? perpX / perpDist : -dirY;
      const ny = perpDist > 1e-4 ? perpY / perpDist : dirX;
      const dist = Math.sqrt(distSq);
      const weight = 1.4 + (PROJECTILE_EVADE_RANGE - dist) / PROJECTILE_EVADE_RANGE;
      vx += nx * weight;
      vy += ny * weight;
      if (dist <= proj.radius + bot.radius + 48 && bot.dashCooldownTimer <= 0) {
        dash = true;
      }
    }
  }

  return { vx, vy, hasDanger, dash };
}

function findReviveTarget(
  world: SurvivalWorldState,
  bot: PlayerEntity,
): PlayerEntity | null {
  const maxDistSq = REVIVE_SEARCH_RADIUS * REVIVE_SEARCH_RADIUS;
  let bestHuman: PlayerEntity | null = null;
  let bestHumanDistSq = maxDistSq;
  let bestBot: PlayerEntity | null = null;
  let bestBotDistSq = maxDistSq;

  for (let i = 0; i < world.players.length; i++) {
    const p = world.players[i];
    if (p.id === bot.id || !p.downed) continue;
    const dx = p.x - bot.x;
    const dy = p.y - bot.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > maxDistSq) continue;

    if (!p.isBot) {
      if (bestHuman === null || distSq < bestHumanDistSq) {
        bestHuman = p;
        bestHumanDistSq = distSq;
      }
    } else if (bestBot === null || distSq < bestBotDistSq) {
      bestBot = p;
      bestBotDistSq = distSq;
    }
  }

  return bestHuman ?? bestBot;
}

function hasLethalEnemyOverlap(
  enemies: readonly EnemyEntity[],
  bot: PlayerEntity,
): boolean {
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    const dist = Math.hypot(e.x - bot.x, e.y - bot.y);
    if (dist <= bot.radius + e.radius + 10) {
      return true;
    }
    if (
      (e.telegraphKind === 'explode' || e.telegraphKind === 'slam') &&
      e.telegraphTimer > 0 &&
      Math.hypot(e.telegraphX - bot.x, e.telegraphY - bot.y) <=
        e.telegraphRadius + bot.radius + 12
    ) {
      return true;
    }
  }
  return false;
}

function applyBoundsPush(bot: PlayerEntity, vec: Vec2): void {
  const maxBound = WORLD_SIZE - BOUNDS_MARGIN;
  if (bot.x < BOUNDS_MARGIN) {
    vec.x += ((BOUNDS_MARGIN - bot.x) / BOUNDS_MARGIN) * 1.8;
  } else if (bot.x > maxBound) {
    vec.x -= ((bot.x - maxBound) / BOUNDS_MARGIN) * 1.8;
  }

  if (bot.y < BOUNDS_MARGIN) {
    vec.y += ((BOUNDS_MARGIN - bot.y) / BOUNDS_MARGIN) * 1.8;
  } else if (bot.y > maxBound) {
    vec.y -= ((bot.y - maxBound) / BOUNDS_MARGIN) * 1.8;
  }
}

function applyObstacleSlide(
  obstacles: readonly MapObstacle[],
  bot: PlayerEntity,
  vec: Vec2,
): void {
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    const avoidDist = obs.radius + bot.radius + 38;
    const dx = bot.x - obs.x;
    const dy = bot.y - obs.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= avoidDist) continue;

    const nx = dist > 1e-4 ? dx / dist : 1;
    const ny = dist > 1e-4 ? dy / dist : 0;

    // Push out if too close to obstacle skin
    const minGap = obs.radius + bot.radius + 14;
    if (dist < minGap) {
      const push = ((minGap - dist) / Math.max(1, minGap)) * 1.8;
      vec.x += nx * push;
      vec.y += ny * push;
    }

    // Remove inward component so bot slides tangentially around obstacles
    const dot = vec.x * nx + vec.y * ny;
    if (dot < 0) {
      vec.x -= dot * nx;
      vec.y -= dot * ny;
      // Add deterministic tangent nudge when moving nearly head-on
      if (Math.hypot(vec.x, vec.y) < 0.15) {
        vec.x += -ny * 0.6;
        vec.y += nx * 0.6;
      }
    }
  }
}

function findCohesionTarget(
  world: SurvivalWorldState,
  bot: PlayerEntity,
): Vec2 | null {
  let closestHuman: PlayerEntity | null = null;
  let bestHumanDistSq = Infinity;
  let sumX = 0;
  let sumY = 0;
  let aliveTeammates = 0;

  for (let i = 0; i < world.players.length; i++) {
    const p = world.players[i];
    if (p.id === bot.id || p.downed) continue;
    sumX += p.x;
    sumY += p.y;
    aliveTeammates++;

    if (!p.isBot) {
      const dx = p.x - bot.x;
      const dy = p.y - bot.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestHumanDistSq) {
        bestHumanDistSq = distSq;
        closestHuman = p;
      }
    }
  }

  if (closestHuman) {
    return { x: closestHuman.x, y: closestHuman.y };
  }
  if (aliveTeammates > 0) {
    return { x: sumX / aliveTeammates, y: sumY / aliveTeammates };
  }
  return null;
}

export function computeBotInput(
  world: SurvivalWorldState,
  bot: PlayerEntity,
): SurvivalInput {
  if (bot.downed) {
    return {
      moveX: 0,
      moveY: 0,
      aimX: bot.x,
      aimY: bot.y,
      manualAim: false,
      dashPressed: false,
    };
  }

  const aimX = bot.x + Math.cos(bot.aimAngle) * 120;
  const aimY = bot.y + Math.sin(bot.aimAngle) * 120;

  const move: Vec2 = { x: 0, y: 0 };
  let dashPressed = false;

  // 1. Evade imminent danger hazards
  const hazard = computeHazardEvasion(world, bot);
  if (hazard.hasDanger) {
    move.x += hazard.vx;
    move.y += hazard.vy;
    dashPressed = hazard.dash;
  } else {
    // 2. Revive downed teammate if no lethal threat overlaps
    const reviveTarget = findReviveTarget(world, bot);
    if (reviveTarget && !hasLethalEnemyOverlap(world.enemies, bot)) {
      const dx = reviveTarget.x - bot.x;
      const dy = reviveTarget.y - bot.y;
      const dist = Math.hypot(dx, dy);
      if (dist > REVIVE_HOLD_RADIUS) {
        move.x += dx / dist;
        move.y += dy / dist;
      }
    } else {
      // 3. Kiting / Combat separation
      let enemiesInside75 = 0;
      let enemyInside85 = false;
      const hpRatio = bot.hp / Math.max(1, bot.maxHp);

      for (let i = 0; i < world.enemies.length; i++) {
        const e = world.enemies[i];
        const dx = bot.x - e.x;
        const dy = bot.y - e.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= 75) enemiesInside75++;
        if (dist <= 85) enemyInside85 = true;

        if (dist < KITE_RADIUS) {
          const nx = dist > 1e-4 ? dx / dist : 1;
          const ny = dist > 1e-4 ? dy / dist : 0;
          const weight =
            dist < KITE_HARD_RADIUS
              ? 1.5 + (1 - dist / KITE_HARD_RADIUS) * 1.8
              : (1 - dist / KITE_RADIUS) * 1.1;
          move.x += nx * weight;
          move.y += ny * weight;
        }
      }

      if (
        bot.dashCooldownTimer <= 0 &&
        (enemiesInside75 >= 2 || (hpRatio < 0.45 && enemyInside85))
      ) {
        dashPressed = true;
      }

      // 4. Opportunistic pickups (heal when wounded, magnet, nearby XP gems)
      let bestPickupX = 0;
      let bestPickupY = 0;
      let bestPickupScore = 0;
      const wantsHeal = hpRatio < 0.78;

      for (let i = 0; i < world.pickups.length; i++) {
        const pk = world.pickups[i];
        const dx = pk.x - bot.x;
        const dy = pk.y - bot.y;
        const dist = Math.hypot(dx, dy);
        if (pk.kind === 'heal' && wantsHeal && dist <= HEAL_PICKUP_RADIUS) {
          const score = 1.5 * (1 - dist / (HEAL_PICKUP_RADIUS + 40)) + 0.5;
          if (score > bestPickupScore) {
            bestPickupScore = score;
            bestPickupX = dist > 1e-4 ? dx / dist : 0;
            bestPickupY = dist > 1e-4 ? dy / dist : 0;
          }
        } else if (pk.kind === 'magnet' && dist <= MAGNET_PICKUP_RADIUS) {
          const score = 1.25 * (1 - dist / (MAGNET_PICKUP_RADIUS + 40)) + 0.3;
          if (score > bestPickupScore) {
            bestPickupScore = score;
            bestPickupX = dist > 1e-4 ? dx / dist : 0;
            bestPickupY = dist > 1e-4 ? dy / dist : 0;
          }
        }
      }

      if (bestPickupScore > 0) {
        move.x += bestPickupX * 1.25;
        move.y += bestPickupY * 1.25;
      } else {
        let bestGemDistSq = XP_GEM_RADIUS * XP_GEM_RADIUS;
        let bestGemDx = 0;
        let bestGemDy = 0;
        for (let i = 0; i < world.xpGems.length; i++) {
          const gem = world.xpGems[i];
          const dx = gem.x - bot.x;
          const dy = gem.y - bot.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < bestGemDistSq) {
            bestGemDistSq = distSq;
            bestGemDx = dx;
            bestGemDy = dy;
          }
        }
        if (bestGemDistSq < XP_GEM_RADIUS * XP_GEM_RADIUS) {
          const dist = Math.sqrt(bestGemDistSq);
          if (dist > 1e-4) {
            move.x += (bestGemDx / dist) * 0.85;
            move.y += (bestGemDy / dist) * 0.85;
          }
        }
      }

      // 5. Stay cohesive with living human leader / team centroid
      const cohesion = findCohesionTarget(world, bot);
      if (cohesion) {
        const dx = cohesion.x - bot.x;
        const dy = cohesion.y - bot.y;
        const dist = Math.hypot(dx, dy);
        if (dist > COHESION_RADIUS) {
          move.x += (dx / dist) * 0.65;
          move.y += (dy / dist) * 0.65;
        }
      }
    }
  }

  applyBoundsPush(bot, move);
  applyObstacleSlide(world.obstacles, bot, move);

  const len = Math.hypot(move.x, move.y);
  if (len > 1) {
    move.x /= len;
    move.y /= len;
  } else if (len < 1e-4) {
    move.x = 0;
    move.y = 0;
  }

  return {
    moveX: move.x,
    moveY: move.y,
    aimX,
    aimY,
    manualAim: false,
    dashPressed,
  };
}

const RARITY_WEIGHT: Record<SkillOffer['rarity'], number> = {
  common: 0,
  rare: 18,
  epic: 35,
};

const SECONDARY_UNLOCK_SKILLS = new Set<SkillId>([
  'orbital_ice',
  'warm_aura',
  'candy_meteor',
  'plush_drone',
  'whirlwind_blade',
  'frost_nova',
  'glacial_spear',
  'caramel_nova',
  'popcorn_barrage',
  'prism_chain',
  'void_pulse',
  'laser_turret',
]);

const BASE_SKILL_SCORE: Record<SkillId, number> = {
  multishot: 26,
  damage_up: 24,
  fire_rate: 22,
  pierce_up: 20,
  ricochet: 16,
  orbital_ice: 14,
  warm_aura: 14,
  candy_meteor: 16,
  plush_drone: 14,
  team_aura: 20,
  agility: 14,
  vampirism: 12,
  max_hp: 10,
  magnet_range: 8,
  whirlwind_blade: 18,
  vital_regen: 14,
  frost_nova: 16,
  ice_shatter: 22,
  glacial_spear: 18,
  blizzard_ward: 14,
  sugar_rush: 16,
  pepper_bomb: 18,
  caramel_nova: 20,
  popcorn_barrage: 18,
  honey_shield: 14,
  overcharge: 18,
  crystal_shield: 16,
  prism_chain: 18,
  gem_greed: 12,
  void_pulse: 22,
  laser_turret: 20,
  prism_focus: 18,
};

export function pickBotSkillIndex(
  bot: PlayerEntity,
  offers: readonly SkillOffer[],
): number {
  if (offers.length <= 1) return 0;

  const hpRatio = bot.hp / Math.max(1, bot.maxHp);
  const lowHp = hpRatio < 0.65;

  let bestIndex = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < offers.length; i++) {
    const offer = offers[i];
    let score = RARITY_WEIGHT[offer.rarity] + BASE_SKILL_SCORE[offer.skillId];

    if (SECONDARY_UNLOCK_SKILLS.has(offer.skillId) && offer.currentLevel === 0) {
      score += 12;
    }

    if (lowHp) {
      if (offer.skillId === 'max_hp') {
        score += 36;
      } else if (offer.skillId === 'vampirism') {
        score += 32;
      } else if (offer.skillId === 'vital_regen') {
        score += 28;
      } else if (offer.skillId === 'honey_shield') {
        score += 24;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}
