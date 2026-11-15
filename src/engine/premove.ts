import { GameState } from './state';
import type { Color, Move, PieceType } from './types';
import { PIECES } from './pieces/registry';
import { fileOf, onBoard, rankOf, sq } from './square';
import { CASTLE_BK, CASTLE_BQ, CASTLE_WK, CASTLE_WQ } from './state';

const PROMOS: PieceType[] = ['Q', 'R', 'B', 'N'];

/**
 * Moves a player may queue while the opponent is thinking. Like most chess sites, a premove only
 * has to fit the piece's movement pattern — blockers are ignored (they might move or be captured),
 * pawns may always premove diagonally, and castling is allowed while the rights remain.
 */
export function premoveCandidates(st: GameState, color: Color): Move[] {
  const out: Move[] = [];
  for (const p of st.piecesOf(color)) {
    // Generate on an otherwise empty board to get the raw movement pattern.
    const solo = new GameState();
    const copy = solo.addPiece(p.type, p.color, p.squares, p.phase, p.id);
    const moves: Move[] = [];
    PIECES[p.type].generate(solo, copy, moves);
    if (p.type === 'P') {
      const s = p.squares[0];
      const dir = color === 'w' ? 1 : -1;
      for (const df of [-1, 1]) {
        const f = fileOf(s) + df, r = rankOf(s) + dir;
        if (!onBoard(f, r)) continue;
        const to = sq(f, r);
        const last = r === (color === 'w' ? 7 : 0);
        for (const promotion of last ? PROMOS : [undefined]) {
          moves.push({ pieceId: p.id, from: [s], to: [to], captures: [], kind: 'normal', promotion });
        }
      }
    }
    out.push(...moves);
  }

  const king = st.pieces.get(st.kings[color]);
  const home = color === 'w' ? 4 : 60;
  if (king && king.squares[0] === home) {
    const [kRight, qRight] = color === 'w' ? [CASTLE_WK, CASTLE_WQ] : [CASTLE_BK, CASTLE_BQ];
    if (st.castling & kRight) out.push({ pieceId: king.id, from: [home], to: [home + 2], captures: [], kind: 'castle' });
    if (st.castling & qRight) out.push({ pieceId: king.id, from: [home], to: [home - 2], captures: [], kind: 'castle' });
  }

  // Drop duplicates (e.g. king's castle square already reachable).
  const seen = new Set<string>();
  return out.filter((m) => {
    const k = intentKey(m);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Identifies what the player wants: which piece, where it ends up, and any promotion. */
export function intentKey(m: Move): string {
  return `${m.pieceId}:${[...m.to].sort((a, b) => a - b).join(',')}:${m.promotion ?? ''}`;
}

/** The legal move (if any) that carries out a queued premove in the current position. */
export function resolvePremove(premove: Move, legal: Move[]): Move | undefined {
  const key = intentKey(premove);
  return legal.find((m) => intentKey(m) === key);
}
