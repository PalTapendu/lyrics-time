# SyncLines Unified Responsive System Specification

> **Document Version:** 1.0.0  
> **Author:** Senior Front-End Systems Engineer  
> **Status:** Production Standard  
> **Target Files:** `index.html`, `style.css`, `script.js`, `editor/styles.css`, `privacy.html`, `404.html`

---

## 1. Architectural Philosophy

The SyncLines layout system eliminates ad-hoc artificial window scaling (`fitStage()` with `Math.min(scaleX, scaleY)` on a fixed 1819×865 artboard) in favor of a **single rule-based responsive CSS Grid + Container Query/Scaler architecture**.

Key principles:
1. **Zero Clipping & No Horizontal Scroll:** `scrollWidth <= clientWidth` on all viewport widths down to 320px and up to 400% browser zoom. If vertical content exceeds the screen height, the viewport scrolls vertically.
2. **Viewport-Anchored Shell:** The sidebar (`#side`) and header (`#top`) anchor directly to the physical viewport edges at all aspect ratios without letterboxing, floating gaps, or hard-coded offsets.
3. **Container-Driven Hero Illustration:** Only the complex 3D hero illustration cluster (console card, headphones, handwritten notes, and background organic petal) scales to fit from its *own container* (`.hero-illustration-container` > `.hero-illustration-scaler`), maintaining true 3D spatial alignment without scaling surrounding copy, buttons, or nav chrome.
4. **Fluid Layout System:** All typography, spacing, and shell dimensions adapt smoothly via CSS `clamp()` and `rem` units, reserving media queries exclusively for structural shifts.

---

## 2. Design Tokens (`:root`)

