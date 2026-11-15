import type { PieceType } from '../engine/types';

export interface PieceInfo {
  name: string;
  tagline: string;
  rules: string[];
}

export const PIECE_INFO: Partial<Record<PieceType, PieceInfo>> = {
  M: {
    name: 'The Marshal',
    tagline: 'Long stride, short step. Never the same twice.',
    rules: [
      'Moves like a queen in any straight line, but cannot jump.',
      'Alternates its range each time it moves: up to 3 squares, then exactly 1, then up to 3 again…',
      'Starts on a long (3) move. The number on its badge shows its next range.',
      'Replaces both knights.',
    ],
  },
  C: {
    name: 'The Cavalry',
    tagline: 'Two horses, one charge. They go through, not around.',
    rules: [
      'Occupies two side-by-side squares. Capture either square and the whole piece falls.',
      'Charges up to 2 squares in a straight line (forward, back or sideways), keeping its shape.',
      'Tramples — captures — every enemy on the squares it passes over or lands on. Your own pieces block it.',
      'Or it can pivot: hold one square and swing the other 90°, turning between side-by-side and front-to-back.',
      'Enemies can\'t block its charge, so a king anywhere on its route is in check.',
      'Replaces each rook + knight pair. No castling.',
    ],
  },
};
