import { useRef } from 'react';
import type * as THREE from 'three';
import {
  Face3D,
  TurnRing3D,
  useAnimalMotion,
  type Animal3DProps,
} from '../CharacterRig3D';

export function Bear3D({ emotion = 'idle', isActive = false }: Animal3DProps) {
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
    isActive
  );

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} />

      {/* Cozy chubby teddy bear body */}
      <group ref={body} position={[0, 0.45, 0]}>
        {/* Main plush torso */}
        <mesh castShadow receiveShadow scale={[0.46, 0.45, 0.41]}>
          <sphereGeometry args={[1, 28, 24]} />
          <meshStandardMaterial color="#B07D62" roughness={0.62} metalness={0.04} />
        </mesh>

        {/* Warm tan belly patch */}
        <mesh position={[0, -0.04, 0.28]} scale={[0.3, 0.31, 0.17]} castShadow receiveShadow>
          <sphereGeometry args={[1, 24, 20]} />
          <meshStandardMaterial color="#E6CCB2" roughness={0.62} metalness={0.04} />
        </mesh>

        {/* Left chubby foot resting at y=0 */}
        <group position={[-0.2, -0.35, 0.08]}>
          <mesh scale={[0.145, 0.1, 0.18]} castShadow receiveShadow>
            <sphereGeometry args={[1, 20, 16]} />
            <meshStandardMaterial color="#B07D62" roughness={0.62} metalness={0.04} />
          </mesh>
          <mesh position={[0, -0.01, 0.14]} scale={[0.09, 0.07, 0.05]}>
            <sphereGeometry args={[1, 14, 12]} />
            <meshStandardMaterial color="#E6CCB2" roughness={0.62} metalness={0.04} />
          </mesh>
        </group>

        {/* Right chubby foot resting at y=0 */}
        <group position={[0.2, -0.35, 0.08]}>
          <mesh scale={[0.145, 0.1, 0.18]} castShadow receiveShadow>
            <sphereGeometry args={[1, 20, 16]} />
            <meshStandardMaterial color="#B07D62" roughness={0.62} metalness={0.04} />
          </mesh>
          <mesh position={[0, -0.01, 0.14]} scale={[0.09, 0.07, 0.05]}>
            <sphereGeometry args={[1, 14, 12]} />
            <meshStandardMaterial color="#E6CCB2" roughness={0.62} metalness={0.04} />
          </mesh>
        </group>

        {/* Left chubby articulated arm */}
        <group ref={armLeft} position={[-0.41, 0.08, 0.06]}>
          <mesh position={[-0.04, -0.1, 0.04]} rotation={[0.2, 0, 0.34]} castShadow receiveShadow>
            <capsuleGeometry args={[0.11, 0.15, 10, 16]} />
            <meshStandardMaterial color="#B07D62" roughness={0.62} metalness={0.04} />
          </mesh>
          <mesh position={[-0.07, -0.19, 0.11]} scale={[0.065, 0.065, 0.04]}>
            <sphereGeometry args={[1, 14, 12]} />
            <meshStandardMaterial color="#E6CCB2" roughness={0.62} metalness={0.04} />
          </mesh>
        </group>

        {/* Right chubby articulated arm */}
        <group ref={armRight} position={[0.41, 0.08, 0.06]}>
          <mesh position={[0.04, -0.1, 0.04]} rotation={[0.2, 0, -0.34]} castShadow receiveShadow>
            <capsuleGeometry args={[0.11, 0.15, 10, 16]} />
            <meshStandardMaterial color="#B07D62" roughness={0.62} metalness={0.04} />
          </mesh>
          <mesh position={[0.07, -0.19, 0.11]} scale={[0.065, 0.065, 0.04]}>
            <sphereGeometry args={[1, 14, 12]} />
            <meshStandardMaterial color="#E6CCB2" roughness={0.62} metalness={0.04} />
          </mesh>
        </group>

        {/* Cute round pom-pom bear tail */}
        <group ref={tail} position={[0, -0.16, -0.39]}>
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.115, 18, 16]} />
            <meshStandardMaterial color="#B07D62" roughness={0.62} metalness={0.04} />
          </mesh>
        </group>

        {/* Plump cozy teddy bear head */}
        <group ref={head} position={[0, 0.6, 0]}>
          {/* Main head sphere */}
          <mesh castShadow receiveShadow scale={[1.1, 0.96, 0.98]}>
            <sphereGeometry args={[0.56, 32, 28]} />
            <meshStandardMaterial color="#B07D62" roughness={0.62} metalness={0.04} />
          </mesh>

          {/* Warm tan teddy snout mound */}
          <mesh position={[0, -0.09, 0.4]} scale={[0.25, 0.18, 0.12]} castShadow receiveShadow>
            <sphereGeometry args={[1, 22, 18]} />
            <meshStandardMaterial color="#E6CCB2" roughness={0.62} metalness={0.04} />
          </mesh>

          {/* Round teddy left ear */}
          <group ref={earLeft} position={[-0.38, 0.42, 0.0]}>
            <mesh scale={[1, 1, 0.56]} castShadow receiveShadow>
              <sphereGeometry args={[0.2, 22, 18]} />
              <meshStandardMaterial color="#B07D62" roughness={0.62} metalness={0.04} />
            </mesh>
            <mesh position={[0.01, -0.01, 0.075]} scale={[0.62, 0.62, 0.36]}>
              <sphereGeometry args={[0.19, 18, 14]} />
              <meshStandardMaterial color="#E6CCB2" roughness={0.62} metalness={0.04} />
            </mesh>
          </group>

          {/* Round teddy right ear */}
          <group ref={earRight} position={[0.38, 0.42, 0.0]}>
            <mesh scale={[1, 1, 0.56]} castShadow receiveShadow>
              <sphereGeometry args={[0.2, 22, 18]} />
              <meshStandardMaterial color="#B07D62" roughness={0.62} metalness={0.04} />
            </mesh>
            <mesh position={[-0.01, -0.01, 0.075]} scale={[0.62, 0.62, 0.36]}>
              <sphereGeometry args={[0.19, 18, 14]} />
              <meshStandardMaterial color="#E6CCB2" roughness={0.62} metalness={0.04} />
            </mesh>
          </group>

          {/* Expressive 3D face on +Z */}
          <Face3D
            emotion={emotion}
            y={-0.01}
            z={0.55}
            eyeSpread={0.23}
            snoutColor="#E6CCB2"
          />
        </group>
      </group>
    </group>
  );
}
