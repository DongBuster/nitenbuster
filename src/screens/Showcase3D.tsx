import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
  Sparkles,
} from '@react-three/drei';
import { Character3D } from '../scene3d/Character3D';
import { useGlbAvailability } from '../scene3d/GLBCharacter3D';
import { WinterCabinStage } from '../scene3d/WinterCabinStage';
import { Card3D } from '../scene3d/Card3D';
import { CardFan3D } from '../scene3d/CardFan3D';
import { AnimalAvatar } from '../components/AnimalAvatar';
import {
  ANIMALS,
  EMOTIONS,
  COLORS,
  type AnimalId,
  type Emotion,
  type Color,
  type CardType,
  type CardData,
} from '../engine/types';
import {
  CARD_META,
  COLOR_THEME,
  COLORED_CARD_TYPES,
  WILD_CARD_TYPES,
} from '../components/Card/cardMeta';

type StudioMode = 'lineup' | 'table' | 'character' | 'card';

const MODE_CAMERA: Record<
  StudioMode,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  lineup: { pos: [0, 2.35, 8.6], target: [0, 1.15, 0] },
  table: { pos: [0, 3.8, 7.6], target: [0, 0.7, 0] },
  character: { pos: [0, 2.0, 5.2], target: [0, 0.9, 0] },
  card: { pos: [0, 2.0, 5.2], target: [0, 1.35, 0] },
};

function ModeCameraRig({ mode }: { mode: StudioMode }) {
  const { camera } = useThree();
  useEffect(() => {
    const [x, y, z] = MODE_CAMERA[mode].pos;
    camera.position.set(x, y, z);
    camera.updateProjectionMatrix();
  }, [mode, camera]);
  return null;
}

const EMOTION_VI: Record<Emotion, string> = {
  idle: 'Bình thường',
  happy: 'Vui vẻ',
  sad: 'Buồn',
  shock: 'Sốc',
  win: 'Chiến thắng',
};

const TABLE_FAN_CARDS: CardData[] = [
  { id: 't-1', type: 'basic', color: 'pink', value: 7 },
  { id: 't-2', type: 'freeze', color: 'blue' },
  { id: 't-3', type: 'shovel', color: 'green' },
  { id: 't-4', type: 'taser' },
  { id: 't-5', type: 'boomerang', color: 'yellow' },
  { id: 't-6', type: 'bomb' },
  { id: 't-7', type: 'crossbow', color: 'pink' },
];

const DRAW_PILE_OFFSETS = [
  { rotZ: 0.04, dx: 0.0, dz: 0.0 },
  { rotZ: -0.05, dx: 0.01, dz: -0.01 },
  { rotZ: 0.03, dx: -0.01, dz: 0.01 },
  { rotZ: -0.02, dx: 0.0, dz: 0.0 },
  { rotZ: 0.06, dx: 0.01, dz: 0.01 },
  { rotZ: -0.03, dx: 0.0, dz: 0.0 },
];

const ALL_CARD_TYPES: CardType[] = [...COLORED_CARD_TYPES, ...WILD_CARD_TYPES];

function matchAnimalFromFilename(filename: string): AnimalId | null {
  const stem = filename
    .toLowerCase()
    .replace(/\.(glb|gltf)$/i, '')
    .trim();

  // Exact match first (e.g. "dog.glb" -> "dog")
  const exact = ANIMALS.find((a) => a.id === stem);
  if (exact) return exact.id;

  // Token/substring match (e.g. "paws_shark_v1.glb" -> "shark")
  const tokens = stem.split(/[^a-z0-9]+/).filter(Boolean);
  const byToken = ANIMALS.find((a) => tokens.includes(a.id));
  if (byToken) return byToken.id;

  return null;
}

