/**
 * Cart Drawer Controller - CartPerksFlow Theme
 * Built with Shopify Section Rendering API (inspired by Shopify Dawn)
 * Handles drawer open/close, AJAX quantity adjustments, and live Liquid section updates
 */

(function () {
  'use strict';

  class CartDrawer extends HTMLElement {
    constructor() {
      super();
      this.isOpen = false;
      this.noteTimeout = null;
      this.bindEvents();
    }

    bindEvents() {
      var self = this;

      // Click event delegation on cart-drawer element
      this.addEventListener('click', function (e) {
        // Close button or overlay click
        var closeTarget = e.target.closest('[data-cart-drawer-close]');
        if (closeTarget) {
          e.preventDefault();
          self.close();
          return;
        }

        // Quantity increase / decrease
        var qtyBtn = e.target.closest('[data-qty-action]');
        if (qtyBtn) {
          e.preventDefault();
          var action = qtyBtn.getAttribute('data-qty-action');
          var key = qtyBtn.getAttribute('data-key');
          var input = self.querySelector('[data-qty-input][data-key="' + key + '"]');
          if (!input) return;

          var currentVal = parseInt(input.value, 10) || 0;
          var newVal = action === 'increase' ? currentVal + 1 : Math.max(0, currentVal - 1);
          input.value = newVal;
          self.updateQuantity(key, newVal);
          return;
        }

        // Item remove button
        var removeBtn = e.target.closest('[data-remove-item]');
        if (removeBtn) {
          e.preventDefault();
          var removeKey = removeBtn.getAttribute('data-key');
          self.updateQuantity(removeKey, 0);
          return;
        }
      });

      // Quantity input manual edit
      this.addEventListener('change', function (e) {
        var input = e.target.closest('[data-qty-input]');
        if (input) {
          var key = input.getAttribute('data-key');
          var val = parseInt(input.value, 10);
          if (isNaN(val) || val < 0) val = 0;
          self.updateQuantity(key, val);
        }
      });

      // Order Note debounced auto-save
      this.addEventListener('input', function (e) {
        var noteInput = e.target.closest('[data-cart-note]');
        if (noteInput) {
          clearTimeout(self.noteTimeout);
          self.noteTimeout = setTimeout(function () {
            self.saveNote(noteInput.value);
          }, 600);
        }
      });

      // Escape key to close
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && self.isOpen) {
          self.close();
        }
      });

      // Global event listener for cart:updated
      document.addEventListener('cart:updated', function (e) {
        var shouldOpen = Boolean(e.detail && e.detail.openDrawer === true);
        if (e.detail && e.detail.sections && e.detail.sections['cart-drawer']) {
          self.renderContents(e.detail, shouldOpen);
        } else {
          self.refresh(shouldOpen);
        }
      });

      // Global Header Cart Icon click listener
      document.addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-cart-trigger], header a[href$="/cart"], header a[href*="/cart"]');
        if (trigger) {
          var isCartPage = window.location.pathname.endsWith('/cart') || Boolean(document.querySelector('[data-cart-page-section]'));
          if (self.getCartType() === 'drawer' && !isCartPage) {
            e.preventDefault();
            self.toggle();
          }
        }
      });
    }

    getCartType() {
      return (window.theme && window.theme.cartType) || this.getAttribute('data-cart-type') || 'drawer';
    }

    open() {
      var isCartPage = window.location.pathname.endsWith('/cart') || Boolean(document.querySelector('[data-cart-page-section]'));
      if (isCartPage) return;

      this.classList.add('is-open');
      this.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      this.isOpen = true;
      this.dispatchEvent(new CustomEvent('cart-drawer:opened', { bubbles: true }));
    }

    close() {
      this.classList.remove('is-open');
      this.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      this.isOpen = false;
      this.dispatchEvent(new CustomEvent('cart-drawer:closed', { bubbles: true }));
    }

    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    getSectionsToRender() {
      return [
        {
          id: 'CartDrawer',
          section: 'cart-drawer',
          selector: '.cart-drawer__panel'
        }
      ];
    }

    renderContents(parsedState, openDrawer) {
      if (!parsedState || !parsedState.sections) return;

      var sectionHtml = parsedState.sections['cart-drawer'];
      if (!sectionHtml) return;

      var parsed = new DOMParser().parseFromString(sectionHtml, 'text/html');
      var newPanel = parsed.querySelector('.cart-drawer__panel');
      var currentPanel = this.querySelector('.cart-drawer__panel');

      if (newPanel && currentPanel) {
        currentPanel.innerHTML = newPanel.innerHTML;
      }

      // Update badge counts across header and page
      var countBadge = parsed.querySelector('.cart-drawer__count-badge');
      var count = countBadge ? parseInt(countBadge.textContent, 10) : (parsedState.item_count != null ? parsedState.item_count : 0);
      if (isNaN(count)) count = 0;

      if (window.theme && typeof window.theme.updateBadgeCounts === 'function') {
        window.theme.updateBadgeCounts(count);
      }

      // Re-sync discount UI state if discount code active
      if (window.CartDiscount && typeof window.CartDiscount.syncInitialState === 'function') {
        window.CartDiscount.syncInitialState();
      }

      var isCartPage = window.location.pathname.endsWith('/cart') || Boolean(document.querySelector('[data-cart-page-section]'));
      if (openDrawer === true && !isCartPage && this.getCartType() === 'drawer') {
        this.open();
      }
    }

    async refresh(openDrawer) {
      try {
        var res = await fetch('/?sections=cart-drawer');
        var data = await res.json();
        if (data && data['cart-drawer']) {
          this.renderContents({ sections: data }, openDrawer === true);
        }
      } catch (err) {
        console.error('Failed to refresh cart drawer:', err);
      }
    }

    showItemError(key, message) {
      if (!message) return;
      var cleanKey = String(key || '');
      var variantId = cleanKey.split(':')[0];

      var item = this.querySelector('[data-item-key="' + cleanKey + '"]') ||
                 (variantId ? this.querySelector('[data-cart-item][data-variant-id="' + variantId + '"]') : null) ||
                 (variantId ? this.querySelector('[data-cart-item][data-item-key*="' + variantId + '"]') : null);

      var getErrorIconHtml = function () {
        var tpl = document.getElementById('cart-drawer-error-icon-template') || document.getElementById('cart-page-error-icon-template');
        if (tpl && tpl.innerHTML) {
          return tpl.innerHTML.trim();
        }
        return '<span class="cart-drawer__error-icon" aria-hidden="true"><svg class="icon-warning" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></span>';
      };

      if (item) {
        var errorEl = item.querySelector('[data-item-error]');
        if (!errorEl) {
          errorEl = document.createElement('div');
          errorEl.className = 'cart-drawer__item-error';
          errorEl.setAttribute('data-item-error', '');
          errorEl.setAttribute('role', 'alert');
          var details = item.querySelector('.cart-drawer__item-details') || item;
          details.appendChild(errorEl);
        }

        var textEl = errorEl.querySelector('[data-item-error-text]') || errorEl.querySelector('.cart-drawer__error-text');
        var iconEl = errorEl.querySelector('.cart-drawer__error-icon');
        if (!iconEl || !textEl) {
          errorEl.innerHTML = getErrorIconHtml() + ' <span class="cart-drawer__error-text" data-item-error-text>' + message + '</span>';
        } else {
          textEl.textContent = message;
        }
        errorEl.classList.remove('hidden');

        item.classList.add('has-error');
        setTimeout(function () {
          item.classList.remove('has-error');
        }, 3000);
      } else {
        var banner = this.querySelector('[data-cart-error-banner]');
        if (banner) {
          var bannerText = banner.querySelector('[data-cart-error-text]') || banner.querySelector('.cart-drawer__error-text');
          var bannerIcon = banner.querySelector('.cart-drawer__error-icon');
          if (!bannerIcon || !bannerText) {
            banner.innerHTML = getErrorIconHtml() + ' <span class="cart-drawer__error-text" data-cart-error-text>' + message + '</span>';
          } else {
            bannerText.textContent = message;
          }
          banner.classList.remove('hidden');
          setTimeout(function () {
            banner.classList.add('hidden');
          }, 5000);
        }
      }
    }

    clearItemError(key) {
      if (key) {
        var cleanKey = String(key || '');
        var variantId = cleanKey.split(':')[0];
        var item = this.querySelector('[data-item-key="' + cleanKey + '"]') ||
                   (variantId ? this.querySelector('[data-cart-item][data-variant-id="' + variantId + '"]') : null);
        if (item) {
          var errorEl = item.querySelector('[data-item-error]');
          if (errorEl) errorEl.classList.add('hidden');
        }
      }
      var banner = this.querySelector('[data-cart-error-banner]');
      if (banner) banner.classList.add('hidden');
    }

    async updateQuantity(key, quantity) {
      this.classList.add('is-loading');
      this.clearItemError(key);

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
            quantity: quantity,
            sections: 'cart-drawer'
          })
        });

        var responseData = await response.json();

        if (!response.ok) {
          var errorMsg = responseData.description || responseData.message || responseData.errors || 'Could not update quantity';

          // When 422 happens, Shopify might have capped quantity or kept existing.
          // Refresh the drawer to sync the HTML and input values with the actual cart state.
          await this.refresh(this.isOpen);

          // Show the error message to the user
          this.showItemError(key, errorMsg);

          document.dispatchEvent(
            new CustomEvent('cart:updated', {
              detail: {
                openDrawer: false
              },
              bubbles: true
            })
          );
          return;
        }

        // Response is 200 OK
        if (responseData.sections && responseData.sections['cart-drawer']) {
          this.renderContents(responseData, this.isOpen);
        } else {
          await this.refresh(this.isOpen);
        }

        // Check if Shopify silently capped the item quantity
        if (responseData.items && Array.isArray(responseData.items)) {
          var matchedItem = responseData.items.find(function (it) {
            return it.key === key || it.id === parseInt(key, 10);
          });
          if (matchedItem && matchedItem.quantity < quantity) {
            this.showItemError(key, 'Only ' + matchedItem.quantity + ' items were added to your cart due to availability.');
          }
        }

        document.dispatchEvent(
          new CustomEvent('cart:updated', {
            detail: {
              cart: responseData,
              sections: responseData.sections,
              openDrawer: false
            },
            bubbles: true
          })
        );
      } catch (err) {
        console.error('Error changing quantity:', err);
        await this.refresh(this.isOpen);
        this.showItemError(key, err.message || 'Could not update quantity');
      } finally {
        this.classList.remove('is-loading');
      }
    }

    async saveNote(note) {
      try {
        await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ note: note })
        });
      } catch (err) {
        console.error('Failed to save cart note:', err);
      }
    }
  }

  if (!customElements.get('cart-drawer')) {
    customElements.define('cart-drawer', CartDrawer);
  }

  // Expose CartDrawer API globally
  window.CartDrawer = {
    open: function () {
      var isCartPage = window.location.pathname.endsWith('/cart') || Boolean(document.querySelector('[data-cart-page-section]'));
      if (isCartPage) return;
      var drawer = document.querySelector('cart-drawer');
      if (drawer) drawer.open();
    },
    close: function () {
      var drawer = document.querySelector('cart-drawer');
      if (drawer) drawer.close();
    },
    toggle: function () {
      var isCartPage = window.location.pathname.endsWith('/cart') || Boolean(document.querySelector('[data-cart-page-section]'));
      if (isCartPage) return;
      var drawer = document.querySelector('cart-drawer');
      if (drawer) drawer.toggle();
    },
    refresh: function (openDrawer) {
      var drawer = document.querySelector('cart-drawer');
      if (drawer) return drawer.refresh(openDrawer);
    },
    renderContents: function (response, openDrawer) {
      var drawer = document.querySelector('cart-drawer');
      if (drawer) drawer.renderContents(response, openDrawer);
    }
  };
})();
