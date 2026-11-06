/* =========================================================
   Xula Newsletter Popup — timed / scroll / exit-intent
   signup modal that subscribes to a Klaviyo list (Client
   Subscriptions API), with frequency capping, page/device
   targeting, A/B copy test, analytics events, swipe-to-close
   bottom sheet on mobile and a floating reminder.
   Vanilla JS, no dependencies.
   ========================================================= */

(() => {
  if (window.XulaNewsletterPopup) return;

  const KLAVIYO_ENDPOINT = 'https://a.klaviyo.com/client/subscriptions';
  const KLAVIYO_REVISION = '2026-10-15';
  const SOURCE = 'Xula Newsletter Popup';
  const SUBSCRIBED_KEY = 'xula_popup_subscribed';
  const FROM_EMAIL_KEY = 'xula_popup_from_email';

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

  // Visitors arriving from a Klaviyo email are already on the list.
  const cameFromEmail = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('utm_source') === 'klaviyo' || params.has('_kx')) {
        storage.set('sessionStorage', FROM_EMAIL_KEY, '1');
        return true;
      }
    } catch (e) { /* URLSearchParams unsupported */ }
    return storage.get('sessionStorage', FROM_EMAIL_KEY) === '1';
  })();

  const device = () => (isDesktop.matches ? 'desktop' : 'mobile');

  /* ---------- Analytics (all optional, never throws) ---------- */

  function emit(event, props) {
    const snake = event.toLowerCase().replace(/\s+/g, '_');

    try {
      const k = window.klaviyo;
      let result;
      if (k && typeof k.track === 'function') result = k.track(event, props);
      else if (k && typeof k.push === 'function') k.push(['track', event, props]);
      else if (Array.isArray(window._learnq)) window._learnq.push(['track', event, props]);
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (e) { /* klaviyo unavailable */ }

    try {
      if (typeof window.gtag === 'function') window.gtag('event', snake, props);
    } catch (e) { /* gtag unavailable */ }

    try {
      const analytics = window.Shopify && window.Shopify.analytics;
      if (analytics && typeof analytics.publish === 'function') analytics.publish(`xula_${snake}`, props);
    } catch (e) { /* custom pixels unavailable */ }
  }

  function init(root) {
    if (!root || instances.has(root)) return;

    const dialog = root.querySelector('[data-xula-popup-dialog]');
    if (!dialog) return;

    const card = dialog.querySelector('[data-xula-popup-card]');
    const form = dialog.querySelector('[data-xula-popup-form]');
    const input = dialog.querySelector('[data-xula-popup-input]');
    const honeypot = dialog.querySelector('[data-xula-popup-hp]');
    const submitBtn = dialog.querySelector('[data-xula-popup-submit]');
    const submitLabel = dialog.querySelector('[data-xula-popup-submit-label]');
    const statusEl = dialog.querySelector('[data-xula-popup-status]');
    const formStep = dialog.querySelector('[data-xula-popup-step="form"]');
    const successStep = dialog.querySelector('[data-xula-popup-step="success"]');
    const successHeading = dialog.querySelector('[data-xula-popup-success-heading]');
    const teaser = root.querySelector('[data-xula-popup-teaser]');

    const data = root.dataset;
    const designMode = data.designMode === 'true';
    const campaignId = data.version || 'v1';
    const keyBase = `xula-popup:${campaignId}`;
    const keys = {
      dismissedAt: `${keyBase}:dismissed-at`,
      session: `${keyBase}:session`,
      teaserOff: `${keyBase}:teaser-off`,
      variant: `xula_popup_variant:${campaignId}`,
    };
    const frequencyDays = Number(data.frequency) || 0;
    const listId = (data.klaviyoList || '').trim();
    const publicKey = (data.klaviyoKey || '').trim();
    const cleanups = [];
    let triggered = false;
    let closeTimer = null;
    let lastFocus = null;
    let submitting = false;

    const isSubscribed = () => storage.get('localStorage', SUBSCRIBED_KEY) === campaignId;

    const isSnoozed = () => {
      if (frequencyDays === 0) return storage.get('sessionStorage', keys.session) === '1';
      const dismissedAt = Number(storage.get('localStorage', keys.dismissedAt));
      if (!dismissedAt) return false;
      return Date.now() - dismissedAt < frequencyDays * 864e5;
    };

    const deviceAllowed = () => (isDesktop.matches ? data.showDesktop : data.showMobile) === 'true';

    const on = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      cleanups.push(() => target.removeEventListener(type, handler, options));
    };

    /* ---------- A/B variant ---------- */

    const variant = assignVariant();
    const eventProps = (extra) => ({
      campaign_id: campaignId,
      variant,
      page_type: data.pageType || '',
      device: device(),
      ...extra,
    });
    const track = (event, extra) => {
      if (!designMode) emit(event, eventProps(extra));
    };

    function assignVariant() {
      const hasB = Boolean(data.bHeading || data.bText || data.bButton);
      const split = Math.min(100, Math.max(0, Number(data.abSplit) || 0));
      if (designMode || !hasB || split === 0) return 'A';

      let stored = storage.get('localStorage', keys.variant);
      if (stored !== 'A' && stored !== 'B') {
        stored = Math.random() * 100 < split ? 'B' : 'A';
        storage.set('localStorage', keys.variant, stored);
      }

      if (stored === 'B') {
        const heading = dialog.querySelector('[data-xula-popup-heading]');
        const text = dialog.querySelector('[data-xula-popup-text]');
        if (data.bHeading && heading) heading.textContent = data.bHeading;
        if (data.bText && text) text.textContent = data.bText;
        if (data.bButton && submitLabel) submitLabel.textContent = data.bButton;
      }
      return stored;
    }

    /* ---------- Open / close ---------- */

    function open(trigger = 'manual') {
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

      track('Popup Viewed', { trigger });
    }

    function close(reason = 'dismiss') {
      if (!dialog.open) return;
      dialog.classList.remove('is-open');

      if (!designMode && reason === 'dismiss') {
        storage.set('localStorage', keys.dismissedAt, String(Date.now()));
        storage.set('sessionStorage', keys.session, '1');
      }
      if (reason !== 'editor') track('Popup Closed', { close_reason: reason });

      const finish = () => {
        if (!dialog.open) return;
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
        document.documentElement.classList.remove('xula-popup-lock');
        card.style.transform = '';
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
        if (!designMode && canShowTeaser()) showTeaser();
      };

      closeTimer = setTimeout(finish, reduceMotion ? 0 : 450);
    }

    /* ---------- Floating reminder ---------- */

    function canShowTeaser() {
      return !isSubscribed() && !cameFromEmail && deviceAllowed()
        && storage.get('localStorage', keys.teaserOff) !== '1';
    }

    function showTeaser() {
      if (!teaser) return;
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
      if (reopen) {
        on(reopen, 'click', () => {
          track('Popup Reminder Clicked');
          open('reminder');
        });
      }
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

    // Focus trap: keep Tab cycling inside the card (also covers browsers without showModal).
    on(dialog, 'keydown', (event) => {
      if (event.key === 'Escape' && typeof dialog.showModal !== 'function') {
        close('dismiss');
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = Array.from(
        card.querySelectorAll('a[href], button:not([disabled]), input:not([tabindex="-1"]):not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !card.contains(active) || active === card)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
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

    /* ---------- Form → Klaviyo ---------- */

    if (form && input && submitBtn) {
      const defaultLabel = submitLabel ? submitLabel.textContent : '';

      on(input, 'input', () => {
        if (input.getAttribute('aria-invalid') === 'true' && emailPattern.test(input.value.trim())) {
          input.removeAttribute('aria-invalid');
          statusEl.innerHTML = '';
        }
      });

      on(form, 'submit', async (event) => {
        event.preventDefault();
        if (submitting) return;

        // Likely bot: pretend it worked, send nothing.
        if (honeypot && honeypot.value.trim() !== '') {
          showSuccess(false);
          return;
        }

        const email = input.value.trim();
        if (!emailPattern.test(email)) {
          input.setAttribute('aria-invalid', 'true');
          renderError(data.invalidText);
          input.focus();
          return;
        }
        input.removeAttribute('aria-invalid');

        if (!listId || !publicKey) {
          console.warn('[Xula popup] Klaviyo public key or list ID missing; signup not sent.');
          renderError(data.errorText);
          return;
        }

        setLoading(true);

        try {
          const response = await fetch(`${KLAVIYO_ENDPOINT}?company_id=${encodeURIComponent(publicKey)}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/vnd.api+json',
              Accept: 'application/vnd.api+json',
              revision: KLAVIYO_REVISION,
            },
            body: JSON.stringify(buildPayload(email)),
          });

          if (response.status === 202 || response.ok) {
            identify(email);
            track('Popup Submitted');
            showSuccess(true);
          } else {
            renderError(data.errorText);
          }
        } catch (error) {
          renderError(data.errorText);
        } finally {
          setLoading(false);
        }
      });

      function buildPayload(email) {
        return {
          data: {
            type: 'subscription',
            attributes: {
              custom_source: SOURCE,
              profile: {
                data: {
                  type: 'profile',
                  attributes: {
                    email,
                    properties: {
                      source: SOURCE,
                      campaign_id: campaignId,
                      variant,
                      page_url: window.location.href,
                    },
                    subscriptions: {
                      email: { marketing: { consent: 'SUBSCRIBED' } },
                    },
                  },
                },
              },
            },
            relationships: {
              list: { data: { type: 'list', id: listId } },
            },
          },
        };
      }

      function identify(email) {
        try {
          const k = window.klaviyo;
          if (k && typeof k.identify === 'function') {
            const result = k.identify({ email });
            if (result && typeof result.catch === 'function') result.catch(() => {});
          }
        } catch (e) { /* klaviyo unavailable */ }
      }

      function setLoading(isLoading) {
        submitting = isLoading;
        submitBtn.disabled = isLoading;
        submitBtn.setAttribute('aria-busy', String(isLoading));
        input.readOnly = isLoading;
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

    function showSuccess(persist) {
      if (persist && !designMode) storage.set('localStorage', SUBSCRIBED_KEY, campaignId);
      if (form) form.reset();
      if (statusEl) statusEl.innerHTML = '';
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

    function trigger(source) {
      if (triggered) return;
      triggered = true;
      teardownTriggers();
      open(source);
    }

    const triggerCleanups = [];
    function teardownTriggers() {
      triggerCleanups.splice(0).forEach((fn) => fn());
    }

    function armTriggers() {
      const delay = Number(isDesktop.matches ? data.delay : data.mobileDelay);
      const timer = setTimeout(() => trigger('delay'), (Number.isFinite(delay) ? delay : 8) * 1000);
      triggerCleanups.push(() => clearTimeout(timer));

      const depth = Number(data.scroll);
      if (depth > 0) {
        const onScroll = () => {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          if (max > 0 && (window.scrollY / max) * 100 >= depth) trigger('scroll');
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        triggerCleanups.push(() => window.removeEventListener('scroll', onScroll));
      }

      if (data.exitIntent === 'true' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        const onLeave = (event) => {
          if (!event.relatedTarget && event.clientY <= 0) trigger('exit_intent');
        };
        document.addEventListener('mouseout', onLeave);
        triggerCleanups.push(() => document.removeEventListener('mouseout', onLeave));
      }
    }

    // The theme editor ignores every flag; the popup opens on section select.
    if (!designMode) {
      const eligible = data.enabled === 'true' && !isSubscribed() && !cameFromEmail && deviceAllowed();
      if (eligible && (!listId || !publicKey)) {
        console.warn('[Xula popup] Klaviyo list ID or public key missing; popup disabled.');
      } else if (eligible) {
        if (isSnoozed()) {
          if (canShowTeaser()) showTeaser();
        } else {
          armTriggers();
        }
      }
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
    if (instance) instance.open('editor');
  });

  document.addEventListener('shopify:block:select', (event) => {
    const instance = findInstance(event.detail.sectionId);
    if (instance) instance.open('editor');
  });

  document.addEventListener('shopify:section:deselect', (event) => {
    const instance = findInstance(event.detail.sectionId);
    if (instance) instance.close('editor');
  });

  window.XulaNewsletterPopup = { open: (id) => { const i = findInstance(id); if (i) i.open('manual'); } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll());
  } else {
    initAll();
  }
})();
