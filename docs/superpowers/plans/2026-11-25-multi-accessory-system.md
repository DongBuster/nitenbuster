# Multi-Accessory 5-Slot System & Default MU Jersey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở rộng hệ thống phụ kiện lên 15 món chia đều 5 vùng không đè nhau (`outfit`, `neck`, `eyes`, `hat`, `back`), mở khóa sẵn miễn phí **Áo Đấu MU** (`mu_jersey`), hỗ trợ phối tối đa 5 phụ kiện đồng thời và giữ nguyên chuyển động theo xương trên toàn bộ màn chơi.

**Architecture:** Chuẩn hóa trạng thái trang bị mỗi nhân vật thành `string[]` (tối đa 1 món mỗi vùng qua `normalizeAccessories` và `toggleSlotAccessory` trong `src/scene3d/accessoryCatalog.ts`), tương thích ngược hoàn toàn với dữ liệu `string | null` cũ ở `localStorage`, Online Realtime và Brawl Arena. Toàn bộ tạo hình 3D mới gắn trực tiếp vào xương `body` (`outfit`, `neck`, `back`, và `hat` cho Shark/Chicken) hoặc `head` (`eyes`, `hat`) qua `ACCESSORY_ANCHORS`, đồng thời nâng cấp `CookieShopModal` với tab lọc 5 vùng, thanh Loadout 5 ô và chế độ thử phối đồ trực tiếp.

**Tech Stack:** TypeScript strict (`tsc --noEmit`), React 19, React Three Fiber v9 (`@react-three/fiber`, `@react-three/drei`), Three.js, Tailwind CSS v4, Lucide React, Node native test runner (`node --test`).

**Spec:** [2026-11-25-multi-accessory-system-design.md](../../specs/2026-11-25-multi-accessory-system-design.md)

## Global Constraints

- Không thêm package/dependency mới ngoài `package.json` hiện có.
- Không tự ý `git commit`, `git push`, `git tag` hoặc chỉnh sửa các file ngoài phạm vi phụ kiện/cửa hàng.
- Tương thích ngược 100% với `localStorage` cũ (`string | null`) và payload Online Realtime; `mu_jersey` (`Áo Đấu MU`) có `price: 0` và luôn tự động có mặt trong `unlockedAccessories` cho cả profile mới và profile đã lưu.
- Mọi phụ kiện 3D mới phải gắn qua xương `body` / `head` (hoặc `motionGroupRef` ở GLB) để đồng bộ mọi hành động, không để mesh bụng/đuôi/mào/tai đâm xuyên hay che mặt nhân vật.
- Toàn bộ code kiểm tra đạt chuẩn với `npm run build` (`tsc --noEmit && vite build`) và `node --test`.

---

## File Structure

