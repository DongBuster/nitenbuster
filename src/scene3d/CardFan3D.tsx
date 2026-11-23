import { useState } from 'react';
import type { CardData, Color } from '../engine/types';
import { Card3D } from './Card3D';

export interface CardFan3DProps {
  cards: CardData[];
  playableIds?: string[];
  interactive?: boolean;
  selectedId?: string | null;
  onSelectCard?: (card: CardData, index: number) => void;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  spreadAngle?: number;
  radius?: number;
  faceDownIds?: string[];
  activeWildColor?: Color;
}

/**
 * Renders a hand of PAWS cards in a graceful 3D curved arc fan
 * with hover lift, playable dimming, click selection, and clean depth layering.
 */
export function CardFan3D({
  cards,
  playableIds,
  interactive = true,
  selectedId,
  onSelectCard,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  spreadAngle = 0.72,
  radius = 4.2,
  faceDownIds,
  activeWildColor,
}: CardFan3DProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const effectiveSelectedId =
    selectedId !== undefined ? selectedId : internalSelectedId;

  const count = cards.length;
  if (count === 0) {
    return null;
  }

  // Dynamically widen arc and gently scale down when hand grows beyond 8 cards
  const extraCards = Math.max(0, count - 8);
  const effectiveSpread = Math.min(spreadAngle * (1 + extraCards * 0.085), 1.24);
  const effectiveScale = scale * Math.max(0.68, 1 - extraCards * 0.042);
  const zStep = count > 10 ? 0.048 : 0.055;

  return (
    <group position={position} rotation={rotation} scale={effectiveScale}>
      {cards.map((card, index) => {
        const t = count === 1 ? 0 : index / (count - 1) - 0.5;
        const angle = t * effectiveSpread;

        // Strictly parallel Z planes (zStep > 0.035 card thickness) prevent 3D edge clipping
        const x = Math.sin(angle) * radius * 0.76;
        const y = (Math.cos(angle) - 1) * radius * 0.34;
        const z = index * zStep;

        const rotZ = -angle * 0.48;
        const rotY = 0;

        const isSelected = effectiveSelectedId === card.id;
        const isFaceDown = faceDownIds ? faceDownIds.includes(card.id) : false;
        // When interactive === false (e.g. waiting for bot turns), keep cards visually bright
        const isPlayable = !interactive
          ? true
          : playableIds
            ? playableIds.includes(card.id)
            : true;
        const canInteract = interactive && isPlayable;

        return (
          <Card3D
            key={card.id}
            type={card.type}
            color={card.color}
            value={card.value}
            faceDown={isFaceDown}
            playable={isPlayable}
            selected={isSelected}
            activeWildColor={activeWildColor}
            position={[x, y, z]}
            rotation={[0, rotY, rotZ]}
            hoverLift={canInteract}
            onClick={
              canInteract
                ? () => {
                    if (selectedId === undefined) {
                      setInternalSelectedId((prev) =>
                        prev === card.id ? null : card.id,
                      );
                    }
                    onSelectCard?.(card, index);
                  }
                : undefined
            }
          />
        );
      })}
    </group>
  );
}
