import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatCooldownLabel, getCooldownState } from '../cooldowns.ts';

describe('brawl cooldown progress helpers', () => {
  it('returns readyPct=1 and remainingSec=0 when cooldown has elapsed or duration is invalid', () => {
    assert.deepEqual(getCooldownState(5.0, 5.0, 1.5), {
      readyPct: 1,
      remainingSec: 0,
    });
    assert.deepEqual(getCooldownState(4.2, 6.0, 1.5), {
      readyPct: 1,
      remainingSec: 0,
    });
    assert.deepEqual(getCooldownState(10.0, 5.0, 0), {
      readyPct: 1,
      remainingSec: 0,
    });
  });

  it('clamps remaining progress smoothly between 0 and 1 during cooldown', () => {
    const mid = getCooldownState(10.75, 10.0, 1.5);
    assert.ok(Math.abs(mid.remainingSec - 0.75) < 1e-6);
    assert.ok(Math.abs(mid.readyPct - 0.5) < 1e-6);

    const freshOverflow = getCooldownState(15.0, 10.0, 1.5);
    assert.equal(freshOverflow.readyPct, 0);
    assert.equal(freshOverflow.remainingSec, 5.0);
  });

  it('formats active cooldown seconds concisely for skill slots', () => {
    assert.equal(formatCooldownLabel(0), '');
    assert.equal(formatCooldownLabel(0.03), '');
    assert.equal(formatCooldownLabel(1.14), '1.1s');
    assert.equal(formatCooldownLabel(0.42), '0.4s');
  });
});
