# Block Blast PAWS: Smart Gap-Fitting Spawner, Stage Evolution & Supernova VFX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp Block Blast PAWS với thuật toán sinh khối vừa khít khe trống theo trạng thái bàn (`spawnSmartTray`), hệ thống 5+ cấp độ bàn cờ & bảng màu 2–3 màu chống rối mắt tăng dần theo mỗi lần Full Bàn (`All Clear`), và hiệu ứng Combo + Nổ + Bùng nổ Supernova bứt phá theo cấp số nhân.

**Architecture:** Mở rộng `BlastGameState` & `MoveOutcome` trong `src/blockblast/engine/types.ts` với `allClears` / `stageAfter` / `stageUp`; thêm `src/blockblast/engine/stages.ts` định nghĩa 5 bộ theme bàn cờ kèm bảng 2–3 màu hài hòa và tham số VFX tăng dần; nâng cấp `spawnSmartTray` trong `src/blockblast/engine/game.ts` dùng mô phỏng tuần tự `grid → simGrid1 → simGrid2` và hàm chấm điểm `scorePlacementFit` hoàn toàn định tính (giữ 100% tương thích với anti-cheat `verifyMatchReceipt`). Lớp giao diện (`src/index.css`, `BlockBoard.tsx`, `BlockTray.tsx`, `BlockBlastScreen.tsx`, `soundEngine.ts`) kết xuất vệt quét dòng, vòng xung kích đa tầng, mảnh vỡ hạt sao, rung bàn cờ tắt dần, Combo/Stage-Up Callout Banner và âm thanh ăn mừng `allClear`.

**Tech Stack:** TypeScript 5.8 (`strict`), React 19, Tailwind CSS v4, Web Audio API, Node native test runner (`node --test`).

**Spec:** Bounded enhancement extending [2026-11-25-block-blast-design.md](../../specs/2026-11-25-block-blast-design.md) per user requirements (2026-11-25).

## Global Constraints

- **Không thêm package/dependency mới** ngoài `package.json` hiện có.
- **Tuyệt đối không tự ý chạy `git commit`, `git push`, `git tag`, `git merge`** (chỉ sửa và kiểm chứng trên local workspace).
- Các file pure TypeScript trong `src/blockblast/engine/` khi import tương đối lẫn nhau **bắt buộc ghi rõ đuôi `.ts`** để chạy được đồng thời trên Vite và `node --test`.
- Mọi hiệu ứng chuyển động UI phải chạy thuần trên `opacity` / `transform` bên trong `@media (prefers-reduced-motion: no-preference)`, tôn trọng cờ `reducedMotion` trong game, và không nhấp nháy quá 3 lần/giây (WCAG 2.3.1).
- Không phá vỡ bất kỳ bài test nào trong `game.test.ts` và `profileStore.test.ts` (đặc biệt replay verification `verifyMatchReceipt` và `settleBlockBlastMatch`).

---

## File Structure

- **Modify:** `src/blockblast/engine/types.ts` — Thêm `allClears: number` vào `BlastGameState`, thêm `stageAfter: number` và `stageUp: boolean` vào `MoveOutcome`.
- **Create:** `src/blockblast/engine/stages.ts` — Định nghĩa `BoardStageTheme`, `STAGE_THEMES` (5 cấp độ bàn cờ + giới hạn 2–3 màu/stage + thông số VFX tăng cấp), `getStageTheme(allClears)`, `pickStageColor(allClears, prngState)`.
- **Modify:** `src/blockblast/engine/game.ts` — Nâng cấp `spawnSmartTray` (mô phỏng tuần tự 3 ô + `scorePlacementFit` lấp khe trống/ưu tiên All Clear khi bàn còn `<= 16` ô + chống trùng hình + rút màu theo Stage), tăng `allClears` và đồng bộ màu khay khi Full Bàn (`stageUp`), giữ nguyên `verifyMatchReceipt` 100% định tính.
- **Modify:** `src/blockblast/engine/__tests__/game.test.ts` — Thêm unit tests cho Stage palette (2–3 màu), gap-fitting spawner ưu tiên lấp khe trống, tiến hóa `allClears`/`stageUp`, đồng bộ màu khay và replay anti-cheat sau nâng cấp.
- **Modify:** `src/audio/soundEngine.ts` — Thêm `'allClear'` vào `SfxType` với hợp âm pháo hoa thăng hoa.
- **Modify:** `src/index.css` — Thêm keyframes GPU (`bb-combo-banner-pop`, `bb-shockwave-ring`, `bb-line-sweep-h`, `bb-line-sweep-v`, `bb-particle-fly`, `bb-place-pop`, `bb-board-shake-sm`, `bb-board-shake-lg`, `bb-allclear-supernova`) trong `@media (prefers-reduced-motion: no-preference)`.
- **Modify:** `src/blockblast/ui/BlockBoard.tsx` — Mở rộng `BurstEffect` & `BlockBoardProps` nhận `stageTheme`, `boardShake`, `recentPlacedCells`, render vệt quét dòng, shockwaves, hạt vỡ nhiều tầng và Arcade Callout Banner (`Combo` / `Multi-line` / `Bùm Kẹo` / `Full Bàn Stage Up`).
- **Modify:** `src/blockblast/ui/BlockTray.tsx` — Hỗ trợ `stageTheme` để viền khay hài hòa theo Stage hiện tại.
- **Modify:** `src/screens/BlockBlastScreen.tsx` — Sinh particles góc vàng định tính, `shockwaves`, `boardShake`, `recentPlacedCells`, tiered callouts, `playSfx('allClear')`, và badge hiển thị `Stage X · <Tên Stage>` trong HUD.

