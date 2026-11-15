import type { GameState } from '../engine/state';
import type { Color, Move, PieceType } from '../engine/types';
import { opposite } from '../engine/types';
import { legalMoves, inCheck } from '../engine/movegen';
import { describeMove, findMove } from '../engine/position';
import { adjudicate, hasMatingMaterial, positionKey, type GameResult } from '../engine/rules';
import { startingPosition, type LoadoutId } from '../engine/loadouts';
import { DIFFICULTIES, type Difficulty } from '../ai/difficulty';
import type { AIRequest } from '../ai/worker';
import { ChessClock } from './clock';
import { premoveCandidates, resolvePremove } from '../engine/premove';
import { materialBalance } from './material';

export interface MatchConfig {
  playerColor: Color;
  difficulty: Difficulty;
  playerLoadout: LoadoutId;
  aiLoadout: LoadoutId;
  timeMs: number;
}

export interface MoveRecord {
  color: Color;
  label: string;
  move: Move;
}

export interface MoveProvider {
  requestMove(st: GameState, options: AIRequest['options']): Promise<{ moveKey: string | null }>;
  cancelAll(): void;
}

/** Runs one timed game between the player and the AI. */
export class Match {
  readonly state: GameState;
  readonly clock: ChessClock;
  readonly records: MoveRecord[] = [];
  /** Piece types captured BY each color. */
  readonly captured: Record<Color, PieceType[]> = { w: [], b: [] };
  result: GameResult | null = null;
  aiThinking = false;
  /** A move queued during the AI's turn; played the moment the AI replies if still legal. */
  premove: Move | null = null;
  private readonly reps = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private legalCache: { ply: number; moves: Move[] } | null = null;
  private premoveCache: { ply: number; moves: Move[] } | null = null;
  /** White's material balance at the start — armies can differ, so leads are measured from here. */
  private readonly startBalance: number;
  private disposed = false;

  constructor(
    readonly config: MatchConfig,
    private readonly ai: MoveProvider,
    private readonly now: () => number = () => performance.now(),
  ) {
    const white = config.playerColor === 'w' ? config.playerLoadout : config.aiLoadout;
    const black = config.playerColor === 'b' ? config.playerLoadout : config.aiLoadout;
    this.state = startingPosition(white, black);
    this.clock = new ChessClock(config.timeMs, now);
    this.reps.set(positionKey(this.state), 1);
    this.startBalance = materialBalance(this.state, 'w');
  }

  /** Moves the player may queue right now (only during the AI's turn). */
  get premoveCandidates(): Move[] {
    if (this.result || this.isPlayerTurn) return [];
    if (!this.premoveCache || this.premoveCache.ply !== this.state.ply) {
      this.premoveCache = { ply: this.state.ply, moves: premoveCandidates(this.state, this.config.playerColor) };
    }
    return this.premoveCache.moves;
  }

  setPremove(move: Move | null): void {
    if (move && (this.result || this.isPlayerTurn)) return;
    this.premove = move;
    this.emit();
  }

  /** Material lead in points for `color`, relative to the starting armies (negative = behind). */
  materialLead(color: Color): number {
    const lead = materialBalance(this.state, 'w') - this.startBalance;
    return color === 'w' ? lead : 0 - lead;
  }

  get aiColor(): Color {
    return opposite(this.config.playerColor);
  }

  get isPlayerTurn(): boolean {
    return !this.result && this.state.turn === this.config.playerColor;
  }

  get legal(): Move[] {
    if (!this.legalCache || this.legalCache.ply !== this.state.ply) {
      this.legalCache = { ply: this.state.ply, moves: legalMoves(this.state) };
    }
    return this.legalCache.moves;
  }

  get lastMove(): Move | undefined {
    return this.state.lastMove;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  start(): void {
    this.clock.start('w');
    this.emit();
    if (this.state.turn === this.aiColor) void this.aiTurn();
  }

  playerMove(move: Move): boolean {
    if (!this.isPlayerTurn || !this.legal.includes(move)) return false;
    this.apply(move);
    if (!this.result) void this.aiTurn();
    return true;
  }

  resign(): void {
    if (this.result) return;
    this.finish({ winner: this.aiColor, reason: 'resignation' });
  }

  /** Call regularly (e.g. every animation frame) to detect a flag fall. */
  update(): void {
    if (this.result) return;
    const flag = this.clock.flagged();
    if (!flag) return;
    const other = opposite(flag);
    this.finish(hasMatingMaterial(this.state, other)
      ? { winner: other, reason: 'timeout' }
      : { winner: null, reason: 'timeout' });
  }

  dispose(): void {
    this.disposed = true;
    this.clock.stop();
    this.ai.cancelAll();
    this.listeners.clear();
  }

  private apply(move: Move): void {
    const mover = this.state.turn;
    const label = describeMove(this.state, move);
    for (const id of move.captures) this.captured[mover].push(this.state.pieces.get(id)!.type);
    this.state.makeMove(move);
    const key = positionKey(this.state);
    const count = (this.reps.get(key) ?? 0) + 1;
    this.reps.set(key, count);
    const result = adjudicate(this.state, count);
    const suffix = result?.reason === 'checkmate' ? '#' : inCheck(this.state, this.state.turn) ? '+' : '';
    this.records.push({ color: mover, label: label + suffix, move });
    if (result) this.finish(result);
    else this.clock.switchTo(this.state.turn);
    this.emit();
  }

  private finish(result: GameResult): void {
    this.result = result;
    this.premove = null;
    this.aiThinking = false;
    this.clock.stop();
    this.ai.cancelAll();
    this.emit();
  }

  private async aiTurn(): Promise<void> {
    const diff = DIFFICULTIES[this.config.difficulty];
    const budget = Math.max(150, Math.min(diff.search.timeMs, this.clock.remaining[this.aiColor] / 25));
    const started = this.now();
    const ply = this.state.ply;
    this.aiThinking = true;
    this.emit();
    const res = await this.ai.requestMove(this.state, { ...diff.search, timeMs: budget });
    // Small pause so instant replies don't feel robotic.
    const wait = 450 - (this.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (this.disposed || this.result || this.state.ply !== ply) return;
    this.aiThinking = false;
    const move = res.moveKey ? findMove(this.legal, res.moveKey) : undefined;
    if (move) this.apply(move);
    else this.emit();
    this.playPremove();
  }

  private playPremove(): void {
    const queued = this.premove;
    if (!queued || this.result || !this.isPlayerTurn) return;
    this.premove = null;
    const move = resolvePremove(queued, this.legal);
    if (move) this.playerMove(move);
    else this.emit();
  }
}
