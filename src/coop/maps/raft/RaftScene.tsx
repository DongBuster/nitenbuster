import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Environment, Html, Lightformer } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { playSfx } from '../../../audio/soundEngine';
import {
  createPartyMotionState,
  stepPartyMotion,
  type PartyMotionState,
} from '../../../brawl/sim/partyMotion';
import type { Emotion } from '../../../engine/types';
import { useGlassInput } from '../../../glass/input/useGlassInput';
import {
  GLASS_EMOTES,
  GLASS_INPUT_STALE_MS,
  type GlassEmotePayload,
  type GlassRoomMember,
} from '../../../glass/online/protocol';
import {
  CoopSnapshotPacer,
  isCriticalCoopEvent,
} from '../../online/snapshotCadence';
import type { GlassRoomController } from '../../../glass/online/useGlassRoom';
import type { GlassHudSnapshot } from '../../../glass/render/renderTypes';
import { FIXED_DT } from '../../../glass/sim/constants';
import { NEUTRAL_INPUT } from '../../../glass/sim/physics';
import type { PlayerInput, PlayerSlot } from '../../../glass/sim/types';
import { Character3D } from '../../../scene3d/Character3D';
import { BrawlMotionContext } from '../../../scene3d/CharacterRig3D';
import { CoopSnapshotInterpolator } from '../../online/coopInterpolation';
import {
  RAFT_BOOST_DURATION,
  RAFT_COURSE,
  RAFT_MAX_HP,
  evaluateRaftObstacles,
  getRaftStageNumberForZ,
} from './course';
import {
  createInitialRaftSimState,
  packRaftSnapshot,
  stepRaftSim,
} from './physics';
import type { RaftSimEvent, RaftSimState, RaftSnapshotPayload } from './types';

export interface CoopMapSceneProps {
  room: GlassRoomController;
  paused: boolean;
  onHudSnapshot: (hud: GlassHudSnapshot) => void;
}

interface RaftRenderState {
  matchTime: number;
  checkpointIndex: number;
  failures: number;
  raft: RaftSnapshotPayload['raft'];
  cameraShake: number;
}

const FALLBACK_P1_MEMBER: GlassRoomMember = {
  peerId: 'fallback-p1',
  name: 'P1',
  animal: 'dog',
  accessory: [],
  ready: true,
  joinedAt: 0,
};

const FALLBACK_P2_MEMBER: GlassRoomMember = {
  peerId: 'fallback-p2',
  name: 'P2',
  animal: 'cat',
  accessory: [],
  ready: true,
  joinedAt: 1,
};

const CHARACTER_BASE_SCALE = 0.66;
const CURRENT_STREAK_COUNT = 36;

const CHECKPOINT_COOL_COLOR = new THREE.Color('#38bdf8');
const CHECKPOINT_COOL_EMISSIVE = new THREE.Color('#0284c7');
const CHECKPOINT_WARM_COLOR = new THREE.Color('#fde047');
const CHECKPOINT_WARM_EMISSIVE = new THREE.Color('#f59e0b');

function createInitialRaftRenderState(
  sim: RaftSimState = createInitialRaftSimState(),
): RaftRenderState {
  return {
    matchTime: sim.matchTime,
    checkpointIndex: sim.checkpointIndex,
    failures: sim.failures,
    raft: {
      x: sim.raft.x,
      y: sim.raft.y,
      z: sim.raft.z,
      vx: sim.raft.vx,
      vy: sim.raft.vy,
      vz: sim.raft.vz,
      yaw: sim.raft.yaw,
      hp: sim.raft.hp,
      invulnTimer: sim.raft.invulnTimer,
      respawnTimer: sim.raft.respawnTimer,
      boostTimer: sim.raft.boostTimer,
      p1StrokeAnim: sim.raft.p1StrokeAnim,
      p2StrokeAnim: sim.raft.p2StrokeAnim,
      p1LeanX: sim.raft.p1LeanX,
      p2LeanX: sim.raft.p2LeanX,
      inWhirlpool: sim.raft.inWhirlpool,
    },
    cameraShake: 0,
  };
}

function copyRaftSimToRender(sim: RaftSimState, target: RaftRenderState): void {
  target.matchTime = sim.matchTime;
  target.checkpointIndex = sim.checkpointIndex;
  target.failures = sim.failures;
  target.raft.x = sim.raft.x;
  target.raft.y = sim.raft.y;
  target.raft.z = sim.raft.z;
  target.raft.vx = sim.raft.vx;
  target.raft.vy = sim.raft.vy;
  target.raft.vz = sim.raft.vz;
  target.raft.yaw = sim.raft.yaw;
  target.raft.hp = sim.raft.hp;
  target.raft.invulnTimer = sim.raft.invulnTimer;
  target.raft.respawnTimer = sim.raft.respawnTimer;
  target.raft.boostTimer = sim.raft.boostTimer;
  target.raft.p1StrokeAnim = sim.raft.p1StrokeAnim;
  target.raft.p2StrokeAnim = sim.raft.p2StrokeAnim;
  target.raft.p1LeanX = sim.raft.p1LeanX;
  target.raft.p2LeanX = sim.raft.p2LeanX;
  target.raft.inWhirlpool = sim.raft.inWhirlpool;
}

function copyRaftSnapshotToRender(
  snapshot: RaftSnapshotPayload,
  target: RaftRenderState,
): void {
  target.matchTime = snapshot.matchTime;
  target.checkpointIndex = snapshot.checkpointIndex;
  target.failures = snapshot.failures;
  Object.assign(target.raft, snapshot.raft);
}

