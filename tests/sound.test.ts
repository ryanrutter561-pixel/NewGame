import { describe, expect, it } from 'vitest';
import { fromFEN, findMove } from '../src/engine/position';
import { legalMoves } from '../src/engine/movegen';
import { moveSounds } from '../src/audio/moveSounds';
import { sound } from '../src/audio/sound';

const after = (fen: string, key: string) => {
  const st = fromFEN(fen);
  const m = findMove(legalMoves(st), key)!;
  st.makeMove(m);
  return moveSounds(st, m);
};

describe('move sounds', () => {
  it('picks move / capture / check / checkmate', () => {
    expect(after('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', 'e2e4')).toEqual(['move']);
    expect(after('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', 'e4d5')).toEqual(['capture']);
    expect(after('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8')).toEqual(['move', 'check']);
    expect(after('6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', 'e1e8')).toEqual(['move', 'checkmate']);
    expect(after('3rk3/8/8/8/8/8/8/3RK2R w - - 0 1', 'd1d8')).toEqual(['capture', 'check']);
  });

  it('playing is a safe no-op without Web Audio', () => {
    expect(() => sound.play('win')).not.toThrow();
  });
});