---

### Task 1: Kiểu Stage Progression & Bộ 5 Theme Bàn Cờ Chống Rối Mắt (`types.ts`, `stages.ts`)

**Files:**
- Modify: `src/blockblast/engine/types.ts:46-80`
- Create: `src/blockblast/engine/stages.ts`
- Modify: `src/blockblast/engine/__tests__/game.test.ts`

**Interfaces:**
- Consumes: `BlockColor` from `./types.ts`
- Produces:
  - `types.ts`: `BlastGameState.allClears: number`, `MoveOutcome.stageAfter: number`, `MoveOutcome.stageUp: boolean`
  - `stages.ts`:
    - `export type StageThemeId = 'timber' | 'aurora' | 'sakura' | 'royal' | 'celestial';`
    - `export interface BoardStageTheme { readonly tier: number; readonly id: StageThemeId; readonly name: string; readonly palette: readonly BlockColor[]; readonly particleCount: number; readonly allClearParticleCount: number; readonly shockwaveRings: number; readonly shakeLevel: 'sm' | 'lg'; readonly accentHex: string; readonly sweepColorHex: string; readonly frameClass: string; readonly wellClass: string; readonly cellEvenClass: string; readonly cellOddClass: string; readonly traySlotClass: string; readonly badgeClass: string; }`
    - `export const STAGE_THEMES: readonly BoardStageTheme[]`
    - `export function getStageTheme(allClears: number): BoardStageTheme`
    - `export function getStageNumber(allClears: number): number`

- [ ] **Step 1: Cập nhật `src/blockblast/engine/types.ts`**

Thêm `allClears: number;` vào `BlastGameState` và `stageAfter: number; stageUp: boolean;` vào `MoveOutcome`:

```ts
export interface BlastGameState {
  grid: Grid;
  tray: (TrayPiece | null)[];
  score: number;
  streak: number;
  maxStreak: number;
  graceUsed: boolean;
  linesCleared: number;
  movesCount: number;
  allClears: number;
  rerollUsed: boolean;
  candyBombUsed: boolean;
  rescueDeclined: boolean;
  phase: GamePhase;
  prngState: number;
  trayCounter: number;
}
```
```ts
export interface MoveOutcome {
  nextState: BlastGameState;
  placedCells: readonly { r: number; c: number }[];
  clearedCells: readonly { r: number; c: number }[];
  clearedRows: readonly number[];
  clearedCols: readonly number[];
  destroyedByBomb: readonly { r: number; c: number }[];
  pointsEarned: number;
  allClear: boolean;
  stageUp: boolean;
  stageAfter: number;
  streakAfter: number;
}
```

- [ ] **Step 2: Viết failing test cho `stages.ts` trong `src/blockblast/engine/__tests__/game.test.ts`**

```ts
import { getStageNumber, getStageTheme, STAGE_THEMES } from '../stages.ts';

describe('blockblast stage themes & palette discipline', () => {
  it('defines 5 progressive themes with 2-3 harmonious colors and escalating VFX', () => {
    assert.equal(STAGE_THEMES.length, 5);
    for (let i = 0; i < STAGE_THEMES.length; i++) {
      const theme = STAGE_THEMES[i];
      assert.equal(theme.tier, i + 1);
      assert.ok(theme.palette.length >= 2 && theme.palette.length <= 3);
      if (i > 0) {
        assert.ok(theme.particleCount > STAGE_THEMES[i - 1].particleCount);
        assert.ok(theme.allClearParticleCount >= STAGE_THEMES[i - 1].allClearParticleCount);
      }
    }
    assert.equal(getStageTheme(0).id, 'timber');
    assert.equal(getStageTheme(1).id, 'aurora');
    assert.equal(getStageTheme(4).id, 'celestial');
    assert.equal(getStageTheme(9).id, 'celestial');
    assert.equal(getStageNumber(9), 10);
  });
});
```

