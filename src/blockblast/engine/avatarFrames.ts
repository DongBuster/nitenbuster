import type { StageThemeId } from './stages.ts';

export type AvatarFrameId =
  | 'frame_stage_5'
  | 'frame_stage_10'
  | 'frame_stage_15'
  | 'frame_stage_20';

export interface AvatarFrameMeta {
  readonly id: AvatarFrameId;
  readonly name: string;
  readonly description: string;
  readonly requiredStage: 5 | 10 | 15 | 20;
  readonly stageThemeId: StageThemeId;
  readonly rarityLabel: string;
  readonly primaryHex: string;
  readonly secondaryHex: string;
  readonly glowRgba: string;
  readonly badgeClass: string;
}

export const AVATAR_FRAME_MILESTONE_STAGES = [5, 10, 15, 20] as const;

export const AVATAR_FRAMES: readonly AvatarFrameMeta[] = [
  {
    id: 'frame_stage_5',
    name: 'Khung Tinh Tú',
    description: 'Vòng sao chàm lam tỏa sáng 4 góc — phần thưởng đạt Stage 5.',
    requiredStage: 5,
    stageThemeId: 'celestial',
    rarityLabel: 'Hiếm',
    primaryHex: '#67E8F9',
    secondaryHex: '#A78BFA',
    glowRgba: 'rgba(103, 232, 249, 0.55)',
    badgeClass: 'border-cyan-300/60 bg-indigo-950/90 text-cyan-100',
  },
  {
    id: 'frame_stage_10',
    name: 'Khung Thái Cực Prism',
    description: 'Vòng lăng kính đa sắc đính đỉnh kim cương — phần thưởng đạt Stage 10.',
    requiredStage: 10,
    stageThemeId: 'prism_eternal',
    rarityLabel: 'Sử Thi',
    primaryHex: '#FDE047',
    secondaryHex: '#E879F9',
    glowRgba: 'rgba(232, 121, 249, 0.6)',
    badgeClass: 'border-fuchsia-300/70 bg-fuchsia-950/90 text-yellow-100',
  },
  {
    id: 'frame_stage_15',
    name: 'Khung Phượng Hoàng Lửa',
    description: 'Vòng lửa mặt trời kèm đôi cánh phượng hoàng rực cháy — phần thưởng đạt Stage 15.',
    requiredStage: 15,
    stageThemeId: 'solar_phoenix',
    rarityLabel: 'Huyền Thoại',
    primaryHex: '#FB923C',
    secondaryHex: '#FACC15',
    glowRgba: 'rgba(251, 146, 60, 0.68)',
    badgeClass: 'border-orange-300/75 bg-orange-950/90 text-amber-100',
  },
  {
    id: 'frame_stage_20',
    name: 'Khung Chí Tôn Ngân Hà',
    description: 'Vương miện thiên hà tối thượng cùng hào quang đôi — phần thưởng đạt Stage 20.',
    requiredStage: 20,
    stageThemeId: 'astral_sovereign',
    rarityLabel: 'Thần Thoại',
    primaryHex: '#FEF08A',
    secondaryHex: '#34D399',
    glowRgba: 'rgba(250, 204, 21, 0.78)',
    badgeClass: 'border-yellow-200/85 bg-emerald-950/95 text-yellow-100',
  },
];

const AVATAR_FRAME_MAP = new Map<AvatarFrameId, AvatarFrameMeta>(
  AVATAR_FRAMES.map((frame) => [frame.id, frame]),
);

export function isAvatarFrameId(value: unknown): value is AvatarFrameId {
  return typeof value === 'string' && AVATAR_FRAME_MAP.has(value as AvatarFrameId);
}

export function getAvatarFrameMeta(
  frameId: AvatarFrameId | null | undefined,
): AvatarFrameMeta | null {
  if (!frameId) return null;
  return AVATAR_FRAME_MAP.get(frameId) ?? null;
}

/** Returns all avatar frame IDs earned upon reaching a given Block Blast stage. */
export function getUnlockedAvatarFramesForStage(stage: number): AvatarFrameId[] {
  if (!Number.isFinite(stage) || stage < 5) return [];
  const safeStage = Math.floor(stage);
  return AVATAR_FRAMES.filter((frame) => safeStage >= frame.requiredStage).map(
    (frame) => frame.id,
  );
}

/** Returns the next locked avatar frame milestone, or null once all 4 frames are unlocked. */
export function getNextAvatarFrameMilestone(
  unlockedFrames: readonly AvatarFrameId[],
): AvatarFrameMeta | null {
  const unlockedSet = new Set(unlockedFrames);
  return AVATAR_FRAMES.find((frame) => !unlockedSet.has(frame.id)) ?? null;
}

export function sanitizeAvatarFrameList(raw: unknown): AvatarFrameId[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<AvatarFrameId>();
  const out: AvatarFrameId[] = [];
  for (const item of raw) {
    if (isAvatarFrameId(item) && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}
