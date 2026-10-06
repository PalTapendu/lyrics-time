# Business Logic & Algorithms

> Core workflows, math, and pseudocode for all functional subsystems. Written for maximum information density without bloated code dumps.

---

## 1. Hero Audio Synthesis & Playback (`script.js`)

Hero 1 (`index.html`) includes a full standalone audio engine that generates synthetic audio completely in memory without loading external audio assets.

### Procedural PCM WAV Generation (`buildDreamsAcousticTrack()`)
- **Format**: 16-bit signed stereo PCM, 44.1 kHz, 30.0-second seamless loop (~5.29 MB ArrayBuffer).
- **Structure**: 12 bars (2.50s per bar) with bass, acoustic pluck chords, and final C-Major cadence resolve at 28.75s–30.0s.
- **Synthesis Algorithms**:
  - `addBass(freq, startSample, amp, duration)`: Sine wave fundamental + 2nd harmonic, exponential decay envelope.
  - `addPluck(freq, startSample, amp, duration, pan)`: Karplus-Strong style multi-harmonic decayed plucked string with stereo panning.
- **Output**: ArrayBuffer encoded with 44-byte standard RIFF/WAVE header, converted into `Blob([wavBytes], { type: 'audio/wav' })`, then `URL.createObjectURL(blob)` passed to `new Audio(url)`.

### Playback & Time Tracking Loop
- Synchronized via `requestAnimationFrame(mainLoop)`:
  ```
  currentSec = isPlaying ? (heroAudio.currentTime % 30.0) : (playheadPercent * 30.0)
  playheadPercent = currentSec / 30.0
  updatePlayhead(playheadPercent)        // updates #ph translateX and #tip text
  checkLyricProgression(currentSec)     // updates #hl translateY, row highlights, #np badge
  checkPianoSongSync(currentSec)        // triggers piano keys matching musical score
  ```
- **Timeline Scrubbing**: Clicking/dragging `.waveform-panel` calculates `clickX / rect.width`, updates `playheadPercent`, sets `heroAudio.currentTime`, and syncs lyric rows and piano score.
- **Waveform Animation**: While playing, 120 SVG `<rect>` elements oscillate using noise-modulated sine waves based on audio amplitude envelopes.

---

## 2. Live Harmonic Piano Engine (`piano.js`)

Sibling widget inside Hero 1 `.lower-section`, managing an interactive/self-playing SVG piano.

### Sound Synthesis (Web Audio API)
- **Polyphonic Synthesizer**: Up to 12 simultaneous active voices.
- **Default State**: Muted on initial page load (`isMuted = true`). Unmuted when user clicks mute button or calls `window.activateLivePiano()`.
- **Note Specs**: 12 chromatic keys (C4 to B4), 7 white keys + 5 black keys with calibrated frequencies (261.63 Hz to 493.88 Hz).
- **Voice Architecture**:
  ```
  Oscillator 1 (Sine, Fundamental freq)   \
  Oscillator 2 (Triangle, 2nd Harmonic)    --> Note Gain (ADSR) --> Lowpass Filter (2800 Hz) --> Master Gain --> Destination
  Oscillator 3 (Sine, 3rd Harmonic 0.18x) /
  ```
  - **ADSR Envelope**: Attack 0.012s, Decay 0.28s to sustain level 0.22, Release 0.55s.

### Dual Operating Modes
1. **Interactive / User Input**:
   - Mouse click / touch on SVG keys.
   - Physical keyboard mapping (`A, S, D, F, G, H, J` for white keys; `W, E, T, Y, U` for black keys).
2. **Auto-Playing Demo vs Hero Song Sync**:
   - If Hero song is playing (`window.isHeroSongPlaying() === true`): Piano plays synchronously with the song's score (`songPianoNotes` array in `script.js`).
   - If Hero song is idle: Runs an autonomous pentatonic arpeggio sweep across keys.
   - Key visual feedback: Key glow on Canvas 2D + SVG key depression animation.

---

## 3. Audio Visualizer 3D Scene Logic (`scene.js`)

Drives the Hero 2 Canvas 2D scene: a perspective-warped acoustic mesh grid and ambient particles.

### Canvas Sizing & High-DPI Scaling
- Internal reference coordinate space: 1236 × 672.
- Canvas buffer is scaled by `scale * currentDPR` where `scale = W / 1236`.
- DPR capped and rounded to prevent fractional canvas blur.

### 3D Warped Mesh Grid Algorithm
Grid vertices $(u, v)$ with $u, v \in [-2.2, 2.2]$ at step 0.145 are projected to screen coordinates $(x, y)$:

```
r2 = u*u + v*v
bowl = exp(-r2 / 0.55)
bowlDepth = 170 + sin(time * 0.4) * 5 + sin(time * 0.67) * 3

// Acoustic Click Shockwaves
ripDisp = sum_over_ripples( sin((dist - radius) * 6) * exp(-((dist - radius)*2.5)^2) * intensity * 26 )

// 2D Projection with Affine Skew
x = (cx + cxOff) + (u - v * 0.85) * sx * 0.95
baseY = (cy + cyOff) + (u + v) * sy + bowl * bowlDepth - 30 * exp(-r2 / 2.2) + ripDisp

// Mouse Hover Surface Tension (Lift & Local Ripple)
y = baseY + hoverDisp
```

### Shockwave Ripples
- Clicks on the visualizer canvas spawn a ripple object `{ u, v, radius, intensity, startTime }`.
- Active ripples capped at 4 for performance. Intensity decays linearly over 1.6s.

