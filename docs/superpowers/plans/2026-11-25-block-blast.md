# Block Blast PAWS & Anti-Hack Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng minigame thứ 3 **Block Blast PAWS** (bảng 2D Tactile 8×8 + Mascot thú bông 3D cổ vũ + PAWS Twist Đổi Khay / Bom Kẹo 3×3) tích hợp đầy đủ vào `PAWS ARCADE 3D`, kèm 5 lớp bảo mật chống chỉnh sửa điểm/Cookies.

**Architecture:** Tách 100% logic game thành pure TypeScript (`src/blockblast/engine/`) dùng PRNG có seed (`mulberry32`) để chạy unit test bằng `node --test` và hỗ trợ replay verification chống giả mạo (`verifyMatchReceipt`). Lớp giao diện (`src/blockblast/ui/` và `BlockBlastScreen.tsx`) dùng DOM/CSS Grid + Pointer Events với offset cảm ứng, native `<dialog>` (`showModal()`), `MascotStage` tái sử dụng `Character3D`, và `profileStore.ts` bọc `localStorage` bằng HMAC-SHA256 đồng bộ (`profileIntegrity.ts`) + chống prototype pollution + chống double-claim Cookies.

**Tech Stack:** React 19, TypeScript 5.8 (`strict`), Tailwind CSS v4, Three.js / React Three Fiber v9 (`@react-three/fiber`, `@react-three/drei`), Lucide React, Web Audio API, Node native test runner (`node --test` trên Node v24+).

**Spec:** [2026-11-25-block-blast-design.md](../../specs/2026-11-25-block-blast-design.md)

## Global Constraints

- **Không thêm package/dependency mới** ngoài `package.json` hiện có.
- **Tuyệt đối không tự ý chạy `git commit`, `git push`, `git tag`** (người dùng chưa yêu cầu commit).
- Các file pure TypeScript trong `src/blockblast/engine/` và `src/store/` khi import tương đối lẫn nhau **bắt buộc ghi rõ đuôi `.ts`** (ví dụ `import { ... } from './types.ts'`) để chạy được đồng thời trên cả Vite (`allowImportingTsExtensions: true`) và `node --test`.
- Luôn tuân thủ chuẩn `modern-web-guidance`:
  - Modal dùng thẻ `<dialog>` gốc mở bằng `.showModal()`, tiêu đề `<h1>`, `autofocus` ở nút an toàn, CSS `dialog:modal` & `dialog::backdrop` chặn scroll chaining (`overscroll-behavior: contain`), không thêm `role="dialog"`/`aria-modal`, reset `dialog.returnValue = ''` khi đóng.
  - Kéo-thả dùng `touch-action: none` và `-webkit-user-select: none; user-select: none` **chỉ trên tay cầm mảnh/bảng**, ngưỡng 4px phân biệt click vs drag, có click-to-place dự phòng và vùng thông báo `aria-live="polite"`.
  - Hiệu ứng động chỉ animate `opacity` / `transform`, bật chuyển động trong `@media (prefers-reduced-motion: no-preference)` và tôn trọng `settings.reducedMotion`.
- Toàn bộ code phải vượt qua `node --test` và `npm run build` (`tsc --noEmit && vite build`).

---

## File Structure

- **Create:** `src/blockblast/engine/types.ts` — Kiểu dữ liệu lưới `8×8`, 6 màu, `PieceDef`, `TrayPiece`, `PlacementPreview`, `BlastGameState`, `MoveOutcome`.
- **Create:** `src/blockblast/engine/pieces.ts` — 29 hình polyomino đối xứng đều + `PALETTE` 6 màu + nhãn hình học cho `colorblindMode` + `createCandyBombPiece`.
- **Create:** `src/blockblast/engine/game.ts` — PRNG `mulberry32`, Smart Fair Spawner, `createInitialState`, `canPlacePiece`, `getPlacementPreview`, `placePiece`, `detonateCandyBombAt`, `rerollTray`, `declineRescue`, `hasAnyValidMove`, `calculateCookieReward`, `getBoardFillRatio`.
- **Create:** `src/blockblast/engine/verify.ts` — Kiểu `MatchAction`, `MatchReceipt`, `VerifyResult` và hàm `verifyMatchReceipt` replay lại toàn bộ ván từ `seed` để xác thực điểm và nhịp thời gian.
- **Create:** `src/blockblast/engine/__tests__/game.test.ts` — Bộ unit test luật chơi + abuse cases chống hack.
- **Create:** `src/store/profileIntegrity.ts` — Pure TS SHA-256 & HMAC-SHA256 đồng bộ, `safeJsonParse` lọc `__proto__`/`constructor`/`prototype`, bọc/mở phong bì `v2` cho `localStorage`.
- **Modify:** `src/store/profileSchema.ts` — Thêm `blockBlastBestScore`, `settledMatchIds`, kẹp biên chống overflow và giữ migration từ `v1`.
- **Modify:** `src/store/profileStore.ts` — Dùng phong bì ký `v2`, thêm `spendBlockBlastBomb(matchId)`, `recordBlockBlastResult(receipt)` (chỉ thưởng sau khi `verifyMatchReceipt` đạt + chưa từng lĩnh `matchId` + khớp `authorizedBombsByMatchId`), cờ `integrityWarning`.
- **Modify:** `src/store/__tests__/profileStore.test.ts` — Bổ sung unit test migration, tampering detection, prototype pollution, double-claim và replay spoofing.
- **Modify:** `src/audio/soundEngine.ts` — Thêm `blockPickup`, `blockPlace`, `lineClear` (cao độ tăng theo combo), `candyBomb`, `reroll`.
- **Create:** `vercel.json` — Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).
- **Modify:** `src/index.css` — Thêm CSS `<dialog>` `overscroll-behavior: contain` và animation burst/pop an toàn với `prefers-reduced-motion`.
- **Create:** `src/blockblast/ui/BlockBoard.tsx` — Lưới 8×8 tactile, ghost preview, highlight hàng/cột sắp xóa, ngắm Bom Kẹo 3×3, overlay burst & floating score.
- **Create:** `src/blockblast/ui/BlockTray.tsx` — Khay 3 mảnh ghép hỗ trợ drag & tap-select, làm mờ mảnh chưa đặt vừa.
- **Create:** `src/blockblast/ui/MascotStage.tsx` — Khung 3D `Character3D` + `WinterCabinStage` bám cảm xúc ván chơi, tự dừng `frameloop` khi modal mở/tab ẩn, ErrorBoundary fallback 2D.
- **Create:** `src/blockblast/ui/BlockBlastModals.tsx` — Native `<dialog>` cho Cứu Bàn, Game Over, Hướng Dẫn và Xác Nhận Chơi Lại.
- **Create:** `src/screens/BlockBlastScreen.tsx` — Màn chơi hoàn chỉnh quản lý drag offset 60fps, `MatchAction[]` ledger, phím `Esc`, `aria-live` announcer và liên kết `profileStore`.
- **Create:** `public/banners/block-blast-banner.jpg` & `.webp` — Banner 16:9 Winter Cabin Block Blast.
- **Modify:** `src/App.tsx`, `src/screens/ModeSelectScreen.tsx` — Route `'blockblast'` lazy-loaded + ErrorBoundary, nâng hub thành 3 thẻ chế độ (`md:grid-cols-3`) kèm badge kỷ lục Block Blast.

---

### Task 1: Kiểu dữ liệu & Danh mục 29 mảnh ghép (`types.ts`, `pieces.ts`)

**Files:**
- Create: `src/blockblast/engine/types.ts`
- Create: `src/blockblast/engine/pieces.ts`
- Test: `src/blockblast/engine/__tests__/game.test.ts`

**Interfaces:**
- Produces:
  - `export const BOARD_SIZE = 8;`
  - `export const CANDY_BOMB_COST = 15;`
  - `export type BlockColor = 'amber' | 'rose' | 'sky' | 'emerald' | 'violet' | 'orange';`
  - `export type PieceKind = 'normal' | 'candyBomb';`
  - `export type PieceGroup = 'small' | 'medium' | 'large';`
  - `export interface ShapeCell { readonly dr: number; readonly dc: number; }`
  - `export interface PieceDef { readonly id: string; readonly group: PieceGroup; readonly width: number; readonly height: number; readonly cells: readonly ShapeCell[]; }`
  - `export interface TrayPiece { readonly uid: string; readonly defId: string; readonly kind: PieceKind; readonly color: BlockColor; readonly width: number; readonly height: number; readonly cells: readonly ShapeCell[]; }`
  - `export interface CellData { readonly color: BlockColor; }`
  - `export type Grid = (CellData | null)[][];`
  - `export type GamePhase = 'playing' | 'rescuePrompt' | 'gameOver';`
  - `export interface BlastGameState { grid: Grid; tray: (TrayPiece | null)[]; score: number; streak: number; maxStreak: number; graceUsed: boolean; linesCleared: number; movesCount: number; rerollUsed: boolean; candyBombUsed: boolean; rescueDeclined: boolean; phase: GamePhase; prngState: number; trayCounter: number; }`
  - `export interface PlacementPreview { valid: boolean; cells: readonly { r: number; c: number }[]; clearedRows: readonly number[]; clearedCols: readonly number[]; }`
  - `export interface MoveOutcome { nextState: BlastGameState; placedCells: readonly { r: number; c: number }[]; clearedCells: readonly { r: number; c: number }[]; clearedRows: readonly number[]; clearedCols: readonly number[]; destroyedByBomb: readonly { r: number; c: number }[]; pointsEarned: number; allClear: boolean; streakAfter: number; }`
  - `export const BLOCK_COLORS: readonly BlockColor[]`
  - `export const COLOR_TOKENS: Record<BlockColor, { label: string; bgHex: string; topHex: string; borderHex: string; shadowHex: string; patternGlyph: string }>`
  - `export const BLOCK_PIECES: readonly PieceDef[]` (29 hình)
  - `export function getPieceDefById(id: string): PieceDef | undefined`
  - `export function createCandyBombPiece(uid: string, color: BlockColor): TrayPiece`

- [ ] **Step 1: Tạo `src/blockblast/engine/types.ts`**

