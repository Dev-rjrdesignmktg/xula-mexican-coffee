(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const observer = "IntersectionObserver" in window
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
          threshold: 0.15
        }
      )
    : null;

  const init = (root = document) => {
    const sections = root.querySelectorAll("[data-xula-proof]:not(.is-animated)");

    sections.forEach((section) => {
      // Without motion or observer support the content simply stays visible
      if (reduceMotion || !observer) return;

      section.classList.add("is-animated");
      observer.observe(section);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  // Theme editor re-renders sections without a page load
  document.addEventListener("shopify:section:load", (event) => init(event.target));
})();
