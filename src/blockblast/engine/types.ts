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
  allClears: number;
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
  stageUp: boolean;
  stageAfter: number;
  streakAfter: number;
}
