import type { GameState } from './state';
import { CASTLE_BK, CASTLE_BQ, CASTLE_WK, CASTLE_WQ } from './state';
import type { Color, Move } from './types';
import { opposite } from './types';
import { PIECES } from './pieces/registry';

export function isSquareAttacked(state: GameState, target: number, by: Color): boolean {
  for (const p of state.pieces.values()) {
    if (p.color === by && PIECES[p.type].attacks(state, p, target)) return true;
  }
  return false;
}

export function inCheck(state: GameState, color: Color): boolean {
  const k = state.kingSquare(color);
  return k >= 0 && isSquareAttacked(state, k, opposite(color));
}

function castlingMoves(state: GameState, color: Color, out: Move[]): void {
  const king = state.pieces.get(state.kings[color]);
  if (!king) return;
  const home = color === 'w' ? 4 : 60;
  if (king.squares[0] !== home) return;
  const kRight = color === 'w' ? CASTLE_WK : CASTLE_BK;
  const qRight = color === 'w' ? CASTLE_WQ : CASTLE_BQ;
  if (!(state.castling & (kRight | qRight))) return;
  const enemy = opposite(color);
  const rookOn = (s: number) => {
    const p = state.pieceAt(s);
    return p && p.type === 'R' && p.color === color ? p : undefined;
  };
  const empty = (...squares: number[]) => squares.every((s) => state.board[s] === -1);
  const safe = (...squares: number[]) => squares.every((s) => !isSquareAttacked(state, s, enemy));

  if (state.castling & kRight) {
    const rook = rookOn(home + 3);
    if (rook && empty(home + 1, home + 2) && safe(home, home + 1, home + 2)) {
      out.push({
        pieceId: king.id, from: [home], to: [home + 2], captures: [], kind: 'castle',
        rook: { id: rook.id, from: home + 3, to: home + 1 },
      });
    }
  }
  if (state.castling & qRight) {
    const rook = rookOn(home - 4);
    if (rook && empty(home - 1, home - 2, home - 3) && safe(home, home - 1, home - 2)) {
      out.push({
        pieceId: king.id, from: [home], to: [home - 2], captures: [], kind: 'castle',
        rook: { id: rook.id, from: home - 4, to: home - 1 },
      });
    }
  }
}

/** Moves that obey piece rules but may leave the mover's king in check. */
export function pseudoLegalMoves(state: GameState, color: Color = state.turn): Move[] {
  const out: Move[] = [];
  for (const p of state.piecesOf(color)) PIECES[p.type].generate(state, p, out);
  castlingMoves(state, color, out);
  return out;
}

export function legalMoves(state: GameState): Move[] {
  const mover = state.turn;
  const out: Move[] = [];
  for (const m of pseudoLegalMoves(state, mover)) {
    state.makeMove(m);
    if (!inCheck(state, mover)) out.push(m);
    state.undoMove();
  }
  return out;
}

export function perft(state: GameState, depth: number): number {
  if (depth === 0) return 1;
  const mover = state.turn;
  let n = 0;
  for (const m of pseudoLegalMoves(state, mover)) {
    state.makeMove(m);
    if (!inCheck(state, mover)) n += depth === 1 ? 1 : perft(state, depth - 1);
    state.undoMove();
  }
  return n;
}
