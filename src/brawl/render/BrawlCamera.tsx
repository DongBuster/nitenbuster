import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { BrawlWorldRuntime } from './worldRuntime';

export function BrawlCamera({ runtime }: { runtime: BrawlWorldRuntime }) {
  const { camera } = useThree();
  const targetLook = useRef(new THREE.Vector3(0, 0, 0));
  const desiredCamPos = useRef(new THREE.Vector3(0, 14, 16));

  useFrame((_, dt) => {
    let sumX = 0;
    let sumZ = 0;
    let count = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const f of runtime.fighters.values()) {
      if (!f.status.alive) continue;
      // Ignore fallen outliers near death boundary
      if (f.pos.y < -1.5) continue;
      sumX += f.pos.x;
      sumZ += f.pos.z;
      count += 1;
      if (f.pos.x < minX) minX = f.pos.x;
      if (f.pos.x > maxX) maxX = f.pos.x;
      if (f.pos.z < minZ) minZ = f.pos.z;
      if (f.pos.z > maxZ) maxZ = f.pos.z;
    }

    const cx = count > 0 ? THREE.MathUtils.clamp(sumX / count, -5.5, 5.5) : 0;
    const cz = count > 0 ? THREE.MathUtils.clamp(sumZ / count, -5.5, 5.5) : 0;
    const span = count > 1 ? Math.max(maxX - minX, maxZ - minZ) : 6;
    const zoom = THREE.MathUtils.clamp(11.8 + span * 0.65, 13.0, 22.5);

    const smooth = Math.min(1, dt * 4.5);
    targetLook.current.lerp(new THREE.Vector3(cx, 0.3, cz), smooth);
    desiredCamPos.current.lerp(
      new THREE.Vector3(cx, zoom * 0.82, cz + zoom * 0.92),
      smooth,
    );

    const shake = runtime.shakeIntensity;
    const sx = shake > 0.01 ? (Math.random() - 0.5) * shake * 0.9 : 0;
    const sy = shake > 0.01 ? (Math.random() - 0.5) * shake * 0.7 : 0;

    camera.position.set(
      desiredCamPos.current.x + sx,
      desiredCamPos.current.y + sy,
      desiredCamPos.current.z,
    );
    camera.lookAt(targetLook.current);
  });

  return null;
}
