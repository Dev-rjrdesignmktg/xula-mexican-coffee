(() => {
  const SELECTOR = '.xula-about__reveal';
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let observer = null;

  const reveal = (target) => target.classList.add('is-visible');

  const init = (root = document) => {
    const targets = root.querySelectorAll(`${SELECTOR}:not(.is-visible)`);
    if (!targets.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach(reveal);
      return;
    }

    if (!observer) {
      observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              reveal(entry.target);
              obs.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.15 }
      );
    }

    targets.forEach((target) => observer.observe(target));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  // Theme editor: re-run when the section or a block is re-rendered.
  document.addEventListener('shopify:section:load', (event) => init(event.target));
  document.addEventListener('shopify:block:select', (event) => {
    const chapter = event.target.closest(SELECTOR);
    if (chapter) reveal(chapter);
  });
})();
