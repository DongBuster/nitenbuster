import { useRef, useState, type RefObject } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  createPartyMotionState,
  stepPartyMotion,
  type PartyMotionState,
} from '../../brawl/sim/partyMotion';
import type { Emotion } from '../../engine/types';
import type { GlassEmotePayload, GlassRoomMember } from '../online/protocol';
import type { PlayerSlot } from '../sim/types';
import { Character3D } from '../../scene3d/Character3D';
import { BrawlMotionContext } from '../../scene3d/CharacterRig3D';
import type { GlassRenderState } from './renderTypes';

export interface CarrierActorProps {
  slot: PlayerSlot;
  member: GlassRoomMember;
  renderRef: RefObject<GlassRenderState>;
  emote: GlassEmotePayload | null;
}

const CHARACTER_BASE_SCALE = 0.72;

const SLOT_COLORS: Record<
  PlayerSlot,
  { ring: string; badgeClass: string; label: string }
> = {
  p1: {
    ring: '#fbbf24',
    badgeClass: 'border-amber-200 bg-amber-400 text-[#2C1B11]',
    label: 'P1',
  },
  p2: {
    ring: '#2dd4bf',
    badgeClass: 'border-teal-200 bg-teal-400 text-[#0F2926]',
    label: 'P2',
  },
};

export function CarrierActor({
  slot,
  member,
  renderRef,
  emote,
}: CarrierActorProps) {
  const rootRef = useRef<THREE.Group | null>(null);
  const visualRef = useRef<THREE.Group | null>(null);
  const partyMotionRef = useRef<PartyMotionState>(createPartyMotionState());

  const prevVxRef = useRef<number>(0);
  const prevVzRef = useRef<number>(0);
  const prevYawRef = useRef<number>(0);
  const wasGroundedRef = useRef<boolean>(true);
  const animTimeRef = useRef<number>(0);
  const liftScaleYRef = useRef<number>(1);
  const emotionRef = useRef<Emotion>('idle');

  const [emotion, setEmotion] = useState<Emotion>('idle');

  const slotVisual = SLOT_COLORS[slot];

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    animTimeRef.current += dt;

    const state = renderRef.current;
    const p = state[slot];
    const glass = state.glass;

    if (rootRef.current) {
      rootRef.current.position.set(p.x, p.y, p.z);
    }

    const pm = partyMotionRef.current;
    stepPartyMotion(
      pm,
      {
        nowSec: animTimeRef.current,
        vx: p.vx,
        vy: p.vy,
        vz: p.vz,
        prevVx: prevVxRef.current,
        prevVz: prevVzRef.current,
        yaw: p.yaw,
        prevYaw: prevYawRef.current,
        grounded: p.grounded,
        wasGrounded: wasGroundedRef.current,
        sprinting: false,
        isStunned: glass.shatterTimer > 0,
        isFrozen: false,
        isGrabbing: glass.shatterTimer <= 0,
        isGrabbed: false,
        rollUntil: 0,
        rollDuration: 0.3,
        punchUntil: 0,
        punchDuration: 0.24,
        punchHand: 'right',
        headbuttUntil: 0,
        headbuttDuration: 0.3,
        spinUntil: 0,
        spinDuration: 0.4,
        dropkickUntil: 0,
        dropkickDuration: 0.4,
        dropkickSlideUntil: 0,
        wakeupUntil: 0,
        wakeupDuration: 0.3,
      },
      dt,
    );

    prevVxRef.current = p.vx;
    prevVzRef.current = p.vz;
    prevYawRef.current = p.yaw;
    wasGroundedRef.current = p.grounded;

    const targetLiftScaleY =
      p.liftOffset < -0.25 ? 0.88 : p.liftOffset > 0.35 ? 1.06 : 1.0;
    const scaleAlpha = 1 - Math.exp(-14 * dt);
    liftScaleYRef.current = THREE.MathUtils.lerp(
      liftScaleYRef.current,
      targetLiftScaleY,
      scaleAlpha,
    );

    if (visualRef.current) {
      const s = Math.min(1.3, pm.speedNorm);
      const walkBob =
        p.grounded && glass.shatterTimer <= 0 && s > 0.08
          ? Math.abs(Math.sin(pm.walkPhase)) * 0.085 * s
          : 0;

      visualRef.current.position.y = walkBob;
      visualRef.current.rotation.y = p.yaw;
      visualRef.current.rotation.x = pm.tiltX.value;
      visualRef.current.rotation.z = pm.tiltZ.value;

      const sy = liftScaleYRef.current;
      const sxz = 1 / Math.sqrt(sy);
      visualRef.current.scale.set(
        CHARACTER_BASE_SCALE * sxz,
        CHARACTER_BASE_SCALE * sy,
        CHARACTER_BASE_SCALE * sxz,
      );
    }

    const desiredEmotion: Emotion =
      glass.shatterTimer > 0 || glass.stress > 0.72
        ? 'shock'
        : emote !== null
          ? 'happy'
          : 'idle';

    if (desiredEmotion !== emotionRef.current) {
      emotionRef.current = desiredEmotion;
      setEmotion(desiredEmotion);
    }
  });

  return (
    <group ref={rootRef}>
      {/* Grounded slot indicator ring */}
      <group position={[0, 0.025, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.48, 0.032, 10, 32]} />
          <meshStandardMaterial
            color={slotVisual.ring}
            emissive={slotVisual.ring}
            emissiveIntensity={0.75}
            roughness={0.25}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
          <ringGeometry args={[0.3, 0.49, 32]} />
          <meshBasicMaterial
            color={slotVisual.ring}
            transparent
            opacity={0.22}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Plush animal rig with forward grab arms */}
      <group ref={visualRef} scale={CHARACTER_BASE_SCALE}>
        <BrawlMotionContext.Provider value={partyMotionRef}>
          <Character3D
            animal={member.animal}
            emotion={emotion}
            accessory={member.accessory}
            isActive={false}
          />
        </BrawlMotionContext.Provider>
      </group>

      {/* Crisp floating nametag & active emote pill */}
      <Html
        position={[0, 1.56, 0]}
        center
        distanceFactor={15}
        style={{ pointerEvents: 'none' }}
      >
        <div className="flex flex-col items-center gap-1 select-none">
          {emote && (
            <div className="animate-bounce rounded-full border border-white/60 bg-white/95 px-2.5 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-slate-900 shadow-lg">
              <span>{emote.icon}</span> <span>{emote.text}</span>
            </div>
          )}
          <div
            className={`rounded-full border px-2 py-0.5 text-[10px] font-black whitespace-nowrap shadow-md ${slotVisual.badgeClass}`}
          >
            {slotVisual.label} · {member.name}
          </div>
        </div>
      </Html>
    </group>
  );
}