- [ ] **Step 3: Chạy test xác nhận RED**

Run: `node --test src/blockblast/engine/__tests__/game.test.ts`
Expected: FAIL (`Cannot find module '../stages.ts'`).

- [ ] **Step 4: Tạo `src/blockblast/engine/stages.ts`**

```ts
import type { BlockColor } from './types.ts';

export type StageThemeId = 'timber' | 'aurora' | 'sakura' | 'royal' | 'celestial';

export interface BoardStageTheme {
  readonly tier: number;
  readonly id: StageThemeId;
  readonly name: string;
  readonly palette: readonly BlockColor[];
  readonly particleCount: number;
  readonly allClearParticleCount: number;
  readonly shockwaveRings: number;
  readonly shakeLevel: 'sm' | 'lg';
  readonly accentHex: string;
  readonly sweepColorHex: string;
  readonly frameClass: string;
  readonly wellClass: string;
  readonly cellEvenClass: string;
  readonly cellOddClass: string;
  readonly traySlotClass: string;
  readonly badgeClass: string;
}

export const STAGE_THEMES: readonly BoardStageTheme[] = [
  {
    tier: 1,
    id: 'timber',
    name: 'Cabin Gỗ Ấm',
    palette: ['amber', 'orange'],
    particleCount: 8,
    allClearParticleCount: 28,
    shockwaveRings: 1,
    shakeLevel: 'sm',
    accentHex: '#FBBF24',
    sweepColorHex: '#FDE68A',
    frameClass:
      'border-[#5A3825] bg-gradient-to-b from-[#3A2216] via-[#2B1910] to-[#21120B] shadow-[0_18px_40px_rgba(0,0,0,0.55)]',
    wellClass: 'border-[#120905] bg-[#1A0F0A]',
    cellEvenClass: 'border-[#3D2519]/75 bg-[#2C1C13]',
    cellOddClass: 'border-[#362015]/75 bg-[#271810]',
    traySlotClass:
      'border-[#5A3825] bg-gradient-to-b from-[#362015] to-[#26150D]',
    badgeClass: 'border-amber-400/40 bg-amber-950/75 text-amber-200',
  },
  {
    tier: 2,
    id: 'aurora',
    name: 'Hồ Băng Cực Quang',
    palette: ['sky', 'emerald'],
    particleCount: 12,
    allClearParticleCount: 32,
    shockwaveRings: 2,
    shakeLevel: 'sm',
    accentHex: '#38BDF8',
    sweepColorHex: '#BAE6FD',
    frameClass:
      'border-sky-400/55 bg-gradient-to-b from-[#13324D] via-[#0E2438] to-[#091826] shadow-[0_18px_44px_rgba(14,165,233,0.28)]',
    wellClass: 'border-[#07131E] bg-[#0B1C2C]',
    cellEvenClass: 'border-sky-800/60 bg-[#132C42]',
    cellOddClass: 'border-sky-900/60 bg-[#102538]',
    traySlotClass:
      'border-sky-500/40 bg-gradient-to-b from-[#132E47] to-[#0D2134]',
    badgeClass: 'border-sky-400/45 bg-sky-950/80 text-sky-200',
  },
  {
    tier: 3,
    id: 'sakura',
    name: 'Đêm Kẹo Anh Đào',
    palette: ['rose', 'violet', 'amber'],
    particleCount: 16,
    allClearParticleCount: 36,
    shockwaveRings: 2,
    shakeLevel: 'lg',
    accentHex: '#F472B6',
    sweepColorHex: '#FBCFE8',
    frameClass:
      'border-pink-400/60 bg-gradient-to-b from-[#3E1B37] via-[#2B1328] to-[#1D0B1B] shadow-[0_18px_46px_rgba(236,72,153,0.3)]',
    wellClass: 'border-[#160814] bg-[#210D1E]',
    cellEvenClass: 'border-pink-800/55 bg-[#351731]',
    cellOddClass: 'border-fuchsia-900/55 bg-[#2D1329]',
    traySlotClass:
      'border-pink-400/40 bg-gradient-to-b from-[#3B1A35] to-[#261023]',
    badgeClass: 'border-pink-400/45 bg-pink-950/80 text-pink-200',
  },
  {
    tier: 4,
    id: 'royal',
    name: 'Thánh Đường Hoàng Kim',
    palette: ['amber', 'rose', 'emerald'],
    particleCount: 20,
    allClearParticleCount: 40,
    shockwaveRings: 3,
    shakeLevel: 'lg',
    accentHex: '#FACC15',
    sweepColorHex: '#FEF08A',
    frameClass:
      'border-yellow-300/70 bg-gradient-to-b from-[#493210] via-[#312009] to-[#1E1304] shadow-[0_18px_50px_rgba(250,204,21,0.34)]',
    wellClass: 'border-[#170E03] bg-[#241706]',
    cellEvenClass: 'border-amber-700/60 bg-[#3B260B]',
    cellOddClass: 'border-amber-800/60 bg-[#322009]',
    traySlotClass:
      'border-yellow-400/45 bg-gradient-to-b from-[#452E0D] to-[#2B1B07]',
    badgeClass: 'border-yellow-300/55 bg-amber-950/85 text-yellow-200',
  },
  {
    tier: 5,
    id: 'celestial',
    name: 'Tinh Tú Huyền Thoại',
    palette: ['violet', 'sky', 'amber'],
    particleCount: 24,
    allClearParticleCount: 44,
    shockwaveRings: 3,
    shakeLevel: 'lg',
    accentHex: '#A78BFA',
    sweepColorHex: '#DDD6FE',
    frameClass:
      'border-violet-300/75 bg-gradient-to-b from-[#2A1C54] via-[#1B133A] to-[#100B26] shadow-[0_20px_54px_rgba(139,92,246,0.42)]',
    wellClass: 'border-[#0B071B] bg-[#140E2E]',
    cellEvenClass: 'border-violet-700/60 bg-[#221949]',
    cellOddClass: 'border-indigo-800/60 bg-[#1B143D]',
    traySlotClass:
      'border-violet-400/50 bg-gradient-to-b from-[#281B52] to-[#181036]',
    badgeClass: 'border-violet-300/55 bg-violet-950/85 text-violet-100',
  },
];

export function getStageNumber(allClears: number): number {
  if (!Number.isFinite(allClears) || allClears <= 0) return 1;
  return Math.floor(allClears) + 1;
}

export function getStageTheme(allClears: number): BoardStageTheme {
  const idx = Math.min(
    STAGE_THEMES.length - 1,
    Math.max(0, getStageNumber(allClears) - 1),
  );
  return STAGE_THEMES[idx];
}
```

