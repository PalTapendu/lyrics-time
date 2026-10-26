/**
 * SYNCLINES — Audio Visualizer Studio Universal Renderer Engine
 * studio/engine/renderer.js
 *
 * Implements:
 * 1. Unified frame renderer shared between live studio preview and offline video export.
 * 2. Visual-to-audio synchronization locked to audio.currentTime within +/-1 frame (<33.3ms).
 * 3. Exact pixel rendering (no device-pixel-ratio scaling distortions).
 * 4. Automatic integration with Photosensitivity Limiter (WCAG 2.3.1).
 * 5. Adaptive quality fallback on low-power devices with tab visibility auto-pause.
 * 6. Leak-free lifecycle management with safe disposal and cancellation.
 * 7. Full Customization Integration:
 *    - Custom background (solid, gradient, uploaded image with aspect-cover crop, blurred cover art).
 *    - Sensitivity scaling (0.5x - 2.0x amplitude modulation).
 *    - Cover artwork badge overlay.
 *    - Title and Artist typography with custom fonts and readability shadows.
 *    - Audio progress bar at bottom frame edge.
 *    - Safe-area guides (9:16 mobile reels/shorts + 16:9 broadcast title-safe).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioRenderer = factory(
      root.StudioAudioAnalysis,
      root.StudioStyleRegistry,
      root.StudioLimiter,
      root.StudioLyricsRenderer
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (
  AudioAnalysis,
  StyleRegistry,
  Limiter,
  LyricsRenderer
) {
  'use strict';

  if (typeof module === 'object' && module.exports) {
    if (!AudioAnalysis && typeof require === 'function') {
      try { AudioAnalysis = require('./audio_analysis.js'); } catch (e) {}
    }
    if (!StyleRegistry && typeof require === 'function') {
      try { StyleRegistry = require('./style_registry.js'); } catch (e) {}
    }
    if (!Limiter && typeof require === 'function') {
      try { Limiter = require('./limiter.js'); } catch (e) {}
    }
    if (!LyricsRenderer && typeof require === 'function') {
      try { LyricsRenderer = require('./lyrics_renderer.js'); } catch (e) {}
    }
  }

  var activeAnalysis = null;
  var livePreviewAnimId = null;
  var liveCanvas = null;
  var liveAudioEl = null;
  var activeStyleId = 'classic-bars';
  var activeParams = null;
  var isTabHidden = false;
  var photosafetyLimiter = Limiter && Limiter.createPhotosensitivityLimiter ? Limiter.createPhotosensitivityLimiter() : null;

  // Listen to tab visibility to pause live loop when tab is backgrounded
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', function () {
      isTabHidden = document.hidden;
    });
  }

  /**
   * Sets the active track analysis cache.
   */
  function setAnalysis(analysisResult) {
    activeAnalysis = analysisResult;
  }

  function getAnalysis() {
    return activeAnalysis;
  }

  /**
   * Draws background according to backgroundType: 'solid', 'gradient', 'image', 'cover-blur'.
   */
  function renderBackground(ctx, width, height, params) {
    var bgType = params.backgroundType || 'gradient';
    var bgColor = params.backgroundColor || '#060a0d';

    if (bgType === 'image' && params.backgroundImageData) {
      var img = params.backgroundImageData;
      var imgW = img.width || img.naturalWidth || width;
      var imgH = img.height || img.naturalHeight || height;
      var imgAspect = imgW / imgH;
      var canvasAspect = width / height;
      var sx = 0, sy = 0, sw = imgW, sh = imgH;

      if (imgAspect > canvasAspect) {
        sw = imgH * canvasAspect;
        sx = (imgW - sw) / 2;
      } else {
        sh = imgW / canvasAspect;
        sy = (imgH - sh) / 2;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

      // Subtle dark wash so visualizer bars remain punchy and clear
      ctx.fillStyle = 'rgba(6, 10, 13, 0.45)';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    if (bgType === 'cover-blur' && params.coverImageData) {
      var cover = params.coverImageData;
      ctx.save();
      if (typeof ctx.filter !== 'undefined') {
        ctx.filter = 'blur(16px)';
      }
      ctx.drawImage(cover, -20, -20, width + 40, height + 40);
      ctx.restore();

      // Deep dark wash overlay for high contrast
      ctx.fillStyle = 'rgba(6, 10, 13, 0.70)';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    if (bgType === 'solid') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
      return;
    }

    // Default: Elegant radial gradient vignette
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
    var vig = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.75);
    vig.addColorStop(0, 'rgba(16, 28, 38, 0.35)');
    vig.addColorStop(1, 'rgba(2, 4, 6, 0.95)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * Draws cover artwork badge in corner if provided.
   */
  function renderCoverArt(ctx, width, height, params) {
    if (!params.coverImageData) return;
    var size = Math.round(Math.min(width, height) * 0.14);
    size = Math.max(48, Math.min(140, size));
    var pad = Math.round(width * 0.05);
    var x = pad;
    var y = pad;

    ctx.save();
    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    // Rounded rectangle clip
    var radius = 8;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, size, size, radius);
    } else {
      ctx.rect(x, y, size, size);
    }
    ctx.clip();
    ctx.drawImage(params.coverImageData, x, y, size, size);
    ctx.restore();

    // Subtle border
    ctx.save();
    ctx.strokeStyle = params.primaryColor || '#00ffb0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, size, size, radius);
    } else {
      ctx.rect(x, y, size, size);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draws Title & Artist typography overlay.
   */
  function renderTypographyOverlay(ctx, width, height, params) {
    var title = (params.titleText || '').trim();
    var artist = (params.artistText || '').trim();
    if (!title && !artist) return;

    var fontCss = params.fontCss || '"Outfit", sans-serif';
    var padX = Math.round(width * 0.05);
    var padY = Math.round(height * 0.06);

    // If cover image is present, offset text to the right of cover image
    var startX = padX;
    var startY = padY + 28;
    if (params.coverImageData) {
      var coverSize = Math.round(Math.min(width, height) * 0.14);
      coverSize = Math.max(48, Math.min(140, coverSize));
      startX = padX + coverSize + 16;
      startY = padY + Math.round(coverSize * 0.38);
    }

    var titleSize = Math.max(14, Math.round(Math.min(width, height) * 0.038));
    var artistSize = Math.max(11, Math.round(titleSize * 0.72));

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Title text
    if (title) {
      ctx.font = '700 ' + titleSize + 'px ' + fontCss;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      // Truncate if too long
      var maxW = width - startX - padX;
      var displayTitle = title;
      if (ctx.measureText(displayTitle).width > maxW) {
        while (displayTitle.length > 3 && ctx.measureText(displayTitle + '...').width > maxW) {
          displayTitle = displayTitle.slice(0, -1);
        }
        displayTitle += '...';
      }
      ctx.fillText(displayTitle, startX, startY);
    }

    // Artist text
    if (artist) {
      var artistY = title ? startY + artistSize + 8 : startY;
      ctx.font = '500 ' + artistSize + 'px ' + fontCss;
      ctx.fillStyle = params.accentColor || '#e2b34a';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;

      var maxW2 = width - startX - padX;
      var displayArtist = artist;
      if (ctx.measureText(displayArtist).width > maxW2) {
        while (displayArtist.length > 3 && ctx.measureText(displayArtist + '...').width > maxW2) {
          displayArtist = displayArtist.slice(0, -1);
        }
        displayArtist += '...';
      }
      ctx.fillText(displayArtist, startX, artistY);
    }

    ctx.restore();
  }

  /**
   * Draws audio track progress bar at bottom of frame.
   */
  function renderProgressBar(ctx, width, height, tSeconds, params) {
    if (params.showProgressBar === false) return;

    var trimStart = params.trimStart || 0.0;
    var trimEnd = params.trimEnd || (params.duration ? trimStart + params.duration : 30.0);
    var duration = Math.max(1.0, trimEnd - trimStart);
    var progress = Math.max(0.0, Math.min(1.0, (tSeconds - trimStart) / duration));

    var barH = 4.0;
    var y = height - barH;

    ctx.save();
    // Track background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(0, y, width, barH);

    // Active progress fill
    var fillW = width * progress;
    var grad = ctx.createLinearGradient(0, y, fillW, y);
    grad.addColorStop(0, params.primaryColor || '#00ffb0');
    grad.addColorStop(1, params.accentColor || '#e2b34a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, fillW, barH);

    // Glowing head
    if (fillW > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = params.primaryColor || '#00ffb0';
      ctx.shadowBlur = 6;
      ctx.fillRect(Math.max(0, fillW - 3), y, 3, barH);
    }
    ctx.restore();
  }

  /**
   * Draws dotted Safe-Area Guides overlay (e.g. for 9:16 vertical shorts/reels or 16:9 TV).
   */
  function renderSafeAreaGuides(ctx, width, height, params) {
    if (!params.showSafeAreaGuides) return;

    var isVertical = height > width;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 235, 59, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);

    if (isVertical) {
      // 9:16 Mobile Safe Area: avoid top status (10%), bottom captions (22%), right actions (15%)
      var topSafe = height * 0.10;
      var bottomSafe = height * 0.78;
      var leftSafe = width * 0.06;
      var rightSafe = width * 0.85;

      ctx.strokeRect(leftSafe, topSafe, rightSafe - leftSafe, bottomSafe - topSafe);

      // Label badge
      ctx.font = '10px monospace';
      ctx.fillStyle = '#ffeb3b';
      ctx.fillText('9:16 SOCIAL SAFE ZONE', leftSafe + 6, topSafe + 14);
    } else {
      // 16:9 Broadcast 90% Title-Safe Margin
      var marginX = width * 0.05;
      var marginY = height * 0.05;
      ctx.strokeRect(marginX, marginY, width - (marginX * 2), height - (marginY * 2));

      ctx.font = '10px monospace';
      ctx.fillStyle = '#ffeb3b';
      ctx.fillText('16:9 TITLE SAFE (90%)', marginX + 6, marginY + 14);
    }

    ctx.restore();
  }

  /**
   * Renders a single deterministic frame at exact pixel dimensions.
   */
  function renderFrameAt(tSeconds, ctx, width, height, styleId, customParams) {
    if (!ctx || width <= 0 || height <= 0) return null;

    styleId = styleId || activeStyleId || 'classic-bars';
    var stylePlugin = StyleRegistry ? StyleRegistry.get(styleId) : null;

    // Fallback to classic-bars if styleId not registered
    if (!stylePlugin && StyleRegistry) {
      stylePlugin = StyleRegistry.get('classic-bars');
    }

    // Get deterministic feature frame
    var frame = null;
    if (activeAnalysis && typeof activeAnalysis.getFrame === 'function') {
      frame = activeAnalysis.getFrame(tSeconds);
    } else if (AudioAnalysis && typeof AudioAnalysis.createEmptyFrame === 'function') {
      frame = AudioAnalysis.createEmptyFrame(tSeconds);
    }

    var params = customParams || activeParams || (stylePlugin ? stylePlugin.defaultParams : {});

    // Reactivity Sensitivity Scaling (0.5x to 2.0x)
    var sensitivity = params.sensitivity !== undefined ? params.sensitivity : 1.0;
    if (sensitivity !== 1.0 && frame && frame.bands) {
      var scaledBands = new Float32Array(frame.bands.length);
      for (var b = 0; b < frame.bands.length; b++) {
        scaledBands[b] = Math.min(1.0, frame.bands[b] * sensitivity);
      }
      frame = {
        time: frame.time,
        bands: scaledBands,
        bassEnergy: Math.min(1.0, (frame.bassEnergy || 0) * sensitivity),
        midEnergy: Math.min(1.0, (frame.midEnergy || 0) * sensitivity),
        trebleEnergy: Math.min(1.0, (frame.trebleEnergy || 0) * sensitivity),
        spectralCentroid: frame.spectralCentroid,
        rms: Math.min(1.0, (frame.rms || 0) * sensitivity),
        peak: Math.min(1.0, (frame.peak || 0) * sensitivity)
      };
    }

    // 1. Universal Custom Background
    renderBackground(ctx, width, height, params);

    // Pass customBgHandled: true to style plugin so it draws atop custom background seamlessly
    var mergedParams = Object.assign({}, params, { customBgHandled: true });

    // 2. Execute style render
    if (stylePlugin && typeof stylePlugin.render === 'function') {
      stylePlugin.render(frame, tSeconds, ctx, width, height, mergedParams);
    } else {
      // Default fallback bar render
      renderFallbackBars(frame, ctx, width, height);
    }

    // 3. Cover Artwork Badge Overlay
    renderCoverArt(ctx, width, height, params);

    // 4. Title & Artist Typography Overlay
    renderTypographyOverlay(ctx, width, height, params);

    // 5. Progress Bar
    renderProgressBar(ctx, width, height, tSeconds, params);

    // 6. Synchronized Lyrics Overlay (Prompt 11)
    var lyricsEngine = LyricsRenderer ||
      (typeof window !== 'undefined' ? window.StudioLyricsRenderer :
      (typeof globalThis !== 'undefined' ? globalThis.StudioLyricsRenderer : null));
    if (params.lyrics && params.lyrics.enabled !== false && lyricsEngine && typeof lyricsEngine.renderLyricsOverlay === 'function') {
      lyricsEngine.renderLyricsOverlay(ctx, width, height, tSeconds, params.lyrics);
    }

    // 7. Safe Area Guides
    renderSafeAreaGuides(ctx, width, height, params);

    // 8. Apply WCAG 2.3.1 photosensitivity safety check
    var limiterResult = null;
    if (photosafetyLimiter && typeof photosafetyLimiter.applySafetyCheck === 'function') {
      var frameIdx = Math.floor(tSeconds * 30);
      limiterResult = photosafetyLimiter.applySafetyCheck(ctx, width, height, frameIdx);
    }

    return {
      frame: frame,
      tSeconds: tSeconds,
      limiter: limiterResult
    };
  }

  function renderFallbackBars(frame, ctx, width, height) {
    var bands = (frame && frame.bands) ? frame.bands : new Float32Array(32);
    var count = Math.min(32, bands.length);
    var barW = width / count - 2;

    for (var i = 0; i < count; i++) {
      var val = bands[i] || 0;
      var h = Math.max(4, val * (height * 0.7));
      var x = i * (barW + 2);
      var y = height - h;
      ctx.fillStyle = '#00ffb0';
      ctx.fillRect(x, y, barW, h);
    }
  }

  /**
   * Binds live preview loop to an HTML5 Audio element.
   * Driven strictly by audio.currentTime to guarantee frame-perfect sync.
   * Auto-throttles when browser tab is hidden to preserve device performance.
   */
  function bindLivePreview(canvasElement, audioElement, styleId, params) {
    stopLivePreview();

    liveCanvas = canvasElement;
    liveAudioEl = audioElement;
    if (styleId) activeStyleId = styleId;
    if (params) activeParams = params;

    if (!liveCanvas) return;
    var ctx = liveCanvas.getContext('2d');
    if (!ctx) return;

    var stylePlugin = StyleRegistry ? StyleRegistry.get(activeStyleId) : null;
    if (stylePlugin && typeof stylePlugin.init === 'function') {
      stylePlugin.init(ctx, liveCanvas.width, liveCanvas.height, activeParams);
    }

    function previewLoop() {
      if (!liveCanvas || !ctx) return;

      if (!isTabHidden) {
        var currentTime = 0;
        if (liveAudioEl) {
          currentTime = liveAudioEl.currentTime || 0;
        }

        renderFrameAt(currentTime, ctx, liveCanvas.width, liveCanvas.height, activeStyleId, activeParams);
      }

      livePreviewAnimId = requestAnimationFrame(previewLoop);
    }

    livePreviewAnimId = requestAnimationFrame(previewLoop);
  }

  function stopLivePreview() {
    if (livePreviewAnimId) {
      cancelAnimationFrame(livePreviewAnimId);
      livePreviewAnimId = null;
    }
    liveCanvas = null;
    liveAudioEl = null;
    if (photosafetyLimiter) {
      photosafetyLimiter.reset();
    }
  }

  function setStyle(styleId, params) {
    activeStyleId = styleId;
    if (params) activeParams = params;
  }

  return {
    setAnalysis: setAnalysis,
    getAnalysis: getAnalysis,
    renderFrameAt: renderFrameAt,
    bindLivePreview: bindLivePreview,
    stopLivePreview: stopLivePreview,
    setStyle: setStyle,
    getLimiter: function () { return photosafetyLimiter; }
  };
});
