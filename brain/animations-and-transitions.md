# Animations & Transitions

## System Overview

All animation in the project falls into these categories:

| Category | Mechanism | File |
|----------|-----------|------|
| Page-load entrance sequence | CSS keyframes + `.page-assembled` class gate | style.css, script.js |
| 3D console tilt & hover | `requestAnimationFrame` + JS transform | script.js |
| Parallax floating elements | `requestAnimationFrame` + JS transform | script.js |
| Ambient background particles | Canvas 2D + `requestAnimationFrame` | script.js |
| Waveform audio bar pulse | JS + SVG attribute mutation | script.js |
| Lyric highlight bar slide | CSS transition + JS `top` mutation | script.js, style.css |
| Mini piano key glow | Canvas 2D + `requestAnimationFrame` | piano.js |
| Piano auto-play sweep | `requestAnimationFrame` timing loop | piano.js |
| View panel cross-fade | CSS transition on `.is-active` | style.css |
| Page transition overlay wipe | CSS + JS class add + 520ms delay | style.css, script.js |
| 3D visualizer grid | Canvas 2D + `requestAnimationFrame` | scene.js |
| Modal open/close | CSS transition + class add/remove | style.css |
| Hero toast slide-in | CSS transition + class add/remove | style.css |
| Piano focus pulse | CSS `@keyframes piano-focused-pulse` | piano.css |

---

## Page-Load Entrance Sequence (Hero 1)

### Gate Mechanism
```js
// script.js — second IIFE, ~line 171
if (prefersReducedMotion) {
  stage.classList.add('page-assembled');
} else {
  setTimeout(() => stage.classList.add('page-assembled'), 1000);
}
```

### How Elements Animate
- Before `page-assembled`: elements have choreographed entrance keyframe animations running (slide-up, fade-in, scale-in).
- After `page-assembled`: entrance animations finish; static elements release animation locks (`animation: none !important`), while continuous animated elements (specifically `.hp-rig` headphone rig) seamlessly switch over to their ambient loop (`headphoneFloat 6s ease-in-out infinite`).
- CSS uses staggered `animation-delay` on each element group for the choreographed sequence.

### Stagger Groups (approximate delays, style.css)
```
Header (nav, brand):   0ms  → fades in from top
Stage (whole):         100ms
Hero text (h1, etc.):  150ms, 250ms, 350ms
Console card:          400ms → slides up + fades
Sidebar buttons:       50ms each (staggered with nth-child)
Waveform bars:         500ms
Lyrics rows:           600ms–900ms (nth-child stagger)
Headphones:            700ms
Annotations:           850ms
```

### Reduced Motion
When `(prefers-reduced-motion: reduce)` matches:
- `stage.classList.add('page-assembled')` fires immediately (no delay).
- CSS `@media (prefers-reduced-motion: reduce)` overrides keyframes to be instant.
- The parallax/floating/particle loop still runs but most motion values are `0`.

---

## 3D Console Tilt System

### Variables (script.js mainLoop)
```js
var isConsoleHovered = false;
var straightProgress = 0.0; // 0 = fully tilted, 1 = fully straight
var blend = 1.0 - straightProgress;
```

### Tilt Values (when not hovered, `blend = 1`)
```js
rotateY: -10.84deg + mouse parallax + idle breathing
rotateX: -1.90deg  + mouse parallax + idle breathing
rotateZ: -1.07deg
translateY: idle floating ~±2.5px (sin wave)
```

### Straighten on Hover (when hovered, blend → 0)
- `straightProgress` lerps to 1.0 using: `1 - exp(-dt * 14)` factor (snappy spring-like).
- At `straightProgress === 1.0`: hard-set `transform = rotate(0deg, 0deg, 0deg)`.
- Also adds `.is-straight` class when `straightProgress > 0.4` for CSS-level crisp rendering.

### Console Hover Detection
```js
// Boundary box: x 848–1655, y 195–732 (in 1819×865 stage coords)
// 28px hysteresis buffer prevents boundary flicker
var buffer = isConsoleHovered ? 28 : -8;
```
Also: `mainCard.addEventListener('pointerenter', () => isConsoleHovered = true)`.

### Why `.is-straight` Class
Prevents sub-pixel CSS blur artifacts from translateZ compositing at angle. At `> 0.4` progress, the CSS class forces `will-change: auto` or resets 3D context.

---

## Parallax Floating Elements (`.pz`)

All floating elements (headphones, annotations, arrows) have `class="pz"` and data attributes:
```html
<div class="pz" data-d="14" data-r="0.8" style="...">
```

