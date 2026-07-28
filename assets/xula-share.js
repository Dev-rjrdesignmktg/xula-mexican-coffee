(function () {
  'use strict';

  function copyLink(wrapper, button) {
    var url = wrapper.getAttribute('data-share-url');
    var status = wrapper.querySelector('[data-article-share-status]');
    var label = button.querySelector('[data-article-share-copy-label]');
    var originalLabel = label ? label.textContent : null;

    function announce(message, isCopyLabel) {
      if (status) {
        status.textContent = message;
        window.setTimeout(function () {
          status.textContent = '';
        }, 2500);
      }
      if (isCopyLabel && label) {
        label.textContent = message;
        window.setTimeout(function () {
          label.textContent = originalLabel;
        }, 2000);
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        announce('Copied!', true);
      }, function () {
        announce('Unable to copy link', false);
      });
      return;
    }

    var temp = document.createElement('textarea');
    temp.value = url;
    temp.setAttribute('readonly', '');
    temp.style.position = 'absolute';
    temp.style.left = '-9999px';
    document.body.appendChild(temp);
    temp.select();
    try {
      document.execCommand('copy');
      announce('Copied!', true);
    } catch (err) {
      announce('Unable to copy link', false);
    }
    document.body.removeChild(temp);
  }

  function init(wrapper) {
    if (wrapper.dataset.articleShareReady === 'true') return;
    wrapper.dataset.articleShareReady = 'true';

    var button = wrapper.querySelector('[data-article-share-copy]');
    if (!button) return;
    button.addEventListener('click', function () {
      copyLink(wrapper, button);
    });
  }

  function initAll() {
    document.querySelectorAll('[data-article-share]').forEach(init);
  }

  initAll();

  document.addEventListener('shopify:section:load', function (event) {
    var wrappers = event.target.querySelectorAll('[data-article-share]');
    wrappers.forEach(init);
  });
})();
