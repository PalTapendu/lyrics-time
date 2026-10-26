/**
 * SYNCLINES — Audio Visualizer Studio Reference Style: Classic Bars
 * studio/engine/styles/classic_bars.js
 *
 * Implements the flagship reference visualizer preset "Classic Bars":
 * 1. 48 frequency-reactive vertical audio equalizer bars with peak caps.
 * 2. Gravity-modeled peak drop indicators that hold and slowly descend.
 * 3. Gradient styling driven by style palette primary (#00ffb0) & accent (#e2b34a).
 * 4. Ground reflection effect and glossy rounded caps.
 * 5. Full responsiveness across all 4 aspect ratios (16:9, 9:16, 1:1, 4:5).
 * 6. Conforms strictly to the Style Plugin Interface.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var plugin = factory();
    if (root.StudioStyleRegistry && typeof root.StudioStyleRegistry.register === 'function') {
      root.StudioStyleRegistry.register(plugin);
    }
    root.StudioStyleClassicBars = plugin;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var BAR_COUNT = 48;
  var peakHeights = new Float32Array(BAR_COUNT);
  var peakVelocities = new Float32Array(BAR_COUNT);
  var lastRenderTime = -1;

  var DEFAULT_PARAMS = {
    barCount: 48,
    gap: 3,
    glow: true,
    reflection: true,
    primaryColor: '#00ffb0',
    accentColor: '#e2b34a',
    backgroundColor: '#060a0d',
    peakGravity: 0.008
  };

  function init(ctx, width, height, params) {
    peakHeights.fill(0);
    peakVelocities.fill(0);
    lastRenderTime = -1;
  }

  function render(frame, tSeconds, ctx, width, height, params) {
    if (!ctx || width <= 0 || height <= 0) return;

    params = params || {};
    var pColor = params.primaryColor || DEFAULT_PARAMS.primaryColor;
    var aColor = params.accentColor || DEFAULT_PARAMS.accentColor;
    var bgColor = params.backgroundColor || DEFAULT_PARAMS.backgroundColor;
    var gap = params.gap !== undefined ? params.gap : DEFAULT_PARAMS.gap;
    var barCount = Math.min(BAR_COUNT, (params.barCount || BAR_COUNT));

    // Clear background if not already handled by universal renderer
    if (!params.customBgHandled) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      // Subtle dark gradient vignette
      var vig = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.7);
      vig.addColorStop(0, 'rgba(10, 20, 26, 0.4)');
      vig.addColorStop(1, 'rgba(4, 7, 10, 0.95)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
    }

    // Compute layout geometry based on aspect ratio
    var marginX = width * 0.08;
    var availableW = width - (marginX * 2);
    var barW = Math.max(2, (availableW - (gap * (barCount - 1))) / barCount);
    var baselineY = height * 0.72; // Bars anchor at 72% height
    var maxBarH = height * 0.52;

    var bands = (frame && frame.bands) ? frame.bands : new Float32Array(barCount);

    // Time delta for peak decay
    var dt = (lastRenderTime >= 0 && tSeconds > lastRenderTime) ? Math.min(0.1, tSeconds - lastRenderTime) : (1.0 / 30.0);
    lastRenderTime = tSeconds;

    var peakGravity = params.peakGravity !== undefined ? params.peakGravity : DEFAULT_PARAMS.peakGravity;
    var useGlow = params.glow !== false;
    var useReflection = params.reflection !== false;

    // Create vertical gradient for main bars
    var barGrad = ctx.createLinearGradient(0, baselineY, 0, baselineY - maxBarH);
    barGrad.addColorStop(0, pColor);
    barGrad.addColorStop(0.65, pColor);
    barGrad.addColorStop(1, aColor);

    // Create reflection gradient
    var reflGrad = ctx.createLinearGradient(0, baselineY, 0, baselineY + (maxBarH * 0.28));
    reflGrad.addColorStop(0, pColor + '40');
    reflGrad.addColorStop(1, pColor + '00');

    if (useGlow) {
      ctx.shadowColor = pColor;
      ctx.shadowBlur = 8;
    } else {
      ctx.shadowBlur = 0;
    }

    for (var i = 0; i < barCount; i++) {
      var bandVal = bands[i] || 0.0;
      var targetH = Math.max(4, bandVal * maxBarH);
      var x = marginX + i * (barW + gap);
      var y = baselineY - targetH;

      // Draw Main Bar
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barW, targetH, [3, 3, 0, 0]);
      } else {
        ctx.rect(x, y, barW, targetH);
      }
      ctx.fill();

      // Peak Drop Cap Logic
      if (targetH >= peakHeights[i]) {
        peakHeights[i] = targetH;
        peakVelocities[i] = 0;
      } else {
        peakVelocities[i] += peakGravity * (dt / (1.0 / 30.0));
        peakHeights[i] -= peakVelocities[i];
        if (peakHeights[i] < targetH) {
          peakHeights[i] = targetH;
          peakVelocities[i] = 0;
        }
      }

      // Draw Floating Peak Cap
      var peakY = baselineY - peakHeights[i] - 4;
      if (peakY < baselineY) {
        ctx.fillStyle = aColor;
        ctx.fillRect(x, Math.max(10, peakY), barW, 2.5);
      }

      // Draw Ground Reflection
      if (useReflection) {
        var reflH = targetH * 0.28;
        ctx.fillStyle = reflGrad;
        ctx.fillRect(x, baselineY + 2, barW, reflH);
      }
    }

    // Reset shadow blur
    ctx.shadowBlur = 0;

    // Draw baseline glow thread
    ctx.strokeStyle = pColor;
    ctx.lineWidth = 1.5;
    if (useGlow) {
      ctx.shadowColor = pColor;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.moveTo(marginX - 10, baselineY);
    ctx.lineTo(width - marginX + 10, baselineY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function dispose() {
    peakHeights.fill(0);
    peakVelocities.fill(0);
    lastRenderTime = -1;
  }

  return {
    id: 'classic-bars',
    name: 'Classic Bars',
    category: 'classic-bars',
    supportedRatios: ['16:9', '9:16', '1:1', '4:5'],
    defaultParams: DEFAULT_PARAMS,
    init: init,
    render: render,
    dispose: dispose
  };
});
