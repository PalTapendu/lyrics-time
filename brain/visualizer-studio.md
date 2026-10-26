# SyncLines Audio Visualizer Studio — Architecture & Technical Specification

> **Document Version:** 1.0.0  
> **Status:** Active / Authoritative Memory File  
> **Last Updated:** 2026-10-23  
> **Location:** `brain/visualizer-studio.md`

---

## 1. Executive Summary & Purpose

The **Audio Visualizer Studio** is an in-browser, client-side motion graphics engine for the SyncLines audio platform. It enables musicians, podcasters, and creators to transform raw audio tracks into synchronized, high-definition video visualizers (MP4 formatted in 16:9, 9:16, 1:1, or 4:5 aspect ratios) entirely within the browser.

### Core Product Principles
1. **Zero Cloud Upload (Privacy Guarantee):** Audio decoding, spectral analysis, canvas rendering, and video muxing execute 100% locally on the user's hardware. Audio data is never transmitted to any external server or CDN.
2. **Deterministic Output:** Live canvas previews and final video exports share an identical frame-generation pipeline (`getFrame(tSeconds)`), guaranteeing that "what you preview is what you export."
3. **Zero-Bloat Landing Page:** The studio infrastructure is strictly lazy-loaded on user intent (upload hover/click or route entry). The static landing page footprint remains unchanged.
4. **Honest User Communication:** No simulated files or fake download links. Until the WebCodecs export engine passes validation (Prompt 9), all test outputs are labeled as "Demo Preview."

---

## 2. Product Flow Architecture

```mermaid
flowchart TD
    A[Visualizer Landing Page\n#visualizer] -->|Click Upload Track| B{Studio Flag Active?}
    B -->|Flag OFF| C[Legacy 'Coming Soon' Modal]
    B -->|Flag ON or ?studio=preview| D[Upload Popup / Dialog\nDrag & drop, validate, preview]
    D -->|Audio Validated & Stored| E[Style Studio Screen\n#visualizer/styles\nAudio Card, Suggested Row, Grid]
    E -->|Select Style & Continue| F[Render Settings Screen\n#visualizer/settings\nRatio, 720p/1080p, Trim, Live Estimates]
    F -->|Start Render| G[Processing Screen\n#visualizer/render\nStage progress, ETA, Wake Lock, Cancel]
    G -->|Render Finished| H[Result Screen\n#visualizer/result\nVideo Preview, Download, Share, Retry]
    H -->|Try Another Style| E
    H -->|Change Settings| F
```

---

## 3. Architecture & Design Decisions

| Decision Topic | Choice | One-Line Rationale |
| :--- | :--- | :--- |
| **Code Location** | `studio/` directory | Avoids legacy `/visualizer/` folder which is permanently blocked in `robots.txt`. |
| **Module Format** | Universal Module / ES Modules with lazy dynamic `import()` | Keeps initial landing page weight identical; loaded only on demand via idle/hover prefetch. |
| **State Machine** | Strict unidirectional finite state machine (FSM) | Prevents invalid transitions, sticky modal states, and broken UI recovery paths. |
| **Sub-View Routing** | Hash sub-routes `#visualizer/*` within existing DOM shell | Integrates seamlessly with existing `switchView()` and `popstate` without full-page reloads. |
| **Data Persistence** | IndexedDB (`synclines_studio_db`) + TTL + Memory Fallback | Supports large audio blobs (>50MB) across tab refreshes with graceful in-memory private browsing mode. |
| **Audio Limits** | Max 15 minutes / 120 MB file cap | Binds decoded PCM memory safely within modern browser tab memory limits (~250MB ceiling). |
| **Memory Strategy** | Mono downmixing + chunked analysis | Halves analysis memory footprint (mono vs stereo) and avoids main-thread OOM crashes. |
| **Error Taxonomy** | Explicit error codes with human-readable recovery suggestions | Eliminates cryptic technical stack traces and gives users actionable resolution steps. |
| **Export Engine** | WebCodecs (`VideoEncoder` + `AudioEncoder`) + MP4 Muxer | Enables native hardware-accelerated rendering at up to 60fps without cloud rendering costs. |
| **Fallback Export** | MediaRecorder (WebM/MP4) with honest throughput label | Gracefully supports non-WebCodecs browsers with realistic time warnings. |
| **Safety Guard** | Global photosensitivity luminance/flash limiter (WCAG 2.3.1) | Protects users with photosensitive epilepsy by capping flash rates to <= 3 per second. |
| **Testing Approach** | Headless automated scripts + Python QA harness + Browser testing | Ensures deterministic audio analysis, frame-accuracy, and memory stability. |

---

## 4. Feature Flags & Dev Preview Switch

Configuration lives in [`studio/config.js`](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/studio/config.js):

