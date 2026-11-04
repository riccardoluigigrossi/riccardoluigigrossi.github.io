import type { Glyph, Grid, Sky } from './grid';

// The games playing themselves in a strip a couple of rows tall, like an arcade
// cabinet's attract mode, in the games' own characters: # for the snake and the
// player, @ for food and walls.

// One move every two grid ticks: 120ms, the real Snake's speed.
const STEP = 2;

// A snake doing laps of the strip's edge, eating and growing, then starting over.
export function snakePreview({ cols, rows }: Grid): Sky {
  const loop: [number, number][] = [];
  for (let c = 0; c < cols; c++) loop.push([0, c]);
  for (let r = 1; r < rows; r++) loop.push([r, cols - 1]);
  for (let c = cols - 2; c >= 0; c--) loop.push([rows - 1, c]);
  for (let r = rows - 2; r > 0; r--) loop.push([r, 0]);
  const L = loop.length;
  const START = 4;
  const MAX = Math.max(START + 1, Math.min(14, L - 4));

  let head = START - 1;
  let len = START;
  const placeFood = () => (head + 4 + Math.floor(Math.random() * (L - len - 4))) % L;
  let food = placeFood();

  return {
    tick: (t) => {
      if (t > 0 && t % STEP === 0) {
        head = (head + 1) % L;
        if (head === food) {
          len = len >= MAX ? START : len + 1;
          food = placeFood();
        }
      }
      const out: Glyph[] = [];
      for (let i = 0; i < len; i++) {
        const [r, c] = loop[(head - i + L) % L];
        out.push({ r, c, ch: '#' });
      }
      const [fr, fc] = loop[food];
      out.push({ r: fr, c: fc, ch: '@' });
      return out;
    },
  };
}

// A strip of @ walls with one winding way through; the # walks it left to right,
// waits a beat at the end, and a new maze is carved.
export function mazePreview({ cols, rows }: Grid): Sky {
  let path: [number, number][] = [];
  let open = new Set<string>();
  const carve = () => {
    path = [];
    let r = Math.floor(Math.random() * rows);
    for (let c = 0; c < cols; c++) {
      // Now and then the way turns up or down before carrying on.
      if (c > 0 && c < cols - 1 && Math.random() < 0.4) {
        const to = rows === 1 ? r : (r + 1 + Math.floor(Math.random() * (rows - 1))) % rows;
        while (r !== to) {
          path.push([r, c]);
          r += to > r ? 1 : -1;
        }
      }
      path.push([r, c]);
    }
    open = new Set(path.map(([pr, pc]) => `${pr}:${pc}`));
  };
  carve();

  const PAUSE = 8;
  let at = 0;
  let waited = 0;
  return {
    tick: (t) => {
      if (t > 0 && t % STEP === 0) {
        if (at < path.length - 1) at++;
        else if (++waited > PAUSE) {
          carve();
          at = 0;
          waited = 0;
        }
      }
      const out: Glyph[] = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) if (!open.has(`${r}:${c}`)) out.push({ r, c, ch: '@' });
      const [pr, pc] = path[at];
      out.push({ r: pr, c: pc, ch: '#' });
      return out;
    },
  };
}