- **Create:** `src/scene3d/accessoryCatalog.ts` — Nguồn chân lý duy nhất cho `EquipCategory`, `SHOP_ITEMS` (15 món), `DEFAULT_UNLOCKED_ACCESSORIES`, `normalizeAccessories`, `toggleSlotAccessory`, `getAccessoryMeta`, `formatEquippedSummary`.
- **Create:** `src/scene3d/__tests__/accessoryCatalog.test.ts` — Unit test cho 5 vùng, 15 món, `mu_jersey` miễn phí, migration legacy `string | null`, logic phối & tháo theo vùng.
- **Modify:** `src/scene3d/accessoryAnchors.ts` — Thêm `OutfitAnchor`, `BackAnchor`, `HeadphonesAnchor` (đối xứng cho Tai nghe Gaming) cho cả 8 nhân vật, và hỗ trợ `getAccessorySlot` cho toàn bộ 15 món.
- **Modify:** `src/scene3d/__tests__/accessoryAnchors.test.ts` — Mở rộng unit test kiểm tra 15 món và các neo `outfit`, `back`, `headphones` cho 8 nhân vật.
- **Modify:** `src/scene3d/Accessory3D.tsx` — Nhận `AccessorySelection` (`string | readonly string[] | null`), render tổ hợp nhiều phụ kiện khớp `slot` (`body` / `head` / `all`), thêm tạo hình 3D cho 11 phụ kiện mới (`mu_jersey`, `cozy_hoodie`, `bowtie`, `gold_chain`, `round_glasses`, `pixel_shades`, `beanie`, `headphones`, `backpack`, `angel_wings`, `royal_cape`).
- **Modify:** `src/scene3d/CharacterRig3D.tsx`, `src/scene3d/Character3D.tsx`, `src/scene3d/GLBCharacter3D.tsx`, `src/scene3d/animals/*.tsx` — Nới kiểu `accessory?: AccessorySelection` (không đổi logic xương).
- **Modify:** `src/store/profileStore.ts` — Lưu `equippedAccessory: Partial<Record<AnimalId, string[]>>`, luôn gộp `'mu_jersey'` vào `unlockedAccessories`, thêm `clearAccessories(animal)`, giữ `SHOP_ITEMS` re-export từ `accessoryCatalog.ts`.
- **Modify:** `src/online/protocol.ts`, `src/online/useOnlineRoom.ts`, `src/brawl/sim/types.ts`, `src/brawl/sim/matchStore.ts`, `src/scene3d/GameTableScene3D.tsx`, `src/screens/MainMenuScreen.tsx`, `src/screens/BrawlScreen.tsx`, `src/brawl/ui/BrawlSetupPanel.tsx`, `src/screens/OnlineLobbyScreen.tsx` — Nâng cấp kiểu & hiển thị badge phối nhiều phụ kiện an toàn với dữ liệu cũ.
- **Modify:** `src/components/Modals/ShopCharacterPreview.tsx`, `src/components/Modals/RulesModal.tsx` — Tab lọc 5 vùng, thanh Loadout 5 ô + `Tháo hết`, xem trước 3D phối thử nhiều món đồng thời.

---

### Task 1: Catalog 5 vùng, 15 phụ kiện & logic chuẩn hóa (`accessoryCatalog.ts`)

**Files:**
- Create: `src/scene3d/accessoryCatalog.ts`
- Test: `src/scene3d/__tests__/accessoryCatalog.test.ts`

**Interfaces:**
- Produces:
  - `export type EquipCategory = 'outfit' | 'neck' | 'eyes' | 'hat' | 'back';`
  - `export type AccessorySelection = string | readonly string[] | null | undefined;`
  - `export interface ShopItem { id: string; category: EquipCategory; name: string; icon: string; description: string; price: number; isDefaultUnlocked?: boolean; }`
  - `export const EQUIP_CATEGORIES: ReadonlyArray<{ id: EquipCategory; label: string }>`
  - `export const SHOP_ITEMS: ShopItem[]` (15 món, có `mu_jersey` với `price: 0, isDefaultUnlocked: true`)
  - `export const DEFAULT_UNLOCKED_ACCESSORIES: readonly string[]` (`['mu_jersey']`)
  - `export function normalizeAccessories(input: AccessorySelection): string[]`
  - `export function toggleSlotAccessory(current: AccessorySelection, itemId: string | null): string[]`
  - `export function getAccessoryMeta(id: string): ShopItem | null`
  - `export function formatEquippedSummary(equipped: AccessorySelection): { primaryName: string; extraCount: number; fullNames: string[] } | null`

- [ ] **Step 1: Write the failing test**

