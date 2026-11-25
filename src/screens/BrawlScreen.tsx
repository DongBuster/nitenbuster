import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { playSfx, setAudioPreferences } from '../audio/soundEngine';
import { useKeyboardMouse } from '../brawl/input/useKeyboardMouse';
import { ArenaScene } from '../brawl/render/ArenaScene';
import {
  createSetupMatchState,
  getHumanFinalRank,
  matchReducer,
} from '../brawl/sim/matchStore';
import type { BrawlDifficulty, HudSnapshot } from '../brawl/sim/types';
import { BrawlHud } from '../brawl/ui/BrawlHud';
import { BrawlResult } from '../brawl/ui/BrawlResult';
import { BrawlSetupPanel } from '../brawl/ui/BrawlSetupPanel';
import { useProfileStore } from '../store/profileStore';

export interface BrawlScreenProps {
  onBackToModeSelect: () => void;
}

const INITIAL_HUD: HudSnapshot = {
  aliveCount: 4,
  totalFighters: 4,
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
  playerInverted: false,
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

export function BrawlScreen({ onBackToModeSelect }: BrawlScreenProps) {
  const {
    cookies,
    selectedAnimal,
    equippedAccessory,
    settings,
    selectAnimal,
    updateSettings,
    recordBrawlResult,
  } = useProfileStore();

  const [botCount, setBotCount] = useState<number>(() => settings.botCount);
  const [difficulty, setDifficulty] = useState<BrawlDifficulty>(
    () => settings.difficulty,
  );
  const [match, dispatch] = useReducer(matchReducer, undefined, () =>
    createSetupMatchState(settings.difficulty, settings.botCount),
  );

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [paused, setPaused] = useState<boolean>(false);
  const [matchNonce, setMatchNonce] = useState<number>(1);
  const [cookiesEarned, setCookiesEarned] = useState<number>(0);
  const recordedRef = useRef<boolean>(false);

  const controlsEnabled = match.phase === 'fighting' && !paused;
  const { consumeInput, pressedSkills, triggerSkill, setVirtualHold } =
    useKeyboardMouse(controlsEnabled);

  // Sync audio preferences
  useEffect(() => {
    setAudioPreferences({ sfxEnabled: settings.sfxEnabled });
  }, [settings.sfxEnabled]);

  // Countdown tick (3 -> 2 -> 1 -> CHIẾN)
  useEffect(() => {
    if (match.phase !== 'countdown' || paused) return;
    playSfx('countdown');
    const timer = window.setTimeout(() => {
      if (match.countdownSec <= 1) {
        playSfx('roundStart');
      }
      dispatch({ type: 'TICK_COUNTDOWN' });
    }, 950);
    return () => window.clearTimeout(timer);
  }, [match.phase, match.countdownSec, paused]);

  // Round over auto-advance timer (2.5s)
  useEffect(() => {
    if (match.phase !== 'roundOver') return;
    const timer = window.setTimeout(() => {
      dispatch({ type: 'ADVANCE_AFTER_ROUND' });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [match.phase]);

  // Award Cookies once per finished match
  useEffect(() => {
    if (match.phase !== 'matchOver' || recordedRef.current) return;
    recordedRef.current = true;
    const rank = getHumanFinalRank(match.scores);
    playSfx(rank === 1 ? 'win' : 'lose');
    const reward = recordBrawlResult(rank);
    setCookiesEarned(reward);
  }, [match.phase, match.scores, recordBrawlResult]);

  // Escape & tab visibility pause handling
  useEffect(() => {
    if (match.phase !== 'fighting' && match.phase !== 'countdown') {
      setPaused(false);
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        setPaused((p) => !p);
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        setPaused(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [match.phase]);

  const startNewMatch = useCallback(() => {
    recordedRef.current = false;
    setCookiesEarned(0);
    setPaused(false);
    setMatchNonce((n) => n + 1);
    dispatch({
      type: 'START_MATCH',
      humanAnimal: selectedAnimal,
      humanAccessory: equippedAccessory[selectedAnimal] ?? [],
      botCount,
      difficulty,
    });
  }, [selectedAnimal, equippedAccessory, botCount, difficulty]);

  const handleEliminateBatch = useCallback((ids: string[]) => {
    dispatch({ type: 'ELIMINATE_BATCH', ids });
  }, []);

  if (match.phase === 'setup') {
    return (
      <BrawlSetupPanel
        selectedAnimal={selectedAnimal}
        equippedAccessory={equippedAccessory}
        cookies={cookies}
        botCount={botCount}
        difficulty={difficulty}
        onSelectAnimal={selectAnimal}
        onChangeBotCount={setBotCount}
        onChangeDifficulty={setDifficulty}
        onStart={startNewMatch}
        onBackToModeSelect={onBackToModeSelect}
      />
    );
  }

  const roundKey = `brawl_m${matchNonce}_r${match.round}`;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#14243A] select-none">
      <ArenaScene
        roundKey={roundKey}
        fighters={match.fighters}
        difficulty={match.difficulty}
        phase={match.phase}
        paused={paused}
        consumeInput={consumeInput}
        onEliminateBatch={handleEliminateBatch}
        onHudSnapshot={setHud}
      />

      {match.phase !== 'matchOver' && (
        <BrawlHud
          match={match}
          hud={hud}
          paused={paused}
          controlsEnabled={controlsEnabled}
          pressedSkills={pressedSkills}
          onTriggerSkill={triggerSkill}
          onVirtualHold={setVirtualHold}
          sfxEnabled={settings.sfxEnabled}
          onToggleSfx={() =>
            updateSettings({ sfxEnabled: !settings.sfxEnabled })
          }
          onTogglePause={() => setPaused((p) => !p)}
          onExit={() => dispatch({ type: 'RETURN_TO_SETUP' })}
        />
      )}

      {match.phase === 'matchOver' && (
        <BrawlResult
          match={match}
          cookiesEarned={cookiesEarned}
          onPlayAgain={startNewMatch}
          onChangeSettings={() => dispatch({ type: 'RETURN_TO_SETUP' })}
          onBackToModeSelect={onBackToModeSelect}
        />
      )}
    </div>
  );
}

export default BrawlScreen;
