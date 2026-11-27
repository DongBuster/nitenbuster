import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bomb,
  Cookie,
  Eye,
  EyeOff,
  HelpCircle,
  Layers,
  Music,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { playSfx, setAudioPreferences } from '../audio/soundEngine';
import {
  canPlacePiece,
  createInitialState,
  declineRescue,
  detonateCandyBombAt,
  getBoardFillRatio,
  getPlacementPreview,
  placePiece,
  rerollTray,
} from '../blockblast/engine/game';
import {
  getStageNumber,
  getStageTheme,
  resolveStageColorToken,
  type BoardStageTheme,
} from '../blockblast/engine/stages';
import {
  BOARD_SIZE,
  CANDY_BOMB_COST,
  type BlastGameState,
  type BlockColor,
  type MoveOutcome,
  type PlacementPreview,
  type TrayPiece,
} from '../blockblast/engine/types';
import type { MatchAction, MatchReceipt } from '../blockblast/engine/verify';
import type { BbEmoteEvent } from '../blockblast/online/protocol';
import {
  GameOverDialog,
  HelpDialog,
  RescueDialog,
  RestartConfirmDialog,
} from '../blockblast/ui/BlockBlastModals';
import {
  BlockBoard,
  type BurstCallout,
  type BurstEffect,
  type BurstParticle,
} from '../blockblast/ui/BlockBoard';
import { BlockTray, PieceMiniGrid } from '../blockblast/ui/BlockTray';
import { MascotStage } from '../blockblast/ui/MascotStage';
import { ScoreHeaderCard } from '../blockblast/ui/ScoreHeaderCard';
import {
  resolveScorePulseTier,
  type ScorePulseEvent,
} from '../blockblast/ui/scoreEffects';
import type { Emotion } from '../engine/types';
import { useProfileStore } from '../store/profileStore';

export interface BlockBlastRoomModeConfig {
  roomCode: string;
  matchId: string;
  seed: number;
  roundNumber: number;
  isCountingDown: boolean;
  countdownSeconds: number;
  leaderboardDesktop: ReactNode;
  leaderboardMobile: ReactNode;
  lastEmote: BbEmoteEvent | null;
  onProgress: (state: BlastGameState) => void;
  onFinish: (
    receipt: MatchReceipt,
    finalState: BlastGameState,
    settlement: { reward: number; isNewBest: boolean; valid: boolean },
  ) => void;
  onLeaveRoom: () => void;
  suppressStandaloneSettlement?: boolean;
  forceFinishToken?: number;
}

export interface BlockBlastScreenProps {
  onBackToModeSelect: () => void;
  onOpenRoomMode?: () => void;
  roomMode?: BlockBlastRoomModeConfig;
}

interface MatchSession {
  matchId: string;
  seed: number;
  initialCookies: number;
  rescueEligible: boolean;
}

interface MatchBundle {
  session: MatchSession;
  state: BlastGameState;
}

interface BoardCoord {
  row: number;
  col: number;
}

interface ActiveDragSession {
  slotIndex: number;
  piece: TrayPiece;
  startX: number;
  startY: number;
  pointerId: number;
  pointerType: string;
  isDragging: boolean;
  boardCellSize: number;
}

interface DragVisualState {
  slotIndex: number;
  piece: TrayPiece;
  cellSizePx: number;
  initialX: number;
  initialY: number;
}

interface SettlementSummary {
  reward: number;
  isNewBest: boolean;
  valid: boolean;
}

const TOUCH_DRAG_OFFSET_Y = -56;
const DRAG_ACTIVATION_THRESHOLD_PX = 4;
const BURST_LIFETIME_ALL_CLEAR_MS = 1350;
const BURST_LIFETIME_ACTION_MS = 1000;
const BURST_LIFETIME_STANDARD_MS = 680;
const PLACED_POP_LIFETIME_MS = 220;
const GOLDEN_ANGLE_RAD = (137.508 * Math.PI) / 180;
const FIREWORK_ORIGINS: readonly { xPct: number; yPct: number }[] = [
  { xPct: 50, yPct: 50 },
  { xPct: 18, yPct: 18 },
  { xPct: 82, yPct: 18 },
  { xPct: 18, yPct: 82 },
  { xPct: 82, yPct: 82 },
];
const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';

const IDLE_QUIPS = [
  'Kéo khối từ khay lên bàn 8×8 để ghép hàng nhé!',
  'Canh nhiều hàng/cột ăn cùng lúc để nhân điểm Combo!',
  'Giữ chuỗi Streak — bạn có 1 lượt ân hạn nếu lỡ chưa ăn dòng.',
] as const;

const MemoMascotStage = memo(MascotStage);

interface FloatingDragPieceProps {
  dragView: DragVisualState;
  colorblindMode: boolean;
  stageTheme: BoardStageTheme;
  floatingRef: RefObject<HTMLDivElement | null>;
}

const MemoFloatingDragPiece = memo(function FloatingDragPiece({
  dragView,
  colorblindMode,
  stageTheme,
  floatingRef,
}: FloatingDragPieceProps) {
  return (
    <div
      ref={floatingRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-40 will-change-transform"
      style={{
        transform: `translate3d(${dragView.initialX}px, ${dragView.initialY}px, 0) translate(-50%, -50%)`,
      }}
    >
      <div className="drop-shadow-[0_14px_24px_rgba(0,0,0,0.65)]">
        <PieceMiniGrid
          piece={dragView.piece}
          cellSizePx={dragView.cellSizePx}
          colorblindMode={colorblindMode}
          stageTheme={stageTheme}
        />
      </div>
    </div>
  );
});

function generateSeed32(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] || 1;
  }
  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
}

