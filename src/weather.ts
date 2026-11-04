import { CELL, runSky, type Glyph, type Grid, type RunOptions, type Sky } from './grid';

// The sky a city actually has right now, drawn on the same character grid as the
// creature: one glyph per cell, moving a whole cell at a time, in the page's font.
// Glyphs pass behind lines of text, so the page stays readable.

export const WEATHER_KINDS = [
  'sun',
  'sun-clouds',
  'clouds',
  'stars',
  'stars-clouds',
  'fog',
  'rain',
  'snow',
] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];

// Open-Meteo reports WMO weather codes. Every sky has a drawing: drizzle, rain,
// showers and thunder are all just rain here.
export function weatherKind(code: number | null, isDay: boolean | null): WeatherKind | null {
  if (code === null) return null;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (code === 3) return 'clouds';
  if (code === 2) return isDay === false ? 'stars-clouds' : isDay ? 'sun-clouds' : 'clouds';
  if (code <= 1) return isDay === false ? 'stars' : isDay ? 'sun' : null;
  return null;
}

// daylight: how far through the city's day it is, 0 at sunrise and 1 at sunset.
// topBand: on phones the text fills the width, so the sun and the few clouds of a
// partly cloudy sky keep to the strip above it.
// blocked: the cells text sits in, which the sun climbs over rather than hide behind.
type SkyOptions = { daylight: number; topBand: boolean; blocked: Set<string> };

function falling(
  { cols, rows }: Grid,
  { ch, density, every, drift }: { ch: string; density: number; every: number; drift: number },
): Sky {
  // density: share of cells holding a glyph; every: ticks per one-cell fall.
  const flakes: { r: number; c: number; phase: number }[] = [];
  const add = (r: number) =>
    flakes.push({ r, c: Math.floor(Math.random() * cols), phase: Math.floor(Math.random() * every) });
  // Start with the screen already full, so even a short hover sees the weather.
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (Math.random() < density) add(r);
  const spawnPerTick = (density * cols) / every;
  let carry = 0;
  return {
    tick: (t) => {
      for (let i = flakes.length - 1; i >= 0; i--) {
        const f = flakes[i];
        if ((t + f.phase) % every !== 0) continue;
        f.r++;
        if (drift && Math.random() < drift) f.c = (f.c + (Math.random() < 0.5 ? -1 : 1) + cols) % cols;
        if (f.r >= rows) flakes.splice(i, 1);
      }
      for (carry += spawnPerTick; carry >= 1; carry--) add(0);
      return flakes.map((f) => ({ r: f.r, c: f.c, ch }));
    },
  };
}

function fog({ cols, rows }: Grid): Sky {
  // A few horizontal banks of ~, drifting sideways a cell at a time.
  const banks: { r: number; cells: boolean[]; dir: number; every: number }[] = [];
  for (let r = 1 + Math.floor(Math.random() * 3); r < rows; r += 3 + Math.floor(Math.random() * 3)) {
    const cells: boolean[] = [];
    while (cells.length < cols) {
      const run = 2 + Math.floor(Math.random() * 6);
      const gap = 1 + Math.floor(Math.random() * 5);
      for (let i = 0; i < run; i++) cells.push(true);
      for (let i = 0; i < gap; i++) cells.push(false);
    }
    cells.length = cols;
    banks.push({ r, cells, dir: banks.length % 2 ? -1 : 1, every: 5 + Math.floor(Math.random() * 4) });
  }
  return {
    tick: (t) => {
      const out: Glyph[] = [];
      for (const b of banks) {
        if (t % b.every === 0) {
          if (b.dir > 0) b.cells.unshift(b.cells.pop()!);
          else b.cells.push(b.cells.shift()!);
        }
        b.cells.forEach((on, c) => on && out.push({ r: b.r, c, ch: '~' }));
      }
      return out;
    },
  };
}

