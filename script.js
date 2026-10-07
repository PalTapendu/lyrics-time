(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  // Rich gradient color calculation: Mint Teal -> Emerald -> Amber -> Coral Pink -> Rich Violet
  function getWaveColor(t) {
    var palette = [
      [0.00, [45, 212, 191]],   // Teal #2dd4bf
      [0.22, [52, 211, 153]],   // Green #34d399
      [0.44, [251, 191, 36]],   // Amber #fbbf24
      [0.66, [244, 63, 94]],    // Rose #f43f5e
      [0.85, [192, 132, 252]],  // Lavender #c084fc
      [1.00, [168, 85, 247]]    // Violet #a855f7
    ];
    for (var i = 1; i < palette.length; i++) {
      if (t <= palette[i][0]) {
        var a = palette[i - 1], b = palette[i];
        var k = (t - a[0]) / (b[0] - a[0]);
        var r = Math.round(a[1][0] + (b[1][0] - a[1][0]) * k);
        var g = Math.round(a[1][1] + (b[1][1] - a[1][1]) * k);
        var bl = Math.round(a[1][2] + (b[1][2] - a[1][2]) * k);
        return 'rgb(' + r + ',' + g + ',' + bl + ')';
      }
    }
    return 'rgb(168, 85, 247)';
  }

  function rnd(s) {
    var x = Math.sin(s * 127.1) * 43758.5453;
    return x - Math.floor(x);
  }

  function createSvgEl(parent, tag, attrs) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) {
      el.setAttribute(k, attrs[k]);
    }
    parent.appendChild(el);
    return el;
  }

  // 1. GENERATE MAIN WAVEFORM BARS
  var wf = document.getElementById('wf');
  var totalBars = 120;
  var baseHeights = [];

  if (wf) {
    for (var i = 0; i < totalBars; i++) {
      var t = i / (totalBars - 1);
      // Accurate acoustic music envelope matching Image 1:
      // t=0..0.25 (Mint Teal): gentle intro ~18-32px
      // t=0.25..0.50 (Amber): steady build ~24-38px
      // t=0.55..0.82 (Magenta/Pink chorus): powerful vocal crescendo peak ~58-64px
      // t=0.85..1.00 (Lilac/Violet outro): smooth taper ~18-26px
      var env = 0.30 + 0.28 * Math.sin(t * Math.PI);
      if (t > 0.52 && t < 0.82) {
        var chorusPeak = Math.sin((t - 0.52) / 0.30 * Math.PI);
        env += chorusPeak * 0.58;
      }
      if (t < 0.05) env *= (0.35 + t / 0.08);
      if (t > 0.92) env *= (0.35 + (1 - t) / 0.12);

      var variation = 0.78 + rnd(i * 3.7) * 0.44;
      var barH = Math.max(7, Math.min(64, env * 44 * variation));
      baseHeights.push(barH);

      createSvgEl(wf, 'rect', {
        x: (i * 5.4).toFixed(1),
        y: (44 - barH / 2).toFixed(1),
        width: '2.8',
        height: barH.toFixed(1),
        rx: '1.4',
        fill: getWaveColor(t)
      });
    }
  }

  // 2. GENERATE TIME AXIS (Total 30s: 0, 5, 10, 15, 20, 25, 30)
  var ax = document.getElementById('ax');
  var timeMarkers = [
    { label: '00:05', x: 108 },
    { label: '00:10', x: 217 },
    { label: '00:15', x: 325 },
    { label: '00:20', x: 433 },
    { label: '00:25', x: 542 },
    { label: '00:30', x: 648 }
  ];

  if (ax) {
    timeMarkers.forEach(function (m) {
      var text = createSvgEl(ax, 'text', {
        x: m.x,
        y: 22,
        'text-anchor': 'middle'
      });
      text.textContent = m.label;

      createSvgEl(ax, 'line', {
        x1: m.x,
        x2: m.x,
        y1: 2,
        y2: 7,
        stroke: '#8a968e',
        'stroke-width': '1.2',
        'stroke-linecap': 'round'
      });
    });
  }

  // 3. GENERATE MINI WAVEFORMS (Lyrics Rows)
  document.querySelectorAll('.lyrics-list .mw').forEach(function (svg, idx) {
    var count = 22;
    var totalW = 76;
    var maxH = 16;
    for (var j = 0; j < count; j++) {
      var env = Math.sin((j / count) * Math.PI);
      var h = Math.max(3, maxH * (0.35 + env * 0.65) * (0.5 + rnd(j + idx * 11) * 0.5));
      var rect = createSvgEl(svg, 'rect', {
        x: (j * (totalW / count)).toFixed(1),
        y: (10 - h / 2).toFixed(1),
        width: '1.8',
        height: h.toFixed(1),
        rx: '0.9'
      });
      rect.style.setProperty('--delay', ((j % 7) * 0.08).toFixed(2) + 's');
      rect.style.setProperty('--dur', (0.42 + ((j * 3) % 5) * 0.09).toFixed(2) + 's');
    }
  });

  // 4. RESPONSIVE ADAPTIVE ENGINE (Laptop, Tablet & Phone Perfect Fit)
  var stage = document.getElementById('stage');
  function fitStage() {
    if (!stage) return;
    var winW = window.innerWidth;
    var winH = window.innerHeight;

    // Mobile Phone (< 768px): Fluid native mobile layout, zero rigid scaling
    if (winW < 768) {
      document.body.classList.add('is-mobile');
      document.body.classList.remove('is-tablet', 'is-desktop');
      stage.style.transform = '';
      stage.style.left = '';
      stage.style.top = '';
      stage.style.width = '';
      stage.style.height = '';
      return;
    }

    // Tablet Portrait (< 1024px and height > width): Fluid tablet layout
    if (winW < 1024 && winH > winW) {
      document.body.classList.add('is-tablet');
      document.body.classList.remove('is-mobile', 'is-desktop');
      stage.style.transform = '';
      stage.style.left = '';
      stage.style.top = '';
      stage.style.width = '';
      stage.style.height = '';
      return;
    }

    // Laptop, Desktop & Tablet Landscape: Scale-to-fit with seamless background
    document.body.classList.add('is-desktop');
    document.body.classList.remove('is-mobile', 'is-tablet');
    var scaleX = winW / 1819;
    var scaleY = winH / 865;
    var scale = Math.min(scaleX, scaleY);
    stage.style.width = '1819px';
    stage.style.height = '865px';
    stage.style.transform = 'scale(' + scale + ')';
    var left = Math.max(0, (winW - 1819 * scale) / 2);
    var top = Math.max(0, (winH - 865 * scale) / 2);
    stage.style.left = left + 'px';
    stage.style.top = top + 'px';
  }
  fitStage();
  window.addEventListener('resize', fitStage);
})();

