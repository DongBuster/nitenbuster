import type { StageThemeId } from '../engine/stages.ts';
import type { MoveOutcome } from '../engine/types.ts';

export type ScorePulseTier = 'normal' | 'multi' | 'combo' | 'bomb' | 'allClear';

export interface ScorePulseEvent {
  seq: number;
  points: number;
  tier: ScorePulseTier;
}

export interface StageScoreVisual {
  readonly cardClass: string;
  readonly labelClass: string;
  readonly digitGradient: string;
  readonly digitGlow: string;
  readonly beamGradient: string;
  readonly streakActiveClass: string;
  readonly sparkColors: readonly string[];
}

export interface ScoreSparkSpec {
  readonly id: number;
  readonly dx: number;
  readonly dy: number;
  readonly sizePx: number;
  readonly colorHex: string;
  readonly delayMs: number;
  readonly star: boolean;
}

const STAGE_SCORE_VISUALS: Record<StageThemeId, StageScoreVisual> = {
  timber: {
    cardClass:
      'border-[#9C6338]/75 bg-gradient-to-b from-[#341D11] via-[#26140B] to-[#1A0D07] shadow-[0_12px_28px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(253,230,138,0.16)]',
    labelClass: 'text-amber-300/85',
    digitGradient: 'linear-gradient(180deg, #FFFBEB 0%, #FDE68A 48%, #F59E0B 100%)',
    digitGlow: 'drop-shadow(0 0 12px rgba(251,191,36,0.48))',
    beamGradient:
      'linear-gradient(110deg, transparent 20%, rgba(253,230,138,0.42) 50%, transparent 80%)',
    streakActiveClass:
      'border-amber-300/70 bg-gradient-to-b from-amber-500/30 to-orange-600/25 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.28)]',
    sparkColors: ['#FEF3C7', '#FBBF24', '#FB923C'],
  },
  aurora: {
    cardClass:
      'border-sky-400/65 bg-gradient-to-b from-[#13334F] via-[#0E2438] to-[#081726] shadow-[0_12px_30px_rgba(14,165,233,0.28),inset_0_1px_0_rgba(186,230,253,0.25)]',
    labelClass: 'text-sky-300/90',
    digitGradient: 'linear-gradient(180deg, #F0F9FF 0%, #7DD3FC 48%, #34D399 100%)',
    digitGlow: 'drop-shadow(0 0 14px rgba(56,189,248,0.58))',
    beamGradient:
      'linear-gradient(110deg, transparent 20%, rgba(125,211,252,0.48) 50%, transparent 80%)',
    streakActiveClass:
      'border-sky-300/70 bg-gradient-to-b from-sky-500/30 to-emerald-500/25 text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.34)]',
    sparkColors: ['#E0F2FE', '#38BDF8', '#34D399'],
  },
  sakura: {
    cardClass:
      'border-pink-400/70 bg-gradient-to-b from-[#3E183A] via-[#2B1028] to-[#1B0919] shadow-[0_12px_32px_rgba(236,72,153,0.32),inset_0_1px_0_rgba(251,207,232,0.28)]',
    labelClass: 'text-pink-300/90',
    digitGradient: 'linear-gradient(180deg, #FFF1F2 0%, #FBCFE8 46%, #C084FC 100%)',
    digitGlow: 'drop-shadow(0 0 15px rgba(244,114,182,0.62))',
    beamGradient:
      'linear-gradient(110deg, transparent 20%, rgba(251,207,232,0.52) 50%, transparent 80%)',
    streakActiveClass:
      'border-pink-300/75 bg-gradient-to-b from-pink-500/30 to-purple-600/25 text-pink-100 shadow-[0_0_18px_rgba(244,114,182,0.38)]',
    sparkColors: ['#FCE7F3', '#F472B6', '#C084FC'],
  },
  royal: {
    cardClass:
      'border-yellow-400/80 bg-gradient-to-b from-[#3B280D] via-[#271907] to-[#170F04] shadow-[0_14px_34px_rgba(250,204,21,0.34),inset_0_1px_0_rgba(254,240,138,0.35)]',
    labelClass: 'text-yellow-300/95',
    digitGradient: 'linear-gradient(180deg, #FEFCE8 0%, #FDE047 50%, #FB7185 100%)',
    digitGlow: 'drop-shadow(0 0 16px rgba(250,204,21,0.68))',
    beamGradient:
      'linear-gradient(110deg, transparent 18%, rgba(254,240,138,0.58) 50%, transparent 82%)',
    streakActiveClass:
      'border-yellow-300/80 bg-gradient-to-b from-yellow-500/35 to-rose-600/25 text-yellow-100 shadow-[0_0_20px_rgba(250,204,21,0.42)]',
    sparkColors: ['#FEF9C3', '#FACC15', '#FB7185'],
  },
  celestial: {
    cardClass:
      'border-violet-400/85 bg-gradient-to-b from-[#2A1B59] via-[#1A113B] to-[#0E0824] shadow-[0_14px_38px_rgba(139,92,246,0.44),0_0_20px_rgba(34,211,238,0.2),inset_0_1px_0_rgba(221,214,254,0.36)]',
    labelClass: 'text-cyan-200/95',
    digitGradient: 'linear-gradient(180deg, #ECFEFF 0%, #67E8F9 46%, #C4B5FD 100%)',
    digitGlow: 'drop-shadow(0 0 18px rgba(103,232,249,0.72))',
    beamGradient:
      'linear-gradient(110deg, transparent 15%, rgba(165,243,252,0.6) 48%, rgba(196,181,253,0.48) 58%, transparent 85%)',
    streakActiveClass:
      'border-cyan-300/80 bg-gradient-to-b from-violet-500/35 to-cyan-500/30 text-cyan-50 shadow-[0_0_22px_rgba(103,232,249,0.45)]',
    sparkColors: ['#FEF3C7', '#67E8F9', '#C4B5FD'],
  },
  inferno: {
    cardClass:
      'border-orange-400/90 bg-gradient-to-b from-[#44170B] via-[#2B0E07] to-[#170604] shadow-[0_14px_40px_rgba(249,115,22,0.44),0_0_22px_rgba(244,63,94,0.26),inset_0_1px_0_rgba(254,215,170,0.4)]',
    labelClass: 'text-orange-200/95',
    digitGradient: 'linear-gradient(180deg, #FFF7ED 0%, #FDBA74 44%, #F43F5E 100%)',
    digitGlow: 'drop-shadow(0 0 18px rgba(251,146,60,0.78))',
    beamGradient:
      'linear-gradient(110deg, transparent 15%, rgba(253,186,116,0.62) 46%, rgba(251,113,133,0.48) 58%, transparent 85%)',
    streakActiveClass:
      'border-orange-300/85 bg-gradient-to-b from-orange-500/40 to-rose-600/35 text-orange-50 shadow-[0_0_24px_rgba(249,115,22,0.5)]',
    sparkColors: ['#FEF08A', '#FB923C', '#FB7185'],
  },
  emerald_jade: {
    cardClass:
      'border-emerald-400/90 bg-gradient-to-b from-[#0F3C2E] via-[#0A261D] to-[#051611] shadow-[0_14px_40px_rgba(16,185,129,0.44),0_0_22px_rgba(250,204,21,0.22),inset_0_1px_0_rgba(167,243,208,0.4)]',
    labelClass: 'text-emerald-200/95',
    digitGradient: 'linear-gradient(180deg, #ECFDF5 0%, #6EE7B7 46%, #FCD34D 100%)',
    digitGlow: 'drop-shadow(0 0 19px rgba(52,211,153,0.78))',
    beamGradient:
      'linear-gradient(110deg, transparent 15%, rgba(167,243,208,0.62) 48%, rgba(252,211,77,0.45) 60%, transparent 85%)',
    streakActiveClass:
      'border-emerald-300/85 bg-gradient-to-b from-emerald-500/35 to-amber-500/30 text-emerald-50 shadow-[0_0_24px_rgba(52,211,153,0.48)]',
    sparkColors: ['#D1FAE5', '#34D399', '#FCD34D'],
  },
  cyber_neon: {
    cardClass:
      'border-cyan-400/90 bg-gradient-to-b from-[#132245] via-[#0C1530] to-[#060B1C] shadow-[0_16px_42px_rgba(6,182,212,0.48),0_0_26px_rgba(236,72,153,0.34),inset_0_1px_0_rgba(165,243,252,0.44)]',
    labelClass: 'text-cyan-200',
    digitGradient: 'linear-gradient(180deg, #ECFEFF 0%, #22D3EE 46%, #F472B6 100%)',
    digitGlow: 'drop-shadow(0 0 20px rgba(34,211,238,0.84))',
    beamGradient:
      'linear-gradient(110deg, transparent 14%, rgba(34,211,238,0.65) 45%, rgba(244,114,182,0.52) 58%, transparent 86%)',
    streakActiveClass:
      'border-cyan-300/85 bg-gradient-to-b from-cyan-500/40 to-fuchsia-500/35 text-cyan-50 shadow-[0_0_26px_rgba(34,211,238,0.52)]',
    sparkColors: ['#ECFEFF', '#22D3EE', '#F472B6'],
  },
  eclipse: {
    cardClass:
      'border-amber-400/90 bg-gradient-to-b from-[#251342] via-[#170B2B] to-[#0B0417] shadow-[0_16px_44px_rgba(124,58,237,0.52),0_0_28px_rgba(251,146,60,0.36),inset_0_1px_0_rgba(254,215,170,0.44)]',
    labelClass: 'text-amber-200',
    digitGradient: 'linear-gradient(180deg, #FFF7ED 0%, #FDBA74 44%, #A78BFA 100%)',
    digitGlow: 'drop-shadow(0 0 21px rgba(251,146,60,0.85))',
    beamGradient:
      'linear-gradient(110deg, transparent 14%, rgba(253,186,116,0.66) 46%, rgba(167,139,250,0.54) 58%, transparent 86%)',
    streakActiveClass:
      'border-amber-300/90 bg-gradient-to-b from-violet-600/40 to-orange-500/35 text-amber-50 shadow-[0_0_26px_rgba(251,146,60,0.54)]',
    sparkColors: ['#FFF7ED', '#FB923C', '#C4B5FD'],
  },
  prism_eternal: {
    cardClass:
      'border-fuchsia-300/95 bg-gradient-to-b from-[#301961] via-[#1C0F3D] to-[#0D0722] shadow-[0_18px_48px_rgba(168,85,247,0.58),0_0_32px_rgba(250,204,21,0.4),0_0_18px_rgba(34,211,238,0.3),inset_0_1px_0_rgba(255,255,255,0.55)]',
    labelClass: 'text-yellow-200',
    digitGradient:
      'linear-gradient(180deg, #FFFFFF 0%, #FEF08A 34%, #67E8F9 68%, #E879F9 100%)',
    digitGlow: 'drop-shadow(0 0 22px rgba(250,204,21,0.88))',
    beamGradient:
      'linear-gradient(110deg, transparent 12%, rgba(254,240,138,0.68) 40%, rgba(103,232,249,0.58) 54%, rgba(232,121,249,0.52) 66%, transparent 88%)',
    streakActiveClass:
      'border-yellow-200/90 bg-gradient-to-b from-fuchsia-500/40 via-cyan-500/30 to-yellow-400/35 text-white shadow-[0_0_28px_rgba(232,121,249,0.58)]',
    sparkColors: ['#FEF08A', '#67E8F9', '#F0ABFC', '#FFFFFF'],
  },
  abyss_ocean: {
    cardClass:
      'border-sky-400/90 bg-gradient-to-b from-[#0A2F52] via-[#07203A] to-[#03101F] shadow-[0_16px_44px_rgba(2,132,199,0.5),0_0_24px_rgba(45,212,191,0.3),inset_0_1px_0_rgba(186,230,253,0.46)]',
    labelClass: 'text-teal-200',
    digitGradient: 'linear-gradient(180deg, #F0FDFA 0%, #5EEAD4 44%, #38BDF8 100%)',
    digitGlow: 'drop-shadow(0 0 21px rgba(56,189,248,0.85))',
    beamGradient:
      'linear-gradient(110deg, transparent 14%, rgba(94,234,212,0.65) 46%, rgba(56,189,248,0.52) 60%, transparent 86%)',
    streakActiveClass:
      'border-teal-300/85 bg-gradient-to-b from-sky-500/40 to-teal-500/35 text-teal-50 shadow-[0_0_26px_rgba(56,189,248,0.52)]',
    sparkColors: ['#CCFBF1', '#5EEAD4', '#38BDF8'],
  },
  golden_pharaoh: {
    cardClass:
      'border-amber-300/90 bg-gradient-to-b from-[#3E2B0F] via-[#281B09] to-[#150E04] shadow-[0_16px_44px_rgba(217,119,6,0.5),0_0_26px_rgba(37,99,235,0.32),inset_0_1px_0_rgba(254,243,199,0.5)]',
    labelClass: 'text-amber-200',
    digitGradient: 'linear-gradient(180deg, #FFFBEB 0%, #FCD34D 48%, #60A5FA 100%)',
    digitGlow: 'drop-shadow(0 0 21px rgba(251,191,36,0.86))',
    beamGradient:
      'linear-gradient(110deg, transparent 14%, rgba(252,211,77,0.66) 46%, rgba(96,165,250,0.5) 60%, transparent 86%)',
    streakActiveClass:
      'border-amber-300/85 bg-gradient-to-b from-amber-500/40 to-blue-600/35 text-amber-50 shadow-[0_0_26px_rgba(251,191,36,0.52)]',
    sparkColors: ['#FEF3C7', '#FBBF24', '#60A5FA'],
  },
  crimson_samurai: {
    cardClass:
      'border-rose-400/90 bg-gradient-to-b from-[#45111C] via-[#2C0B12] to-[#180509] shadow-[0_16px_46px_rgba(220,38,38,0.52),0_0_26px_rgba(234,179,8,0.3),inset_0_1px_0_rgba(254,226,226,0.46)]',
    labelClass: 'text-rose-200',
    digitGradient: 'linear-gradient(180deg, #FFF1F2 0%, #FDA4AF 44%, #FACC15 100%)',
    digitGlow: 'drop-shadow(0 0 21px rgba(244,63,94,0.86))',
    beamGradient:
      'linear-gradient(110deg, transparent 14%, rgba(253,164,175,0.65) 46%, rgba(250,204,21,0.5) 60%, transparent 86%)',
    streakActiveClass:
      'border-rose-300/85 bg-gradient-to-b from-rose-600/40 to-amber-500/35 text-rose-50 shadow-[0_0_26px_rgba(244,63,94,0.54)]',
    sparkColors: ['#FFE4E6', '#FB7185', '#FACC15'],
  },
  frost_valkyrie: {
    cardClass:
      'border-sky-200/90 bg-gradient-to-b from-[#1E325E] via-[#13203E] to-[#0B1226] shadow-[0_16px_46px_rgba(125,211,252,0.5),0_0_28px_rgba(129,140,248,0.38),inset_0_1px_0_rgba(255,255,255,0.55)]',
    labelClass: 'text-sky-100',
    digitGradient: 'linear-gradient(180deg, #FFFFFF 0%, #BAE6FD 46%, #A5B4FC 100%)',
    digitGlow: 'drop-shadow(0 0 22px rgba(186,230,253,0.9))',
    beamGradient:
      'linear-gradient(110deg, transparent 14%, rgba(224,242,254,0.7) 46%, rgba(165,180,252,0.55) 60%, transparent 86%)',
    streakActiveClass:
      'border-sky-200/85 bg-gradient-to-b from-sky-400/40 to-indigo-500/35 text-white shadow-[0_0_26px_rgba(186,230,253,0.54)]',
    sparkColors: ['#FFFFFF', '#BAE6FD', '#A5B4FC'],
  },
  solar_phoenix: {
    cardClass:
      'border-orange-300/95 bg-gradient-to-b from-[#521F0B] via-[#341206] to-[#1B0803] shadow-[0_18px_50px_rgba(249,115,22,0.58),0_0_32px_rgba(250,204,21,0.42),inset_0_1px_0_rgba(255,251,235,0.58)]',
    labelClass: 'text-yellow-200',
    digitGradient: 'linear-gradient(180deg, #FFFFFF 0%, #FEF08A 42%, #FB923C 74%, #EA580C 100%)',
    digitGlow: 'drop-shadow(0 0 24px rgba(251,146,60,0.92))',
    beamGradient:
      'linear-gradient(110deg, transparent 12%, rgba(254,240,138,0.74) 44%, rgba(251,146,60,0.58) 60%, transparent 88%)',
    streakActiveClass:
      'border-yellow-200/90 bg-gradient-to-b from-orange-500/45 to-yellow-500/35 text-yellow-50 shadow-[0_0_28px_rgba(251,146,60,0.6)]',
    sparkColors: ['#FFFFFF', '#FEF08A', '#FB923C', '#F97316'],
  },
  void_nebula: {
    cardClass:
      'border-purple-300/95 bg-gradient-to-b from-[#2E1354] via-[#1C0B36] to-[#0D041C] shadow-[0_18px_50px_rgba(147,51,234,0.58),0_0_32px_rgba(244,114,182,0.4),inset_0_1px_0_rgba(243,232,255,0.52)]',
    labelClass: 'text-fuchsia-200',
    digitGradient: 'linear-gradient(180deg, #FAF5FF 0%, #E879F9 48%, #F472B6 100%)',
    digitGlow: 'drop-shadow(0 0 23px rgba(192,132,252,0.9))',
    beamGradient:
      'linear-gradient(110deg, transparent 12%, rgba(232,121,249,0.68) 44%, rgba(244,114,182,0.56) 60%, transparent 88%)',
    streakActiveClass:
      'border-fuchsia-300/90 bg-gradient-to-b from-purple-600/45 to-pink-500/35 text-fuchsia-50 shadow-[0_0_28px_rgba(192,132,252,0.58)]',
    sparkColors: ['#FAF5FF', '#C084FC', '#F472B6', '#F0ABFC'],
  },
  jade_dragon: {
    cardClass:
      'border-emerald-300/95 bg-gradient-to-b from-[#0E4A3D] via-[#082E26] to-[#041814] shadow-[0_18px_50px_rgba(16,185,129,0.56),0_0_32px_rgba(6,182,212,0.4),inset_0_1px_0_rgba(209,250,229,0.55)]',
    labelClass: 'text-emerald-200',
    digitGradient: 'linear-gradient(180deg, #ECFDF5 0%, #34D399 46%, #22D3EE 100%)',
    digitGlow: 'drop-shadow(0 0 23px rgba(16,185,129,0.9))',
    beamGradient:
      'linear-gradient(110deg, transparent 12%, rgba(110,231,183,0.68) 44%, rgba(34,211,238,0.56) 60%, transparent 88%)',
    streakActiveClass:
      'border-emerald-300/90 bg-gradient-to-b from-emerald-500/45 to-cyan-500/35 text-emerald-50 shadow-[0_0_28px_rgba(16,185,129,0.56)]',
    sparkColors: ['#ECFDF5', '#34D399', '#22D3EE', '#A7F3D0'],
  },
  arcane_clockwork: {
    cardClass:
      'border-amber-300/95 bg-gradient-to-b from-[#3D2A14] via-[#261A0C] to-[#130C05] shadow-[0_18px_52px_rgba(217,119,6,0.55),0_0_32px_rgba(109,40,217,0.42),inset_0_1px_0_rgba(254,243,199,0.55)]',
    labelClass: 'text-amber-200',
    digitGradient: 'linear-gradient(180deg, #FFFBEB 0%, #F59E0B 48%, #C4B5FD 100%)',
    digitGlow: 'drop-shadow(0 0 23px rgba(245,158,11,0.9))',
    beamGradient:
      'linear-gradient(110deg, transparent 12%, rgba(252,211,77,0.7) 44%, rgba(196,181,253,0.56) 60%, transparent 88%)',
    streakActiveClass:
      'border-amber-300/90 bg-gradient-to-b from-amber-500/45 to-violet-600/35 text-amber-50 shadow-[0_0_28px_rgba(245,158,11,0.56)]',
    sparkColors: ['#FEF3C7', '#F59E0B', '#C4B5FD', '#FFFFFF'],
  },
  supernova_core: {
    cardClass:
      'border-rose-300/95 bg-gradient-to-b from-[#3E1346] via-[#250B2B] to-[#120416] shadow-[0_20px_54px_rgba(244,63,94,0.6),0_0_36px_rgba(14,165,233,0.45),inset_0_1px_0_rgba(255,255,255,0.6)]',
    labelClass: 'text-cyan-100',
    digitGradient: 'linear-gradient(180deg, #FFFFFF 0%, #FB7185 45%, #38BDF8 100%)',
    digitGlow: 'drop-shadow(0 0 25px rgba(244,63,94,0.92))',
    beamGradient:
      'linear-gradient(110deg, transparent 10%, rgba(251,113,133,0.72) 42%, rgba(56,189,248,0.62) 60%, transparent 90%)',
    streakActiveClass:
      'border-cyan-200/90 bg-gradient-to-b from-rose-500/45 to-sky-500/40 text-white shadow-[0_0_30px_rgba(244,63,94,0.62)]',
    sparkColors: ['#FFFFFF', '#FB7185', '#38BDF8', '#FEF08A'],
  },
  astral_sovereign: {
    cardClass:
      'border-yellow-200 bg-gradient-to-b from-[#1E424C] via-[#122930] to-[#081318] shadow-[0_22px_58px_rgba(250,204,21,0.64),0_0_38px_rgba(16,185,129,0.48),0_0_20px_rgba(168,85,247,0.38),inset_0_1px_0_rgba(255,255,255,0.7)]',
    labelClass: 'text-yellow-100',
    digitGradient:
      'linear-gradient(180deg, #FFFFFF 0%, #FEF08A 32%, #6EE7B7 66%, #C084FC 100%)',
    digitGlow: 'drop-shadow(0 0 26px rgba(254,240,138,0.96))',
    beamGradient:
      'linear-gradient(110deg, transparent 10%, rgba(254,240,138,0.76) 36%, rgba(110,231,183,0.64) 54%, rgba(192,132,252,0.56) 68%, transparent 90%)',
    streakActiveClass:
      'border-yellow-200 bg-gradient-to-b from-yellow-400/45 via-emerald-500/35 to-purple-500/35 text-white shadow-[0_0_32px_rgba(250,204,21,0.68)]',
    sparkColors: ['#FFFFFF', '#FEF08A', '#6EE7B7', '#D8B4FE'],
  },
};

