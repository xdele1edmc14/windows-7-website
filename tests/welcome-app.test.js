const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { WelcomeApp, bindWelcomeHostBridge } = require("../welcome.js");

const dataName = (attribute) => attribute
  .slice(5)
  .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.values = new Set();
  }

  add(...tokens) {
    tokens.filter(Boolean).forEach((token) => this.values.add(token));
    this.element._className = [...this.values].join(" ");
  }

  remove(...tokens) {
    tokens.forEach((token) => this.values.delete(token));
    this.element._className = [...this.values].join(" ");
  }

  contains(token) {
    return this.values.has(token);
  }

  set(value) {
    this.values = new Set(String(value).split(/\s+/).filter(Boolean));
    this.element._className = [...this.values].join(" ");
  }
}

class FakeEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = Boolean(options.bubbles);
    this.cancelable = Boolean(options.cancelable);
    this.detail = options.detail;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
  }

  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }
}

class FakeElement {
  constructor(ownerDocument, tagName = "div") {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList(this);
    this._className = "";
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.textContent = "";
    this.type = "";
    this.id = "";
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this.classList.set(value);
  }

  get nextElementSibling() {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return this.parentElement.children[index + 1] ?? null;
  }

  append(...children) {
    children.forEach((child) => {
      child.parentElement = this;
      this.children.push(child);
    });
  }

  replaceChildren(...children) {
    this.children.forEach((child) => { child.parentElement = null; });
    this.children = [];
    this.append(...children);
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  setAttribute(name, value) {
    const normalized = String(value);
    this.attributes.set(name, normalized);
    if (name === "class") this.className = normalized;
    if (name === "id") this.id = normalized;
    if (name.startsWith("data-")) this.dataset[dataName(name)] = normalized;
  }

  getAttribute(name) {
    if (name === "class") return this.className;
    if (name === "id") return this.id;
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith("data-")) delete this.dataset[dataName(name)];
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    (this.listeners.get(event.type) ?? []).forEach((listener) => listener(event));
    if (event.bubbles && this.parentElement) this.parentElement.dispatchEvent(event);
    return !event.defaultPrevented;
  }

  click() {
    if (!this.disabled) this.dispatchEvent(new FakeEvent("click", { bubbles: true, cancelable: true }));
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  matches(selector) {
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    const attributeMatch = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if (attributeMatch) {
      const [, name, expected] = attributeMatch;
      const actual = this.getAttribute(name);
      return expected === undefined ? actual !== null : actual === expected;
    }
    return this.tagName.toLowerCase() === selector.toLowerCase();
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
    this.defaultView = {
      CustomEvent: FakeEvent,
      Event: FakeEvent,
      setTimeout,
      clearTimeout,
      requestAnimationFrame: (callback) => callback()
    };
  }

  createElement(tagName) {
    return new FakeElement(this, tagName);
  }
}

class MemoryStorage {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries));
  }

  getItem(key) {
    return this.entries.get(key) ?? null;
  }

  setItem(key, value) {
    this.entries.set(key, String(value));
  }
}

const createFixture = (storageEntries = {}, options = {}) => {
  const document = new FakeDocument();
  const shell = new FakeElement(document, "div");
  shell.id = "windows-7-root";
  const mount = new FakeElement(document, "section");
  shell.append(mount);
  const storage = new MemoryStorage(storageEntries);
  const app = new WelcomeApp({ mount, storage, ...options });
  return { app, document, shell, mount, storage };
};