function buildRaftHudSnapshot(renderState: RaftRenderState): GlassHudSnapshot {
  const stageNumber = getRaftStageNumberForZ(RAFT_COURSE, renderState.raft.z);
  const stageName =
    RAFT_COURSE.stages.find((s) => s.number === stageNumber)?.name ??
    RAFT_COURSE.stages[0]?.name ??
    '';
  const totalCheckpoints = Math.max(0, RAFT_COURSE.checkpoints.length - 1);
  const progressPct = Math.max(
    0,
    Math.min(100, (renderState.raft.z / RAFT_COURSE.finishZ) * 100),
  );
  const boostActive = renderState.raft.boostTimer > 0;
  const boostRatio = Math.max(
    0,
    Math.min(1, renderState.raft.boostTimer / RAFT_BOOST_DURATION),
  );
  const boostPct = Math.round(boostRatio * 100);
  const statusBadge =
    renderState.raft.respawnTimer > 0
      ? 'Lật phao! Hồi sinh...'
      : boostActive
        ? 'BOOST!'
        : renderState.raft.inWhirlpool
          ? 'Xoáy Nước!'
          : null;

  return {
    mapId: 'raft_rapids',
    matchTime: renderState.matchTime,
    stageNumber,
    stageName,
    checkpointIndex: renderState.checkpointIndex,
    totalCheckpoints,
    shatters: renderState.failures,
    failureLabel: 'Lật phao',
    glassHp: renderState.raft.hp,
    glassMaxHp: RAFT_MAX_HP,
    glassStress: renderState.raft.inWhirlpool ? 0.85 : boostRatio,
    primaryMeterPct: boostPct,
    primaryMeterLabel: 'Boost Lướt Sóng',
    statusBadge,
    boostActive,
    shatterTimer: renderState.raft.respawnTimer,
    shatterReason: null,
    p1Lift: renderState.raft.p1StrokeAnim,
    p2Lift: renderState.raft.p2StrokeAnim,
    progressPct,
  };
}

interface RaftWorldDriverProps {
  room: GlassRoomController;
  paused: boolean;
  readInput: () => PlayerInput;
  renderRef: RefObject<RaftRenderState>;
  onHudSnapshot: (hud: GlassHudSnapshot) => void;
}

