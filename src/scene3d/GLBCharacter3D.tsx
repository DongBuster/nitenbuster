import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AnimalId, Emotion } from '../engine/types';
import type { AccessorySelection } from './accessoryCatalog';
import { Accessory3D } from './Accessory3D';
import { TurnRing3D } from './CharacterRig3D';

export interface GLBCharacter3DProps {
  url: string;
  animal?: AnimalId;
  emotion?: Emotion;
  isActive?: boolean;
  accessory?: AccessorySelection;
}

const TARGET_HEIGHT = 1.65;

const EMOTION_CLIP_KEYWORDS: Record<Emotion, string[]> = {
  idle: ['idle', 'stand', 'breath', 'rest'],
  happy: ['happy', 'jump', 'wave', 'dance', 'joy', 'clap'],
  sad: ['sad', 'cry', 'defeat', 'lose', 'depress'],
  shock: ['shock', 'hit', 'hurt', 'stun', 'dizzy', 'react', 'damage'],
  win: ['win', 'cheer', 'victory', 'celebrate', 'dance', 'happy'],
};

function findClipName(names: string[], emotion: Emotion): string | null {
  if (names.length === 0) return null;
  const keywords = EMOTION_CLIP_KEYWORDS[emotion];
  for (const kw of keywords) {
    const match = names.find((n) => n.toLowerCase().includes(kw));
    if (match) return match;
  }
  // Fallback to idle clip if available
  if (emotion !== 'idle') {
    for (const kw of EMOTION_CLIP_KEYWORDS.idle) {
      const match = names.find((n) => n.toLowerCase().includes(kw));
      if (match) return match;
    }
  }
  return names[0] ?? null;
}

export function GLBCharacter3D({
  url,
  animal = 'dog',
  emotion = 'idle',
  isActive = false,
  accessory = null,
}: GLBCharacter3DProps) {
  const { scene, animations } = useGLTF(url);
  const motionGroupRef = useRef<THREE.Group>(null);
  const modelGroupRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(Math.random() * Math.PI * 2);

  // Clone scene safely for multi-instance support + auto-normalize Box3
  const { clonedScene, normScale, normOffset } = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);

    cloned.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const scale = size.y > 0.0001 ? TARGET_HEIGHT / size.y : 1;
    const offset: [number, number, number] = [
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale,
    ];

    return { clonedScene: cloned, normScale: scale, normOffset: offset };
  }, [scene]);

  const { actions, names } = useAnimations(animations, modelGroupRef);
  const activeClipName = useMemo(() => findClipName(names, emotion), [names, emotion]);
  const hasEmbeddedClip = Boolean(activeClipName && actions[activeClipName]);

  useEffect(() => {
    if (!activeClipName) return;
    const nextAction = actions[activeClipName];
    if (!nextAction) return;

    nextAction.reset().fadeIn(0.25).play();
    return () => {
      nextAction.fadeOut(0.2);
    };
  }, [actions, activeClipName]);

  // Procedural squash-and-stretch / plush motion layered cleanly with skeletal clips
  useFrame((state, delta) => {
    const group = motionGroupRef.current;
    if (!group) return;

    const dt = Math.min(delta, 0.05);
    const smooth = 1 - Math.exp(-10 * dt);
    const t = state.clock.elapsedTime + phaseRef.current;
    const amp = hasEmbeddedClip ? 0.35 : 1.0;

    let posX = 0;
    let posY = 0;
    let posZ = 0;
    let rotX = 0;
    let rotY = 0;
    let rotZ = 0;
    let scaleX = 1;
    let scaleY = 1;
    let scaleZ = 1;

    if (emotion === 'happy') {
      const hop = Math.abs(Math.sin(t * 5.2));
      posY = hop * 0.16 * amp;
      scaleY = 1 + hop * 0.06 * amp;
      scaleX = 1 - hop * 0.03 * amp;
      scaleZ = 1 - hop * 0.03 * amp;
      rotZ = Math.sin(t * 5.2) * 0.08 * amp;
    } else if (emotion === 'sad') {
      const breath = Math.sin(t * 1.8) * 0.015 * amp;
      posX = Math.sin(t * 18) * 0.008 * amp;
      scaleY = 1 - 0.06 * amp + breath;
      scaleX = 1 + 0.03 * amp;
      scaleZ = 1 + 0.03 * amp;
      rotX = 0.14 * amp;
      rotZ = Math.sin(t * 1.3) * 0.04 * amp;
    } else if (emotion === 'shock') {
      const tremble = Math.sin(t * 42) * 0.032 * amp;
      const recoil = Math.abs(Math.sin(t * 7.5)) * 0.07 * amp;
      posX = tremble;
      posY = (0.05 + recoil) * amp;
      posZ = -0.08 * amp;
      scaleY = 1 + 0.06 * amp;
      scaleX = 1 - 0.04 * amp;
      scaleZ = 1 - 0.04 * amp;
      rotX = -0.1 * amp;
      rotZ = tremble * 1.5;
    } else if (emotion === 'win') {
      const jump = Math.abs(Math.sin(t * 5.6));
      posY = jump * 0.26 * amp;
      rotY = Math.sin(t * 2.8) * 0.38 * amp;
      scaleY = 1 + jump * 0.07 * amp;
      scaleX = 1 - jump * 0.035 * amp;
      scaleZ = 1 - jump * 0.035 * amp;
    } else {
      const breath = Math.sin(t * 2.4) * 0.025 * amp;
      scaleY = 1 + breath;
      scaleX = 1 - breath * 0.5;
      scaleZ = 1 - breath * 0.5;
      rotZ = Math.sin(t * 1.4) * 0.03 * amp;

      if (isActive) {
        const eagerHop = Math.abs(Math.sin(t * 4.4));
        posY = eagerHop * 0.1 * amp;
        rotZ = Math.sin(t * 4.4) * 0.045 * amp;
      }
    }

    group.position.x = THREE.MathUtils.lerp(group.position.x, posX, smooth);
    group.position.y = THREE.MathUtils.lerp(group.position.y, posY, smooth);
    group.position.z = THREE.MathUtils.lerp(group.position.z, posZ, smooth);
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, rotX, smooth);
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, rotY, smooth);
    group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, rotZ, smooth);
    group.scale.x = THREE.MathUtils.lerp(group.scale.x, scaleX, smooth);
    group.scale.y = THREE.MathUtils.lerp(group.scale.y, scaleY, smooth);
    group.scale.z = THREE.MathUtils.lerp(group.scale.z, scaleZ, smooth);
  });

  return (
    <group>
      <TurnRing3D active={isActive} />
      <group ref={motionGroupRef}>
        <group ref={modelGroupRef} position={normOffset} scale={normScale}>
          <primitive object={clonedScene} />
        </group>
        {accessory && <Accessory3D accessory={accessory} animal={animal} slot="all" />}
      </group>
    </group>
  );
}

