import { useRef } from 'react';
import type * as THREE from 'three';
import {
  TurnRing3D,
  useAnimalMotion,
  type Animal3DProps,
} from '../CharacterRig3D';
import { PlushMaterial, getPearBodyGeometry, getPlushArmGeometry } from '../plushMaterial';

function StarEye({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.068, 0.068, 0.026]} />
        <meshStandardMaterial
          color="#FACC15"
          emissive="#F59E0B"
          emissiveIntensity={0.5}
          roughness={0.2}
          metalness={0.35}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[0.068, 0.068, 0.026]} />
        <meshStandardMaterial
          color="#FACC15"
          emissive="#F59E0B"
          emissiveIntensity={0.5}
          roughness={0.2}
          metalness={0.35}
        />
      </mesh>
    </group>
  );
}

export function Duck3D({ emotion = 'idle', isActive = false }: Animal3DProps) {
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

  const billOpen = emotion === 'shock' || emotion === 'happy' || emotion === 'win';
  const pearGeo = getPearBodyGeometry(0.55, 1.02);
  const wingGeo = getPlushArmGeometry(0.42, 0.105, 0.15);

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} />

      {/* Ultra-plump seamless creamy-white pear duck */}
      <group ref={body} position={[0, 0.47, 0]}>
        {/* Continuous smooth pear silhouette flowing up into neck/head (NO neck pinch) */}
        <mesh geometry={pearGeo} position={[0, -0.39, 0]} castShadow receiveShadow>
          <PlushMaterial color="#FAF5EC" />
        </mesh>

        {/* Flat orange 3-toed webbed feet resting squarely at y=0 */}
        {[-1, 1].map((side) => (
          <group key={`foot-${side}`} position={[side * 0.18, -0.43, 0.07]}>
            <mesh scale={[0.15, 0.044, 0.19]} castShadow receiveShadow>
              <sphereGeometry args={[1, 20, 14]} />
              <meshStandardMaterial color="#F58B16" roughness={0.28} metalness={0.04} />
            </mesh>
            <mesh position={[-0.08, -0.005, 0.11]} rotation={[0, 0.35, 0]} scale={[0.048, 0.036, 0.1]} castShadow>
              <sphereGeometry args={[1, 12, 10]} />
              <meshStandardMaterial color="#F58B16" roughness={0.28} metalness={0.04} />
            </mesh>
            <mesh position={[0.08, -0.005, 0.11]} rotation={[0, -0.35, 0]} scale={[0.048, 0.036, 0.1]} castShadow>
              <sphereGeometry args={[1, 12, 10]} />
              <meshStandardMaterial color="#F58B16" roughness={0.28} metalness={0.04} />
            </mesh>
          </group>
        ))}

        {/* Chunky plush side wings clearly visible outside pear belly silhouette */}
        <group ref={armLeft} position={[-0.42, 0.18, 0.04]} rotation={[0.08, 0.12, -0.42]}>
          <mesh geometry={wingGeo} scale={[0.82, 1.0, 0.95]} castShadow receiveShadow>
            <PlushMaterial color="#FAF5EC" />
          </mesh>
        </group>

        <group ref={armRight} position={[0.42, 0.18, 0.04]} rotation={[0.08, -0.12, 0.42]}>
          <mesh geometry={wingGeo} scale={[0.82, 1.0, 0.95]} castShadow receiveShadow>
            <PlushMaterial color="#FAF5EC" />
          </mesh>
        </group>

        {/* Cute pointed white duck tail */}
        <group ref={tail} position={[0, -0.08, -0.42]}>
          <mesh position={[0, 0.05, -0.08]} rotation={[-0.85, 0, 0]} scale={[0.9, 1.0, 0.7]} castShadow receiveShadow>
            <coneGeometry args={[0.14, 0.26, 18]} />
            <PlushMaterial color="#FAF5EC" />
          </mesh>
        </group>

        {/* Smoothly integrated, slightly tilted oval duck head */}
        <group ref={head} position={[0, 0.56, 0.02]} rotation={[0, 0, -0.06]}>
          {/* Seamless neck-head blend collar */}
          <mesh position={[0, -0.14, -0.01]} scale={[0.35, 0.28, 0.34]} castShadow receiveShadow>
            <sphereGeometry args={[1, 24, 20]} />
            <PlushMaterial color="#FAF5EC" />
          </mesh>

          {/* Plump oval duck head */}
          <mesh position={[0, 0.08, 0]} castShadow receiveShadow scale={[0.94, 0.98, 0.94]}>
            <sphereGeometry args={[0.41, 32, 28]} />
            <PlushMaterial color="#FAF5EC" />
          </mesh>

          {/* Tiny curved white feather tuft on crown */}
          <group ref={earLeft} position={[0.06, 0.46, -0.02]} rotation={[-0.12, 0, -0.38]}>
            <mesh position={[0, 0.085, 0]} scale={[0.75, 1.0, 0.68]} castShadow receiveShadow>
              <capsuleGeometry args={[0.052, 0.11, 10, 14]} />
              <PlushMaterial color="#FAF5EC" />
            </mesh>
          </group>
          <group ref={earRight} position={[0.12, 0.43, -0.03]} rotation={[-0.18, 0, -0.72]}>
            <mesh position={[0, 0.055, 0]} scale={[0.68, 1.0, 0.64]} castShadow receiveShadow>
              <capsuleGeometry args={[0.038, 0.07, 8, 12]} />
              <PlushMaterial color="#FAF5EC" />
            </mesh>
          </group>

          {/* LARGE wide plump flat-rounded orange duck bill projecting cleanly forward */}
          <group position={[0, -0.01, 0.34]}>
            {/* Upper wide plump duck bill */}
            <mesh
              position={[0, billOpen ? 0.032 : 0.012, 0.12]}
              rotation={[billOpen ? -0.16 : 0.14, 0, 0]}
              scale={[0.3, 0.095, 0.26]}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[1, 28, 20]} />
              <meshStandardMaterial color="#FA9A1C" roughness={0.26} metalness={0.04} />
            </mesh>
            {/* Subtle rounded bill nostrils */}
            <mesh position={[-0.065, 0.08, 0.16]} scale={[0.012, 0.008, 0.018]}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color="#B85D0A" roughness={0.5} />
            </mesh>
            <mesh position={[0.065, 0.08, 0.16]} scale={[0.012, 0.008, 0.018]}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color="#B85D0A" roughness={0.5} />
            </mesh>
            {/* Lower rounded duck bill lip */}
            <mesh
              position={[0, billOpen ? -0.068 : -0.038, 0.095]}
              rotation={[billOpen ? 0.32 : 0.12, 0, 0]}
              scale={[0.255, 0.068, 0.21]}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[1, 24, 16]} />
              <meshStandardMaterial color="#E67E10" roughness={0.3} metalness={0.04} />
            </mesh>
            {/* Rosy inside mouth when open */}
            {billOpen && (
              <mesh position={[0, -0.015, 0.08]} scale={[0.15, 0.055, 0.12]}>
                <sphereGeometry args={[1, 14, 12]} />
                <meshStandardMaterial color="#E04F5F" roughness={0.45} />
              </mesh>
            )}
          </group>

          {/* Small close-set dark vertical-oval duck eyes — NO pink cheek circles */}
          {[-1, 1].map((side) => {
            const ex = side * 0.125;
            const ey = 0.165;
            const ez = 0.365;

            if (emotion === 'happy') {
              return (
                <mesh key={side} position={[ex, ey, ez]}>
                  <torusGeometry args={[0.044, 0.014, 10, 20, Math.PI]} />
                  <meshStandardMaterial color="#1E1815" roughness={0.3} />
                </mesh>
              );
            }

            if (emotion === 'sad') {
              return (
                <group key={side} position={[ex, ey - 0.01, ez]}>
                  <mesh scale={[0.034, 0.052, 0.032]}>
                    <sphereGeometry args={[1, 18, 16]} />
                    <meshStandardMaterial color="#1E1815" roughness={0.14} />
                  </mesh>
                  <mesh position={[-0.01, 0.016, 0.026]}>
                    <sphereGeometry args={[0.011, 10, 10]} />
                    <meshBasicMaterial color="#FFFFFF" />
                  </mesh>
                  <mesh position={[0, 0.065, 0.01]} rotation={[0, 0, side * 0.32]}>
                    <capsuleGeometry args={[0.009, 0.045, 6, 10]} />
                    <meshStandardMaterial color="#4A3525" roughness={0.5} />
                  </mesh>
                  <mesh position={[side * 0.018, -0.058, 0.02]} scale={[0.65, 1.15, 0.65]}>
                    <sphereGeometry args={[0.016, 10, 10]} />
                    <meshStandardMaterial color="#7DD3FC" emissive="#38BDF8" emissiveIntensity={0.25} roughness={0.1} />
                  </mesh>
                </group>
              );
            }

            if (emotion === 'shock') {
              return (
                <group key={side} position={[ex, ey + 0.01, ez]}>
                  <mesh scale={[1, 1.1, 0.65]}>
                    <sphereGeometry args={[0.06, 18, 18]} />
                    <meshStandardMaterial color="#1E1815" roughness={0.4} />
                  </mesh>
                  <mesh position={[0, 0, 0.01]} scale={[1, 1.1, 0.65]}>
                    <sphereGeometry args={[0.05, 18, 18]} />
                    <meshStandardMaterial color="#FFFFFF" roughness={0.25} />
                  </mesh>
                  <mesh position={[0, 0, 0.04]}>
                    <sphereGeometry args={[0.016, 12, 12]} />
                    <meshStandardMaterial color="#1E1815" roughness={0.15} />
                  </mesh>
                </group>
              );
            }

            if (emotion === 'win') {
              return <StarEye key={side} position={[ex, ey + 0.01, ez + 0.01]} />;
            }

            // idle: small dark vertical-oval eyes close together
            return (
              <group key={side} position={[ex, ey, ez]}>
                <mesh scale={[0.036, 0.062, 0.034]}>
                  <sphereGeometry args={[1, 20, 18]} />
                  <meshStandardMaterial color="#1D1613" roughness={0.12} metalness={0.1} />
                </mesh>
                <mesh position={[-0.011, 0.022, 0.028]}>
                  <sphereGeometry args={[0.011, 10, 10]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>
            );
          })}

          {/* Shock sweat drop */}
          {emotion === 'shock' && (
            <mesh position={[0.26, 0.28, 0.3]} scale={[0.7, 1.25, 0.7]}>
              <sphereGeometry args={[0.026, 12, 12]} />
              <meshStandardMaterial color="#7DD3FC" emissive="#38BDF8" emissiveIntensity={0.25} roughness={0.1} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}