function RaftWorldDriver({
  room,
  paused,
  readInput,
  renderRef,
  onHudSnapshot,
}: RaftWorldDriverProps) {
  const simRef = useRef<RaftSimState>(createInitialRaftSimState());
  const accumulatorRef = useRef<number>(0);
  const snapshotPacerRef = useRef(new CoopSnapshotPacer<RaftSimEvent>());
  const finishNotifiedRef = useRef<boolean>(false);
  const guestInputRef = useRef<{ input: PlayerInput; receivedAtMs: number }>({
    input: { ...NEUTRAL_INPUT },
    receivedAtMs: 0,
  });

  const interpolatorRef = useRef(
    new CoopSnapshotInterpolator<RaftSnapshotPayload>(),
  );
  const pendingGuestEventsRef = useRef<RaftSimEvent[]>([]);
  const lastProcessedEventIdRef = useRef<number>(0);
  const hudAccumRef = useRef<number>(0);
  const activeMatchIdRef = useRef<string>(room.matchId);

  const isHostRef = useRef<boolean>(room.isHost);
  isHostRef.current = room.isHost;

  const phaseRef = useRef(room.phase);
  phaseRef.current = room.phase;

  const roomMatchIdRef = useRef<string>(room.matchId);
  roomMatchIdRef.current = room.matchId;

  const pausedRef = useRef<boolean>(paused);
  pausedRef.current = paused;

  const onHudSnapshotRef = useRef(onHudSnapshot);
  onHudSnapshotRef.current = onHudSnapshot;

  const resetSimulationForMatch = useCallback(
    (nextMatchId: string) => {
      activeMatchIdRef.current = nextMatchId;
      const initialSim = createInitialRaftSimState();
      simRef.current = initialSim;
      accumulatorRef.current = 0;
      snapshotPacerRef.current.reset();
      finishNotifiedRef.current = false;
      guestInputRef.current = {
        input: { ...NEUTRAL_INPUT },
        receivedAtMs: 0,
      };
      interpolatorRef.current.reset();
      pendingGuestEventsRef.current = [];
      lastProcessedEventIdRef.current = 0;
      hudAccumRef.current = 0;

      copyRaftSimToRender(initialSim, renderRef.current);
      renderRef.current.cameraShake = 0;
      onHudSnapshotRef.current(buildRaftHudSnapshot(renderRef.current));
    },
    [renderRef],
  );

  useEffect(() => {
    if (activeMatchIdRef.current !== room.matchId) {
      resetSimulationForMatch(room.matchId);
    }
  }, [room.matchId, resetSimulationForMatch]);

  useEffect(() => {
    onHudSnapshotRef.current(buildRaftHudSnapshot(renderRef.current));
  }, [renderRef]);

  const { setGuestInputListener, setSnapshotListener } = room;

  useEffect(() => {
    setGuestInputListener((payload) => {
      if (!isHostRef.current) return;
      if (!payload.matchId || payload.matchId !== roomMatchIdRef.current) {
        return;
      }
      guestInputRef.current = {
        input: {
          moveX: payload.moveX,
          moveZ: payload.moveZ,
          jump: payload.jump,
          lift: payload.lift,
        },
        receivedAtMs: performance.now(),
      };
    });
    return () => {
      setGuestInputListener(null);
    };
  }, [setGuestInputListener]);

  useEffect(() => {
    setSnapshotListener((snapshot) => {
      if (isHostRef.current) return;
      if (snapshot.mapId !== 'raft_rapids') return;
      const expectedMatchId = roomMatchIdRef.current;
      if (expectedMatchId && snapshot.matchId !== expectedMatchId) {
        return;
      }
      if (snapshot.matchId !== activeMatchIdRef.current) {
        resetSimulationForMatch(snapshot.matchId);
      }
      interpolatorRef.current.push(snapshot, performance.now());
      if (snapshot.events.length > 0) {
        pendingGuestEventsRef.current.push(...snapshot.events);
      }
    });
    return () => {
      setSnapshotListener(null);
    };
  }, [resetSimulationForMatch, setSnapshotListener]);

  const processSimEvents = useCallback(
    (events: readonly RaftSimEvent[]) => {
      for (const evt of events) {
        if (evt.id <= lastProcessedEventIdRef.current) continue;
        lastProcessedEventIdRef.current = evt.id;

        switch (evt.kind) {
          case 'paddle_p1':
          case 'paddle_p2':
            playSfx('paddleSplash');
            break;
          case 'raft_boost':
            playSfx('raftBoost');
            break;
          case 'raft_jump':
            playSfx('roll');
            break;
          case 'raft_hit':
            playSfx('punch');
            renderRef.current.cameraShake = Math.max(
              renderRef.current.cameraShake,
              0.55,
            );
            break;
          case 'raft_capsize':
            playSfx('ko');
            renderRef.current.cameraShake = Math.max(
              renderRef.current.cameraShake,
              0.95,
            );
            break;
          case 'checkpoint':
            playSfx('checkpoint');
            break;
          case 'course_clear':
            playSfx('win');
            break;
          case 'respawn':
            break;
        }
      }
    },
    [renderRef],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const activePhase = phaseRef.current;
    const isPlaying = activePhase === 'playing';
    const localInput =
      isPlaying && !pausedRef.current ? readInput() : NEUTRAL_INPUT;

    if (isHostRef.current) {
      if (isPlaying && !pausedRef.current) {
        const nowMs = performance.now();
        const guestRec = guestInputRef.current;
        const guestStale =
          guestRec.receivedAtMs === 0 ||
          nowMs - guestRec.receivedAtMs > GLASS_INPUT_STALE_MS;
        const p2Input: PlayerInput = guestStale
          ? { ...NEUTRAL_INPUT }
          : guestRec.input;

        accumulatorRef.current += dt;
        const frameEvents: RaftSimEvent[] = [];

        while (accumulatorRef.current >= FIXED_DT) {
          accumulatorRef.current -= FIXED_DT;
          const nextSim = stepRaftSim(
            simRef.current,
            localInput,
            p2Input,
            FIXED_DT,
          );
          simRef.current = nextSim;
          if (nextSim.events.length > 0) {
            frameEvents.push(...nextSim.events);
          }
          if (nextSim.phase === 'finished') {
            accumulatorRef.current = 0;
            break;
          }
        }

        copyRaftSimToRender(simRef.current, renderRef.current);

        if (frameEvents.length > 0) {
          processSimEvents(frameEvents);
        }

        const justFinished =
          simRef.current.phase === 'finished' && !finishNotifiedRef.current;
        const { shouldBroadcast, events: pacedEvents } =
          snapshotPacerRef.current.step(
            nowMs,
            frameEvents,
            justFinished,
            isCriticalCoopEvent,
          );

        if (shouldBroadcast && roomMatchIdRef.current) {
          const packed = packRaftSnapshot(
            roomMatchIdRef.current,
            simRef.current,
          );
          if (pacedEvents.length > 0) {
            packed.events = pacedEvents;
          }
          room.broadcastSnapshot(packed);
        }

        if (justFinished) {
          finishNotifiedRef.current = true;
          onHudSnapshotRef.current(buildRaftHudSnapshot(renderRef.current));
          room.notifyMatchFinished(
            simRef.current.matchTime,
            simRef.current.failures,
          );
        }
      }
    } else {
      if (isPlaying && !pausedRef.current) {
        room.sendGuestInput(localInput);
      }
      if (isPlaying || activePhase === 'finished') {
        const sampled = interpolatorRef.current.sample(performance.now());
        if (sampled) {
          copyRaftSnapshotToRender(sampled, renderRef.current);
          if (sampled.events.length > 0) {
            pendingGuestEventsRef.current.push(...sampled.events);
          }
        }
        if (pendingGuestEventsRef.current.length > 0) {
          const batch = pendingGuestEventsRef.current;
          pendingGuestEventsRef.current = [];
          processSimEvents(batch);
        }
      }
    }

    hudAccumRef.current += dt;
    if (hudAccumRef.current >= 0.1) {
      hudAccumRef.current = 0;
      onHudSnapshotRef.current(buildRaftHudSnapshot(renderRef.current));
    }
  });

  return null;
}

function RaftFollowShadowLight({
  renderRef,
}: {
  renderRef: RefObject<RaftRenderState>;
}) {
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;
    const { x, z } = renderRef.current.raft;
    light.position.set(x + 9, 17, z - 6);
    targetObj.position.set(x, 0, z + 5);
    targetObj.updateMatrixWorld();
  });

  return (
    <>
      <primitive object={targetObj} />
      <directionalLight
        ref={lightRef}
        target={targetObj}
        position={[9, 17, -6]}
        intensity={1.5}
        color="#FFE8CC"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={54}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={18}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0005}
      />
    </>
  );
}