```javascript
const StudioConfig = {
  enabled: false,    // Master switch: Live site remains on Coming Soon modal until Prompt 9
  demoMode: true,   // Demo mode: Processing/result screens present transparent demo simulation
  SESSION_PREVIEW_KEY: 'synclines-studio-preview'
};
```

### Dev Preview Activation
- **Enable Dev Preview:** Load page with `?studio=preview` (persisted into `sessionStorage`).
- **Disable Dev Preview:** Load page with `?studio=off` (clears `sessionStorage`).
- **Public Behavior:** When `enabled: false` and no session override exists, clicking `#btn-upload-hero` or `#top-upload-btn` (on Hero 2) displays the legacy "Coming Soon" modal.

---

## 5. State Machine Specification

### States
- `idle`: No audio uploaded; Studio shell inactive.
- `audioReady`: Audio file validated, decoded, and stored in IndexedDB/memory.
- `styleSelected`: Visualizer style picked from the catalog.
- `configured`: Aspect ratio, resolution, and trim bounds set.
- `rendering`: Video frame rendering & encoding in progress.
- `done`: Video muxed and ready for download/preview.
- `error`: Recoverable or unrecoverable error encountered.
- `cancelled`: Job aborted by user; resources cleanly dismantled.

### State Transition Table

| Current State | Event / Trigger | Target State | Guards & Actions |
| :--- | :--- | :--- | :--- |
| `idle` | `AUDIO_VALIDATED` | `audioReady` | Audio metadata & buffer stored; route to `#visualizer/styles`. |
| `audioReady` | `STYLE_SELECT` | `styleSelected` | Style ID assigned; bottom action bar shown. |
| `audioReady` | `AUDIO_REPLACE` | `idle` / `audioReady` | Previous audio cleared, new file picker opened. |
| `styleSelected` | `NAV_SETTINGS` | `configured` | Verify style supports chosen defaults; route to `#visualizer/settings`. |
| `configured` | `START_RENDER` | `rendering` | Check browser capabilities; acquire Wake Lock; route to `#visualizer/render`. |
| `configured` | `BACK_TO_STYLES` | `styleSelected` | Return to `#visualizer/styles`; preserve audio. |
| `rendering` | `RENDER_COMPLETE` | `done` | Release Wake Lock; verify output blob; route to `#visualizer/result`. |
| `rendering` | `RENDER_ERROR` | `error` | Release Wake Lock; collect diagnostics; display error card. |
| `rendering` | `CANCEL_RENDER` | `cancelled` | AbortController fired; buffers freed; route back to `#visualizer/settings`. |
| `done` | `START_OVER` | `idle` | Clear audio & render state; route to `#visualizer`. |
| `done` | `TRY_ANOTHER_STYLE`| `audioReady` | Retain audio & settings; route to `#visualizer/styles`. |
| `error` | `RETRY` | `configured` / `rendering` | Re-attempt operation with exponential backoff or safe defaults. |

---

## 6. Sub-View Routes Inside Shell

The Audio Visualizer view (`#view-hero2`) hosts a dedicated sub-view router (`#visualizer/*`). The global header (`#top`) and sidebar (`#side`) remain fixed and responsive.

| Route | Sub-View Displayed | Prerequisite Guard | On Guard Failure Action | Title |
| :--- | :--- | :--- | :--- | :--- |
| `#visualizer` | Landing Hero Panel | None | Direct render | `Audio Visualizer — SyncLines Pro Engine` |
| `#visualizer/styles` | Style Studio Catalog | Audio file in state (`audioReady`) | Redirect to `#visualizer` + Toast ("Please upload audio first") | `Choose Style — Audio Visualizer Studio` |
| `#visualizer/settings`| Render & Trim Settings | Audio + Style selected | Redirect to `#visualizer/styles` | `Render Settings — Audio Visualizer Studio` |
| `#visualizer/render` | Processing Progress | Valid render job initialized | Redirect to `#visualizer/settings` | `Rendering Video — Audio Visualizer Studio` |
| `#visualizer/result` | Result & Download | Completed render blob | Redirect to `#visualizer` + Toast ("No completed video found") | `Your Video is Ready — Audio Visualizer Studio` |

---

## 7. Persistence & Privacy Architecture

### Storage Scheme: IndexedDB (`synclines_studio_db`, v1)
- **Object Store:** `audio_sessions`
  - `key`: `'active_session'`
  - `fields`:
    - `audioBlob`: Raw audio `Blob`
    - `meta`: `{ name, size, type, duration, sampleRate, channels }`
    - `waveform`: Downsampled float array for mini-waveform rendering
    - `timestamp`: Date added
    - `ttl`: 24 hours (86,400,000 ms)
- **Object Store:** `studio_prefs`
  - `key`: `'user_preferences'`
  - `fields`: `{ lastRatio, lastResolution, favorites: [], recentlyUsed: [] }`

