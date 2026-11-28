# PAWS Survival 2D — Design Spec: Level-Up Heal, 32 Skills, Secondary VFX/HUD & Game Scenario Clarity

**Date:** 2026-11-28  
**Branch Target:** `main` (local workspace only — no git/deploy side effects)  
**Scope:** Extend `src/survival/` across simulation (`types`, `maps`, `catalog`, `engine`, `botBrain`), online co-op synchronization (`protocol`, `snapshotInterpolation`), 2D canvas renderer (`canvasRenderer`, `SurvivalCanvas`), and React UI (`SurvivalIcons`, `LevelUpModal`, `SurvivalHud`, `SurvivalLobby`).

---

## 1. Objectives & Approved Decisions

1. **Level-Up Sustain (`khi lên cấp hồi ít máu`):**
   - Immediately when the team levels up (`triggerLevelUpIfReady`), every **living** player (`!p.downed && p.hp > 0`) recovers `Math.max(15, Math.round(p.maxHp * 0.15))` HP, clamped to `p.maxHp`.
   - Downed teammates remain downed so the 3-second manual team revive mechanic stays intact.
   - Picking `max_hp` still restores `hpDelta = player.maxHp - prevMaxHp`.
   - Visual feedback: green floating text (`+${healed}`) + emerald sparkle particles (`spawnParticles`) + `'level_heal'` ring effect.

