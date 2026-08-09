---
name: ios-design-system
description: Comprehensive guide and execution rules for iOS UI/UX design, Apple Human Interface Guidelines (HIG), SwiftUI architecture, gesture navigation, haptics, spring physics, dynamic type, native visual fidelity, and functional web operating systems. Trigger when building iOS apps, web OS shells and apps, native mobile web interfaces, or Apple-styled UI components.
---

# iOS Design System

Build interfaces that behave like iOS, not generic mobile web pages. For browser targets, build a functional web operating system: a persistent application environment with stateful apps, navigation, presentation, and interactions—not a static website wearing an iOS visual theme. Preserve platform conventions unless the product has an explicit, user-facing reason to depart from them.

## Operating Contract

- Apply this hierarchy in every decision: **clarity, deference, depth**.
- Make labels and outcomes immediately understandable; do not make users decode icons, color, or gesture-only affordances.
- Let content lead. Reveal secondary actions only when context makes them useful.
- Communicate hierarchy through grouping, materials, typography, and motion; do not add decorative chrome.
- Treat touch as continuous direct manipulation. During a drag, the dragged surface follows the finger; on release, it settles with spring physics.
- Never interrupt an active touch loop with a delayed animation, layout jump, alert, or competing gesture recognizer.
- Prefer native controls and semantics before custom replicas. Match the target iOS behavior rather than a vague “Apple-like” style.

## Web OS Scope

Treat a web OS as an application runtime, not a landing page or a collection of decorative mockups.

- Build a persistent shell that owns system-level state: current app, navigation history, sheets/dialogs, focused control, theme, accessibility preferences, and transient notifications.
- Make every visible app surface functional. A launcher opens apps; a dock or tab bar changes active context; controls mutate state; windows, pages, or sheets dismiss and restore predictably.
- Preserve state when users move between apps or presentations unless an explicit lifecycle rule clears it.
- Separate system-shell state from app-domain state. Do not use one global boolean collection for unrelated apps.
- Use iOS visual and interaction conventions as the system language; do not turn screens into marketing sections, feature grids, hero banners, or scroll-only demo pages.
- Design the shell, app chrome, content regions, and overlays as distinct layers. Let an overlay return focus to its invoking control when dismissed.
- Treat SwiftUI examples in this skill as behavioral references for web implementation when the target is a web OS; implement equivalent semantics, focus behavior, state ownership, and gesture handling in HTML/CSS/JavaScript.

```text
Web OS shell
├── system state: active app, route stack, theme, overlay stack
├── app host: one active app surface with preserved app state
├── system chrome: launcher, navigation, dock/tab bar, status affordances
└── overlays: sheets, dialogs, menus, notifications, focus restoration
```

## Architecture and Reachability

### Place Actions Deliberately

- Put frequent, primary actions in the lower reachable half of the screen: a bottom toolbar, bottom sheet action area, or thumb-reachable control.
- Reserve top-bar actions for navigation, rare utilities, account controls, and destructive actions.
- Keep destructive controls spatially and visually separated from safe, common actions.
- Keep every interactive target at least `44 × 44 pt`; enlarge the hit area without enlarging a symbol unnecessarily.
- Do not use fixed heights for text-bearing controls. Allow Dynamic Type, localization, multiline labels, and keyboard changes to determine height.

```swift
Button(action: dismiss) {
    Image(systemName: "xmark")
        .font(.body.weight(.semibold))
        .frame(width: 44, height: 44)
        .contentShape(Rectangle())
}
.accessibilityLabel("Close")
```

### Choose Navigation or Presentation

| Need | Use | Avoid |
| --- | --- | --- |
| Drill into hierarchy | `NavigationStack` | Presenting ordinary navigation in a sheet |
| Focused, interruptible task | Sheet with `.medium` / `.large` detents | Replacing a short task with a full navigation flow |
| Contextual choice set | `confirmationDialog` / action sheet | An alert used as a menu |
| Blocking failure or consequential confirmation | Alert | A non-blocking toast as the only confirmation |
| Transient progress or status | Inline status, banner, or toast | A modal that blocks continued work |

```swift
NavigationStack {
    List(items) { item in
        NavigationLink(value: item) { ItemRow(item: item) }
    }
    .navigationDestination(for: Item.self) { ItemDetailView(item: $0) }
}

.sheet(isPresented: $isEditing) {
    EditProfileView()
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
}
```

### Handle Safe Areas Intentionally

- Build edge-to-edge backgrounds only when intentional.
- Use `safeAreaInset`, `safeAreaPadding`, and `ignoresSafeArea` deliberately.
- Keep tappable content clear of the notch, Dynamic Island, home indicator, keyboard, and browser bars.
- In web replicas, include `viewport-fit=cover` and use `env(safe-area-inset-*)`; do not imitate a status bar with arbitrary padding.

```swift
ScrollView { ContentView() }
    .safeAreaInset(edge: .bottom) {
        PrimaryActionBar().background(.bar)
    }
```

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

