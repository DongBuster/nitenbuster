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

export function Rabbit3D({ emotion = 'idle', isActive = false }: Animal3DProps) {
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

  const pearGeo = getPearBodyGeometry(0.47, 0.92);
  const armGeo = getPlushArmGeometry(0.39, 0.105, 0.145);

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} />

      {/* Ultra-fluffy snowy-white chubby pear bunny body */}
      <group ref={body} position={[0, 0.45, 0]}>
        {/* Sculpted smooth pear-shaped plush body */}
        <mesh geometry={pearGeo} position={[0, -0.37, 0]} castShadow receiveShadow>
          <PlushMaterial color="#FAF5F0" />
        </mesh>

        {/* Smooth plush neck bridge filling waist crease into head */}
        <mesh position={[0, 0.37, 0.01]} scale={[0.35, 0.24, 0.34]} castShadow receiveShadow>
          <sphereGeometry args={[1, 28, 22]} />
          <PlushMaterial color="#FAF5F0" />
        </mesh>

        {/* Short white plush feet resting squarely at y=0 */}
        <mesh position={[-0.2, -0.37, 0.07]} scale={[0.155, 0.088, 0.2]} castShadow receiveShadow>
          <sphereGeometry args={[1, 22, 18]} />
          <PlushMaterial color="#FAF5F0" />
        </mesh>
        <mesh position={[0.2, -0.37, 0.07]} scale={[0.155, 0.088, 0.2]} castShadow receiveShadow>
          <sphereGeometry args={[1, 22, 18]} />
          <PlushMaterial color="#FAF5F0" />
        </mesh>

        {/* Chunky white bunny arms clearly visible outside belly silhouette */}
        <group ref={armLeft} position={[-0.41, 0.18, 0.08]} rotation={[0.16, 0.1, -0.38]}>
          <mesh geometry={armGeo} castShadow receiveShadow>
            <PlushMaterial color="#FAF5F0" />
          </mesh>
        </group>

        <group ref={armRight} position={[0.41, 0.18, 0.08]} rotation={[0.16, -0.1, 0.38]}>
          <mesh geometry={armGeo} castShadow receiveShadow>
            <PlushMaterial color="#FAF5F0" />
          </mesh>
        </group>

        {/* Fluffy round cotton-ball tail in back */}
        <group ref={tail} position={[0, -0.16, -0.4]}>
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.155, 22, 18]} />
            <PlushMaterial color="#FAF5F0" />
          </mesh>
          <mesh position={[0.065, 0.055, -0.04]} castShadow>
            <sphereGeometry args={[0.09, 16, 14]} />
            <PlushMaterial color="#FAF5F0" />
          </mesh>
          <mesh position={[-0.065, 0.045, -0.04]} castShadow>
            <sphereGeometry args={[0.09, 16, 14]} />
            <PlushMaterial color="#FAF5F0" />
          </mesh>
        </group>

        {/* Fluffy rounded bunny head with seamless plump cheeks */}
        <group ref={head} position={[0, 0.56, 0.02]}>
          {/* Upper crown of bunny head */}
          <mesh position={[0, 0.03, 0]} castShadow receiveShadow scale={[0.98, 0.96, 0.95]}>
            <sphereGeometry args={[0.45, 36, 32]} />
            <PlushMaterial color="#FAF5F0" />
          </mesh>

          {/* Wide smooth lower cheeks blending into a single plump chubby head */}
          <mesh position={[0, -0.09, 0.03]} castShadow receiveShadow scale={[1.08, 0.74, 0.96]}>
            <sphereGeometry args={[0.44, 36, 28]} />
            <PlushMaterial color="#FAF5F0" />
          </mesh>

          {/* Subtle blended muzzle fullness (no oversized detached cheek balls) */}
          <mesh position={[-0.085, -0.085, 0.36]} scale={[0.105, 0.085, 0.08]} castShadow>
            <sphereGeometry args={[1, 20, 16]} />
            <PlushMaterial color="#FAF5F0" />
          </mesh>
          <mesh position={[0.085, -0.085, 0.36]} scale={[0.105, 0.085, 0.08]} castShadow>
            <sphereGeometry args={[1, 20, 16]} />
            <PlushMaterial color="#FAF5F0" />
          </mesh>

          {/* Tiny pink triangular bunny nose */}
          <mesh position={[0, -0.01, 0.455]} rotation={[0, 0, Math.PI]} scale={[1.2, 0.9, 0.7]} castShadow>
            <coneGeometry args={[0.032, 0.038, 16]} />
            <meshStandardMaterial color="#F0A0AC" roughness={0.32} />
          </mesh>

          {/* Tall soft upright rounded bunny ears with blush-pink inner hollows */}
          <group ref={earLeft} position={[-0.16, 0.39, -0.01]} rotation={[0.04, 0.08, 0.22]}>
            <mesh position={[0, 0.28, 0]} scale={[0.84, 1.0, 0.52]} castShadow receiveShadow>
              <capsuleGeometry args={[0.115, 0.38, 14, 20]} />
              <PlushMaterial color="#FAF5F0" />
            </mesh>
            <mesh position={[0, 0.27, 0.046]} scale={[0.52, 0.82, 0.28]}>
              <capsuleGeometry args={[0.105, 0.33, 12, 16]} />
              <PlushMaterial color="#F4B5BE" />
            </mesh>
          </group>

          <group ref={earRight} position={[0.16, 0.39, -0.01]} rotation={[0.04, -0.08, -0.14]}>
            <mesh position={[0, 0.28, 0]} scale={[0.84, 1.0, 0.52]} castShadow receiveShadow>
              <capsuleGeometry args={[0.115, 0.38, 14, 20]} />
              <PlushMaterial color="#FAF5F0" />
            </mesh>
            <mesh position={[0, 0.27, 0.046]} scale={[0.52, 0.82, 0.28]}>
              <capsuleGeometry args={[0.105, 0.33, 12, 16]} />
              <PlushMaterial color="#F4B5BE" />
            </mesh>
          </group>

          {/* Small glossy dark slightly wide-set bunny eyes — NO pink cheek circles */}
          {[-1, 1].map((side) => {
            const ex = side * 0.185;
            const ey = 0.065;
            const ez = 0.395;

            if (emotion === 'happy') {
              return (
                <mesh key={side} position={[ex, ey, ez]} rotation={[0, side * 0.18, 0]}>
                  <torusGeometry args={[0.044, 0.014, 10, 20, Math.PI]} />
                  <meshStandardMaterial color="#1F1916" roughness={0.3} />
                </mesh>
              );
            }

            if (emotion === 'sad') {
              return (
                <group key={side} position={[ex, ey - 0.01, ez]} rotation={[0, side * 0.18, 0]}>
                  <mesh scale={[0.036, 0.048, 0.034]}>
                    <sphereGeometry args={[1, 18, 16]} />
                    <meshStandardMaterial color="#1F1916" roughness={0.14} />
                  </mesh>
                  <mesh position={[-0.011, 0.015, 0.028]}>
                    <sphereGeometry args={[0.011, 10, 10]} />
                    <meshBasicMaterial color="#FFFFFF" />
                  </mesh>
                  <mesh position={[0, 0.058, 0.01]} rotation={[0, 0, side * 0.34]}>
                    <capsuleGeometry args={[0.009, 0.048, 6, 10]} />
                    <meshStandardMaterial color="#6B5B53" roughness={0.5} />
                  </mesh>
                  <mesh position={[side * 0.018, -0.056, 0.02]} scale={[0.65, 1.15, 0.65]}>
                    <sphereGeometry args={[0.016, 10, 10]} />
                    <meshStandardMaterial color="#7DD3FC" emissive="#38BDF8" emissiveIntensity={0.25} roughness={0.1} />
                  </mesh>
                </group>
              );
            }

            if (emotion === 'shock') {
              return (
                <group key={side} position={[ex, ey + 0.01, ez]} rotation={[0, side * 0.18, 0]}>
                  <mesh scale={[1, 1.08, 0.65]}>
                    <sphereGeometry args={[0.06, 18, 18]} />
                    <meshStandardMaterial color="#1F1916" roughness={0.4} />
                  </mesh>
                  <mesh position={[0, 0, 0.01]} scale={[1, 1.08, 0.65]}>
                    <sphereGeometry args={[0.05, 18, 18]} />
                    <meshStandardMaterial color="#FFFFFF" roughness={0.25} />
                  </mesh>
                  <mesh position={[0, 0, 0.04]}>
                    <sphereGeometry args={[0.016, 12, 12]} />
                    <meshStandardMaterial color="#1F1916" roughness={0.15} />
                  </mesh>
                </group>
              );
            }

            if (emotion === 'win') {
              return <StarEye key={side} position={[ex, ey + 0.01, ez + 0.01]} />;
            }

            // idle: small glossy dark slightly wide-set bunny eyes
            return (
              <group key={side} position={[ex, ey, ez]} rotation={[0, side * 0.18, 0]}>
                <mesh scale={[0.038, 0.054, 0.036]}>
                  <sphereGeometry args={[1, 20, 18]} />
                  <meshStandardMaterial color="#1F1916" roughness={0.12} metalness={0.1} />
                </mesh>
                <mesh position={[-0.011, 0.019, 0.03]}>
                  <sphereGeometry args={[0.011, 10, 10]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>
            );
          })}

          {/* Shock sweat drop */}
          {emotion === 'shock' && (
            <mesh position={[0.31, 0.22, 0.34]} scale={[0.7, 1.25, 0.7]}>
              <sphereGeometry args={[0.026, 12, 12]} />
              <meshStandardMaterial color="#7DD3FC" emissive="#38BDF8" emissiveIntensity={0.25} roughness={0.1} />
            </mesh>
          )}

          {/* Subtle bunny philtrum / mouth */}
          {emotion === 'idle' && (
            <mesh position={[0, -0.075, 0.455]}>
              <capsuleGeometry args={[0.006, 0.044, 6, 8]} />
              <meshStandardMaterial color="#B5A199" roughness={0.7} />
            </mesh>
          )}
          {(emotion === 'happy' || emotion === 'win') && (
            <mesh position={[0, -0.105, 0.445]} scale={[1.0, 0.85, 0.45]}>
              <sphereGeometry args={[0.042, 16, 14]} />
              <meshStandardMaterial color="#F26B7A" roughness={0.4} />
            </mesh>
          )}
          {emotion === 'sad' && (
            <mesh position={[0, -0.115, 0.445]}>
              <torusGeometry args={[0.032, 0.008, 8, 16, Math.PI]} />
              <meshStandardMaterial color="#7A655E" roughness={0.5} />
            </mesh>
          )}
          {emotion === 'shock' && (
            <mesh position={[0, -0.105, 0.445]}>
              <torusGeometry args={[0.032, 0.01, 10, 20]} />
              <meshStandardMaterial color="#2C2019" roughness={0.4} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}
