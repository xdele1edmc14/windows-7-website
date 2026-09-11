# Welcome.exe Design

## Job

Welcome.exe gives first-time visitors a compact, three-step introduction to the portfolio desktop and direct entry points to server-development and graphics work.

## Architecture

`welcome.js` exposes a strict vanilla `WelcomeApp` class and constructs the entire window DOM. The class owns step state, localStorage persistence, focus, transitions, launch callbacks, and custom events. The existing Windows 7 engine remains responsible for frame positioning, dragging, minimizing, taskbar state, and closing through a small public custom-event bridge.

`welcome.css` owns only Welcome.exe presentation. It uses the existing 7.css window vocabulary, adds a restrained Aero frame treatment, an opaque document pane, short mechanical transitions, and reduced-motion/high-contrast fallbacks.

## Behavior

- Default size is 540 by 340 pixels and fixed-size, clamped by the host shell on smaller viewports.
- The app opens after the shell enters its `desktop` state unless `localStorage.hideWelcome` is exactly `"true"`.
- `currentStep` starts at 1 and stays within 1 through 3.
- Back and Next replace the current screen with directional CSS transition classes.
- Skip to Desktop and titlebar Close close the window without changing the stored preference.
- Finish closes the window.
- The checkbox stores `"true"` when checked and `"false"` when unchecked.
- The Server Development shortcut requests the registered `devhub` app through `windows7:openapp`, then requests Welcome.exe's normal shell close through `windows7:closeapp`. Its callback and `welcome:launchapp` compatibility event use the canonical `devhub` identifier.
- Other shortcut cards retain the same shell-mediated launch and close sequence with their configured app identifiers.
- Enter advances or finishes when focus is not on another actionable control. Escape closes.
- Opening focuses the first enabled navigation control; closing restores focus through the host shell.

## Visual System

The frame uses Segoe UI, a translucent cool glass edge, a 1px light-catching border, a top specular reflection, and a subtle aura sweep behind the window. The document surface stays light and nearly opaque for legibility. Controls remain compact and rectangular, with short hover lift and sheen rather than modern rounded-card styling.

## Verification

Automated tests cover step boundaries, persistence, opening suppression, launch callback/event behavior, and DOM output. Browser QA covers the login-to-desktop launch, all navigation, card launch, minimize/restore, close, checkbox persistence after reload, responsive clamping, keyboard focus, console errors, and reduced motion.
