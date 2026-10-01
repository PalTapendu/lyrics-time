/* =================================================================
   TIMING CONSOLE — Neo-Acoustic Luminescent Spectrum Visualizer
   Mastering-grade audio-reactive spectrum with:
   - Luminescent rounded capsule pillars with tactile 3D glass highlight
   - Volumetric ambient back-glow & glossy baseline reflection
   - Floating illuminated peak pearls with gravity ballistics
   - Silky continuous dual-rate easing (fast attack, exponential decay)
   - Organic idle breathing harmonics so console is always "alive"
   - Edge-to-edge dynamic container sizing via ResizeObserver
   Preserves all external API hooks: available, init, attachAudio,
   start, stop, updateColors, onResize.
================================================================= */
window.TimingConsoleSpectrum = (function(){
  const available = (typeof window !== 'undefined') && !!(window.AudioContext || window.webkitAudioContext);

  let mountEl = null;
  let canvas = null, ctx = null;
  let audioCtx = null, analyser = null, sourceNode = null, freqData = null;
  let running = false, rafId = null, idlePhase = 0;
  let attachedEl = null;
  let resizeObserver = null;

  // Visualizer bar state
  let barStates = [];
  let currentColors = {
    accent: '#e2b34a',
    accent2: '#dfcfab',
    accent3: '#f5df9a',
    glowWash: 'rgba(226, 179, 74, 0.12)',
    borderActive: 'rgba(226, 179, 74, 0.15)'
  };

  function readCSSVar(name, fallback){
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch(e){
      return fallback;
    }
  }

  function updateThemeColors(){
    currentColors.accent = readCSSVar('--accent', '#e2b34a');
    currentColors.accent2 = readCSSVar('--accent-2', '#dfcfab');
    currentColors.accent3 = readCSSVar('--gold-light', '#f5df9a');
    currentColors.glowWash = readCSSVar('--accent-wash', 'rgba(226, 179, 74, 0.12)');
    currentColors.borderActive = readCSSVar('--border-default', 'rgba(226, 179, 74, 0.15)');
  }

  // Parse color string to rgb object
  function parseColor(col){
    const d = document.createElement('div');
    d.style.color = col;
    document.body.appendChild(d);
    const cs = window.getComputedStyle(d).color;
    document.body.removeChild(d);
    const m = cs.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) } : { r: 226, g: 179, b: 74 };
  }

  // Harmonic acoustic frequency gradient (Calm, friendly, and natural warm honey & champagne tones):
  function interpolateSpectrumColor(t){
    const cAmber = { r: 226, g: 179, b: 74 };
    const cChampagne = { r: 245, g: 223, b: 154 };
    const cIvory = { r: 253, g: 247, b: 236 };

    let r, g, b;
    if (t < 0.5) {
      const f = t / 0.5;
      r = cAmber.r + (cChampagne.r - cAmber.r) * f;
      g = cAmber.g + (cChampagne.g - cAmber.g) * f;
      b = cAmber.b + (cChampagne.b - cAmber.b) * f;
    } else {
      const f = (t - 0.5) / 0.5;
      r = cChampagne.r + (cIvory.r - cChampagne.r) * f;
      g = cChampagne.g + (cIvory.g - cChampagne.g) * f;
      b = cChampagne.b + (cIvory.b - cChampagne.b) * f;
    }
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
  }

  function init(containerEl){
    if (!available || !containerEl) return false;
    mountEl = containerEl;
    updateThemeColors();

    mountEl.innerHTML = '';
    canvas = document.createElement('canvas');
    canvas.className = 'spectrum-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    mountEl.appendChild(canvas);
    ctx = canvas.getContext('2d', { alpha: true });

    onResize();

    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => onResize());
      resizeObserver.observe(mountEl);
    }
    window.addEventListener('resize', onResize);

    // Start idle render loop so visualizer is alive from startup
    startIdleLoop();
    return true;
  }

  function onResize(){
    if (!mountEl || !canvas || !ctx) return;
    const w = mountEl.clientWidth;
    const h = mountEl.clientHeight;
    if (!w || !h) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Allocate bars to fill edge-to-edge
    // Desired bar width ~3.2px, gap ~1.8px (approx 50-80 bars depending on width)
    const targetStride = 5;
    const count = Math.max(28, Math.min(96, Math.floor(w / targetStride)));
    
    // Re-initialize or adjust barStates length smoothly
    if (barStates.length !== count) {
      const newStates = [];
      for (let i = 0; i < count; i++) {
        const old = barStates[Math.floor((i / count) * barStates.length)];
        newStates.push({
          current: old ? old.current : 2,
          target: 2,
          peak: old ? old.peak : 2,
          peakVelocity: 0,
          peakHold: 0
        });
      }
      barStates = newStates;
    }

    renderFrame();
  }

  function attachAudio(audioEl){
    if (!available || attachedEl === audioEl) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = audioCtx || new Ctx();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      freqData = new Uint8Array(analyser.frequencyBinCount);
      sourceNode = audioCtx.createMediaElementSource(audioEl);
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
      attachedEl = audioEl;
    } catch(e){
      console.warn('TimingConsoleSpectrum: audio graph setup failed or already connected', e);
    }
  }

  function resumeContext(){
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(()=>{});
    }
  }

  // Perceptual frequency bin mapping: human hearing is logarithmic
  // Distributes bass, mids, highs across the available visual bars
  function getSampledEnergy(barIndex, totalBars){
    if (!analyser || !freqData) return 0;
    const binCount = freqData.length; // 256
    const t = barIndex / (totalBars - 1);
    // Logarithmic curve: concentrate low/mid frequencies where music lives (30Hz - 10kHz)
    const minFreqLog = Math.log10(2);
    const maxFreqLog = Math.log10(binCount * 0.85);
    const binFloat = Math.pow(10, minFreqLog + t * (maxFreqLog - minFreqLog));
    const i0 = Math.max(0, Math.min(binCount - 2, Math.floor(binFloat)));
    const f = binFloat - i0;
    const rawVal = (freqData[i0] * (1 - f) + freqData[i0 + 1] * f) / 255;

    // Slight treble boost so high hats/cymbals don't get drowned out by bass
    const trebleTilt = 1 + t * 0.45;
    return Math.min(1, Math.pow(rawVal * trebleTilt, 1.15));
  }

  function renderFrame(){
    if (!canvas || !ctx || !mountEl) return;
    const w = mountEl.clientWidth;
    const h = mountEl.clientHeight;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    const hasSignal = running && analyser && freqData;
    if (hasSignal) {
      analyser.getByteFrequencyData(freqData);
    }

    idlePhase += 0.025;
    const numBars = barStates.length;
    if (!numBars) return;

    // Edge-to-edge geometry calculation
    const paddingX = 3;
    const totalAvailW = Math.max(10, w - paddingX * 2);
    const gap = Math.max(1.2, totalAvailW / (numBars * 3.6));
    const barW = Math.max(1.5, (totalAvailW - (numBars - 1) * gap) / numBars);
    const baselineY = h - 4; // Leave 4px for floor reflection/shadow
    const maxBarH = Math.max(8, baselineY - 6);

    // Compute overall spectrum energy for volumetric ambient glow
    let totalEnergy = 0;

    for (let i = 0; i < numBars; i++){
      const state = barStates[i];
      let targetH = 2;

      if (hasSignal) {
        const energy = getSampledEnergy(i, numBars);
        totalEnergy += energy;
        targetH = 2 + energy * maxBarH;
      } else {
        // Organic idle breathing shimmer when stopped/silent
        const wave = Math.sin(idlePhase + i * 0.18) * 0.5 + Math.cos(idlePhase * 0.6 + i * 0.08) * 0.5;
        const breath = Math.max(0, wave);
        targetH = 2.5 + breath * (maxBarH * 0.18);
        totalEnergy += breath * 0.1;
      }

      state.target = targetH;

      // Ballistic easing: snappy transient attack, silky exponential decay
      if (targetH > state.current) {
        state.current += (targetH - state.current) * 0.42; // fast attack
      } else {
        state.current += (targetH - state.current) * 0.105; // smooth release
      }
      if (state.current < 2) state.current = 2;

      // Peak pearl ballistics
      if (state.current >= state.peak) {
        state.peak = state.current;
        state.peakVelocity = 0;
        state.peakHold = 4; // Hold peak for 4 frames
      } else {
        if (state.peakHold > 0) {
          state.peakHold--;
        } else {
          state.peakVelocity += 0.18; // gravity
          state.peak = Math.max(state.current, state.peak - state.peakVelocity);
        }
      }
    }

    const avgEnergy = totalEnergy / numBars;

    // 1. Subtle baseline track line
    ctx.strokeStyle = currentColors.borderActive;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingX, baselineY + 0.5);
    ctx.lineTo(w - paddingX, baselineY + 0.5);
    ctx.stroke();

    // 2. Render Precision Meter Bars
    for (let i = 0; i < numBars; i++){
      const t = i / (numBars - 1);
      const state = barStates[i];
      const barH = state.current;
      const x = paddingX + i * (barW + gap);
      const y = baselineY - barH;
      const radius = Math.min(barW / 2, 1.5);

      const rgb = interpolateSpectrumColor(t);
      const colTop = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.95)`;
      const colBottom = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`;

      // Clean Meter Bar Gradient
      const barGrad = ctx.createLinearGradient(x, y, x, baselineY);
      barGrad.addColorStop(0, colTop);
      barGrad.addColorStop(1, colBottom);

      ctx.fillStyle = barGrad;
      roundRect(ctx, x, y, barW, barH, radius);
      ctx.fill();

      // 3. Floating Peak Indicator Cap (Studio Mastering Style)
      const peakY = Math.max(2, baselineY - state.peak - 1.5);
      ctx.fillStyle = 'rgba(245, 223, 154, 0.92)';
      ctx.fillRect(x, peakY, barW, 1.5);
    }
  }

  // Rounded rectangle helper
  function roundRect(c, x, y, w, h, r){
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function startIdleLoop(){
    if (rafId) cancelAnimationFrame(rafId);
    function tick(){
      renderFrame();
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  function start(){
    if (!available) return;
    resumeContext();
    running = true;
  }

  function stop(){
    running = false;
  }

  function updateColors(){
    updateThemeColors();
  }

  return {
    available,
    init,
    attachAudio,
    start,
    stop,
    updateColors,
    onResize
  };
})();
