---
name: thumbnail
description: Create an art-directed, high-resolution thumbnail image (PNG + lossless WebP) for a website, a local web project, or a single article. Extracts the site's visual identity (imagery, components, colors, fonts, logo) and composes a bespoke design from it, in a portfolio size by default or any platform format (Instagram, TikTok, Snapchat, stories, Open Graph, custom sizes). Use when the user asks for a portfolio thumbnail, project cover, showcase image, social image or link-preview image for a site, project or article, or invokes the thumbnail skill directly.
license: MIT
compatibility: Requires Node.js 22+, a Chromium-based browser (Chrome, Edge, Brave or Chromium) and network access. Works with any agent that supports Agent Skills, can run shell commands and can view images.
---

# Thumbnail

Turn a website, a local web project or a single article into one finished, high-resolution thumbnail that looks like it belongs to that site. The image is composed in HTML/CSS from the site's own material and rendered to PNG and lossless WebP.

## Principles

- **Inspired by the site.** Every thumbnail is a new composition built from the site's signature elements: its hero visual, components, imagery, motifs, typography and colors. A screenshot in a device frame is only one of nine compositions and is never the default.
- **Real material only.** Use the site's real logo, images, text, numbers, colors and fonts. Never invent features, prices, statistics or claims.
- **One deliverable per run.** Run fully automatically. The only question this skill may ask is the language question in *Inputs → Language*.

## Communication

- **Work silently.** Do not narrate steps, findings, design reasoning, retries or fixes. Analysis stays in tool calls and in `brief.md`. Keep tool-call descriptions short and neutral.
- **Speak only when needed:** the language question, a blocking problem the user must act on (the site is unreachable, the project cannot run), and the final delivery.
- **Session language.** Write every user-facing message (questions, options, errors, the final reply) in the language the user is writing in, regardless of the thumbnail's language.
- **Final reply.** Show the image, then give the PNG and WebP paths and two to four short lines: composition, format, sentence, category, and where the logo, colors and font came from. End with one line offering edits and one line suggesting one other format (see `references/formats.md`). No process recap.

## Setup

Paths are relative to this skill's directory (the folder that contains this file). Define `SKILL_DIR` as that folder and `S=$SKILL_DIR/scripts`.

| Script | Purpose |
|---|---|
| `inspect.mjs <url\|file>` | JSON summary: page type (site / article) and article metadata, title, description, language and direction, headings, navigation, text sample, logo and icon candidates, brand colors, fonts. |
| `extract.mjs <url\|file> --out <dir>` | Identity kit: `overview.png` (a labelled contact sheet of every capture), `hero.png`, page `sections/*.png`, distinctive `elements/*.png` at 2x (hero visual, card groups and cards, code, illustrations, media, header, footer), original `images/*`, the site's `fonts/` and `fonts.css`, and `extract.json` (design tokens, element and image index, code text). |
| `extract.mjs <url\|file> --out <dir> --selector "<css>" --name <name> [--transparent]` | Capture one specific element at 2x into `<dir>/elements/<name>.png`. |
| `screenshot.mjs <url\|file> --out <file.png> [--width --height --scale --wait]` | Clean viewport screenshot with cookie banners and chat widgets hidden. |
| `render.mjs <file.html> [--out <file.png>]` | Render a composition at 2x to PNG and lossless WebP. Reads the canvas size from the page and reports loaded fonts, failed fonts, broken images and overflowing text. |
| `history.mjs` / `history.mjs add <site> "<composition>"` | Show or record recently used compositions. |

The scripts have no npm dependencies. If no browser is found, set `CHROME_PATH`. On macOS, `head` may be shadowed by a Perl tool; read files with `cat`, `sed -n` or `python3`.

## Inputs

Resolve these four inputs before designing.

### Target

- **URL mode:** the request contains a URL or domain. Output folder: `./thumbnail-<domain>/` in the current working directory. Treat any other words in the request as notes, for example a language, a format, a composition or a style wish.
- **Project mode:** no URL. The target is the current project. Output folder: `./thumbnail/` in the project root.

Keep every file for the run inside the output folder.

### Page type (URL mode)

Run `inspect.mjs` first and read `page.type`:

- **`site`:** the thumbnail is about the whole website.
- **`article`:** the URL is a single article, blog post, guide or news item. The thumbnail is about **the article's topic**, styled with the site's identity. Use the output folder `./thumbnail-<domain>-<slug>/`, where the slug is the last path segment, shortened to about 40 characters.

Detection uses `og:type`, JSON-LD (Article, BlogPosting, NewsArticle…), a publish date, an `<article>` element, blog-style URL paths and text length. The user's notes override it: "about the site" means site, and "about the article" or "about the topic" means article, in any language.

### Language

Determine the content language from `lang` and `dir`, headings and UI copy. In project mode, also check `<html lang>` and locale folders such as `locales/<code>` or `messages/<code>.json`.

1. If the user's notes name a language, use it.
2. If the site has a single language, use it. Arabic, Persian, Urdu and Hebrew are laid out right to left.
3. If the site fully supports two or more languages, ask the user which one to use. Use the agent's question tool if it has one; otherwise ask in chat and wait. Recommend the site's default locale.
4. If the language is unclear, use Arabic.

