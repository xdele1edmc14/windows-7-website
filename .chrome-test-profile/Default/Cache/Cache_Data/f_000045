(() => {
  "use strict";

  const TEXT_ICON = "./assets/icons/textfile.png";
  const LOCATIONS = Object.freeze([
    { heading: "Favorites", entries: [["Desktop", "/Desktop", "./assets/icons/desktop.ico"], ["Downloads", "/Downloads", "./assets/icons/downloads.ico"]] },
    { heading: "Libraries", entries: [["Documents", "/Documents", "./assets/icons/documents.ico"], ["Music", "/Music", "./assets/icons/music.ico"], ["Pictures", "/Pictures", "./assets/icons/pictures.ico"], ["Videos", "/Videos", "./assets/icons/videos.ico"]] }
  ]);
  const FONT_FAMILIES = ["Consolas", "Lucida Console", "Courier New", "Arial", "Segoe UI", "Times New Roman"];
  const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];
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

  class Windows7NotepadApp {
    #window;
    #shell;
    #editor;
    #dialogLayer;
    #statusBar;
    #position;
    #listeners = new AbortController();
    #unsubscribe = null;
    #currentNode = null;
    #currentFolder = "/Documents";
    #fileName = "Untitled";
    #dirty = false;
    #wordWrap = false;
    #statusVisible = true;
    #fontFamily = "Consolas";
    #fontSize = 14;
    #fontStyle = "Regular";
    #lastFind = "";
    #matchCase = false;
    #searchDirection = "down";
    #pageSetup = { orientation: "portrait", left: 0.75, right: 0.75, top: 1, bottom: 1 };
    #ignoreFileSystemChange = false;

    constructor(windowElement, shell) {
      this.#window = windowElement;
      this.#shell = shell;
      this.#editor = windowElement.querySelector("[data-notepad-editor]");
      this.#dialogLayer = windowElement.querySelector("[data-notepad-dialog-layer]");
      this.#statusBar = windowElement.querySelector("[data-notepad-status-bar]");
      this.#position = windowElement.querySelector("[data-notepad-position]");
      if (!this.#editor || !this.#dialogLayer || !this.#statusBar || !this.#position) {
        throw new Error("Notepad markup is incomplete.");
      }
      this.#bindEvents();
      this.#unsubscribe = shell.subscribe(() => this.#handleFileSystemChange());
      this.reset();
    }

    destroy() {
      this.#listeners.abort();
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#closeMenus();
      this.#closeDialog();
    }

    reset() {
      this.#closeMenus();
      this.#closeDialog();
      this.#currentNode = null;
      this.#currentFolder = "/Documents";
      this.#fileName = "Untitled";
      this.#editor.value = "";
      this.#editor.setSelectionRange(0, 0);
      this.#dirty = false;
      this.#lastFind = "";
      this.#updateTitle();
      this.#updateStatus();
      this.#updateMenus();
    }

    requestClose() {
      return !this.#dirty || window.confirm(`The text in ${this.#fileName} has changed.\n\nDo you want to close Notepad without saving?`);
    }

    onWindowClosed() {
      this.#closeMenus();
      this.#closeDialog();
    }

    async open(node, { confirmDiscard = true } = {}) {
      if (!node || !this.#shell.isText(node)) return false;
      if (confirmDiscard && !this.#confirmDiscard()) return false;
      const file = this.#shell.getFile(node);
      try {
        const text = typeof file?.text === "function" ? await file.text() : String(node.meta?.text ?? "");
        this.#currentNode = node;
        this.#currentFolder = node.parentPath;
        this.#fileName = node.name;
        this.#editor.value = text;
        this.#editor.setSelectionRange(0, 0);
        this.#dirty = false;
        this.#updateTitle();
        this.#updateStatus();
        this.#updateMenus();
        return true;
      } catch (error) {
        console.error("Notepad could not open the selected file.", error);
        this.#showMessage("Notepad", "The file could not be opened.");
        return false;
      }
    }

    #bindEvents() {
      const options = { signal: this.#listeners.signal };
      this.#window.addEventListener("click", (event) => {
        const menuButton = event.target.closest("[data-notepad-menu-button]");
        if (menuButton) {
          event.stopPropagation();
          this.#toggleMenu(menuButton.dataset.notepadMenuButton);
          return;
        }
        const actionButton = event.target.closest("[data-notepad-action]");
        if (actionButton && !actionButton.disabled) {
          event.stopPropagation();
          this.#closeMenus();
          void this.#runAction(actionButton.dataset.notepadAction);
        }
      }, options);
      this.#window.querySelector(".notepad-menu")?.addEventListener("pointerover", (event) => {
        const root = event.target.closest("[data-notepad-menu-button]");
        if (root && this.#window.querySelector("[data-notepad-menu]:not([hidden])")) this.#openMenu(root.dataset.notepadMenuButton);
      }, options);
      document.addEventListener("pointerdown", (event) => {
        if (!event.target.closest(".notepad-menu")) this.#closeMenus();
      }, { ...options, capture: true });
      this.#editor.addEventListener("input", () => {
        this.#dirty = true;
        this.#updateTitle();
        this.#updateStatus();
        this.#updateMenus();
      }, options);
      ["click", "keyup", "select", "scroll"].forEach((type) => {
        this.#editor.addEventListener(type, () => this.#updateStatus(), options);
      });
      this.#editor.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          this.#replaceSelection("\t");
        }
      }, options);
      window.addEventListener("keydown", (event) => this.#handleKeyboard(event), options);
    }

    #handleKeyboard(event) {
      if (this.#window.hidden || this.#window.classList.contains("minimized") || !this.#window.classList.contains("active")) return;
      const key = event.key.toLocaleLowerCase();
      if (event.key === "Escape") {
        if (!this.#dialogLayer.hidden) this.#closeDialog();
        else this.#closeMenus();
        return;
      }
      if (event.key === "F3") {
        event.preventDefault();
        void this.#runAction("find-next");
        return;
      }
      if (event.key === "F5") {
        event.preventDefault();
        void this.#runAction("time-date");
        return;
      }
      if (!event.ctrlKey) return;
      const shortcuts = {
        n: "new", o: "open", s: event.shiftKey ? "save-as" : "save", p: "print",
        f: "find", h: "replace", g: "go-to"
      };
      const action = shortcuts[key];
      if (action) {
        event.preventDefault();
        void this.#runAction(action);
      }
    }

    #toggleMenu(name) {
      const menu = this.#window.querySelector(`[data-notepad-menu="${CSS.escape(name)}"]`);
      if (!menu) return;
      const shouldOpen = menu.hidden;
      this.#closeMenus();
      if (shouldOpen) this.#openMenu(name);
    }

    #openMenu(name) {
      this.#closeMenus();
      this.#updateMenus();
      const menu = this.#window.querySelector(`[data-notepad-menu="${CSS.escape(name)}"]`);
      const button = this.#window.querySelector(`[data-notepad-menu-button="${CSS.escape(name)}"]`);
      if (!menu || !button) return;
      menu.hidden = false;
      button.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
    }

    #closeMenus() {
      this.#window.querySelectorAll("[data-notepad-menu]").forEach((menu) => { menu.hidden = true; });
      this.#window.querySelectorAll("[data-notepad-menu-button]").forEach((button) => {
        button.classList.remove("is-open");
        button.setAttribute("aria-expanded", "false");
      });
    }

    #updateMenus() {
      const hasSelection = this.#editor.selectionStart !== this.#editor.selectionEnd;
      const hasText = this.#editor.value.length > 0;
      const setDisabled = (action, disabled) => {
        const button = this.#window.querySelector(`[data-notepad-action="${action}"]`);
        if (button) button.disabled = disabled;
      };
      ["cut", "copy", "delete"].forEach((action) => setDisabled(action, !hasSelection));
      setDisabled("undo", !hasText);
      setDisabled("find", !hasText);
      setDisabled("find-next", !hasText);
      setDisabled("replace", !hasText);
      setDisabled("go-to", this.#wordWrap || !hasText);
      const wrap = this.#window.querySelector('[data-notepad-action="word-wrap"]');
      if (wrap) {
        wrap.setAttribute("aria-checked", String(this.#wordWrap));
        const check = wrap.querySelector(".notepad-menu__check");
        if (check) check.textContent = this.#wordWrap ? "✓" : "";
      }
      const status = this.#window.querySelector('[data-notepad-action="status-bar"]');
      if (status) {
        status.disabled = this.#wordWrap;
        status.setAttribute("aria-checked", String(this.#statusVisible));
        const check = status.querySelector(".notepad-menu__check");
        if (check) check.textContent = this.#statusVisible ? "✓" : "";
      }
    }

    async #runAction(action) {
      if (action === "new") {
        if (this.#confirmDiscard()) this.reset();
      } else if (action === "open") {
        if (!this.#confirmDiscard()) return;
        const result = await this.#showFileDialog("open");
        if (result?.node) await this.open(result.node, { confirmDiscard: false });
      } else if (action === "save") {
        await this.#save(false);
      } else if (action === "save-as") {
        await this.#save(true);
      } else if (action === "page-setup") {
        this.#showPageSetupDialog();
      } else if (action === "print") {
        this.#showPrintDialog();
      } else if (action === "exit") {
        if (this.requestClose()) this.#shell.closeWindow(this.#window);
      } else if (action === "undo") {
        this.#editor.focus({ preventScroll: true });
        document.execCommand("undo");
        this.#dirty = true;
        this.#updateTitle();
      } else if (action === "cut") {
        await this.#copyOrCut(true);
      } else if (action === "copy") {
        await this.#copyOrCut(false);
      } else if (action === "paste") {
        await this.#paste();
      } else if (action === "delete") {
        this.#replaceSelection("");
      } else if (action === "find") {
        this.#showFindDialog(false);
      } else if (action === "find-next") {
        if (!this.#lastFind) this.#showFindDialog(false);
        else this.#findNext();
      } else if (action === "replace") {
        this.#showFindDialog(true);
      } else if (action === "go-to") {
        this.#showGoToDialog();
      } else if (action === "select-all") {
        this.#editor.focus({ preventScroll: true });
        this.#editor.select();
        this.#updateStatus();
      } else if (action === "time-date") {
        this.#replaceSelection(new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", year: "numeric", month: "numeric", day: "numeric" }).format(new Date()));
      } else if (action === "word-wrap") {
        this.#wordWrap = !this.#wordWrap;
        this.#applyViewSettings();
      } else if (action === "font") {
        this.#showFontDialog();
      } else if (action === "status-bar") {
        this.#statusVisible = !this.#statusVisible;
        this.#applyViewSettings();
      } else if (action === "help") {
        this.#showHelpDialog();
      } else if (action === "about") {
        this.#showAboutDialog();
      }
      this.#updateStatus();
      this.#updateMenus();
    }

    #confirmDiscard() {
      return !this.#dirty || window.confirm(`The text in ${this.#fileName} has changed.\n\nDo you want to discard the changes?`);
    }

    async #save(forceDialog) {
      let target = null;
      if (forceDialog || !this.#currentNode) {
        target = await this.#showFileDialog("save");
        if (!target) return false;
      }
      this.#ignoreFileSystemChange = true;
      const node = this.#shell.saveText({
        existingNode: target?.existingNode ?? (forceDialog ? null : this.#currentNode),
        folderPath: target?.folder ?? this.#currentFolder,
        name: target?.name ?? this.#fileName,
        text: this.#editor.value
      });
      this.#ignoreFileSystemChange = false;
      if (!node) {
        this.#showMessage("Notepad", "The file could not be saved.");
        return false;
      }
      this.#currentNode = node;
      this.#currentFolder = node.parentPath;
      this.#fileName = node.name;
      this.#dirty = false;
      this.#updateTitle();
      return true;
    }

    async #copyOrCut(cut) {
      const selected = this.#editor.value.slice(this.#editor.selectionStart, this.#editor.selectionEnd);
      if (!selected) return;
      try {
        await navigator.clipboard?.writeText(selected);
      } catch {
        this.#editor.focus({ preventScroll: true });
        document.execCommand("copy");
      }
      if (cut) this.#replaceSelection("");
    }

    async #paste() {
      this.#editor.focus({ preventScroll: true });
      try {
        const text = await navigator.clipboard.readText();
        this.#replaceSelection(text);
      } catch {
        if (!document.execCommand("paste")) this.#showMessage("Notepad", "Clipboard access is not available in this browser.");
      }
    }

    #replaceSelection(text) {
      const start = this.#editor.selectionStart;
      this.#editor.setRangeText(text, start, this.#editor.selectionEnd, "end");
      this.#editor.focus({ preventScroll: true });
      this.#dirty = true;
      this.#updateTitle();
      this.#updateStatus();
      this.#updateMenus();
      this.#editor.dispatchEvent(new Event("input", { bubbles: true }));
    }

    #findNext() {
      const needle = this.#lastFind;
      if (!needle) return false;
      const source = this.#matchCase ? this.#editor.value : this.#editor.value.toLocaleLowerCase();
      const query = this.#matchCase ? needle : needle.toLocaleLowerCase();
      let index;
      if (this.#searchDirection === "up") {
        const before = Math.max(0, this.#editor.selectionStart - 1);
        index = source.lastIndexOf(query, before);
        if (index < 0) index = source.lastIndexOf(query);
      } else {
        index = source.indexOf(query, this.#editor.selectionEnd);
        if (index < 0) index = source.indexOf(query);
      }
      if (index < 0) {
        this.#showMessage("Notepad", `Cannot find “${needle}”.`);
        return false;
      }
      this.#editor.focus({ preventScroll: true });
      this.#editor.setSelectionRange(index, index + needle.length);
      this.#updateStatus();
      return true;
    }

    #showFindDialog(replaceMode) {
      const dialog = createElement("section", { className: "notepad-dialog notepad-find-dialog", role: "dialog", "aria-label": replaceMode ? "Replace" : "Find" });
      dialog.append(createElement("h2", { text: replaceMode ? "Replace" : "Find" }));
      const form = createElement("form", { className: "notepad-find-dialog__form" });
      const findInput = createElement("input", { type: "text", value: this.#lastFind, required: true, "aria-label": "Find what" });
      form.append(createElement("label", { text: "Find what:" }), findInput);
      let replaceInput = null;
      if (replaceMode) {
        replaceInput = createElement("input", { type: "text", "aria-label": "Replace with" });
        form.append(createElement("label", { text: "Replace with:" }), replaceInput);
      }
      const options = createElement("div", { className: "notepad-find-dialog__options" });
      const matchCase = createElement("input", { type: "checkbox", checked: this.#matchCase });
      options.append(createElement("label", {}, [matchCase, createElement("span", { text: "Match case" })]));
      if (!replaceMode) {
        const directions = createElement("fieldset", {}, [createElement("legend", { text: "Direction" })]);
        const up = createElement("input", { type: "radio", name: "notepad-find-direction", value: "up", checked: this.#searchDirection === "up" });
        const down = createElement("input", { type: "radio", name: "notepad-find-direction", value: "down", checked: this.#searchDirection !== "up" });
        directions.append(createElement("label", {}, [up, createElement("span", { text: "Up" })]), createElement("label", {}, [down, createElement("span", { text: "Down" })]));
        options.append(directions);
      }
      const buttons = createElement("div", { className: "notepad-find-dialog__buttons" });
      const findNext = createElement("button", { type: "submit", className: "default", text: "Find Next" });
      buttons.append(findNext);
      if (replaceMode) {
        const replace = createElement("button", { type: "button", text: "Replace" });
        const replaceAll = createElement("button", { type: "button", text: "Replace All" });
        const applySearch = () => {
          this.#lastFind = findInput.value;
          this.#matchCase = matchCase.checked;
          this.#searchDirection = "down";
        };
        replace.addEventListener("click", () => {
          applySearch();
          const selected = this.#editor.value.slice(this.#editor.selectionStart, this.#editor.selectionEnd);
          const equals = this.#matchCase ? selected === this.#lastFind : selected.toLocaleLowerCase() === this.#lastFind.toLocaleLowerCase();
          if (equals) this.#replaceSelection(replaceInput.value);
          this.#findNext();
        });
        replaceAll.addEventListener("click", () => {
          applySearch();
          if (!this.#lastFind) return;
          const expression = new RegExp(this.#escapeRegExp(this.#lastFind), this.#matchCase ? "g" : "gi");
          const next = this.#editor.value.replace(expression, replaceInput.value);
          if (next !== this.#editor.value) {
            this.#editor.value = next;
            this.#dirty = true;
            this.#updateTitle();
          }
        });
        buttons.append(replace, replaceAll);
      }
      const cancel = createElement("button", { type: "button", text: "Cancel" });
      cancel.addEventListener("click", () => this.#closeDialog());
      buttons.append(cancel);
      form.append(options, buttons);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        this.#lastFind = findInput.value;
        this.#matchCase = matchCase.checked;
        this.#searchDirection = form.querySelector('input[name="notepad-find-direction"]:checked')?.value ?? "down";
        this.#findNext();
      });
      dialog.append(form);
      this.#showDialog(dialog);
      requestAnimationFrame(() => { findInput.focus(); findInput.select(); });
    }

    #showGoToDialog() {
      if (this.#wordWrap) return;
      const lines = this.#editor.value.split("\n");
      const currentLine = this.#editor.value.slice(0, this.#editor.selectionStart).split("\n").length;
      const dialog = createElement("section", { className: "notepad-dialog notepad-go-to-dialog", role: "dialog", "aria-label": "Go To Line" });
      dialog.append(createElement("h2", { text: "Go To Line" }));
      const form = createElement("form");
      const input = createElement("input", { type: "number", min: 1, max: Math.max(1, lines.length), value: currentLine, required: true });
      const buttons = createElement("div", { className: "notepad-dialog__buttons" });
      buttons.append(createElement("button", { type: "submit", className: "default", text: "Go To" }));
      const cancel = createElement("button", { type: "button", text: "Cancel" });
      cancel.addEventListener("click", () => this.#closeDialog());
      buttons.append(cancel);
      form.append(createElement("label", { text: "Line number:" }), input, buttons);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const line = clamp(Number(input.value) || 1, 1, Math.max(1, lines.length));
        const offset = lines.slice(0, line - 1).reduce((total, value) => total + value.length + 1, 0);
        this.#closeDialog();
        this.#editor.focus({ preventScroll: true });
        this.#editor.setSelectionRange(offset, offset);
        this.#updateStatus();
      });
      dialog.append(form);
      this.#showDialog(dialog);
      requestAnimationFrame(() => { input.focus(); input.select(); });
    }

    #showFontDialog() {
      const dialog = createElement("section", { className: "notepad-dialog notepad-font-dialog", role: "dialog", "aria-label": "Font" });
      dialog.append(createElement("h2", { text: "Font" }));
      const controls = createElement("div", { className: "notepad-font-dialog__controls" });
      const family = createElement("select", { size: 7, "aria-label": "Font" });
      FONT_FAMILIES.forEach((value) => family.append(createElement("option", { value, text: value, selected: value === this.#fontFamily })));
      const style = createElement("select", { size: 7, "aria-label": "Font style" });
      ["Regular", "Italic", "Bold", "Bold Italic"].forEach((value) => style.append(createElement("option", { value, text: value, selected: value === this.#fontStyle })));
      const size = createElement("select", { size: 7, "aria-label": "Size" });
      FONT_SIZES.forEach((value) => size.append(createElement("option", { value, text: String(value), selected: value === this.#fontSize })));
      controls.append(createElement("label", { text: "Font:" }), createElement("label", { text: "Font style:" }), createElement("label", { text: "Size:" }), family, style, size);
      const preview = createElement("div", { className: "notepad-font-dialog__preview", text: "AaBbYyZz" });
      const renderPreview = () => this.#applyFontToElement(preview, family.value, Number(size.value), style.value);
      [family, style, size].forEach((control) => control.addEventListener("change", renderPreview));
      const buttons = createElement("div", { className: "notepad-dialog__buttons" });
      const ok = createElement("button", { type: "button", className: "default", text: "OK" });
      const cancel = createElement("button", { type: "button", text: "Cancel" });
      ok.addEventListener("click", () => {
        this.#fontFamily = family.value;
        this.#fontSize = Number(size.value);
        this.#fontStyle = style.value;
        this.#applyViewSettings();
        this.#closeDialog();
      });
      cancel.addEventListener("click", () => this.#closeDialog());
      buttons.append(ok, cancel);
      dialog.append(controls, createElement("fieldset", { className: "notepad-font-dialog__sample" }, [createElement("legend", { text: "Sample" }), preview]), buttons);
      this.#showDialog(dialog);
      renderPreview();
    }

    #showPageSetupDialog() {
      const dialog = createElement("section", { className: "notepad-dialog notepad-page-dialog", role: "dialog", "aria-label": "Page Setup" });
      dialog.append(createElement("h2", { text: "Page Setup" }));
      const form = createElement("form");
      const portrait = createElement("input", { type: "radio", name: "notepad-orientation", value: "portrait", checked: this.#pageSetup.orientation === "portrait" });
      const landscape = createElement("input", { type: "radio", name: "notepad-orientation", value: "landscape", checked: this.#pageSetup.orientation === "landscape" });
      const orientation = createElement("fieldset", {}, [createElement("legend", { text: "Orientation" }), createElement("label", {}, [portrait, createElement("span", { text: "Portrait" })]), createElement("label", {}, [landscape, createElement("span", { text: "Landscape" })])]);
      const margins = createElement("fieldset", { className: "notepad-page-dialog__margins" }, [createElement("legend", { text: "Margins (inches)" })]);
      const inputs = {};
      ["left", "right", "top", "bottom"].forEach((key) => {
        inputs[key] = createElement("input", { type: "number", min: 0, max: 5, step: 0.25, value: this.#pageSetup[key] });
        margins.append(createElement("label", { text: `${key[0].toUpperCase()}${key.slice(1)}:` }), inputs[key]);
      });
      const buttons = createElement("div", { className: "notepad-dialog__buttons" });
      buttons.append(createElement("button", { type: "submit", className: "default", text: "OK" }));
      const cancel = createElement("button", { type: "button", text: "Cancel" });
      cancel.addEventListener("click", () => this.#closeDialog());
      buttons.append(cancel);
      form.append(orientation, margins, buttons);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        this.#pageSetup.orientation = form.querySelector('input[name="notepad-orientation"]:checked').value;
        Object.keys(inputs).forEach((key) => { this.#pageSetup[key] = clamp(Number(inputs[key].value) || 0, 0, 5); });
        this.#closeDialog();
      });
      dialog.append(form);
      this.#showDialog(dialog);
    }

    #showPrintDialog() {
      const dialog = createElement("section", { className: "notepad-dialog notepad-print-dialog", role: "dialog", "aria-label": "Print" });
      dialog.append(createElement("h2", { text: "Print" }));
      const summary = createElement("div", { className: "notepad-print-dialog__summary" }, [
        createElement("span", { className: "notepad-print-dialog__printer", text: "▤" }),
        createElement("div", {}, [createElement("strong", { text: "Default printer" }), createElement("p", { text: `${this.#fileName} — ${this.#editor.value.split("\n").length} line(s)` })])
      ]);
      const buttons = createElement("div", { className: "notepad-dialog__buttons" });
      const print = createElement("button", { type: "button", className: "default", text: "Print" });
      const cancel = createElement("button", { type: "button", text: "Cancel" });
      print.addEventListener("click", () => { this.#closeDialog(); this.#printDocument(); });
      cancel.addEventListener("click", () => this.#closeDialog());
      buttons.append(print, cancel);
      dialog.append(summary, buttons);
      this.#showDialog(dialog);
    }

    #printDocument() {
      const frame = createElement("iframe", { title: "Notepad print document" });
      frame.style.position = "fixed";
      frame.style.width = "0";
      frame.style.height = "0";
      frame.style.border = "0";
      document.body.append(frame);
      const documentToPrint = frame.contentDocument;
      const orientation = this.#pageSetup.orientation;
      documentToPrint.open();
      documentToPrint.write(`<!doctype html><title>${this.#escapeHtml(this.#fileName)}</title><style>@page{size:${orientation};margin:${this.#pageSetup.top}in ${this.#pageSetup.right}in ${this.#pageSetup.bottom}in ${this.#pageSetup.left}in}body{white-space:pre-wrap;font:${this.#fontStyle.includes("Italic") ? "italic " : ""}${this.#fontStyle.includes("Bold") ? "bold " : ""}${this.#fontSize}px ${this.#fontFamily},monospace}</style><body>${this.#escapeHtml(this.#editor.value)}</body>`);
      documentToPrint.close();
      frame.contentWindow.focus();
      frame.contentWindow.print();
      window.setTimeout(() => frame.remove(), 1000);
    }

    #showHelpDialog() {
      const dialog = this.#messageDialog("Notepad Help", "Use the File menu to open and save text files stored on this desktop. Find and Replace search the current document; Format controls word wrapping and the editor font.");
      const shortcuts = createElement("dl", { className: "notepad-help-shortcuts" });
      [["Ctrl+N", "New"], ["Ctrl+O", "Open"], ["Ctrl+S", "Save"], ["Ctrl+F", "Find"], ["F3", "Find next"], ["F5", "Time/Date"]].forEach(([key, value]) => shortcuts.append(createElement("dt", { text: key }), createElement("dd", { text: value })));
      dialog.querySelector(".notepad-message-dialog__content").append(shortcuts);
      this.#showDialog(dialog);
    }

    #showAboutDialog() {
      const dialog = this.#messageDialog("About Notepad", "Microsoft Windows\nVersion 6.1 (Build 7601: Service Pack 1)\n\nWindows 7 Web OS Notepad");
      dialog.classList.add("notepad-about-dialog");
      dialog.querySelector(".notepad-message-dialog__content").prepend(createElement("img", { src: "./assets/icons/notepad.png", alt: "", draggable: false }));
      this.#showDialog(dialog);
    }

    #showMessage(title, message) {
      this.#showDialog(this.#messageDialog(title, message));
    }

    #messageDialog(title, message) {
      const dialog = createElement("section", { className: "notepad-dialog notepad-message-dialog", role: "alertdialog", "aria-label": title });
      dialog.append(createElement("h2", { text: title }));
      const content = createElement("div", { className: "notepad-message-dialog__content" }, createElement("p", { text: message }));
      const buttons = createElement("div", { className: "notepad-dialog__buttons" });
      const ok = createElement("button", { type: "button", className: "default", text: "OK" });
      ok.addEventListener("click", () => this.#closeDialog());
      buttons.append(ok);
      dialog.append(content, buttons);
      return dialog;
    }

    #showFileDialog(mode) {
      return new Promise((resolve) => {
        let currentFolder = mode === "save" && this.#shell.writableFolders().includes(this.#currentFolder) ? this.#currentFolder : "/Documents";
        let selectedNode = null;
        const dialog = createElement("section", { className: "notepad-file-dialog", role: "dialog", "aria-label": mode === "open" ? "Open" : "Save As" });
        dialog.append(createElement("h2", { text: mode === "open" ? "Open" : "Save As" }));
        const form = createElement("form", { className: "notepad-file-dialog__form" });
        const navigation = createElement("div", { className: "notepad-file-dialog__navigation" });
        navigation.append(createElement("button", { type: "button", text: "◀", disabled: true, title: "Back" }), createElement("button", { type: "button", text: "▶", disabled: true, title: "Forward" }));
        const address = createElement("div", { className: "notepad-file-dialog__address" });
        const search = createElement("input", { type: "search", "aria-label": "Search current folder" });
        navigation.append(address, search);
        const commandBar = createElement("div", { className: "notepad-file-dialog__command-bar" }, [createElement("button", { type: "button", text: "Organize ▾" }), createElement("button", { type: "button", text: "New folder", disabled: true })]);
        const browser = createElement("div", { className: "notepad-file-dialog__browser" });
        const sidebar = createElement("aside", { className: "notepad-file-dialog__sidebar" });
        const listPane = createElement("div", { className: "notepad-file-dialog__list-pane" });
        listPane.append(createElement("div", { className: "notepad-file-dialog__columns" }, [createElement("span", { text: "Name" }), createElement("span", { text: "Date modified" }), createElement("span", { text: "Type" }), createElement("span", { text: "Size" })]));
        const list = createElement("div", { className: "notepad-file-dialog__files", role: "listbox" });
        listPane.append(list);
        browser.append(sidebar, listPane);
        const footer = createElement("div", { className: "notepad-file-dialog__footer" });
        const name = createElement("input", { type: "text", value: this.#currentNode ? this.#fileName : "Untitled.txt", required: true, "aria-label": "File name" });
        const type = createElement("select", { "aria-label": mode === "save" ? "Save as type" : "Files of type" }, [createElement("option", { value: "txt", text: "Text Documents (*.txt)" }), createElement("option", { value: "all", text: "All Files (*.*)" })]);
        const actions = createElement("div", { className: "notepad-file-dialog__actions" });
        const accept = createElement("button", { type: "submit", className: "default", text: mode === "open" ? "Open" : "Save" });
        const cancel = createElement("button", { type: "button", text: "Cancel" });
        actions.append(accept, cancel);
        footer.append(createElement("label", { text: "File name:" }), name, actions, createElement("label", { text: mode === "save" ? "Save as type:" : "Files of type:" }), type);
        form.append(navigation, commandBar, browser, footer);
        dialog.append(form);

        const finish = (value) => { this.#closeDialog(); resolve(value); };
        const folderName = (path) => path.slice(1);
        const render = () => {
          selectedNode = null;
          accept.disabled = mode === "open";
          const icon = LOCATIONS.flatMap(({ entries }) => entries).find(([, path]) => path === currentFolder)?.[2] ?? TEXT_ICON;
          address.replaceChildren(createElement("img", { src: icon, alt: "" }), createElement("span", { text: folderName(currentFolder) }));
          search.placeholder = `Search ${folderName(currentFolder)}`;
          sidebar.querySelectorAll("[data-folder]").forEach((button) => button.classList.toggle("is-current", button.dataset.folder === currentFolder));
          const query = search.value.trim().toLocaleLowerCase();
          const nodes = this.#shell.listTexts(currentFolder).filter((node) => !query || node.name.toLocaleLowerCase().includes(query)).sort((first, second) => first.name.localeCompare(second.name, undefined, { numeric: true, sensitivity: "base" }));
          if (!nodes.length) {
            list.replaceChildren(createElement("p", { className: "notepad-file-dialog__empty", text: query ? "No items match your search." : "This folder is empty." }));
            return;
          }
          list.replaceChildren(...nodes.map((node) => {
            const bytes = Number(node.file?.size ?? node.meta?.size ?? 0);
            const modified = node.meta?.modifiedAt instanceof Date ? node.meta.modifiedAt.toLocaleDateString() : "";
            const row = createElement("button", { type: "button", className: "notepad-file-dialog__file", role: "option" }, [
              createElement("span", { className: "notepad-file-dialog__name" }, [createElement("img", { src: TEXT_ICON, alt: "" }), createElement("span", { text: node.name })]),
              createElement("span", { text: modified }), createElement("span", { text: "Text Document" }), createElement("span", { text: bytes ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : "" })
            ]);
            row.addEventListener("click", () => {
              selectedNode = node;
              list.querySelectorAll(".is-selected").forEach((item) => item.classList.remove("is-selected"));
              row.classList.add("is-selected");
              name.value = node.name;
              accept.disabled = false;
            });
            row.addEventListener("dblclick", () => { if (mode === "open") finish({ node }); });
            return row;
          }));
        };
        LOCATIONS.forEach(({ heading, entries }) => {
          sidebar.append(createElement("h3", { text: heading }));
          entries.forEach(([label, path, icon]) => {
            const button = createElement("button", { type: "button", dataset: { folder: path } }, [createElement("img", { src: icon, alt: "" }), createElement("span", { text: label })]);
            button.addEventListener("click", () => { currentFolder = path; search.value = ""; render(); });
            sidebar.append(button);
          });
        });
        search.addEventListener("input", render);
        cancel.addEventListener("click", () => finish(null), { once: true });
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          if (mode === "open") {
            if (selectedNode) finish({ node: selectedNode });
            return;
          }
          let requested = name.value.trim();
          if (!requested) return;
          if (type.value === "txt" && !/\.[a-z0-9]+$/i.test(requested)) requested += ".txt";
          const existingNode = this.#shell.listTexts(currentFolder).find((node) => node.name.localeCompare(requested, undefined, { sensitivity: "base" }) === 0) ?? null;
          if (existingNode && !window.confirm(`${requested} already exists. Do you want to replace it?`)) return;
          finish({ folder: currentFolder, name: requested, existingNode });
        });
        this.#showDialog(dialog);
        render();
        if (mode === "save") requestAnimationFrame(() => { name.focus(); const dot = name.value.lastIndexOf("."); name.setSelectionRange(0, dot > 0 ? dot : name.value.length); });
      });
    }

    #showDialog(dialog) {
      this.#closeMenus();
      this.#dialogLayer.hidden = false;
      this.#dialogLayer.replaceChildren(dialog);
    }

    #closeDialog() {
      this.#dialogLayer.hidden = true;
      this.#dialogLayer.replaceChildren();
    }

    #applyViewSettings() {
      this.#editor.wrap = this.#wordWrap ? "soft" : "off";
      this.#editor.classList.toggle("is-word-wrapped", this.#wordWrap);
      this.#applyFontToElement(this.#editor, this.#fontFamily, this.#fontSize, this.#fontStyle);
      this.#statusBar.hidden = !this.#statusVisible || this.#wordWrap;
      this.#updateMenus();
      this.#updateStatus();
    }

    #applyFontToElement(element, family, size, style) {
      element.style.fontFamily = `"${family}", monospace`;
      element.style.fontSize = `${size}px`;
      element.style.fontStyle = style.includes("Italic") ? "italic" : "normal";
      element.style.fontWeight = style.includes("Bold") ? "700" : "400";
      element.style.lineHeight = `${Math.round(size * 1.35)}px`;
    }

    #updateStatus() {
      const before = this.#editor.value.slice(0, this.#editor.selectionStart);
      const lines = before.split("\n");
      this.#position.textContent = `Ln ${lines.length}, Col ${lines.at(-1).length + 1}`;
    }

    #updateTitle() {
      this.#shell.setTitle(this.#window, `${this.#dirty ? "*" : ""}${this.#fileName} - Notepad`);
    }

    #handleFileSystemChange() {
      if (this.#ignoreFileSystemChange || !this.#currentNode) return;
      if (this.#shell.list(this.#currentNode.parentPath).includes(this.#currentNode)) return;
      this.#currentNode = null;
      this.#fileName = "Untitled";
      this.#dirty = true;
      this.#updateTitle();
    }

    #escapeRegExp(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    #escapeHtml(value) {
      return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    }
  }

  window.Windows7NotepadApp = Windows7NotepadApp;
})();
