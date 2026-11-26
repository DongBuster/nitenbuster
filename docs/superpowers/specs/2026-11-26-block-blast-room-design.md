# Block Blast PAWS — Multiplayer Competitive Room Design Spec

**Date:** 2026-11-26
**Status:** Draft for user review
**Workspace:** `d:\Codes\LandingPageFunny\paws-game`
**Scope:** Ephemeral online competitive score rooms (`2–8` players) for Block Blast PAWS using existing Supabase Realtime infrastructure.

---

## 1. Goals & Approved Product Decisions

1. **Endless Shared-Seed Survival Race:**
   - Every player in the room plays on the exact same deterministic `seed` (`createInitialState(seed)`), guaranteeing identical starting conditions and fair smart-tray draws.
   - No countdown timer limit during gameplay: players survive as long as valid moves exist.
   - Players who reach `gameOver` early transition cleanly into **Spectator View** to watch remaining active players until all match participants finish or disconnect.
2. **Live Leaderboard + Live Spectator Board:**
   - During play, players see a compact real-time leaderboard (rank, name, animal avatar, score, Stage, streak, playing/finished status).
   - After reaching `gameOver` (or when joining a room mid-match as a late joiner), players can click any active player in the leaderboard to watch their live 8×8 board rendered with that player's active `BoardStageTheme` and send quick cheering emotes.
3. **Pure Skill Fairness & Trustless Anti-Cheat:**
   - Paid Candy Bomb rescue (`15 Cookies`) is **disabled** (`rescueEligible = false`, `bombPaidCount = 0`) so local Cookie balances never create an unfair advantage.
   - Every player gets identical rules: `1` free Tray Reroll + natural Candy Bombs spawned deterministically in the tray from the shared `seed`.
   - Upon `gameOver`, each player broadcasts their full `MatchReceipt`. Every client (and the Host) independently runs `verifyRoomSubmission(receipt, matchId, seed)` wrapping `verifyMatchReceipt` to reject forged scores, mismatched seeds, speed hacks, or paid bomb tampering.
4. **Zero Database Migrations:**
   - Uses existing `getSupabaseClient()` + Supabase Realtime Presence and Broadcast on isolated channel prefix `bb-room-${code}` (`6`-character room code from `generateRoomCode`/`normalizeRoomCode`). No SQL tables or migrations required.

---

## 2. Global Constraints

- **Tech Stack:** React 19, TypeScript 5.8, Vite 6.2, Tailwind CSS v4, `@supabase/supabase-js` `^2.119.2`, `lucide-react`. No new npm dependencies.
- **Module Imports:** Pure TypeScript engine/online modules (`src/blockblast/engine/*.ts`, `src/blockblast/online/*.ts`) MUST use explicit `.ts` extensions on relative imports so both Node native `node --test` and `tsc --noEmit && vite build` succeed without custom loaders.
- **Safety:** Never modify PAWS Cards online room code (`src/online/useOnlineRoom.ts`) or break existing Solo Block Blast gameplay (`BlockBlastScreen` solo flow remains intact).
- **Accessibility & Motion:** Semantic buttons (`<button type="button">`), visible focus rings, `aria-live="polite"` rank/match announcements, colorblind glyph support preserved inside Spectator View, and `prefers-reduced-motion` respected.

---

## 3. Architecture & File Boundaries

### 3.1 Online Protocol & Logic (`src/blockblast/online/`)

| File | Responsibility | Public Surface |
| :--- | :--- | :--- |
| `src/blockblast/online/gridCodec.ts` | Compact lossless 64-char encoding/decoding of an 8×8 `Grid` for low-bandwidth Spectator sync. | `encodeGrid(grid: Grid): string`, `decodeGrid(encoded: string): Grid` |
| `src/blockblast/online/protocol.ts` | Shared types for room phases, presence members, live player progress, verified standings, and Broadcast event payloads. | `BbRoomPhase`, `BbRoomMember`, `BbPlayerProgress`, `BbMatchStartEvent`, `BbProgressEvent`, `BbFinishEvent`, `BbEmoteEvent`, `BbReturnLobbyEvent`, `BbSyncRequestEvent`, `BbRoomSyncEvent`, `BbRoomStanding`, `BB_ROOM_EMOTES`, `BB_MAX_ROOM_PLAYERS` (`8`), `BB_DISCONNECT_GRACE_MS` (`5000`) |
| `src/blockblast/online/ranking.ts` | Pure functions for trustless receipt verification, deterministic leaderboard sorting/tie-breaking, Host failover election, and match completion detection. | `verifyRoomSubmission(receipt, expectedMatchId, expectedSeed)`, `computeRoomStandings(roster, progressByPeer, receiptsByPeer, expectedMatchId, expectedSeed)`, `electRoomHost(members)`, `isRoomMatchComplete(rosterPeerIds, progressByPeer)` |
| `src/blockblast/online/useBlockBlastRoom.ts` | React hook managing Supabase Realtime channel `bb-room-${code}`, Presence tracking, auto Host failover, countdown timer, throttled `bb_progress` publishing, `bb_finish` receipt broadcast, disconnect grace timers, and emote feed. | `useBlockBlastRoom()` returning `BlockBlastRoomController` |
| `src/blockblast/online/__tests__/room.test.ts` | Comprehensive Node unit test suite covering `gridCodec`, `ranking`, `verifyRoomSubmission`, Host election, and completion rules. | `node --test src/blockblast/online/__tests__/room.test.ts` |

