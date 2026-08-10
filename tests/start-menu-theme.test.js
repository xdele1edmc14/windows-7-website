const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const read = (fileName) => fs.readFileSync(path.join(projectRoot, fileName), "utf8");

test("the Start menu loads the current theme-aware shell assets", () => {
  const html = read("index.html");

  assert.match(html, /\.\/desktop\.css\?v=20260810-1/);
  assert.match(html, /\.\/themes\.js\?v=20260810-1/);
});

test("Aero Start menu surfaces consume theme variables while the apps pane stays white", () => {
  const css = read("desktop.css");

  assert.match(
    css,
    /\[data-theme="windows-7"\] \.start-menu,[\s\S]*?linear-gradient\(var\(--theme-shell-light\), var\(--theme-shell-mid\) 52%, var\(--theme-shell-dark\)\) !important;/
  );
  assert.match(
    css,
    /\) \.start-menu__system \{[\s\S]*?rgba\(var\(--theme-accent-rgb\),\.38\)[\s\S]*?var\(--theme-shell-light\), var\(--theme-shell-dark\)/
  );
  assert.match(
    css,
    /\[data-theme="nature"\] \.start-menu__apps \{\s*background: #fff !important;/
  );
});