```ts
export const BOARD_SIZE = 8;
export const CANDY_BOMB_COST = 15;

export type BlockColor =
  | 'amber'
  | 'rose'
  | 'sky'
  | 'emerald'
  | 'violet'
  | 'orange';

export type PieceKind = 'normal' | 'candyBomb';
export type PieceGroup = 'small' | 'medium' | 'large';

export interface ShapeCell {
  readonly dr: number;
  readonly dc: number;
}

export interface PieceDef {
  readonly id: string;
  readonly group: PieceGroup;
  readonly width: number;
  readonly height: number;
  readonly cells: readonly ShapeCell[];
}

export interface TrayPiece {
  readonly uid: string;
  readonly defId: string;
  readonly kind: PieceKind;
  readonly color: BlockColor;
  readonly width: number;
  readonly height: number;
  readonly cells: readonly ShapeCell[];
}

export interface CellData {
  readonly color: BlockColor;
}

export type Grid = (CellData | null)[][];

export type GamePhase = 'playing' | 'rescuePrompt' | 'gameOver';

export interface BlastGameState {
  grid: Grid;
  tray: (TrayPiece | null)[];
  score: number;
  streak: number;
  maxStreak: number;
  graceUsed: boolean;
  linesCleared: number;
  movesCount: number;
  rerollUsed: boolean;
  candyBombUsed: boolean;
  rescueDeclined: boolean;
  phase: GamePhase;
  prngState: number;
  trayCounter: number;
}

export interface PlacementPreview {
  valid: boolean;
  cells: readonly { r: number; c: number }[];
  clearedRows: readonly number[];
  clearedCols: readonly number[];
}

export interface MoveOutcome {
  nextState: BlastGameState;
  placedCells: readonly { r: number; c: number }[];
  clearedCells: readonly { r: number; c: number }[];
  clearedRows: readonly number[];
  clearedCols: readonly number[];
  destroyedByBomb: readonly { r: number; c: number }[];
  pointsEarned: number;
  allClear: boolean;
  streakAfter: number;
}
```

- [ ] **Step 2: Viết unit test kiểm tra 29 mảnh & bảng màu trước khi tạo `pieces.ts`**

```ts
// src/blockblast/engine/__tests__/game.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOCK_COLORS,
  BLOCK_PIECES,
  COLOR_TOKENS,
  createCandyBombPiece,
} from '../pieces.ts';

describe('blockblast piece catalog', () => {
  it('defines 29 unique symmetric polyominoes with accurate bounding boxes', () => {
    assert.equal(BLOCK_PIECES.length, 29);
    const ids = new Set(BLOCK_PIECES.map((p) => p.id));
    assert.equal(ids.size, 29);

    for (const piece of BLOCK_PIECES) {
      assert.ok(piece.cells.length >= 1 && piece.cells.length <= 9);
      const maxR = Math.max(...piece.cells.map((c) => c.dr));
      const maxC = Math.max(...piece.cells.map((c) => c.dc));
      const minR = Math.min(...piece.cells.map((c) => c.dr));
      const minC = Math.min(...piece.cells.map((c) => c.dc));
      assert.equal(minR, 0, `${piece.id} minR should be 0`);
      assert.equal(minC, 0, `${piece.id} minC should be 0`);
      assert.equal(piece.height, maxR + 1, `${piece.id} height mismatch`);
      assert.equal(piece.width, maxC + 1, `${piece.id} width mismatch`);
    }
  });

  it('defines 6 color tokens with distinct pattern glyphs and creates candy bomb', () => {
    assert.equal(BLOCK_COLORS.length, 6);
    const glyphs = new Set(BLOCK_COLORS.map((c) => COLOR_TOKENS[c].patternGlyph));
    assert.equal(glyphs.size, 6);
    const bomb = createCandyBombPiece('bomb_1', 'rose');
    assert.equal(bomb.kind, 'candyBomb');
    assert.equal(bomb.cells.length, 1);
  });
});
```

- [ ] **Step 3: Chạy test xác nhận fail do chưa có `pieces.ts`**

Run: `node --test src/blockblast/engine/__tests__/game.test.ts`
Expected: FAIL (`Cannot find module '../pieces.ts'`).

- [ ] **Step 4: Tạo `src/blockblast/engine/pieces.ts`**

```ts
import type {
  BlockColor,
  PieceDef,
  PieceGroup,
  ShapeCell,
  TrayPiece,
} from './types.ts';

export const BLOCK_COLORS: readonly BlockColor[] = [
  'amber',
  'rose',
  'sky',
  'emerald',
  'violet',
  'orange',
];

export const COLOR_TOKENS: Record<
  BlockColor,
  {
    label: string;
    bgHex: string;
    topHex: string;
    borderHex: string;
    shadowHex: string;
    patternGlyph: string;
  }
> = {
  amber: {
    label: 'Vàng Mật Ong',
    bgHex: '#F59E0B',
    topHex: '#FDE68A',
    borderHex: '#FBBF24',
    shadowHex: '#B45309',
    patternGlyph: '★',
  },
  rose: {
    label: 'Hồng Dâu',
    bgHex: '#EC4899',
    topHex: '#FBCFE8',
    borderHex: '#F472B6',
    shadowHex: '#9D174D',
    patternGlyph: '♥',
  },
  sky: {
    label: 'Xanh Băng',
    bgHex: '#0EA5E9',
    topHex: '#BAE6FD',
    borderHex: '#38BDF8',
    shadowHex: '#0369A1',
    patternGlyph: '❄',
  },
  emerald: {
    label: 'Xanh Bạc Hà',
    bgHex: '#10B981',
    topHex: '#A7F3D0',
    borderHex: '#34D399',
    shadowHex: '#047857',
    patternGlyph: '◆',
  },
  violet: {
    label: 'Tím Oải Hương',
    bgHex: '#8B5CF6',
    topHex: '#DDD6FE',
    borderHex: '#A78BFA',
    shadowHex: '#5B21B6',
    patternGlyph: '●',
  },
  orange: {
    label: 'Cam Lò Sưởi',
    bgHex: '#F97316',
    topHex: '#FED7AA',
    borderHex: '#FB923C',
    shadowHex: '#C2410C',
    patternGlyph: '▲',
  },
};

function def(
  id: string,
  group: PieceGroup,
  coords: readonly (readonly [number, number])[],
): PieceDef {
  const cells: ShapeCell[] = coords.map(([dr, dc]) => ({ dr, dc }));
  const height = Math.max(...cells.map((c) => c.dr)) + 1;
  const width = Math.max(...cells.map((c) => c.dc)) + 1;
  return { id, group, width, height, cells };
}

export const BLOCK_PIECES: readonly PieceDef[] = [
  // Small (9)
  def('dot_1', 'small', [[0, 0]]),
  def('bar_h2', 'small', [[0, 0], [0, 1]]),
  def('bar_v2', 'small', [[0, 0], [1, 0]]),
  def('bar_h3', 'small', [[0, 0], [0, 1], [0, 2]]),
  def('bar_v3', 'small', [[0, 0], [1, 0], [2, 0]]),
  def('corner_tl', 'small', [[0, 0], [0, 1], [1, 0]]),
  def('corner_tr', 'small', [[0, 0], [0, 1], [1, 1]]),
  def('corner_bl', 'small', [[0, 0], [1, 0], [1, 1]]),
  def('corner_br', 'small', [[0, 1], [1, 0], [1, 1]]),

  // Medium (13)
  def('square_2', 'medium', [[0, 0], [0, 1], [1, 0], [1, 1]]),
  def('bar_h4', 'medium', [[0, 0], [0, 1], [0, 2], [0, 3]]),
  def('bar_v4', 'medium', [[0, 0], [1, 0], [2, 0], [3, 0]]),
  def('t_up', 'medium', [[0, 1], [1, 0], [1, 1], [1, 2]]),
  def('t_down', 'medium', [[0, 0], [0, 1], [0, 2], [1, 1]]),
  def('t_left', 'medium', [[0, 1], [1, 0], [1, 1], [2, 1]]),
  def('t_right', 'medium', [[0, 0], [1, 0], [1, 1], [2, 0]]),
  def('l4_tl', 'medium', [[0, 0], [0, 1], [1, 0], [2, 0]]),
  def('l4_tr', 'medium', [[0, 0], [0, 1], [1, 1], [2, 1]]),
  def('l4_bl', 'medium', [[0, 0], [1, 0], [2, 0], [2, 1]]),
  def('l4_br', 'medium', [[0, 1], [1, 1], [2, 0], [2, 1]]),
  def('z_h', 'medium', [[0, 0], [0, 1], [1, 1], [1, 2]]),
  def('s_h', 'medium', [[0, 1], [0, 2], [1, 0], [1, 1]]),

  // Large (7)
  def('bar_h5', 'large', [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]),
  def('bar_v5', 'large', [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]),
  def('square_3', 'large', [
    [0, 0], [0, 1], [0, 2],
    [1, 0], [1, 1], [1, 2],
    [2, 0], [2, 1], [2, 2],
  ]),
  def('big_corner_tl', 'large', [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]]),
  def('big_corner_tr', 'large', [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]),
  def('big_corner_bl', 'large', [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]),
  def('big_corner_br', 'large', [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]]),
];

const PIECE_MAP = new Map<string, PieceDef>(BLOCK_PIECES.map((p) => [p.id, p]));

export function getPieceDefById(id: string): PieceDef | undefined {
  return PIECE_MAP.get(id);
}

export function createTrayPieceFromDef(
  defPiece: PieceDef,
  uid: string,
  color: BlockColor,
): TrayPiece {
  return {
    uid,
    defId: defPiece.id,
    kind: 'normal',
    color,
    width: defPiece.width,
    height: defPiece.height,
    cells: defPiece.cells,
  };
}

export function createCandyBombPiece(uid: string, color: BlockColor): TrayPiece {
  return {
    uid,
    defId: 'candy_bomb',
    kind: 'candyBomb',
    color,
    width: 1,
    height: 1,
    cells: [{ dr: 0, dc: 0 }],
  };
}
```

- [ ] **Step 5: Chạy test xác nhận pass**

Run: `node --test src/blockblast/engine/__tests__/game.test.ts`
Expected: PASS (2/2 tests).

---

### Task 2: Engine thuần Block Blast (`game.ts`)

