# PAWS Survival (Sinh Tồn 2D Top-Down) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **SAFETY RULE:** Never run `git commit`, `git push`, `git tag`, or deploy commands unless the user explicitly asks in the current session.

**Goal:** Build **PAWS Survival**, a 2D Top-Down roguelite survival minigame supporting **Solo**, **Team + Bot AI (offline)**, and **Team Online Co-op (2–4 players via Supabase Realtime)** across **4 large maps (`3600 × 3600 px`)** (3 six-minute campaign maps with timed Boss spawns + 1 **Endless Score Arena**), **6 primary weapons**, **4 gear items**, and **14 level-up skills** (including 4 auto-firing secondary weapons), fully integrated into `paws-game`'s Hub, profile Cookies, and audio engine.

**Architecture:** Host-authoritative pure TypeScript 60Hz simulation under `src/survival/sim/` (zero React/DOM imports, testable via `node --experimental-strip-types --test`), paired with a DPR-aware HTML5 Canvas 2D renderer (`src/survival/render/`), a 15Hz snapshot-interpolated Supabase Realtime room (`src/survival/online/`), and clean Tailwind v4 overlays (`src/survival/ui/`).

**Tech Stack:** React 19, TypeScript 5.8 (`strict: true`, `allowImportingTsExtensions: true`, `noUnusedLocals: true`, `noUnusedParameters: true`), Vite 6, Tailwind CSS v4, Lucide Icons, `@supabase/supabase-js` v2, Node v24 `node --experimental-strip-types --test`.

**Spec:** `docs/superpowers/specs/2026-11-27-survival-mode-design.md`

## Global Constraints

- **No new npm dependencies.** Use only packages already in `package.json`.
- **Explicit `.ts` extensions** on all relative imports inside pure TypeScript modules (`src/survival/sim/`, `src/survival/online/`, `src/store/`) so `node --experimental-strip-types --test` works alongside Vite and `tsc --noEmit`.
- **60Hz mutable sim / 15Hz React HUD:** Never store per-frame entity arrays in React state; keep `SurvivalWorldState` inside refs in `SurvivalCanvas.tsx` and emit lightweight `SurvivalHudSnapshot` at ~15Hz (plus immediate push on phase transitions like `levelup`, `victory`, `gameover`).
- **Zero regression:** All existing tests, `npm run typecheck`, and `npm run build` must remain green.
- **Strict TypeScript:** Zero `any`, zero `@ts-ignore`, zero unused locals/parameters.
- **Safety:** Do NOT run `git commit`, `git push`, `git tag`, or deploy commands automatically.

---

### Task 1: Survival Types, Catalog (6 Weapons, 4 Gear, 14 Skills) & 4-Map Registry

**Files:**
- Create: `src/survival/sim/types.ts`
- Create: `src/survival/sim/catalog.ts`
- Create: `src/survival/sim/maps.ts`
- Test: `src/survival/sim/__tests__/catalogAndMaps.test.ts`

**Interfaces:**
- Produces in `src/survival/sim/types.ts`:
  - `SurvivalMapId = 'winter_cabin' | 'candy_canyon' | 'crystal_cavern' | 'endless_abyss'`
  - `SurvivalMode = 'solo' | 'bot_team' | 'online_coop'`
  - `WeaponId = 'candy_smg' | 'chestnut_shotgun' | 'frost_bow' | 'lightning_staff' | 'candy_launcher' | 'snow_boomerang'`
  - `GearId = 'ice_skates' | 'plush_armor' | 'crystal_magnet' | 'golden_scope'`
  - `SkillId` (14 union members: `'multishot' | 'fire_rate' | 'damage_up' | 'pierce_up' | 'ricochet' | 'orbital_ice' | 'warm_aura' | 'candy_meteor' | 'plush_drone' | 'max_hp' | 'vampirism' | 'magnet_range' | 'agility' | 'team_aura'`)
  - `SkillRarity = 'common' | 'rare' | 'epic'`
  - `EnemyKind = 'slime' | 'bat' | 'wolf' | 'owl_mage' | 'golem' | 'bomber' | 'boss_slime_king' | 'boss_frost_bear' | 'boss_snow_dragon'`
  - `SurvivalPhase = 'playing' | 'levelup' | 'victory' | 'gameover'`
  - `SurvivalInput = { moveX: number; moveY: number; aimX: number; aimY: number; manualAim: boolean; dashPressed: boolean }`
  - Entity interfaces: `PlayerEntity`, `EnemyEntity`, `ProjectileEntity`, `XpGemEntity`, `CrateEntity`, `HazardTelegraph`, `FloatingText`, `ParticleFx`, `LightningArcFx`, `MapObstacle`, `MapZone`, `SkillOffer`, `SurvivalWorldState`, `SurvivalHudSnapshot`, `SurvivalPlayerSummary`, `SurvivalMatchSummary`.
