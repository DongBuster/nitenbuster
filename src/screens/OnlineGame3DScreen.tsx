import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bomb,
  BookOpen,
  Clock,
  Download,
  Flame,
  Globe,
  GraduationCap,
  Layers,
  Music,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ANIMALS,
  getPredictedBombVictim,
  isPlayable,
  needsColorChoice,
  needsTargetChoice,
  type CardData,
  type CardType,
  type Color,
} from '../engine';
import { ONLINE_EMOTES } from '../online/protocol';
import type { OnlineRoomController } from '../online/useOnlineRoom';
import { GameTableScene3D } from '../scene3d/GameTableScene3D';
import { CARD_META, COLOR_THEME, CardInfoButton } from '../components/Card';
import { AnimalAvatar } from '../components/AnimalAvatar';
import {
  ColorPickerModal,
  ResultModal,
  TargetPickerModal,
} from '../components/Modals/WildModals';
import { RulesModal } from '../components/Modals/RulesModal';
import { TutorialOverlay } from '../components/Modals/TutorialOverlay';
import { PawsShoutOverlay } from '../components/Modals/PawsShoutOverlay';
import { useMatchNotices } from './useMatchNotices';
import {
  playSfx,
  setAudioPreferences,
  startBgm,
  stopBgm,
  type SfxType,
} from '../audio/soundEngine';
import { useProfileStore } from '../store/profileStore';

