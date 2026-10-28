/**
 * SYNCLINES — Audio Visualizer Studio State Machine Store
 * studio/store.js
 *
 * Strict unidirectional Finite State Machine (FSM) with validated transitions,
 * reactive subscriptions, and sanitized diagnostic event logging.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioStore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // Allowed States
  var STATES = {
    IDLE: 'idle',
    AUDIO_READY: 'audioReady',
    STYLE_SELECTED: 'styleSelected',
    CONFIGURED: 'configured',
    RENDERING: 'rendering',
    DONE: 'done',
    ERROR: 'error',
    CANCELLED: 'cancelled'
  };

  // Valid State Transitions: [CurrentState] -> [Action] -> TargetState
  var TRANSITIONS = {
    idle: {
      AUDIO_LOADED: 'audioReady'
    },
    audioReady: {
      STYLE_SELECTED: 'styleSelected',
      AUDIO_REPLACED: 'audioReady',
      AUDIO_CLEARED: 'idle',
      RESET_ALL: 'idle'
    },
    styleSelected: {
      SETTINGS_CONFIRMED: 'configured',
      STYLE_SELECTED: 'styleSelected', // Switch selected style
      STYLE_CLEARED: 'audioReady',
      AUDIO_REPLACED: 'audioReady',
      AUDIO_CLEARED: 'idle',
      RESET_ALL: 'idle'
    },
    configured: {
      RENDER_STARTED: 'rendering',
      SETTINGS_UPDATED: 'configured',
      RETURN_TO_STYLES: 'styleSelected',
      AUDIO_REPLACED: 'audioReady',
      AUDIO_CLEARED: 'idle',
      RESET_ALL: 'idle'
    },
    rendering: {
      RENDER_PROGRESS: 'rendering',
      RENDER_COMPLETED: 'done',
      RENDER_FAILED: 'error',
      RENDER_CANCELLED: 'cancelled'
    },
    done: {
      TRY_ANOTHER_STYLE: 'audioReady',
      RETURN_TO_SETTINGS: 'configured',
      RESET_ALL: 'idle'
    },
    error: {
      RETRY_RENDER: 'configured',
      RETURN_TO_SETTINGS: 'configured',
      RESET_ALL: 'idle'
    },
    cancelled: {
      RETURN_TO_SETTINGS: 'configured',
      RESET_ALL: 'idle'
    }
  };

  var MAX_LOG_ENTRIES = 50;

  function createStore(initialAudio) {
    var state = {
      status: STATES.IDLE,
      audio: null, // { name, size, type, duration, sampleRate, channels, blob, waveform }
      styleId: null, // string ID of chosen visualizer style
      style: null,   // full style object (name, category, thumbnail) used by Settings/Result screens
      settings: {
        aspectRatio: '16:9', // '16:9' | '9:16' | '1:1' | '4:5'
        resolution: '1080p', // '1080p' | '720p'
        trimStart: 0,        // seconds
        trimEnd: 0,          // seconds
        fps: 30
      },
      renderJob: null, // { stage, progress, elapsedMs, etaMs, cancelFn }
      resultBlob: null, // Generated video Blob or demo preview identifier
      error: null      // { code, message, recoverable }
    };

    var listeners = [];
    var eventLog = [];

    if (initialAudio) {
      state.audio = initialAudio;
      state.status = STATES.AUDIO_READY;
      if (initialAudio.duration) {
        state.settings.trimEnd = initialAudio.duration;
      }
    }

    function recordEvent(actionType, prevStatus, nextStatus, details) {
      var entry = {
        timestamp: Date.now(),
        action: actionType,
        from: prevStatus,
        to: nextStatus,
        summary: details || null
      };
      eventLog.push(entry);
      if (eventLog.length > MAX_LOG_ENTRIES) {
        eventLog.shift();
      }
    }

    function getState() {
      return state;
    }

    function subscribe(listener) {
      if (typeof listener !== 'function') return function () {};
      listeners.push(listener);
      return function unsubscribe() {
        var idx = listeners.indexOf(listener);
        if (idx !== -1) {
          listeners.splice(idx, 1);
        }
      };
    }

    function notify(actionType) {
      for (var i = 0; i < listeners.length; i++) {
        try {
          listeners[i](state, actionType);
        } catch (err) {
          console.error('[StudioStore] Listener error on action ' + actionType, err);
        }
      }
    }

    function dispatch(action) {
      if (!action || typeof action.type !== 'string') {
        throw new Error('[StudioStore] Action must have a valid string type.');
      }

      var currentStatus = state.status;
      var actionType = action.type;
      var allowedNext = TRANSITIONS[currentStatus] && TRANSITIONS[currentStatus][actionType];

      if (!allowedNext) {
        var warningMsg = '[StudioStore] Invalid transition: cannot execute "' + actionType +
          '" from state "' + currentStatus + '".';
        console.warn(warningMsg);
        recordEvent(actionType, currentStatus, currentStatus, { rejected: true, reason: 'Invalid transition' });
        return false;
      }

      var prevStatus = currentStatus;
      var payload = action.payload || {};

      switch (actionType) {
        case 'AUDIO_LOADED':
        case 'AUDIO_REPLACED':
          state.audio = payload.audio || null;
          state.styleId = null;
          state.style = null;
          state.resultBlob = null;
          state.error = null;
          if (state.audio && state.audio.duration) {
            state.settings.trimStart = 0;
            state.settings.trimEnd = state.audio.duration;
          }
          break;

        case 'AUDIO_CLEARED':
          state.audio = null;
          state.styleId = null;
          state.style = null;
          state.resultBlob = null;
          state.renderJob = null;
          state.error = null;
          break;

        case 'STYLE_SELECTED':
          state.styleId = payload.styleId || null;
          state.style = payload.style || null;
          break;

        case 'STYLE_CLEARED':
          state.styleId = null;
          state.style = null;
          break;

        case 'SETTINGS_UPDATED':
        case 'SETTINGS_CONFIRMED':
          if (payload.settings) {
            var _skeys = Object.keys(payload.settings);
            for (var _ski = 0; _ski < _skeys.length; _ski++) {
              if (Object.prototype.hasOwnProperty.call(payload.settings, _skeys[_ski])) {
                state.settings[_skeys[_ski]] = payload.settings[_skeys[_ski]];
              }
            }
          }
          break;

        case 'RENDER_STARTED':
          state.renderJob = {
            stage: payload.stage || 'Initializing',
            progress: 0,
            elapsedMs: 0,
            etaMs: null,
            cancelFn: payload.cancelFn || null
          };
          state.resultBlob = null;
          state.error = null;
          break;

        case 'RENDER_PROGRESS':
          if (state.renderJob) {
            if (payload.stage !== undefined) state.renderJob.stage = payload.stage;
            if (payload.progress !== undefined) state.renderJob.progress = Math.min(100, Math.max(0, payload.progress));
            if (payload.elapsedMs !== undefined) state.renderJob.elapsedMs = payload.elapsedMs;
            if (payload.etaMs !== undefined) state.renderJob.etaMs = payload.etaMs;
          }
          break;

        case 'RENDER_COMPLETED':
          state.resultBlob = payload.resultBlob || null;
          state.renderJob = null;
          state.error = null;
          break;

        case 'RENDER_FAILED':
          state.error = {
            code: payload.code || 'RENDER_ERROR',
            message: payload.message || 'An error occurred during video rendering.',
            recoverable: payload.recoverable !== false
          };
          state.renderJob = null;
          break;

        case 'RENDER_CANCELLED':
          state.renderJob = null;
          break;

        case 'TRY_ANOTHER_STYLE':
          state.styleId = null;
          state.style = null;
          state.resultBlob = null;
          state.error = null;
          break;

        case 'RESET_ALL':
          state.audio = null;
          state.styleId = null;
          state.style = null;
          state.resultBlob = null;
          state.renderJob = null;
          state.error = null;
          state.settings = {
            aspectRatio: '16:9',
            resolution: '1080p',
            trimStart: 0,
            trimEnd: 0,
            fps: 30
          };
          break;

        default:
          break;
      }

      state.status = allowedNext;
      recordEvent(actionType, prevStatus, allowedNext, {
        audioDuration: state.audio ? state.audio.duration : null,
        styleId: state.styleId
      });

      notify(actionType);
      return true;
    }

    function getDiagnostics() {
      var nav = typeof navigator !== 'undefined' ? navigator : {};
      return {
        timestamp: new Date().toISOString(),
        status: state.status,
        hasAudio: Boolean(state.audio),
        audioMeta: state.audio ? {
          duration: state.audio.duration,
          sampleRate: state.audio.sampleRate,
          channels: state.audio.channels,
          sizeBytes: state.audio.size
        } : null,
        styleId: state.styleId,
        settings: state.settings,
        hasResultBlob: Boolean(state.resultBlob),
        lastError: state.error,
        eventCount: eventLog.length,
        recentEvents: eventLog.slice(-15),
        environment: {
          userAgent: nav.userAgent || 'unknown',
          hardwareConcurrency: nav.hardwareConcurrency || null,
          deviceMemory: nav.deviceMemory || null,
          language: nav.language || 'en'
        }
      };
    }

    return {
      STATES: STATES,
      getState: getState,
      subscribe: subscribe,
      dispatch: dispatch,
      getDiagnostics: getDiagnostics
    };
  }

  // Export default singleton instance factory
  var defaultStore = createStore();
  defaultStore.createStore = createStore;
  defaultStore.STATES = STATES;

  return defaultStore;
});
