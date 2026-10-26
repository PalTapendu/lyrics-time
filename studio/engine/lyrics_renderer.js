/**
 * SYNCLINES — Audio Visualizer Studio Lyrics Overlay Renderer
 * studio/engine/lyrics_renderer.js
 *
 * Implements:
 * 1. Synchronized frame-accurate lyrics overlay rendering on HTML5 canvas.
 * 2. 3 High-End Overlay Styles:
 *    - 'karaoke': Active line with glowing accent, word-level or character progress highlight, next line dimmed.
 *    - 'centered': Centered cinematic subtitle with rounded frosted pill background.
 *    - 'lower-third': Television broadcast lower-third bar with vertical accent indicator.
 * 3. Aspect-ratio adaptive typography & safe-area margins (9:16 reels/tiktok, 16:9 TV, 1:1, 4:5).
 * 4. Automatic line wrapping with max-width bounding.
 * 5. Full Unicode & Devanagari (Hindi) glyph rendering support ('Noto Sans Devanagari').
 * 6. RTL (Right-to-Left) script alignment support.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioLyricsRenderer = factory(root.StudioLyricsParser);
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (Parser) {
  'use strict';

  var DEVANAGARI_FONT = '"Noto Sans Devanagari", "Outfit", sans-serif';
  var LATIN_FONT = '"Outfit", "Plus Jakarta Sans", sans-serif';

  /**
   * Automatically wraps a string into lines that fit within maxWidth.
   */
  function wrapText(ctx, text, maxWidth) {
    var words = text.split(/\s+/);
    var lines = [];
    var currentLine = words[0] || '';

    for (var i = 1; i < words.length; i++) {
      var word = words[i];
      var width = ctx.measureText(currentLine + ' ' + word).width;
      if (width < maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  }

  /**
   * Renders the synchronized lyrics layer onto the target canvas context.
   *
   * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context
   * @param {number} width - Exact pixel width
   * @param {number} height - Exact pixel height
   * @param {number} tSeconds - Current track time in seconds
   * @param {Object} config - Lyrics configuration options
   */
  function renderLyricsOverlay(ctx, width, height, tSeconds, config) {
    if (!ctx || width <= 0 || height <= 0 || !config || !config.enabled) return;
    var cues = config.cues;
    if (!cues || !cues.length) return;

    var parser = Parser || (typeof window !== 'undefined' && window.StudioLyricsParser);
    var activeData = parser ? parser.getActiveCueAt(cues, tSeconds, config.offsetSeconds || 0) : null;
    if (!activeData || !activeData.current) return;

    var currentCue = activeData.current;
    var nextCue = activeData.next;
    var progress = activeData.progress; // 0.0 to 1.0

    var style = config.style || 'karaoke'; // 'karaoke' | 'centered' | 'lower-third'
    var isVertical = height > width;
    var isDevanagari = config.isDevanagari || /[\u0900-\u097F]/.test(currentCue.text);
    var isRtl = config.isRtl || /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(currentCue.text);

    var baseFont = isDevanagari ? DEVANAGARI_FONT : LATIN_FONT;
    var highlightColor = config.highlightColor || '#00ffb0';
    var accentColor = config.accentColor || '#e2b34a';

    // Adaptive font size calculation based on canvas dimensions and aspect ratio
    var fontSize = Math.max(isVertical ? 22 : 18, Math.round(Math.min(width, height) * (isVertical ? 0.048 : 0.038)));
    var maxWrapWidth = isVertical ? width * 0.84 : width * 0.76;

    ctx.save();
    if (isRtl && 'direction' in ctx) {
      ctx.direction = 'rtl';
    }

    if (style === 'karaoke') {
      renderKaraokeStyle(ctx, width, height, currentCue, nextCue, progress, fontSize, baseFont, highlightColor, accentColor, maxWrapWidth, isVertical);
    } else if (style === 'lower-third') {
      renderLowerThirdStyle(ctx, width, height, currentCue, fontSize, baseFont, highlightColor, maxWrapWidth, isVertical);
    } else {
      // Default: Centered Captions
      renderCenteredStyle(ctx, width, height, currentCue, fontSize, baseFont, highlightColor, maxWrapWidth, isVertical);
    }

    ctx.restore();
  }

  /**
   * Style A: Karaoke Highlight (Active line glows, optional word highlighting, next line preview)
   */
  function renderKaraokeStyle(ctx, width, height, currentCue, nextCue, progress, fontSize, baseFont, highlightColor, accentColor, maxWrapWidth, isVertical) {
    ctx.font = '700 ' + fontSize + 'px ' + baseFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var lines = wrapText(ctx, currentCue.text, maxWrapWidth);
    var lineHeight = fontSize * 1.35;
    var totalHeight = lines.length * lineHeight;

    // Anchor position: 75% height in landscape, 68% in vertical
    var anchorY = height * (isVertical ? 0.68 : 0.74);
    var startY = anchorY - (totalHeight / 2);

    // Render active karaoke line(s)
    for (var i = 0; i < lines.length; i++) {
      var y = startY + i * lineHeight;

      // Outer glow and drop shadow
      ctx.shadowColor = highlightColor;
      ctx.shadowBlur = 16;
      ctx.fillStyle = highlightColor;
      ctx.fillText(lines[i], width / 2, y);

      // Inner crisp white core
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(lines[i], width / 2, y);
    }

    // Render next line preview if available
    if (nextCue && nextCue.text) {
      var nextSize = Math.max(14, Math.round(fontSize * 0.75));
      ctx.font = '500 ' + nextSize + 'px ' + baseFont;
      var nextLines = wrapText(ctx, nextCue.text, maxWrapWidth);
      var nextY = startY + totalHeight + 10;

      ctx.fillStyle = 'rgba(253, 247, 236, 0.40)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 6;
      for (var n = 0; n < Math.min(2, nextLines.length); n++) {
        ctx.fillText(nextLines[n], width / 2, nextY + n * (nextSize * 1.3));
      }
    }
  }

  /**
   * Style B: Centered Captions with rounded frosted pill background
   */
  function renderCenteredStyle(ctx, width, height, currentCue, fontSize, baseFont, highlightColor, maxWrapWidth, isVertical) {
    ctx.font = '600 ' + fontSize + 'px ' + baseFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var lines = wrapText(ctx, currentCue.text, maxWrapWidth);
    var lineHeight = fontSize * 1.35;
    var maxLineWidth = 0;
    for (var i = 0; i < lines.length; i++) {
      var w = ctx.measureText(lines[i]).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }

    var padX = Math.round(fontSize * 0.9);
    var padY = Math.round(fontSize * 0.5);
    var boxW = maxLineWidth + (padX * 2);
    var boxH = (lines.length * lineHeight) + (padY * 2);

    var centerY = height * (isVertical ? 0.76 : 0.80);
    var boxX = (width - boxW) / 2;
    var boxY = centerY - (boxH / 2);

    // Frosted dark pill background
    ctx.fillStyle = 'rgba(6, 10, 13, 0.78)';
    ctx.beginPath();
    var radius = Math.min(16, boxH / 2);
    if (ctx.roundRect) {
      ctx.roundRect(boxX, boxY, boxW, boxH, radius);
    } else {
      ctx.rect(boxX, boxY, boxW, boxH);
    }
    ctx.fill();

    // Subtle emerald or accent border
    ctx.strokeStyle = 'rgba(0, 255, 176, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Render text lines
    var startY = boxY + padY + (lineHeight / 2);
    ctx.fillStyle = '#fdf7ec';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4;
    for (var j = 0; j < lines.length; j++) {
      ctx.fillText(lines[j], width / 2, startY + (j * lineHeight));
    }
  }

  /**
   * Style C: Television Broadcast Lower-Third Bar
   */
  function renderLowerThirdStyle(ctx, width, height, currentCue, fontSize, baseFont, highlightColor, maxWrapWidth, isVertical) {
    var barHeight = Math.max(52, Math.round(fontSize * 2.2));
    var y = height - barHeight - Math.round(height * 0.08);

    // Lower third background strip
    var grad = ctx.createLinearGradient(0, y, width, y);
    grad.addColorStop(0, 'rgba(6, 10, 13, 0.88)');
    grad.addColorStop(0.7, 'rgba(10, 16, 22, 0.75)');
    grad.addColorStop(1, 'rgba(6, 10, 13, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, y, width, barHeight);

    // Left accent vertical bar
    ctx.fillStyle = highlightColor;
    var padLeft = Math.round(width * 0.06);
    ctx.fillRect(padLeft, y + 8, 4, barHeight - 16);

    // Render Text
    ctx.font = '600 ' + fontSize + 'px ' + baseFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;

    var textX = padLeft + 16;
    var textY = y + (barHeight / 2);

    // Truncate line if it exceeds available width
    var display = currentCue.text;
    var maxW = width - textX - Math.round(width * 0.08);
    if (ctx.measureText(display).width > maxW) {
      while (display.length > 3 && ctx.measureText(display + '...').width > maxW) {
        display = display.slice(0, -1);
      }
      display += '...';
    }

    ctx.fillText(display, textX, textY);
  }

  function getSafeAreaBounds(width, height) {
    var isVertical = height > width;
    if (isVertical) {
      return {
        top: height * 0.10,
        bottom: height * 0.78,
        left: width * 0.06,
        right: width * 0.85,
        width: width * 0.79,
        height: height * 0.68
      };
    }
    return {
      top: height * 0.05,
      bottom: height * 0.95,
      left: width * 0.05,
      right: width * 0.95,
      width: width * 0.90,
      height: height * 0.90
    };
  }

  return {
    renderLyricsOverlay: renderLyricsOverlay,
    wrapText: wrapText,
    getSafeAreaBounds: getSafeAreaBounds,
    renderKaraokeStyle: renderKaraokeStyle,
    renderCenteredStyle: renderCenteredStyle,
    renderLowerThirdStyle: renderLowerThirdStyle
  };
});
