const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

test("the login password field uses a dark text color on its white surface", () => {
  const passwordInput = source.match(/const password = createElement\("input", \{[\s\S]*?\n      \}\);/);

  assert.ok(passwordInput, "the login password input must exist");
  assert.match(passwordInput[0], /color:\s*"#1b1b1b"/i);
});
