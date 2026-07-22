document.addEventListener("DOMContentLoaded", () => {
  const section = document.querySelector(".xula-testimonials");

  if (!section) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const cards = section.querySelectorAll(".xula-testimonials__card");

  if (cards.length && !prefersReducedMotion) {
    const cardObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry, index) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              entry.target.classList.add("is-visible");
            }, index * 120);

            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    cards.forEach((card) => cardObserver.observe(card));
  } else {
    cards.forEach((card) => card.classList.add("is-visible"));
  }

  const scoreEl = section.querySelector(".xula-testimonials__summary-score");

  if (scoreEl && !prefersReducedMotion) {
    const target = parseFloat(scoreEl.dataset.countTo);

    if (!Number.isNaN(target)) {
      const scoreObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const duration = 900;
            const start = performance.now();

            const step = (now) => {
              const progress = Math.min((now - start) / duration, 1);
              const value = (target * progress).toFixed(1);
              scoreEl.textContent = value;

              if (progress < 1) {
                requestAnimationFrame(step);
              } else {
                scoreEl.textContent = target.toFixed(1);
              }
            };

            requestAnimationFrame(step);
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.4 }
      );

      scoreObserver.observe(scoreEl);
    }
  }
});
