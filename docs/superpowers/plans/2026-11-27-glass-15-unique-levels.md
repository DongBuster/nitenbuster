# Glass Carry 15 Unique Levels Implementation Plan

> **For agentic workers:** Implement task-by-task with strict TDD and full verification before moving to the next task. Do NOT run `git commit` or `git push`.

**Goal:** Redesign all 15 Glass Carry courses (`3 Map Packs × 5 Levels`), add 15 distinct per-level atmosphere/time-of-day themes, upgrade camera lateral tracking, and anchor 3D checkpoints, finishes, hazards, and side props dynamically to curved, multi-tier, and split-rail track geometry.

**Architecture:** Preserve deterministic `physics.ts` and online Supabase protocol untouched. Add optional `biome` on `GlassMapTheme` so 15 unique level themes retain biome texture/prop motifs while looking distinctly lit and colored. Make `GlassCamera` and `GlassCourseMesh` contour-aware so Twin-Rail parallel bridges, 90° L-turns, wide S-curves, `axis: 'z'` ferries, and `moveAxis: 'x'` sliding doors look and play seamlessly.

**Tech Stack:** React 19, TypeScript 5.8 strict, Three.js / `@react-three/fiber` v9, Node v24 built-in `node --test --experimental-strip-types`, Vite 6.

