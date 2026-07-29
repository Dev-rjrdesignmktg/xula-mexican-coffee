/* =========================================================
   Xula Product Catalog — Category Filters, Details Disclosure,
   AJAX Add to Cart. Vanilla JS, no dependencies.
   ========================================================= */

(() => {
  document.querySelectorAll('[data-xpc-root]').forEach((root) => {
    initRoot(root);

    // Some roots (e.g. Dawn's <product-recommendations>) inject their
    // cards asynchronously — an IntersectionObserver-triggered fetch()
    // that replaces innerHTML with no event fired. Watch for that and
    // initialize once the real content lands.
    if (!root.querySelector('[data-xpc-item]')) {
      const lazyObserver = new MutationObserver(() => {
        if (root.querySelector('[data-xpc-item]')) {
          lazyObserver.disconnect();
          initRoot(root);
        }
      });
      lazyObserver.observe(root, { childList: true, subtree: true });
    }
  });

  function initRoot(root) {
    initGrid(root);
    root.querySelectorAll('[data-xpc-carousel]').forEach(initCarousel);
    root.querySelectorAll('[data-xpc-card]').forEach(initDetailsToggle);
    root.querySelectorAll('[data-xpc-add-form]').forEach(initAddToCartForm);
  }

  /* -----------------------------------------------------
     Carousel — paginated slider with dot navigation, used
     where cards should scroll instead of stacking (e.g. the
     "You may also like" strip on the product page).
     ----------------------------------------------------- */
  function initCarousel(carousel) {
    const viewport = carousel.querySelector('.xula-product-catalog__viewport');
    const track = carousel.querySelector('[data-xpc-carousel-track]');
    const prevBtn = carousel.querySelector('[data-xpc-carousel-prev]');
    const nextBtn = carousel.querySelector('[data-xpc-carousel-next]');
    const dotsContainer = carousel.parentElement?.querySelector('[data-xpc-carousel-dots]');
    if (!viewport || !track) return;

    const slides = Array.from(track.querySelectorAll('[data-xpc-carousel-slide]'));
    if (!slides.length) return;

    let current = 0;
    let totalPages = 1;

    const perView = () => {
      const value = parseInt(getComputedStyle(carousel).getPropertyValue('--xpc-per-view'), 10);
      return Number.isFinite(value) && value > 0 ? value : 1;
    };

    const buildDots = () => {
      if (!dotsContainer) return;
      dotsContainer.innerHTML = '';
      for (let i = 0; i < totalPages; i += 1) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'xula-product-catalog__dot';
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
     Grid — category filters (WAI-ARIA radiogroup pattern)
     combined with "Show more" pagination
     ----------------------------------------------------- */
  function initGrid(root) {
    const grid = root.querySelector('[data-xpc-grid]');
    const items = Array.from(root.querySelectorAll('[data-xpc-item]'));
    const status = root.querySelector('[data-xpc-filter-status]');
    const empty = root.querySelector('[data-xpc-empty]');
    const loadMoreBtn = root.querySelector('[data-xpc-load-more]');
    const group = root.querySelector('[data-xpc-filters]');
    const buttons = group ? Array.from(group.querySelectorAll('[data-xpc-filter]')) : [];
    if (!items.length) return;

    const perPage = parseInt(grid?.dataset.itemsPerPage, 10) || 8;
    let currentFilter = 'all';
    let visibleCount = perPage;

    const getMatching = () =>
      items.filter((item) => {
        const categories = (item.dataset.categories || '').split(',').filter(Boolean);
        return currentFilter === 'all' || categories.includes(currentFilter);
      });

    const render = () => {
      const matching = getMatching();

      items.forEach((item) => {
        if (!matching.includes(item)) {
          item.hidden = true;
          item.classList.remove('is-entering');
        }
      });

      matching.forEach((item, index) => {
        if (index < visibleCount) {
          if (item.hidden) {
            item.hidden = false;
            item.classList.add('is-entering');
            requestAnimationFrame(() => {
              item.addEventListener(
                'animationend',
                () => item.classList.remove('is-entering'),
                { once: true }
              );
            });
          }
        } else {
          item.hidden = true;
          item.classList.remove('is-entering');
        }
      });

      const shown = Math.min(visibleCount, matching.length);

      if (empty) empty.hidden = matching.length !== 0;
      if (status) {
        status.textContent =
          matching.length === 0
            ? 'No products in this category.'
            : `Showing ${shown} of ${matching.length} product${matching.length === 1 ? '' : 's'}.`;
      }

      if (loadMoreBtn) loadMoreBtn.hidden = shown >= matching.length;
    };

    render();

    loadMoreBtn?.addEventListener('click', () => {
      visibleCount += perPage;
      render();
    });

    if (buttons.length) {
      const selectButton = (index, focusButton) => {
        buttons.forEach((btn, i) => {
          const selected = i === index;
          btn.classList.toggle('is-active', selected);
          btn.setAttribute('aria-checked', String(selected));
          btn.tabIndex = selected ? 0 : -1;
        });

        if (focusButton) buttons[index].focus();
        currentFilter = buttons[index].dataset.filter;
        visibleCount = perPage;
        render();
      };

      buttons.forEach((button, index) => {
        button.addEventListener('click', () => selectButton(index, false));

        button.addEventListener('keydown', (event) => {
          let newIndex = null;

          switch (event.key) {
            case 'ArrowRight':
            case 'ArrowDown':
              newIndex = (index + 1) % buttons.length;
              break;
            case 'ArrowLeft':
            case 'ArrowUp':
              newIndex = (index - 1 + buttons.length) % buttons.length;
              break;
            case 'Home':
              newIndex = 0;
              break;
            case 'End':
              newIndex = buttons.length - 1;
              break;
            default:
              return;
          }

          event.preventDefault();
          selectButton(newIndex, true);
        });
      });
    }
  }

  /* -----------------------------------------------------
     Card details disclosure — accessible expand/collapse
     ----------------------------------------------------- */
  function initDetailsToggle(card) {
    const trigger = card.querySelector('[data-xpc-toggle]');
    const details = card.querySelector('[data-xpc-details]');
    if (!trigger || !details) return;

    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      if (isOpen) {
        details.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        const label = trigger.querySelector('span');
        if (label) label.textContent = 'View details';

        const onEnd = (event) => {
          if (event.target !== details) return;
          details.hidden = true;
          details.removeEventListener('transitionend', onEnd);
        };
        details.addEventListener('transitionend', onEnd);
      } else {
        details.hidden = false;
        requestAnimationFrame(() => details.classList.add('is-open'));
        trigger.setAttribute('aria-expanded', 'true');
        const label = trigger.querySelector('span');
        if (label) label.textContent = 'Hide details';
      }
    });

    card.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') {
        trigger.click();
        trigger.focus();
      }
    });
  }

  /* -----------------------------------------------------
     Add to cart — AJAX, integrates with theme cart drawer
     when present, falls back to a local status message.
     ----------------------------------------------------- */
  function initAddToCartForm(form) {
    const submitBtn = form.querySelector('[data-xpc-add-submit]');
    const message = form.querySelector('[data-xpc-add-message]');
    const variantInput = form.querySelector('[data-xpc-variant-id]');
    const variantSelect = form.querySelector('[data-xpc-variant-select]');
    if (!submitBtn) return;

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

      const addUrl = (window.routes && window.routes.cart_add_url) || '/cart/add';

      fetch(addUrl, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status) {
            throw new Error(data.description || data.message || 'Could not add to cart');
          }

          submitBtn.classList.remove('is-loading');
          submitBtn.classList.add('is-added');
          const label = submitBtn.querySelector('.xula-product-catalog__add-text');
          const originalLabel = label ? label.textContent : '';
          if (label) label.textContent = 'Added ✓';

          if (typeof window.publish === 'function' && window.PUB_SUB_EVENTS) {
            window.publish(window.PUB_SUB_EVENTS.cartUpdate, {
              source: 'xula-product-catalog',
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
