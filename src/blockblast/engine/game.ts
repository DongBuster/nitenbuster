import {
  BOARD_SIZE,
  type BlastGameState,
  type BlockColor,
  type Grid,
  type MoveOutcome,
  type PieceDef,
  type PieceGroup,
  type PlacementPreview,
  type ShapeCell,
  type TrayPiece,
} from './types.ts';
import {
  BLOCK_PIECES,
  createTrayPieceFromDef,
} from './pieces.ts';
import { getStageNumber, getStageTheme } from './stages.ts';

interface ScoredPlacement {
  defPiece: PieceDef;
  placement: { row: number; col: number };
  score: number;
  isAllClear: boolean;
}

const SLOT_PRIMARY_WEIGHTS = [40, 26, 16, 10, 8] as const;
const ALL_CLEAR_WEIGHT_MULTIPLIER = 4;
const TACTICAL_FIT_SCORE_THRESHOLD = 85;
const SINGLE_ALL_CLEAR_MAX_OCCUPIED = 22;
const MULTI_ALL_CLEAR_MAX_OCCUPIED = 20;
const CLEANUP_BIAS_MAX_OCCUPIED = 22;
const ORTHOGONAL_DIRS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

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

/** Counts non-null cells currently occupied on the board. */
export function countOccupiedCells(grid: Grid): number {
  let occupied = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (grid[r][c] !== null) occupied++;
    }
  }
  return occupied;
}

export function getBoardFillRatio(grid: Grid): number {
  return countOccupiedCells(grid) / (BOARD_SIZE * BOARD_SIZE);
}

function canPlaceCells(
  grid: Grid,
  cells: readonly ShapeCell[],
  row: number,
  col: number,
): boolean {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  for (const cell of cells) {
    const r = row + cell.dr;
    const c = col + cell.dc;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (grid[r][c] !== null) return false;
  }
  return true;
}

export function canPlacePiece(
  grid: Grid,
  piece: TrayPiece,
  row: number,
  col: number,
): boolean {
  return canPlaceCells(grid, piece.cells, row, col);
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

function canShapeFitAnywhere(
  grid: Grid,
  shape: { width: number; height: number; cells: readonly ShapeCell[] },
): boolean {
  for (let r = 0; r <= BOARD_SIZE - shape.height; r++) {
    for (let c = 0; c <= BOARD_SIZE - shape.width; c++) {
      if (canPlaceCells(grid, shape.cells, r, c)) return true;
    }
  }
  return false;
}

export function hasAnyValidMove(
  grid: Grid,
  tray: readonly (TrayPiece | null)[],
): boolean {
  for (const piece of tray) {
    if (piece && canShapeFitAnywhere(grid, piece)) {
      return true;
    }
  }
  return false;
}

function commitCellsAndClearLines(
  grid: Grid,
  cells: readonly ShapeCell[],
  row: number,
  col: number,
  color: BlockColor,
): {
  placedCells: { r: number; c: number }[];
  clearedCells: { r: number; c: number }[];
  clearedRows: number[];
  clearedCols: number[];
} {
  const placedCells: { r: number; c: number }[] = [];
  for (const cell of cells) {
    const r = row + cell.dr;
    const c = col + cell.dc;
    grid[r][c] = { color };
    placedCells.push({ r, c });
  }

  const { clearedRows, clearedCols } = findClearedLinesAfterCells(grid, []);
  const clearedSet = new Set<string>();
  const clearedCells: { r: number; c: number }[] = [];

  for (const r of clearedRows) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const key = `${r},${c}`;
      if (!clearedSet.has(key)) {
        clearedSet.add(key);
        clearedCells.push({ r, c });
      }
      grid[r][c] = null;
    }
  }
  for (const c of clearedCols) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      const key = `${r},${c}`;
      if (!clearedSet.has(key)) {
        clearedSet.add(key);
        clearedCells.push({ r, c });
      }
      grid[r][c] = null;
    }
  }

  return { placedCells, clearedCells, clearedRows, clearedCols };
}

