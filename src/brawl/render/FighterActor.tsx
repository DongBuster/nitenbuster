import { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  CapsuleCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';
import type { Emotion } from '../../engine/types';
import { Character3D } from '../../scene3d/Character3D';
import { BrawlMotionContext } from '../../scene3d/CharacterRig3D';
import { getSpawnPoints } from '../sim/arenaLayout';
import type { PartyMotionState } from '../sim/partyMotion';
import type { EmoteKind, FighterConfig, HeldWeaponKind } from '../sim/types';
import { HeldWeapon3D } from './ItemModel3D';
import type { BrawlWorldRuntime } from './worldRuntime';

const EMOTE_ICONS: Record<EmoteKind, string> = {
  wave: '👋',
  dance: '💃',
  taunt: '😜',
  cheer: '🎉',
};

export function FighterActor({
  config,
  totalFighters,
  runtime,
  isLocalPlayer,
  isRemoteClient = false,
}: {
  config: FighterConfig;
  totalFighters: number;
  runtime: BrawlWorldRuntime;
  isLocalPlayer?: boolean;
  isRemoteClient?: boolean;
}) {
  const showAsLocal = isLocalPlayer ?? !config.isBot;
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const visualRef = useRef<THREE.Group | null>(null);
  const weaponRef = useRef<THREE.Group | null>(null);
  const spinSlashRef = useRef<THREE.Mesh | null>(null);
  const partyMotionRef = useRef<PartyMotionState | null>(null);
  const freezeShellRef = useRef<THREE.Mesh | null>(null);
  const shieldShellRef = useRef<THREE.Mesh | null>(null);
  const stunStarsRef = useRef<THREE.Group | null>(null);

  const [emotion, setEmotion] = useState<Emotion>('idle');
  const [heldItem, setHeldItem] = useState<HeldWeaponKind>(null);
  const [emote, setEmote] = useState<EmoteKind | null>(null);
  const [balancePct, setBalancePct] = useState<number>(100);
  const [alive, setAlive] = useState<boolean>(true);

  const spawn = getSpawnPoints(totalFighters)[config.spawnIndex] ?? {
    x: 0,
    y: 0.9,
    z: 0,
    yaw: 0,
  };

  useEffect(() => {
    const entry = runtime.fighters.get(config.id);
    if (entry) {
      entry.body = bodyRef.current;
    }
    return () => {
      const current = runtime.fighters.get(config.id);
      if (current) current.body = null;
    };
  }, [config.id, runtime]);

  useFrame(({ clock }) => {
    const entry = runtime.fighters.get(config.id);
    if (!entry) return;
    if (bodyRef.current && entry.body !== bodyRef.current) {
      entry.body = bodyRef.current;
    }
    if (isRemoteClient && bodyRef.current) {
      bodyRef.current.setNextKinematicTranslation({
        x: entry.pos.x,
        y: entry.pos.y,
        z: entry.pos.z,
      });
    }
    partyMotionRef.current = entry.partyMotion;

    const now = runtime.nowSec;
    const isStunned = entry.status.stunnedUntil > now;
    const isWakeupImmune = entry.status.stunImmuneUntil > now;
    const isFrozen = entry.status.frozenUntil > now;
    const hasShield = entry.status.shieldUntil > now || isWakeupImmune;
    const pm = entry.partyMotion;
    const act = pm.action;
    const prog = pm.actionProgress;

    if (visualRef.current) {
      visualRef.current.rotation.y =
        act === 'spin_attack' ? entry.yaw + prog * Math.PI * 5 : entry.yaw;

      if (act === 'roll') {
        visualRef.current.rotation.x = prog * Math.PI * 2;
        visualRef.current.rotation.z = pm.tiltZ.value * 0.5;
        visualRef.current.position.y = 0;
      } else if (act === 'spin_attack') {
        visualRef.current.rotation.x = 0.14;
        visualRef.current.rotation.z = Math.sin(prog * Math.PI * 5) * 0.14;
        visualRef.current.position.y = Math.sin(prog * Math.PI) * 0.14;
      } else if (act === 'dropkick') {
        const kickPitch = -1.28 * Math.sin(Math.min(1, prog * 1.6) * (Math.PI / 2));
        visualRef.current.rotation.x = kickPitch;
        visualRef.current.rotation.z = pm.tiltZ.value * 0.4;
        visualRef.current.position.y = 0.28;
      } else if (act === 'dropkick_slide') {
        const slideRecover = 1 - prog;
        visualRef.current.rotation.x = -1.15 * slideRecover + pm.tiltX.value * prog;
        visualRef.current.rotation.z = pm.tiltZ.value * 0.5;
        visualRef.current.position.y = 0.16 * slideRecover;
      } else if (act === 'headbutt') {
        const lungePitch = Math.sin(prog * Math.PI) * 0.62;
        visualRef.current.rotation.x = pm.tiltX.value + lungePitch;
        visualRef.current.rotation.z = pm.tiltZ.value;
        visualRef.current.position.y = Math.sin(prog * Math.PI) * 0.08;
      } else if (act === 'punch_left' || act === 'punch_right') {
        const punchArc = Math.sin(prog * Math.PI);
        visualRef.current.rotation.x = pm.tiltX.value + punchArc * 0.28;
        visualRef.current.rotation.z =
          pm.tiltZ.value + (act === 'punch_left' ? 0.14 : -0.14) * punchArc;
        visualRef.current.position.y = punchArc * 0.04;
      } else if (act === 'wakeup') {
        const scramble = (1 - prog) * Math.cos(prog * Math.PI * 2.5);
        visualRef.current.rotation.x = scramble * 0.85 + pm.tiltX.value * prog;
        visualRef.current.rotation.z = scramble * 0.4 + pm.tiltZ.value * prog;
        visualRef.current.position.y = Math.sin(prog * Math.PI) * 0.18;
      } else if (entry.status.emote === 'dance' && pm.speedNorm <= 0.08) {
        visualRef.current.position.y = Math.abs(Math.sin(clock.elapsedTime * 10)) * 0.22;
        visualRef.current.rotation.x = pm.tiltX.value;
        visualRef.current.rotation.z = Math.sin(clock.elapsedTime * 10) * 0.14;
      } else {
        // Spring-driven wobble walk, jump, fall, or idle lean
        const s = Math.min(1.35, pm.speedNorm);
        const bob =
          !isStunned && !isFrozen && entry.grounded && s > 0.08
            ? Math.abs(Math.sin(pm.walkPhase)) * (pm.sprinting ? 0.15 : 0.11) * s
            : 0;
        visualRef.current.position.y = bob;
        visualRef.current.rotation.x = pm.tiltX.value;
        visualRef.current.rotation.z = pm.tiltZ.value;
      }
    }

    // Animate held weapon swing arc & horizontal 360° whirlwind sweep
    if (weaponRef.current) {
      if (act === 'spin_attack') {
        weaponRef.current.position.set(0.75, 0.92, 0.48);
        weaponRef.current.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
      } else if (act === 'punch_left' || act === 'punch_right') {
        const swing = Math.sin(prog * Math.PI);
        weaponRef.current.position.set(0.55, 0.9 + swing * 0.12, 0.48 + swing * 0.35);
        weaponRef.current.rotation.set(
          0.55 + swing * 1.15,
          (act === 'punch_left' ? 0.65 : -0.65) * swing,
          -0.28,
        );
      } else {
        const idleBob = Math.sin(clock.elapsedTime * 4) * 0.04;
        weaponRef.current.position.set(0.54, 0.88 + idleBob, 0.46);
        weaponRef.current.rotation.set(0.55, 0, -0.24);
      }
    }

    if (spinSlashRef.current) {
      const spinning = act === 'spin_attack';
      spinSlashRef.current.visible = spinning;
      if (spinning) {
        spinSlashRef.current.rotation.z -= 0.45;
        const pulse = 1 + Math.sin(prog * Math.PI) * 0.22;
        spinSlashRef.current.scale.set(pulse, pulse, 1);
      }
    }

    if (freezeShellRef.current) freezeShellRef.current.visible = isFrozen;
    if (shieldShellRef.current) shieldShellRef.current.visible = hasShield;
    if (stunStarsRef.current) {
      stunStarsRef.current.visible = isStunned;
      if (isStunned) stunStarsRef.current.rotation.y += 0.12;
    }

    // Throttle low-frequency React UI state sync
    const desiredEmotion: Emotion = isStunned
      ? 'shock'
      : isFrozen
        ? 'sad'
        : entry.status.emote === 'cheer' || entry.status.emote === 'dance'
          ? 'happy'
          : 'idle';

    if (desiredEmotion !== emotion) setEmotion(desiredEmotion);
    if (entry.status.heldItem !== heldItem) setHeldItem(entry.status.heldItem);
    if (entry.status.emote !== emote) setEmote(entry.status.emote);
    if (entry.status.alive !== alive) setAlive(entry.status.alive);

    const roundedBalance = Math.round(
      (entry.status.balance / Math.max(1, entry.status.maxBalance)) * 100,
    );
    if (Math.abs(roundedBalance - balancePct) >= 4 || roundedBalance === 100) {
      if (roundedBalance !== balancePct) setBalancePct(roundedBalance);
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      type={isRemoteClient ? 'kinematicPosition' : 'dynamic'}
      position={[spawn.x, spawn.y, spawn.z]}
      colliders={false}
      enabledRotations={[false, false, false]}
      linearDamping={0.85}
      angularDamping={1.8}
      mass={1.4}
    >
      <CapsuleCollider
        args={[0.28, 0.44]}
        position={[0, 0.72, 0]}
        friction={0.45}
        restitution={0.18}
      />

      {/* Character visual root */}
      <group ref={visualRef} scale={0.72}>
        <BrawlMotionContext.Provider value={partyMotionRef}>
          <Character3D
            animal={config.animal}
            accessory={config.accessory}
            emotion={emotion}
            isActive={showAsLocal && alive}
          />
        </BrawlMotionContext.Provider>

        {/* Held sculpted weapon mesh animated in useFrame */}
        {heldItem && (
          <group ref={weaponRef} position={[0.54, 0.88, 0.46]} rotation={[0.55, 0, -0.24]}>
            <HeldWeapon3D kind={heldItem} nowSec={runtime.nowSec} />
          </group>
        )}
      </group>

      {/* 360° Whirlwind Spin slash ring */}
      <mesh
        ref={spinSlashRef}
        position={[0, 0.72, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[1.05, 1.85, 28]} />
        <meshBasicMaterial
          color={heldItem === 'shovel' ? '#F59E0B' : '#38BDF8'}
          transparent
          opacity={0.55}
          side={2}
        />
      </mesh>

      {/* Freeze ice cube shell */}
      <mesh ref={freezeShellRef} position={[0, 0.75, 0]} visible={false}>
        <boxGeometry args={[1.15, 1.45, 1.15]} />
        <meshStandardMaterial
          color="#7DD3FC"
          transparent
          opacity={0.5}
          roughness={0.15}
        />
      </mesh>

      {/* Shield golden bubble */}
      <mesh ref={shieldShellRef} position={[0, 0.72, 0]} visible={false}>
        <sphereGeometry args={[0.92, 20, 16]} />
        <meshStandardMaterial
          color="#FBBF24"
          transparent
          opacity={0.28}
          roughness={0.2}
        />
      </mesh>

      {/* Stun orbiting stars */}
      <group ref={stunStarsRef} position={[0, 1.65, 0]} visible={false}>
        {[0, 1, 2].map((idx) => {
          const angle = (idx * Math.PI * 2) / 3;
          return (
            <mesh
              key={idx}
              position={[Math.cos(angle) * 0.48, 0, Math.sin(angle) * 0.48]}
            >
              <octahedronGeometry args={[0.1]} />
              <meshStandardMaterial
                color="#FACC15"
                emissive="#F59E0B"
                emissiveIntensity={0.85}
              />
            </mesh>
          );
        })}
      </group>

      {/* Floating nameplate + balance meter + emote */}
      {alive && (
        <Html
          position={[0, 1.88, 0]}
          center
          distanceFactor={15}
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex flex-col items-center gap-0.5 select-none">
            {emote && (
              <div className="animate-bounce rounded-full bg-white px-2 py-0.5 text-sm shadow-lg">
                {EMOTE_ICONS[emote]}
              </div>
            )}
            <div
              className={`rounded-full px-2 py-0.5 text-[10px] font-black whitespace-nowrap shadow-md ${
                showAsLocal
                  ? 'border border-amber-200 bg-amber-400 text-[#2C1B11]'
                  : 'border border-white/25 bg-[#1B110B]/85 text-amber-100'
              }`}
            >
              {showAsLocal ? '▼ BẠN' : config.name}
            </div>
            {balancePct < 99 && (
              <div className="h-1 w-11 overflow-hidden rounded-full bg-black/50">
                <div
                  className={`h-full transition-all ${
                    balancePct > 50 ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                  style={{ width: `${balancePct}%` }}
                />
              </div>
            )}
          </div>
        </Html>
      )}
    </RigidBody>
  );
}
