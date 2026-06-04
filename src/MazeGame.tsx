import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CELL = 24;
const PLAYER_CHAR = '#';
const WALL_CHAR = '@';
const FONT_FAMILY = "'Inter:Medium', sans-serif";
const SWIPE_THRESHOLD = 24;
const HEADER_ROWS = 2;
const SIDE_MIN_COLS = 10;

const MAZE_ASCII = ` _____ _____ _____ _____
|     |  _  |___  |   __|
| | | |     |  ___|   __|
|_|_|_|__|__|_____|_____|`;

const NARROW_QUERY = '(max-width: 600px)';

type Dir = 'up' | 'down' | 'left' | 'right';
type Edge = 'top' | 'bottom' | 'left' | 'right';
type Cell = { r: number; c: number };
type Dims = { rows: number; cols: number };
type Rect = { rowMin: number; rowMax: number; colMin: number; colMax: number };
type Bounds = { rowStart: number; rowEnd: number; colStart: number; colEnd: number };

type Maze = {
  gridStartR: number;
  gridEndR: number;
  gridStartC: number;
  gridEndC: number;
  wallCells: Set<string>;
  corridorCells: Set<string>;
  forbidden: Rect[];
  startCell: Cell;
  exitEdge: Edge;
};

type LayoutMode = 'split' | 'full';

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
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
};

const NEIGHBOR_OFFSETS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function isNarrowViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(NARROW_QUERY).matches;
}

