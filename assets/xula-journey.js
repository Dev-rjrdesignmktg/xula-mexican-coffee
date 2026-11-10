(() => {
  const DESKTOP_QUERY = "(min-width: 990px)";
  const instances = new WeakMap();

  const initJourney = (section) => {
    if (instances.has(section)) return;

    const items = Array.from(section.querySelectorAll(".xula-journey__item"));
    if (items.length < 2) return;

    const copies = Array.from(section.querySelectorAll(".xula-journey__copy"));
    const current = section.querySelector(".xula-journey__counter-current");
    const desktop = window.matchMedia(DESKTOP_QUERY);
    let activeIndex = null;
    let ticking = false;
    let listening = false;
    let inView = false;

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

      for (let i = 0; i < items.length; i++) {
        if (items[i].getBoundingClientRect().top <= center) index = i;
        else break;
      }

      setActive(index);
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    // only track scroll while the sticky desktop layout is active and the section is on screen
    const sync = () => {
      const shouldListen = desktop.matches && inView;
      if (shouldListen === listening) return;
      listening = shouldListen;

      if (listening) {
        window.addEventListener("scroll", requestUpdate, { passive: true });
        window.addEventListener("resize", requestUpdate, { passive: true });
        update();
      } else {
        window.removeEventListener("scroll", requestUpdate);
        window.removeEventListener("resize", requestUpdate);
      }
    };

    const observer = new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      sync();
    });
    observer.observe(section);
    desktop.addEventListener("change", sync);

    instances.set(section, () => {
      observer.disconnect();
      desktop.removeEventListener("change", sync);
      inView = false;
      sync();
    });
  };

  const initAll = (root = document) => {
    root.querySelectorAll(".xula-journey").forEach(initJourney);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initAll());
  } else {
    initAll();
  }

  // theme editor: re-init on re-render, clean up on removal
  document.addEventListener("shopify:section:load", (event) => initAll(event.target));
  document.addEventListener("shopify:section:unload", (event) => {
    event.target.querySelectorAll(".xula-journey").forEach((section) => {
      const destroy = instances.get(section);
      if (destroy) destroy();
      instances.delete(section);
    });
  });
})();
