import { describe, expect, it } from 'vitest';
import { awardXp, availableLoadouts, levelInfo, newProgress, xpForGame, xpForLevel } from '../src/game/progression';
import { ChessClock, formatClock } from '../src/game/clock';

describe('progression', () => {
  it('levels follow 150·n XP per level', () => {
    expect(levelInfo(0)).toEqual({ level: 1, into: 0, needed: 150 });
    expect(levelInfo(149).level).toBe(1);
    expect(levelInfo(150).level).toBe(2);
    expect(xpForLevel(3)).toBe(450);
    expect(xpForLevel(5)).toBe(1500);
    expect(levelInfo(1500).level).toBe(5);
  });

  it('awards XP by outcome and difficulty', () => {
    expect(xpForGame('win', 'rookie')).toBe(100);
    expect(xpForGame('win', 'detective')).toBe(150);
    expect(xpForGame('win', 'inspector')).toBe(200);
    expect(xpForGame('draw', 'inspector')).toBe(40);
    expect(xpForGame('loss', 'rookie')).toBe(10);
  });

  it('unlocks the Marshal at level 3 and the Cavalry at level 5', () => {
    expect(availableLoadouts(0)).toEqual(['standard']);
    expect(availableLoadouts(450)).toEqual(['standard', 'marshal']);
    expect(availableLoadouts(1500)).toEqual(['standard', 'marshal', 'cavalry']);
    const p = newProgress();
    p.xp = 400;
    const award = awardXp(p, 1200);
    expect(award.levelBefore).toBe(2);
    expect(award.levelAfter).toBe(5);
    expect(award.newUnlocks.map((u) => u.piece)).toEqual(['M', 'C']);
  });
});

describe('clock', () => {
  it('charges time to the side to move and flags at zero', () => {
    let t = 0;
    const c = new ChessClock(1000, () => t);
    c.start('w');
    t = 400;
    c.switchTo('b');
    expect(c.remaining.w).toBe(600);
    t = 1500;
    expect(c.flagged()).toBe('b');
    expect(formatClock(300_000)).toBe('5:00');
    expect(formatClock(5_250)).toBe('0:05.3');
  });
});
