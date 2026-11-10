(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const revealObserver = "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.15,
          rootMargin: "0px 0px -8% 0px"
        }
      )
    : null;

  const pad = (n) => String(n).padStart(2, "0");

  // Image carousel in the "Our specialty coffee" block
  const initCarousel = (feature) => {
    if (feature.dataset.proofCarouselReady) return;
    feature.dataset.proofCarouselReady = "true";

    const track = feature.querySelector("[data-proof-slides]");
    if (!track) return;

    const duration = parseInt(track.dataset.autoplay, 10) || 5000;
    feature.style.setProperty("--xula-proof-autoplay", `${duration}ms`);

    const slides = Array.from(track.querySelectorAll(".xula-proof__slide"));
    if (slides.length < 2) return;

    const dots = Array.from(feature.querySelectorAll(".xula-proof__dot"));
    const current = feature.querySelector("[data-proof-current]");
    const status = feature.querySelector("[data-proof-status]");
    const toggle = feature.querySelector("[data-proof-toggle]");
    const frame = feature.querySelector(".xula-proof__frame");
    const pauseReasons = new Set();
    let activeIndex = 0;

    const restartFill = (dot) => {
      const fill = dot && dot.querySelector(".xula-proof__dot-fill");
      if (!fill) return;
      fill.style.animation = "none";
      void fill.offsetWidth;
      fill.style.animation = "";
    };

    // `announce` is only true for user-initiated changes, so autoplay stays silent
    const goTo = (index, announce = false) => {
      const nextIndex = (index + slides.length) % slides.length;
      if (nextIndex === activeIndex) return;

      slides[activeIndex].classList.remove("is-active");
      slides[activeIndex].setAttribute("aria-hidden", "true");

      activeIndex = nextIndex;

      slides[activeIndex].classList.add("is-active");
      slides[activeIndex].removeAttribute("aria-hidden");

      dots.forEach((dot, i) => {
        dot.classList.toggle("is-active", i === activeIndex);
        dot.classList.toggle("is-done", i < activeIndex);
        if (i === activeIndex) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });
      restartFill(dots[activeIndex]);

      if (current) current.textContent = pad(activeIndex + 1);
      if (announce && status) status.textContent = `Image ${activeIndex + 1} of ${slides.length}`;
    };

    const setPaused = (reason, paused) => {
      if (paused) pauseReasons.add(reason);
      else pauseReasons.delete(reason);
      feature.classList.toggle("is-paused", pauseReasons.size > 0);
    };

    // Autoplay is driven by the progress bar animation, so pausing it
    // (hover, offscreen, hidden tab) pauses the slideshow in sync.
    dots.forEach((dot, index) => {
      const fill = dot.querySelector(".xula-proof__dot-fill");
      if (fill) {
        fill.addEventListener("animationend", () => {
          if (dot.classList.contains("is-active") && !reduceMotion) goTo(activeIndex + 1);
        });
      }
      dot.addEventListener("click", () => goTo(index, true));
    });

    // Pause / play control (WCAG 2.2.2). Hidden when motion is reduced, since nothing autoplays.
    if (toggle) {
      if (reduceMotion) {
        toggle.hidden = true;
      } else {
        toggle.addEventListener("click", () => {
          const paused = !feature.classList.contains("is-user-paused");
          feature.classList.toggle("is-user-paused", paused);
          setPaused("user", paused);
          toggle.setAttribute("aria-label", paused ? toggle.dataset.labelPlay : toggle.dataset.labelPause);
        });
      }
    }

    if (frame) {
      frame.addEventListener("mouseenter", () => setPaused("hover", true));
      frame.addEventListener("mouseleave", () => setPaused("hover", false));
      // Pause on keyboard focus only; a mouse click on a control must not leave it stuck paused
      frame.addEventListener("focusin", (event) => {
        if (event.target.matches(":focus-visible")) setPaused("focus", true);
      });
      frame.addEventListener("focusout", () => setPaused("focus", false));
      frame.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") goTo(activeIndex - 1, true);
        if (event.key === "ArrowRight") goTo(activeIndex + 1, true);
      });
    }

    // Swipe on touch devices
    let startX = null;
    let startY = null;

    track.addEventListener("touchstart", (event) => {
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    }, { passive: true });

    track.addEventListener("touchend", (event) => {
      if (startX === null) return;
      const dx = event.changedTouches[0].clientX - startX;
      const dy = event.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        goTo(activeIndex + (dx < 0 ? 1 : -1), true);
      }
      startX = null;
      startY = null;
    }, { passive: true });

    document.addEventListener("visibilitychange", () => setPaused("hidden", document.hidden));

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((entry) => setPaused("offscreen", !entry.isIntersecting));
      }).observe(track);
    }
  };

  const init = (root = document) => {
    root.querySelectorAll("[data-proof-feature]").forEach(initCarousel);

    const sections = root.querySelectorAll("[data-xula-proof]:not(.is-animated)");

    sections.forEach((section) => {
      // Without motion or observer support the content simply stays visible
      if (reduceMotion || !revealObserver) return;

      section.classList.add("is-animated");
      section.querySelectorAll("[data-proof-group]").forEach((group) => revealObserver.observe(group));
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  // Theme editor re-renders sections without a page load
  document.addEventListener("shopify:section:load", (event) => init(event.target));

  // Theme editor: reveal a group immediately when one of its blocks is selected
  document.addEventListener("shopify:block:select", (event) => {
    const group = event.target.closest("[data-proof-group]");
    if (group) group.classList.add("is-visible");
  });
})();