function RaftCamera({ renderRef }: { renderRef: RefObject<RaftRenderState> }) {
  const { camera } = useThree();
  const currentPosRef = useRef(new THREE.Vector3(0, 9.4, -11.2));
  const currentLookRef = useRef(new THREE.Vector3(0, 0.8, 5.2));
  const desiredPosRef = useRef(new THREE.Vector3());
  const desiredLookRef = useRef(new THREE.Vector3());

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const state = renderRef.current;
    const r = state.raft;

    desiredPosRef.current.set(
      r.x * 0.55,
      Math.max(0, r.y) + 9.4,
      r.z - 11.4,
    );
    desiredLookRef.current.set(
      r.x * 0.65,
      Math.max(0, r.y) + 0.75,
      r.z + 5.2,
    );

    const alpha = 1 - Math.exp(-6.5 * dt);
    currentPosRef.current.lerp(desiredPosRef.current, alpha);
    currentLookRef.current.lerp(desiredLookRef.current, alpha);

    const shake = state.cameraShake;
    let shakeX = 0;
    let shakeY = 0;
    if (shake > 0.005) {
      shakeX = (Math.random() - 0.5) * shake * 0.78;
      shakeY = (Math.random() - 0.5) * shake * 0.58;
      state.cameraShake = Math.max(0, shake - dt * 2.6);
    } else if (shake !== 0) {
      state.cameraShake = 0;
    }

    camera.position.set(
      currentPosRef.current.x + shakeX,
      currentPosRef.current.y + shakeY,
      currentPosRef.current.z,
    );
    camera.lookAt(currentLookRef.current);
  });

  return null;
}

interface RaftSeatActorProps {
  slot: PlayerSlot;
  member: GlassRoomMember;
  renderRef: RefObject<RaftRenderState>;
  emote: GlassEmotePayload | null;
}

const RAFT_SEAT_META: Record<
  PlayerSlot,
  { localX: number; sideSign: 1 | -1; ring: string; badgeClass: string; label: string }
> = {
  p1: {
    localX: 0.58,
    sideSign: 1,
    ring: '#fbbf24',
    badgeClass: 'border-amber-200 bg-amber-400 text-[#2C1B11]',
    label: 'P1',
  },
  p2: {
    localX: -0.58,
    sideSign: -1,
    ring: '#2dd4bf',
    badgeClass: 'border-teal-200 bg-teal-400 text-[#0F2926]',
    label: 'P2',
  },
};

function RaftSeatActor({
  slot,
  member,
  renderRef,
  emote,
}: RaftSeatActorProps) {
  const seatRef = useRef<THREE.Group | null>(null);
  const visualRef = useRef<THREE.Group | null>(null);
  const paddleRef = useRef<THREE.Group | null>(null);
  const partyMotionRef = useRef<PartyMotionState>(createPartyMotionState());

  const prevVxRef = useRef(0);
  const prevVzRef = useRef(0);
  const prevYawRef = useRef(0);
  const animTimeRef = useRef(0);
  const emotionRef = useRef<Emotion>('idle');
  const [emotion, setEmotion] = useState<Emotion>('idle');

  const meta = RAFT_SEAT_META[slot];

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    animTimeRef.current += dt;
    const { raft } = renderRef.current;

    const leanX = slot === 'p1' ? raft.p1LeanX : raft.p2LeanX;
    const strokeAnim = slot === 'p1' ? raft.p1StrokeAnim : raft.p2StrokeAnim;

    const pm = partyMotionRef.current;
    stepPartyMotion(
      pm,
      {
        nowSec: animTimeRef.current,
        vx: raft.vx * 0.4,
        vy: raft.vy,
        vz: raft.vz * 0.4,
        prevVx: prevVxRef.current,
        prevVz: prevVzRef.current,
        yaw: 0,
        prevYaw: prevYawRef.current,
        grounded: raft.y <= 0.05,
        wasGrounded: true,
        sprinting: raft.boostTimer > 0,
        isStunned: raft.respawnTimer > 0,
        isFrozen: false,
        isGrabbing: false,
        isGrabbed: false,
        rollUntil: 0,
        rollDuration: 0.3,
        punchUntil: 0,
        punchDuration: 0.24,
        punchHand: slot === 'p1' ? 'left' : 'right',
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

    prevVxRef.current = raft.vx * 0.4;
    prevVzRef.current = raft.vz * 0.4;
    prevYawRef.current = 0;

    if (seatRef.current) {
      seatRef.current.position.set(
        meta.localX + leanX * 0.14,
        0.24,
        0.04,
      );
    }

    if (visualRef.current) {
      const bob = Math.sin(animTimeRef.current * 4.2 + meta.sideSign) * 0.02;
      visualRef.current.position.y = bob;
      visualRef.current.rotation.z = -leanX * 0.26;
      visualRef.current.rotation.x =
        strokeAnim > 0 ? Math.sin(strokeAnim * Math.PI) * 0.24 : 0.05;
    }

    if (paddleRef.current) {
      const sweep =
        strokeAnim > 0
          ? Math.sin((1 - strokeAnim) * Math.PI * 1.8) * 0.9
          : Math.sin(animTimeRef.current * 2.2 + meta.sideSign) * 0.06;
      const dip =
        strokeAnim > 0
          ? -Math.sin(strokeAnim * Math.PI) * 0.38
          : 0.12;
      paddleRef.current.rotation.set(
        sweep,
        meta.sideSign * 0.18,
        meta.sideSign * (-0.52 + dip),
      );
    }

    const desiredEmotion: Emotion =
      raft.respawnTimer > 0 || raft.inWhirlpool
        ? 'shock'
        : raft.boostTimer > 0 || emote !== null
          ? 'happy'
          : 'idle';

    if (desiredEmotion !== emotionRef.current) {
      emotionRef.current = desiredEmotion;
      setEmotion(desiredEmotion);
    }
  });

  return (
    <group ref={seatRef} position={[meta.localX, 0.24, 0.04]}>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.42, 24]} />
        <meshBasicMaterial
          color={meta.ring}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

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

      {/* Wooden Paddle on outer side */}
      <group
        ref={paddleRef}
        position={[meta.sideSign * 0.48, 0.45, 0.1]}
        rotation={[0, meta.sideSign * 0.18, meta.sideSign * -0.52]}
      >
        <mesh position={[0, -0.45, 0]} castShadow>
          <cylinderGeometry args={[0.036, 0.036, 1.45, 8]} />
          <meshStandardMaterial color="#8c5633" roughness={0.78} />
        </mesh>
        <mesh position={[0, -1.12, 0]} castShadow>
          <boxGeometry args={[0.24, 0.44, 0.045]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.55} />
        </mesh>
      </group>

      <Html
        position={[0, 1.48, 0]}
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
            className={`rounded-full border px-2 py-0.5 text-[10px] font-black whitespace-nowrap shadow-md ${meta.badgeClass}`}
          >
            {meta.label} · {member.name}
          </div>
        </div>
      </Html>
    </group>
  );
}

