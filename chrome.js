(() => {
  "use strict";

  const SEARCH_ENGINES = Object.freeze({
    google: {
      name: "Google",
      searchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
    },
    yahoo: {
      name: "Yahoo",
      searchUrl: (query) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`
    },
    bing: {
      name: "Bing",
      searchUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`
    },
    duckduckgo: {
      name: "DuckDuckGo",
      searchUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
    }
  });

  const TAB_STRIP_ANIMATION_MS = 180;
  const TAB_STRIP_ANIMATION_EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";
  const X_FRAME_EXTENSION_URL = "https://chromewebstore.google.com/detail/ignore-x-frame-headers/gleekbfjekiniecknbkamfmkohkpodhe";
  const KNOWN_FRAME_BLOCKING_HOSTS = new Set([
    "google.com",
    "www.google.com",
    "search.yahoo.com",
    "bing.com",
    "www.bing.com",
    "duckduckgo.com",
    "www.duckduckgo.com"
  ]);

  const createElement = (tagName, attributes = {}, children = []) => {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([name, value]) => {
      if (name === "className") element.className = value;
      else if (name === "text") element.textContent = value;
      else if (name === "dataset") Object.assign(element.dataset, value);
      else if (name in element) element[name] = value;
      else element.setAttribute(name, value);
    });
    element.append(...(Array.isArray(children) ? children : [children]));
    return element;
  };

  class Windows7ChromeApp {
    #window;
    #tabsElement;
    #newTabButton;
    #page;
    #omnibox;
    #menu;
    #menuButton;
    #homeButton;
    #backButton;
    #forwardButton;
    #listeners = new AbortController();
    #tabs = [];
    #activeTabId = null;
    #tabSequence = 0;
    #defaultSearchEngine = "yahoo";
    #showHomeButton = true;
    #frameTimer = 0;
    #embeddingNoticeShown = false;
    #embeddingNoticeDismissed = false;
    #tabAnimationFrame = 0;
    #tabAnimationTimer = 0;

    constructor(windowElement) {
      this.#window = windowElement;
      this.#tabsElement = windowElement.querySelector("[data-chrome-tabs]");
      this.#newTabButton = windowElement.querySelector("[data-chrome-new-tab]");
      this.#page = windowElement.querySelector("[data-chrome-page]");
      this.#omnibox = windowElement.querySelector("[data-chrome-omnibox]");
      this.#menu = windowElement.querySelector("[data-chrome-menu]");
      this.#menuButton = windowElement.querySelector("[data-chrome-menu-button]");
      this.#homeButton = windowElement.querySelector("[data-chrome-home]");
      this.#backButton = windowElement.querySelector("[data-chrome-back]");
      this.#forwardButton = windowElement.querySelector("[data-chrome-forward]");

      if (!this.#tabsElement || !this.#newTabButton || !this.#page || !this.#omnibox || !this.#menu || !this.#menuButton) {
        throw new Error("Chrome app markup is incomplete.");
      }

      this.#bindEvents();
      this.#openNewTab();
    }

    destroy() {
      this.#listeners.abort();
      this.#stopTabStripAnimation();
      window.clearTimeout(this.#frameTimer);
    }

    #newTabEntry() {
      return { type: "new-tab", title: "New Tab", address: "" };
    }

    #settingsEntry() {
      return {
        type: "settings",
        title: "Settings",
        address: "chrome://chrome/settings"
      };
    }

    #createTab(entry, { activate = true } = {}) {
      const tab = {
        id: `chrome-tab-${++this.#tabSequence}`,
        history: [entry],
        historyIndex: 0
      };
      this.#tabs.push(tab);
      if (activate) this.#activeTabId = tab.id;
      this.#render();
      return tab;
    }

    #openNewTab() {
      return this.#createTab(this.#newTabEntry());
    }

    #openSettings() {
      return this.#createTab(this.#settingsEntry());
    }

    #activeTab() {
      return this.#tabs.find(({ id }) => id === this.#activeTabId) ?? null;
    }

    #activeEntry() {
      const tab = this.#activeTab();
      return tab?.history[tab.historyIndex] ?? null;
    }

    #bindEvents() {
      const options = { signal: this.#listeners.signal };

      this.#window.querySelector("[data-chrome-new-tab]")?.addEventListener("click", () => {
        this.#closeMenu();
        this.#openNewTab();
      }, options);

      this.#tabsElement.addEventListener("click", (event) => {
        const closeButton = event.target.closest("[data-chrome-close-tab]");
        if (closeButton) {
          event.stopPropagation();
          this.#closeTab(closeButton.dataset.chromeCloseTab);
          return;
        }
        const tabElement = event.target.closest("[data-chrome-tab-id]");
        if (!tabElement) return;
        this.#activeTabId = tabElement.dataset.chromeTabId;
        this.#closeMenu();
        this.#render();
      }, options);

      this.#window.querySelector("[data-chrome-omnibox-form]")?.addEventListener("submit", (event) => {
        event.preventDefault();
        this.#navigateFromInput(this.#omnibox.value);
      }, options);

      this.#backButton?.addEventListener("click", () => this.#moveHistory(-1), options);
      this.#forwardButton?.addEventListener("click", () => this.#moveHistory(1), options);
      this.#window.querySelector("[data-chrome-refresh]")?.addEventListener("click", () => {
        this.#closeMenu();
        this.#renderPage();
      }, options);
      this.#homeButton?.addEventListener("click", () => {
        this.#closeMenu();
        this.#pushEntry(this.#newTabEntry());
      }, options);

      this.#menuButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.#setMenuOpen(this.#menu.hidden);
      }, options);

      this.#menu.addEventListener("click", (event) => {
        const item = event.target.closest("[data-chrome-menu-action]");
        if (!item) return;
        const action = item.dataset.chromeMenuAction;
        this.#closeMenu();
        if (action === "new-tab") this.#openNewTab();
        if (action === "settings") this.#openSettings();
        if (action === "exit") {
          this.#window.querySelector('.chrome-window__controls button[aria-label="Close"]')?.click();
        }
      }, options);

      document.addEventListener("pointerdown", (event) => {
        if (this.#menu.hidden || this.#menu.contains(event.target) || this.#menuButton.contains(event.target)) return;
        this.#closeMenu();
      }, { ...options, capture: true });

      document.addEventListener("keydown", (event) => {
        if (this.#window.hidden || this.#window.classList.contains("minimized")) return;
        if (event.key === "Escape" && !this.#menu.hidden) {
          event.preventDefault();
          this.#closeMenu();
          this.#menuButton.focus({ preventScroll: true });
          return;
        }
        if ((event.ctrlKey || event.altKey) && !event.shiftKey && event.key.toLocaleLowerCase() === "t") {
          event.preventDefault();
          this.#openNewTab();
          return;
        }
        if (event.ctrlKey && !event.shiftKey && event.key.toLocaleLowerCase() === "l") {
          event.preventDefault();
          this.#omnibox.focus({ preventScroll: true });
          this.#omnibox.select();
          return;
        }
        if (event.ctrlKey && !event.shiftKey && event.key.toLocaleLowerCase() === "w") {
          event.preventDefault();
          this.#closeTab(this.#activeTabId);
        }
      }, options);
    }

    #closeTab(tabId) {
      const index = this.#tabs.findIndex(({ id }) => id === tabId);
      if (index < 0) return;

      const wasActive = this.#activeTabId === tabId;
      this.#tabs.splice(index, 1);
      if (this.#tabs.length === 0) {
        this.#createTab(this.#newTabEntry());
        this.#window.querySelector('.chrome-window__controls button[aria-label="Close"]')?.click();
        return;
      }
      if (wasActive) {
        this.#activeTabId = this.#tabs[Math.min(index, this.#tabs.length - 1)].id;
      }
      this.#render();
    }

    #setMenuOpen(isOpen) {
      this.#menu.hidden = !isOpen;
      this.#menuButton.setAttribute("aria-expanded", String(isOpen));
      if (isOpen) this.#menu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    }

    #closeMenu() {
      this.#setMenuOpen(false);
    }

    #render() {
      this.#renderTabs();
      this.#renderToolbar();
      this.#renderPage();
      this.#updateTaskbarLabel();
    }

    #renderTabs() {
      const previousTabElements = [...this.#tabsElement.querySelectorAll("[data-chrome-tab-id]")];
      const tabCountChanged = previousTabElements.length > 0 && previousTabElements.length !== this.#tabs.length;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const shouldAnimate = tabCountChanged && !reduceMotion && !this.#window.hidden;
      const previousTabRects = new Map();
      let previousNewTabLeft = 0;

      if (shouldAnimate) {
        previousTabElements.forEach((element) => {
          previousTabRects.set(element.dataset.chromeTabId, element.getBoundingClientRect());
        });
        previousNewTabLeft = this.#newTabButton.getBoundingClientRect().left;
        this.#stopTabStripAnimation();
      }

      const fragment = document.createDocumentFragment();
      this.#tabs.forEach((tab) => {
        const entry = tab.history[tab.historyIndex];
        const tabElement = createElement("div", {
          className: `chrome-tab${tab.id === this.#activeTabId ? " is-active" : ""}`,
          role: "tab",
          tabIndex: tab.id === this.#activeTabId ? 0 : -1,
          title: entry.title,
          dataset: { chromeTabId: tab.id },
          "aria-selected": String(tab.id === this.#activeTabId)
        });
        const favicon = createElement("span", {
          className: `chrome-tab__favicon chrome-tab__favicon--${entry.type}`,
          "aria-hidden": "true"
        });
        if (entry.type === "web" && entry.url) {
          try {
            favicon.style.backgroundImage = `url("https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(entry.url).hostname)}&sz=16")`;
          } catch {
            favicon.style.backgroundImage = "none";
          }
        }
        tabElement.append(
          favicon,
          createElement("span", { className: "chrome-tab__title", text: entry.title }),
          createElement("button", {
            type: "button",
            className: "chrome-tab__close",
            text: "×",
            title: "Close",
            "aria-label": `Close ${entry.title}`,
            dataset: { chromeCloseTab: tab.id }
          })
        );
        fragment.append(tabElement);
      });
      this.#tabsElement.replaceChildren(fragment);

      if (!shouldAnimate) return;

      const openingTab = this.#tabs.length > previousTabElements.length;
      const animatedElements = [];
      this.#tabsElement.querySelectorAll("[data-chrome-tab-id]").forEach((element) => {
        const nextRect = element.getBoundingClientRect();
        const previousRect = previousTabRects.get(element.dataset.chromeTabId);
        if (previousRect) {
          const deltaX = previousRect.left - nextRect.left;
          const scaleX = nextRect.width > 0 ? previousRect.width / nextRect.width : 1;
          if (Math.abs(deltaX) > 0.25 || Math.abs(scaleX - 1) > 0.002) {
            this.#prepareTabStripFlip(
              element,
              `translateX(${deltaX}px) scaleX(${scaleX})`,
              "left center"
            );
            animatedElements.push(element);
          }
        } else if (openingTab && nextRect.width > 0) {
          const deltaX = previousNewTabLeft - nextRect.right;
          this.#prepareTabStripFlip(
            element,
            `translateX(${deltaX}px) scaleX(0.01)`,
            "right center"
          );
          animatedElements.push(element);
        }
      });

      const nextNewTabLeft = this.#newTabButton.getBoundingClientRect().left;
      const newTabDeltaX = previousNewTabLeft - nextNewTabLeft;
      if (Math.abs(newTabDeltaX) > 0.25) {
        this.#prepareTabStripFlip(
          this.#newTabButton,
          `translateX(${newTabDeltaX}px)`,
          "left center"
        );
        animatedElements.push(this.#newTabButton);
      }

      if (animatedElements.length === 0) return;
      void this.#tabsElement.offsetWidth;
      this.#tabAnimationFrame = requestAnimationFrame(() => {
        this.#tabAnimationFrame = 0;
        animatedElements.forEach((element) => {
          element.style.transition = `transform ${TAB_STRIP_ANIMATION_MS}ms ${TAB_STRIP_ANIMATION_EASING}`;
          element.style.transform = "translateX(0) scaleX(1)";
        });
        this.#tabAnimationTimer = window.setTimeout(() => {
          this.#tabAnimationTimer = 0;
          animatedElements.forEach((element) => this.#resetTabStripMotion(element));
        }, TAB_STRIP_ANIMATION_MS + 40);
      });
    }

    #prepareTabStripFlip(element, transform, transformOrigin) {
      element.style.transition = "none";
      element.style.transformOrigin = transformOrigin;
      element.style.transform = transform;
      element.style.willChange = "transform";
    }

    #resetTabStripMotion(element) {
      element.style.removeProperty("transition");
      element.style.removeProperty("transform-origin");
      element.style.removeProperty("transform");
      element.style.removeProperty("will-change");
    }

    #stopTabStripAnimation() {
      cancelAnimationFrame(this.#tabAnimationFrame);
      window.clearTimeout(this.#tabAnimationTimer);
      this.#tabAnimationFrame = 0;
      this.#tabAnimationTimer = 0;
      this.#tabsElement.querySelectorAll("[data-chrome-tab-id]").forEach((element) => {
        this.#resetTabStripMotion(element);
      });
      if (this.#newTabButton) this.#resetTabStripMotion(this.#newTabButton);
    }

    #renderToolbar() {
      const tab = this.#activeTab();
      const entry = this.#activeEntry();
      this.#omnibox.value = entry?.address ?? "";
      this.#backButton.disabled = !tab || tab.historyIndex <= 0;
      this.#forwardButton.disabled = !tab || tab.historyIndex >= tab.history.length - 1;
      this.#homeButton.hidden = !this.#showHomeButton;
    }

    #renderPage() {
      window.clearTimeout(this.#frameTimer);
      this.#page.replaceChildren();
      const entry = this.#activeEntry();
      if (!entry || entry.type === "new-tab") this.#renderNewTabPage();
      else if (entry.type === "settings") this.#renderSettingsPage();
      else this.#renderWebPage(entry);
    }

    #renderNewTabPage() {
      const page = createElement("main", { className: "chrome-new-tab" });
      const logo = createElement("div", {
        className: "chrome-google-logo",
        role: "img",
        "aria-label": "Google"
      }, [
        createElement("span", { className: "chrome-google-logo__blue", text: "G" }),
        createElement("span", { className: "chrome-google-logo__red", text: "o" }),
        createElement("span", { className: "chrome-google-logo__yellow", text: "o" }),
        createElement("span", { className: "chrome-google-logo__blue", text: "g" }),
        createElement("span", { className: "chrome-google-logo__green", text: "l" }),
        createElement("span", { className: "chrome-google-logo__red", text: "e" })
      ]);
      const form = createElement("form", { className: "chrome-new-tab__search", role: "search" });
      const input = createElement("input", {
        type: "text",
        placeholder: "Search Google or type URL",
        autocomplete: "off",
        spellcheck: false,
        "aria-label": "Search Google or type URL"
      });
      const microphone = createElement("button", {
        type: "submit",
        className: "chrome-new-tab__microphone",
        title: "Search",
        "aria-label": "Search"
      }, createElement("span", { "aria-hidden": "true" }));
      form.append(input, microphone);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        this.#navigateFromInput(input.value);
      }, { signal: this.#listeners.signal });
      page.append(logo, form);
      this.#page.append(page);
      requestAnimationFrame(() => input.focus({ preventScroll: true }));
    }

    #renderSettingsPage() {
      const page = createElement("main", { className: "chrome-settings" });
      const sidebar = createElement("aside", { className: "chrome-settings__sidebar", "aria-label": "Settings navigation" });
      ["History", "Extensions", "Settings", "Help"].forEach((name) => {
        sidebar.append(createElement("button", {
          type: "button",
          text: name,
          disabled: name !== "Settings",
          className: name === "Settings" ? "is-active" : ""
        }));
      });

      const content = createElement("div", { className: "chrome-settings__content" });
      content.append(createElement("h1", { text: "Settings" }));

      const startup = this.#settingsSection("On startup");
      startup.append(
        this.#radioRow("startup", "new-tab", "Open the New Tab page", true, false),
        this.#radioRow("startup", "continue", "Continue where I left off", false, true),
        this.#radioRow("startup", "specific", "Open a specific page or set of pages", false, true)
      );

      const appearance = this.#settingsSection("Appearance");
      const themeButtons = createElement("div", { className: "chrome-settings__button-row" }, [
        createElement("button", { type: "button", text: "Get themes" }),
        createElement("button", { type: "button", text: "Reset to default theme" })
      ]);
      const homeRow = this.#checkboxRow("Show Home button", this.#showHomeButton);
      const homeCheckbox = homeRow.querySelector("input");
      homeCheckbox.addEventListener("change", () => {
        this.#showHomeButton = homeCheckbox.checked;
        this.#renderToolbar();
      }, { signal: this.#listeners.signal });
      appearance.append(themeButtons, homeRow, this.#checkboxRow("Show bookmarks bar", false));

      const search = this.#settingsSection("Search");
      search.append(createElement("p", {
        className: "chrome-settings__description",
        text: "Set which search engine is used when searching from the omnibox."
      }));
      const searchControls = createElement("div", { className: "chrome-settings__search-controls" });
      const select = createElement("select", { "aria-label": "Default search engine" });
      Object.entries(SEARCH_ENGINES).forEach(([key, engine]) => {
        select.append(createElement("option", {
          value: key,
          text: engine.name,
          selected: key === this.#defaultSearchEngine
        }));
      });
      select.addEventListener("change", () => {
        if (SEARCH_ENGINES[select.value]) this.#defaultSearchEngine = select.value;
      }, { signal: this.#listeners.signal });
      searchControls.append(
        select,
        createElement("button", { type: "button", text: "Manage search engines..." })
      );
      search.append(searchControls);

      content.append(startup, appearance, search);
      page.append(sidebar, content);
      this.#page.append(page);
    }

    #settingsSection(title) {
      const section = createElement("section", { className: "chrome-settings__section" });
      section.append(createElement("h2", { text: title }));
      return section;
    }

    #radioRow(name, value, text, checked, disabled) {
      const input = createElement("input", { type: "radio", name, value, checked, disabled });
      return createElement("label", { className: `chrome-settings__option${disabled ? " is-disabled" : ""}` }, [
        input,
        createElement("span", { text })
      ]);
    }

    #checkboxRow(text, checked) {
      return createElement("label", { className: "chrome-settings__option" }, [
        createElement("input", { type: "checkbox", checked }),
        createElement("span", { text })
      ]);
    }

    #renderWebPage(entry) {
      const wrapper = createElement("div", { className: "chrome-web-page" });
      const loading = createElement("div", { className: "chrome-web-page__loading", text: "Loading..." });
      const frame = createElement("iframe", {
        className: "chrome-web-page__frame",
        title: entry.title,
        referrerPolicy: "no-referrer-when-downgrade",
        allow: "clipboard-read; clipboard-write; fullscreen"
      });
      let loaded = false;
      const finishLoading = () => {
        loaded = true;
        loading.remove();
        window.clearTimeout(this.#frameTimer);
        try {
          const title = frame.contentDocument?.title?.trim();
          if (title && this.#activeEntry() === entry) {
            entry.title = title;
            this.#renderTabs();
            this.#updateTaskbarLabel();
          }
        } catch {
          // Cross-origin pages intentionally hide their DOM and title.
        }
      };
      frame.addEventListener("load", finishLoading, { once: true, signal: this.#listeners.signal });
      frame.addEventListener("error", () => this.#showEmbeddingNotice(wrapper), {
        once: true,
        signal: this.#listeners.signal
      });
      wrapper.append(loading, frame);
      this.#page.append(wrapper);
      frame.src = entry.url;

      this.#frameTimer = window.setTimeout(() => {
        if (!loaded) this.#showEmbeddingNotice(wrapper);
      }, 5000);

      try {
        const host = new URL(entry.url).hostname.toLocaleLowerCase();
        if (KNOWN_FRAME_BLOCKING_HOSTS.has(host)) {
          window.setTimeout(() => {
            if (this.#activeEntry() === entry) this.#showEmbeddingNotice(wrapper);
          }, 900);
        }
      } catch {
        // Invalid URLs are rejected before an entry reaches this renderer.
      }
    }

    #showEmbeddingNotice(container) {
      if (this.#embeddingNoticeShown || this.#embeddingNoticeDismissed || !container.isConnected) return;
      this.#embeddingNoticeShown = true;
      const notice = createElement("section", {
        className: "chrome-embedding-notice",
        role: "dialog",
        "aria-labelledby": "chrome-embedding-title"
      });
      const close = createElement("button", {
        type: "button",
        className: "chrome-embedding-notice__close",
        text: "×",
        title: "Dismiss",
        "aria-label": "Dismiss embedding notice"
      });
      const title = createElement("h2", {
        id: "chrome-embedding-title",
        text: "This page may be blocked from appearing here"
      });
      const message = createElement("p", {
        text: "Some sites prevent iframe embedding with X-Frame-Options or Content-Security-Policy security headers. If the page is blank, install the Ignore X-Frame headers extension in your real Chrome browser to view it through this web OS."
      });
      const link = createElement("a", {
        href: X_FRAME_EXTENSION_URL,
        target: "_blank",
        rel: "noopener noreferrer",
        text: "Get “Ignore X-Frame headers”"
      });
      close.addEventListener("click", () => {
        this.#embeddingNoticeDismissed = true;
        notice.remove();
      }, { once: true, signal: this.#listeners.signal });
      notice.append(close, title, message, link);
      container.append(notice);
    }

    #navigateFromInput(rawValue) {
      const value = rawValue.trim();
      if (!value) return;
      this.#closeMenu();
      const url = this.#resolveInput(value);
      let title = value;
      try {
        const parsed = new URL(url);
        title = parsed.hostname.replace(/^www\./, "") || value;
      } catch {
        title = value;
      }
      this.#pushEntry({ type: "web", title, address: url, url });
    }

    #resolveInput(value) {
      const looksLikeUrl = /^https?:\/\//i.test(value) || (!/\s/.test(value) && value.includes("."));
      if (looksLikeUrl) return /^https?:\/\//i.test(value) ? value : `https://${value}`;
      return SEARCH_ENGINES[this.#defaultSearchEngine].searchUrl(value);
    }

    #pushEntry(entry) {
      const tab = this.#activeTab();
      if (!tab) return;
      tab.history.splice(tab.historyIndex + 1);
      tab.history.push(entry);
      tab.historyIndex = tab.history.length - 1;
      this.#render();
    }

    #moveHistory(direction) {
      const tab = this.#activeTab();
      if (!tab) return;
      const nextIndex = Math.max(0, Math.min(tab.history.length - 1, tab.historyIndex + direction));
      if (nextIndex === tab.historyIndex) return;
      tab.historyIndex = nextIndex;
      this.#closeMenu();
      this.#render();
    }

    #updateTaskbarLabel() {
      const entry = this.#activeEntry();
      if (!entry || !this.#window.id) return;
      const label = entry.title === "New Tab" ? "Google Chrome" : `${entry.title} - Google Chrome`;
      const taskButton = document.querySelector(`[data-window-task="${CSS.escape(this.#window.id)}"]`);
      if (taskButton) {
        taskButton.title = label;
        taskButton.setAttribute("aria-label", label);
      }
    }
  }

  window.Windows7ChromeApp = Windows7ChromeApp;
})();
