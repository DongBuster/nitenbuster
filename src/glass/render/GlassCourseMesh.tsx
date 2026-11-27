import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLASS_COURSE, evaluateDynamicObstacles } from '../sim/course';
import { GLASS_MAP_THEMES } from '../sim/levels';
import type {
  BarrierDef,
  CourseDef,
  GlassMapTheme,
  PlatformDef,
  WindZoneDef,
} from '../sim/types';
import type { GlassRenderState } from './renderTypes';

export interface GlassCourseMeshProps {
  renderRef: RefObject<GlassRenderState>;
  course?: CourseDef;
}

const WIND_STREAKS_PER_ZONE = 10;

const WIND_WARN_COLOR = new THREE.Color('#7dd3fc');
const WIND_BLOW_COLOR = new THREE.Color('#f0f9ff');
const FRAGILE_IDLE_EMISSIVE = new THREE.Color('#000000');
const FRAGILE_WARN_EMISSIVE = new THREE.Color('#ea580c');

interface CourseTextures {
  deck: THREE.CanvasTexture;
  hazard: THREE.CanvasTexture;
  finish: THREE.CanvasTexture;
  conveyor: THREE.CanvasTexture;
}

function createCourseTextures(theme: GlassMapTheme): CourseTextures {
  // 1. Theme-aware deck texture
  const deckCanvas = document.createElement('canvas');
  deckCanvas.width = 256;
  deckCanvas.height = 256;
  const dCtx = deckCanvas.getContext('2d');
  if (dCtx) {
    dCtx.fillStyle = theme.deckPrimaryHex;
    dCtx.fillRect(0, 0, 256, 256);

    if (theme.id === 'sky_scaffold') {
      // Industrial riveted steel-gold grate
      const cell = 64;
      for (let r = 0; r < 4; r += 1) {
        for (let c = 0; c < 4; c += 1) {
          if ((r + c) % 2 === 1) {
            dCtx.fillStyle = theme.deckStripeHex;
            dCtx.fillRect(c * cell, r * cell, cell, cell);
          }
          dCtx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
          dCtx.lineWidth = 3;
          dCtx.strokeRect(c * cell + 1.5, r * cell + 1.5, cell - 3, cell - 3);

          // Grate diagonal ribs & corner rivets
          dCtx.fillStyle = 'rgba(255, 255, 255, 0.14)';
          dCtx.fillRect(c * cell + 8, r * cell + 8, 5, 5);
          dCtx.fillRect((c + 1) * cell - 13, r * cell + 8, 5, 5);
          dCtx.fillRect(c * cell + 8, (r + 1) * cell - 13, 5, 5);
          dCtx.fillRect((c + 1) * cell - 13, (r + 1) * cell - 13, 5, 5);
        }
      }
    } else if (theme.id === 'candy_factory') {
      // Pastel candy tile floor
      const tile = 64;
      for (let r = 0; r < 4; r += 1) {
        for (let c = 0; c < 4; c += 1) {
          dCtx.fillStyle =
            (r + c) % 2 === 0 ? theme.deckPrimaryHex : theme.deckStripeHex;
          dCtx.fillRect(c * tile, r * tile, tile, tile);

          dCtx.fillStyle = 'rgba(255, 255, 255, 0.28)';
          dCtx.fillRect(c * tile + 6, r * tile + 6, tile - 18, 6);

          dCtx.strokeStyle = 'rgba(131, 24, 67, 0.22)';
          dCtx.lineWidth = 3;
          dCtx.strokeRect(c * tile + 1.5, r * tile + 1.5, tile - 3, tile - 3);
        }
      }
    } else {
      // Warm cabin pine planks
      const plankCount = 4;
      const plankW = 256 / plankCount;
      for (let i = 0; i < plankCount; i += 1) {
        dCtx.fillStyle =
          i % 2 === 0 ? theme.deckPrimaryHex : theme.deckStripeHex;
        dCtx.fillRect(i * plankW, 0, plankW, 256);

        dCtx.fillStyle = 'rgba(35, 17, 7, 0.42)';
        dCtx.fillRect(i * plankW, 0, 3, 256);

        dCtx.fillStyle = 'rgba(58, 30, 14, 0.16)';
        dCtx.fillRect(i * plankW + 14, 0, 2, 256);
        dCtx.fillRect(i * plankW + 38, 0, 1.5, 256);
      }
      dCtx.fillStyle = 'rgba(35, 17, 7, 0.35)';
      dCtx.fillRect(0, 84, plankW * 2, 3);
      dCtx.fillRect(plankW * 2, 192, plankW * 2, 3);
    }
  }
  const deck = new THREE.CanvasTexture(deckCanvas);
  deck.colorSpace = THREE.SRGBColorSpace;
  deck.wrapS = THREE.RepeatWrapping;
  deck.wrapT = THREE.RepeatWrapping;
  deck.repeat.set(2, 5);
  deck.needsUpdate = true;

  // 2. Diagonal theme hazard stripe texture
  const hazCanvas = document.createElement('canvas');
  hazCanvas.width = 256;
  hazCanvas.height = 128;
  const hCtx = hazCanvas.getContext('2d');
  if (hCtx) {
    hCtx.fillStyle = theme.hazardStripeHex;
    hCtx.fillRect(0, 0, 256, 128);
    hCtx.fillStyle = theme.hazardPrimaryHex;
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

  // 4. Conveyor belt base texture (dark track slats with theme accent trim)
  const convCanvas = document.createElement('canvas');
  convCanvas.width = 256;
  convCanvas.height = 256;
  const cCtx = convCanvas.getContext('2d');
  if (cCtx) {
    cCtx.fillStyle = theme.id === 'candy_factory' ? '#3b175c' : '#162033';
    cCtx.fillRect(0, 0, 256, 256);

    const slatColor =
      theme.id === 'candy_factory'
        ? 'rgba(94, 234, 212, 0.22)'
        : 'rgba(251, 191, 36, 0.2)';
    cCtx.fillStyle = slatColor;
    for (let y = 0; y < 256; y += 32) {
      cCtx.fillRect(0, y, 256, 6);
    }
    cCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = 0; x < 256; x += 64) {
      cCtx.fillRect(x, 0, 2, 256);
    }
  }
  const conveyor = new THREE.CanvasTexture(convCanvas);
  conveyor.colorSpace = THREE.SRGBColorSpace;
  conveyor.wrapS = THREE.RepeatWrapping;
  conveyor.wrapT = THREE.RepeatWrapping;
  conveyor.repeat.set(2, 4);
  conveyor.needsUpdate = true;

  return { deck, hazard, finish, conveyor };
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

function getConveyorAccentHex(theme: GlassMapTheme): string {
  if (theme.id === 'candy_factory') return '#5eead4';
  if (theme.id === 'sky_scaffold') return '#fbbf24';
  return '#38bdf8';
}

function BarrierVisual({
  barrier,
  hazardTex,
  theme,
}: {
  barrier: BarrierDef;
  hazardTex: THREE.CanvasTexture;
  theme: GlassMapTheme;
}) {
  const { w, h, d, cx, cz } = boxMetrics(barrier.box);
  const bodyColor =
    theme.id === 'candy_factory'
      ? '#db2777'
      : theme.id === 'sky_scaffold'
        ? '#475569'
        : '#6d4226';
  const postColor =
    theme.id === 'candy_factory'
      ? '#9d174d'
      : theme.id === 'sky_scaffold'
        ? '#1e293b'
        : '#3f2414';
  const capAccent = theme.lanternWarmHex;

  if (barrier.kind === 'lowGap') {
    const beamH = h;
    const fasciaH = Math.min(0.42, beamH * 0.35);
    const headerH = Math.max(0.2, beamH - fasciaH);
    const isVerticalPiston = barrier.moveAxis === 'y';
    const deckTopY = isVerticalPiston ? 0 : Math.max(0, barrier.box.minY - 0.95);
    const supportHeight = Math.max(0.5, barrier.box.maxY - deckTopY);
    const postOffset = Math.max(0.2, w * 0.5 - 0.12);

    return (
      <group>
        {/* Overhead beam header */}
        <mesh
          position={[cx, barrier.box.minY + fasciaH + headerH * 0.5, cz]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[w, headerH, d]} />
          <meshStandardMaterial color={bodyColor} roughness={0.78} />
        </mesh>

        {/* Lower striped hazard fascia */}
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

        {isVerticalPiston ? (
          /* Overhead piston guide rods for vertical crushers */
          ([-1, 1] as const).map((side) => (
            <mesh
              key={side}
              position={[cx + side * (postOffset * 0.72), barrier.box.maxY + 1.15, cz]}
              castShadow
            >
              <cylinderGeometry args={[0.14, 0.14, 2.3, 12]} />
              <meshStandardMaterial
                color="#cbd5e1"
                metalness={0.65}
                roughness={0.28}
              />
            </mesh>
          ))
        ) : (
          <>
            {/* Outer support posts anchoring beam to deck */}
            {([-1, 1] as const).map((side) => (
              <mesh
                key={side}
                position={[
                  cx + side * postOffset,
                  deckTopY + supportHeight * 0.5,
                  cz,
                ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[0.22, supportHeight, d + 0.06]} />
                <meshStandardMaterial color={postColor} roughness={0.86} />
              </mesh>
            ))}

            {/* Painted floor warning strip directly underneath for effortless depth reading */}
            <mesh position={[cx, deckTopY + 0.015, cz]} receiveShadow>
              <boxGeometry args={[Math.max(0.5, w - 0.16), 0.012, d + 0.48]} />
              <meshStandardMaterial
                map={hazardTex}
                emissive={theme.hazardPrimaryHex}
                emissiveIntensity={0.16}
                roughness={0.55}
              />
            </mesh>
          </>
        )}
      </group>
    );
  }

  if (barrier.kind === 'highWall') {
    const capH = 0.2;
    const bodyH = Math.max(0.2, h - capH);
    const postOffset = Math.max(0.15, w * 0.5 - 0.12);

    return (
      <group>
        {/* Hurdle body */}
        <mesh
          position={[cx, barrier.box.minY + bodyH * 0.5, cz]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[w - 0.08, bodyH, d * 0.78]} />
          <meshStandardMaterial color={theme.deckPrimaryHex} roughness={0.76} />
        </mesh>

        {/* Side vertical hurdle posts */}
        {([-1, 1] as const).map((side) => (
          <mesh
            key={side}
            position={[cx + side * postOffset, barrier.box.minY + h * 0.5, cz]}
            castShadow
          >
            <boxGeometry args={[0.2, h, d + 0.04]} />
            <meshStandardMaterial color={postColor} roughness={0.84} />
          </mesh>
        ))}

        {/* Bright top cap rail signaling players to lift with E */}
        <mesh
          position={[cx, barrier.box.maxY - capH * 0.5, cz]}
          castShadow
        >
          <boxGeometry args={[w + 0.08, capH, d + 0.08]} />
          <meshStandardMaterial
            color={capAccent}
            emissive={capAccent}
            emissiveIntensity={0.38}
            roughness={0.3}
          />
        </mesh>
      </group>
    );
  }

  if (barrier.kind === 'pillar') {
    const postH = h - 0.24;
    const capColor =
      theme.id === 'candy_factory'
        ? '#fbcfe8'
        : theme.id === 'sky_scaffold'
          ? '#94a3b8'
          : '#f1f5f9';
    return (
      <group>
        <mesh
          position={[cx, barrier.box.minY + postH * 0.5, cz]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[w, postH, d]} />
          <meshStandardMaterial color={bodyColor} roughness={0.85} />
        </mesh>
        {/* Warm lantern block */}
        <mesh position={[cx, barrier.box.maxY - 0.34, cz]}>
          <boxGeometry args={[w * 0.72, 0.34, d * 0.72]} />
          <meshStandardMaterial
            color={theme.lanternWarmHex}
            emissive={theme.lanternWarmHex}
            emissiveIntensity={0.85}
            roughness={0.25}
          />
        </mesh>
        {/* Top cap */}
        <mesh position={[cx, barrier.box.maxY - 0.07, cz]} castShadow>
          <boxGeometry args={[w + 0.12, 0.14, d + 0.12]} />
          <meshStandardMaterial color={capColor} roughness={0.62} />
        </mesh>
      </group>
    );
  }

  // 'wall': sturdy gate wall with plinth and cap
  const plinthH = 0.28;
  const capH = 0.14;
  const wallH = Math.max(0.2, h - plinthH - capH);
  const topCapColor =
    theme.id === 'candy_factory'
      ? '#fbcfe8'
      : theme.id === 'sky_scaffold'
        ? theme.hazardPrimaryHex
        : '#f1f5f9';
  return (
    <group>
      <mesh
        position={[cx, barrier.box.minY + plinthH * 0.5, cz]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w + 0.04, plinthH, d + 0.04]} />
        <meshStandardMaterial color={postColor} roughness={0.88} />
      </mesh>
      <mesh
        position={[cx, barrier.box.minY + plinthH + wallH * 0.5, cz]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w, wallH, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.82} />
      </mesh>
      <mesh position={[cx, barrier.box.maxY - capH * 0.5, cz]} castShadow>
        <boxGeometry args={[w + 0.1, capH, d + 0.1]} />
        <meshStandardMaterial color={topCapColor} roughness={0.65} />
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
      y: zone.box.minY + 0.42 + ((i * 0.43) % 1) * 1.55,
      z: zone.box.minZ + frac * zSpan,
      len: 1.3 + (i % 3) * 0.55,
      speedMul: 0.82 + (i % 4) * 0.14,
    });
  }
  return specs;
}

