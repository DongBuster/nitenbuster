# Party Animals Hybrid Spring-Physics & Moveset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Brawl Arena character movement, physics feel, and combat moveset to a Party Animals–style hybrid spring-physics system (momentum wobble, floppy inertial limbs, tumble KO/wakeup, alternating punches, headbutt, airborne dropkick, and springy grab-and-throw).

**Architecture:** Introduce a pure, deterministic spring-damper and action-pose module (`src/brawl/sim/partyMotion.ts`) stepped per fighter inside `BrawlWorldRuntime`. Expose each fighter's live `PartyMotionState` ref to all 8 procedural animals via a zero-rerender React Context (`BrawlMotionContext`) inside `CharacterRig3D.tsx`, so every animal gains Party Animals limb choreography (arm swings, grab reach, flailing arms, inertial head/ear/tail lag, squash-and-stretch) without duplicating code across animal files.

**Tech Stack:** React 19, TypeScript 5.8, `@react-three/fiber`, `@react-three/rapier` 2.2, Three.js, Node `node:test`.

## Global Constraints
- Keep `npm run typecheck` (`tsc --noEmit`) and `npm run build` green.
- Zero new npm dependencies.
- Zero per-frame React state updates in `useFrame`; all 60fps spring/motion state lives in mutable refs.
- Preserve all existing Brawl Arena mechanics (hex tile collapse, items, PAWS cards, bots, 3-round scoring).
- Never run `git commit`, `git push`, or deploy commands without explicit user confirmation.

---

## File Structure

- **Create:** `src/brawl/sim/partyMotion.ts` — Pure spring-damper solver, `PartyMotionState` factory, and per-frame `stepPartyMotion()` updater.
- **Create:** `src/brawl/sim/__tests__/partyMotion.test.ts` — Unit tests for spring convergence, landing squash, acceleration tilt, and action state priority.
- **Modify:** `src/brawl/sim/types.ts` — Add `sprint`, `headbutt` to `FighterInput`; add `headbuttCooldownUntil`, `dropkickCooldownUntil` to `FighterStatus`.
- **Modify:** `src/brawl/sim/constants.ts` — Add Sprint, Headbutt, Dropkick, Punch Lunge, and Wakeup tuning constants.
- **Modify:** `src/brawl/sim/combat.ts` — Initialize new cooldown fields in `createInitialFighterStatus()`.
- **Modify:** `src/brawl/input/useKeyboardMouse.ts` — Bind `Shift` (sprint) and `KeyE` / Right-Click (headbutt, preventing context menu on canvas).
- **Modify:** `src/brawl/sim/botBrain.ts` — Support `sprint` and `headbutt` inputs in bot AI; trigger airborne dropkick and occasional headbutt on medium/hard.
- **Modify:** `src/brawl/render/worldRuntime.ts` — Wire sprint momentum, punch lunge + alternating hands, airborne dropkick + belly slide, headbutt lunge, springy grab swing, wakeup timer, and `stepPartyMotion()` per fighter.
- **Modify:** `src/scene3d/CharacterRig3D.tsx` — Export `BrawlMotionContext` and layer Party Animals limb choreography + secondary inertial lag inside `useAnimalMotion()`.
- **Modify:** `src/brawl/render/FighterActor.tsx` — Provide `BrawlMotionContext` and apply spring tilt, squash-and-stretch, dropkick horizontal pitch, headbutt pitch, and wakeup scramble on `visualRef`.
- **Modify:** `src/brawl/ui/BrawlHud.tsx` — Update controls cheat-sheet and bottom hint bar with Sprint, Dropkick, and Headbutt.

---

### Task 1: Pure Spring-Damper & Party Motion Module (`partyMotion.ts`)

**Files:**
- Create: `src/brawl/sim/partyMotion.ts`
- Test: `src/brawl/sim/__tests__/partyMotion.test.ts`

**Interfaces:**
- Produces:
  - `PartyActionKind` union type
  - `Spring1D` interface & `stepSpring(spring: Spring1D, target: number, stiffness: number, damping: number, dt: number): number`
  - `PartyMotionState` interface & `createPartyMotionState(): PartyMotionState`
  - `PartyMotionFrameInput` interface & `stepPartyMotion(state: PartyMotionState, input: PartyMotionFrameInput, dt: number): void`

- [ ] **Step 1: Write failing unit tests in `src/brawl/sim/__tests__/partyMotion.test.ts`**
  - Verify `stepSpring` converges smoothly to target without NaN/divergence even on large `dt` (clamped).
  - Verify `stepPartyMotion` tilts body forward when accelerating, compresses `squashY` on hard landing, and prioritizes `stunned` > `grabbed` > `dropkick` > `headbutt` > `punch_left/right` > `grab_hold` > `run` > `idle`.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `node --experimental-strip-types --test src/brawl/sim/__tests__/partyMotion.test.ts`
