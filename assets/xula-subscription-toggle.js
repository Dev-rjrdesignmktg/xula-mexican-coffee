/* =========================================================
   Xula Subscription Toggle — syncs "One-time purchase" vs
   "Subscribe & Save" with the product form's `selling_plan`
   field, and keeps prices in sync with the selected variant.
   Vanilla JS, no dependencies.
   ========================================================= */

(() => {
  const init = () => {
    document.querySelectorAll('[data-xula-subscription-toggle]').forEach(setup);
  };

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();

  // Re-run when a quick-add/quick-buy modal injects new markup dynamically.
  document.addEventListener('shopify:section:load', init);
  document.addEventListener('xula:content-updated', init);

  function setup(root) {
    if (root.dataset.xstInitialized === 'true') return;
    root.dataset.xstInitialized = 'true';

    const dataScript = root.querySelector('[data-xula-subscription-data]');
    let variantPrices;
    try {
      variantPrices = JSON.parse(dataScript?.textContent || '{}');
    } catch (error) {
      return;
    }

    const onetimeOption = root.querySelector('[data-xula-subscription-option="onetime"]');
    const subscribeOption = root.querySelector('[data-xula-subscription-option="subscribe"]');
    const sellingPlanInput = root.querySelector('[data-xula-subscription-input]');
    const badge = root.querySelector('[data-xula-subscription-badge]');
    const compare = root.querySelector('[data-xula-subscription-compare]');
    const perks = root.querySelector('[data-xula-subscription-perks]');
    const announce = root.querySelector('[data-xula-subscription-announce]');
    const onetimePrice = root.querySelector('[data-xula-subscription-price="onetime"]');
    const subscribePrice = root.querySelector('[data-xula-subscription-price="subscribe"]');
    const badgeTemplate = root.dataset.badgeTemplate || 'Save {percent}%';

    if (!onetimeOption || !subscribeOption || !sellingPlanInput) return;

    const options = [onetimeOption, subscribeOption];
    let selected = root.dataset.defaultPlan === 'subscribe' ? 'subscribe' : 'onetime';

    const formId = root.dataset.productFormId;
    const form = formId ? document.getElementById(formId) : null;
    const variantIdInput = form ? form.querySelector('[name="id"]') : null;

    preselectFromUrl();
    applySelection(selected, { silent: true });

    options.forEach((option) => {
      option.addEventListener('click', () => {
        applySelection(option.dataset.xulaSubscriptionOption);
      });
    });

    root.querySelector('.xula-subscription-toggle__group').addEventListener('keydown', handleKeydown);

    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS === 'object') {
      subscribe(PUB_SUB_EVENTS.variantChange, (event) => {
        if (event.data.sectionId && formId && !formId.includes(event.data.sectionId)) return;
        updatePricesForVariant(event.data.variant?.id);
      });
    } else if (variantIdInput) {
      variantIdInput.addEventListener('change', () => updatePricesForVariant(variantIdInput.value));
    }

    function handleKeydown(event) {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const currentIndex = options.findIndex((option) => option.dataset.xulaSubscriptionOption === selected);
      const nextIndex = (currentIndex + 1) % options.length;
      const nextOption = options[event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? (currentIndex - 1 + options.length) % options.length : nextIndex];
      applySelection(nextOption.dataset.xulaSubscriptionOption);
      nextOption.focus();
    }

    function applySelection(plan, { silent = false } = {}) {
      if (plan === 'subscribe' && subscribeOption.classList.contains('is-disabled')) return;

      selected = plan;

      options.forEach((option) => {
        const isActive = option.dataset.xulaSubscriptionOption === plan;
        option.classList.toggle('is-active', isActive);
        option.setAttribute('aria-checked', String(isActive));
        option.tabIndex = isActive ? 0 : -1;
      });

      if (perks) perks.hidden = plan !== 'subscribe';

      sellingPlanInput.value = plan === 'subscribe' ? subscribeOption.dataset.sellingPlanId || '' : '';

      if (!silent && announce) {
        const label = (plan === 'subscribe' ? subscribeOption : onetimeOption).querySelector(
          '.xula-subscription-toggle__label'
        )?.textContent;
        announce.textContent = label ? `${label} selected` : '';
      }
    }

    function updatePricesForVariant(variantId) {
      if (!variantId) return;
      const entry = variantPrices[String(variantId)];
      if (!entry) return;

      if (onetimePrice) onetimePrice.textContent = entry.oneTimePrice;

      const canSubscribe = Boolean(entry.subscribeAvailable);
      subscribeOption.classList.toggle('is-disabled', !canSubscribe);
      subscribeOption.setAttribute('aria-disabled', String(!canSubscribe));
      subscribeOption.dataset.sellingPlanId = canSubscribe ? entry.sellingPlanId : '';

      if (subscribePrice) subscribePrice.textContent = canSubscribe ? entry.subscribePrice : entry.oneTimePrice;
      if (compare) compare.hidden = !canSubscribe;

      if (badge) {
        const percent =
          canSubscribe && entry.oneTimePriceRaw
            ? Math.round((1 - entry.subscribePriceRaw / entry.oneTimePriceRaw) * 100)
            : 0;
        badge.hidden = percent <= 0;
        if (percent > 0) badge.textContent = badgeTemplate.replace('{percent}', String(percent));
      }

      if (!canSubscribe && selected === 'subscribe') {
        applySelection('onetime', { silent: true });
      } else if (selected === 'subscribe') {
        sellingPlanInput.value = subscribeOption.dataset.sellingPlanId || '';
      }
    }

    function preselectFromUrl() {
      const requestedPlan = new URLSearchParams(window.location.search).get('selling_plan');
      if (requestedPlan && requestedPlan === subscribeOption.dataset.sellingPlanId) {
        selected = 'subscribe';
      }
    }
  }
})();
