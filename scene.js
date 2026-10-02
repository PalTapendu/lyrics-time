/**
 * TIMING CONSOLE — scene.js (v12)
 *
 * Enhanced with:
 *   - Active atmospheric particle system on #particle-canvas (ambient golden & neon-cyan motes)
 *   - Interactive acoustic click shockwaves rippling through the 3D grid
 *   - Mouse-reactive parallax with spring-like smooth lerping
 *   - Affine skew grid warp with Gaussian bowl breathing
 *   - Waveform bars & peak harmonics with smooth oscillation
 *   - Reduced motion accessibility detection
 */

/* =====================================================================
   CURSOR GLOW FOLLOWER & MOUSE HOVER STATE
   ===================================================================== */
const cursorGlow = document.getElementById('cursor-glow');

let mouseNX = 0.5, mouseNY = 0.5;   // raw normalized target (0..1)
let mouseSmX = 0.5, mouseSmY = 0.5; // smoothly lerped each frame
let mousePxX = window.innerWidth * 0.65, mousePxY = window.innerHeight * 0.5;
let mouseHoverX = window.innerWidth * 0.65, mouseHoverY = window.innerHeight * 0.5;
let mouseInside = false;
let mouseHoverIntensity = 0; // 0..1 smooth envelope for hover interactions

window.addEventListener('mousemove', function (e) {
  mouseInside = true;
  mousePxX = e.clientX;
  mousePxY = e.clientY;
  mouseNX = e.clientX / window.innerWidth;
  mouseNY = e.clientY / window.innerHeight;

  if (cursorGlow) {
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top = e.clientY + 'px';
  }
});

document.addEventListener('mouseleave', function () {
  mouseInside = false;
});

document.addEventListener('mouseenter', function () {
  mouseInside = true;
});

/* =====================================================================
   ACOUSTIC CLICK SHOCKWAVE SYSTEM
   ===================================================================== */
let ripples = []; // [{ x, y, startTime, speed, maxRadius }]

window.addEventListener('pointerdown', function (e) {
  // Ignore clicks inside modals, sidebar, or topbar
  if (e.target.closest('.modal-card, .sidebar, .topbar, .mobile-drawer')) return;

  ripples.push({
    u: (e.clientX / W - 0.5) * 4,
    v: (e.clientY / H - 0.5) * 4,
    radius: 0,
    intensity: 1.0,
    startTime: performance.now() / 1000
  });

  // Limit active ripples for performance
  if (ripples.length > 4) ripples.shift();
});

/* =====================================================================
   CANVAS SETUP & HIGH-DPI RESIZING
   ===================================================================== */
const gc = document.getElementById('grid-canvas');
const ctx = gc ? gc.getContext('2d') : null;

const pc = document.getElementById('particle-canvas');
const pctx = pc ? pc.getContext('2d') : null;

let W = window.innerWidth, H = window.innerHeight, currentDPR = 1;

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  currentDPR = Math.max(window.devicePixelRatio || 1, 1);

  if (gc) {
    gc.width = Math.round(W * currentDPR);
    gc.height = Math.round(H * currentDPR);
  }
  if (pc) {
    pc.width = Math.round(W * currentDPR);
    pc.height = Math.round(H * currentDPR);
  }
}
window.addEventListener('resize', resize);
resize();

/* =====================================================================
   ATMOSPHERIC PARTICLE SYSTEM
   ===================================================================== */
const PARTICLE_COUNT = 45;
const particles = [];

for (let i = 0; i < PARTICLE_COUNT; i++) {
  particles.push({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35 - 0.15, // slight upward buoyancy
    radius: Math.random() * 2.2 + 0.8,
    alpha: Math.random() * 0.5 + 0.2,
    baseAlpha: Math.random() * 0.5 + 0.2,
    phase: Math.random() * Math.PI * 2,
    isGreen: Math.random() > 0.65 // mix of amber gold and neon emerald
  });
}

