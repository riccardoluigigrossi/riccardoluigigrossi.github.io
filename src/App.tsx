import { useState, useEffect } from 'react';

const PORTFOLIO_URL =
  'https://drive.google.com/uc?export=download&id=1jOMPh1AWwthXtZAF8cgPIZ20xjhMkony';

const MILAN_URL =
  'https://www.google.com/maps/place/Milan,+Metropolitan+City+of+Milan/@45.4627042,9.095332,12z/data=!3m1!4b1!4m6!3m5!1s0x4786c1493f1275e7:0x3cffcd13c6740e8d!8m2!3d45.468503!4d9.1824027!16zL20vMDk0N2w?entry=ttu&g_ep=EgoyMDI2MDExMS4wIKXMDSoKLDEwMDc5MjA3M0gBUAM%3D';

const HELSINKI_URL =
  'https://www.google.com/maps/place/Helsinki,+Finland/@60.1097542,24.689061,10z/data=!3m1!4b1!4m6!3m5!1s0x46920bc796210691:0xcd4ebd843be2f763!8m2!3d60.1698557!4d24.9383791!16zL20vMDNraG4?entry=ttu&g_ep=EgoyMDI2MDExMS4wIKXMDSoKLDEwMDc5MjA3M0gBUAM%3D';

const PATRIA_URL =
  'https://www.amazon.it/-/en/Fernando-Aramburu-ebook/dp/B0731FSNPT/ref=sr_1_2?crid=M6LEAOCAJ42J&dib=eyJ2IjoiMSJ9.RMrv1_LbzYPxbY5cRTB2Qjs41BWc0NwjuD_jbNInurjjQst9EnSn3cr-Qzun2a2lJDBvSNYmYz7gJBrBRZN2yJmx62PO7yPqSVHYb0XAs1r0r4VC-7tZM9S6TPUVeBNkIUEfUAIIIVzp_s1UwC0kV8JYD9k3htvysG7770Ep3CrAsSTCs5ygiXSEnYpzjfhCAEM6GtLaU9A6yrbUM452hEwyiSW6WaXWwEoqQIf8dAmwVy3vErE5BO6GZcmX2psQtR5a5kZNvWpji3Y8iC-hrw.ke3Mdbquck5HtPcksXrpnSVwVyb1lvbnZI7fiTxT42k&dib_tag=se&keywords=patria+aramburu&qid=1778944815&sprefix=patria+ara%2Caps%2C183&sr=8-2';

type Access = 'Public' | 'NDA';

const PROJECTS: { name: string; client: string; access: Access; slug: string }[] = [
  { name: 'Claims Portal', client: 'Allianz Global', access: 'NDA', slug: 'claims-portal' },
  { name: 'Service Atlas', client: 'ABB Motion', access: 'Public', slug: 'service-atlas' },
  { name: 'Oma', client: 'Finnish Public Healthcare', access: 'Public', slug: 'oma' },
  { name: 'Safety Gate', client: 'European Commission', access: 'Public', slug: 'safety-gate' },
  { name: 'EnergyLM', client: 'Aalto University', access: 'Public', slug: 'energylm' },
];

type Route = { kind: 'home' } | { kind: 'project'; slug: string };

function parseRoute(hash: string): Route {
  const m = hash.match(/^#\/projects\/([\w-]+)$/);
  return m ? { kind: 'project', slug: m[1] } : { kind: 'home' };
}

function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(typeof window === 'undefined' ? '' : window.location.hash),
  );
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

const SHELL =
  "min-h-screen bg-white dark:bg-black text-black dark:text-white px-8 py-16 font-['Inter:Medium',sans-serif] font-medium text-[19px] tracking-[-0.311px] leading-[24.883px] flex items-center justify-center";

export default function App() {
  const route = useHashRoute();
  return (
    <div className={SHELL}>
      <div className="max-w-2xl w-full">
        {route.kind === 'home' ? <Home /> : <ProjectPlaceholder />}
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
                return (
                  <tr key={p.slug} className={isPublic ? undefined : 'row-dim'}>
                    <td>
                      {isPublic ? (
                        <a href={`#/projects/${p.slug}`} className="underline">
                          {p.name}
                        </a>
                      ) : (
                        p.name
                      )}
                    </td>
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

function ProjectPlaceholder() {
  const goHome = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = '';
  };
  return (
    <>
      <p className="mb-[24.883px]">Currently working on this.</p>
      <p className="mb-[24.883px]">
        Until the page is ready, you can download my PDF portfolio{' '}
        <a href={PORTFOLIO_URL} target="_blank" rel="noopener noreferrer" className="underline">
          here
        </a>
        .
      </p>
      <p className="mb-0">
        <a href="#" onClick={goHome} style={{ cursor: 'pointer' }}>
          [Back]
        </a>
      </p>
    </>
  );
}
