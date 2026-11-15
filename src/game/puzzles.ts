import type { GameState } from '../engine/state';
import type { Color, Move, PieceType } from '../engine/types';
import { opposite } from '../engine/types';
import { legalMoves } from '../engine/movegen';
import { findMove, fromFEN, moveKey, type PieceSpec } from '../engine/position';
import { isCheckmate } from '../engine/rules';
import { bestDefence, defenderLoses, findMatingMove } from '../engine/mate';

export interface PuzzleDef {
  id: string;
  title: string;
  brief: string;
  /** 'mate': deliver checkmate within `moves`. 'material': follow the winning line. */
  goal: 'mate' | 'material';
  /** Number of the player's own moves. */
  moves: number;
  fen: string;
  extra?: PieceSpec[];
  /** Player and opponent moves alternating, starting with the player (move keys). */
  solution: string[];
  /** Custom piece this case showcases. */
  featured?: PieceType;
}

export type PuzzleFeedback = 'continue' | 'solved' | 'wrong';

export class PuzzleSession {
  state: GameState;
  readonly playerColor: Color;
  status: 'playing' | 'solved' = 'playing';
  mistakes = 0;
  /** Index into `solution` of the player's next move. */
  private step = 0;
  /** Still following the scripted line exactly. */
  private onScript = true;

  constructor(readonly def: PuzzleDef) {
    this.state = fromFEN(def.fen, def.extra);
    this.playerColor = this.state.turn;
  }

  get movesLeft(): number {
    return this.def.moves - this.step / 2;
  }

  private legalCache: { state: GameState; ply: number; moves: Move[] } | null = null;

  /** Player's legal moves (cached per position — the board asks for these on every redraw). */
  get legal(): Move[] {
    if (this.status !== 'playing' || this.state.turn !== this.playerColor) return [];
    const c = this.legalCache;
    if (!c || c.state !== this.state || c.ply !== this.state.ply) {
      this.legalCache = { state: this.state, ply: this.state.ply, moves: legalMoves(this.state) };
    }
    return this.legalCache!.moves;
  }

  reset(): void {
    this.state = fromFEN(this.def.fen, this.def.extra);
    this.status = 'playing';
    this.step = 0;
    this.onScript = true;
  }

  /** Try the player's move. Wrong moves are not kept on the board. */
  playerMove(move: Move): PuzzleFeedback {
    if (this.status !== 'playing') return 'wrong';
    const key = moveKey(move);
    const scripted = this.def.solution[this.step];
    const left = this.movesLeft;
    this.state.makeMove(move);

    let ok: boolean;
    if (this.def.goal === 'mate') {
      ok = isCheckmate(this.state) || (left > 1 && defenderLoses(this.state, left - 1));
    } else {
      ok = this.onScript && key === scripted;
    }
    if (!ok) {
      this.state.undoMove();
      this.mistakes++;
      return 'wrong';
    }
    if (key !== scripted) this.onScript = false;
    this.step += 1;
    if (isCheckmate(this.state) || this.step >= this.def.solution.length) {
      this.status = 'solved';
      return 'solved';
    }
    return 'continue';
  }

  /** Play the opponent's answer (scripted when possible). */
  opponentReply(): Move | null {
    if (this.status !== 'playing' || this.state.turn === this.playerColor) return null;
    const legal = legalMoves(this.state);
    let reply = this.onScript ? findMove(legal, this.def.solution[this.step]) : undefined;
    if (!reply) {
      this.onScript = false;
      reply = (this.def.goal === 'mate' ? bestDefence(this.state, this.movesLeft) : null) ?? legal[0];
    }
    if (!reply) return null;
    this.state.makeMove(reply);
    this.step += 1;
    return reply;
  }

  /** A correct move for the current position. */
  hint(): Move | null {
    if (this.status !== 'playing' || this.state.turn !== this.playerColor) return null;
    const legal = legalMoves(this.state);
    if (this.onScript) {
      const m = findMove(legal, this.def.solution[this.step]);
      if (m) return m;
    }
    return this.def.goal === 'mate' ? findMatingMove(this.state, this.movesLeft) : null;
  }

  get opponentColor(): Color {
    return opposite(this.playerColor);
  }
}
