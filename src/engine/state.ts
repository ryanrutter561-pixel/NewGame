import type { Color, MarshalPhase, Move, Piece, PieceType } from './types';

export const CASTLE_WK = 1;
export const CASTLE_WQ = 2;
export const CASTLE_BK = 4;
export const CASTLE_BQ = 8;

/** Castling rights lost when anything moves from, to, or is captured on these squares. */
const CASTLE_MASK = new Uint8Array(64);
CASTLE_MASK[0] = CASTLE_WQ;
CASTLE_MASK[7] = CASTLE_WK;
CASTLE_MASK[4] = CASTLE_WK | CASTLE_WQ;
CASTLE_MASK[56] = CASTLE_BQ;
CASTLE_MASK[63] = CASTLE_BK;
CASTLE_MASK[60] = CASTLE_BK | CASTLE_BQ;

interface Undo {
  move: Move;
  castling: number;
  ep: number;
  halfmove: number;
  fullmove: number;
  captured: Piece[];
  prevType: PieceType;
  prevPhase?: MarshalPhase;
}

export class GameState {
  /** Piece id on each square, -1 when empty. */
  readonly board = new Int16Array(64).fill(-1);
  readonly pieces = new Map<number, Piece>();
  turn: Color = 'w';
  castling = 0;
  /** En passant target square, -1 when none. */
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  readonly kings: Record<Color, number> = { w: -1, b: -1 };
  private readonly undos: Undo[] = [];
  private nextId = 1;

  addPiece(type: PieceType, color: Color, squares: number[], phase?: MarshalPhase, id?: number): Piece {
    const pieceId = id ?? this.nextId;
    this.nextId = Math.max(this.nextId, pieceId + 1);
    const piece: Piece = { id: pieceId, type, color, squares: [...squares] };
    if (type === 'M') piece.phase = phase ?? 'long';
    for (const s of squares) {
      if (this.board[s] !== -1) throw new Error(`Square ${s} already occupied`);
      this.board[s] = pieceId;
    }
    this.pieces.set(pieceId, piece);
    if (type === 'K') this.kings[color] = pieceId;
    return piece;
  }

  pieceAt(s: number): Piece | undefined {
    const id = this.board[s];
    return id === -1 ? undefined : this.pieces.get(id);
  }

  kingSquare(color: Color): number {
    const k = this.pieces.get(this.kings[color]);
    return k ? k.squares[0] : -1;
  }

  get ply(): number {
    return this.undos.length;
  }

  get lastMove(): Move | undefined {
    return this.undos[this.undos.length - 1]?.move;
  }

  makeMove(m: Move): void {
    const piece = this.pieces.get(m.pieceId);
    if (!piece) throw new Error(`No piece ${m.pieceId}`);
    const undo: Undo = {
      move: m,
      castling: this.castling,
      ep: this.ep,
      halfmove: this.halfmove,
      fullmove: this.fullmove,
      captured: [],
      prevType: piece.type,
      prevPhase: piece.phase,
    };

    let rights = this.castling;
    for (const id of m.captures) {
      const victim = this.pieces.get(id);
      if (!victim) continue;
      for (const s of victim.squares) {
        this.board[s] = -1;
        rights &= ~CASTLE_MASK[s];
      }
      this.pieces.delete(id);
      undo.captured.push(victim);
    }

    for (const s of m.from) {
      this.board[s] = -1;
      rights &= ~CASTLE_MASK[s];
    }
    piece.squares = [...m.to];
    for (const s of m.to) {
      this.board[s] = piece.id;
      rights &= ~CASTLE_MASK[s];
    }

    if (m.rook) {
      const rook = this.pieces.get(m.rook.id)!;
      this.board[m.rook.from] = -1;
      this.board[m.rook.to] = rook.id;
      rook.squares = [m.rook.to];
    }
    if (m.promotion) piece.type = m.promotion;
    if (piece.type === 'M') piece.phase = piece.phase === 'long' ? 'short' : 'long';

    this.castling = rights;
    this.ep = m.kind === 'double' ? (m.from[0] + m.to[0]) >> 1 : -1;
    this.halfmove = piece.type === 'P' || undo.prevType === 'P' || m.captures.length > 0 ? 0 : this.halfmove + 1;
    if (this.turn === 'b') this.fullmove++;
    this.turn = this.turn === 'w' ? 'b' : 'w';
    this.undos.push(undo);
  }

  undoMove(): Move | undefined {
    const u = this.undos.pop();
    if (!u) return undefined;
    const m = u.move;
    const piece = this.pieces.get(m.pieceId)!;

    for (const s of m.to) this.board[s] = -1;
    if (m.rook) {
      const rook = this.pieces.get(m.rook.id)!;
      this.board[m.rook.to] = -1;
      this.board[m.rook.from] = rook.id;
      rook.squares = [m.rook.from];
    }
    piece.squares = [...m.from];
    for (const s of m.from) this.board[s] = piece.id;
    piece.type = u.prevType;
    if (u.prevPhase !== undefined) piece.phase = u.prevPhase;

    for (const victim of u.captured) {
      this.pieces.set(victim.id, victim);
      for (const s of victim.squares) this.board[s] = victim.id;
    }

    this.castling = u.castling;
    this.ep = u.ep;
    this.halfmove = u.halfmove;
    this.fullmove = u.fullmove;
    this.turn = this.turn === 'w' ? 'b' : 'w';
    return m;
  }

  /** All pieces of one color (snapshot). */
  piecesOf(color: Color): Piece[] {
    const out: Piece[] = [];
    for (const p of this.pieces.values()) if (p.color === color) out.push(p);
    return out;
  }
}
