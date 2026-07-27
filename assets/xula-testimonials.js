document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll(".xula-testimonials__spotlight[data-carousel]")
    .forEach(initTestimonialsCarousel);
});

function initTestimonialsCarousel(root) {
  const slides = Array.from(root.querySelectorAll("[data-slide]"));
  const stackItems = Array.from(root.querySelectorAll("[data-stack-item]"));
  const total = slides.length;

  if (!total) return;

  const prevBtn = root.querySelector('[data-dir="prev"]');
  const nextBtn = root.querySelector('[data-dir="next"]');
  const currentEl = root.querySelector("[data-current]");

  let active = 0;

  function render() {
    slides.forEach((slide, i) => {
      const isActive = i === active;
      slide.classList.toggle("is-active", isActive);
      slide.setAttribute("aria-hidden", isActive ? "false" : "true");
      slide.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    stackItems.forEach((item, i) => {
      const depth = (i - active + total) % total;
      item.dataset.depth = depth;
    });

    if (currentEl) currentEl.textContent = active + 1;
  }

  function goTo(index) {
    active = ((index % total) + total) % total;
    render();
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => goTo(active - 1));
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => goTo(active + 1));
  }

  render();
}
