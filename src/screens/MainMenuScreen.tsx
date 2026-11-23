import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
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
  { id: 'medium', label: 'Trung bình' },
  { id: 'hard', label: 'Khó' },
];

const DECK_MODES: { id: GameDeckMode; label: string; desc: string }[] = [
  { id: 'mvp', label: 'MVP (6 loại)', desc: '112 lá cơ bản' },
  { id: 'full', label: 'Full (11 loại)', desc: '122 lá đủ bài' },
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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#4a3528_0%,_#2a1c14_55%,_#180f0b_100%)] text-[#FFF9F0] selection:bg-amber-300 selection:text-[#2C1B11]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col justify-between px-4 pb-8 pt-16 sm:px-6 lg:px-8">
        {/* Top Hero Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {onBackToModeSelect && (
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  onBackToModeSelect();
                }}
                className="cursor-pointer rounded-xl border border-white/15 bg-[#26170F]/80 px-3 py-2 text-xs font-extrabold text-amber-100 shadow-lg transition-colors hover:bg-[#3A2417] focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                ← Đổi Chế Độ
              </button>
            )}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-[11px] font-extrabold tracking-wide text-amber-200">
                <span>❄️</span>
                <span>WINTER CABIN · GAME BÀI 3D</span>
              </div>
              <h1 className="mt-1.5 font-display text-3xl font-black tracking-tight text-[#FFFBF4] drop-shadow-sm sm:text-4xl">
                🐾 PAWS 3D
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/30 bg-[#26170F]/80 px-4 py-2 text-sm font-black text-amber-200 shadow-lg backdrop-blur-md">
              <span aria-hidden="true">🍪</span>
              <span>{cookies} Cookies</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-[#26170F]/80 px-4 py-2 text-xs font-bold text-amber-100/90 shadow-lg backdrop-blur-md">
              <span aria-hidden="true">🏆</span>
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
            className="relative flex min-h-[380px] flex-col overflow-hidden rounded-3xl border-2 border-amber-200/20 bg-[#24160F]/70 shadow-2xl backdrop-blur-sm lg:col-span-5"
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
                <color attach="background" args={['#261810']} />
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

              {/* Top-left character bio pill */}
              <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1.5">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-200/20 bg-[#26170F]/80 px-3 py-1.5 backdrop-blur-md">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 rounded-full ring-2 ring-white/40"
                    style={{ backgroundColor: selectedMeta.accentHex }}
                  />
                  <span className="text-sm font-extrabold text-[#FFFBF4]">
                    {selectedMeta.name}
                  </span>
                </div>
                <span className="text-xs font-semibold text-amber-100/80 drop-shadow-sm">
                  {selectedMeta.personality}
                </span>
                {equippedItem && (
                  <span className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-950/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200">
                    <span>{equippedItem.icon}</span>
                    <span>{equippedItem.name}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Bottom preview emotion bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#1D120C]/85 px-4 py-2.5">
              <span className="text-[11px] font-bold text-amber-200/75">
                Kéo xoay 360°
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
                    className={`cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      previewEmotion === em.id
                        ? 'bg-amber-400 text-[#2C1B11]'
                        : 'bg-white/10 text-amber-100 hover:bg-white/20'
                    }`}
                  >
                    {em.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* RIGHT: Setup & Controls Panel */}
          <section className="flex flex-col justify-between gap-5 rounded-3xl border-2 border-amber-200/20 bg-[#26170F]/82 p-5 shadow-2xl backdrop-blur-md sm:p-6 lg:col-span-7">
            <div className="space-y-5">
              {/* Character Selection (all 8 plush animals) */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-200">
                    1. Chọn Nhân Vật Plush 3D (8 loài)
                  </h2>
                  <span className="text-xs font-semibold text-amber-100/70">
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
                        className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-xs font-extrabold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                          active
                            ? 'border-amber-300 bg-amber-400 text-[#2C1B11] shadow-md'
                            : 'border-white/12 bg-white/6 text-amber-50 hover:bg-white/14'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/25"
                          style={{ backgroundColor: animal.accentHex }}
                        />
                        <span className="truncate">{animal.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Match Setup Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Bot count */}
                <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <span className="block text-[11px] font-extrabold uppercase tracking-wider text-amber-200/80">
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
                        className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
                          settings.botCount === cnt
                            ? 'bg-amber-400 text-[#2C1B11]'
                            : 'bg-white/10 text-amber-100 hover:bg-white/20'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <span className="block text-[11px] font-extrabold uppercase tracking-wider text-amber-200/80">
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
                        className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
                          settings.difficulty === diff.id
                            ? 'bg-amber-400 text-[#2C1B11]'
                            : 'bg-white/10 text-amber-100 hover:bg-white/20'
                        }`}
                      >
                        {diff.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deck mode */}
                <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <span className="block text-[11px] font-extrabold uppercase tracking-wider text-amber-200/80">
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
                        className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
                          settings.deckMode === dm.id
                            ? 'bg-amber-400 text-[#2C1B11]'
                            : 'bg-white/10 text-amber-100 hover:bg-white/20'
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
                <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-amber-200/20 bg-black/30 p-3.5 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={toggleSfx}
                    aria-pressed={settings.sfxEnabled}
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      settings.sfxEnabled
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                        : 'border-white/15 bg-white/5 text-white/60'
                    }`}
                  >
                    {settings.sfxEnabled ? '🔊 SFX: Bật' : '🔇 SFX: Tắt'}
                  </button>

                  <button
                    type="button"
                    onClick={toggleBgm}
                    aria-pressed={settings.bgmEnabled}
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      settings.bgmEnabled
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                        : 'border-white/15 bg-white/5 text-white/60'
                    }`}
                  >
                    {settings.bgmEnabled ? '🎵 BGM: Bật' : '🎵 BGM: Tắt'}
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
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      settings.colorblindMode
                        ? 'border-sky-400/60 bg-sky-500/25 text-sky-100'
                        : 'border-white/15 bg-white/5 text-white/75'
                    }`}
                  >
                    👁️ Mù màu: {settings.colorblindMode ? 'Bật' : 'Tắt'}
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
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      settings.reducedMotion
                        ? 'border-sky-400/60 bg-sky-500/25 text-sky-100'
                        : 'border-white/15 bg-white/5 text-white/75'
                    }`}
                  >
                    ✨ Giảm hiệu ứng: {settings.reducedMotion ? 'Bật' : 'Tắt'}
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
                  className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 px-5 py-3.5 text-[#2C1B11] shadow-[0_8px_28px_rgba(251,191,36,0.38)] transition-transform hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
                >
                  <span className="font-display text-lg font-black leading-tight">
                    🤖 Chơi với Bot
                  </span>
                  <span className="mt-0.5 text-[11px] font-extrabold opacity-85">
                    Đấu Offline ngay · {settings.botCount + 1} người
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    onOpenOnline();
                  }}
                  className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-3.5 text-white shadow-[0_8px_28px_rgba(56,189,248,0.32)] transition-transform hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
                >
                  <span className="font-display text-lg font-black leading-tight">
                    🌐 Chơi Online
                  </span>
                  <span className="mt-0.5 text-[11px] font-bold text-sky-100/90">
                    Tạo / vào mã phòng · thêm Bot tùy chọn
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setShowTutorial(true);
                  }}
                  className="cursor-pointer rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2.5 text-xs font-extrabold text-emerald-100 transition-colors hover:bg-emerald-500/25 focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  🎓 Hướng Dẫn Tân Thủ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setShowShop(true);
                  }}
                  className="cursor-pointer rounded-xl border border-amber-200/20 bg-white/8 px-3 py-2.5 text-xs font-extrabold text-amber-100 transition-colors hover:bg-white/16 focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  🛍️ Cửa Hàng Cookies
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setShowRules(true);
                  }}
                  className="cursor-pointer rounded-xl border border-amber-200/20 bg-white/8 px-3 py-2.5 text-xs font-extrabold text-amber-100 transition-colors hover:bg-white/16 focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  📖 Luật Chơi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setShowSettings((v) => !v);
                  }}
                  aria-expanded={showSettings}
                  className={`cursor-pointer rounded-xl border px-3 py-2.5 text-xs font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    showSettings
                      ? 'border-amber-300 bg-amber-400/20 text-amber-200'
                      : 'border-amber-200/20 bg-white/8 text-amber-100 hover:bg-white/16'
                  }`}
                >
                  ⚙️ Cài Đặt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    onOpenStudio3D();
                  }}
                  className="col-span-2 cursor-pointer rounded-xl border border-sky-300/25 bg-sky-500/12 px-3 py-2.5 text-xs font-extrabold text-sky-100 transition-colors hover:bg-sky-500/22 focus-visible:outline-2 focus-visible:outline-amber-300 sm:col-span-1"
                >
                  ✨ 3D Studio
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
