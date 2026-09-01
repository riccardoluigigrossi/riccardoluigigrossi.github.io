import { useEffect } from 'react';
import { closeRoute } from './closeRoute';

const FONT_FAMILY = "'Inter:Medium', sans-serif";

// Cover slides carry a full-bleed image that runs off the top/bottom/right edges.
// With the pages now seamless, those hard cuts are visible — feather them into the
// background. Left stays solid (it's the white text margin); percentages keep the
// fades clear of the text at every screen size.
const COVER_FADE_MASK =
  'linear-gradient(to bottom, transparent 0%, #000 1%, #000 97%, transparent 100%), ' +
  'linear-gradient(to right, #000 0%, #000 98%, transparent 100%)';
const COVER_FADE: React.CSSProperties = {
  WebkitMaskImage: COVER_FADE_MASK,
  maskImage: COVER_FADE_MASK,
  WebkitMaskComposite: 'source-in',
  maskComposite: 'intersect',
};

type PdfViewerProps = {
  slug: string;
  name: string;
  pages: number;
};

export default function PdfViewer({ slug, name, pages }: PdfViewerProps) {
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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const barLink: React.CSSProperties = {
    fontSize: 19,
    color: 'inherit',
    textDecoration: 'none',
    userSelect: 'none',
  };

  return (
    <div
      className="bg-white text-black"
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        zIndex: 200,
        fontFamily: FONT_FAMILY,
        fontWeight: 500,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          padding: '56px 0 0',
        }}
      >
        {Array.from({ length: pages }, (_, i) => {
          const n = i + 1;
          const nn = String(n).padStart(2, '0');
          return (
            <img
              key={nn}
              src={`/pdfs/pages/${slug}/${nn}.webp`}
              alt={`${name} — page ${n}`}
              loading={n === 1 ? 'eager' : 'lazy'}
              decoding="async"
              style={{
                width: '100%',
                maxWidth: 1280,
                height: 'auto',
                display: 'block',
                ...(n === 1 ? COVER_FADE : null),
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '16px 24px',
          zIndex: 1,
        }}
      >
        <a
          href="#"
          aria-label="Close"
          style={barLink}
          onClick={(e) => {
            e.preventDefault();
            closeRoute();
          }}
        >
          [Close]
        </a>
      </div>
    </div>
  );
}
