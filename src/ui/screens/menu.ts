import type { Screen } from '../app';
import { h } from '../dom';
import { devToggle, soundToggle, xpBar } from '../components';
import { pieceIcon } from '../pieceArt';
import { levelInfo, UNLOCKS } from '../../game/progression';
import { PUZZLES } from '../../data/puzzles';
import { LOADOUTS } from '../../engine/loadouts';
import { PIECE_INFO } from '../pieceInfo';

export const menuScreen: Screen = (app, root) => {
  const p = app.progress;
  const { level } = levelInfo(p.xp);
  const next = UNLOCKS.find((u) => u.level > level);
  const solved = PUZZLES.filter((x) => p.solvedPuzzles.includes(x.id)).length;

  const item = (title: string, sub: string, onClick: () => void, cls = '') =>
    h('button', { class: `menu-item ${cls}`, on: { click: onClick } },
      h('span', { class: 'menu-title' }, title),
      h('span', { class: 'menu-sub' }, sub));

  root.append(h('main', { class: 'screen menu' },
    h('div', { class: 'top-right' }, devToggle(app, () => app.go({ name: 'menu' })), soundToggle(app)),
    h('header', { class: 'title-block' },
      h('div', { class: 'title-icons' }, pieceIcon('K', 'b', 44), pieceIcon('Q', 'w', 44)),
      h('h1', { class: 'title' }, 'Noir Chess'),
      h('p', { class: 'subtitle' }, 'Every piece has a past.')),
    h('section', { class: 'dossier' },
      h('div', { class: 'dossier-label' }, app.dev ? 'Detective file · DEV profile' : 'Detective file'),
      app.dev ? h('p', { class: 'dev-note' }, 'Dev mode: max-level test profile with every piece unlocked. Your real progress is untouched — switch dev mode off to return to it.') : null,
      xpBar(p.xp),
      h('div', { class: 'dossier-row' },
        h('span', null, `Record ${p.stats.wins}W · ${p.stats.losses}L · ${p.stats.draws}D`),
        h('span', null, `Loadout: ${LOADOUTS[p.loadout].name}`)),
      next
        ? h('div', { class: 'next-unlock' },
          pieceIcon(next.piece, 'w', 28),
          h('span', null, `Level ${next.level} unlocks ${PIECE_INFO[next.piece]!.name}`))
        : h('div', { class: 'next-unlock' }, h('span', null, 'Every piece of evidence collected — for now.'))),
    h('nav', { class: 'menu-list' },
      item('Take a Case', '5-minute game vs. the Syndicate', () => app.go({ name: 'setup' }), 'primary'),
      item('Case Files', `Puzzles · ${solved}/${PUZZLES.length} closed`, () => app.go({ name: 'cases' })),
      item('Evidence Locker', 'Choose your army', () => app.go({ name: 'loadout' })))));
  return () => {};
};
