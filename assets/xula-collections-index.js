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
     In the theme editor the quiz stays inline so it can be edited.
     ========================================================= */
  const initQuizModal = (root) => {
    const trigger = root.querySelector('[data-xula-ci-quiz-open]');
    const modal = root.querySelector('[data-xula-ci-quiz-modal]');
    if (!trigger || !modal || trigger.dataset.xulaCiQuizInit) return;
    trigger.dataset.xulaCiQuizInit = 'true';

    const slot = modal.querySelector('[data-xula-ci-quiz-slot]');
    const closeBtn = modal.querySelector('[data-xula-ci-quiz-close]');
    const quiz = document.querySelector('[data-xula-quiz]');
    const quizSection = quiz ? quiz.closest('.shopify-section') || quiz : null;
    const designMode = Boolean(window.Shopify && window.Shopify.designMode);
    const supportsDialog = typeof modal.showModal === 'function';

    /* No quiz on the page → behave like a link */
    if (!quizSection) {
      trigger.addEventListener('click', () => {
        if (trigger.dataset.fallbackUrl) window.location.href = trigger.dataset.fallbackUrl;
      });
      return;
    }

    /* Theme editor or very old browsers → scroll to the inline quiz */
    if (designMode || !supportsDialog) {
      trigger.removeAttribute('aria-haspopup');
      trigger.addEventListener('click', () => {
        quizSection.style.display = 'block';
        quizSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

    if (!slot.contains(quizSection)) slot.appendChild(quizSection);

    const open = () => {
      modal.showModal();
      document.documentElement.classList.add('xula-ci-modal-open');
      const start = modal.querySelector('[data-xula-quiz-start]');
      (start || closeBtn).focus({ preventScroll: true });
    };

    const close = () => {
      modal.classList.add('is-closing');
      const done = () => {
        modal.classList.remove('is-closing');
        modal.close();
      };
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done();
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
      trigger.focus({ preventScroll: true });
    });
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
