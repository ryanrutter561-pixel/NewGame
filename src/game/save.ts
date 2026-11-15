import { newProgress, type Progress } from './progression';
import { LOADOUTS } from '../engine/loadouts';

export const SAVE_KEY = 'noir-chess.save';

/** Loads progress; falls back to a fresh save if storage is blocked or the data is bad. */
export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return newProgress();
    const data = JSON.parse(raw) as Partial<Progress>;
    if (data.version !== 1) return newProgress();
    const base = newProgress();
    return {
      ...base,
      ...data,
      xp: Math.max(0, Number(data.xp) || 0),
      solvedPuzzles: Array.isArray(data.solvedPuzzles) ? data.solvedPuzzles : [],
      loadout: data.loadout && data.loadout in LOADOUTS ? data.loadout : 'standard',
      sound: data.sound !== false,
      evalBar: data.evalBar !== false,
      stats: { ...base.stats, ...data.stats },
    };
  } catch {
    return newProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable (private mode etc.) — progress lasts for this session only.
  }
}
