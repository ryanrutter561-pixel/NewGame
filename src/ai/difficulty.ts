import type { SearchOptions } from './search';

export type Difficulty = 'rookie' | 'detective' | 'inspector';

export interface DifficultyInfo {
  id: Difficulty;
  name: string;
  blurb: string;
  xpMultiplier: number;
  search: Pick<SearchOptions, 'maxDepth' | 'timeMs' | 'noise' | 'randomMove'>;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyInfo> = {
  rookie: {
    // A first opponent: mostly random moves, hangs pieces, rarely punishes mistakes.
    id: 'rookie', name: 'Rookie', blurb: 'Fresh off the bus. Barely knows how the pieces move.',
    xpMultiplier: 1, search: { maxDepth: 1, timeMs: 300, noise: 150, randomMove: 0.7 },
  },
  detective: {
    id: 'detective', name: 'Detective', blurb: 'A street-corner hustler. Sees the obvious, misses the rest.',
    xpMultiplier: 1.5, search: { maxDepth: 2, timeMs: 500, noise: 90 },
  },
  inspector: {
    id: 'inspector', name: 'Inspector', blurb: 'Sharp eyes. Rarely misses a hanging piece.',
    xpMultiplier: 2, search: { maxDepth: 4, timeMs: 1500, noise: 15 },
  },
};
