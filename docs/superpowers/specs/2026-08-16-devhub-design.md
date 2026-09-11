# DevHub Desktop App Design

## Decision

Build DevHub as a dedicated application in the existing Windows 7 desktop shell. The shell continues to own the Aero frame, caption controls, drag and resize behavior, taskbar, Start menu, desktop shortcut, focus, and window lifecycle. DevHub owns one isolated GitHub Dark document surface that presents the configured developer portfolio without recreating GitHub's global dashboard.

The supplied 1024 x 1024, 32-bit PNG is the canonical DevHub logo. Copy it without redrawing or regenerating it to `assets/icons/devhub.png`, then use that file for the title bar, desktop shortcut, Start-menu entry, taskbar button, and in-app GitHub mark. The profile portrait remains the real GitHub avatar and is separate from the app logo.

## Considered approaches

1. **Dedicated hybrid shell app (selected).** `devhub.js` builds and controls the app from a configuration-first snapshot, with optional public GitHub API refreshes. This matches existing app boundaries, remains useful offline, and does not allow API availability to change critical portfolio links or activity copy.
2. **Static snapshot only.** This is the most predictable option, but the status bar could not truthfully say that GitHub is connected and public follower or repository metadata would become stale.
3. **Fully API-driven profile.** This would refresh public data automatically, but unauthenticated rate limits, CORS, missing contribution APIs, and repository changes would make the requested composition unreliable.

## App brief

- **App name:** DevHub
- **Era boundary:** Windows 7 frame around a modern GitHub Dark document surface
- **Desktop job:** Browse xDele1ed's projects, technical skills, and development activity, then open the selected project destination
- **Historical analogue:** A third-party source-control/profile browser hosted as a conventional Windows desktop application
- **Primary object/action:** Repository card; activate it to open its configured Discord or GitHub destination
- **Default window size:** 1060 x 680 pixels
- **Minimum size:** 720 x 500 pixels
- **Chrome layers:** Shell title bar, compact DevHub command/header strip, tab navigation, document pane, and status bar
- **Persistent state:** None across page reloads; active tab, search, language filter, tooltip, toast, and API state live for the current app instance
- **Host integration:** Asset registry, app registry, Start menu, desktop shortcut, taskbar appearance, focus, close/minimize/maximize, and boot/remount behavior

## Architecture and files

`devhub.js` exposes immutable `DEVHUB_CONFIG`, repository and skills data, heatmap generation, filtering helpers, a `DevHubApp` class, and `mountDevHubApp` through CommonJS and `window.Windows7DevHub`. The class accepts a mount element, document, tab-opening function, and fetch function so behavior can be exercised without a real browser or network.

`devhub.css` owns all interior styles below `.devhub-window`. It uses the requested GitHub Dark Default tokens, while leaving the shell-owned title bar and global Windows 7 surfaces untouched. Segoe UI remains the shell voice; the document surface uses GitHub's system stack with Segoe UI available first on Windows.

`boot-assets.js`, `index.html`, and `index.js` receive narrow registration additions for the logo, stylesheet/script load order, Start-menu item, desktop shortcut, and taskbar appearance. The DevHub script loads before `index.js` so the shell can inventory the constructed window. Existing Welcome, YouTube, Start-menu, desktop-theme, and user-owned changes are preserved.

`tests/devhub-app.test.js` covers app-owned behavior and narrow production integration points. It must not assert incidental private markup when a user-visible result can be exercised instead.

## Global configuration

The top of `devhub.js` contains one frozen configuration object with these production values:

- Handle and display name: `xDele1ed`
- GitHub username: `xdele1edmc14`
- Pronouns: `he/him`
- Bio: `Software & Plugin Engineer | Java, Node.js, TypeScript | Working on high-performance server systems and custom web tools.`
- Organization: `NullPointer Studios`
- Location: `The Earth`
- Website: `https://xdele1ed.is-a.dev`
- Snapshot social counts: `1` follower and `0` following
- Profile avatar fallback: `https://github.com/xdele1edmc14.png`
- DEADLANDS: `https://discord.gg/XPUh4zJagc`
- xApocalypse: `https://github.com/xdele1edmc14/xApocalypse`
- Infected-revamped: `https://github.com/xdele1edmc14/Infected-revamped`
- windows-7-website: `https://github.com/xdele1edmc14/windows-7-website`
- xos-portfolio: `https://github.com/xdele1edmc14/xos-portfolio`
- minecraft-setup: `https://github.com/xdele1edmc14/minecraft-setup`
- Version: `v2.4.0`

Critical destinations always come from this configuration. API data may refresh public metadata but cannot replace redirect URLs or portfolio copy.

## Window and interior structure

