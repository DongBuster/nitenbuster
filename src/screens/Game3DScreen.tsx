import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bomb,
  BookOpen,
  Clock,
  Download,
  Flame,
  GraduationCap,
  Layers,
  Music,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ANIMALS,
  callPaws,
  catchMissedPaws,
  chooseBotAction,
  dealGame,
  drawTurnAction,
  getPredictedBombVictim,
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
import { CARD_META, COLOR_THEME, CardInfoButton } from '../components/Card';
import {
  ColorPickerModal,
  ResultModal,
  TargetPickerModal,
} from '../components/Modals/WildModals';
import { RulesModal } from '../components/Modals/RulesModal';
import { TutorialOverlay } from '../components/Modals/TutorialOverlay';
import {
  PawsShoutOverlay,
  type PawsShoutInfo,
} from '../components/Modals/PawsShoutOverlay';
import {
  playSfx,
  setAudioPreferences,
  startBgm,
  stopBgm,
  type SfxType,
} from '../audio/soundEngine';
import { useProfileStore } from '../store/profileStore';

const OFFLINE_TURN_TIME_SEC = 20;

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
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number>(
    OFFLINE_TURN_TIME_SEC,
  );

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

  const [pawsShout, setPawsShout] = useState<PawsShoutInfo | null>(null);
  const prevCalledPawsRef = useRef<Set<string>>(new Set());
  const humanOneCardSinceRef = useRef<number | null>(null);
  const prevHumanHandLenRef = useRef<number>(humanPlayer.hand.length);
  const [penaltyNotice, setPenaltyNotice] = useState<string | null>(null);

  const predictedBombVictim = useMemo(
    () => getPredictedBombVictim(gameState),
    [gameState],
  );

  // Track how long human has been at 1 card without calling PAWS (2.5s grace window)
  useEffect(() => {
    if (
      gameState.winnerId === null &&
      humanPlayer.hand.length === 1 &&
      !humanPlayer.calledPaws
    ) {
      if (humanOneCardSinceRef.current === null) {
        humanOneCardSinceRef.current = Date.now();
      }
    } else {
      humanOneCardSinceRef.current = null;
    }
  }, [humanPlayer.hand.length, humanPlayer.calledPaws, gameState.winnerId]);

  // Surface a clear reason toast whenever the human receives penalty/extra cards
  useEffect(() => {
    const prevLen = prevHumanHandLenRef.current;
    const currLen = humanPlayer.hand.length;
    prevHumanHandLenRef.current = currLen;

    if (
      gameState.turnCount === 0 ||
      gameState.winnerId !== null ||
      currLen <= prevLen
    ) {
      return;
    }

    const delta = currLen - prevLen;
    const reason = gameState.lastEffectBanner ?? latestLog?.text ?? '';
    const isNotableEvent =
      delta >= 2 ||
      latestLog?.type === 'penalty' ||
      reason.includes('Nỏ Thần') ||
      reason.includes('PAWS') ||
      reason.includes('Bom') ||
      reason.includes('Vỏ Chuối') ||
      reason.includes('Tia Chớp');

    if (isNotableEvent && reason) {
      setPenaltyNotice(`+${delta} lá — ${reason}`);
      const timer = window.setTimeout(() => setPenaltyNotice(null), 2800);
      return () => window.clearTimeout(timer);
    }
  }, [
    humanPlayer.hand.length,
    gameState.turnCount,
    gameState.winnerId,
    gameState.lastEffectBanner,
    latestLog,
  ]);

  const canCallPaws =
    gameState.winnerId === null &&
    humanPlayer.hand.length === 1 &&
    !humanPlayer.calledPaws;

  useEffect(() => {
    const currentSet = new Set(
      gameState.players.filter((p) => p.calledPaws).map((p) => p.id),
    );
    const newlyCalled = gameState.players.find(
      (p) => p.calledPaws && !prevCalledPawsRef.current.has(p.id),
    );
    prevCalledPawsRef.current = currentSet;

    if (newlyCalled && gameState.winnerId === null) {
      setPawsShout({
        key: `${gameState.turnCount}-${newlyCalled.id}-${Date.now()}`,
        playerName: newlyCalled.name,
        animal: newlyCalled.animal,
      });
      const timer = window.setTimeout(() => setPawsShout(null), 1700);
      return () => window.clearTimeout(timer);
    }
  }, [gameState.players, gameState.turnCount, gameState.winnerId]);

  const isLowTimer = turnSecondsLeft <= 5 && gameState.winnerId === null;

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
    setTurnSecondsLeft(OFFLINE_TURN_TIME_SEC);
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

  // Reset turn countdown whenever the active turn changes
  useEffect(() => {
    setTurnSecondsLeft(OFFLINE_TURN_TIME_SEC);
  }, [gameState.turnCount, gameState.currentIndex]);

  // Turn countdown tick (pauses while modals/pickers are open or game over)
  useEffect(() => {
    if (
      gameState.winnerId !== null ||
      showRules ||
      showTutorial ||
      pendingColorCard !== null ||
      pendingTargetCard !== null
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setTurnSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [
    gameState.winnerId,
    showRules,
    showTutorial,
    pendingColorCard,
    pendingTargetCard,
  ]);

  // Auto-draw 1 card when time expires on human turn
  useEffect(() => {
    if (
      turnSecondsLeft !== 0 ||
      !isHumanTurn ||
      gameState.winnerId !== null ||
      showRules ||
      showTutorial ||
      pendingColorCard !== null ||
      pendingTargetCard !== null
    ) {
      return;
    }
    setPendingColorCard(null);
    setPendingTargetCard(null);
    playSfx('draw');
    setGameState((curr) => drawTurnAction(curr, humanId));
  }, [
    turnSecondsLeft,
    isHumanTurn,
    gameState.winnerId,
    showRules,
    showTutorial,
    pendingColorCard,
    pendingTargetCard,
    humanId,
  ]);

  // Bot Turn Loop
  useEffect(() => {
    const active = gameState.players[gameState.currentIndex];
    if (!active || !active.isBot || gameState.winnerId !== null) {
      return;
    }

    const timer = window.setTimeout(() => {
      const workingState = gameState;
      const human = workingState.players.find((p) => p.id === humanId);
      const oneCardElapsed =
        humanOneCardSinceRef.current !== null
          ? Date.now() - humanOneCardSinceRef.current
          : 0;

      // Give human a 2.5s grace window to press "Hô PAWS!", and report catch as its own visible step
      if (
        human &&
        human.hand.length === 1 &&
        !human.calledPaws &&
        workingState.difficulty !== 'easy' &&
        oneCardElapsed >= 2500
      ) {
        playSfx('paws');
        setGameState(catchMissedPaws(workingState, humanId, active.name));
        return;
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
              className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-900/40 px-3 py-1.5 text-xs font-black text-amber-100 shadow-md transition-colors focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-amber-300" />
              <span>Menu</span>
            </button>

            {/* Active Color Badge */}
            <div
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black shadow-md backdrop-blur-md"
              style={{
                backgroundColor: activeTheme.pillBg,
                borderColor: activeTheme.light,
                color: activeTheme.pillText,
              }}
            >
              <span aria-hidden="true">{activeTheme.shapeSymbol}</span>
              <span>Màu: {activeTheme.label}</span>
            </div>

            {/* Top Discard Card Pill for instant readability */}
            {(() => {
              const top =
                gameState.discardPile[gameState.discardPile.length - 1];
              if (!top) return null;
              const label =
                top.type === 'basic'
                  ? `Số ${top.value ?? 0}`
                  : CARD_META[top.type].name;
              return (
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-[#26170F]/90 px-3 py-1.5 text-xs font-black text-amber-100 shadow-md">
                  <Layers className="h-3.5 w-3.5 text-amber-300" />
                  <span>Trên bàn: {label}</span>
                  <CardInfoButton
                    type={top.type}
                    color={top.color}
                    value={top.value}
                    placement="bottom"
                    size="xs"
                  />
                </div>
              );
            })()}

            {/* Direction Pill */}
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-900/40 bg-[#26170F]/85 px-3 py-1.5 text-xs font-bold text-amber-100 shadow-md">
              {gameState.direction === 1 ? (
                <RotateCw className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
              )}
              <span>
                {gameState.direction === 1 ? 'Thuận chiều' : 'Đảo chiều'}
              </span>
            </div>
          </div>

          {/* Right: Turn indicator + Sound + Rules + Restart */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <div
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black shadow-md ${
                isHumanTurn
                  ? 'btn-tactile-amber border-amber-300'
                  : 'border-amber-900/40 bg-[#26170F]/90 text-amber-100'
              }`}
            >
              {gameState.winnerId ? (
                <>
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  <span>Ván đấu kết thúc</span>
                </>
              ) : isHumanTurn ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-amber-950" />
                  <span>Lượt của bạn!</span>
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span>Lượt: {currentPlayer?.name ?? '...'}</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                updateSettings({ sfxEnabled: !settings.sfxEnabled });
              }}
              aria-label={settings.sfxEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
              title={settings.sfxEnabled ? 'Tắt SFX' : 'Bật SFX'}
              className="btn-tactile-wood cursor-pointer rounded-xl border border-amber-900/40 p-2 text-amber-100 shadow-md transition-colors focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              {settings.sfxEnabled ? (
                <Volume2 className="h-4 w-4 text-amber-300" />
              ) : (
                <VolumeX className="h-4 w-4 text-white/50" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                playSfx('click');
                updateSettings({ bgmEnabled: !settings.bgmEnabled });
              }}
              aria-pressed={settings.bgmEnabled}
              aria-label={settings.bgmEnabled ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
              title={settings.bgmEnabled ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
              className={`btn-tactile-wood cursor-pointer rounded-xl border p-2 shadow-md transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
                settings.bgmEnabled
                  ? 'border-emerald-400/50 bg-emerald-950/80 text-emerald-300'
                  : 'border-amber-900/40 text-white/50'
              }`}
            >
              <Music className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                playSfx('click');
                setShowTutorial(true);
              }}
              className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-400/30 px-3 py-1.5 text-xs font-black text-emerald-200 shadow-md hover:bg-emerald-950/50 focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              <GraduationCap className="h-3.5 w-3.5 text-emerald-400" />
              <span>Hướng Dẫn</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playSfx('click');
                setShowRules(true);
              }}
              className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-900/40 px-3 py-1.5 text-xs font-black text-amber-100 shadow-md hover:bg-amber-950/50 focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              <BookOpen className="h-3.5 w-3.5 text-amber-400" />
              <span>Luật</span>
            </button>

            <button
              type="button"
              onClick={handleRestartMatch}
              title="Chia lại ván mới"
              className="btn-tactile-wood cursor-pointer rounded-xl border border-amber-900/40 p-2 text-amber-100 shadow-md transition-colors focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              <RotateCcw className="h-4 w-4 text-amber-400" />
            </button>
          </div>
        </div>

        {/* Turn Countdown + Warning Banners (Shovel Pending / Active Bomb) & Action Log Ticker */}
        <div className="flex flex-col items-center gap-1.5">
          {gameState.winnerId === null && (() => {
            const pct = Math.max(
              0,
              Math.min(100, (turnSecondsLeft / OFFLINE_TURN_TIME_SEC) * 100),
            );
            const isWarning = !isLowTimer && turnSecondsLeft <= 10;

            const cardStyle = isLowTimer
              ? 'animate-pulse border-rose-300/90 bg-rose-950/90 shadow-rose-500/30'
              : isWarning
                ? 'border-amber-300/80 bg-[#1F120C]/90 shadow-amber-500/20'
                : isHumanTurn
                  ? 'border-emerald-300/75 bg-[#1F120C]/90 shadow-emerald-500/20'
                  : 'border-white/25 bg-[#1F120C]/85 shadow-black/40';

            const barColor = isLowTimer
              ? 'bg-gradient-to-r from-rose-500 to-red-400'
              : isWarning
                ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                : isHumanTurn
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-300'
                  : 'bg-gradient-to-r from-sky-400 to-cyan-300';

            const timeTextColor = isLowTimer
              ? 'text-rose-200'
              : isWarning
                ? 'text-amber-300'
                : isHumanTurn
                  ? 'text-emerald-300'
                  : 'text-sky-200';

            return (
              <div
                className={`w-full max-w-xs rounded-2xl border px-3.5 py-2 shadow-2xl backdrop-blur-md transition-colors sm:max-w-sm ${cardStyle}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-xs font-black tracking-wide text-white sm:text-sm">
                      {isHumanTurn
                        ? '✨ Lượt của bạn!'
                        : `⏳ Lượt: ${currentPlayer?.name ?? '...'}`}
                    </span>
                    {isLowTimer && (
                      <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                        Nhanh tay!
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 shrink-0 font-mono text-xl font-black leading-none tabular-nums sm:text-2xl ${timeTextColor}`}
                  >
                    <Clock className="h-5 w-5" />
                    <span>{turnSecondsLeft}s</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-linear ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}

          {gameState.pending?.kind === 'draw' && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/60 bg-rose-950/90 px-4 py-1 text-xs font-black text-rose-100 shadow-md">
              <Download className="h-3.5 w-3.5 text-rose-300" />
              <span>Xẻng Tuyết cộng dồn: +{gameState.pending.count} lá! (Đánh Xẻng / Thuốc Tàng Hình hoặc bấm Rút)</span>
            </div>
          )}

          {gameState.activeBomb && (
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1 text-xs font-black shadow-md ${
                predictedBombVictim?.id === humanId
                  ? 'animate-pulse border-red-300 bg-red-950/92 text-red-100'
                  : 'border-amber-400/60 bg-amber-950/90 text-amber-200'
              }`}
            >
              <Bomb className="h-3.5 w-3.5 text-red-400" />
              <span>
                Bom Kẹo: còn {gameState.activeBomb.fuse} lượt → dự kiến nổ vào{' '}
                <strong>{predictedBombVictim?.name ?? '...'}</strong> (+4 lá)!
              </span>
              <span className="hidden opacity-85 sm:inline">
                {' '}· Đảo chiều / Đóng băng để đổi mục tiêu
              </span>
            </div>
          )}

          {(gameState.lastEffectBanner || latestLog) && (
            <div className="max-w-xl truncate rounded-full border border-amber-900/40 bg-[#1B110B]/80 px-4 py-1 text-xs font-semibold text-amber-100/90 shadow-md">
              {gameState.lastEffectBanner ?? latestLog?.text}
            </div>
          )}

          {gamesPlayed === 0 && !dismissedTip && gameState.winnerId === null && (
            <div className="pointer-events-auto flex max-w-2xl items-center gap-2 rounded-2xl border border-sky-400/40 bg-sky-950/90 px-3.5 py-1.5 text-xs font-semibold text-sky-100 shadow-md">
              <span>
                <strong>Mẹo nhanh:</strong> Bấm lá bài 3D sáng để đánh · Nhấn <strong>Space</strong> để rút · Khi còn 1 lá nhớ bấm <strong>Hô PAWS!</strong>
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

      {/* ================= PENALTY REASON TOAST (WHEN HUMAN GAINS EXTRA CARDS) ================= */}
      {penaltyNotice && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4"
        >
          <div className="inline-flex items-center gap-2 rounded-2xl border-2 border-rose-400/80 bg-rose-950/95 px-4 py-2 text-xs font-black text-rose-100 shadow-[0_10px_30px_rgba(225,29,72,0.45)] sm:text-sm">
            <Bomb className="h-4 w-4 text-rose-300" />
            <span>{penaltyNotice}</span>
          </div>
        </div>
      )}

      {/* ================= COMPACT NON-BLOCKING BOTTOM HUD BAR ================= */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center px-3 sm:px-6">
        <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2.5 rounded-2xl border-2 border-amber-900/40 bg-[#24160f]/90 px-4 py-2.5 shadow-2xl backdrop-blur-md">
          {/* Human Player Animal Badge + Card Count */}
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white/40"
              style={{ backgroundColor: humanAnimalMeta.accentHex }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-[#FFFBF4] sm:text-sm">
                {humanPlayer.name} ({humanAnimalMeta.name})
              </span>
              {humanPlayer.calledPaws && (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-[#2C1B11]">
                  PAWS!
                </span>
              )}
              {predictedBombVictim?.id === humanId && gameState.activeBomb && (
                <span className="animate-pulse inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
                  <Bomb className="h-3 w-3" />
                  <span>Sắp nổ ({gameState.activeBomb.fuse})</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-0.5 text-xs font-black text-amber-200">
                <Layers className="h-3.5 w-3.5" />
                <span>{humanPlayer.hand.length} lá</span>
              </span>
              <span className="hidden text-[11px] font-semibold text-amber-200/70 sm:inline">
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
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                canCallPaws
                  ? 'btn-tactile-amber cursor-pointer'
                  : 'cursor-not-allowed border border-white/10 bg-white/5 text-white/35'
              }`}
            >
              <Flame className={`h-4 w-4 ${canCallPaws ? 'text-amber-950' : 'text-white/35'}`} />
              <span>Hô PAWS!</span>
            </button>

            <button
              type="button"
              onClick={handleHumanDraw}
              disabled={!isHumanTurn}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition-all focus-visible:outline-2 focus-visible:outline-amber-300 ${
                isHumanTurn
                  ? 'btn-tactile-sky cursor-pointer'
                  : 'cursor-not-allowed border border-white/10 bg-white/5 text-white/40'
              }`}
            >
              <Download className="h-4 w-4" />
              <span>
                {(() => {
                  if (gameState.pending?.kind === 'draw') {
                    return `Nhận +${gameState.pending.count} lá`;
                  }
                  return 'Rút 1 lá (Space)';
                })()}
              </span>
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
      <PawsShoutOverlay shout={pawsShout} />
    </div>
  );
}