test("WelcomeApp constructs the full-size two-column intro window with native controls", () => {
  const { app, mount } = createFixture();
  const windowElement = mount.querySelector('[data-app-window="welcome"]');

  assert.ok(windowElement);
  assert.equal(windowElement.dataset.windowWidth, "960");
  assert.equal(windowElement.dataset.windowHeight, "600");
  assert.equal(windowElement.dataset.windowMinWidth, "760");
  assert.equal(windowElement.dataset.windowMinHeight, "500");
  assert.equal(windowElement.getAttribute("data-fixed-size"), "");
  assert.equal(windowElement.getAttribute("data-window-centered"), "");
  assert.ok(windowElement.querySelector(".welcome-window__layout"));
  assert.ok(windowElement.querySelector(".welcome-window__sidebar"));
  assert.equal(
    windowElement.querySelector(".welcome-window__status").textContent,
    "SYS_STATUS: ONLINE | PORT: 8080 | ENV: TAHMID_OS"
  );
  assert.equal(windowElement.querySelector(".welcome-window__app-icon").getAttribute("src"), "./assets/icons/cmd.png");
  assert.equal(windowElement.querySelectorAll(".welcome-step").length, 3);
  assert.equal(windowElement.querySelectorAll(".welcome-bubble").length, 30);
  assert.equal(windowElement.querySelector('[data-welcome-step="1"]').getAttribute("aria-current"), "step");
  assert.equal(windowElement.querySelector('[data-welcome-step="2"]').getAttribute("aria-current"), null);
  assert.equal(windowElement.querySelector(".welcome-screen__header-icon").getAttribute("src"), "./assets/icons/cmd.png");
  assert.equal(windowElement.querySelector(".welcome-screen__header-icon").getAttribute("width"), "32");
  assert.ok(windowElement.querySelector(".welcome-screen__terminal-copy"));
  assert.equal(windowElement.querySelector(".welcome-screen__counter").textContent, "1 of 3");
  assert.equal(windowElement.querySelector("h1").textContent, "Windows 7. In a browser.");
  assert.equal(windowElement.querySelector("h1").classList.contains("welcome-screen__headline--kinetic"), true);
  assert.equal(windowElement.querySelector(".welcome-screen__intro-copy") !== null, true);
  assert.equal(windowElement.classList.contains("welcome-window--intro-reveal"), true);
  assert.equal(app.currentStep, 1);
  assert.equal(windowElement.querySelector('[data-welcome-action="back"]').disabled, true);
  const startupCheckbox = windowElement.querySelector('[data-welcome-startup]');
  assert.equal(startupCheckbox.nextElementSibling.tagName, "LABEL");
  assert.equal(startupCheckbox.nextElementSibling.getAttribute("for"), "welcome-show-on-startup");
});

test("step navigation updates the persistent sidebar indicator", () => {
  const { app, mount } = createFixture();

  app.goToStep(2);

  const intro = mount.querySelector('[data-welcome-step="1"]');
  const controls = mount.querySelector('[data-welcome-step="2"]');
  assert.equal(intro.getAttribute("aria-current"), null);
  assert.equal(intro.classList.contains("welcome-step--active"), false);
  assert.equal(controls.getAttribute("aria-current"), "step");
  assert.equal(controls.classList.contains("welcome-step--active"), true);
});

test("Next and Back keep currentStep within the three-screen sequence", () => {
  const { app, mount } = createFixture();

  mount.querySelector('[data-welcome-action="next"]').click();
  assert.equal(app.currentStep, 2);
  assert.equal(
    mount.querySelector('[data-welcome-screen="2"]').querySelector("h1").textContent,
    "Basic Interaction"
  );

  app.goToStep(99);
  assert.equal(app.currentStep, 3);
  assert.equal(mount.querySelector('[data-welcome-action="next"]').textContent, "Finish");
  assert.equal(mount.querySelector('[data-welcome-action="skip"]').hidden, true);

  mount.querySelector('[data-welcome-action="back"]').click();
  app.goToStep(-20);
  assert.equal(app.currentStep, 1);
  assert.equal(mount.querySelector('[data-welcome-action="back"]').disabled, true);
});

test("rapid step changes do not leave stale transition screens in the viewport", async () => {
  const { app, mount } = createFixture();

  app.goToStep(2);
  app.goToStep(3);
  await new Promise((resolve) => setTimeout(resolve, 260));

  assert.equal(mount.querySelectorAll("[data-welcome-screen]").length, 1);
  assert.ok(mount.querySelector('[data-welcome-screen="3"]'));
});

test("intro reveal state is removed on later steps and restored when returning", () => {
  const { app, mount } = createFixture();
  const windowElement = mount.querySelector('[data-app-window="welcome"]');

  app.goToStep(2);
  assert.equal(windowElement.classList.contains("welcome-window--intro-reveal"), false);

  app.goToStep(1);
  assert.equal(windowElement.classList.contains("welcome-window--intro-reveal"), true);
});

