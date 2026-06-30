document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".xula-proof__card");

  if (!cards.length) return;

  const observer = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add("is-visible");
          }, index * 220);

          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15
    }
  );

  cards.forEach((card) => observer.observe(card));
});