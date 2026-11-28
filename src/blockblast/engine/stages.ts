import type { BlockColor } from './types.ts';
import { COLOR_TOKENS } from './pieces.ts';

export type StageThemeId =
  | 'timber'
  | 'aurora'
  | 'sakura'
  | 'royal'
  | 'celestial'
  | 'inferno'
  | 'emerald_jade'
  | 'cyber_neon'
  | 'eclipse'
  | 'prism_eternal';

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
  {
    tier: 6,
    id: 'inferno',
    name: 'Hỏa Ngục Dung Nham',
    palette: ['orange', 'rose'],
    particleCount: 32,
    allClearParticleCount: 62,
    shockwaveRings: 3,
    shakeLevel: 'lg',
    accentHex: '#FB923C',
    sweepColorHex: '#FED7AA',
    frameClass:
      'border-orange-500/90 shadow-[0_20px_56px_rgba(249,115,22,0.46),0_0_24px_rgba(244,63,94,0.28),inset_0_1px_0_rgba(254,215,170,0.4)]',
    frameRimClass: 'bb-frame-rim-inferno',
    wellClass: 'border-[#1C0704] bg-[#160604]',
    wellAmbientClass: 'bb-well-inferno',
    cellEvenClass: 'border-orange-500/25 bg-[#2B100A]',
    cellOddClass: 'border-rose-500/20 bg-[#220B08]',
    traySlotClass:
      'border-orange-400/55 bg-gradient-to-b from-[#3A140A] to-[#1E0905]',
    badgeClass: 'border-orange-400/65 bg-orange-950/90 text-orange-100',
    tileFinishClass: 'bb-tile-inferno',
    colorOverrides: {
      orange: {
        label: 'Dung Nham',
        bgHex: '#F97316',
        topHex: '#FFEDD5',
        borderHex: '#FDBA74',
        shadowHex: '#9A3412',
      },
      rose: {
        label: 'Hồng Ngọc Lửa',
        bgHex: '#F43F5E',
        topHex: '#FFE4E6',
        borderHex: '#FDA4AF',
        shadowHex: '#9F1239',
      },
    },
  },
  {
    tier: 7,
    id: 'emerald_jade',
    name: 'Đền Ngọc Lục Bảo',
    palette: ['emerald', 'amber'],
    particleCount: 36,
    allClearParticleCount: 68,
    shockwaveRings: 4,
    shakeLevel: 'lg',
    accentHex: '#34D399',
    sweepColorHex: '#A7F3D0',
    frameClass:
      'border-emerald-400/90 shadow-[0_20px_58px_rgba(16,185,129,0.44),0_0_26px_rgba(250,204,21,0.24),inset_0_1px_0_rgba(167,243,208,0.42)]',
    frameRimClass: 'bb-frame-rim-emerald-jade',
    wellClass: 'border-[#041812] bg-[#061C15]',
    wellAmbientClass: 'bb-well-emerald-jade',
    cellEvenClass: 'border-emerald-400/25 bg-[#0D3025]',
    cellOddClass: 'border-teal-400/20 bg-[#0A261D]',
    traySlotClass:
      'border-emerald-400/55 bg-gradient-to-b from-[#113D2F] to-[#081F18]',
    badgeClass: 'border-emerald-300/65 bg-emerald-950/90 text-emerald-100',
    tileFinishClass: 'bb-tile-emerald-jade',
    colorOverrides: {
      emerald: {
        label: 'Ngọc Phỉ Thúy',
        bgHex: '#10B981',
        topHex: '#D1FAE5',
        borderHex: '#6EE7B7',
        shadowHex: '#065F46',
      },
      amber: {
        label: 'Vàng Cổ Tự',
        bgHex: '#F59E0B',
        topHex: '#FEF3C7',
        borderHex: '#FCD34D',
        shadowHex: '#92400E',
      },
    },
  },
  {
    tier: 8,
    id: 'cyber_neon',
    name: 'Phố Đêm Cyber Neon',
    palette: ['sky', 'rose'],
    particleCount: 40,
    allClearParticleCount: 74,
    shockwaveRings: 4,
    shakeLevel: 'lg',
    accentHex: '#22D3EE',
    sweepColorHex: '#F472B6',
    frameClass:
      'border-cyan-400/90 shadow-[0_22px_60px_rgba(6,182,212,0.48),0_0_28px_rgba(236,72,153,0.34),inset_0_1px_0_rgba(165,243,252,0.45)]',
    frameRimClass: 'bb-frame-rim-cyber-neon',
    wellClass: 'border-[#040B1A] bg-[#070E20]',
    wellAmbientClass: 'bb-well-cyber-neon',
    cellEvenClass: 'border-cyan-400/25 bg-[#101B38]',
    cellOddClass: 'border-fuchsia-400/20 bg-[#0C142B]',
    traySlotClass:
      'border-cyan-400/60 bg-gradient-to-b from-[#142245] to-[#091024]',
    badgeClass: 'border-cyan-300/70 bg-slate-950/90 text-cyan-100',
    tileFinishClass: 'bb-tile-cyber-neon',
    colorOverrides: {
      sky: {
        label: 'Cyan Điện',
        bgHex: '#06B6D4',
        topHex: '#ECFEFF',
        borderHex: '#67E8F9',
        shadowHex: '#164E63',
      },
      rose: {
        label: 'Magenta Neon',
        bgHex: '#EC4899',
        topHex: '#FCE7F3',
        borderHex: '#F9A8D4',
        shadowHex: '#831843',
      },
    },
  },
  {
    tier: 9,
    id: 'eclipse',
    name: 'Nhật Thực Huyết Nguyệt',
    palette: ['violet', 'orange'],
    particleCount: 44,
    allClearParticleCount: 80,
    shockwaveRings: 5,
    shakeLevel: 'lg',
    accentHex: '#FB923C',
    sweepColorHex: '#DDD6FE',
    frameClass:
      'border-amber-400/90 shadow-[0_22px_64px_rgba(124,58,237,0.52),0_0_32px_rgba(251,146,60,0.38),inset_0_1px_0_rgba(254,215,170,0.48)]',
    frameRimClass: 'bb-frame-rim-eclipse',
    wellClass: 'border-[#07030F] bg-[#0B0517]',
    wellAmbientClass: 'bb-well-eclipse',
    cellEvenClass: 'border-violet-400/25 bg-[#190F2E]',
    cellOddClass: 'border-orange-400/20 bg-[#130B24]',
    traySlotClass:
      'border-orange-400/60 bg-gradient-to-b from-[#23133D] to-[#10081F]',
    badgeClass: 'border-orange-300/75 bg-violet-950/95 text-amber-100',
    tileFinishClass: 'bb-tile-eclipse',
    colorOverrides: {
      violet: {
        label: 'Tím Hư Không',
        bgHex: '#7C3AED',
        topHex: '#EDE9FE',
        borderHex: '#A78BFA',
        shadowHex: '#4C1D95',
      },
      orange: {
        label: 'Vành Nhật Thực',
        bgHex: '#FB923C',
        topHex: '#FFF7ED',
        borderHex: '#FDBA74',
        shadowHex: '#9A3412',
      },
    },
  },
  {
    tier: 10,
    id: 'prism_eternal',
    name: 'Đỉnh Cao Thái Cực Prism',
    palette: ['amber', 'violet'],
    particleCount: 48,
    allClearParticleCount: 88,
    shockwaveRings: 5,
    shakeLevel: 'lg',
    accentHex: '#FDE047',
    sweepColorHex: '#E9D5FF',
    frameClass:
      'border-fuchsia-300/95 shadow-[0_24px_68px_rgba(168,85,247,0.56),0_0_36px_rgba(250,204,21,0.42),0_0_18px_rgba(34,211,238,0.34),inset_0_1px_0_rgba(255,255,255,0.55)]',
    frameRimClass: 'bb-frame-rim-prism-eternal',
    wellClass: 'border-[#0B061C] bg-[#0F0924]',
    wellAmbientClass: 'bb-well-prism-eternal',
    cellEvenClass: 'border-fuchsia-300/30 bg-[#211547]',
    cellOddClass: 'border-cyan-300/25 bg-[#191038]',
    traySlotClass:
      'border-yellow-300/65 bg-gradient-to-b from-[#2E1B5E] to-[#140B2E]',
    badgeClass: 'border-yellow-200/80 bg-fuchsia-950/95 text-yellow-100',
    tileFinishClass: 'bb-tile-prism-eternal',
    colorOverrides: {
      amber: {
        label: 'Bạch Kim Kim Cương',
        bgHex: '#FACC15',
        topHex: '#FEFCE8',
        borderHex: '#FEF08A',
        shadowHex: '#854D0E',
      },
      violet: {
        label: 'Thạch Anh Cực Quang',
        bgHex: '#A855F7',
        topHex: '#FAF5FF',
        borderHex: '#D8B4FE',
        shadowHex: '#581C87',
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
