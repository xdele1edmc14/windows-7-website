# YouTube Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Windows 7 desktop app whose 960 x 580 interior is a faithful modern YouTube Dark Theme feed and whose cards open the supplied YouTube URLs in separate browser tabs.

**Architecture:** A standalone UMD-style `youtube.js` module exposes the feed model and `YouTubeApp`, constructs its window before the shell engine inventories apps, and owns all interior behavior. A namespaced `youtube.css` reproduces YouTube while the existing shell continues to own Aero/window/taskbar behavior; narrow shell edits register the app icon and launch surfaces.

**Tech Stack:** Vanilla JavaScript ES6 classes, CommonJS-compatible browser module, semantic HTML generated with DOM APIs, pure CSS, Node.js built-in test runner, local browser QA.

## Global Constraints

- The default app window is exactly 960 x 580 pixels with native Windows 7 minimize, maximize, and close controls.
- The interior background is `#0f0f0f` and follows modern YouTube Dark Theme structure and density.
- Use only Vanilla JavaScript ES6+ classes/modules and pure CSS.
- Render all ten requested topic chips, six mapped main videos, and four 9:16 Shorts cards.
- Video activation opens a separate tab with `noopener,noreferrer`; never use a modal, internal player, or iframe.
- Preserve all unrelated dirty and untracked work.

---

### Task 1: Define the app contract and feed behavior test-first

**Files:**
- Create: `tests/youtube-app.test.js`
- Create: `youtube.js`

**Interfaces:**
- Produces: `VIDEO_ITEMS`, `TOPIC_CHIPS`, `SHORT_ITEMS`, and `YouTubeApp({ mount, document, openTab })`.
- Produces: `YouTubeApp.sidebarCollapsed: boolean` and `YouTubeApp.setSidebarCollapsed(boolean)`.
- Tab callback signature: `(targetUrl: string, target: string, features: string) => void`; browser default calls `window.open(targetUrl, "_blank", "noopener,noreferrer")`.

- [ ] **Step 1: Write a failing construction test**

Create a small real fake-DOM fixture following `tests/welcome-app.test.js`, construct `YouTubeApp`, and assert a `data-app-window="youtube"` window with width `960`, height `580`, all ten chips, six main cards, and four Shorts cards.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/youtube-app.test.js`

Expected: FAIL because `../youtube.js` does not exist.

- [ ] **Step 3: Implement the module and semantic DOM**

Implement frozen feed arrays with the exact supplied titles, channels, URLs, and local thumbnail paths. Build the shell window, header, sidebar, chips, first three videos, Shorts shelf, and final three videos with buttons and semantic labels.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/youtube-app.test.js`

Expected: PASS with the structure and counts asserted.

- [ ] **Step 5: Add a failing interaction test**

Assert hamburger activation toggles `.youtube-app--sidebar-collapsed` and `aria-expanded`; assert mouse and keyboard activation each call the injected tab-opening callback exactly once with the mapped URL, `_blank`, and `noopener,noreferrer`.

- [ ] **Step 6: Run the interaction test and verify RED**

Run: `node --test tests/youtube-app.test.js`

Expected: FAIL because sidebar and activation handlers are not yet bound.

- [ ] **Step 7: Implement minimal interactions and verify GREEN**

Bind the hamburger, click, Enter, and Space handlers. Run `node --test tests/youtube-app.test.js` and confirm all focused tests pass.

### Task 2: Reproduce the modern YouTube Dark Theme surface

**Files:**
- Create: `youtube.css`
- Modify: `tests/youtube-app.test.js`

**Interfaces:**
- Consumes the class names and state attributes produced by `YouTubeApp`.
- Produces a responsive app document surface scoped under `.youtube-window`.

- [ ] **Step 1: Add failing layout contract tests**

Assert computed/browser-visible contracts through stable state hooks: fixed header/sidebar/chip classes exist, the main feed owns scrolling, thumbnails use 16:9 wrappers, Shorts use 9:16 wrappers, and the active chip/sidebar entries expose semantic selected/current state.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/youtube-app.test.js`

Expected: FAIL because the stylesheet and layout hooks do not yet exist.

- [ ] **Step 3: Implement the namespaced stylesheet**

Define the `#0f0f0f` surface, 56px header, 220px/72px sidebar states, YouTube pill controls, search field, topic strip, three-column feed, video metadata, duration badges, Shorts shelf, focus states, reduced motion behavior, and two-column fallback. Reset inherited 7.css control styling only within `.youtube-window__body`.

- [ ] **Step 4: Verify focused tests GREEN**

Run: `node --test tests/youtube-app.test.js`

Expected: PASS.

### Task 3: Register YouTube with the Windows 7 shell

**Files:**
- Create: `assets/icons/youtube.svg`
- Modify: `boot-assets.js`
- Modify: `index.html`
- Modify: `index.js`
- Modify: `tests/youtube-app.test.js`

**Interfaces:**
- Consumes `window.Windows7YouTube.YouTubeApp` and the window added beneath `[data-desktop]`.
- Adds `ASSETS.youtube`, `APP_SHORTCUTS.youtube`, Start-menu `data-start-icon="youtube"`, desktop shortcut metadata, and taskbar appearance.

- [ ] **Step 1: Add failing shell integration tests**

Read the production HTML and shell modules, then assert behaviorally relevant integration: the app module loads before `index.js`, a Start-menu YouTube button exists, `ASSETS.youtube` resolves to the new icon, and the application registry can create a YouTube shortcut/taskbar appearance.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/youtube-app.test.js`

Expected: FAIL because shell registration is absent.

- [ ] **Step 3: Add the icon and narrow registration edits**

Add a YouTube play-mark SVG, load `youtube.css` and `youtube.js` before `index.js`, append the constructed app window to the desktop mount, add the Start-menu entry, add the default desktop shortcut through the existing filesystem initialization, and register taskbar icon/glow behavior.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/youtube-app.test.js`

Expected: PASS.

### Task 4: Verify behavior and visual fidelity

**Files:**
- Modify only files above if verification exposes a defect, always after adding a failing regression test.

**Interfaces:**
- Consumes the fully integrated local application.
- Produces automated and visual evidence at the requested default size.

- [ ] **Step 1: Run static and complete automated verification**

Run:

```powershell
node --check youtube.js
node --check index.js
npm.cmd test
git diff --check
```

Expected: every command exits `0`, with zero failed tests.

- [ ] **Step 2: Run local browser QA**

Serve the repository through a local HTTP server, log in, open the YouTube desktop shortcut, and inspect the 960 x 580 frame at normal desktop size. Verify titlebar controls, Start-menu launch, taskbar state, header proportions, sidebar collapse, chip overflow, three-column cards, Shorts shelf, feed scrolling, maximize/restore, keyboard focus, and zero console errors.

- [ ] **Step 3: Verify separate-tab navigation wiring safely**

In browser QA, activate a thumbnail and confirm the exact mapped URL opens in one separate tab while the portfolio desktop remains available in the original tab. Retain the production default `window.open(targetUrl, "_blank", "noopener,noreferrer")` and confirm no modal, player, or iframe appears.

- [ ] **Step 4: Compare with the supplied reference**

Capture the open app at default size and compare alignment, spacing, colors, control shapes, thumbnail crops, text wrapping, and visible content density with the reference image. Correct any material mismatch through a failing regression test where behavior is involved, then rerun all verification.
