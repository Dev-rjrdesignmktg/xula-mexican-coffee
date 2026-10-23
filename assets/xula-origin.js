function initXulaOrigin(root = document) {
  const sections = Array.from(root.querySelectorAll('[data-xula-origin]'))
    .filter((section) => !section.dataset.xulaOriginReady);
  if (!sections.length) return;

  sections.forEach((section) => {
    section.dataset.xulaOriginReady = 'true';
  });

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  sections.forEach((section) => {
    const track = section.querySelector('[data-xula-origin-slides]');
    if (!track) return;

    const slides = Array.from(track.querySelectorAll('.xula-origin__slide'));
    const duration = parseInt(track.dataset.autoplay, 10) || 5000;
    section.style.setProperty('--xula-origin-autoplay', `${duration}ms`);

    if (slides.length < 2) return;

    const dots = Array.from(section.querySelectorAll('.xula-origin__dot'));
    const current = section.querySelector('[data-origin-current]');
    const media = section.querySelector('.xula-origin__frame');

    let activeIndex = 0;
    let fallbackTimer = null;
    const pauseReasons = new Set();

    const pad = (n) => String(n).padStart(2, '0');

    function restartFill(dot) {
      const fill = dot && dot.querySelector('.xula-origin__dot-fill');
      if (!fill) return;
      fill.style.animation = 'none';
      void fill.offsetWidth;
      fill.style.animation = '';
    }

    function goTo(index) {
      const nextIndex = (index + slides.length) % slides.length;
      if (nextIndex === activeIndex) return;

      slides[activeIndex].classList.remove('is-active');
      slides[activeIndex].setAttribute('aria-hidden', 'true');

      activeIndex = nextIndex;

      slides[activeIndex].classList.add('is-active');
      slides[activeIndex].removeAttribute('aria-hidden');

      dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === activeIndex);
        dot.classList.toggle('is-done', i < activeIndex);
        dot.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
      });
      restartFill(dots[activeIndex]);

      if (current) current.textContent = pad(activeIndex + 1);
    }

    // Autoplay is driven by the progress bar animation so pausing it
    // (hover, offscreen, hidden tab) pauses the slideshow in sync.
    dots.forEach((dot) => {
      const fill = dot.querySelector('.xula-origin__dot-fill');
      if (!fill) return;
      fill.addEventListener('animationend', () => {
        if (dot.classList.contains('is-active') && !prefersReducedMotion) goTo(activeIndex + 1);
      });
    });

    // Without dots there is no animation to listen to, so use a timer.
    if (!dots.length && !prefersReducedMotion) {
      fallbackTimer = setInterval(() => {
        if (!pauseReasons.size) goTo(activeIndex + 1);
      }, duration);
    }

    function setPaused(reason, paused) {
      if (paused) pauseReasons.add(reason);
      else pauseReasons.delete(reason);
      section.classList.toggle('is-paused', pauseReasons.size > 0);
    }

    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => goTo(index));
    });

    if (media) {
      media.addEventListener('mouseenter', () => setPaused('hover', true));
      media.addEventListener('mouseleave', () => setPaused('hover', false));
      media.addEventListener('focusin', () => setPaused('focus', true));
      media.addEventListener('focusout', () => setPaused('focus', false));

      media.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') goTo(activeIndex - 1);
        if (event.key === 'ArrowRight') goTo(activeIndex + 1);
      });
    }

    // Swipe on touch devices
    let startX = null;
    let startY = null;

    track.addEventListener('touchstart', (event) => {
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    }, { passive: true });

    track.addEventListener('touchend', (event) => {
      if (startX === null) return;
      const dx = event.changedTouches[0].clientX - startX;
      const dy = event.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        goTo(activeIndex + (dx < 0 ? 1 : -1));
      }
      startX = null;
      startY = null;
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      setPaused('hidden', document.hidden);
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((entry) => setPaused('offscreen', !entry.isIntersecting));
      }).observe(track);
    }

    if (prefersReducedMotion && fallbackTimer) clearInterval(fallbackTimer);
  });

  // Reveal on scroll
  if (!('IntersectionObserver' in window)) {
    sections.forEach((section) => section.classList.add('is-visible'));
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  sections.forEach((section) => revealObserver.observe(section));
}

document.addEventListener('DOMContentLoaded', () => initXulaOrigin());
document.addEventListener('shopify:section:load', (event) => initXulaOrigin(event.target));
