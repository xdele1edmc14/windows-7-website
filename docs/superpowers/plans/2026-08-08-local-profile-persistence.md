# Local Profile Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the complete durable state of the single local `xDele1ed` Windows profile in IndexedDB across reloads and simulated power cycles.

**Architecture:** Add a focused `profile-store.js` module that serializes filesystem metadata separately from file blobs, validates versioned snapshots, performs atomic IndexedDB transactions, and serializes asynchronous saves. `ShellFileSystem` exposes snapshot boundaries while `Windows7Engine` loads the profile before rendering and sends all durable filesystem and settings mutations through one save coordinator.

**Tech Stack:** Vanilla JavaScript, IndexedDB, structured-clone `Blob`/`File` values, Node's built-in test runner, existing HTML/CSS Windows 7 shell.

## Global Constraints

- Support exactly one local profile with ID `xDele1ed`.
- Persist only in the current browser; add no server, authentication, synchronization, or account UI.
- Persist saved files, folders, arbitrary supported subfolders, file contents, Recycle Bin, desktop layout/shortcuts, wallpaper, volume, icon preferences, and taskbar pins.
- Do not restore running apps, open windows, Chrome tabs, selections, clipboard state, or unsaved app sessions.
- Preserve all existing uncommitted application work and avoid unrelated refactors.
- A missing, invalid, unsupported, or unavailable database must not prevent the OS from booting.

---

### Task 1: Versioned Profile Storage Module

**Files:**
- Create: `profile-store.js`
- Create: `tests/profile-store.test.js`

**Interfaces:**
- Produces: `Windows7Profile.PROFILE_SCHEMA_VERSION`, `normalizeProfileSettings(settings)`, `captureProfile({ profileId, sequence, roots, settings, now })`, `restoreProfile({ snapshot, fileContents, FileCtor })`, `LocalProfileStore`, and `ProfilePersistenceController`.
- `captureProfile` returns `{ snapshot, fileContents }`, where `snapshot.roots` contains serialized nodes without file bytes and `fileContents` is an array keyed by `nodeId`.
- `LocalProfileStore.load(profileId)` returns `null` or `{ snapshot, fileContents }`; `save(profileId, snapshot, fileContents)` commits both stores atomically.

- [ ] **Step 1: Write failing serialization and validation tests**

Create fixtures with a `/Desktop` root, a nested folder, a text `File`/`Blob`, Recycle Bin metadata, dates, desktop coordinates, and transient selection flags. Assert that:

```js
const captured = captureProfile({
  profileId: "xDele1ed",
  sequence: 12,
  roots,
  settings: { volume: 42, desktopIconSize: "large" },
  now: () => 1234
});

assert.equal(captured.snapshot.schemaVersion, 1);
assert.equal(captured.snapshot.savedAt, 1234);
assert.equal(captured.fileContents[0].nodeId, "note-1");
assert.equal("file" in captured.snapshot.roots[0].node.children[0], false);
assert.equal("isSelected" in captured.snapshot.roots[0].node.children[0], false);
assert.equal(captured.snapshot.settings.volume, 42);
```

Also assert rejection of the wrong schema version, malformed roots, and an incorrect profile ID.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `node --test tests/profile-store.test.js`

Expected: FAIL because `profile-store.js` does not exist.

- [ ] **Step 3: Implement snapshot capture, restore, and settings normalization**

Use recursive node conversion with an explicit durable field allowlist:

```js
const serializeNode = (node, fileContents) => {
  if (node.file) fileContents.push(toFileRecord(node));
  return {
    id: String(node.id),
    name: String(node.name),
    type: String(node.type),
    icon: node.icon ?? null,
    children: (node.children ?? []).map((child) => serializeNode(child, fileContents)),
    parentPath: node.parentPath ?? null,
    parentId: node.parentId ?? null,
    permanent: Boolean(node.permanent),
    targetPath: node.targetPath ?? null,
    meta: serializeMetadata(node.meta ?? {}),
    x: finiteNumber(node.x, 10),
    y: finiteNumber(node.y, 10)
  };
};
```