- Produces in `src/survival/sim/catalog.ts`:
  - `WEAPONS: readonly WeaponSpec[]` (6 weapons with exact spec stats), `getWeaponSpec(id)`
  - `GEARS: readonly GearSpec[]` (4 gear items with exact spec bonuses), `getGearSpec(id)`
  - `SKILLS: readonly SkillSpec[]` (14 skills with max level 5, category `'weapon' | 'secondary' | 'survival'`), `getSkillSpec(id)`
  - `xpForNextLevel(level: number): number` (`Math.round(60 + level * 35 + level * level * 6)`)
  - `rollSkillOffers(currentSkills: Partial<Record<SkillId, number>>, rng: () => number, guaranteeRare: boolean): SkillOffer[]`
  - `computeDerivedStats(weaponId: WeaponId, gearId: GearId, skills: Partial<Record<SkillId, number>>): DerivedPlayerStats`
- Produces in `src/survival/sim/maps.ts`:
  - `WORLD_SIZE = 3600`
  - `SURVIVAL_MAPS: readonly SurvivalMapMeta[]` (4 maps: 3 campaign 6-minute maps + `endless_abyss`)
  - `isSurvivalMapId(val: unknown): val is SurvivalMapId`
  - `getSurvivalMapMeta(id: SurvivalMapId): SurvivalMapMeta`
  - `generateMapLayout(mapId: SurvivalMapId, seed: number): { obstacles: MapObstacle[]; zones: MapZone[]; spawnPoints: { x: number; y: number }[] }`

- [ ] **Step 1: Write failing tests in `src/survival/sim/__tests__/catalogAndMaps.test.ts`**

Test cases:
1. Exactly 6 weapons, 4 gears, 14 skills, 4 maps (`endless_abyss` has `isEndless: true`, other 3 have `isEndless: false`).
2. `xpForNextLevel(1) === 101` and strictly increasing.
3. `rollSkillOffers` returns up to 3 unique skills not yet at level 5, and `guaranteeRare: true` never returns `'common'`.
4. `computeDerivedStats` applies weapon base stats, gear bonuses (`ice_skates`, `plush_armor`, `crystal_magnet`, `golden_scope`), and stacked skills (`multishot`, `fire_rate`, `damage_up`, `max_hp`).
5. `generateMapLayout` is deterministic for the same `(mapId, seed)`, keeps spawn area around center `(1800, 1800)` clear of obstacles (radius >= 260 px), and places obstacles inside `[120, WORLD_SIZE - 120]`.

- [ ] **Step 2: Run test to verify RED**

Run: `node --experimental-strip-types --test src/survival/sim/__tests__/catalogAndMaps.test.ts`
Expected: FAIL (missing modules).

- [ ] **Step 3: Implement `types.ts`, `catalog.ts`, and `maps.ts`**

- [ ] **Step 4: Run test & typecheck to verify GREEN**

Run: `node --experimental-strip-types --test src/survival/sim/__tests__/catalogAndMaps.test.ts && npm run typecheck`
Expected: PASS, 0 TS errors.

---

### Task 2: Spatial Hash Grid & Teammate Bot AI

**Files:**
- Create: `src/survival/sim/spatialGrid.ts`
- Create: `src/survival/sim/botBrain.ts`
- Test: `src/survival/sim/__tests__/spatialGrid.test.ts`

