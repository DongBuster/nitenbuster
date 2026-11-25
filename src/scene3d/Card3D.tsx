import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { CardType, Color } from '../engine/types';
import { CARD_META, COLOR_THEME } from '../components/Card/cardMeta';
import { getCardBackTexture, getCardFrontTexture } from './cardTextures';

export interface Card3DProps {
  type?: CardType;
  color?: Color;
  value?: number;
  faceDown?: boolean;
  playable?: boolean;
  selected?: boolean;
  forceHover?: boolean;
  activeWildColor?: Color;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  hoverLift?: boolean;
  hoverZBoost?: number;
  onInfoAnchorRef?: (obj: THREE.Object3D | null) => void;
  onClick?: () => void;
}

const CARD_WIDTH = 1.0;
const CARD_HEIGHT = 1.42;
const CARD_THICKNESS = 0.035;

const SHARED_CARD_BOX_GEO = new THREE.BoxGeometry(
  CARD_WIDTH,
  CARD_HEIGHT,
  CARD_THICKNESS,
);
const SHARED_HALO_BOX_GEO = new THREE.BoxGeometry(
  CARD_WIDTH + 0.06,
  CARD_HEIGHT + 0.06,
  CARD_THICKNESS * 0.65,
);

const BRIGHT_COLOR = new THREE.Color('#ffffff');
const DIMMED_COLOR = new THREE.Color('#686D7E');
const EDGE_BRIGHT_COLOR = new THREE.Color('#f8fafc');
const EDGE_DIMMED_COLOR = new THREE.Color('#64697A');

export function Card3D({
  type = 'basic',
  color,
  value = 0,
  faceDown = false,
  playable = true,
  selected = false,
  forceHover = false,
  activeWildColor,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  hoverLift = true,
  hoverZBoost = 0.25,
  onInfoAnchorRef,
  onClick,
}: Card3DProps) {
  const innerGroupRef = useRef<THREE.Group>(null);
  const frontMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const backMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const edgeMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const [hovered, setHovered] = useState(false);

  const meta = CARD_META[type];
  const isWild = meta.isWild || !color;
  const activeWildTheme =
    isWild && activeWildColor ? COLOR_THEME[activeWildColor] : null;

  const frontTexture = useMemo(
    () => getCardFrontTexture({ type, color, value, activeWildColor }),
    [type, color, value, activeWildColor],
  );
  const backTexture = useMemo(() => getCardBackTexture(), []);

  const isInteractive = Boolean(onClick) && playable;
  const isHovered = hovered || forceHover;

  useEffect(() => {
    if (isHovered && isInteractive) {
      document.body.style.cursor = 'pointer';
      return () => {
        document.body.style.cursor = 'auto';
      };
    }
  }, [isHovered, isInteractive]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const lerpFactor = 1 - Math.exp(-10 * dt);
    const grp = innerGroupRef.current;

    if (grp) {
      const canLift = hoverLift && playable && isHovered;
      const targetY = selected ? 0.24 : canLift ? 0.24 : 0;
      const targetZ = selected ? hoverZBoost : canLift ? hoverZBoost : 0;
      const targetRotY = faceDown ? Math.PI : 0;
      const targetRotX = 0;
      const targetScale = selected ? 1.08 : canLift ? 1.12 : 1;

      grp.position.y = THREE.MathUtils.lerp(grp.position.y, targetY, lerpFactor);
      grp.position.z = THREE.MathUtils.lerp(grp.position.z, targetZ, lerpFactor);
      grp.rotation.y = THREE.MathUtils.lerp(grp.rotation.y, targetRotY, lerpFactor);
      grp.rotation.x = THREE.MathUtils.lerp(grp.rotation.x, targetRotX, lerpFactor);

      const nextScale = THREE.MathUtils.lerp(grp.scale.x, targetScale, lerpFactor);
      grp.scale.setScalar(nextScale);
    }

    const targetTint = playable ? BRIGHT_COLOR : DIMMED_COLOR;
    const targetEdgeTint = playable ? EDGE_BRIGHT_COLOR : EDGE_DIMMED_COLOR;

    if (frontMatRef.current) {
      frontMatRef.current.color.lerp(targetTint, lerpFactor);
    }
    if (backMatRef.current) {
      backMatRef.current.color.lerp(targetTint, lerpFactor);
    }
    for (const edgeMat of edgeMatRefs.current) {
      if (edgeMat) {
        edgeMat.color.lerp(targetEdgeTint, lerpFactor);
      }
    }
  });

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (hoverLift || isInteractive) {
      setHovered(true);
    }
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (playable && onClick) {
      onClick();
    }
  };

  const glowColor = selected
    ? '#FCD34D'
    : activeWildTheme
      ? activeWildTheme.primary
      : null;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group ref={innerGroupRef}>
        {/* Main 3D laminated card mesh (6 opaque materials for Early-Z rejection) */}
        <mesh
          geometry={SHARED_CARD_BOX_GEO}
          castShadow
          receiveShadow
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          {[0, 1, 2, 3].map((idx) => (
            <meshStandardMaterial
              key={idx}
              ref={(el) => {
                edgeMatRefs.current[idx] = el;
              }}
              attach={`material-${idx}`}
              color={playable ? '#f8fafc' : '#64697A'}
              roughness={0.35}
              metalness={0.05}
              transparent={false}
              depthWrite
            />
          ))}
          <meshStandardMaterial
            ref={frontMatRef}
            attach="material-4"
            map={frontTexture}
            color={playable ? '#ffffff' : '#686D7E'}
            roughness={0.32}
            metalness={0.06}
            transparent={false}
            depthWrite
          />
          <meshStandardMaterial
            ref={backMatRef}
            attach="material-5"
            map={backTexture}
            color={playable ? '#ffffff' : '#686D7E'}
            roughness={0.38}
            metalness={0.08}
            transparent={false}
            depthWrite
          />
        </mesh>

        {/* Subtle glowing halo border when selected or when wild color is active */}
        {glowColor && (
          <mesh position={[0, 0, 0]} geometry={SHARED_HALO_BOX_GEO}>
            <meshStandardMaterial
              color={glowColor}
              emissive={glowColor}
              emissiveIntensity={selected ? 0.85 : 0.65}
              transparent
              opacity={0.45}
              roughness={0.3}
            />
          </mesh>
        )}

        {/* World-tracked top-right corner anchor so 2D "!" info badges follow card lift & scale */}
        {onInfoAnchorRef && (
          <object3D ref={onInfoAnchorRef} position={[0.35, 0.6, 0.03]} />
        )}
      </group>
    </group>
  );
}
