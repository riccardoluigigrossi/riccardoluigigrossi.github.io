// The character grid the page's ASCII lives on: the creature's snake, the weather
// and the game previews all put one glyph per 24px cell, in the page's own font.

export const CELL = 24;
const FONT_FAMILY = "'Inter:Medium', sans-serif";

export function styleCell(el: HTMLElement, color: string) {
  const s = el.style;
  s.width = `${CELL}px`;
  s.height = `${CELL}px`;
  s.display = 'flex';
  s.alignItems = 'center';
  s.justifyContent = 'center';
  s.fontFamily = FONT_FAMILY;
  s.fontWeight = '500';
  s.fontSize = '19px';
  s.lineHeight = '1';
  s.color = color;
  s.pointerEvents = 'none';
}

// Same pace as the creature.
const TICK_MS = 60;

export type Grid = { cols: number; rows: number };
export type Glyph = { r: number; c: number; ch: string };

// A little simulation that advances one tick at a time and lists what to draw.
export type Sky = { tick: (t: number) => Glyph[] };

export type RunOptions = {
  container: HTMLElement;
  grid: Grid;
  // Cells to leave empty, like the ones text sits in.
  blocked: Set<string>;
  color: string;
};

// Draws a sky inside `container` (positioned; cell 0:0 is its top-left corner)
// and returns a function that removes it at once.
export function runSky({ container, grid, blocked, color, sky }: RunOptions & { sky: Sky }): () => void {
  const pool: HTMLSpanElement[] = [];
  let t = 0;
  const draw = () => {
    const glyphs = sky
      .tick(t++)
      .filter(
        (g) =>
          g.r >= 0 && g.r < grid.rows && g.c >= 0 && g.c < grid.cols && !blocked.has(`${g.r}:${g.c}`),
      );
    while (pool.length < glyphs.length) {
      const el = document.createElement('span');
      styleCell(el, color);
      el.style.position = 'absolute';
      container.appendChild(el);
      pool.push(el);
    }
    pool.forEach((el, i) => {
      const g = glyphs[i];
      el.style.display = g ? 'flex' : 'none';
      if (!g) return;
      el.style.left = `${g.c * CELL}px`;
      el.style.top = `${g.r * CELL}px`;
      if (el.textContent !== g.ch) el.textContent = g.ch;
    });
  };
  draw();
  const id = window.setInterval(draw, TICK_MS);
  return () => {
    window.clearInterval(id);
    for (const el of pool) el.remove();
  };
}