function pickTargetGroup(
  fillRatio: number,
  stage: number,
  trayCounter: number,
  slotIndex: number,
  largeCount: number,
  smallCount: number,
  rand: number,
): PieceGroup {
  // Smoothly ramp puzzle challenge after ~100 moves so late runs stay tense rather than endless.
  const lateShift =
    trayCounter >= 35 ? Math.min(0.09, Math.floor((trayCounter - 20) / 15) * 0.03) : 0;
  let smallProb: number;
  let mediumProb: number;
  let largeProb: number;

  if (fillRatio < 0.25) {
    smallProb = Math.max(0.22, (stage <= 1 ? 0.34 : stage >= 3 ? 0.28 : 0.31) - lateShift);
    mediumProb = 0.48;
    largeProb = 1 - smallProb - mediumProb;
  } else if (fillRatio < 0.48) {
    smallProb = Math.max(0.26, 0.38 - lateShift);
    mediumProb = stage >= 3 ? 0.50 : 0.48;
    largeProb = 1 - smallProb - mediumProb;
  } else if (fillRatio < 0.68) {
    smallProb = Math.max(0.36, 0.48 - lateShift);
    mediumProb = 0.45;
    largeProb = Math.max(0.05, 1 - smallProb - mediumProb);
  } else {
    smallProb = Math.max(0.46, 0.60 - lateShift);
    mediumProb = 1 - smallProb;
    largeProb = 0;
  }

  // Cap at 1 large piece per tray early on; late game may allow 2 large pieces on sparse boards.
  const maxLargePerTray = trayCounter >= 35 && fillRatio < 0.28 ? 2 : 1;
  if (largeCount >= maxLargePerTray || (slotIndex === 2 && fillRatio >= 0.30)) {
    mediumProb += largeProb * 0.7;
    smallProb += largeProb * 0.3;
    largeProb = 0;
  }

  // Keep slot 2 balanced: avoid all-small trays and lightly nudge toward small if tray had none.
  if (slotIndex === 2) {
    if (smallCount === 0 && fillRatio >= 0.35) {
      smallProb = Math.max(smallProb, 0.52 - lateShift);
      mediumProb = Math.max(0, 1 - smallProb - largeProb);
    } else if (smallCount >= 2) {
      mediumProb += smallProb;
      smallProb = 0;
    }
  }

  if (rand < smallProb) return 'small';
  if (rand < smallProb + mediumProb) return 'medium';
  return 'large';
}

/** Picks a deterministic block color restricted to the current stage palette. */
export function pickStageColor(
  allClears: number,
  prngState: number,
): { color: BlockColor; nextState: number } {
  const { palette } = getStageTheme(allClears);
  const r = nextRandom(prngState);
  const idx = Math.min(palette.length - 1, Math.floor(r.value * palette.length));
  return { color: palette[idx], nextState: r.nextState };
}

function buildLineEmptyCounts(grid: Grid): {
  rowEmpty: number[];
  colEmpty: number[];
} {
  const rowEmpty = Array.from({ length: BOARD_SIZE }, () => 0);
  const colEmpty = Array.from({ length: BOARD_SIZE }, () => 0);
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (grid[r][c] === null) {
        rowEmpty[r]++;
        colEmpty[c]++;
      }
    }
  }
  return { rowEmpty, colEmpty };
}

function isCellInDefPlacement(
  defPiece: PieceDef,
  row: number,
  col: number,
  targetR: number,
  targetC: number,
): boolean {
  const dr = targetR - row;
  const dc = targetC - col;
  if (dr < 0 || dr >= defPiece.height || dc < 0 || dc >= defPiece.width) {
    return false;
  }
  for (const cell of defPiece.cells) {
    if (cell.dr === dr && cell.dc === dc) return true;
  }
  return false;
}

function countClearedLineMasks(
  defPiece: PieceDef,
  row: number,
  col: number,
  rowEmpty: readonly number[],
  colEmpty: readonly number[],
): { clearedRowMask: number; clearedColMask: number; clearCount: number } {
  let clearedRowMask = 0;
  let clearedColMask = 0;
  let clearCount = 0;

  for (let dr = 0; dr < defPiece.height; dr++) {
    const r = row + dr;
    let added = 0;
    for (const cell of defPiece.cells) {
      if (cell.dr === dr) added++;
    }
    if (added > 0 && added === rowEmpty[r]) {
      clearedRowMask |= 1 << r;
      clearCount++;
    }
  }

  for (let dc = 0; dc < defPiece.width; dc++) {
    const c = col + dc;
    let added = 0;
    for (const cell of defPiece.cells) {
      if (cell.dc === dc) added++;
    }
    if (added > 0 && added === colEmpty[c]) {
      clearedColMask |= 1 << c;
      clearCount++;
    }
  }

  return { clearedRowMask, clearedColMask, clearCount };
}

function isGridEmptyAfterClear(
  grid: Grid,
  defPiece: PieceDef,
  row: number,
  col: number,
  clearedRowMask: number,
  clearedColMask: number,
): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    if ((clearedRowMask & (1 << r)) !== 0) continue;
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((clearedColMask & (1 << c)) !== 0) continue;
      if (grid[r][c] !== null || isCellInDefPlacement(defPiece, row, col, r, c)) {
        return false;
      }
    }
  }
  return true;
}

function isNeighborBlockedAfterClear(
  grid: Grid,
  defPiece: PieceDef,
  row: number,
  col: number,
  r: number,
  c: number,
  clearedRowMask: number,
  clearedColMask: number,
): boolean {
  if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return true;
  if ((clearedRowMask & (1 << r)) !== 0 || (clearedColMask & (1 << c)) !== 0) {
    return false;
  }
  return grid[r][c] !== null || isCellInDefPlacement(defPiece, row, col, r, c);
}

