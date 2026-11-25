import type { BlockColor } from './types.ts';
import { COLOR_TOKENS } from './pieces.ts';

export type StageThemeId = 'timber' | 'aurora' | 'sakura' | 'royal' | 'celestial';

export interface StageColorOverride {
  readonly label?: string;
  readonly bgHex: string;
  readonly topHex: string;
  readonly borderHex: string;
  readonly shadowHex: string;
}

export interface ResolvedBlockColorToken {
  readonly label: string;
  readonly bgHex: string;
  readonly topHex: string;
  readonly borderHex: string;
  readonly shadowHex: string;
  readonly patternGlyph: string;
}

export interface BoardStageTheme {
  readonly tier: number;
  readonly id: StageThemeId;
  readonly name: string;
  readonly palette: readonly BlockColor[];
  readonly particleCount: number;
  readonly allClearParticleCount: number;
  readonly shockwaveRings: number;
  readonly shakeLevel: 'sm' | 'lg';
  readonly accentHex: string;
  readonly sweepColorHex: string;
  readonly frameClass: string;
  readonly frameRimClass: string;
  readonly wellClass: string;
  readonly wellAmbientClass: string;
  readonly cellEvenClass: string;
  readonly cellOddClass: string;
  readonly traySlotClass: string;
  readonly badgeClass: string;
  readonly tileFinishClass: string;
  readonly colorOverrides?: Readonly<Partial<Record<BlockColor, StageColorOverride>>>;
}