The `1060 x 680` window opens centered and is resizable down to `720 x 500`. Its body fills the shell-provided content area with no outer page scroll. A fixed-height DevHub header contains the supplied logo, a repository search field with `Type / to search`, and the three tabs. A fixed status bar remains visible at the bottom.

Between those layers, the document area uses a 30/70 split at widths of `768px` and above. The profile sidebar and main canvas scroll independently so profile metadata remains usable without stealing space from activity. Below `768px`, they become one vertically scrolling column: profile first, selected tab content second. At compact widths, the search and tabs wrap into deliberate full-width rows without hiding a command.

Custom WebKit scrollbars use `#0d1117`, `#161b22`, and `#30363d`, with a Firefox `scrollbar-color` fallback. Reduced-motion and forced-colors rules retain state and focus without decorative transitions.

## Profile sidebar

The sidebar contains:

- A circular GitHub profile avatar with a bordered status indicator. If the remote image fails, an `XD` initials fallback replaces it.
- Display name `xDele1ed` at 24px and `xdele1edmc14 · he/him` as muted supporting text.
- The configured bio as normal multi-line copy, without an "About me" heading.
- An `Edit profile`-style button that is visibly disabled and labeled by tooltip as a portfolio preview control; it must not pretend to modify GitHub.
- Icon-backed metadata for `1 follower`, `0 following`, `NullPointer Studios`, `The Earth`, and `xdele1ed.is-a.dev`. The website is a secure external link.
- A `Skills` section instead of GitHub achievements. Pills list Java, JavaScript, TypeScript, GDScript, Spigot / Paper API, Node.js, Express, REST APIs, Maven, Git, Bash / Shell, and Web OS Architecture.

Skill pills brighten their background and border on hover and show a visible keyboard focus state when they are rendered as navigable filter controls. No achievement badges, YOLO badge, Arctic Code Vault badge, or decorative substitute appears.

## Tabs and state

The navigation is an ARIA tab list with `Overview` active initially. `Repositories` and `Skills` switch panels without rebuilding the shell window. The active tab uses a persistent bottom border in `#58a6ff`; hover is a preview and does not change selection.

Left and Right Arrow move tab focus, while Enter or Space selects the focused tab. `/` focuses the repository search field unless the user is already typing in a form control. Escape clears an open heatmap tooltip or toast first, then clears the repository search when no transient UI remains.

Typing a non-empty query switches to `Repositories` and filters immediately by name, description, language, and badge text. Clearing the query keeps the user on the repository tab. The language selector adds an `All languages` option and filters jointly with the query. When nothing matches, the pane states `No repositories match your search.` and offers a real `Clear filters` button.

## Overview panel

### Pinned repositories

The selected two-column pinned grid contains exactly four cards:

1. **DEADLANDS** — `Custom hardcore zombie apocalypse survival ecosystem with custom mechanics.` Language: Java. Badge: Discord. Destination: the configured DEADLANDS Discord invite.
2. **xApocalypse** — `A hardcore zombie apocalypse survival plugin for Spigot/Paper.` Language: Java. Stars: 1. Badge: Public repository.
3. **Infected-revamped** — `Forked and revamped version of the original Infection plugin with bug fixes and balance updates.` Language: Java. Badge: Public fork.
4. **windows-7-website** — `Interactive Web OS desktop interface built with pure modern web technologies.` Language: JavaScript. Badge: Public repository.

Cards use GitHub's compact pinned-repository treatment rather than oversized dashboard tiles. Every card has `cursor: pointer`, visible hover/focus/pressed states, and a single focus target. DEADLANDS and xApocalypse show a top-right external-link arrow. Repository badges and language dots include text so meaning never depends on color alone.

### Contribution heatmap

The graph contains 52 columns by 7 rows for the complete Sunday-through-Saturday span from August 17, 2025 through August 15, 2026. A checked-in deterministic dataset totals exactly `195 contributions in the last year`; it does not pretend to be live GitHub contribution data. Month labels run from Aug through Jul and repeat Aug at the final boundary where space permits. Day labels show Mon, Wed, and Fri.

Each cell has one of the five supplied heat levels and an accessible label containing its exact count and date. Mouse hover or keyboard focus opens a custom tooltip such as `12 contributions on Aug 14, 2026`. The legend includes `Less`, all five level swatches, and `More`. No native alert or confirm is used.

### Contribution activity

The August 2026 timeline reproduces the requested portfolio snapshot:

- Created 39 commits in 3 repositories: `windows-7-website` with 17 commits, `minecraft-setup` with 12 commits, and `xDele1ed-Portfolio` with 10 commits.
- Created 2 repositories: `xdele1edmc14/Infected-revamped` and `xdele1edmc14/xDele1ed-Portfolio`.
- Opened 2 pull requests in 2 repositories, with open and merged state labels matching the reference hierarchy.

