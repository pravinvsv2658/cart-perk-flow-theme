/**
 * Featured Collection Section JavaScript Component
 * CartPerksFlow Theme - Powered by Slick Slider CDN & AJAX Quick Add
 */

(function () {
  'use strict';

  function initSlider(section) {
    if (!section || section._slickInitialized) return;

    var $ = window.jQuery;
    if (!$ || !$.fn || !$.fn.slick) return;

    var $section = $(section);
    var $slider = $section.find('.featured-collection__grid--slider');
    if (!$slider.length) return;

    var slidesCount = $slider.find('.product-card').length;
    if (slidesCount <= 1) return;

    var columnsDesktop = parseInt(section.getAttribute('data-columns-desktop'), 10) || 4;
    var columnsMobile = parseInt(section.getAttribute('data-columns-mobile'), 10) || 2;
    var autoplay = section.getAttribute('data-autoplay') === 'true';
    var autoplaySpeed = parseInt(section.getAttribute('data-autoplay-interval'), 10) || 5000;
    var showArrows = section.getAttribute('data-show-arrows') === 'true';
    var showDots = section.getAttribute('data-show-dots') === 'true';

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      autoplay = false;
    }

    var infinite = section.getAttribute('data-infinite') === 'true';
    var $prevArrow = $section.find('.slider-arrow--prev, .featured-collection__arrow--prev');
    var $nextArrow = $section.find('.slider-arrow--next, .featured-collection__arrow--next');
    var $dotsContainer = $section.find('.featured-collection__dots-container');

    function updateArrowDisabledState(slick, currentSlide) {
      if (!slick) return;
      var current = typeof currentSlide !== 'undefined' ? currentSlide : (slick.currentSlide || 0);
      var visibleCols = slick.options.slidesToShow || columnsDesktop;
      var totalSlides = slick.slideCount || slidesCount;

      if (totalSlides <= visibleCols) {
        $prevArrow.addClass('slick-disabled').attr('aria-disabled', 'true');
        $nextArrow.addClass('slick-disabled').attr('aria-disabled', 'true');
        return;
      }

      if (infinite) {
        $prevArrow.removeClass('slick-disabled').attr('aria-disabled', 'false');
        $nextArrow.removeClass('slick-disabled').attr('aria-disabled', 'false');
        return;
      }

      var maxSlide = Math.max(0, totalSlides - visibleCols);
      var isAtStart = current <= 0;
      var isAtEnd = current >= maxSlide;

      $prevArrow
        .toggleClass('slick-disabled', isAtStart)
        .attr('aria-disabled', isAtStart ? 'true' : 'false');

      $nextArrow
        .toggleClass('slick-disabled', isAtEnd)
        .attr('aria-disabled', isAtEnd ? 'true' : 'false');
    }

    $slider.on('init reInit breakpoint', function (event, slick) {
      var instance = slick || (slickConfig && $slider.slick('getSlick'));
      if (instance) {
        updateArrowDisabledState(instance, instance.currentSlide || 0);
      }
    });

    $slider.on('afterChange', function (event, slick, currentSlide) {
      updateArrowDisabledState(slick, currentSlide);
    });

    // Explicit click handlers with event propagation stopping to protect product cards
    if (showArrows && $prevArrow.length > 0) {
      $prevArrow.off('click.fc').on('click.fc', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!$(this).hasClass('slick-disabled')) {
          $slider.slick('slickPrev');
        }
        return false;
      });
    }

    if (showArrows && $nextArrow.length > 0) {
      $nextArrow.off('click.fc').on('click.fc', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!$(this).hasClass('slick-disabled')) {
          $slider.slick('slickNext');
        }
        return false;
      });
    }

    var slickConfig = {
      slidesToShow: columnsDesktop,
      slidesToScroll: 1,
      swipeToSlide: true, // Free scrolling - allows direct dragging/swiping to any card
      waitForAnimate: false,
      infinite: infinite,
      autoplay: autoplay,
      autoplaySpeed: autoplaySpeed,
      pauseOnHover: true,
      pauseOnFocus: true,
      arrows: false, // Managed explicitly above to prevent click-through to cards
      dots: showDots && $dotsContainer.length > 0,
      appendDots: $dotsContainer,
      dotsClass: 'featured-collection__dots-list',
      customPaging: function (slider, i) {
        return (
          '<button type="button" class="featured-collection__dot" role="tab" aria-label="Go to product ' +
          (i + 1) +
          '"><span class="featured-collection__dot-inner"></span></button>'
        );
      },
      draggable: true,
      swipe: true,
      touchThreshold: 15,
      speed: 400,
      cssEase: 'cubic-bezier(0.25, 1, 0.5, 1)',
      responsive: [
        {
          breakpoint: 1200,
          settings: {
            slidesToShow: Math.min(columnsDesktop, 4),
            slidesToScroll: 1,
            swipeToSlide: true
          }
        },
        {
          breakpoint: 990,
          settings: {
            slidesToShow: Math.min(columnsDesktop, 3),
            slidesToScroll: 1,
            swipeToSlide: true
          }
        },
        {
          breakpoint: 750,
          settings: {
            slidesToShow: columnsMobile,
            slidesToScroll: 1,
            swipeToSlide: true
          }
        }
      ]
    };

    $slider.slick(slickConfig);
    section._slickInitialized = true;

    // Initial arrow state sync
    var slickInstance = $slider.slick('getSlick');
    if (slickInstance) {
      updateArrowDisabledState(slickInstance, 0);
    }
  }

  function destroySlider(section) {
    if (!section) return;
    var $ = window.jQuery;
    if ($ && $.fn && $.fn.slick) {
      var $slider = $(section).find('.featured-collection__grid--slider, .featured-collection__grid');
      $slider.each(function () {
        if ($(this).hasClass('slick-initialized')) {
          $(this).slick('unslick');
        }
      });
    }
    section._slickInitialized = false;
  }

  // Quick add is handled globally by product-form.js
  function initQuickAdd(section) {
    section._quickAddInitialized = true;
  }

  function initSection(section) {
    var isSlider = section.getAttribute('data-slider-enabled') === 'true';
    if (isSlider) {
      initSlider(section);
    } else {
      destroySlider(section);
    }
    initQuickAdd(section);
  }

  function initAll() {
    var sections = document.querySelectorAll('.featured-collection-section');
    sections.forEach(function (sec) {
      initSection(sec);
    });
  }

  function bootstrap() {
    if (typeof window.jQuery !== 'undefined' && typeof window.jQuery.fn.slick !== 'undefined') {
      initAll();
    } else {
      var attempts = 0;
      var timer = setInterval(function () {
        attempts++;
        if (typeof window.jQuery !== 'undefined' && typeof window.jQuery.fn.slick !== 'undefined') {
          clearInterval(timer);
          initAll();
        } else if (attempts > 60) {
          clearInterval(timer);
          // If slick times out, still initialize quick add
          document.querySelectorAll('.featured-collection-section').forEach(initQuickAdd);
        }
      }, 50);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // Shopify Theme Editor Lifecycle Events
  document.addEventListener('shopify:section:load', function (event) {
    var target = event.target;
    var section = target && target.matches && target.matches('.featured-collection-section')
      ? target
      : (target ? target.querySelector('.featured-collection-section') : null);
    if (section) {
      initSection(section);
    }
  });

  document.addEventListener('shopify:section:unload', function (event) {
    var target = event.target;
    var section = target && target.matches && target.matches('.featured-collection-section')
      ? target
      : (target ? target.querySelector('.featured-collection-section') : null);
    if (section) {
      destroySlider(section);
    }
  });
})();
