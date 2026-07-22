document.addEventListener("DOMContentLoaded", () => {
  const section = document.querySelector(".xula-cta");

  if (!section) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const content = section.querySelector(".xula-cta__content");

  if (content) {
    if (prefersReducedMotion) {
      content.classList.add("is-visible");
    } else {
      const contentObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.2 }
      );

      contentObserver.observe(content);
    }
  }

  const urgencyEl = section.querySelector("[data-cta-urgency]");

  if (!urgencyEl) return;

  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  const cutoffDayName = (urgencyEl.dataset.cutoffDay || "sunday").toLowerCase();
  const cutoffHour = parseInt(urgencyEl.dataset.cutoffHour, 10);
  const cutoffDayIndex = dayNames.indexOf(cutoffDayName);
  const label = urgencyEl.dataset.label || "";

  if (cutoffDayIndex === -1 || Number.isNaN(cutoffHour)) return;

  const now = new Date();
  const cutoff = new Date(now);
  const daysUntil = (cutoffDayIndex - now.getDay() + 7) % 7;

  cutoff.setDate(now.getDate() + daysUntil);
  cutoff.setHours(cutoffHour, 0, 0, 0);

  if (cutoff <= now) {
    cutoff.setDate(cutoff.getDate() + 7);
  }

  const diffHours = Math.max(1, Math.round((cutoff.getTime() - now.getTime()) / 36e5));
  const diffDays = Math.floor(diffHours / 24);
  const remHours = diffHours % 24;

  let remaining;
  if (diffDays >= 1) {
    remaining = `${diffDays}d ${remHours}h`;
  } else {
    remaining = `${diffHours}h`;
  }

  urgencyEl.textContent = label ? `${label} ${remaining}` : remaining;
});
