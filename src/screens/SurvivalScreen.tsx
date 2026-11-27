import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Crosshair,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { playSfx, setAudioPreferences } from '../audio/soundEngine.ts';
import { ANIMALS, type AnimalId } from '../engine/types.ts';
import {
  consumeRemoteSurvivalInputs,
  type RemoteSurvivalInputRecord,
} from '../survival/online/roomHelpers.ts';
import { SurvivalSnapshotInterpolator } from '../survival/online/snapshotInterpolation.ts';
import { useSurvivalRoom } from '../survival/online/useSurvivalRoom.ts';
import {
  SurvivalCanvas,
  type SurvivalCanvasHandle,
  type SurvivalCanvasOnlineProps,
} from '../survival/render/SurvivalCanvas.tsx';
import { GEARS, WEAPONS } from '../survival/sim/catalog.ts';
import type { CreateWorldConfig, CreateWorldPlayerConfig } from '../survival/sim/engine.ts';
import { getSurvivalMapMeta } from '../survival/sim/maps.ts';
import type {
  GearId,
  SurvivalHudSnapshot,
  SurvivalMapId,
  SurvivalMatchSummary,
  SurvivalMode,
  WeaponId,
} from '../survival/sim/types.ts';
import {
  LevelUpModal,
  SURVIVAL_FOCUS_RING_CLASS,
  SurvivalDialogShell,
  setNativeAutofocus,
} from '../survival/ui/LevelUpModal.tsx';
import { SurvivalHud } from '../survival/ui/SurvivalHud.tsx';
import { SurvivalLobby } from '../survival/ui/SurvivalLobby.tsx';
import { SurvivalResultModal } from '../survival/ui/SurvivalResultModal.tsx';
import { useProfileStore } from '../store/profileStore.ts';

export interface SurvivalScreenProps {
  initialRoomCode?: string;
  onBackToModeSelect: () => void;
}

interface SurvivalSettlementState {
  reward: number;
  isNewBestScore: boolean;
  isNewBestTime: boolean;
}

const PLAYER_NAME_STORAGE_KEY = 'paws_survival_name_v1';
const PROGRAMMATIC_CLOSE = '__programmatic__';

const EMPTY_SETTLEMENT: SurvivalSettlementState = {
  reward: 0,
  isNewBestScore: false,
  isNewBestTime: false,
};

const BOT_SHORT_NAMES: Record<AnimalId, string> = {
  dog: 'Bot Cún',
  cat: 'Bot Mèo',
  duck: 'Bot Vịt',
  shark: 'Bot Cá Mập',
  dino: 'Bot Khủng Long',
  panda: 'Bot Panda',
  chicken: 'Bot Gà',
  bunny: 'Bot Thỏ',
};

function readInitialPlayerName(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'Bạn';
  }
  try {
    const saved = window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
    if (saved && saved.trim().length > 0) {
      return saved.trim().slice(0, 18);
    }
  } catch {
    // Ignore storage read errors
  }
  return 'Bạn';
}

function persistPlayerName(name: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const clean = name.trim().slice(0, 18);
    if (clean.length > 0) {
      window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, clean);
    } else {
      window.localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
    }
  } catch {
    // Ignore quota / storage errors
  }
}

function generateSeed32(): number {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] || 1;
  }
  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
}

