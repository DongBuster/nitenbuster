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
