import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { playSfx, type SfxType } from '../../audio/soundEngine.ts';
import { TouchDpad } from '../../components/TouchDpad.tsx';
import { useDeviceFormFactor } from '../../utils/useDeviceFormFactor.ts';
import {
  SURVIVAL_SNAPSHOT_INTERVAL_MS,
  packSurvivalSnapshot,
  type PackedPlayer,
  type SurvivalSkillActionPayload,
  type SurvivalSnapshotPayload,
} from '../online/protocol.ts';
import type { SurvivalSnapshotInterpolator } from '../online/snapshotInterpolation.ts';
import { BOSS_NAMES } from '../sim/catalog.ts';
import {
  applySkillPick,
  buildHudSnapshot,
  buildMatchSummary,
  continueEndlessMode,
  createSurvivalWorld,
  rerollSkillOffers,
  stepSurvivalWorld,
  type CreateWorldConfig,
} from '../sim/engine.ts';
import { WORLD_SIZE, generateMapLayout, getSurvivalMapMeta } from '../sim/maps.ts';
import type {
  BossKind,
  MapObstacle,
  MapZone,
  SurvivalHudSnapshot,
  SurvivalInput,
  SurvivalMatchSummary,
  SurvivalMode,
  SurvivalPhase,
  SurvivalPlayerSummary,
  SurvivalSimEvent,
  SurvivalWorldState,
  WeaponId,
} from '../sim/types.ts';
import {
  renderSurvivalFrame,
  snapshotToRenderView,
  worldToRenderView,
  type SurvivalRenderView,
} from './canvasRenderer.ts';

export interface SurvivalCanvasHandle {
  pickSkill: (offerIndex: number) => void;
  reroll: () => void;
  continueEndless: () => void;
  toggleAutoAim: () => void;
  getMatchSummary: () => SurvivalMatchSummary | null;
}

export interface SurvivalCanvasOnlineProps {
  role: 'host' | 'client';
  localPlayerId: string;
  onBroadcastSnapshot?: (snap: SurvivalSnapshotPayload) => void;
  onSendClientInput?: (input: SurvivalInput) => void;
  getRemoteInputs?: () => Record<string, SurvivalInput>;
  getDisconnectedGuestIds?: (nowMs: number) => string[];
  interpolatorRef?: MutableRefObject<SurvivalSnapshotInterpolator>;
  onRegisterSkillAction?: (
    fn: ((action: SurvivalSkillActionPayload) => void) | null,
  ) => void;
  onRegisterContinueEndless?: (fn: (() => void) | null) => void;
  onSendClientSkillPick?: (offerIndex: number) => void;
  onSendClientReroll?: () => void;
  onSendContinueEndless?: () => void;
}

export interface SurvivalCanvasProps {
  config: CreateWorldConfig;
  localPlayerId: string;
  paused: boolean;
  inputDisabled?: boolean;
  reducedMotion: boolean;
  sfxEnabled: boolean;
  autoAim: boolean;
  onAutoAimChange: (next: boolean) => void;
  onTogglePause: () => void;
  onHudSnapshot: (hud: SurvivalHudSnapshot) => void;
  onMatchEnd: (summary: SurvivalMatchSummary) => void;
  onTouchControlsChange?: (active: boolean) => void;
  online?: SurvivalCanvasOnlineProps;
}

const HUD_INTERVAL_MS = 66;
const LEVELUP_SNAPSHOT_INTERVAL_MS = 500;

const WEAPON_SFX: Record<WeaponId, SfxType> = {
  candy_smg: 'shoot',
  chestnut_shotgun: 'punch',
  frost_bow: 'crossbow',
  lightning_staff: 'taser',
  candy_launcher: 'bomb',
  snow_boomerang: 'boomerang',
};

const EVENT_SFX_COOLDOWN_MS: Record<SurvivalSimEvent['type'], number> = {
  shoot: 95,
  hit: 80,
  enemy_kill: 90,
  xp_pickup: 70,
  level_up: 250,
  boss_warn: 500,
  boss_spawn: 500,
  boss_kill: 400,
  dash: 150,
  player_down: 300,
  player_revive: 300,
  crate_break: 120,
  victory: 500,
  gameover: 500,
};

