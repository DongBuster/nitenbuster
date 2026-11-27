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
  MINECART_COURSE,
  MINECART_MAX_HP,
  MINECART_MAX_SPEED,
  MINECART_MIN_SPEED,
  evaluateMinecartObstacles,
  getMinecartStageNumberForZ,
} from './course';
import {
  createInitialMinecartSimState,
  packMinecartSnapshot,
  stepMinecartSim,
} from './physics';
import type {
  MinecartSimEvent,
  MinecartSimState,
  MinecartSnapshotPayload,
} from './types';

export interface CoopMapSceneProps {
  room: GlassRoomController;
  paused: boolean;
  onHudSnapshot: (hud: GlassHudSnapshot) => void;
}

interface MinecartRenderState {
  matchTime: number;
  checkpointIndex: number;
  failures: number;
  cart: MinecartSnapshotPayload['cart'];
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

const CHARACTER_BASE_SCALE = 0.62;

const PUMP_P1_COLOR = new THREE.Color('#fbbf24');
const PUMP_P2_COLOR = new THREE.Color('#2dd4bf');

const CHECKPOINT_COOL_COLOR = new THREE.Color('#38bdf8');
const CHECKPOINT_COOL_EMISSIVE = new THREE.Color('#0284c7');
const CHECKPOINT_WARM_COLOR = new THREE.Color('#fde047');
const CHECKPOINT_WARM_EMISSIVE = new THREE.Color('#f59e0b');

function createInitialMinecartRenderState(
  sim: MinecartSimState = createInitialMinecartSimState(),
): MinecartRenderState {
  return {
    matchTime: sim.matchTime,
    checkpointIndex: sim.checkpointIndex,
    failures: sim.failures,
    cart: {
      lane: sim.cart.lane,
      x: sim.cart.x,
      y: sim.cart.y,
      z: sim.cart.z,
      vy: sim.cart.vy,
      speed: sim.cart.speed,
      hp: sim.cart.hp,
      invulnTimer: sim.cart.invulnTimer,
      respawnTimer: sim.cart.respawnTimer,
      pumpTurn: sim.cart.pumpTurn,
      pumpTilt: sim.cart.pumpTilt,
      wobble: sim.cart.wobble,
      p1Ducking: sim.cart.p1Ducking,
      p2Ducking: sim.cart.p2Ducking,
      grounded: sim.cart.grounded,
    },
    cameraShake: 0,
  };
}

function copyMinecartSimToRender(
  sim: MinecartSimState,
  target: MinecartRenderState,
): void {
  target.matchTime = sim.matchTime;
  target.checkpointIndex = sim.checkpointIndex;
  target.failures = sim.failures;
  target.cart.lane = sim.cart.lane;
  target.cart.x = sim.cart.x;
  target.cart.y = sim.cart.y;
  target.cart.z = sim.cart.z;
  target.cart.vy = sim.cart.vy;
  target.cart.speed = sim.cart.speed;
  target.cart.hp = sim.cart.hp;
  target.cart.invulnTimer = sim.cart.invulnTimer;
  target.cart.respawnTimer = sim.cart.respawnTimer;
  target.cart.pumpTurn = sim.cart.pumpTurn;
  target.cart.pumpTilt = sim.cart.pumpTilt;
  target.cart.wobble = sim.cart.wobble;
  target.cart.p1Ducking = sim.cart.p1Ducking;
  target.cart.p2Ducking = sim.cart.p2Ducking;
  target.cart.grounded = sim.cart.grounded;
}

function copyMinecartSnapshotToRender(
  snapshot: MinecartSnapshotPayload,
  target: MinecartRenderState,
): void {
  target.matchTime = snapshot.matchTime;
  target.checkpointIndex = snapshot.checkpointIndex;
  target.failures = snapshot.failures;
  Object.assign(target.cart, snapshot.cart);
}

function buildMinecartHudSnapshot(
  renderState: MinecartRenderState,
): GlassHudSnapshot {
  const stageNumber = getMinecartStageNumberForZ(
    MINECART_COURSE,
    renderState.cart.z,
  );
  const stageName =
    MINECART_COURSE.stages.find((s) => s.number === stageNumber)?.name ??
    MINECART_COURSE.stages[0]?.name ??
    '';
  const totalCheckpoints = Math.max(0, MINECART_COURSE.checkpoints.length - 1);
  const progressPct = Math.max(
    0,
    Math.min(100, (renderState.cart.z / MINECART_COURSE.finishZ) * 100),
  );
  const speedRatio = Math.max(
    0,
    Math.min(
      1,
      (renderState.cart.speed - MINECART_MIN_SPEED) /
        (MINECART_MAX_SPEED - MINECART_MIN_SPEED),
    ),
  );
  const speedPct = Math.round(speedRatio * 100);
  const statusBadge =
    renderState.cart.respawnTimer > 0
      ? 'Trật bánh! Hồi sinh...'
      : renderState.cart.pumpTurn === 'p1'
        ? 'Lượt Bơm: P1'
        : 'Lượt Bơm: P2';

  return {
    mapId: 'minecart_rails',
    matchTime: renderState.matchTime,
    stageNumber,
    stageName,
    checkpointIndex: renderState.checkpointIndex,
    totalCheckpoints,
    shatters: renderState.failures,
    failureLabel: 'Trật bánh',
    glassHp: renderState.cart.hp,
    glassMaxHp: MINECART_MAX_HP,
    glassStress:
      renderState.cart.wobble > 0.3 ? renderState.cart.wobble : speedRatio,
    primaryMeterPct: speedPct,
    primaryMeterLabel: 'Tốc độ xe',
    statusBadge,
    pumpTurn: renderState.cart.pumpTurn,
    shatterTimer: renderState.cart.respawnTimer,
    shatterReason: null,
    p1Lift: renderState.cart.p1Ducking
      ? -1
      : renderState.cart.pumpTurn === 'p1'
        ? 1
        : 0,
    p2Lift: renderState.cart.p2Ducking
      ? -1
      : renderState.cart.pumpTurn === 'p2'
        ? 1
        : 0,
    progressPct,
  };
}

interface MinecartWorldDriverProps {
  room: GlassRoomController;
  paused: boolean;
  readInput: () => PlayerInput;
  renderRef: RefObject<MinecartRenderState>;
  onHudSnapshot: (hud: GlassHudSnapshot) => void;
}

function MinecartWorldDriver({
  room,
  paused,
  readInput,
  renderRef,
  onHudSnapshot,
}: MinecartWorldDriverProps) {
  const simRef = useRef<MinecartSimState>(createInitialMinecartSimState());
  const accumulatorRef = useRef<number>(0);
  const snapshotPacerRef = useRef(new CoopSnapshotPacer<MinecartSimEvent>());
  const finishNotifiedRef = useRef<boolean>(false);
  const guestInputRef = useRef<{ input: PlayerInput; receivedAtMs: number }>({
    input: { ...NEUTRAL_INPUT },
    receivedAtMs: 0,
  });

  const interpolatorRef = useRef(
    new CoopSnapshotInterpolator<MinecartSnapshotPayload>(),
  );
  const pendingGuestEventsRef = useRef<MinecartSimEvent[]>([]);
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
      const initialSim = createInitialMinecartSimState();
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

      copyMinecartSimToRender(initialSim, renderRef.current);
      renderRef.current.cameraShake = 0;
      onHudSnapshotRef.current(buildMinecartHudSnapshot(renderRef.current));
    },
    [renderRef],
  );

  useEffect(() => {
    if (activeMatchIdRef.current !== room.matchId) {
      resetSimulationForMatch(room.matchId);
    }
  }, [room.matchId, resetSimulationForMatch]);

  useEffect(() => {
    onHudSnapshotRef.current(buildMinecartHudSnapshot(renderRef.current));
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
      if (snapshot.mapId !== 'minecart_rails') return;
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
    (events: readonly MinecartSimEvent[]) => {
      for (const evt of events) {
        if (evt.id <= lastProcessedEventIdRef.current) continue;
        lastProcessedEventIdRef.current = evt.id;

        switch (evt.kind) {
          case 'cart_pump':
          case 'cart_lane':
            playSfx('cartClack');
            break;
          case 'cart_jump':
            playSfx('roll');
            break;
          case 'cart_hit':
            playSfx('punch');
            renderRef.current.cameraShake = Math.max(
              renderRef.current.cameraShake,
              0.55,
            );
            break;
          case 'cart_derail':
            playSfx('bomb');
            renderRef.current.cameraShake = Math.max(
              renderRef.current.cameraShake,
              1.0,
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
        const frameEvents: MinecartSimEvent[] = [];

        while (accumulatorRef.current >= FIXED_DT) {
          accumulatorRef.current -= FIXED_DT;
          const nextSim = stepMinecartSim(
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

        copyMinecartSimToRender(simRef.current, renderRef.current);

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
          const packed = packMinecartSnapshot(
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
          onHudSnapshotRef.current(buildMinecartHudSnapshot(renderRef.current));
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
          copyMinecartSnapshotToRender(sampled, renderRef.current);
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
      onHudSnapshotRef.current(buildMinecartHudSnapshot(renderRef.current));
    }
  });

  return null;
}

function MinecartFollowShadowLight({
  renderRef,
}: {
  renderRef: RefObject<MinecartRenderState>;
}) {
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;
    const { x, z } = renderRef.current.cart;
    light.position.set(x + 9, 17, z - 6);
    targetObj.position.set(x, 0, z + 6);
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

function MinecartCamera({
  renderRef,
}: {
  renderRef: RefObject<MinecartRenderState>;
}) {
  const { camera } = useThree();
  const currentPosRef = useRef(new THREE.Vector3(0, 7.6, -10.5));
  const currentLookRef = useRef(new THREE.Vector3(0, 0.9, 6.0));
  const desiredPosRef = useRef(new THREE.Vector3());
  const desiredLookRef = useRef(new THREE.Vector3());

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const state = renderRef.current;
    const { cart } = state;

    desiredPosRef.current.set(
      cart.x * 0.55,
      Math.max(-1, cart.y) + 7.6,
      cart.z - 10.6,
    );
    desiredLookRef.current.set(
      cart.x * 0.65,
      Math.max(-1, cart.y) + 0.95,
      cart.z + 6.5,
    );

    const alpha = 1 - Math.exp(-7 * dt);
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

const CART_PASSENGER_META: Record<
  PlayerSlot,
  { localPos: [number, number, number]; ring: string; badgeClass: string; label: string }
> = {
  p1: {
    localPos: [0.36, 0.36, 0.32],
    ring: '#fbbf24',
    badgeClass: 'border-amber-200 bg-amber-400 text-[#2C1B11]',
    label: 'P1',
  },
  p2: {
    localPos: [-0.36, 0.36, -0.32],
    ring: '#2dd4bf',
    badgeClass: 'border-teal-200 bg-teal-400 text-[#0F2926]',
    label: 'P2',
  },
};

function CartPassengerActor({
  slot,
  member,
  renderRef,
  emote,
}: {
  slot: PlayerSlot;
  member: GlassRoomMember;
  renderRef: RefObject<MinecartRenderState>;
  emote: GlassEmotePayload | null;
}) {
  const seatRef = useRef<THREE.Group | null>(null);
  const visualRef = useRef<THREE.Group | null>(null);
  const partyMotionRef = useRef<PartyMotionState>(createPartyMotionState());
  const animTimeRef = useRef(0);
  const scaleYRef = useRef(1);
  const emotionRef = useRef<Emotion>('idle');
  const [emotion, setEmotion] = useState<Emotion>('idle');

  const meta = CART_PASSENGER_META[slot];

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    animTimeRef.current += dt;
    const { cart } = renderRef.current;

    const ducking = slot === 'p1' ? cart.p1Ducking : cart.p2Ducking;
    const isMyPumpTurn = cart.pumpTurn === slot;

    const pm = partyMotionRef.current;
    stepPartyMotion(
      pm,
      {
        nowSec: animTimeRef.current,
        vx: 0,
        vy: cart.vy,
        vz: cart.speed * 0.3,
        prevVx: 0,
        prevVz: cart.speed * 0.3,
        yaw: 0,
        prevYaw: 0,
        grounded: cart.grounded,
        wasGrounded: cart.grounded,
        sprinting: cart.speed > 9,
        isStunned: cart.respawnTimer > 0,
        isFrozen: false,
        isGrabbing: true,
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

    const targetScaleY = ducking ? 0.65 : 1.0;
    scaleYRef.current = THREE.MathUtils.lerp(
      scaleYRef.current,
      targetScaleY,
      1 - Math.exp(-16 * dt),
    );

    if (seatRef.current) {
      const duckOffsetY = ducking ? -0.28 : 0;
      seatRef.current.position.set(
        meta.localPos[0],
        meta.localPos[1] + duckOffsetY,
        meta.localPos[2],
      );
    }

    if (visualRef.current) {
      const sy = scaleYRef.current;
      const sxz = 1 / Math.sqrt(sy);
      visualRef.current.scale.set(
        CHARACTER_BASE_SCALE * sxz,
        CHARACTER_BASE_SCALE * sy,
        CHARACTER_BASE_SCALE * sxz,
      );
      visualRef.current.rotation.x = ducking
        ? 0.38
        : isMyPumpTurn
          ? cart.pumpTilt * 0.14
          : 0;
    }

    const desiredEmotion: Emotion =
      cart.respawnTimer > 0
        ? 'shock'
        : emote !== null || cart.speed > 10
          ? 'happy'
          : 'idle';

    if (desiredEmotion !== emotionRef.current) {
      emotionRef.current = desiredEmotion;
      setEmotion(desiredEmotion);
    }
  });

  return (
    <group ref={seatRef} position={meta.localPos}>
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
        position={[0, 1.45, 0]}
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

function MinecartRig3D({
  renderRef,
  p1Member,
  p2Member,
  p1Emote,
  p2Emote,
}: {
  renderRef: RefObject<MinecartRenderState>;
  p1Member: GlassRoomMember;
  p2Member: GlassRoomMember;
  p1Emote: GlassEmotePayload | null;
  p2Emote: GlassEmotePayload | null;
}) {
  const rootRef = useRef<THREE.Group | null>(null);
  const bodyTiltRef = useRef<THREE.Group | null>(null);
  const pumpHandleRef = useRef<THREE.Group | null>(null);
  const wheelRefs = useRef<(THREE.Mesh | null)[]>([]);
  const timeRef = useRef(0);

  const pumpGripMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PUMP_P1_COLOR,
        emissive: PUMP_P1_COLOR,
        emissiveIntensity: 1.1,
        roughness: 0.25,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      pumpGripMat.dispose();
    };
  }, [pumpGripMat]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    timeRef.current += dt;
    const { cart } = renderRef.current;

    if (rootRef.current) {
      rootRef.current.position.set(cart.x, cart.y, cart.z);
    }

    if (bodyTiltRef.current) {
      const targetX = MINECART_COURSE.laneX[cart.lane];
      const laneLean = (targetX - cart.x) * -0.14;
      const wobbleOsc = Math.sin(timeRef.current * 28) * cart.wobble * 0.16;
      const derailTilt = cart.respawnTimer > 0 ? 0.65 : 0;
      bodyTiltRef.current.rotation.z = laneLean + wobbleOsc + derailTilt;
      bodyTiltRef.current.rotation.x =
        !cart.grounded && cart.vy !== 0
          ? THREE.MathUtils.clamp(-cart.vy * 0.035, -0.25, 0.25)
          : 0;

      const invulnBlink =
        cart.invulnTimer > 0 && Math.floor(timeRef.current * 14) % 2 === 0;
      bodyTiltRef.current.scale.setScalar(invulnBlink ? 0.96 : 1);
    }

    if (pumpHandleRef.current) {
      pumpHandleRef.current.rotation.x = cart.pumpTilt * 0.36;
      const turnColor =
        cart.pumpTurn === 'p1' ? PUMP_P1_COLOR : PUMP_P2_COLOR;
      pumpGripMat.color.copy(turnColor);
      pumpGripMat.emissive.copy(turnColor);
      pumpGripMat.emissiveIntensity =
        0.95 + Math.abs(Math.sin(timeRef.current * 8)) * 0.55;
    }

    for (let i = 0; i < wheelRefs.current.length; i += 1) {
      const w = wheelRefs.current[i];
      if (w) {
        w.rotation.x += cart.speed * dt * 2.5;
      }
    }
  });

  const wheelPositions: [number, number, number][] = [
    [0.52, 0.18, 0.56],
    [-0.52, 0.18, 0.56],
    [0.52, 0.18, -0.56],
    [-0.52, 0.18, -0.56],
  ];

  return (
    <group ref={rootRef}>
      <group ref={bodyTiltRef}>
        {/* Iron chassis */}
        <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.28, 0.16, 1.62]} />
          <meshStandardMaterial
            color="#334155"
            metalness={0.7}
            roughness={0.35}
          />
        </mesh>

        {/* Dark oak cart tub */}
        <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.18, 0.32, 1.48]} />
          <meshStandardMaterial color="#5c351e" roughness={0.82} />
        </mesh>

        {/* Side walls + front/back bumpers */}
        {([-0.55, 0.55] as const).map((sideX) => (
          <mesh
            key={`wall-x-${sideX}`}
            position={[sideX, 0.68, 0]}
            castShadow
          >
            <boxGeometry args={[0.1, 0.28, 1.48]} />
            <meshStandardMaterial color="#7c4724" roughness={0.8} />
          </mesh>
        ))}
        {([-0.7, 0.7] as const).map((endZ) => (
          <mesh
            key={`wall-z-${endZ}`}
            position={[0, 0.68, endZ]}
            castShadow
          >
            <boxGeometry args={[1.18, 0.28, 0.1]} />
            <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.42} />
          </mesh>
        ))}

        {/* Front lantern headlight */}
        <mesh position={[0, 0.68, 0.78]}>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial
            color="#fef08a"
            emissive="#fbbf24"
            emissiveIntensity={1.4}
          />
        </mesh>

        {/* 4 Rotating Iron Wheels */}
        {wheelPositions.map((pos, idx) => (
          <mesh
            key={idx}
            ref={(el) => {
              wheelRefs.current[idx] = el;
            }}
            position={pos}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.2, 0.2, 0.12, 14]} />
            <meshStandardMaterial
              color="#64748b"
              metalness={0.8}
              roughness={0.3}
            />
          </mesh>
        ))}

        {/* Center Seesaw Pump Handle (lights up Amber for P1 turn, Teal for P2 turn) */}
        <group position={[0, 0.65, 0]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.1, 0.42, 10]} />
            <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.35} />
          </mesh>
          <group ref={pumpHandleRef} position={[0, 0.42, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.12, 0.1, 1.15]} />
              <meshStandardMaterial
                color="#94a3b8"
                metalness={0.65}
                roughness={0.3}
              />
            </mesh>
            {([-0.54, 0.54] as const).map((gripZ) => (
              <mesh
                key={gripZ}
                position={[0, 0, gripZ]}
                rotation={[0, 0, Math.PI / 2]}
                material={pumpGripMat}
              >
                <cylinderGeometry args={[0.065, 0.065, 0.56, 12]} />
              </mesh>
            ))}
          </group>
        </group>

        <CartPassengerActor
          slot="p1"
          member={p1Member}
          renderRef={renderRef}
          emote={p1Emote}
        />
        <CartPassengerActor
          slot="p2"
          member={p2Member}
          renderRef={renderRef}
          emote={p2Emote}
        />
      </group>
    </group>
  );
}

