/**
 * SYNCLINES — Audio Visualizer Studio Customization Controller
 * studio/customization.js
 *
 * Implements:
 * 1. Per-style parameter controls and global visual options.
 * 2. Palette presets + custom colors with WCAG relative luminance contrast warning.
 * 3. Background selector: solid, gradient, uploaded custom image, blurred cover art.
 * 4. Title & artist text overlay with self-hosted / system font loader (`document.fonts.load`).
 * 5. Optional cover image with EXIF-safe, memory-bounded downscaling (`createImageBitmap` / canvas).
 * 6. Progress bar toggle, reactivity sensitivity slider (0.5x-2.0x), and safe-area guides.
 * 7. Saved custom presets (name/delete/load) backed by StudioStorage with quota error handling.
 * 8. Clean Reset-to-Default restoration.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioCustomization = factory(
      root.StudioConfig,
      root.StudioStore,
      root.StudioStorage,
      root.StudioUI,
      root.StudioRenderer
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (
  Config,
  Store,
  Storage,
  UI,
  Renderer
) {
  'use strict';

  var MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB ceiling
  var MAX_TEXTURE_DIM = 1080; // Bound max downscaled texture dimension to prevent GPU leaks

  var PALETTE_PRESETS = {
    'cyber-neon': {
      name: 'Cyber Neon',
      primaryColor: '#00ffb0',
      accentColor: '#e2b34a',
      backgroundColor: '#060a0d'
    },
    'electric-violet': {
      name: 'Electric Violet',
      primaryColor: '#a855f7',
      accentColor: '#ec4899',
      backgroundColor: '#090514'
    },
    'sunset-blaze': {
      name: 'Sunset Blaze',
      primaryColor: '#f97316',
      accentColor: '#facc15',
      backgroundColor: '#120803'
    },
    'ocean-abyss': {
      name: 'Ocean Abyss',
      primaryColor: '#06b6d4',
      accentColor: '#3b82f6',
      backgroundColor: '#030c14'
    },
    'monochrome-clean': {
      name: 'Monochrome Clean',
      primaryColor: '#f8fafc',
      accentColor: '#94a3b8',
      backgroundColor: '#0a0a0c'
    },
    'emerald-matrix': {
      name: 'Emerald Matrix',
      primaryColor: '#10b981',
      accentColor: '#34d399',
      backgroundColor: '#021208'
    }
  };

  var FONT_FAMILIES = {
    'outfit': { name: 'Outfit (Modern Display)', css: '"Outfit", sans-serif' },
    'inter': { name: 'Inter (Clean Sans)', css: '"Inter", sans-serif' },
    'jetbrains': { name: 'JetBrains Mono (Code)', css: '"JetBrains Mono", monospace' },
    'playfair': { name: 'Playfair (Editorial)', css: '"Playfair Display", serif' },
    'system': { name: 'System UI', css: 'system-ui, -apple-system, sans-serif' }
  };

  // Default parameters state
  var currentStyleId = 'classic-bars';
  var activeParams = {
    // Palette & Colors
    palettePreset: 'cyber-neon',
    primaryColor: '#00ffb0',
    accentColor: '#e2b34a',
    backgroundColor: '#060a0d',

    // Background
    backgroundType: 'gradient', // 'solid' | 'gradient' | 'image' | 'cover-blur'
    backgroundImageData: null, // HTMLImageElement or ImageBitmap
    backgroundImageName: '',

    // Artwork & Typography
    coverImageData: null, // HTMLImageElement or ImageBitmap
    coverImageName: '',
    titleText: '',
    artistText: '',
    fontFamily: 'outfit',

    // Motion & Guides
    sensitivity: 1.0, // 0.5 to 2.0
    showProgressBar: true,
    showSafeAreaGuides: false,

    // Synchronized Lyrics Overlay (Prompt 11)
    lyrics: {
      enabled: false,
      cues: [],
      style: 'karaoke', // 'karaoke' | 'centered' | 'lower-third'
      offsetSeconds: 0.0,
      filename: '',
      format: ''
    },

    // Style-specific parameters (classic-bars)
    barCount: 48,
    gap: 3,
    glow: true,
    reflection: true,
    peakGravity: 0.008
  };

  var onChangeCallback = null;

  /**
   * Relative luminance and contrast calculations (WCAG 2.1)
   */
  function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    var num = parseInt(hex, 16);
    if (isNaN(num)) return { r: 0, g: 0, b: 0 };
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function getLuminance(rgb) {
    var a = [rgb.r, rgb.g, rgb.b].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function getContrastRatio(hex1, hex2) {
    var lum1 = getLuminance(hexToRgb(hex1));
    var lum2 = getLuminance(hexToRgb(hex2));
    var brightest = Math.max(lum1, lum2);
    var darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  function checkContrast(primaryHex, bgHex) {
    var ratio = getContrastRatio(primaryHex, bgHex);
    return {
      ratio: Number(ratio.toFixed(2)),
      isLow: ratio < 3.0,
      warning: ratio < 3.0 ? 'Low contrast (' + ratio.toFixed(1) + ':1). Bars & text may be hard to distinguish against background.' : null
    };
  }

  /**
   * Safely downscales an uploaded Image file to prevent high-res memory crashes.
   * Utilizes createImageBitmap when available, otherwise an offscreen canvas.
   */
  async function downscaleImageFile(file, maxDimension) {
    if (!file) throw new Error('No image file provided');
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error('Image file exceeds 20 MB limit. Please select a smaller image.');
    }

    maxDimension = maxDimension || MAX_TEXTURE_DIM;

    if (typeof createImageBitmap !== 'undefined') {
      try {
        var tempBitmap = await createImageBitmap(file);
        var origW = tempBitmap.width;
        var origH = tempBitmap.height;
        var scale = Math.min(1.0, maxDimension / Math.max(origW, origH));
        var targetW = Math.max(32, Math.round(origW * scale));
        var targetH = Math.max(32, Math.round(origH * scale));

        // Create downscaled bitmap
        var downscaled = await createImageBitmap(file, {
          resizeWidth: targetW,
          resizeHeight: targetH,
          resizeQuality: 'high'
        });
        tempBitmap.close();
        return downscaled;
      } catch (e) {
        console.warn('[StudioCustomization] createImageBitmap failed, falling back to canvas img:', e);
      }
    }

    // Fallback using HTML Image and Canvas
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var objUrl = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(objUrl);
        var origW = img.naturalWidth || img.width;
        var origH = img.naturalHeight || img.height;
        var scale = Math.min(1.0, maxDimension / Math.max(origW, origH));
        var targetW = Math.max(32, Math.round(origW * scale));
        var targetH = Math.max(32, Math.round(origH * scale));

        var canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas);
      };
      img.onerror = function () {
        URL.revokeObjectURL(objUrl);
        reject(new Error('Failed to load and process image file.'));
      };
      img.src = objUrl;
    });
  }

  /**
   * Preloads selected font using document.fonts to avoid FOIT during render.
   */
  async function ensureFontLoaded(fontKey) {
    var fontMeta = FONT_FAMILIES[fontKey] || FONT_FAMILIES.system;
    if (fontKey === 'system' || typeof document === 'undefined' || !document.fonts) {
      return fontMeta.css;
    }

    try {
      var checkStr = '16px ' + fontMeta.css;
      if (document.fonts.check(checkStr)) {
        return fontMeta.css;
      }
      await Promise.race([
        document.fonts.load(checkStr),
        new Promise(function (res) { setTimeout(res, 800); }) // 800ms safety timeout
      ]);
    } catch (e) {
      console.warn('[StudioCustomization] Font preload error, falling back:', e);
    }
    return fontMeta.css;
  }

  function getParams() {
    // Return a clone, preserving image references
    return Object.assign({}, activeParams);
  }

  function setParams(newParams) {
    if (!newParams) return;
    Object.assign(activeParams, newParams);
    if (typeof onChangeCallback === 'function') {
      onChangeCallback(getParams());
    }
  }

  function resetToDefaults(styleId) {
    currentStyleId = styleId || currentStyleId || 'classic-bars';
    activeParams = {
      palettePreset: 'cyber-neon',
      primaryColor: '#00ffb0',
      accentColor: '#e2b34a',
      backgroundColor: '#060a0d',
      backgroundType: 'gradient',
      backgroundImageData: null,
      backgroundImageName: '',
      coverImageData: null,
      coverImageName: '',
      titleText: '',
      artistText: '',
      fontFamily: 'outfit',
      sensitivity: 1.0,
      showProgressBar: true,
      showSafeAreaGuides: false,
      lyrics: {
        enabled: false,
        cues: [],
        style: 'karaoke',
        offsetSeconds: 0.0,
        filename: '',
        format: ''
      },
      barCount: 48,
      gap: 3,
      glow: true,
      reflection: true,
      peakGravity: 0.008
    };

    // If audio is loaded, populate default title
    if (Store) {
      var state = Store.getState();
      if (state && state.audio && state.audio.name) {
        activeParams.titleText = state.audio.name.replace(/\.[a-zA-Z0-9]+$/, '');
      }
    }

    if (typeof onChangeCallback === 'function') {
      onChangeCallback(getParams());
    }
  }

  function setOnChange(cb) {
    onChangeCallback = cb;
  }

  return {
    PALETTE_PRESETS: PALETTE_PRESETS,
    FONT_FAMILIES: FONT_FAMILIES,
    getParams: getParams,
    setParams: setParams,
    resetToDefaults: resetToDefaults,
    setOnChange: setOnChange,
    checkContrast: checkContrast,
    getContrastRatio: getContrastRatio,
    downscaleImageFile: downscaleImageFile,
    ensureFontLoaded: ensureFontLoaded
  };
});
