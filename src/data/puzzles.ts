import type { PuzzleDef } from '../game/puzzles';

export const PUZZLES: PuzzleDef[] = [
  {
    id: 'back-room', title: 'The Back Room', goal: 'mate', moves: 1,
    brief: "He boarded himself in behind his own men. Thought that made him safe. Show him the door's still open.",
    fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    solution: ['e1e8'],
  },
  {
    id: 'four-move-swindle', title: 'Four-Move Swindle', goal: 'mate', moves: 1,
    brief: 'Oldest con in the book, and the mark walked right into it. Collect.',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    solution: ['h5f7'],
  },
  {
    id: 'smothered', title: 'Smothered', goal: 'mate', moves: 1,
    brief: 'Cornered by his own bodyguards. One quiet visitor is all it takes.',
    fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
    solution: ['g5f7'],
  },
  {
    id: 'fork-in-the-alley', title: 'Fork in the Alley', goal: 'material', moves: 2,
    brief: 'The boss and his muscle, standing too close together. Make them choose.',
    fen: 'r3k3/5ppp/1P6/3N4/8/8/5PPP/6K1 w - - 0 1',
    solution: ['d5c7', 'e8e7', 'c7a8'],
  },
  {
    id: 'skewered', title: 'Skewered', goal: 'material', moves: 2,
    brief: "The king's out front, the queen's hiding behind him. Line them up.",
    fen: '8/5ppp/B7/3k4/8/K7/1PP5/7q w - - 0 1',
    solution: ['a6b7', 'd5e5', 'b7h1'],
  },
  {
    id: 'the-ladder', title: 'The Ladder', goal: 'mate', moves: 2,
    brief: 'Two rooks, one fugitive. Walk him up the fire escape.',
    fen: '8/3k4/R7/7R/1p6/8/8/6K1 w - - 0 1',
    solution: ['h5h7', 'd7d8', 'a6a8'],
  },
  {
    id: 'desperate-measures', title: 'Desperate Measures', goal: 'mate', moves: 2,
    brief: 'Sometimes you have to give up the queen to close the case.',
    fen: '2rr2k1/5ppp/8/8/8/8/3Q1PPP/3R2K1 w - - 0 1',
    solution: ['d2d8', 'c8d8', 'd1d8'],
  },
  {
    id: 'philidors-ghost', title: "Philidor's Ghost", goal: 'mate', moves: 2,
    brief: 'A two-hundred-year-old trick. Offer the queen; let the knight finish the job.',
    fen: 'r6k/6pp/7N/3Q4/8/8/5PPP/6K1 w - - 0 1',
    solution: ['d5g8', 'a8g8', 'h6f7'],
  },
  {
    id: 'marshals-badge', title: "The Marshal's Badge", goal: 'mate', moves: 1, featured: 'M',
    brief: 'The Marshal strides three squares — then only one on his next. Up close, one is all he needs. Mind who has your back.',
    fen: '6kr/5ppp/8/2M5/8/B7/5PPP/6K1 w - - 0 1',
    solution: ['c5f8'],
  },
  {
    id: 'stampede', title: 'Stampede', goal: 'mate', moves: 1, featured: 'C',
    brief: "The Cavalry doesn't go around. It goes through. Nobody can step in its way — they just get trampled.",
    fen: '7k/4bppp/8/8/1n6/8/5PPP/6K1 w - - 0 1',
    extra: [{ type: 'C', color: 'w', squares: ['e6', 'f6'] }],
    solution: ['e6f6>e8f8'],
  },
];
