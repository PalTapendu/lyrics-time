/**
 * SYNCLINES — Audio Visualizer Studio Render Settings Controller
 * studio/settings.js
 *
 * Implements:
 * 1. Aspect ratio selection with live frame-shape preview and live engine canvas.
 * 2. Device-adaptive resolution defaulting (720p/1080p) and capability checking.
 * 3. Interactive waveform trim handles with numeric mm:ss.s inputs and quick presets.
 * 4. Real-time file size & render time estimation engine.
 * 5. Full StudioCustomization integration:
 *    - Palette presets & custom color pickers with live contrast warning.
 *    - Background modes (solid, gradient, custom image, blurred cover art).
 *    - Typography (title, artist, font selector) with font preloading.
 *    - Sensitivity slider (0.5x - 2.0x), progress bar, and safe-area guides.
 *    - Style-specific tuning (bar count, gap, glow, reflection).
 *    - User presets management (save, load, delete) and reset to defaults.
 * 6. Interactive live canvas preview with play/pause and time scrubbing.
 * 7. "Try Another Style" retaining audio, trim, and render settings.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioSettings = factory(
      root.StudioConfig || (typeof window !== 'undefined' ? window.StudioConfig : null),
      root.StudioStore || (typeof window !== 'undefined' ? window.StudioStore : null),
      root.StudioStorage || (typeof window !== 'undefined' ? window.StudioStorage : null),
      root.StudioUI || (typeof window !== 'undefined' ? window.StudioUI : null),
      root.StudioRouter || (typeof window !== 'undefined' ? window.StudioRouter : null),
      root.StudioRenderer || (typeof window !== 'undefined' ? window.StudioRenderer : null),
      root.StudioCustomization || (typeof window !== 'undefined' ? window.StudioCustomization : null),
      root.StudioLyricsParser || (typeof window !== 'undefined' ? window.StudioLyricsParser : null)
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (
  Config,
  Store,
  Storage,
  UI,
  Router,
  Renderer,
  Customization,
  LyricsParser
) {
  'use strict';

  Config = Config || (typeof window !== 'undefined' ? window.StudioConfig : null);
  Store = Store || (typeof window !== 'undefined' ? window.StudioStore : null);
  Storage = Storage || (typeof window !== 'undefined' ? window.StudioStorage : null);
  UI = UI || (typeof window !== 'undefined' ? window.StudioUI : null);
  Router = {
    navigate: function (route, replace) {
      var r = (window.Studio && window.Studio.getRouter && window.Studio.getRouter()) || null;
      if (r && typeof r.navigate === 'function') return r.navigate(route, replace);
      if (typeof window !== 'undefined') window.location.hash = route; // router listens to hashchange
    }
  };
  Renderer = Renderer || (typeof window !== 'undefined' ? window.StudioRenderer : null);
  Customization = Customization || (typeof window !== 'undefined' ? window.StudioCustomization : null);
  LyricsParser = LyricsParser || (typeof window !== 'undefined' ? window.StudioLyricsParser : null);

  var MIN_TRIM_SEC = 3.0;

  // Active settings state
  var currentRatio = '16:9';
  var currentResolution = '1080p';
  var trimStart = 0.0;
  var trimEnd = 30.0;
  var trackDuration = 30.0;
  var activeStyle = null;
  var activeAudio = null;

  // Live preview audio & canvas
  var previewAudio = null;
  var previewCanvas = null;
  var isPreviewPlaying = false;
  var previewPlayBtn = null;
  var previewPlayIcon = null;
  var previewPlayLabel = null;
  var previewTimeDisplay = null;

  // DOM element references
  var containerEl = null;
  var summaryStripEl = null;
  var audioTitleEl = null;
  var audioMetaEl = null;
  var styleTitleEl = null;
  var styleCatEl = null;
  var styleThumbEl = null;

  var ratioCards = [];
  var resCards = [];

  var frameShapeBox = null;
  var frameShapeImg = null;
  var frameShapeWatermark = null;

  var waveformCanvas = null;
  var trimSlider = null;
  var trimActiveRegion = null;
  var trimMaskStart = null;
  var trimMaskEnd = null;
  var handleStart = null;
  var handleEnd = null;
  var startInput = null;
  var endInput = null;
  var durationBadge = null;
  var trimErrorEl = null;

  var estimateDurationEl = null;
  var estimateFilesizeEl = null;
  var estimateRendertimeEl = null;
  var capabilityStatusEl = null;
  var startRenderBtn = null;

  // Dragging state
  var isDraggingStart = false;
  var isDraggingEnd = false;

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '00:00';
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    return (mins < 10 ? '0' + mins : mins) + ':' + (secs < 10 ? '0' + secs : secs);
  }

  function formatTimeWithTenths(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '00:00.0';
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    var tenths = Math.floor((seconds % 1) * 10);
    return (mins < 10 ? '0' + mins : mins) + ':' + (secs < 10 ? '0' + secs : secs) + '.' + tenths;
  }

  function parseTime(timeStr) {
    if (typeof timeStr !== 'string') return NaN;
    var parts = timeStr.trim().split(':');
    if (parts.length === 2) {
      var m = parseFloat(parts[0]);
      var s = parseFloat(parts[1]);
      if (!isNaN(m) && !isNaN(s)) {
        return m * 60 + s;
      }
    } else if (parts.length === 1) {
      var val = parseFloat(parts[0]);
      if (!isNaN(val)) return val;
    }
    return NaN;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * Adaptive device defaults:
   * 1080p on desktop with adequate memory; 720p on phones or low memory devices.
   */
  function getDeviceDefaults() {
    var isLowMemory = typeof navigator !== 'undefined' &&
      navigator.deviceMemory &&
      navigator.deviceMemory < 4;

    var isSmallScreen = typeof window !== 'undefined' &&
      window.innerWidth < 768;

    var defaultRes = (isLowMemory || isSmallScreen) ? '720p' : '1080p';
    var defaultRatio = (activeStyle && activeStyle.defaultRatio) ? activeStyle.defaultRatio : '16:9';

    return {
      resolution: defaultRes,
      aspectRatio: defaultRatio
    };
  }

  function checkBrowserCapability() {
    var hasWebCodecs = typeof window !== 'undefined' && typeof window.VideoEncoder !== 'undefined';
    var hasMediaRecorder = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';
    var hasCanvasCapture = typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream !== 'undefined';

    var status = {
      supported: hasWebCodecs || (hasMediaRecorder && hasCanvasCapture),
      webCodecs: hasWebCodecs,
      mediaRecorder: hasMediaRecorder,
      message: ''
    };

    if (hasWebCodecs) {
      status.message = 'Hardware-accelerated WebCodecs AVC/H.264 video encoding ready.';
    } else if (hasMediaRecorder) {
      status.message = 'Real-time client-side video recorder engine active.';
    } else {
      status.message = 'Notice: This browser has restricted video encoding. Chrome, Edge or Safari 16.4+ recommended.';
    }

    return status;
  }

  function renderWaveform(waveform) {
    if (!waveformCanvas) return;
    var ctx = waveformCanvas.getContext('2d');
    var w = waveformCanvas.width;
    var h = waveformCanvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!waveform || !waveform.length) {
      waveform = [];
      for (var s = 0; s < 64; s++) {
        waveform.push(Math.sin(s * 0.2) * 0.4 + 0.5);
      }
    }

    var barWidth = (w / waveform.length) - 2;
    for (var i = 0; i < waveform.length; i++) {
      var val = waveform[i];
      var barH = Math.max(4, val * (h - 8));
      var x = i * (barWidth + 2);
      var y = (h - barH) / 2;

      ctx.fillStyle = '#00ffb0';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, barH, 2);
      } else {
        ctx.rect(x, y, barWidth, barH);
      }
      ctx.fill();
    }
  }

  function updateTrimUI() {
    if (!trimSlider) return;

    var startFrac = Math.max(0, Math.min(1, trimStart / trackDuration));
    var endFrac = Math.max(0, Math.min(1, trimEnd / trackDuration));

    if (handleStart) {
      handleStart.style.left = (startFrac * 100) + '%';
      handleStart.setAttribute('aria-valuenow', trimStart.toFixed(1));
      handleStart.setAttribute('aria-valuetext', formatTimeWithTenths(trimStart));
    }

    if (handleEnd) {
      handleEnd.style.left = (endFrac * 100) + '%';
      handleEnd.setAttribute('aria-valuenow', trimEnd.toFixed(1));
      handleEnd.setAttribute('aria-valuetext', formatTimeWithTenths(trimEnd));
    }

    if (trimActiveRegion) {
      trimActiveRegion.style.left = (startFrac * 100) + '%';
      trimActiveRegion.style.width = ((endFrac - startFrac) * 100) + '%';
    }

    if (trimMaskStart) {
      trimMaskStart.style.width = (startFrac * 100) + '%';
    }

    if (trimMaskEnd) {
      trimMaskEnd.style.width = ((1 - endFrac) * 100) + '%';
    }

    if (startInput && document.activeElement !== startInput) {
      startInput.value = formatTimeWithTenths(trimStart);
    }

    if (endInput && document.activeElement !== endInput) {
      endInput.value = formatTimeWithTenths(trimEnd);
    }

    var diff = Math.max(0, trimEnd - trimStart);
    if (durationBadge) {
      durationBadge.textContent = diff.toFixed(1) + 's';
    }

    // Keep preview audio bounded to trim range
    if (previewAudio) {
      if (previewAudio.currentTime < trimStart || previewAudio.currentTime > trimEnd) {
        previewAudio.currentTime = trimStart;
      }
    }

    updateEstimates();
  }

  function updateEstimates() {
    var outDuration = Math.max(0, trimEnd - trimStart);

    if (estimateDurationEl) {
      estimateDurationEl.textContent = formatTime(outDuration);
    }

    var mbPerSec = currentResolution === '1080p' ? 0.836 : 0.457;
    var estFileSizeMB = (outDuration * mbPerSec).toFixed(1);

    if (estimateFilesizeEl) {
      estimateFilesizeEl.textContent = '~' + estFileSizeMB + ' MB';
    }

    var isLowMemory = typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory < 4;
    var speedMultiplier = isLowMemory ? 1.4 : 0.75;
    var estRenderSec = Math.max(3, Math.round(outDuration * speedMultiplier));

    if (estimateRendertimeEl) {
      estimateRendertimeEl.textContent = '~' + estRenderSec + 's';
    }

    if (previewTimeDisplay) {
      var cur = previewAudio ? previewAudio.currentTime : trimStart;
      previewTimeDisplay.textContent = formatTimeWithTenths(cur) + ' / ' + formatTimeWithTenths(trimEnd);
    }
  }

  function updateFrameShapePreview() {
    if (!frameShapeBox) return;

    var ratioMap = {
      '16:9': '16 / 9',
      '9:16': '9 / 16',
      '1:1': '1 / 1',
      '4:5': '4 / 5'
    };

    var resMap = {
      '16:9': currentResolution === '1080p' ? '1920 × 1080' : '1280 × 720',
      '9:16': currentResolution === '1080p' ? '1080 × 1920' : '720 × 1280',
      '1:1': currentResolution === '1080p' ? '1080 × 1080' : '720 × 720',
      '4:5': currentResolution === '1080p' ? '1080 × 1350' : '720 × 900'
    };

    frameShapeBox.style.aspectRatio = ratioMap[currentRatio] || '16 / 9';

    if (frameShapeWatermark) {
      frameShapeWatermark.textContent = (resMap[currentRatio] || '1920 × 1080') + ' • ' + currentRatio;
    }

    // Adjust preview canvas dimensions to maintain aspect ratio without distortion
    if (previewCanvas) {
      if (currentRatio === '9:16') {
        previewCanvas.width = 360;
        previewCanvas.height = 640;
      } else if (currentRatio === '1:1') {
        previewCanvas.width = 480;
        previewCanvas.height = 480;
      } else if (currentRatio === '4:5') {
        previewCanvas.width = 400;
        previewCanvas.height = 500;
      } else {
        previewCanvas.width = 640;
        previewCanvas.height = 360;
      }
    }
  }

  function showTrimError(msg) {
    if (!trimErrorEl) return;
    trimErrorEl.textContent = msg;
    trimErrorEl.style.display = 'block';
  }

  function hideTrimError() {
    if (!trimErrorEl) return;
    trimErrorEl.textContent = '';
    trimErrorEl.style.display = 'none';
  }

  function setTrimRange(newStart, newEnd) {
    hideTrimError();

    newStart = Math.max(0, Math.min(trackDuration, newStart));
    newEnd = Math.max(0, Math.min(trackDuration, newEnd));

    if (newEnd < newStart) {
      var t = newStart;
      newStart = newEnd;
      newEnd = t;
    }

    if (newEnd - newStart < MIN_TRIM_SEC) {
      if (trackDuration >= MIN_TRIM_SEC) {
        showTrimError('Minimum trim length is ' + MIN_TRIM_SEC + ' seconds.');
        if (newStart + MIN_TRIM_SEC <= trackDuration) {
          newEnd = newStart + MIN_TRIM_SEC;
        } else {
          newStart = Math.max(0, newEnd - MIN_TRIM_SEC);
        }
      } else {
        newStart = 0;
        newEnd = trackDuration;
      }
    }

    trimStart = newStart;
    trimEnd = newEnd;
    updateTrimUI();
  }

  function bindTrimDragging() {
    if (!trimSlider) return;

    function handlePointerMove(e) {
      if (!isDraggingStart && !isDraggingEnd) return;
      var rect = trimSlider.getBoundingClientRect();
      var clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      var frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      var timeAtPos = frac * trackDuration;

      if (isDraggingStart) {
        if (timeAtPos > trimEnd - MIN_TRIM_SEC) {
          timeAtPos = trimEnd - MIN_TRIM_SEC;
        }
        trimStart = Math.max(0, Math.min(trackDuration, timeAtPos));
      } else if (isDraggingEnd) {
        if (timeAtPos < trimStart + MIN_TRIM_SEC) {
          timeAtPos = trimStart + MIN_TRIM_SEC;
        }
        trimEnd = Math.max(0, Math.min(trackDuration, timeAtPos));
      }

      updateTrimUI();
    }

    function handlePointerUp() {
      if (isDraggingStart || isDraggingEnd) {
        isDraggingStart = false;
        isDraggingEnd = false;
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        document.removeEventListener('touchmove', handlePointerMove);
        document.removeEventListener('touchend', handlePointerUp);
      }
    }

    if (handleStart) {
      handleStart.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        isDraggingStart = true;
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
      });
      handleStart.addEventListener('touchstart', function () {
        isDraggingStart = true;
        document.addEventListener('touchmove', handlePointerMove);
        document.addEventListener('touchend', handlePointerUp);
      }, { passive: true });

      handleStart.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? 1.0 : 0.1;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          setTrimRange(trimStart - step, trimEnd);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          setTrimRange(trimStart + step, trimEnd);
        }
      });
    }

    if (handleEnd) {
      handleEnd.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        isDraggingEnd = true;
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
      });
      handleEnd.addEventListener('touchstart', function () {
        isDraggingEnd = true;
        document.addEventListener('touchmove', handlePointerMove);
        document.addEventListener('touchend', handlePointerUp);
      }, { passive: true });

      handleEnd.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? 1.0 : 0.1;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          setTrimRange(trimStart, trimEnd - step);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          setTrimRange(trimStart, trimEnd + step);
        }
      });
    }

    // Direct click/tap on track region to jump nearest handle
    trimSlider.addEventListener('click', function (e) {
      if (e.target === handleStart || e.target === handleEnd || (e.target && e.target.classList.contains('handle-grip'))) return;
      var rect = trimSlider.getBoundingClientRect();
      var frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      var timeAtPos = frac * trackDuration;

      var distStart = Math.abs(timeAtPos - trimStart);
      var distEnd = Math.abs(timeAtPos - trimEnd);

      if (distStart < distEnd) {
        setTrimRange(timeAtPos, trimEnd);
      } else {
        setTrimRange(trimStart, timeAtPos);
      }
    });
  }

  function bindInputs() {
    if (startInput) {
      startInput.addEventListener('change', function () {
        var parsed = parseTime(startInput.value);
        if (!isNaN(parsed)) {
          setTrimRange(parsed, trimEnd);
        } else {
          startInput.value = formatTimeWithTenths(trimStart);
        }
      });
    }

    if (endInput) {
      endInput.addEventListener('change', function () {
        var parsed = parseTime(endInput.value);
        if (!isNaN(parsed)) {
          setTrimRange(trimStart, parsed);
        } else {
          endInput.value = formatTimeWithTenths(trimEnd);
        }
      });
    }

    // Preset chips
    var presetFull = document.getElementById('studio-trim-preset-full');
    var preset15 = document.getElementById('studio-trim-preset-15s');
    var preset30 = document.getElementById('studio-trim-preset-30s');
    var preset60 = document.getElementById('studio-trim-preset-60s');

    if (presetFull) {
      presetFull.addEventListener('click', function () {
        setTrimRange(0, trackDuration);
      });
    }
    if (preset15) {
      preset15.addEventListener('click', function () {
        setTrimRange(0, Math.min(15.0, trackDuration));
      });
    }
    if (preset30) {
      preset30.addEventListener('click', function () {
        setTrimRange(0, Math.min(30.0, trackDuration));
      });
    }
    if (preset60) {
      preset60.addEventListener('click', function () {
        setTrimRange(0, Math.min(60.0, trackDuration));
      });
    }
  }

  function bindOptions() {
    // Ratio card clicks
    ratioCards.forEach(function (card) {
      card.addEventListener('click', function () {
        if (card.classList.contains('is-disabled')) return;
        var r = card.getAttribute('data-ratio');
        currentRatio = r;
        ratioCards.forEach(function (c) {
          var sel = (c === card);
          c.classList.toggle('is-selected', sel);
          c.setAttribute('aria-checked', sel ? 'true' : 'false');
        });
        updateFrameShapePreview();
      });
    });

    // Resolution card clicks
    resCards.forEach(function (card) {
      card.addEventListener('click', function () {
        var res = card.getAttribute('data-res');
        currentResolution = res;
        resCards.forEach(function (c) {
          var sel = (c === card);
          c.classList.toggle('is-selected', sel);
          c.setAttribute('aria-checked', sel ? 'true' : 'false');
        });
        updateFrameShapePreview();
        updateEstimates();
      });
    });

    // Header buttons
    var backBtn = document.getElementById('studio-btn-back-to-styles');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        stopPreviewAudio();
        if (Router) Router.navigate('#visualizer/styles');
      });
    }

    var tryAnotherBtn = document.getElementById('studio-btn-try-another-style');
    if (tryAnotherBtn) {
      tryAnotherBtn.addEventListener('click', function () {
        stopPreviewAudio();
        if (Router) Router.navigate('#visualizer/styles');
      });
    }

    var changeAudioBtn = document.getElementById('studio-settings-change-audio-btn');
    if (changeAudioBtn) {
      changeAudioBtn.addEventListener('click', function () {
        stopPreviewAudio();
        if (window.StudioUploadModal) window.StudioUploadModal.open();
      });
    }

    var changeStyleBtn = document.getElementById('studio-settings-change-style-btn');
    if (changeStyleBtn) {
      changeStyleBtn.addEventListener('click', function () {
        stopPreviewAudio();
        if (Router) Router.navigate('#visualizer/styles');
      });
    }

    // Start video render CTA
    if (startRenderBtn) {
      startRenderBtn.addEventListener('click', function () {
        stopPreviewAudio();

        var settings = {
          aspectRatio: currentRatio,
          resolution: currentResolution,
          trimStart: trimStart,
          trimEnd: trimEnd,
          duration: Math.max(0, trimEnd - trimStart),
          customParams: Customization ? Customization.getParams() : {}
        };

        if (Store) {
          Store.dispatch({
            type: 'SETTINGS_CONFIRMED',
            payload: { settings: settings }
          });
        }

        if (Router) {
          Router.navigate('#visualizer/render');
        }
      });
    }
  }

  /**
   * Setup live preview canvas and audio element
   */
  function setupLivePreview() {
    previewCanvas = document.getElementById('studio-settings-preview-canvas');
    previewPlayBtn = document.getElementById('studio-preview-play-btn');
    previewPlayIcon = document.getElementById('studio-preview-play-icon');
    previewPlayLabel = document.getElementById('studio-preview-play-label');
    previewTimeDisplay = document.getElementById('studio-preview-time-display');

    if (!previewAudio) {
      previewAudio = new Audio();
    }

    if (activeAudio && activeAudio.blob) {
      try {
        var objUrl = URL.createObjectURL(activeAudio.blob);
        previewAudio.src = objUrl;
        previewAudio.currentTime = trimStart;
      } catch (e) {
        console.warn('[StudioSettings] previewAudio source setup:', e);
      }
    }

    // Time update listener
    previewAudio.ontimeupdate = function () {
      if (previewAudio.currentTime > trimEnd) {
        previewAudio.pause();
        previewAudio.currentTime = trimStart;
        setPreviewPlaying(false);
      }
      if (previewTimeDisplay) {
        previewTimeDisplay.textContent = formatTimeWithTenths(previewAudio.currentTime) + ' / ' + formatTimeWithTenths(trimEnd);
      }
    };

    previewAudio.onended = function () {
      setPreviewPlaying(false);
      previewAudio.currentTime = trimStart;
    };

    if (previewPlayBtn) {
      previewPlayBtn.onclick = function () {
        togglePreviewPlay();
      };
    }

    // Start live visualizer engine rendering on previewCanvas
    if (Renderer && previewCanvas) {
      var customParams = Customization ? Customization.getParams() : {};
      Renderer.bindLivePreview(previewCanvas, previewAudio, (activeStyle ? activeStyle.id : 'classic-bars'), customParams);
    }
  }

  function setPreviewPlaying(playing) {
    isPreviewPlaying = playing;
    if (previewPlayIcon) {
      previewPlayIcon.textContent = playing ? '⏸' : '▶';
    }
    if (previewPlayLabel) {
      previewPlayLabel.textContent = playing ? 'Pause Preview' : 'Play Preview';
    }
  }

  function togglePreviewPlay() {
    if (!previewAudio) return;
    if (isPreviewPlaying) {
      previewAudio.pause();
      setPreviewPlaying(false);
    } else {
      if (previewAudio.currentTime < trimStart || previewAudio.currentTime >= trimEnd) {
        previewAudio.currentTime = trimStart;
      }
      previewAudio.play().then(function () {
        setPreviewPlaying(true);
      }).catch(function (err) {
        console.warn('[StudioSettings] Audio play blocked:', err);
      });
    }
  }

  function stopPreviewAudio() {
    if (previewAudio) {
      previewAudio.pause();
      setPreviewPlaying(false);
    }
    if (Renderer) {
      Renderer.stopLivePreview();
    }
  }

  /**
   * Bind Section D Customization controls and events
   */
  function bindCustomizationControls() {
    if (!Customization) return;

    // Contrast check alert
    var contrastAlert = document.getElementById('studio-custom-contrast-alert');
    var contrastText = document.getElementById('studio-contrast-text');

    function checkActiveContrast() {
      var params = Customization.getParams();
      var check = Customization.checkContrast(params.primaryColor, params.backgroundColor);
      if (contrastAlert && contrastText) {
        if (check.isLow) {
          contrastText.textContent = check.warning;
          contrastAlert.style.display = 'flex';
        } else {
          contrastAlert.style.display = 'none';
        }
      }
    }

    // D.1: Palette Presets
    var paletteBtns = Array.from(document.querySelectorAll('.studio-palette-btn'));
    paletteBtns.forEach(function (btn) {
      btn.onclick = function () {
        var palKey = btn.getAttribute('data-palette');
        var preset = Customization.PALETTE_PRESETS[palKey];
        if (!preset) return;

        paletteBtns.forEach(function (b) { b.classList.toggle('is-active', b === btn); });

        Customization.setParams({
          palettePreset: palKey,
          primaryColor: preset.primaryColor,
          accentColor: preset.accentColor,
          backgroundColor: preset.backgroundColor
        });

        // Update hex pickers
        var pCol = document.getElementById('studio-custom-primary-color');
        var aCol = document.getElementById('studio-custom-accent-color');
        var bCol = document.getElementById('studio-custom-bg-color');
        var pHex = document.getElementById('studio-primary-hex');
        var aHex = document.getElementById('studio-accent-hex');
        var bHex = document.getElementById('studio-bg-hex');

        if (pCol) pCol.value = preset.primaryColor;
        if (aCol) aCol.value = preset.accentColor;
        if (bCol) bCol.value = preset.backgroundColor;
        if (pHex) pHex.textContent = preset.primaryColor;
        if (aHex) aHex.textContent = preset.accentColor;
        if (bHex) bHex.textContent = preset.backgroundColor;

        checkActiveContrast();
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    });

    // Color Pickers
    var primaryPicker = document.getElementById('studio-custom-primary-color');
    var accentPicker = document.getElementById('studio-custom-accent-color');
    var bgPicker = document.getElementById('studio-custom-bg-color');
    var primaryHex = document.getElementById('studio-primary-hex');
    var accentHex = document.getElementById('studio-accent-hex');
    var bgHex = document.getElementById('studio-bg-hex');

    if (primaryPicker) {
      primaryPicker.oninput = function () {
        var val = primaryPicker.value;
        if (primaryHex) primaryHex.textContent = val;
        Customization.setParams({ primaryColor: val });
        checkActiveContrast();
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }
    if (accentPicker) {
      accentPicker.oninput = function () {
        var val = accentPicker.value;
        if (accentHex) accentHex.textContent = val;
        Customization.setParams({ accentColor: val });
        checkActiveContrast();
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }
    if (bgPicker) {
      bgPicker.oninput = function () {
        var val = bgPicker.value;
        if (bgHex) bgHex.textContent = val;
        Customization.setParams({ backgroundColor: val });
        checkActiveContrast();
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    // D.2: Background Type Selector & Images
    var bgBtns = Array.from(document.querySelectorAll('.studio-bg-btn'));
    var bgImageRow = document.getElementById('studio-bg-image-row');
    var bgImageUpload = document.getElementById('studio-bg-image-upload');
    var chooseBgImgBtn = document.getElementById('studio-choose-bg-img-btn');
    var bgImgName = document.getElementById('studio-bg-image-name');
    var bgImgRemove = document.getElementById('studio-bg-image-remove-btn');

    bgBtns.forEach(function (btn) {
      btn.onclick = function () {
        var bgType = btn.getAttribute('data-bg');
        bgBtns.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        Customization.setParams({ backgroundType: bgType });

        if (bgImageRow) {
          bgImageRow.style.display = (bgType === 'image') ? 'flex' : 'none';
        }

        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    });

    if (chooseBgImgBtn && bgImageUpload) {
      chooseBgImgBtn.onclick = function () { bgImageUpload.click(); };
      bgImageUpload.onchange = async function () {
        if (!bgImageUpload.files || !bgImageUpload.files[0]) return;
        var file = bgImageUpload.files[0];
        try {
          var downscaled = await Customization.downscaleImageFile(file, 1080);
          Customization.setParams({
            backgroundImageData: downscaled,
            backgroundImageName: file.name
          });
          if (bgImgName) bgImgName.textContent = file.name;
          if (bgImgRemove) bgImgRemove.style.display = 'inline-block';
          if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
          if (UI && UI.showToast) UI.showToast('Background image loaded successfully', 'success');
        } catch (err) {
          if (UI && UI.showToast) UI.showToast(err.message, 'error');
        }
      };
    }

    if (bgImgRemove) {
      bgImgRemove.onclick = function () {
        Customization.setParams({ backgroundImageData: null, backgroundImageName: '' });
        if (bgImgName) bgImgName.textContent = 'No image selected';
        bgImgRemove.style.display = 'none';
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    // Cover Artwork Upload
    var chooseCoverBtn = document.getElementById('studio-choose-cover-btn');
    var coverArtUpload = document.getElementById('studio-cover-art-upload');
    var coverArtName = document.getElementById('studio-cover-art-name');
    var coverArtRemove = document.getElementById('studio-cover-art-remove-btn');

    if (chooseCoverBtn && coverArtUpload) {
      chooseCoverBtn.onclick = function () { coverArtUpload.click(); };
      coverArtUpload.onchange = async function () {
        if (!coverArtUpload.files || !coverArtUpload.files[0]) return;
        var file = coverArtUpload.files[0];
        try {
          var downscaled = await Customization.downscaleImageFile(file, 512);
          Customization.setParams({
            coverImageData: downscaled,
            coverImageName: file.name
          });
          if (coverArtName) coverArtName.textContent = file.name;
          if (coverArtRemove) coverArtRemove.style.display = 'inline-block';
          if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
          if (UI && UI.showToast) UI.showToast('Cover art uploaded', 'success');
        } catch (err) {
          if (UI && UI.showToast) UI.showToast(err.message, 'error');
        }
      };
    }

    if (coverArtRemove) {
      coverArtRemove.onclick = function () {
        Customization.setParams({ coverImageData: null, coverImageName: '' });
        if (coverArtName) coverArtName.textContent = 'No cover';
        coverArtRemove.style.display = 'none';
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    // D.3: Typography Overlay & Progress Bar
    var titleInput = document.getElementById('studio-text-title');
    var artistInput = document.getElementById('studio-text-artist');
    var fontSelect = document.getElementById('studio-select-font');
    var progressToggle = document.getElementById('studio-toggle-progress-bar');

    if (titleInput) {
      if (activeAudio && activeAudio.name) {
        titleInput.value = activeAudio.name.replace(/\.[a-zA-Z0-9]+$/, '');
        Customization.setParams({ titleText: titleInput.value });
      }
      titleInput.oninput = function () {
        Customization.setParams({ titleText: titleInput.value });
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    if (artistInput) {
      artistInput.oninput = function () {
        Customization.setParams({ artistText: artistInput.value });
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    if (fontSelect) {
      fontSelect.onchange = async function () {
        var fontKey = fontSelect.value;
        var fontCss = await Customization.ensureFontLoaded(fontKey);
        Customization.setParams({ fontFamily: fontKey, fontCss: fontCss });
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    if (progressToggle) {
      progressToggle.onchange = function () {
        Customization.setParams({ showProgressBar: progressToggle.checked });
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    // D.4: Motion Reactivity & Guides
    var sensSlider = document.getElementById('studio-slider-sensitivity');
    var sensVal = document.getElementById('studio-sensitivity-value');
    var barCountSlider = document.getElementById('studio-slider-bar-count');
    var barCountVal = document.getElementById('studio-bar-count-value');
    var gapSlider = document.getElementById('studio-slider-bar-gap');
    var gapVal = document.getElementById('studio-bar-gap-value');
    var glowToggle = document.getElementById('studio-toggle-glow');
    var reflToggle = document.getElementById('studio-toggle-reflection');
    var safeGuidesToggle = document.getElementById('studio-toggle-safe-guides');

    if (sensSlider) {
      sensSlider.oninput = function () {
        var v = parseFloat(sensSlider.value);
        if (sensVal) sensVal.textContent = v.toFixed(2) + 'x';
        Customization.setParams({ sensitivity: v });
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    if (barCountSlider) {
      barCountSlider.oninput = function () {
        var bc = parseInt(barCountSlider.value, 10);
        if (barCountVal) barCountVal.textContent = bc;
        Customization.setParams({ barCount: bc });
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    if (gapSlider) {
      gapSlider.oninput = function () {
        var gp = parseInt(gapSlider.value, 10);
        if (gapVal) gapVal.textContent = gp + 'px';
        Customization.setParams({ gap: gp });
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    if (glowToggle) {
      glowToggle.onchange = function () {
        Customization.setParams({ glow: glowToggle.checked });
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    if (reflToggle) {
      reflToggle.onchange = function () {
        Customization.setParams({ reflection: reflToggle.checked });
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    if (safeGuidesToggle) {
      safeGuidesToggle.onchange = function () {
        Customization.setParams({ showSafeAreaGuides: safeGuidesToggle.checked });
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    // D.5: Presets & Reset
    var resetDefaultsBtn = document.getElementById('studio-reset-defaults-btn');
    var presetsDropdown = document.getElementById('studio-presets-dropdown');
    var savePresetBtn = document.getElementById('studio-save-preset-btn');
    var deletePresetBtn = document.getElementById('studio-delete-preset-btn');

    // Preset save modal elements
    var presetModal = document.getElementById('studioPresetModal');
    var presetCloseBtn = document.getElementById('studioPresetCloseBtn');
    var presetCancelBtn = document.getElementById('studioPresetCancelBtn');
    var presetConfirmBtn = document.getElementById('studioPresetConfirmBtn');
    var presetNameInput = document.getElementById('studioPresetNameInput');
    var presetErrorEl = document.getElementById('studioPresetError');

    function populatePresetsDropdown() {
      if (!Storage || !presetsDropdown) return;
      Storage.getPresets().then(function (presets) {
        presets = presets || [];
        presetsDropdown.innerHTML = '<option value="">-- Load Saved Preset --</option>';
        presets.forEach(function (p) {
          var opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name;
          presetsDropdown.appendChild(opt);
        });
      });
    }

    populatePresetsDropdown();

    if (presetsDropdown) {
      presetsDropdown.onchange = function () {
        var pId = presetsDropdown.value;
        if (!pId || !Storage) {
          if (deletePresetBtn) deletePresetBtn.style.display = 'none';
          return;
        }
        Storage.getPresets().then(function (presets) {
          var found = presets.find(function (p) { return p.id === pId; });
          if (found && found.params) {
            Customization.setParams(found.params);
            if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), found.params);
            if (deletePresetBtn) deletePresetBtn.style.display = 'inline-block';
            if (UI && UI.showToast) UI.showToast('Loaded preset: ' + found.name, 'success');
          }
        });
      };
    }

    if (deletePresetBtn) {
      deletePresetBtn.onclick = function () {
        var pId = presetsDropdown.value;
        if (!pId || !Storage) return;
        Storage.deletePreset(pId).then(function () {
          populatePresetsDropdown();
          deletePresetBtn.style.display = 'none';
          if (UI && UI.showToast) UI.showToast('Preset deleted', 'info');
        });
      };
    }

    if (savePresetBtn && presetModal) {
      savePresetBtn.onclick = function () {
        presetModal.style.display = 'flex';
        presetModal.setAttribute('aria-hidden', 'false');
        if (presetNameInput) {
          presetNameInput.value = (activeStyle ? activeStyle.name : 'Custom') + ' Preset';
          presetNameInput.focus();
        }
        if (presetErrorEl) presetErrorEl.style.display = 'none';
      };
    }

    function closePresetModal() {
      if (!presetModal) return;
      presetModal.style.display = 'none';
      presetModal.setAttribute('aria-hidden', 'true');
    }

    if (presetCloseBtn) presetCloseBtn.onclick = closePresetModal;
    if (presetCancelBtn) presetCancelBtn.onclick = closePresetModal;

    if (presetConfirmBtn && presetNameInput) {
      presetConfirmBtn.onclick = function () {
        var name = (presetNameInput.value || '').trim();
        if (!name) {
          if (presetErrorEl) {
            presetErrorEl.textContent = 'Please enter a preset name.';
            presetErrorEl.style.display = 'block';
          }
          return;
        }

        var paramsToSave = Customization.getParams();
        // Exclude raw heavy bitmap memory from storage record
        var serializableParams = Object.assign({}, paramsToSave, {
          backgroundImageData: null,
          coverImageData: null
        });

        Storage.savePreset({
          name: name,
          styleId: activeStyle ? activeStyle.id : 'classic-bars',
          params: serializableParams
        }).then(function () {
          closePresetModal();
          populatePresetsDropdown();
          if (UI && UI.showToast) UI.showToast('Preset "' + name + '" saved!', 'success');
        }).catch(function (err) {
          if (presetErrorEl) {
            presetErrorEl.textContent = 'Could not save preset: ' + (err.message || 'Storage full');
            presetErrorEl.style.display = 'block';
          }
        });
      };
    }

    if (resetDefaultsBtn) {
      resetDefaultsBtn.onclick = function () {
        Customization.resetToDefaults(activeStyle ? activeStyle.id : 'classic-bars');
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
        if (UI && UI.showToast) UI.showToast('Reset to default parameters', 'info');
      };
    }

    checkActiveContrast();
  }

  /**
   * Bind Synchronized Lyrics Overlay controls (Prompt 11)
   */
  function bindLyricsControls() {
    var Parser = LyricsParser || (typeof window !== 'undefined' ? window.StudioLyricsParser : (typeof globalThis !== 'undefined' ? globalThis.StudioLyricsParser : null));
    var toggleLyrics = document.getElementById('studio-toggle-lyrics');
    var controlsBody = document.getElementById('studio-lyrics-controls-body');
    var statusBadge = document.getElementById('studio-lyrics-status-badge');
    var filenameEl = document.getElementById('studio-lyrics-filename');
    var browseBtn = document.getElementById('studio-btn-browse-lyrics');
    var fileInput = document.getElementById('studio-lyrics-file-upload');
    var pasteBtn = document.getElementById('studio-btn-paste-lyrics');
    var handoffBtn = document.getElementById('studio-btn-editor-handoff');
    var clearBtn = document.getElementById('studio-btn-clear-lyrics');
    var stylePills = Array.from(document.querySelectorAll('.studio-lyrics-style-pill'));
    var offsetSlider = document.getElementById('studio-slider-lyrics-offset');
    var offsetVal = document.getElementById('studio-lyrics-offset-val');

    // Paste Modal elements
    var pasteModal = document.getElementById('studioLyricsPasteModal');
    var pasteCloseBtn = document.getElementById('studioLyricsPasteCloseBtn');
    var pasteCancelBtn = document.getElementById('studioLyricsPasteCancelBtn');
    var pasteConfirmBtn = document.getElementById('studioLyricsPasteConfirmBtn');
    var pasteTextarea = document.getElementById('studioLyricsTextarea');
    var pasteError = document.getElementById('studioLyricsPasteError');

    function updateLyricsUI() {
      var params = Customization ? Customization.getParams() : {};
      var lyr = params.lyrics || {};

      if (toggleLyrics) toggleLyrics.checked = !!lyr.enabled;
      if (controlsBody) controlsBody.style.display = lyr.enabled ? 'block' : 'none';

      var cueCount = (lyr.cues && Array.isArray(lyr.cues)) ? lyr.cues.length : 0;
      if (cueCount > 0) {
        if (statusBadge) {
          statusBadge.textContent = cueCount + ' cues (' + (lyr.format ? lyr.format.toUpperCase() : 'SYNC') + ')';
          statusBadge.classList.add('has-cues');
        }
        if (filenameEl) filenameEl.textContent = lyr.filename || 'Custom Lyrics';
        if (clearBtn) clearBtn.style.display = 'inline-flex';
      } else {
        if (statusBadge) {
          statusBadge.textContent = 'No Lyrics';
          statusBadge.classList.remove('has-cues');
        }
        if (filenameEl) filenameEl.textContent = 'No lyrics loaded';
        if (clearBtn) clearBtn.style.display = 'none';
      }

      if (offsetSlider) {
        offsetSlider.value = lyr.offsetSeconds !== undefined ? lyr.offsetSeconds : 0.0;
      }
      if (offsetVal) {
        var off = lyr.offsetSeconds || 0.0;
        offsetVal.textContent = (off > 0 ? '+' : '') + off.toFixed(2) + 's';
      }

      stylePills.forEach(function (pill) {
        var st = pill.getAttribute('data-style');
        var sel = (st === (lyr.style || 'karaoke'));
        pill.classList.toggle('is-active', sel);
        pill.setAttribute('aria-checked', sel ? 'true' : 'false');
      });
    }

    // Toggle Checkbox
    if (toggleLyrics) {
      toggleLyrics.onchange = function () {
        var params = Customization ? Customization.getParams() : {};
        var lyr = Object.assign({}, params.lyrics || {}, { enabled: toggleLyrics.checked });
        Customization.setParams({ lyrics: lyr });
        if (controlsBody) controlsBody.style.display = toggleLyrics.checked ? 'block' : 'none';
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    function applyParsedLyrics(rawText, filename) {
      if (!Parser) {
        console.error('[StudioSettings] Lyrics parser unavailable');
        return;
      }
      var parsed = Parser.parse(rawText);
      var params = Customization ? Customization.getParams() : {};
      var lyr = Object.assign({}, params.lyrics || {}, {
        enabled: true,
        cues: parsed.cues,
        format: parsed.format,
        filename: filename || 'Loaded Lyrics',
        metadata: parsed.metadata
      });
      Customization.setParams({ lyrics: lyr });
      updateLyricsUI();
      if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
    }

    // Check Editor Handoff from localStorage
    try {
      var handoffData = localStorage.getItem('synclines_editor_handoff');
      if (handoffData && handoffBtn) {
        handoffBtn.style.display = 'inline-flex';
        handoffBtn.onclick = function () {
          try {
            var parsedHandoff = JSON.parse(handoffData);
            var content = parsedHandoff.content || parsedHandoff.lrc || parsedHandoff;
            if (typeof content !== 'string') content = JSON.stringify(content);
            applyParsedLyrics(content, (parsedHandoff.title ? parsedHandoff.title + '.lrc' : 'Editor Lyrics'));
            if (UI && UI.showToast) UI.showToast('Loaded lyrics from SyncLines Editor!', 'success');
          } catch (e) {
            applyParsedLyrics(handoffData, 'Editor Lyrics');
            if (UI && UI.showToast) UI.showToast('Loaded lyrics from SyncLines Editor!', 'success');
          }
        };
      }
    } catch (e) {}

    // File Browse
    if (browseBtn && fileInput) {
      browseBtn.onclick = function () { fileInput.click(); };
      fileInput.onchange = function () {
        if (!fileInput.files || !fileInput.files[0]) return;
        var file = fileInput.files[0];
        var reader = new FileReader();
        reader.onload = function (e) {
          var raw = e.target.result;
          applyParsedLyrics(raw, file.name);
          if (UI && UI.showToast) UI.showToast('Lyrics loaded: ' + file.name, 'success');
        };
        reader.readAsText(file);
      };
    }

    // Paste Modal Handlers
    function openPasteModal() {
      if (!pasteModal) return;
      pasteModal.style.display = 'flex';
      pasteModal.setAttribute('aria-hidden', 'false');
      if (pasteError) pasteError.style.display = 'none';
      if (pasteTextarea) {
        pasteTextarea.value = '';
        setTimeout(function () { pasteTextarea.focus(); }, 100);
      }
    }

    function closePasteModal() {
      if (!pasteModal) return;
      pasteModal.style.display = 'none';
      pasteModal.setAttribute('aria-hidden', 'true');
    }

    if (pasteBtn) pasteBtn.onclick = openPasteModal;
    if (pasteCloseBtn) pasteCloseBtn.onclick = closePasteModal;
    if (pasteCancelBtn) pasteCancelBtn.onclick = closePasteModal;

    if (pasteConfirmBtn) {
      pasteConfirmBtn.onclick = function () {
        var text = pasteTextarea ? pasteTextarea.value.trim() : '';
        if (!text) {
          if (pasteError) {
            pasteError.textContent = 'Please enter or paste lyric text.';
            pasteError.style.display = 'block';
          }
          return;
        }
        if (!Parser) return;
        var parsed = Parser.parse(text);
        if (!parsed.cues || parsed.cues.length === 0) {
          if (pasteError) {
            pasteError.textContent = 'No lyric timestamps detected. Make sure to use [mm:ss.xx] timestamps.';
            pasteError.style.display = 'block';
          }
          return;
        }
        applyParsedLyrics(text, 'Pasted Lyrics');
        closePasteModal();
        if (UI && UI.showToast) UI.showToast(parsed.cues.length + ' cues imported!', 'success');
      };
    }

    // Style Pills
    stylePills.forEach(function (pill) {
      pill.onclick = function () {
        var st = pill.getAttribute('data-style');
        var params = Customization ? Customization.getParams() : {};
        var lyr = Object.assign({}, params.lyrics || {}, { style: st });
        Customization.setParams({ lyrics: lyr });
        updateLyricsUI();
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    });

    // Timing Offset Slider
    if (offsetSlider) {
      offsetSlider.oninput = function () {
        var val = parseFloat(offsetSlider.value);
        if (offsetVal) offsetVal.textContent = (val > 0 ? '+' : '') + val.toFixed(2) + 's';
        var params = Customization ? Customization.getParams() : {};
        var lyr = Object.assign({}, params.lyrics || {}, { offsetSeconds: val });
        Customization.setParams({ lyrics: lyr });
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
      };
    }

    // Clear Button
    if (clearBtn) {
      clearBtn.onclick = function () {
        var params = Customization ? Customization.getParams() : {};
        var lyr = Object.assign({}, params.lyrics || {}, {
          cues: [],
          filename: '',
          format: ''
        });
        Customization.setParams({ lyrics: lyr });
        updateLyricsUI();
        if (Renderer) Renderer.setStyle((activeStyle ? activeStyle.id : 'classic-bars'), Customization.getParams());
        if (UI && UI.showToast) UI.showToast('Lyrics cleared', 'info');
      };
    }

    updateLyricsUI();
  }

  /**
   * Bind Studio Keyboard Shortcuts (? modal, space, left/right, 1-4)
   */
  function bindKeyboardShortcuts() {
    var shortcutsModal = document.getElementById('studioShortcutsModal');
    var shortcutsBtn = document.getElementById('studio-btn-shortcuts');
    var shortcutsCloseBtn = document.getElementById('studioShortcutsCloseBtn');
    var shortcutsDismissBtn = document.getElementById('studioShortcutsDismissBtn');

    function openShortcuts() {
      if (!shortcutsModal) return;
      shortcutsModal.style.display = 'flex';
      shortcutsModal.setAttribute('aria-hidden', 'false');
    }

    function closeShortcuts() {
      if (!shortcutsModal) return;
      shortcutsModal.style.display = 'none';
      shortcutsModal.setAttribute('aria-hidden', 'true');
    }

    if (shortcutsBtn) shortcutsBtn.onclick = openShortcuts;
    if (shortcutsCloseBtn) shortcutsCloseBtn.onclick = closeShortcuts;
    if (shortcutsDismissBtn) shortcutsDismissBtn.onclick = closeShortcuts;

    document.addEventListener('keydown', function (e) {
      // Don't trigger shortcuts if user is typing in an input or textarea
      var tag = e.target ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        if (shortcutsModal && shortcutsModal.style.display !== 'none') {
          closeShortcuts();
        } else {
          openShortcuts();
        }
      } else if (e.key === 'Escape') {
        closeShortcuts();
      } else if (e.code === 'Space') {
        // Space plays / pauses preview if on settings subview
        var subview = document.getElementById('studio-settings-subview');
        if (subview && subview.getAttribute('aria-hidden') === 'false') {
          e.preventDefault();
          togglePreviewPlay();
        }
      } else if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
        var subview2 = document.getElementById('studio-settings-subview');
        if (subview2 && subview2.getAttribute('aria-hidden') === 'false') {
          var ratioKeys = ['16:9', '9:16', '1:1', '4:5'];
          var idx = parseInt(e.key, 10) - 1;
          if (ratioKeys[idx]) {
            currentRatio = ratioKeys[idx];
            ratioCards.forEach(function (c) {
              var sel = (c.getAttribute('data-ratio') === currentRatio);
              c.classList.toggle('is-selected', sel);
              c.setAttribute('aria-checked', sel ? 'true' : 'false');
            });
            updateFrameShapePreview();
          }
        }
      } else if (e.key === 'ArrowLeft' && previewAudio && isPreviewPlaying) {
        previewAudio.currentTime = Math.max(trimStart, previewAudio.currentTime - 1.0);
      } else if (e.key === 'ArrowRight' && previewAudio && isPreviewPlaying) {
        previewAudio.currentTime = Math.min(trimEnd, previewAudio.currentTime + 1.0);
      }
    });
  }

  function initElements() {
    containerEl = document.getElementById('studio-settings-subview');
    summaryStripEl = document.getElementById('studio-settings-summary-strip');
    audioTitleEl = document.getElementById('studio-settings-audio-title');
    audioMetaEl = document.getElementById('studio-settings-audio-meta');
    styleTitleEl = document.getElementById('studio-settings-style-title');
    styleCatEl = document.getElementById('studio-settings-style-cat');
    styleThumbEl = document.getElementById('studio-settings-style-thumb');

    frameShapeBox = document.getElementById('studio-frame-shape-box');
    frameShapeImg = document.getElementById('studio-frame-shape-img');
    frameShapeWatermark = document.getElementById('studio-frame-shape-watermark');

    waveformCanvas = document.getElementById('studio-trim-waveform-canvas');
    trimSlider = document.getElementById('studio-trim-slider');
    trimActiveRegion = document.getElementById('studio-trim-active-region');
    trimMaskStart = document.getElementById('studio-trim-mask-start');
    trimMaskEnd = document.getElementById('studio-trim-mask-end');
    handleStart = document.getElementById('studio-trim-handle-start');
    handleEnd = document.getElementById('studio-trim-handle-end');
    startInput = document.getElementById('studio-trim-start-input');
    endInput = document.getElementById('studio-trim-end-input');
    durationBadge = document.getElementById('studio-trim-duration-badge');
    trimErrorEl = document.getElementById('studio-trim-error');

    estimateDurationEl = document.getElementById('studio-estimate-duration');
    estimateFilesizeEl = document.getElementById('studio-estimate-filesize');
    estimateRendertimeEl = document.getElementById('studio-estimate-rendertime');
    capabilityStatusEl = document.getElementById('studio-capability-status');
    startRenderBtn = document.getElementById('studio-start-render-btn');
  }

  function render() {
    initElements();

    var state = Store ? Store.getState() : null;
    activeAudio = state ? state.audio : null;
    activeStyle = state ? state.style : null;

    if (!activeAudio || !state.styleId) {
      console.warn('[StudioSettings] Missing audio or style in state, redirecting to styles...');
      if (Router) Router.navigate('#visualizer/styles');
      return;
    }

    trackDuration = (activeAudio && activeAudio.duration) ? activeAudio.duration : 30.0;

    var defaults = getDeviceDefaults();
    currentResolution = defaults.resolution;
    currentRatio = defaults.aspectRatio;

    trimStart = 0.0;
    trimEnd = Math.min(30.0, trackDuration);

    if (audioTitleEl) audioTitleEl.textContent = activeAudio.name;
    if (audioMetaEl) audioMetaEl.textContent = formatTime(activeAudio.duration) + ' • ' + formatBytes(activeAudio.size);

    if (styleTitleEl && activeStyle) styleTitleEl.textContent = activeStyle.name;
    if (styleCatEl && activeStyle) styleCatEl.textContent = activeStyle.categoryLabel || activeStyle.category;
    if (styleThumbEl && activeStyle) {
      styleThumbEl.src = activeStyle.thumb;
      styleThumbEl.alt = activeStyle.name + ' thumbnail';
    }

    ratioCards = Array.from(document.querySelectorAll('.studio-ratio-card'));
    ratioCards.forEach(function (card) {
      var r = card.getAttribute('data-ratio');
      var isSupported = !activeStyle || !activeStyle.ratios || activeStyle.ratios.indexOf(r) !== -1;
      card.classList.toggle('is-disabled', !isSupported);
      var isSel = (r === currentRatio && isSupported);
      card.classList.toggle('is-selected', isSel);
      card.setAttribute('aria-checked', isSel ? 'true' : 'false');
    });

    resCards = Array.from(document.querySelectorAll('.studio-res-card'));
    resCards.forEach(function (card) {
      var res = card.getAttribute('data-res');
      var isSel = (res === currentResolution);
      card.classList.toggle('is-selected', isSel);
      card.setAttribute('aria-checked', isSel ? 'true' : 'false');
    });

    var cap = checkBrowserCapability();
    if (capabilityStatusEl) {
      capabilityStatusEl.innerHTML =
        '<div class="studio-capability-pill ' + (cap.supported ? 'is-supported' : 'is-warning') + '">' +
          '<span class="studio-cap-dot"></span>' +
          '<span>' + escapeHTML(cap.message) + '</span>' +
        '</div>';
    }

    renderWaveform(activeAudio.waveform || []);

    bindTrimDragging();
    bindInputs();
    bindOptions();
    bindCustomizationControls();
    bindLyricsControls();
    bindKeyboardShortcuts();
    setupLivePreview();

    updateFrameShapePreview();
    updateTrimUI();
  }

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    render: render,
    setTrimRange: setTrimRange,
    getDeviceDefaults: getDeviceDefaults,
    checkBrowserCapability: checkBrowserCapability,
    getSettings: function () {
      return {
        aspectRatio: currentRatio,
        resolution: currentResolution,
        trimStart: trimStart,
        trimEnd: trimEnd,
        duration: Math.max(0, trimEnd - trimStart),
        customParams: Customization ? Customization.getParams() : {}
      };
    }
  };
});
