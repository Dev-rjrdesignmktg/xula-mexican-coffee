(() => {
  const init = (root) => {
    if (!root || root.dataset.xulaCiInit) return;
    root.dataset.xulaCiInit = 'true';

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const items = root.querySelectorAll('[data-xula-ci-reveal]');

    if (!reduce && 'IntersectionObserver' in window) {
      root.classList.add('is-ready');
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
      );
      let col = 0;
      items.forEach((el) => {
        if (el.classList.contains('xula-ci__card')) {
          el.style.setProperty('--xula-ci-delay', `${(col++ % 2) * 0.12}s`);
        }
        io.observe(el);
      });
    }

    /* Highlight the chip of the collection currently in view */
    const chips = Array.from(root.querySelectorAll('.xula-ci__chip'));
    if (!chips.length || !('IntersectionObserver' in window)) return;

    const byId = new Map();
    chips.forEach((chip) => {
      const id = decodeURIComponent(chip.getAttribute('href').slice(1));
      byId.set(id, chip);
    });

    const setActive = (chip) => {
      chips.forEach((c) => {
        const active = c === chip;
        c.classList.toggle('is-active', active);
        if (active) c.setAttribute('aria-current', 'location');
        else c.removeAttribute('aria-current');
      });
      if (chip && chip.parentElement) {
        const list = chip.closest('.xula-ci__nav-list');
        if (list) {
          const left = chip.offsetLeft - (list.clientWidth - chip.clientWidth) / 2;
          list.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
        }
      }
    };

    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(byId.get(entry.target.id));
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );

    byId.forEach((_, id) => {
      const target = document.getElementById(id);
      if (target) spy.observe(target);
    });

    chips.forEach((chip) => {
      chip.addEventListener('click', (event) => {
        const target = document.getElementById(decodeURIComponent(chip.getAttribute('href').slice(1)));
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', chip.getAttribute('href'));
        /* Move focus to the card's link so keyboard/screen-reader users land there */
        const link = target.querySelector('.xula-ci__stretch');
        if (link) link.focus({ preventScroll: true });
      });
    });
  };

  /* =========================================================
     QUIZ MODAL
     Moves the page's "Xula Coffee Quiz" section into a native
     <dialog> (focus trap, Esc and inert background for free).
     Moving the node keeps the quiz's own event listeners.
     In the theme editor the quiz lives inline (so it stays editable)
     and is only moved into the dialog while it is open.
     ========================================================= */
  const initQuizModal = (root) => {
    const trigger = root.querySelector('[data-xula-ci-quiz-open]');
    const modal = root.querySelector('[data-xula-ci-quiz-modal]');
    if (!trigger || !modal || trigger.dataset.xulaCiQuizInit) return;
    trigger.dataset.xulaCiQuizInit = 'true';

    const slot = modal.querySelector('[data-xula-ci-quiz-slot]');
    const closeBtn = modal.querySelector('[data-xula-ci-quiz-close]');
    const designMode = Boolean(window.Shopify && window.Shopify.designMode);
    const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Resolved on demand: the editor can re-render the quiz section */
    const findQuizSection = () => {
      const quiz = document.querySelector('[data-xula-quiz]');
      return quiz ? quiz.closest('.shopify-section') || quiz : null;
    };

    let placeholder = null;

    const mount = (section) => {
      if (slot.contains(section)) return;
      if (designMode) {
        placeholder = document.createComment('xula-quiz-placeholder');
        section.before(placeholder);
      }
      slot.appendChild(section);
    };

    const unmount = () => {
      if (!designMode || !placeholder) return;
      const section = slot.querySelector('.shopify-section') || slot.firstElementChild;
      if (section) placeholder.replaceWith(section);
      else placeholder.remove();
      placeholder = null;
    };

    /* Storefront: move the quiz into the dialog right away */
    if (!designMode) {
      const section = findQuizSection();
      if (section) mount(section);
    }

    const open = () => {
      const section = findQuizSection();

      /* No quiz on the page → behave like a link */
      if (!section) {
        if (trigger.dataset.fallbackUrl) window.location.href = trigger.dataset.fallbackUrl;
        return;
      }

      /* Very old browsers without <dialog> → scroll to the quiz */
      if (typeof modal.showModal !== 'function') {
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      mount(section);
      modal.showModal();
      document.documentElement.classList.add('xula-ci-modal-open');
      const start = modal.querySelector('[data-xula-quiz-start]');
      (start || closeBtn).focus({ preventScroll: true });
    };

    const close = () => {
      if (!modal.open) return;
      modal.classList.add('is-closing');
      const done = () => {
        modal.classList.remove('is-closing');
        modal.close();
      };
      if (reduce()) done();
      else window.setTimeout(done, 250);
    };

    trigger.addEventListener('click', open);
    closeBtn.addEventListener('click', close);

    /* Esc: animate out instead of the instant native close */
    modal.addEventListener('cancel', (event) => {
      event.preventDefault();
      close();
    });

    /* Click on the backdrop (outside the panel) closes */
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });

    modal.addEventListener('close', () => {
      document.documentElement.classList.remove('xula-ci-modal-open');
      unmount();
      trigger.focus({ preventScroll: true });
    });

    /* Editor: selecting the quiz section closes the modal so it can be edited inline */
    if (designMode) {
      document.addEventListener('shopify:section:select', (event) => {
        if (event.target.querySelector('[data-xula-quiz]') || slot.contains(event.target)) close();
      });
    }
  };

  const boot = () =>
    document.querySelectorAll('[data-xula-ci]').forEach((root) => {
      init(root);
      initQuizModal(root);
    });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', (event) => {
    const root = event.target.querySelector('[data-xula-ci]');
    if (!root) return;
    init(root);
    initQuizModal(root);
  });
})();
