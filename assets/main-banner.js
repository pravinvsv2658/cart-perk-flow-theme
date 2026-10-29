/**
 * Main Banner / Hero Carousel JavaScript Component
 * Powered by Slick Slider
 */

(function () {
  'use strict';

  function initSection(section) {
    if (!section || section._slickInitialized) return;

    var $ = window.jQuery;
    if (!$ || !$.fn || !$.fn.slick) return;

    var $section = $(section);
    var $track = $section.find('.main-banner__track');
    var slides = $track.find('.main-banner__slide');

    if (slides.length <= 1) return;

    var autoplay = $section.attr('data-autoplay') === 'true';
    var autoplaySpeed = parseInt($section.attr('data-autoplay-interval'), 10) || 5000;
    var showArrows = $section.attr('data-show-arrows') === 'true';
    var showDots = $section.attr('data-show-dots') === 'true';

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      autoplay = false;
    }

    var $prevArrow = $section.find('.main-banner__arrow--prev');
    var $nextArrow = $section.find('.main-banner__arrow--next');
    var $dotsContainer = $section.find('.main-banner__dots-container');

    var slickConfig = {
      slidesToShow: 1,
      slidesToScroll: 1,
      infinite: true,
      fade: false,
      speed: 550,
      cssEase: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
      autoplay: autoplay,
      autoplaySpeed: autoplaySpeed,
      pauseOnHover: true,
      pauseOnFocus: true,
      arrows: showArrows && $prevArrow.length > 0 && $nextArrow.length > 0,
      prevArrow: $prevArrow,
      nextArrow: $nextArrow,
      dots: showDots && $dotsContainer.length > 0,
      appendDots: $dotsContainer,
      dotsClass: 'main-banner__dots-list',
      customPaging: function (slider, i) {
        return (
          '<button type="button" role="tab" aria-label="Go to slide ' +
          (i + 1) +
          '"><span class="main-banner__dot-indicator"></span></button>'
        );
      },
      adaptiveHeight: false,
      draggable: true,
      swipe: true,
      touchThreshold: 12
    };

    $track.slick(slickConfig);
    section._slickInitialized = true;

    // Accessibility management on slide change
    $track.on('afterChange', function (event, slick, currentSlide) {
      $track.find('.main-banner__slide').each(function (idx, el) {
        var isActive = idx === currentSlide;
        var linksAndButtons = el.querySelectorAll('a, button');
        linksAndButtons.forEach(function (node) {
          if (isActive) {
            node.removeAttribute('tabindex');
          } else {
            node.setAttribute('tabindex', '-1');
          }
        });
      });
    });
  }

  function destroySection(section) {
    if (!section || !section._slickInitialized) return;
    var $ = window.jQuery;
    if ($ && $.fn && $.fn.slick) {
      var $track = $(section).find('.main-banner__track');
      if ($track.hasClass('slick-initialized')) {
        $track.slick('unslick');
      }
    }
    section._slickInitialized = false;
  }

  function initAll() {
    var sections = document.querySelectorAll('.main-banner-section');
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
        }
      }, 50);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // Shopify Theme Editor Support
  document.addEventListener('shopify:section:load', function (event) {
    var banner = event.target.querySelector('.main-banner-section');
    if (banner) {
      bootstrap();
    }
  });

  document.addEventListener('shopify:section:unload', function (event) {
    var banner = event.target.querySelector('.main-banner-section');
    if (banner) {
      destroySection(banner);
    }
  });

  document.addEventListener('shopify:block:select', function (event) {
    var slide = event.target.closest('.main-banner__slide');
    if (slide && window.jQuery) {
      var $ = window.jQuery;
      var banner = slide.closest('.main-banner-section');
      if (banner) {
        var $track = $(banner).find('.main-banner__track');
        var slideIndex = parseInt(slide.dataset.slideIndex, 10);
        if ($track.hasClass('slick-initialized') && !isNaN(slideIndex)) {
          $track.slick('slickPause');
          $track.slick('slickGoTo', slideIndex);
        }
      }
    }
  });
})();
