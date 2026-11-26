import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLASS_COURSE, evaluateDynamicObstacles } from '../sim/course';
import type { BarrierDef, WindZoneDef } from '../sim/types';
import type { GlassRenderState } from './renderTypes';

export interface GlassCourseMeshProps {
  renderRef: RefObject<GlassRenderState>;
}

const WIND_STREAKS_PER_ZONE = 10;

const CHECKPOINT_COOL_COLOR = new THREE.Color('#38bdf8');
const CHECKPOINT_COOL_EMISSIVE = new THREE.Color('#0284c7');
const CHECKPOINT_WARM_COLOR = new THREE.Color('#fde047');
const CHECKPOINT_WARM_EMISSIVE = new THREE.Color('#f59e0b');

const WIND_WARN_COLOR = new THREE.Color('#7dd3fc');
const WIND_BLOW_COLOR = new THREE.Color('#f0f9ff');

interface CourseTextures {
  wood: THREE.CanvasTexture;
  hazard: THREE.CanvasTexture;
  finish: THREE.CanvasTexture;
}

function createCourseTextures(): CourseTextures {
  // 1. Warm Winter Cabin pine plank texture
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 256;
  woodCanvas.height = 256;
  const wCtx = woodCanvas.getContext('2d');
  if (wCtx) {
    wCtx.fillStyle = '#8c5633';
    wCtx.fillRect(0, 0, 256, 256);

    const plankCount = 4;
    const plankW = 256 / plankCount;
    for (let i = 0; i < plankCount; i += 1) {
      const shade = i % 2 === 0 ? 'rgba(255, 224, 185, 0.08)' : 'rgba(42, 20, 8, 0.1)';
      wCtx.fillStyle = shade;
      wCtx.fillRect(i * plankW, 0, plankW, 256);

      // Vertical plank seam
      wCtx.fillStyle = 'rgba(35, 17, 7, 0.42)';
      wCtx.fillRect(i * plankW, 0, 3, 256);

      // Subtle wood grain lines
      wCtx.fillStyle = 'rgba(58, 30, 14, 0.16)';
      wCtx.fillRect(i * plankW + 14, 0, 2, 256);
      wCtx.fillRect(i * plankW + 38, 0, 1.5, 256);
    }

    // Horizontal board joints
    wCtx.fillStyle = 'rgba(35, 17, 7, 0.35)';
    wCtx.fillRect(0, 84, plankW * 2, 3);
    wCtx.fillRect(plankW * 2, 192, plankW * 2, 3);
  }
  const wood = new THREE.CanvasTexture(woodCanvas);
  wood.colorSpace = THREE.SRGBColorSpace;
  wood.wrapS = THREE.RepeatWrapping;
  wood.wrapT = THREE.RepeatWrapping;
  wood.repeat.set(2, 5);
  wood.needsUpdate = true;

  // 2. Diagonal yellow / dark-slate danger hazard stripe texture
  const hazCanvas = document.createElement('canvas');
  hazCanvas.width = 256;
  hazCanvas.height = 128;
  const hCtx = hazCanvas.getContext('2d');
  if (hCtx) {
    hCtx.fillStyle = '#1e293b';
    hCtx.fillRect(0, 0, 256, 128);
    hCtx.fillStyle = '#facc15';
    for (let x = -128; x < 384; x += 64) {
      hCtx.beginPath();
      hCtx.moveTo(x, 0);
      hCtx.lineTo(x + 32, 0);
      hCtx.lineTo(x - 32, 128);
      hCtx.lineTo(x - 64, 128);
      hCtx.closePath();
      hCtx.fill();
    }
  }
  const hazard = new THREE.CanvasTexture(hazCanvas);
  hazard.colorSpace = THREE.SRGBColorSpace;
  hazard.wrapS = THREE.RepeatWrapping;
  hazard.wrapT = THREE.RepeatWrapping;
  hazard.repeat.set(4, 1);
  hazard.needsUpdate = true;

  // 3. Golden checkered finish line ribbon texture
  const finCanvas = document.createElement('canvas');
  finCanvas.width = 256;
  finCanvas.height = 64;
  const fCtx = finCanvas.getContext('2d');
  if (fCtx) {
    const sq = 32;
    for (let r = 0; r < 2; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        fCtx.fillStyle = (r + c) % 2 === 0 ? '#fbbf24' : '#fef3c7';
        fCtx.fillRect(c * sq, r * sq, sq, sq);
      }
    }
  }
  const finish = new THREE.CanvasTexture(finCanvas);
  finish.colorSpace = THREE.SRGBColorSpace;
  finish.wrapS = THREE.RepeatWrapping;
  finish.wrapT = THREE.RepeatWrapping;
  finish.repeat.set(4, 1);
  finish.needsUpdate = true;

  return { wood, hazard, finish };
}

