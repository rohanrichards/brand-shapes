# Changelog

## Unreleased — Wordmark Logo & Custom Colors

### Added
- **Wordmark logo variant.** Logo folder gains a Style dropdown (Symbol / Wordmark). Wordmark sits at 180×32 base size at the 1920×1080 reference, scaled by the same `min(W/1920, H/1080)` rule as the symbol.
- **Arbitrary logo color (RGBA).** Color picker replaces the black/white toggle, with a separate Opacity slider (0–1). Renderer and SVG export accept any CSS color string, so logos can be transparent or off-brand.

### Changed
- Logo API: `LogoStyle` type added; `LogoColor`/`LOGO_FILL`/`LOGO_PATHS`/`LOGO_VIEWBOX` removed in favor of `LOGO_VARIANTS[style]` (`{ viewBox, base, paths }`). `computeLogoPlacement(style, w, h)` takes a style argument. `RenderConfig.logo` and `SVGExportConfig.logo` are now `{ style, color }` where color is any CSS color string.

## Unreleased — Wallpaper Export & Logo

### Added
- **User-controlled export dimensions.** Width and Height fields (16–16384 px) on the Export folder. Output is rendered at exact pixel dims, suitable for screen wallpapers (1080p, 4K) and large-format print (e.g. A0 at 300 DPI = 9933×14043 px).
- **Format dropdown.** PNG / JPG / SVG. JPG exposes a Quality slider (0.5–1.0). PNG and SVG expose a Transparent BG toggle. Filename is `brand-shape-{w}x{h}.{ext}`.
- **Portable logo overlay.** New Logo folder with Enabled and Color (black/white) controls. Positioned bottom-left at 100×88 with 48px padding (matching the Zoom template at 1920×1080) and scaled by `min(W/1920, H/1080)` for any export size. Vector in SVG export, Path2D in canvas (crisp at any resolution).
- **WYSIWYG live preview.** Canvas letterboxes to the export aspect inside the window, centred with a `#1a1a1a` surround.

### Changed
- Renderer signature: `render(canvas, config, target)` where `target = { width, height, dpr }`. Previously read dimensions from `canvas.clientWidth/Height` and `window.devicePixelRatio` directly.
- Removed the "High Res SVG" toggle. SVG resolution is now driven by the user-chosen Width/Height.

### Notes
- A0-sized PNG exports can exceed 200 MB raw and may fail in low-memory browsers. Prefer JPG (quality 0.95) for prints larger than 4K.

## 2026-03-20 — Colour System Overhaul

:art: *Brand Shapes Update — Colour System Overhaul*

*Pick Your Own Colours*
You now choose three individual colours instead of picking from preset families:
• *From* — bookends your gradient
• *Catalyst* — small accent that adds a spark
• *To* — the dominant colour filling most of the shape
18 colours from the Portable brand guidelines to choose from.

*New Presets*
8 new presets based on real Figma brand combinations. Each includes a matching background colour and film grain.

*Background Colour*
Set the background behind your shapes — any brand colour, black, white, or transparent.

*Randomize*
Shuffle shapes, colours, layout, and background all at once. Noise and blur stay untouched.

*Export as PNG*
Download your creation as a PNG. Toggle transparent background for easy layering into other designs.

*Friendlier Controls*
Dropdowns now show colour names alongside hex codes (e.g. "lime (#BEF958)").
