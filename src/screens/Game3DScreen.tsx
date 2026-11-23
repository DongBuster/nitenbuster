import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ANIMALS,
  callPaws,
  catchMissedPaws,
  chooseBotAction,
  dealGame,
  drawTurnAction,
  isPlayable,
  needsColorChoice,
  needsTargetChoice,
  playCard,
  shouldBotCallPaws,
  type CardData,
  type CardType,
  type Color,
  type GameState,
} from '../engine';
import { GameTableScene3D } from '../scene3d/GameTableScene3D';
import { COLOR_THEME } from '../components/Card/cardMeta';
import {
  ColorPickerModal,
  ResultModal,
  TargetPickerModal,
} from '../components/Modals/WildModals';
import { RulesModal } from '../components/Modals/RulesModal';
import { TutorialOverlay } from '../components/Modals/TutorialOverlay';
import {
  playSfx,
  setAudioPreferences,
  startBgm,
  stopBgm,
  type SfxType,
} from '../audio/soundEngine';
import { useProfileStore } from '../store/profileStore';

export interface Game3DScreenProps {
  onBackToMenu: () => void;
}

function getCardSfx(type: CardType): SfxType {
  switch (type) {
    case 'freeze':
    case 'boomerang':
    case 'shovel':
    case 'taser':
    case 'banana':
    case 'bomb':
    case 'egg':
    case 'crossbow':
    case 'potion':
      return type;
    default:
      return 'play';
  }
}