The sentence, category and any extra text are written in the chosen language.

### Format

- **Default:** a portfolio thumbnail, 1080 × 720, for a site; Open Graph, 1200 × 630, for an article.
- **On request:** if the user names a platform, placement, aspect ratio or exact size, resolve it with `$SKILL_DIR/references/formats.md`. That file also gives the output file name, the safe zones for vertical formats and layout guidance.
- Every format is rendered at 2x and exported as PNG and lossless WebP.

## Workflow

**Work in few turns.** Every turn re-reads the whole conversation, so the number of turns drives the cost far more than any single file. Batch independent commands into one shell call, read independent files in parallel in the same turn, and never re-read a file or image you have already seen.

### 1. Make the target reachable

- **URL mode:** use the URL.
- **Static project** (an `index.html` and no build step): use the file path. If assets use root-absolute paths, serve the folder in the background (for example `python3 -m http.server 4173`) and use `http://localhost:4173`.
- **Framework project** (a `package.json` with `dev`, `start` or `preview`): install dependencies if `node_modules` is missing, using the package manager that matches the lockfile. Start the dev server in the background, read its port from the output, and wait until `curl -s -o /dev/null -w "%{http_code}" <url>` responds. Stop the server once extraction is done.
- **Cannot run:** use a deployed URL from `package.json` (`homepage`) or the README. If there is none, build from the project's own assets (images, components, styles) and tell the user.

### 2. Inspect, extract and check history (one command)

Run all three in a single shell call:

```
mkdir -p <out> && node $S/inspect.mjs <url> > <out>/inspect.json && node $S/extract.mjs <url> --out <out>/extract && node $S/history.mjs
```

If `inspect.json` shows the page is an article, rename the folder to `./thumbnail-<domain>-<slug>/` in your next shell call.

### 3. Understand the content and study the identity (one turn)

In the same turn, read the key fields of `inspect.json` (print them with a short script rather than the whole file) and view `extract/overview.png`. The overview is a contact sheet of every capture (hero, sections, elements, images), each labelled with its file name.

**Content**

- **Site:** what is it, who is it for, what does it offer, and what makes it feel like itself? Use `inspect.json`, `extract.json` and, in project mode, the README, `package.json`, landing and hero components, locale files, meta tags, manifest and styles.
- **Article:** what is the article about, and what will the reader get from it? Use `page.article` (headline, description, section, tags, author, date, reading time, subheadings, cover image, in-article images, code blocks) and the article text.
- If the page text is thin (a client-rendered page or a bot wall), fetch it another way, for example with a web-fetch tool or `curl`.

**Identity**: from the overview (plus the cover image for an article), note:

- **Mood and style:** photographic, 3D, flat illustration, luxury, playful, technical, editorial, minimal…
- **Signature elements:** the two to four things people recognize the site by, for example a hero image or object, a distinctive card or product tile, a motif, a code sample, an icon set, a gradient, a typographic treatment.
- **Tokens:** colors, page background, button colors, radii, shadows, gradients, heading style, and badge or button style.

### 4. Choose the composition

**If the user explicitly asks for a composition, use it.** This applies when the user names one (for example "Component Collage") or clearly describes its idea, in any language (for example "a collage of the site's cards" or "a grid of its features"). Use that composition even if it was used recently, and skip the history check. Their other notes still apply.

Otherwise, choose it yourself:

1. Use the history printed in step 2.
2. Read `$SKILL_DIR/references/compositions.md` and choose the composition that best expresses this site's signature elements.
3. Avoid the compositions used in the last two runs unless nothing else fits.
4. Write `<out>/brief.md`. Keep it short: identity keywords, signature elements and the files you'll use, the chosen composition and why, and a one-line layout sketch.

### 5. Open the chosen assets at full size (one turn)

The overview is for choosing, not for detail. Once you know which two to four assets the design will use (and the logo), open them at full resolution, all in parallel in one turn, to check small text, fine motifs and crispness before designing. If a part you need wasn't detected, capture it with `extract.mjs --selector` in the same turn.

### 6. Write the content

**Sentence**
- *Site:* what the site offers and why it matters. Use 5–10 words for Arabic and 6–12 words for English or other languages. Write natural marketing copy with no trailing period, and don't repeat the site name.
- *Article:* the article's core idea, either its headline tightened to fit or a faithful one-line summary. Use 5–12 words for Arabic and 6–14 for other languages. Add nothing that isn't in the article.
- It must fit in three lines. You may highlight one to three key words using the site's accent or heading treatment.

**Category**
- Two or three words in the thumbnail's language.
- *Site:* the kind of product, for example Online Store, E-learning Platform, Company Website, SaaS Dashboard, Booking Platform or Portfolio.
- *Article:* the article's section or subject, for example Guide, Case Study, Tutorial or the topic itself.

**Article extras (optional)**
- Author, date and reading time, set small. Use only real values from the page.

