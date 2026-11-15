import type { GameState } from '../engine/state';
import { moveKey, serialize, deserialize } from '../engine/position';
import { searchBestMove, type SearchOptions } from './search';
import type { AIRequest, AIResponse } from './worker';

/** Runs the search in a Web Worker so the board and clocks stay responsive. */
export class AIClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, (r: AIResponse) => void>();

  constructor() {
    try {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<AIResponse>) => {
        const cb = this.pending.get(e.data.id);
        this.pending.delete(e.data.id);
        cb?.(e.data);
      };
    } catch {
      this.worker = null;
    }
  }

  requestMove(st: GameState, options: AIRequest['options']): Promise<AIResponse> {
    const id = this.nextId++;
    const position = serialize(st);
    if (!this.worker) {
      return new Promise((resolve) => setTimeout(() => {
        const res = searchBestMove(deserialize(position), options as SearchOptions);
        resolve({ id, moveKey: res.move ? moveKey(res.move) : null, score: res.score, depth: res.depth, nodes: res.nodes });
      }, 0));
    }
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker!.postMessage({ id, position, options } satisfies AIRequest);
    });
  }

  /** Drop any in-flight answers (e.g. the player resigned or left the game). */
  cancelAll(): void {
    this.pending.clear();
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}
