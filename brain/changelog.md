# Changelog

> Ongoing, append-only project history. All future changes by developers or AI agents should be logged here with date, affected files, and rationale.

---

## [2026-10-06] - AI Knowledge Base (brain/) Documentation Suite
- **Author**: Antigravity Assistant
- **Summary**: Comprehensive reverse engineering and documentation pass for the entire client-side static web application.
- **Added Files**:
  - `brain/brain.md`: Master index and fast navigation.
  - `brain/directory-map.md`: Complete folder and file breakdown with DOM ID tables.
  - `brain/pages-and-routing.md`: View-switching SPA logic, hash routing, and editor navigation.
  - `brain/theming-system.md`: Dual-theme CSS variable shell and editor light/dark mode architecture.
  - `brain/animations-and-transitions.md`: Comprehensive choreography, 3D tilt, parallax, and motion timings.
  - `brain/components.md`: DOM structure and interaction wiring for all shared and view-specific components.
  - `brain/business-logic.md`: Audio synthesis, piano engine, 3D warped mesh math, and editor tagging algorithms.
  - `brain/naming-and-branding.md`: Canonical names, brand hierarchy, forbidden aliases, and design tokens.
  - `brain/known-issues.md`: Historical bug fixes, script execution order rules, and fragile areas.
  - `brain/conventions.md`: Zero-build patterns, JavaScript scoping, and accessibility rules.
  - `brain/changelog.md`: Append-only chronological project ledger.

---

## [2026-10-05] - Products Dropdown & Navigation Hierarchy Re-alignment
- **Summary**: Re-aligned product order across dropdown menu and sidebar navigation:
  1. `Sync Lyrics & Script` (Primary hero & editor tool)
  2. `Audio Visualizer` (3D warped grid visualizer)
  3. `Live Piano` (Interactive harmonic piano widget)
- **Changes**:
  - Synchronized `.active` state styling across both sidebar buttons and dropdown menu items.
  - Ensured active tool stays visually highlighted in whichever UI panel is open.
- **Files Modified**: `index.html`, `script.js`, `style.css`

---

## [2026-10-05] - Premium Motion Choreography & Entrance Sequence
- **Summary**: Added orchestrated page-load animation sequence and page transitions.
- **Changes**:
  - Implemented `.page-assembled` state gate in `script.js` with staggered CSS keyframe delays on header, hero typography, console card, waveforms, and sidebar icons.
  - Added full-screen `#pageTransitionOverlay` curtain wipe when launching the `/editor/`.
  - Added comprehensive `prefers-reduced-motion` fallbacks across CSS and JS.
- **Files Modified**: `style.css`, `script.js`, `index.html`

---

## [2026-10-05] - Timing Console 3D Tilt Clarity & Blur Fix
- **Summary**: Fixed GPU sub-pixel compositing blur when the 3D-tilted console straightened on mouse hover.
- **Changes**:
  - Introduced `.is-straight` CSS class applied dynamically when straightening progress passes threshold.
  - Hard-clamped rotations to exact 0.0deg without fractional matrix perspective artifacts.
  - Added hysteresis buffer (+28px / -8px) to eliminate boundary edge hover oscillation.
- **Files Modified**: `script.js`, `style.css`

---

## [2026-10-06] - Choreographed Tab-Switch Motion & Seamless Editor Handoff Sequence
- **Summary**: Upgraded tab switching to a cohesive 380ms depth-slide/cross-fade with a persistent sliding sidebar active indicator, and smoothed the upload-to-editor sequence to a continuous fluid transition.
- **Files Modified**: `index.html`, `style.css`, `script.js`, `editor/index.html`
- **Change Type**: Motion choreography, visual polish & UX timing optimization
- **Affected Docs**: `brain/animations-and-transitions.md` updated to reflect the new sliding indicator, 380ms depth transitions, and staged editor reveal.

---

## [2026-10-06] - Coordinated Tab-Switching Motion & Fluid Upload-to-Editor Handoff
- **Summary**: Implemented a synchronized 380ms depth-slide crossfade with a sliding sidebar active indicator across all app tabs, and eliminated upload sequence jank via pre-staged overlay, zero-delay feedback, and staggered editor reveal.
- **Files Modified**: `index.html`, `style.css`, `script.js`, `editor/index.html`
- **Change Type**: Motion choreography, visual polish & UX timing optimization
- **Affected Docs**: `brain/animations-and-transitions.md` and `brain/pages-and-routing.md` (now reflect sliding rail indicator, 380ms depth transitions, and staged editor reveal).

---

## [2026-10-06] - View-Aware Animation Loop Performance Fix
- **Summary**: Made `script.js`'s `mainLoop()` and `piano.js`'s `animationLoop()` view-aware via `window.__isHero1ViewActive`, skipping inactive DOM writes and canvas rendering during Hero 2 to eliminate loop contention.
- **Files Modified**: `script.js`, `piano.js`
- **Change Type**: Performance optimization & bug fix
- **Affected Docs**: `brain/animations-and-transitions.md` and `brain/pages-and-routing.md` (documenting `window.__isHero1ViewActive` and conditional rAF execution).

---

