import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySkillPick,
  buildHudSnapshot,
  buildMatchSummary,
  continueEndlessMode,
  createSurvivalWorld,
  stepSurvivalWorld,
} from '../engine.ts';
import type { SurvivalInput, SurvivalWorldState } from '../types.ts';

const IDLE_INPUT: SurvivalInput = {
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  manualAim: false,
  dashPressed: false,
};

function stepSeconds(
  world: SurvivalWorldState,
  totalSec: number,
  dt = 0.05,
  keepAlive = true,
): Array<ReturnType<typeof stepSurvivalWorld>[number]> {
  const allEvents: Array<ReturnType<typeof stepSurvivalWorld>[number]> = [];
  const steps = Math.round(totalSec / dt);
  for (let i = 0; i < steps; i++) {
    if (keepAlive) {
      for (const p of world.players) {
        p.hp = p.maxHp;
        p.downed = false;
        p.invulnTimer = 1.0;
      }
    }
    const events = stepSurvivalWorld(world, { p1: IDLE_INPUT }, dt);
    for (const ev of events) {
      allEvents.push(ev);
    }
    if (world.phase === 'levelup') {
      for (const p of world.players) {
        if (!p.isBot) {
          applySkillPick(world, p.id, 0);
        }
      }
    }
    if (world.phase === 'victory' || world.phase === 'gameover') {
      break;
    }
  }
  return allEvents;
}