Defined centrally in `:root` inside [`style.css`](file:///d:/Downlods/Application%20By%20Tapendu/Lyrics%20Time/hero%20section/Lyics_Time_Antigravity/style.css):

| Token Category | CSS Variable | Min Value | Fluid Formula | Max Value | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Shell Dimensions** | `--shell-sidebar-w` | `56px` | `3.8vw` | `70px` | Fixed desktop sidebar width (`0px` in dock mode) |
| | `--shell-header-h` | `56px` | `6.2vh` | `68px` | Header height (`52px` on short screens <= 700px) |
| | `--shell-footer-h` | `34px` | `4.2vh` | `42px` | Footer container baseline height |
| | `--shell-content-max-w` | — | `1720px` | `1720px` | Maximum content containment constraint |
| | `--min-tap-target` | — | `44px` | `44px` | WCAG / iOS touch target minimum size |
| **Fluid Typography** | `--font-hero-title` | `3.0rem` (~48px) | `2.3rem + 2.4vw` | `4.8rem` (77px) | Hero main heading title size |
| | `--line-hero-title` | — | `0.94` | `0.94` | Hero title line-height (tight, powerful leading) |
| | `--font-hero-sub` | `0.92rem` (14.7px) | `0.88rem + 0.15vw` | `1.05rem` (16.8px) | Hero secondary narrative copy |
| **Fluid Spacing** | `--space-1` | `4px` | `0.5vw` | `8px` | Micro element margins and tag paddings |
| | `--space-2` | `8px` | `1.0vw` | `12px` | Icon and button internal spacing |
| | `--space-3` | `12px` | `1.5vw` | `20px` | Heading margins and pill offsets |
| | `--space-4` | `18px` | `2.2vw` | `32px` | Section gaps and button strip gaps |
| | `--space-5` | `24px` | `3.2vw` | `48px` | Layout column padding and stage margins |
| | `--space-6` | `32px` | `4.5vw` | `64px` | Major section vertical rhythm |

### Short Viewport Overrides (`@media (max-height: 700px)`)
```css
@media (max-height: 700px) {
  :root {
    --shell-header-h: 52px;
    --font-hero-title: clamp(2rem, 1.2rem + 3.2vw, 3.8rem);
    --line-hero-title: 0.94;
    --space-2: 6px;
    --space-3: 10px;
    --space-4: 14px;
    --space-5: 20px;
  }
}
```

---

## 3. Breakpoint Tiers

| Tier | Name | Viewport Width | Shell Mode | Hero Layout | Primary Target Devices |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | Phone Portrait | `<= 479px` | Bottom Dock (floating) | Single column, stacked (Copy first, Illustration second) | iPhone SE, iPhone 12/13/14/15, Pixel 7, Galaxy S23 |
| **2** | Phone Landscape / Small Tablet | `480px – 767px` | Bottom Dock (floating) | Single column, centered | iPhone Landscape, Foldables unfolded, iPad mini |
| **3** | Tablet Portrait | `768px – 1023px` | Bottom Dock (floating) | Single column, spacious | iPad Air, iPad Pro 11", Galaxy Tab S8 |
| **4** | Small Laptop / Netbook | `1024px – 1365px` | Left Sidebar (edge-anchored) | 2 Columns (`minmax(380px, 1fr) minmax(480px, 1.25fr)`) | iPad Pro 12.9" Landscape, 11"-13" Laptops, Surface Pro |
| **5** | Desktop / Laptop Standard | `1366px – 1919px` | Left Sidebar (edge-anchored) | 2 Columns, optimal reading measure | 13.3"–16" MacBooks, 1080p Laptops & Monitors |
| **6** | Large Desktop | `1920px – 2559px` | Left Sidebar (edge-anchored) | 2 Columns, max content width `1720px` | 1440p / 2K Displays, 24"–27" External Monitors |
| **7** | Ultrawide Monitors | `>= 2560px` or `aspect-ratio >= 2.2` | Left Sidebar (edge-anchored) | 2 Columns, centered container with margin auto | 3440×1440 Ultrawide, 4K UHD, 5K Retina Studio Displays |

---

## 4. Element Placement & Sizing Matrix

| UI Component | Tiers 1–2 (Phone: <= 767px) | Tier 3 (Tablet: 768–1023px) | Tiers 4–5 (Laptop: 1024–1919px) | Tiers 6–7 (Large/Ultrawide: >= 1920px) |
| :--- | :--- | :--- | :--- | :--- |
| **App Shell Grid** | 1 column (`100%`), areas: `top`, `main`, `footer` | 1 column (`100%`), areas: `top`, `main`, `footer` | 2 columns: `var(--shell-sidebar-w) minmax(0, 1fr)`, areas: `side top`, `side main`, `side footer` | 2 columns: `var(--shell-sidebar-w) minmax(0, 1fr)`, max content width `1720px` |
| **Sidebar (`#side`)** | Converted to Bottom Dock (`display: flex; flex-direction: row; position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%); width: min(420px, calc(100% - 24px)); height: 58px; z-index: 500;`) | Same as Tier 1–2 Bottom Dock | Sticky left edge, `width: var(--shell-sidebar-w)`, `height: 100dvh`, `position: sticky; top: 0; left: 0;` | Same as Tiers 4–5, fixed to left viewport edge |
| **Header (`#top`)** | `height: var(--shell-header-h)`, sticky top edge (`position: sticky; top: 0; width: 100%;`). Nav links and engine status collapsed. Products trigger & upload CTA visible. | `height: var(--shell-header-h)`, sticky top edge. Compact padding `clamp(16px, 2.5vw, 24px)`. | `height: var(--shell-header-h)`, sticky top edge. Full desktop navigation, live engine status indicator, pricing modal trigger, and upload button visible. | Same as Tiers 4–5, full desktop chrome |
| **Brand Badge & Title** | Compact icon (`32×32px`), title `14px`, tag hidden on `<= 479px`. | Icon `34×34px`, title `15px`, tag visible. | Icon `38×38px`, title `17px`, tag visible. | Icon `38×38px`, title `17px`, tag visible. |
| **Products Dropdown** | Menu aligned to trigger with touch-friendly `44px` rows. | Floating flyout menu with backdrop blur. | Floating flyout menu with keyboard navigation. | Floating flyout menu with keyboard navigation. |
| **Hero Title (`#title`)** | Fluid `clamp(2.35rem, 1.5rem + 4.2vw, 4.8rem)`, `text-wrap: balance`, `line-height: 0.94`, `#t1` & `#t2` display block. | Fluid size, centered text alignment. | Left-aligned, full typographic scale, dual gradients (`#t1`, `#t2`). | Left-aligned, capped at `4.8rem` for optical restraint. |
| **Hero Copy (`.hero-sub`)** | Fluid `clamp(0.92rem, 0.88rem + 0.15vw, 1.05rem)`, max-width `480px`, `text-wrap: pretty`, `overflow-wrap: break-word`. | Centered, max-width `540px`. | Left-aligned, max-width `520px`. | Left-aligned, max-width `540px`. |
| **Hero CTAs (`.hero-ctas`)** | Stacked vertically (`flex-direction: column; width: 100%; max-width: 320px; margin: 0 auto;`). Buttons `min-height: 48px`. | Centered row with `flex-wrap: wrap; gap: 16px;`. | Left-aligned row (`gap: 16px;`). Primary: `height: 56px; padding: 0 28px;`. Secondary: icon circle. | Left-aligned row, full spring hover states. |
| **Hero Stats (`.hero-stats`)** | 3-column grid (`repeat(3, 1fr)`), compact cards (`padding: 8px 4px`), stat icons `36px`, dividers hidden. | Centered flex row with dividers. | Left-aligned flex row with dividers (`gap: clamp(8px, 1.0vw, 18px)`). | Left-aligned flex row with dividers. |
| **Hero Illustration Container** | Single column row 2 (`width: 100%; max-width: 760px; margin: var(--space-4) auto 0 auto; display: block;`). | Single column row 2 (`max-width: 760px;`). | Column 2 of hero grid (`width: 100%; display: block;`). | Column 2 of hero grid, scaled to fit container bounds. |
| **Hero Illustration Scaler** | Reference dimensions: `980×700px`. `position: absolute; top: 0; left: 0; transform-origin: 0 0;`. Scaled via `translate(offsetX, 0px) scale(s)`. | Scaled to container width/height without window distortion. | Scaled to column 2 dimensions. Zero-offset origin preserves alignment. | Scaled to column 2 dimensions. |
| **Console Card Cluster (`#console`)** | Positioned inside scaler at `left: 10px; top: 86px; width: 805px; height: 534px;`. All 3D layers, waveform SVG, lyrics list, and mini piano intact. | Preserves 3D perspective and card shadows inside scaler. | Preserves 3D perspective and card shadows inside scaler. | Preserves 3D perspective and card shadows inside scaler. |
| **Studio Headphones** | `.hp-back-wrap` (`z-index: 5`) and `.hp-front-wrap` (`z-index: 18`) positioned inside scaler at `left: 635px; top: 0px;`. Floats seamlessly around card. | Fully visible and animated. | Fully visible and animated. | Fully visible and animated. |
| **Handwritten Notes** | Positioned inside scaler: `#hand-top` (`left: 150px; top: 28px`), `#hand-bottom` (`left: 710px; top: 610px`). | Fully visible. | Fully visible. | Fully visible. |
| **Footer (`.site-footer`)** | Stacked / centered (`padding-bottom: calc(68px + env(safe-area-inset-bottom) + 16px)` to clear bottom dock). `.footer-nav` wraps. | Centered wrap with clearance for dock. | Flex row (`flex-wrap: wrap; justify-content: space-between; padding: clamp(8px, 1.2vh, 14px) clamp(16px, 2.5vw, 36px);`). | Flex row, max-width `1720px` container. |
| **Audio Visualizer Panel (`#view-hero2`)** | Full stage width, centered copy, full-screen particle & waveform background canvas. | Full stage width, centered copy. | 2-column wide editorial hero layout, canvas auto-resizes to stage width/height. | Full stage width, responsive canvas. |
| **Piano Studio Panel (`#view-piano`)** | Centered modal card (`max-width: 540px; width: 100%; padding: 2rem 1rem;`). | Centered modal card. | Centered modal card with backdrop blur. | Centered modal card. |

---

## 5. The "Never-Clip" Implementation Rules

1. **Grid & Flex Child Containment (`min-width: 0`):**
   - By default in CSS, flex and grid items have `min-width: auto`, which prevents them from shrinking below their content size. Every direct child of grid or flex containers in the shell and hero has `min-width: 0` applied so children can shrink and wrap properly.
2. **Elimination of Destructive `overflow: hidden`:**
   - `#stage` and parent containers use `overflow: visible` (or `overflow-x: clip` where appropriate). Ancestor containers must never clip real text, badges, or buttons.
3. **No Hard-Coded Window Dimensions:**
   - No view panel may ever set `width: 1819px` or `height: 865px`. Panels must use `width: 100%; min-height: calc(100dvh - var(--shell-header-h) - var(--shell-footer-h));`.
4. **Natural Vertical Scrolling:**
   - If viewport height is small (e.g., 600px on laptops or landscape phones), vertical scrolling is naturally enabled (`min-height: 100dvh; height: auto;`). Horizontal scrollbars are forbidden (`scrollWidth <= clientWidth`).
5. **Text Wrap & Word Breaking:**
   - All headings and subheadings use `text-wrap: balance` / `text-wrap: pretty` and `overflow-wrap: break-word` (or `word-break: break-word`).
6. **Footer Navigation Wrapping:**
   - `.footer-inner` and `.footer-nav` use `display: flex; flex-wrap: wrap; gap: 8px 16px;`. Under no circumstances may `.site-footer` use `position: fixed; left: 76px; right: 0; width: 100%`, as this pushes the right boundary past the screen edge by 76px.
7. **Bounding-Rect-Based Interaction Mapping:**
   - Hit tests (e.g. mouse hover flattening `#console`) compute geometry from `element.getBoundingClientRect()` at runtime, rather than assuming unscaled 1819×865 artboard coordinates.
8. **Safe Area Insets:**
   - Mobile docks and footers incorporate `env(safe-area-inset-bottom, 0px)` to avoid overlapping iOS home bars.

---

## 6. How to Add a New UI Component Correctly

When adding a new component or page to SyncLines, follow this checklist to guarantee responsive compliance:

1. **Use Existing Design Tokens:**
   - Spacing: use `var(--space-1)` through `var(--space-6)` instead of arbitrary pixel values.
   - Sizing: use `rem` for typography and container boundaries.
   - Heights: align interactive controls to `var(--min-tap-target)` (minimum `44px`).
2. **Apply Containment Constraints:**
   - Set `min-width: 0` on the new component if it is placed inside a flex or grid parent.
   - Set `max-width: 100%` on any embedded media, SVG, canvas, or card element.
3. **Handle Wrapping Proactively:**
   - For horizontal button rows, tag lists, or badge groups, always include `flex-wrap: wrap;` and define `gap: ...`.
4. **Never Scale Copy with CSS `transform: scale()`:**
   - Only non-text graphic artwork (like the 3D console cluster or canvas visuals) may use scale-to-fit. Text must remain native CSS DOM text so browser zooming, text reflow, and screen readers function seamlessly.
5. **Verify at Viewport Matrix:**
   - Verify the new component at:
     - 320×568 (narrow phone)
     - 375×667 (standard mobile)
     - 768×1024 (tablet)
     - 1366×620 (short laptop)
     - 1920×910 (standard desktop)
     - 200% and 400% zoom levels.
   - Assert that `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
