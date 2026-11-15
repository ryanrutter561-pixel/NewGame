import type { GameState } from '../engine/state';
import type { Color, PieceType } from '../engine/types';

/** Conventional point values for the material count shown next to captured pieces. */
export const POINTS: Record<PieceType, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, M: 4, C: 7, K: 0 };

/** Board material of `color` minus the opponent's, in points. */
export function materialBalance(st: GameState, color: Color): number {
  let sum = 0;
  for (const p of st.pieces.values()) sum += (p.color === color ? 1 : -1) * POINTS[p.type];
  return sum;
}
