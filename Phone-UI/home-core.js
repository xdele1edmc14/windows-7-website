(function exposeIOSHomeCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.IOSHomeCore = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function createIOSHomeCore() {
  "use strict";

  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const frameFields = ["x", "y", "width", "height", "radius", "progress"];

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
  }

  // Guessed feel constant: .55 initial response, approaching the limit asymptotically.
  function rubberBand(value, limit = 393) {
    limit = Math.max(0, finite(limit));
    value = finite(value);
    if (!limit || !value) return 0;
    return Math.sign(value) * limit * (1 - 1 / (1 + Math.abs(value) * 0.55 / limit));
  }

  // Track X and velocity are negative toward later pages; velocity is in px/ms.
  function resolvePage({ offset = 0, velocity = 0, width, count }) {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(count) || count < 1) return 0;
    const projected = finite(offset) + finite(velocity) * 180;
    return clamp(Math.round(-projected / width), 0, Math.floor(count) - 1);
  }

  // Tunable gesture thresholds, not measured platform constants. Upward is positive.
  // A downward velocity contributes no forward projection; callers expire stale samples.
  function shouldClose({ distance = 0, velocity = 0 }) {
    distance = finite(distance);
    velocity = finite(velocity);
    return distance > 120 || distance + Math.max(0, velocity) * 180 > 160 ||
      (distance >= 12 && velocity > 0.55);
  }

  // Keep samples through 80ms, then linearly fade to zero at 120ms (same clock).
  function releaseVelocity({ velocity, lastTime, time }) {
    if (!Number.isFinite(lastTime) || !Number.isFinite(time)) return 0;
    const age = Math.max(0, time - lastTime);
    return finite(velocity) * (1 - clamp((age - 80) / 40));
  }

  // dx/dy are screen-coordinate displacement since pointerdown (upward dy is negative).
  // startFrame is a complete frame captured on interruption. Scaling is relative to it,
  // with a .45 minimum of that starting size. Its bottom center follows dx/dy exactly.
  function getCloseFrame({ width, height, dx = 0, dy = 0, startFrame }) {
    width = Math.max(0, finite(width));
    height = Math.max(0, finite(height));
    dx = finite(dx);
    dy = finite(dy);
    const base = startFrame || { x: 0, y: 0, width, height, radius: 0, progress: 0 };
    const distance = Math.max(0, -dy);
    const scale = height > 0 ? Math.max(0.45, 1 - distance / height * 0.8) : 1;
    const amount = clamp((1 - scale) / 0.55);
    const nextWidth = base.width * scale;
    const nextHeight = base.height * scale;
    return {
      x: base.x + dx + (base.width - nextWidth) / 2,
      y: base.y + dy + base.height - nextHeight,
      width: nextWidth,
      height: nextHeight,
      // Guessed card rounding at maximum shrink; preserve interruption rounding.
      radius: base.radius + (Math.max(44, base.radius) - base.radius) * amount,
      progress: base.progress + (1 - base.progress) * amount
    };
  }

  // t is clamped so animation scheduling cannot extrapolate past either frame.
  function mixFrame(from, to, t) {
    t = clamp(t);
    const frame = {};
    for (const field of frameFields) {
      frame[field] = from[field] + (to[field] - from[field]) * t;
    }
    return frame;
  }

  // CSS-style cubic Bezier: solve x(parameter)=time, then evaluate y(parameter).
  // Control x values must lie in [0,1]. Bisection also handles flat end derivatives.
  function cubicBezier(x1, y1, x2, y2) {
    if (![x1, y1, x2, y2].every(Number.isFinite) || x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
      throw new RangeError("Bezier controls must be finite and x controls within [0, 1].");
    }
    const sample = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
    return function ease(time) {
      time = clamp(time);
      if (time === 0 || time === 1) return time;
      let low = 0;
      let high = 1;
      for (let i = 0; i < 32; i++) {
        const middle = (low + high) / 2;
        if (sample(middle, x1, x2) < time) low = middle;
        else high = middle;
      }
      return sample((low + high) / 2, y1, y2);
    };
  }

  return Object.freeze({ clamp, rubberBand, resolvePage, shouldClose, releaseVelocity, getCloseFrame, mixFrame, cubicBezier });
});
