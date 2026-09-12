# Font provenance and visual theme

Verified 2026-09-12. Both apps load unmodified variable TrueType font binaries downloaded with `curl` from the official [Google Fonts repository](https://github.com/google/fonts). No font API, external stylesheet, CDN request, paid service, package dependency, or runtime network access is needed for typography. File names were simplified locally; binary contents were not modified or subsetted.

## Font sources and licenses

| Local font | Use / CSS weight range | Official binary | License shipped beside the font |
| --- | --- | --- | --- |
| `web/assets/fonts/SpaceGrotesk-wght.ttf` | Space Grotesk: headings, wordmarks, prominent metrics; normal 300–700 | [Google Fonts original](https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf) | [SpaceGrotesk-OFL.txt](../web/assets/fonts/SpaceGrotesk-OFL.txt), SIL Open Font License 1.1 |
| `web/assets/fonts/Manrope-wght.ttf` | Manrope: body, navigation, forms, captions; normal 200–800 | [Google Fonts original](https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf) | [Manrope-OFL.txt](../web/assets/fonts/Manrope-OFL.txt), SIL Open Font License 1.1 |

Space Grotesk's license states Copyright 2020 The Space Grotesk Project Authors; its [Google Fonts metadata](https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/METADATA.pb) credits Florian Karsten. The [upstream project](https://github.com/floriankarsten/space-grotesk) is recorded at upstream commit `03507d024a01282884232081fc6011c09ff4e849` in that metadata.

Manrope's license states Copyright 2018 The Manrope Project Authors; its [Google Fonts metadata](https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/METADATA.pb) credits Mikhail Sharanda (the metadata's separate copyright field says 2019; the included license is preserved verbatim). The metadata records [upstream source](https://github.com/aaronbell/manrope) commit `6f81ebecdf65e4463b798cc07b16a4f8d5216917`.

Both complete OFL 1.1 texts were read and retained. Their terms permit embedding and redistribution with software while preserving the copyright and license notices. The fonts are not sold separately. The Google Fonts `main` source URLs can change; the SHA-256 values below identify the exact downloaded files. Upstream commit identifiers above are metadata references, not a claim that these downloads were pinned to a Google Fonts repository commit.

## Asset fingerprints

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Manrope-OFL.txt` | 4384 | `e01b637272e0cbdfb240184dd98ea5cc671556d9894dae2668d92ab2c906787c` |
| `Manrope-wght.ttf` | 165420 | `d0639be45d0af36e798172419d7bd173c4bd4f29e2b76cbb69db1d11bf8b0a40` |
| `SpaceGrotesk-OFL.txt` | 4495 | `564ce565c371c5e5bbf286006565a7c9aa55a9f56e7ca58d56e05d649dd61a72` |
| `SpaceGrotesk-wght.ttf` | 136676 | `acad6de1fc93436f5c0f1f4137751ef04f1aea3063e7036535970ffcfbd79f72` |

## CSS contract for both apps

Both stylesheets define `@font-face` with `/assets/fonts/SpaceGrotesk-wght.ttf` and `/assets/fonts/Manrope-wght.ttf`, `font-display: swap`, and actual supported variable weight ranges. Body defaults to 400, controls to 500/600, headings to 600, wordmarks to 700; intermediate legacy 450/550/650 weights were normalized to 400/600/700. Display headings use `--font-display`; all form controls inherit `--font-body` through the body. Synthetic font styling is disabled. Existing monospace source IDs and delivery references remain monospace.

Mentor's external Google Fonts `@import` was removed. No change to the site's CSP is required to allow external font hosts. The parent runtime owner should confirm local font delivery; the inspected server currently returns `application/octet-stream` for TTF, so an explicit `.ttf: font/ttf` MIME entry is a possible server follow-up outside this file ownership.

## Palette and ecosystem handoff

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#faf8f5` | Warm-white page |
| `--paper`, `--surface` | `#ffffff` | Cards/forms |
| `--ink` | `#202448` | Main text |
| `--muted` | `#626780` | Supporting text |
| `--line` | `#dde1ef` | Quiet borders |
| `--soft` | `#f5f6fc` | Quiet tinted surfaces |
| `--primary` | `#3455eb` | Cobalt buttons, active navigation, focus |
| `--primary-hover` | `#2842c8` | Button hover and links |
| `--primary-soft`, `--primary-line` | `#edf0ff`, `#c6d0ff` | Cobalt tints and borders |
| `--indigo` | `#3730a3` | Wordmarks and secondary display emphasis |
| `--teal`, `--teal-soft`, `--teal-line` | `#087871`, `#e5f6f2`, `#aedfd3` | Health, successful outcomes |
| `--coral`, `--coral-ink` | `#ed624f`, `#ae3f32` | Decorative accents / readable coral text |
| `--coral-soft`, `--coral-line` | `#fff0e9`, `#f2c6ba` | Career/accent tints |
| `--warning`, `--warning-soft`, `--warning-line` | `#88510d`, `#fff3df`, `#edcea1` | Pending review and policy caution |
| `--danger`, `--danger-soft`, `--danger-line` | `#b13842`, `#fff0f1`, `#efc3c9` | Errors |
| `--font-display` | Space Grotesk + fallback stack | Distinctive headings |
| `--font-body`, `--font` | Manrope + fallback stack | Legible body and controls |

Mentor's existing names are retained: `--sage` → `--primary-soft`; `--sage-dark` → `--indigo`; `--olive` → `--primary-hover`; `--accent` → `#dce5ff`; `--health` → `--teal`; `--career` → `--coral-ink`; `--radius` remains 12px. The ecosystem worker can use these existing tokens or the explicit shared tokens above. Use `--coral-ink` for small coral text; reserve brighter `--coral` for decorative marks and bars.

DealGuard's compatibility tokens remain available: `--green` → `--primary-hover`, `--green-soft` → `--primary-soft`, `--lime` → `--primary`, `--amber` / `--amber-soft` → warning tokens, `--red` / `--red-soft` → danger tokens. Its favicon is white on cobalt; theme-color matches the warm canvas.

## Minimal verification

- mentoros: existing geometry unchanged; appended declarations limited to color/type; balanced CSS; all variables and local font paths resolve.
- dealguard: existing geometry unchanged; appended declarations limited to color/type; balanced CSS; all variables and local font paths resolve.
- DealGuard DOM/content unchanged; head changes limited to theme-color and favicon colors.
- Main text / warm canvas: 14.08:1
- Muted text / warm canvas: 5.25:1
- Muted text / tinted surface: 4.91:1
- White / cobalt action: 5.76:1
- White / cobalt hover: 7.77:1
- Indigo / active soft background: 8.76:1
- Teal / health or success background: 4.78:1
- Coral ink / coral background: 5.31:1
- Warning / warning background: 5.93:1
- Danger / danger background: 5.40:1

Binary checks confirmed sfnt/TrueType signatures, bounded table records, `name`, `cmap`, `glyf`, and `fvar` tables, and the actual 300–700 / 200–800 weight axes. All local font URLs resolve to nonempty assets. CSS checks confirmed balanced braces/brackets/parentheses and defined custom properties. Original geometry declarations, font sizes, line heights, letter spacing, breakpoints, and layout structure were preserved; font family/weight changes can alter text wrapping, which requires the parent's browser review.

Browser/UI validation is deferred to the parent as assigned. Mentor's `index.html` and `ecosystem.css` were not edited by this worker. No application behavior or server files were edited.
