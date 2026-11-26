import * as THREE from 'three';
import type { OutfitAnchor } from '../accessoryAnchors.ts';

/**
 * Outer torso profile of `getShirtShellGeometry()` in `OutfitAccessories.tsx`.
 * Pairs of `[radius, yNorm]` ordered bottom-to-top.
 */
const SHIRT_SHELL_OUTER_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.98, -0.44],
  [1.05, -0.26],
  [1.06, -0.05],
  [1.02, 0.14],
  [0.94, 0.3],
  [0.84, 0.41],
  [0.74, 0.46],
];

const curvedBadgeCache = new Map<string, THREE.BufferGeometry>();
let cachedMuCrestTexture: THREE.CanvasTexture | null = null;
let cachedMuKitMarkTexture: THREE.CanvasTexture | null = null;

function sampleShellProfile(yNorm: number): { radius: number; slope: number } {
  const pts = SHIRT_SHELL_OUTER_PROFILE;
  if (yNorm <= pts[0][1]) {
    const [r0, y0] = pts[0];
    const [r1, y1] = pts[1];
    return { radius: r0, slope: (r1 - r0) / (y1 - y0) };
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [r0, y0] = pts[i];
    const [r1, y1] = pts[i + 1];
    if (yNorm <= y1) {
      const t = (yNorm - y0) / (y1 - y0);
      return {
        radius: r0 + (r1 - r0) * t,
        slope: (r1 - r0) / (y1 - y0),
      };
    }
  }
  const [rPrev, yPrev] = pts[pts.length - 2];
  const [rLast, yLast] = pts[pts.length - 1];
  return { radius: rLast, slope: (rLast - rPrev) / (yLast - yPrev) };
}

/**
 * Creates (and caches) a gently curved badge mesh that wraps smoothly around
 * a round plush jersey torso without corners poking into or floating off the shell.
 */
export function getCurvedBadgeGeometry(
  width: number,
  height: number,
  bendFactor = 0.95,
): THREE.BufferGeometry {
  const key = `${width.toFixed(4)}x${height.toFixed(4)}x${bendFactor.toFixed(3)}`;
  const existing = curvedBadgeCache.get(key);
  if (existing) return existing;

  const geo = new THREE.PlaneGeometry(width, height, 8, 6);
  const pos = geo.getAttribute('position');
  const verticalBend = bendFactor * 0.22;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = -(x * x) * bendFactor - (y * y) * verticalBend;
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  curvedBadgeCache.set(key, geo);
  return geo;
}

export interface ChestMountTransform {
  position: [number, number, number];
  rotation: [number, number, number];
}

/**
 * Computes exact surface mount transform on the front-left (`side = 1`) or
 * front-right (`side = -1`) chest of `getShirtShellGeometry()`, offset outward
 * along the true scaled ellipsoid normal so the crest never clips into the jersey.
 */
export function computeJerseyChestMount(
  anchor: OutfitAnchor,
  side: -1 | 1,
  yNorm = 0.16,
  lift = 0.018,
): ChestMountTransform {
  const [sx, sy, sz] = anchor.scale;
  const theta = side * 0.29;
  const { radius, slope } = sampleShellProfile(yNorm);

  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);

  // Exact point on the scaled outer jersey shell
  const surfX = sx * radius * sinT;
  const surfY = anchor.y + sy * yNorm;
  const surfZ = anchor.z + sz * radius * cosT;

  // Outward unit normal of S(y, theta) = (sx*r*sinT, y0 + sy*y, z0 + sz*r*cosT)
  const rawNx = sinT / sx;
  const rawNy = -slope / sy;
  const rawNz = cosT / sz;
  const len = Math.hypot(rawNx, rawNy, rawNz) || 1;
  const nx = rawNx / len;
  const ny = rawNy / len;
  const nz = rawNz / len;

  // Intrinsic XYZ Euler aligning local +Z with (nx, ny, nz) while keeping +Y upright
  const rotY = Math.asin(Math.max(-1, Math.min(1, nx)));
  const rotX = -Math.atan2(ny, nz);

  return {
    position: [surfX + nx * lift, surfY + ny * lift, surfZ + nz * lift],
    rotation: [rotX, rotY, 0],
  };
}

function drawArchedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  flippedBottom = false,
): void {
  const chars = [...text];
  if (chars.length === 0) return;
  const step = chars.length > 1 ? (endAngle - startAngle) / (chars.length - 1) : 0;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < chars.length; i++) {
    const angle = startAngle + step * i;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(flippedBottom ? angle - Math.PI / 2 : angle + Math.PI / 2);
    ctx.strokeText(chars[i], 0, 0);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function drawSideFootball(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.save();
  // Base white ball with dark rim
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#3B080E';
  ctx.stroke();

  // Clip interior panel pattern
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  ctx.clip();

  // Center pentagon
  ctx.beginPath();
  const pr = r * 0.42;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const px = cx + Math.cos(a) * pr;
    const py = cy + Math.sin(a) * pr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#1E293B';
  ctx.fill();

  // Radiating seams + outer edge patches
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const sx = cx + Math.cos(a) * pr;
    const sy = cy + Math.sin(a) * pr;
    const ex = cx + Math.cos(a) * (r * 0.96);
    const ey = cy + Math.sin(a) * (r * 0.96);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(a) * (r * 1.08),
      cy + Math.sin(a) * (r * 1.08),
      r * 0.3,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = '#1E293B';
    ctx.fill();
  }
  ctx.restore();
}

function drawCrestShip(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // Stylized crimson waves along bottom of ship compartment
  ctx.fillStyle = '#B91C1C';
  for (let w = 0; w < 3; w++) {
    const wy = 216 + w * 9;
    ctx.beginPath();
    ctx.moveTo(176, wy);
    ctx.quadraticCurveTo(216, wy - 7, 256, wy);
    ctx.quadraticCurveTo(296, wy + 7, 336, wy);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#B91C1C';
    ctx.stroke();
  }

  // Ship hull
  ctx.beginPath();
  ctx.moveTo(205, 198);
  ctx.lineTo(307, 198);
  ctx.quadraticCurveTo(298, 215, 256, 216);
  ctx.quadraticCurveTo(214, 215, 205, 198);
  ctx.closePath();
  ctx.fillStyle = '#991B1B';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#4A0A10';
  ctx.stroke();

  // Three billowing sails (left, center tall, right)
  const sails: Array<[number, number, number, number]> = [
    [224, 194, 24, 34],
    [256, 194, 30, 44],
    [288, 194, 24, 34],
  ];
  for (const [mx, baseY, halfW, height] of sails) {
    // Mast line
    ctx.beginPath();
    ctx.moveTo(mx, baseY + 2);
    ctx.lineTo(mx, baseY - height - 10);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#4A0A10';
    ctx.stroke();

    // Billowing crimson sail with golden edge
    ctx.beginPath();
    ctx.moveTo(mx - halfW * 0.65, baseY - height);
    ctx.quadraticCurveTo(mx + halfW * 0.15, baseY - height * 0.52, mx - halfW * 0.55, baseY - 6);
    ctx.lineTo(mx + halfW * 0.8, baseY - 6);
    ctx.quadraticCurveTo(mx + halfW * 1.1, baseY - height * 0.52, mx + halfW * 0.65, baseY - height);
    ctx.closePath();
    ctx.fillStyle = '#DC2626';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FCD116';
    ctx.stroke();

    // Tiny top pennant
    ctx.beginPath();
    ctx.moveTo(mx, baseY - height - 10);
    ctx.lineTo(mx + 14, baseY - height - 6);
    ctx.lineTo(mx, baseY - height - 2);
    ctx.closePath();
    ctx.fillStyle = '#B91C1C';
    ctx.fill();
  }
  ctx.restore();
}

