const test = require("node:test");
const assert = require("node:assert/strict");

const {
  THEME_GROUPS,
  THEMES,
  buildThemePresentation,
  preloadAudio,
  preloadImage,
  ThemesApp,
  ThemeSwitchController
} = require("../themes.js");

const theme = (id) => THEMES.find((entry) => entry.id === id);

class FakeElement {
  constructor(ownerDocument, tagName = "div") {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.listeners = new Map();
    this.attributes = new Map();
    this.className = "";
    this.textContent = "";
    this.tabIndex = 0;
  }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  dispatch(type, details = {}) {
    const event = {
      target: this,
      key: details.key,
      preventDefault: () => { event.defaultPrevented = true; },
      defaultPrevented: false
    };
    (this.listeners.get(type) ?? []).forEach((listener) => listener(event));
    return event;
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  focus() { this.ownerDocument.activeElement = this; }
}

class FakeDocument {
  activeElement = null;
  createElement(tagName) { return new FakeElement(this, tagName); }
}

const createThemesFixture = () => {
  const ownerDocument = new FakeDocument();
  const grid = new FakeElement(ownerDocument);
  const root = {
    ownerDocument,
    querySelector: (selector) => selector === "[data-themes-grid]" ? grid : null
  };
  return { root, grid, ownerDocument };
};

test("catalog exposes exactly the approved themes in their two groups", () => {
  assert.deepEqual(THEME_GROUPS.map(({ label }) => label), [
    "Aero Themes (4)",
    "Basic and High Contrast Themes (4)"
  ]);
  assert.deepEqual(THEMES.map(({ id }) => id), [
    "windows-7",
    "architecture",
    "landscape",
    "nature",
    "windows-7-basic",
    "windows-classic",
    "high-contrast-black",
    "high-contrast-white"
  ]);
  assert.deepEqual(THEME_GROUPS.map(({ themeIds }) => themeIds), [
    ["windows-7", "architecture", "landscape", "nature"],
    ["windows-7-basic", "windows-classic", "high-contrast-black", "high-contrast-white"]
  ]);
});

test("catalog maps exact Aero accents, wallpapers, and sounds", () => {
  assert.equal(theme("architecture").accent, "#7EA1D5");
  assert.equal(theme("architecture").wallpaper, "./assets/architecture.jpg");
  assert.equal(theme("architecture").sound, "./assets/architecture.mp3");
  assert.equal(theme("landscape").accent, "#B2B6BB");
  assert.equal(theme("landscape").wallpaper, "./assets/landscape.jpg");
  assert.equal(theme("landscape").sound, "./assets/landscape.mp3");
  assert.equal(theme("nature").accent, "#B29ACC");
  assert.equal(theme("nature").wallpaper, "./assets/nature.jpg");
  assert.equal(theme("nature").sound, "./assets/nature.mp3");
});

test("Windows, Basic, Classic, and High Contrast themes share the logon sound", () => {
  const ids = [
    "windows-7",
    "windows-7-basic",
    "windows-classic",
    "high-contrast-black",
    "high-contrast-white"
  ];
  assert.deepEqual(
    ids.map((id) => theme(id).sound),
    Array(ids.length).fill("./assets/Windows Logon Sound.wav")
  );
});

test("image preloading waits for load and decode before resolving", async () => {
  const events = [];
  class FakeImage {
    listeners = {};
    addEventListener(type, listener) { this.listeners[type] = listener; }
    set src(value) {
      events.push(`src:${value}`);
      queueMicrotask(() => this.listeners.load());
    }
    async decode() { events.push("decode"); }
  }

  const image = await preloadImage("./wallpaper.jpg", FakeImage);

  assert.ok(image instanceof FakeImage);
  assert.deepEqual(events, ["src:./wallpaper.jpg", "decode"]);
});

test("audio preloading resolves only after playable data is available", async () => {
  const events = [];
  class FakeAudio {
    listeners = {};
    preload = "";
    addEventListener(type, listener) { this.listeners[type] = listener; }
    set src(value) { events.push(`src:${value}`); }
    load() {
      events.push(`load:${this.preload}`);
      queueMicrotask(() => this.listeners.canplaythrough());
    }
  }

  const audio = await preloadAudio("./sound.mp3", FakeAudio);

  assert.ok(audio instanceof FakeAudio);
  assert.deepEqual(events, ["src:./sound.mp3", "load:auto"]);
});

test("Themes app renders two groups and exactly eight accessible theme cards", () => {
  const { root, grid } = createThemesFixture();
  new ThemesApp(root, {
    getActiveThemeId: () => "nature",
    onSelect: () => {}
  });

  assert.equal(grid.children.length, 2);
  assert.equal(grid.getAttribute("role"), "radiogroup");
  assert.equal(grid.getAttribute("aria-label"), "Desktop themes");
  assert.deepEqual(grid.children.map((group) => group.children[0].textContent), [
    "Aero Themes (4)",
    "Basic and High Contrast Themes (4)"
  ]);
  const cards = grid.children.flatMap((group) => group.children[1].children);
  assert.equal(grid.children.every((group) => group.children[1].getAttribute("role") === null), true);
  assert.equal(cards.length, 8);
  assert.deepEqual(cards.map(({ dataset }) => dataset.themeId), THEMES.map(({ id }) => id));
  assert.equal(cards.find(({ dataset }) => dataset.themeId === "nature").getAttribute("aria-checked"), "true");
  assert.equal(cards.filter(({ tabIndex }) => tabIndex === 0).length, 1);
});

test("Themes app activates cards with click and keyboard navigation", () => {
  const selected = [];
  const { root, grid, ownerDocument } = createThemesFixture();
  new ThemesApp(root, {
    getActiveThemeId: () => "windows-7",
    onSelect: ({ id }) => selected.push(id)
  });
  const cards = grid.children.flatMap((group) => group.children[1].children);

  cards[1].dispatch("click");
  assert.deepEqual(selected, ["architecture"]);

  cards[1].dispatch("keydown", { key: "ArrowRight" });
  assert.equal(ownerDocument.activeElement, cards[2]);
  assert.equal(cards.find(({ dataset }) => dataset.themeId === "architecture").tabIndex, 0);
  assert.equal(cards[2].tabIndex, -1);
  cards[2].dispatch("keydown", { key: "Enter" });
  assert.deepEqual(selected, ["architecture", "landscape"]);
});

test("theme presentation maps wallpaper, solid backgrounds, and exact shell colors", () => {
  assert.deepEqual(buildThemePresentation(theme("architecture")), {
    themeId: "architecture",
    wallpaper: "./assets/architecture.jpg",
    desktopColor: "#7EA1D5",
    variables: {
      "--theme-accent": "#7EA1D5",
      "--theme-accent-rgb": "126, 161, 213",
      "--theme-shell-dark": "rgba(126, 161, 213, .96)",
      "--theme-shell-mid": "rgba(126, 161, 213, .9)",
      "--theme-shell-light": "rgba(126, 161, 213, .78)",
      "--theme-window-top": "rgba(126, 161, 213, .88)",
      "--theme-window-middle": "rgba(126, 161, 213, .76)",
      "--theme-window-bottom": "rgba(126, 161, 213, .92)",
      "--theme-document": "#FFFFFF",
      "--theme-foreground": "#111111",
      "--theme-link": "#0645A5"
    }
  });
  assert.equal(buildThemePresentation(theme("windows-classic")).wallpaper, null);
  assert.equal(buildThemePresentation(theme("windows-classic")).desktopColor, "#3B6EA4");
  assert.equal(buildThemePresentation(theme("high-contrast-black")).variables["--theme-link"], "#FFFF00");
  assert.equal(buildThemePresentation(theme("high-contrast-white")).variables["--theme-foreground"], "#000000");
});

test("each Aero theme produces distinct window and shell surface colors", () => {
  const presentations = ["windows-7", "architecture", "landscape", "nature"]
    .map((id) => buildThemePresentation(theme(id)).variables);

  for (const variable of [
    "--theme-shell-dark",
    "--theme-shell-mid",
    "--theme-shell-light",
    "--theme-window-top",
    "--theme-window-middle",
    "--theme-window-bottom"
  ]) {
    assert.equal(new Set(presentations.map((entry) => entry[variable])).size, 4, `${variable} must vary by theme`);
  }
});

test("only the latest switch request may apply and play", async () => {
  const pending = new Map();
  const applied = [];
  const played = [];
  const controller = new ThemeSwitchController({
    preloadTheme: ({ id }) => new Promise((resolve) => pending.set(id, resolve)),
    applyTheme: ({ id }) => applied.push(id),
    playSound: ({ id }) => played.push(id),
    onBusyChange: () => {},
    onError: () => {},
    minimumWaitMs: 0
  });

  const architecture = controller.switchTo(theme("architecture"));
  const nature = controller.switchTo(theme("nature"));
  pending.get("architecture")({ audio: {} });
  pending.get("nature")({ audio: {} });
  await Promise.all([architecture, nature]);

  assert.deepEqual(applied, ["nature"]);
  assert.deepEqual(played, ["nature"]);
});

test("a request superseded during sound playback reports that it did not win", async () => {
  let finishArchitectureSound;
  const controller = new ThemeSwitchController({
    preloadTheme: async () => ({ audio: {} }),
    applyTheme: () => {},
    playSound: ({ id }) => id === "architecture"
      ? new Promise((resolve) => { finishArchitectureSound = resolve; })
      : Promise.resolve(),
    onBusyChange: () => {},
    onError: () => {},
    minimumWaitMs: 0
  });

  const architecture = controller.switchTo(theme("architecture"));
  await new Promise((resolve) => setImmediate(resolve));
  const nature = controller.switchTo(theme("nature"));
  assert.equal(await nature, true);
  finishArchitectureSound();
  assert.equal(await architecture, false);
});

test("sound starts only after the completed wait state has closed", async () => {
  let finishClosing;
  const order = [];
  const controller = new ThemeSwitchController({
    preloadTheme: async () => ({}),
    applyTheme: () => order.push("apply"),
    playSound: () => order.push("sound"),
    onBusyChange: (busy) => {
      order.push(busy ? "wait-open" : "wait-close");
      if (!busy) return new Promise((resolve) => { finishClosing = resolve; });
    },
    onError: () => {},
    minimumWaitMs: 0
  });

  const switching = controller.switchTo(theme("nature"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(order, ["wait-open", "apply", "wait-close"]);
  finishClosing();
  assert.equal(await switching, true);
  assert.deepEqual(order, ["wait-open", "apply", "wait-close", "sound"]);
});

test("a preload failure preserves the active theme and reports the error", async () => {
  let activeTheme = "windows-7";
  const errors = [];
  const busyStates = [];
  const controller = new ThemeSwitchController({
    preloadTheme: async () => { throw new Error("network"); },
    applyTheme: ({ id }) => { activeTheme = id; },
    playSound: () => { throw new Error("sound must not play"); },
    onBusyChange: (busy) => busyStates.push(busy),
    onError: (error) => errors.push(error.message),
    minimumWaitMs: 0
  });

  const applied = await controller.switchTo(theme("architecture"));

  assert.equal(applied, false);
  assert.equal(activeTheme, "windows-7");
  assert.deepEqual(errors, ["network"]);
  assert.deepEqual(busyStates, [true, false]);
});

test("an instant preload still keeps the wait state open for two seconds", async () => {
  let releaseMinimumWait;
  let requestedDelay;
  const order = [];
  const controller = new ThemeSwitchController({
    preloadTheme: async () => {
      order.push("preloaded");
      return {};
    },
    applyTheme: () => order.push("apply"),
    playSound: () => order.push("sound"),
    onBusyChange: (busy) => order.push(busy ? "wait-open" : "wait-close"),
    onError: () => {},
    minimumWaitMs: 2000,
    wait: (delay) => {
      requestedDelay = delay;
      return new Promise((resolve) => { releaseMinimumWait = resolve; });
    }
  });

  const switching = controller.switchTo(theme("windows-classic"));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(requestedDelay, 2000);
  assert.deepEqual(order, ["wait-open", "preloaded"]);

  releaseMinimumWait();
  assert.equal(await switching, true);
  assert.deepEqual(order, ["wait-open", "preloaded", "apply", "wait-close", "sound"]);
});