```ts
// src/scene3d/__tests__/accessoryCatalog.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_UNLOCKED_ACCESSORIES,
  EQUIP_CATEGORIES,
  SHOP_ITEMS,
  formatEquippedSummary,
  normalizeAccessories,
  toggleSlotAccessory,
} from '../accessoryCatalog.ts';

describe('accessoryCatalog 5-slot system', () => {
  it('defines 15 items across 5 categories with mu_jersey unlocked by default', () => {
    assert.equal(EQUIP_CATEGORIES.length, 5);
    assert.equal(SHOP_ITEMS.length, 15);
    const mu = SHOP_ITEMS.find((i) => i.id === 'mu_jersey');
    assert.ok(mu);
    assert.equal(mu.category, 'outfit');
    assert.equal(mu.price, 0);
    assert.equal(mu.isDefaultUnlocked, true);
    assert.ok(DEFAULT_UNLOCKED_ACCESSORIES.includes('mu_jersey'));
  });

  it('normalizes legacy single strings, nulls, invalid ids, and enforces one item per slot', () => {
    assert.deepEqual(normalizeAccessories(null), []);
    assert.deepEqual(normalizeAccessories('scarf'), ['scarf']);
    assert.deepEqual(normalizeAccessories(['unknown_id', 'mu_jersey']), ['mu_jersey']);
    // Same slot (outfit): cozy_hoodie replaces mu_jersey; different slots stay combined
    assert.deepEqual(
      normalizeAccessories(['mu_jersey', 'scarf', 'glasses', 'cozy_hoodie', 'crown', 'angel_wings']),
      ['cozy_hoodie', 'scarf', 'glasses', 'crown', 'angel_wings'],
    );
  });

  it('toggles items on/off and swaps items only within the same category', () => {
    let loadout = toggleSlotAccessory([], 'mu_jersey');
    loadout = toggleSlotAccessory(loadout, 'scarf');
    loadout = toggleSlotAccessory(loadout, 'glasses');
    loadout = toggleSlotAccessory(loadout, 'crown');
    loadout = toggleSlotAccessory(loadout, 'angel_wings');
    assert.equal(loadout.length, 5);

    // Swapping neck item keeps other 4 slots intact
    loadout = toggleSlotAccessory(loadout, 'bowtie');
    assert.deepEqual(loadout, ['mu_jersey', 'bowtie', 'glasses', 'crown', 'angel_wings']);

    // Clicking already-equipped item toggles it off
    loadout = toggleSlotAccessory(loadout, 'bowtie');
    assert.deepEqual(loadout, ['mu_jersey', 'glasses', 'crown', 'angel_wings']);
  });

  it('formats summary concisely for UI badges', () => {
    assert.equal(formatEquippedSummary([]), null);
    assert.deepEqual(formatEquippedSummary(['mu_jersey']), {
      primaryName: 'Áo Đấu MU',
      extraCount: 0,
      fullNames: ['Áo Đấu MU'],
    });
    assert.deepEqual(formatEquippedSummary(['mu_jersey', 'scarf', 'crown']), {
      primaryName: 'Áo Đấu MU',
      extraCount: 2,
      fullNames: ['Áo Đấu MU', 'Khăn Len Mùa Đông', 'Vương Miện Quán Quân'],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/scene3d/__tests__/accessoryCatalog.test.ts`
Expected: FAIL with module not found (`Cannot find module '../accessoryCatalog.ts'`).

- [ ] **Step 3: Write `src/scene3d/accessoryCatalog.ts`**

Implement `EQUIP_CATEGORIES`, `SHOP_ITEMS` (15 items across `outfit`, `neck`, `eyes`, `hat`, `back`), `DEFAULT_UNLOCKED_ACCESSORIES = ['mu_jersey']`, `getAccessoryMeta`, `normalizeAccessories` (preserving canonical category order `outfit -> neck -> eyes -> hat -> back`), `toggleSlotAccessory`, and `formatEquippedSummary`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/scene3d/__tests__/accessoryCatalog.test.ts`
Expected: PASS (4/4 tests).

---

### Task 2: Mở rộng neo 3D đa vùng (`accessoryAnchors.ts`) cho cả 8 nhân vật

**Files:**
- Modify: `src/scene3d/accessoryAnchors.ts`
- Modify: `src/scene3d/__tests__/accessoryAnchors.test.ts`

**Interfaces:**
- Consumes: `EquipCategory`, `getAccessoryMeta` from `./accessoryCatalog.ts`
- Produces:
  - `OutfitAnchor` (`y`, `z`, `scale: [number, number, number]`, `chestZ`, `backZ`, `shoulderX`, `shoulderY`, `shoulderZ`)
  - `BackAnchor` (`y`, `z`, `scale`, `rotX?`)
  - `HeadphonesAnchor` (`y`, `z`, `earSpread`, `earY`, `bandHeight`)
  - Updated `AnimalAccessoryAnchors` including `outfit`, `back`, `headphones`
  - Updated `getAccessorySlot(accessory: string, animal: AnimalId): 'body' | 'head'` supporting all 15 item IDs via `getAccessoryMeta(accessory)?.category`.

- [ ] **Step 1: Update `src/scene3d/__tests__/accessoryAnchors.test.ts` with failing tests for all 15 items + `outfit` / `back` / `headphones` anchors**

```ts
import { SHOP_ITEMS } from '../accessoryCatalog.ts';

