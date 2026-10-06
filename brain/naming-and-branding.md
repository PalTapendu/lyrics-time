# Naming & Branding Guidelines

> Authoritative brand identity, naming hierarchy, and terminology rules to prevent future AI agents and developers from regressing or mixing up brand names.

---

## Brand Hierarchy

```
SyncLines (Master Brand)
  ├── PRO v8 (Release Edition)
  │
  ├── PRO STUDIO TOOLS (Product Suite)
  │     ├── 1. Sync Lyrics & Script   (Hero 1 & /editor/)
  │     ├── 2. Audio Visualizer       (Hero 2 & /visualizer/)
  │     └── 3. Live Harmonic Piano    (Interactive Widget in Hero 1)
  │
  └── Creator: Tapendu Pal
```

---

## Canonical Names & Labels

| Context | Canonical Name | Exact UI Label | Element ID / Selector |
|---------|----------------|----------------|----------------------|
| **Master Brand** | SyncLines | `SyncLines` | `.brand-title` |
| **Product Version** | PRO v8 | `PRO v8` | `.brand-tag` |
| **Products Dropdown Header** | Pro Studio Tools | `PRO STUDIO TOOLS` | `.dropdown-header-label` |
| **Tool 1 (Primary)** | Sync Lyrics & Script | `Sync Lyrics & Script` | `#dropdown-console-btn`, `#side-home-btn` |
| **Tool 2 (Visualizer)** | Audio Visualizer | `Audio Visualizer` | `#dropdown-visualizer-btn`, `#side-visualizer-btn` |
| **Tool 3 (Piano)** | Live Harmonic Piano | `Live Piano` (Dropdown) / `Live Harmonic Piano` (Widget) | `#dropdown-piano-btn`, `#side-piano-btn`, `.piano-brand-label` |
| **Editor Sub-App** | Sync Lyrics & Script | `Sync Lyrics & Script — Lyric Timestamp Tagger` | `editor/index.html` title |
| **Engine Status Indicator** | Local Engine | `Local Engine` (with green dot) | `.engine-status` |
| **Header Primary CTA** | Upload Music | `UPLOAD MUSIC` | `#top-upload-btn` |
| **Hero 1 Primary CTA** | Upload Music | `UPLOAD MUSIC` | `#main-upload-btn` |
| **Hero 2 Primary CTA** | Upload Track | `Upload Track` | `#btn-upload-hero` |
| **Editor Build CTA** | Load into console | `Load into console` | `#buildBtn` |

---

## 🚫 Deprecated Names & Disallowed Aliases

- **NEVER** use "Lyrics Time" in user-facing UI or copy. ("Lyrics Time" is only the OS parent folder path). The user-facing brand is **SyncLines**.
- **NEVER** use "Sign Lady Sanskrit" or "Sign Lyrics". (These were voice-to-text / machine-translation artifacts from Hindi voice prompts). The correct English name is **Sync Lyrics & Script**.
- **NEVER** rename "Audio Visualizer" to "Grid Toy" or "Spectrum Wave".
- **NEVER** rename "Live Harmonic Piano" to "Virtual Keyboard" or "Soundboard".
- **NEVER** rename "Timing Console" to "Player Widget".

---

## Terminology Glossary

- **Timing Console**: The 3D-tilted glass card on Hero 1 displaying the waveform, time axis, playhead, and lyrics rows.
- **Stationary Hit-Target Conveyor**: The UX interaction pattern in `/editor/` where the list scrolls automatically after each tag so the next line arrives precisely under the user's cursor.
- **Lyric Blocks Track**: The draggable timeline block lane in `/editor/` positioned directly above the audio waveform.
- **Minimap**: The compact overview bar underneath the zoomed waveform in `/editor/`.
- **Shockwave Ripple**: The acoustic click shockwave propagating outward across the 3D visualizer canvas grid.
- **Dual-Theme Shell**: The persistent sidebar and header system that seamlessly adapts between light cream (`data-theme="hero1"`) and dark charcoal (`data-theme="hero2"`).

---

## Typography Standards

| Font Family | Usage | Fallback |
|-------------|-------|----------|
| **Plus Jakarta Sans** | Main UI labels, navigation, body copy, tooltips | `system-ui, sans-serif` |
| **Outfit** | Hero titles, display headlines, section headers | `sans-serif` |
| **JetBrains Mono** | Timestamps, timechips, format badges, numeric metrics | `monospace` |
| **Caveat** | Handwritten arrows, studio annotations, callouts | `cursive` |

---

## Official Color Palette Tokens

### Core Brand Tokens
- **Brand Green**: `#0a5836` (Primary deep forest green)
- **Brand Green Glow**: `#10b981` (Vibrant emerald accent)
- **Accent Gold**: `#c89e4b` (Warm studio gold) / `#ffc542` (Hero 2 active gold)
- **Brand Wine**: `#5a0e23` (Burgundy accent)
- **Cream / Sand**: `#fbf7ee` (Hero 1 background)
- **Deep Charcoal**: `#0c1014` (Hero 2 background)

### Piano Soft Pastel Tokens
- Mint: `#6ee7b7` · Sage: `#86efac` · Cyan: `#7dd3fc` · Periwinkle: `#93c5fd`
- Butter: `#fde047` · Peach: `#fdba74` · Coral: `#fda4af` · Rose: `#f472b6`
- Orchid: `#e879f9` · Lilac: `#c084fc` · Hydrangea: `#a5b4fc` · Lime: `#bef264`
