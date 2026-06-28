document.addEventListener("DOMContentLoaded", () => {
  const hero = document.querySelector(".xula-hero");

  if (!hero) return;

  let swapped = false;

  setInterval(() => {
    swapped = !swapped;
    hero.classList.toggle("is-swapped", swapped);
  }, 5000);
});