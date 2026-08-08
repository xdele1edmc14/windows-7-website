# Themes Control Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an eight-theme Windows 7 Personalization app with atomic asset preloading, full-shell palette switching, persistence, and desktop/Control Panel launch paths.

**Architecture:** A standalone `themes.js` module owns the catalog, preloading transaction, card UI, and switch orchestration. The existing Control Panel owns navigation, while `index.js` owns desktop state, shell theme application, wait UI, and persistence. Theme CSS variables flow from `data-theme` on the WebOS root into window, taskbar, Start-menu, context-menu, and Personalization styles.

**Tech Stack:** HTML, CSS, vanilla JavaScript, 7.css, Node.js built-in test runner, browser QA.

## Global Constraints

- Render exactly the eight approved themes in exactly two groups; add no online links, extra categories, or bottom shortcuts.
- Windows 7, Windows 7 Basic, Windows Classic, High Contrast Black, and High Contrast White use the Windows Logon sound.
- Architecture uses `#7EA1D5`, Landscape uses `#B2B6BB`, and Nature uses `#B29ACC` for taskbar, Start menu, and window Aero glass.
- Preserve the current wallpaper until every required target asset is loaded.
- Basic disables transparency; Classic and High Contrast use the exact requested solid colors.
- Honor reduced motion and retain keyboard/focus behavior.
- Preserve all unrelated uncommitted work.

---

### Task 1: Theme catalog, preloader, and transaction controller

**Files:**
- Create: `themes.js`
- Create: `tests/themes.test.js`

**Interfaces:**
- Produces: `THEME_GROUPS`, `THEMES`, `preloadImage(source, ImageCtor)`, `preloadAudio(source, AudioCtor)`, and `ThemeSwitchController` on `window.Windows7Themes` and CommonJS.
- `ThemeSwitchController` constructor accepts `{ preloadTheme, applyTheme, playSound, onBusyChange, onError }` and exposes `switchTo(theme)`.

- [ ] **Step 1: Write catalog and transaction tests**

```js
test("catalog exposes only the approved themes and exact Aero accents", () => {
  assert.deepEqual(THEMES.map(({ id }) => id), [
    "windows-7", "architecture", "landscape", "nature",
    "windows-7-basic", "windows-classic", "high-contrast-black", "high-contrast-white"
  ]);
  assert.equal(THEMES.find(({ id }) => id === "architecture").accent, "#7EA1D5");
  assert.equal(THEMES.find(({ id }) => id === "landscape").accent, "#B2B6BB");
  assert.equal(THEMES.find(({ id }) => id === "nature").accent, "#B29ACC");
});

test("a superseded preload cannot commit", async () => {
  const commits = [];
  const pending = new Map();
  const controller = new ThemeSwitchController({
    preloadTheme: (theme) => new Promise((resolve) => pending.set(theme.id, resolve)),
    applyTheme: (theme) => commits.push(theme.id),
    playSound: async () => {}, onBusyChange: () => {}, onError: () => {}
  });
  const first = controller.switchTo(THEMES[1]);
  const second = controller.switchTo(THEMES[2]);
  pending.get("architecture")({});
  pending.get("landscape")({});
  await Promise.all([first, second]);
  assert.deepEqual(commits, ["landscape"]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/themes.test.js`

Expected: FAIL because `../themes.js` does not exist.

- [ ] **Step 3: Implement the minimal catalog and controller**

```js
class ThemeSwitchController {
  #request = 0;
  async switchTo(theme) {
    const request = ++this.#request;
    this.onBusyChange(true);
    try {
      const assets = await this.preloadTheme(theme);
      if (request !== this.#request) return false;
      await this.applyTheme(theme, assets);
      this.onBusyChange(false);
      await this.playSound(theme, assets);
      return true;
    } catch (error) {
      if (request === this.#request) this.onError(error);
      return false;
    }
  }
}
```

- [ ] **Step 4: Run the focused and full suites**

Run: `node --test tests/themes.test.js && npm test`

Expected: PASS.

- [ ] **Step 5: Commit the module and tests**

```powershell
git add -- themes.js tests/themes.test.js
git commit -m "feat: add theme catalog and preload transactions"
```

### Task 2: Personalization view and Control Panel navigation

