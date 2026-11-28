import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Flame,
  Layers,
  Radio,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { playSfx, setAudioPreferences } from '../../audio/soundEngine.ts';
import { AnimalAvatar } from '../../components/AnimalAvatar.tsx';
import { useProfileStore } from '../../store/profileStore.ts';
import { getStageTheme } from '../engine/stages.ts';
import { decodeGrid } from '../online/gridCodec.ts';
import { BB_ROOM_EMOTES } from '../online/protocol.ts';
import { useBlockBlastGlobalChat } from '../online/useBlockBlastGlobalChat.ts';
import type { BlockBlastRoomController } from '../online/useBlockBlastRoom.ts';
import { BlockBoard } from './BlockBoard.tsx';
import { BlockBlastChatPanel } from './BlockBlastChatPanel.tsx';
import { BlockBlastLiveLeaderboard } from './BlockBlastLiveLeaderboard.tsx';

export interface BlockBlastSpectatorViewProps {
  room: BlockBlastRoomController;
}

const FOCUS_RING_CLASS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';

/**
 * Live spectator workspace rendered after the local player reaches Game Over
 * (or joins an active room mid-round). Shows clickable standings and live 8x8 board.
 */
export function BlockBlastSpectatorView({ room }: BlockBlastSpectatorViewProps) {
  const { settings, updateSettings, selectedAnimal, equippedAvatarFrame } =
    useProfileStore();
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const noopBoardRef = useRef<HTMLDivElement | null>(null);
  const myMember = room.members.find((m) => m.peerId === room.myPeerId);
  const globalChat = useBlockBlastGlobalChat(
    {
      name: myMember?.name ?? 'Khán giả',
      animal: myMember?.animal ?? selectedAnimal,
      avatarFrame: myMember?.avatarFrame ?? equippedAvatarFrame,
    },
    room.configured,
  );

  const standings = room.standings;
  const activeCandidate = useMemo(
    () =>
      standings.find((s) => s.status === 'playing') ?? standings[0] ?? null,
    [standings],
  );

  // Auto-select top active competitor when no target is selected or target disappeared
  const targetStanding = useMemo(() => {
    if (selectedPeerId) {
      const found = standings.find((s) => s.peerId === selectedPeerId);
      if (found) return found;
    }
    return activeCandidate;
  }, [activeCandidate, selectedPeerId, standings]);

  useEffect(() => {
    if (!selectedPeerId && activeCandidate) {
      setSelectedPeerId(activeCandidate.peerId);
    }
  }, [activeCandidate, selectedPeerId]);

  const targetGrid = useMemo(
    () => decodeGrid(targetStanding?.compactGrid ?? ''),
    [targetStanding?.compactGrid],
  );
  const targetStageTheme = getStageTheme(targetStanding?.allClears ?? 0);
  const myStanding =
    standings.find((s) => s.peerId === room.myPeerId) ?? null;

  const toggleSfx = () => {
    const next = !settings.sfxEnabled;
    updateSettings({ sfxEnabled: next });
    setAudioPreferences({ sfxEnabled: next });
    if (next) playSfx('click');
  };

  const toggleColorblind = () => {
    updateSettings({ colorblindMode: !settings.colorblindMode });
    playSfx('click');
  };

  return (
    <div className="min-h-dvh bg-[#1a100b] bg-[radial-gradient(circle_at_18%_0%,_#3a2114_0%,_transparent_46%),radial-gradient(circle_at_82%_0%,_#11233a_0%,_transparent_46%),linear-gradient(180deg,_#1c110c_0%,_#120b08_100%)] text-[#FFF9F0]">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-400/30 bg-[#24150e]/95 px-3.5 py-2.5 shadow-lg sm:rounded-3xl sm:px-5 sm:py-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-950/75 px-3 py-1 text-xs font-black text-sky-200">
              <Radio aria-hidden="true" className="h-3.5 w-3.5 text-sky-400" />
              <span>Spectator · Phòng {room.roomCode}</span>
            </span>
            <span className="text-xs font-bold text-amber-200/80">
              Ván #{room.roundNumber} · Seed công bằng
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleSfx}
              aria-pressed={settings.sfxEnabled}
              aria-label={settings.sfxEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
              className={`inline-flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-xl border px-2 ${FOCUS_RING_CLASS} ${
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
              onClick={toggleColorblind}
              aria-pressed={settings.colorblindMode}
              aria-label={
                settings.colorblindMode
                  ? 'Tắt ký hiệu hỗ trợ mù màu'
                  : 'Bật ký hiệu hỗ trợ mù màu'
              }
              className={`inline-flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-xl border px-2 ${FOCUS_RING_CLASS} ${
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
                room.leaveRoom();
              }}
              className={`btn-tactile-wood inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-xl border border-rose-500/40 px-3 py-1.5 text-xs font-black text-rose-200 ${FOCUS_RING_CLASS}`}
            >
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Rời Phòng</span>
            </button>
          </div>
        </header>

        <main className="grid flex-1 grid-cols-1 items-start gap-4 lg:grid-cols-12">
          {/* Left Column: Status + Selectable Leaderboard + Quick Emotes */}
          <div className="flex flex-col gap-3 lg:col-span-5">
            <div
              role="status"
              className="rounded-2xl border border-amber-400/40 bg-[#24150e] px-4 py-3 text-xs font-bold leading-relaxed text-amber-100 shadow-lg"
            >
              {room.isParticipant && myStanding ? (
                <span>
                  Bạn đã hoàn thành với{' '}
                  <strong className="text-amber-300">
                    {myStanding.score.toLocaleString('vi-VN')} điểm
                  </strong>{' '}
                  (tạm xếp hạng #{myStanding.rank}). Chọn một người chơi bên dưới để theo dõi trực tiếp bàn cờ 8×8!
                </span>
              ) : (
                <span>
                  Đang xem với tư cách <strong>Khán giả</strong> — ván đấu đang diễn ra, bạn sẽ tham gia ngay ở ván kế tiếp!
                </span>
              )}
            </div>

            <BlockBlastLiveLeaderboard
              standings={standings}
              myPeerId={room.myPeerId}
              selectedPeerId={targetStanding?.peerId ?? null}
              onSelectPeer={(peerId) => {
                playSfx('click');
                setSelectedPeerId(peerId);
              }}
              roomCode={room.roomCode}
              roundNumber={room.roundNumber}
            />

            {/* Quick Emotes */}
            <section className="rounded-2xl border border-amber-500/25 bg-[#24150e]/95 p-3 shadow-lg">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Cổ Vũ Phòng Đấu</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {BB_ROOM_EMOTES.map((item) => (
                  <button
                    key={item.emote}
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      room.sendEmote(item.emote, item.text);
                    }}
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-xl border border-amber-700/50 bg-[#170d08] px-2.5 py-1.5 text-xs font-bold text-amber-100 hover:border-amber-400/60 ${FOCUS_RING_CLASS}`}
                  >
                    <span>{item.emote}</span>
                    <span>{item.text}</span>
                  </button>
                ))}
              </div>
            </section>

            <BlockBlastChatPanel
              mode="embedded"
              roomCode={room.roomCode}
              roomFeed={{
                configured: room.configured,
                connected: room.connectionStatus === 'connected',
                myPeerId: room.myPeerId,
                messages: room.chatMessages,
                rateLimited: room.chatRateLimited,
                onSend: room.sendChat,
              }}
              globalFeed={{
                configured: globalChat.configured,
                connected: globalChat.connected,
                myPeerId: globalChat.myPeerId,
                messages: globalChat.messages,
                rateLimited: globalChat.rateLimited,
                onSend: globalChat.sendMessage,
              }}
            />
          </div>

          {/* Right Column: Live 8x8 Board of Selected Player */}
          <section className="flex flex-col items-center gap-3 lg:col-span-7">
            {targetStanding && (
              <div className="flex w-full max-w-[492px] flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-400/35 bg-[#122236]/95 px-4 py-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <AnimalAvatar
                    animal={targetStanding.animal}
                    size="md"
                    frameId={targetStanding.avatarFrame}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-sky-300">
                        Đang xem · Hạng #{targetStanding.rank}
                      </span>
                      {targetStanding.status === 'playing' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          LIVE
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 font-display text-lg font-black text-white">
                      {targetStanding.name}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase text-sky-200/70">
                      Stage {targetStanding.stage} · {targetStageTheme.name}
                    </div>
                    <div className="font-display text-2xl font-black text-amber-300 tabular-nums">
                      {targetStanding.score.toLocaleString('vi-VN')}
                    </div>
                  </div>
                </div>

                <div className="flex w-full items-center justify-between border-t border-sky-300/15 pt-2 text-xs font-bold text-sky-100/80">
                  <span className="inline-flex items-center gap-1">
                    <Layers aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />
                    Đã xóa {targetStanding.linesCleared} dòng
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Flame aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
                    Chuỗi hiện tại: {targetStanding.streak} (Max {targetStanding.maxStreak})
                  </span>
                </div>
              </div>
            )}

            {room.lastEmote && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-full border border-amber-300/60 bg-[#2b180e]/95 px-4 py-1.5 text-xs font-black text-amber-100 shadow-lg"
              >
                <span className="text-base">{room.lastEmote.emote}</span>
                <span>
                  {room.lastEmote.name}: {room.lastEmote.text}
                </span>
              </div>
            )}

            <BlockBoard
              boardRef={noopBoardRef}
              grid={targetGrid}
              preview={null}
              bombHoverCell={null}
              bombAiming={false}
              colorblindMode={settings.colorblindMode}
              reducedMotion={settings.reducedMotion}
              bursts={[]}
              stageTheme={targetStageTheme}
            />
          </section>
        </main>
      </div>
    </div>
  );
}
