# PAWS Event Cup (Multiplayer Tournament Room) Implementation Plan

> **For agentic workers:** Execute tasks sequentially with TDD for every core logic module (`scoring`, `profileSettlement`, `soloAutoBalance`, `brawlSnapshotInterpolation`). Run `node --test`, `npm run typecheck`, and `npm run build` to verify. Never auto-commit or push to git.

**Goal:** Build the **PAWS Event Cup** tournament room mode where 2–8 real human players (zero bots) compete consecutively across all 4 existing PAWS Arcade games (PAWS Cards 3D, Block Blast PAWS, Brawl Arena 3D Online, and Glass Carry Pairs/Solo) with Host-configurable game selection, order, and per-game time limits.

**Architecture:** A single Host-authoritative Supabase Realtime channel (`paws-event:<CODE>`) managed by `useEventRoom` drives the full tournament lifecycle (`idle → lobby → roundIntro → playing → roundResult → finalPodium`). Each of the 4 games plugs in through a thin adapter under `src/event/adapters/` while keeping all standalone modes intact. Brawl Arena gains a reusable 20Hz Host-authoritative sync module (`src/brawl/online/`), and Glass Carry gains a Solo Auto-Balance stabilizer for odd player counts or disconnected teammates.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS v4, Three.js / React Three Fiber / Rapier, Supabase Realtime, Node built-in `node:test`.

