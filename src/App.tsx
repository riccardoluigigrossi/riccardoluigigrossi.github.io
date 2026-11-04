import { useEffect, useMemo, useRef, useState } from 'react';
import MazeGame from './MazeGame';
import SnakeGame from './SnakeGame';
import SnakeDestroy from './SnakeDestroy';
import ProjectOverlay from './ProjectOverlay';
import PdfViewer from './PdfViewer';
import { installTabSnake } from './tabSnake';
import AsciiWeather from './AsciiWeather';
import { WEATHER_KINDS, weatherKind, type WeatherKind } from './weather';
import { CELL, runSky, type Grid, type Sky } from './grid';
import { mazePreview, snakePreview } from './gamePreviews';

type Access = 'Public' | 'Confidential';

type Project = {
  name: string;
  client: string;
  access: Access;
  slug: string;
  video?: string;
  // Confidential work has no deck to show: no pages, nothing to click.
  pages?: number;
};

const PROJECTS: Project[] = [
  { name: 'Agentic Experience', client: 'Global Insurance Group', access: 'Confidential', slug: 'confidential-insurance' },
  { name: 'Fluid Web Platform', client: 'Leading European Bank', access: 'Confidential', slug: 'confidential-bank' },
  { name: 'Service Atlas', client: 'ABB Motion', access: 'Public', slug: 'service-atlas', video: 'service-atlas.mp4', pages: 10 },
  { name: 'Oma', client: 'Finnish Public Healthcare', access: 'Public', slug: 'oma', video: 'oma.mp4', pages: 10 },
  { name: 'EnergyLM', client: 'Aalto University', access: 'Public', slug: 'energylm', video: 'energylm.mp4', pages: 9 },
  { name: 'Safety Gate', client: 'European Commission', access: 'Public', slug: 'safety-gate', video: 'safety-gate.mp4', pages: 8 },
];

const VIDEO_W = 480;
const VIDEO_H = 287;
const CURSOR_OFFSET = 16;
const VIEWPORT_PAD = 8;

const H1_TEXT = 'Riccardo L. Grossi';
// Snake and Maze.
const GAME_COUNT = 2;
const NARROW_QUERY = '(max-width: 600px)';
// Below this, a touch is a tap (open the deck); above it, a deliberate hold (play the preview).
const TAP_MS = 250;
const SNAKE_CELL = 24;

const EMAIL = 'riccardoluigigrossi@gmail.com';

const SEARCH =
  typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
const FORCED_WEATHER = ((): WeatherKind | null => {
  const w = SEARCH.get('weather');
  return WEATHER_KINDS.find((k) => k === w) ?? null;
})();
// ?daylight=0.5 puts the sun at that point of the day (0 sunrise, 1 sunset).
const FORCED_DAYLIGHT = SEARCH.has('daylight') ? Number(SEARCH.get('daylight')) : null;

// Sunrise and sunset in the city's own clock, as if it were UTC, plus its offset,
// so "how far through the day" is plain subtraction.
type SunTimes = { rise: number; set: number; offsetMs: number };

// Public Web3Forms key — safe to expose client-side. Free key at https://web3forms.com.
const WEB3FORMS_ACCESS_KEY = 'bb42ece5-f681-4509-ba31-cf132cf08797';

const SHELL =
  "min-h-screen bg-white dark:bg-black text-black dark:text-white px-8 py-16 font-['Inter:Medium',sans-serif] font-medium text-[19px] tracking-[-0.311px] leading-[24.883px] flex items-center justify-center";

function clampPosition(x: number, y: number): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = x + CURSOR_OFFSET;
  let top = y - VIDEO_H - CURSOR_OFFSET;
  if (left + VIDEO_W > vw - VIEWPORT_PAD) left = x - VIDEO_W - CURSOR_OFFSET;
  if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
  if (top < VIEWPORT_PAD) top = y + CURSOR_OFFSET;
  if (top + VIDEO_H > vh - VIEWPORT_PAD) top = vh - VIDEO_H - VIEWPORT_PAD;
  return { left, top };
}

function touchVideoSize(): { w: number; h: number } {
  const w = Math.min(VIDEO_W, window.innerWidth - VIEWPORT_PAD * 2);
  return { w, h: Math.round((w * VIDEO_H) / VIDEO_W) };
}

