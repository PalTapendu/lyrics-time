/**
 * SYNCLINES — Audio Visualizer Studio Render & Result Controller
 * studio/render.js
 *
 * Implements:
 * 1. RenderJob common interface and DemoRenderJob simulator with realistic 5-stage progression
 * 2. Processing Screen controller: progress bar, smoothed ETA, Screen Wake Lock, beforeunload guard,
 *    visibilitychange alerts, double-start prevention, and accessible polite announcements.
 * 3. Error recovery screen with ?simulate=error support, retry, settings return, and privacy-safe diagnostics copy.
 * 4. Result Screen controller: 60fps animated canvas preview, honest demo mode notices,
 *    conditional Web Share API, and navigation handoffs.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioRender = factory(
      root.StudioConfig || (typeof window !== 'undefined' ? window.StudioConfig : null),
      root.StudioStore || (typeof window !== 'undefined' ? window.StudioStore : null),
      root.StudioStorage || (typeof window !== 'undefined' ? window.StudioStorage : null),
      root.StudioUI || (typeof window !== 'undefined' ? window.StudioUI : null),
      root.StudioRouter || (typeof window !== 'undefined' ? window.StudioRouter : null)
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (
  Config,
  Store,
  Storage,
  UI,
  Router
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

  // ----------------------------------------------------------------------
  // 1. DemoRenderJob Implementation (Conforms to RenderJob Interface)
  // ----------------------------------------------------------------------
  var STAGES = [
    { id: 'analyze', name: 'Analyzing audio spectrum & beat onsets...', minPct: 0, maxPct: 15, label: 'Stage 1 of 5' },
    { id: 'prepare', name: 'Preparing visualizer composition & layout...', minPct: 15, maxPct: 35, label: 'Stage 2 of 5' },
    { id: 'render', name: 'Rendering dynamic motion graphics frames...', minPct: 35, maxPct: 75, label: 'Stage 3 of 5' },
    { id: 'encode', name: 'Encoding MP4 video stream (H.264/AAC)...', minPct: 75, maxPct: 95, label: 'Stage 4 of 5' },
    { id: 'finalize', name: 'Finalizing client-side video file...', minPct: 95, maxPct: 100, label: 'Stage 5 of 5' }
  ];

  function DemoRenderJob() {
    var isRunning = false;
    var isCancelled = false;
    var timerId = null;
    var startTime = 0;
    var params = null;
    var onProgressCb = null;
    var onCompleteCb = null;
    var onErrorCb = null;
    var lastPercent = 0;

    function getStageInfo(pct) {
      for (var i = 0; i < STAGES.length; i++) {
        if (pct >= STAGES[i].minPct && (pct < STAGES[i].maxPct || i === STAGES.length - 1)) {
          return STAGES[i];
        }
      }
      return STAGES[0];
    }

    function start(jobParams, onProgress, onComplete, onError) {
      if (isRunning) return;
      isRunning = true;
      isCancelled = false;
      params = jobParams || {};
      onProgressCb = onProgress;
      onCompleteCb = onComplete;
      onErrorCb = onError;
      startTime = Date.now();
      lastPercent = 0;

      // Realistic simulated total render duration (between 4 and 8 seconds for responsive demo)
      var targetDurationSec = (params.duration && params.duration > 0) ? params.duration : 15.0;
      var totalSimulatedMs = Math.min(8000, Math.max(4500, Math.round(targetDurationSec * 160)));

      // Check simulate=error flag
      var simulateError = false;
      if (params.simulateError) {
        simulateError = true;
      } else if (typeof window !== 'undefined' && window.location && window.location.search) {
        simulateError = window.location.search.indexOf('simulate=error') !== -1;
      }

      function tick() {
        if (isCancelled || !isRunning) return;

        var elapsedMs = Date.now() - startTime;
        var progressFraction = Math.min(1.0, elapsedMs / totalSimulatedMs);
        var currentPct = Math.min(100, Math.round(progressFraction * 100));

        // Error simulation trigger at ~45%
        if (simulateError && currentPct >= 45) {
          isRunning = false;
          if (onErrorCb) {
            onErrorCb({
              code: 'RENDER_ENCODE_CRASH',
              message: 'Simulated encoding failure: VideoEncoder hardware pipeline interrupted (?simulate=error).'
            });
          }
          return;
        }

        var stageInfo = getStageInfo(currentPct);

        if (onProgressCb && currentPct !== lastPercent) {
          lastPercent = currentPct;
          var elapsedSec = Math.floor(elapsedMs / 1000);
          var etaSec = currentPct >= 100 ? 0 : Math.max(1, Math.round(((100 - currentPct) / Math.max(1, currentPct)) * elapsedSec));

          onProgressCb({
            percent: currentPct,
            stageId: stageInfo.id,
            stageLabel: stageInfo.label,
            stageName: stageInfo.name,
            elapsedSec: elapsedSec,
            etaSec: etaSec
          });
        }

        if (currentPct >= 100) {
          isRunning = false;
          if (onCompleteCb) {
            onCompleteCb({
              isDemo: true,
              duration: targetDurationSec,
              resolution: params.resolution || '1080p',
              aspectRatio: params.aspectRatio || '16:9',
              styleId: params.styleId,
              timestamp: Date.now()
            });
          }
        } else {
          timerId = setTimeout(tick, 80);
        }
      }

      timerId = setTimeout(tick, 50);
    }

    function cancel() {
      isCancelled = true;
      isRunning = false;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    }

    return {
      start: start,
      cancel: cancel,
      isRunning: function () { return isRunning; },
      isCancelled: function () { return isCancelled; }
    };
  }

  // ----------------------------------------------------------------------
  // 2. Hardware Wake Lock & Visibility Handlers
  // ----------------------------------------------------------------------
  var wakeLockSentinel = null;

  function acquireWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && navigator.wakeLock.request) {
      try {
        navigator.wakeLock.request('screen').then(function (lock) {
          wakeLockSentinel = lock;
          lock.addEventListener('release', function () {
            wakeLockSentinel = null;
          });
        }).catch(function (err) {
          // Non-critical, continue gracefully
          console.warn('[StudioRender] WakeLock request denied:', err);
        });
      } catch (e) {}
    }
  }

  function releaseWakeLock() {
    if (wakeLockSentinel) {
      try {
        wakeLockSentinel.release();
      } catch (e) {}
      wakeLockSentinel = null;
    }
  }

  function handleBeforeUnload(e) {
    e.preventDefault();
    e.returnValue = 'A video render is currently in progress. If you leave, your render will be lost.';
    return e.returnValue;
  }

  function attachBeforeUnload() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
  }

  function detachBeforeUnload() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }

  // ----------------------------------------------------------------------
  // 3. Processing Screen State & Controller
  // ----------------------------------------------------------------------
  var currentJob = null;
  var lastAnnouncedPercent = -1;
  var lastAnnouncedStage = '';
  var previewCanvasLoopId = null;
  var lastRenderError = null;

  // DOM references for Processing Sub-View
  var renderCardEl = null;
  var renderErrorCardEl = null;
  var progressBarEl = null;
  var percentEl = null;
  var stageBadgeEl = null;
  var stageNameEl = null;
  var elapsedEl = null;
  var etaEl = null;
  var announcerEl = null;
  var visibilityNoticeEl = null;
  var previewCanvasEl = null;

  function initProcessingElements() {
    renderCardEl = document.getElementById('studio-render-card');
    renderErrorCardEl = document.getElementById('studio-render-error-card');
    progressBarEl = document.getElementById('studio-render-progress-bar');
    percentEl = document.getElementById('studio-render-percent');
    stageBadgeEl = document.getElementById('studio-render-stage-badge');
    stageNameEl = document.getElementById('studio-render-stage-name');
    elapsedEl = document.getElementById('studio-render-elapsed');
    etaEl = document.getElementById('studio-render-eta');
    announcerEl = document.getElementById('studio-render-announcer');
    visibilityNoticeEl = document.getElementById('studio-render-visibility-notice');
    previewCanvasEl = document.getElementById('studio-render-preview-canvas');
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '00:00';
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  function handleVisibilityChange() {
    if (document.hidden && currentJob && currentJob.isRunning()) {
      if (visibilityNoticeEl) {
        visibilityNoticeEl.style.display = 'flex';
      }
    }
  }

  function startPreviewAnimation(style) {
    if (!previewCanvasEl) return;
    var ctx = previewCanvasEl.getContext('2d');
    var w = previewCanvasEl.width;
    var h = previewCanvasEl.height;
    var frame = 0;

    var pColor = (style && style.palette && style.palette.primary) || '#00ffb0';
    var aColor = (style && style.palette && style.palette.accent) || '#e2b34a';

    function loop() {
      ctx.clearRect(0, 0, w, h);

      // Dark subtle grid backdrop
      ctx.fillStyle = '#060a0d';
      ctx.fillRect(0, 0, w, h);

      var numBars = 32;
      var barW = (w / numBars) - 2;

      for (var i = 0; i < numBars; i++) {
        var wave = Math.sin((i * 0.3) + (frame * 0.08)) * 0.5 + 0.5;
        var barH = Math.max(6, wave * (h * 0.7));
        var x = i * (barW + 2);
        var y = (h - barH) / 2;

        var grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, pColor);
        grad.addColorStop(1, aColor);

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, barH);
      }

      frame++;
      previewCanvasLoopId = requestAnimationFrame(loop);
    }

    if (previewCanvasLoopId) {
      cancelAnimationFrame(previewCanvasLoopId);
    }
    previewCanvasLoopId = requestAnimationFrame(loop);
  }

  function stopPreviewAnimation() {
    if (previewCanvasLoopId) {
      cancelAnimationFrame(previewCanvasLoopId);
      previewCanvasLoopId = null;
    }
  }

  function renderProcessing() {
    initProcessingElements();

    var state = Store ? Store.getState() : null;
    var audio = state ? state.audio : null;
    var styleId = state ? state.styleId : null;
    var settings = state ? state.settings : null;

    // Route guard check
    if (!audio || !styleId) {
      console.warn('[StudioRender] Missing audio or style, redirecting...');
      if (Router) Router.navigate('#visualizer/styles');
      return;
    }

    // Double-start check
    if (currentJob && currentJob.isRunning()) {
      return;
    }

    // Reset error card visibility
    if (renderErrorCardEl) renderErrorCardEl.style.display = 'none';
    if (renderCardEl) renderCardEl.style.display = 'block';
    if (visibilityNoticeEl) visibilityNoticeEl.style.display = 'none';

    // Reset progress UI
    if (progressBarEl) {
      progressBarEl.style.width = '0%';
      progressBarEl.setAttribute('aria-valuenow', '0');
    }
    if (percentEl) percentEl.textContent = '0%';
    if (stageBadgeEl) stageBadgeEl.textContent = STAGES[0].label;
    if (stageNameEl) stageNameEl.textContent = STAGES[0].name;
    if (elapsedEl) elapsedEl.textContent = '00:00';
    if (etaEl) etaEl.textContent = 'Calculating...';

    lastAnnouncedPercent = -1;
    lastAnnouncedStage = '';

    // Dispatch RENDER_STARTED into Store
    if (Store) {
      Store.dispatch({ type: 'RENDER_STARTED' });
    }

    // Acquire wake lock & beforeunload protection
    acquireWakeLock();
    attachBeforeUnload();

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Start animated preview canvas
    startPreviewAnimation(state ? state.style : null);

    // Cancel button binding
    var cancelBtn = document.getElementById('studio-render-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = function () {
        if (!currentJob || !currentJob.isRunning()) return;

        if (UI && UI.showConfirm) {
          UI.showConfirm('Cancel video render? Your current progress will be lost.', function (confirmed) {
            if (confirmed) {
              abortRender('cancelled');
            }
          });
        } else {
          if (confirm('Cancel video render? Your current progress will be lost.')) {
            abortRender('cancelled');
          }
        }
      };
    }

    // Bind Error card action buttons
    bindErrorActions();

    // Instantiate and start Job
    var useRealEngine = false;
    if (Config && typeof Config.isDemoMode === 'function') {
      useRealEngine = !Config.isDemoMode();
    } else if (Config && !Config.demoMode) {
      useRealEngine = true;
    } else if (typeof window !== 'undefined' && window.location && window.location.search) {
      if (window.location.search.indexOf('engine=real') !== -1) {
        useRealEngine = true;
      }
    }

    var exportMod = (typeof window !== 'undefined' && window.StudioExportEngine) || null;
    if (useRealEngine && exportMod && exportMod.RealRenderJob) {
      currentJob = new exportMod.RealRenderJob();
    } else {
      currentJob = new DemoRenderJob();
    }

    var jobParams = {
      duration: (settings && settings.duration) ? settings.duration : (audio ? audio.duration : 15.0),
      resolution: (settings && settings.resolution) ? settings.resolution : '1080p',
      aspectRatio: (settings && settings.aspectRatio) ? settings.aspectRatio : '16:9',
      trimStart: (settings && settings.trimStart !== undefined) ? settings.trimStart : 0.0,
      trimEnd: (settings && settings.trimEnd !== undefined) ? settings.trimEnd : (audio ? audio.duration : 15.0),
      styleId: styleId,
      audio: audio,
      styleParams: (settings && settings.customParams) ? settings.customParams : null
    };

    currentJob.start(
      jobParams,
      // onProgress
      function (progressData) {
        if (progressBarEl) {
          progressBarEl.style.width = progressData.percent + '%';
          progressBarEl.setAttribute('aria-valuenow', String(progressData.percent));
        }
        if (percentEl) percentEl.textContent = progressData.percent + '%';
        if (stageBadgeEl) stageBadgeEl.textContent = progressData.stageLabel;
        if (stageNameEl) stageNameEl.textContent = progressData.stageName;
        if (elapsedEl) elapsedEl.textContent = formatTime(progressData.elapsedSec);
        if (etaEl) etaEl.textContent = '~' + formatTime(progressData.etaSec);

        // Screen reader announcement: stage change OR every 10%
        var shouldAnnounceStage = (progressData.stageId !== lastAnnouncedStage);
        var roundedTen = Math.floor(progressData.percent / 10) * 10;
        var shouldAnnounceTen = (roundedTen > lastAnnouncedPercent && roundedTen % 10 === 0);

        if (announcerEl && (shouldAnnounceStage || shouldAnnounceTen)) {
          if (shouldAnnounceStage) {
            lastAnnouncedStage = progressData.stageId;
            announcerEl.textContent = progressData.stageName + ' (' + progressData.percent + ' percent complete)';
          } else if (shouldAnnounceTen) {
            lastAnnouncedPercent = roundedTen;
            announcerEl.textContent = 'Rendering ' + roundedTen + ' percent complete.';
          }
        }

        // Store progress
        if (Store) {
          Store.dispatch({
            type: 'RENDER_PROGRESS',
            payload: {
              progress: progressData.percent,
              stage: progressData.stageId
            }
          });
        }
      },
      // onComplete
      function (resultData) {
        cleanupRenderResources();

        if (Store) {
          Store.dispatch({
            type: 'RENDER_COMPLETED',
            payload: {
              resultBlob: resultData.blob || {
                isDemo: resultData.isDemo !== false,
                duration: resultData.duration,
                resolution: resultData.resolution,
                aspectRatio: resultData.aspectRatio,
                styleId: resultData.styleId
              },
              videoUrl: resultData.videoUrl,
              filename: resultData.filename,
              sizeBytes: resultData.sizeBytes
            }
          });
        }

        if (Router) {
          Router.navigate('#visualizer/result');
        }
      },
      // onError
      function (errorData) {
        cleanupRenderResources();
        lastRenderError = errorData;

        if (Store) {
          Store.dispatch({
            type: 'RENDER_FAILED',
            payload: {
              code: errorData.code,
              message: errorData.message
            }
          });
        }

        showErrorScreen(errorData);
      }
    );
  }

  function abortRender(reason) {
    if (currentJob) {
      currentJob.cancel();
      currentJob = null;
    }
    cleanupRenderResources();

    if (Store) {
      Store.dispatch({ type: 'RENDER_CANCELLED' });
    }

    if (Router) {
      Router.navigate('#visualizer/settings');
    }
  }

  function cleanupRenderResources() {
    stopPreviewAnimation();
    releaseWakeLock();
    detachBeforeUnload();

    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  function showErrorScreen(errorData) {
    if (renderCardEl) renderCardEl.style.display = 'none';
    if (renderErrorCardEl) {
      renderErrorCardEl.style.display = 'block';
      var descEl = document.getElementById('studio-render-error-desc');
      if (descEl) {
        descEl.textContent = errorData.message || 'An error occurred during video generation.';
      }
    }
  }

  function bindErrorActions() {
    var retryBtn = document.getElementById('studio-render-retry-btn');
    if (retryBtn) {
      retryBtn.onclick = function () {
        if (Store) Store.dispatch({ type: 'RETRY_RENDER' });
        renderProcessing();
      };
    }

    var backSettingsBtn = document.getElementById('studio-render-back-settings-btn');
    if (backSettingsBtn) {
      backSettingsBtn.onclick = function () {
        if (Store) Store.dispatch({ type: 'RETURN_TO_SETTINGS' });
        if (Router) Router.navigate('#visualizer/settings');
      };
    }

    var startOverBtn = document.getElementById('studio-render-start-over-btn');
    if (startOverBtn) {
      startOverBtn.onclick = function () {
        if (Store) Store.dispatch({ type: 'RESET_ALL' });
        if (Router) Router.navigate('#visualizer');
      };
    }

    var copyDiagBtn = document.getElementById('studio-render-copy-diag-btn');
    if (copyDiagBtn) {
      copyDiagBtn.onclick = function () {
        copyDiagnostics();
      };
    }
  }

  function copyDiagnostics() {
    var diag = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      screen: typeof window !== 'undefined' && window.screen ? {
        width: window.screen.width,
        height: window.screen.height,
        dpr: window.devicePixelRatio || 1
      } : {},
      hardware: {
        concurrency: typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 'unknown') : 'unknown',
        deviceMemory: typeof navigator !== 'undefined' ? (navigator.deviceMemory || 'unknown') : 'unknown'
      },
      capabilities: {
        webCodecsVideo: typeof VideoEncoder !== 'undefined',
        webCodecsAudio: typeof AudioEncoder !== 'undefined',
        mediaRecorder: typeof MediaRecorder !== 'undefined',
        canvasCapture: typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream !== 'undefined',
        wakeLock: typeof navigator !== 'undefined' && 'wakeLock' in navigator
      },
      error: lastRenderError || { code: 'SIMULATED_TEST_ERROR', message: 'Manual diagnostics export' },
      studioConfig: {
        demoMode: Config ? Config.demoMode : true,
        version: Config ? Config.version : '1.0.0'
      }
    };

    var diagStr = JSON.stringify(diag, null, 2);

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(diagStr).then(function () {
        if (UI && UI.showToast) {
          UI.showToast('Diagnostics copied to clipboard (no audio data included).', 'success');
        } else {
          alert('Diagnostics copied to clipboard.');
        }
      }).catch(function () {
        fallbackCopyText(diagStr);
      });
    } else {
      fallbackCopyText(diagStr);
    }
  }

  function fallbackCopyText(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (UI && UI.showToast) {
        UI.showToast('Diagnostics copied to clipboard.', 'success');
      }
    } catch (e) {
      if (UI && UI.showToast) {
        UI.showToast('Could not access clipboard.', 'warning');
      }
    }
  }

  // ----------------------------------------------------------------------
  // 4. Result Screen State & Controller
  // ----------------------------------------------------------------------
  var resultCanvasLoopId = null;
  var isResultPlaying = true;

  function renderResult() {
    var state = Store ? Store.getState() : null;
    var audio = state ? state.audio : null;
    var style = state ? state.style : null;
    var settings = state ? state.settings : null;
    var resultBlob = state ? state.resultBlob : null;

    if (!resultBlob && (!state || state.status !== 'done')) {
      console.warn('[StudioRender] No completed render result found, redirecting to landing...');
      if (Router) Router.navigate('#visualizer');
      return;
    }

    // Populate Metadata strip
    var metaStyleEl = document.getElementById('studio-result-meta-style');
    var metaResEl = document.getElementById('studio-result-meta-res');
    var metaRatioEl = document.getElementById('studio-result-meta-ratio');
    var metaDurEl = document.getElementById('studio-result-meta-dur');

    if (metaStyleEl) metaStyleEl.textContent = style ? style.name : 'Custom Visualizer';
    if (metaResEl) metaResEl.textContent = (settings && settings.resolution === '720p') ? '720p Standard HD' : '1080p Full HD';
    if (metaRatioEl) metaRatioEl.textContent = settings ? settings.aspectRatio : '16:9';
    if (metaDurEl) metaDurEl.textContent = formatTime((settings && settings.duration) ? settings.duration : 15);

    // Bind Result Action Buttons
    var downloadBtn = document.getElementById('studio-result-download-btn');
    var demoNoticeEl = document.getElementById('studio-download-demo-notice');
    var isRealBlob = (resultBlob && typeof resultBlob.slice === 'function' && resultBlob.size > 0);

    if (downloadBtn) {
      if (isRealBlob) {
        // Real MP4 Export Produced!
        downloadBtn.disabled = false;
        if (demoNoticeEl) demoNoticeEl.style.display = 'none';
        downloadBtn.onclick = function () {
          var exportEngine = (typeof window !== 'undefined' && window.StudioExportEngine) || null;
          if (exportEngine && typeof exportEngine.triggerDownload === 'function') {
            exportEngine.triggerDownload(resultBlob, (state && state.filename) || 'synclines-visualizer.mp4');
          } else {
            var url = URL.createObjectURL(resultBlob);
            var a = document.createElement('a');
            a.href = url;
            a.download = (state && state.filename) || 'synclines-visualizer.mp4';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
          }
        };
      } else if (Config && Config.demoMode) {
        downloadBtn.disabled = true;
        downloadBtn.onclick = function () {
          if (UI && UI.showToast) {
            UI.showToast('Demo preview mode active. MP4 export unlocks when enabled.', 'info');
          }
        };
      } else {
        downloadBtn.disabled = false;
      }
    }

    var shareBtn = document.getElementById('studio-result-share-btn');
    if (shareBtn) {
      if (typeof navigator !== 'undefined' && navigator.share) {
        shareBtn.style.display = 'inline-flex';
        shareBtn.onclick = function () {
          navigator.share({
            title: 'SyncLines Audio Visualizer',
            text: 'Check out my client-side audio visualizer created with SyncLines Studio!',
            url: window.location.href
          }).catch(function () {});
        };
      } else {
        shareBtn.style.display = 'none';
      }
    }

    var tryStyleBtn = document.getElementById('studio-result-try-style-btn');
    if (tryStyleBtn) {
      tryStyleBtn.onclick = function () {
        if (Store) Store.dispatch({ type: 'TRY_ANOTHER_STYLE' });
        if (Router) Router.navigate('#visualizer/styles');
      };
    }

    var changeSettingsBtn = document.getElementById('studio-result-change-settings-btn');
    if (changeSettingsBtn) {
      changeSettingsBtn.onclick = function () {
        if (Store) Store.dispatch({ type: 'RETURN_TO_SETTINGS' });
        if (Router) Router.navigate('#visualizer/settings');
      };
    }

    var startOverBtn = document.getElementById('studio-result-start-over-btn');
    if (startOverBtn) {
      startOverBtn.onclick = function () {
        if (Store) Store.dispatch({ type: 'RESET_ALL' });
        if (Router) Router.navigate('#visualizer');
      };
    }

    // Playback toggle button on preview canvas
    var playbackBtn = document.getElementById('studio-result-playback-btn');
    var playIcon = document.getElementById('studio-result-play-icon');
    if (playbackBtn) {
      playbackBtn.onclick = function () {
        isResultPlaying = !isResultPlaying;
        if (playIcon) {
          playIcon.textContent = isResultPlaying ? '⏸' : '▶';
        }
      };
    }

    // Start 60fps result canvas demo loop
    startResultCanvasAnimation(style, settings ? settings.aspectRatio : '16:9', settings ? settings.customParams : null);
  }

  function startResultCanvasAnimation(style, ratio, customParams) {
    var canvas = document.getElementById('studio-result-demo-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var frame = 0;

    var pColor = (customParams && customParams.primaryColor) || (style && style.palette && style.palette.primary) || '#00ffb0';
    var aColor = (customParams && customParams.accentColor) || (style && style.palette && style.palette.accent) || '#e2b34a';

    // Adjust canvas aspect ratio container
    var container = document.getElementById('studio-result-preview-container');
    if (container) {
      var ratioMap = { '16:9': '16 / 9', '9:16': '9 / 16', '1:1': '1 / 1', '4:5': '4 / 5' };
      container.style.aspectRatio = ratioMap[ratio] || '16 / 9';
    }

    var renderer = (typeof window !== 'undefined' && window.StudioRenderer) || null;

    function loop() {
      if (isResultPlaying) {
        var w = canvas.width;
        var h = canvas.height;

        if (renderer && typeof renderer.renderFrameAt === 'function') {
          var t = (frame % 900) * (1.0 / 30.0);
          renderer.renderFrameAt(t, ctx, w, h, (style ? style.id : 'classic-bars'), customParams);
        } else {
          ctx.clearRect(0, 0, w, h);

        // Gradient dark background
        var bgGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.7);
        bgGrad.addColorStop(0, '#0a1419');
        bgGrad.addColorStop(1, '#040709');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Center dynamic audio visualizer ring & spectrum
        var cx = w / 2;
        var cy = h / 2;
        var baseR = Math.min(w, h) * 0.22;
        var numPoints = 48;

        ctx.beginPath();
        for (var i = 0; i < numPoints; i++) {
          var angle = (i / numPoints) * Math.PI * 2;
          var wave = Math.sin(i * 3 + frame * 0.06) * Math.cos(frame * 0.04);
          var r = baseR + (wave * 28);
          var x = cx + Math.cos(angle) * r;
          var y = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        ctx.strokeStyle = pColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = pColor;
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Radiating energy particles
        for (var p = 0; p < 8; p++) {
          var pAngle = (p / 8) * Math.PI * 2 + (frame * 0.02);
          var pDist = baseR + 40 + (Math.sin(frame * 0.08 + p) * 20);
          var px = cx + Math.cos(pAngle) * pDist;
          var py = cy + Math.sin(pAngle) * pDist;
          ctx.fillStyle = aColor;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        }

        frame++;
      }

      resultCanvasLoopId = requestAnimationFrame(loop);
    }

    if (resultCanvasLoopId) {
      cancelAnimationFrame(resultCanvasLoopId);
    }
    resultCanvasLoopId = requestAnimationFrame(loop);
  }

  function stopResultCanvasAnimation() {
    if (resultCanvasLoopId) {
      cancelAnimationFrame(resultCanvasLoopId);
      resultCanvasLoopId = null;
    }
  }

  return {
    DemoRenderJob: DemoRenderJob,
    renderProcessing: renderProcessing,
    renderResult: renderResult,
    abortRender: abortRender,
    copyDiagnostics: copyDiagnostics,
    stopResultAnimation: stopResultCanvasAnimation
  };
});
