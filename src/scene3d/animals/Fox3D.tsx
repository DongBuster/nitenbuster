import { useRef } from 'react';
import type * as THREE from 'three';
import {
  Face3D,
  TurnRing3D,
  useAnimalMotion,
  type Animal3DProps,
} from '../CharacterRig3D';

export function Fox3D({ emotion = 'idle', isActive = false }: Animal3DProps) {
  const root = useRef<THREE.Group | null>(null);
  const body = useRef<THREE.Group | null>(null);
  const head = useRef<THREE.Group | null>(null);
  const earLeft = useRef<THREE.Group | null>(null);
  const earRight = useRef<THREE.Group | null>(null);
  const armLeft = useRef<THREE.Group | null>(null);
  const armRight = useRef<THREE.Group | null>(null);
  const tail = useRef<THREE.Group | null>(null);

  useAnimalMotion(
    { root, body, head, earLeft, earRight, armLeft, armRight, tail },
    emotion,
    isActive,
  );

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} color="#F27D52" />

      {/* Stubby dark-brown feet resting at y = 0 */}
      <mesh
        position={[-0.18, 0.09, 0.06]}
        scale={[1.05, 0.72, 1.3]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.125, 20, 16]} />
        <meshStandardMaterial color="#4A3525" roughness={0.62} metalness={0.04} />
      </mesh>
      <mesh
        position={[0.18, 0.09, 0.06]}
        scale={[1.05, 0.72, 1.3]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.125, 20, 16]} />
        <meshStandardMaterial color="#4A3525" roughness={0.62} metalness={0.04} />
      </mesh>

      {/* Body group */}
      <group ref={body} position={[0, 0.45, 0]}>
        {/* Plump coral-orange torso */}
        <mesh scale={[0.96, 1.06, 0.92]} castShadow receiveShadow>
          <sphereGeometry args={[0.37, 28, 24]} />
          <meshStandardMaterial color="#F27D52" roughness={0.62} metalness={0.04} />
        </mesh>

        {/* Fluffy cream chest ruff */}
        <mesh
          position={[0, 0.04, 0.28]}
          scale={[0.85, 0.95, 0.52]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.24, 24, 20]} />
          <meshStandardMaterial color="#FFF5E4" roughness={0.62} metalness={0.04} />
        </mesh>

        {/* Left stubby arm with dark paw tip */}
        <group ref={armLeft} position={[-0.34, 0.08, 0.05]} rotation={[0, 0, 0.35]}>
          <mesh position={[-0.06, -0.09, 0]} castShadow receiveShadow>
            <capsuleGeometry args={[0.095, 0.14, 10, 16]} />
            <meshStandardMaterial color="#F27D52" roughness={0.62} metalness={0.04} />
          </mesh>
          <mesh position={[-0.08, -0.19, 0.02]} castShadow receiveShadow>
            <sphereGeometry args={[0.095, 16, 14]} />
            <meshStandardMaterial color="#4A3525" roughness={0.62} metalness={0.04} />
          </mesh>
        </group>

        {/* Right stubby arm with dark paw tip */}
        <group ref={armRight} position={[0.34, 0.08, 0.05]} rotation={[0, 0, -0.35]}>
          <mesh position={[0.06, -0.09, 0]} castShadow receiveShadow>
            <capsuleGeometry args={[0.095, 0.14, 10, 16]} />
            <meshStandardMaterial color="#F27D52" roughness={0.62} metalness={0.04} />
          </mesh>
          <mesh position={[0.08, -0.19, 0.02]} castShadow receiveShadow>
            <sphereGeometry args={[0.095, 16, 14]} />
            <meshStandardMaterial color="#4A3525" roughness={0.62} metalness={0.04} />
          </mesh>
        </group>

        {/* Big fluffy white-tipped fox tail */}
        <group ref={tail} position={[0, -0.1, -0.3]}>
          <mesh
            position={[0.06, 0.08, -0.18]}
            rotation={[0.65, 0.25, -0.2]}
            castShadow
            receiveShadow
          >
            <capsuleGeometry args={[0.14, 0.28, 12, 20]} />
            <meshStandardMaterial color="#F27D52" roughness={0.62} metalness={0.04} />
          </mesh>
          <mesh
            position={[0.16, 0.26, -0.34]}
            scale={[1.05, 1.15, 1.05]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.19, 22, 18]} />
            <meshStandardMaterial color="#F27D52" roughness={0.62} metalness={0.04} />
          </mesh>
          {/* Fluffy cream tail tip */}
          <mesh
            position={[0.24, 0.44, -0.42]}
            rotation={[0.4, 0.2, -0.45]}
            castShadow
            receiveShadow
          >
            <coneGeometry args={[0.17, 0.34, 20]} />
            <meshStandardMaterial color="#FFF5E4" roughness={0.62} metalness={0.04} />
          </mesh>
        </group>
      </group>

      {/* Head group */}
      <group ref={head} position={[0, 1.06, 0]}>
        {/* Main plump coral-orange head */}
        <mesh scale={[1.07, 0.94, 0.97]} castShadow receiveShadow>
          <sphereGeometry args={[0.54, 32, 28]} />
          <meshStandardMaterial color="#F27D52" roughness={0.62} metalness={0.04} />
        </mesh>

        {/* Cream lower cheek fur pads */}
        <mesh
          position={[-0.24, -0.17, 0.26]}
          scale={[1.15, 0.72, 0.85]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.28, 22, 18]} />
          <meshStandardMaterial color="#FFF5E4" roughness={0.62} metalness={0.04} />
        </mesh>
        <mesh
          position={[0.24, -0.17, 0.26]}
          scale={[1.15, 0.72, 0.85]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.28, 22, 18]} />
          <meshStandardMaterial color="#FFF5E4" roughness={0.62} metalness={0.04} />
        </mesh>
        <mesh
          position={[0, -0.22, 0.32]}
          scale={[1.15, 0.65, 0.75]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.25, 22, 18]} />
          <meshStandardMaterial color="#FFF5E4" roughness={0.62} metalness={0.04} />
        </mesh>

        {/* Fluffy cream side cheek tufts */}
        <mesh
          position={[-0.56, -0.1, 0.06]}
          rotation={[0, 0, 1.25]}
          castShadow
          receiveShadow
        >
          <coneGeometry args={[0.13, 0.24, 16]} />
          <meshStandardMaterial color="#FFF5E4" roughness={0.62} metalness={0.04} />
        </mesh>
        <mesh
          position={[0.56, -0.1, 0.06]}
          rotation={[0, 0, -1.25]}
          castShadow
          receiveShadow
        >
          <coneGeometry args={[0.13, 0.24, 16]} />
          <meshStandardMaterial color="#FFF5E4" roughness={0.62} metalness={0.04} />
        </mesh>

        {/* Cute forehead fur tuft */}
        <mesh
          position={[0, 0.51, 0.08]}
          rotation={[0.22, 0, -0.12]}
          castShadow
          receiveShadow
        >
          <coneGeometry args={[0.09, 0.2, 14]} />
          <meshStandardMaterial color="#F27D52" roughness={0.62} metalness={0.04} />
        </mesh>

        {/* Large pointed left fox ear with dark tip */}
        <group ref={earLeft} position={[-0.32, 0.42, 0]} rotation={[0.05, 0, 0.32]}>
          <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
            <coneGeometry args={[0.2, 0.44, 20]} />
            <meshStandardMaterial color="#F27D52" roughness={0.62} metalness={0.04} />
          </mesh>
          {/* Dark ear tip */}
          <mesh position={[0, 0.31, 0]} castShadow receiveShadow>
            <coneGeometry args={[0.098, 0.21, 20]} />
            <meshStandardMaterial color="#4A3525" roughness={0.62} metalness={0.04} />
          </mesh>
          {/* Soft peach inner ear */}
          <mesh position={[0, 0.12, 0.09]} scale={[0.62, 0.68, 0.35]}>
            <coneGeometry args={[0.17, 0.34, 16]} />
            <meshStandardMaterial color="#FFD1B8" roughness={0.68} metalness={0.02} />
          </mesh>
        </group>

        {/* Large pointed right fox ear with dark tip */}
        <group ref={earRight} position={[0.32, 0.42, 0]} rotation={[0.05, 0, -0.32]}>
          <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
            <coneGeometry args={[0.2, 0.44, 20]} />
            <meshStandardMaterial color="#F27D52" roughness={0.62} metalness={0.04} />
          </mesh>
          {/* Dark ear tip */}
          <mesh position={[0, 0.31, 0]} castShadow receiveShadow>
            <coneGeometry args={[0.098, 0.21, 20]} />
            <meshStandardMaterial color="#4A3525" roughness={0.62} metalness={0.04} />
          </mesh>
          {/* Soft peach inner ear */}
          <mesh position={[0, 0.12, 0.09]} scale={[0.62, 0.68, 0.35]}>
            <coneGeometry args={[0.17, 0.34, 16]} />
            <meshStandardMaterial color="#FFD1B8" roughness={0.68} metalness={0.02} />
          </mesh>
        </group>

        <Face3D
          emotion={emotion}
          y={0.02}
          z={0.51}
          eyeSpread={0.22}
          snoutColor="#FFF5E4"
        />
      </group>
    </group>
  );
}
