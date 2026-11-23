import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Boxes,
  Compass,
  Cookie,
  Eye,
  EyeOff,
  Globe,
  GraduationCap,
  Music,
  Settings as SettingsIcon,
  ShoppingBag,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ANIMALS,
  type BotDifficulty,
  type Emotion,
  type GameDeckMode,
} from '../engine/types';
import { Character3D } from '../scene3d/Character3D';
import { WinterCabinStage } from '../scene3d/WinterCabinStage';
import { CookieShopModal, RulesModal } from '../components/Modals/RulesModal';
import { TutorialOverlay } from '../components/Modals/TutorialOverlay';
import { SHOP_ITEMS, useProfileStore } from '../store/profileStore';
import { playSfx, setAudioPreferences } from '../audio/soundEngine';

export interface MainMenuScreenProps {
  onStartGame: () => void;
  onOpenOnline: () => void;
  onOpenStudio3D: () => void;
  onBackToModeSelect?: () => void;
}

const BOT_COUNTS = [3, 4, 5, 6, 7] as const;

const DIFFICULTIES: { id: BotDifficulty; label: string }[] = [
  { id: 'easy', label: 'Dễ' },
  { id: 'medium', label: 'Vừa' },
  { id: 'hard', label: 'Khó' },
];

const DECK_MODES: { id: GameDeckMode; label: string; desc: string }[] = [
  { id: 'mvp', label: 'Cơ Bản', desc: '112 lá MVP (6 loại hiệu ứng)' },
  { id: 'full', label: 'Đầy Đủ', desc: '122 lá Full (11 loại hiệu ứng)' },
];

const PREVIEW_EMOTIONS: { id: Emotion; label: string }[] = [
  { id: 'idle', label: 'Bình thường' },
  { id: 'happy', label: 'Vui vẻ' },
  { id: 'win', label: 'Chiến thắng' },
];

