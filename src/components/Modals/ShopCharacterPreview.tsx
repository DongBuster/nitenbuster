import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Compass, Sparkles } from 'lucide-react';
import type { AnimalId, Emotion } from '../../engine/types';
import { Character3D } from '../../scene3d/Character3D';
import { WinterCabinStage } from '../../scene3d/WinterCabinStage';
import { playSfx } from '../../audio/soundEngine';

const SHOP_PREVIEW_EMOTIONS: { id: Emotion; label: string }[] = [
  { id: 'idle', label: 'Bình thường' },
  { id: 'happy', label: 'Vui vẻ' },
  { id: 'win', label: 'Chiến thắng' },
];

export interface ShopCharacterPreviewProps {
  animal: AnimalId;
  animalName: string;
  accentHex: string;
  accessories: string[];
  equippedLabel: string | null;
  previewItemName?: string | null;
}

/**
 * Interactive 3D preview inside CookieShopModal so players can combine multiple
 * accessories and test character animations without closing the shop.
 */
export function ShopCharacterPreview({
  animal,
  animalName,
  accentHex,
  accessories,
  equippedLabel,
  previewItemName = null,
}: ShopCharacterPreviewProps) {
  const [emotion, setEmotion] = useState<Emotion>('idle');

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-amber-900/50 bg-[#1a100b] shadow-inner">
      <div className="relative h-60 w-full sm:h-64">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          gl={{
            alpha: false,
            antialias: true,
            powerPreference: 'high-performance',
          }}
          camera={{ position: [0, 2.05, 5.4], fov: 42 }}
        >
          <color attach="background" args={['#1a100b']} />
          <Suspense fallback={null}>
            <WinterCabinStage mode="turntable" />
            <Character3D
              animal={animal}
              emotion={emotion}
              isActive
              accessory={accessories}
              position={[0, 0, 0]}
              scale={1.16}
            />
          </Suspense>
          <OrbitControls
            enablePan={false}
            enableDamping
            dampingFactor={0.07}
            target={[0, 1.0, 0]}
            minDistance={3.2}
            maxDistance={7.5}
            maxPolarAngle={Math.PI / 2 - 0.08}
          />
        </Canvas>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-amber-400/30 bg-[#24160f]/90 px-2.5 py-1 text-xs font-black text-amber-50 shadow-md">
            <span
              className="h-2.5 w-2.5 rounded-full ring-1 ring-white/40"
              style={{ backgroundColor: accentHex }}
            />
            <span>{animalName}</span>
          </div>
          {equippedLabel && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-950/90 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200 shadow-sm">
              <Sparkles className="h-3 w-3 shrink-0" />
              <span>{equippedLabel}</span>
            </span>
          )}
          {previewItemName && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-sky-400/40 bg-sky-950/90 px-2.5 py-0.5 text-[11px] font-bold text-sky-200 shadow-sm">
              <Sparkles className="h-3 w-3 shrink-0" />
              <span>Thử: {previewItemName}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-900/40 bg-[#140c08] px-3 py-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-200/75">
          <Compass className="h-3.5 w-3.5 text-amber-400" />
          <span>Xoay 360°</span>
        </span>
        <div className="flex items-center gap-1">
          {SHOP_PREVIEW_EMOTIONS.map((em) => (
            <button
              key={em.id}
              type="button"
              onClick={() => {
                playSfx('click');
                setEmotion(em.id);
              }}
              aria-pressed={emotion === em.id}
              className={`cursor-pointer rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                emotion === em.id
                  ? 'btn-tactile-amber'
                  : 'bg-white/8 text-amber-100 hover:bg-white/16'
              }`}
            >
              {em.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
