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

function createChickenPearGeometry(): THREE.LatheGeometry {
  // Squat, round, chubby hen silhouette — wide mid/lower belly and compact lowered head
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.38, 0.02),
    new THREE.Vector2(0.55, 0.16),
    new THREE.Vector2(0.59, 0.36),
    new THREE.Vector2(0.54, 0.58),
    new THREE.Vector2(0.45, 0.78),
    new THREE.Vector2(0.38, 0.96),
    new THREE.Vector2(0.34, 1.12),
    new THREE.Vector2(0.25, 1.25),
    new THREE.Vector2(0.11, 1.33),
    new THREE.Vector2(0.0, 1.35),
  ];
  const geo = new THREE.LatheGeometry(points, 40);
  geo.computeVertexNormals();
  return geo;
}

function createStarGeo(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points + Math.PI / 2;
    const r = i % 2 === 0 ? 0.062 : 0.028;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

function ChickenEye({
  side,
  emotion,
  starGeo,
}: {
  side: -1 | 1;
  emotion: Emotion;
  starGeo: THREE.ExtrudeGeometry;
}) {
  // Small dark bead eyes spaced neatly apart (matching chicken.png)
  return (
    <group
      position={[side * 0.145, 0.14, 0.295]}
      rotation={[0, side * 0.28, 0]}
    >
      {emotion === 'happy' && (
        <mesh>
          <torusGeometry args={[0.036, 0.011, 10, 16, Math.PI]} />
          <meshStandardMaterial color="#1C1613" roughness={0.35} />
        </mesh>
      )}

      {emotion === 'sad' && (
        <>
          <mesh scale={[1.0, 0.9, 0.75]}>
            <sphereGeometry args={[0.036, 16, 14]} />
            <meshStandardMaterial color="#1C1613" roughness={0.12} metalness={0.08} />
          </mesh>
          <mesh position={[-0.01, 0.012, 0.026]}>
            <sphereGeometry args={[0.011, 10, 10]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[0, -0.052, 0.02]} scale={[0.7, 1.2, 0.7]}>
            <sphereGeometry args={[0.016, 12, 10]} />
            <meshStandardMaterial color="#7DD3FC" roughness={0.12} />
          </mesh>
        </>
      )}

      {emotion === 'shock' && (
        <>
          <mesh scale={[1.0, 1.1, 0.58]}>
            <sphereGeometry args={[0.054, 18, 16]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.22} />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <sphereGeometry args={[0.018, 12, 12]} />
            <meshStandardMaterial color="#1C1613" roughness={0.12} />
          </mesh>
        </>
      )}

      {emotion === 'win' && (
        <mesh geometry={starGeo} position={[0, 0, 0.014]}>
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
          <mesh scale={[0.95, 1.05, 0.78]}>
            <sphereGeometry args={[0.036, 16, 16]} />
            <meshStandardMaterial color="#1C1613" roughness={0.1} metalness={0.1} />
          </mesh>
          <mesh position={[-0.01, 0.013, 0.026]}>
            <sphereGeometry args={[0.011, 10, 10]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </>
      )}
    </group>
  );
}

export function Chicken3D({
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

  const pearGeo = useMemo(() => createChickenPearGeometry(), []);
  const starGeo = useMemo(() => createStarGeo(), []);
  const wingGeo = getPlushArmGeometry(0.4, 0.105, 0.15);

  useAnimalMotion(
    { root, body, head, earLeft, earRight, armLeft, armRight, tail },
    emotion,
    isActive,
  );

  const beakOpen =
    emotion === 'shock' ? 0.036 : emotion === 'happy' || emotion === 'win' ? 0.026 : 0;

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} color="#FF6B3D" />

      {/* Flat orange webbed plush feet resting cleanly at y = 0 */}
      <group position={[-0.17, 0.045, 0.09]} rotation={[0, 0.22, 0]}>
        <mesh scale={[1.24, 0.36, 1.55]} castShadow receiveShadow>
          <sphereGeometry args={[0.125, 18, 14]} />
          <PlushMaterial color="#FF9329" roughness={0.76} />
        </mesh>
      </group>
      <group position={[0.17, 0.045, 0.09]} rotation={[0, -0.22, 0]}>
        <mesh scale={[1.24, 0.36, 1.55]} castShadow receiveShadow>
          <sphereGeometry args={[0.125, 18, 14]} />
          <PlushMaterial color="#FF9329" roughness={0.76} />
        </mesh>
      </group>

      {/* Seamless warm-white pear-shaped hen/chick body */}
      <group ref={body} position={[0, 0.075, 0]}>
        {accessory && <Accessory3D accessory={accessory} animal="chicken" slot="body" />}
        <mesh geometry={pearGeo} scale={[1.0, 1.0, 0.98]} castShadow receiveShadow>
          <PlushMaterial color="#FAF4E8" />
        </mesh>

        {/* Stubby drooping white left wing clearly silhouetted outside belly */}
        <group
          ref={armLeft}
          position={[-0.45, 0.56, 0.04]}
          rotation={[0.06, 0.1, -0.42]}
        >
          <mesh
            geometry={wingGeo}
            scale={[0.82, 1.0, 0.95]}
            castShadow
            receiveShadow
          >
            <PlushMaterial color="#FAF4E8" />
          </mesh>
        </group>

        {/* Stubby drooping white right wing clearly silhouetted outside belly */}
        <group
          ref={armRight}
          position={[0.45, 0.56, 0.04]}
          rotation={[0.06, -0.1, 0.42]}
        >
          <mesh
            geometry={wingGeo}
            scale={[0.82, 1.0, 0.95]}
            castShadow
            receiveShadow
          >
            <PlushMaterial color="#FAF4E8" />
          </mesh>
        </group>

        {/* Soft fluffy white tail */}
        <group ref={tail} position={[0, 0.36, -0.49]}>
          <mesh
            position={[0, 0.07, -0.07]}
            rotation={[-0.65, 0, 0]}
            scale={[0.85, 1.1, 0.72]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.14, 18, 14]} />
            <PlushMaterial color="#FAF4E8" />
          </mesh>
        </group>

        {/* Lowered compact head anchor for 3-lobe coral comb, bead eyes & plump orange beak */}
        <group ref={head} position={[0, 0.95, 0]}>
          {accessory && <Accessory3D accessory={accessory} animal="chicken" slot="head" />}
          {/* Bright coral-orange 3-lobed plump comb perched on top of head */}
          <group position={[0.02, 0.39, 0.02]} rotation={[0.05, 0, -0.08]}>
            <mesh
              position={[-0.075, 0.06, 0.03]}
              rotation={[0, 0, 0.28]}
              scale={[0.82, 1.32, 0.74]}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[0.098, 18, 16]} />
              <PlushMaterial color="#FF6B3D" />
            </mesh>
            <mesh
              position={[0.025, 0.085, 0.0]}
              scale={[0.84, 1.38, 0.76]}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[0.104, 18, 16]} />
              <PlushMaterial color="#FF6B3D" />
            </mesh>
            <mesh
              position={[0.11, 0.04, -0.025]}
              rotation={[0, 0, -0.34]}
              scale={[0.78, 1.18, 0.7]}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[0.09, 18, 16]} />
              <PlushMaterial color="#FF6B3D" />
            </mesh>
          </group>

          <group ref={earLeft} position={[-0.32, 0.02, 0]} />
          <group ref={earRight} position={[0.32, 0.02, 0]} />

          {/* Small dark bead eyes (NO pink cheek circles!) */}
          <ChickenEye side={-1} emotion={emotion} starGeo={starGeo} />
          <ChickenEye side={1} emotion={emotion} starGeo={starGeo} />

          {/* Plump rounded-triangular orange beak with subtle closed-beak seam line */}
          <group position={[0, 0.01, 0.34]}>
            {/* Upper plump rounded-triangular beak */}
            <mesh
              position={[0, 0.02 + beakOpen * 0.4, 0.05]}
              rotation={[Math.PI / 2 - 0.14 - beakOpen * 3, 0, 0]}
              scale={[1.42, 0.92, 0.72]}
              castShadow
              receiveShadow
            >
              <coneGeometry args={[0.1, 0.17, 20]} />
              <PlushMaterial color="#FF9329" roughness={0.68} />
            </mesh>
            {/* Plump rounded lower beak lip */}
            <mesh
              position={[0, -0.028 - beakOpen, 0.036]}
              rotation={[0.12 + beakOpen * 4, 0, 0]}
              scale={[1.38, 0.54, 0.92]}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[0.095, 18, 14]} />
              <PlushMaterial color="#F2851E" roughness={0.7} />
            </mesh>
            {/* Subtle closed-beak seam line (idle/sad) */}
            {(emotion === 'idle' || emotion === 'sad') && (
              <mesh
                position={[0, -0.022, 0.098]}
                rotation={[0.15, 0, 0]}
                scale={[1.25, 0.36, 0.3]}
              >
                <torusGeometry args={[0.088, 0.007, 8, 18, Math.PI]} />
                <meshStandardMaterial color="#9E4B0A" roughness={0.6} />
              </mesh>
            )}
            {/* Warm coral interior when open in happy/win/shock */}
            {beakOpen > 0 && (
              <mesh position={[0, -0.008, 0.068]} scale={[0.9, 0.72, 0.45]}>
                <sphereGeometry args={[0.052, 14, 12]} />
                <meshStandardMaterial color="#D94B5C" roughness={0.55} />
              </mesh>
            )}
          </group>
        </group>
      </group>
    </group>
  );
}
