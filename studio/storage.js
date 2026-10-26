/**
 * SYNCLINES — Audio Visualizer Studio Persistence Layer
 * studio/storage.js
 *
 * Robust IndexedDB storage wrapper with automatic 24-hour TTL expiration,
 * quota error handling, visible "Clear my data" support, and graceful
 * in-memory fallback for private browsing modes.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioStorage = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var DB_NAME = 'synclines_studio_db';
  var DB_VERSION = 1;
  var STORE_SESSIONS = 'audio_sessions';
  var STORE_PREFS = 'studio_prefs';
  var SESSION_KEY = 'active_session';
  var PREFS_KEY = 'user_preferences';
  var TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours in milliseconds

  var isMemoryMode = false;
  var memoryStorage = new Map();
  var dbPromise = null;

  function isIndexedDBAvailable() {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function getDB() {
    if (!isIndexedDBAvailable()) {
      isMemoryMode = true;
      return Promise.reject(new Error('IndexedDB not supported or accessible'));
    }

    if (dbPromise) return dbPromise;

    dbPromise = new Promise(function (resolve, reject) {
      try {
        var req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = function (event) {
          var db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
            db.createObjectStore(STORE_SESSIONS);
          }
          if (!db.objectStoreNames.contains(STORE_PREFS)) {
            db.createObjectStore(STORE_PREFS);
          }
        };

        req.onsuccess = function (event) {
          resolve(event.target.result);
        };

        req.onerror = function (event) {
          isMemoryMode = true;
          console.warn('[StudioStorage] IndexedDB open error, falling back to memory storage:', req.error);
          reject(req.error);
        };
      } catch (err) {
        isMemoryMode = true;
        reject(err);
      }
    });

    return dbPromise;
  }

  /**
   * Saves audio blob, metadata and waveform to IndexedDB or memory.
   * @param {Object} audioData - { blob, name, size, type, duration, sampleRate, channels, waveform }
   * @returns {Promise<boolean>}
   */
  function saveAudioSession(audioData) {
    if (!audioData) return Promise.resolve(false);

    var record = {
      blob: audioData.blob || null,
      meta: {
        name: audioData.name || 'audio-track',
        size: audioData.size || 0,
        type: audioData.type || 'audio/unknown',
        duration: audioData.duration || 0,
        sampleRate: audioData.sampleRate || 44100,
        channels: audioData.channels || 2
      },
      waveform: audioData.waveform || [],
      timestamp: Date.now(),
      ttl: TTL_MS
    };

    return getDB()
      .then(function (db) {
        return new Promise(function (resolve, reject) {
          try {
            var tx = db.transaction([STORE_SESSIONS], 'readwrite');
            var store = tx.objectStore(STORE_SESSIONS);
            var req = store.put(record, SESSION_KEY);

            req.onsuccess = function () {
              resolve(true);
            };

            req.onerror = function () {
              // Check QuotaExceededError
              if (req.error && req.error.name === 'QuotaExceededError') {
                console.warn('[StudioStorage] QuotaExceededError in IndexedDB, saving to memory instead.');
                isMemoryMode = true;
                memoryStorage.set(SESSION_KEY, record);
                resolve(true);
              } else {
                reject(req.error);
              }
            };
          } catch (e) {
            isMemoryMode = true;
            memoryStorage.set(SESSION_KEY, record);
            resolve(true);
          }
        });
      })
      .catch(function () {
        // Fallback to memory
        isMemoryMode = true;
        memoryStorage.set(SESSION_KEY, record);
        return true;
      });
  }

  /**
   * Retrieves active audio session if valid and within 24h TTL.
   * Automatically purges if expired.
   * @returns {Promise<Object|null>}
   */
  function getAudioSession() {
    if (isMemoryMode) {
      var item = memoryStorage.get(SESSION_KEY);
      if (!item) return Promise.resolve(null);
      if (Date.now() - item.timestamp > item.ttl) {
        memoryStorage.delete(SESSION_KEY);
        return Promise.resolve(null);
      }
      return Promise.resolve(item);
    }

    return getDB()
      .then(function (db) {
        return new Promise(function (resolve, reject) {
          try {
            var tx = db.transaction([STORE_SESSIONS], 'readwrite');
            var store = tx.objectStore(STORE_SESSIONS);
            var req = store.get(SESSION_KEY);

            req.onsuccess = function () {
              var record = req.result;
              if (!record) {
                resolve(null);
                return;
              }

              // Check TTL expiration
              var elapsed = Date.now() - (record.timestamp || 0);
              var maxTtl = record.ttl || TTL_MS;

              if (elapsed > maxTtl) {
                // Purge expired record
                store.delete(SESSION_KEY);
                console.info('[StudioStorage] Audio session expired (TTL > 24h) and was purged.');
                resolve(null);
                return;
              }

              resolve(record);
            };

            req.onerror = function () {
              reject(req.error);
            };
          } catch (e) {
            reject(e);
          }
        });
      })
      .catch(function () {
        var mem = memoryStorage.get(SESSION_KEY);
        if (mem && (Date.now() - mem.timestamp <= mem.ttl)) {
          return mem;
        }
        return null;
      });
  }

  /**
   * Removes current audio session from storage.
   * @returns {Promise<boolean>}
   */
  function clearAudioSession() {
    memoryStorage.delete(SESSION_KEY);

    if (isMemoryMode) return Promise.resolve(true);

    return getDB()
      .then(function (db) {
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction([STORE_SESSIONS], 'readwrite');
            tx.objectStore(STORE_SESSIONS).delete(SESSION_KEY);
            tx.oncomplete = function () { resolve(true); };
            tx.onerror = function () { resolve(false); };
          } catch (e) {
            resolve(false);
          }
        });
      })
      .catch(function () {
        return true;
      });
  }

  /**
   * Wipes all studio IndexedDB stores and memory caches completely.
   * Actionable for user "Clear my data" button.
   * @returns {Promise<boolean>}
   */
  function clearAll() {
    memoryStorage.clear();

    if (isMemoryMode) return Promise.resolve(true);

    return getDB()
      .then(function (db) {
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction([STORE_SESSIONS, STORE_PREFS], 'readwrite');
            tx.objectStore(STORE_SESSIONS).clear();
            tx.objectStore(STORE_PREFS).clear();
            tx.oncomplete = function () {
              console.info('[StudioStorage] All Studio IndexedDB data cleared successfully.');
              resolve(true);
            };
            tx.onerror = function () {
              resolve(false);
            };
          } catch (e) {
            resolve(false);
          }
        });
      })
      .catch(function () {
        return true;
      });
  }

  /**
   * Saves user preference configuration.
   * @param {Object} prefs
   */
  function savePrefs(prefs) {
    if (!prefs) return Promise.resolve(false);
    memoryStorage.set(PREFS_KEY, prefs);

    if (isMemoryMode) return Promise.resolve(true);

    return getDB()
      .then(function (db) {
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction([STORE_PREFS], 'readwrite');
            tx.objectStore(STORE_PREFS).put(prefs, PREFS_KEY);
            tx.oncomplete = function () { resolve(true); };
            tx.onerror = function () { resolve(false); };
          } catch (e) {
            resolve(false);
          }
        });
      })
      .catch(function () {
        return false;
      });
  }

  /**
   * Retrieves user preferences.
   * @returns {Promise<Object>}
   */
  function getPrefs() {
    if (isMemoryMode) {
      return Promise.resolve(memoryStorage.get(PREFS_KEY) || {});
    }

    return getDB()
      .then(function (db) {
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction([STORE_PREFS], 'readonly');
            var req = tx.objectStore(STORE_PREFS).get(PREFS_KEY);
            req.onsuccess = function () {
              resolve(req.result || {});
            };
            req.onerror = function () {
              resolve({});
            };
          } catch (e) {
            resolve({});
          }
        });
      })
      .catch(function () {
        return memoryStorage.get(PREFS_KEY) || {};
      });
  }

  /**
   * Presets Management
   */
  function getPresets() {
    return getPrefs().then(function (prefs) {
      return (prefs && Array.isArray(prefs.presets)) ? prefs.presets : [];
    });
  }

  function savePreset(preset) {
    if (!preset || !preset.name) {
      return Promise.reject(new Error('Preset must have a valid name'));
    }
    return getPrefs().then(function (prefs) {
      prefs = prefs || {};
      var presets = Array.isArray(prefs.presets) ? prefs.presets : [];
      var record = {
        id: preset.id || ('preset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
        name: String(preset.name).trim().slice(0, 40),
        styleId: preset.styleId || 'classic-bars',
        params: preset.params || {},
        updatedAt: Date.now()
      };

      // Replace if existing ID, otherwise append (cap at 30 presets)
      var existingIdx = presets.findIndex(function (p) { return p.id === record.id; });
      if (existingIdx !== -1) {
        presets[existingIdx] = record;
      } else {
        if (presets.length >= 30) presets.shift();
        presets.push(record);
      }
      prefs.presets = presets;
      return savePrefs(prefs).then(function () { return record; });
    });
  }

  function deletePreset(presetId) {
    if (!presetId) return Promise.resolve(false);
    return getPrefs().then(function (prefs) {
      prefs = prefs || {};
      var presets = Array.isArray(prefs.presets) ? prefs.presets : [];
      var filtered = presets.filter(function (p) { return p.id !== presetId; });
      if (filtered.length !== presets.length) {
        prefs.presets = filtered;
        return savePrefs(prefs).then(function () { return true; });
      }
      return false;
    });
  }

  /**
   * Favorites Management
   */
  function getFavorites() {
    return getPrefs().then(function (prefs) {
      return (prefs && Array.isArray(prefs.favorites)) ? prefs.favorites : [];
    });
  }

  function toggleFavorite(styleId) {
    if (!styleId) return Promise.resolve(false);
    return getPrefs().then(function (prefs) {
      prefs = prefs || {};
      var favs = Array.isArray(prefs.favorites) ? prefs.favorites.slice() : [];
      var idx = favs.indexOf(styleId);
      var isFav = false;
      if (idx !== -1) {
        favs.splice(idx, 1);
        isFav = false;
      } else {
        favs.push(styleId);
        isFav = true;
      }
      prefs.favorites = favs;
      return savePrefs(prefs).then(function () { return isFav; });
    });
  }

  function isFavorite(styleId) {
    return getFavorites().then(function (favs) {
      return favs.indexOf(styleId) !== -1;
    });
  }

  /**
   * Recent Styles Management
   */
  function getRecentStyles() {
    return getPrefs().then(function (prefs) {
      return (prefs && Array.isArray(prefs.recentStyles)) ? prefs.recentStyles : [];
    });
  }

  function addRecentStyle(styleId) {
    if (!styleId) return Promise.resolve(false);
    return getPrefs().then(function (prefs) {
      prefs = prefs || {};
      var recents = Array.isArray(prefs.recentStyles) ? prefs.recentStyles.slice() : [];
      var idx = recents.indexOf(styleId);
      if (idx !== -1) recents.splice(idx, 1);
      recents.unshift(styleId);
      if (recents.length > 8) recents.pop();
      prefs.recentStyles = recents;
      return savePrefs(prefs).then(function () { return recents; });
    });
  }

  function isMemoryOnly() {
    return isMemoryMode;
  }

  return {
    saveAudioSession: saveAudioSession,
    getAudioSession: getAudioSession,
    clearAudioSession: clearAudioSession,
    clearAll: clearAll,
    savePrefs: savePrefs,
    getPrefs: getPrefs,
    getPresets: getPresets,
    savePreset: savePreset,
    deletePreset: deletePreset,
    getFavorites: getFavorites,
    toggleFavorite: toggleFavorite,
    isFavorite: isFavorite,
    getRecentStyles: getRecentStyles,
    addRecentStyle: addRecentStyle,
    isMemoryOnly: isMemoryOnly
  };
});
