import { useCallback, useEffect, useRef, useState } from 'react';
import { playSfx, setAudioPreferences } from '../audio/soundEngine';
import { MinecartScene } from '../coop/maps/minecart/MinecartScene';
import { RaftScene } from '../coop/maps/raft/RaftScene';
import {
  DEFAULT_COOP_MAP_ID,
  getCoopMapMeta,
  type CoopMapId,
} from '../coop/maps/registry';
import { RopeScene } from '../coop/maps/rope/RopeScene';
import { useGlassRoom } from '../glass/online/useGlassRoom';
import { GlassScene } from '../glass/render/GlassScene';
import type { GlassHudSnapshot } from '../glass/render/renderTypes';
import { GLASS_MAX_HP } from '../glass/sim/constants';
import { GLASS_COURSE } from '../glass/sim/course';
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
}

function createInitialHudSnapshot(
  mapId: CoopMapId = DEFAULT_COOP_MAP_ID,
): GlassHudSnapshot {
  const meta = getCoopMapMeta(mapId);
  const firstGlassStage = GLASS_COURSE.stages[0];
  return {
    mapId,
    matchTime: 0,
    stageNumber: 1,
    stageName:
      mapId === 'glass_carry'
        ? (firstGlassStage?.name ?? meta.title)
        : meta.title,
    checkpointIndex: 0,
    totalCheckpoints: Math.max(0, GLASS_COURSE.checkpoints.length - 1),
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
  const { settings, updateSettings, recordCoopMatchResult } = useProfileStore();
  const { leaveRoom } = room;

  const [hud, setHud] = useState<GlassHudSnapshot>(() =>
    createInitialHudSnapshot(room.selectedMap),
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

  // Reset HUD snapshot between matches or when entering countdown/lobby/idle
  useEffect(() => {
    if (
      room.phase === 'idle' ||
      room.phase === 'lobby' ||
      room.phase === 'countdown'
    ) {
      setHud(createInitialHudSnapshot(room.selectedMap));
    }
  }, [room.phase, room.matchId, room.selectedMap]);

  // Settle cookies & personal best exactly once per finished matchId
  useEffect(() => {
    if (room.phase !== 'finished' || !room.finalResult) {
      if (room.phase !== 'finished') {
        setSettlement(null);
      }
      return;
    }

    const { matchId, mapId, elapsedSec, shatters } = room.finalResult;
    if (!matchId || settledMatchIdRef.current === matchId) {
      return;
    }

    settledMatchIdRef.current = matchId;
    const res = recordCoopMatchResult({
      matchId,
      mapId: mapId ?? room.selectedMap,
      elapsedSec,
      failures: shatters,
    });
    setSettlement(res);
  }, [room.phase, room.finalResult, room.selectedMap, recordCoopMatchResult]);

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
          />
        );
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0d1b2e] select-none">
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
          room={room}
          mapId={finalMapId}
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
