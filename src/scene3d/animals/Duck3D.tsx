import { useRef } from 'react';
import type * as THREE from 'three';
import {
  TurnRing3D,
  useAnimalMotion,
  type Animal3DProps,
} from '../CharacterRig3D';
import { Accessory3D } from '../Accessory3D';
import {
  DetailMaterial,
  KeratinMaterial,
  PlushMaterial,
  getPearBodyGeometry,
  getPlushArmGeometry,
} from '../plushMaterial';
import { getDuckBillGeometry } from '../plushCurves';
import {
  PlushCheekBlush,
  PlushEyePair,
  PlushSweatDrop,
} from '../plushDetails';

export function Duck3D({
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

  useAnimalMotion(
    { root, body, head, eyes, earLeft, earRight, armLeft, armRight, tail },
    emotion,
    isActive,
  );

  const billOpen = emotion === 'shock' || emotion === 'happy' || emotion === 'win';
  const pearGeo = getPearBodyGeometry(0.55, 1.02);
  const wingGeo = getPlushArmGeometry(0.42, 0.105, 0.15);
  const billGeo = getDuckBillGeometry();

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} />

      {/* Ultra-plump seamless creamy-white pear duck */}
      <group ref={body} position={[0, 0.47, 0]}>
        {accessory && <Accessory3D accessory={accessory} animal="duck" slot="body" />}
        <mesh geometry={pearGeo} position={[0, -0.39, 0]} castShadow receiveShadow>
          <PlushMaterial color="#FAF5EC" />
        </mesh>

        {/* Smooth glossy-keratin 3-toed webbed feet resting squarely at y=0 */}
        {([-1, 1] as const).map((side) => (
          <group key={`foot-${side}`} position={[side * 0.18, -0.43, 0.07]} rotation={[0, -side * 0.14, 0]}>
            <mesh scale={[0.16, 0.044, 0.195]} castShadow receiveShadow>
              <sphereGeometry args={[1, 18, 12]} />
              <KeratinMaterial color="#F58B16" roughness={0.32} />
            </mesh>
            <mesh position={[-0.082, -0.004, 0.115]} rotation={[0, 0.32, 0]} scale={[0.048, 0.036, 0.095]}>
              <sphereGeometry args={[1, 10, 8]} />
              <KeratinMaterial color="#F58B16" roughness={0.32} />
            </mesh>
            <mesh position={[0, -0.004, 0.13]} scale={[0.048, 0.036, 0.098]}>
              <sphereGeometry args={[1, 10, 8]} />
              <KeratinMaterial color="#F58B16" roughness={0.32} />
            </mesh>
            <mesh position={[0.082, -0.004, 0.115]} rotation={[0, -0.32, 0]} scale={[0.048, 0.036, 0.095]}>
              <sphereGeometry args={[1, 10, 8]} />
              <KeratinMaterial color="#F58B16" roughness={0.32} />
            </mesh>
          </group>
        ))}

        {/* Chunky plush side wings with subtle layered feather tip */}
        <group ref={armLeft} position={[-0.42, 0.18, 0.04]} rotation={[0.08, 0.12, -0.42]}>
          <mesh geometry={wingGeo} scale={[0.82, 1.0, 0.95]} castShadow receiveShadow>
            <PlushMaterial color="#FAF5EC" />
          </mesh>
          <mesh position={[-0.04, -0.3, -0.05]} rotation={[0.25, 0, -0.18]} scale={[0.075, 0.13, 0.095]}>
            <sphereGeometry args={[1, 12, 10]} />
            <PlushMaterial color="#F3ECE0" />
          </mesh>
        </group>

        <group ref={armRight} position={[0.42, 0.18, 0.04]} rotation={[0.08, -0.12, 0.42]}>
          <mesh geometry={wingGeo} scale={[0.82, 1.0, 0.95]} castShadow receiveShadow>
            <PlushMaterial color="#FAF5EC" />
          </mesh>
          <mesh position={[0.04, -0.3, -0.05]} rotation={[0.25, 0, 0.18]} scale={[0.075, 0.13, 0.095]}>
            <sphereGeometry args={[1, 12, 10]} />
            <PlushMaterial color="#F3ECE0" />
          </mesh>
        </group>

        {/* Cute upturned layered white duck tail */}
        <group ref={tail} position={[0, -0.08, -0.42]}>
          <mesh position={[0, 0.05, -0.08]} rotation={[-0.85, 0, 0]} scale={[0.9, 1.0, 0.7]} castShadow receiveShadow>
            <coneGeometry args={[0.14, 0.26, 16]} />
            <PlushMaterial color="#FAF5EC" />
          </mesh>
          <mesh position={[0, 0.11, -0.09]} rotation={[-0.55, 0, 0]} scale={[0.68, 0.85, 0.56]}>
            <coneGeometry args={[0.1, 0.18, 12]} />
            <PlushMaterial color="#F5EFE4" />
          </mesh>
        </group>

        {/* Smoothly integrated, slightly tilted oval duck head */}
        <group ref={head} position={[0, 0.56, 0.02]} rotation={[0, 0, -0.06]}>
          {accessory && <Accessory3D accessory={accessory} animal="duck" slot="head" />}
          <mesh position={[0, -0.14, -0.01]} scale={[0.35, 0.28, 0.34]} receiveShadow>
            <sphereGeometry args={[1, 22, 18]} />
            <PlushMaterial color="#FAF5EC" />
          </mesh>

          <mesh position={[0, 0.08, 0]} castShadow receiveShadow scale={[0.94, 0.98, 0.94]}>
            <sphereGeometry args={[0.41, 28, 24]} />
            <PlushMaterial color="#FAF5EC" />
          </mesh>

          {/* Lively 3-strand curved cowlick tuft on crown */}
          <group ref={earLeft} position={[0.04, 0.455, -0.01]} rotation={[-0.1, 0, -0.32]}>
            <mesh position={[0, 0.088, 0]} scale={[0.72, 1.05, 0.66]} castShadow receiveShadow>
              <capsuleGeometry args={[0.05, 0.11, 8, 12]} />
              <PlushMaterial color="#FAF5EC" />
            </mesh>
            <mesh position={[-0.045, 0.055, 0.025]} rotation={[0.18, 0, 0.32]} scale={[0.62, 0.9, 0.6]}>
              <capsuleGeometry args={[0.036, 0.075, 6, 10]} />
              <PlushMaterial color="#FAF5EC" />
            </mesh>
          </group>
          <group ref={earRight} position={[0.12, 0.43, -0.03]} rotation={[-0.18, 0, -0.7]}>
            <mesh position={[0, 0.055, 0]} scale={[0.66, 1.0, 0.62]} castShadow receiveShadow>
              <capsuleGeometry args={[0.038, 0.072, 8, 10]} />
              <PlushMaterial color="#FAF5EC" />
            </mesh>
          </group>

          {/* Sculpted wide plump orange duck bill with keratin gloss */}
          <group position={[0, -0.005, 0.33]}>
            <mesh
              geometry={billGeo}
              position={[0, billOpen ? 0.04 : 0.018, 0.06]}
              rotation={[billOpen ? -0.18 : 0.1, 0, 0]}
              scale={[1.04, 0.85, 0.92]}
              castShadow
              receiveShadow
            >
              <KeratinMaterial color="#FA9A1C" roughness={0.28} />
            </mesh>
            {/* Subtle nostrils along bill bridge */}
            <mesh position={[-0.062, 0.064, 0.155]} scale={[0.012, 0.008, 0.018]}>
              <sphereGeometry args={[1, 8, 8]} />
              <DetailMaterial color="#B85D0A" roughness={0.5} />
            </mesh>
            <mesh position={[0.062, 0.064, 0.155]} scale={[0.012, 0.008, 0.018]}>
              <sphereGeometry args={[1, 8, 8]} />
              <DetailMaterial color="#B85D0A" roughness={0.5} />
            </mesh>
            {/* Lower rounded duck bill lip */}
            <mesh
              position={[0, billOpen ? -0.068 : -0.034, 0.115]}
              rotation={[billOpen ? 0.32 : 0.1, 0, 0]}
              scale={[0.245, 0.064, 0.205]}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[1, 20, 14]} />
              <KeratinMaterial color="#E67E10" roughness={0.34} />
            </mesh>
            {billOpen && (
              <mesh position={[0, -0.012, 0.1]} scale={[0.145, 0.052, 0.12]}>
                <sphereGeometry args={[1, 12, 10]} />
                <DetailMaterial color="#E04F5F" roughness={0.45} />
              </mesh>
            )}
          </group>

          {/* Glossy dark vertical-oval duck eyes with periodic blinking */}
          <PlushEyePair
            eyesRef={eyes}
            emotion={emotion}
            spread={0.125}
            y={0.165}
            z={0.365}
            scale={0.95}
            variant="tallBead"
            browColor="#5A4230"
          />

          {/* Warm peach cheek blush */}
          <PlushCheekBlush
            emotion={emotion}
            spread={0.255}
            y={0.075}
            z={0.295}
            rotY={0.42}
            color="#FFA48E"
            scale={0.9}
          />

          {emotion === 'shock' && <PlushSweatDrop position={[0.26, 0.28, 0.3]} scale={0.95} />}
        </group>
      </group>
    </group>
  );
}
