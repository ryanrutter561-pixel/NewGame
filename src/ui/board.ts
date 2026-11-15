import type { GameState } from '../engine/state';
import type { Color, Move, Piece } from '../engine/types';
import { fileOf, rankOf, sq, squareName } from '../engine/square';
import { inCheck } from '../engine/movegen';
import { drawCavalry, drawPiece, pieceIcon } from './pieceArt';
import { resolvePremove } from '../engine/premove';

export interface BoardSource {
  state: GameState;
  /** Color shown at the bottom (always the player). */
  orientation: Color;
  /** Moves the player may make right now (empty when it's not their turn). */
  legal: Move[];
  lastMove?: Move;
  hint?: Move | null;
  /** Moves that may be queued during the opponent's turn (premoves). */
  premoves?: Move[];
  /** The queued premove, highlighted until it plays or is cancelled. */
  premove?: Move | null;
}

export interface BoardOptions {
  /** Queue (or with null, cancel) a premove. Without it, the board offers no premoves. */
  onPremove?: (m: Move | null) => void;
}

interface Drag {
  pieceId: number;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** Where inside the piece it was grabbed, so it doesn't jump under the cursor. */
  offX: number;
  offY: number;
  active: boolean;
  /** Clicking an already-selected piece (without dragging) deselects it. */
  deselectOnUp: boolean;
}

interface Arrow { from: number; to: number; color: string }

const MARK = {
  red: 'rgba(200, 40, 30, 0.75)',
  gold: 'rgba(222, 184, 92, 0.85)',
  blue: 'rgba(90, 140, 200, 0.85)',
};

const COLORS = {
  light: '#bdb6a8',
  dark: '#3a3936',
  lastMove: 'rgba(222, 184, 92, 0.32)',
  selected: 'rgba(179, 38, 30, 0.45)',
  target: 'rgba(179, 38, 30, 0.75)',
  hint: 'rgba(222, 184, 92, 0.55)',
  premove: 'rgba(80, 110, 150, 0.55)',
  premoveTarget: 'rgba(80, 120, 170, 0.8)',
  coordLight: '#3a3936',
  coordDark: '#bdb6a8',
};

const ARROWS: Record<string, string> = { '0,1': '↑', '0,-1': '↓', '1,0': '→', '-1,0': '←' };

