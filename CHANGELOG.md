# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## [1.1.1] - 2026-10-21

### Fixed

- Large Arabic headings no longer touch the elements around them. `canvas.html` gives `[data-fit]` text a line height of 1.45 with a little vertical padding, and the composition rules ask for space after large Arabic headings and a check in the render.

## [1.1.0] - 2026-10-19

### Changed

- Lower token usage, roughly half or less per thumbnail, with the same design quality. The workflow now runs in fewer turns: inspection, extraction and the history check run as one command, and the design is written and rendered in a single step.
- Extraction now writes `overview.png`, a labelled contact sheet of every capture. The agent reviews the whole identity kit in one view, then opens only the assets it chose at full size.

## [1.0.0] - 2026-10-19

### Added

- Identity extraction: captures the hero and page sections, crops distinctive elements, and downloads the original images, the site's own fonts and design tokens.
- Nine compositions: Hero Scene, Component Collage, Typographic Poster, Product Showcase, Code & Terminal, Device Frame, Pattern & Motif, Split Editorial and Feature Grid.
- Composition history to keep consecutive runs varied, and support for a composition named or described in the request.
- Article mode: thumbnails about a single article's topic, with automatic detection.
- Output formats: the portfolio default, Open Graph, and platform presets (square, portrait, 9:16 stories with safe zones, landscape, Pinterest, Dribbble, Behance), plus any exact size or ratio.
- Export at 2x as PNG and lossless WebP, with no text metadata.
- Right-to-left and left-to-right layouts, the site's own fonts with Noto fallbacks, and a language prompt for bilingual sites.
- Local project support, which temporarily runs the project's dev server.
- Compatibility with any agent that supports Agent Skills.

[1.1.0]: https://github.com/aeentech/thumbnail-skill/releases/tag/v1.1.0
[1.0.0]: https://github.com/aeentech/thumbnail-skill/releases/tag/v1.0.0
