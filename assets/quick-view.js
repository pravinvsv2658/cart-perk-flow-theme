/**
 * Quick View Controller - CartPerksFlow Theme
 * Handles AJAX product fetch, multi-variant switching, image gallery,
 * and add-to-cart in Center Popup, Left Drawer, or Right Drawer mode
 */

(function () {
  'use strict';

  function formatMoney(cents) {
    return (window.theme && typeof window.theme.formatMoney === 'function')
      ? window.theme.formatMoney(cents)
      : '$' + (cents / 100).toFixed(2);
  }

  function getColorHex(val) {
    if (window.theme && typeof window.theme.getColorHex === 'function') {
      return window.theme.getColorHex(val);
    }
    return '#cbd5e1';
  }

  class QuickViewModal extends HTMLElement {
    constructor() {
      super();
      this.overlay = this.querySelector('[data-quick-view-close]');
      this.content = this.querySelector('[data-quick-view-content]');
      this.dialog = this.querySelector('.quick-view-modal__dialog');

      this.isOpen = false;
      this.currentProduct = null;
      this.selectedOptions = [];
      this.productCache = {};
      this.currentSlideIndex = 0;
      this.totalSlides = 0;
      this.productImages = [];

      this.bindEvents();
    }

    connectedCallback() {
      this.overlay = this.querySelector('[data-quick-view-close]');
      this.content = this.querySelector('[data-quick-view-content]');
      this.dialog = this.querySelector('.quick-view-modal__dialog');

      // Move to body to prevent clipping from parent overflow:hidden or stacking contexts
      if (this.parentElement && this.parentElement !== document.body) {
        document.body.appendChild(this);
      }
    }

    bindEvents() {
      var self = this;

      // Close on close button or overlay click
      this.addEventListener('click', function (e) {
        if (e.target.closest('[data-quick-view-close]')) {
          e.preventDefault();
          self.close();
          return;
        }

        // Slider Prev Arrow
        if (e.target.closest('[data-qv-slider-prev]')) {
          e.preventDefault();
          self.prevSlide();
          return;
        }

        // Slider Next Arrow
        if (e.target.closest('[data-qv-slider-next]')) {
          e.preventDefault();
          self.nextSlide();
          return;
        }

        // Slider Dot click
        var dot = e.target.closest('[data-slide-dot]');
        if (dot) {
          e.preventDefault();
          var slideIdx = parseInt(dot.getAttribute('data-slide-dot'), 10);
          self.goToSlide(slideIdx);
          return;
        }

        // Thumbnail click
        var thumb = e.target.closest('[data-qv-thumb]');
        if (thumb) {
          e.preventDefault();
          var thumbIdx = parseInt(thumb.getAttribute('data-thumb-index'), 10);
          if (!isNaN(thumbIdx)) {
            self.goToSlide(thumbIdx);
          } else {
            var imgSrc = thumb.getAttribute('data-img-src');
            self.slideToImageSrc(imgSrc);
          }
          return;
        }

        // Variant pill / swatch click
        var pill = e.target.closest('[data-qv-option]');
        if (pill) {
          e.preventDefault();
          var optIndex = parseInt(pill.getAttribute('data-option-index'), 10);
          var val = pill.getAttribute('data-value');
          self.selectOption(optIndex, val);
          return;
        }

        // Quantity Stepper
        var qtyBtn = e.target.closest('[data-qv-qty]');
        if (qtyBtn) {
          e.preventDefault();
          self.clearError();
          var action = qtyBtn.getAttribute('data-qv-qty');
          var input = self.querySelector('[data-qv-qty-input]');
          var hiddenQty = self.querySelector('[data-qv-hidden-qty]');
          if (input) {
            var curr = parseInt(input.value, 10) || 1;
            var next = action === 'increase' ? curr + 1 : Math.max(1, curr - 1);
            input.value = next;
            if (hiddenQty) hiddenQty.value = next;
          }
          return;
        }
      });

      // Dropdown option change listener
      this.addEventListener('change', function (e) {
        var select = e.target.closest('[data-qv-select]');
        if (select) {
          self.clearError();
          var optIdx = parseInt(select.getAttribute('data-option-index'), 10);
          self.selectOption(optIdx, select.value);
        }
      });

      // Escape key to close
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && self.isOpen) {
          self.close();
        }
      });

      // Listen for cart:updated to close quick view after item is successfully added
      document.addEventListener('cart:updated', function (e) {
        if (self.isOpen && e.detail && e.detail.openDrawer) {
          self.close();
        }
      });
    }

    showError(message) {
      var errorEl = this.querySelector('[data-qv-error]');
      if (!errorEl) {
        var actionsEl = this.querySelector('.quick-view-modal__actions');
        if (actionsEl && actionsEl.parentNode) {
          errorEl = document.createElement('div');
          errorEl.className = 'quick-view-modal__error hidden';
          errorEl.setAttribute('data-qv-error', '');
          errorEl.setAttribute('role', 'alert');
          errorEl.innerHTML =
            '<span class="quick-view-modal__error-icon" aria-hidden="true">' +
            '<svg class="icon-warning" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>' +
            '</span>' +
            '<span class="quick-view-modal__error-text" data-qv-error-text></span>';
          actionsEl.parentNode.insertBefore(errorEl, actionsEl);
        }
      }

      if (errorEl) {
        var textEl = errorEl.querySelector('[data-qv-error-text]');
        if (textEl) {
          textEl.textContent = message || 'Error adding to cart';
        } else {
          errorEl.textContent = message || 'Error adding to cart';
        }
        errorEl.classList.remove('hidden');

        if (typeof errorEl.scrollIntoView === 'function') {
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }

      var stepper = this.querySelector('.quick-view-modal__qty-stepper');
      if (stepper) {
        stepper.classList.add('has-error');
        setTimeout(function () {
          stepper.classList.remove('has-error');
        }, 500);
      }
    }

    clearError() {
      var errorEl = this.querySelector('[data-qv-error]');
      if (errorEl) {
        errorEl.classList.add('hidden');
        var textEl = errorEl.querySelector('[data-qv-error-text]');
        if (textEl) textEl.textContent = '';
      }
      var stepper = this.querySelector('.quick-view-modal__qty-stepper');
      if (stepper) {
        stepper.classList.remove('has-error');
      }
    }

    open(handle) {
      this.clearError();
      this.classList.add('is-open');
      this.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      this.isOpen = true;

      if (handle) {
        this.loadProduct(handle);
      }
    }

    close() {
      this.clearError();
      this.classList.remove('is-open');
      this.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      this.isOpen = false;
    }

    async loadProduct(handle) {
      if (this.productCache[handle]) {
        this.renderProduct(this.productCache[handle]);
        return;
      }

      this.showLoading();

      try {
        var res = await fetch('/products/' + handle + '.js');
        if (!res.ok) throw new Error('Product fetch failed');
        var product = await res.json();
        this.productCache[handle] = product;
        this.renderProduct(product);
      } catch (err) {
        console.error('Failed to load quick view product:', err);
        if (this.content) {
          this.content.innerHTML =
            '<div class="quick-view-modal__loading">' +
            '<p>Unable to load product preview. <a href="/products/' + handle + '">View product page</a></p>' +
            '</div>';
        }
      }
    }

    showLoading() {
      if (!this.content) return;
      this.content.innerHTML =
        '<div class="quick-view-modal__loading">' +
        '<div class="quick-view-modal__spinner" aria-hidden="true"></div>' +
        '<p class="quick-view-modal__loading-text">Loading product details...</p>' +
        '</div>';
    }

    renderProduct(product) {
      this.currentProduct = product;
      if (!this.content) return;

      var self = this;

      // Find first available variant, or first variant
      var initialVariant = product.variants.find(function (v) { return v.available; }) || product.variants[0];
      this.selectedOptions = initialVariant ? [].concat(initialVariant.options) : [];

      // Collect images
      var images = [];
      if (Array.isArray(product.images) && product.images.length > 0) {
        images = product.images;
      } else if (product.featured_image) {
        images = [product.featured_image];
      }
      this.productImages = images;
      this.totalSlides = images.length;
      this.currentSlideIndex = 0;

      // Build Image Slider HTML
      var sliderHtml = '';
      if (images.length === 0) {
        sliderHtml = '<div class="quick-view-modal__placeholder"></div>';
      } else {
        sliderHtml += '<div class="quick-view-modal__slider-track" data-qv-slider-track style="transform: translateX(0%);">';
        for (var i = 0; i < images.length; i++) {
          var img = images[i];
          var isActive = i === 0 ? 'is-active' : '';
          sliderHtml +=
            '<div class="quick-view-modal__slide ' + isActive + '" data-slide-index="' + i + '" data-img-src="' + img + '">' +
            '<img src="' + img + '" alt="' + (product.title || '') + '" class="quick-view-modal__image" ' + (i === 0 ? 'data-qv-main-image' : '') + ' loading="' + (i === 0 ? 'eager' : 'lazy') + '">' +
            '</div>';
        }
        sliderHtml += '</div>';

        // Add controls if multiple images
        if (images.length > 1) {
          sliderHtml +=
            '<button type="button" class="quick-view-modal__slider-arrow quick-view-modal__slider-arrow--prev" data-qv-slider-prev aria-label="Previous image">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>' +
            '</button>' +
            '<button type="button" class="quick-view-modal__slider-arrow quick-view-modal__slider-arrow--next" data-qv-slider-next aria-label="Next image">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>' +
            '</button>' +
            '<div class="quick-view-modal__slider-dots" data-qv-slider-dots>';
          for (var d = 0; d < images.length; d++) {
            sliderHtml += '<button type="button" class="quick-view-modal__slider-dot ' + (d === 0 ? 'is-active' : '') + '" data-slide-dot="' + d + '" aria-label="Image ' + (d + 1) + '"></button>';
          }
          sliderHtml +=
            '</div>' +
            '<div class="quick-view-modal__slider-counter" data-qv-slider-counter>1 / ' + images.length + '</div>';
        }
      }

      // Build Thumbnails HTML
      var thumbsHtml = '';
      if (images.length > 1) {
        thumbsHtml += '<div class="quick-view-modal__thumbnails">';
        for (var t = 0; t < images.length; t++) {
          var tImg = images[t];
          var isThumbActive = t === 0 ? 'is-active' : '';
          thumbsHtml +=
            '<button type="button" class="quick-view-modal__thumb ' + isThumbActive + '" data-qv-thumb data-thumb-index="' + t + '" data-img-src="' + tImg + '" aria-label="Thumbnail ' + (t + 1) + '">' +
            '<img src="' + tImg + '" alt="' + (product.title || '') + '" loading="lazy">' +
            '</button>';
        }
        thumbsHtml += '</div>';
      }

      // Helper to check if variant has an image for a specific option value
      function getVariantImageForOption(prod, optIdx, val) {
        if (!prod || !prod.variants) return null;
        for (var vi = 0; vi < prod.variants.length; vi++) {
          var vObj = prod.variants[vi];
          if (vObj.options && vObj.options[optIdx] === val) {
            if (vObj.featured_image) {
              var s = vObj.featured_image.src || (typeof vObj.featured_image === 'string' ? vObj.featured_image : null);
              if (s) return s;
            }
          }
        }
        return null;
      }

      // Read variant style: 'dropdown' or 'swatches'
      var variantStyle = this.getAttribute('data-variant-style') || 'swatches';

      // Build Option Groups HTML
      var optionsHtml = '';
      if (product.options && product.options.length > 0 && !(product.options.length === 1 && product.options[0].name === 'Title')) {
        optionsHtml += '<div class="quick-view-modal__options quick-view-modal__options--' + variantStyle + '">';
        for (var o = 0; o < product.options.length; o++) {
          var opt = product.options[o];
          var optName = opt.name;
          var selectedVal = this.selectedOptions[o] || (opt.values && opt.values[0]);
          var isColor = /color|colour/i.test(optName);

          if (variantStyle === 'dropdown') {
            // Dropdown mode
            optionsHtml +=
              '<div class="quick-view-modal__option-group quick-view-modal__option-group--select" data-option-group="' + o + '">' +
              '<label class="quick-view-modal__option-header" for="QuickViewSelect-' + o + '">' +
              optName + ': <span data-option-header-val="' + o + '">' + selectedVal + '</span>' +
              '</label>' +
              '<div class="quick-view-modal__select-wrapper">' +
              '<select id="QuickViewSelect-' + o + '" class="quick-view-modal__select" data-qv-select data-option-index="' + o + '" aria-label="' + optName + '">';
            for (var valIdx = 0; valIdx < opt.values.length; valIdx++) {
              var valItem = opt.values[valIdx];
              var isSelected = valItem === selectedVal ? 'selected' : '';
              optionsHtml += '<option value="' + valItem + '" ' + isSelected + '>' + valItem + '</option>';
            }
            optionsHtml +=
              '</select>' +
              '<span class="quick-view-modal__select-icon" aria-hidden="true">' +
              '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M6 9l6 6 6-6"/></svg>' +
              '</span>' +
              '</div>' +
              '</div>';
          } else {
            // Swatches for Color option, Rectangle Pills for other options
            optionsHtml +=
              '<div class="swatch-group quick-view-modal__option-group" data-option-group="' + o + '">' +
              '<div class="swatch-group__header quick-view-modal__option-header">' +
              '<span class="swatch-group__label">' + optName + ':</span> ' +
              '<span class="swatch-group__selected" data-option-header-val="' + o + '" data-selected-value>' + selectedVal + '</span>' +
              '</div>' +
              '<div class="swatch-group__values swatch-group__values--' + (isColor ? 'color' : 'pill') + ' quick-view-modal__option-values">';

            for (var v = 0; v < opt.values.length; v++) {
              var val = opt.values[v];
              var isPillActive = val === selectedVal ? 'is-active' : '';

              if (isColor) {
                // Color option: Render color swatch (image swatch if variant has image, else color swatch)
                var variantImg = getVariantImageForOption(product, o, val);
                var hex = (window.theme && typeof window.theme.getColorHex === 'function')
                  ? window.theme.getColorHex(val)
                  : getColorHex(val);

                if (variantImg) {
                  optionsHtml +=
                    '<button type="button" class="swatch swatch--color swatch--image quick-view-modal__swatch quick-view-modal__swatch--image ' + isPillActive + '" ' +
                    'data-swatch-btn data-qv-option data-option-index="' + o + '" data-value="' + val + '" ' +
                    'style="background-image: url(\'' + variantImg + '\'); --swatch-color: ' + hex + ';" ' +
                    'title="' + val + '" aria-label="' + val + '">' +
                    '<span class="swatch__inner swatch__inner--image quick-view-modal__swatch-inner" style="background-image: url(\'' + variantImg + '\');"></span>' +
                    '<span class="swatch__tooltip quick-view-modal__swatch-tooltip">' + val + '</span>' +
                    '</button>';
                } else {
                  optionsHtml +=
                    '<button type="button" class="swatch swatch--color quick-view-modal__swatch ' + isPillActive + '" ' +
                    'data-swatch-btn data-qv-option data-option-index="' + o + '" data-value="' + val + '" ' +
                    'style="background-color: ' + hex + '; --swatch-color: ' + hex + ';" title="' + val + '" aria-label="' + val + '">' +
                    '<span class="swatch__inner swatch__inner--color quick-view-modal__swatch-inner" style="background-color: ' + hex + ';"></span>' +
                    '<span class="swatch__tooltip quick-view-modal__swatch-tooltip">' + val + '</span>' +
                    '</button>';
                }
              } else {
                // Other options (Size, Material, Style, etc.): Show variant name in rounded pill
                optionsHtml +=
                  '<button type="button" class="swatch swatch--pill quick-view-modal__pill ' + isPillActive + '" ' +
                  'data-swatch-btn data-qv-option data-option-index="' + o + '" data-value="' + val + '" ' +
                  'aria-label="' + val + '">' +
                  '<span class="swatch__text">' + val + '</span>' +
                  '</button>';
              }
            }

            optionsHtml +=
              '</div>' +
              '</div>';
          }
        }
        optionsHtml += '</div>';
      }

      // Description excerpt
      var descSnippet = '';
      if (product.description) {
        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = product.description;
        var cleanText = tempDiv.textContent || tempDiv.innerText || '';
        descSnippet = cleanText.length > 180 ? cleanText.substring(0, 180) + '...' : cleanText;
      }

      var isOnSale = initialVariant && initialVariant.compare_at_price > initialVariant.price;
      var priceFormatted = initialVariant ? formatMoney(initialVariant.price) : '';
      var compareFormatted = isOnSale ? formatMoney(initialVariant.compare_at_price) : '';

      var isAvailable = initialVariant && initialVariant.available;
      var buttonText = isAvailable ? 'Add to cart' : 'Sold out';

      var html =
        '<div class="quick-view-modal__grid">' +
        '<div class="quick-view-modal__gallery">' +
        '<div class="quick-view-modal__image-wrapper" data-qv-slider>' +
        sliderHtml +
        '</div>' +
        thumbsHtml +
        '</div>' +

        '<div class="quick-view-modal__info">' +
        (product.vendor ? '<div class="quick-view-modal__vendor">' + product.vendor + '</div>' : '') +
        '<h2 class="quick-view-modal__title">' +
        '<a href="' + product.url + '">' + product.title + '</a>' +
        '</h2>' +

        '<div class="quick-view-modal__prices">' +
        '<span class="quick-view-modal__price" data-qv-price>' + priceFormatted + '</span>' +
        '<s class="quick-view-modal__compare-price ' + (isOnSale ? '' : 'hidden') + '" data-qv-compare-price>' + compareFormatted + '</s>' +
        '<span class="quick-view-modal__badge-sale ' + (isOnSale ? '' : 'hidden') + '" data-qv-sale-badge>Sale</span>' +
        '</div>' +

        (descSnippet ? '<div class="quick-view-modal__description">' + descSnippet + '</div>' : '') +

        optionsHtml +

        '<div class="quick-view-modal__error hidden" data-qv-error role="alert">' +
        '<span class="quick-view-modal__error-icon" aria-hidden="true">' +
        '<svg class="icon-warning" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>' +
        '</span>' +
        '<span class="quick-view-modal__error-text" data-qv-error-text></span>' +
        '</div>' +

        '<div class="quick-view-modal__actions">' +
        '<div class="quick-view-modal__qty-stepper">' +
        '<button type="button" class="quick-view-modal__qty-btn" data-qv-qty="decrease" aria-label="Decrease quantity">−</button>' +
        '<input type="number" class="quick-view-modal__qty-input" value="1" min="1" data-qv-qty-input aria-label="Quantity">' +
        '<button type="button" class="quick-view-modal__qty-btn" data-qv-qty="increase" aria-label="Increase quantity">+</button>' +
        '</div>' +

        '<product-form class="quick-view-modal__form">' +
        '<form action="/cart/add" method="post" enctype="multipart/form-data" data-product-form>' +
        '<input type="hidden" name="id" value="' + (initialVariant ? initialVariant.id : '') + '" data-qv-variant-id>' +
        '<input type="hidden" name="quantity" value="1" data-qv-hidden-qty>' +
        '<button type="submit" name="add" class="quick-view-modal__submit-btn" data-qv-submit ' + (isAvailable ? '' : 'disabled') + '>' +
        '<span class="product-card__btn-text">' + buttonText + '</span>' +
        '</button>' +
        '</form>' +
        '</product-form>' +
        '</div>' +

        '<a href="' + product.url + '" class="quick-view-modal__full-link"><span>View full product details</span> <svg class="icon-arrow-right" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12H20M20 12L16 8M20 12L16 16"></path></svg></a>' +
        '</div>' +
        '</div>';

      this.content.innerHTML = html;

      // Sync stepper with form hidden quantity
      var qtyInput = this.querySelector('[data-qv-qty-input]');
      var hiddenQty = this.querySelector('[data-qv-hidden-qty]');
      if (qtyInput && hiddenQty) {
        qtyInput.addEventListener('input', function () {
          self.clearError();
          hiddenQty.value = qtyInput.value;
        });
        qtyInput.addEventListener('change', function () {
          self.clearError();
          var val = parseInt(qtyInput.value, 10);
          if (isNaN(val) || val < 1) {
            qtyInput.value = 1;
            hiddenQty.value = 1;
          } else {
            hiddenQty.value = val;
          }
        });
      }

      // Bind touch swipe on the image slider
      this.bindSliderTouchEvents();

      // Slide to initial variant image if available
      if (initialVariant && initialVariant.featured_image && initialVariant.featured_image.src) {
        this.slideToImageSrc(initialVariant.featured_image.src);
      }
    }

    bindSliderTouchEvents() {
      var slider = this.querySelector('[data-qv-slider]');
      if (!slider) return;
      var self = this;
      var startX = 0;
      var startY = 0;
      var distX = 0;
      var distY = 0;

      slider.addEventListener('touchstart', function (e) {
        if (!e.touches || e.touches.length === 0) return;
        var touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        distX = 0;
        distY = 0;
      }, { passive: true });

      slider.addEventListener('touchmove', function (e) {
        if (!e.touches || e.touches.length > 1) return;
        var touch = e.touches[0];
        distX = touch.clientX - startX;
        distY = touch.clientY - startY;
        if (Math.abs(distX) > Math.abs(distY) && Math.abs(distX) > 10) {
          if (e.cancelable) e.preventDefault();
        }
      }, { passive: false });

      slider.addEventListener('touchend', function () {
        if (Math.abs(distX) > 40 && Math.abs(distX) > Math.abs(distY)) {
          if (distX < 0) {
            self.nextSlide();
          } else {
            self.prevSlide();
          }
        }
      }, { passive: true });
    }

    goToSlide(index) {
      if (this.totalSlides <= 1) return;
      var newIndex = (index + this.totalSlides) % this.totalSlides;
      this.currentSlideIndex = newIndex;

      var track = this.querySelector('[data-qv-slider-track]');
      if (track) {
        track.style.transform = 'translateX(-' + (newIndex * 100) + '%)';
      }

      var slides = this.querySelectorAll('.quick-view-modal__slide');
      slides.forEach(function (s, idx) {
        s.classList.toggle('is-active', idx === newIndex);
      });

      var dots = this.querySelectorAll('[data-slide-dot]');
      dots.forEach(function (d, idx) {
        d.classList.toggle('is-active', idx === newIndex);
      });

      var counter = this.querySelector('[data-qv-slider-counter]');
      if (counter) {
        counter.textContent = (newIndex + 1) + ' / ' + this.totalSlides;
      }

      var thumbs = this.querySelectorAll('[data-qv-thumb]');
      thumbs.forEach(function (t, idx) {
        t.classList.toggle('is-active', idx === newIndex);
      });
      if (thumbs[newIndex]) {
        thumbs[newIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }

    nextSlide() {
      this.goToSlide(this.currentSlideIndex + 1);
    }

    prevSlide() {
      this.goToSlide(this.currentSlideIndex - 1);
    }

    cleanImageUrl(url) {
      if (!url) return '';
      return url.replace(/^https?:/, '').split('?')[0];
    }

    slideToImageSrc(src) {
      if (!src || this.totalSlides <= 1) return;
      var cleanTarget = this.cleanImageUrl(src);
      var slides = this.querySelectorAll('.quick-view-modal__slide');
      for (var i = 0; i < slides.length; i++) {
        var slideSrc = slides[i].getAttribute('data-img-src');
        if (slideSrc && this.cleanImageUrl(slideSrc) === cleanTarget) {
          this.goToSlide(i);
          return;
        }
      }
    }

    selectOption(optIndex, value) {
      this.clearError();
      this.selectedOptions[optIndex] = value;

      var group = this.querySelector('[data-option-group="' + optIndex + '"]');
      if (group) {
        // Update pill/swatch active state
        var pills = group.querySelectorAll('[data-qv-option]');
        pills.forEach(function (p) {
          if (p.getAttribute('data-value') === value) {
            p.classList.add('is-active');
          } else {
            p.classList.remove('is-active');
          }
        });

        // Update select value if in dropdown mode
        var select = group.querySelector('[data-qv-select]');
        if (select && select.value !== value) {
          select.value = value;
        }

        var headerVal = group.querySelector('[data-option-header-val]');
        if (headerVal) headerVal.textContent = value;
      }

      this.updateVariantState();
    }

    updateVariantState() {
      if (!this.currentProduct) return;
      this.clearError();
      var self = this;

      // Find matching variant
      var matchedVariant = this.currentProduct.variants.find(function (v) {
        return v.options.every(function (optVal, idx) {
          return optVal === self.selectedOptions[idx];
        });
      });

      var priceEl = this.querySelector('[data-qv-price]');
      var compareEl = this.querySelector('[data-qv-compare-price]');
      var saleBadge = this.querySelector('[data-qv-sale-badge]');
      var variantInput = this.querySelector('[data-qv-variant-id]');
      var submitBtn = this.querySelector('[data-qv-submit]');
      var btnText = submitBtn ? submitBtn.querySelector('.product-card__btn-text') || submitBtn : null;

      if (!matchedVariant) {
        if (submitBtn) submitBtn.disabled = true;
        if (btnText) btnText.textContent = 'Unavailable';
        return;
      }

      // Update Variant ID
      if (variantInput) variantInput.value = matchedVariant.id;

      // Update Price
      if (priceEl) priceEl.textContent = formatMoney(matchedVariant.price);

      var isOnSale = matchedVariant.compare_at_price > matchedVariant.price;
      if (compareEl) {
        compareEl.textContent = isOnSale ? formatMoney(matchedVariant.compare_at_price) : '';
        compareEl.classList.toggle('hidden', !isOnSale);
      }
      if (saleBadge) {
        saleBadge.classList.toggle('hidden', !isOnSale);
      }

      // Slide to image if variant has a featured image
      if (matchedVariant.featured_image && matchedVariant.featured_image.src) {
        this.slideToImageSrc(matchedVariant.featured_image.src);
      }

      // Update Button State
      if (submitBtn) {
        submitBtn.disabled = !matchedVariant.available;
        if (btnText) {
          btnText.textContent = matchedVariant.available ? 'Add to cart' : 'Sold out';
        }
      }

      // Update options availability state (sold-out strikethrough) across other option groups
      if (this.currentProduct && this.currentProduct.variants) {
        var allGroups = this.querySelectorAll('[data-option-group]');
        allGroups.forEach(function (grp) {
          var grpIdx = parseInt(grp.getAttribute('data-option-group'), 10);
          var btns = grp.querySelectorAll('[data-qv-option]');
          btns.forEach(function (btn) {
            var btnVal = btn.getAttribute('data-value');
            var testSelections = self.selectedOptions.slice();
            testSelections[grpIdx] = btnVal;

            var testVariant = self.currentProduct.variants.find(function (v) {
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
    }
  }

  if (!customElements.get('quick-view-modal')) {
    customElements.define('quick-view-modal', QuickViewModal);
  }

  // Global delegation for opening quick view: [data-quick-view-trigger]
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-quick-view-trigger]');
    if (!trigger) return;
    e.preventDefault();

    var handle = trigger.getAttribute('data-product-handle');
    if (!handle) return;

    var section = trigger.closest('[data-section-id]');
    var modal = null;
    if (section) {
      var sectionId = section.getAttribute('data-section-id');
      modal = document.getElementById('QuickViewModal-' + sectionId) ||
        document.querySelector('quick-view-modal[data-section-id="' + sectionId + '"]');
    }
    if (!modal) {
      modal = document.querySelector('quick-view-modal');
    }

    if (modal && typeof modal.open === 'function') {
      modal.open(handle);
    }
  });

  // Expose QuickView API globally
  window.QuickView = {
    open: function (handle) {
      var modal = document.querySelector('quick-view-modal');
      if (modal) modal.open(handle);
    },
    close: function () {
      var modal = document.querySelector('quick-view-modal.is-open') || document.querySelector('quick-view-modal');
      if (modal) modal.close();
    }
  };
})();
