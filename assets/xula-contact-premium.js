(() => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function init(scope = document) {
    scope.querySelectorAll(".xula-contact-premium__select").forEach((root) => {
      if (root.dataset.xulaReady) return;
      root.dataset.xulaReady = "true";
      initSelect(root);
    });

    scope.querySelectorAll(".xula-contact-premium__form").forEach((form) => {
      if (form.dataset.xulaReady) return;
      form.dataset.xulaReady = "true";
      initForm(form);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  // Theme editor: re-init when the section is added or its settings change
  document.addEventListener("shopify:section:load", (event) => init(event.target));

  function initForm(form) {
    const status = form.querySelector("[data-xula-contact-status]");
    const live = form.querySelector("[data-xula-contact-live]");
    const submitBtn = form.querySelector("[data-xula-contact-submit]");
    const submitLabel = form.querySelector("[data-xula-contact-submit-label]");
    const counter = form.querySelector("[data-xula-counter]");
    const fields = Array.from(form.querySelectorAll("input[required], select[required], textarea[required]"));
    if (!status || !fields.length) return;

    const msg = {
      required: status.dataset.msgRequired || "This field is required.",
      select: status.dataset.msgSelect || "Please choose an option.",
      email: status.dataset.msgEmail || "Enter a valid email.",
      minlength: status.dataset.msgMinlength || "Enter at least [min] characters.",
      summary: status.dataset.msgSummary || "Please review [count] field(s).",
      sending: status.dataset.msgSending || "Sending…",
    };

    // JS takes over validation; without JS the native validation still applies
    form.setAttribute("novalidate", "");

    // After a Shopify POST (success or error), move focus to the message
    if (status.children.length) {
      requestAnimationFrame(() => {
        status.focus({ preventScroll: true });
        status.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
      });
    }

    fields.forEach((field) => {
      field.dataset.touched = field.getAttribute("aria-invalid") === "true" ? "true" : "false";

      field.addEventListener("blur", () => {
        if (field.value.trim() === "" && field.dataset.touched === "false") return;
        field.dataset.touched = "true";
        validateField(field);
      });

      field.addEventListener(field.tagName === "SELECT" ? "change" : "input", () => {
        if (field.tagName === "SELECT") field.dataset.touched = "true";
        if (field.dataset.touched === "true") validateField(field);
      });
    });

    if (counter) {
      const textarea = form.querySelector("textarea[maxlength]");
      if (textarea) {
        const max = textarea.getAttribute("maxlength");
        const update = () => {
          counter.textContent = `${textarea.value.length} / ${max}`;
        };
        textarea.addEventListener("input", update);
        update();
      }
    }

    form.addEventListener("submit", (event) => {
      const invalid = fields.filter((field) => {
        field.dataset.touched = "true";
        return !validateField(field);
      });

      if (invalid.length) {
        event.preventDefault();
        announce(msg.summary.replace("[count]", invalid.length));
        getFocusTarget(invalid[0]).focus();
        return;
      }

      if (submitBtn.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        return;
      }

      submitBtn.setAttribute("aria-disabled", "true");
      form.setAttribute("aria-busy", "true");
      if (submitLabel) submitLabel.textContent = msg.sending;
      announce(msg.sending);
    });

    // Restore the button when the user navigates back (bfcache)
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      submitBtn.removeAttribute("aria-disabled");
      form.removeAttribute("aria-busy");
    });

    function validateField(field) {
      const error = getErrorEl(field);
      const message = getError(field);
      const proxy = getProxy(field);

      [field, proxy].forEach((el) => {
        if (!el) return;
        if (message) {
          el.setAttribute("aria-invalid", "true");
          el.classList.remove("is-valid");
        } else {
          el.removeAttribute("aria-invalid");
          el.classList.add("is-valid");
        }
      });

      if (error) {
        error.textContent = message;
        error.hidden = !message;
      }
      return !message;
    }

    function getError(field) {
      const value = field.value.trim();
      if (!value) return field.tagName === "SELECT" ? msg.select : msg.required;
      if (field.type === "email" && !emailPattern.test(value)) return msg.email;
      const min = parseInt(field.getAttribute("minlength"), 10);
      if (min && value.length < min) return msg.minlength.replace("[min]", min);
      return "";
    }

    function getErrorEl(field) {
      const wrapper = field.closest("[data-xula-field]");
      return wrapper ? wrapper.querySelector("[data-xula-error]") : null;
    }

    // The custom combobox stands in for its hidden native select
    function getProxy(field) {
      const select = field.closest("[data-xula-select].is-enhanced");
      return select ? select.querySelector("[data-xula-select-trigger]") : null;
    }

    function getFocusTarget(field) {
      return getProxy(field) || field;
    }

    function announce(text) {
      if (!live) return;
      live.textContent = "";
      setTimeout(() => {
        live.textContent = text;
      }, 60);
    }
  }

  /* ---------- Custom select (WAI-ARIA select-only combobox) ---------- */

  function initSelect(root) {
    const native = root.querySelector("[data-xula-select-native]");
    const trigger = root.querySelector("[data-xula-select-trigger]");
    const list = root.querySelector("[data-xula-select-list]");
    const panel = root.querySelector("[data-xula-select-panel]") || list;
    const valueEl = root.querySelector("[data-xula-select-value]");
    const kickerEl = root.querySelector("[data-xula-select-kicker]");
    if (!native || !trigger || !list || !valueEl) return;

    const options = Array.from(list.querySelectorAll('[role="option"]'));
    if (!options.length) return;

    const placeholder = valueEl.textContent;
    const label = document.getElementById(trigger.getAttribute("aria-labelledby"));
    let activeIndex = -1;
    let typeahead = "";
    let typeaheadTimer;
    let closeTimer;

    root.classList.add("is-enhanced");
    trigger.hidden = false;
    if (native.getAttribute("aria-invalid") === "true") trigger.setAttribute("aria-invalid", "true");

    // The visible label points at the hidden native select; redirect clicks to the combobox
    if (label) {
      label.removeAttribute("for");
      label.addEventListener("click", () => trigger.focus());
    }

    syncFromNative();

    trigger.addEventListener("click", () => (isOpen() ? close() : open()));

    trigger.addEventListener("keydown", (event) => {
      const { key, altKey } = event;

      if (!isOpen()) {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(key)) {
          event.preventDefault();
          open(key === "ArrowUp" && !altKey ? "last" : null);
        } else if (key === "Home" || key === "End") {
          event.preventDefault();
          open(key === "Home" ? "first" : "last");
        } else if (isPrintable(event)) {
          open();
          handleTypeahead(key);
        }
        return;
      }

      switch (key) {
        case "ArrowDown":
          event.preventDefault();
          if (altKey) return;
          setActive(Math.min(activeIndex + 1, options.length - 1));
          break;
        case "ArrowUp":
          event.preventDefault();
          if (altKey) {
            select(activeIndex);
            close();
            return;
          }
          setActive(Math.max(activeIndex - 1, 0));
          break;
        case "Home":
          event.preventDefault();
          setActive(0);
          break;
        case "End":
          event.preventDefault();
          setActive(options.length - 1);
          break;
        case "PageDown":
          event.preventDefault();
          setActive(Math.min(activeIndex + 10, options.length - 1));
          break;
        case "PageUp":
          event.preventDefault();
          setActive(Math.max(activeIndex - 10, 0));
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          select(activeIndex);
          close();
          break;
        case "Escape":
          event.preventDefault();
          close();
          break;
        case "Tab":
          select(activeIndex);
          close(false);
          break;
        default:
          if (isPrintable(event)) {
            event.preventDefault();
            handleTypeahead(key);
          }
      }
    });

    trigger.addEventListener("blur", () => {
      // Defer so that a click on an option can complete first
      closeTimer = setTimeout(() => {
        if (isOpen()) close(false);
        native.dispatchEvent(new Event("blur"));
      }, 120);
    });

    // Keep focus on the combobox while interacting with the panel
    panel.addEventListener("mousedown", (event) => event.preventDefault());

    options.forEach((option, index) => {
      option.addEventListener("click", () => {
        clearTimeout(closeTimer);
        select(index);
        close();
      });
      option.addEventListener("mousemove", () => {
        if (index !== activeIndex) setActive(index, false);
      });
    });

    document.addEventListener("pointerdown", (event) => {
      if (isOpen() && !root.contains(event.target)) close(false);
    });

    // Keeps the UI in sync when the form is reset or the value changes elsewhere
    native.addEventListener("change", syncFromNative);
    native.form?.addEventListener("reset", () => setTimeout(syncFromNative));

    function isOpen() {
      return trigger.getAttribute("aria-expanded") === "true";
    }

    function open(position) {
      if (isOpen()) return;
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      flipIfNeeded();
      requestAnimationFrame(() => root.classList.add("is-open"));

      const selected = selectedIndex();
      if (position === "first") setActive(0);
      else if (position === "last") setActive(options.length - 1);
      else setActive(selected >= 0 ? selected : 0);
    }

    function close(restoreFocus = true) {
      if (!isOpen()) return;
      trigger.setAttribute("aria-expanded", "false");
      trigger.removeAttribute("aria-activedescendant");
      root.classList.remove("is-open");
      options.forEach((o) => o.classList.remove("is-active"));
      activeIndex = -1;

      const hide = () => {
        if (!isOpen()) panel.hidden = true;
      };
      if (prefersReducedMotion()) hide();
      else setTimeout(hide, 450);

      if (restoreFocus) trigger.focus();
    }

    function setActive(index, scroll = true) {
      if (index < 0) return;
      activeIndex = index;
      options.forEach((o, i) => o.classList.toggle("is-active", i === index));
      trigger.setAttribute("aria-activedescendant", options[index].id);
      if (scroll) options[index].scrollIntoView({ block: "nearest" });
    }

    function select(index) {
      if (index < 0) return;
      const value = options[index].dataset.value;
      if (native.value === value) return;
      native.value = value;
      native.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function selectedIndex() {
      return options.findIndex((o) => o.dataset.value === native.value);
    }

    function syncFromNative() {
      const index = selectedIndex();
      options.forEach((o, i) => o.setAttribute("aria-selected", String(i === index)));
      const option = options[index];
      valueEl.textContent = option ? option.querySelector(".xula-contact-premium__select-text").textContent : placeholder;
      if (kickerEl) {
        const total = String(options.length).padStart(2, "0");
        const current = option ? option.querySelector(".xula-contact-premium__select-index").textContent : "\u2014";
        kickerEl.textContent = `${current} / ${total}`;
      }
      trigger.classList.toggle("has-value", Boolean(option));
    }

    function handleTypeahead(char) {
      clearTimeout(typeaheadTimer);
      typeahead += char.toLowerCase();
      typeaheadTimer = setTimeout(() => (typeahead = ""), 500);

      // Repeating the same letter cycles through matches
      const isRepeat = typeahead.split("").every((c) => c === typeahead[0]);
      const query = isRepeat ? typeahead[0] : typeahead;
      const start = isRepeat ? activeIndex + 1 : Math.max(activeIndex, 0);
      const ordered = [...options.slice(start), ...options.slice(0, start)];
      const match = ordered.find((o) => o.textContent.trim().toLowerCase().replace(/^\d+\s*/, "").startsWith(query));
      if (match) setActive(options.indexOf(match));
    }

    function flipIfNeeded() {
      root.classList.remove("is-flipped");
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const panelHeight = panel.offsetHeight;
      root.classList.toggle("is-flipped", spaceBelow < panelHeight + 16 && rect.top > spaceBelow);
    }
  }

  function isPrintable(event) {
    return event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey;
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
})();
