import { useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GlassRenderState } from './renderTypes';

export interface GlassCameraProps {
  renderRef: RefObject<GlassRenderState>;
}

export function GlassCamera({ renderRef }: GlassCameraProps) {
  const { camera } = useThree();
  const currentPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 9.2, -10.0));
  const currentLookRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.8, 4.7));
  const desiredPosScratchRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const desiredLookScratchRef = useRef<THREE.Vector3>(new THREE.Vector3());

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const state = renderRef.current;
    const { p1, p2 } = state;

    const midX = (p1.x + p2.x) * 0.5;
    const midY = Math.max(-1.5, (p1.y + p2.y) * 0.5);
    const midZ = (p1.z + p2.z) * 0.5;
    const span = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    const spanZoom = THREE.MathUtils.clamp((span - 3.2) * 0.9, 0, 4.5);

    const desiredPos = desiredPosScratchRef.current;
    const desiredLook = desiredLookScratchRef.current;

    desiredPos.set(
      midX * 0.55,
      midY + 9.2 + spanZoom,
      midZ - 11.5 - spanZoom * 0.65,
    );
    desiredLook.set(midX * 0.65, midY + 0.8, midZ + 3.2);

    const alpha = 1 - Math.exp(-6 * dt);
    currentPosRef.current.lerp(desiredPos, alpha);
    currentLookRef.current.lerp(desiredLook, alpha);

    const shake = state.cameraShake;
    let shakeX = 0;
    let shakeY = 0;
    if (shake > 0.005) {
      shakeX = (Math.random() - 0.5) * shake * 0.75;
      shakeY = (Math.random() - 0.5) * shake * 0.55;
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
