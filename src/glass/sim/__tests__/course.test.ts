import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COURSE_FINISH_Z,
  GLASS_REST_LENGTH,
  GLASS_SAFE_MAX_DIST,
  GLASS_SAFE_MIN_DIST,
  HAND_BASE_Y,
  LIFT_DOWN_OFFSET,
  LIFT_UP_OFFSET,
  GLASS_HALF_HEIGHT,
} from '../constants.ts';
import {
  GLASS_COURSE,
  evaluateDynamicObstacles,
  getStageNumberForZ,
} from '../course.ts';

describe('GLASS_COURSE structure', () => {
  it('defines 5 contiguous stages from z=0 to finishZ=140', () => {
    assert.equal(GLASS_COURSE.finishZ, COURSE_FINISH_Z);
    assert.equal(GLASS_COURSE.finishZ, 140);
    assert.equal(GLASS_COURSE.stages.length, 5);

    for (let i = 0; i < GLASS_COURSE.stages.length; i += 1) {
      const stage = GLASS_COURSE.stages[i];
      assert.equal(stage.number, i + 1);
      assert.ok(stage.endZ > stage.startZ);
      if (i > 0) {
        assert.equal(stage.startZ, GLASS_COURSE.stages[i - 1].endZ);
      }
    }
    assert.equal(GLASS_COURSE.stages[0].startZ, 0);
    assert.equal(GLASS_COURSE.stages[4].endZ, 140);
  });

  it('defines 5 monotonically increasing checkpoints whose spawns rest on static floor platforms at safe glass distance', () => {
    assert.equal(GLASS_COURSE.checkpoints.length, 5);

    for (let i = 0; i < GLASS_COURSE.checkpoints.length; i += 1) {
      const cp = GLASS_COURSE.checkpoints[i];
      assert.equal(cp.index, i);
      assert.equal(cp.stageNumber, i + 1);
      assert.equal(cp.stageName, GLASS_COURSE.stages[i].name);
      assert.equal(cp.triggerZ, GLASS_COURSE.stages[i].startZ);

      if (i > 0) {
        assert.ok(cp.triggerZ > GLASS_COURSE.checkpoints[i - 1].triggerZ);
      }
      assert.ok(cp.triggerZ < GLASS_COURSE.finishZ);

      const dx = cp.p2Spawn.x - cp.p1Spawn.x;
      const dz = cp.p2Spawn.z - cp.p1Spawn.z;
      const dist = Math.hypot(dx, dz);
      assert.ok(Math.abs(dist - 3.2) < 1e-6);
      assert.ok(dist >= GLASS_SAFE_MIN_DIST && dist <= GLASS_SAFE_MAX_DIST);
      assert.ok(dist < GLASS_REST_LENGTH);

      for (const spawn of [cp.p1Spawn, cp.p2Spawn]) {
        assert.equal(spawn.y, 0);
        const onFloor = GLASS_COURSE.platforms.some(
          (p) =>
            p.box.maxY === 0 &&
            spawn.x >= p.box.minX &&
            spawn.x <= p.box.maxX &&
            spawn.z >= p.box.minZ &&
            spawn.z <= p.box.maxZ,
        );
        assert.equal(onFloor, true, `Checkpoint ${i} spawn must stand on a solid floor platform`);
      }
    }
  });

  it('enforces Stage 1 narrow gate opening of 2.2m and clearance invariants for lowGap and highWall barriers', () => {
    const stage1Walls = GLASS_COURSE.barriers.filter(
      (b) => b.kind === 'wall' && b.box.minZ >= 22 && b.box.maxZ <= 23,
    );
    assert.equal(stage1Walls.length, 2);
    const leftWall = stage1Walls.find((b) => b.box.maxX < 0);
    const rightWall = stage1Walls.find((b) => b.box.minX > 0);
    assert.ok(leftWall);
    assert.ok(rightWall);
    assert.ok(Math.abs(rightWall.box.minX - leftWall.box.maxX - 2.2) < 1e-6);

    const loweredGlassTopY = HAND_BASE_Y + LIFT_DOWN_OFFSET + GLASS_HALF_HEIGHT;
    const raisedGlassBottomY = HAND_BASE_Y + LIFT_UP_OFFSET - GLASS_HALF_HEIGHT;

    const lowGaps = GLASS_COURSE.barriers.filter((b) => b.kind === 'lowGap');
    assert.ok(lowGaps.length >= 3);
    for (const gap of lowGaps) {
      assert.equal(gap.box.minY, 0.95);
      assert.equal(gap.blocksPlayers, false);
      assert.ok(loweredGlassTopY < gap.box.minY);
    }

    const highWalls = GLASS_COURSE.barriers.filter((b) => b.kind === 'highWall');
    assert.ok(highWalls.length >= 2);
    for (const hw of highWalls) {
      assert.equal(hw.box.maxY, 1.25);
      assert.equal(hw.blocksPlayers, true);
      assert.ok(raisedGlassBottomY > hw.box.maxY);
    }
  });
});

