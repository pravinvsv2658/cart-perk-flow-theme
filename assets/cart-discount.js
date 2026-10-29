/**
 * Cart Discount Controller - CartPerksFlow Theme
 * Handles client-side & server-side validation of discount codes via Shopify AJAX Cart API
 * Synchronizes discount states across Cart Drawer and Cart Page
 */

(function () {
  'use strict';

  var CartDiscount = {
    init: function () {
      var self = this;

      // Handle Apply button click
      document.addEventListener('click', function (e) {
        var applyBtn = e.target.closest('[data-discount-apply]');
        if (applyBtn) {
          e.preventDefault();
          var container = applyBtn.closest('[data-discount-container]');
          if (!container) return;
          var input = container.querySelector('[data-discount-input]');
          if (!input) return;
          self.validateAndApply(input.value, container);
          return;
        }

        var removeBtn = e.target.closest('[data-discount-remove]');
        if (removeBtn) {
          e.preventDefault();
          var removeContainer = removeBtn.closest('[data-discount-container]');
          self.removeDiscount(removeContainer);
          return;
        }
      });

      // Handle Enter key on discount input field
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var input = e.target.closest('[data-discount-input]');
          if (input) {
            e.preventDefault();
            var container = input.closest('[data-discount-container]');
            if (container) {
              self.validateAndApply(input.value, container);
            }
          }
        }
      });

      // Handle live input typing - clear error when user types
      document.addEventListener('input', function (e) {
        var input = e.target.closest('[data-discount-input]');
        if (input) {
          var container = input.closest('[data-discount-container]');
          if (container) {
            var msg = container.querySelector('[data-discount-message]');
            if (msg && msg.classList.contains('cart-drawer__discount-message--error')) {
              msg.classList.add('hidden');
              msg.textContent = '';
            }
          }
        }
      });

      // Synchronize existing stored discount on initial page load
      this.syncInitialState();
    },

    async syncInitialState() {
      try {
        var res = await fetch('/cart.js');
        var cart = await res.json();
        var storedCode = localStorage.getItem('cart_discount_code');

        if (!storedCode) {
          // Check if cart already has an active discount code from session
          var activeFromCart = this.getAppliedCodeFromCart(cart);
          if (activeFromCart) {
            localStorage.setItem('cart_discount_code', activeFromCart);
            this.updateAllUI(activeFromCart);
          } else {
            this.updateAllUI(null);
          }
          return;
        }

        // Validate that stored discount is actually applicable to current cart
        var isValid = this.isDiscountApplicable(cart, storedCode);
        if (isValid) {
          this.updateAllUI(storedCode);
        } else {
          // Stale or invalid discount code in storage - clean it up
          localStorage.removeItem('cart_discount_code');
          this.updateAllUI(null);
        }
      } catch (e) {
        console.error('Failed to sync discount state:', e);
      }
    },

    getAppliedCodeFromCart(cart) {
      if (!cart) return null;

      // 1. Check cart.discount_codes array from Shopify Ajax API
      if (Array.isArray(cart.discount_codes) && cart.discount_codes.length > 0) {
        var applicable = cart.discount_codes.find(function (d) {
          return d.applicable === true;
        });
        if (applicable && applicable.code) return applicable.code.toUpperCase();
      }

      // 2. Check cart_level_discount_applications
      if (Array.isArray(cart.cart_level_discount_applications) && cart.cart_level_discount_applications.length > 0) {
        var app = cart.cart_level_discount_applications[0];
        if (app && app.title) return app.title.toUpperCase();
      }

      // 3. Check item level discount allocations
      if (Array.isArray(cart.items)) {
        for (var i = 0; i < cart.items.length; i++) {
          var item = cart.items[i];
          if (item.line_level_discount_allocations && item.line_level_discount_allocations.length > 0) {
            var alloc = item.line_level_discount_allocations[0];
            if (alloc.discount_application && alloc.discount_application.title) {
              return alloc.discount_application.title.toUpperCase();
            }
          }
        }
      }

      return null;
    },

    isDiscountApplicable(cart, code) {
      if (!cart || !code) return false;
      var clean = code.trim().toUpperCase();

      // Check discount_codes array
      if (Array.isArray(cart.discount_codes)) {
        var match = cart.discount_codes.find(function (d) {
          return d.code && d.code.toUpperCase() === clean;
        });
        if (match) {
          return match.applicable === true;
        }
      }

      // Check cart level discount applications
      if (Array.isArray(cart.cart_level_discount_applications)) {
        var appMatch = cart.cart_level_discount_applications.find(function (a) {
          return a.title && a.title.toUpperCase() === clean;
        });
        if (appMatch) return true;
      }

      // Check line item level discount allocations
      if (Array.isArray(cart.items)) {
        for (var i = 0; i < cart.items.length; i++) {
          var allocs = cart.items[i].line_level_discount_allocations;
          if (allocs && allocs.length > 0) {
            var found = allocs.find(function (al) {
              return al.discount_application && al.discount_application.title && al.discount_application.title.toUpperCase() === clean;
            });
            if (found) return true;
          }
        }
      }

      return false;
    },

    async validateAndApply(rawCode, container) {
      var cleanCode = (rawCode || '').trim().toUpperCase();
      var applyBtn = container.querySelector('[data-discount-apply]');
      var originalBtnText = applyBtn ? applyBtn.textContent : 'Apply';

      // 1. Client-Side Format Validation
      if (!cleanCode) {
        this.showMessage(container, 'Please enter a discount code.', 'error');
        var input = container.querySelector('[data-discount-input]');
        if (input) input.focus();
        return;
      }

      if (cleanCode.length < 2) {
        this.showMessage(container, 'Discount code is too short.', 'error');
        return;
      }

      // Set loading state
      if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.classList.add('is-loading');
        applyBtn.textContent = 'Applying...';
      }

      try {
        // 2. Submit discount code to Shopify's /cart/update.js endpoint
        var updateResponse = await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            discount: cleanCode
          })
        });

        if (!updateResponse.ok) {
          throw new Error('Network error validating discount code');
        }

        var cart = await updateResponse.json();

        // Also register session with /discount/{code}
        await fetch('/discount/' + encodeURIComponent(cleanCode));

        // 3. Strict Server-Side Validation: Verify if Shopify accepted and applied the discount
        var isApplicable = this.isDiscountApplicable(cart, cleanCode);

        // If Shopify's discount_codes array exists, use its explicit applicability status
        if (Array.isArray(cart.discount_codes)) {
          var codeStatus = cart.discount_codes.find(function (d) {
            return d.code && d.code.toUpperCase() === cleanCode;
          });
          if (codeStatus) {
            isApplicable = codeStatus.applicable === true;
          } else {
            // Code was not found in Shopify's discount list
            isApplicable = false;
          }
        }

        if (!isApplicable) {
          // Reject invalid discount: Clear the rejected code from Shopify cart and session
          await this.clearShopifyDiscount();
          localStorage.removeItem('cart_discount_code');
          this.updateAllUI(null);

          this.showMessage(container, 'This discount code is not valid or does not apply to your cart.', 'error');
          return;
        }

        // 4. Code is VALID & APPLIED
        localStorage.setItem('cart_discount_code', cleanCode);
        this.updateAllUI(cleanCode);

        this.showMessage(container, 'Discount code "' + cleanCode + '" applied successfully!', 'success');

        // Close details accordion in drawer if open
        var details = container.querySelector('[data-discount-details]');
        if (details) {
          details.removeAttribute('open');
        }

        // Fetch completely fresh cart so all discount allocations and totals are fully computed
        try {
          var freshCartRes = await fetch('/cart.js');
          if (freshCartRes.ok) {
            var freshCart = await freshCartRes.json();
            if (freshCart) cart = freshCart;
          }
        } catch (fetchErr) {
          console.warn('Could not refresh cart:', fetchErr);
        }

        // Dispatch cart:updated event so cart drawer and page totals update dynamically
        document.dispatchEvent(
          new CustomEvent('cart:updated', {
            detail: { cart: cart, openDrawer: false },
            bubbles: true
          })
        );
      } catch (err) {
        console.error('Error applying discount code:', err);
        this.showMessage(container, 'Unable to apply discount code. Please try again.', 'error');
      } finally {
        if (applyBtn) {
          applyBtn.disabled = false;
          applyBtn.classList.remove('is-loading');
          applyBtn.textContent = originalBtnText;
        }
      }
    },

    async removeDiscount(container) {
      var removeBtn = container ? container.querySelector('[data-discount-remove]') : null;
      if (removeBtn) removeBtn.disabled = true;

      try {
        await this.clearShopifyDiscount();
        localStorage.removeItem('cart_discount_code');

        var res = await fetch('/cart.js');
        var cart = await res.json();

        this.updateAllUI(null);

        if (container) {
          this.showMessage(container, 'Discount removed.', 'success');
          setTimeout(function () {
            var msg = container.querySelector('[data-discount-message]');
            if (msg) msg.classList.add('hidden');
          }, 2500);
        }

        document.dispatchEvent(
          new CustomEvent('cart:updated', {
            detail: { cart: cart, openDrawer: false },
            bubbles: true
          })
        );
      } catch (err) {
        console.error('Error removing discount:', err);
      } finally {
        if (removeBtn) removeBtn.disabled = false;
      }
    },

    async clearShopifyDiscount() {
      try {
        await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ discount: '' })
        });
        await fetch('/discount/CLEAR');
      } catch (e) {
        console.warn('Could not clear discount:', e);
      }
    },

    showMessage: function (container, text, type) {
      if (!container) return;
      var msg = container.querySelector('[data-discount-message]');
      if (!msg) return;

      msg.textContent = text;
      msg.className =
        type === 'success'
          ? 'cart-drawer__discount-message cart-drawer__discount-message--success cart-page__discount-message cart-page__discount-message--success'
          : 'cart-drawer__discount-message cart-drawer__discount-message--error cart-page__discount-message cart-page__discount-message--error';
      msg.classList.remove('hidden');
    },

    updateAllUI: function (code) {
      var containers = document.querySelectorAll('[data-discount-container]');
      var hiddenInputs = document.querySelectorAll('[data-discount-hidden-input]');

      hiddenInputs.forEach(function (inp) {
        inp.value = code || '';
      });

      containers.forEach(function (cont) {
        var appliedEl = cont.querySelector('[data-discount-applied]');
        var textEl = cont.querySelector('[data-discount-code-text]');
        var input = cont.querySelector('[data-discount-input]');

        if (code) {
          if (appliedEl) appliedEl.classList.remove('hidden');
          if (textEl) textEl.textContent = code;
          if (input) input.value = code;
        } else {
          if (appliedEl) appliedEl.classList.add('hidden');
          if (textEl) textEl.textContent = '';
          if (input) input.value = '';
        }
      });
    }
  };

  // Expose globally
  window.CartDiscount = CartDiscount;

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      CartDiscount.init();
    });
  } else {
    CartDiscount.init();
  }
})();
