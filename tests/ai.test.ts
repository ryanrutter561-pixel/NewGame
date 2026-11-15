import { describe, expect, it } from 'vitest';
import { fromFEN, moveKey } from '../src/engine/position';
import { searchBestMove } from '../src/ai/search';
import { startingPosition } from '../src/engine/loadouts';
import { legalMoves } from '../src/engine/movegen';

const opts = { maxDepth: 4, timeMs: 5000 };

describe('AI', () => {
  it('finds a back-rank mate in one', () => {
    const st = fromFEN('6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1');
    expect(moveKey(searchBestMove(st, opts).move!)).toBe('e1e8');
  });

  it('moves its queen out of a pawn attack', () => {
    const st = fromFEN('rnb1kbnr/pppp1ppp/8/4p3/3q4/2P5/PP1PPPPP/RNBQKBNR b KQkq - 0 3');
    const m = searchBestMove(st, opts).move!;
    expect(moveKey(m).startsWith('d4')).toBe(true);
  });

  it('takes a free queen', () => {
    const st = fromFEN('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1');
    expect(moveKey(searchBestMove(st, opts).move!)).toBe('d1d5');
  });

  it('plays legal moves with custom armies on both sides', () => {
    const st = startingPosition('cavalry', 'marshal');
    for (let i = 0; i < 12; i++) {
      const res = searchBestMove(st, { maxDepth: 2, timeMs: 1000 });
      if (!res.move) break;
      expect(legalMoves(st).map(moveKey)).toContain(moveKey(res.move));
      st.makeMove(res.move);
    }
  });
});
