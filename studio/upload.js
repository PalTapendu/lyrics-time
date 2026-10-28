/**
 * SYNCLINES — Audio Visualizer Studio Upload Modal Controller
 * studio/upload.js
 *
 * Implements accessible drag-and-drop audio validation, Web Audio API decoding,
 * mini-waveform generation, local preview playback, memory cleanup, and storage handoff.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioUploadModal = factory(
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

  var MAX_FILE_SIZE = 120 * 1024 * 1024; // 120 MB
  var MAX_DURATION_SEC = 15 * 60;        // 15 Minutes (900 seconds)
  var MIN_DURATION_SEC = 3.0;            // 3 Seconds
  var WAVEFORM_BINS = 64;

  var SUPPORTED_EXTS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
  var SUPPORTED_MIMES = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
    'audio/flac',
    'audio/x-flac'
  ];

  // Modal elements
  var modalEl = null;
  var dropzoneEl = null;
  var fileInputEl = null;
  var decodingEl = null;
  var decodingTextEl = null;
  var decodeProgressBar = null;
  var audioCardEl = null;
  var noticeEl = null;
  var doneBtn = null;
  var cancelBtn = null;
  var closeBtn = null;
  var chooseBtn = null;
  var replaceBtn = null;
  var removeBtn = null;
  var cancelDecodeBtn = null;

  // Audio & Waveform elements
  var audioEl = null;
  var waveformCanvas = null;
  var waveformPlayhead = null;
  var playPauseBtn = null;
  var playIcon = null;
  var playerTimeEl = null;
  var filenameEl = null;
  var durationEl = null;
  var filesizeEl = null;
  var specsEl = null;

  // Active session state
  var currentFile = null;
  var currentBlob = null;
  var currentObjectUrl = null;
  var currentAudioBuffer = null;
  var currentWaveform = null;
  var isDecoding = false;
  var decodeCancelled = false;
  var audioCtx = null;
  var previousActiveElement = null;

  function getAudioContext() {
    if (!audioCtx) {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '00:00';
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    return (mins < 10 ? '0' + mins : mins) + ':' + (secs < 10 ? '0' + secs : secs);
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * Pure file validator.
   * @param {File} file
   * @returns {{ valid: boolean, error?: string, warning?: string }}
   */
  function validateFile(file) {
    if (!file) {
      return { valid: false, error: 'Please select an audio file.' };
    }

    // Check 0-byte file
    if (file.size === 0) {
      return {
        valid: false,
        error: 'The selected audio file is empty (0 bytes). Please choose a valid track.'
      };
    }

    // Check folder detection (size 0 or typical directory size patterns without extension)
    if (file.size === 0 && !file.type && !file.name.includes('.')) {
      return {
        valid: false,
        error: 'Folders cannot be uploaded directly. Please select an individual audio file.'
      };
    }

    // Check size limit (120 MB)
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: 'Audio file exceeds size limit (120 MB). Please choose a compressed track or trim the file before uploading.'
      };
    }

    // Check format by extension and MIME
    var ext = '.' + file.name.split('.').pop().toLowerCase();
    var hasValidExt = SUPPORTED_EXTS.indexOf(ext) !== -1;
    var hasValidMime = file.type ? SUPPORTED_MIMES.indexOf(file.type.toLowerCase()) !== -1 : false;

    if (!hasValidExt && !hasValidMime) {
      return {
        valid: false,
        error: 'Unsupported audio format (' + (ext || 'unknown') + '). SyncLines Studio accepts MP3, WAV, M4A, AAC, OGG, and FLAC files.'
      };
    }

    return { valid: true };
  }

  /**
   * Computes a normalized 64-bin peak waveform array from mono PCM channel.
   * @param {AudioBuffer} buffer
   * @returns {number[]} Array of normalized numbers (0.0 to 1.0)
   */
  function extractWaveform(buffer) {
    var numBins = WAVEFORM_BINS;
    var channelData = buffer.getChannelData(0); // Primary mono channel
    var blockSize = Math.floor(channelData.length / numBins);
    var peaks = [];
    var maxVal = 0.0001;

    for (var i = 0; i < numBins; i++) {
      var start = i * blockSize;
      var sum = 0;
      var peak = 0;
      for (var j = 0; j < blockSize; j++) {
        var val = Math.abs(channelData[start + j] || 0);
        if (val > peak) peak = val;
        sum += val;
      }
      var avg = sum / blockSize;
      var blended = (peak * 0.7) + (avg * 0.3);
      peaks.push(blended);
      if (blended > maxVal) maxVal = blended;
    }

    // Normalize
    for (var k = 0; k < numBins; k++) {
      peaks[k] = Math.min(1.0, Math.max(0.08, peaks[k] / maxVal));
    }

    return peaks;
  }

  /**
   * Checks if audio is silent.
   * @param {AudioBuffer} buffer
   * @returns {boolean}
   */
  function isBufferSilent(buffer) {
    var data = buffer.getChannelData(0);
    var step = Math.max(1, Math.floor(data.length / 5000));
    var maxAmp = 0;
    for (var i = 0; i < data.length; i += step) {
      var amp = Math.abs(data[i]);
      if (amp > maxAmp) maxAmp = amp;
      if (maxAmp > 0.002) return false;
    }
    return maxAmp < 0.001;
  }

  function drawWaveform(progress) {
    if (!waveformCanvas || !currentWaveform) return;
    var ctx = waveformCanvas.getContext('2d');
    var w = waveformCanvas.width;
    var h = waveformCanvas.height;
    ctx.clearRect(0, 0, w, h);

    var barWidth = (w / currentWaveform.length) - 2;
    progress = typeof progress === 'number' ? progress : 0;

    for (var i = 0; i < currentWaveform.length; i++) {
      var val = currentWaveform[i];
      var barH = Math.max(4, val * (h - 8));
      var x = i * (barWidth + 2);
      var y = (h - barH) / 2;

      var barProgress = i / currentWaveform.length;
      if (barProgress <= progress) {
        // Played section: Emerald gradient
        ctx.fillStyle = '#00ffb0';
      } else {
        // Unplayed section: Studio Gold / subtle charcoal
        ctx.fillStyle = 'rgba(226, 179, 74, 0.45)';
      }

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, barH, 2);
      } else {
        ctx.rect(x, y, barWidth, barH);
      }
      ctx.fill();
    }
  }

  function showNotice(msg, type) {
    if (!noticeEl) return;
    noticeEl.textContent = msg;
    noticeEl.className = 'studio-upload-notice studio-notice-' + (type || 'error');
    noticeEl.style.display = 'block';
  }

  function hideNotice() {
    if (!noticeEl) return;
    noticeEl.textContent = '';
    noticeEl.style.display = 'none';
  }

  function setDecodingState(active, text, progressPct) {
    isDecoding = active;
    if (decodingEl) decodingEl.style.display = active ? 'block' : 'none';
    if (dropzoneEl) dropzoneEl.style.display = active ? 'none' : (currentAudioBuffer ? 'none' : 'block');
    if (audioCardEl) audioCardEl.style.display = active ? 'none' : (currentAudioBuffer ? 'block' : 'none');

    if (decodingTextEl && text) decodingTextEl.textContent = text;
    if (decodeProgressBar) {
      decodeProgressBar.style.width = (progressPct || 0) + '%';
    }
    if (doneBtn) doneBtn.disabled = active || !currentAudioBuffer;
  }

  function resetAudioPlayer() {
    if (audioEl) {
      audioEl.pause();
      audioEl.removeAttribute('src');
      audioEl.load();
    }
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
    if (playIcon) playIcon.textContent = '▶';
    if (waveformPlayhead) waveformPlayhead.style.left = '0%';
    if (playerTimeEl) playerTimeEl.textContent = '00:00 / 00:00';
  }

  function resetState() {
    resetAudioPlayer();
    currentFile = null;
    currentBlob = null;
    currentAudioBuffer = null;
    currentWaveform = null;
    isDecoding = false;
    decodeCancelled = false;

    hideNotice();
    setDecodingState(false);

    if (dropzoneEl) dropzoneEl.style.display = 'block';
    if (audioCardEl) audioCardEl.style.display = 'none';
    if (fileInputEl) fileInputEl.value = '';
    if (doneBtn) doneBtn.disabled = true;
  }

  /**
   * Processes a single chosen File.
   * @param {File} file
   */
  function handleFile(file) {
    hideNotice();
    var val = validateFile(file);
    if (!val.valid) {
      showNotice(val.error, 'error');
      return;
    }

    resetAudioPlayer();
    currentFile = file;
    currentBlob = file;
    decodeCancelled = false;

    setDecodingState(true, 'Reading audio file...', 25);

    var reader = new FileReader();

    reader.onprogress = function (e) {
      if (e.lengthComputable) {
        var pct = 25 + Math.round((e.loaded / e.total) * 35);
        setDecodingState(true, 'Reading audio track into memory...', pct);
      }
    };

    reader.onerror = function () {
      setDecodingState(false);
      showNotice('Could not read the audio file from your device.', 'error');
    };

    reader.onload = function (e) {
      if (decodeCancelled) return;
      var arrayBuffer = e.target.result;
      var ctx = getAudioContext();

      if (!ctx) {
        setDecodingState(false);
        showNotice('Web Audio API is not supported in this browser.', 'error');
        return;
      }

      setDecodingState(true, 'Decoding audio spectrum & peaks...', 65);

      ctx.decodeAudioData(
        arrayBuffer,
        function (decodedBuffer) {
          if (decodeCancelled) return;
          setDecodingState(true, 'Finalizing audio analysis...', 95);

          // Duration checks
          if (decodedBuffer.duration > MAX_DURATION_SEC) {
            setDecodingState(false);
            showNotice(
              'Track length (' + formatTime(decodedBuffer.duration) + ') exceeds 15-minute studio limit. Please trim the file to 15 minutes or less.',
              'error'
            );
            return;
          }

          currentAudioBuffer = decodedBuffer;
          currentWaveform = extractWaveform(decodedBuffer);

          // Metadata population
          if (filenameEl) filenameEl.textContent = file.name;
          if (durationEl) durationEl.textContent = formatTime(decodedBuffer.duration);
          if (filesizeEl) filesizeEl.textContent = formatBytes(file.size);
          if (specsEl) specsEl.textContent = decodedBuffer.sampleRate + ' Hz • ' + (decodedBuffer.numberOfChannels === 1 ? 'Mono' : 'Stereo');

          // Initialize HTML5 audio preview
          currentObjectUrl = URL.createObjectURL(file);
          if (audioEl) {
            audioEl.src = currentObjectUrl;
            audioEl.load();
          }

          setDecodingState(false);
          drawWaveform(0);

          // Warnings
          if (decodedBuffer.duration < MIN_DURATION_SEC) {
            showNotice('Notice: Audio track is under 3 seconds. Visualizer render will be very brief.', 'warning');
          } else if (isBufferSilent(decodedBuffer)) {
            showNotice('Notice: Audio track appears to be silent. Visualizer will produce subtle ambient motion.', 'warning');
          }

          if (doneBtn) doneBtn.disabled = false;
        },
        function (decodeErr) {
          if (decodeCancelled) return;
          console.error('[StudioUpload] decodeAudioData error:', decodeErr);
          setDecodingState(false);
          showNotice(
            'Could not decode audio data. The file may be corrupted, protected by DRM, or use an uncommon codec. Try converting it to standard MP3 or WAV.',
            'error'
          );
        }
      );
    };

    reader.readAsArrayBuffer(file);
  }

  function bindEvents() {
    if (!modalEl) return;

    // File input trigger
    if (chooseBtn && fileInputEl) {
      chooseBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        fileInputEl.click();
      });
    }

    if (replaceBtn && fileInputEl) {
      replaceBtn.addEventListener('click', function () {
        fileInputEl.click();
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        resetState();
      });
    }

    if (cancelDecodeBtn) {
      cancelDecodeBtn.addEventListener('click', function () {
        decodeCancelled = true;
        resetState();
      });
    }

    if (fileInputEl) {
      fileInputEl.addEventListener('change', function () {
        if (fileInputEl.files && fileInputEl.files.length > 0) {
          handleFile(fileInputEl.files[0]);
        }
      });
    }

    // Drag and drop zone
    if (dropzoneEl) {
      dropzoneEl.addEventListener('click', function () {
        if (fileInputEl) fileInputEl.click();
      });

      dropzoneEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (fileInputEl) fileInputEl.click();
        }
      });

      ['dragenter', 'dragover'].forEach(function (eventName) {
        dropzoneEl.addEventListener(eventName, function (e) {
          e.preventDefault();
          e.stopPropagation();
          dropzoneEl.classList.add('is-dragover');
        });
      });

      ['dragleave', 'drop'].forEach(function (eventName) {
        dropzoneEl.addEventListener(eventName, function (e) {
          e.preventDefault();
          e.stopPropagation();
          dropzoneEl.classList.remove('is-dragover');
        });
      });

      dropzoneEl.addEventListener('drop', function (e) {
        var dt = e.dataTransfer;
        if (!dt || !dt.files || dt.files.length === 0) return;

        if (dt.files.length > 1) {
          if (UI && UI.showToast) {
            UI.showToast('Multiple files dropped. Processing first audio track: ' + dt.files[0].name, 'info');
          }
        }

        handleFile(dt.files[0]);
      });
    }

    // Audio preview play/pause
    if (playPauseBtn && audioEl) {
      playPauseBtn.addEventListener('click', function () {
        if (audioEl.paused) {
          audioEl.play().then(function () {
            if (playIcon) playIcon.textContent = '⏸';
          }).catch(function (err) {
            console.warn('[StudioUpload] Preview play prevented:', err);
          });
        } else {
          audioEl.pause();
          if (playIcon) playIcon.textContent = '▶';
        }
      });

      audioEl.addEventListener('timeupdate', function () {
        if (!audioEl.duration) return;
        var progress = audioEl.currentTime / audioEl.duration;
        if (waveformPlayhead) {
          waveformPlayhead.style.left = (progress * 100) + '%';
        }
        if (playerTimeEl) {
          playerTimeEl.textContent = formatTime(audioEl.currentTime) + ' / ' + formatTime(audioEl.duration);
        }
        drawWaveform(progress);
      });

      audioEl.addEventListener('ended', function () {
        if (playIcon) playIcon.textContent = '▶';
        if (waveformPlayhead) waveformPlayhead.style.left = '0%';
        drawWaveform(0);
      });
    }

    // Mini waveform interactive scrub
    if (waveformCanvas && audioEl) {
      waveformCanvas.addEventListener('click', function (e) {
        if (!audioEl.duration) return;
        var rect = waveformCanvas.getBoundingClientRect();
        var clickX = e.clientX - rect.left;
        var fraction = Math.max(0, Math.min(1, clickX / rect.width));
        audioEl.currentTime = fraction * audioEl.duration;
        drawWaveform(fraction);
      });
    }

    // Done button (Handoff to Style Studio)
    if (doneBtn) {
      doneBtn.addEventListener('click', function () {
        if (!currentAudioBuffer || !currentFile) return;

        var audioData = {
          blob: currentBlob,
          name: currentFile.name,
          size: currentFile.size,
          type: currentFile.type || 'audio/mpeg',
          duration: currentAudioBuffer.duration,
          sampleRate: currentAudioBuffer.sampleRate,
          channels: currentAudioBuffer.numberOfChannels,
          waveform: currentWaveform || []
        };

        // Run deterministic audio analysis
        var analysisEngine = (typeof window !== 'undefined' && window.StudioAudioAnalysis) || null;
        var rendererEngine = (typeof window !== 'undefined' && window.StudioRenderer) || null;
        if (analysisEngine && currentAudioBuffer) {
          try {
            var mono = analysisEngine.downmixToMono(currentAudioBuffer);
            var analysisResult = analysisEngine.analyzeTrack(mono, currentAudioBuffer.sampleRate);
            audioData.analysis = analysisResult;
            if (rendererEngine && typeof rendererEngine.setAnalysis === 'function') {
              rendererEngine.setAnalysis(analysisResult);
            }
          } catch (analysisErr) {
            console.warn('[StudioUpload] Audio analysis non-critical error:', analysisErr);
          }
        }

        // 1. Dispatch into StudioStore
        if (Store) {
          Store.dispatch({
            type: 'AUDIO_LOADED',
            payload: { audio: audioData }
          });
        }

        // 2. Persist in StudioStorage
        if (Storage) {
          Storage.saveAudioSession(audioData).catch(function (err) {
            console.warn('[StudioUpload] Could not persist audio to IndexedDB:', err);
            if (UI && UI.showToast) {
              UI.showToast('Audio saved in temporary memory for this session.', 'warning');
            }
          });
        }

        close();

        // 3. Navigate to Style Studio
        if (Router) {
          Router.navigate('#visualizer/styles');
        } else if (window.Studio && window.Studio.getRouter()) {
          window.Studio.getRouter().navigate('#visualizer/styles');
        }
      });
    }

    // Close actions
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl && !isDecoding) {
        close();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalEl && modalEl.style.display !== 'none') {
        if (!isDecoding) {
          e.preventDefault();
          close();
        }
      }
    });
  }

  function initElements() {
    modalEl = document.getElementById('studioUploadModal');
    dropzoneEl = document.getElementById('studioDropzone');
    fileInputEl = document.getElementById('studioAudioInput');
    decodingEl = document.getElementById('studioUploadDecoding');
    decodingTextEl = document.getElementById('studioDecodingText');
    decodeProgressBar = document.getElementById('studioDecodeProgressBar');
    audioCardEl = document.getElementById('studioAudioCard');
    noticeEl = document.getElementById('studioUploadNotice');
    doneBtn = document.getElementById('studioUploadDoneBtn');
    cancelBtn = document.getElementById('studioUploadCancelBtn');
    closeBtn = document.getElementById('studioUploadCloseBtn');
    chooseBtn = document.getElementById('studioChooseFileBtn');
    replaceBtn = document.getElementById('studioReplaceFileBtn');
    removeBtn = document.getElementById('studioRemoveAudioBtn');
    cancelDecodeBtn = document.getElementById('studioCancelDecodeBtn');

    audioEl = document.getElementById('studioPreviewAudio');
    waveformCanvas = document.getElementById('studioMiniWaveformCanvas');
    waveformPlayhead = document.getElementById('studioWaveformPlayhead');
    playPauseBtn = document.getElementById('studioPlayPauseBtn');
    playIcon = document.getElementById('studioPlayIcon');
    playerTimeEl = document.getElementById('studioPlayerTime');
    filenameEl = document.getElementById('studioAudioFilename');
    durationEl = document.getElementById('studioAudioDuration');
    filesizeEl = document.getElementById('studioAudioFilesize');
    specsEl = document.getElementById('studioAudioSpecs');
  }

  function open() {
    initElements();
    bindEvents();
    if (!modalEl) return;

    previousActiveElement = document.activeElement;

    // Check if Store already has audio
    var state = Store ? Store.getState() : null;
    if (state && state.audio && state.audio.waveform) {
      // Preload current audio into card
      currentAudioBuffer = {
        duration: state.audio.duration,
        sampleRate: state.audio.sampleRate,
        numberOfChannels: state.audio.channels
      };
      currentWaveform = state.audio.waveform;
      if (filenameEl) filenameEl.textContent = state.audio.name;
      if (durationEl) durationEl.textContent = formatTime(state.audio.duration);
      if (filesizeEl) filesizeEl.textContent = formatBytes(state.audio.size);
      if (specsEl) specsEl.textContent = state.audio.sampleRate + ' Hz • ' + (state.audio.channels === 1 ? 'Mono' : 'Stereo');

      if (dropzoneEl) dropzoneEl.style.display = 'none';
      if (audioCardEl) audioCardEl.style.display = 'block';
      if (doneBtn) doneBtn.disabled = false;
      drawWaveform(0);
    } else {
      resetState();
    }

    modalEl.style.display = 'flex';
    modalEl.setAttribute('aria-hidden', 'false');
    void modalEl.offsetWidth;
    modalEl.classList.add('is-open');

    // Move focus to modal
    setTimeout(function () {
      if (dropzoneEl && dropzoneEl.style.display !== 'none') {
        dropzoneEl.focus();
      } else if (closeBtn) {
        closeBtn.focus();
      }
    }, 60);
  }

  function close() {
    if (!modalEl) return;
    resetAudioPlayer();
    modalEl.classList.remove('is-open');
    setTimeout(function () {
      modalEl.style.display = 'none';
      modalEl.setAttribute('aria-hidden', 'true');
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        try { previousActiveElement.focus(); } catch (e) {}
      }
    }, 240);
  }

  return {
    open: open,
    close: close,
    validateFile: validateFile,
    formatTime: formatTime,
    formatBytes: formatBytes,
    extractWaveform: extractWaveform,
    isBufferSilent: isBufferSilent
  };
});
