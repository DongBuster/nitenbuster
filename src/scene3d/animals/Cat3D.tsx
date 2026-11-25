import { useRef } from 'react';
import * as THREE from 'three';
import {
  TurnRing3D,
  useAnimalMotion,
  type Animal3DProps,
} from '../CharacterRig3D';
import { Accessory3D } from '../Accessory3D';
import { PlushMaterial, getPearBodyGeometry, getPlushArmGeometry } from '../plushMaterial';

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
      bevelSegments: 5,
      curveSegments: 20,
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
      bevelSegments: 4,
      curveSegments: 16,
    });
    cachedCatInnerEar.translate(0, 0, -0.011);
    cachedCatInnerEar.computeVertexNormals();
  }

  return { outerEar: cachedCatOuterEar, innerEar: cachedCatInnerEar };
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

export function Cat3D({
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

  const pearGeo = getPearBodyGeometry(0.5, 0.92);
  const armGeo = getPlushArmGeometry(0.4, 0.11, 0.145);
  const { outerEar, innerEar } = getCatEarGeometries();

  return (
    <group ref={root}>
      <TurnRing3D active={isActive} />

      {/* Stout chubby British Shorthair gray-and-white plush body */}
      <group ref={body} position={[0, 0.45, 0]}>
        {accessory && <Accessory3D accessory={accessory} animal="cat" slot="body" />}
        {/* Sculpted smooth pear-shaped cool-gray plush body */}
        <mesh geometry={pearGeo} position={[0, -0.37, 0]} castShadow receiveShadow>
          <PlushMaterial color="#777A84" />
        </mesh>

        {/* High-subdivision cream-white belly sitting cleanly forward in +Z (zero Z-fighting) */}
        <mesh position={[0, -0.04, 0.27]} scale={[0.38, 0.4, 0.28]} castShadow receiveShadow>
          <sphereGeometry args={[1, 48, 36]} />
          <PlushMaterial color="#F5F1E9" />
        </mesh>

        {/* Cobalt-blue plush collar clearly visible below chin */}
        <mesh position={[0, 0.28, 0.04]} rotation={[Math.PI / 2 + 0.14, 0, 0]} castShadow receiveShadow>
          <torusGeometry args={[0.385, 0.046, 18, 36]} />
          <PlushMaterial color="#3964C4" roughness={0.82} />
        </mesh>

        {/* Large shiny golden sphere bell hanging cleanly in front of chest */}
        <group position={[0.03, 0.17, 0.47]}>
          <mesh position={[0, 0.08, -0.015]} castShadow>
            <torusGeometry args={[0.026, 0.009, 10, 16]} />
            <meshStandardMaterial color="#EBB51E" roughness={0.16} metalness={0.82} />
          </mesh>
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.082, 26, 22]} />
            <meshStandardMaterial color="#EBB51E" roughness={0.16} metalness={0.82} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.081, 0.007, 8, 24]} />
            <meshStandardMaterial color="#C99212" roughness={0.22} metalness={0.78} />
          </mesh>
          <mesh position={[0, -0.052, 0.062]}>
            <sphereGeometry args={[0.016, 10, 10]} />
            <meshStandardMaterial color="#33261A" roughness={0.5} />
          </mesh>
        </group>

        {/* Short wide-set cream-white feet resting at y=0 */}
        <mesh position={[-0.22, -0.37, 0.06]} scale={[0.16, 0.088, 0.2]} castShadow receiveShadow>
          <sphereGeometry args={[1, 24, 20]} />
          <PlushMaterial color="#F5F1E9" />
        </mesh>
        <mesh position={[0.22, -0.37, 0.06]} scale={[0.16, 0.088, 0.2]} castShadow receiveShadow>
          <sphereGeometry args={[1, 24, 20]} />
          <PlushMaterial color="#F5F1E9" />
        </mesh>

        {/* Chunky plush gray arms clearly visible outside belly silhouette with plump white paws */}
        <group ref={armLeft} position={[-0.42, 0.18, 0.1]} rotation={[0.2, 0.12, -0.36]}>
          <mesh geometry={armGeo} castShadow receiveShadow>
            <PlushMaterial color="#777A84" />
          </mesh>
          <mesh position={[0, -0.38, 0]} scale={[0.148, 0.138, 0.148]} castShadow receiveShadow>
            <sphereGeometry args={[1, 20, 16]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>
        </group>

        <group ref={armRight} position={[0.42, 0.18, 0.1]} rotation={[0.2, -0.12, 0.36]}>
          <mesh geometry={armGeo} castShadow receiveShadow>
            <PlushMaterial color="#777A84" />
          </mesh>
          <mesh position={[0, -0.38, 0]} scale={[0.148, 0.138, 0.148]} castShadow receiveShadow>
            <sphereGeometry args={[1, 20, 16]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>
        </group>

        {/* Soft curved plush gray tail */}
        <group ref={tail} position={[0, -0.14, -0.4]}>
          <mesh position={[0, 0.07, -0.1]} rotation={[-0.75, 0, 0]} castShadow receiveShadow>
            <capsuleGeometry args={[0.085, 0.22, 10, 16]} />
            <PlushMaterial color="#777A84" />
          </mesh>
          <mesh position={[0, 0.24, -0.22]} rotation={[0.2, 0, 0]} castShadow receiveShadow>
            <capsuleGeometry args={[0.08, 0.2, 10, 16]} />
            <PlushMaterial color="#777A84" />
          </mesh>
          <mesh position={[0, 0.36, -0.2]} castShadow receiveShadow>
            <sphereGeometry args={[0.085, 16, 14]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>
        </group>

        {/* Extra-plump British Shorthair round head */}
        <group ref={head} position={[0, 0.64, 0.02]}>
          {accessory && <Accessory3D accessory={accessory} animal="cat" slot="head" />}
          {/* Main round gray head */}
          <mesh castShadow receiveShadow scale={[1.12, 0.9, 0.96]}>
            <sphereGeometry args={[0.48, 36, 32]} />
            <PlushMaterial color="#777A84" />
          </mesh>

          {/* Smooth continuous white forehead-to-nose blaze connecting into muzzle */}
          <mesh position={[0, 0.14, 0.4]} rotation={[0.32, 0, 0]} scale={[0.075, 0.26, 0.08]} castShadow>
            <sphereGeometry args={[1, 24, 18]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>
          <mesh position={[0, 0.0, 0.41]} scale={[0.12, 0.1, 0.085]} castShadow>
            <sphereGeometry args={[1, 20, 16]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>

          {/* Soft blended cream-white muzzle & lower cheek cushion (no detached balls) */}
          <mesh position={[0, -0.11, 0.32]} scale={[0.42, 0.24, 0.2]} castShadow receiveShadow>
            <sphereGeometry args={[1, 32, 24]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>
          <mesh position={[-0.12, -0.1, 0.39]} scale={[0.135, 0.1, 0.095]} castShadow>
            <sphereGeometry args={[1, 22, 18]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>
          <mesh position={[0.12, -0.1, 0.39]} scale={[0.135, 0.1, 0.095]} castShadow>
            <sphereGeometry args={[1, 22, 18]} />
            <PlushMaterial color="#F5F1E9" />
          </mesh>

          {/* Tiny pale-pink triangular cat nose */}
          <mesh position={[0, 0.01, 0.49]} rotation={[0, 0, Math.PI]} scale={[1.25, 0.85, 0.65]} castShadow>
            <coneGeometry args={[0.032, 0.036, 14]} />
            <meshStandardMaterial color="#E8A6A8" roughness={0.35} />
          </mesh>

          {/* Fine delicate whiskers (3 per side) */}
          {[-1, 1].map((side) => (
            <group key={`whiskers-${side}`}>
              <mesh position={[side * 0.48, -0.02, 0.26]} rotation={[0, -side * 0.25, Math.PI / 2 - side * 0.12]}>
                <cylinderGeometry args={[0.004, 0.004, 0.25, 8]} />
                <meshStandardMaterial color="#ECEAE5" roughness={0.6} />
              </mesh>
              <mesh position={[side * 0.49, -0.07, 0.27]} rotation={[0, -side * 0.25, Math.PI / 2]}>
                <cylinderGeometry args={[0.004, 0.004, 0.26, 8]} />
                <meshStandardMaterial color="#ECEAE5" roughness={0.6} />
              </mesh>
              <mesh position={[side * 0.48, -0.12, 0.26]} rotation={[0, -side * 0.25, Math.PI / 2 + side * 0.12]}>
                <cylinderGeometry args={[0.004, 0.004, 0.23, 8]} />
                <meshStandardMaterial color="#ECEAE5" roughness={0.6} />
              </mesh>
            </group>
          ))}

          {/* Smooth bezier-curved rounded-triangle cat ears (no ear-tip bulbs) */}
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

          {/* Custom British Shorthair Eyes — Sleepy golden-amber half-lidded look in idle */}
          {[-1, 1].map((side) => {
            const ex = side * 0.17;
            const ey = 0.085;
            const ez = 0.445;

            if (emotion === 'happy') {
              return (
                <mesh key={side} position={[ex, ey, ez]}>
                  <torusGeometry args={[0.048, 0.015, 10, 20, Math.PI]} />
                  <meshStandardMaterial color="#231A16" roughness={0.3} />
                </mesh>
              );
            }

            if (emotion === 'sad') {
              return (
                <group key={side} position={[ex, ey - 0.01, ez]}>
                  <mesh scale={[0.054, 0.048, 0.036]}>
                    <sphereGeometry args={[1, 18, 16]} />
                    <meshStandardMaterial color="#D9B64E" roughness={0.22} />
                  </mesh>
                  <mesh position={[0, 0, 0.018]} scale={[0.034, 0.034, 0.026]}>
                    <sphereGeometry args={[1, 16, 14]} />
                    <meshStandardMaterial color="#1C1816" roughness={0.14} />
                  </mesh>
                  <mesh position={[-0.01, 0.014, 0.036]}>
                    <sphereGeometry args={[0.011, 10, 10]} />
                    <meshBasicMaterial color="#FFFFFF" />
                  </mesh>
                  <mesh position={[0, 0.052, 0.014]} rotation={[0, 0, side * 0.32]}>
                    <capsuleGeometry args={[0.014, 0.068, 6, 10]} />
                    <PlushMaterial color="#777A84" />
                  </mesh>
                  <mesh position={[side * 0.022, -0.055, 0.022]} scale={[0.65, 1.15, 0.65]}>
                    <sphereGeometry args={[0.018, 10, 10]} />
                    <meshStandardMaterial color="#7DD3FC" emissive="#38BDF8" emissiveIntensity={0.25} roughness={0.1} />
                  </mesh>
                </group>
              );
            }

            if (emotion === 'shock') {
              return (
                <group key={side} position={[ex, ey + 0.01, ez]}>
                  <mesh scale={[1, 1.05, 0.65]}>
                    <sphereGeometry args={[0.066, 18, 18]} />
                    <meshStandardMaterial color="#231A16" roughness={0.4} />
                  </mesh>
                  <mesh position={[0, 0, 0.01]} scale={[1, 1.05, 0.65]}>
                    <sphereGeometry args={[0.056, 18, 18]} />
                    <meshStandardMaterial color="#FEF08A" roughness={0.22} />
                  </mesh>
                  <mesh position={[0, 0, 0.044]}>
                    <sphereGeometry args={[0.018, 12, 12]} />
                    <meshStandardMaterial color="#1C1816" roughness={0.15} />
                  </mesh>
                </group>
              );
            }

            if (emotion === 'win') {
              return <StarEye key={side} position={[ex, ey + 0.01, ez + 0.01]} />;
            }

            return (
              <group key={side} position={[ex, ey, ez]}>
                <mesh scale={[0.062, 0.046, 0.036]}>
                  <sphereGeometry args={[1, 20, 16]} />
                  <meshStandardMaterial color="#D9B64E" roughness={0.2} metalness={0.05} />
                </mesh>
                <mesh position={[0, -0.004, 0.018]} scale={[0.04, 0.034, 0.024]}>
                  <sphereGeometry args={[1, 16, 14]} />
                  <meshStandardMaterial color="#1A1614" roughness={0.12} metalness={0.08} />
                </mesh>
                <mesh position={[-0.014, 0.004, 0.038]}>
                  <sphereGeometry args={[0.01, 10, 10]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
                <mesh
                  position={[0, 0.032, 0.018]}
                  rotation={[0.08, 0, -side * 0.08]}
                  scale={[0.072, 0.032, 0.044]}
                >
                  <sphereGeometry args={[1, 16, 12]} />
                  <PlushMaterial color="#777A84" />
                </mesh>
              </group>
            );
          })}

          {emotion === 'shock' && (
            <mesh position={[0.33, 0.22, 0.36]} scale={[0.7, 1.25, 0.7]}>
              <sphereGeometry args={[0.028, 12, 12]} />
              <meshStandardMaterial color="#7DD3FC" emissive="#38BDF8" emissiveIntensity={0.25} roughness={0.1} />
            </mesh>
          )}

          {/* Subtle British Shorthair mouth */}
          {emotion === 'idle' && (
            <mesh position={[0, -0.055, 0.485]}>
              <capsuleGeometry args={[0.006, 0.034, 6, 8]} />
              <meshStandardMaterial color="#9E8B82" roughness={0.7} />
            </mesh>
          )}
          {(emotion === 'happy' || emotion === 'win') && (
            <mesh position={[0, -0.09, 0.475]} scale={[1.05, 0.85, 0.45]}>
              <sphereGeometry args={[0.044, 16, 14]} />
              <meshStandardMaterial color="#F26B7A" roughness={0.4} />
            </mesh>
          )}
          {emotion === 'sad' && (
            <mesh position={[0, -0.1, 0.475]}>
              <torusGeometry args={[0.034, 0.008, 8, 16, Math.PI]} />
              <meshStandardMaterial color="#5E4D49" roughness={0.5} />
            </mesh>
          )}
          {emotion === 'shock' && (
            <mesh position={[0, -0.095, 0.475]}>
              <torusGeometry args={[0.034, 0.01, 10, 20]} />
              <meshStandardMaterial color="#2C2019" roughness={0.4} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}
