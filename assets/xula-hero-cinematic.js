document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('.xula-hero-cinematic');
  if (!sections.length) return;

  const isDesktop = window.matchMedia('(min-width: 750px)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  sections.forEach((section) => {
    const video = section.querySelector('.xula-hero-cinematic__video');
    const toggle = section.querySelector('.xula-hero-cinematic__toggle');

    if (!video) return;

    const mobileDisabled = section.dataset.disableVideoMobile === 'true';
    let userPaused = false;
    let sourcesLoaded = false;

    const loadSources = () => {
      if (sourcesLoaded) return;
      const sources = video.querySelectorAll('source[data-src]');
      if (!sources.length) return;
      sources.forEach((source) => {
        source.src = source.dataset.src;
        source.removeAttribute('data-src');
      });
      video.load();
      sourcesLoaded = true;
    };

    const canPlay = () => !reduceMotion && !userPaused && (!mobileDisabled || isDesktop.matches);

    const play = () => {
      if (!canPlay()) return;
      loadSources();
      const request = video.play();
      if (request && typeof request.catch === 'function') {
        request.catch(() => section.classList.add('xula-hero-cinematic--video-blocked'));
      }
    };

    const pause = () => video.pause();

    if (reduceMotion) {
      section.classList.add('xula-hero-cinematic--reduced-motion');
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              play();
            } else {
              pause();
            }
          });
        },
        { threshold: 0.25 }
      );
      observer.observe(section);
    } else {
      play();
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        pause();
      } else {
        play();
      }
    });

    if (mobileDisabled && typeof isDesktop.addEventListener === 'function') {
      isDesktop.addEventListener('change', (event) => {
        if (event.matches) {
          play();
        } else {
          pause();
        }
      });
    }

    if (toggle) {
      toggle.addEventListener('click', () => {
        userPaused = !userPaused;

        if (userPaused) {
          pause();
        } else {
          play();
        }

        toggle.setAttribute('aria-pressed', String(userPaused));
        toggle.setAttribute(
          'aria-label',
          userPaused ? toggle.dataset.labelPlay : toggle.dataset.labelPause
        );
        section.classList.toggle('xula-hero-cinematic--paused', userPaused);
      });
    }
  });
});
