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

