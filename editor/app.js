/* =================================================================
   TIMING CONSOLE — app logic v3
================================================================= */
(function () {
  const $ = id => document.getElementById(id);

  /* ---------------- theme ---------------- */
  (function initTheme() {
    const THEME_KEY = 'timing-console-theme';
    const root = document.documentElement;
    const themeBtn = $('themeBtn'), themeBtnLabel = $('themeBtnLabel');
    function apply(theme) {
      if (theme === 'light') root.setAttribute('data-theme', 'light');
      else root.removeAttribute('data-theme');
      if (themeBtnLabel) themeBtnLabel.textContent = theme === 'light' ? 'Light' : 'Dark';
      if (window.TimingConsoleSpectrum) window.TimingConsoleSpectrum.updateColors();
    }
    let stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch (e) { }
    const light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    apply(stored || (light ? 'light' : 'dark'));
    themeBtn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      apply(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { }
      drawWaveform(); drawMinimap();
    });
  })();

  /* ---------------- refs ---------------- */
  const player = $('player');
  const audioFileInput = $('audioFile'), audioFileName = $('audioFileName');
  const lyricsFileInput = $('lyricsFile'), lyricsInput = $('lyricsInput');
  const modeSeg = $('modeSeg'), captureSeg = $('captureSeg'), interactionSeg = $('interactionSeg');
  const captureHint = $('captureHint'), buildBtn = $('buildBtn'), statusLine = $('statusLine');

  const setupHeader = $('setupHeader'), setupSection = $('setupSection'), setupPaneMeta = $('setupPaneMeta');
  const consoleHeader = $('consoleHeader'), consoleSection = $('consoleSection'), consolePaneMeta = $('consolePaneMeta');

  const playerDock = $('playerDock'), dockResizeHandle = $('dockResizeHandle');
  const playerSongName = $('playerSongName');
  const tcCurrent = $('tcCurrent'), tcTotal = $('tcTotal');
  const blocksTrack = $('blocksTrack'), blocksInner = $('blocksInner'), blocksEmpty = $('blocksEmpty');
  const blocksExpandBtn = $('blocksExpandBtn');
  const zoomInBtn = $('zoomInBtn'), zoomOutBtn = $('zoomOutBtn'), zoomLabel = $('zoomLabel');
  const waveformWrap = $('waveformWrap'), waveformCanvas = $('waveformCanvas');
  const waveformEmpty = $('waveformEmpty'), waveformPlayhead = $('waveformPlayhead');
  const waveformHoverLine = $('waveformHoverLine'), hoverTimeTag = $('hoverTimeTag');
  const minimap = $('minimap'), minimapCanvas = $('minimapCanvas'), minimapWindow = $('minimapWindow');
  const spectrumWrap = $('spectrumWrap'), spectrumIdleNote = $('spectrumIdleNote');

  const playBtn = $('playBtn'), backBtn = $('backBtn'), fwdBtn = $('fwdBtn'), speedSeg = $('speedSeg');
  const lyricsPanel = $('lyricsPanel'), lyricsList = $('lyricsList'), lyricsCount = $('lyricsCount');
  const skippedBadge = $('skippedBadge'), progressFill = $('progressFill'), tagsPanel = $('tagsPanel');
  const undoBtn = $('undoBtn'), resetBtn = $('resetBtn');
  const saveSessionBtn = $('saveSessionBtn'), loadSessionBtn = $('loadSessionBtn'), sessionFileInput = $('sessionFileInput');
  const historyBtn = $('historyBtn'), topHistoryBtn = $('topHistoryBtn'), historyModal = $('historyModal'), historyCloseBtn = $('historyCloseBtn');
  const historyDoneBtn = $('historyDoneBtn'), clearHistoryBtn = $('clearHistoryBtn'), historyList = $('historyList');
  const toast = $('toast');
  const expLRC = $('expLRC'), expSRT = $('expSRT'), expVTT = $('expVTT'), expTXT = $('expTXT'), expPreview = $('expPreview');
  const previewModal = $('previewModal'), previewCloseBtn = $('previewCloseBtn'), previewDoneBtn = $('previewDoneBtn');
  const previewCopyBtn = $('previewCopyBtn'), previewTextarea = $('previewTextarea'), previewFormatTabs = $('previewFormatTabs'), previewMetaInfo = $('previewMetaInfo');

  const PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  const PAUSE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
  const LOOP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
  const STOP_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>';
  const PLAY_MINI_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  const REVERT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';

  /* ---------------- state ---------------- */
  let mode = 'line', captureChoice = 'start', activeCapture = 'start';
  let interactionChoice = 'buttons', activeInteraction = 'buttons';
  let items = [], history = [], cursorIndex = 0;
  let songBaseName = '', hasAudioFile = false, audioLoaded = false, hasLyricsText = false;
  let activeLoop = null, waveformPeaks = null, autosaveTimer = null;
  let zoom = 1, viewStart = 0;     // timeline zoom + left edge (seconds)
  let blocksExpanded = false;
  let hoveredTimelineTime = null;
  const expandedTagCards = new Set();
  let playheadRaf = null;
  let currentAudioHandle = null, currentAudioHandleId = null;

  function showToast(msg, opts) {
    toast.innerHTML = '';
    const hasActions = !!(opts && (opts.actionLabel || (opts.actions && opts.actions.length)));
    const hasClose = !!(opts && opts.closeBtn);
    toast.classList.toggle('action', hasActions || hasClose);

    const span = document.createElement('span');
    span.className = 'toast-msg';
    span.textContent = msg;
    toast.appendChild(span);

    function dismissToast() {
      clearTimeout(showToast._t);
      if (window.gsap) {
        gsap.to(toast, { y: 16, opacity: 0, scale: 0.96, duration: 0.25, ease: 'power2.in', onComplete: () => toast.classList.remove('show') });
      } else {
        toast.classList.remove('show');
      }
    }

    if (hasActions || hasClose) {
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'toast-actions';

      if (opts && opts.actions && Array.isArray(opts.actions)) {
        opts.actions.forEach(act => {
          const btn = document.createElement('button');
          btn.className = 'toast-action-btn' + (act.secondary ? ' secondary' : '');
          btn.textContent = act.label;
          btn.addEventListener('click', () => {
            dismissToast();
            if (act.onAction) act.onAction();
          });
          actionsWrap.appendChild(btn);
        });
      } else if (opts && opts.actionLabel) {
        const btn = document.createElement('button');
        btn.className = 'toast-action-btn';
        btn.textContent = opts.actionLabel;
        btn.addEventListener('click', () => {
          dismissToast();
          if (opts.onAction) opts.onAction();
        });
        actionsWrap.appendChild(btn);
      }

      if (hasClose) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close-btn';
        closeBtn.setAttribute('title', 'Dismiss');
        closeBtn.setAttribute('aria-label', 'Dismiss notification');
        closeBtn.innerHTML = '✕';
        closeBtn.addEventListener('click', dismissToast);
        actionsWrap.appendChild(closeBtn);
      }

      toast.appendChild(actionsWrap);
    }

    toast.classList.add('show');
    if (window.gsap) {
      gsap.fromTo(toast, { y: 24, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.32, ease: 'back.out(1.6)' });
    }
    clearTimeout(showToast._t);
    if (!(opts && opts.sticky)) showToast._t = setTimeout(dismissToast, (opts && opts.duration) || 2400);
  }

  function fmt(sec, style) {
    if (sec == null || isNaN(sec)) return style === 'display' ? '--:--.---' : '00:00.000';
    const totalMs = Math.round(sec * 1000);
    const h = Math.floor(totalMs / 3600000), m = Math.floor((totalMs % 3600000) / 60000);
    const s = Math.floor((totalMs % 60000) / 1000), msRem = totalMs % 1000;
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    if (style === 'display') return `${pad(m)}:${pad(s)}.${pad(msRem, 3)}`;
    if (style === 'lrc') return `${pad(m)}:${pad(s)}.${pad(Math.floor(msRem / 10))}`;
    if (style === 'srt') return `${pad(h)}:${pad(m)}:${pad(s)},${pad(msRem, 3)}`;
    return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(msRem, 3)}`;
  }
  function parseTimeInput(str) {
    str = (str || '').trim(); if (!str) return null;
    let m = str.match(/^(\d+):([0-5]?\d)(?:\.(\d{1,3}))?$/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (m[3] ? parseInt(m[3].padEnd(3, '0'), 10) / 1000 : 0);
    m = str.match(/^(\d+)(?:\.(\d{1,3}))?$/);
    if (m) return parseInt(m[1], 10) + (m[2] ? parseInt(m[2].padEnd(3, '0'), 10) / 1000 : 0);
    return null;
  }
  function formatDuration(sec) {
    const abs = Math.abs(sec);
    let out = abs >= 60 ? `${Math.floor(abs / 60)}m ${(abs - Math.floor(abs / 60) * 60).toFixed(2).padStart(5, '0')}s` : `${abs.toFixed(3)}s`;
    return sec < 0 ? `−${out} (end before start)` : out;
  }
  function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function cssVar(name, fb) { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; }

  function updateStatus() {
    statusLine.innerHTML = `${audioLoaded ? '<b>audio ready</b>' : 'no audio loaded'} · ${items.length ? '<b>lyrics ready</b>' : 'no lyrics loaded'}`;
    setupPaneMeta.textContent = hasAudioFile ? (songBaseName || 'song loaded') : 'no song loaded';
    consolePaneMeta.textContent = items.length
      ? `${items.length} ${mode === 'line' ? 'lines' : 'words'} · ${activeCapture === 'start' ? 'Start only' : 'Start & End'}`
      : 'nothing loaded yet';
  }

  /* ---------------------------------------------------------------
     Accordion — each pane has its own header; opening one closes the
     other. Switching panes never touches tagging state.
  --------------------------------------------------------------- */
  function expandSection(el, header) {
    if (!el.classList.contains('collapsed')) return;
    el.style.height = '0px';
    el.classList.remove('collapsed');
    void el.offsetHeight;
    const targetH = el.scrollHeight;
    if (window.gsap) {
      gsap.to(el, {
        height: targetH,
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out',
        onComplete: () => {
          el.style.height = 'auto';
          updateLyricPadding();
        }
      });
    } else {
      el.style.height = targetH + 'px';
      const onEnd = ev => {
        if (ev.target !== el || ev.propertyName !== 'height') return;
        el.style.height = 'auto';
        el.removeEventListener('transitionend', onEnd);
        updateLyricPadding();
      };
      el.addEventListener('transitionend', onEnd);
    }
    header.setAttribute('aria-expanded', 'true');
  }
  function collapseSection(el, header) {
    if (el.classList.contains('collapsed')) return;
    if (window.gsap) {
      gsap.to(el, {
        height: 0,
        opacity: 0,
        duration: 0.32,
        ease: 'power2.inOut',
        onComplete: () => {
          el.classList.add('collapsed');
        }
      });
    } else {
      el.style.height = el.scrollHeight + 'px';
      void el.offsetHeight;
      requestAnimationFrame(() => { el.classList.add('collapsed'); el.style.height = '0px'; });
    }
    header.setAttribute('aria-expanded', 'false');
  }
  function openPane(which) {
    if (which === 'setup') {
      collapseSection(consoleSection, consoleHeader);
      expandSection(setupSection, setupHeader);
    } else {
      collapseSection(setupSection, setupHeader);
      expandSection(consoleSection, consoleHeader);
    }
  }
  setupHeader.addEventListener('click', () => {
    if (setupHeader.getAttribute('aria-expanded') === 'true') {
      if (items.length) openPane('console');       // never leave both shut
    } else openPane('setup');
  });
  consoleHeader.addEventListener('click', () => {
    if (consoleHeader.getAttribute('aria-expanded') === 'true') openPane('setup');
    else {
      if (!items.length) { showToast('Load a song and lyrics first.'); return; }
      openPane('console');
    }
  });

  /* ---------------------------------------------------------------
     Dock resize (drag its top edge)
  --------------------------------------------------------------- */
  (function dockResize() {
    let dragging = false, startY = 0, startH = 0;
    const MIN = 225, MAX = () => Math.min(window.innerHeight * 0.75, 760);
    function px() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--player-h')) || 275; }
    dockResizeHandle.addEventListener('mousedown', e => {
      dragging = true; startY = e.clientY; startH = px();
      dockResizeHandle.classList.add('dragging');
      document.body.classList.add('dock-resizing');
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      const next = Math.max(MIN, Math.min(MAX(), startH + (startY - e.clientY)));
      document.documentElement.style.setProperty('--player-h', next + 'px');
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      dockResizeHandle.classList.remove('dragging');
      document.body.classList.remove('dock-resizing');
      drawWaveform(); drawMinimap(); renderBlocks();
      if (window.TimingConsoleSpectrum) window.TimingConsoleSpectrum.onResize();
      try { localStorage.setItem('timing-console-dock-h', px()); } catch (e) { }
    });
    let savedH = null;
    try { savedH = localStorage.getItem('timing-console-dock-h'); } catch (e) { }
    const initialH = Math.max(MIN, savedH ? parseFloat(savedH) : 275);
    document.documentElement.style.setProperty('--player-h', initialH + 'px');
  })();

  blocksExpandBtn.addEventListener('click', () => {
    blocksExpanded = !blocksExpanded;
    blocksTrack.classList.toggle('expanded', blocksExpanded);
    blocksExpandBtn.classList.toggle('expanded', blocksExpanded);
    blocksExpandBtn.title = blocksExpanded ? 'Collapse lyric blocks track to slim strip' : 'Expand lyric blocks track (show text)';
    const h = blocksExpanded ? 80 : 14;
    document.documentElement.style.setProperty('--blocks-h', h + 'px');
    // grow the dock alongside it so the waveform doesn't get squeezed
    const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--player-h')) || 275;
    document.documentElement.style.setProperty('--player-h', (cur + (blocksExpanded ? 66 : -66)) + 'px');
    setTimeout(() => { drawWaveform(); drawMinimap(); renderBlocks(); if (window.TimingConsoleSpectrum) window.TimingConsoleSpectrum.onResize(); }, 380);
  });

  /* ---------------------------------------------------------------
     IndexedDB File Handle Store & Audio loading
  --------------------------------------------------------------- */
  const AudioHandleStore = {
    dbPromise: null,
    getDb() {
      if (!this.dbPromise) {
        this.dbPromise = new Promise(resolve => {
          if (!window.indexedDB) { resolve(null); return; }
          const req = indexedDB.open('timing-console-file-storage', 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('audio_handles')) {
              db.createObjectStore('audio_handles', { keyPath: 'id' });
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        });
      }
      return this.dbPromise;
    },
    async saveHandle(id, handle, meta = {}) {
      try {
        const db = await this.getDb();
        if (!db) return false;
        return new Promise(resolve => {
          const tx = db.transaction('audio_handles', 'readwrite');
          tx.objectStore('audio_handles').put({ id, handle, meta, savedAt: Date.now() });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        });
      } catch (e) {
        return false;
      }
    },
    async getHandle(id) {
      try {
        const db = await this.getDb();
        if (!db) return null;
        return new Promise(resolve => {
          const tx = db.transaction('audio_handles', 'readonly');
          const req = tx.objectStore('audio_handles').get(id);
          req.onsuccess = () => resolve(req.result ? req.result.handle : null);
          req.onerror = () => resolve(null);
        });
      } catch (e) {
        return null;
      }
    }
  };

  function loadAudioFile(f, handle = null) {
    if (!f) return;
    if (handle) {
      currentAudioHandle = handle;
      currentAudioHandleId = 'audio-' + (handle.name || f.name);
      AudioHandleStore.saveHandle(currentAudioHandleId, handle, { name: f.name });
    }
    player.src = URL.createObjectURL(f);
    audioFileName.textContent = f.name; audioFileName.classList.remove('empty');
    songBaseName = f.name.replace(/\.[^/.]+$/, '');
    hasAudioFile = true; audioLoaded = false;
    playerSongName.textContent = f.name; playerSongName.classList.remove('empty');
    player.load(); checkBuildReady(); decodeWaveform(f);
    if (window.TimingConsoleSpectrum) window.TimingConsoleSpectrum.attachAudio(player);
  }

  // Intercept label click to use File System Access API if available
  const audioFileLabel = audioFileInput.closest('.filebtn') || audioFileInput.parentElement;
  if (audioFileLabel && window.showOpenFilePicker) {
    audioFileLabel.addEventListener('click', async e => {
      e.preventDefault();
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'Audio Files',
            accept: {
              'audio/*': ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.opus', '.weba', '.wma']
            }
          }]
        });
        if (!handle) return;
        const file = await handle.getFile();
        loadAudioFile(file, handle);
      } catch (err) {
        if (err && err.name === 'AbortError') return; // User closed picker
        audioFileInput.click(); // Fallback to standard input
      }
    });
  }

  audioFileInput.addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    loadAudioFile(f, null);
  });

  /* Audio Drag & Drop Handling */
  const audioDropzone = $('audioDropzone') || audioFileLabel;
  if (audioDropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      audioDropzone.addEventListener(eventName, e => {
        e.preventDefault(); e.stopPropagation();
        audioDropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      audioDropzone.addEventListener(eventName, e => {
        e.preventDefault(); e.stopPropagation();
        audioDropzone.classList.remove('dragover');
      });
    });
    audioDropzone.addEventListener('drop', e => {
      const dt = e.dataTransfer;
      if (!dt || !dt.files || !dt.files.length) return;
      const f = dt.files[0];
      if (f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac|opus|weba|wma)$/i.test(f.name)) {
        loadAudioFile(f, null);
        showToast(`Loaded audio track: ${f.name}`);
      } else {
        showToast('Please drop a valid audio file (.mp3, .wav, .flac, .m4a)');
      }
    });
  }

  /* Synthetic In-Browser Demo Track Generator (124 BPM Electronic Groove) */
  function createDemoAudioFile() {
    const sampleRate = 44100;
    const durationSec = 32;
    const numSamples = sampleRate * durationSec;
    const buffer = new Float32Array(numSamples);

    const bpm = 124;
    const beatInterval = 60 / bpm;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const beat = (t % beatInterval) / beatInterval;

      // Kick drum on each beat
      const kickEnv = Math.exp(-beat * 24);
      const kickFreq = 140 * Math.exp(-beat * 20) + 45;
      const kick = Math.sin(2 * Math.PI * kickFreq * beat * beatInterval) * kickEnv * 0.7;

      // Bass synth line
      const barTime = (t % (beatInterval * 4)) / (beatInterval * 4);
      const bassNotes = [55, 65.4, 73.4, 82.4]; // A, C, D, E notes
      const bassFreq = bassNotes[Math.floor(barTime * 4) % 4];
      const bassEnv = Math.exp(-(beat % 0.5) * 8);
      const bass = (Math.sin(2 * Math.PI * bassFreq * t) + 0.3 * Math.sin(4 * Math.PI * bassFreq * t)) * bassEnv * 0.35;

      // Hi-hat on off-beats
      const hatBeat = ((t + beatInterval / 2) % beatInterval) / beatInterval;
      const hatEnv = Math.exp(-hatBeat * 45);
      const noise = (Math.random() * 2 - 1) * hatEnv * 0.15;

      // Atmospheric melodic pad
      const pad = (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 277.18 * t) + Math.sin(2 * Math.PI * 329.63 * t)) * 0.08;

      buffer[i] = Math.max(-1, Math.min(1, kick + bass + noise + pad));
    }

    const wavBytes = new Uint8Array(44 + numSamples * 2);
    const view = new DataView(wavBytes.buffer);

    function writeString(offset, str) {
      for (let j = 0; j < str.length; j++) view.setUint8(offset + j, str.charCodeAt(j));
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    const blob = new Blob([wavBytes], { type: 'audio/wav' });
    return new File([blob], 'Timing_Console_Demo_Track.wav', { type: 'audio/wav' });
  }

  const loadDemoAudioBtn = $('loadDemoAudioBtn');
  if (loadDemoAudioBtn) {
    loadDemoAudioBtn.addEventListener('click', () => {
      const demoFile = createDemoAudioFile();
      loadAudioFile(demoFile, null);
      showToast('⚡ Demo audio track loaded! Ready to play or sync.');
    });
  }

  player.addEventListener('loadedmetadata', () => {
    audioLoaded = true;
    tcTotal.textContent = '/ ' + fmt(player.duration, 'display');
    viewStart = 0; zoom = 1; updateZoomUI();
    updateStatus(); checkBuildReady(); renderBlocks();
  });

  function decodeWaveform(file) {
    waveformPeaks = null;
    waveformEmpty.style.display = 'flex';
    waveformEmpty.textContent = 'Decoding waveform…';
    const reader = new FileReader();
    reader.onload = function (ev) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        ctx.decodeAudioData(ev.target.result.slice(0), function (buffer) {
          waveformPeaks = computePeaks(buffer, 4000);
          waveformEmpty.style.display = 'none';
          drawWaveform(); drawMinimap();
          ctx.close && ctx.close();
        }, function () { waveformEmpty.textContent = 'Waveform preview unavailable for this file'; });
      } catch (err) { waveformEmpty.textContent = 'Waveform preview unavailable for this file'; }
    };
    reader.readAsArrayBuffer(file);
  }

  function computePeaks(buffer, numBuckets) {
    const length = buffer.length;
    const bucketSize = Math.max(1, Math.floor(length / numBuckets));
    const peaks = new Float32Array(numBuckets);
    const d0 = buffer.getChannelData(0);
    const d1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
    for (let i = 0; i < numBuckets; i++) {
      const s = i * bucketSize, e = Math.min(length, s + bucketSize);
      let peak = 0;
      for (let j = s; j < e; j += 3) {
        let v = Math.abs(d0[j]);
        if (d1) v = Math.max(v, Math.abs(d1[j]));
        if (v > peak) peak = v;
      }
      peaks[i] = peak;
    }
    let max = 0;
    for (let i = 0; i < peaks.length; i++) if (peaks[i] > max) max = peaks[i];
    if (max > 0) for (let i = 0; i < peaks.length; i++) peaks[i] = (peaks[i] / max) * 0.95;
    return peaks;
  }

  /* ---------------------------------------------------------------
     Timeline view maths (zoom + horizontal scroll + pixel metrics)
  --------------------------------------------------------------- */
  function duration() { return player.duration || 0; }
  function visibleDur() { return duration() / zoom; }
  function clampView() {
    const maxStart = Math.max(0, duration() - visibleDur());
    viewStart = Math.max(0, Math.min(maxStart, viewStart));
  }

  function getWaveformMetrics() {
    const rect = waveformWrap.getBoundingClientRect();
    const borderLeft = waveformWrap.clientLeft || 0;
    const width = waveformWrap.clientWidth || Math.max(1, rect.width - borderLeft * 2);
    return { rect, borderLeft, width };
  }

  function clientXToWaveformTime(clientX) {
    if (!hasAudioFile || !duration()) return 0;
    const { rect, borderLeft, width } = getWaveformMetrics();
    if (width <= 0) return viewStart;
    const pixelX = Math.max(0, Math.min(width, clientX - rect.left - borderLeft));
    const vd = visibleDur(); // duration() / zoom
    return Math.max(0, Math.min(duration(), viewStart + (pixelX / width) * vd));
  }

  function timeToWaveformX(t) {
    const { width } = getWaveformMetrics();
    if (width <= 0 || !duration()) return 0;
    const vd = visibleDur();
    return ((t - viewStart) / vd) * width;
  }

  function timeToX(t, width) { return ((t - viewStart) / visibleDur()) * width; }
  function xToTime(x, width) { return viewStart + (x / width) * visibleDur(); }

  function updateZoomUI() {
    zoomLabel.textContent = zoom + '×';
    minimap.classList.toggle('show', zoom > 1);
    updateMinimapWindow();
  }
  function setZoom(next, focusTime) {
    const prev = zoom;
    zoom = Math.max(1, Math.min(64, next));
    if (zoom === prev) return;
    const focus = focusTime != null ? focusTime : (player.currentTime || viewStart + visibleDur() / 2);
    // keep the focus point roughly where it was on screen
    viewStart = focus - visibleDur() / 2;
    clampView();
    updateZoomUI(); drawWaveform(); renderBlocks(); updatePlayhead();
  }
  zoomInBtn.addEventListener('click', () => setZoom(zoom * 2));
  zoomOutBtn.addEventListener('click', () => setZoom(zoom / 2));

  waveformWrap.addEventListener('wheel', e => {
    if (!duration()) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(zoom * (e.deltaY < 0 ? 1.3 : 1 / 1.3), clientXToWaveformTime(e.clientX));
    } else if (zoom > 1) {
      e.preventDefault();
      viewStart += (e.deltaY + e.deltaX) * (visibleDur() / 600);
      clampView(); drawWaveform(); renderBlocks(); updatePlayhead(); updateMinimapWindow();
    }
  }, { passive: false });

  /* ---------------------------------------------------------------
     Waveform + minimap drawing
  --------------------------------------------------------------- */
  function drawWaveform() {
    const w = waveformWrap.clientWidth, h = waveformWrap.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    waveformCanvas.width = w * dpr; waveformCanvas.height = h * dpr;
    waveformCanvas.style.width = w + 'px'; waveformCanvas.style.height = h + 'px';
    const ctx = waveformCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!waveformPeaks || !duration()) return;

    const track = cssVar('--waveform-track', 'rgba(255, 255, 255, 0.08)');
    const playedCol = cssVar('--waveform-played', '#e2b34a');
    const mid = h / 2, n = waveformPeaks.length;
    const vd = visibleDur(), playedT = player.currentTime || 0;

    // Warm, calm golden acoustic gradient for played bars
    const playedGrad = ctx.createLinearGradient(0, 0, 0, h);
    playedGrad.addColorStop(0, 'rgba(245, 223, 154, 0.95)');
    playedGrad.addColorStop(0.5, 'rgba(253, 247, 236, 0.98)');
    playedGrad.addColorStop(1, 'rgba(226, 179, 74, 0.90)');

    for (let x = 0; x < w; x++) {
      const t0 = viewStart + (x / w) * vd;
      const t1 = viewStart + ((x + 1) / w) * vd;
      let i0 = Math.floor((t0 / duration()) * n);
      let i1 = Math.ceil((t1 / duration()) * n);
      i0 = Math.max(0, Math.min(n - 1, i0)); i1 = Math.max(i0 + 1, Math.min(n, i1));
      let peak = 0;
      for (let i = i0; i < i1; i++) if (waveformPeaks[i] > peak) peak = waveformPeaks[i];
      const barH = Math.max(1.5, peak * (h - 8));
      ctx.fillStyle = t0 <= playedT ? playedGrad : track;
      ctx.fillRect(x, mid - barH / 2, 1, barH);
    }

    // Tick marks for captured times with delicate studio pins
    const startTick = cssVar('--accent', '#e2b34a');
    const endTick = cssVar('--accent-2', '#dfcfab');
    items.forEach(it => {
      if (it.start != null) {
        const x = timeToX(it.start, w);
        if (x >= -2 && x <= w + 2) {
          ctx.fillStyle = startTick;
          ctx.fillRect(x - 0.5, 0, 1.5, h);
          ctx.fillRect(x - 1.5, 0, 3, 3);
        }
      }
      if (activeCapture === 'both' && it.end != null) {
        const x = timeToX(it.end, w);
        if (x >= -2 && x <= w + 2) {
          ctx.fillStyle = endTick;
          ctx.fillRect(x - 0.5, 0, 1.5, h);
          ctx.fillRect(x - 1.5, h - 3, 3, 3);
        }
      }
    });
  }

  function drawMinimap() {
    const w = minimap.clientWidth, h = minimap.clientHeight;
    if (!w || !h || !waveformPeaks) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    minimapCanvas.width = w * dpr; minimapCanvas.height = h * dpr;
    minimapCanvas.style.width = w + 'px'; minimapCanvas.style.height = h + 'px';
    const ctx = minimapCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const n = waveformPeaks.length, mid = h / 2;
    ctx.fillStyle = cssVar('--text-faint', '#58665e');
    for (let x = 0; x < w; x++) {
      const i0 = Math.floor((x / w) * n), i1 = Math.max(i0 + 1, Math.floor(((x + 1) / w) * n));
      let peak = 0;
      for (let i = i0; i < i1 && i < n; i++) if (waveformPeaks[i] > peak) peak = waveformPeaks[i];
      const barH = Math.max(1, peak * (h - 2));
      ctx.fillRect(x, mid - barH / 2, 1, barH);
    }
  }

  function updateMinimapWindow() {
    if (!duration()) return;
    const frac = visibleDur() / duration();
    minimapWindow.style.left = (viewStart / duration() * 100) + '%';
    minimapWindow.style.width = Math.max(1, frac * 100) + '%';
  }

  (function minimapDrag() {
    let dragging = false;
    function moveTo(clientX) {
      const rect = minimap.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      viewStart = frac * duration() - visibleDur() / 2;
      clampView(); drawWaveform(); renderBlocks(); updatePlayhead(); updateMinimapWindow();
    }
    minimap.addEventListener('mousedown', e => { dragging = true; moveTo(e.clientX); e.preventDefault(); });
    window.addEventListener('mousemove', e => { if (dragging) moveTo(e.clientX); });
    window.addEventListener('mouseup', () => { dragging = false; });
  })();

  /* ---------------------------------------------------------------
     Playhead — click to seek, drag to scrub
  --------------------------------------------------------------- */
  function updatePlayhead() {
    const w = waveformWrap.clientWidth;
    if (!w || !duration()) return;
    const x = timeToWaveformX(player.currentTime || 0);
    if (x < 0 || x > w) {
      waveformPlayhead.style.display = 'none';
    } else {
      waveformPlayhead.style.display = '';
      waveformPlayhead.style.left = x + 'px';
    }
  }

  (function scrub() {
    let dragging = false;
    let wasPlaying = false;

    function seekAt(clientX) {
      if (!hasAudioFile || !duration()) return;
      const t = clientXToWaveformTime(clientX);
      player.currentTime = t;
      tcCurrent.textContent = fmt(t, 'display');
      updatePlayhead();
      drawWaveform();
      updateActivePlayingState();
    }

    waveformWrap.addEventListener('mousedown', e => {
      if (!hasAudioFile) { showToast('Load a song first.'); return; }
      dragging = true;
      wasPlaying = !player.paused;
      if (wasPlaying) player.pause();
      document.body.classList.add('scrubbing');
      seekAt(e.clientX);
      e.preventDefault();
    });

    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      seekAt(e.clientX);

      // Smooth horizontal pan scroll when dragging past edges while zoomed in
      if (zoom > 1) {
        const { rect, borderLeft, width } = getWaveformMetrics();
        const px = e.clientX - rect.left - borderLeft;
        const vd = visibleDur();
        if (px < 15 && viewStart > 0) {
          viewStart = Math.max(0, viewStart - vd * 0.035);
          clampView(); drawWaveform(); renderBlocks(); updatePlayhead(); updateMinimapWindow();
        } else if (px > width - 15 && viewStart < duration() - vd) {
          viewStart = Math.min(duration() - vd, viewStart + vd * 0.035);
          clampView(); drawWaveform(); renderBlocks(); updatePlayhead(); updateMinimapWindow();
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('scrubbing');
      if (wasPlaying) player.play().catch(() => { });
    });
  })();

  /* ---------------------------------------------------------------
     Timeline hover preview scrubber (ghost playhead)
  --------------------------------------------------------------- */
  (function timelineHover() {
    waveformWrap.addEventListener('mousemove', e => {
      if (!hasAudioFile || !duration()) return;
      const { rect, borderLeft, width } = getWaveformMetrics();
      const pixelX = Math.max(0, Math.min(width, e.clientX - rect.left - borderLeft));
      hoveredTimelineTime = clientXToWaveformTime(e.clientX);
      if (waveformHoverLine) {
        waveformHoverLine.style.left = pixelX + 'px';
        waveformHoverLine.classList.add('active');
        if (hoverTimeTag) hoverTimeTag.textContent = fmt(hoveredTimelineTime, 'display');
      }
    });
    waveformWrap.addEventListener('mouseleave', () => {
      hoveredTimelineTime = null;
      if (waveformHoverLine) waveformHoverLine.classList.remove('active');
    });
  })();

  /* ---------------------------------------------------------------
     Lyric blocks track — one region per tagged line, draggable
  --------------------------------------------------------------- */
  function blockEnd(it, idx) {
    if (it.end != null) return it.end;
    // pending block: extend to the next started line, or a short default
    const laters = items.filter((o, i) => i !== idx && o.start != null && o.start > it.start).map(o => o.start);
    return laters.length ? Math.min.apply(null, laters) : it.start + 2;
  }

  function renderBlocks() {
    const w = blocksTrack.clientWidth;
    const tagged = items.map((it, i) => ({ it, i })).filter(x => x.it.start != null);
    blocksEmpty.style.display = tagged.length ? 'none' : (blocksExpanded ? 'flex' : 'none');
    if (!w || !duration()) { blocksInner.innerHTML = ''; return; }

    blocksInner.innerHTML = tagged.map(({ it, i }) => {
      const s = it.start, e = blockEnd(it, i);
      const x0 = timeToX(s, w), x1 = timeToX(e, w);
      if (x1 < -40 || x0 > w + 40) return '';
      const left = x0, width = Math.max(4, x1 - x0);
      const pending = it.end == null && activeCapture === 'both';
      const isPlaying = (i === currentPlayingIdx);
      const rightHandleHtml = activeCapture === 'both'
        ? `<span class="bl-handle right" data-handle="end" data-idx="${i}" title="Drag to adjust End"></span>`
        : `<span class="bl-edge-fixed right" aria-hidden="true"></span>`;
      return `<div class="lyric-block ${pending ? 'pending' : ''} ${isPlaying ? 'active-playing' : ''}" data-idx="${i}" style="left:${left}px;width:${width}px;">
        <span class="bl-handle left" data-handle="start" data-idx="${i}" title="Drag to adjust Start"></span>
        <span class="bl-text">${escapeHtml(it.text)}</span>
        ${rightHandleHtml}
      </div>`;
    }).join('');
  }

  function syncTagCardLive(idx) {
    const it = items[idx];
    if (!it) return;
    const card = tagsPanel.querySelector(`.tag-item[data-idx="${idx}"]`);
    if (!card) return;

    const sInput = card.querySelector('.tv-input[data-field="start"]');
    if (sInput && document.activeElement !== sInput) {
      sInput.value = it.start != null ? fmt(it.start, 'display') : '';
    }

    const eInput = card.querySelector('.tv-input[data-field="end"]');
    if (eInput && document.activeElement !== eInput) {
      eInput.value = it.end != null ? fmt(it.end, 'display') : '';
    }

    const statusEl = card.querySelector('.tag-compact-status');
    if (statusEl) {
      if (activeCapture === 'both') {
        if (it.start != null && it.end != null) statusEl.textContent = `${fmt(it.start, 'display')} → ${fmt(it.end, 'display')}`;
        else if (it.start != null) statusEl.textContent = `Start: ${fmt(it.start, 'display')}`;
      } else {
        if (it.start != null) {
          const inferredEnd = blockEnd(it, idx);
          const d = inferredEnd - it.start;
          statusEl.innerHTML = `${fmt(it.start, 'display')} <span class="est-compact-dur">(~${formatDuration(d)})</span>`;
        }
      }
    }

    const durDv = card.querySelector('.t-duration .dv');
    if (durDv) {
      if (activeCapture === 'both' && it.start != null && it.end != null) {
        const d = it.end - it.start;
        durDv.textContent = formatDuration(d);
        const durRow = card.querySelector('.t-duration');
        if (durRow) durRow.classList.toggle('negative', d < 0);
      } else if (activeCapture === 'start' && it.start != null) {
        const inferredEnd = blockEnd(it, idx);
        const d = inferredEnd - it.start;
        durDv.textContent = `~${formatDuration(d)}`;
        const durRow = card.querySelector('.t-duration');
        if (durRow) durRow.classList.toggle('negative', d < 0);
      }
    }
  }

  (function blockDrag() {
    let mode = null;      // 'start' | 'end' | 'move'
    let idx = -1, grabTime = 0, origStart = 0, origEnd = 0, el = null;

    blocksInner.addEventListener('mousedown', e => {
      const handle = e.target.closest('.bl-handle');
      const block = e.target.closest('.lyric-block');
      if (!block) return;
      idx = parseInt(block.dataset.idx, 10);
      const it = items[idx];
      if (!it) return;

      const rect = blocksTrack.getBoundingClientRect();
      grabTime = xToTime(e.clientX - rect.left, rect.width);
      origStart = it.start;
      // In Start & End mode, if it.end is null, initialize origEnd from inferred blockEnd!
      origEnd = it.end != null ? it.end : blockEnd(it, idx);
      el = block;

      if (handle && handle.dataset.handle === 'end') {
        if (activeCapture === 'start') return;
        mode = 'end';
      } else if (handle && handle.dataset.handle === 'start') {
        mode = 'start';
      } else {
        mode = 'move';
      }

      block.classList.add('dragging');
      document.body.classList.add('scrubbing');
      e.preventDefault(); e.stopPropagation();
    });

    window.addEventListener('mousemove', e => {
      if (!mode || idx < 0 || !el) return;
      const rect = blocksTrack.getBoundingClientRect();
      const t = xToTime(e.clientX - rect.left, rect.width);
      const delta = t - grabTime;
      const it = items[idx];
      if (!it) return;

      if (mode === 'start') {
        let ns = Math.max(0, origStart + delta);
        const limitEnd = (activeCapture === 'both')
          ? (it.end != null ? it.end : origEnd)
          : origEnd;
        ns = Math.min(ns, Math.max(0, limitEnd - 0.05));
        it.start = ns;
      } else if (mode === 'end') {
        if (activeCapture === 'both') {
          const ne = Math.max(it.start + 0.05, Math.min(duration(), origEnd + delta));
          it.end = ne;
          el.classList.remove('pending');
        }
      } else { // 'move'
        if (activeCapture === 'both') {
          const span = Math.max(0.05, origEnd - origStart);
          let ns = Math.max(0, Math.min(duration() - span, origStart + delta));
          it.start = ns;
          it.end = ns + span;
          el.classList.remove('pending');
        } else {
          // Start only mode: moves the start time
          let ns = Math.max(0, Math.min(duration() - 0.05, origStart + delta));
          it.start = ns;
        }
      }

      // Directly update the dragged DOM block's position and width without innerHTML wipe
      const w = blocksTrack.clientWidth;
      const s = it.start, endT = blockEnd(it, idx);
      const x0 = timeToX(s, w), x1 = timeToX(endT, w);
      const left = x0, width = Math.max(4, x1 - x0);
      el.style.left = left + 'px';
      el.style.width = width + 'px';
      drawWaveform();

      // Keep Captured Timestamps panel in live sync
      syncTagCardLive(idx);
    });

    window.addEventListener('mouseup', () => {
      if (!mode) return;
      if (el) el.classList.remove('dragging');
      document.body.classList.remove('scrubbing');
      mode = null; idx = -1; el = null;
      renderBlocks();
      drawWaveform();
      renderTags();
      renderLyrics({ keepScroll: true });
      saveAutosave();
    });
  })();

  /* ---------------------------------------------------------------
     Lyrics / capture setup
  --------------------------------------------------------------- */
  lyricsFileInput.addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => { lyricsInput.value = ev.target.result; checkBuildReady(); };
    reader.readAsText(f);
  });

  /* Lyrics Drag & Drop Handling */
  const lyricsDropzone = $('lyricsDropzone');
  if (lyricsDropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      lyricsDropzone.addEventListener(eventName, e => {
        e.preventDefault(); e.stopPropagation();
        lyricsDropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      lyricsDropzone.addEventListener(eventName, e => {
        e.preventDefault(); e.stopPropagation();
        lyricsDropzone.classList.remove('dragover');
      });
    });
    lyricsDropzone.addEventListener('drop', e => {
      const dt = e.dataTransfer;
      if (!dt || !dt.files || !dt.files.length) return;
      const f = dt.files[0];
      const reader = new FileReader();
      reader.onload = ev => {
        lyricsInput.value = ev.target.result;
        checkBuildReady();
        showToast(`Loaded lyrics from: ${f.name}`);
      };
      reader.readAsText(f);
    });
  }

  const clearLyricsBtn = $('clearLyricsBtn');
  if (clearLyricsBtn) {
    clearLyricsBtn.addEventListener('click', () => {
      lyricsInput.value = '';
      checkBuildReady();
      lyricsInput.focus();
    });
  }

  const loadDemoLyricsBtn = $('loadDemoLyricsBtn');
  if (loadDemoLyricsBtn) {
    loadDemoLyricsBtn.addEventListener('click', () => {
      const sampleText = [
        'Electric pulses traveling down the wire',
        'Synchronizing frequencies higher and higher',
        'Capture the instant when the bass drop hits',
        'Every single syllable flawlessly fits',
        'Precision timing in the digital space',
        'Locking the rhythm in its rightful place',
        'Feel the momentum as the waveforms glow',
        'This is the future of audio workflow'
      ].join('\n');
      lyricsInput.value = sampleText;
      checkBuildReady();
      showToast('📄 Sample lyrics loaded! Click "Load into console" to begin.');
    });
  }

  /* ---------------- 1-click full interactive demo ---------------- */
  const loadInteractiveDemoBtn = $('loadInteractiveDemoBtn');
  function loadInteractiveDemo() {
    const demoFile = createDemoAudioFile();
    loadAudioFile(demoFile, null);

    const demoItems = [
      { text: 'Electric pulses traveling down the wire', start: 0.40, end: 3.60, _revert: null },
      { text: 'Synchronizing frequencies higher and higher', start: 4.00, end: 7.40, _revert: null },
      { text: 'Capture the instant when the bass drop hits', start: 7.80, end: 11.20, _revert: null },
      { text: 'Every single syllable flawlessly fits', start: 11.60, end: 15.00, _revert: null },
      { text: 'Precision timing in the digital space', start: 15.50, end: 18.90, _revert: null },
      { text: 'Locking the rhythm in its rightful place', start: 19.40, end: 22.80, _revert: null },
      { text: 'Feel the momentum as the waveforms glow', start: 23.30, end: 26.60, _revert: null },
      { text: 'This is the future of audio workflow', start: 27.20, end: 30.50, _revert: null }
    ];

    lyricsInput.value = demoItems.map(d => d.text).join('\n');
    activeCapture = 'both';
    captureChoice = 'both';
    [...captureSeg.children].forEach(x => x.classList.toggle('active', x.dataset.capture === 'both'));
    if (captureHint) captureHint.textContent = 'Start & End — highlight stays on a line until its End is set, then moves on.';

    items = demoItems;
    history = [];
    cursorIndex = 0;
    stopLoop();

    updateStatus();
    renderLyrics();
    renderTags();
    renderBlocks();
    openPane('console');
    saveAutosave();

    showToast('⚡ Interactive demo loaded! Press Space or click Play to watch real-time sync.');
  }

  if (loadInteractiveDemoBtn) {
    loadInteractiveDemoBtn.addEventListener('click', loadInteractiveDemo);
  }

  lyricsInput.addEventListener('input', checkBuildReady);
  function checkBuildReady() {
    hasLyricsText = lyricsInput.value.trim().length > 0;
    buildBtn.disabled = !(hasAudioFile && hasLyricsText);
  }

  modeSeg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    mode = b.dataset.mode;
    [...modeSeg.children].forEach(x => x.classList.toggle('active', x === b));
  });
  captureSeg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    captureChoice = b.dataset.capture;
    [...captureSeg.children].forEach(x => x.classList.toggle('active', x === b));
    captureHint.textContent = captureChoice === 'start'
      ? 'Start only — one tap per line, highlight moves on immediately.'
      : 'Start & End — highlight stays on a line until its End is set, then moves on.';
  });
  interactionSeg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    interactionChoice = b.dataset.interaction;
    [...interactionSeg.children].forEach(x => x.classList.toggle('active', x === b));
  });
  speedSeg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    player.playbackRate = parseFloat(b.dataset.speed);
    [...speedSeg.children].forEach(x => x.classList.toggle('active', x === b));
  });

  buildBtn.addEventListener('click', () => {
    if (items.some(i => i.start != null || i.end != null)) {
      if (!window.confirm('Loading new lyrics will replace your current tagging progress. Continue?')) return;
    }
    const raw = lyricsInput.value;
    const parts = mode === 'line'
      ? raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      : raw.split(/\s+/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) { showToast('No lyrics found to load.'); return; }
    activeCapture = captureChoice; activeInteraction = interactionChoice;
    items = parts.map(text => ({ text, start: null, end: null, _revert: null }));
    history = []; cursorIndex = 0; stopLoop();
    updateStatus(); renderLyrics(); renderTags(); renderBlocks();
    openPane('console'); saveAutosave();
    showToast(`Loaded ${items.length} ${mode === 'line' ? 'lines' : 'words'} — ${activeCapture === 'start' ? 'Start only' : 'Start & End'}, ${activeInteraction === 'buttons' ? 'buttons' : 'click line'}.`);
  });

  function isComplete(it) {
    return activeCapture === 'start' ? it.start != null : (it.start != null && it.end != null);
  }
  function maybeAdvanceCursor(idx) {
    if (idx > cursorIndex) cursorIndex = idx;                       // follow the user forward
    if (isComplete(items[idx]) && idx >= cursorIndex) cursorIndex = Math.min(items.length, idx + 1);
  }

  /* ---------------------------------------------------------------
     Lyrics list — with position-preserving auto-advance & smooth scrolling
  --------------------------------------------------------------- */
  function updateLyricPadding() {
    const ph = lyricsPanel.clientHeight;
    if (!ph) return;
    const topPad = Math.max(0, Math.round(ph / 2 - 28));
    const btmPad = Math.max(0, Math.round(ph - 40));
    lyricsList.style.setProperty('--lyric-pad-top', topPad + 'px');
    lyricsList.style.setProperty('--lyric-pad-bottom', btmPad + 'px');
    lyricsList.style.setProperty('--lyric-pad', topPad + 'px');
  }

  function centreRow(el) {
    if (!el) return;
    const target = el.offsetTop - (lyricsPanel.clientHeight / 2) + (el.offsetHeight / 2);
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      lyricsPanel.scrollTop = Math.max(0, target);
      return;
    }
    if (window.gsap) {
      gsap.killTweensOf(lyricsPanel);
      lyricsPanel.style.scrollBehavior = 'auto';
      gsap.to(lyricsPanel, {
        scrollTop: Math.max(0, target),
        duration: 0.35,
        ease: 'power2.out',
        overwrite: 'auto'
      });
    } else {
      lyricsPanel.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }
  }

  function advanceScrollToNext(taggedIdx) {
    // 1. Measure the exact screen position of the just-tagged line relative to lyricsPanel
    const taggedEl = lyricsList.querySelector(`.lyric-row[data-idx="${taggedIdx}"]`);
    let taggedOffsetFromPanel = null;
    if (taggedEl) {
      const panelRect = lyricsPanel.getBoundingClientRect();
      const taggedRect = taggedEl.getBoundingClientRect();
      // Align vertical center so next line centers precisely under the cursor
      taggedOffsetFromPanel = (taggedRect.top + taggedRect.height / 2) - panelRect.top;
    }

    // 2. Re-render lyrics DOM without default auto-centering
    renderLyrics({ keepScroll: true });
    renderTags();
    saveAutosave();

    // 3. If there is no next row to advance to, we're done
    const nextIdx = cursorIndex;
    if (nextIdx >= items.length || taggedOffsetFromPanel == null) return;

    // 4. Find the newly active next row
    const nextEl = lyricsList.querySelector(`.lyric-row[data-idx="${nextIdx}"]`);
    if (!nextEl) return;

    // 5. Calculate where nextEl currently sits relative to the panel, and how far to scroll
    const panelRect = lyricsPanel.getBoundingClientRect();
    const nextRect = nextEl.getBoundingClientRect();
    const nextOffsetFromPanel = (nextRect.top + nextRect.height / 2) - panelRect.top;
    const delta = nextOffsetFromPanel - taggedOffsetFromPanel;
    const targetScrollTop = Math.max(0, lyricsPanel.scrollTop + delta);

    // 6. Smoothly animate lyricsPanel to targetScrollTop so nextEl lands exactly where taggedEl was
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      lyricsPanel.scrollTop = targetScrollTop;
      return;
    }

    if (window.gsap) {
      gsap.killTweensOf(lyricsPanel);
      lyricsPanel.style.scrollBehavior = 'auto';
      gsap.to(lyricsPanel, {
        scrollTop: targetScrollTop,
        duration: 0.35,
        ease: 'power2.out',
        overwrite: 'auto'
      });
    } else {
      lyricsPanel.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    }
  }

  function renderLyrics(opts) {
    opts = opts || {};
    if (!items.length) {
      lyricsList.innerHTML = '<div class="empty-state">Load a song and lyrics above, then click "Load into console" to begin tagging.</div>';
      lyricsCount.textContent = '0 / 0 complete';
      progressFill.style.width = '0%'; skippedBadge.style.display = 'none';
      return;
    }
    const cur = Math.min(cursorIndex, items.length - 1);
    const completeN = items.filter(isComplete).length;
    const startedOnlyN = activeCapture === 'both' ? items.filter(it => it.start != null && it.end == null).length : 0;
    lyricsCount.textContent = startedOnlyN > 0
      ? `${completeN} / ${items.length} complete · ${startedOnlyN} started`
      : `${completeN} / ${items.length} complete`;
    progressFill.style.width = `${(completeN / items.length * 100)}%`;
    const skippedN = items.slice(0, cursorIndex).filter(it => !isComplete(it)).length;
    skippedBadge.style.display = skippedN ? '' : 'none';
    if (skippedN) skippedBadge.textContent = `${skippedN} skipped`;

    lyricsList.innerHTML = items.map((it, i) => {
      const complete = isComplete(it);
      const isPlaying = (i === currentPlayingIdx);
      const cls = ['lyric-row'];
      if (complete) cls.push('complete');
      if (i === cur) cls.push('current');
      if (isPlaying) cls.push('playing-now');
      if (i < cursorIndex && !complete) cls.push('skipped');
      const revertHtml = it._revert ? `<button class="revertbtn" data-revert="${i}" title="Undo this line's last change">${REVERT_ICON}</button>` : '';
      const eqHtml = (isPlaying && !player.paused) ? `<span class="playing-indicator" title="Playing now"><span class="eq-b1"></span><span class="eq-b2"></span><span class="eq-b3"></span></span>` : '';

      if (activeInteraction === 'click') {
        const hint = activeCapture === 'start'
          ? (it.start != null ? 'tap to retag' : 'tap for start')
          : (it.start == null ? 'tap for start' : (it.end == null ? 'tap for end' : 'tap to retag'));
        const startChip = `<span class="timechip ${it.start != null ? 'start' : 'pending'}">${it.start != null ? fmt(it.start, 'display') : 'Start'}</span>`;
        const endChip = activeCapture === 'both' ? `<span class="timechip ${it.end != null ? 'end' : 'pending'}">${it.end != null ? fmt(it.end, 'display') : 'End'}</span>` : '';
        return `<div class="${cls.join(' ')} clickable" data-idx="${i}">
          <span class="idx">${String(i + 1).padStart(3, '0')}</span>
          ${eqHtml}
          <span class="txt">${escapeHtml(it.text)}</span>
          <span class="tap-hint">${hint}</span>
          <div class="markbtns">${startChip}${endChip}${revertHtml}</div>
        </div>`;
      }
      const endBtn = activeCapture === 'both'
        ? `<button class="markbtn end ${it.end != null ? 'set' : ''}" data-action="end" data-idx="${i}">${it.end != null ? fmt(it.end, 'display') : 'End'}</button>` : '';
      return `<div class="${cls.join(' ')}" data-idx="${i}">
        <span class="idx">${String(i + 1).padStart(3, '0')}</span>
        ${eqHtml}
        <span class="txt">${escapeHtml(it.text)}</span>
        <div class="markbtns">
          <button class="markbtn start ${it.start != null ? 'set' : ''}" data-action="start" data-idx="${i}">${it.start != null ? fmt(it.start, 'display') : 'Start'}</button>
          ${endBtn}${revertHtml}
        </div>
      </div>`;
    }).join('');

    updateLyricPadding();
    if (!opts.keepScroll) centreRow(lyricsList.querySelector('.lyric-row.current'));
    drawWaveform(); renderBlocks();
  }

  lyricsPanel.addEventListener('click', e => {
    const rev = e.target.closest('.revertbtn');
    if (rev) { revertLine(parseInt(rev.dataset.revert, 10)); return; }
    const mb = e.target.closest('.markbtn');
    if (mb) {
      const i = parseInt(mb.dataset.idx, 10);
      mb.dataset.action === 'start' ? setStart(i) : setEnd(i);
      return;
    }
    const row = e.target.closest('.lyric-row.clickable');
    if (row) handleRowTap(parseInt(row.dataset.idx, 10));
  });

  function handleRowTap(idx) {
    if (!hasAudioFile) { showToast('Load a song first.'); return; }
    const it = items[idx];
    if (activeCapture === 'start') { setStart(idx); return; }
    if (it.start == null) setStart(idx);
    else if (it.end == null) setEnd(idx);
    else { it.end = null; setStart(idx); }
  }

  function setStart(idx) {
    if (!hasAudioFile) { showToast('Load a song first.'); return; }
    const it = items[idx], prev = it.start;
    if (prev != null) it._revert = { field: 'start', value: prev };
    it.start = player.currentTime;
    const cursorBefore = cursorIndex;
    history.push({ idx, field: 'start', prevValue: prev, cursorBefore });
    maybeAdvanceCursor(idx);
    if (cursorIndex > cursorBefore && cursorIndex > idx) {
      advanceScrollToNext(idx);
    } else {
      renderLyrics({ keepScroll: true });
      renderTags();
      saveAutosave();
    }
    playHapticTick(1050);
  }
  function setEnd(idx) {
    if (!hasAudioFile) { showToast('Load a song first.'); return; }
    const it = items[idx], prev = it.end;
    if (prev != null) it._revert = { field: 'end', value: prev };
    it.end = player.currentTime;
    const cursorBefore = cursorIndex;
    history.push({ idx, field: 'end', prevValue: prev, cursorBefore });
    maybeAdvanceCursor(idx);
    if (cursorIndex > cursorBefore && cursorIndex > idx) {
      advanceScrollToNext(idx);
    } else {
      renderLyrics({ keepScroll: true });
      renderTags();
      saveAutosave();
    }
    playHapticTick(780);
  }
  function revertLine(idx) {
    const it = items[idx];
    if (!it || !it._revert) return;
    it[it._revert.field] = it._revert.value;
    it._revert = null;
    renderLyrics(); renderTags(); saveAutosave();
    showToast('Reverted to the previous timestamp on that line.');
  }

  /* ---------------------------------------------------------------
     Captured timestamps panel (Collapsible cards)
  --------------------------------------------------------------- */
  function renderTags() {
    const rel = items.map((it, i) => ({ ...it, i })).filter(x => x.start != null || x.end != null);
    if (!rel.length) {
      tagsPanel.innerHTML = '<div class="empty-state">Lines with a Start or End captured will appear here.</div>';
    } else {
      tagsPanel.innerHTML = rel.map(x => {
        const isExpanded = expandedTagCards.has(x.i);
        let statusPreview = '';
        if (activeCapture === 'both') {
          if (x.start != null && x.end != null) statusPreview = `${fmt(x.start, 'display')} → ${fmt(x.end, 'display')}`;
          else if (x.start != null) statusPreview = `Start: ${fmt(x.start, 'display')}`;
        } else {
          if (x.start != null) {
            const inferredEnd = blockEnd(x, x.i);
            const d = inferredEnd - x.start;
            statusPreview = `${fmt(x.start, 'display')} <span class="est-compact-dur">(~${formatDuration(d)})</span>`;
          }
        }

        const endField = activeCapture === 'both' ? `
          <div class="t-time-field ${x.end == null ? 'na' : ''}">
            <span class="fl">end</span>
            <input class="tv-input" type="text" inputmode="decimal" placeholder="mm:ss.mmm" data-idx="${x.i}" data-field="end" value="${x.end != null ? fmt(x.end, 'display') : ''}">
            ${x.end != null ? `<div class="nudge"><button data-nudge="end:-0.1">−</button><button data-nudge="end:0.1">+</button></div>` : ''}
          </div>` : '';
        let durationRow = '';
        if (activeCapture === 'both' && x.start != null && x.end != null) {
          const d = x.end - x.start;
          durationRow = `<div class="t-duration ${d < 0 ? 'negative' : ''}"><span class="fl">duration</span><span class="dv">${formatDuration(d)}</span></div>`;
        } else if (activeCapture === 'start' && x.start != null) {
          const inferredEnd = blockEnd(x, x.i);
          const d = inferredEnd - x.start;
          durationRow = `<div class="t-duration estimated ${d < 0 ? 'negative' : ''}"><span class="fl">duration <span class="est-tag" title="Estimated from next line start">est.</span></span><span class="dv">~${formatDuration(d)}</span></div>`;
        }
        const looping = activeLoop && activeLoop.idx === x.i;
        const dis = x.start == null ? 'disabled style="opacity:.35;cursor:not-allowed;"' : '';
        return `<div class="tag-item ${isExpanded ? 'expanded' : 'collapsed'}" data-idx="${x.i}">
          <div class="t-top">
            <button class="card-toggle-btn" data-toggle="${x.i}" title="${isExpanded ? 'Collapse card' : 'Expand details'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <span class="t-idx">${String(x.i + 1).padStart(3, '0')}</span>
            <span class="t-text">${escapeHtml(x.text)}</span>
            ${statusPreview ? `<span class="tag-compact-status">${statusPreview}</span>` : ''}
            <div class="tag-actions">
              <button class="playbtn-mini" data-play="${x.i}" title="Play from here" ${dis}>${PLAY_MINI_ICON}</button>
              <button class="loopbtn ${looping ? 'active' : ''}" data-loop="${x.i}" title="${looping ? 'Stop loop' : 'Loop this line'}" ${dis}>${looping ? STOP_ICON : LOOP_ICON}</button>
              <button class="delbtn" data-clear title="Clear timestamp(s)">✕</button>
            </div>
          </div>
          <div class="tag-card-details-wrapper">
            <div class="tag-card-details-inner">
              <div class="tag-card-details">
                <div class="t-times">
                  <div class="t-time-field ${x.start == null ? 'na' : ''}">
                    <span class="fl">start</span>
                    <input class="tv-input" type="text" inputmode="decimal" placeholder="mm:ss.mmm" data-idx="${x.i}" data-field="start" value="${x.start != null ? fmt(x.start, 'display') : ''}">
                    ${x.start != null ? `<div class="nudge"><button data-nudge="start:-0.1">−</button><button data-nudge="start:0.1">+</button></div>` : ''}
                  </div>${endField}
                </div>
                ${durationRow}
              </div>
            </div>
          </div>
        </div>`;
      }).join('');
    }
    const any = items.some(i => i.start != null);
    [expLRC, expSRT, expVTT, expTXT, expPreview].forEach(b => { if (b) b.disabled = !any; });
  }

  tagsPanel.addEventListener('click', e => {
    const toggleBtn = e.target.closest('.card-toggle-btn');
    if (toggleBtn) {
      const idx = parseInt(toggleBtn.dataset.toggle, 10);
      const card = toggleBtn.closest('.tag-item');
      if (card) {
        const isNowExpanded = !expandedTagCards.has(idx);
        if (isNowExpanded) expandedTagCards.add(idx);
        else expandedTagCards.delete(idx);
        card.classList.toggle('expanded', isNowExpanded);
        card.classList.toggle('collapsed', !isNowExpanded);
        toggleBtn.title = isNowExpanded ? 'Collapse card' : 'Expand details';
      }
      return;
    }
    const pb = e.target.closest('.playbtn-mini');
    if (pb && !pb.disabled) { playFromLine(parseInt(pb.dataset.play, 10)); return; }
    const lb = e.target.closest('.loopbtn');
    if (lb && !lb.disabled) { toggleLoop(parseInt(lb.dataset.loop, 10)); return; }
    const item = e.target.closest('.tag-item'); if (!item) return;
    const idx = parseInt(item.dataset.idx, 10);
    if (e.target.dataset.nudge) {
      expandedTagCards.add(idx);
      const [field, d] = e.target.dataset.nudge.split(':');
      items[idx][field] = Math.max(0, (items[idx][field] || 0) + parseFloat(d));
      renderLyrics({ keepScroll: true }); renderTags(); saveAutosave();
    } else if (e.target.hasAttribute('data-clear')) {
      if (activeLoop && activeLoop.idx === idx) stopLoop();
      items[idx].start = null; items[idx].end = null; items[idx]._revert = null;
      renderLyrics({ keepScroll: true }); renderTags(); saveAutosave();
    }
  });

  function applyTimeEdit(input) {
    const idx = parseInt(input.dataset.idx, 10), field = input.dataset.field, raw = input.value.trim();
    expandedTagCards.add(idx);
    if (raw === '') { items[idx][field] = null; renderLyrics({ keepScroll: true }); renderTags(); saveAutosave(); return; }
    const parsed = parseTimeInput(raw);
    if (parsed === null) { showToast('Could not read that time — try mm:ss.mmm, e.g. 01:23.450'); renderTags(); return; }
    items[idx][field] = Math.max(0, parsed);
    renderLyrics({ keepScroll: true }); renderTags(); saveAutosave();
  }
  tagsPanel.addEventListener('keydown', e => {
    if (e.target.classList.contains('tv-input') && e.code === 'Enter') { e.preventDefault(); applyTimeEdit(e.target); e.target.blur(); }
  });
  tagsPanel.addEventListener('focusout', e => { if (e.target.classList.contains('tv-input')) applyTimeEdit(e.target); });

  /* ---------------- loop / play preview ---------------- */
  function loopBounds(idx) {
    const it = items[idx];
    if (!it || it.start == null) return null;
    return { start: it.start, end: Math.max(it.start + 0.05, blockEnd(it, idx)) };
  }
  function toggleLoop(idx) {
    if (!hasAudioFile) { showToast('Load a song first.'); return; }
    if (activeLoop && activeLoop.idx === idx) { stopLoop(); return; }
    const b = loopBounds(idx); if (!b) return;
    activeLoop = { idx, start: b.start, end: b.end };
    player.currentTime = b.start; player.play(); renderTags();
  }
  function stopLoop() { if (!activeLoop) return; activeLoop = null; renderTags(); }
  function playFromLine(idx) {
    if (!hasAudioFile) { showToast('Load a song first.'); return; }
    const it = items[idx]; if (!it || it.start == null) return;
    stopLoop(); player.currentTime = it.start; player.play();
  }

  /* ---------------- undo / reset ---------------- */
  undoBtn.addEventListener('click', () => {
    if (!history.length) { showToast('Nothing to undo.'); return; }
    const last = history.pop();
    items[last.idx][last.field] = last.prevValue;
    cursorIndex = last.cursorBefore;
    renderLyrics(); renderTags(); saveAutosave();
  });
  resetBtn.addEventListener('click', () => {
    if (!items.length || !items.some(i => i.start != null || i.end != null)) { showToast('Nothing to reset.'); return; }
    if (!window.confirm('Clear every captured timestamp on this song and start tagging from the top? This cannot be undone.')) return;
    stopLoop();
    items.forEach(it => { it.start = null; it.end = null; it._revert = null; });
    history = []; cursorIndex = 0;
    renderLyrics(); renderTags(); saveAutosave();
    showToast('All timestamps cleared — starting fresh.');
  });

  /* ---------------- transport ---------------- */
  function togglePlay() {
    if (!hasAudioFile) { showToast('Load a song first.'); return; }
    if (player.paused) {
      if (hoveredTimelineTime != null) {
        player.currentTime = hoveredTimelineTime;
        updatePlayhead(); drawWaveform();
      }
      player.play();
    } else {
      player.pause();
    }
  }

  playBtn.addEventListener('click', togglePlay);

  /* ---------------- live playback & lyric tracking ---------------- */
  let currentPlayingIdx = -1;
  let autoFollowPlayback = true;

  const autoFollowBtn = $('autoFollowBtn');
  if (autoFollowBtn) {
    autoFollowBtn.addEventListener('click', () => {
      autoFollowPlayback = !autoFollowPlayback;
      autoFollowBtn.classList.toggle('active', autoFollowPlayback);
      const lbl = autoFollowBtn.querySelector('.follow-label');
      if (lbl) lbl.textContent = autoFollowPlayback ? 'Follow: ON' : 'Follow: OFF';
      showToast(`Auto-follow lyrics ${autoFollowPlayback ? 'enabled' : 'disabled'}.`);
    });
  }

  function clearPlayingHighlight() {
    if (currentPlayingIdx !== -1) {
      const prevBlock = blocksInner.querySelector(`.lyric-block[data-idx="${currentPlayingIdx}"]`);
      if (prevBlock) prevBlock.classList.remove('active-playing');
      const prevRow = lyricsList.querySelector(`.lyric-row[data-idx="${currentPlayingIdx}"]`);
      if (prevRow) {
        prevRow.classList.remove('playing-now');
        const ind = prevRow.querySelector('.playing-indicator');
        if (ind) ind.remove();
      }
    }
  }

  function updateActivePlayingState() {
    if (!items.length || !hasAudioFile) {
      if (currentPlayingIdx !== -1) {
        clearPlayingHighlight();
        currentPlayingIdx = -1;
      }
      return;
    }

    const t = player.currentTime || 0;
    let matchIdx = -1;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.start != null) {
        const end = blockEnd(it, i);
        if (t >= it.start && t < end) {
          matchIdx = i;
          break;
        }
      }
    }

    if (matchIdx !== currentPlayingIdx) {
      clearPlayingHighlight();

      if (matchIdx !== -1) {
        const currBlock = blocksInner.querySelector(`.lyric-block[data-idx="${matchIdx}"]`);
        if (currBlock) currBlock.classList.add('active-playing');
        const currRow = lyricsList.querySelector(`.lyric-row[data-idx="${matchIdx}"]`);
        if (currRow) {
          currRow.classList.add('playing-now');
          if (!currRow.querySelector('.playing-indicator') && !player.paused) {
            const ind = document.createElement('span');
            ind.className = 'playing-indicator';
            ind.setAttribute('title', 'Playing now');
            ind.innerHTML = '<span class="eq-b1"></span><span class="eq-b2"></span><span class="eq-b3"></span>';
            const idxEl = currRow.querySelector('.idx');
            if (idxEl) idxEl.after(ind);
            else currRow.prepend(ind);
          }
          if (autoFollowPlayback && !player.paused) {
            const hasPendingLines = items.some(it => !isComplete(it));
            if (!hasPendingLines || matchIdx >= cursorIndex) {
              centreRow(currRow);
            }
          }
        }
      }
      currentPlayingIdx = matchIdx;
    } else if (matchIdx !== -1) {
      const currRow = lyricsList.querySelector(`.lyric-row[data-idx="${matchIdx}"]`);
      if (currRow) {
        const existingInd = currRow.querySelector('.playing-indicator');
        if (player.paused && existingInd) {
          existingInd.remove();
        } else if (!player.paused && !existingInd) {
          const ind = document.createElement('span');
          ind.className = 'playing-indicator';
          ind.setAttribute('title', 'Playing now');
          ind.innerHTML = '<span class="eq-b1"></span><span class="eq-b2"></span><span class="eq-b3"></span>';
          const idxEl = currRow.querySelector('.idx');
          if (idxEl) idxEl.after(ind);
          else currRow.prepend(ind);
        }
      }
    }
  }

  function playheadLoop() {
    if (!player.paused && !player.ended) {
      updatePlayhead();
      drawWaveform();
      updateActivePlayingState();
      tcCurrent.textContent = fmt(player.currentTime, 'display');
      if (activeLoop && player.currentTime >= activeLoop.end - 0.02) player.currentTime = activeLoop.start;
      if (zoom > 1) {
        const vd = visibleDur();
        if (player.currentTime > viewStart + vd * 0.9 || player.currentTime < viewStart) {
          viewStart = player.currentTime - vd * 0.4;
          clampView(); renderBlocks(); updateMinimapWindow();
        }
      }
      playheadRaf = requestAnimationFrame(playheadLoop);
    }
  }

  player.addEventListener('play', () => {
    playBtn.innerHTML = PAUSE_SVG;
    if (window.TimingConsoleSpectrum) window.TimingConsoleSpectrum.start();
    cancelAnimationFrame(playheadRaf);
    updateActivePlayingState();
    playheadLoop();
  });
  player.addEventListener('pause', () => {
    playBtn.innerHTML = PLAY_SVG;
    if (window.TimingConsoleSpectrum) window.TimingConsoleSpectrum.stop();
    cancelAnimationFrame(playheadRaf);
    updatePlayhead();
    drawWaveform();
    updateActivePlayingState();
  });
  player.addEventListener('ended', () => {
    cancelAnimationFrame(playheadRaf);
    stopLoop();
    clearPlayingHighlight();
    currentPlayingIdx = -1;
  });
  backBtn.addEventListener('click', () => { player.currentTime = Math.max(0, player.currentTime - 2); updatePlayhead(); drawWaveform(); updateActivePlayingState(); });
  fwdBtn.addEventListener('click', () => { player.currentTime = Math.min(duration(), player.currentTime + 2); updatePlayhead(); drawWaveform(); updateActivePlayingState(); });

  player.addEventListener('timeupdate', () => {
    if (activeLoop && player.currentTime >= activeLoop.end - 0.02) player.currentTime = activeLoop.start;
    tcCurrent.textContent = fmt(player.currentTime, 'display');
    if (zoom > 1 && !player.paused) {
      const vd = visibleDur();
      if (player.currentTime > viewStart + vd * 0.9 || player.currentTime < viewStart) {
        viewStart = player.currentTime - vd * 0.4;
        clampView(); renderBlocks(); updateMinimapWindow();
      }
    }
    updatePlayhead(); drawWaveform();
    updateActivePlayingState();
  });

  /* ---------------- audio click haptics (Apple-design §13) ---------------- */
  let audioClickEnabled = true;
  try {
    const stored = localStorage.getItem('timing-console-clicks');
    if (stored !== null) audioClickEnabled = (stored === 'true');
  } catch (e) { }

  const audioHapticBtn = $('audioHapticBtn'), audioHapticLabel = $('audioHapticLabel');
  function updateAudioHapticUI() {
    if (audioHapticLabel) audioHapticLabel.textContent = audioClickEnabled ? 'Clicks: On' : 'Clicks: Off';
    if (audioHapticBtn) audioHapticBtn.style.opacity = audioClickEnabled ? '1' : '0.6';
  }
  updateAudioHapticUI();

  if (audioHapticBtn) {
    audioHapticBtn.addEventListener('click', () => {
      audioClickEnabled = !audioClickEnabled;
      updateAudioHapticUI();
      try { localStorage.setItem('timing-console-clicks', String(audioClickEnabled)); } catch (e) { }
      showToast(`Audio click feedback ${audioClickEnabled ? 'enabled' : 'muted'}.`);
    });
  }

  let hapticAudioCtx = null;
  function playHapticTick(freq = 950) {
    if (!audioClickEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!hapticAudioCtx) hapticAudioCtx = new AudioContextClass();
      if (hapticAudioCtx.state === 'suspended') hapticAudioCtx.resume();

      const osc = hapticAudioCtx.createOscillator();
      const gain = hapticAudioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, hapticAudioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, hapticAudioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, hapticAudioCtx.currentTime + 0.035);

      osc.connect(gain);
      gain.connect(hapticAudioCtx.destination);
      osc.start();
      osc.stop(hapticAudioCtx.currentTime + 0.04);
    } catch (e) { }
  }

  /* ---------------- keyboard shortcuts modal ---------------- */
  const shortcutsBtn = $('shortcutsBtn'), shortcutsModal = $('shortcutsModal');
  const shortcutsCloseBtn = $('shortcutsCloseBtn'), shortcutsDoneBtn = $('shortcutsDoneBtn');

  function openShortcutsModal() {
    if (!shortcutsModal) return;
    shortcutsModal.style.display = 'flex';
    shortcutsModal.setAttribute('aria-hidden', 'false');
  }

  function closeShortcutsModal() {
    if (!shortcutsModal) return;
    shortcutsModal.style.display = 'none';
    shortcutsModal.setAttribute('aria-hidden', 'true');
  }

  if (shortcutsBtn) shortcutsBtn.addEventListener('click', openShortcutsModal);
  if (shortcutsCloseBtn) shortcutsCloseBtn.addEventListener('click', closeShortcutsModal);
  if (shortcutsDoneBtn) shortcutsDoneBtn.addEventListener('click', closeShortcutsModal);
  if (shortcutsModal) {
    shortcutsModal.addEventListener('click', e => {
      if (e.target === shortcutsModal) closeShortcutsModal();
    });
  }

  /* ---------------- keyboard ---------------- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (shortcutsModal && shortcutsModal.style.display !== 'none') {
        closeShortcutsModal();
        return;
      }
      if (previewModal && previewModal.style.display !== 'none') {
        closePreviewModal();
        return;
      }
      if (historyModal && historyModal.style.display !== 'none') {
        closeHistoryModal();
        return;
      }
    }

    const typing = e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT';
    if (typing) return;

    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      if (shortcutsModal && shortcutsModal.style.display !== 'none') closeShortcutsModal();
      else openShortcutsModal();
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
      return;
    }
    if (e.code === 'ArrowLeft') { e.preventDefault(); player.currentTime = Math.max(0, player.currentTime - (e.shiftKey ? 5 : 2)); return; }
    if (e.code === 'ArrowRight') { e.preventDefault(); player.currentTime = Math.min(duration(), player.currentTime + (e.shiftKey ? 5 : 2)); return; }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(zoom * 2); return; }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(zoom / 2); return; }

    if (!items.length) return;
    const cur = Math.min(cursorIndex, items.length - 1);
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); setStart(cur); }
    if ((e.key === 'e' || e.key === 'E') && activeCapture === 'both') { e.preventDefault(); setEnd(cur); }
  });

  /* ---------------- export ---------------- */
  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function startedItems() { return items.filter(i => i.start != null).sort((a, b) => a.start - b.start); }
  function exportFilename(ext) {
    const base = (songBaseName || 'lyrics').replace(/[\\/:*?"<>|]+/g, '').trim() || 'lyrics';
    return `${base} - ${activeCapture === 'both' ? 'Start-End' : 'Start'}.${ext}`;
  }
  function warnIfPartial(field) {
    const notStarted = items.filter(i => i.start == null).length;
    if (notStarted) { showToast(`Exported ${items.length - notStarted} of ${items.length} — ${notStarted} have no Start yet.`); return; }
    if (activeCapture === 'both' && field === 'end') {
      const missing = items.filter(i => i.start != null && i.end == null).length;
      if (missing) { showToast(`Exported — ${missing} line(s) had no End, estimated from the next line.`); return; }
    }
    showToast('Exported.');
  }
  function generateLRC() {
    const l = startedItems(); if (!l.length) return '';
    return l.map(it => `[${fmt(it.start, 'lrc')}]${it.text}`).join('\n');
  }

  function generateSRT() {
    const l = startedItems(); if (!l.length) return '';
    return l.map((it, i) => {
      const end = it.end != null ? it.end : (i < l.length - 1 ? l[i + 1].start : it.start + 2);
      return `${i + 1}\n${fmt(it.start, 'srt')} --> ${fmt(end, 'srt')}\n${it.text}\n`;
    }).join('\n');
  }

  function generateVTT() {
    const l = startedItems(); if (!l.length) return '';
    return 'WEBVTT\n\n' + l.map((it, i) => {
      const end = it.end != null ? it.end : (i < l.length - 1 ? l[i + 1].start : it.start + 2);
      return `${fmt(it.start, 'vtt')} --> ${fmt(end, 'vtt')}\n${it.text}\n`;
    }).join('\n');
  }

  function generateTXT() {
    const l = startedItems(); if (!l.length) return '';
    return l.map(it => {
      const isEstimated = activeCapture === 'start' || it.end == null;
      const end = isEstimated ? blockEnd(it, items.indexOf(it)) : it.end;
      const d = end - it.start;
      const durLabel = isEstimated
        ? `(duration ~${formatDuration(d)}, estimated)`
        : `(duration ${formatDuration(d)})`;
      return `[${fmt(it.start, 'txt')} --> ${fmt(end, 'txt')}] ${durLabel}\n${it.text}`;
    }).join('\n\n');
  }

  function generateExport(format) {
    switch ((format || '').toLowerCase()) {
      case 'lrc': return generateLRC();
      case 'srt': return generateSRT();
      case 'vtt': return generateVTT();
      case 'txt': return generateTXT();
      default: return '';
    }
  }

  expLRC.addEventListener('click', () => {
    const l = startedItems(); if (!l.length) return;
    downloadFile(exportFilename('lrc'), generateLRC());
    warnIfPartial('start');
  });
  expSRT.addEventListener('click', () => {
    const l = startedItems(); if (!l.length) return;
    downloadFile(exportFilename('srt'), generateSRT());
    warnIfPartial('end');
  });
  expVTT.addEventListener('click', () => {
    const l = startedItems(); if (!l.length) return;
    downloadFile(exportFilename('vtt'), generateVTT());
    warnIfPartial('end');
  });
  expTXT.addEventListener('click', () => {
    const l = startedItems(); if (!l.length) return;
    downloadFile(exportFilename('txt'), generateTXT());
    warnIfPartial('end');
  });

  /* ---------------- preview & copy modal ---------------- */
  let activePreviewFormat = 'lrc';
  const COPY_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const CHECK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  function updatePreviewContent(fmtKey) {
    activePreviewFormat = (fmtKey || 'lrc').toLowerCase();
    if (previewFormatTabs) {
      const tabs = previewFormatTabs.querySelectorAll('.preview-tab');
      tabs.forEach(t => {
        const isActive = (t.dataset.format === activePreviewFormat);
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    if (previewTextarea) {
      previewTextarea.value = generateExport(activePreviewFormat);
    }

    if (previewMetaInfo) {
      const l = startedItems();
      const fmtNames = { lrc: 'LRC format', srt: 'SubRip SRT', vtt: 'WebVTT format', txt: 'Timestamped TXT' };
      previewMetaInfo.textContent = `${l.length} line${l.length === 1 ? '' : 's'} · ${fmtNames[activePreviewFormat] || activePreviewFormat.toUpperCase()}`;
    }
  }

  function openPreviewModal() {
    const l = startedItems();
    if (!l.length) {
      showToast('No tagged lines to preview yet.');
      return;
    }
    updatePreviewContent(activePreviewFormat);
    if (previewModal) {
      previewModal.style.display = 'flex';
      previewModal.setAttribute('aria-hidden', 'false');
      if (window.gsap) {
        gsap.fromTo(previewModal.querySelector('.modal-card'),
          { opacity: 0, scale: 0.94, y: 12 },
          { opacity: 1, scale: 1, y: 0, duration: 0.26, ease: 'back.out(1.5)' }
        );
      }
    }
    if (previewTextarea) {
      previewTextarea.focus();
    }
  }

  function closePreviewModal() {
    if (!previewModal || previewModal.style.display === 'none') return;
    if (window.gsap) {
      gsap.to(previewModal.querySelector('.modal-card'), {
        opacity: 0, scale: 0.95, y: 8, duration: 0.18, ease: 'power2.in',
        onComplete: () => {
          previewModal.style.display = 'none';
          previewModal.setAttribute('aria-hidden', 'true');
        }
      });
    } else {
      previewModal.style.display = 'none';
      previewModal.setAttribute('aria-hidden', 'true');
    }
  }

  function copyPreviewToClipboard() {
    const text = previewTextarea ? previewTextarea.value : '';
    if (!text) {
      showToast('Nothing to copy.');
      return;
    }

    function onCopied() {
      if (previewCopyBtn) {
        previewCopyBtn.innerHTML = `${CHECK_SVG}<span>Copied!</span>`;
        previewCopyBtn.classList.add('copied');
        setTimeout(() => {
          previewCopyBtn.innerHTML = `${COPY_SVG}<span>Copy to clipboard</span>`;
          previewCopyBtn.classList.remove('copied');
        }, 1800);
      }
      showToast(`Copied .${activePreviewFormat.toUpperCase()} to clipboard.`);
    }

    function fallbackCopy() {
      if (previewTextarea) {
        previewTextarea.focus();
        previewTextarea.select();
        try {
          const ok = document.execCommand('copy');
          if (ok) onCopied();
          else showToast('Could not copy automatically. Text selected — press Ctrl+C.');
        } catch (e) {
          showToast('Could not copy automatically. Text selected — press Ctrl+C.');
        }
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onCopied).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  if (expPreview) expPreview.addEventListener('click', openPreviewModal);
  if (previewCloseBtn) previewCloseBtn.addEventListener('click', closePreviewModal);
  if (previewDoneBtn) previewDoneBtn.addEventListener('click', closePreviewModal);
  if (previewCopyBtn) previewCopyBtn.addEventListener('click', copyPreviewToClipboard);
  if (previewModal) {
    previewModal.addEventListener('click', e => {
      if (e.target === previewModal) closePreviewModal();
    });
  }
  if (previewFormatTabs) {
    previewFormatTabs.addEventListener('click', e => {
      const tab = e.target.closest('.preview-tab');
      if (!tab) return;
      const fmtKey = tab.dataset.format;
      if (fmtKey) updatePreviewContent(fmtKey);
    });
  }

  /* ---------------------------------------------------------------
     Sessions, Rolling History & Audio Re-attachment
  --------------------------------------------------------------- */
  const AUTOSAVE_KEY = 'timing-console-autosave';
  const HISTORY_KEY = 'timing-console-history';
  const AUTOSAVE_EXPIRY_MS = 20 * 60 * 1000; // 20 minutes default quick-restore expiry
  const MAX_HISTORY_SNAPSHOTS = 20;

  function sessionObject() {
    const rawLyrics = lyricsInput ? lyricsInput.value : '';
    const songFileName = (audioFileName && !audioFileName.classList.contains('empty'))
      ? audioFileName.textContent.trim()
      : (songBaseName ? songBaseName + '.mp3' : '');

    return {
      kind: 'timing-console-session',
      version: 4,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      songBaseName,
      songFileName,
      fileHandleId: currentAudioHandleId,
      mode,
      activeCapture,
      activeInteraction,
      cursorIndex,
      rawLyrics: rawLyrics || items.map(it => it.text).join(mode === 'word' ? ' ' : '\n'),
      items: items.map(({ text, start, end }) => ({ text, start, end })),
      savedAt: new Date().toISOString()
    };
  }

  function getHistorySnapshots() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistorySnapshot(snapshot) {
    try {
      let list = getHistorySnapshots();
      // If the latest snapshot in history is for the same song and saved less than 45 seconds ago, update it in place
      if (list.length > 0) {
        const last = list[0];
        const sameSong = last.songBaseName === snapshot.songBaseName;
        const timeDiff = Math.abs(new Date(snapshot.savedAt).getTime() - new Date(last.savedAt).getTime());
        if (sameSong && timeDiff < 45000) {
          list[0] = snapshot;
          localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
          return;
        }
      }
      list.unshift(snapshot);
      if (list.length > MAX_HISTORY_SNAPSHOTS) {
        list = list.slice(0, MAX_HISTORY_SNAPSHOTS);
      }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not save history snapshot:', e);
    }
  }

  function deleteHistorySnapshot(id) {
    try {
      let list = getHistorySnapshots().filter(s => s.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      renderHistoryModal();
    } catch (e) { }
  }

  function clearAllHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY);
      renderHistoryModal();
      showToast('Session history cleared.');
    } catch (e) { }
  }

  function saveAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      if (!items.length) return;
      try {
        const s = sessionObject();
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(s));
        saveHistorySnapshot(s);
      } catch (e) { }
    }, 400);
  }

  async function tryRestoreAudio(obj) {
    const handleId = obj.fileHandleId || (obj.songFileName ? 'audio-' + obj.songFileName : (obj.songBaseName ? 'audio-' + obj.songBaseName : null));
    if (!handleId || !window.showOpenFilePicker) return false;
    try {
      const handle = await AudioHandleStore.getHandle(handleId);
      if (!handle) return false;
      let perm = await handle.queryPermission({ mode: 'read' });
      if (perm !== 'granted') {
        perm = await handle.requestPermission({ mode: 'read' });
      }
      if (perm === 'granted') {
        const file = await handle.getFile();
        loadAudioFile(file, handle);
        return true;
      }
    } catch (err) {
      console.warn('Silent audio restore failed:', err);
    }
    return false;
  }

  async function loadSessionFromObject(obj) {
    if (!obj || obj.kind !== 'timing-console-session' || !Array.isArray(obj.items)) {
      showToast('That file doesn\u2019t look like a Timing Console session.');
      return;
    }
    stopLoop();
    mode = obj.mode === 'word' ? 'word' : 'line';
    activeCapture = obj.activeCapture === 'both' ? 'both' : 'start';
    activeInteraction = obj.activeInteraction === 'click' ? 'click' : 'buttons';
    captureChoice = activeCapture;
    interactionChoice = activeInteraction;
    songBaseName = obj.songBaseName || songBaseName;

    // Restore full raw lyrics text
    const rawLyrics = obj.rawLyrics || obj.items.map(it => it.text).join(mode === 'word' ? ' ' : '\n');
    lyricsInput.value = rawLyrics;
    hasLyricsText = !!rawLyrics.trim();

    items = obj.items.map(it => ({
      text: String(it.text || ''),
      start: typeof it.start === 'number' ? it.start : null,
      end: typeof it.end === 'number' ? it.end : null,
      _revert: null
    }));
    history = [];
    let furthest = -1;
    items.forEach((it, i) => { if (it.start != null || it.end != null) furthest = i; });
    cursorIndex = typeof obj.cursorIndex === 'number' ? obj.cursorIndex : Math.min(items.length, furthest + 1);

    [...modeSeg.children].forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    [...captureSeg.children].forEach(b => b.classList.toggle('active', b.dataset.capture === activeCapture));
    [...interactionSeg.children].forEach(b => b.classList.toggle('active', b.dataset.interaction === activeInteraction));
    captureHint.textContent = activeCapture === 'start'
      ? 'Start only — one tap per line, highlight moves on immediately.'
      : 'Start & End — two taps per line: tap to start line, tap again to end it.';

    checkBuildReady();
    updateStatus();
    renderLyrics();
    renderTags();
    renderBlocks();
    openPane('console');

    // Attempt to silently re-attach audio
    let audioRestored = false;
    if (hasAudioFile && (audioFileName.textContent === obj.songFileName || !obj.songFileName)) {
      audioRestored = true;
    } else {
      audioRestored = await tryRestoreAudio(obj);
    }

    if (audioRestored) {
      showToast(hasAudioFile ? 'Session restored.' : `Session restored (${items.length} lines) with audio file.`, { duration: 3200 });
    } else {
      // Graceful non-blocking fallback toast with close button
      showToast('Couldn\u2019t find your song file \u2014 please re-select it to resume playback.', {
        sticky: true,
        closeBtn: true
      });
    }
  }

  function formatTimeAgo(isoString) {
    if (!isoString) return 'recently';
    const ms = Date.now() - new Date(isoString).getTime();
    if (isNaN(ms)) return 'recently';
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function openHistoryModal() {
    renderHistoryModal();
    historyModal.style.display = 'flex';
    historyModal.setAttribute('aria-hidden', 'false');
  }

  function closeHistoryModal() {
    historyModal.style.display = 'none';
    historyModal.setAttribute('aria-hidden', 'true');
  }

  function renderHistoryModal() {
    const list = getHistorySnapshots();
    if (!list.length) {
      historyList.innerHTML = `
        <div class="history-empty">
          <span class="history-empty-icon">📁</span>
          <span>No saved session snapshots yet.</span>
          <span style="font-size: 11px; opacity: 0.7;">Sessions autosave automatically as you tag lyrics.</span>
        </div>
      `;
      return;
    }

    historyList.innerHTML = list.map((item, idx) => {
      const songTitle = escapeHtml(item.songBaseName || item.songFileName || 'Untitled Song');
      const numLines = Array.isArray(item.items) ? item.items.length : 0;
      const started = Array.isArray(item.items) ? item.items.filter(i => i.start != null).length : 0;
      const isComplete = numLines > 0 && (item.activeCapture === 'both'
        ? item.items.every(i => i.start != null && i.end != null)
        : item.items.every(i => i.start != null));
      const percent = numLines > 0 ? Math.round((started / numLines) * 100) : 0;
      const timeAgo = formatTimeAgo(item.savedAt);
      const snapId = escapeHtml(item.id || String(idx));

      return `
        <div class="history-item" data-id="${snapId}">
          <div class="history-item-main" data-action="restore" data-id="${snapId}">
            <div class="history-song-name">${songTitle}</div>
            <div class="history-meta-row">
              <span class="history-badge ${isComplete ? 'complete' : ''}">${numLines} ${item.mode === 'word' ? 'words' : 'lines'}</span>
              <span>${started} / ${numLines} tagged (${percent}%)</span>
              <div class="history-progress-wrap">
                <div class="history-progress-fill" style="width: ${percent}%;"></div>
              </div>
              <span style="margin-left: auto;">${timeAgo}</span>
            </div>
          </div>
          <div class="history-item-actions">
            <button class="history-restore-btn" data-action="restore" data-id="${snapId}">Restore</button>
            <button class="history-delete-btn" data-action="delete" data-id="${snapId}" title="Delete this snapshot" aria-label="Delete snapshot">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  if (historyBtn) historyBtn.addEventListener('click', openHistoryModal);
  if (topHistoryBtn) topHistoryBtn.addEventListener('click', openHistoryModal);
  historyCloseBtn.addEventListener('click', closeHistoryModal);
  historyDoneBtn.addEventListener('click', closeHistoryModal);
  clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Clear all session history snapshots? This cannot be undone.')) {
      clearAllHistory();
    }
  });

  historyList.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const list = getHistorySnapshots();
    const snapshot = list.find(s => (s.id || '') === id) || list[parseInt(id, 10)];

    if (action === 'delete') {
      e.stopPropagation();
      deleteHistorySnapshot(id);
    } else if (action === 'restore' && snapshot) {
      closeHistoryModal();
      loadSessionFromObject(snapshot);
    }
  });

  historyModal.addEventListener('click', e => {
    if (e.target === historyModal) closeHistoryModal();
  });

  saveSessionBtn.addEventListener('click', () => {
    if (!items.length) { showToast('Nothing to save yet.'); return; }
    downloadFile(exportFilename('json').replace(/\.json$/, '') + ' - session.json', JSON.stringify(sessionObject(), null, 2));
    showToast('Session saved. The song file itself isn\u2019t included — keep it handy to resume.');
  });
  loadSessionBtn.addEventListener('click', () => sessionFileInput.click());
  sessionFileInput.addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try { loadSessionFromObject(JSON.parse(ev.target.result)); }
      catch (err) { showToast('Could not read that session file.'); }
    };
    reader.readAsText(f);
    sessionFileInput.value = '';
  });

  (function checkAutosave() {
    let raw = null;
    try { raw = localStorage.getItem(AUTOSAVE_KEY); } catch (e) { return; }
    if (!raw) return;
    let obj = null;
    try { obj = JSON.parse(raw); } catch (e) { return; }
    if (!obj || !Array.isArray(obj.items) || !obj.items.length) return;

    // Time-limited restore prompt: within roughly the last 15-30 minutes (20 minutes default)
    const savedTime = obj.savedAt ? new Date(obj.savedAt).getTime() : 0;
    const ageMs = Date.now() - savedTime;

    if (savedTime > 0 && ageMs < AUTOSAVE_EXPIRY_MS) {
      const timeStr = formatTimeAgo(obj.savedAt);
      showToast(`Found unsaved progress from a previous session (${obj.items.length} lines · saved ${timeStr}).`, {
        actions: [
          { label: 'Restore', onAction: () => loadSessionFromObject(obj) },
          { label: 'History', secondary: true, onAction: openHistoryModal }
        ],
        closeBtn: true,
        sticky: true
      });
    }
    // If older than AUTOSAVE_EXPIRY_MS, treat as expired for quick-restore and start fresh session normally.
    // The snapshot is preserved in History.
  })();

  /* ---------------- spectrum + init ---------------- */
  if (window.TimingConsoleSpectrum && window.TimingConsoleSpectrum.available) {
    window.TimingConsoleSpectrum.init(spectrumWrap);
    spectrumIdleNote.style.display = 'none';
  } else {
    spectrumIdleNote.textContent = 'Spectrum needs internet on first run + Web Audio support.';
  }

  window.addEventListener('resize', () => {
    drawWaveform(); drawMinimap(); renderBlocks(); updatePlayhead(); updateLyricPadding();
  });

  /* ---------------- ambient 3D cyber-lattice backdrop ---------------- */
  (function initAmbientBackdrop() {
    const canvas = $('ambientCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = 0, height = 0;
    let mouseX = 0.5, mouseY = 0.5;
    let targetMouseX = 0.5, targetMouseY = 0.5;

    const PARTICLE_COUNT = 42;
    const particles = [];

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * (width || 800),
        y: Math.random() * (height || 600),
        z: Math.random() * 0.75 + 0.25,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        radius: Math.random() * 1.8 + 1,
        seed: Math.random() * Math.PI * 2
      });
    }

    window.addEventListener('mousemove', e => {
      targetMouseX = e.clientX / window.innerWidth;
      targetMouseY = e.clientY / window.innerHeight;
    });

    let lastTime = 0;
    function render(time) {
      requestAnimationFrame(render);
      if (time - lastTime < 16) return;
      lastTime = time;

      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const baseAlpha = isLight ? 0.22 : 0.42;
      const colGold = isLight ? 'rgba(184, 130, 32, ' : 'rgba(226, 179, 74, ';
      const colSand = isLight ? 'rgba(138, 115, 78, ' : 'rgba(245, 223, 154, ';
      const colSage = isLight ? 'rgba(45, 138, 100, ' : 'rgba(82, 199, 152, ';

      // Connective subtle warm ambient lattice
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        p1.x += p1.vx;
        p1.y += p1.vy;
        if (p1.x < -20) p1.x = width + 20;
        if (p1.x > width + 20) p1.x = -20;
        if (p1.y < -20) p1.y = height + 20;
        if (p1.y > height + 20) p1.y = -20;

        const px1 = p1.x + (mouseX - 0.5) * 35 * p1.z;
        const py1 = p1.y + (mouseY - 0.5) * 35 * p1.z;

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.12 * baseAlpha;
            ctx.strokeStyle = colGold + alpha + ')';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(px1, py1);
            ctx.lineTo(p2.x + (mouseX - 0.5) * 35 * p2.z, p2.y + (mouseY - 0.5) * 35 * p2.z);
            ctx.stroke();
          }
        }

        const pCol = (i % 3 === 0) ? colGold : ((i % 3 === 1) ? colSand : colSage);
        const rad = p1.radius * (0.8 + Math.sin(time * 0.002 + p1.seed) * 0.2);
        ctx.fillStyle = pCol + (baseAlpha * p1.z * 0.7) + ')';
        ctx.beginPath();
        ctx.arc(px1, py1, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    render(0);
  })();

  updateStatus();
  updateZoomUI();
  updateLyricPadding();
})();
