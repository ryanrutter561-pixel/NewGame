import type { GameState } from '../engine/state';
import type { Move } from '../engine/types';
import { inCheck } from '../engine/movegen';
import { isCheckmate } from '../engine/rules';
import type { SoundName } from './sound';

/** Sounds for a move that has just been made on `st` (base click/thud + check or mate sting). */
export function moveSounds(st: GameState, m: Move): SoundName[] {
  const out: SoundName[] = [m.captures.length ? 'capture' : 'move'];
  if (isCheckmate(st)) out.push('checkmate');
  else if (inCheck(st, st.turn)) out.push('check');
  return out;
}
