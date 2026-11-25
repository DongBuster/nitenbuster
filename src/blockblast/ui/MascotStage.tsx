import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Compass, PawPrint, Sparkles } from 'lucide-react';
import { ANIMALS, type AnimalId, type Emotion } from '../../engine/types';
import { Character3D } from '../../scene3d/Character3D';
import { WinterCabinStage } from '../../scene3d/WinterCabinStage';
import { formatEquippedSummary } from '../../scene3d/accessoryCatalog';

export interface MascotStageProps {
  animal: AnimalId;
  accessories: readonly string[];
  emotion: Emotion;
  quip: string;
  paused: boolean;
  compact?: boolean;
}

interface MascotErrorBoundaryProps {
  resetKey: string;
  fallback: ReactNode;
  children: ReactNode;
}

interface MascotErrorBoundaryState {
  hasError: boolean;
}

export class MascotErrorBoundary extends Component<
  MascotErrorBoundaryProps,
  MascotErrorBoundaryState
> {
  state: MascotErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MascotErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: MascotErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally silent: falls back to the 2D plush mascot badge when WebGL fails
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const EMOTION_BADGE_LABELS: Record<Emotion, string> = {
  idle: 'Thư giãn',
  happy: 'Hào hứng',
  sad: 'Lo lắng',
  shock: 'Bất ngờ',
  win: 'Rực rỡ',
};

interface MascotFallbackProps {
  animalName: string;
  personality: string;
  accentHex: string;
  emotion: Emotion;
  equippedSummary: ReturnType<typeof formatEquippedSummary>;
  quip: string;
  compact: boolean;
}

function PlushMedallion({
  accentHex,
  sizeClass,
  iconClass,
}: {
  accentHex: string;
  sizeClass: string;
  iconClass: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center rounded-2xl border-2 border-white/25 shadow-lg ${sizeClass}`}
      style={{
        background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.42), transparent 56%), ${accentHex}`,
        boxShadow: `inset 0 -4px 0 rgba(0,0,0,0.22), 0 8px 20px rgba(0,0,0,0.45)`,
      }}
    >
      <PawPrint className={`text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] ${iconClass}`} />
    </div>
  );
}

