/**
 * Header Search Component - CartPerksFlow Theme
 * Handles Current (Modal) & Drawer Search Layouts, Recommended Collection,
 * and Predictive AJAX live search with in-memory caching.
 */

if (!customElements.get('header-search')) {
  customElements.define(
    'header-search',
    class HeaderSearch extends HTMLElement {
      constructor() {
        super();

        this.searchType = this.dataset.searchType || 'predictive';
        this.searchLayout = this.dataset.searchLayout || 'current';
        this.productsLayout = this.dataset.productsLayout || 'grid';
        this.showImage = this.dataset.showImage !== 'false';
        this.showVendor = this.dataset.showVendor === 'true';
        this.enableAddToCart = this.dataset.enableAddToCart !== 'false';

        this.form = this.querySelector('[data-search-form]');
        this.input = this.querySelector('[data-search-input]');
        this.clearBtn = this.querySelector('[data-search-clear]');
        this.resultsContainer = this.querySelector('[data-search-results]');
        this.resultsContent = this.querySelector('[data-search-content]');
        this.loadingEl = this.querySelector('[data-search-loading]');
        this.recommendedContainer = this.querySelector('[data-search-recommended]');
        this.closeButtons = this.querySelectorAll('[data-search-close]');

        this.cache = {};
        this.productCache = {};
        this.debounceTimer = null;
        this.abortController = null;
        this.isOpen = false;

        this.bindEvents();
      }

      connectedCallback() {
        // Global search triggers (e.g. In header)
        document.addEventListener('click', this.handleTriggerClick.bind(this));
      }

      bindEvents() {
        // Close buttons & overlay
        this.closeButtons.forEach((btn) => {
          btn.addEventListener('click', () => this.close());
        });

        // Slider navigation buttons
        this.addEventListener('click', (e) => {
          var prevBtn = e.target.closest('[data-slider-prev]');
          if (prevBtn) {
            var section = prevBtn.closest('.header-search__recommended, .header-search__products') || this;
            var track = section.querySelector('[data-slider-track]');
            if (track) {
              track.scrollBy({ left: -220, behavior: 'smooth' });
            }
            return;
          }

          var nextBtn = e.target.closest('[data-slider-next]');
          if (nextBtn) {
            var section = nextBtn.closest('.header-search__recommended, .header-search__products') || this;
            var track = section.querySelector('[data-slider-track]');
            if (track) {
              track.scrollBy({ left: 220, behavior: 'smooth' });
            }
            return;
          }

          // Variant pill selection
          var pill = e.target.closest('.header-search__variant-pill');
          if (pill) {
            e.preventDefault();
            e.stopPropagation();
            var card = pill.closest('.header-search__product-card');
            if (!card) return;

            var variantId = pill.getAttribute('data-variant-id');
            var variantPrice = pill.getAttribute('data-variant-price');
            var variantCompare = pill.getAttribute('data-variant-compare');

            card.querySelectorAll('.header-search__variant-pill').forEach((p) => p.classList.remove('is-active'));
            pill.classList.add('is-active');

            card.setAttribute('data-variant-id', variantId);
            var cartBtn = card.querySelector('[data-quick-add-btn]');
            if (cartBtn) {
              cartBtn.setAttribute('data-variant-id', variantId);
              cartBtn.disabled = pill.hasAttribute('disabled');
            }

            var regPriceEl = card.querySelector('[data-price-regular]');
            if (regPriceEl && variantPrice) {
              regPriceEl.textContent = variantPrice;
            }
            var cmpPriceEl = card.querySelector('[data-price-compare]');
            if (cmpPriceEl) {
              if (variantCompare) {
                cmpPriceEl.textContent = variantCompare;
                cmpPriceEl.style.display = '';
              } else {
                cmpPriceEl.style.display = 'none';
              }
            }
            return;
          }

          // Quick Add to cart button
          var quickAddBtn = e.target.closest('[data-quick-add-btn]');
          if (quickAddBtn) {
            e.preventDefault();
            e.stopPropagation();
            this.handleQuickAdd(quickAddBtn);
            return;
          }
        });

        // Hover on card to load variants for predictive search results
        this.addEventListener('mouseover', (e) => {
          var card = e.target.closest('.header-search__product-card');
          if (card && card.dataset.productHandle && !card.dataset.variantsLoaded) {
            this.loadProductVariants(card);
          }
        });

        // Clear query button
        if (this.clearBtn && this.input) {
          this.clearBtn.addEventListener('click', () => {
            this.input.value = '';
            this.input.focus();
            this.toggleClearButton();
            this.hideResults();
          });
        }

        // Input events
        if (this.input) {
          this.input.addEventListener('input', () => {
            this.toggleClearButton();
            if (this.searchType === 'predictive') {
              this.onQueryChange();
            }
          });

          this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              this.close();
            }
          });
        }

        // Keydown on modal/drawer
        this.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            this.close();
          }
        });
      }

      handleTriggerClick(e) {
        var trigger = e.target.closest('[data-header-search-trigger]');
        if (trigger) {
          e.preventDefault();
          this.open(trigger);
        }
      }

      open(trigger) {
        this.lastActiveElement = trigger || document.activeElement;
        this.removeAttribute('hidden');
        this.isOpen = true;

        // Force reflow for smooth animation
        this.offsetHeight;
        this.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        document.body.classList.add('overflow-hidden');

        // Reset display to recommended if input is empty
        if (!this.input || !this.input.value.trim()) {
          this.hideResults();
          if (this.recommendedContainer) {
            this.recommendedContainer.classList.remove('hidden');
          }
        }

        setTimeout(() => {
          if (this.input) {
            this.input.focus();
            if (this.input.value) {
              this.input.select();
            }
          }
        }, 80);
      }

      close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.classList.remove('is-open');
        document.body.style.overflow = '';
        document.body.classList.remove('overflow-hidden');

        setTimeout(() => {
          this.setAttribute('hidden', '');
          if (this.lastActiveElement && typeof this.lastActiveElement.focus === 'function') {
            this.lastActiveElement.focus();
          }
        }, 250);
      }

      toggleClearButton() {
        if (!this.clearBtn || !this.input) return;
        var hasText = this.input.value.trim().length > 0;
        this.clearBtn.classList.toggle('hidden', !hasText);
      }

      onQueryChange() {
        var query = this.input.value.trim();

        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }

        if (query.length < 2) {
          this.hideResults();
          return;
        }

        // Hide recommended when searching
        if (this.recommendedContainer) {
          this.recommendedContainer.classList.add('hidden');
        }

        this.debounceTimer = setTimeout(() => {
          this.fetchResults(query);
        }, 220);
      }

      hideResults() {
        if (this.resultsContainer) {
          this.resultsContainer.classList.add('hidden');
        }
        if (this.resultsContent) {
          this.resultsContent.innerHTML = '';
        }
        if (this.loadingEl) {
          this.loadingEl.classList.add('hidden');
        }
        if (this.input) {
          this.input.setAttribute('aria-expanded', 'false');
        }
        if (this.recommendedContainer) {
          this.recommendedContainer.classList.remove('hidden');
        }
      }

      async fetchResults(query) {
        if (this.cache[query]) {
          this.renderResults(query, this.cache[query]);
          return;
        }

        if (this.abortController) {
          this.abortController.abort();
        }
        this.abortController = new AbortController();

        if (this.resultsContainer) {
          this.resultsContainer.classList.remove('hidden');
        }
        if (this.loadingEl) {
          this.loadingEl.classList.remove('hidden');
        }
        if (this.resultsContent) {
          this.resultsContent.classList.add('hidden');
        }

        try {
          var url = '/search/suggest.json?q=' + encodeURIComponent(query) +
            '&resources[type]=product,article,page,query' +
            '&resources[options][unavailable_products]=last' +
            '&resources[options][fields]=title,product_type,variants.title';

          var response = await fetch(url, {
            signal: this.abortController.signal,
            headers: {
              Accept: 'application/json'
            }
          });

          if (!response.ok) throw new Error('Search request failed');

          var data = await response.json();
          this.cache[query] = data;

          // Only render if query hasn't changed in the meantime
          if (this.input.value.trim() === query) {
            this.renderResults(query, data);
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.warn('Predictive search error:', err);
            if (this.loadingEl) this.loadingEl.classList.add('hidden');
          }
        }
      }

      renderResults(query, data) {
        if (!this.resultsContainer || !this.resultsContent) return;

        if (this.loadingEl) {
          this.loadingEl.classList.add('hidden');
        }
        this.resultsContent.classList.remove('hidden');
        this.input.setAttribute('aria-expanded', 'true');

        var results = (data && data.resources && data.resources.results) || {};
        var products = results.products || [];
        var queries = results.queries || [];
        var articles = results.articles || [];
        var pages = results.pages || [];

        var hasResults = products.length > 0 || queries.length > 0 || articles.length > 0 || pages.length > 0;

        if (!hasResults) {
          this.resultsContent.innerHTML =
            '<div class="header-search__empty">' +
            '<h3 class="header-search__empty-title">No results found</h3>' +
            '<p class="header-search__empty-text">No matches found for <strong>"' + this.escapeHtml(query) + '"</strong>. Try searching for different keywords.</p>' +
            '</div>';
          return;
        }

        var html = '';

        // 1. Query suggestions
        if (queries.length > 0) {
          html += '<div class="header-search__queries">' +
            '<h4 class="header-search__section-title">Suggestions</h4>' +
            '<ul class="header-search__queries-list">';
          queries.forEach((q) => {
            var text = q.styled_text || q.text;
            html += '<li>' +
              '<a href="' + q.url + '" class="header-search__query-chip">' +
              text +
              '</a>' +
              '</li>';
          });
          html += '</ul></div>';
        }

        // 2. Product matches
        if (products.length > 0) {
          var isSlider = this.productsLayout === 'slider';
          html += '<div class="header-search__products">';
          html += '<div class="header-search__section-header">' +
            '<h4 class="header-search__section-title">Products</h4>';
          if (isSlider && products.length > 1) {
            html += '<div class="header-search__slider-nav">' +
              '<button type="button" class="header-search__slider-arrow header-search__slider-arrow--prev" data-slider-prev aria-label="Previous">' +
              '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>' +
              '</button>' +
              '<button type="button" class="header-search__slider-arrow header-search__slider-arrow--next" data-slider-next aria-label="Next">' +
              '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
              '</button>' +
              '</div>';
          }
          html += '</div>';

          if (isSlider) {
            html += '<div class="header-search__slider-wrapper"><ul class="header-search__products-slider" data-slider-track>';
          } else {
            html += '<ul class="header-search__products-grid">';
          }

          products.forEach((product) => {
            var imgUrl = product.featured_image ? product.featured_image.url : (product.image || '');
            var price = product.price ? '$' + parseFloat(product.price).toFixed(2) : '';
            var compareAt = product.compare_at_price_max && parseFloat(product.compare_at_price_max) > parseFloat(product.price)
              ? '$' + parseFloat(product.compare_at_price_max).toFixed(2)
              : '';

            if (isSlider) {
              html += '<li class="header-search__slider-item">' +
                '<div class="header-search__product-card header-search__product-card--slider" data-product-handle="' + this.escapeHtml(product.handle) + '">' +
                (this.showImage && imgUrl ? '<a href="' + product.url + '" class="header-search__slider-thumb-wrap"><img src="' + imgUrl + '" alt="' + this.escapeHtml(product.title) + '" class="header-search__slider-thumb" width="160" height="160" loading="lazy"></a>' : '') +
                (this.enableAddToCart ?
                  '<button type="button" class="header-search__cart-btn" data-quick-add-btn aria-label="Add ' + this.escapeHtml(product.title) + ' to cart" title="Add to cart">' +
                  '<span class="header-search__cart-btn-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></span>' +
                  '<span class="header-search__cart-btn-spinner" aria-hidden="true"></span>' +
                  '</button>' : '') +
                '<div class="header-search__product-info">' +
                (this.showVendor && product.vendor ? '<span class="header-search__product-vendor">' + this.escapeHtml(product.vendor) + '</span>' : '') +
                '<h5 class="header-search__product-title"><a href="' + product.url + '">' + this.escapeHtml(product.title) + '</a></h5>' +
                '<div class="header-search__product-price" data-card-price>' +
                '<span data-price-regular>' + price + '</span>' +
                (compareAt ? '<span class="header-search__product-price-compare" data-price-compare>' + compareAt + '</span>' : '') +
                '</div>' +
                (this.enableAddToCart ? '<div class="header-search__variants" data-search-variants></div>' : '') +
                '</div>' +
                '</div>' +
                '</li>';
            } else {
              html += '<li>' +
                '<div class="header-search__product-card" data-product-handle="' + this.escapeHtml(product.handle) + '">' +
                (this.showImage && imgUrl ? '<a href="' + product.url + '" class="header-search__thumb-link"><img src="' + imgUrl + '" alt="' + this.escapeHtml(product.title) + '" class="header-search__product-thumb" width="62" height="62" loading="lazy"></a>' : '') +
                '<div class="header-search__product-info">' +
                (this.showVendor && product.vendor ? '<span class="header-search__product-vendor">' + this.escapeHtml(product.vendor) + '</span>' : '') +
                '<h5 class="header-search__product-title"><a href="' + product.url + '">' + this.escapeHtml(product.title) + '</a></h5>' +
                '<div class="header-search__product-price" data-card-price>' +
                '<span data-price-regular>' + price + '</span>' +
                (compareAt ? '<span class="header-search__product-price-compare" data-price-compare>' + compareAt + '</span>' : '') +
                '</div>' +
                (this.enableAddToCart ? '<div class="header-search__variants" data-search-variants></div>' : '') +
                '</div>' +
                (this.enableAddToCart ?
                  '<button type="button" class="header-search__cart-btn" data-quick-add-btn aria-label="Add ' + this.escapeHtml(product.title) + ' to cart" title="Add to cart">' +
                  '<span class="header-search__cart-btn-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></span>' +
                  '<span class="header-search__cart-btn-spinner" aria-hidden="true"></span>' +
                  '</button>' : '') +
                '</div>' +
                '</li>';
            }
          });

          html += '</ul>';
          if (isSlider) html += '</div>';
          html += '</div>';
        }

        // 3. Articles (Blog posts)
        if (articles.length > 0) {
          html += '<div class="header-search__articles">' +
            '<div class="header-search__section-header"><h4 class="header-search__section-title">Articles</h4></div>' +
            '<ul class="header-search__articles-list">';
          articles.forEach((art) => {
            html += '<li class="header-search__article-item">' +
              '<a href="' + art.url + '" class="header-search__article-link">' +
              (art.image ? '<img src="' + art.image + '" alt="' + this.escapeHtml(art.title) + '" class="header-search__article-thumb" width="44" height="44" loading="lazy">' : '') +
              '<div class="header-search__article-info">' +
              '<h5 class="header-search__article-title">' + this.escapeHtml(art.title) + '</h5>' +
              '</div>' +
              '</a>' +
              '</li>';
          });
          html += '</ul></div>';
        }

        // 4. Pages
        if (pages.length > 0) {
          html += '<div class="header-search__pages">' +
            '<div class="header-search__section-header"><h4 class="header-search__section-title">Pages</h4></div>' +
            '<ul class="header-search__pages-list">';
          pages.forEach((pg) => {
            html += '<li class="header-search__page-item">' +
              '<a href="' + pg.url + '" class="header-search__page-link">' +
              '<div class="header-search__page-info">' +
              '<h5 class="header-search__page-title">' + this.escapeHtml(pg.title) + '</h5>' +
              '</div>' +
              '</a>' +
              '</li>';
          });
          html += '</ul></div>';
        }

        // 5. View all link
        html += '<div class="header-search__footer">' +
          '<a href="/search?q=' + encodeURIComponent(query) + '" class="header-search__view-all-btn">' +
          '<span>View all results for "' + this.escapeHtml(query) + '"</span>' +
          '<svg class="icon-arrow-right" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12H20M20 12L16 8M20 12L16 16"></path></svg>' +
          '</a>' +
          '</div>';

        this.resultsContent.innerHTML = html;

        // Auto-load variants and variant IDs for visible cards
        if (this.enableAddToCart) {
          this.resultsContent.querySelectorAll('.header-search__product-card').forEach((card) => {
            this.loadProductVariants(card);
          });
        }
      }

      async handleQuickAdd(quickAddBtn) {
        var card = quickAddBtn.closest('.header-search__product-card');
        var variantId = quickAddBtn.getAttribute('data-variant-id') || (card && card.getAttribute('data-variant-id'));

        if (!variantId && card) {
          quickAddBtn.classList.add('is-loading');
          await this.loadProductVariants(card);
          variantId = card.getAttribute('data-variant-id');
        }

        if (!variantId) {
          quickAddBtn.classList.remove('is-loading');
          return;
        }

        quickAddBtn.classList.add('is-loading');

        try {
          var response = await fetch('/cart/add.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
              id: variantId,
              quantity: 1
            })
          });

          var data = await response.json();

          if (!response.ok) {
            throw new Error(data.description || data.message || 'Could not add product to cart');
          }

          // Close search dialog
          this.close();

          // Refresh and open cart drawer
          if (window.CartDrawer && typeof window.CartDrawer.refresh === 'function') {
            await window.CartDrawer.refresh(true);
          } else if (window.CartDrawer && typeof window.CartDrawer.open === 'function') {
            window.CartDrawer.open();
          } else {
            document.dispatchEvent(new CustomEvent('cart:updated', {
              bubbles: true,
              detail: { openDrawer: true }
            }));
          }
        } catch (err) {
          console.error('Error adding to cart from search:', err);
          alert(err.message || 'Could not add item to cart');
        } finally {
          quickAddBtn.classList.remove('is-loading');
        }
      }

      async loadProductVariants(card) {
        var handle = card.getAttribute('data-product-handle');
        if (!handle || card.dataset.variantsLoaded) return;
        card.dataset.variantsLoaded = 'true';

        var data = this.productCache[handle];
        if (!data) {
          try {
            var res = await fetch('/products/' + handle + '.js');
            if (res.ok) {
              data = await res.json();
              this.productCache[handle] = data;
            }
          } catch (e) {
            console.warn('Could not fetch variants for', handle, e);
          }
        }

        if (!data || !data.variants || data.variants.length === 0) return;

        var firstVariant = data.variants.find((v) => v.available) || data.variants[0];
        if (firstVariant) {
          card.setAttribute('data-variant-id', firstVariant.id);
          var cartBtn = card.querySelector('[data-quick-add-btn]');
          if (cartBtn) {
            cartBtn.setAttribute('data-variant-id', firstVariant.id);
            cartBtn.disabled = !firstVariant.available;
          }
        }

        if (data.variants.length > 1) {
          var variantsContainer = card.querySelector('[data-search-variants]');
          if (!variantsContainer) {
            variantsContainer = document.createElement('div');
            variantsContainer.className = 'header-search__variants';
            variantsContainer.setAttribute('data-search-variants', '');
            var info = card.querySelector('.header-search__product-info');
            if (info) info.appendChild(variantsContainer);
          }

          var pillsHtml = '';
          data.variants.slice(0, 5).forEach((v) => {
            var isAct = v.id === firstVariant.id;
            var isSold = !v.available;
            pillsHtml += '<button type="button" class="header-search__variant-pill' +
              (isAct ? ' is-active' : '') + (isSold ? ' is-sold-out' : '') + '"' +
              ' data-variant-id="' + v.id + '"' +
              ' data-variant-price="$' + (v.price / 100).toFixed(2) + '"' +
              (v.compare_at_price ? ' data-variant-compare="$' + (v.compare_at_price / 100).toFixed(2) + '"' : '') +
              (isSold ? ' disabled' : '') + '>' +
              this.escapeHtml(v.title) +
              '</button>';
          });
          variantsContainer.innerHTML = pillsHtml;
        }
      }

      escapeHtml(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }
    }
  );
}
