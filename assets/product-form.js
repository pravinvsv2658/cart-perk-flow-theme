/**
 * Product Form Global Component - CartPerksFlow Theme
 * Inspired by Shopify Dawn's <product-form> custom element
 * Handles AJAX Add-to-Cart globally and updates Cart Drawer via Shopify Section Rendering API
 */

(function () {
  'use strict';

  if (!customElements.get('product-form')) {
    customElements.define(
      'product-form',
      class ProductForm extends HTMLElement {
        constructor() {
          super();
          this.form = this.querySelector('form');
          if (this.form) {
            this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
          }
          this.submitButton = this.querySelector('[type="submit"]');
          this.submitButtonText = this.submitButton
            ? this.submitButton.querySelector('.product-card__btn-text') || this.submitButton
            : null;
        }

        async onSubmitHandler(evt) {
          evt.preventDefault();
          if (!this.form) return;

          var qvModal = this.closest('quick-view-modal') || document.querySelector('quick-view-modal.is-open');
          if (qvModal && typeof qvModal.clearError === 'function') {
            qvModal.clearError();
          }

          var submitBtn = this.submitButton || this.form.querySelector('[type="submit"]');
          var btnText = this.submitButtonText || (submitBtn ? submitBtn.querySelector('.product-card__btn-text') || submitBtn : null);
          var originalText = (btnText && btnText.textContent && btnText.textContent !== 'Error' && btnText.textContent !== 'Adding...')
            ? btnText.textContent
            : 'Add to cart';

          // Validate quantity input before submit
          var qtyInput = this.form.querySelector('[name="quantity"]');
          var qtyVal = qtyInput ? parseInt(qtyInput.value, 10) : 1;
          if (isNaN(qtyVal) || qtyVal < 1) {
            if (qvModal && typeof qvModal.showError === 'function') {
              qvModal.showError('Please enter a valid quantity of 1 or more.');
            }
            return;
          }

          if (submitBtn) {
            submitBtn.setAttribute('aria-disabled', 'true');
            submitBtn.disabled = true;
            submitBtn.classList.remove('is-added');
            submitBtn.classList.add('is-loading');
            if (btnText) btnText.textContent = 'Adding...';
          }

          var formData = new FormData(this.form);
          var cartDrawer = document.querySelector('cart-drawer');
          var cartType = (window.theme && window.theme.cartType) || 'drawer';

          if (cartType === 'drawer') {
            formData.append('sections', 'cart-drawer');
            formData.append('sections_url', window.location.pathname);
          }

          try {
            var response = await fetch('/cart/add.js', {
              method: 'POST',
              headers: {
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: formData
            });

            var responseData = await response.json();

            if (!response.ok) {
              throw new Error(responseData.description || responseData.message || 'Error adding to cart');
            }

            // If merchant set cart type to 'page', redirect to cart page
            if (cartType === 'page') {
              var cartUrl = (window.theme && window.theme.routes && window.theme.routes.cart_url) || '/cart';
              window.location.href = cartUrl;
              return;
            }

            // Drawer mode: update drawer contents using Shopify Section Rendering API
            if (cartDrawer && responseData.sections && responseData.sections['cart-drawer']) {
              cartDrawer.renderContents(responseData, true);
            } else if (cartDrawer) {
              await cartDrawer.refresh(true);
            } else if (window.CartDrawer) {
              window.CartDrawer.open();
            }

            // Dispatch global event for other components (e.g. cart page or badge counters)
            document.dispatchEvent(
              new CustomEvent('cart:updated', {
                detail: {
                  cart: responseData,
                  sections: responseData.sections,
                  variantId: responseData.id,
                  openDrawer: true
                },
                bubbles: true
              })
            );

            if (submitBtn) {
              submitBtn.classList.remove('is-loading');
              submitBtn.classList.add('is-added');
            }
            if (btnText) {
              btnText.textContent = 'Added! ';
            }

            setTimeout(function () {
              if (btnText) btnText.textContent = originalText;
              if (submitBtn) {
                submitBtn.removeAttribute('aria-disabled');
                submitBtn.disabled = false;
                submitBtn.classList.remove('is-added');
              }
            }, 1600);
          } catch (error) {
            console.error('Add to Cart error:', error);
            if (qvModal && typeof qvModal.showError === 'function') {
              qvModal.showError(error.message || 'Error adding to cart');
              if (btnText) btnText.textContent = originalText;
              if (submitBtn) {
                submitBtn.removeAttribute('aria-disabled');
                submitBtn.disabled = false;
                submitBtn.classList.remove('is-loading');
                submitBtn.classList.remove('is-added');
              }
            } else {
              if (btnText) btnText.textContent = 'Error';

              setTimeout(function () {
                if (btnText) btnText.textContent = originalText;
                if (submitBtn) {
                  submitBtn.removeAttribute('aria-disabled');
                  submitBtn.disabled = false;
                  submitBtn.classList.remove('is-loading');
                  submitBtn.classList.remove('is-added');
                }
              }, 1800);
            }
          }
        }
      }
    );
  }

  // Global delegated handler for any un-wrapped add-to-cart forms (e.g. data-product-form)
  document.addEventListener('submit', async function (e) {
    var form = e.target;
    if (!form || !form.matches) return;

    // Skip if handled by <product-form>
    if (form.closest('product-form')) return;

    var isCartAddForm =
      form.hasAttribute('data-product-form') ||
      (form.action && (form.action.endsWith('/cart/add') || form.action.includes('/cart/add')));

    if (!isCartAddForm) return;

    e.preventDefault();

    var qvModal = form.closest('quick-view-modal') || document.querySelector('quick-view-modal.is-open');
    if (qvModal && typeof qvModal.clearError === 'function') {
      qvModal.clearError();
    }

    var submitBtn = form.querySelector('[type="submit"]');
    var btnText = submitBtn ? submitBtn.querySelector('.product-card__btn-text') || submitBtn : null;
    var originalText = (btnText && btnText.textContent && btnText.textContent !== 'Error' && btnText.textContent !== 'Adding...')
      ? btnText.textContent
      : 'Add to cart';

    // Validate quantity input before submit
    var qtyInput = form.querySelector('[name="quantity"]');
    var qtyVal = qtyInput ? parseInt(qtyInput.value, 10) : 1;
    if (isNaN(qtyVal) || qtyVal < 1) {
      if (qvModal && typeof qvModal.showError === 'function') {
        qvModal.showError('Please enter a valid quantity of 1 or more.');
      }
      return;
    }

    if (submitBtn) {
      submitBtn.setAttribute('aria-disabled', 'true');
      submitBtn.disabled = true;
      submitBtn.classList.remove('is-added');
      submitBtn.classList.add('is-loading');
      if (btnText) btnText.textContent = 'Adding...';
    }

    var formData = new FormData(form);
    var cartDrawer = document.querySelector('cart-drawer');
    var cartType = (window.theme && window.theme.cartType) || 'drawer';

    if (cartType === 'drawer') {
      formData.append('sections', 'cart-drawer');
      formData.append('sections_url', window.location.pathname);
    }

    try {
      var response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
      });

      var responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.description || responseData.message || 'Error adding to cart');
      }

      if (cartType === 'page') {
        var cartUrl = (window.theme && window.theme.routes && window.theme.routes.cart_url) || '/cart';
        window.location.href = cartUrl;
        return;
      }

      if (cartDrawer && responseData.sections && responseData.sections['cart-drawer']) {
        cartDrawer.renderContents(responseData, true);
      } else if (cartDrawer) {
        await cartDrawer.refresh(true);
      } else if (window.CartDrawer) {
        window.CartDrawer.open();
      }

      document.dispatchEvent(
        new CustomEvent('cart:updated', {
          detail: {
            cart: responseData,
            sections: responseData.sections,
            variantId: responseData.id,
            openDrawer: true
          },
          bubbles: true
        })
      );

      if (submitBtn) {
        submitBtn.classList.remove('is-loading');
        submitBtn.classList.add('is-added');
      }
      if (btnText) btnText.textContent = 'Added!';

      setTimeout(function () {
        if (btnText) btnText.textContent = originalText;
        if (submitBtn) {
          submitBtn.removeAttribute('aria-disabled');
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-added');
        }
      }, 1600);
    } catch (err) {
      console.error('Add to Cart error:', err);
      if (qvModal && typeof qvModal.showError === 'function') {
        qvModal.showError(err.message || 'Error adding to cart');
        if (btnText) btnText.textContent = originalText;
        if (submitBtn) {
          submitBtn.removeAttribute('aria-disabled');
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-loading');
          submitBtn.classList.remove('is-added');
        }
      } else {
        if (btnText) btnText.textContent = 'Error';
        setTimeout(function () {
          if (btnText) btnText.textContent = originalText;
          if (submitBtn) {
            submitBtn.removeAttribute('aria-disabled');
            submitBtn.disabled = false;
            submitBtn.classList.remove('is-loading');
            submitBtn.classList.remove('is-added');
          }
        }, 1800);
      }
    }
  });
})();