**Interfaces:**
- Consumes: `EnemyEntity`, `PlayerEntity`, `SurvivalWorldState`, `SurvivalInput`, `SkillOffer` from `./types.ts`.
- Produces in `src/survival/sim/spatialGrid.ts`:
  - `export class SpatialGrid<T extends { id: string; x: number; y: number }>` with `clear()`, `insert(item)`, `queryRadius(x, y, radius, out?: T[]): T[]`, `findNearest(x, y, maxRadius, filter?: (item: T) => boolean): T | null`.
- Produces in `src/survival/sim/botBrain.ts`:
  - `export function computeBotInput(world: SurvivalWorldState, bot: PlayerEntity): SurvivalInput` (priority order: 1. evade active red Boss/Bomber hazard telegraphs via move + Dash; 2. move to revive a downed human/teammate within 1100 px if safe; 3. kite away from nearby enemies while grabbing close heal packs / magnet / XP clusters; 4. orbit near living team centroid so bots stay helpful rather than wandering off).
  - `export function pickBotSkillIndex(bot: PlayerEntity, offers: readonly SkillOffer[]): number` (prefers higher rarity & synergies with weapon/survival).

- [ ] **Step 1: Write failing tests in `src/survival/sim/__tests__/spatialGrid.test.ts`**

Test cases:
1. `SpatialGrid.queryRadius` returns exact items within radius across cell boundaries and excludes farther ones.
2. `SpatialGrid.findNearest` returns closest item and respects `maxRadius` and `filter`.
3. `computeBotInput` steers a bot toward a downed teammate to revive them, and triggers `dashPressed` or flees away from an imminent danger telegraph directly under the bot.
4. `pickBotSkillIndex` picks an epic/rare offer over common when available.

- [ ] **Step 2: Run test to verify RED**

Run: `node --experimental-strip-types --test src/survival/sim/__tests__/spatialGrid.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `spatialGrid.ts` and `botBrain.ts`**

- [ ] **Step 4: Run test & typecheck to verify GREEN**

Run: `node --experimental-strip-types --test src/survival/sim/__tests__/spatialGrid.test.ts && npm run typecheck`
Expected: PASS.

---

### Task 3: Core Survival Simulation Engine (`engine.ts`)

**Files:**
- Create: `src/survival/sim/engine.ts`
- Test: `src/survival/sim/__tests__/engine.test.ts`
- Test: `src/survival/sim/__tests__/bossAndWaves.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `catalog.ts`, `maps.ts`, `spatialGrid.ts`, `botBrain.ts`.
- Produces in `src/survival/sim/engine.ts`:
  - `export interface CreateWorldConfig { matchId: string; mode: SurvivalMode; mapId: SurvivalMapId; seed: number; players: Array<{ id: string; name: string; animal: AnimalId; weaponId: WeaponId; gearId: GearId; isBot: boolean }> }`
  - `export function createSurvivalWorld(config: CreateWorldConfig): SurvivalWorldState`
  - `export function stepSurvivalWorld(world: SurvivalWorldState, inputs: Record<string, SurvivalInput>, dt: number): SurvivalSimEvent[]`
  - `export function applySkillPick(world: SurvivalWorldState, playerId: string, offerIndex: number): boolean`
  - `export function rerollSkillOffers(world: SurvivalWorldState, playerId: string): boolean`
  - `export function continueEndlessMode(world: SurvivalWorldState): void`
  - `export function buildHudSnapshot(world: SurvivalWorldState, localPlayerId: string): SurvivalHudSnapshot`
  - `export function buildMatchSummary(world: SurvivalWorldState): SurvivalMatchSummary`

