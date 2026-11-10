(() => {
  const SELECTOR = "[data-xula-promo-carousel]";
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const init = (carousel) => {
    if (carousel.dataset.xulaPromoCarouselReady === "true") return;
    carousel.dataset.xulaPromoCarouselReady = "true";

    const viewport = carousel.querySelector("[data-xula-promo-carousel-viewport]");
    const slides = Array.from(carousel.querySelectorAll("[data-xula-promo-carousel-slide]"));
    const prevBtn = carousel.querySelector("[data-xula-promo-carousel-prev]");
    const nextBtn = carousel.querySelector("[data-xula-promo-carousel-next]");
    const dots = Array.from(carousel.querySelectorAll("[data-xula-promo-carousel-dot]"));
    const toggle = carousel.querySelector("[data-xula-promo-carousel-toggle]");
    const live = carousel.querySelector("[data-xula-promo-carousel-live]");

    if (!viewport || slides.length < 2) return;

    const liveTemplate = (live && live.dataset.liveTemplate) || "Slide [index] of [total]";
    const autoplayInterval = parseInt(carousel.dataset.autoplayInterval, 10) || 5000;
    const autoplayEnabled = carousel.dataset.autoplay === "true" && !reduceMotionQuery.matches;

    let activeIndex = 0;
    let autoplayTimer = null;
    let isPlaying = autoplayEnabled;
    let userInteracted = false;

    const announce = (index) => {
      // Only announce after the user acts; never on load or while autoplaying.
      if (!live || !userInteracted || autoplayTimer) return;
      live.textContent = liveTemplate
        .replace("[index]", String(index + 1))
        .replace("[total]", String(slides.length));
    };

    const updateActive = (index) => {
      if (index === activeIndex && carousel.dataset.xulaPromoCarouselSynced === "true") return;
      activeIndex = index;
      carousel.dataset.xulaPromoCarouselSynced = "true";

      dots.forEach((dot, i) => {
        const active = i === index;
        dot.classList.toggle("xula-promo-carousel__dot--active", active);
        if (active) {
          dot.setAttribute("aria-current", "true");
        } else {
          dot.removeAttribute("aria-current");
        }
      });

      if (prevBtn) prevBtn.disabled = index === 0;
      if (nextBtn) nextBtn.disabled = index === slides.length - 1;

      announce(index);
    };

    const goTo = (index, fromUser = true) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, index));
      if (fromUser) userInteracted = true;
      const target = slides[clamped];
      viewport.scrollTo({
        left: target.offsetLeft - viewport.firstElementChild.offsetLeft,
        behavior: reduceMotionQuery.matches ? "auto" : "smooth",
      });
    };

    // Sync controls with native scrolling (swipe, trackpad, keyboard).
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = slides.indexOf(entry.target);
          if (index !== -1) updateActive(index);
        });
      },
      { root: viewport, threshold: 0.6 }
    );
    slides.forEach((slide) => observer.observe(slide));

    if (prevBtn) prevBtn.addEventListener("click", () => goTo(activeIndex - 1));
    if (nextBtn) nextBtn.addEventListener("click", () => goTo(activeIndex + 1));

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        const index = parseInt(dot.dataset.index, 10);
        if (!Number.isNaN(index)) goTo(index);
      });
    });

    viewport.addEventListener("keydown", (event) => {
      if (event.target !== viewport) return;
      const keyMap = {
        ArrowRight: activeIndex + 1,
        ArrowLeft: activeIndex - 1,
        Home: 0,
        End: slides.length - 1,
      };
      if (!(event.key in keyMap)) return;
      event.preventDefault();
      goTo(keyMap[event.key]);
    });

    viewport.addEventListener("pointerdown", () => { userInteracted = true; }, { passive: true });

    /* ---------- Autoplay ---------- */

    const setLiveMode = () => {
      if (live) live.setAttribute("aria-live", autoplayTimer ? "off" : "polite");
    };

    const stopAutoplay = () => {
      if (!autoplayTimer) return;
      clearInterval(autoplayTimer);
      autoplayTimer = null;
      setLiveMode();
    };

    const startAutoplay = () => {
      if (!isPlaying || autoplayTimer) return;
      autoplayTimer = setInterval(() => {
        goTo(activeIndex + 1 >= slides.length ? 0 : activeIndex + 1, false);
      }, autoplayInterval);
      setLiveMode();
    };

    if (autoplayEnabled) {
      // Only run while the carousel is on screen (saves CPU/battery).
      const visibilityObserver = new IntersectionObserver(
        ([entry]) => (entry.isIntersecting ? startAutoplay() : stopAutoplay()),
        { threshold: 0.25 }
      );
      visibilityObserver.observe(carousel);

      carousel.addEventListener("pointerenter", stopAutoplay);
      carousel.addEventListener("pointerleave", startAutoplay);
      carousel.addEventListener("focusin", stopAutoplay);
      carousel.addEventListener("focusout", (event) => {
        if (!carousel.contains(event.relatedTarget)) startAutoplay();
      });

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopAutoplay();
        else startAutoplay();
      });

      if (toggle) {
        toggle.addEventListener("click", () => {
          isPlaying = !isPlaying;
          toggle.setAttribute("aria-pressed", String(!isPlaying));
          toggle.setAttribute("aria-label", isPlaying ? toggle.dataset.labelPause : toggle.dataset.labelPlay);
          if (!isPlaying) stopAutoplay();
          // When resuming, autoplay restarts on focusout/pointerleave.
        });
      }
    } else if (toggle) {
      toggle.hidden = true;
    }

    updateActive(0);
  };

  const initAll = (root = document) => {
    root.querySelectorAll(SELECTOR).forEach(init);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initAll());
  } else {
    initAll();
  }

  // Theme editor: re-init when the section is added or re-rendered.
  document.addEventListener("shopify:section:load", (event) => initAll(event.target));
})();
