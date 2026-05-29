import { useEffect, useMemo, useRef, useState } from 'react';
import SnakeGame from './SnakeGame';
import SnakeDestroy from './SnakeDestroy';

const MILAN_URL =
  'https://www.google.com/maps/place/Milan,+Metropolitan+City+of+Milan/@45.4627042,9.095332,12z/data=!3m1!4b1!4m6!3m5!1s0x4786c1493f1275e7:0x3cffcd13c6740e8d!8m2!3d45.468503!4d9.1824027!16zL20vMDk0N2w?entry=ttu&g_ep=EgoyMDI2MDExMS4wIKXMDSoKLDEwMDc5MjA3M0gBUAM%3D';

const HELSINKI_URL =
  'https://www.google.com/maps/place/Helsinki,+Finland/@60.1097542,24.689061,10z/data=!3m1!4b1!4m6!3m5!1s0x46920bc796210691:0xcd4ebd843be2f763!8m2!3d60.1698557!4d24.9383791!16zL20vMDNraG4?entry=ttu&g_ep=EgoyMDI2MDExMS4wIKXMDSoKLDEwMDc5MjA3M0gBUAM%3D';

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
    </>
  );
}

function Home() {
  const [open, setOpen] = useState({
    about: true,
    projects: false,
    interests: false,
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
  const [classicWave, setClassicWave] = useState(0);
  const [destroy, setDestroy] = useState<'idle' | 'falling'>('idle');
  const [epicenter, setEpicenter] = useState<{ x: number; y: number } | null>(null);

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const learnTimerRef = useRef<number | null>(null);
  const releaseTimerRef = useRef<number | null>(null);
  const classicWaveTimersRef = useRef<number[]>([]);

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
    };
  }, []);

  const handleReject = (e: React.MouseEvent<HTMLSpanElement> | React.KeyboardEvent<HTMLSpanElement>) => {
    if (destroy !== 'idle') return;
    const rect = e.currentTarget.getBoundingClientRect();
    setEpicenter({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setDestroy('falling');
  };

  useEffect(() => {
    classicWaveTimersRef.current.forEach((id) => window.clearTimeout(id));
    classicWaveTimersRef.current = [];
    if (!open.interests) {
      setClassicWave(0);
      return;
    }
    const t1 = window.setTimeout(() => setClassicWave(1), 3000);
    classicWaveTimersRef.current = [t1];
    return () => {
      classicWaveTimersRef.current.forEach((id) => window.clearTimeout(id));
      classicWaveTimersRef.current = [];
    };
  }, [open.interests]);

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
      <h1 className="mb-0">Riccardo L. Grossi</h1>
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
          <a href={MILAN_URL} target="_blank" rel="noopener noreferrer" className="underline">
            Milan
          </a>{' '}
          and{' '}
          <a href={HELSINKI_URL} target="_blank" rel="noopener noreferrer" className="underline">
            Helsinki
          </a>
          .
        </p>
      </Section>

      <Section title="Projects" isOpen={open.projects} onToggle={() => toggle('projects')}>
        <div className="projects-wrap">
          <table className="projects-table">
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

      <Section title="Interests" isOpen={open.interests} onToggle={() => toggle('interests')}>
        <p className="mb-0">
          Mostly outdoorsy{' '}
          <a
            href="https://www.strava.com/athletes/116349092"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            sports
          </a>
          : running, casually biking and, whenever possible, hiking. But I also enjoy videogames, wanna go for a little{' '}
          <a
            key={classicWave}
            href="#/snake"
            className={`classic-link${classicWave > 0 ? ' classic-waving' : ''}`}
          >
            {Array.from('classic').map((ch, i) => (
              <span
                key={i}
                className="classic-letter"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                {ch}
              </span>
            ))}
          </a>
          ?
        </p>
      </Section>

      <Section title="Contact" isOpen={open.contact} onToggle={() => toggle('contact')}>
        <p className="mb-0">
          <a href="mailto:riccardoluigigrossi@gmail.com" className="underline">
            Email
          </a>
        </p>
        <p className="mb-[24.883px]">
          <a
            href="https://www.linkedin.com/in/riccardo-luigi-grossi-ba3238206/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            LinkedIn
          </a>
        </p>
        <p className="mb-0">
          <span
            role="button"
            tabIndex={0}
            onClick={handleReject}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleReject(e);
              }
            }}
            style={{ cursor: 'pointer', userSelect: 'none' }}
            className={destroy === 'idle' ? 'underline' : undefined}
          >
            {destroy === 'idle' ? "I don't want to contact you" : 'Cleaning up after myself...'}
          </span>
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
      {destroy === 'falling' && <SnakeDestroy epicenter={epicenter} />}
    </>
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
