import * as THREE from 'three';
import type { CardType, Color } from '../engine/types';
import { CARD_META, COLOR_THEME, WILD_THEME } from '../components/Card/cardMeta';

export interface CardFrontTextureOptions {
  type?: CardType;
  color?: Color;
  value?: number;
  activeWildColor?: Color;
}

const CANVAS_W = 512;
const CANVAS_H = 720;
const FONT_FAMILY = 'Fredoka, Nunito, ui-rounded, system-ui, sans-serif';

const frontTextureCache = new Map<string, THREE.CanvasTexture>();
let cachedBackTexture: THREE.CanvasTexture | null = null;

function createCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context for card texture');
  }
  return [canvas, ctx];
}

function finalizeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawPaw(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  rotationRad: number,
  fillStyle: string,
  alpha = 1,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotationRad);
  const s = size / 120;
  ctx.scale(s, s);
  ctx.translate(-60, -60);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fillStyle;

  // Main paw pad
  ctx.beginPath();
  ctx.moveTo(60, 56);
  ctx.bezierCurveTo(43, 56, 31, 69, 31, 83);
  ctx.bezierCurveTo(31, 94, 39, 100, 49, 99);
  ctx.bezierCurveTo(54, 98.5, 57, 96, 60, 96);
  ctx.bezierCurveTo(63, 96, 66, 98.5, 71, 99);
  ctx.bezierCurveTo(81, 100, 89, 94, 89, 83);
  ctx.bezierCurveTo(89, 69, 77, 56, 60, 56);
  ctx.closePath();
  ctx.fill();

  // Four toe beans
  const toes: Array<[number, number, number, number, number]> = [
    [28, 52, 10.5, 13.5, (-22 * Math.PI) / 180],
    [48, 35, 10.5, 14, (-8 * Math.PI) / 180],
    [72, 35, 10.5, 14, (8 * Math.PI) / 180],
    [92, 52, 10.5, 13.5, (22 * Math.PI) / 180],
  ];
  for (const [tx, ty, rx, ry, rot] of toes) {
    ctx.beginPath();
    ctx.ellipse(tx, ty, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawColorShape(
  ctx: CanvasRenderingContext2D,
  color: Color,
  cx: number,
  cy: number,
  size: number,
  fill: string,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = fill;
  const r = size / 2;

  switch (color) {
    case 'pink': {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'blue': {
      const side = size * 0.82;
      roundedRectPath(ctx, -side / 2, -side / 2, side, side, size * 0.16);
      ctx.fill();
      break;
    }
    case 'green': {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.92);
      ctx.lineTo(r * 0.96, r * 0.8);
      ctx.lineTo(-r * 0.96, r * 0.8);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'yellow': {
      ctx.beginPath();
      const spikes = 5;
      const outerR = r * 0.96;
      const innerR = r * 0.44;
      for (let i = 0; i < spikes * 2; i++) {
        const rad = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const x = Math.cos(angle) * rad;
        const y = Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

function drawWildQuadBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  const r = size / 2;
  const slices: Array<[string, number, number]> = [
    ['#EC4899', -Math.PI / 2, 0],
    ['#3B82F6', 0, Math.PI / 2],
    ['#10B981', Math.PI / 2, Math.PI],
    ['#F59E0B', Math.PI, Math.PI * 1.5],
  ];
  for (const [col, start, end] of slices) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, start, end);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = '#1E1B4B';
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, size * 0.08);
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws any of the 11 PAWS card icons in a normalized 64×64 space centered at (cx, cy).
 */
function drawCardIcon(
  ctx: CanvasRenderingContext2D,
  type: CardType,
  value: number,
  cx: number,
  cy: number,
  size: number,
  ink: string,
  cutoutColor = '#1E1B4B',
) {
  ctx.save();
  ctx.translate(cx, cy);
  const scale = size / 64;
  ctx.scale(scale, scale);
  ctx.translate(-32, -32);
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (type) {
    case 'basic': {
      const needsUnderline = value === 6 || value === 9;
      ctx.font = `900 48px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(value), 32, needsUnderline ? 30 : 33);
      if (needsUnderline) {
        roundedRectPath(ctx, 18, 52, 28, 5.5, 2.75);
        ctx.fill();
      }
      break;
    }

    case 'arrow': {
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(14, 50);
      ctx.lineTo(48, 16);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(27, 14);
      ctx.lineTo(50, 14);
      ctx.lineTo(50, 37);
      ctx.stroke();

      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(10, 38);
      ctx.lineTo(16, 44);
      ctx.lineTo(10, 54);
      ctx.lineTo(20, 48);
      ctx.lineTo(26, 54);
      ctx.stroke();
      break;
    }

    case 'freeze': {
      ctx.lineWidth = 4.8;
      // 3 main axes
      ctx.beginPath();
      ctx.moveTo(32, 8);
      ctx.lineTo(32, 56);
      ctx.moveTo(11.2, 20);
      ctx.lineTo(52.8, 44);
      ctx.moveTo(52.8, 20);
      ctx.lineTo(11.2, 44);
      // 6 chevron tips
      ctx.moveTo(25, 14);
      ctx.lineTo(32, 20);
      ctx.lineTo(39, 14);
      ctx.moveTo(25, 50);
      ctx.lineTo(32, 44);
      ctx.lineTo(39, 50);
      ctx.moveTo(13, 28);
      ctx.lineTo(21, 25.5);
      ctx.lineTo(18, 17.5);
      ctx.moveTo(51, 36);
      ctx.lineTo(43, 38.5);
      ctx.lineTo(46, 46.5);
      ctx.moveTo(46, 17.5);
      ctx.lineTo(43, 25.5);
      ctx.lineTo(51, 28);
      ctx.moveTo(18, 46.5);
      ctx.lineTo(21, 38.5);
      ctx.lineTo(13, 36);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(32, 32, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'boomerang': {
      ctx.lineWidth = 6.5;
      ctx.beginPath();
      ctx.moveTo(15, 28);
      ctx.bezierCurveTo(17, 17, 26, 11, 37, 13);
      ctx.bezierCurveTo(43, 14, 48, 18, 51, 23);
      ctx.stroke();

      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(42, 23);
      ctx.lineTo(53, 25);
      ctx.lineTo(52, 14);
      ctx.stroke();

      ctx.lineWidth = 6.5;
      ctx.beginPath();
      ctx.moveTo(49, 36);
      ctx.bezierCurveTo(47, 47, 38, 53, 27, 51);
      ctx.bezierCurveTo(21, 50, 16, 46, 13, 41);
      ctx.stroke();

      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(22, 41);
      ctx.lineTo(11, 39);
      ctx.lineTo(12, 50);
      ctx.stroke();
      break;
    }

    case 'shovel': {
      // D-handle
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(14, 14);
      ctx.lineTo(22, 10);
      ctx.lineTo(26, 18);
      ctx.lineTo(18, 22);
      ctx.closePath();
      ctx.stroke();

      // Shaft
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(22, 19);
      ctx.lineTo(37, 34);
      ctx.stroke();

      // Scoop blade
      ctx.beginPath();
      ctx.moveTo(31, 37);
      ctx.lineTo(42, 26);
      ctx.lineTo(53, 37);
      ctx.bezierCurveTo(56, 40, 56, 45, 53, 48);
      ctx.lineTo(46, 55);
      ctx.bezierCurveTo(43, 58, 38, 58, 35, 55);
      ctx.lineTo(24, 44);
      ctx.closePath();
      ctx.fill();

      // "+2" badge
      ctx.font = `900 18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+2', 48, 16);
      break;
    }

    case 'crossbow': {
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(12, 24);
      ctx.bezierCurveTo(19, 13, 45, 13, 52, 24);
      ctx.stroke();

      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(13, 25);
      ctx.lineTo(32, 36);
      ctx.lineTo(51, 25);
      ctx.stroke();

      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(32, 14);
      ctx.lineTo(32, 54);
      ctx.moveTo(25, 54);
      ctx.lineTo(39, 54);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(25, 17);
      ctx.lineTo(32, 7);
      ctx.lineTo(39, 17);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'taser': {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(36, 7);
      ctx.lineTo(14, 35);
      ctx.lineTo(30, 35);
      ctx.lineTo(25, 57);
      ctx.lineTo(50, 28);
      ctx.lineTo(34, 28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.lineWidth = 3.8;
      ctx.beginPath();
      ctx.moveTo(11, 19);
      ctx.lineTo(17, 21);
      ctx.moveTo(53, 43);
      ctx.lineTo(47, 41);
      ctx.moveTo(49, 14);
      ctx.lineTo(44, 18);
      ctx.stroke();
      break;
    }

    case 'banana': {
      // Stem
      ctx.beginPath();
      ctx.moveTo(29, 10);
      ctx.lineTo(35, 10);
      ctx.lineTo(34, 19);
      ctx.lineTo(30, 19);
      ctx.closePath();
      ctx.fill();

      // Left splayed peel
      ctx.beginPath();
      ctx.moveTo(30, 19);
      ctx.bezierCurveTo(20, 22, 10, 34, 9, 48);
      ctx.bezierCurveTo(16, 49, 23, 44, 27, 36);
      ctx.closePath();
      ctx.fill();

      // Right splayed peel
      ctx.beginPath();
      ctx.moveTo(34, 19);
      ctx.bezierCurveTo(44, 22, 54, 34, 55, 48);
      ctx.bezierCurveTo(48, 49, 41, 44, 37, 36);
      ctx.closePath();
      ctx.fill();

      // Center peel
      ctx.beginPath();
      ctx.moveTo(28, 19);
      ctx.lineTo(36, 19);
      ctx.bezierCurveTo(37, 33, 41, 46, 32, 54);
      ctx.bezierCurveTo(23, 46, 27, 33, 28, 19);
      ctx.closePath();
      ctx.fill();

      // Subtle inner rib lines
      ctx.strokeStyle = cutoutColor;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(26, 26);
      ctx.bezierCurveTo(21, 31, 17, 38, 15, 44);
      ctx.moveTo(38, 26);
      ctx.bezierCurveTo(43, 31, 47, 38, 49, 44);
      ctx.stroke();
      break;
    }

    case 'bomb': {
      // Fuse cord
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(36, 19);
      ctx.bezierCurveTo(38, 12, 44, 10, 49, 13);
      ctx.stroke();

      // Spark star
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.moveTo(52, 7);
      ctx.lineTo(53.8, 11.2);
      ctx.lineTo(58, 13);
      ctx.lineTo(53.8, 14.8);
      ctx.lineTo(52, 19);
      ctx.lineTo(50.2, 14.8);
      ctx.lineTo(46, 13);
      ctx.lineTo(50.2, 11.2);
      ctx.closePath();
      ctx.fill();

      // Cap + body
      ctx.fillStyle = ink;
      roundedRectPath(ctx, 26, 17, 12, 7, 2.5);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(30, 39, 18, 0, Math.PI * 2);
      ctx.fill();

      // Glossy highlight arc
      ctx.strokeStyle = cutoutColor;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(20, 34);
      ctx.bezierCurveTo(21, 29, 25, 26, 30, 26);
      ctx.stroke();
      break;
    }

    case 'egg': {
      ctx.beginPath();
      ctx.moveTo(32, 8);
      ctx.bezierCurveTo(20, 8, 13, 24, 13, 38);
      ctx.bezierCurveTo(13, 49.5, 21, 56, 32, 56);
      ctx.bezierCurveTo(43, 56, 51, 49.5, 51, 38);
      ctx.bezierCurveTo(51, 24, 44, 8, 32, 8);
      ctx.closePath();
      ctx.fill();

      // Question mark cutout
      ctx.strokeStyle = cutoutColor;
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(26, 27);
      ctx.bezierCurveTo(26, 23.2, 28.7, 21, 32.3, 21);
      ctx.bezierCurveTo(35.8, 21, 38, 23.1, 38, 26.2);
      ctx.bezierCurveTo(38, 29, 36.2, 30.5, 33.8, 31.8);
      ctx.bezierCurveTo(32.2, 32.7, 31.8, 33.8, 31.8, 36);
      ctx.stroke();

      ctx.fillStyle = cutoutColor;
      ctx.beginPath();
      ctx.arc(32, 44, 3.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(20, 40, 2.6, 0, Math.PI * 2);
      ctx.arc(44, 34, 2.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'potion': {
      // Cork + neck rim
      roundedRectPath(ctx, 26, 8, 12, 7, 2);
      ctx.fill();
      roundedRectPath(ctx, 23, 14, 18, 4.5, 2.2);
      ctx.fill();

      // Flask silhouette
      ctx.beginPath();
      ctx.moveTo(26, 19);
      ctx.lineTo(26, 27);
      ctx.lineTo(14, 45);
      ctx.bezierCurveTo(11.8, 48.5, 14.3, 54, 18.5, 54);
      ctx.lineTo(45.5, 54);
      ctx.bezierCurveTo(49.7, 54, 52.2, 48.5, 50, 45);
      ctx.lineTo(38, 27);
      ctx.lineTo(38, 19);
      ctx.closePath();

      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 4.4;
      ctx.stroke();

      // Liquid
      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.moveTo(21, 39);
      ctx.bezierCurveTo(25, 36.5, 31, 41, 36, 39);
      ctx.bezierCurveTo(39, 38, 41.5, 38, 43, 39);
      ctx.lineTo(47, 46);
      ctx.bezierCurveTo(48, 47.8, 46.7, 50, 44.6, 50);
      ctx.lineTo(19.4, 50);
      ctx.bezierCurveTo(17.3, 50, 16, 47.8, 17, 46);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Bubbles
      ctx.beginPath();
      ctx.arc(28, 33, 2.4, 0, Math.PI * 2);
      ctx.arc(36, 29, 1.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

function drawCornerIndex(
  ctx: CanvasRenderingContext2D,
  type: CardType,
  value: number,
  color: Color | undefined,
  isWild: boolean,
  mirrored: boolean,
) {
  ctx.save();
  if (mirrored) {
    ctx.translate(CANVAS_W, CANVAS_H);
    ctx.rotate(Math.PI);
  }

  const theme = !isWild && color ? COLOR_THEME[color] : null;
  const isYellow = theme?.id === 'yellow';
  const badgeX = 48;
  const badgeY = 48;
  const badgeW = 72;
  const badgeH = 104;

  roundedRectPath(ctx, badgeX, badgeY, badgeW, badgeH, 16);
  ctx.fillStyle = isWild
    ? 'rgba(15, 23, 42, 0.62)'
    : isYellow
      ? 'rgba(255, 251, 235, 0.5)'
      : 'rgba(15, 23, 42, 0.3)';
  ctx.fill();

  const ink = isWild ? '#FFFFFF' : theme ? theme.cornerText : '#FFFFFF';
  const centerX = badgeX + badgeW / 2;

  if (type === 'basic') {
    const needsUnderline = value === 6 || value === 9;
    ctx.fillStyle = ink;
    ctx.font = `900 44px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), centerX, badgeY + 34);
    if (needsUnderline) {
      roundedRectPath(ctx, centerX - 14, badgeY + 55, 28, 4.5, 2.25);
      ctx.fill();
    }
  } else {
    drawCardIcon(
      ctx,
      type,
      value,
      centerX,
      badgeY + 34,
      44,
      ink,
      isWild ? '#1E1B4B' : theme?.primary ?? '#1E1B4B',
    );
  }

  // Colorblind shape badge below number/icon
  if (isWild) {
    drawWildQuadBadge(ctx, centerX, badgeY + 80, 28);
  } else if (theme) {
    drawColorShape(ctx, theme.id, centerX, badgeY + 80, 26, ink);
  }

  ctx.restore();
}

/**
 * Generates and caches a high-DPI (512×720) THREE.CanvasTexture for a PAWS card front.
 */
export function getCardFrontTexture({
  type = 'basic',
  color,
  value = 0,
  activeWildColor,
}: CardFrontTextureOptions): THREE.CanvasTexture {
  const meta = CARD_META[type];
  const isWild = meta.isWild || !color;
  const cacheKey = `${type}|${isWild ? 'wild' : color}|${type === 'basic' ? value : ''}|${isWild && activeWildColor ? activeWildColor : ''}`;

  const existing = frontTextureCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const [canvas, ctx] = createCanvas();
  const theme = !isWild && color ? COLOR_THEME[color] : null;
  const activeWildTheme = isWild && activeWildColor ? COLOR_THEME[activeWildColor] : null;

  // 1. Crisp white outer border stock
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // 2. Clipped inner card surface
  const border = 24;
  const innerW = CANVAS_W - border * 2;
  const innerH = CANVAS_H - border * 2;

  ctx.save();
  roundedRectPath(ctx, border, border, innerW, innerH, 32);
  ctx.clip();

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  if (isWild) {
    grad.addColorStop(0, WILD_THEME.primary);
    grad.addColorStop(0.62, WILD_THEME.secondary);
    grad.addColorStop(1, WILD_THEME.dark);
  } else {
    grad.addColorStop(0, theme!.primary);
    grad.addColorStop(1, theme!.secondary);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(border, border, innerW, innerH);

  // Subtle wild iridescent diagonal sheen bands
  if (isWild) {
    ctx.save();
    ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
    ctx.rotate(-0.42);
    const sheenGrad = ctx.createLinearGradient(-260, 0, 260, 0);
    sheenGrad.addColorStop(0, 'rgba(236, 72, 153, 0)');
    sheenGrad.addColorStop(0.28, 'rgba(236, 72, 153, 0.14)');
    sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.16)');
    sheenGrad.addColorStop(0.72, 'rgba(59, 130, 246, 0.14)');
    sheenGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(-380, -110, 760, 220);
    ctx.restore();
  }

  // Subtle inner hairline frame
  roundedRectPath(ctx, border + 14, border + 14, innerW - 28, innerH - 28, 22);
  ctx.lineWidth = 3;
  ctx.strokeStyle = isWild
    ? 'rgba(233, 213, 255, 0.3)'
    : theme?.id === 'yellow'
      ? 'rgba(69, 26, 3, 0.2)'
      : 'rgba(255, 255, 255, 0.34)';
  ctx.stroke();

  // Active wild color inner glow frame
  if (activeWildTheme) {
    roundedRectPath(ctx, border + 6, border + 6, innerW - 12, innerH - 12, 26);
    ctx.lineWidth = 10;
    ctx.strokeStyle = activeWildTheme.primary;
    ctx.stroke();
  }

  // Paw-print watermark
  drawPaw(
    ctx,
    CANVAS_W / 2,
    CANVAS_H / 2,
    330,
    -0.22,
    isWild ? '#E9D5FF' : theme?.id === 'yellow' ? '#451A03' : '#FFFFFF',
    isWild ? 0.1 : theme?.id === 'yellow' ? 0.09 : 0.13,
  );

  // Corner indices (top-left and 180°-rotated bottom-right)
  drawCornerIndex(ctx, type, value, color, isWild, false);
  drawCornerIndex(ctx, type, value, color, isWild, true);

  // Active wild color badge top-right
  if (activeWildTheme) {
    const bx = CANVAS_W - 74;
    const by = 74;
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, by, 28, 0, Math.PI * 2);
    ctx.fillStyle = activeWildTheme.primary;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    drawColorShape(ctx, activeWildTheme.id, bx, by, 28, activeWildTheme.cornerText);
    ctx.restore();
  }

  // Center Medallion
  const medX = CANVAS_W / 2;
  const medY = CANVAS_H / 2 - 14;
  const medR = 132;

  if (isWild) {
    // 4-color quad ring
    const ringR = medR + 13;
    const arcs: Array<[string, number, number]> = [
      ['#EC4899', -Math.PI * 0.25, Math.PI * 0.25],
      ['#3B82F6', Math.PI * 0.25, Math.PI * 0.75],
      ['#10B981', Math.PI * 0.75, Math.PI * 1.25],
      ['#F59E0B', Math.PI * 1.25, Math.PI * 1.75],
    ];
    for (const [col, start, end] of arcs) {
      ctx.beginPath();
      ctx.moveTo(medX, medY);
      ctx.arc(medX, medY, ringR, start, end);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    }

    // Deep midnight inner medallion
    ctx.beginPath();
    ctx.arc(medX, medY, medR, 0, Math.PI * 2);
    ctx.fillStyle = '#16103B';
    ctx.fill();

    // Crisp luminous icon
    drawCardIcon(ctx, type, value, medX, medY, 168, '#F8FAFC', '#16103B');
  } else {
    // Soft tinted outer halo
    ctx.beginPath();
    ctx.arc(medX, medY, medR + 9, 0, Math.PI * 2);
    ctx.fillStyle = theme!.light;
    ctx.fill();

    // Cream-white medallion
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.2)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.beginPath();
    ctx.arc(medX, medY, medR, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFDF9';
    ctx.fill();
    ctx.restore();

    if (type === 'basic') {
      const needsUnderline = value === 6 || value === 9;
      ctx.fillStyle = theme!.ink;
      ctx.font = `900 162px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(value), medX, needsUnderline ? medY - 8 : medY + 4);
      if (needsUnderline) {
        roundedRectPath(ctx, medX - 44, medY + 72, 88, 12, 6);
        ctx.fill();
      }
    } else {
      drawCardIcon(ctx, type, value, medX, medY, 164, theme!.ink, '#FFFDF9');
    }
  }

  // Vietnamese label pill at bottom of medallion
  const pillLabel = (type === 'basic' ? `SỐ ${value}` : meta.name).toUpperCase();
  ctx.font = `800 28px ${FONT_FAMILY}`;
  const textMetrics = ctx.measureText(pillLabel);
  const pillW = Math.max(156, Math.min(370, textMetrics.width + 52));
  const pillH = 54;
  const pillX = medX - pillW / 2;
  const pillY = medY + medR - 18;

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.28)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  roundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = isWild ? WILD_THEME.pillBg : theme!.pillBg;
  ctx.fill();
  ctx.restore();

  roundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.stroke();

  ctx.fillStyle = isWild ? WILD_THEME.pillText : theme!.pillText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pillLabel, medX, pillY + pillH / 2 + 1);

  ctx.restore();

  const texture = finalizeTexture(canvas);
  frontTextureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generates and caches the original PAWS winter-night navy card back texture (512×720).
 */
export function getCardBackTexture(): THREE.CanvasTexture {
  if (cachedBackTexture) {
    return cachedBackTexture;
  }

  const [canvas, ctx] = createCanvas();

  // Crisp white outer border stock
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const border = 24;
  const innerW = CANVAS_W - border * 2;
  const innerH = CANVAS_H - border * 2;

  ctx.save();
  roundedRectPath(ctx, border, border, innerW, innerH, 32);
  ctx.clip();

  // Deep winter-night navy gradient
  const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  grad.addColorStop(0, '#1E293B');
  grad.addColorStop(0.55, '#1D3557');
  grad.addColorStop(1, '#0F172A');
  ctx.fillStyle = grad;
  ctx.fillRect(border, border, innerW, innerH);

  // Subtle winter snow dot grid
  ctx.fillStyle = 'rgba(248, 250, 252, 0.08)';
  for (let y = border + 16; y < CANVAS_H - border; y += 28) {
    for (let x = border + 16; x < CANVAS_W - border; x += 28) {
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Inner hairline frame
  roundedRectPath(ctx, border + 16, border + 16, innerW - 32, innerH - 32, 22);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
  ctx.stroke();

  // Corner mini paws
  drawPaw(ctx, 72, 74, 44, -0.24, '#BAE6FD', 0.45);
  drawPaw(ctx, CANVAS_W - 72, CANVAS_H - 74, 44, Math.PI - 0.24, '#BAE6FD', 0.45);

  // Subtle background watermark paw
  drawPaw(ctx, CANVAS_W / 2, CANVAS_H / 2, 340, -0.2, '#E0F2FE', 0.08);

  // Center PAWS emblem card
  const boxW = 264;
  const boxH = 286;
  const boxX = (CANVAS_W - boxW) / 2;
  const boxY = (CANVAS_H - boxH) / 2;

  roundedRectPath(ctx, boxX, boxY, boxW, boxH, 36);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
  ctx.stroke();

  // Golden paw emblem
  drawPaw(ctx, CANVAS_W / 2, boxY + 106, 134, 0, '#FCD34D', 1);

  // PAWS wordmark
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 54px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAWS', CANVAS_W / 2, boxY + 210);

  // 4-color mini accent shapes
  const dots: Array<[string, number]> = [
    ['#EC4899', -48],
    ['#3B82F6', -16],
    ['#10B981', 16],
    ['#F59E0B', 48],
  ];
  for (const [col, dx] of dots) {
    ctx.beginPath();
    ctx.arc(CANVAS_W / 2 + dx, boxY + 254, 7, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  }

  ctx.restore();

  cachedBackTexture = finalizeTexture(canvas);
  return cachedBackTexture;
}
