document.addEventListener("DOMContentLoaded", () => {
  const carousels = document.querySelectorAll("[data-xula-promo-carousel]");

  if (!carousels.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  carousels.forEach((carousel) => {
    const viewport = carousel.querySelector(".xula-promo-carousel__viewport");
    const track = carousel.querySelector("[data-xula-promo-carousel-track]");
    const slides = Array.from(carousel.querySelectorAll("[data-xula-promo-carousel-slide]"));
    const prevBtn = carousel.querySelector("[data-xula-promo-carousel-prev]");
    const nextBtn = carousel.querySelector("[data-xula-promo-carousel-next]");
    const dots = Array.from(carousel.querySelectorAll("[data-xula-promo-carousel-dot]"));
    const toggle = carousel.querySelector("[data-xula-promo-carousel-toggle]");
    const live = carousel.querySelector("[data-xula-promo-carousel-live]");

    if (!viewport || !track || slides.length === 0) return;

    if (slides.length < 2) {
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      if (toggle) toggle.hidden = true;
      return;
    }

    let activeIndex = 0;
    let autoplayTimer = null;

    const autoplayEnabled = carousel.dataset.autoplay === "true" && !reduceMotion;
    const autoplayInterval = parseInt(carousel.dataset.autoplayInterval, 10) || 5000;
    let isPlaying = autoplayEnabled;

    const scrollToIndex = (index, behavior) => {
      const target = slides[index];
      if (!target) return;
      viewport.scrollTo({
        left: target.offsetLeft - track.offsetLeft,
        behavior: behavior || (reduceMotion ? "auto" : "smooth"),
      });
    };

    const updateActive = (index) => {
      activeIndex = index;

      dots.forEach((dot, i) => {
        const active = i === index;
        dot.classList.toggle("xula-promo-carousel__dot--active", active);
        dot.setAttribute("aria-current", String(active));
      });

      if (prevBtn) prevBtn.disabled = index === 0;
      if (nextBtn) nextBtn.disabled = index === slides.length - 1;

      if (live) live.textContent = `${index + 1} de ${slides.length}`;
    };

    const goTo = (index) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, index));
      scrollToIndex(clamped);
    };

    // Keep controls in sync with native scroll (touch swipe, trackpad, etc.)
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
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(activeIndex + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(activeIndex - 1);
      }
    });

    const stopAutoplay = () => {
      if (!autoplayTimer) return;
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    };

    const startAutoplay = () => {
      if (!isPlaying) return;
      stopAutoplay();
      autoplayTimer = setInterval(() => {
        const nextIndex = activeIndex + 1 >= slides.length ? 0 : activeIndex + 1;
        scrollToIndex(nextIndex);
      }, autoplayInterval);
    };

    if (autoplayEnabled) {
      startAutoplay();

      carousel.addEventListener("pointerenter", stopAutoplay);
      carousel.addEventListener("pointerleave", () => {
        if (isPlaying) startAutoplay();
      });

      carousel.addEventListener("focusin", stopAutoplay);
      carousel.addEventListener("focusout", (event) => {
        if (isPlaying && !carousel.contains(event.relatedTarget)) startAutoplay();
      });

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          stopAutoplay();
        } else if (isPlaying) {
          startAutoplay();
        }
      });

      if (toggle) {
        toggle.addEventListener("click", () => {
          isPlaying = !isPlaying;
          toggle.setAttribute("aria-pressed", String(!isPlaying));
          toggle.setAttribute(
            "aria-label",
            isPlaying ? toggle.dataset.labelPause : toggle.dataset.labelPlay
          );

          if (isPlaying) {
            startAutoplay();
          } else {
            stopAutoplay();
          }
        });
      }
    } else if (toggle) {
      toggle.hidden = true;
    }

    updateActive(0);
  });
});
