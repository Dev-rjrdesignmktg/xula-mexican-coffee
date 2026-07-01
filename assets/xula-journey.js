document.addEventListener("DOMContentLoaded", () => {
  const items = document.querySelectorAll(".xula-journey__item");
  const copies = document.querySelectorAll(".xula-journey__copy");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = entry.target.dataset.step;

          copies.forEach((copy) => {
            copy.classList.remove("is-active");
          });

          document
            .querySelector(`[data-copy="${index}"]`)
            .classList.add("is-active");
        }
      });
    },
    {
      threshold: 0.6
    }
  );

  items.forEach((item) => observer.observe(item));
});