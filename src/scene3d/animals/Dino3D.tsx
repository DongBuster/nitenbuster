import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  TurnRing3D,
  useAnimalMotion,
  type Animal3DProps,
} from '../CharacterRig3D';
import { Accessory3D } from '../Accessory3D';
import { PlushMaterial, getPlushArmGeometry } from '../plushMaterial';
import type { Emotion } from '../../engine/types';

function createDinoBodyGeometry(): THREE.LatheGeometry {
  // Smooth continuous chubby pear body flowing up into the neck
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.35, 0.02),
    new THREE.Vector2(0.48, 0.16),
    new THREE.Vector2(0.51, 0.38),
    new THREE.Vector2(0.45, 0.64),
    new THREE.Vector2(0.36, 0.86),
    new THREE.Vector2(0.28, 1.0),
    new THREE.Vector2(0.0, 1.04),
  ];
  const geo = new THREE.LatheGeometry(points, 36);
  geo.computeVertexNormals();
  return geo;
}

function createStarGeo(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points + Math.PI / 2;
    const r = i % 2 === 0 ? 0.072 : 0.034;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

function DinoEye({
  side,
  emotion,
  starGeo,
}: {
  side: -1 | 1;
  emotion: Emotion;
  starGeo: THREE.ExtrudeGeometry;
}) {
  // Expressive side-front dark eyes with small white lower-crescent sclera & chill eyelid (matching dino.png)
  return (
    <group
      position={[side * 0.255, 0.12, 0.27]}
      rotation={[0, side * 0.44, 0]}
    >
      {emotion === 'happy' && (
        <mesh>
          <torusGeometry args={[0.056, 0.016, 10, 18, Math.PI]} />
          <meshStandardMaterial color="#1F1A15" roughness={0.35} />
        </mesh>
      )}

      {emotion === 'sad' && (
        <>
          <mesh scale={[1.0, 0.92, 0.62]}>
            <sphereGeometry args={[0.06, 18, 16]} />
            <meshStandardMaterial color="#1F1A15" roughness={0.14} metalness={0.08} />
          </mesh>
          <mesh position={[-0.015, 0.02, 0.036]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[0, -0.072, 0.025]} scale={[0.7, 1.2, 0.7]}>
            <sphereGeometry args={[0.02, 12, 10]} />
            <meshStandardMaterial color="#7DD3FC" roughness={0.12} />
          </mesh>
        </>
      )}

      {emotion === 'shock' && (
        <>
          <mesh scale={[1.05, 1.15, 0.56]}>
            <sphereGeometry args={[0.076, 20, 18]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.22} />
          </mesh>
          <mesh position={[0, 0, 0.042]}>
            <sphereGeometry args={[0.024, 14, 12]} />
            <meshStandardMaterial color="#1F1A15" roughness={0.12} />
          </mesh>
        </>
      )}

      {emotion === 'win' && (
        <mesh geometry={starGeo} position={[0, 0, 0.015]}>
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
          {/* White lower-crescent sclera */}
          <mesh position={[0, -0.008, -0.004]} scale={[1.06, 1.0, 0.56]}>
            <sphereGeometry args={[0.064, 18, 16]} />
            <meshStandardMaterial color="#F8F9FA" roughness={0.25} />
          </mesh>
          {/* Glossy dark iris/pupil */}
          <mesh position={[0, 0.004, 0.01]} scale={[0.92, 0.96, 0.58]}>
            <sphereGeometry args={[0.056, 18, 16]} />
            <meshStandardMaterial color="#1F1A15" roughness={0.12} metalness={0.08} />
          </mesh>
          {/* Crisp catchlight */}
          <mesh position={[-0.016, 0.022, 0.042]}>
            <sphereGeometry args={[0.014, 10, 10]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          {/* Cute chill plush upper eyelid */}
          <mesh
            position={[0, 0.044, 0.018]}
            rotation={[0, 0, -side * 0.14]}
            scale={[1.18, 0.42, 0.72]}
          >
            <sphereGeometry args={[0.058, 16, 12]} />
            <PlushMaterial color="#86B850" />
          </mesh>
        </>
      )}
    </group>
  );
}

export function Dino3D({
  emotion = 'idle',
  isActive = false,
  accessory = null,
}: Animal3DProps) {
  const root = useRef<THREE.Group | null>(null);
  const body = useRef<THREE.Group | null>(null);
  const head = useRef<THREE.Group | null>(null);
  const earLeft = useRef<THREE.Group | null>(null);
  const earRight = useRef<THREE.Group | null>(null);
  const armLeft = useRef<THREE.Group | null>(null);
  const armRight = useRef<THREE.Group | null>(null);
  const tail = useRef<THREE.Group | null>(null);

  const bodyGeo = useMemo(() => createDinoBodyGeometry(), []);
  const starGeo = useMemo(() => createStarGeo(), []);
  const armGeo = getPlushArmGeometry(0.38, 0.105, 0.145);

  useAnimalMotion(
    { root, body, head, earLeft, earRight, armLeft, armRight, tail },
    emotion,
    isActive,
  );

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} color="#86B850" />

      {/* Stout chubby green plush feet resting flat at y = 0 */}
      <mesh
        position={[-0.21, 0.1, 0.06]}
        scale={[1.08, 0.78, 1.32]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.14, 20, 16]} />
        <PlushMaterial color="#7AA846" />
      </mesh>
      <mesh
        position={[0.21, 0.1, 0.06]}
        scale={[1.08, 0.78, 1.32]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.14, 20, 16]} />
        <PlushMaterial color="#7AA846" />
      </mesh>

      {/* Body group */}
      <group ref={body} position={[0, 0.11, 0]}>
        {accessory && <Accessory3D accessory={accessory} animal="dino" slot="body" />}
        {/* Smooth continuous avocado-green pear plush body */}
        <mesh geometry={bodyGeo} scale={[1.0, 1.0, 1.02]} castShadow receiveShadow>
          <PlushMaterial color="#86B850" />
        </mesh>

        {/* Wide smooth high-subdivision cream-yellow belly & chest protruding cleanly in +Z (zero Z-fighting) */}
        <mesh
          position={[0, 0.48, 0.28]}
          scale={[0.37, 0.45, 0.31]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[1, 48, 36]} />
          <PlushMaterial color="#EFE9BE" />
        </mesh>

        {/* Stubby rounded left green arm clearly visible outside belly */}
        <group
          ref={armLeft}
          position={[-0.42, 0.62, 0.12]}
          rotation={[0.22, 0.12, -0.38]}
        >
          <mesh geometry={armGeo} castShadow receiveShadow>
            <PlushMaterial color="#86B850" />
          </mesh>
        </group>

        {/* Stubby rounded right green arm clearly visible outside belly */}
        <group
          ref={armRight}
          position={[0.42, 0.62, 0.12]}
          rotation={[0.22, -0.12, 0.38]}
        >
          <mesh geometry={armGeo} castShadow receiveShadow>
            <PlushMaterial color="#86B850" />
          </mesh>
        </group>

        {/* Smooth chubby curved plush dino tail with rounded golden-yellow spikes */}
        <group ref={tail} position={[0, 0.18, -0.3]}>
          <mesh
            position={[0, 0.02, -0.07]}
            rotation={[0.2, 0, 0]}
            scale={[1.05, 0.92, 1.35]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.21, 22, 18]} />
            <PlushMaterial color="#86B850" />
          </mesh>
          <mesh
            position={[0, -0.02, -0.27]}
            rotation={[-0.12, 0, 0]}
            scale={[0.88, 0.76, 1.35]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.16, 20, 16]} />
            <PlushMaterial color="#86B850" />
          </mesh>
          <mesh
            position={[0, 0.02, -0.45]}
            rotation={[-0.36, 0, 0]}
            scale={[0.7, 0.64, 1.2]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.115, 18, 14]} />
            <PlushMaterial color="#86B850" />
          </mesh>
          {/* Neat row of rounded golden-yellow tail spikes */}
          <mesh
            position={[0, 0.18, -0.12]}
            scale={[0.58, 1.08, 0.9]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.075, 16, 14]} />
            <PlushMaterial color="#F4C444" />
          </mesh>
          <mesh
            position={[0, 0.14, -0.26]}
            scale={[0.56, 1.02, 0.86]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.066, 14, 12]} />
            <PlushMaterial color="#F4C444" />
          </mesh>
          <mesh
            position={[0, 0.11, -0.39]}
            scale={[0.52, 0.92, 0.8]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.055, 14, 12]} />
            <PlushMaterial color="#F4C444" />
          </mesh>
        </group>
      </group>

      {/* Head group with long rounded forward-sloping dino snout */}
      <group ref={head} position={[0, 1.15, 0.04]}>
        {accessory && <Accessory3D accessory={accessory} animal="dino" slot="head" />}
        {/* Rounded cranium */}
        <mesh scale={[0.92, 0.96, 1.04]} castShadow receiveShadow>
          <sphereGeometry args={[0.39, 30, 26]} />
          <PlushMaterial color="#86B850" />
        </mesh>

        {/* Long rounded forward-sloping avocado-green dino snout */}
        <mesh
          position={[0, -0.05, 0.31]}
          rotation={[0.24, 0, 0]}
          scale={[0.88, 0.78, 1.25]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.31, 28, 24]} />
          <PlushMaterial color="#86B850" />
        </mesh>

        {/* Warm cream lower snout/jaw flowing cleanly into chest */}
        <mesh
          position={[0, -0.17, 0.25]}
          rotation={[0.2, 0, 0]}
          scale={[0.86, 0.56, 1.12]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.28, 24, 20]} />
          <PlushMaterial color="#EFE9BE" />
        </mesh>

        {/* Two tiny subtle nostril dots near tip of snout */}
        <mesh position={[-0.085, 0.01, 0.65]} scale={[0.85, 1.15, 0.6]}>
          <sphereGeometry args={[0.02, 12, 10]} />
          <meshStandardMaterial color="#4D6E2A" roughness={0.75} />
        </mesh>
        <mesh position={[0.085, 0.01, 0.65]} scale={[0.85, 1.15, 0.6]}>
          <sphereGeometry args={[0.02, 12, 10]} />
          <meshStandardMaterial color="#4D6E2A" roughness={0.75} />
        </mesh>

        {/* Neat row of 3 rounded golden-yellow head crest spikes */}
        <group ref={earLeft} position={[0, 0.38, 0.1]}>
          <mesh scale={[0.56, 1.12, 0.9]} castShadow receiveShadow>
            <sphereGeometry args={[0.075, 16, 14]} />
            <PlushMaterial color="#F4C444" />
          </mesh>
        </group>
        <group ref={earRight} position={[0, 0.41, -0.06]}>
          <mesh scale={[0.6, 1.24, 0.95]} castShadow receiveShadow>
            <sphereGeometry args={[0.09, 16, 14]} />
            <PlushMaterial color="#F4C444" />
          </mesh>
        </group>
        <mesh
          position={[0, 0.31, -0.22]}
          scale={[0.58, 1.1, 0.9]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.08, 16, 14]} />
          <PlushMaterial color="#F4C444" />
        </mesh>

        {/* Custom expressive dino eyes (NO pink cheek circles!) */}
        <DinoEye side={-1} emotion={emotion} starGeo={starGeo} />
        <DinoEye side={1} emotion={emotion} starGeo={starGeo} />
      </group>
    </group>
  );
}
