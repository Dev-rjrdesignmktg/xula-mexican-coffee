/* =========================================================
   Xula Product Meta — attaches the displayed coffee profile
   (Roast, Intensity, Body, Acidity, Notes) as cart line item
   properties, so they persist through native Shopify checkout.
   Vanilla JS, no dependencies.
   ========================================================= */

(() => {
  const init = () => {
    document.querySelectorAll('[data-xpm-root]').forEach(setupProductMeta);
  };

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();

  // Re-run when a quick-add/quick-buy modal injects new markup dynamically.
  document.addEventListener('shopify:section:load', init);
  document.addEventListener('xula:content-updated', init);

  function setupProductMeta(root) {
    if (root.dataset.xpmInitialized === 'true') return;
    root.dataset.xpmInitialized = 'true';

    let properties;
    try {
      properties = JSON.parse(root.dataset.xpmProperties || '{}');
    } catch (error) {
      return;
    }

    const keys = Object.keys(properties).filter((key) => {
      const value = properties[key];
      return value !== null && value !== undefined && String(value).trim() !== '';
    });
    if (!keys.length) return;

    const form = findCartForm(root);
    if (!form) return;

    injectProperties(form, properties, keys);

    // If the theme swaps the form (variant change re-render, AJAX quick-add), reattach.
    const observer = new MutationObserver(() => {
      if (!form.isConnected) {
        observer.disconnect();
        return;
      }
      if (!form.querySelector('[data-xpm-field]')) {
        injectProperties(form, properties, keys);
      }
    });
    observer.observe(form, { childList: true, subtree: false });
  }

  function findCartForm(root) {
    const customSelector = root.dataset.xpmScopeSelector;
    if (customSelector) {
      const scoped = document.querySelector(customSelector);
      if (scoped) return scoped;
    }

    const closestForm = root.closest('form[action*="/cart/add"]');
    if (closestForm) return closestForm;

    const scopeWrap = root.closest('[data-xpm-scope]');
    if (scopeWrap) {
      const scopedForm = scopeWrap.querySelector('form[action*="/cart/add"]');
      if (scopedForm) return scopedForm;
    }

    return document.querySelector('form[action*="/cart/add"]');
  }

  function injectProperties(form, properties, keys) {
    form.querySelectorAll('[data-xpm-field]').forEach((field) => field.remove());

    keys.forEach((key) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = `properties[${key}]`;
      input.value = properties[key];
      input.setAttribute('data-xpm-field', '');
      form.appendChild(input);
    });
  }
})();
