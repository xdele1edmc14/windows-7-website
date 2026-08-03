# Control Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive Windows 7 Control Panel home view that opens from Start, filters its 19 entries, and navigates to the existing Display settings view.

**Architecture:** A focused `control-panel.js` module owns catalog and view behavior while the existing shell engine retains window/taskbar responsibilities. Static shell regions live in `index.html`, app-specific styling lives in `control-panel.css`, and narrow integration hooks in `index.js` route existing entry points to home or Display.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node.js built-in test runner, existing 7.css window chrome.

## Global Constraints

- Render exactly 19 entries and omit Programs and Features, Region and Language, and Power Options.
- Use `assets/icons/defaultprograms.ico` for Default Programs, `gadgets_64x64.png` for Personalize, and `assets/icons/speaker.png` for Sound.
- Open at approximately 1120 by 680 pixels with a minimum size of 760 by 500 pixels.
- Display is the only implemented destination; all other entry buttons are intentional no-ops.
- Add no third-party dependencies.
- Preserve unrelated dirty-worktree changes and do not commit implementation files that already contain user changes.

---

### Task 1: Control Panel catalog and filtering

**Files:**
- Create: `control-panel.js`
- Create: `tests/control-panel.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `CONTROL_PANEL_ITEMS`, an immutable array of `{ id, label, icon, action }` records.
- Produces: `filterControlPanelItems(items, query)`, returning entries whose labels contain the trimmed query case-insensitively.
- Produces: browser global `Windows7ControlPanel` and CommonJS exports with the catalog, filter, and app class.

- [ ] **Step 1: Write catalog and filter tests**

Create tests asserting 19 entries, the three omissions, requested icon substitutions, a single `display` action, empty-query behavior, and case-insensitive substring matching.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --test tests/control-panel.test.js`
Expected: FAIL because `control-panel.js` does not exist.

- [ ] **Step 3: Implement the catalog and pure filtering helper**

Create a dependency-free UMD-style module usable through CommonJS tests and `window.Windows7ControlPanel` in the browser.

- [ ] **Step 4: Enable and run the test suite**

Set `package.json` test to `node --test tests/*.test.js`, then run `npm test`.
Expected: all catalog and filtering tests PASS.

### Task 2: Control Panel shell and controller

**Files:**
- Modify: `control-panel.js`
- Create: `control-panel.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: `CONTROL_PANEL_ITEMS` and `filterControlPanelItems` from Task 1.
- Produces: `Windows7ControlPanel.ControlPanelApp` with `showHome({ clearSearch = false })`, `showDisplay()`, and `destroy()`.
- Produces: DOM hooks `data-control-panel-home`, `data-control-panel-display`, `data-control-panel-grid`, `data-control-panel-empty`, `data-control-panel-address`, and `data-control-panel-search`.

- [ ] **Step 1: Add the shell markup and script/style includes**

Split the current Display content into home and Display view containers inside the existing window, add stable data hooks, and load `control-panel.css` and `control-panel.js` before `index.js`.

- [ ] **Step 2: Implement rendering and view state**

Render catalog buttons into the grid. Wire search input to filtering, empty-result copy, Display activation, Back navigation, address text, and disabled Back state.

- [ ] **Step 3: Implement the reference layout**

Style the toolbar and content shell, four-column grid, 48-pixel icons, teal labels, focus/hover states, and three/two-column responsive breakpoints.

- [ ] **Step 4: Run automated checks**

Run: `npm test && node --check control-panel.js && node --check index.js`
Expected: all commands PASS.

### Task 3: Shell engine integration

**Files:**
- Modify: `index.js`

**Interfaces:**
- Consumes: `window.Windows7ControlPanel.ControlPanelApp` and its `showHome`/`showDisplay` methods.
- Produces: `#openControlPanel(view)` routing both Start and desktop-context entry points through the existing `display` app window.

- [ ] **Step 1: Configure controller lifetime**

Add a private Control Panel controller field, construct it during desktop configuration, and destroy it with the shell engine.

- [ ] **Step 2: Wire both entry points**

Make Start-menu Control Panel call `#openControlPanel("home")`. Make Screen Resolution / Display call `#openControlPanel("display")`. Preserve the existing taskbar identity and window controls.

- [ ] **Step 3: Run static and automated checks**

Run: `npm test && node --check index.js && git diff --check`
Expected: all commands PASS.

### Task 4: Browser interaction verification

**Files:**
- Modify only files required to correct defects found during verification.

**Interfaces:**
- Consumes: completed Control Panel feature from Tasks 1–3.
- Produces: verified user-visible behavior with no browser console errors.

- [ ] **Step 1: Open the local desktop and log in**

Serve the repository on localhost, complete the existing boot/login flow, and open Control Panel from the Start menu.

- [ ] **Step 2: Verify home and search**

Confirm 19 entries, four columns at the default width, filtering for `display`, restoration after clearing, and the empty state for an unmatched query.

- [ ] **Step 3: Verify navigation**

Open Display, verify the address and enabled Back button, return Home, then verify Screen Resolution / Display opens directly to Display.

- [ ] **Step 4: Verify resizing and console state**

Narrow the window to confirm responsive reflow, then inspect browser logs for errors.

- [ ] **Step 5: Run final checks**

Run: `npm test && node --check control-panel.js && node --check index.js && git diff --check`
Expected: all commands PASS.
