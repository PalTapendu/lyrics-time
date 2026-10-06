# Known Issues, Gotchas & Historical Bugfixes

> Critical edge cases, historical bugs, and fragile architectures that future AI agents and developers must preserve.

---

## 1. Driving Console 3D Tilt Blur on Straighten (HISTORICALLY RESOLVED)

### The Issue
When the timing console tilted back to flat (`rotateX(0deg), rotateY(0deg)`) on mouse hover, text and SVG elements appeared noticeably blurry, fuzzy, or faded out in Chromium/WebKit browsers due to GPU sub-pixel compositing of 3D transform layers.

### The Fix
1. In `script.js`: `straightProgress` lerps smoothly from 0.0 to 1.0. When `straightProgress === 1.0`, transform is hard-clamped to exact zero rotation without fractional perspective offsets.
2. In `style.css`: When `straightProgress > 0.4`, `.is-straight` class is applied to `#console`. This resets `will-change`, eliminates perspective artifacts, and restores crisp vector rendering.
3. **CAUTION**: Never reintroduce continuous fractional 3D transforms when the card is hovered flat.

---

## 2. Audio Autoplay & Piano Mute Default

### The Rule
- Browsers block `AudioContext` without user gesture.
- **Piano starts MUTED by default** (`isMuted = true` in `piano.js`).
- Audio only plays when:
  1. The user clicks `#pb` (Play/Pause button on console)
  2. The user presses `Space`
  3. The user clicks the piano mute toggle button
  4. The user clicks "Live Piano" in the top navigation or sidebar (`activateLivePiano()`)

---

## 3. Strict Script Execution Order

In `index.html`, scripts **MUST** load at the very bottom of `<body>` in this exact order:
```html
<script src="piano.js"></script>
<script src="scene.js"></script>
<script src="script.js"></script>
```

### Why It Breaks If Changed
- `piano.js` exposes `window.activateLivePiano`, `window.pianoTriggerKey`, and `window.isHeroSongPlaying`.
- `scene.js` exposes `window.VisualizerScene` (`start`, `pause`, `resume`, `isActive`).
- `script.js` executes immediately and wires event listeners calling these global methods. Reordering scripts causes fatal `TypeError: undefined is not a function`.

---

## 4. Root Embedded Scene vs Standalone `/visualizer/` Folder

- **Root `index.html`** uses `scene.js` from the root directory.
- **`/visualizer/`** is a standalone, isolated prototype directory containing its own `scene.js`, `style.css`, and `index.html`.
- **WARNING**: Editing `/visualizer/scene.js` will **NOT** change the embedded Hero 2 visualizer on the landing page! Changes to the landing page visualizer must be made in root `scene.js`.

---

## 5. Fixed Coordinate Space & Hover Hysteresis (1819 × 865)

- `#stage` uses a fixed internal reference box of **1819 × 865 px**.
- Mouse hit-testing in `script.js` uses pre-calculated bounding coordinates:
  ```js
  // Bounding box: x: 848..1655, y: 195..732
  var buffer = isConsoleHovered ? 28 : -8;
  ```
- **Hysteresis Buffer**: The +28px / -8px boundary buffer is critical. Without it, moving the mouse along the card edge causes rapid oscillation and screen flickering between tilted and straight states.

---

## 6. Page Transition Overlay & Reduced Motion

- When clicking "UPLOAD MUSIC" or "Launch Editor", `#pageTransitionOverlay` performs a 520ms curtain wipe before changing `window.location.href`.
- **Gotcha**: If `prefers-reduced-motion: reduce` matches, the 520ms transition is skipped entirely, executing instant navigation to avoid motion sickness.

---

## 7. Storage Key Namespaces

Avoid accidental key collisions. All `localStorage` keys are explicitly namespaced:
- `synclines-editor-theme`: `'light'` | `'dark'`
- `timing-console-autosave`: JSON serialized editor state
- `timing-console-history`: JSON array of up to 20 past session snapshots
- `timing-console-clicks`: `'true'` | `'false'` (haptic audio clicks)
