(() => {
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");

  function initReveal(section) {
    if (section.dataset.revealInit || REDUCED.matches || !("IntersectionObserver" in window)) return;
    section.dataset.revealInit = "true";
    section.classList.add("is-animated");

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          section.classList.add("is-visible");
          io.disconnect();
        });
      },
      { threshold: 0.15 }
    );
    io.observe(section);
  }

  function initCarousel(root) {
    if (root.dataset.carouselInit) return;
    root.dataset.carouselInit = "true";

    const slides = Array.from(root.querySelectorAll("[data-slide]"));
    const stackItems = Array.from(root.querySelectorAll("[data-stack-item]"));
    const bars = Array.from(root.querySelectorAll("[data-bar]"));
    const total = slides.length;
    if (!total) return;

    const prevBtn = root.querySelector('[data-dir="prev"]');
    const nextBtn = root.querySelector('[data-dir="next"]');
    const toggleBtn = root.querySelector("[data-toggle]");
    const currentEl = root.querySelector("[data-current]");
    const autoplay = Number(root.dataset.autoplay) > 0 && total > 1;

    let active = 0;
    let userPaused = false;
    let hoverPaused = false;
    let offscreen = true;

    const pad = (n) => String(n).padStart(2, "0");

    function syncPause() {
      root.classList.toggle("is-paused", !autoplay || userPaused || hoverPaused || offscreen);
      root.classList.toggle("is-user-paused", userPaused);
      if (toggleBtn) {
        toggleBtn.setAttribute("aria-label", userPaused ? "Reproducir reseñas" : "Pausar reseñas");
      }
    }

    function render() {
      slides.forEach((slide, i) => {
        const isActive = i === active;
        slide.classList.toggle("is-active", isActive);
        slide.setAttribute("aria-hidden", isActive ? "false" : "true");
        slide.inert = !isActive;
      });

      stackItems.forEach((item, i) => {
        item.dataset.depth = (i - active + total) % total;
      });

      bars.forEach((bar, i) => {
        bar.classList.remove("is-active");
        bar.classList.toggle("is-done", i < active);
      });
      const bar = bars[active];
      if (bar) {
        void bar.offsetWidth; // restart the progress animation
        bar.classList.add("is-active");
      }

      if (currentEl) currentEl.textContent = pad(active + 1);
    }

    function goTo(index) {
      active = ((index % total) + total) % total;
      render();
    }

    prevBtn?.addEventListener("click", () => goTo(active - 1));
    nextBtn?.addEventListener("click", () => goTo(active + 1));

    toggleBtn?.addEventListener("click", () => {
      userPaused = !userPaused;
      syncPause();
    });

    if (autoplay) {
      // The progress bar's animation is the timer: it pauses with the bar.
      bars.forEach((bar, i) => {
        bar.addEventListener("animationend", () => {
          if (i === active) goTo(active + 1);
        });
      });

      root.addEventListener("mouseenter", () => { hoverPaused = true; syncPause(); });
      root.addEventListener("mouseleave", () => { hoverPaused = false; syncPause(); });
      root.addEventListener("focusin", () => { hoverPaused = true; syncPause(); });
      root.addEventListener("focusout", (e) => {
        if (!root.contains(e.relatedTarget)) { hoverPaused = false; syncPause(); }
      });

      if ("IntersectionObserver" in window) {
        new IntersectionObserver(
          ([entry]) => { offscreen = !entry.isIntersecting; syncPause(); },
          { threshold: 0.35 }
        ).observe(root);
      } else {
        offscreen = false;
      }
    }

    // Touch swipe
    let startX = 0;
    let startY = 0;
    root.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    root.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) goTo(active + (dx < 0 ? 1 : -1));
    }, { passive: true });

    // Keyboard arrows when focus is inside the carousel
    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") goTo(active - 1);
      if (e.key === "ArrowRight") goTo(active + 1);
    });

    root.addEventListener("xula:goto", (e) => {
      if (e.detail >= 0) goTo(e.detail);
    });

    syncPause();
    render();
  }

  function init(scope = document) {
    scope.querySelectorAll("[data-xula-testimonials]").forEach((section) => {
      initReveal(section);
      section.querySelectorAll("[data-carousel]").forEach(initCarousel);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  // Theme editor support
  document.addEventListener("shopify:section:load", (e) => init(e.target));
  document.addEventListener("shopify:block:select", (e) => {
    const slide = e.target.closest("[data-slide]");
    const root = slide?.closest("[data-carousel]");
    if (!root) return;
    const index = Array.from(root.querySelectorAll("[data-slide]")).indexOf(slide);
    root.dispatchEvent(new CustomEvent("xula:goto", { detail: index }));
  });
})();
