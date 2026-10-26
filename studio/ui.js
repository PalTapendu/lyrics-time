/**
 * SYNCLINES — Audio Visualizer Studio UI Utilities
 * studio/ui.js
 *
 * Accessible Toast notifications and accessible Modal Confirm Dialogs
 * with focus trapping, ESC key support, ARIA semantics, and focus restoration.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudioUI = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var toastContainer = null;
  var confirmContainer = null;

  function ensureToastContainer() {
    if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
    toastContainer = document.getElementById('studio-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'studio-toast-container';
      toastContainer.className = 'studio-toast-container';
      toastContainer.setAttribute('aria-live', 'polite');
      toastContainer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  /**
   * Displays an accessible toast notification.
   * @param {string} message - Text to announce
   * @param {'info'|'success'|'warning'|'error'} [type='info'] - Visual type
   * @param {number} [duration=3400] - Duration in ms before auto-dismiss
   */
  function showToast(message, type, duration) {
    if (!message) return;
    var container = ensureToastContainer();
    type = type || 'info';
    duration = typeof duration === 'number' ? duration : 3400;

    var toast = document.createElement('div');
    toast.className = 'studio-toast studio-toast-' + type;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    var iconMap = {
      info: '✦',
      success: '✓',
      warning: '⚠',
      error: '✕'
    };

    var icon = document.createElement('span');
    icon.className = 'studio-toast-icon';
    icon.textContent = iconMap[type] || '✦';
    icon.setAttribute('aria-hidden', 'true');

    var text = document.createElement('span');
    text.className = 'studio-toast-text';
    text.textContent = message;

    var closeBtn = document.createElement('button');
    closeBtn.className = 'studio-toast-close';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.textContent = '✕';

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    // Force reflow for entrance animation
    void toast.offsetWidth;
    toast.classList.add('is-visible');

    var dismissTimer = null;

    function removeToast() {
      if (dismissTimer) clearTimeout(dismissTimer);
      toast.classList.remove('is-visible');
      setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }

    closeBtn.addEventListener('click', removeToast);
    toast.addEventListener('click', function (e) {
      if (e.target !== closeBtn) removeToast();
    });

    if (duration > 0) {
      dismissTimer = setTimeout(removeToast, duration);
    }

    return removeToast;
  }

  /**
   * Opens an accessible confirm dialog modal.
   * Traps focus, handles ESC, and restores focus on close.
   * @param {Object} options - { title, message, confirmText, cancelText, danger }
   * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled
   */
  function confirm(options) {
    options = options || {};
    var title = options.title || 'Confirm Action';
    var message = options.message || 'Are you sure you want to proceed?';
    var confirmText = options.confirmText || 'Confirm';
    var cancelText = options.cancelText || 'Cancel';
    var isDanger = Boolean(options.danger);

    var prevActiveElement = document.activeElement;

    return new Promise(function (resolve) {
      var backdrop = document.createElement('div');
      backdrop.className = 'studio-modal-backdrop is-open';
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');
      backdrop.setAttribute('aria-labelledby', 'studio-confirm-title');
      backdrop.setAttribute('aria-describedby', 'studio-confirm-desc');

      var card = document.createElement('div');
      card.className = 'studio-modal-card studio-confirm-card';

      card.innerHTML =
        '<div class="studio-confirm-header">' +
          '<h3 id="studio-confirm-title" class="studio-confirm-title">' + escapeHTML(title) + '</h3>' +
        '</div>' +
        '<div class="studio-confirm-body">' +
          '<p id="studio-confirm-desc" class="studio-confirm-message">' + escapeHTML(message) + '</p>' +
        '</div>' +
        '<div class="studio-confirm-actions">' +
          '<button type="button" class="studio-btn studio-btn-secondary" id="studio-confirm-cancel">' + escapeHTML(cancelText) + '</button>' +
          '<button type="button" class="studio-btn ' + (isDanger ? 'studio-btn-danger' : 'studio-btn-primary') + '" id="studio-confirm-ok">' + escapeHTML(confirmText) + '</button>' +
        '</div>';

      backdrop.appendChild(card);
      document.body.appendChild(backdrop);

      var cancelBtn = card.querySelector('#studio-confirm-cancel');
      var okBtn = card.querySelector('#studio-confirm-ok');

      function cleanup(result) {
        document.removeEventListener('keydown', handleKeyDown);
        backdrop.classList.remove('is-open');
        setTimeout(function () {
          if (backdrop.parentNode) {
            backdrop.parentNode.removeChild(backdrop);
          }
          if (prevActiveElement && typeof prevActiveElement.focus === 'function') {
            try { prevActiveElement.focus(); } catch (e) {}
          }
          resolve(result);
        }, 220);
      }

      function handleKeyDown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          cleanup(false);
          return;
        }

        if (e.key === 'Tab') {
          // Focus trap between Cancel and OK buttons
          var focusable = [cancelBtn, okBtn];
          var first = focusable[0];
          var last = focusable[focusable.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      cancelBtn.addEventListener('click', function () { cleanup(false); });
      okBtn.addEventListener('click', function () { cleanup(true); });
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) cleanup(false);
      });

      document.addEventListener('keydown', handleKeyDown);

      // Focus default button
      setTimeout(function () {
        if (isDanger) {
          cancelBtn.focus();
        } else {
          okBtn.focus();
        }
      }, 50);
    });
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    showToast: showToast,
    confirm: confirm
  };
});
