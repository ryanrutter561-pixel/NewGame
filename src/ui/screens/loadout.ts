import type { Screen } from '../app';
import { h } from '../dom';
import { LOADOUTS, type LoadoutId } from '../../engine/loadouts';
import { availableLoadouts, UNLOCKS } from '../../game/progression';
import { pieceIcon } from '../pieceArt';
import { pieceRulesCard } from '../components';
import type { PieceType } from '../../engine/types';

const ROSTER: Record<LoadoutId, PieceType[]> = {
  standard: ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
  marshal: ['R', 'M', 'B', 'Q', 'K', 'B', 'M', 'R'],
  cavalry: ['C', 'B', 'Q', 'K', 'B', 'C'],
};

export const loadoutScreen: Screen = (app, root) => {
  const main = h('main', { class: 'screen loadout' });
  const render = () => {
    const open = availableLoadouts(app.progress.xp);
    main.replaceChildren(
      h('button', { class: 'back', on: { click: () => app.go({ name: 'menu' }) } }, '← Back'),
      h('h2', null, 'Evidence Locker'),
      h('p', { class: 'muted' }, 'Pick the back rank you bring to every case. Both flanks use the same army.'),
      ...(Object.values(LOADOUTS)).map((l) => {
        const unlocked = open.includes(l.id);
        const equipped = app.progress.loadout === l.id;
        const unlockLevel = UNLOCKS.find((u) => u.loadout === l.id)?.level;
        return h('section', { class: `loadout-card ${equipped ? 'equipped' : ''} ${unlocked ? '' : 'locked'}` },
          h('div', { class: 'loadout-head' },
            h('h3', null, l.name),
            equipped ? h('span', { class: 'stamp small' }, 'Equipped')
              : unlocked ? h('button', { class: 'btn', on: { click: () => { app.progress.loadout = l.id; app.save(); render(); } } }, 'Equip')
                : h('span', { class: 'lock' }, `Locked · Level ${unlockLevel}`)),
          h('div', { class: 'roster' }, ...ROSTER[l.id].map((t) => pieceIcon(t, 'w', 36))),
          h('p', { class: 'muted' }, l.summary),
          l.requires ? pieceRulesCard(l.requires) : null);
      }));
  };
  render();
  root.append(main);
  return () => {};
};
