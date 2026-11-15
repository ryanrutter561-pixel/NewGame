import { GameState, CASTLE_BK, CASTLE_BQ, CASTLE_WK, CASTLE_WQ } from './state';
import type { Color, MarshalPhase, Move, PieceType } from './types';
import { parseSquare, squareName, sq } from './square';

export interface PieceSpec {
  type: PieceType;
  color: Color;
  squares: string[];
  phase?: MarshalPhase;
}

/**
 * Parse FEN. Besides the standard letters, `M`/`m` places a Marshal (long phase).
 * Cavalry (two squares wide) can't be expressed in FEN; pass them via `extra`.
 */
export function fromFEN(fen: string, extra: PieceSpec[] = []): GameState {
  const [placement, turn = 'w', castling = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
  const st = new GameState();
  const rows = placement.split('/');
  if (rows.length !== 8) throw new Error(`Bad FEN: ${fen}`);
  rows.forEach((row, i) => {
    const rank = 7 - i;
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { file += Number(ch); continue; }
      const color: Color = ch === ch.toUpperCase() ? 'w' : 'b';
      const type = ch.toUpperCase() as PieceType;
      if (!'KQRBNPM'.includes(type)) throw new Error(`Bad FEN piece: ${ch}`);
      st.addPiece(type, color, [sq(file, rank)]);
      file++;
    }
  });
  for (const p of extra) st.addPiece(p.type, p.color, p.squares.map(parseSquare), p.phase);
  st.turn = turn === 'b' ? 'b' : 'w';
  st.castling =
    (castling.includes('K') ? CASTLE_WK : 0) | (castling.includes('Q') ? CASTLE_WQ : 0) |
    (castling.includes('k') ? CASTLE_BK : 0) | (castling.includes('q') ? CASTLE_BQ : 0);
  st.ep = ep === '-' ? -1 : parseSquare(ep);
  st.halfmove = Number(half) || 0;
  st.fullmove = Number(full) || 1;
  return st;
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Plain-data snapshot used to hand a position to the AI worker. */
export interface SerializedState {
  pieces: { id: number; type: PieceType; color: Color; squares: number[]; phase?: MarshalPhase }[];
  turn: Color;
  castling: number;
  ep: number;
  halfmove: number;
  fullmove: number;
}

export function serialize(st: GameState): SerializedState {
  return {
    pieces: [...st.pieces.values()].map((p) => ({ id: p.id, type: p.type, color: p.color, squares: [...p.squares], phase: p.phase })),
    turn: st.turn, castling: st.castling, ep: st.ep, halfmove: st.halfmove, fullmove: st.fullmove,
  };
}

export function deserialize(data: SerializedState): GameState {
  const st = new GameState();
  for (const p of data.pieces) st.addPiece(p.type, p.color, p.squares, p.phase, p.id);
  st.turn = data.turn;
  st.castling = data.castling;
  st.ep = data.ep;
  st.halfmove = data.halfmove;
  st.fullmove = data.fullmove;
  return st;
}

/**
 * Stable text id for a move: "e2e4", "e7e8q", and for two-square pieces "a1b1>a3b3".
 * Used by puzzles and for passing moves between threads.
 */
export function moveKey(m: Move): string {
  if (m.from.length > 1) {
    const names = (squares: number[]) => [...squares].sort((a, b) => a - b).map(squareName).join('');
    return `${names(m.from)}>${names(m.to)}`;
  }
  return squareName(m.from[0]) + squareName(m.to[0]) + (m.promotion ? m.promotion.toLowerCase() : '');
}

export function findMove(moves: Move[], key: string): Move | undefined {
  return moves.find((m) => moveKey(m) === key);
}

/** Human-readable move text (long algebraic), computed BEFORE the move is made. */
export function describeMove(st: GameState, m: Move): string {
  const p = st.pieces.get(m.pieceId)!;
  if (m.kind === 'castle') return m.to[0] > m.from[0] ? 'O-O' : 'O-O-O';
  const sep = m.captures.length ? 'x' : '-';
  if (p.type === 'C') {
    const names = (s: number[]) => [...s].sort((a, b) => a - b).map(squareName).join('');
    const trample = m.captures.length > 1 ? ` (×${m.captures.length})` : '';
    return `C${names(m.from)}${sep}${names(m.to)}${m.kind === 'pivot' ? ' (pivot)' : ''}${trample}`;
  }
  const letter = p.type === 'P' ? '' : p.type;
  const promo = m.promotion ? `=${m.promotion}` : '';
  return `${letter}${squareName(m.from[0])}${sep}${squareName(m.to[0])}${promo}`;
}
