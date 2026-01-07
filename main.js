/* ============================================================
   bundle.js  (main.js + video.js)
   NOTE: script.js is intentionally NOT re-included here because it
   duplicates the same logic and would run everything twice.
============================================================ */

/*
 * main.js
 *
 * This script contains all non-video behaviour for the SLANDS landing page.  It
 * wires up the horizontal slider, text reveal animation, portfolio carousel
 * (navigation, auto-advance, progress bar and details toggling), services
 * modal and mobile navigation menu.  Video playback logic lives in
 * video.js to keep the responsibilities clear and to make it easy to swap
 * implementations or disable autoplay entirely.
 */

/* -------------------------------------------------------------------------
 * Horizontal slider support
 *
 * If you have an element with id="slider" that overflows horizontally,
 * scrolling the mouse wheel will move it left/right.  Holding the shift key
 * disables the behaviour so that you can still scroll vertically.
 */
document.addEventListener('DOMContentLoaded', () => {
  const slider = document.getElementById('slider');
  if (!slider) return;
  slider.addEventListener('wheel', (e) => {
    if (e.shiftKey) return;
    slider.scrollBy({ left: e.deltaY, behavior: 'smooth' });
    e.preventDefault();
  });
});

/* -------------------------------------------------------------------------
 * Text reveal animation
 *
 * Wraps text in elements with the `.texts` class in span tags and uses an
 * IntersectionObserver to reveal those spans when they enter the viewport.
 */
document.addEventListener('DOMContentLoaded', () => {
  const SPLIT_WORDS = false;
  const blocks = document.querySelectorAll('.texts');
  if (SPLIT_WORDS) {
    blocks.forEach((el) => {
      if (el.dataset.split === '1') return;
      const raw = el.textContent.trim();
      el.textContent = '';
      raw.split(/(\s+)/).forEach((t) => {
        if (t.trim() === '') {
          el.append(t);
        } else {
          const w = document.createElement('span');
          w.textContent = t;
          el.append(w);
        }
      });
      el.dataset.split = '1';
    });
  } else {
    // Ensure each `.texts` block has at least one span so our reveal works
    blocks.forEach((el) => {
      if (el.querySelector('span')) return;
      const wrapper = document.createElement('span');
      wrapper.textContent = el.textContent.trim();
      el.textContent = '';
      el.append(wrapper);
    });
  }
  const targets = SPLIT_WORDS
    ? document.querySelectorAll('.texts span')
    : document.querySelectorAll('.texts > span');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle('visible', entry.isIntersecting);
      });
    }, {
      rootMargin: '0px 0px -140px 0px',
      threshold: 0
    });
    targets.forEach((node) => observer.observe(node));
  } else {
    const revealFallback = () => {
      const threshold = window.innerHeight - 140;
      targets.forEach((node) => {
        const { top } = node.getBoundingClientRect();
        node.classList.toggle('visible', top < threshold);
      });
    };
    window.addEventListener('scroll', revealFallback, { passive: true });
    window.addEventListener('resize', revealFallback);
    revealFallback();
  }
});

/* -------------------------------------------------------------------------
 * Portfolio carousel
 *
 * Handles slide navigation, progress bar, auto-advance and toggling of
 * additional details.  Video autoplay is handled separately in video.js.
 */