describe('evaluateDynamicObstacles', () => {
  it('evaluates static and moving platforms with deterministic positions and velocities', () => {
    const t0 = evaluateDynamicObstacles(GLASS_COURSE, 0);
    assert.equal(
      t0.platforms.length,
      GLASS_COURSE.platforms.length + GLASS_COURSE.movingPlatforms.length,
    );

    const staticIds = new Set(GLASS_COURSE.platforms.map((p) => p.id));
    for (const p of t0.platforms) {
      if (staticIds.has(p.id)) {
        assert.equal(p.vx, 0);
        assert.equal(p.vz, 0);
      }
    }

    const tTest = 1.25;
    const evaluated = evaluateDynamicObstacles(GLASS_COURSE, tTest);
    for (const mpDef of GLASS_COURSE.movingPlatforms) {
      const mpEval = evaluated.platforms.find((p) => p.id === mpDef.id);
      assert.ok(mpEval);
      const expectedOffset = Math.sin(tTest * mpDef.speed + mpDef.phase) * mpDef.amplitude;
      const expectedVel = Math.cos(tTest * mpDef.speed + mpDef.phase) * mpDef.amplitude * mpDef.speed;

      assert.ok(Math.abs(mpEval.box.minX - (mpDef.baseBox.minX + expectedOffset)) < 1e-9);
      assert.ok(Math.abs(mpEval.box.maxX - (mpDef.baseBox.maxX + expectedOffset)) < 1e-9);
      assert.equal(mpEval.box.minZ, mpDef.baseBox.minZ);
      assert.equal(mpEval.box.maxZ, mpDef.baseBox.maxZ);
      assert.ok(Math.abs(mpEval.vx - expectedVel) < 1e-9);
      assert.equal(mpEval.vz, 0);
    }
  });

  it('evaluates moving barriers along their moveAxis', () => {
    const movingDef = GLASS_COURSE.barriers.find((b) => b.moveAxis !== undefined);
    assert.ok(movingDef);
    assert.equal(movingDef.moveAxis, 'z');

    const t = 2.0;
    const evaluated = evaluateDynamicObstacles(GLASS_COURSE, t);
    const movingEval = evaluated.barriers.find((b) => b.id === movingDef.id);
    assert.ok(movingEval);

    const expectedOffset =
      Math.sin(t * (movingDef.moveSpeed ?? 0) + (movingDef.movePhase ?? 0)) *
      (movingDef.moveAmplitude ?? 0);
    assert.ok(Math.abs(movingEval.box.minZ - (movingDef.box.minZ + expectedOffset)) < 1e-9);
    assert.ok(Math.abs(movingEval.box.maxZ - (movingDef.box.maxZ + expectedOffset)) < 1e-9);
    assert.equal(movingEval.box.minX, movingDef.box.minX);
  });

  it('evaluates wind zone warning, blowing, and idle cycle states deterministically', () => {
    // WindZone #1: period 5.5, warn 1.5, active 2.2, phaseOffset 0
    const warnSample = evaluateDynamicObstacles(GLASS_COURSE, 0.75).windZones[0];
    assert.equal(warnSample.state, 'warning');
    assert.ok(Math.abs(warnSample.intensity - 0.375) < 1e-9);

    const blowSample = evaluateDynamicObstacles(GLASS_COURSE, 2.0).windZones[0];
    assert.equal(blowSample.state, 'blowing');
    assert.equal(blowSample.intensity, 1);

    const idleSample = evaluateDynamicObstacles(GLASS_COURSE, 4.5).windZones[0];
    assert.equal(idleSample.state, 'idle');
    assert.equal(idleSample.intensity, 0);
  });

  it('evaluates pendulum swing coordinates and spinner rotation deterministically', () => {
    const t = 0.8;
    const evaluated = evaluateDynamicObstacles(GLASS_COURSE, t);

    assert.equal(evaluated.pendulums.length, 2);
    for (let i = 0; i < GLASS_COURSE.pendulums.length; i += 1) {
      const def = GLASS_COURSE.pendulums[i];
      const evalP = evaluated.pendulums[i];
      const expectedAngle = Math.sin(t * def.speed + def.phase) * def.maxAngleRad;
      assert.ok(Math.abs(evalP.angle - expectedAngle) < 1e-9);
      assert.ok(
        Math.abs(evalP.bobX - (def.pivotX + Math.sin(expectedAngle) * def.armLength)) < 1e-9,
      );
      assert.ok(
        Math.abs(evalP.bobY - (def.pivotY - Math.cos(expectedAngle) * def.armLength)) < 1e-9,
      );
      assert.equal(evalP.bobZ, def.pivotZ);
    }

    assert.equal(evaluated.spinners.length, 1);
    const spinnerDef = GLASS_COURSE.spinners[0];
    const spinnerEval = evaluated.spinners[0];
    assert.ok(
      Math.abs(spinnerEval.angle - (t * spinnerDef.angularSpeed + spinnerDef.phase)) < 1e-9,
    );
  });
});

describe('getStageNumberForZ', () => {
  it('maps z coordinates across all 5 stages and clamps boundaries', () => {
    assert.equal(getStageNumberForZ(GLASS_COURSE, -2), 1);
    assert.equal(getStageNumberForZ(GLASS_COURSE, 0), 1);
    assert.equal(getStageNumberForZ(GLASS_COURSE, 27.9), 1);
    assert.equal(getStageNumberForZ(GLASS_COURSE, 28), 2);
    assert.equal(getStageNumberForZ(GLASS_COURSE, 55.9), 2);
    assert.equal(getStageNumberForZ(GLASS_COURSE, 56), 3);
    assert.equal(getStageNumberForZ(GLASS_COURSE, 85.9), 3);
    assert.equal(getStageNumberForZ(GLASS_COURSE, 86), 4);
    assert.equal(getStageNumberForZ(GLASS_COURSE, 115.9), 4);
    assert.equal(getStageNumberForZ(GLASS_COURSE, 116), 5);
    assert.equal(getStageNumberForZ(GLASS_COURSE, 140), 5);
    assert.equal(getStageNumberForZ(GLASS_COURSE, 145), 5);
  });
});
