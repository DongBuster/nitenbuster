import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ANIMALS,
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
import { CARD_META, COLOR_THEME } from '../components/Card/cardMeta';
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

export interface OnlineGame3DScreenProps {
  room: OnlineRoomController;
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

export function OnlineGame3DScreen({
  room,
  onBackToMenu,
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
  const [pawsShout, setPawsShout] = useState<PawsShoutInfo | null>(null);
  const prevCalledPawsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!gameState) return;
    const currentSet = new Set(
      gameState.players.filter((p) => p.calledPaws).map((p) => p.id),
    );
    const newlyCalled = gameState.players.find(
      (p) => p.calledPaws && !prevCalledPawsRef.current.has(p.id),
    );
    prevCalledPawsRef.current = currentSet;

    if (newlyCalled && gameState.winnerId === null) {
      playSfx('paws');
      setPawsShout({
        key: `${gameState.turnCount}-${newlyCalled.id}-${Date.now()}`,
        playerName: newlyCalled.name,
        animal: newlyCalled.animal,
      });
      const timer = window.setTimeout(() => setPawsShout(null), 1700);
      return () => window.clearTimeout(timer);
    }
  }, [gameState]);

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
      const earned = recordMatchResult(didWin);
      setCookiesEarned(earned);
    } else if (!gameState.winnerId && recordedWinnerRef.current !== null) {
      recordedWinnerRef.current = null;
      setCookiesEarned(0);
    }
  }, [gameState, recordMatchResult, room.myPeerId]);

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
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              playSfx('click');
              room.leaveRoom();
              onBackToMenu();
            }}
            className="cursor-pointer rounded-xl border border-white/20 bg-slate-900/85 px-3 py-1.5 text-xs font-black text-white shadow-lg backdrop-blur-md transition hover:bg-slate-800"
          >
            ← Rời Phòng
          </button>

          <span className="rounded-xl border border-sky-400/40 bg-sky-500/20 px-2.5 py-1.5 font-mono text-xs font-black text-sky-200 shadow-lg backdrop-blur-md">
            🌐 Phòng: {room.roomCode}
          </span>

          <span
            className={`rounded-xl border px-2.5 py-1.5 text-xs font-black shadow-lg backdrop-blur-md ${
              isLowTimer
                ? 'animate-pulse border-rose-300 bg-rose-600/90 text-white'
                : 'border-white/20 bg-slate-900/85 text-amber-200'
            }`}
          >
            ⏱️ {room.turnSecondsLeft}s
          </span>

          <div
            className="flex items-center gap-1.5 rounded-xl border border-white/40 px-2.5 py-1.5 text-xs font-black shadow-lg"
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
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200/35 bg-slate-900/90 px-2.5 py-1.5 text-xs font-black text-amber-100 shadow-lg backdrop-blur-md">
                <span aria-hidden="true">🃏</span>
                <span>Trên bàn: {label}</span>
              </div>
            );
          })()}

          <span className="rounded-xl border border-white/15 bg-slate-900/85 px-2.5 py-1.5 text-xs font-bold text-slate-200 shadow-lg backdrop-blur-md">
            {gameState.direction === 1 ? '↻ Thuận chiều' : '↺ Ngược chiều'}
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
            className="cursor-pointer rounded-xl border border-white/20 bg-slate-900/85 px-2.5 py-1.5 text-xs font-black text-white shadow-lg backdrop-blur-md transition hover:bg-slate-800"
          >
            {settings.sfxEnabled ? '🔊' : '🔇'}
          </button>

          <button
            type="button"
            onClick={() => {
              playSfx('click');
              updateSettings({ bgmEnabled: !settings.bgmEnabled });
            }}
            title={settings.bgmEnabled ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
            className={`cursor-pointer rounded-xl border px-2.5 py-1.5 text-xs font-black shadow-lg backdrop-blur-md transition ${
              settings.bgmEnabled
                ? 'border-amber-300/60 bg-amber-400/25 text-amber-200'
                : 'border-white/20 bg-slate-900/85 text-slate-300 hover:bg-slate-800'
            }`}
          >
            🎵
          </button>

          <button
            type="button"
            onClick={() => {
              playSfx('click');
              setShowRules(true);
            }}
            className="cursor-pointer rounded-xl border border-white/20 bg-slate-900/85 px-3 py-1.5 text-xs font-black text-white shadow-lg backdrop-blur-md transition hover:bg-slate-800"
          >
            📖 Luật
          </button>

          <button
            type="button"
            onClick={() => {
              playSfx('click');
              setShowTutorial(true);
            }}
            className="cursor-pointer rounded-xl border border-amber-300/40 bg-amber-500/20 px-3 py-1.5 text-xs font-black text-amber-200 shadow-lg backdrop-blur-md transition hover:bg-amber-500/30"
          >
            🎓 Hướng Dẫn
          </button>
        </div>
      </header>

      {/* Center Status Banners (Log ticker, Pending Shovel, Bomb, Emote) */}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-20 flex flex-col items-center gap-1.5 px-4">
        {gameState.pending?.kind === 'draw' && (
          <div className="rounded-full border border-rose-300/70 bg-rose-600/95 px-4 py-1 text-xs font-black text-white shadow-lg">
            ⛏️ Đang cộng dồn phạt +{gameState.pending.count} lá! (Đánh Xẻng / Tàng Hình hoặc Rút)
          </div>
        )}

        {gameState.activeBomb && (
          <div className="rounded-full border border-orange-300/70 bg-orange-600/90 px-3.5 py-1 text-xs font-black text-white shadow-lg">
            💣 Bom Kẹo đang cháy — nổ sau {gameState.activeBomb.fuse} lượt (+4 lá)!
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

      {/* Bottom Compact HUD */}
      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-end justify-between gap-2 p-3 sm:p-4">
        {/* Human Player Pill */}
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-white/20 bg-slate-900/90 px-3.5 py-2 shadow-xl backdrop-blur-md">
          <span
            className="h-3.5 w-3.5 rounded-full border border-white/60"
            style={{ backgroundColor: humanAnimalMeta.accentHex }}
          />
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black text-white">
              <span>{humanPlayer.name}</span>
              <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">
                🎴 {humanPlayer.hand.length}
              </span>
            </div>
            <div className="text-[11px] font-bold text-amber-300">
              {isHumanTurn
                ? '✨ Đến lượt của bạn!'
                : `⏳ Lượt của ${currentPlayer?.name ?? '...'}`}
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
            className={`rounded-2xl px-4 py-2.5 text-xs font-black shadow-lg transition sm:text-sm ${
              canCallPaws
                ? 'cursor-pointer animate-pulse bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:brightness-110'
                : 'cursor-not-allowed border border-white/15 bg-slate-900/75 text-slate-500'
            }`}
          >
            🐾 Hô PAWS!
          </button>

          <button
            type="button"
            disabled={!isHumanTurn}
            onClick={handleDrawCard}
            className={`rounded-2xl px-4 py-2.5 text-xs font-black shadow-lg transition sm:text-sm ${
              isHumanTurn
                ? 'cursor-pointer border border-amber-300/60 bg-sky-500 text-white hover:bg-sky-400'
                : 'cursor-not-allowed border border-white/15 bg-slate-900/75 text-slate-500'
            }`}
          >
            {(() => {
              const base =
                gameState.pending?.kind === 'draw'
                  ? gameState.pending.count
                  : 1;
              const bombExtra =
                isHumanTurn &&
                gameState.activeBomb &&
                gameState.activeBomb.fuse <= 1
                  ? 4
                  : 0;
              const guaranteed = base + bombExtra;
              if (guaranteed > 1) {
                const parts: string[] = [];
                if (gameState.pending?.kind === 'draw') {
                  parts.push(`${gameState.pending.count} Xẻng`);
                } else {
                  parts.push('1 rút');
                }
                if (bombExtra > 0) parts.push('4 Bom');
                return `📥 Nhận +${guaranteed} lá (${parts.join(' + ')})`;
              }
              return '📥 Rút 1 lá (Space)';
            })()}
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

      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />

      <TutorialOverlay
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
      <PawsShoutOverlay shout={pawsShout} />
    </div>
  );
}