function boxMetrics(box: BarrierDef['box']) {
  return {
    w: box.maxX - box.minX,
    h: box.maxY - box.minY,
    d: box.maxZ - box.minZ,
    cx: (box.minX + box.maxX) * 0.5,
    cy: (box.minY + box.maxY) * 0.5,
    cz: (box.minZ + box.maxZ) * 0.5,
  };
}

function BarrierVisual({
  barrier,
  hazardTex,
}: {
  barrier: BarrierDef;
  hazardTex: THREE.CanvasTexture;
}) {
  const { w, h, d, cx, cz } = boxMetrics(barrier.box);

  if (barrier.kind === 'lowGap') {
    const beamH = h;
    const fasciaH = Math.min(0.42, beamH * 0.35);
    const headerH = Math.max(0.2, beamH - fasciaH);
    const supportHeight = barrier.box.maxY;
    const postOffset = Math.max(0.2, w * 0.5 - 0.12);

    return (
      <group>
        {/* Overhead timber header */}
        <mesh
          position={[cx, barrier.box.minY + fasciaH + headerH * 0.5, cz]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[w, headerH, d]} />
          <meshStandardMaterial color="#5c351e" roughness={0.82} />
        </mesh>

        {/* Lower striped yellow/slate danger fascia */}
        <mesh
          position={[cx, barrier.box.minY + fasciaH * 0.5, cz]}
          castShadow
        >
          <boxGeometry args={[w + 0.04, fasciaH, d + 0.04]} />
          <meshStandardMaterial
            map={hazardTex}
            roughness={0.45}
            metalness={0.12}
          />
        </mesh>

        {/* Outer support posts anchoring beam to deck */}
        {([-1, 1] as const).map((side) => (
          <mesh
            key={side}
            position={[cx + side * postOffset, supportHeight * 0.5, cz]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.22, supportHeight, d + 0.06]} />
            <meshStandardMaterial color="#3f2414" roughness={0.86} />
          </mesh>
        ))}

        {/* Painted floor warning strip directly underneath for effortless depth reading */}
        <mesh position={[cx, 0.015, cz]} receiveShadow>
          <boxGeometry args={[Math.max(0.5, w - 0.16), 0.012, d + 0.48]} />
          <meshStandardMaterial
            map={hazardTex}
            emissive="#fbbf24"
            emissiveIntensity={0.16}
            roughness={0.55}
          />
        </mesh>
      </group>
    );
  }

  if (barrier.kind === 'highWall') {
    const capH = 0.2;
    const bodyH = Math.max(0.2, h - capH);
    const postOffset = Math.max(0.15, w * 0.5 - 0.12);

    return (
      <group>
        {/* Wooden hurdle body */}
        <mesh
          position={[cx, barrier.box.minY + bodyH * 0.5, cz]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[w - 0.08, bodyH, d * 0.78]} />
          <meshStandardMaterial color="#8c5633" roughness={0.78} />
        </mesh>

        {/* Side vertical hurdle posts */}
        {([-1, 1] as const).map((side) => (
          <mesh
            key={side}
            position={[cx + side * postOffset, barrier.box.minY + h * 0.5, cz]}
            castShadow
          >
            <boxGeometry args={[0.2, h, d + 0.04]} />
            <meshStandardMaterial color="#57321c" roughness={0.84} />
          </mesh>
        ))}

        {/* Bright amber top cap rail signaling players to lift with E */}
        <mesh
          position={[cx, barrier.box.maxY - capH * 0.5, cz]}
          castShadow
        >
          <boxGeometry args={[w + 0.08, capH, d + 0.08]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#f59e0b"
            emissiveIntensity={0.38}
            roughness={0.3}
          />
        </mesh>
      </group>
    );
  }

  if (barrier.kind === 'pillar') {
    const postH = h - 0.24;
    return (
      <group>
        <mesh
          position={[cx, barrier.box.minY + postH * 0.5, cz]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[w, postH, d]} />
          <meshStandardMaterial color="#5c3820" roughness={0.85} />
        </mesh>
        {/* Warm cabin lantern block */}
        <mesh position={[cx, barrier.box.maxY - 0.34, cz]}>
          <boxGeometry args={[w * 0.72, 0.34, d * 0.72]} />
          <meshStandardMaterial
            color="#fde047"
            emissive="#f59e0b"
            emissiveIntensity={0.85}
            roughness={0.25}
          />
        </mesh>
        {/* Snow cap */}
        <mesh position={[cx, barrier.box.maxY - 0.07, cz]} castShadow>
          <boxGeometry args={[w + 0.12, 0.14, d + 0.12]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.62} />
        </mesh>
      </group>
    );
  }

  // 'wall': sturdy Winter Cabin timber gate wall with stone plinth and snow cap
  const plinthH = 0.28;
  const snowH = 0.14;
  const wallH = Math.max(0.2, h - plinthH - snowH);
  return (
    <group>
      <mesh
        position={[cx, barrier.box.minY + plinthH * 0.5, cz]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w + 0.04, plinthH, d + 0.04]} />
        <meshStandardMaterial color="#475569" roughness={0.88} />
      </mesh>
      <mesh
        position={[cx, barrier.box.minY + plinthH + wallH * 0.5, cz]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w, wallH, d]} />
        <meshStandardMaterial color="#6d4226" roughness={0.82} />
      </mesh>
      <mesh position={[cx, barrier.box.maxY - snowH * 0.5, cz]} castShadow>
        <boxGeometry args={[w + 0.1, snowH, d + 0.1]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.65} />
      </mesh>
    </group>
  );
}