function scorePlacementFit(
  grid: Grid,
  defPiece: PieceDef,
  row: number,
  col: number,
  occupiedBefore: number,
  rowEmpty: readonly number[],
  colEmpty: readonly number[],
): { score: number; isAllClear: boolean } {
  const { clearedRowMask, clearedColMask, clearCount } = countClearedLineMasks(
    defPiece,
    row,
    col,
    rowEmpty,
    colEmpty,
  );

  let blockNeighbors = 0;
  let wallNeighbors = 0;
  const candidateEmptyNeighbors: number[] = [];

  for (const cell of defPiece.cells) {
    const r = row + cell.dr;
    const c = col + cell.dc;
    for (const [dr, dc] of ORTHOGONAL_DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) {
        wallNeighbors++;
        continue;
      }
      if (grid[nr][nc] !== null) {
        blockNeighbors++;
        continue;
      }
      if (!isCellInDefPlacement(defPiece, row, col, nr, nc)) {
        const idx = nr * BOARD_SIZE + nc;
        if (!candidateEmptyNeighbors.includes(idx)) {
          candidateEmptyNeighbors.push(idx);
        }
      }
    }
  }

  let newlyIsolated = 0;
  for (const idx of candidateEmptyNeighbors) {
    const nr = Math.floor(idx / BOARD_SIZE);
    const nc = idx % BOARD_SIZE;
    if ((clearedRowMask & (1 << nr)) !== 0 || (clearedColMask & (1 << nc)) !== 0) {
      continue;
    }
    const allBlocked = ORTHOGONAL_DIRS.every(([dr, dc]) =>
      isNeighborBlockedAfterClear(
        grid,
        defPiece,
        row,
        col,
        nr + dr,
        nc + dc,
        clearedRowMask,
        clearedColMask,
      ),
    );
    if (allBlocked) newlyIsolated++;
  }

  const isAllClear =
    clearCount > 0 &&
    occupiedBefore <= SINGLE_ALL_CLEAR_MAX_OCCUPIED &&
    isGridEmptyAfterClear(grid, defPiece, row, col, clearedRowMask, clearedColMask);
  const allClearBonus = isAllClear ? 220 : 0;

  let cleanupBias = 0;
  if (occupiedBefore >= 1 && occupiedBefore <= CLEANUP_BIAS_MAX_OCCUPIED && clearCount > 0) {
    let leftoverSelfCells = 0;
    for (const cell of defPiece.cells) {
      const r = row + cell.dr;
      const c = col + cell.dc;
      if ((clearedRowMask & (1 << r)) === 0 && (clearedColMask & (1 << c)) === 0) {
        leftoverSelfCells++;
      }
    }
    cleanupBias = leftoverSelfCells === 0 ? 24 : -leftoverSelfCells * 5;
  }

  const largeCrowdingPenalty =
    clearCount === 0 && defPiece.group === 'large' && occupiedBefore >= 8
      ? occupiedBefore <= CLEANUP_BIAS_MAX_OCCUPIED
        ? 30
        : 24
      : 0;

  // Favor line clears & block adjacency over unanchored wall/size scores so tight pockets win.
  const score =
    clearCount * 140 +
    blockNeighbors * 12 +
    wallNeighbors * 2 +
    defPiece.cells.length -
    newlyIsolated * 14 -
    largeCrowdingPenalty +
    cleanupBias +
    allClearBonus;
  return { score, isAllClear };
}

function findBestPlacementForDef(
  grid: Grid,
  defPiece: PieceDef,
  occupiedBefore: number,
  rowEmpty: readonly number[],
  colEmpty: readonly number[],
): { row: number; col: number; score: number; isAllClear: boolean } | null {
  let best: { row: number; col: number; score: number; isAllClear: boolean } | null = null;
  for (let r = 0; r <= BOARD_SIZE - defPiece.height; r++) {
    for (let c = 0; c <= BOARD_SIZE - defPiece.width; c++) {
      if (!canPlaceCells(grid, defPiece.cells, r, c)) continue;
      const fit = scorePlacementFit(
        grid,
        defPiece,
        r,
        c,
        occupiedBefore,
        rowEmpty,
        colEmpty,
      );
      if (best === null || fit.score > best.score) {
        best = { row: r, col: c, score: fit.score, isAllClear: fit.isAllClear };
      }
    }
  }
  return best;
}

function simulatePlacementOnGrid(
  grid: Grid,
  defPiece: PieceDef,
  row: number,
  col: number,
  color: BlockColor,
): Grid {
  const simGrid = cloneGrid(grid);
  commitCellsAndClearLines(simGrid, defPiece.cells, row, col, color);
  return simGrid;
}

function pickWeightedCandidate(
  candidates: readonly ScoredPlacement[],
  weights: readonly number[],
  prngState: number,
): { chosen: ScoredPlacement; nextPrng: number } {
  let totalWeight = 0;
  for (let i = 0; i < candidates.length; i++) {
    totalWeight += weights[i];
  }
  const roll = nextRandom(prngState);
  let target = roll.value * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    target -= weights[i];
    if (target <= 0) {
      return { chosen: candidates[i], nextPrng: roll.nextState };
    }
  }
  return { chosen: candidates[candidates.length - 1], nextPrng: roll.nextState };
}

function countValidPlacementsUpTo(
  grid: Grid,
  defPiece: PieceDef,
  limit: number,
): number {
  let count = 0;
  for (let r = 0; r <= BOARD_SIZE - defPiece.height; r++) {
    for (let c = 0; c <= BOARD_SIZE - defPiece.width; c++) {
      if (canPlaceCells(grid, defPiece.cells, r, c)) {
        count++;
        if (count >= limit) return count;
      }
    }
  }
  return count;
}

