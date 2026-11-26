import { useEffect, useState } from 'react';
import { AlertTriangle, Eye, LogOut, Trophy, X } from 'lucide-react';
import { setAudioPreferences } from '../audio/soundEngine';
import { ANIMALS } from '../engine/types';
import { EVENT_GAME_META } from '../event/protocol';
import { formatSecondsClock } from '../event/scoring';
import { EventBlockBlastAdapter } from '../event/adapters/EventBlockBlastAdapter';
import { EventBrawlAdapter } from '../event/adapters/EventBrawlAdapter';
import { EventCardsAdapter } from '../event/adapters/EventCardsAdapter';
import { EventGlassAdapter } from '../event/adapters/EventGlassAdapter';
import { EventFinalPodium } from '../event/ui/EventFinalPodium';
import { EventLobbyScreen } from '../event/ui/EventLobbyScreen';
import { EventRoundIntro } from '../event/ui/EventRoundIntro';
import { EventRoundResult } from '../event/ui/EventRoundResult';
import { EventTimerHud } from '../event/ui/EventTimerHud';
import { useEventRoom } from '../event/useEventRoom';
import { useProfileStore } from '../store/profileStore';

export interface EventRoomScreenProps {
  initialRoomCode?: string;
  onBackToModeSelect: () => void;
}

/**
 * Top-level screen orchestrating PAWS Event Cup tournament rooms across
 * Lobby, Round Intro, all 4 embedded Game Adapters, Round Results, and Final Podium.
 */
