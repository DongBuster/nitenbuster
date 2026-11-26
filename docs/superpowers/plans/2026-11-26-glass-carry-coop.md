# Glass Carry Co-op Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **SAFETY RULE:** Never run `git commit`, `git push`, `git tag`, or deploy commands unless the user explicitly asks in the current session.

**Goal:** Build **Glass Carry Co-op**, a 2-player online co-op 3D obstacle-course minigame in PAWS Arcade 3D where two plush animal characters carry a fragile glass pane across 5 connected stages with checkpoints over Supabase Realtime.

**Architecture:** Pure TypeScript 60Hz custom 3D kinematics + spring-rod glass constraint simulation (`src/glass/sim/`) running host-authoritatively on `P1`, synchronized over Supabase Realtime Broadcast at 15Hz with a 75ms interpolation buffer on `P2` (`src/glass/online/`), rendered in React Three Fiber reusing `Character3D` and `PartyMotionState` (`src/glass/render/`), and wired into `App.tsx`, `ModeSelectScreen.tsx`, `profileStore.ts`, and `soundEngine.ts`.

**Tech Stack:** React 19, TypeScript 5.8 (`strict: true`, `allowImportingTsExtensions: true`), Vite 6, Tailwind CSS v4, Three.js / `@react-three/fiber` v9 / `@react-three/drei` v10, `@supabase/supabase-js` v2, Node v24 built-in `node --test --experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-11-26-glass-carry-coop-design.md`

## Global Constraints

- **No new npm dependencies** — use only packages already in `package.json`.
- **Online 2-player only** via Supabase Realtime (`eventsPerSecond: 15`, max 2 players per room, `?glassRoom=CODE` invite link).
- **Pure `.ts` relative imports** inside `src/glass/sim/` and `src/glass/online/` must use explicit `.ts` extensions so `node --test --experimental-strip-types` runs cleanly alongside Vite.
- **Coordinate system:** Course progresses along `+Z` (`z = 0` start to `z = 140` finish); `X` is lateral; `Y` is up (`y = 0` floor).
- **Glass dimensions & clearance:** `3.4m × 0.70m × 0.12m` (`±0.35m` around `handY`); `handY = player.y + 0.95 + liftOffset` where `liftOffset ∈ [-0.55, 0, +0.85]`. Lowered glass (`[0.05, 0.75]`) clears `lowGap` (`y ∈ [0.95, 2.60]`); raised glass (`[1.45, 2.15]`) clears `highWall` (`y ∈ [0, 1.25]`).
- **Strict TypeScript:** Zero `any`, zero `@ts-ignore`, zero unused locals/parameters (`npm run typecheck` and `npm run build` must pass).
- **Safety:** Do not commit, push, tag, or deploy automatically.

---

## File Structure Overview

- **Simulation (pure TS, unit-tested):**
  - `src/glass/sim/types.ts` — domain types for players, glass, obstacles, course, snapshots, events.
  - `src/glass/sim/constants.ts` — physics, glass constraint, and scoring constants.
  - `src/glass/sim/scoring.ts` — star rating (1–3★), Cookie rewards, best-record check.
  - `src/glass/sim/course.ts` — 5-stage 140m course layout + deterministic `evaluateDynamicObstacles(course, matchTime)`.
  - `src/glass/sim/physics.ts` — 60Hz kinematics, ice/wind/jumping, spring-rod glass constraint, OBB glass collision, crack/shatter/checkpoint/finish state machine.
- **Online (Supabase Realtime 2-player):**
  - `src/glass/online/protocol.ts` — channel constants, event payloads, emotes.
  - `src/glass/online/snapshotInterpolation.ts` — 75ms Guest interpolation buffer + `lerpAngle`.
  - `src/glass/online/useGlassRoom.ts` — 2-slot room lifecycle, presence, 15Hz broadcast/input, 8s reconnect grace.
- **Input & 3D Rendering:**
  - `src/glass/input/useGlassInput.ts` — keyboard (`WASD`/Arrows, `Space`, `Q`, `E`, `1–4`) & mouse lift/lower hook.
  - `src/glass/render/CarrierActor.tsx` — wraps `Character3D` + `BrawlMotionContext` + ring/name/emote bubble.
  - `src/glass/render/GlassPaneMesh.tsx` — crystal glass pane, stress frame, procedural crack `CanvasTexture`, 28-shard 3D shatter particles.
  - `src/glass/render/GlassCourseMesh.tsx` — 5-stage 3D scenery, floors, ice, barriers + floor shadows, wind streaks, pendulums, spinner, moving platforms, checkpoints, finish arch.
  - `src/glass/render/GlassCamera.tsx` — 3/4 follow camera with `+Z` lookAhead, dynamic zoom, crack/shatter screen shake.
  - `src/glass/render/GlassScene.tsx` — R3F `<Canvas>` + lighting + 60Hz Host driver / Guest interpolation driver.