function MascotPlushFallback({
  animalName,
  personality,
  accentHex,
  emotion,
  equippedSummary,
  quip,
  compact,
}: MascotFallbackProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 p-2.5">
        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-[#1a100b] p-1.5 shadow-inner">
          <PlushMedallion
            accentHex={accentHex}
            sizeClass="h-12 w-12"
            iconClass="h-6 w-6"
          />
          <span className="mt-1 text-[9px] font-extrabold tracking-wide text-amber-200/80">
            {EMOTION_BADGE_LABELS[emotion]}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-[#1a100b] px-2.5 py-0.5 text-xs font-black text-amber-50">
              <span
                className="h-2.5 w-2.5 rounded-full ring-1 ring-white/40"
                style={{ backgroundColor: accentHex }}
              />
              <span>{animalName}</span>
            </span>
            {equippedSummary && (
              <span
                title={equippedSummary.fullNames.join(', ')}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-950/85 px-2 py-0.5 text-[10px] font-bold text-emerald-200"
              >
                <Sparkles aria-hidden="true" className="h-2.5 w-2.5 text-emerald-400" />
                <span>
                  {equippedSummary.primaryName}
                  {equippedSummary.extraCount > 0 ? ` +${equippedSummary.extraCount}` : ''}
                </span>
              </span>
            )}
          </div>
          {quip && (
            <p className="rounded-xl border border-amber-500/25 bg-[#1a100b]/90 px-3 py-1.5 text-xs font-semibold leading-snug text-amber-50/95">
              {quip}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="relative flex min-h-[210px] flex-col items-center justify-center gap-3 overflow-hidden bg-[#1e120c] px-5 py-6 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background: `radial-gradient(circle at 50% 38%, ${accentHex}, transparent 68%)`,
          }}
        />
        <PlushMedallion
          accentHex={accentHex}
          sizeClass="relative z-10 h-20 w-20"
          iconClass="h-10 w-10"
        />
        <div className="relative z-10 flex flex-col items-center gap-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-[#24160f]/95 px-3.5 py-1 shadow-md">
            <span
              className="h-3 w-3 rounded-full ring-2 ring-white/40"
              style={{ backgroundColor: accentHex }}
            />
            <span className="text-sm font-black text-amber-50">{animalName}</span>
          </div>
          <span className="text-xs font-semibold text-amber-200/80">{personality}</span>
          {equippedSummary && (
            <span
              title={equippedSummary.fullNames.join(', ')}
              className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-950/90 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200"
            >
              <Sparkles aria-hidden="true" className="h-3 w-3 text-emerald-400" />
              <span>
                {equippedSummary.primaryName}
                {equippedSummary.extraCount > 0 ? ` +${equippedSummary.extraCount}` : ''}
              </span>
            </span>
          )}
        </div>
      </div>
      {quip && (
        <div className="border-t border-amber-900/45 bg-[#1b100a] px-4 py-3">
          <p className="rounded-2xl border border-amber-500/25 bg-[#26160e] px-3.5 py-2.5 text-sm font-semibold leading-snug text-amber-50/95 shadow-inner">
            “{quip}”
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Live 3D Winter Cabin mascot companion for Block Blast.
 * Pauses GPU rendering automatically when `paused` is true or the tab is hidden,
 * and falls back gracefully to a tactile 2D plush badge if WebGL fails.
 */
export function MascotStage({
  animal,
  accessories,
  emotion,
  quip,
  paused,
  compact = false,
}: MascotStageProps) {
  const [tabHidden, setTabHidden] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.hidden : false,
  );
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      setTabHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleCanvasCreated = useCallback((state: RootState) => {
    const canvas = state.gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    canvas.addEventListener('webglcontextlost', onLost, { once: true });
  }, []);

  const animalMeta = useMemo(
    () => ANIMALS.find((item) => item.id === animal) ?? ANIMALS[0],
    [animal],
  );
  const equippedSummary = useMemo(
    () => formatEquippedSummary(accessories),
    [accessories],
  );

  const frameloop = paused || tabHidden ? 'never' : 'always';

  const fallbackNode = (
    <MascotPlushFallback
      animalName={animalMeta.name}
      personality={animalMeta.personality}
      accentHex={animalMeta.accentHex}
      emotion={emotion}
      equippedSummary={equippedSummary}
      quip={quip}
      compact={compact}
    />
  );

  if (compact) {
    return (
      <aside
        aria-label="Bạn đồng hành 3D"
        className="w-full overflow-hidden rounded-2xl border border-amber-900/50 bg-[#24160f]/95 shadow-lg"
      >
        {contextLost ? (
          fallbackNode
        ) : (
          <MascotErrorBoundary resetKey={`${animal}:compact`} fallback={fallbackNode}>
            <div className="flex items-center gap-3 p-2.5">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-amber-500/30 bg-[#1a100b] shadow-inner">
                <Canvas
                  shadows
                  dpr={[1, 1.5]}
                  frameloop={frameloop}
                  gl={{
                    alpha: false,
                    antialias: true,
                    powerPreference: 'high-performance',
                  }}
                  camera={{ position: [0, 1.85, 4.5], fov: 40 }}
                  onCreated={handleCanvasCreated}
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
                      scale={1.35}
                    />
                  </Suspense>
                  <OrbitControls
                    enablePan={false}
                    enableZoom={false}
                    enableDamping
                    dampingFactor={0.07}
                    target={[0, 0.95, 0]}
                    maxPolarAngle={Math.PI / 2 - 0.08}
                  />
                </Canvas>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-[#1a100b] px-2.5 py-0.5 text-xs font-black text-amber-50">
                    <span
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-white/40"
                      style={{ backgroundColor: animalMeta.accentHex }}
                    />
                    <span>{animalMeta.name}</span>
                  </span>
                  {equippedSummary && (
                    <span
                      title={equippedSummary.fullNames.join(', ')}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-950/85 px-2 py-0.5 text-[10px] font-bold text-emerald-200"
                    >
                      <Sparkles aria-hidden="true" className="h-2.5 w-2.5 text-emerald-400" />
                      <span>
                        {equippedSummary.primaryName}
                        {equippedSummary.extraCount > 0 ? ` +${equippedSummary.extraCount}` : ''}
                      </span>
                    </span>
                  )}
                </div>
                {quip && (
                  <p className="rounded-xl border border-amber-500/25 bg-[#1a100b]/90 px-3 py-1.5 text-xs font-semibold leading-snug text-amber-50/95">
                    {quip}
                  </p>
                )}
              </div>
            </div>
          </MascotErrorBoundary>
        )}
      </aside>
    );
  }

  return (
    <aside
      aria-label="Bạn đồng hành 3D"
      className="flex w-full flex-col overflow-hidden rounded-3xl border-2 border-amber-900/50 bg-[#24160f] shadow-2xl"
    >
      {contextLost ? (
        fallbackNode
      ) : (
        <MascotErrorBoundary resetKey={`${animal}:desktop`} fallback={fallbackNode}>
          <div className="relative min-h-[210px] w-full flex-1 bg-[#24160f]">
            <Canvas
              shadows
              dpr={[1, 1.5]}
              frameloop={frameloop}
              gl={{
                alpha: false,
                antialias: true,
                powerPreference: 'high-performance',
              }}
              camera={{ position: [0, 2.0, 5.1], fov: 42 }}
              onCreated={handleCanvasCreated}
            >
              <color attach="background" args={['#24160f']} />
              <Suspense fallback={null}>
                <WinterCabinStage mode="turntable" />
                <Character3D
                  animal={animal}
                  emotion={emotion}
                  isActive
                  accessory={accessories}
                  position={[0, 0, 0]}
                  scale={1.35}
                />
              </Suspense>
              <OrbitControls
                enablePan={false}
                enableZoom={false}
                enableDamping
                dampingFactor={0.07}
                target={[0, 0.95, 0]}
                minDistance={3.2}
                maxDistance={7.5}
                maxPolarAngle={Math.PI / 2 - 0.08}
              />
            </Canvas>

            {/* Companion name and equipped accessories overlay */}
            <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
              <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-amber-400/30 bg-[#24160f]/90 px-3 py-1 shadow-md">
                <span
                  className="h-3 w-3 rounded-full ring-2 ring-white/40"
                  style={{ backgroundColor: animalMeta.accentHex }}
                />
                <span className="text-xs font-black text-amber-50 sm:text-sm">
                  {animalMeta.name}
                </span>
              </div>

              {equippedSummary && (
                <span
                  title={equippedSummary.fullNames.join(', ')}
                  className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-950/90 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200 shadow-sm"
                >
                  <Sparkles aria-hidden="true" className="h-3 w-3 text-emerald-400" />
                  <span>
                    {equippedSummary.primaryName}
                    {equippedSummary.extraCount > 0 ? ` +${equippedSummary.extraCount}` : ''}
                  </span>
                </span>
              )}
            </div>

            {/* Subtle 3D turntable cue */}
            <div className="pointer-events-none absolute bottom-2.5 right-3 inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-[#1a100b]/85 px-2.5 py-1 text-[10px] font-bold text-amber-200/80">
              <Compass aria-hidden="true" className="h-3 w-3 text-amber-400" />
              <span>Xoay 360°</span>
            </div>
          </div>

          {quip && (
            <div className="border-t border-amber-900/45 bg-[#1b100a] px-4 py-3">
              <p className="rounded-2xl border border-amber-500/25 bg-[#26160e] px-3.5 py-2.5 text-sm font-semibold leading-snug text-amber-50/95 shadow-inner">
                “{quip}”
              </p>
            </div>
          )}
        </MascotErrorBoundary>
      )}
    </aside>
  );
}