function createMinecartTextures() {
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 256;
  woodCanvas.height = 256;
  const wCtx = woodCanvas.getContext('2d');
  if (wCtx) {
    wCtx.fillStyle = '#3f2e21';
    wCtx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      wCtx.fillStyle = y % 64 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.14)';
      wCtx.fillRect(0, y, 256, 16);
    }
  }
  const wood = new THREE.CanvasTexture(woodCanvas);
  wood.colorSpace = THREE.SRGBColorSpace;
  wood.wrapS = THREE.RepeatWrapping;
  wood.wrapT = THREE.RepeatWrapping;
  wood.repeat.set(3, 18);
  wood.needsUpdate = true;

  const hazCanvas = document.createElement('canvas');
  hazCanvas.width = 256;
  hazCanvas.height = 128;
  const hCtx = hazCanvas.getContext('2d');
  if (hCtx) {
    hCtx.fillStyle = '#1e293b';
    hCtx.fillRect(0, 0, 256, 128);
    hCtx.fillStyle = '#facc15';
    for (let x = -128; x < 384; x += 64) {
      hCtx.beginPath();
      hCtx.moveTo(x, 0);
      hCtx.lineTo(x + 32, 0);
      hCtx.lineTo(x - 32, 128);
      hCtx.lineTo(x - 64, 128);
      hCtx.closePath();
      hCtx.fill();
    }
  }
  const hazard = new THREE.CanvasTexture(hazCanvas);
  hazard.colorSpace = THREE.SRGBColorSpace;
  hazard.wrapS = THREE.RepeatWrapping;
  hazard.wrapT = THREE.RepeatWrapping;
  hazard.repeat.set(4, 1);
  hazard.needsUpdate = true;

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

  return { wood, hazard, finish };
}

