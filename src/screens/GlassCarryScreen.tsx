import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playSfx, setAudioPreferences } from '../audio/soundEngine';
import { MinecartScene } from '../coop/maps/minecart/MinecartScene';
import { RaftScene } from '../coop/maps/raft/RaftScene';
import {
  DEFAULT_COOP_MAP_ID,
  buildUnlockedByPackMap,
  getCoopLevelMeta,
  getCoopMapMeta,
  getCoopMapPack,
  getDefaultMapPackId,
  type CoopLevelNumber,
  type CoopMapId,
} from '../coop/maps/registry';
import { RopeScene } from '../coop/maps/rope/RopeScene';
import { useGlassRoom } from '../glass/online/useGlassRoom';
import { GlassScene } from '../glass/render/GlassScene';
import type { GlassHudSnapshot } from '../glass/render/renderTypes';
import { GLASS_MAX_HP } from '../glass/sim/constants';
import { getGlassCourseForStage } from '../glass/sim/levels';
import { GlassHud } from '../glass/ui/GlassHud';
import { GlassLobby } from '../glass/ui/GlassLobby';
import { GlassResultModal } from '../glass/ui/GlassResultModal';
import { useProfileStore } from '../store/profileStore';

export interface GlassCarryScreenProps {
  initialRoomCode?: string;
  onBackToModeSelect: () => void;
}

interface GlassSettlementSummary {
  ok: boolean;
  reward: number;
  stars: 1 | 2 | 3;
  isNewBest: boolean;
  unlockedNextLevel: CoopLevelNumber | null;
}

function createInitialHudSnapshot(
  mapId: CoopMapId = DEFAULT_COOP_MAP_ID,
  mapPackId: string = getDefaultMapPackId(mapId),
  level: CoopLevelNumber = 1,
): GlassHudSnapshot {
  const meta = getCoopMapMeta(mapId);
  const packMeta = getCoopMapPack(mapId, mapPackId);
  const levelMeta = getCoopLevelMeta(mapId, packMeta.id, level);
  const glassCourse =
    mapId === 'glass_carry'
      ? getGlassCourseForStage(packMeta.id, levelMeta.level)
      : null;
  const firstGlassStage = glassCourse?.stages[0];
  return {
    mapId,
    matchTime: 0,
    stageNumber: 1,
    stageName:
      mapId === 'glass_carry'
        ? (firstGlassStage?.name ?? meta.title)
        : meta.title,
    totalStages: glassCourse ? glassCourse.stages.length : levelMeta.stageCount,
    level: levelMeta.level,
    mapPackTitle: packMeta.shortTitle,
    checkpointIndex: 0,
    totalCheckpoints: glassCourse
      ? Math.max(0, glassCourse.checkpoints.length - 1)
      : 4,
    shatters: 0,
    failureLabel: meta.failureLabel,
    glassHp: GLASS_MAX_HP,
    glassMaxHp: GLASS_MAX_HP,
    glassStress: 0,
    shatterTimer: 0,
    shatterReason: null,
    p1Lift: 0,
    p2Lift: 0,
    progressPct: 0,
  };
}

/**
 * Top-level screen orchestrating PAWS Duo Co-op 3D lobby, 4-map 3D co-op scenes,
 * adaptive non-blocking HUD, audio sync, and end-of-course settlement.
 */
