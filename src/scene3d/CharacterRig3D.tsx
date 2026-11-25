import { createContext, useContext, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PartyMotionState } from '../brawl/sim/partyMotion';
import type { Emotion } from '../engine/types';
import type { AccessorySelection } from './accessoryCatalog';
import { computeBlinkScaleY } from './plushCurves';

export const BrawlMotionContext =
  createContext<RefObject<PartyMotionState | null> | null>(null);

export interface Animal3DProps {
  emotion?: Emotion;
  isActive?: boolean;
  accessory?: AccessorySelection;
}

export interface RigRefs {
  root: RefObject<THREE.Group | null>;
  body: RefObject<THREE.Group | null>;
  head: RefObject<THREE.Group | null>;
  eyes?: RefObject<THREE.Group | null>;
  earLeft?: RefObject<THREE.Group | null>;
  earRight?: RefObject<THREE.Group | null>;
  armLeft?: RefObject<THREE.Group | null>;
  armRight?: RefObject<THREE.Group | null>;
  tail?: RefObject<THREE.Group | null>;
}

interface BaseTransform {
  pos: [number, number, number];
  rot: [number, number, number];
  scale: [number, number, number];
}

function getBaseTransform(obj: THREE.Object3D): BaseTransform {
  if (!obj.userData.__pawsBase) {
    obj.userData.__pawsBase = {
      pos: [obj.position.x, obj.position.y, obj.position.z],
      rot: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    } satisfies BaseTransform;
  }
  return obj.userData.__pawsBase as BaseTransform;
}

