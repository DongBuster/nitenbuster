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
  getCatForeheadStripesGeometry,
  getCatTailGeometry,
  getCatWhiskersGeometry,
} from '../plushCurves';
import {
  PlushCheekBlush,
  PlushEyePair,
  PlushPawPad,
  PlushSmileMouth,
  PlushSweatDrop,
} from '../plushDetails';

let cachedCatOuterEar: THREE.ExtrudeGeometry | null = null;
let cachedCatInnerEar: THREE.ExtrudeGeometry | null = null;

function getCatEarGeometries() {
  if (!cachedCatOuterEar) {
    const outer = new THREE.Shape();
    outer.moveTo(-0.14, 0);
    outer.quadraticCurveTo(-0.13, 0.15, -0.035, 0.24);
    outer.quadraticCurveTo(0, 0.275, 0.035, 0.24);
    outer.quadraticCurveTo(0.13, 0.15, 0.14, 0);
    outer.quadraticCurveTo(0, -0.03, -0.14, 0);

    cachedCatOuterEar = new THREE.ExtrudeGeometry(outer, {
      depth: 0.042,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 4,
      curveSegments: 16,
    });
    cachedCatOuterEar.translate(0, 0, -0.021);
    cachedCatOuterEar.computeVertexNormals();
  }

  if (!cachedCatInnerEar) {
    const inner = new THREE.Shape();
    inner.moveTo(-0.085, 0.025);
    inner.quadraticCurveTo(-0.08, 0.13, -0.022, 0.19);
    inner.quadraticCurveTo(0, 0.215, 0.022, 0.19);
    inner.quadraticCurveTo(0.08, 0.13, 0.085, 0.025);
    inner.quadraticCurveTo(0, 0.01, -0.085, 0.025);

    cachedCatInnerEar = new THREE.ExtrudeGeometry(inner, {
      depth: 0.022,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 3,
      curveSegments: 14,
    });
    cachedCatInnerEar.translate(0, 0, -0.011);
    cachedCatInnerEar.computeVertexNormals();
  }

  return { outerEar: cachedCatOuterEar, innerEar: cachedCatInnerEar };
}

