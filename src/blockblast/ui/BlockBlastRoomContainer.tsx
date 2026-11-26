import { useCallback, useEffect, useMemo, useState } from 'react';
import BlockBlastScreen, {
  type BlockBlastRoomModeConfig,
} from '../../screens/BlockBlastScreen.tsx';
import type { BlastGameState } from '../engine/types.ts';
import type { MatchReceipt } from '../engine/verify.ts';
import { useBlockBlastRoom } from '../online/useBlockBlastRoom.ts';
import { BlockBlastLiveLeaderboard } from './BlockBlastLiveLeaderboard.tsx';
import { BlockBlastRoomLobby } from './BlockBlastRoomLobby.tsx';
import { BlockBlastRoomResultModal } from './BlockBlastRoomResultModal.tsx';
import { BlockBlastSpectatorView } from './BlockBlastSpectatorView.tsx';

export interface BlockBlastRoomContainerProps {
  initialRoomCode?: string;
  onSwitchToSolo: () => void;
  onBackToModeSelect: () => void;
}

interface RoomSettlementSummary {
  reward: number;
  isNewBest: boolean;
  valid: boolean;
}

/**
 * Coordinates Block Blast PAWS competitive room lifecycle across Lobby,
 * synchronized Countdown + Shared-Seed Play, Live Spectator View, and Results.
 */
export function BlockBlastRoomContainer({
  initialRoomCode = '',
  onSwitchToSolo,
  onBackToModeSelect,
}: BlockBlastRoomContainerProps) {
  const room = useBlockBlastRoom();
  const [lastSettlement, setLastSettlement] =
    useState<RoomSettlementSummary | null>(null);

  useEffect(() => {
    setLastSettlement(null);
  }, [room.matchId]);

  const handleProgress = useCallback(
    (state: BlastGameState) => {
      room.publishProgress(state);
    },
    [room.publishProgress],
  );

  const handleFinish = useCallback(
    (
      receipt: MatchReceipt,
      finalState: BlastGameState,
      settlement: RoomSettlementSummary,
    ) => {
      setLastSettlement(settlement);
      room.publishFinish(receipt, finalState);
    },
    [room.publishFinish],
  );

  const leaderboardDesktop = useMemo(
    () => (
      <BlockBlastLiveLeaderboard
        standings={room.standings}
        myPeerId={room.myPeerId}
        roomCode={room.roomCode}
        roundNumber={room.roundNumber}
      />
    ),
    [room.myPeerId, room.roomCode, room.roundNumber, room.standings],
  );

  const leaderboardMobile = useMemo(
    () => (
      <BlockBlastLiveLeaderboard
        standings={room.standings}
        myPeerId={room.myPeerId}
        compactMobile={true}
        roomCode={room.roomCode}
        roundNumber={room.roundNumber}
      />
    ),
    [room.myPeerId, room.roomCode, room.roundNumber, room.standings],
  );

  const roomModeConfig: BlockBlastRoomModeConfig = useMemo(
    () => ({
      roomCode: room.roomCode,
      matchId: room.matchId,
      seed: room.seed,
      roundNumber: room.roundNumber,
      isCountingDown: room.phase === 'countdown',
      countdownSeconds: room.countdownSeconds,
      leaderboardDesktop,
      leaderboardMobile,
      lastEmote: room.lastEmote,
      onProgress: handleProgress,
      onFinish: handleFinish,
      onLeaveRoom: room.leaveRoom,
    }),
    [
      handleFinish,
      handleProgress,
      leaderboardDesktop,
      leaderboardMobile,
      room.countdownSeconds,
      room.lastEmote,
      room.leaveRoom,
      room.matchId,
      room.phase,
      room.roomCode,
      room.roundNumber,
      room.seed,
    ],
  );

  if (room.phase === 'idle' || room.phase === 'lobby') {
    return (
      <BlockBlastRoomLobby
        room={room}
        initialRoomCode={initialRoomCode}
        onSwitchToSolo={onSwitchToSolo}
        onBackToModeSelect={onBackToModeSelect}
      />
    );
  }

  if (room.phase === 'results') {
    return (
      <>
        <BlockBlastSpectatorView room={room} />
        <BlockBlastRoomResultModal
          open={true}
          roomCode={room.roomCode}
          roundNumber={room.roundNumber}
          standings={room.standings}
          myPeerId={room.myPeerId}
          isHost={room.isHost}
          canRematch={room.canStartMatch}
          settlement={lastSettlement}
          onRematch={room.startMatch}
          onReturnLobby={room.returnToLobby}
          onLeaveRoom={room.leaveRoom}
        />
      </>
    );
  }

  if (!room.isParticipant || room.myFinished) {
    return <BlockBlastSpectatorView room={room} />;
  }

  return (
    <BlockBlastScreen
      key={room.matchId}
      onBackToModeSelect={onBackToModeSelect}
      roomMode={roomModeConfig}
    />
  );
}

export default BlockBlastRoomContainer;
