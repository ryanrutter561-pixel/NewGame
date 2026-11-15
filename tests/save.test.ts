import { beforeEach, describe, expect, it } from 'vitest';
import { DEV_LEVEL, loadDevFlag, loadProgress, saveDevFlag, saveProgress } from '../src/game/save';
import { availableLoadouts, levelInfo } from '../src/game/progression';

// Minimal in-memory localStorage for node.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

describe('dev mode profile', () => {
  beforeEach(() => store.clear());

  it('is max level with every loadout unlocked', () => {
    const dev = loadProgress(true);
    expect(levelInfo(dev.xp).level).toBe(DEV_LEVEL);
    expect(availableLoadouts(dev.xp)).toEqual(['standard', 'marshal', 'cavalry']);
  });

  it('never touches the real save', () => {
    const real = loadProgress();
    real.xp = 120;
    real.solvedPuzzles = ['back-room'];
    saveProgress(real);

    const dev = loadProgress(true);
    dev.loadout = 'cavalry';
    dev.stats.wins = 7;
    saveProgress(dev, true);
    saveDevFlag(true);
    expect(loadDevFlag()).toBe(true);

    const back = loadProgress();
    expect(back.xp).toBe(120);
    expect(back.loadout).toBe('standard');
    expect(back.stats.wins).toBe(0);
    expect(loadProgress(true).loadout).toBe('cavalry');
    saveDevFlag(false);
    expect(loadDevFlag()).toBe(false);
  });
});
