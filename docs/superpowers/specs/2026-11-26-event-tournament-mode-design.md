# PAWS Event Cup — Multiplayer Tournament Room Design Spec

**Date:** 2026-11-26  
**Status:** Draft for User Review  
**Scope:** New Event / Party Cup tournament mode uniting all 4 existing PAWS Arcade games in a single Supabase Realtime room for 2–8 human players (no bots).

---

## 1. Goals & Constraints

- **Human-only competitive room:** 2–8 real players, **zero bots** in every round.
- **All 4 existing games included:**
  1. **PAWS Cards 3D** (`cards`)
  2. **Block Blast PAWS** (`blockblast`)
  3. **Brawl Arena 3D** (`brawl`) — upgraded with Host-authoritative online multiplayer (`src/brawl/online/`)
  4. **Glass Carry** (`glassCarry`) — parallel 2-player pairs racing the course, with an automatic **Solo Auto-Balance** fallback for an odd player or disconnected teammate
- **Party Cup / Grand Prix format:** All players compete in every enabled round, earn points based on round placement, and finish on a shared Grand Podium with Cookie rewards.
- **Per-game Host time limits:** Host configures enabled games, round order (custom or shuffled), Brawl round count, and an explicit time limit (`timeLimitSec`) independently for each game.
- **Zero regression on standalone modes:** Existing solo/online modes for Cards, Block Blast, Brawl Arena, and Glass Carry remain untouched in behavior and entry flows.

---

## 2. High-Level Architecture (Unified Event Orchestrator + Embedded Game Adapters)

```text
ModeSelectScreen ("PAWS Event Cup" card) / ?eventRoom=CODE
        │
        ▼
EventRoomScreen (src/screens/EventRoomScreen.tsx)
        │
        └── useEventRoom (src/event/useEventRoom.ts)  ◄── Supabase Realtime channel `paws-event:<CODE>`
                ├── Lobby: EventLobbyScreen (presence, ready check, Host game/order/timer config)
                ├── Round Intro: EventRoundIntro (5s countdown, game rules, Glass Carry pair assignments)
                ├── Playing:
                │     ├── EventCardsAdapter       ──► OnlineGame3DScreen (embedded mode) + src/engine/
                │     ├── EventBlockBlastAdapter  ──► BlockBlastScreen (roomModeConfig + timer cap)
                │     ├── EventBrawlAdapter       ──► ArenaScene + src/brawl/online/ (20Hz Host-auth)
                │     └── EventGlassAdapter       ──► GlassScene + sub-channel per pair / Solo Auto-Balance
                ├── Round Result: EventRoundResult (round placements, points awarded, cumulative standings)
                └── Final Podium: EventFinalPodium (Top 3 podium, Cookie settlement, Play Again / Lobby)
```

### Design Boundaries

- **Single Event Room Channel (`paws-event:<CODE>`):** Keeps player presence, Host authority, round transitions, timer deadlines (`roundDeadlineMs`), and cumulative standings consistent across the entire tournament. Players enter a room code **once**.
- **Thin Game Adapters (`src/event/adapters/`):** Each adapter receives a standardized `EventAdapterProps` contract (roster, active round config, `roundDeadlineMs`, `isHost`, `myPeerId`, event channel, `onRoundComplete(rankings)`) and hides standalone lobby/result chrome.
- **Parallel Sub-channels for Glass Carry:** Only Glass Carry opens a scoped sub-channel (`paws-event:<CODE>:glass:<roundIdx>:<pairId>`) per 2-player pair so physics snapshots stay isolated between pairs while progress and finish results are reported back to `paws-event:<CODE>`.

---

## 3. Room Lifecycle & State Machine

