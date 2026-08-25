# vela-jose

Dawn-based Shopify theme with a custom **"Pairs with" cross-sell widget** on the product page — built as native theme code to replace a paid cross-sell app.

The widget renders below the Add to Cart button, showing products the store team hand-picks per product. Shoppers pick a size and add to cart without leaving the page; the theme's cart drawer opens with the updated cart. No third-party scripts, no external requests, no app subscription.

See [TECHNICAL_APPROACH.md](TECHNICAL_APPROACH.md) for the full write-up.

## The widget at a glance

| Piece | Role |
|---|---|
| `custom.pairs_with` product metafield (Product list) | The store team picks which products appear, per product, from the Shopify admin |
| `snippets/cross-sell.liquid` | Renders the carousel server-side from the metafield references |
| `assets/component-cross-sell.css` | Scoped styles and self-hosted display fonts |
| `assets/cross-sell.js` | Carousel arrows + add-to-cart via the AJAX Cart API and Section Rendering API |
| `cross_sell` block in `sections/main-product.liquid` | Draggable block in the theme editor, placed below Buy buttons |

Everything the widget needs (titles, prices, variants, images) is resolved in Liquid at render time — the browser never fetches product data. The only request the widget makes is `POST /cart/add` when a shopper clicks Add, which also returns the re-rendered cart drawer sections.

## Running the theme

```sh
shopify theme dev --store your-store.myshopify.com
```

## Store setup

1. **Create the metafield definition** — Shopify admin → Settings → Custom data → Products → Add definition:
   - Name: **Pairs with**
   - Namespace and key: **`custom.pairs_with`**
   - Type: **Product** → check **List of products**
2. **Assign products** — on each product in the admin, fill the *Pairs with* metafield with the products to cross-sell, in display order.
3. The block ships enabled in `templates/product.json` below Buy buttons; merchants can move, rename, or remove it from the theme editor (Product page → *Pairs with*).

Products with an empty metafield render nothing; the theme editor shows a placeholder hint instead.

## Behavior notes

- Multi-variant products show a size selector; single-variant products show only the Add button.
- The Add button activates (black border/text) once a size is selected; clicking Add without one shows an inline error and focuses the selector.
- Sold-out variants are listed but disabled; fully unavailable products are skipped.
- On success the button confirms with an "Added ✓" state and the cart drawer opens via Dawn's own `renderContents`; a `cartUpdate` event is published on Dawn's pub/sub bus so the rest of the theme stays in sync.
- The carousel is CSS scroll-snap; the arrows just scroll the track, so touch/trackpad work natively and `prefers-reduced-motion` is respected.

## Performance

- Zero dependencies; one deferred ~3 KB script and one small stylesheet, loaded only when the widget actually renders.
- Server-side rendering: no client-side data fetching, no hydration, no layout shift (aspect-ratio image boxes, lazy responsive images).
- Display fonts (IBM Plex Mono, Plus Jakarta Sans) self-hosted from the theme CDN — ~22 KB total, `font-display: swap`, no third-party font requests.