function clampPositionAboveRow(
  rowRect: DOMRect,
  w: number,
  h: number,
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rowRect.left + rowRect.width / 2 - w / 2;
  let top = rowRect.top - h - 8;
  if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
  if (left + w > vw - VIEWPORT_PAD) left = vw - w - VIEWPORT_PAD;
  if (top < VIEWPORT_PAD) top = rowRect.bottom + 8;
  if (top + h > vh - VIEWPORT_PAD) top = vh - h - VIEWPORT_PAD;
  return { left, top };
}

function useHashRoute() {
  const [hash, setHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash,
  );
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

// Phones keep the original full-page, vertically scrolling viewer; the floating
// slide overlay is for viewports with room to show the page around it.
function useIsNarrow() {
  const [narrow, setNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(NARROW_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

export default function App() {
  const hash = useHashRoute();
  const isNarrow = useIsNarrow();
  useEffect(() => installTabSnake(), []);
  const openProject = hash.startsWith('#/pdf/')
    ? PROJECTS.find((p) => p.slug === hash.slice('#/pdf/'.length) && p.pages)
    : undefined;
  return (
    <>
      <div className={SHELL}>
        <div className="max-w-2xl w-full" data-snake-text-box>
          <Home routeOpen={hash.startsWith('#/')} />
        </div>
      </div>
      {hash === '#/snake' && <SnakeGame />}
      {hash === '#/maze' && <MazeGame />}
      {openProject &&
        (isNarrow ? (
          <PdfViewer
            key={openProject.slug}
            slug={openProject.slug}
            name={openProject.name}
            pages={openProject.pages!}
          />
        ) : (
          <ProjectOverlay
            key={openProject.slug}
            slug={openProject.slug}
            name={openProject.name}
            pages={openProject.pages!}
          />
        ))}
    </>
  );
}

type SectionKey = 'about' | 'projects' | 'play' | 'contact';

// Single keys, no modifiers. Hinted at by a comment in index.html.
const SECTION_KEYS: Record<string, SectionKey> = { a: 'about', w: 'projects', p: 'play', c: 'contact' };
const ROUTE_KEYS: Record<string, string> = { s: '#/snake', m: '#/maze' };
const SHORTCUT_HELP: [string, string][] = [
  ['a', 'about'],
  ['w', 'work'],
  ['p', 'play'],
  ['c', 'connect'],
  ['s', 'snake'],
  ['m', 'maze'],
  ['?', 'close'],
];

// Leave the page alone this long and the creature comes out. ?idle=5 shortens it.
const IDLE_MS = (Number(SEARCH.get('idle')) || 45) * 1000;
const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'resize', 'scroll'];

// Calls `onActivity` when the visitor does something. Browsers also fire pointermove
// when the page changes under a still cursor, so movement under 3px doesn't count.
function listenForActivity(onActivity: () => void): () => void {
  let last: { x: number; y: number } | null = null;
  const handler = (e: Event) => {
    if (e.type === 'pointermove') {
      const p = e as PointerEvent;
      const prev = last;
      if (prev && Math.abs(p.clientX - prev.x) + Math.abs(p.clientY - prev.y) < 3) return;
      last = { x: p.clientX, y: p.clientY };
      // The first move only tells us where the cursor rests.
      if (!prev) return;
    }
    onActivity();
  };
  ACTIVITY_EVENTS.forEach((t) => window.addEventListener(t, handler, { capture: true, passive: true }));
  return () =>
    ACTIVITY_EVENTS.forEach((t) => window.removeEventListener(t, handler, { capture: true }));
}

function Home({ routeOpen }: { routeOpen: boolean }) {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    about: true,
    projects: false,
    play: false,
    contact: false,
  });
  const toggle = (key: SectionKey) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  // The creature out on its own, eating the page, until the visitor is back.
  const [roam, setRoam] = useState<'off' | 'out'>('off');
  const roamRef = useRef(roam);
  roamRef.current = roam;

  const [showKeys, setShowKeys] = useState(false);
  useEffect(() => {
    // Games and decks own the keyboard while they're open.
    if (routeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // A key while the creature is out just means "I'm back".
      if (roamRef.current !== 'off') return;
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      if (e.key === '?') {
        setShowKeys((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setShowKeys(false);
        return;
      }
      const k = e.key.toLowerCase();
      const section = SECTION_KEYS[k];
      if (section) {
        setOpen((prev) => ({ ...prev, [section]: !prev[section] }));
        return;
      }
      if (ROUTE_KEYS[k]) window.location.hash = ROUTE_KEYS[k];
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [routeOpen]);

  const hoverCapable = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    [],
  );

  const [hovered, setHovered] = useState<{ slug: string; x: number; y: number } | null>(null);
  const [pressing, setPressing] = useState<{ slug: string; rowRect: DOMRect } | null>(null);
  const [recentRelease, setRecentRelease] = useState<{ slug: string; until: number } | null>(
    null,
  );
  const [learned, setLearned] = useState(false);
  const [destroy, setDestroy] = useState<'idle' | 'falling'>('idle');
  const [epicenter, setEpicenter] = useState<{ x: number; y: number } | null>(null);

  const [activeCity, setActiveCity] = useState<'milan' | 'helsinki' | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [temps, setTemps] = useState<{ milan: number | null; helsinki: number | null }>({
    milan: null,
    helsinki: null,
  });
  const [skies, setSkies] = useState<{ milan: WeatherKind | null; helsinki: WeatherKind | null }>({
    milan: null,
    helsinki: null,
  });
  const [suns, setSuns] = useState<{ milan: SunTimes | null; helsinki: SunTimes | null }>({
    milan: null,
    helsinki: null,
  });
  const [creatureHover, setCreatureHover] = useState(false);
  const [askAbout, setAskAbout] = useState<string | null>(null);
  const [initialSnakeBody, setInitialSnakeBody] = useState<{ r: number; c: number }[] | null>(
    null,
  );
  const creatureRef = useRef<HTMLSpanElement>(null);

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const learnTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef(0);
  const releaseTimerRef = useRef<number | null>(null);
  const cityTimerRef = useRef<number | null>(null);

  const activeSlug = hovered?.slug ?? pressing?.slug ?? null;

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([slug, el]) => {
      if (!el) return;
      if (activeSlug === slug) {
        el.play().catch(() => {});
      } else {
        el.pause();
        try {
          el.currentTime = 0;
        } catch {
          /* some browsers reject seek before metadata; ignore */
        }
      }
    });
  }, [activeSlug]);

  useEffect(() => {
    return () => {
      if (learnTimerRef.current !== null) window.clearTimeout(learnTimerRef.current);
      if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current);
      if (cityTimerRef.current !== null) window.clearTimeout(cityTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeCity) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeCity]);

  useEffect(() => {
    let canceled = false;
    type Current = { temp: number | null; kind: WeatherKind | null; sun: SunTimes | null };
    const nothing: Current = { temp: null, kind: null, sun: null };
    const fetchCurrent = async (lat: number, lon: number): Promise<Current> => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1`,
        );
        if (!res.ok) return nothing;
        const json = await res.json();
        const t = json?.current?.temperature_2m;
        const code = json?.current?.weather_code;
        const isDay = json?.current?.is_day;
        const rise = Date.parse(`${json?.daily?.sunrise?.[0]}Z`);
        const set = Date.parse(`${json?.daily?.sunset?.[0]}Z`);
        const offset = json?.utc_offset_seconds;
        return {
          temp: typeof t === 'number' ? Math.round(t) : null,
          kind: weatherKind(
            typeof code === 'number' ? code : null,
            typeof isDay === 'number' ? isDay === 1 : null,
          ),
          sun:
            set > rise && typeof offset === 'number'
              ? { rise, set, offsetMs: offset * 1000 }
              : null,
        };
      } catch {
        return nothing;
      }
    };
    Promise.all([fetchCurrent(45.4642, 9.19), fetchCurrent(60.1699, 24.9384)]).then(([m, h]) => {
      if (canceled) return;
      setTemps({ milan: m.temp, helsinki: h.temp });
      setSkies({ milan: m.kind, helsinki: h.kind });
      setSuns({ milan: m.sun, helsinki: h.sun });
    });
    return () => {
      canceled = true;
    };
  }, []);

  // ?weather=<kind> (see WEATHER_KINDS) previews a sky on either city, whatever it's doing outside.
  const activeSky = activeCity ? (FORCED_WEATHER ?? skies[activeCity]) : null;
  // How far through that city's day it is right now, for placing the sun.
  const daylight = useMemo(() => {
    if (FORCED_DAYLIGHT !== null && !Number.isNaN(FORCED_DAYLIGHT)) return FORCED_DAYLIGHT;
    const sun = activeCity ? suns[activeCity] : null;
    if (!sun) return 0.5;
    return (Date.now() + sun.offsetMs - sun.rise) / (sun.set - sun.rise);
  }, [activeCity, suns]);

  const activateCity = (city: 'milan' | 'helsinki') => {
    setActiveCity(city);
    if (cityTimerRef.current !== null) window.clearTimeout(cityTimerRef.current);
    if (!hoverCapable) {
      cityTimerRef.current = window.setTimeout(() => setActiveCity(null), 3000);
    }
  };

  const deactivateCity = (city: 'milan' | 'helsinki') => {
    if (!hoverCapable) return;
    setActiveCity((prev) => (prev === city ? null : prev));
  };

  const handleReject = (e: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
    if (destroy !== 'idle') return;
    let x: number;
    let y: number;
    if ('clientX' in e) {
      x = e.clientX;
      y = e.clientY;
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
    setCreatureHover(true);
    window.requestAnimationFrame(() => {
      const el = creatureRef.current;
      let cells: { r: number; c: number }[] | null = null;
      if (el) {
        const r = el.getBoundingClientRect();
        const row = Math.max(0, Math.floor((r.top + r.height / 2) / SNAKE_CELL));
        const leftCol = Math.max(0, Math.floor(r.left / SNAKE_CELL));
        const rightCol = Math.max(leftCol, Math.floor((r.right - 1) / SNAKE_CELL));
        const list: { r: number; c: number }[] = [];
        for (let c = rightCol; c >= leftCol; c--) list.push({ r: row, c });
        cells = list;
      }
      setInitialSnakeBody(cells);
      setEpicenter({ x, y });
      setDestroy('falling');
    });
  };

  // The creature plays eventually: after IDLE_MS of nobody touching anything it
  // does exactly what clicking it does, only crawling in from the side. Any sign
  // of life and the page is back at once. Mouse-and-trackpad screens only: on a
  // touch screen, sitting still usually just means someone is reading.
  useEffect(() => {
    if (!hoverCapable || routeOpen || destroy !== 'idle') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (roam === 'out') return listenForActivity(() => setRoam('off'));
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // Not while someone is mid-way through writing a note.
        const a = document.activeElement;
        if (a instanceof HTMLTextAreaElement || a instanceof HTMLInputElement) return arm();
        setRoam('out');
      }, IDLE_MS);
    };
    arm();
    const stop = listenForActivity(arm);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [roam, routeOpen, destroy, hoverCapable]);

  useEffect(() => {
    // Opening a game or deck while it's out puts the page back first.
    if (routeOpen) setRoam('off');
  }, [routeOpen]);

  const openDeck = (slug: string) => {
    setHovered(null);
    window.location.hash = `#/pdf/${slug}`;
  };

  const startPress = (slug: string, rowRect: DOMRect) => {
    pressStartRef.current = Date.now();
    setPressing({ slug, rowRect });
    if (learnTimerRef.current !== null) window.clearTimeout(learnTimerRef.current);
    if (!learned) {
      learnTimerRef.current = window.setTimeout(() => setLearned(true), 3500);
    }
  };

  const endPress = (slug: string, canOpen = false) => {
    const held = Date.now() - pressStartRef.current;
    if (learnTimerRef.current !== null) {
      window.clearTimeout(learnTimerRef.current);
      learnTimerRef.current = null;
    }
    setPressing(null);
    // A quick tap opens the deck; anything longer was a deliberate hold to preview.
    if (canOpen && held < TAP_MS) {
      openDeck(slug);
      return;
    }
    if (!learned) {
      const until = Date.now() + 3000;
      setRecentRelease({ slug, until });
      if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = window.setTimeout(() => setRecentRelease(null), 3000);
    }
  };

  const projectsWithVideo = PROJECTS.filter(
    (p): p is Project & { video: string } => !!p.video,
  );
  const pos = hovered ? clampPosition(hovered.x, hovered.y) : null;
  const touchSize = pressing ? touchVideoSize() : null;
  const touchPos =
    pressing && touchSize
      ? clampPositionAboveRow(pressing.rowRect, touchSize.w, touchSize.h)
      : null;

  return (
    <>
      <h1 className="mb-0">{H1_TEXT}</h1>
      <h2 className="mb-[24.883px]">Digital Product and Service Designer</h2>

      <Section title="About" isOpen={open.about} onToggle={() => toggle('about')}>
        <p className="mb-[24.883px]">
          Currently at{' '}
          <a
            href="https://www.accenture.com/us-en/about/accenture-song-index"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Accenture Song
          </a>
          , where I work mostly with banking and financial services to bring fluid interfaces and AI into a space that isn't used to seeing them. Before this, I
          was at{' '}
          <a href="https://aivan.fi" target="_blank" rel="noopener noreferrer" className="underline">
            Aivan
          </a>
          , a strategic design consultancy in Helsinki.
        </p>
        <p className="mb-[24.883px]">
          I studied at{' '}
          <a
            href="https://www.aalto.fi/en"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Aalto University
          </a>{' '}
          and{' '}
          <a
            href="https://www.polimi.it/en/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Politecnico di Milano
          </a>
          , where I've spent a lot of time thinking on the relationship between technology
          and people, and how to make that relationship feel natural (and less awkward).
        </p>
        <p className="mb-0">
          Right now I'm splitting my time between{' '}
          <CityLive
            name="Milan"
            timezone="Europe/Rome"
            tempC={temps.milan}
            isActive={activeCity === 'milan'}
            hoverCapable={hoverCapable}
            now={now}
            onActivate={() => activateCity('milan')}
            onDeactivate={() => deactivateCity('milan')}
          />{' '}
          and{' '}
          <CityLive
            name="Helsinki"
            timezone="Europe/Helsinki"
            tempC={temps.helsinki}
            isActive={activeCity === 'helsinki'}
            hoverCapable={hoverCapable}
            now={now}
            onActivate={() => activateCity('helsinki')}
            onDeactivate={() => deactivateCity('helsinki')}
          />
          .
        </p>
      </Section>

      <Section
        title="Work"
        isOpen={open.projects}
        onToggle={() => toggle('projects')}
        count={PROJECTS.length}
      >
        <div className="projects-wrap">
          <table className="projects-table aligned-table">
            <colgroup>
              <col className="name-col" />
              <col />
              <col />
            </colgroup>
            <tbody>
              {PROJECTS.map((p) => {
                const openable = !!p.pages;
                let nameCell: React.ReactNode = p.name;
                if (openable && p.video && hoverCapable) {
                  // Hovering plays the preview; clicking opens the deck.
                  nameCell = (
                    <a
                      href={`#/pdf/${p.slug}`}
                      className="underline"
                      style={{ cursor: 'pointer' }}
                      aria-label={`Open ${p.name}`}
                      onMouseEnter={(e) =>
                        setHovered({ slug: p.slug, x: e.clientX, y: e.clientY })
                      }
                      onMouseMove={(e) =>
                        setHovered({ slug: p.slug, x: e.clientX, y: e.clientY })
                      }
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => setHovered(null)}
                    >
                      {p.name}
                    </a>
                  );
                } else if (openable && p.video && !hoverCapable) {
                  // No hover to work with: tap opens the deck, hold plays the preview.
                  const showHint =
                    !learned &&
                    (pressing?.slug === p.slug || recentRelease?.slug === p.slug);
                  nameCell = (
                    <span className="name-cell">
                      <span
                        role="button"
                        tabIndex={0}
                        className={`name-touch underline${showHint ? ' snake-blink' : ''}`}
                        aria-label={`Open ${p.name}, or hold to preview`}
                        onTouchStart={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          startPress(p.slug, rect);
                        }}
                        onTouchEnd={() => endPress(p.slug, true)}
                        onTouchCancel={() => endPress(p.slug)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDeck(p.slug);
                          }
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {p.name}
                      </span>
                      {showHint && (
                        <span className="name-hint snake-blink-inverse" aria-hidden="true">
                          hold to watch
                        </span>
                      )}
                    </span>
                  );
                }
                if (p.access === 'Confidential') {
                  // Under NDA: hovering swaps the name for an invitation to ask about it.
                  const asking = askAbout === p.slug;
                  return (
                    <tr
                      key={p.slug}
                      className="row-dim"
                      onPointerEnter={hoverCapable ? () => setAskAbout(p.slug) : undefined}
                      onPointerLeave={hoverCapable ? () => setAskAbout(null) : undefined}
                      onClick={
                        hoverCapable
                          ? undefined
                          : () => setAskAbout((prev) => (prev === p.slug ? null : p.slug))
                      }
                    >
                      <td style={{ userSelect: 'none' }}>
                        {asking ? (
                          <a
                            href={`mailto:${EMAIL}?subject=${encodeURIComponent(`About ${p.name}`)}`}
                            className="underline"
                          >
                            Ask me
                          </a>
                        ) : (
                          p.name
                        )}
                      </td>
                      <td>{p.client}</td>
                      <td style={{ userSelect: 'none' }}>{p.access}</td>
                    </tr>
                  );
                }
                return (
                  <tr key={p.slug} className={openable ? undefined : 'row-dim'}>
                    <td>{nameCell}</td>
                    <td>{p.client}</td>
                    <td style={{ userSelect: 'none' }}>{p.access}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Play"
        isOpen={open.play}
        onToggle={() => toggle('play')}
        count={GAME_COUNT}
      >
        <p className="mb-[24.883px]">
          Enough about work? Slow down and enjoy my minigames.
        </p>
        <div className="projects-wrap mb-[24.883px]">
          <table className="projects-table aligned-table play-table">
            <colgroup>
              <col className="name-col" />
              <col />
            </colgroup>
            <tbody>
              <PlayRow route="#/snake" name="Snake" preview={snakePreview} hoverCapable={hoverCapable}>
                Dedicated to my time in Finland and to the game
                <br />
                that lived on every Nokia phone.
              </PlayRow>
              <PlayRow route="#/maze" name="Maze" preview={mazePreview} hoverCapable={hoverCapable}>
                Sometimes the way forward starts with not
                <br />
                knowing where you are going.
              </PlayRow>
            </tbody>
          </table>
        </div>
        <p className="mb-0">
          If you're not interested, that's okay. The{' '}
          <span
            ref={creatureRef}
            data-snake-skip
            role="button"
            tabIndex={0}
            className={creatureHover ? '' : 'underline'}
            style={{ cursor: 'pointer' }}
            onClick={handleReject}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleReject(e);
              }
            }}
            onPointerEnter={hoverCapable ? () => setCreatureHover(true) : undefined}
            onPointerLeave={hoverCapable ? () => setCreatureHover(false) : undefined}
          >
            {creatureHover ? 'creature'.replace(/\S/g, '#') : 'creature'}
          </span>
          {' '}will play eventually.
        </p>
      </Section>

      <Section title="Connect" isOpen={open.contact} onToggle={() => toggle('contact')}>
        <ConnectLine />
        <NoteField />
      </Section>

      {showKeys && (
        <div className="shortcut-help" aria-label="Keyboard shortcuts">
          {SHORTCUT_HELP.map(([key, label]) => (
            <span key={key} style={{ display: 'contents' }}>
              <span>{key}</span>
              <span>{label}</span>
            </span>
          ))}
        </div>
      )}

      {projectsWithVideo.map((p) => {
        const hoverActive = hoverCapable && hovered?.slug === p.slug && pos !== null;
        const touchActive =
          !hoverCapable && pressing?.slug === p.slug && touchPos !== null && touchSize !== null;
        const active = hoverActive || touchActive;
        const width = touchActive ? touchSize!.w : VIDEO_W;
        const height = touchActive ? touchSize!.h : VIDEO_H;
        const placement = hoverActive
          ? { left: pos!.left, top: pos!.top, opacity: 1 }
          : touchActive
          ? { left: touchPos!.left, top: touchPos!.top, opacity: 1 }
          : { left: -99999, top: -99999, opacity: 0 };
        return (
          <video
            key={p.slug}
            ref={(el) => {
              videoRefs.current[p.slug] = el;
            }}
            src={`/videos/${p.video}`}
            muted
            loop
            playsInline
            preload="auto"
            style={{
              position: 'fixed',
              width,
              height,
              objectFit: 'cover',
              pointerEvents: 'none',
              zIndex: 50,
              boxShadow: active ? '0 8px 32px rgba(0, 0, 0, 0.25)' : undefined,
              ...placement,
            }}
          />
        );
      })}
      <AsciiWeather kind={activeSky} daylight={daylight} />
      {roam === 'out' && !routeOpen && destroy === 'idle' && <SnakeDestroy fromSide />}
      {destroy === 'falling' && (
        <SnakeDestroy epicenter={epicenter} initialBody={initialSnakeBody} />
      )}
    </>
  );
}

// A game in the Play list. On mouse and trackpad screens, hovering or focusing it
// swaps its line for the game playing itself in that same spot, and the whole row
// opens the game. Touch screens get the plain row: the button opens the game.
function PlayRow({
  route,
  name,
  preview,
  hoverCapable,
  children,
}: {
  route: string;
  name: string;
  preview: (grid: Grid) => Sky;
  hoverCapable: boolean;
  children: React.ReactNode;
}) {
  const [peek, setPeek] = useState(false);
  const rowProps = hoverCapable
    ? {
        className: 'play-row',
        onPointerEnter: () => setPeek(true),
        onPointerLeave: () => setPeek(false),
        onClick: (e: React.MouseEvent) => {
          if (!(e.target instanceof Element && e.target.closest('a'))) window.location.hash = route;
        },
      }
    : {};

  return (
    <tr {...rowProps}>
      <td>
        <a
          href={route}
          aria-label={`Play ${name}`}
          style={{ textDecoration: 'none', cursor: 'pointer', userSelect: 'none' }}
          onFocus={hoverCapable ? () => setPeek(true) : undefined}
          onBlur={hoverCapable ? () => setPeek(false) : undefined}
        >
          [{name}]
        </a>
      </td>
      <td className="play-desc">
        <span style={{ visibility: peek ? 'hidden' : undefined }}>{children}</span>
        {peek && <GamePeek preview={preview} />}
      </td>
    </tr>
  );
}

// The game on the page's character grid, sized to the line it covers.
function GamePeek({ preview }: { preview: (grid: Grid) => Sky }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || CELL;
    const grid = {
      cols: Math.max(4, Math.floor(box.width / CELL)),
      rows: Math.max(2, Math.round(box.height / lineHeight)),
    };
    return runSky({
      container: el,
      grid,
      blocked: new Set(),
      color: getComputedStyle(el).color,
      sky: preview(grid),
    });
  }, [preview]);
  // data-snake-skip: if the creature comes out mid-preview, it doesn't eat these.
  return <div ref={ref} className="play-peek" data-snake-skip aria-hidden="true" />;
}