- [ ] **Step 5: Chạy `node --test` trên `stages` test (tạm thời comment hoặc chưa sửa `game.ts` chỉ check compile `stages.ts` riêng bằng `npx tsc --noEmit` sau Task 2)**

Ghi chú: Vì `types.ts` đã thêm `allClears`, `stageUp`, `stageAfter`, bước chạy test đầy đủ sẽ GREEN ngay sau Task 2 hoàn thành `game.ts` & `verify.ts`.

---

### Task 2: Board-Aware Gap-Fitting Spawner & Stage Transition (`game.ts`, `game.test.ts`)

**Files:**
- Modify: `src/blockblast/engine/game.ts:136-478`
- Modify: `src/blockblast/engine/__tests__/game.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `pieces.ts`, `stages.ts` (`getStageTheme`, `getStageNumber`)
- Produces:
  - `createInitialState(seed)` khởi tạo `allClears: 0`
  - `spawnSmartTray(grid, prngState, trayCounter, allClears)` sinh khay 3 mảnh vừa khít theo mô phỏng tuần tự `grid → simGrid1 → simGrid2`, dùng duy nhất bảng 2–3 màu của `getStageTheme(allClears).palette`, tránh lặp hình giống nhau, và ưu tiên hoàn thành `All Clear` khi bàn còn `<= 16` ô
  - `placePiece` & `detonateCandyBombAt` tăng `allClears + 1`, set `stageUp: true` & `stageAfter`, và re-tint màu các mảnh còn lại trên khay sang bảng màu Stage mới nếu mặt bàn trở nên trống hoàn toàn từ trạng thái có gạch (`wasOccupied && occupiedAfter === 0`).

- [ ] **Step 1: Viết thêm failing tests trong `src/blockblast/engine/__tests__/game.test.ts`**

1. Test chứng minh khi bàn chừa một khe trống hình chữ `L` hoặc hàng thiếu 2 ô (`fillRatio >= 0.12`), `spawnSmartTray` sinh ít nhất 1 mảnh trong khay có khả năng ăn dòng hoặc khớp nhiều cạnh kề gạch thay vì toàn mảnh không phù hợp, và màu sinh ra luôn nằm trong `getStageTheme(allClears).palette`.
2. Test chứng minh khi `placePiece` kích hoạt `All Clear` (quét sạch bàn), `nextState.allClears` tăng từ `0` lên `1`, `outcome.stageUp === true`, `outcome.stageAfter === 2`, và các mảnh còn lại trên khay được đổi màu sang `getStageTheme(1).palette` (`sky` / `emerald`).
3. Test cập nhật các fixture cũ trong `game.test.ts` (nếu có chỗ tạo tay `state` có `allClears` thì dùng `createInitialState` đã có `allClears: 0` sẵn) và xác nhận `playDeterministicMatchToEnd(2026)` vẫn kết thúc sạch `< 500` nước đi và qua `verifyMatchReceipt`.

- [ ] **Step 2: Chạy test xác nhận RED trên `game.ts` chưa cập nhật**

Run: `node --test src/blockblast/engine/__tests__/game.test.ts`
Expected: FAIL (`allClears` missing / `stageUp` missing / stage test fails).

- [ ] **Step 3: Cập nhật `src/blockblast/engine/game.ts`**

Chi tiết logic cài đặt sạch sẽ, hàm nhỏ gọn dễ đọc:
1. `countOccupiedCells(grid: Grid): number` (tái dùng cho `getBoardFillRatio` và kiểm tra empty board).
2. `pickStageColor(allClears: number, prngState: number)`: chọn màu từ `getStageTheme(allClears).palette`.
3. `scorePlacementFit(grid: Grid, piece: TrayPiece, row: number, col: number, occupiedBefore: number): number`:
   - Kiểm tra các dòng sẽ ăn `clearedRows`, `clearedCols` (`clearCount = clearedRows.length + clearedCols.length`).
   - Đếm `blockNeighbors` (số cạnh kề ô đã có gạch trên `grid`) và `wallNeighbors` (số cạnh chạm biên `0` hoặc `BOARD_SIZE - 1`).
   - Tính số ô trống đơn lẻ bị bao kín 4 phía sinh ra xung quanh vùng đặt (`newlyIsolated`).
   - Nếu `clearCount > 0`, kiểm tra nhanh xem sau khi xóa các dòng đó bàn có sạch 100% (`occupiedAfter === 0`) không $\rightarrow$ nếu `occupiedBefore <= 16 && occupiedAfter === 0`, cộng `+220` điểm `All Clear`!
   - Tổng điểm: `clearCount * 140 + blockNeighbors * 10 + wallNeighbors * 3 + piece.cells.length * 4 - newlyIsolated * 12 + allClearBonus`.
4. `findBestPlacementForDef(grid: Grid, defPiece: PieceDef, occupied: number)`: trả về `{ row, col, score } | null` tốt nhất trên `grid`.
5. `simulatePlacementOnGrid(grid: Grid, defPiece: PieceDef, row: number, col: number, color: BlockColor): Grid`: đặt mảnh lên bản sao và xóa các dòng đầy để tạo `simGrid` cho bước tiếp theo.
6. `pickSmartPieceForSlot(simGrid, prngState, slotIndex, usedIds, allClears)`:
   - Nếu `occupied < 8` (`fillRatio < 0.125`): rút đa dạng theo trọng số nhóm (`small 35%`, `medium 45%`, `large 20%`), tránh trùng `usedIds`.
   - Nếu `occupied >= 8`: đánh giá tất cả `BLOCK_PIECES` (loại trừ `usedIds` nếu vẫn còn ứng viên khác đặt vừa).
     - Với `slotIndex < 2`: sắp xếp giảm dần theo `bestScore`, lấy top `K = 5` ứng viên (có trọng số ưu tiên top đầu: `[40, 26, 16, 10, 8]`) để chọn bằng PRNG.
     - Với `slotIndex === 2`: vẫn chỉ lấy trong tập đặt vừa `simGrid`, nhưng pha trọng số ưu tiên mảnh `medium`/`large` (khi có) hoặc mảnh xếp đẹp top `K = 8` để người chơi vừa giải được vừa không nhàm chán!
7. `spawnSmartTray(grid, prngState, trayCounter, allClears)`:
   - Mỗi ô trong 3 ô có `bombChance = fillRatio > 0.65 ? 0.12 : 0.08` (tối đa 1 viên `candy_bomb` per tray).
   - Các ô còn lại dùng `pickSmartPieceForSlot` + `simulatePlacementOnGrid` nối tiếp `simGrid` qua từng ô, bảo đảm 3 mảnh sinh ra phối hợp lấp khe trống mượt mà.
   - Giữ fallback bảo chứng nếu `!hasAnyValidMove(grid, tray)` thay `tray[0]` bằng mảnh đặt vừa.
8. Khi `wasOccupied && countOccupiedCells(nextGrid) === 0` trong `placePiece` (cả line-clear và tray `candyBomb`) hoặc `detonateCandyBombAt`:
   - `nextAllClears = state.allClears + 1`
   - `stageUp = true`
   - Re-tint mọi mảnh còn lại trong `nextTray` sang bảng màu `getStageTheme(nextAllClears).palette` bằng `pickStageColor(nextAllClears, rng)` (cập nhật `prngState` sạch sẽ).
   - Lưu ý quan trọng giữ test cũ pass: `allClear` (`+1,000` điểm) vẫn chỉ kích hoạt khi ăn dòng làm sạch bàn (`clearCount > 0 && occupiedAfter === 0`), còn Bom Kẹo làm trống bàn sẽ kích hoạt `stageUp = true` & tăng `allClears` mà giữ nguyên công thức điểm bom `10 + destroyed * 15` / `destroyed * 15`!

- [ ] **Step 4: Chạy toàn bộ test suite (`game.test.ts` + `profileStore.test.ts`) & `npm run typecheck`**

Run:
- `node --test src/blockblast/engine/__tests__/game.test.ts src/store/__tests__/profileStore.test.ts`
- `npm run typecheck`
Expected: PASS (0 errors; verify `playDeterministicMatchToEnd(2026)` completes cleanly and `verifyMatchReceipt` passes).

---

### Task 3: Âm thanh ăn mừng `allClear` & Keyframes WOW CSS (`soundEngine.ts`, `index.css`)

**Files:**
- Modify: `src/audio/soundEngine.ts:1-285`
- Modify: `src/index.css:105-194`

**Interfaces:**
- `soundEngine.ts`: `SfxType` thêm `'allClear'`
- `index.css`: thêm `@keyframes` và classes `.bb-combo-banner`, `.bb-shockwave-ring`, `.bb-line-sweep-h`, `.bb-line-sweep-v`, `.bb-particle-fly`, `.bb-place-pop`, `.bb-board-shake-sm`, `.bb-board-shake-lg`, `.bb-allclear-supernova` (chỉ chạy trong `@media (prefers-reduced-motion: no-preference)` và tôn trọng `:not(.bb-no-motion)`).

- [ ] **Step 1: Cập nhật `src/audio/soundEngine.ts`**
Thêm `'allClear'` vào `SfxType` và `case 'allClear':`:
```ts
      case 'allClear': {
        playNoiseBurst(ctx, { duration: 0.28, filterFreq: 1100, filterType: 'bandpass', gain: 0.24 });
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
        notes.forEach((freq, idx) => {
          playTone(ctx, {
            freq,
            type: idx >= 3 ? 'sine' : 'triangle',
            startOffset: idx * 0.055,
            duration: idx === notes.length - 1 ? 0.42 : 0.16,
            gain: 0.22,
          });
        });
        break;
      }