// --- Cached HEAD check for bundled /models/<animal>.glb ---
export const BUNDLED_GLB_ANIMALS: ReadonlySet<AnimalId> = new Set<AnimalId>([]);

const availabilityCache = new Map<AnimalId, boolean>();
const inflightChecks = new Map<AnimalId, Promise<boolean>>();

function checkGlbAvailability(animal: AnimalId): Promise<boolean> {
  if (!BUNDLED_GLB_ANIMALS.has(animal)) {
    return Promise.resolve(false);
  }

  const cached = availabilityCache.get(animal);
  if (cached !== undefined) return Promise.resolve(cached);

  const existing = inflightChecks.get(animal);
  if (existing) return existing;

  const promise = fetch(`/models/${animal}.glb`, { method: 'HEAD' })
    .then((res) => {
      const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
      // Guard against Vite SPA fallback returning 200 text/html for missing files
      const ok = res.status === 200 && !contentType.includes('text/html');
      availabilityCache.set(animal, ok);
      return ok;
    })
    .catch(() => {
      availabilityCache.set(animal, false);
      return false;
    })
    .finally(() => {
      inflightChecks.delete(animal);
    });

  inflightChecks.set(animal, promise);
  return promise;
}

export function useGlbAvailability(animal: AnimalId): boolean {
  const isBundled = BUNDLED_GLB_ANIMALS.has(animal);
  const [available, setAvailable] = useState<boolean>(() =>
    isBundled ? (availabilityCache.get(animal) ?? false) : false,
  );

  useEffect(() => {
    if (!isBundled) {
      setAvailable(false);
      return;
    }

    const cached = availabilityCache.get(animal);
    if (cached !== undefined) {
      setAvailable(cached);
      return;
    }

    let cancelled = false;
    checkGlbAvailability(animal).then((ok) => {
      if (!cancelled) setAvailable(ok);
    });

    return () => {
      cancelled = true;
    };
  }, [animal, isBundled]);

  return isBundled ? available : false;
}

// --- Local React ErrorBoundary so broken/missing GLBs silently fall back ---
interface GLBErrorBoundaryProps {
  resetKey: string;
  fallback: ReactNode;
  children: ReactNode;
}

interface GLBErrorBoundaryState {
  hasError: boolean;
}

export class GLBErrorBoundary extends Component<
  GLBErrorBoundaryProps,
  GLBErrorBoundaryState
> {
  state: GLBErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): GLBErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: GLBErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally silent: falls back to procedural 3D character without crashing Canvas
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
