const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const corePath = path.join(__dirname, "..", "Phone-UI", "home-core.js");
const loadCore = () => require(corePath);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test("home math is usable through CommonJS and a classic browser script", () => {
  assert.ok(fs.existsSync(corePath), "home-core.js must exist");
  const browser = {};
  browser.window = browser;
  vm.runInNewContext(fs.readFileSync(corePath, "utf8"), browser);
  for (const name of ["clamp", "rubberBand", "resolvePage", "shouldClose", "releaseVelocity", "getCloseFrame", "mixFrame", "cubicBezier"]) {
    assert.equal(typeof loadCore()[name], "function");
    assert.equal(typeof browser.IOSHomeCore[name], "function");
  }
  assert.equal(browser.IOSHomeCore.resolvePage({ offset: -300, velocity: 0, width: 393, count: 3 }), 1);
});

test("clamp preserves in-range values and clips both bounds", () => {
  const { clamp } = loadCore();
  assert.deepEqual([-2, 0, 0.4, 1, 2].map(value => clamp(value)), [0, 0, 0.4, 1, 1]);
  assert.equal(clamp(-9, -4, 8), -4);
  assert.equal(clamp(12, -4, 8), 8);
});

test("rubber banding is symmetric, bounded, and progressively harder to stretch", () => {
  const { rubberBand } = loadCore();
  assert.equal(rubberBand(0), 0);
  const a = rubberBand(100), b = rubberBand(200), c = rubberBand(300);
  assert.ok(a > 0 && a < 100);
  assert.ok(b > a && c > b && c - b < b - a);
  assert.equal(rubberBand(-200), -b);
  assert.ok(rubberBand(1e8) < 393);
  assert.ok(rubberBand(1000, 50) < 50);
  assert.equal(rubberBand(100, 0), 0);
  assert.equal(rubberBand(-100, -1), 0);
});

test("page snapping uses track direction and 180ms velocity projection", () => {
  const { resolvePage } = loadCore();
  for (const [offset, velocity, expected] of [[-190, 0, 0], [-210, 0, 1], [-110, -0.6, 1], [-290, 0.6, 0], [-800, 0, 2]]) {
    assert.equal(resolvePage({ offset, velocity, width: 400, count: 4 }), expected);
  }
});

test("page snapping cannot overscroll and handles unavailable layout", () => {
  const { resolvePage } = loadCore();
  assert.equal(resolvePage({ offset: 1000, velocity: 2, width: 400, count: 3 }), 0);
  assert.equal(resolvePage({ offset: -3000, velocity: -2, width: 400, count: 3 }), 2);
  for (const [width, count] of [[0, 3], [-1, 3], [NaN, 3], [Infinity, 3], [400, 0], [400, 1]]) {
    assert.equal(resolvePage({ offset: -300, velocity: -1, width, count }), 0);
  }
});

test("close distinguishes slow cancellation, deliberate distance, and short flicks", () => {
  const { shouldClose } = loadCore();
  for (const [distance, velocity, expected] of [[45, 0.08, false], [120, 0, false], [121, -0.2, true], [12, 0.56, true], [12, 0.55, false], [11, 0.56, false], [80, 0.45, true], [70, 0.5, false], [40, -2, false], [-30, -1, false]]) {
    assert.equal(shouldClose({ distance, velocity }), expected, `distance=${distance}, velocity=${velocity}`);
  }
});

test("release velocity keeps fresh samples, fades after 80ms, and expires at 120ms", () => {
  const { releaseVelocity } = loadCore();
  for (const [age, expected] of [[0, 1.2], [80, 1.2], [100, 0.6], [120, 0], [500, 0]]) {
    near(releaseVelocity({ velocity: 1.2, lastTime: 100, time: 100 + age }), expected);
    near(releaseVelocity({ velocity: -1.2, lastTime: 100, time: 100 + age }), -expected);
  }
  assert.equal(releaseVelocity({ velocity: 1, lastTime: 100, time: 90 }), 1);
});

