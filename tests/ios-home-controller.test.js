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
    closingApp: false, openingHome: false, welcomeY: 0, lockY: -852, searchTarget: 0, gesture: null, resizePending: false,
    frame: { clientWidth: 430, clientHeight: 932 },
    root: { dataset: {}, style: { setProperty() {} }, hasPointerCapture: () => false },
    spotlight: { hidden: true }, animations: new Map(),
    searchInvoker: { focus: () => calls.push('search-focus') },
    $: () => ({ focus: () => calls.push('app-focus') }),
    cancel: name => calls.push('cancel-' + name),
    stopHold() {}, fullFrame: () => ({ width: 430 }),
    renderPage: value => calls.push(['page', value]),
    renderApp: () => calls.push('render-app'),
    finishClose: () => calls.push('finish-close'),
    renderLock: () => calls.push('render-lock'),
    renderWelcome: () => calls.push('render-welcome'),
    finishWelcome: () => calls.push('finish-welcome'),
    finishNotificationClose: () => calls.push('finish-notification-close'),
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
test('resize completes a committed Welcome dismissal', () => {
  const c = fixture({ screen: 'welcome', openingHome: true });
  resize(c);
  assert.ok(c.calls.includes('finish-welcome'));
  assert.ok(!c.calls.includes('render-welcome'));
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

// Model the browser boundary: touch implicitly captures the child, then the
// next pointer event transfers capture to the screen and bubbles loss from it.
function welcomeTouchFixture() {
  const handlers = {}, child = { closest: () => null };
  let captured = false;
  const root = {
    dataset: {}, style: { setProperty() {} },
    addEventListener: (name, fn) => { handlers[name] = fn; },
    setPointerCapture: () => { captured = true; },
    hasPointerCapture: () => captured,
    releasePointerCapture: () => { captured = false; }
  };
  const c = fixture({
    root, screen: 'welcome', welcome: { style: {} }, home: { inert: true },
    removeBackdrop: { hidden: true }, pageX: 0, searchProgress: 0, appFrame: null,
    localPoint: event => ({ x: event.clientX, y: event.clientY }),
    performance: { now: () => 200 },
    stopGreetingCycle() {}, announce() {}, resize() {},
    spring: (channel, from, to, velocity, render, done) => { render(to); done?.(); }
  });
  vm.runInContext(extract('  function setScreen(value)', '  function cancel('), c);
  vm.runInContext(extract('  function renderWelcome(y)', '  function showWelcome()'), c);
  vm.runInContext(extract('  function finishWelcome()', '  function renderLock('), c);
  vm.runInContext(extract('  root.addEventListener("pointerdown"', '  root.addEventListener("contextmenu"'), c);
  const event = (y, timeStamp, target = child) => ({
    pointerId: 7, pointerType: 'touch', isPrimary: true, target,
    clientX: 196, clientY: y, timeStamp
  });
  return { c, handlers, child, event, loseRootCapture: () => { captured = false; } };
}

test('Hello follows touch and reaches Home after implicit child capture transfers to root', () => {
  const { c, handlers, event } = welcomeTouchFixture();
  handlers.pointerdown(event(780, 0));
  handlers.pointermove(event(760, 20));
  assert.equal(c.welcomeY, -20, 'Hello follows the finger before release');
  handlers.lostpointercapture(event(760, 21)); // bubbles from touched child
  handlers.pointermove(event(660, 100));
  assert.equal(c.welcomeY, -120, 'capture handoff must not reset the drag');
  handlers.pointerup(event(650, 110));
  assert.equal(c.screen, 'home');
  assert.equal(c.home.inert, false);
  assert.equal(c.gesture, null);
});

test('genuine root capture loss cancels Hello without opening Home', () => {
  const { c, handlers, event, loseRootCapture } = welcomeTouchFixture();
  handlers.pointerdown(event(780, 0));
  handlers.pointermove(event(660, 100));
  loseRootCapture();
  handlers.lostpointercapture(event(660, 101, c.root));
  assert.equal(c.gesture, null);
  assert.equal(c.welcomeY, 0);
  assert.equal(c.screen, 'welcome');
});

test('OS pointer cancellation returns Hello instead of committing a fast swipe', () => {
  const { c, handlers, event } = welcomeTouchFixture();
  handlers.pointerdown(event(780, 0));
  handlers.pointermove(event(660, 50));
  handlers.pointercancel(event(650, 60));
  assert.equal(c.gesture, null);
  assert.equal(c.welcomeY, 0);
  assert.equal(c.screen, 'welcome');
});

test('short slow Hello drag settles back instead of accidentally opening Home', () => {
  const { c, handlers, event } = welcomeTouchFixture();
  handlers.pointerdown(event(780, 0));
  handlers.pointermove(event(760, 200));
  handlers.pointerup(event(760, 400));
  assert.equal(c.welcomeY, 0);
  assert.equal(c.screen, 'welcome');
});

test('browser viewport resize leaves an active Hello touch in its original coordinates', () => {
  const gesture = { id: 7, mode: 'welcome' };
  const c = fixture({ screen: 'welcome', welcomeY: -50, gesture });
  resize(c);
  assert.equal(c.gesture, gesture);
  assert.equal(c.welcomeY, -50);
  assert.equal(c.scale, 1);
  assert.equal(c.resizePending, true);
});

test('viewport resize deferred during touch is applied after release', () => {
  const { c, handlers, event } = welcomeTouchFixture();
  let applied = 0;
  c.resize = () => { applied++; };
  handlers.pointerdown(event(780, 0));
  c.resizePending = true;
  handlers.pointermove(event(660, 100));
  handlers.pointerup(event(650, 110));
  assert.equal(applied, 1);
  assert.equal(c.resizePending, false);
  assert.equal(c.screen, 'home');
});
