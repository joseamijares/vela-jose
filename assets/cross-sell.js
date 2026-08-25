if (!customElements.get('cross-sell-carousel')) {
  customElements.define('cross-sell-carousel', class CrossSellCarousel extends HTMLElement {
    constructor() {
      super();

      this.track = this.querySelector('[data-cross-sell-track]');
      this.controls = this.querySelector('[data-cross-sell-controls]');
      this.prevButton = this.querySelector('[data-cross-sell-direction="prev"]');
      this.nextButton = this.querySelector('[data-cross-sell-direction="next"]');

      this.update = this.update.bind(this);
      this.track.addEventListener('scroll', this.update, { passive: true });
      this.prevButton.addEventListener('click', this.scrollToPrevious.bind(this));
      this.nextButton.addEventListener('click', this.scrollToNext.bind(this));
    }

    connectedCallback() {
      this.resizeObserver = new ResizeObserver(this.update);
      this.resizeObserver.observe(this.track);
    }

    disconnectedCallback() {
      if (this.resizeObserver) this.resizeObserver.disconnect();
    }

    scrollToPrevious() {
      this.scrollByCard(-1);
    }

    scrollToNext() {
      this.scrollByCard(1);
    }

    scrollByCard(direction) {
      const slide = this.track.querySelector('[data-cross-sell-slide]');
      if (!slide) return;

      const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
      // Omitting `behavior` lets the CSS `scroll-behavior` (and the reduced motion guard) win.
      this.track.scrollBy({ left: direction * (slide.offsetWidth + gap) });
    }

    update() {
      const maxScroll = this.track.scrollWidth - this.track.clientWidth;
      const position = Math.abs(Math.round(this.track.scrollLeft));

      this.controls.hidden = maxScroll <= 1;
      this.prevButton.disabled = position <= 0;
      this.nextButton.disabled = position >= Math.round(maxScroll) - 1;
    }
  });
}

if (!customElements.get('cross-sell-item')) {
  customElements.define('cross-sell-item', class CrossSellItem extends HTMLElement {
    constructor() {
      super();

      this.variantInput = this.querySelector('[data-cross-sell-variant]');
      this.button = this.querySelector('[data-cross-sell-add]');
      this.buttonText = this.button.querySelector('span');
      this.spinner = this.button.querySelector('.loading-overlay__spinner');
      this.errorMessage = this.querySelector('[data-cross-sell-error]');
      this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');

      this.button.addEventListener('click', this.onAddClick.bind(this));
      if (document.querySelector('cart-drawer')) this.button.setAttribute('aria-haspopup', 'dialog');

      if (this.variantInput.tagName === 'SELECT') {
        this.variantInput.addEventListener('change', () => {
          this.setError();
          this.button.classList.toggle('cross-sell__add--ready', this.variantInput.value !== '');
        });
      }
    }

    onAddClick() {
      if (this.button.getAttribute('aria-disabled') === 'true') return;

      const variantId = this.variantInput.value;
      if (!variantId) {
        this.setError(this.dataset.selectError);
        this.variantInput.focus();
        return;
      }

      this.setError();
      this.toggleLoading(true);

      const config = fetchConfig('javascript');
      const body = { id: variantId, quantity: 1 };

      if (this.cart) {
        body.sections = this.cart.getSectionsToRender().map((section) => section.id);
        body.sections_url = window.location.pathname;
        this.cart.setActiveElement(document.activeElement);
      }

      config.body = JSON.stringify(body);

      fetch(`${window.routes.cart_add_url}`, config)
        .then((response) => response.json())
        .then((response) => {
          if (response.status) {
            publish(PUB_SUB_EVENTS.cartError, {
              source: 'cross-sell',
              productVariantId: variantId,
              errors: response.description,
              message: response.message,
            });
            this.setError(response.description || response.message);
            return;
          }

          publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cross-sell', productVariantId: variantId });

          if (!this.cart) {
            window.location = window.routes.cart_url;
            return;
          }

          this.showAdded();
          this.cart.renderContents(response);
        })
        .catch((e) => {
          console.error(e);
          this.setError(window.cartStrings.error);
        })
        .finally(() => {
          this.toggleLoading(false);
          if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
        });
    }

    showAdded() {
      window.clearTimeout(this.addedTimeout);
      this.button.classList.add('cross-sell__add--added');
      this.buttonText.textContent = this.button.dataset.addedText;

      this.addedTimeout = window.setTimeout(() => {
        this.button.classList.remove('cross-sell__add--added');
        this.buttonText.textContent = this.button.dataset.defaultText;
      }, 2000);
    }

    toggleLoading(loading) {
      this.button.classList.toggle('loading', loading);
      this.spinner.classList.toggle('hidden', !loading);

      if (loading) {
        this.button.setAttribute('aria-disabled', 'true');
      } else {
        this.button.removeAttribute('aria-disabled');
      }
    }

    setError(message = '') {
      this.errorMessage.textContent = message;
      this.errorMessage.toggleAttribute('hidden', message === '');

      if (this.variantInput.tagName === 'SELECT') {
        this.variantInput.setAttribute('aria-invalid', message === '' ? 'false' : 'true');
      }
    }
  });
}
