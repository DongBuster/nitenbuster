import { useRef } from 'react';
import * as THREE from 'three';
import {
  TurnRing3D,
  useAnimalMotion,
  type Animal3DProps,
} from '../CharacterRig3D';
import { Accessory3D } from '../Accessory3D';
import {
  DetailMaterial,
  GlossyMaterial,
  PlushMaterial,
  getPearBodyGeometry,
  getPlushArmGeometry,
} from '../plushMaterial';
import {
  PlushCheekBlush,
  PlushEyePair,
  PlushPawPad,
  PlushSmileMouth,
  PlushSweatDrop,
} from '../plushDetails';

let cachedCorgiOuterEar: THREE.ExtrudeGeometry | null = null;
let cachedCorgiInnerEar: THREE.ExtrudeGeometry | null = null;

function getCorgiEarGeometries() {
  if (!cachedCorgiOuterEar) {
    const outer = new THREE.Shape();
    outer.moveTo(-0.17, 0);
    outer.quadraticCurveTo(-0.16, 0.22, -0.04, 0.36);
    outer.quadraticCurveTo(0, 0.41, 0.04, 0.36);
    outer.quadraticCurveTo(0.16, 0.22, 0.17, 0);
    outer.quadraticCurveTo(0, -0.04, -0.17, 0);

    cachedCorgiOuterEar = new THREE.ExtrudeGeometry(outer, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 4,
      curveSegments: 16,
    });
    cachedCorgiOuterEar.translate(0, 0, -0.0225);
    cachedCorgiOuterEar.computeVertexNormals();
  }

  if (!cachedCorgiInnerEar) {
    const inner = new THREE.Shape();
    inner.moveTo(-0.105, 0.03);
    inner.quadraticCurveTo(-0.1, 0.19, -0.025, 0.29);
    inner.quadraticCurveTo(0, 0.32, 0.025, 0.29);
    inner.quadraticCurveTo(0.1, 0.19, 0.105, 0.03);
    inner.quadraticCurveTo(0, 0.01, -0.105, 0.03);

    cachedCorgiInnerEar = new THREE.ExtrudeGeometry(inner, {
      depth: 0.024,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 3,
      curveSegments: 14,
    });
    cachedCorgiInnerEar.translate(0, 0, -0.012);
    cachedCorgiInnerEar.computeVertexNormals();
  }

  return { outerEar: cachedCorgiOuterEar, innerEar: cachedCorgiInnerEar };
}