### `EventPhase`
1. `idle`: Create room or join by 5-character room code (or URL param `?eventRoom=CODE`).
2. `lobby`: Presence list (2–8 human players), character/accessory preview, ready toggle, Host settings panel (game selection, order, shuffle, per-game time limits, Brawl rounds).
3. `roundIntro`: 5-second synchronized countdown showing current round number (`Vòng X / N`), game banner, configured time limit, and pair assignments (for Glass Carry).
4. `playing`: Renders the active Game Adapter alongside a shared top HUD (`EventTimerHud`) showing remaining round time, round index, and quick standings toggle.
5. `roundResult`: Displays round placement table, points earned (`+10`, `+7`, ...), tie-break notes, and updated cumulative leaderboard. Host clicks **"Vòng Tiếp Theo"** (with optional 10s auto-advance countdown).
6. `finalPodium`: Celebrates Top 3 players with 3D/badge podium, full tournament breakdown by round, awards Cookies via `profileStore`, and offers **"Giải Mới"** (returns everyone to `lobby` with reset scores) or **"Rời Phòng"**.

### Host Settings (`EventSettings`)

| Field | Type / Range | Default |
| :--- | :--- | :--- |
| `games` | Ordered `EventGameId[]` (min 1, max 4, unique) | `['cards', 'blockblast', 'brawl', 'glassCarry']` |
| `timeLimits` | Record<`EventGameId`, number> (seconds) | `cards`: 180s (90–300s)<br>`blockblast`: 120s (60–240s)<br>`brawl`: 90s/round (45–180s)<br>`glassCarry`: 150s (90–300s) |
| `brawlRounds` | `1 \| 2 \| 3` | `2` |
| `autoAdvanceSec` | `0 \| 10` (0 = manual Host button only) | `10` |

### Start Validation Rules
- Active connected human players: `2 <= members.length <= 8`.
- Enabled games: `settings.games.length >= 1`.
- All non-Host members have `ready === true`.
- Every `timeLimits[gameId]` is clamped within its valid min/max bounds.

---

## 4. Scoring, Tie-Breaking & Rewards (`src/event/scoring.ts`)

### Round Placement Points (Grand Prix)

| Rank | 1st | 2nd | 3rd | 4th | 5th | 6th | 7th | 8th |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **Points** | 10 | 7 | 5 | 4 | 3 | 2 | 1 | 1 |

- **Competition Ranking (1224) for ties:** If two players tie for 1st, both receive `rank = 1` and `10` points; the next player receives `rank = 3` and `5` points.
- **Cumulative Standings Tie-Breaker:**
  1. Higher `totalPoints`
  2. Higher `firstPlaceCount` (number of rank-1 finishes)
  3. Better placement in the most recent round
  4. Earlier `joinedAt` (deterministic final fallback)
- **Cookie Rewards (`profileStore.recordEventResult`):**
  - Idempotent per `eventMatchId` (prevents double-awarding on re-render).
  - Rank 1: `+80` Cookies | Rank 2: `+50` Cookies | Rank 3: `+30` Cookies | Rank 4–8 (completed): `+15` Cookies.

---

## 5. Per-Game Adapter Specifications

### 5.1 PAWS Cards 3D (`EventCardsAdapter`)
- **Setup:** Host calls `dealOnlineGame({ humans, fillToCount: humans.length, difficulty: 'medium', deckMode: 'full' })` — strictly **0 bots**.
- **Sync:** Uses event-scoped broadcast events (`cards_snapshot`, `cards_hand_sync`, `cards_action`) on `paws-event:<CODE>` with the exact sanitization logic from `src/online/sanitize.ts`.
- **Natural Finish:** A player empties their hand (`winnerId !== null`), or only 1 connected player remains.
- **Time-Limit & Ranking Order:**
  1. Winner (0 cards) → Rank 1
  2. Fewest remaining cards in hand (`hand.length` ascending)
  3. Lowest card penalty score (number cards = face value, action cards = 20, wild/special = 30)
  4. Equal hand count & penalty score → tied rank.
- **UI Adjustment:** `OnlineGame3DScreen` accepts an optional `embeddedEvent` prop to hide the standalone "Chơi lại / Về sảnh" end modal and render `EventTimerHud`.

