import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { playSfx } from '../../audio/soundEngine';
import {
  CoopSnapshotPacer,
  isCriticalCoopEvent,
} from '../../coop/online/snapshotCadence';
import { useGlassInput } from '../input/useGlassInput';
import {
  GLASS_EMOTES,
  GLASS_INPUT_STALE_MS,
  packSimSnapshot,
  type GlassRoomMember,
  type GlassSnapshotPayload,
} from '../online/protocol';
import { SnapshotInterpolator } from '../online/snapshotInterpolation';
import type { GlassRoomController } from '../online/useGlassRoom';
import { FIXED_DT, GLASS_MAX_HP } from '../sim/constants';
import { GLASS_COURSE, getStageNumberForZ } from '../sim/course';
import { GLASS_MAP_THEMES } from '../sim/levels';
import {
  NEUTRAL_INPUT,
  computeSoloStabilizerInput,
  createInitialSimState,
  stepGlassSim,
} from '../sim/physics';
import type {
  CourseDef,
  FragilePlatformState,
  GlassSimState,
  LiftIntent,
  PlayerInput,
  SimEvent,
} from '../sim/types';
import { CarrierActor } from './CarrierActor';
import { GlassCamera } from './GlassCamera';
import { GlassCourseMesh } from './GlassCourseMesh';
import { GlassPaneMesh } from './GlassPaneMesh';
import {
  createInitialRenderState,
  type GlassHudSnapshot,
  type GlassRenderState,
} from './renderTypes';

