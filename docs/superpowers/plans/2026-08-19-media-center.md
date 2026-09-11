# Media Center Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully offline, shell-integrated Windows 7 Media Center portfolio with a 4.8-second audio-synchronized fresh-launch intro using the supplied glossy Windows logo.

**Architecture:** A frozen data module owns all portfolio content. A single MediaCenterApp controller builds and updates a dynamic shell window, owns navigation/audio state, and responds to generic fresh-open/close lifecycle events; CSS owns the responsive Media Center visual system and cue-based intro animation.

**Tech Stack:** Vanilla JavaScript, HTML5 audio, CSS animations/transitions, Node's built-in test runner, existing Windows 7 shell and 7.css.

## Global Constraints

- The main heading is exactly `My Work`; the app name is exactly `Media Center`.
- Use every supplied portfolio image from `assets/media center/` and use `wallpaper.png` as the uncropped atmospheric background.
- Use `main_logo.png` as a moving part of the startup sequence and the live header identity.
- Fresh launches last 4.8 seconds and replay the intro; minimize/restore does not replay it.
- Open maximized but retain Restore Down and resizing to a minimum 760 by 500 pixels.
- Remain fully offline, dependency-free, keyboard accessible, and tolerant of missing image/audio assets.
- Do not commit; preserve all unrelated dirty work.

---

### Task 1: Portfolio model and window scaffold

**Files:**
- Create: `media-center-data.js`
- Create: `media-center.js`
- Test: `tests/media-center-app.test.js`

**Interfaces:**
- Produces: `Windows7MediaCenterData` with `CATEGORIES`, `ASSETS`, and `PROJECTS`.
- Produces: `Windows7MediaCenter.MediaCenterApp`, whose constructor accepts `{ mount, audioFactory, timers }` and exposes `element`, `state`, `launch()`, `close()`, `navigateCategory(delta)`, `navigateProject(delta)`, `openSelectedProject()`, `back()`, and `activateControl(action)`.

- [ ] Write failing tests that instantiate the real app and assert the exact six categories, required project schema, use of every supplied visual asset, a hidden `data-app-window="media-center"` window, `My Work`, and restored/minimum sizing attributes.
- [ ] Run `node --test tests/media-center-app.test.js` and confirm failure because the modules do not exist.
- [ ] Implement the immutable data module and minimal dynamic window scaffold.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Fresh-launch Media Center intro

**Files:**
- Modify: `media-center.js`
- Create: `media-center.css`
- Modify: `tests/media-center-app.test.js`

**Interfaces:**
- `launch({ fresh = true })` resets to library state, preloads assets, starts `intro.mp3`, applies `is-intro-playing`, advances cue names `atmosphere`, `light`, `brand`, `handoff`, and `ready`, then stops/fades the intro at 4800 milliseconds.
- `launch({ fresh = false })` restores focus without restarting intro or resetting selection.

- [ ] Add failing tests using injected controllable timers/audio that prove fresh launch schedules the 4800ms finish, uses `intro.mp3`, contains `main_logo.png`, and restore does not replay.
- [ ] Run the focused test and confirm the fresh-launch behavior is absent.
- [ ] Implement the cue timeline, audio failure fallback, close cancellation, and class/state cleanup.
- [ ] Implement CSS layers for wallpaper, blue light ribbons/glints, logo/wordmark handoff, main-interface reveal, reduced motion, and forced colors.
- [ ] Re-run the focused test and confirm it passes.

### Task 3: Category, gallery, and detail navigation

**Files:**
- Modify: `media-center.js`
- Modify: `media-center.css`
- Modify: `tests/media-center-app.test.js`

**Interfaces:**
- `navigateCategory(delta)` wraps six categories and selects the first matching project.
- `navigateProject(delta)` wraps only the current category's projects.
- `openSelectedProject()` sets view to `detail`; `back()` returns to `library` and restores the selected tile's focus.

- [ ] Add failing behavioral tests for category/project wrapping, rendered featured/secondary items, detail metadata, Back/Escape behavior, rapid navigation, and missing-image fallback.
- [ ] Run the focused test and verify these transitions fail because they are not implemented.
- [ ] Implement data-driven library and detail rendering, serialized transitions, pointer/focus activation, keyboard routing, and image error fallback.
- [ ] Add horizontal slide/fade/scale/brief-blur CSS for category and detail transitions with strong persistent selection and keyboard focus.
- [ ] Re-run the focused test and confirm it passes.

### Task 4: Media controls and sound routing

**Files:**
- Modify: `media-center.js`
- Modify: `media-center.css`
- Modify: `tests/media-center-app.test.js`

**Interfaces:**
- `activateControl(action)` accepts `stop`, `previous`, `rewind`, `play`, `next`, `fast-forward`, `mute`, `volume-down`, and `volume-up`.
- The audio router exposes no public mutable channel; it restarts one reusable element per sound and throttles interaction playback.

- [ ] Add failing tests that prove each transport action changes real controller state, autoplay advances every 4500ms, volume clamps from 0 to 1, media buttons use the side-button sound, navigation uses the interaction sound, and detail/category confirmation uses the confirm sound.
- [ ] Run the focused test and confirm control behavior is missing.
- [ ] Implement transport state, autoplay timer cleanup, volume state, reusable audio channels, cooldowns, and graceful rejected/missing playback.
- [ ] Add glossy hover/focus/pressed states and the emphasized Play button treatment.
- [ ] Re-run the focused test and confirm it passes.

### Task 5: Windows 7 shell registration and lifecycle

**Files:**
- Modify: `boot-assets.js`
- Modify: `index.html`
- Modify: `index.js`
- Modify: `tests/production-assets.test.js`
- Modify: `tests/media-center-app.test.js`

**Interfaces:**
- Add `ASSETS.mediaCenter` pointing to `./assets/media center/main_logo.png`.
- Register `media-center` in `APP_SHORTCUTS`, the default desktop shortcuts, and the Start menu.
- Dispatch `windows7:appopen` with `{ appName, fresh }` only for a closed app; dispatch `windows7:appclose` after close. A `data-start-maximized` app receives a restore rectangle then shell-native maximized layout on fresh open.

- [ ] Add failing integration tests for stylesheet/script order, boot icon manifest, start/desktop registration, fresh-open lifecycle dispatch, and default maximization without `data-fixed-size`.
- [ ] Run focused tests and confirm registration/lifecycle assertions fail.
- [ ] Implement shell integration narrowly and cache-bust only the new/modified Media Center resources.
- [ ] Run `node --check media-center-data.js`, `node --check media-center.js`, and `node --check index.js`.
- [ ] Run `node --test tests/media-center-app.test.js tests/production-assets.test.js` and confirm all focused tests pass.
- [ ] Run `npm.cmd test` and `git diff --check`; address only failures caused by this feature.
- [ ] Inspect the app in a browser through a fresh launch, minimize/restore, Restore Down, minimum size, keyboard navigation, detail/back, missing asset fallback, and reduced motion. Capture a screenshot if browser policy permits.
