import { ALL_DIRS } from '../square';
import type { Piece } from '../types';
import { slideAttacks, slideMoves, type PieceDef } from './common';

export const marshalRange = (piece: Piece): number => (piece.phase === 'short' ? 1 : 3);

/**
 * Marshal — moves like a queen, but its range alternates every time it moves:
 * up to 3 squares on a "long" turn, exactly 1 on a "short" turn. Starts long.
 */
export const Marshal: PieceDef = {
  type: 'M', name: 'Marshal', value: 450,
  generate: (state, piece, out) => slideMoves(state, piece, ALL_DIRS, marshalRange(piece), out),
  attacks: (state, piece, target) =>
    slideAttacks(state, piece.squares[0], target, ALL_DIRS, marshalRange(piece)),
};
