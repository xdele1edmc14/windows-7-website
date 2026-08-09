const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  AERO_CLOSE_DURATION_MS,
  AERO_OPEN_DURATION_MS,
  createAeroWindowMotion
} = require("../aero-window-motion.js");

class FakeClassList {
  #values = new Set();

  add(...names) {
    names.forEach((name) => this.#values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.#values.delete(name));
  }

  contains(name) {
    return this.#values.has(name);
  }
}

class FakeElement {
  constructor() {
    this.classList = new FakeClassList();
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchAnimation(animationName, target = this) {
    [...(this.listeners.get("animationend") ?? [])].forEach((listener) => {
      listener({ animationName, target });
    });
  }
}

const createFixture = ({ reducedMotion = false } = {}) => {
  const timers = new Map();
  let sequence = 0;
  const motion = createAeroWindowMotion({
    prefersReducedMotion: () => reducedMotion,
    setTimer(callback, delay) {
      const id = ++sequence;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    }
  });
  return { motion, timers };
};

test("close keeps the window in its closing state until aeroClose ends", async () => {
  const element = new FakeElement();
  const { motion, timers } = createFixture();

  const closed = motion.closeAeroWindow(element);

  assert.equal(element.classList.contains("closing"), true);
  assert.equal(element.classList.contains("is-window-animating"), true);
  assert.equal([...timers.values()][0].delay, AERO_CLOSE_DURATION_MS);

  element.dispatchAnimation("aeroOpen");
  assert.equal(element.classList.contains("closing"), true);

  element.dispatchAnimation("aeroClose");
  await closed;

  assert.equal(element.classList.contains("closing"), false);
  assert.equal(element.classList.contains("is-window-animating"), false);
  assert.equal(timers.size, 0);
});

test("close ignores descendant animation events and shares one pending close", async () => {
  const element = new FakeElement();
  const descendant = new FakeElement();
  const { motion } = createFixture();

  const firstClose = motion.closeAeroWindow(element);
  const secondClose = motion.closeAeroWindow(element);

  assert.equal(secondClose, firstClose);
  element.dispatchAnimation("aeroClose", descendant);
  assert.equal(element.classList.contains("closing"), true);

  element.dispatchAnimation("aeroClose");
  await firstClose;
});

test("close completes from the exact 180ms fallback", async () => {
  const element = new FakeElement();
  const { motion, timers } = createFixture();
  const closed = motion.closeAeroWindow(element);
  const [{ callback, delay }] = [...timers.values()];

  assert.equal(delay, 180);
  callback();
  await closed;

  assert.equal(element.classList.contains("closing"), false);
});

test("open applies its class and clears it after aeroOpen", async () => {
  const element = new FakeElement();
  const { motion, timers } = createFixture();

  const opened = motion.openAeroWindow(element);

  assert.equal(element.classList.contains("opening"), true);
  assert.equal(element.classList.contains("is-window-animating"), true);
  assert.equal([...timers.values()][0].delay, AERO_OPEN_DURATION_MS);

  element.dispatchAnimation("aeroOpen");
  await opened;

  assert.equal(element.classList.contains("opening"), false);
  assert.equal(element.classList.contains("is-window-animating"), false);
});

test("reduced motion completes without scheduling decorative animation", async () => {
  const element = new FakeElement();
  const { motion, timers } = createFixture({ reducedMotion: true });

  await motion.closeAeroWindow(element);

  assert.equal(timers.size, 0);
  assert.equal(element.classList.contains("closing"), false);
  assert.equal(element.classList.contains("is-window-animating"), false);
});

test("desktop CSS contains the exact Aero DWM motion contract", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "desktop.css"), "utf8");
  const compact = css.replace(/\s+/g, " ");

  assert.match(compact, /\[data-desktop\]\s*\{[^}]*perspective:\s*1000px;/);
  assert.match(compact, /@keyframes aeroClose \{ 0% \{ opacity: 1; transform: scale\(1\) translateZ\(0px\) rotateX\(0deg\); \} 100% \{ opacity: 0; transform: scale\(0\.9\) translateZ\(-50px\) rotateX\(2deg\); \} \}/);
  assert.match(compact, /@keyframes aeroOpen \{ 0% \{ opacity: 0; transform: scale\(0\.88\) translateZ\(-60px\) rotateX\(-2deg\); \} 100% \{ opacity: 1; transform: scale\(1\) translateZ\(0px\) rotateX\(0deg\); \} \}/);
  assert.match(compact, /\.window\.closing\s*\{[^}]*transform-origin:\s*center center;[^}]*animation:\s*aeroClose 180ms cubic-bezier\(0\.1, 0\.85, 0\.25, 1\) both;/);
  assert.match(compact, /\.window\.opening\s*\{[^}]*transform-origin:\s*center center;[^}]*animation:\s*aeroOpen 200ms cubic-bezier\(0\.05, 0\.9, 0\.1, 1\) both;/);
  assert.match(compact, /@media \(prefers-reduced-motion: reduce\)[^{]*\{[^}]*\.window\.opening[^}]*\.window\.closing[^}]*animation:\s*none !important;/);
});

test("the shell loads and uses the shared motion lifecycle for every window type", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const source = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

  assert.ok(
    html.indexOf("aero-window-motion.js") < html.indexOf("index.js"),
    "the motion lifecycle must load before the shell"
  );
  assert.match(source, /const \{ closeAeroWindow, openAeroWindow \} = window\.Windows7AeroWindowMotion;/);
  assert.match(source, /#showThemeWait\(\)[\s\S]*?openAeroWindow\(dialog\);[\s\S]*?#hideThemeWait\(\)/);
  assert.match(source, /#openExplorer\([^)]*\)[\s\S]*?openAeroWindow\(windowElement\);[\s\S]*?#initializeExplorerWindowElement/);
  assert.match(source, /#showShellItemProperties\([^)]*\)[\s\S]*?openAeroWindow\(dialog\);[\s\S]*?#updateWindowTaskLabel/);
  assert.match(source, /#openAppWindow\([^)]*\)[\s\S]*?if \(isClosed\) void openAeroWindow\(windowElement\);[\s\S]*?#capturePinnedItems/);
});

test("shared close cleanup waits for aeroClose before hiding or removing", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");
  const closeStart = source.indexOf("async #closeWindow");
  const closeEnd = source.indexOf("#toggleMaximized", closeStart);
  const closeMethod = source.slice(closeStart, closeEnd);

  assert.notEqual(closeStart, -1);
  assert.match(closeMethod, /if \(windowElement\.classList\.contains\("closing"\)\) return;/);
  assert.ok(closeMethod.indexOf("await closeAeroWindow(windowElement)") !== -1);
  assert.ok(closeMethod.indexOf("await closeAeroWindow(windowElement)") < closeMethod.indexOf("windowElement.hidden = true"));
  assert.ok(closeMethod.indexOf("await closeAeroWindow(windowElement)") < closeMethod.indexOf("windowElement.remove()"));
});