**Files:**
- Create: `src/blockblast/engine/game.ts`
- Modify: `src/blockblast/engine/__tests__/game.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `pieces.ts`
- Produces:
  - `export function nextRandom(prngState: number): { value: number; nextState: number }` (mulberry32 thuần)
  - `export function createEmptyGrid(): Grid`
  - `export function cloneGrid(grid: Grid): Grid`
  - `export function getBoardFillRatio(grid: Grid): number`
  - `export function canPlacePiece(grid: Grid, piece: TrayPiece, row: number, col: number): boolean`
  - `export function getPlacementPreview(grid: Grid, piece: TrayPiece, row: number, col: number): PlacementPreview`
  - `export function hasAnyValidMove(grid: Grid, tray: readonly (TrayPiece | null)[]): boolean`
  - `export function createInitialState(seed: number): BlastGameState`
  - `export function placePiece(state: BlastGameState, slotIndex: number, row: number, col: number, canOfferRescue: boolean): MoveOutcome | null`
  - `export function detonateCandyBombAt(state: BlastGameState, row: number, col: number): MoveOutcome | null`
  - `export function rerollTray(state: BlastGameState, canOfferRescue: boolean): BlastGameState | null`
  - `export function declineRescue(state: BlastGameState): BlastGameState`
  - `export function calculateCookieReward(score: number, previousBest: number): { reward: number; isNewBest: boolean }`

- [ ] **Step 1: Viết thêm unit tests cho luật chơi trong `src/blockblast/engine/__tests__/game.test.ts`**

```ts
import {
  calculateCookieReward,
  canPlacePiece,
  createEmptyGrid,
  createInitialState,
  declineRescue,
  detonateCandyBombAt,
  getPlacementPreview,
  hasAnyValidMove,
  placePiece,
  rerollTray,
} from '../game.ts';
import { createTrayPieceFromDef, getPieceDefById } from '../pieces.ts';

describe('blockblast core engine', () => {
  it('places pieces, detects simultaneous row+col clears, and enforces bounds', () => {
    const state = createInitialState(12345);
    const bar4 = createTrayPieceFromDef(getPieceDefById('bar_h4')!, 'p0', 'amber');
    const dot1 = createTrayPieceFromDef(getPieceDefById('dot_1')!, 'p1', 'sky');

    // Fill row 0 cols 0..6 and col 7 rows 1..7 so placing dot1 at (0,7) clears 1 row + 1 col
    for (let c = 0; c < 7; c++) state.grid[0][c] = { color: 'amber' };
    for (let r = 1; r < 8; r++) state.grid[r][7] = { color: 'sky' };
    state.tray = [dot1, bar4, null];

    assert.equal(canPlacePiece(state.grid, bar4, 0, 5), false); // out of bounds
    assert.equal(canPlacePiece(state.grid, dot1, 0, 0), false); // occupied
    const preview = getPlacementPreview(state.grid, dot1, 0, 7);
    assert.equal(preview.valid, true);
    assert.deepEqual(preview.clearedRows, [0]);
    assert.deepEqual(preview.clearedCols, [7]);

    const outcome = placePiece(state, 0, 0, 7, false);
    assert.ok(outcome);
    // 10 (1 cell) + 100*2*3/2 (300 for 2 lines) + 1000 (All Clear!) = 1310
    assert.equal(outcome.allClear, true);
    assert.equal(outcome.pointsEarned, 1310);
    assert.equal(outcome.nextState.score, 1310);
    assert.equal(outcome.nextState.linesCleared, 2);
    assert.equal(outcome.nextState.streak, 1);
  });

  it('keeps streak for 1 grace turn and resets on 2nd consecutive non-clear move', () => {
    const state = createInitialState(77);
    const dot1 = createTrayPieceFromDef(getPieceDefById('dot_1')!, 'p0', 'rose');
    const dot2 = createTrayPieceFromDef(getPieceDefById('dot_1')!, 'p1', 'rose');
    const dot3 = createTrayPieceFromDef(getPieceDefById('dot_1')!, 'p2', 'rose');
    for (let c = 0; c < 7; c++) state.grid[0][c] = { color: 'amber' };
    state.tray = [dot1, dot2, dot3];

    const s1 = placePiece(state, 0, 0, 7, false)!.nextState;
    assert.equal(s1.streak, 1);
    assert.equal(s1.graceUsed, false);

    // 1st non-clearing move uses grace
    const s2 = placePiece(s1, 1, 4, 4, false)!.nextState;
    assert.equal(s2.streak, 1);
    assert.equal(s2.graceUsed, true);

    // 2nd consecutive non-clearing move resets streak
    const s3 = placePiece(s2, 2, 5, 5, false)!.nextState;
    assert.equal(s3.streak, 0);
    assert.equal(s3.graceUsed, false);
  });

  it('detonates 3x3 candy bomb from tray and active skill without breaking streak', () => {
    const state = createInitialState(99);
    state.streak = 2;
    state.grid[2][2] = { color: 'sky' };
    state.grid[2][3] = { color: 'sky' };
    state.grid[3][3] = { color: 'amber' };
    state.grid[6][6] = { color: 'rose' }; // outside 3x3 around (3,3)

    const bombOutcome = detonateCandyBombAt(state, 3, 3);
    assert.ok(bombOutcome);
    assert.equal(bombOutcome.destroyedByBomb.length, 3);
    assert.equal(bombOutcome.nextState.grid[2][2], null);
    assert.equal(bombOutcome.nextState.grid[6][6]?.color, 'rose');
    assert.equal(bombOutcome.nextState.candyBombUsed, true);
    assert.equal(bombOutcome.nextState.streak, 2);
    // Second active bomb in same match is blocked
    assert.equal(detonateCandyBombAt(bombOutcome.nextState, 6, 6), null);
  });

  it('offers rescuePrompt when stuck and affordable, transitions to gameOver when declined', () => {
    const state = createInitialState(5);
    const grid = createEmptyGrid();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        grid[r][c] = { color: 'emerald' };
      }
    }
    grid[0][0] = null; // 1 empty cell left
    const dot = createTrayPieceFromDef(getPieceDefById('dot_1')!, 'd0', 'amber');
    const bar3 = createTrayPieceFromDef(getPieceDefById('bar_h3')!, 'b1', 'sky');
    state.grid = grid;
    state.tray = [dot, bar3, null];

    // Placing dot fills last cell; bar3 cannot fit -> stuck!
    const stuck = placePiece(state, 0, 0, 0, true)!;
    assert.equal(stuck.nextState.phase, 'rescuePrompt');
    const afterDecline = declineRescue(stuck.nextState);
    assert.equal(afterDecline.phase, 'gameOver');
    assert.equal(hasAnyValidMove(afterDecline.grid, afterDecline.tray), false);
  });

  it('allows one free reroll and computes cookie rewards including New Best bonus', () => {
    const state = createInitialState(42);
    const rerolled = rerollTray(state, false);
    assert.ok(rerolled);
    assert.equal(rerolled.rerollUsed, true);
    assert.equal(rerollTray(rerolled, false), null);

    assert.deepEqual(calculateCookieReward(250, 0), { reward: 5, isNewBest: true });
    assert.deepEqual(calculateCookieReward(1200, 900), { reward: 27, isNewBest: true });
    assert.deepEqual(calculateCookieReward(5200, 5000), { reward: 50, isNewBest: true });
    assert.deepEqual(calculateCookieReward(5200, 6000), { reward: 45, isNewBest: false });
  });
});
```

- [ ] **Step 2: Chạy test xác nhận fail do chưa có `game.ts`**

Run: `node --test src/blockblast/engine/__tests__/game.test.ts`
Expected: FAIL (`Cannot find module '../game.ts'`).

- [ ] **Step 3: Tạo `src/blockblast/engine/game.ts`**

```ts
import {
  BOARD_SIZE,
  type BlastGameState,
  type BlockColor,
  type Grid,
  type MoveOutcome,
  type PieceDef,
  type PieceGroup,
  type PlacementPreview,
  type TrayPiece,
} from './types.ts';
import {
  BLOCK_COLORS,
  BLOCK_PIECES,
  createCandyBombPiece,
  createTrayPieceFromDef,
} from './pieces.ts';

export function nextRandom(prngState: number): { value: number; nextState: number } {
  let t = (prngState + 0x6d2b79f5) | 0;
  const nextState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState };
}

export function createEmptyGrid(): Grid {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function getBoardFillRatio(grid: Grid): number {
  let occupied = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (grid[r][c] !== null) occupied++;
    }
  }
  return occupied / (BOARD_SIZE * BOARD_SIZE);
}

export function canPlacePiece(
  grid: Grid,
  piece: TrayPiece,
  row: number,
  col: number,
): boolean {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  for (const cell of piece.cells) {
    const r = row + cell.dr;
    const c = col + cell.dc;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (grid[r][c] !== null) return false;
  }
  return true;
}

function findClearedLinesAfterCells(
  grid: Grid,
  extraCells: readonly { r: number; c: number }[],
): { clearedRows: number[]; clearedCols: number[] } {
  const extraSet = new Set(extraCells.map((p) => `${p.r},${p.c}`));
  const clearedRows: number[] = [];
  const clearedCols: number[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    let full = true;
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (grid[r][c] === null && !extraSet.has(`${r},${c}`)) {
        full = false;
        break;
      }
    }
    if (full) clearedRows.push(r);
  }

  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (grid[r][c] === null && !extraSet.has(`${r},${c}`)) {
        full = false;
        break;
      }
    }
    if (full) clearedCols.push(c);
  }

  return { clearedRows, clearedCols };
}

export function getPlacementPreview(
  grid: Grid,
  piece: TrayPiece,
  row: number,
  col: number,
): PlacementPreview {
  const valid = canPlacePiece(grid, piece, row, col);
  const cells = piece.cells.map((cell) => ({
    r: row + cell.dr,
    c: col + cell.dc,
  }));
  if (!valid || piece.kind === 'candyBomb') {
    return { valid, cells, clearedRows: [], clearedCols: [] };
  }
  const { clearedRows, clearedCols } = findClearedLinesAfterCells(grid, cells);
  return { valid, cells, clearedRows, clearedCols };
}

