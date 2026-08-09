(function initializeThemes(globalScope, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.Windows7Themes = api;
})(typeof window === "object" ? window : (typeof globalThis === "object" ? globalThis : this), () => {
  "use strict";

  const LOGON_SOUND = "./assets/Windows Logon Sound.wav";
  const createTheme = (definition) => Object.freeze(definition);

  const THEMES = Object.freeze([
    createTheme({
      id: "windows-7",
      label: "Windows 7",
      family: "aero",
      wallpaper: "./assets/img0.png",
      sound: LOGON_SOUND,
      accent: "#4A90C2"
    }),
    createTheme({
      id: "architecture",
      label: "Architecture",
      family: "aero",
      wallpaper: "./assets/architecture.jpg",
      sound: "./assets/architecture.mp3",
      accent: "#7EA1D5"
    }),
    createTheme({
      id: "landscape",
      label: "Landscape",
      family: "aero",
      wallpaper: "./assets/landscape.jpg",
      sound: "./assets/landscape.mp3",
      accent: "#B2B6BB"
    }),
    createTheme({
      id: "nature",
      label: "Nature",
      family: "aero",
      wallpaper: "./assets/nature.jpg",
      sound: "./assets/nature.mp3",
      accent: "#B29ACC"
    }),
    createTheme({
      id: "windows-7-basic",
      label: "Windows 7 Basic",
      family: "basic",
      wallpaper: "./assets/img0.png",
      sound: LOGON_SOUND,
      accent: "#4A90C2"
    }),
    createTheme({
      id: "windows-classic",
      label: "Windows Classic",
      family: "classic",
      wallpaper: null,
      sound: LOGON_SOUND,
      desktopColor: "#3B6EA4",
      accent: "#D4D0C8"
    }),
    createTheme({
      id: "high-contrast-black",
      label: "High Contrast Black",
      family: "high-contrast",
      wallpaper: null,
      sound: LOGON_SOUND,
      desktopColor: "#000000",
      surface: "#000000",
      foreground: "#FFFFFF",
      accent: "#FFFF00"
    }),
    createTheme({
      id: "high-contrast-white",
      label: "High Contrast White",
      family: "high-contrast",
      wallpaper: null,
      sound: LOGON_SOUND,
      desktopColor: "#FFFFFF",
      surface: "#FFFFFF",
      foreground: "#000000",
      accent: "#0000FF"
    })
  ]);

  const THEME_GROUPS = Object.freeze([
    Object.freeze({
      id: "aero",
      label: "Aero Themes (4)",
      themeIds: Object.freeze(["windows-7", "architecture", "landscape", "nature"])
    }),
    Object.freeze({
      id: "basic-high-contrast",
      label: "Basic and High Contrast Themes (4)",
      themeIds: Object.freeze(["windows-7-basic", "windows-classic", "high-contrast-black", "high-contrast-white"])
    })
  ]);

  const hexToRgb = (hex) => {
    const value = String(hex).replace("#", "");
    return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)).join(", ");
  };

  const buildThemePresentation = (theme) => {
    const highContrast = theme.family === "high-contrast";
    const classic = theme.family === "classic";
    const accentRgb = hexToRgb(theme.accent);
    return {
      themeId: theme.id,
      wallpaper: theme.wallpaper,
      desktopColor: theme.desktopColor ?? theme.accent,
      variables: {
        "--theme-accent": theme.accent,
        "--theme-accent-rgb": accentRgb,
        "--theme-shell-dark": `rgba(${accentRgb}, .96)`,
        "--theme-shell-mid": `rgba(${accentRgb}, .9)`,
        "--theme-shell-light": `rgba(${accentRgb}, .78)`,
        "--theme-window-top": `rgba(${accentRgb}, .88)`,
        "--theme-window-middle": `rgba(${accentRgb}, .76)`,
        "--theme-window-bottom": `rgba(${accentRgb}, .92)`,
        "--theme-document": highContrast ? theme.surface : (classic ? "#D4D0C8" : "#FFFFFF"),
        "--theme-foreground": theme.foreground ?? "#111111",
        "--theme-link": highContrast ? theme.accent : (classic ? "#202020" : "#0645A5")
      }
    };
  };

  const preloadImage = (source, ImageCtor = globalThis.Image) => new Promise((resolve, reject) => {
    const image = new ImageCtor();
    image.addEventListener("load", async () => {
      try {
        if (typeof image.decode === "function") await image.decode();
        resolve(image);
      } catch (error) {
        reject(error);
      }
    }, { once: true });
    image.addEventListener("error", () => reject(new Error(`Could not load wallpaper: ${source}`)), { once: true });
    image.src = source;
  });

  const preloadAudio = (source, AudioCtor = globalThis.Audio) => new Promise((resolve, reject) => {
    const audio = new AudioCtor();
    let settled = false;
    const succeed = () => {
      if (settled) return;
      settled = true;
      resolve(audio);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(new Error(`Could not load theme sound: ${source}`));
    };
    audio.addEventListener("canplaythrough", succeed, { once: true });
    audio.addEventListener("loadeddata", () => {
      if (audio.readyState >= 3) succeed();
    }, { once: true });
    audio.addEventListener("error", fail, { once: true });
    audio.preload = "auto";
    audio.src = source;
    audio.load();
    if (audio.readyState >= 3) queueMicrotask(succeed);
  });

  class ThemesApp {
    #root;
    #grid;
    #getActiveThemeId;
    #onSelect;
    #cards = [];
    #listeners = new AbortController();

    constructor(root, { getActiveThemeId, onSelect }) {
      if (!root?.querySelector || !root.ownerDocument) {
        throw new TypeError("ThemesApp requires a Personalization view element.");
      }
      this.#root = root;
      this.#grid = root.querySelector("[data-themes-grid]");
      if (!this.#grid) throw new Error("ThemesApp is missing [data-themes-grid].");
      this.#grid.setAttribute("role", "radiogroup");
      this.#grid.setAttribute("aria-label", "Desktop themes");
      this.#getActiveThemeId = getActiveThemeId;
      this.#onSelect = onSelect;
      this.#render();
    }

    refresh() {
      this.setActiveTheme(this.#getActiveThemeId());
    }

    setActiveTheme(themeId) {
      const fallbackId = THEMES.some(({ id }) => id === themeId) ? themeId : "windows-7";
      this.#cards.forEach((card) => {
        const active = card.dataset.themeId === fallbackId;
        card.setAttribute("aria-checked", String(active));
        card.tabIndex = active ? 0 : -1;
      });
    }

    destroy() {
      this.#listeners.abort();
    }

    #render() {
      const sections = THEME_GROUPS.map((group) => {
        const section = this.#root.ownerDocument.createElement("section");
        section.className = "themes-group";

        const heading = this.#root.ownerDocument.createElement("h2");
        heading.textContent = group.label;

        const cards = this.#root.ownerDocument.createElement("div");
        cards.className = "themes-grid";

        group.themeIds.forEach((themeId) => {
          const theme = THEMES.find(({ id }) => id === themeId);
          const card = this.#createCard(theme);
          this.#cards.push(card);
          cards.append(card);
        });
        section.append(heading, cards);
        return section;
      });

      this.#grid.replaceChildren(...sections);
      this.refresh();
    }

    #createCard(theme) {
      const card = this.#root.ownerDocument.createElement("button");
      card.type = "button";
      card.className = "theme-card";
      card.dataset.themeId = theme.id;
      card.dataset.themeFamily = theme.family;
      card.setAttribute("role", "radio");
      card.setAttribute("aria-label", theme.label);

      const preview = this.#root.ownerDocument.createElement("span");
      preview.className = "theme-card__preview";
      preview.dataset.themeId = theme.id;
      preview.setAttribute("aria-hidden", "true");
      if (theme.wallpaper) {
        const wallpaper = this.#root.ownerDocument.createElement("img");
        wallpaper.src = theme.wallpaper;
        wallpaper.alt = "";
        wallpaper.draggable = false;
        preview.append(wallpaper);
      }

      const swatch = this.#root.ownerDocument.createElement("span");
      swatch.className = "theme-card__swatch";
      swatch.dataset.themeId = theme.id;
      preview.append(swatch);

      const label = this.#root.ownerDocument.createElement("span");
      label.className = "theme-card__label";
      label.textContent = theme.label;
      card.append(preview, label);

      card.addEventListener("click", () => this.#activate(card), { signal: this.#listeners.signal });
      card.addEventListener("keydown", (event) => this.#handleKeydown(event, card), { signal: this.#listeners.signal });
      return card;
    }

    #activate(card) {
      const theme = THEMES.find(({ id }) => id === card.dataset.themeId);
      const result = this.#onSelect(theme, card);
      if (result && typeof result.then === "function") {
        result.then((applied) => {
          if (applied !== false) this.setActiveTheme(theme.id);
        });
      } else if (result !== false) {
        this.setActiveTheme(theme.id);
      }
    }

    #handleKeydown(event, card) {
      const index = this.#cards.indexOf(card);
      const last = this.#cards.length - 1;
      let nextIndex = null;
      if (["ArrowRight", "ArrowDown"].includes(event.key)) nextIndex = (index + 1) % this.#cards.length;
      else if (["ArrowLeft", "ArrowUp"].includes(event.key)) nextIndex = (index - 1 + this.#cards.length) % this.#cards.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = last;
      else if (["Enter", " "].includes(event.key)) {
        event.preventDefault();
        this.#activate(card);
        return;
      }
      if (nextIndex === null) return;
      event.preventDefault();
      this.#cards[nextIndex].focus();
    }
  }

  class ThemeSwitchController {
    #request = 0;

    constructor({
      preloadTheme,
      applyTheme,
      playSound,
      onBusyChange,
      onError,
      minimumWaitMs = 2000,
      wait = (delay) => new Promise((resolve) => globalThis.setTimeout(resolve, delay))
    }) {
      this.preloadTheme = preloadTheme;
      this.applyTheme = applyTheme;
      this.playSound = playSound;
      this.onBusyChange = onBusyChange;
      this.onError = onError;
      this.minimumWaitMs = minimumWaitMs;
      this.wait = wait;
    }

    async switchTo(theme) {
      const request = ++this.#request;
      this.onBusyChange(true, theme);
      const minimumWait = this.minimumWaitMs > 0
        ? this.wait(this.minimumWaitMs)
        : Promise.resolve();

      try {
        const assets = await this.preloadTheme(theme);
        await minimumWait;
        if (request !== this.#request) return false;
        await this.applyTheme(theme, assets);
        if (request !== this.#request) return false;
        await this.onBusyChange(false, theme, { failed: false });
        if (request !== this.#request) return false;
        try {
          await this.playSound(theme, assets);
        } catch (_) {
          // A browser media-policy rejection must not roll back an applied theme.
        }
        return request === this.#request;
      } catch (error) {
        await minimumWait;
        if (request !== this.#request) return false;
        await this.onBusyChange(false, theme, { failed: true });
        this.onError(error, theme);
        return false;
      }
    }
  }

  return {
    LOGON_SOUND,
    THEME_GROUPS,
    THEMES,
    buildThemePresentation,
    preloadAudio,
    preloadImage,
    ThemesApp,
    ThemeSwitchController
  };
});