describe('survival bosses, waves & endless mode', () => {
  it('spawns campaign bosses at 90s, 210s, 330s with 5s warnings and transitions to victory + continueEndlessMode', () => {
    const world = createSurvivalWorld({
      matchId: 'm-campaign',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 101,
      players: [
        {
          id: 'p1',
          name: 'Hero',
          animal: 'cat',
          weaponId: 'frost_bow',
          gearId: 'golden_scope',
          isBot: false,
        },
      ],
    });

    // Advance to 84s: no boss or warning yet
    stepSeconds(world, 84);
    assert.equal(world.activeBossId, null);
    assert.equal(world.bossWarningSec, 0);

    // Advance 2s (to 86s): 5s warning window active
    const warnEvents = stepSeconds(world, 2);
    assert.ok(warnEvents.some((e) => e.type === 'boss_warn' && e.bossKind === 'boss_slime_king'));
    assert.ok(world.bossWarningSec > 0 && world.bossWarningSec <= 5);
    const hudWarn = buildHudSnapshot(world, 'p1');
    assert.ok(hudWarn.bossWarningName !== null);

    // Advance 5s (to 91s): boss_slime_king spawns
    const spawn1Events = stepSeconds(world, 5);
    assert.ok(spawn1Events.some((e) => e.type === 'boss_spawn' && e.bossKind === 'boss_slime_king'));
    const boss1 = world.enemies.find((e) => e.id === world.activeBossId);
    assert.ok(boss1);
    assert.equal(boss1.kind, 'boss_slime_king');
    assert.equal(boss1.isBoss, true);

    // Let boss_slime_king run AI across 5s and observe slam telegraph + mini slimes
    let sawSlamHazard = false;
    for (let i = 0; i < 100; i++) {
      stepSeconds(world, 0.05);
      if (world.hazards.some((h) => h.fromEnemy && h.shape === 'circle')) {
        sawSlamHazard = true;
      }
    }
    assert.equal(sawSlamHazard, true, 'slime king places slam telegraph');
    assert.ok(world.enemies.filter((e) => e.kind === 'slime').length >= 4, 'slime king spawns mini slimes');

    // Kill boss 1 manually with fatal damage next tick
    boss1.hp = 1;
    boss1.x = world.players[0].x + 60;
    boss1.y = world.players[0].y;
    world.players[0].fireCooldown = 0;
    let killedBoss1 = false;
    for (let i = 0; i < 30; i++) {
      const ev = stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
      if (ev.some((e) => e.type === 'boss_kill' && e.bossKind === 'boss_slime_king')) {
        killedBoss1 = true;
      }
      if (world.phase === 'levelup') {
        // Boss chest should guarantee rare/epic offers (never common)
        for (const offer of world.pendingOffersByPlayer.p1) {
          assert.notEqual(offer.rarity, 'common');
        }
        applySkillPick(world, 'p1', 0);
      }
      if (killedBoss1) break;
    }
    assert.equal(killedBoss1, true);
    assert.equal(world.bossesSlain, 1);
    assert.equal(world.nextBossAtSec, 210);

    // Fast forward to 210s -> boss_frost_bear spawns
    const until211 = 211 - world.elapsedSec;
    const spawn2Events = stepSeconds(world, until211);
    assert.ok(spawn2Events.some((e) => e.type === 'boss_spawn' && e.bossKind === 'boss_frost_bear'));
    const boss2 = world.enemies.find((e) => e.id === world.activeBossId);
    assert.ok(boss2 && boss2.kind === 'boss_frost_bear');

    // Let frost bear execute line charge telegraph
    let sawChargeHazard = false;
    for (let i = 0; i < 90; i++) {
      stepSeconds(world, 0.05);
      if (world.hazards.some((h) => h.fromEnemy && h.shape === 'line')) {
        sawChargeHazard = true;
      }
    }
    assert.equal(sawChargeHazard, true, 'frost bear places charge line telegraph');

    // Defeat frost bear
    boss2.hp = 1;
    boss2.x = world.players[0].x + 60;
    boss2.y = world.players[0].y;
    world.players[0].fireCooldown = 0;
    for (let i = 0; i < 30; i++) {
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
      if (world.phase === 'levelup') applySkillPick(world, 'p1', 0);
      if (world.bossesSlain >= 2) break;
    }
    assert.equal(world.bossesSlain, 2);
    assert.equal(world.nextBossAtSec, 330);

    // Fast forward to 330s -> boss_snow_dragon spawns
    const until331 = 331 - world.elapsedSec;
    const spawn3Events = stepSeconds(world, until331);
    assert.ok(spawn3Events.some((e) => e.type === 'boss_spawn' && e.bossKind === 'boss_snow_dragon'));
    const boss3 = world.enemies.find((e) => e.id === world.activeBossId);
    assert.ok(boss3 && boss3.kind === 'boss_snow_dragon');

    // Defeat snow dragon -> campaign victory!
    boss3.hp = 1;
    boss3.x = world.players[0].x + 60;
    boss3.y = world.players[0].y;
    world.players[0].fireCooldown = 0;
    let won = false;
    let victoryTickEvents: ReturnType<typeof stepSurvivalWorld> = [];
    for (let i = 0; i < 30; i++) {
      const ev = stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
      if (ev.some((e) => e.type === 'victory')) {
        won = true;
        victoryTickEvents = ev;
        break;
      }
    }
    assert.equal(won, true);
    assert.equal(world.phase, 'victory');
    assert.equal(world.activeBossId, null, 'victory tick must clear activeBossId');
    assert.equal(
      victoryTickEvents.some((e) => e.type === 'boss_spawn'),
      false,
      'victory tick must not spawn a second boss',
    );
    assert.equal(
      world.enemies.filter((e) => e.isBoss).length,
      0,
      'zero bosses should remain in world.enemies on victory tick',
    );
    assert.ok(world.bossScheduleIndex >= 3);
    assert.ok(world.nextBossAtSec >= 420);
    assert.equal(buildMatchSummary(world).victory, true);

    // Continue into Endless mode and step forward: no phantom dragon chases player
    world.players[0].downed = true;
    world.players[0].hp = 0;
    continueEndlessMode(world);
    assert.equal(world.isEndlessActive, true);
    assert.equal(world.phase, 'playing');
    assert.equal(world.players[0].downed, false);
    assert.equal(world.players[0].hp, Math.round(world.players[0].maxHp * 0.6));
    assert.ok(world.nextBossAtSec >= 420);
    stepSeconds(world, 0.5);
    assert.equal(world.activeBossId, null);
    assert.equal(world.enemies.filter((e) => e.isBoss).length, 0);
  });

  it('cycles bosses every 90s on endless_abyss with rising tier and scales endless score', () => {
    const world = createSurvivalWorld({
      matchId: 'm-endless',
      mode: 'solo',
      mapId: 'endless_abyss',
      seed: 555,
      players: [
        {
          id: 'p1',
          name: 'EndlessHero',
          animal: 'dino',
          weaponId: 'candy_smg',
          gearId: 'ice_skates',
          isBot: false,
        },
      ],
    });
    assert.equal(world.isEndlessActive, true);

    // 90s -> boss_slime_king tier 1
    stepSeconds(world, 91);
    const b1 = world.enemies.find((e) => e.id === world.activeBossId);
    assert.ok(b1);
    assert.equal(b1.kind, 'boss_slime_king');
    assert.equal(b1.bossTier, 1);
    const b1MaxHp = b1.maxHp;

    // Kill boss 1 -> nextBossAtSec === 180
    b1.hp = 1;
    b1.x = world.players[0].x + 50;
    b1.y = world.players[0].y;
    world.players[0].fireCooldown = 0;
    for (let i = 0; i < 30; i++) {
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
      if (world.phase === 'levelup') applySkillPick(world, 'p1', 0);
      if (world.activeBossId === null) break;
    }
    assert.equal(world.nextBossAtSec, 180);

    // 180s -> boss_frost_bear tier 2
    stepSeconds(world, 181 - world.elapsedSec);
    const b2 = world.enemies.find((e) => e.id === world.activeBossId);
    assert.ok(b2);
    assert.equal(b2.kind, 'boss_frost_bear');
    assert.equal(b2.bossTier, 2);

    b2.hp = 1;
    b2.x = world.players[0].x + 50;
    b2.y = world.players[0].y;
    world.players[0].fireCooldown = 0;
    for (let i = 0; i < 30; i++) {
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
      if (world.phase === 'levelup') applySkillPick(world, 'p1', 0);
      if (world.activeBossId === null) break;
    }
    assert.equal(world.nextBossAtSec, 270);

    // 270s -> boss_snow_dragon tier 3
    stepSeconds(world, 271 - world.elapsedSec);
    const b3 = world.enemies.find((e) => e.id === world.activeBossId);
    assert.ok(b3);
    assert.equal(b3.kind, 'boss_snow_dragon');
    assert.equal(b3.bossTier, 3);

    b3.hp = 1;
    b3.x = world.players[0].x + 50;
    b3.y = world.players[0].y;
    world.players[0].fireCooldown = 0;
    for (let i = 0; i < 30; i++) {
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
      if (world.phase === 'levelup') applySkillPick(world, 'p1', 0);
      if (world.activeBossId === null) break;
    }
    // Must NOT enter victory on endless_abyss
    assert.equal(world.phase, 'playing');
    assert.equal(world.nextBossAtSec, 360);

    // 360s -> cycles back to boss_slime_king at tier 4 with much higher HP
    stepSeconds(world, 361 - world.elapsedSec);
    const b4 = world.enemies.find((e) => e.id === world.activeBossId);
    assert.ok(b4);
    assert.equal(b4.kind, 'boss_slime_king');
    assert.equal(b4.bossTier, 4);
    assert.ok(b4.maxHp > b1MaxHp * 2, 'tier 4 boss HP should scale substantially over tier 1');

    // Score should reflect kills, 3 boss kills (1500+3000+4500), and endless survival time
    const summary = buildMatchSummary(world);
    assert.equal(summary.victory, false);
    assert.equal(summary.isEndless, true);
    assert.equal(summary.bossesSlain, 3);
    assert.ok(summary.score >= 1500 * (1 + 2 + 3) + 1800);
  });

  it('unlocks enemy tiers progressively and caps active enemies for 60fps stability', () => {
    const world = createSurvivalWorld({
      matchId: 'm-waves',
      mode: 'bot_team',
      mapId: 'winter_cabin',
      seed: 888,
      players: [
        { id: 'p1', name: 'P1', animal: 'cat', weaponId: 'candy_smg', gearId: 'ice_skates', isBot: false },
        { id: 'p2', name: 'B1', animal: 'dog', weaponId: 'frost_bow', gearId: 'plush_armor', isBot: true },
      ],
    });
    // Disable player weapons so wave pool stays observable
    for (const p of world.players) p.fireCooldown = 9999;

    // Early wave (0..20s): only slimes
    stepSeconds(world, 15);
    assert.ok(world.enemies.length > 0);
    for (const e of world.enemies) {
      assert.equal(e.kind, 'slime');
    }

    // Advance past 275s so all regular enemy types unlock (slime..bomber)
    world.elapsedSec = 275;
    world.nextBossAtSec = 9999; // isolate regular waves
    world.enemies = [];
    for (let i = 0; i < 400; i++) {
      for (const p of world.players) {
        p.hp = p.maxHp;
        p.downed = false;
        p.invulnTimer = 1;
        p.fireCooldown = 9999;
      }
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
    }
    const maxFor2Players = Math.min(220, 160 + (2 - 1) * 20);
    assert.ok(world.enemies.length <= maxFor2Players, `enemy count ${world.enemies.length} exceeded cap ${maxFor2Players}`);
    const kinds = new Set(world.enemies.map((e) => e.kind));
    assert.ok(kinds.size >= 4, `expected diverse unlocked enemy types late game, got ${[...kinds].join(',')}`);
  });

  it('executes Snow Dragon AI patterns (volley, ice hazards, charge) and regular enemy behaviors (wolf, owl_mage, bomber)', () => {
    const world = createSurvivalWorld({
      matchId: 'm-behaviors',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 901,
      players: [
        { id: 'p1', name: 'Tester', animal: 'cat', weaponId: 'candy_smg', gearId: 'plush_armor', isBot: false },
      ],
    });
    world.obstacles = [];
    world.crates = [];
    world.spawnTimer = 9999;
    world.nextBossAtSec = 9999;
    const p1 = world.players[0];
    p1.fireCooldown = 9999;

    // 1. Snow Dragon AI: spawn at elapsedSec 330 with bossScheduleIndex = 2
    world.elapsedSec = 330;
    world.bossScheduleIndex = 2;
    world.nextBossAtSec = 330;
    stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
    const dragon = world.enemies.find((e) => e.kind === 'boss_snow_dragon');
    assert.ok(dragon, 'boss_snow_dragon should spawn at 330s');
    dragon.x = p1.x + 280;
    dragon.y = p1.y;

    let sawVolley = false;
    let sawDragonCircleHazards = false;
    let sawDragonChargeLine = false;
    for (let i = 0; i < 240; i++) {
      p1.hp = p1.maxHp;
      p1.invulnTimer = 1;
      p1.fireCooldown = 9999;
      world.spawnTimer = 9999;
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
      if (world.projectiles.filter((pr) => pr.weaponId === 'enemy_dragon').length >= 12) {
        sawVolley = true;
      }
      if (world.hazards.filter((h) => h.fromEnemy && h.shape === 'circle').length >= 3) {
        sawDragonCircleHazards = true;
      }
      if (world.hazards.some((h) => h.fromEnemy && h.shape === 'line' && h.ownerId === dragon.id)) {
        sawDragonChargeLine = true;
      }
    }
    assert.equal(sawVolley, true, 'snow dragon should fire 12-bullet volley');
    assert.equal(sawDragonCircleHazards, true, 'snow dragon should spawn multiple ice circle hazards');
    assert.equal(sawDragonChargeLine, true, 'snow dragon should execute line charge');

    // 2. Wolf lunge, Owl Mage orb, Bomber explosion & mid-windup cancellation
    world.enemies = [];
    world.projectiles = [];
    world.hazards = [];
    world.elapsedSec = 275;
    world.nextBossAtSec = 9999;
    world.activeBossId = null;

    // Spawn from wave pool at elapsedSec = 275 until wolf, owl_mage, and bomber are present
    for (let attempt = 0; attempt < 200; attempt++) {
      p1.hp = p1.maxHp;
      p1.invulnTimer = 1;
      p1.fireCooldown = 9999;
      world.spawnTimer = 0;
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
      const hasWolf = world.enemies.some((e) => e.kind === 'wolf');
      const hasOwl = world.enemies.some((e) => e.kind === 'owl_mage');
      const hasBomber = world.enemies.some((e) => e.kind === 'bomber');
      if (hasWolf && hasOwl && hasBomber) break;
    }

    const wolf = world.enemies.find((e) => e.kind === 'wolf')!;
    const owl = world.enemies.find((e) => e.kind === 'owl_mage')!;
    const bomber = world.enemies.find((e) => e.kind === 'bomber')!;
    assert.ok(wolf && owl && bomber, 'wave spawner should produce wolf, owl_mage, and bomber at 275s');

    // Isolate just those three enemies
    world.enemies = [wolf, owl, bomber];
    world.hazards = [];
    world.projectiles = [];

    wolf.x = p1.x + 140;
    wolf.y = p1.y;
    wolf.attackCooldown = 0;

    owl.x = p1.x - 280;
    owl.y = p1.y;
    owl.attackCooldown = 0;

    bomber.x = p1.x;
    bomber.y = p1.y + 65;

    let sawWolfLunge = false;
    let sawOwlOrb = false;
    let sawBomberExplodeTelegraph = false;

    for (let i = 0; i < 40; i++) {
      if (i < 15) {
        p1.hp = 500;
        p1.invulnTimer = 1;
      } else {
        p1.invulnTimer = 0;
      }
      p1.fireCooldown = 9999;
      world.spawnTimer = 9999;
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
      if (wolf.telegraphKind === 'lunge' || wolf.stateTimer > 0) {
        sawWolfLunge = true;
      }
      if (world.projectiles.some((pr) => pr.weaponId === 'enemy_orb')) {
        sawOwlOrb = true;
      }
      if (world.hazards.some((h) => h.ownerId === bomber.id && h.shape === 'circle')) {
        sawBomberExplodeTelegraph = true;
      }
    }

    assert.equal(world.phase, 'playing');
    assert.equal(sawWolfLunge, true, 'wolf should trigger lunge telegraph and dash');
    assert.equal(sawOwlOrb, true, 'owl_mage should fire enemy_orb projectile');
    assert.equal(sawBomberExplodeTelegraph, true, 'bomber should trigger circle explosion hazard');
    assert.equal(world.enemies.some((e) => e.id === bomber.id), false, 'bomber should expire after exploding');
    assert.ok(p1.hp < 500, 'bomber explosion should deal damage when bomber survives windup');

    // Killing a bomber mid-windup cancels its pending explosion hazard without damage
    world.enemies = [];
    world.hazards = [];
    world.projectiles = [];
    for (let attempt = 0; attempt < 200; attempt++) {
      p1.hp = p1.maxHp;
      p1.downed = false;
      p1.invulnTimer = 1;
      p1.fireCooldown = 9999;
      world.spawnTimer = 0;
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
      if (world.enemies.some((e) => e.kind === 'bomber')) break;
      world.enemies = [];
    }
    const bomber2 = world.enemies.find((e) => e.kind === 'bomber')!;
    assert.ok(bomber2);
    world.enemies = [bomber2];
    world.hazards = [];
    bomber2.x = p1.x;
    bomber2.y = p1.y + 60;
    stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.02);
    assert.equal(bomber2.telegraphKind, 'explode');
    assert.equal(world.hazards.some((h) => h.ownerId === bomber2.id), true);

    bomber2.hp = 0;
    p1.hp = p1.maxHp;
    p1.invulnTimer = 0;
    for (let i = 0; i < 20; i++) {
      p1.fireCooldown = 9999;
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
    }
    assert.equal(p1.hp, p1.maxHp, 'dead bomber must not deal explosion damage');
    assert.equal(world.hazards.some((h) => h.ownerId === bomber2.id), false);
  });

  it('never ends a campaign match on time while Final Boss is alive — must defeat Boss to win', () => {
    const world = createSurvivalWorld({
      matchId: 'm-boss-gate',
      mode: 'solo',
      mapId: 'winter_cabin',
      seed: 333,
      players: [
        { id: 'p1', name: 'Hero', animal: 'dog', weaponId: 'candy_smg', gearId: 'plush_armor', isBot: false },
      ],
    });
    const p1 = world.players[0];

    // Spawn Final Boss (Snow Dragon) at 330s
    world.elapsedSec = 330;
    world.bossScheduleIndex = 2;
    world.nextBossAtSec = 330;
    stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);

    const dragon = world.enemies.find((e) => e.kind === 'boss_snow_dragon');
    assert.ok(dragon, 'Final Boss must be active');

    // Step well past the 6:00 (360s) mark to ~405s with Boss still alive
    for (let i = 0; i < 1500; i++) {
      p1.hp = p1.maxHp;
      p1.downed = false;
      p1.invulnTimer = 1;
      p1.fireCooldown = 9999;
      world.spawnTimer = 9999;
      stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
      if (world.phase === 'levelup') {
        applySkillPick(world, 'p1', 0);
      }
    }
    assert.ok(world.elapsedSec >= 400, `expected elapsedSec >= 400, got ${world.elapsedSec}`);
    assert.equal(world.phase, 'playing', 'match must stay in playing while Final Boss is alive past 6:00');
    const hud = buildHudSnapshot(world, 'p1');
    assert.equal(hud.activeBoss?.isFinalBoss, true, 'HUD must mark active Final Boss clearly');

    // Now defeat the Final Boss -> match ends in victory
    dragon.hp = 1;
    dragon.x = p1.x + 80;
    dragon.y = p1.y;
    p1.fireCooldown = 0;
    let won = false;
    for (let i = 0; i < 40; i++) {
      const evts = stepSurvivalWorld(world, { p1: IDLE_INPUT }, 0.05);
      if (evts.some((e) => e.type === 'victory')) {
        won = true;
        break;
      }
    }
    assert.equal(won, true, 'defeating Final Boss must complete the stage with victory');
    assert.equal(world.phase, 'victory');
  });
});
