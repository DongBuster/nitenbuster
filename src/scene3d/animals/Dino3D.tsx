import { useRef } from 'react';
import type * as THREE from 'three';
import {
  TurnRing3D,
  useAnimalMotion,
  type Animal3DProps,
} from '../CharacterRig3D';
import { Accessory3D } from '../Accessory3D';
import { DetailMaterial, PlushMaterial, getPlushArmGeometry } from '../plushMaterial';
import {
  getDinoBodyGeometry,
  getDinoClawsGeometry,
  getDinoPlateGeometry,
} from '../plushCurves';
import { PlushEyePair, PlushSweatDrop } from '../plushDetails';

export function Dino3D({
  emotion = 'idle',
  isActive = false,
  accessory = null,
}: Animal3DProps) {
  const root = useRef<THREE.Group | null>(null);
  const body = useRef<THREE.Group | null>(null);
  const head = useRef<THREE.Group | null>(null);
  const eyes = useRef<THREE.Group | null>(null);
  const earLeft = useRef<THREE.Group | null>(null);
  const earRight = useRef<THREE.Group | null>(null);
  const armLeft = useRef<THREE.Group | null>(null);
  const armRight = useRef<THREE.Group | null>(null);
  const tail = useRef<THREE.Group | null>(null);

  const bodyGeo = getDinoBodyGeometry();
  const plateGeo = getDinoPlateGeometry();
  const clawsGeo = getDinoClawsGeometry();
  const armGeo = getPlushArmGeometry(0.38, 0.105, 0.145);

  useAnimalMotion(
    { root, body, head, eyes, earLeft, earRight, armLeft, armRight, tail },
    emotion,
    isActive,
  );

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} color="#86B850" />

      {/* Stout chubby green plush feet with merged 3 cream toe claws */}
      {([-1, 1] as const).map((side) => (
        <group key={`foot-${side}`} position={[side * 0.21, 0.1, 0.06]}>
          <mesh scale={[1.08, 0.78, 1.32]} castShadow receiveShadow>
            <sphereGeometry args={[0.14, 18, 14]} />
            <PlushMaterial color="#7AA846" />
          </mesh>
          <mesh geometry={clawsGeo}>
            <PlushMaterial color="#F7F1D8" roughness={0.72} />
          </mesh>
        </group>
      ))}

      {/* Body group */}
      <group ref={body} position={[0, 0.11, 0]}>
        {accessory && <Accessory3D accessory={accessory} animal="dino" slot="body" />}
        <mesh geometry={bodyGeo} scale={[1.0, 1.0, 1.02]} castShadow receiveShadow>
          <PlushMaterial color="#86B850" />
        </mesh>

        {/* Smooth cream-yellow belly & chest */}
        <mesh
          position={[0, 0.48, 0.28]}
          scale={[0.37, 0.45, 0.31]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[1, 28, 22]} />
          <PlushMaterial color="#EFE9BE" />
        </mesh>

        {/* Subtle olive-green plush spots on hips */}
        {([-1, 1] as const).map((side) => (
          <group key={`spots-${side}`}>
            <mesh position={[side * 0.43, 0.34, -0.14]} scale={[0.045, 0.065, 0.055]}>
              <sphereGeometry args={[1, 10, 8]} />
              <PlushMaterial color="#6D9B3D" />
            </mesh>
            <mesh position={[side * 0.38, 0.22, -0.24]} scale={[0.036, 0.048, 0.042]}>
              <sphereGeometry args={[1, 10, 8]} />
              <PlushMaterial color="#6D9B3D" />
            </mesh>
          </group>
        ))}

        {/* Two spine plates bridging neck to tail */}
        <mesh
          geometry={plateGeo}
          position={[0, 0.76, -0.35]}
          rotation={[-1.08, 0, 0]}
          scale={[0.92, 0.92, 0.92]}
        >
          <PlushMaterial color="#F4C444" />
        </mesh>
        <mesh
          geometry={plateGeo}
          position={[0, 0.52, -0.44]}
          rotation={[-1.25, 0, 0]}
          scale={[0.98, 0.98, 0.98]}
        >
          <PlushMaterial color="#F4C444" />
        </mesh>

        {/* Stubby rounded green arms */}
        <group
          ref={armLeft}
          position={[-0.42, 0.62, 0.12]}
          rotation={[0.22, 0.12, -0.38]}
        >
          <mesh geometry={armGeo} castShadow receiveShadow>
            <PlushMaterial color="#86B850" />
          </mesh>
        </group>

        <group
          ref={armRight}
          position={[0.42, 0.62, 0.12]}
          rotation={[0.22, -0.12, 0.38]}
        >
          <mesh geometry={armGeo} castShadow receiveShadow>
            <PlushMaterial color="#86B850" />
          </mesh>
        </group>

        {/* Smooth chubby curved plush dino tail with sculpted golden-yellow plates */}
        <group ref={tail} position={[0, 0.18, -0.3]}>
          <mesh
            position={[0, 0.02, -0.07]}
            rotation={[0.2, 0, 0]}
            scale={[1.05, 0.92, 1.35]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.21, 20, 16]} />
            <PlushMaterial color="#86B850" />
          </mesh>
          <mesh
            position={[0, -0.02, -0.27]}
            rotation={[-0.12, 0, 0]}
            scale={[0.88, 0.76, 1.35]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.16, 18, 14]} />
            <PlushMaterial color="#86B850" />
          </mesh>
          <mesh
            position={[0, 0.02, -0.45]}
            rotation={[-0.36, 0, 0]}
            scale={[0.7, 0.64, 1.2]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.115, 16, 12]} />
            <PlushMaterial color="#86B850" />
          </mesh>

          {/* Sculpted beveled dino tail plates */}
          <mesh
            geometry={plateGeo}
            position={[0, 0.15, -0.12]}
            rotation={[-0.32, 0, 0]}
            scale={[0.9, 0.9, 0.9]}
          >
            <PlushMaterial color="#F4C444" />
          </mesh>
          <mesh
            geometry={plateGeo}
            position={[0, 0.11, -0.27]}
            rotation={[-0.25, 0, 0]}
            scale={[0.8, 0.8, 0.8]}
          >
            <PlushMaterial color="#F4C444" />
          </mesh>
          <mesh
            geometry={plateGeo}
            position={[0, 0.09, -0.41]}
            rotation={[-0.18, 0, 0]}
            scale={[0.68, 0.68, 0.68]}
          >
            <PlushMaterial color="#F4C444" />
          </mesh>
        </group>
      </group>

      {/* Head group with long rounded forward-sloping dino snout */}
      <group ref={head} position={[0, 1.15, 0.04]}>
        {accessory && <Accessory3D accessory={accessory} animal="dino" slot="head" />}
        <mesh scale={[0.92, 0.96, 1.04]} castShadow receiveShadow>
          <sphereGeometry args={[0.39, 28, 24]} />
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
          <sphereGeometry args={[0.31, 24, 20]} />
          <PlushMaterial color="#86B850" />
        </mesh>

        {/* Warm cream lower snout/jaw flowing cleanly into chest */}
        <mesh
          position={[0, -0.17, 0.25]}
          rotation={[0.2, 0, 0]}
          scale={[0.86, 0.56, 1.12]}
          receiveShadow
        >
          <sphereGeometry args={[0.28, 22, 18]} />
          <PlushMaterial color="#EFE9BE" />
        </mesh>

        {/* Cute stitched dino smile seam along snout boundary */}
        {emotion === 'idle' && (
          <mesh position={[0, -0.11, 0.565]} rotation={[0.15, 0, Math.PI]} scale={[1.35, 0.65, 0.55]}>
            <torusGeometry args={[0.095, 0.008, 8, 18, Math.PI]} />
            <DetailMaterial color="#4D6E2A" roughness={0.65} />
          </mesh>
        )}
        {(emotion === 'happy' || emotion === 'win') && (
          <group position={[0, -0.125, 0.575]}>
            <mesh scale={[1.3, 0.78, 0.45]}>
              <sphereGeometry args={[0.058, 14, 10]} />
              <DetailMaterial color="#EB6B7A" roughness={0.45} />
            </mesh>
            <mesh position={[0, 0.02, 0.01]} rotation={[0.15, 0, Math.PI]} scale={[1.3, 0.65, 0.5]}>
              <torusGeometry args={[0.088, 0.009, 8, 16, Math.PI]} />
              <DetailMaterial color="#4D6E2A" roughness={0.55} />
            </mesh>
          </group>
        )}
        {emotion === 'sad' && (
          <mesh position={[0, -0.145, 0.565]} rotation={[0.12, 0, 0]} scale={[1.1, 0.6, 0.5]}>
            <torusGeometry args={[0.068, 0.0085, 8, 14, Math.PI]} />
            <DetailMaterial color="#4D6E2A" roughness={0.6} />
          </mesh>
        )}
        {emotion === 'shock' && (
          <mesh position={[0, -0.135, 0.585]} scale={[0.95, 1.05, 0.5]}>
            <torusGeometry args={[0.042, 0.011, 8, 16]} />
            <DetailMaterial color="#3A5420" roughness={0.5} />
          </mesh>
        )}

        {/* Two subtle nostril dots near tip of snout */}
        <mesh position={[-0.085, 0.01, 0.65]} scale={[0.85, 1.15, 0.6]}>
          <sphereGeometry args={[0.02, 10, 8]} />
          <DetailMaterial color="#4D6E2A" roughness={0.75} />
        </mesh>
        <mesh position={[0.085, 0.01, 0.65]} scale={[0.85, 1.15, 0.6]}>
          <sphereGeometry args={[0.02, 10, 8]} />
          <DetailMaterial color="#4D6E2A" roughness={0.75} />
        </mesh>

        {/* Sculpted beveled golden-yellow head crest plates */}
        <group ref={earLeft} position={[0, 0.35, 0.1]} rotation={[0.18, 0, 0]}>
          <mesh geometry={plateGeo} scale={[0.92, 0.92, 0.92]} castShadow receiveShadow>
            <PlushMaterial color="#F4C444" />
          </mesh>
        </group>
        <group ref={earRight} position={[0, 0.37, -0.06]} rotation={[-0.12, 0, 0]}>
          <mesh geometry={plateGeo} scale={[1.08, 1.12, 1.04]} castShadow receiveShadow>
            <PlushMaterial color="#F4C444" />
          </mesh>
        </group>
        <mesh
          geometry={plateGeo}
          position={[0, 0.27, -0.23]}
          rotation={[-0.55, 0, 0]}
          scale={[0.96, 0.96, 0.96]}
          castShadow
          receiveShadow
        >
          <PlushMaterial color="#F4C444" />
        </mesh>

        {/* Expressive glossy chill dino eyes with periodic blinking */}
        <PlushEyePair
          eyesRef={eyes}
          emotion={emotion}
          spread={0.255}
          y={0.12}
          z={0.27}
          rotY={0.44}
          variant="dinoChill"
          lidColor="#86B850"
          browColor="#4D6E2A"
        />

        {emotion === 'shock' && <PlushSweatDrop position={[0.31, 0.24, 0.22]} />}
      </group>
    </group>
  );
}
