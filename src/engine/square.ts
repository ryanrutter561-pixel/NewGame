/** Squares are 0..63, index = rank * 8 + file, a1 = 0, h8 = 63. */
export const fileOf = (sq: number): number => sq & 7;
export const rankOf = (sq: number): number => sq >> 3;
export const sq = (file: number, rank: number): number => rank * 8 + file;
export const onBoard = (file: number, rank: number): boolean =>
  file >= 0 && file < 8 && rank >= 0 && rank < 8;

const FILES = 'abcdefgh';
export const squareName = (s: number): string => FILES[fileOf(s)] + String(rankOf(s) + 1);

export function parseSquare(name: string): number {
  const f = FILES.indexOf(name[0]);
  const r = Number(name[1]) - 1;
  if (name.length !== 2 || f < 0 || !(r >= 0 && r < 8)) throw new Error(`Bad square: ${name}`);
  return sq(f, r);
}

export type Dir = readonly [number, number];
export const ORTHO: readonly Dir[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DIAG: readonly Dir[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
export const ALL_DIRS: readonly Dir[] = [...ORTHO, ...DIAG];
export const KNIGHT_JUMPS: readonly Dir[] = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
