import type { Color } from '../engine/types';

/** Simple sudden-death chess clock (no increment). */
export class ChessClock {
  readonly remaining: Record<Color, number>;
  active: Color | null = null;
  private last = 0;

  constructor(ms: number, private readonly now: () => number = () => performance.now()) {
    this.remaining = { w: ms, b: ms };
  }

  start(color: Color): void {
    this.active = color;
    this.last = this.now();
  }

  /** Charge elapsed time to the running side. */
  tick(): void {
    if (!this.active) return;
    const t = this.now();
    this.remaining[this.active] = Math.max(0, this.remaining[this.active] - (t - this.last));
    this.last = t;
  }

  switchTo(color: Color): void {
    this.tick();
    this.start(color);
  }

  stop(): void {
    this.tick();
    this.active = null;
  }

  flagged(): Color | null {
    this.tick();
    if (this.remaining.w <= 0) return 'w';
    if (this.remaining.b <= 0) return 'b';
    return null;
  }
}

export function formatClock(ms: number): string {
  const total = Math.max(0, ms);
  if (total < 10_000) return `0:0${(total / 1000).toFixed(1)}`;
  const s = Math.ceil(total / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
