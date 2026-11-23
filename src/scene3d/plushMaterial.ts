import { createElement } from 'react';
import * as THREE from 'three';

let cachedPlushBump: THREE.CanvasTexture | null = null;

/**
 * Cached 256×256 seamless felt/plush micro-grain bump texture.
 * Uses deterministic noise + short wrapped felt fibers so seams never show.
 */
export function getPlushBumpTexture(): THREE.CanvasTexture {
  if (cachedPlushBump) return cachedPlushBump;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;

    // Deterministic LCG PRNG for consistent soft grain
    let seed = 133742;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    // Base soft felt grain (higher contrast so plush fuzz reads clearly at camera distance)
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.floor(88 + rand() * 88);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    // Higher-contrast wrapped micro-fibers for velvety plush fuzz
    ctx.lineCap = 'round';
    for (let i = 0; i < 1200; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const angle = rand() * Math.PI * 2;
      const len = 3.0 + rand() * 5.0;
      const dx = Math.cos(angle) * len;
      const dy = Math.sin(angle) * len;
      const lum = rand() > 0.5 ? 240 : 35;

      ctx.strokeStyle = `rgba(${lum}, ${lum}, ${lum}, 0.38)`;
      ctx.lineWidth = 1.0 + rand() * 1.0;

      // Draw wrapped across tile boundaries for seamless tiling
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          if (
            x + ox < -10 ||
            x + ox > size + 10 ||
            y + oy < -10 ||
            y + oy > size + 10
          ) {
            continue;
          }
          ctx.beginPath();
          ctx.moveTo(x + ox, y + oy);
          ctx.lineTo(x + ox + dx, y + oy + dy);
          ctx.stroke();
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.needsUpdate = true;

  cachedPlushBump = texture;
  return texture;
}

function computeLighterSheenColor(hex: string): string {
  const c = new THREE.Color(hex);
  const warmWhite = new THREE.Color('#FFF8F0');
  c.lerp(warmWhite, 0.45);
  return `#${c.getHexString()}`;
}

export interface PlushMaterialProps {
  color: string;
  sheenColor?: string;
  bumpScale?: number;
  roughness?: number;
}

const plushMaterialCache = new Map<string, THREE.MeshPhysicalMaterial>();

export function getSharedPlushMaterial({
  color,
  sheenColor,
  bumpScale = 0.035,
  roughness = 0.92,
}: PlushMaterialProps): THREE.MeshPhysicalMaterial {
  const resolvedSheen = sheenColor ?? computeLighterSheenColor(color);
  const key = `${color}|${resolvedSheen}|${bumpScale.toFixed(4)}|${roughness.toFixed(3)}`;
  const cached = plushMaterialCache.get(key);
  if (cached) return cached;

  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    sheen: 1.0,
    sheenRoughness: 0.52,
    sheenColor: new THREE.Color(resolvedSheen),
    bumpMap: getPlushBumpTexture(),
    bumpScale,
  });

  plushMaterialCache.set(key, mat);
  return mat;
}

export function PlushMaterial({
  color,
  sheenColor,
  bumpScale = 0.035,
  roughness = 0.92,
}: PlushMaterialProps) {
  return createElement('primitive', {
    object: getSharedPlushMaterial({ color, sheenColor, bumpScale, roughness }),
    attach: 'material',
    dispose: null,
  });
}

const pearGeometryCache = new Map<string, THREE.LatheGeometry>();

/**
 * Cached smooth 32-segment LatheGeometry producing an organic chubby pear/bean
 * plush silhouette with a flat stable bottom and seamless continuous curve.
 */
export function getPearBodyGeometry(
  width = 0.56,
  height = 1.12,
): THREE.LatheGeometry {
  const key = `${width.toFixed(3)}x${height.toFixed(3)}`;
  const cached = pearGeometryCache.get(key);
  if (cached) return cached;

  // Smooth monotonic-tangent control points (radiusRatio, heightRatio) — zero neck crease
  const controlPts: Array<[number, number]> = [
    [0.0, 0.0],
    [0.48, 0.0],
    [0.78, 0.06],
    [0.96, 0.18],
    [1.0, 0.34],
    [0.95, 0.52],
    [0.85, 0.68],
    [0.72, 0.82],
    [0.5, 0.93],
    [0.24, 0.985],
    [0.0, 1.0],
  ];

  const spline = new THREE.SplineCurve(
    controlPts.map(([r, h]) => new THREE.Vector2(r * width, h * height)),
  );
  const sampled = spline.getPoints(32);
  // Ensure exact closed poles at y=0 and y=height
  sampled[0].set(0, 0);
  sampled[sampled.length - 1].set(0, height);

  const geometry = new THREE.LatheGeometry(sampled, 32);
  geometry.computeVertexNormals();

  pearGeometryCache.set(key, geometry);
  return geometry;
}

const armGeometryCache = new Map<string, THREE.LatheGeometry>();

/**
 * Cached smooth teardrop plush limb geometry with its shoulder pivot at local y = 0.
 * Rounded shoulder cap around y = 0 tapers smoothly wider down to a plump rounded
 * paw/wing/flipper tip at y = -length so embedded shoulders melt cleanly out of the torso.
 */
export function getPlushArmGeometry(
  length = 0.42,
  topRadius = 0.11,
  bottomRadius = 0.15,
): THREE.LatheGeometry {
  const key = `${length.toFixed(3)}x${topRadius.toFixed(3)}x${bottomRadius.toFixed(3)}`;
  const cached = armGeometryCache.get(key);
  if (cached) return cached;

  const midLowR = bottomRadius * 0.95 + topRadius * 0.05;
  const midHighR = bottomRadius * 0.55 + topRadius * 0.45;
  const bottomBulgeY = -length + Math.min(bottomRadius * 0.82, length * 0.36);

  const controlPts: Array<[number, number]> = [
    [0, -length],
    [bottomRadius * 0.55, -length + bottomRadius * 0.08],
    [bottomRadius * 0.94, -length + bottomRadius * 0.35],
    [bottomRadius, bottomBulgeY],
    [midLowR, -length * 0.52],
    [midHighR, -length * 0.24],
    [topRadius, 0],
    [topRadius * 0.72, topRadius * 0.45],
    [0, topRadius * 0.68],
  ];

  const spline = new THREE.SplineCurve(
    controlPts.map(([r, y]) => new THREE.Vector2(r, y)),
  );
  const sampled = spline.getPoints(28);
  sampled[0].set(0, -length);
  sampled[sampled.length - 1].set(0, topRadius * 0.68);

  const geometry = new THREE.LatheGeometry(sampled, 28);
  geometry.computeVertexNormals();

  armGeometryCache.set(key, geometry);
  return geometry;
}