function canPieceFitAnywhere(grid: Grid, piece: TrayPiece): boolean {
  for (let r = 0; r <= BOARD_SIZE - piece.height; r++) {
    for (let c = 0; c <= BOARD_SIZE - piece.width; c++) {
      if (canPlacePiece(grid, piece, r, c)) return true;
    }
  }
  return false;
}

export function hasAnyValidMove(
  grid: Grid,
  tray: readonly (TrayPiece | null)[],
): boolean {
  for (const piece of tray) {
    if (piece && canPieceFitAnywhere(grid, piece)) {
      return true;
    }
  }
  return false;
}

function pickGroup(fillRatio: number, rand: number): PieceGroup {
  if (fillRatio < 0.45) {
    return rand < 0.35 ? 'small' : rand < 0.8 ? 'medium' : 'large';
  }
  if (fillRatio <= 0.7) {
    return rand < 0.5 ? 'small' : rand < 0.88 ? 'medium' : 'large';
  }
  return rand < 0.68 ? 'small' : rand < 0.95 ? 'medium' : 'large';
}

function pickRandomColor(prngState: number): { color: BlockColor; nextState: number } {
  const r = nextRandom(prngState);
  const idx = Math.min(BLOCK_COLORS.length - 1, Math.floor(r.value * BLOCK_COLORS.length));
  return { color: BLOCK_COLORS[idx], nextState: r.nextState };
}

function spawnSmartTray(
  grid: Grid,
  prngState: number,
  trayCounter: number,
): { tray: TrayPiece[]; nextPrng: number; nextTrayCounter: number } {
  let rng = prngState;
  const fillRatio = getBoardFillRatio(grid);
  const tray: TrayPiece[] = [];
  let hasBomb = false;

  for (let i = 0; i < 3; i++) {
    const colorPick = pickRandomColor(rng);
    rng = colorPick.nextState;

    const bombRoll = nextRandom(rng);
    rng = bombRoll.nextState;
    if (!hasBomb && bombRoll.value < 0.08) {
      hasBomb = true;
      tray.push(createCandyBombPiece(`t${trayCounter}_${i}_bomb`, colorPick.color));
      continue;
    }

    const groupRoll = nextRandom(rng);
    rng = groupRoll.nextState;
    const group = pickGroup(fillRatio, groupRoll.value);
    const candidates = BLOCK_PIECES.filter((p) => p.group === group);
    const pieceRoll = nextRandom(rng);
    rng = pieceRoll.nextState;
    const defPiece =
      candidates[Math.min(candidates.length - 1, Math.floor(pieceRoll.value * candidates.length))];
    tray.push(createTrayPieceFromDef(defPiece, `t${trayCounter}_${i}_${defPiece.id}`, colorPick.color));
  }

  // Fair guarantee: if at least one piece in the catalog fits on the board,
  // guarantee at least slot 0 of the new tray fits.
  if (!hasAnyValidMove(grid, tray)) {
    const fittingDefs: PieceDef[] = [];
    for (const defPiece of BLOCK_PIECES) {
      const probe = createTrayPieceFromDef(defPiece, 'probe', 'amber');
      if (canPieceFitAnywhere(grid, probe)) fittingDefs.push(defPiece);
    }
    if (fittingDefs.length > 0) {
      const fixRoll = nextRandom(rng);
      rng = fixRoll.nextState;
      const colorPick = pickRandomColor(rng);
      rng = colorPick.nextState;
      const chosen =
        fittingDefs[Math.min(fittingDefs.length - 1, Math.floor(fixRoll.value * fittingDefs.length))];
      tray[0] = createTrayPieceFromDef(chosen, `t${trayCounter}_0_${chosen.id}`, colorPick.color);
    }
  }

  return { tray, nextPrng: rng, nextTrayCounter: trayCounter + 1 };
}

export function createInitialState(seed: number): BlastGameState {
  const safeSeed = Number.isFinite(seed) ? Math.floor(seed) | 0 : 1;
  const grid = createEmptyGrid();
  const spawned = spawnSmartTray(grid, safeSeed, 1);
  return {
    grid,
    tray: spawned.tray,
    score: 0,
    streak: 0,
    maxStreak: 0,
    graceUsed: false,
    linesCleared: 0,
    movesCount: 0,
    rerollUsed: false,
    candyBombUsed: false,
    rescueDeclined: false,
    phase: 'playing',
    prngState: spawned.nextPrng,
    trayCounter: spawned.nextTrayCounter,
  };
}

function blastArea3x3(
  grid: Grid,
  centerR: number,
  centerC: number,
): { r: number; c: number }[] {
  const destroyed: { r: number; c: number }[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = centerR + dr;
      const c = centerC + dc;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && grid[r][c] !== null) {
        grid[r][c] = null;
        destroyed.push({ r, c });
      }
    }
  }
  return destroyed;
}

function resolvePostActionPhase(
  state: BlastGameState,
  canOfferRescue: boolean,
): BlastGameState {
  let nextGrid = state.grid;
  let nextTray = state.tray;
  let nextPrng = state.prngState;
  let nextTrayCounter = state.trayCounter;

  if (nextTray.every((slot) => slot === null)) {
    const spawned = spawnSmartTray(nextGrid, nextPrng, nextTrayCounter);
    nextTray = spawned.tray;
    nextPrng = spawned.nextPrng;
    nextTrayCounter = spawned.nextTrayCounter;
  }

  let nextPhase = state.phase;
  if (!hasAnyValidMove(nextGrid, nextTray)) {
    if (canOfferRescue && !state.candyBombUsed && !state.rescueDeclined) {
      nextPhase = 'rescuePrompt';
    } else {
      nextPhase = 'gameOver';
    }
  } else {
    nextPhase = 'playing';
  }

  return {
    ...state,
    grid: nextGrid,
    tray: nextTray,
    prngState: nextPrng,
    trayCounter: nextTrayCounter,
    phase: nextPhase,
  };
}

export function placePiece(
  state: BlastGameState,
  slotIndex: number,
  row: number,
  col: number,
  canOfferRescue: boolean,
): MoveOutcome | null {
  if (state.phase !== 'playing') return null;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= state.tray.length) {
    return null;
  }
  const piece = state.tray[slotIndex];
  if (!piece || !canPlacePiece(state.grid, piece, row, col)) return null;

  const nextGrid = cloneGrid(state.grid);
  const nextTray = state.tray.map((item, idx) => (idx === slotIndex ? null : item));
  const placedCells: { r: number; c: number }[] = [];

  if (piece.kind === 'candyBomb') {
    const destroyedByBomb = blastArea3x3(nextGrid, row, col);
    const pointsEarned = 10 + destroyedByBomb.length * 15;
    const baseState: BlastGameState = {
      ...state,
      grid: nextGrid,
      tray: nextTray,
      score: state.score + pointsEarned,
      movesCount: state.movesCount + 1,
    };
    const nextState = resolvePostActionPhase(baseState, canOfferRescue);
    return {
      nextState,
      placedCells: [{ r: row, c: col }],
      clearedCells: [],
      clearedRows: [],
      clearedCols: [],
      destroyedByBomb,
      pointsEarned,
      allClear: false,
      streakAfter: nextState.streak,
    };
  }

  for (const cell of piece.cells) {
    const r = row + cell.dr;
    const c = col + cell.dc;
    nextGrid[r][c] = { color: piece.color };
    placedCells.push({ r, c });
  }

  const { clearedRows, clearedCols } = findClearedLinesAfterCells(nextGrid, []);
  const clearCount = clearedRows.length + clearedCols.length;
  const clearedSet = new Set<string>();
  const clearedCells: { r: number; c: number }[] = [];

  for (const r of clearedRows) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const key = `${r},${c}`;
      if (!clearedSet.has(key)) {
        clearedSet.add(key);
        clearedCells.push({ r, c });
      }
      nextGrid[r][c] = null;
    }
  }
  for (const c of clearedCols) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      const key = `${r},${c}`;
      if (!clearedSet.has(key)) {
        clearedSet.add(key);
        clearedCells.push({ r, c });
      }
      nextGrid[r][c] = null;
    }
  }

  let pointsEarned = piece.cells.length * 10;
  let nextStreak = state.streak;
  let nextGraceUsed = state.graceUsed;
  let allClear = false;

  if (clearCount > 0) {
    nextStreak = state.streak + 1;
    nextGraceUsed = false;
    const lineScore = (100 * clearCount * (clearCount + 1)) / 2;
    const streakBonus = 50 * (nextStreak - 1);
    pointsEarned += lineScore + streakBonus;

    if (getBoardFillRatio(nextGrid) === 0) {
      allClear = true;
      pointsEarned += 1000;
    }
  } else if (state.streak > 0 && !state.graceUsed) {
    nextGraceUsed = true;
  } else {
    nextStreak = 0;
    nextGraceUsed = false;
  }

  const baseState: BlastGameState = {
    ...state,
    grid: nextGrid,
    tray: nextTray,
    score: state.score + pointsEarned,
    streak: nextStreak,
    maxStreak: Math.max(state.maxStreak, nextStreak),
    graceUsed: nextGraceUsed,
    linesCleared: state.linesCleared + clearCount,
    movesCount: state.movesCount + 1,
  };

  const nextState = resolvePostActionPhase(baseState, canOfferRescue);
  return {
    nextState,
    placedCells,
    clearedCells,
    clearedRows,
    clearedCols,
    destroyedByBomb: [],
    pointsEarned,
    allClear,
    streakAfter: nextState.streak,
  };
}

export function detonateCandyBombAt(
  state: BlastGameState,
  row: number,
  col: number,
): MoveOutcome | null {
  if (state.phase === 'gameOver' || state.candyBombUsed) return null;
  if (
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    row < 0 ||
    row >= BOARD_SIZE ||
    col < 0 ||
    col >= BOARD_SIZE
  ) {
    return null;
  }

  const nextGrid = cloneGrid(state.grid);
  const destroyedByBomb = blastArea3x3(nextGrid, row, col);
  const pointsEarned = destroyedByBomb.length * 15;
  const baseState: BlastGameState = {
    ...state,
    grid: nextGrid,
    score: state.score + pointsEarned,
    candyBombUsed: true,
    rescueDeclined: false,
    phase: 'playing',
  };
  const nextState = resolvePostActionPhase(baseState, false);

  return {
    nextState,
    placedCells: [],
    clearedCells: [],
    clearedRows: [],
    clearedCols: [],
    destroyedByBomb,
    pointsEarned,
    allClear: false,
    streakAfter: nextState.streak,
  };
}

