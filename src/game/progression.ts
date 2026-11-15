import type { Difficulty } from '../ai/difficulty';
import { DIFFICULTIES } from '../ai/difficulty';
import type { LoadoutId } from '../engine/loadouts';
import { LOADOUTS } from '../engine/loadouts';
import type { PieceType } from '../engine/types';

export interface Progress {
  version: 1;
  xp: number;
  solvedPuzzles: string[];
  loadout: LoadoutId;
  /** Sound effects on/off. */
  sound: boolean;
  stats: { wins: number; losses: number; draws: number };
}

export const newProgress = (): Progress => ({
  version: 1, xp: 0, solvedPuzzles: [], loadout: 'standard', sound: true, stats: { wins: 0, losses: 0, draws: 0 },
});

export interface Unlock {
  level: number;
  piece: PieceType;
  loadout: LoadoutId;
}

export const UNLOCKS: Unlock[] = [
  { level: 3, piece: 'M', loadout: 'marshal' },
  { level: 5, piece: 'C', loadout: 'cavalry' },
];

/** XP needed to go from level n to n+1. */
export const xpToNext = (level: number): number => 150 * level;

/** Total XP required to reach `level` (level 1 = 0 XP). */
export const xpForLevel = (level: number): number => 75 * level * (level - 1);

export function levelInfo(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return { level, into: xp - xpForLevel(level), needed: xpToNext(level) };
}

export function unlockedPieces(xp: number): PieceType[] {
  const { level } = levelInfo(xp);
  return UNLOCKS.filter((u) => level >= u.level).map((u) => u.piece);
}

export function availableLoadouts(xp: number): LoadoutId[] {
  const pieces = unlockedPieces(xp);
  return (Object.keys(LOADOUTS) as LoadoutId[]).filter((id) => {
    const req = LOADOUTS[id].requires;
    return !req || pieces.includes(req);
  });
}

export type Outcome = 'win' | 'draw' | 'loss';

export function xpForGame(outcome: Outcome, difficulty: Difficulty): number {
  if (outcome === 'win') return Math.round(100 * DIFFICULTIES[difficulty].xpMultiplier);
  return outcome === 'draw' ? 40 : 10;
}

export const xpForPuzzle = (firstSolve: boolean): number => (firstSolve ? 50 : 10);

export interface XpAward {
  gained: number;
  before: number;
  after: number;
  levelBefore: number;
  levelAfter: number;
  newUnlocks: Unlock[];
}

export function awardXp(progress: Progress, amount: number): XpAward {
  const before = progress.xp;
  const levelBefore = levelInfo(before).level;
  progress.xp += amount;
  const levelAfter = levelInfo(progress.xp).level;
  return {
    gained: amount, before, after: progress.xp, levelBefore, levelAfter,
    newUnlocks: UNLOCKS.filter((u) => u.level > levelBefore && u.level <= levelAfter),
  };
}
