import { useEffect, useRef } from 'react';
import { CELL } from './grid';
import { startWeather, textCells, type WeatherKind } from './weather';

// The site's phone breakpoint, where the text fills the screen's width.
const NARROW_QUERY = '(max-width: 600px)';

// Full-page weather while a city is hovered; gone the moment it isn't.
export default function AsciiWeather({
  kind,
  daylight,
}: {
  kind: WeatherKind | null;
  // 0 at sunrise, 1 at sunset: where the sun goes.
  daylight: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!kind || !container) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // The same viewport grid the creature uses.
    const grid = {
      cols: Math.max(8, Math.floor(window.innerWidth / CELL)),
      rows: Math.max(8, Math.floor(window.innerHeight / CELL)),
    };
    const text = document.querySelector('[data-snake-text-box]');
    return startWeather({
      container,
      kind,
      daylight,
      topBand: window.matchMedia(NARROW_QUERY).matches,
      grid,
      blocked: text ? textCells(text, grid) : new Set(),
      color: getComputedStyle(document.body).color,
    });
  }, [kind, daylight]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 40 }}
    />
  );
}