```css
.app-shell {
  min-height: 100dvh;
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
           env(safe-area-inset-bottom) env(safe-area-inset-left);
}
```

## Visual System

### Typography

- Use San Francisco through system text styles: `.largeTitle`, `.title`, `.title2`, `.headline`, `.body`, `.callout`, `.subheadline`, `.footnote`, and `.caption`.
- Create hierarchy with semantic style, weight, spacing, and grouping—not arbitrary font sizes or low-contrast gray text.
- Support Dynamic Type, Bold Text, multiline labels, localization, and text expansion.
- Use `@ScaledMetric` for measurements coupled to text size.

```swift
@ScaledMetric(relativeTo: .body) private var iconSize = 20

VStack(alignment: .leading, spacing: 6) {
    Text("Your Library").font(.largeTitle.bold())
    Text("Recently saved items")
        .font(.subheadline)
        .foregroundStyle(.secondary)
}
```

### Color, Materials, and Symbols

- Use semantic colors: `Color.primary`, `Color.secondary`, `Color.accentColor`, system backgrounds, and system fills.
- Verify light mode, dark mode, Increased Contrast, Differentiate Without Color, and Reduce Transparency.
- Use `.ultraThinMaterial`, `.thinMaterial`, `.regularMaterial`, or `.thickMaterial` only to convey layered hierarchy or persistent context.
- Do not stack heavy blurs or place low-contrast text over imagery.
- Use SF Symbols by semantic name. Match symbol weight and scale to adjacent type, then tune alignment optically.
- Use filled symbol variants only for selected state, emphasis, or needed visual weight. Never use emoji as interface iconography.

```swift
Label("Favorite", systemImage: isFavorite ? "heart.fill" : "heart")
    .font(.body.weight(.semibold))
    .symbolRenderingMode(.hierarchical)
    .accessibilityValue(isFavorite ? "Selected" : "Not selected")
```

## Motion, Gestures, and Haptics

### Use Native Physics

- Use spring animation for direct manipulation, cards, sheets, toggles, and state changes.
- Use linear motion only for progress where a linear representation is meaningful.
- Preserve interruption: a new gesture takes control immediately, without waiting for a prior animation to finish.
- Use drag thresholds, projected end translation, and velocity to decide a dismissal; spring back if it does not complete.
- Apply resistance beyond boundaries to create rubber-banding; do not clamp abruptly.

```swift
withAnimation(.interpolatingSpring(stiffness: 320, damping: 30)) {
    isExpanded.toggle()
}
```

```swift
DragGesture()
    .onChanged { value in
        let y = value.translation.height
        offset = y > 0 ? y * 0.58 : y * 0.14
    }
    .onEnded { value in
        if value.predictedEndTranslation.height > 180 {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            isPresented = false
        }
        withAnimation(.interpolatingSpring(stiffness: 340, damping: 32)) {
            offset = 0
        }
    }
```

### Map Haptics to Committed Events

| Event | Feedback |
| --- | --- |
| Picker step or segmented selection | `UISelectionFeedbackGenerator` |
| Subtle control activation | Light impact |
| Snap-to-position or meaningful drag commit | Medium impact |
| Strong collision or consequential action | Heavy impact |
| Completed, warning, or failed outcome | Notification: success, warning, or error |

- Trigger haptics once at a meaningful state boundary.
- Do not trigger haptics on passive scrolling, each drag frame, or duplicate state updates.
- Respect Reduce Motion: remove decorative parallax and continuous motion while retaining visible state changes.

```swift
@Environment(\.accessibilityReduceMotion) private var reduceMotion
let transition = reduceMotion
    ? Animation.easeOut(duration: 0.12)
    : Animation.spring(response: 0.38, dampingFraction: 0.82)
```

## SwiftUI Generation Rules

- Use `NavigationStack`, `List`, `Form`, `Button`, `Toggle`, `Slider`, `Picker`, `Label`, and `ContentUnavailableView` when their native behavior fits.
- Keep transient interaction state in `@State`; pass mutable view state via `@Binding`; use observable models or dependency injection for shared domain state.
- Preserve native back-swipe behavior.
- Add accessibility labels, values, hints, traits, logical focus order, and stable identifiers where tests need them.
- Test VoiceOver, Bold Text, Dynamic Type, Reduce Motion, Reduce Transparency, contrast, and differentiate-without-color settings.
- Do not attach competing custom gestures to buttons or scroll views unless activation, VoiceOver actions, and scroll coexistence remain intact.

## Web OS Implementation Rules: Framework7 Icons and `main.css`

For every native web-based iOS web OS:

