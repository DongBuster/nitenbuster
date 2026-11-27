import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playSfx, setAudioPreferences } from '../../audio/soundEngine';
import { useProfileStore } from '../../store/profileStore';
import { useKeyboardMouse } from '../input/useKeyboardMouse';
import { useBrawlRoom } from '../online/useBrawlRoom';
import { ArenaScene, type BrawlArenaOnlineConfig } from '../render/ArenaScene';
import { getHumanFinalRank } from '../sim/matchStore';
import type { HudSnapshot } from '../sim/types';
import { BrawlHud } from './BrawlHud';
import { BrawlOnlineLobby } from './BrawlOnlineLobby';
import { BrawlResult } from './BrawlResult';

export interface BrawlOnlineContainerProps {
  initialRoomCode?: string;
  onSwitchToOffline: () => void;
  onBackToModeSelect: () => void;
}

const INITIAL_ONLINE_HUD: HudSnapshot = {
  aliveCount: 2,
  totalFighters: 2,
  roundElapsedSec: 0,
  nextCollapseRing: 4,
  nextCollapseInSec: 32,
  isRingWarning: false,
  playerAlive: true,
  playerGrounded: true,
  playerBalance: 100,
  playerMaxBalance: 100,
  playerStunned: false,
  playerFrozen: false,
  playerSpeedLeft: 0,
  playerShieldLeft: 0,
  playerRollReadyPct: 1,
  playerRollCooldownLeft: 0,
  playerPunchReadyPct: 1,
  playerPunchCooldownLeft: 0,
  playerHeadbuttReadyPct: 1,
  playerHeadbuttCooldownLeft: 0,
  playerHeldItem: null,
  playerHeldAmmo: 0,
  playerGrabbingName: null,
  bannerText: null,
  koFeed: [],
};

