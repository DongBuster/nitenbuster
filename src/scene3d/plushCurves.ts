import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Emotion } from '../engine/types.ts';

const BLINK_PERIOD_SEC = 4.2;
const BLINK_DURATION_SEC = 0.16;

/**
 * Pure periodic blink Y-scale solver driven inside `useFrame` (0 React re-renders).
 * Returns `1` when fully open and dips smoothly to `0.10` during brief natural blinks
 * in `idle` and `sad` states.
 */
export function computeBlinkScaleY(
  elapsedSec: number,
  phaseOffset: number,
  emotion: Emotion,
): number {
  if (emotion !== 'idle' && emotion !== 'sad') {
    return 1;
  }
  const safeTime = Number.isFinite(elapsedSec) ? elapsedSec : 0;
  const safePhase = Number.isFinite(phaseOffset) ? phaseOffset : 0;
  const shifted = safeTime + safePhase * 0.7;
  const cycle =
    ((shifted % BLINK_PERIOD_SEC) + BLINK_PERIOD_SEC) % BLINK_PERIOD_SEC;
  const blinkStart = BLINK_PERIOD_SEC - BLINK_DURATION_SEC;

  if (cycle < blinkStart) {
    return 1;
  }
  const t = (cycle - blinkStart) / BLINK_DURATION_SEC;
  return Math.max(0.1, 1 - 0.9 * Math.sin(t * Math.PI));
}

function mergeNormalizedParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized = parts.map((raw) => {
    const geo = raw.index ? raw.toNonIndexed() : raw.clone();
    if (!geo.getAttribute('normal')) {
      geo.computeVertexNormals();
    }
    if (!geo.getAttribute('uv')) {
      const count = geo.getAttribute('position').count;
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    raw.dispose();
    return geo;
  });

  const merged = mergeGeometries(normalized, false);
  for (const g of normalized) {
    g.dispose();
  }
  if (!merged) {
    throw new Error('Failed to merge normalized plush detail geometries');
  }
  merged.computeVertexNormals();
  return merged;
}

const cache = new Map<string, THREE.BufferGeometry>();

function cached(
  key: string,
  factory: () => THREE.BufferGeometry,
): THREE.BufferGeometry {
  const hit = cache.get(key);
  if (hit) return hit;
  const created = factory();
  cache.set(key, created);
  return created;
}

/** Shared beveled 5-point star eye geometry for `win` emotion across all 8 animals. */
export function getSharedStarEyeGeometry(): THREE.BufferGeometry {
  return cached('starEye', () => {
    const shape = new THREE.Shape();
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points + Math.PI / 2;
      const r = i % 2 === 0 ? 0.072 : 0.033;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.004,
      bevelSegments: 2,
      curveSegments: 10,
    });
    geo.center();
    geo.computeVertexNormals();
    return geo;
  });
}

/** Module-cached smooth shark plush hood + torso silhouette. */
export function getSharkHoodGeometry(): THREE.BufferGeometry {
  return cached('sharkHood', () => {
    const points: THREE.Vector2[] = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.36, 0.02),
      new THREE.Vector2(0.49, 0.14),
      new THREE.Vector2(0.52, 0.36),
      new THREE.Vector2(0.5, 0.62),
      new THREE.Vector2(0.45, 0.88),
      new THREE.Vector2(0.38, 1.12),
      new THREE.Vector2(0.27, 1.33),
      new THREE.Vector2(0.14, 1.48),
      new THREE.Vector2(0.04, 1.56),
      new THREE.Vector2(0.0, 1.58),
    ];
    const geo = new THREE.LatheGeometry(points, 32);
    geo.computeVertexNormals();
    return geo;
  });
}

