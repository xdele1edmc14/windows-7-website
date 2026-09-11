const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const read = (fileName) => fs.readFileSync(path.join(projectRoot, fileName), "utf8");

test("the Start menu loads the current theme-aware shell assets", () => {
  const html = read("index.html");

  assert.match(html, /\.\/desktop\.css\?v=20260815-1/);
  assert.match(html, /\.\/themes\.js\?v=20260810-1/);
});

test("the stock Windows 7 Start menu retains its original slate gradient", () => {
  const css = read("desktop.css");

  assert.match(
    css,
    /\.start-menu \{[\s\S]*?linear-gradient\(#64879a 0, #496b7c 48%, #31576c 100%\);/
  );
});

test("alternate Start menus alone use a translucent Aero gradient that darkens at 65%", () => {
  const css = read("desktop.css");

  assert.match(
    css,
    /#windows-7-root\[data-theme="architecture"\] \.start-menu,\s*#windows-7-root\[data-theme="landscape"\] \.start-menu,\s*#windows-7-root\[data-theme="nature"\] \.start-menu \{[\s\S]*?rgba\(var\(--theme-accent-rgb\), 0\.65\) 65%[\s\S]*?backdrop-filter: blur\(12px\) saturate\(120%\) !important;/
  );
  assert.doesNotMatch(
    css,
    /#windows-7-root\[data-theme="windows-7"\] \.start-menu,[\s\S]*?rgba\(var\(--theme-accent-rgb\), 0\.65\) 65%/
  );
});