```

- [ ] **Step 2: Cập nhật `src/index.css`**
Thêm đầy đủ classes & `@keyframes` GPU-only (`transform`, `opacity`, `box-shadow` dịu tối đa 1–2 nhịp, không nhấp nháy > 3Hz):
- `.bb-combo-banner` (trạng thái mặc định `opacity: 1; transform: translate(-50%, -50%);`, khi có chuyển động bật spring pop `0.92s` cho combo hoặc `1.22s` cho `allClear`).
- `.bb-shockwave-ring` (`scale(0.22) -> scale(2.6)`, `opacity: 0.92 -> 0`, `0.58s`).
- `.bb-line-sweep-h` (`scaleX(0.12) -> scaleX(1.04)`, `opacity: 0.95 -> 0`, `0.42s`) và `.bb-line-sweep-v` (`scaleY(0.12) -> scaleY(1.04)`).
- `.bb-particle-fly` dùng CSS vars `--bb-dx`, `--bb-dy`, `--bb-rot` (`translate3d(var(--bb-dx), var(--bb-dy), 0) rotate(var(--bb-rot)) scale(0.35)` + fade out `0.66s`).
- `.bb-place-pop` (`scale(0.84) -> scale(1.04) -> scale(1)`, `0.18s`).
- `.bb-board-shake-sm` (`2px` damped, `0.2s`) & `.bb-board-shake-lg` (`4px` damped, `0.28s`).
- `.bb-allclear-supernova` (1 nhịp bung tỏa hào quang mượt `0.9s`, không strobe).

- [ ] **Step 3: Chạy `npm run typecheck`**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 4: Nâng Cấp Visual Stage & Lớp Nổ Đa Tầng (`BlockBoard.tsx`, `BlockTray.tsx`)

**Files:**
- Modify: `src/blockblast/ui/BlockBoard.tsx`
- Modify: `src/blockblast/ui/BlockTray.tsx`

**Interfaces:**
- Produces:
  - `BurstParticle`: `{ id: string; dx: number; dy: number; rot: number; colorHex: string; sizePx: number; star?: boolean; originXPct?: number; originYPct?: number }`
  - `BurstCallout`: `{ title: string; subtitle?: string; tier: 'normal' | 'multi' | 'combo' | 'bomb' | 'allClear' }`
  - `BurstEffect` mở rộng: thêm `clearedRows?: readonly number[]`, `clearedCols?: readonly number[]`, `particles?: readonly BurstParticle[]`, `shockwaveCount?: number`, `callout?: BurstCallout`, `isAllClear?: boolean`.
  - `BlockBoardProps` thêm: `stageTheme: BoardStageTheme`, `boardShake?: 'none' | 'sm' | 'lg'`, `recentPlacedCells?: readonly { r: number; c: number }[]`.
  - `BlockTrayProps` thêm optional `stageTheme?: BoardStageTheme`.

- [ ] **Step 1: Cập nhật `src/blockblast/ui/BlockBoard.tsx`**
1. Áp dụng `stageTheme.frameClass`, `stageTheme.wellClass`, `stageTheme.cellEvenClass`, `stageTheme.cellOddClass` cho khung và 64 ô bàn (chuyển màu mượt với `transition-[background-color,border-color,box-shadow] duration-500`, riêng khi `bombAiming === true` giữ khung viền cảnh báo hồng đỏ ưu tiên như cũ).
2. Áp dụng `bb-board-shake-sm` / `bb-board-shake-lg` (tắt nếu `reducedMotion`) lên khung bàn khi `boardShake !== 'none'`.
3. Ô trong `recentPlacedCells` phát `.bb-place-pop` mượt (`!reducedMotion`).
4. Trong lớp overlay `pointer-events-none`:
   - Render **Line Sweep Beams** dọc `burst.clearedRows` & `burst.clearedCols` dùng `stageTheme.sweepColorHex`.
   - Render **Shockwave Rings** (`1..3` vòng lệch nhịp delay `0ms, 90ms, 180ms`) tại tâm `(xPct, yPct)`.
   - Render **Burst Particles** (`burst.particles`): các hạt mảnh vỡ & ngôi sao 4 cánh CSS bay tỏa theo `--bb-dx`, `--bb-dy`, `--bb-rot`.
   - Nếu `burst.isAllClear`: phủ thêm ánh sáng `bb-allclear-supernova` mượt trên toàn mặt bàn.
   - Render **Arcade Callout Banner** (`burst.callout`):
     - Nếu `tier === 'normal'`: badge điểm gọn bay lên như cũ (`+40`).
     - Nếu `tier === 'multi' | 'combo' | 'bomb' | 'allClear'`: banner nổi bật cỡ lớn với tiêu đề chính (`DOUBLE!`, `TRIPLE!`, `MEGA ×4!`, `COMBO ×3!`, `BÙM KẸO 3×3!`, `FULL BÀN! +1.000Đ`), kèm dòng phụ (`+450 ĐIỂM`, `LÊN STAGE 2 · HỒ BĂNG CỰC QUANG`...) với gradient viền phát sáng chuẩn từng cấp!

- [ ] **Step 2: Cập nhật `src/blockblast/ui/BlockTray.tsx`**
Dùng `stageTheme?.traySlotClass` (mặc định dùng `STAGE_THEMES[0].traySlotClass`) để 3 khay đựng mảnh cũng hòa nhập tông màu theo Stage hiện tại.

- [ ] **Step 3: Chạy `npm run typecheck`**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 5: Kết Nối Stage, Supernova VFX & Kiểm Chứng Toàn Diện (`BlockBlastScreen.tsx`)

**Files:**
- Modify: `src/screens/BlockBlastScreen.tsx`

**Interfaces:**
- Consumes: `getStageTheme`, `getStageNumber` from `../blockblast/engine/stages`, `playSfx('allClear')` from `../audio/soundEngine`, updated `BlockBoard` & `BlockTray`.

- [ ] **Step 1: Cập nhật `src/screens/BlockBlastScreen.tsx`**
1. Tính `stageTheme = getStageTheme(state.allClears)` và `stageNumber = getStageNumber(state.allClears)`.
2. Bổ sung badge **Stage** gọn đẹp ngay trong Score/Combo HUD (`Stage {stageNumber} · {stageTheme.name}`) dùng `stageTheme.badgeClass`, kèm gợi ý ngắn về số màu sạch (`2–3 màu`).
3. Thêm helper thuần `buildBurstParticles(xPct, yPct, count, paletteColors, isAllClear)` dùng góc vàng (`137.508deg`) tạo tỏa hạt cân đối 360° (không dùng `Math.random()` trong render) — nếu `isAllClear`, sinh thêm hạt xuất phát từ 4 góc + tâm bàn lên tới `stageTheme.allClearParticleCount`!
4. Thêm helper `buildCallout(outcome, lineCount, isBombBlast, stageThemeAfter)` trả về `BurstCallout`:
   - `stageUp / allClear`: `title: outcome.allClear ? \`FULL BÀN! +\${outcome.pointsEarned.toLocaleString('vi-VN')}\` : 'FULL BÀN!'`, `subtitle: \`LÊN STAGE \${outcome.stageAfter} · \${stageThemeAfter.name.toUpperCase()}\``, `tier: 'allClear'`
   - `isBombBlast`: `title: 'BÙM KẸO 3×3!'`, `subtitle: \`+\${outcome.pointsEarned} ĐIỂM\``, `tier: 'bomb'`
   - `streakAfter >= 2`: `title: streakAfter >= 5 ? \`UNSTOPPABLE ×\${streakAfter}!\` : \`COMBO ×\${streakAfter}!\``, `subtitle: lineCount >= 2 ? \`\${lineCount} DÒNG · +\${outcome.pointsEarned}Đ\` : \`+\${outcome.pointsEarned} ĐIỂM\``, `tier: 'combo'`
   - `lineCount >= 2`: `title: lineCount === 2 ? 'DOUBLE!' : lineCount === 3 ? 'TRIPLE!' : \`MEGA ×\${lineCount}!\``, `subtitle: \`+\${outcome.pointsEarned} ĐIỂM\``, `tier: 'multi'`
   - Còn lại (`lineCount === 1` hoặc đặt gạch thường): `title: \`+\${outcome.pointsEarned}\``, `tier: lineCount === 1 ? 'multi' : 'normal'`.
