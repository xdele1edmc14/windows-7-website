(function initializeControlPanel(globalScope, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.Windows7ControlPanel = api;
})(typeof window === "object" ? window : (typeof globalThis === "object" ? globalThis : this), () => {
  "use strict";

  const controlPanelIcon = (fileName) => `./assets/icons/controlpanel/${fileName}`;
  const item = (id, label, icon, action = null) => Object.freeze({ id, label, icon, action });

  const CONTROL_PANEL_ITEMS = Object.freeze([
    item("data-usage", "Data Usage", controlPanelIcon("data_usage-9_64x64.png")),
    item("display", "Display", controlPanelIcon("display.png"), "display"),
    item("keyboard", "Keyboard", controlPanelIcon("keybaord-5.png")),
    item("sync-center", "Sync Center", controlPanelIcon("synccenter.png")),
    item("windows-defender", "Windows Defender", controlPanelIcon("defender.png")),
    item("date-time", "Date and Time", controlPanelIcon("dateandtime.png")),
    item("backup-restore", "Backup and Restore", controlPanelIcon("backupandrestore.png")),
    item("mouse", "Mouse", controlPanelIcon("mouse.png")),
    item("system", "System", controlPanelIcon("system_64x64.png")),
    item("windows-update", "Windows Update", controlPanelIcon("windowsupdate_64x64.png")),
    item("default-programs", "Default Programs", "./assets/icons/defaultprograms.ico"),
    item("ease-access", "Ease of Access", controlPanelIcon("easeofaccess.png")),
    item("personalize", "Personalize", controlPanelIcon("gadgets_64x64.png"), "themes"),
    item("sound", "Sound", "./assets/icons/speaker.png"),
    item("taskbar-start-menu", "Taskbar and Start Menu", controlPanelIcon("taskbarandstartmenu_64x64.png")),
    item("device-storage", "Device Storage", controlPanelIcon("HyperVWindows8.png")),
    item("gadgets", "Gadgets", controlPanelIcon("gadgets_64x64.png")),
    item("speech-recognition", "Speech Recognition", controlPanelIcon("speechandrecognition.png")),
    item("user-accounts", "User Accounts", controlPanelIcon("useraccounts-4_64x64.png"))
  ]);

  const filterControlPanelItems = (items, query) => {
    const normalizedQuery = String(query ?? "").trim().toLocaleLowerCase();
    if (!normalizedQuery) return items;
    return items.filter(({ label }) => label.toLocaleLowerCase().includes(normalizedQuery));
  };

  class ControlPanelApp {
    #root;
    #backButton;
    #address;
    #search;
    #homeView;
    #displayView;
    #themesView;
    #grid;
    #emptyState;
    #onShowThemes;
    #listeners = new AbortController();
    #view = "home";

    constructor(root, { onShowThemes = () => {} } = {}) {
      if (!root?.querySelector || !root.ownerDocument) {
        throw new TypeError("ControlPanelApp requires a Control Panel window element.");
      }

      this.#root = root;
      this.#backButton = this.#required("[data-control-panel-back]");
      this.#address = this.#required("[data-control-panel-address]");
      this.#search = this.#required("[data-control-panel-search]");
      this.#homeView = this.#required("[data-control-panel-home]");
      this.#displayView = this.#required("[data-control-panel-display]");
      this.#themesView = this.#required("[data-control-panel-themes]");
      this.#grid = this.#required("[data-control-panel-grid]");
      this.#emptyState = this.#required("[data-control-panel-empty]");
      this.#onShowThemes = onShowThemes;

      this.#backButton.addEventListener("click", () => this.showHome(), {
        signal: this.#listeners.signal
      });
      this.#search.addEventListener("input", () => {
        if (this.#view !== "home") this.showHome();
        else this.#renderItems(filterControlPanelItems(CONTROL_PANEL_ITEMS, this.#search.value));
      }, { signal: this.#listeners.signal });

      this.showHome();
    }

    showHome({ clearSearch = false } = {}) {
      this.#view = "home";
      if (clearSearch) this.#search.value = "";
      this.#homeView.hidden = false;
      this.#displayView.hidden = true;
      this.#themesView.hidden = true;
      this.#backButton.disabled = true;
      this.#address.textContent = "Control Panel";
      this.#renderItems(filterControlPanelItems(CONTROL_PANEL_ITEMS, this.#search.value));
    }

    showDisplay() {
      this.#view = "display";
      this.#homeView.hidden = true;
      this.#displayView.hidden = false;
      this.#themesView.hidden = true;
      this.#backButton.disabled = false;
      this.#address.textContent = "Control Panel > Display";
    }

    showThemes() {
      this.#view = "themes";
      this.#homeView.hidden = true;
      this.#displayView.hidden = true;
      this.#themesView.hidden = false;
      this.#backButton.disabled = false;
      this.#address.textContent = "Control Panel > Personalization";
      this.#onShowThemes();
    }

    destroy() {
      this.#listeners.abort();
    }

    #required(selector) {
      const element = this.#root.querySelector(selector);
      if (!element) throw new Error(`Control Panel is missing ${selector}.`);
      return element;
    }

    #renderItems(items) {
      const buttons = items.map((entry) => {
        const button = this.#root.ownerDocument.createElement("button");
        button.type = "button";
        button.className = "control-panel-item";
        button.dataset.controlPanelItem = entry.id;
        if (entry.action) button.dataset.controlPanelAction = entry.action;

        const icon = this.#root.ownerDocument.createElement("img");
        icon.src = entry.icon;
        icon.alt = "";
        icon.draggable = false;

        const label = this.#root.ownerDocument.createElement("span");
        label.textContent = entry.label;
        button.append(icon, label);

        if (entry.action === "display") {
          button.addEventListener("click", () => this.showDisplay(), {
            signal: this.#listeners.signal
          });
        } else if (entry.action === "themes") {
          button.addEventListener("click", () => this.showThemes(), {
            signal: this.#listeners.signal
          });
        }
        return button;
      });

      this.#grid.replaceChildren(...buttons);
      this.#emptyState.hidden = buttons.length > 0;
    }
  }

  return {
    CONTROL_PANEL_ITEMS,
    filterControlPanelItems,
    ControlPanelApp
  };
});
