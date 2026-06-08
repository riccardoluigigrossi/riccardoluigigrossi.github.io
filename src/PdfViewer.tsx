import { useEffect } from 'react';

const FONT_FAMILY = "'Inter:Medium', sans-serif";

type PdfViewerProps = {
  slug: string;
  name: string;
  pages: number;
  pdf: string;
};

export default function PdfViewer({ slug, name, pages, pdf }: PdfViewerProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.location.hash = '';
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
      className="bg-white dark:bg-black text-black dark:text-white"
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
          gap: 16,
          padding: '64px 16px',
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
                boxShadow: '0 1px 24px rgba(0, 0, 0, 0.18)',
              }}
            />
          );
        })}
      </div>

      <div
        className="bg-white dark:bg-black"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          zIndex: 1,
        }}
      >
        <a
          href={`/pdfs/${pdf}`}
          download
          aria-label={`Download ${name} PDF`}
          style={barLink}
        >
          [Download]
        </a>
        <a href="#" aria-label="Close" style={barLink}>
          [Close]
        </a>
      </div>
    </div>
  );
}