### Mouse Parallax & Hover Spring Lerp
- Mouse coordinates normalized to $[-0.5, 0.5]$.
- Position smoothed via exponential spring lerp: `mouseSmX += (mouseNX - mouseSmX) * 0.06`.
- Screen-space hover target tracks pointer with smooth momentum (`* 0.10`).

---

## 4. Editor Core Functional Logic (`editor/app.js`)

A zero-backend client-side tagging workstation for lyric and subtitle synchronization.

### Audio Ingestion & Waveform Peak Decoding
1. User drops/selects an audio file (`<input type="file" id="audioFile">`).
2. HTML5 `<audio id="player">` receives object URL for playback.
3. Simultaneously, `FileReader` reads file as `ArrayBuffer`.
4. `AudioContext.decodeAudioData()` decodes raw PCM audio.
5. `computePeaks(buffer, 4000)`:
   - Slices audio buffer into 4,000 buckets.
   - Extracts peak absolute amplitude per bucket across left/right channels (sampled every 3rd sample for performance).
   - Normalizes all peaks against maximum peak to 0.95 scale.
6. Stored in `waveformPeaks = Float32Array(4000)`. Renders main waveform and bottom minimap.

### Lyric Parsing & Splitting
- **Line Mode**: Splits input text by `/\r?\n/`, trims whitespace, rejects blank lines.
- **Word Mode**: Splits input text by `/\s+/`, generating individual word tokens.
- Creates state items: `items = parts.map(text => ({ text, start: null, end: null, _revert: null }))`.

### Tagging Capture Modes
| Mode | Capture Goal | Advancing Behavior |
|------|--------------|-------------------|
| **Start Only** (`activeCapture = 'start'`) | Single timestamp per line. | Tagging Start immediately advances cursor to next line. |
| **Start & End** (`activeCapture = 'both'`) | Two timestamps per line. | First tag sets Start; cursor remains on line. Second tag sets End; cursor advances. |

### Tagging Interaction Paradigms
- **Buttons Mode**: Explicit `[Start]` and `[End]` buttons per row.
- **Click Line Mode**: Entire row is a button. Clicking sets Start, next click sets End (or retags).
- **Keyboard Shortcuts**: `S` sets Start on active line; `E` sets End on active line; `Space` toggles play/pause; `←/→` seeks 2s (5s with Shift); `+/-` zooms timeline.

### Stationary Hit-Target Conveyor Algorithm (`advanceScrollToNext`)
To prevent the user from moving their mouse down the screen as they tag:
1. Measures the exact viewport offset of the line just tagged: `taggedOffset = taggedRect.top - panelRect.top`.
2. Re-renders lyric list and advances `cursorIndex`.
3. Measures the new active line's position: `nextOffset = nextRect.top - panelRect.top`.
4. Calculates delta: `delta = nextOffset - taggedOffset`.
5. Animates `lyricsPanel.scrollTop += delta` via GSAP / smooth scroll.
6. **Result**: The next line glides into the exact same physical screen position under the mouse pointer.

### Forward-Only Cursor Advance
- Highlighting only moves forward. If an earlier line is skipped, `cursorIndex` stays on current progress.
- Skipped lines are flagged with `.skipped` class and an interactive skipped badge indicator.

### Timeline Zoom & View Math
- Visible duration: `visibleDur = duration / zoom`.
- Clamped view: `viewStart = clamp(0, duration - visibleDur, viewStart)`.
- Coordinate mappings:
  - `timeToX(t, width) = ((t - viewStart) / visibleDur) * width`
  - `xToTime(x, width) = viewStart + (x / width) * visibleDur`
- Interactive lyric blocks on timeline track can be dragged to shift time, or edges dragged to resize Start/End.

### Correction, Undo, and Revert
- **Per-Line Revert (↺)**: Stored in `item._revert = { field, value }`. One click restores previous timestamp.
- **Global Undo**: `history` array stores `{ idx, field, prevValue, cursorBefore }`. Pops last action and restores previous cursor position.
- **Manual Nudge**: `±0.1s` step buttons.
- **Direct Edit**: Text input accepting `mm:ss.mmm` (e.g. `01:23.450`) or decimal seconds (`83.45`).

### Session Persistence & Autosave
- **Autosave**: Every change writes to `localStorage['timing-console-autosave']` (debounced).
- **Rolling History**: Keeps up to 20 session snapshots in `localStorage['timing-console-history']`. Updates snapshots within 45 seconds in-place.
- **Export/Import Session**: Serializes entire workspace state (lyrics, timestamps, mode, audio filename) to `.json`.

### Export Formatting Algorithms

#### 1. LRC (`generateLRC`)
```
[mm:ss.xx]Line text
```
- Centisecond precision (`Math.floor(msRem / 10)`).
- Filtered to items where `start != null`, sorted chronologically.

#### 2. SRT (`generateSRT`)
```
1
hh:mm:ss,mmm --> hh:mm:ss,mmm
Line text
```
- Millisecond precision separated by comma.
- Fallback end time: if line has no End, uses next line's Start or `start + 2.0s`.

#### 3. WebVTT (`generateVTT`)
```
WEBVTT

hh:mm:ss.mmm --> hh:mm:ss.mmm
Line text
```
- Standard WebVTT syntax with dot millisecond delimiter.

#### 4. TXT (`generateTXT`)
```
[hh:mm:ss.mmm --> hh:mm:ss.mmm] (duration 3.450s)
Line text
```
- Human-readable format with explicit duration metrics and estimated tags if applicable.

### Tactile Audio Clicks (`playHapticTick`)
- Uses Web Audio API oscillator (`sine` wave at 1050 Hz for Start, 780 Hz for End) with exponential gain decay (35ms duration) to give realistic tactile click feedback on each tag. Can be toggled on/off in header.
