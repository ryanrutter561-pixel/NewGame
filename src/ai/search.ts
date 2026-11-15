import type { GameState } from '../engine/state';
import type { Move } from '../engine/types';
import { inCheck, legalMoves, pseudoLegalMoves } from '../engine/movegen';
import { PIECES } from '../engine/pieces/registry';
import { evaluate } from './evaluate';

export const MATE = 100_000;
const INF = 1_000_000;
const MAX_PLY = 64;

export interface SearchOptions {
  maxDepth: number;
  timeMs: number;
  /** Random centipawn jitter added to evaluations — makes weaker levels err. */
  noise?: number;
  /** Chance (0..1) of skipping the search and playing a random legal move — for beginner levels. */
  randomMove?: number;
  random?: () => number;
  now?: () => number;
}

export interface SearchResult {
  move: Move | null;
  score: number;
  depth: number;
  nodes: number;
}

class Searcher {
  nodes = 0;
  stopped = false;
  private readonly deadline: number;
  private readonly killers: (Move | null)[][] = Array.from({ length: MAX_PLY + 1 }, () => [null, null]);
  private readonly now: () => number;
  private readonly rand: () => number;

  constructor(private readonly st: GameState, private readonly opts: SearchOptions) {
    this.now = opts.now ?? (() => performance.now());
    this.rand = opts.random ?? Math.random;
    this.deadline = this.now() + opts.timeMs;
  }

  private eval(): number {
    const noise = this.opts.noise ?? 0;
    return evaluate(this.st) + (noise ? Math.round((this.rand() * 2 - 1) * noise) : 0);
  }

  private tick(): void {
    if ((++this.nodes & 1023) === 0 && this.now() > this.deadline) this.stopped = true;
  }

  private moveScore(m: Move, ply: number): number {
    let s = 0;
    if (m.captures.length) {
      let gain = 0;
      for (const id of m.captures) gain += PIECES[this.st.pieces.get(id)!.type].value;
      s += 100_000 + gain * 10 - PIECES[this.st.pieces.get(m.pieceId)!.type].value / 10;
    }
    if (m.promotion) s += 90_000 + PIECES[m.promotion].value;
    const k = this.killers[ply];
    if (k && (sameMove(k[0], m) || sameMove(k[1], m))) s += 50_000;
    return s;
  }

  private order(moves: Move[], ply: number, first?: Move | null): Move[] {
    const scored = moves.map((m) => ({ m, s: sameMove(first ?? null, m) ? 1e9 : this.moveScore(m, ply) }));
    scored.sort((a, b) => b.s - a.s);
    return scored.map((x) => x.m);
  }

  run(): SearchResult {
    const root = legalMoves(this.st);
    if (root.length === 0) return { move: null, score: 0, depth: 0, nodes: 0 };
    let best: Move = root[0];
    let bestScore = -INF;
    let depthDone = 0;
    if (root.length === 1) return { move: best, score: 0, depth: 0, nodes: 0 };
    if (this.opts.randomMove && this.rand() < this.opts.randomMove) {
      return { move: root[Math.floor(this.rand() * root.length)], score: 0, depth: 0, nodes: 0 };
    }

    for (let depth = 1; depth <= this.opts.maxDepth; depth++) {
      let alpha = -INF;
      let iterBest: Move | null = null;
      for (const m of this.order(root, 0, best)) {
        this.st.makeMove(m);
        const score = -this.negamax(depth - 1, -INF, -alpha, 1);
        this.st.undoMove();
        if (this.stopped) break;
        if (score > alpha) { alpha = score; iterBest = m; }
      }
      if (iterBest) { best = iterBest; bestScore = alpha; }
      if (this.stopped) break;
      depthDone = depth;
      if (Math.abs(bestScore) > MATE - 1000) break;
    }
    return { move: best, score: bestScore, depth: depthDone, nodes: this.nodes };
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number): number {
    this.tick();
    if (this.stopped) return 0;
    const side = this.st.turn;
    const checked = inCheck(this.st, side);
    if (checked && ply < MAX_PLY / 2) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply, 0);
    if (this.st.halfmove >= 100) return 0;

    let legal = 0;
    for (const m of this.order(pseudoLegalMoves(this.st, side), ply)) {
      this.st.makeMove(m);
      if (inCheck(this.st, side)) { this.st.undoMove(); continue; }
      legal++;
      const score = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      this.st.undoMove();
      if (this.stopped) return 0;
      if (score >= beta) {
        if (!m.captures.length) {
          const k = this.killers[ply];
          if (!sameMove(k[0], m)) { k[1] = k[0]; k[0] = m; }
        }
        return beta;
      }
      if (score > alpha) alpha = score;
    }
    if (legal === 0) return checked ? -MATE + ply : 0;
    return alpha;
  }

  private quiesce(alpha: number, beta: number, ply: number, qdepth: number): number {
    this.tick();
    if (this.stopped) return 0;
    const stand = this.eval();
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (qdepth >= 8 || ply >= MAX_PLY) return alpha;
    const side = this.st.turn;
    const tactical = pseudoLegalMoves(this.st, side).filter((m) => m.captures.length || m.promotion === 'Q');
    for (const m of this.order(tactical, ply)) {
      this.st.makeMove(m);
      if (inCheck(this.st, side)) { this.st.undoMove(); continue; }
      const score = -this.quiesce(-beta, -alpha, ply + 1, qdepth + 1);
      this.st.undoMove();
      if (this.stopped) return 0;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }
}

function sameMove(a: Move | null, b: Move): boolean {
  return !!a && a.pieceId === b.pieceId && a.to.length === b.to.length &&
    a.to.every((s, i) => s === b.to[i]) && a.promotion === b.promotion && a.kind === b.kind;
}

export function searchBestMove(st: GameState, opts: SearchOptions): SearchResult {
  return new Searcher(st, opts).run();
}
