import { getSafeRadiusAt } from './arenaLayout';
import { canTriggerWeaponSpin } from './combat';
import {
  GRAB_RANGE,
  PUNCH_RANGE,
  SHOVEL_RANGE,
  SWORD_RANGE,
} from './constants';
import type {
  BrawlDifficulty,
  FighterInput,
  FighterStatus,
  WorldItem,
} from './types';

export interface BotEntityView {
  id: string;
  x: number;
  y: number;
  z: number;
  status: FighterStatus;
}

export interface BotMemory {
  nextDecisionAt: number;
  moveX: number;
  moveZ: number;
  targetId: string | null;
  wantGrabUntil: number;
}

export function createInitialBotMemory(): BotMemory {
  return {
    nextDecisionAt: 0,
    moveX: 0,
    moveZ: 0,
    targetId: null,
    wantGrabUntil: 0,
  };
}

const NEUTRAL_INPUT: FighterInput = {
  moveX: 0,
  moveZ: 0,
  sprint: false,
  jump: false,
  punch: false,
  headbutt: false,
  grabHeld: false,
  roll: false,
  emote: null,
};

export function computeBotInput(params: {
  self: BotEntityView;
  others: BotEntityView[];
  items: WorldItem[];
  elapsedSec: number;
  nowSec: number;
  difficulty: BrawlDifficulty;
  memory: BotMemory;
}): FighterInput {
  const { self, others, items, elapsedSec, nowSec, difficulty, memory } = params;

  if (!self.status.alive) return NEUTRAL_INPUT;
  if (self.status.stunnedUntil > nowSec || self.status.frozenUntil > nowSec) {
    return NEUTRAL_INPUT;
  }

  const safeRadius = getSafeRadiusAt(elapsedSec);
  const distFromCenter = Math.hypot(self.x, self.z);
  const livingOthers = others.filter((o) => o.id !== self.id && o.status.alive);

  // Determine reaction interval & imperfection by difficulty
  const thinkInterval =
    difficulty === 'easy' ? 0.38 : difficulty === 'medium' ? 0.2 : 0.08;
  const edgeMargin =
    difficulty === 'easy' ? 0.55 : difficulty === 'medium' ? 1.2 : 1.75;
  const itemSeekChance =
    difficulty === 'easy' ? 0.35 : difficulty === 'medium' ? 0.7 : 0.95;

  let sprint = false;
  let jump = false;
  let punch = false;
  let headbutt = false;
  let grabHeld = false;
  let roll = false;

  // Priority 1: Immediate edge danger -> scramble back toward center
  if (distFromCenter > safeRadius - edgeMargin) {
    const dirX = -self.x / (distFromCenter || 1);
    const dirZ = -self.z / (distFromCenter || 1);
    memory.moveX = dirX;
    memory.moveZ = dirZ;
    sprint = difficulty !== 'easy';
    if (distFromCenter > safeRadius - 0.35 && self.y < 1.15) {
      jump = true;
    }
    if (
      difficulty === 'hard' &&
      distFromCenter > safeRadius - 0.5 &&
      self.status.rollCooldownUntil <= nowSec
    ) {
      roll = true;
    }
    return {
      moveX: memory.moveX,
      moveZ: memory.moveZ,
      sprint,
      jump,
      punch,
      headbutt,
      grabHeld,
      roll,
      emote: null,
    };
  }

  // Priority 2: Currently grabbing someone -> drag toward nearest edge and throw
  if (self.status.grabbingTargetId) {
    const edgeDirLen = distFromCenter || 1;
    const outX = distFromCenter > 0.6 ? self.x / edgeDirLen : 1;
    const outZ = distFromCenter > 0.6 ? self.z / edgeDirLen : 0;
    memory.moveX = outX;
    memory.moveZ = outZ;

    // Throw once reasonably near edge or near end of grab window
    const grabAge = nowSec - self.status.grabStartedAt;
    const closeToEdge = distFromCenter > safeRadius - 2.3;
    grabHeld = !(closeToEdge || grabAge > 1.35);

    return {
      moveX: memory.moveX,
      moveZ: memory.moveZ,
      sprint: false,
      jump: false,
      punch: false,
      headbutt: false,
      grabHeld,
      roll: false,
      emote: null,
    };
  }

  // Pick nearest/best target
  let chosenTarget: BotEntityView | null = null;
  let bestTargetScore = -Infinity;
  for (const enemy of livingOthers) {
    const d = Math.hypot(enemy.x - self.x, enemy.z - self.z);
    const enemyCenterDist = Math.hypot(enemy.x, enemy.z);
    let score = -d;
    if (difficulty !== 'easy') {
      if (enemy.status.stunnedUntil > nowSec) score += 3.5;
      if (enemyCenterDist > safeRadius * 0.65) score += 2.5;
    }
    if (score > bestTargetScore) {
      bestTargetScore = score;
      chosenTarget = enemy;
    }
  }

  // Update steering vector on decision cadence
  if (nowSec >= memory.nextDecisionAt) {
    memory.nextDecisionAt = nowSec + thinkInterval;

    // Check held ranged item first
    const holdingRanged =
      self.status.heldItem === 'snowball' || self.status.heldItem === 'candy_bomb';

    // Look for close safe item if unoccupied
    let bestItem: WorldItem | null = null;
    if (!self.status.heldItem && items.length > 0 && Math.random() < itemSeekChance) {
      let bestItemDist = 7.5;
      for (const item of items) {
        if (item.y > 2.4) continue; // Still parachuting down
        const itemCenterDist = Math.hypot(item.x, item.z);
        if (itemCenterDist > safeRadius - 0.9) continue;
        const d = Math.hypot(item.x - self.x, item.z - self.z);
        if (d < bestItemDist) {
          bestItemDist = d;
          bestItem = item;
        }
      }
    }

    let aimX = 0;
    let aimZ = 0;

    if (bestItem && (!chosenTarget || !holdingRanged)) {
      aimX = bestItem.x - self.x;
      aimZ = bestItem.z - self.z;
    } else if (chosenTarget) {
      aimX = chosenTarget.x - self.x;
      aimZ = chosenTarget.z - self.z;
    } else {
      // Patrol gently near center
      aimX = -self.x;
      aimZ = -self.z;
    }

    const aimLen = Math.hypot(aimX, aimZ) || 1;
    let nx = aimX / aimLen;
    let nz = aimZ / aimLen;

    // Add playful clumsiness jitter (strongest on easy)
    const jitter = difficulty === 'easy' ? 0.55 : difficulty === 'medium' ? 0.22 : 0.06;
    nx += (Math.random() - 0.5) * jitter;
    nz += (Math.random() - 0.5) * jitter;
    const norm = Math.hypot(nx, nz) || 1;
    memory.moveX = nx / norm;
    memory.moveZ = nz / norm;
  }

  // Combat decisions with chosen target
  if (chosenTarget) {
    const distToEnemy = Math.hypot(chosenTarget.x - self.x, chosenTarget.z - self.z);
    const holdingRanged =
      self.status.heldItem === 'snowball' || self.status.heldItem === 'candy_bomb';
    const canSpin = canTriggerWeaponSpin(self.status.heldItem, self.status.heldAmmo);
    const meleeRange =
      self.status.heldItem === 'shovel'
        ? SHOVEL_RANGE
        : self.status.heldItem === 'sword'
          ? SWORD_RANGE
          : PUNCH_RANGE;

    if (holdingRanged && distToEnemy <= 8.5 && Math.random() < (difficulty === 'easy' ? 0.12 : 0.32)) {
      const dx = chosenTarget.x - self.x;
      const dz = chosenTarget.z - self.z;
      const d = Math.hypot(dx, dz) || 1;
      memory.moveX = dx / d;
      memory.moveZ = dz / d;
      punch = true;
    } else if (
      canSpin &&
      difficulty !== 'easy' &&
      distToEnemy <= 2.75 &&
      self.status.spinCooldownUntil <= nowSec &&
      Math.random() < (difficulty === 'hard' ? 0.36 : 0.2)
    ) {
      // Trigger 360° Sword/Shovel Whirlwind Spin via H slot
      headbutt = true;
    } else if (
      !holdingRanged &&
      difficulty !== 'easy' &&
      distToEnemy > meleeRange &&
      distToEnemy <= 3.1 &&
      self.status.dropkickCooldownUntil <= nowSec &&
      Math.random() < (difficulty === 'hard' ? 0.06 : 0.025)
    ) {
      // Party Animals flying dropkick engage!
      jump = true;
      punch = true;
    } else if (distToEnemy <= meleeRange) {
      const wantGrab =
        difficulty !== 'easy' &&
        (chosenTarget.status.stunnedUntil > nowSec ||
          Math.hypot(chosenTarget.x, chosenTarget.z) > safeRadius * 0.6) &&
        distToEnemy <= GRAB_RANGE &&
        memory.wantGrabUntil <= nowSec;

      if (wantGrab && Math.random() < (difficulty === 'hard' ? 0.45 : 0.2)) {
        memory.wantGrabUntil = nowSec + 1.1;
        grabHeld = true;
      } else if (
        !self.status.heldItem &&
        difficulty !== 'easy' &&
        self.status.headbuttCooldownUntil <= nowSec &&
        Math.random() < (difficulty === 'hard' ? 0.32 : 0.16)
      ) {
        headbutt = true;
      } else if (self.status.punchCooldownUntil <= nowSec) {
        punch = Math.random() < (difficulty === 'easy' ? 0.45 : 0.85);
      }
    } else if (distToEnemy > 3.2 && difficulty !== 'easy') {
      sprint = true;
    }

    if (
      difficulty === 'hard' &&
      self.status.rollCooldownUntil <= nowSec &&
      self.status.balance < 45 &&
      distToEnemy < 2.2
    ) {
      roll = true;
    }
  }

  if (nowSec < memory.wantGrabUntil) {
    grabHeld = true;
  }

  return {
    moveX: memory.moveX,
    moveZ: memory.moveZ,
    sprint,
    jump,
    punch,
    headbutt,
    grabHeld,
    roll,
    emote: null,
  };
}
