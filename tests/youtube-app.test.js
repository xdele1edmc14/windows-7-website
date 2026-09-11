const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { TOPIC_CHIPS, VIDEO_ITEMS, SHORT_ITEMS, YouTubeApp } = require("../youtube.js");

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

  toggle(token, force) {
    const enabled = force === undefined ? !this.values.has(token) : Boolean(force);
    if (enabled) this.add(token);
    else this.remove(token);
    return enabled;
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
    this.key = options.key;
    this.bubbles = Boolean(options.bubbles);
    this.cancelable = Boolean(options.cancelable);
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

  append(...children) {
    children.filter(Boolean).forEach((child) => {
      child.parentElement = this;
      this.children.push(child);
    });
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
    this.dispatchEvent(new FakeEvent("click", { bubbles: true, cancelable: true }));
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
    this.defaultView = { location: { href: "http://localhost/" } };
  }

  createElement(tagName) {
    return new FakeElement(this, tagName);
  }
}

const createFixture = (options = {}) => {
  const document = new FakeDocument();
  const mount = document.createElement("section");
  const openedTabs = [];
  const app = new YouTubeApp({
    mount,
    document,
    openTab: (...args) => openedTabs.push(args),
    ...options
  });
  return { app, document, mount, openedTabs };
};

test("YouTubeApp builds the complete 960 by 580 feed window", () => {
  const { mount } = createFixture();
  const windowElement = mount.querySelector('[data-app-window="youtube"]');

  assert.ok(windowElement);
  assert.equal(windowElement.dataset.windowWidth, "960");
  assert.equal(windowElement.dataset.windowHeight, "580");
  assert.equal(windowElement.dataset.windowMinWidth, "760");
  assert.equal(windowElement.dataset.windowMinHeight, "480");
  assert.equal(windowElement.getAttribute("data-window-centered"), "");
  assert.equal(mount.querySelectorAll(".youtube-topic-chip").length, 10);
  assert.equal(mount.querySelectorAll('[data-youtube-video]').length, 6);
  assert.equal(mount.querySelectorAll('[data-youtube-short]').length, 4);
  assert.equal(mount.querySelector(".youtube-topic-chip").getAttribute("aria-pressed"), "true");
  assert.ok(mount.querySelector(".youtube-header"));
  assert.ok(mount.querySelector(".youtube-sidebar"));
  assert.ok(mount.querySelector(".youtube-feed"));
});

test("feed data preserves every requested category and mapped video", () => {
  assert.deepEqual(TOPIC_CHIPS, [
    "All",
    "Femboy Videos 2026",
    "Arch Linux Distro Hopping",
    "NullPointerExceptions",
    "Minecraft Duplication Glitches",
    "Neovim Rice",
    "Rust Vs C++ Arguments",
    "How to Exit Vim",
    "BungeeCord Crash Tutorials",
    "Brainrot Shorts"
  ]);
  assert.deepEqual(VIDEO_ITEMS.map(({ title, channel, url, thumbnail }) => ({ title, channel, url, thumbnail })), [
    {
      title: "We built the most realistic Zombie Apocalypse in Minecraft... (no mods)",
      channel: "xDele1ed",
      url: "https://youtu.be/MRt1JS9uy7g?si=dKqUlrk8a38-8h8o",
      thumbnail: "./assets/thumbnails/zombie_apocalypse.jpg"
    },
    {
      title: "Can We Survive Against Zombie Mutants?",
      channel: "xDele1ed",
      url: "https://youtu.be/QQeAP0_oQrA?si=RzsBHd7I_XWswzeV",
      thumbnail: "./assets/thumbnails/zombie_mutants.jpg"
    },
    {
      title: "The Reaper's First Appearance | Deadlands SMP",
      channel: "xDele1ed",
      url: "https://youtu.be/y_TMHY7-EE0?si=l8ikLKdXjt_LgPXL",
      thumbnail: "./assets/thumbnails/reaper.jpg"
    },
    {
      title: "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
      channel: "Rick Astley",
      url: "https://youtu.be/dQw4w9WgXcQ?si=jlIdkwDNvLO74wOk",
      thumbnail: "./assets/thumbnails/nevergonnagiveyouup.jpg"
    },
    {
      title: "☘️Leaf Smp Official Trailer | The New Best Minecraft SMP",
      channel: "Deadlands SMP",
      url: "https://youtu.be/9iWPH4cGUYE?si=rgTJ2yFVT3OU6qeJ",
      thumbnail: "./assets/thumbnails/awkwardsmptrailer.jpg"
    },
    {
      title: "Minecraft Server Hosting Ads Be Like:",
      channel: "Deadlands SMP",
      url: "https://youtu.be/EJUmkt1X1jk?si=Zz6Lsiwi5MPPM3fL",
      thumbnail: "./assets/thumbnails/serverhosting.jpg"
    }
  ]);
  assert.equal(SHORT_ITEMS.length, 4);
  assert.deepEqual(SHORT_ITEMS.map(({ url }) => url), [VIDEO_ITEMS[2].url, VIDEO_ITEMS[0].url, VIDEO_ITEMS[1].url, VIDEO_ITEMS[5].url]);
});