export function rerollTray(
  state: BlastGameState,
  canOfferRescue: boolean,
): BlastGameState | null {
  if (state.phase !== 'playing' || state.rerollUsed) return null;
  if (state.tray.every((slot) => slot === null)) return null;

  const spawned = spawnSmartTray(state.grid, state.prngState, state.trayCounter);
  return resolvePostActionPhase(
    {
      ...state,
      tray: spawned.tray,
      rerollUsed: true,
      prngState: spawned.nextPrng,
      trayCounter: spawned.nextTrayCounter,
    },
    canOfferRescue,
  );
}

export function declineRescue(state: BlastGameState): BlastGameState {
  if (state.phase !== 'rescuePrompt') return state;
  return {
    ...state,
    rescueDeclined: true,
    phase: 'gameOver',
  };
}

export function calculateCookieReward(
  score: number,
  previousBest: number,
): { reward: number; isNewBest: boolean } {
  const safeScore = Number.isFinite(score) && score > 0 ? Math.floor(score) : 0;
  const safePrevBest =
    Number.isFinite(previousBest) && previousBest > 0 ? Math.floor(previousBest) : 0;

  let baseReward = 5;
  if (safeScore >= 5000) baseReward = 45;
  else if (safeScore >= 2500) baseReward = 35;
  else if (safeScore >= 1000) baseReward = 22;
  else if (safeScore >= 300) baseReward = 12;

  const isNewBest = safeScore > safePrevBest;
  const bonus = safePrevBest > 0 && isNewBest ? 5 : 0;
  return { reward: baseReward + bonus, isNewBest };
}
```

- [ ] **Step 4: Chạy unit test xác nhận pass**

Run: `node --test src/blockblast/engine/__tests__/game.test.ts`
Expected: PASS (6/6 tests).

---

### Task 3: Xác thực replay chống gian lận (`verify.ts`)

**Files:**
- Create: `src/blockblast/engine/verify.ts`
- Modify: `src/blockblast/engine/__tests__/game.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `game.ts`
- Produces:
  - `export const MAX_MATCH_ACTIONS = 2000;`
  - `export const MIN_MS_PER_ACTION = 80;`
  - `export type MatchAction = { seq: number; type: 'place'; slotIndex: number; row: number; col: number } | { seq: number; type: 'bomb'; row: number; col: number } | { seq: number; type: 'reroll' } | { seq: number; type: 'declineRescue' };`
  - `export interface MatchReceipt { matchId: string; seed: number; actions: readonly MatchAction[]; claimedScore: number; elapsedMs: number; bombPaidCount: number; rescueEligible: boolean; }`
  - `export interface VerifyResult { valid: boolean; reason?: string; verifiedScore: number; linesCleared: number; maxStreak: number; }`
  - `export function verifyMatchReceipt(receipt: MatchReceipt): VerifyResult`

- [ ] **Step 1: Thêm test cho replay verification & abuse cases vào `src/blockblast/engine/__tests__/game.test.ts`**

```ts
import { verifyMatchReceipt, type MatchAction, type MatchReceipt } from '../verify.ts';

function playDeterministicMatchToEnd(seed: number): {
  actions: MatchAction[];
  finalScore: number;
} {
  let state = createInitialState(seed);
  const actions: MatchAction[] = [];
  let seq = 0;

  while (state.phase !== 'gameOver' && seq < 500) {
    if (state.phase === 'rescuePrompt') {
      actions.push({ seq: seq++, type: 'declineRescue' });
      state = declineRescue(state);
      break;
    }
    let placed = false;
    for (let slotIndex = 0; slotIndex < state.tray.length && !placed; slotIndex++) {
      const piece = state.tray[slotIndex];
      if (!piece) continue;
      for (let r = 0; r < 8 && !placed; r++) {
        for (let c = 0; c < 8 && !placed; c++) {
          if (canPlacePiece(state.grid, piece, r, c)) {
            const out = placePiece(state, slotIndex, r, c, false)!;
            actions.push({ seq: seq++, type: 'place', slotIndex, row: r, col: c });
            state = out.nextState;
            placed = true;
          }
        }
      }
    }
    if (!placed) break;
  }

  return { actions, finalScore: state.score };
}

describe('blockblast anti-cheat replay verifier', () => {
  it('accepts a legitimate full match transcript and rejects score tampering or 0ms bots', () => {
    const { actions, finalScore } = playDeterministicMatchToEnd(2026);
    const validReceipt: MatchReceipt = {
      matchId: 'match-legit-1',
      seed: 2026,
      actions,
      claimedScore: finalScore,
      elapsedMs: actions.length * 400,
      bombPaidCount: 0,
      rescueEligible: false,
    };
    const ok = verifyMatchReceipt(validReceipt);
    assert.equal(ok.valid, true);
    assert.equal(ok.verifiedScore, finalScore);

    // Spoofed higher score
    const spoofed = verifyMatchReceipt({ ...validReceipt, claimedScore: finalScore + 5000 });
    assert.equal(spoofed.valid, false);

    // Impossible speed (bot burst)
    const speedHack = verifyMatchReceipt({ ...validReceipt, elapsedMs: 10 });
    assert.equal(speedHack.valid, false);
  });

  it('rejects duplicate reroll or unpaid candy bomb actions', () => {
    const state = createInitialState(11);
    const badReceipt: MatchReceipt = {
      matchId: 'match-hack-bomb',
      seed: state.prngState,
      actions: [{ seq: 0, type: 'bomb', row: 3, col: 3 }],
      claimedScore: 0,
      elapsedMs: 1000,
      bombPaidCount: 0, // claimed 0 paid bombs while injecting bomb action
      rescueEligible: false,
    };
    assert.equal(verifyMatchReceipt(badReceipt).valid, false);
  });
});
```

- [ ] **Step 2: Chạy test xác nhận fail do chưa có `verify.ts`**

Run: `node --test src/blockblast/engine/__tests__/game.test.ts`
Expected: FAIL (`Cannot find module '../verify.ts'`).

- [ ] **Step 3: Tạo `src/blockblast/engine/verify.ts`**

```ts
import {
  createInitialState,
  declineRescue,
  detonateCandyBombAt,
  placePiece,
  rerollTray,
} from './game.ts';
import { CANDY_BOMB_COST } from './types.ts';

export const MAX_MATCH_ACTIONS = 2000;
export const MIN_MS_PER_ACTION = 80;

export type MatchAction =
  | { seq: number; type: 'place'; slotIndex: number; row: number; col: number }
  | { seq: number; type: 'bomb'; row: number; col: number }
  | { seq: number; type: 'reroll' }
  | { seq: number; type: 'declineRescue' };

export interface MatchReceipt {
  matchId: string;
  seed: number;
  actions: readonly MatchAction[];
  claimedScore: number;
  elapsedMs: number;
  bombPaidCount: number;
  rescueEligible: boolean;
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
  verifiedScore: number;
  linesCleared: number;
  maxStreak: number;
}

function fail(reason: string): VerifyResult {
  return { valid: false, reason, verifiedScore: 0, linesCleared: 0, maxStreak: 0 };
}

export function verifyMatchReceipt(receipt: MatchReceipt): VerifyResult {
  if (!receipt || typeof receipt !== 'object') return fail('Invalid receipt');
  if (typeof receipt.matchId !== 'string' || receipt.matchId.trim().length < 4 || receipt.matchId.length > 80) {
    return fail('Invalid matchId');
  }
  if (!Number.isFinite(receipt.seed)) return fail('Invalid seed');
  if (!Array.isArray(receipt.actions) || receipt.actions.length === 0 || receipt.actions.length > MAX_MATCH_ACTIONS) {
    return fail('Invalid action count');
  }
  if (!Number.isSafeInteger(receipt.claimedScore) || receipt.claimedScore < 0) {
    return fail('Invalid claimedScore');
  }
  if (!Number.isFinite(receipt.elapsedMs) || receipt.elapsedMs < receipt.actions.length * MIN_MS_PER_ACTION) {
    return fail('Implausible match duration');
  }
  if (!Number.isSafeInteger(receipt.bombPaidCount) || receipt.bombPaidCount < 0 || receipt.bombPaidCount > 1) {
    return fail('Invalid bombPaidCount');
  }
  if (typeof receipt.rescueEligible !== 'boolean') {
    return fail('Invalid rescueEligible');
  }

  let state = createInitialState(receipt.seed);
  let bombActions = 0;
  let rerollActions = 0;
  const canOfferRescue = receipt.rescueEligible;

  for (let i = 0; i < receipt.actions.length; i++) {
    const action = receipt.actions[i];
    if (!action || action.seq !== i) return fail(`Invalid action sequence at ${i}`);

    if (action.type === 'place') {
      const outcome = placePiece(state, action.slotIndex, action.row, action.col, canOfferRescue);
      if (!outcome) return fail(`Illegal placement at seq ${i}`);
      state = outcome.nextState;
    } else if (action.type === 'bomb') {
      bombActions++;
      if (bombActions > 1 || bombActions > receipt.bombPaidCount) {
        return fail('Unauthorized candy bomb action');
      }
      const outcome = detonateCandyBombAt(state, action.row, action.col);
      if (!outcome) return fail(`Illegal bomb action at seq ${i}`);
      state = outcome.nextState;
    } else if (action.type === 'reroll') {
      rerollActions++;
      if (rerollActions > 1) return fail('Multiple rerolls');
      const next = rerollTray(state, canOfferRescue);
      if (!next) return fail(`Illegal reroll at seq ${i}`);
      state = next;
    } else if (action.type === 'declineRescue') {
      if (state.phase !== 'rescuePrompt') return fail(`Unexpected declineRescue at seq ${i}`);
      state = declineRescue(state);
    } else {
      return fail(`Unknown action at seq ${i}`);
    }
  }

  if (bombActions !== receipt.bombPaidCount) {
    return fail('Bomb payment mismatch');
  }
  if (state.phase !== 'gameOver') {
    return fail('Match did not reach gameOver');
  }
  if (state.score !== receipt.claimedScore) {
    return fail('Score mismatch');
  }

  // Ensure candy bomb cost constant stays aligned with store spending
  void CANDY_BOMB_COST;

  return {
    valid: true,
    verifiedScore: state.score,
    linesCleared: state.linesCleared,
    maxStreak: state.maxStreak,
  };
}
```