function buildOfflineWorldConfig(params: {
  mode: 'solo' | 'bot_team';
  mapId: SurvivalMapId;
  playerName: string;
  selectedAnimal: AnimalId;
  selectedWeapon: WeaponId;
  selectedGear: GearId;
  botCount: number;
  nonce: number;
}): CreateWorldConfig {
  const seed = generateSeed32();
  const matchId = `surv-${params.mode}-${seed.toString(36)}-${Date.now().toString(36)}-${params.nonce}`;

  const players: CreateWorldPlayerConfig[] = [
    {
      id: 'player_1',
      name: params.playerName.trim() || 'Bạn',
      animal: params.selectedAnimal,
      weaponId: params.selectedWeapon,
      gearId: params.selectedGear,
      isBot: false,
    },
  ];

  if (params.mode === 'bot_team') {
    const count = Math.max(1, Math.min(3, Math.floor(params.botCount)));
    const otherAnimals = ANIMALS.map((a) => a.id).filter(
      (id) => id !== params.selectedAnimal,
    );
    const otherWeapons = WEAPONS.map((w) => w.id).filter(
      (id) => id !== params.selectedWeapon,
    );
    const otherGears = GEARS.map((g) => g.id).filter(
      (id) => id !== params.selectedGear,
    );

    for (let i = 0; i < count; i += 1) {
      const animal = otherAnimals[i % otherAnimals.length];
      const weaponId = otherWeapons[i % otherWeapons.length] ?? params.selectedWeapon;
      const gearId = otherGears[i % otherGears.length] ?? params.selectedGear;
      players.push({
        id: `bot_${i + 1}`,
        name: BOT_SHORT_NAMES[animal],
        animal,
        weaponId,
        gearId,
        isBot: true,
      });
    }
  }

  return {
    matchId,
    mode: params.mode,
    mapId: params.mapId,
    seed,
    players,
  };
}

interface SurvivalPauseDialogProps {
  open: boolean;
  isOnlineCoop: boolean;
  autoAim: boolean;
  sfxEnabled: boolean;
  onResume: () => void;
  onToggleAutoAim: () => void;
  onToggleSfx: () => void;
  onReturnLobby: () => void;
}

/**
 * Native top-layer `<dialog>` Pause menu opened via `showModal()`.
 * Preserves native `Esc` close-request handling without redundant ARIA modal attributes.
 */
