import { describe, expect, it } from 'vitest';
import { fromFEN, START_FEN } from '../src/engine/position';
import { perft } from '../src/engine/movegen';
import { startingPosition } from '../src/engine/loadouts';

describe('perft (standard chess correctness)', () => {
  it('start position', () => {
    const st = fromFEN(START_FEN);
    expect([1, 2, 3, 4].map((d) => perft(st, d))).toEqual([20, 400, 8902, 197281]);
  });

  it('kiwipete (castling, en passant, promotion)', () => {
    const st = fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    expect([1, 2, 3].map((d) => perft(st, d))).toEqual([48, 2039, 97862]);
  });

  it('position 3 (en passant edge cases)', () => {
    const st = fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
    expect([1, 2, 3, 4].map((d) => perft(st, d))).toEqual([14, 191, 2812, 43238]);
  });

  it('position 4 (promotions, castling through check)', () => {
    const st = fromFEN('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
    expect([1, 2, 3].map((d) => perft(st, d))).toEqual([6, 264, 9467]);
  });

  it('loadout builder matches the standard start', () => {
    expect(perft(startingPosition('standard', 'standard'), 3)).toBe(8902);
  });

  it('make/undo restores the position exactly', () => {
    const st = fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    const before = JSON.stringify([...st.board]);
    perft(st, 3);
    expect(JSON.stringify([...st.board])).toBe(before);
    expect(st.ply).toBe(0);
  });
});
