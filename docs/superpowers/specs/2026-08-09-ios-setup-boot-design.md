# iOS Setup and Boot Experience Design

## Goal

Build a standalone, mobile-first iOS setup experience that boots behind an asset-loading gate, presents a multilingual Hello screen, unlocks through a continuous upward pointer gesture, and reveals a wallpaper-backed placeholder desktop.

## Entry Point and Framework

The experience lives under `Phone-UI/` so the existing Windows 7 web OS remains untouched. `Phone-UI/index.html` imports Framework7 Core through the `framework7/bundle` package export using a browser import map, loads the Framework7 bundle stylesheet, and loads Framework7 Icons once. Framework7 owns the iOS application root while a small state controller owns this three-phase setup flow.

Shared iOS tokens, safe areas, typography, materials, device framing, motion, and accessibility preferences live in `Phone-UI/main.css`, as required by the repository iOS design system. Pure boot timing and gesture calculations live in `Phone-UI/ios-boot-core.mjs` so they can be exercised without a browser. DOM and pointer-event orchestration live in `Phone-UI/app.mjs`.

## State Model

The application has three mutually exclusive states:

1. `boot`: a black surface containing only the centered supplied Apple logo.
2. `welcome`: the Hello screen cycles through the ten approved greetings and exposes the upward direct-manipulation gesture.
3. `desktop`: the welcome surface leaves above the viewport and the centered glass card rises over the wallpaper.

State changes are reflected through `data-phase` on the Framework7 root. The desktop is already mounted beneath the welcome layer so an upward drag reveals it continuously rather than swapping screens after release.

## Asset Gate

The image manifest contains the supplied Apple logo and the phone wallpaper. Every image is loaded through a new `Image` and resolves only from its `onload` event; the image promises are joined with `Promise.all`. Framework7 Icons' font is also requested through `document.fonts.load` before the gate completes.

The boot transition awaits the exact minimum-delay shape:

```js
Promise.all([
  assetPreloaderPromise,
  new Promise((resolve) => setTimeout(resolve, 5000))
]);
```

Fast asset loads therefore still display the logo for at least five seconds; slow loads keep the boot state until every asset is available. A preload error leaves the boot screen intact and logs the failing URL instead of exposing a partially loaded setup screen.

The repository currently supplies `assets/Phone-UI/apple_logo.jpg` but no separate wallpaper in that folder. The implementation adds a restrained, image-based iOS wallpaper at `assets/Phone-UI/ios-wallpaper.svg` rather than substituting an unrelated Windows wallpaper. The asset remains a single manifest entry that can be replaced when the intended wallpaper is provided.

## Welcome Motion and Gesture

The centered greeting uses the approved sequence: Hello, Hola, Bonjour, Ciao, Hallo, Olá, Namaste, Konnichiwa, Guten Tag, and Salam. Each change fades out, updates the text, and fades in. The bottom instruction pulses above the home indicator while remaining clear of the bottom safe area.

The welcome layer captures one primary pointer and handles mouse, pen, and touch with the same `pointerdown`, `pointermove`, `pointerup`, and `pointercancel` loop. Pointer movement only records the desired offset; `requestAnimationFrame` performs visual writes. Downward movement receives rubber-band resistance. Release uses distance plus projected translation from velocity to choose dismissal or snap-back. Both paths use an interruptible spring; a new pointer immediately cancels an in-flight snap-back.

## Responsive Presentation

Mobile and coarse-pointer devices use the full viewport with `100dvh`, `-webkit-fill-available`, `viewport-fit=cover`, and all four `env(safe-area-inset-*)` paddings. The home indicator is positioned inside the bottom safe-area allowance.

Fine-pointer desktop displays center a 390-by-844 proportional device inside the browser, with continuous rounded corners, a restrained bezel and shadow, and a Dynamic Island that appears only after the pure boot state. During boot, the surrounding page, bezel, and device all remain black so the logo is the only visible UI.

## Accessibility and Failure Handling

The welcome screen exposes button semantics and supports click, assistive activation, Enter, Space, or Arrow Up as accessible equivalents to the gesture. Phase announcements use a polite live region. Focus moves to the desktop card after unlock. Pinch zoom remains enabled. Reduced Motion removes greeting cycling, pulsing, and decorative transitions while retaining immediate, understandable state changes. Reduced Transparency uses an opaque card fallback. High-contrast preferences strengthen borders and copy contrast.

## Verification

Node tests cover image-onload aggregation, exact five-second gate coordination, greetings, rubber-banding, projected swipe commitment, and spring completion. Browser QA covers initial boot purity, the five-second minimum, pointer drag and snap-back, mouse unlock, desktop card content, the desktop frame, a 390-pixel mobile viewport, asset-request completion, safe areas, and reduced-motion behavior.
