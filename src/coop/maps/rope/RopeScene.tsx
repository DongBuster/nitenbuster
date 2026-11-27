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
  ROPE_COURSE,
  evaluateRopeCourse,
  getRopeStageNumberForZ,
} from './course';
import {
  createInitialRopeSimState,
  packRopeSnapshot,
  stepRopeSim,
} from './physics';
import type {
  RopeSimEvent,
  RopeSimState,
  RopeSnapshotPayload,
  RopeSnapshotPlayer,
} from './types';

export interface CoopMapSceneProps {
  room: GlassRoomController;
  paused: boolean;
  onHudSnapshot: (hud: GlassHudSnapshot) => void;
}

interface RopeRenderState {
  matchTime: number;
  checkpointIndex: number;
  failures: number;
  p1: RopeSnapshotPlayer;
  p2: RopeSnapshotPlayer;
  ropeLength: number;
  ropeStrain: number;
  respawnTimer: number;
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

const CHARACTER_BASE_SCALE = 0.72;
const ROPE_SEGMENTS = 10;
const WAIST_Y_OFFSET = 0.65;
const WIND_STREAKS_PER_ZONE = 10;
const UP_AXIS = new THREE.Vector3(0, 1, 0);

const ROPE_HEMP_COLOR = new THREE.Color('#eab308');
const ROPE_ORANGE_COLOR = new THREE.Color('#f97316');
const ROPE_DANGER_COLOR = new THREE.Color('#f43f5e');

const CHECKPOINT_COOL_COLOR = new THREE.Color('#38bdf8');
const CHECKPOINT_COOL_EMISSIVE = new THREE.Color('#0284c7');
const CHECKPOINT_WARM_COLOR = new THREE.Color('#fde047');
const CHECKPOINT_WARM_EMISSIVE = new THREE.Color('#f59e0b');

const WIND_WARN_COLOR = new THREE.Color('#7dd3fc');
const WIND_BLOW_COLOR = new THREE.Color('#f0f9ff');

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

function toSnapshotPlayer(p: RopeSimState['p1']): RopeSnapshotPlayer {
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    vx: p.vx,
    vy: p.vy,
    vz: p.vz,
    yaw: p.yaw,
    grounded: p.grounded,
    anchored: p.anchored,
    reeling: p.reeling,
    hanging: p.hanging,
  };
}

function createInitialRopeRenderState(
  sim: RopeSimState = createInitialRopeSimState(),
): RopeRenderState {
  return {
    matchTime: sim.matchTime,
    checkpointIndex: sim.checkpointIndex,
    failures: sim.failures,
    p1: toSnapshotPlayer(sim.p1),
    p2: toSnapshotPlayer(sim.p2),
    ropeLength: sim.ropeLength,
    ropeStrain: sim.ropeStrain,
    respawnTimer: sim.respawnTimer,
    cameraShake: 0,
  };
}

function copyRopeSimToRender(sim: RopeSimState, target: RopeRenderState): void {
  target.matchTime = sim.matchTime;
  target.checkpointIndex = sim.checkpointIndex;
  target.failures = sim.failures;
  Object.assign(target.p1, toSnapshotPlayer(sim.p1));
  Object.assign(target.p2, toSnapshotPlayer(sim.p2));
  target.ropeLength = sim.ropeLength;
  target.ropeStrain = sim.ropeStrain;
  target.respawnTimer = sim.respawnTimer;
}

function copyRopeSnapshotToRender(
  snapshot: RopeSnapshotPayload,
  target: RopeRenderState,
): void {
  target.matchTime = snapshot.matchTime;
  target.checkpointIndex = snapshot.checkpointIndex;
  target.failures = snapshot.failures;
  Object.assign(target.p1, snapshot.p1);
  Object.assign(target.p2, snapshot.p2);
  target.ropeLength = snapshot.ropeLength;
  target.ropeStrain = snapshot.ropeStrain;
  target.respawnTimer = snapshot.respawnTimer;
}

