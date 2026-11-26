import { createEmptyGrid } from '../engine/game.ts';
import { BOARD_SIZE, type BlockColor, type Grid } from '../engine/types.ts';

const GRID_CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

export const EMPTY_COMPACT_GRID = '.'.repeat(GRID_CELL_COUNT);

const COLOR_TO_CODE: Record<BlockColor, string> = {
  amber: 'a',
  rose: 'r',
  sky: 's',
  emerald: 'e',
  violet: 'v',
  orange: 'o',
};

const CODE_TO_COLOR: Record<string, BlockColor> = {
  a: 'amber',
  r: 'rose',
  s: 'sky',
  e: 'emerald',
  v: 'violet',
  o: 'orange',
};

/** Encodes an 8x8 Block Blast grid into a 64-character row-major string for Realtime sync. */
export function encodeGrid(grid: Grid): string {
  let out = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = grid[r];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = row?.[c] ?? null;
      out += cell ? COLOR_TO_CODE[cell.color] ?? '.' : '.';
    }
  }
  return out;
}

/** Decodes a 64-character compact string back into an 8x8 Grid, falling back safely on invalid input. */
export function decodeGrid(encoded: string): Grid {
  if (typeof encoded !== 'string' || encoded.length !== GRID_CELL_COUNT) {
    return createEmptyGrid();
  }

  const grid = createEmptyGrid();
  for (let r = 0; r < BOARD_SIZE; r++) {
    const rowOffset = r * BOARD_SIZE;
    for (let c = 0; c < BOARD_SIZE; c++) {
      const ch = encoded[rowOffset + c];
      const color = CODE_TO_COLOR[ch];
      if (color) {
        grid[r][c] = { color };
      }
    }
  }
  return grid;
}