function isFormElement(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function packedPlayerToSummary(p: PackedPlayer): SurvivalPlayerSummary {
  return {
    id: p.id,
    name: p.name,
    animal: p.animal,
    weaponId: p.weaponId,
    gearId: p.gearId,
    isBot: p.isBot,
    hp: p.hp,
    maxHp: p.maxHp,
    downed: p.downed,
    reviveProgress: p.reviveProgress,
    kills: p.kills,
    damageDealt: Math.round(p.damageDealt),
    score: Math.round(p.score),
    revives: p.revives,
    skills: { ...p.skills },
    secondaryCooldowns: p.secondaryCooldowns ? { ...p.secondaryCooldowns } : {},
    rerollsLeft: p.rerollsLeft,
    dashCooldownPct: Math.max(
      0,
      Math.min(1, p.dashCooldownTimer / Math.max(0.01, p.dashCooldownMax)),
    ),
    comboCount: p.comboCount,
  };
}

function buildClientHudSnapshot(
  snap: SurvivalSnapshotPayload,
  mode: SurvivalMode,
  localPlayerId: string,
): SurvivalHudSnapshot | null {
  if (snap.players.length === 0) return null;
  const local =
    snap.players.find((p) => p.id === localPlayerId) ?? snap.players[0];
  const teammates = snap.players
    .filter((p) => p.id !== local.id)
    .map(packedPlayerToSummary);

  let totalKills = 0;
  let humanCount = 0;
  let pickedCount = 0;
  for (let i = 0; i < snap.players.length; i += 1) {
    const p = snap.players[i];
    totalKills += p.kills;
    if (!p.isBot && !p.botTakeover) {
      humanCount += 1;
      if (snap.pickedPlayerIds.includes(p.id)) {
        pickedCount += 1;
      }
    }
  }

  const bossEntity =
    snap.activeBossId !== null
      ? snap.enemies.find((e) => e.id === snap.activeBossId && e.hp > 0) ?? null
      : null;

  return {
    phase: snap.phase,
    mode,
    mapId: snap.mapId,
    isEndlessActive: snap.isEndlessActive,
    elapsedSec: snap.elapsedSec,
    score: Math.round(snap.score),
    teamLevel: snap.teamLevel,
    teamXp: snap.teamXp,
    xpToNext: snap.xpToNext,
    totalKills,
    bossesSlain: snap.bossesSlain,
    nextBossInSec:
      snap.activeBossId !== null
        ? 0
        : Math.max(0, snap.nextBossAtSec - snap.elapsedSec),
    bossWarningSec: snap.bossWarningSec,
    bossWarningName: snap.bossWarningKind
      ? BOSS_NAMES[snap.bossWarningKind]
      : null,
    activeBoss: bossEntity
      ? {
          name: BOSS_NAMES[bossEntity.kind as BossKind],
          hp: Math.max(0, Math.ceil(bossEntity.hp)),
          maxHp: bossEntity.maxHp,
          tier: bossEntity.bossTier,
          isFinalBoss:
            !snap.isEndlessActive &&
            bossEntity.kind === getSurvivalMapMeta(snap.mapId).finalBossKind,
        }
      : null,
    sandstormActive: snap.sandstormActive,
    localPlayer: packedPlayerToSummary(local),
    teammates,
    pendingOffers: snap.pendingOffersByPlayer[local.id] ?? [],
    hasLocalPicked: snap.pickedPlayerIds.includes(local.id),
    pickedCount,
    humanCount,
    levelUpTimerSec: snap.levelUpTimerSec,
  };
}

function buildClientMatchSummary(
  snap: SurvivalSnapshotPayload,
  mode: SurvivalMode,
): SurvivalMatchSummary {
  const totalKills = snap.players.reduce((sum, p) => sum + p.kills, 0);
  const campaignVictory =
    snap.phase === 'victory' ||
    (!getSurvivalMapMeta(snap.mapId).isEndless && snap.isEndlessActive);

  return {
    matchId: snap.matchId,
    mapId: snap.mapId,
    mode,
    victory: campaignVictory,
    isEndless: snap.isEndlessActive,
    elapsedSec: snap.elapsedSec,
    teamLevel: snap.teamLevel,
    score: Math.round(snap.score),
    totalKills,
    bossesSlain: snap.bossesSlain,
    players: snap.players.map(packedPlayerToSummary),
  };
}

function createPlaceholderClientView(
  config: CreateWorldConfig,
  layout: {
    obstacles: MapObstacle[];
    zones: MapZone[];
    spawnPoints: Array<{ x: number; y: number }>;
  },
): SurvivalRenderView {
  return {
    mapId: config.mapId,
    elapsedSec: 0,
    sandstormActive: false,
    obstacles: layout.obstacles,
    zones: layout.zones,
    players: config.players.map((p, idx) => {
      const sp = layout.spawnPoints[idx % layout.spawnPoints.length];
      return {
        id: p.id,
        name: p.name,
        animal: p.animal,
        weaponId: p.weaponId,
        isBot: p.isBot,
        botTakeover: false,
        x: sp.x,
        y: sp.y,
        aimAngle: 0,
        hp: 120,
        maxHp: 120,
        downed: false,
        reviveProgress: 0,
        invulnTimer: 0,
        dashTimer: 0,
        hitFlashTimer: 0,
        orbitalAngle: 0,
        droneAngle: 0,
        pylonBuffTimer: 0,
      };
    }),
    enemies: [],
    projectiles: [],
    xpGems: [],
    crates: [],
    pickups: [],
    hazards: [],
    floatingTexts: [],
    particles: [],
    lightningArcs: [],
    visualEffects: [],
  };
}

function clampCameraAxis(
  val: number,
  viewportSpan: number,
): number {
  const half = viewportSpan * 0.5;
  const minBound = Math.min(WORLD_SIZE * 0.5, Math.max(0, half - 120));
  const maxBound = Math.max(
    WORLD_SIZE * 0.5,
    Math.min(WORLD_SIZE, WORLD_SIZE - half + 120),
  );
  return Math.max(minBound, Math.min(maxBound, val));
}

function stepCameraToward(
  camera: { x: number; y: number },
  players: readonly { id: string; x: number; y: number; downed: boolean }[],
  localPlayerId: string,
  viewportW: number,
  viewportH: number,
  dt: number,
  reducedMotion: boolean,
): void {
  const local = players.find((p) => p.id === localPlayerId) ?? players[0] ?? null;
  let target = local;
  if (!target || target.downed) {
    const aliveMate = players.find((p) => !p.downed);
    if (aliveMate) {
      target = aliveMate;
    }
  }

  const tx = target ? target.x : WORLD_SIZE * 0.5;
  const ty = target ? target.y : WORLD_SIZE * 0.5;
  const alpha = reducedMotion ? 1 : 1 - Math.exp(-9 * Math.max(0, dt));

  camera.x = clampCameraAxis(camera.x + (tx - camera.x) * alpha, viewportW);
  camera.y = clampCameraAxis(camera.y + (ty - camera.y) * alpha, viewportH);
}

/**
 * 60Hz Canvas2D game loop and responsive viewport container for Survival mode.
 * Keeps all high-frequency entity state, camera, interpolation, and inputs in refs,
 * emitting HUD snapshots at ~15Hz and immediately on phase transitions.
 */
export const SurvivalCanvas = forwardRef<SurvivalCanvasHandle, SurvivalCanvasProps>(
  function SurvivalCanvas(
    {
      config,
      localPlayerId,
      paused,
      inputDisabled = false,
      reducedMotion,
      sfxEnabled,
      autoAim,
      onAutoAimChange,
      onTogglePause,
      onHudSnapshot,
      onMatchEnd,
      onTouchControlsChange,
      online,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const effectiveLocalId = online?.localPlayerId ?? localPlayerId;
    const isClient = online?.role === 'client';

    // Synced refs so the 60Hz RAF loop never restarts on prop callback changes
    const configRef = useRef(config);
    configRef.current = config;
    const localIdRef = useRef(effectiveLocalId);
    localIdRef.current = effectiveLocalId;
    const pausedRef = useRef(paused);
    pausedRef.current = paused;
    const inputDisabledRef = useRef<boolean>(Boolean(inputDisabled));
    inputDisabledRef.current = Boolean(inputDisabled);
    const reducedMotionRef = useRef(reducedMotion);
    reducedMotionRef.current = reducedMotion;
    const sfxEnabledRef = useRef(sfxEnabled);
    sfxEnabledRef.current = sfxEnabled;
    const autoAimRef = useRef(autoAim);
    autoAimRef.current = autoAim;
    const onAutoAimChangeRef = useRef(onAutoAimChange);
    onAutoAimChangeRef.current = onAutoAimChange;
    const onTogglePauseRef = useRef(onTogglePause);
    onTogglePauseRef.current = onTogglePause;
    const onHudSnapshotRef = useRef(onHudSnapshot);
    onHudSnapshotRef.current = onHudSnapshot;
    const onMatchEndRef = useRef(onMatchEnd);
    onMatchEndRef.current = onMatchEnd;
    const onlineRef = useRef(online);
    onlineRef.current = online;

    const worldRef = useRef<SurvivalWorldState | null>(null);
    const clientLayoutRef = useRef<{
      obstacles: MapObstacle[];
      zones: MapZone[];
      spawnPoints: Array<{ x: number; y: number }>;
    } | null>(null);
    const clientZonesScratchRef = useRef<MapZone[] | undefined>(undefined);
    const lastClientSnapshotRef = useRef<SurvivalSnapshotPayload | null>(null);

    const cameraRef = useRef<{ x: number; y: number }>({
      x: WORLD_SIZE * 0.5,
      y: WORLD_SIZE * 0.5,
    });
    const viewportRef = useRef<{ width: number; height: number; dpr: number }>({
      width: 1280,
      height: 720,
      dpr: 1,
    });

    const keysRef = useRef<Set<string>>(new Set());
    const dashPressedRef = useRef<boolean>(false);
    const pointerScreenRef = useRef<{ x: number; y: number } | null>(null);
    const mouseLeftDownRef = useRef<boolean>(false);
    const touchMoveRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const dpadActiveRef = useRef<boolean>(false);

    const tickRef = useRef<number>(0);
    const lastPhaseRef = useRef<SurvivalPhase | null>(null);
    const endedNotifiedRef = useRef<boolean>(false);
    const lastHudSentAtRef = useRef<number>(0);
    const lastSnapshotSentAtRef = useRef<number>(0);
    const sfxCooldownMapRef = useRef<Map<string, number>>(new Map());

    const showTouchControls = useDeviceFormFactor() === 'tablet';

    const playThrottledSfx = useCallback(
      (key: string, sfxType: SfxType, cooldownMs: number, nowMs: number) => {
        if (!sfxEnabledRef.current) return;
        const last = sfxCooldownMapRef.current.get(key) ?? -Infinity;
        if (nowMs - last < cooldownMs) return;
        sfxCooldownMapRef.current.set(key, nowMs);
        playSfx(sfxType);
      },
      [],
    );

    const playSimEventsSfx = useCallback(
      (events: readonly SurvivalSimEvent[], nowMs: number) => {
        if (!sfxEnabledRef.current || events.length === 0) return;
        for (let i = 0; i < events.length; i += 1) {
          const evt = events[i];
          const cd = EVENT_SFX_COOLDOWN_MS[evt.type];
          switch (evt.type) {
            case 'shoot': {
              const sfx = evt.weaponId ? WEAPON_SFX[evt.weaponId] : 'shoot';
              playThrottledSfx(`shoot_${evt.weaponId ?? 'def'}`, sfx, cd, nowMs);
              break;
            }
            case 'hit':
              playThrottledSfx('hit', 'hit', cd, nowMs);
              break;
            case 'enemy_kill':
              playThrottledSfx('enemy_kill', 'play', cd, nowMs);
              break;
            case 'xp_pickup':
              playThrottledSfx('xp_pickup', 'pickup', cd, nowMs);
              break;
            case 'level_up':
              playThrottledSfx('level_up', 'levelUp', cd, nowMs);
              break;
            case 'boss_warn':
              playThrottledSfx('boss_warn', 'bossWarn', cd, nowMs);
              break;
            case 'boss_spawn':
              playThrottledSfx('boss_spawn', 'roundStart', cd, nowMs);
              break;
            case 'boss_kill':
              playThrottledSfx('boss_kill', 'allClear', cd, nowMs);
              break;
            case 'dash':
              playThrottledSfx('dash', 'roll', cd, nowMs);
              break;
            case 'player_down':
              playThrottledSfx('player_down', 'ko', cd, nowMs);
              break;
            case 'player_revive':
              playThrottledSfx('player_revive', 'potion', cd, nowMs);
              break;
            case 'crate_break':
              playThrottledSfx('crate_break', 'candyBomb', cd, nowMs);
              break;
            case 'victory':
              playThrottledSfx('victory', 'win', cd, nowMs);
              break;
            case 'gameover':
              playThrottledSfx('gameover', 'lose', cd, nowMs);
              break;
          }
        }
      },
      [playThrottledSfx],
    );

    const emitHostStateImmediately = useCallback((world: SurvivalWorldState) => {
      const nowMs = performance.now();
      const hud = buildHudSnapshot(world, localIdRef.current);
      lastHudSentAtRef.current = nowMs;
      lastPhaseRef.current = world.phase;
      onHudSnapshotRef.current(hud);

      if (onlineRef.current?.role === 'host') {
        lastSnapshotSentAtRef.current = nowMs;
        tickRef.current += 1;
        onlineRef.current.onBroadcastSnapshot?.(
          packSurvivalSnapshot(world, tickRef.current),
        );
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        pickSkill: (offerIndex: number) => {
          if (onlineRef.current?.role === 'client') {
            onlineRef.current.onSendClientSkillPick?.(offerIndex);
            return;
          }
          const world = worldRef.current;
          if (!world) return;
          if (applySkillPick(world, localIdRef.current, offerIndex)) {
            if (sfxEnabledRef.current) playSfx('click');
            emitHostStateImmediately(world);
          }
        },
        reroll: () => {
          if (onlineRef.current?.role === 'client') {
            onlineRef.current.onSendClientReroll?.();
            return;
          }
          const world = worldRef.current;
          if (!world) return;
          if (rerollSkillOffers(world, localIdRef.current)) {
            if (sfxEnabledRef.current) playSfx('reroll');
            emitHostStateImmediately(world);
          }
        },
        continueEndless: () => {
          if (onlineRef.current?.role === 'client') {
            onlineRef.current.onSendContinueEndless?.();
            return;
          }
          const world = worldRef.current;
          if (!world || world.phase !== 'victory' || world.isEndlessActive) return;
          continueEndlessMode(world);
          endedNotifiedRef.current = false;
          emitHostStateImmediately(world);
          onlineRef.current?.onSendContinueEndless?.();
        },
        toggleAutoAim: () => {
          onAutoAimChangeRef.current(!autoAimRef.current);
        },
        getMatchSummary: () => {
          if (onlineRef.current?.role === 'client') {
            const snap = lastClientSnapshotRef.current;
            return snap ? buildClientMatchSummary(snap, configRef.current.mode) : null;
          }
          return worldRef.current ? buildMatchSummary(worldRef.current) : null;
        },
      }),
      [emitHostStateImmediately],
    );

    // ResizeObserver + DPR scaling
    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const updateSize = () => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        viewportRef.current = { width, height, dpr };
        const pixelW = Math.max(1, Math.round(width * dpr));
        const pixelH = Math.max(1, Math.round(height * dpr));
        if (canvas.width !== pixelW || canvas.height !== pixelH) {
          canvas.width = pixelW;
          canvas.height = pixelH;
        }
      };

      updateSize();
      const observer = new ResizeObserver(updateSize);
      observer.observe(container);
      window.addEventListener('resize', updateSize);

      return () => {
        observer.disconnect();
        window.removeEventListener('resize', updateSize);
      };
    }, []);

    const clearInputs = useCallback(() => {
      keysRef.current.clear();
      dashPressedRef.current = false;
      mouseLeftDownRef.current = false;
      touchMoveRef.current = { x: 0, y: 0 };
      dpadActiveRef.current = false;
    }, []);

    // Notify parent when touch controls visibility changes (coordinates HUD spacing)
    useEffect(() => {
      onTouchControlsChange?.(showTouchControls);
    }, [onTouchControlsChange, showTouchControls]);

    const isInputDisabled = Boolean(inputDisabled);
    useEffect(() => {
      if (paused || isInputDisabled) {
        clearInputs();
      }
    }, [paused, isInputDisabled, clearInputs]);

    // Keyboard & Pointer Input Listeners
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if (isFormElement(e.target)) return;
        if (pausedRef.current || inputDisabledRef.current) return;

        if (e.code === 'Escape') {
          if (!e.repeat) {
            e.preventDefault();
            onTogglePauseRef.current();
          }
          return;
        }

        if (
          e.code === 'Space' ||
          e.code === 'ArrowUp' ||
          e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' ||
          e.code === 'ArrowRight'
        ) {
          e.preventDefault();
        }

        if (!e.repeat) {
          if (e.code === 'KeyQ') {
            onAutoAimChangeRef.current(!autoAimRef.current);
            return;
          }
          if (
            e.code === 'Space' ||
            e.code === 'ShiftLeft' ||
            e.code === 'ShiftRight'
          ) {
            dashPressedRef.current = true;
          }
        }

        keysRef.current.add(e.code);
      };

      const onKeyUp = (e: KeyboardEvent) => {
        keysRef.current.delete(e.code);
      };

      const updatePointerFromMouse = (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        pointerScreenRef.current = {
          x: clientX - rect.left,
          y: clientY - rect.top,
        };
      };

      const onPointerMove = (e: PointerEvent) => {
        if (e.pointerType === 'touch') return;
        updatePointerFromMouse(e.clientX, e.clientY);
        if ((e.buttons & 1) === 0) {
          mouseLeftDownRef.current = false;
        }
      };

      const onPointerDown = (e: PointerEvent) => {
        if (pausedRef.current || inputDisabledRef.current) return;
        if (e.pointerType === 'touch') {
          return;
        }
        if (e.target === canvasRef.current) {
          containerRef.current?.focus({ preventScroll: true });
          if (e.button === 0) {
            updatePointerFromMouse(e.clientX, e.clientY);
            mouseLeftDownRef.current = true;
          } else {
            e.preventDefault();
          }
        }
      };

      const onPointerUp = (e: PointerEvent) => {
        if (e.pointerType === 'touch') return;
        mouseLeftDownRef.current = (e.buttons & 1) !== 0;
      };

      const onVisibilityChange = () => {
        if (document.hidden) clearInputs();
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('blur', clearInputs);
      document.addEventListener('visibilitychange', onVisibilityChange);

      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('blur', clearInputs);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    }, [clearInputs]);

    // Register online skill action & endless handlers
    useEffect(() => {
      const regSkill = online?.onRegisterSkillAction;
      const regEndless = online?.onRegisterContinueEndless;

      if (regSkill) {
        if (!isClient) {
          regSkill((action) => {
            const world = worldRef.current;
            if (!world || action.matchId !== world.matchId) return;
            let changed = false;
            if (action.action === 'pick' && typeof action.offerIndex === 'number') {
              changed = applySkillPick(world, action.peerId, action.offerIndex);
            } else if (action.action === 'reroll') {
              changed = rerollSkillOffers(world, action.peerId);
            }
            if (changed) {
              emitHostStateImmediately(world);
            }
          });
        } else {
          regSkill(null);
        }
      }

      if (regEndless) {
        regEndless(() => {
          if (isClient) {
            endedNotifiedRef.current = false;
            return;
          }
          const world = worldRef.current;
          if (world && world.phase === 'victory' && !world.isEndlessActive) {
            endedNotifiedRef.current = false;
            continueEndlessMode(world);
            emitHostStateImmediately(world);
          }
        });
      }

      return () => {
        regSkill?.(null);
        regEndless?.(null);
      };
    }, [emitHostStateImmediately, isClient, online?.onRegisterContinueEndless, online?.onRegisterSkillAction]);

    // Main 60Hz Simulation & Render Loop
    useEffect(() => {
      const currentConfig = configRef.current;
      tickRef.current = 0;
      endedNotifiedRef.current = false;
      lastHudSentAtRef.current = 0;
      lastSnapshotSentAtRef.current = 0;
      lastClientSnapshotRef.current = null;

      if (isClient) {
        worldRef.current = null;
        onlineRef.current?.interpolatorRef?.current.reset();
        lastClientSnapshotRef.current = null;
        const layout = generateMapLayout(currentConfig.mapId, currentConfig.seed);
        clientLayoutRef.current = layout;
        clientZonesScratchRef.current = layout.zones.map((z) => ({ ...z }));
        lastPhaseRef.current = null;
        const sp = layout.spawnPoints[0] ?? {
          x: WORLD_SIZE * 0.5,
          y: WORLD_SIZE * 0.5,
        };
        cameraRef.current = { x: sp.x, y: sp.y };
      } else {
        clientLayoutRef.current = null;
        clientZonesScratchRef.current = undefined;
        const world = createSurvivalWorld(currentConfig);
        worldRef.current = world;
        lastPhaseRef.current = world.phase;
        const local =
          world.players.find((p) => p.id === localIdRef.current) ??
          world.players[0];
        cameraRef.current = {
          x: local ? local.x : WORLD_SIZE * 0.5,
          y: local ? local.y : WORLD_SIZE * 0.5,
        };
        emitHostStateImmediately(world);
      }

      let rafId = 0;
      let prevFrameMs = performance.now();
      let prevClientBossWarn = false;
      let prevClientActiveBoss: string | null = null;
      let prevClientBossesSlain = 0;
      let prevClientTeamXp = 0;

      const buildLocalInput = (
        consumeDash: boolean,
      ): { input: SurvivalInput; aimCursorWorld: { x: number; y: number } | null; manualAim: boolean } => {
        if (pausedRef.current || inputDisabledRef.current) {
          if (consumeDash) {
            dashPressedRef.current = false;
          }
          const cam = cameraRef.current;
          return {
            input: {
              moveX: 0,
              moveY: 0,
              aimX: cam.x,
              aimY: cam.y,
              manualAim: false,
              dashPressed: false,
            },
            aimCursorWorld: null,
            manualAim: false,
          };
        }

        const keys = keysRef.current;
        let moveX = touchMoveRef.current.x;
        let moveY = touchMoveRef.current.y;

        if (keys.has('KeyW') || keys.has('ArrowUp')) moveY -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) moveY += 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;

        const moveLen = Math.hypot(moveX, moveY);
        if (moveLen > 1) {
          moveX /= moveLen;
          moveY /= moveLen;
        }

        const vp = viewportRef.current;
        const cam = cameraRef.current;
        const ptr = pointerScreenRef.current;
        const aimCursorWorld = ptr
          ? {
              x: cam.x + (ptr.x - vp.width * 0.5),
              y: cam.y + (ptr.y - vp.height * 0.5),
            }
          : null;

        const manualAim =
          (!autoAimRef.current || mouseLeftDownRef.current) &&
          aimCursorWorld !== null &&
          !dpadActiveRef.current;

        const aimX = manualAim && aimCursorWorld ? aimCursorWorld.x : 0;
        const aimY = manualAim && aimCursorWorld ? aimCursorWorld.y : 0;

        const dashPressed = dashPressedRef.current;
        if (consumeDash) {
          dashPressedRef.current = false;
        }

        return {
          input: {
            moveX,
            moveY,
            aimX,
            aimY,
            manualAim,
            dashPressed,
          },
          aimCursorWorld,
          manualAim,
        };
      };

      const frame = (nowMs: number) => {
        const rawDt = (nowMs - prevFrameMs) / 1000;
        prevFrameMs = nowMs;
        const dt = Math.min(Math.max(rawDt, 0), 0.05);

        const canvas = canvasRef.current;
        const ctx = canvas ? canvas.getContext('2d') : null;
        const vp = viewportRef.current;
        const activeOnline = onlineRef.current;
        const activeLocalId = localIdRef.current;

        if (isClient) {
          const layout = clientLayoutRef.current;
          const rawSampled =
            activeOnline?.interpolatorRef?.current.sample(nowMs) ?? null;
          const sampled =
            rawSampled && rawSampled.matchId === configRef.current.matchId
              ? rawSampled
              : null;
          if (sampled) {
            lastClientSnapshotRef.current = sampled;
          }
          const activeSnap = sampled ?? lastClientSnapshotRef.current;

          let view: SurvivalRenderView | null = null;
          let localClientPlayer: SurvivalSnapshotPayload['players'][number] | undefined;

          if (activeSnap && layout) {
            view = snapshotToRenderView(
              activeSnap,
              layout,
              clientZonesScratchRef.current,
            );
            localClientPlayer =
              activeSnap.players.find((p) => p.id === activeLocalId) ??
              activeSnap.players[0];

            stepCameraToward(
              cameraRef.current,
              activeSnap.players,
              activeLocalId,
              vp.width,
              vp.height,
              dt,
              reducedMotionRef.current,
            );

            // Client SFX feedback on key state transitions (guarded by non-empty roster)
            const hasPlayers = activeSnap.players.length > 0;
            const phaseChanged = hasPlayers && activeSnap.phase !== lastPhaseRef.current;
            if (phaseChanged) {
              if (activeSnap.phase === 'levelup') {
                playThrottledSfx('client_lvl', 'levelUp', 250, nowMs);
              } else if (activeSnap.phase === 'victory') {
                playThrottledSfx('client_win', 'win', 500, nowMs);
              } else if (activeSnap.phase === 'gameover') {
                playThrottledSfx('client_lose', 'lose', 500, nowMs);
              }
            }
            if (activeSnap.bossWarningSec > 0 && !prevClientBossWarn) {
              playThrottledSfx('client_bwarn', 'bossWarn', 500, nowMs);
            }
            prevClientBossWarn = activeSnap.bossWarningSec > 0;
            if (activeSnap.activeBossId && activeSnap.activeBossId !== prevClientActiveBoss) {
              playThrottledSfx('client_bspawn', 'roundStart', 500, nowMs);
            }
            prevClientActiveBoss = activeSnap.activeBossId;
            if (activeSnap.bossesSlain > prevClientBossesSlain) {
              playThrottledSfx('client_bkill', 'allClear', 400, nowMs);
            }
            prevClientBossesSlain = activeSnap.bossesSlain;
            if (activeSnap.teamXp > prevClientTeamXp) {
              playThrottledSfx('client_xp', 'pickup', 90, nowMs);
            }
            prevClientTeamXp = activeSnap.teamXp;

            if (phaseChanged || nowMs - lastHudSentAtRef.current >= HUD_INTERVAL_MS) {
              const hud = buildClientHudSnapshot(
                activeSnap,
                configRef.current.mode,
                activeLocalId,
              );
              if (hud) {
                lastHudSentAtRef.current = nowMs;
                onHudSnapshotRef.current(hud);
              }
              if (phaseChanged) {
                lastPhaseRef.current = activeSnap.phase;
                if (activeSnap.phase === 'playing') {
                  endedNotifiedRef.current = false;
                } else if (
                  (activeSnap.phase === 'victory' || activeSnap.phase === 'gameover') &&
                  !endedNotifiedRef.current
                ) {
                  endedNotifiedRef.current = true;
                  onMatchEndRef.current(
                    buildClientMatchSummary(activeSnap, configRef.current.mode),
                  );
                }
              }
            }
          } else if (layout) {
            view = createPlaceholderClientView(configRef.current, layout);
          }

          const { input, aimCursorWorld, manualAim } = buildLocalInput(false);

          const isPlaying = !activeSnap || activeSnap.phase === 'playing';
          if (!isPlaying || pausedRef.current || inputDisabledRef.current) {
            dashPressedRef.current = false;
          } else if (activeOnline?.onSendClientInput) {
            if (
              input.dashPressed &&
              localClientPlayer &&
              !localClientPlayer.downed &&
              localClientPlayer.dashCooldownTimer <= 0
            ) {
              playThrottledSfx('client_dash', 'roll', 150, nowMs);
            }
            dashPressedRef.current = false;
            activeOnline.onSendClientInput(input);
          }

          if (ctx && view) {
            ctx.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0);
            renderSurvivalFrame(
              ctx,
              vp.width,
              vp.height,
              view,
              cameraRef.current,
              activeLocalId,
              aimCursorWorld,
              manualAim,
              nowMs,
              reducedMotionRef.current,
            );
          }
        } else {
          // Host / Offline authoritative loop
          const world = worldRef.current;
          if (world) {
            const { input, aimCursorWorld, manualAim } = buildLocalInput(
              !pausedRef.current && !inputDisabledRef.current,
            );

            if (!pausedRef.current) {
              if (activeOnline?.role === 'host' && activeOnline.getDisconnectedGuestIds) {
                const disconnected = new Set(
                  activeOnline.getDisconnectedGuestIds(Date.now()),
                );
                for (let i = 0; i < world.players.length; i += 1) {
                  const p = world.players[i];
                  if (!p.isBot && p.id !== activeLocalId) {
                    p.botTakeover = disconnected.has(p.id);
                  }
                }
              }

              const remoteInputs = activeOnline?.getRemoteInputs?.() ?? {};
              const inputs: Record<string, SurvivalInput> = {
                ...remoteInputs,
                [activeLocalId]: input,
              };

              const events = stepSurvivalWorld(world, inputs, dt);
              playSimEventsSfx(events, nowMs);

              const phaseChanged = world.phase !== lastPhaseRef.current;
              if (phaseChanged || nowMs - lastHudSentAtRef.current >= HUD_INTERVAL_MS) {
                lastHudSentAtRef.current = nowMs;
                onHudSnapshotRef.current(buildHudSnapshot(world, activeLocalId));
              }

              const snapshotIntervalMs =
                world.phase === 'playing'
                  ? SURVIVAL_SNAPSHOT_INTERVAL_MS
                  : world.phase === 'levelup'
                    ? LEVELUP_SNAPSHOT_INTERVAL_MS
                    : Infinity;
              if (
                activeOnline?.role === 'host' &&
                activeOnline.onBroadcastSnapshot &&
                (phaseChanged ||
                  nowMs - lastSnapshotSentAtRef.current >= snapshotIntervalMs)
              ) {
                lastSnapshotSentAtRef.current = nowMs;
                tickRef.current += 1;
                activeOnline.onBroadcastSnapshot(
                  packSurvivalSnapshot(world, tickRef.current),
                );
              }

              if (phaseChanged) {
                lastPhaseRef.current = world.phase;
                if (world.phase === 'playing') {
                  endedNotifiedRef.current = false;
                } else if (
                  (world.phase === 'victory' || world.phase === 'gameover') &&
                  !endedNotifiedRef.current
                ) {
                  endedNotifiedRef.current = true;
                  onMatchEndRef.current(buildMatchSummary(world));
                }
              }
            }

            stepCameraToward(
              cameraRef.current,
              world.players,
              activeLocalId,
              vp.width,
              vp.height,
              dt,
              reducedMotionRef.current,
            );

            if (ctx) {
              ctx.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0);
              renderSurvivalFrame(
                ctx,
                vp.width,
                vp.height,
                worldToRenderView(world),
                cameraRef.current,
                activeLocalId,
                aimCursorWorld,
                manualAim,
                nowMs,
                reducedMotionRef.current,
              );
            }
          }
        }

        rafId = window.requestAnimationFrame(frame);
      };

      rafId = window.requestAnimationFrame(frame);
      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }, [
      config.matchId,
      config.mapId,
      config.seed,
      emitHostStateImmediately,
      isClient,
      playSimEventsSfx,
      playThrottledSfx,
    ]);

    const handleDashTouchDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (pausedRef.current || inputDisabledRef.current) return;
      dashPressedRef.current = true;
    };

    const handleAutoAimTouchDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (pausedRef.current || inputDisabledRef.current) return;
      onAutoAimChangeRef.current(!autoAimRef.current);
    };

    return (
      <div
        ref={containerRef}
        tabIndex={-1}
        onContextMenu={(e) => e.preventDefault()}
        className="relative h-dvh w-full overflow-hidden select-none touch-none bg-slate-950 outline-none"
      >
        <canvas
          ref={canvasRef}
          onContextMenu={(e) => e.preventDefault()}
          className="block h-full w-full"
          aria-label="Khu vực chiến đấu PAWS Survival"
        />

        {showTouchControls && (
          <>
            {/* Bottom-left Tablet D-pad */}
            <TouchDpad
              enabled={!paused && !isInputDisabled}
              onChange={(vec) => {
                touchMoveRef.current = vec;
                dpadActiveRef.current = vec.x !== 0 || vec.y !== 0;
              }}
              accent="emerald"
              className="fixed bottom-5 left-5 z-20"
            />

            {/* Bottom-right Tablet Skill Cluster: Auto-Aim + Dash */}
            <div className="pointer-events-auto fixed right-5 bottom-6 z-20 flex flex-col items-end gap-2.5">
              <button
                type="button"
                onPointerDown={handleAutoAimTouchDown}
                aria-label={autoAim ? 'Tắt tự ngắm' : 'Bật tự ngắm'}
                aria-pressed={autoAim}
                className={`flex min-h-[44px] touch-none items-center gap-1.5 rounded-full border-2 px-3.5 py-2 text-[11px] font-black shadow-lg backdrop-blur-xs active:scale-95 ${
                  autoAim
                    ? 'border-emerald-300/80 bg-emerald-500/45 text-emerald-50'
                    : 'border-white/30 bg-slate-900/75 text-slate-200'
                }`}
              >
                <span>{autoAim ? 'Tự ngắm: BẬT' : 'Tự ngắm: TẮT'}</span>
              </button>

              <button
                type="button"
                onPointerDown={handleDashTouchDown}
                aria-label="Lướt nhanh (Dash)"
                className="flex h-[72px] w-[72px] touch-none items-center justify-center rounded-full border-2 border-cyan-200/80 bg-cyan-500/45 text-xs font-black tracking-wide text-white shadow-lg backdrop-blur-xs active:scale-95"
              >
                <span className="flex flex-col items-center leading-none">
                  <svg
                    viewBox="0 0 24 24"
                    className="mb-0.5 h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h11" />
                    <path d="M12 5l7 7-7 7" />
                  </svg>
                  <span>DASH</span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  },
);
