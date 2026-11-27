# PAWS Duo Co-op 3D — 3-Level Hierarchy & 3 Glass Carry Maps (15 Levels) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **SAFETY RULE:** Never run `git commit`, `git push`, `git tag`, or deploy commands unless the user explicitly asks in the current session.

**Goal:** Upgrade PAWS Duo Co-op 3D to a scalable 3-level hierarchy (`4 Cooperative Actions → Map Packs → 5 Difficulty Levels`), with sequential Host-based level unlocking, 3 distinct themed 3D Maps × 5 handcrafted levels (15 playable levels) for **Bê Kính Pha Lê** (`cabin_bridge`, `sky_scaffold`, `candy_factory`), and 3-level Lobby/HUD/Result UI.

**Architecture:** Extend `src/coop/maps/registry.ts` with 3-level metadata (`Action → MapPack → Level 1..5`) and `CoopStageKey` (`"actionId:mapPackId:level"`), migrate profile records cleanly into `coopLevelRecords` (`54★` total across 18 playable levels), add 4 lightweight physics primitives to `src/glass/sim/physics.ts` (conveyor belts, fragile platforms, `Y` elevators, `Y` pistons), build 15 handcrafted themed courses in `src/glass/sim/levels.ts`, sync `{ selectedMap, selectedMapPack, selectedLevel, hostUnlockedByPack }` in `useGlassRoom.ts`, render dynamic themes/hazards in `GlassCourseMesh.tsx` + `GlassScene.tsx`, and upgrade `GlassLobby`, `GlassHud`, `GlassResultModal`, `GlassCarryScreen`, and `ModeSelectScreen`.

**Tech Stack:** React 19, TypeScript 5.8 (`strict: true`, `allowImportingTsExtensions: true`), Vite 6, Tailwind CSS v4, Three.js / `@react-three/fiber` v9 / `@react-three/drei` v10, `@supabase/supabase-js` v2, Node v24 `node --test --experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-11-27-coop-3level-glass-levels-design.md`

## Global Constraints

- **No new npm dependencies.**
- **Zero regression on existing 97 unit tests** (keep `GLASS_COURSE`, `CoopMapId`, `COOP_MAPS`, `settleGlassCarryMatch`, and `EventRoomScreen` `GlassScene` usage 100% backward-compatible).
- **Explicit `.ts` extensions** on all relative imports inside `src/coop/maps/`, `src/glass/sim/`, `src/glass/online/`, and `src/store/` so `node --test --experimental-strip-types` runs cleanly alongside Vite.
- **Right-handed `+Z` coordinates:** `A/Left → +X`, `D/Right → -X`, `W/Up → +Z`; glass clearances `lowGap minY = 0.95`, `highWall maxY = 1.25`, diagonal gate (`Q` at `0.40m` + `E` at `1.80m` → `|ΔhandY| = 1.40m < 1.80m`).
- **60Hz ref / 15Hz network / 10Hz HUD discipline:** Keep all 60Hz transforms and fragile platform animations in mutable refs (`useFrame`), dispose manually allocated Three.js textures/geometries/materials on unmount, keep `GlassCourseMesh` keyed by stage so textures rebuild cleanly on theme switch.
- **Strict TypeScript:** Zero `any`, zero `@ts-ignore`, zero unused locals/parameters (`npm run build` must exit 0).
- **Safety:** Do not commit, push, tag, or deploy automatically.

---

### Task 1: 3-Level Co-op Registry & Multi-Level Profile Persistence

**Files:**
- Modify: `src/coop/maps/registry.ts`
- Modify: `src/coop/maps/__tests__/registry.test.ts`
- Modify: `src/store/profileSchema.ts`
- Modify: `src/store/profileStore.ts`
- Modify: `src/store/__tests__/profileStore.test.ts`