**Files:**
- Modify: `index.html`
- Modify: `control-panel.js`
- Modify: `control-panel.css`
- Create: `themes.css`
- Modify: `tests/control-panel.test.js`
- Modify: `tests/themes.test.js`

**Interfaces:**
- Consumes: `window.Windows7Themes.ThemesApp` and immutable theme catalog from Task 1.
- Produces: `ControlPanelApp.showThemes()` and a `[data-control-panel-themes]` view containing `[data-themes-grid]`.

- [ ] **Step 1: Add failing navigation and rendering tests**

```js
test("Personalize opens Themes and Back returns home", () => {
  const app = new ControlPanelApp(root);
  grid.children.find(({ dataset }) => dataset.controlPanelItem === "personalize").click();
  assert.equal(themesView.hidden, false);
  assert.equal(address.textContent, "Control Panel > Personalization");
  backButton.click();
  assert.equal(homeView.hidden, false);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/control-panel.test.js tests/themes.test.js`

Expected: FAIL because the Themes view and `showThemes()` do not exist.

- [ ] **Step 3: Add the view, exact two-group card UI, and navigation**

```html
<main class="themes-window" data-control-panel-themes hidden>
  <h1>Change the visuals and sounds on your computer</h1>
  <p>Click a theme to change the desktop background, window color and sound all at once</p>
  <div data-themes-grid></div>
</main>
```

Load `themes.css` and `themes.js` before `control-panel.js`. Extend Control Panel view toggling so home, Display, and Themes are mutually exclusive. Render four cards per approved group with radio semantics, roving tabindex, arrows, Home/End, Enter, and Space.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test tests/control-panel.test.js tests/themes.test.js && npm test`

Expected: PASS.

- [ ] **Step 5: Commit the Personalization UI**

```powershell
git add -- index.html control-panel.js control-panel.css themes.css themes.js tests/control-panel.test.js tests/themes.test.js
git commit -m "feat: add Personalization theme picker"
```

### Task 3: Profile persistence and desktop theme state

**Files:**
- Modify: `profile-store.js`
- Modify: `index.js`
- Modify: `tests/profile-store.test.js`
- Modify: `tests/shell-filesystem-persistence.test.js`

**Interfaces:**
- Consumes: theme IDs from `window.Windows7Themes`.
- Produces: normalized `settings.themeId`, `Windows7Engine.#currentThemeId`, and persisted capture/restore.

- [ ] **Step 1: Write failing normalization and round-trip tests**

```js
test("settings normalization preserves only approved theme identifiers", () => {
  assert.equal(normalizeProfileSettings({ themeId: "nature" }).themeId, "nature");
  assert.equal(normalizeProfileSettings({ themeId: "unknown" }).themeId, "windows-7");
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/profile-store.test.js tests/shell-filesystem-persistence.test.js`

Expected: FAIL because normalized settings do not contain `themeId`.

- [ ] **Step 3: Add validation, capture, and restore**

```js
const VALID_THEME_IDS = new Set([
  "windows-7", "architecture", "landscape", "nature",
  "windows-7-basic", "windows-classic", "high-contrast-black", "high-contrast-white"
]);

themeId: VALID_THEME_IDS.has(settings.themeId) ? settings.themeId : "windows-7"
```

Initialize `#currentThemeId`, restore it with normalized settings, and include it in captured settings.

- [ ] **Step 4: Run focused and full suites**

Run: `node --test tests/profile-store.test.js tests/shell-filesystem-persistence.test.js && npm test`

Expected: PASS.

- [ ] **Step 5: Commit persistence support**

```powershell
git add -- profile-store.js index.js tests/profile-store.test.js tests/shell-filesystem-persistence.test.js
git commit -m "feat: persist selected desktop theme"
```

### Task 4: Atomic shell application, exact palettes, and wait dialog

**Files:**
- Modify: `index.js`
- Modify: `desktop.css`
- Modify: `themes.js`
- Modify: `themes.css`
- Modify: `tests/themes.test.js`

**Interfaces:**
- Consumes: `ThemesApp` callbacks and preloaded `{ image, audio }` assets.
- Produces: `data-theme` root state, theme CSS variables, desktop context-menu route, wait overlay/dialog, and atomic theme commit.

- [ ] **Step 1: Add failing integration-contract tests**