export function BrawlOnlineContainer({
  initialRoomCode = '',
  onSwitchToOffline,
  onBackToModeSelect,
}: BrawlOnlineContainerProps) {
  const {
    cookies,
    selectedAnimal,
    equippedAccessory,
    settings,
    selectAnimal,
    updateSettings,
    recordBrawlResult,
  } = useProfileStore();

  const room = useBrawlRoom();
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_ONLINE_HUD);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [cookiesEarned, setCookiesEarned] = useState<number>(0);
  const recordedMatchNonceRef = useRef<number>(0);

  const match = room.match;
  const controlsEnabled =
    room.phase === 'playing' && match?.phase === 'fighting' && !menuOpen;
  const { consumeInput, pressedSkills, triggerSkill, setVirtualHold } =
    useKeyboardMouse(controlsEnabled);

  useEffect(() => {
    setAudioPreferences({ sfxEnabled: settings.sfxEnabled });
  }, [settings.sfxEnabled]);

  // Reset menu & reward state whenever a new match starts or returns to lobby
  useEffect(() => {
    if (room.phase !== 'playing') {
      setMenuOpen(false);
      setCookiesEarned(0);
    }
  }, [room.phase, room.matchNonce]);

  // Host drives countdown (3 -> 2 -> 1 -> fighting)
  useEffect(() => {
    if (
      !room.isHost ||
      room.phase !== 'playing' ||
      !match ||
      match.phase !== 'countdown'
    ) {
      return;
    }
    playSfx('countdown');
    const timer = window.setTimeout(() => {
      if (match.countdownSec <= 1) {
        playSfx('roundStart');
      }
      room.dispatchHostMatchAction({ type: 'TICK_COUNTDOWN' });
    }, 950);
    return () => window.clearTimeout(timer);
  }, [
    match,
    room.dispatchHostMatchAction,
    room.isHost,
    room.phase,
  ]);

  // Host drives roundOver -> next round / matchOver transition (2.5s)
  useEffect(() => {
    if (
      !room.isHost ||
      room.phase !== 'playing' ||
      !match ||
      match.phase !== 'roundOver'
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      room.dispatchHostMatchAction({ type: 'ADVANCE_AFTER_ROUND' });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [match, room.dispatchHostMatchAction, room.isHost, room.phase]);

  // Play countdown/start SFX for clients on synced state transitions
  useEffect(() => {
    if (room.isHost || room.phase !== 'playing' || !match) return;
    if (match.phase === 'countdown') {
      playSfx('countdown');
    } else if (match.phase === 'fighting') {
      playSfx('roundStart');
    }
  }, [match?.phase, match?.countdownSec, room.isHost, room.phase]);

  // Award Cookies once per finished online match
  useEffect(() => {
    if (
      room.phase !== 'playing' ||
      !match ||
      match.phase !== 'matchOver' ||
      recordedMatchNonceRef.current === room.matchNonce
    ) {
      return;
    }
    recordedMatchNonceRef.current = room.matchNonce;
    const rank = getHumanFinalRank(match.scores, room.myPeerId);
    playSfx(rank === 1 ? 'win' : 'lose');
    const reward = recordBrawlResult(rank);
    setCookiesEarned(reward);
  }, [
    match,
    recordBrawlResult,
    room.matchNonce,
    room.myPeerId,
    room.phase,
  ]);

  // Escape opens online menu without freezing remote physics
  useEffect(() => {
    if (room.phase !== 'playing' || !match || match.phase === 'matchOver') {
      setMenuOpen(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        setMenuOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [match, room.phase]);

  const roundKey = match
    ? `brawl_online_${room.roomCode}_m${room.matchNonce}_r${match.round}`
    : `brawl_online_idle`;

  const handleEliminateBatch = useCallback(
    (ids: string[]) => {
      if (!room.isHost) return;
      room.dispatchHostMatchAction({ type: 'ELIMINATE_BATCH', ids });
    },
    [room.dispatchHostMatchAction, room.isHost],
  );

  const onlineConfig: BrawlArenaOnlineConfig = useMemo(
    () => ({
      role: room.isHost ? 'host' : 'client',
      localFighterId: room.myPeerId,
      getRemoteInputs: room.isHost ? room.getRemoteInputs : undefined,
      onBroadcastSnapshot: room.isHost ? room.broadcastSnapshot : undefined,
      onSendClientInput: !room.isHost
        ? (input) => room.sendClientInput(roundKey, input)
        : undefined,
      interpolatorRef: room.interpolatorRef,
    }),
    [
      room.broadcastSnapshot,
      room.getRemoteInputs,
      room.interpolatorRef,
      room.isHost,
      room.myPeerId,
      room.sendClientInput,
      roundKey,
    ],
  );

  if (room.phase !== 'playing' || !match) {
    return (
      <BrawlOnlineLobby
        room={room}
        initialRoomCode={initialRoomCode}
        selectedAnimal={selectedAnimal}
        equippedAccessory={equippedAccessory}
        cookies={cookies}
        onSelectAnimal={selectAnimal}
        onSwitchToOffline={onSwitchToOffline}
        onBackToModeSelect={onBackToModeSelect}
      />
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#14243A] select-none">
      <ArenaScene
        roundKey={roundKey}
        fighters={match.fighters}
        difficulty={match.difficulty}
        phase={match.phase}
        paused={false}
        consumeInput={consumeInput}
        onEliminateBatch={handleEliminateBatch}
        onHudSnapshot={setHud}
        onlineConfig={onlineConfig}
      />

      {match.phase !== 'matchOver' && (
        <BrawlHud
          match={match}
          hud={hud}
          paused={menuOpen}
          controlsEnabled={controlsEnabled}
          pressedSkills={pressedSkills}
          onTriggerSkill={triggerSkill}
          onVirtualHold={setVirtualHold}
          sfxEnabled={settings.sfxEnabled}
          onToggleSfx={() =>
            updateSettings({ sfxEnabled: !settings.sfxEnabled })
          }
          onTogglePause={() => setMenuOpen((v) => !v)}
          onExit={room.leaveRoom}
          localFighterId={room.myPeerId}
          roomCode={room.roomCode}
          isHost={room.isHost}
          isOnline={true}
          exitLabel="Rời Phòng"
        />
      )}

      {match.phase === 'matchOver' && (
        <BrawlResult
          match={match}
          cookiesEarned={cookiesEarned}
          onPlayAgain={room.startOnlineMatch}
          onChangeSettings={room.returnToLobby}
          onBackToModeSelect={room.leaveRoom}
          localFighterId={room.myPeerId}
          isOnline={true}
          isHost={room.isHost}
          secondaryLabel="Về Phòng Chờ"
          exitLabel="Rời Phòng"
        />
      )}
    </div>
  );
}
