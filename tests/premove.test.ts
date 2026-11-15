import { describe, expect, it } from 'vitest';
import { fromFEN, moveKey } from '../src/engine/position';
import { premoveCandidates, resolvePremove, intentKey } from '../src/engine/premove';
import { legalMoves } from '../src/engine/movegen';
import { Match, type MoveProvider } from '../src/game/match';
import { startingPosition } from '../src/engine/loadouts';
import { parseSquare as P } from '../src/engine/square';
import type { GameState } from '../src/engine/state';

const dests = (moves: ReturnType<typeof premoveCandidates>, from: string) =>
  moves.filter((m) => m.from.includes(P(from))).map(moveKey).sort();

describe('premove candidates', () => {
  it('ignore blockers, allow pawn diagonals and castling', () => {
    const st = startingPosition('standard', 'standard');
    st.turn = 'b'; // white premoves during black's turn
    const c = premoveCandidates(st, 'w');
    expect(dests(c, 'a1')).toContain('a1a8');       // rook through its own pawn
    expect(dests(c, 'e2')).toEqual(['e2d3', 'e2e3', 'e2e4', 'e2f3']);
    expect(dests(c, 'e1')).toContain('e1g1');       // castling intent
    expect(dests(c, 'b1')).toContain('b1c3');
  });

  it('cover Marshal range and Cavalry routes', () => {
    const st = startingPosition('cavalry', 'marshal');
    const w = premoveCandidates(st, 'w');
    expect(dests(w, 'a1')).toContain('a1b1>a3b3');
    st.turn = 'w';
    const b = premoveCandidates(st, 'b');
    expect(dests(b, 'b8')).toContain('b8e5');       // marshal long move, 3 squares
    expect(dests(b, 'b8')).not.toContain('b8f4');
  });

  it('resolve to the matching legal move, or nothing', () => {
    const st = fromFEN('4k3/8/8/8/8/8/4P3/4K3 b - - 0 1');
    const queued = premoveCandidates(st, 'w').find((m) => moveKey(m) === 'e2e4')!;
    st.makeMove(legalMoves(st).find((m) => moveKey(m) === 'e8d8')!);
    expect(moveKey(resolvePremove(queued, legalMoves(st))!)).toBe('e2e4');
    const blocked = fromFEN('4k3/8/8/8/4p3/8/4P3/4K3 w - - 0 1');
    expect(resolvePremove(queued, legalMoves(blocked))).toBeUndefined();
    expect(intentKey(queued)).toContain(':');
  });
});

/** AI stub: replies with a given list of moves, in order. */
function scriptedAI(keys: string[]): MoveProvider {
  return {
    requestMove: async (_st: GameState) => ({ moveKey: keys.shift() ?? null }),
    cancelAll: () => {},
  };
}

const settle = () => new Promise((r) => setTimeout(r, 600));

describe('match premoves and material', () => {
  it('plays a queued premove as soon as the AI replies', async () => {
    const m = new Match({ playerColor: 'w', difficulty: 'rookie', playerLoadout: 'standard', aiLoadout: 'standard', timeMs: 60_000 },
      scriptedAI(['e7e5', 'b8c6']));
    m.start();
    m.playerMove(m.legal.find((x) => moveKey(x) === 'e2e4')!);
    expect(m.isPlayerTurn).toBe(false);
    m.setPremove(m.premoveCandidates.find((x) => moveKey(x) === 'g1f3')!);
    await settle();
    expect(m.records.map((r) => r.label)).toEqual(['e2-e4', 'e7-e5', 'Ng1-f3']);
    expect(m.premove).toBeNull();
    await settle();
    expect(m.records).toHaveLength(4);
    m.dispose();
  });

  it('drops a premove that became illegal', async () => {
    const m = new Match({ playerColor: 'w', difficulty: 'rookie', playerLoadout: 'standard', aiLoadout: 'standard', timeMs: 60_000 },
      scriptedAI(['e7e5']));
    m.start();
    m.playerMove(m.legal.find((x) => moveKey(x) === 'e2e4')!);
    m.setPremove(m.premoveCandidates.find((x) => moveKey(x) === 'e4e5')!); // blocked by ...e5
    await settle();
    expect(m.records).toHaveLength(2);
    expect(m.premove).toBeNull();
    expect(m.isPlayerTurn).toBe(true);
    m.dispose();
  });

  it('measures material lead from the starting armies', () => {
    const m = new Match({ playerColor: 'w', difficulty: 'rookie', playerLoadout: 'cavalry', aiLoadout: 'standard', timeMs: 60_000 },
      scriptedAI([]));
    expect(m.materialLead('w')).toBe(0);
    expect(m.materialLead('b')).toBe(0);
    m.dispose();
  });
});