function drawRedDevilWithTrident(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  const gold = '#FCD116';
  const devilRed = '#EA1D25';
  const darkKey = '#5C0910';

  // Diagonal trident shaft + 3-pronged fork (drawn boldly in gold-edged crimson)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Outer gold halo for trident
  ctx.strokeStyle = gold;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(205, 362);
  ctx.lineTo(304, 260);
  ctx.stroke();

  // Inner crimson shaft
  ctx.strokeStyle = devilRed;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(205, 362);
  ctx.lineTo(304, 260);
  ctx.stroke();

  // Three trident prongs at upper-right tip (304, 260)
  ctx.save();
  ctx.translate(304, 260);
  ctx.rotate(-Math.PI / 4);
  const drawProngs = (stroke: string, width: number) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    // Center prong
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(28, 0);
    ctx.stroke();
    // Upper barb
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.quadraticCurveTo(6, -15, 22, -14);
    ctx.stroke();
    // Lower barb
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.quadraticCurveTo(6, 15, 22, 14);
    ctx.stroke();
  };
  drawProngs(gold, 9.5);
  drawProngs(devilRed, 4.2);
  ctx.restore();

  // Iconic Red Devil silhouette with bold gold outline for crisp legibility at distance
  const traceDevilBody = () => {
    ctx.beginPath();
    // Head + two curved devil horns
    ctx.moveTo(246, 264);
    ctx.lineTo(239, 248); // left horn tip
    ctx.lineTo(252, 258);
    ctx.lineTo(260, 258);
    ctx.lineTo(271, 247); // right horn tip
    ctx.lineTo(266, 264);
    // Right shoulder + raised arm gripping trident
    ctx.quadraticCurveTo(276, 272, 286, 278);
    ctx.lineTo(282, 290);
    ctx.lineTo(268, 286);
    // Torso right side + lunging right leg
    ctx.quadraticCurveTo(270, 308, 288, 336);
    ctx.lineTo(298, 356);
    ctx.lineTo(283, 361);
    ctx.lineTo(268, 338);
    // Inner leg arch
    ctx.lineTo(256, 326);
    // Left lunging leg
    ctx.lineTo(244, 344);
    ctx.lineTo(234, 364);
    ctx.lineTo(220, 358);
    ctx.lineTo(230, 332);
    ctx.quadraticCurveTo(240, 312, 242, 294);
    // Left arm gripping lower trident
    ctx.lineTo(222, 306);
    ctx.lineTo(217, 294);
    ctx.lineTo(240, 278);
    ctx.closePath();
  };

  // Dark drop outline -> bright gold contour -> vivid crimson fill
  traceDevilBody();
  ctx.lineWidth = 11;
  ctx.strokeStyle = darkKey;
  ctx.stroke();
  ctx.lineWidth = 6.5;
  ctx.strokeStyle = gold;
  ctx.stroke();
  ctx.fillStyle = devilRed;
  ctx.fill();

  // Curled pointed devil tail sweeping to left
  ctx.beginPath();
  ctx.moveTo(238, 322);
  ctx.bezierCurveTo(208, 328, 198, 296, 214, 282);
  ctx.lineWidth = 8;
  ctx.strokeStyle = gold;
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = devilRed;
  ctx.stroke();

  // Tail arrowhead tip
  ctx.beginPath();
  ctx.moveTo(214, 282);
  ctx.lineTo(204, 277);
  ctx.lineTo(212, 271);
  ctx.closePath();
  ctx.fillStyle = gold;
  ctx.fill();

  ctx.restore();
}

/**
 * Generates and caches a crisp 512x512 Manchester United club crest CanvasTexture.
 * Returns `null` in headless Node test environments without `document`.
 */