function buildRopeHudSnapshot(renderState: RopeRenderState): GlassHudSnapshot {
  const midZ = (renderState.p1.z + renderState.p2.z) * 0.5;
  const stageNumber = getRopeStageNumberForZ(ROPE_COURSE, midZ);
  const stageName =
    ROPE_COURSE.stages.find((s) => s.number === stageNumber)?.name ??
    ROPE_COURSE.stages[0]?.name ??
    '';
  const totalCheckpoints = Math.max(0, ROPE_COURSE.checkpoints.length - 1);
  const progressPct = Math.max(
    0,
    Math.min(100, (midZ / ROPE_COURSE.finishZ) * 100),
  );
  const strainRatio = Math.max(0, Math.min(1, renderState.ropeStrain));
  const strainPct = Math.round(strainRatio * 100);
  const hpFromStrain =
    renderState.respawnTimer > 0
      ? 0
      : strainRatio >= 0.75
        ? 1
        : strainRatio >= 0.4
          ? 2
          : 3;

  let statusBadge: string | null = null;
  if (renderState.respawnTimer > 0) {
    statusBadge = 'Đứt dây! Hồi sinh...';
  } else if (renderState.p1.hanging || renderState.p2.hanging) {
    statusBadge = 'Cứu Đồng Đội!';
  } else if (renderState.p1.reeling && renderState.p2.reeling) {
    statusBadge = 'Đang Kéo Dây!';
  } else if (renderState.p1.reeling) {
    statusBadge = 'P1 Đang Kéo';
  } else if (renderState.p2.reeling) {
    statusBadge = 'P2 Đang Kéo';
  } else if (renderState.p1.anchored && renderState.p2.anchored) {
    statusBadge = 'Cả Hai Đang Neo';
  } else if (renderState.p1.anchored) {
    statusBadge = 'P1 Đang Neo';
  } else if (renderState.p2.anchored) {
    statusBadge = 'P2 Đang Neo';
  }

  return {
    mapId: 'rope_tether',
    matchTime: renderState.matchTime,
    stageNumber,
    stageName,
    checkpointIndex: renderState.checkpointIndex,
    totalCheckpoints,
    shatters: renderState.failures,
    failureLabel: 'Đứt / Rơi',
    glassHp: hpFromStrain,
    glassMaxHp: 3,
    glassStress: strainRatio,
    primaryMeterPct: strainPct,
    primaryMeterLabel: 'Lực căng dây',
    statusBadge,
    shatterTimer: renderState.respawnTimer,
    shatterReason: null,
    p1Lift: renderState.p1.anchored ? -1 : renderState.p1.reeling ? 1 : 0,
    p2Lift: renderState.p2.anchored ? -1 : renderState.p2.reeling ? 1 : 0,
    progressPct,
  };
}

interface RopeWorldDriverProps {
  room: GlassRoomController;
  paused: boolean;
  readInput: () => PlayerInput;
  renderRef: RefObject<RopeRenderState>;
  onHudSnapshot: (hud: GlassHudSnapshot) => void;
}

