document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".xula-trust-cards__card");

  if (!cards.length) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const formatValue = (num, decimals, group) => {
    if (decimals > 0) return num.toFixed(decimals);
    const rounded = Math.round(num);
    return group ? rounded.toLocaleString("en-US") : String(rounded);
  };

  const animateCount = (el) => {
    const target = parseFloat(el.dataset.countTo);
    if (isNaN(target)) return;

    const decimals = parseInt(el.dataset.decimals, 10) || 0;
    const group = el.dataset.group !== "false";

    if (prefersReducedMotion) {
      el.textContent = formatValue(target, decimals, group);
      return;
    }

    const duration = 1400;
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatValue(target * eased, decimals, group);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = formatValue(target, decimals, group);
      }
    };

    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry, index) => {
        if (!entry.isIntersecting) return;

        const card = entry.target;
        const delay = prefersReducedMotion ? 0 : index * 120;

        setTimeout(() => {
          card.classList.add("is-visible");

          const valueEl = card.querySelector(".xula-trust-cards__value[data-count-to]");
          if (valueEl) animateCount(valueEl);
        }, delay);

        obs.unobserve(card);
      });
    },
    { threshold: 0.2 }
  );

  cards.forEach((card) => observer.observe(card));
});