export function useAnimalMotion(
  refs: RigRefs,
  emotion: Emotion = 'idle',
  isActive = false,
): void {
  const phaseRef = useRef(Math.random() * Math.PI * 2);
  const brawlMotionRef = useContext(BrawlMotionContext);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const pm = brawlMotionRef?.current ?? null;
    const smooth = 1 - Math.exp(-(pm ? 18 : 10) * dt);
    const t = state.clock.elapsedTime + phaseRef.current;

    const root = refs.root.current;
    const body = refs.body.current;
    const head = refs.head.current;
    const earL = refs.earLeft?.current;
    const earR = refs.earRight?.current;
    const armL = refs.armLeft?.current;
    const armR = refs.armRight?.current;
    const tail = refs.tail?.current;

    // Target deltas
    let rootX = 0;
    let rootY = 0;
    let rootZ = 0;
    let rootRotY = 0;

    let bodyScaleX = 1;
    let bodyScaleY = 1;
    let bodyScaleZ = 1;
    let bodyRotX = 0;
    let bodyRotZ = 0;

    let headRotX = 0;
    let headRotY = 0;
    let headRotZ = 0;

    let earLRotZ = 0;
    let earRRotZ = 0;
    let earLRotX = 0;
    let earRRotX = 0;

    let armLRotZ = 0;
    let armRRotZ = 0;
    let armLRotX = 0;
    let armRRotX = 0;

    let tailRotY = 0;
    let tailRotX = 0;

    if (emotion === 'happy') {
      const hop = Math.abs(Math.sin(t * 5.2));
      rootY = hop * 0.16;
      bodyScaleY = 1 + hop * 0.05;
      bodyScaleX = 1 - hop * 0.025;
      bodyScaleZ = 1 - hop * 0.025;
      headRotZ = Math.sin(t * 5.2) * 0.14;
      headRotX = -0.06;
      earLRotZ = Math.sin(t * 10.4) * 0.12;
      earRRotZ = -Math.sin(t * 10.4) * 0.12;
      armLRotZ = -(0.55 + Math.sin(t * 10.4) * 0.28);
      armRRotZ = +(0.55 + Math.sin(t * 10.4) * 0.28);
      tailRotY = Math.sin(t * 12) * 0.45;
    } else if (emotion === 'sad') {
      const breath = Math.sin(t * 1.8) * 0.015;
      rootX = Math.sin(t * 18) * 0.008;
      bodyScaleY = 0.94 + breath;
      bodyScaleX = 1.03;
      bodyScaleZ = 1.03;
      bodyRotX = 0.08;
      headRotX = 0.26 + Math.sin(t * 1.8) * 0.03;
      headRotZ = Math.sin(t * 1.3) * 0.05;
      earLRotZ = 0.25;
      earRRotZ = -0.25;
      earLRotX = 0.18;
      earRRotX = 0.18;
      armLRotZ = +0.16;
      armRRotZ = -0.16;
      armLRotX = 0.12;
      armRRotX = 0.12;
      tailRotX = -0.22;
      tailRotY = Math.sin(t * 1.6) * 0.06;
    } else if (emotion === 'shock') {
      const tremble = Math.sin(t * 42) * 0.032;
      const recoil = Math.abs(Math.sin(t * 7.5)) * 0.07;
      rootX = tremble;
      rootY = 0.05 + recoil;
      rootZ = -0.08;
      bodyScaleY = 1.06;
      bodyScaleX = 0.95;
      bodyScaleZ = 0.95;
      bodyRotX = -0.09;
      headRotX = -0.12;
      headRotZ = tremble * 1.8;
      earLRotZ = -0.18;
      earRRotZ = 0.18;
      armLRotZ = -(0.72 + Math.sin(t * 28) * 0.1);
      armRRotZ = +(0.72 + Math.sin(t * 28) * 0.1);
      tailRotX = 0.28;
    } else if (emotion === 'win') {
      const jump = Math.abs(Math.sin(t * 5.6));
      rootY = jump * 0.28;
      rootRotY = Math.sin(t * 2.8) * 0.36;
      bodyScaleY = 1 + jump * 0.07;
      bodyScaleX = 1 - jump * 0.03;
      bodyScaleZ = 1 - jump * 0.03;
      headRotZ = Math.sin(t * 5.6) * 0.15;
      headRotX = -0.08;
      earLRotZ = Math.sin(t * 11.2) * 0.18;
      earRRotZ = -Math.sin(t * 11.2) * 0.18;
      armLRotZ = -(0.85 + Math.sin(t * 11.2) * 0.22);
      armRRotZ = +(0.85 + Math.sin(t * 11.2) * 0.22);
      tailRotY = Math.sin(t * 14) * 0.5;
    } else {
      // idle (with eager bounce if isActive)
      const breath = Math.sin(t * 2.4) * 0.028;
      bodyScaleY = 1 + breath;
      bodyScaleX = 1 - breath * 0.5;
      bodyScaleZ = 1 - breath * 0.5;
      headRotZ = Math.sin(t * 1.5) * 0.055;
      headRotY = Math.sin(t * 0.95) * 0.08;
      earLRotZ = Math.sin(t * 3.1) * 0.05;
      earRRotZ = -Math.sin(t * 3.1 + 0.6) * 0.05;
      armLRotZ = -Math.sin(t * 2.4) * 0.06;
      armRRotZ = Math.sin(t * 2.4) * 0.06;
      tailRotY = Math.sin(t * 3.6) * 0.22;

      if (isActive && !pm) {
        const eagerHop = Math.abs(Math.sin(t * 4.4));
        rootY = eagerHop * 0.1;
        bodyRotZ = Math.sin(t * 4.4) * 0.04;
        tailRotY = Math.sin(t * 8.5) * 0.38;
        armLRotZ = -(0.22 + Math.sin(t * 8.8) * 0.14);
        armRRotZ = +(0.22 + Math.sin(t * 8.8) * 0.14);
      }
    }

    // Layer Party Animals spring-physics & limb choreography when inside Brawl Arena
    if (pm) {
      const sq = pm.squashY.value;
      const invSq = 1 / Math.sqrt(Math.max(0.55, sq));
      bodyScaleY *= sq;
      bodyScaleX *= invSq;
      bodyScaleZ *= invSq;

      // Secondary floppy inertia on head, ears, and tail
      const lagX = pm.headLagX.value;
      const lagZ = pm.headLagZ.value;
      headRotX += lagX;
      headRotZ += lagZ;
      earLRotX += lagX * 1.35;
      earRRotX += lagX * 1.35;
      earLRotZ += lagZ * 1.15 - Math.abs(lagX) * 0.32;
      earRRotZ += lagZ * 1.15 + Math.abs(lagX) * 0.32;
      tailRotX += lagX * 1.15;
      tailRotY -= lagZ * 1.5;

      const act = pm.action;
      const prog = pm.actionProgress;

      if (act === 'run') {
        const amp = Math.min(1.35, pm.speedNorm) * (pm.sprinting ? 1.2 : 0.88);
        const swing = Math.sin(pm.walkPhase) * amp;
        armLRotX = swing;
        armRRotX = -swing;
        armLRotZ = -(0.24 + Math.abs(swing) * 0.22);
        armRRotZ = +(0.24 + Math.abs(swing) * 0.22);
        earLRotZ -= Math.abs(Math.sin(pm.walkPhase)) * 0.24 * pm.speedNorm;
        earRRotZ += Math.abs(Math.cos(pm.walkPhase)) * 0.24 * pm.speedNorm;
        tailRotY += Math.sin(pm.walkPhase * 1.5) * 0.48 * Math.min(1.2, pm.speedNorm);
      } else if (act === 'punch_left') {
        const p = Math.sin(prog * Math.PI);
        armLRotX = -1.8 * p;
        armLRotZ = -0.32 * p;
        armRRotX = 0.75 * p;
        armRRotZ = 0.28;
        rootRotY = -0.46 * p;
        headRotY += 0.24 * p;
      } else if (act === 'punch_right') {
        const p = Math.sin(prog * Math.PI);
        armRRotX = -1.8 * p;
        armRRotZ = 0.32 * p;
        armLRotX = 0.75 * p;
        armLRotZ = -0.28;
        rootRotY = 0.46 * p;
        headRotY -= 0.24 * p;
      } else if (act === 'headbutt') {
        const p = Math.sin(prog * Math.PI);
        headRotX += 0.68 * p;
        bodyRotX += 0.3 * p;
        armLRotX = 1.15 * p;
        armRRotX = 1.15 * p;
        armLRotZ = -0.45 * p;
        armRRotZ = 0.45 * p;
        earLRotX -= 0.45 * p;
        earRRotX -= 0.45 * p;
      } else if (act === 'dropkick' || act === 'dropkick_slide') {
        armLRotX = -0.95;
        armRRotX = -0.95;
        armLRotZ = -0.82;
        armRRotZ = 0.82;
        headRotX -= 0.32;
        earLRotX -= 0.38;
        earRRotX -= 0.38;
      } else if (act === 'grab_hold') {
        const strain = Math.sin(t * 14) * 0.08;
        armLRotX = -1.42 + strain;
        armRRotX = -1.42 - strain;
        armLRotZ = 0.22;
        armRRotZ = -0.22;
        bodyRotX += 0.14;
      } else if (act === 'grabbed' || act === 'stunned') {
        armLRotX = Math.sin(t * 24) * 1.15;
        armRRotX = Math.cos(t * 24) * 1.15;
        armLRotZ = -(0.72 + Math.sin(t * 19) * 0.42);
        armRRotZ = +(0.72 + Math.cos(t * 19) * 0.42);
        headRotZ += Math.sin(t * 15) * 0.28;
        headRotX += Math.cos(t * 13) * 0.22;
      } else if (act === 'jump' || act === 'fall') {
        armLRotZ = -(0.68 + Math.sin(t * 15) * 0.24);
        armRRotZ = +(0.68 + Math.cos(t * 15) * 0.24);
        armLRotX = Math.sin(t * 15) * 0.45;
        armRRotX = -Math.sin(t * 15) * 0.45;
      } else if (act === 'wakeup') {
        const w = (1 - prog) * Math.sin(prog * Math.PI * 3);
        rootRotY += w * 0.45;
        armLRotZ = -0.8 * (1 - prog);
        armRRotZ = 0.8 * (1 - prog);
      }
    }

    if (root) {
      const base = getBaseTransform(root);
      root.position.x = THREE.MathUtils.lerp(root.position.x, base.pos[0] + rootX, smooth);
      root.position.y = THREE.MathUtils.lerp(root.position.y, base.pos[1] + rootY, smooth);
      root.position.z = THREE.MathUtils.lerp(root.position.z, base.pos[2] + rootZ, smooth);
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, base.rot[1] + rootRotY, smooth);
    }

    if (body) {
      const base = getBaseTransform(body);
      body.scale.x = THREE.MathUtils.lerp(body.scale.x, base.scale[0] * bodyScaleX, smooth);
      body.scale.y = THREE.MathUtils.lerp(body.scale.y, base.scale[1] * bodyScaleY, smooth);
      body.scale.z = THREE.MathUtils.lerp(body.scale.z, base.scale[2] * bodyScaleZ, smooth);
      body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, base.rot[0] + bodyRotX, smooth);
      body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, base.rot[2] + bodyRotZ, smooth);
    }

    if (head) {
      const base = getBaseTransform(head);
      head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, base.rot[0] + headRotX, smooth);
      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, base.rot[1] + headRotY, smooth);
      head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, base.rot[2] + headRotZ, smooth);
    }

    if (earL) {
      const base = getBaseTransform(earL);
      earL.rotation.x = THREE.MathUtils.lerp(earL.rotation.x, base.rot[0] + earLRotX, smooth);
      earL.rotation.z = THREE.MathUtils.lerp(earL.rotation.z, base.rot[2] + earLRotZ, smooth);
    }

    if (earR) {
      const base = getBaseTransform(earR);
      earR.rotation.x = THREE.MathUtils.lerp(earR.rotation.x, base.rot[0] + earRRotX, smooth);
      earR.rotation.z = THREE.MathUtils.lerp(earR.rotation.z, base.rot[2] + earRRotZ, smooth);
    }

    if (armL) {
      const base = getBaseTransform(armL);
      armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, base.rot[0] + armLRotX, smooth);
      armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, base.rot[2] + armLRotZ, smooth);
    }

    if (armR) {
      const base = getBaseTransform(armR);
      armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, base.rot[0] + armRRotX, smooth);
      armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, base.rot[2] + armRRotZ, smooth);
    }

    if (tail) {
      const base = getBaseTransform(tail);
      tail.rotation.x = THREE.MathUtils.lerp(tail.rotation.x, base.rot[0] + tailRotX, smooth);
      tail.rotation.y = THREE.MathUtils.lerp(tail.rotation.y, base.rot[1] + tailRotY, smooth);
    }

    const eyes = refs.eyes?.current;
    if (eyes) {
      const base = getBaseTransform(eyes);
      const blinkY = computeBlinkScaleY(state.clock.elapsedTime, phaseRef.current, emotion);
      eyes.scale.y = base.scale[1] * blinkY;
    }
  });
}

