import type { Screen } from '../app';
import { h } from '../dom';
import { DIFFICULTIES, type Difficulty } from '../../ai/difficulty';
import { LOADOUTS } from '../../engine/loadouts';
import type { Color } from '../../engine/types';
import { pieceIcon } from '../pieceArt';

export const OPPONENTS: Record<Difficulty, string> = {
  rookie: '"Slim" Malone',
  detective: 'Vera Kane',
  inspector: 'The Commissioner',
};

export const setupScreen: Screen = (app, root) => {
  let color: Color | 'random' = 'w';
  let difficulty: Difficulty = 'rookie';

  const choice = <T extends string>(name: string, options: { value: T; label: Node | string; sub?: string }[], get: () => T, set: (v: T) => void) => {
    const wrap = h('div', { class: 'choices', role: 'radiogroup', 'aria-label': name });
    const render = () => {
      wrap.replaceChildren(...options.map((o) => h('button', {
        class: `choice ${get() === o.value ? 'on' : ''}`, role: 'radio', 'aria-checked': String(get() === o.value),
        on: { click: () => { set(o.value); render(); } },
      }, typeof o.label === 'string' ? h('span', { class: 'choice-label' }, o.label) : o.label, o.sub ? h('span', { class: 'choice-sub' }, o.sub) : null)));
    };
    render();
    return wrap;
  };

  const colorLabel = (c: 'w' | 'b' | 'random', text: string) => h('span', { class: 'choice-label with-icon' },
    c === 'random' ? h('span', { class: 'coin' }, '?') : pieceIcon('K', c, 32), text);

  root.append(h('main', { class: 'screen setup' },
    h('button', { class: 'back', on: { click: () => app.go({ name: 'menu' }) } }, '← Back'),
    h('h2', null, 'Take a Case'),
    h('p', { class: 'muted' }, 'Five minutes on the clock. No increment. Win to earn your stripes.'),
    h('h3', null, 'Play as'),
    choice('Play as', [
      { value: 'w', label: colorLabel('w', 'White') },
      { value: 'b', label: colorLabel('b', 'Black') },
      { value: 'random', label: colorLabel('random', 'Toss a coin') },
    ], () => color, (v) => { color = v; }),
    h('h3', null, 'Opponent'),
    choice('Opponent', (Object.values(DIFFICULTIES)).map((d) => ({
      value: d.id, label: `${d.name} — ${OPPONENTS[d.id]}`,
      sub: `${d.blurb} Win: +${Math.round(100 * d.xpMultiplier)} XP`,
    })), () => difficulty, (v) => { difficulty = v; }),
    h('h3', null, 'Your army'),
    h('div', { class: 'loadout-line' },
      h('span', null, LOADOUTS[app.progress.loadout].name),
      h('button', { class: 'link', on: { click: () => app.go({ name: 'loadout' }) } }, 'Change')),
    h('p', { class: 'muted small' }, 'Detectives and Inspectors may bring unlocked pieces of their own.'),
    h('button', {
      class: 'btn btn-accent big',
      on: {
        click: () => {
          const c: Color = color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
          app.go({ name: 'game', color: c, difficulty });
        },
      },
    }, 'Start the clock')));
  return () => {};
};
