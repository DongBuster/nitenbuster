# PAWS Duo Co-op 3D (4 Maps) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **SAFETY RULE:** Never run `git commit`, `git push`, `git tag`, or deploy commands unless the user explicitly asks in the current session.

**Goal:** Expand the existing 2-player online **Glass Carry Co-op** minigame into **PAWS Duo Co-op 3D (4 Maps)** by adding 3 brand-new cooperative physics maps (**Chèo Phao Vượt Thác**, **Dây Thừng Buộc Chung**, **Xe Goòng Đường Ray**), a shared 4-map lobby selector, adaptive per-map HUD, 12-star profile persistence, and `?coopRoom=` / `?glassRoom=` routing without breaking Map 1.

**Architecture:** Keep Map 1 (`src/glass/sim/`) intact; introduce a pluggable `COOP_MAPS` registry (`src/coop/maps/registry.ts`), 3 standalone pure-TypeScript 60Hz simulations + R3F 3D scenes under `src/coop/maps/{raft,rope,minecart}/`, a discriminated-union 15Hz `CoopSnapshotPayload` over the shared Supabase Realtime room (`useGlassRoom.ts` + `coopInterpolation.ts`), and an adaptive lobby/HUD/result UI supporting instant map switching inside one 2-player room.

**Tech Stack:** React 19, TypeScript 5.8 (`strict: true`, `allowImportingTsExtensions: true`), Vite 6, Tailwind CSS v4, Three.js / `@react-three/fiber` v9 / `@react-three/drei` v10, `@supabase/supabase-js` v2, Node v24 `node --test --experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-11-26-paws-duo-coop-maps-design.md`

## Global Constraints

- **No new npm dependencies.**
- **Zero regression on Map 1:** Do NOT break `src/glass/sim/*` or any of the existing 52 unit tests.
- **Explicit `.ts` extensions** on all relative imports inside pure TypeScript modules (`src/coop/maps/*/`, `src/coop/online/`, `src/glass/online/`, `src/store/`) so `node --test --experimental-strip-types` works alongside Vite.
- **Right-handed `+Z` coordinate system across all 4 maps:** Camera sits behind `-Z` looking toward `+Z` → screen-left is `+X` (`A/ArrowLeft` → `moveX = +1`), screen-right is `-X` (`D/ArrowRight` → `moveX = -1`).
- **60Hz Host-Authoritative / 15Hz Broadcast:** Keep all 60Hz transforms in mutable refs (`useFrame`), never React state; HUD updates at ~10Hz; high-frequency network listeners stay in refs.
- **Strict TypeScript:** Zero `any`, zero `@ts-ignore`, zero unused locals/parameters (`npm run typecheck` and `npm run build` must exit 0).
- **Safety:** Do not run `git commit`, `git push`, `git tag`, or deploy automatically.

---

### Task 1: Co-op Map Registry, Multi-Map Profile Persistence & Audio SFX

**Files:**
- Create: `src/coop/maps/registry.ts`
- Test: `src/coop/maps/__tests__/registry.test.ts`
- Modify: `src/store/profileSchema.ts`
- Modify: `src/store/profileStore.ts`
- Modify: `src/store/__tests__/profileStore.test.ts`
- Modify: `src/audio/soundEngine.ts`

**Interfaces:**
- Produces in `src/coop/maps/registry.ts`:
  - `export type CoopMapId = 'glass_carry' | 'raft_rapids' | 'rope_tether' | 'minecart_rails'`
  - `export const DEFAULT_COOP_MAP_ID: CoopMapId = 'glass_carry'`
  - `export interface CoopControlHint { keys: string; label: string }`
  - `export interface CoopMapMeta { id: CoopMapId; order: number; title: string; shortTitle: string; tagline: string; mechanicBadge: string; accentClass: string; finishZ: number; starThresholds: { three: { maxElapsedSec: number; maxFailures: number }; two: { maxElapsedSec: number; maxFailures: number } }; controls: readonly CoopControlHint[] }`
  - `export const COOP_MAPS: readonly CoopMapMeta[]` (4 maps: `glass_carry` 140m `180/300`, `raft_rapids` 160m `140/240`, `rope_tether` 135m `180/300`, `minecart_rails` 180m `145/240`)
  - `export function isCoopMapId(val: unknown): val is CoopMapId`
  - `export function getCoopMapMeta(id: CoopMapId): CoopMapMeta`
  - `export function getNextCoopMapId(id: CoopMapId): CoopMapId`
  - `export function calculateCoopResult(mapId: CoopMapId, elapsedSec: number, failures: number): { mapId: CoopMapId; stars: 1 | 2 | 3; cookies: number; elapsedSec: number; failures: number }`
  - `export function countTotalCoopStars(records: Partial<Record<CoopMapId, { bestStars: number; bestTimeSec: number }>>): number`