function createStarShape(outerR = 0.085, innerR = 0.04): THREE.Shape {
  const shape = new THREE.Shape();
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points + Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export interface Face3DProps {
  emotion?: Emotion;
  y?: number;
  z?: number;
  eyeSpread?: number;
  snoutColor?: string;
  beakColor?: string;
  isBird?: boolean;
  halfLidded?: boolean;
  eyeScale?: number;
}

export function Face3D({
  emotion = 'idle',
  y = 0.02,
  z = 0.52,
  eyeSpread = 0.22,
  snoutColor,
  beakColor = '#FF9F43',
  isBird = false,
  halfLidded = false,
  eyeScale = 1,
}: Face3DProps) {
  const starGeo = useMemo(() => {
    const shape = createStarShape(0.085, 0.038);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.028,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.006,
      bevelSegments: 2,
    });
    geo.center();
    return geo;
  }, []);

  const eyeY = 0.06;
  const inkColor = '#231A16';

  return (
    <group position={[0, y, z]}>
      {/* Eyes */}
      {[-1, 1].map((side) => {
        const ex = side * eyeSpread;

        if (emotion === 'happy') {
          return (
            <group key={side} position={[ex, eyeY - 0.01, 0]} scale={eyeScale}>
              <mesh>
                <torusGeometry args={[0.062, 0.017, 10, 20, Math.PI]} />
                <meshStandardMaterial color={inkColor} roughness={0.35} />
              </mesh>
            </group>
          );
        }

        if (emotion === 'sad') {
          return (
            <group key={side} position={[ex, eyeY - 0.015, 0]} scale={eyeScale}>
              {/* Glossy droopy eye */}
              <mesh scale={[0.92, 0.92, 0.72]}>
                <sphereGeometry args={[0.068, 18, 18]} />
                <meshStandardMaterial color={inkColor} roughness={0.12} metalness={0.08} />
              </mesh>
              {/* Watery highlight */}
              <mesh position={[-0.02, 0.022, 0.048]}>
                <sphereGeometry args={[0.022, 12, 12]} />
                <meshBasicMaterial color="#FFFFFF" />
              </mesh>
              {/* Sad angled brow */}
              <mesh
                position={[0, 0.082, 0.015]}
                rotation={[0, 0, side * 0.35]}
              >
                <capsuleGeometry args={[0.012, 0.07, 6, 10]} />
                <meshStandardMaterial color={inkColor} roughness={0.4} />
              </mesh>
              {/* Tear drop */}
              <mesh position={[side * 0.025, -0.085, 0.03]} scale={[0.7, 1.15, 0.7]}>
                <sphereGeometry args={[0.024, 12, 12]} />
                <meshStandardMaterial
                  color="#7DD3FC"
                  emissive="#38BDF8"
                  emissiveIntensity={0.25}
                  roughness={0.1}
                />
              </mesh>
            </group>
          );
        }

        if (emotion === 'shock') {
          return (
            <group key={side} position={[ex, eyeY + 0.01, 0]} scale={eyeScale}>
              {/* Dark outline rim */}
              <mesh scale={[1, 1.08, 0.6]}>
                <sphereGeometry args={[0.088, 20, 20]} />
                <meshStandardMaterial color={inkColor} roughness={0.4} />
              </mesh>
              {/* Big white sclera */}
              <mesh position={[0, 0, 0.012]} scale={[1, 1.08, 0.6]}>
                <sphereGeometry args={[0.076, 20, 20]} />
                <meshStandardMaterial color="#FFFFFF" roughness={0.25} />
              </mesh>
              {/* Tiny pinpoint pupil */}
              <mesh position={[0, 0, 0.056]}>
                <sphereGeometry args={[0.024, 14, 14]} />
                <meshStandardMaterial color={inkColor} roughness={0.12} />
              </mesh>
            </group>
          );
        }

        if (emotion === 'win') {
          return (
            <mesh
              key={side}
              geometry={starGeo}
              position={[ex, eyeY + 0.01, 0.02]}
              scale={eyeScale}
            >
              <meshStandardMaterial
                color="#FACC15"
                emissive="#F59E0B"
                emissiveIntensity={0.45}
                roughness={0.22}
                metalness={0.2}
              />
            </mesh>
          );
        }

        // idle: sleek glossy vertical-oval dark plush bead eye + crisp specular catchlights
        return (
          <group key={side} position={[ex, eyeY, 0]} scale={eyeScale}>
            <mesh scale={[0.88, 1.14, 0.72]}>
              <sphereGeometry args={[0.072, 22, 22]} />
              <meshStandardMaterial
                color={inkColor}
                roughness={0.08}
                metalness={0.12}
              />
            </mesh>
            {/* Primary upper-left catchlight */}
            <mesh position={[-0.02, 0.032, 0.049]}>
              <sphereGeometry args={[0.022, 12, 12]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
            {/* Secondary tiny lower-right catchlight */}
            <mesh position={[0.018, -0.024, 0.051]}>
              <sphereGeometry args={[0.01, 10, 10]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
            {/* Optional adorable sassy half-lidded eyelid (e.g. grumpy-chill Cat) */}
            {halfLidded && (
              <group position={[0, 0.052, 0.028]} rotation={[0, 0, -side * 0.12]}>
                <mesh scale={[1.15, 0.42, 0.65]}>
                  <boxGeometry args={[0.135, 0.085, 0.08]} />
                  <meshStandardMaterial color="#7A7D86" roughness={0.88} />
                </mesh>
                <mesh position={[0, -0.018, 0.026]} rotation={[0, 0, Math.PI / 2]}>
                  <capsuleGeometry args={[0.01, 0.12, 6, 10]} />
                  <meshStandardMaterial color={inkColor} roughness={0.35} />
                </mesh>
              </group>
            )}
          </group>
        );
      })}

      {/* Shock sweat drop on upper-right temple */}
      {emotion === 'shock' && (
        <group position={[eyeSpread + 0.14, eyeY + 0.14, -0.02]}>
          <mesh scale={[0.75, 1.3, 0.75]}>
            <sphereGeometry args={[0.032, 12, 12]} />
            <meshStandardMaterial
              color="#7DD3FC"
              emissive="#38BDF8"
              emissiveIntensity={0.25}
              roughness={0.1}
            />
          </mesh>
        </group>
      )}

      {/* Rosy 3D Blush Cheeks */}
      {[-1, 1].map((side) => (
        <mesh
          key={`cheek-${side}`}
          position={[side * (eyeSpread + 0.09), -0.04, -0.02]}
          scale={[1.25, 0.72, 0.42]}
        >
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial
            color="#FF9EB5"
            roughness={0.7}
            transparent
            opacity={emotion === 'sad' ? 0.45 : 0.85}
          />
        </mesh>
      ))}

      {/* Bird Beak OR Mammal Snout & Mouth */}
      {isBird ? (
        <group position={[0, -0.04, 0.04]}>
          {/* Upper beak */}
          <mesh
            position={[0, emotion === 'shock' ? 0.025 : 0.01, 0.03]}
            rotation={[Math.PI / 2 - (emotion === 'shock' ? 0.2 : 0), 0, 0]}
            scale={[1.15, 1, 0.65]}
          >
            <coneGeometry args={[0.072, 0.14, 16]} />
            <meshStandardMaterial color={beakColor} roughness={0.45} />
          </mesh>
          {/* Lower beak */}
          <mesh
            position={[
              0,
              emotion === 'shock' || emotion === 'happy' || emotion === 'win' ? -0.035 : -0.015,
              0.018,
            ]}
            rotation={[
              Math.PI / 2 + (emotion === 'shock' || emotion === 'happy' || emotion === 'win' ? 0.35 : 0.08),
              0,
              0,
            ]}
            scale={[0.95, 0.85, 0.5]}
          >
            <coneGeometry args={[0.058, 0.11, 14]} />
            <meshStandardMaterial color={beakColor} roughness={0.48} />
          </mesh>
          {(emotion === 'shock' || emotion === 'happy' || emotion === 'win') && (
            <mesh position={[0, -0.012, 0.025]} scale={[0.8, 0.65, 0.5]}>
              <sphereGeometry args={[0.036, 12, 12]} />
              <meshStandardMaterial color="#E11D48" roughness={0.5} />
            </mesh>
          )}
        </group>
      ) : (
        <group position={[0, -0.045, 0.01]}>
          {/* Optional pastel snout pad */}
          {snoutColor && (
            <mesh position={[0, -0.01, -0.025]} scale={[1.25, 0.9, 0.72]}>
              <sphereGeometry args={[0.11, 18, 18]} />
              <meshStandardMaterial color={snoutColor} roughness={0.65} />
            </mesh>
          )}

          {/* Cute small nose */}
          <mesh position={[0, 0.032, 0.045]} scale={[1.25, 0.85, 0.7]}>
            <sphereGeometry args={[0.028, 14, 14]} />
            <meshStandardMaterial color={inkColor} roughness={0.28} />
          </mesh>

          {/* Mouth by emotion */}
          {emotion === 'idle' && (
            <group position={[0, -0.02, 0.035]}>
              <mesh position={[-0.028, 0, 0]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.028, 0.009, 8, 14, Math.PI]} />
                <meshStandardMaterial color={inkColor} roughness={0.4} />
              </mesh>
              <mesh position={[0.028, 0, 0]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.028, 0.009, 8, 14, Math.PI]} />
                <meshStandardMaterial color={inkColor} roughness={0.4} />
              </mesh>
            </group>
          )}

          {(emotion === 'happy' || emotion === 'win') && (
            <group position={[0, -0.032, 0.034]}>
              <mesh scale={[1.15, emotion === 'win' ? 1.05 : 0.85, 0.45]}>
                <sphereGeometry args={[0.052, 16, 16]} />
                <meshStandardMaterial color="#F43F5E" roughness={0.45} />
              </mesh>
              <mesh position={[0, 0.012, 0.015]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.052, 0.011, 8, 18, Math.PI]} />
                <meshStandardMaterial color={inkColor} roughness={0.4} />
              </mesh>
            </group>
          )}

          {emotion === 'sad' && (
            <mesh position={[0, -0.055, 0.038]}>
              <torusGeometry args={[0.042, 0.01, 8, 16, Math.PI]} />
              <meshStandardMaterial color={inkColor} roughness={0.4} />
            </mesh>
          )}

          {emotion === 'shock' && (
            <group position={[0, -0.042, 0.036]}>
              <mesh>
                <torusGeometry args={[0.042, 0.012, 10, 20]} />
                <meshStandardMaterial color={inkColor} roughness={0.4} />
              </mesh>
              <mesh position={[0, 0, -0.005]} scale={[1, 1, 0.35]}>
                <sphereGeometry args={[0.038, 14, 14]} />
                <meshStandardMaterial color="#E11D48" roughness={0.5} />
              </mesh>
            </group>
          )}
        </group>
      )}
    </group>
  );
}

