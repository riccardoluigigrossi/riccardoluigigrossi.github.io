import { useEffect, useMemo, useRef, useState } from 'react';
import MazeGame from './MazeGame';
import SnakeGame from './SnakeGame';
import SnakeDestroy from './SnakeDestroy';

type Access = 'Public' | 'NDA';

type Project = {
  name: string;
  client: string;
  access: Access;
  slug: string;
  video?: string;
  pdf?: string;
};

const PROJECTS: Project[] = [
  { name: 'Service Atlas', client: 'ABB Motion', access: 'Public', slug: 'service-atlas', video: 'service-atlas.mp4', pdf: 'ABB_Service_Atlas.pdf' },
  { name: 'Oma', client: 'Finnish Public Healthcare', access: 'Public', slug: 'oma', video: 'oma.mp4', pdf: 'Oma_Healthcare.pdf' },
  { name: 'EnergyLM', client: 'Aalto University', access: 'Public', slug: 'energylm', video: 'energylm.mp4', pdf: 'EnergyLM_Aalto.pdf' },
  { name: 'Safety Gate', client: 'European Commission', access: 'Public', slug: 'safety-gate', video: 'safety-gate.mp4', pdf: 'SafetyGate_EU.pdf' },
];

const VIDEO_W = 480;
const VIDEO_H = 287;
const CURSOR_OFFSET = 16;
const VIEWPORT_PAD = 8;

const H1_TEXT = 'Riccardo L. Grossi';
const SNAKE_CELL = 24;

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

export default function App() {
  const hash = useHashRoute();
  return (
    <>
      <div className={SHELL}>
        <div className="max-w-2xl w-full" data-snake-text-box>
          <Home />
        </div>
      </div>
      {hash === '#/snake' && <SnakeGame />}
      {hash === '#/maze' && <MazeGame />}
    </>
  );
}