interface ConveyorSpec {
  plat: PlatformDef;
  vx: number;
  vz: number;
  speed: number;
  angle: number;
  dirX: number;
  dirZ: number;
  perpX: number;
  perpZ: number;
  span: number;
  laneOffsets: readonly number[];
  chevronsPerLane: number;
  deckTopHalfH: number;
}

function buildConveyorSpec(plat: PlatformDef): ConveyorSpec | null {
  const vx = plat.conveyorVx ?? 0;
  const vz = plat.conveyorVz ?? 0;
  const speed = Math.hypot(vx, vz);
  if (speed <= 0.001) return null;

  const { w, h, d } = boxMetrics(plat.box);
  const angle = Math.atan2(vx, vz);
  const dirX = Math.sin(angle);
  const dirZ = Math.cos(angle);
  const perpX = -dirZ;
  const perpZ = dirX;

  const span = Math.max(
    1.5,
    Math.abs(dirX) * (w - 1.0) + Math.abs(dirZ) * (d - 1.0),
  );
  const crossSpan = Math.abs(perpX) * w + Math.abs(perpZ) * d;
  const laneOffsets = crossSpan > 5.0 ? [-1.85, 1.85] : [0];
  const chevronsPerLane = Math.max(4, Math.min(8, Math.round(span / 2.4)));

  return {
    plat,
    vx,
    vz,
    speed,
    angle,
    dirX,
    dirZ,
    perpX,
    perpZ,
    span,
    laneOffsets,
    chevronsPerLane,
    deckTopHalfH: h * 0.5,
  };
}

