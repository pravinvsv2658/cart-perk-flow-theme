/**
 * Product Gallery Component - CartPerksFlow Theme
 * Powered by Slick Slider
 * Features:
 * - Synchronized Main Slider and Thumbnail Slider via Slick's asNavFor
 * - Native desktop mouse drag and mobile touch swiping via Slick
 * - Fullscreen Modal Lightbox Slider with counter and arrow controls
 * - Dynamic variant media switching on swatch selection
 */

(function () {
  'use strict';

  function whenSlickReady(callback) {
    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.slick) {
      callback(window.jQuery);
      return;
    }
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      if (window.jQuery && window.jQuery.fn && window.jQuery.fn.slick) {
        clearInterval(timer);
        callback(window.jQuery);
      } else if (attempts > 120) {
        clearInterval(timer);
        console.warn('Slick Slider CDN not loaded within timeout.');
      }
    }, 40);
  }

  function initProductGallery(galleryElement, $) {
    if (!galleryElement || galleryElement._galleryInitialized) return;
    galleryElement._galleryInitialized = true;

    var $gallery = $(galleryElement);
    var $mainTrack = $gallery.find('[data-gallery-track]');
    var $thumbsTrack = $gallery.find('[data-thumbnails-track]');
    var $modalTrack = $gallery.find('[data-modal-track]');
    var $modal = $gallery.find('[data-gallery-modal]');

    var initialSlide = parseInt($gallery.attr('data-initial-slide'), 10) || 0;
    var thumbPos = $gallery.attr('data-thumbnail-position') || 'bottom';
    var desktopLayout = $gallery.attr('data-desktop-layout') || 'slider';
    var mediaCount = parseInt($gallery.attr('data-media-count'), 10) || 1;
    var hasMultiple = mediaCount > 1;

    // 1. Initialize Main Slider (for slider layout or mobile viewports)
    function initMainSlider() {
      if ($mainTrack.length && !$mainTrack.hasClass('slick-initialized')) {
        $mainTrack.slick({
          slidesToShow: 1,
          slidesToScroll: 1,
          arrows: hasMultiple,
          prevArrow: $gallery.find('[data-gallery-prev]'),
          nextArrow: $gallery.find('[data-gallery-next]'),
          dots: false,
          fade: false,
          infinite: false,
          speed: 350,
          cssEase: 'cubic-bezier(0.25, 1, 0.5, 1)',
          asNavFor: desktopLayout === 'slider' && hasMultiple && $thumbsTrack.length ? $thumbsTrack : null,
          draggable: true,
          swipe: true,
          touchThreshold: 12,
          initialSlide: initialSlide,
          adaptiveHeight: false
        });
      }
    }

    // 2. Initialize Thumbnails Slider (when slider layout is active)
    function initThumbnailsSlider() {
      if (desktopLayout === 'slider' && hasMultiple && $thumbsTrack.length && !$thumbsTrack.hasClass('slick-initialized')) {
        var isVertical = (thumbPos === 'left' || thumbPos === 'right') && window.innerWidth >= 769;

        $thumbsTrack.slick({
          slidesToShow: isVertical ? 5 : 5,
          slidesToScroll: 1,
          asNavFor: $mainTrack.length ? $mainTrack : null,
          dots: false,
          arrows: true,
          prevArrow: $gallery.find('[data-thumbnail-prev]'),
          nextArrow: $gallery.find('[data-thumbnail-next]'),
          focusOnSelect: true,
          infinite: false,
          speed: 300,
          vertical: isVertical,
          verticalSwiping: isVertical,
          swipeToSlide: true,
          initialSlide: initialSlide,
          responsive: [
            {
              breakpoint: 1200,
              settings: {
                slidesToShow: 4,
                vertical: isVertical,
                verticalSwiping: isVertical
              }
            },
            {
              breakpoint: 768,
              settings: {
                slidesToShow: 4,
                vertical: false,
                verticalSwiping: false
              }
            }
          ]
        });
      }
    }

    // Initialize sliders according to layout mode
    if (desktopLayout === 'slider' || window.innerWidth < 769) {
      initMainSlider();
      initThumbnailsSlider();
    }

    // 3. Synchronize slide changes
    $mainTrack.on('afterChange', function (event, slick, currentSlide) {
      // Counter update
      $gallery.find('[data-counter-current]').text(currentSlide + 1);

      // Mobile dots
      $gallery.find('[data-dot-index]').removeClass('is-active').filter('[data-dot-index="' + currentSlide + '"]').addClass('is-active');

      // Thumbnail active state
      $thumbsTrack.find('.product-gallery__thumb').removeClass('is-active');
      $thumbsTrack.find('.product-gallery__thumb[data-thumb-index="' + currentSlide + '"]').addClass('is-active');

      // Sync modal if open & initialized
      if ($modalTrack.length && $modalTrack.hasClass('slick-initialized')) {
        $modalTrack.slick('slickGoTo', currentSlide, true);
        $gallery.find('[data-modal-counter-current]').text(currentSlide + 1);
      }
    });

    // Mobile dot clicks
    $gallery.find('[data-dot-index]').on('click', function (e) {
      e.preventDefault();
      var idx = parseInt($(this).attr('data-dot-index'), 10);
      if (!isNaN(idx) && $mainTrack.hasClass('slick-initialized')) {
        $mainTrack.slick('slickGoTo', idx);
      }
    });

    // Direct thumbnail clicks (fallback if asNavFor is decoupled)
    $gallery.on('click', '.product-gallery__thumb', function () {
      var idx = parseInt($(this).attr('data-thumb-index'), 10);
      if (!isNaN(idx) && $mainTrack.hasClass('slick-initialized')) {
        $mainTrack.slick('slickGoTo', idx);
      }
    });

    // 4. Modal Lightbox Slider Setup
    function initModalSlider() {
      if ($modalTrack.length && !$modalTrack.hasClass('slick-initialized')) {
        $modalTrack.slick({
          slidesToShow: 1,
          slidesToScroll: 1,
          arrows: hasMultiple,
          prevArrow: $gallery.find('[data-modal-prev]'),
          nextArrow: $gallery.find('[data-modal-next]'),
          dots: false,
          fade: false,
          infinite: false,
          speed: 300,
          draggable: true,
          swipe: true,
          touchThreshold: 12,
          initialSlide: initialSlide
        });

        $modalTrack.on('afterChange', function (e, slick, currentSlide) {
          $gallery.find('[data-modal-counter-current]').text(currentSlide + 1);
          if ($mainTrack.hasClass('slick-initialized')) {
            $mainTrack.slick('slickGoTo', currentSlide, true);
          }
        });
      }
    }

    // Helper to open modal lightbox at a specific slide
    function openModalAt(slideIdx) {
      $modal.addClass('is-open').attr('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      initModalSlider();

      setTimeout(function () {
        if ($modalTrack.hasClass('slick-initialized')) {
          $modalTrack.slick('setPosition');
          $modalTrack.slick('slickGoTo', slideIdx, true);
          $gallery.find('[data-modal-counter-current]').text(slideIdx + 1);
        }
      }, 50);
    }

    // Open Modal from main viewport zoom trigger
    $gallery.find('[data-gallery-zoom-trigger]').on('click', function (e) {
      e.preventDefault();
      var cur = $mainTrack.hasClass('slick-initialized') ? $mainTrack.slick('slickCurrentSlide') : 0;
      openModalAt(cur);
    });

    // Open Modal from desktop grid item or zoom trigger (for stacked / columns_2 layouts)
    $gallery.on('click', '.product-gallery__grid-item, [data-grid-zoom-trigger]', function (e) {
      // Don't trigger modal if interacting with native video/audio controls
      if ($(e.target).closest('video, audio').length && !$(e.target).closest('[data-grid-zoom-trigger]').length) {
        return;
      }
      e.preventDefault();
      var $item = $(this).closest('.product-gallery__grid-item');
      var slideIdx = parseInt($item.attr('data-grid-index'), 10) || 0;
      openModalAt(slideIdx);
    });

    // Close Modal
    function closeModal() {
      $modal.removeClass('is-open').attr('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    $gallery.find('[data-gallery-modal-close]').on('click', function (e) {
      e.preventDefault();
      closeModal();
    });

    // Keyboard Navigation in Modal
    $(document).on('keydown', function (e) {
      if (!$modal.hasClass('is-open')) return;

      if (e.key === 'Escape') {
        closeModal();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if ($modalTrack.hasClass('slick-initialized')) {
          $modalTrack.slick('slickPrev');
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if ($modalTrack.hasClass('slick-initialized')) {
          $modalTrack.slick('slickNext');
        }
      }
    });

    // Viewport keyboard navigation
    $gallery.find('[data-gallery-viewport]').on('keydown', function (e) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if ($mainTrack.hasClass('slick-initialized')) {
          $mainTrack.slick('slickPrev');
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if ($mainTrack.hasClass('slick-initialized')) {
          $mainTrack.slick('slickNext');
        }
      }
    });

    // 5. Variant Change Listener
    document.addEventListener('variant:change', function (e) {
      var variant = e.detail && e.detail.variant;
      if (!variant) return;

      var sectionId = e.detail && e.detail.sectionId;
      var closestSection = $gallery.closest('[data-section-id], .shopify-section');
      if (sectionId && closestSection.length) {
        var currentSecId = closestSection.attr('data-section-id') || (closestSection.attr('id') || '').replace('shopify-section-', '');
        if (currentSecId && currentSecId !== sectionId) return;
      }

      var mediaId = (variant.featured_media && variant.featured_media.id) || (variant.featured_image && variant.featured_image.id);
      var targetIdx = -1;

      if (mediaId) {
        // In desktop grid mode (stacked / 2 columns on desktop), smoothly scroll to the image
        if (desktopLayout !== 'slider' && window.innerWidth >= 769) {
          var $targetGridItem = $gallery.find('.product-gallery__grid-item[data-media-id="' + mediaId + '"]');
          if ($targetGridItem.length) {
            $('html, body').stop().animate({
              scrollTop: $targetGridItem.offset().top - 80
            }, 350);
          }
        }

        // In slider mode or mobile view, go to corresponding slide
        $mainTrack.find('.product-gallery__slide').each(function () {
          if ($(this).attr('data-media-id') == mediaId) {
            var idx = $(this).attr('data-slide-index') || $(this).data('slick-index');
            targetIdx = parseInt(idx, 10);
            return false;
          }
        });
      }

      if (targetIdx !== -1 && !isNaN(targetIdx) && $mainTrack.hasClass('slick-initialized')) {
        $mainTrack.slick('slickGoTo', targetIdx);
      }

      // Badges
      var isOnSale = variant.compare_at_price && variant.compare_at_price > variant.price;
      $gallery.find('[data-gallery-sale-badge]').toggleClass('hidden', !isOnSale);

      var isSoldOut = !variant.available;
      $gallery.find('[data-gallery-soldout-badge]').toggleClass('hidden', !isSoldOut);
    });

    // Window resize handler for mobile/desktop slider initialization
    var resizeTimer;
    $(window).on('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (desktopLayout !== 'slider') {
          if (window.innerWidth < 769 && !$mainTrack.hasClass('slick-initialized')) {
            initMainSlider();
          } else if (window.innerWidth >= 769 && $mainTrack.hasClass('slick-initialized')) {
            $mainTrack.slick('setPosition');
          }
        }
      }, 150);
    });
  }

  // Bootstrap Slick on DOM ready
  function bootstrap() {
    whenSlickReady(function ($) {
      document.querySelectorAll('product-gallery, [data-product-gallery]').forEach(function (el) {
        initProductGallery(el, $);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // Shopify Theme Editor Section Lifecycle Support
  document.addEventListener('shopify:section:load', function (e) {
    whenSlickReady(function ($) {
      var target = e.target;
      var gallery = target ? target.querySelector('product-gallery, [data-product-gallery]') : null;
      if (gallery) {
        gallery._galleryInitialized = false;
        initProductGallery(gallery, $);
      }
    });
  });
})();
