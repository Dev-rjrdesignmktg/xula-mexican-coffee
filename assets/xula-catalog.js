/* =========================================================
   Xula Catalog — Tabs, Carousel, Glassmorphism Quick Add
   Vanilla JS, no dependencies.
   ========================================================= */

(() => {
  const IS_TOUCH = matchMedia('(hover: none)').matches;

  document.querySelectorAll('[data-xula-catalog]').forEach((root) => {
    initTabs(root);
    root.querySelectorAll('[data-xula-carousel]').forEach(initCarousel);
    root.querySelectorAll('[data-xula-product-card]').forEach(initGlassCard);
  });

  /* -----------------------------------------------------
     Tabs (WAI-ARIA tabs pattern)
     ----------------------------------------------------- */
  function initTabs(root) {
    const tablist = root.querySelector('[data-xula-catalog-tablist]');
    if (!tablist) return;

    const tabs = Array.from(tablist.querySelectorAll('[data-xula-catalog-tab]'));
    const panels = Array.from(root.querySelectorAll('[data-xula-catalog-panel]'));

    const activate = (index, focusTab) => {
      tabs.forEach((tab, i) => {
        const selected = i === index;
        tab.classList.toggle('is-active', selected);
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
      });

      panels.forEach((panel, i) => {
        const selected = i === index;
        panel.classList.toggle('is-active', selected);
        if (selected) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      });

      if (focusTab) tabs[index].focus();
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(index, false));

      tab.addEventListener('keydown', (event) => {
        let newIndex = null;

        switch (event.key) {
          case 'ArrowRight':
            newIndex = (index + 1) % tabs.length;
            break;
          case 'ArrowLeft':
            newIndex = (index - 1 + tabs.length) % tabs.length;
            break;
          case 'Home':
            newIndex = 0;
            break;
          case 'End':
            newIndex = tabs.length - 1;
            break;
          default:
            return;
        }

        event.preventDefault();
        activate(newIndex, true);
      });
    });
  }

  /* -----------------------------------------------------
     Carousel — paginated slider with dot navigation
     (no lateral drag/scroll; controlled by arrows + dots)
     ----------------------------------------------------- */
  function initCarousel(carousel) {
    const viewport = carousel.querySelector('.xula-catalog__viewport');
    const track = carousel.querySelector('[data-xula-carousel-track]');
    const prevBtn = carousel.querySelector('[data-xula-carousel-prev]');
    const nextBtn = carousel.querySelector('[data-xula-carousel-next]');
    const panel = carousel.closest('[data-xula-catalog-panel]');
    const dotsContainer = panel?.querySelector('[data-xula-carousel-dots]');
    if (!viewport || !track) return;

    const slides = Array.from(track.querySelectorAll('[data-xula-carousel-slide]'));
    if (!slides.length) return;

    let current = 0;
    let totalPages = 1;

    const perView = () => {
      const value = parseInt(getComputedStyle(carousel).getPropertyValue('--xula-per-view'), 10);
      return Number.isFinite(value) && value > 0 ? value : 1;
    };

    const buildDots = () => {
      if (!dotsContainer) return;
      dotsContainer.innerHTML = '';
      for (let i = 0; i < totalPages; i += 1) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'xula-catalog__dot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', `Go to slide group ${i + 1}`);
        dot.addEventListener('click', () => goTo(i));
        dotsContainer.appendChild(dot);
      }
    };

    const updateControls = () => {
      const dots = dotsContainer ? Array.from(dotsContainer.children) : [];
      dots.forEach((dot, i) => {
        const active = i === current;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', String(active));
      });

      if (prevBtn) prevBtn.disabled = current === 0;
      if (nextBtn) nextBtn.disabled = current === totalPages - 1;
      if (dotsContainer) dotsContainer.hidden = totalPages <= 1;
    };

    const goTo = (index) => {
      current = Math.max(0, Math.min(index, totalPages - 1));
      const viewportWidth = viewport.clientWidth;
      const maxOffset = Math.max(0, track.scrollWidth - viewportWidth);
      const offset = Math.min(current * viewportWidth, maxOffset);
      track.style.transform = `translateX(-${offset}px)`;
      updateControls();
    };

    const recalculate = () => {
      totalPages = Math.max(1, Math.ceil(slides.length / perView()));
      buildDots();
      goTo(Math.min(current, totalPages - 1));
    };

    prevBtn?.addEventListener('click', () => goTo(current - 1));
    nextBtn?.addEventListener('click', () => goTo(current + 1));

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(recalculate, 150);
    });

    recalculate();
  }

  /* -----------------------------------------------------
     Product card — quick add + glassmorphism panel
     ----------------------------------------------------- */
  function initGlassCard(card) {
    const trigger = card.querySelector('[data-xula-quick-add]');
    const glass = card.querySelector('[data-xula-glass]');
    if (!trigger || !glass) return;

    const openGlass = () => {
      glass.classList.add('is-visible');
      glass.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
    };

    const closeGlass = () => {
      glass.classList.remove('is-visible');
      glass.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
    };

    if (IS_TOUCH) {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        const isOpen = glass.classList.contains('is-visible');
        document
          .querySelectorAll('[data-xula-glass].is-visible')
          .forEach((el) => el !== glass && el.classList.remove('is-visible'));
        isOpen ? closeGlass() : openGlass();
      });
    } else {
      trigger.addEventListener('pointerenter', openGlass);
      trigger.addEventListener('focus', openGlass);
      card.addEventListener('pointerleave', closeGlass);
      card.addEventListener('focusout', (event) => {
        if (!card.contains(event.relatedTarget)) closeGlass();
      });
    }

    card.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeGlass();
        trigger.focus();
      }
    });

    document.addEventListener('click', (event) => {
      if (IS_TOUCH && !card.contains(event.target)) closeGlass();
    });

    initAddToCartForm(card, glass);
  }

  /* -----------------------------------------------------
     Add to cart — AJAX, integrates with theme cart drawer
     when present, falls back to a local status message.
     ----------------------------------------------------- */
  function initAddToCartForm(card, glass) {
    const form = glass.querySelector('[data-xula-add-form]');
    const submitBtn = glass.querySelector('[data-xula-add-submit]');
    const message = glass.querySelector('[data-xula-add-message]');
    const variantInput = glass.querySelector('[data-xula-variant-id]');
    const variantSelect = glass.querySelector('[data-xula-variant-select]');

    if (!form || !submitBtn) return;

    variantSelect?.addEventListener('change', () => {
      if (variantInput) variantInput.value = variantSelect.value;
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (submitBtn.getAttribute('aria-disabled') === 'true') return;

      submitBtn.classList.add('is-loading');
      if (message) message.textContent = '';

      const cart =
        document.querySelector('cart-notification') || document.querySelector('cart-drawer');

      const formData = new FormData(form);
      formData.set('id', variantInput ? variantInput.value : formData.get('id'));

      if (cart && typeof cart.getSectionsToRender === 'function') {
        formData.append('sections', cart.getSectionsToRender().map((section) => section.id));
        formData.append('sections_url', window.location.pathname);
      }

      const addUrl =
        (window.routes && window.routes.cart_add_url) || '/cart/add';

      fetch(addUrl, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status) {
            throw new Error(data.description || data.message || 'Unable to add to cart');
          }

          submitBtn.classList.remove('is-loading');
          submitBtn.classList.add('is-added');
          const label = submitBtn.querySelector('.xula-catalog__glass-submit-text');
          const originalLabel = label ? label.textContent : '';
          if (label) label.textContent = 'Added ✓';

          if (typeof window.publish === 'function' && window.PUB_SUB_EVENTS) {
            window.publish(window.PUB_SUB_EVENTS.cartUpdate, {
              source: 'xula-catalog',
              productVariantId: formData.get('id'),
              cartData: data,
            });
          }

          if (cart && typeof cart.renderContents === 'function') {
            cart.renderContents(data);
          } else if (message) {
            message.textContent = 'Added to your cart.';
          }

          setTimeout(() => {
            submitBtn.classList.remove('is-added');
            if (label) label.textContent = originalLabel;
          }, 2200);
        })
        .catch((error) => {
          submitBtn.classList.remove('is-loading');
          if (message) message.textContent = error.message;
        });
    });
  }
})();