interface StreakSpec {
  offsetX: number;
  y: number;
  z: number;
  len: number;
  speedMul: number;
}

function buildWindZoneStreaks(zone: WindZoneDef): StreakSpec[] {
  const specs: StreakSpec[] = [];
  const zSpan = zone.box.maxZ - zone.box.minZ;
  const xSpan = zone.box.maxX - zone.box.minX;
  for (let i = 0; i < WIND_STREAKS_PER_ZONE; i += 1) {
    const frac = (i + 0.5) / WIND_STREAKS_PER_ZONE;
    specs.push({
      offsetX: ((i * 0.37) % 1) * xSpan,
      y: 0.42 + ((i * 0.43) % 1) * 1.55,
      z: zone.box.minZ + frac * zSpan,
      len: 1.3 + (i % 3) * 0.55,
      speedMul: 0.82 + (i % 4) * 0.14,
    });
  }
  return specs;
}

export function GlassCourseMesh({ renderRef }: GlassCourseMeshProps) {
  const textures = useMemo(() => createCourseTextures(), []);
  const windMaterials = useMemo(
    () =>
      GLASS_COURSE.windZones.map(
        () =>
          new THREE.MeshBasicMaterial({
            color: '#f0f9ff',
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
          }),
      ),
    [],
  );
  const windStreakGeo = useMemo(() => new THREE.BoxGeometry(1, 0.055, 0.12), []);

  useEffect(() => {
    return () => {
      textures.wood.dispose();
      textures.hazard.dispose();
      textures.finish.dispose();
      windStreakGeo.dispose();
      for (const mat of windMaterials) {
        mat.dispose();
      }
    };
  }, [textures, windMaterials, windStreakGeo]);

  const staticBarriers = useMemo(
    () => GLASS_COURSE.barriers.filter((b) => b.moveAxis === undefined),
    [],
  );
  const movingBarriers = useMemo(
    () => GLASS_COURSE.barriers.filter((b) => b.moveAxis !== undefined),
    [],
  );
  const checkpointArches = useMemo(
    () => GLASS_COURSE.checkpoints.slice(1),
    [],
  );
  const windZoneStreaks = useMemo(
    () => GLASS_COURSE.windZones.map((w) => buildWindZoneStreaks(w)),
    [],
  );
  const pinePositions = useMemo(() => {
    const list: { x: number; z: number; scale: number }[] = [];
    for (let z = -2; z <= 146; z += 11) {
      list.push({
        x: -11.2 - ((z * 7) % 5),
        z,
        scale: 0.9 + ((z * 3) % 4) * 0.14,
      });
      list.push({
        x: 11.2 + ((z * 11) % 5),
        z: z + 4.5,
        scale: 0.9 + ((z * 5) % 4) * 0.14,
      });
    }
    return list;
  }, []);

  const movingPlatRefs = useRef<(THREE.Group | null)[]>([]);
  const movingBarrierRefs = useRef<(THREE.Group | null)[]>([]);
  const pendulumGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const spinnerGroupRefs = useRef<(THREE.Group | null)[]>([]);

  const checkpointLeftLanternRefs = useRef<
    (THREE.MeshStandardMaterial | null)[]
  >([]);
  const checkpointRightLanternRefs = useRef<
    (THREE.MeshStandardMaterial | null)[]
  >([]);
  const checkpointStripRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const checkpointLitStateRef = useRef<boolean[]>(
    checkpointArches.map(() => false),
  );

  const windGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const windStreakMeshRefs = useRef<(THREE.Mesh | null)[][]>(
    GLASS_COURSE.windZones.map(() => []),
  );
  const windFanRefs = useRef<(THREE.Group | null)[]>([]);
  const windScrollRef = useRef<number[]>(
    GLASS_COURSE.windZones.map(() => 0),
  );

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const state = renderRef.current;
    const t = clock.elapsedTime;
    const obs = evaluateDynamicObstacles(GLASS_COURSE, state.matchTime);

    // 1. Moving platforms (appendices in obs.platforms after static platforms)
    const staticPlatCount = GLASS_COURSE.platforms.length;
    for (let i = 0; i < GLASS_COURSE.movingPlatforms.length; i += 1) {
      const def = GLASS_COURSE.movingPlatforms[i];
      const evaluated = obs.platforms[staticPlatCount + i];
      const group = movingPlatRefs.current[i];
      if (!evaluated || !group) continue;

      const baseCx = (def.baseBox.minX + def.baseBox.maxX) * 0.5;
      const baseCz = (def.baseBox.minZ + def.baseBox.maxZ) * 0.5;
      const evalCx = (evaluated.box.minX + evaluated.box.maxX) * 0.5;
      const evalCz = (evaluated.box.minZ + evaluated.box.maxZ) * 0.5;
      group.position.set(evalCx - baseCx, 0, evalCz - baseCz);
    }

    // 2. Moving barriers
    for (let i = 0; i < movingBarriers.length; i += 1) {
      const def = movingBarriers[i];
      const evaluated = obs.barriers.find((b) => b.id === def.id);
      const group = movingBarrierRefs.current[i];
      if (!evaluated || !group) continue;

      const baseCx = (def.box.minX + def.box.maxX) * 0.5;
      const baseCz = (def.box.minZ + def.box.maxZ) * 0.5;
      const evalCx = (evaluated.box.minX + evaluated.box.maxX) * 0.5;
      const evalCz = (evaluated.box.minZ + evaluated.box.maxZ) * 0.5;
      group.position.set(evalCx - baseCx, 0, evalCz - baseCz);
    }

    // 3. Swinging pendulums
    for (let i = 0; i < obs.pendulums.length; i += 1) {
      const group = pendulumGroupRefs.current[i];
      if (group) {
        group.rotation.z = obs.pendulums[i].angle;
      }
    }

    // 4. Rotating spinners
    for (let i = 0; i < obs.spinners.length; i += 1) {
      const group = spinnerGroupRefs.current[i];
      if (group) {
        group.rotation.y = obs.spinners[i].angle;
      }
    }

    // 5. Checkpoint lantern arches (blue -> warm gold when reached)
    for (let i = 0; i < checkpointArches.length; i += 1) {
      const cp = checkpointArches[i];
      const lit = state.checkpointIndex >= cp.index;
      if (lit !== checkpointLitStateRef.current[i]) {
        checkpointLitStateRef.current[i] = lit;
        const col = lit ? CHECKPOINT_WARM_COLOR : CHECKPOINT_COOL_COLOR;
        const em = lit ? CHECKPOINT_WARM_EMISSIVE : CHECKPOINT_COOL_EMISSIVE;
        const emInt = lit ? 1.45 : 0.28;

        const mats = [
          checkpointLeftLanternRefs.current[i],
          checkpointRightLanternRefs.current[i],
          checkpointStripRefs.current[i],
        ];
        for (const m of mats) {
          if (!m) continue;
          m.color.copy(col);
          m.emissive.copy(em);
          m.emissiveIntensity = m === checkpointStripRefs.current[i] ? emInt * 0.55 : emInt;
        }
      }
    }

    // 6. Wind zone snow-streak bands & fan rotors
    for (let i = 0; i < obs.windZones.length; i += 1) {
      const wind = obs.windZones[i];
      const streakGroup = windGroupRefs.current[i];
      const streakMat = windMaterials[i];
      const fanGroup = windFanRefs.current[i];
      const dir = Math.sign(wind.forceX) || 1;

      if (fanGroup) {
        const fanSpeed =
          wind.state === 'blowing' ? 18 : wind.state === 'warning' ? 6 : 1.2;
        fanGroup.rotation.x += dt * fanSpeed * dir;
      }

      if (!streakGroup || !streakMat) continue;

      if (wind.state === 'idle') {
        streakGroup.visible = false;
        continue;
      }

      streakGroup.visible = true;
      const isBlowing = wind.state === 'blowing';
      const speed = isBlowing ? 15.5 : 3.2;
      windScrollRef.current[i] = (windScrollRef.current[i] + dt * speed) % 1000;

      if (isBlowing) {
        streakMat.color.copy(WIND_BLOW_COLOR);
        streakMat.opacity = 0.82;
      } else {
        streakMat.color.copy(WIND_WARN_COLOR);
        streakMat.opacity = 0.24 + 0.08 * Math.sin(t * 10);
      }

      const xMin = wind.box.minX;
      const xMax = wind.box.maxX;
      const xSpan = xMax - xMin;
      const specs = windZoneStreaks[i];
      const meshes = windStreakMeshRefs.current[i];
      const scroll = windScrollRef.current[i];

      for (let j = 0; j < specs.length; j += 1) {
        const mesh = meshes[j];
        const spec = specs[j];
        if (!mesh || !spec) continue;
        const traveled = (spec.offsetX + scroll * spec.speedMul) % xSpan;
        const worldX = dir > 0 ? xMin + traveled : xMax - traveled;
        mesh.position.set(worldX, spec.y, spec.z);
        mesh.scale.x = isBlowing ? spec.len : spec.len * 0.55;
      }
    }
  });

  return (
    <group>
      {/* Static platforms */}
      {GLASS_COURSE.platforms.map((plat, idx) => {
        const { w, h, d, cx, cy, cz } = boxMetrics(plat.box);
        const antiZFightY = cy - (idx % 3) * 0.0015;
        const isIce = plat.surface === 'ice';

        return (
          <group key={plat.id} position={[cx, antiZFightY, cz]}>
            <mesh receiveShadow castShadow>
              <boxGeometry args={[w, h, d]} />
              {isIce ? (
                <meshPhysicalMaterial
                  color="#bae6fd"
                  roughness={0.1}
                  metalness={0.08}
                  clearcoat={1}
                  clearcoatRoughness={0.08}
                />
              ) : (
                <meshStandardMaterial
                  map={textures.wood}
                  color="#ffffff"
                  roughness={0.78}
                  metalness={0.04}
                />
              )}
            </mesh>

            {/* Left & right deck curb rails */}
            {([-1, 1] as const).map((side) => (
              <mesh
                key={side}
                position={[side * (w * 0.5 - 0.09), h * 0.5 + 0.025, 0]}
                receiveShadow
                castShadow
              >
                <boxGeometry args={[0.18, 0.06, d]} />
                <meshStandardMaterial
                  color={isIce ? '#e0f2fe' : '#5c351e'}
                  roughness={isIce ? 0.25 : 0.84}
                />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Moving ferry platforms */}
      {GLASS_COURSE.movingPlatforms.map((plat, idx) => {
        const { w, h, d, cx, cy, cz } = boxMetrics(plat.baseBox);
        return (
          <group
            key={plat.id}
            ref={(el) => {
              movingPlatRefs.current[idx] = el;
            }}
          >
            <group position={[cx, cy, cz]}>
              <mesh receiveShadow castShadow>
                <boxGeometry args={[w, h, d]} />
                <meshStandardMaterial
                  map={textures.wood}
                  color="#d99b66"
                  roughness={0.72}
                />
              </mesh>
              {/* Amber glowing trim rails marking moving platforms */}
              {([-1, 1] as const).map((side) => (
                <mesh
                  key={side}
                  position={[0, h * 0.5 + 0.02, side * (d * 0.5 - 0.08)]}
                >
                  <boxGeometry args={[w + 0.04, 0.05, 0.14]} />
                  <meshStandardMaterial
                    color="#fbbf24"
                    emissive="#f59e0b"
                    emissiveIntensity={0.35}
                    roughness={0.35}
                  />
                </mesh>
              ))}
            </group>
          </group>
        );
      })}

      {/* Static barriers */}
      {staticBarriers.map((barrier) => (
        <BarrierVisual
          key={barrier.id}
          barrier={barrier}
          hazardTex={textures.hazard}
        />
      ))}

      {/* Moving barriers */}
      {movingBarriers.map((barrier, idx) => (
        <group
          key={barrier.id}
          ref={(el) => {
            movingBarrierRefs.current[idx] = el;
          }}
        >
          <BarrierVisual barrier={barrier} hazardTex={textures.hazard} />
        </group>
      ))}

      {/* Checkpoint lantern arches (checkpoints[1..4]) */}
      {checkpointArches.map((cp, idx) => (
        <group key={`cp-arch-${cp.index}`} position={[0, 0, cp.triggerZ]}>
          {/* Left & right arch pillars */}
          {([-1, 1] as const).map((side) => (
            <group key={side} position={[side * 4.1, 0, 0]}>
              <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.32, 3.6, 0.32]} />
                <meshStandardMaterial color="#5c351e" roughness={0.85} />
              </mesh>
              <mesh position={[0, 3.66, 0]}>
                <boxGeometry args={[0.42, 0.14, 0.42]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
              </mesh>
            </group>
          ))}

          {/* Overhead crossbeam */}
          <mesh position={[0, 3.45, 0]} castShadow>
            <boxGeometry args={[8.5, 0.28, 0.34]} />
            <meshStandardMaterial color="#4a2a17" roughness={0.85} />
          </mesh>

          {/* Left lantern */}
          <group position={[-3.65, 2.75, 0]}>
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
              <meshStandardMaterial color="#334155" metalness={0.6} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.36, 0.46, 0.36]} />
              <meshStandardMaterial
                ref={(el) => {
                  checkpointLeftLanternRefs.current[idx] = el;
                }}
                color="#38bdf8"
                emissive="#0284c7"
                emissiveIntensity={0.28}
                roughness={0.25}
              />
            </mesh>
          </group>

          {/* Right lantern */}
          <group position={[3.65, 2.75, 0]}>
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
              <meshStandardMaterial color="#334155" metalness={0.6} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.36, 0.46, 0.36]} />
              <meshStandardMaterial
                ref={(el) => {
                  checkpointRightLanternRefs.current[idx] = el;
                }}
                color="#38bdf8"
                emissive="#0284c7"
                emissiveIntensity={0.28}
                roughness={0.25}
              />
            </mesh>
          </group>

          {/* Threshold strip across platform */}
          <mesh position={[0, 0.012, 0]} receiveShadow>
            <boxGeometry args={[7.8, 0.014, 0.26]} />
            <meshStandardMaterial
              ref={(el) => {
                checkpointStripRefs.current[idx] = el;
              }}
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={0.16}
              roughness={0.35}
            />
          </mesh>
        </group>
      ))}

      {/* Finish Arch at z = 140 */}
      <group position={[0, 0, GLASS_COURSE.finishZ]}>
        {([-1, 1] as const).map((side) => (
          <group key={side} position={[side * 4.45, 0, 0]}>
            <mesh position={[0, 2.2, 0]} castShadow>
              <cylinderGeometry args={[0.24, 0.28, 4.4, 14]} />
              <meshStandardMaterial
                color="#f59e0b"
                emissive="#d97706"
                emissiveIntensity={0.45}
                metalness={0.45}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[0, 4.55, 0]}>
              <octahedronGeometry args={[0.38, 0]} />
              <meshStandardMaterial
                color="#fef08a"
                emissive="#fbbf24"
                emissiveIntensity={1.2}
                roughness={0.18}
              />
            </mesh>
          </group>
        ))}

        {/* Golden finish crossbeam banner */}
        <mesh position={[0, 4.1, 0]} castShadow>
          <boxGeometry args={[9.4, 0.62, 0.48]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#f59e0b"
            emissiveIntensity={0.55}
            roughness={0.28}
            metalness={0.3}
          />
        </mesh>
        <mesh position={[0, 4.1, 0]}>
          <boxGeometry args={[8.6, 0.34, 0.52]} />
          <meshStandardMaterial
            map={textures.finish}
            emissive="#fbbf24"
            emissiveIntensity={0.25}
            roughness={0.35}
          />
        </mesh>

        {/* Checkered finish line ribbon on deck */}
        <mesh position={[0, 0.016, 0]} receiveShadow>
          <boxGeometry args={[9.2, 0.014, 0.85]} />
          <meshStandardMaterial
            map={textures.finish}
            emissive="#fbbf24"
            emissiveIntensity={0.22}
            roughness={0.45}
          />
        </mesh>
      </group>

      {/* Swinging Pendulums */}
      {GLASS_COURSE.pendulums.map((p, idx) => (
        <group key={p.id}>
          {/* Static gantry frame */}
          <mesh
            position={[p.pivotX, p.pivotY, p.pivotZ]}
            castShadow
          >
            <boxGeometry args={[9.2, 0.34, 0.38]} />
            <meshStandardMaterial color="#4a2a17" roughness={0.85} />
          </mesh>
          {([-1, 1] as const).map((side) => (
            <mesh
              key={side}
              position={[side * 4.45, p.pivotY * 0.5, p.pivotZ]}
              castShadow
            >
              <boxGeometry args={[0.3, p.pivotY, 0.34]} />
              <meshStandardMaterial color="#4a2a17" roughness={0.85} />
            </mesh>
          ))}

          {/* Dynamic swinging arm + heavy timber-iron hammer head */}
          <group
            ref={(el) => {
              pendulumGroupRefs.current[idx] = el;
            }}
            position={[p.pivotX, p.pivotY, p.pivotZ]}
          >
            <mesh>
              <sphereGeometry args={[0.24, 14, 12]} />
              <meshStandardMaterial
                color="#334155"
                metalness={0.7}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[0, -p.armLength * 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.09, 0.09, p.armLength, 12]} />
              <meshStandardMaterial
                color="#64748b"
                metalness={0.65}
                roughness={0.35}
              />
            </mesh>
            {/* Hammer bob */}
            <group position={[0, -p.armLength, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry
                  args={[p.bobRadius * 0.86, p.bobRadius * 0.86, p.bobRadius * 2.1, 18]}
                />
                <meshStandardMaterial color="#7c4724" roughness={0.72} />
              </mesh>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry
                  args={[p.bobRadius * 0.94, p.bobRadius * 0.94, 0.24, 18]}
                />
                <meshStandardMaterial
                  color="#ef4444"
                  emissive="#dc2626"
                  emissiveIntensity={0.45}
                  roughness={0.35}
                />
              </mesh>
              {([-1, 1] as const).map((capSide) => (
                <mesh
                  key={capSide}
                  position={[capSide * p.bobRadius * 1.02, 0, 0]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry
                    args={[p.bobRadius * 0.9, p.bobRadius * 0.9, 0.16, 18]}
                  />
                  <meshStandardMaterial
                    color="#1e293b"
                    metalness={0.75}
                    roughness={0.32}
                  />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      ))}

      {/* Rotating Spinner Bars */}
      {GLASS_COURSE.spinners.map((s, idx) => (
        <group key={s.id}>
          {/* Central pedestal hub */}
          <mesh position={[s.centerX, 0.58, s.centerZ]} castShadow receiveShadow>
            <cylinderGeometry args={[0.42, 0.52, 1.16, 20]} />
            <meshStandardMaterial
              color="#334155"
              metalness={0.68}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[s.centerX, 1.2, s.centerZ]}>
            <cylinderGeometry args={[0.3, 0.36, 0.14, 16]} />
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#f59e0b"
              emissiveIntensity={0.85}
              roughness={0.25}
            />
          </mesh>

          {/* Rotating hazard bar */}
          <group
            ref={(el) => {
              spinnerGroupRefs.current[idx] = el;
            }}
            position={[s.centerX, s.centerY, s.centerZ]}
          >
            <mesh castShadow receiveShadow>
              <boxGeometry
                args={[s.halfLength * 2, s.halfHeight * 2, s.halfThickness * 2]}
              />
              <meshStandardMaterial
                map={textures.hazard}
                emissive="#fbbf24"
                emissiveIntensity={0.25}
                roughness={0.4}
              />
            </mesh>
            {([-1, 1] as const).map((endSide) => (
              <mesh
                key={endSide}
                position={[endSide * s.halfLength, 0, 0]}
              >
                <sphereGeometry args={[s.halfHeight * 1.12, 14, 12]} />
                <meshStandardMaterial
                  color="#f43f5e"
                  emissive="#e11d48"
                  emissiveIntensity={0.65}
                  roughness={0.3}
                />
              </mesh>
            ))}
          </group>
        </group>
      ))}

      {/* Wind zones: side blower housings + snow-streak bands */}
      {GLASS_COURSE.windZones.map((zone, zIdx) => {
        const dir = Math.sign(zone.forceX) || 1;
        const blowerX = dir > 0 ? zone.box.minX - 0.45 : zone.box.maxX + 0.45;
        const midZ = (zone.box.minZ + zone.box.maxZ) * 0.5;
        const streaks = windZoneStreaks[zIdx];

        return (
          <group key={zone.id}>
            {/* Fan blower housing */}
            <group position={[blowerX, 1.15, midZ]}>
              <mesh castShadow>
                <boxGeometry args={[0.46, 2.3, zone.box.maxZ - zone.box.minZ - 1.2]} />
                <meshStandardMaterial
                  color="#334155"
                  metalness={0.55}
                  roughness={0.42}
                />
              </mesh>
              <group
                ref={(el) => {
                  windFanRefs.current[zIdx] = el;
                }}
                position={[dir * 0.28, 0, 0]}
              >
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.16, 0.16, 0.14, 12]} />
                  <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.5} />
                </mesh>
                <mesh>
                  <boxGeometry args={[0.06, 1.3, 0.24]} />
                  <meshStandardMaterial color="#bae6fd" />
                </mesh>
                <mesh>
                  <boxGeometry args={[0.06, 0.24, 1.3]} />
                  <meshStandardMaterial color="#bae6fd" />
                </mesh>
              </group>
            </group>

            {/* Snow-streak wind bands */}
            <group
              ref={(el) => {
                windGroupRefs.current[zIdx] = el;
              }}
              visible={false}
            >
              {streaks.map((spec, sIdx) => (
                <mesh
                  key={sIdx}
                  ref={(el) => {
                    windStreakMeshRefs.current[zIdx][sIdx] = el;
                  }}
                  geometry={windStreakGeo}
                  material={windMaterials[zIdx]}
                  position={[zone.box.minX + spec.offsetX, spec.y, spec.z]}
                />
              ))}
            </group>
          </group>
        );
      })}

      {/* Atmospheric Winter Abyss & Snowy Pine Backdrop */}
      <mesh position={[0, -11, 70]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[260, 260]} />
        <meshBasicMaterial color="#091526" />
      </mesh>

      {pinePositions.map((pine, idx) => (
        <group
          key={`pine-${idx}`}
          position={[pine.x, -2.5, pine.z]}
          scale={pine.scale}
        >
          <mesh position={[0, 1.3, 0]}>
            <cylinderGeometry args={[0.26, 0.38, 2.6, 7]} />
            <meshStandardMaterial color="#4a2e1b" roughness={0.92} />
          </mesh>
          <mesh position={[0, 3.6, 0]}>
            <coneGeometry args={[1.75, 3.6, 7]} />
            <meshStandardMaterial color="#183f31" roughness={0.88} />
          </mesh>
          <mesh position={[0, 5.2, 0]}>
            <coneGeometry args={[1.15, 2.3, 7]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.78} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
