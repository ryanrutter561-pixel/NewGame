import type { PieceType } from '../types';
import type { PieceDef } from './common';
import { Bishop, King, Knight, Pawn, Queen, Rook } from './standard';
import { Marshal } from './marshal';
import { Cavalry } from './cavalry';

export type { PieceDef } from './common';

export const PIECES: Record<PieceType, PieceDef> = {
  K: King, Q: Queen, R: Rook, B: Bishop, N: Knight, P: Pawn, M: Marshal, C: Cavalry,
};

export const pieceDef = (type: PieceType): PieceDef => PIECES[type];
