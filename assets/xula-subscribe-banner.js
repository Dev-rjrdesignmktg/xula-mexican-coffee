/* =========================================================
   Xula Subscribe Banner — lazy-loads the cinematic video,
   plays it only while in view, and staggers the numbered
   steps in on scroll. Vanilla JS, no dependencies.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('[data-xula-subscribe-banner]');
  if (!sections.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesktop = window.matchMedia('(min-width: 990px)');

  sections.forEach((section) => {
    setupVideo(section);
    setupReveal(section);
    setupSectionReveal(section);
  });

  function setupSectionReveal(section) {
    if (reduceMotion || !('IntersectionObserver' in window)) return;

    section.classList.add('is-armed');
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          section.classList.add('is-inview');
          obs.unobserve(section);
        });
      },
      { threshold: 0.2 }
    );
    observer.observe(section);
  }

  function setupVideo(section) {
    const video = section.querySelector('[data-xula-subscribe-video]');
    if (!video) return;

    const mobileDisabled = video.classList.contains('xula-subscribe-banner__video--desktop-only');
    let sourcesLoaded = false;

    const loadSources = () => {
      if (sourcesLoaded) return;
      const sources = video.querySelectorAll('source[data-src]');
      if (!sources.length) return;
      sources.forEach((source) => {
        source.src = source.dataset.src;
        source.removeAttribute('data-src');
      });
      video.load();
      sourcesLoaded = true;
    };

    const canPlay = () => !reduceMotion && (!mobileDisabled || isDesktop.matches);

    const play = () => {
      if (!canPlay()) return;
      loadSources();
      const request = video.play();
      if (request && typeof request.catch === 'function') request.catch(() => {});
    };

    const pause = () => video.pause();

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => (entry.isIntersecting ? play() : pause()));
        },
        { threshold: 0.25 }
      );
      observer.observe(section);
    } else {
      play();
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause();
      else play();
    });

    if (mobileDisabled && typeof isDesktop.addEventListener === 'function') {
      isDesktop.addEventListener('change', (event) => (event.matches ? play() : pause()));
    }
  }

  function setupReveal(section) {
    const list = section.querySelector('[data-xula-subscribe-reveal]');
    if (!list) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      list.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          list.classList.add('is-visible');
          obs.unobserve(list);
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(list);
  }
});