test("Show on startup writes the inverse hideWelcome preference", () => {
  const { mount, storage } = createFixture();
  const checkbox = mount.querySelector('[data-welcome-startup]');

  assert.equal(checkbox.checked, true);
  checkbox.checked = false;
  checkbox.dispatchEvent(new FakeEvent("change", { bubbles: true }));
  assert.equal(storage.getItem("hideWelcome"), "true");

  checkbox.checked = true;
  checkbox.dispatchEvent(new FakeEvent("change", { bubbles: true }));
  assert.equal(storage.getItem("hideWelcome"), "false");
});

test("desktop startup opens Welcome.exe unless hideWelcome is true", () => {
  const visible = createFixture();
  const suppressed = createFixture({ hideWelcome: "true" });
  const visibleRequests = [];
  const suppressedRequests = [];
  visible.shell.addEventListener("windows7:openapp", (event) => visibleRequests.push(event.detail.appName));
  suppressed.shell.addEventListener("windows7:openapp", (event) => suppressedRequests.push(event.detail.appName));

  visible.shell.dispatchEvent(new FakeEvent("windows7:statechange", { detail: { state: "desktop" } }));
  suppressed.shell.dispatchEvent(new FakeEvent("windows7:statechange", { detail: { state: "desktop" } }));

  assert.deepEqual(visibleRequests, ["welcome"]);
  assert.deepEqual(suppressedRequests, []);
});

test("Server Development opens DevHub before closing Welcome.exe", () => {
  const callbackApps = [];
  const { app, mount, shell } = createFixture({}, {
    onLaunchApp: (appName) => callbackApps.push(appName)
  });
  const launchEvents = [];
  const lifecycle = [];
  shell.addEventListener("welcome:launchapp", (event) => launchEvents.push(event.detail.appName));
  shell.addEventListener("windows7:openapp", (event) => lifecycle.push(`open:${event.detail.appName}`));
  shell.addEventListener("windows7:closeapp", (event) => lifecycle.push(`close:${event.detail.appName}`));

  app.goToStep(3);
  const serverDevelopment = mount.querySelector('[data-welcome-launch="devhub"]');
  assert.ok(serverDevelopment, "Server Development must target the registered DevHub app");
  serverDevelopment.click();

  assert.deepEqual(lifecycle, ["open:devhub", "close:welcome"]);
  assert.deepEqual(callbackApps, ["devhub"]);
  assert.deepEqual(launchEvents, ["devhub"]);
});

test("Graphics Design opens Media Center before closing Welcome.exe", () => {
  const callbackApps = [];
  const { app, mount, shell } = createFixture({}, {
    onLaunchApp: (appName) => callbackApps.push(appName)
  });
  const launchEvents = [];
  const lifecycle = [];
  shell.addEventListener("welcome:launchapp", (event) => launchEvents.push(event.detail.appName));
  shell.addEventListener("windows7:openapp", (event) => lifecycle.push(`open:${event.detail.appName}`));
  shell.addEventListener("windows7:closeapp", (event) => lifecycle.push(`close:${event.detail.appName}`));

  app.goToStep(3);
  const graphicsDesign = mount.querySelector('[data-welcome-launch="media-center"]');
  assert.ok(graphicsDesign, "Graphics Design must target the registered Media Center app");
  graphicsDesign.click();

  assert.deepEqual(lifecycle, ["open:media-center", "close:welcome"]);
  assert.deepEqual(callbackApps, ["media-center"]);
  assert.deepEqual(launchEvents, ["media-center"]);
});

test("Finish and Skip request a normal host-shell close", () => {
  const { app, mount, shell } = createFixture();
  const closeEvents = [];
  shell.addEventListener("windows7:closeapp", (event) => closeEvents.push(event.detail.appName));

  mount.querySelector('[data-welcome-action="skip"]').click();
  app.open();
  app.goToStep(3);
  mount.querySelector('[data-welcome-action="next"]').click();

  assert.deepEqual(closeEvents, ["welcome", "welcome"]);
});

