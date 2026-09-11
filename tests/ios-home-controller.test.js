const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../Phone-UI/home-core.js');
const source = fs.readFileSync(require('node:path').join(__dirname, '../Phone-UI/app.js'), 'utf8');

// Execute the real controller functions with deterministic layout/event stubs.
// These regressions exercise transition ownership; browser QA covers rendering.
function extract(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, 'controller function boundaries must exist');
  return source.slice(from, to);
}
function fixture(extra = {}) {
  const calls = [];
  const context = {
    ...core, calls, W: 393, H: 852, scale: 1, screen: 'home', page: 1,
    closingApp: false, unlocking: false, searchTarget: 0, gesture: null,
    frame: { clientWidth: 430, clientHeight: 932 },
    root: { style: { setProperty() {} }, hasPointerCapture: () => false },
    spotlight: { hidden: true }, animations: new Map(),
    searchInvoker: { focus: () => calls.push('search-focus') },
    $: () => ({ focus: () => calls.push('app-focus') }),
    cancel: name => calls.push('cancel-' + name),
    stopHold() {}, fullFrame: () => ({ width: 430 }),
    renderPage: value => calls.push(['page', value]),
    renderApp: () => calls.push('render-app'),
    finishClose: () => calls.push('finish-close'),
    renderLock: () => calls.push('render-lock'),
    finishUnlock: () => calls.push('finish-unlock'),
    renderDepth: () => calls.push('depth'),
    renderSearch: value => calls.push(['search', value]),
    hideSearchImmediately: () => calls.push('hide-search'),
    ...extra
  };
  vm.createContext(context);
  return context;
}
const resizeSource = extract('  function resize() {', '  window.addEventListener("resize", resize);');
function resize(context) { vm.runInContext(resizeSource + '\nresize();', context); }

test('resize completes an app dismissal instead of resurrecting fullscreen', () => {
  const c = fixture({ screen: 'app', closingApp: true });
  resize(c);
  assert.ok(c.calls.includes('finish-close'));
  assert.ok(!c.calls.includes('render-app'));
});
test('resize during opening restores focus inside the app', () => {
  const c = fixture({ screen: 'app' });
  resize(c);
  assert.ok(c.calls.includes('render-app'));
  assert.ok(c.calls.includes('app-focus'));
});
test('keyboard-induced resize preserves Spotlight dismissal', () => {
  const c = fixture({ spotlight: { hidden: false }, searchTarget: 0 });
  resize(c);
  assert.ok(c.calls.includes('hide-search'));
  assert.ok(c.calls.includes('search-focus'));
  assert.equal(c.searchTarget, 0);
});
test('resize keeps an open Spotlight visible', () => {
  const c = fixture({ spotlight: { hidden: false }, searchTarget: 1 });
  resize(c);
  assert.ok(c.calls.some(call => Array.isArray(call) && call[0] === 'search' && call[1] === 1));
  assert.ok(!c.calls.includes('hide-search'));
});
test('resize completes a committed unlock', () => {
  const c = fixture({ screen: 'lock', unlocking: true });
  resize(c);
  assert.ok(c.calls.includes('finish-unlock'));
  assert.ok(!c.calls.includes('render-lock'));
});
test('hidden iframe zero geometry does not corrupt logical dimensions', () => {
  const c = fixture({ frame: { clientWidth: 0, clientHeight: 0 } });
  resize(c);
  assert.equal(c.W, 393);
  assert.equal(c.H, 852);
});
test('F2 cannot enter background editing while a modal owns focus', () => {
  const handlerSource = extract('  document.addEventListener("keydown", event => {', '  function updateClock()');
  for (const overlay of ['search', 'remove']) {
    let handler, edits = 0;
    const c = fixture({
      document: { addEventListener: (_, fn) => { handler = fn; } },
      spotlight: { hidden: overlay !== 'search' },
      removeBackdrop: { hidden: overlay !== 'remove' },
      setEditing: () => { edits++; }, editing: false
    });
    vm.runInContext(handlerSource, c);
    handler({ key: 'F2', preventDefault() {} });
    assert.equal(edits, 0);
  }
});
test('small movement after a hold cannot revive old flick velocity', () => {
  const c = fixture({
    gesture: { id: 1, mode: 'ignored', startX: 0, startY: 100, lastX: 0, lastY: 60, lastTime: 20, vx: 0, vy: -3, moved: true },
    localPoint: event => ({ x: event.clientX, y: event.clientY })
  });
  vm.runInContext(extract('  function moveGesture(event) {', '  root.addEventListener("pointermove", moveGesture);'), c);
  c.moveGesture({ pointerId: 1, clientX: 0, clientY: 59, timeStamp: 240 });
  assert.ok(Math.abs(c.gesture.vy) < .01);
});
test('ignored drag after grabbing a settling page still snaps it into place', () => {
  const c = fixture({
    gesture: { id: 1, mode: 'ignored', vx: 0, vy: 0, lastTime: 20 },
    moveGesture() {}, performance: { now: () => 20 },
    settlePage: page => c.calls.push(['settle', page])
  });
  vm.runInContext(extract('  function endGesture(event, cancelled = false) {', '  root.addEventListener("pointerup"'), c);
  c.endGesture({ pointerId: 1, timeStamp: 20 });
  assert.ok(c.calls.some(call => Array.isArray(call) && call[0] === 'settle' && call[1] === 1));
});
