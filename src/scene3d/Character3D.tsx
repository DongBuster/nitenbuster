import { Suspense, type ComponentType } from 'react';
import type { AnimalId, Emotion } from '../engine/types';
import type { Animal3DProps } from './CharacterRig3D';
import {
  GLBCharacter3D,
  GLBErrorBoundary,
  useGlbAvailability,
} from './GLBCharacter3D';
import { Accessory3D } from './Accessory3D';
import { Dog3D } from './animals/Dog3D';
import { Cat3D } from './animals/Cat3D';
import { Duck3D } from './animals/Duck3D';
import { Shark3D } from './animals/Shark3D';
import { Dino3D } from './animals/Dino3D';
import { Panda3D } from './animals/Panda3D';
import { Chicken3D } from './animals/Chicken3D';
import { Rabbit3D } from './animals/Rabbit3D';

export interface Character3DProps {
  animal: AnimalId;
  emotion?: Emotion;
  isActive?: boolean;
  modelUrl?: string | null;
  accessory?: string | null;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  onClick?: () => void;
}

const ANIMAL_3D_MAP: Record<AnimalId, ComponentType<Animal3DProps>> = {
  dog: Dog3D,
  cat: Cat3D,
  duck: Duck3D,
  shark: Shark3D,
  dino: Dino3D,
  panda: Panda3D,
  chicken: Chicken3D,
  bunny: Rabbit3D,
};

export function Character3D({
  animal,
  emotion = 'idle',
  isActive = false,
  modelUrl = null,
  accessory = null,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  onClick,
}: Character3DProps) {
  const AnimalComponent = ANIMAL_3D_MAP[animal];
  const hasBundledGlb = useGlbAvailability(animal);

  const resolvedGlbUrl = modelUrl || (hasBundledGlb ? `/models/${animal}.glb` : null);
  const proceduralFallback = (
    <AnimalComponent emotion={emotion} isActive={isActive} />
  );

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      onPointerOver={
        onClick
          ? (e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }
          : undefined
      }
      onPointerOut={
        onClick
          ? () => {
              document.body.style.cursor = 'auto';
            }
          : undefined
      }
    >
      {resolvedGlbUrl ? (
        <GLBErrorBoundary
          resetKey={`${animal}:${resolvedGlbUrl}`}
          fallback={proceduralFallback}
        >
          <Suspense fallback={proceduralFallback}>
            <GLBCharacter3D
              url={resolvedGlbUrl}
              emotion={emotion}
              isActive={isActive}
            />
          </Suspense>
        </GLBErrorBoundary>
      ) : (
        proceduralFallback
      )}
      {accessory && <Accessory3D accessory={accessory} animal={animal} />}
    </group>
  );
}
