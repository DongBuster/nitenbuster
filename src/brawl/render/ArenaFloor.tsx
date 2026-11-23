import { useMemo, useRef, useState } from 'react';
import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { HEX_HEIGHT, HEX_RADIUS } from '../sim/constants';
import type { HexTileSpec } from '../sim/types';
import type { BrawlWorldRuntime } from './worldRuntime';

const RING_BASE_COLORS = ['#8D5B3E', '#7A4E36', '#694430', '#5A3A2A', '#4B3124'];

function HexTile({
  tile,
  runtime,
}: {
  tile: HexTileSpec;
  runtime: BrawlWorldRuntime;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const visualGroupRef = useRef<THREE.Group | null>(null);
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const baseColor = RING_BASE_COLORS[tile.ring] ?? '#5A3A2A';
  const baseColorObj = useMemo(() => new THREE.Color(baseColor), [baseColor]);
  const warnColorObj = useMemo(() => new THREE.Color('#EF4444'), []);

  useFrame(({ clock }) => {
    const elapsed = runtime.roundElapsedSec;
    if (!collapsed && elapsed >= tile.collapseAtSec) {
      setCollapsed(true);
      return;
    }

    const isWarning = !collapsed && elapsed >= tile.warnAtSec;
    if (visualGroupRef.current) {
      if (isWarning) {
        const shake = Math.sin(clock.elapsedTime * 36 + tile.q * 3) * 0.055;
        visualGroupRef.current.position.set(shake, -Math.abs(shake) * 0.4, -shake);
      } else {
        visualGroupRef.current.position.set(0, 0, 0);
      }
    }

    if (matRef.current) {
      if (isWarning) {
        const pulse = (Math.sin(clock.elapsedTime * 14) + 1) * 0.5;
        matRef.current.color.copy(baseColorObj).lerp(warnColorObj, 0.45 + pulse * 0.4);
        matRef.current.emissive.set('#DC2626');
        matRef.current.emissiveIntensity = 0.25 + pulse * 0.4;
      } else if (collapsed) {
        matRef.current.color.copy(baseColorObj).multiplyScalar(0.65);
        matRef.current.emissive.set('#000000');
        matRef.current.emissiveIntensity = 0;
      } else {
        matRef.current.color.copy(baseColorObj);
        matRef.current.emissive.set('#000000');
        matRef.current.emissiveIntensity = 0;
      }
    }
  });

  return (
    <RigidBody
      key={`${tile.id}_${collapsed ? 'dyn' : 'fix'}`}
      type={collapsed ? 'dynamic' : 'fixed'}
      position={[tile.x, -HEX_HEIGHT / 2 - (collapsed ? 0.05 : 0), tile.z]}
      colliders={false}
      friction={0.6}
      restitution={0.1}
      linearDamping={0.2}
      angularVelocity={collapsed ? [0.45, 0.2, -0.35] : [0, 0, 0]}
    >
      <CylinderCollider args={[HEX_HEIGHT / 2, HEX_RADIUS * 0.92]} />
      <group ref={visualGroupRef}>
        <mesh receiveShadow castShadow>
          <cylinderGeometry args={[HEX_RADIUS * 0.96, HEX_RADIUS * 0.92, HEX_HEIGHT, 6]} />
          <meshStandardMaterial
            ref={matRef}
            color={baseColor}
            roughness={0.82}
            metalness={0.05}
          />
        </mesh>
        {/* Frosty snow rim around tile top */}
        <mesh position={[0, HEX_HEIGHT / 2 - 0.03, 0]} receiveShadow>
          <cylinderGeometry args={[HEX_RADIUS * 0.91, HEX_RADIUS * 0.94, 0.08, 6]} />
          <meshStandardMaterial color="#E6F2FA" roughness={0.65} />
        </mesh>
      </group>
    </RigidBody>
  );
}

const OBSTACLE_POSITIONS: [number, number, number][] = [
  [3.6, 0.7, 1.8],
  [-3.8, 0.7, 1.4],
  [0.2, 0.7, -4.1],
];

export function ArenaFloor({
  tiles,
  runtime,
}: {
  tiles: HexTileSpec[];
  runtime: BrawlWorldRuntime;
}) {
  return (
    <group>
      {/* Collapsing Winter Cabin Hex Tiles */}
      {tiles.map((tile) => (
        <HexTile key={tile.id} tile={tile} runtime={runtime} />
      ))}

      {/* Pushable wooden Winter Cabin crates */}
      {OBSTACLE_POSITIONS.map((pos, idx) => (
        <RigidBody
          key={`crate_${idx}`}
          type="dynamic"
          position={pos}
          colliders="cuboid"
          mass={0.9}
          friction={0.55}
          restitution={0.2}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.92, 0.92, 0.92]} />
            <meshStandardMaterial color="#9A6136" roughness={0.78} />
          </mesh>
          <mesh position={[0, 0.48, 0]}>
            <boxGeometry args={[0.94, 0.08, 0.94]} />
            <meshStandardMaterial color="#F1F5F9" roughness={0.6} />
          </mesh>
        </RigidBody>
      ))}

      {/* Atmospheric icy abyss & snowy cabin backdrop */}
      <mesh position={[0, -8.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[52, 48]} />
        <meshBasicMaterial color="#0F1F36" />
      </mesh>
      <mesh position={[0, -8.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[12, 34, 48]} />
        <meshBasicMaterial color="#1E3A5F" transparent opacity={0.35} />
      </mesh>

      {/* Stylized snowy pine trees framing background outside the arena */}
      {[-15, -10, -4, 4, 10, 15].map((xPos, idx) => {
        const zPos = -17 - (idx % 2) * 3;
        return (
          <group key={`pine_${idx}`} position={[xPos, -1.5, zPos]}>
            <mesh position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.25, 0.35, 2.4, 8]} />
              <meshStandardMaterial color="#4A2E1B" roughness={0.9} />
            </mesh>
            <mesh position={[0, 3.2, 0]}>
              <coneGeometry args={[1.6, 3.2, 7]} />
              <meshStandardMaterial color="#1E4D3B" roughness={0.85} />
            </mesh>
            <mesh position={[0, 4.7, 0]}>
              <coneGeometry args={[1.1, 2.2, 7]} />
              <meshStandardMaterial color="#E2E8F0" roughness={0.75} />
            </mesh>
          </group>
        );
      })}

      {/* Gentle cabin snow particles */}
      <Sparkles
        count={65}
        scale={[28, 12, 28]}
        position={[0, 5, 0]}
        size={2.6}
        speed={0.45}
        color="#E0F2FE"
        opacity={0.75}
      />
    </group>
  );
}
