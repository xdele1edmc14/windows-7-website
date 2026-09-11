const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { CONTROL_PANEL_ITEMS } = require("../control-panel.js");

const projectRoot = path.join(__dirname, "..");
const read = (fileName) => fs.readFileSync(path.join(projectRoot, fileName), "utf8");
const toDiskPath = (assetUrl) => path.join(projectRoot, assetUrl.replace(/^\.\//, ""));
const existsWithExactCase = (assetUrl) => {
  const parts = assetUrl.replace(/^\.\//, "").split("/");
  let currentPath = projectRoot;
  for (const part of parts) {
    if (!fs.readdirSync(currentPath).includes(part)) return false;
    currentPath = path.join(currentPath, part);
  }
  return fs.existsSync(currentPath);
};

const sourceFilesWithShellAssets = [
  "index.html",
  "index.js",
  "control-panel.js",
  "paint.js",
  "notepad.js",
  "photo-viewer.js",
  "desktop.css",
  "control-panel.css",
  "paint.css",
  "notepad.css",
  "photo-viewer.css"
];

const referencedShellAssets = () => {
  const paths = sourceFilesWithShellAssets.flatMap((fileName) => {
    const matches = read(fileName).matchAll(/["'`]((?:\.\/)?(?:assets|cursors)\/[^"'`)]+)["'`)]/g);
    return [...matches]
      .map((match) => match[1])
      .filter((assetUrl) => !assetUrl.includes("${"))
      .map((assetUrl) => assetUrl.startsWith("./") ? assetUrl : `./${assetUrl}`);
  });
  return [...new Set(paths)].sort();
};

test("production uses a deployable local copy of 7.css", () => {
  const html = read("index.html");
  const stylesheet = html.match(/<link rel="stylesheet" href="([^"]*7\.css)">/)?.[1];

  assert.equal(stylesheet, "./vendor/7.css");
  assert.equal(fs.existsSync(toDiskPath(stylesheet)), true, `${stylesheet} must exist`);

  assert.equal(existsWithExactCase(stylesheet), true, `${stylesheet} must preserve exact casing`);
  assert.equal(
    createHash("sha256").update(fs.readFileSync(toDiskPath(stylesheet))).digest("hex"),
    "7449894044051ef07ed0fc2c2d92178f265f76b0ec4e91de4517f0740bea8379",
    "the vendored stylesheet must remain the verified 7.css 0.21.1 build"
  );
});

test("the boot manifest covers every non-theme shell asset reference", () => {
  const { NON_THEME_BOOT_ASSETS } = require("../boot-assets.js");
  const manifest = new Set(NON_THEME_BOOT_ASSETS);

  assert.deepEqual(
    referencedShellAssets().filter((assetUrl) => !manifest.has(assetUrl)),
    [],
    "every shell image, cursor, and sound must enter the initial boot preload"
  );
  assert.equal(manifest.has("./assets/architecture.jpg"), false, "optional theme media stays lazy");
  assert.equal(manifest.has("./assets/landscape.jpg"), false, "optional theme media stays lazy");
  assert.equal(manifest.has("./assets/nature.jpg"), false, "optional theme media stays lazy");
  assert.equal(manifest.has("./assets/architecture.mp3"), false, "optional theme media stays lazy");
  assert.equal(manifest.has("./assets/landscape.mp3"), false, "optional theme media stays lazy");
  assert.equal(manifest.has("./assets/nature.mp3"), false, "optional theme media stays lazy");
  assert.equal(manifest.has("./assets/Windows Logon Sound.wav"), false, "optional theme media stays lazy");
  assert.deepEqual(
    CONTROL_PANEL_ITEMS.map(({ icon }) => icon).filter((assetUrl) => !manifest.has(assetUrl)),
    [],
    "every exported Control Panel icon must enter the initial boot preload"
  );
});

test("every boot asset exists with production-safe casing and is not ignored", () => {
  const { NON_THEME_BOOT_ASSETS } = require("../boot-assets.js");

  for (const assetUrl of NON_THEME_BOOT_ASSETS) {
    assert.equal(existsWithExactCase(assetUrl), true, `${assetUrl} must exist with exact casing`);
  }

  const relativePaths = NON_THEME_BOOT_ASSETS.map((assetUrl) => assetUrl.replace(/^\.\//, ""));
  const ignored = spawnSync("git", ["check-ignore", "--", ...relativePaths], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "NUL" }
  });
  assert.equal(ignored.status, 1, `boot assets must not be ignored:\n${ignored.stdout}`);
});

test("the desktop boot gate consumes the shared non-theme manifest", () => {
  const html = read("index.html");
  const source = read("index.js");

  assert.ok(html.indexOf("./boot-assets.js?v=20260816-1") < html.indexOf("./index.js?v=20260819-1"));
  assert.match(source, /window\.Windows7BootAssets/);
  assert.match(source, /NON_THEME_BOOT_ASSETS/);
  assert.match(source, /await Promise\.allSettled/);
});
