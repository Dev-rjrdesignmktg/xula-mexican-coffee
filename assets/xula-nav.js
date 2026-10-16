/* =========================================================
   XULA Nav — "Our Products" mega menu.
   Desktop: hover intent + keyboard disclosure (role="menu"),
   collection list drives the featured product preview.
   Mobile: touch accordion inside Dawn's drawer.
   ========================================================= */

if (!customElements.get('xula-dropdown')) {
  const HOVER_OPEN_DELAY = 80;
  const HOVER_CLOSE_DELAY = 220;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  class XulaDropdown extends HTMLElement {
    connectedCallback() {
      this.mode = this.dataset.mode;
      this.toggle = this.querySelector('[data-xula-dropdown-toggle]');
      this.panel = this.querySelector('[data-xula-dropdown-panel]');
      this.label = this.querySelector('[data-xula-dropdown-label]');
      if (!this.toggle || !this.panel) return;

      this.hoverTimer = null;
      this.onToggleClick = this.onToggleClick.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.onDocumentClick = this.onDocumentClick.bind(this);

      // Capture phase on the host: Dawn's MenuDrawer binds a "close submenu" click
      // handler to every <button> in the drawer, which would close the whole drawer.
      // Handling the toggle here and stopping propagation keeps that handler from firing.
      this.addEventListener('click', this.onToggleClick, true);
      this.addEventListener('keydown', this.onKeydown);
      // Dawn's drawer closes itself on Escape *keyup*; swallow it if we handled it.
      this.addEventListener('keyup', (event) => {
        if (event.key === 'Escape' && this.handledEscape) {
          event.stopPropagation();
          this.handledEscape = false;
        }
      });

      if (this.mode === 'desktop') this.initDesktop();
    }

    disconnectedCallback() {
      clearTimeout(this.hoverTimer);
      document.removeEventListener('click', this.onDocumentClick);
    }

    get isOpen() {
      return this.toggle.getAttribute('aria-expanded') === 'true';
    }

    get items() {
      return Array.from(this.panel.querySelectorAll('[data-xula-dropdown-item]'));
    }

    open() {
      if (this.isOpen) return;
      if (this.mode === 'desktop') {
        XulaDropdown.closeOthers(this);
        document.addEventListener('click', this.onDocumentClick);
      }
      this.toggle.setAttribute('aria-expanded', 'true');
      this.classList.add('is-open');
    }

    close({ returnFocus = false } = {}) {
      clearTimeout(this.hoverTimer);
      if (!this.isOpen) return;
      this.toggle.setAttribute('aria-expanded', 'false');
      this.classList.remove('is-open');
      document.removeEventListener('click', this.onDocumentClick);
      if (returnFocus) this.toggle.focus();
    }

    onToggleClick(event) {
      if (!this.toggle.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      this.isOpen ? this.close() : this.open();
    }

    /* ---------------- Desktop ---------------- */

    initDesktop() {
      this.addEventListener('mouseenter', () => this.scheduleHover(true));
      this.addEventListener('mouseleave', () => this.scheduleHover(false));

      this.addEventListener('focusout', (event) => {
        if (!this.contains(event.relatedTarget)) this.close();
      });

      // Hovering or focusing a collection swaps the featured product preview.
      const syncPreview = (event) => {
        const target = event.target.closest('[data-xula-preview-target]');
        if (target) this.setPreview(target.dataset.xulaPreviewTarget);
      };
      this.panel.addEventListener('pointerover', syncPreview);
      this.panel.addEventListener('focusin', syncPreview);

      // Touch on wide screens (e.g. tablets ≥990px): first tap opens, second navigates.
      this.label?.addEventListener('click', (event) => {
        if (!finePointer.matches && !this.isOpen) {
          event.preventDefault();
          this.open();
        }
      });
    }

    setPreview(position) {
      this.panel.querySelectorAll('[data-xula-preview-target]').forEach((link) => {
        link.classList.toggle('is-active', link.dataset.xulaPreviewTarget === position);
      });
      this.panel.querySelectorAll('[data-xula-preview]').forEach((card) => {
        card.classList.toggle('is-active', card.dataset.xulaPreview === position);
      });
    }

    scheduleHover(shouldOpen) {
      if (!finePointer.matches) return;
      clearTimeout(this.hoverTimer);
      this.hoverTimer = setTimeout(
        () => (shouldOpen ? this.open() : this.close()),
        shouldOpen ? HOVER_OPEN_DELAY : HOVER_CLOSE_DELAY
      );
    }

    onDocumentClick(event) {
      if (!this.contains(event.target)) this.close();
    }

    focusItem(index) {
      const items = this.items;
      if (!items.length) return;
      const next = (index + items.length) % items.length;
      items[next].focus();
    }

    /* ---------------- Keyboard ---------------- */

    onKeydown(event) {
      if (event.key === 'Escape' && this.isOpen) {
        event.preventDefault();
        event.stopPropagation(); // don't close the whole Dawn drawer
        this.handledEscape = true;
        this.close({ returnFocus: true });
        return;
      }

      if (this.mode !== 'desktop') return;

      const items = this.items;
      const currentIndex = items.indexOf(document.activeElement);
      const onTrigger = event.target === this.toggle || event.target === this.label;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (onTrigger) {
            this.open();
            requestAnimationFrame(() => this.focusItem(0));
          } else if (currentIndex > -1) {
            this.focusItem(currentIndex + 1);
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (onTrigger) {
            this.open();
            requestAnimationFrame(() => this.focusItem(-1));
          } else if (currentIndex > -1) {
            this.focusItem(currentIndex - 1);
          }
          break;
        case 'Home':
          if (currentIndex > -1) {
            event.preventDefault();
            this.focusItem(0);
          }
          break;
        case 'End':
          if (currentIndex > -1) {
            event.preventDefault();
            this.focusItem(-1);
          }
          break;
        default:
          break;
      }
    }

    static closeOthers(current) {
      document.querySelectorAll('xula-dropdown[data-mode="desktop"]').forEach((el) => {
        if (el !== current && typeof el.close === 'function') el.close();
      });
      // Close any native Dawn menus that are open.
      document.querySelectorAll('.header__inline-menu details[open]').forEach((details) => {
        details.removeAttribute('open');
        details.querySelector('summary')?.setAttribute('aria-expanded', 'false');
      });
    }
  }

  customElements.define('xula-dropdown', XulaDropdown);

  // Collapse mobile accordions when Dawn's drawer closes.
  document.addEventListener('DOMContentLoaded', () => {
    const drawer = document.getElementById('Details-menu-drawer-container');
    if (!drawer) return;
    drawer.addEventListener('toggle', () => {
      if (drawer.open) return;
      drawer.querySelectorAll('xula-dropdown[data-mode="mobile"]').forEach((el) => el.close());
    });
  });
}