- Produces in `src/store/profileSchema.ts` & `profileStore.ts`:
  - `CoopMapRecord = { bestStars: number; bestTimeSec: number }`
  - `PlayerProfile.coopRecords: Partial<Record<CoopMapId, CoopMapRecord>>` (sanitized & auto-migrated from legacy `glassBestStars` / `glassBestTimeSec`)
  - `settleCoopMatch(profile, { matchId, mapId, elapsedSec, failures }): CoopSettlementResult` (and `settleGlassCarryMatch` delegates to `mapId: 'glass_carry'` while keeping `glassBestStars`/`glassBestTimeSec` synced)
  - `recordCoopMatchResult` exposed from `useProfileStore()` alongside `recordGlassMatchResult`
- Produces in `src/audio/soundEngine.ts`:
  - Adds `'paddleSplash' | 'raftBoost' | 'ropePull' | 'cartClack'` to `SfxType` with Web Audio synthesis.

- [ ] **Step 1: Write failing tests (`src/coop/maps/__tests__/registry.test.ts` + new `settleCoopMatch` tests in `profileStore.test.ts`)**
- [ ] **Step 2: Run tests to verify RED**
- [ ] **Step 3: Implement `registry.ts`, update `profileSchema.ts`, `profileStore.ts`, `soundEngine.ts`**
- [ ] **Step 4: Run `node --test --experimental-strip-types src/coop/maps/__tests__/registry.test.ts src/store/__tests__/profileStore.test.ts` and `npm run typecheck` to verify GREEN**

---

### Task 2: Map 2 — Chèo Phao Vượt Thác (`raft_rapids`) Simulation

**Files:**
- Create: `src/coop/maps/raft/types.ts`
- Create: `src/coop/maps/raft/course.ts`
- Create: `src/coop/maps/raft/physics.ts`
- Test: `src/coop/maps/raft/__tests__/raftPhysics.test.ts`

**Interfaces:**
- Consumes: `src/glass/sim/types.ts` (`PlayerInput`, `PlayerSlot`)
- Produces:
  - `RAFT_COURSE` (`finishZ = 160`, 5 stages `0..32..64..96..128..160`, 5 checkpoints, static/drifting rocks, horizontal drifting floating logs `y ∈ [0, 0.75]`, swirling whirlpools, fast-rapids zones).
  - `evaluateRaftObstacles(course, matchTime)` (deterministic drifting logs & whirlpool rotation).
  - `createInitialRaftSimState(course?)`
  - `stepRaftSim(state, p1Input, p2Input, dt, course?)` (60Hz pure physics: P1 left paddle `+X` turns nose right `yaw -= 0.42`, P2 right paddle `-X` turns nose left `yaw += 0.42`, cooldown `0.35s`, synchronized stroke `≤ 0.25s` triggers `boostTimer = 1.1s`, synchronized `Space` `≤ 0.30s` launches `vy = 8.4` clearing floating logs, 3 HP + `0.8s` invuln, checkpoint HP restore, respawn after `1.1s` on 0 HP, finish at `z >= 160`).
  - `packRaftSnapshot(matchId, state): RaftSnapshotPayload`

- [ ] **Step 1: Write comprehensive failing tests in `src/coop/maps/raft/__tests__/raftPhysics.test.ts`**
  - P1-only stroke turns yaw negative (toward `-X`), P2-only stroke turns yaw positive (toward `+X`).
  - Synchronized strokes (`≤ 0.25s`) activate `boostTimer > 0` and emit `'raft_boost'`.
  - Synchronized `Space` launches raft (`y > 0.78`) cleanly over floating log, while unjumped raft hits log and loses 1 HP (`0.8s` invuln prevents double drain).
  - Whirlpool pulls raft laterally and spins yaw.
  - 0 HP triggers `respawnTimer = 1.1s`, increments `failures`, respawns at current checkpoint with `hp = 3`.
  - Checkpoint restores `hp = 3`; crossing `z >= 160` finishes with `'course_clear'`.
- [ ] **Step 2: Run test to verify RED**
- [ ] **Step 3: Implement `types.ts`, `course.ts`, `physics.ts`**
- [ ] **Step 4: Run test + `npm run typecheck` to verify GREEN**

---