Repository names that have configured public destinations are links. Snapshot-only activity names remain readable text if no trustworthy destination is configured.

## Repositories panel

The repository panel shows the configured portfolio collection rather than cloning GitHub's global discovery UI. It includes DEADLANDS, xApocalypse, Infected-revamped, windows-7-website, xos-portfolio, and minecraft-setup. Cards share the same compact metadata vocabulary as Overview and honor the active query and language filter.

Results are sorted with the four pinned entries first, followed by xos-portfolio and minecraft-setup. Clicking, pressing Enter, or pressing Space opens the configured destination in a secure separate tab. The main desktop remains open.

## Skills panel

The Skills panel expands the sidebar pills into three compact groups:

- **Core languages:** Java, JavaScript, TypeScript, GDScript
- **Frameworks and APIs:** Spigot / Paper API, Node.js, Express, REST APIs
- **Build tools and systems:** Maven, Git, Bash / Shell, Web OS Architecture

Each group pairs direct capability descriptions with restrained proficiency labels such as `Primary`, `Production`, and `Working knowledge`. It does not use marketing percentages, progress-ring scores, or unverified certification claims.

## Redirects and external navigation

One `handleRepoCardClick(repoKey)` boundary maps repository keys to `DEVHUB_CONFIG.links`. DEADLANDS maps only to Discord; xApocalypse, Infected-revamped, windows-7-website, xos-portfolio, and minecraft-setup map to their configured GitHub URLs. All external destinations use `window.open(url, "_blank", "noopener,noreferrer")`.

Mouse click, Enter, and Space share the same activation path. Nested decorative icons cannot create additional tab stops or double activation. Website and repository links follow the same opener-isolation rule. A missing or malformed destination does not navigate and instead shows the in-app toast `This project link is unavailable.`; Escape dismisses that toast and focus remains on the invoking card.

## GitHub API enhancement and status bar

After mounting, DevHub requests the public user and repository endpoints for `xdele1edmc14`. A successful response may update the avatar URL, follower/following counts, and matching repository stars/languages. It cannot add global feeds, replace descriptions, rearrange pinned projects, or change destinations.

The status bar has three regions:

- Left: `Ready`, changing briefly to `Filtering repositories` while filters update.
- Center: `Connecting to GitHub API`, then either `Connected to GitHub API` or `Using saved profile snapshot`.
- Right: `v2.4.0`.

Fetch failure, malformed responses, rate limiting, or offline use leaves all configured content available. The fallback status is announced through a polite live region. No blocking dialog appears, and retry is available through a compact `Retry` status action only after failure.

## Accessibility and visual behavior

- Every icon-only command has an accessible name and native tooltip.
- Focus is clearly visible against both GitHub Dark content and the Aero title bar.
- Tab, search, filter, repository cards, heatmap cells, links, retry, and clear-filter controls are keyboard reachable in a logical order.
- Active state, language, contribution intensity, API state, and pull-request state combine color with text or shape.
- Hover transitions stay between 120 and 180ms and are removed under `prefers-reduced-motion: reduce`.
- The content meets the requested GitHub tokens: `#0d1117`, `#161b22`, `#30363d`, `#e6edf3`, `#8d96a0`, `#58a6ff`, `#79c0ff`, and `#238636`, plus the five supplied heatmap levels and language colors.
- Aero glass remains limited to the shell frame. DevHub's reading and data surfaces remain opaque.

## Native control and status-bar overrides

- The Language control remains a semantic native `select`, but DevHub overrides the shared light shell combobox with a dark surface, muted arrow, dark option popup, and readable option text.
- The status bar has no inherited 7.css footer frame or white highlight. It keeps only the intentional `#30363d` top separator between content and status.
- These overrides are scoped under the DevHub window and do not alter selects or footers in other shell apps.

## Testing and verification

Implementation follows red-green-refactor. Focused tests first prove configuration and redirect behavior, secure mouse/keyboard activation, active-tab changes, search and joint language filtering, empty-filter recovery, deterministic 195-contribution heatmap output, tooltip content, API success/fallback state, and production shell registration.

After focused tests pass, run the complete `node --test tests/*.test.js` suite, JavaScript syntax checks, and `git diff --check`. Existing unrelated failures are reported with exact evidence and are not hidden by overwriting user changes.

Browser verification runs through a local HTTP server. It covers desktop and Start-menu launch, exact logo usage, default sizing, taskbar lifecycle, minimize/restore, maximize/restore, wide and compact layouts, independent and unified scrolling, all three tabs, query and language filters, heatmap hover and keyboard tooltips, external-tab behavior, API success or truthful fallback status, focus order, reduced motion, and console errors. The final result is visually compared with the supplied GitHub reference while preserving the host Windows 7 frame.