export function Showcase3D() {
  const defaultAnimalId: AnimalId = ANIMALS[0].id;
  const [mode, setMode] = useState<StudioMode>('lineup');

  // Table mode state
  const [tableEmotion, setTableEmotion] = useState<Emotion>('idle');
  const [activeTableAnimal, setActiveTableAnimal] =
    useState<AnimalId>(defaultAnimalId);
  const [selectedFanId, setSelectedFanId] = useState<string | null>('t-4');
  const [flippedFanIds, setFlippedFanIds] = useState<string[]>([]);

  // Character mode state
  const [heroAnimal, setHeroAnimal] = useState<AnimalId>(defaultAnimalId);
  const [heroEmotion, setHeroEmotion] = useState<Emotion>('idle');
  const [heroActive, setHeroActive] = useState<boolean>(true);

  // Live GLB upload / drag-and-drop state
  const [customModels, setCustomModels] = useState<
    Partial<Record<AnimalId, string>>
  >({});
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [dropNotice, setDropNotice] = useState<string | null>(null);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const customModelsRef = useRef<Partial<Record<AnimalId, string>>>({});
  customModelsRef.current = customModels;

  // Card mode state
  const [heroCardType, setHeroCardType] = useState<CardType>('freeze');
  const [heroCardColor, setHeroCardColor] = useState<Color>('blue');
  const [heroCardNumber, setHeroCardNumber] = useState<number>(7);
  const [heroCardFaceDown, setHeroCardFaceDown] = useState<boolean>(false);
  const [heroCardUnplayable, setHeroCardUnplayable] = useState<boolean>(false);
  const [heroWildRing, setHeroWildRing] = useState<boolean>(false);
  const [grayscaleMode, setGrayscaleMode] = useState<boolean>(false);

  // Revoke all object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(customModelsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  // Auto-dismiss transient drop toast
  useEffect(() => {
    if (!dropNotice) return;
    const timer = window.setTimeout(() => setDropNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [dropNotice]);

  const heroAnimalMeta =
    ANIMALS.find((a) => a.id === heroAnimal) ?? ANIMALS[0];
  const activeTableAnimalMeta =
    ANIMALS.find((a) => a.id === activeTableAnimal) ?? ANIMALS[0];
  const heroCardMeta = CARD_META[heroCardType];
  const selectedFanCard = TABLE_FAN_CARDS.find((c) => c.id === selectedFanId);

  const hasPublicGlb = useGlbAvailability(heroAnimal);
  const hasCustomGlb = Boolean(customModels[heroAnimal]);
  const hasAnyGlb = hasCustomGlb || hasPublicGlb;

  const attachGlbFile = (targetAnimal: AnimalId, file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setCustomModels((prev) => {
      const oldUrl = prev[targetAnimal];
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }
      return { ...prev, [targetAnimal]: objectUrl };
    });
  };

  const clearCustomGlb = (targetAnimal: AnimalId) => {
    setCustomModels((prev) => {
      const oldUrl = prev[targetAnimal];
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }
      const next = { ...prev };
      delete next[targetAnimal];
      return next;
    });
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    attachGlbFile(heroAnimal, file);
    setDropNotice(`Đã nạp "${file.name}" cho ${heroAnimalMeta.name}!`);
    e.target.value = '';
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFile(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(glb|gltf)$/i.test(f.name),
    );
    if (files.length === 0) {
      setDropNotice('Vui lòng thả file định dạng .glb hoặc .gltf');
      return;
    }

    const fallbackAnimal =
      mode === 'table' ? activeTableAnimal : heroAnimal;
    const loadedNames: string[] = [];

    files.forEach((file) => {
      const matched = matchAnimalFromFilename(file.name) ?? fallbackAnimal;
      attachGlbFile(matched, file);
      const animalName =
        ANIMALS.find((a) => a.id === matched)?.name ?? matched;
      loadedNames.push(`${animalName} (${file.name})`);

      if (files.length === 1 && mode === 'character') {
        setHeroAnimal(matched);
      }
    });

    setDropNotice(`Đã nạp GLB 3D: ${loadedNames.join(', ')}`);
  };

  const handleFanCardSelect = (card: CardData) => {
    if (selectedFanId === card.id) {
      // Clicking an already-selected card toggles flip (front <-> back)
      setFlippedFanIds((prev) =>
        prev.includes(card.id)
          ? prev.filter((id) => id !== card.id)
          : [...prev, card.id],
      );
    } else {
      setSelectedFanId(card.id);
    }
  };

  const orbitTarget = MODE_CAMERA[mode].target;

  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-[#1D120C] text-[#FFF9F0] select-none"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input for .glb / .gltf upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Full-viewport 3D Canvas */}
      <div
        className={`h-full w-full bg-[radial-gradient(ellipse_at_top,_#4a3528_0%,_#2e2019_52%,_#1c130f_100%)] transition-[filter] duration-300 ${
          grayscaleMode && mode === 'card' ? 'grayscale' : ''
        }`}
      >
        <Canvas
          shadows
          dpr={[1, 1.5]}
          gl={{
            alpha: false,
            antialias: true,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl }) => {
            // Keep opaque WebGL canvas while ensuring offscreen ContactShadows targets clear to alpha 0
            gl.setClearAlpha(0);
          }}
          camera={{ position: [0, 3.8, 7.6], fov: 42 }}
        >
          <color attach="background" args={['#261810']} />
          <ModeCameraRig mode={mode} />
          <Suspense fallback={null}>
            {/* ===== MODE 0: 4x2 STUDIO LINEUP ===== */}
            {mode === 'lineup' && (
              <group name="studio-lineup-stage">
                {/* Warm Cozy Studio Lighting + Offline Environment for Velvet Plush Sheen */}
                <ambientLight intensity={0.72} color="#FFF6EA" />
                <hemisphereLight args={['#FFF8EE', '#5C3A21', 0.7]} />
                <directionalLight
                  position={[4, 7.5, 6.5]}
                  intensity={1.55}
                  color="#FFEBD2"
                  castShadow
                  shadow-mapSize={[1024, 1024]}
                  shadow-camera-left={-6}
                  shadow-camera-right={6}
                  shadow-camera-top={5}
                  shadow-camera-bottom={-5}
                  shadow-bias={-0.0004}
                />
                <directionalLight
                  position={[-3.5, 4.5, -5]}
                  intensity={1.15}
                  color="#FDE68A"
                />
                <pointLight
                  position={[-4.5, 2.5, 3.5]}
                  intensity={14}
                  distance={14}
                  decay={2}
                  color="#FF9F5A"
                />

                <Environment resolution={256} frames={1}>
                  <Lightformer
                    form="ring"
                    intensity={1.8}
                    position={[0, 6, 3]}
                    rotation={[Math.PI / 2, 0, 0]}
                    scale={10}
                    color="#FFF1D6"
                  />
                  <Lightformer
                    form="rect"
                    intensity={1.5}
                    position={[6, 3, 2]}
                    rotation={[0, -Math.PI / 2, 0]}
                    scale={[8, 4, 1]}
                    color="#FDE68A"
                  />
                  <Lightformer
                    form="rect"
                    intensity={1.2}
                    position={[-6, 3, 1]}
                    rotation={[0, Math.PI / 2, 0]}
                    scale={[8, 4, 1]}
                    color="#E0F2FE"
                  />
                </Environment>

                {/* Back Tiered Wooden Studio Riser (top at y = 0.88, z = -1.35) */}
                <group position={[0, 0, -1.35]}>
                  <mesh position={[0, 0.42, 0]} receiveShadow castShadow>
                    <boxGeometry args={[8.4, 0.84, 1.85]} />
                    <meshStandardMaterial
                      color="#7F4F24"
                      roughness={0.68}
                      metalness={0.04}
                    />
                  </mesh>
                  <mesh position={[0, 0.86, 0]} receiveShadow>
                    <boxGeometry args={[8.2, 0.04, 1.65]} />
                    <meshStandardMaterial color="#F5EBE0" roughness={0.9} />
                  </mesh>
                </group>

                {/* Front Tiered Wooden Studio Riser (top at y = 0.0, z = 1.15) */}
                <group position={[0, 0, 1.15]}>
                  <mesh position={[0, -0.22, 0]} receiveShadow castShadow>
                    <boxGeometry args={[8.4, 0.4, 1.85]} />
                    <meshStandardMaterial
                      color="#6B4226"
                      roughness={0.7}
                      metalness={0.04}
                    />
                  </mesh>
                  <mesh position={[0, -0.015, 0]} receiveShadow>
                    <boxGeometry args={[8.2, 0.03, 1.65]} />
                    <meshStandardMaterial color="#F5EBE0" roughness={0.9} />
                  </mesh>
                </group>

                <ContactShadows
                  position={[0, 0.008, 1.15]}
                  frames={1}
                  resolution={256}
                  opacity={0.38}
                  scale={[8.0, 1.55]}
                  blur={2}
                  far={2.2}
                  color="#3B2314"
                />
                <ContactShadows
                  position={[0, 0.888, -1.35]}
                  frames={1}
                  resolution={256}
                  opacity={0.38}
                  scale={[8.0, 1.55]}
                  blur={2}
                  far={2.2}
                  color="#3B2314"
                />

                <Sparkles
                  count={36}
                  scale={[10, 4.5, 6]}
                  position={[0, 2.2, 0]}
                  size={2.2}
                  speed={0.28}
                  opacity={0.42}
                  color="#FFF7ED"
                />

                {/* 4x2 Lineup facing straight forward (+Z): Top row 0..3, Front row 4..7 */}
                {ANIMALS.map((animal, idx) => {
                  const row = Math.floor(idx / 4); // 0 = back/top, 1 = front/bottom
                  const col = idx % 4;
                  const x = [-2.55, -0.85, 0.85, 2.55][col];
                  const y = row === 0 ? 0.88 : 0.0;
                  const z = row === 0 ? -1.35 : 1.15;

                  return (
                    <Character3D
                      key={animal.id}
                      animal={animal.id}
                      emotion={tableEmotion}
                      isActive={false}
                      modelUrl={customModels[animal.id]}
                      position={[x, y, z]}
                      rotation={[0, 0, 0]}
                      scale={0.96}
                      onClick={() => {
                        setHeroAnimal(animal.id);
                        setMode('character');
                      }}
                    />
                  );
                })}
              </group>
            )}

            {/* ===== MODE 1: 3D TABLE ===== */}
            {mode === 'table' && (
              <>
                <WinterCabinStage mode="table" />

                {/* 8 Animated 3D Characters around the round table (offset by PI/8 so foreground CardFan3D never blocks a front animal) */}
                {ANIMALS.map((animal, idx) => {
                  const angle = (idx / ANIMALS.length) * Math.PI * 2 + Math.PI / 8;
                  const radius = 3.15;
                  const x = Math.sin(angle) * radius;
                  const z = Math.cos(angle) * radius;
                  return (
                    <Character3D
                      key={animal.id}
                      animal={animal.id}
                      emotion={tableEmotion}
                      isActive={activeTableAnimal === animal.id}
                      modelUrl={customModels[animal.id]}
                      position={[x, 0, z]}
                      rotation={[0, angle + Math.PI, 0]}
                      scale={0.86}
                      onClick={() => setActiveTableAnimal(animal.id)}
                    />
                  );
                })}

                {/* Center Draw Pile (stack of faceDown Card3Ds) */}
                <group position={[-0.78, 0.02, -0.15]}>
                  {DRAW_PILE_OFFSETS.map((layer, i) => (
                    <Card3D
                      key={i}
                      type="basic"
                      color="blue"
                      value={0}
                      faceDown
                      scale={0.78}
                      hoverLift={false}
                      position={[layer.dx, i * 0.036, layer.dz]}
                      rotation={[-Math.PI / 2, 0, layer.rotZ]}
                    />
                  ))}
                </group>

                {/* Center Discard Pile (face-up Card3D) */}
                <group position={[0.78, 0.02, -0.05]}>
                  <Card3D
                    type="shovel"
                    color="green"
                    scale={0.78}
                    hoverLift={false}
                    position={[-0.04, 0.02, 0.03]}
                    rotation={[-Math.PI / 2, 0, -0.18]}
                  />
                  <Card3D
                    type={selectedFanCard?.type ?? 'freeze'}
                    color={selectedFanCard?.color ?? 'blue'}
                    value={selectedFanCard?.value}
                    activeWildColor={
                      selectedFanCard && CARD_META[selectedFanCard.type].isWild
                        ? 'pink'
                        : undefined
                    }
                    scale={0.78}
                    hoverLift={false}
                    position={[0, 0.065, 0]}
                    rotation={[-Math.PI / 2, 0, 0.14]}
                  />
                </group>

                {/* 3D Fanned Hand floating in lower foreground facing camera (+Z) */}
                <CardFan3D
                  cards={TABLE_FAN_CARDS}
                  selectedId={selectedFanId}
                  faceDownIds={flippedFanIds}
                  onSelectCard={handleFanCardSelect}
                  position={[0, 0.85, 3.55]}
                  rotation={[-0.28, 0, 0]}
                  scale={0.74}
                  spreadAngle={0.68}
                  radius={4.0}
                />
              </>
            )}

            {/* ===== MODE 2: 3D CHARACTER TURNTABLE ===== */}
            {mode === 'character' && (
              <>
                <WinterCabinStage mode="turntable" />
                <Character3D
                  animal={heroAnimal}
                  emotion={heroEmotion}
                  isActive={heroActive}
                  modelUrl={customModels[heroAnimal]}
                  position={[0, 0, 0]}
                  scale={1.45}
                />
              </>
            )}

            {/* ===== MODE 3: 3D CARD TURNTABLE ===== */}
            {mode === 'card' && (
              <>
                <WinterCabinStage mode="turntable" />
                <Card3D
                  type={heroCardType}
                  color={heroCardMeta.isWild ? undefined : heroCardColor}
                  value={heroCardType === 'basic' ? heroCardNumber : undefined}
                  faceDown={heroCardFaceDown}
                  playable={!heroCardUnplayable}
                  activeWildColor={
                    heroCardMeta.isWild && heroWildRing
                      ? heroCardColor
                      : undefined
                  }
                  position={[0, 1.45, 0]}
                  scale={1.75}
                  hoverLift
                  onClick={() => setHeroCardFaceDown((prev) => !prev)}
                />
              </>
            )}
          </Suspense>

          <OrbitControls
            makeDefault
            target={orbitTarget}
            enableDamping
            dampingFactor={0.07}
            minDistance={2.8}
            maxDistance={13.5}
            maxPolarAngle={Math.PI / 2 - 0.06}
          />
        </Canvas>
      </div>

      {/* Drag-and-Drop Visual Overlay */}
      {isDraggingFile && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#1A0F0A]/75 backdrop-blur-sm">
          <div className="mx-4 flex max-w-md flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-amber-300 bg-[#2C1B11]/90 px-8 py-7 text-center shadow-2xl">
            <span aria-hidden="true" className="text-4xl">
              📦
            </span>
            <p className="font-display text-lg font-extrabold text-amber-200">
              Thả file .glb / .gltf vào đây để xem trực tiếp 3D!
            </p>
            <p className="text-xs font-medium text-amber-100/80">
              Tự động nhận diện theo tên file (dog.glb, shark.glb, dino.glb...)
              hoặc gắn vào nhân vật đang chọn.
            </p>
          </div>
        </div>
      )}

      {/* Drop / Upload Toast Notice */}
      {dropNotice && (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full border border-emerald-300/40 bg-emerald-950/90 px-4 py-2 text-xs font-bold text-emerald-100 shadow-xl backdrop-blur-md"
        >
          ✨ {dropNotice}
        </div>
      )}

      {/* ================= TOP-LEFT STUDIO HEADER & MODE SWITCHER ================= */}
      <div className="pointer-events-none fixed inset-x-3 top-14 z-40 flex flex-col gap-2 sm:left-4 sm:right-auto sm:top-4 sm:max-w-[calc(100vw-15rem)] sm:gap-2.5 sm:pr-4">
        <div className="pointer-events-auto inline-flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-amber-900/40 bg-[#26170F]/90 px-3 py-2 shadow-xl backdrop-blur-md sm:px-3.5">
          <div className="flex items-center gap-2 pr-1">
            <span className="font-display text-sm font-black tracking-tight text-[#FFFBF4] sm:text-base">
              PAWS 3D Studio
            </span>
          </div>

          <div
            role="tablist"
            aria-label="Chế độ 3D Studio"
            className="flex flex-wrap items-center gap-1 rounded-xl bg-black/40 p-1"
          >
            {(
              [
                { id: 'lineup', label: 'Đội Hình 8 Con' },
                { id: 'table', label: 'Bàn Chơi 3D' },
                { id: 'character', label: 'Soi Nhân Vật' },
                { id: 'card', label: 'Soi Thẻ Bài' },
              ] as { id: StudioMode; label: string }[]
            ).map((tab) => {
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(tab.id)}
                  className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 sm:px-3 sm:text-xs ${
                    active
                      ? 'bg-amber-400 text-[#2C1B11] shadow-sm'
                      : 'text-amber-100/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <p className="hidden text-[11px] font-semibold text-amber-100/70 drop-shadow-sm sm:block">
          Kéo chuột để xoay 360° · Cuộn để phóng to/thu nhỏ
          {mode === 'card'
            ? ' · Bấm trực tiếp vào lá bài để lật 180°'
            : ' · Kéo thả file .glb vào màn hình để xem model thật'}
        </p>
      </div>

      {/* ================= BOTTOM FLOATING HUD ================= */}
      <div className="safe-bottom-bar pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center sm:px-6 sm:pb-4">
        {/* HUD: LINEUP MODE */}
        {mode === 'lineup' && (
          <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-2.5 rounded-3xl border border-amber-200/20 bg-[#26170F]/82 px-4 py-3 shadow-2xl backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-extrabold text-amber-200">
                👥 Đội hình 4×2 đối chiếu trực diện (8 Nhân vật Plush 3D)
              </span>
              <span className="text-[11px] font-medium text-amber-100/80">
                Bấm vào bất kỳ nhân vật nào để soi cận cảnh 360°
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-200/80">
                Biểu cảm cả đội hình:
              </span>
              {EMOTIONS.map((em) => {
                const active = tableEmotion === em;
                return (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setTableEmotion(em)}
                    aria-pressed={active}
                    className={`cursor-pointer rounded-xl border px-3 py-1 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      active
                        ? 'border-amber-300 bg-amber-400 text-[#2C1B11] shadow-xs'
                        : 'border-white/15 bg-white/8 text-amber-50 hover:bg-white/15'
                    }`}
                  >
                    {EMOTION_VI[em]} ({em})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* HUD: TABLE MODE */}
        {mode === 'table' && (
          <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-2.5 rounded-3xl border border-amber-200/20 bg-[#26170F]/82 px-4 py-3 shadow-2xl backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="inline-flex items-center gap-2 font-bold text-amber-200">
                <AnimalAvatar animal={activeTableAnimalMeta.id} size="xs" />
                <span>
                  Đang tới lượt: <strong>{activeTableAnimalMeta.name}</strong> (
                  {activeTableAnimalMeta.personality})
                </span>
              </div>
              <span className="text-[11px] font-medium text-amber-100/75">
                Bấm nhân vật để đổi lượt · Thả file .glb (vd: dog.glb) để thay model trên bàn
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-200/80">
                Biểu cảm cả bàn:
              </span>
              {EMOTIONS.map((em) => {
                const active = tableEmotion === em;
                return (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setTableEmotion(em)}
                    aria-pressed={active}
                    className={`cursor-pointer rounded-xl border px-3 py-1 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      active
                        ? 'border-amber-300 bg-amber-400 text-[#2C1B11] shadow-xs'
                        : 'border-white/15 bg-white/8 text-amber-50 hover:bg-white/15'
                    }`}
                  >
                    {EMOTION_VI[em]} ({em})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* HUD: CHARACTER MODE */}
        {mode === 'character' && (
          <div className="pointer-events-auto flex w-full max-w-4xl flex-col gap-3 rounded-3xl border border-amber-200/20 bg-[#26170F]/85 p-4 shadow-2xl backdrop-blur-md">
            {/* Bio & GLB Upload + Active toggle row */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <AnimalAvatar animal={heroAnimalMeta.id} size="sm" />
                <h2 className="text-lg font-extrabold text-[#FFFBF4]">
                  {heroAnimalMeta.name}
                </h2>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-amber-200">
                  Màu: {heroAnimalMeta.colorLabel}
                </span>
                <span className="text-xs font-medium text-amber-100/85">
                  · {heroAnimalMeta.personality}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* GLB Status Badge */}
                {hasAnyGlb ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-extrabold text-emerald-200">
                    <span>GLB 3D ✓</span>
                    {hasCustomGlb && (
                      <button
                        type="button"
                        onClick={() => clearCustomGlb(heroAnimal)}
                        className="ml-0.5 cursor-pointer rounded-full bg-emerald-950/70 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100 hover:bg-rose-600/80 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"
                      >
                        Bỏ chọn
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-200">
                    3D tạm — thả file .glb vào đây để xem thật
                  </span>
                )}

                {/* File picker button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer rounded-xl border border-emerald-300/40 bg-emerald-600/85 px-3 py-1.5 text-xs font-extrabold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  📦 Nạp file .glb cho {heroAnimalMeta.name}
                </button>

                {/* isActive toggle */}
                <button
                  type="button"
                  onClick={() => setHeroActive((v) => !v)}
                  aria-pressed={heroActive}
                  className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-extrabold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    heroActive
                      ? 'border-amber-300 bg-amber-400/20 text-amber-200 shadow-xs'
                      : 'border-white/15 bg-white/8 text-amber-100/80 hover:bg-white/15'
                  }`}
                >
                  {heroActive ? '✨ ' : ''}Đang tới lượt (isActive)
                </button>
              </div>
            </div>

            {/* 8 Animal Selector */}
            <div className="flex flex-wrap items-center gap-1.5">
              {ANIMALS.map((a) => {
                const active = heroAnimal === a.id;
                const hasCustom = Boolean(customModels[a.id]);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setHeroAnimal(a.id)}
                    aria-pressed={active}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      active
                        ? 'border-amber-300 bg-amber-400 text-[#2C1B11] shadow-xs'
                        : 'border-white/12 bg-white/8 text-amber-50 hover:bg-white/15'
                    }`}
                  >
                    <AnimalAvatar animal={a.id} size="xs" />
                    <span>{a.name}</span>
                    {hasCustom && (
                      <span
                        title="Đã nạp file .glb"
                        className="rounded bg-emerald-600 px-1 text-[9px] font-extrabold text-white"
                      >
                        GLB
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 5 Emotion Selector */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-200/75">
                Biểu cảm:
              </span>
              {EMOTIONS.map((em) => {
                const active = heroEmotion === em;
                return (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setHeroEmotion(em)}
                    aria-pressed={active}
                    className={`cursor-pointer rounded-xl border px-3 py-1 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      active
                        ? 'border-sky-300 bg-sky-400 text-slate-950 shadow-xs'
                        : 'border-white/12 bg-white/8 text-amber-50 hover:bg-white/15'
                    }`}
                  >
                    {EMOTION_VI[em]} ({em})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* HUD: CARD MODE */}
        {mode === 'card' && (
          <div className="pointer-events-auto flex w-full max-w-5xl flex-col gap-3 rounded-3xl border border-amber-200/20 bg-[#26170F]/86 p-4 shadow-2xl backdrop-blur-md">
            {/* Header info + quick toggles */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold text-[#FFFBF4]">
                  {heroCardMeta.name}
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    heroCardMeta.isWild
                      ? 'bg-purple-500/30 text-purple-200 ring-1 ring-purple-400/50'
                      : 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/40'
                  }`}
                >
                  {heroCardMeta.isWild ? 'Wild' : 'Lá màu'} · {heroCardMeta.phase}
                </span>
                <span className="hidden text-xs font-medium text-amber-100/80 md:inline">
                  — {heroCardMeta.description}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHeroCardFaceDown((v) => !v)}
                  aria-pressed={heroCardFaceDown}
                  className={`cursor-pointer rounded-xl border px-2.5 py-1 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    heroCardFaceDown
                      ? 'border-sky-300 bg-sky-400 text-slate-950'
                      : 'border-white/15 bg-white/8 text-amber-50 hover:bg-white/15'
                  }`}
                >
                  🔄 Lật mặt sau
                </button>

                <button
                  type="button"
                  onClick={() => setHeroCardUnplayable((v) => !v)}
                  aria-pressed={heroCardUnplayable}
                  className={`cursor-pointer rounded-xl border px-2.5 py-1 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    heroCardUnplayable
                      ? 'border-rose-400 bg-rose-500/30 text-rose-100'
                      : 'border-white/15 bg-white/8 text-amber-50 hover:bg-white/15'
                  }`}
                >
                  🚫 Không hợp lệ (50%)
                </button>

                <button
                  type="button"
                  onClick={() => setGrayscaleMode((v) => !v)}
                  aria-pressed={grayscaleMode}
                  className={`cursor-pointer rounded-xl border px-2.5 py-1 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    grayscaleMode
                      ? 'border-slate-300 bg-slate-200 text-slate-950'
                      : 'border-white/15 bg-white/8 text-amber-50 hover:bg-white/15'
                  }`}
                >
                  👁️ Giả lập mù màu (Grayscale)
                </button>
              </div>
            </div>

            {/* 11 Card Types Picker */}
            <div className="flex flex-wrap items-center gap-1.5">
              {ALL_CARD_TYPES.map((ct) => {
                const meta = CARD_META[ct];
                const active = heroCardType === ct;
                return (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setHeroCardType(ct)}
                    aria-pressed={active}
                    className={`cursor-pointer rounded-xl border px-2.5 py-1 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      active
                        ? meta.isWild
                          ? 'border-purple-300 bg-purple-500 text-white shadow-xs'
                          : 'border-amber-300 bg-amber-400 text-[#2C1B11] shadow-xs'
                        : 'border-white/12 bg-white/8 text-amber-50 hover:bg-white/15'
                    }`}
                  >
                    {meta.name}
                  </button>
                );
              })}
            </div>

            {/* Color picker + Basic 0-9 slider / Wild ring toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-200/75">
                  {heroCardMeta.isWild ? 'Màu viền Wild:' : 'Màu thẻ:'}
                </span>
                {COLORS.map((c) => {
                  const theme = COLOR_THEME[c];
                  const active = heroCardColor === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setHeroCardColor(c);
                        if (heroCardMeta.isWild) {
                          setHeroWildRing(true);
                        }
                      }}
                      aria-pressed={active}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-extrabold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                        active
                          ? 'scale-[1.03] shadow-sm'
                          : 'border-white/15 bg-white/8 text-amber-50 hover:bg-white/15'
                      }`}
                      style={
                        active
                          ? {
                              backgroundColor: theme.pillBg,
                              borderColor: theme.light,
                              color: theme.pillText,
                            }
                          : undefined
                      }
                    >
                      <span>
                        {theme.label} {theme.shapeSymbol}
                      </span>
                    </button>
                  );
                })}

                {heroCardMeta.isWild && (
                  <button
                    type="button"
                    onClick={() => setHeroWildRing((v) => !v)}
                    aria-pressed={heroWildRing}
                    className={`ml-1 cursor-pointer rounded-xl border px-2.5 py-1 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      heroWildRing
                        ? 'border-purple-300 bg-purple-600 text-white'
                        : 'border-white/15 bg-white/8 text-amber-100/80 hover:bg-white/15'
                    }`}
                  >
                    {heroWildRing ? '✨ Đang bật viền màu' : 'Tắt viền màu'}
                  </button>
                )}
              </div>

              {heroCardType === 'basic' && (
                <label className="inline-flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/8 px-3 py-1 text-xs font-bold text-amber-100">
                  <span>Số (0–9):</span>
                  <input
                    type="range"
                    min={0}
                    max={9}
                    step={1}
                    value={heroCardNumber}
                    onChange={(e) => setHeroCardNumber(Number(e.target.value))}
                    className="h-1.5 w-28 cursor-pointer accent-amber-400"
                  />
                  <span className="w-4 text-center text-sm font-extrabold text-amber-300">
                    {heroCardNumber}
                  </span>
                </label>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
