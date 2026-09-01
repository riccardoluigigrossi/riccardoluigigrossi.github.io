import { useCallback, useEffect, useState } from 'react';
import { closeRoute } from './closeRoute';

// Mirrors the body typography in App.tsx's SHELL so the overlay chrome is
// indistinguishable from the rest of the site.
const TYPOGRAPHY: React.CSSProperties = {
  fontFamily: "'Inter:Medium', sans-serif",
  fontWeight: 500,
  fontSize: 19,
  letterSpacing: '-0.311px',
  lineHeight: '24.883px',
};

type ProjectOverlayProps = {
  slug: string;
  name: string;
  pages: number;
};

function pageSrc(slug: string, i: number): string {
  return `/pdfs/pages/${slug}/${String(i + 1).padStart(2, '0')}.webp`;
}

export default function ProjectOverlay({ slug, name, pages }: ProjectOverlayProps) {
  const [index, setIndex] = useState(0);
  // The hint retires as soon as the visitor navigates by any means — arrow key
  // or click — after which the slot shows the page count.
  const [navigated, setNavigated] = useState(false);

  // Paging loops: past the last page comes the first, and vice versa.
  const go = useCallback(
    (delta: number) => {
      setNavigated(true);
      setIndex((i) => (i + delta + pages) % pages);
    },
    [pages],
  );

  // The page behind stays put while the overlay is up; closeRoute() then clears the
  // hash in place so the visitor keeps their scroll position.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRoute();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // A deck is a couple of MB at most — far less than the preview videos already
  // fetched on load — so pull every page up front and keep paging instant.
  useEffect(() => {
    for (let i = 0; i < pages; i++) new Image().src = pageSrc(slug, i);
  }, [slug, pages]);

  // Left half of the viewport steps back, right half steps forward.
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    go(e.clientX < window.innerWidth / 2 ? -1 : 1);
  };

  const chrome: React.CSSProperties = {
    position: 'fixed',
    padding: '16px 24px',
    userSelect: 'none',
    zIndex: 1,
    color: 'inherit',
    textDecoration: 'none',
  };

  return (
    <div
      className="project-overlay"
      onClick={onClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...TYPOGRAPHY,
      }}
    >
      <img
        className="project-overlay-slide"
        src={pageSrc(slug, index)}
        alt={`${name} — page ${index + 1} of ${pages}`}
        draggable={false}
        decoding="async"
      />

      <div
        className={`project-overlay-chrome${navigated ? '' : ' snake-blink'}`}
        style={{
          ...chrome,
          top: 0,
          left: 0,
          pointerEvents: 'none',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
        aria-live="polite"
      >
        {navigated ? `${index + 1}/${pages}` : 'Use arrows or click'}
      </div>

      <a
        href="#"
        aria-label="Close"
        className="project-overlay-close project-overlay-chrome"
        style={{ ...chrome, top: 0, right: 0 }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          closeRoute();
        }}
      >
        [Close]
      </a>

    </div>
  );
}
