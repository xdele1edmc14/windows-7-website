(function initializePhone(window, document) {
  "use strict";
  const { clamp, rubberBand, resolvePage, classifyHomeGesture, shouldClose, releaseVelocity, getCloseFrame, mixFrame, cubicBezier } = window.IOSHomeCore;
  const { GREETINGS, GREETING_LANGUAGES, animateSpring, waitForBootReady } = window.IOSBootCore;
  const $ = (selector) => document.querySelector(selector);
  const root = $("#ios-app"), frame = $(".iphone-frame"), home = $("#home-screen"), welcome = $("#welcome-screen");
  const depth = $(".home-depth"), track = $("#page-track"), lock = $("#lock-screen");
  const surface = $("#app-surface"), spotlight = $(".spotlight"), input = $(".spotlight input");
  const removeBackdrop = $(".remove-backdrop"), announcement = $("#announcement");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  // Framework7 Core owns the iOS runtime. Custom system gestures deliberately
  // bypass its page router: SpringBoard morphs are not pushed app-navigation pages.
  const framework7 = window.Framework7 ? new window.Framework7({
    el: root, id: "com.nullpointer.iphone", name: "iPhone", theme: "ios",
    touch: { fastClicks: false, tapHold: false, disableContextMenu: true }
  }) : null;
  if (!framework7) console.warn("Bundled Framework7 runtime unavailable; the boot screen will offer Retry.");

  let W = 393, H = 852, scale = 1, screen = "boot", page = 0, pageX = 0;
  let closingApp = false, openingHome = false;
  let editing = false, activeApp = null, origin = null, appFrame = null;
  let welcomeY = 0, lockY = -H, searchProgress = 0, searchTarget = 0, searchInvoker = null;
  let removeId = null, removeInvoker = null, gesture = null, holdTimer = 0;
  let suppressClickUntil = 0, lastClock = "", greetingIndex = 0, greetingTimer = 0;
  const animations = new Map();
  // User-specified fast-out, zero-overshoot open. 400ms is within the 350–450ms brief.
  const openEase = cubicBezier(.2, .8, .2, 1);
  const palette = ["#e87b6c", "#53657d", "#f2a34e", "#268ee7", "#7c7f8b", "#bd78bd", "#418efa", "#f5486d", "#24c767", "#477fea", "#259cba", "#e35473", "#7468ed", "#323747", "#d18850", "#669dc8"];
  const names = [
    ["Photos", "Camera", "Clock", "Store", "Settings", "Gallery", "Messenger", "Video", "Chat", "Social", "Energy", "Pins", "Community", "Clips", "Authenticator", "Assistant"],
    ["Weather", "Stocks", "Find", "Books", "Fitness", "Watch", "Contacts", "Files", "Preview", "Utilities", "Studio", "Translate", "Canvas", "Journal", "Tips", "Feedback", "Friends", "Browser", "Mail", "Notebook", "Editor", "Audio", "Scanner", "Messages"],
    ["Travel", "Wallet", "Reminders", "Notes", "Podcasts", "Health", "Home", "Shortcuts", "Measure", "Compass", "Recorder", "Calendar", "Reading", "Sketch", "Tasks", "Recipes", "Places", "Focus", "Learning", "Archive", "Music", "Timer", "Documents", "Explore"]
  ];
  const apps = new Map();
  const firstPositions = [[1,1],[2,1],[1,2],[2,2],[3,3],[4,3],[3,4],[4,4],[1,5],[2,5],[3,5],[4,5],[1,6],[2,6],[3,6],[4,6]];
  const sampleBadges = { "0-4": 1, "0-6": 8, "0-7": 28, "0-8": 188, "0-9": 39, "0-11": 11, "0-13": 4, "dock-2": 518 };
  names.forEach((list, p) => list.forEach((name, i) => apps.set(p + "-" + i, {
    id: p + "-" + i, name, color: palette[(i + p * 5) % palette.length], page: p, index: i, removed: false
  })));
  ["Phone", "Safari", "Messages", "Music"].forEach((name, i) => apps.set("dock-" + i, {
    id: "dock-" + i, name, color: ["#29ce50","#269eea","#3dc759","#f74276"][i], page: "dock", index: i, removed: false
  }));

  function icon(app, suggested = false) {
    const cell = document.createElement("div");
    cell.className = "icon-cell";
    cell.dataset.appId = app.id;
    cell.style.setProperty("--app-color", app.color);
    // Stable varied phases avoid re-randomizing the animation on every render.
    cell.style.setProperty("--wiggle-delay", (-((app.index * 137) % 500) / 1000) + "s");
    cell.style.setProperty("--wiggle-duration", (.24 + (app.index % 5) * .017) + "s");
    const button = document.createElement("button");
    button.className = "app-icon";
    button.setAttribute("aria-label", app.name);
    const swatch = document.createElement("span");
    swatch.className = "icon-swatch";
    swatch.textContent = app.name[0];
    swatch.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "icon-label";
    label.textContent = app.name;
    button.append(swatch, label);
    cell.append(button);
    if (!suggested) {
      const remove = document.createElement("button");
      remove.className = "delete-badge";
      remove.setAttribute("aria-label", "Remove " + app.name);
      remove.tabIndex = editing ? 0 : -1;
      cell.append(remove);
      if (sampleBadges[app.id]) {
        const badge = document.createElement("span");
        badge.className = "notification-badge";
        badge.textContent = sampleBadges[app.id];
        cell.append(badge);
      }
    }
    return cell;
  }

  function widgets(grid) {
    const battery = document.createElement("div");
    battery.className = "widget battery-widget";
    battery.setAttribute("aria-label", "Batteries, 73 percent");
    battery.innerHTML = '<div class="battery-ring"><svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="30" pathLength="100"/><circle cx="36" cy="36" r="30" pathLength="100"/></svg><i class="f7-icons" aria-hidden="true">device_phone_portrait</i></div><span class="battery-value">73%</span><span class="widget-caption">Batteries</span>';
    const clock = document.createElement("div");
    clock.className = "widget clock-widget";
    clock.setAttribute("aria-label", "Clock");
    clock.innerHTML = '<div class="clock-bezel"><div class="clock-dial"><span class="clock-city">CUP</span><span class="clock-hand clock-hour"></span><span class="clock-hand clock-minute"></span><span class="clock-hand clock-second"></span><span class="clock-pin"></span></div></div><span class="widget-caption">Clock</span>';
    const face = clock.querySelector(".clock-dial");
    for (let i = 0; i < 60; i++) {
      const tick = document.createElement("span");
      tick.className = "clock-tick" + (i % 5 ? "" : " major");
      tick.style.transform = "rotate(" + i * 6 + "deg)";
      face.prepend(tick);
    }
    for (let i = 1; i <= 12; i++) {
      const number = document.createElement("span");
      number.className = "clock-number";
      number.textContent = i;
      number.style.left = 50 + Math.sin(i * Math.PI / 6) * 37 + "%";
      number.style.top = 50 - Math.cos(i * Math.PI / 6) * 37 + "%";
      face.append(number);
    }
    grid.append(battery, clock);
  }

  function renderPages() {
    track.replaceChildren();
    $(".dock").replaceChildren();
    for (let p = 0; p < names.length; p++) {
      const section = document.createElement("section");
      section.className = "home-page";
      section.setAttribute("aria-label", "Home Screen page " + (p + 1));
      const grid = document.createElement("div");
      grid.className = "icon-grid";
      if (p === 0) widgets(grid);
      for (const app of apps.values()) {
        if (app.page !== p || app.removed) continue;
        const cell = icon(app);
        const [col, row] = p === 0 ? firstPositions[app.index] : [app.index % 4 + 1, Math.floor(app.index / 4) + 1];
        cell.style.gridColumn = col;
        cell.style.gridRow = row;
        grid.append(cell);
      }
      section.append(grid);
      track.append(section);
    }
    for (const app of apps.values()) if (app.page === "dock" && !app.removed) $(".dock").append(icon(app));
    $(".page-dots").replaceChildren();
    names.forEach((_, index) => {
      const dot = document.createElement("button");
      dot.className = "page-dot";
      dot.setAttribute("aria-label", "Page " + (index + 1));
      dot.addEventListener("click", () => settlePage(index));
      $(".page-dots").append(dot);
    });
    syncPages();
    updateClock();
  }

  function announce(text) { announcement.textContent = text; }
  function setScreen(value) { screen = value; root.dataset.screen = value; }
  function cancel(channel) { animations.get(channel)?.cancel(); animations.delete(channel); }
  function tween(channel, duration, render, done, ease = openEase) {
    cancel(channel);
    if (reduced.matches) { render(1); done?.(); return; }
    let raf = 0, started;
    const task = { cancel() { cancelAnimationFrame(raf); } };
    animations.set(channel, task);
    function step(time) {
      started ??= time;
      const t = clamp((time - started) / duration);
      render(ease(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else { animations.delete(channel); done?.(); }
    }
    render(0);
    raf = requestAnimationFrame(step);
  }
  function spring(channel, from, to, velocity, render, done) {
    cancel(channel);
    if (reduced.matches) { render(to); done?.(); return; }
    // Tuned approximation, not a claim of private UIKit constants. Settles in
    // roughly 300–450ms depending on travel; initialVelocity is logical pt/ms.
    animations.set(channel, animateSpring({
      from, to, initialVelocity: velocity, stiffness: 620, damping: 46,
      onUpdate: render, onComplete() { animations.delete(channel); done?.(); }
    }));
  }

  function renderDepth(recession) {
    recession = clamp(recession);
    depth.style.transform = "scale(" + (1 - .05 * recession) + ")";
    depth.style.filter = "blur(" + (reduced.matches ? 0 : 4 * recession) + "px)";
  }
  function renderPage(x) { pageX = x; track.style.transform = "translate3d(" + x + "px,0,0)"; }
  function syncPages() {
    [...track.children].forEach((el, i) => { el.inert = i !== page; el.setAttribute("aria-hidden", String(i !== page)); });
    document.querySelectorAll(".page-dot").forEach((el, i) => {
      if (i === page) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current");
    });
  }
  function settlePage(index, velocity = 0) {
    page = clamp(index, 0, names.length - 1);
    syncPages();
    spring("page", pageX, -page * W, velocity, renderPage);
  }
  function paintGreeting() {
    const greeting = $(".welcome-greeting");
    greeting.textContent = GREETINGS[greetingIndex];
    greeting.lang = GREETING_LANGUAGES[greetingIndex];
    greeting.dir = GREETING_LANGUAGES[greetingIndex] === "ar" ? "rtl" : "auto";
    greeting.classList.remove("is-writing");
    // Restart the one-shot write-on mask after replacing the language.
    void greeting.offsetWidth;
    greeting.classList.add("is-writing");
  }
  function startGreetingCycle() {
    clearInterval(greetingTimer);
    greetingIndex = 0;
    paintGreeting();
    if (!reduced.matches) greetingTimer = setInterval(() => {
      greetingIndex = (greetingIndex + 1) % GREETINGS.length;
      paintGreeting();
    }, 1900); // Estimated from the supplied setup recording.
  }
  function stopGreetingCycle() { clearInterval(greetingTimer); greetingTimer = 0; }
  function renderWelcome(y) {
    welcomeY = Math.min(0, y);
    const progress = clamp(-welcomeY / H);
    welcome.style.transform = "translate3d(0," + welcomeY + "px,0)";
    welcome.style.opacity = 1 - progress * .16;
    renderDepth(1 - progress);
  }
  function showWelcome() {
    welcome.hidden = false;
    welcome.inert = false;
    home.inert = true;
    setScreen("welcome");
    renderWelcome(0);
    startGreetingCycle();
    announce("Hello. Swipe up to open Home Screen.");
  }
  function finishWelcome() {
    openingHome = false;
    cancel("welcome");
    stopGreetingCycle();
    welcome.hidden = true;
    welcome.inert = true;
    welcome.style.opacity = "";
    home.inert = false;
    setScreen("home");
    renderDepth(0);
    announce("Home Screen");
    $(".search-launcher").focus({ preventScroll: true });
  }
  function openHome() {
    if (screen !== "welcome") return;
    openingHome = true;
    spring("welcome", welcomeY, -H, -1, renderWelcome, finishWelcome);
  }
  function renderLock(y) {
    lockY = clamp(y, -H, 0);
    lock.style.transform = "translate3d(0," + lockY + "px,0)";
    renderDepth(1 - clamp(-lockY / (H * .45)));
  }
  function prepareNotification() {
    if (!lock.hidden) return;
    setEditing(false);
    lock.hidden = false;
    lock.inert = false;
    home.inert = true;
    setScreen("notification");
    renderLock(-H);
  }
  function finishNotificationOpen() {
    setScreen("notification");
    renderLock(0);
    announce("Clock and Notifications");
  }
  function openNotification(velocity = 0) {
    spring("lock", lockY, 0, velocity, renderLock, finishNotificationOpen);
  }
  function finishNotificationClose() {
    cancel("lock");
    lock.hidden = true;
    lock.inert = true;
    home.inert = false;
    setScreen("home");
    renderDepth(0);
    announce("Home Screen");
    $(".search-launcher").focus({ preventScroll: true });
  }
  function closeNotification(velocity = -1) {
    if (screen !== "notification") return;
    spring("lock", lockY, -H, velocity, renderLock, finishNotificationClose);
  }

  function sourceRect(button) {
    // Read the icon in its un-receded home geometry, including after a resize.
    const previous = depth.style.transform;
    depth.style.transform = "none";
    const rect = button.querySelector(".icon-swatch").getBoundingClientRect(), base = root.getBoundingClientRect();
    depth.style.transform = previous;
    return { x: (rect.x - base.x) / scale, y: (rect.y - base.y) / scale, width: rect.width / scale, height: rect.height / scale, radius: 14, progress: 1 };
  }
  function fullFrame() { return { x: 0, y: 0, width: W, height: H, radius: 0, progress: 0 }; }
  function renderApp(next) {
    appFrame = next;
    surface.style.width = next.width + "px";
    surface.style.height = next.height + "px";
    surface.style.transform = "translate3d(" + next.x + "px," + next.y + "px,0)";
    surface.style.borderRadius = next.radius + "px";
    // Preserve the actual initial all the way from swatch to app, with crisp text.
    $(".app-initial").style.fontSize = (32 + 32 * clamp((next.width - 62) / (W - 62))) + "px";
    $("#app-title").style.opacity = clamp((next.width - 100) / 140);
    $(".app-home-target").style.opacity = clamp((next.width - 90) / 180);
    renderDepth(1 - next.progress);
  }
  function openApp(app, button, launchButton = button) {
    if (editing || screen !== "home") return;
    const launchRect = sourceRect(launchButton);
    if (!spotlight.hidden) hideSearchImmediately();
    activeApp = { app, button };
    closingApp = false;
    origin = sourceRect(button);
    home.inert = true;
    surface.hidden = false;
    surface.inert = false;
    surface.style.background = app.color;
    $("#app-title").textContent = app.name;
    $(".app-initial").textContent = app.name[0];
    setScreen("app");
    $(".app-home-target").focus({ preventScroll: true });
    tween("app", 400, t => renderApp(mixFrame(launchRect, fullFrame(), t)), () => {
      $(".app-home-target").focus({ preventScroll: true });
      announce(app.name);
    });
  }
  function finishClose() {
    closingApp = false;
    surface.hidden = true;
    surface.inert = true;
    home.inert = false;
    setScreen("home");
    renderDepth(0);
    activeApp?.button.focus({ preventScroll: true });
    activeApp = null;
    announce("Home Screen");
  }
  function closeApp(velocity = 0) {
    if (!activeApp) return;
    closingApp = true;
    origin = sourceRect(activeApp.button);
    const from = { ...appFrame };
    // Release momentum shortens travel time. A hold has zero expired velocity.
    const duration = clamp(350 - Math.abs(velocity) * 75, 200, 350);
    tween("app", duration, t => renderApp(mixFrame(from, origin, t)), finishClose);
  }
  function restoreApp() {
    closingApp = false;
    const from = { ...appFrame };
    tween("app", 300, t => renderApp(mixFrame(from, fullFrame(), t)));
  }

  function setEditing(value) {
    editing = value;
    root.classList.toggle("is-editing", value);
    $(".done-button").hidden = !value;
    document.querySelectorAll(".delete-badge").forEach(el => { el.tabIndex = value ? 0 : -1; });
    if (value) announce("Editing Home Screen. Select a remove badge or Done.");
  }
  function showRemove(id, invoker) {
    removeId = id; removeInvoker = invoker;
    const app = apps.get(id);
    $("#remove-title").textContent = 'Remove “' + app.name + '”?';
    removeBackdrop.hidden = false;
    home.inert = true;
    $(".remove-cancel").focus();
  }
  function dismissRemove() {
    removeBackdrop.hidden = true;
    home.inert = false;
    removeInvoker?.isConnected && removeInvoker.focus({ preventScroll: true });
    removeId = null;
  }

  function renderSearch(value) {
    searchProgress = clamp(value);
    spotlight.style.opacity = searchProgress;
    $(".spotlight-content").style.transform = "translateY(" + (-28 * (1 - searchProgress)) + "px)";
    renderDepth(searchProgress * .4);
  }
  function prepareSearch(invoker = $(".search-launcher")) {
    if (!spotlight.hidden) return;
    setEditing(false);
    searchInvoker = invoker;
    const suggestions = $(".suggestions");
    suggestions.replaceChildren();
    [...apps.values()].filter(app => !app.removed && app.page === page).slice(0, 4).forEach(app => suggestions.append(icon(app, true)));
    spotlight.hidden = false;
    spotlight.inert = false;
    home.inert = true;
    renderSearch(0);
  }
  function hideSearchImmediately() {
    cancel("search");
    spotlight.hidden = true;
    spotlight.inert = true;
    input.blur();
    input.value = "";
    home.inert = false;
    searchProgress = 0;
    searchTarget = 0;
    renderDepth(0);
  }
  function settleSearch(open, velocity = 0) {
    searchTarget = open ? 1 : 0;
    if (open) {
      prepareSearch();
      // Focus inside the pointer/click event so iOS allows the software keyboard.
      input.focus({ preventScroll: true });
    } else input.blur();
    spring("search", searchProgress * 1000, searchTarget * 1000, velocity * 5,
      value => renderSearch(value / 1000), () => {
        if (!open) { hideSearchImmediately(); searchInvoker?.focus({ preventScroll: true }); }
      });
  }

  function stopHold() { clearTimeout(holdTimer); holdTimer = 0; }
  function localPoint(event) {
    const rect = root.getBoundingClientRect();
    return { x: (event.clientX - rect.x) / scale, y: (event.clientY - rect.y) / scale };
  }
  root.addEventListener("pointerdown", event => {
    root.dataset.input = "pointer";
    if (screen === "boot" || gesture || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0) || !removeBackdrop.hidden) return;
    const target = event.target, point = localPoint(event);
    if (target.closest("input, .spotlight-cancel, .delete-badge, .done-button, .page-dot, .search-launcher, .lock-shortcut")) return;
    let mode = "pending";
    if (screen === "welcome") { mode = "welcome"; openingHome = false; cancel("welcome"); }
    else if (screen === "notification") { mode = "notification-dismiss"; cancel("lock"); }
    else if (screen === "app") {
      // Only the bottom handle/44pt gesture strip initiates closing.
      if (!target.closest(".app-home-target")) return;
      mode = "close"; closingApp = false; cancel("app");
    } else if (!spotlight.hidden) {
      if (target.closest(".app-icon")) return;
      mode = "search-dismiss"; cancel("search");
    } else cancel("page");
    gesture = { id: event.pointerId, mode, startX: point.x, startY: point.y, lastX: point.x, lastY: point.y, lastTime: event.timeStamp, vx: 0, vy: 0, moved: false, basePage: pageX, baseWelcome: welcomeY, baseLock: lockY, baseSearch: searchProgress, baseApp: appFrame ? { ...appFrame } : null };
    const button = target.closest(".app-icon");
    if (mode === "pending" && button && !editing) {
      holdTimer = setTimeout(() => {
        if (!gesture || gesture.moved) return;
        gesture.held = true;
        suppressClickUntil = performance.now() + 800;
        setEditing(true);
      }, 500); // User-specified long press interval.
    }
  });

  function moveGesture(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const g = gesture, point = localPoint(event);
    const dx = point.x - g.startX, dy = point.y - g.startY;
    const dt = Math.max(1, event.timeStamp - g.lastTime);
    if (point.x !== g.lastX || point.y !== g.lastY) {
      // A small move after a hold must not revive the preceding flick sample.
      g.vx = releaseVelocity({ velocity: g.vx, lastTime: g.lastTime, time: event.timeStamp });
      g.vy = releaseVelocity({ velocity: g.vy, lastTime: g.lastTime, time: event.timeStamp });
      g.vx = clamp(g.vx * .25 + (point.x - g.lastX) / dt * .75, -3, 3);
      g.vy = clamp(g.vy * .25 + (point.y - g.lastY) / dt * .75, -3, 3);
      g.lastX = point.x; g.lastY = point.y; g.lastTime = event.timeStamp;
    }
    if (!g.moved && Math.hypot(dx, dy) > 6) {
      g.moved = true;
      stopHold();
      root.setPointerCapture(event.pointerId);
    }
    if (!g.moved || g.held) return;
    if (g.mode === "pending") {
      g.mode = classifyHomeGesture({ width: W, startX: g.startX, startY: g.startY, dx, dy, editing });
      if (g.mode === "search-reveal") prepareSearch();
      if (g.mode === "notification-reveal") { prepareNotification(); g.baseLock = -H; }
    }
    if (g.mode === "page") {
      let x = g.basePage + dx;
      const end = -(names.length - 1) * W;
      if (x > 0) x = rubberBand(x);
      if (x < end) x = end + rubberBand(x - end);
      renderPage(x);
    } else if (g.mode === "welcome") renderWelcome(Math.min(0, g.baseWelcome + dy));
    else if (g.mode === "notification-reveal") renderLock(-H + Math.max(0, dy));
    else if (g.mode === "notification-dismiss") renderLock(g.baseLock + Math.min(0, dy));
    else if (g.mode === "close") renderApp(getCloseFrame({ width: W, height: H, dx, dy: Math.min(0, dy), startFrame: g.baseApp }));
    else if (g.mode === "search-reveal") renderSearch(dy / 160);
    else if (g.mode === "search-dismiss") renderSearch(g.baseSearch + dy / 180);
  }
  root.addEventListener("pointermove", moveGesture);
  function endGesture(event, cancelled = false) {
    if (!gesture || gesture.id !== event.pointerId) return;
    if (!cancelled) moveGesture(event);
    const g = gesture;
    gesture = null; stopHold();
    if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
    if (g.moved || g.held) suppressClickUntil = performance.now() + 350;
    const vx = cancelled ? 0 : releaseVelocity({ velocity: g.vx, lastTime: g.lastTime, time: event.timeStamp });
    const vy = cancelled ? 0 : releaseVelocity({ velocity: g.vy, lastTime: g.lastTime, time: event.timeStamp });
    if (g.mode === "page") {
      // One flick advances at most one page, as in a paged UIScrollView;
      // projection chooses direction, rather than skipping through the catalog.
      const target = resolvePage({ offset: pageX, velocity: vx, width: W, count: names.length });
      settlePage(cancelled ? page : clamp(target, page - 1, page + 1), vx);
    }
    if (g.mode === "pending" || g.mode === "ignored") settlePage(page); // Every interrupted page settles, even after an ignored vertical drag.
    if (g.mode === "welcome") {
      if (!cancelled && shouldClose({ distance: -welcomeY, velocity: -vy })) openHome();
      else spring("welcome", welcomeY, 0, 0, renderWelcome);
    }
    if (g.mode === "notification-reveal") {
      if (!cancelled && shouldClose({ distance: lockY + H, velocity: vy })) openNotification(vy);
      else closeNotification(-Math.abs(vy));
    }
    if (g.mode === "notification-dismiss") {
      if (!cancelled && shouldClose({ distance: -lockY, velocity: -vy })) closeNotification(vy);
      else openNotification(vy);
    }
    if (g.mode === "close") {
      const distance = g.startY - g.lastY;
      if (!cancelled && shouldClose({ distance, velocity: -vy })) closeApp(-vy);
      else restoreApp();
    }
    if (g.mode === "search-reveal") settleSearch(!cancelled && (searchProgress > .4 || vy > .45), vy);
    if (g.mode === "search-dismiss") {
      const open = cancelled || (g.moved && searchProgress > .65 && vy > -.45);
      settleSearch(open, vy);
    }
  }
  root.addEventListener("pointerup", event => endGesture(event));
  root.addEventListener("pointercancel", event => endGesture(event, true));
  root.addEventListener("lostpointercapture", event => endGesture(event, true));
  root.addEventListener("contextmenu", event => event.preventDefault());
  root.addEventListener("click", event => {
    if (performance.now() < suppressClickUntil && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  root.addEventListener("click", event => {
    const button = event.target.closest(".app-icon"), remove = event.target.closest(".delete-badge");
    if (remove) { showRemove(remove.closest(".icon-cell").dataset.appId, remove); return; }
    if (button) {
      const id = button.closest(".icon-cell").dataset.appId;
      // Suggestions open from the touched rect and return to the canonical icon.
      const source = button.closest(".suggestions") ? home.querySelector('[data-app-id="' + id + '"] .app-icon') : button;
      if (source) openApp(apps.get(id), source, button);
      return;
    }
    if (editing && event.target.closest("#home-screen") && !event.target.closest(".done-button, .page-dot")) setEditing(false);
  });
  $(".done-button").addEventListener("click", () => setEditing(false));
  $(".welcome-target").addEventListener("click", openHome);
  $(".notification-dismiss-target").addEventListener("click", () => closeNotification());
  $(".app-home-target").addEventListener("click", () => closeApp());
  $(".search-launcher").addEventListener("click", () => settleSearch(true));
  $(".spotlight-cancel").addEventListener("click", () => settleSearch(false));
  $(".spotlight-form").addEventListener("submit", event => event.preventDefault());
  $(".remove-cancel").addEventListener("click", dismissRemove);
  removeBackdrop.addEventListener("click", event => { if (event.target === removeBackdrop) dismissRemove(); });
  document.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", () => {
    const app = apps.get(removeId);
    if (!app) return;
    // Phase 1 placeholder catalog is session-only. Neither choice touches real apps.
    app.removed = true;
    dismissRemove(); renderPages();
    $(".done-button").focus();
    announce(app.name + (button.dataset.remove === "delete" ? " deleted." : " removed from Home Screen."));
  }));
  $('[aria-label="Flashlight"]').addEventListener("click", event => {
    const button = event.currentTarget;
    button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
  });
  $('[aria-label="Open Camera"]').addEventListener("click", () => {
    finishNotificationClose();
    const button = home.querySelector('[data-app-id="0-1"] .app-icon');
    if (button) openApp(apps.get("0-1"), button);
  });

  document.addEventListener("keydown", event => {
    root.dataset.input = "keyboard";
    if (event.key === "Escape") {
      event.preventDefault();
      if (!removeBackdrop.hidden) dismissRemove();
      else if (!spotlight.hidden) settleSearch(false);
      else if (editing) setEditing(false);
      else if (screen === "app") closeApp();
      else if (screen === "notification") closeNotification();
    }
    if (screen === "welcome" && event.key === "ArrowUp") { event.preventDefault(); openHome(); }
    if (screen === "notification" && event.key === "ArrowUp") { event.preventDefault(); closeNotification(); }
    if (screen === "home" && spotlight.hidden && removeBackdrop.hidden && ["ArrowLeft","ArrowRight"].includes(event.key)) {
      event.preventDefault(); settlePage(page + (event.key === "ArrowRight" ? 1 : -1));
    }
    if (screen === "home" && spotlight.hidden && removeBackdrop.hidden && event.key === "F2") { event.preventDefault(); setEditing(!editing); }
    // Trap keyboard navigation only inside the currently active modal.
    const modal = !removeBackdrop.hidden ? $(".remove-sheet") : !spotlight.hidden ? spotlight : screen === "app" ? surface : screen === "notification" ? lock : null;
    if (event.key === "Tab" && modal) {
      const controls = [...modal.querySelectorAll("button, input")].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });

  function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s*[AP]M$/, "");
    $(".status-time").textContent = time;
    if (time !== lastClock) {
      lastClock = time;
      $(".lock-date").textContent = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace("Sept", "Sep");
      // Screenshot's condensed glass clock is approximated with a stretched mask
      // using system Arial; no proprietary SF font is distributed with this demo.
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 230"><text x="170" y="210" text-anchor="middle" font-family="Arial,sans-serif" font-weight="600" font-size="280" textLength="336" lengthAdjust="spacingAndGlyphs" fill="white">' + time + '</text></svg>';
      $(".lock-clock").style.setProperty("--clock-mask", 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")');
      $(".lock-clock").setAttribute("aria-label", time);
    }
    const sec = now.getSeconds(), min = now.getMinutes() + sec / 60, hour = now.getHours() % 12 + min / 60;
    if ($(".clock-hour")) {
      $(".clock-hour").style.transform = "rotate(" + hour * 30 + "deg)";
      $(".clock-minute").style.transform = "rotate(" + min * 6 + "deg)";
      $(".clock-second").style.transform = "rotate(" + sec * 6 + "deg)";
    }
  }
  function resize() {
    // Fit the reference in BOTH axes. Short/wide mobile browsers get extra
    // wallpaper at the sides, not overlapping rows or stretched app icons.
    const nextScale = Math.min(frame.clientWidth / 393, frame.clientHeight / 852);
    const nextW = frame.clientWidth / nextScale;
    const nextH = frame.clientHeight / nextScale;
    if (!nextScale || (Math.abs(nextScale - scale) < .0001 && Math.abs(nextH - H) < .1 && Math.abs(nextW - W) < .1)) return;
    scale = nextScale; W = nextW; H = nextH;
    root.style.setProperty("--screen-scale", scale);
    root.style.setProperty("--screen-w", W + "px");
    root.style.setProperty("--screen-h", H + "px");
    if (gesture) { const id = gesture.id; gesture = null; stopHold(); if (root.hasPointerCapture(id)) root.releasePointerCapture(id); }
    for (const channel of [...animations.keys()]) cancel(channel);
    renderPage(-page * W);
    if (screen === "app") {
      if (closingApp) finishClose();
      else { renderApp(fullFrame()); $(".app-home-target").focus({ preventScroll: true }); }
    }
    else if (screen === "welcome") { if (openingHome) finishWelcome(); else renderWelcome(0); }
    else if (screen === "notification") renderLock(lockY > -H * .5 ? 0 : -H);
    else renderDepth(0);
    if (!spotlight.hidden) {
      if (!searchTarget) { hideSearchImmediately(); searchInvoker?.focus({ preventScroll: true }); }
      else renderSearch(1);
    }
  }
  window.addEventListener("resize", resize);
  new ResizeObserver(resize).observe(frame);
  reduced.addEventListener("change", () => {
    if (!reduced.matches) return;
    if (animations.has("app")) { cancel("app"); if (screen === "app") { if (closingApp) finishClose(); else renderApp(fullFrame()); } }
    cancel("page"); renderPage(-page * W);
    if (animations.has("search")) { cancel("search"); settleSearch(Boolean(searchTarget)); }
    if (animations.has("welcome")) { cancel("welcome"); if (openingHome) finishWelcome(); else renderWelcome(0); }
    if (animations.has("lock")) { cancel("lock"); if (screen === "notification" && lockY <= -H * .5) finishNotificationClose(); else renderLock(0); }
  });
  window.addEventListener("blur", () => {
    if (gesture) endGesture({ pointerId: gesture.id, timeStamp: performance.now() }, true);
    stopHold();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) updateClock(); });
  renderPages();
  resize();
  renderDepth(1);
  setInterval(updateClock, 1000);

  // Real readiness gate: both image decoding and icon-font loading must finish.
  // Five seconds preserves the original phone boot hold; slow assets extend it.
  async function boot() {
    const bootScreen = $(".phone-boot");
    try {
      await waitForBootReady(window.IOSBootLoader.prepareAssets({ document, framework: window.Framework7 }), {
        minimumDelayMs: Math.max(0, 5000 - performance.now())
      });
      showWelcome();
      clearTimeout(window.iosBootWatchdog);
      bootScreen.setAttribute("aria-busy", "false");
      bootScreen.classList.add("is-ready");
      setTimeout(() => { bootScreen.hidden = true; }, reduced.matches ? 0 : 450);
      announce("iPhone ready. Hello. Swipe up to open.");
    } catch (error) {
      clearTimeout(window.iosBootWatchdog);
      bootScreen.setAttribute("aria-busy", "false");
      $(".boot-error p").textContent = error.message;
      $(".boot-error").hidden = false;
      announce("iPhone could not finish loading. Try again.");
    }
  }
  void boot();
})(window, document);
