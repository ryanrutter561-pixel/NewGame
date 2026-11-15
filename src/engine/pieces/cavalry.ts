import type { GameState } from '../state';
import type { Move, Piece } from '../types';
import { ORTHO, fileOf, onBoard, rankOf, sq } from '../square';
import type { PieceDef } from './common';

export const CAVALRY_RANGE = 2;

export interface CavalryRoute {
  to: number[];
  /** Squares newly entered (passed through or landed on), excluding the piece's own squares. */
  swept: number[];
  /** Enemy piece ids that would be trampled/captured. */
  captures: number[];
  kind: 'normal' | 'pivot';
  /** Set when an enemy king sits on the route (that's check, never a legal capture). */
  hitsKing: boolean;
}

export const isHorizontal = (piece: Piece): boolean =>
  rankOf(piece.squares[0]) === rankOf(piece.squares[1]);

/**
 * Every route the Cavalry could take. Friendly pieces block; enemies on the route are trampled.
 * Slides: 1..2 squares in each orthogonal direction keeping orientation.
 * Pivots: keep one square, swing the other 90° onto a square adjacent to the kept one.
 */
export function cavalryRoutes(state: GameState, piece: Piece): CavalryRoute[] {
  const routes: CavalryRoute[] = [];
  const own = piece.squares;

  const visit = (s: number, captures: Set<number>): 'ok' | 'blocked' | 'king' => {
    const id = state.board[s];
    if (id === -1 || id === piece.id) return 'ok';
    const occ = state.pieces.get(id)!;
    if (occ.color === piece.color) return 'blocked';
    captures.add(id);
    return occ.type === 'K' ? 'king' : 'ok';
  };

  for (const [df, dr] of ORTHO) {
    const captures = new Set<number>();
    const swept: number[] = [];
    let hitsKing = false;
    for (let k = 1; k <= CAVALRY_RANGE; k++) {
      const to: number[] = [];
      let off = false;
      for (const s of own) {
        const f = fileOf(s) + df * k, r = rankOf(s) + dr * k;
        if (!onBoard(f, r)) { off = true; break; }
        to.push(sq(f, r));
      }
      if (off) break;
      let blocked = false;
      for (const s of to) {
        if (own.includes(s) || swept.includes(s)) continue;
        const v = visit(s, captures);
        if (v === 'blocked') { blocked = true; break; }
        if (v === 'king') hitsKing = true;
        swept.push(s);
      }
      if (blocked) break;
      routes.push({ to, swept: [...swept], captures: [...captures], kind: 'normal', hitsKing });
    }
  }

  const horizontal = isHorizontal(piece);
  const perps: [number, number][] = horizontal ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
  for (const anchor of own) {
    for (const [df, dr] of perps) {
      const f = fileOf(anchor) + df, r = rankOf(anchor) + dr;
      if (!onBoard(f, r)) continue;
      const target = sq(f, r);
      const captures = new Set<number>();
      const v = visit(target, captures);
      if (v === 'blocked') continue;
      routes.push({
        to: [anchor, target], swept: [target], captures: [...captures], kind: 'pivot', hitsKing: v === 'king',
      });
    }
  }
  return routes;
}

/**
 * Cavalry — a two-wide pair of horses. Slides up to 2 squares orthogonally (keeping its
 * orientation), trampling every enemy on its route, or pivots 90° around either square.
 * Capturing either of its squares removes the whole piece.
 */
export const Cavalry: PieceDef = {
  type: 'C', name: 'Cavalry', value: 700,
  generate(state, piece, out: Move[]) {
    for (const r of cavalryRoutes(state, piece)) {
      if (r.hitsKing) continue;
      out.push({ pieceId: piece.id, from: [...piece.squares], to: r.to, captures: r.captures, kind: r.kind });
    }
  },
  attacks(state, piece, target) {
    for (const r of cavalryRoutes(state, piece)) {
      if (r.swept.includes(target)) return true;
    }
    return false;
  },
};