**Spec:** [2026-11-26-event-tournament-mode-design.md](file:///d:/Codes/LandingPageFunny/paws-game/docs/superpowers/specs/2026-11-26-event-tournament-mode-design.md)

## Global Constraints

- **Human-only:** 2–8 real players, strictly **0 bots** in every Event round.
- **Per-game time limits:** Host configures independent time limits (`cards`: 90–300s default 180s; `blockblast`: 60–240s default 120s; `brawl`: 45–180s/round default 90s; `glassCarry`: 90–300s default 150s).
- **Grand Prix points:** `[10, 7, 5, 4, 3, 2, 1, 1]` with 1224 competition ranking for ties.
- **No new npm dependencies.**
- **Zero regression on standalone game modes** (`cards`, `brawl`, `blockblast`, `glassCarry`).
- **Safety:** Do not run `git commit`, `git push`, `git tag`, or deploy commands.

---

## File Map

### New Files
- `src/event/protocol.ts` — Types, defaults, bounds, validation, and Realtime payloads.
- `src/event/scoring.ts` — Competition ranking, Grand Prix point allocation, standings aggregation & tie-breaking, card hand tie-break scoring, Glass Carry pairing.
- `src/event/__tests__/scoring.test.ts` — Unit tests for scoring, ranking, validation, and pairing.
- `src/event/useEventRoom.ts` — Supabase Realtime Event room controller (presence, host failover, settings sync, phase transitions, round timer, standings).
- `src/event/ui/EventTimerHud.tsx` — Shared non-blocking top HUD during `playing` (countdown clock, round badge, quick standings drawer, leave button).
- `src/event/ui/EventLobbyScreen.tsx` — Create/Join room + Lobby roster, ready check, Host game/order/timer settings.
- `src/event/ui/EventRoundIntro.tsx` — Synchronized 5s round intro overlay with game art, timer badge, and Glass Carry pair preview.
- `src/event/ui/EventRoundResult.tsx` — Between-round placement & cumulative standings view.
- `src/event/ui/EventFinalPodium.tsx` — Grand Podium Top 3 celebration, per-round breakdown, and idempotent Cookie settlement.
- `src/event/adapters/types.ts` — Shared `EventAdapterProps` interface.
- `src/event/adapters/EventCardsAdapter.tsx` — Host-authoritative Cards round adapter (0 bots, time-limit ranking).
- `src/event/adapters/EventBlockBlastAdapter.tsx` — Shared-seed Block Blast round adapter with live standings & forced time-limit freeze.
- `src/event/adapters/EventBrawlAdapter.tsx` — 20Hz Host-authoritative Brawl Arena round adapter (1–3 sub-rounds, per-round timer).
- `src/event/adapters/EventGlassAdapter.tsx` — Parallel pair sub-rooms + Solo Auto-Balance round adapter.
- `src/brawl/online/protocol.ts` — Brawl online input/snapshot types and compact packer.
- `src/brawl/online/snapshotInterpolation.ts` — Buffered 20Hz snapshot interpolator with shortest-arc yaw lerp.
- `src/brawl/online/__tests__/snapshotInterpolation.test.ts` — Unit tests for Brawl snapshot interpolation and packing.
- `src/glass/sim/__tests__/soloBalance.test.ts` — Unit tests for Glass Carry Solo Auto-Balance stabilizer.
- `src/store/__tests__/eventSettlement.test.ts` — Unit tests for `settleEventMatch` idempotency and rewards.
- `src/screens/EventRoomScreen.tsx` — Top-level Event mode screen connecting `useEventRoom` to UI and adapters.

### Modified Files
- `src/store/profileSchema.ts` & `src/store/profileStore.ts` — Add `settleEventMatch` & `recordEventResult`.
- `src/glass/sim/physics.ts` — Add `computeSoloStabilizerInput` and optional `soloAutoBalance` support.
- `src/glass/render/GlassScene.tsx` — Support optional `soloAutoBalance` prop and `onProgressReport` callback.
- `src/brawl/render/worldRuntime.ts` — Support `localFighterId`, `remoteInputs`, `exportSnapshot`, `applySnapshot`, and `getRoundStandings`.
- `src/brawl/render/FighterActor.tsx` — Support `isRemoteClient` kinematic/visual positioning driven from `runtime.fighters`.
- `src/brawl/render/ArenaScene.tsx` — Support optional `onlineConfig` (`local` | `host` | `client`) without changing local default behavior.
- `src/screens/OnlineGame3DScreen.tsx` — Add optional `embeddedEvent` prop to hide standalone result modal & lobby header buttons.
- `src/screens/BlockBlastScreen.tsx` — Support optional `forceFinishToken` in `BlockBlastRoomModeConfig` to freeze board cleanly on Event timeout.
- `src/App.tsx` — Add `'event'` screen + `?eventRoom=` query param routing.
- `src/screens/ModeSelectScreen.tsx` — Add featured **PAWS Event Cup** mode banner/card.

---

### Task 1: Event Protocol & Scoring Engine (TDD)

**Files:**
- Create: `src/event/protocol.ts`
- Create: `src/event/scoring.ts`
- Test: `src/event/__tests__/scoring.test.ts`

**Interfaces:**
- Produces: `EventGameId`, `EventPhase`, `EventSettings`, `EventMember`, `EventRoundPlayerResult`, `EventRoundSummary`, `EventStanding`, `GlassPairAssignment`, `EVENT_GAME_META`, `DEFAULT_EVENT_SETTINGS`, `EVENT_TIME_LIMIT_BOUNDS`, `sanitizeEventSettings`, `rankEventRound`, `applyRoundToStandings`, `assignGlassPairs`, `scoreCardsHandPenalty`, `getEventCookieReward`.

- [ ] **Step 1:** Write failing tests in `src/event/__tests__/scoring.test.ts` covering:
  - `sanitizeEventSettings` clamps per-game time limits, deduplicates games, falls back when empty.
  - `rankEventRound` assigns `[10, 7, 5, 4, 3, 2, 1, 1]` and applies 1224 competition ranking on ties.
  - `applyRoundToStandings` aggregates multi-round points and breaks ties by `totalPoints` → `firstPlaces` → latest round rank → `joinedAt`.
  - `assignGlassPairs` pairs even rosters into 2-player pairs and assigns exactly 1 solo slot for odd rosters (3, 5, 7 players).
  - `scoreCardsHandPenalty` ranks winner first, then fewest cards, then lowest penalty score.
- [ ] **Step 2:** Run `node --test src/event/__tests__/scoring.test.ts` to verify failure.
- [ ] **Step 3:** Implement `src/event/protocol.ts` and `src/event/scoring.ts`.
- [ ] **Step 4:** Re-run `node --test src/event/__tests__/scoring.test.ts` to verify PASS.

---

### Task 2: Profile Store Event Cookie Settlement (TDD)

**Files:**
- Modify: `src/store/profileSchema.ts`
- Modify: `src/store/profileStore.ts`
- Test: `src/store/__tests__/eventSettlement.test.ts`

**Interfaces:**
- Produces: `EventSettlementResult`, `settleEventMatch(profile, { matchId, rank, totalPlayers })`, `useProfileStore().recordEventResult`.

- [ ] **Step 1:** Write failing test in `src/store/__tests__/eventSettlement.test.ts` verifying rewards (`+80 / +50 / +30 / +15`), `gamesWon` increment only for rank 1, and idempotency via `settledMatchIds`.
- [ ] **Step 2:** Run `node --test src/store/__tests__/eventSettlement.test.ts` to verify failure.
- [ ] **Step 3:** Implement `settleEventMatch` in `src/store/profileSchema.ts` and expose `recordEventResult` in `src/store/profileStore.ts`.
- [ ] **Step 4:** Run `node --test src/store/__tests__/eventSettlement.test.ts` to verify PASS.

---

### Task 3: Glass Carry Solo Auto-Balance Physics & Scene Hooks (TDD)

**Files:**
- Modify: `src/glass/sim/physics.ts`
- Modify: `src/glass/render/GlassScene.tsx`
- Test: `src/glass/sim/__tests__/soloBalance.test.ts`

**Interfaces:**
- Produces: `computeSoloStabilizerInput(state: GlassSimState, p1Input: PlayerInput): PlayerInput` exported from `src/glass/sim/physics.ts`; optional `soloAutoBalance?: boolean` prop on `GlassSceneProps`.

- [ ] **Step 1:** Write failing test in `src/glass/sim/__tests__/soloBalance.test.ts` verifying:
  - When P1 moves forward along `+Z`, `computeSoloStabilizerInput` steers P2 to track P1's X/Z with safe carry spacing (`~3.1` units across X) and mirrors lift/jump cleanly so the glass does not shatter from stretch/tilt during straight travel.
  - Obstacles and falls still shatter the glass normally in solo mode.
- [ ] **Step 2:** Run `node --test src/glass/sim/__tests__/soloBalance.test.ts` to verify failure.
- [ ] **Step 3:** Implement `computeSoloStabilizerInput` in `src/glass/sim/physics.ts` and wire optional `soloAutoBalance` in `src/glass/render/GlassScene.tsx`.
- [ ] **Step 4:** Run `node --test src/glass/sim/__tests__/soloBalance.test.ts src/glass/sim/__tests__/physics.test.ts` to verify PASS.

---

### Task 4: Brawl Arena Online Protocol, Interpolation & Scene Sync (TDD)

**Files:**
- Create: `src/brawl/online/protocol.ts`
- Create: `src/brawl/online/snapshotInterpolation.ts`
- Test: `src/brawl/online/__tests__/snapshotInterpolation.test.ts`
- Modify: `src/brawl/render/worldRuntime.ts`
- Modify: `src/brawl/render/FighterActor.tsx`
- Modify: `src/brawl/render/ArenaScene.tsx`

**Interfaces:**
- Produces: `BrawlInputPayload`, `BrawlSnapshotPayload`, `BrawlFighterSnapshot`, `BrawlSnapshotInterpolator`, `BrawlArenaOnlineConfig` on `ArenaSceneProps`.

- [ ] **Step 1:** Write failing test in `src/brawl/online/__tests__/snapshotInterpolation.test.ts` covering midpoint fighter position interpolation, shortest-arc yaw wrapping, discrete status fields, out-of-order tick drop, and reset.
- [ ] **Step 2:** Run `node --test src/brawl/online/__tests__/snapshotInterpolation.test.ts` to verify failure.
- [ ] **Step 3:** Implement `src/brawl/online/protocol.ts` and `src/brawl/online/snapshotInterpolation.ts`.
- [ ] **Step 4:** Run `node --test src/brawl/online/__tests__/snapshotInterpolation.test.ts` to verify PASS.
- [ ] **Step 5:** Extend `worldRuntime.ts`, `FighterActor.tsx`, and `ArenaScene.tsx` to support `onlineConfig` (`host` runs Rapier + reads remote inputs + emits 20Hz snapshot; `client` renders kinematic interpolated snapshots; `local` unchanged).

---

### Task 5: Core Event Room Controller (`useEventRoom`)

**Files:**
- Create: `src/event/useEventRoom.ts`

**Interfaces:**
- Produces: `useEventRoom()`, `EventRoomController` with `createRoom`, `joinRoom`, `leaveRoom`, `updateMyProfile`, `updateSettings`, `startEvent`, `advanceToNextRound`, `resetEventToLobby`, `submitHostRoundComplete`, `sendChannelBroadcast`, `subscribeChannelBroadcast`, `members`, `standings`, `roundHistory`, `currentRound`, `roundSecondsLeft`, `introSecondsLeft`, `phase`, `isHost`, `myPeerId`.

- [ ] **Step 1:** Implement `src/event/useEventRoom.ts` managing Supabase Realtime channel `paws-event:<CODE>`, presence tracking, deterministic Host election, late-joiner state sync, `roundIntro` 5s countdown, authoritative `roundDeadlineMs`, Host-disconnect recovery, and channel broadcast multiplexer for adapters.
- [ ] **Step 2:** Run `npm run typecheck` to verify clean compilation.

---

### Task 6: Event UI Screens

**Files:**
- Create: `src/event/ui/EventTimerHud.tsx`
- Create: `src/event/ui/EventLobbyScreen.tsx`
- Create: `src/event/ui/EventRoundIntro.tsx`
- Create: `src/event/ui/EventRoundResult.tsx`
- Create: `src/event/ui/EventFinalPodium.tsx`

- [ ] **Step 1:** Build `EventTimerHud` (floating compact HUD with round badge, game name, live countdown with urgency color under 15s, expandable live standings drawer, leave room confirmation).
- [ ] **Step 2:** Build `EventLobbyScreen` (idle create/join + room lobby with 2–8 human roster, copy invite link `?eventRoom=CODE`, ready button, and Host settings panel: toggle each of 4 games, move up/down, shuffle order, per-game time limit controls, Brawl round count, auto-advance toggle).
- [ ] **Step 3:** Build `EventRoundIntro`, `EventRoundResult`, and `EventFinalPodium` (matching Winter Cabin Arcade aesthetic, semantic accessible controls, Cookie reward display).
- [ ] **Step 4:** Run `npm run typecheck`.

---

### Task 7: Embedded Mode Hooks & 4 Game Adapters

**Files:**
- Modify: `src/screens/OnlineGame3DScreen.tsx`
- Modify: `src/screens/BlockBlastScreen.tsx`
- Create: `src/event/adapters/types.ts`
- Create: `src/event/adapters/EventCardsAdapter.tsx`
- Create: `src/event/adapters/EventBlockBlastAdapter.tsx`
- Create: `src/event/adapters/EventBrawlAdapter.tsx`
- Create: `src/event/adapters/EventGlassAdapter.tsx`

- [ ] **Step 1:** Add optional `embeddedEvent?: boolean` prop to `OnlineGame3DScreen.tsx` (skips standalone cookie settlement, hides standalone `ResultModal` and top-left Leave button when embedded).
- [ ] **Step 2:** Add optional `forceFinishToken?: number` to `BlockBlastRoomModeConfig` in `BlockBlastScreen.tsx` (freezes board and calls `onFinish` cleanly when Event timer expires, without recording standalone cookies when `suppressStandaloneSettlement` is set).
- [ ] **Step 3:** Implement all 4 adapters under `src/event/adapters/` following the exact tie-break and timeout rules from Section 5 of the spec.
- [ ] **Step 4:** Run `npm run typecheck`.

---

### Task 8: EventRoomScreen, App Routing, ModeSelectScreen & Full Verification

**Files:**
- Create: `src/screens/EventRoomScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `src/screens/ModeSelectScreen.tsx`

- [ ] **Step 1:** Implement `src/screens/EventRoomScreen.tsx` wiring `useEventRoom`, `EventLobbyScreen`, `EventRoundIntro`, all 4 adapters + `EventTimerHud`, `EventRoundResult`, and `EventFinalPodium`.
- [ ] **Step 2:** Add lazy-loaded `'event'` screen and `?eventRoom=` deep-link handling in `src/App.tsx`.
- [ ] **Step 3:** Add featured **PAWS Event Cup** banner/entry card on `src/screens/ModeSelectScreen.tsx`.
- [ ] **Step 4:** Run full verification:
  - All unit tests (`node --test src/event/__tests__/scoring.test.ts src/store/__tests__/eventSettlement.test.ts src/glass/sim/__tests__/soloBalance.test.ts src/brawl/online/__tests__/snapshotInterpolation.test.ts` + existing test suites)
  - `npm run typecheck`
  - `npm run build`
