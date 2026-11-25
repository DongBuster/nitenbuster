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
} from '../plushMaterial';
import {
  PlushCheekBlush,
  PlushEyePair,
  PlushPawPad,
  PlushSmileMouth,
  PlushSweatDrop,
} from '../plushDetails';

export function Panda3D({
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

  const pearGeo = getPearBodyGeometry(0.51, 1.02);

  useAnimalMotion(
    { root, body, head, eyes, earLeft, earRight, armLeft, armRight, tail },
    emotion,
    isActive,
  );

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} color="#3E3835" />

      {/* Stout dark charcoal-brown legs resting flat at y = 0 + merged pink paw pads */}
      {([-1, 1] as const).map((side) => (
        <group key={`foot-${side}`} position={[side * 0.22, 0.14, 0.03]}>
          <mesh scale={[1.12, 1.02, 1.2]} castShadow receiveShadow>
            <sphereGeometry args={[0.165, 20, 16]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
          <PlushPawPad
            position={[0, -0.02, 0.19]}
            rotation={[-0.12, 0, 0]}
            scale={0.95}
            color="#E8A2AE"
          />
        </group>
      ))}

      {/* Wide ultra-fluffy pear-shaped body group */}
      <group ref={body} position={[0, 0.15, 0]}>
        {accessory && <Accessory3D accessory={accessory} animal="panda" slot="body" />}
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
          <sphereGeometry args={[0.46, 24, 18]} />
          <PlushMaterial color="#3E3835" />
        </mesh>

        {/* Thick smooth dark charcoal shoulder/chest band */}
        <mesh
          position={[0, 0.74, 0]}
          scale={[0.47, 0.24, 0.45]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[1, 28, 22]} />
          <PlushMaterial color="#3E3835" />
        </mesh>

        {/* Left chubby dark arm wrapping organically from shoulder around chest */}
        <group
          ref={armLeft}
          position={[-0.31, 0.68, 0.08]}
          rotation={[0.04, 0.16, -0.08]}
        >
          <mesh scale={[1.0, 0.96, 1.05]} castShadow receiveShadow>
            <sphereGeometry args={[0.145, 18, 14]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
          <mesh
            position={[-0.04, -0.05, 0.14]}
            rotation={[Math.PI / 2 - 0.18, 0, -0.22]}
            castShadow
            receiveShadow
          >
            <capsuleGeometry args={[0.132, 0.16, 10, 14]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
          <mesh
            position={[0.2, -0.09, 0.26]}
            rotation={[0, 0.12, Math.PI / 2 - 0.1]}
            castShadow
            receiveShadow
          >
            <capsuleGeometry args={[0.132, 0.26, 10, 16]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
        </group>

        {/* Right chubby dark arm wrapping organically & overlapping left paw */}
        <group
          ref={armRight}
          position={[0.31, 0.68, 0.08]}
          rotation={[0.04, -0.16, 0.08]}
        >
          <mesh scale={[1.0, 0.96, 1.05]} castShadow receiveShadow>
            <sphereGeometry args={[0.145, 18, 14]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
          <mesh
            position={[0.04, -0.04, 0.16]}
            rotation={[Math.PI / 2 - 0.14, 0, 0.22]}
            castShadow
            receiveShadow
          >
            <capsuleGeometry args={[0.132, 0.18, 10, 14]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
          <mesh
            position={[-0.2, -0.07, 0.29]}
            rotation={[0, -0.12, Math.PI / 2 + 0.1]}
            castShadow
            receiveShadow
          >
            <capsuleGeometry args={[0.136, 0.26, 10, 16]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
        </group>

        {/* Cute round cream-white puff tail */}
        <group ref={tail} position={[0, 0.22, -0.45]}>
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.13, 16, 14]} />
            <PlushMaterial color="#F6F3EC" />
          </mesh>
        </group>
      </group>

      {/* Smooth round white panda head */}
      <group ref={head} position={[0, 1.15, 0.02]}>
        {accessory && <Accessory3D accessory={accessory} animal="panda" slot="head" />}
        <mesh scale={[1.08, 0.94, 0.96]} castShadow receiveShadow>
          <sphereGeometry args={[0.47, 30, 26]} />
          <PlushMaterial color="#F6F3EC" />
        </mesh>

        {/* Soft puffy white snout muzzle pad */}
        <mesh
          position={[0, -0.04, 0.36]}
          scale={[1.1, 0.85, 0.78]}
          receiveShadow
        >
          <sphereGeometry args={[0.165, 20, 16]} />
          <PlushMaterial color="#F6F3EC" />
        </mesh>

        {/* Contoured tilted oval dark charcoal eye patches */}
        <mesh
          position={[-0.205, 0.058, 0.378]}
          rotation={[0.06, -0.36, 0.42]}
          scale={[1.26, 0.9, 0.32]}
        >
          <sphereGeometry args={[0.134, 20, 16]} />
          <PlushMaterial color="#3E3835" />
        </mesh>
        <mesh
          position={[0.205, 0.058, 0.378]}
          rotation={[0.06, 0.36, -0.42]}
          scale={[1.26, 0.9, 0.32]}
        >
          <sphereGeometry args={[0.134, 20, 16]} />
          <PlushMaterial color="#3E3835" />
        </mesh>

        {/* Round dark ears with subtle soft inner-ear depth */}
        <group ref={earLeft} position={[-0.35, 0.37, -0.02]}>
          <mesh scale={[1.0, 1.0, 0.68]} castShadow receiveShadow>
            <sphereGeometry args={[0.145, 20, 16]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
          <mesh position={[0.012, -0.008, 0.078]} scale={[0.58, 0.58, 0.3]}>
            <sphereGeometry args={[0.12, 12, 10]} />
            <PlushMaterial color="#584E49" />
          </mesh>
        </group>

        <group ref={earRight} position={[0.35, 0.37, -0.02]}>
          <mesh scale={[1.0, 1.0, 0.68]} castShadow receiveShadow>
            <sphereGeometry args={[0.145, 20, 16]} />
            <PlushMaterial color="#3E3835" />
          </mesh>
          <mesh position={[-0.012, -0.008, 0.078]} scale={[0.58, 0.58, 0.3]}>
            <sphereGeometry args={[0.12, 12, 10]} />
            <PlushMaterial color="#584E49" />
          </mesh>
        </group>

        {/* Glossy dark bead eyes nestled inside patches with periodic blinking */}
        <PlushEyePair
          eyesRef={eyes}
          emotion={emotion}
          spread={0.165}
          y={0.065}
          z={0.455}
          rotY={0.22}
          scale={0.94}
          variant="bead"
          happyColor="#F6F3EC"
          browColor="#F6F3EC"
        />

        {/* Delicate rosy cheek blush */}
        <PlushCheekBlush
          emotion={emotion}
          spread={0.305}
          y={-0.055}
          z={0.36}
          rotY={0.35}
          color="#F59FB0"
        />

        {/* Glossy dark triangular-oval panda nose */}
        <mesh position={[0, 0.005, 0.495]} scale={[1.38, 0.85, 0.7]}>
          <sphereGeometry args={[0.04, 16, 14]} />
          <GlossyMaterial color="#211B18" roughness={0.12} clearcoat={0.95} />
        </mesh>

        {emotion === 'shock' && <PlushSweatDrop position={[0.34, 0.22, 0.35]} />}

        {/* Cute stitched panda `:3` mouth */}
        <PlushSmileMouth
          emotion={emotion}
          position={[0, -0.065, 0.485]}
          stitchColor="#3A2F2A"
          scale={0.9}
        />
      </group>
    </group>
  );
}
