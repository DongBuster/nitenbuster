import { useId } from 'react';
import { Check, Crown, Lock, Sparkles, X } from 'lucide-react';
import { playSfx } from '../../audio/soundEngine.ts';
import { AnimalAvatar } from '../../components/AnimalAvatar.tsx';
import type { AnimalId } from '../../engine/types.ts';
import {
  AVATAR_FRAMES,
  type AvatarFrameId,
} from '../engine/avatarFrames.ts';
import { NativeModalShell } from './BlockBlastModals.tsx';

export interface AvatarFramePickerModalProps {
  open: boolean;
  animal: AnimalId;
  bestStage: number;
  unlockedFrames: readonly AvatarFrameId[];
  equippedFrame: AvatarFrameId | null;
  onEquip: (frameId: AvatarFrameId | null) => void;
  onClose: () => void;
}

const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';

/**
 * Modal allowing players to inspect, equip, or remove Stage-milestone Avatar Frames
 * earned at Block Blast Stages 5, 10, 15, and 20.
 */
export function AvatarFramePickerModal({
  open,
  animal,
  bestStage,
  unlockedFrames,
  equippedFrame,
  onEquip,
  onClose,
}: AvatarFramePickerModalProps) {
  const titleId = useId();
  const descId = useId();
  const unlockedSet = new Set<AvatarFrameId>(unlockedFrames);

  return (
    <NativeModalShell
      open={open}
      titleId={titleId}
      describedById={descId}
      dialogClassName="m-auto max-h-[90dvh] w-[min(94vw,34rem)] overflow-y-auto rounded-3xl border-2 border-amber-400/45 bg-[#23140d] p-0 text-[#FFF9F0] shadow-2xl"
      onResult={() => onClose()}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-0.5 text-[11px] font-black text-amber-200">
              <Crown aria-hidden="true" className="h-3.5 w-3.5 text-yellow-300" />
              <span>Bộ Sưu Tập Khung Avatar · Kỷ lục Stage {bestStage}</span>
            </span>
            <h2 id={titleId} className="mt-2 font-display text-xl font-black text-amber-50">
              Khung Avatar Danh Hiệu
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              playSfx('click');
              onClose();
            }}
            aria-label="Đóng bảng khung avatar"
            className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-amber-800/60 bg-[#170d08] text-amber-200 hover:border-amber-400/60 ${FOCUS_RING_CLASS}`}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <p id={descId} className="text-xs leading-relaxed text-amber-100/80">
          Chinh phục các cột mốc <strong>Stage 5, 10, 15, 20</strong> bằng All Clear để mở khóa vĩnh viễn khung avatar. Khung đang đeo sẽ hiện trong Phòng Đấu, Bảng Xếp Hạng và Chat Online.
        </p>

        {/* Current Preview + Unequip */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-[#180e09] px-4 py-3">
          <div className="flex items-center gap-3.5">
            <AnimalAvatar animal={animal} size="xl" frameId={equippedFrame} />
            <div>
              <div className="text-xs font-extrabold text-amber-300/85">
                Đang trang bị
              </div>
              <div className="font-display text-base font-black text-white">
                {equippedFrame
                  ? AVATAR_FRAMES.find((f) => f.id === equippedFrame)?.name ?? 'Khung đặc biệt'
                  : 'Mặc định (Không khung)'}
              </div>
            </div>
          </div>

          {equippedFrame !== null && (
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                onEquip(null);
              }}
              className={`cursor-pointer rounded-xl border border-amber-800/60 bg-[#25150d] px-3 py-1.5 text-xs font-black text-amber-200 hover:border-amber-400/50 ${FOCUS_RING_CLASS}`}
            >
              Gỡ khung
            </button>
          )}
        </div>

        {/* 4 Milestone Frame Cards */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {AVATAR_FRAMES.map((frame) => {
            const isUnlocked = unlockedSet.has(frame.id);
            const isEquipped = equippedFrame === frame.id;

            return (
              <button
                key={frame.id}
                type="button"
                disabled={!isUnlocked}
                onClick={() => {
                  if (!isUnlocked) return;
                  playSfx('click');
                  onEquip(isEquipped ? null : frame.id);
                }}
                className={`flex flex-col items-start gap-2.5 rounded-2xl border-2 p-3.5 text-left transition-all ${FOCUS_RING_CLASS} ${
                  isEquipped
                    ? 'border-yellow-300/85 bg-amber-500/15 shadow-[0_0_20px_rgba(250,204,21,0.2)]'
                    : isUnlocked
                      ? 'cursor-pointer border-amber-500/30 bg-[#1a0f0a] hover:border-amber-300/60'
                      : 'cursor-not-allowed border-white/10 bg-[#140c08]/80 opacity-75'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="relative pl-1 pt-1">
                    <AnimalAvatar animal={animal} size="lg" frameId={frame.id} />
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${frame.badgeClass}`}
                  >
                    <Sparkles aria-hidden="true" className="h-2.5 w-2.5" />
                    <span>Stage {frame.requiredStage} · {frame.rarityLabel}</span>
                  </span>
                </div>

                <div>
                  <div className="text-sm font-black text-amber-50">
                    {frame.name}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-amber-100/70">
                    {frame.description}
                  </p>
                </div>

                <div className="mt-auto flex w-full items-center justify-between pt-1 text-[11px] font-black">
                  {isEquipped ? (
                    <span className="inline-flex items-center gap-1 text-yellow-200">
                      <Check aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>Đang đeo (Bấm để gỡ)</span>
                    </span>
                  ) : isUnlocked ? (
                    <span className="text-emerald-300">Đã mở khóa · Bấm để đeo</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-200/55">
                      <Lock aria-hidden="true" className="h-3 w-3" />
                      <span>Cần đạt Stage {frame.requiredStage}</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </NativeModalShell>
  );
}