### 5.2 Block Blast PAWS (`EventBlockBlastAdapter`)
- **Setup:** Host generates a shared 32-bit `seed` for the round and broadcasts `round_start`.
- **Sync:** Reuses `BlockBlastScreen` via `roomModeConfig` (already designed for room injection!). Players broadcast throttled progress (`score`, `linesCleared`, `alive`, `elapsedMs`) on `paws-event:<CODE>`.
- **Natural Finish:** All connected players reach Game Over.
- **Time-Limit & Ranking Order:** When `roundDeadlineMs` expires, all active boards freeze immediately and submit their final receipt. Ranking order:
  1. Highest `score`
  2. Highest `linesCleared`
  3. Longest survival time (`elapsedMs`)
  4. Equal values → tied rank.

### 5.3 Brawl Arena 3D (`EventBrawlAdapter` + `src/brawl/online/`)
- **Multiplayer Architecture (Host-Authoritative 20Hz):**
  - Mirrors `src/glass/online/` proven pattern:
    - **Clients** capture local input (`moveX`, `moveZ`, `punch`, `grab`, `headbutt`, `roll`, `seq`) and send `brawl_input` at 20Hz.
    - **Host** runs the single authoritative Rapier physics world (`ArenaScene` with `onlineRole="host"`), applies remote inputs to each human fighter (zero bots), manages arena ring collapse & item pickups, and broadcasts `brawl_snapshot` at 20Hz (fighter positions, rotations, velocities, balance, stun/freeze/alive states, collapsed rings, pickups, KO feed).
    - **Clients** render `ArenaScene` with `onlineRole="client"` using `snapshotInterpolation.ts` (buffered 60ms interpolation for smooth remote movement).
- **Round Flow:** Plays `settings.brawlRounds` sub-rounds (1–3), each bounded by `settings.timeLimits.brawl`.
- **Sub-Round Finish & Time-Limit Tie-Break:**
  - Natural end: `aliveIds.length <= 1`.
  - Time-limit end (`aliveIds.length >= 2`): Surviving fighters are ranked by highest remaining `balance`, then shortest radial distance to arena center `(0, 0)`. Eliminated fighters follow in reverse elimination order.
- **Event Round Ranking:** Sum sub-round Brawl points across all sub-rounds → rank players for Event Grand Prix points.

### 5.4 Glass Carry (`EventGlassAdapter` + Solo Auto-Balance)
- **Pair Assignment (`assignGlassPairs` in `src/event/scoring.ts`):**
  - Host deterministically shuffles connected players and groups them into pairs `[A, B]`.
  - If `players.length` is odd, the remaining 1 player is assigned a **Solo** slot (`mode: 'solo'`).
- **Pair Execution:**
  - Each 2-player pair connects to sub-channel `paws-event:<CODE>:glass:<roundIdx>:<pairId>` where player 1 acts as pair-host running `GlassScene` physics and player 2 acts as pair-client (reusing `useGlassRoom` logic in embedded mode).
  - Every 1s (and on finish/shatter), each pair-host reports `{ pairId, memberIds, progressPct, shatters, finished, elapsedSec }` to the main Event channel so everyone sees live team progress.
- **Solo Auto-Balance Mode (in `src/glass/sim/physics.ts`):**
  - When `soloAutoBalance: true`, carrier 2 is driven automatically as a virtual stabilizer: it tracks carrier 1's target offset along the forward course axis with damped spring smoothing and matches carrier 1's lift height (`p2Lift = p1Lift`), keeping glass tilt/stress responsive to obstacles (wind, hammers, ice) without requiring a second human or bot AI.
- **Natural Finish & Time-Limit Ranking:**
  - Natural end: All pairs/solos finish the 5 stages.
  - Ranking order (both members of a pair share the exact same rank & points):
    1. Finished before time limit → fastest `elapsedSec` first
    2. Did not finish before time limit → highest `progressPct` (0–100)
    3. Fewest `shatters`
    4. Equal values → tied rank.

---

## 6. Disconnect Handling & Resilience

