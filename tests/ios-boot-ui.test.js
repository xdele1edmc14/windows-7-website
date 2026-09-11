const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const phoneRoot = path.join(__dirname, "..", "Phone-UI");
const html = fs.readFileSync(path.join(phoneRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(phoneRoot, "main.css"), "utf8");

// Static entry contracts supplement browser QA: they do not prove focus trapping,
// generated launcher behavior, computed styles, or gesture/controller correctness.
const tags = [...html.matchAll(/<([a-z][\w-]*)\b([^<>]*)>/gi)].map(([, tag, source]) => {
  const attrs = {};
  for (const [, name, double, single, bare] of source.matchAll(/([^\s=/'">]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attrs[name.toLowerCase()] = double ?? single ?? bare ?? "";
  }
  return { tag: tag.toLowerCase(), attrs };
});
const byId = id => tags.find(el => el.attrs.id === id);
const byClass = name => tags.find(el => (el.attrs.class || "").split(/\s+/).includes(name));
const has = (el, attr) => Object.hasOwn(el.attrs, attr);
const localPath = url => path.resolve(phoneRoot, decodeURIComponent(url.split(/[?#]/)[0]));
const isLocal = url => !/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(url);

test("entry loads CDN styles and deferred classic dependencies in order", () => {
  const scripts = tags.filter(el => el.tag === "script" && el.attrs.src);
  const frameworkIndex = scripts.findIndex(el => /^https:\/\/cdn\.jsdelivr\.net\/npm\/framework7@[^/]+\/framework7-bundle\.min\.js$/.test(el.attrs.src));
  assert.ok(frameworkIndex >= 0, "Framework7 must load from the CDN");
  let previous = frameworkIndex;
  for (const file of ["ios-boot-core.js", "home-core.js", "app.js"]) {
    const index = scripts.findIndex(el => isLocal(el.attrs.src) && localPath(el.attrs.src) === path.join(phoneRoot, file));
    assert.ok(index > previous, file + " must follow its dependencies");
    previous = index;
  }
  for (const script of scripts) {
    assert.ok(has(script, "defer"), script.attrs.src + " must wait for parsed markup");
    assert.ok(!has(script, "async"), "async can reorder dependencies");
    assert.ok(!script.attrs.type || /^(?:text|application)\/javascript$/.test(script.attrs.type), "entry scripts use classic globals");
  }
  const styles = tags.filter(el => el.tag === "link" && el.attrs.rel === "stylesheet");
  const frameworkStyle = styles.findIndex(el => /^https:\/\/cdn\.jsdelivr\.net\/npm\/framework7@[^/]+\/framework7-bundle\.min\.css$/.test(el.attrs.href));
  const iconStyle = styles.findIndex(el => /^https:\/\/cdn\.jsdelivr\.net\/npm\/framework7-icons@[^/]+\/css\/framework7-icons\.css$/.test(el.attrs.href));
  const shellStyle = styles.findIndex(el => isLocal(el.attrs.href) && localPath(el.attrs.href) === path.join(phoneRoot, "main.css"));
  assert.ok(frameworkStyle >= 0 && iconStyle >= 0);
  assert.ok(shellStyle > frameworkStyle && shellStyle > iconStyle, "shell overrides follow vendor styles");
  assert.equal(scripts[frameworkIndex].attrs.src.match(/framework7@([^/]+)/)[1], styles[frameworkStyle].attrs.href.match(/framework7@([^/]+)/)[1], "framework JS and CSS versions must agree");
});

test("entry preserves zoom and boots with lock and home inert", () => {
  const viewport = tags.find(el => el.tag === "meta" && el.attrs.name === "viewport");
  assert.match(viewport?.attrs.content || "", /viewport-fit\s*=\s*cover/);
  assert.doesNotMatch(viewport.attrs.content, /maximum-scale|user-scalable/i);
  assert.equal(byId("ios-app")?.attrs["data-screen"], "boot");
  assert.equal(byClass("phone-boot")?.attrs["aria-busy"], "true");
  const lock = byId("lock-screen"), home = byId("home-screen");
  assert.ok(lock?.attrs["aria-label"]);
  assert.ok(!has(lock, "hidden") && has(lock, "inert"));
  assert.equal(home?.tag, "main");
  assert.ok(home.attrs["aria-label"] && has(home, "inert"));
  assert.ok(tags.some(el => el.attrs["aria-live"] === "polite"), "phase changes have an announcement region");
});

test("launchers expose named native keyboard controls and navigation mounts", () => {
  for (const name of ["unlock-target", "app-home-target", "search-launcher"]) {
    const control = byClass(name);
    assert.equal(control?.tag, "button", name + " must support native Enter and Space activation");
    assert.ok(control.attrs["aria-label"]?.trim(), name + " needs an accessible name");
    assert.ok(!has(control, "disabled") && control.attrs.tabindex !== "-1");
  }
  for (const name of ["page-dots", "dock"]) {
    const launcher = byClass(name);
    assert.equal(launcher?.tag, "nav");
    assert.ok(launcher.attrs["aria-label"]?.trim());
  }
  assert.ok(byId("page-track"), "controller needs its page launcher mount");
  assert.equal(byClass("done-button")?.tag, "button");
  const flashlight = tags.find(el => el.tag === "button" && el.attrs["aria-label"] === "Flashlight");
  assert.equal(flashlight?.attrs["aria-pressed"], "false", "toggle exposes its initial state");
});

test("app, Spotlight, and removal dialogs have names and start unavailable", () => {
  for (const modal of [byId("app-surface"), byClass("spotlight"), byClass("remove-sheet")]) {
    assert.equal(modal?.attrs.role, "dialog");
    assert.equal(modal.attrs["aria-modal"], "true");
    const labelIds = (modal.attrs["aria-labelledby"] || "").split(/\s+/).filter(Boolean);
    assert.ok(modal.attrs["aria-label"]?.trim() || labelIds.length, "dialog needs a name");
    for (const id of labelIds) assert.ok(byId(id), "dialog title " + id + " must exist");
  }
  for (const modal of [byId("app-surface"), byClass("spotlight")]) assert.ok(has(modal, "hidden") && has(modal, "inert"));
  assert.ok(has(byClass("remove-backdrop"), "hidden"));
  for (const name of ["spotlight-cancel", "remove-cancel"]) assert.equal(byClass(name)?.tag, "button");
  for (const action of ["hide", "delete"]) {
    assert.ok(tags.some(el => el.tag === "button" && el.attrs["data-remove"] === action), action + " must be keyboard activatable");
  }
});

test("Spotlight provides a labeled native search field and non-submitting cancel", () => {
  const form = byClass("spotlight-form");
  assert.equal(form?.tag, "form");
  assert.equal(form.attrs.role, "search");
  const input = tags.find(el => el.tag === "input" && el.attrs.type === "search");
  assert.ok(input?.attrs["aria-label"]?.trim(), "placeholder text is not an accessible label");
  assert.ok(!has(input, "disabled") && input.attrs.tabindex !== "-1");
  assert.equal(byClass("spotlight-cancel").attrs.type, "button");
});

test("local entry assets and CSS image references exist and are nonempty", () => {
  const references = tags.flatMap(el => [el.attrs.src, el.attrs.href]).filter(Boolean);
  const images = [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map(match => match[1].trim());
  const preload = tags.find(el => el.tag === "link" && el.attrs.rel === "preload" && el.attrs.as === "image");
  assert.ok(preload && images.includes(preload.attrs.href), "preload must warm an image actually used by the shell");
  for (const url of new Set([...references, ...images].filter(isLocal))) {
    const asset = localPath(url);
    assert.ok(fs.existsSync(asset), url + " must exist");
    const stat = fs.statSync(asset);
    assert.ok(stat.isFile() && stat.size > 0, url + " must be a nonempty file");
  }
});

test("shell supplies visible focus and user preference style hooks", () => {
  assert.match(css, /:focus-visible\s*\{[^}]*outline\s*:/, "keyboard focus must have a visible indicator");
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/, "component layout must not override hidden dialogs");
  for (const preference of ["prefers-reduced-motion", "prefers-reduced-transparency", "prefers-contrast"]) {
    assert.ok(css.includes("(" + preference + ":"), preference + " needs a style hook; browser QA verifies the result");
  }
});
