document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(".xula-newsletter");
  if (!sections.length) return;

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  sections.forEach((section) => {
    initEntranceAnimation(section);
    initForm(section);
  });

  function initEntranceAnimation(section) {
    const panel = section.querySelector(".xula-newsletter__panel");
    if (!panel) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      panel.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(panel);
  }

  function initForm(section) {
    const wrapper = section.querySelector("[data-newsletter-wrapper]");
    const form = section.querySelector("[data-newsletter-form]");
    if (!wrapper || !form) return;

    const input = form.querySelector("[data-newsletter-input]");
    const submitBtn = form.querySelector("[data-newsletter-submit]");
    const submitLabel = form.querySelector("[data-newsletter-submit-label]");
    const statusEl = form.querySelector("[data-newsletter-status]");
    const honeypot = form.querySelector('input[name="contact[company]"]');

    if (!input || !submitBtn || !statusEl) return;

    const defaultLabel = submitLabel ? submitLabel.textContent : "";
    const messages = {
      successHeading: wrapper.dataset.successHeading || "",
      successText: wrapper.dataset.successText || "",
      errorText: wrapper.dataset.errorText || "Something went wrong. Please try again.",
      invalidText: wrapper.dataset.invalidText || "Please enter a valid email address.",
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      // Silently drop likely-bot submissions (honeypot field only bots fill in).
      if (honeypot && honeypot.value.trim() !== "") {
        return;
      }

      const email = input.value.trim();

      if (!emailPattern.test(email)) {
        input.setAttribute("aria-invalid", "true");
        renderStatus("error", messages.invalidText);
        input.focus();
        return;
      }

      input.removeAttribute("aria-invalid");
      setLoading(true);

      try {
        const formData = new FormData(form);
        const response = await fetch(form.action, {
          method: "POST",
          body: formData,
          headers: { Accept: "application/json" },
        });

        const data = await response.json().catch(() => null);

        if (response.ok && (!data || !data.errors)) {
          handleSuccess();
        } else {
          const errorMessage =
            (data && data.errors && (data.errors.email || data.errors.form)) ||
            messages.errorText;
          renderStatus("error", flatten(errorMessage));
        }
      } catch (error) {
        renderStatus("error", messages.errorText);
      } finally {
        setLoading(false);
      }
    });

    function handleSuccess() {
      wrapper.classList.add("is-success");
      renderStatus("success", messages.successText, messages.successHeading);
      form.reset();
    }

    function renderStatus(type, text, heading) {
      statusEl.innerHTML = "";

      const message = document.createElement("p");
      message.className = `xula-newsletter__message xula-newsletter__message--${type}`;
      message.setAttribute("role", type === "error" ? "alert" : "status");

      if (heading) {
        const strong = document.createElement("strong");
        strong.textContent = heading;
        message.appendChild(strong);
      }

      message.appendChild(document.createTextNode(text));
      statusEl.appendChild(message);
    }

    function setLoading(isLoading) {
      submitBtn.disabled = isLoading;
      submitBtn.setAttribute("aria-busy", String(isLoading));
      if (submitLabel) {
        submitLabel.textContent = isLoading ? "..." : defaultLabel;
      }
    }

    function flatten(value) {
      if (Array.isArray(value)) return value.join(" ");
      return String(value);
    }
  }
});