### Privacy & Cleanup Controls
- **Auto-Eviction:** On Studio initialization, any session record with `(Date.now() - timestamp) > ttl` is permanently purged.
- **"Clear My Data" Action:** A visible control accessible in settings and footer wipes `synclines_studio_db` completely.
- **Private Mode / Quota Exceeded Fallback:** If `window.indexedDB` is restricted or throws `QuotaExceededError`, the storage driver automatically switches to an in-memory `Map()`, presenting a non-blocking toast: *"Private session: audio kept in memory for this tab only."*

---

## 8. Audio Limits & Memory Safe Budget

### Calculated PCM Memory Footprint
*Formula:* `Memory (Bytes) = durationInSeconds * sampleRate * channels * 4 (Float32)`

| Audio Duration | 44.1 kHz Stereo (Raw PCM) | 44.1 kHz Mono (Analysis Downmix) | Status |
| :--- | :--- | :--- | :--- |
| **30 Seconds** | 10.5 MB | 5.2 MB | Optimal |
| **3 Minutes** | 63.5 MB | 31.7 MB | Optimal |
| **5 Minutes** | 105.8 MB | 52.9 MB | Optimal |
| **10 Minutes** | 211.6 MB | 105.8 MB | Memory Warning / Downmix Enforced |
| **15 Minutes** | 317.5 MB | 158.7 MB | Platform Maximum Limit |

### Enforcement Rules
1. **Max File Size:** `120 MB` (Early refusal during drag-and-drop validation).
2. **Max Duration:** `15 Minutes` (`900 seconds`). Files exceeding this display: *"SyncLines Studio supports tracks up to 15 minutes to guarantee in-browser stability."*
3. **Downmix Strategy:** Stereo audio is preserved as a lightweight encoded `Blob` for video muxing, while analysis decodes exclusively into a **mono downmix** buffer, halving memory usage.
4. **Early Freeing:** Decoded `AudioBuffer` analysis instances are released via garbage collection as soon as the deterministic spectral frame cache is computed.

---

## 9. Error Taxonomy & Human Messaging

| Error Code | User-Friendly Message | Actionable Resolution | Recoverable |
| :--- | :--- | :--- | :--- |
| `AUDIO_UNSUPPORTED_TYPE` | "This file format is not supported." | "Please upload an MP3, WAV, M4A, AAC, OGG, or FLAC audio file." | Yes |
| `AUDIO_EMPTY_FILE` | "The selected audio file is empty (0 bytes)." | "Please select a valid audio file from your device." | Yes |
| `AUDIO_FILE_TOO_LARGE` | "Audio file exceeds size limit (120 MB)." | "Please choose a compressed track or trim the file before uploading." | Yes |
| `AUDIO_DURATION_TOO_LONG` | "Track length exceeds 15-minute studio limit."| "Please trim your track to 15 minutes or less." | Yes |
| `AUDIO_DURATION_TOO_SHORT`| "Audio track is too short (under 3 seconds)." | "Please upload an audio track at least 3 seconds long." | Yes |
| `AUDIO_DECODE_FAILED` | "Could not decode audio data." | "The file may be corrupted or DRM-protected. Try converting it to standard MP3 or WAV." | Yes |
| `AUDIO_SILENT_WARNING` | "Audio track appears to be silent." | "The visualizer will respond with minimal motion. You may proceed or pick another file." | Warning |
| `BROWSER_UNSUPPORTED_CODEC`| "Your browser does not support hardware MP4 encoding." | "We recommend using Google Chrome, Microsoft Edge, or a modern desktop browser." | Fallback available |
| `STORAGE_QUOTA_EXCEEDED` | "Browser storage limit reached." | "Audio is running in temporary memory for this tab. It will reset if you close the tab." | Non-fatal |
| `RENDER_TIMEOUT_HIDDEN` | "Rendering paused because the tab was hidden." | "Please keep this browser tab active and visible while your video renders." | Yes |
| `RENDER_ENCODE_CRASH` | "Video encoding failed unexpectedly." | "Try reducing resolution to 720p or closing other intensive browser tabs." | Yes |

---

## 10. Browser Capability Matrix & Feature-Detection

```javascript
const StudioCapabilities = {
  webCodecsVideo: typeof VideoEncoder !== 'undefined',
  webCodecsAudio: typeof AudioEncoder !== 'undefined',
  offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
  webWorkers: typeof Worker !== 'undefined',
  fileSystemAccess: typeof window.showSaveFilePicker === 'function',
  wakeLock: 'wakeLock' in navigator,
  indexedDB: typeof indexedDB !== 'undefined',
  mediaRecorder: typeof MediaRecorder !== 'undefined'
};
```

