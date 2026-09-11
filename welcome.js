(function initializeWelcomeApp(globalScope, factory) {
  const api = factory(globalScope);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.Windows7Welcome = api;

  if (globalScope?.document) {
    const mount = globalScope.document.querySelector("#windows-7-root [data-desktop]");
    if (mount) api.instance = new api.WelcomeApp({ mount });
  }
})(typeof window === "object" ? window : (typeof globalThis === "object" ? globalThis : this), (globalScope) => {
  "use strict";

  const STORAGE_KEY = "hideWelcome";
  const STEP_MIN = 1;
  const STEP_MAX = 3;
  const TRANSITION_MS = 220;

  const clampStep = (step) => Math.min(STEP_MAX, Math.max(STEP_MIN, Number(step) || STEP_MIN));

  const createElement = (document, tagName, attributes = {}) => {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([name, value]) => {
      if (name === "className") element.className = value;
      else if (name === "text") element.textContent = value;
      else if (name in element && !name.startsWith("aria")) element[name] = value;
      else element.setAttribute(name, value);
    });
    return element;
  };

  const findShellRoot = (mount) => {
    let candidate = mount;
    while (candidate) {
      if (candidate.id === "windows-7-root") return candidate;
      candidate = candidate.parentElement;
    }
    return mount;
  };

  const bindWelcomeHostBridge = (root, { openApp, closeApp } = {}, options = undefined) => {
    if (!root?.addEventListener || typeof openApp !== "function" || typeof closeApp !== "function") {
      throw new TypeError("bindWelcomeHostBridge requires a root and openApp/closeApp handlers.");
    }
    const handleOpen = (event) => {
      const appName = event.detail?.appName;
      if (!appName) return;
      event.detail.handled = true;
      openApp(appName);
    };
    const handleClose = (event) => {
      const appName = event.detail?.appName;
      if (!appName) return;
      event.detail.handled = true;
      closeApp(appName);
    };
    root.addEventListener("windows7:openapp", handleOpen, options);
    root.addEventListener("windows7:closeapp", handleClose, options);
    return () => {
      root.removeEventListener?.("windows7:openapp", handleOpen, options);
      root.removeEventListener?.("windows7:closeapp", handleClose, options);
    };
  };

  class WelcomeApp {
    #mount;
    #shellRoot;
    #document;
    #view;
    #storage;
    #onLaunchApp;
    #window;
    #viewport;
    #bubbleField;
    #backButton;
    #nextButton;
    #skipButton;
    #startupCheckbox;
    #stepIndicators = [];
    #currentStep = STEP_MIN;
    #transitionTimer = 0;
    #startupHandled = false;
    #listeners = typeof AbortController === "function" ? new AbortController() : null;

    constructor({ mount, storage, onLaunchApp = () => {} } = {}) {
      if (!mount?.ownerDocument || typeof mount.append !== "function") {
        throw new TypeError("WelcomeApp requires a DOM mount element.");
      }
      if (typeof onLaunchApp !== "function") {
        throw new TypeError("WelcomeApp onLaunchApp must be a function.");
      }

      this.#mount = mount;
      this.#shellRoot = findShellRoot(mount);
      this.#document = mount.ownerDocument;
      this.#view = this.#document.defaultView ?? globalScope;
      this.#storage = storage ?? this.#safeLocalStorage();
      this.#onLaunchApp = onLaunchApp;
      this.#window = this.#buildWindow();
      this.#mount.append(this.#window);
      this.#bindEvents();
      this.#renderStep(STEP_MIN, 0);
    }

    get currentStep() {
      return this.#currentStep;
    }

    get element() {
      return this.#window;
    }

    open() {
      this.goToStep(STEP_MIN);
      this.#syncIntroReveal({ restart: true });
      const detail = this.#dispatchShellEvent("windows7:openapp");
      if (!detail.handled) {
        this.#window.hidden = false;
        this.#window.classList.add("active", "welcome-window--opening");
      }
      const focus = () => this.#nextButton?.focus({ preventScroll: true });
      if (typeof this.#view?.requestAnimationFrame === "function") this.#view.requestAnimationFrame(focus);
      else focus();
    }

    close() {
      const detail = this.#dispatchShellEvent("windows7:closeapp");
      if (!detail.handled) {
        this.#window.hidden = true;
        this.#window.classList.remove("active", "welcome-window--opening");
      }
    }

    goToStep(step) {
      const nextStep = clampStep(step);
      if (nextStep === this.#currentStep && this.#viewport.querySelector("[data-welcome-screen]")) {
        this.#updateNavigation();
        return;
      }
      const direction = nextStep > this.#currentStep ? 1 : -1;
      this.#currentStep = nextStep;
      this.#renderStep(nextStep, direction);
    }

    destroy() {
      this.#listeners?.abort();
      if (this.#transitionTimer) this.#view?.clearTimeout?.(this.#transitionTimer);
      this.#window.remove();
    }

    #safeLocalStorage() {
      try {
        return globalScope?.localStorage ?? null;
      } catch (_error) {
        return null;
      }
    }

    #isHiddenOnStartup() {
      try {
        return this.#storage?.getItem(STORAGE_KEY) === "true";
      } catch (_error) {
        return false;
      }
    }

    #persistStartupPreference() {
      try {
        this.#storage?.setItem(STORAGE_KEY, String(!this.#startupCheckbox.checked));
      } catch (_error) {
        // A blocked storage area should not make a welcome screen unusable.
      }
    }

    #buildWindow() {
      const windowElement = createElement(this.#document, "div", {
        className: "window welcome-window",
        id: "welcome-window",
        role: "dialog",
        "aria-labelledby": "welcome-window-title",
        "aria-describedby": "welcome-window-description",
        "data-window": "",
        "data-app-window": "welcome",
        "data-window-width": "960",
        "data-window-height": "600",
        "data-window-min-width": "760",
        "data-window-min-height": "500",
        "data-window-centered": "",
        "data-fixed-size": ""
      });
      windowElement.hidden = true;

      const titleBar = createElement(this.#document, "div", { className: "title-bar welcome-window__title-bar" });
      const title = createElement(this.#document, "div", {
        className: "title-bar-text",
        id: "welcome-window-title",
        text: "Welcome.exe — Getting Started"
      });
      const controls = createElement(this.#document, "div", { className: "title-bar-controls" });
      const minimize = createElement(this.#document, "button", { type: "button", "aria-label": "Minimize" });
      const close = createElement(this.#document, "button", { type: "button", "aria-label": "Close" });
      controls.append(minimize, close);
      titleBar.append(title, controls);

      const body = createElement(this.#document, "div", { className: "window-body welcome-window__body" });
      const surface = createElement(this.#document, "div", { className: "welcome-window__surface" });
      const status = createElement(this.#document, "div", {
        className: "welcome-window__status",
        role: "status",
        text: "SYS_STATUS: ONLINE | PORT: 8080 | ENV: TAHMID_OS"
      });
      const layout = createElement(this.#document, "div", { className: "welcome-window__layout" });
      const sidebar = this.#buildSidebar();
      this.#viewport = createElement(this.#document, "main", {
        className: "welcome-window__viewport",
        "aria-live": "polite",
        "aria-atomic": "true"
      });
      this.#bubbleField = this.#buildBubbleField();
      const footer = this.#buildFooter();
      layout.append(sidebar, this.#viewport);
      surface.append(this.#bubbleField, status, layout, footer);
      body.append(surface);
      windowElement.append(titleBar, body);
      return windowElement;
    }

    #buildBubbleField() {
      const field = createElement(this.#document, "div", {
        className: "welcome-bubbles",
        "aria-hidden": "true"
      });
      const bubbles = Array.from({ length: 30 }, (_unused, index) => [
        (index * 37 + 5) % 100,
        14 + (index * 11) % 44,
        8 + index % 7,
        -(index % 12),
        index % 2 === 0 ? "left" : "right"
      ]);
      bubbles.forEach(([left, size, duration, delay, sway]) => {
        const bubble = createElement(this.#document, "span", { className: `welcome-bubble welcome-bubble--${sway}` });
        bubble.style?.setProperty?.("--bubble-left", `${left}%`);
        bubble.style?.setProperty?.("--bubble-size", `${size}px`);
        bubble.style?.setProperty?.("--bubble-duration", `${duration}s`);
        bubble.style?.setProperty?.("--bubble-delay", `${delay}s`);
        field.append(bubble);
      });
      return field;
    }

    #buildSidebar() {
      const sidebar = createElement(this.#document, "aside", {
        className: "welcome-window__sidebar",
        "aria-label": "Getting started steps"
      });
      const iconFrame = createElement(this.#document, "div", { className: "welcome-window__app-mark" });
      iconFrame.append(createElement(this.#document, "img", {
        className: "welcome-window__app-icon",
        src: "./assets/icons/cmd.png",
        alt: "",
        width: "32",
        height: "32",
        "aria-hidden": "true"
      }));

      const steps = createElement(this.#document, "ol", { className: "welcome-window__steps" });
      ["Intro", "Controls", "Entry"].forEach((label, index) => {
        const step = index + STEP_MIN;
        const item = createElement(this.#document, "li", {
          className: "welcome-step",
          "data-welcome-step": String(step)
        });
        item.append(
          createElement(this.#document, "span", { className: "welcome-step__number", text: String(step) }),
          createElement(this.#document, "span", { className: "welcome-step__label", text: label })
        );
        this.#stepIndicators.push(item);
        steps.append(item);
      });

      sidebar.append(iconFrame, steps);
      return sidebar;
    }

    #buildFooter() {
      const footer = createElement(this.#document, "footer", { className: "welcome-window__footer" });
      const startupControl = createElement(this.#document, "div", { className: "welcome-window__startup" });
      this.#startupCheckbox = createElement(this.#document, "input", {
        type: "checkbox",
        id: "welcome-show-on-startup",
        "data-welcome-startup": ""
      });
      this.#startupCheckbox.checked = !this.#isHiddenOnStartup();
      startupControl.append(
        this.#startupCheckbox,
        createElement(this.#document, "label", {
          for: "welcome-show-on-startup",
          text: "Show on startup"
        })
      );

      const actions = createElement(this.#document, "div", { className: "welcome-window__actions" });
      this.#backButton = createElement(this.#document, "button", {
        type: "button",
        text: "< Back",
        "data-welcome-action": "back"
      });
      this.#nextButton = createElement(this.#document, "button", {
        type: "button",
        className: "default",
        text: "Next >",
        "data-welcome-action": "next"
      });
      this.#skipButton = createElement(this.#document, "button", {
        type: "button",
        text: "Skip to Desktop",
        "data-welcome-action": "skip"
      });
      actions.append(this.#backButton, this.#nextButton, this.#skipButton);
      footer.append(startupControl, actions);
      return footer;
    }

    #bindEvents() {
      const options = this.#listeners ? { signal: this.#listeners.signal } : undefined;
      this.#backButton.addEventListener("click", () => this.goToStep(this.#currentStep - 1), options);
      this.#nextButton.addEventListener("click", () => {
        if (this.#currentStep === STEP_MAX) this.close();
        else this.goToStep(this.#currentStep + 1);
      }, options);
      this.#skipButton.addEventListener("click", () => this.close(), options);
      this.#startupCheckbox.addEventListener("change", () => this.#persistStartupPreference(), options);
      this.#window.addEventListener("keydown", (event) => this.#handleKeydown(event), options);
      this.#shellRoot.addEventListener("windows7:statechange", (event) => {
        if (event.detail?.state !== "desktop" || this.#startupHandled) return;
        this.#startupHandled = true;
        if (!this.#isHiddenOnStartup()) this.open();
      }, options);
    }

    #handleKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
        return;
      }
      if (event.key !== "Enter") return;
      const isActionControl = event.target?.matches?.("button, input, a, select, textarea");
      if (isActionControl) return;
      event.preventDefault();
      this.#nextButton.click();
    }

    #renderStep(step, direction) {
      const screens = [...this.#viewport.querySelectorAll("[data-welcome-screen]")];
      const previous = this.#viewport.querySelector("[data-welcome-screen-current]") ?? screens.at(-1) ?? null;
      if (this.#transitionTimer) {
        this.#view?.clearTimeout?.(this.#transitionTimer);
        this.#transitionTimer = 0;
      }
      screens.filter((screen) => screen !== previous).forEach((screen) => screen.remove());
      const screen = this.#buildStep(step);
      screen.setAttribute("data-welcome-screen-current", "");

      if (!previous || direction === 0) {
        this.#viewport.replaceChildren(screen);
      } else {
        previous.removeAttribute?.("data-welcome-screen-current");
        previous.classList.add(direction > 0 ? "slide-out-left" : "slide-out-right");
        screen.classList.add(direction > 0 ? "slide-in-right" : "slide-in-left");
        this.#viewport.append(screen);
        this.#transitionTimer = this.#view?.setTimeout?.(() => {
          previous.remove();
          screen.classList.remove("slide-in-right", "slide-in-left");
          this.#transitionTimer = 0;
        }, TRANSITION_MS) ?? 0;
      }

      this.#updateNavigation();
      this.#syncIntroReveal();
    }

    #buildStep(step) {
      const section = createElement(this.#document, "section", {
        className: step === STEP_MIN ? "welcome-screen welcome-screen--intro" : "welcome-screen",
        "data-welcome-screen": String(step)
      });
      const counter = createElement(this.#document, "p", {
        className: "welcome-screen__counter",
        text: `${step} of ${STEP_MAX}`
      });
      const header = createElement(this.#document, "header", { className: "welcome-screen__header" });
      const headingRow = createElement(this.#document, "div", { className: "welcome-screen__heading-row" });

      if (step === 1) {
        headingRow.append(
          createElement(this.#document, "img", {
            className: "welcome-screen__header-icon",
            src: "./assets/icons/cmd.png",
            alt: "",
            width: "32",
            height: "32",
            "aria-hidden": "true"
          }),
          createElement(this.#document, "h1", {
            className: "welcome-screen__headline welcome-screen__headline--kinetic",
            text: "Windows 7. In a browser."
          })
        );
        header.append(headingRow, counter);
        section.append(
          header,
          createElement(this.#document, "p", {
            id: "welcome-window-description",
            className: "welcome-screen__lead welcome-screen__intro-copy welcome-screen__terminal-copy",
            text: "A standard responsive web page would have taken two days, but I built a functional desktop environment instead. It houses my Minecraft server architecture projects, custom plugins, and visual design work."
          })
        );
      } else if (step === 2) {
        headingRow.append(createElement(this.#document, "h1", { text: "Basic Interaction" }));
        header.append(headingRow, counter);
        section.append(
          header,
          this.#buildInteractionList()
        );
      } else {
        headingRow.append(createElement(this.#document, "h1", { text: "Direct Entry" }));
        header.append(headingRow, counter);
        section.append(
          header,
          createElement(this.#document, "p", {
            className: "welcome-screen__lead welcome-screen__lead--compact",
            text: "Skip digging through the desktop if you came for something specific:"
          }),
          this.#buildShortcutGrid()
        );
      }
      return section;
    }

    #buildInteractionList() {
      const list = createElement(this.#document, "ul", { className: "welcome-interactions" });
      [
        ["Double-click", "Launches apps (ServerDev.exe, Graphics.exe)."],
        ["Window Management", "Drag, minimize, maximize, or snap windows around the viewport."],
        ["Start Menu", "Bottom-left corner if you manage to lose an active window."]
      ].forEach(([label, description]) => {
        const item = createElement(this.#document, "li");
        item.append(
          createElement(this.#document, "strong", { text: `${label}: ` }),
          createElement(this.#document, "span", { text: description })
        );
        list.append(item);
      });
      return list;
    }

    #buildShortcutGrid() {
      const grid = createElement(this.#document, "div", { className: "welcome-shortcuts" });
      [
        ["devhub", "[ Server Development ]", "Plugin logic, BungeeCord proxy setups, and backend architecture."],
        ["media-center", "[ Graphics & Renders ]", "Voxel models, thumbnails, and promotional media."]
      ].forEach(([appName, label, description]) => {
        const card = createElement(this.#document, "button", {
          type: "button",
          className: "welcome-shortcut",
          "data-welcome-launch": appName
        });
        card.append(
          createElement(this.#document, "strong", { text: label }),
          createElement(this.#document, "span", { text: description })
        );
        card.addEventListener("click", () => this.#launchApp(appName), this.#listeners ? { signal: this.#listeners.signal } : undefined);
        grid.append(card);
      });
      return grid;
    }

    #updateNavigation() {
      this.#backButton.disabled = this.#currentStep === STEP_MIN;
      this.#nextButton.textContent = this.#currentStep === STEP_MAX ? "Finish" : "Next >";
      this.#skipButton.hidden = this.#currentStep === STEP_MAX;
      this.#stepIndicators.forEach((indicator) => {
        const isActive = Number(indicator.dataset.welcomeStep) === this.#currentStep;
        if (isActive) {
          indicator.classList.add("welcome-step--active");
          indicator.setAttribute("aria-current", "step");
        } else {
          indicator.classList.remove("welcome-step--active");
          indicator.removeAttribute("aria-current");
        }
      });
      this.#window.setAttribute("aria-label", `Welcome.exe — Getting Started, step ${this.#currentStep} of ${STEP_MAX}`);
    }

    #syncIntroReveal({ restart = false } = {}) {
      this.#window.classList.remove("welcome-window--intro-reveal");
      if (this.#currentStep !== STEP_MIN) return;

      const applyReveal = () => {
        if (this.#currentStep === STEP_MIN) this.#window.classList.add("welcome-window--intro-reveal");
      };
      if (!restart || typeof this.#view?.requestAnimationFrame !== "function") {
        applyReveal();
        return;
      }
      this.#view.requestAnimationFrame(() => this.#view.requestAnimationFrame(applyReveal));
    }

    #launchApp(appName) {
      this.#dispatchShellEvent("windows7:openapp", appName);
      this.close();
      this.#onLaunchApp(appName);
      const EventConstructor = this.#view?.CustomEvent ?? globalScope?.CustomEvent;
      const event = new EventConstructor("welcome:launchapp", {
        bubbles: true,
        detail: { appName }
      });
      this.#window.dispatchEvent(event);
    }

    #dispatchShellEvent(type, appName = "welcome") {
      const detail = { appName, handled: false };
      const EventConstructor = this.#view?.CustomEvent ?? globalScope?.CustomEvent;
      const event = new EventConstructor(type, { bubbles: false, detail });
      this.#shellRoot.dispatchEvent(event);
      return detail;
    }
  }

  return { STORAGE_KEY, clampStep, bindWelcomeHostBridge, WelcomeApp };
});