5. Kích hoạt `playSfx('allClear')` khi `outcome.allClear || outcome.stageUp`; bật `boardShake` (`'lg'` cho All Clear / Bom / `>= 2` dòng / Combo `>= 3`, `'sm'` cho ăn 1 dòng ở Stage 2+) với `setTimeout` dọn dẹp sạch trong `burstTimersRef`; bật `recentPlacedCells` ~220ms cho `bb-place-pop`.
6. Dùng thời lượng `BURST_LIFETIME_MS` linh hoạt: `1350ms` cho `stageUp`/`allClear`, `1000ms` cho `combo`/`multi`/`bomb`, `680ms` cho đặt gạch thường.
7. Truyền `stageTheme`, `boardShake`, `recentPlacedCells` vào `<BlockBoard>` và `stageTheme` vào `<BlockTray>`.

- [ ] **Step 2: Chạy toàn bộ test suite & build**

Run:
1. `$testFiles = Get-ChildItem -Path src -Filter *.test.ts -Recurse | ForEach-Object { $_.FullName }; node --test $testFiles`
2. `npm run build`
Expected: Toàn bộ tests PASS, `tsc --noEmit && vite build` PASS (0 errors).

- [ ] **Step 3: Kiểm thử trực quan trên trình duyệt (`browser` subagent)**
Khởi động `npx vite --port 4175 --strictPort`, mở `Block Blast PAWS`:
- Xác nhận Stage 1 (`Cabin Gỗ Ấm`) chỉ xuất hiện 2 màu hài hòa (`Vàng Mật Ong` / `Cam Lò Sưởi`) và khối sinh ra khớp khít các khoảng trống.
- Đặt khối ăn dòng/combo và dùng Bom Kẹo để quan sát trực quan banner Combo, vòng xung kích, hạt vỡ và kiểm tra 0 console errors cả desktop (`1280×800`) lẫn mobile (`360×780`).
- Tắt dev server sau khi xác minh xong.
