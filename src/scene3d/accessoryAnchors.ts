import type { AnimalId } from '../engine/types';
import { getAccessoryMeta } from './accessoryCatalog.ts';

export type AccessorySlot = 'body' | 'head' | 'all';

export interface ScarfAnchor {
  y: number;
  z: number;
  scale: [number, number, number];
  rotX?: number;
  tailZ?: number;
  tailPitch?: number;
  tailLen?: number;
}

export interface GlassesAnchor {
  y: number;
  z: number;
  scale: number;
  spread: number;
  lensAngleY?: number;
  lensBackZ?: number;
  templeX?: number;
  templeLength?: number;
  bridgeY?: number;
  bridgeZ?: number;
}

export interface HatAnchor {
  x?: number;
  y: number;
  z: number;
  scale: number;
  rotX?: number;
  rotZ?: number;
}

export interface HeadphonesAnchor {
  y: number;
  z: number;
  earSpread: number;
  earY: number;
  bandHeight: number;
  scale?: number;
}

export interface OutfitAnchor {
  y: number;
  z: number;
  scale: [number, number, number];
  chestZ: number;
  backZ: number;
  shoulderX: number;
  shoulderY: number;
  shoulderZ: number;
}

export interface BackAnchor {
  y: number;
  z: number;
  scale: number;
  rotX?: number;
}

export interface AnimalAccessoryAnchors {
  /** Whether hats mount onto `body` (e.g. Shark/Chicken continuous hood/pear dome) or `head`. */
  hatBone: 'body' | 'head';
  scarf: ScarfAnchor;
  glasses: GlassesAnchor;
  hat: HatAnchor;
  headphones: HeadphonesAnchor;
  outfit: OutfitAnchor;
  back: BackAnchor;
}

export interface BoneRootOffset {
  body: [number, number, number];
  head: [number, number, number];
  headRotZ?: number;
}

/**
 * World-space origin of each animal's `body` and `head` rig groups in neutral pose,
 * used when `slot="all"` (e.g., uploaded GLB fallback characters).
 */
export const BONE_ROOT_OFFSETS: Record<AnimalId, BoneRootOffset> = {
  dog: { body: [0, 0.45, 0], head: [0, 1.1, 0.02] },
  cat: { body: [0, 0.45, 0], head: [0, 1.09, 0.02] },
  duck: { body: [0, 0.47, 0], head: [0, 1.03, 0.02], headRotZ: -0.06 },
  shark: { body: [0, 0.11, 0], head: [0, 1.15, 0] },
  dino: { body: [0, 0.11, 0], head: [0, 1.15, 0.04] },
  panda: { body: [0, 0.15, 0], head: [0, 1.15, 0.02] },
  chicken: { body: [0, 0.075, 0], head: [0, 1.025, 0] },
  bunny: { body: [0, 0.45, 0], head: [0, 1.01, 0.02] },
};

/**
 * Per-animal accessory anchors expressed in the local coordinate space of the target bone
 * (`body` for outfit/neck/back and continuous-dome hats; `head` for eyes and cranium hats).
 */