- **Player Disconnects Mid-Round:**
  - Player stays in the tournament standings with points earned in prior rounds.
  - **Cards:** After 10s absent on their turn, Host auto-draws and skips turn to prevent deadlocks.
  - **Block Blast:** Freezes at last reported score.
  - **Brawl Arena:** Fighter receives zero input (stands idle until knocked out or round ends).
  - **Glass Carry:** If a pair teammate disconnects for >5s, the remaining player seamlessly switches to **Solo Auto-Balance** from the current checkpoint so they can still finish and score.
- **Host Disconnects:**
  - Presence deterministically elects the earliest `joinedAt` connected member as the new Host.
  - In `lobby` / `roundResult` / `finalPodium`: Seamless continuation without resetting the room.
  - In `playing`: New Host aborts the interrupted round cleanly with a clear toast banner ("Host đã rời phòng — quay về bảng điểm") and advances to `roundResult` (awarding 0 points for the aborted round) or `lobby`.
- **Supabase Not Configured:** Shows the same friendly configuration guide as `OnlineLobbyScreen` and `GlassLobby`.

---

## 7. File Organization

### New Files
- `src/event/protocol.ts` — Shared types, defaults, validation helpers, Realtime event payloads.
- `src/event/scoring.ts` — Grand Prix points, competition ranking, cumulative tie-breakers, Glass Carry pairing.
- `src/event/useEventRoom.ts` — Core Supabase Realtime Event room state machine & timer orchestration.
- `src/event/adapters/EventCardsAdapter.tsx`
- `src/event/adapters/EventBlockBlastAdapter.tsx`
- `src/event/adapters/EventBrawlAdapter.tsx`
- `src/event/adapters/EventGlassAdapter.tsx`
- `src/event/ui/EventLobbyScreen.tsx`
- `src/event/ui/EventRoundIntro.tsx`
- `src/event/ui/EventRoundResult.tsx`
- `src/event/ui/EventFinalPodium.tsx`
- `src/event/ui/EventTimerHud.tsx`
- `src/brawl/online/protocol.ts`
- `src/brawl/online/snapshotInterpolation.ts`
- `src/brawl/online/useBrawlOnlineSync.ts`
- `src/screens/EventRoomScreen.tsx`

### Targeted Edits to Existing Files
- `src/App.tsx` — Add `'event'` screen route and `?eventRoom=` query param support.
- `src/screens/ModeSelectScreen.tsx` — Add featured **PAWS Event Cup** banner/card entry.
- `src/store/profileSchema.ts` & `src/store/profileStore.ts` — Add `recordEventResult` (idempotent Cookie reward & event stats).
- `src/screens/OnlineGame3DScreen.tsx` — Add optional `embeddedEvent` mode to hide standalone end-modal/back-to-lobby actions.
- `src/screens/BlockBlastScreen.tsx` — Support optional `timeLimitMs` / forced freeze callback in `BlockBlastRoomModeConfig`.
- `src/brawl/render/ArenaScene.tsx` & `src/brawl/render/worldRuntime.ts` — Support `onlineRole: 'local' | 'host' | 'client'` hooks for remote inputs and snapshot playback.
- `src/glass/sim/physics.ts` & `src/glass/render/GlassScene.tsx` — Add `soloAutoBalance` option and live progress callback.

---

## 8. Verification & Testing Plan

1. **Unit Tests (Node test runner / existing test pattern):**
   - `src/event/__tests__/scoring.test.ts`: Grand Prix points, 1224 tie ranking, cumulative tie-breakers, odd/even Glass Carry pairing, per-game time-limit clamping.
   - `src/brawl/online/__tests__/snapshotInterpolation.test.ts`: Interpolation buffering, angle wrapping, packet drop clamping.
   - `src/glass/sim/__tests__/soloBalance.test.ts`: Solo Auto-Balance stabilizer tracks carrier 1 and preserves obstacle physics.
2. **Static & Build Verification:**
   - `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
   - `npm run build` (`tsc --noEmit && vite build`) succeeds cleanly.
3. **Regression Check:**
   - Standalone modes (`cards`, `brawl`, `blockblast`, `glassCarry`) retain all existing props/defaults unchanged.