### 3.2 Room UI Components (`src/blockblast/ui/`)

| File | Responsibility |
| :--- | :--- |
| `src/blockblast/ui/BlockBlastRoomLobby.tsx` | Room create/join view (`6`-char code, `?bbRoom=XXXXXX` invite link copy, display name + animal selector, 2–8 player member roster, Ready toggle, Host Start button, and Supabase-unconfigured fallback card). |
| `src/blockblast/ui/BlockBlastLiveLeaderboard.tsx` | Real-time standings list during `playing` and `spectating`. Desktop renders compact scrollable panel in the left column; Mobile renders a collapsible top summary bar (`Hạng #2/4 · Top 1: ...`) to keep the 8×8 drag area unobstructed. |
| `src/blockblast/ui/BlockBlastSpectatorView.tsx` | Full spectator workspace shown after local player finishes or on late join: selectable active player list on left, live [`BlockBoard`](file:///d:/Codes/LandingPageFunny/paws-game/src/blockblast/ui/BlockBoard.tsx) rendered with target player's decoded `Grid` & `getStageTheme(target.allClears)` on right, plus quick emote bar and floating emote toast. |
| `src/blockblast/ui/BlockBlastRoomResultModal.tsx` | Accessible end-of-round podium (Top 1–3) + full room table with verification badge (`Đã xác thực ✓` / `Không hợp lệ` / `Rời trận`), earned Cookies summary, and Host **Đấu ván mới** / **Về sảnh** / **Rời phòng** controls. |
| `src/blockblast/ui/BlockBlastRoomContainer.tsx` | Top-level coordinator wiring `useBlockBlastRoom()` to `BlockBlastRoomLobby`, `BlockBlastScreen` (in competitive room mode), `BlockBlastSpectatorView`, and `BlockBlastRoomResultModal`. |

### 3.3 Integration Edits

- **`src/screens/BlockBlastScreen.tsx`**:
  - Add optional `roomMode?: BlockBlastRoomPlayConfig` prop (carries `matchId`, `seed`, `countdownSeconds`, `leaderboardNode`, `lastEmote`, `onProgress`, `onFinish`, `onLeaveRoom`) and `onOpenRoomMode?: () => void` prop so the solo header exposes a **Phòng Đấu** button.
  - When `roomMode` is active:
    - Initialize match strictly from `roomMode.seed` and `roomMode.matchId` with `rescueEligible = false` (hide/disable paid 15-Cookie Candy Bomb button and `RescueDialog`).
    - Render synchronized `3-2-1` countdown overlay before unlocking input.
    - Emit `onProgress(...)` after every valid placement / tray bomb / reroll and `onFinish(receipt)` on `gameOver`.
    - Settle personal Cookies & personal best score via `settleBlockBlastMatch` as usual when finishing legitimately.
    - Keep `MascotStage` in `compact` mode on desktop to give vertical room to `BlockBlastLiveLeaderboard`.
- **`src/App.tsx`**:
  - Support switching cleanly between Solo `BlockBlastScreen` and `BlockBlastRoomContainer` (including reading `?bbRoom=XXXXXX` query parameter on load to jump directly to the Block Blast Room join view with the code prefilled).
- **`src/screens/ModeSelectScreen.tsx`**:
  - Update Block Blast card spec (`Phòng đấu: Solo & 2–8 người Online`).

---

## 4. Realtime Protocol & Data Flow

### 4.1 Grid Encoding (`gridCodec.ts`)
- 64 characters in row-major order (`r = 0..7`, `c = 0..7`):
  - `.` → `null` (empty cell)
  - `a` → `'amber'`, `r` → `'rose'`, `s` → `'sky'`, `e` → `'emerald'`, `v` → `'violet'`, `o` → `'orange'`
- `decodeGrid` validates `encoded.length === 64` and ignores unknown chars as `null`, returning a safe `8×8` `Grid` without ever throwing.

### 4.2 Room Lifecycle (`BbRoomPhase`)
1. **`idle`**: User chooses **Tạo Phòng** (generates 6-char code via `generateRoomCode()`) or **Vào Phòng** (`normalizeRoomCode(input)`).
2. **`lobby`**:
   - Connected to Supabase channel `bb-room-${roomCode}` with `presence.key = myPeerId`.
   - Presence payload: `{ peerId, name, animal, accessory, ready, joinedAt }`.
   - `hostId = electRoomHost(members)` (earliest `joinedAt`, deterministic tie-break by `peerId`).
   - Host can click **Bắt Đầu Đấu** when `members.length >= 2` and every non-host member has `ready === true`.
3. **`countdown`**:
   - Host broadcasts `bb_match_start`: `{ matchId, seed, roundNumber, hostId, countdownMs: 2600, rosterPeerIds }` (using relative `countdownMs` rather than wall-clock timestamps to prevent cross-device clock-skew drift).
   - All clients initialize progress entries for every peer in `rosterPeerIds` (`status: 'playing'`, `score: 0`, `stage: 1`, `allClears: 0`, empty 64-dot grid) and show a synchronized local 3-2-1 countdown over `countdownMs`, then transition to `playing`.
4. **`playing`**:
   - Each participant plays locally on `seed` with `rescueEligible = false`.
   - After each state change, client sends `bb_progress` (throttled to at most once per `200ms`, always flushing the latest state on trailing edge and immediately on `gameOver`):
     ```ts
     {
       matchId: string;
       peerId: string;
       seq: number;
       score: number;
       stage: number;
       allClears: number;
       streak: number;
       maxStreak: number;
       linesCleared: number;
       movesCount: number;
       compactGrid: string; // 64 chars
       status: 'playing' | 'finished';
     }
     ```
   - On `gameOver`, client also sends `bb_finish`: `{ matchId, peerId, receipt: MatchReceipt }` and enters **Spectator View** if any other participant in `rosterPeerIds` is still `'playing'`.
   - **Late joiners** entering `bb-room-${code}` while a match is already running receive the current snapshot via a Host `bb_sync_request` / `bb_room_sync` handshake and enter Spectator View immediately.
   - **Disconnect handling:** If a participant in `rosterPeerIds` disappears from Presence while `status === 'playing'`, start a `5000ms` grace timer; if they do not return, mark their status as `'disconnected'` so the round still completes cleanly.
5. **`results`**:
   - Triggered automatically once `isRoomMatchComplete(rosterPeerIds, progressByPeer)` becomes `true` (every participant is `'finished'` or `'disconnected'`).
   - Displays `BlockBlastRoomResultModal` with `computeRoomStandings(...)`.
   - Host can broadcast a fresh `bb_match_start` (Rematch with a new random 32-bit `seed`) or `bb_return_lobby`.

---

## 5. Verification, Anti-Cheat & Tie-Break Rules

### 5.1 Trustless Verification (`verifyRoomSubmission`)
For every received `bb_finish` receipt:
1. Must satisfy `receipt.matchId === expectedMatchId`.
2. Must satisfy `receipt.seed === expectedSeed`.
3. Must satisfy `receipt.rescueEligible === false` and `receipt.bombPaidCount === 0` (Pure Skill room rule).
4. Must pass `verifyMatchReceipt(receipt)` (replays every action deterministically from `seed`, validates `elapsedMs >= actions.length * MIN_MS_PER_ACTION`, confirms `state.phase === 'gameOver'`, and verifies `state.score === receipt.claimedScore`).
5. Resulting standing marks `verification: 'verified' | 'invalid' | 'pending' | 'disconnected'`.

### 5.2 Deterministic Leaderboard Sorting (`computeRoomStandings`)
During `playing` (live):
1. `status === 'playing'` or `status === 'finished'` with valid/pending status sorted by `score` descending (invalidated submissions dropped to bottom).
2. Tie-breakers: `allClears` desc → `maxStreak` desc → `linesCleared` desc → `joinedAt` asc.

At `results` (final):
1. Verification bucket: `'verified'` first, then `'pending'`/`'disconnected'`, then `'invalid'` last.
2. Within bucket: `verifiedScore` (or `score` if disconnected) desc → `allClears` desc → `maxStreak` desc → `linesCleared` desc → `joinedAt` asc.

---

## 6. Testing Plan

1. **Unit Tests (`src/blockblast/online/__tests__/room.test.ts`):**
   - `encodeGrid` / `decodeGrid` exact round-trip for empty board, mixed 6-color board, and resilience against malformed/short/long strings.
   - `verifyRoomSubmission` accepts valid Pure Skill `MatchReceipt`, rejects wrong `seed`, wrong `matchId`, `rescueEligible: true`, `bombPaidCount: 1`, forged `claimedScore`, and speed hacks.
   - `computeRoomStandings` verifies tie-breaking order and demotion of invalid submissions.
   - `electRoomHost` verifies deterministic failover by earliest `joinedAt` + `peerId` tie-break.
   - `isRoomMatchComplete` verifies round completes only when all `rosterPeerIds` are `'finished'` or `'disconnected'`.
2. **Full Regression & Build:**
   - Run all `*.test.ts` files via `node --test` (all existing 78 tests + new online room tests passing).
   - Run `npm run build` (`tsc --noEmit && vite build`) with zero errors.
3. **Browser Verification:**
   - Verify Desktop (`1280×800`) and Mobile (`360×780`) layouts for Block Blast Solo -> Phòng Đấu Lobby -> Create/Join Room UI and 0 console errors.