interface SidePropSpec {
  x: number;
  z: number;
  scale: number;
  variant: number;
}

function SideSceneryProp({
  prop,
  theme,
}: {
  prop: SidePropSpec;
  theme: GlassMapTheme;
}) {
  if (theme.id === 'sky_scaffold') {
    const beaconColor = prop.variant % 2 === 0 ? '#fb923c' : '#fbbf24';
    const jibDir = prop.x < 0 ? 1 : -1;
    return (
      <group position={[prop.x, -4.2, prop.z]} scale={prop.scale}>
        {/* Main steel tower column */}
        <mesh position={[0, 4.8, 0]}>
          <boxGeometry args={[0.95, 9.6, 0.95]} />
          <meshStandardMaterial color="#334155" metalness={0.58} roughness={0.48} />
        </mesh>
        {/* Amber cross collar */}
        <mesh position={[0, 7.6, 0]}>
          <boxGeometry args={[1.25, 0.5, 1.25]} />
          <meshStandardMaterial color="#b45309" metalness={0.4} roughness={0.45} />
        </mesh>
        {/* Crane jib arm */}
        <mesh position={[jibDir * 1.4, 9.35, 0]}>
          <boxGeometry args={[3.8, 0.42, 0.48]} />
          <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.42} />
        </mesh>
        {/* Top warning beacon */}
        <mesh position={[0, 10.0, 0]}>
          <sphereGeometry args={[0.3, 10, 8]} />
          <meshStandardMaterial
            color={beaconColor}
            emissive={beaconColor}
            emissiveIntensity={1.1}
          />
        </mesh>
      </group>
    );
  }

  if (theme.id === 'candy_factory') {
    const candyColors = ['#f472b6', '#5eead4', '#fde047', '#c084fc'];
    const mainCol = candyColors[prop.variant % candyColors.length];
    const ringCol = candyColors[(prop.variant + 1) % candyColors.length];
    return (
      <group position={[prop.x, -3.0, prop.z]} scale={prop.scale}>
        {/* Candy stick pole */}
        <mesh position={[0, 3.0, 0]}>
          <cylinderGeometry args={[0.22, 0.26, 6.0, 10]} />
          <meshStandardMaterial color="#fdf2f8" roughness={0.42} />
        </mesh>
        {/* Giant lollipop disc */}
        <mesh position={[0, 6.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.55, 1.55, 0.45, 20]} />
          <meshStandardMaterial
            color={mainCol}
            emissive={mainCol}
            emissiveIntensity={0.22}
            roughness={0.32}
          />
        </mesh>
        <mesh position={[0, 6.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.92, 0.92, 0.5, 18]} />
          <meshStandardMaterial
            color={ringCol}
            emissive={ringCol}
            emissiveIntensity={0.25}
            roughness={0.3}
          />
        </mesh>
      </group>
    );
  }

  // Default: 'cabin_bridge' snowy pine
  return (
    <group position={[prop.x, -2.5, prop.z]} scale={prop.scale}>
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
  );
}