function isLargePieceSafeOnGrid(
  baseGrid: Grid,
  defPiece: PieceDef,
  baseFillRatio: number,
  trayCounter: number,
  baseRowEmpty: readonly number[],
  baseColEmpty: readonly number[],
): boolean {
  if (defPiece.group !== 'large') return true;
  if (baseFillRatio < 0.30) return true;
  const minFits = trayCounter < 35 ? 2 : defPiece.id === 'square_3' ? 2 : 1;
  if (baseFillRatio < 0.54) {
    return countValidPlacementsUpTo(baseGrid, defPiece, minFits) >= minFits;
  }
  for (let r = 0; r <= BOARD_SIZE - defPiece.height; r++) {
    for (let c = 0; c <= BOARD_SIZE - defPiece.width; c++) {
      if (!canPlaceCells(baseGrid, defPiece.cells, r, c)) continue;
      if (countClearedLineMasks(defPiece, r, c, baseRowEmpty, baseColEmpty).clearCount > 0) {
        return true;
      }
    }
  }
  return false;
}

function pickSmartPieceForSlot(
  simGrid: Grid,
  baseGrid: Grid,
  prngState: number,
  slotIndex: number,
  trayCounter: number,
  stage: number,
  largeCount: number,
  smallCount: number,
  usedIds: ReadonlySet<string>,
): {
  defPiece: PieceDef;
  placement: { row: number; col: number } | null;
  nextPrng: number;
} {
  let rng = prngState;
  const occupied = countOccupiedCells(simGrid);
  const fillRatio = occupied / (BOARD_SIZE * BOARD_SIZE);
  const { rowEmpty, colEmpty } = buildLineEmptyCounts(simGrid);

  const groupRoll = nextRandom(rng);
  rng = groupRoll.nextState;
  const targetGroup = pickTargetGroup(
    fillRatio,
    stage,
    trayCounter,
    slotIndex,
    largeCount,
    smallCount,
    groupRoll.value,
  );

  if (occupied === 0) {
    const inGroup = BLOCK_PIECES.filter((p) => p.group === targetGroup);
    const uniqueInGroup = inGroup.filter((p) => !usedIds.has(p.id));
    const pool = uniqueInGroup.length > 0 ? uniqueInGroup : inGroup;
    const fittingPool = pool
      .map((defPiece) => ({
        defPiece,
        best: findBestPlacementForDef(simGrid, defPiece, occupied, rowEmpty, colEmpty),
      }))
      .filter(
        (
          item,
        ): item is {
          defPiece: PieceDef;
          best: { row: number; col: number; score: number; isAllClear: boolean };
        } => item.best !== null,
      );

    if (fittingPool.length > 0) {
      const pieceRoll = nextRandom(rng);
      rng = pieceRoll.nextState;
      const pick =
        fittingPool[
          Math.min(fittingPool.length - 1, Math.floor(pieceRoll.value * fittingPool.length))
        ];
      return {
        defPiece: pick.defPiece,
        placement: { row: pick.best.row, col: pick.best.col },
        nextPrng: rng,
      };
    }
  }

  const fitting: ScoredPlacement[] = [];
  for (const defPiece of BLOCK_PIECES) {
    const best = findBestPlacementForDef(simGrid, defPiece, occupied, rowEmpty, colEmpty);
    if (best !== null) {
      fitting.push({
        defPiece,
        placement: { row: best.row, col: best.col },
        score: best.score,
        isAllClear: best.isAllClear,
      });
    }
  }

  if (fitting.length === 0) {
    const fallbackGroup = BLOCK_PIECES.filter((p) => p.group === 'small');
    const uniqueFallback = fallbackGroup.filter((p) => !usedIds.has(p.id));
    const pool = uniqueFallback.length > 0 ? uniqueFallback : fallbackGroup;
    const roll = nextRandom(rng);
    const defPiece = pool[Math.min(pool.length - 1, Math.floor(roll.value * pool.length))];
    return { defPiece, placement: null, nextPrng: roll.nextState };
  }

  const baseFillRatio = getBoardFillRatio(baseGrid);
  const { rowEmpty: baseRowEmpty, colEmpty: baseColEmpty } = buildLineEmptyCounts(baseGrid);
  const maxLargePerTray = trayCounter >= 35 && baseFillRatio < 0.28 ? 2 : 1;
  const safeFitting = fitting.filter((c) => {
    if (c.defPiece.group === 'large') {
      if (largeCount >= maxLargePerTray && !c.isAllClear) return false;
      return isLargePieceSafeOnGrid(
        baseGrid,
        c.defPiece,
        baseFillRatio,
        trayCounter,
        baseRowEmpty,
        baseColEmpty,
      );
    }
    // On crowded boards, avoid speculative medium/small pieces that only fit after an assumed simGrid clear.
    if (baseFillRatio >= 0.48 && !c.isAllClear && !canShapeFitAnywhere(baseGrid, c.defPiece)) {
      return false;
    }
    return true;
  });
  const candidatePool = safeFitting.length > 0 ? safeFitting : fitting;

  const unique = candidatePool.filter((c) => !usedIds.has(c.defPiece.id));
  const pool = unique.length > 0 ? unique : candidatePool;
  pool.sort((a, b) => b.score - a.score);

  const allClearPool = pool.filter((c) => c.isAllClear);
  if (allClearPool.length > 0) {
    const top = allClearPool.slice(0, SLOT_PRIMARY_WEIGHTS.length);
    const weights = top.map((_, idx) => SLOT_PRIMARY_WEIGHTS[idx] * ALL_CLEAR_WEIGHT_MULTIPLIER);
    const picked = pickWeightedCandidate(top, weights, rng);
    return {
      defPiece: picked.chosen.defPiece,
      placement: picked.chosen.placement,
      nextPrng: picked.nextPrng,
    };
  }

  // Only slot 0 runs cross-group tactical gap/clear rescue so slots 1 & 2 preserve shape variety and real tension.
  const tacticalPool = pool.filter((c) => c.score >= TACTICAL_FIT_SCORE_THRESHOLD);
  if (slotIndex === 0 && tacticalPool.length > 0) {
    const tacticalInGroup = tacticalPool.filter((c) => c.defPiece.group === targetGroup);
    if (tacticalInGroup.length > 0 || targetGroup !== 'large') {
      const source = tacticalInGroup.length > 0 ? tacticalInGroup : tacticalPool;
      const top = source.slice(0, SLOT_PRIMARY_WEIGHTS.length);
      const weights = top.map((item, idx) => {
        const base = SLOT_PRIMARY_WEIGHTS[idx];
        return idx === 0 && item.score >= 75 ? base * 2 : base;
      });
      const picked = pickWeightedCandidate(top, weights, rng);
      return {
        defPiece: picked.chosen.defPiece,
        placement: picked.chosen.placement,
        nextPrng: picked.nextPrng,
      };
    }
  }

  const inGroup = pool.filter((c) => c.defPiece.group === targetGroup);
  const diversePool = inGroup.length > 0 ? inGroup : pool;
  // Gentle weights across the whole group keep all 29 shapes rotating; slight nudge for line clears within group.
  const weights = diversePool.map((item, idx) => {
    const base = Math.max(6, 15 - idx);
    return item.score >= TACTICAL_FIT_SCORE_THRESHOLD ? Math.round(base * 1.4) : base;
  });
  const picked = pickWeightedCandidate(diversePool, weights, rng);
  return {
    defPiece: picked.chosen.defPiece,
    placement: picked.chosen.placement,
    nextPrng: picked.nextPrng,
  };
}

