(function initializeAeroWindowMotion(host, factory) {
  const api = factory(host);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (host) {
    host.Windows7AeroWindowMotion = Object.freeze(api);
  }
})(typeof window !== "undefined" ? window : globalThis, (host) => {
  "use strict";

  const AERO_CLOSE_DURATION_MS = 180;
  const AERO_OPEN_DURATION_MS = 200;

  const createAeroWindowMotion = ({
    setTimer = (callback, delay) => host.setTimeout(callback, delay),
    clearTimer = (timer) => host.clearTimeout(timer),
    prefersReducedMotion = () => host.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  } = {}) => {
    const pendingOpenings = new WeakMap();
    const pendingClosings = new WeakMap();

    const startMotion = (element, {
      animationName,
      className,
      duration,
      pending,
      opposing
    }) => {
      const existing = pending.get(element);
      if (existing) return existing.promise;

      opposing.get(element)?.finish();

      let resolveMotion;
      let timer = null;
      const promise = new Promise((resolve) => {
        resolveMotion = resolve;
      });
      const finish = () => {
        if (pending.get(element)?.promise !== promise) return;
        if (timer !== null) clearTimer(timer);
        element.removeEventListener("animationend", handleAnimationEnd);
        element.classList.remove(className, "is-window-animating");
        pending.delete(element);
        resolveMotion();
      };
      const handleAnimationEnd = (event) => {
        if (event.target === element && event.animationName === animationName) finish();
      };

      element.classList.add(className, "is-window-animating");
      pending.set(element, { finish, promise });

      if (prefersReducedMotion()) {
        finish();
        return promise;
      }

      element.addEventListener("animationend", handleAnimationEnd);
      timer = setTimer(finish, duration);
      return promise;
    };

    const openAeroWindow = (element) => startMotion(element, {
      animationName: "aeroOpen",
      className: "opening",
      duration: AERO_OPEN_DURATION_MS,
      pending: pendingOpenings,
      opposing: pendingClosings
    });

    const closeAeroWindow = (element) => startMotion(element, {
      animationName: "aeroClose",
      className: "closing",
      duration: AERO_CLOSE_DURATION_MS,
      pending: pendingClosings,
      opposing: pendingOpenings
    });

    return { closeAeroWindow, openAeroWindow };
  };

  return {
    AERO_CLOSE_DURATION_MS,
    AERO_OPEN_DURATION_MS,
    createAeroWindowMotion,
    ...createAeroWindowMotion()
  };
});
