import type { SearchOptions } from './search';

export type Difficulty = 'rookie' | 'detective' | 'inspector';

export interface DifficultyInfo {
  id: Difficulty;
  name: string;
  blurb: string;
  xpMultiplier: number;
  search: Pick<SearchOptions, 'maxDepth' | 'timeMs' | 'noise'>;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyInfo> = {
  rookie: {
    id: 'rookie', name: 'Rookie', blurb: 'A street-corner hustler. Makes mistakes.',
    xpMultiplier: 1, search: { maxDepth: 2, timeMs: 500, noise: 90 },
  },
  detective: {
    id: 'detective', name: 'Detective', blurb: 'Sharp eyes. Rarely misses a hanging piece.',
    xpMultiplier: 1.5, search: { maxDepth: 3, timeMs: 1500, noise: 25 },
  },
  inspector: {
    id: 'inspector', name: 'Inspector', blurb: 'Cold, calculating, relentless.',
    xpMultiplier: 2, search: { maxDepth: 8, timeMs: 3500, noise: 0 },
  },
};