- **UI & Screen Integration:**
  - `src/glass/ui/GlassLobby.tsx` — 2-player room create/join/ready lobby + invite link + controls guide.
  - `src/glass/ui/GlassHud.tsx` — 5-stage progress, timer, shatter count, glass HP icons, stress meter, emote bar.
  - `src/glass/ui/GlassResultModal.tsx` — 1–3★ finish summary, Cookies, new-best badge, replay/exit.
  - `src/screens/GlassCarryScreen.tsx` — root screen tying room, 3D scene, HUD, lobby, result modal, and profile settlement.
  - Existing files modified: `src/store/profileSchema.ts`, `src/store/profileStore.ts`, `src/audio/soundEngine.ts`, `src/screens/ModeSelectScreen.tsx`, `src/App.tsx`, `src/index.css`.
  - New asset: `public/banners/glass-carry-banner.webp` & `public/banners/glass-carry-banner.jpg`.

---

### Task 1: Core Simulation Types, Constants & Scoring

**Files:**
- Create: `src/glass/sim/types.ts`
- Create: `src/glass/sim/constants.ts`
- Create: `src/glass/sim/scoring.ts`
- Test: `src/glass/sim/__tests__/scoring.test.ts`

**Interfaces:**
- Produces:
  - `src/glass/sim/types.ts`: `PlayerSlot` (`'p1' | 'p2'`), `LiftIntent` (`-1 | 0 | 1`), `PlayerInput`, `PlayerSimState`, `GlassState`, `ShatterReason`, `SimEventKind`, `SimEvent`, `SurfaceKind`, `PlatformDef`, `MovingPlatformDef`, `BarrierKind`, `BarrierDef`, `WindZoneDef`, `PendulumDef`, `SpinnerDef`, `CheckpointDef`, `CourseDef`, `EvaluatedCourseObstacles`, `GlassSimPhase`, `GlassSimState`, `GlassResultSummary`.
  - `src/glass/sim/constants.ts`: `FIXED_DT`, `GLASS_REST_LENGTH`, `GLASS_SAFE_MIN_DIST`, `GLASS_SAFE_MAX_DIST`, `GLASS_BREAK_DIST`, `GLASS_HEIGHT`, `GLASS_HALF_HEIGHT`, `GLASS_THICKNESS`, `GLASS_MAX_HP`, `HAND_BASE_Y`, `LIFT_UP_OFFSET`, `LIFT_DOWN_OFFSET`, `LIFT_SPEED`, `MAX_HAND_DY`, `INVULN_AFTER_CRACK_SEC`, `SHATTER_RESPAWN_SEC`, `FALL_Y_LIMIT`, `COURSE_FINISH_Z`, `STAR_THRESHOLDS`, `COOKIE_REWARDS`.
  - `src/glass/sim/scoring.ts`: `calculateGlassResult(elapsedSec: number, shatters: number): GlassResultSummary`, `isNewGlassBest(prevBestTimeSec: number | null, prevBestStars: number, nextElapsedSec: number, nextStars: number): boolean`.

- [ ] **Step 1: Write the failing scoring test**

Create `src/glass/sim/__tests__/scoring.test.ts`:
```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateGlassResult, isNewGlassBest } from '../scoring.ts';

describe('Glass Carry scoring', () => {
  it('awards 3 stars and 50 cookies when within 180s and <= 2 shatters', () => {
    const res = calculateGlassResult(180, 2);
    assert.equal(res.stars, 3);
    assert.equal(res.cookies, 50);
  });

  it('drops to 2 stars when time > 180s or shatters > 2 within 2-star bounds', () => {
    assert.deepEqual(calculateGlassResult(181, 0), {
      stars: 2,
      cookies: 30,
      elapsedSec: 181,
      shatters: 0,
    });
    assert.deepEqual(calculateGlassResult(120, 3), {
      stars: 2,
      cookies: 30,
      elapsedSec: 120,
      shatters: 3,
    });
    assert.deepEqual(calculateGlassResult(300, 6), {
      stars: 2,
      cookies: 30,
      elapsedSec: 300,
      shatters: 6,
    });
  });

  it('awards 1 star and 15 cookies for any slower or higher-shatter completion', () => {
    assert.deepEqual(calculateGlassResult(301, 0), {
      stars: 1,
      cookies: 15,
      elapsedSec: 301,
      shatters: 0,
    });
    assert.deepEqual(calculateGlassResult(90, 7), {
      stars: 1,
      cookies: 15,
      elapsedSec: 90,
      shatters: 7,
    });
  });

  it('detects new personal best by higher stars or faster time', () => {
    assert.equal(isNewGlassBest(null, 0, 220, 2), true);
    assert.equal(isNewGlassBest(220, 2, 240, 3), true);
    assert.equal(isNewGlassBest(220, 2, 195, 2), true);
    assert.equal(isNewGlassBest(220, 2, 230, 2), false);
    assert.equal(isNewGlassBest(160, 3, 170, 2), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/glass/sim/__tests__/scoring.test.ts`