function RopeWorldDriver({
  room,
  paused,
  readInput,
  renderRef,
  onHudSnapshot,
}: RopeWorldDriverProps) {
  const simRef = useRef<RopeSimState>(createInitialRopeSimState());
  const accumulatorRef = useRef<number>(0);
  const snapshotPacerRef = useRef(new CoopSnapshotPacer<RopeSimEvent>());
  const finishNotifiedRef = useRef<boolean>(false);
  const guestInputRef = useRef<{ input: PlayerInput; receivedAtMs: number }>({
    input: { ...NEUTRAL_INPUT },
    receivedAtMs: 0,
  });

  const interpolatorRef = useRef(
    new CoopSnapshotInterpolator<RopeSnapshotPayload>(),
  );
  const pendingGuestEventsRef = useRef<RopeSimEvent[]>([]);
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
      const initialSim = createInitialRopeSimState();
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

      copyRopeSimToRender(initialSim, renderRef.current);
      renderRef.current.cameraShake = 0;
      onHudSnapshotRef.current(buildRopeHudSnapshot(renderRef.current));
    },
    [renderRef],
  );

  useEffect(() => {
    if (activeMatchIdRef.current !== room.matchId) {
      resetSimulationForMatch(room.matchId);
    }
  }, [room.matchId, resetSimulationForMatch]);

  useEffect(() => {
    onHudSnapshotRef.current(buildRopeHudSnapshot(renderRef.current));
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
      if (snapshot.mapId !== 'rope_tether') return;
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
    (events: readonly RopeSimEvent[]) => {
      for (const evt of events) {
        if (evt.id <= lastProcessedEventIdRef.current) continue;
        lastProcessedEventIdRef.current = evt.id;

        switch (evt.kind) {
          case 'rope_anchor':
            playSfx('grab');
            break;
          case 'rope_pull':
            playSfx('ropePull');
            break;
          case 'rope_snap':
            playSfx('glassShatter');
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
        const frameEvents: RopeSimEvent[] = [];

        while (accumulatorRef.current >= FIXED_DT) {
          accumulatorRef.current -= FIXED_DT;
          const nextSim = stepRopeSim(
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

        copyRopeSimToRender(simRef.current, renderRef.current);

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
          const packed = packRopeSnapshot(
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
          onHudSnapshotRef.current(buildRopeHudSnapshot(renderRef.current));
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
          copyRopeSnapshotToRender(sampled, renderRef.current);
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
      onHudSnapshotRef.current(buildRopeHudSnapshot(renderRef.current));
    }
  });

  return null;
}

function RopeFollowShadowLight({
  renderRef,
}: {
  renderRef: RefObject<RopeRenderState>;
}) {
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;
    const { p1, p2 } = renderRef.current;
    const midX = (p1.x + p2.x) * 0.5;
    const midY = (p1.y + p2.y) * 0.5;
    const midZ = (p1.z + p2.z) * 0.5;
    light.position.set(midX + 8, midY + 16, midZ - 6);
    targetObj.position.set(midX, midY, midZ + 4);
    targetObj.updateMatrixWorld();
  });

  return (
    <>
      <primitive object={targetObj} />
      <directionalLight
        ref={lightRef}
        target={targetObj}
        position={[8, 16, -6]}
        intensity={1.45}
        color="#FFE8CC"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={52}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={16}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0005}
      />
    </>
  );
}

function RopeCamera({ renderRef }: { renderRef: RefObject<RopeRenderState> }) {
  const { camera } = useThree();
  const currentPosRef = useRef(new THREE.Vector3(0, 9.2, -10.5));
  const currentLookRef = useRef(new THREE.Vector3(0, 0.8, 3.5));
  const desiredPosRef = useRef(new THREE.Vector3());
  const desiredLookRef = useRef(new THREE.Vector3());

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const state = renderRef.current;
    const { p1, p2 } = state;

    const midX = (p1.x + p2.x) * 0.5;
    const midY = Math.max(-2.5, (p1.y + p2.y) * 0.5);
    const midZ = (p1.z + p2.z) * 0.5;
    const span = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    const spanZoom = THREE.MathUtils.clamp((span - 3.0) * 0.9, 0, 4.2);

    desiredPosRef.current.set(
      midX * 0.55,
      midY + 9.0 + spanZoom,
      midZ - 11.2 - spanZoom * 0.65,
    );
    desiredLookRef.current.set(midX * 0.65, midY + 0.85, midZ + 3.4);

    const alpha = 1 - Math.exp(-6 * dt);
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

function RopeActor({
  slot,
  member,
  renderRef,
  emote,
}: {
  slot: PlayerSlot;
  member: GlassRoomMember;
  renderRef: RefObject<RopeRenderState>;
  emote: GlassEmotePayload | null;
}) {
  const rootRef = useRef<THREE.Group | null>(null);
  const visualRef = useRef<THREE.Group | null>(null);
  const anchorGroupRef = useRef<THREE.Group | null>(null);
  const reelGroupRef = useRef<THREE.Group | null>(null);
  const partyMotionRef = useRef<PartyMotionState>(createPartyMotionState());

  const prevVxRef = useRef(0);
  const prevVzRef = useRef(0);
  const prevYawRef = useRef(0);
  const wasGroundedRef = useRef(true);
  const animTimeRef = useRef(0);
  const scaleYRef = useRef(1);
  const emotionRef = useRef<Emotion>('idle');
  const [emotion, setEmotion] = useState<Emotion>('idle');

  const slotVisual = SLOT_COLORS[slot];

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    animTimeRef.current += dt;

    const state = renderRef.current;
    const p = state[slot];

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
        isStunned: state.respawnTimer > 0,
        isFrozen: false,
        isGrabbing: p.reeling,
        isGrabbed: p.hanging,
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

    const targetScaleY = p.anchored ? 0.78 : p.reeling ? 0.94 : 1.0;
    scaleYRef.current = THREE.MathUtils.lerp(
      scaleYRef.current,
      targetScaleY,
      1 - Math.exp(-14 * dt),
    );

    if (visualRef.current) {
      const s = Math.min(1.3, pm.speedNorm);
      const walkBob =
        p.grounded && !p.anchored && state.respawnTimer <= 0 && s > 0.08
          ? Math.abs(Math.sin(pm.walkPhase)) * 0.085 * s
          : 0;
      const hangSwayZ = p.hanging
        ? Math.sin(animTimeRef.current * 6.5) * 0.16
        : 0;
      const hangSwayX = p.hanging
        ? Math.cos(animTimeRef.current * 5.2) * 0.09
        : 0;

      visualRef.current.position.y = walkBob;
      visualRef.current.rotation.y = p.yaw;
      visualRef.current.rotation.x = pm.tiltX.value + hangSwayX;
      visualRef.current.rotation.z = pm.tiltZ.value + hangSwayZ;

      const sy = scaleYRef.current;
      const sxz = 1 / Math.sqrt(sy);
      visualRef.current.scale.set(
        CHARACTER_BASE_SCALE * sxz,
        CHARACTER_BASE_SCALE * sy,
        CHARACTER_BASE_SCALE * sxz,
      );
    }

    if (anchorGroupRef.current) {
      anchorGroupRef.current.visible = p.anchored;
      if (p.anchored) {
        anchorGroupRef.current.rotation.y += dt * 1.8;
      }
    }

    if (reelGroupRef.current) {
      reelGroupRef.current.visible = p.reeling;
      if (p.reeling) {
        reelGroupRef.current.rotation.y -= dt * 5.5;
      }
    }

    const desiredEmotion: Emotion =
      state.respawnTimer > 0
        ? 'shock'
        : p.hanging
          ? 'sad'
          : emote !== null || p.reeling
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

      {/* Golden anchor lock ring & stakes when anchored */}
      <group ref={anchorGroupRef} visible={false} position={[0, 0.05, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.66, 0.055, 10, 28]} />
          <meshStandardMaterial
            color="#fde047"
            emissive="#f59e0b"
            emissiveIntensity={1.2}
            roughness={0.25}
          />
        </mesh>
        {[0, 1, 2, 3].map((k) => {
          const ang = (k * Math.PI) / 2;
          return (
            <mesh
              key={k}
              position={[Math.cos(ang) * 0.66, 0.14, Math.sin(ang) * 0.66]}
            >
              <coneGeometry args={[0.08, 0.28, 6]} />
              <meshStandardMaterial
                color="#fbbf24"
                emissive="#d97706"
                emissiveIntensity={0.8}
              />
            </mesh>
          );
        })}
      </group>

      {/* Glowing pull sparkles when reeling */}
      <group ref={reelGroupRef} visible={false} position={[0, 0.72, 0]}>
        {[0, 1, 2, 3, 4].map((k) => {
          const ang = (k * Math.PI * 2) / 5;
          return (
            <mesh
              key={k}
              position={[
                Math.cos(ang) * 0.55,
                (k % 2 === 0 ? 1 : -1) * 0.14,
                Math.sin(ang) * 0.55,
              ]}
            >
              <octahedronGeometry args={[0.09, 0]} />
              <meshStandardMaterial
                color="#fde047"
                emissive="#38bdf8"
                emissiveIntensity={1.4}
              />
            </mesh>
          );
        })}
      </group>

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

function CatenaryRope3D({
  renderRef,
}: {
  renderRef: RefObject<RopeRenderState>;
}) {
  const segRefs = useRef<(THREE.Mesh | null)[]>([]);
  const p1KnotRef = useRef<THREE.Mesh | null>(null);
  const p2KnotRef = useRef<THREE.Mesh | null>(null);

  const segGeo = useMemo(
    () => new THREE.CylinderGeometry(0.052, 0.052, 1, 8),
    [],
  );
  const ropeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#eab308',
        emissive: '#a16207',
        emissiveIntensity: 0.35,
        roughness: 0.55,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      segGeo.dispose();
      ropeMat.dispose();
    };
  }, [ropeMat, segGeo]);

  const pointsScratch = useMemo(
    () => Array.from({ length: ROPE_SEGMENTS + 1 }, () => new THREE.Vector3()),
    [],
  );
  const midScratch = useMemo(() => new THREE.Vector3(), []);
  const dirScratch = useMemo(() => new THREE.Vector3(), []);
  const quatScratch = useMemo(() => new THREE.Quaternion(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const timeRef = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    timeRef.current += dt;
    const state = renderRef.current;
    const { p1, p2, ropeStrain, respawnTimer } = state;

    const x1 = p1.x;
    const y1 = p1.y + WAIST_Y_OFFSET;
    const z1 = p1.z;

    const x2 = p2.x;
    const y2 = p2.y + WAIST_Y_OFFSET;
    const z2 = p2.z;

    const visible = respawnTimer <= 0;
    const dist = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    const slackSag = dist < 4.2 ? Math.max(0, (4.2 - dist) * 0.28) : 0;

    if (p1KnotRef.current) {
      p1KnotRef.current.visible = visible;
      p1KnotRef.current.position.set(x1, y1, z1);
    }
    if (p2KnotRef.current) {
      p2KnotRef.current.visible = visible;
      p2KnotRef.current.position.set(x2, y2, z2);
    }

    // Color shifts smoothly hemp #eab308 -> #f97316 -> pulsing #f43f5e
    if (ropeStrain < 0.5) {
      colorScratch.lerpColors(ROPE_HEMP_COLOR, ROPE_ORANGE_COLOR, ropeStrain * 2);
    } else {
      colorScratch.lerpColors(
        ROPE_ORANGE_COLOR,
        ROPE_DANGER_COLOR,
        (ropeStrain - 0.5) * 2,
      );
    }
    ropeMat.color.copy(colorScratch);
    ropeMat.emissive.copy(colorScratch);
    const pulse =
      ropeStrain > 0.65
        ? 0.55 + Math.abs(Math.sin(timeRef.current * 14)) * 0.85
        : 0.25 + ropeStrain * 0.3;
    ropeMat.emissiveIntensity = pulse;

    for (let i = 0; i <= ROPE_SEGMENTS; i += 1) {
      const u = i / ROPE_SEGMENTS;
      const sag = 4 * u * (1 - u) * slackSag;
      pointsScratch[i].set(
        x1 + (x2 - x1) * u,
        y1 + (y2 - y1) * u - sag,
        z1 + (z2 - z1) * u,
      );
    }

    for (let i = 0; i < ROPE_SEGMENTS; i += 1) {
      const mesh = segRefs.current[i];
      if (!mesh) continue;
      mesh.visible = visible;
      if (!visible) continue;

      const a = pointsScratch[i];
      const b = pointsScratch[i + 1];
      midScratch.addVectors(a, b).multiplyScalar(0.5);
      dirScratch.subVectors(b, a);
      const len = dirScratch.length();
      if (len > 1e-5) {
        dirScratch.divideScalar(len);
        quatScratch.setFromUnitVectors(UP_AXIS, dirScratch);
        mesh.position.copy(midScratch);
        mesh.quaternion.copy(quatScratch);
        mesh.scale.set(1, len, 1);
      }
    }
  });

  return (
    <group>
      <mesh ref={p1KnotRef} material={ropeMat}>
        <sphereGeometry args={[0.1, 10, 8]} />
      </mesh>
      <mesh ref={p2KnotRef} material={ropeMat}>
        <sphereGeometry args={[0.1, 10, 8]} />
      </mesh>
      {Array.from({ length: ROPE_SEGMENTS }, (_, idx) => (
        <mesh
          key={idx}
          ref={(el) => {
            segRefs.current[idx] = el;
          }}
          geometry={segGeo}
          material={ropeMat}
          castShadow
        />
      ))}
    </group>
  );
}

