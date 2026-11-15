import { newProgress, xpForLevel, type Progress } from './progression';
import { LOADOUTS } from '../engine/loadouts';

export const SAVE_KEY = 'noir-chess.save';
/** Separate profile used by dev mode so play-testing never touches real progress. */
export const DEV_SAVE_KEY = 'noir-chess.save.dev';
const DEV_FLAG_KEY = 'noir-chess.devmode';

/** Level the dev profile is kept at — high enough to unlock every piece. */
export const DEV_LEVEL = 10;

function read(key: string): Progress | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Progress>;
    if (data.version !== 1) return null;
    const base = newProgress();
    return {
      ...base,
      ...data,
      xp: Math.max(0, Number(data.xp) || 0),
      solvedPuzzles: Array.isArray(data.solvedPuzzles) ? data.solvedPuzzles : [],
      loadout: data.loadout && data.loadout in LOADOUTS ? data.loadout : 'standard',
      sound: data.sound !== false,
      stats: { ...base.stats, ...data.stats },
    };
  } catch {
    return null;
  }
}

/** Loads progress (the dev profile when `dev`); falls back to a fresh save if storage is blocked or bad. */
export function loadProgress(dev = false): Progress {
  if (!dev) return read(SAVE_KEY) ?? newProgress();
  const p = read(DEV_SAVE_KEY) ?? newProgress();
  p.xp = Math.max(p.xp, xpForLevel(DEV_LEVEL));
  return p;
}

export function saveProgress(p: Progress, dev = false): void {
  try {
    localStorage.setItem(dev ? DEV_SAVE_KEY : SAVE_KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable (private mode etc.) — progress lasts for this session only.
  }
}

export function loadDevFlag(): boolean {
  try {
    return localStorage.getItem(DEV_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveDevFlag(on: boolean): void {
  try {
    if (on) localStorage.setItem(DEV_FLAG_KEY, '1');
    else localStorage.removeItem(DEV_FLAG_KEY);
  } catch {
    // ignore
  }
}