**Interfaces:**
- Produces in `src/coop/maps/registry.ts`:
  - `export type CoopActionId = CoopMapId` (alias preserving full backward compatibility)
  - `export type CoopLevelNumber = 1 | 2 | 3 | 4 | 5`
  - `export type CoopDifficultyId = 'easy' | 'medium' | 'hard' | 'very_hard' | 'extreme'`
  - `export interface CoopLevelMeta { readonly level: CoopLevelNumber; readonly key: string; readonly title: string; readonly difficulty: CoopDifficultyId; readonly difficultyLabel: string; readonly difficultyColorHex: string; readonly finishZ: number; readonly stageCount: number; readonly comingSoon?: boolean; readonly starThresholds: { readonly three: { readonly maxElapsedSec: number; readonly maxFailures: number }; readonly two: { readonly maxElapsedSec: number; readonly maxFailures: number } } }`
  - `export interface CoopMapPackMeta { readonly id: string; readonly actionId: CoopMapId; readonly order: number; readonly title: string; readonly shortTitle: string; readonly tagline: string; readonly accentHex: string; readonly levels: readonly CoopLevelMeta[] }`
  - `CoopMapMeta` gains `readonly maps: readonly CoopMapPackMeta[]` (with `glass_carry` having 3 Map Packs × 5 playable levels = 15 playable levels; `raft_rapids`, `rope_tether`, `minecart_rails` each having 1 Map Pack × [Level 1 playable, Levels 2–5 `comingSoon: true`]).
  - `MAX_COOP_STARS` dynamically computed from all non-`comingSoon` levels × 3 (`= 54`).
  - Helpers: `makeCoopStageKey(actionId, mapPackId, level)`, `makeCoopPackKey(actionId, mapPackId)`, `getDefaultMapPackId(actionId)`, `getCoopMapPack(actionId, mapPackId?)`, `getCoopLevelMeta(actionId, mapPackId?, level?)`, `getUnlockedLevelForPack(levelRecords, actionId, mapPackId)`, `isCoopLevelUnlocked(levelRecords, actionId, mapPackId, level)`, `getNextPlayableCoopStage(actionId, mapPackId, level)`, `calculateCoopLevelResult(actionId, mapPackId, level, elapsedSec, failures)`, `countCoopActionStars(levelRecords, actionId)`, `countCoopPackStars(levelRecords, actionId, mapPackId)`, `countTotalCoopLevelStars(levelRecords)`.
- Produces in `src/store/profileSchema.ts` & `profileStore.ts`:
  - `PlayerProfile.coopLevelRecords: Record<string, CoopMapRecord>` (sanitized for valid playable stage keys, auto-migrated from legacy `coopRecords` & `glassBest*` into `:1`, keeping `coopRecords` and `glassBest*` synced backward!).
  - `settleCoopMatch` accepts optional `mapPackId?: string` and `level?: number`, returning `{ ...existingFields, mapPackId, level, stageKey, unlockedNextLevel: CoopLevelNumber | null }`.
  - `recordCoopMatchResult` updated with optional `mapPackId` & `level`.

- [ ] **Step 1: Add failing tests in `registry.test.ts` and `profileStore.test.ts`**
- [ ] **Step 2: Run tests to verify RED**
- [ ] **Step 3: Implement 3-level `registry.ts` and `profileSchema.ts`/`profileStore.ts` persistence + migration**
- [ ] **Step 4: Run `node --test --experimental-strip-types src/coop/maps/__tests__/registry.test.ts src/store/__tests__/profileStore.test.ts` and `npx tsc --noEmit` to verify GREEN**

---

### Task 2: Glass Physics Extensions (Conveyors, Fragile Platforms, Y Elevators, Y Pistons, Diagonal Tilt)

**Files:**
- Modify: `src/glass/sim/types.ts`
- Modify: `src/glass/sim/course.ts`
- Modify: `src/glass/sim/physics.ts`
- Modify: `src/glass/sim/__tests__/physics.test.ts`

**Interfaces:**
- `GlassMapTheme` type added to `types.ts` (optional `theme?: GlassMapTheme` on `CourseDef`).
- `PlatformDef` gains optional `conveyorVx?: number`, `conveyorVz?: number`, `fragile?: { fallDelaySec: number; respawnDelaySec: number }`.
- `MovingPlatformDef.axis` expanded to `'x' | 'y' | 'z'`; `EvaluatedPlatform` gains optional `vy?: number`, `conveyorVx?: number`, `conveyorVz?: number`, `fragile?: { fallDelaySec: number; respawnDelaySec: number }`.
- `BarrierDef.moveAxis` expanded to `'x' | 'y' | 'z'`.
- `FragilePlatformState = { state: 'solid' | 'shaking' | 'gone'; timer: number }` added to `GlassSimState` (`fragileStates: Record<string, FragilePlatformState>`).
- In `stepGlassSim`:
  - Applies `plat.vy * dt` when standing on a vertical elevator platform (and tracks vertical landing cleanly).
  - Applies `plat.conveyorVx * dt` and `plat.conveyorVz * dt` when standing on a conveyor platform.
  - Updates `fragileStates`: standing on a `'solid'` fragile platform starts `'shaking'` (`timer = fallDelaySec`), transitions to `'gone'` (`timer = respawnDelaySec`, excluded from floor landing so players fall!), then respawns to `'solid'`; checkpoint respawn resets all `fragileStates` to `'solid'`.