function createRopeTextures() {
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 256;
  woodCanvas.height = 256;
  const wCtx = woodCanvas.getContext('2d');
  if (wCtx) {
    wCtx.fillStyle = '#8c5633';
    wCtx.fillRect(0, 0, 256, 256);
    const plankW = 64;
    for (let i = 0; i < 4; i += 1) {
      wCtx.fillStyle =
        i % 2 === 0 ? 'rgba(255, 224, 185, 0.08)' : 'rgba(42, 20, 8, 0.1)';
      wCtx.fillRect(i * plankW, 0, plankW, 256);
      wCtx.fillStyle = 'rgba(35, 17, 7, 0.42)';
      wCtx.fillRect(i * plankW, 0, 3, 256);
    }
  }
  const wood = new THREE.CanvasTexture(woodCanvas);
  wood.colorSpace = THREE.SRGBColorSpace;
  wood.wrapS = THREE.RepeatWrapping;
  wood.wrapT = THREE.RepeatWrapping;
  wood.repeat.set(2, 4);
  wood.needsUpdate = true;

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

  return { wood, finish };
}

const RopeCourseMesh = memo(function RopeCourseMesh({
  renderRef,
}: {
  renderRef: RefObject<RopeRenderState>;
}) {
  const textures = useMemo(() => createRopeTextures(), []);
  const windStreakGeo = useMemo(() => new THREE.BoxGeometry(1.4, 0.06, 0.12), []);
  const windMaterials = useMemo(
    () =>
      ROPE_COURSE.windZones.map(
        () =>
          new THREE.MeshBasicMaterial({
            color: '#e0f2fe',
            transparent: true,
            opacity: 0,
          }),
      ),
    [],
  );

  useEffect(() => {
    return () => {
      textures.wood.dispose();
      textures.finish.dispose();
      windStreakGeo.dispose();
      for (const m of windMaterials) m.dispose();
    };
  }, [textures, windMaterials, windStreakGeo]);

  const movingIslandRefs = useRef<(THREE.Group | null)[]>([]);
  const pendulumGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const windGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const windFanRefs = useRef<(THREE.Group | null)[]>([]);
  const windStreakRefs = useRef<(THREE.Mesh | null)[][]>(
    ROPE_COURSE.windZones.map(() => []),
  );
  const checkpointMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  const windZoneStreaks = useMemo(
    () =>
      ROPE_COURSE.windZones.map((zone) => {
        const spanZ = zone.box.maxZ - zone.box.minZ;
        return Array.from({ length: WIND_STREAKS_PER_ZONE }, (_, i) => ({
          offsetX: ((i * 19) % 70) / 10,
          y: zone.box.minY + 0.4 + ((i * 7) % 10) * 0.22,
          z: zone.box.minZ + 0.5 + (i / WIND_STREAKS_PER_ZONE) * (spanZ - 1),
          speed: 7.5 + (i % 3) * 1.8,
        }));
      }),
    [],
  );

  const pinePositions = useMemo(() => {
    const list: { x: number; z: number; scale: number }[] = [];
    for (let z = -4; z <= 142; z += 11) {
      list.push({ x: -11 - ((z * 3) % 4), z, scale: 1.0 + ((z * 5) % 4) * 0.12 });
      list.push({ x: 11 + ((z * 7) % 4), z: z + 5, scale: 1.0 + ((z * 11) % 4) * 0.12 });
    }
    return list;
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const { matchTime, checkpointIndex } = renderRef.current;
    const obs = evaluateRopeCourse(ROPE_COURSE, matchTime);

    const staticCount = ROPE_COURSE.islands.length;
    for (let i = 0; i < ROPE_COURSE.movingIslands.length; i += 1) {
      const grp = movingIslandRefs.current[i];
      const isl = obs.islands[staticCount + i];
      if (grp && isl) {
        grp.position.set(
          (isl.box.minX + isl.box.maxX) * 0.5,
          (isl.box.minY + isl.box.maxY) * 0.5,
          (isl.box.minZ + isl.box.maxZ) * 0.5,
        );
      }
    }

    for (let i = 0; i < obs.pendulums.length; i += 1) {
      const grp = pendulumGroupRefs.current[i];
      const pend = obs.pendulums[i];
      if (grp && pend) {
        grp.rotation.z = pend.angle;
      }
    }

    for (let zIdx = 0; zIdx < obs.windZones.length; zIdx += 1) {
      const wz = obs.windZones[zIdx];
      const def = ROPE_COURSE.windZones[zIdx];
      const grp = windGroupRefs.current[zIdx];
      const fan = windFanRefs.current[zIdx];
      const mat = windMaterials[zIdx];
      if (!wz || !def || !grp || !mat) continue;

      const active = wz.state !== 'idle';
      grp.visible = active;
      if (fan) {
        fan.rotation.x += dt * (wz.state === 'blowing' ? 18 : wz.state === 'warning' ? 6 : 1.5);
      }
      if (!active) continue;

      const dir = Math.sign(wz.forceX) || 1;
      const widthX = wz.box.maxX - wz.box.minX;
      mat.color.copy(wz.state === 'blowing' ? WIND_BLOW_COLOR : WIND_WARN_COLOR);
      mat.opacity = wz.state === 'blowing' ? 0.72 : 0.35;

      const specs = windZoneStreaks[zIdx];
      for (let sIdx = 0; sIdx < specs.length; sIdx += 1) {
        const m = windStreakRefs.current[zIdx][sIdx];
        if (!m) continue;
        const speed = specs[sIdx].speed * (wz.state === 'blowing' ? 1.5 : 0.65);
        let nx = m.position.x + dir * speed * dt;
        if (dir > 0 && nx > wz.box.maxX) nx = wz.box.minX;
        if (dir < 0 && nx < wz.box.minX) nx = wz.box.maxX;
        if (!Number.isFinite(nx)) nx = wz.box.minX + (specs[sIdx].offsetX % widthX);
        m.position.x = nx;
      }
    }

    for (let i = 0; i < ROPE_COURSE.checkpoints.length; i += 1) {
      const cp = ROPE_COURSE.checkpoints[i];
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

  return (
    <group>
      {/* Static Snow/Ice Islands */}
      {ROPE_COURSE.islands.map((isl) => {
        const w = isl.box.maxX - isl.box.minX;
        const h = isl.box.maxY - isl.box.minY;
        const d = isl.box.maxZ - isl.box.minZ;
        const cx = (isl.box.minX + isl.box.maxX) * 0.5;
        const cy = (isl.box.minY + isl.box.maxY) * 0.5;
        const cz = (isl.box.minZ + isl.box.maxZ) * 0.5;
        const isIce = isl.surface === 'ice';

        return (
          <group key={isl.id} position={[cx, cy, cz]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              {isIce ? (
                <meshStandardMaterial
                  color="#7dd3fc"
                  emissive="#0369a1"
                  emissiveIntensity={0.22}
                  roughness={0.14}
                  metalness={0.2}
                />
              ) : (
                <meshStandardMaterial map={textures.wood} roughness={0.82} />
              )}
            </mesh>
            {/* Snow rim / frosted top edge */}
            <mesh position={[0, h * 0.5 - 0.04, 0]} receiveShadow>
              <boxGeometry args={[w + 0.08, 0.09, d + 0.08]} />
              <meshStandardMaterial
                color={isIce ? '#e0f2fe' : '#f1f5f9'}
                roughness={isIce ? 0.18 : 0.72}
              />
            </mesh>
          </group>
        );
      })}

      {/* Moving Islands */}
      {ROPE_COURSE.movingIslands.map((m, idx) => {
        const w = m.baseBox.maxX - m.baseBox.minX;
        const h = m.baseBox.maxY - m.baseBox.minY;
        const d = m.baseBox.maxZ - m.baseBox.minZ;
        const isIce = m.surface === 'ice';

        return (
          <group
            key={m.id}
            ref={(el) => {
              movingIslandRefs.current[idx] = el;
            }}
            position={[
              (m.baseBox.minX + m.baseBox.maxX) * 0.5,
              (m.baseBox.minY + m.baseBox.maxY) * 0.5,
              (m.baseBox.minZ + m.baseBox.maxZ) * 0.5,
            ]}
          >
            <mesh castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              {isIce ? (
                <meshStandardMaterial
                  color="#67e8f9"
                  emissive="#0284c7"
                  emissiveIntensity={0.28}
                  roughness={0.16}
                />
              ) : (
                <meshStandardMaterial map={textures.wood} roughness={0.82} />
              )}
            </mesh>
            <mesh position={[0, -h * 0.5 - 0.08, 0]}>
              <boxGeometry args={[w * 0.75, 0.14, d * 0.75]} />
              <meshStandardMaterial
                color="#fbbf24"
                emissive="#f59e0b"
                emissiveIntensity={0.55}
              />
            </mesh>
          </group>
        );
      })}

      {/* Stage 2 Wind Zones */}
      {ROPE_COURSE.windZones.map((zone, zIdx) => {
        const dir = Math.sign(zone.forceX) || 1;
        const blowerX = dir > 0 ? zone.box.minX - 0.5 : zone.box.maxX + 0.5;
        const midY = (zone.box.minY + zone.box.maxY) * 0.5;
        const midZ = (zone.box.minZ + zone.box.maxZ) * 0.5;
        const streaks = windZoneStreaks[zIdx];

        return (
          <group key={zone.id}>
            <group position={[blowerX, midY, midZ]}>
              <mesh castShadow>
                <boxGeometry args={[0.45, 2.2, zone.box.maxZ - zone.box.minZ - 1]} />
                <meshStandardMaterial color="#334155" metalness={0.55} roughness={0.4} />
              </mesh>
              <group
                ref={(el) => {
                  windFanRefs.current[zIdx] = el;
                }}
                position={[dir * 0.28, 0, 0]}
              >
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.16, 0.16, 0.14, 12]} />
                  <meshStandardMaterial
                    color="#38bdf8"
                    emissive="#0284c7"
                    emissiveIntensity={0.55}
                  />
                </mesh>
                <mesh>
                  <boxGeometry args={[0.06, 1.3, 0.24]} />
                  <meshStandardMaterial color="#bae6fd" />
                </mesh>
                <mesh>
                  <boxGeometry args={[0.06, 0.24, 1.3]} />
                  <meshStandardMaterial color="#bae6fd" />
                </mesh>
              </group>
            </group>

            <group
              ref={(el) => {
                windGroupRefs.current[zIdx] = el;
              }}
              visible={false}
            >
              {streaks.map((spec, sIdx) => (
                <mesh
                  key={sIdx}
                  ref={(el) => {
                    windStreakRefs.current[zIdx][sIdx] = el;
                  }}
                  geometry={windStreakGeo}
                  material={windMaterials[zIdx]}
                  position={[zone.box.minX + spec.offsetX, spec.y, spec.z]}
                />
              ))}
            </group>
          </group>
        );
      })}

      {/* Stage 3 Swinging Timber Pendulums */}
      {ROPE_COURSE.pendulums.map((p, idx) => (
        <group key={p.id}>
          <mesh position={[p.pivotX, p.pivotY, p.pivotZ]} castShadow>
            <boxGeometry args={[8.4, 0.34, 0.38]} />
            <meshStandardMaterial color="#4a2a17" roughness={0.85} />
          </mesh>
          {([-1, 1] as const).map((side) => (
            <mesh
              key={side}
              position={[side * 4.05, p.pivotY * 0.5 + 0.5, p.pivotZ]}
              castShadow
            >
              <boxGeometry args={[0.28, p.pivotY - 1, 0.32]} />
              <meshStandardMaterial color="#4a2a17" roughness={0.85} />
            </mesh>
          ))}

          <group
            ref={(el) => {
              pendulumGroupRefs.current[idx] = el;
            }}
            position={[p.pivotX, p.pivotY, p.pivotZ]}
          >
            <mesh>
              <sphereGeometry args={[0.24, 14, 12]} />
              <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} />
            </mesh>
            <mesh position={[0, -p.armLength * 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, p.armLength, 12]} />
              <meshStandardMaterial color="#64748b" metalness={0.65} roughness={0.35} />
            </mesh>
            <group position={[0, -p.armLength, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry
                  args={[p.bobRadius * 0.86, p.bobRadius * 0.86, p.bobRadius * 2.1, 16]}
                />
                <meshStandardMaterial color="#7c4724" roughness={0.72} />
              </mesh>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry
                  args={[p.bobRadius * 0.94, p.bobRadius * 0.94, 0.24, 16]}
                />
                <meshStandardMaterial
                  color="#ef4444"
                  emissive="#dc2626"
                  emissiveIntensity={0.45}
                />
              </mesh>
            </group>
          </group>
        </group>
      ))}

      {/* Checkpoint Lantern Arches */}
      {ROPE_COURSE.checkpoints
        .filter((cp) => cp.index > 0)
        .map((cp) => {
          const baseY = cp.p1Spawn.y;
          return (
            <group key={cp.index} position={[0, baseY, cp.triggerZ]}>
              {([-1, 1] as const).map((side) => (
                <group key={side} position={[side * 4.1, 0, 0]}>
                  <mesh position={[0, 1.4, 0]} castShadow>
                    <boxGeometry args={[0.28, 2.8, 0.28]} />
                    <meshStandardMaterial color="#5c351e" roughness={0.85} />
                  </mesh>
                  <mesh position={[0, 2.95, 0]}>
                    <octahedronGeometry args={[0.3, 0]} />
                    <meshStandardMaterial
                      ref={(el) => {
                        checkpointMatRefs.current[
                          cp.index * 2 + (side === 1 ? 0 : 1)
                        ] = el;
                      }}
                      color={CHECKPOINT_COOL_COLOR}
                      emissive={CHECKPOINT_COOL_EMISSIVE}
                      emissiveIntensity={1.15}
                    />
                  </mesh>
                </group>
              ))}
              <mesh position={[0, 2.75, 0]} castShadow>
                <boxGeometry args={[8.5, 0.24, 0.24]} />
                <meshStandardMaterial color="#5c351e" roughness={0.85} />
              </mesh>
            </group>
          );
        })}

      {/* Grand Glowing Lantern Peak Finish Arch at z = 135, y = 4.5 */}
      <group position={[0, 4.5, ROPE_COURSE.finishZ]}>
        {([-1, 1] as const).map((side) => (
          <group key={side} position={[side * 4.6, 0, 0]}>
            <mesh position={[0, 2.1, 0]} castShadow>
              <boxGeometry args={[0.42, 4.2, 0.42]} />
              <meshStandardMaterial color="#5c351e" roughness={0.82} />
            </mesh>
            <mesh position={[0, 4.45, 0]}>
              <sphereGeometry args={[0.4, 14, 12]} />
              <meshStandardMaterial
                color="#fde047"
                emissive="#f59e0b"
                emissiveIntensity={1.35}
              />
            </mesh>
          </group>
        ))}

        <mesh position={[0, 4.1, 0]} castShadow>
          <boxGeometry args={[9.6, 0.62, 0.48]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#f59e0b"
            emissiveIntensity={0.55}
            roughness={0.28}
          />
        </mesh>
        <mesh position={[0, 4.1, 0]}>
          <boxGeometry args={[8.6, 0.34, 0.52]} />
          <meshStandardMaterial
            map={textures.finish}
            emissive="#fbbf24"
            emissiveIntensity={0.25}
          />
        </mesh>
        <mesh position={[0, 0.06, 0]} receiveShadow>
          <boxGeometry args={[9.2, 0.02, 0.85]} />
          <meshStandardMaterial
            map={textures.finish}
            emissive="#fbbf24"
            emissiveIntensity={0.22}
          />
        </mesh>
      </group>

      {/* Winter Abyss & Snowy Pines */}
      <mesh position={[0, -11, 70]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[260, 260]} />
        <meshBasicMaterial color="#091526" />
      </mesh>
      {pinePositions.map((pine, idx) => (
        <group
          key={`pine-${idx}`}
          position={[pine.x, -2.5, pine.z]}
          scale={pine.scale}
        >
          <mesh position={[0, 1.3, 0]}>
            <cylinderGeometry args={[0.26, 0.38, 2.6, 7]} />
            <meshStandardMaterial color="#4a2e1b" roughness={0.92} />
          </mesh>
          <mesh position={[0, 3.6, 0]}>
            <coneGeometry args={[1.75, 3.6, 7]} />
            <meshStandardMaterial color="#183f31" roughness={0.88} />
          </mesh>
          <mesh position={[0, 5.2, 0]}>
            <coneGeometry args={[1.15, 2.3, 7]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.78} />
          </mesh>
        </group>
      ))}
    </group>
  );
});

export const RopeScene = memo(function RopeScene({
  room,
  paused,
  onHudSnapshot,
}: CoopMapSceneProps) {
  const renderRef = useRef<RopeRenderState>(createInitialRopeRenderState());

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
      camera={{ position: [0, 9.2, -10.5], fov: 46, near: 0.3, far: 170 }}
      className="h-full w-full"
    >
      <color attach="background" args={['#0d1b2e']} />
      <fog attach="fog" args={['#0d1b2e', 36, 98]} />

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
      <RopeWorldDriver
        room={room}
        paused={paused}
        readInput={readInput}
        renderRef={renderRef}
        onHudSnapshot={onHudSnapshot}
      />

      <RopeFollowShadowLight renderRef={renderRef} />
      <RopeCamera renderRef={renderRef} />
      <RopeCourseMesh renderRef={renderRef} />

      <RopeActor
        slot="p1"
        member={p1Member}
        renderRef={renderRef}
        emote={room.activeEmotes.p1 ?? null}
      />
      <RopeActor
        slot="p2"
        member={p2Member}
        renderRef={renderRef}
        emote={room.activeEmotes.p2 ?? null}
      />
      <CatenaryRope3D renderRef={renderRef} />
    </Canvas>
  );
});
