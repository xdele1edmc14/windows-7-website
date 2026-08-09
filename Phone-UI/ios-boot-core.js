(function exposeIOSBootCore(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.IOSBootCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createIOSBootCore() {
  "use strict";

  const GREETINGS = Object.freeze([
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

  const GREETING_LANGUAGES = Object.freeze([
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

  function preloadImageAssets(urls, ImageCtor = globalThis.Image) {
    if (typeof ImageCtor !== "function") {
      return Promise.reject(new Error("Image loading is unavailable in this environment."));
    }

    return Promise.all(
      urls.map(
        (url) =>
          new Promise((resolve, reject) => {
            const image = new ImageCtor();
            image.onload = () => resolve(url);
            image.onerror = () => reject(new Error(`Unable to preload UI asset: ${url}`));
            image.decoding = "async";
            image.src = url;
          })
      )
    );
  }

  function waitForBootReady(
    assetPreloaderPromise,
    { setTimer = globalThis.setTimeout, minimumDelayMs = 5000 } = {}
  ) {
    return Promise.all([
      assetPreloaderPromise,
      new Promise((resolve) => setTimer(resolve, minimumDelayMs))
    ]);
  }

  function rubberBandTranslation(translationY) {
    if (translationY <= 0) return translationY;

    const resistanceLimit = 96;
    return resistanceLimit * (1 - Math.exp(-translationY / 360));
  }

  function projectSwipe(translationY, velocityY, horizonMs = 180) {
    return translationY + velocityY * horizonMs;
  }

  function shouldDismissSwipe({ translationY, velocityY, height }) {
    if (translationY >= -16) return false;

    const distanceThreshold = Math.min(190, Math.max(120, height * 0.22));
    const projectedThreshold = Math.min(240, Math.max(160, height * 0.28));
    const projectedTranslation = projectSwipe(translationY, velocityY);

    return (
      translationY <= -distanceThreshold ||
      projectedTranslation <= -projectedThreshold ||
      (translationY <= -28 && velocityY <= -0.55)
    );
  }

  function resolveSwipeRelease({
    startY,
    startOffset = 0,
    lastY,
    lastTimestamp,
    velocityY,
    releaseY,
    releaseTimestamp
  }) {
    const elapsed = Math.max(0, releaseTimestamp - lastTimestamp);
    const releaseDelta = releaseY - lastY;
    let resolvedVelocity = velocityY;

    if (elapsed > 80) {
      resolvedVelocity = Math.abs(releaseDelta) >= 0.5 ? releaseDelta / elapsed : 0;
    } else if (elapsed > 0 && Math.abs(releaseDelta) >= 0.5) {
      const terminalSample = releaseDelta / elapsed;
      resolvedVelocity = velocityY * 0.2 + terminalSample * 0.8;
    } else if (elapsed > 0) {
      resolvedVelocity *= Math.max(0, 1 - elapsed / 120);
    }

    return {
      translationY: rubberBandTranslation(startOffset + releaseY - startY),
      velocityY: Math.max(-3, Math.min(3, resolvedVelocity))
    };
  }

  function commitDesktopPhase({
    root,
    body,
    welcomeScreen,
    desktopScreen,
    announcement,
    developmentCard
  }) {
    root.setAttribute("data-phase", "desktop");
    body.setAttribute("data-phase", "desktop");
    welcomeScreen.setAttribute("aria-hidden", "true");
    desktopScreen.setAttribute("aria-hidden", "false");
    announcement.textContent = "iPhone desktop opened";
    developmentCard.focus({ preventScroll: true });
  }

  function animateSpring({
    from,
    to,
    initialVelocity = 0,
    stiffness = 360,
    damping = 36,
    mass = 1,
    onUpdate,
    onComplete,
    requestFrame = globalThis.requestAnimationFrame,
    cancelFrame = globalThis.cancelAnimationFrame
  }) {
    let position = from;
    let velocity = Math.max(-3, Math.min(3, initialVelocity)) * 1000;
    let lastTimestamp;
    let frameId;
    let cancelled = false;

    const finish = () => {
      position = to;
      velocity = 0;
      onUpdate(to);
      onComplete?.(to);
    };

    const step = (timestamp) => {
      if (cancelled) return;

      const elapsed =
        lastTimestamp === undefined ? 1 / 60 : Math.min((timestamp - lastTimestamp) / 1000, 1 / 30);
      const deltaTime = Math.max(elapsed, 1 / 240);
      lastTimestamp = timestamp;

      const displacement = position - to;
      const acceleration = (-stiffness * displacement - damping * velocity) / mass;
      velocity += acceleration * deltaTime;
      position += velocity * deltaTime;
      onUpdate(position);

      if (Math.abs(position - to) <= 0.15 && Math.abs(velocity) <= 3) {
        finish();
        return;
      }

      frameId = requestFrame(step);
    };

    onUpdate(position);
    frameId = requestFrame(step);

    return {
      cancel() {
        if (cancelled) return;
        cancelled = true;
        if (frameId !== undefined) cancelFrame(frameId);
      }
    };
  }

  return Object.freeze({
    GREETINGS,
    GREETING_LANGUAGES,
    animateSpring,
    commitDesktopPhase,
    preloadImageAssets,
    resolveSwipeRelease,
    rubberBandTranslation,
    shouldDismissSwipe,
    waitForBootReady,
    projectSwipe
  });
});
