/**
 * SYNCLINES — Audio Visualizer Studio Style Selection Screen Controller
 * studio/styles.js
 *
 * Implements:
 * 1. Category filtering, paginated grid loading with zero CLS, and curated "Suggested for you" row.
 * 2. 150ms hover-intent animated canvas preview with single-active-loop enforcement.
 * 3. Library Features (Prompt 10):
 *    - Real-time search query filtering across name, description, category, and tags.
 *    - Favorites system with star/heart toggling per card and dedicated Favorites filter.
 *    - "Surprise Me" randomized style selector with smooth scroll and visual highlight.
 *    - "Clear My Data" total privacy reset wiping IndexedDB audio sessions, presets, and history.
 *    - Keyboard shortcuts dialog trigger.
 *    - Recently used style history tracking.
 * 4. Single selection with sticky bottom action bar handoff to render settings.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioStyles = factory(
      root.StudioConfig || (typeof window !== 'undefined' ? window.StudioConfig : null),
      root.StudioStore || (typeof window !== 'undefined' ? window.StudioStore : null),
      root.StudioStorage || (typeof window !== 'undefined' ? window.StudioStorage : null),
      root.StudioUI || (typeof window !== 'undefined' ? window.StudioUI : null),
      root.StudioRouter || (typeof window !== 'undefined' ? window.StudioRouter : null)
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (
  Config,
  Store,
  Storage,
  UI,
  Router
) {
  'use strict';

  Config = Config || (typeof window !== 'undefined' ? window.StudioConfig : null);
  Store = Store || (typeof window !== 'undefined' ? window.StudioStore : null);
  Storage = Storage || (typeof window !== 'undefined' ? window.StudioStorage : null);
  UI = UI || (typeof window !== 'undefined' ? window.StudioUI : null);
  Router = {
    navigate: function (route, replace) {
      var r = (window.Studio && window.Studio.getRouter && window.Studio.getRouter()) || null;
      if (r && typeof r.navigate === 'function') return r.navigate(route, replace);
      if (typeof window !== 'undefined') window.location.hash = route; // router listens to hashchange
    }
  };

  var PAGE_SIZE = 12;
  var allStyles = [];
  var currentCategory = 'all';
  var searchQuery = '';
  var favoritesFilter = false;
  var favoritesList = [];
  var displayedCount = 0;
  var isLoading = false;
  var selectedStyleId = null;

  // Single active preview manager
  var activePreviewCard = null;
  var activeAnimationId = null;
  var hoverIntentTimer = null;
  var HOVER_INTENT_MS = 150;

  // DOM references
  var containerEl = null;
  var audioSummaryEl = null;
  var suggestedGridEl = null;
  var categoryChipsEl = null;
  var stylesGridEl = null;
  var loadMoreContainerEl = null;
  var announcerEl = null;
  var skeletonGridEl = null;
  var errorStateEl = null;

  // Library toolbar DOM references
  var searchInputEl = null;
  var searchClearBtn = null;
  var surpriseMeBtn = null;
  var favFilterBtn = null;
  var favCountBadge = null;
  var clearDataBtn = null;
  var shortcutsBtn = null;

  // Sticky bottom bar DOM references
  var stickyBarEl = null;
  var stickyThumbEl = null;
  var stickyNameEl = null;
  var stickyCategoryEl = null;
  var stickyChangeBtn = null;
  var stickyContinueBtn = null;

  function prefersReducedMotion() {
    return typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '00:00';
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    return (mins < 10 ? '0' + mins : mins) + ':' + (secs < 10 ? '0' + secs : secs);
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function updateAudioSummary() {
    if (!audioSummaryEl) return;
    var state = Store ? Store.getState() : null;
    var audio = state ? state.audio : null;

    if (!audio) {
      audioSummaryEl.innerHTML =
        '<div class="studio-audio-summary-card no-audio">' +
          '<div class="studio-summary-left">' +
            '<span class="studio-warning-dot"></span>' +
            '<span class="studio-summary-filename">No audio track loaded</span>' +
          '</div>' +
          '<button type="button" class="studio-btn studio-btn-secondary studio-btn-sm" id="studio-summary-upload-btn">Upload Track</button>' +
        '</div>';

      var uploadBtn = audioSummaryEl.querySelector('#studio-summary-upload-btn');
      if (uploadBtn) {
        uploadBtn.addEventListener('click', function () {
          if (window.StudioUploadModal) window.StudioUploadModal.open();
        });
      }
      return;
    }

    audioSummaryEl.innerHTML =
      '<div class="studio-audio-summary-card" role="region" aria-label="Loaded audio track details">' +
        '<div class="studio-summary-left">' +
          '<div class="studio-summary-badge">' +
            '<span class="studio-pulse-dot" aria-hidden="true"></span>' +
            '<span>AUDIO READY</span>' +
          '</div>' +
          '<div class="studio-summary-track-info">' +
            '<strong class="studio-summary-filename">' + escapeHTML(audio.name) + '</strong>' +
            '<span class="studio-summary-meta">' +
              formatTime(audio.duration) + ' &bull; ' +
              formatBytes(audio.size) + ' &bull; ' +
              audio.sampleRate + ' Hz ' + (audio.channels === 1 ? 'Mono' : 'Stereo') +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div class="studio-summary-right">' +
          '<canvas id="studio-summary-mini-wf" class="studio-summary-waveform" width="120" height="28" aria-hidden="true"></canvas>' +
          '<button type="button" class="studio-btn studio-btn-ghost studio-btn-sm" id="studio-summary-change-btn">Change Audio</button>' +
        '</div>' +
      '</div>';

    var miniWf = audioSummaryEl.querySelector('#studio-summary-mini-wf');
    if (miniWf && audio.waveform) {
      renderMiniWaveform(miniWf, audio.waveform);
    }

    var changeBtn = audioSummaryEl.querySelector('#studio-summary-change-btn');
    if (changeBtn) {
      changeBtn.addEventListener('click', function () {
        if (window.StudioUploadModal) window.StudioUploadModal.open();
      });
    }
  }

  function renderMiniWaveform(canvas, waveform) {
    if (!canvas || !waveform || !waveform.length) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    var barWidth = (w / waveform.length) - 1.5;
    for (var i = 0; i < waveform.length; i++) {
      var val = waveform[i];
      var barH = Math.max(3, val * (h - 6));
      var x = i * (barWidth + 1.5);
      var y = (h - barH) / 2;

      ctx.fillStyle = i < waveform.length * 0.4 ? '#00ffb0' : 'rgba(226, 179, 74, 0.55)';
      ctx.fillRect(x, y, Math.max(2, barWidth), barH);
    }
  }

  function fetchStyles() {
    setLoadingState(true, false);

    var stylesUrl = 'studio/data/styles.json';
    fetch(stylesUrl)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        allStyles = Array.isArray(data) ? data : [];
        setLoadingState(false, false);
        loadFavorites().then(function () {
          renderCategories();
          renderSuggested();
          renderGrid(true);
          syncSelectedStateFromStore();
        });
      })
      .catch(function (err) {
        console.error('[StudioStyles] Failed fetching styles.json:', err);
        setLoadingState(false, true);
      });
  }

  function loadFavorites() {
    if (!Storage) return Promise.resolve([]);
    return Storage.getFavorites().then(function (favs) {
      favoritesList = favs || [];
      updateFavoriteBadge();
      return favoritesList;
    });
  }

  function updateFavoriteBadge() {
    if (favCountBadge) {
      favCountBadge.textContent = favoritesList.length;
    }
  }

  function setLoadingState(loading, isError) {
    isLoading = loading;
    if (skeletonGridEl) skeletonGridEl.style.display = loading ? 'grid' : 'none';
    if (stylesGridEl) stylesGridEl.style.display = loading || isError ? 'none' : 'grid';
    if (errorStateEl) errorStateEl.style.display = isError ? 'block' : 'none';
    if (loadMoreContainerEl) loadMoreContainerEl.style.display = loading || isError ? 'none' : 'flex';
  }

  function getFilteredStyles() {
    var result = allStyles;

    // 1. Favorites filter
    if (favoritesFilter) {
      result = result.filter(function (s) {
        return favoritesList.indexOf(s.id) !== -1;
      });
    } else if (currentCategory !== 'all') {
      result = result.filter(function (s) {
        return s.category === currentCategory;
      });
    }

    // 2. Search query filter
    if (searchQuery) {
      var q = searchQuery.toLowerCase().trim();
      result = result.filter(function (s) {
        var nameMatch = s.name && s.name.toLowerCase().indexOf(q) !== -1;
        var descMatch = s.description && s.description.toLowerCase().indexOf(q) !== -1;
        var catMatch = (s.categoryLabel || s.category) && (s.categoryLabel || s.category).toLowerCase().indexOf(q) !== -1;
        var tagMatch = s.tags && s.tags.some(function (t) { return t.toLowerCase().indexOf(q) !== -1; });
        return nameMatch || descMatch || catMatch || tagMatch;
      });
    }

    return result;
  }

  function renderCategories() {
    if (!categoryChipsEl) return;

    var categories = [
      { id: 'all', label: 'All Styles' },
      { id: 'classic-bars', label: 'Classic Bars' },
      { id: 'circular-radial', label: 'Circular & Radial' },
      { id: 'waveform-lines', label: 'Waveform Lines' },
      { id: 'particles-space', label: 'Particles & Space' },
      { id: 'neon-cyber', label: 'Neon & Cyber' },
      { id: 'minimal-clean', label: 'Minimal & Clean' },
      { id: 'retro-vintage', label: 'Retro & Vintage' },
      { id: 'organic-fluid', label: 'Organic & Fluid' },
      { id: 'lyric-friendly', label: 'Lyric-friendly' }
    ];

    var html = '<div class="studio-category-chips-list" role="tablist" aria-label="Visualizer Style Categories">';
    categories.forEach(function (cat) {
      var count = cat.id === 'all' ? allStyles.length : allStyles.filter(function (s) { return s.category === cat.id; }).length;
      var isActive = cat.id === currentCategory && !favoritesFilter;
      html +=
        '<button type="button" class="studio-cat-chip' + (isActive ? ' is-active' : '') + '" ' +
          'role="tab" aria-selected="' + (isActive ? 'true' : 'false') + '" data-cat="' + cat.id + '">' +
          '<span>' + cat.label + '</span>' +
          '<span class="studio-cat-count">' + count + '</span>' +
        '</button>';
    });
    html += '</div>';

    categoryChipsEl.innerHTML = html;

    var chips = categoryChipsEl.querySelectorAll('.studio-cat-chip');
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var catId = chip.getAttribute('data-cat');
        stopPreview();
        currentCategory = catId;
        favoritesFilter = false;
        if (favFilterBtn) {
          favFilterBtn.setAttribute('aria-pressed', 'false');
          favFilterBtn.classList.remove('is-active');
        }

        chips.forEach(function (c) {
          var sel = c === chip;
          c.classList.toggle('is-active', sel);
          c.setAttribute('aria-selected', sel ? 'true' : 'false');
        });
        renderGrid(true);
        if (announcerEl) {
          var filtered = getFilteredStyles();
          announcerEl.textContent = 'Showing ' + chip.textContent.trim() + ' (' + filtered.length + ' styles)';
        }
      });
    });
  }

  function createCardHTML(style) {
    var isSelected = style.id === selectedStyleId;
    var isFav = favoritesList.indexOf(style.id) !== -1;
    var ratioBadges = (style.ratios || ['16:9']).map(function (r) {
      return '<span class="studio-ratio-badge">' + r + '</span>';
    }).join('');

    return (
      '<div class="studio-style-card' + (isSelected ? ' is-selected' : '') + '" ' +
        'role="radio" aria-checked="' + (isSelected ? 'true' : 'false') + '" ' +
        'tabindex="0" data-style-id="' + style.id + '" data-category="' + style.category + '">' +
        '<div class="studio-card-thumb-wrap">' +
          '<img src="' + style.thumb + '" alt="' + escapeHTML(style.name) + ' visualizer preview" ' +
            'class="studio-card-thumb" width="640" height="360" loading="lazy" decoding="async" ' +
            'onerror="this.style.display=\'none\';this.parentElement.classList.add(\'has-fallback-thumb\');" />' +
          '<div class="studio-card-fallback-thumb" aria-hidden="true">' +
            '<span class="studio-fallback-icon">✨</span>' +
            '<span>' + escapeHTML(style.name) + '</span>' +
          '</div>' +
          '<canvas class="studio-card-preview-canvas" width="640" height="360" aria-hidden="true" style="display:none;"></canvas>' +
          '<div class="studio-card-live-pill" aria-hidden="true"><span class="studio-live-dot"></span> PREVIEW</div>' +
          '<span class="studio-demo-ribbon">DEMO</span>' +
          '<button type="button" class="studio-card-fav-btn' + (isFav ? ' is-favorite' : '') + '" aria-label="' + (isFav ? 'Remove from favorites' : 'Add to favorites') + '" data-style-id="' + style.id + '">♥</button>' +
          '<div class="studio-card-selected-check" aria-hidden="true">✓</div>' +
          '<div class="studio-card-actions-overlay">' +
            '<button type="button" class="studio-card-overlay-btn studio-card-btn-preview" aria-label="Preview ' + escapeHTML(style.name) + ' motion">' +
              '<span class="btn-icon">▶</span> <span class="btn-text">Preview</span>' +
            '</button>' +
            '<button type="button" class="studio-card-overlay-btn studio-card-btn-select' + (isSelected ? ' is-active' : '') + '" aria-label="Select ' + escapeHTML(style.name) + ' style">' +
              '<span class="btn-icon">✓</span> <span class="btn-text">' + (isSelected ? 'Selected' : 'Select') + '</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="studio-card-body">' +
          '<div class="studio-card-header-row">' +
            '<h3 class="studio-card-title">' + escapeHTML(style.name) + '</h3>' +
            '<span class="studio-card-cat-label">' + escapeHTML(style.categoryLabel || style.category) + '</span>' +
          '</div>' +
          '<p class="studio-card-desc">' + escapeHTML(style.description) + '</p>' +
          '<div class="studio-card-footer-row">' +
            '<div class="studio-card-ratios">' + ratioBadges + '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderSuggested() {
    if (!suggestedGridEl) return;
    var suggested = allStyles.filter(function (s) { return s.suggested; });
    if (!suggested.length) {
      suggestedGridEl.style.display = 'none';
      return;
    }

    var state = Store ? Store.getState() : null;
    var audio = state ? state.audio : null;
    var analysis = (audio && audio.analysis) ||
      (window.StudioRenderer && typeof window.StudioRenderer.getAnalysis === 'function' && window.StudioRenderer.getAnalysis()) ||
      null; // analysis may be missing (failed / not finished / restored session): fall back to the curated order
    if (analysis && analysis.profile && analysis.profile.suggestedCategories) {
      var topCats = analysis.profile.suggestedCategories;
      suggested.sort(function (a, b) {
        var aRank = topCats.indexOf(a.category);
        var bRank = topCats.indexOf(b.category);
        if (aRank === -1) aRank = 99;
        if (bRank === -1) bRank = 99;
        return aRank - bRank;
      });
    }

    suggestedGridEl.style.display = 'block';
    var cardsHtml = suggested.map(function (s) { return createCardHTML(s); }).join('');

    suggestedGridEl.innerHTML =
      '<div class="studio-section-subheading">' +
        '<div class="studio-suggested-title-wrap">' +
          '<span class="studio-star-icon" aria-hidden="true">✦</span>' +
          '<h3 class="studio-suggested-h3">Suggested For You</h3>' +
        '</div>' +
        '<p class="studio-suggested-lead">Curated popular visualizer presets tuned for immediate impact.</p>' +
      '</div>' +
      '<div class="studio-suggested-cards-row" role="radiogroup" aria-label="Suggested Visualizer Presets">' +
        cardsHtml +
      '</div>';

    bindCardInteractions(suggestedGridEl);
  }

  function renderGrid(reset) {
    if (!stylesGridEl) return;
    var filtered = getFilteredStyles();

    if (reset) {
      displayedCount = 0;
      stylesGridEl.innerHTML = '';
    }

    if (!filtered.length) {
      var emptyMsg = favoritesFilter
        ? 'No favorite styles yet. Click the heart icon (♥) on any card to save it here.'
        : (searchQuery
          ? 'No styles matched "' + escapeHTML(searchQuery) + '".'
          : 'No styles found in this category.');

      stylesGridEl.innerHTML =
        '<div class="studio-empty-category">' +
          '<p class="studio-empty-cat-title">' + emptyMsg + '</p>' +
          '<button type="button" class="studio-btn studio-btn-secondary studio-btn-sm" id="studio-btn-reset-cat">View All Styles</button>' +
        '</div>';
      var resetBtn = stylesGridEl.querySelector('#studio-btn-reset-cat');
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          currentCategory = 'all';
          searchQuery = '';
          favoritesFilter = false;
          if (searchInputEl) searchInputEl.value = '';
          if (searchClearBtn) searchClearBtn.style.display = 'none';
          if (favFilterBtn) {
            favFilterBtn.setAttribute('aria-pressed', 'false');
            favFilterBtn.classList.remove('is-active');
          }
          renderCategories();
          renderGrid(true);
        });
      }
      updateLoadMore(0, 0);
      return;
    }

    var nextBatch = filtered.slice(displayedCount, displayedCount + PAGE_SIZE);
    displayedCount += nextBatch.length;

    var temp = document.createElement('div');
    temp.innerHTML = nextBatch.map(function (s) { return createCardHTML(s); }).join('');

    var newNodes = [];
    while (temp.firstChild) {
      var node = temp.firstChild;
      newNodes.push(node);
      stylesGridEl.appendChild(node);
    }

    bindCardInteractions(stylesGridEl, newNodes);
    updateLoadMore(displayedCount, filtered.length);
  }

  function updateLoadMore(shown, total) {
    if (!loadMoreContainerEl) return;

    if (shown >= total || total <= PAGE_SIZE) {
      loadMoreContainerEl.innerHTML =
        total > 0
          ? '<span class="studio-load-more-status">Showing all ' + total + ' styles</span>'
          : '';
      return;
    }

    loadMoreContainerEl.innerHTML =
      '<div class="studio-load-more-wrap">' +
        '<button type="button" class="studio-btn studio-btn-secondary" id="studio-load-more-btn">' +
          'Load More Styles (' + (total - shown) + ' remaining)' +
        '</button>' +
        '<span class="studio-load-more-status">Showing ' + shown + ' of ' + total + ' styles</span>' +
      '</div>';

    var btn = loadMoreContainerEl.querySelector('#studio-load-more-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        renderGrid(false);
      });
    }
  }

  function syncSelectedStateFromStore() {
    var state = Store ? Store.getState() : null;
    if (state && state.styleId) {
      selectedStyleId = state.styleId;
      var styleObj = allStyles.find(function (s) { return s.id === state.styleId; });
      if (styleObj) {
        updateStickyBar(styleObj);
      }
    }
  }

  /* =====================================================================
     CARD PREVIEW ENGINE (Prompt 5)
     ===================================================================== */
  function startPreview(card) {
    if (!card) return;
    if (prefersReducedMotion()) return;

    if (activePreviewCard && activePreviewCard !== card) {
      stopPreview();
    }

    activePreviewCard = card;
    card.classList.add('is-previewing');

    var canvas = card.querySelector('.studio-card-preview-canvas');
    if (!canvas) return;
    canvas.style.display = 'block';

    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    var cat = card.getAttribute('data-category');
    var startT = performance.now();

    function animate(now) {
      if (!activePreviewCard || activePreviewCard !== card) return;
      var elapsed = (now - startT) / 1000;

      ctx.fillStyle = 'rgba(6, 10, 13, 0.28)';
      ctx.fillRect(0, 0, w, h);

      if (cat === 'circular-radial') {
        var cx = w / 2, cy = h / 2;
        var rBase = Math.min(w, h) * 0.22;
        var barNum = 36;
        for (var i = 0; i < barNum; i++) {
          var ang = (i / barNum) * Math.PI * 2 + elapsed * 0.8;
          var spike = Math.sin(i * 0.7 + elapsed * 8.0) * 28 + Math.cos(i * 1.3 - elapsed * 4.0) * 14 + 18;
          spike = Math.max(6, Math.min(64, spike));
          ctx.strokeStyle = i % 2 === 0 ? '#00ffb0' : '#e2b34a';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * (rBase + 4), cy + Math.sin(ang) * (rBase + 4));
          ctx.lineTo(cx + Math.cos(ang) * (rBase + spike), cy + Math.sin(ang) * (rBase + spike));
          ctx.stroke();
        }
      } else if (cat === 'waveform-lines') {
        var cyW = h / 2;
        ctx.lineWidth = 3;
        for (var layer = 0; layer < 3; layer++) {
          ctx.strokeStyle = layer === 0 ? '#00ffb0' : (layer === 1 ? '#e2b34a' : 'rgba(80, 210, 255, 0.7)');
          ctx.beginPath();
          for (var x = 0; x <= w; x += 8) {
            var normX = x / w;
            var env = Math.sin(normX * Math.PI);
            var y = cyW + Math.sin(normX * 12.0 + elapsed * (4.0 + layer * 1.5)) * (40 * env) + Math.cos(normX * 6.0 - elapsed * 2.0) * (18 * env);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else if (cat === 'particles-space') {
        var cxP = w / 2, cyP = h / 2;
        for (var p = 0; p < 45; p++) {
          var angP = p * 0.35 + elapsed * 0.4;
          var dist = ((p * 18 + elapsed * 90) % (w * 0.45));
          var px = cxP + Math.cos(angP) * dist;
          var py = cyP + Math.sin(angP) * dist * 0.6;
          var sz = Math.max(1.5, (dist / (w * 0.45)) * 3.5);
          ctx.fillStyle = p % 2 === 0 ? '#00ffb0' : '#e2b34a';
          ctx.beginPath();
          ctx.arc(px, py, sz, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (cat === 'neon-cyber') {
        var horizY = h / 2 + 20;
        ctx.strokeStyle = '#00ffb0';
        ctx.lineWidth = 1;
        for (var gx = -60; gx <= w + 60; gx += 40) {
          ctx.beginPath();
          ctx.moveTo(w / 2, horizY);
          ctx.lineTo(gx, h);
          ctx.stroke();
        }
        var phase = (elapsed * 35) % 30;
        for (var gy = horizY; gy <= h; gy += 15) {
          ctx.beginPath();
          ctx.moveTo(0, gy + phase);
          ctx.lineTo(w, gy + phase);
          ctx.stroke();
        }
        ctx.strokeStyle = '#ff4d94';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, horizY);
        ctx.lineTo(w, horizY);
        ctx.stroke();
      } else {
        // Default: dynamic jumping equalizer bars
        var numB = 24;
        var bW = (w - 80) / numB;
        var baseB = h - 40;
        for (var b = 0; b < numB; b++) {
          var bx = 40 + b * bW;
          var wave = Math.sin(b * 0.4 + elapsed * 6.0) * 0.5 + 0.5;
          var bh = 14 + wave * 160 + (b % 3 === 0 ? Math.sin(elapsed * 12.0) * 20 : 0);
          bh = Math.max(8, Math.min(220, bh));

          var grad = ctx.createLinearGradient(0, baseB - bh, 0, baseB);
          grad.addColorStop(0, '#00ffb0');
          grad.addColorStop(0.6, '#e2b34a');
          grad.addColorStop(1, '#ff6b4a');
          ctx.fillStyle = grad;
          ctx.fillRect(bx + 2, baseB - bh, bW - 4, bh);

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(bx + 2, Math.max(20, baseB - bh - 6), bW - 4, 2);
        }
      }

      activeAnimationId = requestAnimationFrame(animate);
    }

    activeAnimationId = requestAnimationFrame(animate);
  }

  function stopPreview() {
    if (hoverIntentTimer) {
      clearTimeout(hoverIntentTimer);
      hoverIntentTimer = null;
    }

    if (activeAnimationId) {
      cancelAnimationFrame(activeAnimationId);
      activeAnimationId = null;
    }

    if (activePreviewCard) {
      activePreviewCard.classList.remove('is-previewing');
      var canvas = activePreviewCard.querySelector('.studio-card-preview-canvas');
      if (canvas) {
        canvas.style.display = 'none';
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      activePreviewCard = null;
    }
  }

  function updateStickyBar(style) {
    if (!stickyBarEl || !stickyBarEl.__studioBound) {
      stickyBarEl = document.getElementById('studio-styles-sticky-bar');
      stickyThumbEl = document.getElementById('studio-sticky-thumb');
      stickyNameEl = document.getElementById('studio-sticky-name');
      stickyCategoryEl = document.getElementById('studio-sticky-category');
      stickyChangeBtn = document.getElementById('studio-sticky-change-btn');
      stickyContinueBtn = document.getElementById('studio-sticky-continue-btn');

      if (stickyChangeBtn) {
        stickyChangeBtn.addEventListener('click', function () {
          deselectCurrentStyle();
        });
      }

      if (stickyContinueBtn) {
        stickyContinueBtn.addEventListener('click', function () {
          if (!selectedStyleId) {
            if (UI && UI.showToast) UI.showToast('Please select a visualizer style first.', 'warning');
            return;
          }
          if (Router) {
            Router.navigate('#visualizer/settings');
          } else if (window.Studio && window.Studio.getRouter()) {
            window.Studio.getRouter().navigate('#visualizer/settings');
          }
        });
      }
      if (stickyBarEl) stickyBarEl.__studioBound = true;
    }

    if (!stickyBarEl) return;

    if (!style) {
      stickyBarEl.style.display = 'none';
      stickyBarEl.classList.remove('is-visible');
      return;
    }

    if (stickyThumbEl) {
      stickyThumbEl.src = style.thumb;
      stickyThumbEl.alt = style.name + ' preview';
    }
    if (stickyNameEl) stickyNameEl.textContent = style.name;
    if (stickyCategoryEl) stickyCategoryEl.textContent = '• ' + (style.categoryLabel || style.category);

    stickyBarEl.style.display = 'block';
    void stickyBarEl.offsetWidth;
    stickyBarEl.classList.add('is-visible');
  }

  function selectStyle(styleId) {
    var targetStyle = allStyles.find(function (s) { return s.id === styleId; });
    if (!targetStyle) return;

    selectedStyleId = styleId;

    var cards = document.querySelectorAll('.studio-style-card');
    cards.forEach(function (card) {
      var isTarget = card.getAttribute('data-style-id') === styleId;
      card.classList.toggle('is-selected', isTarget);
      card.setAttribute('aria-checked', isTarget ? 'true' : 'false');

      var selectBtn = card.querySelector('.studio-card-btn-select');
      if (selectBtn) {
        selectBtn.classList.toggle('is-active', isTarget);
        var lbl = selectBtn.querySelector('.btn-text');
        if (lbl) lbl.textContent = isTarget ? 'Selected' : 'Select';
      }
    });

    if (Store) {
      Store.dispatch({
        type: 'STYLE_SELECTED',
        payload: {
          styleId: styleId,
          style: targetStyle
        }
      });
    }

    // Record in recently used history
    if (Storage && typeof Storage.addRecentStyle === 'function') {
      Storage.addRecentStyle(styleId);
    }

    updateStickyBar(targetStyle);

    if (announcerEl) {
      announcerEl.textContent = 'Selected visualizer style: ' + targetStyle.name + '. Press Continue to Settings to proceed.';
    }

    if (UI && UI.showToast) {
      UI.showToast('Selected style: ' + targetStyle.name, 'success', 2200);
    }
  }

  function deselectCurrentStyle() {
    selectedStyleId = null;

    var cards = document.querySelectorAll('.studio-style-card');
    cards.forEach(function (card) {
      card.classList.remove('is-selected');
      card.setAttribute('aria-checked', 'false');
      var selectBtn = card.querySelector('.studio-card-btn-select');
      if (selectBtn) {
        selectBtn.classList.remove('is-active');
        var lbl = selectBtn.querySelector('.btn-text');
        if (lbl) lbl.textContent = 'Select';
      }
    });

    updateStickyBar(null);

    if (announcerEl) {
      announcerEl.textContent = 'Style selection cleared.';
    }
  }

  function bindCardInteractions(scope, specificCards) {
    var cards = specificCards || (scope ? scope.querySelectorAll('.studio-style-card') : []);
    cards.forEach(function (card) {
      var styleId = card.getAttribute('data-style-id');

      // Hover-Intent Preview
      card.addEventListener('mouseenter', function () {
        if (hoverIntentTimer) clearTimeout(hoverIntentTimer);
        hoverIntentTimer = setTimeout(function () {
          startPreview(card);
        }, HOVER_INTENT_MS);
      });

      card.addEventListener('mouseleave', function () {
        if (hoverIntentTimer) {
          clearTimeout(hoverIntentTimer);
          hoverIntentTimer = null;
        }
        if (activePreviewCard === card) {
          stopPreview();
        }
      });

      // Overlay Action Buttons
      var previewBtn = card.querySelector('.studio-card-btn-preview');
      if (previewBtn) {
        previewBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (activePreviewCard === card) {
            stopPreview();
          } else {
            startPreview(card);
          }
        });
      }

      var selectBtn = card.querySelector('.studio-card-btn-select');
      if (selectBtn) {
        selectBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          selectStyle(styleId);
        });
      }

      // Favorite toggle button
      var favBtn = card.querySelector('.studio-card-fav-btn');
      if (favBtn) {
        favBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (!Storage) return;
          Storage.toggleFavorite(styleId).then(function (isFav) {
            favBtn.classList.toggle('is-favorite', isFav);
            favBtn.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Add to favorites');
            loadFavorites().then(function () {
              if (favoritesFilter) renderGrid(true);
            });
            if (UI && UI.showToast) {
              UI.showToast(isFav ? 'Added to favorites' : 'Removed from favorites', 'info');
            }
          });
        });
      }

      // Card Click: First tap previews, second tap commits selection
      card.addEventListener('click', function (e) {
        if (e.target.closest('.studio-card-overlay-btn') || e.target.closest('.studio-card-fav-btn')) return;

        var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (isTouch) {
          if (!card.classList.contains('is-previewing')) {
            startPreview(card);
            return;
          }
        }
        selectStyle(styleId);
      });

      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target.closest('.studio-card-overlay-btn') || e.target.closest('.studio-card-fav-btn')) return;
          e.preventDefault();
          selectStyle(styleId);
        }
      });
    });
  }

  function surpriseMe() {
    var pool = getFilteredStyles();
    if (!pool.length) pool = allStyles;
    if (!pool.length) return;

    var randomStyle = pool[Math.floor(Math.random() * pool.length)];

    var card = stylesGridEl ? stylesGridEl.querySelector('.studio-style-card[data-style-id="' + randomStyle.id + '"]') : null;
    if (!card) {
      currentCategory = 'all';
      searchQuery = '';
      favoritesFilter = false;
      if (searchInputEl) searchInputEl.value = '';
      if (searchClearBtn) searchClearBtn.style.display = 'none';
      if (favFilterBtn) {
        favFilterBtn.setAttribute('aria-pressed', 'false');
        favFilterBtn.classList.remove('is-active');
      }
      renderCategories();
      renderGrid(true);
      card = stylesGridEl ? stylesGridEl.querySelector('.studio-style-card[data-style-id="' + randomStyle.id + '"]') : null;
    }

    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('is-surprise-highlight');
      setTimeout(function () {
        card.classList.remove('is-surprise-highlight');
      }, 1600);
    }

    selectStyle(randomStyle.id);
    if (UI && UI.showToast) {
      UI.showToast('Surprise pick: ' + randomStyle.name + '!', 'info');
    }
  }

  // Global listeners for memory cleanup & stop on scroll / blur
  if (typeof window !== 'undefined') {
    window.addEventListener('blur', stopPreview);
    window.addEventListener('scroll', stopPreview, { passive: true });
  }

  function initElements() {
    containerEl = document.getElementById('studio-styles-subview');
    if (!containerEl) return;

    audioSummaryEl = document.getElementById('studio-styles-audio-banner');
    suggestedGridEl = document.getElementById('studio-styles-suggested');
    categoryChipsEl = document.getElementById('studio-styles-categories');
    stylesGridEl = document.getElementById('studio-styles-grid');
    loadMoreContainerEl = document.getElementById('studio-styles-load-more');
    announcerEl = document.getElementById('studio-styles-announcer');
    skeletonGridEl = document.getElementById('studio-styles-skeleton');
    errorStateEl = document.getElementById('studio-styles-error');

    // Library toolbar elements
    searchInputEl = document.getElementById('studio-styles-search-input');
    searchClearBtn = document.getElementById('studio-styles-search-clear');
    surpriseMeBtn = document.getElementById('studio-btn-surprise-me');
    favFilterBtn = document.getElementById('studio-btn-favorites-filter');
    favCountBadge = document.getElementById('studio-fav-count-badge');
    clearDataBtn = document.getElementById('studio-btn-clear-my-data');
    shortcutsBtn = document.getElementById('studio-btn-shortcuts');

    stickyBarEl = document.getElementById('studio-styles-sticky-bar');
    stickyThumbEl = document.getElementById('studio-sticky-thumb');
    stickyNameEl = document.getElementById('studio-sticky-name');
    stickyCategoryEl = document.getElementById('studio-sticky-category');
    stickyChangeBtn = document.getElementById('studio-sticky-change-btn');
    stickyContinueBtn = document.getElementById('studio-sticky-continue-btn');

    // Search input binding
    if (searchInputEl) {
      searchInputEl.oninput = function () {
        searchQuery = searchInputEl.value;
        if (searchClearBtn) {
          searchClearBtn.style.display = searchQuery ? 'inline-block' : 'none';
        }
        renderGrid(true);
      };
    }

    if (searchClearBtn) {
      searchClearBtn.onclick = function () {
        searchQuery = '';
        if (searchInputEl) searchInputEl.value = '';
        searchClearBtn.style.display = 'none';
        renderGrid(true);
      };
    }

    // Surprise Me
    if (surpriseMeBtn) {
      surpriseMeBtn.onclick = surpriseMe;
    }

    // Favorites Filter
    if (favFilterBtn) {
      favFilterBtn.onclick = function () {
        favoritesFilter = !favoritesFilter;
        favFilterBtn.setAttribute('aria-pressed', favoritesFilter ? 'true' : 'false');
        favFilterBtn.classList.toggle('is-active', favoritesFilter);
        renderGrid(true);
      };
    }

    // Clear My Data
    if (clearDataBtn) {
      clearDataBtn.onclick = function () {
        if (UI && UI.confirm) {
          UI.confirm(
            'Are you sure you want to clear all stored audio, presets, and visualizer history? This cannot be undone.',
            function (confirmed) {
              if (confirmed && Storage) {
                Storage.clearAll().then(function () {
                  if (Store) Store.dispatch({ type: 'RESET_ALL' });
                  if (UI.showToast) UI.showToast('All local Studio data has been cleared.', 'info');
                  if (Router) Router.navigate('#visualizer');
                });
              }
            }
          );
        }
      };
    }

    // Keyboard Shortcuts Button
    if (shortcutsBtn) {
      shortcutsBtn.onclick = function () {
        var modal = document.getElementById('studioShortcutsModal');
        if (modal) {
          modal.style.display = 'flex';
          modal.setAttribute('aria-hidden', 'false');
        }
      };
    }

    var retryBtn = document.getElementById('studio-styles-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        fetchStyles();
      });
    }
  }

  function render() {
    initElements();
    updateAudioSummary();

    var state = Store ? Store.getState() : null;
    if (state && state.styleId) {
      selectedStyleId = state.styleId;
    }

    if (!allStyles.length) {
      fetchStyles();
    } else {
      loadFavorites().then(function () {
        updateAudioSummary();
        renderSuggested();
        renderCategories();
        renderGrid(true);
        syncSelectedStateFromStore();
      });
    }
  }

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    render: render,
    selectStyle: selectStyle,
    deselectCurrentStyle: deselectCurrentStyle,
    startPreview: startPreview,
    stopPreview: stopPreview,
    fetchStyles: fetchStyles,
    surpriseMe: surpriseMe,
    getStyles: function () { return allStyles; },
    getSelectedStyleId: function () { return selectedStyleId; }
  };
});
