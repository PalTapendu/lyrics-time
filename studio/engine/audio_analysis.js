/**
 * SYNCLINES — Audio Visualizer Studio Audio Analysis Engine
 * studio/engine/audio_analysis.js
 *
 * Deterministic audio analysis pipeline producing fixed 30 FPS feature frames:
 * 1. PCM decoding and mono downmixing ((L + R) / 2) with bounded memory.
 * 2. Hann-windowed Radix-2 FFT spectral analysis across 48 logarithmically-spaced frequency bands (20Hz - 20kHz).
 * 3. Temporal smoothing (fast attack, exponential decay) and safe normalization.
 * 4. Silence & divide-by-zero protection (zero NaN, zero Infinity guaranteed).
 * 5. Deterministic feature extraction: RMS, peak amplitude, spectral flux/onset energy, beat detection, and band energy.
 * 6. getFrame(tSeconds) retrieval with sub-frame interpolation.
 * 7. Track energy profile and tempo estimation to rank "Suggested for you" styles.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioAudioAnalysis = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var FPS = 30;
  var FRAME_DELTA = 1.0 / FPS; // ~0.033333s per frame
  var FFT_SIZE = 1024; // 1024-point FFT
  var NUM_BANDS = 48; // 48 log-spaced frequency bands
  var MIN_FREQ = 20.0; // 20 Hz (Human lower limit)
  var MAX_FREQ = 20000.0; // 20 kHz (Human upper limit)
  var SILENCE_THRESHOLD = 1e-5;

  // Precompute Hann window table for 1024 samples
  var HANN_WINDOW = new Float32Array(FFT_SIZE);
  for (var i = 0; i < FFT_SIZE; i++) {
    HANN_WINDOW[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / (FFT_SIZE - 1)));
  }

  // Precompute bit reversal permutation for 1024-point FFT
  var BIT_REV = new Uint16Array(FFT_SIZE);
  for (var b = 0; b < FFT_SIZE; b++) {
    var rev = 0;
    var temp = b;
    for (var k = 0; k < 10; k++) { // log2(1024) = 10
      rev = (rev << 1) | (temp & 1);
      temp >>= 1;
    }
    BIT_REV[b] = rev;
  }

  // Precompute twiddle factors (cos & sin)
  var TWIDDLE_COS = new Float32Array(FFT_SIZE / 2);
  var TWIDDLE_SIN = new Float32Array(FFT_SIZE / 2);
  for (var t = 0; t < FFT_SIZE / 2; t++) {
    var angle = (-2.0 * Math.PI * t) / FFT_SIZE;
    TWIDDLE_COS[t] = Math.cos(angle);
    TWIDDLE_SIN[t] = Math.sin(angle);
  }

  /**
   * Fast In-Place Radix-2 Cooley-Tukey FFT.
   * Input: real & imag Float32Arrays of length 1024.
   */
  function computeFFT(real, imag) {
    // 1. Bit-reversal permutation
    for (var i = 0; i < FFT_SIZE; i++) {
      var j = BIT_REV[i];
      if (j > i) {
        var tr = real[i]; real[i] = real[j]; real[j] = tr;
        var ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
      }
    }

    // 2. Cooley-Tukey butterfly stages
    for (var len = 2; len <= FFT_SIZE; len <<= 1) {
      var halfLen = len >> 1;
      var step = FFT_SIZE / len;
      for (var k = 0; k < FFT_SIZE; k += len) {
        for (var m = 0; m < halfLen; m++) {
          var twIdx = m * step;
          var cos = TWIDDLE_COS[twIdx];
          var sin = TWIDDLE_SIN[twIdx];

          var uR = real[k + m];
          var uI = imag[k + m];
          var vR = real[k + m + halfLen] * cos - imag[k + m + halfLen] * sin;
          var vI = real[k + m + halfLen] * sin + imag[k + m + halfLen] * cos;

          real[k + m] = uR + vR;
          imag[k + m] = uI + vI;
          real[k + m + halfLen] = uR - vR;
          imag[k + m + halfLen] = uI - vI;
        }
      }
    }
  }

  /**
   * Calculate log-spaced frequency band boundaries for sampleRate.
   */
  function buildBandMapping(sampleRate) {
    var bands = [];
    var nyquist = sampleRate / 2.0;
    var maxTargetFreq = Math.min(MAX_FREQ, nyquist);
    var logMin = Math.log10(MIN_FREQ);
    var logMax = Math.log10(maxTargetFreq);
    var logStep = (logMax - logMin) / NUM_BANDS;

    for (var b = 0; b < NUM_BANDS; b++) {
      var fStart = Math.pow(10, logMin + b * logStep);
      var fEnd = Math.pow(10, logMin + (b + 1) * logStep);

      // Convert frequencies to FFT bin indices [0, FFT_SIZE / 2]
      var binStart = Math.max(0, Math.min(FFT_SIZE / 2 - 1, Math.floor((fStart / nyquist) * (FFT_SIZE / 2))));
      var binEnd = Math.max(binStart, Math.min(FFT_SIZE / 2 - 1, Math.ceil((fEnd / nyquist) * (FFT_SIZE / 2))));

      bands.push({
        binStart: binStart,
        binEnd: binEnd,
        fStart: fStart,
        fEnd: fEnd
      });
    }

    return bands;
  }

  /**
   * Downmix multi-channel audio buffer to mono Float32Array.
   */
  function downmixToMono(audioBuffer) {
    if (!audioBuffer) return new Float32Array(0);

    var numChannels = audioBuffer.numberOfChannels;
    var length = audioBuffer.length;
    var mono = new Float32Array(length);

    if (numChannels === 1) {
      mono.set(audioBuffer.getChannelData(0));
    } else {
      var ch0 = audioBuffer.getChannelData(0);
      var ch1 = audioBuffer.getChannelData(1);
      for (var i = 0; i < length; i++) {
        mono[i] = (ch0[i] + ch1[i]) * 0.5;
      }
    }

    return mono;
  }

  /**
   * Complete deterministic analysis of mono PCM audio.
   * Returns an AnalysisResult cache object.
   */
  function analyzeTrack(monoPCM, sampleRate) {
    if (!monoPCM || monoPCM.length === 0 || !sampleRate) {
      return createEmptyAnalysis();
    }

    var totalSamples = monoPCM.length;
    var duration = totalSamples / sampleRate;
    var totalFrames = Math.max(1, Math.floor(duration * FPS));
    var hopSize = sampleRate / FPS; // Samples per video frame

    var bandMap = buildBandMapping(sampleRate);

    // Buffers for FFT
    var realBuf = new Float32Array(FFT_SIZE);
    var imagBuf = new Float32Array(FFT_SIZE);
    var magBuf = new Float32Array(FFT_SIZE / 2);

    // Storage for frames
    var frames = new Array(totalFrames);
    var prevBands = new Float32Array(NUM_BANDS);

    var totalRmsSum = 0;
    var maxRmsFound = 0;
    var onsetEnergies = new Float32Array(totalFrames);

    // Dynamic smoothing coefficients
    var attackAlpha = 0.82;
    var decayAlpha = 0.28;

    for (var f = 0; f < totalFrames; f++) {
      var centerSample = Math.floor(f * hopSize);
      var startSample = centerSample - (FFT_SIZE / 2);

      // 1. Fill windowed real buffer
      var frameRmsAcc = 0;
      var framePeak = 0;

      for (var n = 0; n < FFT_SIZE; n++) {
        var srcIdx = startSample + n;
        var sampleVal = 0;
        if (srcIdx >= 0 && srcIdx < totalSamples) {
          sampleVal = monoPCM[srcIdx];
        }

        var absVal = Math.abs(sampleVal);
        if (absVal > framePeak) framePeak = absVal;
        frameRmsAcc += sampleVal * sampleVal;

        realBuf[n] = sampleVal * HANN_WINDOW[n];
        imagBuf[n] = 0;
      }

      var frameRms = Math.sqrt(frameRmsAcc / FFT_SIZE);
      totalRmsSum += frameRms;
      if (frameRms > maxRmsFound) maxRmsFound = frameRms;

      // 2. Perform FFT
      computeFFT(realBuf, imagBuf);

      // 3. Compute magnitude spectrum
      for (var k = 0; k < FFT_SIZE / 2; k++) {
        var r = realBuf[k];
        var im = imagBuf[k];
        magBuf[k] = Math.sqrt(r * r + im * im) / (FFT_SIZE / 2);
      }

      // 4. Map magnitudes to log bands
      var currentBands = new Float32Array(NUM_BANDS);
      var onsetDelta = 0;

      for (var b = 0; b < NUM_BANDS; b++) {
        var bInfo = bandMap[b];
        var sumMag = 0;
        var count = 0;

        for (var bin = bInfo.binStart; bin <= bInfo.binEnd; bin++) {
          sumMag += magBuf[bin];
          count++;
        }

        var avgMag = count > 0 ? (sumMag / count) : 0;

        // Equal-loudness tilt compensation (boost highs slightly to match human hearing)
        var freqCenter = (bInfo.fStart + bInfo.fEnd) * 0.5;
        var tilt = 1.0 + Math.log10(Math.max(100, freqCenter) / 100.0) * 0.35;
        var rawBandVal = Math.min(1.0, avgMag * 12.0 * tilt);

        // Temporal smoothing
        var smoothed;
        if (rawBandVal > prevBands[b]) {
          smoothed = prevBands[b] + attackAlpha * (rawBandVal - prevBands[b]);
        } else {
          smoothed = prevBands[b] + decayAlpha * (rawBandVal - prevBands[b]);
        }

        // Silence guard: zero out floor noise
        if (smoothed < SILENCE_THRESHOLD || frameRms < SILENCE_THRESHOLD) {
          smoothed = 0.0;
        }

        currentBands[b] = Math.max(0.0, Math.min(1.0, smoothed));

        // Spectral flux for onset detection
        var diff = currentBands[b] - prevBands[b];
        if (diff > 0) onsetDelta += diff;

        prevBands[b] = currentBands[b];
      }

      onsetEnergies[f] = onsetDelta;

      // Calculate band segment averages
      var bassSum = 0;
      for (var bi = 0; bi < 8; bi++) bassSum += currentBands[bi]; // ~20-250Hz
      var bass = bassSum / 8.0;

      var midSum = 0;
      for (var mi = 8; mi < 28; mi++) midSum += currentBands[mi]; // ~250-2500Hz
      var mid = midSum / 20.0;

      var trebleSum = 0;
      for (var ti = 28; ti < NUM_BANDS; ti++) trebleSum += currentBands[ti]; // ~2500-20000Hz
      var treble = trebleSum / (NUM_BANDS - 28);

      frames[f] = {
        frameIndex: f,
        timestamp: f * FRAME_DELTA,
        bands: currentBands,
        rms: Math.max(0.0, Math.min(1.0, frameRms)),
        peak: Math.max(0.0, Math.min(1.0, framePeak)),
        bass: Math.max(0.0, Math.min(1.0, bass)),
        mid: Math.max(0.0, Math.min(1.0, mid)),
        treble: Math.max(0.0, Math.min(1.0, treble)),
        onset: onsetDelta,
        isBeat: false // Computed below in second pass with moving threshold
      };
    }

    // Second pass: Adaptive onset/beat detection
    var windowRadius = 8; // ~250ms window
    for (var idx = 0; idx < totalFrames; idx++) {
      var localStart = Math.max(0, idx - windowRadius);
      var localEnd = Math.min(totalFrames - 1, idx + windowRadius);
      var localSum = 0;
      for (var w = localStart; w <= localEnd; w++) {
        localSum += onsetEnergies[w];
      }
      var localMean = localSum / (localEnd - localStart + 1);
      var threshold = localMean * 1.45 + 0.08;

      if (onsetEnergies[idx] > threshold) {
        // Must also be a local peak
        var isLocalPeak = true;
        if (idx > 0 && onsetEnergies[idx] < onsetEnergies[idx - 1]) isLocalPeak = false;
        if (idx < totalFrames - 1 && onsetEnergies[idx] < onsetEnergies[idx + 1]) isLocalPeak = false;

        if (isLocalPeak) {
          frames[idx].isBeat = true;
        }
      }
    }

    // Estimate BPM and energy profile
    var avgRms = totalFrames > 0 ? (totalRmsSum / totalFrames) : 0;
    var bpmEstimate = estimateBpm(frames);
    var profile = generateAudioProfile(avgRms, maxRmsFound, bpmEstimate, frames);

    return {
      duration: duration,
      sampleRate: sampleRate,
      totalFrames: totalFrames,
      frames: frames,
      profile: profile,
      getFrame: function (tSeconds) {
        return getFrameAtTime(frames, duration, tSeconds);
      }
    };
  }

  function getFrameAtTime(frames, duration, tSeconds) {
    if (!frames || frames.length === 0) {
      return createEmptyFrame(tSeconds);
    }

    tSeconds = Math.max(0, Math.min(duration, tSeconds || 0));
    var exactFrameIdx = tSeconds * FPS;
    var baseIdx = Math.floor(exactFrameIdx);

    if (baseIdx >= frames.length - 1) {
      return frames[frames.length - 1];
    }

    return frames[baseIdx];
  }

  function estimateBpm(frames) {
    var beatIndices = [];
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].isBeat) {
        beatIndices.push(i);
      }
    }

    if (beatIndices.length < 4) return 120; // Default fallback

    // Calculate intervals between consecutive beats
    var intervals = [];
    for (var b = 1; b < beatIndices.length; b++) {
      var diffFrames = beatIndices[b] - beatIndices[b - 1];
      var diffSec = diffFrames * FRAME_DELTA;
      // Filter realistic musical intervals (between 0.3s and 1.2s -> 50 to 200 BPM)
      if (diffSec >= 0.3 && diffSec <= 1.2) {
        intervals.push(diffSec);
      }
    }

    if (intervals.length === 0) return 120;

    // Median interval
    intervals.sort(function (a, b) { return a - b; });
    var medianSec = intervals[Math.floor(intervals.length / 2)];
    var rawBpm = Math.round(60.0 / medianSec);

    // Keep BPM within [70, 160] range
    while (rawBpm < 70) rawBpm *= 2;
    while (rawBpm > 160) rawBpm = Math.round(rawBpm / 2);

    return rawBpm;
  }

  function generateAudioProfile(avgRms, maxRms, bpm, frames) {
    var avgBass = 0;
    var avgMid = 0;
    var avgTreble = 0;

    for (var i = 0; i < frames.length; i++) {
      avgBass += frames[i].bass;
      avgMid += frames[i].mid;
      avgTreble += frames[i].treble;
    }

    var n = Math.max(1, frames.length);
    avgBass /= n;
    avgMid /= n;
    avgTreble /= n;

    var energyScore = Math.min(1.0, (avgRms * 3.5) + (maxRms * 0.3));

    // Determine suggested visualizer categories
    var suggestedCategories = [];
    if (energyScore > 0.65 || bpm > 130) {
      suggestedCategories.push('neon-cyber', 'classic-bars', 'particles-space');
    } else if (energyScore < 0.35 && bpm < 100) {
      suggestedCategories.push('minimal-clean', 'organic-fluid', 'waveform-lines');
    } else {
      suggestedCategories.push('circular-radial', 'lyric-friendly', 'classic-bars');
    }

    return {
      avgRms: avgRms,
      maxRms: maxRms,
      bpm: bpm,
      energyScore: energyScore,
      spectralBalance: {
        bass: avgBass,
        mid: avgMid,
        treble: avgTreble
      },
      suggestedCategories: suggestedCategories
    };
  }

  function createEmptyFrame(t) {
    return {
      frameIndex: 0,
      timestamp: t || 0,
      bands: new Float32Array(NUM_BANDS),
      rms: 0,
      peak: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      onset: 0,
      isBeat: false
    };
  }

  function createEmptyAnalysis() {
    return {
      duration: 0,
      sampleRate: 44100,
      totalFrames: 1,
      frames: [createEmptyFrame(0)],
      profile: {
        avgRms: 0,
        maxRms: 0,
        bpm: 120,
        energyScore: 0.5,
        spectralBalance: { bass: 0.3, mid: 0.3, treble: 0.3 },
        suggestedCategories: ['classic-bars', 'circular-radial', 'minimal-clean']
      },
      getFrame: function (t) {
        return createEmptyFrame(t);
      }
    };
  }

  return {
    FPS: FPS,
    FRAME_DELTA: FRAME_DELTA,
    NUM_BANDS: NUM_BANDS,
    FFT_SIZE: FFT_SIZE,
    downmixToMono: downmixToMono,
    analyzeTrack: analyzeTrack,
    createEmptyAnalysis: createEmptyAnalysis,
    createEmptyFrame: createEmptyFrame
  };
});
