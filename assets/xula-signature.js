(() => {
  const SELECTOR = "[data-xula-signature]";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const reveal = (section) => section.classList.add("is-visible");

  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              reveal(entry.target);
              observer.unobserve(entry.target);
            });
          },
          { threshold: 0.15 }
        )
      : null;

  const init = (section) => {
    if (!section || section.dataset.signatureReady === "true") return;
    section.dataset.signatureReady = "true";

    // Hover sync between the index list and the cards
    const items = section.querySelectorAll("[data-signature-target]");
    const cards = section.querySelectorAll("[data-signature-card]");

    const setActive = (index) => {
      section.classList.toggle("has-active", index !== null);
      items.forEach((item) => item.classList.toggle("is-active", item.dataset.signatureTarget === index));
      cards.forEach((card) => card.classList.toggle("is-active", card.dataset.signatureCard === index));
    };

    items.forEach((item) => {
      item.addEventListener("mouseenter", () => setActive(item.dataset.signatureTarget));
      item.addEventListener("mouseleave", () => setActive(null));
    });

    cards.forEach((card) => {
      card.addEventListener("mouseenter", () => setActive(card.dataset.signatureCard));
      card.addEventListener("mouseleave", () => setActive(null));
      card.addEventListener("focusin", () => setActive(card.dataset.signatureCard));
      card.addEventListener("focusout", (event) => {
        if (!card.contains(event.relatedTarget)) setActive(null);
      });
    });

    // Content stays visible without JS; hidden states apply only once armed
    if (!observer || reducedMotion.matches || window.Shopify?.designMode) {
      reveal(section);
      return;
    }

    section.classList.add("is-animated");
    observer.observe(section);
  };

  const initAll = (root = document) => root.querySelectorAll(SELECTOR).forEach(init);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initAll());
  } else {
    initAll();
  }

  // Theme editor: re-init when the section is added or re-rendered
  document.addEventListener("shopify:section:load", (event) => initAll(event.target));
})();
