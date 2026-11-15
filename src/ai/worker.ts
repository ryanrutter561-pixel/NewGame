/// <reference lib="webworker" />
import { deserialize, moveKey, type SerializedState } from '../engine/position';
import { searchBestMove, type SearchOptions } from './search';

export interface AIRequest {
  id: number;
  position: SerializedState;
  options: Omit<SearchOptions, 'random' | 'now'>;
}

export interface AIResponse {
  id: number;
  moveKey: string | null;
  score: number;
  depth: number;
  nodes: number;
}

self.onmessage = (e: MessageEvent<AIRequest>) => {
  const { id, position, options } = e.data;
  const st = deserialize(position);
  const res = searchBestMove(st, options);
  const reply: AIResponse = {
    id, moveKey: res.move ? moveKey(res.move) : null, score: res.score, depth: res.depth, nodes: res.nodes,
  };
  (self as unknown as Worker).postMessage(reply);
};
