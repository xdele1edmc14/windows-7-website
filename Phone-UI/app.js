(function initializeIOSSetup(window, document) {
  "use strict";

  const Framework7 = window.Framework7;
  const {
    GREETINGS,
    GREETING_LANGUAGES,
    animateSpring,
    commitDesktopPhase,
    preloadImageAssets,
    resolveSwipeRelease,
    rubberBandTranslation,
    shouldDismissSwipe,
    waitForBootReady
  } = window.IOSBootCore;

  const UI_IMAGE_ASSETS = Object.freeze([
    "../assets/Phone-UI/apple_logo.jpg",
    "../assets/Phone-UI/ios-wallpaper.svg"
  ]);

  const root = document.querySelector("#ios-app");
  const welcomeScreen = root.querySelector("[data-welcome-screen]");
  const desktopScreen = root.querySelector("[data-desktop-screen]");
  const greeting = root.querySelector("[data-greeting]");
  const developmentCard = root.querySelector("[data-development-card]");
  const phaseAnnouncement = root.querySelector("[data-phase-announcement]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopFrame = window.matchMedia(
    "(min-width: 700px) and (hover: hover) and (pointer: fine)"
  );

  const framework7 = new Framework7({
    el: root,
    id: "com.nullpointer.ios-setup",
    name: "iOS Setup",
    theme: "ios",
    touch: {
      disableContextMenu: true,
      tapHold: false
    }
  });

  let phase = "boot";
  let greetingIndex = 0;
  let greetingInterval;
  let greetingTransitionTimer;
  let activePointerId = null;
  let pointerStartY = 0;
  let pointerLastY = 0;
  let pointerLastTime = 0;
  let gestureStartOffset = 0;
  let velocityY = 0;
  let currentOffset = 0;
  let pendingOffset = 0;
  let renderFrame = 0;
  let activeSpring = null;
  let activeSpringTarget = 0;
  let activeSpringCompletion;
  let suppressNextClick = false;
  let clickSuppressionTimer;

  const fontPreloaderPromise = document.fonts?.load
    ? document.fonts.load('24px "Framework7 Icons"')
    : Promise.resolve([]);

  const assetPreloaderPromise = Promise.all([
    preloadImageAssets(UI_IMAGE_ASSETS),
    fontPreloaderPromise
  ]);

  function syncDesktopClass() {
    root.classList.toggle("is-desktop-frame", desktopFrame.matches);
  }

  function setPhase(nextPhase, announcement) {
    phase = nextPhase;
    root.setAttribute("data-phase", nextPhase);
    document.body.setAttribute("data-phase", nextPhase);
    phaseAnnouncement.textContent = announcement;
  }

  function renderWelcomeOffset(offset) {
    currentOffset = offset;
    pendingOffset = offset;
    welcomeScreen.style.setProperty("--welcome-y", `${offset}px`);
  }

  function scheduleWelcomeOffset(offset) {
    pendingOffset = offset;
    if (renderFrame) return;

    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      renderWelcomeOffset(pendingOffset);
    });
  }

  function stopGreetingCycle() {
    window.clearInterval(greetingInterval);
    window.clearTimeout(greetingTransitionTimer);
    greetingInterval = undefined;
    greetingTransitionTimer = undefined;
    greeting.classList.remove("is-changing");
  }

  function showNextGreeting() {
    if (phase !== "welcome" || activePointerId !== null) return;

    greeting.classList.add("is-changing");
    greetingTransitionTimer = window.setTimeout(() => {
      greetingIndex = (greetingIndex + 1) % GREETINGS.length;
      greeting.textContent = GREETINGS[greetingIndex];
      greeting.setAttribute("lang", GREETING_LANGUAGES[greetingIndex]);
      greeting.classList.remove("is-changing");
    }, 390);
  }

  function startGreetingCycle() {
    stopGreetingCycle();
    if (reducedMotion.matches || phase !== "welcome") return;
    greetingInterval = window.setInterval(showNextGreeting, 1800);
  }

  function triggerCommittedHaptic() {
    if (typeof navigator.vibrate === "function") navigator.vibrate(10);
  }

  function commitUnlock() {
    if (phase === "desktop") return;

    stopGreetingCycle();
    activeSpring = null;
    activeSpringCompletion = undefined;
    phase = "desktop";
    commitDesktopPhase({
      root,
      body: document.body,
      welcomeScreen,
      desktopScreen,
      announcement: phaseAnnouncement,
      developmentCard
    });
    triggerCommittedHaptic();
  }

  function cancelActiveSpring() {
    activeSpring?.cancel();
    activeSpring = null;
    activeSpringCompletion = undefined;
  }

  function springWelcomeTo(target, { onComplete, initialVelocity = velocityY } = {}) {
    cancelActiveSpring();
    activeSpringTarget = target;

    const complete = () => {
      activeSpring = null;
      activeSpringCompletion = undefined;
      onComplete?.();
    };
    activeSpringCompletion = complete;

    if (reducedMotion.matches) {
      renderWelcomeOffset(target);
      complete();
      return;
    }

    activeSpring = animateSpring({
      from: currentOffset,
      to: target,
      initialVelocity,
      stiffness: 350,
      damping: 34,
      onUpdate: renderWelcomeOffset,
      onComplete: complete
    });
  }

  function releasePointer(pointerId) {
    activePointerId = null;
    if (welcomeScreen.hasPointerCapture?.(pointerId)) {
      welcomeScreen.releasePointerCapture(pointerId);
    }
    welcomeScreen.classList.remove("is-dragging");
  }

  function clearClickSuppressionSoon() {
    window.clearTimeout(clickSuppressionTimer);
    clickSuppressionTimer = window.setTimeout(() => {
      suppressNextClick = false;
    }, 0);
  }

  function flushPendingOffset() {
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
      renderFrame = 0;
    }
    renderWelcomeOffset(pendingOffset);
  }

  function completePointerGesture(event) {
    if (event.pointerId !== activePointerId) return;

    const pointerId = activePointerId;
    const release = resolveSwipeRelease({
      startY: pointerStartY,
      startOffset: gestureStartOffset,
      lastY: pointerLastY,
      lastTimestamp: pointerLastTime,
      velocityY,
      releaseY: event.clientY,
      releaseTimestamp: event.timeStamp
    });
    pendingOffset = release.translationY;
    velocityY = release.velocityY;
    flushPendingOffset();
    const finalOffset = pendingOffset;
    const height = welcomeScreen.getBoundingClientRect().height;
    const shouldDismiss = shouldDismissSwipe({
      translationY: finalOffset,
      velocityY,
      height
    });

    releasePointer(pointerId);
    clearClickSuppressionSoon();

    if (shouldDismiss) {
      springWelcomeTo(-height - 36, { onComplete: commitUnlock });
      return;
    }

    springWelcomeTo(0, {
      initialVelocity: velocityY,
      onComplete: startGreetingCycle
    });
  }

  function cancelPointerGesture(event) {
    if (event.pointerId !== activePointerId) return;

    const pointerId = activePointerId;
    flushPendingOffset();
    suppressNextClick = true;
    releasePointer(pointerId);
    clearClickSuppressionSoon();
    springWelcomeTo(0, {
      initialVelocity: 0,
      onComplete: startGreetingCycle
    });
  }

  welcomeScreen.addEventListener("pointerdown", (event) => {
    if (phase !== "welcome" || activePointerId !== null) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    cancelActiveSpring();
    stopGreetingCycle();
    window.clearTimeout(clickSuppressionTimer);
    suppressNextClick = false;
    activePointerId = event.pointerId;
    pointerStartY = event.clientY;
    pointerLastY = event.clientY;
    pointerLastTime = event.timeStamp;
    gestureStartOffset = currentOffset;
    velocityY = 0;
    welcomeScreen.classList.add("is-dragging");
    welcomeScreen.setPointerCapture(event.pointerId);
  });

  welcomeScreen.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;

    const elapsed = Math.max(1, event.timeStamp - pointerLastTime);
    const sampledVelocity = (event.clientY - pointerLastY) / elapsed;
    velocityY = velocityY * 0.28 + sampledVelocity * 0.72;
    pointerLastY = event.clientY;
    pointerLastTime = event.timeStamp;

    const translationY = gestureStartOffset + event.clientY - pointerStartY;
    if (Math.abs(event.clientY - pointerStartY) > 8) suppressNextClick = true;
    scheduleWelcomeOffset(rubberBandTranslation(translationY));
  });

  welcomeScreen.addEventListener("pointerup", completePointerGesture);
  welcomeScreen.addEventListener("pointercancel", cancelPointerGesture);

  welcomeScreen.addEventListener("lostpointercapture", (event) => {
    if (event.pointerId !== activePointerId) return;
    cancelPointerGesture(event);
  });

  function activateWelcome() {
    if (phase !== "welcome") return;

    stopGreetingCycle();
    springWelcomeTo(-welcomeScreen.getBoundingClientRect().height - 36, {
      initialVelocity: -0.7,
      onComplete: commitUnlock
    });
  }

  welcomeScreen.addEventListener("click", (event) => {
    if (suppressNextClick) {
      event.preventDefault();
      suppressNextClick = false;
      return;
    }
    activateWelcome();
  });

  welcomeScreen.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowUp":
      case "Enter":
      case " ":
        event.preventDefault();
        activateWelcome();
        break;
      default:
        break;
    }
  });

  reducedMotion.addEventListener?.("change", () => {
    if (reducedMotion.matches) {
      stopGreetingCycle();
      if (activeSpring) {
        const target = activeSpringTarget;
        const complete = activeSpringCompletion;
        activeSpring.cancel();
        activeSpring = null;
        renderWelcomeOffset(target);
        complete?.();
      }
      return;
    }
    startGreetingCycle();
  });

  desktopFrame.addEventListener?.("change", syncDesktopClass);
  syncDesktopClass();

  async function startBootSequence() {
    try {
      await waitForBootReady(assetPreloaderPromise);
      setPhase("welcome", "Welcome to iPhone. Swipe up to open.");
      welcomeScreen.setAttribute("aria-hidden", "false");
      startGreetingCycle();
    } catch (error) {
      document.body.setAttribute("data-boot-error", "true");
      console.error("iOS setup could not preload every UI asset.", error);
    }
  }

  void framework7;
  void startBootSequence();
})(window, document);
