document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll("[data-xula-signature]");

  if (!sections.length) return;

  // Link the left index list with the cards (hover/focus sync)
  sections.forEach((section) => {
    const items = section.querySelectorAll("[data-signature-target]");
    const cards = section.querySelectorAll("[data-signature-card]");

    const setActive = (index) => {
      section.classList.toggle("has-active", index !== null);
      items.forEach((item) => {
        item.classList.toggle("is-active", item.dataset.signatureTarget === index);
      });
      cards.forEach((card) => {
        card.classList.toggle("is-active", card.dataset.signatureCard === index);
      });
    };

    items.forEach((item) => {
      item.addEventListener("mouseenter", () => setActive(item.dataset.signatureTarget));
      item.addEventListener("mouseleave", () => setActive(null));
    });

    cards.forEach((card) => {
      card.addEventListener("mouseenter", () => setActive(card.dataset.signatureCard));
      card.addEventListener("mouseleave", () => setActive(null));
      card.addEventListener("focusin", () => setActive(card.dataset.signatureCard));
      card.addEventListener("focusout", () => setActive(null));
    });
  });

  if (!("IntersectionObserver" in window)) {
    sections.forEach((section) => section.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.2
    }
  );

  sections.forEach((section) => observer.observe(section));
});
