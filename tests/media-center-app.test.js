const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const dataName = (attribute) => attribute
  .slice(5)
  .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());

class FakeEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.key = options.key;
    this.detail = options.detail;
    this.bubbles = Boolean(options.bubbles);
    this.cancelable = Boolean(options.cancelable);
    this.defaultPrevented = false;
    this.cancelBubble = false;
    this.target = options.target ?? null;
    this.currentTarget = null;
  }

  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }
}

class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  values() {
    return this.element.className.split(/\s+/).filter(Boolean);
  }

  contains(name) {
    return this.values().includes(name);
  }

  add(...names) {
    this.element.className = [...new Set([...this.values(), ...names.filter(Boolean)])].join(" ");
  }

  remove(...names) {
    this.element.className = this.values().filter((name) => !names.includes(name)).join(" ");
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.contains(name) : Boolean(force);
    if (shouldAdd) this.add(name);
    else this.remove(name);
    return shouldAdd;
  }
}

class FakeElement {
  constructor(ownerDocument, tagName = "div") {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = "";
    this.classList = new FakeClassList(this);
    this.dataset = {};
    this.style = { setProperty() {}, removeProperty() {} };
    this.hidden = false;
    this.disabled = false;
    this.tabIndex = -1;
    this._textContent = "";
  }

  set textContent(value) {
    this._textContent = String(value ?? "");
    this.children = [];
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join("");
  }

  set id(value) {
    this.setAttribute("id", value);
  }

  get id() {
    return this.getAttribute("id") ?? "";
  }

  setAttribute(name, value) {
    const normalized = String(value);
    this.attributes.set(name, normalized);
    if (name === "class") this.className = normalized;
    if (name === "tabindex") this.tabIndex = Number(normalized);
    if (name.startsWith("data-")) this.dataset[dataName(name)] = normalized;
  }

