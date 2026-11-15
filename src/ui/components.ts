import { h } from './dom';
import { pieceIcon } from './pieceArt';
import { PIECE_INFO } from './pieceInfo';
import { levelInfo, type Unlock, type XpAward } from '../game/progression';
import type { App } from './app';
import type { Color, PieceType } from '../engine/types';
import { sound } from '../audio/sound';

/** Sound on/off switch (saved with progress). */
export function soundToggle(app: App): HTMLButtonElement {
  const btn = h('button', { class: 'sound-toggle', type: 'button' });
  const render = () => {
    btn.textContent = app.progress.sound ? '♪ Sound on' : '♪ Sound off';
    btn.setAttribute('aria-pressed', String(app.progress.sound));
    btn.classList.toggle('off', !app.progress.sound);
  };
  btn.addEventListener('click', () => {
    app.progress.sound = !app.progress.sound;
    sound.enabled = app.progress.sound;
    app.save();
    render();
    if (app.progress.sound) sound.play('move');
  });
  render();
  return btn;
}

export function xpBar(xp: number): HTMLElement {
  const { level, into, needed } = levelInfo(xp);
  const pct = Math.min(100, (into / needed) * 100);
  return h('div', { class: 'xp' },
    h('div', { class: 'xp-head' },
      h('span', { class: 'xp-level' }, `Level ${level}`),
      h('span', { class: 'xp-num' }, `${into} / ${needed} XP`)),
    h('div', { class: 'xp-track' }, h('div', { class: 'xp-fill', style: `width:${pct}%` })));
}

/** Modal dialog. Returns a function that closes it. */
export function showModal(content: HTMLElement, opts: { onClose?: () => void; dismissable?: boolean } = {}): () => void {
  const card = h('div', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true' }, content);
  const overlay = h('div', { class: 'modal' }, card);
  const close = () => {
    overlay.remove();
    window.removeEventListener('keydown', onKey);
    opts.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && opts.dismissable !== false) close(); };
  window.addEventListener('keydown', onKey);
  if (opts.dismissable !== false) overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  document.body.append(overlay);
  (card.querySelector('button') as HTMLElement | null)?.focus();
  return close;
}

export function pieceRulesCard(type: PieceType, color: Color = 'w'): HTMLElement {
  const info = PIECE_INFO[type]!;
  return h('div', { class: 'rules-card' },
    h('div', { class: 'rules-icon' }, pieceIcon(type, color, 56)),
    h('div', null,
      h('h3', null, info.name),
      h('p', { class: 'tagline' }, info.tagline),
      h('ul', null, ...info.rules.map((r) => h('li', null, r)))));
}

/** XP gain, level-up and unlock reveal — shared by games and puzzles. */
export function awardPanel(app: App, award: XpAward, close: () => void): HTMLElement {
  const before = levelInfo(award.before);
  const after = levelInfo(award.after);
  const fill = h('div', { class: 'xp-fill', style: `width:${(before.into / before.needed) * 100}%` });
  const label = h('span', { class: 'xp-num' }, `${before.into} / ${before.needed} XP`);
  const levelEl = h('span', { class: 'xp-level' }, `Level ${before.level}`);
  const bar = h('div', { class: 'xp' },
    h('div', { class: 'xp-head' }, levelEl, label),
    h('div', { class: 'xp-track' }, fill));
  // Animate after mount.
  setTimeout(() => {
    if (after.level > before.level) fill.style.width = '100%';
    else fill.style.width = `${(after.into / after.needed) * 100}%`;
    setTimeout(() => {
      levelEl.textContent = `Level ${after.level}`;
      label.textContent = `${after.into} / ${after.needed} XP`;
      if (after.level > before.level) {
        fill.style.transition = 'none';
        fill.style.width = '0%';
        void fill.offsetWidth;
        fill.style.transition = '';
        fill.style.width = `${(after.into / after.needed) * 100}%`;
      }
    }, 700);
  }, 150);

  return h('div', { class: 'award' },
    h('div', { class: 'xp-gain' }, `+${award.gained} XP`),
    bar,
    award.levelAfter > award.levelBefore
      ? h('div', { class: 'level-up' }, `Promoted to Level ${award.levelAfter}`)
      : null,
    ...award.newUnlocks.map((u) => unlockCard(app, u, close)));
}

function unlockCard(app: App, u: Unlock, close: () => void): HTMLElement {
  return h('div', { class: 'unlock' },
    h('div', { class: 'stamp small' }, 'New evidence'),
    pieceRulesCard(u.piece),
    h('button', {
      class: 'btn btn-accent',
      on: {
        click: () => {
          app.progress.loadout = u.loadout;
          app.save();
          close();
          app.go({ name: 'loadout' });
        },
      },
    }, 'Equip it'));
}