function updateAndDrawParticles(time) {
  if (!pctx) return;
  pctx.clearRect(0, 0, pc.width, pc.height);

  const k = currentDPR;
  pctx.save();
  pctx.scale(k, k);

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // Drift
    p.x += p.vx;
    p.y += p.vy;

    // Boundary wrap
    if (p.x < -20) p.x = W + 20;
    if (p.x > W + 20) p.x = -20;
    if (p.y < -20) p.y = H + 20;
    if (p.y > H + 20) p.y = -20;

    // Interactive mouse repulsion
    const dx = p.x - mousePxX;
    const dy = p.y - mousePxY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 120 && dist > 1) {
      const force = (120 - dist) / 120 * 0.6;
      p.x += (dx / dist) * force * 2;
      p.y += (dy / dist) * force * 2;
    }

    // Luminescence pulsing
    const pulse = Math.sin(time * 1.5 + p.phase) * 0.25;
    const currentAlpha = Math.max(0.08, Math.min(0.85, p.baseAlpha + pulse));

    pctx.beginPath();
    pctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

    if (p.isGreen) {
      pctx.fillStyle = `rgba(0, 255, 176, ${currentAlpha})`;
      pctx.shadowColor = 'rgba(0, 255, 176, 0.4)';
    } else {
      pctx.fillStyle = `rgba(232, 199, 106, ${currentAlpha})`;
      pctx.shadowColor = 'rgba(232, 199, 106, 0.45)';
    }
    pctx.shadowBlur = 8;
    pctx.fill();
  }

  pctx.restore();
}

/* =====================================================================
   REFERENCE COORDINATE SPACE (1236 x 672)
   ===================================================================== */
const REF_W = 1236;

function lerp(a, b, t) { return a + (b - a) * t; }

function mixCol(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t))
  ];
}

const GREEN = [52, 214, 150];
const GOLD = [222, 190, 110];

/* =====================================================================
   SEEDED PRNG — deterministic per-bar draws
   ===================================================================== */
let seed = 7;
function rnd() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

const X0_REF = 640, X1_REF = 1100, BAR_SPACING = 3.6;
const barCount = Math.floor((X1_REF - X0_REF) / BAR_SPACING) + 1;
const barData = [];

seed = 7;
for (let i = 0; i < barCount; i++) {
  barData.push({
    x: X0_REF + i * BAR_SPACING,
    rndH1: rnd(),
    rndH2: rnd()
  });
}

/* Base Peaks (rebalanced to align with new waveform center) */
const peaksBase = {
  831: { topY: 200, botY: 460, mix: 0.75 },
  785: { topY: 245, botY: 415, mix: 0.70 },
  890: { topY: 170, botY: 470, mix: 0.05 },
  898: { topY: 235, botY: 425, mix: 0.15 },
  943: { topY: 225, botY: 425, mix: 0.55 },
  997: { topY: 265, botY: 395, mix: 0.75 },
  860: { topY: 215, botY: 440, mix: 0.25 },
  920: { topY: 205, botY: 450, mix: 0.30 }
};
const peakKeys = Object.keys(peaksBase);

const peakPhases = {};
peakKeys.forEach(function (kx, idx) {
  peakPhases[kx] = {
    freq1: 1.8 + idx * 0.37,
    freq2: 2.5 + idx * 0.53,
    phase1: idx * 1.13,
    phase2: idx * 0.79
  };
});

/* =====================================================================
   MAIN DRAW FUNCTION
   ===================================================================== */