class PortfolioCarousel {
  constructor() {
    this.currentIndex = 0;
    // Grab all of the cards up front.  These represent the slides in
    // the carousel.  Later on we will ensure the indicator buttons
    // reflect the same count so navigation stays in sync.
    this.cards = document.querySelectorAll('.portfolioCard');

    // Before capturing the indicator NodeList, check whether the
    // existing markup has provided enough buttons for each card.  If
    // there are fewer indicators than cards (e.g. you add a new
    // portfolioCard to the HTML without updating the indicators) the
    // carousel will fall out of sync and the auto-advance logic can
    // feel "off by one".  To make the component resilient we create
    // any missing indicators here.
    const indicatorContainer = document.querySelector('.carousel-indicators');
    if (indicatorContainer && indicatorContainer.children.length < this.cards.length) {
      // Add additional indicator buttons until the counts match.
      const startingIndex = indicatorContainer.children.length;
      for (let i = startingIndex; i < this.cards.length; i++) {
        const btn = document.createElement('button');
        btn.className = 'indicator';
        btn.dataset.index = i.toString();
        btn.setAttribute('aria-label', `Go to slide ${i + 1}`);
        // Include data-testid for testing consistency if the first indicators use it
        btn.setAttribute('data-testid', `indicator-${i}`);
        indicatorContainer.appendChild(btn);
      }
    }
    // Now capture all indicators (including any we may have just added).
    this.indicators = document.querySelectorAll('.indicator');

    this.progressFill = document.querySelector('.progress-fill');
    this.autoAdvanceInterval = null;
    this.progressInterval = null;
    this.autoAdvanceDelay = 9000;
    this.isPaused = false;
    if (this.cards.length) {
      this.init();
    }
  }
  init() {
    this.initNavigation();
    this.initDetailsToggle();
    this.startAutoAdvance();
    this.initHoverPause();
  }
  initNavigation() {
    const prevButton = document.querySelector('.carousel-nav.prev');
    const nextButton = document.querySelector('.carousel-nav.next');
    prevButton?.addEventListener('click', () => this.goToPrevious());
    nextButton?.addEventListener('click', () => this.goToNext());
    this.indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', () => this.goToSlide(index));
    });
  }
  initDetailsToggle() {
    this.cards.forEach((card) => {
      const textContainer = card.querySelector('.pTextContainer');
      const learnMoreBtn = card.querySelector('.learn-more-btn');
      const closeBtn = card.querySelector('.close-details-btn');
      if (!textContainer) return;
      const toggle = () => {
        const isOpen = textContainer.classList.contains('expanded');
        if (isOpen) {
          textContainer.classList.remove('expanded');
          this.resumeAutoAdvance();
        } else {
          textContainer.classList.add('expanded');
          this.pauseAutoAdvance();
        }
      };
      learnMoreBtn?.addEventListener('click', toggle);
      closeBtn?.addEventListener('click', toggle);
    });
  }
  initHoverPause() {
    const container = document.querySelector('.carousel-container');
    if (!container) return;
    container.addEventListener('mouseenter', () => {
      const currentCard = this.cards[this.currentIndex];
      const isExpanded = currentCard.querySelector('.pTextContainer')?.classList.contains('expanded');
      if (!isExpanded) this.tempPauseAutoAdvance();
    });
    container.addEventListener('mouseleave', () => {
      const currentCard = this.cards[this.currentIndex];
      const isExpanded = currentCard.querySelector('.pTextContainer')?.classList.contains('expanded');
      if (!isExpanded) this.resumeAutoAdvance();
    });
  }
  goToSlide(index) {
    if (!this.cards[this.currentIndex]) return;
    // collapse details on all cards when changing slide
    this.cards.forEach((card) => {
      card.querySelector('.pTextContainer')?.classList.remove('expanded');
    });
    this.cards[this.currentIndex].classList.remove('active');
    this.cards[this.currentIndex].classList.add('prev');
    setTimeout(() => {
      this.cards[this.currentIndex].classList.remove('prev');
    }, 600);
    this.currentIndex = index;
    this.cards[this.currentIndex].classList.add('active');
    this.indicators.forEach((ind) => ind.classList.remove('active'));
    this.indicators[this.currentIndex]?.classList.add('active');
    this.resetProgress();
    this.resumeAutoAdvance();
  }
  goToNext() {
    const nextIndex = (this.currentIndex + 1) % this.cards.length;
    this.goToSlide(nextIndex);
  }
  goToPrevious() {
    const prevIndex = (this.currentIndex - 1 + this.cards.length) % this.cards.length;
    this.goToSlide(prevIndex);
  }
  startAutoAdvance() {
    this.resetProgress();
    this.startProgress();
    this.autoAdvanceInterval = setInterval(() => {
      this.goToNext();
    }, this.autoAdvanceDelay);
  }
  pauseAutoAdvance() {
    this.isPaused = true;
    if (this.autoAdvanceInterval) {
      clearInterval(this.autoAdvanceInterval);
      this.autoAdvanceInterval = null;
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
  tempPauseAutoAdvance() {
    if (this.autoAdvanceInterval) {
      clearInterval(this.autoAdvanceInterval);
      this.autoAdvanceInterval = null;
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
  resumeAutoAdvance() {
    if (!this.isPaused) {
      this.pauseAutoAdvance();
      this.startAutoAdvance();
    }
    this.isPaused = false;
  }
  startProgress() {
    let progress = 0;
    const increment = 100 / (this.autoAdvanceDelay / 100);
    this.progressInterval = setInterval(() => {
      progress += increment;
      if (progress >= 100) progress = 100;
      if (this.progressFill) this.progressFill.style.width = progress + '%';
    }, 100);
  }
  resetProgress() {
    if (this.progressInterval) clearInterval(this.progressInterval);
    if (this.progressFill) this.progressFill.style.width = '0%';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PortfolioCarousel();
});

/* -------------------------------------------------------------------------
 * Mobile navigation menu
 *
 * Handles opening and closing the full screen menu on small screens.
 */
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('mobileMenu');
  const closeBtn = document.querySelector('.mobile-close');
  if (!toggle || !menu || !closeBtn) return;
  const links = menu.querySelectorAll('a');
  function openMenu() {
    menu.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  toggle.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);
  links.forEach((link) => link.addEventListener('click', closeMenu));
});


/*
 * video.js
 *
 * This module handles video playback for the portfolio carousel.
 * It separates all video-specific logic from the rest of the page so
 * that other behaviours (navigation, auto-advance, modals, etc.) can
 * be managed independently in main.js.  Videos will only play when
 * their card is active and sufficiently visible in the viewport.  On
 * mobile devices an overlay invites the user to tap to play, and
 * videos automatically pause and reset when they leave view or the
 * active slide changes.
 */

document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.portfolioCard');
  if (!cards.length) return;
  // Detect a narrow viewport once to toggle mobile behaviour
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  // Helper to get the current active card index based on the `.active` class
  function getCurrentIndex() {
    const active = document.querySelector('.portfolioCard.active');
    return active ? Array.from(cards).indexOf(active) : 0;
  }
  cards.forEach((card, index) => {
    const video = card.querySelector('.portfolioVid');
    const container = card.querySelector('.video-container');
    if (!video || !container) return;
    if (isMobile) {
      // On mobile we overlay a tap target to start playback.  When the
      // card or overlay leaves the viewport or the slide is no longer
      // active, we pause and reset the video and restore the overlay.
      let overlay = container.querySelector('.video-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'video-overlay';
        overlay.innerHTML = `<span>Tap to play</span>`;
        container.appendChild(overlay);
      }
      overlay.style.pointerEvents = 'auto';
      overlay.addEventListener('click', () => {
        overlay.style.display = 'none';
        video.play();
      });
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const currentIndex = getCurrentIndex();
          // Pause and reset if this card is not active or not in view
          if (!entry.isIntersecting || index !== currentIndex) {
            video.pause();
            video.currentTime = 0;
            overlay.style.display = '';
          }
        });
      }, { threshold: 0.6 });
      observer.observe(container);
      return;
    }
    // Desktop behaviour: play when visible and current slide, otherwise
    // pause and reset to the beginning
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const currentIndex = getCurrentIndex();
        if (entry.isIntersecting && index === currentIndex) {
          video.play();
        } else {
          video.pause();
          video.currentTime = 0;
        }
      });
    }, { threshold: 0.6 });
    observer.observe(container);
  });
});
