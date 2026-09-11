# YouTube Desktop App Design

## Decision

Build YouTube as a dedicated application in the existing Windows 7 desktop shell. The native shell owns the Aero title bar, minimize/maximize/close controls, drag/resize behavior, taskbar button, Start-menu entry, and desktop shortcut. The document surface inside the frame is an isolated modern YouTube Dark Theme implementation.

## Considered approaches

1. **Dedicated shell app (selected).** A `YouTubeApp` ES6 class builds and controls one window. This gives the requested 960 x 580 default frame, a first-class desktop identity, and external navigation without replacing the portfolio desktop.
2. **Page inside the existing Chrome app.** This would reuse browser chrome but add unwanted tabs/address controls and make the requested dimensions and app identity inaccurate.
3. **Static window markup in `index.html`.** This would render correctly but would make the already-large shell document harder to maintain and would mix YouTube data and behavior into host markup.

## App brief

- **App name:** YouTube
- **Era boundary:** Windows 7 frame around a modern YouTube document surface
- **Desktop job:** Browse a curated YouTube-style feed and leave the portfolio OS for the selected real YouTube video
- **Primary object/action:** Video card; activate to open its mapped YouTube URL in a separate browser tab
- **Default window size:** 960 x 580 pixels
- **Minimum size:** 760 x 480 pixels
- **Persistent state:** None; the feed resets when the page is reloaded
- **Host integration:** App registry, Start menu, desktop shortcut, taskbar appearance, native window lifecycle

## Architecture

`youtube.js` exports immutable feed data and a `YouTubeApp` class through both CommonJS and `window.Windows7YouTube`, matching the project's browser/test pattern. The class receives a mount element, a document, and an optional tab-opening function for testability. It builds the complete window before `index.js` inventories shell windows, binds the sidebar toggle, and routes card activation through a single boundary whose browser default opens a separate tab with opener isolation.

`youtube.css` owns every rule below the `.youtube-window` namespace. It neutralizes inherited 7.css control styling only inside the app document surface, uses YouTube's Roboto/Arial stack and dark palette, and preserves the shell's Aero title bar. No YouTube CSS changes the global taskbar, Start menu, or other apps.

`index.js`, `index.html`, and `boot-assets.js` receive narrow registration changes. A new YouTube icon is used for the Start menu, desktop shortcut, and taskbar. Existing user-owned welcome-app and Start-menu changes remain untouched.

## Interior structure

The interior uses a 56px fixed header, a 220px fixed sidebar, a horizontally scrollable chip row, and one independently scrollable feed canvas. The header contains the hamburger control, YouTube logo with `BD`, rounded search input/button, microphone, Create pill, notification badge, and profile avatar.

The expanded sidebar includes Home, Shorts, and five subscriptions with local avatar treatments and blue activity dots. The hamburger collapses it to a 72px rail while preserving accessible labels and expanding the feed.

The feed renders six 16:9 video cards from the local thumbnail assets in two groups of three, with a four-card 9:16 Shorts shelf between them. Each card has a duration overlay, avatar, title, channel, views/time metadata, and an overflow affordance. The exact requested topic chips are rendered above the feed, with `All` selected.

## Navigation and interaction

- Clicking a main video thumbnail, title, or card opens its mapped URL in a separate tab.
- Clicking a Short uses the same separate-tab rule and a mapped YouTube URL.
- No modal, embedded player, or iframe is created; the portfolio desktop stays open in its current tab.
- New tabs use `_blank` with `noopener,noreferrer` so they cannot control the portfolio window.
- Enter or Space on a focused video card performs the same tab-opening action.
- The hamburger toggles expanded/compact sidebar state and updates `aria-expanded`.
- Icon-only controls have accessible names, tooltips, hover, active, and focus-visible states.

## Responsive behavior

At the 960 x 580 default size the expanded sidebar and three-column grid remain visible. Below the preferred width the card grid reduces to two columns; below the 760px minimum, overflow is handled by the host rather than shrinking controls into illegibility. Maximizing expands the grid without changing card proportions. The chip row scrolls horizontally and never wraps.

## Verification

Automated tests cover window construction, required feed mapping, sidebar state, keyboard/click tab opening, secure new-tab configuration, and shell registration. Static checks cover both JavaScript files and whitespace. Browser QA runs from a local HTTP server and verifies the dedicated desktop shortcut, Start-menu launch, 960 x 580 frame, modern dark interior, sidebar collapse, scrolling, taskbar lifecycle, maximize/restore, and the absence of console errors. External navigation is verified by confirming that activation creates one new tab while the portfolio desktop remains open.
