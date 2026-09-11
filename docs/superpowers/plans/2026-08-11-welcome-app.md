# Welcome.exe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shell-integrated, three-step Windows 7 Welcome.exe app using only vanilla JavaScript and CSS.

**Architecture:** A UMD-style `WelcomeApp` class programmatically constructs the fixed-size window and owns state, persistence, focus, and launch events. The host engine exposes custom-event bridges for opening and closing registered windows while retaining all existing window-manager behavior.

**Tech Stack:** ES6+ JavaScript, DOM APIs, CSS3, 7.css, Node test runner, localStorage.

## Global Constraints

- Do not use React, Tailwind, Framer Motion, or another frontend framework.
- Keep the default modal footprint at 540px by approximately 340px.
- Persist startup suppression under `localStorage.hideWelcome`.
- Preserve all unrelated working-tree changes.

---

### Task 1: WelcomeApp state and DOM behavior

**Files:**
- Create: `tests/welcome-app.test.js`
- Create: `welcome.js`

**Interfaces:**
- Produces: `new WelcomeApp({ mount, storage, onLaunchApp })`, `open()`, `close()`, `goToStep(step)`, `currentStep`, and browser API `window.Windows7Welcome`.

- [ ] Write tests that instantiate the real class with a small DOM fixture and assert step navigation, boundaries, storage writes, startup suppression, close requests, and launch callback/event details.
- [ ] Run `node --test tests/welcome-app.test.js` and confirm failure because `welcome.js` is absent.
- [ ] Implement the class, complete DOM construction, three screen renderers, native listeners, localStorage access, focus behavior, and custom events.
- [ ] Run `node --test tests/welcome-app.test.js` and confirm all WelcomeApp tests pass.

### Task 2: Shell bridge and boot registration

**Files:**
- Modify: `index.js`
- Modify: `index.html`
- Modify: `tests/welcome-app.test.js`

**Interfaces:**
- Consumes: `windows7:openapp` and `windows7:closeapp` events with `{ appName }`.
- Produces: automatic `WelcomeApp` construction before `Windows7Engine` starts.

- [ ] Add failing integration assertions that startup assets load Welcome.exe before `index.js` and that host events route through the actual window manager.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Add the two event listeners to the existing manager and add the new stylesheet/script tags in dependency order.
- [ ] Run the focused tests and the full `npm.cmd test` suite.

### Task 3: Aero presentation and browser verification

**Files:**
- Create: `welcome.css`
- Modify: `tests/welcome-app.test.js`

**Interfaces:**
- Consumes: WelcomeApp class names and host theme variables.
- Produces: fixed-size Aero frame, inset body, aura animation, step transitions, card/button states, responsive rules, reduced-motion and high-contrast fallbacks.

- [ ] Add failing structural assertions for required accessibility and animation hooks.
- [ ] Run the focused test and confirm failure.
- [ ] Implement the stylesheet without changing `desktop.css`.
- [ ] Run focused and full automated tests.
- [ ] Serve the site over HTTP and browser-check login, startup opening, steps, cards, minimize/restore, persistence, keyboard behavior, viewport clamping, visual fidelity, and console output.
