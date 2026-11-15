import type { Color, MarshalPhase, PieceType } from '../engine/types';

/** All art is drawn in a 100×100 box. */
const BASE = 'M24 80 H76 L80 90 H20 Z';

interface Art {
  body: Path2D;
  /** Extra detail drawn in the outline color after the body. */
  detail?: (ctx: CanvasRenderingContext2D, ink: string, fill: string) => void;
}

const circle = (cx: number, cy: number, r: number) => {
  const p = new Path2D();
  p.arc(cx, cy, r, 0, Math.PI * 2);
  return p;
};

function combine(...parts: (string | Path2D)[]): Path2D {
  const p = new Path2D();
  for (const part of parts) p.addPath(typeof part === 'string' ? new Path2D(part) : part);
  return p;
}

const KNIGHT_HEAD =
  'M66 78 H32 C32 66 38 58 47 51 C40 54 31 56 25 52 C21 48 23 41 29 37 L43 25 C45 19 49 15 54 13 L56 19 C69 23 77 39 75 56 C74 66 70 72 66 78 Z';

function starPath(cx: number, cy: number, outer: number, inner: number, points: number): Path2D {
  const p = new Path2D();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

let ART: Record<Exclude<PieceType, 'C'>, Art> | null = null;

function art(): Record<Exclude<PieceType, 'C'>, Art> {
  if (ART) return ART;
  const starTips = new Path2D();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    starTips.addPath(circle(50 + Math.cos(a) * 33, 44 + Math.sin(a) * 33, 4));
  }
  ART = {
    P: {
      body: combine(circle(50, 30, 12), 'M41 42 H59 L56 50 C63 57 67 68 68 78 H32 C33 68 37 57 44 50 Z', BASE),
    },
    R: {
      body: combine('M28 18 H37 V26 H45 V18 H55 V26 H63 V18 H72 V34 L65 40 L67 70 L72 78 H28 L33 70 L35 40 L28 34 Z', BASE),
      detail: (ctx, ink) => line(ctx, ink, 2.5, [[35, 40], [65, 40]]),
    },
    B: {
      body: combine(circle(50, 11, 4.5), 'M50 15 C63 24 69 36 64 48 L58 53 L60 70 L67 78 H33 L40 70 L42 53 L36 48 C31 36 37 24 50 15 Z', BASE),
      detail: (ctx, ink) => line(ctx, ink, 3.5, [[56, 27], [46, 40]]),
    },
    N: {
      body: combine(KNIGHT_HEAD, BASE),
      detail: (ctx, ink) => { ctx.fillStyle = ink; ctx.fill(circle(45, 31, 2.8)); },
    },
    Q: {
      body: combine(
        'M22 28 L33 56 L36 22 L44 52 L50 17 L56 52 L64 22 L67 56 L78 28 L70 66 L72 78 H28 L30 66 Z',
        circle(22, 26, 4), circle(36, 20, 4), circle(50, 15, 4), circle(64, 20, 4), circle(78, 26, 4), BASE,
      ),
      detail: (ctx, ink) => line(ctx, ink, 2.5, [[30, 66], [70, 66]]),
    },
    K: {
      body: combine(
        'M46 6 H54 V13 H61 V20 H54 V29 H46 V20 H39 V13 H46 Z',
        'M50 33 C64 29 78 38 75 52 C73 60 69 65 67 69 L69 78 H31 L33 69 C31 65 27 60 25 52 C22 38 36 29 50 33 Z',
        BASE,
      ),
      detail: (ctx, ink) => line(ctx, ink, 2.5, [[33, 69], [67, 69]]),
    },
    M: {
      body: combine(starPath(50, 44, 33, 17, 6), starTips, 'M42 70 H58 L60 80 H40 Z', BASE),
    },
  };
  return ART;
}

