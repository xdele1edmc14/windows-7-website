(() => {
  "use strict";

  const ASSETS = Object.freeze({
    // Document-relative URLs work both from file:/// and from a web server,
    // including deployments mounted below the server root.
    bootAnimation: "./assets/STARTLUP_ANIMATION.apng",
    startupAudio: "./assets/windows-7-startup.mp3",
    criticalStopAudio: "./assets/Windows Critical Stop.wav",
    wallpaper: "./assets/img0.png",
    loginWallpaper: "./assets/login_screen_wallpaper.jpg",
    userAvatar: "./assets/user_icon.png",
    startOrb: "./assets/start_menu_orb_unpressed.png",
    startOrbHover: "./assets/start_menu_orb_hovered.png",
    startOrbPressed: "./assets/start_menu_orb_pressed.png",
    networkIcon: "./assets/icons/network.png",
    networkTypeIcon: "./assets/icons/chair.png",
    speakerHardware: "./assets/icons/speaker.png",
    volumeFull: "./assets/icons/Volfull.png",
    volumeMid: "./assets/icons/VolMid.png",
    volumeLow: "./assets/icons/VolLow.png",
    volumeMuted: "./assets/icons/novol.png",
    folderEmpty: "./assets/icons/Folder_empty.png",
    folderFull: "./assets/icons/Folder_Full.png",
    recycleEmpty: "./assets/icons/recycle_empty.png",
    recycleFull: "./assets/icons/recycle_full.png",
    textFile: "./assets/icons/textfile.png",
    contextDisplay: "./assets/icons/networkicon.png",
    contextGadgets: "./assets/icons/gadgets.png",
    contextPersonalize: "./assets/icons/personalize.png",
    cursorArrow: "./cursors/aero_arrow-001.png",
    cursorLink: "./cursors/aero_link-001.png",
    cursorMove: "./cursors/aero_move-001.png",
    cursorHorizontal: "./cursors/aero_ew-001.png",
    cursorVertical: "./cursors/aero_ns-001.png",
    cursorDiagonalDown: "./cursors/aero_nwse-001.png",
    cursorDiagonalUp: "./cursors/aero_nesw-001.png",
    cursorHelp: "./cursors/aero_helpsel-001.png",
    cursorUnavailable: "./cursors/aero_unavail-001.png"
  });

  const LOGIN_SENTINEL = "••••••••";
  const REQUIRED_PASSWORD = "12345";
  const TASKBAR_HEIGHT = 40;
  const TRANSITION_MS = 600;
  const BOOT_DURATION_MS = 7000;

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
    #listeners = new AbortController();

    constructor(container, state, { onStart = null, onChange = null } = {}) {
      this.#container = container;
      this.#state = state;
      this.#onStart = onStart;
      this.#onChange = onChange;
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
      if (event.button !== 0 || event.target.closest("[data-desktop-item-id], input, [data-desktop-context-menu]")) return;

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

  class Windows7Engine {
    #root;
    #desktop;
    #taskbar;
    #state = "boot";
    #highestZIndex = 100;
    #drag = null;
    #dragFrame = 0;
    #startupAudio = null;
    #criticalStopAudio = null;
    #startupSoundHasPlayed = false;
    #audioUnlockController = null;
    #loginScreen = null;
    #clockTimer = 0;
    #analogClockTimer = 0;
    #trayFlyout = null;
    #trayFlyoutOwner = null;
    #trayTooltip = null;
    #volumeIcon = null;
    #volume = 100;
    #desktopIconLayer = null;
    #desktopContextMenu = null;
    #desktopFileInput = null;
    #desktopItems = [];
    #recycleBinState = [];
    #selectedDesktopItemId = null;
    #desktopItemDrag = null;
    #desktopItemDragFrame = 0;
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
    #desktopClipboard = null;
    #contextMenuPoint = { x: 16, y: 96 };
    #listeners = new AbortController();
    #minimizedChildren = new WeakMap();

    constructor(root) {
      this.#root = root;
      this.#desktop = root.querySelector("[data-desktop]");
      this.#taskbar = this.#desktop?.querySelector("[data-taskbar]") ?? null;

      if (!this.#desktop) {
        throw new Error("Windows7Engine requires a [data-desktop] element.");
      }
    }

    async start() {
      this.#configureRoot();
      this.#configureDesktop();
      this.#configureDesktopItems();
      this.#bindWindowManager();

      const bootScreen = this.#createBootScreen();
      this.#root.append(bootScreen);

      // Asset loading and a short authentic boot hold run concurrently. The
      // transition cannot advance until both have completed.
      await Promise.all([this.#preloadDesktopAssets(), wait(BOOT_DURATION_MS)]);
      await this.#showLoginScreen(bootScreen);
    }

    destroy() {
      this.#cancelDrag();
      this.#cancelDesktopItemDrag();
      this.#desktopMarquee?.destroy();
      this.#listeners.abort();
      this.#audioUnlockController?.abort();
      window.clearInterval(this.#clockTimer);
      window.clearInterval(this.#analogClockTimer);
      window.clearTimeout(this.#desktopRefreshTimer);
      this.#startupAudio?.pause();
      this.#criticalStopAudio?.pause();
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
        backgroundColor: "#0877c9",
        backgroundImage: `url("${ASSETS.wallpaper}")`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover"
      });

      this.#desktop.querySelectorAll(".window").forEach((windowElement, index) => {
        const desktopWidth = this.#desktop.clientWidth || window.innerWidth;
        const desktopHeight = this.#desktop.clientHeight || window.innerHeight;
        const width = Math.min(820, Math.max(1, desktopWidth - 32));
        const height = Math.min(520, Math.max(1, desktopHeight - TASKBAR_HEIGHT - 32));

        assignStyles(windowElement, {
          position: "absolute",
          zIndex: "100",
          left: `${Math.max(0, (desktopWidth - width) / 2 + index * 24)}px`,
          top: `${Math.max(0, (desktopHeight - TASKBAR_HEIGHT - height) / 2 + index * 24)}px`,
          width: `${width}px`,
          height: `${height}px`,
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
      });

      this.#configureTaskbar();
      this.#configureSystemTray();
      this.#updateClock();
      this.#clockTimer = window.setInterval(() => this.#updateClock(), 30_000);
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

      this.#desktopItems = [{
        id: "recycle-bin",
        type: "recycle",
        name: "Recycle Bin",
        x: 10,
        y: 10,
        parentId: null,
        children: [],
        permanent: true,
        isSelected: false,
        isDropTarget: false
      }];
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
        const item = this.#desktopItems.find(({ id }) => id === itemId);
        if (!item) return;
        if (event.shiftKey) {
          item.isSelected = !item.isSelected;
          this.#selectedDesktopItemId = item.isSelected
            ? item.id
            : this.#desktopItems.find(({ isSelected }) => isSelected)?.id ?? null;
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
        const item = this.#desktopItems.find(({ id }) => id === itemId);
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
        const selectedDeletableItems = this.#desktopItems.filter(({ isSelected, permanent, parentId }) =>
          isSelected && !permanent && parentId === null);
        if (event.key === "Delete" && !editingText && selectedDeletableItems.length > 0) {
          event.preventDefault();
          this.#deleteDesktopItems(selectedDeletableItems.map(({ id }) => id));
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
      this.#desktopItems
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

    #desktopItemIcon(item) {
      if (item.type === "recycle") {
        return this.#recycleBinState.length > 0 ? ASSETS.recycleFull : ASSETS.recycleEmpty;
      }
      if (item.type === "folder") {
        return item.children.length > 0 ? ASSETS.folderFull : ASSETS.folderEmpty;
      }
      return ASSETS.textFile;
    }

    #selectDesktopItem(itemId) {
      this.#desktopItems.forEach((item) => {
        item.isSelected = item.id === itemId;
      });
      this.#selectedDesktopItemId = itemId;
      this.#syncDesktopSelectionStyles();
    }

    #clearDesktopSelection() {
      this.#desktopItems.forEach((item) => {
        item.isSelected = false;
      });
      this.#selectedDesktopItemId = null;
      this.#syncDesktopSelectionStyles();
    }

    #syncDesktopSelectionStyles() {
      this.#desktopIconLayer?.querySelectorAll("[data-desktop-item-id]").forEach((icon) => {
        const item = this.#desktopItems.find(({ id }) => id === icon.dataset.desktopItemId);
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

      this.#desktopItems.forEach((item) => {
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
      const selectedItems = this.#desktopItems.filter(({ isSelected, parentId }) =>
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
      const dropTargets = hasDroppableItems ? this.#desktopItems
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
        hoverTargetId: null
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
      this.#updateDesktopDropTarget(drag);
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
      const dropTarget = this.#desktopItems.find(({ id }) => id === drag.hoverTargetId);

      drag.entries.forEach(({ element: itemElement }) => {
        itemElement.style.transform = "none";
      });
      if (drag.captureElement.hasPointerCapture(drag.pointerId)) {
        drag.captureElement.releasePointerCapture(drag.pointerId);
      }
      this.#desktopItemDrag = null;
      this.#setDesktopDropTarget(null);
      document.body.style.userSelect = "";

      const movableItems = drag.entries
        .map(({ item }) => item)
        .filter(({ permanent }) => !permanent);

      if (dropTarget?.type === "recycle" && movableItems.length > 0) {
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
        drag.entries.forEach((entry) => {
          entry.item.x = entry.initialX + finalDeltaX;
          entry.item.y = entry.initialY + finalDeltaY;
        });
        this.#renderDesktopItems();
      }
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
      document.body.style.userSelect = "";
    }

    #updateDesktopDropTarget(drag) {
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
      this.#desktopItems.forEach((item) => {
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

    #moveDesktopItemsIntoFolder(items, folder) {
      items.filter(({ permanent }) => !permanent).forEach((item) => {
        if (item.parentId) {
          const oldParent = this.#desktopItems.find(({ id }) => id === item.parentId);
          if (oldParent) oldParent.children = oldParent.children.filter((child) => child.id !== item.id);
        }
        item.parentId = folder.id;
        item.isSelected = false;
        item.isDropTarget = false;
        if (!folder.children.some((child) => child.id === item.id)) folder.children.push(item);
      });
      this.#desktopItems.forEach((item) => {
        item.isSelected = false;
        item.isDropTarget = false;
      });
      this.#selectedDesktopItemId = null;
      this.#renderDesktopItems();
    }

    #addDesktopItem(type, requestedName, file = null, preferredPoint = null, beginRename = true) {
      const name = this.#uniqueDesktopName(requestedName, type);
      const point = this.#findAvailableDesktopPoint(preferredPoint ?? this.#contextMenuPoint);
      this.#desktopItems.forEach((existingItem) => {
        existingItem.isSelected = false;
        existingItem.isDropTarget = false;
      });
      const item = {
        id: `desktop-item-${++this.#desktopItemSequence}`,
        type,
        name,
        x: point.x,
        y: point.y,
        parentId: null,
        children: [],
        permanent: false,
        isSelected: true,
        isDropTarget: false,
        file
      };
      this.#desktopItems.push(item);
      this.#selectedDesktopItemId = item.id;
      this.#renderDesktopItems();
      if (beginRename) requestAnimationFrame(() => this.#beginDesktopRename(item.id));
      return item;
    }

    #uniqueDesktopName(requestedName, type, excludedId = null) {
      const names = new Set(this.#desktopItems
        .filter(({ id, parentId }) => id !== excludedId && parentId === null)
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
      const visibleItems = this.#desktopItems.filter(({ id, parentId }) =>
        parentId === null && id !== excludedId);

      for (let attempt = 0; attempt < 120; attempt += 1) {
        const occupied = visibleItems.some((item) =>
          Math.abs(item.x - x) < metrics.width * 0.7 && Math.abs(item.y - y) < metrics.height * 0.7);
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
      const item = this.#desktopItems.find(({ id }) => id === itemId);
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
        item.name = this.#uniqueDesktopName(requested, item.type, item.id);
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
      this.#desktopItems
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
      this.#desktopItems.filter(({ parentId }) => parentId === null).forEach((item) => {
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
          } },
          { label: "Align icons to grid", checked: this.#desktopAlignToGrid, action: () => {
            this.#desktopAlignToGrid = !this.#desktopAlignToGrid;
            this.#constrainDesktopItems();
          } }
        ] },
        { label: "Sort by", submenu: [
          { label: "Name", action: () => this.#sortDesktopItems("name") },
          { label: "Item type", action: () => this.#sortDesktopItems("type") }
        ] },
        { label: "Refresh", action: () => this.#refreshDesktopIcons() },
        { separator: true },
        { label: "Copy", disabled: !this.#selectedDesktopItemId, action: () => this.#copyDesktopItem(this.#selectedDesktopItemId) },
        { label: "Paste", disabled: !this.#desktopClipboard, action: () => this.#pasteDesktopItem() },
        { label: "Paste shortcut", disabled: true },
        { separator: true },
        { label: "Upload files here", action: () => this.#desktopFileInput?.click() },
        { label: "New", submenu: [
          { label: "Folder", icon: ASSETS.folderEmpty, action: () => this.#addDesktopItem("folder", "New Folder") },
          { label: "Text Document", icon: ASSETS.textFile, action: () => this.#addDesktopItem("text", "New Text Document.txt") }
        ] },
        { separator: true },
        { label: "Screen Resolution / Display", icon: ASSETS.contextDisplay, action: () => this.#emitDesktopPlaceholder("display") },
        { label: "Gadgets", icon: ASSETS.contextGadgets, action: () => this.#emitDesktopPlaceholder("gadgets") },
        { label: "Personalize", icon: ASSETS.contextPersonalize, action: () => this.#emitDesktopPlaceholder("personalize") }
      ];
    }

    #desktopItemMenu(itemId) {
      const item = this.#desktopItems.find(({ id }) => id === itemId);
      if (!item) return [];
      if (item.type === "recycle") {
        return [
          { label: "Open", action: () => this.#emitDesktopPlaceholder("open-recycle-bin") },
          { label: "Empty Recycle Bin", disabled: this.#recycleBinState.length === 0, action: () => {
            this.#recycleBinState = [];
            this.#renderDesktopItems();
          } },
          { separator: true },
          { label: "Properties", action: () => this.#emitDesktopPlaceholder("recycle-properties") }
        ];
      }
      return [
        { label: "Open", action: () => this.#emitDesktopPlaceholder(`open-${item.type}`) },
        { separator: true },
        { label: "Copy", action: () => this.#copyDesktopItem(item.id) },
        { label: "Delete", action: () => this.#deleteDesktopItem(item.id) },
        { label: "Rename", action: () => requestAnimationFrame(() => this.#beginDesktopRename(item.id)) },
        { separator: true },
        { label: "Properties", action: () => this.#emitDesktopPlaceholder(`${item.type}-properties`) }
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
    }

    #sortDesktopItems(property) {
      this.#desktopItems.sort((a, b) => {
        if (a.permanent !== b.permanent) return a.permanent ? -1 : 1;
        return String(a[property]).localeCompare(String(b[property]), undefined, { sensitivity: "base" });
      });
      this.#desktopAutoArrange = true;
      this.#renderDesktopItems();
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

    #copyDesktopItem(itemId) {
      const item = this.#desktopItems.find(({ id }) => id === itemId);
      if (!item || item.permanent) return;
      this.#desktopClipboard = {
        type: item.type,
        name: item.name,
        file: item.file ?? null
      };
    }

    #pasteDesktopItem() {
      if (!this.#desktopClipboard) return;
      this.#addDesktopItem(
        this.#desktopClipboard.type,
        this.#desktopClipboard.name,
        this.#desktopClipboard.file,
        this.#contextMenuPoint,
        false
      );
    }

    #deleteDesktopItem(itemId) {
      this.#deleteDesktopItems([itemId]);
    }

    #deleteDesktopItems(itemIds) {
      const requestedIds = new Set(itemIds);
      const rootItems = this.#desktopItems.filter(({ id, permanent }) =>
        requestedIds.has(id) && !permanent);
      if (rootItems.length === 0) return;

      const deletedIds = new Set(rootItems.map(({ id }) => id));
      let foundDescendant = true;
      while (foundDescendant) {
        foundDescendant = false;
        this.#desktopItems.forEach((candidate) => {
          if (candidate.parentId && deletedIds.has(candidate.parentId) && !deletedIds.has(candidate.id)) {
            deletedIds.add(candidate.id);
            foundDescendant = true;
          }
        });
      }
      rootItems.forEach((item) => {
        item.deletedAt = new Date();
        item.isSelected = false;
        item.isDropTarget = false;
        this.#recycleBinState.push(item);
        if (item.parentId) {
          const parent = this.#desktopItems.find(({ id }) => id === item.parentId);
          if (parent) parent.children = parent.children.filter((child) => child.id !== item.id);
        }
      });
      this.#desktopItems = this.#desktopItems.filter(({ id }) => !deletedIds.has(id));
      this.#desktopItems.forEach((item) => {
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
        background: "linear-gradient(rgba(30, 82, 133, 0.78), rgba(5, 36, 73, 0.88))",
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
          fontSize: "12px",
          lineHeight: "15px",
          textAlign: "center",
          textShadow: "0 1px 2px #000"
        });
      }
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
        marginTop: "-3px",
        marginBottom: "-3px"
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
        padding: "2px 7px"
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
        minWidth: "34px",
        height: "40px",
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

    #playCriticalStop() {
      if (!this.#criticalStopAudio) return;
      this.#criticalStopAudio.pause();
      this.#criticalStopAudio.loop = false;
      this.#criticalStopAudio.currentTime = 0;
      void this.#criticalStopAudio.play().catch(() => {});
    }

    #formatLongDate(date) {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(date);
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
        border: "1px solid rgba(255, 255, 255, 0.95)",
        borderRadius: "9px",
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
        borderRadius: "5px",
        objectFit: "cover"
      });
      const username = createElement("h1", { text: "xDele1ed" }, {
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
        text: "→",
        "aria-label": "Log in"
      }, {
        width: "34px",
        height: "34px",
        minWidth: "34px",
        padding: "0",
        borderRadius: "50%",
        fontSize: "23px",
        lineHeight: "28px",
        cursor: `url("${ASSETS.cursorLink}") 6 2, pointer`
      });
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
      const imagePaths = Object.entries(ASSETS)
        .filter(([name]) => !name.endsWith("Audio"))
        .map(([, path]) => path);

      this.#startupAudio = new Audio();
      this.#startupAudio.preload = "auto";
      this.#startupAudio.src = ASSETS.startupAudio;
      this.#criticalStopAudio = new Audio();
      this.#criticalStopAudio.preload = "auto";
      this.#criticalStopAudio.src = ASSETS.criticalStopAudio;

      const results = await Promise.allSettled([
        ...imagePaths.map((path) => this.#preloadImage(path)),
        this.#preloadAudio(this.#startupAudio),
        this.#preloadAudio(this.#criticalStopAudio)
      ]);
      const failures = results.filter(({ status }) => status === "rejected");

      if (failures.length > 0) {
        console.warn(`Windows 7 asset preloader completed with ${failures.length} failure(s).`);
      }
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
        audio.load();
      });
    }

    async #showLoginScreen(bootScreen) {
      this.#setState("login");
      this.#loginScreen = this.#createLoginScreen();
      this.#root.append(this.#loginScreen);

      await nextPaint();
      this.#loginScreen.style.opacity = "1";
      bootScreen.style.opacity = "0";

      await wait(TRANSITION_MS);
      bootScreen.remove();
      this.#loginScreen.querySelector("input")?.focus({ preventScroll: true });
      this.#playStartupAudio();
    }

    #playStartupAudio() {
      if (!this.#startupAudio || this.#startupSoundHasPlayed) return;

      const armGestureRetry = () => {
        if (this.#startupSoundHasPlayed || this.#audioUnlockController) return;

        const controller = new AbortController();
        this.#audioUnlockController = controller;
        const retryOnce = () => {
          // Aborting this shared controller removes both unlock listeners, so a
          // later keyboard event cannot replay sound started by a pointer event.
          controller.abort();
          this.#audioUnlockController = null;
          attemptPlayback();
        };

        document.addEventListener("pointerdown", retryOnce, {
          capture: true,
          signal: controller.signal
        });
        document.addEventListener("keydown", retryOnce, {
          capture: true,
          signal: controller.signal
        });
      };
      const attemptPlayback = () => {
        if (!this.#startupAudio || this.#startupSoundHasPlayed) return;

        this.#startupSoundHasPlayed = true;
        this.#startupAudio.loop = false;
        this.#startupAudio.currentTime = 0;
        const playback = this.#startupAudio.play();

        playback?.catch(() => {
          this.#startupSoundHasPlayed = false;
          armGestureRetry();
        });
      };

      attemptPlayback();
    }

    async #showDesktop() {
      if (this.#state !== "login" || !this.#loginScreen) return;

      this.#setState("desktop");
      this.#desktop.style.visibility = "visible";
      this.#desktop.setAttribute("aria-hidden", "false");
      await nextPaint();

      this.#desktop.style.opacity = "1";
      this.#loginScreen.style.opacity = "0";
      this.#loginScreen.style.pointerEvents = "none";

      await wait(TRANSITION_MS);
      this.#loginScreen.remove();
      this.#loginScreen = null;
      this.#desktop.querySelector(".window button")?.focus({ preventScroll: true });
    }

    #setState(nextState) {
      const transitions = {
        boot: ["login"],
        login: ["desktop"],
        desktop: []
      };

      if (!transitions[this.#state].includes(nextState)) {
        throw new Error(`Invalid startup transition: ${this.#state} -> ${nextState}`);
      }

      this.#state = nextState;
      this.#root.dataset.state = nextState;
      this.#root.dispatchEvent(new CustomEvent("windows7:statechange", {
        detail: { state: nextState }
      }));
    }

    #bindWindowManager() {
      const options = { signal: this.#listeners.signal };

      // A single capture listener raises every window before its child control
      // receives the pointer event.
      this.#desktop.addEventListener("pointerdown", (event) => {
        const windowElement = event.target.closest(".window");
        if (!windowElement || !this.#desktop.contains(windowElement)) return;

        this.#raiseWindow(windowElement);

        const titleBar = event.target.closest(".title-bar");
        const isControl = event.target.closest("button, input, select, textarea, a");
        if (titleBar && !isControl && event.isPrimary && event.button === 0) {
          this.#beginDrag(event, windowElement, titleBar);
        }
      }, { ...options, capture: true });

      this.#desktop.addEventListener("pointermove", (event) => {
        this.#updateDrag(event);
      }, options);
      this.#desktop.addEventListener("pointerup", (event) => {
        this.#endDrag(event);
      }, options);
      this.#desktop.addEventListener("pointercancel", (event) => {
        this.#endDrag(event);
      }, options);
      this.#desktop.addEventListener("lostpointercapture", (event) => {
        this.#endDrag(event);
      }, options);

      this.#desktop.addEventListener("click", (event) => {
        const control = event.target.closest("button[aria-label], .win-close");
        if (control) {
          const windowElement = control.closest(".window");
          if (!windowElement) return;

          const action = control.classList.contains("win-close")
            ? "close"
            : control.getAttribute("aria-label")?.toLowerCase();

          if (action === "close") this.#closeWindow(windowElement);
          if (action === "maximize") this.#toggleMaximized(windowElement, control);
          if (action === "minimize") this.#toggleMinimized(windowElement, control);
          return;
        }

        const taskButton = event.target.closest("[data-window-task]");
        if (taskButton) {
          const windowElement = document.getElementById(taskButton.dataset.windowTask);
          if (!windowElement) return;

          if (windowElement.classList.contains("minimized")) {
            this.#setMinimized(windowElement, false);
          }
          this.#raiseWindow(windowElement);
        }
      }, options);

      window.addEventListener("resize", () => this.#handleResize(), options);
    }

    #raiseWindow(windowElement) {
      windowElement.style.zIndex = String(++this.#highestZIndex);
      this.#desktop.querySelectorAll(".window.active").forEach((element) => {
        if (element !== windowElement) element.classList.remove("active");
      });
      windowElement.classList.add("active");
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

    #closeWindow(windowElement) {
      if (this.#drag?.windowElement === windowElement) this.#cancelDrag();

      const taskButton = windowElement.id
        ? this.#desktop.querySelector(`[data-window-task="${CSS.escape(windowElement.id)}"]`)
        : null;
      taskButton?.remove();
      windowElement.remove();
    }

    #toggleMaximized(windowElement, control) {
      const shouldMaximize = !windowElement.classList.contains("maximized");

      if (shouldMaximize) {
        if (windowElement.classList.contains("minimized")) {
          this.#setMinimized(windowElement, false);
        }

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

    #toggleMinimized(windowElement, control) {
      const shouldMinimize = !windowElement.classList.contains("minimized");
      this.#setMinimized(windowElement, shouldMinimize);
      control.setAttribute("aria-pressed", String(shouldMinimize));
    }

    #setMinimized(windowElement, shouldMinimize) {
      const titleBar = windowElement.querySelector(".title-bar");
      const children = [...windowElement.children].filter((child) => child !== titleBar);

      windowElement.classList.toggle("minimized", shouldMinimize);
      if (shouldMinimize) {
        const priorHiddenStates = new Map(children.map((child) => [child, child.hidden]));
        this.#minimizedChildren.set(windowElement, priorHiddenStates);
        children.forEach((child) => { child.hidden = true; });
        windowElement.dataset.restoreHeight = windowElement.style.height;
        windowElement.style.height = `${Math.max(30, titleBar?.offsetHeight ?? 30)}px`;
      } else {
        const priorHiddenStates = this.#minimizedChildren.get(windowElement);
        children.forEach((child) => {
          child.hidden = priorHiddenStates?.get(child) ?? false;
        });
        windowElement.style.height = windowElement.dataset.restoreHeight || windowElement.style.height;
        delete windowElement.dataset.restoreHeight;
        this.#minimizedChildren.delete(windowElement);

        if (windowElement.classList.contains("maximized")) {
          this.#layoutMaximizedWindow(windowElement);
        }
      }
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

  const root = document.getElementById("windows-7-root");
  if (root) {
    const engine = new Windows7Engine(root);
    void engine.start().catch((error) => {
      console.error("Windows 7 engine failed to start.", error);
    });
  }
})();
