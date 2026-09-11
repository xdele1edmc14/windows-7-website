const test = require('node:test');
const assert = require('node:assert/strict');
const { createResponsiveShell } = require('../responsive-shell.js');

function fixture(narrow = false) {
  const listeners = {};
  const element = () => ({ hidden: false, inert: false, style: {}, dataset: {}, attrs: {}, setAttribute(k,v) { this.attrs[k] = v; }, focus() {}, append() {} });
  const windowsRoot = element(), phone = element(), html = element();
  const media = { matches: narrow, addEventListener(_, fn) { listeners.change = fn; } };
  let boots = 0;
  const activities = [];
  const window = { matchMedia: () => media, innerWidth: narrow ? 393 : 1200, innerHeight: 852, addEventListener(type, fn) { listeners[type] = fn; } };
  const document = { documentElement: html, activeElement: null, title: '', addEventListener() {} };
  const shell = createResponsiveShell({ window, document, windowsRoot, phone });
  shell.registerWindows(() => { boots++; return { setPresentationActive: active => activities.push(active) }; });
  function resize(width) { window.innerWidth = width; media.matches = width < 700; listeners.resize(); }
  return { shell, phone, windowsRoot, html, activities, resize, boots: () => boots };
}

test('mobile first loads only the phone, Windows starts on first wide viewport', () => {
  const f = fixture(true);
  assert.equal(f.boots(), 0);
  assert.equal(f.phone.attrs.src, './Phone-UI/index.html');
  assert.equal(f.windowsRoot.inert, true);
  assert.equal(f.html.dataset.experience, 'iphone');
  f.resize(700);
  assert.equal(f.boots(), 1);
  assert.equal(f.phone.hidden, true);
  assert.equal(f.windowsRoot.inert, false);
});

test('repeated size changes preserve both runtimes and do not reset iframe src', () => {
  const f = fixture();
  assert.equal(f.boots(), 1);
  assert.equal(f.phone.attrs.src, undefined);
  f.resize(699);
  let writes = 0;
  f.phone.setAttribute = () => { writes++; };
  f.resize(700); f.resize(393); f.resize(1200);
  assert.equal(f.boots(), 1);
  assert.equal(writes, 0);
  assert.equal(f.html.dataset.experience, 'windows');
  assert.ok(f.activities.includes(false));
  assert.equal(f.activities.at(-1), true);
});
