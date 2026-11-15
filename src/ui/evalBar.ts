import type { Color } from '../engine/types';
import { h } from './dom';

/** Evaluation from White's point of view: centipawns, or moves-to-mate (positive = White mates). */
export type Evaluation = { cp: number } | { mate: number } | { result: '1-0' | '0-1' | '½-½' };

/** Vertical bar beside the board; the player's color fills from the bottom. */
export class EvalBar {
  readonly el: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly label: HTMLDivElement;

  constructor(private readonly orientation: Color) {
    this.fill = h('div', { class: 'eval-fill' });
    this.label = h('div', { class: 'eval-label' });
    this.el = h('div', { class: `eval-bar ${orientation === 'b' ? 'flip' : ''}`, role: 'meter', 'aria-label': 'Evaluation' },
      this.fill, this.label);
    this.show({ cp: 0 });
  }

  show(ev: Evaluation): void {
    let whitePct: number;
    let text: string;
    let whiteAhead: boolean;
    if ('result' in ev) {
      whitePct = ev.result === '1-0' ? 100 : ev.result === '0-1' ? 0 : 50;
      text = ev.result;
      whiteAhead = ev.result !== '0-1';
    } else if ('mate' in ev) {
      whitePct = ev.mate > 0 ? 100 : 0;
      text = `M${Math.abs(ev.mate)}`;
      whiteAhead = ev.mate > 0;
    } else {
      // Logistic squash: ±2 pawns ≈ 76/24, ±5 pawns ≈ 95/5.
      whitePct = 100 / (1 + Math.exp(-ev.cp / 180));
      text = (Math.abs(ev.cp) / 100).toFixed(1);
      whiteAhead = ev.cp >= 0;
    }
    const bottomPct = this.orientation === 'w' ? whitePct : 100 - whitePct;
    this.fill.style.height = `${bottomPct}%`;
    this.label.textContent = text;
    const bottomLeads = whiteAhead === (this.orientation === 'w');
    this.label.classList.toggle('at-bottom', bottomLeads);
    this.el.setAttribute('aria-valuetext', `${whiteAhead ? 'White' : 'Black'} ${text}`);
  }
}