export function GlassCarryScreen({
  initialRoomCode,
  onBackToModeSelect,
}: GlassCarryScreenProps) {
  const room = useGlassRoom();
  const { settings, coopLevelRecords, updateSettings, recordCoopMatchResult } =
    useProfileStore();
  const { leaveRoom, syncHostUnlocks } = room;

  const localUnlockedByPack = useMemo(
    () => buildUnlockedByPackMap(coopLevelRecords),
    [coopLevelRecords],
  );
  const activePackMeta = useMemo(
    () => getCoopMapPack(room.selectedMap, room.selectedMapPack),
    [room.selectedMap, room.selectedMapPack],
  );
  const activeGlassCourse = useMemo(
    () => getGlassCourseForStage(room.selectedMapPack, room.selectedLevel),
    [room.selectedMapPack, room.selectedLevel],
  );

  const [hud, setHud] = useState<GlassHudSnapshot>(() =>
    createInitialHudSnapshot(
      room.selectedMap,
      room.selectedMapPack,
      room.selectedLevel,
    ),
  );
  const [settlement, setSettlement] = useState<GlassSettlementSummary | null>(
    null,
  );
  const settledMatchIdRef = useRef<string | null>(null);
  const prevPhaseRef = useRef(room.phase);
  const leaveRoomRef = useRef(leaveRoom);
  leaveRoomRef.current = leaveRoom;

  // Sync audio preference with profile settings
  useEffect(() => {
    setAudioPreferences({ sfxEnabled: settings.sfxEnabled });
  }, [settings.sfxEnabled]);

  // Countdown & round start SFX cues
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = room.phase;

    if (room.phase === 'countdown' && room.countdownSec > 0) {
      playSfx('countdown');
    } else if (prevPhase === 'countdown' && room.phase === 'playing') {
      playSfx('roundStart');
    }
  }, [room.phase, room.countdownSec]);

  // Broadcast Host's unlocked levels to Presence whenever profile progress updates
  useEffect(() => {
    if (room.isHost) {
      syncHostUnlocks(localUnlockedByPack);
    }
  }, [localUnlockedByPack, syncHostUnlocks, room.isHost]);

  // Reset HUD snapshot between matches or when entering countdown/lobby/idle
  useEffect(() => {
    if (
      room.phase === 'idle' ||
      room.phase === 'lobby' ||
      room.phase === 'countdown'
    ) {
      setHud(
        createInitialHudSnapshot(
          room.selectedMap,
          room.selectedMapPack,
          room.selectedLevel,
        ),
      );
    }
  }, [
    room.phase,
    room.matchId,
    room.selectedMap,
    room.selectedMapPack,
    room.selectedLevel,
  ]);

  // Settle cookies & personal best exactly once per finished matchId
  useEffect(() => {
    if (room.phase !== 'finished' || !room.finalResult) {
      if (room.phase !== 'finished') {
        setSettlement(null);
      }
      return;
    }

    const { matchId, mapId, mapPackId, level, elapsedSec, shatters } =
      room.finalResult;
    if (!matchId || settledMatchIdRef.current === matchId) {
      return;
    }

    settledMatchIdRef.current = matchId;
    const res = recordCoopMatchResult({
      matchId,
      mapId: mapId ?? room.selectedMap,
      mapPackId: mapPackId ?? room.selectedMapPack,
      level: level ?? room.selectedLevel,
      elapsedSec,
      failures: shatters,
    });
    setSettlement({
      ok: res.ok,
      reward: res.reward,
      stars: res.stars,
      isNewBest: res.isNewBest,
      unlockedNextLevel: res.unlockedNextLevel,
    });
  }, [
    room.phase,
    room.finalResult,
    room.selectedMap,
    room.selectedMapPack,
    room.selectedLevel,
    recordCoopMatchResult,
  ]);

  // Clean up room connection on unmount
  useEffect(() => {
    return () => {
      leaveRoomRef.current();
    };
  }, []);

  const handleBackToModeSelect = useCallback(() => {
    leaveRoom();
    onBackToModeSelect();
  }, [leaveRoom, onBackToModeSelect]);

  const handleLeaveRoom = useCallback(() => {
    leaveRoom();
  }, [leaveRoom]);

  const handleToggleSfx = useCallback(() => {
    updateSettings({ sfxEnabled: !settings.sfxEnabled });
  }, [settings.sfxEnabled, updateSettings]);

  if (room.phase === 'idle' || room.phase === 'lobby') {
    return (
      <GlassLobby
        room={room}
        initialRoomCode={initialRoomCode}
        onBackToModeSelect={handleBackToModeSelect}
      />
    );
  }

  const scenePaused =
    room.partnerDisconnectedSec !== null || room.phase === 'countdown';
  const finalMapId = room.finalResult?.mapId ?? room.selectedMap;
  const finalMapPackId = room.finalResult?.mapPackId ?? room.selectedMapPack;
  const finalLevel = room.finalResult?.level ?? room.selectedLevel;
  const finalElapsedSec = room.finalResult?.elapsedSec ?? hud.matchTime;
  const finalShatters = room.finalResult?.shatters ?? hud.shatters;

  const renderActiveScene = () => {
    switch (room.selectedMap) {
      case 'raft_rapids':
        return (
          <RaftScene
            room={room}
            paused={scenePaused}
            onHudSnapshot={setHud}
          />
        );
      case 'rope_tether':
        return (
          <RopeScene
            room={room}
            paused={scenePaused}
            onHudSnapshot={setHud}
          />
        );
      case 'minecart_rails':
        return (
          <MinecartScene
            room={room}
            paused={scenePaused}
            onHudSnapshot={setHud}
          />
        );
      case 'glass_carry':
      default:
        return (
          <GlassScene
            room={room}
            paused={scenePaused}
            onHudSnapshot={setHud}
            course={activeGlassCourse}
            level={room.selectedLevel}
            mapPackTitle={activePackMeta.shortTitle}
          />
        );
    }
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0d1b2e] select-none">
      {renderActiveScene()}

      {room.phase !== 'finished' && (
        <GlassHud
          room={room}
          hud={hud}
          sfxEnabled={settings.sfxEnabled}
          onToggleSfx={handleToggleSfx}
          onLeaveRoom={handleLeaveRoom}
          onBackToModeSelect={handleBackToModeSelect}
        />
      )}

      {room.phase === 'finished' && room.finalResult && (
        <GlassResultModal
          key={room.finalResult.matchId}
          room={room}
          mapId={finalMapId}
          mapPackId={finalMapPackId}
          level={finalLevel}
          elapsedSec={finalElapsedSec}
          shatters={finalShatters}
          settlement={settlement}
          onBackToModeSelect={handleBackToModeSelect}
        />
      )}
    </div>
  );
}

export default GlassCarryScreen;
