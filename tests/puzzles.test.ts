import { describe, expect, it } from 'vitest';
import { PUZZLES } from '../src/data/puzzles';
import { PuzzleSession } from '../src/game/puzzles';
import { fromFEN, findMove } from '../src/engine/position';
import { legalMoves, inCheck } from '../src/engine/movegen';
import { isCheckmate } from '../src/engine/rules';
import { canForceMate } from '../src/engine/mate';
import { PIECES } from '../src/engine/pieces/registry';
import type { GameState } from '../src/engine/state';
import type { Color } from '../src/engine/types';

const material = (st: GameState, c: Color) =>
  [...st.pieces.values()].filter((p) => p.color === c).reduce((s, p) => s + PIECES[p.type].value, 0);

describe('puzzle data', () => {
  it('has unique ids', () => {
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(PUZZLES.length);
  });

  for (const def of PUZZLES) {
    it(`${def.id}: solution is legal and reaches the goal`, () => {
      const st = fromFEN(def.fen, def.extra);
      const me = st.turn;
      expect(inCheck(st, me === 'w' ? 'b' : 'w')).toBe(false);
      const startDiff = material(st, me) - material(st, me === 'w' ? 'b' : 'w');
      expect(def.solution.length).toBe(def.moves * 2 - 1);
      for (const key of def.solution) {
        const m = findMove(legalMoves(st), key);
        expect(m, `${key} should be legal`).toBeDefined();
        st.makeMove(m!);
      }
      if (def.goal === 'mate') {
        expect(isCheckmate(st)).toBe(true);
        expect(canForceMate(fromFEN(def.fen, def.extra), def.moves)).toBe(true);
      } else {
        const endDiff = material(st, me) - material(st, me === 'w' ? 'b' : 'w');
        expect(endDiff - startDiff).toBeGreaterThanOrEqual(300);
      }
    });

    it(`${def.id}: session accepts the scripted line`, () => {
      const s = new PuzzleSession(def);
      for (let i = 0; i < def.solution.length; i += 2) {
        const m = findMove(s.legal, def.solution[i])!;
        const fb = s.playerMove(m);
        expect(fb).toBe(i === def.solution.length - 1 ? 'solved' : 'continue');
        if (fb === 'continue') expect(s.opponentReply()).not.toBeNull();
      }
      expect(s.status).toBe('solved');
    });
  }
});

describe('puzzle session', () => {
  it('rejects a wrong move and leaves the board unchanged', () => {
    const s = new PuzzleSession(PUZZLES[0]);
    const wrong = s.legal.find((m) => !isCheckmateAfter(s.state, m))!;
    expect(s.playerMove(wrong)).toBe('wrong');
    expect(s.state.ply).toBe(0);
    expect(s.mistakes).toBe(1);
  });

  it('caches legal moves so reading them mid-iteration cannot loop forever', () => {
    // Regression: recomputing legal moves make/undoes Cavalry tramples, which re-inserts the
    // trampled pieces at the end of the pieces map — the board's draw loop (which read the
    // legal moves while iterating that map) then never terminated.
    const s = new PuzzleSession(PUZZLES.find((p) => p.id === 'stampede')!);
    expect(s.legal).toBe(s.legal);
    let visited = 0;
    for (const _ of s.state.pieces.values()) {
      void s.legal;
      if (++visited > 100) break;
    }
    expect(visited).toBe(s.state.pieces.size);
  });

  it('accepts an alternative mating line in mate puzzles', () => {
    const def = PUZZLES.find((p) => p.id === 'the-ladder')!;
    const s = new PuzzleSession(def);
    expect(s.hint()).not.toBeNull();
    s.playerMove(s.hint()!);
    s.opponentReply();
    const finisher = s.hint()!;
    expect(s.playerMove(finisher)).toBe('solved');
  });
});

function isCheckmateAfter(st: GameState, m: Parameters<GameState['makeMove']>[0]) {
  st.makeMove(m);
  const r = isCheckmate(st);
  st.undoMove();
  return r;
}
