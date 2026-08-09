(() => {
  "use strict";

  const PALETTE = Object.freeze([
    "#000000", "#7f7f7f", "#880015", "#ed1c24", "#ff7f27", "#fff200", "#22b14c",
    "#00a2e8", "#3f48cc", "#a349a4", "#ffffff", "#c3c3c3", "#b97a57", "#ffaec9",
    "#ffc90e", "#efe4b0", "#b5e61d", "#99d9ea", "#7092be", "#c8bfe7", "#404040",
    "#808000", "#800080", "#008080", "#800000", "#008000", "#000080", "#f5f5f5"
  ]);
  const IMAGE_ICON = "./assets/icons/image.png";
  const IMAGE_ICON_FALLBACK = "./assets/icons/image.ico";
  const MAX_HISTORY = 20;
  const ZOOM_LEVELS = [1, 1.5, 2, 4];

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const createElement = (tagName, attributes = {}, children = []) => {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([name, value]) => {
      if (name === "className") element.className = value;
      else if (name === "text") element.textContent = value;
      else if (name === "dataset") Object.assign(element.dataset, value);
      else if (name in element) element[name] = value;
      else element.setAttribute(name, value);
    });
    element.append(...(Array.isArray(children) ? children : [children]));
    return element;
  };
  const createImageIcon = () => {
    const image = createElement("img", { src: IMAGE_ICON, alt: "", draggable: false });
    image.addEventListener("error", () => { image.src = IMAGE_ICON_FALLBACK; }, { once: true });
    return image;
  };

  class Windows7PaintApp {
    #window;
    #shell;
    #canvas;
    #context;
    #preview;
    #previewContext;
    #stage;
    #workspace;
    #textEditor;
    #dialogLayer;
    #fileButton;
    #fileMenu;
    #canvasMenu = null;
    #listeners = new AbortController();
    #unsubscribe = null;
    #tool = "pencil";
    #shape = "line";
    #brushStyle = "plain";
    #size = 4;
    #primaryColor = "#000000";
    #secondaryColor = "#ffffff";
    #activeColorTarget = "primary";
    #outlineStyle = "solid";
    #fillStyle = "none";
    #selectMode = "rect";
    #pointer = null;
    #canvasResize = null;
    #undoStack = [];
    #redoStack = [];
    #selection = null;
    #clipboard = null;
    #textBox = null;
    #zoom = 1;
    #dirty = false;
    #currentNode = null;
    #currentFolder = "/Pictures";
    #fileName = "Untitled.png";

    constructor(windowElement, shell) {
      this.#window = windowElement;
      this.#shell = shell;
      this.#canvas = windowElement.querySelector("[data-paint-canvas]");
      this.#preview = windowElement.querySelector("[data-paint-preview]");
      this.#stage = windowElement.querySelector("[data-paint-stage]");
      this.#workspace = windowElement.querySelector("[data-paint-workspace]");
      this.#textEditor = windowElement.querySelector("[data-paint-text-editor]");
      this.#dialogLayer = windowElement.querySelector("[data-paint-dialog-layer]");
      this.#fileButton = windowElement.querySelector("[data-paint-file-button]");
      this.#fileMenu = windowElement.querySelector("[data-paint-file-menu]");
      if (!this.#canvas || !this.#preview || !this.#stage || !this.#workspace || !this.#textEditor || !this.#dialogLayer) {
        throw new Error("Paint app markup is incomplete.");
      }
      this.#context = this.#canvas.getContext("2d", { willReadFrequently: true });
      this.#previewContext = this.#preview.getContext("2d", { willReadFrequently: true });
      this.#configurePalette();
      this.#bindEvents();
      this.#unsubscribe = shell.subscribe(() => {
        if (this.#currentNode && !this.#shell.list(this.#currentNode.parentPath).includes(this.#currentNode)) {
          this.#currentNode = null;
          this.#fileName = "Untitled.png";
          this.#updateTitle();
        }
      });
      this.reset();
    }

    destroy() {
      this.#listeners.abort();
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#hideCanvasContextMenu();
      this.#closeDialog();
    }

    reset() {
      this.#closeDialog();
      this.#hideCanvasContextMenu();
      this.#hideFileMenu();
      this.#finishText(false);
      this.#currentNode = null;
      this.#currentFolder = "/Pictures";
      this.#fileName = "Untitled.png";
      this.#undoStack.length = 0;
      this.#redoStack.length = 0;
      this.#selection = null;
      this.#clipboard = null;
      this.#setCanvasSize(800, 600, { preserve: false, history: false });
      this.#fillCanvas("#ffffff");
      this.#dirty = false;
      this.#setZoom(1);
      this.#setTool("pencil");
      this.#updateTitle();
      this.#updateControls();
    }

    requestClose() {
      this.#finishText(true);
      this.#commitFloatingSelection();
      return !this.#dirty || window.confirm("Discard unsaved changes and close Paint?");
    }

    onWindowClosed() {
      this.#hideFileMenu();
      this.#hideCanvasContextMenu();
      this.#closeDialog();
      this.#finishText(true);
    }

    #bindEvents() {
      const options = { signal: this.#listeners.signal };
      this.#fileButton?.addEventListener("click", (event) => {
        event.stopPropagation();
        this.#setFileMenuOpen(this.#fileMenu.hidden);
      }, options);

      this.#window.addEventListener("click", (event) => {
        const tab = event.target.closest("[data-paint-tab]");
        if (tab) this.#showTab(tab.dataset.paintTab);

        const tool = event.target.closest("[data-paint-tool]");
        if (tool) this.#setTool(tool.dataset.paintTool);

        const shape = event.target.closest("[data-paint-shape]");
        if (shape) {
          this.#shape = shape.dataset.paintShape;
          this.#setTool("shape");
        }

        const command = event.target.closest("[data-paint-command]");
        if (command && !command.disabled) void this.#runCommand(command.dataset.paintCommand);

        const colorTarget = event.target.closest("[data-paint-color-target]");
        if (colorTarget) this.#setActiveColorTarget(colorTarget.dataset.paintColorTarget);

        const zoom = event.target.closest("[data-paint-zoom]");
        if (zoom) this.#changeZoom(zoom.dataset.paintZoom);
      }, options);

      this.#window.querySelector("[data-paint-brush-style]")?.addEventListener("change", (event) => {
        this.#brushStyle = event.currentTarget.value;
        this.#setTool("brush");
      }, options);
      this.#window.querySelector("[data-paint-size]")?.addEventListener("change", (event) => {
        this.#size = Number(event.currentTarget.value) || 1;
      }, options);
      this.#window.querySelector("[data-paint-outline]")?.addEventListener("change", (event) => {
        this.#outlineStyle = event.currentTarget.value;
      }, options);
      this.#window.querySelector("[data-paint-fill-style]")?.addEventListener("change", (event) => {
        this.#fillStyle = event.currentTarget.value;
      }, options);
      this.#window.querySelector("[data-paint-select-mode]")?.addEventListener("change", (event) => {
        this.#selectMode = event.currentTarget.value;
        this.#setTool("select");
      }, options);
      this.#window.querySelector("[data-paint-rotate]")?.addEventListener("change", (event) => {
        const direction = event.currentTarget.value;
        event.currentTarget.value = "";
        if (direction) this.#rotate(direction);
      }, options);
      this.#window.querySelector("[data-paint-custom-color]")?.addEventListener("input", (event) => {
        this.#assignColor(event.currentTarget.value, this.#activeColorTarget);
      }, options);
      this.#window.querySelectorAll("[data-paint-view]").forEach((checkbox) => {
        checkbox.addEventListener("change", () => this.#updateView(), options);
      });
      this.#window.querySelector("[data-paint-zoom-slider]")?.addEventListener("input", (event) => {
        const index = clamp(Number(event.currentTarget.value) - 1, 0, ZOOM_LEVELS.length - 1);
        this.#setZoom(ZOOM_LEVELS[index]);
      }, options);

      this.#preview.addEventListener("pointerdown", (event) => this.#beginPointer(event), options);
      this.#preview.addEventListener("pointermove", (event) => this.#movePointer(event), options);
      this.#preview.addEventListener("pointerup", (event) => this.#endPointer(event), options);
      this.#preview.addEventListener("pointercancel", (event) => this.#endPointer(event, true), options);
      this.#preview.addEventListener("contextmenu", (event) => this.#showCanvasContextMenu(event), options);
      this.#preview.addEventListener("pointerleave", () => {
        const status = this.#window.querySelector("[data-paint-pointer-status]");
        if (status && !this.#pointer) status.textContent = "0, 0px";
      }, options);

      this.#textEditor.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          this.#finishText(false);
        }
        if (event.ctrlKey && event.key === "Enter") {
          event.preventDefault();
          this.#finishText(true);
        }
      }, options);
      this.#textEditor.addEventListener("blur", () => this.#finishText(true), options);

      const resizeHandle = this.#window.querySelector("[data-paint-canvas-resize]");
      resizeHandle?.addEventListener("pointerdown", (event) => this.#beginCanvasResize(event, resizeHandle), options);
      resizeHandle?.addEventListener("pointermove", (event) => this.#moveCanvasResize(event), options);
      resizeHandle?.addEventListener("pointerup", (event) => this.#endCanvasResize(event), options);
      resizeHandle?.addEventListener("pointercancel", (event) => this.#endCanvasResize(event, true), options);

      document.addEventListener("pointerdown", (event) => {
        if (!this.#fileMenu.hidden && !this.#fileMenu.contains(event.target) && !this.#fileButton.contains(event.target)) {
          this.#hideFileMenu();
        }
        if (this.#canvasMenu && !this.#canvasMenu.contains(event.target)) this.#hideCanvasContextMenu();
      }, { ...options, capture: true });

      window.addEventListener("keydown", (event) => this.#handleKeyboard(event), options);
    }

    #configurePalette() {
      const palette = this.#window.querySelector("[data-paint-palette]");
      if (!palette) return;
      const fragment = document.createDocumentFragment();
      PALETTE.forEach((color) => {
        const swatch = createElement("button", {
          type: "button",
          title: `${color} — left click Color 1, right click Color 2`,
          "aria-label": color
        });
        swatch.style.background = color;
        swatch.addEventListener("click", () => this.#assignColor(color, "primary"), { signal: this.#listeners.signal });
        swatch.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          this.#assignColor(color, "secondary");
        }, { signal: this.#listeners.signal });
        fragment.append(swatch);
      });
      palette.replaceChildren(fragment);
      this.#renderColors();
    }

    #handleKeyboard(event) {
      if (this.#window.hidden || this.#window.classList.contains("minimized") || !this.#window.classList.contains("active")) return;
      const key = event.key.toLocaleLowerCase();
      const editingText = event.target === this.#textEditor;
      if (editingText && !(event.ctrlKey && ["s", "z", "y"].includes(key))) return;
      if (event.ctrlKey && key === "z") {
        event.preventDefault();
        this.#undo();
      } else if (event.ctrlKey && key === "y") {
        event.preventDefault();
        this.#redo();
      } else if (event.ctrlKey && key === "n") {
        event.preventDefault();
        void this.#newDocument();
      } else if (event.ctrlKey && key === "o") {
        event.preventDefault();
        void this.#openDocument();
      } else if (event.ctrlKey && key === "s") {
        event.preventDefault();
        void this.#save(false);
      } else if (event.key === "Delete" && this.#selection) {
        event.preventDefault();
        this.#deleteSelection();
      } else if (event.key === "Escape") {
        this.#hideFileMenu();
        this.#hideCanvasContextMenu();
        this.#finishText(false);
        this.#clearSelection(true);
      }
    }

    async #runCommand(command) {
      this.#hideFileMenu();
      if (command === "undo") this.#undo();
      if (command === "redo") this.#redo();
      if (command === "new") await this.#newDocument();
      if (command === "open") await this.#openDocument();
      if (command === "save") await this.#save(false);
      if (command === "save-as") await this.#save(true);
      if (command === "exit") {
        if (this.requestClose()) this.#shell.closeWindow(this.#window);
      }
      if (command === "wallpaper") {
        this.#finishText(true);
        this.#commitFloatingSelection();
        this.#shell.setWallpaper(this.#canvas.toDataURL("image/png"));
      }
      if (command === "copy") this.#copySelection();
      if (command === "cut") this.#cutSelection();
      if (command === "paste") this.#pasteSelection();
      if (command === "delete") this.#deleteSelection();
      if (command === "select-all") this.#selectAll();
      if (command === "crop") this.#cropToSelection();
      if (command === "resize") void this.#showResizeDialog();
    }

    #showTab(name) {
      this.#window.querySelectorAll("[data-paint-tab]").forEach((tab) => {
        const active = tab.dataset.paintTab === name;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      this.#window.querySelectorAll("[data-paint-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.paintPanel !== name;
        panel.classList.toggle("is-active", panel.dataset.paintPanel === name);
      });
    }

    #setFileMenuOpen(open) {
      this.#fileMenu.hidden = !open;
      this.#fileButton.setAttribute("aria-expanded", String(open));
      if (open) this.#fileMenu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    }

    #hideFileMenu() {
      this.#setFileMenuOpen(false);
    }

    #showCanvasContextMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      this.#hideFileMenu();
      this.#hideCanvasContextMenu();

      const menu = createElement("div", {
        className: "paint-context-menu",
        role: "menu",
        tabIndex: -1,
        "aria-label": "Paint canvas commands"
      });
      const descriptors = [
        { label: "Undo", shortcut: "Ctrl+Z", command: "undo", disabled: this.#undoStack.length === 0 },
        { label: "Redo", shortcut: "Ctrl+Y", command: "redo", disabled: this.#redoStack.length === 0 },
        { separator: true },
        { label: "Cut", shortcut: "Ctrl+X", command: "cut", disabled: !this.#selection },
        { label: "Copy", shortcut: "Ctrl+C", command: "copy", disabled: !this.#selection },
        { label: "Paste", shortcut: "Ctrl+V", command: "paste", disabled: !this.#clipboard },
        { label: "Delete", shortcut: "Del", command: "delete", disabled: !this.#selection },
        { separator: true },
        { label: "Select all", shortcut: "Ctrl+A", command: "select-all" }
      ];
      descriptors.forEach((descriptor) => {
        if (descriptor.separator) {
          menu.append(createElement("div", { className: "paint-context-menu__separator", role: "separator" }));
          return;
        }
        const button = createElement("button", {
          type: "button",
          className: "paint-context-menu__item",
          role: "menuitem",
          disabled: Boolean(descriptor.disabled)
        }, [
          createElement("span", { text: descriptor.label }),
          createElement("kbd", { text: descriptor.shortcut })
        ]);
        button.addEventListener("click", () => {
          this.#hideCanvasContextMenu();
          void this.#runCommand(descriptor.command);
        }, { once: true });
        menu.append(button);
      });

      this.#window.append(menu);
      this.#canvasMenu = menu;
      const windowRect = this.#window.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const left = clamp(event.clientX - windowRect.left, 4, Math.max(4, windowRect.width - menuRect.width - 4));
      const top = clamp(event.clientY - windowRect.top, 29, Math.max(29, windowRect.height - menuRect.height - 4));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.focus({ preventScroll: true });
    }

    #hideCanvasContextMenu() {
      this.#canvasMenu?.remove();
      this.#canvasMenu = null;
    }

    #setTool(tool) {
      if (tool !== "select") this.#clearSelection(true);
      if (tool !== "text") this.#finishText(true);
      this.#tool = tool;
      this.#window.querySelectorAll("[data-paint-tool], [data-paint-shape]").forEach((button) => {
        const active = tool === "shape"
          ? button.dataset.paintShape === this.#shape
          : button.dataset.paintTool === tool;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      const cursors = {
        text: "text",
        fill: "cell",
        picker: "crosshair",
        magnifier: "zoom-in",
        eraser: "crosshair",
        select: "crosshair"
      };
      this.#preview.style.cursor = cursors[tool] ?? "crosshair";
    }

    #setActiveColorTarget(target) {
      this.#activeColorTarget = target === "secondary" ? "secondary" : "primary";
      this.#window.querySelectorAll("[data-paint-color-target]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.paintColorTarget === this.#activeColorTarget);
      });
      const picker = this.#window.querySelector("[data-paint-custom-color]");
      if (picker) picker.value = this.#activeColorTarget === "primary" ? this.#primaryColor : this.#secondaryColor;
    }

    #assignColor(color, target) {
      if (target === "secondary") this.#secondaryColor = color;
      else this.#primaryColor = color;
      this.#setActiveColorTarget(target);
      this.#renderColors();
    }

    #renderColors() {
      const one = this.#window.querySelector("[data-paint-color-one]");
      const two = this.#window.querySelector("[data-paint-color-two]");
      if (one) one.style.background = this.#primaryColor;
      if (two) two.style.background = this.#secondaryColor;
    }

    #beginPointer(event) {
      if (!event.isPrimary && event.pointerType !== "mouse") return;
      if (event.button !== 0) return;
      const point = this.#canvasPoint(event);
      const color = event.altKey ? this.#secondaryColor : this.#primaryColor;
      this.#updatePointerStatus(point);
      this.#finishText(true);

      if (this.#tool === "fill") {
        this.#pushUndo();
        if (this.#floodFill(point.x, point.y, color)) this.#markDirty();
        else this.#undoStack.pop();
        this.#updateControls();
        event.preventDefault();
        return;
      }
      if (this.#tool === "picker") {
        const pixel = this.#context.getImageData(point.x, point.y, 1, 1).data;
        this.#assignColor(this.#rgbToHex(pixel[0], pixel[1], pixel[2]), event.button === 2 ? "secondary" : "primary");
        event.preventDefault();
        return;
      }
      if (this.#tool === "magnifier") {
        const currentIndex = ZOOM_LEVELS.indexOf(this.#zoom);
        this.#setZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, currentIndex + 1))]);
        event.preventDefault();
        return;
      }
      if (this.#tool === "select" && this.#selection && this.#pointInSelection(point)) {
        this.#beginSelectionMove(event, point);
        return;
      }

      if (this.#tool !== "select") this.#clearSelection(true);
      if (["pencil", "brush", "eraser", "shape"].includes(this.#tool)) this.#pushUndo();
      this.#pointer = {
        pointerId: event.pointerId,
        start: point,
        last: point,
        current: point,
        color,
        points: [point],
        mode: this.#tool
      };
      this.#preview.setPointerCapture(event.pointerId);

      if (this.#tool === "pencil" || this.#tool === "brush") this.#drawFreehandSegment(point, point, color);
      if (this.#tool === "eraser") this.#eraseAt(point);
      if (this.#tool === "text" || this.#tool === "select") this.#drawDragGuide();
      event.preventDefault();
    }

    #movePointer(event) {
      const point = this.#canvasPoint(event);
      this.#updatePointerStatus(point);
      const pointer = this.#pointer;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      pointer.current = point;

      if (pointer.mode === "selection-move") {
        const maxX = this.#canvas.width - this.#selection.width;
        const maxY = this.#canvas.height - this.#selection.height;
        this.#selection.currentX = clamp(point.x - pointer.offsetX, 0, Math.max(0, maxX));
        this.#selection.currentY = clamp(point.y - pointer.offsetY, 0, Math.max(0, maxY));
        this.#drawSelectionPreview();
      } else if (pointer.mode === "pencil" || pointer.mode === "brush") {
        this.#drawFreehandSegment(pointer.last, point, pointer.color);
        pointer.last = point;
      } else if (pointer.mode === "eraser") {
        this.#eraseAt(point);
        pointer.last = point;
      } else if (pointer.mode === "shape") {
        this.#drawShapePreview(pointer.start, point);
      } else if (pointer.mode === "select") {
        pointer.points.push(point);
        this.#drawDragGuide();
      } else if (pointer.mode === "text") {
        this.#drawDragGuide();
      }
      event.preventDefault();
    }

    #endPointer(event, cancelled = false) {
      const pointer = this.#pointer;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      if (this.#preview.hasPointerCapture(event.pointerId)) this.#preview.releasePointerCapture(event.pointerId);
      this.#pointer = null;

      if (cancelled) {
        if (["pencil", "brush", "eraser"].includes(pointer.mode)) this.#undo();
        this.#clearPreview();
        return;
      }
      if (["pencil", "brush", "eraser"].includes(pointer.mode)) this.#markDirty();
      if (pointer.mode === "shape") {
        this.#clearPreview();
        this.#drawShape(this.#context, pointer.start, pointer.current);
        this.#markDirty();
      }
      if (pointer.mode === "select") this.#finishSelection(pointer);
      if (pointer.mode === "selection-move") this.#finishSelectionMove();
      if (pointer.mode === "text") this.#showTextEditor(pointer.start, pointer.current);
      this.#updateControls();
    }

    #canvasPoint(event) {
      const rect = this.#preview.getBoundingClientRect();
      return {
        x: clamp(Math.floor((event.clientX - rect.left) * this.#canvas.width / Math.max(1, rect.width)), 0, this.#canvas.width - 1),
        y: clamp(Math.floor((event.clientY - rect.top) * this.#canvas.height / Math.max(1, rect.height)), 0, this.#canvas.height - 1)
      };
    }

    #updatePointerStatus(point) {
      const status = this.#window.querySelector("[data-paint-pointer-status]");
      if (status) status.textContent = `${point.x}, ${point.y}px`;
    }

    #drawFreehandSegment(from, to, color) {
      const context = this.#context;
      context.save();
      context.strokeStyle = color;
      context.fillStyle = color;
      context.lineJoin = "round";

      if (this.#tool === "pencil") {
        context.lineWidth = 1;
        context.lineCap = "square";
        context.beginPath();
        context.moveTo(from.x + 0.5, from.y + 0.5);
        context.lineTo(to.x + 0.5, to.y + 0.5);
        context.stroke();
        context.restore();
        return;
      }

      const size = Math.max(1, this.#size);
      if (this.#brushStyle === "airbrush") {
        const radius = Math.max(4, size * 1.9);
        this.#forBrushSamples(from, to, 1.6, (x, y) => {
          for (let dot = 0; dot < Math.max(10, size * 3); dot += 1) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.sqrt(Math.random()) * radius;
            context.globalAlpha = 0.12 + Math.random() * 0.34;
            const dotSize = Math.random() > 0.88 ? 2 : 1;
            context.fillRect(
              Math.round(x + Math.cos(angle) * distance),
              Math.round(y + Math.sin(angle) * distance),
              dotSize,
              dotSize
            );
          }
        });
      } else if (this.#brushStyle === "calligraphy-1" || this.#brushStyle === "calligraphy-2") {
        const firstNib = this.#brushStyle === "calligraphy-1";
        this.#forBrushSamples(from, to, Math.max(0.8, size * 0.18), (x, y) => {
          context.save();
          context.translate(x, y);
          context.rotate(firstNib ? -Math.PI / 4 : Math.PI / 4);
          if (firstNib) context.fillRect(-size * 0.72, -Math.max(0.7, size * 0.16), size * 1.44, Math.max(1.4, size * 0.32));
          else context.fillRect(-size * 0.62, -Math.max(0.8, size * 0.22), size * 1.24, Math.max(1.6, size * 0.44));
          context.restore();
        });
      } else if (this.#brushStyle === "oil") {
        const angle = Math.atan2(to.y - from.y, to.x - from.x || 0.001);
        const normalX = -Math.sin(angle);
        const normalY = Math.cos(angle);
        const strands = Math.max(4, Math.round(size * 0.8));
        context.lineCap = "round";
        for (let strand = 0; strand < strands; strand += 1) {
          const offset = (strand / Math.max(1, strands - 1) - 0.5) * size * 1.35;
          const jitter = (Math.random() - 0.5) * 1.4;
          context.globalAlpha = 0.34 + Math.random() * 0.55;
          context.lineWidth = Math.max(0.8, size * (0.12 + Math.random() * 0.18));
          context.beginPath();
          context.moveTo(from.x + normalX * offset + jitter, from.y + normalY * offset + jitter);
          context.lineTo(to.x + normalX * offset - jitter, to.y + normalY * offset - jitter);
          context.stroke();
        }
      } else if (this.#brushStyle === "crayon") {
        const radius = Math.max(2, size * 0.72);
        this.#forBrushSamples(from, to, 1, (x, y) => {
          for (let grain = 0; grain < Math.max(5, size * 2); grain += 1) {
            const offsetX = (Math.random() - 0.5) * radius * 2;
            const offsetY = (Math.random() - 0.5) * radius * 2;
            if (offsetX * offsetX + offsetY * offsetY > radius * radius) continue;
            context.globalAlpha = 0.18 + Math.random() * 0.5;
            context.fillRect(Math.round(x + offsetX), Math.round(y + offsetY), 1 + Math.round(Math.random()), 1);
          }
        });
      } else if (this.#brushStyle === "marker") {
        context.globalAlpha = 0.42;
        context.lineWidth = Math.max(4, size * 2.25);
        context.lineCap = "square";
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      } else if (this.#brushStyle === "natural-pencil") {
        context.lineCap = "round";
        for (let pass = 0; pass < 3; pass += 1) {
          context.globalAlpha = pass === 0 ? 0.7 : 0.26;
          context.lineWidth = pass === 0 ? Math.max(1, size * 0.28) : 1;
          const jitterX = (Math.random() - 0.5) * size * 0.55;
          const jitterY = (Math.random() - 0.5) * size * 0.55;
          context.beginPath();
          context.moveTo(from.x + jitterX, from.y + jitterY);
          context.lineTo(to.x - jitterY, to.y + jitterX);
          context.stroke();
        }
        this.#forBrushSamples(from, to, 2.2, (x, y) => {
          context.globalAlpha = 0.18 + Math.random() * 0.28;
          context.fillRect(x + (Math.random() - 0.5) * size, y + (Math.random() - 0.5) * size, 1, 1);
        });
      } else if (this.#brushStyle === "watercolor") {
        context.lineCap = "round";
        [2.5, 1.8, 1.15].forEach((multiplier, index) => {
          context.globalAlpha = [0.055, 0.09, 0.18][index];
          context.lineWidth = Math.max(3, size * multiplier);
          context.beginPath();
          context.moveTo(from.x, from.y);
          context.lineTo(to.x, to.y);
          context.stroke();
        });
      } else {
        context.globalAlpha = 1;
        context.lineWidth = size;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
        if (from.x === to.x && from.y === to.y) {
          context.beginPath();
          context.arc(from.x, from.y, size / 2, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.restore();
    }

    #forBrushSamples(from, to, spacing, draw) {
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(1, Math.ceil(distance / Math.max(0.5, spacing)));
      for (let step = 0; step <= steps; step += 1) {
        const progress = step / steps;
        draw(from.x + (to.x - from.x) * progress, from.y + (to.y - from.y) * progress, progress);
      }
    }

    #eraseAt(point) {
      const size = Math.max(6, this.#size * 2);
      this.#context.save();
      this.#context.fillStyle = this.#secondaryColor;
      this.#context.fillRect(Math.round(point.x - size / 2), Math.round(point.y - size / 2), size, size);
      this.#context.restore();
    }

    #drawShapePreview(start, end) {
      this.#clearPreview();
      this.#drawShape(this.#previewContext, start, end);
    }

    #drawShape(context, start, end) {
      const left = Math.min(start.x, end.x);
      const top = Math.min(start.y, end.y);
      const width = Math.abs(end.x - start.x);
      const height = Math.abs(end.y - start.y);
      context.save();
      context.lineWidth = this.#size;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = this.#primaryColor;
      context.fillStyle = this.#secondaryColor;
      context.beginPath();
      if (this.#shape === "line") {
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
      } else if (this.#shape === "curve") {
        const controlX = (start.x + end.x) / 2;
        const bend = Math.max(12, Math.abs(end.y - start.y) * 0.45 + Math.abs(end.x - start.x) * 0.12);
        context.moveTo(start.x, start.y);
        context.quadraticCurveTo(controlX, Math.min(start.y, end.y) - bend, end.x, end.y);
      } else if (this.#shape === "rectangle") {
        context.rect(left, top, width, height);
      } else if (this.#shape === "rounded-rectangle") {
        this.#roundedRectPath(context, left, top, width, height, Math.min(18, width / 4, height / 4));
      } else if (this.#shape === "ellipse") {
        context.ellipse(left + width / 2, top + height / 2, Math.max(0.5, width / 2), Math.max(0.5, height / 2), 0, 0, Math.PI * 2);
      } else if (this.#shape === "triangle") {
        context.moveTo(left + width / 2, top);
        context.lineTo(left + width, top + height);
        context.lineTo(left, top + height);
        context.closePath();
      }
      const canFill = !["line", "curve"].includes(this.#shape);
      if (canFill && ["solid", "fill-only"].includes(this.#fillStyle)) context.fill();
      if (this.#outlineStyle !== "none" && this.#fillStyle !== "fill-only") context.stroke();
      context.restore();
    }

    #roundedRectPath(context, x, y, width, height, radius) {
      const r = Math.max(0, radius);
      context.moveTo(x + r, y);
      context.lineTo(x + width - r, y);
      context.quadraticCurveTo(x + width, y, x + width, y + r);
      context.lineTo(x + width, y + height - r);
      context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      context.lineTo(x + r, y + height);
      context.quadraticCurveTo(x, y + height, x, y + height - r);
      context.lineTo(x, y + r);
      context.quadraticCurveTo(x, y, x + r, y);
      context.closePath();
    }

    #drawDragGuide() {
      const pointer = this.#pointer;
      if (!pointer) return;
      this.#clearPreview();
      const context = this.#previewContext;
      context.save();
      context.setLineDash([4, 3]);
      context.strokeStyle = "#111";
      context.lineWidth = 1;
      if (pointer.mode === "select" && this.#selectMode === "free") {
        context.beginPath();
        pointer.points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
        context.stroke();
      } else {
        const bounds = this.#normalizedBounds(pointer.start, pointer.current);
        context.strokeRect(bounds.x + 0.5, bounds.y + 0.5, bounds.width, bounds.height);
      }
      context.restore();
    }

    #finishSelection(pointer) {
      const points = pointer.points;
      const bounds = this.#selectMode === "free"
        ? this.#boundsForPoints(points)
        : this.#normalizedBounds(pointer.start, pointer.current);
      this.#clearPreview();
      if (bounds.width < 2 || bounds.height < 2) {
        this.#selection = null;
        return;
      }
      const imageData = this.#context.getImageData(bounds.x, bounds.y, bounds.width, bounds.height);
      let mask = null;
      if (this.#selectMode === "free") {
        mask = this.#freeSelectionMask(points, bounds);
        for (let index = 0; index < mask.length; index += 1) {
          if (!mask[index]) imageData.data[index * 4 + 3] = 0;
        }
      }
      this.#selection = {
        x: bounds.x,
        y: bounds.y,
        currentX: bounds.x,
        currentY: bounds.y,
        width: bounds.width,
        height: bounds.height,
        imageData,
        mask,
        floating: false
      };
      this.#drawSelectionPreview();
      this.#updateControls();
    }

    #beginSelectionMove(event, point) {
      this.#pushUndo();
      const selection = this.#selection;
      if (!selection.floating) this.#vacateSelection(selection);
      selection.floating = true;
      this.#pointer = {
        pointerId: event.pointerId,
        mode: "selection-move",
        start: point,
        current: point,
        offsetX: point.x - selection.currentX,
        offsetY: point.y - selection.currentY
      };
      this.#preview.setPointerCapture(event.pointerId);
      this.#drawSelectionPreview();
      event.preventDefault();
    }

    #finishSelectionMove() {
      if (!this.#selection) return;
      this.#drawImageData(this.#context, this.#selection.imageData, this.#selection.currentX, this.#selection.currentY);
      this.#selection.x = this.#selection.currentX;
      this.#selection.y = this.#selection.currentY;
      this.#selection.floating = false;
      this.#markDirty();
      this.#drawSelectionPreview();
    }

    #drawSelectionPreview() {
      this.#clearPreview();
      const selection = this.#selection;
      if (!selection) return;
      if (selection.floating) this.#drawImageData(this.#previewContext, selection.imageData, selection.currentX, selection.currentY);
      const context = this.#previewContext;
      context.save();
      context.setLineDash([4, 3]);
      context.strokeStyle = "#111";
      context.lineWidth = 1;
      context.strokeRect(selection.currentX + 0.5, selection.currentY + 0.5, selection.width, selection.height);
      context.setLineDash([4, 3]);
      context.lineDashOffset = 4;
      context.strokeStyle = "#fff";
      context.strokeRect(selection.currentX + 0.5, selection.currentY + 0.5, selection.width, selection.height);
      context.restore();
    }

    #pointInSelection(point) {
      const selection = this.#selection;
      if (!selection) return false;
      const localX = point.x - selection.currentX;
      const localY = point.y - selection.currentY;
      if (localX < 0 || localY < 0 || localX >= selection.width || localY >= selection.height) return false;
      return !selection.mask || Boolean(selection.mask[localY * selection.width + localX]);
    }

    #vacateSelection(selection) {
      if (!selection.mask) {
        this.#context.save();
        this.#context.fillStyle = this.#secondaryColor;
        this.#context.fillRect(selection.x, selection.y, selection.width, selection.height);
        this.#context.restore();
        return;
      }
      const background = this.#hexToRgb(this.#secondaryColor);
      const image = this.#context.getImageData(selection.x, selection.y, selection.width, selection.height);
      selection.mask.forEach((inside, index) => {
        if (!inside) return;
        const offset = index * 4;
        image.data[offset] = background.r;
        image.data[offset + 1] = background.g;
        image.data[offset + 2] = background.b;
        image.data[offset + 3] = 255;
      });
      this.#context.putImageData(image, selection.x, selection.y);
    }

    #clearSelection(commit) {
      if (!this.#selection) return;
      if (commit) this.#commitFloatingSelection();
      this.#selection = null;
      this.#clearPreview();
      this.#updateControls();
    }

    #commitFloatingSelection() {
      if (!this.#selection?.floating) return;
      this.#drawImageData(this.#context, this.#selection.imageData, this.#selection.currentX, this.#selection.currentY);
      this.#selection.x = this.#selection.currentX;
      this.#selection.y = this.#selection.currentY;
      this.#selection.floating = false;
      this.#markDirty();
      this.#drawSelectionPreview();
    }

    #copySelection() {
      if (!this.#selection) return;
      const selection = this.#selection;
      this.#clipboard = {
        width: selection.width,
        height: selection.height,
        imageData: this.#cloneImageData(selection.imageData),
        mask: selection.mask ? new Uint8Array(selection.mask) : null
      };
      this.#updateControls();
    }

    #cutSelection() {
      if (!this.#selection) return;
      this.#copySelection();
      this.#deleteSelection();
    }

    #pasteSelection() {
      if (!this.#clipboard) return;
      this.#finishText(true);
      this.#clearSelection(true);
      this.#pushUndo();
      this.#selection = {
        x: 0,
        y: 0,
        currentX: 0,
        currentY: 0,
        width: this.#clipboard.width,
        height: this.#clipboard.height,
        imageData: this.#cloneImageData(this.#clipboard.imageData),
        mask: this.#clipboard.mask ? new Uint8Array(this.#clipboard.mask) : null,
        floating: true
      };
      this.#setTool("select");
      this.#drawSelectionPreview();
      this.#updateControls();
    }

    #selectAll() {
      this.#finishText(true);
      this.#clearSelection(true);
      const width = this.#canvas.width;
      const height = this.#canvas.height;
      this.#selection = {
        x: 0,
        y: 0,
        currentX: 0,
        currentY: 0,
        width,
        height,
        imageData: this.#context.getImageData(0, 0, width, height),
        mask: null,
        floating: false
      };
      this.#setTool("select");
      this.#drawSelectionPreview();
      this.#updateControls();
    }

    #deleteSelection() {
      if (!this.#selection) return;
      this.#pushUndo();
      if (!this.#selection.floating) this.#vacateSelection(this.#selection);
      this.#selection = null;
      this.#clearPreview();
      this.#markDirty();
      this.#updateControls();
    }

    #cropToSelection() {
      if (!this.#selection) return;
      this.#finishText(true);
      this.#commitFloatingSelection();
      const { currentX: x, currentY: y, width, height } = this.#selection;
      const cropped = this.#context.getImageData(x, y, width, height);
      this.#pushUndo();
      this.#selection = null;
      this.#setCanvasSize(width, height, { preserve: false, history: false });
      this.#context.putImageData(cropped, 0, 0);
      this.#clearPreview();
      this.#markDirty();
      this.#updateControls();
    }

    #showTextEditor(start, end) {
      const bounds = this.#normalizedBounds(start, end);
      if (bounds.width < 8 || bounds.height < 8) {
        bounds.width = 180;
        bounds.height = 55;
      }
      bounds.width = Math.min(bounds.width, this.#canvas.width - bounds.x);
      bounds.height = Math.min(bounds.height, this.#canvas.height - bounds.y);
      this.#clearPreview();
      this.#textBox = bounds;
      this.#textEditor.value = "";
      this.#textEditor.hidden = false;
      Object.assign(this.#textEditor.style, {
        left: `${bounds.x * this.#zoom}px`,
        top: `${bounds.y * this.#zoom}px`,
        width: `${bounds.width * this.#zoom}px`,
        height: `${bounds.height * this.#zoom}px`,
        color: this.#primaryColor,
        fontSize: `${20 * this.#zoom}px`
      });
      requestAnimationFrame(() => this.#textEditor.focus({ preventScroll: true }));
    }

    #finishText(commit) {
      if (this.#textEditor.hidden || !this.#textBox) return;
      const text = this.#textEditor.value;
      const bounds = this.#textBox;
      this.#textEditor.hidden = true;
      this.#textBox = null;
      if (!commit || !text.trim()) return;
      this.#pushUndo();
      const context = this.#context;
      context.save();
      context.fillStyle = this.#primaryColor;
      context.font = "20px Arial, sans-serif";
      context.textBaseline = "top";
      const lineHeight = 24;
      let y = bounds.y + 2;
      text.split("\n").forEach((line) => {
        if (y + lineHeight <= bounds.y + bounds.height + 2) context.fillText(line, bounds.x + 3, y, Math.max(1, bounds.width - 6));
        y += lineHeight;
      });
      context.restore();
      this.#markDirty();
      this.#updateControls();
    }

    #floodFill(x, y, color) {
      const image = this.#context.getImageData(0, 0, this.#canvas.width, this.#canvas.height);
      const pixels = new Uint32Array(image.data.buffer);
      const target = pixels[y * this.#canvas.width + x];
      const rgb = this.#hexToRgb(color);
      const replacement = (255 << 24) | (rgb.b << 16) | (rgb.g << 8) | rgb.r;
      if (target === (replacement >>> 0)) return false;
      const width = this.#canvas.width;
      const height = this.#canvas.height;
      const stack = [y * width + x];
      while (stack.length) {
        const index = stack.pop();
        if (pixels[index] !== target) continue;
        pixels[index] = replacement;
        const px = index % width;
        const py = Math.floor(index / width);
        if (px > 0) stack.push(index - 1);
        if (px + 1 < width) stack.push(index + 1);
        if (py > 0) stack.push(index - width);
        if (py + 1 < height) stack.push(index + width);
      }
      this.#context.putImageData(image, 0, 0);
      return true;
    }

    #beginCanvasResize(event, handle) {
      if (event.button !== 0) return;
      this.#finishText(true);
      this.#clearSelection(true);
      this.#canvasResize = {
        pointerId: event.pointerId,
        handle,
        startX: event.clientX,
        startY: event.clientY,
        width: this.#canvas.width,
        height: this.#canvas.height,
        nextWidth: this.#canvas.width,
        nextHeight: this.#canvas.height
      };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    }

    #moveCanvasResize(event) {
      const resize = this.#canvasResize;
      if (!resize || resize.pointerId !== event.pointerId) return;
      resize.nextWidth = clamp(Math.round(resize.width + (event.clientX - resize.startX) / this.#zoom), 1, 3000);
      resize.nextHeight = clamp(Math.round(resize.height + (event.clientY - resize.startY) / this.#zoom), 1, 3000);
      this.#stage.style.width = `${resize.nextWidth * this.#zoom}px`;
      this.#stage.style.height = `${resize.nextHeight * this.#zoom}px`;
      this.#updateCanvasStatus(resize.nextWidth, resize.nextHeight);
    }

    #endCanvasResize(event, cancelled = false) {
      const resize = this.#canvasResize;
      if (!resize || resize.pointerId !== event.pointerId) return;
      if (resize.handle.hasPointerCapture(event.pointerId)) resize.handle.releasePointerCapture(event.pointerId);
      this.#canvasResize = null;
      if (cancelled) this.#updateCanvasMetrics();
      else this.#setCanvasSize(resize.nextWidth, resize.nextHeight, { preserve: true, history: true });
    }

    async #showResizeDialog() {
      this.#finishText(true);
      this.#clearSelection(true);
      const dialog = createElement("section", { className: "paint-dialog", role: "dialog", "aria-label": "Resize and Skew" });
      const heading = createElement("h2", { text: "Resize" });
      const form = createElement("form", { className: "paint-dialog__form" });
      const width = createElement("input", { type: "number", min: 1, max: 3000, value: this.#canvas.width, required: true });
      const height = createElement("input", { type: "number", min: 1, max: 3000, value: this.#canvas.height, required: true });
      const actions = createElement("div", { className: "paint-dialog__actions" });
      const ok = createElement("button", { type: "submit", className: "default", text: "OK" });
      const cancel = createElement("button", { type: "button", text: "Cancel" });
      actions.append(ok, cancel);
      form.append(createElement("label", { text: "Horizontal (pixels):" }), width, createElement("label", { text: "Vertical (pixels):" }), height, actions);
      dialog.append(heading, form);
      this.#showDialog(dialog);
      cancel.addEventListener("click", () => this.#closeDialog(), { once: true });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        this.#setCanvasSize(clamp(Number(width.value), 1, 3000), clamp(Number(height.value), 1, 3000), { preserve: true, history: true });
        this.#closeDialog();
      }, { once: true });
      width.focus();
      width.select();
    }

    #rotate(direction) {
      this.#finishText(true);
      this.#clearSelection(true);
      const oldWidth = this.#canvas.width;
      const oldHeight = this.#canvas.height;
      const source = document.createElement("canvas");
      source.width = oldWidth;
      source.height = oldHeight;
      source.getContext("2d").drawImage(this.#canvas, 0, 0);
      this.#pushUndo();
      const quarterTurn = direction === "left" || direction === "right";
      this.#setCanvasSize(quarterTurn ? oldHeight : oldWidth, quarterTurn ? oldWidth : oldHeight, { preserve: false, history: false });
      this.#context.save();
      if (direction === "right") {
        this.#context.translate(this.#canvas.width, 0);
        this.#context.rotate(Math.PI / 2);
      } else if (direction === "left") {
        this.#context.translate(0, this.#canvas.height);
        this.#context.rotate(-Math.PI / 2);
      } else {
        this.#context.translate(this.#canvas.width, this.#canvas.height);
        this.#context.rotate(Math.PI);
      }
      this.#context.drawImage(source, 0, 0);
      this.#context.restore();
      this.#markDirty();
      this.#updateControls();
    }

    #pushUndo() {
      this.#finishText(true);
      this.#undoStack.push(this.#snapshot());
      if (this.#undoStack.length > MAX_HISTORY) this.#undoStack.shift();
      this.#redoStack.length = 0;
      this.#updateControls();
    }

    #undo() {
      this.#finishText(true);
      this.#clearSelection(true);
      const snapshot = this.#undoStack.pop();
      if (!snapshot) return;
      this.#redoStack.push(this.#snapshot());
      this.#restoreSnapshot(snapshot);
      this.#dirty = true;
      this.#updateTitle();
      this.#updateControls();
    }

    #redo() {
      this.#finishText(true);
      this.#clearSelection(true);
      const snapshot = this.#redoStack.pop();
      if (!snapshot) return;
      this.#undoStack.push(this.#snapshot());
      this.#restoreSnapshot(snapshot);
      this.#dirty = true;
      this.#updateTitle();
      this.#updateControls();
    }

    #snapshot() {
      return {
        width: this.#canvas.width,
        height: this.#canvas.height,
        imageData: this.#context.getImageData(0, 0, this.#canvas.width, this.#canvas.height)
      };
    }

    #restoreSnapshot(snapshot) {
      this.#setCanvasSize(snapshot.width, snapshot.height, { preserve: false, history: false });
      this.#context.putImageData(snapshot.imageData, 0, 0);
      this.#clearPreview();
    }

    #setCanvasSize(width, height, { preserve, history }) {
      const nextWidth = clamp(Math.round(width), 1, 3000);
      const nextHeight = clamp(Math.round(height), 1, 3000);
      let source = null;
      if (preserve && this.#canvas.width && this.#canvas.height) {
        source = document.createElement("canvas");
        source.width = this.#canvas.width;
        source.height = this.#canvas.height;
        source.getContext("2d").drawImage(this.#canvas, 0, 0);
      }
      if (history) this.#pushUndo();
      this.#canvas.width = nextWidth;
      this.#canvas.height = nextHeight;
      this.#preview.width = nextWidth;
      this.#preview.height = nextHeight;
      this.#context = this.#canvas.getContext("2d", { willReadFrequently: true });
      this.#previewContext = this.#preview.getContext("2d", { willReadFrequently: true });
      this.#fillCanvas(this.#secondaryColor);
      if (source) this.#context.drawImage(source, 0, 0);
      this.#selection = null;
      this.#updateCanvasMetrics();
      this.#clearPreview();
      if (history) this.#markDirty();
    }

    #fillCanvas(color) {
      this.#context.save();
      this.#context.fillStyle = color;
      this.#context.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
      this.#context.restore();
    }

    #setZoom(value) {
      this.#zoom = ZOOM_LEVELS.reduce((closest, level) => Math.abs(level - value) < Math.abs(closest - value) ? level : closest, ZOOM_LEVELS[0]);
      this.#updateCanvasMetrics();
      const output = this.#window.querySelector("[data-paint-zoom-output]");
      const slider = this.#window.querySelector("[data-paint-zoom-slider]");
      if (output) output.textContent = `${Math.round(this.#zoom * 100)}%`;
      if (slider) slider.value = String(ZOOM_LEVELS.indexOf(this.#zoom) + 1);
      if (!this.#textEditor.hidden && this.#textBox) {
        Object.assign(this.#textEditor.style, {
          left: `${this.#textBox.x * this.#zoom}px`,
          top: `${this.#textBox.y * this.#zoom}px`,
          width: `${this.#textBox.width * this.#zoom}px`,
          height: `${this.#textBox.height * this.#zoom}px`,
          fontSize: `${20 * this.#zoom}px`
        });
      }
    }

    #changeZoom(action) {
      if (action === "100") {
        this.#setZoom(1);
        return;
      }
      let index = ZOOM_LEVELS.indexOf(this.#zoom);
      index = clamp(index + (action === "in" ? 1 : -1), 0, ZOOM_LEVELS.length - 1);
      this.#setZoom(ZOOM_LEVELS[index]);
    }

    #updateCanvasMetrics() {
      this.#stage.style.width = `${this.#canvas.width * this.#zoom}px`;
      this.#stage.style.height = `${this.#canvas.height * this.#zoom}px`;
      const horizontal = this.#window.querySelector("[data-paint-ruler-horizontal]");
      const vertical = this.#window.querySelector("[data-paint-ruler-vertical]");
      if (horizontal) horizontal.style.width = `${this.#canvas.width * this.#zoom}px`;
      if (vertical) vertical.style.height = `${this.#canvas.height * this.#zoom}px`;
      this.#updateCanvasStatus(this.#canvas.width, this.#canvas.height);
    }

    #updateCanvasStatus(width, height) {
      const status = this.#window.querySelector("[data-paint-canvas-status]");
      if (status) status.textContent = `${width} × ${height}px`;
    }

    #updateView() {
      const ruler = this.#window.querySelector('[data-paint-view="ruler"]')?.checked ?? false;
      const grid = this.#window.querySelector('[data-paint-view="grid"]')?.checked ?? false;
      this.#workspace.classList.toggle("has-rulers", ruler);
      this.#workspace.dataset.grid = String(grid);
      this.#window.querySelector("[data-paint-ruler-horizontal]").hidden = !ruler;
      this.#window.querySelector("[data-paint-ruler-vertical]").hidden = !ruler;
    }

    async #newDocument() {
      if (!this.#confirmDiscard()) return;
      this.reset();
    }

    async #openDocument() {
      if (!this.#confirmDiscard()) return;
      const result = await this.#showFileDialog("open");
      if (!result?.node) return;
      await this.#loadNode(result.node);
    }

    async #loadNode(node) {
      const file = this.#shell.getFile(node);
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        const image = await new Promise((resolve, reject) => {
          const element = new Image();
          element.onload = () => resolve(element);
          element.onerror = () => reject(new Error("The selected image could not be decoded."));
          element.src = url;
        });
        this.#selection = null;
        this.#undoStack.length = 0;
        this.#redoStack.length = 0;
        this.#setCanvasSize(image.naturalWidth || image.width, image.naturalHeight || image.height, { preserve: false, history: false });
        this.#context.drawImage(image, 0, 0);
        this.#currentNode = node;
        this.#currentFolder = node.parentPath;
        this.#fileName = node.name;
        this.#dirty = false;
        this.#updateTitle();
        this.#updateControls();
      } catch (error) {
        console.error("Paint could not open the selected image.", error);
        window.alert("Paint cannot read this file.");
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    async #save(forceDialog) {
      this.#finishText(true);
      this.#commitFloatingSelection();
      let target = null;
      if (forceDialog || !this.#currentNode) {
        target = await this.#showFileDialog("save");
        if (!target) return false;
      }
      const blob = await new Promise((resolve) => this.#canvas.toBlob(resolve, "image/png"));
      if (!blob) {
        window.alert("Paint could not save this picture.");
        return false;
      }
      const node = this.#shell.saveImage({
        existingNode: target?.existingNode ?? (forceDialog ? null : this.#currentNode),
        folderPath: target?.folder ?? this.#currentFolder,
        name: target?.name ?? this.#fileName,
        blob
      });
      if (!node) {
        window.alert("The selected folder is not available.");
        return false;
      }
      this.#currentNode = node;
      this.#currentFolder = node.parentPath;
      this.#fileName = node.name;
      this.#dirty = false;
      this.#updateTitle();
      return true;
    }

    #confirmDiscard() {
      this.#finishText(true);
      this.#commitFloatingSelection();
      return !this.#dirty || window.confirm("There are unsaved changes. Discard them?");
    }

    #showFileDialog(mode) {
      return new Promise((resolve) => {
        let selectedNode = null;
        let currentFolder = mode === "save" && this.#shell.writableFolders().includes(this.#currentFolder)
          ? this.#currentFolder
          : "/Pictures";
        const locations = [
          { heading: "Favorites", entries: [["Desktop", "/Desktop", "./assets/icons/desktop.ico"], ["Downloads", "/Downloads", "./assets/icons/downloads.ico"]] },
          { heading: "Libraries", entries: [["Documents", "/Documents", "./assets/icons/documents.ico"], ["Music", "/Music", "./assets/icons/music.ico"], ["Pictures", "/Pictures", "./assets/icons/pictures.ico"], ["Videos", "/Videos", "./assets/icons/videos.ico"]] }
        ];
        const dialog = createElement("section", {
          className: "paint-file-dialog",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": mode === "open" ? "Open" : "Save As"
        });
        const heading = createElement("h2", { className: "paint-file-dialog__title", text: mode === "open" ? "Open" : "Save As" });
        const form = createElement("form", { className: "paint-file-dialog__form" });
        const navigation = createElement("div", { className: "paint-file-dialog__navigation" });
        const back = createElement("button", { type: "button", className: "paint-file-dialog__nav-button", text: "◀", title: "Back", disabled: true });
        const forward = createElement("button", { type: "button", className: "paint-file-dialog__nav-button", text: "▶", title: "Forward", disabled: true });
        const address = createElement("div", { className: "paint-file-dialog__address", role: "navigation", "aria-label": "Current folder" });
        const search = createElement("input", { type: "search", className: "paint-file-dialog__search", placeholder: "Search", "aria-label": "Search current folder" });
        navigation.append(back, forward, address, search);
        const commandBar = createElement("div", { className: "paint-file-dialog__command-bar" }, [
          createElement("button", { type: "button", text: "Organize ▾" }),
          createElement("button", { type: "button", text: "New folder", disabled: true })
        ]);
        const browser = createElement("div", { className: "paint-file-dialog__browser" });
        const sidebar = createElement("aside", { className: "paint-file-dialog__sidebar", "aria-label": "Folders" });
        const fileArea = createElement("div", { className: "paint-file-dialog__file-area" });
        const columns = createElement("div", { className: "paint-file-dialog__columns" }, [
          createElement("span", { text: "Name" }),
          createElement("span", { text: "Date modified" }),
          createElement("span", { text: "Type" }),
          createElement("span", { text: "Size" })
        ]);
        const fileList = createElement("div", { className: "paint-file-dialog__files", role: "listbox" });
        fileArea.append(columns, fileList);
        browser.append(sidebar, fileArea);

        const footer = createElement("div", { className: "paint-file-dialog__footer" });
        const fileIcon = createImageIcon();
        fileIcon.className = "paint-file-dialog__file-icon";
        const nameLabel = createElement("label", { text: "File name:" });
        const name = createElement("input", {
          type: "text",
          value: this.#fileName || "Untitled.png",
          required: true,
          "aria-label": "File name"
        });
        const typeLabel = createElement("label", { text: mode === "open" ? "Files of type:" : "Save as type:" });
        const type = createElement("select", { "aria-label": typeLabel.textContent }, [
          createElement("option", { value: "png", text: "PNG (*.png)", selected: true }),
          createElement("option", { value: "all", text: "All Picture Files" })
        ]);
        const actions = createElement("div", { className: "paint-file-dialog__actions" });
        const accept = createElement("button", { type: "submit", className: "default", text: mode === "open" ? "Open" : "Save" });
        const cancel = createElement("button", { type: "button", text: "Cancel" });
        actions.append(accept, cancel);
        footer.append(fileIcon, nameLabel, name, typeLabel, type, actions);
        form.append(navigation, commandBar, browser, footer);
        dialog.append(heading, form);

        const formatDate = (value) => {
          const date = value instanceof Date ? value : null;
          return date ? date.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" }) : "";
        };
        const formatSize = (node) => {
          const bytes = Number(node.file?.size ?? node.meta?.size ?? 0);
          return bytes > 0 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : "";
        };
        const folderName = (path) => path.slice(1) || "Desktop";
        const renderAddress = () => {
          const library = ["/Documents", "/Music", "/Pictures", "/Videos"].includes(currentFolder);
          const iconPath = locations.flatMap(({ entries }) => entries).find(([, path]) => path === currentFolder)?.[2] ?? IMAGE_ICON;
          address.replaceChildren(
            createElement("img", { src: iconPath, alt: "", draggable: false }),
            ...(library ? [createElement("span", { text: "Libraries" }), createElement("b", { text: "›" })] : []),
            createElement("span", { text: folderName(currentFolder) })
          );
          search.placeholder = `Search ${folderName(currentFolder)}`;
        };
        const renderFiles = () => {
          selectedNode = null;
          accept.disabled = mode === "open";
          sidebar.querySelectorAll("[data-folder]").forEach((button) => {
            button.classList.toggle("is-current", button.dataset.folder === currentFolder);
          });
          renderAddress();
          const query = search.value.trim().toLocaleLowerCase();
          const files = this.#shell.listImages(currentFolder)
            .filter((node) => !query || node.name.toLocaleLowerCase().includes(query))
            .sort((first, second) => first.name.localeCompare(second.name, undefined, { numeric: true, sensitivity: "base" }));
          if (!files.length) {
            fileList.replaceChildren(createElement("p", {
              className: "paint-file-dialog__empty",
              text: query ? "No items match your search." : "This folder is empty."
            }));
            return;
          }
          const fragment = document.createDocumentFragment();
          files.forEach((node) => {
            const button = createElement("button", { type: "button", className: "paint-file-dialog__file", role: "option" }, [
              createElement("span", { className: "paint-file-dialog__file-name" }, [createImageIcon(), createElement("span", { text: node.name })]),
              createElement("span", { text: formatDate(node.meta?.modifiedAt ?? node.meta?.createdAt) }),
              createElement("span", { text: "PNG image" }),
              createElement("span", { text: formatSize(node) })
            ]);
            button.addEventListener("click", () => {
              selectedNode = node;
              fileList.querySelectorAll(".is-selected").forEach((item) => item.classList.remove("is-selected"));
              button.classList.add("is-selected");
              button.setAttribute("aria-selected", "true");
              name.value = node.name;
              accept.disabled = false;
            });
            button.addEventListener("dblclick", () => {
              if (mode === "open") finish({ node });
            });
            fragment.append(button);
          });
          fileList.replaceChildren(fragment);
        };
        const navigate = (path) => {
          if (!this.#shell.writableFolders().includes(path)) return;
          currentFolder = path;
          search.value = "";
          renderFiles();
        };
        const finish = (value) => {
          this.#closeDialog();
          resolve(value);
        };

        locations.forEach(({ heading: groupName, entries }) => {
          sidebar.append(createElement("h3", { text: groupName }));
          entries.forEach(([label, path, icon]) => {
            const button = createElement("button", { type: "button", dataset: { folder: path } }, [
              createElement("img", { src: icon, alt: "", draggable: false }),
              createElement("span", { text: label })
            ]);
            button.addEventListener("click", () => navigate(path));
            sidebar.append(button);
          });
        });
        search.addEventListener("input", renderFiles);
        cancel.addEventListener("click", () => finish(null), { once: true });
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          if (mode === "open") {
            if (selectedNode) finish({ node: selectedNode });
            return;
          }
          let requested = name.value.trim();
          if (!requested) return;
          if (!/\.[a-z0-9]+$/i.test(requested)) requested += ".png";
          const existingNode = this.#shell.listImages(currentFolder)
            .find((node) => node.name.localeCompare(requested, undefined, { sensitivity: "base" }) === 0) ?? null;
          if (existingNode && !window.confirm(`${requested} already exists. Do you want to replace it?`)) return;
          finish({ folder: currentFolder, name: requested, existingNode });
        });
        name.addEventListener("input", () => { if (mode === "save") accept.disabled = !name.value.trim(); });
        this.#showDialog(dialog);
        renderFiles();
        if (mode === "save") {
          name.focus();
          const dot = name.value.lastIndexOf(".");
          name.setSelectionRange(0, dot > 0 ? dot : name.value.length);
        } else fileList.focus({ preventScroll: true });
      });
    }

    #showDialog(dialog) {
      this.#dialogLayer.hidden = false;
      this.#dialogLayer.replaceChildren(dialog);
    }

    #closeDialog() {
      if (!this.#dialogLayer) return;
      this.#dialogLayer.hidden = true;
      this.#dialogLayer.replaceChildren();
    }

    #updateTitle() {
      const displayName = this.#currentNode ? this.#fileName : "Untitled";
      this.#shell.setTitle(this.#window, `${displayName}${this.#dirty ? "*" : ""} - Paint`);
    }

    #markDirty() {
      this.#dirty = true;
      this.#updateTitle();
    }

    #updateControls() {
      const undo = this.#window.querySelector('[data-paint-command="undo"]');
      const redo = this.#window.querySelector('[data-paint-command="redo"]');
      const copy = this.#window.querySelector('[data-paint-command="copy"]');
      const cut = this.#window.querySelector('[data-paint-command="cut"]');
      const paste = this.#window.querySelector('[data-paint-command="paste"]');
      const crop = this.#window.querySelector('[data-paint-command="crop"]');
      if (undo) undo.disabled = this.#undoStack.length === 0;
      if (redo) redo.disabled = this.#redoStack.length === 0;
      if (copy) copy.disabled = !this.#selection;
      if (cut) cut.disabled = !this.#selection;
      if (paste) paste.disabled = !this.#clipboard;
      if (crop) crop.disabled = !this.#selection;
    }

    #clearPreview() {
      this.#previewContext.clearRect(0, 0, this.#preview.width, this.#preview.height);
    }

    #drawImageData(context, imageData, x, y) {
      const buffer = document.createElement("canvas");
      buffer.width = imageData.width;
      buffer.height = imageData.height;
      buffer.getContext("2d").putImageData(imageData, 0, 0);
      context.drawImage(buffer, x, y);
    }

    #cloneImageData(imageData) {
      return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    }

    #normalizedBounds(first, second) {
      const x = Math.min(first.x, second.x);
      const y = Math.min(first.y, second.y);
      return {
        x,
        y,
        width: Math.max(1, Math.abs(second.x - first.x)),
        height: Math.max(1, Math.abs(second.y - first.y))
      };
    }

    #boundsForPoints(points) {
      const xs = points.map(({ x }) => x);
      const ys = points.map(({ y }) => y);
      const x = clamp(Math.min(...xs), 0, this.#canvas.width - 1);
      const y = clamp(Math.min(...ys), 0, this.#canvas.height - 1);
      return {
        x,
        y,
        width: clamp(Math.max(...xs) - x + 1, 1, this.#canvas.width - x),
        height: clamp(Math.max(...ys) - y + 1, 1, this.#canvas.height - y)
      };
    }

    #freeSelectionMask(points, bounds) {
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = bounds.width;
      maskCanvas.height = bounds.height;
      const context = maskCanvas.getContext("2d");
      context.fillStyle = "#fff";
      context.beginPath();
      points.forEach((point, index) => {
        const x = point.x - bounds.x;
        const y = point.y - bounds.y;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.fill();
      const alpha = context.getImageData(0, 0, bounds.width, bounds.height).data;
      const mask = new Uint8Array(bounds.width * bounds.height);
      for (let index = 0; index < mask.length; index += 1) mask[index] = alpha[index * 4 + 3] > 0 ? 1 : 0;
      return mask;
    }

    #hexToRgb(hex) {
      const normalized = hex.replace("#", "");
      const value = Number.parseInt(normalized.length === 3
        ? normalized.split("").map((character) => character + character).join("")
        : normalized, 16);
      return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
    }

    #rgbToHex(red, green, blue) {
      return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
    }
  }

  window.Windows7PaintApp = Windows7PaintApp;
})();
