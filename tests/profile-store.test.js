const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PROFILE_SCHEMA_VERSION,
  normalizeProfileSettings,
  captureProfile,
  restoreProfile,
  ProfilePersistenceController
} = require("../profile-store.js");

const createNode = (overrides = {}) => ({
  id: "node-1",
  name: "Item",
  type: "folder",
  icon: null,
  children: [],
  parentPath: "/Desktop",
  parentId: null,
  permanent: false,
  targetPath: null,
  meta: {},
  file: null,
  x: 10,
  y: 10,
  isSelected: true,
  isDropTarget: true,
  ...overrides
});

const createRoots = () => {
  const note = createNode({
    id: "note-1",
    name: "remember-me.txt",
    type: "file",
    parentPath: "/Desktop/Persistence Test/Nested",
    meta: {
      mimeType: "text/plain",
      createdAt: new Date("2026-08-08T10:00:00.000Z"),
      modifiedAt: new Date("2026-08-08T11:00:00.000Z")
    },
    file: new File(["remember me"], "remember-me.txt", {
      type: "text/plain",
      lastModified: 123
    }),
    x: 42,
    y: 96
  });
  const nested = createNode({
    id: "nested-1",
    name: "Nested",
    parentPath: "/Desktop/Persistence Test",
    parentId: "folder-1",
    children: [note]
  });
  const folder = createNode({
    id: "folder-1",
    name: "Persistence Test",
    parentPath: "/Desktop",
    children: [nested]
  });
  const desktop = createNode({
    id: "root-desktop",
    name: "Desktop",
    permanent: true,
    parentPath: null,
    children: [folder]
  });
  const trashed = createNode({
    id: "trash-1",
    name: "old.txt",
    type: "file",
    parentPath: "/Recycle Bin",
    meta: {
      originalPath: "/Documents/old.txt",
      deletedAt: new Date("2026-08-08T12:00:00.000Z")
    },
    file: new File(["old"], "old.txt", { type: "text/plain", lastModified: 456 })
  });
  const recycle = createNode({
    id: "root-recycle-bin",
    name: "Recycle Bin",
    permanent: true,
    parentPath: null,
    children: [trashed]
  });
  return new Map([
    ["/Desktop", desktop],
    ["/Recycle Bin", recycle]
  ]);
};

test("capture separates file bytes and strips transient UI state", async () => {
  const captured = captureProfile({
    profileId: "xDele1ed",
    sequence: 12,
    roots: createRoots(),
    settings: { volume: 42, desktopIconSize: "large" },
    now: () => 1234
  });

  const nestedFile = captured.snapshot.roots[0].node.children[0].children[0].children[0];
  assert.equal(captured.snapshot.schemaVersion, PROFILE_SCHEMA_VERSION);
  assert.equal(captured.snapshot.savedAt, 1234);
  assert.equal(captured.snapshot.sequence, 12);
  assert.equal(nestedFile.id, "note-1");
  assert.equal("file" in nestedFile, false);
  assert.equal("isSelected" in nestedFile, false);
  assert.equal("isDropTarget" in nestedFile, false);
  assert.deepEqual(captured.fileContents.map(({ nodeId }) => nodeId).sort(), ["note-1", "trash-1"]);
  assert.equal(await captured.fileContents[0].content.text(), "remember me");
  assert.equal(captured.snapshot.settings.volume, 42);
  assert.equal(captured.snapshot.settings.desktopIconSize, "large");
});

test("restore rebuilds canonical desktop and recycle arrays with file contents", async () => {
  const captured = captureProfile({
    profileId: "xDele1ed",
    sequence: 18,
    roots: createRoots(),
    settings: {
      desktopAutoArrange: true,
      desktopAlignToGrid: false,
      wallpaper: "blob:wallpaper",
      themeId: "nature",
      volume: 17,
      pinnedItems: [{ type: "app", appName: "notepad" }, { type: "node", nodeId: "note-1" }]
    }
  });

  const restored = restoreProfile(captured);
  const desktop = restored.roots.get("/Desktop");
  const recycle = restored.roots.get("/Recycle Bin");
  const note = desktop.children[0].children[0].children[0];

  assert.equal(restored.sequence, 18);
  assert.equal(restored.desktopItems, desktop.children);
  assert.equal(restored.recycleItems, recycle.children);
  assert.equal(note.isSelected, false);
  assert.equal(note.isDropTarget, false);
  assert.equal(note.file.name, "remember-me.txt");
  assert.equal(await note.file.text(), "remember me");
  assert.equal(note.meta.createdAt instanceof Date, true);
  assert.equal(restored.settings.themeId, "nature");
  assert.deepEqual(restored.settings.pinnedItems, [
    { type: "app", appName: "notepad" },
    { type: "node", nodeId: "note-1" }
  ]);
});

