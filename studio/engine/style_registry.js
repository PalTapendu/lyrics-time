/**
 * SYNCLINES — Audio Visualizer Studio Style Plugin Registry
 * studio/engine/style_registry.js
 *
 * Defines the unified Style Plugin Interface and lazy registry:
 * - Plugin contract: { id, name, category, supportedRatios, defaultParams, init, render, dispose }
 * - Lazy registration, retrieval, and validation
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioStyleRegistry = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var registry = {};

  /**
   * Validates that a plugin fulfills the required Style Plugin Interface.
   */
  function validatePlugin(plugin) {
    if (!plugin || typeof plugin !== 'object') {
      throw new Error('[StyleRegistry] Plugin must be a non-null object.');
    }
    if (!plugin.id || typeof plugin.id !== 'string') {
      throw new Error('[StyleRegistry] Plugin must have a valid string "id".');
    }
    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error('[StyleRegistry] Plugin must have a valid string "name".');
    }
    if (typeof plugin.render !== 'function') {
      throw new Error('[StyleRegistry] Plugin "' + plugin.id + '" must implement a "render(frame, t, ctx, width, height, params)" function.');
    }
  }

  function register(plugin) {
    validatePlugin(plugin);
    registry[plugin.id] = {
      id: plugin.id,
      name: plugin.name,
      category: plugin.category || 'classic-bars',
      supportedRatios: plugin.supportedRatios || ['16:9', '9:16', '1:1', '4:5'],
      defaultParams: plugin.defaultParams || {},
      init: plugin.init || function () {},
      render: plugin.render,
      dispose: plugin.dispose || function () {}
    };
  }

  function get(id) {
    return registry[id] || null;
  }

  function has(id) {
    return Object.prototype.hasOwnProperty.call(registry, id);
  }

  function getAll() {
    var list = [];
    for (var k in registry) {
      if (Object.prototype.hasOwnProperty.call(registry, k)) {
        list.push(registry[k]);
      }
    }
    return list;
  }

  function unregister(id) {
    if (registry[id]) {
      if (typeof registry[id].dispose === 'function') {
        try { registry[id].dispose(); } catch (e) {}
      }
      delete registry[id];
    }
  }

  function clear() {
    for (var k in registry) {
      unregister(k);
    }
    registry = {};
  }

  return {
    register: register,
    get: get,
    has: has,
    getAll: getAll,
    unregister: unregister,
    clear: clear
  };
});
