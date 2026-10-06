# Pages & Routing

## URL Structure

| URL | What Shows | How |
|-----|-----------|-----|
| `index.html` | Hero 1 (Sync Lyrics & Script) | Default, `currentActiveView = 'hero1'` |
| `index.html#visualizer` | Hero 2 (Audio Visualizer) | `switchView('hero2')` pushes hash |
| `editor/index.html` | Sync Lyrics & Script Editor | Hard navigation via page transition overlay |
| `visualizer/index.html` | Standalone visualizer (legacy) | Not linked in main nav |

---

## SPA View-Switch Architecture

There is NO page reload between Hero 1 and Hero 2. Both panels live in the same `index.html` DOM.

### State Variables (script.js, second IIFE)
```js
var currentActiveView = 'hero1'; // 'hero1' | 'hero2'
var currentActiveProduct = 'lyrics'; // 'lyrics' | 'visualizer' | 'piano'
```

### switchView(targetView, productHint)
```
Args: targetView = 'hero1' | 'hero2'
      productHint = 'lyrics' | 'visualizer' | 'piano' (only used when returning to hero1)

hero2 path:
  1. html + body data-theme → 'hero2'
  2. view-hero1.classList.remove('is-active')
  3. view-hero2.classList.add('is-active')
  4. updateActiveProduct('visualizer')
  5. VisualizerScene.resume()
  6. history.pushState → '#visualizer'
  7. triggerHeroToast(...)

hero1 path:
  1. html + body data-theme → 'hero1'
  2. view-hero2.classList.remove('is-active')
  3. view-hero1.classList.add('is-active')
  4. updateActiveProduct(productHint || 'lyrics')
  5. VisualizerScene.pause()
  6. history.pushState → '' (clears hash)
  7. showToast(...) if productHint === 'lyrics'
```

### updateActiveProduct(product)
Syncs `.active` class on:
- `#dropdown-console-btn` (lyrics)
- `#dropdown-visualizer-btn` (visualizer)
- `#dropdown-piano-btn` (piano)
- `#side-home-btn` (lyrics)
- `#side-visualizer-btn` (visualizer)
- `#side-piano-btn` (piano)

### activateLivePianoTool()
```
1. switchView('hero1', 'piano')
2. updateActiveProduct('piano')
3. window.activateLivePiano() → defined in piano.js
   OR: classList-pulse #mini-piano if piano.js not yet loaded
4. showToast(...)
```

---

## Navigation to Editor (Hard Navigation)

The editor lives at `editor/index.html` — separate HTML file, full page reload.

### navigateToEditor() flow
```
1. If prefersReducedMotion → window.location.href = 'editor/index.html' directly
2. Else:
   a. #pageTransitionOverlay → display:flex, classList.add('is-active')
   b. Wait 520ms
   c. window.location.href = 'editor/index.html'
```

### Triggers for navigateToEditor()
| Trigger Element | ID |
|----------------|----|
| Hero 1 "Upload Music" button | `main-upload-btn` |
| Top header "Upload Music" button (when on Hero 1) | `top-upload-btn` |
| Demo modal "Launch Editor" button | `demoLaunchBtn` |

### Upload Button Context-Aware Logic
| Context | `top-upload-btn` behavior |
|---------|--------------------------|
| Hero 1 active | navigateToEditor() |
| Hero 2 active | openVisualizerComingSoonModal() |

`btn-upload-hero` (Hero 2 upload btn) ALWAYS opens Coming Soon modal — never navigates.

---

## Browser History / Back-Forward Support

```js
window.addEventListener('popstate', function () {
  if (window.location.hash === '#visualizer') {
    switchView('hero2');
  } else {
    switchView('hero1', 'lyrics');
  }
});

// Initial hash check on page load
if (window.location.hash === '#visualizer') {
  switchView('hero2');
} else {
  updateActiveProduct('lyrics');
}
```

---

## CSS Panel Visibility (`.view-panel`)

```css
.view-panel {
  display: none; /* hidden by default */
  /* (or visibility: hidden, depending on version) */
}
.view-panel.is-active {
  display: flex; /* or block */
}
```

The `is-active` class controls which hero panel is rendered. Only one panel is `.is-active` at any time.

---

## Scale-to-Fit System (stage)

`#stage` is a fixed 1819×865 coordinate space. On every resize:
```js
function fitStage() {
  var scaleX = window.innerWidth / 1819;
  var scaleY = window.innerHeight / 865;
  var scale = Math.min(scaleX, scaleY);
  stage.style.transform = 'scale(' + scale + ')';
  // centers horizontally + vertically
}
window.addEventListener('resize', fitStage);
```
All child elements use absolute pixel positions inside this 1819×865 space. The sidebar and header are **outside** `#stage` — they use viewport-relative CSS.