  getAttribute(name) {
    if (name === "class") return this.className || null;
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith("data-")) delete this.dataset[dataName(name)];
  }

  append(...nodes) {
    nodes.flat().forEach((node) => {
      if (node === undefined || node === null) return;
      if (typeof node === "string") {
        this._textContent += node;
        return;
      }
      node.parentElement = this;
      this.children.push(node);
    });
  }

  replaceChildren(...nodes) {
    this.children.forEach((child) => { child.parentElement = null; });
    this.children = [];
    this._textContent = "";
    this.append(...nodes);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    (this.listeners.get(event.type) ?? []).forEach((listener) => listener.call(this, event));
    if (event.bubbles && this.parentElement && !event.cancelBubble) this.parentElement.dispatchEvent(event);
    return !event.defaultPrevented;
  }

  click() {
    if (!this.disabled) this.dispatchEvent(new FakeEvent("click", { bubbles: true, cancelable: true }));
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  closest(selector) {
    let element = this;
    while (element) {
      if (element.matches(selector)) return element;
      element = element.parentElement;
    }
    return null;
  }

  matches(selector) {
    const parts = selector.trim().split(/(?=[.#\[])/);
    return parts.every((part) => {
      if (!part) return true;
      if (part.startsWith(".")) return this.classList.contains(part.slice(1));
      if (part.startsWith("#")) return this.id === part.slice(1);
      if (part.startsWith("[")) {
        const match = part.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
        if (!match) return false;
        const actual = this.getAttribute(match[1]);
        return match[2] === undefined ? actual !== null : actual === match[2];
      }
      return this.tagName.toLowerCase() === part.toLowerCase();
    });
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (element) => {
      element.children.forEach((child) => {
        if (child.matches(selector)) matches.push(child);
        visit(child);
      });
    };
    visit(this);
    return matches;
  }
}

class FakeDocument {
  constructor() {
    this.activeElement = null;
    this.createdElements = [];
    this.defaultView = {
      CustomEvent: FakeEvent,
      Event: FakeEvent,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      requestAnimationFrame: (callback) => callback(),
      matchMedia: () => ({ matches: false })
    };
  }

  createElement(tagName) {
    const element = new FakeElement(this, tagName);
    this.createdElements.push(element);
    return element;
  }
}

class ManualTimers {
  constructor() {
    this.nextId = 1;
    this.tasks = new Map();
  }

  setTimeout(callback, delay) {
    const id = this.nextId++;
    this.tasks.set(id, { callback, delay, kind: "timeout" });
    return id;
  }

  clearTimeout(id) {
    this.tasks.delete(id);
  }

  setInterval(callback, delay) {
    const id = this.nextId++;
    this.tasks.set(id, { callback, delay, kind: "interval" });
    return id;
  }

  clearInterval(id) {
    this.tasks.delete(id);
  }

  runDelay(delay) {
    [...this.tasks.entries()]
      .filter(([, task]) => task.delay === delay)
      .forEach(([id, task]) => {
        if (task.kind === "timeout") this.tasks.delete(id);
        task.callback();
      });
  }
}

class FakeAudio {
  constructor(source) {
    this.src = source;
    this.currentTime = 0;
    this.volume = 1;
    this.preload = "";
    this.playCalls = 0;
    this.pauseCalls = 0;
  }

  play() {
    this.playCalls += 1;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
  }
}

const { CATEGORIES, PROJECTS } = require("../media-center-data.js");
const { MediaCenterApp, mountMediaCenter, unmountMediaCenter } = require("../media-center.js");

const createFixture = (options = {}) => {
  const document = new FakeDocument();
  const shell = new FakeElement(document, "div");
  shell.id = "windows-7-root";
  const mount = new FakeElement(document, "section");
  shell.append(mount);
  const app = new MediaCenterApp({ mount, ...options });
  return { app, document, shell, mount };
};

test("portfolio model contains only the three supplied asset sections with no filler metadata", () => {
  assert.deepEqual(CATEGORIES, [
    "Thumbnails",
    "Posters",
    "PFPs"
  ]);

  PROJECTS.forEach((project) => {
    assert.deepEqual(Object.keys(project), ["id", "title", "category", "image"]);
    assert.ok(CATEGORIES.includes(project.category));
  });

  const expectedFiles = [
    "pfp_1.png", "pfp_2.png", "pfp_3.png", "pfp_4.png", "pfp_5.png", "pfp_6.png",
    "poster_1.png", "poster_2.png", "thumbnail_1.jpg", "thumbnail_2.jpg", "thumbnail_3.jpg"
  ];
  assert.equal(PROJECTS.length, expectedFiles.length);
  assert.deepEqual(PROJECTS.map(({ image }) => path.basename(image)).sort(), expectedFiles.sort());
  assert.deepEqual(PROJECTS.filter(({ category }) => category === "Thumbnails").map(({ title }) => title), [
    "THUMBNAIL 1", "THUMBNAIL 2", "THUMBNAIL 3"
  ]);
  assert.deepEqual(PROJECTS.filter(({ category }) => category === "Posters").map(({ title }) => title), [
    "POSTER 1", "POSTER 2"
  ]);
  assert.deepEqual(PROJECTS.filter(({ category }) => category === "PFPs").map(({ title }) => title), [
    "PFP 1", "PFP 2", "PFP 3", "PFP 4", "PFP 5", "PFP 6"
  ]);
});

test("MediaCenterApp constructs a resizable maximized-first native shell window", () => {
  const { app, mount } = createFixture();
  const windowElement = mount.querySelector('[data-app-window="media-center"]');

  assert.equal(app.element, windowElement);
  assert.equal(windowElement.hidden, true);
  assert.equal(windowElement.dataset.windowWidth, "1100");
  assert.equal(windowElement.dataset.windowHeight, "680");
  assert.equal(windowElement.dataset.windowMinWidth, "760");
  assert.equal(windowElement.dataset.windowMinHeight, "500");
  assert.equal(windowElement.getAttribute("data-start-maximized"), "");
  assert.equal(windowElement.hasAttribute("data-fixed-size"), false);
  assert.equal(windowElement.querySelector("h1").textContent, "My Work");
  assert.equal(windowElement.querySelector('.media-center__brand-logo').getAttribute("src"), "./assets/media center/main_logo.png");
  assert.equal(windowElement.querySelectorAll('[data-media-category]').length, 3);
});

test("shell remounting creates one live Media Center controller for each new desktop", () => {
  const firstDocument = new FakeDocument();
  const firstDesktop = new FakeElement(firstDocument, "section");
  const firstApp = mountMediaCenter(firstDesktop, {
    audioFactory: (source) => new FakeAudio(source)
  });

  assert.equal(mountMediaCenter(firstDesktop), firstApp, "mounting the same desktop is idempotent");
  unmountMediaCenter(firstDesktop);

  const restartedDocument = new FakeDocument();
  const restartedDesktop = new FakeElement(restartedDocument, "section");
  const restartedApp = mountMediaCenter(restartedDesktop, {
    audioFactory: (source) => new FakeAudio(source)
  });
  restartedApp.element.querySelector('[data-media-category="1"]').click();

  assert.notEqual(restartedApp, firstApp);
  assert.equal(restartedApp.state.categoryIndex, 1);
});

test("compact layout follows the Media Center window size instead of the browser viewport", () => {
  const document = new FakeDocument();
  let resizeCallback = null;
  document.defaultView.ResizeObserver = class FakeResizeObserver {
    constructor(callback) {
      resizeCallback = callback;
    }

    observe() {}
  };
  const mount = new FakeElement(document, "section");
  const app = new MediaCenterApp({ mount });

  resizeCallback([{ contentRect: { width: 1100, height: 680 } }]);
  assert.equal(app.element.classList.contains("is-compact"), false);

  resizeCallback([{ contentRect: { width: 760, height: 500 } }]);
  assert.equal(app.element.classList.contains("is-compact"), true);
});

test("construction preloads every portfolio image and one reusable channel per supplied sound", () => {
  const audio = [];
  const { document } = createFixture({
    audioFactory: (source) => {
      const element = new FakeAudio(source);
      audio.push(element);
      return element;
    }
  });
  const createdSources = new Set(document.createdElements
    .filter(({ tagName }) => tagName === "IMG")
    .map((image) => image.getAttribute("src")));
  const expectedSources = new Set(PROJECTS.map(({ image }) => image));

  expectedSources.forEach((source) => assert.ok(createdSources.has(source), `${source} is preloaded`));
  assert.deepEqual(audio.map(({ src }) => path.basename(src)).sort(), [
    "intro.mp3", "sidebutton-click.mp3", "ui-confirm.mp3", "ui-interact.mp3"
  ]);
  audio.forEach((element) => assert.equal(element.preload, "auto"));
});

test("fresh launch follows the 4.8 second Media Center cue sequence and fades the supplied intro audio", () => {
  const timers = new ManualTimers();
  const audio = [];
  const { app } = createFixture({
    timers,
    audioFactory: (source) => {
      const element = new FakeAudio(source);
      audio.push(element);
      return element;
    }
  });

  app.launch({ fresh: true });

  const intro = audio.find(({ src }) => src.endsWith("intro.mp3"));
  assert.equal(intro.playCalls, 1);
  assert.equal(app.state.introPlaying, true);
  assert.equal(app.element.classList.contains("is-intro-playing"), true);
  assert.deepEqual(
    [...timers.tasks.values()].filter(({ kind, delay }) => kind === "timeout" && delay <= 4800).map(({ delay }) => delay).sort((a, b) => a - b),
    [450, 850, 2250, 3550, 4580, 4635, 4690, 4745, 4800]
  );

  timers.runDelay(850);
  assert.equal(app.element.dataset.introCue, "brand");
  timers.runDelay(3550);
  assert.equal(app.element.dataset.introCue, "ready");
  timers.runDelay(4580);
  assert.equal(app.element.classList.contains("is-intro-fading"), true);
  timers.runDelay(4800);
  assert.equal(app.state.introPlaying, false);
  assert.equal(app.element.classList.contains("is-intro-playing"), false);
  assert.equal(intro.pauseCalls, 1);
  assert.equal(intro.currentTime, 0);
});

test("restoring an existing Media Center window does not replay or reset the launch sequence", () => {
  const timers = new ManualTimers();
  const audio = [];
  const { app, document } = createFixture({
    timers,
    audioFactory: (source) => {
      const element = new FakeAudio(source);
      audio.push(element);
      return element;
    }
  });

  app.launch({ fresh: true });
  timers.runDelay(4800);
  app.navigateCategory(1);
  app.launch({ fresh: false });

  const intro = audio.find(({ src }) => src.endsWith("intro.mp3"));
  assert.equal(intro.playCalls, 1);
  assert.equal(app.state.introPlaying, false);
  assert.equal(app.state.categoryIndex, 1);
  assert.equal(document.activeElement.getAttribute("data-media-category"), "1");
});

test("closing and freshly relaunching resets both state and rendered content before the handoff", () => {
  const timers = new ManualTimers();
  const { app } = createFixture({ timers, audioFactory: (source) => new FakeAudio(source) });

  app.navigateCategory(1);
  app.openSelectedProject();
  app.close();
  app.launch({ fresh: true });

  assert.equal(app.state.view, "library");
  assert.equal(app.state.categoryIndex, 0);
  assert.equal(app.element.querySelector('[data-media-view="library"]') !== null, true);
  assert.equal(app.element.querySelector('[data-media-category-title]').textContent, "THUMBNAILS");
});

test("category and project navigation wrap through the data-driven library", () => {
  const { app } = createFixture();

  app.navigateCategory(-1);
  assert.equal(app.state.categoryIndex, 2);
  assert.equal(app.state.projectIndex, 0);
  assert.equal(app.element.querySelector('[aria-current="true"]').textContent, "PFPs");
  assert.equal(app.element.querySelector('[data-media-category-title]').textContent, "PFPS");

  app.navigateCategory(1);
  app.navigateProject(-1);
  assert.equal(app.state.categoryIndex, 0);
  assert.equal(app.state.projectIndex, 2);
  assert.equal(app.element.querySelector('[data-media-project].is-selected').getAttribute("data-media-project"), "2");
  assert.equal(app.element.querySelector('[data-media-selected-title]').textContent, "THUMBNAIL 3");
  assert.equal(app.element.querySelectorAll('[data-media-project]').length, 3);
});

test("larger sections use a three-preview carousel without hiding their remaining items", () => {
  const { app } = createFixture();

  app.navigateCategory(-1);
  assert.deepEqual(
    app.element.querySelectorAll('[data-media-project]').map((tile) => tile.getAttribute("data-media-project")),
    ["0", "1", "2"]
  );
  assert.equal(app.element.querySelector('[data-media-selected-title]').textContent, "PFP 1");
  assert.equal(app.element.querySelector('.media-center-library__pagination').textContent.includes("1 / 6"), true);

  app.navigateProject(1);
  assert.deepEqual(
    app.element.querySelectorAll('[data-media-project]').map((tile) => tile.getAttribute("data-media-project")),
    ["1", "2", "3"]
  );
  assert.equal(app.element.querySelector('[data-media-project="1"]').classList.contains("is-selected"), true);
  assert.equal(app.element.querySelector('[data-media-selected-title]').textContent, "PFP 2");
});

test("project detail and Back preserve the selected item without rendering filler metadata", () => {
  const { app } = createFixture();

  app.navigateProject(1);
  app.openSelectedProject();

  assert.equal(app.state.view, "detail");
  assert.equal(app.element.querySelector('[data-media-detail-title]').textContent, "THUMBNAIL 2");
  assert.equal(app.element.querySelector('[data-media-detail-year]'), null);
  assert.equal(app.element.querySelector('.media-center-detail__description'), null);
  assert.equal(app.element.querySelector('.media-center-detail__type'), null);
  assert.equal(app.element.querySelector('[data-media-detail-category]').textContent, "Thumbnails");

  app.back();
  assert.equal(app.state.view, "library");
  assert.equal(app.state.projectIndex, 1);
  assert.equal(app.element.querySelector('[data-media-selected-title]').textContent, "THUMBNAIL 2");
});

test("keyboard commands navigate, confirm, and return without leaving stale state", () => {
  const { app } = createFixture();

  app.element.dispatchEvent(new FakeEvent("keydown", { key: "ArrowDown", cancelable: true }));
  assert.equal(app.state.categoryIndex, 1);
  app.element.dispatchEvent(new FakeEvent("keydown", { key: "Enter", cancelable: true }));
  assert.equal(app.state.view, "detail");
  app.element.dispatchEvent(new FakeEvent("keydown", { key: "ArrowRight", cancelable: true }));
  assert.equal(app.state.projectIndex, 1);
  app.element.dispatchEvent(new FakeEvent("keydown", { key: "Escape", cancelable: true }));
  assert.equal(app.state.view, "library");

  for (let index = 0; index < 17; index += 1) app.navigateCategory(1);
  assert.equal(app.state.categoryIndex, 0);
  assert.equal(app.element.querySelectorAll('[aria-current="true"]').length, 1);
});

test("native button activation is not intercepted by the window-level Enter or Space shortcut", () => {
  const { app } = createFixture();
  const play = app.element.querySelector('[data-media-control="play"]');
  play.focus();

  play.dispatchEvent(new FakeEvent("keydown", {
    key: " ",
    bubbles: true,
    cancelable: true
  }));

  assert.equal(app.state.view, "library");
  assert.equal(app.state.playing, false);
  play.click();
  assert.equal(app.state.playing, true);
  app.activateControl("stop");
});

test("keyboard project navigation restores focus to the newly rendered selected tile", () => {
  const { app, document } = createFixture();
  const firstProject = app.element.querySelector('[data-media-project="0"]');
  firstProject.focus();

  firstProject.dispatchEvent(new FakeEvent("keydown", {
    key: "ArrowRight",
    bubbles: true,
    cancelable: true
  }));

  assert.equal(app.state.projectIndex, 1);
  assert.equal(document.activeElement.getAttribute("data-media-project"), "1");
});

test("failed artwork keeps project information and exposes a calm fallback", () => {
  const { app } = createFixture();
  const image = app.element.querySelector('[data-media-project-image]');
  const tile = image.closest('[data-media-project]');

  image.dispatchEvent(new FakeEvent("error"));

  assert.equal(image.hidden, true);
  assert.equal(tile.classList.contains("has-missing-image"), true);
  assert.equal(tile.querySelector('.media-center-project__fallback').textContent, "Preview unavailable");
});

test("transport controls operate the selected gallery item and bounded autoplay", () => {
  const timers = new ManualTimers();
  const { app } = createFixture({ timers, audioFactory: (source) => new FakeAudio(source) });

  app.activateControl("previous");
  assert.equal(app.state.projectIndex, 2);
  app.activateControl("rewind");
  assert.equal(app.state.projectIndex, 0);
  app.activateControl("next");
  assert.equal(app.state.projectIndex, 1);
  app.activateControl("fast-forward");
  assert.equal(app.state.projectIndex, 0);

  app.activateControl("play");
  assert.equal(app.state.playing, true);
  assert.equal([...timers.tasks.values()].some(({ kind, delay }) => kind === "interval" && delay === 4500), true);
  timers.runDelay(4500);
  assert.equal(app.state.projectIndex, 1);
  app.activateControl("stop");
  assert.equal(app.state.playing, false);
  assert.equal(app.state.projectIndex, 0);
  assert.equal(app.element.querySelector('[data-media-control="play"]').getAttribute("aria-pressed"), "false");
});

test("volume controls clamp sound and all interaction types use their assigned reusable channel", () => {
  const timers = new ManualTimers();
  const audio = [];
  const { app } = createFixture({
    timers,
    audioFactory: (source) => {
      const element = new FakeAudio(source);
      audio.push(element);
      return element;
    }
  });

  for (let index = 0; index < 20; index += 1) app.activateControl("volume-down");
  assert.equal(app.state.volume, 0);
  for (let index = 0; index < 20; index += 1) app.activateControl("volume-up");
  assert.equal(app.state.volume, 1);
  app.activateControl("mute");
  assert.equal(app.state.muted, true);

  app.navigateProject(1);
  app.navigateProject(1);
  app.openSelectedProject();

  const side = audio.find(({ src }) => src.endsWith("sidebutton-click.mp3"));
  const interact = audio.find(({ src }) => src.endsWith("ui-interact.mp3"));
  const confirm = audio.find(({ src }) => src.endsWith("ui-confirm.mp3"));
  assert.ok(side.playCalls >= 1);
  assert.equal(interact.playCalls, 1, "rapid navigation reuses and throttles the interaction channel");
  assert.equal(confirm.playCalls, 1);
  assert.equal(audio.filter(({ src }) => src.endsWith("sidebutton-click.mp3")).length, 1);
  assert.equal(audio.filter(({ src }) => src.endsWith("ui-interact.mp3")).length, 1);
});

test("header clock uses a compact era-appropriate system time and media controls are complete", () => {
  const now = () => new Date("2026-08-19T18:07:00");
  const { app } = createFixture({ now });

  assert.equal(app.element.querySelector('[data-media-clock]').textContent, "6:07 PM");
  assert.deepEqual(
    app.element.querySelectorAll('[data-media-control]').map((button) => button.dataset.mediaControl),
    ["stop", "previous", "rewind", "play", "next", "fast-forward", "mute", "volume-down", "volume-up"]
  );
});

test("mouse activation routes categories, projects, transport, and the persistent Back control", () => {
  const { app } = createFixture({ audioFactory: (source) => new FakeAudio(source) });
  const back = app.element.querySelector('.media-center__back-orb');
  assert.equal(back.disabled, true);

  app.element.querySelector('[data-media-control="next"]').click();
  assert.equal(app.state.projectIndex, 1);
  app.element.querySelector('[data-media-category="1"]').click();
  assert.equal(app.state.categoryIndex, 1);
  app.element.querySelector('[data-media-project="0"]').click();
  assert.equal(app.state.view, "detail");
  assert.equal(back.disabled, false);
  back.click();
  assert.equal(app.state.view, "library");
});

test("mouse hover previews library focus with a throttled cue and category click confirms it", () => {
  const timers = new ManualTimers();
  const audio = [];
  const { app, document } = createFixture({
    timers,
    audioFactory: (source) => {
      const element = new FakeAudio(source);
      audio.push(element);
      return element;
    }
  });

  app.element.querySelector('[data-media-project="1"]').dispatchEvent(
    new FakeEvent("pointerover", { bubbles: true })
  );
  assert.equal(app.state.projectIndex, 1);
  assert.equal(audio.find(({ src }) => src.endsWith("ui-interact.mp3")).playCalls, 1);

  timers.runDelay(90);
  app.element.querySelector('[data-media-category="1"]').dispatchEvent(
    new FakeEvent("pointerover", { bubbles: true })
  );
  assert.equal(app.state.categoryIndex, 1);
  assert.equal(document.activeElement.getAttribute("data-media-category"), "1");
  assert.equal(audio.find(({ src }) => src.endsWith("ui-interact.mp3")).playCalls, 2);

  app.element.querySelector('[data-media-category="1"]').click();
  assert.equal(audio.find(({ src }) => src.endsWith("ui-confirm.mp3")).playCalls, 1);
});

test("the intro blocks gallery pointer input until the live interface handoff", () => {
  const timers = new ManualTimers();
  const { app } = createFixture({ timers, audioFactory: (source) => new FakeAudio(source) });
  app.launch({ fresh: true });

  app.element.querySelector('[data-media-category="2"]').dispatchEvent(
    new FakeEvent("pointerover", { bubbles: true })
  );
  assert.equal(app.state.categoryIndex, 0);

  timers.runDelay(4800);
  app.element.querySelector('[data-media-category="2"]').dispatchEvent(
    new FakeEvent("pointerover", { bubbles: true })
  );
  assert.equal(app.state.categoryIndex, 2);
});

test("shell lifecycle events replay only fresh launches and cancel sound and timers on close", () => {
  const timers = new ManualTimers();
  const audio = [];
  const { app } = createFixture({
    timers,
    audioFactory: (source) => {
      const element = new FakeAudio(source);
      audio.push(element);
      return element;
    }
  });

  app.element.dispatchEvent(new FakeEvent("windows7:appopen", { detail: { appName: "media-center", fresh: true } }));
  app.element.dispatchEvent(new FakeEvent("windows7:appopen", { detail: { appName: "media-center", fresh: false } }));
  assert.equal(audio.find(({ src }) => src.endsWith("intro.mp3")).playCalls, 1);
  assert.equal(app.state.introPlaying, true);

  app.element.dispatchEvent(new FakeEvent("windows7:appclose", { detail: { appName: "media-center" } }));
  assert.equal(app.state.introPlaying, false);
  assert.equal([...timers.tasks.values()].some(({ delay }) => delay === 4800), false);
});

test("production registers Media Center assets, shell entry points, lifecycle, and maximized-first behavior", () => {
  const projectRoot = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const source = fs.readFileSync(path.join(projectRoot, "index.js"), "utf8");
  const { ASSETS, NON_THEME_BOOT_ASSETS } = require("../boot-assets.js");

  assert.equal(ASSETS.mediaCenter, "./assets/media center/main_logo.png");
  assert.ok(NON_THEME_BOOT_ASSETS.includes(ASSETS.mediaCenter));
  assert.ok(html.indexOf("./media-center.css?v=20260820-1") < html.indexOf("./media-center-data.js?v=20260820-1"));
  assert.ok(html.indexOf("./media-center-data.js?v=20260820-1") < html.indexOf("./media-center.js?v=20260820-3"));
  assert.ok(html.indexOf("./media-center.js?v=20260820-3") < html.indexOf("./index.js?v=20260819-1"));
  assert.match(html, /data-start-icon="media-center"[\s\S]*?<span>Media Center<\/span>/);
  assert.match(source, /media-center["']\s*,\s*["']Media Center/);
  assert.match(source, /["']media-center["']:\s*ASSETS\.mediaCenter/);
  assert.match(source, /["']media-center["']:\s*\{\s*icon:\s*ASSETS\.mediaCenter/);
  assert.match(source, /windows7:appopen/);
  assert.match(source, /windows7:appclose/);
  assert.match(source, /data-start-maximized/);
  assert.match(
    source,
    /#configureRoot\(\);\s*this\.#mountMediaCenter\(\);\s*this\.#configureDesktop\(\);/,
    "the dynamic Media Center window must exist before initial shell sizing"
  );
  assert.match(
    source,
    /#mountCleanDesktop\(\)[\s\S]*?this\.#mountMediaCenter\(\);\s*this\.#configureDesktop\(\);/,
    "restart remounting must create Media Center before shell sizing and resize handles"
  );
});

test("Media Center selection chrome overrides generic 7.css hover paint and previews preserve full artwork", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "media-center.css"), "utf8");
  const categoryPseudoRule = css.match(
    /#windows-7-root \.media-center__category::before,\s*#windows-7-root \.media-center__category::after\s*\{([^}]*)\}/
  );
  const previewRule = css.match(/\.media-center-project__frame img\s*\{([^}]*)\}/);
  const previewHoverRule = css.match(
    /#windows-7-root \.media-center-project:hover img,[\s\S]*?#windows-7-root \.media-center-project\.is-selected img\s*\{([^}]*)\}/
  );

  assert.ok(categoryPseudoRule, "category buttons neutralize the generic button pseudo layers");
  assert.match(categoryPseudoRule[1], /content:\s*none/);
  assert.ok(previewRule, "gallery artwork has an explicit fit policy");
  assert.match(previewRule[1], /object-fit:\s*contain/);
  assert.match(previewRule[1], /position:\s*absolute/);
  assert.match(previewRule[1], /inset:\s*0/);
  assert.match(previewRule[1], /transform:\s*none/);
  assert.ok(previewHoverRule, "hover and selection retain the full preview");
  assert.doesNotMatch(previewHoverRule[1], /transform:\s*scale/);
});