export const ACCESSORY_ANCHORS: Record<AnimalId, AnimalAccessoryAnchors> = {
  dog: {
    hatBone: 'head',
    scarf: {
      y: 0.31,
      z: 0.05,
      scale: [1.15, 0.96, 1.18],
      rotX: 0.12,
      tailZ: 0.44,
      tailPitch: -0.32,
      tailLen: 0.23,
    },
    glasses: {
      y: 0.105,
      z: 0.515,
      scale: 0.86,
      spread: 0.15,
      templeX: 0.5,
      templeLength: 0.36,
      bridgeY: 0.035,
      bridgeZ: 0.015,
    },
    hat: { y: 0.41, z: 0.0, scale: 0.86 },
    headphones: { y: 0.45, z: 0.0, earSpread: 0.52, earY: -0.42, bandHeight: 0.46, scale: 0.95 },
    outfit: {
      y: 0.0,
      z: 0.05,
      scale: [0.52, 0.56, 0.53],
      chestZ: 0.51,
      backZ: -0.45,
      shoulderX: 0.41,
      shoulderY: 0.21,
      shoulderZ: 0.1,
    },
    back: { y: 0.14, z: -0.41, scale: 0.96, rotX: -0.16 },
  },
  cat: {
    hatBone: 'head',
    scarf: {
      y: 0.3,
      z: 0.04,
      scale: [1.16, 0.96, 1.18],
      rotX: 0.12,
      tailZ: 0.41,
      tailPitch: -0.28,
      tailLen: 0.24,
    },
    glasses: {
      y: 0.085,
      z: 0.505,
      scale: 0.88,
      spread: 0.17,
      templeX: 0.52,
      templeLength: 0.36,
      bridgeY: 0.035,
      bridgeZ: 0.015,
    },
    hat: { y: 0.39, z: 0.0, scale: 0.86 },
    headphones: { y: 0.43, z: 0.0, earSpread: 0.54, earY: -0.4, bandHeight: 0.44, scale: 0.95 },
    outfit: {
      y: 0.0,
      z: 0.05,
      scale: [0.53, 0.56, 0.54],
      chestZ: 0.52,
      backZ: -0.46,
      shoulderX: 0.42,
      shoulderY: 0.21,
      shoulderZ: 0.1,
    },
    back: { y: 0.15, z: -0.41, scale: 0.95, rotX: -0.18 },
  },
  duck: {
    hatBone: 'head',
    scarf: {
      y: 0.38,
      z: 0.02,
      scale: [1.16, 0.96, 1.16],
      rotX: 0.1,
      tailZ: 0.41,
      tailPitch: -0.32,
      tailLen: 0.24,
    },
    glasses: {
      y: 0.165,
      z: 0.42,
      scale: 0.78,
      spread: 0.13,
      templeX: 0.39,
      templeLength: 0.34,
      bridgeY: 0.03,
      bridgeZ: 0.015,
    },
    hat: { x: -0.05, y: 0.43, z: 0.03, scale: 0.8, rotZ: 0.16 },
    headphones: { y: 0.47, z: -0.02, earSpread: 0.41, earY: -0.39, bandHeight: 0.42, scale: 0.86 },
    outfit: {
      y: 0.05,
      z: 0.01,
      scale: [0.56, 0.62, 0.56],
      chestZ: 0.52,
      backZ: -0.5,
      shoulderX: 0.44,
      shoulderY: 0.23,
      shoulderZ: 0.04,
    },
    back: { y: 0.2, z: -0.44, scale: 0.95, rotX: -0.22 },
  },
  shark: {
    hatBone: 'body',
    scarf: {
      y: 0.63,
      z: 0.02,
      scale: [1.34, 1.0, 1.28],
      rotX: 0.06,
      tailZ: 0.41,
      tailPitch: -0.26,
      tailLen: 0.24,
    },
    glasses: {
      y: 0.145,
      z: 0.365,
      scale: 0.78,
      spread: 0.295,
      lensAngleY: 0.64,
      lensBackZ: -0.115,
      templeX: 0.36,
      templeLength: 0.3,
      bridgeY: 0.04,
      bridgeZ: 0.02,
    },
    hat: { y: 1.5, z: 0.0, scale: 0.65 },
    headphones: { y: 1.56, z: 0.0, earSpread: 0.38, earY: -0.36, bandHeight: 0.38, scale: 0.84 },
    outfit: {
      y: 0.34,
      z: 0.04,
      scale: [0.54, 0.52, 0.55],
      chestZ: 0.54,
      backZ: -0.47,
      shoulderX: 0.46,
      shoulderY: 0.6,
      shoulderZ: 0.05,
    },
    back: { y: 0.58, z: -0.48, scale: 0.9, rotX: -0.08 },
  },
  dino: {
    hatBone: 'head',
    scarf: {
      y: 0.74,
      z: 0.05,
      scale: [1.14, 0.96, 1.24],
      rotX: 0.14,
      tailZ: 0.41,
      tailPitch: -0.32,
      tailLen: 0.23,
    },
    glasses: {
      y: 0.125,
      z: 0.42,
      scale: 0.84,
      spread: 0.265,
      lensAngleY: 0.38,
      lensBackZ: -0.11,
      templeX: 0.36,
      templeLength: 0.32,
      bridgeY: 0.085,
      bridgeZ: 0.015,
    },
    hat: { x: -0.18, y: 0.31, z: 0.08, scale: 0.68, rotZ: 0.38 },
    headphones: { y: 0.38, z: 0.02, earSpread: 0.39, earY: -0.34, bandHeight: 0.38, scale: 0.86 },
    outfit: {
      y: 0.43,
      z: 0.06,
      scale: [0.54, 0.56, 0.56],
      chestZ: 0.55,
      backZ: -0.46,
      shoulderX: 0.43,
      shoulderY: 0.63,
      shoulderZ: 0.12,
    },
    back: { y: 0.56, z: -0.44, scale: 0.94, rotX: -0.18 },
  },
  panda: {
    hatBone: 'head',
    scarf: {
      y: 0.72,
      z: 0.04,
      scale: [1.28, 0.94, 1.26],
      rotX: 0.08,
      tailZ: 0.44,
      tailPitch: -0.42,
      tailLen: 0.21,
    },
    glasses: {
      y: 0.07,
      z: 0.51,
      scale: 0.88,
      spread: 0.165,
      templeX: 0.5,
      templeLength: 0.36,
      bridgeY: 0.035,
      bridgeZ: 0.015,
    },
    hat: { y: 0.41, z: 0.0, scale: 0.86 },
    headphones: { y: 0.45, z: 0.0, earSpread: 0.51, earY: -0.42, bandHeight: 0.45, scale: 0.95 },
    outfit: {
      y: 0.42,
      z: 0.03,
      scale: [0.54, 0.56, 0.55],
      chestZ: 0.53,
      backZ: -0.47,
      shoulderX: 0.38,
      shoulderY: 0.67,
      shoulderZ: 0.06,
    },
    back: { y: 0.58, z: -0.45, scale: 0.95, rotX: -0.16 },
  },
  chicken: {
    hatBone: 'body',
    scarf: {
      y: 0.81,
      z: 0.02,
      scale: [1.22, 0.94, 1.22],
      rotX: 0.08,
      tailZ: 0.41,
      tailPitch: -0.34,
      tailLen: 0.22,
    },
    glasses: {
      y: 0.14,
      z: 0.365,
      scale: 0.76,
      spread: 0.155,
      lensAngleY: 0.26,
      lensBackZ: -0.035,
      templeX: 0.36,
      templeLength: 0.3,
      bridgeY: 0.035,
      bridgeZ: 0.015,
    },
    hat: { x: -0.18, y: 1.24, z: -0.05, scale: 0.65, rotX: -0.16, rotZ: 0.38 },
    headphones: { y: 1.35, z: -0.05, earSpread: 0.37, earY: -0.27, bandHeight: 0.32, scale: 0.84 },
    outfit: {
      y: 0.43,
      z: 0.01,
      scale: [0.6, 0.6, 0.59],
      chestZ: 0.55,
      backZ: -0.53,
      shoulderX: 0.46,
      shoulderY: 0.58,
      shoulderZ: 0.04,
    },
    back: { y: 0.66, z: -0.48, scale: 0.92, rotX: -0.22 },
  },
  bunny: {
    hatBone: 'head',
    scarf: {
      y: 0.29,
      z: 0.03,
      scale: [1.1, 0.94, 1.14],
      rotX: 0.1,
      tailZ: 0.41,
      tailPitch: -0.28,
      tailLen: 0.23,
    },
    glasses: {
      y: 0.07,
      z: 0.455,
      scale: 0.84,
      spread: 0.185,
      lensAngleY: 0.16,
      lensBackZ: -0.02,
      templeX: 0.45,
      templeLength: 0.34,
      bridgeY: 0.035,
      bridgeZ: 0.015,
    },
    hat: { y: 0.39, z: 0.18, scale: 0.68, rotX: 0.36 },
    headphones: { y: 0.45, z: 0.08, earSpread: 0.46, earY: -0.4, bandHeight: 0.43, scale: 0.9 },
    outfit: {
      y: -0.02,
      z: 0.02,
      scale: [0.5, 0.54, 0.5],
      chestZ: 0.48,
      backZ: -0.44,
      shoulderX: 0.41,
      shoulderY: 0.2,
      shoulderZ: 0.08,
    },
    back: { y: 0.14, z: -0.39, scale: 0.92, rotX: -0.16 },
  },
};

export function getAccessorySlot(
  accessory: string,
  animal: AnimalId,
): 'body' | 'head' {
  const meta = getAccessoryMeta(accessory);
  const anchors = ACCESSORY_ANCHORS[animal] ?? ACCESSORY_ANCHORS.dog;
  if (meta?.category === 'eyes') return 'head';
  if (meta?.category === 'hat') return anchors.hatBone;
  if (meta?.category === 'outfit' || meta?.category === 'neck' || meta?.category === 'back') {
    return 'body';
  }
  if (accessory === 'glasses') return 'head';
  if (accessory === 'party_hat' || accessory === 'crown') return anchors.hatBone;
  return 'body';
}