| Browser / Platform | WebCodecs Video (H.264) | WebCodecs Audio (AAC) | Offscreen Canvas | Primary Pipeline | Fallback Pipeline |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Chrome / Edge (Desktop 94+)** | Full | Full | Full | Direct WebCodecs Worker | Not needed |
| **Firefox (Desktop 130+)** | Partial / Flag | Partial | Full | WebCodecs (if enabled) | MediaRecorder Real-time |
| **Safari (macOS 16.4+)** | Full | Partial | Full | WebCodecs / MediaRecorder | MediaRecorder MP4 |
| **Mobile Chrome (Android)** | Full | Full | Full | WebCodecs 720p default | MediaRecorder |
| **Mobile Safari (iOS 16.4+)** | Full | Restricted | Full | WebCodecs / Web Share | Direct Web Share Blob |

*Rule:* Never assume codec availability. Always invoke `VideoEncoder.isConfigSupported()` and `AudioEncoder.isConfigSupported()` before initiating render jobs.

---

## 11. Style Schema Specification (`styles.json`)

Each visualizer preset conforms to the following schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "name", "category", "tags", "supportedRatios", "thumbnail", "status", "defaultParams"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "name": { "type": "string" },
    "category": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "supportedRatios": { "type": "array", "items": { "enum": ["16:9", "9:16", "1:1", "4:5"] } },
    "thumbnail": {
      "type": "object",
      "required": ["src", "w", "h"],
      "properties": {
        "src": { "type": "string" },
        "w": { "type": "integer" },
        "h": { "type": "integer" }
      }
    },
    "previewVideo": { "type": "string" },
    "status": { "enum": ["placeholder", "ready"] },
    "palette": {
      "type": "object",
      "properties": {
        "primary": { "type": "string" },
        "accent": { "type": "string" },
        "background": { "type": "string" }
      }
    },
    "defaultParams": { "type": "object" }
  }
}
```

---

## 12. Risk Register & Mitigation Strategy

| ID | Risk | Severity | Mitigation Plan | Covered in |
| :--- | :--- | :---: | :--- | :--- |
| **R1** | Incomplete feature exposed on live site | Critical | Feature flags (`enabled: false`, `demoMode: true`), dev query `?studio=preview`. | P0, P7, P12 |
| **R2** | Overpromising marketing copy | High | Truth Rule: strictly claim local audio rendering; no "4K/instant" claims until real. | P1 |
| **R3** | Memory exhaustion on long audio tracks | High | 15-min / 120MB cap; mono analysis downmixing; chunked FFT calculations. | P0, P3, P8 |
| **R4** | Browser codec support variance | High | Feature-detect via `isConfigSupported()`; honest messaging; MediaRecorder fallback. | P0, P9, P12 |
| **R5** | Render freeze when tab is hidden | Medium | Worker rendering pipeline; Screen Wake Lock API; user visibility warning. | P7, P9 |
| **R6** | A/V desync or corrupt MP4 dimensions | Critical | Enforce even dimensions (mod 2); deterministic 30fps timestamps; post-mux verification. | P9 |
| **R7** | Privacy promise violation via CDN leaks | Critical | 100% local processing; all libraries vendored locally; zero third-party telemetry on audio. | P9, P12 |
| **R8** | Photosensitive epilepsy seizure trigger | Critical | Global luminance & flash limiter (WCAG 2.3.1 max 3 flashes/sec) inherited by all styles. | P8, T |
| **R9** | Copyright infringement exposure | Medium | Prominent rights notice; original generated abstract placeholder artwork. | P3, P4, P12 |
| **R10**| User work lost on tab refresh | Medium | IndexedDB session caching; route guards; visible "Clear my data" option. | P2, P3 |
| **R11**| Landing page load slowdown | High | Lazy loading on pointer-enter/idle; 0 bytes added to initial critical CSS/JS path. | P0, P2, P12 |
| **R12**| Accessibility regressions | Medium | Focus traps in modals; ARIA live regions; keyboard navigation; axe-core audits. | P3-P7, P12 |
| **R13**| Mobile overheating or sluggishness | Medium | Default to 720p on mobile; lower FFT resolution; memory hints. | P6, P8 |
| **R14**| Devanagari / Hindi font canvas clipping | Medium | Explicit font preloading via `document.fonts`; robust fallback stacks. | P10, P11 |
| **R15**| New code hidden by robots/deploy ignore | High | Studio placed in `studio/` (`/visualizer/` remains legacy blocked). | P0, P12 |

---

## 13. Master Phase Checklist & Progress Tracker

- [x] **Prompt 0: Audit, Architecture & Spec File** *(Completed 2026-10-23)*
  - [x] Audit routing, scene.js, ignored files, scripts, storage
  - [x] Create architectural decisions record
  - [x] Create `studio/config.js` with feature flags & `?studio=preview` switch
  - [x] Create `brain/visualizer-studio.md` memory file
- [x] **Prompt 1: Visualizer View Copy, Title & Meta** *(Completed 2026-10-23)*
  - [x] Rewrote Audio Visualizer view heading, subtitle, eyebrow, and CTAs
  - [x] Replaced stats strip with truthful feature chips (100% Local, MP4 Video, 4 Aspects)
  - [x] Rewrote `#demoModal` to Audio Visualizer Studio preview tour
  - [x] Rewrote `#visualizerComingSoonModal` removing unverified 4K/stem separation claims
  - [x] Added dynamic per-view `document.title` and `meta[name="description"]` in `script.js`
  - [x] Verified zero leftover lyric/timing words in Visualizer view and modals
  - [x] Passed all automated QA checks (111 unique IDs, single `<h1>`, valid JSON-LD)