/** Sculpted swept-back beveled dorsal fin aligned in YZ plane. */
export function getSharkDorsalFinGeometry(): THREE.BufferGeometry {
  return cached('sharkDorsalFin', () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.16);
    shape.quadraticCurveTo(0.04, 0.08, -0.14, 0.28);
    shape.quadraticCurveTo(-0.22, 0.34, -0.25, 0.27);
    shape.quadraticCurveTo(-0.24, 0.04, -0.15, -0.16);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.028,
      bevelSize: 0.02,
      bevelSegments: 4,
      curveSegments: 16,
    });
    geo.translate(0, 0, -0.0225);
    // Rotate from XY plane into YZ plane so curve sweeps along -Z
    geo.rotateY(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

/** Sculpted crescent plush shark caudal tail fin aligned in YZ plane. */
export function getSharkTailFinGeometry(): THREE.BufferGeometry {
  return cached('sharkTailFin', () => {
    const shape = new THREE.Shape();
    shape.moveTo(0.06, 0.05);
    shape.quadraticCurveTo(-0.08, 0.24, -0.26, 0.32);
    shape.quadraticCurveTo(-0.31, 0.33, -0.28, 0.25);
    shape.quadraticCurveTo(-0.18, 0.09, -0.14, 0.0);
    shape.quadraticCurveTo(-0.17, -0.08, -0.23, -0.18);
    shape.quadraticCurveTo(-0.25, -0.24, -0.19, -0.23);
    shape.quadraticCurveTo(-0.05, -0.16, 0.06, -0.06);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.036,
      bevelEnabled: true,
      bevelThickness: 0.024,
      bevelSize: 0.016,
      bevelSegments: 4,
      curveSegments: 16,
    });
    geo.translate(0, 0, -0.018);
    geo.rotateY(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

/** Single draw-call merged geometry for the shark's arched row of 6 white plush teeth. */
export function getSharkTeethGeometry(): THREE.BufferGeometry {
  return cached('sharkTeeth', () => {
    const xs = [-0.17, -0.102, -0.034, 0.034, 0.102, 0.17];
    const parts: THREE.BufferGeometry[] = [];
    for (const tx of xs) {
      const tooth = new THREE.ConeGeometry(0.033, 0.072, 10);
      tooth.scale(0.95, 1.04, 0.68);
      tooth.rotateX(Math.PI + 0.14);
      tooth.rotateZ(-tx * 1.35);
      const archY = 0.066 - Math.abs(tx) * 0.33;
      const archZ = 0.082 - Math.abs(tx) * 0.23;
      tooth.translate(tx, archY, archZ);
      parts.push(tooth);
    }
    return mergeNormalizedParts(parts);
  });
}

/** Single draw-call merged geometry for 3 subtle gill slits on both flanks of the shark. */
export function getSharkGillsGeometry(): THREE.BufferGeometry {
  return cached('sharkGills', () => {
    const parts: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const slit = new THREE.CapsuleGeometry(0.009, 0.078 - i * 0.008, 4, 8);
        slit.rotateX(0.16);
        slit.rotateZ(side * 0.12);
        slit.translate(
          side * (0.435 - i * 0.006),
          0.77 - i * 0.015,
          0.19 - i * 0.055,
        );
        parts.push(slit);
      }
    }
    return mergeNormalizedParts(parts);
  });
}

/** Module-cached smooth avocado-green dino pear body. */
export function getDinoBodyGeometry(): THREE.BufferGeometry {
  return cached('dinoBody', () => {
    const points: THREE.Vector2[] = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.35, 0.02),
      new THREE.Vector2(0.48, 0.16),
      new THREE.Vector2(0.51, 0.38),
      new THREE.Vector2(0.45, 0.64),
      new THREE.Vector2(0.36, 0.86),
      new THREE.Vector2(0.28, 1.0),
      new THREE.Vector2(0.0, 1.04),
    ];
    const geo = new THREE.LatheGeometry(points, 32);
    geo.computeVertexNormals();
    return geo;
  });
}

