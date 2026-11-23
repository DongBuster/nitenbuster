import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  TurnRing3D,
  useAnimalMotion,
  type Animal3DProps,
} from '../CharacterRig3D';
import { PlushMaterial, getPlushArmGeometry } from '../plushMaterial';
import type { Emotion } from '../../engine/types';

function createSharkHoodGeometry(): THREE.LatheGeometry {
  // Smooth rounded-triangular plush shark hood flowing seamlessly into wide chubby torso
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.36, 0.02),
    new THREE.Vector2(0.49, 0.14),
    new THREE.Vector2(0.52, 0.36),
    new THREE.Vector2(0.5, 0.62),
    new THREE.Vector2(0.45, 0.88),
    new THREE.Vector2(0.38, 1.12),
    new THREE.Vector2(0.27, 1.33),
    new THREE.Vector2(0.14, 1.48),
    new THREE.Vector2(0.04, 1.56),
    new THREE.Vector2(0.0, 1.58),
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

function SharkSideEye({
  side,
  emotion,
  starGeo,
}: {
  side: -1 | 1;
  emotion: Emotion;
  starGeo: THREE.ExtrudeGeometry;
}) {
  // Side-set eyes placed on left and right flanks of the blue shark hood
  return (
    <group
      position={[side * 0.285, 0.14, 0.21]}
      rotation={[0, side * 0.72, 0]}
    >
      {emotion === 'happy' && (
        <mesh>
          <torusGeometry args={[0.048, 0.014, 10, 18, Math.PI]} />
          <meshStandardMaterial color="#1C1715" roughness={0.35} />
        </mesh>
      )}

      {emotion === 'sad' && (
        <>
          <mesh scale={[0.88, 1.05, 0.65]}>
            <sphereGeometry args={[0.048, 18, 16]} />
            <meshStandardMaterial color="#1C1715" roughness={0.14} metalness={0.08} />
          </mesh>
          <mesh position={[-0.012, 0.018, 0.032]}>
            <sphereGeometry args={[0.015, 10, 10]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[0, -0.065, 0.022]} scale={[0.7, 1.2, 0.7]}>
            <sphereGeometry args={[0.018, 12, 10]} />
            <meshStandardMaterial color="#7DD3FC" roughness={0.12} />
          </mesh>
        </>
      )}

      {emotion === 'shock' && (
        <>
          <mesh scale={[1.0, 1.15, 0.55]}>
            <sphereGeometry args={[0.068, 18, 16]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.22} />
          </mesh>
          <mesh position={[0, 0, 0.034]}>
            <sphereGeometry args={[0.022, 12, 12]} />
            <meshStandardMaterial color="#1C1715" roughness={0.12} />
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
          <mesh scale={[0.85, 1.18, 0.68]}>
            <sphereGeometry args={[0.048, 18, 16]} />
            <meshStandardMaterial color="#1C1715" roughness={0.12} metalness={0.08} />
          </mesh>
          <mesh position={[-0.012, 0.02, 0.032]}>
            <sphereGeometry args={[0.014, 10, 10]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </>
      )}
    </group>
  );
}

export function Shark3D({ emotion = 'idle', isActive = false }: Animal3DProps) {
  const root = useRef<THREE.Group | null>(null);
  const body = useRef<THREE.Group | null>(null);
  const head = useRef<THREE.Group | null>(null);
  const earLeft = useRef<THREE.Group | null>(null);
  const earRight = useRef<THREE.Group | null>(null);
  const armLeft = useRef<THREE.Group | null>(null);
  const armRight = useRef<THREE.Group | null>(null);
  const tail = useRef<THREE.Group | null>(null);

  const hoodGeo = useMemo(() => createSharkHoodGeometry(), []);
  const starGeo = useMemo(() => createStarGeo(), []);
  const flipperGeo = getPlushArmGeometry(0.45, 0.115, 0.16);

  useAnimalMotion(
    { root, body, head, earLeft, earRight, armLeft, armRight, tail },
    emotion,
    isActive,
  );

  const mouthOpen =
    emotion === 'shock' ? 0.045 : emotion === 'happy' || emotion === 'win' ? 0.028 : 0;

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} color="#678BB8" />

      {/* Stout chubby slate-blue plush legs resting flat at y = 0 */}
      <mesh
        position={[-0.22, 0.1, 0.04]}
        scale={[1.08, 0.82, 1.24]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.14, 20, 16]} />
        <PlushMaterial color="#5A7EA9" />
      </mesh>
      <mesh
        position={[0.22, 0.1, 0.04]}
        scale={[1.08, 0.82, 1.24]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.14, 20, 16]} />
        <PlushMaterial color="#5A7EA9" />
      </mesh>

      {/* Main plush shark body + seamless hood */}
      <group ref={body} position={[0, 0.11, 0]}>
        <mesh
          geometry={hoodGeo}
          scale={[1.02, 1.0, 0.96]}
          castShadow
          receiveShadow
        >
          <PlushMaterial color="#678BB8" />
        </mesh>

        {/* Single continuous smooth high-subdivision cream-white belly shield below y = 0.68 */}
        <mesh
          position={[0, 0.36, 0.25]}
          scale={[0.37, 0.32, 0.31]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[1, 48, 36]} />
          <PlushMaterial color="#F6F4F0" />
        </mesh>

        {/* Chubby drooping left plush side flipper clearly silhouetted outside body */}
        <group
          ref={armLeft}
          position={[-0.45, 0.66, 0.05]}
          rotation={[0.08, 0.1, -0.44]}
        >
          <mesh
            geometry={flipperGeo}
            scale={[0.85, 1.0, 0.95]}
            castShadow
            receiveShadow
          >
            <PlushMaterial color="#678BB8" />
          </mesh>
        </group>

        {/* Chubby drooping right plush side flipper clearly silhouetted outside body */}
        <group
          ref={armRight}
          position={[0.45, 0.66, 0.05]}
          rotation={[0.08, -0.1, 0.44]}
        >
          <mesh
            geometry={flipperGeo}
            scale={[0.85, 1.0, 0.95]}
            castShadow
            receiveShadow
          >
            <PlushMaterial color="#678BB8" />
          </mesh>
        </group>

        {/* Plump dorsal fin on upper back */}
        <mesh
          position={[0, 0.98, -0.37]}
          rotation={[-0.52, 0, 0]}
          scale={[0.42, 1.15, 1.05]}
          castShadow
          receiveShadow
        >
          <coneGeometry args={[0.19, 0.38, 20]} />
          <PlushMaterial color="#587BA6" />
        </mesh>

        {/* Soft rounded plush shark tail blending organically into lower back */}
        <group ref={tail} position={[0, 0.34, -0.36]}>
          <mesh
            position={[0, 0.04, -0.1]}
            rotation={[-0.35, 0, 0]}
            scale={[0.76, 0.82, 1.25]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.17, 20, 16]} />
            <PlushMaterial color="#678BB8" />
          </mesh>
          <mesh
            position={[0, 0.17, -0.23]}
            rotation={[-0.65, 0, 0]}
            scale={[0.42, 1.18, 0.72]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.14, 18, 14]} />
            <PlushMaterial color="#587BA6" />
          </mesh>
          <mesh
            position={[0, -0.02, -0.22]}
            rotation={[0.65, 0, 0]}
            scale={[0.4, 0.92, 0.65]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.115, 18, 14]} />
            <PlushMaterial color="#587BA6" />
          </mesh>
        </group>

        {/* Head & clearly visible arched shark mouth with 6 white triangular teeth */}
        <group ref={head} position={[0, 1.04, 0]}>
          <group ref={earLeft} position={[-0.18, 0.32, 0]} />
          <group ref={earRight} position={[0.18, 0.32, 0]} />

          {/* Arched dusty-pink open shark mouth & 6 white triangular teeth cleanly on front surface */}
          <group position={[0, -0.24, 0.38]}>
            {/* Arched dusty-pink mouth interior (#9E5860) cleanly visible from front */}
            <mesh
              position={[0, 0.0, 0.01]}
              scale={[0.25, 0.12 + mouthOpen * 1.4, 0.095]}
            >
              <sphereGeometry args={[1, 36, 28]} />
              <PlushMaterial color="#9E5860" roughness={0.94} />
            </mesh>
            {/* Neat curved row of 6 white triangular teeth along upper rim of mouth arch */}
            {[-0.175, -0.105, -0.035, 0.035, 0.105, 0.175].map((tx, idx) => {
              const archY = 0.068 - Math.abs(tx) * 0.34;
              const archZ = 0.085 - Math.abs(tx) * 0.24;
              return (
                <mesh
                  key={idx}
                  position={[tx, archY, archZ]}
                  rotation={[Math.PI + 0.14, 0, -tx * 1.4]}
                  scale={[0.96, 1.05, 0.72]}
                  castShadow
                >
                  <coneGeometry args={[0.036, 0.076, 12]} />
                  <PlushMaterial color="#FFFFFF" roughness={0.7} />
                </mesh>
              );
            })}
          </group>

          {/* Small glossy black eyes placed on the LEFT and RIGHT SIDES of the head */}
          <SharkSideEye side={-1} emotion={emotion} starGeo={starGeo} />
          <SharkSideEye side={1} emotion={emotion} starGeo={starGeo} />
        </group>
      </group>
    </group>
  );
}