**Logo**
- Always use the real logo, and view it before using it.
  - *Project:* look in `public/`, `static/`, `assets/`, `src/assets/` and `app/` for `logo*.{svg,png,webp}`, `icon*.svg`, `favicon.svg`, `apple-touch-icon.png` and `icon-512*.png`, plus manifest icons and inline logo components.
  - *URL:* use `inspect.json`: `logoSvgs` (inline SVG), `logoBackgrounds` (logos drawn as CSS backgrounds, often a ready SVG), `logoImgs` and `icons`. Prefer a vector or transparent logo; crop it from `extract/elements/*-header.png` only as a last resort, because a crop carries the page background. Save files into the output folder.
- Inline SVGs that use `currentColor` or CSS variables need real fill colors. Don't put a box or backdrop behind the logo unless it is needed for contrast: light logos on dark areas, dark logos on light areas.
- For an article, the logo is a small signature, not the hero.
- If no logo exists, use a [Lucide](https://lucide.dev/icons) icon that expresses the idea (`https://cdn.jsdelivr.net/npm/lucide-static@0.460.0/icons/<name>.svg`), styled in the brand colors. Never draw a fake logo.

### 7. Font

- **Sources:** `extract/fonts.css` (the site's own `@font-face` rules, with the font files downloaded) and `extract.json` (`fonts.google`). In project mode, also check `next/font`, `@font-face` rules, Google Fonts imports, the Tailwind `fontFamily` setting and font files in `public/fonts`.
- **Load it:** add the `<link>` right after the Noto Sans link in the canvas, then set `--font: "<Site Font>", "Noto Sans Arabic", "Noto Sans", sans-serif`.
- **Check coverage:** the font must cover the thumbnail's script. A Latin-only font cannot render Arabic text, so fall back to Noto Sans Arabic. If a display font has only one weight, use that weight; never fake bold.
- **Fallback:** if the font is missing from the `fonts` list that `render.mjs` reports, or appears in `failedFonts`, use Noto Sans Arabic or Noto Sans instead.

### 8. Build and render

1. Copy `$SKILL_DIR/assets/canvas.html` to `<out>/<name>.html`. The name is `thumbnail` for the default format and `thumbnail-<preset>` for other formats.
2. Set the canvas size with `--w` and `--h` in the first `:root` rule (the default is 1080px × 720px). Lay the design out for that shape, and for vertical formats keep text inside the safe zone.
3. Design in plain HTML and CSS; inline SVG is welcome.
   - Replace the design variables and the `.canvas` background rule at the end of the `<style>` block, then add your own rules after them.
   - Put the markup inside `<div class="canvas">` and leave the closing `<script>` unchanged.
   - Reference assets with relative paths, such as `extract/images/…`, `extract/elements/…` and `logo.png`.
4. Mark text for the renderer:
   - `data-fit="3"` on the sentence shrinks it until it fits in three lines. `data-min` sets the smallest size (24px by default).
   - `data-text="<name>"` on text elements lets the renderer report overflow.
5. Keep the file neutral: no comments, and nothing that describes how or with what it was made.
6. Write the file and render it in the same shell call, for example `cat > <out>/<name>.html <<'EOF' … EOF && node $S/render.mjs <out>/<name>.html`. This writes `<name>.png` and `<name>.webp`.

**Craft standards**
- A clear hierarchy: subject, then sentence, then logo and category.
- Generous spacing and consistent radii, with depth only where it helps.
- Shadows, radii and colors taken from the site's tokens.
- No clutter, and no generic gradients unrelated to the brand.
- Crop real visuals with CSS (`background-size` and `background-position`) and soften the crop edges with `mask-image`, rather than redrawing them.
- Don't show a bitmap at more than about 1.3× its natural size. Rebuild the element in HTML and CSS instead.

### 9. Review, record and deliver

1. View the PNG critically:
   - Is it specific to this site, or could it belong to any site?
   - Is the logo crisp and readable against its background?
   - Is the text correct: connected Arabic letters, right-to-left order where needed, three lines at most?
   - Are there blurry upscaled crops, or anything important too close to the edges?
   - Did the renderer report broken images, overflowing text or failed fonts?
2. Fix every issue you noticed in one edit, then render again in the same call. Repeat up to three times.
3. Record the composition, chained to the final render if you like: `node $S/history.mjs add <site-or-project> "<Composition>"`.
4. Deliver the image with the final reply described under *Communication*.

## Editing after delivery

- **Changes:** edit `<out>/<name>.html` and render again. Don't repeat the extraction.
- **Another size:** resolve it with `formats.md`, copy the HTML to `thumbnail-<preset>.html`, change `--w` and `--h`, and recompose for the new shape using the assets you already extracted.
- **Another idea:** choose a different composition and build it in a new file, `thumbnail-2.html`.

## Reference files

- `references/compositions.md`: the composition catalogue and art-direction rules.
- `references/formats.md`: platform presets, size resolution, safe zones, layout guidance and format suggestions.
- `assets/canvas.html`: the starter canvas, with font loading, text fitting and a ready signal for the renderer.
