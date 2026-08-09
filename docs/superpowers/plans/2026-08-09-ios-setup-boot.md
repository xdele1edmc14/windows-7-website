# iOS Setup and Boot Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Framework7 iOS boot, multilingual welcome, swipe-to-open, and placeholder desktop experience as a standalone `Phone-UI/` entry point.

**Architecture:** Framework7 initialized from `framework7/bundle` owns a single iOS app root. A pure ES module owns preload, greeting, projection, rubber-band, and spring behavior; a browser module binds that behavior to state layers and Pointer Events; `main.css` owns shared iOS visuals and compatibility rules.

**Tech Stack:** Framework7 9.1.2, Framework7 Icons 5.0.5, semantic HTML, CSS, JavaScript ES modules, Pointer Events, Node.js built-in test runner.

## Global Constraints

- Boot is `#000000` with only the centered `assets/Phone-UI/apple_logo.jpg`; no progress indicators.
- Boot completion uses `Promise.all([assetPreloaderPromise, new Promise(resolve => setTimeout(resolve, 5000))])`.
- Every manifest image resolves from `Image.onload`; visible setup state cannot precede full asset readiness.
- Greetings are exactly `Hello`, `Hola`, `Bonjour`, `Ciao`, `Hallo`, `Olá`, `Namaste`, `Konnichiwa`, `Guten Tag`, and `Salam`.
- Touch and mouse use one Pointer Events flow, requestAnimationFrame writes, projected velocity, rubber-banding, and an interruptible spring.
- Mobile uses `100dvh`, `viewport-fit=cover`, and all four safe-area inset paddings.
- Fine-pointer desktop uses a centered 390:844 iPhone frame with rounded corners and a Dynamic Island.
- Shared safe areas, materials, typography, motion, and accessibility preferences live in `Phone-UI/main.css`.

---

### Task 1: Testable boot and gesture core

**Files:**
- Create: `Phone-UI/ios-boot-core.mjs`
- Test: `tests/ios-boot-core.test.js`

**Interfaces:**
- Produces: `GREETINGS`, `preloadImageAssets(urls, ImageCtor)`, `waitForBootReady(assetPreloaderPromise, options)`, `rubberBandTranslation(translationY)`, `projectSwipe(translationY, velocityY, horizonMs)`, `shouldDismissSwipe(metrics)`, and `animateSpring(options)`.

- [ ] Write tests with a fake image constructor proving the aggregate promise remains pending until every `onload` fires and rejects with the failing URL on `onerror`.
- [ ] Write tests with controlled delay and frame schedulers proving the five-second gate waits for both inputs, the exact greeting order, upward projection and threshold behavior, downward resistance, and spring convergence.
- [ ] Run `node --test tests/ios-boot-core.test.js` and confirm failure because `Phone-UI/ios-boot-core.mjs` does not exist.
- [ ] Implement the smallest pure module that satisfies those behavior tests.
- [ ] Re-run the targeted test and confirm all cases pass.

### Task 2: Semantic Framework7 state layers and assets

**Files:**
- Create: `Phone-UI/index.html`
- Create: `Phone-UI/main.css`
- Create: `assets/Phone-UI/ios-wallpaper.svg`
- Test: `tests/ios-boot-ui.test.js`

**Interfaces:**
- Consumes: the core module from Task 1 and local package files through an import map.
- Produces: `#ios-app`, `[data-boot-screen]`, `[data-welcome-screen]`, `[data-desktop-screen]`, `[data-greeting]`, `[data-swipe-prompt]`, and `[data-development-card]`.

- [ ] Write source-contract tests proving Framework7 bundle and icon styles load, `viewport-fit=cover` is present, the three semantic layers and exact copy exist, and `main.css` owns `100dvh`, all safe-area insets, desktop frame, Dynamic Island, reduced-motion, reduced-transparency, and contrast rules.
- [ ] Run `node --test tests/ios-boot-ui.test.js` and confirm failure because the entry point and stylesheet do not exist.
- [ ] Add the semantic HTML, local import map, image preload hints, neutral wallpaper SVG, and shared iOS stylesheet.
- [ ] Re-run the targeted UI contract test and confirm it passes.

### Task 3: Browser orchestration and direct manipulation

**Files:**
- Create: `Phone-UI/app.mjs`
- Modify: `tests/ios-boot-ui.test.js`

**Interfaces:**
- Consumes: every Task 1 export and the Task 2 selectors.
- Produces: a Framework7 iOS app instance, asset-gated `boot -> welcome`, greeting lifecycle, pointer-captured swipe, spring snap/dismiss, keyboard unlock, and `welcome -> desktop` focus transfer.

- [ ] Add integration assertions for `import Framework7 from "framework7/bundle"`, the complete asset manifest, font preload, exact minimum-delay call, pointer capture and all pointer events, requestAnimationFrame spring updates, desktop state commitment, and keyboard alternative.
- [ ] Run the targeted UI test and confirm those integration assertions fail.
- [ ] Implement state orchestration, boot error containment, greeting cycling with language metadata, pointer release sampling, interruptible springs, semantic click/keyboard unlock, and desktop focus transfer.
- [ ] Re-run both iOS test files and then the full Node suite.

### Task 4: Final verification

**Files:**
- Verify all new iOS files without modifying unrelated Windows 7 work.

- [ ] Run `npm test` and confirm zero failures.
- [ ] Run `node --check Phone-UI/ios-boot-core.mjs` and `node --check Phone-UI/app.mjs`.
- [ ] Run `git diff --check -- Phone-UI assets/Phone-UI tests/ios-boot-core.test.js tests/ios-boot-ui.test.js docs/superpowers`.
- [ ] Serve the repository locally and verify boot, five-second timing, mouse drag, snap-back, unlock, card copy, asset requests, and desktop framing in a real browser.
- [ ] Repeat at a 390-by-844 mobile viewport and with reduced motion enabled; capture screenshots for visual evidence.