function InflatableRaft3D({
  renderRef,
  p1Member,
  p2Member,
  p1Emote,
  p2Emote,
}: {
  renderRef: RefObject<RaftRenderState>;
  p1Member: GlassRoomMember;
  p2Member: GlassRoomMember;
  p1Emote: GlassEmotePayload | null;
  p2Emote: GlassEmotePayload | null;
}) {
  const raftRootRef = useRef<THREE.Group | null>(null);
  const hullGroupRef = useRef<THREE.Group | null>(null);
  const wakeRef = useRef<THREE.Mesh | null>(null);
  const wakeMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const timeRef = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    timeRef.current += dt;
    const { raft } = renderRef.current;

    if (raftRootRef.current) {
      const waterBob =
        raft.y <= 0.05 ? Math.sin(timeRef.current * 4.0) * 0.045 : 0;
      const sinkOffset = raft.respawnTimer > 0 ? -0.38 : 0;
      raftRootRef.current.position.set(
        raft.x,
        raft.y + waterBob + sinkOffset + 0.18,
        raft.z,
      );
      raftRootRef.current.rotation.y = raft.yaw;
    }

    if (hullGroupRef.current) {
      const avgLean = (raft.p1LeanX + raft.p2LeanX) * 0.5;
      const capsizeRoll =
        raft.respawnTimer > 0 ? Math.PI * 0.85 : -avgLean * 0.12;
      const pitch =
        raft.boostTimer > 0
          ? -0.11
          : Math.sin(timeRef.current * 3.2) * 0.025;
      hullGroupRef.current.rotation.z = capsizeRoll;
      hullGroupRef.current.rotation.x = pitch;

      const invulnBlink =
        raft.invulnTimer > 0 && Math.floor(timeRef.current * 14) % 2 === 0;
      hullGroupRef.current.scale.setScalar(invulnBlink ? 0.96 : 1);
    }

    if (wakeRef.current && wakeMatRef.current) {
      const boosting = raft.boostTimer > 0;
      const speedFactor = Math.min(1.5, Math.hypot(raft.vx, raft.vz) / 6);
      const pulse = 0.9 + Math.sin(timeRef.current * 18) * 0.12;
      wakeRef.current.visible = raft.y <= 0.35 && raft.respawnTimer <= 0;
      wakeRef.current.scale.set(
        boosting ? 1.45 * pulse : 0.95 + speedFactor * 0.25,
        1,
        boosting ? 1.85 * pulse : 0.85 + speedFactor * 0.4,
      );
      wakeMatRef.current.color.set(boosting ? '#e0f2fe' : '#f8fafc');
      wakeMatRef.current.emissive.set(boosting ? '#22d3ee' : '#7dd3fc');
      wakeMatRef.current.emissiveIntensity = boosting ? 1.1 : 0.32;
      wakeMatRef.current.opacity = boosting ? 0.9 : 0.55;
    }
  });

  return (
    <group ref={raftRootRef}>
      <group ref={hullGroupRef}>
        {/* Golden-orange inflatable outer ring */}
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1.02, 1.24, 1]}
          castShadow
          receiveShadow
        >
          <torusGeometry args={[1.05, 0.3, 14, 32]} />
          <meshStandardMaterial
            color="#f59e0b"
            roughness={0.42}
            metalness={0.08}
          />
        </mesh>

        {/* Bright orange accent trim straps */}
        {([-0.92, 0.92] as const).map((zOff) => (
          <mesh
            key={zOff}
            position={[0, 0.04, zOff]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.31, 0.31, 0.52, 12]} />
            <meshStandardMaterial color="#ea580c" roughness={0.45} />
          </mesh>
        ))}

        {/* Slate-wood interior deck */}
        <mesh
          position={[0, -0.04, 0]}
          scale={[0.92, 1, 1.15]}
          receiveShadow
          castShadow
        >
          <cylinderGeometry args={[0.94, 0.94, 0.16, 24]} />
          <meshStandardMaterial color="#475569" roughness={0.78} />
        </mesh>
        <mesh position={[0, 0.05, 0]} scale={[0.84, 1, 1.04]} receiveShadow>
          <cylinderGeometry args={[0.82, 0.82, 0.04, 20]} />
          <meshStandardMaterial color="#7c4724" roughness={0.84} />
        </mesh>

        {/* Rear foam wake */}
        <mesh
          ref={wakeRef}
          position={[0, -0.1, -1.68]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <coneGeometry args={[0.95, 1.85, 14]} />
          <meshStandardMaterial
            ref={wakeMatRef}
            color="#f8fafc"
            emissive="#7dd3fc"
            emissiveIntensity={0.35}
            transparent
            opacity={0.58}
            roughness={0.25}
          />
        </mesh>

        <RaftSeatActor
          slot="p1"
          member={p1Member}
          renderRef={renderRef}
          emote={p1Emote}
        />
        <RaftSeatActor
          slot="p2"
          member={p2Member}
          renderRef={renderRef}
          emote={p2Emote}
        />
      </group>
    </group>
  );
}

