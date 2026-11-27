import { memo, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import {
  BRAWL_SNAPSHOT_INTERVAL_MS,
  type BrawlSnapshotPayload,
} from '../online/protocol';
import { BrawlSnapshotInterpolator } from '../online/snapshotInterpolation';
import { generateHexArena } from '../sim/arenaLayout';
import { GRAVITY } from '../sim/constants';
import type {
  BrawlDifficulty,
  FighterConfig,
  FighterInput,
  HudSnapshot,
  MatchPhase,
} from '../sim/types';
import { ArenaFloor } from './ArenaFloor';
import { BrawlCamera } from './BrawlCamera';
import { FighterActor } from './FighterActor';
import { ItemPickups } from './ItemPickups';
import { BrawlWorldRuntime } from './worldRuntime';

export interface BrawlArenaOnlineConfig {
  role: 'host' | 'client';
  localFighterId: string;
  /** Host reads remote player inputs here each frame. */
  getRemoteInputs?: () => Record<string, FighterInput>;
  /** Host broadcasts packed snapshots at ~20Hz. */
  onBroadcastSnapshot?: (snapshot: BrawlSnapshotPayload) => void;
  /** Client sends local inputs at ~20Hz. */
  onSendClientInput?: (input: FighterInput) => void;
  /** Client subscribes its interpolator to incoming host snapshots. */
  interpolatorRef?: MutableRefObject<BrawlSnapshotInterpolator>;
  /** Optional handle so Host adapter can query tie-break stats on timeout. */
  runtimeRef?: MutableRefObject<BrawlWorldRuntime | null>;
}

interface DriverProps {
  roundKey: string;
  runtime: BrawlWorldRuntime;
  phase: MatchPhase;
  paused: boolean;
  consumeInput: () => FighterInput;
  onEliminateBatch: (ids: string[]) => void;
  onHudSnapshot: (hud: HudSnapshot) => void;
  onlineConfig?: BrawlArenaOnlineConfig;
}

function ArenaSimulationDriver({
  roundKey,
  runtime,
  phase,
  paused,
  consumeInput,
  onEliminateBatch,
  onHudSnapshot,
  onlineConfig,
}: DriverProps) {
  const hudAccumRef = useRef<number>(0);
  const lastBroadcastMsRef = useRef<number>(0);
  const tickRef = useRef<number>(0);

  useEffect(() => {
    tickRef.current = 0;
    lastBroadcastMsRef.current = 0;
  }, [roundKey]);

  useFrame((_, dt) => {
    if (paused) return;

    const localFighterId = onlineConfig?.localFighterId ?? 'human';

    if (onlineConfig?.role === 'client') {
      const nowMs = performance.now();
      if (phase === 'fighting' && onlineConfig.onSendClientInput) {
        onlineConfig.onSendClientInput(consumeInput());
      } else {
        consumeInput();
      }

      const sampled = onlineConfig.interpolatorRef?.current.sample(nowMs);
      if (sampled && sampled.roundKey === roundKey) {
        runtime.applySnapshot(sampled);
      }

      hudAccumRef.current += dt;
      if (hudAccumRef.current >= 0.1) {
        hudAccumRef.current = 0;
        onHudSnapshot(runtime.getHudSnapshot(localFighterId));
      }
      return;
    }

    const humanInput = consumeInput();
    runtime.stepFrame({
      dt,
      phase,
      humanInput,
      localFighterId,
      remoteInputs: onlineConfig?.getRemoteInputs?.(),
      onEliminateBatch,
    });

    if (onlineConfig?.role === 'host' && onlineConfig.onBroadcastSnapshot) {
      const nowMs = performance.now();
      if (nowMs - lastBroadcastMsRef.current >= BRAWL_SNAPSHOT_INTERVAL_MS) {
        lastBroadcastMsRef.current = nowMs;
        tickRef.current += 1;
        onlineConfig.onBroadcastSnapshot(
          runtime.exportSnapshot(roundKey, tickRef.current),
        );
      }
    }

    hudAccumRef.current += dt;
    if (hudAccumRef.current >= 0.1) {
      hudAccumRef.current = 0;
      onHudSnapshot(runtime.getHudSnapshot(localFighterId));
    }
  });

  return null;
}

export interface ArenaSceneProps {
  roundKey: string;
  fighters: FighterConfig[];
  difficulty: BrawlDifficulty;
  phase: MatchPhase;
  paused: boolean;
  consumeInput: () => FighterInput;
  onEliminateBatch: (ids: string[]) => void;
  onHudSnapshot: (hud: HudSnapshot) => void;
  onlineConfig?: BrawlArenaOnlineConfig;
}

export const ArenaScene = memo(function ArenaScene({
  roundKey,
  fighters,
  difficulty,
  phase,
  paused,
  consumeInput,
  onEliminateBatch,
  onHudSnapshot,
  onlineConfig,
}: ArenaSceneProps) {
  const tiles = useMemo(() => generateHexArena(), []);

  const runtime = useMemo(
    () => new BrawlWorldRuntime(fighters, tiles, difficulty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roundKey],
  );

  const localFighterId = onlineConfig?.localFighterId ?? 'human';
  const isRemoteClient = onlineConfig?.role === 'client';

  useEffect(() => {
    if (onlineConfig?.runtimeRef) {
      onlineConfig.runtimeRef.current = runtime;
    }
    onHudSnapshot(runtime.getHudSnapshot(localFighterId));
    return () => {
      if (onlineConfig?.runtimeRef && onlineConfig.runtimeRef.current === runtime) {
        onlineConfig.runtimeRef.current = null;
      }
    };
  }, [localFighterId, onlineConfig?.runtimeRef, runtime, onHudSnapshot]);

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 14, 16], fov: 46, near: 0.3, far: 120 }}
      className="h-full w-full"
    >
      <color attach="background" args={['#14243A']} />
      <fog attach="fog" args={['#14243A', 24, 60]} />

      <Environment resolution={128} frames={1}>
        <Lightformer
          form="ring"
          intensity={1.6}
          color="#FFE7C2"
          position={[0, 8, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={14}
        />
        <Lightformer
          form="rect"
          intensity={1.8}
          color="#CFE8FF"
          position={[-6, 5, -8]}
          rotation={[0, Math.PI / 6, 0]}
          scale={[10, 5, 1]}
        />
      </Environment>

      <ambientLight intensity={0.65} color="#F8FAFC" />
      <hemisphereLight args={['#FFF7ED', '#1E3A5F', 0.7]} />
      <directionalLight
        position={[7, 14, 8]}
        intensity={1.45}
        color="#FFE8CC"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-bias={-0.0005}
      />

      <ArenaSimulationDriver
        roundKey={roundKey}
        runtime={runtime}
        phase={phase}
        paused={paused}
        consumeInput={consumeInput}
        onEliminateBatch={onEliminateBatch}
        onHudSnapshot={onHudSnapshot}
        onlineConfig={onlineConfig}
      />

      <BrawlCamera runtime={runtime} />

      <Physics
        key={roundKey}
        gravity={[0, GRAVITY, 0]}
        timeStep={isRemoteClient ? 'vary' : 1 / 60}
        paused={paused}
      >
        <ArenaFloor tiles={tiles} runtime={runtime} />

        {fighters.map((cfg) => (
          <FighterActor
            key={`${roundKey}_${cfg.id}`}
            config={cfg}
            totalFighters={fighters.length}
            runtime={runtime}
            isLocalPlayer={
              onlineConfig ? cfg.id === localFighterId : !cfg.isBot
            }
            isRemoteClient={isRemoteClient}
          />
        ))}
      </Physics>

      <ItemPickups runtime={runtime} />
    </Canvas>
  );
});