```js
test("failed preloading preserves the active theme", async () => {
  let active = "windows-7";
  const controller = new ThemeSwitchController({
    preloadTheme: async () => { throw new Error("network"); },
    applyTheme: (theme) => { active = theme.id; },
    playSound: async () => {}, onBusyChange: () => {}, onError: () => {}
  });
  await controller.switchTo(THEMES[1]);
  assert.equal(active, "windows-7");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/themes.test.js`

Expected: FAIL until error cleanup and commit ordering satisfy the contract.

- [ ] **Step 3: Implement root theming and wait flow**

Set `data-theme` and variables only after preload success. Use a root-level overlay with `backdrop-filter: grayscale(1)` and a centered Aero dialog. Keep the old `backgroundImage` until commit. Apply exact Aero accent variables:

```css
#windows-7-root[data-theme="architecture"] { --theme-accent: #7EA1D5; }
#windows-7-root[data-theme="landscape"] { --theme-accent: #B2B6BB; }
#windows-7-root[data-theme="nature"] { --theme-accent: #B29ACC; }
```

Derive translucent gradients for windows, taskbar, and Start menu from the active accent. Add opaque Basic, `#3B6EA4`/`#D4D0C8` Classic, and exact black/white High Contrast rules. Route desktop `Personalize` to `#openControlPanel("themes")`.

- [ ] **Step 4: Run all automated and static checks**

Run: `npm test; node --check themes.js; node --check control-panel.js; node --check profile-store.js; node --check index.js; git diff --check`

Expected: all commands PASS.

- [ ] **Step 5: Commit shell theme application**

```powershell
git add -- index.js desktop.css themes.js themes.css tests/themes.test.js
git commit -m "feat: apply themes across the WebOS shell"
```

### Task 5: Browser verification and final corrections

**Files:**
- Modify: `index.html`
- Modify: `themes.js`
- Modify: `themes.css`
- Modify: `control-panel.js`
- Modify: `control-panel.css`
- Modify: `profile-store.js`
- Modify: `index.js`
- Modify: `desktop.css`
- Modify: `tests/themes.test.js`
- Modify: `tests/control-panel.test.js`
- Modify: `tests/profile-store.test.js`

**Interfaces:**
- Consumes: completed feature from Tasks 1-4.
- Produces: verified mouse, keyboard, loading, palette, persistence, and reduced-motion behavior.

- [ ] **Step 1: Start the local app and complete boot/login**

Run: `python -m http.server 8765 --bind 127.0.0.1`

Open `http://127.0.0.1:8765`, pass the startup gesture, and log in using the existing flow.

- [ ] **Step 2: Verify both launch paths and exact catalog**

Confirm desktop right-click Personalize and Control Panel Personalize open the same view; confirm two headings, eight cards, no additional categories/links, correct Back behavior, resize, maximize, and restore.

- [ ] **Step 3: Verify switching under normal, throttled, failure, and rapid-selection conditions**

Confirm the old desktop remains visible beneath grayscale and `Please Wait`; assets commit together; only the newest rapid request commits; failure preserves the prior theme and offers Close; focus returns to the card.

- [ ] **Step 4: Verify every palette and sound**

Capture screenshots for Windows 7 Aero, Basic, Classic, High Contrast Black, and High Contrast White. Inspect computed styles for Architecture `#7EA1D5`, Landscape `#B2B6BB`, and Nature `#B29ACC` across windows, taskbar, and Start menu. Confirm the three matching MP3s and Windows Logon sound mapping.

- [ ] **Step 5: Verify persistence, keyboard, reduced motion, and console**

Reload after selecting Nature; confirm it returns as active. Exercise Tab, arrows, Home/End, Enter/Space, failure-dialog Close, and reduced-motion emulation. Confirm no console errors or unhandled promise rejections.

- [ ] **Step 6: Reproduce each discovered bug with a failing test before correcting it**

Run the focused test to observe RED, patch the smallest production behavior, then rerun focused and full suites to GREEN.

- [ ] **Step 7: Run final verification**

Run: `npm test; node --check themes.js; node --check control-panel.js; node --check profile-store.js; node --check index.js; git diff --check`

Expected: all checks PASS and browser console remains clean.

- [ ] **Step 8: Commit final browser-backed corrections**

```powershell
git add -- index.html themes.js themes.css control-panel.js control-panel.css profile-store.js index.js desktop.css tests
git commit -m "fix: complete Themes browser verification"
```
