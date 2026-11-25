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
  getPlushArmGeometry,
} from '../plushMaterial';
import { getChickenPearGeometry } from '../plushCurves';
import {
  PlushCheekBlush,
  PlushEyePair,
  PlushSweatDrop,
} from '../plushDetails';

export function Chicken3D({
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

  const pearGeo = getChickenPearGeometry();
  const wingGeo = getPlushArmGeometry(0.4, 0.105, 0.15);

  useAnimalMotion(
    { root, body, head, eyes, earLeft, earRight, armLeft, armRight, tail },
    emotion,
    isActive,
  );

  const beakOpen =
    emotion === 'shock' ? 0.036 : emotion === 'happy' || emotion === 'win' ? 0.026 : 0;

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} color="#FF6B3D" />

      {/* 3-toed glossy-keratin orange chicken feet resting cleanly at y = 0 */}
      {([-1, 1] as const).map((side) => (
        <group
          key={`foot-${side}`}
          position={[side * 0.17, 0.045, 0.09]}
          rotation={[0, -side * 0.22, 0]}
        >
          <mesh scale={[1.05, 0.36, 1.2]} castShadow receiveShadow>
            <sphereGeometry args={[0.115, 16, 12]} />
            <KeratinMaterial color="#FF9329" roughness={0.34} />
          </mesh>
          <mesh position={[-0.068, -0.004, 0.105]} rotation={[0, 0.36, 0]} scale={[0.042, 0.032, 0.088]}>
            <sphereGeometry args={[1, 10, 8]} />
            <KeratinMaterial color="#FF9329" roughness={0.34} />
          </mesh>
          <mesh position={[0, -0.004, 0.12]} scale={[0.042, 0.032, 0.094]}>
            <sphereGeometry args={[1, 10, 8]} />
            <KeratinMaterial color="#FF9329" roughness={0.34} />
          </mesh>
          <mesh position={[0.068, -0.004, 0.105]} rotation={[0, -0.36, 0]} scale={[0.042, 0.032, 0.088]}>
            <sphereGeometry args={[1, 10, 8]} />
            <KeratinMaterial color="#FF9329" roughness={0.34} />
          </mesh>
        </group>
      ))}

      {/* Seamless warm-white pear-shaped hen/chick body */}
      <group ref={body} position={[0, 0.075, 0]}>
        {accessory && <Accessory3D accessory={accessory} animal="chicken" slot="body" />}
        <mesh geometry={pearGeo} scale={[1.0, 1.0, 0.98]} castShadow receiveShadow>
          <PlushMaterial color="#FAF4E8" />
        </mesh>

        {/* Stubby drooping white wings with subtle layered feather tip */}
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
          <mesh position={[-0.035, -0.28, -0.05]} rotation={[0.25, 0, -0.18]} scale={[0.07, 0.12, 0.09]}>
            <sphereGeometry args={[1, 12, 10]} />
            <PlushMaterial color="#F1E8D8" />
          </mesh>
        </group>

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
          <mesh position={[0.035, -0.28, -0.05]} rotation={[0.25, 0, 0.18]} scale={[0.07, 0.12, 0.09]}>
            <sphereGeometry args={[1, 12, 10]} />
            <PlushMaterial color="#F1E8D8" />
          </mesh>
        </group>

        {/* Fanned 3-feather fluffy white hen tail */}
        <group ref={tail} position={[0, 0.36, -0.49]}>
          <mesh
            position={[0, 0.08, -0.08]}
            rotation={[-0.65, 0, 0]}
            scale={[0.75, 1.22, 0.65]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[0.13, 14, 12]} />
            <PlushMaterial color="#FAF4E8" />
          </mesh>
          <mesh
            position={[-0.09, 0.05, -0.06]}
            rotation={[-0.68, 0.18, 0.42]}
            scale={[0.64, 1.05, 0.56]}
          >
            <sphereGeometry args={[0.115, 12, 10]} />
            <PlushMaterial color="#F4ECDE" />
          </mesh>
          <mesh
            position={[0.09, 0.05, -0.06]}
            rotation={[-0.68, -0.18, -0.42]}
            scale={[0.64, 1.05, 0.56]}
          >
            <sphereGeometry args={[0.115, 12, 10]} />
            <PlushMaterial color="#F4ECDE" />
          </mesh>
        </group>

        {/* Lowered compact head anchor for 3-lobe coral comb, bead eyes, beak & wattle */}
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
              <sphereGeometry args={[0.098, 16, 14]} />
              <PlushMaterial color="#FF6B3D" />
            </mesh>
            <mesh
              position={[0.025, 0.085, 0.0]}
              scale={[0.84, 1.38, 0.76]}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[0.104, 16, 14]} />
              <PlushMaterial color="#FF6B3D" />
            </mesh>
            <mesh
              position={[0.11, 0.04, -0.025]}
              rotation={[0, 0, -0.34]}
              scale={[0.78, 1.18, 0.7]}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[0.09, 16, 14]} />
              <PlushMaterial color="#FF6B3D" />
            </mesh>
          </group>

          <group ref={earLeft} position={[-0.32, 0.02, 0]} />
          <group ref={earRight} position={[0.32, 0.02, 0]} />

          {/* Glossy dark bead eyes with periodic blinking */}
          <PlushEyePair
            eyesRef={eyes}
            emotion={emotion}
            spread={0.145}
            y={0.14}
            z={0.295}
            rotY={0.28}
            scale={0.86}
            variant="bead"
            browColor="#6B442A"
          />

          {/* Soft warm peach-pink cheek blush */}
          <PlushCheekBlush
            emotion={emotion}
            spread={0.23}
            y={0.055}
            z={0.265}
            rotY={0.44}
            color="#FFA08E"
            scale={0.85}
          />

          {emotion === 'shock' && <PlushSweatDrop position={[0.25, 0.24, 0.24]} scale={0.9} />}

          {/* Plump keratin orange beak + iconic 2-drop coral wattle underneath */}
          <group position={[0, 0.01, 0.34]}>
            <mesh
              position={[0, 0.02 + beakOpen * 0.4, 0.05]}
              rotation={[Math.PI / 2 - 0.14 - beakOpen * 3, 0, 0]}
              scale={[1.42, 0.92, 0.72]}
              castShadow
              receiveShadow
            >
              <coneGeometry args={[0.1, 0.17, 18]} />
              <KeratinMaterial color="#FF9329" roughness={0.32} />
            </mesh>
            <mesh
              position={[0, -0.028 - beakOpen, 0.036]}
              rotation={[0.12 + beakOpen * 4, 0, 0]}
              scale={[1.38, 0.54, 0.92]}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[0.095, 16, 12]} />
              <KeratinMaterial color="#F2851E" roughness={0.35} />
            </mesh>

            {/* Iconic 2-drop plush coral-red wattle beneath chin */}
            <mesh
              position={[-0.032, -0.088 - beakOpen * 0.5, 0.028]}
              rotation={[0.15, 0, 0.18]}
              scale={[0.72, 1.18, 0.68]}
            >
              <sphereGeometry args={[0.042, 12, 10]} />
              <PlushMaterial color="#EE4B3E" />
            </mesh>
            <mesh
              position={[0.032, -0.088 - beakOpen * 0.5, 0.028]}
              rotation={[0.15, 0, -0.18]}
              scale={[0.72, 1.18, 0.68]}
            >
              <sphereGeometry args={[0.042, 12, 10]} />
              <PlushMaterial color="#EE4B3E" />
            </mesh>

            {(emotion === 'idle' || emotion === 'sad') && (
              <mesh
                position={[0, -0.022, 0.098]}
                rotation={[0.15, 0, 0]}
                scale={[1.25, 0.36, 0.3]}
              >
                <torusGeometry args={[0.088, 0.007, 8, 16, Math.PI]} />
                <DetailMaterial color="#9E4B0A" roughness={0.6} />
              </mesh>
            )}
            {beakOpen > 0 && (
              <mesh position={[0, -0.008, 0.068]} scale={[0.9, 0.72, 0.45]}>
                <sphereGeometry args={[0.052, 12, 10]} />
                <DetailMaterial color="#D94B5C" roughness={0.55} />
              </mesh>
            )}
          </group>
        </group>
      </group>
    </group>
  );
}