/** Beveled soft-triangular plush dinosaur plate aligned in YZ plane. */
export function getDinoPlateGeometry(): THREE.BufferGeometry {
  return cached('dinoPlate', () => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.075, -0.03);
    shape.quadraticCurveTo(-0.068, 0.075, -0.018, 0.135);
    shape.quadraticCurveTo(0, 0.155, 0.018, 0.135);
    shape.quadraticCurveTo(0.068, 0.075, 0.075, -0.03);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.034,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.014,
      bevelSegments: 3,
      curveSegments: 14,
    });
    geo.translate(0, 0, -0.017);
    geo.rotateY(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

/** Single draw-call merged geometry for 3 cute rounded cream toe claws on a dino foot. */
export function getDinoClawsGeometry(): THREE.BufferGeometry {
  return cached('dinoClaws', () => {
    const parts: THREE.BufferGeometry[] = [];
    const offsets: Array<[number, number, number]> = [
      [-0.075, -0.022, 0.155],
      [0, -0.024, 0.172],
      [0.075, -0.022, 0.155],
    ];
    for (const [x, y, z] of offsets) {
      const claw = new THREE.SphereGeometry(0.032, 10, 8);
      claw.scale(0.82, 0.72, 1.25);
      claw.translate(x, y, z);
      parts.push(claw);
    }
    return mergeNormalizedParts(parts);
  });
}

/** Module-cached squat chubby pear hen body. */
export function getChickenPearGeometry(): THREE.BufferGeometry {
  return cached('chickenPear', () => {
    const points: THREE.Vector2[] = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.38, 0.02),
      new THREE.Vector2(0.55, 0.16),
      new THREE.Vector2(0.59, 0.36),
      new THREE.Vector2(0.54, 0.58),
      new THREE.Vector2(0.45, 0.78),
      new THREE.Vector2(0.38, 0.96),
      new THREE.Vector2(0.34, 1.12),
      new THREE.Vector2(0.25, 1.25),
      new THREE.Vector2(0.11, 1.33),
      new THREE.Vector2(0.0, 1.35),
    ];
    const geo = new THREE.LatheGeometry(points, 32);
    geo.computeVertexNormals();
    return geo;
  });
}

/** Smooth S-curved plush cat tail built with TubeGeometry + rounded end cap. */
export function getCatTailGeometry(): THREE.BufferGeometry {
  return cached('catTail', () => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0.02),
      new THREE.Vector3(0, 0.06, -0.14),
      new THREE.Vector3(0.03, 0.21, -0.24),
      new THREE.Vector3(0.06, 0.36, -0.2),
      new THREE.Vector3(0.04, 0.44, -0.14),
    ]);
    const tube = new THREE.TubeGeometry(curve, 22, 0.072, 12, false);
    const baseCap = new THREE.SphereGeometry(0.072, 12, 10);
    baseCap.translate(0, 0, 0.02);
    const tipCap = new THREE.SphereGeometry(0.072, 12, 10);
    tipCap.translate(0.04, 0.44, -0.14);
    return mergeNormalizedParts([tube, baseCap, tipCap]);
  });
}

/** Single draw-call merged geometry for 6 gently arched cat whiskers (3 per cheek). */
export function getCatWhiskersGeometry(): THREE.BufferGeometry {
  return cached('catWhiskers', () => {
    const parts: THREE.BufferGeometry[] = [];
    const rows: Array<{ y0: number; y1: number; z1: number; len: number }> = [
      { y0: -0.04, y1: -0.01, z1: 0.24, len: 0.56 },
      { y0: -0.075, y1: -0.08, z1: 0.25, len: 0.59 },
      { y0: -0.11, y1: -0.145, z1: 0.23, len: 0.54 },
    ];
    for (const side of [-1, 1]) {
      for (const row of rows) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.22, row.y0, 0.39),
          new THREE.Vector3(side * (row.len * 0.68), (row.y0 + row.y1) * 0.5 + 0.008, 0.34),
          new THREE.Vector3(side * row.len, row.y1, row.z1),
        ]);
        parts.push(new THREE.TubeGeometry(curve, 8, 0.0045, 6, false));
      }
    }
    return mergeNormalizedParts(parts);
  });
}

