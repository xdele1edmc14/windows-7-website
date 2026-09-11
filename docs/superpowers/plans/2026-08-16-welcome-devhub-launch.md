# Welcome Server Development Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Welcome.exe Server Development shortcut open DevHub and close Welcome.exe through the existing shell lifecycle.

**Architecture:** Keep WelcomeApp decoupled from the shell engine by using its existing `windows7:openapp` and `windows7:closeapp` event bridge. Change the shortcut's canonical destination from the obsolete `ServerDev` identifier to `devhub`, dispatch the open request synchronously, then request the Welcome window close while preserving the compatibility callback and `welcome:launchapp` event.

**Tech Stack:** Vanilla JavaScript, custom DOM events, Node.js built-in test runner.

## Global Constraints

- Do not change the Welcome.exe layout or styling.
- Preserve native button mouse, Enter, and Space activation.
- Open DevHub before requesting the Welcome.exe close.
- Keep all work uncommitted unless the user explicitly asks for a commit.

---

### Task 1: Route Server Development to DevHub

**Files:**
- Modify: `tests/welcome-app.test.js`
- Modify: `welcome.js`
- Modify: `docs/superpowers/specs/2026-08-11-welcome-app-design.md`

**Interfaces:**
- Consumes: `bindWelcomeHostBridge(root, { openApp, closeApp })` and WelcomeApp's `windows7:openapp` / `windows7:closeapp` event contract.
- Produces: A Server Development button with `data-welcome-launch="devhub"` that emits open `devhub`, then close `welcome`, and reports `devhub` through the existing callback and compatibility event.

- [x] **Step 1: Write the failing behavior test**

```javascript
test("Server Development opens DevHub before closing Welcome.exe", () => {
  const lifecycle = [];
  const callbackApps = [];
  const { app, mount, shell } = createFixture({}, {
    onLaunchApp: (appName) => callbackApps.push(appName)
  });
  shell.addEventListener("windows7:openapp", (event) => lifecycle.push(`open:${event.detail.appName}`));
  shell.addEventListener("windows7:closeapp", (event) => lifecycle.push(`close:${event.detail.appName}`));

  app.goToStep(3);
  mount.querySelector('[data-welcome-launch="devhub"]').click();

  assert.deepEqual(lifecycle, ["open:devhub", "close:welcome"]);
  assert.deepEqual(callbackApps, ["devhub"]);
});
```

- [x] **Step 2: Run the focused test and confirm RED**

Run: `node --test --test-name-pattern="Server Development" tests/welcome-app.test.js`

Expected: FAIL because no `data-welcome-launch="devhub"` element exists and WelcomeApp does not request the destination through `windows7:openapp`.

- [x] **Step 3: Implement the minimal shell-mediated launch**

In `welcome.js`, configure the Server Development shortcut with `appName: "devhub"`. Update `#launchApp(appName)` to call `#dispatchShellEvent("windows7:openapp", appName)` before `this.close()`, then preserve `#onLaunchApp(appName)` and `welcome:launchapp`. Update `#dispatchShellEvent(type, appName = "welcome")` so the event detail uses the supplied canonical identifier.

- [x] **Step 4: Run focused and full verification**

Run:

```powershell
node --test tests/welcome-app.test.js
node --check welcome.js
npm.cmd test
git diff --check
```

Expected: All commands exit successfully with zero failing tests.