### Task 3: Map 3 — Dây Thừng Buộc Chung (`rope_tether`) Simulation

**Files:**
- Create: `src/coop/maps/rope/types.ts`
- Create: `src/coop/maps/rope/course.ts`
- Create: `src/coop/maps/rope/physics.ts`
- Test: `src/coop/maps/rope/__tests__/ropePhysics.test.ts`

**Interfaces:**
- Consumes: `src/glass/sim/types.ts` (`PlayerInput`, `PlayerSlot`, `Aabb3`)
- Produces:
  - `ROPE_COURSE` (`finishZ = 135`, 5 ascending stages `0..27..54..81..108..135` rising from `y = 0` to `y = 4.5` at Lantern Peak, 5 checkpoints, static/moving snow/ice islands, wind gusts, swinging pendulums).
  - `evaluateRopeCourse(course, matchTime)` (deterministic moving islands, wind cycles, pendulums).
  - `createInitialRopeSimState(course?)`
  - `stepRopeSim(state, p1Input, p2Input, dt, course?)` (60Hz pure physics: `ROPE_MAX_LEN = 4.5m` elastic constraint with inverse-mass weighting `0.08` anchored vs `1.0` free; `Q` (`lift < 0`) while grounded sets `anchored = true` locking horizontal slip so a falling partner hangs safely on the taut rope; `E` (`lift > 0`) while grounded reels partner upward/inward toward `1.2m` at `3.4 m/s` emitting `'rope_pull'`; `ropeStrain` rises `+0.15/s` while a partner hangs deeply unsupported; fails & respawns after `1.2s` only if BOTH players fall below `y < -6`, or `ropeStrain >= 1`, or hanging player hit by pendulum; checkpoint & finish at `z >= 135`).
  - `packRopeSnapshot(matchId, state): RopeSnapshotPayload`

- [ ] **Step 1: Write comprehensive failing tests in `src/coop/maps/rope/__tests__/ropePhysics.test.ts`**
  - Walking apart beyond `4.5m` pulls players together via rope constraint.
  - Anchoring (`lift: -1`) while partner steps off ledge holds partner hanging safely on the rope without dragging the anchored player off!
  - Reeling (`lift: +1`) while anchored pulls the hanging partner back up onto the island (`y` rises back to `>= island.maxY`).
  - Both players falling below `y < -6` (or `ropeStrain >= 1`) triggers fail respawn at current checkpoint and increments `failures`.
  - Checkpoint progression & ascending Peak finish (`z >= 135`) emits `'course_clear'`.
- [ ] **Step 2: Run test to verify RED**
- [ ] **Step 3: Implement `types.ts`, `course.ts`, `physics.ts`**
- [ ] **Step 4: Run test + `npm run typecheck` to verify GREEN**

---

### Task 4: Map 4 — Xe Goòng Đường Ray (`minecart_rails`) Simulation

**Files:**
- Create: `src/coop/maps/minecart/types.ts`
- Create: `src/coop/maps/minecart/course.ts`
- Create: `src/coop/maps/minecart/physics.ts`
- Test: `src/coop/maps/minecart/__tests__/minecartPhysics.test.ts`

**Interfaces:**
- Consumes: `src/glass/sim/types.ts` (`PlayerInput`, `PlayerSlot`)
- Produces:
  - `MINECART_LANE_X = [3.2, 0, -3.2] as const` (Lane 0 screen-left `+X`, Lane 1 center, Lane 2 screen-right `-X`).
  - `MINECART_COURSE` (`finishZ = 180`, 5 stages `0..36..72..108..144..180`, 5 checkpoints, lane blockers, overhead beams `y ∈ [1.15, 2.5]`, `4.8m` broken-rail gaps, sweeping cross-lane pillars, falling rock telegraphs).
  - `evaluateMinecartObstacles(course, matchTime)` (deterministic moving cross-lane blockers & falling rock warning/active phases).
  - `createInitialMinecartSimState(course?)`
  - `stepMinecartSim(state, p1Input, p2Input, dt, course?)` (60Hz pure physics: alternating pump `pumpTurn: 'p1' | 'p2'` on rising-edge `lift > 0` boosting speed `+2.8` up to `13.5` decaying toward `4.2`; synchronized lean `A`/`D` (`|moveX| > 0.4` for `0.10s`, cooldown `0.32s`) hops lane while opposing leans cause `wobble` without switching; synchronized duck `lift < 0` clears overhead beams else `-1 HP`; synchronized `Space` `≤ 0.30s` jumps `vy = 8.8, g = -22` clearing `4.8m` gap if speed `>= 7.0`; `3 HP` + `0.8s` invuln; derail respawn `1.1s` at checkpoint; finish at `z >= 180`).
  - `packMinecartSnapshot(matchId, state): MinecartSnapshotPayload`

