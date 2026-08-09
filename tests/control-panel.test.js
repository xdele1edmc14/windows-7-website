const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  CONTROL_PANEL_ITEMS,
  filterControlPanelItems,
  ControlPanelApp
} = require("../control-panel.js");

class FakeElement {
  constructor(ownerDocument, tagName = "div") {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.textContent = "";
    this.className = "";
    this.type = "";
    this.src = "";
    this.alt = "";
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type) {
    (this.listeners.get(type) ?? []).forEach((listener) => listener({ target: this }));
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(this, tagName);
  }
}

const createAppFixture = () => {
  const ownerDocument = new FakeDocument();
  const elements = new Map([
    ["[data-control-panel-back]", new FakeElement(ownerDocument, "button")],
    ["[data-control-panel-address]", new FakeElement(ownerDocument, "span")],
    ["[data-control-panel-search]", new FakeElement(ownerDocument, "input")],
    ["[data-control-panel-home]", new FakeElement(ownerDocument, "section")],
    ["[data-control-panel-display]", new FakeElement(ownerDocument, "section")],
    ["[data-control-panel-themes]", new FakeElement(ownerDocument, "section")],
    ["[data-control-panel-grid]", new FakeElement(ownerDocument, "div")],
    ["[data-control-panel-empty]", new FakeElement(ownerDocument, "p")]
  ]);
  const root = {
    ownerDocument,
    querySelector: (selector) => elements.get(selector) ?? null
  };
  return { root, elements };
};

test("catalog exposes the 19 approved Control Panel entries", () => {
  assert.equal(CONTROL_PANEL_ITEMS.length, 19);
  assert.deepEqual(
    CONTROL_PANEL_ITEMS.map(({ label }) => label),
    [
      "Data Usage",
      "Display",
      "Keyboard",
      "Sync Center",
      "Windows Defender",
      "Date and Time",
      "Backup and Restore",
      "Mouse",
      "System",
      "Windows Update",
      "Default Programs",
      "Ease of Access",
      "Personalize",
      "Sound",
      "Taskbar and Start Menu",
      "Device Storage",
      "Gadgets",
      "Speech Recognition",
      "User Accounts"
    ]
  );
});

test("catalog omits the three settings excluded from scope", () => {
  const labels = CONTROL_PANEL_ITEMS.map(({ label }) => label);
  assert.equal(labels.includes("Programs and Features"), false);
  assert.equal(labels.includes("Region and Language"), false);
  assert.equal(labels.includes("Power Options"), false);
});

test("catalog applies the approved icon substitutions", () => {
  const iconFor = (label) => CONTROL_PANEL_ITEMS.find((item) => item.label === label)?.icon;
  assert.equal(iconFor("Default Programs"), "./assets/icons/defaultprograms.ico");
  assert.equal(iconFor("Personalize"), "./assets/icons/controlpanel/gadgets_64x64.png");
  assert.equal(iconFor("Sound"), "./assets/icons/speaker.png");
});

test("Display and Personalize are the implemented destinations", () => {
  const actionable = CONTROL_PANEL_ITEMS.filter(({ action }) => action !== null);
  assert.deepEqual(actionable.map(({ label, action }) => ({ label, action })), [
    { label: "Display", action: "display" },
    { label: "Personalize", action: "themes" }
  ]);
});

test("filter returns every entry for an empty or whitespace-only query", () => {
  assert.equal(filterControlPanelItems(CONTROL_PANEL_ITEMS, ""), CONTROL_PANEL_ITEMS);
  assert.equal(filterControlPanelItems(CONTROL_PANEL_ITEMS, "   "), CONTROL_PANEL_ITEMS);
});

test("filter performs case-insensitive trimmed substring matching", () => {
  assert.deepEqual(
    filterControlPanelItems(CONTROL_PANEL_ITEMS, "  WINDows  ").map(({ label }) => label),
    ["Windows Defender", "Windows Update"]
  );
  assert.deepEqual(
    filterControlPanelItems(CONTROL_PANEL_ITEMS, "display").map(({ label }) => label),
    ["Display"]
  );
});

