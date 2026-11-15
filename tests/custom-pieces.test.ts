import { describe, expect, it } from 'vitest';
import { fromFEN, moveKey } from '../src/engine/position';
import { inCheck, legalMoves, perft } from '../src/engine/movegen';
import { startingPosition } from '../src/engine/loadouts';
import { isCheckmate } from '../src/engine/rules';
import { parseSquare as P } from '../src/engine/square';
import type { GameState } from '../src/engine/state';

const keysFor = (st: GameState, square: string) =>
  legalMoves(st).filter((m) => m.from.includes(P(square))).map(moveKey).sort();

const play = (st: GameState, key: string) => {
  const m = legalMoves(st).find((x) => moveKey(x) === key);
  if (!m) throw new Error(`Illegal: ${key}. Legal: ${legalMoves(st).map(moveKey).join(' ')}`);
  st.makeMove(m);
  return m;
};

describe('Marshal', () => {
  it('moves up to 3 like a queen on a long turn, then exactly 1', () => {
    const st = fromFEN('4k3/8/8/8/3M4/8/8/4K3 w - - 0 1');
    const long = keysFor(st, 'd4');
    expect(long).toContain('d4d7');
    expect(long).toContain('d4g7');
    expect(long).not.toContain('d4d8');
    expect(long).toHaveLength(8 * 3); // 8 directions × 3 squares, all on the board from d4
  });

  it('alternates long/short and undo restores the phase', () => {
    const st = fromFEN('4k3/8/8/8/3M4/8/8/4K3 w - - 0 1');
    play(st, 'd4d7');
    play(st, 'e8f8');
    expect(st.pieceAt(P('d7'))!.phase).toBe('short');
    const short = keysFor(st, 'd7');
    expect(short.every((k) => Math.abs(P(k.slice(2, 4)) - P('d7')) <= 9)).toBe(true);
    expect(short).not.toContain('d7d5');
    play(st, 'd7d6');
    play(st, 'f8e8');
    expect(st.pieceAt(P('d6'))!.phase).toBe('long');
    st.undoMove(); st.undoMove();
    expect(st.pieceAt(P('d7'))!.phase).toBe('short');
    st.undoMove(); st.undoMove();
    expect(st.pieceAt(P('d4'))!.phase).toBe('long');
  });

  it('is blocked by pieces and captures the first enemy in line', () => {
    const st = fromFEN('4k3/8/8/3p4/8/3M4/8/4K3 w - - 0 1');
    const keys = keysFor(st, 'd3');
    expect(keys).toContain('d3d5');
    expect(keys).not.toContain('d3d6');
  });

  it('gives check only within its current range', () => {
    const near = fromFEN('8/8/8/3k4/8/3M4/8/4K3 b - - 0 1');
    expect(inCheck(near, 'b')).toBe(true);
    const short = fromFEN('8/8/8/3k4/8/3M4/8/4K3 b - - 0 1');
    short.pieceAt(P('d3'))!.phase = 'short';
    expect(inCheck(short, 'b')).toBe(false);
  });

  it('marshal loadout starting position has sane move counts', () => {
    const st = startingPosition('marshal', 'marshal');
    // Marshals don't jump, so at the start they're boxed in like bishops: only pawn moves.
    expect(legalMoves(st)).toHaveLength(16);
    expect(perft(st, 3)).toBeGreaterThan(0);
  });
});

describe('Cavalry', () => {
  const cav = (fen: string, squares: string[], color: 'w' | 'b' = 'w') =>
    fromFEN(fen, [{ type: 'C', color, squares }]);

  it('slides up to 2 squares in each direction and pivots', () => {
    const st = cav('4k3/8/8/8/8/8/8/4K3 w - - 0 1', ['c4', 'd4']);
    expect(keysFor(st, 'c4')).toEqual([
      'c4d4>a4b4', 'c4d4>b4c4', // left 2, left 1
      'c4d4>c2d2', 'c4d4>c3d3', // down
      'c4d4>c5d5', 'c4d4>c6d6', // up
      'c4d4>d4e4', 'c4d4>e4f4', // right
      'c4d4>c3c4', 'c4d4>c4c5', 'c4d4>d3d4', 'c4d4>d4d5', // pivots
    ].sort());
  });

  it('tramples every enemy on its route and is blocked by friends', () => {
    const st = cav('4k3/8/2pn4/2rb4/8/8/8/4K3 w - - 0 1', ['c4', 'd4']);
    const move = play(st, 'c4d4>c6d6');
    expect(move.captures).toHaveLength(4);
    expect(st.pieces.size).toBe(3);

    const blocked = cav('4k3/8/8/8/2P5/8/8/4K3 w - - 0 1', ['c2', 'd2']);
    const keys = keysFor(blocked, 'c2');
    expect(keys).toContain('c2d2>c3d3');
    expect(keys).not.toContain('c2d2>c4d4');
  });

  it('is captured whole when either square is taken', () => {
    const st = cav('4k3/8/8/8/8/1p6/8/4K3 b - - 0 1', ['a2', 'b2']);
    play(st, 'b3a2');
    expect([...st.pieces.values()].some((p) => p.type === 'C')).toBe(false);
    expect(st.board[P('b2')]).toBe(-1);
  });

  it('checks a king anywhere on its route — enemies cannot block it', () => {
    const st = cav('7k/6pp/8/8/8/8/8/K7 b - - 0 1', ['e6', 'f6']);
    // e8+f8 sliding right 2 sweeps g8 and h8 — so the king on h8 is in check
    const st2 = cav('7k/6pp/8/8/8/8/8/K7 b - - 0 1', ['e8', 'f8']);
    expect(inCheck(st, 'b')).toBe(false);
    expect(inCheck(st2, 'b')).toBe(true);
    expect(isCheckmate(st2)).toBe(true);
    // a black piece on g8 doesn't block — it would be trampled too
    const st3 = cav('6nk/6pp/8/8/8/8/8/K7 b - - 0 1', ['e8', 'f8']);
    expect(inCheck(st3, 'b')).toBe(true);
  });

  it('pivots between horizontal and vertical', () => {
    const st = cav('4k3/8/8/8/8/8/8/4K3 w - - 0 1', ['a1', 'b1']);
    play(st, 'a1b1>a1a2');
    play(st, 'e8d8');
    const keys = keysFor(st, 'a1');
    expect(keys).toContain('a1a2>a3a4'); // vertical slide 2 up
    expect(keys).toContain('a1a2>b1b2'); // sideways
    expect(keys).toContain('a1a2>a1b1'); // pivot back
  });

  it('cavalry loadout has no castling and plays legally', () => {
    const st = startingPosition('cavalry', 'standard');
    expect(st.castling & 3).toBe(0);
    expect(perft(st, 3)).toBeGreaterThan(5000);
    const before = JSON.stringify([...st.board]);
    perft(st, 3);
    expect(JSON.stringify([...st.board])).toBe(before);
  });
});