/**
 * Canvas chessboard. Click-click or drag-and-drop to move, premoves during the opponent's turn,
 * right-click (drag) to draw arrows and circles, plus a Cavalry route chooser and promotion picker.
 */
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
  private drag: Drag | null = null;
  private arrows: Arrow[] = [];
  private circles: { sq: number; color: string }[] = [];
  /** Right-button annotation being drawn. */
  private drawing: Arrow | null = null;
  private readonly resizeObserver: ResizeObserver;
  private raf = 0;

  constructor(
    private readonly source: () => BoardSource,
    private readonly onMove: (m: Move) => void,
    private readonly opts: BoardOptions = {},
  ) {
    this.el = document.createElement('div');
    this.el.className = 'board';
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Chess board');
    this.el.append(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('pointercancel', () => { this.drag = null; this.drawing = null; this.draw(); });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('pointerleave', () => {
      if (!this.popup && !this.drag) { this.hoverMove = null; this.draw(); }
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

  /** Forget the selection (call when the position changes). A piece being dragged stays in hand. */
  reset(): void {
    const keep = this.drag && this.source().state.pieces.has(this.drag.pieceId);
    if (!keep) {
      this.drag = null;
      this.selected = null;
    }
    this.hoverMove = null;
    this.closePopup();
    this.draw();
  }

  /** Remove all arrows and circles. */
  clearAnnotations(): void {
    this.arrows = [];
    this.circles = [];
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
    if (e.key === 'Escape') {
      this.selected = null;
      this.hoverMove = null;
      this.drag = null;
      this.closePopup();
      if (this.source().premove) this.opts.onPremove?.(null);
      this.draw();
    }
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

  /** Moves the player can make now: real moves on their turn, premoves during the opponent's. */
  private activeMoves(): Move[] {
    const src = this.source();
    if (src.legal.length) return src.legal;
    return this.opts.onPremove ? src.premoves ?? [] : [];
  }

  private selectedMoves(): Move[] {
    if (this.selected === null) return [];
    return this.activeMoves().filter((m) => m.pieceId === this.selected);
  }

  private pointerXY(e: PointerEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private targetsAt(s: number | null): Move[] {
    return s === null ? [] : this.selectedMoves().filter((m) => this.clickSquares(m).includes(s));
  }

  private onPointerDown(e: PointerEvent): void {
    e.preventDefault();
    if (e.button === 2) { this.startAnnotation(e); return; }
    if (e.button !== 0) return;
    if (this.arrows.length || this.circles.length) { this.arrows = []; this.circles = []; }
    if (this.popup) { this.closePopup(); this.hoverMove = null; this.draw(); return; }
    const s = this.pointToSquare(e);
    if (s === null) return;

    const candidates = this.targetsAt(s);
    if (candidates.length) { this.resolve(candidates, s); return; }

    const p = this.source().state.pieceAt(s);
    if (p && this.activeMoves().some((m) => m.pieceId === p.id)) {
      const wasSelected = this.selected === p.id;
      this.selected = p.id;
      const [x, y] = this.pointerXY(e);
      const [rx, ry] = this.pieceRect(p.squares);
      this.drag = {
        pieceId: p.id, pointerId: e.pointerId, startX: x, startY: y, x, y,
        offX: x - rx, offY: y - ry, active: false, deselectOnUp: wasSelected,
      };
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    } else {
      this.selected = null;
    }
    this.hoverMove = null;
    this.draw();
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.drawing) {
      const s = this.pointToSquare(e);
      if (s !== null && s !== this.drawing.to) { this.drawing.to = s; this.draw(); }
      return;
    }
    let redraw = false;
    if (this.drag) {
      const [x, y] = this.pointerXY(e);
      this.drag.x = x;
      this.drag.y = y;
      if (!this.drag.active && Math.hypot(x - this.drag.startX, y - this.drag.startY) > 4) {
        this.drag.active = true;
        this.canvas.style.cursor = 'grabbing';
      }
      redraw = this.drag.active;
    }
    // Cavalry: preview the route under the pointer.
    if (!this.popup && this.selected !== null && this.source().state.pieces.get(this.selected)?.type === 'C') {
      const m = this.targetsAt(this.pointToSquare(e))[0] ?? null;
      if (m !== this.hoverMove) { this.hoverMove = m; redraw = true; }
    }
    if (redraw) this.draw();
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.button === 2) { this.finishAnnotation(); return; }
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.canvas.style.cursor = '';
    try { this.canvas.releasePointerCapture(d.pointerId); } catch { /* already released */ }
    if (d.active) {
      const s = this.pointToSquare(e);
      const candidates = this.targetsAt(s);
      if (candidates.length) { this.resolve(candidates, s!); return; }
      // Dropped back on itself: keep it selected for click-to-move. Anywhere else: let go.
      const piece = this.source().state.pieces.get(d.pieceId);
      if (s === null || !piece?.squares.includes(s)) this.selected = null;
    } else if (d.deselectOnUp) {
      this.selected = null;
    }
    if (!this.popup) this.hoverMove = null;
    this.draw();
  }

  private startAnnotation(e: PointerEvent): void {
    const s = this.pointToSquare(e);
    if (s === null) return;
    // Right-click also drops the selection and cancels a queued premove.
    this.selected = null;
    this.hoverMove = null;
    this.drag = null;
    this.closePopup();
    if (this.source().premove) this.opts.onPremove?.(null);
    const color = e.shiftKey ? MARK.gold : e.altKey || e.ctrlKey || e.metaKey ? MARK.blue : MARK.red;
    this.drawing = { from: s, to: s, color };
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    this.draw();
  }

  private finishAnnotation(): void {
    const a = this.drawing;
    this.drawing = null;
    if (!a) return;
    if (a.from === a.to) {
      const i = this.circles.findIndex((c) => c.sq === a.from);
      const same = i >= 0 && this.circles[i].color === a.color;
      if (i >= 0) this.circles.splice(i, 1);
      if (!same) this.circles.push({ sq: a.from, color: a.color });
    } else {
      const i = this.arrows.findIndex((x) => x.from === a.from && x.to === a.to);
      const same = i >= 0 && this.arrows[i].color === a.color;
      if (i >= 0) this.arrows.splice(i, 1);
      if (!same) this.arrows.push(a);
    }
    this.draw();
  }

  /** Play the move now, or queue it as a premove — whichever the current turn allows. */
  private commit(m: Move): void {
    this.selected = null;
    this.hoverMove = null;
    this.drag = null;
    this.closePopup();
    const src = this.source();
    if (src.legal.includes(m)) this.onMove(m);
    else if (src.legal.length) {
      // A premove picked just as our turn began: play it if it's legal now.
      const real = resolvePremove(m, src.legal);
      if (real) this.onMove(real);
    } else if ((src.premoves ?? []).includes(m)) this.opts.onPremove?.(m);
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
    const color = this.source().state.pieces.get(moves[0].pieceId)?.color ?? this.source().state.turn;
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
    if (src.premove) for (const s of new Set([...src.premove.from, ...src.premove.to])) this.fillSquare(s, COLORS.premove);
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
    const dragging = this.drag?.active ? this.drag : null;
    for (const p of [...st.pieces.values()]) {
      const ghosted = (this.hoverMove && this.hoverMove.pieceId === p.id) || dragging?.pieceId === p.id;
      this.drawPieceAt(p, p.squares, ghosted ? 0.35 : 1);
    }

    if (selectedPiece) this.drawTargets(st, selectedPiece, src.legal.length ? COLORS.target : COLORS.premoveTarget);
    if (this.hoverMove && !dragging) this.drawGhost(st, this.hoverMove);

    for (const c of this.circles) this.drawCircle(c.sq, c.color);
    for (const a of this.arrows) this.drawArrow(a.from, a.to, a.color);
    if (this.drawing) {
      if (this.drawing.from === this.drawing.to) this.drawCircle(this.drawing.from, this.drawing.color);
      else this.drawArrow(this.drawing.from, this.drawing.to, this.drawing.color);
    }

    // The piece in hand floats above everything.
    const held = dragging ? st.pieces.get(dragging.pieceId) : undefined;
    if (dragging && held) {
      const [, , w, h] = this.pieceRect(held.squares);
      const x = dragging.x - dragging.offX, y = dragging.y - dragging.offY;
      const pad = cell * 0.06;
      if (held.type === 'C') drawCavalry(ctx, held.color, x, y, w, h, cell, {});
      else drawPiece(ctx, held.type, held.color, x + pad, y + pad, cell - pad * 2, { phase: held.phase });
    }
  }

  private center(s: number): [number, number] {
    const [x, y] = this.squareXY(s);
    return [x + this.cell / 2, y + this.cell / 2];
  }

  private drawCircle(s: number, color: string): void {
    const [cx, cy] = this.center(s);
    const { ctx, cell } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = cell * 0.07;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawArrow(from: number, to: number, color: string): void {
    const { ctx, cell } = this;
    const [x1, y1] = this.center(from);
    const [x2, y2] = this.center(to);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const head = cell * 0.42, width = cell * 0.15;
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cell * 0.12, -width / 2);
    ctx.lineTo(len - head, -width / 2);
    ctx.lineTo(len - head, -head * 0.5);
    ctx.lineTo(len, 0);
    ctx.lineTo(len - head, head * 0.5);
    ctx.lineTo(len - head, width / 2);
    ctx.lineTo(cell * 0.12, width / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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

  private drawTargets(st: GameState, piece: Piece, color: string): void {
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
          ctx.strokeStyle = color;
          ctx.lineWidth = cell * 0.08;
          ctx.beginPath();
          ctx.arc(x + cell / 2, y + cell / 2, cell * 0.43, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
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
