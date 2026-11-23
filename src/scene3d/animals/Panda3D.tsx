import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  TurnRing3D,
  useAnimalMotion,
  type Animal3DProps,
} from '../CharacterRig3D';
import { PlushMaterial, getPearBodyGeometry } from '../plushMaterial';
import type { Emotion } from '../../engine/types';

function createStarGeo(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points + Math.PI / 2;
    const r = i % 2 === 0 ? 0.068 : 0.032;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

function PandaEye({
  side,
  emotion,
  starGeo,
}: {
  side: -1 | 1;
  emotion: Emotion;
  starGeo: THREE.ExtrudeGeometry;
}) {
  // Small glossy dark eyes nestled inside the large tilted charcoal eye patches
  return (
    <group
      position={[side * 0.165, 0.065, 0.455]}
      rotation={[0, side * 0.22, 0]}
    >
      {emotion === 'happy' && (
        <mesh>
          <torusGeometry args={[0.044, 0.013, 10, 18, Math.PI]} />
          <meshStandardMaterial color="#F6F3EC" roughness={0.35} />
        </mesh>
      )}

      {emotion === 'sad' && (
        <>
          <mesh scale={[0.95, 0.9, 0.7]}>
            <sphereGeometry args={[0.042, 16, 16]} />
            <meshStandardMaterial color="#14100E" roughness={0.1} metalness={0.1} />
          </mesh>
          <mesh position={[-0.012, 0.015, 0.03]}>
            <sphereGeometry args={[0.014, 10, 10]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[side * 0.012, -0.056, 0.024]} scale={[0.7, 1.2, 0.7]}>
            <sphereGeometry args={[0.018, 12, 10]} />
            <meshStandardMaterial color="#7DD3FC" roughness={0.12} />
          </mesh>
        </>
      )}

      {emotion === 'shock' && (
        <>
          <mesh scale={[1.0, 1.08, 0.56]}>
            <sphereGeometry args={[0.062, 18, 16]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.22} />
          </mesh>
          <mesh position={[0, 0, 0.034]}>
            <sphereGeometry args={[0.02, 12, 12]} />
            <meshStandardMaterial color="#14100E" roughness={0.12} />
          </mesh>
        </>
      )}

      {emotion === 'win' && (
        <mesh geometry={starGeo} position={[0, 0, 0.016]}>
          <meshStandardMaterial
            color="#FACC15"
            emissive="#F59E0B"
            emissiveIntensity={0.45}
            roughness={0.22}
          />
        </mesh>
      )}

      {emotion === 'idle' && (
        <>
          <mesh scale={[0.95, 1.08, 0.72]}>
            <sphereGeometry args={[0.042, 18, 16]} />
            <meshStandardMaterial color="#14100E" roughness={0.08} metalness={0.12} />
          </mesh>
          <mesh position={[-0.013, 0.016, 0.03]}>
            <sphereGeometry args={[0.013, 10, 10]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </>
      )}
    </group>
  );
}

export function Panda3D({ emotion = 'idle', isActive = false }: Animal3DProps) {
  const root = useRef<THREE.Group | null>(null);
  const body = useRef<THREE.Group | null>(null);
  const head = useRef<THREE.Group | null>(null);
  const earLeft = useRef<THREE.Group | null>(null);
  const earRight = useRef<THREE.Group | null>(null);
  const armLeft = useRef<THREE.Group | null>(null);
  const armRight = useRef<THREE.Group | null>(null);
  const tail = useRef<THREE.Group | null>(null);

  const pearGeo = getPearBodyGeometry(0.51, 1.02);
  const starGeo = useMemo(() => createStarGeo(), []);

  useAnimalMotion(
    { root, body, head, earLeft, earRight, armLeft, armRight, tail },
    emotion,
    isActive,
  );

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} color="#3E3835" />

      {/* Stout dark charcoal-brown legs resting flat at y = 0 */}
      <mesh
        position={[-0.22, 0.14, 0.03]}
        scale={[1.12, 1.02, 1.2]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.165, 22, 18]} />
        <PlushMaterial color="#3E3835" />
      </mesh>
      <mesh
        position={[0.22, 0.14, 0.03]}
        scale={[1.12, 1.02, 1.2]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.165, 22, 18]} />
        <PlushMaterial color="#3E3835" />
      </mesh>

      {/* Wide ultra-fluffy pear-shaped body group */}
      <group ref={body} position={[0, 0.15, 0]}>
        <mesh geometry={pearGeo} scale={[1.02, 1.0, 0.96]} castShadow receiveShadow>
          <PlushMaterial color="#F6F3EC" />
        </mesh>

        {/* Dark charcoal hip wrap blending into legs */}
        <mesh
          position={[0, 0.12, -0.02]}
          scale={[1.05, 0.48, 0.98]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.46, 26, 20]} />
          <PlushMaterial color="#3E3835" />
        </mesh>

        {/* Thick smooth dark charcoal shoulder/chest band */}
        <mesh
          position={[0, 0.74, 0]}
          scale={[0.47, 0.24, 0.45]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[1, 48, 36]} />
          <PlushMaterial color="#3E3835" />
        </mesh>

        {/* Left chubby dark arm wrapping organically from shoulder around chest */}
        <group
          ref={armLeft}
          position={[-0.31, 0.68, 0.08]}
          rotation={[0.04, 0.16, -0.08]}
        >
          {/* Embedded shoulder joint */}
          <mesh position={[0, 0, 0]} scale={[1.0, 0.96, 1.05]} castShadow receiveShadow>
            <sphereGeometry args={[0.145, 22, 18]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
          {/* Upper arm curving forward from shoulder */}
          <mesh
            position={[-0.04, -0.05, 0.14]}
            rotation={[Math.PI / 2 - 0.18, 0, -0.22]}
            castShadow
            receiveShadow
          >
            <capsuleGeometry args={[0.132, 0.16, 12, 18]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
          {/* Crossed horizontal forearm resting cozily on front of chest */}
          <mesh
            position={[0.2, -0.09, 0.26]}
            rotation={[0, 0.12, Math.PI / 2 - 0.1]}
            castShadow
            receiveShadow
          >
            <capsuleGeometry args={[0.132, 0.26, 14, 22]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
        </group>

        {/* Right chubby dark arm wrapping organically from shoulder & overlapping left paw */}
        <group
          ref={armRight}
          position={[0.31, 0.68, 0.08]}
          rotation={[0.04, -0.16, 0.08]}
        >
          {/* Embedded shoulder joint */}
          <mesh position={[0, 0, 0]} scale={[1.0, 0.96, 1.05]} castShadow receiveShadow>
            <sphereGeometry args={[0.145, 22, 18]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
          {/* Upper arm curving forward from shoulder */}
          <mesh
            position={[0.04, -0.04, 0.16]}
            rotation={[Math.PI / 2 - 0.14, 0, 0.22]}
            castShadow
            receiveShadow
          >
            <capsuleGeometry args={[0.132, 0.18, 12, 18]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
          {/* Crossed horizontal forearm resting cozily over left paw */}
          <mesh
            position={[-0.2, -0.07, 0.29]}
            rotation={[0, -0.12, Math.PI / 2 + 0.1]}
            castShadow
            receiveShadow
          >
            <capsuleGeometry args={[0.136, 0.26, 14, 22]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
        </group>

        {/* Cute round cream-white puff tail */}
        <group ref={tail} position={[0, 0.22, -0.45]}>
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.13, 18, 16]} />
            <PlushMaterial color="#F6F3EC" />
          </mesh>
        </group>
      </group>

      {/* Smooth round white panda head */}
      <group ref={head} position={[0, 1.15, 0.02]}>
        <mesh scale={[1.08, 0.94, 0.96]} castShadow receiveShadow>
          <sphereGeometry args={[0.47, 32, 28]} />
          <PlushMaterial color="#F6F3EC" />
        </mesh>

        {/* Soft puffy white snout muzzle pad */}
        <mesh
          position={[0, -0.04, 0.36]}
          scale={[1.1, 0.85, 0.78]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.165, 22, 18]} />
          <PlushMaterial color="#F6F3EC" />
        </mesh>

        {/* Large tilted oval dark charcoal-brown eye patches */}
        <mesh
          position={[-0.21, 0.055, 0.37]}
          rotation={[0.06, -0.36, 0.42]}
          scale={[1.28, 0.92, 0.36]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.135, 24, 20]} />
          <PlushMaterial color="#3E3835" />
        </mesh>
        <mesh
          position={[0.21, 0.055, 0.37]}
          rotation={[0.06, 0.36, -0.42]}
          scale={[1.28, 0.92, 0.36]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.135, 24, 20]} />
          <PlushMaterial color="#3E3835" />
        </mesh>

        {/* Small round dark left ear */}
        <group ref={earLeft} position={[-0.35, 0.37, -0.02]}>
          <mesh scale={[1.0, 1.0, 0.68]} castShadow receiveShadow>
            <sphereGeometry args={[0.145, 22, 18]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
        </group>

        {/* Small round dark right ear */}
        <group ref={earRight} position={[0.35, 0.37, -0.02]}>
          <mesh scale={[1.0, 1.0, 0.68]} castShadow receiveShadow>
            <sphereGeometry args={[0.145, 22, 18]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
        </group>

        {/* Small glossy dark eyes nestled inside patches (NO pink cheek circles!) */}
        <PandaEye side={-1} emotion={emotion} starGeo={starGeo} />
        <PandaEye side={1} emotion={emotion} starGeo={starGeo} />

        {/* Cute small dark triangular-oval panda nose */}
        <mesh
          position={[0, 0.005, 0.495]}
          scale={[1.38, 0.85, 0.7]}
          castShadow
        >
          <sphereGeometry args={[0.04, 16, 14]} />
          <meshStandardMaterial color="#251F1C" roughness={0.32} />
        </mesh>

        {/* Subtle panda mouth by emotion */}
        {emotion === 'idle' && (
          <group position={[0, -0.048, 0.485]}>
            <mesh position={[0, 0.014, 0]}>
              <capsuleGeometry args={[0.006, 0.022, 6, 8]} />
              <meshStandardMaterial color="#3A2F2A" roughness={0.6} />
            </mesh>
            <mesh position={[-0.018, -0.008, 0]} rotation={[0, 0, -0.65]}>
              <capsuleGeometry args={[0.0055, 0.024, 6, 8]} />
              <meshStandardMaterial color="#3A2F2A" roughness={0.6} />
            </mesh>
            <mesh position={[0.018, -0.008, 0]} rotation={[0, 0, 0.65]}>
              <capsuleGeometry args={[0.0055, 0.024, 6, 8]} />
              <meshStandardMaterial color="#3A2F2A" roughness={0.6} />
            </mesh>
          </group>
        )}

        {(emotion === 'happy' || emotion === 'win') && (
          <mesh position={[0, -0.06, 0.485]} scale={[1.15, 0.85, 0.45]}>
            <sphereGeometry args={[0.044, 14, 14]} />
            <meshStandardMaterial color="#E06D7A" roughness={0.5} />
          </mesh>
        )}

        {emotion === 'sad' && (
          <mesh position={[0, -0.075, 0.485]}>
            <torusGeometry args={[0.032, 0.008, 8, 14, Math.PI]} />
            <meshStandardMaterial color="#3A2F2A" roughness={0.5} />
          </mesh>
        )}

        {emotion === 'shock' && (
          <mesh position={[0, -0.065, 0.485]} scale={[0.9, 1.15, 0.45]}>
            <sphereGeometry args={[0.036, 14, 14]} />
            <meshStandardMaterial color="#3A2F2A" roughness={0.5} />
          </mesh>
        )}
      </group>
    </group>
  );
}
