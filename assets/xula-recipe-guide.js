/* =========================================================
   Xula Recipe Guide — accessible tabs controller
   (W3C APG tabs pattern: roving tabindex, arrow/home/end nav)
   Vanilla JS, no dependencies.
   ========================================================= */

(() => {
  const init = () => {
    document.querySelectorAll('[data-xrg-root]').forEach(setupRecipeGuide);
  };

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();

  document.addEventListener('shopify:section:load', init);
  document.addEventListener('xula:content-updated', init);

  function setupRecipeGuide(root) {
    if (root.dataset.xrgInitialized === 'true') return;
    root.dataset.xrgInitialized = 'true';

    const tablist = root.querySelector('[data-xrg-tablist]');
    const tabs = Array.from(root.querySelectorAll('[data-xrg-tab]'));
    const panels = Array.from(root.querySelectorAll('[data-xrg-panel]'));
    if (!tablist || !tabs.length || !panels.length) return;

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateTab(tab, { focus: false }));
      tab.addEventListener('keydown', (event) => handleKeydown(event, index));
    });

    function handleKeydown(event, index) {
      let nextIndex = null;

      switch (event.key) {
        case 'ArrowRight':
          nextIndex = (index + 1) % tabs.length;
          break;
        case 'ArrowLeft':
          nextIndex = (index - 1 + tabs.length) % tabs.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      activateTab(tabs[nextIndex], { focus: true });
    }

    function activateTab(tab, { focus }) {
      const method = tab.dataset.method;

      tabs.forEach((t) => {
        const isActive = t === tab;
        t.classList.toggle('is-active', isActive);
        t.setAttribute('aria-selected', String(isActive));
        t.tabIndex = isActive ? 0 : -1;
      });

      panels.forEach((panel) => {
        const isActive = panel.id === tab.getAttribute('aria-controls');
        panel.classList.toggle('is-active', isActive);
        if (isActive) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      });

      if (focus) tab.focus();

      root.dispatchEvent(new CustomEvent('xula:recipe-guide:change', {
        bubbles: true,
        detail: { method },
      }));
    }
  }
})();