### Formula (mainLoop)
```js
var depth = +el.dataset.d || 0; // parallax depth
var rot   = +el.dataset.r || 0; // rotation amount
var tx = -currX * depth + pzFloatX;
var ty = -currY * depth * 0.6 + pzFloatY;
var tr = (rot ? currX * rot : 0) + pzRot;
// pzFloatX/Y = continuous sin/cos breathing wave
// currX/Y = lerped mouse position (−1 to +1)
```

### Special Annotations (#hand-top, #hand-bottom)
When `straightProgress` increases (console straightening), annotations glide outward:
```js
if (el.id === 'hand-top')    { tx += -36 * straightProgress; ty += -24 * straightProgress; }
if (el.id === 'hand-bottom') { tx += -14 * straightProgress; ty +=  -6 * straightProgress; }
```

---

## Waveform Bar Pulse

120 SVG `<rect>` elements in `#wf`. During playback, `pulseWaveform(timeSec, audioTime)` runs each frame:

- **Bass bars** (idx 0–34): pulse with beat phase (96 BPM, `sin^4`)
- **Mid bars** (idx 30–84): strum pulse (`sin^3`)
- **High bars** (idx 80–120): shimmer (`sin(time*14 + idx*0.8) * 0.16`)
- **Proximity boost**: bars near playhead center get extra amplitude boost

When paused: bars reset to their `baseH` values.

---

## View Panel Cross-Fade

```css
/* style.css */
.view-panel {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.38s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.38s cubic-bezier(0.16, 1, 0.3, 1),
    visibility 0.38s;
  will-change: opacity, transform;
}
#view-hero1 {
  background: radial-gradient(...) ...;
  transform: translate3d(-44px, 0, 0) scale(0.985);
}
#view-hero2 {
  background: #060d09;
  transform: translate3d(44px, 0, 0) scale(0.985);
}
.view-panel.is-active {
  opacity: 1;
  pointer-events: auto;
  transform: translate3d(0, 0, 0) scale(1);
}
```

`switchView()` adds/removes `.is-active` → handles 380ms coordinated depth-slide + cross-fade.
`syncSidebarIndicator(product)` smoothly glides `.side-active-indicator` to target button offset with cubic-bezier(0.16, 1, 0.3, 1).

---

## Page Transition Overlay (→ Editor)

```css
/* style.css */
.page-transition-overlay {
  position: fixed; inset: 0;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.32s;
  will-change: opacity;
}
.page-transition-overlay.is-active {
  opacity: 1;
  visibility: visible;
}
```

JS flow:
1. Button press gives 0ms tactile feedback (`scale(0.96)`)
2. `.is-active` initiates immediate 320ms fluid entrance
3. At 380ms → `window.location.href = 'editor/index.html'`
4. Editor page maintains overlay for min 340ms, then coordinates 380ms overlay fade-out with staggered editor section slide-up reveal

---

## Piano Focus Pulse (piano.css)

```css
@keyframes piano-focused-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
  50% { box-shadow: 0 0 0 12px rgba(16,185,129,0); }
}
.piano-focused-pulse {
  animation: piano-focused-pulse 0.8s ease-out 3;
}
```

Triggered from `activateLivePianoTool()` in script.js. Animates 3 pulses on `#mini-piano`.

---

## Hero Toast Notification

```css
.hero-toast {
  transform: translateY(20px);
  opacity: 0;
  transition: opacity 260ms, transform 260ms var(--ease-spring);
}
.hero-toast.show {
  transform: translateY(0);
  opacity: 1;
}
```

Auto-hides after 2800ms via `setTimeout`. Separate instances: `#toast` (Hero 1), `#heroToast` (Hero 2).

---

## 3D Visualizer Grid (scene.js)

### Canvas Setup
- Two canvases: `#grid-canvas` (3D grid) and `#particle-canvas` (atmospheric particles)
- Both are DPR-aware: `canvas.width = Math.round(W * dpr)`
- Lifecycle: `window.VisualizerScene.start() / pause() / resume() / resize()`

### Grid Algorithm
- Warped perspective grid lines drawn in Canvas 2D
- Mouse position drives the warp vanishing point
- Shockwave ripples spread outward from click point (`pointerdown` event)
- `mouseHoverIntensity` (0→1 envelope) controls glow intensity

### Pause/Resume
```js
// pause()
isRunning = false;
cancelAnimationFrame(rafId);

// resume()
isRunning = true;
requestAnimationFrame(loop);
```
`switchView()` calls `pause()` and `resume()` appropriately to conserve GPU/CPU.