- [ ] **Step 1: Add failing tests in `src/glass/sim/__tests__/physics.test.ts`** covering conveyor push, fragile platform shake→fall→respawn & reset on checkpoint, `Y` elevator lift, `Y` piston barrier, and diagonal tilt gate (`Q` + `E` clears with `hp === 3`, flat neutral cracks!).
- [ ] **Step 2: Run test to verify RED**
- [ ] **Step 3: Implement extensions in `types.ts`, `course.ts`, and `physics.ts`**
- [ ] **Step 4: Run all `src/glass/sim/__tests__/*` tests and `npx tsc --noEmit` to verify GREEN**

---

### Task 3: 15 Handcrafted Glass Carry Courses (`3 Maps × 5 Levels` + 3 Visual Themes)

**Files:**
- Create: `src/glass/sim/levels.ts`
- Test: `src/glass/sim/__tests__/levels.test.ts`

**Interfaces:**
- Produces in `src/glass/sim/levels.ts`:
  - `GLASS_MAP_THEMES: Record<'cabin_bridge' | 'sky_scaffold' | 'candy_factory', GlassMapTheme>`
  - `GLASS_LEVEL_COURSES: Record<string, CourseDef>` (all 15 courses keyed by `"cabin_bridge:1..5"`, `"sky_scaffold:1..5"`, `"candy_factory:1..5"`)
  - `getGlassCourseForStage(mapPackId: string, level: number): CourseDef` (falls back safely to `cabin_bridge:1`)

- [ ] **Step 1: Write comprehensive failing tests in `src/glass/sim/__tests__/levels.test.ts`** verifying ALL 15 courses:
  - Exact `finishZ`, stage count (`2/3/3/4/5`), checkpoint count, and unique theme per Map Pack.
  - Every checkpoint spawn rests on a solid non-fragile floor platform at safe `3.2m` separation.
  - All `lowGap` (`minY >= 0.95`), `highWall` (`maxY <= 1.25`), and diagonal gates have valid clearances.
  - Map 2 (`sky_scaffold`) levels include `fragile` platforms, `axis: 'y'` elevators, and overhead crane spinners (`y >= 1.5`); Map 3 (`candy_factory`) levels include conveyors, `moveAxis: 'y'` pistons, and diagonal tilt gates.
  - All 15 courses initialize cleanly with `createInitialSimState(course)` and advance without NaN/errors via `stepGlassSim`.
- [ ] **Step 2: Run test to verify RED**
- [ ] **Step 3: Implement `src/glass/sim/levels.ts` with all 15 handcrafted courses & 3 visual themes**
- [ ] **Step 4: Run `node --test --experimental-strip-types src/glass/sim/__tests__/levels.test.ts` and `npx tsc --noEmit` to verify GREEN**

---

### Task 4: Online Protocol & `useGlassRoom` 3-Level Selection + Live Host Unlock Sync

**Files:**
- Modify: `src/glass/online/protocol.ts`
- Modify: `src/glass/online/snapshotInterpolation.ts`
- Modify: `src/glass/online/useGlassRoom.ts`

**Interfaces:**
- `GlassSnapshotPayload` gains optional `fragileStates?: Record<string, { s: 0 | 1 | 2; t: number }>` (packed by `packSimSnapshot` when non-empty; preserved from upper snapshot in `SnapshotInterpolator`).
- `CoopSelectMapPayload` gains `mapPackId?: string; level?: CoopLevelNumber`.
- `GlassStartPayload`, `GlassFinishPayload`, `GlassSyncStatePayload`, `GlassRoomMember` gain optional `mapPackId`, `level`, and (on `GlassRoomMember`) `unlockedByPack?: Record<string, number>`.
- `GlassRoomController` gains:
  - `selectedMapPack: string`
  - `selectedLevel: CoopLevelNumber`
  - `hostUnlockedByPack: Record<string, number>` (derived live from Host Presence or local profile when Host)
  - `selectStage(actionId: CoopMapId, mapPackId: string, level: CoopLevelNumber): void`
  - `syncHostUnlocks(unlockedByPack: Record<string, number>): void` (updates Host Presence immediately when Host unlocks a new level!)
  - `finalResult` gains `mapPackId: string; level: CoopLevelNumber`.
  - `startNextMap()` advances smartly via `getNextPlayableCoopStage(selectedMap, selectedMapPack, selectedLevel)` (unlocking next level seamlessly!).

- [ ] **Step 1: Update `protocol.ts`, `snapshotInterpolation.ts`, and `useGlassRoom.ts`**
- [ ] **Step 2: Run `node --test --experimental-strip-types src/glass/online/__tests__/snapshotInterpolation.test.ts src/coop/online/__tests__/coopInterpolation.test.ts` and `npx tsc --noEmit` to verify GREEN**