function stars({ cols, rows }: Grid, density = 0.03): Sky {
  // Fixed points that now and then twinkle . + * + .
  const TWINKLE = ['+', '+', '+', '*', '*', '*', '+', '+', '+'];
  const list: { r: number; c: number; at: number }[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (Math.random() < density) list.push({ r, c, at: -1 });
  return {
    tick: (t) =>
      list.map((s) => {
        if (s.at < 0 && Math.random() < 0.006) s.at = t;
        const k = t - s.at;
        if (s.at >= 0 && k >= TWINKLE.length) s.at = -1;
        return { r: s.r, c: s.c, ch: s.at >= 0 ? TWINKLE[k] : '.' };
      }),
  };
}

function sun({ cols, rows }: Grid, { daylight, topBand, blocked }: SkyOptions): Sky {
  // Where the sun really is in that city's day, with the screen as the sky: low on
  // the left at sunrise, top of the screen at midday, low on the right at sunset.
  // In the top band it only travels left to right, along the strip above the text.
  // Where the arc would put it behind text, it rises until it's clear.
  const p = Math.min(0.97, Math.max(0.03, daylight));
  const c = Math.round(1 + p * (cols - 3));
  let r = topBand ? 1 : Math.round(1 + (1 - Math.sin(Math.PI * p)) * (rows - 3));
  while (r > 1 && blocked.has(`${r}:${c}`)) r--;
  const rays: [number, number, string][] = [
    [0, 1, '-'],
    [0, -1, '-'],
    [1, 0, '|'],
    [-1, 0, '|'],
  ];
  return {
    tick: (t) => {
      const long = Math.floor(t / 8) % 2 === 0;
      const out: Glyph[] = [{ r, c, ch: 'O' }];
      for (const [dr, dc, ch] of rays) {
        out.push({ r: r + dr, c: c + dc, ch });
        if (long) out.push({ r: r + 2 * dr, c: c + 2 * dc, ch });
      }
      return out;
    },
  };
}

// Hand-drawn clouds, one glyph per cell. A space is open sky; x is the cloud's
// blank inside, which hides whatever is behind it (the sun, a star).
const CLOUD_SHAPES = [
  ['  .--.  ', '.(xxxx).', '(xxxxxx)', " '----' "],
  ['   .-.  .-.   ', ' .(xxx)(xxx). ', '(xxxxxxxxxxxx)', " '----------' "],
  [' .-. ', '(xxx)', " '-' "],
];
// Flat enough for the strip above the text on phones.
const BAND_CLOUD = [' .-..-. ', '(______)'];

function clouds(
  { cols, rows }: Grid,
  { reach, spacing, topBand = false }: { reach: number; spacing: number; topBand?: boolean },
): Sky {
  // Clouds in lanes five rows tall, down to `reach` of the screen, about one per
  // `spacing` columns, each drifting right at its own slow pace and coming back
  // round from the left. In the top band: one flat lane along the strip above the text.
  const list: { shape: string[]; r: number; x: number; every: number }[] = [];
  const lanes = topBand ? 1 : Math.max(1, Math.floor((rows * reach) / 5));
  const perLane = Math.max(1, Math.round(cols / spacing));
  for (let lane = 0; lane < lanes; lane++) {
    for (let i = 0; i < perLane; i++) {
      const shape = topBand
        ? BAND_CLOUD
        : CLOUD_SHAPES[Math.floor(Math.random() * CLOUD_SHAPES.length)];
      list.push({
        shape,
        r: topBand ? 0 : lane * 5 + Math.floor(Math.random() * (6 - shape.length)),
        // Lanes start anywhere, some still off screen; the band's clouds always start
        // in view, side by side.
        x: topBand
          ? Math.floor((i * cols) / perLane + Math.random() * Math.max(1, cols / perLane - shape[0].length))
          : Math.floor(((i + Math.random() * 0.7) * (cols + 14)) / perLane) - 14,
        every: 10 + Math.floor(Math.random() * 10),
      });
    }
  }
  return {
    tick: (t) => {
      const out: Glyph[] = [];
      for (const k of list) {
        const w = k.shape[0].length;
        if (t > 0 && t % k.every === 0 && ++k.x > cols) k.x = -w;
        k.shape.forEach((line, dr) =>
          [...line].forEach((ch, dc) => {
            if (ch !== ' ') out.push({ r: k.r + dr, c: k.x + dc, ch: ch === 'x' ? ' ' : ch });
          }),
        );
      }
      return out;
    },
  };
}

// Later skies are drawn over earlier ones, cell by cell; blank glyphs only hide.
function layered(...skies: Sky[]): Sky {
  return {
    tick: (t) => {
      const at = new Map<string, Glyph>();
      for (const sky of skies) for (const g of sky.tick(t)) at.set(`${g.r}:${g.c}`, g);
      return [...at.values()].filter((g) => g.ch !== ' ');
    },
  };
}

const FEW_CLOUDS = { reach: 0.45, spacing: 40 };
const OVERCAST = { reach: 0.95, spacing: 18 };

const SKIES: Record<WeatherKind, (g: Grid, o: SkyOptions) => Sky> = {
  sun,
  // The sun stays in front, so a partly cloudy day never reads as an overcast one.
  'sun-clouds': (g, o) => layered(clouds(g, { ...FEW_CLOUDS, topBand: o.topBand }), sun(g, o)),
  // On phones most of the sky is behind text, so overcast also fills the top band.
  clouds: (g, o) =>
    layered(clouds(g, OVERCAST), ...(o.topBand ? [clouds(g, { ...OVERCAST, spacing: 8, topBand: true })] : [])),
  stars: (g) => stars(g),
  'stars-clouds': (g, o) => layered(stars(g, 0.02), clouds(g, { ...FEW_CLOUDS, topBand: o.topBand })),
  fog,
  rain: (g) => falling(g, { ch: '|', density: 0.05, every: 1, drift: 0 }),
  snow: (g) => falling(g, { ch: '*', density: 0.035, every: 4, drift: 0.3 }),
};

// Cells covered by text inside `root`, measured from `origin` (the grid's top-left).
export function textCells(
  root: Element,
  { cols, rows }: Grid,
  origin: { left: number; top: number } = { left: 0, top: 0 },
): Set<string> {
  const cells = new Set<string>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.nodeValue?.trim()) continue;
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (!rect.width || !rect.height) continue;
      const c0 = Math.max(0, Math.floor((rect.left - origin.left) / CELL));
      const c1 = Math.min(cols - 1, Math.floor((rect.right - 1 - origin.left) / CELL));
      const r0 = Math.max(0, Math.floor((rect.top - origin.top) / CELL));
      const r1 = Math.min(rows - 1, Math.floor((rect.bottom - 1 - origin.top) / CELL));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells.add(`${r}:${c}`);
    }
  }
  return cells;
}

// Runs a city's sky inside `container` and returns a function that removes it at once.
export function startWeather({
  kind,
  daylight = 0.5,
  topBand = false,
  ...run
}: RunOptions & { kind: WeatherKind; daylight?: number; topBand?: boolean }): () => void {
  return runSky({ ...run, sky: SKIES[kind](run.grid, { daylight, topBand, blocked: run.blocked }) });
}