interface CleanupMove {
  defPiece: PieceDef;
  row: number;
  col: number;
  score: number;
}

function findAllClearFinishers(
  grid: Grid,
  usedIds: ReadonlySet<string>,
): { defPiece: PieceDef; row: number; col: number }[] {
  const occupied = countOccupiedCells(grid);
  if (occupied === 0 || occupied > SINGLE_ALL_CLEAR_MAX_OCCUPIED) return [];
  const { rowEmpty, colEmpty } = buildLineEmptyCounts(grid);
  const finishers: { defPiece: PieceDef; row: number; col: number }[] = [];

  for (const defPiece of BLOCK_PIECES) {
    if (usedIds.has(defPiece.id)) continue;
    let found: { row: number; col: number } | null = null;
    for (let r = 0; r <= BOARD_SIZE - defPiece.height && !found; r++) {
      for (let c = 0; c <= BOARD_SIZE - defPiece.width && !found; c++) {
        if (!canPlaceCells(grid, defPiece.cells, r, c)) continue;
        const { clearedRowMask, clearedColMask, clearCount } = countClearedLineMasks(
          defPiece,
          r,
          c,
          rowEmpty,
          colEmpty,
        );
        if (
          clearCount > 0 &&
          isGridEmptyAfterClear(grid, defPiece, r, c, clearedRowMask, clearedColMask)
        ) {
          found = { row: r, col: c };
        }
      }
    }
    if (found) {
      finishers.push({ defPiece, row: found.row, col: found.col });
    }
  }

  finishers.sort((a, b) => a.defPiece.cells.length - b.defPiece.cells.length);
  return finishers;
}