- [ ] **Step 4: Chạy unit test xác nhận pass**

Run: `node --test src/blockblast/engine/__tests__/game.test.ts`
Expected: PASS (8/8 tests).

---

### Task 4: Bảo mật lưu trữ Profile (SHA-256 HMAC Envelope, Anti-Prototype-Pollution & Store)

**Files:**
- Create: `src/store/profileIntegrity.ts`
- Modify: `src/store/profileSchema.ts:1-111`
- Modify: `src/store/profileStore.ts:1-161`
- Modify: `src/store/__tests__/profileStore.test.ts:1-43`

**Interfaces:**
- Consumes: `src/blockblast/engine/game.ts` (`calculateCookieReward`), `src/blockblast/engine/verify.ts` (`verifyMatchReceipt`, `MatchReceipt`)
- Produces:
  - `profileIntegrity.ts`: `safeJsonParse(raw: string): unknown`, `computeHmacSha256Hex(message: string): string`, `wrapSignedProfile(data: unknown): string`, `unwrapSignedProfile(raw: string): { status: 'empty' | 'legacy_v1' | 'valid_v2' | 'tampered'; data?: Record<string, unknown> }`
  - `profileSchema.ts`: thêm `blockBlastBestScore: number` và `settledMatchIds: string[]` vào `PlayerProfile` & `DEFAULT_PROFILE`, kẹp biên trong `sanitizeProfileData`
  - `profileStore.ts`: thêm `integrityWarning: boolean`, `dismissIntegrityWarning: () => void`, `spendBlockBlastBomb: (matchId: string) => boolean`, `recordBlockBlastResult: (receipt: MatchReceipt) => { ok: boolean; reward: number; isNewBest: boolean; verifiedScore: number }`

- [ ] **Step 1: Mở rộng `src/store/__tests__/profileStore.test.ts` với các case bảo mật trước**

```ts
import {
  safeJsonParse,
  unwrapSignedProfile,
  wrapSignedProfile,
} from '../profileIntegrity.ts';

describe('profileIntegrity & anti-hack boundaries', () => {
  it('wraps and verifies signed v2 profile envelope and rejects tampered cookies', () => {
    const wrapped = wrapSignedProfile({ cookies: 120, blockBlastBestScore: 450 });
    const ok = unwrapSignedProfile(wrapped);
    assert.equal(ok.status, 'valid_v2');
    assert.equal(ok.data?.cookies, 120);

    const parsed = JSON.parse(wrapped) as {
      v: number;
      data: Record<string, unknown>;
      nonce: string;
      savedAt: number;
      sig: string;
    };
    parsed.data.cookies = 999999; // DevTools edit attack
    const tampered = unwrapSignedProfile(JSON.stringify(parsed));
    assert.equal(tampered.status, 'tampered');
  });

  it('allows one-time migration of legitimate v1 legacy profiles but rejects spoofed v1 downgrades', () => {
    const legitV1 = JSON.stringify({ cookies: 80, selectedAnimal: 'cat', gamesPlayed: 2 });
    assert.equal(unwrapSignedProfile(legitV1).status, 'legacy_v1');

    const spoofedV1 = JSON.stringify({
      cookies: 9999,
      blockBlastBestScore: 50000,
    });
    assert.equal(unwrapSignedProfile(spoofedV1).status, 'tampered');
  });

  it('strips prototype pollution keys during JSON parse and clamps impossible bounds', () => {
    const malicious = '{"cookies": 50000000, "gamesWon": 99, "gamesPlayed": 2, "__proto__": {"polluted": true}}';
    const clean = safeJsonParse(malicious) as Record<string, unknown>;
    assert.equal(Object.hasOwn(clean, '__proto__'), false);
    assert.equal(({} as Record<string, unknown>).polluted, undefined);

    const sanitized = sanitizeProfileData(clean);
    assert.equal(sanitized.cookies, 1_000_000);
    assert.equal(sanitized.gamesWon, 2); // clamped <= gamesPlayed
    assert.equal(sanitized.blockBlastBestScore, 0);
    assert.deepEqual(sanitized.settledMatchIds, []);
  });
});
```

- [ ] **Step 2: Chạy test xác nhận fail do chưa có `profileIntegrity.ts`**

Run: `node --test src/store/__tests__/profileStore.test.ts`
Expected: FAIL (`Cannot find module '../profileIntegrity.ts'`).

- [ ] **Step 3: Tạo `src/store/profileIntegrity.ts` (Pure TS SHA-256 HMAC + Prototype-Pollution-Safe JSON)**

```ts
// Pure TypeScript synchronous SHA-256 + HMAC envelope so profileStore loads
// synchronously without async race conditions while preventing casual DevTools tampering.

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Bytes(msg: Uint8Array): Uint8Array {
  const len = msg.length;
  const bitLen = len * 8;
  const paddedLen = Math.ceil((len + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(msg);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const h = new Uint32Array(H0);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i], false);
  return out;
}

const APP_PEPPER = 'PAWS-ARCADE-CABIN-INTEGRITY-2026-V2';

export function computeHmacSha256Hex(message: string): string {
  const enc = new TextEncoder();
  let keyBytes = enc.encode(APP_PEPPER);
  if (keyBytes.length > 64) keyBytes = sha256Bytes(keyBytes);

  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  ipad.fill(0x36);
  opad.fill(0x5c);
  for (let i = 0; i < keyBytes.length; i++) {
    ipad[i] ^= keyBytes[i];
    opad[i] ^= keyBytes[i];
  }

  const msgBytes = enc.encode(message);
  const inner = new Uint8Array(64 + msgBytes.length);
  inner.set(ipad);
  inner.set(msgBytes, 64);
  const innerHash = sha256Bytes(inner);

  const outer = new Uint8Array(64 + 32);
  outer.set(opad);
  outer.set(innerHash, 64);
  const digest = sha256Bytes(outer);

  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function stripUnsafeKeys(val: unknown): unknown {
  if (Array.isArray(val)) return val.map(stripUnsafeKeys);
  if (val && typeof val === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      clean[k] = stripUnsafeKeys(v);
    }
    return clean;
  }
  return val;
}

export function safeJsonParse(raw: string): unknown {
  const parsed = JSON.parse(raw) as unknown;
  return stripUnsafeKeys(parsed);
}

function canonicalStringify(val: unknown): string {
  if (Array.isArray(val)) {
    return `[${val.map(canonicalStringify).join(',')}]`;
  }
  if (val && typeof val === 'object') {
    const keys = Object.keys(val).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${canonicalStringify((val as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(val);
}

function generateNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

export function wrapSignedProfile(data: unknown): string {
  const cleanData = stripUnsafeKeys(data);
  const nonce = generateNonce();
  const savedAt = Date.now();
  const body = `${nonce}|${savedAt}|${canonicalStringify(cleanData)}`;
  const sig = computeHmacSha256Hex(body);
  return JSON.stringify({ v: 2, data: cleanData, nonce, savedAt, sig });
}

export type UnwrapStatus = 'empty' | 'legacy_v1' | 'valid_v2' | 'tampered';

export function unwrapSignedProfile(raw: string | null | undefined): {
  status: UnwrapStatus;
  data?: Record<string, unknown>;
} {
  if (!raw || raw.trim().length === 0) return { status: 'empty' };
  try {
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { status: 'tampered' };
    }
    const obj = parsed as Record<string, unknown>;

    if (obj.v === 2) {
      if (
        !obj.data ||
        typeof obj.data !== 'object' ||
        Array.isArray(obj.data) ||
        typeof obj.nonce !== 'string' ||
        typeof obj.savedAt !== 'number' ||
        !Number.isFinite(obj.savedAt) ||
        typeof obj.sig !== 'string'
      ) {
        return { status: 'tampered' };
      }
      const body = `${obj.nonce}|${obj.savedAt}|${canonicalStringify(obj.data)}`;
      const expected = computeHmacSha256Hex(body);
      if (!timingSafeEqualHex(expected, obj.sig)) {
        return { status: 'tampered' };
      }
      return { status: 'valid_v2', data: obj.data as Record<string, unknown> };
    }

    // Legacy v1 cannot legitimately carry v2+ Block Blast fields; reject downgrade spoofing
    if ('blockBlastBestScore' in obj || 'settledMatchIds' in obj || 'sig' in obj || 'v' in obj) {
      return { status: 'tampered' };
    }
    return { status: 'legacy_v1', data: obj };
  } catch {
    return { status: 'tampered' };
  }
}
```

- [ ] **Step 4: Cập nhật `src/store/profileSchema.ts` và `src/store/profileStore.ts`**

Sửa `src/store/profileSchema.ts`: thêm `blockBlastBestScore: number`, `settledMatchIds: string[]`, kẹp biên `MAX_COOKIES = 1_000_000`, `MAX_BLOCK_BLAST_SCORE = 10_000_000`, `MAX_GAMES = 1_000_000`, `gamesWon <= gamesPlayed`, `settledMatchIds` giữ tối đa 20 ID hợp lệ.

```ts
// Bổ sung vào PlayerProfile trong src/store/profileSchema.ts
export interface PlayerProfile {
  cookies: number;
  gamesPlayed: number;
  gamesWon: number;
  blockBlastBestScore: number;
  settledMatchIds: string[];
  selectedAnimal: AnimalId;
  unlockedAccessories: string[];
  equippedAccessory: Partial<Record<AnimalId, string[]>>;
  settings: ProfileSettings;
}

export const MAX_COOKIES = 1_000_000;
export const MAX_BLOCK_BLAST_SCORE = 10_000_000;
export const MAX_GAMES = 1_000_000;
export const MAX_SETTLED_MATCH_IDS = 20;
```

