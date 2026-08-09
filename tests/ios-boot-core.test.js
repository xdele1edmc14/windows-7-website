const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const corePath = path.join(__dirname, "..", "Phone-UI", "ios-boot-core.js");
const loadCore = () => require(corePath);

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test("the classic boot core exposes its real API without a module loader", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "Phone-UI", "ios-boot-core.js"),
    "utf8"
  );
  const browserGlobal = {};

  vm.runInNewContext(source, browserGlobal, { filename: "ios-boot-core.js" });

  assert.equal(typeof browserGlobal.IOSBootCore.preloadImageAssets, "function");
  assert.equal(typeof browserGlobal.IOSBootCore.waitForBootReady, "function");
  assert.equal(typeof browserGlobal.IOSBootCore.resolveSwipeRelease, "function");
});

test("image preloading resolves only after every real onload callback", async () => {
  const { preloadImageAssets } = await loadCore();

  class FakeImage {
    static instances = [];

    constructor() {
      FakeImage.instances.push(this);
    }

    set src(value) {
      this.currentSrc = value;
    }
  }

  let settled = false;
  const loading = preloadImageAssets(["logo.jpg", "wallpaper.svg"], FakeImage);
  loading.then(() => {
    settled = true;
  });

  assert.deepEqual(
    FakeImage.instances.map((image) => image.currentSrc),
    ["logo.jpg", "wallpaper.svg"]
  );

  FakeImage.instances[0].onload();
  await flushMicrotasks();
  assert.equal(settled, false, "one loaded image must not release the boot gate");

  FakeImage.instances[1].onload();
  const loadedUrls = await loading;

  assert.equal(settled, true);
  assert.deepEqual(loadedUrls, ["logo.jpg", "wallpaper.svg"]);
});

test("image preloading identifies the asset that failed", async () => {
  const { preloadImageAssets } = await loadCore();

  class FailingImage {
    static instance;

    constructor() {
      FailingImage.instance = this;
    }

    set src(value) {
      this.currentSrc = value;
    }
  }

  const loading = preloadImageAssets(["missing-wallpaper.jpg"], FailingImage);
  FailingImage.instance.onerror();

  await assert.rejects(loading, /missing-wallpaper\.jpg/);
});

test("boot readiness waits for both all assets and the exact five-second delay", async () => {
  const { waitForBootReady } = await loadCore();
  let releaseAssets;
  let releaseDelay;
  let requestedDelay;
  let settled = false;
  const assets = new Promise((resolve) => {
    releaseAssets = () => resolve(["logo", "wallpaper"]);
  });

  const ready = waitForBootReady(assets, {
    setTimer(resolve, delay) {
      requestedDelay = delay;
      releaseDelay = resolve;
      return 1;
    }
  });
  ready.then(() => {
    settled = true;
  });

  assert.equal(requestedDelay, 5000);
  releaseDelay();
  await flushMicrotasks();
  assert.equal(settled, false, "the timer alone must not release the boot gate");

  releaseAssets();
  const [loadedUrls] = await ready;
  assert.equal(settled, true);
  assert.deepEqual(loadedUrls, ["logo", "wallpaper"]);
});

test("boot readiness also stays pending when assets finish before the delay", async () => {
  const { waitForBootReady } = await loadCore();
  let releaseDelay;
  let settled = false;
  const ready = waitForBootReady(Promise.resolve(["logo", "wallpaper"]), {
    setTimer(resolve, delay) {
      assert.equal(delay, 5000);
      releaseDelay = resolve;
      return 1;
    }
  });
  ready.then(() => {
    settled = true;
  });

  await flushMicrotasks();
  assert.equal(settled, false, "loaded assets must still wait for the minimum timer");

  releaseDelay();
  await ready;
  assert.equal(settled, true);
});

test("greetings and language metadata preserve the approved display order", async () => {
  const { GREETINGS, GREETING_LANGUAGES } = await loadCore();

  assert.deepEqual(GREETINGS, [
    "Hello",
    "Hola",
    "Bonjour",
    "Ciao",
    "Hallo",
    "Olá",
    "Namaste",
    "Konnichiwa",
    "Guten Tag",
    "Salam"
  ]);
  assert.deepEqual(GREETING_LANGUAGES, [
    "en",
    "es",
    "fr",
    "it",
    "de",
    "pt",
    "hi-Latn",
    "ja-Latn",
    "de",
    "ar-Latn"
  ]);
});

test("rubber banding preserves upward manipulation and resists downward drag", async () => {
  const { rubberBandTranslation } = await loadCore();

  assert.equal(rubberBandTranslation(-148), -148);
  assert.equal(rubberBandTranslation(0), 0);
  assert.ok(rubberBandTranslation(240) > 0);
  assert.ok(rubberBandTranslation(240) < 80);
  assert.ok(rubberBandTranslation(480) < rubberBandTranslation(240) * 1.7);
});

test("swipe commitment uses projected velocity as well as distance", async () => {
  const { projectSwipe, shouldDismissSwipe } = await loadCore();

  assert.equal(projectSwipe(-40, -0.8, 180), -184);
  assert.equal(
    shouldDismissSwipe({ translationY: -40, velocityY: -0.8, height: 844 }),
    true,
    "a short but decisive upward flick should open"
  );
  assert.equal(
    shouldDismissSwipe({ translationY: -210, velocityY: 0.1, height: 844 }),
    true,
    "a deliberate drag past the distance threshold should open"
  );
  assert.equal(
    shouldDismissSwipe({ translationY: -46, velocityY: -0.08, height: 844 }),
    false,
    "a short slow drag should spring back"
  );
  assert.equal(
    shouldDismissSwipe({ translationY: 80, velocityY: -1.4, height: 844 }),
    false,
    "a drag that never moved upward should not open"
  );
});

