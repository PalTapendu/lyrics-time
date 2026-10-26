/**
 * SYNCLINES — Audio Visualizer Studio Core Coordinator
 * studio/studio.js
 *
 * Coordinates Store, Storage, Router, UI utilities, and Global Error Boundary.
 * Lazy-loaded on demand when Studio is invoked.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Studio = factory(
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
  RouterFactory
) {
  'use strict';

  // Fallbacks in case scripts executed out-of-order or attached late to window
  Config = Config || (typeof window !== 'undefined' ? window.StudioConfig : null);
  Store = Store || (typeof window !== 'undefined' ? window.StudioStore : null);
  Storage = Storage || (typeof window !== 'undefined' ? window.StudioStorage : null);
  UI = UI || (typeof window !== 'undefined' ? window.StudioUI : null);
  RouterFactory = RouterFactory || (typeof window !== 'undefined' ? window.StudioRouter : null);

  var isInitialized = false;
  var router = null;
  var isStudioActive = false;

  function initErrorBoundary() {
    function handleError(event) {
      if (!isStudioActive) return;
      var err = (event && event.error) || (event && event.reason) || new Error('Unknown Studio runtime error');
      console.error('[Studio ErrorBoundary Caught]:', err);

      try {
        if (Store && typeof Store.dispatch === 'function') {
          Store.dispatch({
            type: 'RENDER_FAILED',
            payload: {
              code: 'UNHANDLED_EXCEPTION',
              message: 'An unexpected application error occurred.',
              recoverable: true
            }
          });
        }

        renderErrorFallback(err.message || 'An unexpected issue occurred while running the Studio.');
      } catch (boundaryErr) {
        console.error('[Studio ErrorBoundary Fallback Failure]:', boundaryErr);
      }
    }

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);
  }

  function renderErrorFallback(message) {
    var activeSubview = document.querySelector('.studio-subview.is-active') ||
      document.getElementById('studio-landing-subview');

    if (!activeSubview) return;

    var errorCard = document.createElement('div');
    errorCard.className = 'studio-error-boundary-card';
    errorCard.setAttribute('role', 'alert');
    errorCard.innerHTML =
      '<div class="studio-error-icon" aria-hidden="true">⚠️</div>' +
      '<h2 class="studio-error-title">Something went wrong</h2>' +
      '<p class="studio-error-msg">' + escapeHTML(message) + '</p>' +
      '<div class="studio-error-actions">' +
      '<button type="button" class="studio-btn studio-btn-secondary" id="studio-btn-copy-diag">Copy Diagnostics</button>' +
      '<button type="button" class="studio-btn studio-btn-primary" id="studio-btn-recover">Return to Start</button>' +
      '</div>';

    activeSubview.innerHTML = '';
    activeSubview.appendChild(errorCard);

    var copyBtn = errorCard.querySelector('#studio-btn-copy-diag');
    var recoverBtn = errorCard.querySelector('#studio-btn-recover');

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var diag = Store && Store.getDiagnostics ? Store.getDiagnostics() : { error: message };
        try {
          navigator.clipboard.writeText(JSON.stringify(diag, null, 2)).then(function () {
            if (UI && UI.showToast) UI.showToast('Diagnostics copied to clipboard.', 'success');
          });
        } catch (e) {
          if (UI && UI.showToast) UI.showToast('Could not copy diagnostics automatically.', 'warning');
        }
      });
    }

    if (recoverBtn) {
      recoverBtn.addEventListener('click', function () {
        if (Store) Store.dispatch({ type: 'RESET_ALL' });
        if (router) router.navigate(router.ROUTES.LANDING, true);
        window.location.reload();
      });
    }
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function init() {
    if (isInitialized) return Promise.resolve(true);
    isInitialized = true;
    isStudioActive = true;

    initErrorBoundary();

    if (RouterFactory && RouterFactory.createRouter) {
      router = RouterFactory.createRouter(Store, UI);
      router.init();
    }

    // Attempt to restore existing unexpired audio session
    var storage = Storage || (typeof window !== 'undefined' ? window.StudioStorage : null);
    if (!storage || typeof storage.getAudioSession !== 'function') {
      console.warn('[Studio] Storage not available, proceeding without restored session');
      return Promise.resolve(true);
    }

    return storage.getAudioSession()
      .then(function (session) {
        if (session && session.blob && session.meta && Store && typeof Store.dispatch === 'function') {
          Store.dispatch({
            type: 'AUDIO_LOADED',
            payload: {
              audio: {
                name: session.meta.name,
                size: session.meta.size,
                type: session.meta.type,
                duration: session.meta.duration,
                sampleRate: session.meta.sampleRate,
                channels: session.meta.channels,
                blob: session.blob,
                waveform: session.waveform || []
              }
            }
          });

          if (UI && UI.showToast) {
            UI.showToast('Restored previous audio track: ' + session.meta.name, 'info', 2800);
          }
        }
        return true;
      })
      .catch(function (err) {
        console.warn('[Studio] Could not restore audio session:', err);
        return false;
      });
  }

  function open() {
    return init().then(function () {
      var store = Store || (typeof window !== 'undefined' ? window.StudioStore : null);
      var state = (store && typeof store.getState === 'function') ? store.getState() : {};
      if (state && state.audio) {
        if (router && typeof router.navigate === 'function') {
          router.navigate(router.ROUTES.STYLES);
        } else if (window.StudioRouter && typeof window.StudioRouter.navigate === 'function') {
          window.StudioRouter.navigate('#visualizer/styles');
        }
      } else {
        // Open upload modal
        var uploadModal = window.StudioUploadModal;
        if (uploadModal && typeof uploadModal.open === 'function') {
          uploadModal.open();
        } else if (UI && UI.showToast) {
          UI.showToast('Audio Visualizer Studio initialized. Ready for audio upload.', 'info');
        }
      }
    });
  }

  function close() {
    if (router) {
      router.navigate(router.ROUTES.LANDING);
    }
  }

  function clearUserData() {
    if (!UI || !UI.confirm) {
      return executeClear();
    }

    return UI.confirm({
      title: 'Clear Local Audio Data?',
      message: 'This will remove your cached audio tracks and preferences from this device. Your original files will remain untouched.',
      confirmText: 'Clear My Data',
      cancelText: 'Keep Data',
      danger: true
    }).then(function (confirmed) {
      if (confirmed) {
        return executeClear();
      }
      return false;
    });

    function executeClear() {
      var storage = Storage || (typeof window !== 'undefined' ? window.StudioStorage : null);
      var clearPromise = (storage && typeof storage.clearAll === 'function') ? storage.clearAll() : Promise.resolve(true);
      return clearPromise.then(function () {
        var store = Store || (typeof window !== 'undefined' ? window.StudioStore : null);
        if (store && typeof store.dispatch === 'function') store.dispatch({ type: 'RESET_ALL' });
        if (router) router.navigate(router.ROUTES.LANDING, true);
        if (UI && UI.showToast) {
          UI.showToast('All local studio data has been completely cleared.', 'success');
        }
        return true;
      });
    }
  }

  return {
    init: init,
    open: open,
    close: close,
    clearUserData: clearUserData,
    getStore: function () { return Store; },
    getStorage: function () { return Storage; },
    getRouter: function () { return router; },
    getUI: function () { return UI; }
  };
});
