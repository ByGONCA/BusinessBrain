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
  glowColor: string;
  phase: number;
  orbitRadius: number;
  isAmbient: boolean;
}

const PALETTE = [
  { fill: "rgba(165, 15, 28, 0.78)", glow: "rgba(255, 35, 55, 0.45)" },   // Deep Wine / Bordeaux
  { fill: "rgba(215, 25, 42, 0.88)", glow: "rgba(255, 55, 75, 0.60)" },   // Rich Crimson
  { fill: "rgba(245, 40, 58, 0.94)", glow: "rgba(255, 75, 95, 0.75)" },   // Pure Vivid Red
  { fill: "rgba(255, 70, 90, 0.98)", glow: "rgba(255, 110, 130, 0.85)" }, // Bright Spark Red
  { fill: "rgba(251, 113, 133, 0.90)", glow: "rgba(253, 164, 175, 0.70)" },// Rose Highlight
  { fill: "rgba(180, 22, 36, 0.50)", glow: "rgba(244, 63, 94, 0.35)" },   // Subtle Wine Haze
  { fill: "rgba(255, 80, 100, 0.65)", glow: "rgba(255, 99, 132, 0.55)" }, // Mid Red Glow
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

    // Pointer dynamics tracking: position, velocity, and fluid wake metrics
    const pointer = {
      x: -9999,
      y: -9999,
      prevX: -9999,
      prevY: -9999,
      vx: 0,
      vy: 0,
      radius: 175, // Generous fluid interaction radius for deep water displacement
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
        // Track smoothed cursor velocity in pixels per frame
        const instantVx = ((currX - pointer.x) / dt) * 16;
        const instantVy = ((currY - pointer.y) / dt) * 16;
        pointer.vx = pointer.vx * 0.4 + instantVx * 0.6;
        pointer.vy = pointer.vy * 0.4 + instantVy * 0.6;
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

      // Significantly larger 404 numbers with grand architectural scale
      if (isMobile) {
        fontSize = Math.min(width * 0.88, height * 0.46);
        centerX = width * 0.50;
        centerY = height * 0.54;
        shearY = -0.09;
        shearX = 0.14;
      } else {
        fontSize = Math.min(width * 0.62, height * 0.82);
        centerX = width * 0.55;
        centerY = height * 0.45;
        shearY = -0.11;
        shearX = 0.18;
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
      const step = isMobile ? 4.5 : 4.8;

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const index = (Math.floor(y) * width + Math.floor(x)) * 4;
          const alpha = data[index + 3];

          if (alpha > 65) {
            const jitterX = (Math.random() - 0.5) * (step * 0.8);
            const jitterY = (Math.random() - 0.5) * (step * 0.8);
            const posX = x + jitterX;
            const posY = y + jitterY;

            const swatch = PALETTE[Math.floor(Math.random() * PALETTE.length)];
            const size = Math.random() * 1.6 + (isMobile ? 0.85 : 1.05);

            newParticles.push({
              x: posX,
              y: posY,
              baseX: posX,
              baseY: posY,
              vx: 0,
              vy: 0,
              size,
              color: swatch.fill,
              glowColor: swatch.glow,
              phase: Math.random() * Math.PI * 2,
              orbitRadius: Math.random() * 4.0 + 1.5,
              isAmbient: false,
            });
          }
        }
      }

      // Atmospheric ambient dust particles swirling around numerals
      const ambientCount = Math.floor(newParticles.length * 0.14);
      for (let i = 0; i < ambientCount; i++) {
        const randBase = newParticles[Math.floor(Math.random() * newParticles.length)];
        if (!randBase) continue;

        const spread = Math.random() * 110 + 25;
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
          size: Math.random() * 1.4 + 0.6,
          color: "rgba(235, 35, 50, 0.38)",
          glowColor: "rgba(255, 60, 80, 0.25)",
          phase: Math.random() * Math.PI * 2,
          orbitRadius: Math.random() * 6.0 + 2.5,
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
      time += 0.018 * (elapsed / 16);

      ctx.clearRect(0, 0, width, height);

      const isMobile = width < 768;
      const len = particles.length;

      // Pointer sweep trajectory interpolation for continuous interaction coverage
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

      const pRadius = isMobile ? 135 : 185;
      const pRadiusSq = pRadius * pRadius;
      const speedMultiplier = 1 + Math.min(sweepSpeed * 0.08, 3.2);

      for (let i = 0; i < len; i++) {
        const p = particles[i];

        // 1. Organic water undulating oscillation (ambient liquid currents)
        const waterWaveX =
          Math.sin(time * 1.5 + p.baseY * 0.012 + p.phase) * (p.orbitRadius * 0.85) +
          Math.cos(time * 0.9 + p.baseX * 0.008) * (p.orbitRadius * 0.5);
        const waterWaveY =
          Math.cos(time * 1.3 + p.baseX * 0.012 + p.phase) * (p.orbitRadius * 0.85) +
          Math.sin(time * 0.85 + p.baseY * 0.008) * (p.orbitRadius * 0.5);

        const targetBaseX = p.baseX + waterWaveX;
        const targetBaseY = p.baseY + waterWaveY;

        // 2. High-performance fluid water ripple & repulsion on hover
        if (hasActivePointer) {
          // Find closest point on cursor trajectory segment to particle position
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
            const proximity = 1 - dist / pRadius;
            const normX = dx / dist;
            const normY = dy / dist;

            // Direct kinetic repulsion: particles "flee" away from cursor location
            const fleeImpulse = Math.pow(proximity, 1.3) * 19.5 * speedMultiplier;
            p.vx += normX * fleeImpulse;
            p.vy += normY * fleeImpulse;

            // Water ripple wave propagation: sinusoidal radial ripples simulating liquid surface disturbance
            const ripplePhase = dist * 0.085 - time * 9.0;
            const waterRipple = Math.sin(ripplePhase) * proximity * 9.0;
            p.vx += normX * waterRipple;
            p.vy += normY * waterRipple;

            // Liquid curl / tangential swirl wake (vorticity around moving cursor)
            const tanX = -normY;
            const tanY = normX;
            const swirlStrength = Math.sin(time * 2.8 + p.phase) * proximity * 5.2;
            p.vx += tanX * swirlStrength;
            p.vy += tanY * swirlStrength;

            // Cursor drag wake in travel direction
            if (sweepSpeed > 0.8) {
              const wakeFactor = proximity * 0.28;
              p.vx += pointer.vx * wakeFactor;
              p.vy += pointer.vy * wakeFactor;
            }
          }
        }

        // 3. Fluid restoring spring with viscous liquid damping (surface tension return)
        const fluidTension = 0.052; // gentle spring tension for elastic floating return
        const viscousDamping = 0.875; // liquid resistance damping

        p.vx = (p.vx + (targetBaseX - p.x) * fluidTension) * viscousDamping;
        p.vy = (p.vy + (targetBaseY - p.y) * fluidTension) * viscousDamping;

        // Velocity clamp to prevent visual explosion
        const currentSpeed = Math.hypot(p.vx, p.vy);
        const maxVelocity = 36;
        if (currentSpeed > maxVelocity) {
          p.vx = (p.vx / currentSpeed) * maxVelocity;
          p.vy = (p.vy / currentSpeed) * maxVelocity;
        }

        p.x += p.vx;
        p.y += p.vy;

        // 4. Render particle with dynamic luminescence flare when agitated
        const excitement = Math.min(currentSpeed * 0.14, 1.4);
        const dynamicRadius = p.size * (1 + excitement * 0.55);

        ctx.beginPath();
        ctx.arc(p.x, p.y, dynamicRadius, 0, Math.PI * 2);
        ctx.fillStyle = excitement > 0.4 ? p.glowColor : p.color;
        ctx.fill();
      }

      // Propagate previous pointer position
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

    // Re-generate once web fonts finish loading if font wasn't ready at first frame
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
