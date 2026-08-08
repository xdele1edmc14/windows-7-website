# Themes Control Panel Design

## Goal

Build a Windows 7 Personalization page that lets a person change the WebOS desktop theme, wallpaper, window colors, and switch sound as one operation. The page lives inside the existing Control Panel shell and opens from both the Control Panel home view and the desktop context menu.

The implementation must keep the current desktop visible until every required target asset is ready. A slow connection or failed download must never expose an empty or black desktop.

## Desktop Job and Historical Analogue

The app's job is: "This app lets a person choose the desktop's Windows visual and sound theme."

It follows the Windows 7 Control Panel Personalization page. The existing Control Panel window remains the top-level window and taskbar object; Themes is a third internal view beside `home` and `display`.

- Default window size: 1120 by 680 pixels.
- Existing minimum window size: 760 by 500 pixels.
- Primary object: a theme.
- Primary action: select and apply a theme.
- Persistent state: the selected theme identifier and its wallpaper.
- Main command hierarchy: eight theme cards arranged in two named groups; Back returns to Control Panel home.

## Exact Theme Catalog

The page contains exactly eight themes. It does not include other categories, online-theme links, additional settings links, or promotional content.

### Aero Themes (4)

1. **Windows 7**
   - Wallpaper: `./assets/img0.png`
   - Sound: Windows Logon sound
   - Appearance: the current default WebOS Aero appearance
2. **Architecture**
   - Wallpaper: `./assets/architecture.jpg`
   - Sound: `./assets/architecture.mp3`
   - Appearance: Aero with an architecture-derived preview tint
3. **Landscape**
   - Wallpaper: `./assets/landscape.jpg`
   - Sound: `./assets/landscape.mp3`
   - Appearance: Aero with a landscape-derived preview tint
4. **Nature**
   - Wallpaper: `./assets/nature.jpg`
   - Sound: `./assets/nature.mp3`
   - Appearance: Aero with a nature-derived preview tint

### Basic and High Contrast Themes (4)

5. **Windows 7 Basic**
   - Wallpaper: `./assets/img0.png`
   - Sound: Windows Logon sound
   - Appearance: standard Windows 7 layout with transparency and backdrop blur disabled on windows, taskbar, and Start menu
6. **Windows Classic**
   - Desktop: solid `#3B6EA4`
   - Sound: Windows Logon sound
   - Taskbar, Start menu, context menus, and window borders: `#D4D0C8`
   - Appearance: opaque Windows 95/2000-style controls and borders
7. **High Contrast Black**
   - Desktop: `#000000`
   - Sound: Windows Logon sound
   - Window borders and text: `#FFFFFF`
   - Accents and links: `#FFFF00`
8. **High Contrast White**
   - Desktop: `#FFFFFF`
   - Sound: Windows Logon sound
   - Window borders and text: `#000000`
   - Accents and links: `#0000FF`

The Windows Logon sound will be served from the main `assets` directory so all theme definitions use the same document-relative asset base.

## Page Layout

The Themes view uses an opaque white Control Panel document pane. Its heading is `Change the visuals and sounds on your computer`, followed by `Click a theme to change the desktop background, window color and sound all at once`.

The content contains only two collapsible-looking, always-expanded group headings:

- `Aero Themes (4)`
- `Basic and High Contrast Themes (4)`

Each group contains four compact theme cards. A card combines a wallpaper or solid-color preview, a small chrome/color swatch, and its theme name. The active card uses the Windows 7 pale-blue selection rectangle. Hover is a preview state; clicking, Enter, or Space commits the selection.

At narrower widths the cards wrap without changing catalog order. The document pane scrolls when vertical space is insufficient. No bottom personalization shortcuts are added.

## Architecture and Module Boundaries

### `themes.js`

Owns the immutable theme catalog and a `ThemesApp` controller. The controller receives explicit callbacks rather than importing the desktop engine:

- `applyTheme(theme)` applies already-preloaded values to the shell;
- `getActiveThemeId()` supplies initial selection;
- `onThemeApplied(theme)` schedules persistence;
- `showWaitState()` and `hideWaitState()` control transient system feedback.

It renders the eight cards, handles keyboard selection, preloads required assets, serializes theme switches, updates active-card state, and plays the cached switch sound.

### `themes.css`

Owns the Personalization document layout, group headings, card previews, selected/hover/focus states, responsive wrapping, and reduced-motion treatment.

### `control-panel.js`

Remains responsible for Control Panel navigation. It adds `themes` as an internal view, routes the Personalize catalog entry to that view, updates the address to `Control Panel > Personalization`, and returns to home through Back.

### `index.js`

Owns desktop-level theme state and application. It creates the Themes controller, routes the desktop `Personalize` context-menu command to the same Control Panel view, applies the theme identifier and CSS variables to the WebOS root, swaps the preloaded wallpaper, manages the wait overlay, and stores the active theme identifier.

### `profile-store.js`