export interface TurnRing3DProps {
  active: boolean;
  color?: string;
}

export function TurnRing3D({ active, color = '#fbbf24' }: TurnRing3DProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const sparksRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!active) return;
    const t = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 4) * 0.06;

    if (ringRef.current) {
      ringRef.current.scale.set(pulse, pulse, 1);
      ringRef.current.rotation.z = t * 0.8;
    }
    if (glowRef.current) {
      glowRef.current.scale.set(pulse * 1.05, pulse * 1.05, 1);
    }
    if (sparksRef.current) {
      sparksRef.current.rotation.y = t * 1.1;
    }
  });

  if (!active) return null;

  return (
    <group position={[0, 0.015, 0]}>
      {/* Main glowing floor ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.66, 0.032, 12, 40]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.9}
          roughness={0.25}
        />
      </mesh>

      {/* Soft translucent aura disc */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <ringGeometry args={[0.42, 0.72, 36]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.24}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Floating sparkles orbiting around the active character */}
      <group ref={sparksRef}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (i / 6) * Math.PI * 2;
          const radius = 0.72;
          const height = 0.25 + (i % 3) * 0.32;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * radius, height, Math.sin(angle) * radius]}
            >
              <octahedronGeometry args={[0.042, 0]} />
              <meshStandardMaterial
                color="#FEF08A"
                emissive={color}
                emissiveIntensity={1.1}
                roughness={0.2}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
