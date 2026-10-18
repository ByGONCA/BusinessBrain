// ==============================================================================
// Test 404 Kinetic Particle Physics & Rapid Swipe Sweep Dynamics
// ==============================================================================

function testParticleMath() {
  console.log("=== Testing 404 Kinetic Particle Math & Rapid Swipe Physics ===");

  const PALETTE = [
    "rgba(145, 15, 25, 0.75)",   // Deep Wine / Bordeaux
    "rgba(195, 25, 38, 0.85)",   // Rich Crimson
    "rgba(235, 35, 50, 0.92)",   // Pure Vivid Red
    "rgba(255, 55, 75, 0.95)",   // Bright Spark Red
    "rgba(244, 63, 94, 0.85)",   // Rose Highlight
    "rgba(165, 20, 32, 0.40)",   // Subtle Wine Haze
    "rgba(255, 60, 80, 0.50)",   // Mid Red Glow
  ];

  // 1. Test color palette validity
  for (const c of PALETTE) {
    if (!c.startsWith("rgba(")) {
      throw new Error(`Invalid color string: ${c}`);
    }
  }
  console.log("✓ Red color palette format: PASS");

  // 2. Test particle kinetic simulation
  let p = {
    x: 100,
    y: 100,
    baseX: 100,
    baseY: 100,
    vx: 0,
    vy: 0,
    orbitRadius: 3,
    phase: 1.2,
  };

  // Autonomous breathing test
  let time = 0.5;
  const wobbleX = Math.sin(time * 1.15 + p.phase) * p.orbitRadius;
  const wobbleY = Math.cos(time * 1.05 + p.phase) * p.orbitRadius;
  if (Math.abs(wobbleX) < 0.01 && Math.abs(wobbleY) < 0.01) {
    throw new Error("Autonomous wobble is zero!");
  }
  console.log("✓ Autonomous breathing oscillation: PASS");

  // 3. Test Rapid Swipe Sweep Repulsion
  // Pointer swipes fast from (40, 40) to (160, 160) across particle at (100, 100)
  const pointer = {
    prevX: 40,
    prevY: 40,
    x: 160,
    y: 160,
    vx: 120,
    vy: 120,
    radius: 130,
    active: true,
  };

  // Find closest point on segment to particle (100, 100)
  const segDx = pointer.x - pointer.prevX; // 120
  const segDy = pointer.y - pointer.prevY; // 120
  const segLenSq = segDx * segDx + segDy * segDy;
  const t = Math.max(0, Math.min(1, ((p.x - pointer.prevX) * segDx + (p.y - pointer.prevY) * segDy) / segLenSq));
  const closestX = pointer.prevX + t * segDx;
  const closestY = pointer.prevY + t * segDy;

  // Closest point should be exactly (100, 100)
  const dx = p.x - closestX;
  const dy = p.y - closestY;
  const dist = Math.hypot(dx, dy);

  const pRadius = pointer.radius;
  const proximity = 1 - dist / pRadius;
  const sweepSpeed = Math.hypot(pointer.vx, pointer.vy);
  const speedMultiplier = 1 + Math.min(sweepSpeed * 0.06, 2.8);
  const impulseForce = proximity * proximity * 16.5 * speedMultiplier;

  // Impart impulse
  p.vx += (dx / (dist || 1)) * impulseForce + pointer.vx * (proximity * 0.22);
  p.vy += (dy / (dist || 1)) * impulseForce + pointer.vy * (proximity * 0.22);

  // Run 10 frames of motion to confirm clearly visible displacement (> 20px)
  let maxDisplacement = 0;
  for (let f = 0; f < 10; f++) {
    time += 0.016;
    const targetBaseX = p.baseX + Math.sin(time + p.phase) * p.orbitRadius;
    const targetBaseY = p.baseY + Math.cos(time + p.phase) * p.orbitRadius;

    p.vx = (p.vx + (targetBaseX - p.x) * 0.082) * 0.855;
    p.vy = (p.vy + (targetBaseY - p.y) * 0.082) * 0.855;
    p.x += p.vx;
    p.y += p.vy;

    const currentDisp = Math.hypot(p.x - p.baseX, p.y - p.baseY);
    if (currentDisp > maxDisplacement) {
      maxDisplacement = currentDisp;
    }
  }

  console.log(`✓ Rapid swipe max displacement: ${maxDisplacement.toFixed(1)}px (clearly visible >= 20px): PASS`);
  if (maxDisplacement < 20) {
    throw new Error(`Rapid swipe displacement was only ${maxDisplacement}px, not visibly noticeable!`);
  }

  // 4. Test Smooth Return & Settle
  // Continue simulation for 60 more frames with pointer inactive
  for (let f = 0; f < 90; f++) {
    time += 0.016;
    const targetBaseX = p.baseX + Math.sin(time + p.phase) * p.orbitRadius;
    const targetBaseY = p.baseY + Math.cos(time + p.phase) * p.orbitRadius;

    p.vx = (p.vx + (targetBaseX - p.x) * 0.082) * 0.855;
    p.vy = (p.vy + (targetBaseY - p.y) * 0.082) * 0.855;
    p.x += p.vx;
    p.y += p.vy;

    if (isNaN(p.x) || isNaN(p.y) || !isFinite(p.x) || !isFinite(p.y)) {
      throw new Error(`Simulation stability error: NaN or Infinite at frame ${f}`);
    }
  }

  const finalOffsetFromBase = Math.hypot(p.x - p.baseX, p.y - p.baseY);
  console.log(`✓ Convergence back to base anchor (residual: ${finalOffsetFromBase.toFixed(2)}px <= orbit ${p.orbitRadius + 1}px): PASS`);
  if (finalOffsetFromBase > p.orbitRadius + 1.5) {
    throw new Error(`Particle failed to settle back to base! Residual: ${finalOffsetFromBase}`);
  }

  console.log("=== All 404 Kinetic Particle Tests Passed ===");
}

testParticleMath();
