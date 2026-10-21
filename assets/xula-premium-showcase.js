/* =========================================================
   Xula Premium Showcase — variant + purchase option sync and
   AJAX add to cart (integrates with the theme cart drawer /
   notification when present). Vanilla JS, no dependencies.
   ========================================================= */

(() => {
  const init = (scope = document) => {
    scope.querySelectorAll('[data-xula-showcase-form]').forEach(setup);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (event) => init(event.target));

  function setup(form) {
    if (form.dataset.xpsInitialized === 'true') return;
    form.dataset.xpsInitialized = 'true';

    let data;
    try {
      data = JSON.parse(form.querySelector('[data-xula-showcase-data]')?.textContent || '{}');
    } catch (error) {
      return;
    }

    const variants = data.variants || {};
    const variantField = form.querySelector('[data-xula-showcase-variant]');
    const priceEl = form.querySelector('[data-xula-showcase-price]');
    const compareEl = form.querySelector('[data-xula-showcase-compare]');
    const onetimeRadio = form.querySelector('[data-xula-showcase-plan="onetime"]');
    const subscribeRadio = form.querySelector('[data-xula-showcase-plan="subscribe"]');
    const onetimePriceEl = form.querySelector('[data-xula-showcase-plan-price="onetime"]');
    const subscribePriceEl = form.querySelector('[data-xula-showcase-plan-price="subscribe"]');
    const badgeEl = form.querySelector('[data-xula-showcase-plan-badge]');
    const submitBtn = form.querySelector('[data-xula-showcase-submit]');
    const submitText = form.querySelector('[data-xula-showcase-submit-text]');
    const message = form.querySelector('[data-xula-showcase-message]');
    const card = form.closest('[data-xula-showcase-card]');

    const currentVariant = () => variants[String(variantField?.value)] || null;

    const isSubscribing = () => Boolean(subscribeRadio?.checked && !subscribeRadio.disabled);

    const render = () => {
      const variant = currentVariant();
      if (!variant) return;

      const canSubscribe = Boolean(variant.subscribePrice);

      if (subscribeRadio) {
        subscribeRadio.disabled = !canSubscribe;
        if (!canSubscribe && subscribeRadio.checked && onetimeRadio) onetimeRadio.checked = true;
      }

      if (onetimePriceEl) onetimePriceEl.textContent = variant.price;
      if (subscribePriceEl) subscribePriceEl.textContent = variant.subscribePrice || variant.price;
      if (badgeEl) {
        badgeEl.hidden = !(variant.discount > 0);
        badgeEl.textContent = `-${variant.discount}%`;
      }

      if (priceEl) priceEl.textContent = isSubscribing() ? variant.subscribePrice : variant.price;
      if (compareEl) {
        const compare = isSubscribing() ? variant.price : variant.compare;
        compareEl.hidden = !compare;
        compareEl.textContent = compare || '';
      }

      if (submitBtn) {
        submitBtn.setAttribute('aria-disabled', String(!variant.available));
        if (submitText) submitText.textContent = variant.available ? data.addLabel : data.soldOutLabel;
      }
      card?.classList.toggle('is-sold-out', !variant.available);
    };

    variantField?.addEventListener('change', render);
    onetimeRadio?.addEventListener('change', render);
    subscribeRadio?.addEventListener('change', render);
    render();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!submitBtn || submitBtn.getAttribute('aria-disabled') === 'true') return;

      submitBtn.classList.add('is-loading');
      submitBtn.setAttribute('aria-busy', 'true');
      setMessage('');

      const cart = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
      const formData = new FormData(form);

      if (!formData.get('selling_plan')) formData.delete('selling_plan');

      if (cart && typeof cart.getSectionsToRender === 'function') {
        formData.append('sections', cart.getSectionsToRender().map((section) => section.id));
        formData.append('sections_url', window.location.pathname);
        if (typeof cart.setActiveElement === 'function') cart.setActiveElement(submitBtn);
      }

      const addUrl = (window.routes && window.routes.cart_add_url) || form.action || '/cart/add';

      fetch(addUrl, {
        method: 'POST',
        headers: { Accept: 'application/javascript', 'X-Requested-With': 'XMLHttpRequest' },
        body: formData,
      })
        .then((response) => response.json())
        .then((response) => {
          if (response.status) {
            throw new Error(response.description || response.message || 'Unable to add to cart');
          }

          if (typeof window.publish === 'function' && window.PUB_SUB_EVENTS) {
            window.publish(window.PUB_SUB_EVENTS.cartUpdate, {
              source: 'xula-premium-showcase',
              productVariantId: formData.get('id'),
              cartData: response,
            });
          }

          if (cart && typeof cart.renderContents === 'function') {
            cart.classList.remove('is-empty');
            cart.renderContents(response);
          }

          showAdded();
        })
        .catch((error) => {
          setMessage(error.message, true);
        })
        .finally(() => {
          submitBtn.classList.remove('is-loading');
          submitBtn.removeAttribute('aria-busy');
        });
    });

    function showAdded() {
      if (!submitText) return;
      submitBtn.classList.add('is-added');
      submitText.textContent = data.addedLabel;
      setMessage(data.addedLabel);

      setTimeout(() => {
        submitBtn.classList.remove('is-added');
        render();
        setMessage('');
      }, 2400);
    }

    function setMessage(text, isError = false) {
      if (!message) return;
      message.textContent = text;
      message.classList.toggle('is-error', isError);
    }
  }
  /* -----------------------------------------------------
     <xula-showcase-select> — accessible listbox that mirrors the
     native <select>. Markup is server-rendered; the custom element
     upgrades itself whenever it lands in the DOM (page load, theme
     editor re-render, AJAX). Until then the styled native select
     is shown. The <select> stays the source of truth for the form.
     ----------------------------------------------------- */
  if (!customElements.get('xula-showcase-select')) {
    customElements.define(
      'xula-showcase-select',
      class XulaShowcaseSelect extends HTMLElement {
        connectedCallback() {
          if (this.initialized) return;
          this.select = this.querySelector('select');
          this.toggle = this.querySelector('[data-dropdown-toggle]');
          this.list = this.querySelector('[data-dropdown-list]');
          if (!this.select || !this.toggle || !this.list) return;

          this.initialized = true;
          this.items = Array.from(this.list.querySelectorAll('[data-dropdown-option]'));
          this.options = Array.from(this.select.options);
          this.activeIndex = this.select.selectedIndex;
          this.typeahead = '';

          this.select.tabIndex = -1;
          const label = this.select.id && document.querySelector(`label[for="${this.select.id}"]`);
          if (label) label.htmlFor = this.toggle.id;

          this.onOutside = (event) => {
            if (!this.contains(event.target)) this.close(false);
          };

          this.toggle.addEventListener('click', () => (this.isOpen() ? this.close() : this.open()));
          this.toggle.addEventListener('keydown', (event) => {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
              event.preventDefault();
              this.open();
            }
          });

          this.items.forEach((item, index) => {
            item.addEventListener('click', () => this.choose(index));
            item.addEventListener('pointermove', () => this.setActive(index, false));
          });

          this.list.addEventListener('keydown', (event) => this.onListKeydown(event));
          this.select.addEventListener('change', () => this.sync());

          this.classList.add('is-enhanced');
          this.sync();
        }

        disconnectedCallback() {
          document.removeEventListener('pointerdown', this.onOutside, true);
        }

        isOpen() {
          return !this.list.hidden;
        }

        open() {
          if (this.isOpen()) return;
          this.list.hidden = false;
          this.list.classList.toggle('is-above', this.shouldOpenUp());
          this.toggle.setAttribute('aria-expanded', 'true');
          this.setActive(Math.max(0, this.select.selectedIndex));
          this.list.focus({ preventScroll: true });
          document.addEventListener('pointerdown', this.onOutside, true);
        }

        // Opens upward; flips down only when there is not enough room above
        // and more room below.
        shouldOpenUp() {
          const listHeight = this.list.offsetHeight;
          const toggleRect = this.toggle.getBoundingClientRect();
          const spaceAbove = toggleRect.top;
          const spaceBelow = window.innerHeight - toggleRect.bottom;
          return !(spaceAbove < listHeight && spaceBelow > spaceAbove);
        }

        close(returnFocus = true) {
          if (!this.isOpen()) return;
          this.list.hidden = true;
          this.toggle.setAttribute('aria-expanded', 'false');
          document.removeEventListener('pointerdown', this.onOutside, true);
          if (returnFocus) this.toggle.focus();
        }

        choose(index) {
          if (!this.options[index] || this.options[index].disabled) return;
          if (this.select.selectedIndex !== index) {
            this.select.selectedIndex = index;
            this.select.dispatchEvent(new Event('change', { bubbles: true }));
          }
          this.sync();
          this.close();
        }

        setActive(index, scroll = true) {
          this.activeIndex = index;
          this.items.forEach((item, i) => item.classList.toggle('is-active', i === index));
          this.list.setAttribute('aria-activedescendant', this.items[index].id);
          if (scroll) this.items[index].scrollIntoView({ block: 'nearest' });
        }

        sync() {
          const index = this.select.selectedIndex;
          const item = this.items[index];
          if (!item) return;
          this.querySelector('[data-dropdown-value]').textContent =
            item.querySelector('.xula-premium-showcase__dropdown-option-title').textContent;
          this.querySelector('[data-dropdown-price]').textContent =
            item.querySelector('.xula-premium-showcase__dropdown-option-price').textContent;
          this.items.forEach((el, i) => el.setAttribute('aria-selected', String(i === index)));
        }

        onListKeydown(event) {
          const last = this.items.length - 1;
          switch (event.key) {
            case 'ArrowDown':
              event.preventDefault();
              this.setActive(Math.min(this.activeIndex + 1, last));
              break;
            case 'ArrowUp':
              event.preventDefault();
              this.setActive(Math.max(this.activeIndex - 1, 0));
              break;
            case 'Home':
              event.preventDefault();
              this.setActive(0);
              break;
            case 'End':
              event.preventDefault();
              this.setActive(last);
              break;
            case 'Enter':
            case ' ':
              event.preventDefault();
              this.choose(this.activeIndex);
              break;
            case 'Escape':
              event.preventDefault();
              this.close();
              break;
            case 'Tab':
              this.close(false);
              break;
            default:
              if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                clearTimeout(this.typeaheadTimer);
                this.typeahead += event.key.toLowerCase();
                this.typeaheadTimer = setTimeout(() => (this.typeahead = ''), 500);
                const match = this.items.findIndex((item) =>
                  item.textContent.trim().toLowerCase().startsWith(this.typeahead)
                );
                if (match > -1) this.setActive(match);
              }
          }
        }
      }
    );
  }
})();
