/**
 * SYNCLINES — scene.js
 * Hero Section 2 (Audio Visualizer) Canvas 3D Grid & Particle System
 *
 * Exposes window.VisualizerScene lifecycle controller:
 *   - start(): initializes & runs the requestAnimationFrame rendering loop
 *   - pause(): cleanly pauses requestAnimationFrame loop to conserve CPU/GPU
 *   - resume(): resumes loop from paused timestamp
 *   - isActive(): returns boolean whether visualizer is currently rendering
 *   - resize(): re-computes DPR-aware canvas buffer dimensions
 */

(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =====================================================================
     CURSOR GLOW FOLLOWER & MOUSE HOVER STATE
     ===================================================================== */
  var cursorGlow = document.getElementById('cursor-glow');

  var mouseNX = 0.5, mouseNY = 0.5;   // raw normalized target (0..1)
  var mouseSmX = 0.5, mouseSmY = 0.5; // smoothly lerped each frame
  var mousePxX = window.innerWidth * 0.65, mousePxY = window.innerHeight * 0.5;
  var mouseHoverX = window.innerWidth * 0.65, mouseHoverY = window.innerHeight * 0.5;
  var mouseInside = false;
  var mouseHoverIntensity = 0; // 0..1 smooth envelope for hover interactions

  window.addEventListener('mousemove', function (e) {
    if (!isRunning) return;
    mouseInside = true;
    mousePxX = e.clientX;
    mousePxY = e.clientY;
    mouseNX = e.clientX / (W || window.innerWidth);
    mouseNY = e.clientY / (H || window.innerHeight);

    if (cursorGlow) {
      cursorGlow.style.left = e.clientX + 'px';
      cursorGlow.style.top = e.clientY + 'px';
    }
  });

  document.addEventListener('mouseleave', function () {
    mouseInside = false;
  });

  document.addEventListener('mouseenter', function () {
    if (isRunning) mouseInside = true;
  });

  /* =====================================================================
     ACOUSTIC CLICK SHOCKWAVE SYSTEM
     ===================================================================== */
  var ripples = []; // [{ u, v, radius, intensity, startTime }]

  window.addEventListener('pointerdown', function (e) {
    if (!isRunning) return;
    // Ignore clicks inside modals, sidebar, or topbar
    if (e.target.closest('.modal-card, .sidebar, .topbar, #side, #top, .account-card, .video-screen')) return;

    ripples.push({
      u: (e.clientX / (W || 1) - 0.5) * 4,
      v: (e.clientY / (H || 1) - 0.5) * 4,
      radius: 0,
      intensity: 1.0,
      startTime: performance.now() / 1000
    });

    if (ripples.length > 4) ripples.shift();
  });

  /* =====================================================================
     CANVAS SETUP & HIGH-DPI RESIZING
     ===================================================================== */
  var gc = document.getElementById('grid-canvas');
  var ctx = gc ? gc.getContext('2d') : null;

  var pc = document.getElementById('particle-canvas');
  var pctx = pc ? pc.getContext('2d') : null;

  var W = 1819, H = 865, currentDPR = 1;

  function resize() {
    var stage = document.getElementById('stage') || document.body;
    W = stage.clientWidth || window.innerWidth;
    H = stage.clientHeight || window.innerHeight;
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

  window.addEventListener('resize', function () {
    if (isRunning) resize();
  });

  /* =====================================================================
     ATMOSPHERIC PARTICLE SYSTEM
     ===================================================================== */
  var PARTICLE_COUNT = 45;
  var particles = [];

  for (var i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * 1819,
      y: Math.random() * 865,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35 - 0.15,
      radius: Math.random() * 2.2 + 0.8,
      alpha: Math.random() * 0.5 + 0.2,
      baseAlpha: Math.random() * 0.5 + 0.2,
      phase: Math.random() * Math.PI * 2,
      isGreen: Math.random() > 0.65
    });
  }

  function updateAndDrawParticles(time) {
    if (!pctx || !pc) return;
    pctx.clearRect(0, 0, pc.width, pc.height);

    var k = currentDPR;
    pctx.save();
    pctx.scale(k, k);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];

      // Drift
      p.x += p.vx;
      p.y += p.vy;

      // Boundary wrap
      if (p.x < -20) p.x = W + 20;
      if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20;
      if (p.y > H + 20) p.y = -20;

      // Interactive mouse repulsion
      var dx = p.x - mousePxX;
      var dy = p.y - mousePxY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120 && dist > 1) {
        var force = (120 - dist) / 120 * 0.6;
        p.x += (dx / dist) * force * 2;
        p.y += (dy / dist) * force * 2;
      }

      // Luminescence pulsing
      var pulse = prefersReducedMotion ? 0 : Math.sin(time * 1.5 + p.phase) * 0.25;
      var currentAlpha = Math.max(0.08, Math.min(0.85, p.baseAlpha + pulse));

      pctx.beginPath();
      pctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

      if (p.isGreen) {
        pctx.fillStyle = 'rgba(0, 255, 176, ' + currentAlpha + ')';
        pctx.shadowColor = 'rgba(0, 255, 176, 0.4)';
      } else {
        pctx.fillStyle = 'rgba(232, 199, 106, ' + currentAlpha + ')';
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
  var REF_W = 1236;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function mixCol(c1, c2, t) {
    return [
      Math.round(lerp(c1[0], c2[0], t)),
      Math.round(lerp(c1[1], c2[1], t)),
      Math.round(lerp(c1[2], c2[2], t))
    ];
  }

  var GREEN = [52, 214, 150];
  var GOLD = [222, 190, 110];

  /* =====================================================================
     SEEDED PRNG — deterministic per-bar draws
     ===================================================================== */
  var seed = 7;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  var X0_REF = 640, X1_REF = 1100, BAR_SPACING = 3.6;
  var barCount = Math.floor((X1_REF - X0_REF) / BAR_SPACING) + 1;
  var barData = [];

  seed = 7;
  for (var bi = 0; bi < barCount; bi++) {
    barData.push({
      x: X0_REF + bi * BAR_SPACING,
      rndH1: rnd(),
      rndH2: rnd()
    });
  }

  /* Base Peaks (rebalanced to align with waveform center) */
  var peaksBase = {
    831: { topY: 200, botY: 460, mix: 0.75 },
    785: { topY: 245, botY: 415, mix: 0.70 },
    890: { topY: 170, botY: 470, mix: 0.05 },
    898: { topY: 235, botY: 425, mix: 0.15 },
    943: { topY: 225, botY: 425, mix: 0.55 },
    997: { topY: 265, botY: 395, mix: 0.75 },
    860: { topY: 215, botY: 440, mix: 0.25 },
    920: { topY: 205, botY: 450, mix: 0.30 }
  };
  var peakKeys = Object.keys(peaksBase);

  var peakPhases = {};
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
    if (!ctx || !gc) return;

    var scale = W / REF_W;
    var k = scale * currentDPR;
    ctx.setTransform(k, 0, 0, k, 0, 0);

    var visibleH = H / scale;
    ctx.fillStyle = '#060d09';
    ctx.fillRect(0, 0, REF_W, visibleH);

    // Smooth mouse parallax lerp
    mouseSmX += (mouseNX - mouseSmX) * 0.06;
    mouseSmY += (mouseNY - mouseSmY) * 0.06;
    var mOffX = mouseSmX - 0.5;
    var mOffY = mouseSmY - 0.5;

    // High-fidelity hover lerp with momentum
    mouseHoverX += (mousePxX - mouseHoverX) * 0.10;
    mouseHoverY += (mousePxY - mouseHoverY) * 0.10;
    mouseHoverIntensity += ((mouseInside ? 1 : 0) - mouseHoverIntensity) * 0.08;

    var mouseHoverRefX = mouseHoverX / scale;
    var mouseHoverRefY = mouseHoverY / scale;

    /* Update active shockwaves */
    for (var ri = ripples.length - 1; ri >= 0; ri--) {
      var r = ripples[ri];
      var age = time - r.startTime;
      r.radius = age * 3.5;
      r.intensity = Math.max(0, 1.0 - age / 1.6);
      if (age > 1.6) {
        ripples.splice(ri, 1);
      }
    }

    /* WARPED MESH GRID (refined footprint & balanced center) */
    var cx = 870, cy = 330, sx = 295, sy = 110;
    var N = 2.2, step = 0.145;

    var bowlBase = 170;
    var bowlDepth = bowlBase
      + (prefersReducedMotion ? 0 : Math.sin(time * 0.4) * 5 + Math.sin(time * 0.67) * 3);

    var cxOff = mOffX * 14;
    var cyOff = mOffY * 10;

    function P(u, v) {
      var r2 = u * u + v * v;
      var bowl = Math.exp(-r2 / 0.55);

      // Calculate click ripple displacement
      var ripDisp = 0;
      for (var i = 0; i < ripples.length; i++) {
        var rip = ripples[i];
        var du = u - rip.u;
        var dv = v - rip.v;
        var dist = Math.sqrt(du * du + dv * dv);
        var wave = Math.sin((dist - rip.radius) * 6);
        var env = Math.exp(-Math.pow((dist - rip.radius) * 2.5, 2));
        ripDisp += wave * env * rip.intensity * 26;
      }

      var x = (cx + cxOff) + (u - v * 0.85) * sx * 0.95;
      var baseY = (cy + cyOff) + (u + v) * sy + bowl * bowlDepth - 30 * Math.exp(-r2 / 2.2) + ripDisp;

      // Organic, subtle acoustic surface tension reaction
      var hoverDisp = 0;
      if (mouseHoverIntensity > 0.01) {
        var dx = Math.abs(x - mouseHoverRefX);
        var dy = Math.abs(baseY - mouseHoverRefY);
        if (dx < 220 && dy < 220) {
          var dMouse = Math.hypot(dx, dy);
          if (dMouse < 220) {
            var env2 = Math.exp(-Math.pow(dMouse / 110, 2));
            var lift = -4.5 * env2;
            var ripple = prefersReducedMotion ? 0 : Math.sin(time * 2.2 - dMouse * 0.04) * 2.2 * env2;
            hoverDisp = (lift + ripple) * mouseHoverIntensity;
          }
        }
      }

      var y = baseY + hoverDisp;
      return [x, y];
    }

    function alphaAt(x, y) {
      var dx = (x - 880) / 550, dy = (y - 380) / 400;
      var d = Math.sqrt(dx * dx + dy * dy);
      var a = Math.max(0, 1 - d);
      a = Math.pow(a, 0.85);
      if (x < 615) a *= Math.max(0, (x - 340) / 275);
      if (y < 130) a *= Math.max(0, (y - 40) / 90);
      return a;
    }

    function colAt(x, y) {
      var t = Math.min(1, Math.max(0, ((x - 750) / 360) + ((y - 420) / 500)));
      return mixCol(GREEN, GOLD, t);
    }

    ctx.lineWidth = 1.05;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 0;

    for (var pass = 0; pass < 2; pass++) {
      for (var a = -N; a <= N + 1e-6; a += step) {
        var prev = null;
        for (var b = -N; b <= N + 1e-6; b += step / 2) {
          var p = pass === 0 ? P(a, b) : P(b, a);
          if (prev) {
            var midX = (p[0] + prev[0]) / 2;
            var midY = (p[1] + prev[1]) / 2;
            var al = alphaAt(midX, midY);

            if (mouseHoverIntensity > 0.01) {
              var dCursor = Math.hypot(midX - mouseHoverRefX, midY - mouseHoverRefY);
              if (dCursor < 180) {
                var hoverClarity = Math.exp(-Math.pow(dCursor / 85, 2)) * mouseHoverIntensity;
                al = Math.min(0.95, al + hoverClarity * 0.18);
              }
            }

            if (al > 0.02) {
              var col = colAt(midX, midY);
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
    var yc = 330;
    ctx.lineCap = 'round';

    for (var bi2 = 0; bi2 < barData.length; bi2++) {
      var bd = barData[bi2];
      var bx = bd.x;
      var d2 = (bx - 870) / 230;
      var envBar = Math.exp(-d2 * d2 * 2.4);
      var baseH = envBar * (22 + bd.rndH1 * 62) + 1.8 + bd.rndH2 * 2;

      var osc1 = prefersReducedMotion ? 0 : Math.sin(time * 1.8 + bi2 * 0.31) - Math.sin(bi2 * 0.31);
      var osc2 = prefersReducedMotion ? 0 : Math.cos(time * 2.7 + bi2 * 0.47) - Math.cos(bi2 * 0.47);
      var osc3 = prefersReducedMotion ? 0 : Math.sin(time * 0.9 + bi2 * 0.73) - Math.sin(bi2 * 0.73);
      var oscMod = 1 + (osc1 * 0.12 + osc2 * 0.08 + osc3 * 0.05) * envBar;
      var h = baseH * Math.max(0.3, oscMod);

      if (mouseHoverIntensity > 0.01) {
        var distToBarX = Math.abs(bx - mouseHoverRefX);
        var distToBarY = Math.abs(yc - mouseHoverRefY);
        if (distToBarX < 80 && distToBarY < 160) {
          var xFactor = Math.exp(-Math.pow(distToBarX / 45, 2));
          var yFactor = Math.exp(-Math.pow(distToBarY / 100, 2));
          var barHover = xFactor * yFactor * mouseHoverIntensity;
          h *= (1 + barHover * 0.15);
        }
      }

      var t2 = Math.min(1, Math.abs(bx - 880) / 235);
      var col2 = mixCol([62, 232, 166], [240, 214, 130], Math.pow(t2, 0.8));
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
      var pb = peaksBase[kx], px = +kx, ph = peakPhases[kx];
      var baseHeight = pb.botY - pb.topY;
      var centerY = (pb.topY + pb.botY) / 2;

      var pulse1 = prefersReducedMotion ? 0 : Math.sin(time * ph.freq1 + ph.phase1) - Math.sin(ph.phase1);
      var pulse2 = prefersReducedMotion ? 0 : Math.cos(time * ph.freq2 + ph.phase2) - Math.cos(ph.phase2);
      var heightMod = 1 + pulse1 * 0.10 + pulse2 * 0.08;
      heightMod = Math.max(0.6, heightMod);

      var animHeight = baseHeight * heightMod;
      var animTop = centerY - animHeight / 2;
      var animBot = centerY + animHeight / 2;

      var col3 = mixCol([62, 232, 166], [240, 214, 130], pb.mix);
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
    var glGrad = ctx.createLinearGradient(X0_REF, 0, X1_REF, 0);
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
     ANIMATION LOOP & LIFECYCLE MANAGEMENT
     ===================================================================== */
  var animFrameId = null;
  var isRunning = false;
  var startTime = null;
  var totalPausedTime = 0;
  var pauseStartTime = 0;

  function loop(timestamp) {
    if (!isRunning) return;
    animFrameId = requestAnimationFrame(loop);

    if (startTime === null) startTime = timestamp;
    var elapsed = (timestamp - startTime - totalPausedTime) / 1000;

    draw(elapsed);
    updateAndDrawParticles(elapsed);
  }

  function start() {
    if (isRunning) return;
    // Query elements in case DOM was loaded after script
    if (!gc) {
      gc = document.getElementById('grid-canvas');
      ctx = gc ? gc.getContext('2d') : null;
    }
    if (!pc) {
      pc = document.getElementById('particle-canvas');
      pctx = pc ? pc.getContext('2d') : null;
    }
    if (!cursorGlow) {
      cursorGlow = document.getElementById('cursor-glow');
    }

    isRunning = true;
    if (pauseStartTime > 0) {
      totalPausedTime += performance.now() - pauseStartTime;
    }
    resize();
    animFrameId = requestAnimationFrame(loop);
  }

  function pause() {
    if (!isRunning) return;
    isRunning = false;
    pauseStartTime = performance.now();
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (cursorGlow) {
      cursorGlow.style.opacity = '0';
    }
  }

  function resume() {
    start();
  }

  function isActive() {
    return isRunning;
  }

  // Expose global lifecycle object
  window.VisualizerScene = {
    start: start,
    pause: pause,
    resume: resume,
    isActive: isActive,
    resize: resize
  };

  console.log('%c VisualizerScene ready (lifecycle paused on load until tab switch)', 'color:#00ffb0;font-weight:bold;font-size:12px');
})();
