import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COOP_MAPS } from '../../../coop/maps/registry.ts';
import {
  FIXED_DT,
  GLASS_MAX_HP,
  GLASS_REST_LENGTH,
  GLASS_SAFE_MAX_DIST,
  GLASS_SAFE_MIN_DIST,
} from '../constants.ts';
import {
  GLASS_MAP_THEMES,
  GLASS_LEVEL_COURSES,
  getGlassCourseForStage,
} from '../levels.ts';
import {
  NEUTRAL_INPUT,
  createInitialSimState,
  stepGlassSim,
} from '../physics.ts';
import type { CourseDef, PlayerInput } from '../types.ts';

function stepCourse(
  course: CourseDef,
  ticks: number,
  p1Input: PlayerInput = NEUTRAL_INPUT,
  p2Input: PlayerInput = NEUTRAL_INPUT,
) {
  let state = createInitialSimState(course);
  for (let i = 0; i < ticks; i += 1) {
    state = stepGlassSim(state, p1Input, p2Input, FIXED_DT, course);
  }
  return state;
}

describe('GLASS_MAP_THEMES', () => {
  it('defines distinct visual themes for cabin_bridge, sky_scaffold, and candy_factory', () => {
    assert.equal(GLASS_MAP_THEMES.cabin_bridge.id, 'cabin_bridge');
    assert.equal(GLASS_MAP_THEMES.sky_scaffold.id, 'sky_scaffold');
    assert.equal(GLASS_MAP_THEMES.candy_factory.id, 'candy_factory');

    assert.equal(GLASS_MAP_THEMES.cabin_bridge.deckPrimaryHex, '#8c5633');
    assert.equal(GLASS_MAP_THEMES.sky_scaffold.deckPrimaryHex, '#b45309');
    assert.equal(GLASS_MAP_THEMES.candy_factory.deckPrimaryHex, '#f472b6');
  });
});

