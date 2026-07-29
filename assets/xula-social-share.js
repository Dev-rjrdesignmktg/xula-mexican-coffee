/* =========================================================
   Xula Social Share — copy-link button (Clipboard API with a
   manual-select fallback). Vanilla JS, no dependencies.
   ========================================================= */

(() => {
  document.querySelectorAll('[data-xss-root]').forEach((root) => {
    const button = root.querySelector('[data-xss-copy]');
    if (!button) return;

    const status = root.querySelector('[data-xss-status]');
    const url = button.dataset.xssUrl || window.location.href;
    let resetTimer;

    button.addEventListener('click', () => {
      copyToClipboard(url)
        .then(() => {
          button.classList.add('is-copied');
          button.setAttribute('aria-label', 'Link copied');
          if (status) status.textContent = 'Link copied to clipboard.';

          clearTimeout(resetTimer);
          resetTimer = setTimeout(() => {
            button.classList.remove('is-copied');
            button.setAttribute('aria-label', 'Copy link');
          }, 2200);
        })
        .catch(() => {
          if (status) status.textContent = 'Could not copy the link.';
        });
    });
  });

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        successful ? resolve() : reject(new Error('execCommand failed'));
      } catch (error) {
        document.body.removeChild(textarea);
        reject(error);
      }
    });
  }
})();