// Inside describe('Accessory3D bone slots and anchors'):
it('routes all 15 catalog accessories to body or head for every animal', () => {
  for (const animal of ALL_ANIMALS) {
    for (const item of SHOP_ITEMS) {
      const slot = getAccessorySlot(item.id, animal);
      if (item.category === 'eyes') {
        assert.equal(slot, 'head');
      } else if (item.category === 'hat') {
        const expected = animal === 'shark' || animal === 'chicken' ? 'body' : 'head';
        assert.equal(slot, expected);
      } else {
        assert.equal(slot, 'body');
      }
    }
  }
});

it('provides outfit, back, and symmetric headphones anchors for all 8 animals', () => {
  for (const animal of ALL_ANIMALS) {
    const anchors = ACCESSORY_ANCHORS[animal];
    assert.ok(anchors.outfit.scale[0] >= 0.5 && anchors.outfit.chestZ > 0.35);
    assert.ok(anchors.back.z <= -0.35 && anchors.back.scale > 0.8);
    assert.ok(anchors.headphones.earSpread >= 0.35);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/scene3d/__tests__/accessoryAnchors.test.ts`
Expected: FAIL because `outfit`, `back`, `headphones` don't exist yet and `getAccessorySlot` doesn't route new items.

- [ ] **Step 3: Implement `OutfitAnchor`, `BackAnchor`, `HeadphonesAnchor`, and update `ACCESSORY_ANCHORS` + `getAccessorySlot` in `src/scene3d/accessoryAnchors.ts`**

Route `getAccessorySlot`:
- `'outfit'`, `'neck'`, `'back'` -> `'body'`
- `'eyes'` -> `'head'`
- `'hat'` -> `anchors.hatBone` (`'body'` for `shark`/`chicken`, `'head'` for others)

Populate exact measured coordinates for all 8 animals (`dog`, `cat`, `duck`, `shark`, `dino`, `panda`, `chicken`, `bunny`) verified from their geometry files.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/scene3d/__tests__/accessoryAnchors.test.ts`
Expected: PASS.

---

### Task 3: Dựng 11 phụ kiện 3D mới & hỗ trợ kết hợp nhiều món trong `Accessory3D.tsx`

**Files:**
- Modify: `src/scene3d/Accessory3D.tsx`
- Modify: `src/scene3d/CharacterRig3D.tsx`
- Modify: `src/scene3d/Character3D.tsx`
- Modify: `src/scene3d/GLBCharacter3D.tsx`
- Modify: `src/scene3d/animals/Dog3D.tsx`, `Cat3D.tsx`, `Duck3D.tsx`, `Shark3D.tsx`, `Dino3D.tsx`, `Panda3D.tsx`, `Chicken3D.tsx`, `Rabbit3D.tsx`

**Interfaces:**
- Consumes: `AccessorySelection`, `normalizeAccessories` from `./accessoryCatalog`, `ACCESSORY_ANCHORS`, `BONE_ROOT_OFFSETS`, `getAccessorySlot` from `./accessoryAnchors`
- Produces:
  - `Accessory3D` accepts `accessory?: AccessorySelection`, renders every active item matching `slot` (`'body' | 'head' | 'all'`), wrapping each item in its bone-root offset when `slot === 'all'` (for GLBs).
  - `Animal3DProps.accessory?: AccessorySelection`
  - `Character3DProps.accessory?: AccessorySelection`
  - `GLBCharacter3DProps.accessory?: AccessorySelection`

- [ ] **Step 1: Update `Accessory3DProps`, `Animal3DProps`, `Character3DProps`, `GLBCharacter3DProps` to accept `AccessorySelection`**

Update `CharacterRig3D.tsx`, `Character3D.tsx`, `GLBCharacter3D.tsx`, and the 8 `animals/*.tsx` imports/annotations if needed (`Animal3DProps` already propagates `accessory` to all 8 animals!).
Note: check `animals/*.tsx` — because all 8 animals type their props as `Animal3DProps` and pass `accessory={accessory}` directly into `<Accessory3D />`, updating `Animal3DProps` + `Accessory3DProps` automatically types all 8 animals cleanly!

- [ ] **Step 2: Implement 3D meshes for all 11 new accessories in `src/scene3d/Accessory3D.tsx` (reusing shared torso shell geometry helper for `outfit` items)**

Create a clean shared `getJerseyShellGeometry()` (`LatheGeometry` smooth torso wrapper open at neck and waist so it wraps cleanly without clipping chin or feet) and implement:
- `mu_jersey`: Crimson `#DA291C` torso shell, crisp white V-collar trim, black/white shoulder cuffs, gold-and-red MU shield crest on left front chest (`chestZ`), white `#7`/stripe accent on back (`backZ`).
- `cozy_hoodie`: Deep navy `#1E3A5F` torso shell, cream front kangaroo pocket & drawstrings, folded plush hood collar behind shoulders.
- `bowtie`: Sleek black velvet dual-wedge bow + gold center knot at neck front (`scarf.tailZ`).
- `gold_chain`: Metallic gold neck torus + star/medallion pendant resting cleanly on upper chest.
- `round_glasses`: Thin antique-gold circular frames + warm amber semi-transparent lenses (using shared `GlassesMesh` frame geometry logic parameterized by style!).
- `pixel_shades`: Stepped 8-bit black pixel blocks + white highlight pixels + pixel bridge/temples.
- `beanie`: Pine-green ribbed knit dome + cream folded cuff torus + white fluffy pom-pom at `anchors.hat`.
- `headphones`: Curved dark headband over `anchors.headphones` + two cushioned earcups with cyan glowing LED rings at `±earSpread`.
- `backpack`: Rounded caramel-tan explorer pack + pocket + dark buckle + forest-green sleeping roll strapped at `anchors.back`.
- `angel_wings`: Layered ivory-white feathered wings (`±1` mirror groups) with warm gold inner highlights at `anchors.back`.
- `royal_cape`: Flowing crimson velvet tapered cape + white ermine-dotted neck trim & gold clasps draping along `anchors.back`.

- [ ] **Step 3: Run `npm run typecheck`**

Run: `npm run typecheck`
Expected: PASS (0 TypeScript errors).

---

### Task 4: Nâng cấp `profileStore.ts`, Online Realtime & Brawl Arena cho mảng phụ kiện

**Files:**
- Modify: `src/store/profileStore.ts`
- Modify: `src/online/protocol.ts`
- Modify: `src/online/useOnlineRoom.ts`
- Modify: `src/brawl/sim/types.ts`
- Modify: `src/brawl/sim/matchStore.ts`
- Modify: `src/scene3d/GameTableScene3D.tsx`
- Modify: `src/screens/MainMenuScreen.tsx`
- Modify: `src/screens/BrawlScreen.tsx`
- Modify: `src/brawl/ui/BrawlSetupPanel.tsx`
- Modify: `src/screens/OnlineLobbyScreen.tsx`
- Test: `src/store/__tests__/profileStore.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_UNLOCKED_ACCESSORIES`, `normalizeAccessories`, `toggleSlotAccessory`, `formatEquippedSummary`, `SHOP_ITEMS` from `src/scene3d/accessoryCatalog.ts`
- Produces:
  - `PlayerProfile.equippedAccessory: Partial<Record<AnimalId, string[]>>`
  - `useProfileStore()` exposes `clearAccessories(animal: AnimalId)` alongside `equipAccessory(animal: AnimalId, id: string | null)` (which uses `toggleSlotAccessory`).
  - `parseProfile(raw)` pure helper exported from `profileStore.ts` (so Node tests can test `localStorage` migration of legacy `"scarf"` and auto-granting `'mu_jersey'` without needing DOM!).

- [ ] **Step 1: Write failing test `src/store/__tests__/profileStore.test.ts` testing profile migration and default `mu_jersey` unlock**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeProfileData } from '../profileStore.ts';

describe('profileStore accessory migration', () => {
  it('always unlocks mu_jersey for legacy and fresh profiles', () => {
    const migrated = sanitizeProfileData({
      cookies: 40,
      selectedAnimal: 'dino',
      unlockedAccessories: ['scarf'],
      equippedAccessory: { dino: 'scarf' } as unknown as Record<string, string[]>,
    });

    assert.ok(migrated.unlockedAccessories.includes('mu_jersey'));
    assert.ok(migrated.unlockedAccessories.includes('scarf'));
    assert.deepEqual(migrated.equippedAccessory.dino, ['scarf']);
  });

  it('normalizes multi-slot equippedAccessory records and drops invalid ids', () => {
    const migrated = sanitizeProfileData({
      unlockedAccessories: ['mu_jersey', 'scarf', 'crown'],
      equippedAccessory: {
        dog: ['mu_jersey', 'scarf', 'crown', 'bad_id'],
      },
    });
    assert.deepEqual(migrated.equippedAccessory.dog, ['mu_jersey', 'scarf', 'crown']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/store/__tests__/profileStore.test.ts`
Expected: FAIL (`sanitizeProfileData` not exported).

- [ ] **Step 3: Update `profileStore.ts`, `online/*`, `brawl/*`, `GameTableScene3D.tsx`, `MainMenuScreen.tsx`, `BrawlSetupPanel.tsx`, `OnlineLobbyScreen.tsx`**

- Extract `sanitizeProfileData(parsed: Record<string, unknown>): PlayerProfile` in `profileStore.ts` (pure, testable, merges `DEFAULT_UNLOCKED_ACCESSORIES`, normalizes every animal's equipped loadout via `normalizeAccessories`).
- Update `LobbyPresenceMember.accessory` & `GameSnapshotEvent.accessories` to `string[]`, parsing incoming presence/snapshot payloads via `normalizeAccessories` in `useOnlineRoom.ts` (backwards-compatible with older clients!).
- Update `FighterConfig.accessory` & `MatchAction` (`humanAccessory: string[]`) in `brawl/sim/types.ts` & `matchStore.ts` (`accessory: []` for bots, normalized `humanAccessory` for human).
- Update badge displays in `MainMenuScreen.tsx`, `BrawlSetupPanel.tsx`, `OnlineLobbyScreen.tsx` using `formatEquippedSummary`.

- [ ] **Step 4: Run all unit tests + typecheck**

Run: `npm run typecheck; node --test src/store/__tests__/profileStore.test.ts src/scene3d/__tests__/accessoryCatalog.test.ts src/scene3d/__tests__/accessoryAnchors.test.ts`
Expected: PASS.

---

### Task 5: Nâng cấp `CookieShopModal` — Lọc 5 vùng, Loadout phối đồ & Xem thử kết hợp 3D

**Files:**
- Modify: `src/components/Modals/ShopCharacterPreview.tsx`
- Modify: `src/components/Modals/RulesModal.tsx`

**Interfaces:**
- Consumes: `EQUIP_CATEGORIES`, `SHOP_ITEMS`, `EquipCategory`, `normalizeAccessories`, `toggleSlotAccessory`, `getAccessoryMeta` from `src/scene3d/accessoryCatalog`
- Consumes: `clearAccessories` from `useProfileStore`
- Produces:
  - `ShopCharacterPreviewProps`: accepts `accessories: string[]`, `accessoryBadges: string[]`, `previewItemName?: string | null`
  - `CookieShopModal`:
    - Category filter tabs (`Tất cả`, `Áo`, `Cổ`, `Mắt`, `Đầu`, `Lưng`)
    - Active 5-slot Loadout bar under the 3D preview (click slot pill to unequip that item + `"Tháo hết"` button)
    - `"Thử"` merges the previewed item into the active loadout (replacing only its own slot) so players test full multi-item combinations live on the 3D model before buying.

- [ ] **Step 1: Update `ShopCharacterPreview.tsx` to display multi-item loadout pills cleanly without obscuring the 3D model**
- [ ] **Step 2: Update `CookieShopModal` in `RulesModal.tsx` with category tabs, 5-slot Loadout bar, `Tháo hết`, and combined `"Thử"` logic**
- [ ] **Step 3: Run `npm run build` and all unit tests**

Run: `npm run build; node --test src/store/__tests__/profileStore.test.ts src/scene3d/__tests__/accessoryCatalog.test.ts src/scene3d/__tests__/accessoryAnchors.test.ts src/brawl/sim/__tests__/partyMotion.test.ts src/engine/__tests__/engine.test.ts`
Expected: Build succeeds (0 errors) and all unit tests pass.

---

### Task 6: Kiểm chứng trực quan toàn bộ 5 vùng, Áo MU mặc định & phối đa phụ kiện bằng Playwright

**Files:**
- Scratch test script (outside repo): `.../scratch/verify_multi_accessories.py`

- [ ] **Step 1: Run Playwright headless Chromium against `vite preview` (`dist/`)**

Verify & capture screenshots of:
1. Fresh profile (`localStorage` empty) -> verify `Áo Đấu MU` is ALREADY unlocked (`Đã sở hữu` / `Trang bị`) with 100 starting Cookies!
2. Category tabs (`Tất cả`, `Áo`, `Cổ`, `Mắt`, `Đầu`, `Lưng`) & Loadout bar in `CookieShopModal`.
3. Combining 5 accessories simultaneously (`mu_jersey` + `scarf` + `glasses` + `crown` + `angel_wings`, plus `cozy_hoodie` + `bowtie` + `pixel_shades` + `headphones` + `backpack`, plus `round_glasses` + `gold_chain` + `beanie` + `royal_cape`) across multiple animals (`dino`, `dog`, `shark`, `panda`, `bunny`, `chicken`, `duck`, `cat`).
4. Action animation check (`Vui vẻ` / `Chiến thắng` + `Brawl Arena`) confirming ALL combined accessories move with the character and zero runtime console/page errors occur.

- [ ] **Step 2: Inspect every screenshot via `read_file` and refine any visual overlap/clipping if observed, then re-run final `npm run build` + `node --test` after final edit.**

---

## Self-Review Check

- **Spec coverage:** 5 slots (`outfit`, `neck`, `eyes`, `hat`, `back`), 15 accessories, `mu_jersey` default unlocked free, backwards-compatible `localStorage` + Online + Brawl, category tabs + 5-slot Loadout + combined `"Thử"` in `CookieShopModal`, action animation sync across all modes -> all covered in Tasks 1–6.
- **No placeholders:** Exact symbols, file paths, types, and test assertions specified in every task.
- **Type consistency:** `EquipCategory`, `AccessorySelection`, `normalizeAccessories`, `toggleSlotAccessory`, `DEFAULT_UNLOCKED_ACCESSORIES`, `sanitizeProfileData`, `clearAccessories` match across Tasks 1–5.
