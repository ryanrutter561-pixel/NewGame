import type { Route, Screen } from '../app';
import { h } from '../dom';
import { BoardView } from '../board';
import { PUZZLES } from '../../data/puzzles';
import { PuzzleSession } from '../../game/puzzles';
import { awardXp, xpForPuzzle } from '../../game/progression';
import { awardPanel, pieceRulesCard, showModal } from '../components';
import { goalText } from './cases';
import type { Move } from '../../engine/types';

export const caseScreen: Screen<Extract<Route, { name: 'case' }>> = (app, root, route) => {
  const index = Math.max(0, PUZZLES.findIndex((p) => p.id === route.id));
  const def = PUZZLES[index];
  const session = new PuzzleSession(def);
  let hint: Move | null = null;
  let busy = false;
  let timer = 0;

  const status = h('div', { class: 'status', 'aria-live': 'polite' }, 'Your move.');
  const board = new BoardView(() => ({
    state: session.state,
    orientation: session.playerColor,
    legal: busy ? [] : session.legal,
    lastMove: session.state.lastMove,
    hint,
  }), (m) => onMove(m));

  const say = (text: string, tone = '') => { status.textContent = text; status.className = `status ${tone}`; };

  const onMove = (m: Move) => {
    hint = null;
    const fb = session.playerMove(m);
    if (fb === 'wrong') {
      board.flashSquares([...m.from, ...m.to]);
      say("That's not it. Look again.", 'bad');
      return;
    }
    board.reset();
    if (fb === 'solved') { solved(); return; }
    say('Good. They respond…');
    busy = true;
    timer = window.setTimeout(() => {
      session.opponentReply();
      busy = false;
      board.reset();
      say(`Your move. ${session.movesLeft === 1 && def.goal === 'mate' ? 'Finish it.' : ''}`);
    }, 650);
  };

  const solved = () => {
    say('Case closed.', 'good');
    const first = !app.progress.solvedPuzzles.includes(def.id);
    if (first) app.progress.solvedPuzzles.push(def.id);
    const award = awardXp(app.progress, xpForPuzzle(first));
    app.save();
    const next = PUZZLES[index + 1];
    let close = () => {};
    const content = h('div', { class: 'result' },
      h('div', { class: 'stamp' }, 'Case closed'),
      h('h2', null, def.title),
      session.mistakes ? h('p', { class: 'muted' }, `Solved after ${session.mistakes} wrong lead${session.mistakes > 1 ? 's' : ''}.`) : h('p', { class: 'muted' }, 'Clean work, detective.'),
      awardPanel(app, award, () => close()),
      h('div', { class: 'row' },
        next ? h('button', { class: 'btn btn-accent', on: { click: () => { close(); app.go({ name: 'case', id: next.id }); } } }, 'Next case') : null,
        h('button', { class: 'btn', on: { click: () => { close(); app.go({ name: 'cases' }); } } }, 'All cases')));
    window.setTimeout(() => { close = showModal(content); }, 450);
  };

  const reset = () => {
    clearTimeout(timer);
    busy = false;
    hint = null;
    session.reset();
    board.reset();
    say('Your move.');
  };

  root.append(h('main', { class: 'screen game case' },
    h('div', { class: 'board-col' }, board.el),
    h('aside', { class: 'side' },
      h('button', { class: 'back', on: { click: () => app.go({ name: 'cases' }) } }, '← Case files'),
      h('div', { class: 'case-label' }, `Case No. ${String(index + 1).padStart(2, '0')} · ${goalText(def)}`),
      h('h2', null, def.title),
      h('p', { class: 'brief' }, def.brief),
      h('p', { class: 'muted small' }, `You play ${session.playerColor === 'w' ? 'White' : 'Black'}.`),
      status,
      h('div', { class: 'row' },
        h('button', {
          class: 'btn', on: {
            click: () => {
              hint = session.hint();
              if (hint) say('Look at the highlighted piece.');
              board.reset();
            },
          },
        }, 'Hint'),
        h('button', { class: 'btn ghost', on: { click: reset } }, 'Reset')),
      def.featured ? pieceRulesCard(def.featured) : null)));

  return () => {
    clearTimeout(timer);
    board.destroy();
  };
};