/** Single draw-call merged geometry for 3 soft British Shorthair tabby forehead stripes. */
export function getCatForeheadStripesGeometry(): THREE.BufferGeometry {
  return cached('catForeheadStripes', () => {
    const parts: THREE.BufferGeometry[] = [];
    const configs: Array<{ x: number; y: number; z: number; rotZ: number; len: number }> = [
      { x: -0.115, y: 0.31, z: 0.27, rotZ: 0.18, len: 0.12 },
      { x: 0, y: 0.33, z: 0.285, rotZ: 0, len: 0.14 },
      { x: 0.115, y: 0.31, z: 0.27, rotZ: -0.18, len: 0.12 },
    ];
    for (const cfg of configs) {
      const stripe = new THREE.CapsuleGeometry(0.016, cfg.len, 4, 8);
      stripe.scale(1, 1, 0.45);
      stripe.rotateX(-0.56);
      stripe.rotateZ(cfg.rotZ);
      stripe.translate(cfg.x, cfg.y, cfg.z);
      parts.push(stripe);
    }
    return mergeNormalizedParts(parts);
  });
}

/** Single draw-call merged paw pad (1 center cushion + 3 tiny toe beans). */
export function getPawPadGeometry(): THREE.BufferGeometry {
  return cached('pawPad', () => {
    const parts: THREE.BufferGeometry[] = [];
    const main = new THREE.SphereGeometry(0.052, 12, 10);
    main.scale(1.15, 0.85, 0.45);
    main.translate(0, -0.012, 0);
    parts.push(main);

    const beans: Array<[number, number]> = [
      [-0.048, 0.042],
      [0, 0.056],
      [0.048, 0.042],
    ];
    for (const [bx, by] of beans) {
      const bean = new THREE.SphereGeometry(0.022, 10, 8);
      bean.scale(0.95, 1.05, 0.5);
      bean.translate(bx, by, 0.004);
      parts.push(bean);
    }
    return mergeNormalizedParts(parts);
  });
}

/** Sculpted smooth wide duck upper bill with gentle rounded spatula curve. */
export function getDuckBillGeometry(): THREE.BufferGeometry {
  return cached('duckBill', () => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.22, -0.04);
    shape.quadraticCurveTo(-0.29, 0.12, -0.18, 0.25);
    shape.quadraticCurveTo(0, 0.34, 0.18, 0.25);
    shape.quadraticCurveTo(0.29, 0.12, 0.22, -0.04);
    shape.quadraticCurveTo(0, -0.11, -0.22, -0.04);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.036,
      bevelEnabled: true,
      bevelThickness: 0.042,
      bevelSize: 0.032,
      bevelSegments: 5,
      curveSegments: 20,
    });
    geo.translate(0, -0.05, -0.018);
    // Lay flat forward in +Z with slight upward lip
    geo.rotateX(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

/** Tapered organic upright bunny ear (narrow base -> plump middle -> soft rounded tip). */
export function getUprightBunnyEarGeometry(): THREE.BufferGeometry {
  return cached('uprightBunnyEar', () => {
    const profile: Array<[number, number]> = [
      [0.0, 0.0],
      [0.068, 0.02],
      [0.095, 0.12],
      [0.116, 0.28],
      [0.112, 0.44],
      [0.088, 0.55],
      [0.046, 0.61],
      [0.0, 0.63],
    ];
    const spline = new THREE.SplineCurve(
      profile.map(([r, y]) => new THREE.Vector2(r, y)),
    );
    const sampled = spline.getPoints(22);
    sampled[0].set(0, 0);
    sampled[sampled.length - 1].set(0, 0.63);
    const geo = new THREE.LatheGeometry(sampled, 20);
    geo.scale(0.88, 1.0, 0.48);
    geo.computeVertexNormals();
    return geo;
  });
}

/** Tapered bunny ear whose upper third gently flops forward-outward for lively charm. */
export function getFloppyBunnyEarGeometry(): THREE.BufferGeometry {
  return cached('floppyBunnyEar', () => {
    const geo = getUprightBunnyEarGeometry().clone();
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // Smooth progressive bend starting around y = 0.24
      if (y > 0.24) {
        const t = (y - 0.24) / 0.39;
        const bend = t * t;
        const nextY = 0.24 + (y - 0.24) * (1 - 0.32 * bend);
        const nextZ = z + 0.22 * bend;
        const nextX = x + 0.085 * bend;
        pos.setXYZ(i, nextX, nextY, nextZ);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  });
}