/** Returns stage-matched visual tokens for the Block Blast scoreboard header. */
export function getStageScoreVisual(stageId: StageThemeId): StageScoreVisual {
  return STAGE_SCORE_VISUALS[stageId] ?? STAGE_SCORE_VISUALS.timber;
}

/** Builds deterministic radial starlight spark specs around the score digits on point gain. */
export function buildScoreSparks(
  tier: ScorePulseTier,
  points: number,
  stageId: StageThemeId,
  stageTier = 1,
): ScoreSparkSpec[] {
  const baseCount =
    tier === 'allClear'
      ? 12
      : tier === 'combo' || tier === 'bomb'
        ? 8
        : tier === 'multi'
          ? 6
          : points >= 40
            ? 4
            : 0;
  if (baseCount === 0) return [];
  const tierBonus =
    stageTier >= 15 ? 8 : stageTier >= 11 ? 6 : stageTier >= 8 ? 4 : stageTier >= 6 ? 2 : 0;
  const count = baseCount + tierBonus;

  const colors = getStageScoreVisual(stageId).sparkColors;
  const sparks: ScoreSparkSpec[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const radiusX = 36 + (i % 3) * 14 + (tier === 'allClear' ? 14 : 0);
    const radiusY = 20 + (i % 2) * 10 + (tier === 'allClear' ? 8 : 0);
    sparks.push({
      id: i,
      dx: Math.round(Math.cos(angle) * radiusX),
      dy: Math.round(Math.sin(angle) * radiusY),
      sizePx: i % 2 === 0 ? 8 : 5,
      colorHex: colors[i % colors.length],
      delayMs: (i % 4) * 28,
      star: i % 2 === 0,
    });
  }
  return sparks;
}