test("release sampling includes terminal movement and expires stale flick velocity", async () => {
  const { resolveSwipeRelease, shouldDismissSwipe } = await loadCore();

  const terminalFlick = resolveSwipeRelease({
    startY: 600,
    startOffset: 0,
    lastY: 582,
    lastTimestamp: 100,
    velocityY: -0.4,
    releaseY: 455,
    releaseTimestamp: 116
  });
  assert.equal(terminalFlick.translationY, -145);
  assert.equal(terminalFlick.velocityY, -3);
  assert.equal(
    shouldDismissSwipe({ ...terminalFlick, height: 844 }),
    true,
    "movement present only on pointerup must still commit"
  );

  const heldFlick = resolveSwipeRelease({
    startY: 600,
    startOffset: 0,
    lastY: 560,
    lastTimestamp: 100,
    velocityY: -1.2,
    releaseY: 560,
    releaseTimestamp: 350
  });
  assert.equal(heldFlick.translationY, -40);
  assert.equal(heldFlick.velocityY, 0);
  assert.equal(
    shouldDismissSwipe({ ...heldFlick, height: 844 }),
    false,
    "a short flick held before release must not unlock on stale velocity"
  );

  const heldFlickWithJitter = resolveSwipeRelease({
    startY: 600,
    startOffset: 0,
    lastY: 560,
    lastTimestamp: 100,
    velocityY: -3,
    releaseY: 559,
    releaseTimestamp: 350
  });
  assert.ok(heldFlickWithJitter.velocityY > -0.01);
  assert.equal(
    shouldDismissSwipe({ ...heldFlickWithJitter, height: 844 }),
    false,
    "release jitter after a hold must not revive the old flick velocity"
  );
});

test("desktop phase commit updates accessibility state and restores focus", async () => {
  const { commitDesktopPhase } = await loadCore();
  const createElement = () => ({
    attributes: new Map(),
    setAttribute(name, value) {
      this.attributes.set(name, value);
    }
  });
  const root = createElement();
  const body = createElement();
  const welcomeScreen = createElement();
  const desktopScreen = createElement();
  const announcement = { textContent: "" };
  let focusOptions;
  const developmentCard = {
    focus(options) {
      focusOptions = options;
    }
  };

  commitDesktopPhase({
    root,
    body,
    welcomeScreen,
    desktopScreen,
    announcement,
    developmentCard
  });

  assert.equal(root.attributes.get("data-phase"), "desktop");
  assert.equal(body.attributes.get("data-phase"), "desktop");
  assert.equal(welcomeScreen.attributes.get("aria-hidden"), "true");
  assert.equal(desktopScreen.attributes.get("aria-hidden"), "false");
  assert.equal(announcement.textContent, "iPhone desktop opened");
  assert.deepEqual(focusOptions, { preventScroll: true });
});

test("the spring converges on its target and can be interrupted", async () => {
  const { animateSpring } = await loadCore();
  const frames = [];
  const updates = [];
  let completedAt;

  const spring = animateSpring({
    from: -96,
    to: 0,
    initialVelocity: 0,
    onUpdate(value) {
      updates.push(value);
    },
    onComplete(value) {
      completedAt = value;
    },
    requestFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    cancelFrame() {}
  });

  for (let frame = 0; frame < 360 && completedAt === undefined; frame += 1) {
    const callback = frames.shift();
    assert.ok(callback, "spring should request another animation frame while unsettled");
    callback(frame * 16.667);
  }

  assert.equal(completedAt, 0);
  assert.equal(updates.at(-1), 0);
  assert.ok(updates.some((value) => value > -48));

  const queuedBeforeCancel = frames.length;
  spring.cancel();
  assert.equal(frames.length, queuedBeforeCancel);

  const interruptFrames = [];
  let interruptedCompletion = false;
  const interruptible = animateSpring({
    from: -20,
    to: 0,
    onUpdate() {},
    onComplete() {
      interruptedCompletion = true;
    },
    requestFrame(callback) {
      interruptFrames.push(callback);
      return interruptFrames.length;
    },
    cancelFrame() {}
  });

  interruptible.cancel();
  interruptFrames.shift()(16.667);
  assert.equal(interruptedCompletion, false);
});

test("the spring normalizes impossible synthetic pointer velocities", async () => {
  const { animateSpring } = await loadCore();
  const frames = [];
  const updates = [];
  let completedAt;

  animateSpring({
    from: -340,
    to: -698,
    initialVelocity: -72,
    onUpdate(value) {
      updates.push(value);
    },
    onComplete(value) {
      completedAt = value;
    },
    requestFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    cancelFrame() {}
  });

  for (let frame = 0; frame < 120 && completedAt === undefined; frame += 1) {
    const callback = frames.shift();
    assert.ok(callback, "spring should keep scheduling until it settles");
    callback(frame * 16.667);
  }

  assert.equal(completedAt, -698);
  assert.ok(updates.every(Number.isFinite));
  assert.ok(updates[1] > -500, "the first frame must preserve a physically plausible trajectory");
  assert.ok(Math.min(...updates) > -900, "synthetic timing must not throw the sheet far offscreen");
});