Core mechanics implemented cleanly inside `engine.ts`:
- Deterministic PRNG (`mulberry32`) seeded per match.
- Movement with obstacle circle-vs-AABB/circle slide collision, map-specific zones (`ice` +18% speed on `winter_cabin`, periodic sandstorm wind push + bonus crates on `candy_canyon`, energy crystal pylon +20% fire rate aura on `crystal_cavern`, speed/score boost pads on `endless_abyss`).
- Dash (`Space`) with `220 px` burst over `0.18s`, `0.24s` invulnerability frames, cooldown reduced by `ice_skates` / `agility`.
- Hybrid aim: `autoAim` targets nearest alive enemy in weapon range (slight priority weight for active Boss), overridden by `manualAim` cursor coordinates.
- All 6 primary weapons:
  - `candy_smg`: fast straight shots with ±3° spread
  - `chestnut_shotgun`: 5-pellet cone + knockback
  - `frost_bow`: piercing arrows + 30% slow for 1.5s
  - `lightning_staff`: instant chain-lightning bolt jumping up to `3 + pierceBonus` enemies within 150px (emits `LightningArcFx`)
  - `candy_launcher`: explosive shell detonating in 95px AOE
  - `snow_boomerang`: flies out to range then returns to owner hitting both ways
- All 4 secondary auto-weapons (`orbital_ice`, `warm_aura`, `candy_meteor`, `plush_drone`) + `team_aura` buff/heal + `vampirism` heal every 12 kills.
- Enemy AI & 6 monster kinds (`slime`, `bat`, `wolf` with lunge telegraph, `owl_mage` shooting slow ice orbs, `golem` tanky knockback, `bomber` 0.8s explode ring).
- Timed Boss spawns & 3 Boss AIs with telegraphs:
  - Campaign maps: `90s` (`boss_slime_king`), `210s` (`boss_frost_bear`), `330s` (`boss_snow_dragon`). Warning banner 5s prior. Killing `boss_snow_dragon` sets `phase = 'victory'` (unless already continued into Endless).
  - Endless map (`endless_abyss`) or post-victory Endless: Boss cycles every `90s` (`90, 180, 270...`) with scaling `bossTier`.
- XP gem drop, magnetic pull within `pickupRadius`, Shared Team XP pool -> `phase = 'levelup'` with `pendingOffersByPlayer` + `levelUpTimerSec = 15` (auto-picks for Bots immediately; in Solo/Bot-Team waits calmly without ticking down to 0 so solo player can read, while in `online_coop` counts down 15s and auto-picks on timeout).
- Destructible supply crates dropping heal cookies (`+30% HP`), full-map XP magnet, or big XP gem.
- Team revive: downed players wait in place; living teammate within `85 px` fills `reviveProgress` over `3.0s` -> revives with `50% HP` and `2.0s` i-frames; all players downed -> `phase = 'gameover'`.
- Score formula & per-player stats (`kills`, `damageDealt`, `score`, `revives`).

- [ ] **Step 1: Write failing tests in `src/survival/sim/__tests__/engine.test.ts` and `bossAndWaves.test.ts`**

Test cases in `engine.test.ts`:
1. Movement clamps inside `WORLD_SIZE` and slides around solid obstacles.
2. Dash moves rapidly and grants i-frames preventing enemy contact damage.
3. Auto-aim fires at nearest enemy; `manualAim` fires toward cursor angle instead.
4. Killing an enemy drops XP gem, moving near magnetizes and collects XP, crossing `xpForNextLevel` enters `phase = 'levelup'` with 3 offers; `applySkillPick` increments skill level and resumes `'playing'`; `rerollSkillOffers` consumes 1 reroll charge (max 2).
5. All 6 weapons (including chain lightning, AoE launcher, returning boomerang) deal damage cleanly.
6. Team revive: when Player 1 is downed and Player 2 stands within 85px for 3.1s, Player 1 revives at 50% HP; when all players are downed, `phase === 'gameover'`.

Test cases in `bossAndWaves.test.ts`:
1. Campaign map (`winter_cabin`) spawns `boss_slime_king` at 90s, `boss_frost_bear` at 210s, `boss_snow_dragon` at 330s, with 5s boss warning beforehand.
2. Defeating `boss_snow_dragon` transitions to `phase === 'victory'`, and calling `continueEndlessMode` resumes playing with `isEndlessActive === true`.
3. `endless_abyss` spawns cycling bosses at 90s, 180s, 270s with increasing `bossTier` and does NOT trigger victory at 330s; score scales with kills, boss kills, and survival time.

