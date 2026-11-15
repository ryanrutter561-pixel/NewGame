import type { GameState } from '../state';
import type { Move, Piece, PieceType } from '../types';
import { ALL_DIRS, DIAG, KNIGHT_JUMPS, ORTHO, fileOf, onBoard, rankOf, sq } from '../square';
import { pushStep, slideAttacks, slideMoves, type PieceDef } from './common';

export const King: PieceDef = {
  type: 'K', name: 'King', value: 0,
  generate(state, piece, out) {
    const s = piece.squares[0];
    for (const [df, dr] of ALL_DIRS) {
      const f = fileOf(s) + df, r = rankOf(s) + dr;
      if (onBoard(f, r)) pushStep(state, piece, sq(f, r), out);
    }
    // Castling is generated in movegen (needs attack detection).
  },
  attacks(_state, piece, target) {
    const s = piece.squares[0];
    return s !== target &&
      Math.abs(fileOf(s) - fileOf(target)) <= 1 && Math.abs(rankOf(s) - rankOf(target)) <= 1;
  },
};

export const Knight: PieceDef = {
  type: 'N', name: 'Knight', value: 320,
  generate(state, piece, out) {
    const s = piece.squares[0];
    for (const [df, dr] of KNIGHT_JUMPS) {
      const f = fileOf(s) + df, r = rankOf(s) + dr;
      if (onBoard(f, r)) pushStep(state, piece, sq(f, r), out);
    }
  },
  attacks(_state, piece, target) {
    const s = piece.squares[0];
    const df = Math.abs(fileOf(s) - fileOf(target)), dr = Math.abs(rankOf(s) - rankOf(target));
    return (df === 1 && dr === 2) || (df === 2 && dr === 1);
  },
};

function slider(type: PieceType, name: string, value: number, dirs: typeof ORTHO): PieceDef {
  return {
    type, name, value,
    generate: (state, piece, out) => slideMoves(state, piece, dirs, 7, out),
    attacks: (state, piece, target) => slideAttacks(state, piece.squares[0], target, dirs, 7),
  };
}

export const Bishop = slider('B', 'Bishop', 330, DIAG);
export const Rook = slider('R', 'Rook', 500, ORTHO);
export const Queen = slider('Q', 'Queen', 900, ALL_DIRS);

const PROMOTIONS: PieceType[] = ['Q', 'R', 'B', 'N'];

function pushPawnMove(piece: Piece, from: number, to: number, captures: number[], out: Move[], kind: Move['kind'] = 'normal') {
  const lastRank = piece.color === 'w' ? 7 : 0;
  if (rankOf(to) === lastRank) {
    for (const promotion of PROMOTIONS) {
      out.push({ pieceId: piece.id, from: [from], to: [to], captures, kind, promotion });
    }
  } else {
    out.push({ pieceId: piece.id, from: [from], to: [to], captures, kind });
  }
}

export const Pawn: PieceDef = {
  type: 'P', name: 'Pawn', value: 100,
  generate(state: GameState, piece: Piece, out: Move[]) {
    const s = piece.squares[0];
    const dir = piece.color === 'w' ? 1 : -1;
    const f = fileOf(s), r = rankOf(s);
    const startRank = piece.color === 'w' ? 1 : 6;
    if (onBoard(f, r + dir)) {
      const one = sq(f, r + dir);
      if (state.board[one] === -1) {
        pushPawnMove(piece, s, one, [], out);
        if (r === startRank) {
          const two = sq(f, r + 2 * dir);
          if (state.board[two] === -1) {
            out.push({ pieceId: piece.id, from: [s], to: [two], captures: [], kind: 'double' });
          }
        }
      }
    }
    for (const df of [-1, 1]) {
      if (!onBoard(f + df, r + dir)) continue;
      const t = sq(f + df, r + dir);
      const occ = state.pieceAt(t);
      if (occ && occ.color !== piece.color && occ.type !== 'K') {
        pushPawnMove(piece, s, t, [occ.id], out);
      } else if (!occ && t === state.ep) {
        const victim = state.pieceAt(sq(f + df, r));
        if (victim && victim.type === 'P' && victim.color !== piece.color) {
          out.push({ pieceId: piece.id, from: [s], to: [t], captures: [victim.id], kind: 'enpassant' });
        }
      }
    }
  },
  attacks(_state, piece, target) {
    const s = piece.squares[0];
    const dir = piece.color === 'w' ? 1 : -1;
    return rankOf(target) - rankOf(s) === dir && Math.abs(fileOf(target) - fileOf(s)) === 1;
  },
};