describe('GLASS_LEVEL_COURSES registry alignment & invariants', () => {
  const glassMeta = COOP_MAPS.find((m) => m.id === 'glass_carry');

  it('contains all 15 courses matching registry.ts finishZ and stageCount', () => {
    assert.ok(glassMeta);
    assert.equal(glassMeta.maps.length, 3);

    let total = 0;
    for (const pack of glassMeta.maps) {
      assert.equal(pack.levels.length, 5);
      for (const lvl of pack.levels) {
        total += 1;
        const key = `${pack.id}:${lvl.level}`;
        const course = GLASS_LEVEL_COURSES[key];
        assert.ok(course, `Missing course for ${key}`);
        assert.equal(course.finishZ, lvl.finishZ, `${key} finishZ mismatch`);
        assert.equal(course.stages.length, lvl.stageCount, `${key} stageCount mismatch`);
        assert.equal(course.theme?.id, pack.id, `${key} theme.id mismatch`);

        const fetched = getGlassCourseForStage(pack.id, lvl.level);
        assert.equal(fetched, course);
      }
    }
    assert.equal(total, 15);
    assert.equal(Object.keys(GLASS_LEVEL_COURSES).length, 15);
  });

  it('validates contiguous stages, solid non-fragile checkpoint spawns, and barrier clearance across all 15 courses', () => {
    for (const [key, course] of Object.entries(GLASS_LEVEL_COURSES)) {
      assert.equal(course.stages[0].startZ, 0, `${key} must start at z=0`);
      assert.equal(
        course.stages[course.stages.length - 1].endZ,
        course.finishZ,
        `${key} last stage must end at finishZ`,
      );
      for (let i = 0; i < course.stages.length; i += 1) {
        const st = course.stages[i];
        assert.equal(st.number, i + 1, `${key} stage number`);
        assert.ok(st.endZ > st.startZ, `${key} stage endZ > startZ`);
        if (i > 0) {
          assert.equal(st.startZ, course.stages[i - 1].endZ, `${key} contiguous stages`);
        }
      }

      assert.equal(course.checkpoints.length, course.stages.length, `${key} checkpoint count`);
      for (let i = 0; i < course.checkpoints.length; i += 1) {
        const cp = course.checkpoints[i];
        assert.equal(cp.index, i, `${key} cp index`);
        assert.equal(cp.stageNumber, i + 1, `${key} cp stageNumber`);
        assert.equal(cp.stageName, course.stages[i].name, `${key} cp stageName`);
        assert.equal(cp.triggerZ, course.stages[i].startZ, `${key} cp triggerZ`);
        if (i > 0) {
          assert.ok(cp.triggerZ > course.checkpoints[i - 1].triggerZ, `${key} cp monotonic`);
        }
        assert.ok(cp.triggerZ < course.finishZ, `${key} cp before finishZ`);

        const dist = Math.hypot(
          cp.p2Spawn.x - cp.p1Spawn.x,
          cp.p2Spawn.z - cp.p1Spawn.z,
        );
        assert.ok(Math.abs(dist - 3.2) < 1e-6, `${key} cp ${i} spawn spacing`);
        assert.ok(dist >= GLASS_SAFE_MIN_DIST && dist <= GLASS_SAFE_MAX_DIST);
        assert.ok(dist < GLASS_REST_LENGTH);
        assert.equal(cp.p1Spawn.y, cp.p2Spawn.y, `${key} cp ${i} spawn Y parity`);

        for (const spawn of [cp.p1Spawn, cp.p2Spawn]) {
          const onSolidFloor = course.platforms.some(
            (p) =>
              !p.fragile &&
              p.box.maxY === spawn.y &&
              spawn.x >= p.box.minX &&
              spawn.x <= p.box.maxX &&
              spawn.z >= p.box.minZ &&
              spawn.z <= p.box.maxZ,
          );
          assert.equal(
            onSolidFloor,
            true,
            `${key} cp ${i} spawn (${spawn.x},${spawn.y},${spawn.z}) must rest on solid non-fragile platform`,
          );
        }
      }

      for (const b of course.barriers) {
        if (b.kind === 'lowGap') {
          assert.ok(b.box.minY >= 0.95, `${key} ${b.id} lowGap minY >= 0.95`);
        }
        if (b.kind === 'highWall') {
          assert.ok(b.box.maxY <= 1.25, `${key} ${b.id} highWall maxY <= 1.25`);
        }
      }

      for (const mp of course.movingPlatforms) {
        if (mp.axis === 'y') {
          const peakVel = Math.abs(mp.amplitude * mp.speed);
          assert.ok(
            peakVel <= 2.5,
            `${key} ${mp.id} vertical elevator peak velocity ${peakVel} > 2.5 m/s`,
          );
          const minTopY = mp.baseBox.maxY - mp.amplitude;
          const maxTopY = mp.baseBox.maxY + mp.amplitude;
          const alignsLower = course.platforms.some(
            (p) => Math.abs(p.box.maxY - minTopY) <= 0.15 && p.box.maxZ <= mp.baseBox.minZ + 1.5 && p.box.maxZ >= mp.baseBox.minZ - 1.5,
          );
          const alignsUpper = course.platforms.some(
            (p) => Math.abs(p.box.maxY - maxTopY) <= 0.15 && p.box.minZ >= mp.baseBox.maxZ - 1.5 && p.box.minZ <= mp.baseBox.maxZ + 1.5,
          );
          assert.ok(alignsLower, `${key} ${mp.id} bottom (${minTopY}) must align with preceding deck`);
          assert.ok(alignsUpper, `${key} ${mp.id} top (${maxTopY}) must align with succeeding deck`);
        }
      }

      // Longitudinal gap check: sorted by minZ, no gap > 1.5m between consecutive decks/movers
      const spans = [
        ...course.platforms.map((p) => ({ id: p.id, minZ: p.box.minZ, maxZ: p.box.maxZ })),
        ...course.movingPlatforms.map((mp) => ({ id: mp.id, minZ: mp.baseBox.minZ, maxZ: mp.baseBox.maxZ })),
      ].sort((a, b) => a.minZ - b.minZ);
      let reachZ = spans[0].maxZ;
      for (let i = 1; i < spans.length; i += 1) {
        const gap = spans[i].minZ - reachZ;
        assert.ok(gap <= 1.5, `${key} longitudinal gap before ${spans[i].id} is ${gap.toFixed(2)}m (> 1.5m)`);
        if (spans[i].maxZ > reachZ) reachZ = spans[i].maxZ;
      }
      assert.ok(reachZ >= course.finishZ, `${key} platforms must reach finishZ=${course.finishZ}`);

      const finishCovered = course.platforms.some(
        (p) =>
          !p.fragile &&
          p.box.minZ <= course.finishZ &&
          p.box.maxZ >= course.finishZ &&
          p.box.minX <= -1.6 &&
          p.box.maxX >= 1.6,
      );
      assert.equal(finishCovered, true, `${key} finishZ must sit on a solid non-fragile platform`);
    }
  });

  it('provides safe fallbacks in getGlassCourseForStage', () => {
    assert.equal(getGlassCourseForStage('sky_scaffold', 99), GLASS_LEVEL_COURSES['sky_scaffold:1']);
    assert.equal(getGlassCourseForStage('unknown_pack', 3), GLASS_LEVEL_COURSES['cabin_bridge:1']);
  });

  it('boots every course with createInitialSimState and runs 60 ticks cleanly without NaNs or instant shatters', () => {
    for (const [key, course] of Object.entries(GLASS_LEVEL_COURSES)) {
      const state = stepCourse(course, 60);
      assert.equal(state.phase, 'playing', `${key} phase`);
      assert.equal(state.shatters, 0, `${key} shatters after 60 idle ticks`);
      assert.equal(state.glass.hp, GLASS_MAX_HP, `${key} glass hp after 60 idle ticks`);
      assert.equal(state.p1.grounded, true, `${key} p1 grounded`);
      assert.equal(state.p2.grounded, true, `${key} p2 grounded`);
      for (const num of [
        state.p1.x,
        state.p1.y,
        state.p1.z,
        state.p2.x,
        state.p2.y,
        state.p2.z,
        state.glass.centerX,
        state.glass.centerY,
        state.glass.centerZ,
      ]) {
        assert.ok(Number.isFinite(num), `${key} non-finite simulation coordinate`);
      }
    }
  });
});