type CityLiveProps = {
  name: string;
  timezone: string;
  tempC: number | null;
  isActive: boolean;
  hoverCapable: boolean;
  now: number;
  onActivate: () => void;
  onDeactivate: () => void;
};

function CityLive({
  name,
  timezone,
  tempC,
  isActive,
  hoverCapable,
  now,
  onActivate,
  onDeactivate,
}: CityLiveProps) {
  const interactionProps = hoverCapable
    ? {
        onPointerEnter: onActivate,
        onPointerLeave: onDeactivate,
      }
    : {
        onClick: onActivate,
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      };

  if (!isActive) {
    return (
      <span className="underline" style={{ cursor: 'default' }} {...interactionProps}>
        {name}
      </span>
    );
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(now));
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '--';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '--';

  return (
    <span
      style={{ cursor: 'default', fontVariantNumeric: 'tabular-nums' }}
      aria-label={name}
      {...interactionProps}
    >
      {hh}
      <span className="snake-blink">:</span>
      {mm}
      {tempC != null ? ` ${tempC}°C` : ''}
    </span>
  );
}

function Section({
  title,
  isOpen,
  onToggle,
  count,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  // Shown quietly next to a closed heading, so there's a reason to open it.
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-[24.883px]">
      <h2
        onClick={onToggle}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        className={isOpen ? 'mb-[24.883px]' : 'mb-0'}
      >
        [{title}]
        {!isOpen && count !== undefined && <span className="section-count"> {count}</span>}
      </h2>
      {isOpen && <div style={{ paddingLeft: 20 }}>{children}</div>}
    </div>
  );
}

