# PAWS Survival 2D Depth v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement level-up HP recovery (15% Max HP, min 15 HP), expand the skill pool from 24 to 32 skills (8 Core + 8 Map-Exclusive per campaign map), add crisp Canvas2D animations + live HUD cooldown gauges for all secondary skills across Offline & Online Co-op, and surface a clear Wave/Boss Scenario across both the Lobby and in-game HUD.

**Architecture:** Extend `types.ts`, `maps.ts`, and `catalog.ts` cleanly as the single source of truth; emit lightweight `VisualFxEntity` pulses and `secondaryCooldowns` in `engine.ts` (`buildHudSnapshot` & `SurvivalWorldState`); sync both compactly inside `online/protocol.ts` + `snapshotInterpolation.ts` + `SurvivalCanvas.tsx` under the 25 KB wire limit; render custom Canvas2D effects (`canvasRenderer.ts`) and handcrafted SVGs (`SurvivalIcons.tsx`); and expose structured secondary trays, campaign progress steppers, chapter banners, and lobby map scenario modals in UI components.

**Tech Stack:** TypeScript (`strict`, explicit `.ts`/`.tsx` extensions in pure `.ts` files), React 19, HTML5 Canvas2D, Tailwind CSS v4, Node native `--experimental-strip-types --test`, Vite 6.

