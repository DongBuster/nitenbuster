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
  getSharkDorsalFinGeometry,
  getSharkGillsGeometry,
  getSharkHoodGeometry,
  getSharkTailFinGeometry,
  getSharkTeethGeometry,
} from '../plushCurves';
import { PlushEyePair, PlushSweatDrop } from '../plushDetails';

export function Shark3D({
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

  const hoodGeo = getSharkHoodGeometry();
  const dorsalFinGeo = getSharkDorsalFinGeometry();
  const tailFinGeo = getSharkTailFinGeometry();
  const teethGeo = getSharkTeethGeometry();
  const gillsGeo = getSharkGillsGeometry();
  const flipperGeo = getPlushArmGeometry(0.45, 0.115, 0.16);

  useAnimalMotion(
    { root, body, head, eyes, earLeft, earRight, armLeft, armRight, tail },
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
        <sphereGeometry args={[0.14, 18, 14]} />
        <PlushMaterial color="#5A7EA9" />
      </mesh>
      <mesh
        position={[0.22, 0.1, 0.04]}
        scale={[1.08, 0.82, 1.24]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.14, 18, 14]} />
        <PlushMaterial color="#5A7EA9" />
      </mesh>

      {/* Main plush shark body + seamless hood */}
      <group ref={body} position={[0, 0.11, 0]}>
        {accessory && <Accessory3D accessory={accessory} animal="shark" slot="body" />}
        <mesh
          geometry={hoodGeo}
          scale={[1.02, 1.0, 0.96]}
          castShadow
          receiveShadow
        >
          <PlushMaterial color="#678BB8" />
        </mesh>

        {/* Smooth cream-white belly shield */}
        <mesh
          position={[0, 0.36, 0.25]}
          scale={[0.37, 0.32, 0.31]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[1, 28, 22]} />
          <PlushMaterial color="#F6F4F0" />
        </mesh>

        {/* 3 sculpted gill slits on each flank (single merged draw call, no shadow) */}
        <mesh geometry={gillsGeo}>
          <DetailMaterial color="#405F85" roughness={0.78} />
        </mesh>

        {/* Chubby drooping plush side flippers */}
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

        {/* Sculpted swept-back plush dorsal fin */}
        <mesh
          geometry={dorsalFinGeo}
          position={[0, 0.96, -0.34]}
          scale={[1.0, 1.05, 1.05]}
          castShadow
          receiveShadow
        >
          <PlushMaterial color="#587BA6" />
        </mesh>

        {/* Sculpted plush tail stem + crescent caudal fin */}
        <group ref={tail} position={[0, 0.34, -0.36]}>
          <mesh
            position={[0, 0.03, -0.08]}
            rotation={[-0.25, 0, 0]}
            scale={[0.72, 0.78, 1.18]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.165, 18, 14]} />
            <PlushMaterial color="#678BB8" />
          </mesh>
          <mesh
            geometry={tailFinGeo}
            position={[0, 0.05, -0.18]}
            castShadow
            receiveShadow
          >
            <PlushMaterial color="#587BA6" />
          </mesh>
        </group>

        {/* Head & clearly visible arched shark mouth with merged 6 teeth & plush tongue */}
        <group ref={head} position={[0, 1.04, 0]}>
          {accessory && <Accessory3D accessory={accessory} animal="shark" slot="head" />}
          <group ref={earLeft} position={[-0.18, 0.32, 0]} />
          <group ref={earRight} position={[0.18, 0.32, 0]} />

          {/* Arched dusty-pink open shark mouth + cute tongue + merged row of 6 teeth */}
          <group position={[0, -0.24, 0.38]}>
            {/* Deep rose inner mouth */}
            <mesh
              position={[0, 0.0, 0.01]}
              scale={[0.255, 0.125 + mouthOpen * 1.4, 0.095]}
            >
              <sphereGeometry args={[1, 24, 18]} />
              <PlushMaterial color="#8E4752" roughness={0.94} />
            </mesh>
            {/* Soft plump pink plush tongue inside lower mouth */}
            <mesh
              position={[0, -0.052 - mouthOpen * 0.4, 0.048]}
              scale={[0.145, 0.055, 0.07]}
            >
              <sphereGeometry args={[1, 14, 10]} />
              <PlushMaterial color="#E87D8D" roughness={0.82} />
            </mesh>
            {/* Subtle soft plush upper lip rim */}
            <mesh position={[0, 0.075, 0.065]} rotation={[0.25, 0, 0]} scale={[1.15, 0.55, 0.6]}>
              <torusGeometry args={[0.2, 0.022, 10, 20, Math.PI]} />
              <PlushMaterial color="#5D81AD" />
            </mesh>
            {/* Single draw-call merged row of 6 white triangular plush teeth */}
            <mesh geometry={teethGeo}>
              <PlushMaterial color="#FFFFFF" roughness={0.72} />
            </mesh>
          </group>

          {/* Glossy side-set shark eyes with periodic blinking */}
          <PlushEyePair
            eyesRef={eyes}
            emotion={emotion}
            spread={0.285}
            y={0.14}
            z={0.21}
            rotY={0.72}
            scale={0.95}
            variant="tallBead"
            browColor="#3B5578"
          />

          {emotion === 'shock' && <PlushSweatDrop position={[0.31, 0.32, 0.18]} scale={0.95} />}
        </group>
      </group>
    </group>
  );
}