function isHoverCapable(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function readDims(): Dims {
  const viewport = window.visualViewport;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;
  return {
    rows: Math.max(8, Math.floor(height / CELL)),
    cols: Math.max(8, Math.floor(width / CELL)),
  };
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

function readTextBoxRect(dims: Dims): Rect | null {
  const el = document.querySelector('[data-snake-text-box]') as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return {
    rowMin: Math.max(0, Math.floor(r.top / CELL)),
    rowMax: Math.min(dims.rows - 1, Math.floor((r.bottom - 1) / CELL)),
    colMin: Math.max(0, Math.floor(r.left / CELL)),
    colMax: Math.min(dims.cols - 1, Math.floor((r.right - 1) / CELL)),
  };
}

function computeLayout(
  dims: Dims,
  hoverCapable: boolean,
): { mode: LayoutMode; boundsList: Bounds[]; textBoxRect: Rect | null } {
  const fullBounds: Bounds = {
    rowStart: HEADER_ROWS,
    rowEnd: dims.rows - 1,
    colStart: 0,
    colEnd: dims.cols - 1,
  };
  if (!hoverCapable) {
    return { mode: 'full', boundsList: [fullBounds], textBoxRect: null };
  }
  const textBox = readTextBoxRect(dims);
  if (!textBox) {
    return { mode: 'full', boundsList: [fullBounds], textBoxRect: null };
  }
  const leftEnd = textBox.colMin - 1;
  const rightStart = textBox.colMax + 1;
  const leftWidth = leftEnd + 1;
  const rightWidth = dims.cols - rightStart;
  if (leftWidth < SIDE_MIN_COLS || rightWidth < SIDE_MIN_COLS) {
    return { mode: 'full', boundsList: [fullBounds], textBoxRect: null };
  }
  return {
    mode: 'split',
    boundsList: [
      { rowStart: HEADER_ROWS, rowEnd: dims.rows - 1, colStart: 0, colEnd: leftEnd },
      {
        rowStart: HEADER_ROWS,
        rowEnd: dims.rows - 1,
        colStart: rightStart,
        colEnd: dims.cols - 1,
      },
    ],
    textBoxRect: textBox,
  };
}

function cellKey(r: number, c: number): string {
  return `${r}:${c}`;
}

function pickEdge(): Edge {
  const edges: Edge[] = ['top', 'bottom', 'left', 'right'];
  return edges[Math.floor(Math.random() * 4)];
}

function generateMaze(
  bounds: Bounds,
  forbidden: Rect[],
  corridorTextBoxRect: Rect | null,
): Maze {
  const gridStartR = bounds.rowStart;
  const gridStartC = bounds.colStart;
  const logicalRows = Math.max(2, Math.floor((bounds.rowEnd - bounds.rowStart) / 2));
  const logicalCols = Math.max(2, Math.floor((bounds.colEnd - bounds.colStart) / 2));
  const gridEndR = gridStartR + 2 * logicalRows;
  const gridEndC = gridStartC + 2 * logicalCols;

  const lcToGridR = (lr: number) => gridStartR + 1 + 2 * lr;
  const lcToGridC = (lc: number) => gridStartC + 1 + 2 * lc;
  const cellForbidden = (r: number, c: number) => inAnyRect({ r, c }, forbidden);
  const logicalBlocked = (lr: number, lc: number) =>
    cellForbidden(lcToGridR(lr), lcToGridC(lc));

  const wallCells = new Set<string>();
  for (let r = gridStartR; r <= gridEndR; r++) {
    for (let c = gridStartC; c <= gridEndC; c++) {
      if (cellForbidden(r, c)) continue;
      wallCells.add(cellKey(r, c));
    }
  }
  for (let lr = 0; lr < logicalRows; lr++) {
    for (let lc = 0; lc < logicalCols; lc++) {
      if (logicalBlocked(lr, lc)) continue;
      wallCells.delete(cellKey(lcToGridR(lr), lcToGridC(lc)));
    }
  }

  const findSeed = (): { lr: number; lc: number } | null => {
    for (let attempts = 0; attempts < 200; attempts++) {
      const lr = Math.floor(Math.random() * logicalRows);
      const lc = Math.floor(Math.random() * logicalCols);
      if (!logicalBlocked(lr, lc)) return { lr, lc };
    }
    for (let lr = 0; lr < logicalRows; lr++) {
      for (let lc = 0; lc < logicalCols; lc++) {
        if (!logicalBlocked(lr, lc)) return { lr, lc };
      }
    }
    return null;
  };

  const visited = new Set<string>();
  const carveFrom = (seed: { lr: number; lc: number }) => {
    const stack: { lr: number; lc: number }[] = [seed];
    visited.add(`${seed.lr}:${seed.lc}`);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const candidates = NEIGHBOR_OFFSETS.map(([dr, dc]) => ({
        lr: top.lr + dr,
        lc: top.lc + dc,
        dr,
        dc,
      })).filter(
        (n) =>
          n.lr >= 0 &&
          n.lr < logicalRows &&
          n.lc >= 0 &&
          n.lc < logicalCols &&
          !visited.has(`${n.lr}:${n.lc}`) &&
          !logicalBlocked(n.lr, n.lc),
      );
      if (candidates.length === 0) {
        stack.pop();
        continue;
      }
      const next = candidates[Math.floor(Math.random() * candidates.length)];
      const wallR = lcToGridR(top.lr) + next.dr;
      const wallC = lcToGridC(top.lc) + next.dc;
      if (!cellForbidden(wallR, wallC)) {
        wallCells.delete(cellKey(wallR, wallC));
      }
      visited.add(`${next.lr}:${next.lc}`);
      stack.push({ lr: next.lr, lc: next.lc });
    }
  };

  const firstSeed = findSeed();
  if (firstSeed) carveFrom(firstSeed);
  for (let lr = 0; lr < logicalRows; lr++) {
    for (let lc = 0; lc < logicalCols; lc++) {
      if (logicalBlocked(lr, lc)) continue;
      if (visited.has(`${lr}:${lc}`)) continue;
      carveFrom({ lr, lc });
    }
  }

  const corridorCells = new Set<string>();
  if (corridorTextBoxRect) {
    const corridorRow = Math.max(gridStartR, corridorTextBoxRect.rowMin - 1);
    for (let c = gridStartC; c <= gridEndC; c++) {
      wallCells.delete(cellKey(corridorRow, c));
    }
    for (let c = corridorTextBoxRect.colMin; c <= corridorTextBoxRect.colMax; c++) {
      if (c < gridStartC || c > gridEndC) continue;
      corridorCells.add(cellKey(corridorRow, c));
    }
  }

  const edgeAlignedCell = (edge: Edge): Cell => {
    for (let attempts = 0; attempts < 50; attempts++) {
      let candidate: Cell;
      switch (edge) {
        case 'top':
          candidate = { r: gridStartR, c: lcToGridC(Math.floor(Math.random() * logicalCols)) };
          break;
        case 'bottom':
          candidate = { r: gridEndR, c: lcToGridC(Math.floor(Math.random() * logicalCols)) };
          break;
        case 'left':
          candidate = { r: lcToGridR(Math.floor(Math.random() * logicalRows)), c: gridStartC };
          break;
        case 'right':
          candidate = { r: lcToGridR(Math.floor(Math.random() * logicalRows)), c: gridEndC };
          break;
      }
      if (!cellForbidden(candidate.r, candidate.c)) return candidate;
    }
    switch (edge) {
      case 'top':
        return { r: gridStartR, c: lcToGridC(0) };
      case 'bottom':
        return { r: gridEndR, c: lcToGridC(0) };
      case 'left':
        return { r: lcToGridR(0), c: gridStartC };
      case 'right':
        return { r: lcToGridR(0), c: gridEndC };
    }
  };

  const startEdge = pickEdge();
  const exitEdges: Edge[] = (['top', 'bottom', 'left', 'right'] as Edge[]).filter(
    (e) => e !== startEdge,
  );
  const exitEdge = exitEdges[Math.floor(Math.random() * exitEdges.length)];

  const startCell = edgeAlignedCell(startEdge);
  wallCells.delete(cellKey(startCell.r, startCell.c));
  const exitCell = edgeAlignedCell(exitEdge);
  wallCells.delete(cellKey(exitCell.r, exitCell.c));

  return {
    gridStartR,
    gridEndR,
    gridStartC,
    gridEndC,
    wallCells,
    corridorCells,
    forbidden,
    startCell,
    exitEdge,
  };
}

type State = {
  level: number;
  started: boolean;
  mode: LayoutMode;
  player: Cell;
  mazes: Maze[];
  activeMazeIndex: number;
  completed: boolean[];
  blinking: boolean;
};

const INITIAL_PLAYER: Cell = { r: 0, c: 0 };

export default function MazeGame() {
  const hoverCapable = useMemo(() => isHoverCapable(), []);
  const [, setIsNarrow] = useState<boolean>(() => isNarrowViewport());
  const [dims, setDims] = useState<Dims>(() => readDims());
  const dimsRef = useRef(dims);
  dimsRef.current = dims;
  const [state, setState] = useState<State>({
    level: 1,
    started: false,
    mode: 'full',
    player: INITIAL_PLAYER,
    mazes: [],
    activeMazeIndex: 0,
    completed: [],
    blinking: false,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const refresh = () => {
      setDims(readDims());
    };
    window.addEventListener('resize', refresh);
    window.visualViewport?.addEventListener('resize', refresh);
    window.visualViewport?.addEventListener('scroll', refresh);
    return () => {
      window.removeEventListener('resize', refresh);
      window.visualViewport?.removeEventListener('resize', refresh);
      window.visualViewport?.removeEventListener('scroll', refresh);
    };
  }, []);

  const buildLevelState = useCallback((level: number, started: boolean): State => {
    const layout = computeLayout(dimsRef.current, hoverCapable);
    const mazes = layout.boundsList.map((b) => {
      if (layout.mode === 'split') {
        return generateMaze(b, [], null);
      }
      const forbidden = layout.textBoxRect ? [layout.textBoxRect] : [];
      return generateMaze(b, forbidden, layout.textBoxRect);
    });
    return {
      level,
      started,
      mode: layout.mode,
      player: mazes[0].startCell,
      mazes,
      activeMazeIndex: 0,
      completed: mazes.map(() => false),
      blinking: true,
    };
  }, [hoverCapable]);

  const beginLevel = (level: number) => {
    const s = stateRef.current;
    if (level === s.level && !s.started && s.mazes.length > 0) {
      setState({ ...s, started: true });
      return;
    }
    setState(buildLevelState(level, true));
  };

  const beginLevelRef = useRef(beginLevel);
  beginLevelRef.current = beginLevel;

  const previewBuiltRef = useRef(false);
  useEffect(() => {
    if (previewBuiltRef.current) return;
    previewBuiltRef.current = true;
    setState(buildLevelState(1, false));
  }, [buildLevelState]);

  useEffect(() => {
    const s = stateRef.current;
    if (s.mazes.length === 0) return;
    const mazeExceedsViewport = s.mazes.some(
      (m) => m.gridEndR >= dims.rows || m.gridEndC >= dims.cols,
    );
    if (s.started && !mazeExceedsViewport) return;
    setState(buildLevelState(s.level, s.started));
  }, [buildLevelState, dims.rows, dims.cols]);

  const tryMove = (dir: Dir) => {
    const s = stateRef.current;
    if (!s.started || s.mazes.length === 0) return;
    const maze = s.mazes[s.activeMazeIndex];
    const { r, c } = s.player;
    const [dr, dc] = DELTA[dir];
    const nr = r + dr;
    const nc = c + dc;
    const offGrid =
      nr < maze.gridStartR ||
      nr > maze.gridEndR ||
      nc < maze.gridStartC ||
      nc > maze.gridEndC;
    if (offGrid) {
      const exitMatch =
        (maze.exitEdge === 'top' && dir === 'up' && r === maze.gridStartR) ||
        (maze.exitEdge === 'bottom' && dir === 'down' && r === maze.gridEndR) ||
        (maze.exitEdge === 'left' && dir === 'left' && c === maze.gridStartC) ||
        (maze.exitEdge === 'right' && dir === 'right' && c === maze.gridEndC);
      if (exitMatch) {
        const newCompleted = [...s.completed];
        newCompleted[s.activeMazeIndex] = true;
        const nextIdx = newCompleted.findIndex((d) => !d);
        if (nextIdx === -1) {
          beginLevelRef.current(s.level + 1);
        } else {
          const nextMaze = s.mazes[nextIdx];
          setState((prev) => ({
            ...prev,
            activeMazeIndex: nextIdx,
            player: nextMaze.startCell,
            completed: newCompleted,
            blinking: true,
          }));
        }
      }
      return;
    }
    const nextKey = cellKey(nr, nc);
    if (
      inAnyRect({ r: nr, c: nc }, maze.forbidden) &&
      !maze.corridorCells.has(nextKey)
    ) {
      return;
    }
    if (maze.wallCells.has(nextKey)) return;
    setState((prev) => ({ ...prev, player: { r: nr, c: nc }, blinking: false }));
  };

  const tryMoveRef = useRef(tryMove);
  tryMoveRef.current = tryMove;

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
      if (Math.max(absX, absY) < SWIPE_THRESHOLD) {
        if (!stateRef.current.started) {
          beginLevelRef.current(stateRef.current.level);
        }
        return;
      }
      if (!stateRef.current.started) {
        beginLevelRef.current(stateRef.current.level);
        return;
      }
      const dir: Dir =
        absX > absY ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      tryMoveRef.current(dir);
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [hoverCapable]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        window.location.hash = '';
        return;
      }
      const dir = KEY_DIR[k];
      if (dir) {
        e.preventDefault();
        if (!stateRef.current.started) {
          beginLevelRef.current(stateRef.current.level);
          return;
        }
        tryMoveRef.current(dir);
        return;
      }
      if (!stateRef.current.started) {
        beginLevelRef.current(stateRef.current.level);
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

  const liveLayout = useMemo(
    () => computeLayout(dims, hoverCapable),
    [dims, hoverCapable],
  );
  const effectiveMode: LayoutMode = state.started ? state.mode : liveLayout.mode;
  const isSolidBackground = effectiveMode === 'full';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: isSolidBackground ? 'auto' : 'none',
        zIndex: 200,
        fontFamily: FONT_FAMILY,
      }}
      className={
        isSolidBackground
          ? 'bg-white dark:bg-black text-black dark:text-white'
          : 'text-black dark:text-white'
      }
    >
      {state.mazes.length > 0 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {state.mazes.map((m, mi) => (
            <div key={`maze-${mi}`}>
              {Array.from(m.wallCells).map((k) => {
                const [rStr, cStr] = k.split(':');
                const r = Number(rStr);
                const c = Number(cStr);
                return (
                  <div key={`w-${mi}-${k}`} style={cellStyle({ r, c })}>
                    {WALL_CHAR}
                  </div>
                );
              })}
              {Array.from(m.corridorCells).map((k) => {
                const [rStr, cStr] = k.split(':');
                const r = Number(rStr);
                const c = Number(cStr);
                return (
                  <div key={`co-${mi}-${k}`} style={cellStyle({ r, c })}>
                    {WALL_CHAR}
                  </div>
                );
              })}
            </div>
          ))}
          <div
            style={cellStyle(state.player)}
            className={state.blinking ? 'snake-blink' : undefined}
          >
            {PLAYER_CHAR}
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 24,
          fontSize: 19,
        }}
      >
        {`Level ${state.level}`}
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
        <a href="#" style={{ textDecoration: 'none', color: 'inherit' }}>
          [Close]
        </a>
      </div>

      {!state.started && (
        <OverlayBox
          asciiTitle={MAZE_ASCII}
          lines={[
            hoverCapable ? 'Control with WASD or arrow keys' : 'Swipe to control',
            hoverCapable ? 'Press any key to start' : 'Tap to start',
          ]}
          onClick={() => beginLevelRef.current(stateRef.current.level)}
        />
      )}
    </div>
  );
}

function OverlayBox({
  asciiTitle,
  lines,
  onClick,
}: {
  asciiTitle?: string;
  lines: string[];
  onClick: () => void;
}) {
  return (
    <div
      onClick={() => {
        window.location.hash = '';
      }}
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
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{
          textAlign: 'center',
          padding: '24px 32px',
          border: '1px solid currentColor',
          cursor: 'pointer',
          fontFamily: FONT_FAMILY,
          fontWeight: 500,
          fontSize: 19,
          letterSpacing: '-0.311px',
          lineHeight: '24.883px',
        }}
      >
        {asciiTitle && (
          <pre
            style={{
              fontFamily:
                "Menlo, Monaco, 'Courier New', ui-monospace, monospace",
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.5px',
              margin: 0,
              marginBottom: 24.883,
              whiteSpace: 'pre',
              display: 'inline-block',
              textAlign: 'left',
            }}
          >
            {asciiTitle}
          </pre>
        )}
        {lines.map((line, i) => {
          const isLast = i === lines.length - 1;
          return (
            <div
              key={i}
              className={asciiTitle && isLast ? 'snake-blink' : undefined}
              style={{ marginBottom: isLast ? 0 : 24.883 }}
            >
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}
