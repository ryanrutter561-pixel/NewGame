import type { GameState } from './state';
import type { Color } from './types';
import { opposite } from './types';
import { inCheck, legalMoves } from './movegen';
import { squareName } from './square';

export type EndReason =
  | 'checkmate' | 'stalemate' | 'timeout' | 'resignation' | 'threefold' | 'fifty-move' | 'insufficient';

export interface GameResult {
  winner: Color | null;
  reason: EndReason;
}

/** Identifies a position for repetition detection (pieces, phases, side, rights, ep). */
export function positionKey(st: GameState): string {
  const parts: string[] = [];
  for (let s = 0; s < 64; s++) {
    const p = st.pieceAt(s);
    if (!p) continue;
    parts.push(`${squareName(s)}${p.color}${p.type}${p.phase === 'short' ? '1' : ''}`);
  }
  return `${parts.join(',')}|${st.turn}|${st.castling}|${st.ep}`;
}

/** Only kings plus at most one minor (bishop or knight) — nobody can mate. */
export function insufficientMaterial(st: GameState): boolean {
  let minors = 0;
  for (const p of st.pieces.values()) {
    if (p.type === 'K') continue;
    if (p.type === 'B' || p.type === 'N') minors++;
    else return false;
  }
  return minors <= 1;
}

/** Can `color` still possibly checkmate (used when the opponent's flag falls)? */
export function hasMatingMaterial(st: GameState, color: Color): boolean {
  let minors = 0;
  for (const p of st.pieces.values()) {
    if (p.color !== color || p.type === 'K') continue;
    if (p.type === 'B' || p.type === 'N') minors++;
    else return true;
  }
  return minors >= 2;
}

export function isCheckmate(st: GameState): boolean {
  return inCheck(st, st.turn) && legalMoves(st).length === 0;
}

/** Result of the position for the side to move, or null if play continues. */
export function adjudicate(st: GameState, repetitions = 1): GameResult | null {
  if (legalMoves(st).length === 0) {
    return inCheck(st, st.turn)
      ? { winner: opposite(st.turn), reason: 'checkmate' }
      : { winner: null, reason: 'stalemate' };
  }
  if (repetitions >= 3) return { winner: null, reason: 'threefold' };
  if (st.halfmove >= 100) return { winner: null, reason: 'fifty-move' };
  if (insufficientMaterial(st)) return { winner: null, reason: 'insufficient' };
  return null;
}
