# Theming System

## Architecture Overview

There are two separate theme systems in the project:

1. **Root Shell Dual-Theme** — `index.html` uses `data-theme="hero1"` or `data-theme="hero2"` on `<html>` and `<body>`. Switches the sidebar and header colors between a cream/green palette (Hero 1) and a dark charcoal/gold palette (Hero 2).
2. **Editor Light/Dark Theme** — `editor/index.html` uses `data-theme="light"` or `data-theme="dark"` on `<html>`. Persisted in `localStorage` under key `"synclines-editor-theme"`. Defaults to `"light"`.

---

## Root Shell Dual-Theme (index.html + style.css)

### How to Switch
```js
// In script.js → switchView()
document.documentElement.setAttribute('data-theme', 'hero2'); // or 'hero1'
document.body.setAttribute('data-theme', 'hero2');
```

Both `<html>` and `<body>` receive the attribute — this is intentional for selector specificity.

### Token Namespaces (style.css)

Global base tokens in `:root` (never change):
```css
:root {
  --bg-sand: #fbf7ee;
  --text-main: #0f1e15;
  --brand-green: #0a5836;
  --brand-green-glow: #10b981;
  --brand-wine: #5a0e23;
  --accent-gold: #c89e4b;
  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out:   cubic-bezier(0.23, 1, 0.32, 1);
  /* + Piano palette: --green-900, --mint, --lime, --cream, --gold, etc. */
}
```

Shell tokens (override per theme in `[data-theme="hero1"]` / `[data-theme="hero2"]`):
```
Prefix: --shell-*
Groups: sidebar, header, side-btn, side-logo, header-nav, header-divider, status, 
        header-brand, badge, btn-primary
```

### Hero 1 Token Values (`[data-theme="hero1"]`)
```
Sidebar bg:        rgba(255,255,255,0.88)
Sidebar border:    rgba(22,38,28,0.09)
Side logo bg:      #0d1e15 (dark green)
Side btn color:    #495e50
Side active color: #0c6a40
Header bg:         rgba(251,247,238,0.94)  (cream)
Header border:     rgba(22,38,28,0.07)
Brand title:       #0f1e15 (near-black)
Status dot:        #10b981 (emerald green)
btn-primary bg:    #063a23 → #0a5836 (dark green gradient)
btn-primary text:  #f0ffe8
```

### Hero 2 Token Values (`[data-theme="hero2"]`)
```
Sidebar bg:        rgba(12,16,20,0.88)     (deep charcoal)
Sidebar border:    rgba(255,255,255,0.05)
Side logo bg:      #0d1218 (near black)
Side btn color:    #a8b8c8 (cool grey)
Side active color: #ffc542 (warm gold)
Header bg:         rgba(8,12,16,0.90)
Header border:     rgba(255,255,255,0.04)
Brand title:       #e8f0f8 (near white)
Status dot:        #00ff88 (neon green)
btn-primary bg:    #1a5c38 → #00c868 gradient
btn-primary text:  #c8ffe0
```

### CSS Usage Pattern
```css
/* Component styled with shell token — auto-adapts to both themes */
#top {
  background: var(--shell-header-bg);
  border-bottom: 1px solid var(--shell-header-border);
}
```

---

## Editor Dual Light/Dark Theme (editor/app.js + editor/styles.css)

### How to Switch
```js
// editor/app.js → initTheme()
document.documentElement.setAttribute('data-theme', 'dark'); // or 'light'
localStorage.setItem('synclines-editor-theme', 'dark');
```

### Default Behavior
- Always defaults to `"light"` unless `localStorage` explicitly stores `"dark"`.
- The `window.TimingConsoleSpectrum.updateColors()` call fires after theme switch to re-paint the Canvas spectrum analyzer.

### Token Prefix: `--ed-*` (editor-specific)
The editor styles.css uses CSS custom properties scoped to `[data-theme="light"]` and `[data-theme="dark"]` selectors on `:root`.

**Light** — cream/white background, dark green text, muted borders.
**Dark** — near-black background, near-white text, subtle glows.

---

## Mini Piano Palette (piano.js)

The piano does NOT use CSS custom properties for its key colors — they are hardcoded in `piano.js`:
```js
const PALETTE = {
  mint: '#6ee7b7', sage: '#86efac', cyan: '#7dd3fc',
  blue: '#93c5fd', yellow: '#fde047', orange: '#fdba74',
  coral: '#fda4af', pink: '#f472b6', orchid: '#e879f9',
  lavender: '#c084fc', hydrangea: '#a5b4fc', lime: '#bef264'
};
```
Key-glow colors are rendered on an HTML5 Canvas — they do not change with theme switches.

---

## Adding a New Shell Token (How-To)

1. Add `--shell-my-token: <hero1-value>` inside `:root, [data-theme="hero1"] { }` block in `style.css`.
2. Add `--shell-my-token: <hero2-value>` inside `[data-theme="hero2"] { }` block.
3. Use `var(--shell-my-token)` in the component's CSS.
4. The component will auto-switch between themes when `switchView()` is called.
