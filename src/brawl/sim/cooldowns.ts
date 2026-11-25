export interface CooldownProgress {
  readyPct: number;
  remainingSec: number;
}

/**
 * Compute normalized readiness [0..1] and remaining seconds for an action cooldown.
 */
export function getCooldownState(
  cooldownUntil: number,
  nowSec: number,
  totalCooldownSec: number,
): CooldownProgress {
  if (totalCooldownSec <= 0 || nowSec >= cooldownUntil) {
    return { readyPct: 1, remainingSec: 0 };
  }
  const remainingSec = Math.max(0, cooldownUntil - nowSec);
  const readyPct = 1 - Math.min(1, remainingSec / totalCooldownSec);
  return { readyPct, remainingSec };
}

/**
 * Format remaining cooldown seconds concisely for compact HUD skill slots.
 */
export function formatCooldownLabel(remainingSec: number): string {
  if (remainingSec <= 0.04) return '';
  return `${remainingSec.toFixed(1)}s`;
}