Expected: FAIL with module not found (`../scoring.ts`).

- [ ] **Step 3: Create `src/glass/sim/types.ts`, `src/glass/sim/constants.ts`, and `src/glass/sim/scoring.ts`**

Implement clean, strict TypeScript interfaces matching the spec:
- `PlayerInput`: `{ moveX: number; moveZ: number; jump: boolean; lift: LiftIntent }`
- `PlayerSimState`: position `(x, y, z)`, velocity `(vx, vy, vz)`, `yaw`, `grounded`, `coyoteTimer`, `jumpBufferTimer`, `liftOffset`, `liftIntent`, `onIce`, `inWind`, `carrying`.
- `GlassState`: `hp` (`0..3`), `maxHp` (`3`), `stress` (`0..1`), `centerX`, `centerY`, `centerZ`, `yaw`, `pitch`, `length`, `invulnTimer`, `shatterTimer`, `shatterReason`, `lastImpactX/Y/Z`.
- `GlassSimState`: `phase` (`'playing' | 'finished'`), `tick`, `matchTime`, `checkpointIndex`, `shatters`, `p1`, `p2`, `glass`, `nextEventId`, `events`.
- `calculateGlassResult`: clamps `elapsedSec >= 0`, `shatters >= 0`, applies `3★ (<=180 && <=2) -> 50`, `2★ (<=300 && <=6) -> 30`, `1★ -> 15`.

- [ ] **Step 4: Run test & typecheck to verify pass**

Run: `node --test --experimental-strip-types src/glass/sim/__tests__/scoring.test.ts`
Expected: PASS (4/4).

---

### Task 2: 5-Stage Deterministic Course Definition

**Files:**
- Create: `src/glass/sim/course.ts`
- Test: `src/glass/sim/__tests__/course.test.ts`

**Interfaces:**
- Consumes: `src/glass/sim/types.ts`, `src/glass/sim/constants.ts`
- Produces:
  - `GLASS_COURSE: CourseDef` — complete 5-stage course (`z = 0..140`) with:
    - **Stage 1 (`z = 0..28`, Cổng Gỗ Khởi Động):** Wide timber floor, 2 `lowGap` (`y ∈ [0.95, 2.60]`), 2 center `highWall` (`x ∈ [-1.1, 1.1]`, `y ∈ [0, 1.25]`), and 1 narrow gate (`leftWall x ∈ [-4.6, -1.1]`, `rightWall x ∈ [1.1, 4.6]` → `2.2m` clear gap).
    - **Stage 2 (`z = 28..56`, Sàn Băng & Quạt Gió):** Ice floor (`surface: 'ice'`), 2 alternating `WindZoneDef` segments with `periodSec: 5.5`, `warnDurationSec: 1.5`, `activeDurationSec: 2.2`, plus side bumper pillars.
    - **Stage 3 (`z = 56..86`, Xưởng Búa & Trụ Xoay):** 2 swinging `PendulumDef` hammers (`pivotY = 5.4`, `armLength = 4.1`, bob swings across `y ≈ 1.3`) + 1 low rotating `SpinnerDef` bar (`y ∈ [0.35, 0.95]`, clears when raised/jumped or walked around).
    - **Stage 4 (`z = 86..116`, Cầu Bập Bênh & Bệ Nhảy):** 3 moving horizontal `MovingPlatformDef` bridges over open void + winding narrow wooden catwalk with lantern pillars on alternating edges.
    - **Stage 5 (`z = 116..140`, Nước Rút Về Đích):** Moving slow `lowGap`/`highWall` combo, gentle crosswind, final jump platform onto Finish Arch (`z = 140`).
    - 5 `CheckpointDef` stations at `z = 0, 28, 56, 86, 116` (each with safe wide wooden landing + spawn coordinates for P1 at `x = -1.6` and P2 at `x = +1.6`).
  - `evaluateDynamicObstacles(course: CourseDef, matchTime: number): EvaluatedCourseObstacles` — deterministic evaluator returning active platform AABBs (with velocity `vx, vz` for riding moving platforms), active wind forces/warnings, pendulum bob positions, spinner segment endpoints, and moving barrier boxes.
  - `getStageNumberForZ(course: CourseDef, z: number): number` (`1..5`).

- [ ] **Step 1: Write the failing course test**

