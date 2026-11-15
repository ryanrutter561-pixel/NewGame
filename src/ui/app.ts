import type { AIClient } from '../ai/client';
import type { Difficulty } from '../ai/difficulty';
import type { Color } from '../engine/types';
import type { Progress } from '../game/progression';

export type Route =
  | { name: 'menu' }
  | { name: 'setup' }
  | { name: 'game'; color: Color; difficulty: Difficulty }
  | { name: 'loadout' }
  | { name: 'cases' }
  | { name: 'case'; id: string };

export interface App {
  root: HTMLElement;
  progress: Progress;
  save(): void;
  go(route: Route): void;
  ai(): AIClient;
}

/** A screen renders into `root` and returns a cleanup function. */
export type Screen<R extends Route = Route> = (app: App, root: HTMLElement, route: R) => () => void;
