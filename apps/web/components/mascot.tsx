"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { MASCOT_BRICKS } from "@/components/mascot-bricks";
import { getVoiceLevel } from "@/lib/agent/use-voice";

const CORE_SRC = "/mascot/agent-core.png";

type Brick = { cx: number; cy: number; w: number; h: number; r: number; g: number; b: number; dist: number };

const BRICKS: Brick[] = MASCOT_BRICKS.map(([cx, cy, w, h, r, g, b]) => ({ cx, cy, w, h, r, g, b, dist: Math.hypot(cx - 0.5, cy - 0.5) }));

let coreImage: HTMLImageElement | null = null;
let corePromise: Promise<HTMLImageElement | null> | null = null;

function loadCore(): Promise<HTMLImageElement | null> {
  if (coreImage) return Promise.resolve(coreImage);
  if (corePromise) return corePromise;
  corePromise = new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      coreImage = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = CORE_SRC;
  });
  return corePromise;
}

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** `level` is live voice loudness (0..1): it throbs every brick at once, on top of the rolling swell. */
function drawMascot(ctx: CanvasRenderingContext2D, px: number, elapsedMs: number, pulsing: boolean, level = 0) {
  ctx.clearRect(0, 0, px, px);

  // The dark tunnel breathes slightly with the pulse, and opens up when there's a voice.
  const breath = pulsing ? (1 + 0.035 * Math.sin(elapsedMs / 520)) * (1 + 0.07 * level) : 1;
  const swell = level > 0.02 ? 0.25 + 0.55 * level : 0.45;
  const throb = 1 + 0.3 * level;
  if (coreImage) {
    const s = px * breath;
    ctx.drawImage(coreImage, (px - s) / 2, (px - s) / 2, s, s);
  }

  const outline = px >= 48;
  for (const brick of BRICKS) {
    // A swell rolls outward from the centre, lifting each brick in turn.
    const wave = pulsing ? Math.pow((Math.sin(elapsedMs / 330 - brick.dist * 11) + 1) / 2, 3) : 0;
    const scale = (1 + swell * wave) * throb;
    const w = brick.w * px * scale;
    const h = brick.h * px * scale;
    const x = brick.cx * px * breath + (px - px * breath) / 2 - w / 2;
    const y = brick.cy * px * breath + (px - px * breath) / 2 - h / 2;
    const lift = Math.min(1, 0.45 * wave + 0.5 * level);
    const r = Math.round(brick.r + (120 - brick.r) * lift);
    const g = Math.round(brick.g + (240 - brick.g) * lift);
    const b = Math.round(brick.b + (255 - brick.b) * lift);

    ctx.shadowBlur = wave > 0.05 ? wave * px * 0.035 : 0;
    ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(w, h) / 2.4);
    ctx.fill();
    if (outline) {
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(0.6, h * 0.16);
      ctx.strokeStyle = "rgba(12, 32, 150, 0.85)";
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
}

/**
 * Vita's face: agent.png rebuilt brick by brick on a canvas, so when `pulsing`
 * the bricks themselves swell and glow in a wave rolling out from the centre —
 * the way Claude's or ChatGPT's mark comes alive — instead of a ring pasted
 * around a flat picture. Static (exactly the reference look) otherwise.
 */
export function Mascot({
  size = 64,
  className = "",
  interactive = true,
  pulsing = false,
}: {
  size?: number;
  className?: string;
  interactive?: boolean;
  pulsing?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hopping, setHopping] = useState(false);
  const [coreReady, setCoreReady] = useState(() => coreImage !== null);

  useEffect(() => {
    if (coreReady) return;
    let cancelled = false;
    loadCore().then(() => {
      if (!cancelled) setCoreReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [coreReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const px = Math.round(size * (window.devicePixelRatio || 1));
    if (canvas.width !== px || canvas.height !== px) {
      canvas.width = px;
      canvas.height = px;
    }

    if (!pulsing || prefersReducedMotion()) {
      drawMascot(ctx, px, 0, false);
      return;
    }

    let raf = 0;
    let start: number | null = null;
    let level = 0;
    const frame = (ts: number) => {
      start ??= ts;
      // Fast attack, slow release — so syllables pop and pauses settle rather than flicker.
      const target = getVoiceLevel();
      level += (target - level) * (target > level ? 0.55 : 0.12);
      drawMascot(ctx, px, ts - start, true, level);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pulsing, size, coreReady]);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (!interactive) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: px * 18, y: py * -18 });
  }

  function handleClick() {
    if (!interactive || hopping) return;
    setHopping(true);
    window.setTimeout(() => setHopping(false), 550);
  }

  return (
    <div
      ref={wrapRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      onClick={handleClick}
      className={`mascot-idle relative shrink-0 ${hopping ? "mascot-hop" : ""} ${className}`}
      style={{ width: size, height: size, transform: `rotate(${tilt.x}deg) rotateX(${tilt.y}deg)` }}
    >
      <canvas ref={canvasRef} style={{ width: size, height: size }} className="block select-none" />
    </div>
  );
}