- [ ] **Step 1: Write comprehensive failing tests in `src/coop/maps/minecart/__tests__/minecartPhysics.test.ts`**
  - Alternating pump (`p1` then `p2`) increases speed and toggles `pumpTurn`; pumping out-of-turn does not boost.
  - Synchronized left/right lean switches lanes (`1 -> 0` on `moveX = +1`, `1 -> 2` on `moveX = -1`); opposing leans do not change lane and increase `wobble`.
  - Overhead beam cracks HP when one/both forget to duck, clears cleanly when both hold `lift: -1`.
  - Broken-rail gap `4.8m`: jumping at speed `>= 7.5` clears safely; unjumped or low-speed cart falls (`y < -4`), increments `failures`, and respawns at checkpoint.
  - Checkpoint restores `hp = 3`; crossing `z >= 180` finishes with `'course_clear'`.
- [ ] **Step 2: Run test to verify RED**
- [ ] **Step 3: Implement `types.ts`, `course.ts`, `physics.ts`**
- [ ] **Step 4: Run test + `npm run typecheck` to verify GREEN**

---

### Task 5: Multi-Map Online Protocol, Interpolation & `useGlassRoom` Upgrade

**Files:**
- Create: `src/coop/online/coopInterpolation.ts`
- Test: `src/coop/online/__tests__/coopInterpolation.test.ts`
- Modify: `src/glass/online/protocol.ts`
- Modify: `src/glass/online/snapshotInterpolation.ts` (auto-reset on `matchId` change!)
- Modify: `src/glass/online/useGlassRoom.ts`

**Interfaces:**
- Produces:
  - `CoopSnapshotPayload = ({ mapId: 'glass_carry' } & GlassSnapshotPayload) | RaftSnapshotPayload | RopeSnapshotPayload | MinecartSnapshotPayload` (backward-compatible: `packSimSnapshot` adds `mapId: 'glass_carry'`).
  - `CoopSelectMapPayload = { hostPeerId: string; mapId: CoopMapId }`
  - `GlassStartPayload` gains `mapId: CoopMapId`.
  - `GlassRoomController` gains: `selectedMap: CoopMapId`, `selectMap(mapId: CoopMapId): void`, `startNextMap(): void`, `finalResult: { matchId: string; mapId: CoopMapId; elapsedSec: number; shatters: number } | null`, and `broadcastSnapshot` / `setSnapshotListener` accept `CoopSnapshotPayload`.
  - `CoopSnapshotInterpolator`: smooth 75ms interpolation for `raft_rapids`, `rope_tether`, `minecart_rails` (reusing `lerpAngle`), auto-resetting on `matchId`/`mapId` changes and never duplicating discrete events.
  - Also applies Task 5 minor polish: latched `jump` merge in `sendGuestInput` so single-frame jumps are never dropped under throttle jitter.

- [ ] **Step 1: Write failing tests in `src/coop/online/__tests__/coopInterpolation.test.ts`**
- [ ] **Step 2: Run test to verify RED**
- [ ] **Step 3: Implement `coopInterpolation.ts` and upgrade `protocol.ts`, `snapshotInterpolation.ts`, `useGlassRoom.ts`**
- [ ] **Step 4: Run `node --test --experimental-strip-types src/coop/online/__tests__/coopInterpolation.test.ts src/glass/online/__tests__/snapshotInterpolation.test.ts` and `npm run typecheck` to verify GREEN**

---

### Task 6: 3D Scenes for the 3 New Maps & Shared HUD Snapshot Type

**Files:**
- Modify: `src/glass/render/renderTypes.ts` (extend `GlassHudSnapshot` with optional map-adaptive fields: `mapId`, `primaryMeterPct`, `primaryMeterLabel`, `statusBadge`, `pumpTurn`, `boostActive`, `failureLabel`)
- Modify: `src/glass/render/GlassScene.tsx` (populate `mapId: 'glass_carry'` and `failureLabel: 'Vỡ'` in emitted HUD snapshot)
- Create: `src/coop/maps/raft/RaftScene.tsx`
- Create: `src/coop/maps/rope/RopeScene.tsx`
- Create: `src/coop/maps/minecart/MinecartScene.tsx`

**Interfaces:**
- All 3 scenes expose identical clean props matching `GlassSceneProps`:
  `{ room: GlassRoomController; paused: boolean; onHudSnapshot: (hud: GlassHudSnapshot) => void }`
