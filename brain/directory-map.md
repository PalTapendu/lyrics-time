# Directory Map

> All paths relative to project root `Lyics_Time_Antigravity/`

## Root Files

| File | Size | Role | Depends On |
|------|------|------|-----------|
| `index.html` | 48 KB | Landing page + all views (Hero 1, Hero 2, modals, sidebar, header) | style.css, piano.css, piano.js, scene.js, script.js |
| `style.css` | 86 KB | All CSS for root page: design tokens, shell, Hero 1, Hero 2, modals, animations | Google Fonts (external) |
| `piano.css` | 8 KB | CSS for mini piano widget only | style.css (loaded after) |
| `script.js` | 57 KB | Main interactive engine: parallax, audio synth, playback, lyric sync, view switcher, all event handlers | piano.js, scene.js (must load last) |
| `piano.js` | 38 KB | Mini piano widget: SVG keys, Web Audio synth, Canvas key-glow, auto-play demo loop, song sync | Web Audio API |
| `scene.js` | 18 KB | Hero 2 Audio Visualizer: Canvas 2D 3D-grid, particle system, shockwave ripples | Canvas 2D |
| `headphone_complete.png` | 578 KB | Full studio headphone image (both earcups) | — |
| `headphone_front.png` | 356 KB | Front earcup only (for 3D-intertwined layering) | — |

## /editor/ Subdirectory

| File | Size | Role | Depends On |
|------|------|------|-----------|
| `editor/index.html` | 36 KB | Sync Lyrics & Script editor app shell | editor/styles.css, editor/app.js, editor/spectrum.js |
| `editor/app.js` | 108 KB | Full editor logic: audio player, waveform, minimap, lyric word tagging, LRC/SRT/VTT/TXT export, history, session save/load, undo/redo | Web Audio API, FileReader API |
| `editor/styles.css` | 78 KB | Editor-specific CSS: dual light/dark theme, waveform panel, lyric blocks, player dock | Google Fonts (external) |
| `editor/spectrum.js` | 11 KB | Real-time audio spectrum analyzer (AnalyserNode FFT → Canvas 2D bars) | Web Audio API |
| `editor/README.md` | 6 KB | User-facing feature documentation for the editor |

## /visualizer/ Subdirectory

| File | Size | Role | Depends On |
|------|------|------|-----------|
| `visualizer/index.html` | 30 KB | Standalone Audio Visualizer page (legacy/standalone version) | visualizer/style.css, visualizer/scene.js |
| `visualizer/scene.js` | 15 KB | Same 3D grid visualizer logic (standalone version) | Canvas 2D |
| `visualizer/style.css` | 35 KB | Visualizer-specific styles |

> **Note**: The embedded visualizer in `index.html` uses `scene.js` in the root, NOT `visualizer/scene.js`. The `/visualizer/` directory is a **standalone/legacy build** — it is NOT linked from the main navigation.

## Key DOM IDs (Root index.html)

### Shell (Persistent across all views)
| ID | Element | Purpose |
|----|---------|---------|
| `side` | `<aside>` | Left sidebar navigation |
| `top` | `<header>` | Top navigation bar |
| `stage` | `<div>` | Scale-to-fit wrapper (1819×865 coordinate space) |

### Sidebar Buttons
| ID | Action |
|----|--------|
| `side-logo` | Click → switchView('hero1', 'lyrics') |
| `side-home-btn` | Click → switchView('hero1', 'lyrics') |
| `side-visualizer-btn` | Click → toggle Hero 1/Hero 2 |
| `side-piano-btn` | Click → activateLivePianoTool() |
| `side-account-btn` | Click → openAccountModal() |
| `side-info-btn` | Click → showToast(shortcuts) |
| `side-video-btn` | Click → openVideoModal() |

### Header Nav
| ID | Action |
|----|--------|
| `brand-home` | Click → switchView('hero1', 'lyrics') |
| `products-trigger` | Hover → opens dropdown |
| `products-dropdown-menu` | Container for dropdown items |
| `dropdown-console-btn` | Click → switchView('hero1', 'lyrics') |
| `dropdown-visualizer-btn` | Click → switchView('hero2') |
| `dropdown-piano-btn` | Click → activateLivePianoTool() |
| `top-upload-btn` | Click → Editor (Hero1) or Coming Soon modal (Hero2) |

### Hero 1 (View Panel)
| ID | Element | Purpose |
|----|---------|---------|
| `view-hero1` | `<div class="view-panel">` | Hero 1 container, `is-active` = visible |
| `bg` | `<canvas>` | Ambient floating particle background |
| `glow` | `<div>` | Mouse cursor glow follower |
| `console` | `<div>` | Timing console root (hosts 3D tilt) |
| `console-plane` | `<div>` | Receives CSS 3D transform (rotateX/Y/Z) |
| `main-card` | `<div>` | Inner glass card (glare effect target) |
| `wf` | `<svg>` | Main waveform bars (120 rects) |
| `ax` | `<svg>` | Time axis markers (00:05 … 00:30) |
| `ph` | `<div>` | Playhead line (translateX) |
| `tip` | `<span>` | Playhead timestamp tooltip |
| `pb` | `<button>` | Play/Pause toggle button |
| `hl` | `<div>` | Lyric row highlight bar (translateY) |
| `np` | `<div>` | "Now Playing" badge (moves between rows) |
| `mini-piano` | `<div>` | Mini piano widget (piano.js root) |

### Hero 2 (View Panel)
| ID | Element | Purpose |
|----|---------|---------|
| `view-hero2` | `<div class="view-panel">` | Hero 2 container |
| `grid-canvas` | `<canvas>` | 3D warped grid (scene.js) |
| `particle-canvas` | `<canvas>` | Atmospheric floating particles (scene.js) |
| `cursor-glow` | `<div>` | Cursor glow follower (scene.js) |
| `heroToast` | `<div>` | Toast notification for Hero 2 events |

### Modals & Overlays
| ID | Purpose |
|----|---------|
| `video-modal` | Studio demo video modal (Hero 1) |
| `account-modal` | Account card modal (sidebar account btn) |
| `visualizerComingSoonModal` | "Coming Soon" modal for Audio Visualizer upload |
| `visualizer-taskbar` | Slide-up taskbar for visualizer options |
| `pageTransitionOverlay` | Full-page green overlay wipe → editor navigation |
| `toast` | Hero 1 toast notification |
| `heroToast` | Hero 2 toast notification |
