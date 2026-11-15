import type { Route, Screen } from '../app';
import { h } from '../dom';
import { BoardView } from '../board';
import { Match } from '../../game/match';
import { formatClock } from '../../game/clock';
import { DIFFICULTIES } from '../../ai/difficulty';
import { LOADOUTS, type LoadoutId } from '../../engine/loadouts';
import { availableLoadouts, awardXp, xpForGame, levelInfo, type Outcome } from '../../game/progression';
import type { Color, PieceType } from '../../engine/types';
import { opposite } from '../../engine/types';
import { pieceIcon } from '../pieceArt';
import { awardPanel, showModal, soundToggle } from '../components';
import { sound } from '../../audio/sound';
import { moveSounds } from '../../audio/moveSounds';
import { AIClient } from '../../ai/client';
import { MATE } from '../../ai/search';
import { EvalBar } from '../evalBar';
import { OPPONENTS } from './setup';
import type { EndReason } from '../../engine/rules';

const REASONS: Record<EndReason, string> = {
  checkmate: 'by checkmate',
  stalemate: 'by stalemate',
  timeout: 'on time',
  resignation: 'by resignation',
  threefold: 'by threefold repetition',
  'fifty-move': 'by the fifty-move rule',
  insufficient: 'by insufficient material',
};

const ORDER: PieceType[] = ['Q', 'C', 'R', 'M', 'B', 'N', 'P'];

