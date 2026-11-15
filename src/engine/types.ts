export type Color = 'w' | 'b';

/**
 * K Q R B N P = standard chess pieces.
 * M = Marshal (queen-like, range alternates 3 / 1).
 * C = Cavalry (two squares wide, slides up to 2 and tramples enemies, can pivot).
 */
export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' | 'M' | 'C';

export type MarshalPhase = 'long' | 'short';

export interface Piece {
  id: number;
  type: PieceType;
  color: Color;
  /** Squares occupied (1 for most pieces, 2 for Cavalry). */
  squares: number[];
  /** Marshal only: range on its next move. */
  phase?: MarshalPhase;
}

export type MoveKind = 'normal' | 'double' | 'enpassant' | 'castle' | 'pivot';

export interface Move {
  pieceId: number;
  from: number[];
  to: number[];
  /** Ids of every enemy piece removed by this move. */
  captures: number[];
  kind: MoveKind;
  promotion?: PieceType;
  rook?: { id: number; from: number; to: number };
}

export const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w');
