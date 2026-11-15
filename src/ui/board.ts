import type { GameState } from '../engine/state';
import type { Color, Move, Piece } from '../engine/types';
import { fileOf, rankOf, sq, squareName } from '../engine/square';
import { inCheck } from '../engine/movegen';
import { drawCavalry, drawPiece, pieceIcon } from './pieceArt';

export interface BoardSource {
  state: GameState;
  /** Color shown at the bottom (always the player). */
  orientation: Color;
  /** Moves the player may make right now (empty when it's not their turn). */
  legal: Move[];
  lastMove?: Move;
  hint?: Move | null;
}

const COLORS = {
  light: '#bdb6a8',
  dark: '#3a3936',
  lastMove: 'rgba(222, 184, 92, 0.32)',
  selected: 'rgba(179, 38, 30, 0.45)',
  target: 'rgba(179, 38, 30, 0.75)',
  hint: 'rgba(222, 184, 92, 0.55)',
  coordLight: '#3a3936',
  coordDark: '#bdb6a8',
};

const ARROWS: Record<string, string> = { '0,1': '↑', '0,-1': '↓', '1,0': '→', '-1,0': '←' };

/** Canvas chessboard with click-to-move input, a Cavalry route chooser and a promotion picker. */
export class BoardView {
  readonly el: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private size = 0;
  /** Cached from the source at the start of each draw / input event. */
  private orientation: Color = 'w';
  private selected: number | null = null;
  private hoverMove: Move | null = null;
  private popup: HTMLDivElement | null = null;
  private flash: { squares: number[]; until: number; color: string } | null = null;
  private readonly resizeObserver: ResizeObserver;
  private raf = 0;