export function EventRoomScreen({
  initialRoomCode = '',
  onBackToModeSelect,
}: EventRoomScreenProps) {
  const room = useEventRoom();
  const { settings } = useProfileStore();
  const [adapterStatusText, setAdapterStatusText] = useState<string | null>(null);

  useEffect(() => {
    setAudioPreferences({ sfxEnabled: settings.sfxEnabled });
  }, [settings.sfxEnabled]);

  useEffect(() => {
    setAdapterStatusText(null);
  }, [room.currentRound?.roundId, room.phase]);

  const noticeToast = room.notice ? (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-amber-400/50 bg-[#27150d]/95 px-4 py-2.5 text-xs font-bold text-amber-100 shadow-2xl backdrop-blur-md">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
      <span>{room.notice}</span>
      <button
        type="button"
        onClick={room.clearNotice}
        aria-label="Đóng thông báo"
        className="ml-1 cursor-pointer rounded-lg p-1 text-amber-200/70 hover:bg-white/10 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  ) : null;

  if (room.phase === 'idle' || room.phase === 'lobby') {
    return (
      <>
        <EventLobbyScreen
          room={room}
          initialRoomCode={initialRoomCode}
          onBackToModeSelect={onBackToModeSelect}
        />
        {noticeToast}
      </>
    );
  }

  const isInRoster = room.roster.some((m) => m.peerId === room.myPeerId);

  if (
    (room.phase === 'playing' || room.phase === 'roundIntro') &&
    room.currentRound &&
    !isInRoster
  ) {
    const meta = EVENT_GAME_META[room.currentRound.gameId];
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#160d09] p-4 text-[#FFF9F0]">
        <div className="w-full max-w-lg rounded-3xl border border-amber-400/35 bg-[#24140d]/95 p-6 shadow-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1 text-xs font-black text-sky-200">
            <Eye className="h-3.5 w-3.5" />
            <span>CHẾ ĐỘ KHÁN GIẢ · PHÒNG ĐANG THI ĐẤU</span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-black text-white">
            Vòng {room.currentRound.roundIndex + 1}/{room.currentRound.totalRounds}: {meta.title}
          </h1>
          <p className="mt-1 text-xs text-amber-100/80">
            Giải đấu đã bắt đầu (hoặc đủ 8 tuyển thủ). Bạn đang theo dõi bảng điểm trực tiếp và có thể tham gia ngay ở giải kế tiếp.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-black text-amber-300">
            <span>Còn lại: {formatSecondsClock(room.roundSecondsLeft)}</span>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-300">
              <Trophy className="h-3.5 w-3.5" />
              <span>Bảng Điểm Tổng Hiện Tại</span>
            </div>
            {room.standings.map((s, idx) => {
              const animalMeta =
                ANIMALS.find((a) => a.id === s.animal) ?? ANIMALS[0];
              return (
                <div
                  key={s.peerId}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-black text-amber-300">#{idx + 1}</span>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: animalMeta.accentHex }}
                    />
                    <span>{s.name}</span>
                  </div>
                  <span className="font-black text-amber-300">{s.totalPoints} đ</span>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={room.leaveRoom}
            className="btn-tactile-wood mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-xs font-black text-amber-100"
          >
            <LogOut className="h-4 w-4" />
            <span>Rời Phòng Event</span>
          </button>
        </div>
        {noticeToast}
      </div>
    );
  }

  if (room.phase === 'roundIntro' && room.currentRound) {
    return (
      <>
        <EventRoundIntro
          round={room.currentRound}
          roster={room.roster}
          myPeerId={room.myPeerId}
          secondsLeft={room.introSecondsLeft}
        />
        {noticeToast}
      </>
    );
  }

  if (room.phase === 'playing' && room.currentRound) {
    const round = room.currentRound;
    return (
      <div className="relative min-h-screen">
        <EventTimerHud
          round={round}
          secondsLeft={room.roundSecondsLeft}
          standings={room.standings}
          myPeerId={room.myPeerId}
          extraStatusText={adapterStatusText}
          onLeaveEvent={room.leaveRoom}
        />

        {round.gameId === 'cards' && (
          <EventCardsAdapter
            key={round.roundId}
            room={room}
            round={round}
            onStatusTextChange={setAdapterStatusText}
          />
        )}

        {round.gameId === 'blockblast' && (
          <EventBlockBlastAdapter
            key={round.roundId}
            room={room}
            round={round}
            onStatusTextChange={setAdapterStatusText}
          />
        )}

        {round.gameId === 'brawl' && (
          <EventBrawlAdapter
            key={round.roundId}
            room={room}
            round={round}
            onStatusTextChange={setAdapterStatusText}
          />
        )}

        {round.gameId === 'glassCarry' && (
          <EventGlassAdapter
            key={round.roundId}
            room={room}
            round={round}
            onStatusTextChange={setAdapterStatusText}
          />
        )}

        {noticeToast}
      </div>
    );
  }

  if (room.phase === 'roundResult' && room.currentRound) {
    const latestSummary =
      room.roundHistory[room.roundHistory.length - 1] ?? {
        roundIndex: room.currentRound.roundIndex,
        gameId: room.currentRound.gameId,
        results: [],
      };
    return (
      <>
        <EventRoundResult
          round={room.currentRound}
          summary={latestSummary}
          roster={room.roster}
          standings={room.standings}
          myPeerId={room.myPeerId}
          isHost={room.isHost}
          autoAdvanceSecondsLeft={room.resultAdvanceSecondsLeft}
          onAdvanceNext={room.advanceToNextRound}
        />
        {noticeToast}
      </>
    );
  }

  if (room.phase === 'finalPodium') {
    return (
      <>
        <EventFinalPodium
          eventMatchId={room.eventMatchId}
          standings={room.standings}
          roundHistory={room.roundHistory}
          myPeerId={room.myPeerId}
          isHost={room.isHost}
          onPlayAgain={room.resetEventToLobby}
          onLeaveEvent={room.leaveRoom}
        />
        {noticeToast}
      </>
    );
  }

  return (
    <EventLobbyScreen
      room={room}
      initialRoomCode={initialRoomCode}
      onBackToModeSelect={onBackToModeSelect}
    />
  );
}

export default EventRoomScreen;
