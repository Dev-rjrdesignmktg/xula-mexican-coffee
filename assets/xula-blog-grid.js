(function () {
  'use strict';

  function initEntrance(section, items) {
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
      item.style.transitionDelay = Math.min(index * 70, 280) + 'ms';
      item.classList.add('xula-blog-grid__item--armed');
      observer.observe(item);
    });
  }

  function initFilters(section, items) {
    var filterGroup = section.querySelector('[data-blog-grid-filters]');
    var loadMoreWrap = section.querySelector('[data-blog-grid-load-more-wrap]');
    if (!filterGroup) return null;

    var buttons = Array.prototype.slice.call(filterGroup.querySelectorAll('[data-blog-grid-filter]'));
    var currentFilter = 'all';

    function apply(recompute) {
      items.forEach(function (item) {
        var matches = currentFilter === 'all' || item.getAttribute('data-blog-grid-category') === currentFilter;
        item.classList.toggle('is-hidden', !matches);
      });
      if (loadMoreWrap) {
        loadMoreWrap.classList.toggle('is-active', currentFilter === 'all' && loadMoreWrap.dataset.hasMore === 'true');
      }
      if (typeof recompute === 'function') recompute();
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        currentFilter = button.getAttribute('data-blog-grid-filter');
        buttons.forEach(function (btn) {
          var active = btn === button;
          btn.classList.toggle('is-active', active);
          btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        apply(section.__xulaBlogGridRecomputeMore);
      });
    });

    return {
      isFiltering: function () {
        return currentFilter !== 'all';
      },
      refresh: apply
    };
  }

  function initLoadMore(section, items) {
    var wrap = section.querySelector('[data-blog-grid-load-more-wrap]');
    var button = section.querySelector('[data-blog-grid-load-more]');
    var grid = section.querySelector('[data-blog-grid-grid]');
    if (!wrap || !button || !grid) return;

    var initialVisible = parseInt(grid.getAttribute('data-initial-visible'), 10) || items.length;
    if (items.length <= initialVisible) return;

    var revealed = false;

    items.forEach(function (item, index) {
      if (index >= initialVisible) {
        item.classList.add('xula-blog-grid__item--more');
        item.classList.add('is-hidden');
      }
    });

    wrap.dataset.hasMore = 'true';
    wrap.classList.add('is-active');
    button.setAttribute('aria-expanded', 'false');

    function reveal() {
      revealed = true;
      items.forEach(function (item) {
        if (item.classList.contains('xula-blog-grid__item--more')) {
          item.classList.remove('is-hidden');
        }
      });
      wrap.classList.remove('is-active');
      button.setAttribute('aria-expanded', 'true');
    }

    button.addEventListener('click', reveal);

    section.__xulaBlogGridRecomputeMore = function () {
      if (revealed) return;
      items.forEach(function (item) {
        if (item.classList.contains('xula-blog-grid__item--more') && !item.classList.contains('is-hidden')) {
          item.classList.add('is-hidden');
        }
      });
    };
  }

  function init(section) {
    var grid = section.querySelector('[data-blog-grid-grid]');
    if (!grid) return;

    var items = Array.prototype.slice.call(section.querySelectorAll('[data-blog-grid-item]'));
    if (!items.length) return;

    initEntrance(section, items);
    initLoadMore(section, items);
    initFilters(section, items);
  }

  function initAll() {
    document.querySelectorAll('.xula-blog-grid').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.xula-blog-grid');
    if (section) init(section);
  });
})();