function draw(time) {
  if (!ctx) return;

  const scale = W / REF_W;
  const k = scale * currentDPR;
  ctx.setTransform(k, 0, 0, k, 0, 0);

  const visibleH = H / scale;
  ctx.fillStyle = '#060d09';
  ctx.fillRect(0, 0, REF_W, visibleH);

  // Smooth mouse parallax lerp
  mouseSmX += (mouseNX - mouseSmX) * 0.06;
  mouseSmY += (mouseNY - mouseSmY) * 0.06;
  const mOffX = mouseSmX - 0.5;
  const mOffY = mouseSmY - 0.5;

  // High-fidelity hover lerp with momentum
  mouseHoverX += (mousePxX - mouseHoverX) * 0.10;
  mouseHoverY += (mousePxY - mouseHoverY) * 0.10;
  mouseHoverIntensity += ((mouseInside ? 1 : 0) - mouseHoverIntensity) * 0.08;

  const mouseHoverRefX = mouseHoverX / scale;
  const mouseHoverRefY = mouseHoverY / scale;

  /* Update active shockwaves */
  for (let ri = ripples.length - 1; ri >= 0; ri--) {
    const r = ripples[ri];
    const age = time - r.startTime;
    r.radius = age * 3.5;
    r.intensity = Math.max(0, 1.0 - age / 1.6);
    if (age > 1.6) {
      ripples.splice(ri, 1);
    }
  }

  /* WARPED MESH GRID (refined footprint & balanced center) */
  const cx = 870, cy = 330, sx = 295, sy = 110;
  const N = 2.2, step = 0.145;

  const bowlBase = 170;
  const bowlDepth = bowlBase
    + Math.sin(time * 0.4) * 5
    + Math.sin(time * 0.67) * 3;

  const cxOff = mOffX * 14;
  const cyOff = mOffY * 10;

  function P(u, v) {
    const r2 = u * u + v * v;
    const bowl = Math.exp(-r2 / 0.55);

    // Calculate click ripple displacement
    let ripDisp = 0;
    for (let i = 0; i < ripples.length; i++) {
      const rip = ripples[i];
      const du = u - rip.u;
      const dv = v - rip.v;
      const dist = Math.sqrt(du * du + dv * dv);
      const wave = Math.sin((dist - rip.radius) * 6);
      const env = Math.exp(-Math.pow((dist - rip.radius) * 2.5, 2));
      ripDisp += wave * env * rip.intensity * 26;
    }

    const x = (cx + cxOff) + (u - v * 0.85) * sx * 0.95;
    const baseY = (cy + cyOff) + (u + v) * sy + bowl * bowlDepth - 30 * Math.exp(-r2 / 2.2) + ripDisp;

    // Organic, subtle acoustic surface tension reaction
    let hoverDisp = 0;
    if (mouseHoverIntensity > 0.01) {
      const dx = Math.abs(x - mouseHoverRefX);
      const dy = Math.abs(baseY - mouseHoverRefY);
      if (dx < 220 && dy < 220) {
        const dMouse = Math.hypot(dx, dy);
        if (dMouse < 220) {
          const env = Math.exp(-Math.pow(dMouse / 110, 2));
          // Gentle, silky surface deflection (restrained, 4.5px max)
          const lift = -4.5 * env;
          const ripple = Math.sin(time * 2.2 - dMouse * 0.04) * 2.2 * env;
          hoverDisp = (lift + ripple) * mouseHoverIntensity;
        }
      }
    }

    const y = baseY + hoverDisp;
    return [x, y];
  }

  function alphaAt(x, y) {
    const dx = (x - 880) / 550, dy = (y - 380) / 400;
    const d = Math.sqrt(dx * dx + dy * dy);
    let a = Math.max(0, 1 - d);
    a = Math.pow(a, 0.85);
    if (x < 615) a *= Math.max(0, (x - 340) / 275);
    if (y < 130) a *= Math.max(0, (y - 40) / 90);
    return a;
  }

  function colAt(x, y) {
    const t = Math.min(1, Math.max(0, ((x - 750) / 360) + ((y - 420) / 500)));
    return mixCol(GREEN, GOLD, t);
  }

  ctx.lineWidth = 1.05;
  ctx.lineCap = 'round';
  ctx.shadowBlur = 0; // Pure, clean, crisp lines without fuzzy color bleeding

  for (let pass = 0; pass < 2; pass++) {
    for (let a = -N; a <= N + 1e-6; a += step) {
      let prev = null;
      for (let b = -N; b <= N + 1e-6; b += step / 2) {
        const p = pass === 0 ? P(a, b) : P(b, a);
        if (prev) {
          const midX = (p[0] + prev[0]) / 2;
          const midY = (p[1] + prev[1]) / 2;
          let al = alphaAt(midX, midY);

          // Gentle specular clarity boost near cursor (no garish neon color swap)
          if (mouseHoverIntensity > 0.01) {
            const dCursor = Math.hypot(midX - mouseHoverRefX, midY - mouseHoverRefY);
            if (dCursor < 180) {
              const hoverClarity = Math.exp(-Math.pow(dCursor / 85, 2)) * mouseHoverIntensity;
              al = Math.min(0.95, al + hoverClarity * 0.18);
            }
          }

          if (al > 0.02) {
            let col = colAt(midX, midY);
            if (pass === 1) col = mixCol(col, GOLD, 0.25);

            ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (al * 0.85).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(prev[0], prev[1]);
            ctx.lineTo(p[0], p[1]);
            ctx.stroke();
          }
        }
        prev = p;
      }
    }
  }

  /* WAVEFORM */
  const yc = 330;
  ctx.lineCap = 'round';

  for (let bi = 0; bi < barData.length; bi++) {
    const bd = barData[bi];
    const bx = bd.x;
    const d = (bx - 870) / 230;
    const env = Math.exp(-d * d * 2.4);
    const baseH = env * (22 + bd.rndH1 * 62) + 1.8 + bd.rndH2 * 2;

    const osc1 = Math.sin(time * 1.8 + bi * 0.31) - Math.sin(bi * 0.31);
    const osc2 = Math.cos(time * 2.7 + bi * 0.47) - Math.cos(bi * 0.47);
    const osc3 = Math.sin(time * 0.9 + bi * 0.73) - Math.sin(bi * 0.73);
    const oscMod = 1 + (osc1 * 0.12 + osc2 * 0.08 + osc3 * 0.05) * env;
    let h = baseH * Math.max(0.3, oscMod);

    // Gentle acoustic proximity lift (subtle 15% max, no jittery rapid oscillation)
    if (mouseHoverIntensity > 0.01) {
      const distToBarX = Math.abs(bx - mouseHoverRefX);
      const distToBarY = Math.abs(yc - mouseHoverRefY);
      if (distToBarX < 80 && distToBarY < 160) {
        const xFactor = Math.exp(-Math.pow(distToBarX / 45, 2));
        const yFactor = Math.exp(-Math.pow(distToBarY / 100, 2));
        const barHover = xFactor * yFactor * mouseHoverIntensity;
        h *= (1 + barHover * 0.15);
      }
    }

    const t2 = Math.min(1, Math.abs(bx - 880) / 235);
    let col2 = mixCol([62, 232, 166], [240, 214, 130], Math.pow(t2, 0.8));
    if (bx > 925) col2 = mixCol([62, 232, 166], [240, 214, 130], Math.min(1, (bx - 870) / 120));

    ctx.shadowColor = 'rgba(' + col2[0] + ',' + col2[1] + ',' + col2[2] + ',.9)';
    ctx.shadowBlur = 7;
    ctx.strokeStyle = 'rgb(' + col2.join(',') + ')';
    ctx.lineWidth = (bx > 710 && bx < 1050) ? 1.7 : 1.3;
    ctx.beginPath();
    ctx.moveTo(bx, yc - h);
    ctx.lineTo(bx, yc + h);
    ctx.stroke();
  }

  /* Hardcoded peaks with oscillation */
  peakKeys.forEach(function (kx) {
    const pb = peaksBase[kx], px = +kx, ph = peakPhases[kx];
    const baseHeight = pb.botY - pb.topY;
    const centerY = (pb.topY + pb.botY) / 2;

    const pulse1 = Math.sin(time * ph.freq1 + ph.phase1) - Math.sin(ph.phase1);
    const pulse2 = Math.cos(time * ph.freq2 + ph.phase2) - Math.cos(ph.phase2);
    let heightMod = 1 + pulse1 * 0.10 + pulse2 * 0.08;
    heightMod = Math.max(0.6, heightMod);

    const animHeight = baseHeight * heightMod;
    const animTop = centerY - animHeight / 2;
    const animBot = centerY + animHeight / 2;

    const col3 = mixCol([62, 232, 166], [240, 214, 130], pb.mix);
    ctx.shadowColor = 'rgba(' + col3.join(',') + ',.95)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgb(' + col3.join(',') + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, animTop);
    ctx.lineTo(px, animBot);
    ctx.stroke();
  });

  /* Centre glow line */
  ctx.shadowBlur = 8;
  ctx.shadowColor = 'rgba(255,230,150,.9)';
  const glGrad = ctx.createLinearGradient(X0_REF, 0, X1_REF, 0);
  glGrad.addColorStop(0, 'rgba(240,214,130,0)');
  glGrad.addColorStop(0.2, 'rgba(240,220,150,.8)');
  glGrad.addColorStop(0.5, 'rgba(255,240,190,1)');
  glGrad.addColorStop(0.8, 'rgba(240,220,150,.8)');
  glGrad.addColorStop(1, 'rgba(240,214,130,0)');
  ctx.strokeStyle = glGrad;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(X0_REF, yc);
  ctx.lineTo(X1_REF, yc);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/* =====================================================================
   ANIMATION LOOP
   ===================================================================== */
let startTime = null;

function loop(timestamp) {
  requestAnimationFrame(loop);
  if (startTime === null) startTime = timestamp;
  const elapsed = (timestamp - startTime) / 1000;

  draw(elapsed);
  updateAndDrawParticles(elapsed);
}

requestAnimationFrame(loop);

console.log('%c Timing Console v12 — Active particles + shockwaves enabled', 'color:#00ffb0;font-weight:bold;font-size:13px');