export function Game3DScreen({ onBackToMenu }: Game3DScreenProps) {
  const {
    selectedAnimal,
    equippedAccessory,
    gamesPlayed,
    settings,
    updateSettings,
    recordMatchResult,
  } = useProfileStore();

  const [gameState, setGameState] = useState<GameState>(() =>
    dealGame({
      humanAnimal: selectedAnimal,
      humanName: 'Bạn',
      botCount: settings.botCount,
      difficulty: settings.difficulty,
      deckMode: settings.deckMode,
    }),
  );

  const [pendingColorCard, setPendingColorCard] = useState<CardData | null>(
    null,
  );
  const [pendingTargetCard, setPendingTargetCard] = useState<CardData | null>(
    null,
  );
  const [showRules, setShowRules] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !window.localStorage.getItem('paws_tutorial_seen_v1');
    } catch {
      return false;
    }
  });
  const [cookiesEarned, setCookiesEarned] = useState<number>(0);
  const [dismissedTip, setDismissedTip] = useState<boolean>(false);

  const handleCloseTutorial = useCallback(() => {
    setShowTutorial(false);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('paws_tutorial_seen_v1', '1');
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const recordedMatchRef = useRef<boolean>(false);

  const handleSafeBackToMenu = useCallback(() => {
    playSfx('click');
    onBackToMenu();
  }, [onBackToMenu]);

  const humanPlayer =
    gameState.players.find((p) => !p.isBot) ?? gameState.players[0];
  const humanId = humanPlayer.id;
  const humanAnimalMeta =
    ANIMALS.find((a) => a.id === humanPlayer.animal) ?? ANIMALS[0];
  const currentPlayer = gameState.players[gameState.currentIndex];
  const isHumanTurn =
    currentPlayer?.id === humanId && gameState.winnerId === null;

  const opponents = gameState.players.filter((p) => p.id !== humanId);
  const activeTheme = COLOR_THEME[gameState.currentColor];
  const latestLog =
    gameState.logs.length > 0
      ? gameState.logs[gameState.logs.length - 1]
      : null;

  const canCallPaws =
    gameState.winnerId === null &&
    humanPlayer.hand.length >= 1 &&
    humanPlayer.hand.length <= 2 &&
    !humanPlayer.calledPaws;

  const playableCardIds = useMemo(() => {
    if (!isHumanTurn) return [];
    return humanPlayer.hand
      .filter((c) => isPlayable(c, gameState))
      .map((c) => c.id);
  }, [isHumanTurn, humanPlayer.hand, gameState]);

  // Sync audio preferences & BGM lifecycle
  useEffect(() => {
    setAudioPreferences({
      sfxEnabled: settings.sfxEnabled,
      bgmEnabled: settings.bgmEnabled,
    });
    if (settings.bgmEnabled) {
      startBgm();
    } else {
      stopBgm();
    }
    return () => {
      stopBgm();
    };
  }, [settings.sfxEnabled, settings.bgmEnabled]);

  const handleRestartMatch = useCallback(() => {
    playSfx('click');
    recordedMatchRef.current = false;
    setCookiesEarned(0);
    setPendingColorCard(null);
    setPendingTargetCard(null);
    setGameState(
      dealGame({
        humanAnimal: selectedAnimal,
        humanName: 'Bạn',
        botCount: settings.botCount,
        difficulty: settings.difficulty,
        deckMode: settings.deckMode,
      }),
    );
  }, [selectedAnimal, settings.botCount, settings.difficulty, settings.deckMode]);

  const executeHumanPlay = useCallback(
    (
      card: CardData,
      options?: { chosenColor?: Color; targetPlayerId?: string },
    ) => {
      playSfx(getCardSfx(card.type));
      setGameState((prev) => playCard(prev, humanId, card.id, options));
    },
    [humanId],
  );

  const handleHumanCardClick = useCallback(
    (card: CardData) => {
      if (!isHumanTurn) return;
      if (!isPlayable(card, gameState)) return;

      if (needsColorChoice(card.type)) {
        playSfx('click');
        setPendingColorCard(card);
        return;
      }
      if (needsTargetChoice(card.type)) {
        playSfx('click');
        setPendingTargetCard(card);
        return;
      }
      executeHumanPlay(card);
    },
    [isHumanTurn, gameState, executeHumanPlay],
  );

  const handleHumanDraw = useCallback(() => {
    if (!isHumanTurn) return;
    playSfx('draw');
    setGameState((prev) => drawTurnAction(prev, humanId));
  }, [isHumanTurn, humanId]);

  const handleCallPaws = useCallback(() => {
    if (!canCallPaws) return;
    playSfx('paws');
    setGameState((prev) => callPaws(prev, humanId));
  }, [canCallPaws, humanId]);

  const handleCatchBotPaws = useCallback(
    (targetId: string) => {
      playSfx('paws');
      setGameState((prev) => catchMissedPaws(prev, targetId, humanPlayer.name));
    },
    [humanPlayer.name],
  );

  const handleSelectColor = useCallback(
    (color: Color) => {
      if (!pendingColorCard) return;
      const card = pendingColorCard;
      setPendingColorCard(null);
      executeHumanPlay(card, { chosenColor: color });
    },
    [pendingColorCard, executeHumanPlay],
  );

  const handleSelectTarget = useCallback(
    (targetPlayerId: string) => {
      if (!pendingTargetCard) return;
      const card = pendingTargetCard;
      setPendingTargetCard(null);
      executeHumanPlay(card, { targetPlayerId });
    },
    [pendingTargetCard, executeHumanPlay],
  );

  // Keyboard shortcut: Space to draw card on human turn
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLButtonElement
      ) {
        return;
      }
      if (
        !isHumanTurn ||
        pendingColorCard ||
        pendingTargetCard ||
        showRules ||
        showTutorial ||
        gameState.winnerId !== null
      ) {
        return;
      }
      e.preventDefault();
      handleHumanDraw();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isHumanTurn,
    pendingColorCard,
    pendingTargetCard,
    showRules,
    showTutorial,
    gameState.winnerId,
    handleHumanDraw,
  ]);

  // Bot Turn Loop
  useEffect(() => {
    const active = gameState.players[gameState.currentIndex];
    if (!active || !active.isBot || gameState.winnerId !== null) {
      return;
    }

    const timer = window.setTimeout(() => {
      let workingState = gameState;
      const human = workingState.players.find((p) => p.id === humanId);
      if (
        human &&
        human.hand.length === 1 &&
        !human.calledPaws &&
        workingState.difficulty !== 'easy'
      ) {
        workingState = catchMissedPaws(workingState, humanId, active.name);
        playSfx('paws');
      }

      const decision = chooseBotAction(workingState);
      let nextState: GameState;

      if (decision.action === 'play') {
        const currentBot = workingState.players[workingState.currentIndex];
        const playedCard = currentBot?.hand.find(
          (c) => c.id === decision.cardId,
        );
        if (playedCard) {
          playSfx(getCardSfx(playedCard.type));
        } else {
          playSfx('play');
        }
        nextState = playCard(
          workingState,
          active.id,
          decision.cardId,
          decision.options,
        );
      } else {
        playSfx('draw');
        nextState = drawTurnAction(workingState, active.id);
      }

      // Attach bot's playful quip on the bot player
      nextState = {
        ...nextState,
        players: nextState.players.map((p) =>
          p.id === active.id ? { ...p, quip: decision.quip } : p,
        ),
      };

      // Auto-call PAWS for bot when holding 1-2 cards
      const updatedBot = nextState.players.find((p) => p.id === active.id);
      if (
        updatedBot &&
        nextState.winnerId === null &&
        shouldBotCallPaws(updatedBot, nextState.difficulty)
      ) {
        nextState = callPaws(nextState, updatedBot.id);
        playSfx('paws');
      }

      setGameState(nextState);
    }, 950);

    return () => window.clearTimeout(timer);
  }, [gameState, humanId]);

  // Record match result once when winnerId becomes non-null
  useEffect(() => {
    if (!gameState.winnerId || recordedMatchRef.current) return;
    recordedMatchRef.current = true;
    const humanWon = gameState.winnerId === humanId;
    const reward = recordMatchResult(humanWon);
    setCookiesEarned(reward);
    playSfx(humanWon ? 'win' : 'lose');
  }, [gameState.winnerId, humanId, recordMatchResult]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#1D120C] text-[#FFF9F0] select-none">
      {/* Full-bleed 3D Game Table Scene (including 3D playable CardFan3D hand!) */}
      <div
        className={`h-full w-full transition-[filter] duration-300 ${
          settings.colorblindMode ? 'grayscale' : ''
        }`}
      >
        <GameTableScene3D
          state={gameState}
          humanPlayerId={humanId}
          isHumanTurn={isHumanTurn}
          playableCardIds={playableCardIds}
          equippedAccessory={equippedAccessory}
          targetPickingMode={pendingTargetCard !== null}
          onPlayCard={handleHumanCardClick}
          onDrawCard={handleHumanDraw}
          onSelectTarget={handleSelectTarget}
          onCatchPaws={handleCatchBotPaws}
        />
      </div>

      {/* ================= TOP HUD BAR ================= */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex flex-col gap-2 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Back + Active Color + Direction */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSafeBackToMenu}
              className="cursor-pointer rounded-xl border border-amber-200/25 bg-[#26170F]/85 px-3 py-1.5 text-xs font-extrabold text-amber-100 shadow-lg backdrop-blur-md transition-colors hover:bg-[#3A2417] focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              ← Menu
            </button>

            {/* Active Color Badge */}
            <div
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold shadow-lg backdrop-blur-md"
              style={{
                backgroundColor: activeTheme.pillBg,
                borderColor: activeTheme.light,
                color: activeTheme.pillText,
              }}
            >
              <span aria-hidden="true">{activeTheme.shapeSymbol}</span>
              <span>Màu: {activeTheme.label}</span>
            </div>

            {/* Direction Pill */}
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#26170F]/80 px-3 py-1.5 text-xs font-bold text-amber-100 shadow-lg backdrop-blur-md">
              <span>
                {gameState.direction === 1
                  ? '↻ Theo chiều kim đồng hồ'
                  : '↺ Ngược chiều'}
              </span>
            </div>
          </div>

          {/* Right: Turn indicator + Sound + Rules + Restart */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <div
              className={`rounded-xl border px-3 py-1.5 text-xs font-extrabold shadow-lg backdrop-blur-md ${
                isHumanTurn
                  ? 'border-amber-300 bg-amber-400 text-[#2C1B11]'
                  : 'border-white/15 bg-[#26170F]/80 text-amber-100'
              }`}
            >
              {gameState.winnerId
                ? '🏆 Ván đấu kết thúc'
                : isHumanTurn
                  ? '✨ Lượt của bạn!'
                  : `⏳ Lượt: ${currentPlayer?.name ?? '...'}`}
            </div>

            <button
              type="button"
              onClick={() => {
                updateSettings({ sfxEnabled: !settings.sfxEnabled });
              }}
              aria-label={settings.sfxEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
              title={settings.sfxEnabled ? 'Tắt SFX' : 'Bật SFX'}
              className="cursor-pointer rounded-xl border border-white/15 bg-[#26170F]/85 px-2.5 py-1.5 text-xs font-bold text-amber-100 shadow-lg backdrop-blur-md hover:bg-[#3A2417] focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              {settings.sfxEnabled ? '🔊' : '🔇'}
            </button>

            <button
              type="button"
              onClick={() => {
                playSfx('click');
                updateSettings({ bgmEnabled: !settings.bgmEnabled });
              }}
              aria-pressed={settings.bgmEnabled}
              aria-label={settings.bgmEnabled ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
              title={settings.bgmEnabled ? 'Tắt nhạc nền (BGM)' : 'Bật nhạc nền (BGM)'}
              className={`cursor-pointer rounded-xl border px-2.5 py-1.5 text-xs font-bold shadow-lg backdrop-blur-md transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
                settings.bgmEnabled
                  ? 'border-emerald-300/60 bg-emerald-600/80 text-white'
                  : 'border-white/15 bg-[#26170F]/85 text-amber-100/70 hover:bg-[#3A2417]'
              }`}
            >
              🎵
            </button>

            <button
              type="button"
              onClick={() => {
                playSfx('click');
                setShowTutorial(true);
              }}
              className="cursor-pointer rounded-xl border border-emerald-300/30 bg-emerald-900/75 px-3 py-1.5 text-xs font-extrabold text-emerald-100 shadow-lg backdrop-blur-md hover:bg-emerald-800/85 focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              🎓 Hướng Dẫn
            </button>

            <button
              type="button"
              onClick={() => {
                playSfx('click');
                setShowRules(true);
              }}
              className="cursor-pointer rounded-xl border border-white/15 bg-[#26170F]/85 px-3 py-1.5 text-xs font-extrabold text-amber-100 shadow-lg backdrop-blur-md hover:bg-[#3A2417] focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              📖 Luật
            </button>

            <button
              type="button"
              onClick={handleRestartMatch}
              title="Chia lại ván mới"
              className="cursor-pointer rounded-xl border border-white/15 bg-[#26170F]/85 px-2.5 py-1.5 text-xs font-bold text-amber-100 shadow-lg backdrop-blur-md hover:bg-[#3A2417] focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Warning Banners (Shovel Pending / Active Bomb) & Action Log Ticker */}
        <div className="flex flex-col items-center gap-1.5">
          {gameState.pending?.kind === 'draw' && (
            <div className="rounded-full border border-rose-300/60 bg-rose-950/90 px-4 py-1 text-xs font-extrabold text-rose-100 shadow-lg backdrop-blur-md">
              ❄️ Xẻng Tuyết cộng dồn: +{gameState.pending.count} lá! (Đánh Xẻng / Thuốc Tàng Hình hoặc bấm Rút)
            </div>
          )}

          {gameState.activeBomb && (
            <div className="rounded-full border border-amber-300/60 bg-amber-950/90 px-4 py-1 text-xs font-extrabold text-amber-200 shadow-lg backdrop-blur-md">
              💣 Bom Kẹo đang đếm ngược: nổ sau {gameState.activeBomb.fuse} lượt (phạt +4 lá)!
            </div>
          )}

          {(gameState.lastEffectBanner || latestLog) && (
            <div className="max-w-xl truncate rounded-full border border-white/10 bg-[#1B110B]/75 px-4 py-1 text-xs font-semibold text-amber-100/90 backdrop-blur-md">
              {gameState.lastEffectBanner ?? latestLog?.text}
            </div>
          )}

          {gamesPlayed === 0 && !dismissedTip && gameState.winnerId === null && (
            <div className="pointer-events-auto flex max-w-2xl items-center gap-2 rounded-2xl border border-sky-300/35 bg-sky-950/85 px-3.5 py-1.5 text-xs font-semibold text-sky-100 shadow-lg backdrop-blur-md">
              <span>
                💡 <strong>Mẹo nhanh:</strong> Bấm trực tiếp lá bài 3D sáng ở
                trước mặt để đánh · Nhấn <strong>Space</strong> (hoặc chồng bài)
                để rút · Khi còn 1–2 lá nhớ bấm <strong>🐾 Hô PAWS!</strong>
              </span>
              <button
                type="button"
                onClick={() => setDismissedTip(true)}
                aria-label="Ẩn mẹo hướng dẫn"
                className="shrink-0 cursor-pointer rounded-lg bg-white/10 px-2 py-0.5 text-[11px] font-bold text-sky-100 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                Đã hiểu
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ================= COMPACT NON-BLOCKING BOTTOM HUD BAR ================= */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center px-3 sm:px-6">
        <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-amber-200/20 bg-[#26170F]/82 px-3.5 py-2 shadow-2xl backdrop-blur-md">
          {/* Human Player Animal Badge + Card Count */}
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white/40"
              style={{ backgroundColor: humanAnimalMeta.accentHex }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold text-[#FFFBF4] sm:text-sm">
                {humanPlayer.name} · {humanAnimalMeta.name}
              </span>
              {humanPlayer.calledPaws && (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-[#2C1B11]">
                  PAWS!
                </span>
              )}
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-amber-200">
                🎴 {humanPlayer.hand.length} lá
              </span>
              <span className="hidden text-[11px] font-semibold text-amber-100/70 sm:inline">
                Chồng rút: {gameState.drawPile.length}
              </span>
            </div>
          </div>

          {/* Action Buttons: Hô PAWS! + Rút Bài */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCallPaws}
              disabled={!canCallPaws}
              className={`rounded-xl border-2 px-3.5 py-1.5 text-xs font-black transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                canCallPaws
                  ? 'cursor-pointer border-amber-200 bg-gradient-to-r from-amber-400 to-orange-500 text-[#2C1B11] shadow-[0_0_20px_rgba(251,191,36,0.6)] hover:scale-105'
                  : 'cursor-not-allowed border-white/10 bg-white/5 text-white/35'
              }`}
            >
              🐾 Hô PAWS!
            </button>

            <button
              type="button"
              onClick={handleHumanDraw}
              disabled={!isHumanTurn}
              className={`rounded-xl border-2 px-3.5 py-1.5 text-xs font-extrabold transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                isHumanTurn
                  ? 'cursor-pointer border-sky-300/70 bg-sky-600/90 text-white shadow-lg hover:bg-sky-500'
                  : 'cursor-not-allowed border-white/10 bg-white/5 text-white/40'
              }`}
            >
              {gameState.pending?.kind === 'draw'
                ? `📥 Nhận +${gameState.pending.count} lá (Space)`
                : '📥 Rút Bài (Space)'}
            </button>
          </div>
        </div>
      </div>

      {/* ================= MODALS ================= */}
      <ColorPickerModal
        isOpen={pendingColorCard !== null}
        cardType={pendingColorCard?.type}
        onSelectColor={handleSelectColor}
        onCancel={() => setPendingColorCard(null)}
      />

      <TargetPickerModal
        isOpen={pendingTargetCard !== null}
        opponents={opponents}
        onSelectTarget={handleSelectTarget}
        onCancel={() => setPendingTargetCard(null)}
      />

      <ResultModal
        isOpen={gameState.winnerId !== null}
        state={gameState}
        humanPlayerId={humanId}
        cookiesEarned={cookiesEarned}
        onPlayAgain={handleRestartMatch}
        onBackToMenu={handleSafeBackToMenu}
      />

      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
      <TutorialOverlay isOpen={showTutorial} onClose={handleCloseTutorial} />
    </div>
  );
}
