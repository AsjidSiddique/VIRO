"use client";

import { useEffect, useRef } from "react";

/**
 * SignalField — an animated canvas background depicting a sparse transaction
 * graph: nodes drift slowly like transactions in a stream, thin edges connect
 * nearby nodes, and occasional colored pulses travel along an edge the way a
 * risk signal propagates through a scoring pipeline. Rare red pulses stand in
 * for a transaction crossing the fraud threshold — everything else is routine
 * (cyan/violet) traffic. Purely decorative, never reads as literal data.
 */

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Pulse {
  from: number;
  to: number;
  t: number;
  speed: number;
  color: string;
}

const COLORS = ["#2dd4f0", "#9b7bf6", "#2dd4f0", "#9b7bf6", "#22c55e", "#f43f5e"];

export function SignalField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes: Node[] = [];
    let pulses: Pulse[] = [];
    let raf = 0;

    function countForArea(w: number, h: number) {
      const area = w * h;
      return Math.max(24, Math.min(70, Math.round(area / 26000)));
    }

    function resize() {
      const el = canvas as HTMLCanvasElement;
      width = el.clientWidth;
      height = el.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = width * dpr;
      el.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = countForArea(width, height);
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: Math.random() * 1.4 + 0.6,
      }));
      pulses = [];
    }

    function maybeSpawnPulse() {
      if (pulses.length > 5 || nodes.length < 2) return;
      if (Math.random() > 0.02) return;
      const from = Math.floor(Math.random() * nodes.length);
      let to = Math.floor(Math.random() * nodes.length);
      if (to === from) to = (to + 1) % nodes.length;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      pulses.push({ from, to, t: 0, speed: 0.006 + Math.random() * 0.008, color });
    }

    function frame() {
      ctx!.clearRect(0, 0, width, height);

      // drift nodes
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }

      // edges between nearby nodes
      const linkDist = Math.min(160, width / 6);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < linkDist) {
            const alpha = (1 - dist / linkDist) * 0.14;
            ctx!.strokeStyle = `rgba(137, 147, 166, ${alpha})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      // nodes
      for (const n of nodes) {
        ctx!.fillStyle = "rgba(137, 147, 166, 0.55)";
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      // pulses
      maybeSpawnPulse();
      pulses = pulses.filter((p) => p.t < 1);
      for (const p of pulses) {
        p.t += p.speed;
        const a = nodes[p.from];
        const b = nodes[p.to];
        if (!a || !b) continue;
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        const fade = Math.sin(Math.min(p.t, 1) * Math.PI);

        ctx!.strokeStyle = p.color;
        ctx!.globalAlpha = 0.22 * fade;
        ctx!.lineWidth = 1.2;
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
        ctx!.globalAlpha = 1;

        const grad = ctx!.createRadialGradient(x, y, 0, x, y, 5);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, "transparent");
        ctx!.fillStyle = grad;
        ctx!.globalAlpha = fade;
        ctx!.beginPath();
        ctx!.arc(x, y, 5, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }

      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);

    if (reduceMotion) {
      // Render a single static frame, no loop.
      frame();
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(45,212,240,0.06), transparent 60%), radial-gradient(ellipse 60% 40% at 100% 20%, rgba(155,123,246,0.05), transparent 60%), var(--background)",
          maskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, transparent 30%, black 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, transparent 30%, black 100%)",
          opacity: 0.9,
        }}
      />
    </div>
  );
}