export const gameScreen: Screen<Extract<Route, { name: 'game' }>> = (app, root, route) => {
  const diff = DIFFICULTIES[route.difficulty];
  let aiLoadout: LoadoutId = 'standard';
  if (route.difficulty !== 'rookie') {
    const pool = availableLoadouts(app.progress.xp);
    aiLoadout = pool[Math.floor(Math.random() * pool.length)];
  }
  const match = new Match({
    playerColor: route.color, difficulty: route.difficulty,
    playerLoadout: app.progress.loadout, aiLoadout, timeMs: 5 * 60_000,
  }, app.ai());

  const board = new BoardView(() => ({
    state: match.state,
    orientation: route.color,
    legal: match.isPlayerTurn ? match.legal : [],
    premoves: match.premoveCandidates,
    premove: match.premove,
    lastMove: match.lastMove,
  }), (m) => match.playerMove(m), { onPremove: (m) => match.setPremove(m) });

  // Evaluation bar, fed by its own background engine so it never slows the opponent down.
  const evalBar = new EvalBar(route.color);
  const analyst = new AIClient();
  const analyse = () => {
    const r = match.result;
    if (r) {
      evalBar.show({ result: r.winner === 'w' ? '1-0' : r.winner === 'b' ? '0-1' : '½-½' });
      return;
    }
    const ply = match.state.ply;
    const pov = match.state.turn === 'w' ? 1 : -1;
    void analyst.requestMove(match.state, { maxDepth: 6, timeMs: 400, analysis: true }).then((res) => {
      if (match.state.ply !== ply || match.result) return;
      const score = res.score * pov;
      if (Math.abs(score) > MATE - 1000) {
        evalBar.show({ mate: Math.sign(score) * Math.ceil((MATE - Math.abs(score)) / 2) });
      } else {
        evalBar.show({ cp: score });
      }
    });
  };


  const bar = (color: Color, name: string, sub: string) => {
    const clock = h('div', { class: 'clock', 'aria-live': 'off' }, '5:00');
    const captured = h('div', { class: 'captured' });
    const lead = h('span', { class: 'lead' });
    const el = h('div', { class: 'player-bar' },
      h('div', { class: 'who' },
        pieceIcon('K', color, 26),
        h('div', null, h('div', { class: 'who-name' }, name), h('div', { class: 'who-sub' }, sub))),
      h('div', { class: 'captured-wrap' }, captured, lead), clock);
    return { el, clock, captured, lead };
  };
  const { level } = levelInfo(app.progress.xp);
  const top = bar(opposite(route.color), `${diff.name} — ${OPPONENTS[route.difficulty]}`, LOADOUTS[aiLoadout].name);
  const bottom = bar(route.color, `You · Level ${level}${app.dev ? ' · DEV' : ''}`, LOADOUTS[app.progress.loadout].name);
  const status = h('div', { class: 'status', 'aria-live': 'polite' });
  const moves = h('ol', { class: 'moves' });

  const leave = () => {
    if (match.result) { app.go({ name: 'menu' }); return; }
    const close = showModal(h('div', null,
      h('h2', null, 'Walk away?'),
      h('p', null, 'Leaving now counts as a resignation.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-accent', on: { click: () => { close(); match.resign(); } } }, 'Resign'),
        h('button', { class: 'btn', on: { click: () => close() } }, 'Keep playing'))));
  };

  root.append(h('main', { class: 'screen game' },
    h('div', { class: 'board-col' }, top.el, h('div', { class: 'board-row' }, evalBar.el, board.el), bottom.el),
    h('aside', { class: 'side' },
      h('div', { class: 'case-label' }, `Case vs. ${OPPONENTS[route.difficulty]}`),
      status,
      h('div', { class: 'moves-wrap' }, moves),
      h('div', { class: 'row' },
        h('button', { class: 'btn', on: { click: leave } }, 'Resign'),
        h('button', { class: 'btn ghost', on: { click: leave } }, 'Menu')),
      h('div', { class: 'row toggles' }, soundToggle(app)),
      h('p', { class: 'muted small tips' },
        'Drag or click to move. While they think, queue a premove; right-click cancels it. ',
        'Right-click and drag to draw arrows (Shift or Alt for other colours).'))));

  const renderCaptured = (el: HTMLElement, types: PieceType[], color: Color) => {
    const sorted = [...types].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    el.replaceChildren(...sorted.map((t) => pieceIcon(t, color, 18)));
  };

  let lastPly = -1;
  let shownResult = false;
  const refresh = () => {
    if (match.state.ply !== lastPly) {
      const moved = lastPly >= 0 && match.state.ply > lastPly;
      lastPly = match.state.ply;
      board.reset();
      const last = match.lastMove;
      if (moved && last) sound.play(...moveSounds(match.state, last));
      analyse();
    }
    else board.draw();
    renderCaptured(top.captured, match.captured[opposite(route.color)], route.color);
    renderCaptured(bottom.captured, match.captured[route.color], opposite(route.color));
    for (const [c, b] of [[route.color, bottom], [opposite(route.color), top]] as const) {
      const n = match.materialLead(c);
      b.lead.textContent = n > 0 ? `+${n}` : '';
    }

    const recs = match.records;
    const items: HTMLElement[] = [];
    let i = 0;
    if (recs[0]?.color === 'b') { items.push(h('li', null, h('span', null, '…'), h('span', null, recs[0].label))); i = 1; }
    for (; i < recs.length; i += 2) {
      items.push(h('li', null, h('span', null, recs[i].label), h('span', null, recs[i + 1]?.label ?? '')));
    }
    moves.replaceChildren(...items);
    moves.parentElement!.scrollTop = moves.parentElement!.scrollHeight;

    if (match.result) {
      const r = match.result;
      status.textContent = r.winner === null ? `Draw ${REASONS[r.reason]}.`
        : r.winner === route.color ? `You win ${REASONS[r.reason]}.` : `You lose ${REASONS[r.reason]}.`;
      // Let the checkmate sting ring out before the verdict.
      if (!shownResult) { shownResult = true; setTimeout(showResult, r.reason === 'checkmate' ? 1900 : 500); }
    } else if (match.aiThinking) status.textContent = `${OPPONENTS[route.difficulty]} is thinking…`;
    else if (match.isPlayerTurn) status.textContent = recs.at(-1)?.label.endsWith('+') ? 'Check! Your move.' : 'Your move.';
    else status.textContent = '';
  };

  const showResult = () => {
    const r = match.result!;
    const outcome: Outcome = r.winner === null ? 'draw' : r.winner === route.color ? 'win' : 'loss';
    app.progress.stats[outcome === 'win' ? 'wins' : outcome === 'loss' ? 'losses' : 'draws']++;
    const award = awardXp(app.progress, xpForGame(outcome, route.difficulty));
    sound.play(outcome);
    app.save();
    const headline = { win: 'Case closed', loss: 'The case went cold', draw: 'A stalemate of wills' }[outcome];
    let close = () => {};
    const content = h('div', { class: 'result' },
      h('div', { class: `stamp ${outcome === 'win' ? '' : 'muted-stamp'}` }, outcome === 'win' ? 'Solved' : outcome === 'draw' ? 'Draw' : 'Unsolved'),
      h('h2', null, headline),
      h('p', { class: 'muted' }, status.textContent ?? ''),
      awardPanel(app, award, () => close()),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-accent', on: { click: () => { close(); app.go(route); } } }, 'Rematch'),
        h('button', { class: 'btn', on: { click: () => { close(); app.go({ name: 'menu' }); } } }, 'Main menu')));
    close = showModal(content);
  };

  const unsubscribe = match.onChange(refresh);
  let raf = 0;
  const loop = () => {
    match.update();
    for (const [c, b] of [[route.color, bottom], [opposite(route.color), top]] as const) {
      const ms = match.clock.remaining[c];
      b.clock.textContent = formatClock(ms);
      b.clock.classList.toggle('active', match.clock.active === c);
      b.clock.classList.toggle('low', ms < 30_000);
    }
    raf = requestAnimationFrame(loop);
  };
  match.start();
  refresh();
  loop();

  return () => {
    cancelAnimationFrame(raf);
    unsubscribe();
    match.dispose();
    analyst.dispose();
    board.destroy();
  };
};