export function Dog3D({
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

  const pearGeo = getPearBodyGeometry(0.49, 0.92);
  const armLeftGeo = getPlushArmGeometry(0.38, 0.11, 0.145);
  const armRightGeo = getPlushArmGeometry(0.4, 0.11, 0.145);
  const { outerEar, innerEar } = getCorgiEarGeometries();

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} />

      {/* Stout chubby orange-and-white Corgi plush body */}
      <group ref={body} position={[0, 0.45, 0]}>
        {accessory && <Accessory3D accessory={accessory} animal="dog" slot="body" />}
        <mesh geometry={pearGeo} position={[0, -0.37, 0]} castShadow receiveShadow>
          <PlushMaterial color="#E89541" />
        </mesh>

        {/* Smooth cream-white belly & fluffy chest ruff */}
        <mesh position={[0, -0.04, 0.27]} scale={[0.37, 0.39, 0.27]} castShadow receiveShadow>
          <sphereGeometry args={[1, 28, 22]} />
          <PlushMaterial color="#FAF1E2" />
        </mesh>
        <mesh position={[0, 0.22, 0.32]} scale={[0.28, 0.14, 0.16]} receiveShadow>
          <sphereGeometry args={[1, 20, 14]} />
          <PlushMaterial color="#FDF6EA" />
        </mesh>

        {/* Thick red plush collar clearly visible below chin */}
        <mesh position={[0, 0.28, 0.04]} rotation={[Math.PI / 2 + 0.14, 0, 0]} castShadow receiveShadow>
          <torusGeometry args={[0.375, 0.048, 16, 32]} />
          <PlushMaterial color="#D43628" roughness={0.82} />
        </mesh>

        {/* Bright gold 3D bone charm hanging cleanly in front of chest */}
        <group position={[0, 0.17, 0.51]} rotation={[0.08, 0, 0]}>
          <mesh position={[0, 0.072, -0.015]}>
            <torusGeometry args={[0.028, 0.009, 8, 14]} />
            <DetailMaterial color="#F5C438" roughness={0.18} metalness={0.78} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.03, 0.1, 8, 14]} />
            <DetailMaterial color="#F5C438" roughness={0.18} metalness={0.78} />
          </mesh>
          {[
            [-0.068, 0.026],
            [-0.068, -0.026],
            [0.068, 0.026],
            [0.068, -0.026],
          ].map(([bx, by], idx) => (
            <mesh key={idx} position={[bx, by, 0]}>
              <sphereGeometry args={[0.032, 12, 10]} />
              <DetailMaterial color="#F5C438" roughness={0.18} metalness={0.78} />
            </mesh>
          ))}
        </group>

        {/* Short stout white Corgi feet resting squarely at y=0 + merged paw pads */}
        {([-1, 1] as const).map((side) => (
          <group key={`foot-${side}`} position={[side * 0.22, -0.37, 0.06]}>
            <mesh scale={[0.16, 0.088, 0.2]} castShadow receiveShadow>
              <sphereGeometry args={[1, 20, 16]} />
              <PlushMaterial color="#FAF1E2" />
            </mesh>
            <PlushPawPad
              position={[0, -0.005, 0.19]}
              rotation={[-0.18, 0, 0]}
              scale={0.85}
              color="#EAB3A8"
            />
          </group>
        ))}

        {/* Dog's right arm (viewer's left): raised playfully with visible paw pad */}
        <group ref={armLeft} position={[-0.41, 0.18, 0.18]} rotation={[-0.68, 0.28, -0.25]}>
          <mesh geometry={armLeftGeo} castShadow receiveShadow>
            <PlushMaterial color="#E89541" />
          </mesh>
          <mesh position={[0, -0.36, 0]} scale={[0.145, 0.135, 0.145]} castShadow receiveShadow>
            <sphereGeometry args={[1, 18, 14]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>
          <PlushPawPad
            position={[0.02, -0.37, 0.125]}
            rotation={[0.25, 0.15, 0]}
            scale={0.78}
            color="#EAB3A8"
          />
        </group>

        {/* Dog's left arm (viewer's right): protruding cleanly outside right hip */}
        <group ref={armRight} position={[0.42, 0.18, 0.08]} rotation={[0.15, -0.08, 0.38]}>
          <mesh geometry={armRightGeo} castShadow receiveShadow>
            <PlushMaterial color="#E89541" />
          </mesh>
          <mesh position={[0, -0.38, 0]} scale={[0.145, 0.135, 0.145]} castShadow receiveShadow>
            <sphereGeometry args={[1, 18, 14]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>
        </group>

        {/* Fluffy plump Corgi nub tail */}
        <group ref={tail} position={[0, -0.14, -0.4]}>
          <mesh position={[0, 0.06, -0.08]} rotation={[-0.65, 0, 0]} castShadow receiveShadow>
            <capsuleGeometry args={[0.1, 0.14, 10, 14]} />
            <PlushMaterial color="#E89541" />
          </mesh>
          <mesh position={[0, 0.13, -0.15]} castShadow receiveShadow>
            <sphereGeometry args={[0.105, 16, 12]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>
          <mesh position={[-0.05, 0.11, -0.13]}>
            <sphereGeometry args={[0.072, 12, 10]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>
          <mesh position={[0.05, 0.11, -0.13]}>
            <sphereGeometry args={[0.072, 12, 10]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>
        </group>

        {/* Faithful Corgi plush head */}
        <group ref={head} position={[0, 0.65, 0.02]}>
          {accessory && <Accessory3D accessory={accessory} animal="dog" slot="head" />}
          <mesh castShadow receiveShadow scale={[1.08, 0.94, 0.96]}>
            <sphereGeometry args={[0.48, 30, 26]} />
            <PlushMaterial color="#E89541" />
          </mesh>

          {/* Clean white forehead blaze running smoothly from crown down into muzzle */}
          <mesh position={[0, 0.16, 0.39]} rotation={[0.28, 0, 0]} scale={[0.105, 0.27, 0.09]}>
            <sphereGeometry args={[1, 20, 16]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>

          {/* Signature Corgi cream-tan eyebrow dots */}
          {([-1, 1] as const).map((side) => (
            <mesh
              key={`brow-${side}`}
              position={[side * 0.15, 0.205, 0.425]}
              rotation={[-0.25, side * 0.2, -side * 0.18]}
              scale={[0.052, 0.032, 0.022]}
            >
              <sphereGeometry args={[1, 12, 10]} />
              <PlushMaterial color="#FCE9CA" />
            </mesh>
          ))}

          {/* Soft blended cream-white Corgi muzzle & cheek cushion */}
          <mesh position={[0, -0.1, 0.34]} scale={[0.37, 0.22, 0.19]} receiveShadow>
            <sphereGeometry args={[1, 24, 18]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>
          <mesh position={[-0.1, -0.11, 0.41]} scale={[0.125, 0.095, 0.09]}>
            <sphereGeometry args={[1, 18, 14]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>
          <mesh position={[0.1, -0.11, 0.41]} scale={[0.125, 0.095, 0.09]}>
            <sphereGeometry args={[1, 18, 14]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>

          {/* Wet glossy dark oval Corgi puppy nose */}
          <mesh position={[0, -0.015, 0.51]} scale={[1.32, 0.94, 0.78]}>
            <sphereGeometry args={[0.062, 18, 16]} />
            <GlossyMaterial color="#231B17" roughness={0.1} clearcoat={1.0} />
          </mesh>

          {/* Smooth bezier-curved rounded-triangle Corgi ears */}
          <group ref={earLeft} position={[-0.29, 0.33, 0.02]} rotation={[0.08, 0.18, 0.26]}>
            <mesh geometry={outerEar} castShadow receiveShadow>
              <PlushMaterial color="#E89541" />
            </mesh>
            <mesh geometry={innerEar} position={[0, 0, 0.032]}>
              <PlushMaterial color="#F1AE96" />
            </mesh>
          </group>

          <group ref={earRight} position={[0.29, 0.33, 0.02]} rotation={[0.08, -0.18, -0.26]}>
            <mesh geometry={outerEar} castShadow receiveShadow>
              <PlushMaterial color="#E89541" />
            </mesh>
            <mesh geometry={innerEar} position={[0, 0, 0.032]}>
              <PlushMaterial color="#F1AE96" />
            </mesh>
          </group>

          {/* Glass-bead blinking Corgi eyes */}
          <PlushEyePair
            eyesRef={eyes}
            emotion={emotion}
            spread={0.145}
            y={0.105}
            z={0.455}
            variant="bead"
            browColor="#5C3F28"
          />

          {/* Soft rosy cheek blush */}
          <PlushCheekBlush
            emotion={emotion}
            spread={0.275}
            y={-0.015}
            z={0.395}
            color="#F59AA8"
          />

          {emotion === 'shock' && <PlushSweatDrop position={[0.3, 0.23, 0.37]} />}

          {/* Stitched `:3` happy Corgi mouth */}
          <PlushSmileMouth
            emotion={emotion}
            position={[0, -0.11, 0.495]}
            stitchColor="#6B5242"
          />
        </group>
      </group>
    </group>
  );
}
