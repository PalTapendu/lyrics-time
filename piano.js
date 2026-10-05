/**
 * Self-Playing Mini Piano Widget (Elongated Keys, Soft Pastel Hues & Seamless Infinite Loop)
 * Pure Vanilla JS, SVG, Canvas 2D, Web Audio API
 * Sibling card inside .lower-section alongside .lyrics-card
 */
(function() {
  'use strict';

  // --- Soft, Elegant Pastel Palette (Light, delicate, no harsh/deep colors) ---
  const PALETTE = {
    mint: '#6ee7b7',      // Soft seafoam
    sage: '#86efac',      // Soft spring sage
    cyan: '#7dd3fc',      // Soft powder sky
    blue: '#93c5fd',      // Soft periwinkle
    yellow: '#fde047',    // Soft lemon butter
    orange: '#fdba74',    // Soft warm peach
    coral: '#fda4af',     // Soft coral blossom
    pink: '#f472b6',      // Soft rose blush
    orchid: '#e879f9',    // Soft orchid
    lavender: '#c084fc',  // Soft pastel lilac
    hydrangea: '#a5b4fc', // Soft hydrangea violet
    lime: '#bef264'       // Soft meadow lime
  };

  // 7 White Keys (y=132 to 232, h=100) + 5 Black Keys (y=132 to 196, h=64)
  // Elongated, elegant piano keys ("थोड़ा लंबा खींचो... थोड़ा और ऊपर तक होना चाहिए")
  const KEYS_SPEC = [
    // 7 White Keys (Width: 23px, Spacing: 1.5px, Margin: 12px)
    { note: 'C4', freq: 261.63, key: 'a', color: PALETTE.mint, isBlack: false, x: 12.0, w: 23, h: 100, label: 'Piano key C' },
    { note: 'D4', freq: 293.66, key: 's', color: PALETTE.cyan, isBlack: false, x: 36.5, w: 23, h: 100, label: 'Piano key D' },
    { note: 'E4', freq: 329.63, key: 'd', color: PALETTE.yellow, isBlack: false, x: 61.0, w: 23, h: 100, label: 'Piano key E' },
    { note: 'F4', freq: 349.23, key: 'f', color: PALETTE.orange, isBlack: false, x: 85.5, w: 23, h: 100, label: 'Piano key F' },
    { note: 'G4', freq: 392.00, key: 'g', color: PALETTE.pink, isBlack: false, x: 110.0, w: 23, h: 100, label: 'Piano key G' },
    { note: 'A4', freq: 440.00, key: 'h', color: PALETTE.lavender, isBlack: false, x: 134.5, w: 23, h: 100, label: 'Piano key A' },
    { note: 'B4', freq: 493.88, key: 'j', color: PALETTE.lime, isBlack: false, x: 159.0, w: 23, h: 100, label: 'Piano key B' },

    // 5 Black Keys (Width: 14px, Height: 64px)
    { note: 'C#4', freq: 277.18, key: 'w', color: PALETTE.sage, isBlack: true, x: 28.75, w: 14, h: 64, label: 'Piano key C sharp' },
    { note: 'D#4', freq: 311.13, key: 'e', color: PALETTE.blue, isBlack: true, x: 53.25, w: 14, h: 64, label: 'Piano key D sharp' },
    { note: 'F#4', freq: 369.99, key: 't', color: PALETTE.coral, isBlack: true, x: 102.25, w: 14, h: 64, label: 'Piano key F sharp' },
    { note: 'G#4', freq: 415.30, key: 'y', color: PALETTE.orchid, isBlack: true, x: 126.75, w: 14, h: 64, label: 'Piano key G sharp' },
    { note: 'A#4', freq: 466.16, key: 'u', color: PALETTE.hydrangea, isBlack: true, x: 151.25, w: 14, h: 64, label: 'Piano key A sharp' }
  ];

  const KEY_MAP = {};
  KEYS_SPEC.forEach(k => {
    KEY_MAP[k.note] = k;
    KEY_MAP[k.key] = k;
  });

  // --- Web Audio API Synth Engine ---
  let audioCtx = null;
  let masterGain = null;
  // By default, piano starts MUTED on page load as explicitly requested
  let isMuted = true;
  const activeVoices = [];
  const MAX_VOICES = 12;

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.24, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  function playSynthNote(freq) {
    if (isMuted) return; // Stays silent if muted
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Polyphony voice management
    if (activeVoices.length >= MAX_VOICES) {
      const oldest = activeVoices.shift();
      try {
        oldest.gain.gain.setValueAtTime(oldest.gain.gain.value, now);
        oldest.gain.gain.linearRampToValueAtTime(0.0001, now + 0.04);
        setTimeout(() => {
          try {
            oldest.nodes.forEach(n => n.stop && n.stop());
          } catch(err) {}
        }, 50);
      } catch(e) {}
    }

    // Warm, singing acoustic piano timbre with soft attack, woody hammer strike, and singing decay
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now); // Gentle octave harmonic chime
    const osc2Gain = audioCtx.createGain();
    osc2Gain.gain.setValueAtTime(0.22, now);
    osc2.connect(osc2Gain);

    // Subtle wooden hammer transient strike
    const osc3 = audioCtx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 3, now);
    const osc3Gain = audioCtx.createGain();
    osc3Gain.gain.setValueAtTime(0.09, now);
    osc3Gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc3.connect(osc3Gain);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3600, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.7);
    filter.Q.setValueAtTime(1.1, now);

    const voiceGain = audioCtx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(0.85, now + 0.004); // Instant, responsive attack
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);

    osc1.connect(filter);
    osc2Gain.connect(filter);
    osc3Gain.connect(filter);
    filter.connect(voiceGain);
    voiceGain.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + 1.5);
    osc2.stop(now + 1.5);
    osc3.stop(now + 0.1);

    const voice = { nodes: [osc1, osc2, osc3], gain: voiceGain };
    activeVoices.push(voice);
    setTimeout(() => {
      const idx = activeVoices.indexOf(voice);
      if (idx !== -1) activeVoices.splice(idx, 1);
    }, 1500);
  }

  // --- Canvas 2D Rising Musical Note Icons System ---
  const GLYPHS = ['♩', '♪', '♫', '♬', '✦', '●'];
  const POOL_SIZE = 40;
  const particles = [];

  for (let i = 0; i < POOL_SIZE; i++) {
    particles.push({
      active: false,
      x: 0,
      y: 0,
      startX: 0,
      startY: 0,
      vy: 0,
      glyph: '♪',
      color: PALETTE.mint,
      size: 12,
      scale: 1,
      alpha: 1,
      life: 0,
      maxLife: 2.2,
      phase: 0,
      amp: 7,
      freq: 1.8,
      rotation: 0,
      isSparkle: false
    });
  }

  function spawnParticle(x, color, isBurst = false) {
    let p = particles.find(item => !item.active);
    if (!p) {
      p = particles.reduce((oldest, cur) => cur.life > oldest.life ? cur : oldest, particles[0]);
    }

    p.active = true;
    p.startX = x + (Math.random() - 0.5) * (isBurst ? 14 : 5);
    p.startY = 128 + (Math.random() - 0.5) * 6; // Starts right above the keys (y=132)
    p.x = p.startX;
    p.y = p.startY;
    p.vy = isBurst ? -(46 + Math.random() * 20) : -(32 + Math.random() * 15);

    const glyphsPick = isBurst ? GLYPHS : ['♩', '♪', '♫', '♬', '✦'];
    p.glyph = glyphsPick[Math.floor(Math.random() * glyphsPick.length)];
    p.isSparkle = p.glyph === '✦' || p.glyph === '●';
    p.color = color || PALETTE.mint;
    p.size = p.isSparkle ? (7 + Math.random() * 3) : (11 + Math.random() * 3);
    p.scale = 1;
    p.alpha = 1;
    p.life = 0;
    p.maxLife = 2.1 + Math.random() * 0.4;
    p.phase = Math.random() * Math.PI * 2;
    p.amp = 5 + Math.random() * 5;
    p.freq = 1.6 + Math.random() * 0.8;
    p.rotation = (Math.random() - 0.5) * 0.35;
  }

  // Pre-seed some floating notes on startup
  function preSeedParticles() {
    const seed = [
      { x: 48, y: 100, glyph: '♩', color: PALETTE.cyan, size: 12, life: 0.8 },
      { x: 74, y: 78, glyph: '♪', color: PALETTE.yellow, size: 13, life: 1.3 },
      { x: 122, y: 64, glyph: '♫', color: PALETTE.pink, size: 14, life: 1.6 },
      { x: 148, y: 44, glyph: '♬', color: PALETTE.lavender, size: 12, life: 1.9 },
      { x: 95, y: 110, glyph: '✦', color: PALETTE.mint, size: 8, life: 0.5 }
    ];

    seed.forEach((s, idx) => {
      const p = particles[idx];
      if (p) {
        p.active = true;
        p.x = s.x;
        p.y = s.y;
        p.startX = s.x;
        p.startY = 128;
        p.vy = -32;
        p.glyph = s.glyph;
        p.color = s.color;
        p.size = s.size;
        p.isSparkle = s.glyph === '✦';
        p.scale = 1;
        p.alpha = 0.88;
        p.life = s.life;
        p.maxLife = 2.3;
        p.phase = Math.random() * Math.PI * 2;
        p.amp = 7;
        p.freq = 1.8;
        p.rotation = (Math.random() - 0.5) * 0.3;
      }
    });
  }

  // --- DOM Elements & Setup ---
  let pianoWidget = null;
  let canvas = null;
  let ctx = null;
  let muteBtn = null;
  const keyDomMap = {};

  function buildWidget() {
    const lowerSection = document.querySelector('.lower-section');
    if (!lowerSection) return;

    const existing = document.getElementById('mini-piano');
    if (existing) existing.remove();

    pianoWidget = document.createElement('div');
    pianoWidget.id = 'mini-piano';
    pianoWidget.className = 'mini-piano-widget';
    pianoWidget.setAttribute('role', 'region');
    pianoWidget.setAttribute('aria-label', 'Self-Playing Mini Piano');

    pianoWidget.innerHTML = `
      <!-- Pure Vertical Ambient Mint Glow at Bottom (Zero side fade) -->
      <div class="piano-ambient-glow"></div>

      <!-- Canvas 2D for Floating Musical Icons (194 x 242) -->
      <canvas id="piano-canvas" class="piano-canvas" width="194" height="242"></canvas>

      <!-- SVG Piano Keyboard & Vertical Beams (194 x 242) -->
      <svg id="piano-keys-svg" class="piano-keys-svg" viewBox="0 0 194 242">
        <defs>
          <!-- Ivory White Key Default Gradient -->
          <linearGradient id="whiteKeyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="70%" stop-color="#faf8f3"/>
            <stop offset="100%" stop-color="#eee7d9"/>
          </linearGradient>

          <!-- Obsidian Ebony Black Key Gradient -->
          <linearGradient id="blackKeyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1f2c25"/>
            <stop offset="22%" stop-color="#121e17"/>
            <stop offset="100%" stop-color="#050e09"/>
          </linearGradient>

          <!-- Soft Pastel Active Surface Gradients (Delicate, light, elegant hues) -->
          <linearGradient id="activeGrad-C4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#d1fae5"/><stop offset="50%" stop-color="#a7f3d0"/><stop offset="100%" stop-color="#6ee7b7"/>
          </linearGradient>
          <linearGradient id="activeGrad-C#4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#dcfce7"/><stop offset="50%" stop-color="#bbf7d0"/><stop offset="100%" stop-color="#86efac"/>
          </linearGradient>
          <linearGradient id="activeGrad-D4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#e0f2fe"/><stop offset="50%" stop-color="#bae6fd"/><stop offset="100%" stop-color="#7dd3fc"/>
          </linearGradient>
          <linearGradient id="activeGrad-D#4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#dbeafe"/><stop offset="50%" stop-color="#bfdbfe"/><stop offset="100%" stop-color="#93c5fd"/>
          </linearGradient>
          <linearGradient id="activeGrad-E4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fef9c3"/><stop offset="50%" stop-color="#fef08a"/><stop offset="100%" stop-color="#fde047"/>
          </linearGradient>
          <linearGradient id="activeGrad-F4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffedd5"/><stop offset="50%" stop-color="#fed7aa"/><stop offset="100%" stop-color="#fdba74"/>
          </linearGradient>
          <linearGradient id="activeGrad-F#4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffe4e6"/><stop offset="50%" stop-color="#fecdd3"/><stop offset="100%" stop-color="#fda4af"/>
          </linearGradient>
          <linearGradient id="activeGrad-G4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fce7f3"/><stop offset="50%" stop-color="#fbcfe8"/><stop offset="100%" stop-color="#f472b6"/>
          </linearGradient>
          <linearGradient id="activeGrad-G#4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fae8ff"/><stop offset="50%" stop-color="#f5d0fe"/><stop offset="100%" stop-color="#e879f9"/>
          </linearGradient>
          <linearGradient id="activeGrad-A4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f3e8ff"/><stop offset="50%" stop-color="#e9d5ff"/><stop offset="100%" stop-color="#c084fc"/>
          </linearGradient>
          <linearGradient id="activeGrad-A#4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#e0e7ff"/><stop offset="50%" stop-color="#c7d2fe"/><stop offset="100%" stop-color="#a5b4fc"/>
          </linearGradient>
          <linearGradient id="activeGrad-B4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ecfccb"/><stop offset="50%" stop-color="#d9f99d"/><stop offset="100%" stop-color="#bef264"/>
          </linearGradient>

          <!-- Pure Vertical Light Beams (Soft pastel fade upward, ZERO side fade) -->
          <linearGradient id="beamGrad-C4" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#34d399" stop-opacity="0.38"/><stop offset="35%" stop-color="#34d399" stop-opacity="0.18"/><stop offset="70%" stop-color="#34d399" stop-opacity="0.05"/><stop offset="100%" stop-color="#34d399" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="beamGrad-C#4" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#4ade80" stop-opacity="0.38"/><stop offset="35%" stop-color="#4ade80" stop-opacity="0.18"/><stop offset="70%" stop-color="#4ade80" stop-opacity="0.05"/><stop offset="100%" stop-color="#4ade80" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="beamGrad-D4" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.38"/><stop offset="35%" stop-color="#38bdf8" stop-opacity="0.18"/><stop offset="70%" stop-color="#38bdf8" stop-opacity="0.05"/><stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="beamGrad-D#4" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.38"/><stop offset="35%" stop-color="#60a5fa" stop-opacity="0.18"/><stop offset="70%" stop-color="#60a5fa" stop-opacity="0.05"/><stop offset="100%" stop-color="#60a5fa" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="beamGrad-E4" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#facc15" stop-opacity="0.38"/><stop offset="35%" stop-color="#facc15" stop-opacity="0.18"/><stop offset="70%" stop-color="#facc15" stop-opacity="0.05"/><stop offset="100%" stop-color="#facc15" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="beamGrad-F4" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#fb923c" stop-opacity="0.38"/><stop offset="35%" stop-color="#fb923c" stop-opacity="0.18"/><stop offset="70%" stop-color="#fb923c" stop-opacity="0.05"/><stop offset="100%" stop-color="#fb923c" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="beamGrad-F#4" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#fb7185" stop-opacity="0.38"/><stop offset="35%" stop-color="#fb7185" stop-opacity="0.18"/><stop offset="70%" stop-color="#fb7185" stop-opacity="0.05"/><stop offset="100%" stop-color="#fb7185" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="beamGrad-G4" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#f472b6" stop-opacity="0.38"/><stop offset="35%" stop-color="#f472b6" stop-opacity="0.18"/><stop offset="70%" stop-color="#f472b6" stop-opacity="0.05"/><stop offset="100%" stop-color="#f472b6" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="beamGrad-G#4" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#e879f9" stop-opacity="0.38"/><stop offset="35%" stop-color="#e879f9" stop-opacity="0.18"/><stop offset="70%" stop-color="#e879f9" stop-opacity="0.05"/><stop offset="100%" stop-color="#e879f9" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="beamGrad-A4" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#c084fc" stop-opacity="0.38"/><stop offset="35%" stop-color="#c084fc" stop-opacity="0.18"/><stop offset="70%" stop-color="#c084fc" stop-opacity="0.05"/><stop offset="100%" stop-color="#c084fc" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="beamGrad-A#4" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#818cf8" stop-opacity="0.38"/><stop offset="35%" stop-color="#818cf8" stop-opacity="0.18"/><stop offset="70%" stop-color="#818cf8" stop-opacity="0.05"/><stop offset="100%" stop-color="#818cf8" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="beamGrad-B4" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#a3e635" stop-opacity="0.38"/><stop offset="35%" stop-color="#a3e635" stop-opacity="0.18"/><stop offset="70%" stop-color="#a3e635" stop-opacity="0.05"/><stop offset="100%" stop-color="#a3e635" stop-opacity="0"/>
          </linearGradient>
        </defs>

        <!-- White Keys Group -->
        <g id="white-keys-group"></g>

        <!-- Black Keys Group -->
        <g id="black-keys-group"></g>
      </svg>

      <!-- Top Header Bar (Status Chip & Sound Toggle) - Layered on top of SVG -->
      <div class="piano-header">
        <div class="piano-status-badge">
          <span class="piano-badge-dot"></span>
          <span class="piano-badge-title">LIVE PIANO</span>
        </div>
        <button id="piano-mute-btn" class="piano-sound-toggle" aria-label="Toggle piano sound (currently muted)" title="Click to Unmute Piano">
          <svg class="speaker-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
            <line id="mute-slash" x1="23" y1="9" x2="17" y2="15" stroke-width="2.2"/>
            <line id="mute-slash-2" x1="17" y1="9" x2="23" y2="15" stroke-width="2.2"/>
          </svg>
        </button>
      </div>
    `;

    lowerSection.appendChild(pianoWidget);

    canvas = document.getElementById('piano-canvas');
    if (canvas) {
      ctx = canvas.getContext('2d');
      setupCanvasDPR();
    }

    muteBtn = document.getElementById('piano-mute-btn');
    if (muteBtn) {
      muteBtn.addEventListener('click', toggleMute);
    }

    renderSvgKeys();
    preSeedParticles();
    bindInteractions();
    setupTabVisibilityListener();
  }

  function setupCanvasDPR() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 194 * dpr;
    canvas.height = 242 * dpr;
    ctx.scale(dpr, dpr);
  }

  function renderSvgKeys() {
    const whiteGroup = document.getElementById('white-keys-group');
    const blackGroup = document.getElementById('black-keys-group');
    if (!whiteGroup || !blackGroup) return;

    KEYS_SPEC.forEach(k => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `piano-key ${k.isBlack ? 'black-key' : 'white-key'}`);
      g.setAttribute('data-note', k.note);
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', k.label);

      // 1. Clean Vertical Light Beam - Exact width of key, pure upward fade (ZERO side blur)
      const beamGradId = `beamGrad-${k.note}`;
      const beam = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      beam.setAttribute('class', 'key-light-beam');
      beam.setAttribute('x', k.x);
      beam.setAttribute('y', 10);
      beam.setAttribute('width', k.w);
      beam.setAttribute('height', 122); // Reaches from y=10 down to key top at y=132
      beam.setAttribute('rx', 2.5);
      beam.setAttribute('fill', `url(#${beamGradId})`);
      g.appendChild(beam);

      // 2. Key Solid Body (y = 132 to 232 for white keys, 132 to 196 for black keys)
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('class', 'key-body');
      rect.setAttribute('x', k.x);
      rect.setAttribute('y', 132);
      rect.setAttribute('width', k.w);
      rect.setAttribute('height', k.h);
      rect.setAttribute('rx', k.isBlack ? 3.5 : 4.5);
      g.appendChild(rect);

      // 3. Front Lip Bevel and Note Letter Label for White Keys
      if (!k.isBlack) {
        const lip = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        lip.setAttribute('class', 'key-lip');
        lip.setAttribute('x', k.x + 1);
        lip.setAttribute('y', 227);
        lip.setAttribute('width', k.w - 2);
        lip.setAttribute('height', 4.5);
        lip.setAttribute('rx', 1.5);
        g.appendChild(lip);

        // Note letter label at bottom of white keys (C, D, E, F, G, A, B)
        const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.setAttribute('class', 'key-note-label');
        labelText.setAttribute('x', k.x + k.w / 2);
        labelText.setAttribute('y', 222);
        labelText.textContent = k.note.replace('4', '');
        g.appendChild(labelText);
      }

      // 4. Soft Pastel Color Glow Overlay for Rich Active State
      const glowOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      glowOverlay.setAttribute('class', 'key-glow-overlay');
      glowOverlay.setAttribute('x', k.x);
      glowOverlay.setAttribute('y', 132);
      glowOverlay.setAttribute('width', k.w);
      glowOverlay.setAttribute('height', k.h);
      glowOverlay.setAttribute('rx', k.isBlack ? 3.5 : 4.5);
      const activeGradId = `activeGrad-${k.note}`;
      glowOverlay.setAttribute('fill', `url(#${activeGradId})`);
      g.appendChild(glowOverlay);

      // 5. Glossy Top Specular Sheen for Black Keys
      if (k.isBlack) {
        const sheen = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        sheen.setAttribute('x', k.x + 2);
        sheen.setAttribute('y', 134);
        sheen.setAttribute('width', k.w - 4);
        sheen.setAttribute('height', 18);
        sheen.setAttribute('rx', 2);
        sheen.setAttribute('fill', 'rgba(255, 255, 255, 0.22)');
        sheen.setAttribute('pointer-events', 'none');
        g.appendChild(sheen);
      }

      // 6. Ripple Circle for Burst Animation
      const ripple = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ripple.setAttribute('class', 'key-ripple-circle');
      ripple.setAttribute('cx', k.x + k.w / 2);
      ripple.setAttribute('cy', 132 + k.h * 0.5);
      ripple.setAttribute('r', k.w * 0.45);
      ripple.setAttribute('fill', k.color);
      g.appendChild(ripple);

      if (k.isBlack) {
        blackGroup.appendChild(g);
      } else {
        whiteGroup.appendChild(g);
      }

      keyDomMap[k.note] = { group: g, spec: k };
    });
  }

  // --- Key Press & Sustain Engine ---
  let userInteracting = false;
  let userInteractTimeout = null;

  function markUserInteraction() {
    userInteracting = true;
    if (userInteractTimeout) clearTimeout(userInteractTimeout);
    userInteractTimeout = setTimeout(() => {
      userInteracting = false;
    }, 2800);
  }

  function pressKey(noteName, isClick = false, skipSound = false) {
    const item = keyDomMap[noteName];
    if (!item) return;

    const { group, spec } = item;

    // Add active state immediately (zero latency)
    if (item.activeTimeout) clearTimeout(item.activeTimeout);
    group.classList.add('active');

    // Spawn floating musical notes from this key
    const centerCanvasX = spec.x + spec.w / 2;
    if (isClick) {
      for (let i = 0; i < 4; i++) {
        spawnParticle(centerCanvasX, spec.color, true);
      }
      if (item.rippleTimeout) clearTimeout(item.rippleTimeout);
      group.classList.remove('rippling');
      void group.offsetWidth;
      group.classList.add('rippling');
      item.rippleTimeout = setTimeout(() => {
        group.classList.remove('rippling');
        item.rippleTimeout = null;
      }, 350);
    } else {
      spawnParticle(centerCanvasX, spec.color, false);
    }

    // Audio Playback (plays instantly if unmuted; silent if muted or skipSound is true)
    if (!skipSound) {
      playSynthNote(spec.freq);
    }

    // Release timing
    const sustainDuration = isClick ? 420 : 320;
    item.activeTimeout = setTimeout(() => {
      group.classList.remove('active');
      item.activeTimeout = null;
    }, sustainDuration);
  }

  // --- Mute Toggle & Tab Visibility Rules ---
  function updateMuteUI() {
    if (!muteBtn) return;
    if (isMuted) {
      muteBtn.classList.remove('unmuted');
      muteBtn.setAttribute('title', 'Click to Unmute Piano');
      muteBtn.setAttribute('aria-label', 'Toggle piano sound (currently muted)');
      muteBtn.innerHTML = `
        <svg class="speaker-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
          <line id="mute-slash" x1="23" y1="9" x2="17" y2="15" stroke-width="2.2"/>
          <line id="mute-slash-2" x1="17" y1="9" x2="23" y2="15" stroke-width="2.2"/>
        </svg>
      `;
    } else {
      muteBtn.classList.add('unmuted');
      muteBtn.setAttribute('title', 'Click to Mute Piano');
      muteBtn.setAttribute('aria-label', 'Toggle piano sound (currently unmuted)');
      muteBtn.innerHTML = `
        <svg class="speaker-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
      `;
    }
  }

  function toggleMute() {
    initAudio();
    isMuted = !isMuted;
    markUserInteraction();
    updateMuteUI();

    if (!isMuted) {
      // Soft welcome arpeggio on manual unmute
      pressKey('C4');
      setTimeout(() => pressKey('E4'), 85);
      setTimeout(() => pressKey('G4'), 170);
    }
  }

  // Tab Switch:
  // "User जब tab switch कर लेगा तो अगर यह mute है तो mute ही रहेगा। अगर यह unmute है तो automatic mute ho jayega।"
  function setupTabVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Tab hidden / switched away:
        if (!isMuted) {
          isMuted = true;
          updateMuteUI();
        }
      }
    });
  }

  // --- Instant Key Hover & Click Interaction System ---
  // Rules strictly enforced:
  // 1. Mouse enters a button -> Instant reaction, zero second lost!
  // 2. Stationary hover on a button -> Plays exactly ONCE (never twice while hovering).
  // 3. Mouse moves away and comes back -> Plays again!
  // 4. Skipping buttons (e.g. jumping to 4th button) -> Immediately plays the 4th button!
  function bindInteractions() {
    let lastActiveHoverNote = null;

    const svgEl = document.getElementById('piano-keys-svg');
    if (!svgEl) return;

    function triggerKeyByHover(note) {
      if (!note) return;
      if (note === lastActiveHoverNote) {
        // Mouse is still on this same key: DO NOT play again! Plays once only!
        return;
      }

      // New key under cursor or re-entered key:
      lastActiveHoverNote = note;
      markUserInteraction();

      // Ensure audio is initialized and unmuted so mouse hover on keys always makes sound!
      if (isMuted) {
        isMuted = false;
        updateMuteUI();
      }
      if (!audioCtx) initAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      // Zero-delay instant press & sound:
      pressKey(note, false, false);
    }

    // Attach pointerenter on each individual key for instantaneous hardware reaction
    Object.keys(keyDomMap).forEach(noteName => {
      const { group } = keyDomMap[noteName];

      group.addEventListener('pointerenter', () => {
        triggerKeyByHover(noteName);
      });

      // Direct manual click
      group.addEventListener('click', (e) => {
        e.stopPropagation();
        markUserInteraction();
        pressKey(noteName, true);
      });

      group.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          markUserInteraction();
          pressKey(noteName, true);
        }
      });
    });

    // Pointermove on SVG detects fast sweeps or jumped keys across bounding boxes
    svgEl.addEventListener('pointermove', (e) => {
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.piano-key');
      if (target) {
        const note = target.getAttribute('data-note');
        if (note && note !== lastActiveHoverNote) {
          triggerKeyByHover(note);
        }
      } else {
        lastActiveHoverNote = null;
      }
    });

    // When mouse leaves the keyboard area, reset hover note so it can re-trigger when returning
    svgEl.addEventListener('pointerleave', () => {
      lastActiveHoverNote = null;
    });

    // Keyboard Hotkeys: A S D F G H J and W E T Y U
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const keyChar = e.key.toLowerCase();
      if (KEY_MAP[keyChar]) {
        markUserInteraction();
        pressKey(KEY_MAP[keyChar].note, true);
      }
    });

    // Magnetic Proximity Aura within ~80px of widget
    window.addEventListener('mousemove', (e) => {
      if (!pianoWidget) return;
      const rect = pianoWidget.getBoundingClientRect();
      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 80) {
        pianoWidget.classList.add('proximity-active');
      } else {
        pianoWidget.classList.remove('proximity-active');
      }
    });
  }

  // --- Seamless, Ambient, Circular Infinite Piano Loop (Happy Mood & Sweet Finishing) ---
  // Uplifting, cheerful, and melodic C Major / Pentatonic progression.
  // 16 beats total, exactly 0.8 beats per step for effortless, continuous circular flow.
  const SEAMLESS_LOOP = [
    // Phrase 1: Bright, cheerful sunshine morning opening (C Major)
    { beat: 0.0, notes: ['C4'] },
    { beat: 0.8, notes: ['E4'] },
    { beat: 1.6, notes: ['G4'] },
    { beat: 2.4, notes: ['A4'] },
    { beat: 3.2, notes: ['G4'] },
    { beat: 4.0, notes: ['E4'] },

    // Phrase 2: Playful, lighthearted bounce
    { beat: 4.8, notes: ['D4'] },
    { beat: 5.6, notes: ['F4'] },
    { beat: 6.4, notes: ['A4'] },
    { beat: 7.2, notes: ['G4'] },
    { beat: 8.0, notes: ['E4'] },
    { beat: 8.8, notes: ['C4'] },

    // Phrase 3: Soaring joyful rise
    { beat: 9.6, notes: ['D4'] },
    { beat: 10.4, notes: ['E4'] },
    { beat: 11.2, notes: ['G4'] },
    { beat: 12.0, notes: ['A4'] },

    // Phrase 4: Sweet happy finishing resolution & circular cadence
    { beat: 12.8, notes: ['B4'] },
    { beat: 13.6, notes: ['A4'] },
    { beat: 14.4, notes: ['G4'] },
    { beat: 15.2, notes: ['C4', 'G4'] } // Harmonious, rich happy finishing chord that circles smoothly back into C4 at 0.0!
  ];

  const BPM = 94;
  const BEAT_DURATION = 60 / BPM; // ~0.638s
  const TOTAL_LOOP_BEATS = 16.0;
  const TOTAL_LOOP_TIME = TOTAL_LOOP_BEATS * BEAT_DURATION; // ~10.2s

  let loopTime = 0;
  let lastFrameTime = performance.now();
  let nextNoteIndex = 0;
  let ambientSpawnTimer = 0;

  function updateMelody(dt) {
    if (userInteracting) return;
    if (window.isHeroSongPlaying && window.isHeroSongPlaying()) return; // Hero song sync takes full priority
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    loopTime += dt;
    if (loopTime >= TOTAL_LOOP_TIME) {
      loopTime %= TOTAL_LOOP_TIME;
      nextNoteIndex = 0;
    }

    const currentBeat = loopTime / BEAT_DURATION;

    while (nextNoteIndex < SEAMLESS_LOOP.length && currentBeat >= SEAMLESS_LOOP[nextNoteIndex].beat) {
      const step = SEAMLESS_LOOP[nextNoteIndex];
      if (step.notes && step.notes.length > 0) {
        step.notes.forEach(noteName => {
          pressKey(noteName, false);
        });
      }
      nextNoteIndex++;
    }
  }

  // --- Canvas 2D Rising Musical Note Animation Loop ---
  function renderCanvas(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, 194, 242);

    // Subtle gentle ambient note bubbles
    ambientSpawnTimer += dt;
    if (ambientSpawnTimer > 0.7) {
      ambientSpawnTimer = 0;
      const randomKey = KEYS_SPEC[Math.floor(Math.random() * KEYS_SPEC.length)];
      if (randomKey && Math.random() < 0.55) {
        spawnParticle(randomKey.x + randomKey.w / 2, randomKey.color, false);
      }
    }

    // Render floating musical icons (fade out cleanly as they rise towards the top)
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }

      const progress = p.life / p.maxLife; // 0 to 1
      p.y += p.vy * dt;
      p.x = p.startX + Math.sin(progress * p.freq * Math.PI + p.phase) * p.amp;

      // Gentle scale: starts ~0.9, peaks at ~1.05, gently scales down to 0.75 near top
      if (progress < 0.25) {
        p.scale = 0.9 + (progress / 0.25) * 0.15;
      } else {
        p.scale = 1.05 - ((progress - 0.25) / 0.75) * 0.3;
      }

      // Smooth fade envelope: fade in quickly, fade out cleanly towards the top
      if (progress < 0.12) {
        p.alpha = progress / 0.12;
      } else {
        p.alpha = Math.max(0, Math.pow(1 - (progress - 0.12) / 0.88, 1.3));
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation + Math.sin(progress * Math.PI) * 0.18);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.isSparkle) {
        ctx.font = `bold ${Math.round(p.size * p.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.fillText(p.glyph, 0, 0);
      } else {
        ctx.font = `bold ${Math.round(p.size * p.scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 3;
        ctx.fillText(p.glyph, 0, 0);
      }

      ctx.restore();
    }
  }

  function handleReducedMotionPose() {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (keyDomMap['C4']) keyDomMap['C4'].group.classList.add('active');
    if (keyDomMap['G4']) keyDomMap['G4'].group.classList.add('active');
  }

  function animationLoop(now) {
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    if (!document.hidden) {
      updateMelody(dt);
      renderCanvas(dt);
    }

    requestAnimationFrame(animationLoop);
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        buildWidget();
        handleReducedMotionPose();
        requestAnimationFrame(animationLoop);
      });
    } else {
      buildWidget();
      handleReducedMotionPose();
      requestAnimationFrame(animationLoop);
    }

    window.addEventListener('resize', setupCanvasDPR);
  }

  // Expose piano trigger API for timing console & song synchronization
  window.pianoTriggerKey = function(noteName, isClick, skipSound) {
    pressKey(noteName, !!isClick, !!skipSound);
  };

  // Expose live piano activation API for dropdown & sidebar product selectors
  window.activateLivePiano = function() {
    isMuted = false;
    updateMuteUI();
    if (!audioCtx) initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    // Focus pulse animation on widget
    const widget = document.getElementById('mini-piano');
    if (widget) {
      widget.classList.remove('piano-focused-pulse');
      void widget.offsetWidth; // Trigger reflow
      widget.classList.add('piano-focused-pulse');
      setTimeout(() => {
        widget.classList.remove('piano-focused-pulse');
      }, 3400);
    }

    // Play harmonious welcome chord/arpeggio (C4 -> E4 -> G4)
    setTimeout(() => pressKey('C4', true, false), 80);
    setTimeout(() => pressKey('E4', true, false), 260);
    setTimeout(() => pressKey('G4', true, false), 440);
  };

  init();
})();