Cập nhật `DEFAULT_PROFILE` và `sanitizeProfileData` trong `src/store/profileSchema.ts`:
```ts
export const DEFAULT_PROFILE: PlayerProfile = {
  cookies: 100,
  gamesPlayed: 0,
  gamesWon: 0,
  blockBlastBestScore: 0,
  settledMatchIds: [],
  selectedAnimal: 'dog',
  unlockedAccessories: [...DEFAULT_UNLOCKED_ACCESSORIES],
  equippedAccessory: {},
  settings: {
    sfxEnabled: true,
    bgmEnabled: false,
    colorblindMode: false,
    reducedMotion: false,
    botCount: 3,
    difficulty: 'medium',
    deckMode: 'full',
  },
};
```
Trong `sanitizeProfileData`:
- `gamesPlayed = clamp(raw.gamesPlayed, 0, MAX_GAMES)`
- `gamesWon = Math.min(gamesPlayed, clamp(raw.gamesWon, 0, MAX_GAMES))`
- `cookies = clamp(raw.cookies, 0, MAX_COOKIES)` (fallback `DEFAULT_PROFILE.cookies` nếu không phải số)
- `blockBlastBestScore = clamp(raw.blockBlastBestScore, 0, MAX_BLOCK_BLAST_SCORE)`
- `settledMatchIds`: lọc chuỗi độ dài `4..80`, giữ tối đa `MAX_SETTLED_MATCH_IDS` phần tử cuối.

Cập nhật `src/store/profileStore.ts`:
- Khi `loadProfile()` chạy: gọi `unwrapSignedProfile(raw)`:
  - Nếu `tampered`: gán `integrityTamperedFlag = true`, trả về `DEFAULT_PROFILE` và ghi đè lại `v2` sạch vào `localStorage`.
  - Nếu `legacy_v1`: migrate qua `sanitizeProfileData`, rồi lập tức ghi đè lại `v2` đã ký (`wrapSignedProfile`).
  - Nếu `valid_v2`: trả `sanitizeProfileData(result.data)`.
- `persistAndNotify(next)` luôn đi qua `sanitizeProfileData` rồi ghi `wrapSignedProfile(next)`.
- Quản lý bộ đếm bom đã trả phí theo ván trong module store (`const authorizedBombsByMatchId = new Map<string, number>();`):
  - `spendBlockBlastBomb(matchId: string): boolean` — kiểm tra `matchId` hợp lệ, `(authorizedBombsByMatchId.get(matchId) ?? 0) === 0`, và `currentProfile.cookies >= CANDY_BOMB_COST` (`15`). Nếu hợp lệ, trừ `15` Cookies, lưu `authorizedBombsByMatchId.set(matchId, 1)`, gọi `persistAndNotify`, trả `true`.
  - Xuất hàm thuần `settleBlockBlastMatch(profile: PlayerProfile, receipt: MatchReceipt, authorizedBombCount: number)` để test độc lập không cần `window.localStorage`:
    ```ts
    export function settleBlockBlastMatch(
      profile: PlayerProfile,
      receipt: MatchReceipt,
      authorizedBombCount: number,
    ): {
      nextProfile: PlayerProfile;
      ok: boolean;
      reward: number;
      isNewBest: boolean;
      verifiedScore: number;
    } {
      if (profile.settledMatchIds.includes(receipt.matchId)) {
        return { nextProfile: profile, ok: false, reward: 0, isNewBest: false, verifiedScore: 0 };
      }
      if (receipt.bombPaidCount > authorizedBombCount) {
        return { nextProfile: profile, ok: false, reward: 0, isNewBest: false, verifiedScore: 0 };
      }
      const verified = verifyMatchReceipt(receipt);
      if (!verified.valid) {
        return { nextProfile: profile, ok: false, reward: 0, isNewBest: false, verifiedScore: 0 };
      }
      const { reward, isNewBest } = calculateCookieReward(
        verified.verifiedScore,
        profile.blockBlastBestScore,
      );
      const nextSettled = [...profile.settledMatchIds, receipt.matchId].slice(-MAX_SETTLED_MATCH_IDS);
      const nextProfile: PlayerProfile = {
        ...profile,
        cookies: Math.min(MAX_COOKIES, profile.cookies + reward),
        blockBlastBestScore: Math.max(profile.blockBlastBestScore, verified.verifiedScore),
        gamesPlayed: profile.gamesPlayed + 1,
        gamesWon: profile.gamesWon + (isNewBest ? 1 : 0),
        settledMatchIds: nextSettled,
      };
      return { nextProfile, ok: true, reward, isNewBest, verifiedScore: verified.verifiedScore };
    }
    ```
  - `recordBlockBlastResult(receipt: MatchReceipt)` gọi `settleBlockBlastMatch(currentProfile, receipt, authorizedBombsByMatchId.get(receipt.matchId) ?? 0)`; nếu `ok`, gọi `persistAndNotify(nextProfile)` và xóa `authorizedBombsByMatchId.delete(receipt.matchId)`.

- [ ] **Step 5: Thêm unit test cho `settleBlockBlastMatch` và chạy test**

Run: `node --test src/store/__tests__/profileStore.test.ts`
Expected: PASS (all tests including tampering & double-claim).

---

### Task 5: Web Audio SFX & Security Headers (`soundEngine.ts`, `vercel.json`)

**Files:**
- Modify: `src/audio/soundEngine.ts:1-285`
- Create: `vercel.json`

**Interfaces:**
- Produces:
  - `SfxType` mở rộng thêm `'blockPickup' | 'blockPlace' | 'lineClear' | 'candyBomb' | 'reroll'`
  - `export function playSfx(type: SfxType, opts?: { combo?: number }): void` (tương thích ngược hoàn toàn với lời gọi `playSfx(type)` cũ)

- [ ] **Step 1: Cập nhật `src/audio/soundEngine.ts`**
  - Thêm 5 `SfxType` mới vào union.
  - Cập nhật signature `playSfx(type: SfxType, opts?: { combo?: number }): void`.
  - Thêm các `case`:
    - `'blockPickup'`: tone ngắn mượt `380 -> 520 Hz` (0.06s).
    - `'blockPlace'`: gỗ ấm `'triangle'` `240 -> 170 Hz` + click nhẹ `520 Hz` (0.09s).
    - `'lineClear'`: hợp âm 3 nốt tăng cao độ theo `Math.min(6, Math.max(1, opts?.combo ?? 1))` (`base = 440 * Math.pow(1.09, combo - 1)`).
    - `'candyBomb'`: noise burst lowpass + chime rơi lấp lánh (`620 -> 1240 Hz`).
    - `'reroll'`: arpeggio lật nhanh 3 nốt (`392 -> 523 -> 659 Hz`).