export interface GlassSceneProps {
  room: GlassRoomController;
  paused: boolean;
  onHudSnapshot: (hud: GlassHudSnapshot) => void;
  soloAutoBalance?: boolean;
  course?: CourseDef;
  level?: number;
  mapPackTitle?: string;
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

function copySimToRenderState(
  sim: GlassSimState,
  target: GlassRenderState,
): void {
  target.matchTime = sim.matchTime;
  target.checkpointIndex = sim.checkpointIndex;

  target.p1.x = sim.p1.x;
  target.p1.y = sim.p1.y;
  target.p1.z = sim.p1.z;
  target.p1.vx = sim.p1.vx;
  target.p1.vy = sim.p1.vy;
  target.p1.vz = sim.p1.vz;
  target.p1.yaw = sim.p1.yaw;
  target.p1.grounded = sim.p1.grounded;
  target.p1.liftOffset = sim.p1.liftOffset;
  target.p1.onIce = sim.p1.onIce;
  target.p1.inWind = sim.p1.inWind;

  target.p2.x = sim.p2.x;
  target.p2.y = sim.p2.y;
  target.p2.z = sim.p2.z;
  target.p2.vx = sim.p2.vx;
  target.p2.vy = sim.p2.vy;
  target.p2.vz = sim.p2.vz;
  target.p2.yaw = sim.p2.yaw;
  target.p2.grounded = sim.p2.grounded;
  target.p2.liftOffset = sim.p2.liftOffset;
  target.p2.onIce = sim.p2.onIce;
  target.p2.inWind = sim.p2.inWind;

  target.glass.hp = sim.glass.hp;
  target.glass.stress = sim.glass.stress;
  target.glass.centerX = sim.glass.centerX;
  target.glass.centerY = sim.glass.centerY;
  target.glass.centerZ = sim.glass.centerZ;
  target.glass.yaw = sim.glass.yaw;
  target.glass.pitch = sim.glass.pitch;
  target.glass.length = sim.glass.length;
  target.glass.invulnTimer = sim.glass.invulnTimer;
  target.glass.shatterTimer = sim.glass.shatterTimer;
  target.glass.shatterReason = sim.glass.shatterReason;
  target.glass.lastImpactX = sim.glass.lastImpactX;
  target.glass.lastImpactY = sim.glass.lastImpactY;
  target.glass.lastImpactZ = sim.glass.lastImpactZ;

  const srcFragile = sim.fragileStates;
  for (const key of Object.keys(target.fragileStates)) {
    if (!(key in srcFragile)) {
      delete target.fragileStates[key];
    }
  }
  for (const [id, entry] of Object.entries(srcFragile)) {
    const existing = target.fragileStates[id];
    if (existing) {
      existing.state = entry.state;
      existing.timer = entry.timer;
    } else {
      target.fragileStates[id] = { state: entry.state, timer: entry.timer };
    }
  }
}

function copySnapshotToRenderState(
  snapshot: GlassSnapshotPayload,
  target: GlassRenderState,
): void {
  target.matchTime = snapshot.matchTime;
  target.checkpointIndex = snapshot.checkpointIndex;

  Object.assign(target.p1, snapshot.p1);
  Object.assign(target.p2, snapshot.p2);
  Object.assign(target.glass, snapshot.glass);

  const packedFragile = snapshot.fragileStates;
  if (packedFragile) {
    for (const key of Object.keys(target.fragileStates)) {
      if (!(key in packedFragile)) {
        delete target.fragileStates[key];
      }
    }
    for (const [id, entry] of Object.entries(packedFragile)) {
      const mappedState: FragilePlatformState['state'] =
        entry.s === 1 ? 'shaking' : entry.s === 2 ? 'gone' : 'solid';
      const existing = target.fragileStates[id];
      if (existing) {
        existing.state = mappedState;
        existing.timer = entry.t;
      } else {
        target.fragileStates[id] = { state: mappedState, timer: entry.t };
      }
    }
  } else {
    for (const key of Object.keys(target.fragileStates)) {
      delete target.fragileStates[key];
    }
  }
}

function buildHudSnapshot(
  renderState: GlassRenderState,
  shatters: number,
  course: CourseDef,
  level?: number,
  mapPackTitle?: string,
): GlassHudSnapshot {
  const stageNumber = getStageNumberForZ(course, renderState.glass.centerZ);
  const stageName =
    course.stages.find((s) => s.number === stageNumber)?.name ??
    course.stages[0]?.name ??
    '';
  const totalCheckpoints = Math.max(0, course.checkpoints.length - 1);
  const progressPct = Math.max(
    0,
    Math.min(100, (renderState.glass.centerZ / course.finishZ) * 100),
  );

  return {
    mapId: 'glass_carry',
    matchTime: renderState.matchTime,
    stageNumber,
    stageName,
    totalStages: course.stages.length,
    ...(level !== undefined ? { level } : {}),
    ...(mapPackTitle !== undefined ? { mapPackTitle } : {}),
    checkpointIndex: renderState.checkpointIndex,
    totalCheckpoints,
    shatters,
    failureLabel: 'Vỡ kính',
    glassHp: renderState.glass.hp,
    glassMaxHp: GLASS_MAX_HP,
    glassStress: renderState.glass.stress,
    primaryMeterPct: Math.round(
      Math.max(0, Math.min(1, renderState.glass.stress)) * 100,
    ),
    primaryMeterLabel: 'Độ căng kính',
    shatterTimer: renderState.glass.shatterTimer,
    shatterReason: renderState.glass.shatterReason,
    p1Lift: renderState.p1.liftOffset,
    p2Lift: renderState.p2.liftOffset,
    progressPct,
  };
}

function FollowShadowLight({
  renderRef,
  sunLightHex,
}: {
  renderRef: RefObject<GlassRenderState>;
  sunLightHex: string;
}) {
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;
    const { p1, p2 } = renderRef.current;
    const midX = (p1.x + p2.x) * 0.5;
    const midZ = (p1.z + p2.z) * 0.5;
    light.position.set(midX + 8, 16, midZ - 6);
    targetObj.position.set(midX, 0, midZ + 4);
    targetObj.updateMatrixWorld();
  });

  return (
    <>
      <primitive object={targetObj} />
      <directionalLight
        ref={lightRef}
        target={targetObj}
        position={[8, 16, -4.5]}
        intensity={1.45}
        color={sunLightHex}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={48}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={16}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0005}
      />
    </>
  );
}

interface GlassWorldDriverProps {
  room: GlassRoomController;
  paused: boolean;
  readInput: () => PlayerInput;
  renderRef: RefObject<GlassRenderState>;
  onHudSnapshot: (hud: GlassHudSnapshot) => void;
  soloAutoBalance?: boolean;
  course: CourseDef;
  level?: number;
  mapPackTitle?: string;
}