- All 3 scenes reuse `<Character3D />`, `BrawlMotionContext`, `PartyMotionState`, `useGlassInput`, `CoopSnapshotInterpolator`, and `playSfx`, keeping 60Hz transforms strictly in refs and disposing any manual Three.js resources on unmount.
- Visual highlights:
  - `RaftScene`: animated inflatable yellow-amber oval raft, 2 plushies seated left/right holding animated wooden paddles that swing on stroke, glowing white foam trail during Boost, cyan glacier river with moving current streaks, rocks, floating logs, spinning whirlpools, checkpoint lantern buoys & Finish Lighthouse Arch.
  - `RopeScene`: 2 plushies on ascending snowy/icy islands (`y = 0 -> 4.5`), 10-segment catenary 3D rope mesh dynamically sagging when slack and stretching taut (gold → orange → pulsing red) under tension, golden ground anchor ring when holding `Q`, reel-in light pulse when holding `E`, wind streaks, pendulums & Lantern Peak Finish.
  - `MinecartScene`: iron-rimmed wooden minecart riding 3 parallel steel rail tracks, animated seesaw pump handle glowing amber/teal for the active `pumpTurn` (`P1` vs `P2`), cart tilt + sparks on lane switch, players ducking low inside cart on `Q`, striped low tunnel beams, glowing red lane telegraph for falling rocks, broken-rail chasm jumps & Finish Station Arch.

- [ ] **Step 1: Update `renderTypes.ts` and `GlassScene.tsx`**
- [ ] **Step 2: Implement `RaftScene.tsx`, `RopeScene.tsx`, and `MinecartScene.tsx`**
- [ ] **Step 3: Run `npm run typecheck` to verify 0 errors**

---

### Task 7: 4-Map Lobby, Adaptive HUD, Result Modal, Screen Orchestrator, `ModeSelectScreen` & `App.tsx`

**Files:**
- Modify: `src/glass/ui/GlassLobby.tsx` (add 4-Map Selector card grid with per-map stars `0–3★`, Host click to switch map live, dynamic controls legend matching `room.selectedMap`, `?coopRoom=CODE` invite link)
- Modify: `src/glass/ui/GlassHud.tsx` (adaptive top-left meter/HP/pump-turn/boost/anchor widget per `hud.mapId`, dynamic bottom keybind legend matching `room.selectedMap`, clean `flex-col` center overlay stacking)
- Modify: `src/glass/ui/GlassResultModal.tsx` (show map title, adaptive failure label, add **Chơi Map Tiếp Theo** button for Host alongside **Chơi Lại** and **Về Sảnh Đổi Map**)
- Modify: `src/screens/GlassCarryScreen.tsx` (render active 3D scene by `room.selectedMap`, call `recordCoopMatchResult` with `mapId`)
- Modify: `src/screens/ModeSelectScreen.tsx` (upgrade 4th card to **PAWS Duo Co-op 3D** showing `X / 12★` and 4 map mechanics)
- Modify: `src/App.tsx` (accept both `?coopRoom=` and `?glassRoom=` deep links)

- [ ] **Step 1: Upgrade `GlassLobby.tsx`, `GlassHud.tsx`, `GlassResultModal.tsx`, `GlassCarryScreen.tsx`**
- [ ] **Step 2: Upgrade `ModeSelectScreen.tsx` and `App.tsx`**
- [ ] **Step 3: Run `npm run build` (`tsc --noEmit && vite build`) to verify 0 errors**

---

### Task 8: Full Automated Test Suite, Build & Live Browser Smoke Verification

**Files:**
- None (verification only; fix any bugs uncovered)

- [ ] **Step 1: Run ALL unit tests across `src/glass/`, `src/coop/`, and `src/store/`**
- [ ] **Step 2: Run `npm run build` and verify exit code 0**
- [ ] **Step 3: Start Vite dev server and run browser subagent visual & interactive smoke check:**
  - Verify `ModeSelectScreen` 4th card displays **PAWS Duo Co-op 3D** (`0 / 12★` or earned stars) cleanly.
  - Enter Lobby, create a 2-player room, click through all 4 Map cards (**Bê Kính**, **Chèo Phao**, **Dây Thừng**, **Xe Goòng**) verifying active selection + dynamic controls legend update cleanly with 0 console errors.
  - Verify both `?coopRoom=TEST12` and `?glassRoom=OLD999` deep links pre-fill the code and clean the URL bar.
  - Stop dev server cleanly.
