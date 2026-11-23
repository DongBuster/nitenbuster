import { useState } from 'react';
import type { CardData, Color } from '../engine/types';
import { Card3D } from './Card3D';

export interface CardFan3DProps {
  cards: CardData[];
  playableIds?: string[];
  interactive?: boolean;
  layout?: 'fan' | 'row';
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
 * Renders a hand of PAWS cards either as a full-width horizontal row (zero/minimal overlap
 * for instant readability) or a 3D curved arc fan, ensuring hovered cards always pop cleanly
 * in front of all neighboring cards.
 */
export function CardFan3D({
  cards,
  playableIds,
  interactive = true,
  layout = 'fan',
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

  const isRow = layout === 'row';
  const zStep = isRow ? 0.04 : count > 10 ? 0.048 : 0.055;

  // For full-width horizontal row: up to 7 cards have zero overlap (step = 1.06 > 1.0 card width),
  // and larger hands compress gracefully across the full width.
  const rowMaxSpan = 6.9;
  const rowStep = count <= 1 ? 0 : Math.min(1.06, rowMaxSpan / (count - 1));
  const rowScale =
    isRow && count > 10
      ? scale * Math.max(0.76, 1 - (count - 10) * 0.04)
      : scale;

  // For curved fan layout
  const extraCards = Math.max(0, count - 8);
  const effectiveSpread = Math.min(spreadAngle * (1 + extraCards * 0.085), 1.24);
  const effectiveScale = isRow
    ? rowScale
    : scale * Math.max(0.68, 1 - extraCards * 0.042);

  return (
    <group position={position} rotation={rotation} scale={effectiveScale}>
      {cards.map((card, index) => {
        let x = 0;
        let y = 0;
        let rotZ = 0;

        if (isRow) {
          const mid = (count - 1) / 2;
          x = (index - mid) * rowStep;
        } else {
          const t = count === 1 ? 0 : index / (count - 1) - 0.5;
          const angle = t * effectiveSpread;
          x = Math.sin(angle) * radius * 0.76;
          y = (Math.cos(angle) - 1) * radius * 0.34;
          rotZ = -angle * 0.48;
        }

        const z = index * zStep;
        // Guarantee hovered/selected card always pops cleanly in front of ALL cards in the hand
        const hoverZBoost = (count - 1 - index) * zStep + 0.32;

        const isSelected = effectiveSelectedId === card.id;
        const isFaceDown = faceDownIds ? faceDownIds.includes(card.id) : false;
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
            rotation={[0, 0, rotZ]}
            hoverLift={canInteract}
            hoverZBoost={hoverZBoost}
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
