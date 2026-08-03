# Control Panel Design

## Goal

Build a Windows 7-style Control Panel home view inside the existing Control Panel/Display window. The home view must closely match the supplied reference, open from the Start menu, filter entries through search, and navigate to the existing Display settings view.

## Scope

The home view contains 19 entries in four columns:

1. Data Usage, Display, Keyboard, Sync Center, Windows Defender
2. Date and Time, Backup and Restore, Mouse, System, Windows Update
3. Default Programs, Ease of Access, Personalize, Sound, Taskbar and Start Menu
4. Device Storage, Gadgets, Speech Recognition, User Accounts

Programs and Features, Region and Language, and Power Options are intentionally omitted.

Control Panel icons come from `assets/icons/controlpanel`, except:

- Default Programs uses `assets/icons/defaultprograms.ico`.
- Personalize reuses `assets/icons/controlpanel/gadgets_64x64.png`.
- Sound uses `assets/icons/speaker.png`.
- Device Storage uses `assets/icons/controlpanel/HyperVWindows8.png`.

## Window and Navigation

The existing `display` app window becomes a single Control Panel shell with two views: `home` and `display`. It opens at approximately 1120 by 680 pixels with a minimum size of 760 by 500 pixels.

The Start-menu Control Panel item opens the shell on the home view. The existing desktop context-menu action for Screen Resolution / Display opens the same shell directly on the Display view. Selecting Display on the home view opens the existing Display settings content in place. Back returns from Display to the home view; Back is disabled on the home view, and Forward remains disabled.

The address bar displays `Control Panel` on the home view and `Control Panel > Display` on the Display view. The taskbar continues treating the shell as the existing `display` app, avoiding duplicate taskbar state.

## Home View

The home view uses the reference heading, `Adjust your device's settings`, followed by a four-column icon grid. Each entry is a keyboard-focusable button with a 48–64 pixel source icon, teal Windows 7 link text, and hover/focus feedback.

At the default width the grid has four columns. It reduces to three and then two columns as the window narrows. Entries retain their declared order when reflowed.

Only Display performs navigation. Other entries retain hover and focus behavior but intentionally perform no action.

## Search

The existing Search Control Panel field filters home entries live using case-insensitive substring matching. An empty query restores all entries. When no entries match, the home view shows `No Control Panel items match your search.` Search is cleared whenever the shell is explicitly reopened on the home view.

Search remains visible on the Display view but does not modify Display settings. Typing in it while on Display returns to the home view and applies the query, matching the behavior implied by a global Control Panel search field.

## Structure

- `control-panel.js` owns the immutable item catalog, filtering helper, home rendering, search behavior, and home/display view state.
- `control-panel.css` owns the Control Panel shell and responsive home layout.
- `index.html` provides the shell, toolbar, home mount point, and existing Display content.
- `index.js` creates and destroys the Control Panel controller and routes Start-menu and desktop-context actions into it.
- `tests/control-panel.test.js` verifies the catalog, intentional omissions, icon substitutions, and filtering behavior with Node's built-in test runner.

## Verification

Automated checks must cover the 19-entry catalog, omitted entries, requested icon substitutions, and case-insensitive filtering. Browser verification must cover boot/login, opening Control Panel from Start, the four-column home layout, live search and empty results, Display navigation, Back navigation, direct Screen Resolution / Display opening, resizing, and absence of console errors.
