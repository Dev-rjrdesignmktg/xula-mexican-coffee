(function () {
  'use strict';

  function initEntrance(rows) {
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

    rows.forEach(function (row, index) {
      row.style.transitionDelay = Math.min(index * 60, 240) + 'ms';
      row.classList.add('xula-blog-list__row--armed');
      observer.observe(row);
    });
  }

  function initLoadMore(section, rows) {
    var wrap = section.querySelector('[data-blog-list-load-more-wrap]');
    var button = section.querySelector('[data-blog-list-load-more]');
    var list = section.querySelector('[data-blog-list-rows]');
    if (!wrap || !button || !list) return;

    var initialVisible = parseInt(list.getAttribute('data-initial-visible'), 10) || rows.length;
    if (rows.length <= initialVisible) return;

    rows.forEach(function (row, index) {
      if (index >= initialVisible) {
        row.classList.add('xula-blog-list__row--more');
        row.classList.add('is-hidden');
      }
    });

    wrap.classList.add('is-active');
    button.setAttribute('aria-expanded', 'false');

    button.addEventListener('click', function () {
      rows.forEach(function (row) {
        if (row.classList.contains('xula-blog-list__row--more')) {
          row.classList.remove('is-hidden');
        }
      });
      wrap.classList.remove('is-active');
      button.setAttribute('aria-expanded', 'true');
    });
  }

  function init(section) {
    var list = section.querySelector('[data-blog-list-rows]');
    if (!list) return;

    var rows = Array.prototype.slice.call(section.querySelectorAll('[data-blog-list-row]'));
    if (!rows.length) return;

    initEntrance(rows);
    initLoadMore(section, rows);
  }

  function initAll() {
    document.querySelectorAll('.xula-blog-list').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.xula-blog-list');
    if (section) init(section);
  });
})();