function line(ctx: CanvasRenderingContext2D, ink: string, width: number, pts: [number, number][]) {
  ctx.strokeStyle = ink;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

export const PIECE_COLORS: Record<Color, { fill: string; ink: string }> = {
  w: { fill: '#efe8d8', ink: '#141414' },
  b: { fill: '#1c1c1e', ink: '#d6cfbf' },
};

export interface DrawOpts {
  phase?: MarshalPhase;
  alpha?: number;
  shadow?: boolean;
}

/** Shadow offsets ignore the canvas transform, so scale them by hand. `unit` = 1% of a square. */
function applyShadow(ctx: CanvasRenderingContext2D, on: boolean | undefined, unit = 1) {
  if (on === false) return;
  const k = ctx.getTransform().a * unit;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 7 * k;
  ctx.shadowOffsetX = 3 * k;
  ctx.shadowOffsetY = 5 * k;
}

/** Draw a single-square piece with its top-left corner at (x, y). */
export function drawPiece(
  ctx: CanvasRenderingContext2D, type: Exclude<PieceType, 'C'>, color: Color,
  x: number, y: number, size: number, opts: DrawOpts = {},
): void {
  const a = art()[type];
  const { fill, ink } = PIECE_COLORS[color];
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.save();
  applyShadow(ctx, opts.shadow);
  ctx.fillStyle = fill;
  ctx.fill(a.body, 'nonzero');
  ctx.restore();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke(a.body);
  a.detail?.(ctx, ink, fill);
  if (type === 'M') {
    ctx.fillStyle = ink;
    ctx.fill(circle(50, 44, 12));
    ctx.fillStyle = fill;
    ctx.font = 'bold 19px "Special Elite", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.phase === 'short' ? '1' : '3', 50, 45.5);
  }
  ctx.restore();
}

/** Draw a Cavalry occupying the rectangle (x, y, w, h) — two squares side by side or stacked. */
export function drawCavalry(
  ctx: CanvasRenderingContext2D, color: Color, x: number, y: number, w: number, h: number,
  square: number, opts: DrawOpts = {},
): void {
  const { fill, ink } = PIECE_COLORS[color];
  const horizontal = w > h;
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  // Shared saddle-cloth that ties both squares together.
  const inset = square * 0.1;
  ctx.save();
  applyShadow(ctx, opts.shadow, square / 100);
  ctx.fillStyle = fill;
  roundRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, square * 0.18);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1.5, square * 0.03);
  roundRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, square * 0.18);
  ctx.stroke();
  // Inner trim line.
  ctx.setLineDash([square * 0.06, square * 0.05]);
  ctx.lineWidth = Math.max(1, square * 0.015);
  roundRect(ctx, x + inset * 1.8, y + inset * 1.8, w - inset * 3.6, h - inset * 3.6, square * 0.12);
  ctx.stroke();
  ctx.setLineDash([]);
  // A horse head on each square, in the cloth's inverse colors.
  const head = new Path2D(KNIGHT_HEAD);
  const cells = horizontal ? [[x, y], [x + square, y]] : [[x, y], [x, y + square]];
  for (const [cx, cy] of cells) {
    ctx.save();
    ctx.translate(cx + square * 0.14, cy + square * 0.1);
    ctx.scale((square * 0.72) / 100, (square * 0.72) / 100);
    ctx.fillStyle = ink;
    ctx.fill(head);
    ctx.fillStyle = fill;
    ctx.fill(circle(45, 31, 2.8));
    ctx.restore();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A small standalone canvas showing a piece (for menus, captured lists, cards). */
export function pieceIcon(type: PieceType, color: Color, px: number, phase?: MarshalPhase): HTMLCanvasElement {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const c = document.createElement('canvas');
  const wide = type === 'C';
  c.width = Math.round(px * (wide ? 2 : 1) * dpr);
  c.height = Math.round(px * dpr);
  c.style.width = `${px * (wide ? 2 : 1)}px`;
  c.style.height = `${px}px`;
  c.className = 'piece-icon';
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  if (type === 'C') drawCavalry(ctx, color, 0, 0, px * 2, px, px, { shadow: false });
  else drawPiece(ctx, type, color, 0, 0, px, { phase, shadow: false });
  return c;
}