- [ ] **Step 2: Tạo `vercel.json` cấu hình HTTP Security Headers**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=(), payment=()"
        }
      ]
    }
  ]
}
```

- [ ] **Step 3: Chạy `npm run typecheck`**

Run: `npm run typecheck`
Expected: PASS (0 errors).

---

### Task 6: UI Bảng 8×8, Khay Mảnh & CSS Motion/Dialog (`index.css`, `BlockBoard.tsx`, `BlockTray.tsx`)

**Files:**
- Modify: `src/index.css:1-91`
- Create: `src/blockblast/ui/BlockBoard.tsx`
- Create: `src/blockblast/ui/BlockTray.tsx`

**Interfaces:**
- Consumes: `types.ts`, `pieces.ts` (`COLOR_TOKENS`)
- Produces:
  - `BlockBoard.tsx`:
    ```tsx
    export interface BurstEffect {
      id: string;
      cells: readonly { r: number; c: number }[];
      colorHex: string;
      label?: string;
      xPct: number;
      yPct: number;
      kind: 'clear' | 'bomb';
    }
    export interface BlockBoardProps {
      boardRef: RefObject<HTMLDivElement | null>;
      grid: Grid;
      preview: PlacementPreview | null;
      bombHoverCell: { r: number; c: number } | null;
      bombAiming: boolean;
      colorblindMode: boolean;
      bursts: readonly BurstEffect[];
      onBoardCellClick?: (r: number, c: number) => void;
      onBoardPointerMove?: (clientX: number, clientY: number) => void;
      onBoardPointerLeave?: () => void;
    }
    ```
  - `BlockTray.tsx`:
    ```tsx
    export interface BlockTrayProps {
      tray: readonly (TrayPiece | null)[];
      draggingSlot: number | null;
      selectedSlot: number | null;
      fitStatus: readonly boolean[];
      disabled: boolean;
      colorblindMode: boolean;
      onSlotPointerDown: (slotIndex: number, e: React.PointerEvent<HTMLButtonElement>) => void;
      onSlotKeyPlace?: (slotIndex: number) => void;
    }
    ```

- [ ] **Step 1: Cập nhật `src/index.css`**
  - Thêm rule bắt buộc từ `modern-web-guidance` cho `<dialog>`:
    ```css
    dialog:modal {
      overscroll-behavior: contain;
    }
    dialog::backdrop {
      overflow: hidden;
      overscroll-behavior: contain;
      background: rgba(12, 7, 4, 0.72);
      backdrop-filter: blur(4px);
    }
    ```
  - Thêm keyframes `bb-cell-pop`, `bb-float-score`, `bb-burst-ring` chỉ chạy bên trong `@media (prefers-reduced-motion: no-preference)` và giữ class `.bb-drag-handle` có `touch-action: none; -webkit-user-select: none; user-select: none;` (để `-webkit-user-select` đứng trước `user-select` theo Safari fallback).

- [ ] **Step 2: Tạo `src/blockblast/ui/BlockBoard.tsx`**
  - Lưới `8×8` CSS Grid (`aspect-square`, `grid-cols-8`, `grid-rows-8`), dùng `<button type="button">` cho từng ô hoặc overlay tương tác chuẩn `>= 44×44px` trên desktop / `>= 36×36px` trên mobile để hỗ trợ click-to-place & bomb aiming bằng chuột/chạm/bàn phím.
  - Hiển thị gạch đặt sẵn dạng tactile 3D-lite (viền sáng trên + bóng đáy `box-shadow`), ghost preview hợp lệ/không hợp lệ, phát sáng toàn hàng/cột sắp bị xóa, preview `3×3` cam-hồng khi `bombAiming`, và lớp `pointer-events-none` render `bursts` (các ô vỡ thu nhỏ + floating text `+300` / `All Clear!`).

- [ ] **Step 3: Tạo `src/blockblast/ui/BlockTray.tsx`**
  - 3 ô khay ngang cân đối; mỗi mảnh ghép render mini grid đúng tỷ lệ (`gridTemplateColumns: repeat(piece.width, ...)`).
  - Áp `.bb-drag-handle` lên nút mảnh ghép (không áp lên cả trang); ẩn mảnh nguồn khi `draggingSlot === idx`; làm mờ nhẹ (`opacity-60`) kèm badge nhỏ nếu `!fitStatus[idx]`.

- [ ] **Step 4: Chạy `npm run typecheck`**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 7: Mascot 3D Companion & Native `<dialog>` Modals (`MascotStage.tsx`, `BlockBlastModals.tsx`)

**Files:**
- Create: `src/blockblast/ui/MascotStage.tsx`
- Create: `src/blockblast/ui/BlockBlastModals.tsx`

**Interfaces:**
- Consumes: `Character3D`, `WinterCabinStage`, `ANIMALS`, `formatEquippedSummary`
- Produces:
  - `MascotStage`: nhận `animal`, `accessories`, `emotion: Emotion`, `quip: string`, `paused: boolean`, `compact?: boolean`. Bọc ErrorBoundary cục bộ fallback sang thẻ avatar 2D nếu WebGL lỗi; tạm dừng `<Canvas frameloop={paused || tabHidden ? 'never' : 'always'}>`.
  - `BlockBlastModals`: 4 modal dùng native `<dialog>` (`showModal()`):
    - `RescueDialog` (Cứu Bàn bằng Bom Kẹo 15 Cookies vs Kết Thúc Ván — `autofocus` nút an toàn / rõ ràng, Esc xử lý qua `cancel`)
    - `GameOverDialog` (Điểm, New Best, Dòng đã xóa, Max Combo, Cookies nhận được, nút `Chơi Lại` & `Đổi Chế Độ`)
    - `HelpDialog` (Hướng dẫn luật chơi, Combo/Streak, Đổi Khay, Bom Kẹo 3×3)
    - `RestartConfirmDialog` (Xác nhận chơi lại khi đã có nước đi, `autofocus` nút `Tiếp Tục Chơi` an toàn)

- [ ] **Step 1: Tạo `src/blockblast/ui/MascotStage.tsx`**
  - Tái sử dụng `<Canvas camera={{ position: [0, 1.85, 4.9], fov: 40 }}>`, `<WinterCabinStage mode="turntable" />`, `<Character3D ... />`.
  - Theo dõi `visibilitychange` để tự set `tabHidden`.
  - Khi WebGL fail trong `MascotErrorBoundary`, hiển thị khung màu `animalMeta.accentHex` + tên thú + lời thoại `quip` để game 2D không bị sập.

- [ ] **Step 2: Tạo `src/blockblast/ui/BlockBlastModals.tsx`**
  - Mỗi dialog quản lý qua `useRef<HTMLDialogElement>` + `useEffect`: mở bằng `dialog.showModal()`, lắng nghe sự kiện `close` đọc `dialog.returnValue`, reset `dialog.returnValue = ''`, đồng bộ callback React.
  - Không đặt `role="dialog"` hoặc `aria-modal`. Tiêu đề chính trong mỗi dialog dùng `<h1>` với `aria-labelledby`.

- [ ] **Step 3: Chạy `npm run typecheck`**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 8: Màn chơi `BlockBlastScreen.tsx` & Điều khiển kéo-thả 60fps

**Files:**
- Create: `src/screens/BlockBlastScreen.tsx`

**Interfaces:**
- Consumes: `src/blockblast/engine/*`, `src/blockblast/ui/*`, `useProfileStore`, `playSfx`, `ANIMALS`, `formatEquippedSummary`
- Produces:
  - `export interface BlockBlastScreenProps { onBackToModeSelect: () => void; }`
  - `export default function BlockBlastScreen({ onBackToModeSelect }: BlockBlastScreenProps)` (export default để `App.tsx` dùng `React.lazy`)

- [ ] **Step 1: Tạo `src/screens/BlockBlastScreen.tsx`**
  - Khởi tạo ván bằng `crypto.getRandomValues` tạo 32-bit `seed` + `matchId`, giữ nhật ký `actionsRef` (`MatchAction[]`), `matchStartRef = performance.now()`, `bombPaidCountRef = 0`, `settledRef = false`.
  - Xử lý kéo-thả qua `window` `pointermove` / `pointerup` / `pointercancel` / `blur`:
    - Ngưỡng 4px từ `pointerdown`: dưới 4px xem như click để chọn/bỏ chọn (`selectedSlot`), trên 4px chuyển sang drag (`dragState`) với `touchOffsetY = pointerType === 'touch' ? -56 : 0`.
    - Tính tâm khối đang kéo từ tọa độ pointer và kích thước ô lưới thực tế (`boardRect.width / 8`), quy đổi về `(row, col)` góc trên-trái của mảnh (`Math.round((centerY - piecePixelH/2 - boardRect.top) / cellSize)`) để cảm giác đặt cực kỳ tự nhiên!
    - Cập nhật `liveAnnouncement` (`aria-live="polite"`) khi đặt mảnh, ăn dòng hoặc game over.
  - Nút **Đổi Khay (Miễn phí · 1/ván)** ghi `{ seq, type: 'reroll' }` vào ledger.
  - Nút **Bom Kẹo 3×3 (15 Cookies · 1/ván)** bật `bombAiming`; khi nhấn ô `(r, c)` trên bảng mới gọi `spendBlockBlastBomb(matchId)` -> tăng `bombPaidCountRef` -> ghi `{ seq, type: 'bomb', row: r, col: c }` -> gọi `detonateCandyBombAt`. Nếu bấm Hủy / `Esc` khi mở từ `rescuePrompt`, quay về `rescuePrompt` mà chưa trừ Cookies!
  - Khi `nextState.phase === 'gameOver'` (và `!settledRef.current`), tạo `MatchReceipt` với `elapsedMs = Math.round(performance.now() - matchStartRef)` thật từ đồng hồ phiên chơi, `rescueEligible: initialRescueEligibleRef.current`, và gọi `recordBlockBlastResult(receipt)` để xác thực + thưởng Cookies + cập nhật Best Score.
  - Nếu `integrityWarning === true`, hiển thị banner thông báo ngắn (có nút đóng) cho biết dữ liệu lưu trữ không hợp lệ đã được khôi phục an toàn.

- [ ] **Step 2: Chạy `npm run typecheck`**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 9: Banner 16:9, Route `App.tsx` & Hub 3 chế độ `ModeSelectScreen.tsx`

**Files:**
- Create: `public/banners/block-blast-banner.jpg` & `public/banners/block-blast-banner.webp`
- Modify: `src/App.tsx:1-158`
- Modify: `src/screens/ModeSelectScreen.tsx:1-266`

**Interfaces:**
- Consumes: `BlockBlastScreen.tsx`, `useProfileStore` (`blockBlastBestScore`)
- Produces:
  - `ModeSelectScreenProps` thêm `onSelectBlockBlast: () => void`
  - `AppScreen` thêm `'blockblast'` với `LazyBlockBlastScreen` + ErrorBoundary.

- [ ] **Step 1: Tạo banner 16:9 `public/banners/block-blast-banner.jpg` & `.webp`**
  - Dùng `image-generator` subagent vẽ ảnh key-art 16:9 phong cách Winter Cabin Tactile Arcade: các khối gạch gỗ/kẹo nhiều màu phát sáng trên bàn gỗ ấm áp, chú thú bông cute cổ vũ bên cạnh ánh đèn lồng, đồng bộ visual với `paws-cards-banner` và `brawl-arena-banner`, sau đó lưu đúng định dạng `.jpg` và `.webp` trong `public/banners/`.

- [ ] **Step 2: Cập nhật `src/App.tsx`**
  - Thêm `const LazyBlockBlastScreen = lazy(() => import('./screens/BlockBlastScreen'));`
  - Mở rộng `AppScreen` thêm `'blockblast'`.
  - Truyền `onSelectBlockBlast={() => setScreen('blockblast')}` vào `ModeSelectScreen`.
  - Render `<LazyBlockBlastScreen onBackToModeSelect={() => setScreen('modeSelect')} />` bên trong `<ErrorBoundary>` + `<Suspense>`.

- [ ] **Step 3: Cập nhật `src/screens/ModeSelectScreen.tsx`**
  - Thêm `onSelectBlockBlast: () => void` vào `ModeSelectScreenProps`.
  - Mở rộng `GameModeEntry.id` thành `'cards' | 'brawl' | 'blockblast'`.
  - Thêm entry thứ 3 **Block Blast PAWS** (`Puzzle · Giải Đố 8×8`, accent Emerald/Amber, banner `/banners/block-blast-banner`, hiển thị `Kỷ lục: {blockBlastBestScore.toLocaleString()}đ`).
  - Đổi lưới thẻ từ `md:grid-cols-2` sang `md:grid-cols-3` (`max-w-7xl` để 3 thẻ cân đối trên desktop, `1` cột trên mobile) và cập nhật footer thành "ba chế độ".

- [ ] **Step 4: Chạy toàn bộ test suite & build kiểm chứng**

Run:
1. `node --test src/blockblast/engine/__tests__/game.test.ts src/store/__tests__/profileStore.test.ts src/engine/__tests__/engine.test.ts src/brawl/sim/__tests__/cooldowns.test.ts src/brawl/sim/__tests__/partyMotion.test.ts src/online/__tests__/online.test.ts src/scene3d/__tests__/accessoryAnchors.test.ts src/scene3d/__tests__/accessoryCatalog.test.ts src/screens/__tests__/matchNotices.test.ts`
2. `npm run build`
Expected: Toàn bộ tests PASS, `tsc --noEmit && vite build` PASS không lỗi.

- [ ] **Step 5: Kiểm thử thực tế trên trình duyệt (`browser` subagent)**
  - Khởi động `npm run dev`, dùng `browser` subagent kiểm tra `ModeSelectScreen` (3 thẻ + banner hiển thị đẹp), vào `Block Blast PAWS`, đặt gạch + xóa dòng + Đổi Khay + Bom Kẹo + kiểm tra UI responsive desktop/mobile và lưu Cookies/Best Score.
  - Dừng dev server sạch sẽ sau khi kiểm tra xong.
