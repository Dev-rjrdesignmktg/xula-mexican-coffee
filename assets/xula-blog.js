(function () {
  'use strict';

  function initXulaBlog(section) {
    var items = section.querySelectorAll('[data-xula-blog-item]');
    if (!items.length) return;

    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.15 }
    );

    items.forEach(function (item, index) {
      item.style.transitionDelay = Math.min(index * 90, 270) + 'ms';
      item.classList.add('xula-blog__item--armed');
      observer.observe(item);
    });
  }

  function init() {
    document.querySelectorAll('[data-xula-blog-grid]').forEach(function (grid) {
      initXulaBlog(grid.closest('.xula-blog'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.xula-blog');
    if (section) initXulaBlog(section);
  });
})();