---

### Task 5: Theme-Aware 3D Rendering (`GlassCourseMesh.tsx`, `GlassScene.tsx`, `renderTypes.ts`)

**Files:**
- Modify: `src/glass/render/renderTypes.ts` (add optional `totalStages?: number`, `level?: number`, `mapPackTitle?: string` to `GlassHudSnapshot`, and `fragileStates` to `GlassRenderState`)
- Modify: `src/glass/render/GlassCourseMesh.tsx` (accept `course: CourseDef`, build procedural textures & palette from `course.theme`, render animated conveyor belt arrows, shaking/vanishing fragile platforms from `renderRef.current.fragileStates`, vertical elevators, vertical pistons, themed scenery props)
- Modify: `src/glass/render/GlassScene.tsx` (accept optional `course?: CourseDef` + `level?: number` + `mapPackTitle?: string`, pass `course` to `createInitialSimState`, `stepGlassSim`, `getStageNumberForZ`, and `<GlassCourseMesh key={courseKey} course={course} renderRef={renderRef} />`, apply `course.theme` sky/fog/lighting, populate `totalStages` in HUD snapshot, preserve Event Cup compatibility when `course` is omitted!)

- [ ] **Step 1: Update `renderTypes.ts`, `GlassCourseMesh.tsx`, and `GlassScene.tsx`**
- [ ] **Step 2: Run `npx tsc --noEmit` to verify 0 errors**

---

### Task 6: 3-Level Lobby UI, Dynamic HUD, Unlock-Aware Result Modal, `GlassCarryScreen` & `ModeSelectScreen`

**Files:**
- Modify: `src/glass/ui/GlassLobby.tsx` (3-tier selector: **4 Kiểu Hành Động Hợp Tác** → **Chọn Map** → **5 Màn Dễ đến Siêu Khó** with `🔒` lock badges based on `hostUnlockedByPack` / local unlocks + *Sắp ra mắt* for unreleased levels of Actions 2–4; Star counts per Action `X/45★`, per Map `X/15★`, and total `X/54★`)
- Modify: `src/glass/ui/GlassHud.tsx` (show `Màn X` pill, dynamic stage progress pills `1..hud.totalStages`)
- Modify: `src/glass/ui/GlassResultModal.tsx` (show Action + Map + Level, **"🔓 Đã Mở Khóa Màn X+1!"** celebration banner when `settlement?.unlockedNextLevel`, smart **Màn Tiếp Theo** / **Map Tiếp Theo** button)
- Modify: `src/screens/GlassCarryScreen.tsx` (resolve `activeGlassCourse = getGlassCourseForStage(room.selectedMapPack, room.selectedLevel)`, sync Host unlocks via `useEffect` whenever `coopLevelRecords` updates, pass `mapPackId` & `level` to `recordCoopMatchResult`)
- Modify: `src/screens/ModeSelectScreen.tsx` (update 4th card to `4 Kiểu Hợp Tác · 18 Màn` and `${countTotalCoopLevelStars(coopLevelRecords)} / ${MAX_COOP_STARS}★`)

- [ ] **Step 1: Upgrade `GlassLobby.tsx`, `GlassHud.tsx`, `GlassResultModal.tsx`, `GlassCarryScreen.tsx`, `ModeSelectScreen.tsx`**
- [ ] **Step 2: Run `npm run build` (`tsc --noEmit && vite build`) to verify exit code 0**

---

### Task 7: Full Automated Test Suite, Build & Live Browser Smoke Check

**Files:**
- None (verification only; fix any bugs uncovered)

- [ ] **Step 1: Run ALL unit tests across `src/coop/`, `src/glass/`, and `src/store/`**
- [ ] **Step 2: Run `npm run build` and verify exit code 0**
- [ ] **Step 3: Start Vite dev server and run browser subagent smoke check:**
  - Verify `ModeSelectScreen` 4th card (`4 Kiểu Hợp Tác · 18 Màn`, `0 / 54★`).
  - Enter Lobby, create a room, verify 3-tier selector (`4 Kiểu Hành Động` → `3 Map Bê Kính`: Cầu Gỗ Cabin / Công Trường Cao Ốc / Xưởng Kẹo Băng Chuyền → `5 Màn` với Màn 1 mở & Màn 2–5 khóa `🔒`).
  - Switch between the 3 Glass Maps and verify 5 levels & Start button text update cleanly; switch to `Chèo Phao` / `Dây Thừng` / `Xe Goòng` and verify Màn 1 open + Màn 2–5 *Sắp ra mắt*, 0 console errors.
  - Stop dev server cleanly.
