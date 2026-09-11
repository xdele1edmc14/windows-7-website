# iPhone shell — phase 1

Open `index.html` directly, or serve this directory with any static web server.
Framework7 Core 9.1.2 and Framework7 Icons 5.0.5 load from jsDelivr; an internet
connection is required for those dependencies. There is no build step or wrapper.

The main portfolio automatically shows this phone below 700px and Windows at
700px and above. The phone is loaded once in an isolated iframe; subsequent
resizes preserve both experiences. Windows system and Media Center sound is
muted while the phone is shown. The standalone phone URL still supports a device
frame at desktop widths.

The phone starts with a five-second Apple-logo boot, extended as needed until
its wallpaper/logo have decoded and Framework7 styles, script and icon font are
ready. Asset failures show a retry control. Swipe up on the lock screen (or activate its home
indicator) to unlock. Swipe sideways to move between three home pages. Tap an
icon to open its colored placeholder; drag its bottom indicator upward to return.
Hold an icon for 500 ms to edit, then use a minus badge and the removal sheet.
Tap Search or pull down below the status bar to reveal Spotlight. Its input is
visual only. Removal changes the demo catalog for the current session; reload
restores it. The lock-screen flashlight toggles its button state only.

Keyboard: Enter/Space activate buttons, left/right arrows change home pages,
F2 toggles editing, and Escape dismisses the current overlay or app. Dialogs
contain keyboard focus and restore it on dismissal. Reduced motion and reduced
transparency preferences have explicit fallbacks.

## Files and tuning

- `index.html`: shell layers, controls, CDN imports.
- `main.css`: all visual tokens, materials, frame, grid, and accessibility styles.
- `app.js`: placeholder catalog, clock, gesture ownership, animations, and focus.
- `home-core.js`: independently tested projection, resistance, and geometry.
- `boot-loader.js`: image/font readiness, failure and timeout handling.
- `ios-boot-core.js`: existing animation utility; the shell reuses its cancellable spring.
- `wallpaper.png`: supplied original image, shared by home and lock layers.

## Reference assumptions

The brief names both 1290×2796 and 393×852 @3x; those are different sizes. Layout
uses 393×852 logical coordinates (1179×2556 at exactly @3x). The supplied
screenshots themselves are 1284×2778. One uniform scale fits the logical frame;
other aspect ratios extend the wallpaper and positioning space. At 700px and
above, a height-fitted device bezel and Dynamic Island appear without reloading.

The supplied wallpaper has a darker color treatment than the screenshots.
The source file is unchanged; shared CSS color grading estimates the lighter
lavender appearance. The lock's foreground silhouette and clock font mask are
approximations: the proprietary Apple clock face is not bundled. Per-layer blur
values and the 73% sample battery are documented in CSS/markup. Widget content is
decorative except the clock, which uses system time.

Open uses the requested 400ms cubic-bezier(.2,.8,.2,1), with no overshoot.
Close geometry follows pointer deltas before release; release velocity controls
the return duration. Page and Spotlight release use cancellable springs. These
are documented approximations to iOS behavior, not private Apple physics values.

No real apps, Control Center, App Library, search results, or app switcher are
implemented. The app surfaces exist solely to exercise icon morphing.

## Verification

From the repository root: `npm test`. Phone tests cover gesture geometry,
velocity expiry, page boundaries, easing, dependency order, and entry semantics.
Browser QA additionally exercises unlocking, paging, app opening/closing,
editing/removal, Spotlight, and switching across the 700px frame breakpoint.