describe('Map Pack signature mechanics', () => {
  it('cabin_bridge:1 has zero wind, pendulums, or spinners and a 2.6m narrow gate', () => {
    const c1 = GLASS_LEVEL_COURSES['cabin_bridge:1'];
    assert.equal(c1.windZones.length, 0);
    assert.equal(c1.pendulums.length, 0);
    assert.equal(c1.spinners.length, 0);
    const walls = c1.barriers.filter((b) => b.kind === 'wall');
    assert.equal(walls.length, 2);
    const left = walls.find((b) => b.box.maxX < 0);
    const right = walls.find((b) => b.box.minX > 0);
    assert.ok(left && right);
    assert.ok(Math.abs(right.box.minX - left.box.maxX - 2.6) < 1e-6);
  });

  it('sky_scaffold features fragile planks, vertical elevators, and overhead crane spinners', () => {
    for (let lvl = 1; lvl <= 5; lvl += 1) {
      const c = GLASS_LEVEL_COURSES[`sky_scaffold:${lvl}`];
      const hasFragile = c.platforms.some((p) => p.fragile !== undefined);
      const hasVerticalOrCrane =
        c.movingPlatforms.some((mp) => mp.axis === 'y') || c.spinners.length > 0;
      assert.ok(hasFragile, `sky_scaffold:${lvl} must include fragile planks`);
      assert.ok(hasVerticalOrCrane, `sky_scaffold:${lvl} must include vertical elevator or crane spinner`);
    }
    const s2 = GLASS_LEVEL_COURSES['sky_scaffold:2'];
    assert.ok(s2.spinners.length >= 2);
    for (const sp of s2.spinners) {
      assert.ok(sp.centerY >= 1.65);
      assert.equal(sp.halfHeight, 0.3);
    }
  });

  it('candy_factory features conveyors, vertical pistons, and diagonal tilt gates cleared by opposite Q/E', () => {
    for (let lvl = 1; lvl <= 5; lvl += 1) {
      const c = GLASS_LEVEL_COURSES[`candy_factory:${lvl}`];
      const hasConveyor = c.platforms.some(
        (p) => (p.conveyorVx ?? 0) !== 0 || (p.conveyorVz ?? 0) !== 0,
      );
      assert.ok(hasConveyor, `candy_factory:${lvl} must include conveyor decks`);
    }

    const cf1 = GLASS_LEVEL_COURSES['candy_factory:1'];
    assert.ok(cf1.barriers.some((b) => b.moveAxis === 'y'));

    const cf2 = GLASS_LEVEL_COURSES['candy_factory:2'];
    const tiltLowGaps = cf2.barriers.filter(
      (b) => b.kind === 'lowGap' && !b.blocksPlayers && b.box.minX >= 0.89 && b.box.maxX <= 4.61,
    );
    const tiltHighWalls = cf2.barriers.filter(
      (b) => b.kind === 'highWall' && !b.blocksPlayers && b.box.minX >= -4.61 && b.box.maxX <= -0.89,
    );
    assert.ok(tiltLowGaps.length >= 2, 'candy_factory:2 should have 2 diagonal tilt lowGap halves');
    assert.ok(tiltHighWalls.length >= 2, 'candy_factory:2 should have 2 diagonal tilt highWall halves');

    // Verify P1=E (raise) + P2=Q (lower) passes through candy_factory:2 first diagonal tilt gate cleanly with hp===3
    const firstTiltZ = tiltLowGaps[0].box.minZ;
    let state = createInitialSimState(cf2);
    // Walk forward until past firstTiltZ while tilting P1=+1, P2=-1
    for (let tick = 0; tick < 600 && state.p1.z < firstTiltZ + 2.0; tick += 1) {
      state = stepGlassSim(
        state,
        { moveX: 0, moveZ: 1, jump: false, lift: 1 },
        { moveX: 0, moveZ: 1, jump: false, lift: -1 },
        FIXED_DT,
        cf2,
      );
    }
    assert.ok(state.p1.z >= firstTiltZ + 1.5);
    assert.equal(state.glass.hp, GLASS_MAX_HP);
    assert.equal(state.shatters, 0);

    // Verify flat neutral glass cracks on the same gate
    let flatState = createInitialSimState(cf2);
    for (let tick = 0; tick < 600 && flatState.p1.z < firstTiltZ + 2.0; tick += 1) {
      flatState = stepGlassSim(
        flatState,
        { moveX: 0, moveZ: 1, jump: false, lift: 0 },
        { moveX: 0, moveZ: 1, jump: false, lift: 0 },
        FIXED_DT,
        cf2,
      );
    }
    assert.ok(flatState.glass.hp < GLASS_MAX_HP || flatState.shatters > 0);
  });
});
