/**
 * Component Product Card - CartPerksFlow Theme
 * Handles variant swatch interaction for single and multi-option products (Color, Material, Size, etc.):
 * - Multi-option selection across all option groups (e.g. Color + Material)
 * - Click swatch -> update active state within its option group and update label
 * - Dynamically match variant combination from embedded JSON
 * - Update card primary image with variant image (smooth fade transition)
 * - Update card price (sale price, compare price, regular price)
 * - Update card form variant ID (so Add to Cart adds the selected variant)
 * - Update card links to ?variant=id
 * - Update availability and sold-out badge/button
 * - Dynamic cross-option availability indicators (sold-out strikethrough)
 */

(function () {
  'use strict';

  function formatMoney(cents) {
    if (window.theme && typeof window.theme.formatMoney === 'function') {
      return window.theme.formatMoney(cents);
    }
    return '$' + (cents / 100).toFixed(2);
  }

  function getColorHex(val) {
    if (window.theme && typeof window.theme.getColorHex === 'function') {
      return window.theme.getColorHex(val);
    }
    return '#cbd5e1';
  }

  // Initialize color swatch background colors
  function initSwatches(container) {
    if (window.theme && typeof window.theme.initSwatches === 'function') {
      window.theme.initSwatches(container);
      return;
    }
    var root = container || document;
    var dots = root.querySelectorAll('.swatch__inner, .product-card__swatch-dot');
    dots.forEach(function (dot) {
      var colorName = dot.getAttribute('data-color-name');
      if (colorName) {
        var hex = getColorHex(colorName);
        dot.style.setProperty('--swatch-color', hex);
      }
    });
  }

  // Delegated click handler for swatches
  document.addEventListener('click', function (e) {
    var swatchBtn = e.target.closest('[data-swatch-btn]');
    if (!swatchBtn) return;

    var card = swatchBtn.closest('.product-card');
    if (!card) return;

    e.preventDefault();
    e.stopPropagation();

    // 1. Identify option group and update active state within this group only
    var optionGroup = swatchBtn.closest('[data-option-group]');
    if (optionGroup) {
      var groupSwatches = optionGroup.querySelectorAll('[data-swatch-btn]');
      groupSwatches.forEach(function (btn) {
        btn.classList.remove('is-active');
        btn.setAttribute('aria-checked', 'false');
      });
      swatchBtn.classList.add('is-active');
      swatchBtn.setAttribute('aria-checked', 'true');

      // Update option label display if present
      var selectedLabel = optionGroup.querySelector('[data-option-selected-label]');
      if (selectedLabel) {
        selectedLabel.textContent = swatchBtn.getAttribute('data-option-value') || '';
      }
    } else {
      // Fallback if no option group wrapper
      var allSwatches = card.querySelectorAll('[data-swatch-btn]');
      allSwatches.forEach(function (btn) {
        btn.classList.remove('is-active');
        btn.setAttribute('aria-checked', 'false');
      });
      swatchBtn.classList.add('is-active');
      swatchBtn.setAttribute('aria-checked', 'true');
    }

    // 2. Read current selections across all option groups on this card
    var selectedOptions = [];
    var activeBtns = card.querySelectorAll('[data-option-group] [data-swatch-btn].is-active');
    if (activeBtns.length > 0) {
      activeBtns.forEach(function (btn) {
        var idx = parseInt(btn.getAttribute('data-option-index'), 10);
        if (!isNaN(idx)) {
          selectedOptions[idx] = btn.getAttribute('data-option-value');
        }
      });
    } else {
      // Single group fallback
      var fallbackIdx = parseInt(swatchBtn.getAttribute('data-option-index') || '0', 10);
      selectedOptions[fallbackIdx] = swatchBtn.getAttribute('data-option-value');
    }

    // 3. Parse variants JSON embedded in the card
    var variantsScript = card.querySelector('[data-card-variants]');
    var variants = [];
    if (variantsScript) {
      try {
        variants = JSON.parse(variantsScript.textContent);
      } catch (err) {
        console.error('Error parsing card variants JSON:', err);
      }
    }

    // 4. Find matching variant based on all selected options
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

    // Fallback if no exact match or no variants array
    if (!matchedVariant && variants && variants.length > 0) {
      matchedVariant = variants[0];
    }

    var variantId = matchedVariant ? matchedVariant.id : swatchBtn.getAttribute('data-variant-id');
    var variantAvailable = matchedVariant ? matchedVariant.available : (swatchBtn.getAttribute('data-variant-available') === 'true');
    var variantPrice = matchedVariant ? formatMoney(matchedVariant.price) : swatchBtn.getAttribute('data-variant-price');
    var variantPriceRaw = matchedVariant ? matchedVariant.price : (parseFloat(swatchBtn.getAttribute('data-variant-price-raw')) || 0);
    var variantCompareRaw = matchedVariant ? (matchedVariant.compare_at_price || 0) : (parseFloat(swatchBtn.getAttribute('data-variant-compare-raw')) || 0);
    var variantCompare = (variantCompareRaw > variantPriceRaw)
      ? (matchedVariant ? formatMoney(matchedVariant.compare_at_price) : swatchBtn.getAttribute('data-variant-compare-price'))
      : '';

    // 5. Update Image with smooth transition
    var variantImage = null;
    if (matchedVariant && matchedVariant.featured_image) {
      variantImage = matchedVariant.featured_image.src || (typeof matchedVariant.featured_image === 'string' ? matchedVariant.featured_image : null);
    }
    if (!variantImage) {
      variantImage = swatchBtn.getAttribute('data-swatch-image') || swatchBtn.getAttribute('data-variant-image');
    }

    if (variantImage) {
      var primaryImg = card.querySelector('.product-card__image--primary');
      if (primaryImg && primaryImg.src !== variantImage) {
        primaryImg.classList.add('is-switching');
        setTimeout(function () {
          primaryImg.src = variantImage;
          primaryImg.removeAttribute('srcset'); // reset srcset to display variant image
          setTimeout(function () {
            primaryImg.classList.remove('is-switching');
          }, 60);
        }, 120);
      }
    }

    // 6. Update Price
    var priceContainer = card.querySelector('.product-card__price');
    if (priceContainer && variantPrice) {
      if (variantCompare && variantCompareRaw > variantPriceRaw) {
        priceContainer.innerHTML =
          '<span class="product-card__price-sale">' + variantPrice + '</span> ' +
          '<s class="product-card__price-compare">' + variantCompare + '</s>';
      } else {
        priceContainer.innerHTML = '<span class="product-card__price-regular">' + variantPrice + '</span>';
      }
    }

    // 7. Update Form Variant ID & Add to Cart button
    var idInput = card.querySelector('input[name="id"]');
    if (idInput && variantId) {
      idInput.value = variantId;
    }

    var addBtn = card.querySelector('.product-card__btn--add');
    if (addBtn) {
      var btnText = addBtn.querySelector('.product-card__btn-text') || addBtn;
      if (!variantAvailable) {
        addBtn.disabled = true;
        addBtn.setAttribute('aria-disabled', 'true');
        addBtn.classList.add('product-card__btn--disabled');
        btnText.textContent = 'Sold out';
      } else {
        addBtn.disabled = false;
        addBtn.removeAttribute('aria-disabled');
        addBtn.classList.remove('product-card__btn--disabled');
        btnText.textContent = 'Add to cart';
      }
    }

    // 8. Update Links to point to ?variant=id
    if (variantId) {
      var mediaLink = card.querySelector('.product-card__media-link');
      if (mediaLink) {
        var mHref = mediaLink.getAttribute('href') || '';
        mediaLink.setAttribute('href', mHref.split('?')[0] + '?variant=' + variantId);
      }
      var titleLink = card.querySelector('.product-card__title-link');
      if (titleLink) {
        var tHref = titleLink.getAttribute('href') || '';
        titleLink.setAttribute('href', tHref.split('?')[0] + '?variant=' + variantId);
      }
    }

    // 9. Update Sold Out Badge
    var soldOutBadge = card.querySelector('.product-card__badge--sold-out');
    if (soldOutBadge) {
      soldOutBadge.style.display = variantAvailable ? 'none' : '';
    }

    // 10. Update Cross-Option Availability indicators (strikethrough)
    if (variants && variants.length > 0) {
      var allGroups = card.querySelectorAll('[data-option-group]');
      allGroups.forEach(function (grp) {
        var grpIdx = parseInt(grp.getAttribute('data-option-index'), 10);
        var btns = grp.querySelectorAll('[data-swatch-btn]');
        btns.forEach(function (btn) {
          var btnVal = btn.getAttribute('data-option-value');
          var testSelections = selectedOptions.slice();
          testSelections[grpIdx] = btnVal;

          var testVariant = variants.find(function (v) {
            if (!v.options) return false;
            for (var k = 0; k < testSelections.length; k++) {
              if (testSelections[k] !== undefined && v.options[k] !== testSelections[k]) {
                return false;
              }
            }
            return true;
          });

          if (testVariant && testVariant.available) {
            btn.classList.remove('is-sold-out');
          } else {
            btn.classList.add('is-sold-out');
          }
        });
      });
    }
  });

  // Run initial swatch color setup on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initSwatches();
    });
  } else {
    initSwatches();
  }

  // Handle re-initialization on dynamic section render
  document.addEventListener('shopify:section:load', function (e) {
    initSwatches(e.target);
  });
})();
