(() => {
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function init(root = document) {
    root.querySelectorAll(".xula-newsletter").forEach((section) => {
      if (section.dataset.newsletterReady) return;
      section.dataset.newsletterReady = "true";
      initEntranceAnimation(section);
      initForm(section);
    });
  }

  /* Content stays visible without JS: the hidden start state is only applied
     once JS confirms it can reveal the panel again. */
  function initEntranceAnimation(section) {
    const panel = section.querySelector(".xula-newsletter__panel");
    if (!panel || reducedMotion.matches || !("IntersectionObserver" in window)) return;

    section.classList.add("xula-newsletter--animate");

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
    if (!wrapper || !form || !window.fetch) return;

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
      loading: wrapper.dataset.loadingLabel || "Sending…",
    };

    // Focus the server-rendered confirmation after a no-JS fallback submit.
    if (wrapper.classList.contains("is-success")) {
      const message = statusEl.querySelector(".xula-newsletter__message");
      if (message) message.focus({ preventScroll: false });
    }

    input.addEventListener("input", () => {
      if (input.getAttribute("aria-invalid") === "true" && EMAIL_PATTERN.test(input.value.trim())) {
        input.removeAttribute("aria-invalid");
        clearStatus();
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitBtn.getAttribute("aria-busy") === "true") return;

      // Silently drop likely-bot submissions (honeypot field only bots fill in).
      if (honeypot && honeypot.value.trim() !== "") return;

      const email = input.value.trim();
      if (!EMAIL_PATTERN.test(email)) {
        input.setAttribute("aria-invalid", "true");
        renderStatus("error", messages.invalidText);
        input.focus();
        return;
      }

      input.removeAttribute("aria-invalid");
      clearStatus();
      setLoading(true);

      try {
        const response = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "text/html" },
          credentials: "same-origin",
        });

        // Shopify may ask for a captcha: hand over to a native submit so the
        // customer can complete it instead of seeing a false success.
        if (response.redirected && /\/challenge/.test(response.url)) {
          setLoading(false);
          HTMLFormElement.prototype.submit.call(form);
          return;
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = await response.text();
        const serverError = extractServerError(html);
        if (serverError) {
          input.setAttribute("aria-invalid", "true");
          renderStatus("error", serverError);
          input.focus();
        } else {
          handleSuccess();
        }
      } catch (error) {
        renderStatus("error", messages.errorText);
      } finally {
        setLoading(false);
      }
    });

    /* Shopify's customer endpoint answers with the re-rendered page. Look up
       this same form in it and read its error message, if any. */
    function extractServerError(html) {
      try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const serverForm = form.id ? doc.getElementById(form.id) : null;
        const error = serverForm && serverForm.querySelector(".xula-newsletter__message--error");
        return error ? error.textContent.trim() || messages.errorText : "";
      } catch (e) {
        return "";
      }
    }

    function handleSuccess() {
      wrapper.classList.add("is-success");
      form.reset();
      const message = renderStatus("success", messages.successText, messages.successHeading);
      // The field row is hidden on success, so move focus to the confirmation.
      message.setAttribute("tabindex", "-1");
      message.focus({ preventScroll: true });
    }

    function clearStatus() {
      statusEl.replaceChildren();
    }

    function renderStatus(type, text, heading) {
      const message = document.createElement("p");
      message.className = `xula-newsletter__message xula-newsletter__message--${type}`;

      if (heading) {
        const strong = document.createElement("strong");
        strong.textContent = heading;
        message.appendChild(strong);
      }

      message.appendChild(document.createTextNode(text));
      statusEl.replaceChildren(message);
      return message;
    }

    function setLoading(isLoading) {
      submitBtn.disabled = isLoading;
      submitBtn.setAttribute("aria-busy", String(isLoading));
      if (submitLabel) submitLabel.textContent = isLoading ? messages.loading : defaultLabel;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  // Re-initialise when the section is added or re-rendered in the theme editor.
  document.addEventListener("shopify:section:load", (event) => init(event.target));
})();