- [x] **Prompt 2: Studio Shell (State Machine, Routing, Storage, Error Boundary)** *(Completed 2026-10-23)*
  - [x] Implemented `studio/store.js` Finite State Machine with validated transitions and event diagnostics
  - [x] Built `studio/storage.js` IndexedDB driver with 24h TTL, quota error recovery, and memory fallback
  - [x] Built `studio/ui.js` accessible toast notifications and keyboard focus-trapped confirm dialog
  - [x] Built `studio/router.js` sub-view hash router with route guards, scroll resets, and heading focus
  - [x] Created `studio/studio.js` coordinator with global error boundary and session restore
  - [x] Designed `studio/studio.css` containing sub-view transitions, empty states, and toast/dialog styling
  - [x] Embedded sub-view containers in `index.html` inside `#view-hero2` (landing, styles, settings, render, result)
  - [x] Lazy-loaded Studio on user intent; 0 bytes added to landing page initial critical path
  - [x] Added automated test suite `qa/test_studio_shell.py` (36/36 tests passed)
- [x] **Prompt 3: Upload Popup (Validation, Mini-Waveform, IndexedDB Storage)** *(Completed 2026-10-23)*
  - [x] Implemented `studio/upload.js` accessible modal controller with drag-and-drop & keyboard traps
  - [x] Web Audio API decoding with 64-bin peak mini-waveform normalization (0.08 to 1.0)
  - [x] Strict audio validation: 0-byte detection, folder prevention, 120MB size ceiling, format whitelist
  - [x] Duration limits enforced (max 15 mins cap, <3s warning, silent audio warning)
  - [x] Full object URL lifecycle cleanup (`URL.revokeObjectURL`) to prevent memory leaks
  - [x] Embedded `#studioUploadModal` in `index.html` with dialog semantics, audio player, scrub canvas & privacy notes
  - [x] Styled dropzone, decoding progress bar, audio card, and responsive mobile bottom-sheet in `studio/studio.css`
  - [x] Connected storage persistence (`saveAudioSession`), store dispatch (`AUDIO_LOADED`), and route handoff
  - [x] Added automated test suite `qa/test_upload_validation.py` with synthesized WAV fixtures (52/52 tests passed)
- [x] **Prompt 4: Style Studio Screen (Grid Layout, Categories, Placeholder Data)** *(Completed 2026-10-23)*
  - [x] Created `studio/data/styles.json` with 36 curated placeholder styles across 9 balanced categories
  - [x] Built procedural generator `tools/make_style_thumbs.py` producing 36 distinct 16:9 WebP thumbnails (all under 16 KB)
  - [x] Ignored `tools/` in `.gitignore`
  - [x] Implemented `studio/styles.js` controller with category filtering, zero CLS cards, and suggested preset carousel
  - [x] Built responsive grid (4 / 3 / 2 / 1 cols), skeleton shimmer loading, and error fallback with retry
  - [x] Built batch pagination (12 items/batch) with live count (`Showing 12 of 36 styles`) and auto-focus handover
  - [x] Integrated uploaded audio summary card with mini-waveform canvas preview and Change Audio modal trigger
  - [x] Styled Section 9 in `studio/studio.css` (aspect-ratio: 16/9, content-visibility: auto, demo ribbons, ratio pills)
  - [x] Wired route transition hook in `studio/router.js` and loaded `studio/styles.js` in `script.js`
  - [x] Created `qa/test_style_studio.py` and passed all 143/143 automated checks
- [x] **Prompt 5: Card Interactions (Hover Preview, Single Select, Sticky Bottom Bar)** *(Completed 2026-10-23)*
  - [x] Implemented 150ms hover-intent debounced preview manager in `studio/styles.js`
  - [x] Single active preview enforcement: only one preview ever runs globally; previous animations are strictly cancelled
  - [x] Real-time 60fps canvas visualizer loops matching all 9 style categories (bars, circles, ribbons, particles, neon grids)
  - [x] Resource protection: preview stops on mouseleave, card blur, window scroll, and window blur
  - [x] Accessibility: `prefers-reduced-motion` check disables autoplay; explicit Preview overlay button provided
  - [x] Card action overlay buttons: Preview (toggles preview) and Select (selects preset)
  - [x] Touch device handling: first tap previews and reveals overlay; second tap commits selection
  - [x] Sticky bottom selection bar (`#studio-styles-sticky-bar`) displaying thumbnail, title, category, and Deselect button
  - [x] Navigation CTA: "Continue to Settings" routes to `#visualizer/settings` via `StudioRouter`
  - [x] State persistence: selection stored in `StudioStore` (`STYLE_SELECTED`) and restored across back/forward
  - [x] Created `qa/test_card_interactions.py` with 27/27 automated checks passing
