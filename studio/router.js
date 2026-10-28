/**
 * SYNCLINES — Audio Visualizer Studio Sub-View Router
 * studio/router.js
 *
 * Sub-view hash router managing container switching inside #view-hero2:
 * #visualizer, #visualizer/styles, #visualizer/settings, #visualizer/render, #visualizer/result.
 * Implements route guards, accessible focus management, document titles,
 * and transition coordination.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioRouter = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var ROUTES = {
    LANDING: '#visualizer',
    STYLES: '#visualizer/styles',
    SETTINGS: '#visualizer/settings',
    RENDER: '#visualizer/render',
    RESULT: '#visualizer/result'
  };

  var TITLES = {
    '#visualizer': 'Audio Visualizer — SyncLines Studio',
    '#visualizer/styles': 'Choose Visualizer Style — SyncLines Studio',
    '#visualizer/settings': 'Render Settings — SyncLines Studio',
    '#visualizer/render': 'Rendering Video — SyncLines Studio',
    '#visualizer/result': 'Your Video is Ready — SyncLines Studio'
  };

  var SUBVIEW_IDS = {
    '#visualizer': 'studio-landing-subview',
    '#visualizer/styles': 'studio-styles-subview',
    '#visualizer/settings': 'studio-settings-subview',
    '#visualizer/render': 'studio-render-subview',
    '#visualizer/result': 'studio-result-subview'
  };

  function createRouter(store, ui) {
    var currentRoute = ROUTES.LANDING;
    var isTransitioning = false;
    var isInitialized = false;

    function getNormalizedHash() {
      if (typeof window === 'undefined') return ROUTES.LANDING;
      var hash = window.location.hash || '';
      // Strip trailing slash if present
      if (hash.length > 1 && hash.endsWith('/')) {
        hash = hash.slice(0, -1);
      }
      return hash;
    }

    /**
     * Checks route prerequisites against store state.
     * @param {string} targetRoute
     * @returns {{ allowed: boolean, redirect?: string, message?: string }}
     */
    function evaluateGuards(targetRoute) {
      var state = store.getState();

      if (targetRoute === ROUTES.STYLES) {
        if (!state.audio) {
          return {
            allowed: false,
            redirect: ROUTES.LANDING,
            message: 'Please upload an audio track first.'
          };
        }
      }

      if (targetRoute === ROUTES.SETTINGS) {
        if (!state.audio) {
          return {
            allowed: false,
            redirect: ROUTES.LANDING,
            message: 'Please upload an audio track first.'
          };
        }
        if (!state.styleId) {
          return {
            allowed: false,
            redirect: ROUTES.STYLES,
            message: 'Please select a visualizer style first.'
          };
        }
      }

      if (targetRoute === ROUTES.RENDER) {
        if (!state.audio || !state.styleId) {
          return {
            allowed: false,
            redirect: ROUTES.STYLES,
            message: 'Please complete audio and style selection first.'
          };
        }
        if (state.status !== store.STATES.CONFIGURED && state.status !== store.STATES.RENDERING) {
          return {
            allowed: false,
            redirect: ROUTES.SETTINGS,
            message: 'Please confirm render settings to proceed.'
          };
        }
      }

      if (targetRoute === ROUTES.RESULT) {
        if (!state.resultBlob && state.status !== store.STATES.DONE) {
          return {
            allowed: false,
            redirect: ROUTES.LANDING,
            message: 'No completed video found. Please start a new visualizer.'
          };
        }
      }

      return { allowed: true };
    }

    /**
     * Navigates to a sub-view route.
     * @param {string} route
     * @param {boolean} [replace=false]
     */
    function navigate(route, replace) {
      if (!ROUTES[Object.keys(ROUTES).find(function (k) { return ROUTES[k] === route; })]) {
        // Unknown route, fallback to landing
        route = ROUTES.LANDING;
      }

      var guard = evaluateGuards(route);
      if (!guard.allowed) {
        if (guard.message && ui && typeof ui.showToast === 'function') {
          ui.showToast(guard.message, 'warning');
        }
        route = guard.redirect || ROUTES.LANDING;
      }

      if (typeof window !== 'undefined' && window.location) {
        if (window.location.hash !== route) {
          try {
            if (replace) {
              window.history.replaceState({ subview: route }, '', route);
            } else {
              window.history.pushState({ subview: route }, '', route);
            }
          } catch (e) {
            window.location.hash = route;
          }
        }
      }

      applyRoute(route);
    }

    function applyRoute(route) {
      if (isTransitioning) return;
      isTransitioning = true;
      currentRoute = route;

      var targetContainerId = SUBVIEW_IDS[route] || SUBVIEW_IDS[ROUTES.LANDING];
      var targetEl = document.getElementById(targetContainerId);

      // Background scene is only needed on the landing sub-view; scene.js idles while this class is set.
      var hero2Host = document.getElementById('view-hero2');
      if (hero2Host) hero2Host.classList.toggle('studio-in-flow', route !== ROUTES.LANDING);

      // Hide all subview containers
      for (var r in SUBVIEW_IDS) {
        var id = SUBVIEW_IDS[r];
        var el = document.getElementById(id);
        if (el) {
          if (id === targetContainerId) {
            el.classList.add('is-active');
            el.setAttribute('aria-hidden', 'false');
          } else {
            el.classList.remove('is-active');
            el.setAttribute('aria-hidden', 'true');
          }
        }
      }

      // Update document title
      if (TITLES[route]) {
        document.title = TITLES[route];
      }

      // Dim and pause hero background scene when studio subviews are active
      var isSubView = (route !== ROUTES.LANDING);
      if (typeof document !== 'undefined') {
        if (isSubView) {
          document.body.classList.add('studio-subview-open');
          var hero2 = document.getElementById('view-hero2');
          if (hero2) hero2.classList.add('studio-subview-open');
          if (typeof window !== 'undefined' && window.VisualizerScene && typeof window.VisualizerScene.pause === 'function') {
            window.VisualizerScene.pause();
          }
        } else {
          document.body.classList.remove('studio-subview-open');
          var hero2 = document.getElementById('view-hero2');
          if (hero2) hero2.classList.remove('studio-subview-open');
          if (typeof window !== 'undefined' && window.VisualizerScene && typeof window.VisualizerScene.resume === 'function') {
            window.VisualizerScene.resume();
          }
        }
      }

      // Scroll reset
      try {
        window.scrollTo(0, 0);
      } catch (err) {}

      // Move focus to heading inside new subview
      if (targetEl) {
        var heading = targetEl.querySelector('h1, h2, h3, [role="heading"], .studio-subview-heading');
        if (heading) {
          if (!heading.hasAttribute('tabindex')) {
            heading.setAttribute('tabindex', '-1');
          }
          try {
            heading.focus();
          } catch (e) {}
        }
      }

      // Hook subview controllers
      if (route === ROUTES.STYLES) {
        var stylesMod = (typeof window !== 'undefined' && window.StudioStyles) || null;
        if (stylesMod && typeof stylesMod.render === 'function') {
          stylesMod.render();
        }
      } else if (route === ROUTES.SETTINGS) {
        var settingsMod = (typeof window !== 'undefined' && window.StudioSettings) || null;
        if (settingsMod && typeof settingsMod.render === 'function') {
          settingsMod.render();
        }
      } else if (route === ROUTES.RENDER) {
        var renderMod = (typeof window !== 'undefined' && window.StudioRender) || null;
        if (renderMod && typeof renderMod.renderProcessing === 'function') {
          renderMod.renderProcessing();
        }
      } else if (route === ROUTES.RESULT) {
        var renderResultMod = (typeof window !== 'undefined' && window.StudioRender) || null;
        if (renderResultMod && typeof renderResultMod.renderResult === 'function') {
          renderResultMod.renderResult();
        }
      }

      setTimeout(function () {
        isTransitioning = false;
      }, 300);
    }

    function handleHashChange() {
      var hash = getNormalizedHash();
      // Only process routes that start with #visualizer
      if (hash.startsWith('#visualizer')) {
        var guard = evaluateGuards(hash);
        if (!guard.allowed) {
          if (guard.message && ui && typeof ui.showToast === 'function') {
            ui.showToast(guard.message, 'warning');
          }
          navigate(guard.redirect || ROUTES.LANDING, true);
        } else {
          applyRoute(hash);
        }
      }
    }

    function init() {
      if (isInitialized) return;
      isInitialized = true;

      if (typeof window !== 'undefined') {
        window.addEventListener('popstate', handleHashChange);
        window.addEventListener('hashchange', handleHashChange);

        var initial = getNormalizedHash();
        if (initial.startsWith('#visualizer')) {
          var guard = evaluateGuards(initial);
          if (!guard.allowed) {
            navigate(guard.redirect || ROUTES.LANDING, true);
          } else {
            applyRoute(initial);
          }
        }
      }
    }

    function getCurrentRoute() {
      return currentRoute;
    }

    return {
      ROUTES: ROUTES,
      init: init,
      navigate: navigate,
      evaluateGuards: evaluateGuards,
      getCurrentRoute: getCurrentRoute
    };
  }

  return {
    createRouter: createRouter,
    ROUTES: ROUTES
  };
});
