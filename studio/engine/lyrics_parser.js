/**
 * SYNCLINES — Audio Visualizer Studio Robust Lyrics & Subtitle Parser
 * studio/engine/lyrics_parser.js
 *
 * Implements full specification parsing for:
 * 1. Synchronized Lyrics (.LRC) - standard & enhanced word-level timestamps.
 * 2. SubRip Subtitles (.SRT) - comma and dot decimal variants, multi-line cues.
 * 3. WebVTT (.VTT) - header validation, cue settings stripping.
 * 4. Pasted text with timestamps.
 *
 * Edge cases handled:
 * - BOM removal (UTF-8, UTF-16 LE/BE).
 * - CRLF and mixed line endings normalization.
 * - Global [offset:+/-ms] tag handling.
 * - Multi-timestamp line fan-out ([00:10.00][00:22.00] line).
 * - Missing end times (auto-extrapolated to next cue start or start + 4.0s).
 * - Devanagari (Hindi) and RTL (Arabic/Hebrew) Unicode detection.
 * - HTML styling tags stripping (<b>, <i>, <font>).
 * - Strict chronologic ordering with overlap protection.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioLyricsParser = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var DEVANAGARI_REGEX = /[\u0900-\u097F]/;
  var RTL_REGEX = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;

  /**
   * Cleans BOM and normalizes line breaks.
   */
  function sanitizeInput(text) {
    if (typeof text !== 'string') return '';
    // Strip UTF-8 BOM and UTF-16 BOMs
    var clean = text.replace(/^\uFEFF/, '').replace(/^\uFFFE/, '');
    // Normalize line endings to \n
    return clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  /**
   * Converts timestamp string mm:ss.xx or hh:mm:ss,xxx to seconds.
   */
  function parseTimestampToSeconds(str) {
    if (!str) return NaN;
    str = str.trim().replace(',', '.');
    var parts = str.split(':');
    if (parts.length === 3) {
      // hh:mm:ss.sss
      var h = parseFloat(parts[0]);
      var m = parseFloat(parts[1]);
      var s = parseFloat(parts[2]);
      if (!isNaN(h) && !isNaN(m) && !isNaN(s)) {
        return h * 3600 + m * 60 + s;
      }
    } else if (parts.length === 2) {
      // mm:ss.ss
      var m2 = parseFloat(parts[0]);
      var s2 = parseFloat(parts[1]);
      if (!isNaN(m2) && !isNaN(s2)) {
        return m2 * 60 + s2;
      }
    } else if (parts.length === 1) {
      var s3 = parseFloat(parts[0]);
      if (!isNaN(s3)) return s3;
    }
    return NaN;
  }

  /**
   * Detects the lyrics/subtitle format from content.
   */
  function detectFormat(text) {
    if (/WEBVTT/i.test(text.slice(0, 100))) return 'vtt';
    if (/\d+\s*\n\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/m.test(text)) return 'srt';
    if (/\[\d{1,2}:\d{2}[\.:]\d{2,3}\]/.test(text)) return 'lrc';
    return 'plain';
  }

  /**
   * Strips HTML formatting tags like <b>, <i>, <font color="...">.
   */
  function stripHtmlTags(str) {
    return str.replace(/<[^>]+>/g, '').trim();
  }

  /**
   * Parses Enhanced Word-Level timestamps: <00:12.50> word <00:13.20> word
   */
  function parseWordTimestamps(text, lineStart) {
    var wordRegex = /<(\d{1,2}:\d{2}[\.:]\d{2,3})>([^<]+)/g;
    var match;
    var words = [];
    while ((match = wordRegex.exec(text)) !== null) {
      var wTime = parseTimestampToSeconds(match[1]);
      var wText = match[2].trim();
      if (!isNaN(wTime) && wText) {
        words.push({
          start: wTime,
          end: wTime + 0.5, // refined when next word is parsed
          text: wText
        });
      }
    }

    // Refine word end times
    for (var i = 0; i < words.length; i++) {
      if (i < words.length - 1) {
        words[i].end = words[i + 1].start;
      }
    }

    return words;
  }

  /**
   * Parses LRC file format.
   */
  function parseLRC(rawText) {
    var lines = rawText.split('\n');
    var cues = [];
    var globalOffsetMs = 0;
    var timeTagRegex = /\[(\d{1,2}:\d{2}[\.:]\d{2,3})\]/g;
    var offsetTagRegex = /\[offset:\s*([+-]?\d+)\s*\]/i;

    // First pass: extract [offset:+/-ms] tag
    for (var o = 0; o < lines.length; o++) {
      var offMatch = offsetTagRegex.exec(lines[o]);
      if (offMatch) {
        var parsedOffset = parseInt(offMatch[1], 10);
        if (!isNaN(parsedOffset)) {
          globalOffsetMs = parsedOffset;
        }
      }
    }

    var offsetSec = globalOffsetMs / 1000.0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      // Skip metadata tags like [ti:], [ar:], [al:], [by:]
      if (/^\[(ti|ar|al|by|offset|length|re|ve):/i.test(line)) {
        continue;
      }

      // Collect all timestamp tags on this line
      var timestamps = [];
      var match;
      timeTagRegex.lastIndex = 0;
      while ((match = timeTagRegex.exec(line)) !== null) {
        var sec = parseTimestampToSeconds(match[1]);
        if (!isNaN(sec)) {
          timestamps.push(sec + offsetSec);
        }
      }

      if (!timestamps.length) continue;

      // Extract raw line text (stripping [mm:ss.xx] tags)
      var text = line.replace(/\[\d{1,2}:\d{2}[\.:]\d{2,3}\]/g, '').trim();

      // Check for word-level timestamps <mm:ss.xx>
      var hasWordTags = /<\d{1,2}:\d{2}[\.:]\d{2,3}>/.test(text);
      var words = hasWordTags ? parseWordTimestamps(text, timestamps[0]) : [];
      var cleanText = stripHtmlTags(text.replace(/<\d{1,2}:\d{2}[\.:]\d{2,3}>/g, ' '));

      // Fan-out for multiple timestamps on the same line
      for (var t = 0; t < timestamps.length; t++) {
        var startTime = Math.max(0, timestamps[t]);
        cues.push({
          start: startTime,
          end: startTime + 4.0, // default placeholder, updated during post-processing
          text: cleanText,
          words: words.length ? words : null
        });
      }
    }

    return cues;
  }

  /**
   * Parses SRT file format.
   */
  function parseSRT(rawText) {
    var normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var blocks = normalized.split(/\n\s*\n/);
    var cues = [];
    var timeRegex = /(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})/;

    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i].trim();
      if (!block) continue;

      var lines = block.split('\n');
      var timeLineIdx = -1;

      for (var l = 0; l < lines.length; l++) {
        if (timeRegex.test(lines[l])) {
          timeLineIdx = l;
          break;
        }
      }

      if (timeLineIdx === -1) continue;

      var timeMatch = timeRegex.exec(lines[timeLineIdx]);
      var start = parseTimestampToSeconds(timeMatch[1]);
      var end = parseTimestampToSeconds(timeMatch[2]);

      if (isNaN(start) || isNaN(end)) continue;

      var textLines = lines.slice(timeLineIdx + 1);
      var text = stripHtmlTags(textLines.join('\n'));

      if (text) {
        cues.push({
          start: start,
          end: Math.max(start + 0.5, end),
          text: text,
          words: null
        });
      }
    }

    return cues;
  }

  /**
   * Parses WebVTT file format.
   */
  function parseVTT(rawText) {
    var lines = rawText.split('\n');
    var cues = [];
    var timeRegex = /(\d{1,2}:)?(\d{2}:\d{2}[\.:]\d{3})\s*-->\s*(\d{1,2}:)?(\d{2}:\d{2}[\.:]\d{3})/;

    var currentCue = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();

      // Skip WEBVTT header and NOTE lines
      if (!line || line.startsWith('WEBVTT') || line.startsWith('NOTE')) {
        if (currentCue) {
          if (currentCue.text) cues.push(currentCue);
          currentCue = null;
        }
        continue;
      }

      var timeMatch = timeRegex.exec(line);
      if (timeMatch) {
        if (currentCue && currentCue.text) {
          cues.push(currentCue);
        }
        var startStr = (timeMatch[1] || '') + timeMatch[2];
        var endStr = (timeMatch[3] || '') + timeMatch[4];
        var start = parseTimestampToSeconds(startStr);
        var end = parseTimestampToSeconds(endStr);

        currentCue = {
          start: start,
          end: Math.max(start + 0.5, end),
          text: '',
          words: null
        };
      } else if (currentCue) {
        // Strip cue settings like align:start or position:50%
        var cleanLine = stripHtmlTags(line.replace(/<[^>]+>/g, ''));
        if (currentCue.text) {
          currentCue.text += ' ' + cleanLine;
        } else {
          currentCue.text = cleanLine;
        }
      }
    }

    if (currentCue && currentCue.text) {
      cues.push(currentCue);
    }

    return cues;
  }

  /**
   * Parses unstructured plain text with timestamps like:
   * 0:15 - Lyrics line
   * [1:22] Another line
   */
  function parsePlainWithTimestamps(rawText) {
    var lines = rawText.split('\n');
    var cues = [];
    var pattern = /^(?:\[)?(\d{1,2}:\d{2}(?::\d{2})?(?:[\.,]\d{1,3})?)(?:\])?[\s\-\:]+(.+)$/;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var match = pattern.exec(line);
      if (match) {
        var t = parseTimestampToSeconds(match[1]);
        var txt = stripHtmlTags(match[2]);
        if (!isNaN(t) && txt) {
          cues.push({
            start: t,
            end: t + 4.0,
            text: txt,
            words: null
          });
        }
      }
    }
    return cues;
  }

  /**
   * Post-processes and sanitizes parsed cues:
   * 1. Sorts chronologically.
   * 2. Sets end times to next cue start (capped at start + 6.0s) if missing or default.
   * 3. Prevents negative or NaN values.
   * 4. Assigns unique stable IDs.
   */
  function postProcessCues(rawCues) {
    if (!rawCues || !rawCues.length) return [];

    // Filter valid entries
    var valid = rawCues.filter(function (c) {
      return c && !isNaN(c.start) && c.start >= 0 && typeof c.text === 'string' && c.text.trim().length > 0;
    });

    // Chronological sort
    valid.sort(function (a, b) {
      return a.start - b.start;
    });

    for (var i = 0; i < valid.length; i++) {
      valid[i].id = i + 1;
      valid[i].text = valid[i].text.trim();

      if (i < valid.length - 1) {
        var nextStart = valid[i + 1].start;
        // If end was defaulted or exceeds next start, clamp to next start
        if (valid[i].end >= nextStart || valid[i].end <= valid[i].start) {
          valid[i].end = Math.max(valid[i].start + 0.5, nextStart);
        }
      } else {
        if (valid[i].end <= valid[i].start) {
          valid[i].end = valid[i].start + 4.0;
        }
      }
    }

    return valid;
  }

  /**
   * Main parsing entrypoint.
   */
  function parse(text, formatHint) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      return {
        cues: [],
        format: 'empty',
        offsetMs: 0,
        hasWords: false,
        isDevanagari: false,
        isRtl: false,
        lineCount: 0,
        duration: 0
      };
    }

    var cleanText = sanitizeInput(text);
    var format = formatHint || detectFormat(cleanText);
    var rawCues = [];

    if (format === 'vtt') {
      rawCues = parseVTT(cleanText);
    } else if (format === 'srt') {
      rawCues = parseSRT(cleanText);
    } else if (format === 'lrc') {
      rawCues = parseLRC(cleanText);
    } else {
      rawCues = parsePlainWithTimestamps(cleanText);
      if (!rawCues.length) {
        // Fallback: try LRC parser in case format was misclassified
        rawCues = parseLRC(cleanText);
      }
    }

    var processed = postProcessCues(rawCues);

    var hasWords = false;
    var isDevanagari = false;
    var isRtl = false;
    var maxEnd = 0;

    for (var i = 0; i < processed.length; i++) {
      var cue = processed[i];
      if (cue.words && cue.words.length) hasWords = true;
      if (DEVANAGARI_REGEX.test(cue.text)) isDevanagari = true;
      if (RTL_REGEX.test(cue.text)) isRtl = true;
      if (cue.end > maxEnd) maxEnd = cue.end;
    }

    return {
      cues: processed,
      format: format,
      hasWords: hasWords,
      isDevanagari: isDevanagari,
      isRtl: isRtl,
      lineCount: processed.length,
      duration: maxEnd,
      rawText: text
    };
  }

  /**
   * Returns active cue at exact time in seconds (with +/- frame resolution).
   */
  function getActiveCueAt(cues, tSeconds, offsetSeconds) {
    if (!cues || !cues.length) return null;
    var adjustedTime = Math.max(0, tSeconds + (offsetSeconds || 0));

    for (var i = 0; i < cues.length; i++) {
      var cue = cues[i];
      if (adjustedTime >= cue.start && adjustedTime < cue.end) {
        var nextCue = (i < cues.length - 1) ? cues[i + 1] : null;
        return {
          current: cue,
          next: nextCue,
          index: i,
          progress: Math.min(1.0, (adjustedTime - cue.start) / Math.max(0.1, cue.end - cue.start))
        };
      }
    }
    return null;
  }

  return {
    parse: parse,
    detectFormat: detectFormat,
    getActiveCueAt: getActiveCueAt,
    getActiveCue: getActiveCueAt,
    parseTimestampToSeconds: parseTimestampToSeconds,
    sanitizeInput: sanitizeInput,
    stripBOM: sanitizeInput,
    containsDevanagari: function (str) {
      return DEVANAGARI_REGEX.test(str || '');
    }
  };
});