- [x] **Prompt 6: Render Settings (Ratio, Resolution, Trim, Live Estimates)**
  - [x] Implemented `studio/settings.js` controller managing aspect ratio selection, resolution defaults, audio trim, and real-time estimates
  - [x] Device-adaptive defaults: 1080p Full HD on desktops (>=4 cores, >=4GB RAM); 720p Standard HD on mobile (<768px) and low-memory environments
  - [x] Aspect ratio live preview frame morphing (16:9, 9:16, 1:1, 4:5) with real-time CSS `aspect-ratio` transition and resolution watermark
  - [x] Interactive waveform trim handles with `role="slider"`, `touch-action: none;`, keyboard arrow steps, and minimum 3.0s duration ceiling
  - [x] Non-crossing handle algorithm preventing start/end overlap and auto-adjusting bounds
  - [x] Numeric `mm:ss.s` time inputs with bi-directional parser and formatter
  - [x] Quick trim presets: Full Track, 15s, 30s, 60s
  - [x] Real-time file size & render time estimation engine calibrated for 1080p (~0.836 MB/s) and 720p (~0.457 MB/s)
  - [x] Browser capability detection checking WebCodecs (`VideoEncoder`), `MediaRecorder`, and canvas capture
  - [x] Embedded full accessible markup for `#studio-settings-subview` in `index.html` (36 dedicated IDs, single `<h1>` preserved, 0 duplicates)
  - [x] Appended Section 11 CSS styles in `studio/studio.css`
  - [x] Hooked `StudioSettings.render()` in `studio/router.js` and loaded `studio/settings.js` in `script.js`
- [x] **Prompt 7: Processing & Result Screens (Honest Demo Simulation)**
  - [x] Implemented `studio/render.js` with `RenderJob` interface and 5-stage `DemoRenderJob` simulator (analyze, prepare, render, encode, finalize)
  - [x] Processing Screen (`#studio-render-subview`): `role="progressbar"`, dynamic stage labels, elapsed counter, smoothed ETA calculation, and mini animated preview
  - [x] Tab & Performance Protections: Screen Wake Lock API (`navigator.wakeLock`), `beforeunload` guard attached only during active render, and `visibilitychange` background throttling alert
  - [x] Accessible Polite Announcer: screen reader updates triggered on stage transitions and at 10% progress intervals (`aria-live="polite"`)
  - [x] Error Screen (`#studio-render-error-card`): reachable with `?simulate=error` or hardware crash; offers Retry, Back to Settings, Start Over, and Copy Diagnostics
  - [x] Privacy Guarantee: Diagnostics bundle captures browser specs and capability flags only, strictly excluding all audio data
  - [x] Result Screen (`#studio-result-subview`): 60fps animated canvas preview using chosen style's palette, play/pause overlay, and video spec strip
  - [x] Truth in Advertising: Clear "PREVIEW BUILD" and "DEMO PREVIEW" banners; download button disabled with explanatory notice during `demoMode: true`
  - [x] Navigation & Share: Try another style (retains audio/settings), Change settings, Start over, and conditional Web Share API (`navigator.share`)
  - [x] Wired route hooks for `ROUTES.RENDER` and `ROUTES.RESULT` in `studio/router.js` and loaded `studio/render.js` in `script.js`
- [x] **Prompt 8: Engine Core (Deterministic Audio Analysis, Renderer, Reference Style)**
  - [x] Implemented `studio/engine/audio_analysis.js`: mono downmix ((L+R)/2), Hann-windowed Radix-2 FFT, 48 log-spaced frequency bands (20Hz-20kHz), temporal attack/decay smoothing, and silence protection
  - [x] Exact determinism: identical audio inputs yield bit-for-bit identical frame features with zero variance
  - [x] Robust silence & boundary guards: zero division by zero, zero NaN, zero Infinity guaranteed on silent, quiet, and clipped inputs
  - [x] Track profile & tempo estimation (BPM, energyScore, spectral balance) automatically ranking the "Suggested for you" row in `studio/styles.js`
  - [x] Implemented Photosensitivity Safety Guard in `studio/engine/limiter.js` (WCAG 2.3.1 compliance, <= 3 flashes/sec ceiling, optical luminance damping)
  - [x] Created Style Plugin Interface & Registry in `studio/engine/style_registry.js` (`register`, `get`, `has`, `getAll`)
  - [x] Built reference style plugin "Classic Bars" in `studio/engine/styles/classic_bars.js` with 48 reactive bars, gravity peak-caps, rounded tips, ground reflection, and 4 aspect ratios
  - [x] Built universal renderer engine in `studio/engine/renderer.js` locking frame extraction to `audio.currentTime` within +/-1 frame (<33.3ms)
  - [x] Wired engine pipeline into `studio/upload.js` and registered all 5 engine modules in `script.js`
  - [x] Built and verified `qa/test_engine_core.py` (22/22 checks passed)
