# 🧠 SyncLines — AI Knowledge Base (brain/)

> **Purpose**: Complete project context for any future AI agent or developer to understand this codebase without re-scanning it. All docs optimized for maximum information density at minimum token cost.

---

## 📂 Quick File Map
| Document | Purpose |
|----------|---------|
| [brain.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/brain.md) | **Master Index**: Architecture summary & document navigation map |
| [directory-map.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/directory-map.md) | Every file, byte size, functional role, and script dependency table |
| [pages-and-routing.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/pages-and-routing.md) | URL structure, SPA view-switching (`switchView`), hash routing, and editor navigation |
| [theming-system.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/theming-system.md) | Root shell CSS dual-theme (`data-theme="hero1"/"hero2"`) and editor light/dark mode |
| [animations-and-transitions.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/animations-and-transitions.md) | Page-load entrance choreography, 3D tilt, parallax, view cross-fade, and reduced motion |
| [components.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/components.md) | Persistent app shell (sidebar, header, dropdowns) and view-specific UI modules |
| [business-logic.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/business-logic.md) | PCM audio synthesis, piano voice ADSR, 3D warped mesh math, and editor tagging algorithms |
| [naming-and-branding.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/naming-and-branding.md) | Brand hierarchy, canonical tool names, forbidden aliases, typography, and color tokens |
| [known-issues.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/known-issues.md) | Historical bugfixes (tilt blur resolution), script execution order, and coordinate caveats |
| [conventions.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/conventions.md) | Zero-build patterns, JavaScript IIFE scoping, CSS tokens, and accessibility standards |
| [changelog.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/changelog.md) | Chronological append-only record of all development sessions and updates |

---

## ⚡ Project in 60 Seconds

- **Brand**: SyncLines PRO v8
- **Creator**: Tapendu Pal
- **Type**: Static, client-side-only, multi-page web application. Zero backend, zero database, zero build step.
- **Entry**: Open [index.html](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/index.html) in any modern browser — no `npm install`, no local server needed.

### Core Views
```
1. Sync Lyrics & Script  → index.html          (Hero 1, default active view)
2. Audio Visualizer      → index.html#visualizer (Hero 2, in-page SPA view)
3. Live Harmonic Piano   → index.html          (Interactive widget inside Hero 1)
4. Editor                → editor/index.html   (Separate page via curtain-wipe transition)
```

### Tech Stack
- **Languages**: Native HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Audio Engines**: Web Audio API (procedural stereo 16-bit PCM WAV synthesis, polyphonic piano synthesizer, tactile haptic clicks, spectrum FFT analyzer).
- **Graphics**: Canvas 2D (ambient particles, 3D affine-skew mesh grid, minimap, spectrum analyzer) + SVG (waveform bars, timing axis, piano keys, icons).
- **Fonts**: Plus Jakarta Sans, Outfit, JetBrains Mono, Caveat.

### Critical Script Load Order (`index.html`)
```html
<script src="piano.js"></script>
<script src="scene.js"></script>
<script src="script.js"></script>
```
> `script.js` must load last: it connects directly to `window.VisualizerScene` (from `scene.js`) and `window.activateLivePiano` (from `piano.js`).

---

## 🗺 Navigation Between Docs

- *"What files exist in the project?"* → [directory-map.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/directory-map.md)
- *"How does clicking a nav item or hash routing work?"* → [pages-and-routing.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/pages-and-routing.md)
- *"How do the light/dark and shell themes operate?"* → [theming-system.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/theming-system.md)
- *"How is entrance or 3D tilt animation implemented?"* → [animations-and-transitions.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/animations-and-transitions.md)
- *"Where is component X located in the markup?"* → [components.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/components.md)
- *"How do audio synthesis, piano chords, and tagging work?"* → [business-logic.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/business-logic.md)
- *"What is the official brand name and terminology?"* → [naming-and-branding.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/naming-and-branding.md)
- *"What fragile areas or gotchas should I avoid breaking?"* → [known-issues.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/known-issues.md)
- *"What coding conventions must I follow?"* → [conventions.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/conventions.md)
- *"What changes were made in past sessions?"* → [changelog.md](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/brain/changelog.md)
