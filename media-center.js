(function initializeMediaCenter(globalScope, factory) {
  const data = typeof module === "object" && module.exports
    ? require("./media-center-data.js")
    : globalScope?.Windows7MediaCenterData;
  const api = factory(globalScope, data);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.Windows7MediaCenter = api;
})(typeof window === "object" ? window : (typeof globalThis === "object" ? globalThis : this), (globalScope, data) => {
  "use strict";

  if (!data) throw new Error("Media Center requires Windows7MediaCenterData.");

  const createElement = (document, tagName, attributes = {}) => {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([name, value]) => {
      if (value === undefined || value === null) return;
      if (name === "className") element.className = value;
      else if (name === "text") element.textContent = value;
      else if (name in element && !name.startsWith("aria") && !name.startsWith("data-")) element[name] = value;
      else element.setAttribute(name, value);
    });
    return element;
  };

  class MediaCenterApp {
    #mount;
    #document;
    #view;
    #window;
    #timers;
    #audioFactory;
    #now;
    #introAudio = null;
    #presentationActive = true;
    #introTimers = new Set();
    #navigation;
    #content;
    #clock;
    #controls;
    #transitionTimer = 0;
    #clockTimer = 0;
    #autoplayTimer = 0;
    #interactionTimer = 0;
    #soundChannels = new Map();
    #preloadedImages = [];
    #resizeObserver = null;
    #state = {
      view: "library",
      categoryIndex: 0,
      projectIndex: 0,
      playing: false,
      volume: 0.75,
      muted: false,
      introPlaying: false
    };

    constructor({ mount, audioFactory, timers, now = () => new Date() } = {}) {
      if (!mount?.ownerDocument || typeof mount.append !== "function") {
        throw new TypeError("MediaCenterApp requires a DOM mount element.");
      }
      this.#mount = mount;
      this.#document = mount.ownerDocument;
      this.#view = this.#document.defaultView ?? globalScope;
      this.#timers = timers ?? this.#view;
      this.#now = now;
      this.#audioFactory = audioFactory ?? ((source) => {
        if (typeof this.#view?.Audio !== "function") return null;
        return new this.#view.Audio(source);
      });
      this.#window = this.#buildWindow();
      this.#preloadAssets();
      this.#mount.append(this.#window);
      this.#observeWindowSize();
      this.#bindEvents();
      this.#render();
      this.#updateClock();
    }

    get element() {
      return this.#window;
    }

    get state() {
      return Object.freeze({ ...this.#state });
    }

    launch({ fresh = true } = {}) {
      if (!fresh) {
        const focusTarget = this.#state.view === "detail"
          ? this.#content.querySelector('[data-media-action="back"]')
          : this.#navigation.querySelector(`[data-media-category="${this.#state.categoryIndex}"]`);
        focusTarget?.focus?.({ preventScroll: true });
        return;
      }

      this.#cancelIntro();
      this.#stopAutoplay();
      this.#state.view = "library";
      this.#state.categoryIndex = 0;
      this.#state.projectIndex = 0;
      this.#state.introPlaying = true;
      this.#render();
      this.#startClock();
      this.#window.classList.remove("is-intro-fading");
      this.#window.classList.add("is-intro-playing");
      this.#window.dataset.introCue = "atmosphere";

      this.#introAudio = this.#soundChannel("intro");
      if (this.#introAudio) {
        this.#introAudio.currentTime = 0;
        this.#introAudio.volume = this.#state.muted ? 0 : this.#state.volume;
        try {
          const pending = this.#introAudio.play();
          pending?.catch?.(() => {});
        } catch (_error) {
          // Audio availability must never prevent the visual launch sequence.
        }
      }

      this.#scheduleIntro(450, () => { this.#window.dataset.introCue = "light"; });
      this.#scheduleIntro(850, () => { this.#window.dataset.introCue = "brand"; });
      this.#scheduleIntro(2250, () => { this.#window.dataset.introCue = "handoff"; });
      this.#scheduleIntro(3550, () => { this.#window.dataset.introCue = "ready"; });
      [4580, 4635, 4690, 4745].forEach((delay, index) => {
        this.#scheduleIntro(delay, () => {
          this.#window.classList.add("is-intro-fading");
          if (this.#introAudio) {
            this.#introAudio.volume = (this.#state.muted ? 0 : this.#state.volume) * (0.8 - index * 0.2);
          }
        });
      });
      this.#scheduleIntro(4800, () => this.#finishIntro());
    }

    setPresentationActive(active) {
      this.#presentationActive = active;
      this.#soundChannels.forEach((audio) => { if (audio) audio.muted = !active; });
    }

    close() {
      this.#cancelIntro();
      this.#stopAutoplay();
      if (this.#clockTimer) this.#timers.clearInterval(this.#clockTimer);
      if (this.#interactionTimer) this.#timers.clearTimeout(this.#interactionTimer);
      this.#clockTimer = 0;
      this.#interactionTimer = 0;
      if (this.#transitionTimer) this.#timers.clearTimeout(this.#transitionTimer);
      this.#transitionTimer = 0;
      this.#soundChannels.forEach((audio) => audio?.pause?.());
    }

    destroy() {
      this.close();
      this.#resizeObserver?.disconnect?.();
      this.#resizeObserver = null;
    }

    navigateCategory(delta, { sound = true, focus = false } = {}) {
      const count = data.CATEGORIES.length;
      this.#state.categoryIndex = ((this.#state.categoryIndex + Number(delta || 0)) % count + count) % count;
      this.#state.projectIndex = 0;
      this.#state.view = "library";
      this.#render("category");
      if (focus) {
        this.#navigation.querySelector(`[data-media-category="${this.#state.categoryIndex}"]`)
          ?.focus?.({ preventScroll: true });
      }
      if (sound) this.#playInteraction();
    }

    navigateProject(delta, { sound = true, focus = false } = {}) {
      const projects = this.#currentProjects();
      if (!projects.length) return;
      const priorAction = focus
        ? this.#document.activeElement?.closest?.("[data-media-action]")?.dataset.mediaAction
        : "";
      const count = projects.length;
      this.#state.projectIndex = ((this.#state.projectIndex + Number(delta || 0)) % count + count) % count;
      this.#render("project");
      if (focus) {
        const focusTarget = this.#state.view === "detail"
          ? this.#content.querySelector(`[data-media-action="${priorAction || "back"}"]`)
          : this.#content.querySelector(`[data-media-project="${this.#state.projectIndex}"]`);
        focusTarget?.focus?.({ preventScroll: true });
      }
      if (sound) this.#playInteraction();
    }

    openSelectedProject() {
      if (!this.#selectedProject()) return;
      this.#state.view = "detail";
      this.#render("forward");
      this.#playSound("confirm");
      this.#content.querySelector('[data-media-action="back"]')?.focus?.({ preventScroll: true });
    }

    back() {
      if (this.#state.view !== "detail") return false;
      this.#state.view = "library";
      this.#render("back");
      this.#playInteraction();
      this.#content.querySelector('[aria-selected="true"]')?.focus?.({ preventScroll: true });
      return true;
    }

    activateControl(action) {
      const controls = new Set(["stop", "previous", "rewind", "play", "next", "fast-forward", "mute", "volume-down", "volume-up"]);
      if (!controls.has(action)) return false;
      this.#playSound("sideButton");

      if (action === "stop") {
        this.#stopAutoplay();
        this.#state.projectIndex = 0;
        this.#render("project");
      } else if (action === "previous") this.navigateProject(-1, { sound: false });
      else if (action === "rewind") this.navigateProject(-2, { sound: false });
      else if (action === "next") this.navigateProject(1, { sound: false });
      else if (action === "fast-forward") this.navigateProject(2, { sound: false });
      else if (action === "play") {
        if (this.#state.playing) this.#stopAutoplay();
        else this.#startAutoplay();
      } else if (action === "mute") {
        this.#state.muted = !this.#state.muted;
        this.#syncChannelVolume();
      } else if (action === "volume-down") {
        this.#state.volume = Math.max(0, Math.round((this.#state.volume - 0.1) * 100) / 100);
        this.#syncChannelVolume();
      } else if (action === "volume-up") {
        this.#state.volume = Math.min(1, Math.round((this.#state.volume + 0.1) * 100) / 100);
        this.#syncChannelVolume();
      }
      this.#syncControls();
      return true;
    }

    #startAutoplay() {
      this.#stopAutoplay();
      this.#state.playing = true;
      this.#autoplayTimer = this.#timers.setInterval(() => this.navigateProject(1, { sound: false }), 4500);
      this.#syncControls();
    }

    #stopAutoplay() {
      if (this.#autoplayTimer) this.#timers.clearInterval(this.#autoplayTimer);
      this.#autoplayTimer = 0;
      this.#state.playing = false;
      this.#syncControls();
    }

    #playInteraction() {
      if (this.#interactionTimer) return;
      this.#playSound("interact");
      this.#interactionTimer = this.#timers.setTimeout(() => { this.#interactionTimer = 0; }, 90);
    }

    #playSound(name) {
      const audio = this.#soundChannel(name);
      if (!audio) return;
      audio.volume = this.#state.muted ? 0 : this.#state.volume;
      try {
        audio.pause?.();
        audio.currentTime = 0;
        const pending = audio.play?.();
        pending?.catch?.(() => {});
      } catch (_error) {
        // Missing or blocked interface audio should degrade to silent controls.
      }
    }

    #soundChannel(name) {
      if (this.#soundChannels.has(name)) return this.#soundChannels.get(name);
      const source = data.ASSETS[name];
      if (!source) return null;
      const audio = this.#audioFactory(source);
      if (!audio) return null;
      audio.preload = "auto";
      audio.muted = !this.#presentationActive;
      audio.volume = this.#state.muted ? 0 : this.#state.volume;
      this.#soundChannels.set(name, audio);
      return audio;
    }

    #preloadAssets() {
      const imageSources = new Set([
        data.ASSETS.wallpaper,
        data.ASSETS.logo,
        ...data.PROJECTS.map(({ image }) => image)
      ]);
      this.#preloadedImages = [...imageSources].map((source) => {
        const image = this.#document.createElement("img");
        image.setAttribute("src", source);
        return image;
      });
      ["intro", "sideButton", "interact", "confirm"].forEach((name) => this.#soundChannel(name));
    }

    #syncChannelVolume() {
      const volume = this.#state.muted ? 0 : this.#state.volume;
      this.#soundChannels.forEach((audio) => { audio.volume = volume; });
      if (this.#introAudio) this.#introAudio.volume = volume;
    }

    #syncControls() {
      if (!this.#controls) return;
      const play = this.#controls.querySelector('[data-media-control="play"]');
      const mute = this.#controls.querySelector('[data-media-control="mute"]');
      play?.setAttribute("aria-pressed", String(this.#state.playing));
      play?.setAttribute("aria-label", this.#state.playing ? "Pause" : "Play");
      if (play) play.textContent = this.#state.playing ? "Ⅱ" : "▶";
      mute?.setAttribute("aria-pressed", String(this.#state.muted));
      mute?.setAttribute("aria-label", this.#state.muted ? "Unmute" : "Mute");
      if (mute) mute.textContent = this.#state.muted ? "×" : "🔊";
      this.#controls.style.setProperty?.("--media-center-volume", String(this.#state.volume));
    }

    #startClock() {
      if (this.#clockTimer) this.#timers.clearInterval(this.#clockTimer);
      this.#updateClock();
      this.#clockTimer = this.#timers.setInterval(() => this.#updateClock(), 30000);
    }

    #updateClock() {
      if (!this.#clock) return;
      this.#clock.textContent = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit"
      }).format(this.#now());
    }

    #observeWindowSize() {
      if (typeof this.#view?.ResizeObserver !== "function") return;
      this.#resizeObserver = new this.#view.ResizeObserver((entries) => {
        const { width, height } = entries[0]?.contentRect ?? {};
        if (!Number.isFinite(width) || !Number.isFinite(height)) return;
        this.#window.classList.toggle("is-compact", width <= 820 || height <= 560);
        this.#window.style.setProperty(
          "--media-center-compact-gallery-height",
          `${Math.max(160, Math.min(height * 0.36, 210))}px`
        );
      });
      this.#resizeObserver.observe(this.#window);
    }

    #currentProjects() {
      const category = data.CATEGORIES[this.#state.categoryIndex];
      return data.PROJECTS.filter((project) => project.category === category);
    }

    #selectedProject() {
      return this.#currentProjects()[this.#state.projectIndex] ?? null;
    }

    #render(transition = "") {
      const backControl = this.#window.querySelector('.media-center__back-orb');
      if (backControl) backControl.disabled = this.#state.view !== "detail";
      this.#navigation.querySelectorAll('[data-media-category]').forEach((button) => {
        const selected = Number(button.dataset.mediaCategory) === this.#state.categoryIndex;
        if (selected) button.setAttribute("aria-current", "true");
        else button.removeAttribute("aria-current");
        button.tabIndex = selected ? 0 : -1;
      });

      if (this.#state.view === "detail") this.#renderDetail();
      else this.#renderLibrary();
      this.#syncControls();
      if (transition) this.#markTransition(transition);
    }

    #renderLibrary() {
      const projects = this.#currentProjects();
      const selected = this.#selectedProject();
      const view = createElement(this.#document, "section", {
        className: "media-center-library",
        "data-media-view": "library",
        "aria-label": `${data.CATEGORIES[this.#state.categoryIndex]} projects`
      });
      const categoryTitle = createElement(this.#document, "h2", {
        className: "media-center-library__category",
        "data-media-category-title": "",
        text: data.CATEGORIES[this.#state.categoryIndex].toLocaleUpperCase()
      });
      const gallery = createElement(this.#document, "div", {
        className: "media-center-gallery",
        "data-media-gallery": ""
      });
      const previewEntries = projects.length <= 3
        ? projects.map((project, index) => ({ project, index }))
        : Array.from({ length: 3 }, (_, offset) => {
          const index = (this.#state.projectIndex + offset) % projects.length;
          return { project: projects[index], index };
        });

      previewEntries.forEach(({ project, index }) => {
        const isSelected = index === this.#state.projectIndex;
        const tile = createElement(this.#document, "button", {
          type: "button",
          className: `media-center-project${isSelected ? " is-selected media-center-project--featured" : ""}`,
          "data-media-project": String(index),
          "aria-selected": String(isSelected),
          "aria-label": `Open ${project.title}`
        });
        tile.tabIndex = isSelected ? 0 : -1;
        const frame = createElement(this.#document, "span", { className: "media-center-project__frame" });
        const image = createElement(this.#document, "img", {
          "data-media-project-image": "",
          src: project.image,
          alt: ""
        });
        image.addEventListener("error", () => {
          image.hidden = true;
          tile.classList.add("has-missing-image");
        });
        frame.append(
          image,
          createElement(this.#document, "span", { className: "media-center-project__fallback", text: "Preview unavailable" })
        );
        tile.append(frame, createElement(this.#document, "span", { className: "media-center-project__name", text: project.title }));
        gallery.append(tile);
      });

      const meta = createElement(this.#document, "div", { className: "media-center-library__meta" });
      meta.append(createElement(this.#document, "h3", {
        "data-media-selected-title": "",
        text: selected?.title ?? "No projects"
      }));
      const pagination = createElement(this.#document, "div", { className: "media-center-library__pagination" });
      pagination.append(
        createElement(this.#document, "span", { className: "media-center-library__arrow", text: "‹" }),
        createElement(this.#document, "span", { text: `${projects.length ? this.#state.projectIndex + 1 : 0} / ${projects.length}` }),
        createElement(this.#document, "span", { className: "media-center-library__arrow", text: "›" })
      );
      view.append(categoryTitle, gallery, meta, pagination);
      this.#content.replaceChildren(view);
    }

    #renderDetail() {
      const project = this.#selectedProject();
      if (!project) {
        this.#state.view = "library";
        this.#renderLibrary();
        return;
      }
      const view = createElement(this.#document, "section", {
        className: "media-center-detail",
        "data-media-view": "detail",
        "aria-labelledby": "media-center-detail-title"
      });
      const back = createElement(this.#document, "button", {
        type: "button",
        className: "media-center-detail__back",
        "data-media-action": "back",
        text: "‹  BACK"
      });
      const artwork = createElement(this.#document, "div", { className: "media-center-detail__artwork" });
      const image = createElement(this.#document, "img", { src: project.image, alt: project.title });
      const fallback = createElement(this.#document, "span", { className: "media-center-detail__fallback", text: "Preview unavailable" });
      image.addEventListener("error", () => {
        image.hidden = true;
        artwork.classList.add("has-missing-image");
      });
      artwork.append(image, fallback);
      const information = createElement(this.#document, "div", { className: "media-center-detail__information" });
      information.append(
        createElement(this.#document, "h2", { id: "media-center-detail-title", "data-media-detail-title": "", text: project.title }),
        createElement(this.#document, "span", { "data-media-detail-category": "", text: project.category })
      );
      const pager = createElement(this.#document, "div", { className: "media-center-detail__pager" });
      pager.append(
        createElement(this.#document, "button", { type: "button", "data-media-action": "previous-project", "aria-label": "Previous project", text: "‹" }),
        createElement(this.#document, "span", { text: `${this.#state.projectIndex + 1} / ${this.#currentProjects().length}` }),
        createElement(this.#document, "button", { type: "button", "data-media-action": "next-project", "aria-label": "Next project", text: "›" })
      );
      view.append(back, artwork, information, pager);
      this.#content.replaceChildren(view);
    }

    #markTransition(direction) {
      if (this.#transitionTimer) this.#timers.clearTimeout(this.#transitionTimer);
      this.#content.dataset.transition = direction;
      this.#content.classList.add("is-transitioning");
      this.#transitionTimer = this.#timers.setTimeout(() => {
        this.#content.classList.remove("is-transitioning");
        this.#content.removeAttribute("data-transition");
        this.#transitionTimer = 0;
      }, 210);
    }

    #bindEvents() {
      this.#window.addEventListener("windows7:appopen", (event) => {
        if (event.detail?.appName && event.detail.appName !== "media-center") return;
        this.launch({ fresh: event.detail?.fresh !== false });
      });
      this.#window.addEventListener("windows7:appclose", (event) => {
        if (event.detail?.appName && event.detail.appName !== "media-center") return;
        this.close();
      });
      this.#window.addEventListener("pointerover", (event) => {
        if (this.#state.introPlaying) return;
        const category = event.target.closest?.("[data-media-category]");
        if (category) {
          const next = Number(category.dataset.mediaCategory);
          if (next !== this.#state.categoryIndex) {
            this.navigateCategory(next - this.#state.categoryIndex, { focus: true });
          }
          return;
        }
        const project = event.target.closest?.("[data-media-project]");
        if (project && this.#state.view === "library") {
          const next = Number(project.dataset.mediaProject);
          if (next !== this.#state.projectIndex) {
            this.navigateProject(next - this.#state.projectIndex);
          }
        }
      });
      this.#window.addEventListener("click", (event) => {
        if (this.#state.introPlaying) return;
        const control = event.target.closest?.('[data-media-control]');
        if (control) {
          this.activateControl(control.dataset.mediaControl);
          return;
        }
        const category = event.target.closest?.('[data-media-category]');
        if (category) {
          const next = Number(category.dataset.mediaCategory);
          this.navigateCategory(next - this.#state.categoryIndex, { sound: false });
          this.#playSound("confirm");
          return;
        }
        const project = event.target.closest?.('[data-media-project]');
        if (project) {
          this.#state.projectIndex = Number(project.dataset.mediaProject);
          this.openSelectedProject();
          return;
        }
        const action = event.target.closest?.('[data-media-action]')?.dataset.mediaAction;
        if (action === "back") this.back();
        if (action === "previous-project") this.navigateProject(-1, { focus: true });
        if (action === "next-project") this.navigateProject(1, { focus: true });
      });

      this.#window.addEventListener("keydown", (event) => {
        if (this.#state.introPlaying) return;
        const key = event.key;
        if ((key === "Enter" || key === " ") && event.target.closest?.("button")) return;
        let handled = true;
        if (this.#state.view === "detail") {
          if (key === "ArrowLeft") this.navigateProject(-1, { focus: true });
          else if (key === "ArrowRight") this.navigateProject(1, { focus: true });
          else if (key === "Escape" || key === "Backspace") this.back();
          else handled = false;
        } else if (key === "ArrowUp") this.navigateCategory(-1, { focus: true });
        else if (key === "ArrowDown") this.navigateCategory(1, { focus: true });
        else if (key === "ArrowLeft") this.navigateProject(-1, { focus: true });
        else if (key === "ArrowRight") this.navigateProject(1, { focus: true });
        else if (key === "Enter" || key === " ") this.openSelectedProject();
        else handled = false;
        if (handled) event.preventDefault?.();
      });
    }

    #scheduleIntro(delay, callback) {
      const id = this.#timers.setTimeout(() => {
        this.#introTimers.delete(id);
        callback();
      }, delay);
      this.#introTimers.add(id);
    }

    #finishIntro() {
      if (this.#introAudio) {
        this.#introAudio.pause?.();
        this.#introAudio.currentTime = 0;
        this.#introAudio.volume = this.#state.muted ? 0 : this.#state.volume;
      }
      this.#state.introPlaying = false;
      this.#window.classList.remove("is-intro-playing", "is-intro-fading");
      this.#window.dataset.introCue = "complete";
      this.#window.querySelector('[data-media-category="0"]')?.focus?.({ preventScroll: true });
    }

    #cancelIntro() {
      this.#introTimers.forEach((id) => this.#timers.clearTimeout(id));
      this.#introTimers.clear();
      if (this.#introAudio) {
        this.#introAudio.pause?.();
        this.#introAudio.currentTime = 0;
      }
      this.#state.introPlaying = false;
      this.#window?.classList.remove("is-intro-playing", "is-intro-fading");
    }

    #buildWindow() {
      const windowElement = createElement(this.#document, "div", {
        className: "window media-center-window",
        id: "media-center-window",
        "data-window": "",
        "data-app-window": "media-center",
        "data-window-width": "1100",
        "data-window-height": "680",
        "data-window-min-width": "760",
        "data-window-min-height": "500",
        "data-window-centered": "",
        "data-start-maximized": "",
        role: "dialog",
        "aria-labelledby": "media-center-window-title"
      });
      windowElement.hidden = true;

      const titleBar = createElement(this.#document, "div", { className: "title-bar media-center-window__title-bar" });
      const title = createElement(this.#document, "div", {
        className: "title-bar-text",
        id: "media-center-window-title",
        text: "Media Center"
      });
      const controls = createElement(this.#document, "div", { className: "title-bar-controls" });
      controls.append(
        createElement(this.#document, "button", { type: "button", "aria-label": "Minimize" }),
        createElement(this.#document, "button", { type: "button", "aria-label": "Maximize" }),
        createElement(this.#document, "button", { type: "button", "aria-label": "Close" })
      );
      titleBar.append(title, controls);

      const body = createElement(this.#document, "div", { className: "window-body media-center-window__body" });
      const surface = createElement(this.#document, "div", { className: "media-center" });
      const intro = createElement(this.#document, "div", { className: "media-center-intro", "aria-hidden": "true" });
      const lightField = createElement(this.#document, "div", { className: "media-center-intro__light" });
      lightField.append(
        createElement(this.#document, "span", { className: "media-center-intro__ribbon media-center-intro__ribbon--one" }),
        createElement(this.#document, "span", { className: "media-center-intro__ribbon media-center-intro__ribbon--two" }),
        createElement(this.#document, "span", { className: "media-center-intro__glint" })
      );
      const introBrand = createElement(this.#document, "div", { className: "media-center-intro__brand" });
      introBrand.append(
        createElement(this.#document, "img", { className: "media-center-intro__logo", src: data.ASSETS.logo, alt: "" }),
        createElement(this.#document, "span", { className: "media-center-intro__name", text: "Media Center" })
      );
      intro.append(lightField, introBrand);
      const brand = createElement(this.#document, "div", { className: "media-center__brand" });
      brand.append(
        createElement(this.#document, "button", {
          type: "button",
          className: "media-center__back-orb",
          "data-media-action": "back",
          "aria-label": "Back",
          text: "‹"
        }),
        createElement(this.#document, "img", {
          className: "media-center__brand-logo",
          src: data.ASSETS.logo,
          alt: ""
        }),
        createElement(this.#document, "span", { className: "media-center__brand-name", text: "Media Center" })
      );
      this.#clock = createElement(this.#document, "time", {
        className: "media-center__clock",
        "data-media-clock": "",
        "aria-label": "Current time"
      });

      const layout = createElement(this.#document, "div", { className: "media-center__layout" });
      this.#navigation = createElement(this.#document, "nav", {
        className: "media-center__navigation",
        "aria-label": "Portfolio categories"
      });
      this.#navigation.append(createElement(this.#document, "h1", { text: "My Work" }));
      data.CATEGORIES.forEach((category, index) => {
        this.#navigation.append(createElement(this.#document, "button", {
          type: "button",
          className: "media-center__category",
          "data-media-category": String(index),
          text: category
        }));
      });
      this.#content = createElement(this.#document, "main", { className: "media-center__library" });
      layout.append(this.#navigation, this.#content);
      this.#controls = this.#buildControls();
      surface.append(intro, brand, this.#clock, layout, this.#controls);
      body.append(surface);
      windowElement.append(titleBar, body);
      return windowElement;
    }

    #buildControls() {
      const controls = createElement(this.#document, "div", {
        className: "media-center-controls",
        role: "toolbar",
        "aria-label": "Media controls"
      });
      const definitions = [
        ["stop", "Stop", "■"],
        ["previous", "Previous", "|‹"],
        ["rewind", "Rewind", "‹‹"],
        ["play", "Play", "▶"],
        ["next", "Next", "›|"],
        ["fast-forward", "Fast-forward", "››"]
      ];
      definitions.forEach(([action, label, glyph]) => {
        controls.append(createElement(this.#document, "button", {
          type: "button",
          className: `media-center-control${action === "play" ? " media-center-control--play" : ""}`,
          "data-media-control": action,
          "aria-label": label,
          "aria-pressed": action === "play" ? "false" : undefined,
          title: label,
          text: glyph
        }));
      });
      controls.append(createElement(this.#document, "span", { className: "media-center-controls__divider", role: "separator" }));
      [
        ["mute", "Mute", "🔊"],
        ["volume-down", "Volume down", "−"],
        ["volume-up", "Volume up", "+"]
      ].forEach(([action, label, glyph]) => {
        controls.append(createElement(this.#document, "button", {
          type: "button",
          className: "media-center-control media-center-control--volume",
          "data-media-control": action,
          "aria-label": label,
          "aria-pressed": action === "mute" ? "false" : undefined,
          title: label,
          text: glyph
        }));
      });
      return controls;
    }
  }

  const mountedApps = new WeakMap();

  const mountMediaCenter = (mount, options = {}) => {
    const existing = mountedApps.get(mount);
    if (existing) return existing;
    const app = new MediaCenterApp({ mount, ...options });
    mountedApps.set(mount, app);
    return app;
  };

  const unmountMediaCenter = (mount) => {
    const app = mountedApps.get(mount);
    if (!app) return false;
    app.destroy();
    mountedApps.delete(mount);
    return true;
  };

  return Object.freeze({ MediaCenterApp, mountMediaCenter, unmountMediaCenter });
});
