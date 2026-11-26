import { useCallback, useEffect, useRef, useState } from 'react';
import { playSfx, setAudioPreferences } from '../audio/soundEngine';
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

function createInitialHudSnapshot(): GlassHudSnapshot {
  const firstStage = GLASS_COURSE.stages[0];
  return {
    matchTime: 0,
    stageNumber: firstStage?.number ?? 1,
    stageName: firstStage?.name ?? 'Cổng Gỗ Khởi Động',
    checkpointIndex: 0,
    totalCheckpoints: Math.max(0, GLASS_COURSE.checkpoints.length - 1),
    shatters: 0,
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
 * Top-level screen orchestrating Glass Carry Co-op lobby, 3D co-op scene,
 * non-blocking HUD, audio sync, and end-of-course settlement.
 */
export function GlassCarryScreen({
  initialRoomCode,
  onBackToModeSelect,
}: GlassCarryScreenProps) {
  const room = useGlassRoom();
  const { settings, updateSettings, recordGlassMatchResult } = useProfileStore();

  const [hud, setHud] = useState<GlassHudSnapshot>(() =>
    createInitialHudSnapshot(),
  );
  const [settlement, setSettlement] = useState<GlassSettlementSummary | null>(
    null,
  );
  const settledMatchIdRef = useRef<string | null>(null);
  const prevPhaseRef = useRef(room.phase);
  const leaveRoomRef = useRef(room.leaveRoom);
  leaveRoomRef.current = room.leaveRoom;

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

  // Reset HUD snapshot between matches or when returning to lobby/idle
  useEffect(() => {
    if (room.phase === 'idle' || room.phase === 'lobby') {
      setHud(createInitialHudSnapshot());
    }
  }, [room.phase, room.matchId]);

  // Settle cookies & personal best exactly once per finished matchId
  useEffect(() => {
    if (room.phase !== 'finished' || !room.finalResult) {
      if (room.phase !== 'finished') {
        setSettlement(null);
      }
      return;
    }

    const { matchId, elapsedSec, shatters } = room.finalResult;
    if (!matchId || settledMatchIdRef.current === matchId) {
      return;
    }

    settledMatchIdRef.current = matchId;
    const res = recordGlassMatchResult({
      matchId,
      elapsedSec,
      shatters,
    });
    setSettlement(res);
  }, [room.phase, room.finalResult, recordGlassMatchResult]);

  // Clean up room connection on unmount
  useEffect(() => {
    return () => {
      leaveRoomRef.current();
    };
  }, []);

  const handleBackToModeSelect = useCallback(() => {
    room.leaveRoom();
    onBackToModeSelect();
  }, [onBackToModeSelect, room]);

  const handleLeaveRoom = useCallback(() => {
    room.leaveRoom();
  }, [room]);

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
  const finalElapsedSec = room.finalResult?.elapsedSec ?? hud.matchTime;
  const finalShatters = room.finalResult?.shatters ?? hud.shatters;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0d1b2e] select-none">
      <GlassScene
        room={room}
        paused={scenePaused}
        onHudSnapshot={setHud}
      />

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
