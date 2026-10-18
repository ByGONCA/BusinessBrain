"use client";

import * as React from "react";

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  phase: number;
  orbitRadius: number;
  isAmbient: boolean;
}

const PALETTE = [
  "rgba(145, 15, 25, 0.75)",   // Deep Wine / Bordeaux
  "rgba(195, 25, 38, 0.85)",   // Rich Crimson
  "rgba(235, 35, 50, 0.92)",   // Pure Vivid Red
  "rgba(255, 55, 75, 0.95)",   // Bright Spark Red
  "rgba(244, 63, 94, 0.85)",   // Rose Highlight
  "rgba(165, 20, 32, 0.40)",   // Subtle Wine Haze
  "rgba(255, 60, 80, 0.50)",   // Mid Red Glow
];

export function Particle404Canvas() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let time = 0;
    let isVisible = true;
    let lastTime = performance.now();

    // Check reduced motion preference
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Pointer dynamics tracking: position, previous frame position, and cursor velocity
    const pointer = {
      x: -9999,
      y: -9999,
      prevX: -9999,
      prevY: -9999,
      vx: 0,
      vy: 0,
      radius: 130, // Generous interaction radius so effect is immediately tangible
      active: false,
      lastMoved: 0,
    };

    function updatePointerPos(clientX: number, clientY: number) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const currX = clientX - rect.left;
      const currY = clientY - rect.top;

      const now = performance.now();
      const dt = Math.max(now - pointer.lastMoved, 16);

      if (pointer.active && pointer.prevX > -5000) {
        // Track smoothed cursor velocity in pixels per frame (normalized to ~16ms)
        const instantVx = ((currX - pointer.x) / dt) * 16;
        const instantVy = ((currY - pointer.y) / dt) * 16;
        pointer.vx = pointer.vx * 0.35 + instantVx * 0.65;
        pointer.vy = pointer.vy * 0.35 + instantVy * 0.65;
      } else {
        pointer.prevX = currX;
        pointer.prevY = currY;
        pointer.vx = 0;
        pointer.vy = 0;
      }

      pointer.x = currX;
      pointer.y = currY;
      pointer.active = true;
      pointer.lastMoved = now;
    }

    function handlePointerMove(e: PointerEvent) {
      updatePointerPos(e.clientX, e.clientY);
    }

    function handlePointerLeave() {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
      pointer.prevX = -9999;
      pointer.prevY = -9999;
      pointer.vx = 0;
      pointer.vy = 0;
    }

    function handleTouchMove(e: TouchEvent) {
      if (!e.touches[0]) return;
      updatePointerPos(e.touches[0].clientX, e.touches[0].clientY);
    }

    function handleTouchEnd() {
      handlePointerLeave();
    }

    function generateParticles() {
      if (!canvas || width === 0 || height === 0) return;

      const isMobile = width < 768;

      // Offscreen rasterization canvas for sampling glyph points
      const offscreen = document.createElement("canvas");
      offscreen.width = width;
      offscreen.height = height;
      const offCtx = offscreen.getContext("2d");
      if (!offCtx) return;

      offCtx.clearRect(0, 0, width, height);

      let fontSize: number;
      let centerX: number;
      let centerY: number;
      let shearY: number;
      let shearX: number;

      if (isMobile) {
        fontSize = Math.min(width * 0.72, height * 0.38);
        centerX = width * 0.52;
        centerY = height * 0.58;
        shearY = -0.10;
        shearX = 0.16;
      } else {
        fontSize = Math.min(width * 0.46, height * 0.68);
        centerX = width * 0.54;
        centerY = height * 0.44;
        shearY = -0.13;
        shearX = 0.20;
      }

      offCtx.save();
      offCtx.translate(centerX, centerY);
      offCtx.transform(1, shearY, shearX, 1, 0, 0);

      offCtx.font = `900 ${fontSize}px "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      offCtx.textAlign = "center";
      offCtx.textBaseline = "middle";
      offCtx.fillStyle = "#ffffff";
      offCtx.fillText("404", 0, 0);
      offCtx.restore();

      const imgData = offCtx.getImageData(0, 0, width, height);
      const data = imgData.data;

      const newParticles: Particle[] = [];
      const step = isMobile ? 5 : 6;

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const index = (y * width + x) * 4;
          const alpha = data[index + 3];

          if (alpha > 70) {
            const jitterX = (Math.random() - 0.5) * (step * 0.85);
            const jitterY = (Math.random() - 0.5) * (step * 0.85);
            const posX = x + jitterX;
            const posY = y + jitterY;

            const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
            const size = Math.random() * 1.5 + (isMobile ? 0.75 : 0.9);

            newParticles.push({
              x: posX,
              y: posY,
              baseX: posX,
              baseY: posY,
              vx: 0,
              vy: 0,
              size,
              color,
              phase: Math.random() * Math.PI * 2,
              orbitRadius: Math.random() * 3.5 + 1.2,
              isAmbient: false,
            });
          }
        }
      }

      // Atmospheric ambient dust particles around numerals
      const ambientCount = Math.floor(newParticles.length * 0.12);
      for (let i = 0; i < ambientCount; i++) {
        const randBase = newParticles[Math.floor(Math.random() * newParticles.length)];
        if (!randBase) continue;

        const spread = Math.random() * 85 + 20;
        const angle = Math.random() * Math.PI * 2;
        const posX = randBase.baseX + Math.cos(angle) * spread;
        const posY = randBase.baseY + Math.sin(angle) * spread;

        newParticles.push({
          x: posX,
          y: posY,
          baseX: posX,
          baseY: posY,
          vx: 0,
          vy: 0,
          size: Math.random() * 1.3 + 0.5,
          color: "rgba(235, 35, 50, 0.32)",
          phase: Math.random() * Math.PI * 2,
          orbitRadius: Math.random() * 5.5 + 2.0,
          isAmbient: true,
        });
      }

      particles = newParticles;
    }

    function initCanvasSize() {
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx?.scale(dpr, dpr);
      generateParticles();

      if (prefersReducedMotion) {
        renderStaticFrame();
      }
    }

    function renderStaticFrame() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.arc(p.baseX, p.baseY, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
    }

    function animate() {
      if (!ctx || !isVisible) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const now = performance.now();
      const elapsed = Math.min(now - lastTime, 40);
      lastTime = now;
      time += 0.016 * (elapsed / 16);

      ctx.clearRect(0, 0, width, height);

      const isMobile = width < 768;
      const len = particles.length;

      // Pointer sweep line-segment metrics (interpolates between consecutive pointer events)
      // This ensures that EVEN AT RAPID SWIPE SPEEDS, every particle crossed by the path reacts!
      const hasActivePointer = pointer.active && pointer.x > -5000;
      let segDx = 0;
      let segDy = 0;
      let segLenSq = 0;
      let sweepSpeed = 0;

      if (hasActivePointer) {
        segDx = pointer.x - pointer.prevX;
        segDy = pointer.y - pointer.prevY;
        segLenSq = segDx * segDx + segDy * segDy;
        sweepSpeed = Math.sqrt(segLenSq);
      }

      const pRadius = pointer.radius;
      const pRadiusSq = pRadius * pRadius;
      // Boost blast force based on cursor swipe velocity
      const speedMultiplier = 1 + Math.min(sweepSpeed * 0.06, 2.8);

      for (let i = 0; i < len; i++) {
        const p = particles[i];

        // 1. Continuous autonomous breathing & organic oscillation
        const breathAmp = isMobile ? 1.4 : 1.1;
        const wobbleX =
          (Math.sin(time * 1.15 + p.phase) * p.orbitRadius +
          Math.cos(time * 0.75 + p.phase * 1.3) * (p.orbitRadius * 0.45)) * breathAmp;
        const wobbleY =
          (Math.cos(time * 1.05 + p.phase) * p.orbitRadius +
          Math.sin(time * 0.85 + p.phase * 1.2) * (p.orbitRadius * 0.45)) * breathAmp;

        const targetBaseX = p.baseX + wobbleX;
        const targetBaseY = p.baseY + wobbleY;

        // 2. High-performance pointer interaction via segment projection & kinetic impulse
        if (hasActivePointer) {
          // Find closest point on cursor trajectory segment A -> B to particle position
          let closestX = pointer.x;
          let closestY = pointer.y;

          if (segLenSq > 0.5) {
            const t = Math.max(0, Math.min(1, ((p.x - pointer.prevX) * segDx + (p.y - pointer.prevY) * segDy) / segLenSq));
            closestX = pointer.prevX + t * segDx;
            closestY = pointer.prevY + t * segDy;
          }

          const dx = p.x - closestX;
          const dy = p.y - closestY;
          const distSq = dx * dx + dy * dy;

          if (distSq < pRadiusSq && distSq > 0.01) {
            const dist = Math.sqrt(distSq);
            // Non-linear falloff (strongest close to cursor, fading out towards perimeter)
            const proximity = 1 - dist / pRadius;
            const normX = dx / dist;
            const normY = dy / dist;

            // Direct kinetic repulsion impulse injected into particle velocity
            const impulseForce = proximity * proximity * 16.5 * speedMultiplier;
            p.vx += normX * impulseForce;
            p.vy += normY * impulseForce;

            // Organic wake / drag effect in the direction of the swipe
            if (sweepSpeed > 1) {
              const wakeFactor = proximity * 0.22;
              p.vx += pointer.vx * wakeFactor;
              p.vy += pointer.vy * wakeFactor;
            }
          }
        }

        // 3. Elastic restoring spring with critical damping
        // Pulls particle back towards (targetBaseX, targetBaseY) with smooth settle
        const springTension = 0.082;
        const dampingFactor = 0.855;

        p.vx = (p.vx + (targetBaseX - p.x) * springTension) * dampingFactor;
        p.vy = (p.vy + (targetBaseY - p.y) * springTension) * dampingFactor;

        // Clamp maximum instantaneous velocity to prevent visual tearing
        const currentSpeed = Math.hypot(p.vx, p.vy);
        const maxVelocity = 32;
        if (currentSpeed > maxVelocity) {
          p.vx = (p.vx / currentSpeed) * maxVelocity;
          p.vy = (p.vy / currentSpeed) * maxVelocity;
        }

        p.x += p.vx;
        p.y += p.vy;

        // 4. Render particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      // Shift previous pointer position for next frame's sweep calculation
      if (hasActivePointer) {
        pointer.prevX = pointer.x;
        pointer.prevY = pointer.y;
        pointer.vx *= 0.5;
        pointer.vy *= 0.5;
      }

      animationFrameId = requestAnimationFrame(animate);
    }

    // Set up ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      initCanvasSize();
    });
    resizeObserver.observe(container);

    // Visibility change handler to suspend animation in background tabs
    function handleVisibilityChange() {
      isVisible = !document.hidden;
      if (isVisible) {
        lastTime = performance.now();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Re-generate once web fonts finish loading if Geist wasn't available at first frame
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => {
        generateParticles();
      });
    }

    // Initial setup
    initCanvasSize();

    if (!prefersReducedMotion) {
      animationFrameId = requestAnimationFrame(animate);
    }

    // Modern pointer events (covers mouse, stylus, and touch on window)
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("pointercancel", handlePointerLeave, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("pointercancel", handlePointerLeave);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-auto"
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />
    </div>
  );
}