function createRaftTextures() {
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = 256;
  waterCanvas.height = 256;
  const wCtx = waterCanvas.getContext('2d');
  if (wCtx) {
    wCtx.fillStyle = '#0891b2';
    wCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 18; i += 1) {
      wCtx.fillStyle =
        i % 2 === 0 ? 'rgba(103, 232, 249, 0.22)' : 'rgba(14, 116, 144, 0.28)';
      wCtx.fillRect(0, i * 14, 256, 7);
    }
    wCtx.fillStyle = 'rgba(224, 242, 254, 0.24)';
    for (let x = 16; x < 256; x += 48) {
      wCtx.fillRect(x, 20, 6, 68);
      wCtx.fillRect((x + 24) % 256, 140, 5, 76);
    }
  }
  const water = new THREE.CanvasTexture(waterCanvas);
  water.colorSpace = THREE.SRGBColorSpace;
  water.wrapS = THREE.RepeatWrapping;
  water.wrapT = THREE.RepeatWrapping;
  water.repeat.set(3, 22);
  water.needsUpdate = true;

  const finCanvas = document.createElement('canvas');
  finCanvas.width = 256;
  finCanvas.height = 64;
  const fCtx = finCanvas.getContext('2d');
  if (fCtx) {
    const sq = 32;
    for (let r = 0; r < 2; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        fCtx.fillStyle = (r + c) % 2 === 0 ? '#fbbf24' : '#fef3c7';
        fCtx.fillRect(c * sq, r * sq, sq, sq);
      }
    }
  }
  const finish = new THREE.CanvasTexture(finCanvas);
  finish.colorSpace = THREE.SRGBColorSpace;
  finish.wrapS = THREE.RepeatWrapping;
  finish.wrapT = THREE.RepeatWrapping;
  finish.repeat.set(4, 1);
  finish.needsUpdate = true;

  return { water, finish };
}

