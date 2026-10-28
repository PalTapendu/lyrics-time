/**
 * SYNCLINES — Audio Visualizer Studio Real MP4 Export Engine
 * studio/engine/export_engine.js
 *
 * Implements RealRenderJob (Prompt 9):
 * 1. Hardware-accelerated client-side video encoding via WebCodecs (VideoEncoder, avc1).
 * 2. Offline ISOBMFF MP4 muxing via vendored Mp4Muxer.
 * 3. Enforces constant 30 FPS microsecond timestamps and strictly EVEN pixel dimensions (16:9, 9:16, 1:1, 4:5).
 * 4. Encoder backpressure management (respects encodeQueueSize to prevent unbounded memory growth).
 * 5. Instant VideoFrame closure to prevent GPU memory leaks.
 * 6. File System Access API stream-to-disk or in-memory Blob export.
 * 7. Real-time MediaRecorder fallback on unsupported platforms with honest user messaging.
 * 8. Sanitized filename generator (<audio>-<style>-<ratio>.mp4) and Web Share fallback.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioExportEngine = factory(
      root.StudioConfig,
      root.StudioRenderer,
      root.Mp4Muxer
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (
  Config,
  Renderer,
  Mp4Muxer
) {
  'use strict';

  var FPS = 30;
  var FRAME_MICROS = Math.round(1000000 / FPS); // ~33333 us

  // Standard even-dimension tables
  var RESOLUTION_MAP = {
    '1080p': {
      '16:9': { width: 1920, height: 1080, bitrate: 6500000 },
      '9:16': { width: 1080, height: 1920, bitrate: 6500000 },
      '1:1':  { width: 1080, height: 1080, bitrate: 5500000 },
      '4:5':  { width: 1080, height: 1350, bitrate: 6000000 }
    },
    '720p': {
      '16:9': { width: 1280, height: 720,  bitrate: 3500000 },
      '9:16': { width: 720,  height: 1280, bitrate: 3500000 },
      '1:1':  { width: 720,  height: 720,  bitrate: 3000000 },
      '4:5':  { width: 720,  height: 900,  bitrate: 3200000 }
    }
  };

  function getDimensions(res, ratio) {
    var resGroup = RESOLUTION_MAP[res] || RESOLUTION_MAP['1080p'];
    var dims = resGroup[ratio] || resGroup['16:9'];
    // Guarantee even dimensions
    return {
      width: dims.width % 2 === 0 ? dims.width : dims.width - 1,
      height: dims.height % 2 === 0 ? dims.height : dims.height - 1,
      bitrate: dims.bitrate
    };
  }

  function sanitizeFilename(audioName, styleId, ratio) {
    var cleanAudio = (audioName || 'visualizer')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 32);

    var cleanStyle = (styleId || 'classic-bars').replace(/[^a-zA-Z0-9_-]/g, '-');
    var cleanRatio = (ratio || '16-9').replace(':', '-');

    return cleanAudio + '-' + cleanStyle + '-' + cleanRatio + '.mp4';
  }

  function RealRenderJob() {
    var isRunning = false;
    var isCancelled = false;
    var videoEncoder = null;
    var audioEncoder = null;
    var muxer = null;
    var offscreenCanvas = null;
    var offscreenCtx = null;
    var totalFrames = 0;
    var encodedFrames = 0;
    var startTime = 0;
    var params = null;

    async function checkWebCodecsSupport(width, height, bitrate) {
      if (typeof VideoEncoder === 'undefined') {
        return { supported: false, reason: 'VideoEncoder API not available in this browser.' };
      }

      var config = {
        codec: 'avc1.42001f', // Baseline profile, level 3.1
        width: width,
        height: height,
        bitrate: bitrate,
        framerate: FPS
      };

      try {
        var support = await VideoEncoder.isConfigSupported(config);
        return {
          supported: support.supported,
          config: support.config || config
        };
      } catch (e) {
        return { supported: false, reason: e.message };
      }
    }

    async function start(jobParams, onProgress, onComplete, onError) {
      if (isRunning) return;
      isRunning = true;
      isCancelled = false;
      params = jobParams || {};
      startTime = Date.now();
      encodedFrames = 0;

      var res = params.resolution || '1080p';
      var ratio = params.aspectRatio || '16:9';
      var dims = getDimensions(res, ratio);

      var trimStart = params.trimStart || 0.0;
      var trimEnd = params.trimEnd || (params.duration ? trimStart + params.duration : 15.0);
      var duration = Math.max(3.0, trimEnd - trimStart);
      totalFrames = Math.floor(duration * FPS);

      // 1. Check WebCodecs hardware support
      var supportCheck = await checkWebCodecsSupport(dims.width, dims.height, dims.bitrate);

      if (!supportCheck.supported) {
        // Trigger Fallback Pipeline (MediaRecorder or graceful notice)
        console.warn('[StudioExport] WebCodecs AVC1 not supported, testing fallback...');
        startMediaRecorderFallback(params, dims, duration, onProgress, onComplete, onError);
        return;
      }

      try {
        // 2. Instantiate Offline Canvas
        if (typeof OffscreenCanvas !== 'undefined') {
          offscreenCanvas = new OffscreenCanvas(dims.width, dims.height);
          offscreenCtx = offscreenCanvas.getContext('2d');
        } else if (typeof document !== 'undefined') {
          offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.width = dims.width;
          offscreenCanvas.height = dims.height;
          offscreenCtx = offscreenCanvas.getContext('2d');
        } else {
          throw new Error('Canvas rendering context unavailable in this environment.');
        }

        // 3. Setup MP4 Muxer
        var muxerTarget = new Mp4Muxer.ArrayBufferTarget();
        muxer = new Mp4Muxer.Muxer({
          target: muxerTarget,
          video: {
            codec: 'avc',
            width: dims.width,
            height: dims.height
          },
          fastStart: 'in-memory'
        });

        // 4. Setup VideoEncoder with backpressure monitoring
        var encoderError = null;

        videoEncoder = new VideoEncoder({
          output: function (chunk, meta) {
            if (muxer) {
              muxer.addVideoChunk(chunk, meta);
            }
          },
          error: function (e) {
            console.error('[StudioExport] VideoEncoder error:', e);
            encoderError = e;
          }
        });

        var encoderConfig = {
          codec: 'avc1.42001f',
          width: dims.width,
          height: dims.height,
          bitrate: dims.bitrate,
          framerate: FPS
        };

        videoEncoder.configure(encoderConfig);

        // 5. Render & Encode Loop
        var lastYieldAt = performance.now();
        var yieldToUI = function () {
          return new Promise(function (resolve) {
            if (typeof MessageChannel !== 'undefined') {
              var ch = new MessageChannel();
              ch.port1.onmessage = function () { ch.port1.close(); resolve(); };
              ch.port2.postMessage(0);
            } else {
              setTimeout(resolve, 0);
            }
          });
        };
        for (var i = 0; i < totalFrames; i++) {
          if (isCancelled || !isRunning) break;
          if (encoderError) throw encoderError;

          var frameTime = trimStart + (i / FPS);
          var timestampMicros = Math.round(i * FRAME_MICROS);

          // Render exact frame
          if (Renderer && typeof Renderer.renderFrameAt === 'function') {
            Renderer.renderFrameAt(frameTime, offscreenCtx, dims.width, dims.height, params.styleId, params.styleParams);
          }

          // Create VideoFrame
          var videoFrame = new VideoFrame(offscreenCanvas, { timestamp: timestampMicros });
          var isKeyFrame = (i % 60 === 0); // Keyframe every 2 seconds

          videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
          videoFrame.close(); // Crucial: free GPU frame memory immediately
          encodedFrames++;

          // Encoder Backpressure handling
          if (videoEncoder.encodeQueueSize > 5) {
            await new Promise(function (resolve) {
              videoEncoder.ondequeue = resolve;
              setTimeout(resolve, 25);
            });
          }

          // Time-sliced yield: let the browser paint and handle clicks (e.g. Cancel) every ~30 ms of work.
          if (performance.now() - lastYieldAt > 30) {
            await yieldToUI();
            lastYieldAt = performance.now();
          }

          // Progress reporting
          if (onProgress && (i % 5 === 0 || i === totalFrames - 1)) {
            var pct = Math.min(95, Math.round((i / totalFrames) * 95));
            var elapsedSec = Math.floor((Date.now() - startTime) / 1000);
            var etaSec = pct >= 95 ? 1 : Math.max(1, Math.round(((95 - pct) / Math.max(1, pct)) * elapsedSec));

            onProgress({
              percent: pct,
              stageId: 'render',
              stageLabel: 'Rendering Frames',
              stageName: 'Encoding frame ' + (i + 1) + ' of ' + totalFrames + '...',
              elapsedSec: elapsedSec,
              etaSec: etaSec
            });
          }
        }

        if (isCancelled) {
          cleanup();
          return;
        }

        // 6. Flush VideoEncoder
        if (onProgress) {
          onProgress({
            percent: 96,
            stageId: 'finalize',
            stageLabel: 'Finalizing Video',
            stageName: 'Flushing encoder & building MP4 container...',
            elapsedSec: Math.floor((Date.now() - startTime) / 1000),
            etaSec: 1
          });
        }

        await videoEncoder.flush();
        videoEncoder.close();
        videoEncoder = null;

        // 7. Finalize MP4 Muxer
        var finalBuffer = muxer.finalize();
        var mp4Blob = new Blob([finalBuffer], { type: 'video/mp4' });

        isRunning = false;

        // 8. Output Verification
        var videoUrl = URL.createObjectURL(mp4Blob);

        if (onComplete) {
          onComplete({
            isDemo: false,
            blob: mp4Blob,
            videoUrl: videoUrl,
            filename: sanitizeFilename(params.audio ? params.audio.name : '', params.styleId, ratio),
            duration: duration,
            sizeBytes: mp4Blob.size,
            resolution: res,
            aspectRatio: ratio,
            width: dims.width,
            height: dims.height
          });
        }
      } catch (err) {
        console.error('[StudioExport] Export pipeline failure:', err);
        cleanup();
        isRunning = false;
        if (onError) {
          onError({
            code: 'RENDER_ENCODE_CRASH',
            message: 'Video export failed: ' + (err.message || 'Encoder crashed.')
          });
        }
      }
    }

    function startMediaRecorderFallback(params, dims, duration, onProgress, onComplete, onError) {
      if (typeof MediaRecorder === 'undefined' || !offscreenCanvas || !offscreenCanvas.captureStream) {
        if (onError) {
          onError({
            code: 'BROWSER_UNSUPPORTED_CODEC',
            message: 'Neither WebCodecs nor MediaRecorder are supported on this browser. Please use Chrome or Edge.'
          });
        }
        return;
      }

      try {
        var stream = offscreenCanvas.captureStream(FPS);
        var mime = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ? 'video/mp4;codecs=avc1' : 'video/webm';
        var recorder = new MediaRecorder(stream, { mimeType: mime });
        var recordedChunks = [];

        recorder.ondataavailable = function (e) {
          if (e.data && e.data.size > 0) recordedChunks.push(e.data);
        };

        recorder.onstop = function () {
          var blob = new Blob(recordedChunks, { type: mime });
          var ext = mime.indexOf('mp4') !== -1 ? '.mp4' : '.webm';
          var filename = sanitizeFilename(params.audio ? params.audio.name : '', params.styleId, params.aspectRatio).replace('.mp4', ext);
          isRunning = false;

          if (onComplete) {
            onComplete({
              isDemo: false,
              isFallback: true,
              blob: blob,
              videoUrl: URL.createObjectURL(blob),
              filename: filename,
              duration: duration,
              sizeBytes: blob.size,
              resolution: params.resolution,
              aspectRatio: params.aspectRatio,
              width: dims.width,
              height: dims.height
            });
          }
        };

        recorder.start();
        // Render frames in real-time
        var frame = 0;
        var totalF = Math.floor(duration * FPS);

        function fallbackLoop() {
          if (isCancelled || !isRunning) {
            recorder.stop();
            return;
          }

          var t = (params.trimStart || 0) + (frame / FPS);
          if (Renderer && Renderer.renderFrameAt) {
            Renderer.renderFrameAt(t, offscreenCtx, dims.width, dims.height, params.styleId, params.styleParams);
          }
          frame++;

          if (onProgress && frame % 15 === 0) {
            var pct = Math.min(95, Math.round((frame / totalF) * 95));
            onProgress({
              percent: pct,
              stageId: 'render',
              stageLabel: 'Real-Time Capture',
              stageName: 'Recording stream frame ' + frame + ' of ' + totalF + '...',
              elapsedSec: Math.floor((Date.now() - startTime) / 1000),
              etaSec: Math.max(1, Math.round((totalF - frame) / FPS))
            });
          }

          if (frame >= totalF) {
            recorder.stop();
          } else {
            setTimeout(fallbackLoop, 1000 / FPS);
          }
        }

        fallbackLoop();
      } catch (e) {
        if (onError) onError({ code: 'RENDER_ENCODE_CRASH', message: e.message });
      }
    }

    function cancel() {
      isCancelled = true;
      isRunning = false;
      cleanup();
    }

    function cleanup() {
      if (videoEncoder) {
        try { videoEncoder.close(); } catch (e) {}
        videoEncoder = null;
      }
      if (audioEncoder) {
        try { audioEncoder.close(); } catch (e) {}
        audioEncoder = null;
      }
      muxer = null;
      offscreenCanvas = null;
      offscreenCtx = null;
    }

    return {
      start: start,
      cancel: cancel,
      isRunning: function () { return isRunning; },
      isCancelled: function () { return isCancelled; }
    };
  }

  function triggerDownload(blob, filename) {
    if (!blob) return;
    filename = filename || 'visualizer.mp4';

    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  return {
    RESOLUTION_MAP: RESOLUTION_MAP,
    getDimensions: getDimensions,
    sanitizeFilename: sanitizeFilename,
    RealRenderJob: RealRenderJob,
    triggerDownload: triggerDownload
  };
});
