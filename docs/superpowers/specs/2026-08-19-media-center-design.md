# Media Center Portfolio Design

## Product definition

Media Center lets a person browse xDele1ed's visual work through a Windows 7 Media Center-style desktop application. Its historical analogue is Windows 7 Media Center's full-screen picture and media libraries, adapted into a portfolio without turning the interface into a website or modern dashboard.

The app opens maximized over the desktop work area on every fresh launch. It retains the shell's standard Minimize, Restore Down/Maximize, Close, drag, and resize behavior. Its restored target size is 1100 by 680 pixels and its minimum usable size is 760 by 500 pixels.

## Startup sequence

Every fresh launch plays a 4.8-second sequence over `assets/media center/wallpaper.png`. Restoring a minimized window does not replay it.

- 0.00-0.45 seconds: the wallpaper is already present, with a restrained blue atmospheric lift rather than a black frame.
- 0.45-1.65 seconds: soft blue Windows-era light ribbons and small lens glints travel across the existing wallpaper.
- 0.85-2.45 seconds: the supplied `main_logo.png` resolves from the light as the glossy Windows orb. “Media Center” appears beside it with Segoe UI and period-appropriate easing.
- 2.25-3.65 seconds: the orb and branding move toward their live header positions. The “My Work” heading and category rail enter from the left while the gallery begins resolving from the right.
- 3.55-4.80 seconds: project images sharpen, the selected tile receives its white Media Center focus glow, and the bottom controls and clock settle into place. The intro layer becomes the live interface rather than disappearing to an unrelated screen.

`intro.mp3` starts with the sequence. Because the supplied track is 6.165 seconds while the required intro is 4-5 seconds, playback remains at its original pitch and fades during the final 220 milliseconds before stopping at 4.8 seconds. If audio playback is blocked or the file is missing, the visual sequence continues. Reduced-motion mode keeps the same information and duration but replaces travel, scale, and blur with restrained opacity changes.

## Main interface

The document surface uses `wallpaper.png` without aggressive cropping. It has three spatial zones:

1. Header: back control and the supplied Windows orb at top left; compact current time at top right.
2. Library: “My Work” and the category rail at left; current category, featured tile, secondary tiles, project title, type, and page position at right.
3. Transport: Windows Media Center-style media controls at bottom right.

The selected category and project use a bright white edge, controlled cyan bloom, slight enlargement, and persistent focus state. Movement uses short horizontal slides, opacity changes, and slight blur during transition only. Ordinary text remains white and readable against a darkened portion of the wallpaper.

## Portfolio model

`media-center-data.js` is the only portfolio-content source. Each frozen project object contains `id`, `title`, `description`, `category`, `image`, `secondaryImages`, `year`, and `type`. All supplied posters, portraits/profile artwork, and thumbnails appear in the catalog. Categories are exactly Graphic Design, Branding, Posters, UI Design, Logos, and Other Work.

Missing images render a calm “Preview unavailable” surface while preserving title and metadata. Missing audio disables only the affected sound, never navigation.

## Interaction and state

The controller tracks view (`library` or `detail`), category index, project index, playback state, and sound volume. Category and project changes are serialized so rapid input cannot leave stale transition classes or open multiple details.

- Up/Down moves through categories.
- Left/Right moves through projects in the library and previous/next projects in detail.
- Enter/Space confirms the focused category, project, or control.
- Escape/Backspace returns from detail; at library root the shell Close button remains the deliberate way to exit.
- Mouse hover previews focus and plays a throttled interaction cue; click commits the action.
- The detail view has a visible Back command, large contain-fitted artwork, title, description, year, type, category, and previous/next navigation.

Bottom controls are Stop, Previous, Rewind, Play/Pause, Next, Fast-forward, a divider, Mute/Volume, Volume down, and Volume up. Previous/Next move one item; Rewind/Fast-forward move two; Play starts or pauses a gentle 4.5-second gallery advance; Stop returns to the first project and stops playback. Media controls use `sidebutton-click.mp3`, navigation uses throttled `ui-interact.mp3`, and confirmation actions use `ui-confirm.mp3`.

## Architecture and shell integration

- `media-center-data.js`: immutable category, asset, and project configuration.
- `media-center.js`: window construction, launch timeline, navigation state, rendering, audio channels, keyboard handling, and lifecycle cleanup.
- `media-center.css`: Media Center visuals, responsive layout, intro choreography, focus/pressed states, reduced motion, forced colors, and missing-asset states.
- `index.html`, `boot-assets.js`, and `index.js`: stylesheet/script loading, app icon registration, shortcut/start menu entry, and fresh-open/close lifecycle events.
- `tests/media-center-app.test.js`: behavior-first controller tests using the real module and a lightweight DOM fixture.

The app has no external dependencies or network requirements. Important local images and audio are preloaded when the app is constructed. Audio channels reuse one element each and observe short cooldowns to prevent stacking.

## Verification

Automated verification covers catalog shape, window construction, fresh-launch versus restore behavior, the 4.8-second cue contract, category/project navigation, detail/back behavior, control semantics, audio routing, rapid input, missing assets, keyboard commands, and shell registration. Final checks include `node --check`, focused tests, the full `npm.cmd test` suite, `git diff --check`, and browser inspection at maximized and restored/minimum sizes.