2. **Skill Expansion (`8 Core + 8 Map-Exclusive = 32 Total Skills`):**
   - Each Campaign map (`winter_cabin`, `candy_canyon`, `crystal_cavern`) maintains a strict **50/50 split**: **8 Core** skills + **8 Map-Exclusive** skills = **16 skills per Campaign map**.
   - `endless_abyss` unlocks all **32 skills**.
   - Fixed rarity guarantees remain enforced (`rollSkillOffers` never downgrades a skill's rarity on higher levels, and Boss Chest `guaranteeRare` strictly excludes `common` skills when higher-rarity unmaxed skills remain).
   - Every new skill obeys player-friendly Vietnamese copy rules (forbidden token check: no `px`, `AOE`, `±`, `°`, `cấp×`, `HP/s`, or `Max HP`).
   - Every new skill participates in `RARITY_EXCESS_SKILLS` or direct `eff(...)` stat scaling in `computeDerivedStats` so `skillPower` rarity multipliers strictly enhance higher-rarity rolls at every level including Lv.4→5.

3. **Secondary Skill Animations & Clear UI (`kỹ năng phụ animation & UI rõ ràng`):**
   - Clear semantic distinction everywhere between **`Chiêu phụ tự động`** (`category === 'secondary'`, 12 total) and **`Nội tại`** (`category === 'weapon' | 'survival'`, 20 total).
   - **Cross-Mode Visual Synchronization:** Add a lightweight `VisualFxEntity` channel (`visualEffects` on `SurvivalWorldState` and packed `WireVisualFxTuple[]` on `protocol.ts` + `snapshotInterpolation.ts`) alongside per-player `secondaryCooldowns` so Solo, Bot Team, Online Host, and Online Guest render the exact same animated shockwaves, falling comet trails, laser sweeps, orbiting flame/turret visuals, and live HUD cooldown gauges well under the `25 KB` Supabase packet cap.

4. **Clear Game Scenario (`kịch bản game rõ ràng`):**
   - Define authoritative `MapScenarioMeta` (`chapters`, `enemyRoster`, `bossBriefs`, `endlessSummary`) on every `SurvivalMapMeta` in `maps.ts`, matching the exact engine spawn/boss schedule (`0:00–1:30 Wave 1 -> 1:30 Boss 1 -> 1:30–3:30 Wave 2 -> 3:30 Boss 2 -> 3:30–5:30 Wave 3 -> 5:30 Final Boss` for campaigns, and escalating 90s Boss rotation for Endless).
   - **Pre-Match Lobby (`SurvivalLobby.tsx`):** Map cards update to `"8 Mặc định + 8 Riêng Map"` / `"32 kỹ năng"` and offer a `"Kịch bản & Kỹ năng"` preview modal displaying the 3-Chapter timeline, Boss showcase, biome monster roster, map mechanics, and filterable skill catalog (`16` skills for Campaign maps, `32` for Endless).
   - **In-Game HUD (`SurvivalHud.tsx`):** Compact Campaign Stage Stepper beneath the top timer (`Ch.1 -> B1 -> Ch.2 -> B2 -> Ch.3 -> Boss Cuối`) with dynamic 1-line objective hint, plus a non-blocking top-center **Chapter / Event Banner** (auto-dismissing after ~3.5s) announcing chapter transitions, newly unlocked biome monster tiers, map events (Candy Sandstorm / Crystal Pylon ready), and Boss warnings.

---

## 2. Architecture & Data Contracts

### 2.1 Expanded Skill Catalog (`src/survival/sim/types.ts` & `catalog.ts`)

Add 8 new `SkillId` values (`32` total):

| Scope | `SkillId` | Display Name | Category | Rarity | Trigger / Mechanics |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `core` | `whirlwind_blade` | Phi Tiêu Xoáy | `secondary` | `rare` | Every `max(2.1, 4.4 - lv*0.42)`s, launches a spinning piercing boomerang blade toward densest enemy cluster (`damage = (24 + lv*10) * mult`, infinite pierce, returns to owner). |
| `core` | `vital_regen` | Hồi Sinh Lực | `survival` | `rare` | Restores `1.5 * regenPower` HP every second while living and boosts heal pickup/vampirism recovery by `+10% * lv` (`hpRegenPerSec` in `DerivedPlayerStats`, also scales with `skillPower` for strict rarity check). |
| `winter_cabin` | `glacial_spear` | Thương Băng Rơi | `secondary` | `rare` | Every `max(2.0, 4.2 - lv*0.4)`s, fires `1 + Math.floor(lv / 2)` piercing ice lances (`pierce = 4 + lv`, applies `35%` slow for `2.0s`). |
| `winter_cabin` | `blizzard_ward` | Giáp Băng Giá | `survival` | `common` | Reduces incoming damage (`+5% * blizzardWardPower`, combined cap `0.65`) and reflects `blizzard_counter` frost wave slowing enemies within `135` units by `30%` for `2.2s` when hit (3.5s cooldown). |
| `candy_canyon` | `popcorn_barrage` | Pháo Bỏng Ngô | `secondary` | `rare` | Every `max(2.2, 4.5 - lv*0.4)`s, launches `2 + Math.floor(lv / 2)` golden kernels toward enemies (`ricochetLeft = 2`, mini `aoeRadius = 46 + lv * 4`, triggers `popcorn_pop` visual burst on hit/explosion). |
| `candy_canyon` | `honey_shield` | Lớp Mật Dẻo | `survival` | `common` | Every `max(5.5, 11 - lv * 1.0)`s generates an amber honey barrier (`honeyShieldReady = true`). Absorbs the next incoming hit (`0` HP lost, i-frames `0.45s`), heals `Math.round(maxHp * (0.04 + lv * 0.01))`, and emits `shield_break` gold splash. |
| `crystal_cavern` | `laser_turret` | Tháp Tia Pha Lê | `secondary` | `rare` | Summons floating crystal drone opposite `plush_drone`; every `max(2.0, 4.0 - lv * 0.35)`s sweeps `1 + (lv >= 4 ? 1 : 0)` instant piercing violet laser beams (`range = 420 + lv * 28`, segment damage + `laser_beam` VFX). |
| `crystal_cavern` | `prism_focus` | Khúc Xạ Chí Mạng | `weapon` | `common` | Directly increases `critChance` (`+0.055 * prismFocusPower`) and `critMultiplier` (`+0.15 * prismFocusPower`). |

**Exact Skill Pool Totals:**
- `core` (8): `damage_up`, `fire_rate`, `max_hp`, `agility`, `magnet_range`, `multishot`, `whirlwind_blade`, `vital_regen`.
- `winter_cabin` (8): `pierce_up`, `orbital_ice`, `warm_aura`, `team_aura`, `frost_nova`, `ice_shatter`, `glacial_spear`, `blizzard_ward`.
- `candy_canyon` (8): `sugar_rush`, `ricochet`, `vampirism`, `pepper_bomb`, `candy_meteor`, `caramel_nova`, `popcorn_barrage`, `honey_shield`.
- `crystal_cavern` (8): `overcharge`, `gem_greed`, `plush_drone`, `crystal_shield`, `prism_chain`, `void_pulse`, `laser_turret`, `prism_focus`.

### 2.2 Visual Effects (`VisualFxEntity`) & Cooldown Summaries

```ts
export type VisualFxKind =
  | 'frost_nova'
  | 'caramel_nova'
  | 'void_pulse'
  | 'meteor_impact'
  | 'popcorn_pop'
  | 'laser_beam'
  | 'shield_break'
  | 'blizzard_counter'
  | 'level_heal';

export interface VisualFxEntity {
  kind: VisualFxKind;
  x: number;
  y: number;
  radius: number;
  ttl: number;
  maxTtl: number;
  endX?: number;
  endY?: number;
}
```

- Stored on `SurvivalWorldState.visualEffects` (FIFO cap `24`, decremented by `dt` cleanly).
- Packed on `SurvivalSnapshotPayload.visualEffects` as `PackedVisualFx` (exact same shape, rounded coordinates & 2-decimal timers) and encoded as compact tuples `[kindIdx, x, y, radius, ttl, maxTtl, endX?, endY?]` (`hz` neighbor `vf`) in `protocol.ts` (`MAX_WIRE_VISUAL_FX = 24`).
- `snapshotInterpolation.ts` clones `visualEffects` cleanly on interpolated/buffered snapshots.
- **Secondary Skill Metadata & Cooldowns:**
  - `SkillCooldownState`: `{ remaining: number; max: number }` (where `max === 0` represents an always-on continuous ability such as `orbital_ice`, `warm_aura`, `plush_drone`).
  - `SurvivalPlayerSummary.secondaryCooldowns: Partial<Record<SkillId, SkillCooldownState>>`.
  - Packed cleanly onto `PackedPlayer` (`secondaryCooldowns`) and wire tuple slot 27 as compact array `[skillIdx, remTenths, maxTenths][]` (omitted when empty for backward friendliness & bandwidth minimization).

### 2.3 Game Scenario Data (`MapScenarioMeta`)

In `src/survival/sim/types.ts` & `src/survival/sim/maps.ts`:

```ts
export interface ScenarioChapterMeta {
  id: 'wave1' | 'wave2' | 'wave3';
  order: 1 | 2 | 3;
  title: string;
  timeRangeLabel: string;
  bossAtSec: number;
  bossKind: BossKind;
  summary: string;
  enemyHint: string;
  bossRewardLabel: string;
}

export interface MapScenarioMeta {
  headline: string;
  chapters: readonly ScenarioChapterMeta[];
  endlessSummary?: string;
}
```

Added as `scenario: MapScenarioMeta` on `SurvivalMapMeta`:
- `winter_cabin`, `candy_canyon`, `crystal_cavern` each define 3 concrete chapters aligned with `[90, 210, 330]` (`bossRotation[0..2]`).
- `endless_abyss` defines 3 milestone tiers representing the endless cycle (`0:00`, `1:30+`, `6:00+`) plus `endlessSummary`.

---

## 3. Simulation & AI Updates

### 3.1 `src/survival/sim/engine.ts`
- **Level-Up Heal:** Inside `triggerLevelUpIfReady`, iterate `world.players`:
  - For each living player (`!p.downed && p.hp > 0`), compute `healTarget = Math.max(15, Math.round(p.maxHp * 0.15))`, `healed = Math.min(p.maxHp, p.hp + healTarget) - p.hp`.
  - Apply `p.hp += healed`; if `healed > 0`, add floating text `+${healed}` (`#4ade80`), emit emerald `spawnParticles`, and push `'level_heal'` into `world.visualEffects`.
- **New Passive Effects:**
  - `vital_regen`: accumulates `vitalRegenTimer += dt`, heals `hpRegenPerSec` smoothly each 0.5s pulse while alive (`hp < maxHp`). Also scales heal pickup & vampirism heal by `1 + 0.1 * lv('vital_regen')`.
  - `honey_shield`: counts down `honeyShieldCooldown` when `!honeyShieldReady`; once ready, sets `honeyShieldReady = true`. Inside `damagePlayer`, if `honeyShieldReady`, consumes shield (`honeyShieldReady = false`, sets `honeyShieldCooldown`), sets `invulnTimer = Math.max(invulnTimer, 0.45)`, heals `6% + lv%` HP, spawns `'shield_break'` visual effect, returns without applying damage.
  - `blizzard_ward`: integrated into `damageReduction` + inside `damagePlayer`, if `blizzardWardLevel > 0 && blizzardWardCooldown <= 0`, slows enemies within `135` units by `30%` for `2.2s` and emits `'blizzard_counter'` visual effect.
  - `prism_focus`: handled directly via `critChance` / `critMultiplier` in `computeDerivedStats`.
- **New & Enhanced Secondary Weapons in `updateSecondaryWeapons`:**
  - Emit `'frost_nova'`, `'caramel_nova'`, `'void_pulse'`, `'popcorn_pop'`, `'laser_beam'` visual effects into `world.visualEffects` when triggered; `'meteor_impact'` when `candy_meteor` resolves inside `updateHazards`; `'shield_break'` when `crystal_shield` fires in `damagePlayer`.
  - Initialize & tick `whirlwindBladeTimer`, `glacialSpearTimer`, `popcornBarrageTimer`, `laserTurretTimer` cleanly with explicit helper functions (avoid duplicating projectile/beam construction).
  - Expose live `secondaryCooldowns` inside `toPlayerSummary` and `packPlayer`.
- **Enemy Spawn & Chapter Banner Triggers:**
  - No breaking changes to existing wave/boss timings (`CAMPAIGN_BOSS_TIMINGS = [90, 210, 330]` preserved for full backward test compatibility). HUD derives chapter progression & emits local banner triggers cleanly from `elapsedSec`, `bossesSlain`, `bossWarningSec`, `activeBoss`, and `sandstormActive` — works identically in Solo and Online Guest without polluting simulation state.

### 3.2 `src/survival/ai/botBrain.ts`
- Add `whirlwind_blade`, `glacial_spear`, `popcorn_barrage`, `laser_turret` to `SECONDARY_UNLOCK_SKILLS` and add all 8 new skills to `BASE_SKILL_SCORE`. Boost `vital_regen` & `honey_shield` when bot HP < 65%.

---

## 4. Canvas2D Rendering & Audio-Visual Polish

### 4.1 `src/survival/render/canvasRenderer.ts`
- Render `view.visualEffects` cleanly:
  - `frost_nova`: double expanding cyan/white ice ring + 8 rotating diamond ice crystals radiating outward.
  - `caramel_nova`: inward swirling golden caramel spiral vortex collapsing cleanly into a warm amber ring burst.
  - `void_pulse`: inward purple gravity ring followed by crisp violet shockwave & core flash.
  - `meteor_impact`: scorched caramel-orange crater flash + expanding fiery ring + star sparks.
  - `popcorn_pop`: crisp yellow-white puff burst.
  - `laser_beam`: dual-layer glowing magenta/violet beam along `(x, y) -> (endX, endY)` with bright white core and end impact flare.
  - `shield_break` / `blizzard_counter` / `level_heal`: crisp translucent hexagonal/circular barrier flash, frost-shard counter ring, and upward green recovery ring respectively.
- Enhance existing skills on `drawHazard`, `drawPlayerGroundAuras`, `drawPlayer`, `drawProjectile`:
  - **`candy_meteor` telegraph (`drawHazard` when `!h.fromEnemy`):** Shrinking landing ring + diagonal descending glowing meteor orb with tapered orange/gold flame tail reaching center at `elapsed / duration = 1`.
  - **`warm_aura` (`drawPlayerGroundAuras`):** Animated rotating amber embers around the heat circle + gentle radial warmth gradient.
  - **`laser_turret` (`drawPlayer`):** Floating amethyst prism satellite orbiting opposite `plush_drone`.
  - **Passive shields (`drawPlayer`):** Subtle amber (`honey_shield` ready) or icy (`blizzard_ward` ready) thin perimeter shimmer arc.
  - **New projectiles (`drawProjectile`):** Custom 4-blade spinning cyan shuriken (`whirlwind_blade`), elongated faceted ice lance (`glacial_spear`), and golden-cream popcorn puff (`popcorn_barrage`).

---

## 5. UI Components (`LevelUpModal`, `SurvivalHud`, `SurvivalLobby`)

1. **`SurvivalIcons.tsx`:** Add 8 custom handcrafted SVG glyphs inside `SkillArt` (`whirlwind_blade`, `vital_regen`, `glacial_spear`, `blizzard_ward`, `popcorn_barrage`, `honey_shield`, `laser_turret`, `prism_focus`).
2. **`LevelUpModal.tsx`:**
   - Replace category label `'Vũ khí phụ'` with clearer `'Chiêu phụ tự động'` badge (with subtle timing cue on secondary cards: `'Tự kích hoạt theo nhịp'` or `'Quay liên tục quanh người'`) vs `'Nội tại'` badge (`weapon`/`survival` passive).
   - Display a subtle banner note when picking: `"Lên cấp đã hồi +15% Máu cho thành viên còn sống"`.
3. **`SurvivalHud.tsx`:**
   - **Scenario Progress Strip (top header below timer):** Displays campaign stepper `Ch.1 -> B1 -> Ch.2 -> B2 -> Ch.3 -> Boss Cuối` (active chapter glow, slain bosses checkmarked) and a 1-line dynamic mission hint. Endless maps show cycle indicator.
   - **Non-blocking Event / Chapter Toast Banner:** Smooth top-center pill banner appearing briefly (~3.2s) on chapter advance (`Chuyển sang Chương 2/3`), Boss approach, Boss spawn, or Sandstorm event; respects `prefers-reduced-motion`.
   - **Split Skill Bar in Bottom Player Panel:**
     - **Khay Chiêu Phụ Tự Động:** Square skill tiles (`36x36`–`40x40`) with `SkillArt`, level pip (`C.1–5`), conic/vertical cooldown fill overlay, countdown seconds when cooling, pulsing `"Bật"` / `"Sẵn sàng"` border highlight.
     - **Dải Nội Tại:** Compact passive skill pills below secondary tray (`SkillArt` + `C.1–5` + reactive shield timer dot for Honey/Crystal Shield if owned).
4. **`SurvivalLobby.tsx`:**
   - Update map chips from `6 Mặc định + 6 Riêng Map` / `24 kỹ năng` to `8 Mặc định + 8 Riêng Map` / `32 kỹ năng`.
   - Add `"Kịch bản & Kỹ năng"` button on each map card opening a clean accessible `SurvivalDialogShell` inspection modal showing:
     - 3-Chapter Campaign Timeline & Boss roster (or Endless escalation breakdown),
     - Map mechanic + themed Monster roster (`getEnemyNameForMap`),
     - Filterable Grid of all **16** map-pool skills (or **32** for Endless), grouped clearly into `8 Kỹ năng Mặc định` vs `8 Kỹ năng Riêng Map` and filterable by `Tất cả / Chiêu phụ tự động / Nội tại`.

---

## 6. Verification Plan
- **Unit Tests:**
  - `catalogAndMaps.test.ts`: verify 32 skills (`8` core + `8` per campaign map = `16` per map, `32` endless), `MapScenarioMeta` integrity on all 4 maps, zero forbidden jargon on all 32 skills, `computeDerivedStats` rarity scaling across all 32 skills.
  - `engine.test.ts`: verify 15% (min 15 HP) heal on level-up for living players only (downed untouched), activation & visual FX emission for all 8 new skills (`whirlwind_blade`, `vital_regen`, `glacial_spear`, `blizzard_ward`, `popcorn_barrage`, `honey_shield`, `laser_turret`, `prism_focus`), secondary cooldowns in `buildHudSnapshot`, and existing secondary skills emitting `visualEffects`.
  - `protocolAndRoom.test.ts` & `snapshotInterpolation.test.ts`: round-trip `visualEffects` & `secondaryCooldowns` through `encodeSnapshotWire` / `decodeSnapshotWire` and `SurvivalSnapshotInterpolator`, and assert worst-case full-room snapshot remains strictly `< 25 KB`.
  - `botBrain.test.ts`: verify bot skill picking includes new secondary & sustain skills.
- **Typecheck & Production Build:** `npm run typecheck && npm run build`.
