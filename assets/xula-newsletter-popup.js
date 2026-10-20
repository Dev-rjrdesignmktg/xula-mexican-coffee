/* =========================================================
   Xula Newsletter Popup — timed / scroll / exit-intent
   signup modal with frequency capping, AJAX submit, swipe-
   to-close bottom sheet on mobile and a floating reminder.
   Vanilla JS, no dependencies.
   ========================================================= */

(() => {
  if (window.XulaNewsletterPopup) return;

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesktop = window.matchMedia('(min-width: 750px)');
  const instances = new Map();

  const storage = {
    get(store, key) {
      try { return window[store].getItem(key); } catch (e) { return null; }
    },
    set(store, key, value) {
      try { window[store].setItem(key, value); } catch (e) { /* storage blocked */ }
    },
  };

  function init(root) {
    if (!root || instances.has(root)) return;

    const dialog = root.querySelector('[data-xula-popup-dialog]');
    if (!dialog) return;

    const card = dialog.querySelector('[data-xula-popup-card]');
    const form = dialog.querySelector('[data-xula-popup-form]');
    const input = dialog.querySelector('[data-xula-popup-input]');
    const submitBtn = dialog.querySelector('[data-xula-popup-submit]');
    const submitLabel = dialog.querySelector('[data-xula-popup-submit-label]');
    const statusEl = dialog.querySelector('[data-xula-popup-status]');
    const formStep = dialog.querySelector('[data-xula-popup-step="form"]');
    const successStep = dialog.querySelector('[data-xula-popup-step="success"]');
    const successHeading = dialog.querySelector('[data-xula-popup-success-heading]');
    const teaser = root.querySelector('[data-xula-popup-teaser]');

    const data = root.dataset;
    const designMode = data.designMode === 'true';
    const keyBase = `xula-popup:${data.version || 'v1'}`;
    const keys = {
      subscribed: `${keyBase}:subscribed`,
      dismissedAt: `${keyBase}:dismissed-at`,
      session: `${keyBase}:session`,
      teaserOff: `${keyBase}:teaser-off`,
    };
    const frequencyDays = Number(data.frequency) || 0;
    const cleanups = [];
    let triggered = false;
    let closeTimer = null;
    let lastFocus = null;

    const isSubscribed = () => storage.get('localStorage', keys.subscribed) === '1';

    const isSnoozed = () => {
      if (frequencyDays === 0) return storage.get('sessionStorage', keys.session) === '1';
      const dismissedAt = Number(storage.get('localStorage', keys.dismissedAt));
      if (!dismissedAt) return false;
      return Date.now() - dismissedAt < frequencyDays * 864e5;
    };

    const on = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      cleanups.push(() => target.removeEventListener(type, handler, options));
    };

    /* ---------- Open / close ---------- */

    function open() {
      if (dialog.open) return;
      lastFocus = document.activeElement;
      clearTimeout(closeTimer);
      hideTeaser();

      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');

      document.documentElement.classList.add('xula-popup-lock');
      card.style.transform = '';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => dialog.classList.add('is-open'));
      });

      // Avoid popping the keyboard on touch devices.
      if (isDesktop.matches && input && successStep.hidden) {
        setTimeout(() => input.focus({ preventScroll: true }), 350);
      } else {
        card.focus({ preventScroll: true });
      }
    }

    function close(reason = 'dismiss') {
      if (!dialog.open) return;
      dialog.classList.remove('is-open');

      if (!designMode && reason === 'dismiss') {
        storage.set('localStorage', keys.dismissedAt, String(Date.now()));
        storage.set('sessionStorage', keys.session, '1');
      }

      const finish = () => {
        if (!dialog.open) return;
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
        document.documentElement.classList.remove('xula-popup-lock');
        card.style.transform = '';
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
        if (!designMode && !isSubscribed()) showTeaser();
      };

      closeTimer = setTimeout(finish, reduceMotion ? 0 : 450);
    }

    /* ---------- Floating reminder ---------- */

    function showTeaser() {
      if (!teaser || storage.get('localStorage', keys.teaserOff) === '1') return;
      teaser.hidden = false;
      teaser.classList.add('is-entering');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => teaser.classList.remove('is-entering'));
      });
    }

    function hideTeaser() {
      if (teaser) teaser.hidden = true;
    }

    if (teaser) {
      const reopen = teaser.querySelector('[data-xula-popup-reopen]');
      const dismiss = teaser.querySelector('[data-xula-popup-teaser-dismiss]');
      if (reopen) on(reopen, 'click', open);
      if (dismiss) {
        on(dismiss, 'click', () => {
          storage.set('localStorage', keys.teaserOff, '1');
          hideTeaser();
        });
      }
    }

    /* ---------- Dialog interactions ---------- */

    dialog.querySelectorAll('[data-xula-popup-close]').forEach((btn) => {
      on(btn, 'click', () => close('dismiss'));
    });

    // Escape key
    on(dialog, 'cancel', (event) => {
      event.preventDefault();
      close('dismiss');
    });

    // Backdrop click: the dialog element itself only receives clicks outside the card.
    on(dialog, 'click', (event) => {
      if (event.target === dialog) close('dismiss');
    });

    setupSwipe();

    function setupSwipe() {
      let startY = 0;
      let delta = 0;
      let dragging = false;

      on(card, 'touchstart', (event) => {
        if (isDesktop.matches || card.scrollTop > 0) return;
        startY = event.touches[0].clientY;
        delta = 0;
        dragging = true;
      }, { passive: true });

      on(card, 'touchmove', (event) => {
        if (!dragging) return;
        delta = Math.max(0, event.touches[0].clientY - startY);
        if (delta > 0) {
          card.classList.add('is-dragging');
          card.style.transform = `translateY(${delta}px)`;
        }
      }, { passive: true });

      on(card, 'touchend', () => {
        if (!dragging) return;
        dragging = false;
        card.classList.remove('is-dragging');
        if (delta > 110) {
          close('dismiss');
        } else {
          card.style.transform = '';
        }
      });
    }

    /* ---------- Form ---------- */

    if (form && input && submitBtn) {
      const defaultLabel = submitLabel ? submitLabel.textContent : '';
      const honeypot = form.querySelector('input[name="contact[company]"]');

      on(input, 'input', () => {
        if (input.getAttribute('aria-invalid') === 'true' && emailPattern.test(input.value.trim())) {
          input.removeAttribute('aria-invalid');
          statusEl.innerHTML = '';
        }
      });

      on(form, 'submit', async (event) => {
        event.preventDefault();
        if (honeypot && honeypot.value.trim() !== '') return;

        const email = input.value.trim();
        if (!emailPattern.test(email)) {
          input.setAttribute('aria-invalid', 'true');
          renderError(data.invalidText);
          input.focus();
          return;
        }

        input.removeAttribute('aria-invalid');
        setLoading(true);

        try {
          const response = await fetch(form.action, {
            method: 'POST',
            body: new FormData(form),
            headers: { Accept: 'application/json' },
          });
          const json = await response.json().catch(() => null);

          if (response.ok && (!json || !json.errors)) {
            showSuccess();
          } else {
            const message = json && json.errors && (json.errors.email || json.errors.form);
            renderError(Array.isArray(message) ? message.join(' ') : message || data.errorText);
          }
        } catch (error) {
          renderError(data.errorText);
        } finally {
          setLoading(false);
        }
      });

      function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        submitBtn.setAttribute('aria-busy', String(isLoading));
        if (submitLabel) submitLabel.textContent = isLoading ? '' : defaultLabel;
      }

      function renderError(text) {
        statusEl.innerHTML = '';
        const message = document.createElement('p');
        message.className = 'xula-popup__error';
        message.setAttribute('role', 'alert');
        message.textContent = text;
        statusEl.appendChild(message);
      }
    }

    function showSuccess() {
      if (!designMode) storage.set('localStorage', keys.subscribed, '1');
      if (form) form.reset();
      formStep.hidden = true;
      successStep.hidden = false;
      hideTeaser();
      if (successHeading) successHeading.focus({ preventScroll: true });
    }

    const copyBtn = dialog.querySelector('[data-xula-popup-copy]');
    if (copyBtn) {
      const copyLabel = copyBtn.querySelector('[data-xula-popup-copy-label]');
      const codeEl = dialog.querySelector('[data-xula-popup-code]');
      const defaultCopy = copyLabel ? copyLabel.textContent : '';

      on(copyBtn, 'click', async () => {
        const code = codeEl ? codeEl.textContent.trim() : '';
        try {
          await navigator.clipboard.writeText(code);
        } catch (e) {
          const range = document.createRange();
          range.selectNodeContents(codeEl);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
        copyBtn.classList.add('is-copied');
        if (copyLabel) copyLabel.textContent = data.copiedText || defaultCopy;
        setTimeout(() => {
          copyBtn.classList.remove('is-copied');
          if (copyLabel) copyLabel.textContent = defaultCopy;
        }, 2200);
      });
    }

    /* ---------- Triggers ---------- */

    function trigger() {
      if (triggered) return;
      triggered = true;
      teardownTriggers();
      open();
    }

    const triggerCleanups = [];
    function teardownTriggers() {
      triggerCleanups.splice(0).forEach((fn) => fn());
    }

    function armTriggers() {
      const delay = Number(data.delay);
      const timer = setTimeout(trigger, (Number.isFinite(delay) ? delay : 8) * 1000);
      triggerCleanups.push(() => clearTimeout(timer));

      const depth = Number(data.scroll);
      if (depth > 0) {
        const onScroll = () => {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          if (max > 0 && (window.scrollY / max) * 100 >= depth) trigger();
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        triggerCleanups.push(() => window.removeEventListener('scroll', onScroll));
      }

      if (data.exitIntent === 'true' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        const onLeave = (event) => {
          if (!event.relatedTarget && event.clientY <= 0) trigger();
        };
        document.addEventListener('mouseout', onLeave);
        triggerCleanups.push(() => document.removeEventListener('mouseout', onLeave));
      }
    }

    const postedSuccessfully = !!dialog.querySelector('[data-xula-popup-posted]');

    if (postedSuccessfully) {
      // No-JS fallback round-trip: reopen straight on the confirmation.
      showSuccess();
      open();
    } else if (!designMode && data.enabled === 'true' && !isSubscribed()) {
      if (isSnoozed()) showTeaser();
      else armTriggers();
    }

    instances.set(root, {
      open,
      close,
      destroy() {
        teardownTriggers();
        cleanups.splice(0).forEach((fn) => fn());
        if (dialog.open) {
          if (typeof dialog.close === 'function') dialog.close();
          document.documentElement.classList.remove('xula-popup-lock');
        }
        instances.delete(root);
      },
    });
  }

  function initAll(scope = document) {
    scope.querySelectorAll('[data-xula-popup]').forEach(init);
  }

  /* ---------- Theme editor ---------- */

  const findInstance = (sectionId) => {
    for (const [root, instance] of instances) {
      if (root.dataset.sectionId === sectionId) return instance;
    }
    return null;
  };

  document.addEventListener('shopify:section:load', (event) => {
    initAll(event.target);
  });

  document.addEventListener('shopify:section:unload', (event) => {
    event.target.querySelectorAll('[data-xula-popup]').forEach((root) => {
      const instance = instances.get(root);
      if (instance) instance.destroy();
    });
  });

  document.addEventListener('shopify:section:select', (event) => {
    const instance = findInstance(event.detail.sectionId);
    if (instance) instance.open();
  });

  document.addEventListener('shopify:block:select', (event) => {
    const instance = findInstance(event.detail.sectionId);
    if (instance) instance.open();
  });

  document.addEventListener('shopify:section:deselect', (event) => {
    const instance = findInstance(event.detail.sectionId);
    if (instance) instance.close('editor');
  });

  window.XulaNewsletterPopup = { open: (id) => { const i = findInstance(id); if (i) i.open(); } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll());
  } else {
    initAll();
  }
})();