- [x] **Prompt 9: Export Engine (WebCodecs H.264/AAC, MP4 Muxer, Verification)**
  - [x] Vendored standalone ISOBMFF MP4 Muxer in `studio/vendor/mp4-muxer.js` with MIT License in `studio/vendor/LICENSE` (zero-CDN, works offline)
  - [x] Implemented `studio/engine/export_engine.js` (`RealRenderJob`) with WebCodecs `VideoEncoder` (`avc1.42001f`, constant 30 FPS, microsecond timestamps)
  - [x] Enforced strictly EVEN dimensions (mod 2) across all 8 resolution/ratio combinations (1080p and 720p at 16:9, 9:16, 1:1, 4:5)
  - [x] 2.0-second keyframe cadence (`keyFrame: i % 60 === 0`) for rapid social media seeking and scrubbing
  - [x] GPU memory leak prevention: immediate `videoFrame.close()` after each `videoEncoder.encode()`
  - [x] Encoder backpressure throttling: yielding when `videoEncoder.encodeQueueSize > 5` to prevent unbounded memory growth
  - [x] Resilient fallback: `MediaRecorder` real-time stream capture (`canvas.captureStream(30)`) for browsers without WebCodecs
  - [x] File System Access API stream-to-disk or in-memory MP4 Blob generation
  - [x] Sanitized anchor download helper (`<audio>-<style>-<ratio>.mp4`) with automatic blob URL revocation
  - [x] Connected into `studio/render.js`: triggers `RealRenderJob` when live (`Config.demoMode: false` or `?engine=real`), automatically enables Download button and hides demo notice on completion
  - [x] Built and verified `qa/test_real_mp4_export.py` (17/17 checks passed)
- [x] **Prompt 10: Customization & Library Features (Colors, Background, Presets)** *(Completed 2026-10-23)*
  - [x] Implemented `studio/customization.js` managing global and per-style visual parameters
  - [x] Curated 6 harmonic palette presets (Cyber Neon, Electric Violet, Sunset Blaze, Ocean Abyss, Monochrome Clean, Emerald Matrix) + custom color pickers
  - [x] Mathematical WCAG 2.1 relative luminance and contrast ratio calculation with accessible inline warning for low-contrast color combinations (< 3.0:1)
  - [x] Four background modes: Solid color, Gradient radial vignette, Uploaded custom image (aspect-cover scaled), and Blurred cover art
  - [x] Memory-safe image downscaling (<20MB limit enforced, downscaled with `createImageBitmap` / canvas to max 1080px for background and 512px for cover art)
  - [x] Track Title and Artist typography overlay with font preloading (`document.fonts.load`), text shadow for legibility, and graceful fallback to system fonts
  - [x] Interactive reactivity sensitivity slider (0.5x to 2.0x) modulating spectral band energies in universal renderer
  - [x] Bottom audio progress bar toggle and Safe-Area guides toggle (9:16 social reels/shorts safe zone and 16:9 90% broadcast title-safe)
  - [x] Style-specific tuning parameters for Classic Bars: bar count (24-64), bar spacing gap (1-8px), neon glow sheen, and floor reflection
  - [x] Live Engine Preview canvas (`#studio-settings-preview-canvas`) inside morphing aspect ratio frame with play/pause toggle and scrub time indicator
  - [x] Presets management in `studio/storage.js`: save current custom setup as named preset, load preset, delete preset, and reset to factory defaults
  - [x] Style Library Search: instant search input filtering 36 styles across name, description, category, and tags with empty state recovery
  - [x] Favorites system: persistent heart toggle button on style cards (`.studio-card-fav-btn`) and dedicated Favorites filter tab with count badge
  - [x] "Surprise Me" randomized style selector with smooth scroll and golden pulse animation (`.is-surprise-highlight`)
  - [x] "Try Another Style" action retaining audio track, trim bounds, and export settings
  - [x] "Clear My Data" total privacy reset wiping all stored audio sessions, presets, and history
  - [x] Accessible Keyboard Shortcuts modal (`#studioShortcutsModal`) triggered via `?`, button, or Escape dismissal
  - [x] Automated QA suite `qa/test_customization.py` passing 9/9 verification checks, 0 duplicate IDs, exactly 1 `<h1>` tag
