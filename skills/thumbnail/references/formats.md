# Formats

**Defaults:**
- **Site:** portfolio thumbnail, 1080 × 720 (3:2).
- **Article:** Open Graph, 1200 × 630.

Use another format only when the user asks for one, by platform name, placement, aspect ratio or exact size, in any language. Every format is rendered at 2x (for example, 1080 × 1920 becomes 2160 × 3840) and exported as PNG and lossless WebP.

## Resolving a request

1. **Exact size** (`1200x630`, `1200×630`, `1200 by 630`): use it as-is. If either side is larger than 2000, halve both for the canvas so the 2x export matches the requested size, and mention this in the final reply.
2. **Aspect ratio** (`1:1`, `4:5`, `9:16`, `16:9`, `3:2`, `2:3`, `4:3`): the short side is 1080. Portrait and square ratios use a width of 1080 (9:16 becomes 1080 × 1920). Landscape ratios use a height of 1080 (16:9 becomes 1920 × 1080).
3. **Platform or placement:** use the preset below. If the platform has several placements and the request doesn't say which, use the platform's default and mention the alternatives in the final reply.
4. **Descriptive words** mean the same in any language:
   - "square" → 1:1
   - "story", "reel", "vertical" or "full screen" → 9:16
   - "landscape" or "wide" → 16:9
   - "link preview" or "share image" → Open Graph

**File names:** use `thumbnail-<preset>`, for example `thumbnail-story.png` or `thumbnail-1200x630.png`. The default format for the page type keeps the name `thumbnail`.

## Presets

Sizes are the canvas size, before the 2x export.

| Preset | Platforms and placements | Canvas | Ratio |
|---|---|---|---|
| `portfolio` | Portfolio and case-study thumbnails (site default) | 1080 × 720 | 3:2 |
| `square` | Instagram post (default), Facebook post, LinkedIn post, X post, WhatsApp, Telegram | 1080 × 1080 | 1:1 |
| `portrait` | Instagram portrait post, Facebook portrait post | 1080 × 1350 | 4:5 |
| `story` | Instagram Stories and Reels, TikTok, Snapchat, YouTube Shorts, WhatsApp Status, Facebook Stories | 1080 × 1920 | 9:16 |
| `landscape` | YouTube thumbnail, X landscape post, presentation slide | 1920 × 1080 | 16:9 |
| `og` | Open Graph link preview, LinkedIn and Facebook link shares (article default) | 1200 × 630 | ≈1.91:1 |
| `pin` | Pinterest | 1000 × 1500 | 2:3 |
| `dribbble` | Dribbble shot | 1600 × 1200 | 4:3 |
| `behance` | Behance project cover | 808 × 632 | ≈1.28:1 |

## Safe zones for 9:16

App interfaces cover parts of full-screen vertical posts. Keep the logo, the text and the key subject inside these margins. Values are canvas pixels and approximate.

| Platform | Top | Bottom | Sides |
|---|---|---|---|
| TikTok | 160 | 480 | 120 (action buttons on the right) |
| Instagram Stories and Reels | 250 | 340 | 64 |
| Snapchat | 150 | 300 | 64 |
| YouTube Shorts | 200 | 420 | 140 (right) |

If the platform is unknown, use the strictest combination: top 250, bottom 480, sides 140. Backgrounds and decorative parts can still fill the whole canvas.

## Layout by shape

Recompose for the shape. Never letterbox or squash the default layout. Keep the same identity and, where possible, the same composition idea.

- **Landscape (3:2, 16:9):** side by side. Put the text column on the reading-start side and the visual on the other.
- **Wide (≈1.91:1, Open Graph):** like landscape, with tighter vertical spacing and a sentence of two or three lines.
- **Square (1:1):** put the text in the top or bottom 40% and the visual in the rest, or use a centered stack. Type is larger than in landscape; the sentence is about 60–72px.
- **Portrait (4:5, 2:3):** a vertical stack. Logo and category at the top, the visual in the middle, the sentence at the bottom, or the reverse.
- **Vertical (9:16):** a tall stack inside the safe zone. The visual may bleed full-width behind it, the sentence is about 64–84px, and the logo sits near the top of the safe zone.

## Suggesting another format

After delivery, suggest one other format that fits how the work is likely to be shared, in one line:

| Delivered | Suggest |
|---|---|
| portfolio | square, or story |
| square | story |
| story | square |
| og (article) | square, or story |
| landscape | square |
