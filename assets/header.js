/**
 * Sticky Header JavaScript Component
 * CartPerksFlow Theme
 */

class StickyHeader extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.headerSection = this.closest('.shopify-section') || this.parentElement;
    this.stickyType = this.dataset.stickyType || 'always';
    this.isSticky = this.dataset.sticky === 'true';
    this.isTransparent = this.dataset.transparent === 'true';

    this.lastScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    this.threshold = this.isTransparent ? 30 : 10;

    this.syncAnnouncement();
    window.addEventListener('resize', () => this.syncAnnouncement(), { passive: true });

    this.onScrollHandler = this.onScroll.bind(this);
    window.addEventListener('scroll', this.onScrollHandler, { passive: true });
    this.onScroll();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScrollHandler);
  }

  syncAnnouncement() {
    const announcement = document.querySelector('.announcement-bar:not(.is-dismissed)');
    const height = announcement ? announcement.offsetHeight : 0;
    if (this.headerSection) {
      this.headerSection.style.setProperty('--announcement-height', `${height}px`);
    }
  }

  onScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;

    if (scrollTop > this.threshold) {
      this.classList.add('header-wrapper--scrolled');
      if (this.headerSection) {
        this.headerSection.classList.add('is-sticky-active');
      }
    } else {
      this.classList.remove('header-wrapper--scrolled');
      if (this.headerSection) {
        this.headerSection.classList.remove('is-sticky-active');
      }
    }

    if (this.isSticky && this.stickyType === 'on_scroll_up') {
      if (scrollTop > 150 && scrollTop > this.lastScrollTop) {
        // Scrolling down - hide header
        this.classList.add('header-wrapper--hidden');
      } else if (scrollTop < this.lastScrollTop) {
        // Scrolling up - reveal header
        this.classList.remove('header-wrapper--hidden');
      }
    }

    if (scrollTop <= 10) {
      this.classList.remove('header-wrapper--hidden');
    }

    this.lastScrollTop = Math.max(0, scrollTop);
  }
}

if (!customElements.get('sticky-header')) {
  customElements.define('sticky-header', StickyHeader);
}
