# Aero Window Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the specified Windows 7 Aero 3D open and close animations to every shell window while delaying close cleanup until motion finishes.

**Architecture:** A small browser/CommonJS lifecycle module owns open/close class management, `animationend` handling, reduced-motion behavior, and timer fallbacks. The shell continues to own window state, application cleanup, taskbar state, and DOM removal; it calls the helper at every true window opening and awaits it before final close cleanup. Shared CSS defines the exact motion contract and places `perspective: 1000px` on the desktop.

**Tech Stack:** Vanilla JavaScript, CSS keyframes, Node.js built-in test runner, browser DOM APIs.

## Global Constraints

- Desktop perspective is exactly `1000px`.
- `aeroClose` is exactly `180ms cubic-bezier(0.1, 0.85, 0.25, 1)` from `scale(1) translateZ(0px) rotateX(0deg)` to `scale(0.9) translateZ(-50px) rotateX(2deg)` with centered transform origin.
- `aeroOpen` is exactly `200ms cubic-bezier(0.05, 0.9, 0.1, 1)` from `scale(0.88) translateZ(-60px) rotateX(-2deg)` to `scale(1) translateZ(0px) rotateX(0deg)`.
- Closing adds `.closing` immediately and does not hide or remove the window until `animationend` or the 180ms fallback.
- Existing minimize and restore motion remains separate.
- Reduced motion preserves lifecycle semantics without decorative 3D movement.

---

### Task 1: Window motion lifecycle helper

**Files:**
- Create: `aero-window-motion.js`
- Test: `tests/aero-window-motion.test.js`

**Interfaces:**
- Produces: `openAeroWindow(element, options?)` and `closeAeroWindow(element, options?)`, exposed as `Windows7AeroWindowMotion` in browsers and CommonJS exports in tests.

- [ ] Write tests proving open class cleanup, close delay, `animationend` filtering, timer fallback, duplicate-close safety, and reduced-motion completion.
- [ ] Run `node --test tests/aero-window-motion.test.js` and confirm failure because the helper does not exist.
- [ ] Implement the smallest event-and-timer lifecycle helper that passes the tests.
- [ ] Run `node --test tests/aero-window-motion.test.js` and confirm all tests pass.

### Task 2: Shared CSS motion contract

**Files:**
- Modify: `desktop.css`
- Test: `tests/aero-window-motion.test.js`

**Interfaces:**
- Consumes: `.opening` and `.closing` classes from Task 1.
- Produces: the `aeroOpen` and `aeroClose` keyframes and desktop perspective.

- [ ] Add source-level assertions for the exact perspective, keyframes, durations, easing curves, transform origin, pointer blocking, and reduced-motion override.
- [ ] Run the targeted test and confirm the new CSS assertions fail.
- [ ] Add the exact shared CSS contract.
- [ ] Run the targeted test and confirm it passes.

### Task 3: Shell lifecycle integration

**Files:**
- Modify: `index.html`
- Modify: `index.js`
- Test: `tests/aero-window-motion.test.js`

**Interfaces:**
- Consumes: `window.Windows7AeroWindowMotion.openAeroWindow` and `closeAeroWindow`.
- Produces: animated built-in app, Explorer, properties-dialog, and theme-dialog opening, plus delayed shared close cleanup.

- [ ] Add source-level integration assertions for script order and every true-open site.
- [ ] Run the targeted test and confirm integration assertions fail.
- [ ] Load the helper before `index.js`, call the opener at every true-open site, and make shared close cleanup wait for the close helper.
- [ ] Run the targeted and full test suites.

### Task 4: Final verification

**Files:**
- Verify all touched files.

- [ ] Run `npm test`.
- [ ] Run `node --check aero-window-motion.js` and `node --check index.js`.
- [ ] Run `git diff --check`.
- [ ] Exercise open and close in a real browser, inspect the computed animation names/durations/timing functions and desktop perspective, and confirm the window remains present during close before becoming hidden or removed.
- [ ] Repeat with reduced motion enabled and confirm lifecycle completion without 3D movement.
