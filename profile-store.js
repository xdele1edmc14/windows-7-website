(function registerWindows7Profile(globalObject) {
  "use strict";

  const PROFILE_SCHEMA_VERSION = 1;
  const DEFAULT_PROFILE_ID = "xDele1ed";
  const DEFAULT_WALLPAPER = "./assets/img0.png";
  const DATABASE_NAME = "windows7-web-os";
  const DATABASE_VERSION = 1;
  const PROFILE_STORE = "profiles";
  const FILE_STORE = "fileContents";
  const DATE_MARKER = "__windows7ProfileDate";

  const finiteNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  const cloneMetadataForStorage = (value) => {
    if (value instanceof Date) return { [DATE_MARKER]: value.toISOString() };
    if (Array.isArray(value)) return value.map(cloneMetadataForStorage);
    if (!value || typeof value !== "object") return value;

    const copy = {};
    Object.entries(value).forEach(([key, entry]) => {
      if (typeof entry !== "function" && typeof entry !== "undefined") {
        copy[key] = cloneMetadataForStorage(entry);
      }
    });
    return copy;
  };

  const restoreMetadata = (value) => {
    if (Array.isArray(value)) return value.map(restoreMetadata);
    if (!value || typeof value !== "object") return value;
    if (Object.keys(value).length === 1 && typeof value[DATE_MARKER] === "string") {
      const restored = new Date(value[DATE_MARKER]);
      return Number.isNaN(restored.getTime()) ? null : restored;
    }

    const copy = {};
    Object.entries(value).forEach(([key, entry]) => {
      copy[key] = restoreMetadata(entry);
    });
    return copy;
  };

  const normalizePinnedItems = (items) => {
    if (!Array.isArray(items)) return [];
    return items.flatMap((item) => {
      if (item?.type === "app" && typeof item.appName === "string" && item.appName.trim()) {
        return [{ type: "app", appName: item.appName.trim() }];
      }
      if (item?.type === "node" && typeof item.nodeId === "string" && item.nodeId.trim()) {
        return [{ type: "node", nodeId: item.nodeId.trim() }];
      }
      return [];
    });
  };

  const normalizeProfileSettings = (settings = {}) => ({
    desktopIconSize: ["large", "medium", "small"].includes(settings.desktopIconSize)
      ? settings.desktopIconSize
      : "medium",
    desktopAutoArrange: Boolean(settings.desktopAutoArrange),
    desktopAlignToGrid: settings.desktopAlignToGrid === undefined
      ? true
      : Boolean(settings.desktopAlignToGrid),
    wallpaper: typeof settings.wallpaper === "string" && settings.wallpaper.trim()
      ? settings.wallpaper
      : DEFAULT_WALLPAPER,
    volume: clamp(Math.round(finiteNumber(settings.volume, 100)), 0, 100),
    pinnedItems: normalizePinnedItems(settings.pinnedItems),
    apps: settings.apps && typeof settings.apps === "object" && !Array.isArray(settings.apps)
      ? cloneMetadataForStorage(settings.apps)
      : {}
  });

  const toFileRecord = (node) => ({
    nodeId: String(node.id),
    name: String(node.file?.name || node.name),
    type: String(node.file?.type || node.meta?.mimeType || "application/octet-stream"),
    lastModified: finiteNumber(node.file?.lastModified, Date.now()),
    content: node.file
  });

  const serializeNode = (node, fileContents) => {
    if (!node || typeof node !== "object") throw new TypeError("Filesystem nodes must be objects.");
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
      meta: cloneMetadataForStorage(node.meta ?? {}),
      x: finiteNumber(node.x, 10),
      y: finiteNumber(node.y, 10)
    };
  };

  const captureProfile = ({
    profileId = DEFAULT_PROFILE_ID,
    sequence = 0,
    roots,
    settings = {},
    now = Date.now
  }) => {
    if (profileId !== DEFAULT_PROFILE_ID) throw new TypeError("Unsupported local profile ID.");
    if (!(roots instanceof Map) || roots.size === 0) throw new TypeError("Profile roots must be a non-empty Map.");

    const fileContents = [];
    const serializedRoots = [...roots.entries()].map(([path, node]) => ({
      path: String(path),
      node: serializeNode(node, fileContents)
    }));
    const rootPaths = new Set(serializedRoots.map(({ path }) => path));
    if (!rootPaths.has("/Desktop") || !rootPaths.has("/Recycle Bin")) {
      throw new TypeError("Profile roots must include Desktop and Recycle Bin.");
    }

    return {
      snapshot: {
        schemaVersion: PROFILE_SCHEMA_VERSION,
        profileId,
        savedAt: finiteNumber(now(), Date.now()),
        sequence: Math.max(0, Math.floor(finiteNumber(sequence, 0))),
        roots: serializedRoots,
        settings: normalizeProfileSettings(settings)
      },
      fileContents
    };
  };

  const validateSerializedNode = (node) => {
    if (!node || typeof node !== "object") throw new TypeError("Profile contains an invalid filesystem node.");
    if (typeof node.id !== "string" || !node.id) throw new TypeError("Profile node ID is invalid.");
    if (typeof node.name !== "string" || typeof node.type !== "string") {
      throw new TypeError("Profile node name or type is invalid.");
    }
    if (!Array.isArray(node.children)) throw new TypeError("Profile node children are invalid.");
    node.children.forEach(validateSerializedNode);
  };

  const validateProfileSnapshot = (snapshot) => {
    if (!snapshot || typeof snapshot !== "object") throw new TypeError("Profile snapshot is missing.");
    if (snapshot.schemaVersion !== PROFILE_SCHEMA_VERSION) {
      throw new TypeError(`Unsupported profile schema version: ${snapshot.schemaVersion}.`);
    }
    if (snapshot.profileId !== DEFAULT_PROFILE_ID) throw new TypeError("Profile ID does not match the local user.");
    if (!Array.isArray(snapshot.roots) || snapshot.roots.length === 0) {
      throw new TypeError("Profile roots are missing or invalid.");
    }

    const paths = new Set();
    snapshot.roots.forEach((root) => {
      if (!root || typeof root.path !== "string" || paths.has(root.path)) {
        throw new TypeError("Profile roots contain an invalid or duplicate path.");
      }
      paths.add(root.path);
      validateSerializedNode(root.node);
    });
    if (!paths.has("/Desktop") || !paths.has("/Recycle Bin")) {
      throw new TypeError("Profile roots must include Desktop and Recycle Bin.");
    }
    return snapshot;
  };

  const createFile = (record, FileCtor) => {
    if (!record?.content) return null;
    if (typeof FileCtor === "function") {
      return new FileCtor([record.content], record.name, {
        type: record.type,
        lastModified: finiteNumber(record.lastModified, Date.now())
      });
    }
    return record.content;
  };

  const restoreProfile = ({ snapshot, fileContents = [], FileCtor = globalObject.File }) => {
    validateProfileSnapshot(snapshot);
    const filesById = new Map((fileContents ?? []).map((record) => [record.nodeId, record]));
    const restoreNode = (node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      icon: node.icon ?? null,
      children: node.children.map(restoreNode),
      parentPath: node.parentPath ?? null,
      parentId: node.parentId ?? null,
      permanent: Boolean(node.permanent),
      targetPath: node.targetPath ?? null,
      meta: restoreMetadata(node.meta ?? {}),
      file: createFile(filesById.get(node.id), FileCtor),
      x: finiteNumber(node.x, 10),
      y: finiteNumber(node.y, 10),
      isSelected: false,
      isDropTarget: false
    });
    const roots = new Map(snapshot.roots.map(({ path, node }) => [path, restoreNode(node)]));

    return {
      sequence: Math.max(0, Math.floor(finiteNumber(snapshot.sequence, 0))),
      roots,
      desktopItems: roots.get("/Desktop").children,
      recycleItems: roots.get("/Recycle Bin").children,
      settings: normalizeProfileSettings(snapshot.settings)
    };
  };

  const requestResult = (request) => new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error || new Error("IndexedDB request failed.")), { once: true });
  });

  const transactionComplete = (transaction) => new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("IndexedDB transaction aborted.")), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error || new Error("IndexedDB transaction failed.")), { once: true });
  });

  class LocalProfileStore {
    #indexedDB;
    #databaseName;
    #databasePromise = null;

    constructor({ indexedDB = globalObject.indexedDB, databaseName = DATABASE_NAME } = {}) {
      this.#indexedDB = indexedDB;
      this.#databaseName = databaseName;
    }

    async load(profileId = DEFAULT_PROFILE_ID) {
      if (profileId !== DEFAULT_PROFILE_ID) throw new TypeError("Unsupported local profile ID.");
      const database = await this.#open();
      const transaction = database.transaction([PROFILE_STORE, FILE_STORE], "readonly");
      const profileRequest = transaction.objectStore(PROFILE_STORE).get(profileId);
      const filesRequest = transaction.objectStore(FILE_STORE).getAll();
      const [snapshot, fileContents] = await Promise.all([
        requestResult(profileRequest),
        requestResult(filesRequest),
        transactionComplete(transaction)
      ]);
      if (!snapshot) return null;
      validateProfileSnapshot(snapshot);
      return { snapshot, fileContents };
    }

    async save(profileId, snapshot, fileContents = []) {
      if (profileId !== DEFAULT_PROFILE_ID || snapshot?.profileId !== profileId) {
        throw new TypeError("Cannot save a profile for another local user.");
      }
      validateProfileSnapshot(snapshot);
      const database = await this.#open();
      const transaction = database.transaction([PROFILE_STORE, FILE_STORE], "readwrite");
      transaction.objectStore(PROFILE_STORE).put(snapshot);
      const fileStore = transaction.objectStore(FILE_STORE);
      fileStore.clear();
      fileContents.forEach((record) => fileStore.put(record));
      await transactionComplete(transaction);
    }

    #open() {
      if (!this.#indexedDB?.open) return Promise.reject(new Error("IndexedDB is unavailable."));
      if (this.#databasePromise) return this.#databasePromise;

      this.#databasePromise = new Promise((resolve, reject) => {
        const request = this.#indexedDB.open(this.#databaseName, DATABASE_VERSION);
        request.addEventListener("upgradeneeded", () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(PROFILE_STORE)) {
            database.createObjectStore(PROFILE_STORE, { keyPath: "profileId" });
          }
          if (!database.objectStoreNames.contains(FILE_STORE)) {
            database.createObjectStore(FILE_STORE, { keyPath: "nodeId" });
          }
        });
        request.addEventListener("success", () => resolve(request.result), { once: true });
        request.addEventListener("error", () => {
          this.#databasePromise = null;
          reject(request.error || new Error("Could not open IndexedDB."));
        }, { once: true });
        request.addEventListener("blocked", () => {
          this.#databasePromise = null;
          reject(new Error("IndexedDB upgrade is blocked by another tab."));
        }, { once: true });
      });
      return this.#databasePromise;
    }
  }

  class ProfilePersistenceController {
    #profileId;
    #store;
    #capture;
    #onError;
    #delay;
    #timer = 0;
    #generation = 0;
    #savedGeneration = 0;
    #activeSave = null;

    constructor({ profileId = DEFAULT_PROFILE_ID, store, capture, onError = () => {}, delay = 180 }) {
      if (!store?.save || typeof capture !== "function") {
        throw new TypeError("ProfilePersistenceController requires a store and capture function.");
      }
      this.#profileId = profileId;
      this.#store = store;
      this.#capture = capture;
      this.#onError = onError;
      this.#delay = Math.max(0, finiteNumber(delay, 180));
    }

    get isDirty() {
      return this.#generation > this.#savedGeneration;
    }

    schedule() {
      this.#generation += 1;
      globalObject.clearTimeout(this.#timer);
      this.#timer = globalObject.setTimeout(() => {
        this.#timer = 0;
        void this.flush();
      }, this.#delay);
    }

    async flush() {
      globalObject.clearTimeout(this.#timer);
      this.#timer = 0;

      if (this.#activeSave) {
        await this.#activeSave;
        if (this.isDirty) return this.flush();
        return true;
      }
      if (!this.isDirty) return true;

      const targetGeneration = this.#generation;
      let succeeded = false;
      let captured;
      try {
        captured = this.#capture();
      } catch (error) {
        this.#onError(error);
        return false;
      }
      this.#activeSave = Promise.resolve(captured)
        .then(({ snapshot, fileContents }) => this.#store.save(this.#profileId, snapshot, fileContents))
        .then(() => {
          this.#savedGeneration = Math.max(this.#savedGeneration, targetGeneration);
          succeeded = true;
        })
        .catch((error) => {
          this.#onError(error);
        });

      await this.#activeSave;
      this.#activeSave = null;
      if (this.#generation > targetGeneration) return this.flush();
      return succeeded;
    }
  }

  const api = {
    PROFILE_SCHEMA_VERSION,
    DEFAULT_PROFILE_ID,
    normalizeProfileSettings,
    captureProfile,
    restoreProfile,
    validateProfileSnapshot,
    LocalProfileStore,
    ProfilePersistenceController
  };

  if (globalObject) globalObject.Windows7Profile = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