// ==========================================================================
// INTERACTIVE ENGINE: Mouse Parallax, Audio Playhead, Lyrics Sync, Video Modal
// ==========================================================================
(function () {
  'use strict';
  var stage = document.getElementById('stage');
  var consoleEl = document.getElementById('console');
  var consolePlane = document.querySelector('.console-plane');
  var mainCard = document.querySelector('.main-card');
  var consoleShadow = document.querySelector('.console-contact-shadow');
  var glassExtrusion = document.querySelector('.glass-extrusion');
  var glow = document.getElementById('glow');
  var ph = document.getElementById('ph');
  var tip = document.getElementById('tip');
  var pb = document.getElementById('pb');
  var hl = document.getElementById('hl');
  var pzElements = [].slice.call(document.querySelectorAll('.pz'));
  var lyricRows = [].slice.call(document.querySelectorAll('.lyrics-list .row'));
  var wfBars = [].slice.call(document.querySelectorAll('#wf rect'));

  var prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Task 1: Choreographed Page-Load Assembly Timer
  // Releases entrance animation locks right as the entrance choreography completes (~1000ms)
  // so the landing pop-in flows directly and fluidly into ambient floating motion with zero freeze.
  var isPageAssembled = false;
  var assembleTime = 0;

  if (prefersReducedMotion) {
    isPageAssembled = true;
    assembleTime = 0;
    if (stage) stage.classList.add('page-assembled');
  } else {
    setTimeout(function () {
      isPageAssembled = true;
      if (stage) stage.classList.add('page-assembled');
    }, 1000);
  }
  var isPlaying = false;
  var isConsoleHovered = false;
  var straightProgress = 0.0;
  var mouseX = 0, mouseY = 0, currX = 0, currY = 0;
  var targetGlowX = 1400, targetGlowY = 300, glowX = 1400, glowY = 300;
  var totalSeconds = 30.0; // Total 30.0s timeline
  var playheadPercent = 11.5 / 30.0; // Starts at row 2 (00:11.500)
  var lastTimestamp = 0;

  // Expose hero playback state for mini-piano synchronization
  window.isHeroSongPlaying = function () {
    return isPlaying;
  };

  function getStageRect() {
    return stage.getBoundingClientRect();
  }

  function getRelativeCoord(e) {
    var r = getStageRect();
    var scale = r.width / 1819;
    return {
      x: (e.clientX - r.left) / scale,
      y: (e.clientY - r.top) / scale
    };
  }

  // Mouse Parallax & Console Hover Tracker
  window.addEventListener('mousemove', function (e) {
    var p = getRelativeCoord(e);
    targetGlowX = p.x;
    targetGlowY = p.y;
    mouseX = Math.max(-1, Math.min(1, (p.x / 1819) * 2 - 1));
    mouseY = Math.max(-1, Math.min(1, (p.y / 865) * 2 - 1));

    // Console bounds in stage coordinates (left: 850, top: 198, w: 805, h: 534)
    // 32px hysteresis buffer prevents boundary flicker during rotation
    var buffer = isConsoleHovered ? 28 : -8;
    var inConsole = (
      p.x >= (848 - buffer) &&
      p.x <= (1655 + buffer) &&
      p.y >= (195 - buffer) &&
      p.y <= (732 + buffer)
    );
    isConsoleHovered = inConsole;
  });

  document.addEventListener('mouseleave', function () {
    isConsoleHovered = false;
  });

  if (mainCard) {
    mainCard.addEventListener('pointerenter', function () {
      isConsoleHovered = true;
    });
  }

  // Time format helper (MM:SS.mmm)
  function formatTimestamp(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds - m * 60;
    var mm = (m < 10 ? '0' : '') + m;
    var ss = (s < 10 ? '0' : '') + s.toFixed(3);
    return mm + ':' + ss;
  }

  // Update Scrubber Playhead Position
  function updatePlayhead(percent) {
    playheadPercent = Math.max(0, Math.min(1, percent));
    var wfWidth = 650;
    var xPos = playheadPercent * wfWidth;
    if (ph) {
      ph.style.transform = 'translateX(' + xPos + 'px)';
    }
    if (tip) {
      tip.textContent = formatTimestamp(playheadPercent * totalSeconds);
    }
  }
  updatePlayhead(11.5 / 30.0);

  // Dynamic Waveform Audio Bars (Reacts musically to acoustic guitar, bass & chimes)
  var baseH = wfBars.map(function (r) { return +r.getAttribute('height') || 30; });
  function pulseWaveform(timeSec, audioTime) {
    var curTime = (audioTime !== undefined && audioTime !== null) ? audioTime : timeSec;
    var centerBar = playheadPercent * wfBars.length;

    // Acoustic musical rhythm pulses (96 BPM: Beat = 0.625s)
    var beatPhase = curTime * (96 / 60) * Math.PI * 2;
    var bassPulse = Math.pow(Math.max(0, Math.sin(beatPhase)), 4) * 0.42;
    var strumPulse = Math.pow(Math.max(0, Math.sin(beatPhase + Math.PI * 0.5)), 3) * 0.36;

    wfBars.forEach(function (bar, idx) {
      var dist = Math.abs(idx - centerBar);
      var proximity = Math.max(0, 1 - dist / 14);

      // Low frequency bars (0..35): Deep bass reaction
      var bassMod = (idx < 35) ? bassPulse * (1 - idx / 35) : 0;
      // Mid frequency bars (36..80): Acoustic strumming rhythm
      var midMod = (idx >= 30 && idx < 85) ? strumPulse * 0.75 : 0;
      // High frequency bars (81..120): Shimmering treble chimes
      var highMod = (idx >= 80) ? Math.sin(curTime * 14 + idx * 0.8) * 0.16 : 0;

      var mult = isPlaying
        ? (1 + 0.32 * proximity + bassMod + midMod + highMod)
        : 1;

      var newH = Math.max(5, Math.min(88, baseH[idx] * mult));
      bar.setAttribute('height', newH.toFixed(1));
      bar.setAttribute('y', (44 - newH / 2).toFixed(1));
    });
  }

  // Ambient Particles in Canvas Background (4K Retina HiDPI Edition)
  var bgCanvas = document.getElementById('bg');
  var bgCtx = bgCanvas ? bgCanvas.getContext('2d') : null;
  var dpr = Math.min(window.devicePixelRatio || 1, 2.5);

  function setupCanvasResolution() {
    if (!bgCanvas || !bgCtx) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    bgCanvas.width = Math.round(1819 * dpr);
    bgCanvas.height = Math.round(865 * dpr);
    bgCanvas.style.width = '1819px';
    bgCanvas.style.height = '865px';
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setupCanvasResolution();
  window.addEventListener('resize', setupCanvasResolution);

  var particles = [];
  var colors = ['16,185,129', '217,119,6', '225,29,72', '124,58,237', '16,185,129'];

  if (bgCtx) {
    for (var i = 0; i < 30; i++) {
      var isSmall = i >= 18;
      particles.push({
        x: Math.random() * 1819,
        y: Math.random() * 865,
        r: isSmall ? 1.5 + Math.random() * 2 : 28 + Math.random() * 45,
        color: isSmall ? '255,245,210' : colors[i % colors.length],
        alpha: isSmall ? 0.65 : 0.04 + Math.random() * 0.05,
        vx: (Math.random() - 0.5) * 0.25,
        vy: isSmall ? -0.15 - Math.random() * 0.2 : (Math.random() - 0.5) * 0.18,
        phase: Math.random() * 6,
        isSmall: isSmall
      });
    }
  }

  function renderBackgroundParticles(timeSec) {
    if (!bgCtx) return;
    bgCtx.clearRect(0, 0, 1819, 865);
    particles.forEach(function (p) {
      p.x += p.vx;
      p.y += p.vy + (p.isSmall ? 0 : Math.sin(timeSec * 0.5 + p.phase) * 0.15);
      if (p.x < -150) p.x = 1969;
      if (p.x > 1969) p.x = -150;
      if (p.y < -150) p.y = 1015;
      if (p.y > 1015) p.y = -150;

      // Mouse repulsion
      var dx = p.x - glowX, dy = p.y - glowY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 220 && dist > 1) {
        p.x += (dx / dist) * (220 - dist) * 0.012;
        p.y += (dy / dist) * (220 - dist) * 0.012;
      }

      var alpha = p.alpha * (0.8 + 0.2 * Math.sin(timeSec * (p.isSmall ? 2.5 : 0.8) + p.phase));
      if (p.isSmall) {
        bgCtx.fillStyle = 'rgba(' + p.color + ',' + alpha + ')';
        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        bgCtx.fill();
      } else {
        var grad = bgCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        grad.addColorStop(0, 'rgba(' + p.color + ',' + alpha + ')');
        grad.addColorStop(1, 'rgba(' + p.color + ',0)');
        bgCtx.fillStyle = grad;
        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        bgCtx.fill();
      }
    });
  }

  // Animation Loop
  function mainLoop(now) {
    var timeSec = now / 1000;
    var dt = Math.min(0.05, timeSec - lastTimestamp);
    lastTimestamp = timeSec;

    // View-aware optimization: skip per-frame Hero 1 DOM mutations when not on hero1
    if (currentActiveView !== 'hero1') {
      if (isModalOpen) renderVideoModalVisualizer(timeSec);
      requestAnimationFrame(mainLoop);
      return;
    }

    // Smooth lerp mouse coordinates (lerp ~0.08)
    currX += (mouseX - currX) * 0.08;
    currY += (mouseY - currY) * 0.08;
    glowX += (targetGlowX - glowX) * 0.12;
    glowY += (targetGlowY - glowY) * 0.12;

    // Smoothly interpolate straightProgress (0 = 3D perspective tilt & floating, 1 = straight/flat)
    var targetStraight = isConsoleHovered ? 1.0 : 0.0;
    var lerpFactor = 1 - Math.exp(-Math.max(0.001, dt) * 14.0);
    straightProgress += (targetStraight - straightProgress) * lerpFactor;
    if (Math.abs(targetStraight - straightProgress) < 0.015) {
      straightProgress = targetStraight;
    }
    var blend = 1.0 - straightProgress;

    // Toggle .is-straight class on #console for CSS-level crisp zero-Z flattening & glare elimination
    if (consoleEl) {
      consoleEl.classList.toggle('is-straight', straightProgress === 1.0);
    }

    // Amplitude Ease-In Safety Net & Phase Sync at entrance completion handoff (~1000ms)
    var idleEase = 0;
    var idleDeltaTime = 0;
    if (isPageAssembled) {
      if (prefersReducedMotion) {
        idleEase = 1.0;
        idleDeltaTime = 0;
      } else {
        if (assembleTime === 0) {
          assembleTime = timeSec;
        }
        idleDeltaTime = Math.max(0, timeSec - assembleTime);
        var rampDuration = 0.65; // 650ms smooth organic ease-in
        if (idleDeltaTime >= rampDuration) {
          idleEase = 1.0;
        } else {
          var t = idleDeltaTime / rampDuration;
          idleEase = t * t * (3.0 - 2.0 * t); // Smoothstep (zero initial velocity, zero terminal acceleration)
        }
      }
    }

    // Organic ambient floating & breathing wave (smoothly attenuated when straightening and ramped in at handoff)
    var idleY = prefersReducedMotion ? 0 : Math.sin(idleDeltaTime * 0.8) * 0.45 * idleEase;
    var idleX = prefersReducedMotion ? 0 : Math.sin(idleDeltaTime * 0.6) * 0.25 * idleEase;
    var idleFloatY = prefersReducedMotion ? 0 : Math.sin(idleDeltaTime * 1.2) * 2.5 * idleEase;

    // When NOT hovered (blend = 1): Full 3D car-dashboard tilt (-10.84deg, -1.90deg, -1.07deg) + mouse parallax + ambient breathing float
    // When HOVERED (blend = 0): Smoothly straightens out to 0deg (front/straight) with 100% crystal-clear sharpness
    var curTiltY = (-10.84 + (currX * 2.2) * idleEase + idleY) * blend;
    var curTiltX = (-1.90 + (-currY * 1.8) * idleEase + idleX) * blend;
    var curTiltZ = (-1.07) * blend;
    var curTy = (idleFloatY) * blend;

    // Gate: Skip inline transform writes to 3D console plane & shadows until entrance sequence finishes (page-assembled)
    if (isPageAssembled) {
      if (consolePlane) {
        var nextPlaneTransform = (straightProgress === 1.0)
          ? 'rotateY(0deg) rotateX(0deg) rotateZ(0deg) translateY(0px)'
          : 'rotateY(' + curTiltY.toFixed(3) + 'deg) rotateX(' + curTiltX.toFixed(3) + 'deg) rotateZ(' + curTiltZ.toFixed(3) + 'deg) translateY(' + curTy.toFixed(2) + 'px)';

        if (consolePlane._lastTransform !== nextPlaneTransform) {
          consolePlane.style.transform = nextPlaneTransform;
          consolePlane._lastTransform = nextPlaneTransform;
        }
      }

      if (consoleShadow) {
        var shadowRot = 1.5 * blend;
        var shadowZ = -25 - 10 * blend;
        var shadowScale = 1.0 - 0.02 * straightProgress;
        var shadowOpacity = 1.0 - 0.15 * straightProgress;
        var nextShadowTransform = 'translateZ(' + shadowZ.toFixed(1) + 'px) rotate(' + shadowRot.toFixed(2) + 'deg) scale(' + shadowScale.toFixed(3) + ')';
        var nextShadowOpacity = shadowOpacity.toFixed(2);

        if (consoleShadow._lastTransform !== nextShadowTransform) {
          consoleShadow.style.transform = nextShadowTransform;
          consoleShadow._lastTransform = nextShadowTransform;
        }
        if (consoleShadow._lastOpacity !== nextShadowOpacity) {
          consoleShadow.style.opacity = nextShadowOpacity;
          consoleShadow._lastOpacity = nextShadowOpacity;
        }
      }

      if (glassExtrusion) {
        var nextGlassTransform, nextGlassShadow;
        if (straightProgress === 1.0) {
          nextGlassTransform = 'translateZ(-2px) translate(0px, 0px)';
          nextGlassShadow = '0 24px 55px rgba(50, 75, 55, 0.16), 0 4px 14px rgba(0, 0, 0, 0.05)';
        } else {
          var extX = 4 * blend;
          var extY = 4 * blend;
          var extZ = -2 - 9 * blend;
          nextGlassTransform = 'translateZ(' + extZ.toFixed(1) + 'px) translate(' + extX.toFixed(2) + 'px, ' + extY.toFixed(2) + 'px)';
          nextGlassShadow = blend > 0.5
            ? '-18px 36px 65px rgba(50, 75, 55, 0.20), -4px 10px 22px rgba(0, 0, 0, 0.07)'
            : '0 24px 55px rgba(50, 75, 55, 0.16), 0 4px 14px rgba(0, 0, 0, 0.05)';
        }

        if (glassExtrusion._lastTransform !== nextGlassTransform) {
          glassExtrusion.style.transform = nextGlassTransform;
          glassExtrusion._lastTransform = nextGlassTransform;
        }
        if (glassExtrusion._lastShadow !== nextGlassShadow) {
          glassExtrusion.style.boxShadow = nextGlassShadow;
          glassExtrusion._lastShadow = nextGlassShadow;
        }
      }
    }

    if (mainCard) {
      var glarePctX = Math.max(0, Math.min(100, 50 + currX * 25)).toFixed(1) + '%';
      var glarePctY = Math.max(0, Math.min(100, 40 + currY * 25)).toFixed(1) + '%';
      if (mainCard._lastGlareX !== glarePctX) {
        mainCard.style.setProperty('--glare-x', glarePctX);
        mainCard._lastGlareX = glarePctX;
      }
      if (mainCard._lastGlareY !== glarePctY) {
        mainCard.style.setProperty('--glare-y', glarePctY);
        mainCard._lastGlareY = glarePctY;
      }
    }

    // FLOATING ELEMENTS & HEADPHONES:
    // Move responsively with mouse cursor parallax (data-d depth, data-r rotation)
    // PLUS smooth continuous organic floating animation wave
    // GATED: Only compute and write transforms once page entrance has assembled
    if (isPageAssembled) {
      pzElements.forEach(function (el) {
        if (el.dataset.initTransform === undefined) {
          el.dataset.initTransform = el.style.transform || '';
        }
        var depth = +el.dataset.d || 0;
        var rot = +el.dataset.r || 0;
        var baseT = el.dataset.initTransform ? (el.dataset.initTransform + ' ') : '';

        var pzFloatY = prefersReducedMotion ? 0 : Math.sin(idleDeltaTime * 1.5 + depth * 0.4) * (2.2 + Math.abs(depth) * 0.18) * idleEase;
        var pzFloatX = prefersReducedMotion ? 0 : Math.cos(idleDeltaTime * 1.2 + depth * 0.4) * (1.2 + Math.abs(depth) * 0.1) * idleEase;
        var pzRot = (rot && !prefersReducedMotion) ? Math.sin(idleDeltaTime * 0.9 + depth * 0.2) * 0.35 * idleEase : 0;

        var tx = (-currX * depth) * idleEase + pzFloatX;
        var ty = (-currY * depth * 0.6) * idleEase + pzFloatY;
        var tr = (rot ? currX * rot : 0) * idleEase + pzRot;

        // Dynamic adaptive placement for annotations:
        // In tilted state: sits closely and beautifully aligned to the 3D instrument card.
        // In straight state: smoothly glides outward/away for generous breathing room.
        if (el.id === 'hand-top') {
          tx += (-36 * straightProgress);
          ty += (-24 * straightProgress);
        } else if (el.id === 'hand-bottom') {
          tx += (-14 * straightProgress);
          ty += (-6 * straightProgress);
        }

        el.style.transform = baseT + 'translate(' + tx.toFixed(2) + 'px, ' + ty.toFixed(2) + 'px)' +
          (tr ? ' rotate(' + tr.toFixed(2) + 'deg)' : '');
      });
    }

    if (glow) {
      glow.style.transform = 'translate(' + (glowX - 220) + 'px, ' + (glowY - 220) + 'px)';
    }

    if (isPlaying) {
      var currentAudioTime = (heroAudio && !heroAudio.paused) ? heroAudio.currentTime : (playheadPercent * totalSeconds + dt);
      var nextPct = (heroAudio && !heroAudio.paused) ? (heroAudio.currentTime / totalSeconds) : (playheadPercent + dt / totalSeconds);
      if (nextPct >= 1) {
        nextPct = 0;
        if (heroAudio) heroAudio.currentTime = 0;
        syncPianoToTime(0);
      }
      updatePlayhead(nextPct);

      // Auto-sync lyrics row, spoken voice & piano keys as song progresses
      checkLyricProgression(currentAudioTime);
      checkPianoSongSync(currentAudioTime);
      pulseWaveform(timeSec, currentAudioTime);
    }

    if (!prefersReducedMotion) renderBackgroundParticles(timeSec);

    // Video modal visualizer animation if open
    if (isModalOpen) renderVideoModalVisualizer(timeSec);

    requestAnimationFrame(mainLoop);
  }
  requestAnimationFrame(mainLoop);

  // ==========================================================================
  // IN-BROWSER CD-QUALITY STEREO ACOUSTIC AUDIO ENGINE ("Dreams – Acoustic Version")
  // Generates real 44.1kHz 16-bit Stereo PCM WAV audio with authentic acoustic upright piano,
  // warm double bass, soft acoustic plucks, and sweet singing leads (30.0s Total Duration).
  // ==========================================================================
  var heroAudio = null;
  var heroAudioUrl = null;

  // 30-Second Peaceful & Happy Piano Score (C Major, 96 BPM)
  // Maps directly to the mini-piano keys: C4, D4, E4, F4, G4, A4, B4
  var songPianoNotes = [
    // Bar 0 Intro: Peaceful morning sunshine arpeggio (0.0s - 2.5s)
    { time: 0.000, note: 'C4', freq: 261.63 },
    { time: 0.625, note: 'E4', freq: 329.63 },
    { time: 1.250, note: 'G4', freq: 392.00 },
    { time: 1.875, note: 'C4', freq: 261.63 },

    // Bar 1 & 2: Lyric Line 1 starts at 00:02.500 ("I've been walking in the dark")
    { time: 2.500, note: 'C4', freq: 261.63 },
    { time: 3.125, note: 'E4', freq: 329.63 },
    { time: 3.750, note: 'G4', freq: 392.00 },
    { time: 4.375, note: 'E4', freq: 329.63 },
    { time: 5.000, note: 'D4', freq: 293.66 },
    { time: 5.625, note: 'G4', freq: 392.00 },
    { time: 6.250, note: 'B4', freq: 493.88 },

    // Bar 3 & 4: Lyric Line 2 starts at 00:07.000 ("Searching for a little light")
    { time: 7.000, note: 'A4', freq: 440.00 },
    { time: 7.625, note: 'E4', freq: 329.63 },
    { time: 8.250, note: 'C4', freq: 261.63 },
    { time: 8.875, note: 'E4', freq: 329.63 },
    { time: 9.500, note: 'F4', freq: 349.23 },
    { time: 10.125, note: 'A4', freq: 440.00 },
    { time: 10.750, note: 'C4', freq: 261.63 },

    // Bar 5 & 6: Lyric Line 3 starts at 00:11.500 ("And now I see the morning")
    { time: 11.500, note: 'C4', freq: 261.63 },
    { time: 12.125, note: 'G4', freq: 392.00 },
    { time: 12.750, note: 'E4', freq: 329.63 },
    { time: 13.375, note: 'G4', freq: 392.00 },
    { time: 14.000, note: 'D4', freq: 293.66 },
    { time: 14.625, note: 'G4', freq: 392.00 },
    { time: 15.250, note: 'B4', freq: 493.88 },

    // Bar 7 & 8: Lyric Line 4 starts at 00:16.000 ("It's gonna be alright")
    { time: 16.000, note: 'F4', freq: 349.23 },
    { time: 16.625, note: 'A4', freq: 440.00 },
    { time: 17.250, note: 'G4', freq: 392.00 },
    { time: 17.875, note: 'F4', freq: 349.23 },
    { time: 18.500, note: 'G4', freq: 392.00 },
    { time: 19.125, note: 'E4', freq: 329.63 },
    { time: 19.750, note: 'D4', freq: 293.66 },

    // Bar 9 & 10: Lyric Line 5 starts at 00:20.500 ("The world is ours tonight")
    { time: 20.500, note: 'C4', freq: 261.63 },
    { time: 21.125, note: 'E4', freq: 329.63 },
    { time: 21.750, note: 'G4', freq: 392.00 },
    { time: 22.375, note: 'A4', freq: 440.00 },
    { time: 23.000, note: 'G4', freq: 392.00 },
    { time: 23.625, note: 'E4', freq: 329.63 },
    { time: 24.250, note: 'D4', freq: 293.66 },

    // Bar 11: Lyric Line 6 starts at 00:25.000 ("We'll chase the dreams together")
    { time: 25.000, note: 'F4', freq: 349.23 },
    { time: 25.625, note: 'A4', freq: 440.00 },
    { time: 26.250, note: 'B4', freq: 493.88 },
    { time: 26.875, note: 'G4', freq: 392.00 },

    // Bar 12: Sweet, happy cadence & resolution into C Major (27.5s - 30.0s)
    { time: 27.500, note: 'E4', freq: 329.63 },
    { time: 28.125, note: 'D4', freq: 293.66 },
    { time: 28.750, note: 'C4', freq: 261.63 },
    { time: 29.200, note: 'G4', freq: 392.00 }
  ];

  function buildDreamsAcousticTrack() {
    if (heroAudioUrl) return heroAudioUrl;

    var sampleRate = 44100;
    var totalDuration = 30.0; // Total 30 seconds
    var numSamples = Math.floor(sampleRate * totalDuration);

    var bufL = new Float32Array(numSamples);
    var bufR = new Float32Array(numSamples);

    // Acoustic Piano Synthesizer:
    // Rich wooden hammer strike, fundamental + rich acoustic harmonics (2nd, 3rd, 4th, 5th),
    // slight trichord detuning, and frequency-dependent exponential decay
    function addPianoKey(freq, startSample, vel, decaySec, pan) {
      if (!freq) return;
      var durationSamples = Math.min(numSamples - startSample, Math.floor(sampleRate * decaySec));
      var panL = 0.5 - pan * 0.35;
      var panR = 0.5 + pan * 0.35;
      var f1 = freq;
      var f2 = freq * 1.0018; // Dual-string acoustic trichord chorusing

      for (var s = 0; s < durationSamples; s++) {
        var t = s / sampleRate;
        // Felt hammer contact transient
        var hammer = (t < 0.012) ? (1.0 - t / 0.012) * 0.16 : 0;
        // String vibrations with physical harmonic damping
        var h1 = (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t)) * 0.5 * Math.exp(-t * (1.6 / decaySec));
        var h2 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.38 * Math.exp(-t * (3.4 / decaySec));
        var h3 = Math.sin(2 * Math.PI * freq * 3 * t) * 0.18 * Math.exp(-t * (5.5 / decaySec));
        var h4 = Math.sin(2 * Math.PI * freq * 4 * t) * 0.08 * Math.exp(-t * (8.0 / decaySec));

        var sample = (hammer + h1 + h2 + h3 + h4) * vel * 0.34;
        var idx = startSample + s;
        if (idx < numSamples) {
          bufL[idx] += sample * panL;
          bufR[idx] += sample * panR;
        }
      }
    }

    // Warm Double Bass Synthesizer
    function addBass(freq, startSample, vel, decaySec) {
      if (!freq) return;
      var durationSamples = Math.min(numSamples - startSample, Math.floor(sampleRate * decaySec));
      for (var s = 0; s < durationSamples; s++) {
        var t = s / sampleRate;
        var env = Math.exp(-t * (2.6 / decaySec));
        var val = (Math.sin(2 * Math.PI * freq * t) * 0.78 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.22) * env * vel * 0.32;
        var idx = startSample + s;
        if (idx < numSamples) {
          bufL[idx] += val * 0.5;
          bufR[idx] += val * 0.5;
        }
      }
    }

    // Soft Acoustic Chime & Guitar Pluck
    function addPluck(freq, startSample, vel, decaySec, pan) {
      if (!freq) return;
      var durationSamples = Math.min(numSamples - startSample, Math.floor(sampleRate * decaySec));
      var panL = 0.5 - pan * 0.35;
      var panR = 0.5 + pan * 0.35;

      for (var s = 0; s < durationSamples; s++) {
        var t = s / sampleRate;
        var env = Math.exp(-t * (4.2 / decaySec));
        var wave1 = (2 * Math.abs(2 * ((t * freq) % 1) - 1) - 1);
        var wave2 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.32 * Math.exp(-t * 6);
        var val = (wave1 * 0.65 + wave2) * env * vel * 0.20;
        var idx = startSample + s;
        if (idx < numSamples) {
          bufL[idx] += val * panL;
          bufR[idx] += val * panR;
        }
      }
    }

    // Render the 47 Piano Events across the 30.0s timeline
    songPianoNotes.forEach(function (ev, idx) {
      var startSample = Math.floor(ev.time * sampleRate);
      var pan = ((idx % 5) - 2) * 0.15;
      var decay = (idx === songPianoNotes.length - 1 || idx === songPianoNotes.length - 2) ? 3.8 : 2.4;
      addPianoKey(ev.freq, startSample, 0.88, decay, pan);
    });

    // Render Bass and Acoustic Chords for 12 bars (each 2.5s)
    var barChords = [
      { bass: 65.41, chords: [130.81, 196.00, 261.63, 329.63] }, // Bar 0: C
      { bass: 65.41, chords: [130.81, 196.00, 261.63, 329.63] }, // Bar 1: C
      { bass: 49.00, chords: [98.00, 146.83, 196.00, 293.66] },  // Bar 2: G
      { bass: 55.00, chords: [110.00, 164.81, 220.00, 261.63] }, // Bar 3: Am
      { bass: 43.65, chords: [87.31, 130.81, 174.61, 261.63] },  // Bar 4: F
      { bass: 65.41, chords: [130.81, 196.00, 261.63, 329.63] }, // Bar 5: C
      { bass: 49.00, chords: [98.00, 146.83, 196.00, 293.66] },  // Bar 6: G
      { bass: 43.65, chords: [87.31, 130.81, 174.61, 261.63] },  // Bar 7: F
      { bass: 49.00, chords: [98.00, 146.83, 196.00, 293.66] },  // Bar 8: G
      { bass: 65.41, chords: [130.81, 196.00, 261.63, 329.63] }, // Bar 9: C
      { bass: 55.00, chords: [110.00, 164.81, 220.00, 261.63] }, // Bar 10: Am
      { bass: 43.65, chords: [87.31, 130.81, 174.61, 261.63] }   // Bar 11: F
    ];

    for (var b = 0; b < 12; b++) {
      var barTime = b * 2.50;
      var barSample = Math.floor(barTime * sampleRate);
      var bc = barChords[b];
      addBass(bc.bass, barSample, 0.85, 2.3);
      addBass(bc.bass * 1.5, Math.floor((barTime + 1.25) * sampleRate), 0.60, 1.2);

      // Warm acoustic guitar arpeggios
      bc.chords.forEach(function (chFreq, cIdx) {
        var pluckSample = Math.floor((barTime + cIdx * 0.3125) * sampleRate);
        addPluck(chFreq, pluckSample, 0.65, 1.6, (cIdx - 1.5) * 0.2);
      });
    }

    // Final cadence C Major chord resolve at 28.75s to 30.0s
    addBass(65.41, Math.floor(28.75 * sampleRate), 0.9, 3.2);
    addPluck(130.81, Math.floor(28.75 * sampleRate), 0.7, 2.8, -0.2);
    addPluck(196.00, Math.floor(29.00 * sampleRate), 0.7, 2.5, 0.2);

    // Build Stereo 16-Bit PCM WAV File
    var wavBytes = new Uint8Array(44 + numSamples * 4);
    var view = new DataView(wavBytes.buffer);

    function writeStr(offset, str) {
      for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 4, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 4, true);

    var offset = 44;
    for (var i = 0; i < numSamples; i++) {
      var sL = Math.max(-1, Math.min(1, bufL[i]));
      var sR = Math.max(-1, Math.min(1, bufR[i]));
      view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7FFF, true);
      view.setInt16(offset + 2, sR < 0 ? sR * 0x8000 : sR * 0x7FFF, true);
      offset += 4;
    }

    var blob = new Blob([wavBytes], { type: 'audio/wav' });
    heroAudioUrl = URL.createObjectURL(blob);
    return heroAudioUrl;
  }

  function initHeroAudio() {
    if (!heroAudio) {
      var url = buildDreamsAcousticTrack();
      heroAudio = new Audio(url);
      heroAudio.loop = true;
      heroAudio.volume = 0.90;
    }
  }

  // Pre-generate acoustic audio track in idle time so Play button response is instantaneous
  function scheduleAudioPrewarm() {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(function () {
        initHeroAudio();
      }, { timeout: 2500 });
    } else {
      setTimeout(initHeroAudio, 1400);
    }
  }

  if (document.readyState === 'complete') {
    scheduleAudioPrewarm();
  } else {
    window.addEventListener('load', function () {
      scheduleAudioPrewarm();
    });
  }

  // Spoken vocals removed per user specification: pure peaceful acoustic piano & chords only
  function speakLyric() { }

  // Piano Note & Song Sync Tracker
  var nextPianoNoteIdx = 0;
  var lastSyncedAudioTime = -1;

  function syncPianoToTime(sec) {
    nextPianoNoteIdx = 0;
    while (nextPianoNoteIdx < songPianoNotes.length && songPianoNotes[nextPianoNoteIdx].time < sec) {
      nextPianoNoteIdx++;
    }
    lastSyncedAudioTime = sec;
  }

  function checkPianoSongSync(curTime) {
    if (curTime < lastSyncedAudioTime - 1.0) {
      // Audio looped or seeked back
      syncPianoToTime(curTime);
    }
    lastSyncedAudioTime = curTime;

    while (nextPianoNoteIdx < songPianoNotes.length && curTime >= songPianoNotes[nextPianoNoteIdx].time) {
      var pNote = songPianoNotes[nextPianoNoteIdx];
      if (window.pianoTriggerKey) {
        window.pianoTriggerKey(pNote.note, false, true);
      }
      nextPianoNoteIdx++;
    }
  }

  // Play / Pause Master Toggle
  var playIconSvg = '<svg class="play-icon" width="16" height="18" viewBox="0 0 14 16"><path d="M1 1l12 7-12 7z" fill="#fff"/></svg>';
  var pauseIconSvg = '<svg class="pause-icon" width="16" height="18" viewBox="0 0 14 16"><rect x="1" y="1" width="4" height="14" rx="1" fill="#fff"/><rect x="9" y="1" width="4" height="14" rx="1" fill="#fff"/></svg>';

  function togglePlayState() {
    initHeroAudio();
    isPlaying = !isPlaying;
    if (pb) pb.innerHTML = isPlaying ? pauseIconSvg : playIconSvg;
    if (stage) stage.classList.toggle('playing', isPlaying);

    if (isPlaying) {
      if (heroAudio) {
        var curSec = playheadPercent * totalSeconds;
        heroAudio.currentTime = curSec % 30.0;
        syncPianoToTime(curSec % 30.0);
        heroAudio.play().catch(function (e) {
          console.warn('Hero audio playback note:', e);
        });
      }
    } else {
      if (heroAudio) {
        heroAudio.pause();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      // Reset waveform bars cleanly when paused
      wfBars.forEach(function (bar, idx) {
        bar.setAttribute('height', baseH[idx].toFixed(1));
        bar.setAttribute('y', (44 - baseH[idx] / 2).toFixed(1));
      });
    }
  }

  if (pb) {
    pb.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePlayState();
    });
  }

  // Global Spacebar Key Shortcut
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && !isModalOpen && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      togglePlayState();
    }
  });

  // Interactive Timeline Scrubbing
  var isScrubbing = false;
  var wfContainer = document.querySelector('.waveform-panel');

  function seekFromEvent(e) {
    if (!wfContainer) return;
    var clientX = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX);
    if (clientX === undefined) return;
    var rect = wfContainer.getBoundingClientRect();
    var clickX = clientX - rect.left;
    var pct = Math.max(0, Math.min(1, clickX / rect.width));
    updatePlayhead(pct);
    var targetSec = playheadPercent * totalSeconds;
    checkLyricProgression(targetSec);
    syncPianoToTime(targetSec % 30.0);

    if (heroAudio) {
      heroAudio.currentTime = targetSec % 30.0;
    }
  }

  if (wfContainer) {
    wfContainer.addEventListener('mousedown', function (e) {
      isScrubbing = true;
      seekFromEvent(e);
    });

    window.addEventListener('mousemove', function (e) {
      if (!isScrubbing) return;
      seekFromEvent(e);
    });

    window.addEventListener('mouseup', function () {
      isScrubbing = false;
    });

    wfContainer.addEventListener('touchstart', function (e) {
      isScrubbing = true;
      seekFromEvent(e);
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
      if (!isScrubbing) return;
      seekFromEvent(e);
    }, { passive: true });

    window.addEventListener('touchend', function () {
      isScrubbing = false;
    });
  }

  // Lyrics Row Click Interaction
  var npBadge = document.getElementById('np');
  function setActiveLyricRow(row) {
    lyricRows.forEach(function (r) {
      r.classList.remove('active');
      var dot = r.querySelector('.row-dot');
      if (dot && dot.classList.contains('dot-play')) {
        dot.className = 'row-dot ' + (r.dataset.origDot || 'dot-mint');
        dot.innerHTML = '';
      }
      var mw = r.querySelector('.mw');
      if (mw) mw.classList.remove('hl');
    });

    row.classList.add('active');
    var activeMw = row.querySelector('.mw');
    if (activeMw) activeMw.classList.add('hl');

    if (hl) {
      var rowTop = row.offsetTop;
      hl.style.top = rowTop + 'px';
    }

    // Move Now Playing badge
    if (npBadge && !row.contains(npBadge)) {
      row.insertBefore(npBadge, row.querySelector('.mw'));
    }

    // Convert dot to play button
    var curDot = row.querySelector('.row-dot');
    if (curDot && !curDot.classList.contains('dot-play')) {
      row.dataset.origDot = curDot.className.replace('row-dot ', '');
      curDot.className = 'row-dot dot-play';
      curDot.innerHTML = '<svg width="8" height="9" viewBox="0 0 8 9"><path d="M1 .5l6.5 4-6.5 4z" fill="#fff"/></svg>';
    }
  }

  // Initialize active row sync
  var initActive = document.querySelector('.lyrics-list .row.active');
  if (initActive) {
    setActiveLyricRow(initActive);
  }

  // Auto-progress lyrics based on 30s timestamps
  var rowTimestamps = [2.50, 7.00, 11.50, 16.00, 20.50, 25.00];

  function checkLyricProgression(curTime) {
    var activeIdx = -1;
    for (var k = rowTimestamps.length - 1; k >= 0; k--) {
      if (curTime >= rowTimestamps[k]) {
        activeIdx = k;
        break;
      }
    }

    if (activeIdx !== -1 && lyricRows[activeIdx]) {
      var row = lyricRows[activeIdx];
      if (!row.classList.contains('active')) {
        setActiveLyricRow(row);
      }
    }
  }

  lyricRows.forEach(function (row) {
    row.addEventListener('click', function (e) {
      var isCurrentActive = row.classList.contains('active');
      var isPlayDot = e.target && e.target.closest('.dot-play');

      if (isCurrentActive && isPlayDot) {
        togglePlayState();
        return;
      }

      setActiveLyricRow(row);
      var timeStr = row.getAttribute('data-time') || '00:00';
      var parts = timeStr.split(':');
      var sec = (+parts[0]) * 60 + (+parts[1]);
      updatePlayhead(sec / totalSeconds);

      initHeroAudio();
      if (heroAudio) {
        heroAudio.currentTime = sec % 30.0;
        if (!isPlaying) {
          togglePlayState();
        } else {
          heroAudio.play().catch(function () { });
        }
      }

      syncPianoToTime(sec);
    });
  });


  // ==========================================================================
  // INTERACTIVE STUDIO VIDEO DEMO MODAL (Apple/Linear Tier)
  // ==========================================================================
  var videoModal = document.getElementById('video-modal');
  var watchDemoBtn = document.getElementById('watch-demo-btn');
  var sideVideoBtn = document.getElementById('side-video-btn');
  var closeModalBtn = document.getElementById('close-modal-btn');
  var modalBackdrop = document.querySelector('.modal-backdrop');
  var modalPlayBtn = document.getElementById('modal-play-btn');
  var modalPlayIcon = document.getElementById('modal-play-icon');
  var modalTimeDisplay = document.getElementById('modal-time-display');
  var modalProgressBar = document.getElementById('modal-progress-bar');
  var isModalOpen = false;
  var isModalPlaying = true;

  function openVideoModal() {
    if (!videoModal) return;
    videoModal.classList.add('open');
    isModalOpen = true;
    isModalPlaying = true;
    if (modalPlayIcon) {
      modalPlayIcon.innerHTML = '<rect x="1" y="1" width="4" height="14" rx="1" fill="#fff"/><rect x="9" y="1" width="4" height="14" rx="1" fill="#fff"/>';
    }
  }

  function closeVideoModal() {
    if (!videoModal) return;
    videoModal.classList.remove('open');
    isModalOpen = false;
  }

  if (watchDemoBtn) watchDemoBtn.addEventListener('click', openVideoModal);
  if (sideVideoBtn) sideVideoBtn.addEventListener('click', openVideoModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeVideoModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeVideoModal);

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isModalOpen) closeVideoModal();
  });

  if (modalPlayBtn) {
    modalPlayBtn.addEventListener('click', function () {
      isModalPlaying = !isModalPlaying;
      modalPlayIcon.innerHTML = isModalPlaying
        ? '<rect x="1" y="1" width="4" height="14" rx="1" fill="#fff"/><rect x="9" y="1" width="4" height="14" rx="1" fill="#fff"/>'
        : '<path d="M1 1l12 7-12 7z" fill="#fff"/>';
    });
  }

  // Video Canvas Audio Spectrum Visualizer
  var vCanvas = document.getElementById('video-canvas');
  var vCtx = vCanvas ? vCanvas.getContext('2d') : null;
  var vBars = 64;

  function renderVideoModalVisualizer(timeSec) {
    if (!vCtx) return;
    var w = vCanvas.width;
    var h = vCanvas.height;
    vCtx.clearRect(0, 0, w, h);

    var barWidth = (w / vBars) - 3;
    for (var b = 0; b < vBars; b++) {
      var tNorm = b / vBars;
      var heightMult = isModalPlaying
        ? Math.sin(timeSec * 7 + b * 0.4) * 0.45 + Math.sin(timeSec * 13 + b * 0.8) * 0.25 + 0.65
        : 0.2;
      var barH = Math.max(8, Math.min(h - 20, heightMult * (h * 0.75)));
      var x = b * (barWidth + 3);
      var y = h - barH;

      var grad = vCtx.createLinearGradient(0, y, 0, h);
      grad.addColorStop(0, '#34d399');
      grad.addColorStop(0.5, '#10b981');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.15)');

      vCtx.fillStyle = grad;
      vCtx.beginPath();
      vCtx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
      vCtx.fill();
    }

    // Modal Progress bar animation
    if (isModalPlaying && modalProgressBar) {
      var modalPct = ((timeSec * 0.05) % 1) * 100;
      modalProgressBar.style.width = modalPct.toFixed(1) + '%';
      if (modalTimeDisplay) {
        var curModalSec = (modalPct / 100) * 222;
        modalTimeDisplay.textContent = formatTimestamp(curModalSec) + ' / 03:42.000';
      }
    }
  }

  // ==========================================================================
  // EXPORT TOAST NOTIFICATIONS & BUTTON INTERACTIONS
  // ==========================================================================
  var toast = document.getElementById('toast');
  var toastMsg = document.getElementById('toast-msg');
  var toastTimer = null;

  function showToast(message) {
    if (!toast) return;
    if (toastMsg) toastMsg.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 3200);
  }


  var topUploadBtn = document.getElementById('top-upload-btn');
  var mainUploadBtn = document.getElementById('main-upload-btn');

  // ==========================================================================
  // SIDEBAR, PRODUCTS DROPDOWN & VISUALIZER TASK BAR INTERACTION LOGIC
  // ==========================================================================
  var sideLogo = document.getElementById('side-logo');
  var sideHomeBtn = document.getElementById('side-home-btn');
  var sideVisualizerBtn = document.getElementById('side-visualizer-btn');
  var sidePianoBtn = document.getElementById('side-piano-btn');
  var sideAccountBtn = document.getElementById('side-account-btn');
  var sideInfoBtn = document.getElementById('side-info-btn');

  var visualizerTaskbar = document.getElementById('visualizer-taskbar');
  var taskbarCloseBtn = document.getElementById('visualizer-taskbar-close');
  var taskbarDemoBtn = document.getElementById('taskbar-demo-btn');

  var accountModal = document.getElementById('account-modal');
  var accountCloseBtn = document.getElementById('account-close-btn');

  var dropdownConsoleBtn = document.getElementById('dropdown-console-btn');
  var dropdownVisualizerBtn = document.getElementById('dropdown-visualizer-btn');
  var dropdownPianoBtn = document.getElementById('dropdown-piano-btn');

  var brandHome = document.getElementById('brand-home');

  // Hero 2 Elements
  var demoModal = document.getElementById('demoModal');
  var btnDemo = document.getElementById('btn-demo');
  var demoCloseBtn = document.getElementById('demoCloseBtn');
  var demoDismissBtn = document.getElementById('demoDismissBtn');
  var demoLaunchBtn = document.getElementById('demoLaunchBtn');
  var btnUploadHero = document.getElementById('btn-upload-hero');
  var heroToast = document.getElementById('heroToast');

  // Upload Buttons
  var topUploadBtn = document.getElementById('top-upload-btn');
  var mainUploadBtn = document.getElementById('main-upload-btn');

  /* =====================================================================
     ACTIVE PRODUCT STATE & DYNAMIC HIGHLIGHT MANAGEMENT
     Synchronizes active highlight class across both:
     - Products Dropdown: Sync Lyrics & Script | Audio Visualizer | Live Harmonic Piano
     - Sidebar Navigation: Home (#side-home-btn) | Visualizer (#side-visualizer-btn) | Piano (#side-piano-btn)
     ===================================================================== */
  var currentActiveProduct = 'lyrics'; // 'lyrics' | 'visualizer' | 'piano'

  function updateActiveProduct(product) {
    currentActiveProduct = product;

    // 1. Sync Products Dropdown Menu Items
    if (dropdownConsoleBtn) {
      if (product === 'lyrics') {
        dropdownConsoleBtn.classList.add('active');
      } else {
        dropdownConsoleBtn.classList.remove('active');
      }
    }
    if (dropdownVisualizerBtn) {
      if (product === 'visualizer') {
        dropdownVisualizerBtn.classList.add('active');
      } else {
        dropdownVisualizerBtn.classList.remove('active');
      }
    }
    if (dropdownPianoBtn) {
      if (product === 'piano') {
        dropdownPianoBtn.classList.add('active');
      } else {
        dropdownPianoBtn.classList.remove('active');
      }
    }

    // 2. Sync Sidebar Buttons
    if (sideHomeBtn) {
      if (product === 'lyrics') {
        sideHomeBtn.classList.add('active');
      } else {
        sideHomeBtn.classList.remove('active');
      }
    }
    if (sideVisualizerBtn) {
      if (product === 'visualizer') {
        sideVisualizerBtn.classList.add('active');
      } else {
        sideVisualizerBtn.classList.remove('active');
      }
    }
    if (sidePianoBtn) {
      if (product === 'piano') {
        sidePianoBtn.classList.add('active');
      } else {
        sidePianoBtn.classList.remove('active');
      }
    }

    // 3. Smoothly animate persistent sliding sidebar active indicator
    syncSidebarIndicator(product);
  }

  function syncSidebarIndicator(product) {
    var indicator = document.getElementById('side-active-indicator');
    var firstBtn = document.getElementById('side-home-btn');
    if (!indicator || !firstBtn) return;

    var targetBtn = null;
    if (product === 'lyrics') {
      targetBtn = document.getElementById('side-home-btn');
    } else if (product === 'visualizer') {
      targetBtn = document.getElementById('side-visualizer-btn');
    } else if (product === 'piano') {
      targetBtn = document.getElementById('side-piano-btn');
    } else if (product === 'account') {
      targetBtn = document.getElementById('side-account-btn');
    }

    if (targetBtn) {
      var deltaY = targetBtn.offsetTop - firstBtn.offsetTop;
      if (prefersReducedMotion) {
        indicator.style.transition = 'none';
        indicator.style.transform = 'translate3d(0, ' + deltaY + 'px, 0)';
        indicator.style.opacity = '1';
      } else {
        indicator.style.transition = 'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease, background-color 0.38s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.38s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.38s cubic-bezier(0.4, 0, 0.2, 1)';
        indicator.style.transform = 'translate3d(0, ' + deltaY + 'px, 0)';
        indicator.style.opacity = '1';
      }
    } else {
      indicator.style.opacity = '0';
    }
  }

  window.addEventListener('resize', function () {
    syncSidebarIndicator(currentActiveProduct);
  });

  try {
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (e) {
      prefersReducedMotion = e.matches;
      syncSidebarIndicator(currentActiveProduct);
    });
  } catch (err) {}

  requestAnimationFrame(function () {
    syncSidebarIndicator(currentActiveProduct);
  });

  /* =====================================================================
     VIEW SWITCHER ARCHITECTURE (Single Persistent Shell)
     - Switches between Hero 1 (SyncLines) and Hero 2 (Audio Visualizer)
     - Smooth cross-fade/slide with CSS variable theme transition
     - Pauses/resumes requestAnimationFrame in scene.js
     ===================================================================== */
  var currentActiveView = 'hero1';
  window.__isHero1ViewActive = true;

  // Lazy loading state for Audio Visualizer (scene.js)
  var isVisualizerLoaded = false;
  var isVisualizerLoading = false;

  function loadVisualizerScene(callback) {
    if (isVisualizerLoaded) {
      if (callback) callback();
      return;
    }
    if (isVisualizerLoading) {
      var checkInterval = setInterval(function () {
        if (isVisualizerLoaded) {
          clearInterval(checkInterval);
          if (callback) callback();
        }
      }, 50);
      return;
    }

    isVisualizerLoading = true;
    var overlay = document.getElementById('pageTransitionOverlay');
    var transTitle = overlay ? overlay.querySelector('.trans-title') : null;
    var originalTitle = transTitle ? transTitle.textContent : '';

    if (overlay) {
      if (transTitle) transTitle.textContent = 'Loading Audio Visualizer Engine...';
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('is-active');
    }

    var startTime = performance.now();
    var minDisplayMs = 380; // Smooth handoff, matches editor transition timing

    var script = document.createElement('script');
    script.src = 'scene.js';
    script.async = true;

    function finishLoad(err) {
      var elapsed = performance.now() - startTime;
      var remaining = Math.max(0, minDisplayMs - elapsed);

      setTimeout(function () {
        isVisualizerLoaded = !err;
        isVisualizerLoading = false;

        if (overlay) {
          overlay.classList.remove('is-active');
          overlay.setAttribute('aria-hidden', 'true');
          if (transTitle && originalTitle) transTitle.textContent = originalTitle;
        }

        if (callback) callback(err);
      }, remaining);
    }

    script.onload = function () {
      finishLoad(null);
    };

    script.onerror = function (e) {
      console.error('Failed to dynamically load scene.js', e);
      finishLoad(e || new Error('Failed to load scene.js'));
    };

    document.body.appendChild(script);
  }

  function triggerHeroToast(message) {
    if (!heroToast) return;
    heroToast.textContent = message;
    heroToast.classList.add('show');
    clearTimeout(triggerHeroToast._t);
    triggerHeroToast._t = setTimeout(function () {
      heroToast.classList.remove('show');
    }, 2800);
  }

  function switchView(targetView, productHint) {
    try { window.scrollTo(0, 0); } catch (e) {}
    var viewHero1 = document.getElementById('view-hero1');
    var viewHero2 = document.getElementById('view-hero2');
    var viewPiano = document.getElementById('view-piano');
    var html = document.documentElement;
    var body = document.body;

    function applyHero2View() {
      currentActiveView = 'hero2';
      window.__isHero1ViewActive = false;
      html.setAttribute('data-theme', 'hero2');
      body.setAttribute('data-theme', 'hero2');

      if (viewHero1) {
        viewHero1.classList.remove('is-active');
        viewHero1.setAttribute('aria-hidden', 'true');
      }
      if (viewPiano) {
        viewPiano.classList.remove('is-active');
        viewPiano.setAttribute('aria-hidden', 'true');
      }
      if (viewHero2) {
        viewHero2.classList.add('is-active');
        viewHero2.setAttribute('aria-hidden', 'false');
      }

      updateActiveProduct('visualizer');

      // Start/Resume 3D visualizer canvas loop
      if (window.VisualizerScene) {
        window.VisualizerScene.resume();
      }

      // Sync hash cleanly
      if (window.location.hash !== '#visualizer') {
        try {
          history.pushState({ view: 'hero2' }, '', '#visualizer');
        } catch (err) {
          window.location.hash = 'visualizer';
        }
      }

      triggerHeroToast('Audio Visualizer Engine active • 60 FPS 3D Grid');
    }

    if (targetView === 'hero2') {
      if (!isVisualizerLoaded) {
        updateActiveProduct('visualizer');
        loadVisualizerScene(function () {
          applyHero2View();
        });
      } else {
        applyHero2View();
      }
    } else if (targetView === 'piano') {
      currentActiveView = 'piano';
      window.__isHero1ViewActive = false;
      html.setAttribute('data-theme', 'hero2');
      body.setAttribute('data-theme', 'hero2');

      if (viewHero1) {
        viewHero1.classList.remove('is-active');
        viewHero1.setAttribute('aria-hidden', 'true');
      }
      if (viewHero2) {
        viewHero2.classList.remove('is-active');
        viewHero2.setAttribute('aria-hidden', 'true');
      }
      if (viewPiano) {
        viewPiano.classList.add('is-active');
        viewPiano.setAttribute('aria-hidden', 'false');
      }

      updateActiveProduct('piano');

      // Pause visualizer canvas loop when switching to piano view
      if (window.VisualizerScene) {
        window.VisualizerScene.pause();
      }

      // Enforce muted state whenever piano view becomes active
      if (window.resetPianoMute) {
        window.resetPianoMute();
      }

      if (window.location.hash !== '#piano') {
        try {
          history.pushState({ view: 'piano' }, '', '#piano');
        } catch (err) {
          window.location.hash = 'piano';
        }
      }

      triggerHeroToast('Live Harmonic Piano: Feature in development');
    } else {
      // targetView === 'hero1'
      currentActiveView = 'hero1';
      window.__isHero1ViewActive = true;
      html.setAttribute('data-theme', 'hero1');
      body.setAttribute('data-theme', 'hero1');

      if (viewHero2) {
        viewHero2.classList.remove('is-active');
        viewHero2.setAttribute('aria-hidden', 'true');
      }
      if (viewPiano) {
        viewPiano.classList.remove('is-active');
        viewPiano.setAttribute('aria-hidden', 'true');
      }
      if (viewHero1) {
        viewHero1.classList.add('is-active');
        viewHero1.setAttribute('aria-hidden', 'false');
      }

      updateActiveProduct(productHint || 'lyrics');

      // Cleanly pause visualizer canvas loop to avoid wasting GPU/CPU
      if (window.VisualizerScene) {
        window.VisualizerScene.pause();
      }

      if (window.location.hash === '#visualizer' || window.location.hash === '#piano') {
        try {
          history.pushState({ view: 'hero1' }, '', window.location.pathname + window.location.search);
        } catch (err) {
          window.location.hash = '';
        }
      }

      if (!productHint || productHint === 'lyrics') {
        showToast('Sync Lyrics & Script: Precision microsecond lyric aligner active');
      }
    }
  }

  // Handle browser Back / Forward navigation
  window.addEventListener('popstate', function () {
    if (window.location.hash === '#visualizer') {
      switchView('hero2');
    } else if (window.location.hash === '#piano') {
      switchView('piano');
    } else {
      switchView('hero1', 'lyrics');
    }
  });

  // Check initial hash on load
  if (window.location.hash === '#visualizer') {
    switchView('hero2');
  } else if (window.location.hash === '#piano') {
    switchView('piano');
  } else {
    updateActiveProduct('lyrics');
  }

  /* =====================================================================
     TRIGGER POINTS: AUDIO VISUALIZER (Hero Section 2)
     1. Sidebar Audio Visualizer icon ("#side-visualizer-btn")
     2. Products dropdown Audio Visualizer item ("#dropdown-visualizer-btn")
     ===================================================================== */
  if (sideVisualizerBtn) {
    sideVisualizerBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (currentActiveView === 'hero2') {
        switchView('hero1', 'lyrics');
      } else {
        switchView('hero2');
      }
    });
  }

  if (dropdownVisualizerBtn) {
    dropdownVisualizerBtn.addEventListener('click', function (e) {
      e.preventDefault();
      switchView('hero2');
    });
  }

  /* =====================================================================
     TRIGGER POINTS: LIVE HARMONIC PIANO
     1. Sidebar Piano icon ("#side-piano-btn")
     2. Products dropdown Piano item ("#dropdown-piano-btn")
     3. Back button in #view-piano ("#piano-back-btn")
     ===================================================================== */
  if (sidePianoBtn) {
    sidePianoBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (currentActiveView === 'piano') {
        switchView('hero1', 'lyrics');
      } else {
        switchView('piano');
      }
    });
  }

  if (dropdownPianoBtn) {
    dropdownPianoBtn.addEventListener('click', function (e) {
      e.preventDefault();
      switchView('piano');
    });
  }

  var pianoBackBtn = document.getElementById('piano-back-btn');
  if (pianoBackBtn) {
    pianoBackBtn.addEventListener('click', function (e) {
      e.preventDefault();
      switchView('hero1', 'lyrics');
    });
  }

  /* =====================================================================
     RETURN TRIGGERS: SYNC LYRICS & SCRIPT (Hero Section 1)
     - Sidebar Sync Lyrics & Script Button ("#side-home-btn")
     - Sidebar Brand Logo ("#side-logo")
     - Topbar Brand Badge ("#brand-home")
     - Products Dropdown "Sync Lyrics & Script" ("#dropdown-console-btn")
     ===================================================================== */
  if (sideHomeBtn) {
    sideHomeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      switchView('hero1', 'lyrics');
    });
  }

  if (sideLogo) {
    sideLogo.addEventListener('click', function (e) {
      e.preventDefault();
      switchView('hero1', 'lyrics');
      showToast('SyncLines PRO v8 — Active Studio Engine');
    });
  }

  if (brandHome) {
    brandHome.addEventListener('click', function (e) {
      e.preventDefault();
      switchView('hero1', 'lyrics');
    });
  }

  if (dropdownConsoleBtn) {
    dropdownConsoleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      switchView('hero1', 'lyrics');
    });
  }

  /* =====================================================================
     TASK 3 & 4: UPLOAD BUTTON ROUTING & COMING SOON MODAL
     - SyncLines Hero 1: #main-upload-btn navigates to editor with
       brand-consistent cream/green/gold overlay wipe (520ms).
     - Shared Header: #top-upload-btn routes to editor if on Hero 1,
       or opens Coming Soon modal if on Hero 2.
     - Audio Visualizer Hero 2: #btn-upload-hero NEVER navigates; opens
       clean dark-themed "Coming Soon" modal with smooth fade+scale.
     ===================================================================== */
  var visualizerModal = document.getElementById('visualizerComingSoonModal');
  var visualizerModalCloseBtn = document.getElementById('visualizerModalCloseBtn');
  var visualizerModalDismissBtn = document.getElementById('visualizerModalDismissBtn');

  function openVisualizerComingSoonModal() {
    if (!visualizerModal) return;
    visualizerModal.style.display = 'flex';
    visualizerModal.setAttribute('aria-hidden', 'false');
    void visualizerModal.offsetWidth;
    visualizerModal.classList.add('is-open');
  }

  function closeVisualizerComingSoonModal() {
    if (!visualizerModal) return;
    visualizerModal.classList.remove('is-open');
    setTimeout(function () {
      if (!visualizerModal.classList.contains('is-open')) {
        visualizerModal.style.display = 'none';
        visualizerModal.setAttribute('aria-hidden', 'true');
      }
    }, 340);
  }

  if (visualizerModalCloseBtn) {
    visualizerModalCloseBtn.addEventListener('click', closeVisualizerComingSoonModal);
  }
  if (visualizerModalDismissBtn) {
    visualizerModalDismissBtn.addEventListener('click', closeVisualizerComingSoonModal);
  }
  if (visualizerModal) {
    visualizerModal.addEventListener('click', function (e) {
      if (e.target === visualizerModal) {
        closeVisualizerComingSoonModal();
      }
    });
  }

  function navigateToEditor(e) {
    if (e) e.preventDefault();
    if (prefersReducedMotion) {
      window.location.href = 'editor/index.html';
      return;
    }
    var overlay = document.getElementById('pageTransitionOverlay');
    if (overlay) {
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('is-active');
    }

    var targetBtn = (e && e.currentTarget) || mainUploadBtn;
    if (targetBtn && targetBtn.style) {
      targetBtn.style.transform = 'scale(0.96)';
      targetBtn.style.opacity = '0.85';
    }

    setTimeout(function () {
      window.location.href = 'editor/index.html';
    }, 380);
  }

  // SyncLines Hero 1 Upload Button: Always navigates to editor
  if (mainUploadBtn) {
    mainUploadBtn.addEventListener('click', navigateToEditor);
  }

  // Top Header Upload Button: Context-aware (Hero 1 -> Editor, Hero 2 -> Coming Soon modal)
  if (topUploadBtn) {
    topUploadBtn.addEventListener('click', function (e) {
      if (currentActiveView === 'hero2') {
        if (e) e.preventDefault();
        openVisualizerComingSoonModal();
      } else {
        navigateToEditor(e);
      }
    });
  }

  // Audio Visualizer Hero 2 Upload Button: Task 4 requirement - Opens Coming Soon modal, NEVER opens editor
  if (btnUploadHero) {
    btnUploadHero.addEventListener('click', function (e) {
      if (e) e.preventDefault();
      openVisualizerComingSoonModal();
    });
  }

  // Demo Modal inside Hero 2 - Explicitly opens editor
  if (demoLaunchBtn) {
    demoLaunchBtn.addEventListener('click', navigateToEditor);
  }

  /* =====================================================================
     HERO 2 DEMO MODAL CONTROLLER
     ===================================================================== */
  function openDemoModal() {
    if (demoModal) {
      demoModal.style.display = 'flex';
      demoModal.setAttribute('aria-hidden', 'false');
    }
  }

  function closeDemoModal() {
    if (demoModal) {
      demoModal.style.display = 'none';
      demoModal.setAttribute('aria-hidden', 'true');
    }
  }

  if (btnDemo) {
    btnDemo.addEventListener('click', function (e) {
      e.preventDefault();
      openDemoModal();
    });
  }

  if (demoCloseBtn) {
    demoCloseBtn.addEventListener('click', closeDemoModal);
  }
  if (demoDismissBtn) {
    demoDismissBtn.addEventListener('click', closeDemoModal);
  }
  if (demoModal) {
    demoModal.addEventListener('click', function (e) {
      if (e.target === demoModal) {
        closeDemoModal();
      }
    });
  }

  /* =====================================================================
     TASKBAR & ACCOUNT MODAL ACTIONS
     ===================================================================== */
  function openVisualizerTaskbar() {
    if (visualizerTaskbar) {
      visualizerTaskbar.classList.add('is-open');
    }
  }

  function closeVisualizerTaskbar() {
    if (visualizerTaskbar) {
      visualizerTaskbar.classList.remove('is-open');
    }
  }

  function openAccountModal() {
    if (accountModal) accountModal.classList.add('is-open');
    if (sideAccountBtn) sideAccountBtn.classList.add('active');
    syncSidebarIndicator('account');
  }

  function closeAccountModal() {
    if (accountModal) accountModal.classList.remove('is-open');
    if (sideAccountBtn) sideAccountBtn.classList.remove('active');
    syncSidebarIndicator(currentActiveProduct);
  }

  window.addEventListener('pageshow', function () {
    var overlay = document.getElementById('pageTransitionOverlay');
    if (overlay) {
      overlay.classList.remove('is-active');
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (mainUploadBtn && mainUploadBtn.style) {
      mainUploadBtn.style.transform = '';
      mainUploadBtn.style.opacity = '';
    }
    if (topUploadBtn && topUploadBtn.style) {
      topUploadBtn.style.transform = '';
      topUploadBtn.style.opacity = '';
    }
  });

  if (sideAccountBtn) {
    sideAccountBtn.addEventListener('click', function () {
      openAccountModal();
    });
  }

  if (sideInfoBtn) {
    sideInfoBtn.addEventListener('click', function () {
      showToast('Quick Shortcuts: Space (Play/Pause), [ / ] (Scrub Time), M (Mute Piano)');
    });
  }

  if (taskbarCloseBtn) {
    taskbarCloseBtn.addEventListener('click', function () {
      closeVisualizerTaskbar();
    });
  }

  if (taskbarDemoBtn) {
    taskbarDemoBtn.addEventListener('click', function () {
      switchView('hero2');
      closeVisualizerTaskbar();
    });
  }

  if (accountCloseBtn) {
    accountCloseBtn.addEventListener('click', function () {
      closeAccountModal();
    });
  }

  if (accountModal) {
    accountModal.addEventListener('click', function (e) {
      if (e.target === accountModal) {
        closeAccountModal();
      }
    });
  }

  // Global Escape key
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (visualizerModal && visualizerModal.classList.contains('is-open')) {
        closeVisualizerComingSoonModal();
      }
      if (demoModal && demoModal.style.display !== 'none') {
        closeDemoModal();
      }
      if (accountModal && accountModal.classList.contains('is-open')) {
        closeAccountModal();
      }
      if (visualizerTaskbar && visualizerTaskbar.classList.contains('is-open')) {
        closeVisualizerTaskbar();
      }
    }
  });

})();