- Use **Framework7 Icons** for interface symbols. Import the framework stylesheet once; use semantic `f7-icons` names instead of emoji, arbitrary Unicode glyphs, or a second icon family.
- Put all shared iOS visual tokens, safe-area behavior, typography, materials, system chrome, controls, motion, and accessibility media queries in **`main.css`**. Import it from the web OS entry point before app-specific styles.
- Keep component CSS narrow and component-specific. Do not duplicate global tokens or safe-area rules outside `main.css`.
- Create an app shell first, then mount functional apps inside it. Do not render every app as one long, scrollable website.
- Represent navigation and overlays as stateful, reversible transitions. Restore focus to the invoking launcher item or control when an app surface, sheet, or dialog closes.
- Use semantic HTML controls (`button`, `input`, `label`, `nav`, `main`, `dialog`), visible keyboard focus, and Escape dismissal for dialogs.
- Use `pointerdown` / `pointermove` / `pointerup` with pointer capture only for direct-manipulation components; preserve ordinary page scrolling elsewhere.
- Use a solid fallback when `backdrop-filter` is unavailable or transparency is reduced.
- Respect `prefers-color-scheme`, `prefers-reduced-motion`, and contrast preferences.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/framework7-icons@5/css/framework7-icons.min.css">
```

```html
<button class="icon-button" type="button" aria-label="Close">
  <i class="f7-icons" aria-hidden="true">xmark</i>
</button>
```

```css
/* main.css */
:root {
  color-scheme: light dark;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif;
  --ios-accent: #007aff;
  --ios-radius: 22px;
  --ios-material: color-mix(in srgb, Canvas 74%, transparent);
}

.glass-surface {
  background: var(--ios-material);
  backdrop-filter: blur(22px) saturate(150%);
  -webkit-backdrop-filter: blur(22px) saturate(150%);
}

.icon-button {
  inline-size: 44px;
  block-size: 44px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 999px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .glass-surface {
    background: Canvas;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
```

## Component Recipes

### Web OS App Shell

```html
<div class="web-os" data-theme="system">
  <header class="system-chrome">...</header>
  <main id="app-host" tabindex="-1" aria-live="polite"></main>
  <nav class="system-dock" aria-label="Apps">...</nav>
  <dialog id="system-overlay"></dialog>
</div>
```

- Keep shell state above app components and app-specific state inside each app module.
- Make app changes reversible through back navigation, a dock/tab selection, or a clear dismissal path.
- Do not reload the document to switch between shell-managed apps.
- Restore keyboard focus when dismissing an overlay or returning from a temporary surface.

### List View

- Use grouped, inset, or plain `List` styles as content requires.
- Use semantic section headers.
- Use a disclosure indicator only for a navigable row.
- Make the full row interactive and preserve a 44-point target.

```swift
List {
    Section("Account") {
        NavigationLink { ProfileView() } label: {
            Label("Profile", systemImage: "person.crop.circle")
        }
        Toggle(isOn: $notificationsEnabled) {
            Label("Notifications", systemImage: "bell.badge")
        }
    }
}
.navigationTitle("Settings")
```

### Blurred Glass Header

```swift
Text(title)
    .font(.headline)
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal)
    .padding(.vertical, 12)
    .background(.ultraThinMaterial)
    .overlay(alignment: .bottom) { Divider().opacity(0.45) }
```

- Use only where content visibly continues beneath the header.
- Preserve readable title contrast in each appearance mode.

### Bottom Sheet Card

```swift
VStack(spacing: 16) {
    Capsule().fill(.secondary.opacity(0.45)).frame(width: 36, height: 5)
    Text("Quick Actions").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
    Button("Create Reminder") { createReminder() }
        .frame(maxWidth: .infinity, minHeight: 44)
        .buttonStyle(.borderedProminent)
}
.padding()
.background(.regularMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
```

- Pair with `.medium` / `.large` detents, a drag indicator, keyboard-safe bottom padding, and an accessible dismissal route.

### Control Center Toggle

- Use a rounded-square target with a symbol, accessible state, selected fill, spring response, and one restrained light-impact haptic on commit.
- Communicate selected state with fill, symbol treatment, and accessible value—not color alone.

## Pre-Flight Verification

Before finalizing, verify every item:

1. Test on notched, Dynamic Island, home-indicator, and keyboard-present states.
2. Confirm all controls meet `44 × 44 pt` minimum sizing and do not collide.
3. Confirm all primary repeated actions are thumb-reachable.
4. Confirm navigation, sheets, action sheets, and alerts use the correct presentation pattern and have clear dismissal/back behavior.
5. Test default and largest supported Dynamic Type, Bold Text, VoiceOver, dark mode, Increased Contrast, Differentiate Without Color, and Reduce Transparency.
6. Confirm semantic color contrast over all materials and imagery.
7. Confirm every icon is an SF Symbol (native) or Framework7 Icon (web), optically aligned, and labeled when needed.
8. Confirm all drag interactions are interruptible, rubber-band at boundaries, and settle with a spring.
9. Confirm Reduce Motion removes nonessential motion and haptics fire only once per committed event.
10. For the web OS, confirm the shell owns active-app and overlay state; apps are functional and stateful rather than static pages; `main.css` owns shared visual rules; Framework7 Icons are loaded; keyboard, touch, safe-area, focus restoration, dialog Escape, and blur fallback behavior work.
11. Remove arbitrary fixed text heights, generic linear easing, non-semantic click targets, and decorative motion without a state-communication purpose.