function GlassWorldDriver({
  room,
  paused,
  readInput,
  renderRef,
  onHudSnapshot,
  soloAutoBalance = false,
  course,
  level,
  mapPackTitle,
}: GlassWorldDriverProps) {
  const simRef = useRef<GlassSimState>(createInitialSimState(course));
  const accumulatorRef = useRef<number>(0);
  const snapshotPacerRef = useRef(new CoopSnapshotPacer<SimEvent>());
  const finishNotifiedRef = useRef<boolean>(false);
  const guestInputRef = useRef<{ input: PlayerInput; receivedAtMs: number }>({
    input: { ...NEUTRAL_INPUT },
    receivedAtMs: 0,
  });

  const interpolatorRef = useRef<SnapshotInterpolator>(
    new SnapshotInterpolator(),
  );
  const pendingGuestEventsRef = useRef<SimEvent[]>([]);
  const lastProcessedEventIdRef = useRef<number>(0);
  const shattersRef = useRef<number>(0);
  const prevLocalLiftRef = useRef<LiftIntent>(0);
  const hudAccumRef = useRef<number>(0);
  const activeMatchIdRef = useRef<string>(room.matchId);
  const prevCourseRef = useRef<CourseDef>(course);

  const courseRef = useRef<CourseDef>(course);
  courseRef.current = course;

  const levelRef = useRef<number | undefined>(level);
  levelRef.current = level;

  const mapPackTitleRef = useRef<string | undefined>(mapPackTitle);
  mapPackTitleRef.current = mapPackTitle;

  const isHostRef = useRef<boolean>(room.isHost);
  const prevIsHostRef = useRef<boolean>(room.isHost);
  isHostRef.current = room.isHost;

  useEffect(() => {
    const wasHost = prevIsHostRef.current;
    prevIsHostRef.current = room.isHost;
    // When a guest takes over simulation (e.g. Solo Auto-Balance failover after partner disconnects),
    // hydrate simRef from the latest interpolated renderState instead of snapping back to z=0.
    if (!wasHost && room.isHost && phaseRef.current === 'playing') {
      const r = renderRef.current;
      const base = simRef.current;
      const hydratedFragile: Record<string, FragilePlatformState> = {};
      for (const [id, entry] of Object.entries(base.fragileStates)) {
        const rendered = r.fragileStates[id];
        hydratedFragile[id] = rendered
          ? { state: rendered.state, timer: rendered.timer }
          : { state: entry.state, timer: entry.timer };
      }
      simRef.current = {
        ...base,
        phase: 'playing',
        matchTime: r.matchTime,
        checkpointIndex: r.checkpointIndex,
        shatters: shattersRef.current,
        fragileStates: hydratedFragile,
        p1: {
          ...base.p1,
          x: r.p1.x,
          y: r.p1.y,
          z: r.p1.z,
          vx: r.p1.vx,
          vy: r.p1.vy,
          vz: r.p1.vz,
          yaw: r.p1.yaw,
          grounded: r.p1.grounded,
          liftOffset: r.p1.liftOffset,
          onIce: r.p1.onIce,
          inWind: r.p1.inWind,
        },
        p2: {
          ...base.p2,
          x: r.p2.x,
          y: r.p2.y,
          z: r.p2.z,
          vx: r.p2.vx,
          vy: r.p2.vy,
          vz: r.p2.vz,
          yaw: r.p2.yaw,
          grounded: r.p2.grounded,
          liftOffset: r.p2.liftOffset,
          onIce: r.p2.onIce,
          inWind: r.p2.inWind,
        },
        glass: {
          ...base.glass,
          hp: r.glass.hp,
          stress: r.glass.stress,
          centerX: r.glass.centerX,
          centerY: r.glass.centerY,
          centerZ: r.glass.centerZ,
          yaw: r.glass.yaw,
          pitch: r.glass.pitch,
          length: r.glass.length,
          invulnTimer: r.glass.invulnTimer,
          shatterTimer: r.glass.shatterTimer,
          shatterReason: r.glass.shatterReason,
          lastImpactX: r.glass.lastImpactX,
          lastImpactY: r.glass.lastImpactY,
          lastImpactZ: r.glass.lastImpactZ,
        },
      };
      accumulatorRef.current = 0;
    }
  }, [renderRef, room.isHost]);

  const phaseRef = useRef(room.phase);
  phaseRef.current = room.phase;

  const roomMatchIdRef = useRef<string>(room.matchId);
  roomMatchIdRef.current = room.matchId;

  const pausedRef = useRef<boolean>(paused);
  pausedRef.current = paused;

  const soloAutoBalanceRef = useRef<boolean>(soloAutoBalance);
  soloAutoBalanceRef.current = soloAutoBalance;

  const onHudSnapshotRef = useRef(onHudSnapshot);
  onHudSnapshotRef.current = onHudSnapshot;

  const resetSimulationForMatch = useCallback(
    (nextMatchId: string) => {
      activeMatchIdRef.current = nextMatchId;
      prevCourseRef.current = courseRef.current;
      const initialSim = createInitialSimState(courseRef.current);
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
      shattersRef.current = 0;
      prevLocalLiftRef.current = 0;
      hudAccumRef.current = 0;

      copySimToRenderState(initialSim, renderRef.current);
      renderRef.current.cameraShake = 0;
      renderRef.current.lastCrackAt = 0;
      renderRef.current.shatterBurstId = 0;
      renderRef.current.shatterOrigin = [
        initialSim.glass.centerX,
        initialSim.glass.centerY,
        initialSim.glass.centerZ,
      ];

      onHudSnapshotRef.current(
        buildHudSnapshot(
          renderRef.current,
          shattersRef.current,
          courseRef.current,
          levelRef.current,
          mapPackTitleRef.current,
        ),
      );
    },
    [renderRef],
  );

  // Reset interpolator, sim state, and event cursor whenever matchId changes
  useEffect(() => {
    if (activeMatchIdRef.current !== room.matchId) {
      resetSimulationForMatch(room.matchId);
    }
  }, [room.matchId, resetSimulationForMatch]);

  // Reset simulation when active course changes (e.g. Host switches level or map pack)
  useEffect(() => {
    if (prevCourseRef.current !== course) {
      resetSimulationForMatch(roomMatchIdRef.current);
    }
  }, [course, resetSimulationForMatch]);

  // Emit initial HUD snapshot once on mount
  useEffect(() => {
    onHudSnapshotRef.current(
      buildHudSnapshot(
        renderRef.current,
        shattersRef.current,
        courseRef.current,
        levelRef.current,
        mapPackTitleRef.current,
      ),
    );
  }, [renderRef]);

  // Register Guest input & snapshot listeners without causing React re-renders
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
      if (snapshot.mapId !== undefined && snapshot.mapId !== 'glass_carry') {
        return;
      }
      if (!('glass' in snapshot)) return;
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
    (events: readonly SimEvent[]) => {
      for (const evt of events) {
        if (evt.id <= lastProcessedEventIdRef.current) continue;
        lastProcessedEventIdRef.current = evt.id;

        switch (evt.kind) {
          case 'glass_crack':
            playSfx('glassCrack');
            renderRef.current.cameraShake = Math.max(
              renderRef.current.cameraShake,
              0.45,
            );
            renderRef.current.lastCrackAt = renderRef.current.matchTime;
            break;

          case 'glass_shatter':
            playSfx('glassShatter');
            renderRef.current.cameraShake = Math.max(
              renderRef.current.cameraShake,
              0.95,
            );
            renderRef.current.shatterBurstId += 1;
            renderRef.current.shatterOrigin = [evt.x, evt.y, evt.z];
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

    if (isPlaying && !pausedRef.current) {
      if (
        localInput.lift !== 0 &&
        localInput.lift !== prevLocalLiftRef.current
      ) {
        playSfx('glassLift');
      }
      prevLocalLiftRef.current = localInput.lift;
    } else {
      prevLocalLiftRef.current = 0;
    }

    if (isHostRef.current) {
      if (isPlaying && !pausedRef.current) {
        const nowMs = performance.now();
        const guestRec = guestInputRef.current;
        const guestStale =
          guestRec.receivedAtMs === 0 ||
          nowMs - guestRec.receivedAtMs > GLASS_INPUT_STALE_MS;
        const p2Input: PlayerInput = guestStale
          ? {
              moveX: 0,
              moveZ: 0,
              jump: false,
              lift: guestRec.input.lift,
            }
          : guestRec.input;

        accumulatorRef.current += dt;
        const frameEvents: SimEvent[] = [];

        while (accumulatorRef.current >= FIXED_DT) {
          accumulatorRef.current -= FIXED_DT;
          const stepP2Input = soloAutoBalanceRef.current
            ? computeSoloStabilizerInput(simRef.current, localInput)
            : p2Input;
          const nextSim = stepGlassSim(
            simRef.current,
            localInput,
            stepP2Input,
            FIXED_DT,
            courseRef.current,
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

        shattersRef.current = simRef.current.shatters;
        copySimToRenderState(simRef.current, renderRef.current);

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
          const packed = packSimSnapshot(
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
          onHudSnapshotRef.current(
            buildHudSnapshot(
              renderRef.current,
              shattersRef.current,
              courseRef.current,
              levelRef.current,
              mapPackTitleRef.current,
            ),
          );
          room.notifyMatchFinished(
            simRef.current.matchTime,
            simRef.current.shatters,
          );
        }
      }
    } else {
      // Guest: send local input and sample interpolated snapshots
      if (isPlaying && !pausedRef.current) {
        room.sendGuestInput(localInput);
      }

      if (isPlaying || activePhase === 'finished') {
        const sampled = interpolatorRef.current.sample(performance.now());
        if (sampled) {
          shattersRef.current = sampled.shatters;
          copySnapshotToRenderState(sampled, renderRef.current);
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
      onHudSnapshotRef.current(
        buildHudSnapshot(
          renderRef.current,
          shattersRef.current,
          courseRef.current,
          levelRef.current,
          mapPackTitleRef.current,
        ),
      );
    }
  });

  return null;
}

export const GlassScene = memo(function GlassScene({
  room,
  paused,
  onHudSnapshot,
  soloAutoBalance = false,
  course,
  level,
  mapPackTitle,
}: GlassSceneProps) {
  const activeCourse = course ?? GLASS_COURSE;
  const theme = activeCourse.theme ?? GLASS_MAP_THEMES.cabin_bridge;

  const renderRef = useRef<GlassRenderState>(
    createInitialRenderState(createInitialSimState(activeCourse)),
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
      dpr={[1, 1.75]}
      camera={{ position: [0, 9.2, -10.0], fov: 46, near: 0.3, far: 160 }}
      className="h-full w-full"
    >
      <color attach="background" args={[theme.skyHex]} />
      <fog attach="fog" args={[theme.fogHex, 34, 92]} />

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

      <ambientLight intensity={0.62} color={theme.ambientLightHex} />
      <hemisphereLight args={[theme.sunLightHex, theme.abyssHex, 0.72]} />
      <directionalLight
        position={[-6, 9, -8]}
        intensity={0.55}
        color={theme.ambientLightHex}
      />
      {/* Step simulation/interpolation before scene consumers read renderRef */}
      <GlassWorldDriver
        room={room}
        paused={paused}
        readInput={readInput}
        renderRef={renderRef}
        onHudSnapshot={onHudSnapshot}
        soloAutoBalance={soloAutoBalance}
        course={activeCourse}
        level={level}
        mapPackTitle={mapPackTitle}
      />

      <FollowShadowLight
        renderRef={renderRef}
        sunLightHex={theme.sunLightHex}
      />

      <GlassCamera renderRef={renderRef} />

      <GlassCourseMesh
        key={`${theme.id}-${level ?? 1}-${activeCourse.finishZ}`}
        renderRef={renderRef}
        course={activeCourse}
      />

      <CarrierActor
        slot="p1"
        member={p1Member}
        renderRef={renderRef}
        emote={room.activeEmotes.p1 ?? null}
      />
      <CarrierActor
        slot="p2"
        member={p2Member}
        renderRef={renderRef}
        emote={room.activeEmotes.p2 ?? null}
      />

      <GlassPaneMesh renderRef={renderRef} />
    </Canvas>
  );
});
