const test = require("node:test");
const assert = require("node:assert/strict");

const {
  THEME_GROUPS,
  THEMES,
  preloadAudio,
  preloadImage,
  ThemeSwitchController
} = require("../themes.js");

const theme = (id) => THEMES.find((entry) => entry.id === id);

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
    Array(ids.length).fill("./asset/Windows Logon Sound.wav")
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

test("only the latest switch request may apply and play", async () => {
  const pending = new Map();
  const applied = [];
  const played = [];
  const controller = new ThemeSwitchController({
    preloadTheme: ({ id }) => new Promise((resolve) => pending.set(id, resolve)),
    applyTheme: ({ id }) => applied.push(id),
    playSound: ({ id }) => played.push(id),
    onBusyChange: () => {},
    onError: () => {}
  });

  const architecture = controller.switchTo(theme("architecture"));
  const nature = controller.switchTo(theme("nature"));
  pending.get("architecture")({ audio: {} });
  pending.get("nature")({ audio: {} });
  await Promise.all([architecture, nature]);

  assert.deepEqual(applied, ["nature"]);
  assert.deepEqual(played, ["nature"]);
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
    onError: (error) => errors.push(error.message)
  });

  const applied = await controller.switchTo(theme("architecture"));

  assert.equal(applied, false);
  assert.equal(activeTheme, "windows-7");
  assert.deepEqual(errors, ["network"]);
  assert.deepEqual(busyStates, [true, false]);
});
