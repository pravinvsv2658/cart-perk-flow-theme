/**
 * Cart Page Controller - CartPerksFlow Theme
 * Handles AJAX quantity stepper adjustments (+ / -), direct input changes, item removal,
 * and dynamic price, discount & shipping bar updates without full page reloads.
 */

(function () {
  'use strict';

  function formatMoney(cents) {
    return (window.theme && typeof window.theme.formatMoney === 'function')
      ? window.theme.formatMoney(cents)
      : '$' + (cents / 100).toFixed(2);
  }

  var CartPage = {
    init: function () {
      this.section = document.querySelector('[data-cart-page-section]');
      if (!this.section) return;

      this.form = this.section.querySelector('#cart-form');
      this.itemsList = this.section.querySelector('[data-cart-page-items]');
      this.emptyContainer = this.section.querySelector('[data-cart-page-empty]');
      this.contentWrapper = this.section.querySelector('[data-cart-page-content]');
      this.countBadge = this.section.querySelector('[data-cart-page-count]');
      this.shippingBar = this.section.querySelector('[data-cart-page-shipping-bar]');
      this.noteInput = this.section.querySelector('[data-cart-page-note]');

      this.noteTimeout = null;
      this.isUpdating = false;

      this.bindEvents();
    },

    bindEvents: function () {
      var self = this;

      // Handle stepper buttons (+ / -) & remove button
      this.section.addEventListener('click', function (e) {
        var qtyBtn = e.target.closest('[data-cart-page-qty]');
        if (qtyBtn) {
          e.preventDefault();
          var action = qtyBtn.getAttribute('data-cart-page-qty');
          var key = qtyBtn.getAttribute('data-key');
          var input = self.section.querySelector('[data-cart-page-qty-input][data-key="' + key + '"]');
          if (!input) return;

          var currentVal = parseInt(input.value, 10) || 0;
          var newVal = action === 'increase' ? currentVal + 1 : Math.max(0, currentVal - 1);
          input.value = newVal;
          self.updateQuantity(key, newVal);
          return;
        }

        var removeBtn = e.target.closest('[data-cart-page-remove]');
        if (removeBtn) {
          e.preventDefault();
          var removeKey = removeBtn.getAttribute('data-key');
          self.updateQuantity(removeKey, 0);
          return;
        }
      });

      // Handle direct quantity input edit
      this.section.addEventListener('change', function (e) {
        var input = e.target.closest('[data-cart-page-qty-input]');
        if (input) {
          var key = input.getAttribute('data-key');
          var val = parseInt(input.value, 10);
          if (isNaN(val) || val < 0) val = 0;
          self.updateQuantity(key, val);
        }
      });

      // Prevent Enter key in quantity input from submitting form
      this.section.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var input = e.target.closest('[data-cart-page-qty-input]');
          if (input) {
            e.preventDefault();
            input.blur();
          }
        }
      });

      // Form submission safety check: Only checkout button submits
      if (this.form) {
        this.form.addEventListener('submit', function (e) {
          var submitter = e.submitter;
          if (!submitter || submitter.getAttribute('name') !== 'checkout') {
            e.preventDefault();
          }
        });
      }

      // Order Note debounced auto-save
      if (this.noteInput) {
        this.noteInput.addEventListener('input', function () {
          clearTimeout(self.noteTimeout);
          self.noteTimeout = setTimeout(function () {
            self.saveNote(self.noteInput.value);
          }, 600);
        });
      }

      // Listen for global cart:updated event (from cart-discount, drawer, etc.)
      document.addEventListener('cart:updated', function (e) {
        if (e.detail && e.detail.cart) {
          self.renderCart(e.detail.cart);
        } else {
          self.refresh();
        }
      });
    },

    refresh: async function () {
      try {
        var res = await fetch('/cart.js');
        var cart = await res.json();
        this.renderCart(cart);
      } catch (err) {
        console.error('Failed to refresh cart page:', err);
      }
    },

    showItemError: function (key, message) {
      if (!message || !this.section) return;
      var cleanKey = String(key || '');
      var variantId = cleanKey.split(':')[0];

      var row = this.section.querySelector('[data-cart-item-row][data-key="' + cleanKey + '"]') ||
                (variantId ? this.section.querySelector('[data-cart-item-row][data-variant-id="' + variantId + '"]') : null) ||
                (variantId ? this.section.querySelector('[data-cart-item-row][data-key*="' + variantId + '"]') : null);

      var getErrorIconHtml = function () {
        var tpl = document.getElementById('cart-page-error-icon-template') || document.getElementById('cart-drawer-error-icon-template');
        if (tpl && tpl.innerHTML) {
          return tpl.innerHTML.trim();
        }
        return '<span class="cart-page__error-icon" aria-hidden="true"><svg class="icon-warning" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></span>';
      };

      if (row) {
        var errorEl = this.section.querySelector('[data-item-error][data-key="' + cleanKey + '"]') ||
                      (row.nextElementSibling && row.nextElementSibling.matches('[data-item-error]') ? row.nextElementSibling : null) ||
                      row.querySelector('[data-item-error]');
        if (!errorEl) {
          errorEl = document.createElement('div');
          errorEl.className = 'cart-page__item-error';
          errorEl.setAttribute('data-item-error', '');
          errorEl.setAttribute('data-key', cleanKey);
          errorEl.setAttribute('role', 'alert');
          row.insertAdjacentElement('afterend', errorEl);
        }

        var textEl = errorEl.querySelector('[data-item-error-text]') || errorEl.querySelector('.cart-page__error-text');
        var iconEl = errorEl.querySelector('.cart-page__error-icon');
        if (!iconEl || !textEl) {
          errorEl.innerHTML = getErrorIconHtml() + ' <span class="cart-page__error-text" data-item-error-text>' + message + '</span>';
        } else {
          textEl.textContent = message;
        }
        errorEl.classList.remove('hidden');

        row.classList.add('has-error');
        setTimeout(function () {
          row.classList.remove('has-error');
        }, 3000);
      } else {
        var banner = this.section.querySelector('[data-cart-error-banner]');
        if (banner) {
          var bannerText = banner.querySelector('[data-cart-error-text]') || banner.querySelector('.cart-page__error-text');
          var bannerIcon = banner.querySelector('.cart-page__error-icon');
          if (!bannerIcon || !bannerText) {
            banner.innerHTML = getErrorIconHtml() + ' <span class="cart-page__error-text" data-cart-error-text>' + message + '</span>';
          } else {
            bannerText.textContent = message;
          }
          banner.classList.remove('hidden');
          setTimeout(function () {
            banner.classList.add('hidden');
          }, 5000);
        }
      }
    },

    clearItemError: function (key) {
      if (key && this.section) {
        var cleanKey = String(key || '');
        var variantId = cleanKey.split(':')[0];
        var row = this.section.querySelector('[data-cart-item-row][data-key="' + cleanKey + '"]') ||
                  (variantId ? this.section.querySelector('[data-cart-item-row][data-variant-id="' + variantId + '"]') : null);
        var errorEl = this.section.querySelector('[data-item-error][data-key="' + cleanKey + '"]') ||
                      (row && row.nextElementSibling && row.nextElementSibling.matches('[data-item-error]') ? row.nextElementSibling : null) ||
                      (row ? row.querySelector('[data-item-error]') : null);
        if (errorEl) {
          errorEl.classList.add('hidden');
        }
      }
      var banner = this.section ? this.section.querySelector('[data-cart-error-banner]') : null;
      if (banner) banner.classList.add('hidden');
    },

    updateQuantity: async function (key, quantity) {
      if (this.isUpdating) return;
      this.isUpdating = true;
      this.clearItemError(key);

      var row = this.section.querySelector('[data-cart-item-row][data-key="' + key + '"]');
      if (row) row.classList.add('is-loading');

      try {
        var response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            id: key,
            quantity: quantity
          })
        });

        var responseData = await response.json();

        if (!response.ok) {
          var errorMsg = responseData.description || responseData.message || responseData.errors || 'Could not update quantity';

          // When 422 happens, refresh the cart to sync inputs with the actual allowed quantity
          await this.refresh();

          // Display the error message to the user
          this.showItemError(key, errorMsg);

          document.dispatchEvent(
            new CustomEvent('cart:updated', {
              detail: { openDrawer: false },
              bubbles: true
            })
          );
          return;
        }

        var cart = responseData;
        this.renderCart(cart);

        // Check if Shopify silently capped the item quantity
        if (cart.items && Array.isArray(cart.items)) {
          var matchedItem = cart.items.find(function (it) {
            return it.key === key || it.id === parseInt(key, 10);
          });
          if (matchedItem && matchedItem.quantity < quantity) {
            this.showItemError(key, 'Only ' + matchedItem.quantity + ' items were added to your cart due to availability.');
          }
        }

        // Dispatch globally so drawer and cart badge stay 100% in sync
        document.dispatchEvent(
          new CustomEvent('cart:updated', {
            detail: { cart: cart, openDrawer: false },
            bubbles: true
          })
        );
      } catch (err) {
        console.error('Error changing cart quantity:', err);
        await this.refresh();
        this.showItemError(key, err.message || 'Could not update quantity');
      } finally {
        if (row) row.classList.remove('is-loading');
        this.isUpdating = false;
      }
    },

    saveNote: async function (note) {
      try {
        await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ note: note })
        });
      } catch (err) {
        console.error('Failed to save order note:', err);
      }
    },

    renderCart: function (cart) {
      if (!cart || !this.section) return;

      // 1. Update Global Header Cart Count Badges
      if (window.theme && typeof window.theme.updateBadgeCounts === 'function') {
        window.theme.updateBadgeCounts(cart.item_count);
      }

      // 2. Empty State Toggle
      if (cart.item_count === 0) {
        if (this.emptyContainer) this.emptyContainer.classList.remove('hidden');
        if (this.contentWrapper) this.contentWrapper.classList.add('hidden');
        if (this.countBadge) this.countBadge.classList.add('hidden');
        if (this.shippingBar) this.shippingBar.classList.add('hidden');
        return;
      }

      if (this.emptyContainer) this.emptyContainer.classList.add('hidden');
      if (this.contentWrapper) this.contentWrapper.classList.remove('hidden');
      if (this.countBadge) {
        this.countBadge.classList.remove('hidden');
        this.countBadge.textContent = '(' + cart.item_count + ' ' + (cart.item_count === 1 ? 'item' : 'items') + ')';
      }

      // 3. Update Free Shipping Bar
      if (this.shippingBar) {
        this.shippingBar.classList.remove('hidden');
        var threshold = parseInt(this.shippingBar.getAttribute('data-threshold'), 10) || 5000;
        var diff = threshold - cart.total_price;
        var pct = Math.min(100, Math.round((cart.total_price / threshold) * 100));

        var progressEl = this.shippingBar.querySelector('[data-cart-page-shipping-progress]');
        var messageEl = this.shippingBar.querySelector('[data-cart-page-shipping-message]');

        if (progressEl) {
          progressEl.style.width = pct + '%';
        }

        if (messageEl) {
          if (cart.total_price >= threshold && cart.item_count > 0) {
            messageEl.textContent = "Free Shipping: 🎉 You've unlocked Free Shipping!";
          } else {
            messageEl.textContent = 'Add ' + formatMoney(diff) + ' more to unlock Free Shipping!';
          }
        }
      }

      // 4. Update Summary Prices & Discounts
      var hasDiscount = cart.total_discount > 0;
      var originalSubtotal = formatMoney(cart.original_total_price || cart.items_subtotal_price || cart.total_price);
      var discountAmount = hasDiscount ? '-' + formatMoney(cart.total_discount) : '';
      var finalTotal = formatMoney(cart.total_price);
      var appliedCode = localStorage.getItem('cart_discount_code') || '';

      // Subtotal
      var subtotals = this.section.querySelectorAll('[data-cart-subtotal]');
      subtotals.forEach(function (el) {
        el.textContent = hasDiscount ? originalSubtotal : finalTotal;
      });

      // Savings row
      var savingsRow = this.section.querySelector('[data-cart-savings-row]');
      var savingsEl = this.section.querySelector('[data-cart-savings]');
      var savingsCodeEl = this.section.querySelector('[data-cart-savings-code]');

      if (savingsRow && savingsEl) {
        if (hasDiscount) {
          savingsRow.classList.remove('hidden');
          savingsEl.textContent = discountAmount;
          if (savingsCodeEl) {
            savingsCodeEl.textContent = appliedCode ? '(' + appliedCode + ')' : '';
          }
        } else {
          savingsRow.classList.add('hidden');
          savingsEl.textContent = '';
          if (savingsCodeEl) savingsCodeEl.textContent = '';
        }
      }

      // Final Total
      var totals = this.section.querySelectorAll('[data-cart-total]');
      totals.forEach(function (el) {
        el.textContent = finalTotal;
      });

      // Checkout Button Subtotal
      var checkoutSubtotals = this.section.querySelectorAll('[data-cart-checkout-subtotal]');
      checkoutSubtotals.forEach(function (el) {
        el.textContent = finalTotal;
      });

      // 5. Update Line Items
      var currentVariantIds = cart.items.map(function (it) {
        return (it.id || it.variant_id || '').toString();
      });
      var currentKeys = cart.items.map(function (it) {
        return it.key;
      });

      // Remove any item DOM row that is no longer in cart
      var allRows = this.section.querySelectorAll('[data-cart-item-row]');
      allRows.forEach(function (row) {
        var rowVarId = row.getAttribute('data-variant-id') || '';
        var rowKey = row.getAttribute('data-key') || '';
        if (!currentVariantIds.includes(rowVarId) && !currentKeys.includes(rowKey)) {
          row.remove();
        }
      });

      // Update remaining items
      for (var i = 0; i < cart.items.length; i++) {
        var item = cart.items[i];
        var itemVarId = (item.id || item.variant_id || '').toString();
        var itemRow = this.section.querySelector('[data-cart-item-row][data-key="' + item.key + '"]') ||
                      this.section.querySelector('[data-cart-item-row][data-variant-id="' + itemVarId + '"]') ||
                      this.section.querySelectorAll('[data-cart-item-row]')[i];
        if (!itemRow) continue;

        itemRow.classList.remove('is-loading');

        // Keep key attributes on row and child buttons in sync
        itemRow.setAttribute('data-key', item.key);
        if (itemVarId) itemRow.setAttribute('data-variant-id', itemVarId);
        var keyElements = itemRow.querySelectorAll('[data-key]');
        keyElements.forEach(function (el) {
          el.setAttribute('data-key', item.key);
        });

        // Input
        var input = itemRow.querySelector('[data-cart-page-qty-input]');
        if (input) input.value = item.quantity;

        // Effective line price & unit price calculations via shared helper
        var pricing = (window.theme && typeof window.theme.calculateItemPricing === 'function')
          ? window.theme.calculateItemPricing(item)
          : { effectiveLinePrice: item.final_line_price, originalLinePrice: item.original_line_price, hasItemDiscount: false, effectiveUnitPrice: item.final_price, originalUnitPrice: item.original_price };

        // Line Total
        var lineFinal = itemRow.querySelector('[data-cart-item-line-final]');
        if (lineFinal) lineFinal.textContent = formatMoney(pricing.effectiveLinePrice);

        var lineOriginal = itemRow.querySelector('[data-cart-item-line-original]');
        if (pricing.hasItemDiscount) {
          if (!lineOriginal) {
            lineOriginal = document.createElement('s');
            lineOriginal.className = 'cart-page__item-total-original';
            lineOriginal.setAttribute('data-cart-item-line-original', '');
            var totalContainer = itemRow.querySelector('[data-cart-item-total]');
            if (totalContainer) totalContainer.insertBefore(lineOriginal, lineFinal.nextSibling);
          }
          lineOriginal.textContent = formatMoney(pricing.originalLinePrice);
        } else if (lineOriginal) {
          lineOriginal.remove();
        }

        // Unit Price
        var unitFinal = itemRow.querySelector('[data-cart-item-final-price]');
        if (unitFinal) unitFinal.textContent = formatMoney(pricing.effectiveUnitPrice);

        var unitOriginal = itemRow.querySelector('[data-cart-item-original-price]');
        if (pricing.effectiveUnitPrice < pricing.originalUnitPrice) {
          if (!unitOriginal) {
            unitOriginal = document.createElement('span');
            unitOriginal.className = 'cart-page__item-price-compare';
            unitOriginal.setAttribute('data-cart-item-original-price', '');
            var unitContainer = itemRow.querySelector('.cart-page__item-price-col');
            if (unitContainer) unitContainer.appendChild(unitOriginal);
          }
          unitOriginal.textContent = formatMoney(pricing.originalUnitPrice);
        } else if (unitOriginal) {
          unitOriginal.remove();
        }

        // Item discounts tag via shared helper (uses SVG tag icon)
        var discountsContainer = itemRow.querySelector('[data-cart-item-discounts]');
        if (discountsContainer) {
          var tagsHtml = (window.theme && typeof window.theme.getDiscountTagsHtml === 'function')
            ? window.theme.getDiscountTagsHtml(item, 'cart-page__item-discount-tag')
            : '';

          if (tagsHtml) {
            discountsContainer.innerHTML = tagsHtml;
            discountsContainer.classList.remove('hidden');
          } else {
            discountsContainer.innerHTML = '';
            discountsContainer.classList.add('hidden');
          }
        }
      }
    }
  };

  // Expose globally
  window.CartPage = CartPage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      CartPage.init();
    });
  } else {
    CartPage.init();
  }
})();