test("hamburger toggles the visual and accessible sidebar state", () => {
  const { app, mount } = createFixture();
  const toggle = mount.querySelector('[data-youtube-sidebar-toggle]');
  const appRoot = mount.querySelector(".youtube-app");

  toggle.click();
  assert.equal(app.sidebarCollapsed, true);
  assert.equal(appRoot.classList.contains("youtube-app--sidebar-collapsed"), true);
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(toggle.getAttribute("aria-label"), "Expand guide");

  toggle.click();
  assert.equal(app.sidebarCollapsed, false);
  assert.equal(appRoot.classList.contains("youtube-app--sidebar-collapsed"), false);
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
});

test("mouse and keyboard activation open mapped videos in separate secure tabs", () => {
  const { mount, openedTabs } = createFixture();
  const firstCard = mount.querySelector('[data-youtube-video="zombie-apocalypse"]');
  const lastCard = mount.querySelector('[data-youtube-video="server-hosting"]');
  const firstShort = mount.querySelector('[data-youtube-short="1"]');

  firstCard.click();
  lastCard.dispatchEvent(new FakeEvent("keydown", { key: "Enter", cancelable: true }));
  lastCard.dispatchEvent(new FakeEvent("keydown", { key: " ", cancelable: true }));
  firstShort.click();

  assert.deepEqual(openedTabs, [
    ["https://youtu.be/MRt1JS9uy7g?si=dKqUlrk8a38-8h8o", "_blank", "noopener,noreferrer"],
    ["https://youtu.be/EJUmkt1X1jk?si=Zz6Lsiwi5MPPM3fL", "_blank", "noopener,noreferrer"],
    ["https://youtu.be/EJUmkt1X1jk?si=Zz6Lsiwi5MPPM3fL", "_blank", "noopener,noreferrer"],
    ["https://youtu.be/y_TMHY7-EE0?si=l8ikLKdXjt_LgPXL", "_blank", "noopener,noreferrer"]
  ]);
});

test("video cards expose one focus target and no nested dead controls", () => {
  const { mount } = createFixture();
  const cards = mount.querySelectorAll(".youtube-video-card");

  assert.equal(cards.length, 6);
  cards.forEach((card) => assert.equal(card.querySelectorAll("button").length, 0));
});

test("YouTube stylesheet defines the fixed dark layout and media aspect ratios", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "youtube.css"), "utf8");

  assert.match(css, /--youtube-bg:\s*#0f0f0f/);
  assert.match(css, /--youtube-header-height:\s*56px/);
  assert.match(css, /--youtube-sidebar-width:\s*220px/);
  assert.match(css, /\.window\.youtube-window\[role="dialog"\][\s\S]*?visibility:\s*visible[\s\S]*?opacity:\s*1[\s\S]*?transform:\s*none/);
  assert.match(css, /\.youtube-video-card__thumbnail\s*\{[\s\S]*?aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(css, /\.youtube-short-card__media\s*\{[\s\S]*?aspect-ratio:\s*9\s*\/\s*16/);
  assert.match(css, /\.youtube-feed\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("production registers YouTube as a desktop, Start-menu, and taskbar app", () => {
  const projectRoot = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const shell = fs.readFileSync(path.join(projectRoot, "index.js"), "utf8");
  const { ASSETS, NON_THEME_BOOT_ASSETS } = require("../boot-assets.js");

  assert.equal(ASSETS.youtube, "./assets/icons/youtube.svg");
  assert.equal(NON_THEME_BOOT_ASSETS.includes(ASSETS.youtube), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "assets", "icons", "youtube.svg")), true);
  assert.ok(html.indexOf('href="./youtube.css') >= 0);
  assert.ok(html.indexOf('src="./youtube.js') >= 0);
  assert.ok(html.indexOf('src="./youtube.js') < html.indexOf('src="./index.js'));
  assert.match(html, /data-start-icon="youtube"/);
  assert.match(shell, /youtube:\s*Object\.freeze\(\{\s*name:\s*"YouTube"/);
  assert.match(shell, /#ensureDefaultAppShortcuts\(\)/);
  assert.match(shell, /youtube:\s*\{\s*icon:\s*ASSETS\.youtube/);
});