**Spec:** [2026-11-27-glass-15-unique-levels-design.md](file:///d:/Codes/LandingPageFunny/paws-game/docs/superpowers/specs/2026-11-27-glass-15-unique-levels-design.md)

## Global Constraints
- No new npm packages.
- Do NOT modify `src/survival/`, `src/engine/`, or `src/brawl/`.
- Pure TS files imported by Node test runner MUST keep `.ts` extensions on relative imports.
- Strictly NO `git commit`, `git push`, `git tag`, or deploy commands without explicit user confirmation.

---

### Task 1: Theme Biome Support (`types.ts`) & Lateral Curve Camera Tracking (`GlassCamera.tsx`)

**Files:**
- Modify: `src/glass/sim/types.ts`
- Modify: `src/glass/render/GlassCamera.tsx`
- Modify: `src/glass/render/GlassScene.tsx`

- [ ] **Step 1: Update `GlassMapTheme` in `src/glass/sim/types.ts`**
  Add `export type GlassBiomeId = 'cabin_bridge' | 'sky_scaffold' | 'candy_factory';` and set `GlassMapTheme.id: string`, `readonly biome?: GlassBiomeId;` so each level can define a unique theme ID (`'cabin_1'..'candy_5'`) while specifying its biome family (`cabin_bridge`, `sky_scaffold`, `candy_factory`).
- [ ] **Step 2: Upgrade `GlassCamera.tsx` horizontal tracking**
  Increase `desiredPos.x` to `midX * 0.88` and `desiredLook.x` to `midX * 0.94`, and smooth `spanZoom` up to `5.5` so split twin-rails (`3.4–4.0m` separation) and wide S/L turns (`x = -10..+10`) stay centered and crisp.
- [ ] **Step 3: Check `GlassScene.tsx` `GlassCourseMesh` key**
  Use `key={`${theme.id}-${level ?? 1}-${activeCourse.finishZ}`}` cleanly and apply `theme.skyHex`, `theme.fogHex`, `theme.ambientLightHex`, `theme.sunLightHex`, `theme.abyssHex`.
- [ ] **Step 4: Run typecheck**
  Run `npx tsc --noEmit` and confirm 0 errors.

---

### Task 2: Contour-Aware 3D Course Rendering (`GlassCourseMesh.tsx`)

**Files:**
- Modify: `src/glass/render/GlassCourseMesh.tsx`

- [ ] **Step 1: Resolve biome cleanly in `GlassCourseMesh.tsx`**
  Compute `biome = resolveThemeBiome(theme)` (`theme.biome ?? (theme.id is sky_scaffold/candy_factory ? ... : 'cabin_bridge')`) and pass `biome` instead of `theme.id` into texture motifs, barrier colors, pendulum hammer materials, and `SideSceneryProp`.
- [ ] **Step 2: Dynamic deck-top lookup & sideways `90°` barrier visual support**
  - Add helper `getUnderlyingDeckTopY(platforms, cx, cz, maxY)` using static + moving platform baseBoxes so `lowGap`, `highWall`, `moveAxis: 'y'` target strips, and `Pendulum` gantry legs sit flush on elevated decks (`y > 0`) rather than extending down to `y = 0`.
  - In `BarrierVisual` (`lowGap` & `highWall`), inspect `d > w` so hurdles rotated 90° across lateral `+X`/`-X` bridges place support posts along `Z` (`cz ± (d * 0.5 - 0.12)`) rather than clipping across the skinny side.
- [ ] **Step 3: Dynamic Checkpoint Arches, Finish Arch & Contouring Side Scenery**
  - Anchor each checkpoint arch at `(cpMidX, cp.p1Spawn.y, cp.triggerZ)` and size `archSpan` dynamically from platforms covering `cp.triggerZ` (fallback `8.2m`), keeping lanterns & threshold strip spanning both split rails when present.
  - Anchor the finish arch at `(finishCenterX, finishY, course.finishZ)` and size `finishSpan` dynamically from platform width under `course.finishZ`.
  - For `sidePropPositions`, compute `[minTrackX, maxTrackX]` across nearby static/moving platforms in `[z - 7, z + 7]` so left/right props hug curved tracks outside `[minTrackX - 6.0, maxTrackX + 6.0]` without ever clipping decks.
- [ ] **Step 4: Run `npx tsc --noEmit`** and verify 0 errors.

---

### Task 3: 15 Distinct Level Themes, 15 Signature Courses (`levels.ts`), Metadata (`registry.ts`), and Verification Tests (`levels.test.ts`)

**Files:**
- Modify: `src/glass/sim/levels.ts`
- Modify: `src/coop/maps/registry.ts`
- Modify: `src/glass/sim/__tests__/levels.test.ts`

- [ ] **Step 1: Expand `src/glass/sim/__tests__/levels.test.ts` (TDD red phase first)**
  Add tests verifying:
  1. All 15 themes are unique (`new Set(themes.map(t => `${t.skyHex}|${t.fogHex}|${t.deckPrimaryHex}`)).size === 15`).
  2. Structural diversity across levels:
     - Twin-rail split bridges exist (two parallel disjoint X platforms overlapping in Z with `>= 1.5m` center abyss gap).
     - Lateral S/L excursions reach beyond `|x| >= 7.0`.
     - Elevation climbs reach `topY >= 3.4`.
     - Longitudinal `axis: 'z'` ferries exist (`>= 2` levels).
     - Lateral sliding `moveAxis: 'x'` barriers exist (`>= 2` levels).
     - Counter-directional dual conveyors (`conveyorVz > 0` beside `conveyorVz < 0`) exist (`CANDY_2`, `CANDY_5`).
     - Vertical out-of-phase split elevators (`0 < Δphase < 1.2`) keep hand height delta safely `< 1.4m` (`< MAX_HAND_DY = 1.8`).
  3. Every checkpoint `(p1Spawn, p2Spawn)` in all 15 courses rests directly on an active platform at `t = 0` (`|spawn.y - plat.box.maxY| < 0.01`, X/Z interior margin `>= 0.45m`, safe initial glass length `[2.5, 3.9]`).
  4. `registry.ts` metadata (`finishZ`, `stageCount`) matches every course in `GLASS_LEVEL_COURSES`.
- [ ] **Step 2: Run test to verify failures against old `levels.ts`**
  Run `node --experimental-strip-types --test src/glass/sim/__tests__/levels.test.ts` and confirm new invariants fail on the old uniform straight courses.
- [ ] **Step 3: Implement `GLASS_LEVEL_THEMES` + 15 Signature Courses in `src/glass/sim/levels.ts` and sync `registry.ts`**
  Build all 15 courses with clear helpers (`twinRail`, `sideLowGap`, `sideHighWall`, `longitudinalFerry`, `slidingGateX`, `conveyorBelt`, etc.) matching the exact design spec, and update titles/`finishZ`/`stageCount`/par times in `COOP_MAPS` inside `src/coop/maps/registry.ts`.
- [ ] **Step 4: Run unit tests & verify all pass**
  Run `node --experimental-strip-types --test src/glass/sim/__tests__/levels.test.ts src/coop/maps/__tests__/registry.test.ts src/glass/sim/__tests__/physics.test.ts` -> expect 100% pass.

---

### Task 4: Full Automated Verification, Build & Browser Visual Inspection

- [ ] **Step 1: Run complete workspace test suite** (`src/**/*.test.ts` via `node --experimental-strip-types --test`).
- [ ] **Step 2: Run `npm run build` (`tsc --noEmit && vite build`)** and verify exit code `0`.
- [ ] **Step 3: Inspect Lobby & Live Level Preview/Rendering** (start Vite dev server, verify updated level names/specs in `GlassLobby` and clean 0-error console; clean up daemon server before reporting).
