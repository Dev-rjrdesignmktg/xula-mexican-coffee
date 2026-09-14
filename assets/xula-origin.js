document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.xula-origin__slides').forEach((track) => {
    const slides = Array.from(track.querySelectorAll('.xula-origin__slide'));
    if (slides.length < 2) return;

    const media = track.closest('.xula-origin__media');
    const dots = media ? Array.from(media.querySelectorAll('.xula-origin__dot')) : [];
    const duration = parseInt(track.dataset.autoplay, 10) || 5000;

    if (media) {
      media.style.setProperty('--xula-origin-autoplay', `${duration}ms`);
    }

    let activeIndex = 0;
    let timer = null;

    function goTo(index) {
      const nextIndex = (index + slides.length) % slides.length;
      if (nextIndex === activeIndex) return;

      slides[activeIndex].classList.remove('is-active');
      if (dots[activeIndex]) {
        dots[activeIndex].classList.remove('is-active');
        dots[activeIndex].setAttribute('aria-selected', 'false');
      }

      activeIndex = nextIndex;

      slides[activeIndex].classList.add('is-active');
      const activeDot = dots[activeIndex];
      if (activeDot) {
        activeDot.classList.add('is-active');
        activeDot.setAttribute('aria-selected', 'true');

        const fill = activeDot.querySelector('.xula-origin__dot-fill');
        if (fill) {
          fill.style.animation = 'none';
          void fill.offsetWidth;
          fill.style.animation = '';
        }
      }
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function start() {
      if (prefersReducedMotion) return;
      stop();
      timer = setInterval(() => goTo(activeIndex + 1), duration);
    }

    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        goTo(index);
        start();
      });
    });

    start();
  });
});
