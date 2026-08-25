# Technical approach — "Pairs with" cross-sell widget

## The problem

The brand is running a paid cross-sell app on product pages. Apps like this typically inject a render-blocking or late-loading third-party script, fetch product data client-side (waterfall: script → API call → render), and style themselves outside the theme's design system. That's the slowness and inconsistency they're seeing. The fix is to move the feature into the theme itself, where the data is available at render time and the UI inherits the brand's tokens.

## Product assignment: native metafields

I used a **product metafield** — `custom.pairs_with`, type *Product (list of products)* — as the source of truth for which products appear on each product page.

Why this over the alternatives:

- **Merchant-editable where merchants already work.** The team assigns cross-sells on the product page in the admin (or in bulk via the products list / CSV / Flow), no new UI to learn, and it's per-product as requested.
- **Zero runtime cost.** Liquid resolves `product.metafields.custom.pairs_with.value` into full product objects — titles, prices, variants, images — during server rendering. The storefront never makes an API call to display the widget.
- **Robust references.** Product references survive handle changes, and deleted products simply drop out of the list.
- **No app, no subscription, no third-party script.** Which is the point of the exercise.

Alternatives I considered: Shopify's *Search & Discovery* complementary products (also metafield-backed, but adds an app dependency and a fixed namespace for little gain here), tags/naming conventions (fragile, not really "manual curation"), and a metaobject-based rules engine (overkill for v1, though it's the natural next step if they want global fallbacks like "any sock pairs with any shoe").

## Widget architecture: an OS 2.0 block, not a floating section

The widget is a **theme block (`cross_sell`) registered in `main-product`**, rendered through a self-contained snippet (`snippets/cross-sell.liquid`). The requirement was "right below the Add to Cart button" — that spot lives inside the product-information column, so a block is the correct primitive: it's placed in `block_order` right after `buy_buttons`, and the store team can move, rename, or remove it from the theme editor with zero code. The block carries `shopify_attributes`, so it's selectable and draggable in the editor like any native block.

The footprint on the theme is deliberately tiny: three new files plus ~25 lines in `main-product.liquid` (a `when` case and a schema entry). Nothing else in the theme is touched, which keeps the theme updatable.

## Add to cart: AJAX Cart API + Section Rendering API

Each card resolves a variant (size selector for multi-variant products, hidden input for single-variant ones) and POSTs to `routes.cart_add_url` with a `sections` payload — the same pattern Dawn's own product form uses. The response includes the re-rendered cart drawer sections, so:

- the drawer opens with the new item, no page reload and no second request;
- I reuse the theme's `renderContents` and publish on Dawn's `PUB_SUB_EVENTS.cartUpdate` bus, so cart count bubbles and any other subscribed component stay in sync;
- error responses (e.g. inventory limits) surface inline next to the button in an `aria-live` region.

Validation is handled before the request: clicking Add without a size selected shows an inline error and focuses the selector; sold-out variants are disabled in the dropdown.

## Performance

The performance story is mostly about what the widget *doesn't* do:

- **No third-party JS, no dependencies.** One ~3 KB deferred script and one small stylesheet, loaded only when the widget actually renders (empty metafield → zero bytes shipped).
- **No client-side data fetching.** Everything is in the HTML; there is no loading spinner on first paint because there is nothing to load.
- **No CLS.** Images sit in fixed `aspect-ratio` containers, load lazily (they're below the fold), and ship responsive `srcset`/`sizes` so mobile doesn't download desktop images.
- **CSS scroll-snap carousel.** The browser does the scrolling/snapping natively; JS only wires the arrow buttons (with a passive scroll listener and a `ResizeObserver` to hide arrows when there's no overflow). No carousel library.
- **Design tokens from the theme.** Colors and typography come from Dawn's CSS custom properties, so the widget follows the brand's scheme settings automatically — consistency without extra CSS.

Compared to the paid app: no external script tag, no third-party API round trips, no cumulative layout shift from late injection — the widget is just part of the page.

## Accessibility

Labelled region (`aria-labelledby`), real `<button>`/`<select>` elements with visible focus states, hidden labels for selectors, `aria-controls` on the carousel arrows, `role="alert"` for errors, and `prefers-reduced-motion` respected for scroll animation.

## Edge cases handled

Empty or missing metafield (renders nothing on the storefront; explanatory placeholder in the theme editor), the current product referencing itself (skipped), unavailable products (skipped), sold-out variants (disabled), missing images (placeholder SVG), cart-page-only themes (falls back to redirecting to `/cart` after adding), double script loading (guarded custom element registration).

## What I'd do next

Quantity selection, a metaobject-driven fallback ruleset for products without manual picks, click/add analytics events pushed to the data layer, and locale files for the widget strings (they're literals for the prototype).