Extends normalized settings with a valid `themeId`. Old profiles without a theme identifier migrate to `windows-7`. Unknown identifiers also fall back to `windows-7`. Existing wallpaper data remains supported.

## Theme State and CSS Contract

The shell root receives `data-theme="<theme-id>"`. Shared CSS custom properties describe the active material without forcing individual apps to know theme names. The properties cover:

- desktop background color and optional wallpaper;
- document foreground/background;
- frame, taskbar, Start-menu, and context-menu surfaces;
- border and caption text;
- link/accent and selection colors;
- whether transparency and backdrop blur are enabled.

Theme-specific selectors use these variables to restyle the existing window frames, taskbar, Start menu, desktop context menus, and Control Panel content. Aero themes retain current glass. Basic removes transparency while preserving Windows 7 geometry. Classic uses opaque gray beveled materials. High Contrast themes prioritize exact requested colors and legibility over ornamental glass.

## Asset Preloading and Atomic Switching

Only one theme-switch transaction may commit at a time. Each click receives a monotonically increasing request token; a superseded request may finish loading but cannot change the desktop or play sound.

The selected theme's required assets are loaded without modifying current visual state:

- Wallpaper-backed themes use an `Image` promise that resolves after `decode()` when available, falling back to the load event.
- Every theme uses an `Audio` promise that resolves only after the browser reports enough data to play through (`canplaythrough`), with `loadeddata` accepted when the resource is already cached and ready.
- Solid-color Classic and High Contrast themes do not invent wallpaper files; they preload only the Windows Logon sound.

After all required promises resolve, the desktop engine applies the theme identifier, CSS variables, and wallpaper or solid desktop color in one animation frame. The prior wallpaper is not cleared before this commit.

## Please Wait State

Starting a switch adds a full-desktop transient overlay above the shell but below the modal. Its backdrop gradually desaturates the existing desktop. The small centered modal uses the active Windows 7 frame material and contains only `Please Wait`.

The overlay and modal live outside the element being filtered so the dialog remains in color and readable. While active they block further shell interaction, expose `role="dialog"` and `aria-modal="true"`, and move focus to the wait dialog. On completion, focus returns to the activated theme card.

The grayscale effect fades in and back out. Under `prefers-reduced-motion: reduce`, state changes remain immediate while the modal and preload guarantee remain intact.

## Success, Failure, and Audio Behavior

On success:

1. Apply the cached theme atomically.
2. Mark the card active and persist the theme.
3. Fade the grayscale overlay away.
4. Remove the wait modal and restore focus.
5. Reset the cached audio to time zero and play it.

If an asset fails, the current theme and wallpaper remain unchanged. The dialog changes to a concise failure message: `The theme could not be loaded.` It provides a `Close` button, restores focus when dismissed, and does not persist or play the target sound.

An audio `play()` rejection caused by browser policy after successful loading does not roll back a visually applied theme. It is handled without an unhandled promise rejection.

## Entry Points

- Desktop context menu: `Personalize` opens the existing Control Panel window directly on Themes.
- Control Panel home: selecting `Personalize` opens Themes in place.
- Back: returns from Themes to Control Panel home.
- Reopening either entry point refreshes the active selection from desktop state.

The existing `Screen Resolution / Display` path and Control Panel home behavior remain unchanged.

## Keyboard and Accessibility Behavior

- Tab enters and leaves the theme grid through its active card.
- Arrow keys move focus among cards within the eight-item ordered grid.
- Home and End move to the first and last theme.
- Enter and Space apply the focused theme.
- The active theme is conveyed through selected styling and `aria-checked="true"` in a radio-group model.
- Focus remains visibly distinct in Aero, Basic, Classic, and both High Contrast modes.
- Theme thumbnails have accessible names from their visible labels; decorative preview layers are hidden from assistive technology.

## Verification

Automated tests must verify:

- exactly eight theme definitions in the specified order and groups;
- the confirmed wallpaper, color, and sound mapping;
- Control Panel Personalize navigation, address text, and Back behavior;
- stale theme-switch requests cannot commit;
- successful preloading applies once and failed preloading preserves the active theme;
- profile normalization defaults and preserves valid theme identifiers;
- the desktop context command routes to Themes.

Static checks include the full Node test suite, JavaScript syntax checks for every changed script, and `git diff --check`.

Browser verification must cover:

- boot and login without console errors;
- both Themes entry points;
- exactly two groups and eight cards with no extra links or categories;
- all eight themes, including required wallpaper, solid desktop colors, shell surfaces, text, borders, accents, and sounds;
- a throttled-network switch showing the retained wallpaper, grayscale transition, and `Please Wait` dialog until assets finish;
- an asset failure that leaves the current desktop intact;
- rapid repeated card activation committing only the latest request;
- persistence after reload/login;
- keyboard navigation and focus restoration;
- reduced motion;
- minimum window size, maximize, and restore;
- screenshots of Aero, Basic, Classic, High Contrast Black, and High Contrast White states.
