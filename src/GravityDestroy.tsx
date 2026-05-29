import { useEffect } from 'react';
import Matter from 'matter-js';

type FallingWord = {
  el: HTMLSpanElement;
  body: Matter.Body;
  cx0: number;
  cy0: number;
};

const WALL_THICKNESS = 200;
const EXPLOSION_SPEED = 28;
const EXPLOSION_FALLOFF = 280;
const EXPLOSION_UP_BIAS = 6;
const EXPLOSION_SPIN = 0.6;

export default function GravityDestroy({
  targetSelector = '[data-snake-text-box]',
  epicenter,
}: {
  targetSelector?: string;
  epicenter?: { x: number; y: number } | null;
}) {
  useEffect(() => {
    const root = document.querySelector(targetSelector) as HTMLElement | null;
    if (!root) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ex = epicenter?.x ?? vw / 2;
    const ey = epicenter?.y ?? vh / 2;

    const engine = Matter.Engine.create();
    engine.gravity.y = 1;

    const wallOpts: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      friction: 0.6,
      restitution: 0.1,
    };
    const floor = Matter.Bodies.rectangle(
      vw / 2,
      vh + WALL_THICKNESS / 2,
      vw + WALL_THICKNESS * 2,
      WALL_THICKNESS,
      wallOpts,
    );
    const leftWall = Matter.Bodies.rectangle(
      -WALL_THICKNESS / 2,
      vh / 2,
      WALL_THICKNESS,
      vh * 3,
      wallOpts,
    );
    const rightWall = Matter.Bodies.rectangle(
      vw + WALL_THICKNESS / 2,
      vh / 2,
      WALL_THICKNESS,
      vh * 3,
      wallOpts,
    );
    Matter.World.add(engine.world, [floor, leftWall, rightWall]);

    const created: HTMLSpanElement[] = [];
    const words: FallingWord[] = [];

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue ?? '';
      if (!text.trim()) continue;
      const parent = (node as Text).parentElement;
      if (!parent) continue;
      const style = window.getComputedStyle(parent);
      const isUnderlined = style.textDecorationLine.includes('underline');

      const wordRegex = /\S+/g;
      let match: RegExpExecArray | null;
      while ((match = wordRegex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        const rects = range.getClientRects();
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i];
          if (r.width === 0 || r.height === 0) continue;

          const span = document.createElement('span');
          span.textContent = match[0];
          const s = span.style;
          s.position = 'fixed';
          s.left = `${r.left}px`;
          s.top = `${r.top}px`;
          s.margin = '0';
          s.padding = '0';
          s.pointerEvents = 'none';
          s.willChange = 'transform';
          s.whiteSpace = 'nowrap';
          s.fontFamily = style.fontFamily;
          s.fontSize = style.fontSize;
          s.fontWeight = style.fontWeight;
          s.fontStyle = style.fontStyle;
          s.lineHeight = style.lineHeight;
          s.letterSpacing = style.letterSpacing;
          s.color = style.color;
          if (isUnderlined) {
            s.textDecorationLine = 'underline';
            s.textDecorationColor = style.textDecorationColor;
          }
          document.body.appendChild(span);
          created.push(span);

          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const body = Matter.Bodies.rectangle(cx, cy, r.width, r.height, {
            restitution: 0.35,
            friction: 0.4,
            frictionAir: 0.012,
            density: 0.001,
          });

          const dx = cx - ex;
          const dy = cy - ey;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const nx = dx / dist;
          const ny = dy / dist;
          const speed = EXPLOSION_SPEED / (1 + dist / EXPLOSION_FALLOFF);
          Matter.Body.setVelocity(body, {
            x: nx * speed + (Math.random() - 0.5) * 2,
            y: ny * speed - EXPLOSION_UP_BIAS + (Math.random() - 0.5) * 2,
          });
          Matter.Body.setAngularVelocity(
            body,
            (Math.random() - 0.5) * EXPLOSION_SPIN,
          );
          Matter.World.add(engine.world, body);
          words.push({ el: span, body, cx0: cx, cy0: cy });
        }
      }
    }

    const prevVisibility = root.style.visibility;
    root.style.visibility = 'hidden';

    let rafId = 0;
    let lastT = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - lastT, 32);
      lastT = now;
      Matter.Engine.update(engine, dt);
      for (const w of words) {
        const dx = w.body.position.x - w.cx0;
        const dy = w.body.position.y - w.cy0;
        w.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${w.body.angle}rad)`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      for (const el of created) el.remove();
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
      root.style.visibility = prevVisibility;
    };
  }, [targetSelector]);

  return null;
}