test("restore rejects snapshots for another profile or schema", () => {
  const captured = captureProfile({
    profileId: "xDele1ed",
    sequence: 1,
    roots: createRoots(),
    settings: {}
  });

  assert.throws(
    () => restoreProfile({ ...captured, snapshot: { ...captured.snapshot, profileId: "someone-else" } }),
    /profile/i
  );
  assert.throws(
    () => restoreProfile({ ...captured, snapshot: { ...captured.snapshot, schemaVersion: 99 } }),
    /schema/i
  );
  assert.throws(
    () => restoreProfile({ ...captured, snapshot: { ...captured.snapshot, roots: [] } }),
    /roots/i
  );
});

test("settings normalization clamps invalid values to safe defaults", () => {
  assert.deepEqual(
    normalizeProfileSettings({
      desktopIconSize: "enormous",
      desktopAutoArrange: 1,
      desktopAlignToGrid: 0,
      wallpaper: "",
      volume: 500,
      pinnedItems: [
        { type: "app", appName: "paint" },
        { type: "node", nodeId: "file-1" },
        { type: "node", nodeId: "" },
        { type: "unknown", value: "bad" }
      ]
    }),
    {
      desktopIconSize: "medium",
      desktopAutoArrange: true,
      desktopAlignToGrid: false,
      wallpaper: "./assets/img0.png",
      themeId: "windows-7",
      volume: 100,
      pinnedItems: [
        { type: "app", appName: "paint" },
        { type: "node", nodeId: "file-1" }
      ],
      apps: {}
    }
  );
});

test("settings normalization preserves approved themes and rejects unknown identifiers", () => {
  assert.equal(normalizeProfileSettings({ themeId: "architecture" }).themeId, "architecture");
  assert.equal(normalizeProfileSettings({ themeId: "nature" }).themeId, "nature");
  assert.equal(normalizeProfileSettings({ themeId: "unknown" }).themeId, "windows-7");
  assert.equal(normalizeProfileSettings({}).themeId, "windows-7");
});

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

test("save controller writes a newer generation after an active save", async () => {
  const firstWrite = deferred();
  const savedValues = [];
  let capturedValue = 0;
  const store = {
    save: async (_profileId, snapshot) => {
      savedValues.push(snapshot.value);
      if (savedValues.length === 1) await firstWrite.promise;
    }
  };
  const controller = new ProfilePersistenceController({
    profileId: "xDele1ed",
    store,
    capture: () => ({ snapshot: { value: capturedValue }, fileContents: [] }),
    delay: 60_000
  });

  capturedValue = 1;
  controller.schedule();
  const flushing = controller.flush();
  capturedValue = 2;
  controller.schedule();
  firstWrite.resolve();
  await flushing;

  assert.deepEqual(savedValues, [1, 2]);
  assert.equal(controller.isDirty, false);
});

test("save controller retains dirty state after failure and retries on the next change", async () => {
  const errors = [];
  let attempts = 0;
  const controller = new ProfilePersistenceController({
    profileId: "xDele1ed",
    store: {
      save: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("quota exceeded");
      }
    },
    capture: () => ({ snapshot: { value: attempts }, fileContents: [] }),
    onError: (error) => errors.push(error.message),
    delay: 60_000
  });

  controller.schedule();
  await controller.flush();
  assert.equal(controller.isDirty, true);
  assert.deepEqual(errors, ["quota exceeded"]);

  controller.schedule();
  await controller.flush();
  assert.equal(attempts, 2);
  assert.equal(controller.isDirty, false);
});