- [ ] **Step 2: Run tests to verify RED**

Run: `node --experimental-strip-types --test src/survival/sim/__tests__/engine.test.ts src/survival/sim/__tests__/bossAndWaves.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/survival/sim/engine.ts`**

- [ ] **Step 4: Run tests & typecheck to verify GREEN**

Run: `node --experimental-strip-types --test src/survival/sim/__tests__/*.test.ts && npm run typecheck`
Expected: PASS.

---

### Task 4: Online Co-op Protocol, Snapshot Interpolation & Supabase Room Hook

**Files:**
- Create: `src/survival/online/protocol.ts`
- Create: `src/survival/online/snapshotInterpolation.ts`
- Create: `src/survival/online/useSurvivalRoom.ts`
- Test: `src/survival/online/__tests__/snapshotInterpolation.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `catalog.ts`, `maps.ts`, `online/supabaseClient.ts`, `online/sanitize.ts`, `engine/types.ts`.
- Produces in `src/survival/online/protocol.ts`:
  - Constants: `SURVIVAL_MAX_PLAYERS = 4`, `SURVIVAL_INPUT_INTERVAL_MS = 50` (20Hz), `SURVIVAL_SNAPSHOT_INTERVAL_MS = 66` (~15Hz), `SURVIVAL_DISCONNECT_BOT_MS = 6000`.
  - Compact wire types: `SurvivalRoomMember`, `SurvivalRoomPhase = 'idle' | 'lobby' | 'playing'`, `SurvivalSnapshotPayload` (packed arrays/objects for players, enemies, projectiles, xpGems, crates, hazards, arcs, phase, levelup offers, boss info, score), `SurvivalInputPayload`, `SurvivalSkillPickPayload`, `SurvivalRerollPayload`, `SurvivalStartPayload`, `SurvivalLobbySyncPayload`.
  - Helper `packSurvivalSnapshot(world: SurvivalWorldState, tick: number): SurvivalSnapshotPayload` and `unpackSnapshotToRenderState(snap: SurvivalSnapshotPayload)` (keeps wire payload small and caps projectiles/gems cleanly).
- Produces in `src/survival/online/snapshotInterpolation.ts`:
  - `export class SurvivalSnapshotInterpolator` with `reset()`, `push(snap: SurvivalSnapshotPayload, recvMs: number)`, `sample(nowMs: number): SurvivalSnapshotPayload | null` (smoothly interpolates player and enemy `(x, y)` positions over 80ms buffer, handles out-of-order ticks and bounded extrapolation).
- Produces in `src/survival/online/useSurvivalRoom.ts`:
  - `export function useSurvivalRoom(): SurvivalRoomController` managing:
    - `createRoom(profile)`, `joinRoom(code, profile)`, `leaveRoom()`
    - `updateMyLoadout(patch: Partial<{ animal: AnimalId; weaponId: WeaponId; gearId: GearId; name: string }>)`
    - `selectMap(mapId: SurvivalMapId)` (Host only)
    - `toggleReady()`, `startMatch()` (Host only, allows 2–4 humans and optional bot fill up to 4), `returnToLobby()`
    - High-frequency ref callbacks (`sendGuestInput`, `broadcastSnapshot`, `sendSkillPick`, `sendReroll`, `sendContinueEndless`, `setSnapshotListener`, `setGuestInputListener`, `setSkillActionListener`) so 60Hz loop never triggers React re-renders.
    - Guest disconnect heartbeat tracking -> marks `botTakeover` after 6s so Host's bot AI takes over seamlessly.

- [ ] **Step 1: Write failing tests in `src/survival/online/__tests__/snapshotInterpolation.test.ts`**

Test cases:
1. Midpoint interpolation between tick 1 `(x=100)` and tick 2 `(x=200)` returns `x≈150`.
2. Out-of-order older tick is ignored.
3. `packSurvivalSnapshot` packs world state deterministically and caps excess gems/projectiles safely.

- [ ] **Step 2: Run test to verify RED**

Run: `node --experimental-strip-types --test src/survival/online/__tests__/snapshotInterpolation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `protocol.ts`, `snapshotInterpolation.ts`, and `useSurvivalRoom.ts`**

