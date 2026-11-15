import type { GameState } from '../state';
import type { Move, Piece } from '../types';
import { fileOf, onBoard, rankOf, sq, type Dir } from '../square';

export interface PieceDef {
  type: Piece['type'];
  name: string;
  /** Material value in centipawns (used by the AI). */
  value: number;
  /** Push pseudo-legal moves (own king safety is checked later). */
  generate(state: GameState, piece: Piece, out: Move[]): void;
  /** Does this piece attack `target` in the current position? */
  attacks(state: GameState, piece: Piece, target: number): boolean;
}

/** Push a single-square move, or nothing if blocked by a friendly piece / enemy king. */
export function pushStep(state: GameState, piece: Piece, to: number, out: Move[]): boolean {
  const occ = state.pieceAt(to);
  if (!occ) {
    out.push({ pieceId: piece.id, from: [piece.squares[0]], to: [to], captures: [], kind: 'normal' });
    return true;
  }
  if (occ.color !== piece.color && occ.type !== 'K') {
    out.push({ pieceId: piece.id, from: [piece.squares[0]], to: [to], captures: [occ.id], kind: 'normal' });
  }
  return false;
}

export function slideMoves(
  state: GameState, piece: Piece, dirs: readonly Dir[], maxRange: number, out: Move[],
): void {
  const from = piece.squares[0];
  const f0 = fileOf(from), r0 = rankOf(from);
  for (const [df, dr] of dirs) {
    for (let k = 1; k <= maxRange; k++) {
      const f = f0 + df * k, r = r0 + dr * k;
      if (!onBoard(f, r)) break;
      if (!pushStep(state, piece, sq(f, r), out)) break;
    }
  }
}

/** True if a slider at `from` along `dirs` with `maxRange` reaches `target` through empty squares. */
export function slideAttacks(
  state: GameState, from: number, target: number, dirs: readonly Dir[], maxRange: number,
): boolean {
  const df = fileOf(target) - fileOf(from);
  const dr = rankOf(target) - rankOf(from);
  if (df === 0 && dr === 0) return false;
  const dist = Math.max(Math.abs(df), Math.abs(dr));
  if (dist > maxRange) return false;
  const sf = Math.sign(df), sr = Math.sign(dr);
  if (!(df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr))) return false;
  if (!dirs.some(([a, b]) => a === sf && b === sr)) return false;
  for (let k = 1; k < dist; k++) {
    if (state.board[from + sf * k + sr * 8 * k] !== -1) return false;
  }
  return true;
}