function findCleanupCandidates(
  grid: Grid,
  usedIds: ReadonlySet<string>,
  limit: number,
): CleanupMove[] {
  const occupied = countOccupiedCells(grid);
  if (occupied === 0) return [];
  const { rowEmpty, colEmpty } = buildLineEmptyCounts(grid);
  const candidates: CleanupMove[] = [];

  for (const defPiece of BLOCK_PIECES) {
    if (usedIds.has(defPiece.id)) continue;
    let bestForPiece: CleanupMove | null = null;

    for (let r = 0; r <= BOARD_SIZE - defPiece.height; r++) {
      for (let c = 0; c <= BOARD_SIZE - defPiece.width; c++) {
        if (!canPlaceCells(grid, defPiece.cells, r, c)) continue;
        const { clearedRowMask, clearedColMask, clearCount } = countClearedLineMasks(
          defPiece,
          r,
          c,
          rowEmpty,
          colEmpty,
        );

        let leftoverSelfCells = 0;
        let clutterOnEmptyLines = 0;
        for (const cell of defPiece.cells) {
          const rr = r + cell.dr;
          const cc = c + cell.dc;
          const isCleared =
            (clearedRowMask & (1 << rr)) !== 0 || (clearedColMask & (1 << cc)) !== 0;
          if (!isCleared) {
            leftoverSelfCells++;
            if (rowEmpty[rr] === BOARD_SIZE && colEmpty[cc] === BOARD_SIZE) {
              clutterOnEmptyLines++;
            }
          }
        }
        if (clutterOnEmptyLines > 0) continue;

        let moveScore = -1;
        if (clearCount > 0) {
          let clearedExisting = 0;
          for (let rr = 0; rr < BOARD_SIZE; rr++) {
            if ((clearedRowMask & (1 << rr)) !== 0) {
              clearedExisting += BOARD_SIZE - rowEmpty[rr];
            }
          }
          for (let cc = 0; cc < BOARD_SIZE; cc++) {
            if ((clearedColMask & (1 << cc)) !== 0) {
              clearedExisting += BOARD_SIZE - colEmpty[cc];
              for (let rr = 0; rr < BOARD_SIZE; rr++) {
                if ((clearedRowMask & (1 << rr)) !== 0 && grid[rr][cc] !== null) {
                  clearedExisting--;
                }
              }
            }
          }
          const remainingAfter = occupied - clearedExisting + leftoverSelfCells;
          if (remainingAfter < occupied) {
            moveScore =
              220 +
              (occupied - remainingAfter) * 18 -
              leftoverSelfCells * 14 +
              clearCount * 30;
          }
        } else {
          // Allow zero-clutter tightening moves that advance an active row or col toward clearing.
          const firstR = r + defPiece.cells[0].dr;
          const firstC = c + defPiece.cells[0].dc;
          const singleActiveRow =
            rowEmpty[firstR] < BOARD_SIZE &&
            defPiece.cells.every((cell) => r + cell.dr === firstR);
          const singleActiveCol =
            colEmpty[firstC] < BOARD_SIZE &&
            defPiece.cells.every((cell) => c + cell.dc === firstC);

          if (singleActiveRow || singleActiveCol) {
            const emptyLeft = singleActiveRow
              ? rowEmpty[firstR] - defPiece.cells.length
              : colEmpty[firstC] - defPiece.cells.length;
            if (emptyLeft >= 1 && emptyLeft <= 5) {
              moveScore = 115 + defPiece.cells.length * 10 - emptyLeft * 12;
            }
          }
        }

        if (moveScore > 0 && (bestForPiece === null || moveScore > bestForPiece.score)) {
          bestForPiece = { defPiece, row: r, col: c, score: moveScore };
        }
      }
    }

    if (bestForPiece) {
      candidates.push(bestForPiece);
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit);
}

/**
 * Searches for a deterministic 1-, 2-, or 3-piece non-duplicate tray plan that can
 * completely clear a tidy board (All Clear), rewarding deliberate board cleanup.
 */
function findAllClearTrayPlan(
  grid: Grid,
  trayCounter: number,
  prngState: number,
): { planDefs: PieceDef[]; nextPrng: number } | null {
  const occupied = countOccupiedCells(grid);
  if (occupied === 0 || occupied > SINGLE_ALL_CLEAR_MAX_OCCUPIED) return null;

  let rng = prngState;
  const emptySet = new Set<string>();
  const finishers1 = findAllClearFinishers(grid, emptySet);
  if (finishers1.length > 0) {
    const top = finishers1.slice(0, 3);
    const roll = nextRandom(rng);
    rng = roll.nextState;
    const chosen = top[Math.min(top.length - 1, Math.floor(roll.value * top.length))];
    return { planDefs: [chosen.defPiece], nextPrng: rng };
  }

  if (occupied > MULTI_ALL_CLEAR_MAX_OCCUPIED) return null;

  const { rowEmpty, colEmpty } = buildLineEmptyCounts(grid);
  let maxLineFilled = 0;
  for (let i = 0; i < BOARD_SIZE; i++) {
    maxLineFilled = Math.max(maxLineFilled, BOARD_SIZE - rowEmpty[i], BOARD_SIZE - colEmpty[i]);
  }
  // Avoid gifting multi-step clears on tray 2 unless the player actively lined up >=4 blocks on a line.
  if (trayCounter < 3 && !(occupied <= 14 && maxLineFilled >= 4)) {
    return null;
  }

  const d1Moves = findCleanupCandidates(grid, emptySet, 6);
  if (d1Moves.length === 0) return null;

  const g1States: { move: CleanupMove; grid: Grid }[] = [];
  const plans2: PieceDef[][] = [];
  for (const m1 of d1Moves) {
    const g1 = simulatePlacementOnGrid(grid, m1.defPiece, m1.row, m1.col, 'amber');
    g1States.push({ move: m1, grid: g1 });
    const finishers2 = findAllClearFinishers(g1, new Set([m1.defPiece.id]));
    if (finishers2.length > 0) {
      plans2.push([m1.defPiece, finishers2[0].defPiece]);
    }
  }

  if (plans2.length > 0) {
    const roll = nextRandom(rng);
    rng = roll.nextState;
    const chosen = plans2[Math.min(plans2.length - 1, Math.floor(roll.value * plans2.length))];
    return { planDefs: chosen, nextPrng: rng };
  }

  const plans3: PieceDef[][] = [];
  for (const { move: m1, grid: g1 } of g1States.slice(0, 4)) {
    const used1 = new Set([m1.defPiece.id]);
    const d2Moves = findCleanupCandidates(g1, used1, 3);
    for (const m2 of d2Moves) {
      const g2 = simulatePlacementOnGrid(g1, m2.defPiece, m2.row, m2.col, 'amber');
      const finishers3 = findAllClearFinishers(g2, new Set([m1.defPiece.id, m2.defPiece.id]));
      if (finishers3.length > 0) {
        plans3.push([m1.defPiece, m2.defPiece, finishers3[0].defPiece]);
        if (plans3.length >= 4) break;
      }
    }
    if (plans3.length >= 4) break;
  }

  if (plans3.length > 0) {
    const roll = nextRandom(rng);
    rng = roll.nextState;
    const chosen = plans3[Math.min(plans3.length - 1, Math.floor(roll.value * plans3.length))];
    return { planDefs: chosen, nextPrng: rng };
  }

  return null;
}

/** Spawns 3 deterministic stage-colored polyomino pieces using sequential gap-fitting simulation. */
export function spawnSmartTray(
  grid: Grid,
  prngState: number,
  trayCounter: number,
  allClears = 0,
): { tray: TrayPiece[]; nextPrng: number; nextTrayCounter: number } {
  let rng = prngState;
  const stage = getStageNumber(allClears);
  const usedIds = new Set<string>();
  let largeCount = 0;
  let smallCount = 0;

  const allClearPlan = findAllClearTrayPlan(grid, trayCounter, rng);
  if (allClearPlan) {
    rng = allClearPlan.nextPrng;
    const chosenDefs: PieceDef[] = [...allClearPlan.planDefs];
    for (const defPiece of chosenDefs) {
      usedIds.add(defPiece.id);
      if (defPiece.group === 'large') largeCount++;
      if (defPiece.group === 'small') smallCount++;
    }

    let emptySim = createEmptyGrid();
    for (let i = chosenDefs.length; i < 3; i++) {
      const picked = pickSmartPieceForSlot(
        emptySim,
        emptySim,
        rng,
        i,
        trayCounter,
        stage,
        largeCount,
        smallCount,
        usedIds,
      );
      rng = picked.nextPrng;
      usedIds.add(picked.defPiece.id);
      if (picked.defPiece.group === 'large') largeCount++;
      if (picked.defPiece.group === 'small') smallCount++;
      chosenDefs.push(picked.defPiece);
      if (picked.placement && i < 2) {
        emptySim = simulatePlacementOnGrid(
          emptySim,
          picked.defPiece,
          picked.placement.row,
          picked.placement.col,
          'amber',
        );
      }
    }

    // Shuffle slot order deterministically so the player still solves the piece sequence.
    for (let i = chosenDefs.length - 1; i > 0; i--) {
      const swapRoll = nextRandom(rng);
      rng = swapRoll.nextState;
      const j = Math.min(i, Math.floor(swapRoll.value * (i + 1)));
      const tmp = chosenDefs[i];
      chosenDefs[i] = chosenDefs[j];
      chosenDefs[j] = tmp;
    }

    const tray: TrayPiece[] = [];
    for (let i = 0; i < chosenDefs.length; i++) {
      const colorPick = pickStageColor(allClears, rng);
      rng = colorPick.nextState;
      tray.push(
        createTrayPieceFromDef(
          chosenDefs[i],
          `t${trayCounter}_${i}_${chosenDefs[i].id}`,
          colorPick.color,
        ),
      );
    }
    return { tray, nextPrng: rng, nextTrayCounter: trayCounter + 1 };
  }

  let simGrid = cloneGrid(grid);
  const tray: TrayPiece[] = [];

  for (let i = 0; i < 3; i++) {
    const colorPick = pickStageColor(allClears, rng);
    rng = colorPick.nextState;

    const picked = pickSmartPieceForSlot(
      simGrid,
      grid,
      rng,
      i,
      trayCounter,
      stage,
      largeCount,
      smallCount,
      usedIds,
    );
    rng = picked.nextPrng;
    usedIds.add(picked.defPiece.id);
    if (picked.defPiece.group === 'large') largeCount++;
    if (picked.defPiece.group === 'small') smallCount++;
    tray.push(
      createTrayPieceFromDef(
        picked.defPiece,
        `t${trayCounter}_${i}_${picked.defPiece.id}`,
        colorPick.color,
      ),
    );
    if (picked.placement && i < 2) {
      simGrid = simulatePlacementOnGrid(
        simGrid,
        picked.defPiece,
        picked.placement.row,
        picked.placement.col,
        colorPick.color,
      );
    }
  }

  if (!hasAnyValidMove(grid, tray)) {
    const fittingDefs = BLOCK_PIECES.filter((defPiece) => canShapeFitAnywhere(grid, defPiece));
    if (fittingDefs.length > 0) {
      const fixRoll = nextRandom(rng);
      rng = fixRoll.nextState;
      const colorPick = pickStageColor(allClears, rng);
      rng = colorPick.nextState;
      const chosen =
        fittingDefs[Math.min(fittingDefs.length - 1, Math.floor(fixRoll.value * fittingDefs.length))];
      tray[0] = createTrayPieceFromDef(chosen, `t${trayCounter}_0_${chosen.id}`, colorPick.color);
    }
  }

  return { tray, nextPrng: rng, nextTrayCounter: trayCounter + 1 };
}

function applyStageProgression(
  tray: readonly (TrayPiece | null)[],
  prngState: number,
  prevAllClears: number,
  stageUp: boolean,
): { tray: (TrayPiece | null)[]; nextPrng: number; allClears: number } {
  if (!stageUp) {
    return { tray: [...tray], nextPrng: prngState, allClears: prevAllClears };
  }
  const allClears = prevAllClears + 1;
  let rng = prngState;
  const nextTray = tray.map((piece) => {
    if (!piece) return null;
    const picked = pickStageColor(allClears, rng);
    rng = picked.nextState;
    return { ...piece, color: picked.color };
  });
  return { tray: nextTray, nextPrng: rng, allClears };
}

export function createInitialState(seed: number): BlastGameState {
  const safeSeed = Number.isFinite(seed) ? Math.floor(seed) | 0 : 1;
  const grid = createEmptyGrid();
  const spawned = spawnSmartTray(grid, safeSeed, 1, 0);
  return {
    grid,
    tray: spawned.tray,
    score: 0,
    streak: 0,
    maxStreak: 0,
    graceUsed: false,
    linesCleared: 0,
    movesCount: 0,
    allClears: 0,
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
  const nextGrid = state.grid;
  let nextTray = state.tray;
  let nextPrng = state.prngState;
  let nextTrayCounter = state.trayCounter;

  if (nextTray.every((slot) => slot === null)) {
    const spawned = spawnSmartTray(nextGrid, nextPrng, nextTrayCounter, state.allClears);
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

  const wasOccupied = countOccupiedCells(state.grid) > 0;
  const nextGrid = cloneGrid(state.grid);
  const baseTray = state.tray.map((item, idx) => (idx === slotIndex ? null : item));

  if (piece.kind === 'candyBomb') {
    const destroyedByBomb = blastArea3x3(nextGrid, row, col);
    const pointsEarned = 10 + destroyedByBomb.length * 15;
    const stageUp = wasOccupied && countOccupiedCells(nextGrid) === 0;
    const staged = applyStageProgression(baseTray, state.prngState, state.allClears, stageUp);
    const baseState: BlastGameState = {
      ...state,
      grid: nextGrid,
      tray: staged.tray,
      score: state.score + pointsEarned,
      movesCount: state.movesCount + 1,
      allClears: staged.allClears,
      prngState: staged.nextPrng,
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
      stageUp,
      stageAfter: getStageNumber(nextState.allClears),
      streakAfter: nextState.streak,
    };
  }

  const { placedCells, clearedCells, clearedRows, clearedCols } = commitCellsAndClearLines(
    nextGrid,
    piece.cells,
    row,
    col,
    piece.color,
  );
  const clearCount = clearedRows.length + clearedCols.length;

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

    if (countOccupiedCells(nextGrid) === 0) {
      allClear = true;
      pointsEarned += 1000;
    }
  } else if (state.streak > 0 && !state.graceUsed) {
    nextGraceUsed = true;
  } else {
    nextStreak = 0;
    nextGraceUsed = false;
  }

  const stageUp = allClear;
  const staged = applyStageProgression(baseTray, state.prngState, state.allClears, stageUp);

  const baseState: BlastGameState = {
    ...state,
    grid: nextGrid,
    tray: staged.tray,
    score: state.score + pointsEarned,
    streak: nextStreak,
    maxStreak: Math.max(state.maxStreak, nextStreak),
    graceUsed: nextGraceUsed,
    linesCleared: state.linesCleared + clearCount,
    movesCount: state.movesCount + 1,
    allClears: staged.allClears,
    prngState: staged.nextPrng,
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
    stageUp,
    stageAfter: getStageNumber(nextState.allClears),
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

  const wasOccupied = countOccupiedCells(state.grid) > 0;
  const nextGrid = cloneGrid(state.grid);
  const destroyedByBomb = blastArea3x3(nextGrid, row, col);
  const pointsEarned = destroyedByBomb.length * 15;
  const stageUp = wasOccupied && countOccupiedCells(nextGrid) === 0;
  const staged = applyStageProgression(state.tray, state.prngState, state.allClears, stageUp);

  const baseState: BlastGameState = {
    ...state,
    grid: nextGrid,
    tray: staged.tray,
    score: state.score + pointsEarned,
    allClears: staged.allClears,
    prngState: staged.nextPrng,
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
    stageUp,
    stageAfter: getStageNumber(nextState.allClears),
    streakAfter: nextState.streak,
  };
}

export function rerollTray(
  state: BlastGameState,
  canOfferRescue: boolean,
): BlastGameState | null {
  if (state.phase !== 'playing' || state.rerollUsed) return null;
  if (state.tray.every((slot) => slot === null)) return null;

  const spawned = spawnSmartTray(
    state.grid,
    state.prngState,
    state.trayCounter,
    state.allClears,
  );
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
