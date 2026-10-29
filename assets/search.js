/**
 * Search Page Section Component
 * CartPerksFlow Theme
 * Handles search input clear actions and section lifecycle.
 */

(function () {
  'use strict';

  function initSearchSection(section) {
    if (!section) return;

    var form = section.querySelector('.search__form');
    var input = section.querySelector('.search__input');
    var clearBtn = section.querySelector('.search__clear-btn');

    if (input && clearBtn) {
      function updateClearVisibility() {
        if (input.value && input.value.trim().length > 0) {
          clearBtn.classList.remove('is-hidden');
        } else {
          clearBtn.classList.add('is-hidden');
        }
      }

      input.addEventListener('input', updateClearVisibility);
      updateClearVisibility();

      clearBtn.addEventListener('click', function (e) {
        e.preventDefault();
        input.value = '';
        input.focus();
        updateClearVisibility();
      });
    }

    if (form && input) {
      form.addEventListener('submit', function (e) {
        if (!input.value || !input.value.trim()) {
          e.preventDefault();
          input.focus();
        }
      });
    }

    section._searchInitialized = true;
  }

  function initAll() {
    var sections = document.querySelectorAll('.search-section');
    sections.forEach(function (sec) {
      initSearchSection(sec);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Shopify Theme Editor Lifecycle Events
  document.addEventListener('shopify:section:load', function (event) {
    var target = event.target;
    var section =
      target && target.matches && target.matches('.search-section')
        ? target
        : target
        ? target.querySelector('.search-section')
        : null;
    if (section) {
      initSearchSection(section);
    }
  });
})();