test("holding a short flick cancels instead of closing on stale velocity", () => {
  const { shouldClose, releaseVelocity } = loadCore();
  assert.equal(shouldClose({ distance: 40, velocity: 1.2 }), true);
  assert.equal(shouldClose({ distance: 40, velocity: releaseVelocity({ velocity: 1.2, lastTime: 100, time: 250 }) }), false);
});

test("close frame starts full size without a positional jump", () => {
  assert.deepEqual(loadCore().getCloseFrame({ width: 400, height: 800, dx: 0, dy: 0 }), {
    x: 0, y: 0, width: 400, height: 800, radius: 0, progress: 0
  });
});

test("upward shrink stays anchored to the moving bottom center", () => {
  const { getCloseFrame } = loadCore();
  const frame = getCloseFrame({ width: 400, height: 800, dx: 30, dy: -200 });
  near(frame.width, 320);
  near(frame.height, 640);
  near(frame.x + frame.width / 2, 230);
  near(frame.y + frame.height, 600);
  assert.ok(frame.progress > 0 && frame.progress < 1);
  assert.ok(frame.radius > 0);
  const further = getCloseFrame({ width: 400, height: 800, dx: 30, dy: -300 });
  assert.ok(further.width < frame.width && further.progress > frame.progress);
});

test("close scale stops at .45 and downward motion never enlarges the app", () => {
  const { getCloseFrame } = loadCore();
  const far = getCloseFrame({ width: 400, height: 800, dy: -2000 });
  near(far.width, 180);
  near(far.height, 360);
  assert.equal(far.progress, 1);
  const down = getCloseFrame({ width: 400, height: 800, dy: 40 });
  assert.equal(down.width, 400);
  assert.equal(down.height, 800);
  assert.equal(down.progress, 0);
});

test("interrupted frames resume without a jump and keep their bottom anchor", () => {
  const { getCloseFrame } = loadCore();
  const startFrame = Object.freeze({ x: 30, y: 70, width: 320, height: 640, radius: 18, progress: 0.25 });
  assert.deepEqual(getCloseFrame({ width: 400, height: 800, startFrame }), startFrame);
  const next = getCloseFrame({ width: 400, height: 800, startFrame, dx: -10, dy: -100 });
  near(next.x + next.width / 2, 180);
  near(next.y + next.height, 610);
  assert.ok(next.width < startFrame.width);
  assert.ok(next.progress > startFrame.progress);
});

test("degenerate viewport sizes produce finite nonnegative geometry", () => {
  for (const [width, height] of [[0, 0], [-1, -2], [400, 0], [0, 800], [NaN, Infinity]]) {
    const frame = loadCore().getCloseFrame({ width, height, dx: 10, dy: -200 });
    assert.ok(Object.values(frame).every(Number.isFinite));
    assert.ok(frame.width >= 0 && frame.height >= 0 && frame.radius >= 0);
    assert.ok(frame.progress >= 0 && frame.progress <= 1);
  }
});

test("frame interpolation includes all six fields without mutating endpoints", () => {
  const { mixFrame } = loadCore();
  const from = Object.freeze({ x: 0, y: 20, width: 400, height: 800, radius: 0, progress: 0 });
  const to = Object.freeze({ x: 100, y: -20, width: 40, height: 80, radius: 40, progress: 1 });
  assert.deepEqual(mixFrame(from, to, 0), from);
  assert.deepEqual(mixFrame(from, to, 1), to);
  assert.deepEqual(mixFrame(from, to, 0.25), { x: 25, y: 10, width: 310, height: 620, radius: 10, progress: 0.25 });
});

test("bezier solves time along the x curve and stays monotonic without bounce", () => {
  const { cubicBezier } = loadCore();
  const ease = cubicBezier(0.2, 0.8, 0.2, 1);
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  near(ease(0.275), 0.8); // Parametric t=.5 gives x=.275 and y=.8.
  let previous = 0;
  for (let i = 1; i <= 1000; i++) {
    const value = ease(i / 1000);
    assert.ok(value >= previous && value <= 1);
    previous = value;
  }
  const linear = cubicBezier(0, 0, 1, 1);
  near(linear(0.37), 0.37);
  assert.equal(ease(-1), 0);
  assert.equal(ease(2), 1);
});