/**
 * Determine visual celebration intensity for the scoreboard pulse from a move outcome.
 */
export function resolveScorePulseTier(
  outcome: Pick<
    MoveOutcome,
    'allClear' | 'stageUp' | 'clearedRows' | 'clearedCols' | 'streakAfter' | 'destroyedByBomb'
  >,
  source: 'place' | 'bomb',
): ScorePulseTier {
  if (outcome.allClear || outcome.stageUp) {
    return 'allClear';
  }
  if (source === 'bomb' || outcome.destroyedByBomb.length > 0) {
    return 'bomb';
  }
  const lineCount = outcome.clearedRows.length + outcome.clearedCols.length;
  if (lineCount > 0 && outcome.streakAfter >= 2) {
    return 'combo';
  }
  if (lineCount >= 2) {
    return 'multi';
  }
  return 'normal';
}

/**
 * Compute bounded roll animation duration scaled by points gained and move tier.
 */
export function computeRollDurationMs(
  delta: number,
  tier: ScorePulseTier,
): number {
  if (!Number.isFinite(delta) || delta <= 0) {
    return 0;
  }
  const tierBonus =
    tier === 'allClear'
      ? 80
      : tier === 'combo' || tier === 'bomb'
        ? 45
        : tier === 'multi'
          ? 25
          : 0;
  const raw = 240 + Math.min(220, Math.round(Math.sqrt(delta) * 11)) + tierBonus;
  return Math.min(580, raw);
}

/**
 * Ease-out cubic interpolation for the rolling scoreboard digit display.
 */
export function interpolateScoreCounter(
  fromScore: number,
  toScore: number,
  progress: number,
): number {
  if (!Number.isFinite(progress) || progress <= 0) {
    return Math.round(fromScore);
  }
  if (progress >= 1) {
    return Math.round(toScore);
  }
  const eased = 1 - Math.pow(1 - progress, 3);
  return Math.round(fromScore + (toScore - fromScore) * eased);
}

/**
 * Return true only once the player overtakes a non-zero prior personal best score.
 */
export function isBeatingBestScore(score: number, bestScore: number): boolean {
  return (
    Number.isFinite(score) &&
    Number.isFinite(bestScore) &&
    bestScore > 0 &&
    score > bestScore
  );
}