interface TrackSegment {
  startZ: number;
  endZ: number;
}

function buildTrackSegments(): TrackSegment[] {
  const sortedGaps = [...MINECART_COURSE.gaps].sort(
    (a, b) => a.startZ - b.startZ,
  );
  const segments: TrackSegment[] = [];
  let cursor = -10;
  for (const gap of sortedGaps) {
    if (gap.startZ > cursor) {
      segments.push({ startZ: cursor, endZ: gap.startZ });
    }
    cursor = Math.max(cursor, gap.endZ);
  }
  if (cursor < 192) {
    segments.push({ startZ: cursor, endZ: 192 });
  }
  return segments;
}

function MinecartCourseMesh({
  renderRef,
}: {
  renderRef: RefObject<MinecartRenderState>;
}) {
  const textures = useMemo(() => createMinecartTextures(), []);
  const trackSegments = useMemo(() => buildTrackSegments(), []);

  const sleeperTransforms = useMemo(() => {
    const list: { x: number; z: number }[] = [];
    for (const seg of trackSegments) {
      for (let z = seg.startZ + 0.6; z <= seg.endZ - 0.6; z += 1.2) {
        for (const lx of MINECART_COURSE.laneX) {
          list.push({ x: lx, z });
        }
      }
    }
    return list;
  }, [trackSegments]);

  const sleeperGeo = useMemo(() => new THREE.BoxGeometry(1.45, 0.08, 0.24), []);
  const sleeperMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#6b4226', roughness: 0.88 }),
    [],
  );
  const sleeperMeshRef = useRef<THREE.InstancedMesh | null>(null);

  const rockfallWarnMats = useMemo(
    () =>
      MINECART_COURSE.rockfalls.map(
        () =>
          new THREE.MeshBasicMaterial({
            color: '#ef4444',
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
          }),
      ),
    [],
  );

  useEffect(() => {
    return () => {
      textures.wood.dispose();
      textures.hazard.dispose();
      textures.finish.dispose();
      sleeperGeo.dispose();
      sleeperMat.dispose();
      for (const m of rockfallWarnMats) m.dispose();
    };
  }, [rockfallWarnMats, sleeperGeo, sleeperMat, textures]);

  useEffect(() => {
    const inst = sleeperMeshRef.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < sleeperTransforms.length; i += 1) {
      const s = sleeperTransforms[i];
      dummy.position.set(s.x, -0.05, s.z);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [sleeperTransforms]);

  const sweeperRefs = useRef<(THREE.Group | null)[]>([]);
  const rockfallBoulderRefs = useRef<(THREE.Mesh | null)[]>([]);
  const rockfallWarnMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const checkpointMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  const pinePositions = useMemo(() => {
    const list: { x: number; z: number; scale: number }[] = [];
    for (let z = -6; z <= 186; z += 11) {
      list.push({ x: -9.5 - ((z * 3) % 4), z, scale: 1.0 + ((z * 5) % 4) * 0.1 });
      list.push({ x: 9.5 + ((z * 7) % 4), z: z + 5, scale: 1.0 + ((z * 11) % 4) * 0.1 });
    }
    return list;
  }, []);

  useFrame(() => {
    const { matchTime, checkpointIndex } = renderRef.current;
    const obs = evaluateMinecartObstacles(MINECART_COURSE, matchTime);

    for (let i = 0; i < obs.sweepers.length; i += 1) {
      const grp = sweeperRefs.current[i];
      const sw = obs.sweepers[i];
      if (grp && sw) {
        grp.position.set(sw.x, 0, sw.z);
      }
    }

    for (let i = 0; i < obs.rockfalls.length; i += 1) {
      const rf = obs.rockfalls[i];
      const boulder = rockfallBoulderRefs.current[i];
      const warnMesh = rockfallWarnMeshRefs.current[i];
      const warnMat = rockfallWarnMats[i];
      if (!rf || !warnMat) continue;

      if (warnMesh) {
        warnMesh.visible = rf.state !== 'idle';
      }
      if (rf.state === 'warning') {
        warnMat.opacity = 0.35 + Math.abs(Math.sin(matchTime * 16)) * 0.45;
      } else if (rf.state === 'active') {
        warnMat.opacity = 0.88;
      } else {
        warnMat.opacity = 0;
      }

      if (boulder) {
        boulder.visible = rf.state !== 'idle';
        if (rf.state === 'warning') {
          boulder.position.set(
            rf.x + Math.sin(matchTime * 42) * 0.08,
            6.2,
            rf.z,
          );
        } else if (rf.state === 'active') {
          boulder.position.set(rf.x, 0.85, rf.z);
        }
      }
    }

    for (let i = 0; i < MINECART_COURSE.checkpoints.length; i += 1) {
      const cp = MINECART_COURSE.checkpoints[i];
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
      {/* Contiguous 3-lane track segments broken cleanly at gaps */}
      {trackSegments.map((seg, idx) => {
        const len = seg.endZ - seg.startZ;
        const midZ = (seg.startZ + seg.endZ) * 0.5;
        return (
          <group key={idx}>
            {/* Gravel/timber railway bed */}
            <mesh position={[0, -0.25, midZ]} receiveShadow>
              <boxGeometry args={[9.4, 0.34, len]} />
              <meshStandardMaterial map={textures.wood} roughness={0.9} />
            </mesh>

            {/* 3 parallel steel rail tracks */}
            {MINECART_COURSE.laneX.map((lx, laneIdx) => (
              <group key={laneIdx} position={[lx, 0, midZ]}>
                {([-0.44, 0.44] as const).map((railOff) => (
                  <mesh key={railOff} position={[railOff, -0.01, 0]} receiveShadow>
                    <boxGeometry args={[0.1, 0.08, len]} />
                    <meshStandardMaterial
                      color="#cbd5e1"
                      metalness={0.78}
                      roughness={0.28}
                    />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        );
      })}

      {/* Wooden sleepers across all non-gap track segments */}
      <instancedMesh
        ref={sleeperMeshRef}
        args={[sleeperGeo, sleeperMat, sleeperTransforms.length]}
        receiveShadow
      />

      {/* Gap edge caution stripes & warning posts */}
      {MINECART_COURSE.gaps.map((gap) => (
        <group key={gap.id}>
          <mesh position={[0, 0.01, gap.startZ - 0.55]} receiveShadow>
            <boxGeometry args={[9.2, 0.02, 0.95]} />
            <meshStandardMaterial
              map={textures.hazard}
              emissive="#fbbf24"
              emissiveIntensity={0.28}
            />
          </mesh>
          {([-4.6, 4.6] as const).map((postX) => (
            <group key={postX} position={[postX, 0, gap.startZ - 0.3]}>
              <mesh position={[0, 0.9, 0]} castShadow>
                <boxGeometry args={[0.24, 1.8, 0.24]} />
                <meshStandardMaterial color="#facc15" roughness={0.45} />
              </mesh>
              <mesh position={[0, 1.95, 0]}>
                <sphereGeometry args={[0.2, 10, 8]} />
                <meshStandardMaterial
                  color="#fb7185"
                  emissive="#e11d48"
                  emissiveIntensity={1.2}
                />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* Chunky icy boulder blockers */}
      {MINECART_COURSE.blockers.map((b) => {
        const bx = MINECART_COURSE.laneX[b.lane];
        return (
          <group key={b.id} position={[bx, 0, b.z]}>
            <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
              <dodecahedronGeometry args={[0.88, 0]} />
              <meshStandardMaterial color="#334155" roughness={0.86} />
            </mesh>
            <mesh position={[0, 0.96, 0]} castShadow>
              <coneGeometry args={[0.62, 0.48, 6]} />
              <meshStandardMaterial color="#bae6fd" roughness={0.25} />
            </mesh>
            <mesh position={[0, 0.015, 0]} receiveShadow>
              <boxGeometry args={[1.9, 0.02, 1.4]} />
              <meshStandardMaterial
                map={textures.hazard}
                emissive="#fbbf24"
                emissiveIntensity={0.18}
              />
            </mesh>
          </group>
        );
      })}

      {/* Striped overhead tunnel beams (y in [1.15, 2.5]) + floor warning strips */}
      {MINECART_COURSE.beams.map((bm) => {
        const spanAll = bm.lanes.length === 3;
        const segments = spanAll
          ? [{ cx: 0, w: 9.2 }]
          : bm.lanes.map((l) => ({ cx: MINECART_COURSE.laneX[l], w: 2.6 }));

        return (
          <group key={bm.id}>
            {/* Side support posts */}
            {([-4.7, 4.7] as const).map((postX) => (
              <mesh key={postX} position={[postX, 1.35, bm.z]} castShadow>
                <boxGeometry args={[0.28, 2.7, bm.halfDepth * 2]} />
                <meshStandardMaterial color="#4a2a17" roughness={0.85} />
              </mesh>
            ))}

            {segments.map((seg, sIdx) => (
              <group key={sIdx}>
                {/* Upper timber beam */}
                <mesh position={[seg.cx, 1.98, bm.z]} castShadow>
                  <boxGeometry args={[seg.w, 0.95, bm.halfDepth * 2]} />
                  <meshStandardMaterial color="#5c351e" roughness={0.82} />
                </mesh>
                {/* Lower hazard stripe fascia at y = 1.15..1.52 */}
                <mesh position={[seg.cx, 1.33, bm.z]} castShadow>
                  <boxGeometry
                    args={[seg.w + 0.04, 0.36, bm.halfDepth * 2 + 0.04]}
                  />
                  <meshStandardMaterial
                    map={textures.hazard}
                    emissive="#fbbf24"
                    emissiveIntensity={0.22}
                    roughness={0.4}
                  />
                </mesh>
                {/* Floor warning strip underneath */}
                <mesh position={[seg.cx, 0.014, bm.z]} receiveShadow>
                  <boxGeometry
                    args={[seg.w - 0.15, 0.015, bm.halfDepth * 2 + 0.55]}
                  />
                  <meshStandardMaterial
                    map={textures.hazard}
                    emissive="#fbbf24"
                    emissiveIntensity={0.2}
                  />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}

      {/* Sweeping cross-lane pillars */}
      {MINECART_COURSE.sweepers.map((sw, idx) => (
        <group key={sw.id}>
          {/* Overhead gantry bar */}
          <mesh position={[0, 2.75, sw.z]} castShadow>
            <boxGeometry args={[9.4, 0.24, 0.28]} />
            <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.4} />
          </mesh>
          {([-4.6, 4.6] as const).map((postX) => (
            <mesh key={postX} position={[postX, 1.4, sw.z]} castShadow>
              <boxGeometry args={[0.26, 2.8, 0.28]} />
              <meshStandardMaterial color="#4a2a17" roughness={0.85} />
            </mesh>
          ))}

          <group
            ref={(el) => {
              sweeperRefs.current[idx] = el;
            }}
            position={[0, 0, sw.z]}
          >
            <mesh position={[0, 1.35, 0]} castShadow>
              <boxGeometry
                args={[sw.halfWidth * 2, 2.4, sw.halfDepth * 2]}
              />
              <meshStandardMaterial
                map={textures.hazard}
                emissive="#f43f5e"
                emissiveIntensity={0.28}
                roughness={0.38}
              />
            </mesh>
          </group>
        </group>
      ))}

      {/* Telegraphed Rockfalls */}
      {MINECART_COURSE.rockfalls.map((rf, idx) => {
        const rx = MINECART_COURSE.laneX[rf.lane];
        return (
          <group key={rf.id}>
            {/* Pulsing red lane warning pad */}
            <mesh
              ref={(el) => {
                rockfallWarnMeshRefs.current[idx] = el;
              }}
              position={[rx, 0.025, rf.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              material={rockfallWarnMats[idx]}
              visible={false}
            >
              <planeGeometry args={[2.2, 2.4]} />
            </mesh>

            {/* Falling boulder */}
            <mesh
              ref={(el) => {
                rockfallBoulderRefs.current[idx] = el;
              }}
              position={[rx, 6.2, rf.z]}
              visible={false}
              castShadow
            >
              <dodecahedronGeometry args={[0.92, 0]} />
              <meshStandardMaterial
                color="#475569"
                emissive="#ef4444"
                emissiveIntensity={0.35}
                roughness={0.82}
              />
            </mesh>
          </group>
        );
      })}

      {/* Checkpoint Signal Arches */}
      {MINECART_COURSE.checkpoints
        .filter((cp) => cp.index > 0)
        .map((cp) => (
          <group key={cp.index} position={[0, 0, cp.triggerZ]}>
            {([-1, 1] as const).map((side) => (
              <group key={side} position={[side * 4.8, 0, 0]}>
                <mesh position={[0, 1.65, 0]} castShadow>
                  <boxGeometry args={[0.28, 3.3, 0.28]} />
                  <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.45} />
                </mesh>
                <mesh position={[0, 3.45, 0]}>
                  <sphereGeometry args={[0.3, 12, 10]} />
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
            <mesh position={[0, 3.2, 0]} castShadow>
              <boxGeometry args={[9.8, 0.24, 0.24]} />
              <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.45} />
            </mesh>
          </group>
        ))}

      {/* Finish Station Arch at z = 180 */}
      <group position={[0, 0, MINECART_COURSE.finishZ]}>
        {([-1, 1] as const).map((side) => (
          <group key={side} position={[side * 4.9, 0, 0]}>
            <mesh position={[0, 2.2, 0]} castShadow>
              <boxGeometry args={[0.45, 4.4, 0.45]} />
              <meshStandardMaterial color="#5c351e" roughness={0.82} />
            </mesh>
            <mesh position={[0, 4.65, 0]}>
              <sphereGeometry args={[0.42, 14, 12]} />
              <meshStandardMaterial
                color="#fde047"
                emissive="#f59e0b"
                emissiveIntensity={1.35}
              />
            </mesh>
          </group>
        ))}

        <mesh position={[0, 4.2, 0]} castShadow>
          <boxGeometry args={[10.2, 0.68, 0.55]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#f59e0b"
            emissiveIntensity={0.5}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0, 4.2, 0]}>
          <boxGeometry args={[9.2, 0.36, 0.6]} />
          <meshStandardMaterial
            map={textures.finish}
            emissive="#fbbf24"
            emissiveIntensity={0.28}
          />
        </mesh>
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry args={[9.4, 0.02, 0.9]} />
          <meshStandardMaterial
            map={textures.finish}
            emissive="#fbbf24"
            emissiveIntensity={0.22}
          />
        </mesh>
      </group>

      {/* Deep Abyss Floor & Snowy Pine Backdrop */}
      <mesh position={[0, -12, 90]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[280, 280]} />
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
}

export const MinecartScene = memo(function MinecartScene({
  room,
  paused,
  onHudSnapshot,
}: CoopMapSceneProps) {
  const renderRef = useRef<MinecartRenderState>(
    createInitialMinecartRenderState(),
  );

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
      camera={{ position: [0, 7.6, -10.5], fov: 46, near: 0.3, far: 190 }}
      className="h-full w-full"
    >
      <color attach="background" args={['#0d1b2e']} />
      <fog attach="fog" args={['#0d1b2e', 40, 110]} />

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
      <MinecartWorldDriver
        room={room}
        paused={paused}
        readInput={readInput}
        renderRef={renderRef}
        onHudSnapshot={onHudSnapshot}
      />

      <MinecartFollowShadowLight renderRef={renderRef} />
      <MinecartCamera renderRef={renderRef} />
      <MinecartCourseMesh renderRef={renderRef} />

      <MinecartRig3D
        renderRef={renderRef}
        p1Member={p1Member}
        p2Member={p2Member}
        p1Emote={room.activeEmotes.p1 ?? null}
        p2Emote={room.activeEmotes.p2 ?? null}
      />
    </Canvas>
  );
});