- [ ] **Step 3: Implement `src/brawl/sim/partyMotion.ts`**
- [ ] **Step 4: Re-run tests to verify they pass**

---

### Task 2: Input, Constants, Types, Combat Defaults & Bot AI

**Files:**
- Modify: `src/brawl/sim/types.ts`
- Modify: `src/brawl/sim/constants.ts`
- Modify: `src/brawl/sim/combat.ts`
- Modify: `src/brawl/input/useKeyboardMouse.ts`
- Modify: `src/brawl/sim/botBrain.ts`

- [ ] **Step 1:** Add `sprint: boolean` and `headbutt: boolean` to `FighterInput`; add `headbuttCooldownUntil` and `dropkickCooldownUntil` to `FighterStatus`.
- [ ] **Step 2:** Add tuning constants (`SPRINT_MULTIPLIER`, `PUNCH_LUNGE_SPEED`, `HEADBUTT_*`, `DROPKICK_*`, `WAKEUP_ANIM_SEC`) in `constants.ts` and initialize cooldowns in `createInitialFighterStatus`.
- [ ] **Step 3:** Update `useKeyboardMouse.ts` for `ShiftLeft`/`ShiftRight` (sprint) and `KeyE`/Right-Click (headbutt) with `contextmenu` suppression while active.
- [ ] **Step 4:** Update `botBrain.ts` so all returned `FighterInput` objects include `sprint` and `headbutt`, and medium/hard bots use sprint when escaping/chasing and headbutt in close quarters.
- [ ] **Step 5:** Run `npm run typecheck`.

---

### Task 3: World Runtime Physics & Party Animals Moveset (`worldRuntime.ts`)

**Files:**
- Modify: `src/brawl/render/worldRuntime.ts`

- [ ] **Step 1:** Extend `FighterRuntime` with `partyMotion: PartyMotionState`, `prevVelX`, `prevVelZ`, `wasGrounded`, `punchHand: 'left' | 'right'`, `headbuttUntil`, `dropkickUntil`, `dropkickSlideUntil`, `dropkickHitIds: Set<string>`, `wakeupUntil`, `prevYaw`.
- [ ] **Step 2:** Implement **Sprint & Momentum Skid** (higher top speed with `Shift`, slightly looser traction for funny Party Animals slides).
- [ ] **Step 3:** Implement **Alternating Punch Lunge** (toggles `punchHand`, adds subtle forward impulse on swing).
- [ ] **Step 4:** Implement **Airborne Dropkick** (pressing Punch while `!grounded` and not holding ranged item launches horizontal dropkick with continuous cone hit check and belly-slide on landing).
- [ ] **Step 5:** Implement **Headbutt** (`KeyE` / Right-Click lunges forward with high knockback & balance damage).
- [ ] **Step 6:** Enhance **Grab & Throw** with angular swing momentum (spinning while holding whips the grabbed fighter out wider and adds spin velocity on release).
- [ ] **Step 7:** Track `wakeupUntil` on stun exit and call `stepPartyMotion()` every frame per fighter.
- [ ] **Step 8:** Run `npm run typecheck`.

---

### Task 4: Rig Limb Choreography & Visual Physics (`CharacterRig3D.tsx`, `FighterActor.tsx`, `BrawlHud.tsx`)

**Files:**
- Modify: `src/scene3d/CharacterRig3D.tsx`
- Modify: `src/brawl/render/FighterActor.tsx`
- Modify: `src/brawl/ui/BrawlHud.tsx`

- [ ] **Step 1:** Export `BrawlMotionContext` in `CharacterRig3D.tsx` and blend `PartyMotionState` inside `useAnimalMotion()` (arm pumping when running/sprinting, left/right punch swing + torso twist, headbutt dip + swept arms, grab reach, flailing limbs when grabbed/stunned/airborne, secondary head/ear/tail inertial lag, squash-and-stretch).
- [ ] **Step 2:** Wrap `<Character3D />` in `<BrawlMotionContext.Provider>` in `FighterActor.tsx`, and drive `visualRef` pitch/roll/scale from `partyMotion` (smooth spring lean, horizontal dropkick + belly slide, headbutt lunge, wakeup scramble).
- [ ] **Step 3:** Update `BrawlHud.tsx` help modal and bottom control hints to list `Shift` (Chạy nhanh), `J / Chuột trái` (Đấm / Trên không: Đá bay), and `E / Chuột phải` (Húc đầu).
- [ ] **Step 4:** Run full verification: unit tests (`node --experimental-strip-types --test`), `npm run typecheck`, and `npm run build`.