function SurvivalPauseDialog({
  open,
  isOnlineCoop,
  autoAim,
  sfxEnabled,
  onResume,
  onToggleAutoAim,
  onToggleSfx,
  onReturnLobby,
}: SurvivalPauseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      if (!dialog.isConnected) return;
      dialog.returnValue = '';
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close(PROGRAMMATIC_CLOSE);
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) {
        dialog.close(PROGRAMMATIC_CLOSE);
      }
    };
  }, []);

  const handleClose = (e: SyntheticEvent<HTMLDialogElement>) => {
    const dialog = e.currentTarget;
    const action = dialog.returnValue;
    dialog.returnValue = '';

    if (action !== PROGRAMMATIC_CLOSE && openRef.current) {
      onResume();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={handleClose}
      className="m-auto max-h-[92dvh] w-[min(92vw,25rem)] overflow-y-auto rounded-3xl border-2 border-amber-400/50 bg-[#121826] p-0 text-[#FFF9F0] shadow-2xl"
    >
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <header className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/45 bg-amber-500/20 text-amber-300">
            <Pause aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h1
              id={titleId}
              className="font-display text-xl font-black tracking-tight text-amber-50"
            >
              Tạm Dừng
            </h1>
            <p id={descId} className="text-xs font-bold text-slate-300">
              {isOnlineCoop
                ? 'Menu cục bộ · Trận Online Co-op vẫn chạy nền với đồng đội.'
                : 'Trận đấu đã tạm dừng · Nhấn Esc hoặc Tiếp tục để chơi tiếp.'}
            </p>
          </div>
        </header>

        {isOnlineCoop && (
          <div className="rounded-2xl border border-sky-400/35 bg-sky-950/40 px-3.5 py-2.5 text-xs font-bold text-sky-200">
            Đang trong phòng Online Co-op — mở menu này không làm đứng máy chủ
            hay đồng đội của bạn.
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            ref={setNativeAutofocus}
            autoFocus
            type="button"
            onClick={() => {
              playSfx('click');
              onResume();
            }}
            className={`btn-tactile-emerald inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black ${SURVIVAL_FOCUS_RING_CLASS}`}
          >
            <Play aria-hidden="true" className="h-4 w-4" />
            <span>Tiếp tục</span>
          </button>

          <button
            type="button"
            aria-pressed={autoAim}
            onClick={() => {
              playSfx('click');
              onToggleAutoAim();
            }}
            className={`inline-flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-2xl border-2 px-4 py-2.5 text-sm font-black transition-colors motion-reduce:transition-none ${SURVIVAL_FOCUS_RING_CLASS} ${
              autoAim
                ? 'border-emerald-400/60 bg-emerald-950/70 text-emerald-100 hover:bg-emerald-900/80'
                : 'border-amber-400/60 bg-amber-950/70 text-amber-100 hover:bg-amber-900/80'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Crosshair aria-hidden="true" className="h-4 w-4" />
              <span>Tự ngắm</span>
            </span>
            <span className="rounded-lg bg-black/35 px-2 py-0.5 font-mono text-xs">
              {autoAim ? 'BẬT [Q]' : 'TẮT [Q]'}
            </span>
          </button>

          <button
            type="button"
            aria-pressed={sfxEnabled}
            onClick={onToggleSfx}
            className={`inline-flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-2xl border-2 border-white/15 bg-[#0d1424] px-4 py-2.5 text-sm font-black text-slate-100 transition-colors hover:border-cyan-400/45 motion-reduce:transition-none ${SURVIVAL_FOCUS_RING_CLASS}`}
          >
            <span className="inline-flex items-center gap-2">
              {sfxEnabled ? (
                <Volume2 aria-hidden="true" className="h-4 w-4 text-cyan-300" />
              ) : (
                <VolumeX aria-hidden="true" className="h-4 w-4 text-slate-400" />
              )}
              <span>Âm thanh SFX</span>
            </span>
            <span
              className={`rounded-lg px-2 py-0.5 font-mono text-xs ${
                sfxEnabled
                  ? 'bg-cyan-500/20 text-cyan-200'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {sfxEnabled ? 'BẬT' : 'TẮT'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              playSfx('click');
              onReturnLobby();
            }}
            className={`btn-tactile-wood mt-1 inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-rose-400/40 px-4 py-2.5 text-sm font-black text-rose-100 ${SURVIVAL_FOCUS_RING_CLASS}`}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4 text-rose-300" />
            <span>Về Sảnh</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * Top-level screen orchestrating PAWS Survival lobby, Solo/Bot-Team/Online Co-op
 * simulation, 60Hz Canvas2D loop, HUD, roguelike skill selection, Pause menu,
 * host-disconnect recovery, and Cookie/record settlement.
 */
export function SurvivalScreen({
  initialRoomCode,
  onBackToModeSelect,
}: SurvivalScreenProps) {
  const {
    cookies,
    selectedAnimal,
    selectAnimal,
    survivalBestScore,
    survivalBestTimeSec,
    survivalWins,
    settings,
    updateSettings,
    recordSurvivalResult,
  } = useProfileStore();

  const room = useSurvivalRoom();
  const {
    leaveRoom,
    setSnapshotListener,
    setGuestInputListener,
    broadcastSnapshot,
    sendGuestInput,
    getDisconnectedGuestIds,
    setSkillActionListener,
    setContinueEndlessListener,
    sendSkillPick,
    sendReroll,
    sendContinueEndless,
    returnToLobby: returnOnlineToLobby,
    startMatch: startOnlineMatch,
  } = room;

  const [mode, setMode] = useState<SurvivalMode>(() =>
    initialRoomCode && initialRoomCode.trim().length >= 4
      ? 'online_coop'
      : 'solo',
  );
  const [selectedMap, setSelectedMap] = useState<SurvivalMapId>('winter_cabin');
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>('candy_smg');
  const [selectedGear, setSelectedGear] = useState<GearId>('ice_skates');
  const [botCount, setBotCount] = useState<number>(2);
  const [playerName, setPlayerName] = useState<string>(readInitialPlayerName);
  const [autoAim, setAutoAim] = useState<boolean>(true);
  const [touchControlsActive, setTouchControlsActive] = useState<boolean>(false);

  const [offlineConfig, setOfflineConfig] = useState<CreateWorldConfig | null>(
    null,
  );
  const [paused, setPaused] = useState<boolean>(false);
  const [hud, setHud] = useState<SurvivalHudSnapshot | null>(null);
  const [resultSummary, setResultSummary] =
    useState<SurvivalMatchSummary | null>(null);
  const [settlementInfo, setSettlementInfo] =
    useState<SurvivalSettlementState>(EMPTY_SETTLEMENT);

  const canvasRef = useRef<SurvivalCanvasHandle | null>(null);
  const leaveRoomRef = useRef(leaveRoom);
  leaveRoomRef.current = leaveRoom;
  const [interpolator] = useState(() => new SurvivalSnapshotInterpolator());
  const interpolatorRef = useRef<SurvivalSnapshotInterpolator>(interpolator);
  interpolatorRef.current = interpolator;

  const remoteInputsRef = useRef<Record<string, RemoteSurvivalInputRecord>>({});
  const settledMatchIdsRef = useRef<Set<string>>(new Set());
  const matchNonceRef = useRef<number>(1);
  const hostLeftTitleId = useId();
  const hostLeftDescId = useId();

  // Clean up room connection and broadcast host-left notice if unmounting mid-match
  useEffect(() => {
    return () => {
      leaveRoomRef.current();
    };
  }, []);

  // Sync SFX setting with Web Audio engine
  useEffect(() => {
    setAudioPreferences({ sfxEnabled: settings.sfxEnabled });
  }, [settings.sfxEnabled]);

  const isOnlinePlaying =
    mode === 'online_coop' &&
    room.phase === 'playing' &&
    room.startConfig !== null;

  const onlineWorldConfig = useMemo<CreateWorldConfig | null>(() => {
    if (!isOnlinePlaying || !room.startConfig) return null;
    return {
      matchId: room.startConfig.matchId,
      mode: 'online_coop',
      mapId: room.startConfig.mapId,
      seed: room.startConfig.seed,
      players: room.startConfig.players,
    };
  }, [isOnlinePlaying, room.startConfig]);

  const activeConfig = isOnlinePlaying ? onlineWorldConfig : offlineConfig;
  const activeMatchId = activeConfig?.matchId ?? null;
  const activeLocalPlayerId = isOnlinePlaying ? room.myPeerId : 'player_1';
  const isOnlineClient = isOnlinePlaying && !room.isHost;

  // Reset UI overlay state cleanly whenever entering/leaving/restarting a match.
  // For Host/Offline, child SurvivalCanvas pushes initial HUD synchronously in its
  // effect before this parent effect runs, so only clear HUD on exit or Guest start.
  useEffect(() => {
    setPaused(false);
    if (!activeMatchId || isOnlineClient) {
      setHud(null);
    }
    setResultSummary(null);
    setSettlementInfo(EMPTY_SETTLEMENT);
    interpolatorRef.current.reset();
    remoteInputsRef.current = {};
  }, [activeMatchId, isOnlineClient]);

  // Wire high-frequency online snapshot and guest-input ref listeners
  useEffect(() => {
    if (!isOnlinePlaying || !onlineWorldConfig) {
      setSnapshotListener(null);
      setGuestInputListener(null);
      remoteInputsRef.current = {};
      return;
    }

    const matchId = onlineWorldConfig.matchId;

    if (room.isHost) {
      setSnapshotListener(null);
      setGuestInputListener((payload) => {
        if (payload.matchId !== matchId) return;
        remoteInputsRef.current[payload.peerId] = {
          input: payload.input,
          receivedAtMs: performance.now(),
        };
      });
    } else {
      setGuestInputListener(null);
      remoteInputsRef.current = {};
      interpolatorRef.current.reset();
      setSnapshotListener((snap) => {
        if (snap.matchId !== matchId) return;
        interpolatorRef.current.push(snap, performance.now());
      });
    }

    return () => {
      setSnapshotListener(null);
      setGuestInputListener(null);
      remoteInputsRef.current = {};
    };
  }, [
    isOnlinePlaying,
    onlineWorldConfig,
    room.isHost,
    setGuestInputListener,
    setSnapshotListener,
  ]);

  // Close pause menu if Host disconnects mid-match
  useEffect(() => {
    if (isOnlinePlaying && room.hostLeft) {
      setPaused(false);
    }
  }, [isOnlinePlaying, room.hostLeft]);

  const onlineCanvasProps = useMemo<SurvivalCanvasOnlineProps | undefined>(() => {
    if (!isOnlinePlaying) return undefined;
    return {
      role: room.isHost ? 'host' : 'client',
      localPlayerId: room.myPeerId,
      onBroadcastSnapshot: broadcastSnapshot,
      onSendClientInput: sendGuestInput,
      getRemoteInputs: () =>
        consumeRemoteSurvivalInputs(remoteInputsRef.current, performance.now()),
      getDisconnectedGuestIds,
      interpolatorRef,
      onRegisterSkillAction: setSkillActionListener,
      onRegisterContinueEndless: setContinueEndlessListener,
      onSendClientSkillPick: sendSkillPick,
      onSendClientReroll: sendReroll,
      onSendContinueEndless: sendContinueEndless,
    };
  }, [
    broadcastSnapshot,
    getDisconnectedGuestIds,
    isOnlinePlaying,
    room.isHost,
    room.myPeerId,
    sendContinueEndless,
    sendGuestInput,
    sendReroll,
    sendSkillPick,
    setContinueEndlessListener,
    setSkillActionListener,
  ]);

  const handlePlayerNameChange = useCallback((nextName: string) => {
    setPlayerName(nextName);
    persistPlayerName(nextName);
  }, []);

  const handleModeChange = useCallback((nextMode: SurvivalMode) => {
    setOfflineConfig(null);
    setMode(nextMode);
  }, []);

  const handleStartOffline = useCallback(() => {
    if (mode === 'online_coop') return;
    const nonce = matchNonceRef.current;
    matchNonceRef.current += 1;
    setOfflineConfig(
      buildOfflineWorldConfig({
        mode,
        mapId: selectedMap,
        playerName,
        selectedAnimal,
        selectedWeapon,
        selectedGear,
        botCount,
        nonce,
      }),
    );
  }, [
    botCount,
    mode,
    playerName,
    selectedAnimal,
    selectedGear,
    selectedMap,
    selectedWeapon,
  ]);

  const handleBackToModeSelect = useCallback(() => {
    setOfflineConfig(null);
    leaveRoom();
    onBackToModeSelect();
  }, [leaveRoom, onBackToModeSelect]);

  const handleToggleSfx = useCallback(() => {
    const next = !settings.sfxEnabled;
    updateSettings({ sfxEnabled: next });
    if (next) {
      setAudioPreferences({ sfxEnabled: true });
      playSfx('click');
    }
  }, [settings.sfxEnabled, updateSettings]);

  const handleToggleAutoAim = useCallback(() => {
    setAutoAim((prev) => !prev);
  }, []);

  const handleHudSnapshot = useCallback((nextHud: SurvivalHudSnapshot) => {
    setHud(nextHud);
    if (nextHud.phase === 'playing') {
      setResultSummary((prev) => (prev !== null ? null : prev));
    } else {
      setPaused(false);
    }
  }, []);

  const handleMatchEnd = useCallback(
    (summary: SurvivalMatchSummary) => {
      setPaused(false);
      setResultSummary(summary);

      // Settle initial Campaign victory/defeat or Endless Abyss once under `matchId`.
      // If player won a Campaign map, clicked "Chơi Tiếp Endless", and later falls,
      // settle only the incremental Endless bonus under `${matchId}:endless` via
      // `endlessContinuation: true` (capped at 120 total Cookies, zero duplicate gamesPlayed).
      const isEndlessMap = getSurvivalMapMeta(summary.mapId).isEndless;
      const isCampaignEndlessContinuation = summary.isEndless && !isEndlessMap;
      const settleId = isCampaignEndlessContinuation
        ? `${summary.matchId.slice(0, 71)}:endless`
        : summary.matchId;
      const settleVictory =
        isCampaignEndlessContinuation || isEndlessMap ? false : summary.victory;

      if (settledMatchIdsRef.current.has(settleId)) {
        setSettlementInfo(EMPTY_SETTLEMENT);
        return;
      }

      settledMatchIdsRef.current.add(settleId);
      if (settledMatchIdsRef.current.size > 40) {
        const oldest = settledMatchIdsRef.current.values().next().value;
        if (oldest !== undefined) {
          settledMatchIdsRef.current.delete(oldest);
        }
      }
      const res = recordSurvivalResult({
        matchId: settleId,
        mapId: summary.mapId,
        victory: settleVictory,
        score: summary.score,
        elapsedSec: summary.elapsedSec,
        endlessContinuation: isCampaignEndlessContinuation,
      });
      if (res.ok) {
        setSettlementInfo({
          reward: res.reward,
          isNewBestScore: res.isNewBestScore,
          isNewBestTime: res.isNewBestTime,
        });
      } else {
        setSettlementInfo(EMPTY_SETTLEMENT);
      }
    },
    [recordSurvivalResult],
  );

  const canPause =
    activeConfig !== null &&
    (hud === null || hud.phase === 'playing') &&
    resultSummary === null &&
    !(isOnlinePlaying && room.hostLeft);

  const handleTogglePause = useCallback(() => {
    if (!canPause) return;
    setPaused((prev) => !prev);
  }, [canPause]);

  const handlePlayAgain = useCallback(() => {
    if (isOnlinePlaying) {
      if (room.isHost) {
        startOnlineMatch();
      }
      return;
    }
    handleStartOffline();
  }, [handleStartOffline, isOnlinePlaying, room.isHost, startOnlineMatch]);

  const handleReturnLobby = useCallback(() => {
    setPaused(false);
    setResultSummary(null);
    setHud(null);
    if (isOnlinePlaying) {
      if (room.isHost && !room.hostLeft) {
        returnOnlineToLobby();
      } else {
        leaveRoom();
      }
      return;
    }
    setOfflineConfig(null);
  }, [
    isOnlinePlaying,
    leaveRoom,
    returnOnlineToLobby,
    room.hostLeft,
    room.isHost,
  ]);

  const handleContinueEndless = useCallback(() => {
    canvasRef.current?.continueEndless();
  }, []);

  const handlePickSkill = useCallback((offerIndex: number) => {
    canvasRef.current?.pickSkill(offerIndex);
  }, []);

  const handleReroll = useCallback(() => {
    canvasRef.current?.reroll();
  }, []);

  if (!activeConfig) {
    return (
      <SurvivalLobby
        mode={mode}
        onModeChange={handleModeChange}
        selectedMap={selectedMap}
        onSelectMap={setSelectedMap}
        selectedAnimal={selectedAnimal}
        onSelectAnimal={selectAnimal}
        selectedWeapon={selectedWeapon}
        onSelectWeapon={setSelectedWeapon}
        selectedGear={selectedGear}
        onSelectGear={setSelectedGear}
        botCount={botCount}
        onBotCountChange={setBotCount}
        playerName={playerName}
        onPlayerNameChange={handlePlayerNameChange}
        cookies={cookies}
        bestScore={survivalBestScore}
        bestTimeSec={survivalBestTimeSec}
        wins={survivalWins}
        room={room}
        initialRoomCode={initialRoomCode}
        onStartOffline={handleStartOffline}
        onBackToModeSelect={handleBackToModeSelect}
      />
    );
  }

  const isHostLeftAlertOpen =
    isOnlinePlaying && room.hostLeft && resultSummary === null;
  const isPauseOpen = paused && canPause;
  const isLevelUpOpen =
    hud !== null &&
    hud.phase === 'levelup' &&
    resultSummary === null &&
    !isHostLeftAlertOpen;

  // In offline mode, pausing stops the simulation. In online_coop, Guests only
  // suppress local input while Host keeps the live simulation running for peers.
  const canvasPaused = isOnlinePlaying
    ? room.isHost
      ? false
      : isPauseOpen
    : isPauseOpen;

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="relative h-dvh w-full overflow-hidden bg-slate-950 select-none"
    >
      <SurvivalCanvas
        ref={canvasRef}
        config={activeConfig}
        localPlayerId={activeLocalPlayerId}
        paused={canvasPaused}
        inputDisabled={
          isPauseOpen ||
          isLevelUpOpen ||
          resultSummary !== null ||
          isHostLeftAlertOpen
        }
        reducedMotion={settings.reducedMotion}
        sfxEnabled={settings.sfxEnabled}
        autoAim={autoAim}
        onAutoAimChange={setAutoAim}
        onTogglePause={handleTogglePause}
        onHudSnapshot={handleHudSnapshot}
        onMatchEnd={handleMatchEnd}
        onTouchControlsChange={setTouchControlsActive}
        online={onlineCanvasProps}
      />

      {hud ? (
        <SurvivalHud
          hud={hud}
          autoAim={autoAim}
          onToggleAutoAim={handleToggleAutoAim}
          sfxEnabled={settings.sfxEnabled}
          onToggleSfx={handleToggleSfx}
          onPause={handleTogglePause}
          touchControlsActive={touchControlsActive}
        />
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-4 z-30 flex justify-center px-4"
        >
          <div className="rounded-full border border-sky-400/45 bg-[#0d1424]/90 px-4 py-1.5 text-xs font-black text-sky-200 shadow-lg backdrop-blur-md">
            Đang đồng bộ trạng thái trận đấu...
          </div>
        </div>
      )}

      {hud && (
        <LevelUpModal
          open={isLevelUpOpen}
          teamLevel={hud.teamLevel}
          offers={hud.pendingOffers}
          rerollsLeft={hud.localPlayer.rerollsLeft}
          isOnlineCoop={hud.mode === 'online_coop'}
          hasLocalPicked={hud.hasLocalPicked}
          pickedCount={hud.pickedCount}
          humanCount={hud.humanCount}
          timerSec={hud.levelUpTimerSec}
          onPickSkill={handlePickSkill}
          onReroll={handleReroll}
        />
      )}

      <SurvivalResultModal
        open={resultSummary !== null}
        summary={resultSummary}
        cookiesEarned={settlementInfo.reward}
        isNewBestScore={settlementInfo.isNewBestScore}
        isNewBestTime={settlementInfo.isNewBestTime}
        isHostOrOffline={!isOnlinePlaying || room.isHost}
        hostLeft={isOnlinePlaying && room.hostLeft}
        onContinueEndless={handleContinueEndless}
        onPlayAgain={handlePlayAgain}
        onReturnLobby={handleReturnLobby}
      />

      <SurvivalPauseDialog
        open={isPauseOpen}
        isOnlineCoop={isOnlinePlaying}
        autoAim={autoAim}
        sfxEnabled={settings.sfxEnabled}
        onResume={() => setPaused(false)}
        onToggleAutoAim={handleToggleAutoAim}
        onToggleSfx={handleToggleSfx}
        onReturnLobby={handleReturnLobby}
      />

      <SurvivalDialogShell
        open={isHostLeftAlertOpen}
        titleId={hostLeftTitleId}
        describedById={hostLeftDescId}
        dialogClassName="m-auto max-h-[92dvh] w-[min(92vw,26rem)] overflow-y-auto rounded-3xl border-2 border-rose-400/60 bg-[#121826] p-0 text-[#FFF9F0] shadow-2xl"
        innerClassName="flex flex-col gap-4 p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-400/45 bg-rose-500/20 text-rose-300">
            <AlertTriangle aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h1
              id={hostLeftTitleId}
              className="font-display text-lg font-black text-rose-100"
            >
              Chủ phòng đã rời trận
            </h1>
            <p
              id={hostLeftDescId}
              className="mt-1 text-xs leading-relaxed font-bold text-slate-300"
            >
              {room.error ??
                'Chủ phòng đã thoát hoặc mất kết nối khỏi trận đấu. Bạn có thể quay về sảnh để tiếp tục chơi.'}
            </p>
          </div>
        </div>

        <button
          ref={setNativeAutofocus}
          autoFocus
          type="button"
          onClick={() => {
            playSfx('click');
            handleReturnLobby();
          }}
          className={`btn-tactile-amber inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black ${SURVIVAL_FOCUS_RING_CLASS}`}
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          <span>Về Sảnh</span>
        </button>
      </SurvivalDialogShell>
    </div>
  );
}

export default SurvivalScreen;
