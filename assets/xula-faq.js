/* =========================================================
   Xula FAQ — accessible accordion controller
   Animates native <details>/<summary> height, supports
   exclusive or multi-open mode. Vanilla JS, no dependencies.
   ========================================================= */

(() => {
  const SELECTOR_ROOT = '[data-xula-faq]';
  const ANIMATION_MS = 320;
  const EASING = 'cubic-bezier(.16, 1, .3, 1)';

  const init = () => {
    document.querySelectorAll(SELECTOR_ROOT).forEach(setupFaq);
  };

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();

  document.addEventListener('shopify:section:load', init);

  function setupFaq(root) {
    if (root.dataset.xulaFaqInitialized === 'true') return;
    root.dataset.xulaFaqInitialized = 'true';

    const allowMultiple = root.dataset.allowMultiple === 'true';
    const items = Array.from(root.querySelectorAll('[data-faq-item]'));

    items.forEach((item) => {
      const summary = item.querySelector('[data-faq-summary]');
      const panel = item.querySelector('[data-faq-panel]');
      if (!summary || !panel) return;

      summary.addEventListener('click', (event) => {
        event.preventDefault();
        toggleItem(item, summary, panel, items, allowMultiple);
      });
    });
  }

  function toggleItem(item, summary, panel, siblings, allowMultiple) {
    const isOpen = item.hasAttribute('open');

    if (!allowMultiple && !isOpen) {
      siblings.forEach((sibling) => {
        if (sibling === item || !sibling.hasAttribute('open')) return;

        const siblingSummary = sibling.querySelector('[data-faq-summary]');
        const siblingPanel = sibling.querySelector('[data-faq-panel]');
        if (siblingSummary && siblingPanel) closeItem(sibling, siblingSummary, siblingPanel);
      });
    }

    if (isOpen) {
      closeItem(item, summary, panel);
    } else {
      openItem(item, summary, panel);
    }
  }

  function openItem(item, summary, panel) {
    summary.setAttribute('aria-expanded', 'true');
    item.style.overflow = 'hidden';
    item.setAttribute('open', '');

    const startHeight = summary.offsetHeight;
    const endHeight = summary.offsetHeight + panel.scrollHeight;

    runAnimation(item, startHeight, endHeight, () => {
      item.style.overflow = '';
    });
  }

  function closeItem(item, summary, panel) {
    summary.setAttribute('aria-expanded', 'false');

    const startHeight = summary.offsetHeight + panel.scrollHeight;
    const endHeight = summary.offsetHeight;

    item.style.overflow = 'hidden';

    runAnimation(item, startHeight, endHeight, () => {
      item.removeAttribute('open');
      item.style.overflow = '';
    });
  }

  function runAnimation(item, startHeight, endHeight, onFinish) {
    if (item._faqAnimation) item._faqAnimation.cancel();

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || typeof item.animate !== 'function') {
      onFinish();
      return;
    }

    item._faqAnimation = item.animate(
      { height: [`${startHeight}px`, `${endHeight}px`] },
      { duration: ANIMATION_MS, easing: EASING }
    );

    item._faqAnimation.onfinish = () => {
      item._faqAnimation = null;
      onFinish();
    };

    item._faqAnimation.oncancel = () => {
      item._faqAnimation = null;
    };
  }
})();
