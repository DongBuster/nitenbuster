import type { ReactElement } from 'react';
import type { AnimalId } from '../engine/types';
import {
  ACCESSORY_ANCHORS,
  BONE_ROOT_OFFSETS,
  getAccessorySlot,
  type AccessorySlot,
  type AnimalAccessoryAnchors,
} from './accessoryAnchors';
import {
  normalizeAccessories,
  type AccessorySelection,
} from './accessoryCatalog';
import {
  BeanieMesh,
  CrownMesh,
  GlassesMesh,
  HeadphonesMesh,
  PartyHatMesh,
  PixelShadesMesh,
  RoundGlassesMesh,
} from './accessories/HeadAccessories';
import {
  AngelWingsMesh,
  BackpackMesh,
  BowtieMesh,
  GoldChainMesh,
  RoyalCapeMesh,
  ScarfMesh,
} from './accessories/NeckAndBackAccessories';
import { CozyHoodieMesh, MuJerseyMesh } from './accessories/OutfitAccessories';

export type { AccessorySlot };

export interface Accessory3DProps {
  accessory?: AccessorySelection;
  animal?: AnimalId;
  slot?: AccessorySlot;
}

interface RenderContext {
  hasOutfit: boolean;
}

const ACCESSORY_RENDERERS: Record<
  string,
  (anchors: AnimalAccessoryAnchors, ctx: RenderContext) => ReactElement
> = {
  mu_jersey: (a) => <MuJerseyMesh anchor={a.outfit} />,
  cozy_hoodie: (a) => <CozyHoodieMesh anchor={a.outfit} />,
  scarf: (a, ctx) => <ScarfMesh anchor={a.scarf} hasOutfit={ctx.hasOutfit} />,
  bowtie: (a, ctx) => <BowtieMesh anchor={a.scarf} hasOutfit={ctx.hasOutfit} />,
  gold_chain: (a, ctx) => <GoldChainMesh anchor={a.scarf} hasOutfit={ctx.hasOutfit} />,
  glasses: (a) => <GlassesMesh anchor={a.glasses} />,
  round_glasses: (a) => <RoundGlassesMesh anchor={a.glasses} />,
  pixel_shades: (a) => <PixelShadesMesh anchor={a.glasses} />,
  party_hat: (a) => <PartyHatMesh anchor={a.hat} />,
  beanie: (a) => <BeanieMesh anchor={a.hat} />,
  headphones: (a) => <HeadphonesMesh anchor={a.headphones} />,
  crown: (a) => <CrownMesh anchor={a.hat} />,
  backpack: (a, ctx) => <BackpackMesh anchor={a.back} hasOutfit={ctx.hasOutfit} />,
  angel_wings: (a, ctx) => <AngelWingsMesh anchor={a.back} hasOutfit={ctx.hasOutfit} />,
  royal_cape: (a, ctx) => <RoyalCapeMesh anchor={a.back} hasOutfit={ctx.hasOutfit} />,
};

export function Accessory3D({
  accessory,
  animal = 'dog',
  slot = 'all',
}: Accessory3DProps) {
  const activeIds = normalizeAccessories(accessory);
  if (activeIds.length === 0) return null;

  const anchors = ACCESSORY_ANCHORS[animal] ?? ACCESSORY_ANCHORS.dog;
  const offsets = BONE_ROOT_OFFSETS[animal] ?? BONE_ROOT_OFFSETS.dog;
  const ctx: RenderContext = {
    hasOutfit:
      activeIds.includes('mu_jersey') || activeIds.includes('cozy_hoodie'),
  };

  const rendered = activeIds
    .map((id) => {
      const targetSlot = getAccessorySlot(id, animal);
      if (slot !== 'all' && slot !== targetSlot) return null;

      const renderItem = ACCESSORY_RENDERERS[id];
      if (!renderItem) return null;

      const node = renderItem(anchors, ctx);
      if (slot === 'all') {
        const pos = targetSlot === 'body' ? offsets.body : offsets.head;
        const rotZ = targetSlot === 'head' ? (offsets.headRotZ ?? 0) : 0;
        return (
          <group key={id} position={pos} rotation={[0, 0, rotZ]}>
            {node}
          </group>
        );
      }

      return <group key={id}>{node}</group>;
    })
    .filter((n): n is ReactElement => n !== null);

  if (rendered.length === 0) return null;
  return <>{rendered}</>;
}