function Home() {
  const [open, setOpen] = useState({
    about: true,
    projects: false,
    play: false,
    contact: false,
  });
  const toggle = (key: keyof typeof open) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

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
  const [creatureHover, setCreatureHover] = useState(false);
  const [initialSnakeBody, setInitialSnakeBody] = useState<{ r: number; c: number }[] | null>(
    null,
  );
  const creatureRef = useRef<HTMLSpanElement>(null);

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const learnTimerRef = useRef<number | null>(null);
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
    const fetchTemp = async (lat: number, lon: number): Promise<number | null> => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`,
        );
        if (!res.ok) return null;
        const json = await res.json();
        const t = json?.current?.temperature_2m;
        return typeof t === 'number' ? Math.round(t) : null;
      } catch {
        return null;
      }
    };
    Promise.allSettled([fetchTemp(45.4642, 9.19), fetchTemp(60.1699, 24.9384)]).then(
      ([m, h]) => {
        if (canceled) return;
        setTemps({
          milan: m.status === 'fulfilled' ? m.value : null,
          helsinki: h.status === 'fulfilled' ? h.value : null,
        });
      },
    );
    return () => {
      canceled = true;
    };
  }, []);

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

  const startPress = (slug: string, rowRect: DOMRect) => {
    setPressing({ slug, rowRect });
    if (learnTimerRef.current !== null) window.clearTimeout(learnTimerRef.current);
    if (!learned) {
      learnTimerRef.current = window.setTimeout(() => setLearned(true), 3500);
    }
  };

  const endPress = (slug: string) => {
    if (learnTimerRef.current !== null) {
      window.clearTimeout(learnTimerRef.current);
      learnTimerRef.current = null;
    }
    setPressing(null);
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

      <Section title="Projects" isOpen={open.projects} onToggle={() => toggle('projects')}>
        <div className="projects-wrap">
          <table className="projects-table aligned-table">
            <colgroup>
              <col className="name-col" />
              <col />
              <col />
            </colgroup>
            <tbody>
              {PROJECTS.map((p) => {
                const isPublic = p.access === 'Public';
                let nameCell: React.ReactNode = p.name;
                if (p.video && hoverCapable) {
                  nameCell = (
                    <span
                      className="underline"
                      style={{ cursor: 'default' }}
                      aria-label={`Preview ${p.name}`}
                      onMouseEnter={(e) =>
                        setHovered({ slug: p.slug, x: e.clientX, y: e.clientY })
                      }
                      onMouseMove={(e) =>
                        setHovered({ slug: p.slug, x: e.clientX, y: e.clientY })
                      }
                      onMouseLeave={() => setHovered(null)}
                    >
                      {p.name}
                    </span>
                  );
                } else if (p.video && !hoverCapable) {
                  const showHint =
                    !learned &&
                    (pressing?.slug === p.slug || recentRelease?.slug === p.slug);
                  nameCell = (
                    <span className="name-cell">
                      <span
                        role="button"
                        tabIndex={0}
                        className={`name-touch underline${showHint ? ' snake-blink' : ''}`}
                        aria-label={`Hold to preview ${p.name}`}
                        onTouchStart={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          startPress(p.slug, rect);
                        }}
                        onTouchEnd={() => endPress(p.slug)}
                        onTouchCancel={() => endPress(p.slug)}
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
                return (
                  <tr key={p.slug} className={isPublic ? undefined : 'row-dim'}>
                    <td>{nameCell}</td>
                    <td>{p.client}</td>
                    <td>
                      {p.pdf ? (
                        <a
                          href={`/pdfs/${p.pdf}`}
                          download
                          aria-label={`Download ${p.name} PDF`}
                          style={{
                            textDecoration: 'none',
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                        >
                          [PDF]
                        </a>
                      ) : (
                        <span style={{ userSelect: 'none' }}>[PDF]</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="row-dim">
                <td colSpan={3} style={{ paddingTop: 24 }}>
                  *additional work is under NDA and will appear here once shareable
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Play" isOpen={open.play} onToggle={() => toggle('play')}>
        <p className="mb-[24.883px]">
          If you've made it this far, you deserve a break. I built a couple of tiny games for this website. Give them a try.
        </p>
        <div className="projects-wrap mb-[24.883px]">
          <table className="projects-table aligned-table play-table">
            <colgroup>
              <col className="name-col" />
              <col />
            </colgroup>
            <tbody>
              <tr>
                <td>
                  <a
                    href="#/snake"
                    aria-label="Play Snake"
                    style={{ textDecoration: 'none', cursor: 'pointer', userSelect: 'none' }}
                  >
                    [Snake]
                  </a>
                </td>
                <td>
                  Dedicated to Finland and to the game that lived
                  <br />
                  on every Nokia phone.
                </td>
              </tr>
              <tr>
                <td>
                  <a
                    href="#/maze"
                    aria-label="Play Maze"
                    style={{ textDecoration: 'none', cursor: 'pointer', userSelect: 'none' }}
                  >
                    [Maze]
                  </a>
                </td>
                <td>
                  Reminder that feeling lost is often part of finding
                  <br />
                  the way, isn’t it?
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mb-0">
          Not interested? That's okay. The{' '}
          <span
            ref={creatureRef}
            data-snake-skip
            role="button"
            tabIndex={0}
            className="underline"
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

      <Section title="Contact" isOpen={open.contact} onToggle={() => toggle('contact')}>
        <p className="mb-0">
          <a href="mailto:riccardoluigigrossi@gmail.com" className="underline">
            Email
          </a>
        </p>
        <p className="mb-0">
          <a
            href="https://www.linkedin.com/in/riccardo-luigi-grossi-ba3238206/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            LinkedIn
          </a>
        </p>
      </Section>

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
      {destroy === 'falling' && (
        <SnakeDestroy epicenter={epicenter} initialBody={initialSnakeBody} />
      )}
    </>
  );
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
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
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
      </h2>
      {isOpen && <div style={{ paddingLeft: 20 }}>{children}</div>}
    </div>
  );
}
