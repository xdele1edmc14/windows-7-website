(() => {
  "use strict";

  const { closeAeroWindow, openAeroWindow } = window.Windows7AeroWindowMotion;
  const { ASSETS, NON_THEME_BOOT_ASSETS } = window.Windows7BootAssets;

  const LOGIN_SENTINEL = "••••••••";
  const REQUIRED_PASSWORD = "12345";
  const USERNAME = "xDele1ed";
  const HOSTNAME = "WEBOS-PC";
  const CMD_DEFAULT_TITLE = "C:\\Windows\\system32\\cmd.exe";
  const CMD_VERSION = "Microsoft Windows [Version 6.1.7601]";
  const CMD_COLORS = Object.freeze({
    0: "#000000",
    1: "#000080",
    2: "#008000",
    3: "#008080",
    4: "#800000",
    5: "#800080",
    6: "#808000",
    7: "#c0c0c0",
    8: "#808080",
    9: "#0000ff",
    A: "#00ff00",
    B: "#00ffff",
    C: "#ff0000",
    D: "#ff00ff",
    E: "#ffff00",
    F: "#ffffff"
  });
  const TASKBAR_HEIGHT = 45;
  const WINDOW_ANIMATION_MS = 400;
  const WINDOW_ANIMATION_EASING = "cubic-bezier(0.2, 0.75, 0.25, 1)";
  const WINDOW_MINIMIZED_SCALE = 0.3;
  const TRANSITION_MS = 600;
  const POWER_ACTION_LAG_MS = 150;
  const POWER_TRANSITION_DURATION_MS = 5000;
  const NO_SIGNAL_DURATION_MS = 3000;
  const POST_SHUTDOWN_BLACK_DURATION_MS = 1000;
  const BOOT_DURATION_MS = 7000;
  const BIOS_AUDIO_DURATION_MS = 10000;
  const BIOS_AUDIO_FADE_MS = 2000;
  const BIOS_LINE_DELAY_MS = 340;
  const STARTUP_AUDIO_OFFSET_SECONDS = 0.34;
  const DESK_IMAGE_WIDTH = 1122;
  const DESK_IMAGE_HEIGHT = 1402;
  const POWER_HOTSPOT = Object.freeze({
    left: 473,
    top: 1043,
    right: 667,
    bottom: 1154
  });
  const APP_SHORTCUTS = Object.freeze({
    about: Object.freeze({ name: "About", icon: ASSETS.about, glow: "72, 177, 232" }),
    chrome: Object.freeze({ name: "Chrome", icon: ASSETS.chrome, glow: "242, 194, 48" }),
    cmd: Object.freeze({ name: "Command Prompt", icon: ASSETS.cmd, glow: "104, 215, 122" }),
    calculator: Object.freeze({ name: "Calculator", icon: ASSETS.calculator, glow: "115, 172, 219" }),
    notepad: Object.freeze({ name: "Notepad", icon: ASSETS.notepad, glow: "94, 164, 219" }),
    paint: Object.freeze({ name: "Paint", icon: ASSETS.paint, glow: "238, 178, 62" }),
    "photo-viewer": Object.freeze({ name: "Windows Photo Viewer", icon: ASSETS.photoViewer, glow: "79, 177, 232" })
  });

  const assignStyles = (element, styles) => Object.assign(element.style, styles);

  const wait = (milliseconds) => new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

  const nextPaint = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const createElement = (tagName, attributes = {}, styles = {}) => {
    const element = document.createElement(tagName);

    for (const [name, value] of Object.entries(attributes)) {
      if (name === "text") {
        element.textContent = value;
      } else if (name === "className") {
        element.className = value;
      } else if (name in element) {
        element[name] = value;
      } else {
        element.setAttribute(name, value);
      }
    }

    assignStyles(element, styles);
    return element;
  };

  class DesktopSelectionMarquee {
    #container;
    #element;
    #state;
    #onStart;
    #onChange;
    #itemSelector;
    #listeners = new AbortController();

    constructor(container, state, { onStart = null, onChange = null, itemSelector = "[data-desktop-item-id]" } = {}) {
      this.#container = container;
      this.#state = state;
      this.#onStart = onStart;
      this.#onChange = onChange;
      this.#itemSelector = itemSelector;
      this.#element = createElement("div", {
        className: "desktop-selection-marquee",
        "aria-hidden": "true"
      });
      container.append(this.#element);

      container.addEventListener("mousedown", (event) => this.#begin(event), {
        signal: this.#listeners.signal
      });
      container.addEventListener("mousemove", (event) => this.#move(event), {
        signal: this.#listeners.signal
      });
      container.addEventListener("mouseup", () => this.#finish(), {
        signal: this.#listeners.signal
      });
      window.addEventListener("mouseup", () => this.#finish(), {
        signal: this.#listeners.signal
      });
    }

    destroy() {
      this.#listeners.abort();
      this.#element.remove();
      this.#resetState();
    }

    getBounds() {
      return this.#state.bounds ? { ...this.#state.bounds } : null;
    }

    getClientRect() {
      return this.#state.active ? this.#element.getBoundingClientRect() : null;
    }

    #begin(event) {
      if (event.button !== 0 || event.target.closest(`${this.#itemSelector}, input, [data-desktop-context-menu]`)) return;

      const point = this.#relativePoint(event.clientX, event.clientY);
      Object.assign(this.#state, {
        active: true,
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
        bounds: { left: point.x, top: point.y, right: point.x, bottom: point.y, width: 0, height: 0 }
      });
      assignStyles(this.#element, {
        left: `${point.x}px`,
        top: `${point.y}px`,
        width: "0px",
        height: "0px"
      });
      this.#element.classList.add("is-active");
      this.#onStart?.(this.getBounds());
      event.preventDefault();
    }

    #move(event) {
      if (!this.#state.active || (event.buttons & 1) !== 1) return;

      const point = this.#relativePoint(event.clientX, event.clientY);
      this.#state.currentX = point.x;
      this.#state.currentY = point.y;

      // Math.min and Math.abs keep the fixed anchor correct when dragging
      // left, upward, or diagonally backward from the starting point.
      const left = Math.min(this.#state.startX, point.x);
      const top = Math.min(this.#state.startY, point.y);
      const width = Math.abs(point.x - this.#state.startX);
      const height = Math.abs(point.y - this.#state.startY);
      this.#state.bounds = {
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height
      };
      assignStyles(this.#element, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`
      });
      this.#onChange?.(this.getClientRect(), this.getBounds());
    }

    #finish() {
      if (!this.#state.active) return;
      this.#element.classList.remove("is-active");
      this.#resetState();
    }

    #relativePoint(clientX, clientY) {
      const rect = this.#container.getBoundingClientRect();
      return {
        x: Math.min(rect.width, Math.max(0, clientX - rect.left)),
        y: Math.min(rect.height, Math.max(0, clientY - rect.top))
      };
    }

    #resetState() {
      Object.assign(this.#state, {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        bounds: null
      });
    }
  }

  class ShellFileSystem {
    #sequence = 0;
    #listeners = new Set();

    static fromProfile(data) {
      const profileApi = window.Windows7Profile;
      if (!profileApi?.restoreProfile) throw new Error("Windows 7 profile storage is unavailable.");
      const restored = profileApi.restoreProfile(data);
      const fileSystem = new ShellFileSystem();
      fileSystem.#sequence = restored.sequence;
      fileSystem.roots = restored.roots;
      fileSystem.desktopItems = restored.desktopItems;
      fileSystem.recycleItems = restored.recycleItems;
      return fileSystem;
    }

    constructor() {
      this.recycleItems = [];
      this.desktopItems = [
        this.#node("recycle", "Recycle Bin", "/Desktop", {
          id: "recycle-bin",
          permanent: true,
          targetPath: "/Recycle Bin",
          x: 10,
          y: 10
        }),
        this.#node("computer", "Computer", "/Desktop", {
          id: "computer",
          permanent: true,
          targetPath: "/Computer",
          x: 10,
          y: 96
        })
      ];

      const root = (name, icon = null) => this.#node("folder", name, null, {
        id: `root-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        icon,
        permanent: true
      });
      const desktop = root("Desktop", ASSETS.desktop);
      const documents = root("Documents", ASSETS.documents);
      const downloads = root("Downloads", ASSETS.downloads);
      const music = root("Music", ASSETS.music);
      const pictures = root("Pictures", ASSETS.pictures);
      const videos = root("Videos", ASSETS.videos);
      const computer = root("Computer", ASSETS.computer);
      const recycleBin = root("Recycle Bin", ASSETS.recycleEmpty);
      desktop.children = this.desktopItems;
      recycleBin.children = this.recycleItems;

      const localDisk = this.#node("drive", "Local Disk (C:)", "/Computer", {
        id: "local-disk-c",
        icon: ASSETS.systemDrive,
        permanent: true,
        meta: { capacity: "2.0 GB", free: "1.9 GB" }
      });
      ["Program Files", "Program Files (x86)", "Users", "Windows", "ProgramData"].forEach((name) => {
        const folder = this.#node("folder", name, "/Computer/Local Disk (C:)", {
          icon: ASSETS.folderFull,
          permanent: true,
          meta: { systemFolder: name !== "Users" }
        });
        localDisk.children.push(folder);
        if (name === "Users") {
          folder.children.push(this.#node("folder", USERNAME, "/Computer/Local Disk (C:)/Users", {
            icon: ASSETS.folderFull,
            permanent: true
          }));
        }
      });
      const dvd = this.#node("dvd", "DVD Drive", "/Computer", {
        id: "dvd-drive",
        icon: ASSETS.dvdDrive,
        permanent: true
      });
      computer.children.push(localDisk, dvd);

      this.roots = new Map([
        ["/Desktop", desktop],
        ["/Documents", documents],
        ["/Downloads", downloads],
        ["/Music", music],
        ["/Pictures", pictures],
        ["/Videos", videos],
        ["/Computer", computer],
        ["/Recycle Bin", recycleBin]
      ]);
    }

    captureProfile(settings = {}) {
      const profileApi = window.Windows7Profile;
      if (!profileApi?.captureProfile) throw new Error("Windows 7 profile storage is unavailable.");
      return profileApi.captureProfile({
        profileId: USERNAME,
        sequence: this.#sequence,
        roots: this.roots,
        settings
      });
    }

    findById(id) {
      if (!id) return null;
      const visited = new Set();
      const pending = [...this.roots.values()];
      while (pending.length > 0) {
        const node = pending.shift();
        if (!node || visited.has(node.id)) continue;
        if (node.id === id) return node;
        visited.add(node.id);
        pending.push(...(node.children ?? []));
      }
      return null;
    }

    #node(type, name, parentPath, options = {}) {
      return {
        id: options.id ?? `fs-item-${++this.#sequence}`,
        name,
        type,
        icon: options.icon ?? null,
        children: options.children ?? [],
        parentPath,
        parentId: options.parentId ?? null,
        permanent: Boolean(options.permanent),
        targetPath: options.targetPath ?? null,
        meta: options.meta ?? {},
        file: options.file ?? null,
        x: options.x ?? 10,
        y: options.y ?? 10,
        isSelected: false,
        isDropTarget: false
      };
    }

    nextId() {
      return `fs-item-${++this.#sequence}`;
    }

    subscribe(listener) {
      this.#listeners.add(listener);
      return () => this.#listeners.delete(listener);
    }

    emit(detail = {}) {
      this.#listeners.forEach((listener) => listener(detail));
    }

    resolve(path) {
      if (path === "/Quick Access") {
        return { id: "quick-access", name: "Quick Access", type: "virtual", parentPath: null, children: [] };
      }
      const direct = this.roots.get(path);
      if (direct) return direct;

      const rootPath = [...this.roots.keys()]
        .filter((candidate) => path.startsWith(`${candidate}/`))
        .sort((first, second) => second.length - first.length)[0];
      if (!rootPath) return null;

      let node = this.roots.get(rootPath);
      const remainder = path.slice(rootPath.length + 1).split("/").filter(Boolean);
      for (const [index, name] of remainder.entries()) {
        const children = rootPath === "/Desktop" && index === 0
          ? this.desktopItems.filter(({ parentId }) => parentId === null)
          : node?.children ?? [];
        node = children.find((child) => child.name === decodeURIComponent(name));
        if (!node) return null;
      }
      return node;
    }

    list(path) {
      if (path === "/Quick Access") {
        const shortcuts = [
          ["Desktop", "/Desktop", ASSETS.desktop],
          ["Downloads", "/Downloads", ASSETS.downloads],
          ["Documents", "/Documents", ASSETS.documents],
          ["Pictures", "/Pictures", ASSETS.pictures],
          ["Music", "/Music", ASSETS.music],
          ["Videos", "/Videos", ASSETS.videos]
        ];
        return shortcuts.map(([name, targetPath, icon]) => ({
          id: `shortcut-${name.toLocaleLowerCase()}`,
          name,
          type: "shortcut",
          icon,
          children: [],
          parentPath: "/Quick Access",
          targetPath,
          permanent: true,
          meta: {}
        }));
      }
      if (path === "/Desktop") return this.desktopItems.filter(({ parentId }) => parentId === null);
      return this.resolve(path)?.children ?? [];
    }

    pathFor(node) {
      if (!node) return null;
      if (node.targetPath && ["computer", "recycle"].includes(node.type)) return node.targetPath;
      return node.parentPath ? `${node.parentPath}/${node.name}` : `/${node.name}`;
    }

    uniqueName(parentPath, requestedName, type = "folder", excludedId = null) {
      const names = new Set(this.list(parentPath)
        .filter(({ id }) => id !== excludedId)
        .map(({ name }) => name.toLocaleLowerCase()));
      if (!names.has(requestedName.toLocaleLowerCase())) return requestedName;

      const dotIndex = type !== "folder" ? requestedName.lastIndexOf(".") : -1;
      const base = dotIndex > 0 ? requestedName.slice(0, dotIndex) : requestedName;
      const extension = dotIndex > 0 ? requestedName.slice(dotIndex) : "";
      let index = 2;
      let candidate = `${base} (${index})${extension}`;
      while (names.has(candidate.toLocaleLowerCase())) {
        index += 1;
        candidate = `${base} (${index})${extension}`;
      }
      return candidate;
    }

    create(parentPath, type, requestedName, options = {}) {
      const parent = this.resolve(parentPath);
      if (!parent || !["folder", "drive"].includes(parent.type)) return null;
      const name = this.uniqueName(parentPath, requestedName, type);
      const node = this.#node(type, name, parentPath, {
        file: options.file ?? null,
        icon: options.icon ?? null,
        meta: options.meta ?? {},
        parentId: parentPath.startsWith("/Desktop/") ? parent.id : null,
        x: options.x ?? 10,
        y: options.y ?? 10
      });
      parent.children.push(node);
      if (parentPath.startsWith("/Desktop/") && !this.desktopItems.includes(node)) {
        this.desktopItems.push(node);
      }
      this.emit({ type: "create", path: this.pathFor(node) });
      return node;
    }

    updateFile(node, file, meta = {}) {
      if (!node || ["folder", "drive", "dvd", "computer", "recycle"].includes(node.type)) return false;
      node.file = file;
      node.meta = {
        ...node.meta,
        ...meta,
        size: Number(file?.size ?? meta.size ?? node.meta?.size ?? 0),
        modifiedAt: new Date()
      };
      this.emit({ type: "update-file", node, path: this.pathFor(node) });
      return true;
    }

    rename(node, requestedName) {
      if (!node || node.permanent || !node.parentPath) return false;
      const nextName = this.uniqueName(node.parentPath, requestedName.trim() || node.name, node.type, node.id);
      node.name = nextName;
      this.#refreshDescendantPaths(node);
      this.emit({ type: "rename", node });
      return true;
    }

    move(nodes, targetPath) {
      const target = this.resolve(targetPath);
      if (!target || !["folder", "drive"].includes(target.type)) return false;
      const movable = nodes.filter((node) => {
        if (!node || node.permanent || node.parentPath === targetPath) return false;
        const sourcePath = this.pathFor(node);
        return sourcePath !== targetPath && !targetPath.startsWith(`${sourcePath}/`);
      });
      movable.forEach((node) => {
        this.#detach(node);
        node.name = this.uniqueName(targetPath, node.name, node.type);
        node.parentPath = targetPath;
        node.parentId = targetPath.startsWith("/Desktop/") ? target.id : null;
        node.isSelected = false;
        node.isDropTarget = false;
        target.children.push(node);
        this.#refreshDescendantPaths(node);
        if (targetPath === "/Desktop" || targetPath.startsWith("/Desktop/")) this.#addDesktopSubtree(node);
        else this.#removeDesktopSubtree(node);
      });
      if (movable.length > 0) this.emit({ type: "move", targetPath });
      return movable.length > 0;
    }

    copy(nodes, targetPath) {
      const target = this.resolve(targetPath);
      if (!target || !["folder", "drive"].includes(target.type)) return [];
      const copies = nodes.filter((node) => node && !node.permanent).map((node) => {
        const clone = this.#cloneNode(node, targetPath);
        clone.name = this.uniqueName(targetPath, node.name, node.type);
        clone.parentId = targetPath.startsWith("/Desktop/") ? target.id : null;
        target.children.push(clone);
        if (targetPath === "/Desktop" || targetPath.startsWith("/Desktop/")) this.#addDesktopSubtree(clone);
        return clone;
      });
      if (copies.length > 0) this.emit({ type: "copy", targetPath });
      return copies;
    }

    trash(nodes) {
      const removed = nodes.filter((node) => node && !node.permanent);
      removed.forEach((node) => {
        const originalPath = this.pathFor(node);
        this.#detach(node);
        this.#removeDesktopSubtree(node);
        node.name = this.uniqueName("/Recycle Bin", node.name, node.type);
        node.parentPath = "/Recycle Bin";
        node.parentId = null;
        node.meta = { ...node.meta, originalPath, deletedAt: new Date() };
        node.isSelected = false;
        node.isDropTarget = false;
        this.recycleItems.push(node);
        this.#refreshDescendantPaths(node);
      });
      if (removed.length > 0) this.emit({ type: "trash" });
      return removed.length > 0;
    }

    emptyRecycleBin() {
      if (this.recycleItems.length === 0) return;
      this.recycleItems.splice(0);
      this.emit({ type: "empty-recycle-bin" });
    }

    #detach(node) {
      const siblings = node.parentPath === "/Desktop" ? this.desktopItems : this.list(node.parentPath);
      const index = siblings.indexOf(node);
      if (index >= 0) siblings.splice(index, 1);
    }

    #cloneNode(node, parentPath) {
      const clone = this.#node(node.type, node.name, parentPath, {
        icon: node.icon,
        file: node.file,
        x: node.x + 18,
        y: node.y + 18,
        meta: { ...node.meta }
      });
      clone.children = node.children.map((child) => {
        const childClone = this.#cloneNode(child, `${parentPath}/${clone.name}`);
        childClone.parentId = parentPath.startsWith("/Desktop") ? clone.id : null;
        return childClone;
      });
      return clone;
    }

    #refreshDescendantPaths(node) {
      const path = this.pathFor(node);
      node.children.forEach((child) => {
        child.parentPath = path;
        child.parentId = path.startsWith("/Desktop") ? node.id : null;
        this.#refreshDescendantPaths(child);
      });
    }

    #addDesktopSubtree(node) {
      if (!this.desktopItems.includes(node)) this.desktopItems.push(node);
      node.children.forEach((child) => this.#addDesktopSubtree(child));
    }

    #removeDesktopSubtree(node) {
      const descendants = new Set();
      const collect = (entry) => {
        descendants.add(entry);
        entry.children.forEach(collect);
      };
      collect(node);
      for (let index = this.desktopItems.length - 1; index >= 0; index -= 1) {
        if (descendants.has(this.desktopItems[index])) this.desktopItems.splice(index, 1);
      }
    }
  }

  class Windows7Engine {
    #root;
    #desktop;
    #desktopTemplate;
    #taskbar;
    #state = "boot";
    #bootedAt = performance.now();
    #highestZIndex = 100;
    #drag = null;
    #dragFrame = 0;
    #resize = null;
    #resizeFrame = 0;
    #biosAudio = null;
    #biosFadeFrame = 0;
    #startupAudio = null;
    #shutdownAudio = null;
    #loginAudio = null;
    #criticalStopAudio = null;
    #navigationAudio = null;
    #deskAudio = null;
    #deskImage = null;
    #powerAssetPreload = null;
    #powerSequenceInProgress = false;
    #startupSoundHasPlayed = false;
    #loginScreen = null;
    #loginSubmissionInProgress = false;
    #clockTimer = 0;
    #analogClockTimer = 0;
    #trayFlyout = null;
    #trayFlyoutOwner = null;
    #trayTooltip = null;
    #startMenu = null;
    #startMenuCloseTimer = 0;
    #volumeIcon = null;
    #volume = 100;
    #desktopIconLayer = null;
    #desktopContextMenu = null;
    #desktopFileInput = null;
    #fileSystem = new ShellFileSystem();
    #fileSystemUnsubscribe = null;
    #explorerWindows = new Map();
    #explorerSequence = 0;
    #shellClipboard = null;
    #selectedDesktopItemId = null;
    #desktopItemDrag = null;
    #desktopItemDragFrame = 0;
    #shellDrag = null;
    #shellDropHighlight = null;
    #suppressedShellClickTarget = null;
    #suppressedShellClickTimer = 0;
    #pinnedTaskItems = new Map();
    #lastDesktopClick = { itemId: null, time: 0 };
    #desktopRefreshTimer = 0;
    #desktopMarquee = null;
    #desktopSelectionState = {
      active: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      bounds: null
    };
    #desktopItemSequence = 0;
    #desktopIconSize = "medium";
    #desktopAutoArrange = false;
    #desktopAlignToGrid = true;
    #contextMenuPoint = { x: 16, y: 96 };
    #listeners = new AbortController();
    #windowAnimations = new WeakMap();
    #chromeApp = null;
    #controlPanelApp = null;
    #themesApp = null;
    #themeSwitchController = null;
    #paintApp = null;
    #photoViewerApp = null;
    #notepadApp = null;
    #currentWallpaper = ASSETS.wallpaper;
    #currentThemeId = "windows-7";
    #themeWaitOverlay = null;
    #themeWaitRemovalTimer = 0;
    #themeFocusReturn = null;
    #profileStore = null;
    #profilePersistence = null;
    #profileApps = {};
    #pendingPinnedItems = [];

    constructor(root) {
      this.#root = root;
      this.#desktop = root.querySelector("[data-desktop]");
      this.#taskbar = this.#desktop?.querySelector("[data-taskbar]") ?? null;

      if (!this.#desktop) {
        throw new Error("Windows7Engine requires a [data-desktop] element.");
      }

      this.#desktopTemplate = this.#desktop.cloneNode(true);
    }

    async start() {
      await this.#initializeLocalProfile();
      this.#configureRoot();
      this.#configureDesktop();
      this.#configureDesktopItems();
      this.#bindWindowManager();
      this.#prepareAudioElements();

      // Browsers only guarantee unmuted media after a real user gesture. Gate
      // the boot once, then perform the full boot/login pipeline in the same
      // activated document so the login cue cannot be rejected at random.
      const startupGate = this.#createStartupGate();
      this.#root.append(startupGate);
      await this.#waitForStartupGesture(startupGate);
      startupGate.remove();

      await this.#runBootSequence();
    }

    async #initializeLocalProfile() {
      const profileApi = window.Windows7Profile;
      if (!profileApi?.LocalProfileStore || !profileApi?.ProfilePersistenceController) {
        console.warn("Local profile persistence is unavailable; this session will not be saved.");
        return;
      }

      try {
        this.#profileStore = new profileApi.LocalProfileStore();
        const savedProfile = await this.#profileStore.load(USERNAME);
        if (savedProfile) {
          this.#fileSystem = ShellFileSystem.fromProfile(savedProfile);
          this.#applyProfileSettings(profileApi.normalizeProfileSettings(savedProfile.snapshot.settings));
        }
        this.#profilePersistence = new profileApi.ProfilePersistenceController({
          profileId: USERNAME,
          store: this.#profileStore,
          capture: () => this.#captureLocalProfile(),
          onError: (error) => console.warn("The local Windows profile could not be saved.", error)
        });
        if (!savedProfile) this.#profilePersistence.schedule();
      } catch (error) {
        this.#profileStore = null;
        this.#profilePersistence = null;
        console.warn("The local Windows profile could not be loaded; factory state will be used for this session.", error);
      }
    }

    #applyProfileSettings(settings) {
      this.#desktopIconSize = settings.desktopIconSize;
      this.#desktopAutoArrange = settings.desktopAutoArrange;
      this.#desktopAlignToGrid = settings.desktopAlignToGrid;
      this.#currentWallpaper = settings.wallpaper;
      this.#currentThemeId = settings.themeId;
      this.#volume = settings.volume;
      this.#pendingPinnedItems = [...settings.pinnedItems];
      this.#profileApps = { ...settings.apps };
    }

    #captureLocalProfile() {
      return this.#fileSystem.captureProfile({
        desktopIconSize: this.#desktopIconSize,
        desktopAutoArrange: this.#desktopAutoArrange,
        desktopAlignToGrid: this.#desktopAlignToGrid,
        wallpaper: this.#currentWallpaper,
        themeId: this.#currentThemeId,
        volume: this.#volume,
        pinnedItems: this.#capturePinnedItems(),
        apps: this.#profileApps
      });
    }

    #scheduleProfileSave() {
      this.#profilePersistence?.schedule();
    }

    destroy() {
      this.#cancelDrag();
      this.#cancelResize();
      this.#cancelDesktopItemDrag();
      this.#cancelShellDrag();
      this.#desktopMarquee?.destroy();
      this.#chromeApp?.destroy();
      this.#controlPanelApp?.destroy();
      this.#themesApp?.destroy();
      this.#paintApp?.destroy();
      this.#photoViewerApp?.destroy();
      this.#notepadApp?.destroy();
      this.#listeners.abort();
      window.clearInterval(this.#clockTimer);
      window.clearInterval(this.#analogClockTimer);
      window.clearTimeout(this.#desktopRefreshTimer);
      window.clearTimeout(this.#startMenuCloseTimer);
      window.clearTimeout(this.#suppressedShellClickTimer);
      window.clearTimeout(this.#themeWaitRemovalTimer);
      this.#themeWaitOverlay?.remove();
      if (this.#desktop) this.#desktop.inert = false;
      cancelAnimationFrame(this.#biosFadeFrame);
      this.#biosAudio?.pause();
      this.#startupAudio?.pause();
      this.#shutdownAudio?.pause();
      this.#loginAudio?.pause();
      this.#criticalStopAudio?.pause();
      this.#navigationAudio?.pause();
      this.#stopDeskAudio();
    }

    #configureRoot() {
      assignStyles(this.#root, {
        position: "fixed",
        inset: "0",
        overflow: "hidden",
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
        background: "#000",
        cursor: `url("${ASSETS.cursorArrow}") 4 2, default`
      });
      this.#applyThemeShell(this.#findTheme(this.#currentThemeId));
    }

    #configureDesktop() {
      this.#desktop.hidden = false;
      assignStyles(this.#desktop, {
        position: "absolute",
        inset: "0",
        overflow: "hidden",
        visibility: "hidden",
        opacity: "0",
        transition: `opacity ${TRANSITION_MS}ms ease`,
        backgroundColor: this.#themePresentation(this.#findTheme(this.#currentThemeId)).desktopColor,
        backgroundImage: this.#findTheme(this.#currentThemeId)?.wallpaper === null
          ? "none"
          : `url("${this.#currentWallpaper}")`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover"
      });

      this.#desktop.querySelectorAll(".window").forEach((windowElement, index) => {
        const desktopWidth = this.#desktop.clientWidth || window.innerWidth;
        const desktopHeight = this.#desktop.clientHeight || window.innerHeight;
        const defaultWidth = windowElement.dataset.appWindow === "about" ? 580 : 820;
        const defaultHeight = windowElement.dataset.appWindow === "about" ? 410 : 520;
        const preferredWidth = Number(windowElement.dataset.windowWidth) || defaultWidth;
        const preferredHeight = Number(windowElement.dataset.windowHeight) || defaultHeight;
        const preferredMinWidth = Number(windowElement.dataset.windowMinWidth) || 360;
        const preferredMinHeight = Number(windowElement.dataset.windowMinHeight) || 240;
        const isFixedSize = windowElement.hasAttribute("data-fixed-size");
        const width = Math.min(preferredWidth, Math.max(1, desktopWidth - 32));
        const height = Math.min(preferredHeight, Math.max(1, desktopHeight - TASKBAR_HEIGHT - 32));
        const cascadeOffset = windowElement.dataset.appWindow === "display" ? 0 : index * 24;

        assignStyles(windowElement, {
          position: "absolute",
          zIndex: "100",
          left: `${Math.max(0, (desktopWidth - width) / 2 + cascadeOffset)}px`,
          top: `${Math.max(0, (desktopHeight - TASKBAR_HEIGHT - height) / 2 + cascadeOffset)}px`,
          width: `${width}px`,
          height: `${height}px`,
          minWidth: `${isFixedSize ? width : Math.min(preferredMinWidth, desktopWidth)}px`,
          minHeight: `${isFixedSize ? height : Math.min(preferredMinHeight, Math.max(1, desktopHeight - TASKBAR_HEIGHT))}px`,
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          willChange: "transform"
        });

        const body = windowElement.querySelector(".window-body");
        if (body) {
          assignStyles(body, { flex: "1", overflow: "auto" });
        }

        const titleBar = windowElement.querySelector(".title-bar");
        if (titleBar) {
          assignStyles(titleBar, {
            flex: "0 0 auto",
            touchAction: "none",
            cursor: `url("${ASSETS.cursorMove}") 24 24, move`
          });
        }

        windowElement.querySelectorAll("button").forEach((button) => {
          button.style.cursor = `url("${ASSETS.cursorLink}") 6 2, pointer`;
        });
        if (!isFixedSize) this.#configureResizeHandles(windowElement);
      });

      this.#configureCalculator();
      this.#configureCommandPrompt();
      this.#configureChrome();
      this.#configureControlPanel();
      this.#configureFileApps();
      this.#configureTaskbar();
      this.#configureStartMenu();
      this.#configureSystemTray();
      this.#restorePinnedItems();
      this.#updateClock();
      this.#clockTimer = window.setInterval(() => this.#updateClock(), 30_000);
    }

    #configureChrome() {
      this.#chromeApp?.destroy();
      this.#chromeApp = null;
      const chromeWindow = this.#desktop.querySelector('[data-app-window="chrome"]');
      if (!chromeWindow || typeof window.Windows7ChromeApp !== "function") return;
      this.#chromeApp = new window.Windows7ChromeApp(chromeWindow);
    }

    #configureControlPanel() {
      this.#controlPanelApp?.destroy();
      this.#themesApp?.destroy();
      this.#controlPanelApp = null;
      this.#themesApp = null;
      this.#themeSwitchController = null;
      const controlPanelWindow = this.#desktop.querySelector('[data-app-window="display"]');
      const ControlPanelApp = window.Windows7ControlPanel?.ControlPanelApp;
      const themesView = controlPanelWindow?.querySelector("[data-control-panel-themes]");
      const themesApi = window.Windows7Themes;
      if (!controlPanelWindow || typeof ControlPanelApp !== "function" || !themesView || !themesApi) return;

      this.#themeSwitchController = new themesApi.ThemeSwitchController({
        preloadTheme: (theme) => this.#preloadTheme(theme),
        applyTheme: (theme) => this.#applyTheme(theme),
        playSound: (_theme, assets) => this.#playThemeSound(assets.audio),
        onBusyChange: (busy, _theme, { failed = false } = {}) => {
          if (busy) return this.#showThemeWait();
          return failed ? this.#showThemeLoadError() : this.#hideThemeWait();
        },
        onError: () => {}
      });
      this.#themesApp = new themesApi.ThemesApp(themesView, {
        getActiveThemeId: () => this.#currentThemeId,
        onSelect: (theme, card) => {
          this.#themeFocusReturn = card;
          return this.#themeSwitchController.switchTo(theme);
        }
      });
      this.#controlPanelApp = new ControlPanelApp(controlPanelWindow, {
        onShowThemes: () => this.#themesApp?.refresh()
      });
    }

    #openControlPanel(view = "home") {
      if (view === "display") this.#controlPanelApp?.showDisplay();
      else if (view === "themes") this.#controlPanelApp?.showThemes();
      else this.#controlPanelApp?.showHome({ clearSearch: true });
      this.#openAppWindow("display");
    }

    #findTheme(themeId) {
      const themes = window.Windows7Themes?.THEMES ?? [];
      return themes.find(({ id }) => id === themeId) ?? themes.find(({ id }) => id === "windows-7") ?? null;
    }

    #themePresentation(theme) {
      return window.Windows7Themes?.buildThemePresentation(theme) ?? {
        themeId: "windows-7",
        wallpaper: ASSETS.wallpaper,
        desktopColor: "#0877c9",
        variables: {}
      };
    }

    #applyThemeShell(theme) {
      if (!theme) return;
      const presentation = this.#themePresentation(theme);
      this.#root.dataset.theme = presentation.themeId;
      Object.entries(presentation.variables).forEach(([name, value]) => {
        this.#root.style.setProperty(name, value);
      });
    }

    async #preloadTheme(theme) {
      const themesApi = window.Windows7Themes;
      const [image, audio] = await Promise.all([
        theme.wallpaper ? themesApi.preloadImage(theme.wallpaper) : Promise.resolve(null),
        themesApi.preloadAudio(theme.sound)
      ]);
      return { image, audio };
    }

    #applyTheme(theme) {
      const presentation = this.#themePresentation(theme);
      this.#applyThemeShell(theme);
      this.#currentThemeId = theme.id;
      if (presentation.wallpaper) this.#currentWallpaper = presentation.wallpaper;
      assignStyles(this.#desktop, {
        backgroundColor: presentation.desktopColor,
        backgroundImage: presentation.wallpaper ? `url("${presentation.wallpaper}")` : "none",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover"
      });
      this.#themesApp?.setActiveTheme(theme.id);
      this.#scheduleProfileSave();
    }

    async #playThemeSound(audio) {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, this.#volume / 100));
      await audio.play();
    }

    #showThemeWait() {
      window.clearTimeout(this.#themeWaitRemovalTimer);
      this.#themeWaitOverlay?.remove();
      this.#desktop.inert = true;
      const overlay = createElement("div", { className: "theme-switch-overlay" });
      const dialog = createElement("div", {
        className: "window active theme-switch-dialog",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Please Wait",
        tabIndex: -1
      });
      const titleBar = createElement("div", { className: "title-bar" });
      titleBar.append(createElement("div", { className: "title-bar-text", textContent: "Personalization" }));
      const body = createElement("div", { className: "window-body theme-switch-dialog__body" });
      body.append(
        createElement("img", { src: ASSETS.busy, alt: "", draggable: false }),
        createElement("span", { textContent: "Please Wait" })
      );
      dialog.append(titleBar, body);
      overlay.append(dialog);
      this.#root.append(overlay);
      void openAeroWindow(dialog);
      this.#themeWaitOverlay = overlay;
      requestAnimationFrame(() => {
        if (this.#themeWaitOverlay === overlay && !overlay.classList.contains("is-leaving")) {
          overlay.classList.add("is-active");
        }
      });
      dialog.focus({ preventScroll: true });
    }

    #hideThemeWait() {
      const overlay = this.#themeWaitOverlay;
      if (!overlay) {
        this.#desktop.inert = false;
        return Promise.resolve();
      }
      overlay.classList.remove("is-active");
      overlay.classList.add("is-leaving");
      const dialog = overlay.querySelector(".window");
      const windowClose = dialog ? closeAeroWindow(dialog) : Promise.resolve();
      const duration = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 420;
      const overlayClose = new Promise((resolve) => {
        this.#themeWaitRemovalTimer = window.setTimeout(() => {
          if (this.#themeWaitOverlay === overlay) {
            overlay.remove();
            this.#themeWaitOverlay = null;
            this.#desktop.inert = false;
            this.#themeFocusReturn?.focus({ preventScroll: true });
          }
          resolve();
        }, duration);
      });
      return Promise.all([windowClose, overlayClose]).then(() => undefined);
    }

    #showThemeLoadError() {
      const overlay = this.#themeWaitOverlay;
      if (!overlay) return;
      window.clearTimeout(this.#themeWaitRemovalTimer);
      overlay.classList.remove("is-leaving");
      overlay.classList.add("is-active", "has-error");
      const body = overlay.querySelector(".theme-switch-dialog__body");
      if (!body) return;
      const message = createElement("span", { textContent: "The theme could not be loaded." });
      const close = createElement("button", { type: "button", textContent: "Close", className: "default" });
      close.addEventListener("click", async () => {
        const dialog = overlay.querySelector(".window");
        if (dialog) await closeAeroWindow(dialog);
        overlay.remove();
        this.#themeWaitOverlay = null;
        this.#desktop.inert = false;
        this.#themeFocusReturn?.focus({ preventScroll: true });
      }, { once: true });
      body.replaceChildren(message, close);
      close.focus({ preventScroll: true });
    }

    #configureFileApps() {
      this.#paintApp?.destroy();
      this.#photoViewerApp?.destroy();
      this.#notepadApp?.destroy();
      this.#paintApp = null;
      this.#photoViewerApp = null;
      this.#notepadApp = null;

      const writableFolders = ["/Desktop", "/Documents", "/Pictures", "/Downloads", "/Music", "/Videos"];
      const shell = {
        writableFolders: () => [...writableFolders],
        list: (path) => [...this.#fileSystem.list(path)],
        listImages: (path) => this.#fileSystem.list(path).filter((node) => this.#isImageFile(node)),
        listTexts: (path) => this.#fileSystem.list(path).filter((node) => this.#isTextFile(node)),
        allImages: () => writableFolders.flatMap((path) =>
          this.#fileSystem.list(path)
            .filter((node) => this.#isImageFile(node))
            .map((node) => ({ node, path }))),
        isImage: (node) => this.#isImageFile(node),
        isText: (node) => this.#isTextFile(node),
        getFile: (node) => node?.file ?? null,
        pathFor: (node) => this.#fileSystem.pathFor(node),
        subscribe: (listener) => this.#fileSystem.subscribe(listener),
        saveImage: ({ existingNode = null, folderPath = "/Pictures", name = "Untitled.png", blob }) => {
          const safeBase = String(name || "Untitled.png").trim().replace(/[<>:"/\\|?*]/g, "_") || "Untitled.png";
          const fileName = /\.png$/i.test(safeBase) ? safeBase : `${safeBase}.png`;
          const file = new File([blob], existingNode?.name ?? fileName, { type: "image/png" });
          if (existingNode) {
            this.#fileSystem.updateFile(existingNode, file, { mimeType: "image/png" });
            return existingNode;
          }
          const desktopPoint = folderPath === "/Desktop"
            ? this.#findAvailableDesktopPoint({ x: 10, y: 10 })
            : {};
          return this.#fileSystem.create(folderPath, "file", fileName, {
            file,
            icon: ASSETS.imageFile,
            ...desktopPoint,
            meta: {
              mimeType: "image/png",
              size: file.size,
              createdAt: new Date(),
              modifiedAt: new Date()
            }
          });
        },
        saveText: ({ existingNode = null, folderPath = "/Documents", name = "Untitled.txt", text = "" }) => {
          const safeName = String(name || "Untitled.txt").trim().replace(/[<>:"/\\|?*]/g, "_") || "Untitled.txt";
          const fileName = /\.[a-z0-9]+$/i.test(safeName) ? safeName : `${safeName}.txt`;
          const file = new File([String(text)], existingNode?.name ?? fileName, { type: "text/plain;charset=utf-8" });
          if (existingNode) {
            this.#fileSystem.updateFile(existingNode, file, { mimeType: "text/plain", text: String(text) });
            return existingNode;
          }
          const desktopPoint = folderPath === "/Desktop"
            ? this.#findAvailableDesktopPoint({ x: 10, y: 10 })
            : {};
          return this.#fileSystem.create(folderPath, "file", fileName, {
            file,
            icon: ASSETS.textFile,
            ...desktopPoint,
            meta: {
              mimeType: "text/plain",
              text: String(text),
              size: file.size,
              createdAt: new Date(),
              modifiedAt: new Date()
            }
          });
        },
        updateImage: (node, blob) => {
          if (!node || !blob) return false;
          const file = new File([blob], node.name, { type: "image/png" });
          node.icon = ASSETS.imageFile;
          return this.#fileSystem.updateFile(node, file, { mimeType: "image/png" });
        },
        trash: (node) => this.#fileSystem.trash(node ? [node] : []),
        setWallpaper: (source) => {
          if (!source) return;
          this.#currentWallpaper = source;
          assignStyles(this.#desktop, {
            backgroundImage: `url("${source}")`,
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover"
          });
          this.#scheduleProfileSave();
        },
        setTitle: (windowElement, title) => {
          const label = windowElement?.querySelector("[data-app-title], [data-notepad-title], [data-paint-title], [data-photo-viewer-title], .title-bar-text");
          if (label) label.textContent = title;
          if (windowElement) this.#updateWindowTaskLabel(windowElement, title);
        },
        closeWindow: (windowElement) => this.#closeWindow(windowElement, { force: true })
      };

      const paintWindow = this.#desktop.querySelector('[data-app-window="paint"]');
      if (paintWindow && typeof window.Windows7PaintApp === "function") {
        this.#paintApp = new window.Windows7PaintApp(paintWindow, shell);
      }
      const viewerWindow = this.#desktop.querySelector('[data-app-window="photo-viewer"]');
      if (viewerWindow && typeof window.Windows7PhotoViewerApp === "function") {
        this.#photoViewerApp = new window.Windows7PhotoViewerApp(viewerWindow, shell);
      }
      const notepadWindow = this.#desktop.querySelector('[data-app-window="notepad"]');
      if (notepadWindow && typeof window.Windows7NotepadApp === "function") {
        this.#notepadApp = new window.Windows7NotepadApp(notepadWindow, shell);
      }
    }

    #configureNotepad() {
      const notepadWindow = this.#desktop.querySelector('[data-app-window="notepad"]');
      const editor = notepadWindow?.querySelector("[data-notepad-editor]");
      if (!notepadWindow || !editor) return;

      let session = 0;
      const setDocument = (name = "Untitled", text = "") => {
        editor.value = text;
        const title = `${name} - Notepad`;
        const label = notepadWindow.querySelector("[data-notepad-title]");
        if (label) label.textContent = title;
        this.#updateWindowTaskLabel(notepadWindow, title);
      };
      const reset = () => {
        session += 1;
        setDocument();
      };

      notepadWindow.addEventListener("notepad:reset", reset, { signal: this.#listeners.signal });
      notepadWindow.addEventListener("notepad:open", async (event) => {
        const node = event.detail?.node;
        const file = node?.file;
        const openSession = ++session;
        setDocument(node?.name ?? "Untitled", "Opening file...");
        try {
          const text = typeof file?.text === "function" ? await file.text() : String(node?.meta?.text ?? "");
          if (openSession === session) setDocument(node.name, text);
        } catch (error) {
          console.error("Notepad could not read the selected file.", error);
          if (openSession === session) setDocument(node?.name ?? "Untitled", "The file could not be opened.");
        }
      }, { signal: this.#listeners.signal });
      reset();
    }

    #configureCalculator() {
      const calculatorWindow = this.#desktop.querySelector('[data-app-window="calculator"]');
      const display = calculatorWindow?.querySelector("[data-calculator-display]");
      const memoryIndicator = calculatorWindow?.querySelector("[data-calculator-memory-indicator]");
      if (!calculatorWindow || !display || !memoryIndicator) return;

      const memoryClearButton = calculatorWindow.querySelector('[data-calculator-action="memory-clear"]');
      const memoryRecallButton = calculatorWindow.querySelector('[data-calculator-action="memory-recall"]');
      const maximumEntryDigits = 16;
      const state = {
        entry: "0",
        accumulator: null,
        pendingOperator: null,
        lastOperator: null,
        lastOperand: null,
        replaceEntry: false,
        errorMessage: "",
        memory: 0,
        hasMemory: false
      };

      const render = () => {
        display.textContent = state.errorMessage || state.entry;
        display.closest(".calculator-display")?.classList.toggle("is-error", Boolean(state.errorMessage));
        memoryIndicator.textContent = state.hasMemory ? "M" : "";
        if (memoryClearButton) memoryClearButton.disabled = !state.hasMemory;
        if (memoryRecallButton) memoryRecallButton.disabled = !state.hasMemory;
      };

      const clearArithmetic = () => {
        state.entry = "0";
        state.accumulator = null;
        state.pendingOperator = null;
        state.lastOperator = null;
        state.lastOperand = null;
        state.replaceEntry = false;
        state.errorMessage = "";
      };

      const clearAll = () => {
        clearArithmetic();
        state.memory = 0;
        state.hasMemory = false;
        render();
      };

      const currentValue = () => Number(state.entry);
      const entryDigitCount = () => state.entry.replace(/[^0-9]/g, "").length;
      const trimExponential = (value) => value
        .replace(/(\.\d*?[1-9])0+e/, "$1e")
        .replace(/\.0+e/, "e")
        .replace("e+", "e+");

      const formatNumber = (value) => {
        if (Object.is(value, -0)) return "0";
        const rounded = Number(Number(value).toPrecision(15));
        const absolute = Math.abs(rounded);
        let formatted = String(rounded);

        if ((absolute >= 1e15 || (absolute > 0 && absolute < 1e-9)) || formatted.length > 16) {
          formatted = trimExponential(rounded.toExponential(9));
        }
        return formatted;
      };

      const fail = (message) => {
        state.errorMessage = message;
        state.accumulator = null;
        state.pendingOperator = null;
        state.lastOperator = null;
        state.lastOperand = null;
        state.replaceEntry = true;
        render();
      };

      const setResult = (value) => {
        if (!Number.isFinite(value)) {
          fail("Overflow");
          return false;
        }
        state.entry = formatNumber(value);
        state.errorMessage = "";
        return true;
      };

      const calculate = (left, right, operator) => {
        let result;
        if (operator === "add") result = left + right;
        if (operator === "subtract") result = left - right;
        if (operator === "multiply") result = left * right;
        if (operator === "divide") {
          if (right === 0) {
            fail("Cannot divide by zero");
            return null;
          }
          result = left / right;
        }
        return Number.isFinite(result) ? result : null;
      };

      const recoverForEntry = () => {
        if (!state.errorMessage) return;
        clearArithmetic();
      };

      const inputDigit = (digit) => {
        recoverForEntry();
        if (state.replaceEntry) {
          if (state.pendingOperator === null) {
            state.accumulator = null;
            state.lastOperator = null;
            state.lastOperand = null;
          }
          state.entry = digit;
          state.replaceEntry = false;
        } else if (state.entry === "0") {
          state.entry = digit;
        } else if (state.entry === "-0") {
          state.entry = `-${digit}`;
        } else if (entryDigitCount() < maximumEntryDigits) {
          state.entry += digit;
        }
        render();
      };

      const inputDecimal = () => {
        recoverForEntry();
        if (state.replaceEntry) {
          if (state.pendingOperator === null) {
            state.accumulator = null;
            state.lastOperator = null;
            state.lastOperand = null;
          }
          state.entry = "0.";
          state.replaceEntry = false;
        } else if (!state.entry.includes(".") && !state.entry.includes("e")) {
          state.entry += ".";
        }
        render();
      };

      const chooseOperator = (operator) => {
        if (state.errorMessage) return;
        const value = currentValue();

        if (state.pendingOperator && !state.replaceEntry) {
          const result = calculate(state.accumulator ?? 0, value, state.pendingOperator);
          if (result === null) {
            if (!state.errorMessage) fail("Overflow");
            return;
          }
          if (!setResult(result)) return;
          state.accumulator = result;
        } else if (state.accumulator === null || !state.pendingOperator) {
          state.accumulator = value;
        }

        state.pendingOperator = operator;
        state.lastOperator = null;
        state.lastOperand = null;
        state.replaceEntry = true;
        render();
      };

      const equals = () => {
        if (state.errorMessage) return;
        let operator = state.pendingOperator;
        let operand = currentValue();
        let left = state.accumulator ?? operand;

        if (!operator && state.lastOperator) {
          operator = state.lastOperator;
          operand = state.lastOperand;
          left = currentValue();
        }
        if (!operator || operand === null) return;

        const result = calculate(left, operand, operator);
        if (result === null) {
          if (!state.errorMessage) fail("Overflow");
          return;
        }
        if (!setResult(result)) return;

        state.accumulator = result;
        state.lastOperator = operator;
        state.lastOperand = operand;
        state.pendingOperator = null;
        state.replaceEntry = true;
        render();
      };

      const clearEntry = () => {
        if (state.errorMessage) {
          clearArithmetic();
        } else {
          state.entry = "0";
          state.replaceEntry = true;
          if (!state.pendingOperator) {
            state.accumulator = null;
            state.lastOperator = null;
            state.lastOperand = null;
          }
        }
        render();
      };

      const backspace = () => {
        if (state.errorMessage || state.replaceEntry) return;
        state.entry = state.entry.length <= 1 || (state.entry.startsWith("-") && state.entry.length === 2)
          ? "0"
          : state.entry.slice(0, -1);
        render();
      };

      const changeSign = () => {
        if (state.errorMessage || currentValue() === 0) return;
        state.entry = state.entry.startsWith("-") ? state.entry.slice(1) : `-${state.entry}`;
        state.replaceEntry = false;
        render();
      };

      const squareRoot = () => {
        if (state.errorMessage) return;
        const value = currentValue();
        if (value < 0) {
          fail("Invalid input");
          return;
        }
        if (!setResult(Math.sqrt(value))) return;
        state.replaceEntry = true;
        render();
      };

      const reciprocal = () => {
        if (state.errorMessage) return;
        const value = currentValue();
        if (value === 0) {
          fail("Cannot divide by zero");
          return;
        }
        if (!setResult(1 / value)) return;
        state.replaceEntry = true;
        render();
      };

      const percent = () => {
        if (state.errorMessage) return;
        const value = currentValue();
        const result = state.pendingOperator === "add" || state.pendingOperator === "subtract"
          ? (state.accumulator ?? 0) * value / 100
          : value / 100;
        if (!setResult(result)) return;
        state.replaceEntry = true;
        render();
      };

      const storeMemory = (operation) => {
        if (operation === "memory-clear") {
          state.memory = 0;
          state.hasMemory = false;
          render();
          return;
        }
        if (operation === "memory-recall") {
          if (!state.hasMemory) return;
          if (state.errorMessage) clearArithmetic();
          state.entry = formatNumber(state.memory);
          state.replaceEntry = true;
          render();
          return;
        }
        if (state.errorMessage) return;

        const value = currentValue();
        if (operation === "memory-store") state.memory = value;
        if (operation === "memory-add") state.memory = (state.hasMemory ? state.memory : 0) + value;
        if (operation === "memory-subtract") state.memory = (state.hasMemory ? state.memory : 0) - value;
        if (!Number.isFinite(state.memory)) {
          fail("Overflow");
          return;
        }
        state.hasMemory = true;
        state.replaceEntry = true;
        render();
      };

      const runAction = (action, value = "") => {
        if (action === "digit") inputDigit(value);
        if (action === "decimal") inputDecimal();
        if (action === "operator") chooseOperator(value);
        if (action === "equals") equals();
        if (action === "clear-entry") clearEntry();
        if (action === "clear") {
          clearArithmetic();
          render();
        }
        if (action === "backspace") backspace();
        if (action === "sign") changeSign();
        if (action === "square-root") squareRoot();
        if (action === "reciprocal") reciprocal();
        if (action === "percent") percent();
        if (action.startsWith("memory-")) storeMemory(action);
      };

      calculatorWindow.addEventListener("click", (event) => {
        const key = event.target.closest("[data-calculator-action]");
        if (!key || !calculatorWindow.contains(key) || key.disabled) return;
        runAction(key.dataset.calculatorAction, key.dataset.calculatorValue ?? "");
      }, { signal: this.#listeners.signal });

      calculatorWindow.addEventListener("calculator:reset", clearAll, {
        signal: this.#listeners.signal
      });

      window.addEventListener("keydown", (event) => {
        if (calculatorWindow.hidden ||
            calculatorWindow.classList.contains("minimized") ||
            !calculatorWindow.classList.contains("active") ||
            event.ctrlKey || event.altKey || event.metaKey ||
            event.target.closest("input, textarea, select, [contenteditable='true']")) return;

        let action = "";
        let value = "";
        if (/^[0-9]$/.test(event.key)) {
          action = "digit";
          value = event.key;
        } else if (event.key === "." || event.key === ",") action = "decimal";
        else if (event.key === "+") {
          action = "operator";
          value = "add";
        } else if (event.key === "-") {
          action = "operator";
          value = "subtract";
        } else if (event.key === "*") {
          action = "operator";
          value = "multiply";
        } else if (event.key === "/") {
          action = "operator";
          value = "divide";
        } else if (event.key === "Enter" || event.key === "=") action = "equals";
        else if (event.key === "Escape") action = "clear";
        else if (event.key === "Delete") action = "clear-entry";
        else if (event.key === "Backspace") action = "backspace";
        else if (event.key === "%") action = "percent";
        else if (event.key === "F9") action = "sign";
        if (!action) return;

        event.preventDefault();
        runAction(action, value);
      }, { signal: this.#listeners.signal });

      clearAll();
    }

    #configureCommandPrompt() {
      const cmdWindow = this.#desktop.querySelector('[data-app-window="cmd"]');
      const terminal = cmdWindow?.querySelector("[data-cmd-terminal]");
      const scrollback = cmdWindow?.querySelector("[data-cmd-scrollback]");
      const currentLine = cmdWindow?.querySelector("[data-cmd-current-line]");
      const prompt = cmdWindow?.querySelector("[data-cmd-prompt]");
      const input = cmdWindow?.querySelector("[data-cmd-input]");
      const measure = cmdWindow?.querySelector("[data-cmd-input-measure]");
      const cursor = cmdWindow?.querySelector("[data-cmd-cursor]");
      const title = cmdWindow?.querySelector("[data-cmd-title]");
      if (!cmdWindow || !terminal || !scrollback || !currentLine || !prompt || !input || !measure || !cursor || !title) return;

      const drivePath = "/Computer/Local Disk (C:)";
      const homePath = `${drivePath}/Users/${USERNAME}`;
      const state = {
        cwd: homePath,
        history: [],
        historyIndex: 0,
        historyDraft: "",
        foreground: "7",
        background: "0",
        running: false,
        session: 0,
        allowAutoScroll: true
      };
      const commandEntries = [];
      const commands = new Map();

      const windowsPath = (fileSystemPath) => {
        if (!fileSystemPath?.startsWith(drivePath)) return "C:\\";
        const remainder = fileSystemPath.slice(drivePath.length).split("/").filter(Boolean);
        return remainder.length > 0 ? `C:\\${remainder.join("\\")}` : "C:\\";
      };
      const promptText = () => `${windowsPath(state.cwd)}>`;
      const isDirectory = (node) => Boolean(node && ["folder", "drive"].includes(node.type));
      const childDirectory = (parentPath, name) => this.#fileSystem.list(parentPath).find((node) =>
        isDirectory(node) && node.name.localeCompare(name, undefined, { sensitivity: "base" }) === 0);
      const resolveCommandPath = (requestedPath, cwd = state.cwd) => {
        let requested = requestedPath.trim().replace(/^\/d\s+/i, "").replaceAll("/", "\\");
        if (!requested || requested === ".") return cwd;

        let path = cwd;
        if (/^[a-z]:/i.test(requested)) {
          if (!/^c:/i.test(requested)) return null;
          path = drivePath;
          requested = requested.slice(2).replace(/^\\+/, "");
        } else if (requested.startsWith("\\")) {
          path = drivePath;
          requested = requested.replace(/^\\+/, "");
        }

        for (const segment of requested.split("\\").filter(Boolean)) {
          if (segment === ".") continue;
          if (segment === "..") {
            if (path !== drivePath) path = this.#fileSystem.resolve(path)?.parentPath ?? drivePath;
            continue;
          }
          const child = childDirectory(path, segment);
          if (!child) return null;
          path = this.#fileSystem.pathFor(child);
        }
        return path;
      };
      const scrollToBottom = (force = false) => {
        if (!force && !state.allowAutoScroll) return;
        terminal.scrollTop = terminal.scrollHeight;
      };
      const appendLine = (text = "", className = "") => {
        const line = createElement("div", {
          className: `cmd-output-line${className ? ` ${className}` : ""}`,
          text
        });
        scrollback.append(line);
        scrollToBottom();
        return line;
      };
      const writeText = (text) => {
        String(text).split("\n").forEach((line) => appendLine(line));
      };
      const updateCursor = () => {
        const caret = input.selectionStart ?? input.value.length;
        measure.textContent = input.value.slice(0, caret) || "";
        const width = measure.getBoundingClientRect().width;
        const available = Math.max(0, input.clientWidth - 8);
        cursor.style.left = `${Math.min(available, Math.max(0, width - input.scrollLeft))}px`;
      };
      const restartCursorBlink = () => {
        cursor.classList.add("is-resetting");
        void cursor.offsetWidth;
        cursor.classList.remove("is-resetting");
        updateCursor();
      };
      const updatePrompt = () => {
        prompt.textContent = promptText();
        requestAnimationFrame(updateCursor);
      };
      const focusInput = () => {
        if (!cmdWindow.hidden && !cmdWindow.classList.contains("minimized") && !state.running) {
          input.focus({ preventScroll: true });
          restartCursorBlink();
        }
      };
      const setTitle = (nextTitle) => {
        const value = nextTitle || CMD_DEFAULT_TITLE;
        title.textContent = value;
        this.#updateWindowTaskLabel(cmdWindow, value);
      };
      const setColor = (pair = "07") => {
        state.background = pair[0];
        state.foreground = pair[1];
        terminal.style.setProperty("--cmd-background", CMD_COLORS[state.background]);
        terminal.style.setProperty("--cmd-foreground", CMD_COLORS[state.foreground]);
      };
      const formatUptime = () => {
        let seconds = Math.max(0, Math.floor((performance.now() - this.#bootedAt) / 1000));
        const days = Math.floor(seconds / 86400);
        seconds %= 86400;
        const hours = Math.floor(seconds / 3600);
        seconds %= 3600;
        const minutes = Math.floor(seconds / 60);
        seconds %= 60;
        const parts = [];
        if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
        if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
        if (minutes) parts.push(`${minutes} min`);
        if (parts.length === 0) parts.push(`${seconds} sec`);
        return parts.join(", ");
      };
      const renderNeofetch = () => {
        const output = createElement("div", { className: "cmd-neofetch cmd-output-line" });
        const logo = createElement("div", { className: "cmd-neofetch__logo", "aria-label": "Windows logo" });
        const addLogoLine = (indent, leftColor, rightColor, width = 7) => {
          const line = createElement("span", { className: "cmd-neofetch__logo-line" });
          line.append(
            document.createTextNode(" ".repeat(indent)),
            createElement("span", { className: `cmd-neofetch__quadrant ${leftColor}`, text: "█".repeat(width) }),
            document.createTextNode("  "),
            createElement("span", { className: `cmd-neofetch__quadrant ${rightColor}`, text: "█".repeat(width) })
          );
          logo.append(line);
        };
        addLogoLine(3, "cmd-neofetch__red", "cmd-neofetch__green", 6);
        addLogoLine(2, "cmd-neofetch__red", "cmd-neofetch__green", 7);
        addLogoLine(1, "cmd-neofetch__red", "cmd-neofetch__green", 8);
        addLogoLine(0, "cmd-neofetch__red", "cmd-neofetch__green", 9);
        logo.append(createElement("span", { className: "cmd-neofetch__logo-line", text: "" }));
        addLogoLine(0, "cmd-neofetch__blue", "cmd-neofetch__yellow", 9);
        addLogoLine(1, "cmd-neofetch__blue", "cmd-neofetch__yellow", 8);
        addLogoLine(2, "cmd-neofetch__blue", "cmd-neofetch__yellow", 7);
        addLogoLine(3, "cmd-neofetch__blue", "cmd-neofetch__yellow", 6);
        const info = createElement("div", { className: "cmd-neofetch__info" });
        const addInfoLine = (label, value, className = "") => {
          const line = createElement("div", { className });
          if (label) {
            line.append(createElement("span", { className: "cmd-neofetch__label", text: `${label}:` }), document.createTextNode(` ${value}`));
          } else {
            line.textContent = value;
          }
          info.append(line);
        };
        addInfoLine("", `${USERNAME.toLocaleLowerCase()}@webos`, "cmd-neofetch__heading");
        addInfoLine("", "-----------------");
        addInfoLine("OS", "Windows 7 Web Edition");
        addInfoLine("Host", HOSTNAME);
        addInfoLine("Kernel", "6.1.7601");
        addInfoLine("Uptime", formatUptime());
        addInfoLine("Shell", "cmd.exe");
        addInfoLine("Resolution", `${window.innerWidth}x${window.innerHeight}`);
        addInfoLine("Theme", "Aero Glass");
        addInfoLine("Icons", "Windows 7 Aero");
        addInfoLine("Terminal", "cmd.exe");
        addInfoLine("CPU", "Virtual CPU");
        addInfoLine("Memory", "768MiB / 2048MiB");
        output.append(logo, info);
        scrollback.append(output);
        scrollToBottom();
      };
      const runMatrix = async (session) => {
        const matrix = createElement("pre", { className: "cmd-matrix cmd-output-line", "aria-label": "Matrix rain animation" });
        scrollback.append(matrix);
        const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZｱｲｳｴｵｶｷｸｹｺ";
        const columns = Math.max(28, Math.min(72, Math.floor(terminal.clientWidth / 8)));
        const rows = 13;
        for (let frame = 0; frame < 12 && session === state.session; frame += 1) {
          const lines = [];
          for (let row = 0; row < rows; row += 1) {
            let line = "";
            for (let column = 0; column < columns; column += 1) {
              const active = (column * 7 + frame * 3 + row) % 17 < 3;
              line += active ? alphabet[Math.floor(Math.random() * alphabet.length)] : " ";
            }
            lines.push(line);
          }
          matrix.textContent = lines.join("\n");
          scrollToBottom();
          await wait(65);
        }
        if (session === state.session) {
          matrix.remove();
          appendLine("Wake up, xDele1ed...", "cmd-konami");
        }
      };
      const formatDirectoryStamp = (date = new Date()) => {
        const two = (value) => String(value).padStart(2, "0");
        let hour = date.getHours();
        const suffix = hour >= 12 ? "PM" : "AM";
        hour = hour % 12 || 12;
        return `${two(date.getMonth() + 1)}/${two(date.getDate())}/${date.getFullYear()}  ${two(hour)}:${two(date.getMinutes())} ${suffix}`;
      };
      const renderDirectory = (cwd, fileSystem) => {
        const items = [...fileSystem.list(cwd)].sort((first, second) => {
          const firstFolder = isDirectory(first);
          const secondFolder = isDirectory(second);
          if (firstFolder !== secondFolder) return firstFolder ? -1 : 1;
          return first.name.localeCompare(second.name, undefined, { sensitivity: "base", numeric: true });
        });
        const lines = [
          " Volume in drive C has no label.",
          " Volume Serial Number is 7A1C-7601",
          "",
          ` Directory of ${windowsPath(cwd)}`,
          ""
        ];
        let fileCount = 0;
        let byteCount = 0;
        let directoryCount = 0;
        if (items.length === 0) lines.push("File Not Found");
        items.forEach((item) => {
          const stamp = formatDirectoryStamp(item.meta?.createdAt instanceof Date ? item.meta.createdAt : new Date());
          if (isDirectory(item)) {
            directoryCount += 1;
            lines.push(`${stamp}    <DIR>          ${item.name}`);
          } else {
            fileCount += 1;
            const size = Number(item.file?.size ?? item.meta?.size ?? 0);
            byteCount += size;
            lines.push(`${stamp}    ${String(size).padStart(14)} ${item.name}`);
          }
        });
        lines.push(
          `${String(fileCount).padStart(15)} File(s) ${byteCount.toLocaleString("en-US").padStart(14)} bytes`,
          `${String(directoryCount).padStart(15)} Dir(s)  2,040,475,648 bytes free`
        );
        return lines.join("\n");
      };
      const renderTree = (cwd, fileSystem) => {
        const lines = ["Folder PATH listing", `Volume serial number is 7A1C-7601`, windowsPath(cwd)];
        const root = fileSystem.resolve(cwd);
        const children = (root?.children ?? []).filter(isDirectory)
          .sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: "base", numeric: true }));
        if (children.length === 0) return `${lines.join("\n")}\nNo subfolders exist.`;
        const walk = (nodes, prefix, depth) => {
          nodes.forEach((node, index) => {
            const last = index === nodes.length - 1;
            lines.push(`${prefix}${last ? "└──" : "├──"} ${node.name}`);
            const nested = (node.children ?? []).filter(isDirectory)
              .sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: "base", numeric: true }));
            if (nested.length === 0) return;
            const nextPrefix = `${prefix}${last ? "    " : "│   "}`;
            if (depth >= 5) lines.push(`${nextPrefix}└── ...`);
            else walk(nested, nextPrefix, depth + 1);
          });
        };
        walk(children, "", 1);
        return lines.join("\n");
      };
      const register = (name, description, usage, detail, handler, { hidden = false, aliases = [] } = {}) => {
        const entry = { name: name.toLocaleLowerCase(), description, usage, detail, handler, hidden };
        commandEntries.push(entry);
        commands.set(entry.name, entry);
        aliases.forEach((alias) => commands.set(alias.toLocaleLowerCase(), entry));
      };

      register("cd", "Displays the name of or changes the current directory.", "CD [drive:][path]", "Type CD without parameters to display the current drive and directory.", (args, cwd) => {
        if (args.length === 0) return windowsPath(cwd);
        const nextPath = resolveCommandPath(args.join(" "), cwd);
        return nextPath ? { cwd: nextPath } : "The system cannot find the path specified.";
      });
      register("cls", "Clears the screen.", "CLS", "Clears all text from the Command Prompt window.", () => ({ clear: true }));
      register("color", "Sets the default console foreground and background colors.", "COLOR [attr]", "ATTR is two hexadecimal digits. The first sets the background; the second sets the foreground.", (args) => {
        if (args.length === 0) return { color: "07" };
        const pair = args[0].toLocaleUpperCase();
        if (!/^[0-9A-F]{2}$/.test(pair) || pair[0] === pair[1]) {
          return "The color command is not supported by this help utility.";
        }
        return { color: pair };
      });
      register("date", "Displays the current date.", "DATE", "Displays the date reported by the Windows 7 Web OS clock.", () => {
        const now = new Date();
        const two = (value) => String(value).padStart(2, "0");
        return `The current date is: ${two(now.getMonth() + 1)}/${two(now.getDate())}/${now.getFullYear()}`;
      });
      register("dir", "Displays a list of files and subdirectories in a directory.", "DIR", "Displays files and subdirectories in the current directory.", (_args, cwd, fileSystem) => renderDirectory(cwd, fileSystem));
      register("echo", "Displays messages.", "ECHO [message]", "Displays the supplied message on the next line.", (args) => args.length ? args.join(" ") : "ECHO is on.");
      register("exit", "Quits the CMD.EXE program.", "EXIT", "Closes the current Command Prompt window.", () => ({ close: true }));
      register("help", "Provides Help information for Windows commands.", "HELP [command]", "Type HELP command for detailed information about a command.", (args) => {
        if (args.length > 0) {
          const entry = commands.get(args[0].toLocaleLowerCase());
          if (!entry || entry.hidden) return "This command is not supported by the help utility.";
          return `${entry.usage}\n\n${entry.detail}`;
        }
        return commandEntries
          .filter((entry) => !entry.hidden)
          .sort((first, second) => first.name.localeCompare(second.name))
          .map((entry) => `${entry.name.toLocaleUpperCase().padEnd(10)} ${entry.description}`)
          .join("\n");
      });
      register("hostname", "Prints the name of the current host.", "HOSTNAME", "Displays the host name portion of the computer name.", () => HOSTNAME);
      register("mkdir", "Creates a directory.", "MKDIR [drive:]path", "Creates the specified directory. MD is an alias for MKDIR.", (args, cwd, fileSystem) => {
        const requestedName = args.join(" ").trim();
        if (!requestedName || /[<>:"/\\|?*]/.test(requestedName) || [".", ".."].includes(requestedName)) {
          return "The syntax of the command is incorrect.";
        }
        if (fileSystem.list(cwd).some(({ name }) => name.localeCompare(requestedName, undefined, { sensitivity: "base" }) === 0)) {
          return `A subdirectory or file ${requestedName} already exists.`;
        }
        return fileSystem.create(cwd, "folder", requestedName)
          ? ""
          : "The system cannot find the path specified.";
      }, { aliases: ["md"] });
      register("time", "Displays the current time.", "TIME", "Displays the time reported by the Windows 7 Web OS clock.", () => {
        const now = new Date();
        const two = (value) => String(value).padStart(2, "0");
        const hundredths = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, "0");
        return `The current time is: ${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}.${hundredths}`;
      });
      register("title", "Sets the window title for the CMD.EXE session.", "TITLE [string]", "Sets the title shown in the Command Prompt title bar and taskbar button.", (args) => ({ title: args.join(" ") }));
      register("tree", "Graphically displays the folder structure of a drive or path.", "TREE", "Displays the current directory tree to a maximum depth of five levels.", (_args, cwd, fileSystem) => renderTree(cwd, fileSystem));
      register("ver", "Displays the Windows version.", "VER", "Displays the Windows version number.", () => CMD_VERSION);
      register("whoami", "Displays user, group, and privileges information.", "WHOAMI", "Displays the current domain and user name.", () => `${HOSTNAME.toLocaleLowerCase()}\\${USERNAME.toLocaleLowerCase()}`);
      register("neofetch", "", "NEOFETCH", "", () => ({ rich: "neofetch" }), { hidden: true });
      register("matrix", "", "MATRIX", "", () => ({ animation: "matrix" }), { hidden: true });
      register("konami", "", "KONAMI", "", () => ({ text: "↑ ↑ ↓ ↓ ← → ← → B A  —  Achievement unlocked: Still got it.", className: "cmd-konami" }), { hidden: true });
      register("sudo", "", "SUDO", "", () => "'sudo' is not recognized as a Windows command. This isn't Linux.", { hidden: true });
      register("starwars", "", "STARWARS", "", () => "A long time ago, on a Telnet server far, far away...\nNo network connection. The Force will have to do.", { hidden: true });

      const applyResult = async (result, session) => {
        if (result === undefined || result === null || result === "") return true;
        if (typeof result === "string") {
          writeText(result);
          return true;
        }
        if (result.clear) scrollback.replaceChildren();
        if (result.cwd) state.cwd = result.cwd;
        if (Object.hasOwn(result, "title")) setTitle(result.title);
        if (result.color) setColor(result.color);
        if (result.rich === "neofetch") renderNeofetch();
        if (Object.hasOwn(result, "text")) appendLine(result.text, result.className);
        if (result.animation === "matrix") await runMatrix(session);
        if (result.close) {
          this.#closeWindow(cmdWindow);
          return false;
        }
        return session === state.session;
      };
      const finishCommand = () => {
        state.running = false;
        cmdWindow.classList.remove("is-command-running");
        currentLine.hidden = false;
        input.disabled = false;
        input.value = "";
        updatePrompt();
        scrollToBottom(true);
        requestAnimationFrame(focusInput);
      };
      const submit = async () => {
        if (state.running) return;
        const raw = input.value.replace(/[\r\n]+/g, " ");
        state.allowAutoScroll = true;
        appendLine(`${promptText()}${raw}`);
        input.value = "";
        currentLine.hidden = true;
        scrollToBottom(true);

        const trimmed = raw.trim();
        if (!trimmed) {
          finishCommand();
          return;
        }
        state.history.push(raw);
        state.historyIndex = state.history.length;
        state.historyDraft = "";
        const parts = trimmed.split(/\s+/);
        const commandName = parts.shift();
        const entry = commands.get(commandName.toLocaleLowerCase());
        if (!entry) {
          writeText(`'${commandName}' is not recognized as an internal or external command,\noperable program or batch file.`);
          finishCommand();
          return;
        }

        state.running = true;
        cmdWindow.classList.add("is-command-running");
        input.disabled = true;
        const session = state.session;
        try {
          const result = await entry.handler(parts, state.cwd, this.#fileSystem);
          const shouldContinue = await applyResult(result, session);
          if (shouldContinue && session === state.session) finishCommand();
        } catch (error) {
          console.error(`Command Prompt command failed: ${commandName}`, error);
          if (session === state.session) {
            appendLine("The command could not be completed.");
            finishCommand();
          }
        }
      };
      const interrupt = () => {
        state.session += 1;
        state.running = false;
        cmdWindow.classList.remove("is-command-running");
        currentLine.hidden = false;
        input.disabled = false;
        appendLine(`${promptText()}${input.value}^C`);
        input.value = "";
        state.historyIndex = state.history.length;
        state.historyDraft = "";
        state.allowAutoScroll = true;
        updatePrompt();
        scrollToBottom(true);
        requestAnimationFrame(focusInput);
      };
      const recallHistory = (direction) => {
        if (state.history.length === 0) return;
        if (state.historyIndex === state.history.length) state.historyDraft = input.value;
        state.historyIndex = Math.min(state.history.length, Math.max(0, state.historyIndex + direction));
        input.value = state.historyIndex === state.history.length ? state.historyDraft : state.history[state.historyIndex];
        input.setSelectionRange(input.value.length, input.value.length);
        restartCursorBlink();
      };
      const resetSession = () => {
        state.session += 1;
        state.cwd = this.#fileSystem.resolve(homePath) ? homePath : drivePath;
        state.history.length = 0;
        state.historyIndex = 0;
        state.historyDraft = "";
        state.running = false;
        state.allowAutoScroll = true;
        cmdWindow.classList.remove("is-command-running");
        currentLine.hidden = false;
        input.disabled = false;
        input.value = "";
        scrollback.replaceChildren();
        setTitle(CMD_DEFAULT_TITLE);
        setColor("07");
        appendLine(CMD_VERSION);
        appendLine("Copyright (c) 2009 Microsoft Corporation.  All rights reserved.");
        appendLine();
        updatePrompt();
        scrollToBottom(true);
      };

      input.addEventListener("keydown", (event) => {
        if (event.ctrlKey && event.key.toLocaleLowerCase() === "c") {
          event.preventDefault();
          interrupt();
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          void submit();
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          recallHistory(-1);
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          recallHistory(1);
          return;
        }
        requestAnimationFrame(restartCursorBlink);
      }, { signal: this.#listeners.signal });
      input.addEventListener("input", () => {
        if (/[\r\n]/.test(input.value)) input.value = input.value.replace(/[\r\n]+/g, " ");
        state.historyIndex = state.history.length;
        restartCursorBlink();
      }, { signal: this.#listeners.signal });
      input.addEventListener("click", restartCursorBlink, { signal: this.#listeners.signal });
      input.addEventListener("select", updateCursor, { signal: this.#listeners.signal });
      input.addEventListener("scroll", updateCursor, { signal: this.#listeners.signal });
      document.addEventListener("selectionchange", () => {
        if (document.activeElement === input) updateCursor();
      }, { signal: this.#listeners.signal });
      terminal.addEventListener("scroll", () => {
        state.allowAutoScroll = terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight < 4;
      }, { signal: this.#listeners.signal });
      terminal.addEventListener("pointerdown", (event) => {
        if (event.target === terminal || event.target.closest("[data-cmd-current-line]")) requestAnimationFrame(focusInput);
      }, { signal: this.#listeners.signal });
      cmdWindow.addEventListener("cmd:reset", () => {
        resetSession();
        requestAnimationFrame(focusInput);
      }, { signal: this.#listeners.signal });
      cmdWindow.addEventListener("cmd:close", () => {
        state.session += 1;
        state.running = false;
      }, { signal: this.#listeners.signal });

      resetSession();
    }

    #configureDesktopItems() {
      this.#desktopIconLayer = createElement("div", {
        "data-desktop-icons": "",
        role: "grid",
        "aria-label": "Desktop items"
      }, {
        position: "absolute",
        zIndex: "1",
        inset: `0 0 ${TASKBAR_HEIGHT}px 0`,
        margin: "0",
        padding: "0",
        overflow: "hidden",
        background: "transparent",
        border: "0",
        borderRadius: "0",
        boxShadow: "none",
        userSelect: "none"
      });
      this.#desktopFileInput = createElement("input", {
        type: "file",
        multiple: true,
        hidden: true,
        "aria-label": "Upload files to desktop"
      });
      this.#desktop.append(this.#desktopIconLayer, this.#desktopFileInput);

      this.#fileSystemUnsubscribe?.();
      this.#fileSystemUnsubscribe = this.#fileSystem.subscribe(() => {
        this.#renderDesktopItems();
        this.#renderAllExplorerWindows();
        this.#scheduleProfileSave();
      });
      this.#renderDesktopItems();
      this.#desktopMarquee = new DesktopSelectionMarquee(
        this.#desktopIconLayer,
        this.#desktopSelectionState,
        {
          onStart: () => this.#clearDesktopSelection(),
          onChange: (marqueeRect) => this.#updateMarqueeSelection(marqueeRect)
        }
      );

      this.#desktopIconLayer.addEventListener("pointerdown", (event) => {
        const icon = event.target.closest("[data-desktop-item-id]");
        if (!icon || !event.isPrimary || event.button !== 0) return;

        const itemId = icon.dataset.desktopItemId;
        const item = this.#fileSystem.desktopItems.find(({ id }) => id === itemId);
        if (!item) return;
        const clickTime = performance.now();
        const isDoubleClick = this.#lastDesktopClick.itemId === itemId && clickTime - this.#lastDesktopClick.time < 500;
        this.#lastDesktopClick = { itemId, time: clickTime };
        if (isDoubleClick) {
          this.#lastDesktopClick = { itemId: null, time: 0 };
          this.#cancelDesktopItemDrag();
          this.#openDesktopItem(itemId);
          event.preventDefault();
          return;
        }
        if (event.ctrlKey || event.metaKey) {
          item.isSelected = !item.isSelected;
          this.#selectedDesktopItemId = item.isSelected
            ? item.id
            : this.#fileSystem.desktopItems.find(({ isSelected }) => isSelected)?.id ?? null;
          this.#syncDesktopSelectionStyles();
          if (!item.isSelected) return;
        } else if (!item.isSelected) {
          this.#selectDesktopItem(itemId);
        } else {
          this.#selectedDesktopItemId = itemId;
        }
        this.#closeDesktopContextMenu();
        if (!event.target.closest("input")) this.#beginDesktopItemDrag(event, icon, itemId);
      }, { signal: this.#listeners.signal });
      this.#desktopIconLayer.addEventListener("pointermove", (event) => {
        this.#updateDesktopItemDrag(event);
      }, { signal: this.#listeners.signal });
      this.#desktopIconLayer.addEventListener("pointerup", (event) => {
        this.#endDesktopItemDrag(event);
      }, { signal: this.#listeners.signal });
      this.#desktopIconLayer.addEventListener("pointercancel", (event) => {
        this.#endDesktopItemDrag(event);
      }, { signal: this.#listeners.signal });

      this.#desktop.addEventListener("contextmenu", (event) => {
        if (event.target.closest(".window, [data-taskbar], [data-desktop-context-menu]")) return;

        event.preventDefault();
        const icon = event.target.closest("[data-desktop-item-id]");
        const itemId = icon?.dataset.desktopItemId ?? null;
        const item = this.#fileSystem.desktopItems.find(({ id }) => id === itemId);
        if (itemId && !item?.isSelected) this.#selectDesktopItem(itemId);
        else if (itemId) this.#selectedDesktopItemId = itemId;
        else this.#selectDesktopItem(null);

        const desktopRect = this.#desktop.getBoundingClientRect();
        this.#contextMenuPoint = {
          x: Math.max(0, event.clientX - desktopRect.left),
          y: Math.max(0, event.clientY - desktopRect.top)
        };
        this.#openDesktopContextMenu(event.clientX, event.clientY, itemId);
      }, { signal: this.#listeners.signal });
      this.#desktop.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || event.target.closest(".window, [data-taskbar], [data-desktop-item-id], [data-desktop-context-menu]")) return;
        this.#selectDesktopItem(null);
        this.#closeDesktopContextMenu();
      }, { signal: this.#listeners.signal });

      document.addEventListener("pointerdown", (event) => {
        if (this.#desktopContextMenu && !this.#desktopContextMenu.contains(event.target)) {
          this.#closeDesktopContextMenu();
        }
      }, { capture: true, signal: this.#listeners.signal });
      document.addEventListener("keydown", (event) => {
        const editingText = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
        const desktopHasFocus = !event.target.closest?.(".window, [data-taskbar], [data-start-menu]");
        const selectedDeletableItems = this.#fileSystem.desktopItems.filter(({ isSelected, permanent, parentId }) =>
          isSelected && !permanent && parentId === null);
        if (event.key === "Delete" && !editingText && desktopHasFocus && selectedDeletableItems.length > 0) {
          event.preventDefault();
          this.#deleteDesktopItems(selectedDeletableItems.map(({ id }) => id));
        }
        if (event.key === "F2" && !editingText && desktopHasFocus && this.#selectedDesktopItemId) {
          event.preventDefault();
          this.#beginDesktopRename(this.#selectedDesktopItemId);
        }
        if (event.key === "Escape") this.#closeDesktopContextMenu();
      }, { signal: this.#listeners.signal });
      window.addEventListener("resize", () => {
        this.#closeDesktopContextMenu();
        this.#constrainDesktopItems();
      }, { signal: this.#listeners.signal });

      this.#desktopFileInput.addEventListener("change", () => {
        const files = [...(this.#desktopFileInput.files ?? [])];
        files.forEach((file, index) => {
          this.#addDesktopItem("upload", file.name, file, {
            x: this.#contextMenuPoint.x + index * 18,
            y: this.#contextMenuPoint.y + index * 18
          }, false);
        });
        this.#desktopFileInput.value = "";
      }, { signal: this.#listeners.signal });
    }

    #desktopIconMetrics() {
      return {
        large: { image: 64, width: 102, height: 100 },
        medium: { image: 48, width: 88, height: 86 },
        small: { image: 32, width: 76, height: 68 }
      }[this.#desktopIconSize];
    }

    #renderDesktopItems() {
      if (!this.#desktopIconLayer) return;
      if (this.#desktopAutoArrange) this.#arrangeDesktopItems();

      const fragment = document.createDocumentFragment();
      this.#fileSystem.desktopItems
        .filter(({ parentId }) => parentId === null)
        .forEach((item) => fragment.append(this.#createDesktopIcon(item)));
      this.#desktopIconLayer.querySelectorAll("[data-desktop-item-id]").forEach((icon) => icon.remove());
      const marquee = this.#desktopIconLayer.querySelector(".desktop-selection-marquee");
      this.#desktopIconLayer.insertBefore(fragment, marquee);
    }

    #createDesktopIcon(item) {
      const metrics = this.#desktopIconMetrics();
      const selected = Boolean(item.isSelected || item.isDropTarget);
      const icon = createElement("div", {
        className: `desktop-icon${selected ? " is-selected" : ""}`,
        tabIndex: 0,
        role: "gridcell",
        "aria-label": item.name,
        "aria-selected": String(Boolean(item.isSelected)),
        "data-desktop-item-id": item.id,
        title: item.name
      }, {
        position: "absolute",
        left: `${item.x}px`,
        top: `${item.y}px`,
        width: `${metrics.width}px`,
        minHeight: `${metrics.height}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxSizing: "border-box",
        padding: "5px 3px 4px",
        color: "#fff",
        borderRadius: "2px",
        touchAction: "none",
        cursor: `url("${ASSETS.cursorArrow}") 4 2, default`,
        outline: "none",
        willChange: "transform"
      });
      const image = createElement("img", {
        src: this.#desktopItemIcon(item),
        alt: "",
        draggable: false
      }, {
        width: `${metrics.image}px`,
        height: `${metrics.image}px`,
        objectFit: "contain",
        pointerEvents: "none",
        filter: "drop-shadow(0 1px 1px rgba(0, 0, 0, 0.55))"
      });
      if (this.#isImageFile(item)) {
        image.addEventListener("error", () => { image.src = ASSETS.imageFileFallback; }, { once: true });
      }
      const label = createElement("span", {
        text: item.name,
        "data-desktop-item-label": ""
      }, {
        display: "-webkit-box",
        maxWidth: "100%",
        marginTop: "3px",
        padding: "1px 3px",
        overflow: "hidden",
        color: "#fff",
        fontSize: "12px",
        lineHeight: "15px",
        textAlign: "center",
        textOverflow: "ellipsis",
        textShadow: "1px 1px 2px #000, -1px -1px 2px rgba(0, 0, 0, 0.45)",
        overflowWrap: "anywhere",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: "2",
        pointerEvents: "none"
      });

      icon.append(image, label);
      return icon;
    }

    #isImageFile(item) {
      if (!item || ["folder", "drive", "dvd", "computer", "recycle", "shortcut", "app-shortcut", "virtual"].includes(item.type)) return false;
      const mimeType = String(item.file?.type || item.meta?.mimeType || "").toLocaleLowerCase();
      if (mimeType.startsWith("image/")) return true;
      return /\.(?:png|jpe?g|gif|bmp|webp)$/i.test(item?.name ?? "");
    }

    #isTextFile(item) {
      if (!item || ["folder", "drive", "dvd", "computer", "recycle", "shortcut", "app-shortcut", "virtual"].includes(item.type)) return false;
      const mimeType = String(item.file?.type || item.meta?.mimeType || "").toLocaleLowerCase();
      if (mimeType.startsWith("text/")) return true;
      return /\.(?:txt|log|md|csv|json|xml|ini|css|js|html?)$/i.test(item?.name ?? "");
    }

    #desktopItemIcon(item) {
      if (item.type === "recycle") {
        return this.#fileSystem.recycleItems.length > 0 ? ASSETS.recycleFull : ASSETS.recycleEmpty;
      }
      if (item.icon) return item.icon;
      if (item.type === "computer") return ASSETS.computer;
      if (item.type === "drive") return ASSETS.systemDrive;
      if (item.type === "dvd") return ASSETS.dvdDrive;
      if (item.type === "folder") {
        return item.children.length > 0 ? ASSETS.folderFull : ASSETS.folderEmpty;
      }
      if (this.#isImageFile(item)) return ASSETS.imageFile;
      return ASSETS.textFile;
    }

    #selectDesktopItem(itemId) {
      this.#fileSystem.desktopItems.forEach((item) => {
        item.isSelected = item.id === itemId;
      });
      this.#selectedDesktopItemId = itemId;
      this.#syncDesktopSelectionStyles();
    }

    #clearDesktopSelection() {
      this.#fileSystem.desktopItems.forEach((item) => {
        item.isSelected = false;
      });
      this.#selectedDesktopItemId = null;
      this.#syncDesktopSelectionStyles();
    }

    #syncDesktopSelectionStyles() {
      this.#desktopIconLayer?.querySelectorAll("[data-desktop-item-id]").forEach((icon) => {
        const item = this.#fileSystem.desktopItems.find(({ id }) => id === icon.dataset.desktopItemId);
        const selected = Boolean(item?.isSelected);
        icon.setAttribute("aria-selected", String(selected));
        icon.classList.toggle("is-selected", Boolean(selected || item?.isDropTarget));
      });
    }

    #updateMarqueeSelection(marqueeRect) {
      if (!marqueeRect || !this.#desktopIconLayer) return;

      const elementById = new Map(
        [...this.#desktopIconLayer.querySelectorAll("[data-desktop-item-id]")]
          .map((element) => [element.dataset.desktopItemId, element])
      );
      let firstSelectedId = null;

      this.#fileSystem.desktopItems.forEach((item) => {
        if (item.parentId !== null) return;
        const element = elementById.get(item.id);
        if (!element) return;

        const iconRect = element.getBoundingClientRect();
        const intersects = this.#rectanglesIntersect(marqueeRect, iconRect);
        item.isSelected = intersects;
        element.setAttribute("aria-selected", String(intersects));
        element.classList.toggle("is-selected", intersects || item.isDropTarget);
        if (intersects && firstSelectedId === null) firstSelectedId = item.id;
      });
      this.#selectedDesktopItemId = firstSelectedId;
    }

    #beginDesktopItemDrag(event, element, itemId) {
      const layerRect = this.#desktopIconLayer.getBoundingClientRect();
      const selectedItems = this.#fileSystem.desktopItems.filter(({ isSelected, parentId }) =>
        isSelected && parentId === null);
      const entries = selectedItems.map((item) => {
        const itemElement = this.#desktopIconLayer.querySelector(
          `[data-desktop-item-id="${CSS.escape(item.id)}"]`
        );
        return itemElement ? {
          item,
          element: itemElement,
          initialX: item.x,
          initialY: item.y,
          rect: itemElement.getBoundingClientRect()
        } : null;
      }).filter(Boolean);
      const leadEntry = entries.find(({ item }) => item.id === itemId);
      if (!leadEntry || entries.length === 0) return;

      const selectedIds = new Set(entries.map(({ item }) => item.id));
      const groupMinX = Math.min(...entries.map(({ initialX }) => initialX));
      const groupMinY = Math.min(...entries.map(({ initialY }) => initialY));
      const groupMaxRight = Math.max(...entries.map(({ initialX, rect }) => initialX + rect.width));
      const groupMaxBottom = Math.max(...entries.map(({ initialY, rect }) => initialY + rect.height));
      const hasDroppableItems = entries.some(({ item }) => !item.permanent);
      const dropTargets = hasDroppableItems ? this.#fileSystem.desktopItems
        .filter((candidate) => candidate.parentId === null &&
          !selectedIds.has(candidate.id) &&
          (candidate.type === "folder" || candidate.type === "recycle"))
        .map((candidate) => {
          const targetElement = this.#desktopIconLayer.querySelector(
            `[data-desktop-item-id="${CSS.escape(candidate.id)}"]`
          );
          return targetElement ? {
            item: candidate,
            element: targetElement,
            rect: targetElement.getBoundingClientRect()
          } : null;
        })
        .filter(Boolean) : [];
      this.#desktopItemDrag = {
        pointerId: event.pointerId,
        captureElement: element,
        entries,
        leadEntry,
        startMouseX: event.clientX,
        startMouseY: event.clientY,
        pendingDeltaX: 0,
        pendingDeltaY: 0,
        minDeltaX: -groupMinX,
        maxDeltaX: layerRect.width - groupMaxRight,
        minDeltaY: -groupMinY,
        maxDeltaY: layerRect.height - groupMaxBottom,
        dropTargets,
        hoverTargetId: null,
        crossTarget: null
      };
      element.setPointerCapture(event.pointerId);
      document.body.style.userSelect = "none";
      event.preventDefault();
    }

    #updateDesktopItemDrag(event) {
      const drag = this.#desktopItemDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const deltaX = event.clientX - drag.startMouseX;
      const deltaY = event.clientY - drag.startMouseY;
      drag.pendingDeltaX = Math.min(drag.maxDeltaX, Math.max(drag.minDeltaX, deltaX));
      drag.pendingDeltaY = Math.min(drag.maxDeltaY, Math.max(drag.minDeltaY, deltaY));
      this.#updateDesktopDropTarget(drag, event);
      if (this.#desktopItemDragFrame === 0) {
        this.#desktopItemDragFrame = requestAnimationFrame(() => {
          this.#desktopItemDragFrame = 0;
          if (!this.#desktopItemDrag) return;
          const { pendingDeltaX, pendingDeltaY } = this.#desktopItemDrag;
          this.#desktopItemDrag.entries.forEach(({ element: itemElement }) => {
            itemElement.style.transform = `translate3d(${pendingDeltaX}px, ${pendingDeltaY}px, 0)`;
          });
        });
      }
    }

    #endDesktopItemDrag(event) {
      const drag = this.#desktopItemDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;

      cancelAnimationFrame(this.#desktopItemDragFrame);
      this.#desktopItemDragFrame = 0;
      const dropTarget = this.#fileSystem.desktopItems.find(({ id }) => id === drag.hoverTargetId);

      drag.entries.forEach(({ element: itemElement }) => {
        itemElement.style.transform = "none";
      });
      if (drag.captureElement.hasPointerCapture(drag.pointerId)) {
        drag.captureElement.releasePointerCapture(drag.pointerId);
      }
      this.#desktopItemDrag = null;
      this.#setDesktopDropTarget(null);
      this.#setShellDropHighlight(null);
      document.body.style.userSelect = "";

      const movableItems = drag.entries
        .map(({ item }) => item)
        .filter(({ permanent }) => !permanent);

      if (drag.crossTarget?.kind === "taskbar") {
        drag.entries.forEach(({ item }) => this.#pinShellItem(item));
        this.#renderDesktopItems();
      } else if (drag.crossTarget?.kind === "explorer-path" && movableItems.length > 0) {
        this.#fileSystem.move(movableItems, drag.crossTarget.path);
        this.#clearDesktopSelection();
      } else if (drag.crossTarget) {
        this.#renderDesktopItems();
      } else if (dropTarget?.type === "recycle" && movableItems.length > 0) {
        this.#deleteDesktopItems(movableItems.map(({ id }) => id));
      } else if (dropTarget?.type === "folder") {
        this.#moveDesktopItemsIntoFolder(movableItems, dropTarget);
      } else if (this.#desktopAutoArrange) {
        this.#renderDesktopItems();
      } else {
        let finalDeltaX = drag.pendingDeltaX;
        let finalDeltaY = drag.pendingDeltaY;
        if (this.#desktopAlignToGrid) {
          const snappedLead = this.#snapDesktopPoint({
            x: drag.leadEntry.initialX + finalDeltaX,
            y: drag.leadEntry.initialY + finalDeltaY
          });
          finalDeltaX = Math.min(drag.maxDeltaX, Math.max(
            drag.minDeltaX,
            snappedLead.x - drag.leadEntry.initialX
          ));
          finalDeltaY = Math.min(drag.maxDeltaY, Math.max(
            drag.minDeltaY,
            snappedLead.y - drag.leadEntry.initialY
          ));
        }
        const availableDelta = this.#findAvailableDesktopDragDelta(
          drag,
          finalDeltaX,
          finalDeltaY
        );
        finalDeltaX = availableDelta.x;
        finalDeltaY = availableDelta.y;
        drag.entries.forEach((entry) => {
          entry.item.x = entry.initialX + finalDeltaX;
          entry.item.y = entry.initialY + finalDeltaY;
        });
        this.#renderDesktopItems();
        this.#scheduleProfileSave();
      }
    }

    #findAvailableDesktopDragDelta(drag, preferredDeltaX, preferredDeltaY) {
      const metrics = this.#desktopIconMetrics();
      const draggedIds = new Set(drag.entries.map(({ item }) => item.id));
      const occupiedItems = this.#fileSystem.desktopItems.filter(({ id, parentId }) =>
        parentId === null && !draggedIds.has(id));
      const clampDeltaX = (value) => Math.min(drag.maxDeltaX, Math.max(drag.minDeltaX, value));
      const clampDeltaY = (value) => Math.min(drag.maxDeltaY, Math.max(drag.minDeltaY, value));
      const preferredX = clampDeltaX(preferredDeltaX);
      const preferredY = clampDeltaY(preferredDeltaY);
      const isAvailable = (deltaX, deltaY) => drag.entries.every((entry) => {
        const candidate = {
          left: entry.initialX + deltaX,
          right: entry.initialX + deltaX + metrics.width,
          top: entry.initialY + deltaY,
          bottom: entry.initialY + deltaY + metrics.height
        };
        return occupiedItems.every((item) => !this.#rectanglesIntersect(candidate, {
          left: item.x,
          right: item.x + metrics.width,
          top: item.y,
          bottom: item.y + metrics.height
        }));
      });

      if (isAvailable(preferredX, preferredY)) return { x: preferredX, y: preferredY };

      const candidateXs = new Set([preferredX, clampDeltaX(0)]);
      const candidateYs = new Set([preferredY, clampDeltaY(0)]);

      if (this.#desktopAlignToGrid) {
        const lead = drag.leadEntry;
        const layerWidth = this.#desktopIconLayer?.clientWidth ?? window.innerWidth;
        const layerHeight = this.#desktopIconLayer?.clientHeight ?? window.innerHeight - TASKBAR_HEIGHT;
        for (let x = 10; x <= layerWidth - metrics.width; x += metrics.width) {
          candidateXs.add(clampDeltaX(x - lead.initialX));
        }
        for (let y = 10; y <= layerHeight - metrics.height; y += metrics.height) {
          candidateYs.add(clampDeltaY(y - lead.initialY));
        }
      } else {
        candidateXs.add(drag.minDeltaX);
        candidateXs.add(drag.maxDeltaX);
        candidateYs.add(drag.minDeltaY);
        candidateYs.add(drag.maxDeltaY);
        occupiedItems.forEach((item) => {
          drag.entries.forEach((entry) => {
            candidateXs.add(clampDeltaX(item.x - metrics.width - entry.initialX));
            candidateXs.add(clampDeltaX(item.x + metrics.width - entry.initialX));
            candidateYs.add(clampDeltaY(item.y - metrics.height - entry.initialY));
            candidateYs.add(clampDeltaY(item.y + metrics.height - entry.initialY));
          });
        });
      }

      const candidates = [];
      candidateXs.forEach((x) => candidateYs.forEach((y) => candidates.push({ x, y })));
      candidates.sort((first, second) =>
        ((first.x - preferredX) ** 2 + (first.y - preferredY) ** 2) -
        ((second.x - preferredX) ** 2 + (second.y - preferredY) ** 2));
      return candidates.find(({ x, y }) => isAvailable(x, y)) ?? { x: 0, y: 0 };
    }

    #cancelDesktopItemDrag() {
      if (!this.#desktopItemDrag) return;
      cancelAnimationFrame(this.#desktopItemDragFrame);
      this.#desktopItemDragFrame = 0;
      this.#desktopItemDrag.entries.forEach(({ element: itemElement }) => {
        itemElement.style.transform = "none";
      });
      this.#desktopItemDrag = null;
      this.#setDesktopDropTarget(null);
      this.#setShellDropHighlight(null);
      document.body.style.userSelect = "";
    }

    #updateDesktopDropTarget(drag, event) {
      const draggedItems = drag.entries.map(({ item }) => item);
      const crossTarget = this.#resolveShellDropTarget(event.clientX, event.clientY, {
        kind: "desktop",
        nodes: draggedItems
      });
      if (crossTarget) {
        drag.crossTarget = crossTarget;
        drag.hoverTargetId = null;
        this.#setDesktopDropTarget(null);
        this.#setShellDropHighlight(crossTarget.valid === false ? null : crossTarget.element);
        return;
      }
      drag.crossTarget = null;
      this.#setShellDropHighlight(null);

      const { pendingDeltaX: deltaX, pendingDeltaY: deltaY } = drag;
      const sourceRect = drag.leadEntry.rect;
      const draggedRect = {
        left: sourceRect.left + deltaX,
        right: sourceRect.right + deltaX,
        top: sourceRect.top + deltaY,
        bottom: sourceRect.bottom + deltaY
      };
      let bestTarget = null;
      let bestIntersectionArea = 0;

      drag.dropTargets.forEach((target) => {
        if (!this.#rectanglesIntersect(draggedRect, target.rect)) return;
        const overlapWidth = Math.min(draggedRect.right, target.rect.right) -
          Math.max(draggedRect.left, target.rect.left);
        const overlapHeight = Math.min(draggedRect.bottom, target.rect.bottom) -
          Math.max(draggedRect.top, target.rect.top);
        const area = overlapWidth * overlapHeight;
        if (area > bestIntersectionArea) {
          bestIntersectionArea = area;
          bestTarget = target;
        }
      });

      const nextTargetId = bestTarget?.item.id ?? null;
      if (drag.hoverTargetId !== nextTargetId) {
        drag.hoverTargetId = nextTargetId;
        this.#setDesktopDropTarget(nextTargetId);
      }
    }

    #setDesktopDropTarget(itemId) {
      this.#fileSystem.desktopItems.forEach((item) => {
        item.isDropTarget = item.id === itemId;
      });
      this.#syncDesktopSelectionStyles();
    }

    #rectanglesIntersect(first, second) {
      return first.left < second.right &&
        first.right > second.left &&
        first.top < second.bottom &&
        first.bottom > second.top;
    }

    #setShellDropHighlight(element) {
      if (this.#shellDropHighlight === element) return;
      this.#shellDropHighlight?.classList.remove("is-shell-drop-target");
      this.#shellDropHighlight = element ?? null;
      this.#shellDropHighlight?.classList.add("is-shell-drop-target");
    }

    #resolveShellDropTarget(clientX, clientY, source) {
      const hit = document.elementFromPoint(clientX, clientY);
      if (!hit) return { kind: "invalid", valid: false, element: null };

      const taskbar = hit.closest("[data-taskbar]");
      if (taskbar) {
        const canPin = source.kind === "start" || (source.nodes?.length ?? 0) > 0;
        return { kind: canPin ? "taskbar" : "invalid", valid: canPin, element: taskbar };
      }

      const explorerWindow = hit.closest(".explorer-window");
      if (explorerWindow) {
        const state = this.#explorerWindows.get(explorerWindow.id);
        const itemElement = hit.closest("[data-explorer-item-id]");
        const place = hit.closest("[data-explorer-place]");
        let path = place?.dataset.explorerPlace ?? state?.path ?? null;
        if (itemElement && state) {
          const item = this.#findExplorerItem(state, itemElement.dataset.explorerItemId);
          if (item?.targetPath) path = item.targetPath;
          else if (["folder", "drive"].includes(item?.type)) path = this.#fileSystem.pathFor(item);
          else path = null;
        }
        const targetNode = path ? this.#fileSystem.resolve(path) : null;
        const nodes = source.nodes ?? [];
        const canMove = source.kind !== "start" &&
          Boolean(targetNode && ["folder", "drive"].includes(targetNode.type) && !targetNode.meta?.systemFolder) &&
          !["/Quick Access", "/Computer", "/Recycle Bin"].includes(path) &&
          nodes.some((node) => {
            if (!node || node.permanent || node.parentPath === path) return false;
            const sourcePath = this.#fileSystem.pathFor(node);
            return sourcePath !== path && !path.startsWith(`${sourcePath}/`);
          });
        const targetElement = itemElement ?? place ?? hit.closest("[data-explorer-content]") ?? explorerWindow;
        return {
          kind: canMove ? "explorer-path" : "invalid",
          valid: canMove,
          element: targetElement,
          path,
          state
        };
      }

      const desktopItem = hit.closest("[data-desktop-item-id]");
      if (source.kind === "explorer" && desktopItem) {
        const target = this.#fileSystem.desktopItems.find(({ id }) => id === desktopItem.dataset.desktopItemId);
        if (target?.type === "folder") {
          const path = this.#fileSystem.pathFor(target);
          const canMove = source.nodes.some((node) => {
            const sourcePath = this.#fileSystem.pathFor(node);
            return !node.permanent && node.parentPath !== path && !path.startsWith(`${sourcePath}/`);
          });
          return { kind: canMove ? "explorer-path" : "invalid", valid: canMove, element: desktopItem, path };
        }
      }

      const desktopRect = this.#desktopIconLayer?.getBoundingClientRect();
      const overDesktop = desktopRect &&
        clientX >= desktopRect.left && clientX <= desktopRect.right &&
        clientY >= desktopRect.top && clientY <= desktopRect.bottom &&
        !hit.closest(".window, .start-menu, [data-taskbar]");
      if (overDesktop && source.kind !== "desktop") {
        return { kind: "desktop", valid: true, element: this.#desktopIconLayer };
      }
      if (overDesktop && source.kind === "desktop") return null;

      if (hit.closest(".window, .start-menu")) {
        return { kind: "invalid", valid: false, element: null };
      }
      return null;
    }

    #beginShellDrag(event, { kind, sourceElement, sourceState = null, nodes = [], appName = null, name, icon }) {
      if (this.#shellDrag || this.#desktopItemDrag || !event.isPrimary || event.button !== 0) return;
      this.#shellDrag = {
        pointerId: event.pointerId,
        kind,
        sourceElement,
        sourceState,
        nodes,
        appName,
        name,
        icon,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        ghost: null,
        target: null
      };
      sourceElement.setPointerCapture(event.pointerId);
    }

    #updateShellDrag(event) {
      const drag = this.#shellDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (!drag.active && Math.hypot(deltaX, deltaY) < 6) return;
      event.preventDefault();
      if (!drag.active) {
        drag.active = true;
        drag.ghost = this.#createShellDragGhost(drag.icon, drag.name);
        this.#desktop.append(drag.ghost);
        document.body.style.userSelect = "none";
      }

      assignStyles(drag.ghost, {
        left: `${Math.min(window.innerWidth - 88, event.clientX + 14)}px`,
        top: `${Math.min(window.innerHeight - 84, event.clientY + 16)}px`
      });
      drag.target = this.#resolveShellDropTarget(event.clientX, event.clientY, drag);
      const valid = Boolean(drag.target?.valid !== false && drag.target);
      drag.ghost.classList.toggle("is-invalid", !valid);
      this.#setShellDropHighlight(valid ? drag.target.element : null);
    }

    #endShellDrag(event) {
      const drag = this.#shellDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const completedDrag = drag.active;
      const target = drag.target?.valid === false ? null : drag.target;

      if (completedDrag && target) {
        if (drag.kind === "start" && target.kind === "desktop") {
          this.#createAppShortcut(drag.appName, event.clientX, event.clientY);
        } else if (drag.kind === "start" && target.kind === "taskbar") {
          this.#pinShellItem(this.#appShortcutDescriptor(drag.appName));
        } else if (drag.kind === "explorer" && target.kind === "desktop") {
          this.#moveNodesToDesktop(drag.nodes, event.clientX, event.clientY);
          drag.sourceState?.selectedIds.clear();
          if (drag.sourceState) this.#renderExplorerWindow(drag.sourceState);
        } else if (drag.kind === "explorer" && target.kind === "explorer-path") {
          this.#fileSystem.move(drag.nodes, target.path);
          drag.sourceState?.selectedIds.clear();
          if (drag.sourceState) this.#renderExplorerWindow(drag.sourceState);
        } else if (drag.kind === "explorer" && target.kind === "taskbar") {
          drag.nodes.forEach((node) => this.#pinShellItem(node));
        }
      }

      if (completedDrag) {
        this.#suppressShellClick(drag.sourceElement);
        if (drag.kind === "start") this.#dismissStartMenuAfterDrag();
      }
      this.#releaseShellDrag(drag);
    }

    #cancelShellDrag() {
      if (!this.#shellDrag) return;
      this.#releaseShellDrag(this.#shellDrag);
    }

    #releaseShellDrag(drag) {
      this.#shellDrag = null;
      drag.ghost?.remove();
      if (drag.sourceElement?.hasPointerCapture?.(drag.pointerId)) {
        drag.sourceElement.releasePointerCapture(drag.pointerId);
      }
      this.#setShellDropHighlight(null);
      document.body.style.userSelect = "";
    }

    #createShellDragGhost(icon, name) {
      const ghost = createElement("div", { className: "shell-drag-ghost", "aria-hidden": "true" });
      ghost.append(
        createElement("img", { src: icon || ASSETS.textFile, alt: "", draggable: false }),
        createElement("span", { text: name || "Item" })
      );
      return ghost;
    }

    #suppressShellClick(sourceElement) {
      window.clearTimeout(this.#suppressedShellClickTimer);
      this.#suppressedShellClickTarget = sourceElement;
      this.#suppressedShellClickTimer = window.setTimeout(() => {
        this.#suppressedShellClickTarget = null;
      }, 0);
    }

    #consumeSuppressedShellClick(event) {
      if (!this.#suppressedShellClickTarget?.contains(event.target)) return false;
      event.preventDefault();
      event.stopPropagation();
      this.#suppressedShellClickTarget = null;
      window.clearTimeout(this.#suppressedShellClickTimer);
      return true;
    }

    #dismissStartMenuAfterDrag() {
      if (!this.#startMenu) return;
      this.#startMenu.classList.remove("is-open", "is-visible");
      this.#startMenu.setAttribute("aria-hidden", "true");
      this.#taskbar?.querySelector("[data-start-button]")?.setAttribute("aria-expanded", "false");
    }

    #appShortcutDescriptor(appName) {
      const app = APP_SHORTCUTS[appName];
      if (!app) return null;
      return {
        id: `app-shortcut-${appName}`,
        type: "app-shortcut",
        name: app.name,
        icon: app.icon,
        permanent: false,
        meta: { appName }
      };
    }

    #createAppShortcut(appName, clientX, clientY) {
      const descriptor = this.#appShortcutDescriptor(appName);
      if (!descriptor || !this.#desktopIconLayer) return null;
      const rect = this.#desktopIconLayer.getBoundingClientRect();
      const point = this.#findAvailableDesktopPoint({
        x: clientX - rect.left - this.#desktopIconMetrics().width / 2,
        y: clientY - rect.top - this.#desktopIconMetrics().height / 2
      });
      this.#clearDesktopSelection();
      const shortcut = this.#fileSystem.create("/Desktop", "app-shortcut", descriptor.name, {
        icon: descriptor.icon,
        meta: descriptor.meta,
        ...point
      });
      if (shortcut) {
        shortcut.isSelected = true;
        this.#selectedDesktopItemId = shortcut.id;
        this.#renderDesktopItems();
      }
      return shortcut;
    }

    #moveNodesToDesktop(nodes, clientX, clientY) {
      const movable = nodes.filter(({ permanent }) => !permanent);
      if (!movable.length || !this.#desktopIconLayer) return;
      const rect = this.#desktopIconLayer.getBoundingClientRect();
      if (!this.#fileSystem.move(movable, "/Desktop")) return;
      movable.forEach((node, index) => {
        const point = this.#findAvailableDesktopPoint({
          x: clientX - rect.left - this.#desktopIconMetrics().width / 2 + index * 18,
          y: clientY - rect.top - this.#desktopIconMetrics().height / 2 + index * 18
        }, node.id);
        node.x = point.x;
        node.y = point.y;
        node.isSelected = index === 0;
      });
      this.#selectedDesktopItemId = movable[0]?.id ?? null;
      this.#renderDesktopItems();
    }

    #moveDesktopItemsIntoFolder(items, folder) {
      this.#fileSystem.move(items, this.#fileSystem.pathFor(folder));
      this.#fileSystem.desktopItems.forEach((item) => {
        item.isSelected = false;
        item.isDropTarget = false;
      });
      this.#selectedDesktopItemId = null;
      this.#renderDesktopItems();
    }

    #addDesktopItem(type, requestedName, file = null, preferredPoint = null, beginRename = true) {
      const point = this.#findAvailableDesktopPoint(preferredPoint ?? this.#contextMenuPoint);
      this.#fileSystem.desktopItems.forEach((existingItem) => {
        existingItem.isSelected = false;
        existingItem.isDropTarget = false;
      });
      const item = this.#fileSystem.create("/Desktop", type, requestedName, { file, ...point });
      if (!item) return null;
      item.isSelected = true;
      this.#selectedDesktopItemId = item.id;
      this.#renderDesktopItems();
      if (beginRename) requestAnimationFrame(() => this.#beginDesktopRename(item.id));
      return item;
    }

    #uniqueDesktopName(requestedName, type, excludedId = null) {
      return this.#fileSystem.uniqueName("/Desktop", requestedName, type, excludedId);
    }

    #findAvailableDesktopPoint(preferredPoint, excludedId = null) {
      const metrics = this.#desktopIconMetrics();
      const rawMaxX = Math.max(0, (this.#desktopIconLayer?.clientWidth ?? window.innerWidth) - metrics.width);
      const rawMaxY = Math.max(0, (this.#desktopIconLayer?.clientHeight ?? window.innerHeight) - metrics.height);
      const maxX = this.#desktopAlignToGrid && rawMaxX >= 10
        ? 10 + Math.floor((rawMaxX - 10) / metrics.width) * metrics.width
        : rawMaxX;
      const maxY = this.#desktopAlignToGrid && rawMaxY >= 10
        ? 10 + Math.floor((rawMaxY - 10) / metrics.height) * metrics.height
        : rawMaxY;
      const initial = this.#desktopAlignToGrid
        ? this.#snapDesktopPoint(preferredPoint)
        : preferredPoint;
      let x = Math.min(maxX, Math.max(0, initial.x));
      let y = Math.min(maxY, Math.max(0, initial.y));
      const visibleItems = this.#fileSystem.desktopItems.filter(({ id, parentId }) =>
        parentId === null && id !== excludedId);

      for (let attempt = 0; attempt < 120; attempt += 1) {
        const occupied = visibleItems.some((item) => this.#rectanglesIntersect(
          { left: x, right: x + metrics.width, top: y, bottom: y + metrics.height },
          {
            left: item.x,
            right: item.x + metrics.width,
            top: item.y,
            bottom: item.y + metrics.height
          }
        ));
        if (!occupied) return { x, y };
        y += metrics.height;
        if (y > maxY) {
          y = 10;
          x = Math.min(maxX, x + metrics.width);
        }
      }
      return { x, y };
    }

    #snapDesktopPoint(point) {
      const metrics = this.#desktopIconMetrics();
      const rawMaxX = Math.max(0, (this.#desktopIconLayer?.clientWidth ?? window.innerWidth) - metrics.width);
      const rawMaxY = Math.max(0, (this.#desktopIconLayer?.clientHeight ?? window.innerHeight) - metrics.height);
      const maxX = rawMaxX >= 10 ? 10 + Math.floor((rawMaxX - 10) / metrics.width) * metrics.width : rawMaxX;
      const maxY = rawMaxY >= 10 ? 10 + Math.floor((rawMaxY - 10) / metrics.height) * metrics.height : rawMaxY;
      const gridX = 10 + Math.round((point.x - 10) / metrics.width) * metrics.width;
      const gridY = 10 + Math.round((point.y - 10) / metrics.height) * metrics.height;
      return {
        x: Math.min(maxX, Math.max(0, gridX)),
        y: Math.min(maxY, Math.max(0, gridY))
      };
    }

    #beginDesktopRename(itemId) {
      const item = this.#fileSystem.desktopItems.find(({ id }) => id === itemId);
      const icon = this.#desktopIconLayer?.querySelector(`[data-desktop-item-id="${CSS.escape(itemId)}"]`);
      const label = icon?.querySelector("[data-desktop-item-label]");
      if (!item || !icon || !label || item.permanent) return;

      const input = createElement("input", {
        type: "text",
        value: item.name,
        "aria-label": "Rename desktop item"
      }, {
        width: "100%",
        marginTop: "3px",
        boxSizing: "border-box",
        padding: "1px 2px",
        fontSize: "12px",
        lineHeight: "16px",
        textAlign: "center",
        cursor: "text",
        userSelect: "text"
      });
      const originalName = item.name;
      let cancelled = false;
      const finish = () => {
        const requested = cancelled ? originalName : input.value.trim() || originalName;
        if (!cancelled) this.#fileSystem.rename(item, requested);
        this.#renderDesktopItems();
        this.#selectDesktopItem(item.id);
      };

      input.addEventListener("pointerdown", (event) => event.stopPropagation(), {
        signal: this.#listeners.signal
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
        if (event.key === "Escape") {
          cancelled = true;
          input.blur();
        }
      }, { signal: this.#listeners.signal });
      input.addEventListener("blur", finish, { once: true, signal: this.#listeners.signal });

      label.replaceWith(input);
      input.focus();
      const extensionIndex = item.type === "text" ? item.name.toLocaleLowerCase().lastIndexOf(".txt") : -1;
      input.setSelectionRange(0, extensionIndex > 0 ? extensionIndex : input.value.length);
    }

    #arrangeDesktopItems() {
      const metrics = this.#desktopIconMetrics();
      const availableHeight = this.#desktopIconLayer?.clientHeight ?? window.innerHeight - TASKBAR_HEIGHT;
      const rows = Math.max(1, Math.floor((availableHeight - 12) / metrics.height));
      this.#fileSystem.desktopItems
        .filter(({ parentId }) => parentId === null)
        .forEach((item, index) => {
          item.x = 10 + Math.floor(index / rows) * metrics.width;
          item.y = 10 + (index % rows) * metrics.height;
        });
    }

    #constrainDesktopItems() {
      if (!this.#desktopIconLayer) return;
      if (this.#desktopAutoArrange) {
        this.#renderDesktopItems();
        return;
      }
      const metrics = this.#desktopIconMetrics();
      const maxX = Math.max(0, this.#desktopIconLayer.clientWidth - metrics.width);
      const maxY = Math.max(0, this.#desktopIconLayer.clientHeight - metrics.height);
      this.#fileSystem.desktopItems.filter(({ parentId }) => parentId === null).forEach((item) => {
        const constrained = this.#desktopAlignToGrid
          ? this.#findAvailableDesktopPoint({ x: item.x, y: item.y }, item.id)
          : {
              x: Math.min(maxX, Math.max(0, item.x)),
              y: Math.min(maxY, Math.max(0, item.y))
            };
        item.x = constrained.x;
        item.y = constrained.y;
      });
      this.#renderDesktopItems();
    }

    #openDesktopContextMenu(clientX, clientY, itemId) {
      this.#closeTrayFlyout();
      this.#closeDesktopContextMenu();
      const items = itemId ? this.#desktopItemMenu(itemId) : this.#desktopBackgroundMenu();
      const menu = this.#createContextMenu(items);
      this.#desktopContextMenu = menu;
      this.#desktop.append(menu);

      const rect = menu.getBoundingClientRect();
      const left = Math.max(4, Math.min(window.innerWidth - rect.width - 4, Math.max(4, clientX)));
      const top = Math.max(4, Math.min(window.innerHeight - TASKBAR_HEIGHT - rect.height - 4, Math.max(4, clientY)));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.focus({ preventScroll: true });
    }

    #desktopBackgroundMenu() {
      return [
        { label: "View", submenu: [
          { label: "Large icons", checked: this.#desktopIconSize === "large", action: () => this.#setDesktopIconSize("large") },
          { label: "Medium icons", checked: this.#desktopIconSize === "medium", action: () => this.#setDesktopIconSize("medium") },
          { label: "Small icons", checked: this.#desktopIconSize === "small", action: () => this.#setDesktopIconSize("small") },
          { separator: true },
          { label: "Auto arrange icons", checked: this.#desktopAutoArrange, action: () => {
            this.#desktopAutoArrange = !this.#desktopAutoArrange;
            this.#renderDesktopItems();
            this.#scheduleProfileSave();
          } },
          { label: "Align icons to grid", checked: this.#desktopAlignToGrid, action: () => {
            this.#desktopAlignToGrid = !this.#desktopAlignToGrid;
            this.#constrainDesktopItems();
            this.#scheduleProfileSave();
          } }
        ] },
        { label: "Sort by", submenu: [
          { label: "Name", action: () => this.#sortDesktopItems("name") },
          { label: "Item type", action: () => this.#sortDesktopItems("type") }
        ] },
        { label: "Refresh", action: () => this.#refreshDesktopIcons() },
        { separator: true },
        { label: "Copy", disabled: !this.#selectedDesktopItemId, action: () => this.#copyDesktopItem(this.#selectedDesktopItemId) },
        { label: "Paste", disabled: !this.#shellClipboard, action: () => this.#pasteDesktopItem() },
        { label: "Paste shortcut", disabled: true },
        { separator: true },
        { label: "Upload files here", action: () => this.#desktopFileInput?.click() },
        { label: "New", submenu: [
          { label: "Folder", icon: ASSETS.folderEmpty, action: () => this.#addDesktopItem("folder", "New Folder") },
          { label: "Text Document", icon: ASSETS.textFile, action: () => this.#addDesktopItem("text", "New Text Document.txt") }
        ] },
        { separator: true },
        { label: "Screen Resolution / Display", icon: ASSETS.contextDisplay, action: () => this.#openControlPanel("display") },
        { label: "Gadgets", icon: ASSETS.contextGadgets, action: () => this.#emitDesktopPlaceholder("gadgets") },
        { label: "Personalize", icon: ASSETS.contextPersonalize, action: () => this.#openControlPanel("themes") }
      ];
    }

    #desktopItemMenu(itemId) {
      const item = this.#fileSystem.desktopItems.find(({ id }) => id === itemId);
      if (!item) return [];
      if (item.type === "recycle") {
        return [
          { label: "Open", action: () => this.#openDesktopItem(item.id) },
          { label: "Empty Recycle Bin", disabled: this.#fileSystem.recycleItems.length === 0, action: () => {
            this.#fileSystem.emptyRecycleBin();
          } },
          { separator: true },
          { label: "Properties", action: () => this.#showShellItemProperties(item) }
        ];
      }
      if (item.type === "computer") {
        return [
          { label: "Open", action: () => this.#openDesktopItem(item.id) },
          { separator: true },
          { label: "Properties", action: () => this.#showShellItemProperties(item) }
        ];
      }
      return [
        { label: "Open", action: () => this.#openDesktopItem(item.id) },
        { separator: true },
        { label: "Cut", action: () => this.#copyDesktopItem(item.id, "cut") },
        { label: "Copy", action: () => this.#copyDesktopItem(item.id, "copy") },
        { label: "Delete", action: () => this.#deleteDesktopItem(item.id) },
        { label: "Rename", action: () => requestAnimationFrame(() => this.#beginDesktopRename(item.id)) },
        { separator: true },
        { label: "Properties", action: () => this.#showShellItemProperties(item) }
      ];
    }

    #createContextMenu(items, isSubmenu = false) {
      const menu = createElement("div", {
        role: "menu",
        tabIndex: -1,
        "data-desktop-context-menu": ""
      }, {
        position: isSubmenu ? "absolute" : "fixed",
        zIndex: "2147483646",
        minWidth: "205px",
        boxSizing: "border-box",
        padding: "3px",
        color: "#111",
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
        fontSize: "12px",
        background: "#f0f0f0",
        border: "1px solid #979797",
        boxShadow: "3px 3px 7px rgba(0, 0, 0, 0.42)"
      });

      items.forEach((descriptor) => {
        if (descriptor.separator) {
          menu.append(createElement("div", { role: "separator" }, {
            height: "1px",
            margin: "3px 2px 3px 27px",
            background: "#d7d7d7",
            borderTop: "1px solid #fff"
          }));
          return;
        }
        menu.append(this.#createContextMenuItem(descriptor));
      });
      return menu;
    }

    #createContextMenuItem(descriptor) {
      const item = createElement("div", {
        role: "menuitem",
        tabIndex: descriptor.disabled ? -1 : 0,
        "aria-disabled": String(Boolean(descriptor.disabled))
      }, {
        position: "relative",
        minHeight: "23px",
        display: "grid",
        gridTemplateColumns: "23px 1fr 14px",
        alignItems: "center",
        boxSizing: "border-box",
        padding: "1px 3px",
        color: descriptor.disabled ? "#888" : "#111",
        border: "1px solid transparent",
        whiteSpace: "nowrap",
        cursor: descriptor.disabled ? `url("${ASSETS.cursorUnavailable}") 24 24, not-allowed` : `url("${ASSETS.cursorLink}") 6 2, pointer`,
        outline: "none"
      });
      const marker = createElement("span", {
        text: descriptor.checked ? "✓" : ""
      }, {
        width: "18px",
        height: "18px",
        display: "grid",
        placeItems: "center",
        fontWeight: "700"
      });
      if (descriptor.icon) {
        marker.replaceChildren(createElement("img", {
          src: descriptor.icon,
          alt: "",
          draggable: false
        }, {
          width: "16px",
          height: "16px",
          objectFit: "contain"
        }));
      }
      const label = createElement("span", { text: descriptor.label });
      const arrow = createElement("span", { text: descriptor.submenu ? "▶" : "" }, {
        fontSize: "9px",
        textAlign: "right"
      });
      item.append(marker, label, arrow);

      let submenu = null;
      if (descriptor.submenu) {
        submenu = this.#createContextMenu(descriptor.submenu, true);
        assignStyles(submenu, {
          display: "none",
          left: "calc(100% - 2px)",
          top: "-4px"
        });
        item.append(submenu);
      }
      const activateVisual = () => {
        if (descriptor.disabled) return;
        item.style.color = "#111";
        item.style.border = "1px solid rgba(0, 120, 215, 0.32)";
        item.style.background = "rgba(0, 120, 215, 0.14)";
        if (submenu) {
          submenu.style.display = "block";
          requestAnimationFrame(() => {
            const submenuRect = submenu.getBoundingClientRect();
            if (submenuRect.right > window.innerWidth - 3) submenu.style.left = `${-submenuRect.width + 3}px`;
          });
        }
      };
      const clearVisual = () => {
        item.style.color = descriptor.disabled ? "#888" : "#111";
        item.style.border = "1px solid transparent";
        item.style.background = "transparent";
        if (submenu) submenu.style.display = "none";
      };
      item.addEventListener("pointerenter", activateVisual, { signal: this.#listeners.signal });
      item.addEventListener("pointerleave", clearVisual, { signal: this.#listeners.signal });
      item.addEventListener("focus", activateVisual, { signal: this.#listeners.signal });
      item.addEventListener("blur", (event) => {
        if (!item.contains(event.relatedTarget)) clearVisual();
      }, { signal: this.#listeners.signal });
      if (!descriptor.disabled && !submenu) {
        const activate = () => {
          this.#closeDesktopContextMenu();
          descriptor.action?.();
        };
        item.addEventListener("click", activate, { signal: this.#listeners.signal });
        item.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
          }
        }, { signal: this.#listeners.signal });
      }
      return item;
    }

    #closeDesktopContextMenu() {
      this.#desktopContextMenu?.remove();
      this.#desktopContextMenu = null;
    }

    #setDesktopIconSize(size) {
      this.#desktopIconSize = size;
      this.#constrainDesktopItems();
      this.#scheduleProfileSave();
    }

    #sortDesktopItems(property) {
      this.#fileSystem.desktopItems.sort((a, b) => {
        if (a.permanent !== b.permanent) return a.permanent ? -1 : 1;
        return String(a[property]).localeCompare(String(b[property]), undefined, { sensitivity: "base" });
      });
      this.#desktopAutoArrange = true;
      this.#renderDesktopItems();
      this.#scheduleProfileSave();
    }

    #refreshDesktopIcons() {
      if (!this.#desktopIconLayer) return;

      window.clearTimeout(this.#desktopRefreshTimer);
      this.#desktopIconLayer.style.transition = "none";
      this.#desktopIconLayer.style.opacity = "1";
      this.#desktopIconLayer.querySelectorAll("[data-desktop-item-id]").forEach((icon) => {
        icon.style.visibility = "hidden";
      });
      this.#desktopRefreshTimer = window.setTimeout(() => {
        if (!this.#desktopIconLayer) return;
        this.#desktopIconLayer.querySelectorAll("[data-desktop-item-id]").forEach((icon) => {
          icon.style.visibility = "visible";
        });
        this.#desktopRefreshTimer = 0;
      }, 70);
    }

    #copyDesktopItem(itemId, operation = "copy") {
      const item = this.#fileSystem.desktopItems.find(({ id }) => id === itemId);
      if (!item || item.permanent) return;
      this.#shellClipboard = { operation, nodes: [item] };
    }

    #pasteDesktopItem() {
      if (!this.#shellClipboard) return;
      const { operation, nodes } = this.#shellClipboard;
      if (operation === "cut") {
        this.#fileSystem.move(nodes, "/Desktop");
        this.#shellClipboard = null;
      } else {
        const copies = this.#fileSystem.copy(nodes, "/Desktop");
        copies.forEach((item, index) => {
          const point = this.#findAvailableDesktopPoint({
            x: this.#contextMenuPoint.x + index * 18,
            y: this.#contextMenuPoint.y + index * 18
          });
          item.x = point.x;
          item.y = point.y;
        });
      }
      this.#renderDesktopItems();
    }

    #deleteDesktopItem(itemId) {
      this.#deleteDesktopItems([itemId]);
    }

    #deleteDesktopItems(itemIds) {
      const requestedIds = new Set(itemIds);
      const items = this.#fileSystem.desktopItems.filter(({ id, permanent }) =>
        requestedIds.has(id) && !permanent);
      if (items.length === 0) return;
      this.#fileSystem.trash(items);
      this.#fileSystem.desktopItems.forEach((item) => {
        item.isSelected = false;
        item.isDropTarget = false;
      });
      this.#selectedDesktopItemId = null;
      this.#renderDesktopItems();
    }

    #emitDesktopPlaceholder(action) {
      this.#desktop.dispatchEvent(new CustomEvent("windows7:desktopaction", {
        detail: { action }
      }));
    }

    #openDesktopItem(itemId) {
      const item = this.#fileSystem.desktopItems.find(({ id }) => id === itemId);
      this.#openShellItem(item);
    }

    #openShellItem(item) {
      if (!item) return;
      if (item.type === "app-shortcut" && APP_SHORTCUTS[item.meta?.appName]) {
        this.#openAppWindow(item.meta.appName);
        return;
      }
      if (item.targetPath) {
        this.#openExplorer(item.targetPath);
        return;
      }
      if (["folder", "drive"].includes(item.type)) {
        this.#openExplorer(this.#fileSystem.pathFor(item));
        return;
      }
      if (this.#isImageFile(item)) {
        this.#openImageFile(item);
        return;
      }
      if (this.#isTextFile(item)) {
        this.#openTextFile(item);
        return;
      }
      this.#showShellItemProperties(item);
    }

    #openImageFile(item) {
      this.#openAppWindow("photo-viewer", { preserveDocument: true });
      this.#photoViewerApp?.open(item);
    }

    #openTextFile(item) {
      const notepadWindow = this.#desktop.querySelector('[data-app-window="notepad"]');
      if (!notepadWindow) return;
      this.#openAppWindow("notepad", { preserveDocument: true });
      void this.#notepadApp?.open(item);
    }

    #openExplorer(startPath = "/Quick Access") {
      const template = this.#desktop.querySelector("[data-explorer-template]");
      const windowElement = template?.content.firstElementChild?.cloneNode(true);
      if (!windowElement || !this.#fileSystem.resolve(startPath)) return null;

      const id = `explorer-window-${++this.#explorerSequence}`;
      windowElement.id = id;
      const controller = new AbortController();
      const state = {
        id,
        element: windowElement,
        controller,
        path: startPath,
        currentNode: this.#fileSystem.resolve(startPath),
        back: [],
        forward: [],
        search: "",
        sort: "name",
        selectedIds: new Set(),
        marquee: null,
        selectionState: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, bounds: null }
      };

      this.#desktop.append(windowElement);
      void openAeroWindow(windowElement);
      this.#initializeExplorerWindowElement(windowElement);
      this.#explorerWindows.set(id, state);
      this.#bindExplorerWindow(state);
      this.#renderExplorerWindow(state);
      this.#ensureTaskButton(windowElement);
      this.#raiseWindow(windowElement);
      windowElement.focus({ preventScroll: true });
      this.#playNavigationStart();
      return state;
    }

    #initializeExplorerWindowElement(windowElement) {
      const desktopWidth = this.#desktop.clientWidth || window.innerWidth;
      const desktopHeight = this.#desktop.clientHeight || window.innerHeight;
      const width = Math.min(900, Math.max(560, desktopWidth - 84));
      const height = Math.min(610, Math.max(370, desktopHeight - TASKBAR_HEIGHT - 70));
      const cascade = ((this.#explorerSequence - 1) % 8) * 22;
      assignStyles(windowElement, {
        position: "absolute",
        zIndex: "100",
        left: `${Math.max(0, (desktopWidth - width) / 2 + cascade)}px`,
        top: `${Math.max(0, (desktopHeight - TASKBAR_HEIGHT - height) / 2 + cascade)}px`,
        width: `${width}px`,
        height: `${height}px`,
        minWidth: `${Math.min(540, desktopWidth)}px`,
        minHeight: `${Math.min(340, Math.max(1, desktopHeight - TASKBAR_HEIGHT))}px`,
        maxWidth: "100%",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        willChange: "transform"
      });
      const body = windowElement.querySelector(".window-body");
      if (body) assignStyles(body, { flex: "1", overflow: "hidden" });
      const titleBar = windowElement.querySelector(".title-bar");
      if (titleBar) assignStyles(titleBar, {
        flex: "0 0 auto",
        touchAction: "none",
        cursor: `url("${ASSETS.cursorMove}") 24 24, move`
      });
      windowElement.querySelectorAll("button").forEach((button) => {
        button.style.cursor = `url("${ASSETS.cursorLink}") 6 2, pointer`;
      });
      this.#configureResizeHandles(windowElement);
    }

    #bindExplorerWindow(state) {
      const { element, controller } = state;
      const signal = controller.signal;
      const content = element.querySelector("[data-explorer-content]");

      element.querySelector("[data-explorer-back]")?.addEventListener("click", () => {
        const path = state.back.pop();
        if (!path) return;
        state.forward.push(state.path);
        this.#navigateExplorer(state, path, { recordHistory: false });
      }, { signal });
      element.querySelector("[data-explorer-forward]")?.addEventListener("click", () => {
        const path = state.forward.pop();
        if (!path) return;
        state.back.push(state.path);
        this.#navigateExplorer(state, path, { recordHistory: false });
      }, { signal });
      element.querySelector("[data-explorer-up]")?.addEventListener("click", () => {
        const parentPath = this.#explorerParentPath(state.path);
        if (parentPath) this.#navigateExplorer(state, parentPath);
      }, { signal });
      element.querySelector("[data-explorer-refresh]")?.addEventListener("click", () => {
        content?.classList.add("is-refreshing");
        this.#renderExplorerWindow(state);
        requestAnimationFrame(() => content?.classList.remove("is-refreshing"));
      }, { signal });
      element.querySelector("[data-explorer-search]")?.addEventListener("input", (event) => {
        state.search = event.currentTarget.value;
        state.selectedIds.clear();
        this.#renderExplorerWindow(state);
      }, { signal });
      element.querySelectorAll("[data-explorer-place]").forEach((button) => {
        button.addEventListener("click", () => this.#navigateExplorer(state, button.dataset.explorerPlace), { signal });
      });
      element.querySelector("[data-explorer-dvd]")?.addEventListener("click", () => {
        this.#playCriticalStop();
        this.#showExplorerMessage(state, "DVD Drive", "Not accessible.", ASSETS.accessDenied);
      }, { signal });
      element.querySelector("[data-explorer-breadcrumb]")?.addEventListener("click", (event) => {
        const crumb = event.target.closest("[data-explorer-crumb]");
        if (crumb) this.#navigateExplorer(state, crumb.dataset.explorerCrumb);
      }, { signal });

      content?.addEventListener("pointerdown", (event) => {
        const itemElement = event.target.closest("[data-explorer-item-id]");
        if (!itemElement || event.ctrlKey || event.metaKey || event.target.closest("input")) return;
        const itemId = itemElement.dataset.explorerItemId;
        if (!state.selectedIds.has(itemId)) {
          state.selectedIds.clear();
          state.selectedIds.add(itemId);
          this.#syncExplorerSelection(state);
        }
        const nodes = [...state.selectedIds]
          .map((id) => this.#findExplorerItem(state, id))
          .filter((item) => item && !item.permanent);
        const lead = this.#findExplorerItem(state, itemId);
        if (!lead || nodes.length === 0) return;
        this.#beginShellDrag(event, {
          kind: "explorer",
          sourceElement: itemElement,
          sourceState: state,
          nodes,
          name: nodes.length > 1 ? `${nodes.length} items` : lead.name,
          icon: this.#fileSystemItemIcon(lead)
        });
      }, { signal });
      content?.addEventListener("click", (event) => {
        if (this.#consumeSuppressedShellClick(event)) return;
        const itemElement = event.target.closest("[data-explorer-item-id]");
        if (!itemElement) {
          state.selectedIds.clear();
          this.#syncExplorerSelection(state);
          return;
        }
        const itemId = itemElement.dataset.explorerItemId;
        if (event.ctrlKey || event.metaKey) {
          if (state.selectedIds.has(itemId)) state.selectedIds.delete(itemId);
          else state.selectedIds.add(itemId);
        } else {
          state.selectedIds.clear();
          state.selectedIds.add(itemId);
        }
        this.#syncExplorerSelection(state);
      }, { signal });
      content?.addEventListener("dblclick", (event) => {
        const itemElement = event.target.closest("[data-explorer-item-id]");
        if (!itemElement) return;
        event.preventDefault();
        this.#openExplorerItem(state, itemElement.dataset.explorerItemId);
      }, { signal });
      content?.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        const itemElement = event.target.closest("[data-explorer-item-id]");
        if (itemElement && !state.selectedIds.has(itemElement.dataset.explorerItemId)) {
          state.selectedIds.clear();
          state.selectedIds.add(itemElement.dataset.explorerItemId);
          this.#syncExplorerSelection(state);
        } else if (!itemElement) {
          state.selectedIds.clear();
          this.#syncExplorerSelection(state);
        }
        this.#openExplorerContextMenu(state, event.clientX, event.clientY, itemElement?.dataset.explorerItemId ?? null);
      }, { signal });
      content?.addEventListener("keydown", (event) => {
        if (event.target instanceof HTMLInputElement) return;
        if (event.key === "F2" && state.selectedIds.size === 1) {
          event.preventDefault();
          this.#beginExplorerRename(state, [...state.selectedIds][0]);
        }
        if (event.key === "Delete" && state.selectedIds.size > 0) {
          event.preventDefault();
          this.#deleteExplorerSelection(state);
        }
        if (event.key === "Enter" && state.selectedIds.size === 1) {
          event.preventDefault();
          this.#openExplorerItem(state, [...state.selectedIds][0]);
        }
      }, { signal });
    }

    #navigateExplorer(state, path, { recordHistory = true, sound = true } = {}) {
      const node = this.#fileSystem.resolve(path);
      if (!node || path === state.path) return false;
      if (node.type === "dvd" || node.meta.systemFolder) {
        this.#playCriticalStop();
        this.#showExplorerMessage(state, node.name, "Not accessible.", ASSETS.accessDenied);
        return false;
      }
      if (recordHistory) {
        state.back.push(state.path);
        state.forward.length = 0;
      }
      state.path = path;
      state.currentNode = node;
      state.search = "";
      state.selectedIds.clear();
      const search = state.element.querySelector("[data-explorer-search]");
      if (search) search.value = "";
      this.#renderExplorerWindow(state);
      if (sound) this.#playNavigationStart();
      return true;
    }

    #explorerParentPath(path) {
      if (["/Quick Access", "/Desktop", "/Documents", "/Downloads", "/Music", "/Pictures", "/Videos", "/Computer", "/Recycle Bin", "/Computer/Local Disk (C:)"].includes(path)) return null;
      const node = this.#fileSystem.resolve(path);
      return node?.parentPath ?? null;
    }

    #renderAllExplorerWindows() {
      this.#explorerWindows.forEach((state) => {
        if (state.currentNode && state.currentNode.type !== "virtual") {
          state.path = this.#fileSystem.pathFor(state.currentNode);
        }
        if (!this.#fileSystem.resolve(state.path)) {
          state.path = "/Computer";
          state.currentNode = this.#fileSystem.resolve(state.path);
        }
        this.#renderExplorerWindow(state);
      });
    }

    #renderExplorerWindow(state) {
      const { element } = state;
      const node = this.#fileSystem.resolve(state.path);
      if (!node) return;
      state.currentNode = node;
      const title = state.path === "/Computer" ? "Computer" : node.name;
      const titleText = element.querySelector("[data-explorer-title]");
      const titleIcon = element.querySelector("[data-explorer-title-icon]");
      if (titleText) titleText.textContent = title;
      if (titleIcon) titleIcon.src = this.#explorerLocationIcon(state.path, node);
      this.#updateWindowTaskLabel(element, title);

      const back = element.querySelector("[data-explorer-back]");
      const forward = element.querySelector("[data-explorer-forward]");
      const up = element.querySelector("[data-explorer-up]");
      if (back) back.disabled = state.back.length === 0;
      if (forward) forward.disabled = state.forward.length === 0;
      if (up) up.disabled = !this.#explorerParentPath(state.path);
      const search = element.querySelector("[data-explorer-search]");
      if (search) search.placeholder = `Search ${title}`;

      element.querySelectorAll("[data-explorer-place]").forEach((button) => {
        button.classList.toggle("is-current", button.dataset.explorerPlace === state.path);
        button.setAttribute("aria-current", button.dataset.explorerPlace === state.path ? "page" : "false");
      });
      this.#renderExplorerBreadcrumb(state);

      const content = element.querySelector("[data-explorer-content]");
      if (!content) return;
      state.marquee?.destroy();
      state.marquee = null;
      content.replaceChildren();
      content.classList.toggle("is-computer", state.path === "/Computer");

      if (state.path === "/Computer") {
        this.#renderComputerView(state, content);
      } else {
        const query = state.search.trim().toLocaleLowerCase();
        const items = [...this.#fileSystem.list(state.path)]
          .filter(({ name }) => !query || name.toLocaleLowerCase().includes(query))
          .sort((first, second) => {
            if (state.sort === "type" && first.type !== second.type) return first.type.localeCompare(second.type);
            return first.name.localeCompare(second.name, undefined, { sensitivity: "base", numeric: true });
          });
        const fragment = document.createDocumentFragment();
        items.forEach((item) => fragment.append(this.#createExplorerItem(state, item)));
        if (items.length === 0) {
          fragment.append(createElement("p", {
            className: "explorer-empty-message",
            text: query ? "No items match your search." : "This folder is empty."
          }));
        }
        content.append(fragment);
      }

      state.marquee = new DesktopSelectionMarquee(content, state.selectionState, {
        itemSelector: "[data-explorer-item-id]",
        onStart: () => {
          state.selectedIds.clear();
          this.#syncExplorerSelection(state);
        },
        onChange: (marqueeRect) => this.#updateExplorerMarqueeSelection(state, marqueeRect)
      });
      const status = element.querySelector("[data-explorer-status]");
      if (status) {
        const count = content.querySelectorAll("[data-explorer-item-id]").length;
        status.textContent = `${count} item${count === 1 ? "" : "s"}${state.selectedIds.size ? `    ${state.selectedIds.size} selected` : ""}`;
      }
    }

    #renderExplorerBreadcrumb(state) {
      const container = state.element.querySelector("[data-explorer-breadcrumb]");
      if (!container) return;
      const parts = state.path.split("/").filter(Boolean);
      let path = "";
      const fragment = document.createDocumentFragment();
      parts.forEach((part, index) => {
        path += `/${part}`;
        if (index > 0) fragment.append(createElement("span", { className: "explorer-crumb-separator", text: "›", "aria-hidden": "true" }));
        fragment.append(createElement("button", {
          type: "button",
          className: "explorer-crumb",
          text: part,
          "data-explorer-crumb": path
        }));
      });
      container.replaceChildren(fragment);
    }

    #explorerLocationIcon(path, node) {
      if (path === "/Quick Access") return ASSETS.quickAccess;
      if (path === "/Desktop") return ASSETS.desktop;
      if (path === "/Documents") return ASSETS.documents;
      if (path === "/Downloads") return ASSETS.downloads;
      if (path === "/Music") return ASSETS.music;
      if (path === "/Pictures") return ASSETS.pictures;
      if (path === "/Videos") return ASSETS.videos;
      if (path === "/Computer") return ASSETS.computer;
      if (path === "/Recycle Bin") return this.#fileSystem.recycleItems.length ? ASSETS.recycleFull : ASSETS.recycleEmpty;
      return this.#fileSystemItemIcon(node);
    }

    #fileSystemItemIcon(item) {
      if (this.#isImageFile(item)) return ASSETS.imageFile;
      if (item.icon) return item.icon;
      if (item.type === "computer") return ASSETS.computer;
      if (item.type === "recycle") return this.#fileSystem.recycleItems.length ? ASSETS.recycleFull : ASSETS.recycleEmpty;
      if (item.type === "drive") return ASSETS.systemDrive;
      if (item.type === "dvd") return ASSETS.dvdDrive;
      if (item.type === "folder") return item.children.length ? ASSETS.folderFull : ASSETS.folderEmpty;
      return ASSETS.textFile;
    }

    #createExplorerItem(state, item) {
      const selected = state.selectedIds.has(item.id);
      const element = createElement("div", {
        className: `explorer-item${selected ? " is-selected" : ""}`,
        role: "gridcell",
        tabIndex: -1,
        title: item.name,
        "aria-selected": String(selected),
        "data-explorer-item-id": item.id
      });
      const image = createElement("img", { src: this.#fileSystemItemIcon(item), alt: "", draggable: false });
      if (this.#isImageFile(item)) image.addEventListener("error", () => { image.src = ASSETS.imageFileFallback; }, { once: true });
      const label = createElement("span", { text: item.name, "data-explorer-item-label": "" });
      element.append(image, label);
      return element;
    }

    #renderComputerView(state, content) {
      const items = this.#fileSystem.list("/Computer");
      const groups = [
        ["Hard Disk Drives (1)", items.filter(({ type }) => type === "drive")],
        ["Devices with Removable Storage (1)", items.filter(({ type }) => type === "dvd")]
      ];
      groups.forEach(([label, groupItems]) => {
        const section = createElement("section", { className: "explorer-drive-group" });
        const heading = createElement("h2", { text: label });
        const list = createElement("div", { className: "explorer-drive-list", role: "group" });
        groupItems.forEach((item) => {
          const row = createElement("div", {
            className: `explorer-drive${state.selectedIds.has(item.id) ? " is-selected" : ""}`,
            role: "gridcell",
            tabIndex: -1,
            "aria-selected": String(state.selectedIds.has(item.id)),
            "data-explorer-item-id": item.id
          });
          const image = createElement("img", { src: this.#fileSystemItemIcon(item), alt: "", draggable: false });
          const info = createElement("div", { className: "explorer-drive__info" });
          info.append(createElement("span", { className: "explorer-drive__name", text: item.name }));
          if (item.type === "drive") {
            info.append(
              createElement("span", { className: "explorer-drive__meter", "aria-label": `${item.meta.free} free of ${item.meta.capacity}` }, {}),
              createElement("small", { text: `${item.meta.free} free of ${item.meta.capacity}` })
            );
          }
          row.append(image, info);
          list.append(row);
        });
        section.append(heading, list);
        content.append(section);
      });
    }

    #findExplorerItem(state, itemId) {
      return this.#fileSystem.list(state.path).find(({ id }) => id === itemId) ?? null;
    }

    #openExplorerItem(state, itemId) {
      const item = this.#findExplorerItem(state, itemId);
      if (!item) return;
      if (item.type === "dvd" || item.meta.systemFolder) {
        this.#playCriticalStop();
        this.#showExplorerMessage(state, item.name, "Not accessible.", ASSETS.accessDenied);
        return;
      }
      if (item.targetPath) {
        this.#navigateExplorer(state, item.targetPath);
        return;
      }
      if (["folder", "drive"].includes(item.type)) {
        this.#navigateExplorer(state, this.#fileSystem.pathFor(item));
        return;
      }
      if (this.#isImageFile(item)) {
        this.#openImageFile(item);
        return;
      }
      if (this.#isTextFile(item)) {
        this.#openTextFile(item);
        return;
      }
      this.#showShellItemProperties(item, state.element);
    }

    #syncExplorerSelection(state) {
      state.element.querySelectorAll("[data-explorer-item-id]").forEach((element) => {
        const selected = state.selectedIds.has(element.dataset.explorerItemId);
        element.classList.toggle("is-selected", selected);
        element.setAttribute("aria-selected", String(selected));
      });
      const status = state.element.querySelector("[data-explorer-status]");
      if (status) {
        const count = state.element.querySelectorAll("[data-explorer-item-id]").length;
        status.textContent = `${count} item${count === 1 ? "" : "s"}${state.selectedIds.size ? `    ${state.selectedIds.size} selected` : ""}`;
      }
    }

    #updateExplorerMarqueeSelection(state, marqueeRect) {
      if (!marqueeRect) return;
      state.selectedIds.clear();
      state.element.querySelectorAll("[data-explorer-item-id]").forEach((element) => {
        if (this.#rectanglesIntersect(marqueeRect, element.getBoundingClientRect())) {
          state.selectedIds.add(element.dataset.explorerItemId);
        }
      });
      this.#syncExplorerSelection(state);
    }

    #beginExplorerRename(state, itemId) {
      const item = this.#findExplorerItem(state, itemId);
      const itemElement = state.element.querySelector(`[data-explorer-item-id="${CSS.escape(itemId)}"]`);
      const label = itemElement?.querySelector("[data-explorer-item-label]");
      if (!item || item.permanent || !label) return;
      const input = createElement("input", { type: "text", value: item.name, "aria-label": "Rename item" });
      let cancelled = false;
      const finish = () => {
        if (!cancelled) this.#fileSystem.rename(item, input.value);
        else this.#renderExplorerWindow(state);
      };
      input.addEventListener("click", (event) => event.stopPropagation(), { signal: state.controller.signal });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cancelled = true;
          input.blur();
        }
      }, { signal: state.controller.signal });
      input.addEventListener("blur", finish, { once: true, signal: state.controller.signal });
      label.replaceWith(input);
      input.focus();
      const extensionIndex = item.type !== "folder" ? item.name.lastIndexOf(".") : -1;
      input.setSelectionRange(0, extensionIndex > 0 ? extensionIndex : input.value.length);
    }

    #deleteExplorerSelection(state) {
      const items = [...state.selectedIds].map((id) => this.#findExplorerItem(state, id)).filter(Boolean);
      const deletable = items.filter(({ permanent }) => !permanent);
      if (deletable.length === 0) return;
      this.#fileSystem.trash(deletable);
      state.selectedIds.clear();
    }

    #openExplorerContextMenu(state, clientX, clientY, itemId) {
      this.#closeDesktopContextMenu();
      const item = itemId ? this.#findExplorerItem(state, itemId) : null;
      const selected = [...state.selectedIds].map((id) => this.#findExplorerItem(state, id)).filter(Boolean);
      const descriptors = item ? [
        { label: "Open", action: () => this.#openExplorerItem(state, item.id) },
        { separator: true },
        { label: "Cut", disabled: item.permanent, action: () => { this.#shellClipboard = { operation: "cut", nodes: selected }; } },
        { label: "Copy", disabled: item.permanent, action: () => { this.#shellClipboard = { operation: "copy", nodes: selected }; } },
        { label: "Delete", disabled: item.permanent, action: () => this.#deleteExplorerSelection(state) },
        { label: "Rename", disabled: item.permanent || selected.length !== 1, action: () => requestAnimationFrame(() => this.#beginExplorerRename(state, item.id)) },
        { separator: true },
        { label: "Properties", action: () => this.#showShellItemProperties(item, state.element) }
      ] : [
        { label: "View", submenu: [{ label: "Medium icons", checked: true, action: () => {} }] },
        { label: "Sort by", submenu: [
          { label: "Name", checked: state.sort === "name", action: () => { state.sort = "name"; this.#renderExplorerWindow(state); } },
          { label: "Type", checked: state.sort === "type", action: () => { state.sort = "type"; this.#renderExplorerWindow(state); } }
        ] },
        { label: "New Folder", disabled: !["folder", "drive"].includes(state.currentNode.type), action: () => {
          const created = this.#fileSystem.create(state.path, "folder", "New folder");
          if (created) {
            state.selectedIds.clear();
            state.selectedIds.add(created.id);
            requestAnimationFrame(() => this.#beginExplorerRename(state, created.id));
          }
        } },
        { label: "Refresh", action: () => this.#renderExplorerWindow(state) },
        { label: "Paste", disabled: !this.#shellClipboard || !["folder", "drive"].includes(state.currentNode.type), action: () => this.#pasteIntoExplorer(state) }
      ];
      const menu = this.#createContextMenu(descriptors);
      this.#desktopContextMenu = menu;
      this.#desktop.append(menu);
      const rect = menu.getBoundingClientRect();
      menu.style.left = `${Math.max(4, Math.min(window.innerWidth - rect.width - 4, clientX))}px`;
      menu.style.top = `${Math.max(4, Math.min(window.innerHeight - TASKBAR_HEIGHT - rect.height - 4, clientY))}px`;
      menu.focus({ preventScroll: true });
    }

    #pasteIntoExplorer(state) {
      if (!this.#shellClipboard) return;
      const { operation, nodes } = this.#shellClipboard;
      const created = operation === "cut"
        ? (this.#fileSystem.move(nodes, state.path) ? nodes : [])
        : this.#fileSystem.copy(nodes, state.path);
      if (operation === "cut" && created.length > 0) this.#shellClipboard = null;
      state.selectedIds = new Set(created.map(({ id }) => id));
      this.#renderExplorerWindow(state);
    }

    #showExplorerMessage(state, title, message, icon) {
      const layer = state.element.querySelector("[data-explorer-modal-layer]");
      if (!layer) return;
      layer.hidden = false;
      const card = createElement("section", { className: "explorer-modal", role: "alertdialog", "aria-label": title });
      const heading = createElement("h2", { text: title });
      const body = createElement("div", { className: "explorer-modal__message" });
      body.append(createElement("img", { src: icon, alt: "", draggable: false }), createElement("p", { text: message }));
      const ok = createElement("button", { type: "button", text: "OK" });
      const dismiss = () => {
        layer.hidden = true;
        layer.replaceChildren();
        state.element.focus({ preventScroll: true });
      };
      ok.addEventListener("click", dismiss, { once: true, signal: state.controller.signal });
      card.append(heading, body, ok);
      layer.replaceChildren(card);
      ok.focus({ preventScroll: true });
    }

    #showShellItemProperties(item, ownerWindow = null) {
      const dialog = createElement("section", {
        className: "window shell-properties-window",
        "data-window": "",
        tabIndex: -1
      });
      const titleBar = createElement("div", { className: "title-bar" });
      const titleText = createElement("div", { className: "title-bar-text", text: `${item.name} Properties` });
      const controls = createElement("div", { className: "title-bar-controls" });
      controls.append(createElement("button", { type: "button", "aria-label": "Close" }));
      titleBar.append(titleText, controls);
      const body = createElement("div", { className: "window-body shell-properties-window__body" });
      const icon = createElement("img", { src: this.#fileSystemItemIcon(item), alt: "", draggable: false });
      const details = createElement("div");
      details.append(
        createElement("strong", { text: item.name }),
        createElement("p", { text: `Type: ${item.type === "folder" ? "File folder" : item.type}` }),
        createElement("p", { text: `Location: ${item.parentPath ?? "Computer"}` })
      );
      const ok = createElement("button", { type: "button", text: "OK" });
      ok.addEventListener("click", () => this.#closeWindow(dialog), { once: true });
      body.append(icon, details, ok);
      dialog.append(titleBar, body);
      const rect = ownerWindow?.getBoundingClientRect();
      assignStyles(dialog, {
        position: "absolute",
        zIndex: String(++this.#highestZIndex),
        left: `${Math.max(8, (rect?.left ?? window.innerWidth / 2) + (rect ? rect.width / 2 - 165 : -165))}px`,
        top: `${Math.max(8, (rect?.top ?? window.innerHeight / 2) + (rect ? rect.height / 2 - 110 : -110))}px`,
        width: "330px",
        minHeight: "220px",
        display: "flex",
        flexDirection: "column"
      });
      this.#desktop.append(dialog);
      void openAeroWindow(dialog);
      this.#raiseWindow(dialog);
      ok.focus({ preventScroll: true });
    }

    #updateWindowTaskLabel(windowElement, title) {
      const taskButton = this.#taskButtonFor(windowElement);
      if (!taskButton) return;
      taskButton.title = title;
      taskButton.setAttribute("aria-label", title);
    }

    #configureTaskbar() {
      if (!this.#taskbar) return;

      assignStyles(this.#taskbar, {
        position: "absolute",
        zIndex: "2147483000",
        left: "0",
        right: "0",
        bottom: "0",
        height: `${TASKBAR_HEIGHT}px`,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        boxSizing: "border-box",
        padding: "3px 10px 3px 58px",
        borderTop: "1px solid rgba(255, 255, 255, 0.65)",
        background: "linear-gradient(to bottom, rgba(140, 166, 185, 0.42), rgba(37, 60, 80, 0.58))",
        boxShadow: "0 -1px 8px rgba(0, 0, 0, 0.45)"
      });

      const startButton = this.#taskbar.querySelector("[data-start-button]");
      if (startButton) {
        assignStyles(startButton, {
          position: "absolute",
          left: "7px",
          bottom: "-4px",
          width: "52px",
          height: "52px",
          minWidth: "0",
          padding: "0",
          border: "0",
          overflow: "visible",
          appearance: "none",
          background: "transparent",
          boxShadow: "none",
          animation: "none",
          outline: "none",
          fontSize: "0",
          lineHeight: "0",
          cursor: `url("${ASSETS.cursorLink}") 6 2, pointer`
        });
        // 7.css gives every button animated pseudo-element gradients. Making
        // those local theme layers transparent prevents flashes behind the orb.
        startButton.style.setProperty("--w7-el-grad", "transparent");
        startButton.style.setProperty("--w7-el-grad-h", "transparent");
        startButton.style.setProperty("--w7-el-grad-a", "transparent");
        startButton.style.setProperty("--w7-el-sd", "none");
        startButton.style.setProperty("--w7-el-sd-a", "none");

        const orbImage = createElement("img", {
          src: ASSETS.startOrb,
          alt: "",
          draggable: false
        }, {
          position: "absolute",
          left: "50%",
          bottom: "0",
          width: "53px",
          height: "auto",
          maxWidth: "none",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          userSelect: "none"
        });
        const orbSources = {
          unpressed: ASSETS.startOrb,
          hover: ASSETS.startOrbHover,
          pressed: ASSETS.startOrbPressed
        };
        const setOrbState = (state) => {
          if (startButton.dataset.orbState === state) return;
          startButton.dataset.orbState = state;
          orbImage.src = orbSources[state];
        };
        const releaseOrb = (event) => {
          if (startButton.hasPointerCapture(event.pointerId)) {
            startButton.releasePointerCapture(event.pointerId);
          }
          setOrbState(startButton.matches(":hover") ? "hover" : "unpressed");
        };

        startButton.replaceChildren(orbImage);
        startButton.dataset.orbState = "unpressed";
        startButton.addEventListener("pointerenter", () => {
          if (startButton.dataset.orbState !== "pressed") setOrbState("hover");
        }, { signal: this.#listeners.signal });
        startButton.addEventListener("pointerleave", () => {
          if (startButton.dataset.orbState !== "pressed") setOrbState("unpressed");
        }, { signal: this.#listeners.signal });
        startButton.addEventListener("pointerdown", (event) => {
          if (!event.isPrimary || event.button !== 0) return;
          startButton.setPointerCapture(event.pointerId);
          setOrbState("pressed");
        }, { signal: this.#listeners.signal });
        startButton.addEventListener("pointerup", releaseOrb, { signal: this.#listeners.signal });
        startButton.addEventListener("pointercancel", () => setOrbState("unpressed"), {
          signal: this.#listeners.signal
        });
        startButton.addEventListener("keydown", (event) => {
          if (event.key === " " || event.key === "Enter") setOrbState("pressed");
        }, { signal: this.#listeners.signal });
        startButton.addEventListener("keyup", (event) => {
          if (event.key === " " || event.key === "Enter") {
            setOrbState(startButton.matches(":hover") ? "hover" : "unpressed");
          }
        }, { signal: this.#listeners.signal });
        startButton.addEventListener("blur", () => setOrbState("unpressed"), {
          signal: this.#listeners.signal
        });
      }

      const clock = this.#taskbar.querySelector("[data-taskbar-clock]");
      if (clock) {
        assignStyles(clock, {
          marginLeft: "auto",
          minWidth: "72px",
          color: "#fff",
          fontFamily: '"Segoe UI", Tahoma, sans-serif',
          fontSize: "11px",
          lineHeight: "12px",
          textAlign: "center",
          textShadow: "0 1px 2px #000"
        });
      }

      const showDesktop = this.#taskbar.querySelector("[data-show-desktop]");
      if (showDesktop) {
        showDesktop.addEventListener("click", () => {
          const restoreTargets = [...this.#desktop.querySelectorAll(".window[data-show-desktop-minimized=\"true\"]")];
          if (restoreTargets.length > 0) {
            restoreTargets.forEach((windowElement) => {
              delete windowElement.dataset.showDesktopMinimized;
              void this.#setMinimized(windowElement, false);
            });
            return;
          }

          this.#desktop.querySelectorAll(".window:not([hidden]):not(.minimized)").forEach((windowElement) => {
            windowElement.dataset.showDesktopMinimized = "true";
            void this.#setMinimized(windowElement, true);
          });
        }, { signal: this.#listeners.signal });
      }
    }

    #configureStartMenu() {
      const menu = this.#desktop.querySelector("[data-start-menu]");
      const startButton = this.#taskbar?.querySelector("[data-start-button]");
      if (!menu || !startButton) return;

      this.#startMenu = menu;
      const iconSources = {
        about: ASSETS.about,
        chrome: ASSETS.chrome,
        cmd: ASSETS.cmd,
        calculator: ASSETS.calculator,
        notepad: ASSETS.notepad,
        paint: ASSETS.paint,
        "photo-viewer": ASSETS.photoViewer,
        documents: ASSETS.documents,
        pictures: ASSETS.pictures,
        music: ASSETS.music,
        computer: ASSETS.computer,
        controlPanel: ASSETS.controlPanel,
        defaultPrograms: ASSETS.defaultPrograms,
        help: ASSETS.help
      };
      const profile = menu.querySelector(".start-menu__profile");
      const defaultProfile = menu.querySelector("[data-start-profile-default]");
      const contextProfile = menu.querySelector("[data-start-profile-context]");
      const powerArrow = menu.querySelector("[data-power-arrow]");
      const powerOptions = powerArrow?.closest(".start-menu__power-options") ?? null;

      if (defaultProfile) defaultProfile.src = ASSETS.userAvatar;
      menu.querySelectorAll("[data-start-icon]").forEach((item) => {
        const source = iconSources[item.dataset.startIcon];
        const image = item.querySelector("img");
        if (source && image) {
          image.src = source;
          if (source === ASSETS.imageFile) {
            image.addEventListener("error", () => { image.src = ASSETS.imageFileFallback; }, { once: true });
          }
        }
      });
      menu.addEventListener("pointerdown", (event) => {
        const item = event.target.closest(".start-menu__item[data-start-icon]");
        const app = APP_SHORTCUTS[item?.dataset.startIcon];
        if (!item || !app) return;
        this.#beginShellDrag(event, {
          kind: "start",
          sourceElement: item,
          appName: item.dataset.startIcon,
          name: app.name,
          icon: app.icon
        });
      }, { signal: this.#listeners.signal });

      const showContextProfile = (item) => {
        const source = iconSources[item?.dataset.startIcon];
        if (!source || !contextProfile || !profile) return;
        contextProfile.src = source;
        if (source === ASSETS.imageFile) {
          contextProfile.addEventListener("error", () => { contextProfile.src = ASSETS.imageFileFallback; }, { once: true });
        }
        profile.classList.add("is-contextual");
      };
      const showDefaultProfile = () => profile?.classList.remove("is-contextual");
      const setPowerMenuOpen = (isOpen) => {
        powerOptions?.classList.toggle("is-open", isOpen);
        powerArrow?.setAttribute("aria-expanded", String(isOpen));
      };
      const isOpen = () => menu.classList.contains("is-open");
      const openMenu = () => {
        window.clearTimeout(this.#startMenuCloseTimer);
        menu.classList.add("is-visible");
        menu.setAttribute("aria-hidden", "false");
        startButton.setAttribute("aria-expanded", "true");
        requestAnimationFrame(() => menu.classList.add("is-open"));
      };
      const closeMenu = ({ restoreFocus = false } = {}) => {
        if (!menu.classList.contains("is-visible")) return;
        menu.classList.remove("is-open");
        menu.setAttribute("aria-hidden", "true");
        startButton.setAttribute("aria-expanded", "false");
        setPowerMenuOpen(false);
        showDefaultProfile();
        window.clearTimeout(this.#startMenuCloseTimer);
        this.#startMenuCloseTimer = window.setTimeout(() => {
          if (!menu.classList.contains("is-open")) menu.classList.remove("is-visible");
        }, 210);
        if (restoreFocus) startButton.focus({ preventScroll: true });
      };

      const openStartApp = (appName) => {
        this.#openAppWindow(appName);
        closeMenu();
      };

      menu.addEventListener("click", (event) => {
        if (this.#consumeSuppressedShellClick(event)) return;
        const appItem = event.target.closest(".start-menu__item[data-start-icon]");
        if (appItem) {
          openStartApp(appItem.dataset.startIcon);
          return;
        }
        const systemItem = event.target.closest(".start-menu__system-list [data-start-icon]");
        if (systemItem?.dataset.startIcon === "controlPanel") {
          this.#openControlPanel("home");
          closeMenu();
          return;
        }
        const explorerPaths = {
          documents: "/Documents",
          pictures: "/Pictures",
          music: "/Music",
          computer: "/Computer"
        };
        const path = explorerPaths[systemItem?.dataset.startIcon];
        if (path) {
          this.#openExplorer(path);
          closeMenu();
        }
      }, { signal: this.#listeners.signal });

      startButton.addEventListener("click", () => {
        if (isOpen()) closeMenu();
        else openMenu();
      }, { signal: this.#listeners.signal });

      menu.addEventListener("pointerover", (event) => {
        const item = event.target.closest("[data-start-icon]");
        if (item) showContextProfile(item);
      }, { signal: this.#listeners.signal });
      menu.addEventListener("pointerleave", showDefaultProfile, {
        signal: this.#listeners.signal
      });
      menu.addEventListener("focusin", (event) => {
        const item = event.target.closest("[data-start-icon]");
        if (item) showContextProfile(item);
      }, { signal: this.#listeners.signal });
      menu.addEventListener("focusout", (event) => {
        if (!event.relatedTarget?.closest?.("[data-start-icon]")) showDefaultProfile();
      }, { signal: this.#listeners.signal });

      powerArrow?.addEventListener("click", (event) => {
        event.stopPropagation();
        setPowerMenuOpen(!powerOptions?.classList.contains("is-open"));
      }, { signal: this.#listeners.signal });
      menu.querySelector(".start-menu__shutdown")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void this.#beginPowerSequence("shutdown");
      }, { signal: this.#listeners.signal });
      powerOptions?.querySelectorAll("[data-power-menu] button").forEach((button) => {
        const action = button.textContent.trim().toLowerCase() === "restart"
          ? "restart"
          : "shutdown";
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void this.#beginPowerSequence(action);
        }, { signal: this.#listeners.signal });
      });
      menu.addEventListener("click", (event) => {
        if (powerOptions?.classList.contains("is-open") && !event.target.closest(".start-menu__power-options")) {
          setPowerMenuOpen(false);
        }
      }, { signal: this.#listeners.signal });

      document.addEventListener("pointerdown", (event) => {
        if (!isOpen() || menu.contains(event.target) || startButton.contains(event.target)) return;
        closeMenu();
      }, { capture: true, signal: this.#listeners.signal });
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !isOpen()) return;
        event.preventDefault();
        closeMenu({ restoreFocus: true });
      }, { signal: this.#listeners.signal });
    }

    #configureSystemTray() {
      if (!this.#taskbar) return;

      const clock = this.#taskbar.querySelector("[data-taskbar-clock]");
      if (!clock) return;

      const tray = createElement("div", {
        "data-system-tray": ""
      }, {
        display: "flex",
        alignSelf: "stretch",
        alignItems: "stretch",
        marginLeft: "auto",
        marginTop: "0",
        marginBottom: "0"
      });
      const network = this.#createTrayButton("Network: Internet access", ASSETS.networkIcon);
      network.button.dataset.networkTray = "";
      const volume = this.#createTrayButton("Volume: 100%", ASSETS.volumeFull);
      volume.button.dataset.volumeTray = "";
      this.#volumeIcon = volume.image;
      const clockButton = this.#createTrayButton("Time and date");
      clockButton.button.dataset.clockTray = "";

      assignStyles(clockButton.button, {
        minWidth: "78px",
        padding: "0 7px"
      });
      assignStyles(clock, {
        display: "block",
        marginLeft: "0",
        minWidth: "64px",
        pointerEvents: "none"
      });

      clock.replaceWith(tray);
      clockButton.button.append(clock);
      tray.append(network.button, volume.button, clockButton.button);

      this.#trayTooltip = createElement("div", {
        role: "tooltip",
        hidden: true
      }, {
        position: "absolute",
        zIndex: "2147483646",
        padding: "5px 9px",
        color: "#000",
        fontSize: "12px",
        lineHeight: "18px",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        background: "linear-gradient(#fff, #e8edf2)",
        border: "1px solid #767676",
        borderRadius: "2px",
        boxShadow: "2px 3px 5px rgba(0, 0, 0, 0.35)"
      });
      this.#taskbar.append(this.#trayTooltip);

      const showDateTooltip = () => {
        if (!this.#trayTooltip) return;
        this.#trayTooltip.textContent = this.#formatLongDate(new Date());
        this.#trayTooltip.hidden = false;
        this.#positionTrayOverlay(this.#trayTooltip, clockButton.button, 6);
      };
      const hideDateTooltip = () => {
        if (this.#trayTooltip) this.#trayTooltip.hidden = true;
      };

      clockButton.button.addEventListener("pointerenter", showDateTooltip, {
        signal: this.#listeners.signal
      });
      clockButton.button.addEventListener("pointerleave", hideDateTooltip, {
        signal: this.#listeners.signal
      });
      clockButton.button.addEventListener("focus", showDateTooltip, {
        signal: this.#listeners.signal
      });
      clockButton.button.addEventListener("blur", hideDateTooltip, {
        signal: this.#listeners.signal
      });
      clockButton.button.addEventListener("click", () => {
        hideDateTooltip();
        this.#toggleTrayFlyout(clockButton.button, () => this.#createClockFlyout());
      }, { signal: this.#listeners.signal });
      network.button.addEventListener("click", () => {
        this.#toggleTrayFlyout(network.button, () => this.#createNetworkFlyout());
      }, { signal: this.#listeners.signal });
      volume.button.addEventListener("click", () => {
        this.#toggleTrayFlyout(volume.button, () => this.#createVolumeFlyout());
      }, { signal: this.#listeners.signal });

      document.addEventListener("pointerdown", (event) => {
        if (!this.#trayFlyout || !this.#trayFlyoutOwner) return;
        if (this.#trayFlyout.contains(event.target) || this.#trayFlyoutOwner.contains(event.target)) return;
        this.#closeTrayFlyout();
      }, { capture: true, signal: this.#listeners.signal });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") this.#closeTrayFlyout();
      }, { signal: this.#listeners.signal });
      window.addEventListener("resize", () => {
        if (this.#trayFlyout && this.#trayFlyoutOwner) {
          this.#positionTrayOverlay(this.#trayFlyout, this.#trayFlyoutOwner, 1);
        }
      }, { signal: this.#listeners.signal });

      this.#updateVolumeIcon();
    }

    #createTrayButton(label, iconSource = null) {
      const button = createElement("button", {
        type: "button",
        "aria-label": label,
        "aria-expanded": "false"
      }, {
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "34px",
        height: `${TASKBAR_HEIGHT}px`,
        padding: "0 5px",
        border: "0",
        borderRadius: "0",
        background: "transparent",
        boxShadow: "none",
        animation: "none",
        color: "#fff",
        cursor: `url("${ASSETS.cursorLink}") 6 2, pointer`
      });
      button.style.setProperty("--w7-el-grad", "transparent");
      button.style.setProperty("--w7-el-grad-h", "transparent");
      button.style.setProperty("--w7-el-grad-a", "transparent");
      button.style.setProperty("--w7-el-sd", "none");
      button.style.setProperty("--w7-el-sd-a", "none");
      button.addEventListener("pointerenter", () => {
        button.style.background = "rgba(255, 255, 255, 0.16)";
      }, { signal: this.#listeners.signal });
      button.addEventListener("pointerleave", () => {
        if (button.getAttribute("aria-expanded") !== "true") button.style.background = "transparent";
      }, { signal: this.#listeners.signal });

      let image = null;
      if (iconSource) {
        image = createElement("img", {
          src: iconSource,
          alt: "",
          draggable: false
        }, {
          display: "block",
          width: "22px",
          height: "22px",
          objectFit: "contain",
          pointerEvents: "none",
          userSelect: "none"
        });
        button.append(image);
      }

      return { button, image };
    }

    #positionTrayOverlay(overlay, owner, gap) {
      if (!this.#taskbar) return;
      const taskbarRect = this.#taskbar.getBoundingClientRect();
      const ownerRect = owner.getBoundingClientRect();
      const right = Math.max(0, taskbarRect.right - ownerRect.right);
      overlay.style.right = `${right}px`;
      overlay.style.bottom = `${TASKBAR_HEIGHT + gap}px`;
    }

    #toggleTrayFlyout(owner, createFlyout) {
      if (this.#trayFlyoutOwner === owner) {
        this.#closeTrayFlyout();
        return;
      }

      this.#closeTrayFlyout();
      this.#trayFlyoutOwner = owner;
      this.#trayFlyout = createFlyout();
      owner.setAttribute("aria-expanded", "true");
      owner.style.background = "rgba(255, 255, 255, 0.2)";
      this.#taskbar.append(this.#trayFlyout);
      this.#positionTrayOverlay(this.#trayFlyout, owner, 1);
    }

    #closeTrayFlyout() {
      window.clearInterval(this.#analogClockTimer);
      this.#analogClockTimer = 0;
      this.#trayFlyout?.remove();
      if (this.#trayFlyoutOwner) {
        this.#trayFlyoutOwner.setAttribute("aria-expanded", "false");
        this.#trayFlyoutOwner.style.background = "transparent";
      }
      this.#trayFlyout = null;
      this.#trayFlyoutOwner = null;
    }

    #createFlyoutBase(label, width) {
      return createElement("section", {
        role: "dialog",
        "aria-label": label,
        "data-tray-flyout": ""
      }, {
        position: "absolute",
        zIndex: "2147483645",
        width,
        boxSizing: "border-box",
        color: "#111",
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
        fontSize: "12px",
        background: "linear-gradient(rgba(255, 255, 255, 0.98), rgba(239, 245, 251, 0.98))",
        border: "1px solid #5b7185",
        boxShadow: "0 5px 18px rgba(0, 0, 0, 0.42)"
      });
    }

    #createClockFlyout() {
      const flyout = this.#createFlyoutBase("Date and time", "310px");
      assignStyles(flyout, { padding: "10px 12px 0" });
      const canvas = createElement("canvas", {
        width: 300,
        height: 300,
        role: "img",
        "aria-label": "Live analog clock"
      }, {
        display: "block",
        width: "150px",
        height: "150px",
        margin: "0 auto"
      });
      const digital = createElement("time", {}, {
        display: "block",
        margin: "-1px 0 2px",
        color: "#000",
        fontSize: "12px",
        textAlign: "center",
        fontVariantNumeric: "tabular-nums"
      });
      const longDate = createElement("div", {}, {
        margin: "4px 0 7px",
        color: "#0066cc",
        textAlign: "center"
      });
      const calendar = this.#createCalendar(new Date());
      const footer = createElement("div", {
        text: "Change date and time settings…"
      }, {
        margin: "10px -12px 0",
        padding: "9px 12px",
        color: "#0066cc",
        textAlign: "center",
        borderTop: "1px solid #c5d5e4",
        background: "rgba(225, 235, 246, 0.72)"
      });
      const tick = () => {
        const now = new Date();
        this.#drawAnalogClock(canvas, now);
        digital.textContent = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit"
        }).format(now);
        digital.dateTime = now.toISOString();
        longDate.textContent = this.#formatLongDate(now);
      };

      flyout.append(canvas, digital, longDate, calendar, footer);
      tick();
      this.#analogClockTimer = window.setInterval(tick, 1000);
      return flyout;
    }

    #createCalendar(date) {
      const container = createElement("div", {}, { padding: "0 5px 2px" });
      const monthTitle = createElement("div", {
        text: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date)
      }, {
        marginBottom: "5px",
        fontWeight: "600",
        textAlign: "center"
      });
      const grid = createElement("div", {}, {
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: "1px 3px",
        textAlign: "center",
        fontVariantNumeric: "tabular-nums"
      });

      ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].forEach((weekday) => {
        grid.append(createElement("div", { text: weekday }, {
          paddingBottom: "2px",
          fontWeight: "600"
        }));
      });

      const year = date.getFullYear();
      const month = date.getMonth();
      const firstWeekday = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysInPreviousMonth = new Date(year, month, 0).getDate();

      for (let cell = 0; cell < 42; cell += 1) {
        let day = cell - firstWeekday + 1;
        let muted = false;
        if (day < 1) {
          day = daysInPreviousMonth + day;
          muted = true;
        } else if (day > daysInMonth) {
          day -= daysInMonth;
          muted = true;
        }

        const isToday = !muted && day === date.getDate();
        grid.append(createElement("div", { text: String(day) }, {
          minWidth: "22px",
          padding: "2px 1px",
          boxSizing: "border-box",
          color: muted ? "#777" : "#111",
          background: isToday ? "#d8edff" : "transparent",
          border: isToday ? "1px solid #2686c7" : "1px solid transparent"
        }));
      }

      container.append(monthTitle, grid);
      return container;
    }

    #drawAnalogClock(canvas, date) {
      const context = canvas.getContext("2d");
      if (!context) return;

      const size = 150;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const pixels = Math.round(size * pixelRatio);
      if (canvas.width !== pixels || canvas.height !== pixels) {
        canvas.width = pixels;
        canvas.height = pixels;
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, size, size);
      context.save();
      context.translate(size / 2, size / 2);

      const radius = 68;
      const face = context.createRadialGradient(-18, -22, 4, 0, 0, radius);
      face.addColorStop(0, "#ffffff");
      face.addColorStop(0.75, "#edf6fa");
      face.addColorStop(1, "#c8d7df");
      context.beginPath();
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.fillStyle = face;
      context.fill();
      context.lineWidth = 4;
      context.strokeStyle = "#91a4ae";
      context.stroke();
      context.beginPath();
      context.arc(0, 0, radius - 5, 0, Math.PI * 2);
      context.lineWidth = 1;
      context.strokeStyle = "rgba(255, 255, 255, 0.95)";
      context.stroke();

      for (let marker = 0; marker < 60; marker += 1) {
        const angle = marker * Math.PI / 30;
        const major = marker % 5 === 0;
        const inner = radius - (major ? 13 : 8);
        context.beginPath();
        context.moveTo(Math.sin(angle) * inner, -Math.cos(angle) * inner);
        context.lineTo(Math.sin(angle) * (radius - 6), -Math.cos(angle) * (radius - 6));
        context.lineWidth = major ? 2 : 1;
        context.strokeStyle = major ? "#385a68" : "#7c9ca9";
        context.stroke();
      }

      const seconds = date.getSeconds() + date.getMilliseconds() / 1000;
      const minutes = date.getMinutes() + seconds / 60;
      const hours = (date.getHours() % 12) + minutes / 60;
      const drawHand = (angle, length, width, color) => {
        context.save();
        context.rotate(angle);
        context.beginPath();
        context.moveTo(0, 7);
        context.lineTo(0, -length);
        context.lineWidth = width;
        context.lineCap = "round";
        context.strokeStyle = color;
        context.stroke();
        context.restore();
      };
      drawHand(hours * Math.PI / 6, 36, 4, "#263f4a");
      drawHand(minutes * Math.PI / 30, 50, 3, "#263f4a");
      drawHand(seconds * Math.PI / 30, 54, 1, "#4d7685");
      context.beginPath();
      context.arc(0, 0, 4, 0, Math.PI * 2);
      context.fillStyle = "#335763";
      context.fill();
      context.restore();
    }

    #createNetworkFlyout() {
      const flyout = this.#createFlyoutBase("Network status", "275px");
      assignStyles(flyout, { padding: "9px 12px 0" });
      const heading = createElement("div", { text: "Currently connected to:" }, {
        marginBottom: "7px"
      });
      const row = createElement("div", {}, {
        display: "flex",
        alignItems: "center",
        gap: "9px",
        minHeight: "48px"
      });
      const bench = createElement("img", {
        src: ASSETS.networkTypeIcon,
        alt: "Park bench network type",
        draggable: false
      }, {
        width: "48px",
        height: "48px",
        objectFit: "contain"
      });
      const status = createElement("div", {}, { lineHeight: "17px" });
      status.append(
        createElement("strong", { text: "Network" }, { display: "block", fontSize: "13px" }),
        createElement("span", { text: "Internet access" }, { display: "block" })
      );
      const footer = createElement("div", { text: "Open Network and Sharing Center" }, {
        margin: "8px -12px 0",
        padding: "9px 12px",
        color: "#0066cc",
        textAlign: "center",
        borderTop: "1px solid #c5d5e4",
        background: "rgba(225, 235, 246, 0.72)"
      });

      row.append(bench, status);
      flyout.append(heading, row, footer);
      return flyout;
    }

    #createVolumeFlyout() {
      const flyout = this.#createFlyoutBase("Volume control", "92px");
      assignStyles(flyout, {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "10px 8px 0"
      });
      const speaker = createElement("img", {
        src: ASSETS.speakerHardware,
        alt: "Speakers",
        draggable: false
      }, {
        width: "48px",
        height: "48px",
        objectFit: "contain"
      });
      const slider = createElement("input", {
        type: "range",
        min: "0",
        max: "100",
        step: "1",
        value: String(this.#volume),
        orient: "vertical",
        "aria-label": "Volume"
      }, {
        position: "absolute",
        left: "-52px",
        top: "52px",
        width: "132px",
        height: "28px",
        margin: "0",
        transform: "rotate(-90deg)",
        transformOrigin: "center",
        cursor: `url("${ASSETS.cursorLink}") 6 2, pointer`
      });
      const sliderShell = createElement("div", {}, {
        position: "relative",
        width: "28px",
        height: "132px",
        margin: "5px 0 2px"
      });
      sliderShell.append(slider);
      const output = createElement("output", { text: `${this.#volume}%` }, {
        minHeight: "17px",
        color: "#333",
        fontSize: "11px",
        fontVariantNumeric: "tabular-nums"
      });
      const mixer = createElement("div", { text: "Mixer" }, {
        alignSelf: "stretch",
        margin: "4px -8px 0",
        padding: "8px 0",
        color: "#0066cc",
        textAlign: "center",
        borderTop: "1px solid #c5d5e4",
        background: "rgba(225, 235, 246, 0.72)"
      });
      let dragging = false;
      let overLimitLatched = false;
      let wheelResetTimer = 0;
      const syncVolume = (value) => {
        this.#volume = Math.min(100, Math.max(0, Math.round(Number(value))));
        slider.value = String(this.#volume);
        output.value = String(this.#volume);
        output.textContent = `${this.#volume}%`;
        this.#updateVolumeIcon();
        this.#scheduleProfileSave();
      };
      const triggerOverLimit = () => {
        syncVolume(100);
        if (!overLimitLatched) this.#playCriticalStop();
        overLimitLatched = true;
      };

      slider.addEventListener("input", () => {
        overLimitLatched = false;
        syncVolume(slider.value);
      }, { signal: this.#listeners.signal });
      slider.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        dragging = true;
        slider.setPointerCapture(event.pointerId);
      }, { signal: this.#listeners.signal });
      slider.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        const rect = slider.getBoundingClientRect();
        if (event.clientY < rect.top) {
          triggerOverLimit();
        } else if (event.clientY > rect.top + 3) {
          overLimitLatched = false;
        }
      }, { signal: this.#listeners.signal });
      const finishDrag = (event) => {
        dragging = false;
        overLimitLatched = false;
        if (slider.hasPointerCapture(event.pointerId)) slider.releasePointerCapture(event.pointerId);
      };
      slider.addEventListener("pointerup", finishDrag, { signal: this.#listeners.signal });
      slider.addEventListener("pointercancel", finishDrag, { signal: this.#listeners.signal });
      slider.addEventListener("wheel", (event) => {
        event.preventDefault();
        if (event.deltaY === 0) return;
        const attemptedVolume = this.#volume + (event.deltaY < 0 ? 5 : -5);
        if (attemptedVolume > 100) {
          triggerOverLimit();
          window.clearTimeout(wheelResetTimer);
          wheelResetTimer = window.setTimeout(() => {
            overLimitLatched = false;
          }, 350);
          return;
        }
        overLimitLatched = false;
        syncVolume(attemptedVolume);
      }, { passive: false, signal: this.#listeners.signal });

      flyout.append(speaker, sliderShell, output, mixer);
      return flyout;
    }

    #updateVolumeIcon() {
      if (!this.#volumeIcon) return;

      let source = ASSETS.volumeMuted;
      if (this.#volume >= 67) source = ASSETS.volumeFull;
      else if (this.#volume >= 34) source = ASSETS.volumeMid;
      else if (this.#volume >= 1) source = ASSETS.volumeLow;
      this.#volumeIcon.src = source;
      this.#volumeIcon.closest("button")?.setAttribute("aria-label", `Volume: ${this.#volume}%`);
    }

    #playShellSound(name) {
      const audio = name === "navigation" ? this.#navigationAudio : this.#criticalStopAudio;
      if (!audio) return;
      audio.pause();
      audio.loop = false;
      audio.currentTime = 0;
      audio.volume = this.#volume / 100;
      void audio.play().catch(() => {});
    }

    #playCriticalStop() {
      this.#playShellSound("critical");
    }

    #playNavigationStart() {
      this.#playShellSound("navigation");
    }

    #formatLongDate(date) {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(date);
    }

    async #beginPowerSequence(action) {
      if (this.#state !== "desktop" || this.#powerSequenceInProgress) return;

      this.#powerSequenceInProgress = true;
      const isRestart = action === "restart";
      const powerAssetsReady = this.#preloadPowerAssets();

      // Prime delayed audio while this trusted click is still on the stack.
      // Volume remains at zero until the state that owns the sound is shown.
      if (isRestart) {
        this.#startupSoundHasPlayed = false;
        this.#primeStartupAudio();
        this.#primeBiosAudio();
      } else {
        this.#primeShutdownAudio();
        this.#primeDeskAudio();
      }

      try {
        // Nothing visible or interactive changes during this authentic shell lag.
        await wait(POWER_ACTION_LAG_MS);
        await this.#profilePersistence?.flush();

        this.#setState(isRestart ? "restarting" : "shutting-down");
        this.#unmountDesktop();

        const transitionScreen = this.#createPowerTransitionScreen(action);
        const blackVeil = transitionScreen.querySelector("[data-black-veil]");
        this.#root.append(transitionScreen);
        if (!isRestart) this.#playShutdownAudio();
        await nextPaint();

        if (blackVeil) blackVeil.style.opacity = "0";
        await Promise.all([
          powerAssetsReady,
          wait(POWER_TRANSITION_DURATION_MS)
        ]);
        transitionScreen.remove();

        this.#setState("no-signal");
        const noSignalScreen = this.#createNoSignalScreen();
        this.#root.append(noSignalScreen);
        await wait(NO_SIGNAL_DURATION_MS);

        if (isRestart) {
          await this.#bootCleanSystem(noSignalScreen);
          return;
        }

        noSignalScreen.querySelector("[data-no-signal-alert]")?.remove();
        await wait(POST_SHUTDOWN_BLACK_DURATION_MS);
        noSignalScreen.remove();
        this.#setState("desk-view");
        this.#showDeskView();
        this.#powerSequenceInProgress = false;
      } catch (error) {
        this.#powerSequenceInProgress = false;
        console.error(`Windows 7 ${action} sequence failed.`, error);
      }
    }

    #createPowerTransitionScreen(action) {
      const screen = createElement("section", {
        "aria-label": action === "restart" ? "Windows is restarting" : "Windows is shutting down",
        "aria-live": "polite",
        "data-screen": "power-transition"
      }, {
        position: "absolute",
        zIndex: "2147483642",
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        color: "#fff",
        backgroundColor: "#0877c9",
        backgroundImage: `url("${ASSETS.loginWallpaper}")`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover"
      });
      const status = createElement("div", {}, {
        position: "relative",
        zIndex: "1",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        transform: "translateY(-1vh)"
      });
      const busy = createElement("img", {
        src: ASSETS.busy,
        alt: "",
        draggable: false
      }, {
        display: "block",
        width: "32px",
        height: "32px",
        objectFit: "contain"
      });
      const label = createElement("p", {
        text: action === "restart" ? "Restarting..." : "Shutting down..."
      }, {
        margin: "0",
        color: "#fff",
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
        fontSize: "21px",
        fontWeight: "400",
        lineHeight: "32px",
        textShadow: "0 1px 2px rgba(0, 29, 74, 0.85)",
        whiteSpace: "nowrap"
      });
      const blackVeil = createElement("div", {
        "data-black-veil": "",
        "aria-hidden": "true"
      }, {
        position: "absolute",
        zIndex: "2",
        inset: "0",
        background: "#000",
        opacity: "1",
        pointerEvents: "none",
        transition: `opacity ${TRANSITION_MS}ms ease`
      });

      status.append(busy, label);
      screen.append(status, blackVeil);
      return screen;
    }

    #createNoSignalScreen() {
      const screen = createElement("section", {
        "aria-label": "Monitor has no signal",
        "data-screen": "no-signal"
      }, {
        position: "absolute",
        zIndex: "2147483643",
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "#000"
      });
      const alert = createElement("div", {
        text: "NO SIGNAL",
        "data-no-signal-alert": ""
      }, {
        boxSizing: "border-box",
        minWidth: "180px",
        padding: "20px 28px",
        color: "#fff",
        background: "#0645c7",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "24px",
        fontWeight: "700",
        lineHeight: "1",
        letterSpacing: "0.5px",
        textAlign: "center",
        textShadow: "1px 1px 0 rgba(0, 0, 0, 0.45)"
      });

      screen.append(alert);
      return screen;
    }

    #showDeskView() {
      const screen = createElement("section", {
        "aria-label": "Computer desk view. Press the computer power button to start Windows",
        "data-screen": "desk-view"
      }, {
        position: "absolute",
        zIndex: "2147483642",
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "#000"
      });
      const imageStage = createElement("div", {}, {
        position: "relative",
        flex: "0 0 auto",
        width: `min(100vw, ${(DESK_IMAGE_WIDTH / DESK_IMAGE_HEIGHT) * 100}vh)`,
        aspectRatio: `${DESK_IMAGE_WIDTH} / ${DESK_IMAGE_HEIGHT}`,
        maxHeight: "100vh"
      });
      const desk = createElement("img", {
        src: ASSETS.deskView,
        alt: "A desk with a powered-off computer",
        draggable: false
      }, {
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        userSelect: "none"
      });
      const powerButton = createElement("button", {
        type: "button",
        "aria-label": "Power on computer"
      }, {
        position: "absolute",
        left: `${(POWER_HOTSPOT.left / DESK_IMAGE_WIDTH) * 100}%`,
        top: `${(POWER_HOTSPOT.top / DESK_IMAGE_HEIGHT) * 100}%`,
        width: `${((POWER_HOTSPOT.right - POWER_HOTSPOT.left) / DESK_IMAGE_WIDTH) * 100}%`,
        height: `${((POWER_HOTSPOT.bottom - POWER_HOTSPOT.top) / DESK_IMAGE_HEIGHT) * 100}%`,
        minWidth: "0",
        minHeight: "0",
        margin: "0",
        padding: "0",
        border: "0",
        borderRadius: "0",
        outline: "0",
        opacity: "0",
        background: "transparent",
        boxShadow: "none",
        cursor: `url("${ASSETS.cursorLink}") 6 2, pointer`
      });

      powerButton.addEventListener("click", () => {
        if (this.#powerSequenceInProgress) return;
        this.#powerSequenceInProgress = true;
        this.#stopDeskAudio();
        this.#startupSoundHasPlayed = false;
        this.#primeStartupAudio();
        this.#primeBiosAudio();
        void this.#bootCleanSystem(screen);
      }, { once: true });

      imageStage.append(desk, powerButton);
      screen.append(imageStage);
      this.#root.append(screen);
      this.#playDeskAudio();
    }

    #unmountDesktop() {
      this.#cancelDrag();
      this.#cancelResize();
      this.#cancelDesktopItemDrag();
      this.#cancelShellDrag();
      this.#desktopMarquee?.destroy();
      this.#desktopMarquee = null;
      this.#chromeApp?.destroy();
      this.#paintApp?.destroy();
      this.#photoViewerApp?.destroy();
      this.#notepadApp?.destroy();
      this.#chromeApp = null;
      this.#paintApp = null;
      this.#photoViewerApp = null;
      this.#notepadApp = null;
      this.#fileSystemUnsubscribe?.();
      this.#fileSystemUnsubscribe = null;
      this.#explorerWindows.forEach((state) => {
        state.marquee?.destroy();
        state.controller.abort();
      });
      this.#explorerWindows.clear();
      this.#listeners.abort();
      window.clearInterval(this.#clockTimer);
      window.clearInterval(this.#analogClockTimer);
      window.clearTimeout(this.#desktopRefreshTimer);
      window.clearTimeout(this.#startMenuCloseTimer);
      window.clearTimeout(this.#suppressedShellClickTimer);
      this.#desktop.remove();
    }

    #mountCleanDesktop() {
      this.#pendingPinnedItems = this.#capturePinnedItems();
      this.#listeners = new AbortController();
      this.#desktop = this.#desktopTemplate.cloneNode(true);
      this.#taskbar = this.#desktop.querySelector("[data-taskbar]");
      this.#root.append(this.#desktop);

      this.#highestZIndex = 100;
      this.#drag = null;
      this.#dragFrame = 0;
      this.#resize = null;
      this.#resizeFrame = 0;
      this.#loginScreen = null;
      this.#loginSubmissionInProgress = false;
      this.#clockTimer = 0;
      this.#analogClockTimer = 0;
      this.#trayFlyout = null;
      this.#trayFlyoutOwner = null;
      this.#trayTooltip = null;
      this.#startMenu = null;
      this.#startMenuCloseTimer = 0;
      this.#volumeIcon = null;
      this.#desktopIconLayer = null;
      this.#desktopContextMenu = null;
      this.#desktopFileInput = null;
      this.#fileSystemUnsubscribe = null;
      this.#explorerWindows = new Map();
      this.#explorerSequence = 0;
      this.#selectedDesktopItemId = null;
      this.#desktopItemDrag = null;
      this.#desktopItemDragFrame = 0;
      this.#shellDrag = null;
      this.#shellDropHighlight = null;
      this.#suppressedShellClickTarget = null;
      this.#suppressedShellClickTimer = 0;
      this.#pinnedTaskItems = new Map();
      this.#lastDesktopClick = { itemId: null, time: 0 };
      this.#desktopRefreshTimer = 0;
      this.#desktopItemSequence = 0;
      this.#shellClipboard = null;
      this.#contextMenuPoint = { x: 16, y: 96 };
      this.#windowAnimations = new WeakMap();
      Object.assign(this.#desktopSelectionState, {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        bounds: null
      });

      this.#configureDesktop();
      this.#configureDesktopItems();
      this.#bindWindowManager();
    }

    async #bootCleanSystem(previousScreen) {
      this.#stopDeskAudio();
      previousScreen?.remove();
      this.#setState("boot");
      this.#mountCleanDesktop();

      try {
        await this.#runBiosPostSequence();
        await this.#runBootSequence();
      } finally {
        this.#powerSequenceInProgress = false;
      }
    }

    async #runBiosPostSequence() {
      const biosScreen = this.#createStartupGate();
      this.#root.append(biosScreen);

      await Promise.all([
        this.#animateBiosPost(biosScreen),
        this.#playBiosAudioExcerpt()
      ]);
      biosScreen.remove();
    }

    async #runBootSequence() {
      this.#bootedAt = performance.now();
      const bootScreen = this.#createBootScreen();
      this.#root.append(bootScreen);

      // Asset loading and the authentic boot hold run concurrently.
      await Promise.all([this.#preloadDesktopAssets(), wait(BOOT_DURATION_MS)]);
      await this.#showLoginScreen(bootScreen);
    }

    #createStartupGate() {
      const screen = createElement("section", {
        "aria-label": "BIOS power-on self-test. Click or press a key to power on",
        "data-screen": "startup-gate",
        tabIndex: 0
      }, {
        position: "absolute",
        zIndex: "2147483641",
        inset: "0",
        boxSizing: "border-box",
        padding: "24px 30px",
        overflow: "hidden",
        color: "#e8e8e8",
        background: "#000",
        cursor: "default",
        outline: "none",
        userSelect: "none"
      });
      const logo = createElement("pre", {
        text: [
          "       ___    __  __  ___",
          "      / _ \\  |  \\/  ||_ _|",
          "     / /_\\ \\ | |\\/| | | |",
          "     |  _  | | |  | | | |",
          "     |_| |_| |_|  |_||___|",
          "       AMERICAN MEGATRENDS"
        ].join("\n")
      }, {
        margin: "0 0 18px",
        color: "#d82525",
        fontFamily: "Consolas, 'Lucida Console', monospace",
        fontSize: "clamp(11px, 1.15vw, 15px)",
        fontWeight: "700",
        lineHeight: "1.05",
        whiteSpace: "pre"
      });
      const postOutput = createElement("pre", {
        "data-bios-output": "",
        text: ""
      }, {
        margin: "0",
        color: "inherit",
        fontFamily: "Consolas, 'Lucida Console', monospace",
        fontSize: "clamp(12px, 1.25vw, 16px)",
        fontWeight: "400",
        lineHeight: "1.35",
        whiteSpace: "pre-wrap"
      });
      const prompt = createElement("p", {
        "data-bios-prompt": "",
        text: "Press any key or click anywhere to power on . . ."
      }, {
        position: "absolute",
        left: "30px",
        bottom: "28px",
        margin: "0",
        color: "#f2f2f2",
        fontFamily: "Consolas, 'Lucida Console', monospace",
        fontSize: "clamp(12px, 1.25vw, 16px)",
        fontWeight: "400",
        whiteSpace: "nowrap"
      });

      screen.append(logo, postOutput, prompt);
      return screen;
    }

    #waitForStartupGesture(screen) {
      return new Promise((resolve) => {
        const controller = new AbortController();
        const begin = () => {
          // Start the real media element silently inside the trusted gesture.
          // It remains playing silently through boot, so revealing its volume
          // on the login screen does not depend on delayed autoplay permission.
          this.#primeStartupAudio();
          const biosAudioFinished = this.#playBiosAudioExcerpt();
          controller.abort();
          void Promise.all([
            this.#animateBiosPost(screen),
            biosAudioFinished
          ]).then(resolve);
        };

        screen.addEventListener("pointerdown", begin, {
          once: true,
          signal: controller.signal
        });
        document.addEventListener("keydown", begin, {
          once: true,
          signal: controller.signal
        });
        screen.focus({ preventScroll: true });
      });
    }

    async #animateBiosPost(screen) {
      const output = screen.querySelector("[data-bios-output]");
      const prompt = screen.querySelector("[data-bios-prompt]");
      if (!output || !prompt) return;

      const messages = [
        "AMIBIOS (C)2026 American Megatrends, Inc.",
        "xDele1ed System BIOS  v7.0.7601",
        "BIOS Date: 07/15/26  Ver: 1.0.0",
        "",
        "CPU: Virtual x64 Processor @ 3.60 GHz",
        "CPU microcode update loaded successfully",
        "Memory frequency: DDR3-1600 MHz",
        "Testing memory: 2048 MB OK",
        "Testing memory: 4096 MB OK",
        "Testing memory: 6144 MB OK",
        "Testing memory: 8192 MB OK",
        "",
        "Initializing USB Controllers ... Done.",
        "USB Devices: 1 Keyboard, 1 Mouse, 2 Hubs",
        "Auto-detecting SATA Port 1 ... Virtual System Disk",
        "Auto-detecting SATA Port 2 ... Virtual DVD-ROM",
        "Checking NVRAM ... OK",
        "Initializing Plug and Play Cards ... Done.",
        "ACPI Controller ... Enabled",
        "Verifying DMI Pool Data ........ Success",
        "",
        "Boot device detected: xDele1ed Virtual System Disk",
        "Starting Windows Boot Manager ..."
      ];

      prompt.textContent = "DEL: BIOS Setup    F12: Boot Menu";
      output.textContent = "";

      for (const message of messages) {
        output.textContent += `${message}\n`;
        await wait(BIOS_LINE_DELAY_MS);
      }

      prompt.textContent = "Booting from virtual system disk . . .";
    }

    #createBootScreen() {
      const screen = createElement("section", {
        "aria-label": "Windows is starting",
        "data-screen": "boot"
      }, {
        position: "absolute",
        zIndex: "2147483640",
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        color: "#fff",
        background: "#000",
        opacity: "1",
        transition: `opacity ${TRANSITION_MS}ms ease`
      });

      const animation = createElement("img", {
        src: ASSETS.bootAnimation,
        alt: "",
        draggable: false
      }, {
        position: "absolute",
        left: "50%",
        top: "42%",
        display: "block",
        width: "288px",
        height: "328px",
        maxWidth: "80vw",
        objectFit: "contain",
        transform: "translate(-50%, -50%)",
        userSelect: "none"
      });
      const label = createElement("p", { text: "Starting Windows" }, {
        position: "absolute",
        left: "50%",
        top: "58.5%",
        margin: "0",
        color: "#fff",
        fontSize: "23px",
        fontWeight: "400",
        letterSpacing: "0.1px",
        transform: "translateX(-50%)",
        whiteSpace: "nowrap",
        textShadow: "0 1px 2px #000"
      });
      const corporation = createElement("p", {
        text: "© xDele1ed Uncorporation"
      }, {
        position: "absolute",
        left: "50%",
        bottom: "15.5%",
        margin: "0",
        color: "#777",
        fontSize: "15px",
        fontWeight: "400",
        letterSpacing: "0.1px",
        transform: "translateX(-50%)",
        whiteSpace: "nowrap"
      });

      screen.append(animation, label, corporation);
      return screen;
    }

    #createLoginScreen() {
      const screen = createElement("section", {
        "aria-label": "Windows log in",
        "data-screen": "login"
      }, {
        position: "absolute",
        zIndex: "2147483640",
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        color: "#fff",
        backgroundColor: "#0877c9",
        backgroundImage: `url("${ASSETS.loginWallpaper}")`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        opacity: "0",
        transition: `opacity ${TRANSITION_MS}ms ease`
      });

      const form = createElement("form", { noValidate: true }, {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "min(92vw, 420px)",
        transform: "translateY(-2vh)"
      });
      const avatarFrame = createElement("div", {}, {
        width: "132px",
        height: "132px",
        boxSizing: "border-box",
        padding: "5px",
        overflow: "hidden",
        border: "1px solid rgba(255, 255, 255, 0.95)",
        borderRadius: "20px",
        background: "linear-gradient(#dceaf3, #7997a7)",
        boxShadow: "0 5px 15px rgba(0, 20, 50, 0.55), inset 0 0 0 1px rgba(0, 0, 0, 0.35)"
      });
      const avatar = createElement("img", {
        src: ASSETS.userAvatar,
        alt: "xDele1ed",
        draggable: false
      }, {
        display: "block",
        width: "120px",
        height: "120px",
        borderRadius: "15px",
        objectFit: "cover"
      });
      const username = createElement("h1", { text: USERNAME }, {
        margin: "16px 0 8px",
        color: "#fff",
        fontSize: "24px",
        fontWeight: "400",
        lineHeight: "1.2",
        textShadow: "0 2px 3px rgba(0, 24, 65, 0.9)"
      });
      const passwordRow = createElement("div", {}, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        width: "min(88vw, 300px)"
      });
      const password = createElement("input", {
        type: "password",
        value: LOGIN_SENTINEL,
        "aria-label": "Password",
        autocomplete: "current-password",
        spellcheck: false
      }, {
        flex: "1",
        minWidth: "0",
        height: "30px",
        boxSizing: "border-box",
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
        fontSize: "15px",
        cursor: "text"
      });
      const submit = createElement("button", {
        type: "submit",
        className: "default",
        "aria-label": "Log in"
      }, {
        width: "38px",
        height: "38px",
        minWidth: "38px",
        padding: "0",
        overflow: "hidden",
        borderRadius: "50%",
        cursor: `url("${ASSETS.cursorLink}") 6 2, pointer`
      });
      const submitIcon = createElement("img", {
        src: ASSETS.rightArrow,
        alt: "",
        draggable: false
      }, {
        display: "block",
        width: "38px",
        height: "38px",
        maxWidth: "none",
        pointerEvents: "none"
      });
      submit.append(submitIcon);
      const error = createElement("p", {
        role: "alert",
        ariaLive: "polite"
      }, {
        minHeight: "18px",
        margin: "8px 0 0",
        color: "#fff",
        fontSize: "13px",
        textAlign: "center",
        textShadow: "0 1px 2px #003d75"
      });

      let credentialsTouched = false;
      password.addEventListener("focus", () => {
        if (!credentialsTouched && password.value === LOGIN_SENTINEL) {
          password.select();
        }
      });
      password.addEventListener("input", () => {
        credentialsTouched = true;
        error.textContent = "";
        password.setAttribute("aria-invalid", "false");
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const presetIsUntouched = !credentialsTouched && password.value === LOGIN_SENTINEL;

        if (presetIsUntouched || password.value === REQUIRED_PASSWORD) {
          void this.#showDesktop();
          return;
        }

        error.textContent = password.value.length === 0
          ? "Enter your password to log in."
          : "The password is incorrect. Try again.";
        password.setAttribute("aria-invalid", "true");
        password.focus();
        password.select();
      });

      avatarFrame.append(avatar);
      passwordRow.append(password, submit);
      form.append(avatarFrame, username, passwordRow, error);
      screen.append(form);
      return screen;
    }

    async #preloadDesktopAssets() {
      const audioByPath = new Map([
        [ASSETS.biosAudio, this.#biosAudio],
        [ASSETS.startupAudio, this.#startupAudio],
        [ASSETS.shutdownAudio, this.#shutdownAudio],
        [ASSETS.loginAudio, this.#loginAudio],
        [ASSETS.criticalStopAudio, this.#criticalStopAudio],
        [ASSETS.navigationAudio, this.#navigationAudio],
        [ASSETS.deskAudio, this.#deskAudio]
      ]);

      const results = await Promise.allSettled(NON_THEME_BOOT_ASSETS.map((path) => {
        const audio = audioByPath.get(path);
        return audio ? this.#preloadAudio(audio) : this.#preloadImage(path);
      }));
      const failures = results.filter(({ status }) => status === "rejected");

      if (failures.length > 0) {
        console.warn(`Windows 7 asset preloader completed with ${failures.length} failure(s).`);
      }
    }

    #prepareAudioElements() {
      this.#biosAudio = new Audio(ASSETS.biosAudio);
      this.#biosAudio.preload = "auto";
      this.#biosAudio.load();

      this.#startupAudio = new Audio(ASSETS.startupAudio);
      this.#startupAudio.preload = "auto";
      this.#startupAudio.load();

      this.#shutdownAudio = new Audio(ASSETS.shutdownAudio);
      this.#shutdownAudio.preload = "auto";
      this.#shutdownAudio.load();

      this.#loginAudio = new Audio(ASSETS.loginAudio);
      this.#loginAudio.preload = "auto";
      this.#loginAudio.load();

      this.#criticalStopAudio = new Audio(ASSETS.criticalStopAudio);
      this.#criticalStopAudio.preload = "auto";
      this.#criticalStopAudio.load();

      this.#navigationAudio = new Audio(ASSETS.navigationAudio);
      this.#navigationAudio.preload = "auto";
      this.#navigationAudio.load();

      this.#deskAudio = new Audio(ASSETS.deskAudio);
      this.#deskAudio.preload = "auto";
      this.#deskAudio.loop = true;
      this.#deskAudio.load();
    }

    #preloadPowerAssets() {
      if (this.#powerAssetPreload) return this.#powerAssetPreload;

      this.#deskImage = new Image();
      this.#deskImage.decoding = "async";
      const imageReady = new Promise((resolve) => {
        const finish = () => {
          this.#deskImage.removeEventListener("load", finish);
          this.#deskImage.removeEventListener("error", finish);
          const decoding = this.#deskImage.naturalWidth > 0
            ? this.#deskImage.decode?.().catch(() => {})
            : null;
          Promise.resolve(decoding).then(resolve);
        };

        if (this.#deskImage.complete && this.#deskImage.naturalWidth > 0) {
          finish();
          return;
        }

        this.#deskImage.addEventListener("load", finish, { once: true });
        this.#deskImage.addEventListener("error", finish, { once: true });
        this.#deskImage.src = ASSETS.deskView;
      });

      const audioReady = new Promise((resolve) => {
        const audio = this.#deskAudio;
        if (!audio || audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
          resolve();
          return;
        }

        const finish = () => {
          audio.removeEventListener("canplaythrough", finish);
          audio.removeEventListener("error", finish);
          resolve();
        };
        audio.addEventListener("canplaythrough", finish, { once: true });
        audio.addEventListener("error", finish, { once: true });
        audio.load();
      });

      this.#powerAssetPreload = Promise.all([imageReady, audioReady]);
      return this.#powerAssetPreload;
    }

    #primeShutdownAudio() {
      if (!this.#shutdownAudio) return;
      this.#shutdownAudio.loop = true;
      this.#shutdownAudio.volume = 0;
      this.#shutdownAudio.currentTime = 0;
      void this.#shutdownAudio.play().catch((error) => {
        console.warn("Unable to unlock shutdown audio during the power gesture.", error);
      });
    }

    #playShutdownAudio() {
      if (!this.#shutdownAudio) return;
      this.#shutdownAudio.loop = false;
      this.#shutdownAudio.currentTime = 0;
      this.#shutdownAudio.volume = 1;
      if (this.#shutdownAudio.paused) {
        void this.#shutdownAudio.play().catch((error) => {
          console.warn("Shutdown audio could not begin.", error);
        });
      }
    }

    #playLoginAudio() {
      if (!this.#loginAudio) return;
      this.#loginAudio.pause();
      this.#loginAudio.loop = false;
      this.#loginAudio.currentTime = 0;
      this.#loginAudio.volume = 1;
      void this.#loginAudio.play().catch((error) => {
        console.warn("Login audio could not begin.", error);
      });
    }

    #primeDeskAudio() {
      if (!this.#deskAudio) return;
      this.#deskAudio.loop = true;
      this.#deskAudio.volume = 0;
      this.#deskAudio.currentTime = 0;
      void this.#deskAudio.play().catch((error) => {
        console.warn("Unable to unlock desk ambience during the shutdown gesture.", error);
      });
    }

    #playDeskAudio() {
      if (!this.#deskAudio) return;
      this.#deskAudio.loop = true;
      this.#deskAudio.volume = 1;
      if (this.#deskAudio.paused) {
        void this.#deskAudio.play().catch((error) => {
          console.warn("Desk ambience could not begin.", error);
        });
      }
    }

    #stopDeskAudio() {
      if (!this.#deskAudio) return;
      this.#deskAudio.pause();
      this.#deskAudio.loop = false;
      this.#deskAudio.currentTime = 0;
      this.#deskAudio.volume = 1;
    }

    #primeBiosAudio() {
      if (!this.#biosAudio) return;
      this.#biosAudio.loop = true;
      this.#biosAudio.volume = 0;
      this.#biosAudio.currentTime = 0;
      void this.#biosAudio.play().catch((error) => {
        console.warn("Unable to unlock BIOS audio during the power gesture.", error);
      });
    }

    #playBiosAudioExcerpt() {
      if (!this.#biosAudio) return Promise.resolve();

      const audio = this.#biosAudio;
      const wasPrimed = !audio.paused;
      if (!wasPrimed) audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
      audio.loop = false;

      return new Promise((resolve) => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          cancelAnimationFrame(this.#biosFadeFrame);
          this.#biosFadeFrame = 0;
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1;
          resolve();
        };
        const updateFade = () => {
          const elapsedMs = audio.currentTime * 1000;
          const fadeStartsAt = BIOS_AUDIO_DURATION_MS - BIOS_AUDIO_FADE_MS;

          if (elapsedMs >= BIOS_AUDIO_DURATION_MS || audio.ended) {
            finish();
            return;
          }

          if (elapsedMs >= fadeStartsAt) {
            const fadeProgress = (elapsedMs - fadeStartsAt) / BIOS_AUDIO_FADE_MS;
            audio.volume = Math.max(0, 1 - fadeProgress);
          }

          this.#biosFadeFrame = requestAnimationFrame(updateFade);
        };

        const playback = audio.play();
        playback?.then(() => {
          this.#biosFadeFrame = requestAnimationFrame(updateFade);
        }).catch((error) => {
          console.warn("BIOS startup audio could not begin.", error);
          finish();
        });
      });
    }

    #primeStartupAudio() {
      if (!this.#startupAudio) return;

      this.#startupAudio.loop = true;
      this.#startupAudio.volume = 0;
      void this.#startupAudio.play().catch((error) => {
        console.warn("Unable to unlock startup audio during the startup gesture.", error);
      });
    }

    #preloadImage(source) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = resolve;
        image.onerror = () => reject(new Error(`Unable to load image: ${source}`));
        image.src = source;
      });
    }

    #preloadAudio(audio) {
      return new Promise((resolve) => {
        if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          resolve();
          return;
        }

        const finish = () => {
          window.clearTimeout(timeout);
          audio.removeEventListener("loadeddata", finish);
          audio.removeEventListener("error", finish);
          resolve();
        };
        const timeout = window.setTimeout(finish, 5000);

        audio.addEventListener("loadeddata", finish, { once: true });
        audio.addEventListener("error", finish, { once: true });
        if (audio.networkState === HTMLMediaElement.NETWORK_EMPTY) {
          audio.load();
        }
      });
    }

    async #showLoginScreen(bootScreen) {
      this.#setState("login");
      this.#loginScreen = this.#createLoginScreen();
      this.#root.append(this.#loginScreen);

      await nextPaint();
      this.#loginScreen.style.opacity = "1";
      bootScreen.style.opacity = "0";
      this.#playStartupAudio();

      await wait(TRANSITION_MS);
      bootScreen.remove();
      this.#loginScreen.querySelector("input")?.focus({ preventScroll: true });
    }

    #playStartupAudio() {
      if (!this.#startupAudio || this.#startupSoundHasPlayed) return;

      // This is deliberately a single attempt made only while entering the
      // login state. Never retry from a later key/click event: the Enter key
      // used to submit the login form must not start the sound on the desktop.
      this.#startupSoundHasPlayed = true;
      this.#startupAudio.loop = false;
      this.#startupAudio.currentTime = STARTUP_AUDIO_OFFSET_SECONDS;
      this.#startupAudio.volume = 1;

      // The primed element should already be running. This fallback only
      // recovers from media suspension; it is never attached to login input.
      if (this.#startupAudio.paused) {
        this.#startupAudio.play().catch((error) => {
          console.warn("Startup audio could not begin on the login screen.", error);
        });
      }
    }

    async #showDesktop() {
      if (this.#state !== "login" || !this.#loginScreen || this.#loginSubmissionInProgress) return;
      this.#loginSubmissionInProgress = true;

      // The startup cue belongs exclusively to the login screen. Stopping it
      // here also prevents a pending browser play request from starting late.
      this.#startupAudio?.pause();
      this.#setState("desktop");
      this.#playLoginAudio();
      this.#desktop.style.visibility = "visible";
      this.#desktop.setAttribute("aria-hidden", "false");
      await nextPaint();

      this.#desktop.style.opacity = "1";
      this.#loginScreen.style.opacity = "0";
      this.#loginScreen.style.pointerEvents = "none";

      await wait(TRANSITION_MS);
      this.#loginScreen.remove();
      this.#loginScreen = null;
      this.#taskbar?.querySelector("[data-start-button]")?.focus({ preventScroll: true });
    }

    #setState(nextState) {
      const transitions = {
        boot: ["login"],
        login: ["desktop"],
        desktop: ["restarting", "shutting-down"],
        restarting: ["no-signal"],
        "shutting-down": ["no-signal"],
        "no-signal": ["boot", "desk-view"],
        "desk-view": ["boot"]
      };

      if (!transitions[this.#state]?.includes(nextState)) {
        throw new Error(`Invalid system transition: ${this.#state} -> ${nextState}`);
      }

      this.#state = nextState;
      this.#root.dataset.state = nextState;
      this.#root.dispatchEvent(new CustomEvent("windows7:statechange", {
        detail: { state: nextState }
      }));
    }

    #bindWindowManager() {
      const options = { signal: this.#listeners.signal };

      this.#desktop.querySelector("[data-credits]")?.addEventListener("click", () => {
        window.location.assign("https://github.com/xdele1edmc14/");
      }, options);

      // A single capture listener raises every window before its child control
      // receives the pointer event.
      this.#desktop.addEventListener("pointerdown", (event) => {
        const windowElement = event.target.closest(".window");
        if (!windowElement || !this.#desktop.contains(windowElement)) return;

        this.#raiseWindow(windowElement);

        const resizeHandle = event.target.closest("[data-resize-edge]");
        if (resizeHandle && event.isPrimary && event.button === 0) {
          this.#beginResize(event, windowElement, resizeHandle);
          return;
        }

        const titleBar = event.target.closest(".title-bar");
        const isControl = event.target.closest("button, input, select, textarea, a, [role='tab']");
        if (titleBar && !isControl && event.isPrimary && event.button === 0) {
          this.#beginDrag(event, windowElement, titleBar);
        }
      }, { ...options, capture: true });

      this.#desktop.addEventListener("pointermove", (event) => {
        this.#updateDrag(event);
        this.#updateResize(event);
        this.#updateShellDrag(event);
      }, options);
      this.#desktop.addEventListener("pointerup", (event) => {
        this.#endDrag(event);
        this.#endResize(event);
        this.#endShellDrag(event);
      }, options);
      this.#desktop.addEventListener("pointercancel", (event) => {
        this.#endDrag(event);
        this.#endResize(event);
        this.#endShellDrag(event);
      }, options);
      this.#desktop.addEventListener("lostpointercapture", (event) => {
        this.#endDrag(event);
        this.#endResize(event);
        this.#endShellDrag(event);
      }, options);

      this.#desktop.addEventListener("dblclick", (event) => {
        const titleBar = event.target.closest(".window > .title-bar");
        if (!titleBar || event.target.closest("button, input, select, textarea, a")) return;
        const windowElement = titleBar.closest(".window");
        const maximize = windowElement?.querySelector(':scope > .title-bar button[aria-label="Maximize"]');
        if (!windowElement || !maximize || maximize.disabled || windowElement.hasAttribute("data-fixed-size")) return;
        event.preventDefault();
        this.#toggleMaximized(windowElement, maximize);
      }, options);

      this.#desktop.addEventListener("click", (event) => {
        const control = event.target.closest(".window .title-bar-controls button[aria-label], .window .win-close");
        if (control) {
          const windowElement = control.closest(".window");
          if (!windowElement) return;

          const action = control.classList.contains("win-close")
            ? "close"
            : control.getAttribute("aria-label")?.toLowerCase();

          if (action === "close") this.#closeWindow(windowElement);
          if (action === "maximize") this.#toggleMaximized(windowElement, control);
          if (action === "minimize") void this.#setMinimized(windowElement, true);
          return;
        }

        const taskButton = event.target.closest(".taskbar-window-button");
        if (taskButton) {
          if (taskButton.dataset.animating === "true") return;
          const windowElement = taskButton.dataset.windowTask
            ? document.getElementById(taskButton.dataset.windowTask)
            : null;
          if (!windowElement) {
            const pinned = this.#pinnedTaskItems.get(taskButton.dataset.pinnedKey);
            if (pinned) this.#openShellItem(pinned.item);
            return;
          }

          const isActive = windowElement.classList.contains("active") &&
            !windowElement.classList.contains("minimized") &&
            !windowElement.hidden;
          if (isActive) void this.#setMinimized(windowElement, true);
          else if (windowElement.classList.contains("minimized") || windowElement.hidden) {
            void this.#setMinimized(windowElement, false, { focus: true });
          } else {
            this.#raiseWindow(windowElement);
            windowElement.focus({ preventScroll: true });
          }
        }
      }, options);

      window.addEventListener("resize", () => this.#handleResize(), options);
    }

    #configureResizeHandles(windowElement) {
      const cursorByEdge = {
        n: [ASSETS.cursorVertical, "32 32", "ns-resize"],
        s: [ASSETS.cursorVertical, "32 32", "ns-resize"],
        e: [ASSETS.cursorHorizontal, "32 32", "ew-resize"],
        w: [ASSETS.cursorHorizontal, "32 32", "ew-resize"],
        ne: [ASSETS.cursorDiagonalUp, "32 32", "nesw-resize"],
        sw: [ASSETS.cursorDiagonalUp, "32 32", "nesw-resize"],
        nw: [ASSETS.cursorDiagonalDown, "32 32", "nwse-resize"],
        se: [ASSETS.cursorDiagonalDown, "32 32", "nwse-resize"]
      };

      Object.entries(cursorByEdge).forEach(([edge, [source, hotspot, fallback]]) => {
        const handle = createElement("div", {
          className: "window-resize-handle",
          "data-resize-edge": edge,
          "aria-hidden": "true"
        });
        handle.style.cursor = `url("${source}") ${hotspot}, ${fallback}`;
        windowElement.append(handle);
      });
    }

    #openAppWindow(appName, { preserveDocument = false } = {}) {
      const windowElement = this.#desktop.querySelector(`[data-app-window="${CSS.escape(appName)}"]`);
      if (!windowElement) return;

      const isClosed = windowElement.hidden && !windowElement.classList.contains("minimized");
      if (isClosed && appName === "calculator") {
        windowElement.dispatchEvent(new Event("calculator:reset"));
      }
      if (isClosed && appName === "cmd") {
        windowElement.dispatchEvent(new Event("cmd:reset"));
      }
      if (isClosed && !preserveDocument && appName === "paint") {
        this.#paintApp?.reset();
      }
      if (isClosed && !preserveDocument && appName === "photo-viewer") {
        this.#photoViewerApp?.showHome();
      }
      if (isClosed && !preserveDocument && appName === "notepad") {
        this.#notepadApp?.reset();
      }
      windowElement.hidden = false;
      if (isClosed) void openAeroWindow(windowElement);
      this.#ensureTaskButton(windowElement);
      if (windowElement.classList.contains("minimized")) {
        void this.#setMinimized(windowElement, false, { focus: true });
        return;
      }
      this.#raiseWindow(windowElement);
      const preferredFocus = appName === "cmd"
        ? windowElement.querySelector("[data-cmd-input]")
        : windowElement.querySelector("button");
      preferredFocus?.focus({ preventScroll: true });
    }

    #capturePinnedItems() {
      if (this.#pinnedTaskItems.size === 0) return [...this.#pendingPinnedItems];
      return [...this.#pinnedTaskItems.values()].flatMap(({ item }) => {
        const appName = item?.type === "app-shortcut" ? item.meta?.appName : null;
        if (appName) return [{ type: "app", appName }];
        return item?.id ? [{ type: "node", nodeId: item.id }] : [];
      });
    }

    #restorePinnedItems() {
      const descriptors = [...this.#pendingPinnedItems];
      this.#pendingPinnedItems = descriptors;
      descriptors.forEach((descriptor) => {
        const item = descriptor.type === "app"
          ? this.#appShortcutDescriptor(descriptor.appName)
          : this.#fileSystem.findById(descriptor.nodeId);
        if (item) this.#pinShellItem(item, { persist: false });
      });
    }

    #pinnedKeyFor(item) {
      if (!item) return null;
      if (item.type === "app-shortcut" && item.meta?.appName) return `app:${item.meta.appName}`;
      return item.id ? `node:${item.id}` : null;
    }

    #pinShellItem(item, { persist = true } = {}) {
      const key = this.#pinnedKeyFor(item);
      if (!key || this.#pinnedTaskItems.has(key) || !this.#taskbar) return this.#pinnedTaskItems.get(key)?.button ?? null;

      const appName = item.type === "app-shortcut" ? item.meta?.appName : null;
      const runningWindow = appName
        ? this.#desktop.querySelector(`[data-app-window="${CSS.escape(appName)}"]:not([hidden])`)
        : null;
      const runningButton = runningWindow ? this.#taskButtonFor(runningWindow) : null;
      const button = runningButton ?? this.#createPinnedTaskButton(item, key);
      if (!button) return null;

      button.classList.add("is-pinned");
      button.dataset.pinnedKey = key;
      if (appName) button.dataset.pinnedApp = appName;
      this.#pinnedTaskItems.set(key, { item, button });
      this.#pendingPinnedItems = this.#capturePinnedItems();
      if (persist) this.#scheduleProfileSave();
      return button;
    }

    #createPinnedTaskButton(item, key) {
      const appName = item.type === "app-shortcut" ? item.meta?.appName : null;
      const app = appName ? APP_SHORTCUTS[appName] : null;
      const icon = app?.icon ?? this.#fileSystemItemIcon(item);
      const glow = app?.glow ?? "80, 174, 232";
      const button = createElement("button", {
        type: "button",
        className: "taskbar-window-button is-pinned",
        title: item.name,
        "aria-label": item.name,
        "aria-pressed": "false",
        "data-pinned-key": key
      });
      button.style.cursor = `url("${ASSETS.cursorLink}") 6 2, pointer`;
      button.style.setProperty("--task-glow-rgb", glow);
      if (appName) button.dataset.pinnedApp = appName;
      button.append(createElement("img", { src: icon, alt: "", draggable: false }, { pointerEvents: "none" }));
      this.#taskbar.insertBefore(button, this.#taskbar.querySelector("[data-system-tray], [data-taskbar-clock]"));
      return button;
    }

    #windowTaskAppearance(windowElement) {
      if (windowElement.dataset.windowKind === "explorer") {
        return { icon: ASSETS.computer, glow: "80, 174, 232" };
      }
      const appName = windowElement.dataset.appWindow;
      const appearances = {
        about: { icon: ASSETS.about, glow: "72, 177, 232" },
        chrome: { icon: ASSETS.chrome, glow: "242, 194, 48" },
        cmd: { icon: ASSETS.cmd, glow: "104, 215, 122" },
        calculator: { icon: ASSETS.calculator, glow: "115, 172, 219" },
        display: { icon: ASSETS.controlPanel, glow: "73, 161, 219" },
        notepad: { icon: ASSETS.notepad, glow: "94, 164, 219" },
        paint: { icon: ASSETS.paint, glow: "238, 178, 62" },
        "photo-viewer": { icon: ASSETS.photoViewer, glow: "79, 177, 232" }
      };
      const embeddedIcon = windowElement.querySelector(".window-body img")?.getAttribute("src");
      return appearances[appName] ?? { icon: embeddedIcon || ASSETS.about, glow: "91, 196, 240" };
    }

    #ensureTaskButton(windowElement) {
      if (!this.#taskbar || !windowElement.id) return null;
      const selector = `[data-window-task="${CSS.escape(windowElement.id)}"]`;
      const existingButton = this.#taskbar.querySelector(selector);
      if (existingButton) {
        existingButton.classList.add("is-running");
        return existingButton;
      }

      const appName = windowElement.dataset.appWindow;
      const pinnedButton = appName
        ? this.#taskbar.querySelector(`[data-pinned-app="${CSS.escape(appName)}"]`)
        : null;
      if (pinnedButton) {
        pinnedButton.dataset.windowTask = windowElement.id;
        pinnedButton.classList.add("is-running");
        this.#syncWindowTaskState(windowElement);
        return pinnedButton;
      }

      const title = windowElement.querySelector(".title-bar-text")?.textContent?.trim() || "Window";
      const appearance = this.#windowTaskAppearance(windowElement);
      const taskButton = createElement("button", {
        type: "button",
        className: "taskbar-window-button is-running",
        title,
        "aria-label": title,
        "aria-pressed": "false",
        "data-window-task": windowElement.id
      });
      taskButton.style.cursor = `url("${ASSETS.cursorLink}") 6 2, pointer`;
      taskButton.style.setProperty("--task-glow-rgb", appearance.glow);
      const taskIcon = createElement("img", {
        src: appearance.icon,
        alt: "",
        draggable: false
      }, { pointerEvents: "none" });
      if (appearance.icon === ASSETS.imageFile) {
        taskIcon.addEventListener("error", () => { taskIcon.src = ASSETS.imageFileFallback; }, { once: true });
      }
      taskButton.append(taskIcon);
      this.#taskbar.insertBefore(taskButton, this.#taskbar.querySelector("[data-system-tray], [data-taskbar-clock]"));
      this.#syncWindowTaskState(windowElement);
      return taskButton;
    }

    #taskButtonFor(windowElement) {
      if (!this.#taskbar || !windowElement.id) return null;
      return this.#taskbar.querySelector(`[data-window-task="${CSS.escape(windowElement.id)}"]`);
    }

    #syncWindowTaskState(windowElement) {
      const taskButton = this.#taskButtonFor(windowElement);
      if (!taskButton) return;
      const isMinimized = windowElement.classList.contains("minimized");
      const isActive = windowElement.classList.contains("active") && !isMinimized;
      taskButton.classList.toggle("is-active", isActive);
      taskButton.classList.toggle("is-minimized", isMinimized);
      taskButton.classList.add("is-running");
      taskButton.setAttribute("aria-pressed", String(isActive));
    }

    #raiseWindow(windowElement) {
      windowElement.style.zIndex = String(++this.#highestZIndex);
      this.#desktop.querySelectorAll(".window.active").forEach((element) => {
        if (element !== windowElement) {
          element.classList.remove("active");
          this.#syncWindowTaskState(element);
        }
      });
      windowElement.classList.add("active");
      this.#syncWindowTaskState(windowElement);
    }

    #beginDrag(event, windowElement, titleBar) {
      if (windowElement.classList.contains("maximized") ||
          windowElement.classList.contains("minimized")) return;

      const desktopRect = this.#desktop.getBoundingClientRect();
      const windowRect = windowElement.getBoundingClientRect();
      const titleBarRect = titleBar.getBoundingClientRect();
      const visibleDesktopHeight = Math.max(0, desktopRect.height - TASKBAR_HEIGHT);

      this.#drag = {
        pointerId: event.pointerId,
        titleBar,
        windowElement,
        originX: windowRect.left - desktopRect.left,
        originY: windowRect.top - desktopRect.top,
        grabOffsetX: event.clientX - windowRect.left,
        grabOffsetY: event.clientY - windowRect.top,
        maxX: Math.max(0, desktopRect.width - windowRect.width),
        // The bottom clamp uses title-bar height rather than window height: the
        // window body may extend below the desktop, but its controls stay visible.
        maxY: Math.max(0, visibleDesktopHeight - titleBarRect.height),
        desktopLeft: desktopRect.left,
        desktopTop: desktopRect.top,
        pendingX: windowRect.left - desktopRect.left,
        pendingY: windowRect.top - desktopRect.top
      };

      titleBar.setPointerCapture(event.pointerId);
      document.body.style.userSelect = "none";
      event.preventDefault();
    }

    #updateDrag(event) {
      const drag = this.#drag;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const desiredX = event.clientX - drag.desktopLeft - drag.grabOffsetX;
      const desiredY = event.clientY - drag.desktopTop - drag.grabOffsetY;

      // Clamp in desktop-local coordinates so the complete title bar remains
      // horizontally visible and between the top edge and taskbar vertically.
      drag.pendingX = Math.min(drag.maxX, Math.max(0, desiredX));
      drag.pendingY = Math.min(drag.maxY, Math.max(0, desiredY));

      if (this.#dragFrame === 0) {
        this.#dragFrame = requestAnimationFrame(() => this.#renderDrag());
      }
    }

    #renderDrag() {
      this.#dragFrame = 0;
      if (!this.#drag) return;

      const deltaX = this.#drag.pendingX - this.#drag.originX;
      const deltaY = this.#drag.pendingY - this.#drag.originY;
      this.#drag.windowElement.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
    }

    #endDrag(event) {
      const drag = this.#drag;
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (this.#dragFrame !== 0) {
        cancelAnimationFrame(this.#dragFrame);
        this.#dragFrame = 0;
      }

      // Commit the last transform to left/top once. Pointer moves never read
      // layout, which avoids read/write thrashing while dragging.
      drag.windowElement.style.transform = "none";
      drag.windowElement.style.left = `${drag.pendingX}px`;
      drag.windowElement.style.top = `${drag.pendingY}px`;
      if (drag.titleBar.hasPointerCapture(drag.pointerId)) {
        drag.titleBar.releasePointerCapture(drag.pointerId);
      }

      this.#drag = null;
      document.body.style.userSelect = "";
    }

    #cancelDrag() {
      if (!this.#drag) return;
      const { windowElement } = this.#drag;
      windowElement.style.transform = "none";
      this.#drag = null;
      cancelAnimationFrame(this.#dragFrame);
      this.#dragFrame = 0;
      document.body.style.userSelect = "";
    }

    #beginResize(event, windowElement, handle) {
      if (windowElement.classList.contains("maximized") ||
          windowElement.classList.contains("minimized")) return;

      const desktopRect = this.#desktop.getBoundingClientRect();
      const windowRect = windowElement.getBoundingClientRect();
      const computed = getComputedStyle(windowElement);
      const availableHeight = Math.max(1, desktopRect.height - TASKBAR_HEIGHT);
      const minWidth = Math.min(parseFloat(computed.minWidth) || 360, desktopRect.width);
      const minHeight = Math.min(parseFloat(computed.minHeight) || 240, availableHeight);

      this.#resize = {
        pointerId: event.pointerId,
        handle,
        windowElement,
        edge: handle.dataset.resizeEdge,
        startX: event.clientX,
        startY: event.clientY,
        left: windowRect.left - desktopRect.left,
        top: windowRect.top - desktopRect.top,
        width: windowRect.width,
        height: windowRect.height,
        minWidth,
        minHeight,
        desktopWidth: desktopRect.width,
        availableHeight,
        pendingRect: null
      };
      handle.setPointerCapture(event.pointerId);
      document.body.style.userSelect = "none";
      event.preventDefault();
    }

    #updateResize(event) {
      const resize = this.#resize;
      if (!resize || event.pointerId !== resize.pointerId) return;

      const deltaX = event.clientX - resize.startX;
      const deltaY = event.clientY - resize.startY;
      let left = resize.left;
      let top = resize.top;
      let right = resize.left + resize.width;
      let bottom = resize.top + resize.height;

      if (resize.edge.includes("e")) {
        right = Math.min(resize.desktopWidth, Math.max(left + resize.minWidth, right + deltaX));
      }
      if (resize.edge.includes("s")) {
        bottom = Math.min(resize.availableHeight, Math.max(top + resize.minHeight, bottom + deltaY));
      }
      if (resize.edge.includes("w")) {
        left = Math.max(0, Math.min(right - resize.minWidth, left + deltaX));
      }
      if (resize.edge.includes("n")) {
        top = Math.max(0, Math.min(bottom - resize.minHeight, top + deltaY));
      }

      resize.pendingRect = {
        left,
        top,
        width: right - left,
        height: bottom - top
      };
      if (this.#resizeFrame === 0) {
        this.#resizeFrame = requestAnimationFrame(() => this.#renderResize());
      }
    }

    #renderResize() {
      this.#resizeFrame = 0;
      if (!this.#resize?.pendingRect) return;
      const { left, top, width, height } = this.#resize.pendingRect;
      assignStyles(this.#resize.windowElement, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        transform: "none"
      });
    }

    #endResize(event) {
      const resize = this.#resize;
      if (!resize || event.pointerId !== resize.pointerId) return;

      if (this.#resizeFrame !== 0) {
        cancelAnimationFrame(this.#resizeFrame);
        this.#resizeFrame = 0;
      }
      this.#renderResize();
      if (resize.handle.hasPointerCapture(resize.pointerId)) {
        resize.handle.releasePointerCapture(resize.pointerId);
      }
      this.#resize = null;
      document.body.style.userSelect = "";
    }

    #cancelResize() {
      if (!this.#resize) return;
      this.#resize = null;
      cancelAnimationFrame(this.#resizeFrame);
      this.#resizeFrame = 0;
      document.body.style.userSelect = "";
    }

    async #closeWindow(windowElement, { force = false } = {}) {
      if (windowElement.classList.contains("closing")) return;
      if (!force && windowElement.dataset.appWindow === "paint" && this.#paintApp && !this.#paintApp.requestClose()) {
        return;
      }
      if (!force && windowElement.dataset.appWindow === "notepad" && this.#notepadApp && !this.#notepadApp.requestClose()) {
        return;
      }
      if (this.#drag?.windowElement === windowElement) this.#cancelDrag();
      if (this.#resize?.windowElement === windowElement) this.#cancelResize();
      this.#windowAnimations.get(windowElement)?.cancel();
      this.#windowAnimations.delete(windowElement);

      await closeAeroWindow(windowElement);

      const explorerState = this.#explorerWindows.get(windowElement.id);
      if (explorerState) {
        explorerState.marquee?.destroy();
        explorerState.controller.abort();
        this.#explorerWindows.delete(windowElement.id);
      }
      if (windowElement.dataset.appWindow === "cmd") {
        windowElement.dispatchEvent(new Event("cmd:close"));
      }
      if (windowElement.dataset.appWindow === "paint") this.#paintApp?.onWindowClosed();
      if (windowElement.dataset.appWindow === "photo-viewer") this.#photoViewerApp?.onWindowClosed();
      if (windowElement.dataset.appWindow === "notepad") this.#notepadApp?.onWindowClosed();
      const taskButton = this.#taskButtonFor(windowElement);
      if (taskButton?.classList.contains("is-pinned")) {
        delete taskButton.dataset.windowTask;
        taskButton.classList.remove("is-running", "is-active", "is-minimized", "is-animating");
        taskButton.setAttribute("aria-pressed", "false");
        const pinned = this.#pinnedTaskItems.get(taskButton.dataset.pinnedKey);
        if (pinned) {
          taskButton.title = pinned.item.name;
          taskButton.setAttribute("aria-label", pinned.item.name);
        }
      } else {
        taskButton?.remove();
      }
      if (windowElement.dataset.appWindow) {
        windowElement.hidden = true;
        windowElement.classList.remove("active", "minimized", "is-window-animating");
        windowElement.style.removeProperty("transform");
        windowElement.style.removeProperty("opacity");
        windowElement.style.removeProperty("transform-origin");
      } else {
        windowElement.remove();
      }
      this.#activateTopVisibleWindow();
    }

    #toggleMaximized(windowElement, control) {
      const shouldMaximize = !windowElement.classList.contains("maximized");

      if (shouldMaximize) {
        if (windowElement.classList.contains("minimized")) return;

        windowElement.dataset.restoreRect = JSON.stringify({
          left: windowElement.style.left,
          top: windowElement.style.top,
          width: windowElement.style.width,
          height: windowElement.style.height
        });
        windowElement.classList.add("maximized");
        this.#layoutMaximizedWindow(windowElement);
      } else {
        windowElement.classList.remove("maximized");
        const fallback = { left: "24px", top: "24px", width: "760px", height: "500px" };
        let restoreRect = fallback;

        try {
          restoreRect = JSON.parse(windowElement.dataset.restoreRect) ?? fallback;
        } catch {
          restoreRect = fallback;
        }
        assignStyles(windowElement, restoreRect);
        delete windowElement.dataset.restoreRect;
      }

      control.setAttribute("aria-pressed", String(shouldMaximize));
      this.#raiseWindow(windowElement);
    }

    #layoutMaximizedWindow(windowElement) {
      assignStyles(windowElement, {
        left: "0",
        top: "0",
        width: `${this.#desktop.clientWidth}px`,
        height: `${Math.max(1, this.#desktop.clientHeight - TASKBAR_HEIGHT)}px`,
        transform: "none"
      });
    }

    #toggleMinimized(windowElement) {
      void this.#setMinimized(windowElement, !windowElement.classList.contains("minimized"));
    }

    async #setMinimized(windowElement, shouldMinimize, { focus = false } = {}) {
      const isMinimized = windowElement.classList.contains("minimized");
      if (shouldMinimize === isMinimized && !this.#windowAnimations.has(windowElement)) {
        if (!shouldMinimize && focus) this.#raiseWindow(windowElement);
        return;
      }

      if (this.#drag?.windowElement === windowElement) this.#cancelDrag();
      if (this.#resize?.windowElement === windowElement) this.#cancelResize();

      const taskButton = this.#ensureTaskButton(windowElement);
      if (!taskButton) return;
      this.#windowAnimations.get(windowElement)?.cancel();

      if (!shouldMinimize) {
        windowElement.hidden = false;
        windowElement.classList.remove("minimized");
        if (windowElement.classList.contains("maximized")) this.#layoutMaximizedWindow(windowElement);
      }

      const windowRect = windowElement.getBoundingClientRect();
      const taskRect = taskButton.getBoundingClientRect();
      const targetScale = WINDOW_MINIMIZED_SCALE;
      const targetX = taskRect.left + taskRect.width / 2;
      const targetY = taskRect.top + taskRect.height / 2;
      const translateX = targetX - (windowRect.left + windowRect.width * targetScale / 2);
      const translateY = targetY - (windowRect.top + windowRect.height * targetScale / 2);
      const endpoint = {
        transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${targetScale})`,
        opacity: 0
      };
      const resting = { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 };
      const keyframes = shouldMinimize ? [resting, endpoint] : [endpoint, resting];
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      windowElement.classList.add("is-window-animating");
      windowElement.style.transformOrigin = "0 0";
      taskButton.dataset.animating = "true";
      taskButton.classList.add("is-animating");

      let animation = null;
      if (!reduceMotion && typeof windowElement.animate === "function") {
        animation = windowElement.animate(keyframes, {
          duration: WINDOW_ANIMATION_MS,
          easing: WINDOW_ANIMATION_EASING,
          fill: "both"
        });
        this.#windowAnimations.set(windowElement, animation);
        try {
          await animation.finished;
        } catch {
          if (this.#windowAnimations.get(windowElement) !== animation) return;
        }
        if (this.#windowAnimations.get(windowElement) !== animation) return;
      }

      this.#windowAnimations.delete(windowElement);
      animation?.cancel();
      windowElement.classList.remove("is-window-animating");
      windowElement.style.removeProperty("transform-origin");
      windowElement.style.removeProperty("transform");
      windowElement.style.removeProperty("opacity");
      delete taskButton.dataset.animating;
      taskButton.classList.remove("is-animating");

      if (shouldMinimize) {
        windowElement.classList.add("minimized");
        windowElement.classList.remove("active");
        windowElement.hidden = true;
        this.#syncWindowTaskState(windowElement);
        this.#activateTopVisibleWindow();
      } else {
        windowElement.classList.remove("minimized");
        windowElement.hidden = false;
        this.#raiseWindow(windowElement);
        if (focus) windowElement.querySelector("button, input, [tabindex]")?.focus({ preventScroll: true });
      }

      const minimizeControl = windowElement.querySelector('button[aria-label="Minimize"]');
      minimizeControl?.setAttribute("aria-pressed", String(shouldMinimize));
    }

    #activateTopVisibleWindow() {
      const candidates = [...this.#desktop.querySelectorAll(".window")]
        .filter((element) => !element.hidden && !element.classList.contains("minimized"));
      const nextWindow = candidates.sort((first, second) =>
        (Number(second.style.zIndex) || 0) - (Number(first.style.zIndex) || 0))[0];
      if (nextWindow) this.#raiseWindow(nextWindow);
    }

    #handleResize() {
      this.#desktop.querySelectorAll(".window").forEach((windowElement) => {
        if (windowElement.classList.contains("maximized")) {
          this.#layoutMaximizedWindow(windowElement);
          return;
        }

        const rect = windowElement.getBoundingClientRect();
        const maxLeft = Math.max(0, this.#desktop.clientWidth - rect.width);
        const titleBarHeight = windowElement.querySelector(".title-bar")?.offsetHeight ?? 30;
        const maxTop = Math.max(0, this.#desktop.clientHeight - TASKBAR_HEIGHT - titleBarHeight);
        windowElement.style.left = `${Math.min(maxLeft, Math.max(0, rect.left))}px`;
        windowElement.style.top = `${Math.min(maxTop, Math.max(0, rect.top))}px`;
      });
    }

    #updateClock() {
      const clock = this.#taskbar?.querySelector("[data-taskbar-clock]");
      if (!clock) return;

      const now = new Date();
      const time = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit"
      }).format(now);
      const date = new Intl.DateTimeFormat(undefined, {
        month: "numeric",
        day: "numeric",
        year: "numeric"
      }).format(now);

      clock.replaceChildren(
        document.createTextNode(time),
        document.createElement("br"),
        document.createTextNode(date)
      );
      clock.dateTime = now.toISOString();
      if (this.#trayTooltip && !this.#trayTooltip.hidden) {
        this.#trayTooltip.textContent = this.#formatLongDate(now);
      }
    }
  }

  window.Windows7Shell = Object.freeze({ ShellFileSystem, Windows7Engine });

  const root = document.getElementById("windows-7-root");
  if (root) {
    const engine = new Windows7Engine(root);
    void engine.start().catch((error) => {
      console.error("Windows 7 engine failed to start.", error);
    });
  }
})();