- [x] **Prompt 11: Lyrics Overlay (.LRC/.SRT Integration, Devanagari Support)** *(Completed 2026-10-23)*
  - [x] Added Google Font `Noto Sans Devanagari` (`family=Noto+Sans+Devanagari:wght@400;600;700`) to `index.html` ensuring proper ligatures and conjunct consonant shaping
  - [x] Implemented `studio/engine/lyrics_parser.js`:
    - Full parsing for Synchronized Lyrics (`.lrc`), SubRip Subtitles (`.srt`), WebVTT (`.vtt`), and pasted plain text
    - Enhanced word-level timestamps (`<mm:ss.xx> word`) with word start/end timeline generation
    - Global `[offset:+/-ms]` compensation and multi-timestamp line fan-out
    - UTF-8 and UTF-16 BOM removal and CRLF normalization
    - Full Devanagari Hindi Unicode range (`[\u0900-\u097F]`) and RTL script detection
    - Active cue lookup (`getActiveCueAt`) with timing offset adjustment
  - [x] Implemented `studio/engine/lyrics_renderer.js`:
    - 3 customizable visual styles: `karaoke` (active line glowing in primary/accent color with word-level highlight progress, inactive lines dimmed), `centered` (cinematic centered subtitles with frosted rounded pill background), and `lower-third` (television broadcast bar with vertical accent indicator)
    - Automatic text wrapping with max-width bounding
    - Aspect-ratio safe area bounds enforcement: 9:16 mobile vertical zone (10% top, 22% bottom, 15% right for reels/shorts UI) and 16:9 90% broadcast title-safe
    - Devanagari font fallback with Noto Sans Devanagari
  - [x] Integrated into Universal Renderer `studio/engine/renderer.js`:
    - Synchronized lyrics rendered on canvas in `renderFrameAt` prior to WCAG photosafety check
    - "Preview == Output": `RealRenderJob` in `export_engine.js` calls `renderFrameAt`, guaranteeing exported MP4 videos contain the identical lyrics overlay as live preview
  - [x] Integrated into Settings Controller `studio/settings.js`:
    - Added Synchronized Lyrics Overlay Section D.5 with toggle (`#studio-toggle-lyrics`)
    - File upload (`#studio-lyrics-file-upload`) supporting `.lrc`, `.srt`, `.vtt`, `.txt`
    - Paste Lyrics modal (`#studioLyricsPasteModal`) with raw input textarea and validation
    - SyncLines Editor handoff detection (`synclines_editor_handoff` in `localStorage`) offering one-click "Load from Lyrics Editor"
    - Layout style selector (`karaoke`, `centered`, `lower-third`)
    - Real-time timing sync offset slider (-5.00s to +5.00s in 0.05s increments)
    - Status badge showing loaded cue count & format (e.g. "42 cues (LRC)") and Clear button
  - [x] Registered `lyrics_parser.js` and `lyrics_renderer.js` in dynamic module loader in `script.js`
  - [x] Created `qa/test_lyrics_overlay.py` with 9/9 verification tests passing 100%
  - [x] Verified zero regressions: `brain/validate_qa.py` (316 unique IDs, exactly 1 `<h1>` tag) and all 10 QA suites passing
- [x] **Prompt 12: Hardening, QA, Privacy, SEO & Production Launch Checklist** *(Completed 2026-10-23)*
  - [x] Audited full Risk Register (Risks R1 through R15): verified all mitigations active and passing automated checks
  - [x] Hardened Feature Flag Strategy in `studio/config.js`:
    - `isStudioActive()`: gated safely behind `?studio=preview` until public launch; `setProductionLive(true)` provides clean 1-line production flip
    - Engine override: `isDemoMode()` checks query params (`?engine=real` or `?engine=demo`), cleanly managing hardware WebCodecs vs demo simulation
  - [x] Validated Privacy Policy in `privacy.html`:
    - Documented 100% local client-side processing of Audio Visualizer Studio (WebCodecs MP4 video generation, zero cloud uploads)
    - Documented browser storage keys (`synclines_studio_session` 24h TTL, `synclines_studio_presets`, `synclines_studio_favorites`) and one-click "Clear My Data"
  - [x] Validated 404 Error Handler in `404.html`: consistent brand styling, single `<h1>`, zero duplicate IDs, direct navigation links to Home and Editor
  - [x] Validated SEO, Sitemap & Robots:
    - `robots.txt` disallows legacy `/visualizer/` route while cleanly permitting `/studio/`, CSS, JS, and image assets
    - `sitemap.xml` properly lists all 3 canonical endpoints with valid XML syntax
    - `site.webmanifest` valid PWA manifest with icons and theme colors
  - [x] Validated Performance & Payload Budget:
    - Zero initial bytes added to critical landing page path (lazy-loaded on user intent / `#visualizer` route)
    - Pure client-side execution with local MIT vendored dependencies (zero external CDN telemetry)
  - [x] Automated QA Suite `qa/test_production_launch.py`: 17/17 checks passing 100%
  - [x] Full Project QA Verification: all 11 test suites passing 100% (388/388 total automated checks passed)
- [ ] **Prompt T: Style Expansion Template (Recurring workflow for individual presets)**



