import { GameState, CASTLE_BK, CASTLE_BQ, CASTLE_WK, CASTLE_WQ } from './state';
import type { Color, PieceType } from './types';
import { sq } from './square';

export type LoadoutId = 'standard' | 'marshal' | 'cavalry';

export interface Loadout {
  id: LoadoutId;
  name: string;
  /** Which custom piece must be unlocked to use this loadout. */
  requires?: PieceType;
  summary: string;
}

export const LOADOUTS: Record<LoadoutId, Loadout> = {
  standard: {
    id: 'standard', name: 'By the Book',
    summary: 'The classic army. Rooks, knights, and the right to castle.',
  },
  marshal: {
    id: 'marshal', name: "Marshal's Office", requires: 'M',
    summary: 'Both knights become Marshals.',
  },
  cavalry: {
    id: 'cavalry', name: 'Cavalry Charge', requires: 'C',
    summary: 'Each rook + knight pair becomes one two-wide Cavalry. No castling.',
  },
};

function placeArmy(st: GameState, color: Color, loadout: LoadoutId): void {
  const back = color === 'w' ? 0 : 7;
  const pawnRank = color === 'w' ? 1 : 6;
  for (let f = 0; f < 8; f++) st.addPiece('P', color, [sq(f, pawnRank)]);
  st.addPiece('B', color, [sq(2, back)]);
  st.addPiece('Q', color, [sq(3, back)]);
  st.addPiece('K', color, [sq(4, back)]);
  st.addPiece('B', color, [sq(5, back)]);
  if (loadout === 'cavalry') {
    st.addPiece('C', color, [sq(0, back), sq(1, back)]);
    st.addPiece('C', color, [sq(6, back), sq(7, back)]);
  } else {
    const knight: PieceType = loadout === 'marshal' ? 'M' : 'N';
    st.addPiece('R', color, [sq(0, back)]);
    st.addPiece(knight, color, [sq(1, back)]);
    st.addPiece(knight, color, [sq(6, back)]);
    st.addPiece('R', color, [sq(7, back)]);
    st.castling |= color === 'w' ? CASTLE_WK | CASTLE_WQ : CASTLE_BK | CASTLE_BQ;
  }
}

export function startingPosition(white: LoadoutId, black: LoadoutId): GameState {
  const st = new GameState();
  placeArmy(st, 'w', white);
  placeArmy(st, 'b', black);
  return st;
}
