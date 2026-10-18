# Composition catalogue

Every thumbnail is a bespoke composition built from the site's own material. Choose the composition that best expresses the site's signature elements, then adapt it; these are starting points, not templates. Thumbnails for two different sites should never look like siblings.

Every composition includes the three required items: **logo**, **category**, **sentence**. Their placement, size and styling follow the composition and the site's UI language. For example, style the category like the site's own badge or button, and set the sentence like the site's hero heading.

The canvas size depends on the format (see `formats.md`). Recompose each composition for the shape.

---

## 1. Hero Scene

The site's hero visual is the stage: a background photo, 3D render, illustration, video poster or captured canvas.

- **Use when:** the hero visual *is* the brand, for example a photo, a mascot, a 3D object or an atmospheric background. For articles, use it when the cover image is strong.
- **Build:** place the visual full-bleed or as a large off-center crop. Add a gradient or scrim in the site's background color for legibility, and set the text like the site's hero.
- **Sources:** `extract/images/*` (`kind`: background, img, poster), `extract/elements/*-hero-visual.png`, crops of `extract/hero.png`, and the article cover.
- **Avoid:** using the full hero screenshot as-is. Recompose it.

## 2. Component Collage

Two to five real UI components from the site float at different depths: pricing or package cards, product cards, feature tiles, chat bubbles, stats widgets, inputs, badges.

- **Use when:** the site has distinctive repeated components.
- **Build:**
  - Vary the scale and depth, with slight rotation (±2–6°) or perspective.
  - Take shadows and radii from the tokens.
  - Make one component dominant, and echo the site's background.
- **Sources:** `extract/elements/*-card.png` and `*-card-group.png`. Alternatively, rebuild a component in HTML/CSS with its real text, colors and radius, which stays crisper than a bitmap.

## 3. Typographic Poster

The sentence or headline is the hero, set large in the site's display font, with one signature motif.

- **Use when:** the site is typography-led, a brand or agency site, or has a strong graphic motif such as a ribbon, blob, light beam, swash or outlined shape. For articles, use it for headline-led posts.
- **Build:**
  - Set the type at 64–96px with tight leading, using the site's heading treatment.
  - Crop the motif from the site, or recreate it faithfully, at a large size partly off-canvas.
  - Keep the logo small and confident.

## 4. Product Showcase

The site's real products, dishes, properties or artworks are the subject.

- **Use when:** e-commerce, restaurants, real estate, galleries, portfolios.
- **Build:** one hero item large, plus two to four supporting items in a stack, arc, grid or overlap. Style price and label chips like the site's, on a background in the site's tone.
- **Sources:** the largest product images in `extract/images/*`, and the card crops.

## 5. Code & Terminal

The site's real code sample shown in an editor or terminal window.

- **Use when:** developer tools, APIs, SDKs, CLIs, and technical tutorials.
- **Build:** rebuild the snippet as real text, in the site's monospace font if available, with its syntax colors. Keep the window chrome minimal.
- **Sources:** `extract.json` (elements of kind `code`, with their `code` text), and `*-code.png` for color reference.

## 6. Device Frame

The interface is the product, shown in a browser, laptop or phone frame.

- **Use when:** SaaS, dashboards and web apps where the UI is the main selling point. For mobile-first sites, use a phone frame with a mobile screenshot (`screenshot.mjs --width 390 --height 844 --scale 3`).
- **Build:**
  - Capture the screen with `screenshot.mjs`.
  - Build the frame in HTML/CSS: rounded window, top bar, subtle 3D tilt, and a shadow tinted by the brand color.
  - Let the frame bleed off one edge.
- **Never the default.** Use it only when it is clearly the best fit.

## 7. Pattern & Motif

A symbol from the site, such as an icon, the logo mark or a recurring shape, repeated as a rhythmic pattern or scaled up as one giant cropped motif.

- **Use when:** the site is minimal but has a strong symbol or iconography.
- **Build:** a low-contrast pattern across the canvas, or one huge motif bleeding off an edge. Use the site's solid colors and place the text on a calm area.

## 8. Split Editorial

A magazine-style split: one side holds an image (photo, hero crop, cover), and the other a solid brand-color block holding the text.

- **Use when:** service, corporate, healthcare or education sites with real photography and a clear brand color, and articles with a strong cover.
- **Build:** a 50/50 or 60/40 split. The seam can be angled or follow a shape from the site, and the type is large on the color block.

## 9. Feature Grid

The site's key features, steps or real numbers as a compact bento of tiles, styled exactly like the site's cards.

- **Use when:** the message is a set of benefits or steps. For articles, use it for key points taken from the subheadings.
- **Build:** three to six tiles with the site's icons and short labels (real text only), plus one tile holding the sentence or the logo.

---

## Art-direction rules

- **Inspired, not copied.** Recompose site parts into a new image. Only Device Frame shows a full screenshot.
- **Identity first.** Font, colors, radii, shadows, badge and button style, and imagery mood all come from the site.
- **One focal point.** A clear hierarchy: subject, then sentence, then logo and category.
- **Legibility.** The sentence fits in three lines (`data-fit="3"`), with at least 4.5:1 contrast against what is behind it; add a scrim if needed. Keep 56–72px clear of every edge, plus the platform safe zone on vertical formats.
- **Real visuals beat redraws.** When a signature visual only exists inside a capture, crop it with CSS (`background-size` and `background-position`) and soften the edges with `mask-image` rather than recreating it.
- **Crispness.** Element crops are 2x. Don't show a bitmap at more than about 1.3× its natural size; use another asset or rebuild it in HTML/CSS.
- **Direction.** Right-to-left languages start from the right; left-to-right languages from the left.
- **Variety.** Unless the user asked for a specific composition, check the history and avoid the compositions used in the last two runs unless nothing else fits. Even when repeating one, change the layout and scale.
