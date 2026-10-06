# Observed Code Conventions & Standards

> Architectural patterns and coding conventions established in this codebase. All future modifications must adhere to these practices.

---

## 1. Zero-Build Vanilla Architecture

- **No Compilers or Bundlers**: No Vite, Webpack, Babel, Rollup, or TypeScript. All files are authored in pure browser-native HTML5, CSS3, and JavaScript.
- **No Package Managers**: No `package.json`, no `npm`, no `yarn`. Any required external dependencies (Three.js, GSAP, Google Fonts) are loaded exclusively via CDN tags in `<head>`.
- **Direct Execution**: Opening `index.html` or `editor/index.html` directly in any modern browser must work immediately out-of-the-box.

---

## 2. JavaScript Scoping & Global APIs

- **IIFE Isolation**: Every JS file is wrapped in an Immediately Invoked Function Expression with `'use strict';`:
  ```js
  (function () {
    'use strict';
    // file logic...
  })();
  ```
- **Explicit Global Exports**: When modules must communicate, attach APIs explicitly to `window`:
  ```js
  window.VisualizerScene = { start, pause, resume, isActive, resize };
  window.activateLivePiano = function() { ... };
  window.TimingConsoleSpectrum = { start, stop, updateColors };
  ```
- **DOM References**: Use direct IDs with `document.getElementById()` or the shorthand `const $ = id => document.getElementById(id)`.

---

## 3. CSS Token Hierarchy & Styling Rules

- **Static Global Tokens (`:root`)**: Reserved for tokens that never change across themes (fonts, primary brand greens, timing/easing curves, pastel palette).
- **Context-Switched Tokens (`--shell-*`)**: Scoped to `[data-theme="hero1"]` and `[data-theme="hero2"]` on `<html>` and `<body>` for shell navigation elements.
- **Editor Tokens (`--bg`, `--surface`, `--border`)**: Scoped to `[data-theme="light"]` and `[data-theme="dark"]` on `<html>`.
- **60 FPS Hardware Acceleration**:
  - Continuous loops (`requestAnimationFrame`) animate **only** `transform` (`translate3d`, `rotate`, `scale`) and `opacity`.
  - Never animate `top`, `left`, `width`, or `margin` inside animation frames.

---

## 4. DOM Naming & Component Conventions

- **Structural Containers**: Named with semantic IDs (`#side`, `#top`, `#stage`, `#console`, `#wf`, `#ph`).
- **Interactive State Classes**:
  - Views: `.view-panel.is-active`
  - Navigation: `.side-btn.active`, `.dropdown-item.active`
  - Playback: `#stage.playing`, `.lyric-row.playing-now`
  - Modals: `.modal.is-active` / `.modal-backdrop[aria-hidden="false"]`
  - Reduced transform: `#console.is-straight`
- **Utility Indicators**:
  - `.pz`: Parallax floating element reading `data-d` (depth) and `data-r` (rotation factor).

---

## 5. Motion Design & Accessibility First

- **Reduced Motion Detection**:
  ```js
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  ```
- **Graceful Motion Degradation**:
  - Skip delayed page entrance sequences (apply `.page-assembled` immediately).
  - Bypass curtain wipe delays on page transitions (instant `window.location.href`).
  - Zero out floating particle drift and canvas mesh oscillations.
  - CSS keyframes overridden to `animation: none !important; transition: none !important;`.
