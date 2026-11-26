import {
  MAX_BALANCE,
  SHIELD_KNOCKBACK_MULT,
  STUN_BASE_SEC,
  STUN_MAX_SEC,
} from './constants.ts';
import type { FighterStatus, HeldWeaponKind, ItemKind } from './types.ts';

export interface ItemMetaInfo {
  label: string;
  emoji: string;
  color: string;
  isPawsCard: boolean;
  shortHint: string;
}

export const ITEM_META: Record<ItemKind, ItemMetaInfo> = {
  snowball: {
    label: 'Cục Tuyết',
    emoji: '❄️',
    color: '#38BDF8',
    isPawsCard: false,
    shortHint: 'Ném đẩy lùi (x3)',
  },
  sword: {
    label: 'Kiếm Băng',
    emoji: '⚔️',
    color: '#38BDF8',
    isPawsCard: false,
    shortHint: 'Chém nhanh + H xoay 360° (x5)',
  },
  shovel: {
    label: 'Xẻng Tuyết',
    emoji: '⛏️',
    color: '#F59E0B',
    isPawsCard: false,
    shortHint: 'Đập mạnh + H xoay 360° (x4)',
  },
  skates: {
    label: 'Giày Trượt Băng',
    emoji: '⛸️',
    color: '#67E8F9',
    isPawsCard: false,
    shortHint: 'Tăng tốc 6s',
  },
  shield: {
    label: 'Khiên Nắp Thùng',
    emoji: '🛡️',
    color: '#FBBF24',
    isPawsCard: false,
    shortHint: 'Giảm đẩy lùi 5s',
  },
  candy_bomb: {
    label: 'Bom Kẹo',
    emoji: '💣',
    color: '#FB7185',
    isPawsCard: false,
    shortHint: 'Ném nổ sau 2s',
  },
  card_freeze: {
    label: 'Thẻ Kem Đá',
    emoji: '🧊',
    color: '#60A5FA',
    isPawsCard: true,
    shortHint: 'Đóng băng địch gần nhất 2s',
  },
  card_taser: {
    label: 'Thẻ Tia Chớp',
    emoji: '⚡',
    color: '#FACC15',
    isPawsCard: true,
    shortHint: 'Choáng xung quanh',
  },
};

export function canTriggerWeaponSpin(
  heldItem: HeldWeaponKind,
  heldAmmo: number,
): boolean {
  return (heldItem === 'sword' || heldItem === 'shovel') && heldAmmo > 0;
}

export function createInitialFighterStatus(id: string): FighterStatus {
  return {
    id,
    alive: true,
    balance: MAX_BALANCE,
    maxBalance: MAX_BALANCE,
    stunnedUntil: 0,
    stunImmuneUntil: 0,
    frozenUntil: 0,
    speedBoostUntil: 0,
    shieldUntil: 0,
    rollCooldownUntil: 0,
    punchCooldownUntil: 0,
    headbuttCooldownUntil: 0,
    spinCooldownUntil: 0,
    dropkickCooldownUntil: 0,
    heldItem: null,
    heldAmmo: 0,
    grabbingTargetId: null,
    grabbedById: null,
    grabStartedAt: 0,
    emote: null,
    emoteUntil: 0,
  };
}

export interface HitOutcome {
  nextBalance: number;
  nextStunnedUntil: number;
  justStunned: boolean;
  impulseX: number;
  impulseY: number;
  impulseZ: number;
}

export function computeHitOutcome(params: {
  dirX: number;
  dirZ: number;
  baseKnockback: number;
  upBoost: number;
  balanceDmg: number;
  target: FighterStatus;
  nowSec: number;
}): HitOutcome {
  const { dirX, dirZ, baseKnockback, upBoost, balanceDmg, target, nowSec } = params;
  const len = Math.hypot(dirX, dirZ) || 1;
  const nx = dirX / len;
  const nz = dirZ / len;

  const hasShield = target.shieldUntil > nowSec;
  const alreadyStunned = target.stunnedUntil > nowSec;
  const isWakeupImmune = target.stunImmuneUntil > nowSec;

  const shieldMult = hasShield ? SHIELD_KNOCKBACK_MULT : 1;
  // Prevent stunlock: reduced knockback while down or waking up, no balance drain / stun refresh while down or immune
  const stateKnockbackMult = isWakeupImmune ? 0.45 : alreadyStunned ? 0.75 : 1;
  const totalKnockback = baseKnockback * shieldMult * stateKnockbackMult;

  const canDrainBalance = !alreadyStunned && !isWakeupImmune;
  const effectiveDmg = canDrainBalance
    ? hasShield
      ? balanceDmg * 0.45
      : balanceDmg
    : 0;
  let nextBalance = target.balance - effectiveDmg;
  let nextStunnedUntil = target.stunnedUntil;
  let justStunned = false;

  if (canDrainBalance && nextBalance <= 0) {
    const stunDuration = Math.min(
      STUN_MAX_SEC,
      STUN_BASE_SEC + Math.abs(nextBalance) * 0.01,
    );
    nextStunnedUntil = nowSec + stunDuration;
    nextBalance = target.maxBalance;
    justStunned = true;
  }

  return {
    nextBalance,
    nextStunnedUntil,
    justStunned,
    impulseX: nx * totalKnockback,
    impulseY: upBoost * (hasShield ? 0.6 : 1),
    impulseZ: nz * totalKnockback,
  };
}

const WEIGHTED_POOL: Array<{ kind: ItemKind; weight: number }> = [
  { kind: 'sword', weight: 17 },
  { kind: 'shovel', weight: 16 },
  { kind: 'snowball', weight: 15 },
  { kind: 'candy_bomb', weight: 14 },
  { kind: 'skates', weight: 11 },
  { kind: 'shield', weight: 11 },
  { kind: 'card_freeze', weight: 8 },
  { kind: 'card_taser', weight: 8 },
];

const TOTAL_WEIGHT = WEIGHTED_POOL.reduce((acc, e) => acc + e.weight, 0);

export function pickRandomItemKind(rng: () => number = Math.random): ItemKind {
  let roll = rng() * TOTAL_WEIGHT;
  for (const entry of WEIGHTED_POOL) {
    roll -= entry.weight;
    if (roll <= 0) return entry.kind;
  }
  return 'snowball';
}
