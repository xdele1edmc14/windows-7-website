# iOS Control Center Design

## Goal and Scope

Add an iOS-style Control Center to the existing Framework7 phone shell. Its composition, glow, colors, glass, and wallpaper blur should closely match the supplied 280-by-499 reference while scaling in the shell's existing 393-by-852 logical coordinate system.

This pass includes the Control Center reveal/dismiss gesture, responsive presentation, interactive visual states, fake media playback, draggable brightness and volume controls, an expanded connectivity panel, and a Wi-Fi network submenu. It does not add real networking, Bluetooth, audio playback, device brightness, camera access, flashlight access, screen mirroring, or system-setting integration.

## Entry and Gesture Ownership

The currently inert top-right status-bar pull becomes the Control Center gesture. A primary pointer beginning within the top 50 logical points and in the right 42 percent of the screen owns `control-center-reveal`; the existing top-left region continues to own Notification Center. The overlay follows downward motion one-to-one, then commits or springs closed from release distance and velocity. Pulling upward on the open overlay dismisses it with the same direct-manipulation rules. Tap-away and Escape are accessible dismissal paths.

Control Center is available after Hello has completed from Home and placeholder app surfaces. It does not compete with boot, Hello, Spotlight, Notification Center, app-removal confirmation, or icon editing. The active pointer retains one coordinate system until release so browser-chrome resizing cannot reset the drag. Pointer cancellation returns to the previous stable state.

## Visual Composition

The supplied reference is treated as the source of truth for composition. Its horizontal measurements scale by approximately `393 / 280`, producing 24-point outer margins, roughly 16-point gaps, 160-point upper cards, 76-point circular controls, 160-point Focus pill, and 74-by-160-point vertical sliders. Controls occupy the upper and middle screen with open blurred wallpaper below, matching the reference instead of distributing items across the full height.

The background is a real duplicate of the active wallpaper, scaled with the shell and processed with an estimated 42-point blur, increased saturation, and a dark blue-green scrim. This is an explicit approximation because Apple does not publish Control Center material constants. It must remain visibly derived from the wallpaper rather than becoming a flat translucent fill.

Cards use layered materials rather than one shared opacity:

- connectivity and media cards use blue-lavender translucent gradients, edge highlights, inset bloom, and backdrop blur;
- inactive circular controls use smoky teal or neutral gray glass;
- active Wi-Fi and Bluetooth use luminous iOS blue, cellular uses green, and active utility controls use a restrained brightened material;
- brightness and volume use blue upper wells with white lower fills, rounded continuously at both ends;
- soft blue/teal radial glow behind selected controls recreates the reference bloom without applying glow to every surface;
- Framework7 Icons provide interface symbols; no emoji or external icon family is introduced.

Reduced Transparency swaps the blur stack for opaque color-matched surfaces. Increased Contrast strengthens edges and labels. Reduced Motion keeps state changes clear while replacing spring travel and decorative bloom transitions with near-instant changes.

## Control Layout and Behavior

The first row contains a connectivity card on the left and a media card on the right. The connectivity card contains Airplane Mode, AirDrop, Wi-Fi, Cellular Data, Bluetooth, Personal Hotspot, and Satellite controls in the reference's large/small-circle arrangement. A normal tap toggles each visual state and updates `aria-pressed`; these states are session-only gimmicks.

Pressing and holding the connectivity card for 500 ms expands it into a larger, focused connectivity panel with labeled rows. Pressing and holding Wi-Fi within that panel for 500 ms opens a second submenu listing several clearly fictional networks plus an Off control. Selecting a network only updates the displayed connected network and Wi-Fi state. Back, tap-away, swipe-up dismissal, and Escape unwind one presentation layer at a time. A completed hold suppresses the following synthetic click so it cannot accidentally toggle a control.

The media card begins with `Not Playing`. Activating Play changes the title to `Radiohead`, changes Play to Pause, and advances no timeline or audio element. Activating Pause returns to a paused visual state while retaining `Radiohead`; previous and next briefly animate but do not change content.

Below the cards are Rotation Lock and Bell circular toggles, a Focus pill, vertical Brightness and Volume sliders, then Flashlight, Screen Mirroring, Camera, and Remote circular controls. Brightness and Volume follow pointer position continuously and expose native range-input keyboard semantics. They alter only their visible fill and percentage accessibility value. The remaining controls toggle their own visual state or show a brief local status label; they do not invoke browser or operating-system capabilities.

Every target is at least 44-by-44 logical points. Visible labels and `aria-label`/`aria-pressed`/`aria-valuenow` state prevent color from being the only state indicator.

## Architecture and State

`Phone-UI/index.html` receives the semantic Control Center overlay, controls, expanded connectivity panel, and Wi-Fi submenu. The overlay starts `hidden` and `inert` as a named modal dialog.

`Phone-UI/main.css` owns all shared material tokens, reference geometry, glow, blur, safe-area spacing, slider visuals, accessibility fallbacks, and responsive behavior. No CDN or new raster asset is required.

`Phone-UI/control-center-core.js` owns independently testable gesture projection, slider clamping, and immutable state transitions. It exports a classic global/CommonJS API following `home-core.js` and loads before `app.js`.

`Phone-UI/app.js` remains the shell gesture arbiter. It mounts the Control Center state, routes top-right pulls, renders state from the core module, coordinates pointer capture, opens and dismisses submenu layers, restores focus to the invoking shell surface, and prevents modal collisions. Control state lives for the current page session and resets on reload.

## Failure and Interruption Handling

The feature requires no network and adds no production asset-loading failure mode. If backdrop filtering is unavailable, color-matched opaque materials preserve hierarchy. If Framework7 Icons fail, the existing boot gate continues to catch the font failure before Home appears.

New gestures interrupt in-flight Control Center springs. A pointer cancel or visibility loss settles to the preceding stable state. Opening another shell modal first dismisses Control Center; opening Control Center is ignored while a higher-priority modal owns focus. Resize is deferred until an active pointer completes, matching the repaired Hello gesture contract.

## Verification

Core tests cover top-right versus top-left gesture routing, distance/velocity commitment, cancellation, slider clamping, media state, toggle state, fictional network selection, and submenu unwinding. Controller tests cover pointer-capture handoff, drag-following, resize deferral, modal exclusion, focus restoration, and synthetic-click suppression after a hold. Static UI tests cover semantic controls, modal names, local dependency order, icon usage, and initial hidden/inert state.

Full verification runs `node --test tests/*.test.js`, `node --check` on changed scripts, and `git diff --check`. Browser QA covers open/close at mobile and framed desktop sizes, touch dragging above native browser/system gesture regions, long-press connectivity expansion, long-press Wi-Fi submenu, slider manipulation, fake Radiohead playback, reduced motion, reduced transparency, and comparison against the supplied reference. Physical-device QA remains a separate evidence boundary from automated browser tests.