export function getMuCrestTexture(): THREE.CanvasTexture | null {
  if (cachedMuCrestTexture) return cachedMuCrestTexture;
  if (typeof document === 'undefined') return null;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cx = 256;
  const gold = '#FCD116';
  const goldDeep = '#EAB308';
  const crimson = '#C8102E';
  const darkEdge = '#4E070D';

  ctx.clearRect(0, 0, size, size);

  // 1. Outer golden heraldic backing wing silhouette (connects ribbons, footballs & shield)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, 38);
  ctx.bezierCurveTo(366, 38, 434, 92, 456, 152);
  ctx.bezierCurveTo(436, 206, 438, 290, 444, 344);
  ctx.bezierCurveTo(418, 412, 344, 464, cx, 478);
  ctx.bezierCurveTo(168, 464, 94, 412, 68, 344);
  ctx.bezierCurveTo(74, 290, 76, 206, 56, 152);
  ctx.bezierCurveTo(78, 92, 146, 38, cx, 38);
  ctx.closePath();

  const goldGrad = ctx.createLinearGradient(0, 40, 0, 476);
  goldGrad.addColorStop(0, '#FDE047');
  goldGrad.addColorStop(0.55, gold);
  goldGrad.addColorStop(1, goldDeep);
  ctx.fillStyle = goldGrad;
  ctx.fill();
  ctx.lineWidth = 11;
  ctx.strokeStyle = darkEdge;
  ctx.stroke();
  ctx.restore();

  // 2. Top curved crimson scroll banner ("MANCHESTER")
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, 318, 260, -Math.PI * 0.77, -Math.PI * 0.23, false);
  ctx.arc(cx, 318, 192, -Math.PI * 0.23, -Math.PI * 0.77, true);
  ctx.closePath();
  ctx.fillStyle = crimson;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = gold;
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = darkEdge;
  ctx.stroke();

  ctx.font = '900 33px "Arial Black", "Segoe UI", sans-serif';
  ctx.fillStyle = gold;
  ctx.strokeStyle = darkEdge;
  ctx.lineWidth = 4.5;
  drawArchedText(
    ctx,
    'MANCHESTER',
    cx,
    318,
    225,
    -Math.PI * 0.735,
    -Math.PI * 0.265,
    false,
  );
  ctx.restore();

  // 3. Bottom curved crimson scroll banner ("UNITED")
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, 194, 262, Math.PI * 0.24, Math.PI * 0.76, false);
  ctx.arc(cx, 194, 194, Math.PI * 0.76, Math.PI * 0.24, true);
  ctx.closePath();
  ctx.fillStyle = crimson;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = gold;
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = darkEdge;
  ctx.stroke();

  ctx.font = '900 40px "Arial Black", "Segoe UI", sans-serif';
  ctx.fillStyle = gold;
  ctx.strokeStyle = darkEdge;
  ctx.lineWidth = 4.5;
  drawArchedText(
    ctx,
    'UNITED',
    cx,
    194,
    228,
    Math.PI * 0.655,
    Math.PI * 0.345,
    true,
  );
  ctx.restore();

  // 4. Left & right classic paneled footballs
  drawSideFootball(ctx, 114, 248, 34);
  drawSideFootball(ctx, 398, 248, 34);

  // 5. Central heraldic shield (upper gold ship compartment + lower crimson devil field)
  const traceInnerShield = () => {
    ctx.beginPath();
    ctx.moveTo(166, 146);
    ctx.quadraticCurveTo(cx, 134, 346, 146);
    ctx.lineTo(346, 276);
    ctx.bezierCurveTo(346, 336, 306, 372, cx, 392);
    ctx.bezierCurveTo(206, 372, 166, 336, 166, 276);
    ctx.closePath();
  };

  ctx.save();
  traceInnerShield();
  ctx.clip();

  // Upper gold background for sailing ship
  ctx.fillStyle = gold;
  ctx.fillRect(160, 130, 192, 116);

  // Lower crimson background for Red Devil
  ctx.fillStyle = crimson;
  ctx.fillRect(160, 242, 192, 160);

  // Gold dividing bar between ship and devil
  ctx.fillStyle = gold;
  ctx.fillRect(160, 238, 192, 10);
  ctx.strokeStyle = darkEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(160, 238);
  ctx.lineTo(352, 238);
  ctx.moveTo(160, 248);
  ctx.lineTo(352, 248);
  ctx.stroke();

  // Sailing ship + waves (upper)
  drawCrestShip(ctx);

  // Red Devil + Trident (lower)
  drawRedDevilWithTrident(ctx);

  // Subtle woven embroidery highlight sheen
  const sheen = ctx.createRadialGradient(225, 190, 20, cx, 260, 180);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0.08)');
  ctx.fillStyle = sheen;
  ctx.fillRect(156, 130, 200, 272);
  ctx.restore();

  // Crisp gold + dark border around central shield
  ctx.save();
  traceInnerShield();
  ctx.lineWidth = 12;
  ctx.strokeStyle = gold;
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = darkEdge;
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cachedMuCrestTexture = tex;
  return tex;
}

/**
 * Generates and caches a crisp 256x256 white 3-bar athletic kit mark for the right chest.
 */
export function getMuKitMarkTexture(): THREE.CanvasTexture | null {
  if (cachedMuKitMarkTexture) return cachedMuKitMarkTexture;
  if (typeof document === 'undefined') return null;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);

  // Classic 3 ascending slanted white athletic bars
  const bars: Array<{ x: number; height: number }> = [
    { x: 54, height: 66 },
    { x: 108, height: 112 },
    { x: 162, height: 158 },
  ];

  ctx.save();
  const baseY = 204;
  const barW = 34;
  const slant = 28;

  for (const bar of bars) {
    ctx.beginPath();
    ctx.moveTo(bar.x, baseY);
    ctx.lineTo(bar.x + barW, baseY);
    ctx.lineTo(bar.x + barW - slant * (bar.height / 158), baseY - bar.height);
    ctx.lineTo(bar.x - slant * (bar.height / 158), baseY - bar.height);
    ctx.closePath();

    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(80, 10, 16, 0.45)';
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cachedMuKitMarkTexture = tex;
  return tex;
}
