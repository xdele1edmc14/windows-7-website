const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  DEVHUB_CONFIG,
  REPOSITORIES,
  SKILL_GROUPS,
  DevHubApp,
  createContributionCalendar,
  filterRepositories,
  handleRepoCardClick
} = require("../devhub.js");

class FakeEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.key = options.key;
    this.cancelable = Boolean(options.cancelable);
    this.defaultPrevented = false;
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
    this.element.className = [...new Set([...this.values(), ...names])].join(" ");
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
  constructor(document, tagName) {
    this.ownerDocument = document;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = "";
    this.classList = new FakeClassList(this);
    this.dataset = {};
    this.style = { setProperty() {} };
    this.hidden = false;
    this.disabled = false;
    this.value = "";
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
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name === "class") this.className = stringValue;
    if (name === "tabindex") this.tabIndex = Number(stringValue);
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = stringValue;
    }
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
  }

  append(...nodes) {
    nodes.flat().forEach((node) => {
      if (node === null || node === undefined) return;
      if (typeof node === "string") {
        this._textContent += node;
        return;
      }
      node.parentElement = this;
      this.children.push(node);
    });
  }

  appendChild(node) {
    this.append(node);
    return node;
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
    if (this.parentElement && !event.cancelBubble) this.parentElement.dispatchEvent(event);
    return !event.defaultPrevented;
  }

  click() {
    if (!this.disabled) this.dispatchEvent(new FakeEvent("click", { target: this, cancelable: true }));
  }

  focus() {
    this.ownerDocument.activeElement = this;
    this.dispatchEvent(new FakeEvent("focus", { target: this }));
  }

  blur() {
    if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null;
    this.dispatchEvent(new FakeEvent("blur", { target: this }));
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches(selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  matches(selector) {
    if (selector.includes(",")) return selector.split(",").some((part) => this.matches(part.trim()));
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
    this.defaultView = { open() {} };
  }

  createElement(tagName) {
    return new FakeElement(this, tagName);
  }
}

const createFixture = (options = {}) => {
  const document = new FakeDocument();
  const mount = document.createElement("section");
  const openedTabs = [];
  const app = new DevHubApp({
    mount,
    document,
    openTab: (...args) => openedTabs.push(args),
    fetchProfile: async () => ({ ok: false }),
    ...options
  });
  return { app, document, mount, openedTabs };
};

test("production configuration preserves every critical redirect", () => {
  assert.equal(DEVHUB_CONFIG.links.deadlandsDiscord, "https://discord.gg/XPUh4zJagc");
  assert.equal(DEVHUB_CONFIG.links.xApocalypseGithub, "https://github.com/xdele1edmc14/xApocalypse");
  assert.equal(DEVHUB_CONFIG.links.infectedRevampedGithub, "https://github.com/xdele1edmc14/Infected-revamped");
  assert.equal(DEVHUB_CONFIG.links.windows7WebsiteGithub, "https://github.com/xdele1edmc14/windows-7-website");
  assert.equal(DEVHUB_CONFIG.links.xosPortfolioGithub, "https://github.com/xdele1edmc14/xos-portfolio");
  assert.equal(DEVHUB_CONFIG.links.minecraftSetupGithub, "https://github.com/xdele1edmc14/minecraft-setup");
});

test("portfolio data contains four pins and the complete skill matrix", () => {
  assert.deepEqual(REPOSITORIES.filter(({ pinned }) => pinned).map(({ key }) => key), [
    "DEADLANDS",
    "xApocalypse",
    "Infected-revamped",
    "windows-7-website"
  ]);
  assert.deepEqual(SKILL_GROUPS.map(({ title, items }) => [title, items.length]), [
    ["Core languages", 4],
    ["Frameworks and APIs", 4],
    ["Build tools and systems", 4]
  ]);
});

test("repository filtering combines text and language without mutating input", () => {
  const original = [...REPOSITORIES];
  assert.deepEqual(filterRepositories(REPOSITORIES, "apocalypse", "Java").map(({ key }) => key), ["DEADLANDS", "xApocalypse"]);
  assert.deepEqual(filterRepositories(REPOSITORIES, "public", "Java").map(({ key }) => key), ["xApocalypse", "Infected-revamped"]);
  assert.deepEqual(filterRepositories(REPOSITORIES, "missing", "all"), []);
  assert.deepEqual(REPOSITORIES, original);
});

test("contribution calendar covers 52 complete weeks and totals 195", () => {
  const calendar = createContributionCalendar();
  assert.equal(calendar.length, 364);
  assert.equal(calendar[0].date, "2025-08-17");
  assert.equal(calendar.at(-1).date, "2026-08-15");
  assert.equal(calendar.reduce((total, day) => total + day.count, 0), 195);
  assert.ok(calendar.every(({ count, level }) => level === (count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4)));
});

test("DevHubApp builds the complete centered portfolio window", () => {
  const { mount } = createFixture();
  const windowElement = mount.querySelector('[data-app-window="devhub"]');
  assert.ok(windowElement);
  assert.equal(windowElement.dataset.windowWidth, "1060");
  assert.equal(windowElement.dataset.windowHeight, "680");
  assert.equal(windowElement.dataset.windowMinWidth, "720");
  assert.equal(windowElement.dataset.windowMinHeight, "500");
  assert.equal(mount.querySelectorAll('[role="tab"]').length, 3);
  assert.equal(mount.querySelector('[data-devhub-panel="overview"]').querySelectorAll('[data-devhub-repo]').length, 4);
  assert.equal(mount.querySelectorAll('[data-contribution-date]').length, 364);
  assert.equal(mount.querySelectorAll(".devhub-skill-pill").length, 12);
});

test("tabs, search, and language filtering expose real state", () => {
  const { app, mount } = createFixture();
  app.selectTab("repositories");
  assert.equal(app.activeTab, "repositories");

  const search = mount.querySelector('[data-devhub-search]');
  search.value = "apocalypse";
  search.dispatchEvent(new FakeEvent("input"));
  assert.equal(app.searchQuery, "apocalypse");
  assert.deepEqual(
    mount.querySelector('[data-devhub-results]').querySelectorAll('[data-devhub-repo]').map((node) => node.dataset.devhubRepo),
    ["DEADLANDS", "xApocalypse"]
  );

  const language = mount.querySelector('[data-devhub-language]');
  language.value = "TypeScript";
  language.dispatchEvent(new FakeEvent("change"));
  assert.ok(mount.querySelector('[data-devhub-empty]'));
  mount.querySelector('[data-devhub-clear-filters]').click();
  assert.equal(app.searchQuery, "");
  assert.equal(app.languageFilter, "all");
});

test("mouse and keyboard activation open critical destinations securely", () => {
  const { app, mount, openedTabs } = createFixture();
  mount.querySelector('[data-devhub-repo="DEADLANDS"]').click();
  mount.querySelector('[data-devhub-repo="xApocalypse"]').dispatchEvent(new FakeEvent("keydown", { key: "Enter", cancelable: true }));
  app.selectTab("repositories");
  mount.querySelector('[data-devhub-repo="windows-7-website"]').dispatchEvent(new FakeEvent("keydown", { key: " ", cancelable: true }));
  assert.deepEqual(openedTabs, [
    ["https://discord.gg/XPUh4zJagc", "_blank", "noopener,noreferrer"],
    ["https://github.com/xdele1edmc14/xApocalypse", "_blank", "noopener,noreferrer"],
    ["https://github.com/xdele1edmc14/windows-7-website", "_blank", "noopener,noreferrer"]
  ]);
});

test("configured activity repositories are real secure links", () => {
  const { mount, openedTabs } = createFixture();
  const activityLink = mount.querySelector('[data-devhub-activity-url="https://github.com/xdele1edmc14/windows-7-website"]');
  assert.equal(activityLink.tagName, "A");
  activityLink.click();
  assert.deepEqual(openedTabs, [
    ["https://github.com/xdele1edmc14/windows-7-website", "_blank", "noopener,noreferrer"]
  ]);
});

test("handleRepoCardClick rejects unconfigured destinations", () => {
  const opened = [];
  assert.equal(handleRepoCardClick("unknown", (...args) => opened.push(args)), false);
  assert.deepEqual(opened, []);
});

test("heatmap focus exposes the exact contribution tooltip and Escape dismisses it", () => {
  const { mount } = createFixture();
  const cell = mount.querySelector('[data-contribution-date="2026-08-14"]');
  cell.focus();
  const tooltip = mount.querySelector('[role="tooltip"]');
  assert.match(tooltip.textContent, /^\d+ contributions? on Aug 14, 2026$/);
  assert.equal(tooltip.hidden, false);
  mount.querySelector('[data-app-window="devhub"]').dispatchEvent(new FakeEvent("keydown", { key: "Escape", cancelable: true }));
  assert.equal(tooltip.hidden, true);
});

test("slash focuses search and tab arrows move focus without selecting", () => {
  const { mount, document } = createFixture();
  const windowElement = mount.querySelector('[data-app-window="devhub"]');
  windowElement.dispatchEvent(new FakeEvent("keydown", { key: "/", cancelable: true }));
  assert.equal(document.activeElement, mount.querySelector('[data-devhub-search]'));

  const overview = mount.querySelector('[data-devhub-tab="overview"]');
  overview.focus();
  overview.dispatchEvent(new FakeEvent("keydown", { key: "ArrowRight", cancelable: true }));
  assert.equal(document.activeElement, mount.querySelector('[data-devhub-tab="repositories"]'));
  assert.equal(overview.getAttribute("aria-selected"), "true");
});

test("GitHub refresh updates allowed metadata and reports connected", async () => {
  const { app, mount } = createFixture({
    fetchProfile: async () => ({
      profile: { avatar_url: "https://avatars.example/x.png", followers: 3, following: 2 },
      repositories: [{ name: "xApocalypse", stargazers_count: 4, language: "Java" }]
    })
  });
  await app.refreshProfile();
  assert.equal(app.apiStatus, "connected");
  assert.equal(mount.querySelector('[data-devhub-api-status]').textContent, "Connected to GitHub API");
  assert.match(mount.querySelector('[data-devhub-social]').textContent, /3 followers.*2 following/);
  assert.match(mount.querySelector('[data-devhub-repo="xApocalypse"]').textContent, /☆ 4/);
});

test("API-refreshed languages participate in repository filtering", async () => {
  const { app, mount } = createFixture({
    fetchProfile: async () => ({
      profile: { followers: 1, following: 0 },
      repositories: [{ name: "xApocalypse", stargazers_count: 1, language: "TypeScript" }]
    })
  });
  await app.refreshProfile();
  app.selectTab("repositories");
  const language = mount.querySelector('[data-devhub-language]');
  language.value = "TypeScript";
  language.dispatchEvent(new FakeEvent("change"));
  assert.deepEqual(
    mount.querySelector('[data-devhub-results]').querySelectorAll('[data-devhub-repo]').map((node) => node.dataset.devhubRepo),
    ["xApocalypse"]
  );
});

test("GitHub failure keeps snapshot content and exposes Retry", async () => {
  const { app, mount } = createFixture({ fetchProfile: async () => { throw new Error("offline"); } });
  await app.refreshProfile();
  assert.equal(app.apiStatus, "fallback");
  assert.equal(mount.querySelector('[data-devhub-api-status]').textContent, "Using saved profile snapshot");
  assert.equal(mount.querySelector('[data-devhub-retry]').hidden, false);
  assert.match(mount.querySelector('[data-devhub-social]').textContent, /1 follower.*0 following/);
});

test("malformed GitHub profile data uses the saved snapshot", async () => {
  const { app, mount } = createFixture({
    fetchProfile: async () => ({ profile: "not-an-object", repositories: [] })
  });
  await app.refreshProfile();
  assert.equal(app.apiStatus, "fallback");
  assert.equal(mount.querySelector('[data-devhub-api-status]').textContent, "Using saved profile snapshot");
});

test("repository input announces filtering before returning to Ready", async () => {
  const { mount } = createFixture();
  const search = mount.querySelector('[data-devhub-search]');
  search.value = "java";
  search.dispatchEvent(new FakeEvent("input"));
  assert.equal(mount.querySelector('[data-devhub-status]').textContent, "Filtering repositories");
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(mount.querySelector('[data-devhub-status]').textContent, "Ready");
});

test("DevHub uses the exact supplied PNG logo", () => {
  const installed = fs.readFileSync(path.join(__dirname, "..", "assets", "icons", "devhub.png"));
  assert.equal(
    crypto.createHash("sha256").update(installed).digest("hex"),
    "0f38688dbf4ae095a108f7ddb0e3d1cd604d6c2c290e7437c3ef5cb2adfcbe55"
  );
});

test("DevHub dark native control and status bar override shared light shell chrome", () => {
  const projectRoot = path.join(__dirname, "..");
  const css = fs.readFileSync(path.join(projectRoot, "devhub.css"), "utf8");
  const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const ruleBody = (selector) => {
    const ruleStart = css.indexOf(`${selector} {`);
    assert.notEqual(ruleStart, -1, `missing ${selector} rule`);
    const bodyStart = css.indexOf("{", ruleStart) + 1;
    return css.slice(bodyStart, css.indexOf("}", bodyStart));
  };

  assert.match(ruleBody(".devhub-app"), /color-scheme:\s*dark/);
  const selectRule = ruleBody("#windows-7-root .devhub-window .devhub-repository-toolbar select[data-devhub-language]:not([multiple]):not([size])");
  assert.match(selectRule, /border:\s*1px solid var\(--devhub-border\)\s*!important/);
  assert.match(selectRule, /background-color:\s*#21262d\s*!important/);
  assert.match(selectRule, /background-image:[\s\S]*!important/);
  assert.match(selectRule, /box-shadow:\s*none\s*!important/);
  const optionRule = ruleBody("#windows-7-root .devhub-repository-toolbar select option");
  assert.match(optionRule, /background:\s*#21262d/);
  assert.match(optionRule, /color:\s*var\(--devhub-text\)/);

  const statusRule = ruleBody("#windows-7-root .devhub-window footer.devhub-statusbar");
  assert.match(statusRule, /margin:\s*0/);
  assert.match(statusRule, /border:\s*0/);
  assert.match(statusRule, /border-top:\s*1px solid var\(--devhub-border\)/);
  assert.match(statusRule, /box-shadow:\s*none/);
  assert.match(ruleBody("#windows-7-root .devhub-window footer.devhub-statusbar::before"), /content:\s*none/);
  assert.match(html, /href="\.\/devhub\.css\?v=20260816-4"/);
});

test("production registers DevHub in assets, desktop, Start menu, and taskbar", () => {
  const projectRoot = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const shell = fs.readFileSync(path.join(projectRoot, "index.js"), "utf8");
  const { ASSETS, NON_THEME_BOOT_ASSETS } = require("../boot-assets.js");
  assert.equal(ASSETS.devhub, "./assets/icons/devhub.png");
  assert.equal(NON_THEME_BOOT_ASSETS.includes(ASSETS.devhub), true);
  assert.ok(html.indexOf('href="./devhub.css') >= 0);
  assert.ok(html.indexOf('src="./devhub.js') >= 0);
  assert.ok(html.indexOf('src="./devhub.js') < html.indexOf('src="./index.js'));
  assert.match(html, /src="\.\/boot-assets\.js\?v=20260816-1"/);
  assert.match(html, /src="\.\/index\.js\?v=20260819-1"/);
  assert.match(html, /data-start-icon="devhub"[\s\S]*?<span>DevHub<\/span>/);
  assert.match(shell, /devhub:\s*Object\.freeze\(\{\s*name:\s*"DevHub"/);
  assert.match(shell, /ensureAppShortcut\("devhub",\s*"DevHub",\s*ASSETS\.devhub/);
  assert.match(shell, /devhub:\s*\{\s*icon:\s*ASSETS\.devhub/);
});