export function Cat3D({
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

  const pearGeo = getPearBodyGeometry(0.5, 0.92);
  const armGeo = getPlushArmGeometry(0.4, 0.11, 0.145);
  const tailGeo = getCatTailGeometry();
  const whiskersGeo = getCatWhiskersGeometry();
  const stripesGeo = getCatForeheadStripesGeometry();
  const { outerEar, innerEar } = getCatEarGeometries();

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} />

      {/* Stout chubby British Shorthair gray-and-white plush body */}
      <group ref={body} position={[0, 0.45, 0]}>
        {accessory && <Accessory3D accessory={accessory} animal="cat" slot="body" />}
        <mesh geometry={pearGeo} position={[0, -0.37, 0]} castShadow receiveShadow>
          <PlushMaterial color="#777A84" />
        </mesh>

        {/* Smooth cream-white belly */}
        <mesh position={[0, -0.04, 0.27]} scale={[0.38, 0.4, 0.28]} castShadow receiveShadow>
          <sphereGeometry args={[1, 28, 22]} />
          <PlushMaterial color="#F5F1E9" />
        </mesh>

        {/* Cobalt-blue plush collar clearly visible below chin */}
        <mesh position={[0, 0.28, 0.04]} rotation={[Math.PI / 2 + 0.14, 0, 0]} castShadow receiveShadow>
          <torusGeometry args={[0.385, 0.046, 16, 32]} />
          <PlushMaterial color="#3964C4" roughness={0.82} />
        </mesh>

        {/* Shiny golden sphere bell hanging cleanly in front of chest */}
        <group position={[0.03, 0.17, 0.47]}>
          <mesh position={[0, 0.08, -0.015]}>
            <torusGeometry args={[0.026, 0.009, 8, 14]} />
            <DetailMaterial color="#EBB51E" roughness={0.16} metalness={0.82} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.082, 20, 16]} />
            <DetailMaterial color="#EBB51E" roughness={0.16} metalness={0.82} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.081, 0.007, 8, 20]} />
            <DetailMaterial color="#C99212" roughness={0.22} metalness={0.78} />
          </mesh>
          <mesh position={[0, -0.052, 0.062]}>
            <sphereGeometry args={[0.016, 8, 8]} />
            <DetailMaterial color="#33261A" roughness={0.5} />
          </mesh>
        </group>

        {/* Short wide-set cream-white feet resting at y=0 + merged pink paw pads */}
        {([-1, 1] as const).map((side) => (
          <group key={`foot-${side}`} position={[side * 0.22, -0.37, 0.06]}>
            <mesh scale={[0.16, 0.088, 0.2]} castShadow receiveShadow>
              <sphereGeometry args={[1, 20, 16]} />
              <PlushMaterial color="#F5F1E9" />
            </mesh>
            <PlushPawPad
              position={[0, -0.004, 0.19]}
              rotation={[-0.18, 0, 0]}
              scale={0.85}
              color="#EFA8B2"
            />
          </group>
        ))}

        {/* Chunky plush gray arms with plump white paws */}
        <group ref={armLeft} position={[-0.42, 0.18, 0.1]} rotation={[0.2, 0.12, -0.36]}>
          <mesh geometry={armGeo} castShadow receiveShadow>
            <PlushMaterial color="#777A84" />
          </mesh>
          <mesh position={[0, -0.38, 0]} scale={[0.148, 0.138, 0.148]} castShadow receiveShadow>
            <sphereGeometry args={[1, 18, 14]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>
        </group>

        <group ref={armRight} position={[0.42, 0.18, 0.1]} rotation={[0.2, -0.12, 0.36]}>
          <mesh geometry={armGeo} castShadow receiveShadow>
            <PlushMaterial color="#777A84" />
          </mesh>
          <mesh position={[0, -0.38, 0]} scale={[0.148, 0.138, 0.148]} castShadow receiveShadow>
            <sphereGeometry args={[1, 18, 14]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>
        </group>

        {/* Sculpted smooth S-curved TubeGeometry plush cat tail with cream tip */}
        <group ref={tail} position={[0, -0.14, -0.38]}>
          <mesh geometry={tailGeo} castShadow receiveShadow>
            <PlushMaterial color="#777A84" />
          </mesh>
          <mesh position={[0.04, 0.44, -0.14]}>
            <sphereGeometry args={[0.078, 14, 12]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>
        </group>

        {/* Extra-plump British Shorthair round head */}
        <group ref={head} position={[0, 0.64, 0.02]}>
          {accessory && <Accessory3D accessory={accessory} animal="cat" slot="head" />}
          <mesh castShadow receiveShadow scale={[1.12, 0.9, 0.96]}>
            <sphereGeometry args={[0.48, 30, 26]} />
            <PlushMaterial color="#777A84" />
          </mesh>

          {/* Subtle British Shorthair tabby forehead stripes (1 draw call) */}
          <mesh geometry={stripesGeo}>
            <PlushMaterial color="#595C66" />
          </mesh>

          {/* Smooth white forehead-to-nose blaze connecting into muzzle */}
          <mesh position={[0, 0.14, 0.4]} rotation={[0.32, 0, 0]} scale={[0.075, 0.26, 0.08]}>
            <sphereGeometry args={[1, 18, 14]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>
          <mesh position={[0, 0.0, 0.41]} scale={[0.12, 0.1, 0.085]}>
            <sphereGeometry args={[1, 16, 14]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>

          {/* Soft blended cream-white muzzle & lower cheek cushions */}
          <mesh position={[0, -0.11, 0.32]} scale={[0.42, 0.24, 0.2]} receiveShadow>
            <sphereGeometry args={[1, 24, 18]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>
          <mesh position={[-0.12, -0.1, 0.39]} scale={[0.135, 0.1, 0.095]}>
            <sphereGeometry args={[1, 18, 14]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>
          <mesh position={[0.12, -0.1, 0.39]} scale={[0.135, 0.1, 0.095]}>
            <sphereGeometry args={[1, 18, 14]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>

          {/* Glossy pale-pink triangular cat nose */}
          <mesh position={[0, 0.01, 0.49]} rotation={[0, 0, Math.PI]} scale={[1.25, 0.85, 0.65]}>
            <coneGeometry args={[0.032, 0.036, 12]} />
            <GlossyMaterial color="#E8A0A4" roughness={0.18} clearcoat={0.85} />
          </mesh>

          {/* Gently arched delicate whiskers anchored cleanly into cheeks (1 draw call) */}
          <mesh geometry={whiskersGeo}>
            <DetailMaterial color="#ECEAE5" roughness={0.55} />
          </mesh>

          {/* Smooth bezier-curved cat ears */}
          <group ref={earLeft} position={[-0.31, 0.31, 0.02]} rotation={[0.08, 0.16, 0.32]}>
            <mesh geometry={outerEar} castShadow receiveShadow>
              <PlushMaterial color="#777A84" />
            </mesh>
            <mesh geometry={innerEar} position={[0, 0, 0.03]}>
              <PlushMaterial color="#C89FA2" />
            </mesh>
          </group>

          <group ref={earRight} position={[0.31, 0.31, 0.02]} rotation={[0.08, -0.16, -0.32]}>
            <mesh geometry={outerEar} castShadow receiveShadow>
              <PlushMaterial color="#777A84" />
            </mesh>
            <mesh geometry={innerEar} position={[0, 0, 0.03]}>
              <PlushMaterial color="#C89FA2" />
            </mesh>
          </group>

          {/* Sleepy golden-amber glass eyes with blinking */}
          <PlushEyePair
            eyesRef={eyes}
            emotion={emotion}
            spread={0.17}
            y={0.085}
            z={0.445}
            variant="catAmber"
            lidColor="#777A84"
            browColor="#5D606A"
            shockScleraColor="#FEF08A"
          />

          <PlushCheekBlush
            emotion={emotion}
            spread={0.295}
            y={-0.025}
            z={0.39}
            color="#F5A6B4"
          />

          {emotion === 'shock' && <PlushSweatDrop position={[0.33, 0.22, 0.36]} />}

          {/* Signature `:3` stitched cat smile */}
          <PlushSmileMouth
            emotion={emotion}
            position={[0, -0.068, 0.48]}
            stitchColor="#6E5B55"
            scale={0.96}
          />
        </group>
      </group>
    </group>
  );
}