export function GlassCourseMesh({
  renderRef,
  course = GLASS_COURSE,
}: GlassCourseMeshProps) {
  const theme = course.theme ?? GLASS_MAP_THEMES.cabin_bridge;
  const conveyorAccentHex = getConveyorAccentHex(theme);

  const textures = useMemo(() => createCourseTextures(theme), [theme]);

  const checkpointColors = useMemo(
    () => ({
      cool: new THREE.Color(theme.lanternCoolHex),
      warm: new THREE.Color(theme.lanternWarmHex),
    }),
    [theme.lanternCoolHex, theme.lanternWarmHex],
  );

  const windMaterials = useMemo(
    () =>
      course.windZones.map(
        () =>
          new THREE.MeshBasicMaterial({
            color: '#f0f9ff',
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
          }),
      ),
    [course.windZones],
  );
  const windStreakGeo = useMemo(() => new THREE.BoxGeometry(1, 0.055, 0.12), []);

  const conveyorArrowGeo = useMemo(
    () => new THREE.BoxGeometry(0.56, 0.026, 0.14),
    [],
  );
  const conveyorArrowMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: conveyorAccentHex,
        emissive: conveyorAccentHex,
        emissiveIntensity: 0.9,
        roughness: 0.25,
      }),
    [conveyorAccentHex],
  );

  useEffect(() => {
    return () => {
      textures.deck.dispose();
      textures.hazard.dispose();
      textures.finish.dispose();
      textures.conveyor.dispose();
      windStreakGeo.dispose();
      conveyorArrowGeo.dispose();
      conveyorArrowMat.dispose();
      for (const mat of windMaterials) {
        mat.dispose();
      }
    };
  }, [
    textures,
    windMaterials,
    windStreakGeo,
    conveyorArrowGeo,
    conveyorArrowMat,
  ]);

  const staticBarriers = useMemo(
    () => course.barriers.filter((b) => b.moveAxis === undefined),
    [course.barriers],
  );
  const movingBarriers = useMemo(
    () => course.barriers.filter((b) => b.moveAxis !== undefined),
    [course.barriers],
  );
  const checkpointArches = useMemo(
    () => course.checkpoints.slice(1),
    [course.checkpoints],
  );
  const windZoneStreaks = useMemo(
    () => course.windZones.map((w) => buildWindZoneStreaks(w)),
    [course.windZones],
  );
  const fragilePlatforms = useMemo(
    () => course.platforms.filter((p) => p.fragile !== undefined),
    [course.platforms],
  );
  const conveyorSpecs = useMemo(
    () =>
      course.platforms
        .map((p) => buildConveyorSpec(p))
        .filter((spec): spec is ConveyorSpec => spec !== null),
    [course.platforms],
  );

  const finishY = useMemo(() => {
    const plat = course.platforms.find(
      (p) => p.box.minZ <= course.finishZ && p.box.maxZ >= course.finishZ,
    );
    if (plat) return plat.box.maxY;
    return course.checkpoints[course.checkpoints.length - 1]?.p1Spawn.y ?? 0;
  }, [course.checkpoints, course.finishZ, course.platforms]);

  const sidePropPositions = useMemo(() => {
    const list: SidePropSpec[] = [];
    const endZ = course.finishZ + 20;
    let idx = 0;
    for (let z = -12; z <= endZ; z += 11) {
      const absZ = Math.abs(z);
      list.push({
        x: -11.2 - ((absZ * 7) % 5),
        z,
        scale: 0.9 + ((absZ * 3) % 4) * 0.14,
        variant: idx,
      });
      list.push({
        x: 11.2 + ((absZ * 11) % 5),
        z: z + 4.5,
        scale: 0.9 + ((absZ * 5) % 4) * 0.14,
        variant: idx + 1,
      });
      idx += 2;
    }
    return list;
  }, [course.finishZ]);

  const abyssDepth = Math.max(180, course.finishZ + 120);
  const abyssCenterZ = (course.finishZ + 8) * 0.5;

  const movingPlatRefs = useRef<(THREE.Group | null)[]>([]);
  const movingBarrierRefs = useRef<(THREE.Group | null)[]>([]);
  const pendulumGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const spinnerGroupRefs = useRef<(THREE.Group | null)[]>([]);

  const fragileGroupRefs = useRef<Record<string, THREE.Group | null>>({});
  const fragileMatRefs = useRef<Record<string, THREE.MeshStandardMaterial | null>>({});
  const conveyorChevronRefs = useRef<Record<string, (THREE.Group | null)[]>>({});

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
    course.windZones.map(() => []),
  );
  const windFanRefs = useRef<(THREE.Group | null)[]>([]);
  const windScrollRef = useRef<number[]>(course.windZones.map(() => 0));

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const state = renderRef.current;
    const t = clock.elapsedTime;
    const obs = evaluateDynamicObstacles(course, state.matchTime);

    // 1. Moving platforms (horizontal & vertical elevators)
    const staticPlatCount = course.platforms.length;
    for (let i = 0; i < course.movingPlatforms.length; i += 1) {
      const def = course.movingPlatforms[i];
      const evaluated = obs.platforms[staticPlatCount + i];
      const group = movingPlatRefs.current[i];
      if (!evaluated || !group) continue;

      const baseCx = (def.baseBox.minX + def.baseBox.maxX) * 0.5;
      const baseCy = (def.baseBox.minY + def.baseBox.maxY) * 0.5;
      const baseCz = (def.baseBox.minZ + def.baseBox.maxZ) * 0.5;
      const evalCx = (evaluated.box.minX + evaluated.box.maxX) * 0.5;
      const evalCy = (evaluated.box.minY + evaluated.box.maxY) * 0.5;
      const evalCz = (evaluated.box.minZ + evaluated.box.maxZ) * 0.5;
      group.position.set(evalCx - baseCx, evalCy - baseCy, evalCz - baseCz);
    }

    // 2. Moving barriers (horizontal & vertical pistons)
    for (let i = 0; i < movingBarriers.length; i += 1) {
      const def = movingBarriers[i];
      const evaluated = obs.barriers.find((b) => b.id === def.id);
      const group = movingBarrierRefs.current[i];
      if (!evaluated || !group) continue;

      const baseCx = (def.box.minX + def.box.maxX) * 0.5;
      const baseCy = (def.box.minY + def.box.maxY) * 0.5;
      const baseCz = (def.box.minZ + def.box.maxZ) * 0.5;
      const evalCx = (evaluated.box.minX + evaluated.box.maxX) * 0.5;
      const evalCy = (evaluated.box.minY + evaluated.box.maxY) * 0.5;
      const evalCz = (evaluated.box.minZ + evaluated.box.maxZ) * 0.5;
      group.position.set(evalCx - baseCx, evalCy - baseCy, evalCz - baseCz);
    }

    // 3. Fragile platforms (solid / shaking / gone)
    for (let i = 0; i < fragilePlatforms.length; i += 1) {
      const plat = fragilePlatforms[i];
      const group = fragileGroupRefs.current[plat.id];
      const mat = fragileMatRefs.current[plat.id];
      const fs = state.fragileStates[plat.id];

      if (!fs || fs.state === 'solid') {
        if (group) {
          group.visible = true;
          group.position.set(0, 0, 0);
        }
        if (mat) {
          mat.emissive.copy(FRAGILE_IDLE_EMISSIVE);
          mat.emissiveIntensity = 0;
        }
      } else if (fs.state === 'shaking') {
        if (group) {
          group.visible = true;
          group.position.set(
            Math.sin(t * 55) * 0.09,
            0,
            Math.cos(t * 55) * 0.09,
          );
        }
        if (mat) {
          mat.emissive.copy(FRAGILE_WARN_EMISSIVE);
          mat.emissiveIntensity = 0.6 + 0.25 * Math.sin(t * 40);
        }
      } else {
        if (group) {
          group.visible = false;
          group.position.set(0, 0, 0);
        }
        if (mat) {
          mat.emissive.copy(FRAGILE_IDLE_EMISSIVE);
          mat.emissiveIntensity = 0;
        }
      }
    }

    // 4. Conveyor animated chevron arrows
    for (let i = 0; i < conveyorSpecs.length; i += 1) {
      const spec = conveyorSpecs[i];
      const chevrons = conveyorChevronRefs.current[spec.plat.id];
      if (!chevrons) continue;

      const cyclesPerSec = spec.speed / Math.max(spec.span, 1);
      let idx = 0;
      for (let l = 0; l < spec.laneOffsets.length; l += 1) {
        const laneOff = spec.laneOffsets[l];
        const baseX = spec.perpX * laneOff;
        const baseZ = spec.perpZ * laneOff;
        for (let c = 0; c < spec.chevronsPerLane; c += 1) {
          const chevron = chevrons[idx];
          idx += 1;
          if (!chevron) continue;
          const phase = ((t * cyclesPerSec + c / spec.chevronsPerLane) % 1 + 1) % 1;
          const travel = (phase - 0.5) * spec.span;
          chevron.position.set(
            baseX + spec.dirX * travel,
            spec.deckTopHalfH + 0.025,
            baseZ + spec.dirZ * travel,
          );
        }
      }
    }

    // 5. Swinging pendulums
    for (let i = 0; i < obs.pendulums.length; i += 1) {
      const group = pendulumGroupRefs.current[i];
      if (group) {
        group.rotation.z = obs.pendulums[i].angle;
      }
    }

    // 6. Rotating spinners
    for (let i = 0; i < obs.spinners.length; i += 1) {
      const group = spinnerGroupRefs.current[i];
      if (group) {
        group.rotation.y = obs.spinners[i].angle;
      }
    }

    // 7. Checkpoint lantern arches (cool -> warm when reached)
    for (let i = 0; i < checkpointArches.length; i += 1) {
      const cp = checkpointArches[i];
      const lit = state.checkpointIndex >= cp.index;
      if (lit !== checkpointLitStateRef.current[i]) {
        checkpointLitStateRef.current[i] = lit;
        const col = lit ? checkpointColors.warm : checkpointColors.cool;
        const emInt = lit ? 1.45 : 0.28;

        const mats = [
          checkpointLeftLanternRefs.current[i],
          checkpointRightLanternRefs.current[i],
          checkpointStripRefs.current[i],
        ];
        for (const m of mats) {
          if (!m) continue;
          m.color.copy(col);
          m.emissive.copy(col);
          m.emissiveIntensity =
            m === checkpointStripRefs.current[i] ? emInt * 0.55 : emInt;
        }
      }
    }

    // 8. Wind zone streak bands & fan rotors
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

  const conveyorById = useMemo(() => {
    const map = new Map<string, ConveyorSpec>();
    for (const spec of conveyorSpecs) {
      map.set(spec.plat.id, spec);
    }
    return map;
  }, [conveyorSpecs]);

  return (
    <group>
      {/* Static platforms */}
      {course.platforms.map((plat, idx) => {
        const { w, h, d, cx, cy, cz } = boxMetrics(plat.box);
        const antiZFightY = cy - (idx % 3) * 0.0015;
        const isIce = plat.surface === 'ice';
        const isFragile = plat.fragile !== undefined;
        const convSpec = conveyorById.get(plat.id);

        return (
          <group key={plat.id} position={[cx, antiZFightY, cz]}>
            <group
              ref={(el) => {
                if (isFragile) {
                  fragileGroupRefs.current[plat.id] = el;
                }
              }}
            >
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
                ) : convSpec ? (
                  <meshStandardMaterial
                    map={textures.conveyor}
                    color="#ffffff"
                    roughness={0.58}
                    metalness={0.18}
                  />
                ) : isFragile ? (
                  <meshStandardMaterial
                    ref={(el) => {
                      fragileMatRefs.current[plat.id] = el;
                    }}
                    map={textures.deck}
                    color="#fde68a"
                    roughness={0.78}
                    metalness={0.04}
                  />
                ) : (
                  <meshStandardMaterial
                    map={textures.deck}
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
                    color={
                      isIce
                        ? '#e0f2fe'
                        : convSpec
                          ? conveyorAccentHex
                          : isFragile
                            ? '#f97316'
                            : theme.curbHex
                    }
                    emissive={
                      convSpec
                        ? conveyorAccentHex
                        : isFragile
                          ? '#ea580c'
                          : '#000000'
                    }
                    emissiveIntensity={convSpec ? 0.32 : isFragile ? 0.25 : 0}
                    roughness={isIce ? 0.25 : 0.72}
                  />
                </mesh>
              ))}

              {/* Fragile warning trim: dashed amber/orange border + surface crack lines */}
              {isFragile && (
                <>
                  {([-1, 1] as const).map((endSide) => (
                    <mesh
                      key={`frag-cap-${endSide}`}
                      position={[0, h * 0.5 + 0.025, endSide * (d * 0.5 - 0.09)]}
                    >
                      <boxGeometry args={[w - 0.24, 0.055, 0.16]} />
                      <meshStandardMaterial
                        color="#fbbf24"
                        emissive="#f59e0b"
                        emissiveIntensity={0.35}
                        roughness={0.4}
                      />
                    </mesh>
                  ))}
                  {([-0.9, 0, 0.9] as const).map((crackZ, cIdx) => (
                    <mesh
                      key={`crack-${cIdx}`}
                      position={[
                        (cIdx - 1) * 0.85,
                        h * 0.5 + 0.012,
                        crackZ * Math.min(1, d * 0.25),
                      ]}
                      rotation={[0, cIdx % 2 === 0 ? 0.45 : -0.52, 0]}
                    >
                      <boxGeometry args={[Math.min(2.6, w * 0.45), 0.012, 0.1]} />
                      <meshStandardMaterial
                        color="#7c2d12"
                        emissive="#ea580c"
                        emissiveIntensity={0.28}
                        roughness={0.6}
                      />
                    </mesh>
                  ))}
                </>
              )}

              {/* Conveyor animated glowing chevron arrows */}
              {convSpec &&
                (() => {
                  const total =
                    convSpec.laneOffsets.length * convSpec.chevronsPerLane;
                  if (!conveyorChevronRefs.current[plat.id]) {
                    conveyorChevronRefs.current[plat.id] = new Array(total).fill(
                      null,
                    );
                  }
                  return Array.from({ length: total }, (_, cIdx) => (
                    <group
                      key={`chev-${cIdx}`}
                      ref={(el) => {
                        conveyorChevronRefs.current[plat.id][cIdx] = el;
                      }}
                      position={[0, h * 0.5 + 0.025, 0]}
                      rotation={[0, convSpec.angle, 0]}
                    >
                      <mesh
                        geometry={conveyorArrowGeo}
                        material={conveyorArrowMat}
                        position={[-0.18, 0, 0]}
                        rotation={[0, -Math.PI / 4, 0]}
                      />
                      <mesh
                        geometry={conveyorArrowGeo}
                        material={conveyorArrowMat}
                        position={[0.18, 0, 0]}
                        rotation={[0, Math.PI / 4, 0]}
                      />
                    </group>
                  ));
                })()}
            </group>
          </group>
        );
      })}

      {/* Moving ferry & elevator platforms */}
      {course.movingPlatforms.map((plat, idx) => {
        const { w, h, d, cx, cy, cz } = boxMetrics(plat.baseBox);
        const isElevator = plat.axis === 'y';
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
                  map={textures.deck}
                  color={isElevator ? '#cbd5e1' : '#fde68a'}
                  roughness={isElevator ? 0.52 : 0.72}
                  metalness={isElevator ? 0.25 : 0.05}
                />
              </mesh>
              {/* Glowing trim rails marking moving platforms & elevators */}
              {([-1, 1] as const).map((side) => (
                <mesh
                  key={side}
                  position={[0, h * 0.5 + 0.02, side * (d * 0.5 - 0.08)]}
                >
                  <boxGeometry args={[w + 0.04, 0.05, 0.14]} />
                  <meshStandardMaterial
                    color={isElevator ? theme.lanternCoolHex : theme.lanternWarmHex}
                    emissive={
                      isElevator ? theme.lanternCoolHex : theme.lanternWarmHex
                    }
                    emissiveIntensity={0.4}
                    roughness={0.32}
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
          theme={theme}
        />
      ))}

      {/* Moving barriers + static floor target strips for vertical pistons */}
      {movingBarriers.map((barrier, idx) => {
        const { w, d, cx, cz } = boxMetrics(barrier.box);
        return (
          <group key={barrier.id}>
            <group
              ref={(el) => {
                movingBarrierRefs.current[idx] = el;
              }}
            >
              <BarrierVisual
                barrier={barrier}
                hazardTex={textures.hazard}
                theme={theme}
              />
            </group>
            {barrier.moveAxis === 'y' && (
              <mesh position={[cx, 0.015, cz]} receiveShadow>
                <boxGeometry args={[Math.max(0.5, w - 0.16), 0.012, d + 0.48]} />
                <meshStandardMaterial
                  map={textures.hazard}
                  emissive={theme.hazardPrimaryHex}
                  emissiveIntensity={0.2}
                  roughness={0.55}
                />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Checkpoint lantern arches */}
      {checkpointArches.map((cp, idx) => (
        <group
          key={`cp-arch-${cp.index}`}
          position={[0, cp.p1Spawn.y, cp.triggerZ]}
        >
          {/* Left & right arch pillars */}
          {([-1, 1] as const).map((side) => (
            <group key={side} position={[side * 4.1, 0, 0]}>
              <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.32, 3.6, 0.32]} />
                <meshStandardMaterial color={theme.curbHex} roughness={0.82} />
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
            <meshStandardMaterial color={theme.curbHex} roughness={0.82} />
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
                color={theme.lanternCoolHex}
                emissive={theme.lanternCoolHex}
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
                color={theme.lanternCoolHex}
                emissive={theme.lanternCoolHex}
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
              color={theme.lanternCoolHex}
              emissive={theme.lanternCoolHex}
              emissiveIntensity={0.16}
              roughness={0.35}
            />
          </mesh>
        </group>
      ))}

      {/* Finish Arch at z = course.finishZ */}
      <group position={[0, finishY, course.finishZ]}>
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
                color={theme.lanternWarmHex}
                emissive={theme.lanternWarmHex}
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
      {course.pendulums.map((p, idx) => (
        <group key={p.id}>
          {/* Static gantry frame */}
          <mesh position={[p.pivotX, p.pivotY, p.pivotZ]} castShadow>
            <boxGeometry args={[9.2, 0.34, 0.38]} />
            <meshStandardMaterial color={theme.curbHex} roughness={0.82} />
          </mesh>
          {([-1, 1] as const).map((side) => (
            <mesh
              key={side}
              position={[p.pivotX + side * 4.45, p.pivotY * 0.5, p.pivotZ]}
              castShadow
            >
              <boxGeometry args={[0.3, p.pivotY, 0.34]} />
              <meshStandardMaterial color={theme.curbHex} roughness={0.82} />
            </mesh>
          ))}

          {/* Dynamic swinging arm + hammer head */}
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
                  args={[
                    p.bobRadius * 0.86,
                    p.bobRadius * 0.86,
                    p.bobRadius * 2.1,
                    18,
                  ]}
                />
                <meshStandardMaterial
                  color={
                    theme.id === 'candy_factory'
                      ? '#ec4899'
                      : theme.id === 'sky_scaffold'
                        ? '#b45309'
                        : '#7c4724'
                  }
                  roughness={0.72}
                />
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
      {course.spinners.map((s, idx) => {
        const underPlat = course.platforms.find(
          (p) =>
            p.box.minX <= s.centerX &&
            p.box.maxX >= s.centerX &&
            p.box.minZ <= s.centerZ &&
            p.box.maxZ >= s.centerZ &&
            p.box.maxY <= s.centerY + 0.05,
        );
        const deckY = underPlat ? underPlat.box.maxY : 0;
        const hubHeight = Math.max(0.75, s.centerY - deckY + 0.45);
        const hubCenterY = deckY + hubHeight * 0.5;
        const beaconY = s.centerY + s.halfHeight + 0.18;

        return (
          <group key={s.id}>
            {/* Central pedestal hub */}
            <mesh position={[s.centerX, hubCenterY, s.centerZ]} castShadow receiveShadow>
              <cylinderGeometry args={[0.42, 0.52, hubHeight, 20]} />
              <meshStandardMaterial
                color="#334155"
                metalness={0.68}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[s.centerX, beaconY, s.centerZ]}>
              <cylinderGeometry args={[0.3, 0.36, 0.14, 16]} />
              <meshStandardMaterial
                color={theme.lanternWarmHex}
                emissive={theme.lanternWarmHex}
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
                  emissive={theme.hazardPrimaryHex}
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
        );
      })}

      {/* Wind zones: side blower housings + streak bands */}
      {course.windZones.map((zone, zIdx) => {
        const dir = Math.sign(zone.forceX) || 1;
        const blowerX = dir > 0 ? zone.box.minX - 0.45 : zone.box.maxX + 0.45;
        const midZ = (zone.box.minZ + zone.box.maxZ) * 0.5;
        const streaks = windZoneStreaks[zIdx];

        return (
          <group key={zone.id}>
            {/* Fan blower housing */}
            <group position={[blowerX, zone.box.minY + 1.15, midZ]}>
              <mesh castShadow>
                <boxGeometry
                  args={[0.46, 2.3, zone.box.maxZ - zone.box.minZ - 1.2]}
                />
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
                  <meshStandardMaterial
                    color={theme.lanternCoolHex}
                    emissive={theme.lanternCoolHex}
                    emissiveIntensity={0.5}
                  />
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

            {/* Wind streak bands */}
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

      {/* Theme-aware Abyss & Decorative Side Backdrop */}
      <mesh position={[0, -11, abyssCenterZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[260, abyssDepth]} />
        <meshBasicMaterial color={theme.abyssHex} />
      </mesh>

      {sidePropPositions.map((prop, idx) => (
        <SideSceneryProp key={`prop-${idx}`} prop={prop} theme={theme} />
      ))}
    </group>
  );
}