test("filter returns an empty array when nothing matches", () => {
  assert.deepEqual(filterControlPanelItems(CONTROL_PANEL_ITEMS, "not-a-setting"), []);
});

test("app renders the full home view and filters it from search input", () => {
  const { root, elements } = createAppFixture();
  new ControlPanelApp(root);

  const grid = elements.get("[data-control-panel-grid]");
  const empty = elements.get("[data-control-panel-empty]");
  const search = elements.get("[data-control-panel-search]");
  assert.equal(grid.children.length, 19);
  assert.equal(empty.hidden, true);

  search.value = "windows";
  search.dispatch("input");
  assert.deepEqual(grid.children.map(({ dataset }) => dataset.controlPanelItem), [
    "windows-defender",
    "windows-update"
  ]);

  search.value = "missing setting";
  search.dispatch("input");
  assert.equal(grid.children.length, 0);
  assert.equal(empty.hidden, false);
});

test("Display and Back switch views within the same app", () => {
  const { root, elements } = createAppFixture();
  const app = new ControlPanelApp(root);
  const grid = elements.get("[data-control-panel-grid]");
  const home = elements.get("[data-control-panel-home]");
  const display = elements.get("[data-control-panel-display]");
  const back = elements.get("[data-control-panel-back]");
  const address = elements.get("[data-control-panel-address]");
  const displayButton = grid.children.find(({ dataset }) => dataset.controlPanelItem === "display");

  displayButton.dispatch("click");
  assert.equal(home.hidden, true);
  assert.equal(display.hidden, false);
  assert.equal(back.disabled, false);
  assert.equal(address.textContent, "Control Panel > Display");

  back.dispatch("click");
  assert.equal(home.hidden, false);
  assert.equal(display.hidden, true);
  assert.equal(back.disabled, true);
  assert.equal(address.textContent, "Control Panel");

  app.showDisplay();
  assert.equal(display.hidden, false);
});

test("Personalize opens Themes and Back returns to Control Panel home", () => {
  const { root, elements } = createAppFixture();
  const app = new ControlPanelApp(root);
  const grid = elements.get("[data-control-panel-grid]");
  const home = elements.get("[data-control-panel-home]");
  const display = elements.get("[data-control-panel-display]");
  const themes = elements.get("[data-control-panel-themes]");
  const back = elements.get("[data-control-panel-back]");
  const address = elements.get("[data-control-panel-address]");
  const personalizeButton = grid.children.find(({ dataset }) => dataset.controlPanelItem === "personalize");

  personalizeButton.dispatch("click");
  assert.equal(home.hidden, true);
  assert.equal(display.hidden, true);
  assert.equal(themes.hidden, false);
  assert.equal(back.disabled, false);
  assert.equal(address.textContent, "Control Panel > Personalization");

  back.dispatch("click");
  assert.equal(home.hidden, false);
  assert.equal(themes.hidden, true);
  assert.equal(back.disabled, true);

  app.showThemes();
  assert.equal(themes.hidden, false);
});

test("typing a search on Display returns home and reopening home can clear it", () => {
  const { root, elements } = createAppFixture();
  const app = new ControlPanelApp(root);
  const search = elements.get("[data-control-panel-search]");
  const home = elements.get("[data-control-panel-home]");
  const display = elements.get("[data-control-panel-display]");
  const grid = elements.get("[data-control-panel-grid]");

  app.showDisplay();
  search.value = "mouse";
  search.dispatch("input");
  assert.equal(home.hidden, false);
  assert.equal(display.hidden, true);
  assert.deepEqual(grid.children.map(({ dataset }) => dataset.controlPanelItem), ["mouse"]);

  app.showHome({ clearSearch: true });
  assert.equal(search.value, "");
  assert.equal(grid.children.length, 19);
});

test("browser script registers the app API on window", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "control-panel.js"), "utf8");
  const sandbox = { window: {}, AbortController };

  vm.runInNewContext(source, sandbox);

  assert.equal(typeof sandbox.window.Windows7ControlPanel?.ControlPanelApp, "function");
});
