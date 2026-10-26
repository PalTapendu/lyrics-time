/**
 * SYNCLINES — Audio Visualizer Studio Configuration & Feature Flags
 * studio/config.js
 *
 * Feature Flag Strategy (Risk R1):
 * - enabled: Controls whether Audio Visualizer Studio is live to public users.
 *   Default: false (live site displays legacy "Coming Soon" modal).
 * - demoMode: Controls whether rendering/export operates in demo simulation mode.
 *   Default: true (honestly labeled demo mode until real export engine is ready in Prompt 9).
 * - Dev Preview Switch: URL query parameter `?studio=preview` or `sessionStorage['synclines-studio-preview']`.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var config = factory();
    root.StudioConfig = config;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var StudioConfig = {
    // Master switch: Live site stays on Coming Soon modal until officially launched.
    // Set to true to make Audio Visualizer Studio live to 100% of public visitors.
    enabled: true,

    // Real Engine vs Demo Simulator:
    // true = Demo simulation mode (honestly labeled preview).
    // false = Real WebCodecs AVC/H.264 MP4 export engine with MediaRecorder fallback.
    // Overridable per session via ?engine=real or ?engine=demo.
    demoMode: true,

    // Storage key for dev preview session flag
    SESSION_PREVIEW_KEY: 'synclines-studio-preview',

    /**
     * Determines whether Studio should be active in the current session.
     * Evaluates in priority order:
     * 1. Query parameter ?studio=preview (forces on and saves to sessionStorage)
     * 2. Query parameter ?studio=off (clears sessionStorage and forces off)
     * 3. SessionStorage persistence ('true' => active)
     * 4. Base config flag (StudioConfig.enabled)
     *
     * @returns {boolean} True if Studio should open instead of Coming Soon modal
     */
    isStudioActive: function () {
      try {
        if (typeof window !== 'undefined' && window.location) {
          var params = new URLSearchParams(window.location.search);
          var override = params.get('studio');

          if (override === 'preview') {
            try {
              sessionStorage.setItem(this.SESSION_PREVIEW_KEY, 'true');
            } catch (e) {
              /* private mode or quota exception */
            }
            return true;
          }

          if (override === 'off') {
            try {
              sessionStorage.removeItem(this.SESSION_PREVIEW_KEY);
            } catch (e) {
              /* private mode or quota exception */
            }
            return false;
          }

          try {
            if (sessionStorage.getItem(this.SESSION_PREVIEW_KEY) === 'true') {
              return true;
            }
          } catch (e) {
            /* private mode fallback */
          }
        }
      } catch (err) {
        // Fallback safely to base configuration
      }

      return Boolean(this.enabled);
    },

    /**
     * Determines whether demo simulation mode should be active.
     * Query parameter overrides:
     * - ?engine=demo forces demo mode
     * - ?engine=real forces real hardware WebCodecs mode
     */
    isDemoMode: function () {
      try {
        if (typeof window !== 'undefined' && window.location && window.location.search) {
          var params = new URLSearchParams(window.location.search);
          var engine = params.get('engine');
          if (engine === 'demo') return true;
          if (engine === 'real') return false;
        }
      } catch (e) {}
      return Boolean(this.demoMode);
    },

    /**
     * Convenience method to flip production release flag.
     */
    setProductionLive: function (isLive) {
      this.enabled = Boolean(isLive);
    }
  };

  return StudioConfig;
});
