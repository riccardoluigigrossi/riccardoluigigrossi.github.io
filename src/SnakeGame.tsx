import { useEffect, useMemo, useRef, useState } from 'react';

const CELL = 24;
const TICK_MS = 120;
const SNAKE_CHAR = '#';
const FOOD_CHAR = '@';
const FONT_FAMILY = "'Inter:Medium', sans-serif";
const SWIPE_THRESHOLD = 24;

function isHoverCapable(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

type Dir = 'up' | 'down' | 'left' | 'right';
type Cell = { r: number; c: number };
type Dims = { rows: number; cols: number };
type Rect = { rowMin: number; rowMax: number; colMin: number; colMax: number };

const DELTA: Record<Dir, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

const KEY_DIR: Record<string, Dir> = {
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

function isOpposite(a: Dir, b: Dir) {
  return (
    (a === 'up' && b === 'down') ||
    (a === 'down' && b === 'up') ||
    (a === 'left' && b === 'right') ||
    (a === 'right' && b === 'left')
  );
}

function readDims(): Dims {
  return {
    rows: Math.max(8, Math.floor(window.innerHeight / CELL)),
    cols: Math.max(8, Math.floor(window.innerWidth / CELL)),
  };
}

function hudRects(dims: Dims): Rect[] {
  return [
    {
      rowMin: 0,
      rowMax: Math.min(1, dims.rows - 1),
      colMin: 0,
      colMax: Math.min(8, dims.cols - 1),
    },
    {
      rowMin: 0,
      rowMax: Math.min(1, dims.rows - 1),
      colMin: Math.max(0, dims.cols - 4),
      colMax: dims.cols - 1,
    },
  ];
}

function readForbidden(dims: Dims): Rect[] {
  const rects = hudRects(dims);
  if (!isHoverCapable()) return rects;
  const el = document.querySelector('[data-snake-text-box]') as HTMLElement | null;
  if (!el) return rects;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return rects;
  rects.push({
    rowMin: Math.max(0, Math.floor(r.top / CELL)),
    rowMax: Math.min(dims.rows - 1, Math.floor((r.bottom - 1) / CELL)),
    colMin: Math.max(0, Math.floor(r.left / CELL)),
    colMax: Math.min(dims.cols - 1, Math.floor((r.right - 1) / CELL)),
  });
  return rects;
}

function inAnyRect(cell: Cell, rects: Rect[]): boolean {
  return rects.some(
    (r) =>
      cell.r >= r.rowMin &&
      cell.r <= r.rowMax &&
      cell.c >= r.colMin &&
      cell.c <= r.colMax,
  );
}

function spawnFood(snake: Cell[], dims: Dims, forbidden: Rect[]): Cell {
  const occupied = new Set(snake.map((s) => `${s.r}:${s.c}`));
  for (let i = 0; i < 500; i++) {
    const r = Math.floor(Math.random() * dims.rows);
    const c = Math.floor(Math.random() * dims.cols);
    const cell = { r, c };
    if (occupied.has(`${r}:${c}`)) continue;
    if (inAnyRect(cell, forbidden)) continue;
    return cell;
  }
  for (let r = 0; r < dims.rows; r++) {
    for (let c = 0; c < dims.cols; c++) {
      const cell = { r, c };
      if (occupied.has(`${r}:${c}`)) continue;
      if (inAnyRect(cell, forbidden)) continue;
      return cell;
    }
  }
  for (let r = 0; r < dims.rows; r++) {
    for (let c = 0; c < dims.cols; c++) {
      if (!occupied.has(`${r}:${c}`)) return { r, c };
    }
  }
  return { r: 0, c: 0 };
}

type State = {
  snake: Cell[];
  dir: Dir;
  pendingDir: Dir | null;
  food: Cell;
  dead: boolean;
  score: number;
  hasMoved: boolean;
};

function initialState(dims: Dims, forbidden: Rect[]): State {
  const r = Math.floor(dims.rows / 2);
  const c = Math.floor(dims.cols / 2);
  const snake: Cell[] = [
    { r, c },
    { r, c: c - 1 },
    { r, c: c - 2 },
  ];
  return {
    snake,
    dir: 'right',
    pendingDir: null,
    food: spawnFood(snake, dims, forbidden),
    dead: false,
    score: 0,
    hasMoved: false,
  };
}

function step(s: State, dims: Dims, forbidden: Rect[]): State {
  if (s.dead) return s;
  let dir = s.dir;
  if (s.pendingDir && !isOpposite(s.pendingDir, s.dir)) dir = s.pendingDir;
  const head = s.snake[0];
  const [dr, dc] = DELTA[dir];
  const next: Cell = {
    r: (head.r + dr + dims.rows) % dims.rows,
    c: (head.c + dc + dims.cols) % dims.cols,
  };
  const eating = next.r === s.food.r && next.c === s.food.c;
  const body = eating ? s.snake : s.snake.slice(0, -1);
  if (body.some((b) => b.r === next.r && b.c === next.c)) {
    return { ...s, dir, pendingDir: null, dead: true };
  }
  const newSnake = [next, ...body];
  return {
    snake: newSnake,
    dir,
    pendingDir: null,
    food: eating ? spawnFood(newSnake, dims, forbidden) : s.food,
    dead: false,
    score: eating ? s.score + 1 : s.score,
    hasMoved: s.hasMoved,
  };
}

export default function SnakeGame() {
  const hoverCapable = useMemo(() => isHoverCapable(), []);
  const [dims, setDims] = useState<Dims>(() => readDims());
  const dimsRef = useRef(dims);
  dimsRef.current = dims;
  const forbiddenRef = useRef<Rect[]>(readForbidden(dims));
  const [state, setState] = useState<State>(() =>
    initialState(dims, forbiddenRef.current),
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (hoverCapable) return;
    let start: { x: number; y: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      start = null;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (Math.max(absX, absY) < SWIPE_THRESHOLD) return;
      const dir: Dir =
        absX > absY ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      setState((s) => ({ ...s, pendingDir: dir, hasMoved: true }));
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [hoverCapable]);

  useEffect(() => {
    const refresh = () => {
      const d = readDims();
      setDims(d);
      forbiddenRef.current = readForbidden(d);
      setState((s) => ({
        ...s,
        snake: s.snake.map((c) => ({
          r: ((c.r % d.rows) + d.rows) % d.rows,
          c: ((c.c % d.cols) + d.cols) % d.cols,
        })),
        food: {
          r: ((s.food.r % d.rows) + d.rows) % d.rows,
          c: ((s.food.c % d.cols) + d.cols) % d.cols,
        },
      }));
    };
    const refreshForbiddenOnly = () => {
      forbiddenRef.current = readForbidden(dimsRef.current);
    };
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refreshForbiddenOnly, { passive: true });
    const el = document.querySelector('[data-snake-text-box]');
    let ro: ResizeObserver | null = null;
    if (el && 'ResizeObserver' in window) {
      ro = new ResizeObserver(refreshForbiddenOnly);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refreshForbiddenOnly);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setState((s) => step(s, dimsRef.current, forbiddenRef.current));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        window.location.hash = '';
        return;
      }
      if (k === 'r') {
        setState((s) =>
          s.dead ? initialState(dimsRef.current, forbiddenRef.current) : s,
        );
        return;
      }
      const dir = KEY_DIR[k];
      if (dir) {
        e.preventDefault();
        setState((s) => ({ ...s, pendingDir: dir, hasMoved: true }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cellStyle = (cell: Cell): React.CSSProperties => ({
    position: 'absolute',
    top: cell.r * CELL,
    left: cell.c * CELL,
    width: CELL,
    height: CELL,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: FONT_FAMILY,
    fontWeight: 500,
    fontSize: 19,
    lineHeight: 1,
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: hoverCapable ? 'none' : 'auto',
        zIndex: 200,
        fontFamily: FONT_FAMILY,
      }}
      className={
        hoverCapable
          ? 'text-black dark:text-white'
          : 'bg-white dark:bg-black text-black dark:text-white'
      }
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        {state.snake.map((c, i) => (
          <div key={i} style={cellStyle(c)}>
            {SNAKE_CHAR}
          </div>
        ))}
        <div style={cellStyle(state.food)}>{FOOD_CHAR}</div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 24,
          fontSize: 19,
        }}
      >
        {state.hasMoved
          ? `Score: ${state.score}`
          : hoverCapable
            ? 'Control with WASD'
            : 'Swipe to control'}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 24,
          fontSize: 19,
          pointerEvents: 'auto',
        }}
      >
        <a href="#" className="underline">
          [Close]
        </a>
      </div>

      {state.dead && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
        >
          <div
            className="bg-white dark:bg-black"
            onClick={() =>
              setState((s) =>
                s.dead ? initialState(dimsRef.current, forbiddenRef.current) : s,
              )
            }
            style={{
              textAlign: 'center',
              padding: '24px 32px',
              border: '1px solid currentColor',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>Game Over</div>
            <div style={{ fontSize: 19, marginBottom: 24 }}>
              Score: {state.score}
            </div>
            <div style={{ fontSize: 19 }}>
              {hoverCapable ? 'Press R to restart' : 'Tap to restart'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
