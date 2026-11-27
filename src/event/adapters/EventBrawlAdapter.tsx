import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, ShieldAlert, Swords, Users } from 'lucide-react';
import { playSfx } from '../../audio/soundEngine';
import { useKeyboardMouse } from '../../brawl/input/useKeyboardMouse';
import {
  BRAWL_INPUT_STALE_MS,
  type BrawlInputPayload,
  type BrawlSnapshotPayload,
} from '../../brawl/online/protocol';
import { createBrawlInputSender } from '../../brawl/online/inputSync';
import { BrawlSnapshotInterpolator } from '../../brawl/online/snapshotInterpolation';
import { ArenaScene, type BrawlArenaOnlineConfig } from '../../brawl/render/ArenaScene';
import type { BrawlWorldRuntime } from '../../brawl/render/worldRuntime';
import type {
  FighterConfig,
  FighterInput,
  HudSnapshot,
  MatchPhase,
} from '../../brawl/sim/types';
import { BrawlSkillBar } from '../../brawl/ui/BrawlSkillBar';
import { ANIMALS } from '../../engine/types';
import {
  formatSecondsClock,
  getGrandPrixPointsForRank,
  rankEventRound,
} from '../scoring';
import type { EventAdapterProps } from './types';

interface SubRoundSyncPayload {
  subRound: number;
  phase: MatchPhase;
  countdownSec: number;
  subRoundDeadlineMs: number;
  subScores: Record<string, number>;
  banner: string | null;
}

const NEUTRAL_BRAWL_INPUT: FighterInput = {
  moveX: 0,
  moveZ: 0,
  sprint: false,
  jump: false,
  punch: false,
  headbutt: false,
  grabHeld: false,
  roll: false,
  emote: null,
};

