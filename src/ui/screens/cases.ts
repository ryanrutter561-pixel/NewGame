import type { Screen } from '../app';
import { h } from '../dom';
import { PUZZLES } from '../../data/puzzles';
import { pieceIcon } from '../pieceArt';
import type { PuzzleDef } from '../../game/puzzles';

export const goalText = (p: PuzzleDef): string =>
  p.goal === 'mate' ? `Mate in ${p.moves}` : 'Win material';

export const casesScreen: Screen = (app, root) => {
  root.append(h('main', { class: 'screen cases' },
    h('button', { class: 'back', on: { click: () => app.go({ name: 'menu' }) } }, '← Back'),
    h('h2', null, 'Case Files'),
    h('p', { class: 'muted' }, 'Each solved case earns 50 XP the first time, 10 on a re-run.'),
    h('div', { class: 'case-grid' }, ...PUZZLES.map((p, i) => {
      const solved = app.progress.solvedPuzzles.includes(p.id);
      return h('button', { class: `case-card ${solved ? 'solved' : ''}`, on: { click: () => app.go({ name: 'case', id: p.id }) } },
        h('span', { class: 'case-no' }, `No. ${String(i + 1).padStart(2, '0')}`),
        h('span', { class: 'case-title' }, p.title),
        h('span', { class: 'case-goal' }, goalText(p)),
        p.featured ? h('span', { class: 'case-featured' }, pieceIcon(p.featured, 'w', 22)) : null,
        solved ? h('span', { class: 'stamp small' }, 'Closed') : null);
    }))));
  return () => {};
};
