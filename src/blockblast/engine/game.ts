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
  createCandyBombPiece,
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
const SLOT_VARIETY_WEIGHTS = [28, 22, 16, 12, 9, 6, 4, 3] as const;
const ALL_CLEAR_WEIGHT_MULTIPLIER = 4;
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

function pickGroup(fillRatio: number, rand: number): PieceGroup {
  if (fillRatio < 0.45) {
    return rand < 0.35 ? 'small' : rand < 0.8 ? 'medium' : 'large';
  }
  if (fillRatio <= 0.7) {
    return rand < 0.5 ? 'small' : rand < 0.88 ? 'medium' : 'large';
  }
  return rand < 0.68 ? 'small' : rand < 0.95 ? 'medium' : 'large';
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
    occupiedBefore <= 16 &&
    isGridEmptyAfterClear(grid, defPiece, row, col, clearedRowMask, clearedColMask);
  const allClearBonus = isAllClear ? 220 : 0;

  // Favor line clears & block adjacency over unanchored wall/size scores so tight pockets win.
  const score =
    clearCount * 140 +
    blockNeighbors * 12 +
    wallNeighbors * 2 +
    defPiece.cells.length * 3 -
    newlyIsolated * 14 +
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

function pickSmartPieceForSlot(
  simGrid: Grid,
  prngState: number,
  slotIndex: number,
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

  if (occupied === 0) {
    const groupRoll = nextRandom(rng);
    rng = groupRoll.nextState;
    const group = pickGroup(fillRatio, groupRoll.value);
    const inGroup = BLOCK_PIECES.filter((p) => p.group === group);
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

  const unique = fitting.filter((c) => !usedIds.has(c.defPiece.id));
  const pool = unique.length > 0 ? unique : fitting;
  pool.sort((a, b) => b.score - a.score);

  const isVarietySlot = slotIndex >= 2;
  const baseWeights = isVarietySlot ? SLOT_VARIETY_WEIGHTS : SLOT_PRIMARY_WEIGHTS;
  const top = pool.slice(0, baseWeights.length);
  const weights = top.map((item, idx) => {
    const base = baseWeights[idx];
    if (item.isAllClear) return base * ALL_CLEAR_WEIGHT_MULTIPLIER;
    if (isVarietySlot && item.defPiece.group !== 'small') {
      return Math.round(base * 1.5);
    }
    return base;
  });
  const picked = pickWeightedCandidate(top, weights, rng);
  return {
    defPiece: picked.chosen.defPiece,
    placement: picked.chosen.placement,
    nextPrng: picked.nextPrng,
  };
}

/** Spawns 3 deterministic stage-colored pieces using sequential gap-fitting simulation. */
export function spawnSmartTray(
  grid: Grid,
  prngState: number,
  trayCounter: number,
  allClears = 0,
): { tray: TrayPiece[]; nextPrng: number; nextTrayCounter: number } {
  let rng = prngState;
  let simGrid = cloneGrid(grid);
  const fillRatio = getBoardFillRatio(grid);
  const bombChance = fillRatio > 0.65 ? 0.12 : 0.08;
  const tray: TrayPiece[] = [];
  const usedIds = new Set<string>();
  let hasBomb = false;

  for (let i = 0; i < 3; i++) {
    const colorPick = pickStageColor(allClears, rng);
    rng = colorPick.nextState;

    const bombRoll = nextRandom(rng);
    rng = bombRoll.nextState;
    if (!hasBomb && bombRoll.value < bombChance) {
      hasBomb = true;
      tray.push(createCandyBombPiece(`t${trayCounter}_${i}_bomb`, colorPick.color));
      continue;
    }

    const picked = pickSmartPieceForSlot(simGrid, rng, i, usedIds);
    rng = picked.nextPrng;
    usedIds.add(picked.defPiece.id);
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