test("host bridge routes open and close requests through the shell lifecycle", () => {
  const document = new FakeDocument();
  const shell = new FakeElement(document, "div");
  const opened = [];
  const closed = [];
  bindWelcomeHostBridge(shell, {
    openApp: (appName) => opened.push(appName),
    closeApp: (appName) => closed.push(appName)
  });
  const openDetail = { appName: "welcome", handled: false };
  const closeDetail = { appName: "welcome", handled: false };

  shell.dispatchEvent(new FakeEvent("windows7:openapp", { detail: openDetail }));
  shell.dispatchEvent(new FakeEvent("windows7:closeapp", { detail: closeDetail }));

  assert.deepEqual(opened, ["welcome"]);
  assert.deepEqual(closed, ["welcome"]);
  assert.equal(openDetail.handled, true);
  assert.equal(closeDetail.handled, true);
});

test("production loads Welcome.exe styles and controller before the shell engine", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const stylePosition = html.indexOf('href="./welcome.css');
  const scriptPosition = html.indexOf('src="./welcome.js');
  const enginePosition = html.indexOf('src="./index.js');

  assert.ok(stylePosition >= 0, "welcome.css must be loaded");
  assert.ok(scriptPosition >= 0, "welcome.js must be loaded");
  assert.ok(scriptPosition < enginePosition, "WelcomeApp must construct its window before Windows7Engine inventories apps");
  assert.match(html, /href="\.\/welcome\.css\?v=20260814-7"/);
  assert.match(html, /src="\.\/welcome\.js\?v=20260814-7"/);
});

test("Welcome.exe uses a shared sea-green Aurora canvas and genuine frosted Aero sidebar", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "welcome.css"), "utf8");

  assert.match(css, /\.welcome-window__surface\s*\{[^}]*position:relative/);
  assert.match(css, /#063f59/);
  assert.match(css, /#155c5b/);
  assert.match(css, /\.welcome-window__sidebar[\s\S]*?background:\s*linear-gradient\(180deg, rgba\(228, 255, 247, \.08\), rgba\(139, 211, 191, \.12\)\)/);
  assert.match(css, /backdrop-filter:\s*blur\(18px\) saturate\(125%\)/);
  assert.match(css, /var\(--w7-el-sd\)/);
  assert.doesNotMatch(css, /rgba\(18, 61, 70, \.30\)/);
  assert.doesNotMatch(css, /\.welcome-window::before/);
  assert.match(css, /\.welcome-bubbles/);
  assert.match(css, /\.welcome-bubble/);
  assert.match(css, /@keyframes welcomeBubbleFloat/);
  assert.match(css, /@keyframes welcomeBubbleSwayLeft/);
  assert.match(css, /@keyframes welcomeBubbleSwayRight/);
  assert.match(css, /font-family:\s*"Segoe UI", Tahoma, sans-serif/);
  assert.match(css, /font:\s*11px\/1\.35 "Segoe UI", Tahoma, sans-serif/);
  assert.match(css, /border-radius:\s*2px/);
  assert.doesNotMatch(css, /font:\s*10px\/29px Consolas/);
  assert.match(css, /\.welcome-window__actions button\s*\{[\s\S]*?--w7-el-grad:\s*linear-gradient\(#b2dcd0 0 45%, #77b9a9 50%, #4d938b\)/);
  assert.match(css, /\.welcome-window__actions button\.default\s*\{[\s\S]*?animation:\s*none !important/);
  assert.match(css, /\.welcome-window__actions button:not\(:disabled\):hover,[\s\S]*?background:\s*var\(--w7-el-grad-h\)/);
  assert.match(css, /\.welcome-shortcut:hover,[\s\S]*?rgba\(166, 222, 205, \.38\)/);
  assert.match(css, /\.welcome-window__startup input:checked \+ label::before\s*\{[\s\S]*?linear-gradient\(#bfdfd3,#67aa9c\)/);
  assert.doesNotMatch(css, /background:linear-gradient\(#fff,#d9faff 48%,#aceaf0\)/);
  assert.doesNotMatch(css, /background:linear-gradient\(#f4ffff,#9eecef\)/);
  assert.match(css, /\.welcome-window\[role="dialog"\][\s\S]*?visibility:\s*visible/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
});