- [ ] **Step 4: Run test & typecheck to verify GREEN**

Run: `node --experimental-strip-types --test src/survival/online/__tests__/snapshotInterpolation.test.ts && npm run typecheck`
Expected: PASS.

---

### Task 5: 2D Canvas Renderer & Game Loop Component (`src/survival/render/`)

**Files:**
- Create: `src/survival/render/canvasRenderer.ts`
- Create: `src/survival/render/SurvivalCanvas.tsx`

**Interfaces:**
- Consumes: `types.ts`, `maps.ts`, `catalog.ts`, `engine.ts`, `protocol.ts`, `snapshotInterpolation.ts`, `animalAvatarMeta.ts`, `soundEngine.ts`.
- Produces in `src/survival/render/canvasRenderer.ts`:
  - `export function renderSurvivalFrame(ctx: CanvasRenderingContext2D, width: number, height: number, state: SurvivalRenderView, camera: { x: number; y: number }, localPlayerId: string, aimCursorWorld: { x: number; y: number } | null, manualAim: boolean, nowMs: number, reducedMotion: boolean): void`
  - Visual polish details:
    - Per-map atmospheric background, subtle tile grid & themed ground decals (snowflakes/pine stumps, desert dunes/cacti, glowing crystal veins, starfield rune arena).
    - Environmental zones rendered with clear visual feedback (ice sheen, sandstorm dust, glowing crystal aura ring).
    - Cute PAWS 2D animal characters drawn using `getAnimalAvatarTheme(animal)` gradients + stylized ears/eyes/cheeks + rotating weapon sprite matching `weaponId` + HP bar & name tag + orbital ice / warm aura / drone visuals + green pulsing revive ring when downed.
    - Distinct monster & Boss silhouettes with hit-flash, slow-tint (frost), health bars, red telegraph circles/lines with fill-up timer before impact, off-screen red Boss direction arrow.
    - Glowing XP gems (green/blue/purple/gold), supply crates, lightning bolt arcs, projectiles, particles, floating damage numbers (yellow crits).
    - Crisp top-right **Minimap (`136 × 136 px`)** showing map bounds, player dot, teammate dots, Boss pulsing skull/red dot, and supply crates.
- Produces in `src/survival/render/SurvivalCanvas.tsx`:
  - Full-viewport DPR-scaled `<canvas>` running `requestAnimationFrame` with clamped `dt <= 0.05`.
  - Keyboard (`WASD` / Arrows, `Space` / `Shift` Dash, `Q` toggle Auto-Aim, `Escape` pause) + mouse world-space aim + left-click manual override + responsive touch Virtual Joystick & Dash button on coarse pointers.
  - Supports both **Host/Offline mode** (runs `stepSurvivalWorld` + broadcasts 15Hz snapshots if online) and **Client mode** (sends 20Hz input + renders interpolated host snapshots).
  - Plays throttled SFX via `playSfx` (`shoot`, `hit`, `pickup`, `levelUp`, `bossWarn`, `roll`, `win`, `lose`).
  - Exposes imperative handle (`pickSkill`, `reroll`, `continueEndless`) for `SurvivalScreen`.

- [ ] **Step 1: Implement `src/survival/render/canvasRenderer.ts`**

- [ ] **Step 2: Implement `src/survival/render/SurvivalCanvas.tsx`**

- [ ] **Step 3: Run typecheck to verify clean compilation**

Run: `npm run typecheck`
Expected: PASS, 0 TS errors.

---

### Task 6: Survival UI — Lobby, HUD, Level-Up Modal & Result Modal (`src/survival/ui/`)

**Files:**
- Create: `src/survival/ui/SurvivalLobby.tsx`
- Create: `src/survival/ui/SurvivalHud.tsx`
- Create: `src/survival/ui/LevelUpModal.tsx`
- Create: `src/survival/ui/SurvivalResultModal.tsx`