function generateMatchId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `bb-${crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `bb-${Date.now().toString(36)}-${rand}`;
}

function createMatchSession(
  cookiesAtStart: number,
  roomConfig?: BlockBlastRoomModeConfig,
): MatchSession {
  if (roomConfig) {
    return {
      matchId: roomConfig.matchId,
      seed: roomConfig.seed,
      initialCookies: cookiesAtStart,
      rescueEligible: false,
    };
  }
  return {
    matchId: generateMatchId(),
    seed: generateSeed32(),
    initialCookies: cookiesAtStart,
    rescueEligible: cookiesAtStart >= CANDY_BOMB_COST,
  };
}

function clientToBoardAnchor(
  boardEl: HTMLDivElement | null,
  clientX: number,
  clientY: number,
  piece: TrayPiece,
  pointerType: string,
): BoardCoord | null {
  if (!boardEl) return null;
  const rect = boardEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const offsetY = pointerType === 'touch' ? TOUCH_DRAG_OFFSET_Y : 0;
  const cellSize = rect.width / BOARD_SIZE;
  const cx = clientX;
  const cy = clientY + offsetY;

  if (
    cx < rect.left - cellSize ||
    cx > rect.right + cellSize ||
    cy < rect.top - cellSize ||
    cy > rect.bottom + cellSize
  ) {
    return null;
  }

  const topLeftX = cx - (piece.width * cellSize) / 2;
  const topLeftY = cy - (piece.height * cellSize) / 2;
  const row = Math.round((topLeftY - rect.top) / cellSize);
  const col = Math.round((topLeftX - rect.left) / cellSize);

  return { row, col };
}

function clientToBoardCell(
  boardEl: HTMLDivElement | null,
  clientX: number,
  clientY: number,
): { r: number; c: number } | null {
  if (!boardEl) return null;
  const rect = boardEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null;
  }

  const c = Math.min(
    BOARD_SIZE - 1,
    Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * BOARD_SIZE)),
  );
  const r = Math.min(
    BOARD_SIZE - 1,
    Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * BOARD_SIZE)),
  );
  return { r, c };
}

function getBurstCenterPct(
  cells: readonly { r: number; c: number }[],
  fallbackRow: number,
  fallbackCol: number,
): { xPct: number; yPct: number } {
  const source = cells.length > 0 ? cells : [{ r: fallbackRow, c: fallbackCol }];
  let sumR = 0;
  let sumC = 0;
  for (const cell of source) {
    sumR += cell.r;
    sumC += cell.c;
  }
  const avgR = sumR / source.length;
  const avgC = sumC / source.length;
  const rawX = ((avgC + 0.5) / BOARD_SIZE) * 100;
  const rawY = ((avgR + 0.5) / BOARD_SIZE) * 100;
  return {
    xPct: Math.min(84, Math.max(16, rawX)),
    yPct: Math.min(86, Math.max(14, rawY)),
  };
}

/**
 * Generates deterministic 360-degree golden-angle burst particles (and multi-origin
 * fireworks across center + 4 corners on All Clear / Stage Up) without Math.random().
 */
function buildBurstParticles(
  xPct: number,
  yPct: number,
  count: number,
  paletteColors: readonly string[],
  isAllClear: boolean,
): BurstParticle[] {
  const total = Math.max(0, Math.floor(count));
  if (total === 0) return [];

  const colors = paletteColors.length > 0 ? paletteColors : ['#FBBF24'];
  const particles: BurstParticle[] = [];

  for (let i = 0; i < total; i++) {
    const originIdx = isAllClear ? i % FIREWORK_ORIGINS.length : 0;
    const localIdx = isAllClear ? Math.floor(i / FIREWORK_ORIGINS.length) : i;
    const angle =
      localIdx * GOLDEN_ANGLE_RAD +
      originIdx * ((2 * Math.PI) / FIREWORK_ORIGINS.length);

    const origin = isAllClear ? FIREWORK_ORIGINS[originIdx] : { xPct, yPct };
    const baseRadius = isAllClear ? (originIdx === 0 ? 48 : 34) : 38;
    const radiusSpan = isAllClear ? (originIdx === 0 ? 64 : 44) : 50;
    const distance =
      baseRadius + ((localIdx * 23 + originIdx * 11) % radiusSpan);

    const dx = Math.round(Math.cos(angle) * distance);
    const dy = Math.round(Math.sin(angle) * distance);
    const rot = Math.round(((i * 97) % 360) - 180);
    const star = isAllClear ? i % 2 === 0 : i % 3 === 0;
    const sizePx = star ? 9 + (i % 4) * 2 : 6 + (i % 3) * 2;

    particles.push({
      id: `${i}`,
      dx,
      dy,
      rot,
      colorHex: colors[i % colors.length],
      sizePx,
      star,
      originXPct: origin.xPct,
      originYPct: origin.yPct,
    });
  }

  return particles;
}

/**
 * Builds the tiered arcade callout banner metadata for line clears, combos,
 * Candy Bomb 3x3 blasts, and All Clear / Stage Up celebrations.
 */
function buildCallout(
  outcome: MoveOutcome,
  lineCount: number,
  isBombBlast: boolean,
  stageThemeAfter: BoardStageTheme,
): BurstCallout {
  if (outcome.allClear || outcome.stageUp) {
    return {
      title: outcome.allClear
        ? `FULL BÀN! +${outcome.pointsEarned.toLocaleString('vi-VN')}`
        : 'FULL BÀN!',
      subtitle: `LÊN STAGE ${outcome.stageAfter} · ${stageThemeAfter.name.toUpperCase()}`,
      tier: 'allClear',
    };
  }

  if (isBombBlast) {
    return {
      title: 'BÙM KẸO 3×3!',
      subtitle:
        outcome.pointsEarned > 0
          ? `+${outcome.pointsEarned.toLocaleString('vi-VN')} ĐIỂM`
          : undefined,
      tier: 'bomb',
    };
  }

  if (lineCount > 0 && outcome.streakAfter >= 2) {
    return {
      title:
        outcome.streakAfter >= 5
          ? `UNSTOPPABLE ×${outcome.streakAfter}!`
          : `COMBO ×${outcome.streakAfter}!`,
      subtitle:
        lineCount >= 2
          ? `${lineCount} DÒNG · +${outcome.pointsEarned.toLocaleString('vi-VN')}Đ`
          : `+${outcome.pointsEarned.toLocaleString('vi-VN')} ĐIỂM`,
      tier: 'combo',
    };
  }

  if (lineCount >= 2) {
    return {
      title:
        lineCount === 2
          ? 'DOUBLE!'
          : lineCount === 3
            ? 'TRIPLE!'
            : `MEGA ×${lineCount}!`,
      subtitle: `+${outcome.pointsEarned.toLocaleString('vi-VN')} ĐIỂM`,
      tier: 'multi',
    };
  }

  return {
    title: `+${outcome.pointsEarned.toLocaleString('vi-VN')}`,
    tier: lineCount === 1 ? 'multi' : 'normal',
  };
}

function resolveMascotReaction(
  outcome: MoveOutcome,
  source: 'place' | 'bomb',
): { emotion: Emotion; quip: string } {
  const { nextState, allClear, stageUp, stageAfter, streakAfter, clearedRows, clearedCols } = outcome;
  const lineCount = clearedRows.length + clearedCols.length;
  const fillRatio = getBoardFillRatio(nextState.grid);

  if (nextState.phase === 'gameOver') {
    return {
      emotion: 'sad',
      quip: 'Hết nước đi rồi! Nghỉ tay nhận Cookies và thử lại ván mới nhé!',
    };
  }

  if (nextState.phase === 'rescuePrompt') {
    return {
      emotion: 'shock',
      quip: 'Ôi chật chỗ mất rồi! Dùng Bom Kẹo 3×3 giải cứu bàn cờ không nào?',
    };
  }

  if (fillRatio >= 0.72) {
    return {
      emotion: 'shock',
      quip: 'Bàn đang khá chật rồi đó, ưu tiên tìm nước ăn dòng nhé!',
    };
  }

  if (allClear || stageUp) {
    const nextTheme = getStageTheme(nextState.allClears);
    return {
      emotion: 'win',
      quip: allClear
        ? `Quét sạch cả bàn +1.000đ! Lên Stage ${stageAfter} · ${nextTheme.name}!`
        : `Sạch bong bàn cờ! Chào mừng tới Stage ${stageAfter} · ${nextTheme.name}!`,
    };
  }

  if (streakAfter >= 3) {
    return {
      emotion: 'win',
      quip: `Chuỗi Combo ${streakAfter}× cháy quá! Tiếp tục giữ nhịp nào!`,
    };
  }

  if (source === 'bomb' || outcome.destroyedByBomb.length > 0) {
    return {
      emotion: 'happy',
      quip: 'Bùm! Bom Kẹo 3×3 thổi bay chướng ngại vật gọn gàng!',
    };
  }

  if (lineCount > 0) {
    return {
      emotion: 'happy',
      quip:
        lineCount >= 2
          ? `Ăn liền ${lineCount} dòng cùng lúc! Đỉnh quá đi!`
          : 'Gọn gàng quá! Ăn dòng cực mượt!',
    };
  }

  return {
    emotion: 'idle',
    quip: IDLE_QUIPS[nextState.movesCount % IDLE_QUIPS.length],
  };
}

function useIsDesktopLg(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true;
    }
    return window.matchMedia('(min-width: 1024px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };
    setIsDesktop(mql.matches);
    mql.addEventListener('change', handleChange);
    return () => {
      mql.removeEventListener('change', handleChange);
    };
  }, []);

  return isDesktop;
}

/**
 * Full Block Blast PAWS gameplay screen featuring 60fps pointer drag-and-drop,
 * click/keyboard placement, Candy Bomb 3x3 rescue aiming, anti-cheat match ledger,
 * and a responsive Winter Cabin 3D mascot stage.
 */
export default function BlockBlastScreen({
  onBackToModeSelect,
  onOpenRoomMode,
  roomMode,
}: BlockBlastScreenProps) {
  const {
    cookies,
    blockBlastBestScore,
    selectedAnimal,
    equippedAccessory,
    settings,
    integrityWarning,
    dismissIntegrityWarning,
    updateSettings,
    spendBlockBlastBomb,
    recordBlockBlastResult,
  } = useProfileStore();

  const isDesktop = useIsDesktopLg();
  const roomModeRef = useRef<BlockBlastRoomModeConfig | undefined>(roomMode);
  roomModeRef.current = roomMode;

  const [match, setMatch] = useState<MatchBundle>(() => {
    const initialSession = createMatchSession(cookies, roomMode);
    return {
      session: initialSession,
      state: createInitialState(initialSession.seed),
    };
  });

  const { state } = match;
  const stageNumber = getStageNumber(state.allClears);
  const stageTheme = getStageTheme(state.allClears);

  const matchRef = useRef<MatchBundle>(match);
  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  const actionsRef = useRef<MatchAction[]>([]);
  const matchStartRef = useRef<number>(performance.now());
  const wasCountingDownRef = useRef<boolean>(Boolean(roomMode?.isCountingDown));
  const bombPaidCountRef = useRef<number>(0);
  const settledRef = useRef<boolean>(false);

  useEffect(() => {
    const isCountingDown = Boolean(roomMode?.isCountingDown);
    if (wasCountingDownRef.current && !isCountingDown) {
      matchStartRef.current = performance.now();
    }
    wasCountingDownRef.current = isCountingDown;
  }, [roomMode?.isCountingDown]);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const floatingDragRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<ActiveDragSession | null>(null);
  const windowDragCleanupRef = useRef<(() => void) | null>(null);
  const hoverAnchorRef = useRef<BoardCoord | null>(null);
  const bombHoverRef = useRef<{ r: number; c: number } | null>(null);
  const burstCounterRef = useRef<number>(0);
  const scorePulseSeqRef = useRef<number>(0);
  const burstTimersRef = useRef<Set<number>>(new Set());
  const shakeResetTimerRef = useRef<number | null>(null);
  const placedResetTimerRef = useRef<number | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [dragView, setDragView] = useState<DragVisualState | null>(null);
  const [hoverAnchor, setHoverAnchor] = useState<BoardCoord | null>(null);
  const [bombAiming, setBombAiming] = useState<boolean>(false);
  const [bombHoverCell, setBombHoverCell] = useState<{ r: number; c: number } | null>(null);
  const [bursts, setBursts] = useState<BurstEffect[]>([]);
  const [scorePulse, setScorePulse] = useState<ScorePulseEvent | null>(null);
  const [boardShake, setBoardShake] = useState<'none' | 'sm' | 'lg'>('none');
  const [recentPlacedCells, setRecentPlacedCells] = useState<readonly { r: number; c: number }[]>([]);
  const [emotion, setEmotion] = useState<Emotion>('idle');
  const [quip, setQuip] = useState<string>(IDLE_QUIPS[0]);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
  const [settlement, setSettlement] = useState<SettlementSummary | null>(null);
  const [gameOverDismissed, setGameOverDismissed] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState<boolean>(false);

  const bombAimingRef = useRef<boolean>(bombAiming);
  useEffect(() => {
    bombAimingRef.current = bombAiming;
  }, [bombAiming]);

  const equippedList = useMemo(
    () => equippedAccessory[selectedAnimal] ?? [],
    [equippedAccessory, selectedAnimal],
  );

  // Sync audio preferences on mount & updates
  useEffect(() => {
    setAudioPreferences({
      sfxEnabled: settings.sfxEnabled,
      bgmEnabled: settings.bgmEnabled,
    });
  }, [settings.sfxEnabled, settings.bgmEnabled]);

  // Clear pending timeouts and window drag listeners on unmount
  useEffect(() => {
    const timers = burstTimersRef.current;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      shakeResetTimerRef.current = null;
      placedResetTimerRef.current = null;
      if (windowDragCleanupRef.current) {
        windowDragCleanupRef.current();
        windowDragCleanupRef.current = null;
      }
    };
  }, []);

  const cleanupWindowDragListeners = useCallback(() => {
    if (windowDragCleanupRef.current) {
      windowDragCleanupRef.current();
      windowDragCleanupRef.current = null;
    }
  }, []);

  const updateHoverAnchorIfChanged = useCallback((next: BoardCoord | null) => {
    const prev = hoverAnchorRef.current;
    if (prev === null && next === null) return;
    if (prev && next && prev.row === next.row && prev.col === next.col) return;
    hoverAnchorRef.current = next;
    setHoverAnchor(next);
  }, []);

  const updateBombHoverIfChanged = useCallback(
    (next: { r: number; c: number } | null) => {
      const prev = bombHoverRef.current;
      if (prev === null && next === null) return;
      if (prev && next && prev.r === next.r && prev.c === next.c) return;
      bombHoverRef.current = next;
      setBombHoverCell(next);
    },
    [],
  );

  const cancelActiveDrag = useCallback(() => {
    dragSessionRef.current = null;
    cleanupWindowDragListeners();
    setDragView(null);
    updateHoverAnchorIfChanged(null);
  }, [cleanupWindowDragListeners, updateHoverAnchorIfChanged]);

  const settleMatch = useCallback(
    (finalState: BlastGameState, activeSession: MatchSession) => {
      if (settledRef.current) return;
      settledRef.current = true;

      const elapsedMs = Math.max(
        0,
        Math.round(performance.now() - matchStartRef.current),
      );
      const receipt: MatchReceipt = {
        matchId: activeSession.matchId,
        seed: activeSession.seed,
        actions: [...actionsRef.current],
        claimedScore: finalState.score,
        elapsedMs,
        bombPaidCount: bombPaidCountRef.current,
        rescueEligible: activeSession.rescueEligible,
      };

      const summary: SettlementSummary = roomModeRef.current
        ?.suppressStandaloneSettlement
        ? { reward: 0, isNewBest: false, valid: true }
        : (() => {
            const result = recordBlockBlastResult(receipt);
            return {
              reward: result.reward,
              isNewBest: result.isNewBest,
              valid: result.ok,
            };
          })();
      setSettlement(summary);
      playSfx(summary.isNewBest ? 'win' : 'lose');
      roomModeRef.current?.onFinish(receipt, finalState, summary);
    },
    [recordBlockBlastResult],
  );

  // Allow Event mode time-limit expiration to cleanly freeze and submit the board
  useEffect(() => {
    const token = roomMode?.forceFinishToken ?? 0;
    if (token <= 0 || settledRef.current) return;
    const currentBundle = matchRef.current;
    setMatch((prev) => {
      if (prev.state.phase === 'gameOver') return prev;
      return {
        ...prev,
        state: {
          ...prev.state,
          phase: 'gameOver',
        },
      };
    });
    settleMatch(
      { ...currentBundle.state, phase: 'gameOver' },
      currentBundle.session,
    );
  }, [roomMode?.forceFinishToken, settleMatch]);

  const spawnBurst = useCallback(
    (effect: Omit<BurstEffect, 'id'>, lifetimeMs: number) => {
      const burstId = `burst-${++burstCounterRef.current}`;
      setBursts((prev) => [...prev, { ...effect, id: burstId }]);

      const timerId = window.setTimeout(() => {
        burstTimersRef.current.delete(timerId);
        setBursts((prev) => prev.filter((item) => item.id !== burstId));
      }, lifetimeMs);
      burstTimersRef.current.add(timerId);
    },
    [],
  );

  const triggerBoardShake = useCallback((level: 'sm' | 'lg') => {
    if (shakeResetTimerRef.current !== null) {
      window.clearTimeout(shakeResetTimerRef.current);
      burstTimersRef.current.delete(shakeResetTimerRef.current);
      shakeResetTimerRef.current = null;
    }

    setBoardShake(level);
    const durationMs = level === 'lg' ? 280 : 200;
    const timerId = window.setTimeout(() => {
      burstTimersRef.current.delete(timerId);
      if (shakeResetTimerRef.current === timerId) {
        shakeResetTimerRef.current = null;
      }
      setBoardShake('none');
    }, durationMs);
    shakeResetTimerRef.current = timerId;
    burstTimersRef.current.add(timerId);
  }, []);

  const triggerPlacedPop = useCallback(
    (cells: readonly { r: number; c: number }[]) => {
      if (placedResetTimerRef.current !== null) {
        window.clearTimeout(placedResetTimerRef.current);
        burstTimersRef.current.delete(placedResetTimerRef.current);
        placedResetTimerRef.current = null;
      }

      if (cells.length === 0) {
        setRecentPlacedCells([]);
        return;
      }

      setRecentPlacedCells(cells);
      const timerId = window.setTimeout(() => {
        burstTimersRef.current.delete(timerId);
        if (placedResetTimerRef.current === timerId) {
          placedResetTimerRef.current = null;
        }
        setRecentPlacedCells([]);
      }, PLACED_POP_LIFETIME_MS);
      placedResetTimerRef.current = timerId;
      burstTimersRef.current.add(timerId);
    },
    [],
  );

  const commitMoveOutcome = useCallback(
    (
      outcome: MoveOutcome,
      activeSession: MatchSession,
      options: {
        source: 'place' | 'bomb';
        anchorRow: number;
        anchorCol: number;
        pieceColor: BlockColor;
      },
    ) => {
      const nextBundle: MatchBundle = {
        session: activeSession,
        state: outcome.nextState,
      };
      matchRef.current = nextBundle;
      setMatch(nextBundle);

      triggerPlacedPop(outcome.placedCells);

      if (outcome.pointsEarned > 0) {
        const tier = resolveScorePulseTier(outcome, options.source);
        setScorePulse({
          seq: ++scorePulseSeqRef.current,
          points: outcome.pointsEarned,
          tier,
        });
      }

      const lineCount = outcome.clearedRows.length + outcome.clearedCols.length;
      const isBombBlast =
        options.source === 'bomb' || outcome.destroyedByBomb.length > 0;
      const isAllClearBurst = outcome.allClear || outcome.stageUp;
      const stageThemeAfter = getStageTheme(outcome.nextState.allClears);
      const stagePaletteHexes = stageThemeAfter.palette.map(
        (color) => resolveStageColorToken(color, stageThemeAfter).bgHex,
      );
      const callout = buildCallout(
        outcome,
        lineCount,
        isBombBlast,
        stageThemeAfter,
      );
      const burstLifetimeMs = isAllClearBurst
        ? BURST_LIFETIME_ALL_CLEAR_MS
        : callout.tier === 'normal'
          ? BURST_LIFETIME_STANDARD_MS
          : BURST_LIFETIME_ACTION_MS;

      if (isBombBlast) {
        playSfx('candyBomb');
      }
      if (isAllClearBurst) {
        playSfx('allClear');
      } else if (!isBombBlast && outcome.clearedCells.length > 0) {
        playSfx('lineClear', { combo: outcome.streakAfter });
      } else if (!isBombBlast) {
        playSfx('blockPlace');
      }

      if (
        isAllClearBurst ||
        isBombBlast ||
        lineCount >= 2 ||
        (lineCount > 0 && outcome.streakAfter >= 3)
      ) {
        triggerBoardShake('lg');
      } else if (lineCount === 1 && outcome.stageAfter >= 2) {
        triggerBoardShake('sm');
      }

      if (isBombBlast) {
        const center = getBurstCenterPct(
          outcome.destroyedByBomb,
          options.anchorRow,
          options.anchorCol,
        );
        const bombColors = isAllClearBurst
          ? [
              ...stagePaletteHexes,
              stageThemeAfter.accentHex,
              stageThemeAfter.sweepColorHex,
              '#FB7185',
            ]
          : ['#FB7185', '#FBBF24', '#F472B6', '#FDE68A'];
        spawnBurst(
          {
            cells:
              outcome.destroyedByBomb.length > 0
                ? outcome.destroyedByBomb
                : [{ r: options.anchorRow, c: options.anchorCol }],
            colorHex: '#FB7185',
            label:
              outcome.pointsEarned > 0 ? `+${outcome.pointsEarned}` : 'BÙM!',
            xPct: center.xPct,
            yPct: center.yPct,
            kind: 'bomb',
            particles: buildBurstParticles(
              center.xPct,
              center.yPct,
              isAllClearBurst
                ? stageThemeAfter.allClearParticleCount
                : Math.max(14, stageThemeAfter.particleCount),
              bombColors,
              isAllClearBurst,
            ),
            shockwaveCount: isAllClearBurst
              ? 3
              : Math.max(2, Math.min(3, stageThemeAfter.shockwaveRings)),
            callout,
            isAllClear: isAllClearBurst,
          },
          burstLifetimeMs,
        );
      } else if (outcome.clearedCells.length > 0) {
        const center = getBurstCenterPct(
          outcome.clearedCells,
          options.anchorRow,
          options.anchorCol,
        );
        const clearColors = [
          ...stagePaletteHexes,
          stageThemeAfter.accentHex,
          stageThemeAfter.sweepColorHex,
        ];
        const particleCount = isAllClearBurst
          ? stageThemeAfter.allClearParticleCount
          : Math.min(
              stageThemeAfter.allClearParticleCount,
              stageThemeAfter.particleCount +
                Math.max(0, lineCount - 1) * 4 +
                (outcome.streakAfter >= 2 ? 4 : 0),
            );
        const shockwaveCount = isAllClearBurst
          ? 3
          : lineCount >= 2 || outcome.streakAfter >= 3
            ? Math.min(3, Math.max(2, stageThemeAfter.shockwaveRings))
            : stageThemeAfter.shockwaveRings;
        spawnBurst(
          {
            cells: outcome.clearedCells,
            colorHex:
              lineCount > 1 || isAllClearBurst
                ? stageThemeAfter.accentHex
                : resolveStageColorToken(options.pieceColor, stageThemeAfter).bgHex,
            xPct: center.xPct,
            yPct: center.yPct,
            kind: 'clear',
            clearedRows: outcome.clearedRows,
            clearedCols: outcome.clearedCols,
            particles: buildBurstParticles(
              center.xPct,
              center.yPct,
              particleCount,
              clearColors,
              isAllClearBurst,
            ),
            shockwaveCount,
            callout,
            isAllClear: isAllClearBurst,
          },
          burstLifetimeMs,
        );
      } else {
        const center = getBurstCenterPct(
          outcome.placedCells,
          options.anchorRow,
          options.anchorCol,
        );
        spawnBurst(
          {
            cells: [],
            colorHex: resolveStageColorToken(options.pieceColor, stageThemeAfter).bgHex,
            xPct: center.xPct,
            yPct: center.yPct,
            kind: 'clear',
            callout,
          },
          burstLifetimeMs,
        );
      }

      const reaction = resolveMascotReaction(outcome, options.source);
      setEmotion(reaction.emotion);
      setQuip(reaction.quip);

      if (outcome.nextState.phase === 'gameOver') {
        setLiveAnnouncement(
          `Kết thúc ván! Tổng điểm ${outcome.nextState.score.toLocaleString('vi-VN')}.`,
        );
        settleMatch(outcome.nextState, activeSession);
      } else {
        roomModeRef.current?.onProgress(outcome.nextState);
        if (outcome.nextState.phase === 'rescuePrompt') {
          setLiveAnnouncement(
            'Hết nước đi hợp lệ. Có thể dùng Bom Kẹo 3×3 để giải cứu bàn cờ.',
          );
        } else if (isBombBlast) {
          setLiveAnnouncement(
            `Đã kích nổ Bom Kẹo 3×3 tại hàng ${options.anchorRow + 1} cột ${options.anchorCol + 1}, phá ${outcome.destroyedByBomb.length} ô, cộng ${outcome.pointsEarned} điểm.${
              outcome.stageUp
                ? ` Lên Stage ${outcome.stageAfter}: ${stageThemeAfter.name}.`
                : ''
            } Tổng điểm ${outcome.nextState.score}.`,
          );
        } else if (lineCount > 0) {
          setLiveAnnouncement(
            `Đã đặt khối và ăn ${lineCount} dòng, cộng ${outcome.pointsEarned} điểm.${
              outcome.allClear ? ' Quét sạch cả bàn!' : ''
            }${
              outcome.stageUp
                ? ` Lên Stage ${outcome.stageAfter}: ${stageThemeAfter.name}.`
                : ''
            }${
              outcome.streakAfter >= 2 ? ` Combo ${outcome.streakAfter}×.` : ''
            } Tổng điểm ${outcome.nextState.score}.`,
          );
        } else {
          setLiveAnnouncement(
            `Đã đặt khối, cộng ${outcome.pointsEarned} điểm. Tổng điểm ${outcome.nextState.score}.`,
          );
        }
      }
    },
    [settleMatch, spawnBurst, triggerBoardShake, triggerPlacedPop],
  );

  const commitPlace = useCallback(
    (slotIndex: number, row: number, col: number): boolean => {
      const current = matchRef.current;
      const piece = current.state.tray[slotIndex];
      if (!piece) return false;

      const outcome = placePiece(
        current.state,
        slotIndex,
        row,
        col,
        current.session.rescueEligible,
      );
      if (!outcome) return false;

      actionsRef.current.push({
        seq: actionsRef.current.length,
        type: 'place',
        slotIndex,
        row,
        col,
      });

      setSelectedSlot(null);
      updateHoverAnchorIfChanged(null);

      commitMoveOutcome(outcome, current.session, {
        source: piece.kind === 'candyBomb' ? 'bomb' : 'place',
        anchorRow: row,
        anchorCol: col,
        pieceColor: piece.color,
      });
      return true;
    },
    [commitMoveOutcome, updateHoverAnchorIfChanged],
  );

  const commitPlaceRef = useRef(commitPlace);
  useEffect(() => {
    commitPlaceRef.current = commitPlace;
  }, [commitPlace]);

  const handleBombDetonate = useCallback(
    (r: number, c: number) => {
      if (roomModeRef.current) {
        setBombAiming(false);
        updateBombHoverIfChanged(null);
        return;
      }
      const current = matchRef.current;
      if (!bombAimingRef.current) return;
      if (current.state.phase === 'gameOver' || current.state.candyBombUsed) {
        setBombAiming(false);
        updateBombHoverIfChanged(null);
        return;
      }

      const outcome = detonateCandyBombAt(current.state, r, c);
      if (!outcome) return;

      const paid = spendBlockBlastBomb(current.session.matchId);
      if (!paid) {
        setBombAiming(false);
        updateBombHoverIfChanged(null);
        setLiveAnnouncement(
          'Không đủ Cookies hoặc không thể kích hoạt Bom Kẹo 3×3 lúc này.',
        );
        return;
      }

      bombPaidCountRef.current = 1;
      actionsRef.current.push({
        seq: actionsRef.current.length,
        type: 'bomb',
        row: r,
        col: c,
      });

      setBombAiming(false);
      updateBombHoverIfChanged(null);

      commitMoveOutcome(outcome, current.session, {
        source: 'bomb',
        anchorRow: r,
        anchorCol: c,
        pieceColor: 'rose',
      });
    },
    [commitMoveOutcome, spendBlockBlastBomb, updateBombHoverIfChanged],
  );

  const handleStartBombAim = useCallback(() => {
    if (roomModeRef.current) return;
    const current = matchRef.current;
    if (
      current.state.phase === 'gameOver' ||
      current.state.candyBombUsed ||
      cookies < CANDY_BOMB_COST ||
      bombPaidCountRef.current > 0
    ) {
      return;
    }

    cancelActiveDrag();
    setSelectedSlot(null);
    updateBombHoverIfChanged(null);
    setBombAiming(true);
    playSfx('click');
    setQuip('Ngắm chuẩn vùng 3×3 trên bàn cờ rồi nhấn để kích nổ!');
    setLiveAnnouncement(
      'Đã bật chế độ ngắm Bom Kẹo 3×3. Chọn 1 ô trên bàn cờ để kích nổ hoặc nhấn Escape để hủy.',
    );
  }, [
    cancelActiveDrag,
    cookies,
    updateBombHoverIfChanged,
  ]);

  const handleCancelBombAim = useCallback(() => {
    if (!bombAimingRef.current) return;
    setBombAiming(false);
    updateBombHoverIfChanged(null);
    playSfx('click');
    if (matchRef.current.state.phase === 'rescuePrompt') {
      setQuip('Bạn vẫn có thể dùng Bom Kẹo 3×3 giải cứu hoặc kết thúc ván.');
    } else {
      setQuip(IDLE_QUIPS[matchRef.current.state.movesCount % IDLE_QUIPS.length]);
    }
    setLiveAnnouncement('Đã hủy ngắm Bom Kẹo 3×3, chưa trừ Cookies.');
  }, [updateBombHoverIfChanged]);

  const handleDeclineRescue = useCallback(() => {
    const current = matchRef.current;
    if (current.state.phase !== 'rescuePrompt') return;

    actionsRef.current.push({
      seq: actionsRef.current.length,
      type: 'declineRescue',
    });

    const nextState = declineRescue(current.state);
    const nextBundle: MatchBundle = {
      session: current.session,
      state: nextState,
    };
    matchRef.current = nextBundle;
    setMatch(nextBundle);

    setBombAiming(false);
    updateBombHoverIfChanged(null);
    setEmotion('sad');
    setQuip('Hết nước đi rồi! Nghỉ tay nhận Cookies và thử lại ván mới nhé!');
    setLiveAnnouncement(
      `Đã kết thúc ván. Tổng điểm ${nextState.score.toLocaleString('vi-VN')}.`,
    );
    settleMatch(nextState, current.session);
  }, [settleMatch, updateBombHoverIfChanged]);

  const handleReroll = useCallback(() => {
    if (roomModeRef.current?.isCountingDown) return;
    const current = matchRef.current;
    if (
      current.state.phase !== 'playing' ||
      current.state.rerollUsed ||
      bombAimingRef.current
    ) {
      return;
    }

    const nextState = rerollTray(current.state, current.session.rescueEligible);
    if (!nextState) return;

    actionsRef.current.push({
      seq: actionsRef.current.length,
      type: 'reroll',
    });

    cancelActiveDrag();
    setSelectedSlot(null);

    const nextBundle: MatchBundle = {
      session: current.session,
      state: nextState,
    };
    matchRef.current = nextBundle;
    setMatch(nextBundle);

    playSfx('reroll');

    if (nextState.phase === 'gameOver') {
      setEmotion('sad');
      setQuip('Đổi khay xong vẫn hết chỗ đặt rồi! Nhận Cookies thôi nào.');
      setLiveAnnouncement(
        `Đã đổi khay mới nhưng không còn nước đi hợp lệ. Kết thúc ván với ${nextState.score} điểm.`,
      );
      settleMatch(nextState, current.session);
    } else {
      roomModeRef.current?.onProgress(nextState);
      if (nextState.phase === 'rescuePrompt') {
        setEmotion('shock');
        setQuip('Khay mới hơi khó đặt! Thử Bom Kẹo 3×3 giải cứu không?');
        setLiveAnnouncement(
          'Đã đổi khay mới nhưng hết nước đi hợp lệ. Có thể dùng Bom Kẹo 3×3 giải cứu.',
        );
      } else {
        setEmotion('happy');
        setQuip('Đổi gió 3 mảnh mới tinh! Xem đặt đâu cho đẹp nào.');
        setLiveAnnouncement('Đã đổi khay 3 mảnh ghép mới miễn phí.');
      }
    }
  }, [
    cancelActiveDrag,
    settleMatch,
  ]);

  const startNewMatch = useCallback(() => {
    burstTimersRef.current.forEach((id) => window.clearTimeout(id));
    burstTimersRef.current.clear();
    shakeResetTimerRef.current = null;
    placedResetTimerRef.current = null;

    cancelActiveDrag();

    const nextSession = createMatchSession(cookies);
    const nextBundle: MatchBundle = {
      session: nextSession,
      state: createInitialState(nextSession.seed),
    };

    actionsRef.current = [];
    matchStartRef.current = performance.now();
    bombPaidCountRef.current = 0;
    settledRef.current = false;

    matchRef.current = nextBundle;
    setMatch(nextBundle);
    setSelectedSlot(null);
    setBombAiming(false);
    updateBombHoverIfChanged(null);
    setBursts([]);
    setScorePulse(null);
    setBoardShake('none');
    setRecentPlacedCells([]);
    setSettlement(null);
    setGameOverDismissed(false);
    setShowRestartConfirm(false);
    setEmotion('idle');
    setQuip(IDLE_QUIPS[0]);
    setLiveAnnouncement('Đã bắt đầu ván Block Blast mới.');
    playSfx('click');
  }, [
    cancelActiveDrag,
    cookies,
    updateBombHoverIfChanged,
  ]);

  const handleRestartRequest = useCallback(() => {
    const currentState = matchRef.current.state;
    if (currentState.movesCount > 0 && currentState.phase !== 'gameOver') {
      playSfx('click');
      setShowRestartConfirm(true);
      return;
    }
    startNewMatch();
  }, [startNewMatch]);

  const handleSlotPointerDown = useCallback(
    (slotIndex: number, e: ReactPointerEvent<HTMLButtonElement>) => {
      if (
        matchRef.current.state.phase !== 'playing' ||
        bombAimingRef.current ||
        roomModeRef.current?.isCountingDown
      ) {
        return;
      }
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      const piece = matchRef.current.state.tray[slotIndex];
      if (!piece) return;

      cancelActiveDrag();

      const boardRect = boardRef.current?.getBoundingClientRect();
      const boardCellSize =
        boardRect && boardRect.width > 0 ? boardRect.width / BOARD_SIZE : 48;

      dragSessionRef.current = {
        slotIndex,
        piece,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        isDragging: false,
        boardCellSize,
      };

      const onPointerMove = (ev: PointerEvent) => {
        const active = dragSessionRef.current;
        if (!active || ev.pointerId !== active.pointerId) return;

        if (!active.isDragging) {
          const dist = Math.hypot(
            ev.clientX - active.startX,
            ev.clientY - active.startY,
          );
          if (dist < DRAG_ACTIVATION_THRESHOLD_PX) return;

          active.isDragging = true;
          playSfx('blockPickup');
          setSelectedSlot(null);

          const offsetY =
            active.pointerType === 'touch' ? TOUCH_DRAG_OFFSET_Y : 0;
          setDragView({
            slotIndex: active.slotIndex,
            piece: active.piece,
            cellSizePx: active.boardCellSize,
            initialX: ev.clientX,
            initialY: ev.clientY + offsetY,
          });
        } else {
          const offsetY =
            active.pointerType === 'touch' ? TOUCH_DRAG_OFFSET_Y : 0;
          if (floatingDragRef.current) {
            floatingDragRef.current.style.transform = `translate3d(${ev.clientX}px, ${ev.clientY + offsetY}px, 0) translate(-50%, -50%)`;
          }
        }

        const nextAnchor = clientToBoardAnchor(
          boardRef.current,
          ev.clientX,
          ev.clientY,
          active.piece,
          active.pointerType,
        );
        updateHoverAnchorIfChanged(nextAnchor);
      };

      const onPointerUp = (ev: PointerEvent) => {
        const active = dragSessionRef.current;
        if (!active || ev.pointerId !== active.pointerId) return;

        const { isDragging, slotIndex: sIdx, piece: activePiece, pointerType } =
          active;

        cancelActiveDrag();

        if (!isDragging) {
          setSelectedSlot((prev) => (prev === sIdx ? null : sIdx));
          playSfx('click');
          return;
        }

        const releaseAnchor = clientToBoardAnchor(
          boardRef.current,
          ev.clientX,
          ev.clientY,
          activePiece,
          pointerType,
        );

        if (
          releaseAnchor &&
          canPlacePiece(
            matchRef.current.state.grid,
            activePiece,
            releaseAnchor.row,
            releaseAnchor.col,
          )
        ) {
          commitPlaceRef.current(sIdx, releaseAnchor.row, releaseAnchor.col);
        }
      };

      const onPointerCancel = (ev: PointerEvent) => {
        const active = dragSessionRef.current;
        if (!active || ev.pointerId !== active.pointerId) return;
        cancelActiveDrag();
      };

      const onWindowBlur = () => {
        if (!dragSessionRef.current) return;
        cancelActiveDrag();
      };

      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
      window.addEventListener('blur', onWindowBlur);

      windowDragCleanupRef.current = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
        window.removeEventListener('blur', onWindowBlur);
      };
    },
    [cancelActiveDrag, updateHoverAnchorIfChanged],
  );

  const handleSlotKeySelect = useCallback((slotIndex: number) => {
    if (
      matchRef.current.state.phase !== 'playing' ||
      bombAimingRef.current ||
      roomModeRef.current?.isCountingDown
    ) {
      return;
    }
    if (!matchRef.current.state.tray[slotIndex]) return;
    setSelectedSlot((prev) => {
      const next = prev === slotIndex ? null : slotIndex;
      setLiveAnnouncement(
        next === null
          ? 'Đã bỏ chọn mảnh ghép.'
          : `Đã chọn mảnh ô khay ${slotIndex + 1}. Di chuyển tới ô trên bàn cờ rồi nhấn Enter để đặt.`,
      );
      return next;
    });
    updateHoverAnchorIfChanged(null);
    playSfx('click');
  }, [updateHoverAnchorIfChanged]);

  const handleBoardPointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (dragSessionRef.current?.isDragging) return;

      if (bombAimingRef.current) {
        updateBombHoverIfChanged(
          clientToBoardCell(boardRef.current, clientX, clientY),
        );
        return;
      }

      if (selectedSlot !== null) {
        const piece = matchRef.current.state.tray[selectedSlot];
        if (!piece) return;
        updateHoverAnchorIfChanged(
          clientToBoardAnchor(
            boardRef.current,
            clientX,
            clientY,
            piece,
            'mouse',
          ),
        );
      }
    },
    [selectedSlot, updateBombHoverIfChanged, updateHoverAnchorIfChanged],
  );

  const handleBoardPointerLeave = useCallback(() => {
    if (dragSessionRef.current?.isDragging) return;
    if (bombAimingRef.current) {
      updateBombHoverIfChanged(null);
      return;
    }
    updateHoverAnchorIfChanged(null);
  }, [updateBombHoverIfChanged, updateHoverAnchorIfChanged]);

  const handleBoardCellClick = useCallback(
    (r: number, c: number) => {
      if (roomModeRef.current?.isCountingDown) return;
      if (bombAimingRef.current) {
        handleBombDetonate(r, c);
        return;
      }

      if (selectedSlot === null) return;
      const current = matchRef.current;
      const piece = current.state.tray[selectedSlot];
      if (!piece) return;

      const hovered = hoverAnchorRef.current;
      const clickedInsideHover =
        hovered !== null &&
        r >= hovered.row &&
        r < hovered.row + piece.height &&
        c >= hovered.col &&
        c < hovered.col + piece.width;

      if (
        clickedInsideHover &&
        hovered &&
        canPlacePiece(current.state.grid, piece, hovered.row, hovered.col)
      ) {
        commitPlace(selectedSlot, hovered.row, hovered.col);
        return;
      }

      if (hovered === null && canPlacePiece(current.state.grid, piece, r, c)) {
        commitPlace(selectedSlot, r, c);
        return;
      }

      setLiveAnnouncement('Vị trí này không đặt vừa mảnh đang chọn.');
    },
    [commitPlace, handleBombDetonate, selectedSlot],
  );

  const rescueModalOpen =
    !roomMode && state.phase === 'rescuePrompt' && !bombAiming;
  const gameOverModalOpen =
    !roomMode && state.phase === 'gameOver' && !gameOverDismissed;
  const anyDialogOpen =
    showHelp || showRestartConfirm || rescueModalOpen || gameOverModalOpen;

  // Global Esc handler for cancelling Bomb aiming, active drag, or tray selection
  useEffect(() => {
    if (anyDialogOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (bombAimingRef.current) {
        e.preventDefault();
        handleCancelBombAim();
        return;
      }
      if (dragSessionRef.current) {
        e.preventDefault();
        cancelActiveDrag();
        return;
      }
      if (selectedSlot !== null) {
        e.preventDefault();
        setSelectedSlot(null);
        updateHoverAnchorIfChanged(null);
        playSfx('click');
        setLiveAnnouncement('Đã bỏ chọn mảnh ghép.');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    anyDialogOpen,
    cancelActiveDrag,
    handleCancelBombAim,
    selectedSlot,
    updateHoverAnchorIfChanged,
  ]);

  const fitStatus = useMemo(() => {
    return [0, 1, 2].map((idx) => {
      const piece = state.tray[idx];
      if (!piece) return false;
      for (let r = 0; r <= BOARD_SIZE - piece.height; r++) {
        for (let c = 0; c <= BOARD_SIZE - piece.width; c++) {
          if (canPlacePiece(state.grid, piece, r, c)) return true;
        }
      }
      return false;
    });
  }, [state.grid, state.tray]);

  const preview: PlacementPreview | null = useMemo(() => {
    if (bombAiming) return null;
    if (dragView && hoverAnchor) {
      return getPlacementPreview(
        state.grid,
        dragView.piece,
        hoverAnchor.row,
        hoverAnchor.col,
      );
    }
    if (selectedSlot !== null && hoverAnchor) {
      const piece = state.tray[selectedSlot];
      if (!piece) return null;
      return getPlacementPreview(
        state.grid,
        piece,
        hoverAnchor.row,
        hoverAnchor.col,
      );
    }
    return null;
  }, [bombAiming, dragView, hoverAnchor, selectedSlot, state.grid, state.tray]);

  const toggleSfx = useCallback(() => {
    const next = !settings.sfxEnabled;
    updateSettings({ sfxEnabled: next });
    setAudioPreferences({ sfxEnabled: next });
    if (next) playSfx('click');
  }, [settings.sfxEnabled, updateSettings]);

  const toggleBgm = useCallback(() => {
    const next = !settings.bgmEnabled;
    updateSettings({ bgmEnabled: next });
    setAudioPreferences({ bgmEnabled: next });
    playSfx('click');
  }, [settings.bgmEnabled, updateSettings]);

  const toggleColorblind = useCallback(() => {
    const next = !settings.colorblindMode;
    updateSettings({ colorblindMode: next });
    playSfx('click');
  }, [settings.colorblindMode, updateSettings]);

  const isTrayEmpty = state.tray.every((slot) => slot === null);
  const canReroll =
    state.phase === 'playing' &&
    !state.rerollUsed &&
    !bombAiming &&
    !isTrayEmpty &&
    !roomMode?.isCountingDown;
  const canStartBomb =
    !roomMode &&
    state.phase !== 'gameOver' &&
    !state.candyBombUsed &&
    cookies >= CANDY_BOMB_COST;

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#1a100b] bg-[radial-gradient(circle_at_18%_0%,_#3a2114_0%,_transparent_46%),radial-gradient(circle_at_82%_0%,_#2c1810_0%,_transparent_46%),linear-gradient(180deg,_#1c110c_0%,_#120b08_100%)] text-[#FFF9F0] selection:bg-amber-300 selection:text-[#2C1B11]">
      {/* Screen-reader polite announcer */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-2 px-2.5 py-2.5 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
        {/* Top Bar */}
        <header className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/25 bg-[#24150e]/95 px-2.5 py-2 shadow-lg sm:rounded-3xl sm:px-4 sm:py-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                playSfx('click');
                if (roomMode) {
                  roomMode.onLeaveRoom();
                } else {
                  onBackToModeSelect();
                }
              }}
              className={`btn-tactile-wood inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-xl border border-amber-900/60 px-2.5 py-1 text-xs font-extrabold text-amber-100 sm:rounded-2xl sm:px-3.5 sm:py-1.5 ${FOCUS_RING_CLASS}`}
            >
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
              <span>{roomMode ? 'Rời Phòng' : 'Đổi Chế Độ'}</span>
            </button>

            <h1 className="font-display text-base font-black tracking-tight text-[#FFFBF4] sm:text-2xl">
              Block Blast PAWS
            </h1>

            {roomMode && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-950/75 px-2.5 py-1 text-[11px] font-black text-emerald-200">
                <Users aria-hidden="true" className="h-3 w-3 text-emerald-300" />
                <span>
                  Phòng {roomMode.roomCode} · Ván #{roomMode.roundNumber}
                </span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            {/* Cookies badge */}
            <div
              aria-label={`Hiện có ${cookies.toLocaleString('vi-VN')} Cookies`}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-amber-400/30 bg-[#170d08] px-2 py-1 text-xs font-black text-amber-200 shadow-inner sm:gap-1.5 sm:rounded-2xl sm:px-3 sm:text-sm"
            >
              <Cookie aria-hidden="true" className="h-3.5 w-3.5 text-amber-400 sm:h-4 sm:w-4" />
              <span className="tabular-nums">{cookies.toLocaleString('vi-VN')}</span>
            </div>

            {/* Best score badge */}
            <div
              aria-label={`Kỷ lục cá nhân ${blockBlastBestScore.toLocaleString('vi-VN')} điểm`}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-amber-800/60 bg-[#170d08] px-2 py-1 text-xs font-extrabold text-amber-100/90 shadow-inner sm:gap-1.5 sm:rounded-2xl sm:px-3"
            >
              <Trophy aria-hidden="true" className="h-3.5 w-3.5 text-amber-400" />
              <span className="tabular-nums">
                {blockBlastBestScore.toLocaleString('vi-VN')}đ
              </span>
            </div>

            {/* Quick toggles */}
            <button
              type="button"
              onClick={toggleSfx}
              aria-pressed={settings.sfxEnabled}
              aria-label={settings.sfxEnabled ? 'Tắt âm thanh hiệu ứng' : 'Bật âm thanh hiệu ứng'}
              className={`inline-flex touch-target cursor-pointer items-center justify-center rounded-xl border px-1.5 text-xs font-bold transition-colors sm:px-2 ${FOCUS_RING_CLASS} ${
                settings.sfxEnabled
                  ? 'border-emerald-400/45 bg-emerald-500/20 text-emerald-200'
                  : 'border-amber-900/50 bg-[#170d08] text-amber-200/55'
              }`}
            >
              {settings.sfxEnabled ? (
                <Volume2 aria-hidden="true" className="h-4 w-4" />
              ) : (
                <VolumeX aria-hidden="true" className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={toggleBgm}
              aria-pressed={settings.bgmEnabled}
              aria-label={settings.bgmEnabled ? 'Tắt nhạc nền cabin' : 'Bật nhạc nền cabin'}
              className={`inline-flex touch-target cursor-pointer items-center justify-center rounded-xl border px-1.5 text-xs font-bold transition-colors sm:px-2 ${FOCUS_RING_CLASS} ${
                settings.bgmEnabled
                  ? 'border-emerald-400/45 bg-emerald-500/20 text-emerald-200'
                  : 'border-amber-900/50 bg-[#170d08] text-amber-200/55'
              }`}
            >
              <Music aria-hidden="true" className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleColorblind}
              aria-pressed={settings.colorblindMode}
              aria-label={
                settings.colorblindMode
                  ? 'Tắt ký hiệu hỗ trợ mù màu'
                  : 'Bật ký hiệu hỗ trợ mù màu'
              }
              className={`inline-flex touch-target cursor-pointer items-center justify-center rounded-xl border px-1.5 text-xs font-bold transition-colors sm:px-2 ${FOCUS_RING_CLASS} ${
                settings.colorblindMode
                  ? 'border-sky-400/50 bg-sky-500/20 text-sky-200'
                  : 'border-amber-900/50 bg-[#170d08] text-amber-200/65'
              }`}
            >
              {settings.colorblindMode ? (
                <Eye aria-hidden="true" className="h-4 w-4" />
              ) : (
                <EyeOff aria-hidden="true" className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                playSfx('click');
                setShowHelp(true);
              }}
              aria-label="Hướng dẫn luật chơi Block Blast"
              className={`inline-flex touch-target cursor-pointer items-center justify-center rounded-xl border border-amber-700/50 bg-[#1c100a] px-1.5 text-amber-200 transition-colors hover:border-amber-400/60 hover:text-amber-50 sm:px-2 ${FOCUS_RING_CLASS}`}
            >
              <HelpCircle aria-hidden="true" className="h-4 w-4" />
            </button>

            {!roomMode && onOpenRoomMode && (
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  onOpenRoomMode();
                }}
                aria-label="Mở phòng đấu so tài điểm với bạn bè"
                className={`btn-tactile-emerald inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-black text-white sm:rounded-2xl sm:px-3.5 ${FOCUS_RING_CLASS}`}
              >
                <Users aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Phòng Đấu</span>
              </button>
            )}

            {!roomMode && (
              <button
                type="button"
                onClick={handleRestartRequest}
                aria-label="Chơi lại ván mới"
                className={`btn-tactile-wood inline-flex touch-target cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-800/60 px-2 py-1 text-xs font-extrabold text-amber-100 sm:px-3 ${FOCUS_RING_CLASS}`}
              >
                <RotateCcw aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
                <span className="hidden sm:inline">Chơi Lại</span>
              </button>
            )}
          </div>
        </header>

        {/* Optional local profile integrity warning banner */}
        {integrityWarning && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-950/60 px-4 py-2.5 text-xs font-bold text-amber-100 shadow"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-amber-300"
              />
              <span>
                Phát hiện dữ liệu hồ sơ cục bộ không khớp chữ ký bảo toàn và đã
                được đặt lại an toàn.
              </span>
            </div>
            <button
              type="button"
              onClick={dismissIntegrityWarning}
              aria-label="Đóng thông báo bảo toàn dữ liệu"
              className={`inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-amber-500/35 bg-[#1b100a] text-amber-200 hover:border-amber-300 ${FOCUS_RING_CLASS}`}
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Main Gameplay Workspace */}
        <main className="grid flex-1 grid-cols-1 items-start gap-3 lg:grid-cols-12 lg:items-center lg:gap-6">
          {/* Left Side (Desktop: 4 cols) / Compact Header Cluster (Mobile) */}
          <div className="flex flex-col gap-2.5 lg:col-span-4 lg:gap-3.5">
            <MemoMascotStage
              animal={selectedAnimal}
              accessories={equippedList}
              emotion={emotion}
              quip={quip}
              paused={anyDialogOpen}
              compact={!isDesktop || Boolean(roomMode)}
            />

            {roomMode && (
              <div className="hidden lg:block">{roomMode.leaderboardDesktop}</div>
            )}

            {/* Stage & Lines Progress Card */}
            <section
              aria-label="Tiến độ Stage và số dòng đã xóa"
              className="rounded-2xl border border-amber-500/25 bg-[#24150e]/95 px-3 py-2 shadow-lg sm:rounded-3xl sm:p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-black leading-tight transition-colors duration-500 sm:text-xs ${stageTheme.badgeClass}`}
                >
                  <span>
                    Stage {stageNumber} · {stageTheme.name}
                  </span>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-200/75"
                  aria-label={`Bảng ${stageTheme.palette.length} màu sạch`}
                >
                  <span className="inline-flex items-center gap-1" aria-hidden="true">
                    {stageTheme.palette.map((color) => (
                      <span
                        key={color}
                        className="h-2 w-2 rounded-full ring-1 ring-white/30"
                        style={{
                          backgroundColor: resolveStageColorToken(
                            color,
                            stageTheme,
                          ).bgHex,
                        }}
                      />
                    ))}
                  </span>
                  <span>{stageTheme.palette.length} màu sạch</span>
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-amber-900/45 pt-1.5 text-xs font-bold text-amber-200/80 sm:mt-2.5 sm:pt-2">
                <span className="inline-flex items-center gap-1.5">
                  <Layers aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />
                  <span>
                    Đã xóa:{' '}
                    <strong className="text-amber-50 tabular-nums">
                      {state.linesCleared}
                    </strong>{' '}
                    dòng
                  </span>
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
                  {state.streak > 0 ? (
                    <span className={state.graceUsed ? 'text-amber-300' : 'text-emerald-300'}>
                      {state.graceUsed ? 'Đã dùng ân hạn' : 'Còn 1 ân hạn'}
                    </span>
                  ) : (
                    <span>Nước đi: {state.movesCount}</span>
                  )}
                </span>
              </div>
            </section>

            {/* Skill Buttons */}
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 lg:gap-2.5">
              <button
                type="button"
                disabled={!canReroll}
                onClick={handleReroll}
                className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-2xl border px-2.5 py-2 text-xs font-black transition-all sm:min-h-[46px] sm:gap-2 sm:px-3 sm:text-sm ${FOCUS_RING_CLASS} ${
                  canReroll
                    ? 'btn-tactile-amber cursor-pointer border-amber-300/60 text-[#26160b]'
                    : 'cursor-not-allowed border-amber-900/45 bg-[#1b100a] text-amber-200/45'
                }`}
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="sm:hidden">
                  Đổi Khay ({state.rerollUsed ? '0/1' : '1/1'})
                </span>
                <span className="hidden sm:inline">
                  Đổi Khay · Miễn phí ({state.rerollUsed ? '0/1' : '1/1'})
                </span>
              </button>

              {roomMode ? (
                <div
                  aria-label="Luật phòng đấu công bằng Pure Skill"
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-2xl border border-emerald-400/35 bg-emerald-950/55 px-2.5 py-2 text-xs font-bold text-emerald-200 sm:min-h-[46px] sm:px-3"
                >
                  <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" />
                  <span className="sm:hidden">Pure Skill</span>
                  <span className="hidden sm:inline">Chung Seed · Không Bom Cookies</span>
                </div>
              ) : bombAiming ? (
                <button
                  type="button"
                  onClick={handleCancelBombAim}
                  className={`inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-2xl border-2 border-rose-300 bg-rose-600/90 px-2.5 py-2 text-xs font-black text-white shadow-[0_4px_0_#9F1239,0_0_16px_rgba(244,63,94,0.45)] transition hover:bg-rose-500 sm:min-h-[46px] sm:gap-2 sm:px-3 sm:text-sm ${FOCUS_RING_CLASS}`}
                >
                  <X aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="sm:hidden">Hủy Bom</span>
                  <span className="hidden sm:inline">Hủy Bom Kẹo (Esc)</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canStartBomb}
                  onClick={handleStartBombAim}
                  className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-2xl border px-2.5 py-2 text-xs font-black transition-all sm:min-h-[46px] sm:gap-2 sm:px-3 sm:text-sm ${FOCUS_RING_CLASS} ${
                    canStartBomb
                      ? 'cursor-pointer border-rose-300/65 bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-[0_4px_0_#9F1239,0_6px_12px_rgba(0,0,0,0.3)] hover:brightness-105 active:translate-y-[2px]'
                      : 'cursor-not-allowed border-amber-900/45 bg-[#1b100a] text-amber-200/45'
                  }`}
                >
                  <Bomb aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="sm:hidden">
                    {state.candyBombUsed
                      ? 'Bom 3×3 (Đã dùng)'
                      : `Bom 3×3 (-${CANDY_BOMB_COST})`}
                  </span>
                  <span className="hidden sm:inline">
                    {state.candyBombUsed
                      ? 'Bom Kẹo 3×3 · Đã dùng'
                      : `Bom Kẹo 3×3 · ${CANDY_BOMB_COST} Cookies`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Right Side (Desktop: 8 cols): Scoreboard + Board + Tray */}
          <section
            aria-label="Bảng điểm, bàn cờ và khay mảnh ghép"
            className="flex flex-col items-center justify-center gap-2.5 lg:col-span-8 lg:gap-3.5"
          >
            {roomMode && (
              <div className="flex w-full justify-center lg:hidden">
                {roomMode.leaderboardMobile}
              </div>
            )}

            <ScoreHeaderCard
              score={state.score}
              bestScore={blockBlastBestScore}
              streak={state.streak}
              stageNumber={stageNumber}
              stageTheme={stageTheme}
              pulse={scorePulse}
              reducedMotion={settings.reducedMotion}
            />

            {roomMode?.lastEmote && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-full border border-amber-300/60 bg-[#2b180e]/95 px-4 py-1.5 text-xs font-black text-amber-100 shadow-lg"
              >
                <span className="text-base">{roomMode.lastEmote.emote}</span>
                <span>
                  {roomMode.lastEmote.name}: {roomMode.lastEmote.text}
                </span>
              </div>
            )}

            {/* Contextual interaction banner */}
            {bombAiming && (
              <div
                role="status"
                className="flex w-full max-w-[492px] items-center justify-between gap-2 rounded-2xl border border-rose-400/60 bg-rose-950/75 px-3.5 py-2 text-xs font-bold text-rose-100 shadow-lg"
              >
                <span className="flex items-center gap-2">
                  <Bomb aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-300" />
                  <span>
                    Nhấn vào 1 ô trên bàn cờ để nổ vùng 3×3 (-{CANDY_BOMB_COST} Cookies)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleCancelBombAim}
                  className={`shrink-0 cursor-pointer rounded-xl border border-rose-300/50 bg-rose-900/70 px-2.5 py-1 text-xs font-black text-white hover:bg-rose-800 ${FOCUS_RING_CLASS}`}
                >
                  Hủy
                </button>
              </div>
            )}

            {!bombAiming && state.phase === 'gameOver' && gameOverDismissed && (
              <div
                role="status"
                className="flex w-full max-w-[492px] flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-400/55 bg-[#2a170e]/95 px-3.5 py-2 text-xs font-bold text-amber-100 shadow-lg"
              >
                <span>
                  Ván đã kết thúc · Tổng điểm{' '}
                  <strong className="text-amber-300">
                    {state.score.toLocaleString('vi-VN')}
                  </strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGameOverDismissed(false)}
                    className={`btn-tactile-amber cursor-pointer rounded-xl px-3 py-1 text-xs font-black ${FOCUS_RING_CLASS}`}
                  >
                    Xem Kết Quả
                  </button>
                  <button
                    type="button"
                    onClick={startNewMatch}
                    className={`btn-tactile-emerald cursor-pointer rounded-xl px-3 py-1 text-xs font-black ${FOCUS_RING_CLASS}`}
                  >
                    Chơi Lại
                  </button>
                </div>
              </div>
            )}

            {!bombAiming &&
              state.phase === 'playing' &&
              selectedSlot !== null && (
                <div
                  role="status"
                  className="flex w-full max-w-[492px] items-center justify-between gap-2 rounded-2xl border border-amber-400/45 bg-[#2a170e]/90 px-3.5 py-1.5 text-xs font-bold text-amber-100 shadow"
                >
                  <span>
                    Đã chọn mảnh #{selectedSlot + 1} — nhấn vào ô trên bàn cờ để
                    đặt
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSlot(null);
                      updateHoverAnchorIfChanged(null);
                      playSfx('click');
                    }}
                    className={`shrink-0 cursor-pointer rounded-xl border border-amber-500/40 bg-[#1a0f0a] px-2.5 py-0.5 text-[11px] font-black text-amber-200 hover:border-amber-300 ${FOCUS_RING_CLASS}`}
                  >
                    Bỏ chọn
                  </button>
                </div>
              )}

            <div className="relative flex w-full justify-center">
              <BlockBoard
                boardRef={boardRef}
                grid={state.grid}
                preview={preview}
                bombHoverCell={bombHoverCell}
                bombAiming={bombAiming}
                colorblindMode={settings.colorblindMode}
                reducedMotion={settings.reducedMotion}
                bursts={bursts}
                stageTheme={stageTheme}
                boardShake={boardShake}
                recentPlacedCells={recentPlacedCells}
                onBoardCellClick={handleBoardCellClick}
                onBoardPointerMove={handleBoardPointerMove}
                onBoardPointerLeave={handleBoardPointerLeave}
              />

              {roomMode?.isCountingDown && (
                <div
                  aria-live="assertive"
                  className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-[#120905]/80 backdrop-blur-[3px]"
                >
                  <div className="rounded-3xl border-2 border-emerald-300/60 bg-[#152820]/95 px-8 py-6 text-center shadow-2xl">
                    <div className="text-xs font-black uppercase tracking-widest text-emerald-300">
                      Chung Seed · Chuẩn Bị Xuất Phát
                    </div>
                    <div className="mt-1 font-display text-6xl font-black text-amber-200 tabular-nums drop-shadow">
                      {Math.max(1, roomMode.countdownSeconds)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <BlockTray
              tray={state.tray}
              draggingSlot={dragView?.slotIndex ?? null}
              selectedSlot={selectedSlot}
              fitStatus={fitStatus}
              disabled={
                state.phase !== 'playing' ||
                bombAiming ||
                Boolean(roomMode?.isCountingDown)
              }
              colorblindMode={settings.colorblindMode}
              stageTheme={stageTheme}
              onSlotPointerDown={handleSlotPointerDown}
              onSlotKeySelect={handleSlotKeySelect}
            />
          </section>
        </main>
      </div>

      {/* 60fps Compositor-Driven Floating Drag Layer */}
      {dragView && (
        <MemoFloatingDragPiece
          dragView={dragView}
          colorblindMode={settings.colorblindMode}
          stageTheme={stageTheme}
          floatingRef={floatingDragRef}
        />
      )}

      {/* Native Top-Layer Modals */}
      <RescueDialog
        open={rescueModalOpen}
        cookies={cookies}
        bombCost={CANDY_BOMB_COST}
        onUseBomb={handleStartBombAim}
        onDecline={handleDeclineRescue}
      />

      <GameOverDialog
        open={gameOverModalOpen}
        score={state.score}
        bestScore={blockBlastBestScore}
        isNewBest={settlement?.isNewBest ?? false}
        linesCleared={state.linesCleared}
        maxStreak={state.maxStreak}
        cookiesEarned={settlement?.reward ?? 0}
        settlementValid={settlement?.valid ?? false}
        onPlayAgain={startNewMatch}
        onBackToModes={() => {
          playSfx('click');
          onBackToModeSelect();
        }}
        onDismiss={() => setGameOverDismissed(true)}
      />

      <HelpDialog open={showHelp} onClose={() => setShowHelp(false)} />

      <RestartConfirmDialog
        open={showRestartConfirm}
        currentScore={state.score}
        onConfirmRestart={startNewMatch}
        onCancel={() => setShowRestartConfirm(false)}
      />
    </div>
  );
}

export { BlockBlastScreen };
