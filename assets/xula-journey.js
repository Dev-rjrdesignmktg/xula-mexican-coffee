(() => {
  const initJourney = (section) => {
    if (section.dataset.journeyReady) return;
    section.dataset.journeyReady = "true";

    const items = Array.from(section.querySelectorAll(".xula-journey__item"));
    const copies = section.querySelectorAll(".xula-journey__copy");
    const current = section.querySelector(".xula-journey__counter-current");
    let activeIndex = null;
    let ticking = false;

    const setActive = (index) => {
      if (index === activeIndex) return;
      activeIndex = index;

      copies.forEach((copy) => {
        copy.classList.toggle("is-active", Number(copy.dataset.copy) === index);
      });

      items.forEach((item) => {
        item.classList.toggle("is-active", Number(item.dataset.step) === index);
      });

      section.style.setProperty("--xula-journey-active", index + 1);

      if (current) {
        current.textContent = String(index + 1).padStart(2, "0");
      }
    };

    // active step = last image whose top has crossed the viewport center
    // (scroll-based instead of IntersectionObserver rootMargin, which is ignored inside the theme editor iframe)
    const update = () => {
      ticking = false;
      const center = window.innerHeight / 2;
      let index = 0;

      items.forEach((item, i) => {
        if (item.getBoundingClientRect().top <= center) index = i;
      });

      setActive(index);
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    update();
  };

  const initAll = () => {
    document.querySelectorAll(".xula-journey").forEach(initJourney);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  // re-init when the section is re-rendered in the theme editor
  document.addEventListener("shopify:section:load", initAll);
})();