  constructor(private readonly source: () => BoardSource, private readonly onMove: (m: Move) => void) {
    this.el = document.createElement('div');
    this.el.className = 'board';
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Chess board');
    this.el.append(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerleave', () => {
      if (!this.popup) { this.hoverMove = null; this.draw(); }
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.el);
    window.addEventListener('keydown', this.onKey);
    // Redraw once the typewriter font has loaded (coordinates and Marshal pips use it).
    document.fonts?.ready.then(() => this.draw());
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKey);
    cancelAnimationFrame(this.raf);
    this.el.remove();
  }

  /** Forget any selection (call when the position changes from outside). */
  reset(): void {
    this.selected = null;
    this.hoverMove = null;
    this.closePopup();
    this.draw();
  }

  flashSquares(squares: number[], color = 'rgba(179, 38, 30, 0.6)', ms = 650): void {
    this.flash = { squares, until: performance.now() + ms, color };
    const loop = () => {
      this.draw();
      if (this.flash && performance.now() < this.flash.until) this.raf = requestAnimationFrame(loop);
      else { this.flash = null; this.draw(); }
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(loop);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { this.selected = null; this.hoverMove = null; this.closePopup(); this.draw(); }
  };

  private resize(): void {
    const size = Math.floor(this.el.clientWidth);
    if (!size || size === this.size) return;
    this.size = size;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  // ── coordinates ────────────────────────────────────────────────────────────

  private get cell(): number {
    return this.size / 8;
  }

  private squareXY(s: number): [number, number] {
    const flip = this.orientation === 'b';
    const col = flip ? 7 - fileOf(s) : fileOf(s);
    const row = flip ? rankOf(s) : 7 - rankOf(s);
    return [col * this.cell, row * this.cell];
  }

  private pointToSquare(e: PointerEvent): number | null {
    const r = this.canvas.getBoundingClientRect();
    const col = Math.floor(((e.clientX - r.left) / r.width) * 8);
    const row = Math.floor(((e.clientY - r.top) / r.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    this.orientation = this.source().orientation;
    const flip = this.orientation === 'b';
    return flip ? sq(7 - col, row) : sq(col, 7 - row);
  }

  /** Bounding rectangle covering all of a piece's squares. */
  private pieceRect(squares: number[]): [number, number, number, number] {
    const pts = squares.map((s) => this.squareXY(s));
    const x = Math.min(...pts.map((p) => p[0])), y = Math.min(...pts.map((p) => p[1]));
    const x2 = Math.max(...pts.map((p) => p[0])) + this.cell, y2 = Math.max(...pts.map((p) => p[1])) + this.cell;
    return [x, y, x2 - x, y2 - y];
  }

  // ── input ──────────────────────────────────────────────────────────────────

  /** Squares the player can click to choose this move. */
  private clickSquares(m: Move): number[] {
    if (m.from.length > 1) return m.to.filter((s) => !m.from.includes(s));
    if (m.kind === 'castle' && m.rook) return [m.to[0], m.rook.from];
    return [m.to[0]];
  }

  private selectedMoves(): Move[] {
    if (this.selected === null) return [];
    return this.source().legal.filter((m) => m.pieceId === this.selected);
  }

  private onPointerDown(e: PointerEvent): void {
    e.preventDefault();
    if (this.popup) { this.closePopup(); this.draw(); return; }
    const s = this.pointToSquare(e);
    if (s === null) return;
    const src = this.source();
    const candidates = this.selectedMoves().filter((m) => this.clickSquares(m).includes(s));
    if (candidates.length) { this.resolve(candidates, s); return; }

    const p = src.state.pieceAt(s);
    const movable = p && src.legal.some((m) => m.pieceId === p.id);
    this.selected = movable && this.selected !== p.id ? p.id : null;
    this.hoverMove = null;
    this.draw();
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.popup || this.selected === null) return;
    const piece = this.source().state.pieces.get(this.selected);
    if (!piece || piece.type !== 'C') return;
    const s = this.pointToSquare(e);
    const m = s === null ? null : this.selectedMoves().find((x) => this.clickSquares(x).includes(s)) ?? null;
    if (m !== this.hoverMove) { this.hoverMove = m; this.draw(); }
  }

  private commit(m: Move): void {
    this.selected = null;
    this.hoverMove = null;
    this.closePopup();
    this.onMove(m);
    this.draw();
  }

  private resolve(candidates: Move[], s: number): void {
    if (candidates.length === 1) { this.commit(candidates[0]); return; }
    if (candidates.every((m) => m.promotion)) { this.openPromotion(candidates, s); return; }
    this.openRouteChooser(candidates, s);
  }

  private openPopup(s: number, title: string): HTMLDivElement {
    this.closePopup();
    const pop = document.createElement('div');
    pop.className = 'board-popup';
    const [x, y] = this.squareXY(s);
    const leftPct = ((x + this.cell / 2) / this.size) * 100;
    const topPct = ((y + this.cell) / this.size) * 100;
    pop.style.left = `${Math.min(Math.max(leftPct, 22), 78)}%`;
    if (topPct > 60) pop.style.bottom = `${100 - (y / this.size) * 100}%`;
    else pop.style.top = `${topPct}%`;
    const h = document.createElement('div');
    h.className = 'board-popup-title';
    h.textContent = title;
    pop.append(h);
    pop.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.append(pop);
    this.popup = pop;
    return pop;
  }

  private closePopup(): void {
    this.popup?.remove();
    this.popup = null;
  }

  private openPromotion(moves: Move[], s: number): void {
    const color = this.source().state.turn;
    const pop = this.openPopup(s, 'Promote to');
    const row = document.createElement('div');
    row.className = 'board-popup-row';
    for (const m of moves) {
      const b = document.createElement('button');
      b.className = 'icon-btn';
      b.title = m.promotion!;
      b.append(pieceIcon(m.promotion!, color, 40));
      b.addEventListener('click', () => this.commit(m));
      row.append(b);
    }
    pop.append(row);
    (row.firstElementChild as HTMLElement | null)?.focus();
  }

  private openRouteChooser(moves: Move[], s: number): void {
    const pop = this.openPopup(s, 'Which way?');
    for (const m of moves) {
      const b = document.createElement('button');
      b.className = 'route-btn';
      b.textContent = this.routeLabel(m);
      b.addEventListener('click', () => this.commit(m));
      b.addEventListener('pointerenter', () => { this.hoverMove = m; this.draw(); });
      b.addEventListener('focus', () => { this.hoverMove = m; this.draw(); });
      pop.append(b);
    }
    this.hoverMove = moves[0];
    this.draw();
    (pop.querySelector('button') as HTMLElement | null)?.focus();
  }

  private routeLabel(m: Move): string {
    const flip = this.orientation === 'b' ? -1 : 1;
    const tramples = m.captures.length ? ` · tramples ${m.captures.length}` : '';
    if (m.kind === 'pivot') return `Pivot to ${m.to.map(squareName).sort().join('–')}${tramples}`;
    const a = [...m.from].sort((x, y) => x - y)[0], b = [...m.to].sort((x, y) => x - y)[0];
    const df = fileOf(b) - fileOf(a), dr = rankOf(b) - rankOf(a);
    const dist = Math.max(Math.abs(df), Math.abs(dr));
    const arrow = ARROWS[`${Math.sign(df) * flip},${Math.sign(dr) * flip}`] ?? '';
    return `Charge ${arrow} ${dist}${tramples}`;
  }

  // ── drawing ────────────────────────────────────────────────────────────────

  draw(): void {
    if (!this.size) return;
    const { ctx, cell } = this;
    const src = this.source();
    const st = src.state;
    this.orientation = src.orientation;
    ctx.clearRect(0, 0, this.size, this.size);

    for (let s = 0; s < 64; s++) {
      const [x, y] = this.squareXY(s);
      ctx.fillStyle = (fileOf(s) + rankOf(s)) % 2 === 0 ? COLORS.dark : COLORS.light;
      ctx.fillRect(x, y, cell, cell);
    }

    // Desk-lamp light falling from the top left.
    const lamp = ctx.createRadialGradient(this.size * 0.2, this.size * 0.12, this.size * 0.05, this.size * 0.4, this.size * 0.4, this.size * 0.95);
    lamp.addColorStop(0, 'rgba(255, 236, 190, 0.16)');
    lamp.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
    lamp.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, this.size, this.size);

    if (src.lastMove) {
      for (const s of new Set([...src.lastMove.from, ...src.lastMove.to])) this.fillSquare(s, COLORS.lastMove);
    }
    if (src.hint) for (const s of src.hint.from) this.fillSquare(s, COLORS.hint);
    if (this.flash) for (const s of this.flash.squares) this.fillSquare(s, this.flash.color);

    const selectedPiece = this.selected !== null ? st.pieces.get(this.selected) : undefined;
    if (selectedPiece) for (const s of selectedPiece.squares) this.fillSquare(s, COLORS.selected);

    for (const color of ['w', 'b'] as Color[]) {
      if (!inCheck(st, color)) continue;
      const [x, y] = this.squareXY(st.kingSquare(color));
      const g = ctx.createRadialGradient(x + cell / 2, y + cell / 2, cell * 0.1, x + cell / 2, y + cell / 2, cell * 0.7);
      g.addColorStop(0, 'rgba(220, 30, 20, 0.95)');
      g.addColorStop(1, 'rgba(220, 30, 20, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, cell, cell);
    }

    this.drawCoordinates();

    // Snapshot: never iterate the live map while other code might make/undo moves.
    for (const p of [...st.pieces.values()]) {
      const ghosted = this.hoverMove && this.hoverMove.pieceId === p.id;
      this.drawPieceAt(p, p.squares, ghosted ? 0.35 : 1);
    }

    if (selectedPiece) this.drawTargets(st, selectedPiece);
    if (this.hoverMove) this.drawGhost(st, this.hoverMove);
  }

  private fillSquare(s: number, color: string): void {
    const [x, y] = this.squareXY(s);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, this.cell, this.cell);
  }

  private drawPieceAt(p: Piece, squares: number[], alpha = 1): void {
    const pad = this.cell * 0.06;
    if (p.type === 'C') {
      const [x, y, w, h] = this.pieceRect(squares);
      drawCavalry(this.ctx, p.color, x, y, w, h, this.cell, { alpha });
    } else {
      const [x, y] = this.squareXY(squares[0]);
      drawPiece(this.ctx, p.type, p.color, x + pad, y + pad, this.cell - pad * 2, { phase: p.phase, alpha });
    }
  }

  private drawTargets(st: GameState, piece: Piece): void {
    const { ctx, cell } = this;
    const seen = new Set<number>();
    for (const m of this.selectedMoves()) {
      for (const s of this.clickSquares(m)) {
        if (seen.has(s)) continue;
        seen.add(s);
        const [x, y] = this.squareXY(s);
        const occ = st.pieceAt(s);
        ctx.save();
        if (occ && occ.color !== piece.color) {
          ctx.strokeStyle = COLORS.target;
          ctx.lineWidth = cell * 0.08;
          ctx.beginPath();
          ctx.arc(x + cell / 2, y + cell / 2, cell * 0.43, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = COLORS.target;
          ctx.beginPath();
          ctx.arc(x + cell / 2, y + cell / 2, cell * 0.14, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  private drawGhost(st: GameState, m: Move): void {
    const p = st.pieces.get(m.pieceId);
    if (!p) return;
    const { ctx, cell } = this;
    // Mark trampled pieces with a red X.
    for (const id of m.captures) {
      const victim = st.pieces.get(id);
      if (!victim) continue;
      for (const s of victim.squares) {
        const [x, y] = this.squareXY(s);
        ctx.save();
        ctx.strokeStyle = 'rgba(200, 30, 20, 0.9)';
        ctx.lineWidth = cell * 0.07;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + cell * 0.22, y + cell * 0.22); ctx.lineTo(x + cell * 0.78, y + cell * 0.78);
        ctx.moveTo(x + cell * 0.78, y + cell * 0.22); ctx.lineTo(x + cell * 0.22, y + cell * 0.78);
        ctx.stroke();
        ctx.restore();
      }
    }
    this.drawPieceAt({ ...p, phase: p.phase }, m.to, 0.75);
    const [x, y, w, h] = this.pieceRect(m.to);
    ctx.save();
    ctx.strokeStyle = 'rgba(222, 184, 92, 0.9)';
    ctx.setLineDash([cell * 0.08, cell * 0.06]);
    ctx.lineWidth = cell * 0.035;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.restore();
  }

  private drawCoordinates(): void {
    const { ctx, cell } = this;
    const flip = this.orientation === 'b';
    ctx.save();
    ctx.font = `${Math.max(9, cell * 0.16)}px "Special Elite", "Courier New", monospace`;
    for (let i = 0; i < 8; i++) {
      // Files along the bottom row.
      const file = flip ? 7 - i : i;
      const bottom = sq(file, flip ? 7 : 0);
      ctx.fillStyle = (fileOf(bottom) + rankOf(bottom)) % 2 === 0 ? COLORS.coordDark : COLORS.coordLight;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('abcdefgh'[file], i * cell + cell - cell * 0.06, this.size - cell * 0.04);
      // Ranks along the left column.
      const rank = flip ? i : 7 - i;
      const left = sq(flip ? 7 : 0, rank);
      ctx.fillStyle = (fileOf(left) + rankOf(left)) % 2 === 0 ? COLORS.coordDark : COLORS.coordLight;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(rank + 1), cell * 0.06, i * cell + cell * 0.05);
    }
    ctx.restore();
  }
}