Restore fresh `isSelected: false` and `isDropTarget: false` flags. Rebuild file objects from content records and normalize icon size, booleans, wallpaper, volume, and pin descriptors to safe defaults.

- [ ] **Step 4: Add failing save-coordinator tests**

Use a fake store whose `save` returns controlled promises. Assert that two changes during an active write produce a second write after the first resolves, an older completion cannot clear a newer dirty generation, and a rejected write is retried only after the next `schedule()` call.

- [ ] **Step 5: Implement `ProfilePersistenceController`**

Track a monotonically increasing generation, one debounce timer, one active save promise, and the last successfully saved generation. `schedule()` increments the generation; `flush()` captures state only when no save is active; a successful write immediately flushes a newer generation; a failed write reports through `onError` and waits for the next schedule.

- [ ] **Step 6: Add IndexedDB adapter tests with a fake request/transaction boundary**

Verify database version and store names, `load` returning `null` for no profile, and `save` invoking one transaction containing both `profiles` and `fileContents`.

- [ ] **Step 7: Implement `LocalProfileStore` and browser/CommonJS exports**

Create database `windows7-web-os` version 1 and stores `profiles` with key path `profileId` and `fileContents` with key path `nodeId`. Since version 1 supports one profile, `save` clears stale file records and writes the complete current set in the same read-write transaction. Register the browser API on `window.Windows7Profile` and export the same symbols through `module.exports` for Node tests.

- [ ] **Step 8: Run focused tests and confirm GREEN**

Run: `node --test tests/profile-store.test.js`

Expected: all profile-store tests pass.

---

### Task 2: Restore the Filesystem and Settings Before Desktop Render

**Files:**
- Modify: `index.html:13-18`
- Modify: `index.js:287-713`
- Modify: `index.js:715-847`
- Modify: `tests/profile-store.test.js`

**Interfaces:**
- Consumes: `captureProfile`, `restoreProfile`, `normalizeProfileSettings`, `LocalProfileStore`, and `ProfilePersistenceController` from Task 1.
- Produces: `ShellFileSystem.fromProfile(data)`, `ShellFileSystem#captureProfile(settings)`, `ShellFileSystem#findById(id)`, `Windows7Engine#initializeLocalProfile()`, and `Windows7Engine#scheduleProfileSave()`.

- [ ] **Step 1: Write failing source-integration tests**

Read `index.html` and `index.js` as text. Assert that `profile-store.js` appears before `index.js`, startup awaits `#initializeLocalProfile()` before `#configureDesktop()`, and `ShellFileSystem` contains the three public profile boundary methods.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `node --test tests/profile-store.test.js`

Expected: FAIL on the missing script and integration methods.

- [ ] **Step 3: Load the persistence module before the engine**

Add:

```html
<script src="./profile-store.js?v=20260808-1" defer></script>
```

immediately before the `index.js` script.

- [ ] **Step 4: Add filesystem snapshot boundaries**

Implement:

```js
static fromProfile(data) {
  const fileSystem = new ShellFileSystem();
  const restored = window.Windows7Profile.restoreProfile(data);
  fileSystem.#sequence = restored.sequence;
  fileSystem.roots = restored.roots;
  fileSystem.desktopItems = restored.roots.get("/Desktop").children;
  fileSystem.recycleItems = restored.roots.get("/Recycle Bin").children;
  return fileSystem;
}

captureProfile(settings) {
  return window.Windows7Profile.captureProfile({
    profileId: USERNAME,
    sequence: this.#sequence,
    roots: this.roots,
    settings
  });
}
```

`findById` must traverse canonical roots once and return the first matching node.

- [ ] **Step 5: Initialize the store before desktop configuration**

Add engine fields for the store, controller, loaded settings, and pending pins. `start()` awaits initialization before calling desktop configuration. Initialization catches all storage/validation failures, logs a warning, retains factory state, and still constructs a disabled-safe runtime.

- [ ] **Step 6: Apply restored durable settings**

Apply icon size, arrange/grid booleans, wallpaper, and volume to engine fields before `#configureDesktop()`. Store pins as descriptors until taskbar construction is complete. New profiles schedule their initial factory snapshot after configuration.