**Interfaces:**
- Consumes: `types.ts`, `catalog.ts`, `maps.ts`, `useSurvivalRoom.ts`, `AnimalAvatar.tsx`, `engine/types.ts`, `soundEngine.ts`.
- Produces:
  - `SurvivalLobby.tsx`: Clean dark-cabin glass/tactile UI consistent with PAWS (`btn-tactile-amber`, `btn-tactile-emerald`, `btn-tactile-wood`):
    - Mode selector tabs: **Solo**, **Team + Bot AI** (choose 1–3 bots), **Phòng Online (2–4 người)** (Create room, Join by 6-char code, Copy Invite Link `?survivalRoom=CODE`, member list with Ready badges & weapon/gear badges).
    - 4-Map selector cards clearly highlighting the **3 Campaign 6-minute maps** and the **Endless Score Arena (`Đấu Trường Vô Cực`)** with personal best score badge.
    - Animal picker (`ANIMALS`), 6-Weapon picker with stat bars, 4-Gear picker with perk badges, and primary Start CTA.
  - `SurvivalHud.tsx`:
    - Top bar: Full-width Team XP progress bar with `Lv.X`, Match timer (or Endless score + combo multiplier + Boss countdown badge), Boss HP bar when active, Boss 5s warning toast, Pause & Sound toggle buttons.
    - Bottom-left: Player HP bar, Dash cooldown pill, Auto-Aim toggle (`Q`), active weapon + gear badge + compact skill icons with level badges.
    - Left-side compact squad list (in Team modes) showing teammate avatars, HP bars, and "CỨU NGAY!" indicator if downed.
  - `LevelUpModal.tsx`:
    - 3 tactile rarity-bordered cards (`Thường` slate, `Hiếm` sky, `Sử Thi` amber/purple) with icon, name, next level badge, description, and keyboard shortcuts `1 / 2 / 3`.
    - Reroll button showing remaining charges (`Đổi thẻ (2)`).
    - In `online_coop`: shows `15s` countdown progress bar and `Đã chọn: X/Y đồng đội` waiting state after local player picks.
  - `SurvivalResultModal.tsx`:
    - Victory / Defeat / Endless Record banner, personal best badge, earned **Cookies** pill, match stats (Time, Level, Score, Total Kills, Bosses Slain), per-player leaderboard table in Team modes (Score, Kills, Damage, Revives), and action buttons (**Chơi Tiếp Endless** when campaign won, **Chơi Lại**, **Về Sảnh**).

- [ ] **Step 1: Implement `SurvivalLobby.tsx`**

- [ ] **Step 2: Implement `SurvivalHud.tsx`**

- [ ] **Step 3: Implement `LevelUpModal.tsx`**

- [ ] **Step 4: Implement `SurvivalResultModal.tsx`**

- [ ] **Step 5: Run typecheck to verify clean compilation**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 7: Profile Persistence, Sound SFX & Top-Level `SurvivalScreen`

**Files:**
- Modify: `src/store/profileSchema.ts`
- Modify: `src/store/profileStore.ts`
- Modify: `src/store/__tests__/profileStore.test.ts`
- Modify: `src/audio/soundEngine.ts`
- Create: `src/screens/SurvivalScreen.tsx`

**Interfaces:**
- Produces in `src/store/profileSchema.ts` & `profileStore.ts`:
  - New `PlayerProfile` fields (with safe defaults & backward-compatible sanitization):
    - `survivalBestScore: number` (default `0`, capped `MAX_BLOCK_BLAST_SCORE`)
    - `survivalBestTimeSec: number` (default `0`, capped `MAX_GLASS_TIME_SEC`)
    - `survivalWins: number` (default `0`, capped `MAX_GAMES`)
  - `export interface SurvivalSettlementResult { nextProfile: PlayerProfile; ok: boolean; reward: number; isNewBestScore: boolean; isNewBestTime: boolean }`
  - `export function settleSurvivalMatch(profile: PlayerProfile, payload: { matchId: string; mapId: SurvivalMapId; victory: boolean; score: number; elapsedSec: number }): SurvivalSettlementResult` (idempotent via `settledMatchIds`, awards cookies per spec Section 3.4).
  - `useProfileStore()` exposes `recordSurvivalResult`.
