// While the tab is in the background, a tiny snake plays in its title and
// favicon. Background tabs only get about one timer tick per second, which
// happens to be roughly Nokia speed.

const TRACK = 12; // title cells
const GRID = 8; // favicon is 8x8 cells of 4px
const FRAME_MS = 500;
const MIN_LEN = 3;
const MAX_LEN = 6;

// The favicon snake runs laps around the edge of the icon.
const PERIMETER: [number, number][] = [];
for (let c = 0; c < GRID; c++) PERIMETER.push([0, c]);
for (let r = 1; r < GRID; r++) PERIMETER.push([r, GRID - 1]);
for (let c = GRID - 2; c >= 0; c--) PERIMETER.push([GRID - 1, c]);
for (let r = GRID - 2; r > 0; r--) PERIMETER.push([r, 0]);

export function installTabSnake(): () => void {
  const icons = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GRID * 4;
  const ctx = canvas.getContext('2d');

  let saved: { title: string; hrefs: string[] } | null = null;
  let timer = 0;
  let head = 0;
  let len = MIN_LEN;
  let food = 7;

  const frame = () => {
    head++;
    // Same position drives both: a cell on the title track and a step on the icon's lap.
    const t = head % TRACK;
    if (t === food) {
      len = len >= MAX_LEN ? MIN_LEN : len + 1;
      do food = Math.floor(Math.random() * TRACK);
      while (food === t);
    }

    const cells = Array.from({ length: TRACK }, () => '.');
    for (let i = 0; i < len; i++) cells[(head - i + TRACK * 4) % TRACK] = '#';
    cells[food] = '@';
    document.title = cells.join('');

    if (!ctx) return;
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = dark ? '#fff' : '#000';
    const lap = head % PERIMETER.length;
    for (let i = 0; i < len + 2; i++) {
      const [r, c] = PERIMETER[(lap - i + PERIMETER.length) % PERIMETER.length];
      ctx.fillRect(c * 4, r * 4, 4, 4);
    }
    ctx.fillRect(3 * 4 + 1, 3 * 4 + 1, 6, 6); // the food, in the middle
    const url = canvas.toDataURL('image/png');
    for (const icon of icons) icon.href = url;
  };

  const start = () => {
    if (saved) return;
    saved = { title: document.title, hrefs: icons.map((i) => i.href) };
    frame();
    timer = window.setInterval(frame, FRAME_MS);
  };

  const stop = () => {
    window.clearInterval(timer);
    if (!saved) return;
    document.title = saved.title;
    icons.forEach((icon, i) => (icon.href = saved!.hrefs[i]));
    saved = null;
  };

  const onVisibility = () => (document.hidden ? start() : stop());
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    stop();
  };
}
