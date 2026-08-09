const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Windows7AeroWindowMotion = require("../aero-window-motion.js");
const Windows7Profile = require("../profile-store.js");

const loadShellApi = () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");
  const sandbox = {
    window: { Windows7AeroWindowMotion, Windows7Profile },
    document: { getElementById: () => null },
    console,
    performance,
    AbortController,
    Blob,
    File,
    Map,
    Set,
    Date,
    Intl,
    URL,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout
  };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.Windows7Shell;
};

test("ShellFileSystem restores nested files, recycle contents, and stable IDs", async () => {
  const { ShellFileSystem } = loadShellApi();
  const fileSystem = new ShellFileSystem();
  const folder = fileSystem.create("/Desktop", "folder", "Persistence Test", { x: 84, y: 126 });
  const nested = fileSystem.create("/Desktop/Persistence Test", "folder", "Nested");
  const note = fileSystem.create("/Desktop/Persistence Test/Nested", "file", "remember.txt", {
    file: new File(["still here"], "remember.txt", { type: "text/plain", lastModified: 99 }),
    meta: { mimeType: "text/plain", modifiedAt: new Date("2026-08-08T13:00:00.000Z") }
  });
  const deleted = fileSystem.create("/Documents", "file", "deleted.txt", {
    file: new File(["recyclable"], "deleted.txt", { type: "text/plain" })
  });
  fileSystem.trash([deleted]);

  const captured = fileSystem.captureProfile({
    desktopIconSize: "small",
    desktopAutoArrange: true,
    desktopAlignToGrid: false,
    wallpaper: "blob:restored-wallpaper",
    volume: 28,
    pinnedItems: [{ type: "node", nodeId: note.id }]
  });
  const restored = ShellFileSystem.fromProfile(captured);
  const restoredNote = restored.resolve("/Desktop/Persistence Test/Nested/remember.txt");

  assert.equal(restored.findById(folder.id).name, "Persistence Test");
  assert.equal(restored.findById(nested.id).parentId, folder.id);
  assert.equal(restored.findById(note.id), restoredNote);
  assert.equal(await restoredNote.file.text(), "still here");
  assert.equal(restored.recycleItems.length, 1);
  assert.equal(restored.recycleItems[0].meta.originalPath, "/Documents/deleted.txt");
  assert.equal(restored.desktopItems, restored.roots.get("/Desktop").children);
  assert.equal(restored.recycleItems, restored.roots.get("/Recycle Bin").children);
});

test("restored filesystem continues allocating IDs after the saved sequence", () => {
  const { ShellFileSystem } = loadShellApi();
  const fileSystem = new ShellFileSystem();
  fileSystem.create("/Documents", "folder", "Before Save");
  const restored = ShellFileSystem.fromProfile(fileSystem.captureProfile({}));
  const afterRestore = restored.create("/Documents", "folder", "After Restore");

  const numericId = Number(afterRestore.id.replace("fs-item-", ""));
  assert.equal(Number.isInteger(numericId), true);
  assert.equal(numericId > 0, true);
  assert.notEqual(afterRestore.id, restored.resolve("/Documents/Before Save").id);
});
