import { useRef } from 'react';
import * as THREE from 'three';
import {
  TurnRing3D,
  useAnimalMotion,
  type Animal3DProps,
} from '../CharacterRig3D';
import { Accessory3D } from '../Accessory3D';
import { PlushMaterial, getPearBodyGeometry, getPlushArmGeometry } from '../plushMaterial';

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
      bevelSegments: 5,
      curveSegments: 20,
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
      bevelSegments: 4,
      curveSegments: 16,
    });
    cachedCorgiInnerEar.translate(0, 0, -0.012);
    cachedCorgiInnerEar.computeVertexNormals();
  }

  return { outerEar: cachedCorgiOuterEar, innerEar: cachedCorgiInnerEar };
}

function StarEye({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.072, 0.072, 0.028]} />
        <meshStandardMaterial
          color="#FACC15"
          emissive="#F59E0B"
          emissiveIntensity={0.5}
          roughness={0.2}
          metalness={0.35}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[0.072, 0.072, 0.028]} />
        <meshStandardMaterial
          color="#FACC15"
          emissive="#F59E0B"
          emissiveIntensity={0.5}
          roughness={0.2}
          metalness={0.35}
        />
      </mesh>
    </group>
  );
}

export function Dog3D({
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

  useAnimalMotion(
    { root, body, head, earLeft, earRight, armLeft, armRight, tail },
    emotion,
    isActive
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
        {/* Sculpted smooth pear-shaped orange plush body */}
        <mesh geometry={pearGeo} position={[0, -0.37, 0]} castShadow receiveShadow>
          <PlushMaterial color="#E89541" />
        </mesh>

        {/* High-subdivision cream-white belly sitting cleanly forward in +Z (zero Z-fighting) */}
        <mesh position={[0, -0.04, 0.27]} scale={[0.37, 0.39, 0.27]} castShadow receiveShadow>
          <sphereGeometry args={[1, 48, 36]} />
          <PlushMaterial color="#FAF1E2" />
        </mesh>

        {/* Thick red plush collar clearly visible below chin */}
        <mesh position={[0, 0.28, 0.04]} rotation={[Math.PI / 2 + 0.14, 0, 0]} castShadow receiveShadow>
          <torusGeometry args={[0.375, 0.048, 18, 36]} />
          <PlushMaterial color="#D43628" roughness={0.82} />
        </mesh>

        {/* Bright gold 3D bone charm hanging cleanly in front of chest */}
        <group position={[0, 0.17, 0.51]} rotation={[0.08, 0, 0]}>
          <mesh position={[0, 0.072, -0.015]} castShadow>
            <torusGeometry args={[0.028, 0.009, 10, 16]} />
            <meshStandardMaterial color="#F5C438" roughness={0.18} metalness={0.78} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <capsuleGeometry args={[0.03, 0.1, 10, 16]} />
            <meshStandardMaterial color="#F5C438" roughness={0.18} metalness={0.78} />
          </mesh>
          {[
            [-0.068, 0.026],
            [-0.068, -0.026],
            [0.068, 0.026],
            [0.068, -0.026],
          ].map(([bx, by], idx) => (
            <mesh key={idx} position={[bx, by, 0]} castShadow>
              <sphereGeometry args={[0.032, 14, 12]} />
              <meshStandardMaterial color="#F5C438" roughness={0.18} metalness={0.78} />
            </mesh>
          ))}
        </group>

        {/* Short stout white Corgi feet resting squarely at y=0 */}
        <mesh position={[-0.22, -0.37, 0.06]} scale={[0.16, 0.088, 0.2]} castShadow receiveShadow>
          <sphereGeometry args={[1, 24, 20]} />
          <PlushMaterial color="#FAF1E2" />
        </mesh>
        <mesh position={[0.22, -0.37, 0.06]} scale={[0.16, 0.088, 0.2]} castShadow receiveShadow>
          <sphereGeometry args={[1, 24, 20]} />
          <PlushMaterial color="#FAF1E2" />
        </mesh>

        {/* Dog's right arm (viewer's left): raised playfully in front of chest */}
        <group ref={armLeft} position={[-0.41, 0.18, 0.18]} rotation={[-0.68, 0.28, -0.25]}>
          <mesh geometry={armLeftGeo} castShadow receiveShadow>
            <PlushMaterial color="#E89541" />
          </mesh>
          <mesh position={[0, -0.36, 0]} scale={[0.145, 0.135, 0.145]} castShadow receiveShadow>
            <sphereGeometry args={[1, 20, 16]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>
        </group>

        {/* Dog's left arm (viewer's right): protruding cleanly outside right hip */}
        <group ref={armRight} position={[0.42, 0.18, 0.08]} rotation={[0.15, -0.08, 0.38]}>
          <mesh geometry={armRightGeo} castShadow receiveShadow>
            <PlushMaterial color="#E89541" />
          </mesh>
          <mesh position={[0, -0.38, 0]} scale={[0.145, 0.135, 0.145]} castShadow receiveShadow>
            <sphereGeometry args={[1, 20, 16]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>
        </group>

        {/* Fluffy stubby Corgi nub tail */}
        <group ref={tail} position={[0, -0.14, -0.4]}>
          <mesh position={[0, 0.06, -0.08]} rotation={[-0.65, 0, 0]} castShadow receiveShadow>
            <capsuleGeometry args={[0.095, 0.14, 10, 16]} />
            <PlushMaterial color="#E89541" />
          </mesh>
          <mesh position={[0, 0.12, -0.15]} castShadow receiveShadow>
            <sphereGeometry args={[0.095, 16, 14]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>
        </group>

        {/* Faithful Corgi plush head */}
        <group ref={head} position={[0, 0.65, 0.02]}>
          {accessory && <Accessory3D accessory={accessory} animal="dog" slot="head" />}
          {/* Plump wide orange head */}
          <mesh castShadow receiveShadow scale={[1.08, 0.94, 0.96]}>
            <sphereGeometry args={[0.48, 36, 32]} />
            <PlushMaterial color="#E89541" />
          </mesh>

          {/* Clean white forehead blaze running smoothly from crown down into muzzle */}
          <mesh position={[0, 0.16, 0.39]} rotation={[0.28, 0, 0]} scale={[0.105, 0.27, 0.09]} castShadow>
            <sphereGeometry args={[1, 24, 20]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>

          {/* Soft blended cream-white Corgi muzzle & subtle cheek fullness (no detached balls) */}
          <mesh position={[0, -0.1, 0.34]} scale={[0.37, 0.22, 0.19]} castShadow receiveShadow>
            <sphereGeometry args={[1, 32, 24]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>
          <mesh position={[-0.1, -0.11, 0.41]} scale={[0.125, 0.095, 0.09]} castShadow>
            <sphereGeometry args={[1, 22, 18]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>
          <mesh position={[0.1, -0.11, 0.41]} scale={[0.125, 0.095, 0.09]} castShadow>
            <sphereGeometry args={[1, 22, 18]} />
            <PlushMaterial color="#FAF1E2" />
          </mesh>

          {/* Big glossy dark oval Corgi nose */}
          <mesh position={[0, -0.015, 0.51]} scale={[1.32, 0.94, 0.78]} castShadow>
            <sphereGeometry args={[0.062, 22, 18]} />
            <meshStandardMaterial color="#261E1A" roughness={0.2} metalness={0.08} />
          </mesh>

          {/* Smooth bezier-curved rounded-triangle Corgi ears (no ear-tip bulbs) */}
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

          {/* Custom Corgi 3D Eyes — NO generic pink cheek circles */}
          {[-1, 1].map((side) => {
            const ex = side * 0.145;
            const ey = 0.105;
            const ez = 0.455;

            if (emotion === 'happy') {
              return (
                <mesh key={side} position={[ex, ey, ez]}>
                  <torusGeometry args={[0.046, 0.015, 10, 20, Math.PI]} />
                  <meshStandardMaterial color="#231A16" roughness={0.3} />
                </mesh>
              );
            }

            if (emotion === 'sad') {
              return (
                <group key={side} position={[ex, ey - 0.01, ez]}>
                  <mesh scale={[0.038, 0.05, 0.034]}>
                    <sphereGeometry args={[1, 18, 16]} />
                    <meshStandardMaterial color="#1E1714" roughness={0.14} metalness={0.08} />
                  </mesh>
                  <mesh position={[-0.012, 0.016, 0.028]}>
                    <sphereGeometry args={[0.012, 10, 10]} />
                    <meshBasicMaterial color="#FFFFFF" />
                  </mesh>
                  <mesh position={[0, 0.062, 0.01]} rotation={[0, 0, side * 0.34]}>
                    <capsuleGeometry args={[0.01, 0.052, 6, 10]} />
                    <meshStandardMaterial color="#4A3525" roughness={0.5} />
                  </mesh>
                  <mesh position={[side * 0.02, -0.06, 0.02]} scale={[0.65, 1.15, 0.65]}>
                    <sphereGeometry args={[0.018, 10, 10]} />
                    <meshStandardMaterial color="#7DD3FC" emissive="#38BDF8" emissiveIntensity={0.25} roughness={0.1} />
                  </mesh>
                </group>
              );
            }

            if (emotion === 'shock') {
              return (
                <group key={side} position={[ex, ey + 0.01, ez]}>
                  <mesh scale={[1, 1.08, 0.65]}>
                    <sphereGeometry args={[0.064, 18, 18]} />
                    <meshStandardMaterial color="#231A16" roughness={0.4} />
                  </mesh>
                  <mesh position={[0, 0, 0.01]} scale={[1, 1.08, 0.65]}>
                    <sphereGeometry args={[0.054, 18, 18]} />
                    <meshStandardMaterial color="#FFFFFF" roughness={0.25} />
                  </mesh>
                  <mesh position={[0, 0, 0.044]}>
                    <sphereGeometry args={[0.018, 12, 12]} />
                    <meshStandardMaterial color="#1E1714" roughness={0.15} />
                  </mesh>
                </group>
              );
            }

            if (emotion === 'win') {
              return <StarEye key={side} position={[ex, ey + 0.01, ez + 0.01]} />;
            }

            return (
              <group key={side} position={[ex, ey, ez]}>
                <mesh scale={[0.038, 0.056, 0.036]}>
                  <sphereGeometry args={[1, 20, 18]} />
                  <meshStandardMaterial color="#1D1613" roughness={0.12} metalness={0.1} />
                </mesh>
                <mesh position={[-0.012, 0.02, 0.03]}>
                  <sphereGeometry args={[0.012, 10, 10]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>
            );
          })}

          {emotion === 'shock' && (
            <mesh position={[0.3, 0.23, 0.37]} scale={[0.7, 1.25, 0.7]}>
              <sphereGeometry args={[0.028, 12, 12]} />
              <meshStandardMaterial color="#7DD3FC" emissive="#38BDF8" emissiveIntensity={0.25} roughness={0.1} />
            </mesh>
          )}

          {/* Custom subtle Corgi mouth */}
          {emotion === 'idle' && (
            <mesh position={[0, -0.095, 0.505]}>
              <capsuleGeometry args={[0.006, 0.038, 6, 8]} />
              <meshStandardMaterial color="#8A7665" roughness={0.7} />
            </mesh>
          )}
          {(emotion === 'happy' || emotion === 'win') && (
            <mesh position={[0, -0.135, 0.5]} scale={[1.1, 0.9, 0.45]}>
              <sphereGeometry args={[0.046, 16, 14]} />
              <meshStandardMaterial color="#F26B7A" roughness={0.4} />
            </mesh>
          )}
          {emotion === 'sad' && (
            <mesh position={[0, -0.145, 0.5]}>
              <torusGeometry args={[0.035, 0.009, 8, 16, Math.PI]} />
              <meshStandardMaterial color="#5C4434" roughness={0.5} />
            </mesh>
          )}
          {emotion === 'shock' && (
            <mesh position={[0, -0.135, 0.5]}>
              <torusGeometry args={[0.035, 0.011, 10, 20]} />
              <meshStandardMaterial color="#2C2019" roughness={0.4} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}