**Spec:** [2026-11-28-survival-depth-v2-design.md](file:///d:/Codes/LandingPageFunny/paws-game/docs/superpowers/specs/2026-11-28-survival-depth-v2-design.md)

## Global Constraints

- **Git Safety:** NEVER run `git commit`, `git push`, `git tag`, merge, or deploy commands without explicit user confirmation.
- **Unrelated Files:** Do NOT touch or revert unrelated workspace changes outside `src/survival/` and `docs/superpowers/`.
- **TypeScript Strictness:** `npm run typecheck` (`tsc --noEmit` with `noUnusedLocals` and `noUnusedParameters`) must pass cleanly; pure `.ts` imports must retain explicit `.ts` file extensions.
- **Player-Friendly Copy:** Zero FE/math jargon in Vietnamese skill/weapon/gear copy (`/\bpx\b|\bAOE\b|±|°|cấp×|HP\/s|\bMax HP\b/i` must not match).
- **Wire Cap:** Online Co-op `encodeSnapshotWire` worst-case full packet must remain strictly `< 25 KB` (`< 25600` UTF-8 bytes) and round-trip cleanly through `decodeSnapshotWire` and `SurvivalSnapshotInterpolator`.
- **No New Dependencies:** Use zero external packages (inline SVGs in `SurvivalIcons.tsx`, Lucide icons already installed, pure Canvas2D drawing).

---

### Task 1: Core Types, Map Scenario Registry & 32-Skill Catalog Expansion

**Files:**
- Modify: `src/survival/sim/types.ts`
- Modify: `src/survival/sim/maps.ts`
- Modify: `src/survival/sim/catalog.ts`
- Test: `src/survival/sim/__tests__/catalogAndMaps.test.ts`

**Interfaces:**
- Produces:
  - Extended `SkillId` union with 8 new skills (`'whirlwind_blade' | 'vital_regen' | 'glacial_spear' | 'blizzard_ward' | 'popcorn_barrage' | 'honey_shield' | 'laser_turret' | 'prism_focus'`) -> 32 total (`8 core + 8 winter_cabin + 8 candy_canyon + 8 crystal_cavern`).
  - `VisualFxKind`, `VisualFxEntity`, `SkillCooldownState`, `ScenarioChapterMeta`, `MapScenarioMeta`.
  - Extended `DerivedPlayerStats` with `hpRegenPerSec`, `whirlwindBladeLevel`, `vitalRegenLevel`, `glacialSpearLevel`, `blizzardWardLevel`, `popcornBarrageLevel`, `honeyShieldLevel`, `laserTurretLevel`, `prismFocusLevel`.
  - Extended `PlayerEntity`, `SurvivalWorldState` (`visualEffects: VisualFxEntity[]`), `SurvivalPlayerSummary` (`secondaryCooldowns: Partial<Record<SkillId, SkillCooldownState>>`), `ProjectileEntity['weaponId']`.
  - `SurvivalMapMeta.scenario: MapScenarioMeta` in `maps.ts`.
  - `SKILL_TIMING_LABELS: Partial<Record<SkillId, string>>` and `getSkillTimingLabel(id: SkillId): string | null` in `catalog.ts`.

- [ ] **Step 1: Update & add failing tests in `src/survival/sim/__tests__/catalogAndMaps.test.ts`**

Update the skill-count and map-pool assertions (`24` -> `32`, `12` -> `16`, `6` -> `8`, update `almostMaxed` to include all 16 skills on `winter_cabin`), and add new test assertions for:
- `SKILLS.length === 32` (`8` core, `8` winter, `8` candy, `8` crystal, `12` secondary).
- Every map in `SURVIVAL_MAPS` defines `scenario.headline` and 3 non-empty `scenario.chapters` aligned with `bossRotation`.
- `computeDerivedStats` applies `vital_regen`, `blizzard_ward`, `prism_focus`, and rarity `skillPower` strict monotonicity across all 32 skills.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/survival/sim/__tests__/catalogAndMaps.test.ts`
Expected: FAIL because `SKILLS.length` is still 24 and `scenario` / new stats do not exist yet.

- [ ] **Step 3: Implement `types.ts`, `maps.ts`, and `catalog.ts`**

1. In `src/survival/sim/types.ts`:
   - Add the 8 new `SkillId` members.
   - Add `VisualFxKind`, `VisualFxEntity`, `SkillCooldownState`, `ScenarioChapterMeta`, `MapScenarioMeta`.
   - Extend `DerivedPlayerStats`, `SurvivalMapMeta` (`scenario`), `PlayerEntity` (timers `whirlwindBladeTimer`, `glacialSpearTimer`, `popcornBarrageTimer`, `laserTurretTimer`, `vitalRegenTimer`, `blizzardWardCooldown`, `honeyShieldCooldown`, `honeyShieldReady`), `ProjectileEntity['weaponId']`, `SurvivalWorldState.visualEffects`, and `SurvivalPlayerSummary.secondaryCooldowns`.
2. In `src/survival/sim/maps.ts`:
   - Update `endless_abyss` subtitle/mechanicSummary text from `24 kỹ năng` to `32 kỹ năng`.
   - Add cohesive `scenario: MapScenarioMeta` to all 4 `SURVIVAL_MAPS` entries matching `bossRotation` and campaign `[90, 210, 330]` timings.
3. In `src/survival/sim/catalog.ts`:
   - Append the 8 new `SkillSpec` definitions in their exact `mapScope` sections (`core`, `winter_cabin`, `candy_canyon`, `crystal_cavern`) with zero forbidden technical jargon tokens (`/\bpx\b|\bAOE\b|±|°|cấp×|HP\/s|\bMax HP\b/i`).
   - Add helper `getSkillTimingLabel(skillId: SkillId): string | null` for secondary skills (`'Quay liên tục quanh thân'` for `orbital_ice` / `warm_aura` / `plush_drone`, `'Tự kích hoạt theo nhịp'` / specific Vietnamese phrasing for timed active secondary skills).
   - Add all applicable new skills into `RARITY_EXCESS_SKILLS` and update `computeDerivedStats` with `hpRegenPerSec`, `blizzardWard` damage reduction (combined cap `0.65`), `prism_focus` crit chance/multiplier, and all 8 new skill levels.

- [ ] **Step 4: Run `catalogAndMaps.test.ts` and `npm run typecheck`**

Run: `node --experimental-strip-types --test src/survival/sim/__tests__/catalogAndMaps.test.ts && npm run typecheck`
Expected: TypeScript failures only in consumers not yet updated OR update defaults cleanly if Task 1 & 2 share `PlayerEntity`/`SurvivalWorldState` fields — note: check `engine.ts` & `protocol.ts` compilation during Task 1→2→3 integration; run `catalogAndMaps.test.ts` standalone immediately since Node strips types per module!

---

### Task 2: Engine Level-Up Heal, New Skill Execution, Secondary VFX Emission & Bot Weights

**Files:**
- Modify: `src/survival/sim/engine.ts`
- Modify: `src/survival/ai/botBrain.ts`
- Test: `src/survival/sim/__tests__/engine.test.ts`
- Test: `src/survival/sim/__tests__/botBrain.test.ts`

**Interfaces:**
- Consumes: `VisualFxKind`, `VisualFxEntity`, `SkillCooldownState`, new `DerivedPlayerStats` fields from Task 1.
- Produces:
  - Level-up 15% (min 15 HP) team heal for living players inside `triggerLevelUpIfReady`.
  - Helper `pushVisualFx(world, kind, x, y, radius, durationSec, endX?, endY?)` enforcing `MAX_VISUAL_EFFECTS = 24`.
  - Full execution for `whirlwind_blade`, `vital_regen`, `glacial_spear`, `blizzard_ward`, `popcorn_barrage`, `honey_shield`, `laser_turret`, `prism_focus`.
  - Visual FX emissions for existing `frost_nova`, `caramel_nova`, `void_pulse`, `candy_meteor` (`meteor_impact` on detonation), `crystal_shield` (`shield_break`), plus new skills.
  - Populated `secondaryCooldowns` in `toPlayerSummary(p)`.
  - Updated `BASE_SKILL_SCORE` & `SECONDARY_UNLOCK_SKILLS` in `botBrain.ts`.

- [ ] **Step 1: Add failing tests in `src/survival/sim/__tests__/engine.test.ts` and `botBrain.test.ts`**

Write tests verifying:
1. Level-up heals all living players by `Math.max(15, Math.round(maxHp * 0.15))` clamped to `maxHp`, skips downed teammates, and emits `'level_heal'` visual FX + `+XX` floating text.
2. All 8 new skills activate properly in isolated ticks (`whirlwind_blade` spawns boomerang projectile, `glacial_spear` slows & pierces, `popcorn_barrage` spawns bouncing mini-aoe projectiles & `popcorn_pop`, `laser_turret` hits along beam segment & emits `laser_beam`, `honey_shield` blocks one full hit & heals + emits `shield_break`, `blizzard_ward` reduces damage & slows nearby attackers + emits `blizzard_counter`, `vital_regen` restores HP over time, `prism_focus` boosts crit).
3. Existing secondary skills (`frost_nova`, `caramel_nova`, `void_pulse`, `candy_meteor`) push matching `VisualFxEntity` entries and expose live `secondaryCooldowns` in `buildHudSnapshot`.

- [ ] **Step 2: Run tests to verify failure**

Run: `node --experimental-strip-types --test src/survival/sim/__tests__/engine.test.ts src/survival/sim/__tests__/botBrain.test.ts`
Expected: FAIL on missing heal, missing new skill mechanics, and empty `visualEffects` / `secondaryCooldowns`.

- [ ] **Step 3: Implement updates in `engine.ts` and `botBrain.ts`**

1. In `engine.ts`:
   - Initialize `visualEffects: []` in `createSurvivalWorld` and initialize new player timers (`whirlwindBladeTimer: 0`, `glacialSpearTimer: 0`, `popcornBarrageTimer: 0`, `laserTurretTimer: 0`, `vitalRegenTimer: 0`, `blizzardWardCooldown: 0`, `honeyShieldCooldown: 0`, `honeyShieldReady: false`).
   - Add `pushVisualFx` + `updateVisualEffects(world, dt)` (capped at `MAX_VISUAL_EFFECTS = 24`) called each fixed step.
   - Extract small shared cooldown-calculation helpers (avoid duplicating secondary cooldown formulas between `updateSecondaryWeapons` and `buildSecondaryCooldowns(p)`!).
   - Implement `triggerLevelUpIfReady` 15% heal (`Math.max(15, Math.round(p.maxHp * 0.15))`) for living players only (`!p.downed && p.hp > 0`), spawning emerald particles, `+${healed}` text, and `'level_heal'` visual FX.
   - Update `damagePlayer` with `honey_shield` absorption + heal + `'shield_break'` FX, `crystal_shield` `'shield_break'` FX, and `blizzard_ward` proximity slow + `'blizzard_counter'` FX.
   - Update `updateHazards` to emit `'meteor_impact'` when `!h.fromEnemy` hazard resolves.
   - Update `updateSecondaryWeapons` to emit `'frost_nova'`, `'caramel_nova'`, `'void_pulse'` FX and execute `whirlwind_blade`, `glacial_spear`, `popcorn_barrage`, `laser_turret`, plus `vital_regen` & `honey_shield` cooldown ticks inside `updatePlayers` / `updateSecondaryWeapons`.
   - Enhance healing effectiveness multiplier `1 + p.stats.vitalRegenLevel * 0.1` for `heal` pickups and `vampirism` kills.
   - Populate `secondaryCooldowns` in `toPlayerSummary(p)` via shared `buildPlayerSecondaryCooldowns(p)`.
2. In `botBrain.ts`:
   - Extend `SECONDARY_UNLOCK_SKILLS` and `BASE_SKILL_SCORE` for all 8 new skills, and prioritize `vital_regen` / `honey_shield` when `lowHp`.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --experimental-strip-types --test src/survival/sim/__tests__/engine.test.ts src/survival/sim/__tests__/botBrain.test.ts src/survival/sim/__tests__/bossAndWaves.test.ts src/survival/sim/__tests__/catalogAndMaps.test.ts`
Expected: ALL pass cleanly.

---

### Task 3: Online Co-op Wire Protocol, Snapshot Interpolation & Guest HUD Cooldowns

**Files:**
- Modify: `src/survival/online/protocol.ts`
- Modify: `src/survival/online/snapshotInterpolation.ts`
- Modify: `src/survival/render/SurvivalCanvas.tsx`
- Test: `src/survival/online/__tests__/protocolAndRoom.test.ts`
- Test: `src/survival/online/__tests__/snapshotInterpolation.test.ts`

**Interfaces:**
- Consumes: `VisualFxKind`, `VisualFxEntity`, `SkillCooldownState`, `SKILLS` (32 IDs), `ProjectileEntity['weaponId']`.
- Produces:
  - `PackedVisualFx`, `WireVisualFxTuple`, `WireSecondaryCooldownTuple`, `PackedPlayer.secondaryCooldowns`, `SurvivalSnapshotPayload.visualEffects`, `SurvivalSnapshotWirePayload.vf`.
  - Updated `packSurvivalSnapshot`, `validateSurvivalSnapshotPayload`, `encodeSnapshotWire`, `decodeSnapshotWire`, `SurvivalSnapshotInterpolator`, and `SurvivalCanvas.tsx` `packedPlayerToSummary` & `snapshotToRenderView` wiring.

- [ ] **Step 1: Add failing protocol & interpolation tests**

In `protocolAndRoom.test.ts` and `snapshotInterpolation.test.ts`:
- Assert `visualEffects` (including `'frost_nova'`, `'laser_beam'` with `endX/endY`, etc.) and `secondaryCooldowns` round-trip faithfully through `packSurvivalSnapshot`, `encodeSnapshotWire`, `decodeSnapshotWire`, and `SurvivalSnapshotInterpolator.sample`.
- Assert worst-case full-room snapshot (4 players with skills + cooldowns, 160 enemies, 120 projectiles, 120 gems, 24 `visualEffects`) stays strictly under `25 KB` (`25600` bytes).
- Assert malformed `vf` tuples or malformed player cooldown tuples are safely rejected by `decodeSnapshotWire` / `validateSurvivalSnapshotPayload`.

- [ ] **Step 2: Run protocol tests to verify failure**

Run: `node --experimental-strip-types --test src/survival/online/__tests__/protocolAndRoom.test.ts src/survival/online/__tests__/snapshotInterpolation.test.ts`
Expected: FAIL due to missing `visualEffects` / `secondaryCooldowns` fields on snapshot & wire schema.

- [ ] **Step 3: Update `protocol.ts`, `snapshotInterpolation.ts`, and `SurvivalCanvas.tsx`**

1. In `src/survival/online/protocol.ts`:
   - Add `'whirlwind_blade'`, `'glacial_spear'`, `'popcorn_barrage'` to `PROJECTILE_WEAPON_IDS`.
   - Define `VISUAL_FX_KINDS`, `MAX_WIRE_VISUAL_FX = 24`, `PackedVisualFx`, `WireVisualFxTuple`, `WireSecondaryCooldownTuple` (`[skillIdx, remTenths, maxTenths]`).
   - Add `secondaryCooldowns?: Partial<Record<SkillId, SkillCooldownState>>` to `PackedPlayer`, populate in `packPlayer`, optionally encode as tuple index `27` (`WirePlayerTuple`) when non-empty, validate/decode cleanly for tuple length `27` or `28`.
   - Add `visualEffects: PackedVisualFx[]` to `SurvivalSnapshotPayload` and `vf?: WireVisualFxTuple[]` to `SurvivalSnapshotWirePayload` with pack/validate/encode/decode helpers.
2. In `src/survival/online/snapshotInterpolation.ts`:
   - Clone `secondaryCooldowns` in `clonePlayer` / `interpolatePlayer`, and clone `visualEffects` in `cloneSnapshot` / `sample`.
3. In `src/survival/render/SurvivalCanvas.tsx`:
   - Map `p.secondaryCooldowns` in `packedPlayerToSummary` so Online Guests get identical HUD cooldown timers and continuous-active indicators.
   - Ensure `npm run typecheck` passes across ALL files after Task 3 (even if `canvasRenderer` ignores `view.visualEffects` temporarily before Task 4—wire `visualEffects` into `SurvivalRenderView` in Task 4 or stub safely now).

- [ ] **Step 4: Run online tests & full sim tests**

Run: `node --experimental-strip-types --test src/survival/online/__tests__/*.ts src/survival/sim/__tests__/*.ts`
Expected: ALL pass, worst-case packet `< 25 KB`.

---

### Task 4: Canvas2D Animations for All Secondary Skills & 8 Custom SVG Emblems

**Files:**
- Modify: `src/survival/render/canvasRenderer.ts`
- Modify: `src/survival/ui/SurvivalIcons.tsx`

**Interfaces:**
- Consumes: `VisualFxEntity`, `VisualFxKind`, `SkillId`, `SurvivalWorldState.visualEffects`, `SurvivalSnapshotPayload.visualEffects`.
- Produces:
  - Dedicated Canvas2D animations inside `canvasRenderer.ts` for `visualEffects`, falling candy comet in `drawHazard`, rotating warm embers in `drawPlayerGroundAuras`, orbiting crystal laser turret & barrier perimeter arcs in `drawPlayer`, and custom projectiles (`whirlwind_blade`, `glacial_spear`, `popcorn_barrage`) in `drawProjectile`.
  - 8 handcrafted SVG illustrations in `SkillArt` (`SurvivalIcons.tsx`).

- [ ] **Step 1: Upgrade `canvasRenderer.ts` renderers cleanly**

1. Add `visualEffects: readonly VisualFxEntity[]` to `SurvivalRenderView`, `worldToRenderView`, and `snapshotToRenderView`.
2. Implement `drawVisualFx(ctx, fx, nowMs, reducedMotion)` supporting all 9 `VisualFxKind` variants cleanly (`frost_nova`, `caramel_nova`, `void_pulse`, `meteor_impact`, `popcorn_pop`, `laser_beam`, `shield_break`, `blizzard_counter`, `level_heal`).
3. Upgrade `drawHazard`: when `!h.fromEnemy` (`candy_meteor`), animate a glowing caramel-fire comet descending vertically along a fiery meteor trail down to `(h.x, h.y)` synchronized with `elapsed / duration`.
4. Upgrade `drawPlayerGroundAuras`: when `warmAuraLevel > 0`, draw animated rotating amber flame embers and warm heat rim.
5. Upgrade `drawPlayer`: render floating amethyst `laser_turret` satellite opposite `plush_drone`, and subtle translucent barrier arc when `honey_shield` or `blizzard_ward` is active.
6. Upgrade `drawProjectile`: add custom vector shapes for `'whirlwind_blade'` (spinning 4-blade cyclone shuriken), `'glacial_spear'` (pointed ice crystal lance), and `'popcorn_barrage'` (fluffy golden popcorn puff).

- [ ] **Step 2: Add 8 handcrafted SVG emblems in `src/survival/ui/SurvivalIcons.tsx`**

Implement custom SVG branches inside `SkillArt` for `whirlwind_blade`, `vital_regen`, `glacial_spear`, `blizzard_ward`, `popcorn_barrage`, `honey_shield`, `laser_turret`, `prism_focus` matching the vibrant stroke-and-gradient aesthetic of the existing 24 emblems.

- [ ] **Step 3: Run `npm run typecheck`**

Run: `npm run typecheck`
Expected: Zero TypeScript errors across sim, online, renderer, and icons.

---

### Task 5: Clarity UI — Active vs Passive Skill Distinction, HUD Secondary Cooldown Tray, Chapter Stepper, Event Banners & Lobby Scenario Preview

**Files:**
- Modify: `src/survival/ui/LevelUpModal.tsx`
- Modify: `src/survival/ui/SurvivalHud.tsx`
- Modify: `src/survival/ui/SurvivalLobby.tsx`

**Interfaces:**
- Consumes: `SKILLS`, `getSkillTimingLabel`, `getEnemyNameForMap`, `BOSS_NAMES`, `SURVIVAL_MAPS`, `SurvivalMapMeta.scenario`, `SurvivalPlayerSummary.secondaryCooldowns`, `SurvivalHudSnapshot`, `SkillArt`.
- Produces:
  - Updated `LevelUpModal.tsx`: clearer `Chiêu phụ tự động` vs `Nội tại` classification + activation rhythm hint + level-up team heal confirmation strip (`"Đội vừa hồi +15% Máu cho thành viên còn sống"`).
  - Updated `SurvivalHud.tsx`:
    - Campaign Scenario Progress Stepper (`Ch.1 -> B1 -> Ch.2 -> B2 -> Ch.3 -> Boss Cuối` / Endless loop label) + dynamic 1-line mission goal directly beneath the top match clock.
    - Non-blocking Chapter / Event Toast Banner (`Chuyển Chương`, `Mở khóa Quái mới`, `Bão Cát Kẹo`, `Cảnh báo Boss`) auto-clearing cleanly without covering player center.
    - Split bottom skill area: highlighted **Khay Chiêu Phụ Tự Động** with live cooldown overlay sweep & countdown/ready pulse + compact **Dải Nội Tại** below.
  - Updated `SurvivalLobby.tsx`:
    - Map cards show `"8 Mặc định + 8 Riêng Map"` (`"32 kỹ năng"` for Endless) + `"Kịch bản & Kỹ năng"` button opening an accessible `SurvivalDialogShell` preview dialog displaying the map's 3-Chapter Timeline, Boss showcase, biome Monster roster, Map Mechanic summary, and filterable 16-skill (or 32-skill) Codex (`Tất cả / Chiêu phụ tự động / Nội tại`).

- [ ] **Step 1: Upgrade `LevelUpModal.tsx`**

Clarify `CATEGORY_META` (`secondary` -> `'Chiêu phụ tự động'`, `weapon` -> `'Nội tại · Vũ khí'`, `survival` -> `'Nội tại · Sinh tồn'`), surface `getSkillTimingLabel(spec.id)` pill on secondary skill cards, and add the compact emerald level-up heal notice banner cleanly at the modal header.

- [ ] **Step 2: Upgrade `SurvivalHud.tsx`**

Implement:
1. Top Scenario Stepper & 1-line dynamic mission text computed cleanly from `hud.elapsedSec`, `hud.bossesSlain`, `hud.activeBoss`, `hud.bossWarningSec`, `hud.isEndlessActive`, and `mapMeta.scenario`.
2. Clean non-blocking Event/Chapter Banner driven cleanly via React state transitions (`prevChapter`, `prevBossWarn`, `prevSandstorm`) using timer cleanup and respecting `prefers-reduced-motion`.
3. Split skill rack inside the bottom player card: **Chiêu phụ tự động** tiles (`SkillArt`, level badge, radial/vertical cooldown sweep + seconds remaining OR glowing `"Đang bật"` indicator for continuous orbitals/auras/drones) stacked above compact **Nội tại** pills.

- [ ] **Step 3: Upgrade `SurvivalLobby.tsx`**

1. Update chip labels from `"6 Mặc định + 6 Riêng Map"` -> `"8 Mặc định + 8 Riêng Map"` and `"Đủ 24 kỹ năng"` -> `"Đủ 32 kỹ năng"`.
2. Add `"Kịch bản & Kỹ năng"` trigger button on each map card (stopping card selection event propagation with accessible `<button>` semantics) opening a crisp `SurvivalDialogShell` Scenario & Codex modal displaying Chapters/Bosses, Monster Roster (`slime`, `bat`, `wolf`, `owl_mage`, `golem`, `bomber` localized via `getEnemyNameForMap`), Map Mechanics, and interactive filter tabs for the map's skill pool (`Tất cả`, `Chiêu phụ tự động`, `Nội tại`).

- [ ] **Step 4: Run Full Verification Gate (Tests + Typecheck + Production Build)**

Run:
`node --experimental-strip-types --test src/survival/sim/__tests__/*.ts src/survival/online/__tests__/*.ts && npm run typecheck && npm run build`
Expected: Zero test failures, zero TypeScript errors, clean Vite production build.
