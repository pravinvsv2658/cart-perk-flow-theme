/**
 * Universal Centralized Swatches Controller - CartPerksFlow Theme
 * Handles:
 * - Centralized COLOR_MAP & getColorHex() with deterministic HSL fallback
 * - Swatch CSS variable initialization (--swatch-color)
 * - Swatch interaction controller for Product Cards, Product Pages, and Quick View
 */

(function () {
  'use strict';

  window.theme = window.theme || {};

  // 1. Comprehensive Universal Color Map
  window.theme.COLOR_MAP = {
    white: '#ffffff',
    black: '#0f172a',
    red: '#ef4444',
    green: '#22c55e',
    blue: '#3b82f6',
    yellow: '#eab308',
    orange: '#f97316',
    purple: '#a855f7',
    pink: '#ec4899',
    gray: '#6b7280',
    grey: '#6b7280',
    navy: '#1e3a8a',
    brown: '#78350f',
    beige: '#f5f5dc',
    gold: '#d97706',
    silver: '#cbd5e1',
    charcoal: '#334155',
    teal: '#0d9488',
    olive: '#65a30d',
    maroon: '#881337',
    cream: '#fef3c7',
    coral: '#f43f5e',
    lavender: '#e9d5ff',
    amber: '#d97706',
    slate: '#64748b',
    khaki: '#c3b091',
    sand: '#e2d4b7',
    chinasand: '#e2d4b7',
    steel: '#94a3b8',
    ice: '#a5f3fc',
    dawn: '#fed7aa',
    powder: '#e0f2fe',
    electric: '#38bdf8',
    sunset: '#fb923c',
    titanium: '#64748b',
    copper: '#b45309',
    bronze: '#78350f',
    rose: '#fb7185',
    rosegold: '#f43f5e',
    burgundy: '#831843',
    wine: '#701a75',
    mint: '#6ee7b7',
    emerald: '#059669',
    forest: '#15803d',
    sage: '#84cc16',
    sky: '#38bdf8',
    indigo: '#6366f1',
    violet: '#7c3aed',
    plum: '#581c87',
    fuchsia: '#d946ef',
    magenta: '#ec4899',
    tan: '#d2b48c',
    taupe: '#8b8589',
    mustard: '#ca8a04',
    ochre: '#b45309',
    rust: '#c2410c',
    cinnamon: '#9a3412',
    ivory: '#fffff0',
    graphite: '#475569',
    denim: '#1d4ed8',
    aqua: '#06b6d4',
    cyan: '#06b6d4',
    turquoise: '#14b8a6',
    neon: '#a3e635',
    lime: '#84cc16',
    chocolate: '#451a03',
    espresso: '#291e17',
    caramel: '#b45309',
    coffee: '#3e2723',
    latte: '#d7ccc8',
    mocha: '#5d4037',
    platinum: '#e2e8f0',
    gunmetal: '#2d3748',
    bone: '#fdfbf7',
    ash: '#cbd5e1',
    camel: '#c19a6b',
    terracotta: '#e2725b',
    blush: '#fbcfe8',
    champagne: '#f7e7ce',
    peach: '#ffdab9',
    apricot: '#fb923c',
    salmon: '#fa8072'
  };

  // 2. Centralized getColorHex
  window.theme.getColorHex = function (val) {
    if (!val) return '#cbd5e1';
    var raw = String(val).trim();
    var clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Check custom color swatches from Theme Settings
    if (window.theme && typeof window.theme.customColorSwatches === 'string' && window.theme.customColorSwatches.trim()) {
      var lines = window.theme.customColorSwatches.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line && line.indexOf(':') !== -1) {
          var parts = line.split(':');
          var k = parts[0].trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          var v = parts[1].trim();
          if (k === clean && v) return v;
        }
      }
    }

    // 2. Direct match in COLOR_MAP
    if (window.theme.COLOR_MAP[clean]) {
      return window.theme.COLOR_MAP[clean];
    }

    // 3. Partial keyword match (e.g. "Ice White" -> white, "Dark Blue" -> blue, "China Sand" -> sand/chinasand)
    for (var colKey in window.theme.COLOR_MAP) {
      if (clean.indexOf(colKey) !== -1 || colKey.indexOf(clean) !== -1) {
        return window.theme.COLOR_MAP[colKey];
      }
    }

    // 4. If raw string is already a valid CSS hex (e.g. #abc, #aabbcc)
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
      return raw;
    }

    // 5. Deterministic attractive pastel color from string hash (ensures NO swatch is ever blank)
    var hash = 0;
    for (var j = 0; j < clean.length; j++) {
      hash = clean.charCodeAt(j) + ((hash << 5) - hash);
    }
    var hue = Math.abs(hash % 360);
    return 'hsl(' + hue + ', 58%, 68%)';
  };

  // 3. Centralized Money Formatter
  window.theme.formatMoney = window.theme.formatMoney || function (cents) {
    return '$' + (cents / 100).toFixed(2);
  };

  // 4. Initialize Swatches in a given DOM subtree
  window.theme.initSwatches = function (container) {
    var root = container || document;
    var dots = root.querySelectorAll('.swatch__inner, .product-card__swatch-dot, .variant-swatch__inner, .quick-view-modal__swatch-inner, .swatch--color');
    dots.forEach(function (el) {
      var colorName = el.getAttribute('data-color-name') || el.getAttribute('data-value') || el.getAttribute('title');
      if (colorName) {
        var hex = window.theme.getColorHex(colorName);
        el.style.setProperty('--swatch-color', hex);
      }
    });
  };

  // 5. Centralized Swatch Click Handler for Product Page and Cards
  document.addEventListener('click', function (e) {
    var swatchBtn = e.target.closest('[data-swatch-btn]');
    if (!swatchBtn) return;

    // If inside Quick View Modal, quick-view.js handles its own internal lifecycle
    if (swatchBtn.closest('quick-view-modal')) {
      return;
    }

    var card = swatchBtn.closest('.product-card');
    var productForm = swatchBtn.closest('.product-form, .product-info, [data-product-container], section');

    // 1. Update active state within option group
    var group = swatchBtn.closest('[data-option-group], .swatch-group, .product-card__option-group, .variant-swatches');
    if (group) {
      group.querySelectorAll('[data-swatch-btn]').forEach(function (btn) {
        btn.classList.remove('is-active');
        btn.setAttribute('aria-checked', 'false');
      });
      swatchBtn.classList.add('is-active');
      swatchBtn.setAttribute('aria-checked', 'true');

      var label = group.querySelector('[data-option-selected-label], [data-selected-value]');
      if (label) {
        label.textContent = swatchBtn.getAttribute('data-option-value') || '';
      }
    }

    // 2. CARD CONTEXT: Delegate to card update logic (component-card.js handles detailed DOM transitions)
    if (card) {
      // Let component-card.js click listener update card
      return;
    }

    // 3. PRODUCT PAGE CONTEXT: Update product form select[name="id"] and prices
    if (productForm) {
      var selectedOptions = [];
      var activeBtns = productForm.querySelectorAll('[data-option-group] [data-swatch-btn].is-active, .swatch-group [data-swatch-btn].is-active');
      activeBtns.forEach(function (btn) {
        var idx = parseInt(btn.getAttribute('data-option-index'), 10);
        if (!isNaN(idx)) {
          selectedOptions[idx] = btn.getAttribute('data-option-value');
        }
      });

      // Parse variants JSON if present on page
      var variantsDataEl = productForm.querySelector('[data-product-variants], [data-card-variants]');
      var variants = [];
      if (variantsDataEl) {
        try {
          variants = JSON.parse(variantsDataEl.textContent);
        } catch (err) {
          console.error('Error parsing product variants JSON:', err);
        }
      }

      var matchedVariant = null;
      if (variants && variants.length > 0) {
        matchedVariant = variants.find(function (v) {
          if (!v.options) return false;
          for (var i = 0; i < selectedOptions.length; i++) {
            if (selectedOptions[i] !== undefined && v.options[i] !== selectedOptions[i]) {
              return false;
            }
          }
          return true;
        });
      }

      // Update select[name="id"] or input[name="id"]
      var idInput = productForm.querySelector('[name="id"]');
      if (idInput && matchedVariant) {
        idInput.value = matchedVariant.id;
        idInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Update price display on product page if available
      if (matchedVariant) {
        var priceEl = productForm.querySelector('[data-product-price], .product-price, .price');
        if (priceEl) {
          priceEl.textContent = window.theme.formatMoney(matchedVariant.price);
        }
      }
    }
  });

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.theme.initSwatches();
    });
  } else {
    window.theme.initSwatches();
  }

  // Handle re-initialization on dynamic section load (Theme Editor)
  document.addEventListener('shopify:section:load', function (e) {
    window.theme.initSwatches(e.target);
  });
})();