const RaftCourseMesh = memo(function RaftCourseMesh({
  renderRef,
}: {
  renderRef: RefObject<RaftRenderState>;
}) {
  const textures = useMemo(() => createRaftTextures(), []);
  const streakGeo = useMemo(() => new THREE.BoxGeometry(0.14, 0.03, 2.2), []);
  const streakMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#e0f2fe',
        transparent: true,
        opacity: 0.55,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      textures.water.dispose();
      textures.finish.dispose();
      streakGeo.dispose();
      streakMat.dispose();
    };
  }, [streakGeo, streakMat, textures]);

  const logGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const whirlpoolRefs = useRef<(THREE.Group | null)[]>([]);
  const checkpointMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const streakRefs = useRef<(THREE.Mesh | null)[]>([]);

  const streakSpecs = useMemo(() => {
    return Array.from({ length: CURRENT_STREAK_COUNT }, (_, i) => ({
      x: ((i * 37) % 110) / 10 - 5.5,
      z0: ((i * 53) % 175) - 8,
      speed: i % 3 === 0 ? 7.5 : 5.2,
    }));
  }, []);

  const pinePositions = useMemo(() => {
    const list: { x: number; z: number; scale: number }[] = [];
    for (let z = -6; z <= 168; z += 9.5) {
      list.push({ x: -10.2 - ((z * 3) % 3), z, scale: 0.9 + ((z * 7) % 4) * 0.1 });
      list.push({ x: 10.2 + ((z * 5) % 3), z: z + 4, scale: 0.95 + ((z * 11) % 4) * 0.1 });
    }
    return list;
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const { matchTime, checkpointIndex } = renderRef.current;

    textures.water.offset.y -= dt * 0.42;

    const obs = evaluateRaftObstacles(RAFT_COURSE, matchTime);
    for (let i = 0; i < obs.logs.length; i += 1) {
      const grp = logGroupRefs.current[i];
      const log = obs.logs[i];
      if (grp && log) {
        grp.position.set(log.x, 0.12, log.z);
        grp.rotation.z = Math.sin(matchTime * 2 + i) * 0.04;
      }
    }

    for (let i = 0; i < obs.whirlpools.length; i += 1) {
      const grp = whirlpoolRefs.current[i];
      const wp = obs.whirlpools[i];
      if (grp && wp) {
        grp.rotation.y = wp.angle;
      }
    }

    for (let i = 0; i < streakSpecs.length; i += 1) {
      const m = streakRefs.current[i];
      const spec = streakSpecs[i];
      if (!m || !spec) continue;
      const curZ = m.position.z;
      const inRapids = curZ >= 96 && curZ <= 128;
      let nextZ = curZ + spec.speed * (inRapids ? 1.75 : 1) * dt;
      if (nextZ > 170) nextZ = -10;
      m.position.z = nextZ;
    }

    for (let i = 0; i < RAFT_COURSE.checkpoints.length; i += 1) {
      const cp = RAFT_COURSE.checkpoints[i];
      if (!cp) continue;
      const reached = checkpointIndex >= cp.index;
      for (let sideIdx = 0; sideIdx < 2; sideIdx += 1) {
        const mat = checkpointMatRefs.current[cp.index * 2 + sideIdx];
        if (!mat) continue;
        mat.color.copy(reached ? CHECKPOINT_WARM_COLOR : CHECKPOINT_COOL_COLOR);
        mat.emissive.copy(
          reached ? CHECKPOINT_WARM_EMISSIVE : CHECKPOINT_COOL_EMISSIVE,
        );
      }
    }
  });

  const riverW = RAFT_COURSE.riverHalfWidth * 2;

  return (
    <group>
      {/* Glacier cyan river surface */}
      <mesh position={[0, -0.05, 80]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[riverW, 186]} />
        <meshStandardMaterial
          map={textures.water}
          color="#22d3ee"
          roughness={0.22}
          metalness={0.12}
        />
      </mesh>

      {/* Stage 4 rapids water highlight */}
      <mesh position={[0, -0.03, 112]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[riverW - 0.3, 32]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.25} />
      </mesh>

      {/* Animated current streaks */}
      {streakSpecs.map((spec, idx) => (
        <mesh
          key={idx}
          ref={(el) => {
            streakRefs.current[idx] = el;
          }}
          geometry={streakGeo}
          material={streakMat}
          position={[spec.x, 0.01, spec.z0]}
        />
      ))}

      {/* Snowy embankment walls */}
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <mesh
            position={[side * (RAFT_COURSE.riverHalfWidth + 3.2), 0.55, 80]}
            receiveShadow
          >
            <boxGeometry args={[6.4, 1.6, 186]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.85} />
          </mesh>
          <mesh
            position={[side * (RAFT_COURSE.riverHalfWidth + 0.15), 0.35, 80]}
            receiveShadow
            castShadow
          >
            <boxGeometry args={[0.38, 0.95, 186]} />
            <meshStandardMaterial color="#5c351e" roughness={0.88} />
          </mesh>
        </group>
      ))}

      {/* Jagged snow-capped rocks */}
      {RAFT_COURSE.rocks.map((rock) => (
        <group key={rock.id} position={[rock.x, 0, rock.z]}>
          <mesh position={[0, rock.radius * 0.48, 0]} castShadow receiveShadow>
            <dodecahedronGeometry args={[rock.radius * 0.95, 0]} />
            <meshStandardMaterial color="#334155" roughness={0.88} />
          </mesh>
          <mesh position={[0, rock.radius * 0.92, 0]} castShadow>
            <coneGeometry args={[rock.radius * 0.65, rock.radius * 0.55, 6]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.72} />
          </mesh>
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[rock.radius * 0.85, rock.radius * 1.12, 18]} />
            <meshBasicMaterial
              color="#e0f2fe"
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}

      {/* Drifting wooden logs */}
      {RAFT_COURSE.logs.map((log, idx) => (
        <group
          key={log.id}
          ref={(el) => {
            logGroupRefs.current[idx] = el;
          }}
          position={[log.baseX, 0.12, log.z]}
        >
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry
              args={[log.radius, log.radius, log.halfLength * 2, 14]}
            />
            <meshStandardMaterial color="#7c4724" roughness={0.85} />
          </mesh>
          {([-1, 1] as const).map((end) => (
            <mesh
              key={end}
              position={[end * log.halfLength, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry
                args={[log.radius * 0.92, log.radius * 0.92, 0.08, 12]}
              />
              <meshStandardMaterial color="#d6b48c" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Spinning concentric whirlpool rings */}
      {RAFT_COURSE.whirlpools.map((wp, idx) => (
        <group
          key={wp.id}
          ref={(el) => {
            whirlpoolRefs.current[idx] = el;
          }}
          position={[wp.x, 0.015, wp.z]}
        >
          {[0.92, 0.65, 0.38].map((scale, rIdx) => (
            <mesh
              key={rIdx}
              rotation={[-Math.PI / 2, 0, rIdx * 1.1]}
              position={[0, rIdx * 0.004, 0]}
            >
              <ringGeometry
                args={[wp.radius * scale * 0.72, wp.radius * scale, 24, 1, 0, Math.PI * 1.55]}
              />
              <meshBasicMaterial
                color={rIdx === 2 ? '#ffffff' : '#67e8f9'}
                transparent
                opacity={0.62 - rIdx * 0.08}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Glowing checkpoint buoy arches */}
      {RAFT_COURSE.checkpoints
        .filter((cp) => cp.index > 0)
        .map((cp) => (
          <group key={cp.index} position={[0, 0, cp.triggerZ]}>
            {([-1, 1] as const).map((side) => (
              <group key={side} position={[side * (RAFT_COURSE.riverHalfWidth - 0.35), 0, 0]}>
                <mesh position={[0, 0.45, 0]} castShadow>
                  <cylinderGeometry args={[0.32, 0.42, 0.9, 12]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.5} />
                </mesh>
                <mesh position={[0, 1.35, 0]} castShadow>
                  <cylinderGeometry args={[0.12, 0.16, 1.1, 10]} />
                  <meshStandardMaterial color="#334155" roughness={0.6} />
                </mesh>
                <mesh position={[0, 2.05, 0]}>
                  <sphereGeometry args={[0.26, 14, 12]} />
                  <meshStandardMaterial
                    ref={(el) => {
                      checkpointMatRefs.current[
                        cp.index * 2 + (side === 1 ? 0 : 1)
                      ] = el;
                    }}
                    color={CHECKPOINT_COOL_COLOR}
                    emissive={CHECKPOINT_COOL_EMISSIVE}
                    emissiveIntensity={1.1}
                    roughness={0.22}
                  />
                </mesh>
              </group>
            ))}
          </group>
        ))}

      {/* Grand Lighthouse Finish Arch at z = 160 */}
      <group position={[0, 0, RAFT_COURSE.finishZ]}>
        {/* Checkered ribbon across water */}
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[riverW - 0.4, 1.1]} />
          <meshStandardMaterial
            map={textures.finish}
            emissive="#fbbf24"
            emissiveIntensity={0.35}
            roughness={0.4}
          />
        </mesh>

        {/* Left & Right Lighthouse Pillars */}
        {([-1, 1] as const).map((side) => (
          <group key={side} position={[side * (RAFT_COURSE.riverHalfWidth - 0.2), 0, 0]}>
            <mesh position={[0, 2.3, 0]} castShadow>
              <cylinderGeometry args={[0.38, 0.56, 4.6, 14]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.55} />
            </mesh>
            <mesh position={[0, 2.5, 0]}>
              <cylinderGeometry args={[0.45, 0.48, 0.7, 14]} />
              <meshStandardMaterial color="#ef4444" roughness={0.5} />
            </mesh>
            <mesh position={[0, 4.85, 0]}>
              <sphereGeometry args={[0.44, 14, 12]} />
              <meshStandardMaterial
                color="#fde047"
                emissive="#f59e0b"
                emissiveIntensity={1.35}
                roughness={0.2}
              />
            </mesh>
          </group>
        ))}

        {/* Golden crossbeam banner */}
        <mesh position={[0, 4.35, 0]} castShadow>
          <boxGeometry args={[riverW, 0.64, 0.45]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#f59e0b"
            emissiveIntensity={0.5}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0, 4.35, 0]}>
          <boxGeometry args={[riverW - 0.8, 0.34, 0.5]} />
          <meshStandardMaterial
            map={textures.finish}
            emissive="#fbbf24"
            emissiveIntensity={0.28}
          />
        </mesh>
      </group>

      {/* Snowy pine trees along banks */}
      {pinePositions.map((pine, idx) => (
        <group
          key={`pine-${idx}`}
          position={[pine.x, 1.2, pine.z]}
          scale={pine.scale}
        >
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.24, 0.34, 2.2, 7]} />
            <meshStandardMaterial color="#4a2e1b" roughness={0.92} />
          </mesh>
          <mesh position={[0, 3.2, 0]}>
            <coneGeometry args={[1.65, 3.4, 7]} />
            <meshStandardMaterial color="#183f31" roughness={0.88} />
          </mesh>
          <mesh position={[0, 4.7, 0]}>
            <coneGeometry args={[1.05, 2.1, 7]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.78} />
          </mesh>
        </group>
      ))}
    </group>
  );
});

export const RaftScene = memo(function RaftScene({
  room,
  paused,
  onHudSnapshot,
}: CoopMapSceneProps) {
  const renderRef = useRef<RaftRenderState>(createInitialRaftRenderState());

  const { sendEmote } = room;
  const handleEmote = useCallback(
    (emoteId: number) => {
      const idx = GLASS_EMOTES.findIndex((e) => e.id === emoteId);
      if (idx >= 0) {
        sendEmote(idx);
      }
    },
    [sendEmote],
  );

  const { readInput } = useGlassInput({
    enabled: room.phase === 'playing' && !paused,
    onEmote: handleEmote,
  });

  const p1Member = room.p1Member ?? FALLBACK_P1_MEMBER;
  const p2Member = room.p2Member ?? FALLBACK_P2_MEMBER;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 9.4, -11.2], fov: 46, near: 0.3, far: 180 }}
      className="h-full w-full"
    >
      <color attach="background" args={['#0d1b2e']} />
      <fog attach="fog" args={['#0d1b2e', 38, 105]} />

      <Environment resolution={128} frames={1}>
        <Lightformer
          form="ring"
          intensity={1.7}
          color="#FFE7C2"
          position={[0, 8, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={14}
        />
        <Lightformer
          form="circle"
          intensity={2.2}
          color="#FFB878"
          position={[-6, 4, 4]}
          rotation={[0, Math.PI / 3, 0]}
          scale={7}
        />
        <Lightformer
          form="rect"
          intensity={1.7}
          color="#CFE8FF"
          position={[-6, 5, -8]}
          rotation={[0, Math.PI / 6, 0]}
          scale={[10, 5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2.1}
          color="#FFD6A5"
          position={[4, 4, -6]}
          rotation={[0, -Math.PI / 5, 0]}
          scale={[10, 5, 1]}
        />
      </Environment>

      <ambientLight intensity={0.62} color="#F8FAFC" />
      <hemisphereLight args={['#FFF7ED', '#1E3A5F', 0.72]} />
      <directionalLight
        position={[-6, 9, -8]}
        intensity={0.55}
        color="#BAE6FD"
      />

      {/* Mount driver BEFORE 3D child renderers */}
      <RaftWorldDriver
        room={room}
        paused={paused}
        readInput={readInput}
        renderRef={renderRef}
        onHudSnapshot={onHudSnapshot}
      />

      <RaftFollowShadowLight renderRef={renderRef} />
      <RaftCamera renderRef={renderRef} />
      <RaftCourseMesh renderRef={renderRef} />

      <InflatableRaft3D
        renderRef={renderRef}
        p1Member={p1Member}
        p2Member={p2Member}
        p1Emote={room.activeEmotes.p1 ?? null}
        p2Emote={room.activeEmotes.p2 ?? null}
      />
    </Canvas>
  );
});