## [2026-10-06] - Acoustic Audio Pre-warming via Idle Callback
- **Summary**: Pre-synthesized `buildDreamsAcousticTrack()` in background idle time after page load, eliminating the synchronous 30s PCM WAV generation delay on first Play button click.
- **Files Modified**: `script.js`
- **Change Type**: Performance optimization & latency fix
- **Affected Docs**: `brain/business-logic.md` (documents audio generation lifecycle and caching).

---

## [2026-10-06] - 3D Card Hover-Flattening Sub-Pixel Text Sharpness Fix
- **Summary**: Added `will-change: transform` to `.console-plane`, removed redundant static per-frame transform/shadow style writes in `mainLoop()`, aligned `.is-straight` toggle to exact `straightProgress === 1.0`, and accelerated zero-Z child transitions to eliminate sub-pixel text blur when flattened.
- **Files Modified**: `style.css`, `script.js`
- **Change Type**: Bug fix & sub-pixel rendering optimization
- **Affected Docs**: `brain/animations-and-transitions.md` (documents console 3D tilt, hover straightening, and layer compositing).

---

## [2026-10-06] - Revert Headphone Image Optimization & Format Fallbacks
- **Summary**: Reverted headphone images to their original full-resolution uncompressed PNGs and removed unused WebP files to eliminate visible mid-animation resolution and quality shifts.
- **Files Modified**: `headphone_complete.png`, `headphone_front.png`, `index.html`
- **Change Type**: Visual regression fix & asset revert
- **Affected Docs**: `brain/directory-map.md` (file sizes for headphone assets match original specifications).

---

## [2026-10-06] - Perfect Screen Fit, Zero Black Borders & Full Responsive Architecture (Laptop, Tablet & Mobile)
- **Summary**: Resolved letterboxing black bars on laptop, tablet, and mobile displays. Fixed CSS specificity bug on `#view-hero1` that caused a permanent 44px left offset, eliminated `#stage` hardcoded `#060d09` black background in favor of unified full-bleed theme gradients, upgraded `fitStage()` with fluid native layouts and touch scrubbing for mobile (<768px) and tablet portrait (<1024px), added compact 3-column stats grid and floating mobile navigation dock.
- **Files Modified**: `style.css`, `script.js`, `piano.js`, `brain/changelog.md`, `.gitignore`
- **Change Type**: Responsive UI redesign, bug fix & cross-platform visual polish
- **Affected Docs**: `brain/theming-system.md`, `brain/animations-and-transitions.md`, `brain/components.md`

---

## [2026-10-06] - Dedicated Piano Feature View, Mute Enforcement & Audio Visualizer Lazy-Loading
- **Date**: 2026-10-06
- **Summary**: Implemented dedicated Under Development panel (#view-piano) for the Piano tab with strict mute-by-default enforcement, and deferred Audio Visualizer (scene.js) execution to on-demand lazy load with a smooth first-time transition overlay.
- **Files Touched**: `index.html`, `piano.js`, `script.js`, `style.css`
- **Change Type**: Functional/logic change, architectural optimization & new feature panel
- **Affected Docs**: `brain/pages-and-routing.md` and `brain/components.md` (now reflect three active SPA views: `#view-hero1`, `#view-hero2`, `#view-piano`, and dynamic `scene.js` loading).

---

## [2026-10-06] - Seamless Entrance Animation Handoff & Amplitude Ease-In Fix
- **Date**: 2026-10-06
- **Summary**: Eliminated 1150ms entrance-to-ambient motion snap by gating mainLoop() idle-transform writes until page assembly, aligning heroGraphicScaleIn keyframes with headphone resting rotation, and smoothly ramping idle amplitude over 450ms.
- **Files Touched**: `script.js`, `style.css`
- **Change Type**: Bug fix & animation choreography polish
- **Affected Docs**: `brain/animations-and-transitions.md` (now reflects `isPageAssembled` gating and cubic ease-in idle motion ramp).

---

## [2026-10-07] - Headphone Ambient Float Continuous Motion Restoration
- **Date**: 2026-10-07
- **Summary**: Restored `.hp-rig` continuous CSS ambient floating motion (`headphoneFloat 6s ease-in-out infinite`) upon page assembly (#stage.page-assembled) by separating it from the one-shot release kill-list (`animation: none !important`). Ensured seamless handoff with zero snap as `heroGraphicScaleIn` 100% keyframe and `headphoneFloat` 0%/100% keyframes are mathematically aligned at `transform: translateY(0px) rotateY(-10deg) rotateX(4deg) rotateZ(-1.5deg)`. Maintained audio playback beat precedence via `#stage.playing .hp-rig, #stage.page-assembled.playing .hp-rig`.
- **Files Touched**: `style.css`
- **Change Type**: Bug fix & CSS animation handoff polish
- **Affected Docs**: `brain/animations-and-transitions.md`

---

## [2026-10-07] - Eliminate Entrance-to-Idle Dead Freeze & Sudden Motion Snap
- **Date**: 2026-10-07
- **Summary**: Synchronized entrance assembly timer to 1000ms (matching the ~960-1020ms completion of hero entrance keyframes) to eliminate the dead freeze, and upgraded idleEase ramp to a Hermite Smoothstep curve (650ms, zero initial velocity) to eliminate the sudden snap/jerk into ambient motion.
- **Files Touched**: `script.js`
- **Change Type**: Bug fix & animation handoff polish
- **Affected Docs**: `brain/animations-and-transitions.md`