- Produces in `src/audio/soundEngine.ts`:
  - Adds `'shoot' | 'hit' | 'levelUp' | 'bossWarn'` to `SfxType` with Web Audio synthesis.
- Produces in `src/screens/SurvivalScreen.tsx`:
  - Default + named export `SurvivalScreen({ initialRoomCode?: string; onBackToModeSelect: () => void })` orchestrating lobby ↔ match ↔ pause ↔ level-up ↔ result modal + Cookies settlement.

- [ ] **Step 1: Write failing tests in `src/store/__tests__/profileStore.test.ts` for `settleSurvivalMatch` and legacy profile sanitization**

Test cases:
1. Legacy profile JSON without `survivalBestScore` sanitizes safely to `0`.
2. `settleSurvivalMatch` awards `+60` Cookies on campaign victory, updates `survivalWins`, `survivalBestScore`, `survivalBestTimeSec`, and rejects duplicate `matchId`.
3. `settleSurvivalMatch` on `endless_abyss` awards score/time-based Cookies (capped at `100`, min `5` when `elapsedSec >= 20`) and sets `isNewBestScore: true` when beating previous best.

- [ ] **Step 2: Run profile tests to verify RED**

Run: `node --experimental-strip-types --test src/store/__tests__/profileStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `profileSchema.ts`, `profileStore.ts`, `soundEngine.ts`, and create `src/screens/SurvivalScreen.tsx`**

- [ ] **Step 4: Run profile tests & typecheck to verify GREEN**

Run: `node --experimental-strip-types --test src/store/__tests__/profileStore.test.ts && npm run typecheck`
Expected: PASS.

---

### Task 8: Hub Integration (`App.tsx`, `ModeSelectScreen.tsx`), Key-Art Banner & Full Verification

**Files:**
- Create: `public/banners/survival-banner.jpg` (16:9 key-art matching existing PAWS mode banners via `image-generator` subagent)
- Modify: `src/App.tsx`
- Modify: `src/screens/ModeSelectScreen.tsx`

**Interfaces:**
- `App.tsx`:
  - Add `'survival'` to `AppScreen`, lazy-load `LazySurvivalScreen = lazy(() => import('./screens/SurvivalScreen'))`.
  - Read `?survivalRoom=` URL parameter on boot, strip it from `window.location.search`, and route directly into `'survival'`.
  - Pass `onSelectSurvival={() => setScreen('survival')}` to `ModeSelectScreen`.
- `ModeSelectScreen.tsx`:
  - Add `onSelectSurvival: () => void` prop and a 5th game mode card **PAWS Survival 2D** (`Sinh Tồn Hành Động · Solo & Team`) displaying `survivalBestScore`, 4 maps (including Endless), 6 weapons, and `/banners/survival-banner.jpg`.

- [ ] **Step 1: Generate `/banners/survival-banner.jpg` matching PAWS plush art style**

- [ ] **Step 2: Wire `src/App.tsx` and `src/screens/ModeSelectScreen.tsx`**

- [ ] **Step 3: Run ALL tests (new + existing), TypeScript typecheck, and Vite production build**

Run:
```powershell
node --experimental-strip-types --test src/survival/sim/__tests__/*.test.ts src/survival/online/__tests__/*.test.ts src/store/__tests__/profileStore.test.ts src/brawl/sim/__tests__/*.test.ts src/glass/sim/__tests__/*.test.ts
npm run typecheck
npm run build
```
Expected: All unit tests PASS, `tsc --noEmit` exits 0, `vite build` exits 0 with clean lazy chunk for `SurvivalScreen`.

- [ ] **Step 4: Visual smoke test in dev server (optional/recommended)**
Verify the Survival lobby, 4-map switcher, weapon/gear loadout, gameplay canvas, level-up modal, and ModeSelectScreen card render cleanly with zero console errors.