export const STAGE_THEMES: readonly BoardStageTheme[] = [
  {
    tier: 1,
    id: 'timber',
    name: 'Cabin Gỗ Ấm',
    palette: ['amber', 'orange'],
    particleCount: 10,
    allClearParticleCount: 28,
    shockwaveRings: 1,
    shakeLevel: 'sm',
    accentHex: '#FBBF24',
    sweepColorHex: '#FDE68A',
    frameClass:
      'border-[#9C6338] shadow-[0_18px_40px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(254,243,199,0.2)]',
    frameRimClass: 'bb-frame-rim-timber',
    wellClass: 'border-[#150B06] bg-[#190D07]',
    wellAmbientClass: 'bb-well-timber',
    cellEvenClass: 'border-[#784A2C]/45 bg-[#2D1B12]',
    cellOddClass: 'border-[#693F24]/45 bg-[#26160E]',
    traySlotClass:
      'border-[#9C6338]/75 bg-gradient-to-b from-[#3C2315] to-[#24130B]',
    badgeClass: 'border-amber-400/45 bg-amber-950/80 text-amber-200',
    tileFinishClass: 'bb-tile-timber',
    colorOverrides: {
      orange: {
        label: 'Cam Gỗ',
        bgHex: '#EA580C',
        topHex: '#FED7AA',
        borderHex: '#FB923C',
        shadowHex: '#9A3412',
      },
    },
  },
  {
    tier: 2,
    id: 'aurora',
    name: 'Hồ Băng Cực Quang',
    palette: ['sky', 'emerald'],
    particleCount: 14,
    allClearParticleCount: 34,
    shockwaveRings: 2,
    shakeLevel: 'sm',
    accentHex: '#38BDF8',
    sweepColorHex: '#BAE6FD',
    frameClass:
      'border-sky-400/80 shadow-[0_18px_44px_rgba(14,165,233,0.34),inset_0_1px_0_rgba(224,242,254,0.32)]',
    frameRimClass: 'bb-frame-rim-aurora',
    wellClass: 'border-[#071522] bg-[#0A1B2B]',
    wellAmbientClass: 'bb-well-aurora',
    cellEvenClass: 'border-sky-400/25 bg-[#112D46]',
    cellOddClass: 'border-sky-400/18 bg-[#0E253A]',
    traySlotClass:
      'border-sky-400/50 bg-gradient-to-b from-[#13334F] to-[#0C2033]',
    badgeClass: 'border-sky-400/50 bg-sky-950/85 text-sky-200',
    tileFinishClass: 'bb-tile-aurora',
  },
  {
    tier: 3,
    id: 'sakura',
    name: 'Đêm Kẹo Anh Đào',
    palette: ['rose', 'violet'],
    particleCount: 18,
    allClearParticleCount: 38,
    shockwaveRings: 2,
    shakeLevel: 'lg',
    accentHex: '#F472B6',
    sweepColorHex: '#FBCFE8',
    frameClass:
      'border-pink-400/80 shadow-[0_18px_46px_rgba(236,72,153,0.34),inset_0_1px_0_rgba(251,207,232,0.32)]',
    frameRimClass: 'bb-frame-rim-sakura',
    wellClass: 'border-[#170715] bg-[#200B1E]',
    wellAmbientClass: 'bb-well-sakura',
    cellEvenClass: 'border-pink-400/25 bg-[#351632]',
    cellOddClass: 'border-purple-400/20 bg-[#2C1129]',
    traySlotClass:
      'border-pink-400/50 bg-gradient-to-b from-[#3C1937] to-[#240D22]',
    badgeClass: 'border-pink-400/50 bg-pink-950/85 text-pink-200',
    tileFinishClass: 'bb-tile-sakura',
    colorOverrides: {
      violet: {
        label: 'Tím Oải',
        bgHex: '#A855F7',
        topHex: '#F3E8FF',
        borderHex: '#C084FC',
        shadowHex: '#6B21A8',
      },
    },
  },
  {
    tier: 4,
    id: 'royal',
    name: 'Thánh Đường Hoàng Kim',
    palette: ['amber', 'rose'],
    particleCount: 22,
    allClearParticleCount: 44,
    shockwaveRings: 3,
    shakeLevel: 'lg',
    accentHex: '#FACC15',
    sweepColorHex: '#FEF08A',
    frameClass:
      'border-yellow-400/85 shadow-[0_18px_50px_rgba(250,204,21,0.38),inset_0_0_0_1px_rgba(254,240,138,0.45)]',
    frameRimClass: 'bb-frame-rim-royal',
    wellClass: 'border-[#120B03] bg-[#171007]',
    wellAmbientClass: 'bb-well-royal',
    cellEvenClass: 'border-yellow-400/25 bg-[#291D0D]',
    cellOddClass: 'border-amber-500/20 bg-[#21170A]',
    traySlotClass:
      'border-yellow-400/55 bg-gradient-to-b from-[#37250D] to-[#1E1306]',
    badgeClass: 'border-yellow-300/60 bg-amber-950/90 text-yellow-200',
    tileFinishClass: 'bb-tile-royal',
    colorOverrides: {
      amber: {
        label: 'Vàng 24K',
        bgHex: '#EAB308',
        topHex: '#FEF9C3',
        borderHex: '#FDE047',
        shadowHex: '#854D0E',
      },
      rose: {
        label: 'Ruby Đỏ',
        bgHex: '#E11D48',
        topHex: '#FFE4E6',
        borderHex: '#FB7185',
        shadowHex: '#881337',
      },
    },
  },
  {
    tier: 5,
    id: 'celestial',
    name: 'Tinh Tú Huyền Thoại',
    palette: ['violet', 'sky'],
    particleCount: 28,
    allClearParticleCount: 56,
    shockwaveRings: 3,
    shakeLevel: 'lg',
    accentHex: '#A78BFA',
    sweepColorHex: '#DDD6FE',
    frameClass:
      'border-violet-400/85 shadow-[0_20px_54px_rgba(139,92,246,0.46),0_0_22px_rgba(34,211,238,0.24)]',
    frameRimClass: 'bb-frame-rim-celestial',
    wellClass: 'border-[#090518] bg-[#0D0824]',
    wellAmbientClass: 'bb-well-celestial',
    cellEvenClass: 'border-violet-400/25 bg-[#1D1543]',
    cellOddClass: 'border-cyan-400/18 bg-[#161036]',
    traySlotClass:
      'border-violet-400/55 bg-gradient-to-b from-[#25184F] to-[#130C30]',
    badgeClass: 'border-violet-300/60 bg-violet-950/90 text-violet-100',
    tileFinishClass: 'bb-tile-celestial',
    colorOverrides: {
      violet: {
        label: 'Chàm Sao',
        bgHex: '#6366F1',
        topHex: '#E0E7FF',
        borderHex: '#818CF8',
        shadowHex: '#3730A3',
      },
      sky: {
        label: 'Lam Thiên',
        bgHex: '#06B6D4',
        topHex: '#CFFAFE',
        borderHex: '#22D3EE',
        shadowHex: '#155E75',
      },
    },
  },
];

/** Resolves the visual color token for a block under the active Stage theme, preserving its unique colorblind glyph. */
export function resolveStageColorToken(
  color: BlockColor,
  stageTheme?: BoardStageTheme,
): ResolvedBlockColorToken {
  const base = COLOR_TOKENS[color];
  const override = stageTheme?.colorOverrides?.[color];
  if (!override) return base;
  return {
    label: override.label ?? base.label,
    bgHex: override.bgHex,
    topHex: override.topHex,
    borderHex: override.borderHex,
    shadowHex: override.shadowHex,
    patternGlyph: base.patternGlyph,
  };
}

/** Returns 1-based stage number derived from total board clears. */
export function getStageNumber(allClears: number): number {
  if (!Number.isFinite(allClears) || allClears <= 0) return 1;
  return Math.floor(allClears) + 1;
}

/** Returns the visual theme and limited color palette for the current stage. */
export function getStageTheme(allClears: number): BoardStageTheme {
  const idx = Math.min(
    STAGE_THEMES.length - 1,
    Math.max(0, getStageNumber(allClears) - 1),
  );
  return STAGE_THEMES[idx];
}