export function MainMenuScreen({
  onStartGame,
  onOpenOnline,
  onOpenStudio3D,
  onBackToModeSelect,
}: MainMenuScreenProps) {
  const {
    cookies,
    gamesPlayed,
    gamesWon,
    selectedAnimal,
    equippedAccessory,
    settings,
    selectAnimal,
    updateSettings,
  } = useProfileStore();

  const [previewEmotion, setPreviewEmotion] = useState<Emotion>('idle');
  const [showRules, setShowRules] = useState<boolean>(false);
  const [showShop, setShowShop] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);

  const selectedMeta =
    ANIMALS.find((a) => a.id === selectedAnimal) ?? ANIMALS[0];
  const equippedId = equippedAccessory[selectedAnimal] ?? null;
  const equippedItem = SHOP_ITEMS.find((i) => i.id === equippedId) ?? null;

  const toggleSfx = () => {
    const next = !settings.sfxEnabled;
    updateSettings({ sfxEnabled: next });
    setAudioPreferences({ sfxEnabled: next });
    if (next) playSfx('click');
  };

  const toggleBgm = () => {
    const next = !settings.bgmEnabled;
    updateSettings({ bgmEnabled: next });
    setAudioPreferences({ bgmEnabled: next });
    playSfx('click');
  };

  return (
    <div className="min-h-screen bg-[#1c120c] bg-[radial-gradient(circle_at_50%_0%,_#382419_0%,_#1a0f0a_70%)] text-[#FFF9F0] selection:bg-amber-300 selection:text-[#2C1B11]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col justify-between px-4 pb-8 pt-12 sm:px-6 lg:px-8">
        {/* Top Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {onBackToModeSelect && (
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  onBackToModeSelect();
                }}
                className="btn-tactile-wood inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-amber-900/50 px-3.5 py-2 text-xs font-extrabold text-amber-100 shadow-md transition-colors focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-amber-300" />
                <span>Đổi Chế Độ</span>
              </button>
            )}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-950/70 px-3.5 py-1 text-xs font-bold tracking-wide text-amber-200">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Winter Cabin · PAWS Cards 3D</span>
              </div>
              <h1 className="mt-1.5 font-display text-3xl font-black tracking-tight text-[#FFFBF4] sm:text-4xl">
                Sảnh Chờ Đấu Bài
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-[#29170f]/90 px-4 py-2 text-sm font-black text-amber-200 shadow-md">
              <Cookie className="h-4 w-4 text-amber-400" />
              <span>{cookies.toLocaleString()} Cookies</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-900/50 bg-[#29170f]/90 px-4 py-2 text-xs font-bold text-amber-100/90 shadow-md">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span>
                {gamesWon} thắng / {gamesPlayed} ván
              </span>
            </div>
          </div>
        </header>

        {/* Main 2-Column Hero Grid */}
        <main className="grid flex-1 grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          {/* LEFT: Live 3D Character Stage */}
          <section
            aria-label="Xem trước nhân vật 3D"
            className="relative flex min-h-[400px] flex-col overflow-hidden rounded-3xl border-2 border-amber-900/40 bg-[#24160f] shadow-2xl lg:col-span-5"
          >
            <div className="relative flex-1">
              <Canvas
                shadows
                dpr={[1, 1.5]}
                gl={{
                  alpha: false,
                  antialias: true,
                  powerPreference: 'high-performance',
                }}
                camera={{ position: [0, 1.9, 4.7], fov: 40 }}
              >
                <color attach="background" args={['#24160f']} />
                <Suspense fallback={null}>
                  <WinterCabinStage mode="turntable" />
                  <Character3D
                    animal={selectedAnimal}
                    emotion={previewEmotion}
                    isActive
                    accessory={equippedAccessory[selectedAnimal] ?? null}
                    position={[0, 0, 0]}
                    scale={1.45}
                  />
                </Suspense>
                <OrbitControls
                  enablePan={false}
                  enableDamping
                  dampingFactor={0.07}
                  target={[0, 0.85, 0]}
                  minDistance={3.2}
                  maxDistance={7.5}
                  maxPolarAngle={Math.PI / 2 - 0.08}
                />
              </Canvas>

              {/* Character info overlay */}
              <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1.5">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-[#24160f]/90 px-3.5 py-1.5 shadow-md">
                  <span
                    className="h-3.5 w-3.5 rounded-full ring-2 ring-white/40"
                    style={{ backgroundColor: selectedMeta.accentHex }}
                  />
                  <span className="text-sm font-black text-[#FFFBF4]">
                    {selectedMeta.name}
                  </span>
                </div>
                <span className="text-xs font-semibold text-amber-200/80 drop-shadow-sm">
                  {selectedMeta.personality}
                </span>
                {equippedItem && (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-950/85 px-3 py-1 text-[11px] font-bold text-emerald-200">
                    <Sparkles className="h-3 w-3 text-emerald-400" />
                    <span>{equippedItem.name}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Bottom preview emotion bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-900/40 bg-[#1c110a] px-4 py-2.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-200/75">
                <Compass className="h-3.5 w-3.5 text-amber-400" />
                <span>Kéo để xoay 360°</span>
              </span>
              <div className="flex items-center gap-1.5">
                {PREVIEW_EMOTIONS.map((em) => (
                  <button
                    key={em.id}
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      setPreviewEmotion(em.id);
                    }}
                    aria-pressed={previewEmotion === em.id}
                    className={`cursor-pointer rounded-xl px-2.5 py-1 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      previewEmotion === em.id
                        ? 'btn-tactile-amber'
                        : 'bg-white/8 text-amber-100 hover:bg-white/16'
                    }`}
                  >
                    {em.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* RIGHT: Setup & Controls Panel */}
          <section className="flex flex-col justify-between gap-5 rounded-3xl border-2 border-amber-900/40 bg-[#29170f] p-5 shadow-2xl sm:p-6 lg:col-span-7">
            <div className="space-y-5">
              {/* Character Selection */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">
                    Chọn Nhân Vật Đại Diện
                  </h2>
                  <span className="text-xs font-semibold text-amber-200/70">
                    Đang chọn: {selectedMeta.name}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ANIMALS.map((animal) => {
                    const active = selectedAnimal === animal.id;
                    return (
                      <button
                        key={animal.id}
                        type="button"
                        onClick={() => {
                          playSfx('click');
                          selectAnimal(animal.id);
                        }}
                        aria-pressed={active}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-xs font-black transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                          active
                            ? 'btn-tactile-amber border-amber-300'
                            : 'border-amber-900/40 bg-black/20 text-amber-50 hover:bg-white/10'
                        }`}
                      >
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-black/30"
                          style={{ backgroundColor: animal.accentHex }}
                        />
                        <span className="truncate">{animal.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Match Setup Controls */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Bot count */}
                <div className="space-y-2 rounded-2xl border border-amber-900/40 bg-black/25 p-3.5">
                  <span className="block text-[11px] font-black uppercase tracking-wider text-amber-300/80">
                    Số Bot ({settings.botCount + 1} người)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {BOT_COUNTS.map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => {
                          playSfx('click');
                          updateSettings({ botCount: cnt });
                        }}
                        aria-pressed={settings.botCount === cnt}
                        className={`cursor-pointer rounded-xl px-2.5 py-1 text-xs font-black transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                          settings.botCount === cnt
                            ? 'btn-tactile-amber'
                            : 'bg-white/8 text-amber-100 hover:bg-white/16'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="space-y-2 rounded-2xl border border-amber-900/40 bg-black/25 p-3.5">
                  <span className="block text-[11px] font-black uppercase tracking-wider text-amber-300/80">
                    Độ khó Bot
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {DIFFICULTIES.map((diff) => (
                      <button
                        key={diff.id}
                        type="button"
                        onClick={() => {
                          playSfx('click');
                          updateSettings({ difficulty: diff.id });
                        }}
                        aria-pressed={settings.difficulty === diff.id}
                        className={`cursor-pointer rounded-xl px-2.5 py-1 text-xs font-black transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                          settings.difficulty === diff.id
                            ? 'btn-tactile-amber'
                            : 'bg-white/8 text-amber-100 hover:bg-white/16'
                        }`}
                      >
                        {diff.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deck mode */}
                <div className="space-y-2 rounded-2xl border border-amber-900/40 bg-black/25 p-3.5">
                  <span className="block text-[11px] font-black uppercase tracking-wider text-amber-300/80">
                    Bộ Bài
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {DECK_MODES.map((dm) => (
                      <button
                        key={dm.id}
                        type="button"
                        onClick={() => {
                          playSfx('click');
                          updateSettings({ deckMode: dm.id });
                        }}
                        aria-pressed={settings.deckMode === dm.id}
                        title={dm.desc}
                        className={`cursor-pointer rounded-xl px-2.5 py-1 text-xs font-black transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                          settings.deckMode === dm.id
                            ? 'btn-tactile-amber'
                            : 'bg-white/8 text-amber-100 hover:bg-white/16'
                        }`}
                      >
                        {dm.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Expandable Settings Panel */}
              {showSettings && (
                <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-amber-900/40 bg-black/35 p-3.5 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={toggleSfx}
                    aria-pressed={settings.sfxEnabled}
                    className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      settings.sfxEnabled
                        ? 'border-emerald-400/60 bg-emerald-500/25 text-emerald-100'
                        : 'border-white/15 bg-white/5 text-white/60'
                    }`}
                  >
                    {settings.sfxEnabled ? (
                      <>
                        <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>SFX: Bật</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="h-3.5 w-3.5 text-white/50" />
                        <span>SFX: Tắt</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={toggleBgm}
                    aria-pressed={settings.bgmEnabled}
                    className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      settings.bgmEnabled
                        ? 'border-emerald-400/60 bg-emerald-500/25 text-emerald-100'
                        : 'border-white/15 bg-white/5 text-white/60'
                    }`}
                  >
                    <Music className={`h-3.5 w-3.5 ${settings.bgmEnabled ? 'text-emerald-400' : 'text-white/50'}`} />
                    <span>Nhạc: {settings.bgmEnabled ? 'Bật' : 'Tắt'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      updateSettings({
                        colorblindMode: !settings.colorblindMode,
                      });
                    }}
                    aria-pressed={settings.colorblindMode}
                    className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      settings.colorblindMode
                        ? 'border-sky-400/60 bg-sky-500/25 text-sky-100'
                        : 'border-white/15 bg-white/5 text-white/75'
                    }`}
                  >
                    {settings.colorblindMode ? (
                      <>
                        <Eye className="h-3.5 w-3.5 text-sky-400" />
                        <span>Mù màu: Bật</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5 text-white/60" />
                        <span>Mù màu: Tắt</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      updateSettings({
                        reducedMotion: !settings.reducedMotion,
                      });
                    }}
                    aria-pressed={settings.reducedMotion}
                    className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      settings.reducedMotion
                        ? 'border-sky-400/60 bg-sky-500/25 text-sky-100'
                        : 'border-white/15 bg-white/5 text-white/75'
                    }`}
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${settings.reducedMotion ? 'text-sky-400' : 'text-white/60'}`} />
                    <span>Giảm FX: {settings.reducedMotion ? 'Bật' : 'Tắt'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    playSfx('paws');
                    onStartGame();
                  }}
                  className="btn-tactile-amber flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl px-5 py-3.5 text-[#26160b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                >
                  <span className="inline-flex items-center gap-2 font-display text-lg font-black leading-tight">
                    <Bot className="h-5 w-5" />
                    <span>Chơi với Bot</span>
                  </span>
                  <span className="mt-0.5 text-[11px] font-bold opacity-85">
                    Đấu Offline · {settings.botCount + 1} người chơi
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    onOpenOnline();
                  }}
                  className="btn-tactile-sky flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl px-5 py-3.5 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                >
                  <span className="inline-flex items-center gap-2 font-display text-lg font-black leading-tight">
                    <Globe className="h-5 w-5" />
                    <span>Chơi Online</span>
                  </span>
                  <span className="mt-0.5 text-[11px] font-bold text-sky-100/90">
                    Mã phòng cá nhân · ghép bạn bè
                  </span>
                </button>
              </div>

              {/* Utility buttons */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setShowTutorial(true);
                  }}
                  className="btn-tactile-wood inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-emerald-400/30 px-3 py-2.5 text-xs font-black text-emerald-200 transition-colors hover:bg-emerald-950/40 focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  <GraduationCap className="h-4 w-4 text-emerald-400" />
                  <span>Hướng Dẫn</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setShowShop(true);
                  }}
                  className="btn-tactile-wood inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-400/25 px-3 py-2.5 text-xs font-black text-amber-200 transition-colors hover:bg-amber-950/40 focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  <ShoppingBag className="h-4 w-4 text-amber-400" />
                  <span>Cửa Hàng</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setShowRules(true);
                  }}
                  className="btn-tactile-wood inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-400/25 px-3 py-2.5 text-xs font-black text-amber-200 transition-colors hover:bg-amber-950/40 focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  <BookOpen className="h-4 w-4 text-amber-400" />
                  <span>Luật Chơi</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setShowSettings((v) => !v);
                  }}
                  aria-expanded={showSettings}
                  className={`btn-tactile-wood inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-black transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    showSettings
                      ? 'border-amber-300 bg-amber-400/20 text-amber-200'
                      : 'border-amber-400/25 text-amber-100 hover:bg-amber-950/40'
                  }`}
                >
                  <SettingsIcon className="h-4 w-4 text-amber-400" />
                  <span>Cài Đặt</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    onOpenStudio3D();
                  }}
                  className="btn-tactile-wood col-span-2 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-sky-400/30 px-3 py-2.5 text-xs font-black text-sky-200 transition-colors hover:bg-sky-950/40 focus-visible:outline-2 focus-visible:outline-amber-300 sm:col-span-1"
                >
                  <Boxes className="h-4 w-4 text-sky-300" />
                  <span>3D Studio</span>
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Modals */}
      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
      <CookieShopModal isOpen={showShop} onClose={() => setShowShop(false)} />
      <TutorialOverlay
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
    </div>
  );
}