const INITIAL_HUD: HudSnapshot = {
  aliveCount: 2,
  totalFighters: 2,
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

/**
 * Host-authoritative 20Hz online Brawl Arena 3D round adapter (0 bots).
 * Runs `round.brawlRounds` sub-rounds, each capped by `round.timeLimitSec`.
 */
export function EventBrawlAdapter({
  room,
  round,
  onStatusTextChange,
}: EventAdapterProps) {
  const {
    myPeerId,
    roster,
    isHost,
    sendGameEvent,
    subscribeGameEvent,
    submitHostRoundComplete,
  } = room;

  const [subRound, setSubRound] = useState<number>(1);
  const [phase, setPhase] = useState<MatchPhase>('countdown');
  const [countdownSec, setCountdownSec] = useState<number>(3);
  const [subRoundDeadlineMs, setSubRoundDeadlineMs] = useState<number>(0);
  const [subSecondsLeft, setSubSecondsLeft] = useState<number>(round.timeLimitSec);
  const [subScores, setSubScores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const m of roster) init[m.peerId] = 0;
    return init;
  });
  const [subBanner, setSubBanner] = useState<string | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);

  const fighters: FighterConfig[] = useMemo(() => {
    return roster.map((m, idx) => {
      const meta = ANIMALS.find((a) => a.id === m.animal) ?? ANIMALS[0];
      return {
        id: m.peerId,
        name: m.name,
        animal: m.animal,
        accessory: [...m.accessory],
        isBot: false,
        spawnIndex: idx,
        accentHex: meta.accentHex,
      };
    });
  }, [roster]);

  const roundKey = `${round.roundId}-sub-${subRound}`;
  const runtimeRef = useRef<BrawlWorldRuntime | null>(null);
  const interpolatorRef = useRef<BrawlSnapshotInterpolator>(
    new BrawlSnapshotInterpolator(),
  );
  const remoteInputsRef = useRef<
    Record<string, { input: FighterInput; seq: number; receivedAtMs: number }>
  >({});
  const inputSenderRef = useRef(createBrawlInputSender());
  const aliveIdsRef = useRef<string[]>(roster.map((m) => m.peerId));
  const eliminationOrderRef = useRef<string[][]>([]);
  const subScoresRef = useRef<Record<string, number>>(subScores);
  subScoresRef.current = subScores;
  const subRoundRef = useRef<number>(subRound);
  subRoundRef.current = subRound;
  const phaseRef = useRef<MatchPhase>(phase);
  phaseRef.current = phase;
  const countdownSecRef = useRef<number>(countdownSec);
  countdownSecRef.current = countdownSec;
  const subDeadlineRef = useRef<number>(subRoundDeadlineMs);
  subDeadlineRef.current = subRoundDeadlineMs;
  const subBannerRef = useRef<string | null>(subBanner);
  subBannerRef.current = subBanner;
  const submittedEventRef = useRef<boolean>(false);
  const subRoundEndedRef = useRef<boolean>(false);
  const roundAdvanceTimerRef = useRef<number | null>(null);

  const controlsEnabled = phase === 'fighting';
  const { consumeInput, pressedSkills, triggerSkill, setVirtualHold } =
    useKeyboardMouse(controlsEnabled);

  // Clear pending sub-round advance timeout & input timer on unmount
  useEffect(() => {
    const sender = inputSenderRef.current;
    return () => {
      sender.reset();
      if (roundAdvanceTimerRef.current !== null) {
        window.clearTimeout(roundAdvanceTimerRef.current);
        roundAdvanceTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    onStatusTextChange?.(
      `Hiệp ${subRound}/${round.brawlRounds} · ${formatSecondsClock(subSecondsLeft)}`,
    );
    return () => onStatusTextChange?.(null);
  }, [onStatusTextChange, round.brawlRounds, subRound, subSecondsLeft]);

  const broadcastSubState = useCallback(
    (payload: SubRoundSyncPayload) => {
      setSubRound(payload.subRound);
      setPhase(payload.phase);
      setCountdownSec(payload.countdownSec);
      setSubRoundDeadlineMs(payload.subRoundDeadlineMs);
      setSubScores(payload.subScores);
      setSubBanner(payload.banner);
      sendGameEvent('brawl_subround', payload);
    },
    [sendGameEvent],
  );

  // Subscribe to online messages using stable callbacks (never re-subscribes on timer ticks)
  useEffect(() => {
    const unsubInput = subscribeGameEvent('brawl_input', (raw) => {
      if (!isHost) return;
      const evt = raw as BrawlInputPayload;
      if (!evt || evt.roundKey !== roundKey || evt.peerId === myPeerId) return;
      const prev = remoteInputsRef.current[evt.peerId];
      if (prev && evt.seq <= prev.seq) return;
      remoteInputsRef.current[evt.peerId] = {
        input: evt.input,
        seq: evt.seq,
        receivedAtMs: performance.now(),
      };
    });

    const unsubSnap = subscribeGameEvent('brawl_snapshot', (raw) => {
      if (isHost) return;
      const snap = raw as BrawlSnapshotPayload;
      if (!snap || snap.roundKey !== roundKey) return;
      interpolatorRef.current.push(snap, performance.now());
    });

    const unsubSub = subscribeGameEvent('brawl_subround', (raw) => {
      if (isHost) return;
      const evt = raw as SubRoundSyncPayload;
      if (!evt || typeof evt.subRound !== 'number') return;
      if (evt.subRound !== subRoundRef.current) {
        interpolatorRef.current.reset();
        inputSenderRef.current.reset();
      }
      setSubRound(evt.subRound);
      setPhase(evt.phase);
      setCountdownSec(evt.countdownSec);
      setSubRoundDeadlineMs(evt.subRoundDeadlineMs);
      setSubScores(evt.subScores);
      setSubBanner(evt.banner);
    });

    const unsubSyncReq = subscribeGameEvent('brawl_sync_request', () => {
      if (!isHost) return;
      const payload: SubRoundSyncPayload = {
        subRound: subRoundRef.current,
        phase: phaseRef.current,
        countdownSec: countdownSecRef.current,
        subRoundDeadlineMs: subDeadlineRef.current,
        subScores: subScoresRef.current,
        banner: subBannerRef.current,
      };
      sendGameEvent('brawl_subround', payload);
    });

    // Guests explicitly request current sub-round state after subscribing
    if (!isHost) {
      sendGameEvent('brawl_sync_request', { peerId: myPeerId });
    }

    return () => {
      unsubInput();
      unsubSnap();
      unsubSub();
      unsubSyncReq();
    };
  }, [isHost, myPeerId, roundKey, sendGameEvent, subscribeGameEvent]);

  const concludeSubRoundFromHost = useCallback(
    (timedOut: boolean) => {
      if (!isHost || subRoundEndedRef.current) return;
      subRoundEndedRef.current = true;

      // Build ordered tiers from rank 1 down
      const tiers: string[][] = [];
      const aliveNow = aliveIdsRef.current;

      if (aliveNow.length > 1 && timedOut && runtimeRef.current) {
        // Tie-break survivors by highest balance -> closest to arena center
        const statsById = new Map(
          runtimeRef.current.getSurvivorTieBreakStats().map((s) => [s.id, s]),
        );
        const sortedAlive = [...aliveNow].sort((a, b) => {
          const sa = statsById.get(a);
          const sb = statsById.get(b);
          const balDiff = (sb?.balance ?? 0) - (sa?.balance ?? 0);
          if (Math.abs(balDiff) > 0.5) return balDiff;
          return (sa?.distToCenter ?? 99) - (sb?.distToCenter ?? 99);
        });
        for (const id of sortedAlive) {
          tiers.push([id]);
        }
      } else if (aliveNow.length > 0) {
        tiers.push([...aliveNow]);
      }

      for (let i = eliminationOrderRef.current.length - 1; i >= 0; i--) {
        if (eliminationOrderRef.current[i].length > 0) {
          tiers.push(eliminationOrderRef.current[i]);
        }
      }

      const nextScores: Record<string, number> = { ...subScoresRef.current };
      let cursor = 1;
      for (const tier of tiers) {
        const pts = getGrandPrixPointsForRank(cursor);
        for (const id of tier) {
          nextScores[id] = (nextScores[id] ?? 0) + pts;
        }
        cursor += tier.length;
      }

      const winnerId = tiers[0]?.[0];
      const winnerName =
        roster.find((m) => m.peerId === winnerId)?.name ?? 'Tuyển thủ';
      const banner = timedOut
        ? `Hết giờ hiệp ${subRoundRef.current}! ${winnerName} dẫn đầu!`
        : `Hiệp ${subRoundRef.current} kết thúc! ${winnerName} trụ sàn cuối cùng!`;

      broadcastSubState({
        subRound: subRoundRef.current,
        phase: 'roundOver',
        countdownSec: 0,
        subRoundDeadlineMs: 0,
        subScores: nextScores,
        banner,
      });

      if (roundAdvanceTimerRef.current !== null) {
        window.clearTimeout(roundAdvanceTimerRef.current);
      }
      roundAdvanceTimerRef.current = window.setTimeout(() => {
        roundAdvanceTimerRef.current = null;
        if (submittedEventRef.current) return;
        if (subRoundRef.current >= round.brawlRounds) {
          submittedEventRef.current = true;
          const ranked = rankEventRound(
            roster.map((m) => {
              const pts = nextScores[m.peerId] ?? 0;
              return {
                peerId: m.peerId,
                primaryScore: pts,
                metricLabel: `${pts} điểm Brawl (${round.brawlRounds} hiệp)`,
              };
            }),
          );
          submitHostRoundComplete(round.roundId, ranked);
        } else {
          const nextSub = subRoundRef.current + 1;
          aliveIdsRef.current = roster.map((m) => m.peerId);
          eliminationOrderRef.current = [];
          remoteInputsRef.current = {};
          subRoundEndedRef.current = false;
          broadcastSubState({
            subRound: nextSub,
            phase: 'countdown',
            countdownSec: 3,
            subRoundDeadlineMs: 0,
            subScores: nextScores,
            banner: null,
          });
        }
      }, 2400);
    },
    [
      broadcastSubState,
      isHost,
      roster,
      round.brawlRounds,
      round.roundId,
      submitHostRoundComplete,
    ],
  );

  // Host countdown driver (3 -> 2 -> 1 -> fighting) with stable dependencies
  useEffect(() => {
    if (!isHost || phase !== 'countdown') return;
    playSfx('countdown');
    const timer = window.setTimeout(() => {
      if (countdownSec <= 1) {
        playSfx('roundStart');
        aliveIdsRef.current = roster.map((m) => m.peerId);
        eliminationOrderRef.current = [];
        subRoundEndedRef.current = false;
        broadcastSubState({
          subRound,
          phase: 'fighting',
          countdownSec: 0,
          subRoundDeadlineMs: Date.now() + round.timeLimitSec * 1000,
          subScores: subScoresRef.current,
          banner: null,
        });
      } else {
        broadcastSubState({
          subRound,
          phase: 'countdown',
          countdownSec: countdownSec - 1,
          subRoundDeadlineMs: 0,
          subScores: subScoresRef.current,
          banner: null,
        });
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [broadcastSubState, countdownSec, isHost, phase, roster, round.timeLimitSec, subRound]);

  // Per-sub-round countdown ticker & timeout trigger
  useEffect(() => {
    const timer = window.setInterval(() => {
      const dl = subDeadlineRef.current;
      if (phaseRef.current !== 'fighting' || dl <= 0) {
        setSubSecondsLeft(round.timeLimitSec);
        return;
      }
      const remMs = dl - Date.now();
      setSubSecondsLeft(Math.max(0, Math.ceil(remMs / 1000)));
      if (remMs <= 0 && isHost && !subRoundEndedRef.current) {
        concludeSubRoundFromHost(true);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [concludeSubRoundFromHost, isHost, round.timeLimitSec]);

  const handleEliminateBatch = useCallback(
    (ids: string[]) => {
      if (!isHost || phaseRef.current !== 'fighting' || subRoundEndedRef.current) {
        return;
      }
      const unique = ids.filter((id) => aliveIdsRef.current.includes(id));
      if (unique.length === 0) return;

      eliminationOrderRef.current.push(unique);
      aliveIdsRef.current = aliveIdsRef.current.filter((id) => !unique.includes(id));

      if (aliveIdsRef.current.length <= 1) {
        concludeSubRoundFromHost(false);
      }
    },
    [concludeSubRoundFromHost, isHost],
  );

  const getRemoteInputs = useCallback((): Record<string, FighterInput> => {
    const nowMs = performance.now();
    const out: Record<string, FighterInput> = {};
    for (const m of roster) {
      if (m.peerId === myPeerId) continue;
      const rec = remoteInputsRef.current[m.peerId];
      if (!rec || nowMs - rec.receivedAtMs > BRAWL_INPUT_STALE_MS) {
        out[m.peerId] = NEUTRAL_BRAWL_INPUT;
      } else {
        out[m.peerId] = rec.input;
        // Consume one-shot impulses after reading once so buttons don't repeat infinitely
        remoteInputsRef.current[m.peerId] = {
          ...rec,
          input: {
            ...rec.input,
            jump: false,
            punch: false,
            headbutt: false,
            roll: false,
            emote: null,
          },
        };
      }
    }
    return out;
  }, [myPeerId, roster]);

  const onlineConfig: BrawlArenaOnlineConfig = useMemo(
    () => ({
      role: isHost ? 'host' : 'client',
      localFighterId: myPeerId,
      getRemoteInputs: isHost ? getRemoteInputs : undefined,
      onBroadcastSnapshot: isHost
        ? (snap) => sendGameEvent('brawl_snapshot', snap)
        : undefined,
      onSendClientInput: !isHost
        ? (input) => {
            inputSenderRef.current.send(
              roundKey,
              input,
              performance.now(),
              (seq, payloadInput, activeRoundKey) => {
                const payload: BrawlInputPayload = {
                  roundKey: activeRoundKey,
                  peerId: myPeerId,
                  seq,
                  input: payloadInput,
                };
                sendGameEvent('brawl_input', payload);
              },
            );
          }
        : undefined,
      interpolatorRef,
      runtimeRef,
    }),
    [getRemoteInputs, isHost, myPeerId, roundKey, sendGameEvent],
  );

  const sortedSubStandings = useMemo(() => {
    return [...roster].sort(
      (a, b) => (subScores[b.peerId] ?? 0) - (subScores[a.peerId] ?? 0),
    );
  }, [roster, subScores]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#14243A] select-none">
      <ArenaScene
        roundKey={roundKey}
        fighters={fighters}
        difficulty="medium"
        phase={phase}
        paused={false}
        consumeInput={consumeInput}
        onEliminateBatch={handleEliminateBatch}
        onHudSnapshot={setHud}
        onlineConfig={onlineConfig}
      />

      {/* Compact Brawl Online HUD positioned cleanly below EventTimerHud */}
      <div className="pointer-events-none fixed inset-x-0 top-14 z-20 flex items-start justify-between px-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/40 bg-[#0d1b2c]/85 px-3 py-1.5 text-xs font-black text-sky-100 backdrop-blur-md">
            <Swords className="h-3.5 w-3.5 text-sky-300" />
            <span>
              Hiệp {subRound}/{round.brawlRounds}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/35 bg-[#0d1b2c]/85 px-3 py-1.5 text-xs font-black text-emerald-200 backdrop-blur-md">
            <Users className="h-3.5 w-3.5 text-emerald-300" />
            <span>
              Còn {hud.aliveCount}/{hud.totalFighters}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-[#0d1b2c]/85 px-3 py-1.5 text-xs font-black text-amber-200 backdrop-blur-md">
            <Clock className="h-3.5 w-3.5 text-amber-300" />
            <span>Hiệp: {formatSecondsClock(subSecondsLeft)}</span>
          </div>
        </div>

        {/* Sub-round Brawl points leaderboard */}
        <div className="hidden rounded-2xl border border-white/15 bg-[#0d1b2c]/85 p-2.5 text-xs text-white backdrop-blur-md sm:block">
          <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-sky-300">
            Điểm Brawl Arena
          </div>
          <ul className="space-y-1">
            {sortedSubStandings.slice(0, 5).map((m) => (
              <li
                key={m.peerId}
                className={`flex items-center justify-between gap-4 ${
                  m.peerId === myPeerId ? 'font-black text-amber-300' : 'text-sky-100/85'
                }`}
              >
                <span className="max-w-[110px] truncate">{m.name}</span>
                <span className="font-mono font-black">{subScores[m.peerId] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Center countdown / round-over banner */}
      {phase === 'countdown' && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
          <div className="rounded-3xl border-2 border-sky-300/60 bg-[#0d1b2c]/90 px-8 py-5 text-center shadow-2xl backdrop-blur-md">
            <div className="text-xs font-black uppercase tracking-widest text-sky-300">
              BRAWL ARENA ONLINE · HIỆP {subRound}/{round.brawlRounds}
            </div>
            <div className="mt-1 font-display text-6xl font-black text-amber-300">
              {countdownSec > 0 ? countdownSec : 'CHIẾN!'}
            </div>
          </div>
        </div>
      )}

      {(subBanner || hud.bannerText) && phase !== 'countdown' && (
        <div className="pointer-events-none fixed inset-x-0 top-28 z-30 flex justify-center px-4">
          <div className="rounded-2xl border border-amber-300/50 bg-[#1a100b]/90 px-4 py-2 text-xs font-black text-amber-200 shadow-xl backdrop-blur-md">
            {subBanner ?? hud.bannerText}
          </div>
        </div>
      )}

      {/* KO Feed */}
      {hud.koFeed.length > 0 && (
        <div className="pointer-events-none fixed right-4 top-52 z-20 flex flex-col items-end gap-1">
          {hud.koFeed.map((item) => (
            <div
              key={item.id}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/40 bg-rose-950/85 px-3 py-1 text-[11px] font-black text-rose-100 shadow-lg"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-rose-300" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom skill bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-3">
        <div className="pointer-events-auto">
          <BrawlSkillBar
            hud={hud}
            controlsEnabled={controlsEnabled}
            pressedSkills={pressedSkills}
            onTriggerSkill={triggerSkill}
            onVirtualHold={setVirtualHold}
          />
        </div>
      </div>
    </div>
  );
}
