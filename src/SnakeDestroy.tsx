import { useEffect } from 'react';

const CELL = 24;
const TICK_MS = 60;
const SNAKE_CHAR = '#';
const FONT_FAMILY = "'Inter:Medium', sans-serif";
const EXIT_PAD_CELLS = 4;

type Dir = 'up' | 'down' | 'left' | 'right';
type Cell = { r: number; c: number };
type WordTarget = {
  el: HTMLSpanElement;
  cells: Cell[];
  center: Cell;
};

const DELTA: Record<Dir, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

const OPP: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function wrap(n: number, mod: number) {
  return ((n % mod) + mod) % mod;
}

export default function SnakeDestroy({
  targetSelector = '[data-snake-text-box]',
  epicenter,
  initialBody,
}: {
  targetSelector?: string;
  epicenter?: { x: number; y: number } | null;
  initialBody?: Cell[] | null;
}) {
  useEffect(() => {
    const root = document.querySelector(targetSelector) as HTMLElement | null;
    if (!root) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cols = Math.max(8, Math.floor(vw / CELL));
    const rows = Math.max(8, Math.floor(vh / CELL));
    const ex = epicenter?.x ?? vw / 2;
    const ey = epicenter?.y ?? vh / 2;

    const createdWordEls: HTMLSpanElement[] = [];
    const words: WordTarget[] = [];

    const effectiveOpacity = (el: Element): number => {
      let op = 1;
      let cur: Element | null = el;
      const stop = root.parentElement;
      while (cur && cur !== stop) {
        const v = parseFloat(window.getComputedStyle(cur).opacity);
        if (!Number.isNaN(v)) op *= v;
        cur = cur.parentElement;
      }
      return op;
    };

    const processedNodes = new WeakSet<Text>();

    const addBlock = (
      el: HTMLSpanElement,
      rect: { left: number; top: number; right: number; bottom: number; width: number; height: number },
    ) => {
      const cMin = Math.max(0, Math.floor(rect.left / CELL));
      const cMax = Math.min(cols - 1, Math.floor((rect.right - 1) / CELL));
      const rMin = Math.max(0, Math.floor(rect.top / CELL));
      const rMax = Math.min(rows - 1, Math.floor((rect.bottom - 1) / CELL));
      if (cMax < cMin || rMax < rMin) return;
      const cells: Cell[] = [];
      for (let rr = rMin; rr <= rMax; rr++) {
        for (let cc = cMin; cc <= cMax; cc++) {
          cells.push({ r: rr, c: cc });
        }
      }
      const center: Cell = {
        r: Math.max(0, Math.min(rows - 1, Math.floor((rect.top + rect.height / 2) / CELL))),
        c: Math.max(0, Math.min(cols - 1, Math.floor((rect.left + rect.width / 2) / CELL))),
      };
      words.push({ el, cells, center });
    };

    const styleFromTemplate = (
      span: HTMLSpanElement,
      style: CSSStyleDeclaration,
      rect: { left: number; top: number },
      isUnderlined: boolean,
      ancestorOpacity: number,
    ) => {
      const s = span.style;
      s.position = 'fixed';
      s.left = `${rect.left}px`;
      s.top = `${rect.top}px`;
      s.pointerEvents = 'none';
      s.whiteSpace = 'nowrap';
      s.fontFamily = style.fontFamily;
      s.fontSize = style.fontSize;
      s.fontWeight = style.fontWeight;
      s.fontStyle = style.fontStyle;
      s.lineHeight = style.lineHeight;
      s.letterSpacing = style.letterSpacing;
      s.color = style.color;
      if (ancestorOpacity < 1) s.opacity = String(ancestorOpacity);
      s.zIndex = '50';
      s.transition = 'opacity 160ms ease-out';
      if (isUnderlined) {
        s.textDecorationLine = 'underline';
        s.textDecorationColor = style.textDecorationColor;
      }
    };

    const links = Array.from(root.querySelectorAll('a')) as HTMLAnchorElement[];
    for (const link of links) {
      if (link.closest('[data-snake-skip]')) continue;
      const range = document.createRange();
      range.selectNodeContents(link);
      const rects = Array.from(range.getClientRects()).filter(
        (r) => r.width > 0 && r.height > 0,
      );
      if (rects.length !== 1) continue;
      const text = (link.textContent ?? '').trim();
      if (!text) continue;

      const lw = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
      let inner: Node | null;
      while ((inner = lw.nextNode())) processedNodes.add(inner as Text);

      const style = window.getComputedStyle(link);
      const isUnderlined = style.textDecorationLine.includes('underline');
      const span = document.createElement('span');
      span.textContent = text;
      styleFromTemplate(span, style, rects[0], isUnderlined, effectiveOpacity(link));
      document.body.appendChild(span);
      createdWordEls.push(span);
      addBlock(span, rects[0]);
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (processedNodes.has(node as Text)) continue;
      const text = node.nodeValue ?? '';
      if (!text.trim()) continue;
      const parent = (node as Text).parentElement;
      if (!parent) continue;
      if (parent.closest('[data-snake-skip]')) continue;
      const parentRect = parent.getBoundingClientRect();
      if (parentRect.width === 0 || parentRect.height === 0) continue;
      const style = window.getComputedStyle(parent);
      const isUnderlined = style.textDecorationLine.includes('underline');

      const ancestorOpacity = effectiveOpacity(parent);
      const wordRegex = /\S+/g;
      let match: RegExpExecArray | null;
      while ((match = wordRegex.exec(text)) !== null) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const rects = range.getClientRects();
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i];
          if (r.width === 0 || r.height === 0) continue;
          const span = document.createElement('span');
          span.textContent = match[0];
          styleFromTemplate(span, style, r, isUnderlined, ancestorOpacity);
          document.body.appendChild(span);
          createdWordEls.push(span);
          addBlock(span, r);
        }
      }
    }

    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]];
    }

    const prevVisibility = root.style.visibility;
    root.style.visibility = 'hidden';
    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const epCell: Cell = {
      r: Math.max(0, Math.min(rows - 1, Math.floor(ey / CELL))),
      c: Math.max(0, Math.min(cols - 1, Math.floor(ex / CELL))),
    };
    let dir: Dir = 'right';
    const clamp = (cell: Cell): Cell => ({
      r: Math.max(0, Math.min(rows - 1, cell.r)),
      c: Math.max(0, Math.min(cols - 1, cell.c)),
    });
    const snake: Cell[] =
      initialBody && initialBody.length > 0
        ? initialBody.map(clamp)
        : [
            { r: epCell.r, c: epCell.c },
            { r: epCell.r, c: wrap(epCell.c - 1, cols) },
            { r: epCell.r, c: wrap(epCell.c - 2, cols) },
          ];

    const snakeEls: HTMLSpanElement[] = [];
    const bodyColor = getComputedStyle(document.body).color;

    const makeSegment = (): HTMLSpanElement => {
      const el = document.createElement('span');
      const s = el.style;
      s.position = 'fixed';
      s.width = `${CELL}px`;
      s.height = `${CELL}px`;
      s.display = 'flex';
      s.alignItems = 'center';
      s.justifyContent = 'center';
      s.fontFamily = FONT_FAMILY;
      s.fontWeight = '500';
      s.fontSize = '19px';
      s.lineHeight = '1';
      s.color = bodyColor;
      s.zIndex = '200';
      s.pointerEvents = 'none';
      el.textContent = SNAKE_CHAR;
      document.body.appendChild(el);
      return el;
    };

    const positionSegment = (el: HTMLSpanElement, cell: Cell) => {
      el.style.left = `${cell.c * CELL}px`;
      el.style.top = `${cell.r * CELL}px`;
    };

    for (const seg of snake) {
      const el = makeSegment();
      positionSegment(el, seg);
      snakeEls.push(el);
    }

    let nextWordIdx = 0;
    let exiting = false;
    let exitDir: Dir = 'right';

    const pickDirToward = (target: Cell, current: Dir, head: Cell): Dir => {
      const dc = target.c - head.c;
      const dr = target.r - head.r;
      const horizFirst = Math.abs(dc) >= Math.abs(dr);
      const horizDir: Dir | null = dc > 0 ? 'right' : dc < 0 ? 'left' : null;
      const vertDir: Dir | null = dr > 0 ? 'down' : dr < 0 ? 'up' : null;
      const order: (Dir | null)[] = horizFirst
        ? [horizDir, vertDir]
        : [vertDir, horizDir];
      for (const d of order) {
        if (d && OPP[d] !== current) return d;
      }
      return current;
    };

    const pickExitDir = (head: Cell, current: Dir): Dir => {
      const candidates: { d: Dir; dist: number }[] = [
        { d: 'right', dist: cols - 1 - head.c },
        { d: 'left', dist: head.c },
        { d: 'down', dist: rows - 1 - head.r },
        { d: 'up', dist: head.r },
      ];
      candidates.sort((a, b) => a.dist - b.dist);
      for (const c of candidates) {
        if (OPP[c.d] !== current) return c.d;
      }
      return current;
    };

    const allOffscreen = (): boolean =>
      snake.every(
        (c) =>
          c.r < -EXIT_PAD_CELLS ||
          c.r > rows + EXIT_PAD_CELLS ||
          c.c < -EXIT_PAD_CELLS ||
          c.c > cols + EXIT_PAD_CELLS,
      );

    let intervalId = 0;
    const tick = () => {
      if (!exiting && nextWordIdx >= words.length) {
        exiting = true;
        exitDir = pickExitDir(snake[0], dir);
      }

      const nextDir = exiting
        ? exitDir
        : pickDirToward(words[nextWordIdx].center, dir, snake[0]);
      dir = nextDir;

      const [dr, dc] = DELTA[dir];
      const head = snake[0];
      const rawR = head.r + dr;
      const rawC = head.c + dc;
      const newHead: Cell = exiting
        ? { r: rawR, c: rawC }
        : { r: wrap(rawR, rows), c: wrap(rawC, cols) };

      let grew = false;
      if (!exiting && nextWordIdx < words.length) {
        const target = words[nextWordIdx];
        if (
          target.cells.some((cl) => cl.r === newHead.r && cl.c === newHead.c)
        ) {
          target.el.style.opacity = '0';
          const dying = target.el;
          window.setTimeout(() => dying.remove(), 200);
          nextWordIdx++;
          grew = true;
        }
      }

      snake.unshift(newHead);
      if (!grew) snake.pop();

      while (snakeEls.length < snake.length) snakeEls.push(makeSegment());
      while (snakeEls.length > snake.length) {
        const el = snakeEls.pop();
        el?.remove();
      }
      for (let i = 0; i < snake.length; i++) {
        positionSegment(snakeEls[i], snake[i]);
      }

      if (exiting && allOffscreen()) {
        window.clearInterval(intervalId);
        for (const el of snakeEls) el.remove();
        snakeEls.length = 0;
      }
    };

    intervalId = window.setInterval(tick, TICK_MS);

    return () => {
      window.clearInterval(intervalId);
      for (const el of createdWordEls) el.remove();
      for (const el of snakeEls) el.remove();
      root.style.visibility = prevVisibility;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [targetSelector]);

  return null;
}
