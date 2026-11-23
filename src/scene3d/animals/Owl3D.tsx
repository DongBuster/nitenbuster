import { useRef } from 'react';
import type * as THREE from 'three';
import {
  Face3D,
  TurnRing3D,
  useAnimalMotion,
  type Animal3DProps,
} from '../CharacterRig3D';

export function Owl3D({ emotion = 'idle', isActive = false }: Animal3DProps) {
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
      <TurnRing3D active={isActive} color="#9B89B3" />

      {/* Cute little golden owl talons/feet resting at y = 0 */}
      <group position={[-0.17, 0.055, 0.08]}>
        <mesh scale={[1.05, 0.48, 1.35]} castShadow receiveShadow>
          <sphereGeometry args={[0.115, 16, 14]} />
          <meshStandardMaterial color="#F59E0B" roughness={0.55} metalness={0.06} />
        </mesh>
      </group>
      <group position={[0.17, 0.055, 0.08]}>
        <mesh scale={[1.05, 0.48, 1.35]} castShadow receiveShadow>
          <sphereGeometry args={[0.115, 16, 14]} />
          <meshStandardMaterial color="#F59E0B" roughness={0.55} metalness={0.06} />
        </mesh>
      </group>

      {/* Body group */}
      <group ref={body} position={[0, 0.45, 0]}>
        {/* Plump lavender-purple owl torso */}
        <mesh scale={[1.0, 1.04, 0.96]} castShadow receiveShadow>
          <sphereGeometry args={[0.39, 28, 24]} />
          <meshStandardMaterial color="#9B89B3" roughness={0.62} metalness={0.04} />
        </mesh>

        {/* Cream belly oval */}
        <mesh
          position={[0, -0.02, 0.29]}
          scale={[0.92, 0.98, 0.46]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.26, 24, 20]} />
          <meshStandardMaterial color="#F3EFF8" roughness={0.64} metalness={0.03} />
        </mesh>

        {/* Subtle 3D feather scallop accents on cream belly */}
        <mesh position={[-0.1, 0.05, 0.41]} scale={[1.2, 0.55, 0.4]} castShadow>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshStandardMaterial color="#B7A7CC" roughness={0.65} metalness={0.02} />
        </mesh>
        <mesh position={[0.1, 0.05, 0.41]} scale={[1.2, 0.55, 0.4]} castShadow>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshStandardMaterial color="#B7A7CC" roughness={0.65} metalness={0.02} />
        </mesh>
        <mesh position={[0, -0.07, 0.41]} scale={[1.2, 0.55, 0.4]} castShadow>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshStandardMaterial color="#B7A7CC" roughness={0.65} metalness={0.02} />
        </mesh>

        {/* Left flapping plum-lavender wing */}
        <group ref={armLeft} position={[-0.36, 0.07, 0.02]} rotation={[0, 0, 0.36]}>
          <mesh
            position={[-0.08, -0.09, 0]}
            scale={[0.68, 1.32, 0.95]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.16, 20, 16]} />
            <meshStandardMaterial color="#75628E" roughness={0.62} metalness={0.04} />
          </mesh>
        </group>

        {/* Right flapping plum-lavender wing */}
        <group ref={armRight} position={[0.36, 0.07, 0.02]} rotation={[0, 0, -0.36]}>
          <mesh
            position={[0.08, -0.09, 0]}
            scale={[0.68, 1.32, 0.95]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.16, 20, 16]} />
            <meshStandardMaterial color="#75628E" roughness={0.62} metalness={0.04} />
          </mesh>
        </group>

        {/* Neat layered plum-lavender tail feathers */}
        <group ref={tail} position={[0, -0.1, -0.34]}>
          <mesh
            position={[0, 0.02, -0.09]}
            rotation={[-0.9, 0, 0]}
            scale={[1.2, 1.0, 0.45]}
            castShadow
            receiveShadow
          >
            <coneGeometry args={[0.14, 0.28, 16]} />
            <meshStandardMaterial color="#75628E" roughness={0.62} metalness={0.04} />
          </mesh>
        </group>
      </group>

      {/* Head group */}
      <group ref={head} position={[0, 1.06, 0]}>
        {/* Main round soft lavender-purple head */}
        <mesh scale={[1.05, 0.95, 0.97]} castShadow receiveShadow>
          <sphereGeometry args={[0.54, 32, 28]} />
          <meshStandardMaterial color="#9B89B3" roughness={0.62} metalness={0.04} />
        </mesh>

        {/* Classic twin cream facial disc pads framing the eyes */}
        <mesh
          position={[-0.19, 0.02, 0.41]}
          rotation={[0, -0.22, 0]}
          scale={[1.0, 1.05, 0.42]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.23, 24, 20]} />
          <meshStandardMaterial color="#F3EFF8" roughness={0.64} metalness={0.02} />
        </mesh>
        <mesh
          position={[0.19, 0.02, 0.41]}
          rotation={[0, 0.22, 0]}
          scale={[1.0, 1.05, 0.42]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.23, 24, 20]} />
          <meshStandardMaterial color="#F3EFF8" roughness={0.64} metalness={0.02} />
        </mesh>

        {/* Pointed feathery left ear tuft */}
        <group ref={earLeft} position={[-0.36, 0.42, 0]} rotation={[0.06, 0, 0.48]}>
          <mesh position={[0, 0.14, 0]} scale={[0.9, 1.0, 0.65]} castShadow receiveShadow>
            <coneGeometry args={[0.16, 0.36, 18]} />
            <meshStandardMaterial color="#75628E" roughness={0.62} metalness={0.04} />
          </mesh>
        </group>

        {/* Pointed feathery right ear tuft */}
        <group ref={earRight} position={[0.36, 0.42, 0]} rotation={[0.06, 0, -0.48]}>
          <mesh position={[0, 0.14, 0]} scale={[0.9, 1.0, 0.65]} castShadow receiveShadow>
            <coneGeometry args={[0.16, 0.36, 18]} />
            <meshStandardMaterial color="#75628E" roughness={0.62} metalness={0.04} />
          </mesh>
        </group>

        <Face3D
          emotion={emotion}
          y={0.02}
          z={0.52}
          eyeSpread={0.22}
          isBird={true}
          beakColor="#F59E0B"
        />
      </group>
    </group>
  );
}
