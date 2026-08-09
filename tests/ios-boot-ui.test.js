const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const read = (...segments) => fs.readFileSync(path.join(projectRoot, ...segments), "utf8");

test("the standalone entry loads Framework7 Core, Framework7 Icons, and viewport-fit cover", () => {
  const html = read("Phone-UI", "index.html");
  const frameworkScript = '<script src="../node_modules/framework7/framework7-bundle.min.js" defer></script>';
  const coreScript = '<script src="./ios-boot-core.js?v=20260809-3" defer></script>';
  const appScript = '<script src="./app.js?v=20260809-3" defer></script>';

  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/);
  assert.doesNotMatch(html, /maximum-scale|user-scalable/);
  assert.match(html, /framework7\/framework7-bundle\.min\.css/);
  assert.match(html, /framework7-icons\/css\/framework7-icons\.css/);
  assert.match(html, /<link rel="stylesheet" href="\.\/main\.css"/);
  assert.doesNotMatch(html, /type="(?:module|importmap)"/);
  assert.ok(html.includes(frameworkScript), "the local Framework7 browser bundle must load");
  assert.ok(html.includes(coreScript), "the boot core must load as a deferred classic script");
  assert.ok(html.includes(appScript), "the app must load as a deferred classic script");
  assert.ok(html.indexOf(frameworkScript) < html.indexOf(coreScript));
  assert.ok(html.indexOf(coreScript) < html.indexOf(appScript));
});

test("the boot layer contains only the supplied Apple logo and no progress UI", () => {
  const html = read("Phone-UI", "index.html");
  const bootContents = html.match(/<section class="boot-screen[^"]*"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? "";

  assert.match(bootContents, /<img[^>]*src="\.\.\/assets\/Phone-UI\/apple_logo\.jpg"/);
  assert.equal((bootContents.match(/<img\b/g) ?? []).length, 1);
  assert.doesNotMatch(bootContents, /progress|status|spinner|loading/i);
  assert.doesNotMatch(bootContents, /<(p|span|div|button)\b/i);
});

test("welcome and desktop expose the approved visible content and semantics", () => {
  const html = read("Phone-UI", "index.html");

  assert.match(html, /data-welcome-screen/);
  assert.match(html, /data-welcome-screen[\s\S]*?role="button"/);
  assert.match(html, /aria-describedby="swipe-instruction"/);
  assert.match(html, /data-greeting[^>]*>Hello</);
  assert.match(html, /Swipe up to open/);
  assert.match(html, /data-home-indicator/);
  assert.match(html, /data-desktop-screen/);
  assert.match(html, /\.\.\/assets\/Phone-UI\/ios-wallpaper\.svg/);
  assert.match(html, /<article[^>]*data-development-card[^>]*tabindex="-1"/);
  assert.match(html, /<h1>Under Development<\/h1>/);
  assert.match(
    html,
    /System components and application environments are currently being compiled\./
  );
  assert.match(html, /aria-live="polite"/);
});

test("main.css owns viewport, safe-area, frame, material, and preference behavior", () => {
  const css = read("Phone-UI", "main.css");
  const compact = css.replace(/\s+/g, " ");

  assert.match(compact, /min-height:\s*100dvh/);
  assert.match(compact, /min-height:\s*-webkit-fill-available/);
  assert.match(compact, /padding-top:\s*env\(safe-area-inset-top\)/);
  assert.match(compact, /padding-bottom:\s*env\(safe-area-inset-bottom\)/);
  assert.match(compact, /padding-left:\s*env\(safe-area-inset-left\)/);
  assert.match(compact, /padding-right:\s*env\(safe-area-inset-right\)/);
  assert.match(compact, /background:\s*#000(?:000)?/);
  assert.match(compact, /\.dynamic-island/);
  assert.match(compact, /aspect-ratio:\s*390\s*\/\s*844/);
  assert.match(compact, /@media \(min-width:\s*700px\) and \(hover:\s*hover\) and \(pointer:\s*fine\)/);
  assert.match(compact, /backdrop-filter:\s*blur\(/);
  assert.match(compact, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(compact, /@media \(prefers-reduced-transparency:\s*reduce\)/);
  assert.match(compact, /@media \(prefers-contrast:\s*more\)/);
  assert.match(compact, /:focus-visible/);
  assert.match(compact, /@keyframes swipe-prompt-pulse[\s\S]*?opacity:\s*0\.82/);
});

test("browser orchestration gates assets and uses one interruptible pointer flow", () => {
  const source = read("Phone-UI", "app.js");

  assert.match(source, /window\.Framework7/);
  assert.match(source, /window\.IOSBootCore/);
  assert.match(source, /new Framework7\(/);
  assert.match(source, /\.\.\/assets\/Phone-UI\/apple_logo\.jpg/);
  assert.match(source, /\.\.\/assets\/Phone-UI\/ios-wallpaper\.svg/);
  assert.match(source, /const assetPreloaderPromise\s*=\s*Promise\.all\(/);
  assert.match(source, /preloadImageAssets\(UI_IMAGE_ASSETS\)/);
  assert.match(source, /document\.fonts\.load\(/);
  assert.match(source, /waitForBootReady\(assetPreloaderPromise\)/);
  assert.match(source, /addEventListener\("pointerdown"/);
  assert.match(source, /addEventListener\("pointermove"/);
  assert.match(source, /addEventListener\("pointerup"/);
  assert.match(source, /addEventListener\("pointercancel"/);
  assert.match(source, /addEventListener\("click"/);
  assert.match(source, /setPointerCapture\(/);
  assert.match(source, /releasePointerCapture\(/);
  assert.match(source, /requestAnimationFrame\(/);
  assert.match(source, /activeSpring\?\.cancel\(\)/);
  assert.match(source, /shouldDismissSwipe\(/);
  assert.match(source, /commitDesktopPhase\(/);
  assert.match(source, /case "ArrowUp"/);
  assert.match(source, /case "Enter"/);
  assert.match(source, /case " "/);
});

test("every image referenced by the phone UI exists before browser preloading", () => {
  for (const relativePath of [
    path.join("assets", "Phone-UI", "apple_logo.jpg"),
    path.join("assets", "Phone-UI", "ios-wallpaper.svg")
  ]) {
    const absolutePath = path.join(projectRoot, relativePath);
    assert.equal(fs.existsSync(absolutePath), true, `${relativePath} must exist`);
    assert.ok(fs.statSync(absolutePath).size > 0, `${relativePath} must not be empty`);
  }
});
