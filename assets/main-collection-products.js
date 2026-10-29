/**
 * Collection Section JavaScript Component
 * CartPerksFlow Theme - Handles AJAX Quick Add & Theme Editor Lifecycle
 */

(function () {
  'use strict';

  // Quick add is handled globally by product-form.js
  function initQuickAdd(section) {
    if (!section) return;
    section._quickAddInitialized = true;
  }

  function initSection(section) {
    if (!section) return;
    initQuickAdd(section);
  }

  function initAll() {
    var sections = document.querySelectorAll('.collection-section');
    sections.forEach(function (sec) {
      initSection(sec);
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
    var section = target && target.matches && target.matches('.collection-section')
      ? target
      : (target ? target.querySelector('.collection-section') : null);
    if (section) {
      initSection(section);
    }
  });
})();
