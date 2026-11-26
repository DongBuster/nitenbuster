import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  GLASS_HALF_HEIGHT,
  GLASS_HEIGHT,
  GLASS_THICKNESS,
  SHATTER_RESPAWN_SEC,
} from '../sim/constants';
import type { GlassRenderState } from './renderTypes';

export interface GlassPaneMeshProps {
  renderRef: RefObject<GlassRenderState>;
}

const SHARD_COUNT = 28;
const SAFE_COLOR = new THREE.Color('#67e8f9');
const WARN_COLOR = new THREE.Color('#fbbf24');
const DANGER_COLOR = new THREE.Color('#f43f5e');
const PULSE_BRIGHT = new THREE.Color('#fda4af');

interface ShardParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  sx: number;
  sy: number;
  sz: number;
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly [number, number][],
  width: number,
  color: string,
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function paintBaseCrystalCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, 'rgba(207, 250, 254, 0.36)');
  grad.addColorStop(0.5, 'rgba(240, 249, 255, 0.24)');
  grad.addColorStop(1, 'rgba(165, 243, 252, 0.36)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Diagonal crystal shine bands
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  const stripes = [
    [68, 42],
    [138, 16],
    [296, 34],
    [358, 14],
    [438, 24],
  ];
  for (const [xStart, width] of stripes) {
    ctx.beginPath();
    ctx.moveTo(xStart, 0);
    ctx.lineTo(xStart + width, 0);
    ctx.lineTo(xStart + width - 56, h);
    ctx.lineTo(xStart - 56, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Subtle icy inner border rim
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);
}

function createGlassTextures(): {
  hp3: THREE.CanvasTexture;
  hp2: THREE.CanvasTexture;
  hp1: THREE.CanvasTexture;
} {
  const w = 512;
  const h = 128;

  const buildTexture = (
    drawOverlay: (ctx: CanvasRenderingContext2D) => void,
  ): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      paintBaseCrystalCanvas(ctx, w, h);
      drawOverlay(ctx);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  };

  // HP 3: Pristine crystal highlights + crisp diamond glints
  const hp3 = buildTexture((ctx) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    const glints: readonly [number, number, number][] = [
      [112, 34, 7],
      [256, 78, 5],
      [402, 40, 6],
    ];
    for (const [gx, gy, r] of glints) {
      ctx.beginPath();
      ctx.moveTo(gx, gy - r);
      ctx.lineTo(gx + r, gy);
      ctx.lineTo(gx, gy + r);
      ctx.lineTo(gx - r, gy);
      ctx.closePath();
      ctx.fill();
    }
  });

  // HP 2: Corner spiderweb cracks
  const hp2 = buildTexture((ctx) => {
    const cornerCrackA: readonly (readonly [number, number][])[] = [
      [
        [14, 14],
        [52, 34],
        [98, 48],
        [144, 76],
      ],
      [
        [52, 34],
        [44, 74],
        [68, 108],
      ],
      [
        [52, 34],
        [88, 18],
        [136, 12],
      ],
      [
        [98, 48],
        [124, 30],
      ],
      [
        [98, 48],
        [104, 88],
      ],
    ];
    const cornerCrackB: readonly (readonly [number, number][])[] = [
      [
        [498, 112],
        [456, 86],
        [406, 72],
        [364, 42],
      ],
      [
        [456, 86],
        [472, 46],
        [448, 14],
      ],
      [
        [406, 72],
        [384, 104],
      ],
    ];

    for (const seg of [...cornerCrackA, ...cornerCrackB]) {
      drawPolyline(ctx, seg, 3.2, 'rgba(186, 230, 253, 0.65)');
      drawPolyline(ctx, seg, 1.5, 'rgba(255, 255, 255, 0.96)');
    }
  });

  // HP 1: Heavy full-pane shatter lines
  const hp1 = buildTexture((ctx) => {
    ctx.fillStyle = 'rgba(254, 226, 226, 0.14)';
    ctx.fillRect(0, 0, w, h);

    const heavyCracks: readonly (readonly [number, number][])[] = [
      [
        [8, 22],
        [72, 54],
        [154, 40],
        [254, 68],
        [342, 44],
        [434, 82],
        [504, 58],
      ],
      [
        [12, 108],
        [96, 82],
        [182, 98],
        [254, 68],
        [328, 96],
        [422, 42],
        [496, 18],
      ],
      [
        [72, 54],
        [56, 14],
      ],
      [
        [72, 54],
        [96, 82],
      ],
      [
        [154, 40],
        [186, 12],
      ],
      [
        [154, 40],
        [182, 98],
      ],
      [
        [254, 68],
        [236, 16],
      ],
      [
        [254, 68],
        [272, 118],
      ],
      [
        [342, 44],
        [328, 96],
      ],
      [
        [342, 44],
        [374, 10],
      ],
      [
        [434, 82],
        [422, 42],
      ],
      [
        [434, 82],
        [468, 120],
      ],
    ];

    for (const seg of heavyCracks) {
      drawPolyline(ctx, seg, 4.4, 'rgba(244, 63, 94, 0.35)');
      drawPolyline(ctx, seg, 2.8, 'rgba(224, 242, 254, 0.85)');
      drawPolyline(ctx, seg, 1.4, 'rgba(255, 255, 255, 1.0)');
    }
  });

  return { hp3, hp2, hp1 };
}

