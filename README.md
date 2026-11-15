# Noir Chess (MVP)

A single-player chess game with a film-noir look. Win 5-minute games against the AI or crack puzzle "case files" to earn XP. Level up to unlock new pieces that replace the traditional ones in your army.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine, AI, puzzle and progression tests
npm run build    # type-check + production build into dist/
```

## How it plays

- **Take a Case:** a 5|0 game against the AI. You can play White, Black or a coin toss, and your color is always at the bottom of the board. There are three opponents: Rookie, Detective and Inspector.
- **Case Files:** 10 hand-made puzzles (mate-in-1/2 and win-material). Mate puzzles accept any move that still forces mate in time. Other puzzles follow a scripted line.
- **Evidence Locker:** choose your army. One choice applies to both flanks.
- **XP:**
  - Wins earn 100 / 150 / 200 XP, depending on the opponent.
  - Draws earn 40 and losses earn 10.
  - A puzzle earns 50 the first time you solve it and 10 after that.
  - Reaching level *n+1* takes 150·*n* XP.
- **Unlocks:** the Marshal at level 3 and the Cavalry at level 5. Detective and Inspector opponents may field your unlocked pieces too.

### Custom pieces

| Piece | Replaces | Rules |
|---|---|---|
| **Marshal** | both knights | Moves like a queen (no jumping). Its range alternates on each of its moves: up to 3 squares, then exactly 1, then up to 3 again. It starts on a 3. The badge shows its next range. |
| **Cavalry** | each rook + knight pair | Occupies two adjacent squares. It slides up to 2 squares orthogonally, keeping its shape, and **tramples** every enemy on the squares it passes over or lands on. Friendly pieces block it. It can also **pivot** 90° around either of its squares. Capturing either square removes it. Enemies can't block it, so a king anywhere on its route is in check. No castling. |

When a Cavalry move is ambiguous (several routes share a target square), a chooser pops up. Hovering previews the landing spot and marks trampled pieces with a red ✕.

## Code map

```
src/engine/   rules engine — board state, make/undo, move generation, check/mate/draws
  pieces/     one PieceDef per piece (generate + attacks); add new pieces here + register them
src/ai/       negamax α-β search with quiescence, runs in a Web Worker
src/game/     match controller, chess clock, puzzle runner, XP/levels/unlocks, save (localStorage)
src/data/     puzzle definitions
src/ui/       canvas board, vector piece art, screens, noir theme
tests/        perft suites (standard chess correctness), custom pieces, AI, puzzles, progression
```

To add a new piece:
1. Write a `PieceDef` in `src/engine/pieces/`.
2. Register it in `registry.ts`.
3. Add its art to `src/ui/pieceArt.ts` and its rules text to `src/ui/pieceInfo.ts`.
4. Add a loadout in `src/engine/loadouts.ts` and an unlock in `src/game/progression.ts`.
