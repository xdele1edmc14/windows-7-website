(function initializeYouTubeApp(globalScope, factory) {
  const api = factory(globalScope);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.Windows7YouTube = api;
})(typeof window === "object" ? window : (typeof globalThis === "object" ? globalThis : this), (globalScope) => {
  "use strict";

  const TOPIC_CHIPS = Object.freeze([
    "All",
    "Femboy Videos 2026",
    "Arch Linux Distro Hopping",
    "NullPointerExceptions",
    "Minecraft Duplication Glitches",
    "Neovim Rice",
    "Rust Vs C++ Arguments",
    "How to Exit Vim",
    "BungeeCord Crash Tutorials",
    "Brainrot Shorts"
  ]);

  const VIDEO_ITEMS = Object.freeze([
    Object.freeze({
      id: "zombie-apocalypse",
      title: "We built the most realistic Zombie Apocalypse in Minecraft... (no mods)",
      channel: "xDele1ed",
      url: "https://youtu.be/MRt1JS9uy7g?si=dKqUlrk8a38-8h8o",
      thumbnail: "./assets/thumbnails/zombie_apocalypse.jpg",
      duration: "8:42",
      views: "4.2K views",
      published: "1 year ago",
      avatar: "XD"
    }),
    Object.freeze({
      id: "zombie-mutants",
      title: "Can We Survive Against Zombie Mutants?",
      channel: "xDele1ed",
      url: "https://youtu.be/QQeAP0_oQrA?si=RzsBHd7I_XWswzeV",
      thumbnail: "./assets/thumbnails/zombie_mutants.jpg",
      duration: "10:18",
      views: "2.1K views",
      published: "1 year ago",
      avatar: "XD"
    }),
    Object.freeze({
      id: "reaper",
      title: "The Reaper's First Appearance | Deadlands SMP",
      channel: "xDele1ed",
      url: "https://youtu.be/y_TMHY7-EE0?si=l8ikLKdXjt_LgPXL",
      thumbnail: "./assets/thumbnails/reaper.jpg",
      duration: "5:36",
      views: "1.8K views",
      published: "10 months ago",
      avatar: "XD"
    }),
    Object.freeze({
      id: "rick-astley",
      title: "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
      channel: "Rick Astley",
      url: "https://youtu.be/dQw4w9WgXcQ?si=jlIdkwDNvLO74wOk",
      thumbnail: "./assets/thumbnails/nevergonnagiveyouup.jpg",
      duration: "3:33",
      views: "1.6B views",
      published: "16 years ago",
      avatar: "RA",
      verified: true
    }),
    Object.freeze({
      id: "leaf-smp",
      title: "☘️Leaf Smp Official Trailer | The New Best Minecraft SMP",
      channel: "Deadlands SMP",
      url: "https://youtu.be/9iWPH4cGUYE?si=rgTJ2yFVT3OU6qeJ",
      thumbnail: "./assets/thumbnails/awkwardsmptrailer.jpg",
      duration: "1:47",
      views: "982 views",
      published: "2 years ago",
      avatar: "DS"
    }),
    Object.freeze({
      id: "server-hosting",
      title: "Minecraft Server Hosting Ads Be Like:",
      channel: "Deadlands SMP",
      url: "https://youtu.be/EJUmkt1X1jk?si=Zz6Lsiwi5MPPM3fL",
      thumbnail: "./assets/thumbnails/serverhosting.jpg",
      duration: "0:42",
      views: "1.4K views",
      published: "2 years ago",
      avatar: "DS"
    })
  ]);

  const SHORT_ITEMS = Object.freeze([
    Object.freeze({ title: "The Reaper found us...", views: "18K views", thumbnail: VIDEO_ITEMS[2].thumbnail, url: VIDEO_ITEMS[2].url }),
    Object.freeze({ title: "POV: the horde starts", views: "12K views", thumbnail: VIDEO_ITEMS[0].thumbnail, url: VIDEO_ITEMS[0].url }),
    Object.freeze({ title: "Zombie mutant vs our base", views: "9.4K views", thumbnail: VIDEO_ITEMS[1].thumbnail, url: VIDEO_ITEMS[1].url }),
    Object.freeze({ title: "Hosting ads be like", views: "22K views", thumbnail: VIDEO_ITEMS[5].thumbnail, url: VIDEO_ITEMS[5].url })
  ]);

  const SUBSCRIPTIONS = Object.freeze([
    Object.freeze({ name: "Noclip", initials: "NC", color: "#8756d8" }),
    Object.freeze({ name: "DesignCourse", initials: "DC", color: "#19a7ce" }),
    Object.freeze({ name: "LowSpecGamer", initials: "LG", color: "#d26632" }),
    Object.freeze({ name: "3blue1brown", initials: "3B", color: "#336fb6" }),
    Object.freeze({ name: "Rick Astley", initials: "RA", color: "#b94848" })
  ]);

  const createElement = (document, tagName, attributes = {}) => {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([name, value]) => {
      if (value === null || value === undefined) return;
      if (name === "className") element.className = value;
      else if (name === "text") element.textContent = value;
      else if (name in element && !name.startsWith("aria")) element[name] = value;
      else element.setAttribute(name, value);
    });
    return element;
  };

  const createSvgIcon = (document, name, paths, viewBox = "0 0 24 24") => {
    const createSvgElement = typeof document.createElementNS === "function"
      ? (tagName) => document.createElementNS("http://www.w3.org/2000/svg", tagName)
      : (tagName) => document.createElement(tagName);
    const svg = createSvgElement("svg");
    svg.setAttribute("class", `youtube-svg youtube-svg--${name}`);
    svg.setAttribute("viewBox", viewBox);
    svg.setAttribute("aria-hidden", "true");
    paths.forEach((definition) => {
      const path = createSvgElement(definition.tag ?? "path");
      Object.entries(definition).forEach(([attribute, value]) => {
        if (attribute !== "tag") path.setAttribute(attribute, value);
      });
      svg.append(path);
    });
    return svg;
  };

  class YouTubeApp {
    #document;
    #mount;
    #openTab;
    #window;
    #appRoot;
    #sidebarCollapsed = false;

    constructor({ mount, document = mount?.ownerDocument ?? globalScope?.document, openTab } = {}) {
      if (!mount || !document?.createElement) {
        throw new TypeError("YouTubeApp requires a mount element and document.");
      }
      this.#mount = mount;
      this.#document = document;
      this.#openTab = openTab ?? ((targetUrl, target, features) => {
        const view = this.#document.defaultView ?? globalScope;
        view.open(targetUrl, target, features);
      });
      this.#window = this.#buildWindow();
      this.#bindInteractions();
      this.#mount.append(this.#window);
    }

    get windowElement() {
      return this.#window;
    }

    get sidebarCollapsed() {
      return this.#sidebarCollapsed;
    }

    setSidebarCollapsed(collapsed) {
      this.#sidebarCollapsed = Boolean(collapsed);
      this.#appRoot.classList.toggle("youtube-app--sidebar-collapsed", this.#sidebarCollapsed);
      const toggle = this.#window.querySelector('[data-youtube-sidebar-toggle]');
      toggle?.setAttribute("aria-expanded", String(!this.#sidebarCollapsed));
      toggle?.setAttribute("aria-label", this.#sidebarCollapsed ? "Expand guide" : "Collapse guide");
    }

    #bindInteractions() {
      const sidebarToggle = this.#window.querySelector('[data-youtube-sidebar-toggle]');
      sidebarToggle?.addEventListener("click", () => this.setSidebarCollapsed(!this.#sidebarCollapsed));

      this.#window.querySelector(".youtube-search")?.addEventListener("submit", (event) => event.preventDefault());
      this.#window.querySelectorAll("[data-youtube-url]").forEach((card) => {
        const activate = () => this.#openTab(card.dataset.youtubeUrl, "_blank", "noopener,noreferrer");
        card.addEventListener("click", activate);
        card.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          activate();
        });
      });
    }

    #buildWindow() {
      const windowElement = createElement(this.#document, "section", {
        className: "window youtube-window",
        id: "youtube-window",
        role: "dialog",
        "aria-labelledby": "youtube-window-title",
        "data-window": "",
        "data-app-window": "youtube",
        "data-window-width": "960",
        "data-window-height": "580",
        "data-window-min-width": "760",
        "data-window-min-height": "480",
        "data-window-centered": ""
      });
      windowElement.hidden = true;

      const titleBar = createElement(this.#document, "div", { className: "title-bar youtube-window__title-bar" });
      const title = createElement(this.#document, "div", {
        className: "title-bar-text youtube-window__title",
        id: "youtube-window-title"
      });
      title.append(
        createElement(this.#document, "img", { src: "./assets/icons/youtube.svg", alt: "", draggable: false }),
        createElement(this.#document, "span", { text: "YouTube" })
      );
      const controls = createElement(this.#document, "div", { className: "title-bar-controls" });
      ["Minimize", "Maximize", "Close"].forEach((label) => controls.append(createElement(this.#document, "button", { type: "button", "aria-label": label })));
      titleBar.append(title, controls);

      const body = createElement(this.#document, "div", { className: "window-body youtube-window__body" });
      this.#appRoot = createElement(this.#document, "div", { className: "youtube-app" });
      this.#appRoot.append(this.#buildHeader(), this.#buildSidebar(), this.#buildMain());
      body.append(this.#appRoot);
      windowElement.append(titleBar, body);
      return windowElement;
    }

    #buildHeader() {
      const header = createElement(this.#document, "header", { className: "youtube-header" });
      const left = createElement(this.#document, "div", { className: "youtube-header__left" });
      const hamburger = createElement(this.#document, "button", {
        type: "button",
        className: "youtube-icon-button youtube-hamburger",
        "data-youtube-sidebar-toggle": "",
        "aria-label": "Collapse guide",
        "aria-expanded": "true",
        title: "Guide"
      });
      hamburger.append(createSvgIcon(this.#document, "menu", [
        { d: "M4 6.5h16M4 12h16M4 17.5h16", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round" }
      ]));
      const logo = createElement(this.#document, "div", { className: "youtube-brand", "aria-label": "YouTube BD" });
      const mark = createElement(this.#document, "span", { className: "youtube-brand__mark", "aria-hidden": "true" });
      mark.append(createElement(this.#document, "span", { className: "youtube-brand__play" }));
      logo.append(
        mark,
        createElement(this.#document, "span", { className: "youtube-brand__word", text: "YouTube" }),
        createElement(this.#document, "sup", { className: "youtube-brand__country", text: "BD" })
      );
      left.append(hamburger, logo);

      const center = createElement(this.#document, "div", { className: "youtube-header__center" });
      const searchForm = createElement(this.#document, "form", { className: "youtube-search", role: "search" });
      const searchInput = createElement(this.#document, "input", { type: "search", placeholder: "Search", "aria-label": "Search" });
      const searchButton = createElement(this.#document, "button", { type: "submit", "aria-label": "Search", title: "Search" });
      searchButton.append(createSvgIcon(this.#document, "search", [
        { tag: "circle", cx: "10.5", cy: "10.5", r: "6.5", fill: "none", stroke: "currentColor", "stroke-width": "1.8" },
        { d: "m15.5 15.5 4.5 4.5", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round" }
      ]));
      searchForm.append(searchInput, searchButton);
      const microphone = createElement(this.#document, "button", { type: "button", className: "youtube-icon-button youtube-microphone", "aria-label": "Search with your voice", title: "Search with your voice" });
      microphone.append(createSvgIcon(this.#document, "microphone", [
        { d: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-6 8a6 6 0 0 0 12 0M12 17v4M9 21h6", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round" }
      ]));
      center.append(searchForm, microphone);

      const actions = createElement(this.#document, "div", { className: "youtube-header__actions" });
      const createButton = createElement(this.#document, "button", { type: "button", className: "youtube-create", "aria-label": "Create" });
      createButton.append(createElement(this.#document, "span", { className: "youtube-create__plus", text: "+" }), createElement(this.#document, "span", { text: "Create" }));
      const notifications = createElement(this.#document, "button", { type: "button", className: "youtube-icon-button youtube-notifications", "aria-label": "Notifications, 9 unread", title: "Notifications" });
      notifications.append(
        createSvgIcon(this.#document, "bell", [{ d: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 20h4", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round" }]),
        createElement(this.#document, "span", { className: "youtube-notifications__badge", text: "9+" })
      );
      const avatar = createElement(this.#document, "button", { type: "button", className: "youtube-profile", "aria-label": "Account menu", title: "Account menu", text: "XD" });
      actions.append(createButton, notifications, avatar);
      header.append(left, center, actions);
      return header;
    }

    #buildSidebar() {
      const sidebar = createElement(this.#document, "aside", { className: "youtube-sidebar", "aria-label": "Guide" });
      const primary = createElement(this.#document, "nav", { className: "youtube-sidebar__primary", "aria-label": "Primary" });
      primary.append(
        this.#buildSidebarItem("Home", "home", true),
        this.#buildSidebarItem("Shorts", "shorts", false)
      );
      const subscriptions = createElement(this.#document, "section", { className: "youtube-subscriptions", "aria-labelledby": "youtube-subscriptions-title" });
      subscriptions.append(createElement(this.#document, "h2", { id: "youtube-subscriptions-title", text: "Subscriptions" }));
      SUBSCRIPTIONS.forEach((subscription) => {
        const item = createElement(this.#document, "button", { type: "button", className: "youtube-subscription" });
        const avatar = createElement(this.#document, "span", { className: "youtube-subscription__avatar", text: subscription.initials, "aria-hidden": "true" });
        avatar.setAttribute("data-avatar-color", subscription.color);
        item.append(
          avatar,
          createElement(this.#document, "span", { className: "youtube-subscription__name", text: subscription.name }),
          createElement(this.#document, "span", { className: "youtube-subscription__activity", "aria-label": "New videos" })
        );
        subscriptions.append(item);
      });
      sidebar.append(primary, subscriptions);
      return sidebar;
    }

    #buildSidebarItem(label, icon, active) {
      const item = createElement(this.#document, "button", {
        type: "button",
        className: `youtube-sidebar-item${active ? " youtube-sidebar-item--active" : ""}`,
        "aria-current": active ? "page" : null,
        title: label
      });
      const iconElement = icon === "home"
        ? createSvgIcon(this.#document, "home", [{ d: "m3 11 9-8 9 8v10h-6v-6H9v6H3Z", fill: "currentColor" }])
        : createSvgIcon(this.#document, "shorts", [{ d: "m14.5 2-7 4.2a3 3 0 0 0 .4 5.4l2.1 1.1-4.5 2.7a3 3 0 0 0 3.1 5.1l7-4.2a3 3 0 0 0-.4-5.4l-2.1-1.1 4.5-2.7A3 3 0 0 0 14.5 2ZM10 9l5 3-5 3Z", fill: "currentColor" }]);
      item.append(iconElement, createElement(this.#document, "span", { className: "youtube-sidebar-item__label", text: label }));
      return item;
    }

    #buildMain() {
      const main = createElement(this.#document, "main", { className: "youtube-main" });
      const topics = createElement(this.#document, "nav", { className: "youtube-topics", "aria-label": "Topics" });
      TOPIC_CHIPS.forEach((topic, index) => {
        topics.append(createElement(this.#document, "button", {
          type: "button",
          className: `youtube-topic-chip${index === 0 ? " youtube-topic-chip--active" : ""}`,
          "aria-pressed": index === 0 ? "true" : "false",
          text: topic
        }));
      });
      const feed = createElement(this.#document, "div", { className: "youtube-feed", tabIndex: "0" });
      feed.append(this.#buildVideoGrid(VIDEO_ITEMS.slice(0, 3)), this.#buildShortsShelf(), this.#buildVideoGrid(VIDEO_ITEMS.slice(3)));
      main.append(topics, feed);
      return main;
    }

    #buildVideoGrid(items) {
      const grid = createElement(this.#document, "section", { className: "youtube-video-grid", "aria-label": "Videos" });
      items.forEach((item) => grid.append(this.#buildVideoCard(item)));
      return grid;
    }

    #buildVideoCard(item) {
      const card = createElement(this.#document, "article", {
        className: "youtube-video-card",
        tabIndex: "0",
        role: "link",
        "aria-label": `${item.title} by ${item.channel}`,
        "data-youtube-video": item.id,
        "data-youtube-url": item.url
      });
      const thumbnail = createElement(this.#document, "div", { className: "youtube-video-card__thumbnail" });
      thumbnail.append(
        createElement(this.#document, "img", { src: item.thumbnail, alt: "", loading: "lazy", draggable: false }),
        createElement(this.#document, "span", { className: "youtube-duration", text: item.duration })
      );
      const details = createElement(this.#document, "div", { className: "youtube-video-card__details" });
      const avatar = createElement(this.#document, "span", { className: `youtube-channel-avatar youtube-channel-avatar--${item.channel === "xDele1ed" ? "xdele" : "alt"}`, text: item.avatar, "aria-hidden": "true" });
      const text = createElement(this.#document, "div", { className: "youtube-video-card__text" });
      const title = createElement(this.#document, "h3", { text: item.title });
      const channel = createElement(this.#document, "p", { className: "youtube-video-card__channel" });
      channel.append(createElement(this.#document, "span", { text: item.channel }));
      if (item.verified) channel.append(createElement(this.#document, "span", { className: "youtube-verified", "aria-label": "Verified", text: "✓" }));
      const metadata = createElement(this.#document, "p", { className: "youtube-video-card__metadata", text: `${item.views} • ${item.published}` });
      text.append(title, channel, metadata);
      const more = createElement(this.#document, "span", { className: "youtube-card-more", "aria-hidden": "true", text: "⋮" });
      details.append(avatar, text, more);
      card.append(thumbnail, details);
      return card;
    }

    #buildShortsShelf() {
      const shelf = createElement(this.#document, "section", { className: "youtube-shorts", "aria-labelledby": "youtube-shorts-title" });
      const heading = createElement(this.#document, "div", { className: "youtube-shorts__heading" });
      heading.append(
        createSvgIcon(this.#document, "shorts-logo", [{ d: "m14.5 2-7 4.2a3 3 0 0 0 .4 5.4l2.1 1.1-4.5 2.7a3 3 0 0 0 3.1 5.1l7-4.2a3 3 0 0 0-.4-5.4l-2.1-1.1 4.5-2.7A3 3 0 0 0 14.5 2ZM10 9l5 3-5 3Z", fill: "currentColor" }]),
        createElement(this.#document, "h2", { id: "youtube-shorts-title", text: "Shorts" })
      );
      const grid = createElement(this.#document, "div", { className: "youtube-shorts__grid" });
      SHORT_ITEMS.forEach((item, index) => {
        const card = createElement(this.#document, "article", {
          className: "youtube-short-card",
          tabIndex: "0",
          role: "link",
          "aria-label": item.title,
          "data-youtube-short": String(index + 1),
          "data-youtube-url": item.url
        });
        const media = createElement(this.#document, "div", { className: "youtube-short-card__media" });
        media.append(
          createElement(this.#document, "img", { src: item.thumbnail, alt: "", loading: "lazy", draggable: false }),
          createElement(this.#document, "div", { className: "youtube-short-card__overlay" })
        );
        const text = createElement(this.#document, "div", { className: "youtube-short-card__text" });
        text.append(createElement(this.#document, "h3", { text: item.title }), createElement(this.#document, "p", { text: item.views }));
        card.append(media, text);
        grid.append(card);
      });
      shelf.append(heading, grid);
      return shelf;
    }
  }

  const mountYouTubeApp = (document = globalScope?.document) => {
    const mount = document?.querySelector?.("[data-desktop]");
    if (!mount || mount.querySelector?.('[data-app-window="youtube"]')) return null;
    return new YouTubeApp({ mount, document });
  };

  if (globalScope?.document) mountYouTubeApp(globalScope.document);

  return Object.freeze({ TOPIC_CHIPS, VIDEO_ITEMS, SHORT_ITEMS, SUBSCRIPTIONS, YouTubeApp, mountYouTubeApp });
});