// Hello in the languages of Milan, Helsinki and in between. The word becomes the
// email's subject, so "moi" arrives as "Moi from your site".
const GREETINGS = ['ciao', 'moi', 'hi', 'uè', 'hei hei', 'moikka', 'salve', 'terve', 'hello'];
const GREETING_MS = 2600;

function ConnectLine() {
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    // Hold the word still while someone's about to click the email link.
    if (held) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % GREETINGS.length), GREETING_MS);
    return () => window.clearInterval(id);
  }, [held]);

  const word = GREETINGS[i];
  const subject = `${word[0].toUpperCase()}${word.slice(1)} from your site`;
  return (
    <p className="mb-0">
      Say {word} to me with an{' '}
      <a
        href={`mailto:${EMAIL}?subject=${encodeURIComponent(subject)}`}
        className="underline"
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={() => setHeld(false)}
      >
        email
      </a>{' '}
      or connect with me on{' '}
      <a
        href="https://www.linkedin.com/in/riccardo-luigi-grossi-ba3238206/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        LinkedIn
      </a>
      .
    </p>
  );
}

function NoteField() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<'message' | 'name'>('message');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [showHint, setShowHint] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const hintTimer = useRef<number | null>(null);

  const armHint = () => {
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setShowHint(true), 1000);
  };

  useEffect(() => {
    if (!active) return;
    const el = taRef.current;
    el?.focus();
    if (el) el.style.height = 'auto';
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    // Name step: keep the "Press Enter" hint visible the whole time (an empty name
    // is valid — anonymous). Message step: reveal it only after a typing pause.
    setShowHint(step === 'name');
  }, [active, step]);

  useEffect(
    () => () => {
      if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    },
    [],
  );

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    grow(e.target);
    if (step === 'name') {
      setName(v);
      return; // hint stays visible on the name step
    }
    setMessage(v);
    setShowHint(false);
    if (v.trim()) armHint();
    else if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
  };

  const send = async () => {
    const body = message.trim();
    if (!body || status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: 'New note from your site',
          name: name.trim() || 'Anonymous',
          message: body,
        }),
      });
      const data = await res.json();
      if (data.success) setStatus('sent');
      else setStatus('error');
    } catch {
      setStatus('error');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    if (step === 'message') {
      if (message.trim()) setStep('name');
    } else {
      send();
    }
  };

  if (status === 'sent') {
    return (
      <p className="mb-0" style={{ opacity: 0.5 }}>
        Thanks, I&apos;ll see this in my inbox.
      </p>
    );
  }

  if (!active) {
    return (
      <p className="mb-0">
        You can also{' '}
        <span
          role="button"
          tabIndex={0}
          className="underline"
          style={{ cursor: 'pointer' }}
          onClick={() => setActive(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setActive(true);
            }
          }}
        >
          leave a note
        </span>
        .
      </p>
    );
  }

  return (
    <div className="mb-0">
      <textarea
        ref={taRef}
        rows={1}
        value={step === 'message' ? message : name}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={
          step === 'message'
            ? 'Type anything...'
            : 'Type your name (or leave empty)'
        }
        disabled={status === 'sending'}
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          resize: 'none',
          padding: 0,
          margin: 0,
          background: 'transparent',
          overflow: 'hidden',
          display: 'block',
          font: 'inherit',
          color: 'inherit',
          lineHeight: 'inherit',
        }}
      />
      {showHint && (status === 'idle' || status === 'sending') && (
        <div style={{ opacity: 0.5 }}>Press Enter</div>
      )}
      {status === 'error' && (
        <div style={{ opacity: 0.5 }}>That didn&apos;t send. Try again?</div>
      )}
    </div>
  );
}