export interface OnlineGame3DScreenProps {
  room: OnlineRoomController;
  onBackToMenu: () => void;
  embeddedEvent?: boolean;
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

export function OnlineGame3DScreen({
  room,
  onBackToMenu,
  embeddedEvent = false,
}: OnlineGame3DScreenProps) {
  const { settings, updateSettings, recordMatchResult } = useProfileStore();
  const gameState = room.gameState;

  const [pendingColorCard, setPendingColorCard] = useState<CardData | null>(
    null,
  );
  const [pendingTargetCard, setPendingTargetCard] = useState<CardData | null>(
    null,
  );
  const [showRules, setShowRules] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [cookiesEarned, setCookiesEarned] = useState<number>(0);

  const recordedWinnerRef = useRef<string | null>(null);
  const lastTurnCountRef = useRef<number>(-1);

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

  const humanPlayer = useMemo(() => {
    if (!gameState) return null;
    return (
      gameState.players.find((p) => p.id === room.myPeerId) ??
      gameState.players[0] ??
      null
    );
  }, [gameState, room.myPeerId]);

  const handlePawsShoutSfx = useCallback(() => {
    playSfx('paws');
  }, []);

  const { penaltyNotice, pawsShout } = useMatchNotices({
    gameState,
    humanPlayer,
    onPawsShout: handlePawsShoutSfx,
  });

  const currentPlayer = gameState
    ? gameState.players[gameState.currentIndex]
    : null;
  const isHumanTurn = Boolean(
    gameState &&
      humanPlayer &&
      currentPlayer?.id === humanPlayer.id &&
      gameState.winnerId === null,
  );

  const playableCardIds = useMemo(() => {
    if (!gameState || !humanPlayer || !isHumanTurn) return [];
    return humanPlayer.hand
      .filter((c) => isPlayable(c, gameState))
      .map((c) => c.id);
  }, [gameState, humanPlayer, isHumanTurn]);

  // SFX feedback on turn changes and match winner
  useEffect(() => {
    if (!gameState) return;
    if (gameState.turnCount !== lastTurnCountRef.current) {
      if (lastTurnCountRef.current !== -1 && gameState.winnerId === null) {
        const top = gameState.discardPile[gameState.discardPile.length - 1];
        if (top) {
          playSfx(getCardSfx(top.type));
        }
      }
      lastTurnCountRef.current = gameState.turnCount;
    }

    if (gameState.winnerId && recordedWinnerRef.current !== gameState.winnerId) {
      recordedWinnerRef.current = gameState.winnerId;
      const didWin = gameState.winnerId === room.myPeerId;
      playSfx(didWin ? 'win' : 'lose');
      if (!embeddedEvent) {
        const earned = recordMatchResult(didWin);
        setCookiesEarned(earned);
      }
    } else if (!gameState.winnerId && recordedWinnerRef.current !== null) {
      recordedWinnerRef.current = null;
      setCookiesEarned(0);
    }
  }, [embeddedEvent, gameState, recordMatchResult, room.myPeerId]);

  const handleCardClick = useCallback(
    (card: CardData) => {
      if (!isHumanTurn) return;
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
      playSfx(getCardSfx(card.type));
      room.sendPlayCard(card.id);
    },
    [isHumanTurn, room],
  );

  const handleSelectWildColor = useCallback(
    (color: Color) => {
      if (!pendingColorCard) return;
      playSfx(getCardSfx(pendingColorCard.type));
      room.sendPlayCard(pendingColorCard.id, { chosenColor: color });
      setPendingColorCard(null);
    },
    [pendingColorCard, room],
  );

  const handleSelectTarget = useCallback(
    (targetPlayerId: string) => {
      if (!pendingTargetCard) return;
      playSfx('crossbow');
      room.sendPlayCard(pendingTargetCard.id, { targetPlayerId });
      setPendingTargetCard(null);
    },
    [pendingTargetCard, room],
  );

  const handleDrawCard = useCallback(() => {
    if (!isHumanTurn) return;
    playSfx('draw');
    room.sendDrawCard();
  }, [isHumanTurn, room]);

  const handleCallPaws = useCallback(() => {
    playSfx('paws');
    room.sendCallPaws();
  }, [room]);

  const handleCatchPaws = useCallback(
    (targetId: string) => {
      playSfx('paws');
      room.sendCatchPaws(targetId);
    },
    [room],
  );

  // Space shortcut to draw card on human's turn
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (
        pendingColorCard ||
        pendingTargetCard ||
        showRules ||
        showTutorial ||
        !isHumanTurn
      ) {
        return;
      }
      e.preventDefault();
      handleDrawCard();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleDrawCard,
    isHumanTurn,
    pendingColorCard,
    pendingTargetCard,
    showRules,
    showTutorial,
  ]);

  if (!gameState || !humanPlayer) {
    return null;
  }

  const humanAnimalMeta =
    ANIMALS.find((a) => a.id === humanPlayer.animal) ?? ANIMALS[0];
  const opponents = gameState.players.filter((p) => p.id !== humanPlayer.id);
  const activeTheme = COLOR_THEME[gameState.currentColor];
  const latestLog =
    gameState.logs.length > 0
      ? gameState.logs[gameState.logs.length - 1]
      : null;

  const canCallPaws =
    gameState.winnerId === null &&
    humanPlayer.hand.length === 1 &&
    !humanPlayer.calledPaws;

  const isLowTimer = room.turnSecondsLeft <= 5 && gameState.winnerId === null;
  const predictedBombVictim = getPredictedBombVictim(gameState);

  const lastEmoteSender = room.lastEmote
    ? gameState.players.find((p) => p.id === room.lastEmote?.peerId)?.name ??
      'Người chơi'
    : null;

  return (
    <div
      className={`relative h-screen w-screen overflow-hidden bg-[#261810] text-white select-none ${
        settings.colorblindMode ? 'grayscale' : ''
      }`}
    >
      {/* Full-Viewport 3D Game Table */}
      <GameTableScene3D
        state={gameState}
        humanPlayerId={room.myPeerId}
        isHumanTurn={isHumanTurn}
        targetPickingMode={Boolean(pendingTargetCard)}
        playableCardIds={playableCardIds}
        equippedAccessory={room.roomAccessories}
        onPlayCard={handleCardClick}
        onDrawCard={handleDrawCard}
        onSelectTarget={handleSelectTarget}
        onCatchPaws={handleCatchPaws}
      />

      {/* Top HUD */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
        {/* Left: Leave + Room Code + Timer + Active Color + Direction */}
        <div className={`pointer-events-auto flex flex-wrap items-center gap-2 ${embeddedEvent ? 'mt-11' : ''}`}>
          {!embeddedEvent && (
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                room.leaveRoom();
                onBackToMenu();
              }}
              className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/20 px-3 py-1.5 text-xs font-black text-white shadow-md transition"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-amber-300" />
              <span>Rời Phòng</span>
            </button>
          )}

          <span className="inline-flex items-center gap-1 rounded-xl border border-sky-400/40 bg-sky-950/80 px-2.5 py-1.5 font-mono text-xs font-black text-sky-200 shadow-md">
            <Globe className="h-3.5 w-3.5 text-sky-400" />
            <span>Phòng: {room.roomCode}</span>
          </span>

          <div
            className="flex items-center gap-1.5 rounded-xl border border-white/40 px-2.5 py-1.5 text-xs font-black shadow-md"
            style={{
              backgroundColor: activeTheme.primary,
              color: activeTheme.cornerText,
            }}
          >
            <span>{activeTheme.shapeSymbol}</span>
            <span>{activeTheme.label}</span>
          </div>

          {(() => {
            const top =
              gameState.discardPile[gameState.discardPile.length - 1];
            if (!top) return null;
            const label =
              top.type === 'basic'
                ? `Số ${top.value ?? 0}`
                : CARD_META[top.type].name;
            return (
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200/35 bg-[#26170F]/90 px-2.5 py-1.5 text-xs font-black text-amber-100 shadow-md">
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

          <span className="inline-flex items-center gap-1 rounded-xl border border-amber-900/40 bg-[#26170F]/85 px-2.5 py-1.5 text-xs font-bold text-slate-200 shadow-md">
            {gameState.direction === 1 ? (
              <RotateCw className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
            )}
            <span>{gameState.direction === 1 ? 'Thuận chiều' : 'Đảo chiều'}</span>
          </span>
        </div>

        {/* Right: Audio, Rules, Tutorial */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              updateSettings({ sfxEnabled: !settings.sfxEnabled });
            }}
            title={settings.sfxEnabled ? 'Tắt hiệu ứng âm thanh' : 'Bật hiệu ứng âm thanh'}
            className="btn-tactile-wood cursor-pointer rounded-xl border border-white/20 p-2 text-white shadow-md transition"
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
            title={settings.bgmEnabled ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
            className={`btn-tactile-wood cursor-pointer rounded-xl border p-2 shadow-md transition ${
              settings.bgmEnabled
                ? 'border-emerald-400/50 bg-emerald-950/80 text-emerald-300'
                : 'border-white/20 text-white/50'
            }`}
          >
            <Music className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              playSfx('click');
              setShowRules(true);
            }}
            className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1 rounded-xl border border-white/20 px-3 py-1.5 text-xs font-black text-white shadow-md transition"
          >
            <BookOpen className="h-3.5 w-3.5 text-amber-300" />
            <span>Luật</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playSfx('click');
              setShowTutorial(true);
            }}
            className="btn-tactile-wood inline-flex cursor-pointer items-center gap-1 rounded-xl border border-emerald-400/30 px-3 py-1.5 text-xs font-black text-emerald-200 shadow-md transition"
          >
            <GraduationCap className="h-3.5 w-3.5 text-emerald-400" />
            <span>Hướng Dẫn</span>
          </button>
        </div>
      </header>

      {/* Center Status Banners (Turn Timer, Pending Shovel, Bomb, Emote) */}
      <div className="pointer-events-none fixed inset-x-0 top-14 z-20 flex flex-col items-center gap-1.5 px-4 sm:top-16">
        {gameState.winnerId === null && (() => {
          const totalSec = Math.max(1, room.roomSettings.turnTimeSec);
          const pct = Math.max(0, Math.min(100, (room.turnSecondsLeft / totalSec) * 100));
          const isWarning = !isLowTimer && room.turnSecondsLeft <= 10;

          const cardStyle = isLowTimer
            ? 'animate-pulse border-rose-300/90 bg-rose-950/90 shadow-rose-500/30'
            : isWarning
              ? 'border-amber-300/80 bg-slate-950/90 shadow-amber-500/20'
              : isHumanTurn
                ? 'border-emerald-300/75 bg-slate-950/90 shadow-emerald-500/20'
                : 'border-white/25 bg-slate-950/85 shadow-black/40';

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
            <div className={`w-full max-w-xs rounded-2xl border px-3.5 py-2 shadow-2xl backdrop-blur-md transition-colors sm:max-w-sm ${cardStyle}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-xs font-black tracking-wide text-white sm:text-sm">
                    {isHumanTurn ? 'Lượt của bạn!' : `Lượt: ${currentPlayer?.name ?? '...'}`}
                  </span>
                  {isLowTimer && (
                    <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                      Nhanh tay!
                    </span>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1 shrink-0 font-mono text-xl font-black leading-none tabular-nums sm:text-2xl ${timeTextColor}`}>
                  <Clock className="h-5 w-5" />
                  <span>{room.turnSecondsLeft}s</span>
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
          <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/70 bg-rose-600/95 px-4 py-1 text-xs font-black text-white shadow-lg">
            <Download className="h-3.5 w-3.5" />
            <span>Đang cộng dồn phạt +{gameState.pending.count} lá! (Đánh Xẻng / Tàng Hình hoặc Rút)</span>
          </div>
        )}

        {gameState.activeBomb && (
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-black text-white shadow-lg ${
              predictedBombVictim?.id === humanPlayer.id
                ? 'animate-pulse border-red-200 bg-red-600/95'
                : 'border-orange-300/70 bg-orange-600/90'
            }`}
          >
            <Bomb className="h-3.5 w-3.5 text-white" />
            <span>
              Bom Kẹo: còn {gameState.activeBomb.fuse} lượt → dự kiến nổ vào{' '}
              {predictedBombVictim?.name ?? '...'} (+4 lá)!
            </span>
          </div>
        )}

        {latestLog && (
          <div className="max-w-lg truncate rounded-full border border-white/15 bg-slate-950/75 px-4 py-1 text-xs font-bold text-amber-100 shadow-md backdrop-blur-sm">
            {latestLog.text}
          </div>
        )}

        {room.lastEmote && lastEmoteSender && (
          <div className="rounded-full border border-sky-300/50 bg-sky-950/90 px-3.5 py-1 text-xs font-black text-sky-100 shadow-lg">
            {room.lastEmote.emote} <strong>{lastEmoteSender}:</strong>{' '}
            {room.lastEmote.text}
          </div>
        )}
      </div>

      {/* Penalty Reason Toast (when local player receives extra/penalty cards) */}
      {penaltyNotice && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4"
        >
          <div className="inline-flex items-center gap-2 rounded-2xl border-2 border-rose-300/80 bg-rose-950/95 px-4 py-2 text-xs font-black text-rose-100 shadow-[0_10px_30px_rgba(225,29,72,0.45)] backdrop-blur-md sm:text-sm">
            <AlertTriangle className="h-4 w-4 text-rose-300" />
            <span>{penaltyNotice}</span>
          </div>
        </div>
      )}

      {/* Bottom Compact HUD */}
      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-end justify-between gap-2 p-3 sm:p-4">
        {/* Human Player Pill */}
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-white/20 bg-slate-900/90 px-3 py-1.5 shadow-xl backdrop-blur-md">
          <AnimalAvatar animal={humanAnimalMeta.id} size="md" />
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black text-white">
              <span>{humanPlayer.name}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
                <Layers className="h-3 w-3" />
                <span>{humanPlayer.hand.length} lá</span>
              </span>
              {predictedBombVictim?.id === humanPlayer.id && gameState.activeBomb && (
                <span className="animate-pulse inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                  <Bomb className="h-3 w-3" />
                  <span>Tầm nổ ({gameState.activeBomb.fuse})</span>
                </span>
              )}
            </div>
            <div className="text-[11px] font-bold text-amber-300">
              {isHumanTurn
                ? 'Đến lượt của bạn!'
                : `Lượt của ${currentPlayer?.name ?? '...'}`}
            </div>
          </div>
        </div>

        {/* Quick Emoji Reaction Bar */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/15 bg-slate-900/85 px-2 py-1.5 shadow-xl backdrop-blur-md">
          {ONLINE_EMOTES.map((item) => (
            <button
              key={item.emote}
              type="button"
              title={item.text}
              onClick={() => {
                playSfx('click');
                room.sendEmote(item.emote, item.text);
              }}
              className="cursor-pointer rounded-xl px-2 py-1 text-base transition hover:scale-125 hover:bg-white/15"
            >
              {item.emote}
            </button>
          ))}
        </div>

        {/* PAWS & Draw Actions */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            disabled={!canCallPaws}
            onClick={handleCallPaws}
            className={`inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-black shadow-lg transition sm:text-sm ${
              canCallPaws
                ? 'btn-tactile-amber cursor-pointer'
                : 'cursor-not-allowed border border-white/15 bg-slate-900/75 text-slate-500'
            }`}
          >
            <Flame className={`h-4 w-4 ${canCallPaws ? 'text-amber-950' : 'text-slate-500'}`} />
            <span>Hô PAWS!</span>
          </button>

          <button
            type="button"
            disabled={!isHumanTurn}
            onClick={handleDrawCard}
            className={`inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-black shadow-lg transition sm:text-sm ${
              isHumanTurn
                ? 'btn-tactile-sky cursor-pointer text-white'
                : 'cursor-not-allowed border border-white/15 bg-slate-900/75 text-slate-500'
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
      </footer>

      {/* Modals */}
      <ColorPickerModal
        isOpen={Boolean(pendingColorCard)}
        cardType={pendingColorCard?.type}
        onSelectColor={handleSelectWildColor}
        onCancel={() => setPendingColorCard(null)}
      />

      <TargetPickerModal
        isOpen={Boolean(pendingTargetCard)}
        opponents={opponents}
        onSelectTarget={handleSelectTarget}
        onCancel={() => setPendingTargetCard(null)}
      />

      {!embeddedEvent && (
        <ResultModal
          isOpen={Boolean(gameState.winnerId)}
          state={gameState}
          humanPlayerId={room.myPeerId}
          cookiesEarned={cookiesEarned}
          onPlayAgain={() => {
            playSfx('click');
            if (room.isHost) {
              room.startOnlineMatch();
            } else {
              room.leaveRoom();
              onBackToMenu();
            }
          }}
          onBackToMenu={() => {
            playSfx('click');
            if (room.isHost) {
              room.returnToLobby();
            } else {
              room.leaveRoom();
              onBackToMenu();
            }
          }}
        />
      )}

      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />

      <TutorialOverlay
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
      <PawsShoutOverlay shout={pawsShout} />
    </div>
  );
}
