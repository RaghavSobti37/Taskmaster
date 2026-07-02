# Logo & loading spinner — LOCKED (Jun 2026)

The user finalized **The Harmonic Frequency** mark: **white on green**, hand-drawn six-spoke geometry. Do not change unless they explicitly ask to unlock the logo or spinner.

## Brand mark (white on green)

- **Spokes:** 6 paths from `soundwaveSpoke()` in `logoHarmonicGeometry.js`
- **Hub:** circle at (32, 32), r = 2.2
- **Mark colors:** stroke/fill `#ffffff` (`logoBrandTokens.js`)
- **Shell:** brand green `#126d5e`, rounded ~22% (`brand-logo` class)
- **Size only:** `LOGO_MARK_SCALE` 1.15 from hub — not path edits
- **Favicon:** `client/public/brand-mark.svg` (green rect + white paths)

## Locked files

| File | What is locked |
|------|----------------|
| `client/src/components/brand/logoHarmonicGeometry.js` | Spoke path math |
| `client/src/components/brand/logoBrandTokens.js` | Colors, scale, hub r, stroke width |
| `client/src/components/brand/logoMarkStyles.js` | SVG stroke/fill props |
| `client/src/components/brand/HarmonicLogo.jsx` | SVG structure + transform |
| `client/src/components/brand/BrandLogo.jsx` | Green shell wrapper |
| `client/public/brand-mark.svg` | Static mark for favicon/PWA |

## Loading spinner (default `frl-v-02`)

- **Component:** `FluidRibbonLoader` / `Spinner`
- **Default variant:** `frl-v-02` Uniform Calm (`fluidRibbonLoaderCatalog.js`)
- **Color:** `#126d5e` on loader strokes
- **Logic:** 4-layer hub cascade; do not revert to random 2-layer or scale-on-hub without user request
- **Copy:** `client/src/lib/loadingPhrases.js` (200+ phrases) — no generic “Loading…” in UI; boot screen = large spinner only, no logo

## Allowed without unlock

- `className` on `BrandLogo` for layout (margin, size prop) — not stroke/color/geometry
- Gallery preview of other `frl-v-*` variants on `/components`
- Copy/docs referencing the mark

## Unlock procedure

User must explicitly request logo or spinner changes. Re-read this doc; minimal diff; preserve white-on-green and geometry unless they say otherwise.
