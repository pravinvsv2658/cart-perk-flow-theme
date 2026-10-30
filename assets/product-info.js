/**
 * Product Info Custom Controller - CartPerksFlow Theme
 * Handles quantity adjustments, variant resolution on swatch change,
 * live price & savings updates, inventory urgency status, and URL sync.
 */

(function () {
  'use strict';

  function initProductInfo(root) {
    var infoContainers = (root || document).querySelectorAll('[data-product-info]');

    infoContainers.forEach(function (container) {
      if (container.dataset.infoInitialized === 'true') return;
      container.dataset.infoInitialized = 'true';

      var sectionId = container.getAttribute('data-section-id') || '';
      var form = container.querySelector('form[data-type="add-to-cart-form"], form');
      var idInput = container.querySelector('[name="id"]');
      var priceEl = container.querySelector('[data-product-price]');
      var comparePriceEl = container.querySelector('[data-product-compare-price]');
      var saveBadgeEl = container.querySelector('[data-product-save-badge]');
      var inventoryStatusEl = container.querySelector('[data-inventory-status]');
      var inventoryDotEl = container.querySelector('.product-info__inventory-dot');
      var inventoryTextEl = container.querySelector('[data-inventory-text]');
      var skuEl = container.querySelector('[data-product-sku]');
      var submitBtn = container.querySelector('[data-submit-button]');
      var submitText = container.querySelector('[data-submit-text]');

      // 1. Quantity Stepper
      var qtyInput = container.querySelector('[data-qty-input]');
      var qtyMinus = container.querySelector('[data-qty-action="decrease"]');
      var qtyPlus = container.querySelector('[data-qty-action="increase"]');

      if (qtyMinus && qtyInput) {
        qtyMinus.addEventListener('click', function (e) {
          e.preventDefault();
          var cur = parseInt(qtyInput.value, 10) || 1;
          var min = parseInt(qtyInput.getAttribute('min'), 10) || 1;
          if (cur > min) {
            qtyInput.value = cur - 1;
            qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }

      if (qtyPlus && qtyInput) {
        qtyPlus.addEventListener('click', function (e) {
          e.preventDefault();
          var cur = parseInt(qtyInput.value, 10) || 1;
          var max = parseInt(qtyInput.getAttribute('max'), 10) || 99;
          if (cur < max) {
            qtyInput.value = cur + 1;
            qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }

      if (qtyInput) {
        qtyInput.addEventListener('change', function () {
          var val = parseInt(this.value, 10);
          var min = parseInt(this.getAttribute('min'), 10) || 1;
          var max = parseInt(this.getAttribute('max'), 10) || 99;
          if (isNaN(val) || val < min) this.value = min;
          if (val > max) this.value = max;
        });
      }

      // 2. Parse Variants JSON
      var variantsDataEl =
        container.querySelector('[data-product-variants]') ||
        (container.closest('.product-section') && container.closest('.product-section').querySelector('[data-product-variants]')) ||
        document.querySelector('[data-product-variants]');

      var variants = [];
      if (variantsDataEl) {
        try {
          variants = JSON.parse(variantsDataEl.textContent);
        } catch (err) {
          console.error('Error parsing product variants JSON in product-info:', err);
        }
      }

      // 3. Swatch Change / Click Listener
      container.addEventListener('click', function (e) {
        var swatchBtn = e.target.closest('[data-swatch-btn]');
        if (!swatchBtn) return;

        // Give swatches.js a tick to update .is-active and labels
        setTimeout(function () {
          updateVariant();
        }, 10);
      });

      // 3b. Dropdown Select Change Listener
      container.addEventListener('change', function (e) {
        var select = e.target.closest('[data-option-select]');
        if (!select) return;

        var group = select.closest('[data-option-group]');
        if (group) {
          var valEl = group.querySelector('[data-selected-value]');
          if (valEl) valEl.textContent = select.value;
        }
        updateVariant();
      });

      function updateVariant() {
        if (!variants || !variants.length) return;

        // Gather currently selected option values from swatches and dropdowns
        var selectedOptions = [];
        var activeSwatches = container.querySelectorAll('[data-option-group] [data-swatch-btn].is-active, .swatch-group [data-swatch-btn].is-active');

        activeSwatches.forEach(function (btn) {
          var optIdx = parseInt(btn.getAttribute('data-option-index'), 10);
          var optVal = btn.getAttribute('data-option-value');
          if (!isNaN(optIdx) && optVal) {
            selectedOptions[optIdx] = optVal;
          }
        });

        var optionSelects = container.querySelectorAll('[data-option-select]');
        optionSelects.forEach(function (sel) {
          var optIdx = parseInt(sel.getAttribute('data-index'), 10);
          var optVal = sel.value;
          if (!isNaN(optIdx) && optVal) {
            selectedOptions[optIdx] = optVal;
          }
        });

        // Find matching variant
        var matchedVariant = variants.find(function (v) {
          if (!v.options) return false;
          for (var i = 0; i < selectedOptions.length; i++) {
            if (selectedOptions[i] !== undefined && v.options[i] !== selectedOptions[i]) {
              return false;
            }
          }
          return true;
        });

        if (!matchedVariant) return;

        // A. Update hidden ID input
        if (idInput) {
          idInput.value = matchedVariant.id;
        }

        // B. Update Prices & Savings Badge
        var formatMoney = window.theme.formatMoney || function (cents) {
          return '$' + (cents / 100).toFixed(2);
        };

        if (priceEl) {
          priceEl.textContent = formatMoney(matchedVariant.price);
        }

        var onSale = matchedVariant.compare_at_price && matchedVariant.compare_at_price > matchedVariant.price;
        if (comparePriceEl) {
          if (onSale) {
            comparePriceEl.textContent = formatMoney(matchedVariant.compare_at_price);
            comparePriceEl.classList.remove('hidden');
          } else {
            comparePriceEl.classList.add('hidden');
          }
        }

        if (saveBadgeEl) {
          if (onSale) {
            var diff = matchedVariant.compare_at_price - matchedVariant.price;
            saveBadgeEl.textContent = 'Save ' + formatMoney(diff);
            saveBadgeEl.classList.remove('hidden');
          } else {
            saveBadgeEl.classList.add('hidden');
          }
        }

        // C. Update Inventory Status
        var isAvailable = matchedVariant.available;
        if (inventoryTextEl && inventoryDotEl && inventoryStatusEl) {
          var threshold = parseInt(inventoryStatusEl.getAttribute('data-inventory-threshold'), 10) || 5;
          var inStockMsg = inventoryStatusEl.getAttribute('data-in-stock-msg') || 'In stock, ready to dispatch today';
          var lowStockMsg = inventoryStatusEl.getAttribute('data-low-stock-msg') || 'Low stock — only {quantity} left!';
          var soldOutMsg = inventoryStatusEl.getAttribute('data-sold-out-msg') || 'Sold out — join waitlist';

          if (!isAvailable) {
            inventoryDotEl.className = 'product-info__inventory-dot is-soldout';
            inventoryTextEl.textContent = soldOutMsg;
          } else if (matchedVariant.inventory_quantity && matchedVariant.inventory_quantity > 0 && matchedVariant.inventory_quantity <= threshold) {
            inventoryDotEl.className = 'product-info__inventory-dot is-low-stock';
            inventoryTextEl.textContent = lowStockMsg.replace('{quantity}', matchedVariant.inventory_quantity);
          } else {
            inventoryDotEl.className = 'product-info__inventory-dot';
            inventoryTextEl.textContent = inStockMsg;
          }
        }

        // D. Update SKU
        if (skuEl) {
          var skuValEl = skuEl.querySelector('[data-sku-value]');
          if (matchedVariant.sku) {
            if (skuValEl) {
              skuValEl.textContent = matchedVariant.sku;
            } else {
              skuEl.textContent = 'SKU: ' + matchedVariant.sku;
            }
            skuEl.classList.remove('hidden');
          } else {
            skuEl.classList.add('hidden');
          }
        }

        // E. Update Submit Button
        if (submitBtn) {
          if (!isAvailable) {
            submitBtn.disabled = true;
            submitBtn.setAttribute('aria-disabled', 'true');
            submitBtn.classList.add('is-disabled');
            if (submitText) submitText.textContent = 'Sold out';
          } else {
            submitBtn.disabled = false;
            submitBtn.removeAttribute('aria-disabled');
            submitBtn.classList.remove('is-disabled');
            if (submitText) submitText.textContent = 'Add to Cart';
          }
        }

        // F. Update URL without reloading
        if (window.history && window.history.replaceState) {
          var newUrl = new URL(window.location.href);
          newUrl.searchParams.set('variant', matchedVariant.id);
          window.history.replaceState({ path: newUrl.href }, '', newUrl.href);
        }

        // G. Dispatch variant:change event for product gallery & other listeners
        document.dispatchEvent(
          new CustomEvent('variant:change', {
            detail: {
              variant: matchedVariant,
              sectionId: sectionId
            },
            bubbles: true
          })
        );
      }

      // 4. Social Share Copy Link Handler
      container.addEventListener('click', function (e) {
        var copyBtn = e.target.closest('[data-share-copy]');
        if (!copyBtn) return;
        e.preventDefault();

        var shareUrl = copyBtn.getAttribute('data-share-url') || window.location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(function () {
            var tooltip = copyBtn.querySelector('[data-share-tooltip]');
            if (tooltip) {
              tooltip.classList.add('is-visible');
              setTimeout(function () {
                tooltip.classList.remove('is-visible');
              }, 2000);
            }
          }).catch(function (err) {
            console.warn('Could not copy product link:', err);
          });
        }
      });
    });
  }

  // Initialize on DOMContentLoaded and on Shopify section load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initProductInfo();
    });
  } else {
    initProductInfo();
  }

  document.addEventListener('shopify:section:load', function (e) {
    initProductInfo(e.target);
  });
})();