Create `src/glass/sim/__tests__/course.test.ts` verifying:
- Course has exactly 5 stages and 5 checkpoints monotonically ordered from `z = 0` to `finishZ = 140`.
- Every checkpoint spawn `(p1, p2)` stands on a solid floor platform and starts at safe glass distance (`3.2m`, within `[2.7, 3.9]`).
- `evaluateDynamicObstacles` is 100% deterministic for identical `matchTime`, moves platforms smoothly within bounds, cycles wind through `idle → warning → blowing`, swings pendulums left/right, and rotates spinner bars.
- Stage 1 narrow gap opening is `2.2m` (`< GLASS_REST_LENGTH = 3.4m`), `lowGap` bottom is `0.95m`, `highWall` top is `1.25m` with walkable margins on both sides (`|x| > 1.3m`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/glass/sim/__tests__/course.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/glass/sim/course.ts`**

Build the complete 5-stage course data and pure `evaluateDynamicObstacles` + `getStageNumberForZ` functions.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types src/glass/sim/__tests__/course.test.ts`
Expected: PASS.

---

### Task 3: Custom 3D Kinematics, Glass Constraint & Collision Physics

**Files:**
- Create: `src/glass/sim/physics.ts`
- Test: `src/glass/sim/__tests__/physics.test.ts`

**Interfaces:**
- Consumes: `src/glass/sim/types.ts`, `src/glass/sim/constants.ts`, `src/glass/sim/course.ts`
- Produces:
  - `NEUTRAL_INPUT: PlayerInput`
  - `createInitialSimState(course?: CourseDef): GlassSimState`
  - `stepGlassSim(state: GlassSimState, p1Input: PlayerInput, p2Input: PlayerInput, dt: number, course?: CourseDef): GlassSimState`
  - `getPlayerHandY(player: PlayerSimState): number`
  - `checkGlassSegmentBoxHit(p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }, box: Aabb3): boolean`

- [ ] **Step 1: Write comprehensive failing physics tests**

Create `src/glass/sim/__tests__/physics.test.ts` testing:
1. **Movement & Jumping:** Moving forward advances `+Z`; jumping raises `y > 0` and lands back on `y = 0`; coyote time allows jump right after stepping off a ledge.
2. **Ice vs Wood Friction:** On ice floor (`z ≈ 32`), releasing movement retains significantly higher glide velocity after `0.25s` than on wood (`z ≈ 4`).
3. **Spring-Rod Stretch & Shatter:** Walking `P1` left (`-X`) and `P2` right (`+X`) beyond `3.9m` increases `glass.stress` until `glass_shatter` event fires, increments `shatters`, and respawns both players at current checkpoint after `1.2s`.
4. **High Barrier (`lowGap`, `y ∈ [0.95, 2.60]`):**
   - Carrying glass at neutral height through `lowGap` cracks glass (`hp` drops `3 → 2`, emits `glass_crack`).
   - Both players holding `lift = -1` (`Q`) pass clean through `lowGap` with `hp === 3`.
5. **Low Center Barrier (`highWall`, `y ∈ [0, 1.25]`):**
   - Carrying glass at neutral height across center `highWall` cracks glass (`hp` drops `3 → 2`).
   - Both players holding `lift = +1` (`E`) pass clean above `highWall` with `hp === 3`.
6. **Narrow Wall Gate (`2.2m` opening):**
   - Walking side-by-side horizontally (`dx = 3.2m`) into the gate collides with walls and cracks/blocks glass.
   - Rotating single-file (`dx ≈ 0`, `dz = 3.2m`) passes cleanly through the `2.2m` gate with `hp === 3`.
7. **Invulnerability (`0.7s`):** Staying near a barrier immediately after cracking does not drain another HP during `0.7s`.
8. **Checkpoint & Fall Respawn:** Reaching Checkpoint 1 (`z >= 28`) while `hp === 1` restores `hp = 3` and emits `checkpoint`. Falling below `y < -5` triggers shatter + respawn at Checkpoint 1 (not Checkpoint 0).
9. **Finish Detection:** Reaching `z >= 140` with `hp > 0` transitions `phase` to `'finished'` and emits `course_clear`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/glass/sim/__tests__/physics.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/glass/sim/physics.ts`**

Implement pure functional/immutable-friendly `stepGlassSim` (cloning/returning updated `GlassSimState` cleanly with low allocation overhead):
- Player lateral + vertical kinematics, moving-platform carry (`vx * dt, vz * dt`), floor landing & solid wall push-out (for player cylinders against walls/pillars).
- Smooth `liftOffset` transition toward `liftIntent * (LIFT_UP_OFFSET / LIFT_DOWN_OFFSET)`.
- Spring-rod distance constraint (`dist > 3.9` pull inward + stress; `dist < 2.5` push outward + stress; `|handY2 - handY1| > 1.8` stress; safe zone stress decay).
- 5-point OBB sampling along glass pane (`t = 0.1, 0.3, 0.5, 0.7, 0.9`, `y ± 0.35m`, thickness `±0.06m`) against barriers, pendulums (2 damage), and spinner bar (2 damage), applying small bounce-back velocity + `invulnTimer = 0.7s`.
- Shatter timer `1.2s` → respawn at `course.checkpoints[checkpointIndex]` with `hp = 3, stress = 0, invulnTimer = 1.0`.
- Checkpoint progression & finish trigger.

- [ ] **Step 4: Run all sim tests**

Run: `node --test --experimental-strip-types src/glass/sim/__tests__/scoring.test.ts src/glass/sim/__tests__/course.test.ts src/glass/sim/__tests__/physics.test.ts`
Expected: PASS (all tests green).

---

### Task 4: Profile Persistence & Audio SFX Integration

**Files:**
- Modify: `src/store/profileSchema.ts`
- Modify: `src/store/profileStore.ts`
- Modify: `src/audio/soundEngine.ts`
- Test: `src/store/__tests__/profileStore.test.ts`

**Interfaces:**
- Consumes: `src/glass/sim/scoring.ts`
- Produces:
  - `PlayerProfile`: adds `glassBestTimeSec: number | null` (default `null`) and `glassBestStars: number` (default `0`, clamped `0..3`).
  - `settleGlassCarryMatch(profile: PlayerProfile, payload: { matchId: string; elapsedSec: number; shatters: number }): GlassSettlementResult` in `profileSchema.ts`.
  - `recordGlassMatchResult(payload: { matchId: string; elapsedSec: number; shatters: number })` exposed from `useProfileStore()`.
  - `SfxType` in `soundEngine.ts`: adds `'glassCrack' | 'glassShatter' | 'checkpoint' | 'glassLift'`.

- [ ] **Step 1: Add failing tests in `src/store/__tests__/profileStore.test.ts`**

Add a `describe('settleGlassCarryMatch', ...)` suite testing:
- Fresh / legacy profiles safely default `glassBestTimeSec: null` and `glassBestStars: 0`.
- Legitimate completion awards exact Cookies (`+50` for 3★, `+30` for 2★, `+15` for 1★), updates `glassBestTimeSec` & `glassBestStars`, increments `gamesPlayed` & `gamesWon`, and records `matchId` in `settledMatchIds`.
- Duplicate `matchId` returns `ok: false, reward: 0` without mutating profile.
- Slower/lower-star run still awards Cookies for a new `matchId`, but preserves better `glassBestStars` and faster `glassBestTimeSec`.

- [ ] **Step 2: Run test to verify failure**

Run: `node --test --experimental-strip-types src/store/__tests__/profileStore.test.ts`
Expected: FAIL (`settleGlassCarryMatch` not exported).

- [ ] **Step 3: Update `src/store/profileSchema.ts`, `src/store/profileStore.ts`, and `src/audio/soundEngine.ts`**

- In `profileSchema.ts`: add `glassBestTimeSec`, `glassBestStars`, sanitize them in `sanitizeProfileData`, implement `settleGlassCarryMatch`.
- In `profileStore.ts`: export `settleGlassCarryMatch`, `GlassSettlementResult`, and add `recordGlassMatchResult` to `useProfileStore`.
- In `soundEngine.ts`: add `'glassCrack' | 'glassShatter' | 'checkpoint' | 'glassLift'` to `SfxType` and implement clean Web Audio synth tones/noise bursts for each.

- [ ] **Step 4: Run profile tests and typecheck**

Run: `node --test --experimental-strip-types src/store/__tests__/profileStore.test.ts && npm run typecheck`
Expected: PASS.

---

### Task 5: Online 2-Player Protocol, Snapshot Interpolation & Room Hook

**Files:**
- Create: `src/glass/online/protocol.ts`
- Create: `src/glass/online/snapshotInterpolation.ts`
- Create: `src/glass/online/useGlassRoom.ts`
- Test: `src/glass/online/__tests__/snapshotInterpolation.test.ts`

**Interfaces:**
- Consumes: `src/online/supabaseClient.ts`, `src/online/sanitize.ts`, `src/scene3d/accessoryCatalog.ts`, `src/glass/sim/types.ts`
- Produces:
  - `src/glass/online/protocol.ts`: `GLASS_MAX_PLAYERS = 2`, `GLASS_DISCONNECT_GRACE_MS = 8000`, `GLASS_COUNTDOWN_MS = 2800`, `GLASS_SNAPSHOT_INTERVAL_MS = 67`, `GLASS_INPUT_INTERVAL_MS = 67`, `GLASS_INPUT_STALE_MS = 400`, `GLASS_EMOTES` (4 co-op emotes), `GlassRoomPhase`, `GlassRoomMember`, `GlassSnapshotPayload`, `GlassInputPayload`, `GlassStartPayload`, `GlassEmotePayload`, `packSimSnapshot(state: GlassSimState): GlassSnapshotPayload`.
  - `src/glass/online/snapshotInterpolation.ts`: `lerpAngle(a: number, b: number, t: number): number`, `SnapshotInterpolator` class (`push(snapshot, localNowMs)`, `sample(localNowMs)`, `reset()`).
  - `src/glass/online/useGlassRoom.ts`: `useGlassRoom(): GlassRoomController` handling create/join/leave, 2-slot cap (`roomFull`), ready toggle, `startMatch`, `sendGuestInput`, `broadcastSnapshot`, `sendEmote`, `restartMatch`, `returnToLobby`, partner disconnect grace countdown (`partnerDisconnectedSec`), and ref callbacks for high-frequency `onGuestInput` / `onSnapshot` so 15Hz network packets NEVER cause React re-renders!

- [ ] **Step 1: Write failing tests for `snapshotInterpolation.ts` and `packSimSnapshot`**

Create `src/glass/online/__tests__/snapshotInterpolation.test.ts` testing:
- `lerpAngle` wraps cleanly across `-π` and `+π` (shortest arc).
- `SnapshotInterpolator` returns `null` when empty, exact snapshot when 1 sample exists, and smooth midpoint interpolation between 2 snapshots at `renderTime = now - 75ms`.
- `packSimSnapshot` rounds floats to 2 decimals and preserves event IDs cleanly.

- [ ] **Step 2: Run test to verify failure**

Run: `node --test --experimental-strip-types src/glass/online/__tests__/snapshotInterpolation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `protocol.ts`, `snapshotInterpolation.ts`, and `useGlassRoom.ts`**

Key design details in `useGlassRoom.ts`:
- Channel name: `glass-carry-room-${roomCode}` with Presence keyed by `peerId` (persisted in `sessionStorage` under `paws_glass_peer_id_v1`).
- Members sorted by `joinedAt` ascending; only the first 2 peers occupy slots (`slot 0 = p1 / Host`, `slot 1 = p2 / Guest`). If `myPeerId` is not in the first 2 active slots, disconnect cleanly and set `error = 'Phòng đã đủ 2 người chơi.'`.
- High-frequency handlers (`setSnapshotListener`, `setGuestInputListener`) store callbacks in refs to avoid React state churn at 15Hz.
- Reconnect grace timer (`8s`): if partner leaves Presence while `phase === 'playing'`, pause simulation and show countdown; if partner rejoins within `8s`, Host sends `glass:sync_state` and match resumes.

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test --experimental-strip-types src/glass/online/__tests__/snapshotInterpolation.test.ts && npm run typecheck`
Expected: PASS.

---

### Task 6: Input Hook & 3D World Rendering

**Files:**
- Create: `src/glass/input/useGlassInput.ts`
- Create: `src/glass/render/CarrierActor.tsx`
- Create: `src/glass/render/GlassPaneMesh.tsx`
- Create: `src/glass/render/GlassCourseMesh.tsx`
- Create: `src/glass/render/GlassCamera.tsx`
- Create: `src/glass/render/GlassScene.tsx`

**Interfaces:**
- Consumes: `src/scene3d/Character3D.tsx`, `src/scene3d/CharacterRig3D.tsx` (`BrawlMotionContext`), `src/brawl/sim/partyMotion.ts` (`createPartyMotionState`, `stepPartyMotion`), `src/glass/sim/*`, `src/glass/online/*`, `src/audio/soundEngine.ts`
- Produces:
  - `useGlassInput(opts: { enabled: boolean; onEmote: (index: number) => void }): { readInput: () => PlayerInput }`
  - `GlassScene`: renders the full 3D course, both plush carriers, crystal glass pane + cracks + 28 shatter shards, camera 3/4, driving Host 60Hz sim / 15Hz snapshot broadcast or Guest 15Hz input / 75ms interpolation, emitting 10Hz `GlassHudSnapshot` to React HUD and playing SFX on new `SimEvent` IDs.

- [ ] **Step 1: Implement `src/glass/input/useGlassInput.ts`**

Handles `KeyW/A/S/D`, `ArrowUp/Down/Left/Right`, `Space`, `KeyE` / left mouse button (lift up `+1`), `KeyQ` / right mouse button (lower `-1`), `Digit1..Digit4` (emote trigger with `400ms` debounce). Clears keys on `window.blur` and suppresses `contextmenu` on canvas while playing.

- [ ] **Step 2: Implement `src/glass/render/CarrierActor.tsx` and `src/glass/render/GlassPaneMesh.tsx`**

- `CarrierActor`: reads player transform from a shared mutable `GlassRenderStateRef` inside `useFrame` (0 React re-renders per frame!), updates `PartyMotionState` (using `grab_hold` / `run` / `jump` actions so arms reach out toward the glass), renders `<Character3D />` with player's animal & accessories, colored ground ring (`#fbbf24` for P1, `#2dd4bf` for P2), and floating name + temporary emote bubble.
- `GlassPaneMesh`:
  - Positions pane at midpoint `(centerX, centerY, centerZ)`, rotates by `yaw` & `pitch`, scales X to actual span `length`.
  - Procedural `CanvasTexture` generator for `hp = 3` (clean specular sheen), `hp = 2` (corner hairline cracks), `hp = 1` (webbed heavy cracks).
  - Outer frame mesh shifts color smoothly from icy cyan → amber → pulsing crimson as `stress` rises above `0.45`, adding subtle high-frequency jitter when `stress > 0.65`.
  - 28-shard `InstancedMesh` burst animation when `glass.shatterTimer > 0` (shards burst outward from `lastImpact` with gravity & spin over `1.2s`).

- [ ] **Step 3: Implement `src/glass/render/GlassCourseMesh.tsx`, `GlassCamera.tsx`, and `GlassScene.tsx`**

- `GlassCourseMesh`:
  - Static floors (warm timber wood vs translucent reflective ice), walls/narrow-gate pillars, static `lowGap` overhead striped beams (with painted dark warning strip directly on the floor underneath for crystal-clear depth reading!), center `highWall` railings, checkpoint lantern arches (glow warm amber once reached), and grand Finish Arch with golden PAWS ribbon.
  - Dynamic obstacles updated directly via refs in `useFrame` from `evaluateDynamicObstacles(GLASS_COURSE, matchTime)`: moving platforms, swinging pendulum hammers, rotating spinner bar, wind zone snow-streak particles (soft pulse during warning, fast streak during active gust).
- `GlassCamera`: smooth 3/4 chase camera positioned behind-above midpoint `(midX * 0.55, midY + 9.2 + spanZoom, midZ - 11.5 - spanZoom * 0.7)` looking at `(midX * 0.65, midY + 0.8, midZ + 3.2)`, plus decaying camera shake on `glass_crack` / `glass_shatter`.
- `GlassScene`: wraps `<Canvas shadows dpr={[1, 2]}>`, Winter Cabin warm key light + sky hemisphere + snow backdrop, runs Host fixed-timestep 60Hz loop (`dt <= 0.05`) or Guest `SnapshotInterpolator`, handles stale Guest input (`> 400ms` → zero movement), triggers SFX (`glassCrack`, `glassShatter`, `checkpoint`, `win`), and pushes `GlassHudSnapshot` at 10Hz.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (0 errors).

---

### Task 7: Lobby, HUD, Result Modal & Main Screen

**Files:**
- Create: `src/glass/ui/GlassLobby.tsx`
- Create: `src/glass/ui/GlassHud.tsx`
- Create: `src/glass/ui/GlassResultModal.tsx`
- Create: `src/screens/GlassCarryScreen.tsx`

**Interfaces:**
- Consumes: `src/glass/online/useGlassRoom.ts`, `src/glass/render/GlassScene.tsx`, `src/store/profileStore.ts`, `src/audio/soundEngine.ts`
- Produces:
  - Default export `GlassCarryScreen({ initialRoomCode?: string; onBackToModeSelect: () => void })` for lazy loading in `App.tsx`.

- [ ] **Step 1: Implement `GlassLobby.tsx`**

Clean dark Winter Cabin + crystal cyan glass aesthetic matching `BlockBlastRoomLobby.tsx`:
- Handles unconfigured Supabase gracefully (clear message referencing `SUPABASE_SETUP.md` + Back button).
- Create Room button, 6-char room code input + Join Room button, display name input, animal picker (8 animals synced to `profileStore`).
- Waiting room: Room code copy button, **Sao chép Link Mời (`?glassRoom=CODE`)**, 2 clear player slots (`P1 — Chủ Phòng` & `P2 — Đồng Đội`) with animal badge + Ready pill, Host Start button enabled when both players are present & ready, plus compact visual controls legend (`WASD`, `Space`, `E Nâng`, `Q Hạ`, `1–4 Emote`).

- [ ] **Step 2: Implement `GlassHud.tsx` and `GlassResultModal.tsx`**

- `GlassHud`:
  - Top-center: 5-stage stepper (`1–5` with current stage name), live timer (`MM:SS.t`), shatter count pill.
  - Top-left: 3 crystal glass HP icons (intact / cracked / broken) + compact Stress meter (highlights amber/red when `> 45%`).
  - Top-right: Role badge (`P1 Host` / `P2 Guest`), Sound toggle, Leave Room button.
  - Center overlays: `3-2-1` countdown banner, Checkpoint toast (`Checkpoint 2/5 — Đã sửa kính!`), Shatter flash (`Kính vỡ! Hồi sinh tại Checkpoint...`), Partner Disconnect grace banner (`Đang chờ đồng đội kết nối lại... (Xs)`).
  - Bottom-center: compact keybind hint + 4 clickable Emote buttons (`1–4`).
- `GlassResultModal`:
  - Uses semantic `<dialog>` or accessible modal overlay with 1–3 animated stars, completion time, total shatters, Cookies earned (`+50 / +30 / +15`), "Kỷ lục mới!" badge when applicable, **Chơi lại cùng phòng** (Host action, Guest sees "Đang chờ chủ phòng chơi lại..."), and **Về Chọn Chế Độ**.

- [ ] **Step 3: Implement `src/screens/GlassCarryScreen.tsx`**

Connects `useGlassRoom`, `useProfileStore` (`recordGlassMatchResult` called once per `matchId` when `phase === 'finished'`), `GlassLobby`, `GlassScene`, `GlassHud`, and `GlassResultModal`.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 8: Banner Asset, `ModeSelectScreen.tsx` & `App.tsx` Routing

**Files:**
- Create: `public/banners/glass-carry-banner.jpg` & `public/banners/glass-carry-banner.webp` (generated via `image-generator` subagent + sharp/canvas or resized to 16:9 matching existing banners)
- Modify: `src/index.css` (add `.btn-tactile-cyan` tactile button utility matching amber/sky/emerald)
- Modify: `src/screens/ModeSelectScreen.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `src/screens/GlassCarryScreen.tsx`, `useProfileStore` (`glassBestTimeSec`, `glassBestStars`)
- Produces:
  - 4th game mode card **Glass Carry Co-op** in `ModeSelectScreen` (responsive 4-card grid: `grid-cols-1 md:grid-cols-2 xl:grid-cols-4`).
  - `'glassCarry'` screen in `App.tsx` + `?glassRoom=CODE` deep-link auto-entry.

- [ ] **Step 1: Generate 16:9 key-art banner for Glass Carry Co-op**

Generate a cohesive Winter Cabin 3D plush-animal banner showing two cute plush animals (dog & cat) carrying a sparkling crystal glass pane across a snowy wooden obstacle bridge under warm lanterns, and save both `.jpg` and `.webp` in `public/banners/glass-carry-banner.{jpg,webp}`.

- [ ] **Step 2: Add `.btn-tactile-cyan` in `src/index.css` and update `ModeSelectScreen.tsx` & `App.tsx`**

- Update `ModeSelectScreenProps` to add `onSelectGlassCarry: () => void`.
- Add 4th `GameModeEntry` (`id: 'glassCarry'`, title `'Glass Carry Co-op'`, genre badge `'Co-op Vật Lý · 2 Người Online'`, specs showing 5 chặng, Nâng/Hạ kính, and `glassBestStars > 0 ? ... : 'Chưa phá đảo'`).
- Update `App.tsx` with `LazyGlassCarryScreen`, `readInitialGlassRoomCode()`, `'glassCarry'` screen + `ModeErrorBoundary` + `ModeLoadingFallback`.

- [ ] **Step 3: Run typecheck & build**

Run: `npm run build`
Expected: PASS (`tsc --noEmit && vite build` succeeds cleanly with lazy chunk for `GlassCarryScreen`).

---

### Task 9: Full Automated & Browser Verification

**Files:**
- None (verification only; fix any bugs uncovered)

- [ ] **Step 1: Run entire Node unit test suite across the repo**

Run:
```powershell
node --test --experimental-strip-types src/glass/sim/__tests__/scoring.test.ts src/glass/sim/__tests__/course.test.ts src/glass/sim/__tests__/physics.test.ts src/glass/online/__tests__/snapshotInterpolation.test.ts src/store/__tests__/profileStore.test.ts
```
Expected: ALL tests pass (0 failures).

- [ ] **Step 2: Run full production build**

Run: `npm run build`
Expected: Exit code 0, zero TypeScript warnings/errors.

- [ ] **Step 3: Visual & interactive browser smoke verification**

Start `npm run dev`, open the app in the browser subagent:
1. Verify `ModeSelectScreen` displays all 4 cards cleanly (no overflow, banner loads cleanly, responsive layout).
2. Click **Glass Carry Co-op** → verify `GlassLobby` renders cleanly (create room / join code / controls legend / fallback if Supabase isn't configured, or full room creation if configured).
3. Verify zero uncaught console errors or React runtime errors.
4. Stop dev server cleanly when done.
