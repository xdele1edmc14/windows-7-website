# Local Profile Persistence Design

## Goal

Persist the Windows 7 web OS for the single local `xDele1ed` profile so a reload, simulated restart, shutdown, or logout preserves saved files, folders, nested subfolders, desktop shortcuts and positions, Recycle Bin contents, and durable settings.

## Scope

The profile is stored only in the current browser. It does not synchronize across browsers or devices and does not add account creation, authentication, cloud storage, import/export, or multi-user support.

Durable state includes:

- The complete writable filesystem hierarchy under Desktop, Documents, Downloads, Music, Pictures, and Videos.
- User-created folders at any supported nesting depth.
- Text, image, and uploaded file contents plus their names, MIME types, sizes, and timestamps.
- Recycle Bin contents and original-path metadata.
- Desktop item order, coordinates, shortcuts, icon size, auto-arrange, and align-to-grid settings.
- Wallpaper, volume, and taskbar pins.
- Future app preferences that explicitly use the profile settings namespace.

Transient session state is excluded. Open windows, window geometry, running applications, Chrome tabs, selection state, drag/drop state, clipboard state, and unsaved Notepad or Paint work start clean after a reload.

## Architecture

A new `profile-store.js` module owns browser persistence. It exposes pure snapshot-validation helpers for Node tests and a `LocalProfileStore` class for IndexedDB. The browser loads this script before `index.js`.

IndexedDB database `windows7-web-os` version 1 contains two object stores:

- `profiles` stores the versioned metadata snapshot under key `xDele1ed`.
- `fileContents` stores `Blob` or `File` payloads under stable filesystem node IDs.

`ShellFileSystem` remains the authority for filesystem behavior. It gains export and restore boundaries that convert the live object graph into durable plain records and reconstruct a valid graph. UI-only flags are reset during restore. The `/Desktop` and `/Recycle Bin` roots share their canonical children arrays with `desktopItems` and `recycleItems` after reconstruction.

`Windows7Engine` owns one persistence controller. Startup opens IndexedDB and attempts to restore the profile before the desktop is configured. Missing storage creates the existing factory filesystem. A simulated power cycle remounts from the current persisted profile instead of constructing a factory reset.

## Data Model

The profile snapshot has this shape:

```js
{
  schemaVersion: 1,
  profileId: "xDele1ed",
  savedAt: 0,
  sequence: 0,
  roots: [{ path: "/Desktop", node: {/* serialized node */} }],
  settings: {
    desktopIconSize: "medium",
    desktopAutoArrange: false,
    desktopAlignToGrid: true,
    wallpaper: "./assets/img0.png",
    volume: 100,
    pinnedItems: []
  }
}
```

Serialized nodes retain stable IDs, name, type, icon, hierarchy, parent information, permanence, shortcut target, desktop coordinates, and serializable metadata. They do not embed file bytes or UI flags. Date metadata is stored as ISO strings and restored as dates where current consumers require dates.

Each file-content record contains the node ID, content blob, file name, MIME type, and last-modified value. Stable IDs let metadata and payloads be committed and restored independently without relying on paths that can change during rename or move operations.

Pinned items are durable descriptors, not DOM references. App pins store the application name; filesystem pins store a node ID. Missing or deleted targets are skipped safely during restore.

## Save and Restore Flow

All filesystem mutations continue to emit events. The persistence controller subscribes to those events and schedules a save. Engine-owned durable settings use the same scheduler. Desktop coordinate changes, sorting, taskbar pin changes, wallpaper updates, and volume changes receive explicit durable-change notifications because they currently mutate fields directly.

The save queue coalesces rapid changes while guaranteeing that a newer snapshot cannot be overwritten by an older asynchronous write. A save captures current metadata and file payloads, validates the snapshot, and commits both object stores in one IndexedDB transaction. Removed file IDs are deleted from `fileContents` in the same transaction.

Saving occurs after completed semantic actions. Icon dragging saves on drop, filesystem operations save when their mutation completes, and continuously adjusted controls save after their value settles. Correctness does not depend on `beforeunload` or another browser-close event.

At startup, the store validates the schema and required fields before returning data. The engine restores files before rendering desktop icons and Explorer windows. App sessions remain closed.

## Failure Handling

IndexedDB transactions are atomic, so a failed write leaves the previous valid profile intact. The controller retains a dirty flag and retries on the next durable mutation. A storage failure is logged without discarding the working in-memory OS.

Missing data produces the factory profile. Invalid or unsupported profile data is rejected and logged, then the OS starts from factory state without overwriting the rejected record automatically. Individual missing file-content records restore as metadata-only files rather than preventing the rest of the profile from loading.

If IndexedDB is unavailable, the OS remains usable for the current session and reports persistence as unavailable in the console.

## Testing

Node tests cover snapshot validation, filesystem tree serialization and reconstruction, removal of transient UI fields, stable nested paths, Recycle Bin restoration, settings normalization, write coalescing, and failed-write retry behavior through an in-memory IndexedDB-style adapter.

Integration-oriented source tests verify that `index.html` loads `profile-store.js` before `index.js`, filesystem mutations connect to the persistence controller, direct desktop/settings mutations notify it, and simulated power cycling no longer resets durable state.

Browser QA verifies that a user can create nested folders, save text and image files, move shortcuts, change settings, reload, and observe the same durable state while no application windows or unsaved sessions reopen.
