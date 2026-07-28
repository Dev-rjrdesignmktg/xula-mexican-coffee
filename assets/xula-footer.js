(function () {
  'use strict';

  function initLocalizationSelects(root) {
    var selects = root.querySelectorAll('[data-xula-localization-select]');
    var status = root.querySelector('[data-xula-localization-status]');

    selects.forEach(function (select) {
      select.addEventListener('change', function () {
        var form = select.closest('form');
        if (!form) return;

        select.setAttribute('aria-busy', 'true');
        select.disabled = true;

        if (status) {
          status.textContent = 'Updating…';
        }

        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.submit();
        }
      });
    });
  }

  function initBackToTop(root) {
    var button = root.querySelector('[data-xula-back-to-top]');
    if (!button) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var revealThreshold = 480;

    function toggleVisibility() {
      var isVisible = window.scrollY > revealThreshold;
      button.classList.toggle('is-visible', isVisible);
    }

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    toggleVisibility();

    button.addEventListener('click', function () {
      window.scrollTo({
        top: 0,
        behavior: reduceMotion.matches ? 'auto' : 'smooth',
      });
    });
  }

  document.querySelectorAll('.xula-footer').forEach(function (footer) {
    initLocalizationSelects(footer);
    initBackToTop(footer);
  });
})();
