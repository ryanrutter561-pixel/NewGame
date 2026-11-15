import type { GameState } from './state';
import type { Move } from './types';
import { inCheck, legalMoves } from './movegen';

/** Orders checking moves first — they're the likeliest mating tries. */
function orderedAttackerMoves(st: GameState): Move[] {
  const moves = legalMoves(st);
  const defender = st.turn === 'w' ? 'b' : 'w';
  const scored = moves.map((m) => {
    st.makeMove(m);
    const check = inCheck(st, defender);
    st.undoMove();
    return { m, s: (check ? 100 : 0) + m.captures.length };
  });
  return scored.sort((a, b) => b.s - a.s).map((x) => x.m);
}

/** Side to move can force mate within `n` of its own moves. */
export function canForceMate(st: GameState, n: number): boolean {
  return findMatingMove(st, n) !== null;
}

export function findMatingMove(st: GameState, n: number): Move | null {
  if (n <= 0) return null;
  for (const m of orderedAttackerMoves(st)) {
    st.makeMove(m);
    const wins = defenderLoses(st, n - 1);
    st.undoMove();
    if (wins) return m;
  }
  return null;
}

/** Side to move (defender) is mated now, or every reply allows mate within `n`. */
export function defenderLoses(st: GameState, n: number): boolean {
  const replies = legalMoves(st);
  if (replies.length === 0) return inCheck(st, st.turn);
  if (n <= 0) return false;
  for (const r of replies) {
    st.makeMove(r);
    const mated = findMatingMove(st, n) !== null;
    st.undoMove();
    if (!mated) return false;
  }
  return true;
}

/** The defender's most stubborn reply, given the attacker has `n` moves left to mate. */
export function bestDefence(st: GameState, n: number): Move | null {
  let pool = legalMoves(st);
  if (!pool.length) return null;
  for (let k = 1; k < n; k++) {
    const next = pool.filter((r) => {
      st.makeMove(r);
      const quick = findMatingMove(st, k) !== null;
      st.undoMove();
      return !quick;
    });
    if (!next.length) break;
    pool = next;
  }
  return pool[0];
}
