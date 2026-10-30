/**
 * Announcement Bar JavaScript Component
 * CartPerksFlow Theme
 */

class AnnouncementBar extends HTMLElement {
  constructor() {
    super();
    this.currentIndex = 0;
    this.timer = null;
    this.isAnimating = false;
  }

  connectedCallback() {
    this.items = Array.from(this.querySelectorAll('.announcement-bar__item'));
    this.total = this.items.length;
    this.isMarquee = this.dataset.marquee === 'true';
    this.isAutoplay = this.dataset.autoplay === 'true';
    this.delay = parseInt(this.dataset.delay, 10) || 5000;

    if (this.isMarquee) return;

    this.prevBtn = this.querySelector('[data-announcement-prev]');
    this.nextBtn = this.querySelector('[data-announcement-next]');
    this.closeBtn = this.querySelector('[data-announcement-close]');

    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => {
        this.prev();
        this.restartTimer();
      });
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => {
        this.next();
        this.restartTimer();
      });
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.dismiss());
    }

    if (this.isAutoplay && this.total > 1) {
      this.startTimer();
      this.addEventListener('mouseenter', () => this.stopTimer());
      this.addEventListener('mouseleave', () => this.startTimer());
      this.addEventListener('focusin', () => this.stopTimer());
      this.addEventListener('focusout', () => this.startTimer());
    }

    // Touch swipe support for mobile
    this.initTouch();

    // Sync announcement height for transparent header positioning
    this.updateHeight();
    window.addEventListener('resize', () => this.updateHeight(), { passive: true });
  }

  disconnectedCallback() {
    this.stopTimer();
  }

  updateHeight() {
    const height = this.offsetHeight;
    const headerSection = document.querySelector('.shopify-section-group-header-group:has(.header-wrapper), #shopify-section-header');
    if (headerSection) {
      headerSection.style.setProperty('--announcement-height', `${height}px`);
    }
  }

  show(newIndex, direction = 'next') {
    if (this.total <= 1 || this.isAnimating || newIndex === this.currentIndex) return;
    this.isAnimating = true;

    const currentItem = this.items[this.currentIndex];
    const nextItem = this.items[newIndex];

    const enterClass = direction === 'next' ? 'slide-enter-up' : 'slide-enter-down';
    const leaveClass = direction === 'next' ? 'slide-leave-up' : 'slide-leave-down';

    // Prepare incoming slide
    nextItem.classList.add(enterClass, 'is-active');

    // Force browser reflow to register starting position before animating
    void nextItem.offsetWidth;

    // Trigger animation
    requestAnimationFrame(() => {
      currentItem.classList.add(leaveClass);
      nextItem.classList.remove(enterClass);
    });

    const onTransitionEnd = () => {
      currentItem.classList.remove('is-active', leaveClass);
      this.isAnimating = false;
      currentItem.removeEventListener('transitionend', onTransitionEnd);
    };

    currentItem.addEventListener('transitionend', onTransitionEnd, { once: true });

    // Fallback timer if transitionend is missed
    setTimeout(() => {
      if (this.isAnimating) {
        currentItem.classList.remove('is-active', leaveClass);
        this.isAnimating = false;
      }
    }, 500);

    this.currentIndex = newIndex;
  }

  next() {
    const nextIndex = (this.currentIndex + 1) % this.total;
    this.show(nextIndex, 'next');
  }

  prev() {
    const prevIndex = (this.currentIndex - 1 + this.total) % this.total;
    this.show(prevIndex, 'prev');
  }

  startTimer() {
    if (this.timer || this.total <= 1) return;
    this.timer = setInterval(() => this.next(), this.delay);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  restartTimer() {
    this.stopTimer();
    if (this.isAutoplay) {
      this.startTimer();
    }
  }

  initTouch() {
    let startX = 0;
    let startY = 0;

    this.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      this.stopTimer();
    }, { passive: true });

    this.addEventListener('touchend', (e) => {
      const diffX = e.changedTouches[0].clientX - startX;
      const diffY = e.changedTouches[0].clientY - startY;

      // Horizontal swipe detection
      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          this.next();
        } else {
          this.prev();
        }
      }
      this.restartTimer();
    }, { passive: true });
  }

  dismiss() {
    this.classList.add('is-dismissed');
    this.stopTimer();
    const headerSection = document.querySelector('.shopify-section-group-header-group:has(.header-wrapper), #shopify-section-header');
    if (headerSection) {
      headerSection.style.setProperty('--announcement-height', '0px');
    }
  }
}

if (!customElements.get('announcement-bar')) {
  customElements.define('announcement-bar', AnnouncementBar);
}
