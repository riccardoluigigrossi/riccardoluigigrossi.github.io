import { useEffect, useMemo, useRef, useState } from 'react';

const MILAN_URL =
  'https://www.google.com/maps/place/Milan,+Metropolitan+City+of+Milan/@45.4627042,9.095332,12z/data=!3m1!4b1!4m6!3m5!1s0x4786c1493f1275e7:0x3cffcd13c6740e8d!8m2!3d45.468503!4d9.1824027!16zL20vMDk0N2w?entry=ttu&g_ep=EgoyMDI2MDExMS4wIKXMDSoKLDEwMDc5MjA3M0gBUAM%3D';

const HELSINKI_URL =
  'https://www.google.com/maps/place/Helsinki,+Finland/@60.1097542,24.689061,10z/data=!3m1!4b1!4m6!3m5!1s0x46920bc796210691:0xcd4ebd843be2f763!8m2!3d60.1698557!4d24.9383791!16zL20vMDNraG4?entry=ttu&g_ep=EgoyMDI2MDExMS4wIKXMDSoKLDEwMDc5MjA3M0gBUAM%3D';

const PATRIA_URL =
  'https://www.amazon.it/-/en/Fernando-Aramburu-ebook/dp/B0731FSNPT/ref=sr_1_2?crid=M6LEAOCAJ42J&dib=eyJ2IjoiMSJ9.RMrv1_LbzYPxbY5cRTB2Qjs41BWc0NwjuD_jbNInurjjQst9EnSn3cr-Qzun2a2lJDBvSNYmYz7gJBrBRZN2yJmx62PO7yPqSVHYb0XAs1r0r4VC-7tZM9S6TPUVeBNkIUEfUAIIIVzp_s1UwC0kV8JYD9k3htvysG7770Ep3CrAsSTCs5ygiXSEnYpzjfhCAEM6GtLaU9A6yrbUM452hEwyiSW6WaXWwEoqQIf8dAmwVy3vErE5BO6GZcmX2psQtR5a5kZNvWpji3Y8iC-hrw.ke3Mdbquck5HtPcksXrpnSVwVyb1lvbnZI7fiTxT42k&dib_tag=se&keywords=patria+aramburu&qid=1778944815&sprefix=patria+ara%2Caps%2C183&sr=8-2';

type Access = 'Public' | 'NDA';

type Project = {
  name: string;
  client: string;
  access: Access;
  slug: string;
  video?: string;
};

const PROJECTS: Project[] = [
  { name: 'Claims Portal', client: 'Allianz Global', access: 'NDA', slug: 'claims-portal' },
  { name: 'Service Atlas', client: 'ABB Motion', access: 'Public', slug: 'service-atlas', video: 'service-atlas.mp4' },
  { name: 'Oma', client: 'Finnish Public Healthcare', access: 'Public', slug: 'oma', video: 'oma.mp4' },
  { name: 'Safety Gate', client: 'European Commission', access: 'Public', slug: 'safety-gate', video: 'safety-gate.mp4' },
  { name: 'EnergyLM', client: 'Aalto University', access: 'Public', slug: 'energylm', video: 'energylm.mp4' },
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

export default function App() {
  return (
    <div className={SHELL}>
      <div className="max-w-2xl w-full">
        <Home />
      </div>
    </div>
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
  const [modalSlug, setModalSlug] = useState<string | null>(null);

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([slug, el]) => {
      if (!el) return;
      if (hovered?.slug === slug) {
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
  }, [hovered?.slug]);

  useEffect(() => {
    if (!modalSlug) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalSlug(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [modalSlug]);

  const projectsWithVideo = PROJECTS.filter(
    (p): p is Project & { video: string } => !!p.video,
  );
  const pos = hovered ? clampPosition(hovered.x, hovered.y) : null;

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
                let cell: React.ReactNode = p.name;
                if (p.video && hoverCapable) {
                  cell = (
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
                  cell = (
                    <span
                      role="button"
                      tabIndex={0}
                      className="underline"
                      style={{ cursor: 'pointer' }}
                      aria-label={`Play ${p.name} preview`}
                      onClick={() => setModalSlug(p.slug)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setModalSlug(p.slug);
                        }
                      }}
                    >
                      {p.name}
                    </span>
                  );
                }
                return (
                  <tr key={p.slug} className={isPublic ? undefined : 'row-dim'}>
                    <td>{cell}</td>
                    <td>{p.client}</td>
                    <td>{p.access}</td>
                  </tr>
                );
              })}
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
          : running, casually biking and, whenever possible, hiking. Currently reading{' '}
          <a href={PATRIA_URL} target="_blank" rel="noopener noreferrer" className="underline">
            Patria by Fernando Aramburu
          </a>
          .
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
        const active = hoverCapable && hovered?.slug === p.slug && pos !== null;
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
              width: VIDEO_W,
              height: VIDEO_H,
              objectFit: 'cover',
              pointerEvents: 'none',
              zIndex: 50,
              boxShadow: active ? '0 8px 32px rgba(0, 0, 0, 0.25)' : undefined,
              ...(active && pos
                ? { left: pos.left, top: pos.top, opacity: 1 }
                : { left: -99999, top: -99999, opacity: 0 }),
            }}
          />
        );
      })}

      {modalSlug && <TouchModal slug={modalSlug} onClose={() => setModalSlug(null)} />}
    </>
  );
}

function TouchModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const p = PROJECTS.find((x) => x.slug === slug);
  if (!p?.video) return null;
  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label="Close preview"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <video
        src={`/videos/${p.video}`}
        autoPlay
        muted
        loop
        playsInline
        controls
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(90vw, 720px)',
          aspectRatio: '1808 / 1080',
          background: '#000',
        }}
      />
    </div>
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