function createInitialShardArray(): ShardParticle[] {
  const list: ShardParticle[] = [];
  for (let i = 0; i < SHARD_COUNT; i += 1) {
    list.push({
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      vrx: 0,
      vry: 0,
      vrz: 0,
      sx: 0.14,
      sy: 0.14,
      sz: 0.05,
    });
  }
  return list;
}

export function GlassPaneMesh({ renderRef }: GlassPaneMeshProps) {
  const paneGroupRef = useRef<THREE.Group | null>(null);
  const paneMeshRef = useRef<THREE.Mesh | null>(null);
  const topRailRef = useRef<THREE.Mesh | null>(null);
  const bottomRailRef = useRef<THREE.Mesh | null>(null);
  const leftRailRef = useRef<THREE.Mesh | null>(null);
  const rightRailRef = useRef<THREE.Mesh | null>(null);
  const leftHandleRef = useRef<THREE.Group | null>(null);
  const rightHandleRef = useRef<THREE.Group | null>(null);

  const paneMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const topFrameMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const bottomFrameMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const shardsMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const shardParticlesRef = useRef<ShardParticle[]>(createInitialShardArray());
  const shardDummyRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const lastBurstIdRef = useRef<number>(0);
  const burstActiveRef = useRef<boolean>(false);
  const burstAgeRef = useRef<number>(0);

  const lastHpRef = useRef<number>(3);
  const frameColorScratchRef = useRef<THREE.Color>(new THREE.Color('#67e8f9'));

  const textures = useMemo(() => createGlassTextures(), []);

  useEffect(() => {
    return () => {
      textures.hp3.dispose();
      textures.hp2.dispose();
      textures.hp1.dispose();
    };
  }, [textures]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const state = renderRef.current;
    const glass = state.glass;
    const t = clock.elapsedTime;

    const shattered = glass.shatterTimer > 0;
    const paneLength = Math.max(0.4, glass.length);
    const halfLen = paneLength * 0.5;

    if (paneGroupRef.current) {
      paneGroupRef.current.visible = !shattered;
      if (!shattered) {
        const jitterAmp =
          glass.stress > 0.6 ? (glass.stress - 0.6) * 0.07 : 0;
        const jx = jitterAmp > 0 ? Math.sin(t * 74) * jitterAmp : 0;
        const jy = jitterAmp > 0 ? Math.cos(t * 89) * jitterAmp * 0.7 : 0;
        const jz = jitterAmp > 0 ? Math.sin(t * 63) * jitterAmp : 0;

        paneGroupRef.current.position.set(
          glass.centerX + jx,
          glass.centerY + jy,
          glass.centerZ + jz,
        );
        paneGroupRef.current.rotation.set(0, glass.yaw, glass.pitch);
      }
    }

    if (!shattered) {
      if (paneMeshRef.current) {
        paneMeshRef.current.scale.set(paneLength, 1, 1);
      }
      if (topRailRef.current) {
        topRailRef.current.scale.set(paneLength + 0.08, 1, 1);
      }
      if (bottomRailRef.current) {
        bottomRailRef.current.scale.set(paneLength + 0.08, 1, 1);
      }
      if (leftRailRef.current) {
        leftRailRef.current.position.x = -halfLen - 0.025;
      }
      if (rightRailRef.current) {
        rightRailRef.current.position.x = halfLen + 0.025;
      }
      if (leftHandleRef.current) {
        leftHandleRef.current.position.x = -halfLen - 0.09;
      }
      if (rightHandleRef.current) {
        rightHandleRef.current.position.x = halfLen + 0.09;
      }

      if (paneMatRef.current) {
        if (glass.hp !== lastHpRef.current) {
          lastHpRef.current = glass.hp;
          const nextMap =
            glass.hp >= 3
              ? textures.hp3
              : glass.hp === 2
                ? textures.hp2
                : textures.hp1;
          if (paneMatRef.current.map !== nextMap) {
            paneMatRef.current.map = nextMap;
            paneMatRef.current.needsUpdate = true;
          }
        }

        const baseOpacity = glass.hp < 3 ? 0.62 : 0.5;
        paneMatRef.current.opacity =
          glass.invulnTimer > 0
            ? baseOpacity * (0.65 + 0.35 * Math.sin(t * 26))
            : baseOpacity;
      }

      if (topFrameMatRef.current || bottomFrameMatRef.current) {
        const c = frameColorScratchRef.current;
        const s = THREE.MathUtils.clamp(glass.stress, 0, 1);
        let emissiveIntensity = 0.25;

        if (s <= 0.45) {
          c.copy(SAFE_COLOR);
          emissiveIntensity = 0.25;
        } else if (s <= 0.72) {
          const alpha = (s - 0.45) / (0.72 - 0.45);
          c.copy(SAFE_COLOR).lerp(WARN_COLOR, alpha);
          emissiveIntensity = 0.35 + alpha * 0.35;
        } else {
          const alpha = (s - 0.72) / 0.28;
          const pulse = (Math.sin(t * 20) + 1) * 0.5;
          c.copy(WARN_COLOR)
            .lerp(DANGER_COLOR, alpha)
            .lerp(PULSE_BRIGHT, pulse * 0.35);
          emissiveIntensity = 0.65 + pulse * 0.75;
        }

        if (topFrameMatRef.current) {
          topFrameMatRef.current.color.copy(c);
          topFrameMatRef.current.emissive.copy(c);
          topFrameMatRef.current.emissiveIntensity = emissiveIntensity;
        }
        if (bottomFrameMatRef.current) {
          bottomFrameMatRef.current.color.copy(c);
          bottomFrameMatRef.current.emissive.copy(c);
          bottomFrameMatRef.current.emissiveIntensity = emissiveIntensity;
        }
      }
    }

    // Reset burst state cleanly on match restart
    if (state.shatterBurstId === 0) {
      if (lastBurstIdRef.current !== 0) {
        lastBurstIdRef.current = 0;
      }
      burstActiveRef.current = false;
      burstAgeRef.current = 0;
      if (shardsMeshRef.current) {
        shardsMeshRef.current.visible = false;
      }
      return;
    }

    // Trigger 28-shard burst on new shatter event
    if (state.shatterBurstId !== lastBurstIdRef.current) {
      lastBurstIdRef.current = state.shatterBurstId;
      burstActiveRef.current = true;
      burstAgeRef.current = 0;

      const [ox, oy, oz] = state.shatterOrigin;
      const cosY = Math.cos(glass.yaw);
      const sinY = Math.sin(glass.yaw);
      const shards = shardParticlesRef.current;

      for (let i = 0; i < SHARD_COUNT; i += 1) {
        const p = shards[i];
        const spanOffset = ((i / (SHARD_COUNT - 1)) - 0.5) * paneLength * 0.85;
        const spreadX = cosY * spanOffset + (Math.random() - 0.5) * 0.35;
        const spreadZ = -sinY * spanOffset + (Math.random() - 0.5) * 0.35;
        const angle = (i / SHARD_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const speed = 2.0 + Math.random() * 4.2;

        p.x = ox + spreadX * 0.45;
        p.y = oy + (Math.random() - 0.5) * GLASS_HEIGHT * 0.8;
        p.z = oz + spreadZ * 0.45;

        p.vx = Math.cos(angle) * speed + spreadX * 0.8;
        p.vy = 2.0 + Math.random() * 4.4;
        p.vz = Math.sin(angle) * speed + spreadZ * 0.8;

        p.rx = Math.random() * Math.PI;
        p.ry = Math.random() * Math.PI;
        p.rz = Math.random() * Math.PI;
        p.vrx = (Math.random() - 0.5) * 14;
        p.vry = (Math.random() - 0.5) * 14;
        p.vrz = (Math.random() - 0.5) * 14;

        p.sx = 0.08 + Math.random() * 0.14;
        p.sy = 0.09 + Math.random() * 0.16;
        p.sz = 0.03 + Math.random() * 0.05;
      }
    }

    if (shardsMeshRef.current) {
      if (!burstActiveRef.current) {
        shardsMeshRef.current.visible = false;
      } else {
        burstAgeRef.current += dt;
        const progress = burstAgeRef.current / SHATTER_RESPAWN_SEC;
        if (progress >= 1) {
          burstActiveRef.current = false;
          shardsMeshRef.current.visible = false;
        } else {
          shardsMeshRef.current.visible = true;
          const fadeScale =
            progress > 0.7 ? Math.max(0, 1 - (progress - 0.7) / 0.3) : 1;
          const shards = shardParticlesRef.current;
          const dummy = shardDummyRef.current;

          for (let i = 0; i < SHARD_COUNT; i += 1) {
            const p = shards[i];
            p.vy -= 14 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.rx += p.vrx * dt;
            p.ry += p.vry * dt;
            p.rz += p.vrz * dt;

            dummy.position.set(p.x, p.y, p.z);
            dummy.rotation.set(p.rx, p.ry, p.rz);
            dummy.scale.set(
              p.sx * fadeScale,
              p.sy * fadeScale,
              p.sz * fadeScale,
            );
            dummy.updateMatrix();
            shardsMeshRef.current.setMatrixAt(i, dummy.matrix);
          }

          shardsMeshRef.current.instanceMatrix.needsUpdate = true;
        }
      }
    }
  });

  const railThickness = 0.05;
  const railDepth = GLASS_THICKNESS + 0.03;

  return (
    <>
      <group ref={paneGroupRef}>
        {/* Crystal glass pane */}
        <mesh ref={paneMeshRef} castShadow receiveShadow>
          <boxGeometry args={[1, GLASS_HEIGHT, GLASS_THICKNESS]} />
          <meshPhysicalMaterial
            ref={paneMatRef}
            map={textures.hp3}
            color="#e0f7ff"
            transparent
            opacity={0.5}
            roughness={0.08}
            metalness={0.05}
            clearcoat={1}
            clearcoatRoughness={0.06}
            reflectivity={0.9}
            depthWrite={false}
          />
        </mesh>

        {/* Top & bottom frame rails */}
        <mesh
          ref={topRailRef}
          position={[0, GLASS_HALF_HEIGHT + railThickness * 0.5, 0]}
          castShadow
        >
          <boxGeometry args={[1, railThickness, railDepth]} />
          <meshStandardMaterial
            ref={topFrameMatRef}
            color="#67e8f9"
            emissive="#67e8f9"
            emissiveIntensity={0.25}
            roughness={0.25}
            metalness={0.55}
          />
        </mesh>

        <mesh
          ref={bottomRailRef}
          position={[0, -GLASS_HALF_HEIGHT - railThickness * 0.5, 0]}
          castShadow
        >
          <boxGeometry args={[1, railThickness, railDepth]} />
          <meshStandardMaterial
            ref={bottomFrameMatRef}
            color="#67e8f9"
            emissive="#67e8f9"
            emissiveIntensity={0.25}
            roughness={0.25}
            metalness={0.55}
          />
        </mesh>

        {/* Left & right vertical frame rails */}
        <mesh ref={leftRailRef} position={[-1.725, 0, 0]} castShadow>
          <boxGeometry
            args={[railThickness, GLASS_HEIGHT + railThickness * 2, railDepth]}
          />
          <meshStandardMaterial
            color="#475569"
            roughness={0.35}
            metalness={0.65}
          />
        </mesh>

        <mesh ref={rightRailRef} position={[1.725, 0, 0]} castShadow>
          <boxGeometry
            args={[railThickness, GLASS_HEIGHT + railThickness * 2, railDepth]}
          />
          <meshStandardMaterial
            color="#475569"
            roughness={0.35}
            metalness={0.65}
          />
        </mesh>

        {/* Rubber end-grip handles */}
        <group ref={leftHandleRef} position={[-1.79, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.045, 0.045, 0.34, 12]} />
            <meshStandardMaterial color="#1e293b" roughness={0.85} />
          </mesh>
          <mesh position={[0.03, 0.11, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.08, 10]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.4} />
          </mesh>
          <mesh position={[0.03, -0.11, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.08, 10]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.4} />
          </mesh>
        </group>

        <group ref={rightHandleRef} position={[1.79, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.045, 0.045, 0.34, 12]} />
            <meshStandardMaterial color="#1e293b" roughness={0.85} />
          </mesh>
          <mesh position={[-0.03, 0.11, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.08, 10]} />
            <meshStandardMaterial color="#2dd4bf" roughness={0.4} />
          </mesh>
          <mesh position={[-0.03, -0.11, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.08, 10]} />
            <meshStandardMaterial color="#2dd4bf" roughness={0.4} />
          </mesh>
        </group>
      </group>

      {/* 28-shard instanced glass shatter burst */}
      <instancedMesh
        ref={shardsMeshRef}
        args={[undefined, undefined, SHARD_COUNT]}
        visible={false}
        frustumCulled={false}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial
          color="#cffafe"
          emissive="#38bdf8"
          emissiveIntensity={0.35}
          transparent
          opacity={0.85}
          roughness={0.08}
          metalness={0.1}
          clearcoat={1}
        />
      </instancedMesh>
    </>
  );
}
