/**
 * Shared Cart Utilities - CartPerksFlow Theme
 * Provides global cart pricing calculation, discount tag rendering with SVG,
 * currency formatting, and badge counter synchronization.
 * Eliminates duplicate code across Cart Drawer and Cart Page.
 */

(function () {
  'use strict';

  window.theme = window.theme || {};

  var ICONS = {
    tag:
      '<svg class="icon-tag" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>' +
        '<line x1="7" y1="7" x2="7.01" y2="7"></line>' +
      '</svg>',
    trash:
      '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<polyline points="3 6 5 6 21 6"></polyline>' +
        '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
      '</svg>',
    close:
      '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<line x1="18" y1="6" x2="6" y2="18"></line>' +
        '<line x1="6" y1="6" x2="18" y2="18"></line>' +
      '</svg>'
  };

  function formatMoney(cents, format) {
    format = format || (window.theme && window.theme.moneyFormat) || '${{amount}}';
    if (typeof cents === 'string') cents = cents.replace('.', '');
    var value = '';
    var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;

    function defaultOption(opt, def) {
      return typeof opt === 'undefined' ? def : opt;
    }

    function formatWithDelimiters(number, precision, thousands, decimal) {
      precision = defaultOption(precision, 2);
      thousands = defaultOption(thousands, ',');
      decimal = defaultOption(decimal, '.');

      if (isNaN(number) || number == null) return 0;

      number = (number / 100.0).toFixed(precision);

      var parts = number.split('.');
      var dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
      var centsVal = parts[1] ? decimal + parts[1] : '';

      return dollars + centsVal;
    }

    var match = format.match(placeholderRegex);
    if (!match) return '$' + (cents / 100).toFixed(2);

    switch (match[1]) {
      case 'amount':
        value = formatWithDelimiters(cents, 2);
        break;
      case 'amount_no_decimals':
        value = formatWithDelimiters(cents, 0);
        break;
      case 'amount_with_comma_separator':
        value = formatWithDelimiters(cents, 2, '.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        value = formatWithDelimiters(cents, 0, '.', ',');
        break;
      default:
        value = formatWithDelimiters(cents, 2);
    }

    return format.replace(placeholderRegex, value);
  }

  function calculateItemPricing(item) {
    if (!item) {
      return {
        effectiveLinePrice: 0,
        originalLinePrice: 0,
        hasItemDiscount: false,
        effectiveUnitPrice: 0,
        originalUnitPrice: 0
      };
    }

    var effectiveLinePrice =
      item.line_price != null && item.line_price < item.original_line_price
        ? item.line_price
        : item.final_line_price;

    var hasItemDiscount = item.total_discount > 0 || item.original_line_price > effectiveLinePrice;

    var effectiveUnitPrice =
      item.discounted_price != null && item.discounted_price < item.original_price
        ? item.discounted_price
        : item.final_price;

    return {
      effectiveLinePrice: effectiveLinePrice,
      originalLinePrice: item.original_line_price,
      hasItemDiscount: hasItemDiscount,
      effectiveUnitPrice: effectiveUnitPrice,
      originalUnitPrice: item.original_price
    };
  }

  function getDiscountTagsHtml(item, className) {
    if (!item) return '';
    className = className || 'cart-item-discount-tag';
    var html = '';

    if (Array.isArray(item.discounts) && item.discounts.length > 0) {
      for (var d = 0; d < item.discounts.length; d++) {
        var disc = item.discounts[d];
        html +=
          '<span class="' + className + '">' +
            ICONS.tag +
            '<span>' + (disc.title || 'Discount') + ' (-' + formatMoney(disc.amount) + ')</span>' +
          '</span>';
      }
    } else if (Array.isArray(item.line_level_discount_allocations) && item.line_level_discount_allocations.length > 0) {
      for (var a = 0; a < item.line_level_discount_allocations.length; a++) {
        var alloc = item.line_level_discount_allocations[a];
        html +=
          '<span class="' + className + '">' +
            ICONS.tag +
            '<span>' + alloc.discount_application.title + ' (-' + formatMoney(alloc.amount) + ')</span>' +
          '</span>';
      }
    }

    return html;
  }

  function updateBadgeCounts(count) {
    var badges = document.querySelectorAll('[data-cart-count], header sup, .cart-count-bubble');
    badges.forEach(function (el) {
      el.textContent = count > 0 ? count : '0';
      if (el.tagName === 'SUP' && count === 0) {
        el.textContent = '';
      }
    });
  }

  // Export to window.theme
  window.theme.formatMoney = formatMoney;
  window.theme.calculateItemPricing = calculateItemPricing;
  window.theme.getDiscountTagsHtml = getDiscountTagsHtml;
  window.theme.updateBadgeCounts = updateBadgeCounts;
  window.theme.icons = ICONS;
})();