- [ ] **Step 7: Run focused and full tests**

Run: `node --test tests/profile-store.test.js`

Run: `npm test`

Expected: all tests pass.

---

### Task 3: Connect Every Durable Mutation and Preserve Power Cycles

**Files:**
- Modify: `index.js:872-965`
- Modify: `index.js:1875-1906`
- Modify: `index.js:2269-2335`
- Modify: `index.js:2910-3128`
- Modify: `index.js:4604-4685`
- Modify: `index.js:4973-5062`
- Modify: `index.js:5956-5979`
- Modify: `tests/profile-store.test.js`

**Interfaces:**
- Consumes: `Windows7Engine#scheduleProfileSave()` and `ShellFileSystem#findById(id)` from Task 2.
- Produces: durable change coverage for filesystem events, layout, settings, wallpaper, volume, pins, and simulated restarts.

- [ ] **Step 1: Write failing mutation-wiring tests**

Assert the source connects filesystem events to `#scheduleProfileSave`, calls the same method after direct desktop coordinate/settings/wallpaper/volume/pin mutations, and no longer assigns `new ShellFileSystem()` or durable default settings inside `#mountCleanDesktop()`.

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/profile-store.test.js`

Expected: FAIL on mutation wiring and clean-mount reset assertions.

- [ ] **Step 3: Save filesystem and desktop layout mutations**

Extend the existing filesystem subscription to schedule persistence after create, update, rename, move, copy, trash, and empty operations. Emit a filesystem `layout` mutation after desktop drops and sorting so coordinate/order changes use the same path.

- [ ] **Step 4: Save settings and wallpaper changes**

Call `#scheduleProfileSave()` after icon size, auto-arrange, align-to-grid, wallpaper, and volume changes. Debouncing in the controller keeps pointer and wheel input efficient.

- [ ] **Step 5: Capture and restore taskbar pins**

Serialize current pins as `{ type: "app", appName }` or `{ type: "node", nodeId }`. After taskbar configuration, resolve app descriptors from `APP_SHORTCUTS` and node descriptors through `findById`, then call the existing `#pinShellItem`. Skip unresolved pins without failing startup. A newly added pin schedules persistence.

- [ ] **Step 6: Preserve durable state through simulated power cycles**

Before tearing down the desktop, capture pending pin descriptors. During `#mountCleanDesktop`, reset only transient window, selection, drag, clipboard, and timer fields. Keep the loaded filesystem and durable settings intact, rebuild the UI, and restore pins after taskbar setup.

- [ ] **Step 7: Run focused and full tests**

Run: `node --test tests/profile-store.test.js`

Run: `npm test`

Expected: all tests pass.

---

### Task 4: Static and Browser Persistence Verification

**Files:**
- Modify only if verification reveals a persistence defect: `profile-store.js`, `index.js`, `index.html`, or `tests/profile-store.test.js`

**Interfaces:**
- Consumes: the completed local profile persistence feature.
- Produces: repeatable automated and visible evidence that durable state restores while session state does not.

- [ ] **Step 1: Run static verification**

Run:

```powershell
node --check profile-store.js
node --check index.js
npm test
git diff --check
```

Expected: syntax checks succeed, all tests pass, and the diff check reports no errors.

- [ ] **Step 2: Perform browser setup actions**

Open the local OS, log in, create `/Desktop/Persistence Test/Nested`, save `remember-me.txt` inside the supported filesystem, create or save an image, move a desktop shortcut, change icon size, wallpaper, volume, and add a taskbar pin.

- [ ] **Step 3: Reload and verify restoration**

Reload the page and log in again. Confirm the nested hierarchy, file contents, image, desktop coordinates, settings, Recycle Bin state, and pin match the previous state. Confirm no application window or unsaved editor session reopens.

- [ ] **Step 4: Verify simulated restart**

Use the Start menu Restart action, return through boot/login, and confirm the same durable state remains while the working session is clean.

- [ ] **Step 5: Re-run automated verification after any browser-found correction**

Run the commands from Step 1 again and require the same successful results.
