import { useRef } from 'react';
import type * as THREE from 'three';
import {
  TurnRing3D,
  useAnimalMotion,
  type Animal3DProps,
} from '../CharacterRig3D';
import { Accessory3D } from '../Accessory3D';
import {
  GlossyMaterial,
  PlushMaterial,
  getPearBodyGeometry,
  getPlushArmGeometry,
} from '../plushMaterial';
import {
  getFloppyBunnyEarGeometry,
  getUprightBunnyEarGeometry,
} from '../plushCurves';
import {
  PlushCheekBlush,
  PlushEyePair,
  PlushPawPad,
  PlushSmileMouth,
  PlushSweatDrop,
} from '../plushDetails';

export function Rabbit3D({
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

  const pearGeo = getPearBodyGeometry(0.47, 0.92);
  const armGeo = getPlushArmGeometry(0.39, 0.105, 0.145);
  const uprightEarGeo = getUprightBunnyEarGeometry();
  const floppyEarGeo = getFloppyBunnyEarGeometry();

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} />

      {/* Ultra-fluffy snowy-white chubby pear bunny body */}
      <group ref={body} position={[0, 0.45, 0]}>
        {accessory && <Accessory3D accessory={accessory} animal="bunny" slot="body" />}
        <mesh geometry={pearGeo} position={[0, -0.37, 0]} castShadow receiveShadow>
          <PlushMaterial color="#FAF5F0" />
        </mesh>

        {/* Smooth plush neck bridge filling waist crease into head */}
        <mesh position={[0, 0.37, 0.01]} scale={[0.35, 0.24, 0.34]} receiveShadow>
          <sphereGeometry args={[1, 22, 18]} />
          <PlushMaterial color="#FAF5F0" />
        </mesh>

        {/* Short white plush feet resting squarely at y=0 + merged pink paw pads */}
        {([-1, 1] as const).map((side) => (
          <group key={`foot-${side}`} position={[side * 0.2, -0.37, 0.07]}>
            <mesh scale={[0.155, 0.088, 0.2]} castShadow receiveShadow>
              <sphereGeometry args={[1, 18, 14]} />
              <PlushMaterial color="#FAF5F0" />
            </mesh>
            <PlushPawPad
              position={[0, -0.005, 0.19]}
              rotation={[-0.18, 0, 0]}
              scale={0.84}
              color="#F4B2BE"
            />
          </group>
        ))}

        {/* Chunky white bunny arms */}
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

        {/* Fluffy round multi-puff cotton-ball tail in back */}
        <group ref={tail} position={[0, -0.16, -0.4]}>
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.155, 18, 16]} />
            <PlushMaterial color="#FAF5F0" />
          </mesh>
          <mesh position={[0.065, 0.055, -0.04]}>
            <sphereGeometry args={[0.092, 12, 10]} />
            <PlushMaterial color="#FAF5F0" />
          </mesh>
          <mesh position={[-0.065, 0.045, -0.04]}>
            <sphereGeometry args={[0.092, 12, 10]} />
            <PlushMaterial color="#FAF5F0" />
          </mesh>
          <mesh position={[0, 0.09, -0.05]}>
            <sphereGeometry args={[0.082, 12, 10]} />
            <PlushMaterial color="#FFFDF9" />
          </mesh>
        </group>

        {/* Fluffy rounded bunny head with seamless plump cheeks */}
        <group ref={head} position={[0, 0.56, 0.02]}>
          {accessory && <Accessory3D accessory={accessory} animal="bunny" slot="head" />}
          <mesh position={[0, 0.03, 0]} castShadow receiveShadow scale={[0.98, 0.96, 0.95]}>
            <sphereGeometry args={[0.45, 30, 26]} />
            <PlushMaterial color="#FAF5F0" />
          </mesh>

          <mesh position={[0, -0.09, 0.03]} castShadow receiveShadow scale={[1.08, 0.74, 0.96]}>
            <sphereGeometry args={[0.44, 28, 22]} />
            <PlushMaterial color="#FAF5F0" />
          </mesh>

          {/* Subtle blended muzzle fullness */}
          <mesh position={[-0.085, -0.085, 0.36]} scale={[0.105, 0.085, 0.08]}>
            <sphereGeometry args={[1, 16, 14]} />
            <PlushMaterial color="#FAF5F0" />
          </mesh>
          <mesh position={[0.085, -0.085, 0.36]} scale={[0.105, 0.085, 0.08]}>
            <sphereGeometry args={[1, 16, 14]} />
            <PlushMaterial color="#FAF5F0" />
          </mesh>

          {/* Glossy pink triangular bunny nose */}
          <mesh position={[0, -0.01, 0.455]} rotation={[0, 0, Math.PI]} scale={[1.2, 0.9, 0.7]}>
            <coneGeometry args={[0.032, 0.038, 12]} />
            <GlossyMaterial color="#F29CAA" roughness={0.18} clearcoat={0.85} />
          </mesh>

          {/* Left upright tapered plush ear with blush-pink inner hollow */}
          <group ref={earLeft} position={[-0.16, 0.38, -0.01]} rotation={[0.04, 0.08, 0.2]}>
            <mesh geometry={uprightEarGeo} castShadow receiveShadow>
              <PlushMaterial color="#FAF5F0" />
            </mesh>
            <mesh
              geometry={uprightEarGeo}
              position={[0, 0.04, 0.03]}
              scale={[0.56, 0.78, 0.45]}
            >
              <PlushMaterial color="#F4B5BE" />
            </mesh>
          </group>

          {/* Right playfully flopped tapered plush ear for irresistible character */}
          <group ref={earRight} position={[0.16, 0.38, -0.01]} rotation={[0.04, -0.08, -0.14]}>
            <mesh geometry={floppyEarGeo} castShadow receiveShadow>
              <PlushMaterial color="#FAF5F0" />
            </mesh>
            <mesh
              geometry={floppyEarGeo}
              position={[0.005, 0.04, 0.032]}
              scale={[0.56, 0.78, 0.45]}
            >
              <PlushMaterial color="#F4B5BE" />
            </mesh>
          </group>

          {/* Glossy dark wide-set bunny eyes with periodic blinking */}
          <PlushEyePair
            eyesRef={eyes}
            emotion={emotion}
            spread={0.185}
            y={0.065}
            z={0.395}
            rotY={0.18}
            scale={0.94}
            variant="bead"
            browColor="#7A655E"
          />

          {/* Soft pastel pink bunny cheek blush */}
          <PlushCheekBlush
            emotion={emotion}
            spread={0.285}
            y={-0.04}
            z={0.355}
            rotY={0.34}
            color="#FFA8BC"
          />

          {emotion === 'shock' && <PlushSweatDrop position={[0.31, 0.22, 0.34]} scale={0.95} />}

          {/* Cute bunny `Y`/`w` mouth with tiny buck-tooth peek on happy/win */}
          <PlushSmileMouth
            emotion={emotion}
            position={[0, -0.085, 0.45]}
            stitchColor="#8E756D"
            scale={0.92}
            bunnyTooth
          />
        </group>
      </group>
    </group>
  );
}
