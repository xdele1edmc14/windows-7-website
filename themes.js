(function initializeThemes(globalScope, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.Windows7Themes = api;
})(typeof window === "object" ? window : (typeof globalThis === "object" ? globalThis : this), () => {
  "use strict";

  const LOGON_SOUND = "./asset/Windows Logon Sound.wav";
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

  class ThemeSwitchController {
    #request = 0;

    constructor({ preloadTheme, applyTheme, playSound, onBusyChange, onError }) {
      this.preloadTheme = preloadTheme;
      this.applyTheme = applyTheme;
      this.playSound = playSound;
      this.onBusyChange = onBusyChange;
      this.onError = onError;
    }

    async switchTo(theme) {
      const request = ++this.#request;
      this.onBusyChange(true, theme);

      try {
        const assets = await this.preloadTheme(theme);
        if (request !== this.#request) return false;
        await this.applyTheme(theme, assets);
        if (request !== this.#request) return false;
        this.onBusyChange(false, theme);
        try {
          await this.playSound(theme, assets);
        } catch (_) {
          // A browser media-policy rejection must not roll back an applied theme.
        }
        return true;
      } catch (error) {
        if (request !== this.#request) return false;
        this.onBusyChange(false, theme);
        this.onError(error, theme);
        return false;
      }
    }
  }

  return {
    LOGON_SOUND,
    THEME_GROUPS,
    THEMES,
    preloadAudio,
    preloadImage,
    ThemeSwitchController
  };
});
