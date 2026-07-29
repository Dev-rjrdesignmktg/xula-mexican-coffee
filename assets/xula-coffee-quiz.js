/* =========================================================
   Xula Coffee Quiz — multi-step recommender
   Vanilla JS, no dependencies. Handles step navigation,
   answer selection, scoring, AJAX add-to-cart / subscribe,
   and connects results to email marketing automations via
   Shopify customer tags + a DOM event + dataLayer push.
   ========================================================= */

(() => {
  const STORAGE_KEY = 'xulaQuizResult';

  document.querySelectorAll('[data-xula-quiz]').forEach(initQuiz);

  function initQuiz(root) {
    const panelsWrap = root.querySelector('[data-xula-quiz-panels]');
    if (!panelsWrap) return;

    const panels = Array.from(root.querySelectorAll('[data-xula-quiz-panel]'));
    const questionPanels = panels.filter((p) => p.dataset.panel === 'question');
    const resultsPanel = panels.find((p) => p.dataset.panel === 'results');
    const totalQuestions = Number(panelsWrap.dataset.totalQuestions || questionPanels.length);
    const progressWrap = root.querySelector('[data-xula-quiz-progress]');
    const progressFill = root.querySelector('[data-xula-quiz-progress-fill]');
    const progressText = root.querySelector('[data-xula-quiz-progress-text]');
    const live = root.querySelector('[data-xula-quiz-live]');
    const questionWord = root.dataset.questionWord || 'Question';
    const ofWord = root.dataset.ofWord || 'of';
    const newsletterTag = root.dataset.newsletterTag || 'quiz-lead';
    const mediaImage = root.querySelector('[data-xula-quiz-media-image]');

    let currentIndex = 0; // 0 = welcome, 1..N = questions, N+1 = results
    /** @type {Map<number, Set<string>>} answers per question index */
    const answers = new Map();

    panels.forEach((panel, i) => {
      panel.hidden = i !== 0;
    });

    questionPanels.forEach((panel, index) => initQuestionPanel(panel, index));
    if (resultsPanel) initResultsPanel(resultsPanel);

    const startBtn = root.querySelector('[data-xula-quiz-start]');
    startBtn?.addEventListener('click', () => goTo(1));

    root.querySelectorAll('[data-xula-quiz-add-form]').forEach(initAddToCartForm);
    const emailForm = root.querySelector('[data-xula-quiz-email] form');
    if (emailForm) initEmailForm(emailForm);

    /* -----------------------------------------------------
       Step navigation
       ----------------------------------------------------- */
    function goTo(index) {
      panels.forEach((panel, i) => {
        if (i === index) {
          panel.hidden = false;
          panel.classList.add('is-entering');
          panel.addEventListener(
            'animationend',
            () => panel.classList.remove('is-entering'),
            { once: true }
          );
        } else {
          panel.hidden = true;
        }
      });

      currentIndex = index;
      updateProgress();

      const panel = panels[index];
      const focusTarget = panel?.querySelector(
        '[data-xula-quiz-results-heading], legend, .xula-quiz__question'
      );
      if (focusTarget) {
        requestAnimationFrame(() => focusTarget.focus());
      }

      if (panel && panel.dataset.panel === 'results') {
        computeAndShowResult(resultsPanel);
      }
    }

    function updateProgress() {
      if (!progressWrap) return;

      if (currentIndex >= 1 && currentIndex <= totalQuestions) {
        progressWrap.hidden = false;
        const percent = Math.round((currentIndex / totalQuestions) * 100);
        if (progressFill) progressFill.style.width = `${percent}%`;
        const text = `${questionWord} ${currentIndex} ${ofWord} ${totalQuestions}`;
        if (progressText) progressText.textContent = text;
        if (live) live.textContent = text;
      } else {
        progressWrap.hidden = true;
      }
    }

    /* -----------------------------------------------------
       Question panel — selection + keyboard roving tabindex
       ----------------------------------------------------- */
    function initQuestionPanel(panel, qIndex) {
      const isSingle = panel.dataset.selection !== 'multiple';
      const optionsWrap = panel.querySelector('[data-xula-quiz-options]');
      const options = Array.from(panel.querySelectorAll('[data-xula-quiz-option]'));
      const backBtn = panel.querySelector('[data-xula-quiz-back]');
      const nextBtn = panel.querySelector('[data-xula-quiz-next]');

      answers.set(qIndex, new Set());

      const setTabIndex = (activeIndex) => {
        options.forEach((opt, i) => {
          opt.tabIndex = i === activeIndex ? 0 : -1;
        });
      };

      const selectOption = (option, index) => {
        const tags = (option.dataset.tags || '')
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);

        if (isSingle) {
          options.forEach((opt) => opt.setAttribute('aria-checked', 'false'));
          option.setAttribute('aria-checked', 'true');
          answers.set(qIndex, new Set(tags));
          setTabIndex(index);

          window.setTimeout(() => {
            const next = qIndex + 1 < questionPanels.length ? qIndex + 2 : totalQuestions + 1;
            goTo(next);
          }, 220);
        } else {
          const nowChecked = option.getAttribute('aria-checked') !== 'true';
          option.setAttribute('aria-checked', String(nowChecked));

          const set = answers.get(qIndex);
          tags.forEach((tag) => (nowChecked ? set.add(tag) : set.delete(tag)));

          if (nextBtn) {
            const anyChecked = options.some((opt) => opt.getAttribute('aria-checked') === 'true');
            nextBtn.disabled = !anyChecked;
          }
        }
      };

      options.forEach((option, index) => {
        option.addEventListener('click', () => selectOption(option, index));

        option.addEventListener('keydown', (event) => {
          let newIndex = null;

          switch (event.key) {
            case 'ArrowRight':
            case 'ArrowDown':
              newIndex = (index + 1) % options.length;
              break;
            case 'ArrowLeft':
            case 'ArrowUp':
              newIndex = (index - 1 + options.length) % options.length;
              break;
            case 'Home':
              newIndex = 0;
              break;
            case 'End':
              newIndex = options.length - 1;
              break;
            case 'Escape':
              backBtn?.click();
              return;
            default:
              return;
          }

          event.preventDefault();
          setTabIndex(newIndex);
          options[newIndex].focus();
        });
      });

      backBtn?.addEventListener('click', () => {
        goTo(qIndex); // qIndex is zero-based -> previous panel index
      });

      nextBtn?.addEventListener('click', () => {
        if (nextBtn.disabled) return;
        const next = qIndex + 1 < questionPanels.length ? qIndex + 2 : totalQuestions + 1;
        goTo(next);
      });

      if (optionsWrap) {
        optionsWrap.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') backBtn?.click();
        });
      }
    }

    /* -----------------------------------------------------
       Results — scoring, persistence, marketing hooks
       ----------------------------------------------------- */
    function initResultsPanel(panel) {
      const retakeBtn = panel.querySelector('[data-xula-quiz-retake]');
      retakeBtn?.addEventListener('click', () => resetQuiz());
    }

    function collectSelectedTags() {
      const all = [];
      answers.forEach((set) => set.forEach((tag) => all.push(tag)));
      return all;
    }

    function computeAndShowResult(panel) {
      if (!panel) return;
      const results = Array.from(panel.querySelectorAll('[data-xula-quiz-result]'));
      if (!results.length) return;

      const selectedTags = collectSelectedTags();
      const counts = selectedTags.reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});

      let winner = null;
      let bestScore = -1;
      let fallback = null;

      results.forEach((result) => {
        const matchTags = (result.dataset.matchTags || '')
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);

        const score = matchTags.reduce((sum, tag) => sum + (counts[tag] || 0), 0);
        result.dataset.score = String(score);

        if (result.dataset.default === 'true' && !fallback) fallback = result;
        if (score > bestScore) {
          bestScore = score;
          winner = result;
        }
      });

      if (bestScore <= 0 && fallback) winner = fallback;
      if (!winner) winner = results[0];

      results.forEach((result) => {
        result.hidden = result !== winner;
      });

      swapMediaImage(winner);
      persistAndAnnounce(winner, selectedTags);
    }

    function swapMediaImage(winnerEl) {
      if (!mediaImage || !winnerEl || !winnerEl.dataset.image) return;

      mediaImage.classList.add('is-swapping');
      window.setTimeout(() => {
        mediaImage.src = winnerEl.dataset.image;
        if (winnerEl.dataset.imageSrcset) mediaImage.srcset = winnerEl.dataset.imageSrcset;
        mediaImage.classList.remove('is-swapping');
      }, 200);
    }

    function resetMediaImage() {
      if (!mediaImage) return;
      mediaImage.classList.add('is-swapping');
      window.setTimeout(() => {
        mediaImage.src = mediaImage.dataset.defaultSrc;
        mediaImage.srcset = mediaImage.dataset.defaultSrcset;
        mediaImage.classList.remove('is-swapping');
      }, 200);
    }

    function persistAndAnnounce(winnerEl, selectedTags) {
      if (!winnerEl) return;

      const titleEl = winnerEl.querySelector('.xula-quiz__result-title');
      const payload = {
        answers: selectedTags,
        resultHandle: winnerEl.dataset.handle || '',
        resultTitle: titleEl ? titleEl.textContent.trim() : '',
        timestamp: Date.now(),
      };

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {
        /* storage unavailable (private mode, quota) — safe to ignore */
      }

      document.dispatchEvent(new CustomEvent('xula:quiz:complete', { detail: payload }));

      if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({
          event: 'xula_quiz_complete',
          quiz_answers: selectedTags,
          quiz_result_product: payload.resultHandle,
        });
      }

      const tagsField = root.querySelector('[data-xula-quiz-tags-field]');
      if (tagsField) {
        const uniqueTags = Array.from(new Set(selectedTags)).map((t) => `quiz-${t}`);
        const marketingTags = [newsletterTag, 'quiz-completed', ...uniqueTags];
        if (payload.resultHandle) marketingTags.push(`quiz-result-${payload.resultHandle}`);
        tagsField.value = marketingTags.join(',');
      }
    }

    function resetQuiz() {
      answers.forEach((set) => set.clear());

      questionPanels.forEach((panel) => {
        panel.querySelectorAll('[data-xula-quiz-option]').forEach((opt, i) => {
          opt.setAttribute('aria-checked', 'false');
          opt.tabIndex = i === 0 ? 0 : -1;
        });
        const nextBtn = panel.querySelector('[data-xula-quiz-next]');
        if (nextBtn) nextBtn.disabled = true;
      });

      if (resultsPanel) {
        resultsPanel.querySelectorAll('[data-xula-quiz-result]').forEach((result) => {
          result.hidden = true;
        });
        const emailWrap = resultsPanel.querySelector('[data-xula-quiz-email]');
        emailWrap?.classList.remove('is-success');
        const emailForm2 = emailWrap?.querySelector('form');
        emailForm2?.reset();
        const emailMsg = resultsPanel.querySelector('[data-xula-quiz-email-message]');
        if (emailMsg) emailMsg.textContent = '';
      }

      resetMediaImage();
      goTo(0);
    }
  }

  /* -----------------------------------------------------
     Add to cart — AJAX, integrates with theme cart drawer,
     supports one-time vs. subscription (selling plan).
     ----------------------------------------------------- */
  function initAddToCartForm(form) {
    const submitBtn = form.querySelector('[data-xula-quiz-add-submit]');
    const message = form.querySelector('[data-xula-quiz-add-message]');
    const variantInput = form.querySelector('[data-xula-quiz-variant-id]');
    const sellingPlanInput = form.querySelector('[data-xula-quiz-selling-plan]');
    const toggle = form.querySelector('[data-xula-quiz-purchase-toggle]');
    if (!submitBtn) return;

    if (toggle) {
      const options = Array.from(toggle.querySelectorAll('[data-purchase]'));
      options.forEach((btn) => {
        btn.addEventListener('click', () => {
          options.forEach((b) => {
            b.classList.toggle('is-active', b === btn);
            b.setAttribute('aria-checked', String(b === btn));
          });

          if (sellingPlanInput) {
            sellingPlanInput.value = btn.dataset.purchase === 'subscribe' ? btn.dataset.sellingPlanId || '' : '';
          }
        });
      });
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (submitBtn.getAttribute('aria-disabled') === 'true' || submitBtn.disabled) return;

      submitBtn.classList.add('is-loading');
      if (message) message.textContent = '';

      const cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');

      const formData = new FormData(form);
      if (variantInput) formData.set('id', variantInput.value);
      if (sellingPlanInput && sellingPlanInput.value) {
        formData.set('selling_plan', sellingPlanInput.value);
      } else {
        formData.delete('selling_plan');
      }

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
          const label = submitBtn.querySelector('.xula-quiz__add-text');
          const originalLabel = label ? label.textContent : '';
          if (label) label.textContent = 'Added ✓';

          if (typeof window.publish === 'function' && window.PUB_SUB_EVENTS) {
            window.publish(window.PUB_SUB_EVENTS.cartUpdate, {
              source: 'xula-coffee-quiz',
              productVariantId: formData.get('id'),
              cartData: data,
            });
          }

          if (Array.isArray(window.dataLayer)) {
            window.dataLayer.push({
              event: 'xula_quiz_add_to_cart',
              variant_id: formData.get('id'),
              is_subscription: Boolean(formData.get('selling_plan')),
            });
          }

          if (cart && typeof cart.renderContents === 'function') {
            cart.renderContents(data);
          } else if (message) {
            message.textContent = 'Added to your cart.';
          }

          window.setTimeout(() => {
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

  /* -----------------------------------------------------
     Email capture — posts to Shopify's customer form
     endpoint without a full page reload, so the quiz result
     stays visible. Falls back to a native submit if the
     request cannot be sent at all (e.g. offline).
     ----------------------------------------------------- */
  function initEmailForm(form) {
    const message = form.querySelector('[data-xula-quiz-email-message]');
    const wrap = form.closest('[data-xula-quiz-email]');
    const successText =
      message?.dataset.success || 'Done! Check your email — your discount is on its way.';

    let bypass = false;

    form.addEventListener('submit', (event) => {
      if (bypass) return;
      event.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn?.setAttribute('disabled', 'disabled');
      if (message) message.textContent = '';

      const formData = new FormData(form);

      fetch(form.action || window.location.pathname, {
        method: 'POST',
        body: formData,
      })
        .then(() => {
          wrap?.classList.add('is-success');
          if (message) message.textContent = successText;
          document.dispatchEvent(
            new CustomEvent('xula:quiz:email-captured', {
              detail: { email: formData.get('contact[email]'), tags: formData.get('contact[tags]') },
            })
          );
          if (Array.isArray(window.dataLayer)) {
            window.dataLayer.push({ event: 'xula_quiz_email_captured' });
          }
        })
        .catch(() => {
          bypass = true;
          form.submit();
        })
        .finally(() => {
          submitBtn?.removeAttribute('disabled');
        });
    });
  }
})();
