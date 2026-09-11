(function initializeDevHub(globalScope, factory) {
  const api = factory(globalScope);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.Windows7DevHub = api;
})(typeof window === "object" ? window : (typeof globalThis === "object" ? globalThis : this), (globalScope) => {
  "use strict";

  // DevHub Global Configuration
  const DEVHUB_CONFIG = Object.freeze({
    profile: Object.freeze({
      handle: "xDele1ed",
      githubUsername: "xdele1edmc14",
      displayName: "xDele1ed",
      pronouns: "he/him",
      bio: "Software & Plugin Engineer | Java, Node.js, TypeScript | Working on high-performance server systems and custom web tools.",
      organization: "NullPointer Studios",
      location: "The Earth",
      website: "https://xdele1ed.is-a.dev",
      followers: 1,
      following: 0,
      avatarUrl: "https://github.com/xdele1edmc14.png"
    }),
    links: Object.freeze({
      deadlandsDiscord: "https://discord.gg/XPUh4zJagc",
      xApocalypseGithub: "https://github.com/xdele1edmc14/xApocalypse",
      infectedRevampedGithub: "https://github.com/xdele1edmc14/Infected-revamped",
      windows7WebsiteGithub: "https://github.com/xdele1edmc14/windows-7-website",
      xosPortfolioGithub: "https://github.com/xdele1edmc14/xos-portfolio",
      minecraftSetupGithub: "https://github.com/xdele1edmc14/minecraft-setup"
    }),
    version: "v2.4.0"
  });

  const REPOSITORIES = Object.freeze([
    Object.freeze({
      key: "DEADLANDS",
      name: "DEADLANDS",
      description: "Custom hardcore zombie apocalypse survival ecosystem with custom mechanics.",
      language: "Java",
      badge: "Discord",
      pinned: true,
      externalIndicator: true,
      url: DEVHUB_CONFIG.links.deadlandsDiscord
    }),
    Object.freeze({
      key: "xApocalypse",
      name: "xApocalypse",
      description: "A hardcore zombie apocalypse survival plugin for Spigot/Paper.",
      language: "Java",
      badge: "Public repository",
      stars: 1,
      pinned: true,
      externalIndicator: true,
      url: DEVHUB_CONFIG.links.xApocalypseGithub
    }),
    Object.freeze({
      key: "Infected-revamped",
      name: "Infected-revamped",
      description: "Forked and revamped version of the original Infection plugin with bug fixes and balance updates.",
      language: "Java",
      badge: "Public fork",
      pinned: true,
      url: DEVHUB_CONFIG.links.infectedRevampedGithub
    }),
    Object.freeze({
      key: "windows-7-website",
      name: "windows-7-website",
      description: "Interactive Web OS desktop interface built with pure modern web technologies.",
      language: "JavaScript",
      badge: "Public repository",
      pinned: true,
      url: DEVHUB_CONFIG.links.windows7WebsiteGithub
    }),
    Object.freeze({
      key: "xos-portfolio",
      name: "xos-portfolio",
      description: "A modern interactive portfolio operating system for the web.",
      language: "JavaScript",
      badge: "Public repository",
      pinned: false,
      url: DEVHUB_CONFIG.links.xosPortfolioGithub
    }),
    Object.freeze({
      key: "minecraft-setup",
      name: "minecraft-setup",
      description: "Server configuration and automation tools for custom Minecraft deployments.",
      language: "Bash / Shell",
      badge: "Public repository",
      pinned: false,
      url: DEVHUB_CONFIG.links.minecraftSetupGithub
    })
  ]);

  const SKILL_GROUPS = Object.freeze([
    Object.freeze({
      title: "Core languages",
      description: "Languages used to ship plugins, services, and interactive tools.",
      items: Object.freeze([
        Object.freeze({ name: "Java", level: "Primary" }),
        Object.freeze({ name: "JavaScript", level: "Production" }),
        Object.freeze({ name: "TypeScript", level: "Production" }),
        Object.freeze({ name: "GDScript", level: "Working knowledge" })
      ])
    }),
    Object.freeze({
      title: "Frameworks and APIs",
      description: "Runtime and integration work across game servers and web services.",
      items: Object.freeze([
        Object.freeze({ name: "Spigot / Paper API", level: "Primary" }),
        Object.freeze({ name: "Node.js", level: "Production" }),
        Object.freeze({ name: "Express", level: "Production" }),
        Object.freeze({ name: "REST APIs", level: "Production" })
      ])
    }),
    Object.freeze({
      title: "Build tools and systems",
      description: "Tooling used to build, version, automate, and structure projects.",
      items: Object.freeze([
        Object.freeze({ name: "Maven", level: "Production" }),
        Object.freeze({ name: "Git", level: "Production" }),
        Object.freeze({ name: "Bash / Shell", level: "Working knowledge" }),
        Object.freeze({ name: "Web OS Architecture", level: "Primary" })
      ])
    })
  ]);

  const levelForCount = (count) => {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 9) return 3;
    return 4;
  };

  const createContributionCalendar = () => {
    const dayCount = 52 * 7;
    const targetTotal = 195;
    const counts = Array.from({ length: dayCount }, (_, index) => {
      const signal = (index * 37 + Math.floor(index / 7) * 11 + 17) % 31;
      if (signal < 2) return 8 + (index % 5);
      if (signal < 5) return 4 + (index % 3);
      if (signal < 10) return 1 + (index % 2);
      return 0;
    });

    let total = counts.reduce((sum, count) => sum + count, 0);
    let cursor = 0;
    while (total < targetTotal) {
      const index = (cursor * 43 + 19) % dayCount;
      if (counts[index] < 12) {
        counts[index] += 1;
        total += 1;
      }
      cursor += 1;
    }
    cursor = dayCount - 1;
    while (total > targetTotal) {
      const index = (cursor * 47 + 23) % dayCount;
      if (counts[index] > 0) {
        counts[index] -= 1;
        total -= 1;
      }
      cursor = cursor === 0 ? dayCount - 1 : cursor - 1;
    }

    const start = new Date(Date.UTC(2025, 7, 17));
    return Object.freeze(counts.map((count, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      return Object.freeze({
        date: date.toISOString().slice(0, 10),
        count,
        level: levelForCount(count)
      });
    }));
  };

  const filterRepositories = (repositories, query = "", language = "all") => {
    const needle = String(query).trim().toLocaleLowerCase();
    return repositories.filter((repository) => {
      const languageMatches = language === "all" || repository.language === language;
      const haystack = [repository.name, repository.description, repository.language, repository.badge]
        .join(" ")
        .toLocaleLowerCase();
      return languageMatches && (!needle || haystack.includes(needle));
    });
  };

  const createElement = (document, tagName, attributes = {}) => {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([name, value]) => {
      if (value === null || value === undefined) return;
      if (name === "className") element.className = value;
      else if (name === "text") element.textContent = value;
      else if (name.startsWith("data-") || name.startsWith("aria-") || name === "role") element.setAttribute(name, value);
      else if (name in element) element[name] = value;
      else element.setAttribute(name, value);
    });
    return element;
  };

  const handleRepoCardClick = (repoKey, openTab) => {
    const repository = REPOSITORIES.find(({ key }) => key === repoKey);
    const targetUrl = repository?.url;
    if (!targetUrl || !/^https:\/\//i.test(targetUrl) || typeof openTab !== "function") return false;
    openTab(targetUrl, "_blank", "noopener,noreferrer");
    return true;
  };

  const formatContributionLabel = (dateString, count) => {
    const date = new Date(`${dateString}T00:00:00Z`);
    const formattedDate = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
    return `${count} ${count === 1 ? "contribution" : "contributions"} on ${formattedDate}`;
  };

  const LANGUAGE_CLASS = Object.freeze({
    Java: "java",
    JavaScript: "javascript",
    TypeScript: "typescript",
    GDScript: "gdscript",
    Python: "python",
    "Bash / Shell": "shell"
  });

  const PROFILE_META = Object.freeze([
    Object.freeze({ icon: "▣", key: "organization" }),
    Object.freeze({ icon: "⌖", key: "location" })
  ]);

  const fetchGitHubProfile = async (username, fetchImplementation = globalScope?.fetch?.bind(globalScope)) => {
    if (typeof fetchImplementation !== "function") throw new Error("GitHub API is unavailable.");
    const headers = { Accept: "application/vnd.github+json" };
    const [profileResponse, repositoriesResponse] = await Promise.all([
      fetchImplementation(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers }),
      fetchImplementation(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`, { headers })
    ]);
    if (!profileResponse?.ok || !repositoriesResponse?.ok) throw new Error("GitHub API request failed.");
    const [profile, repositories] = await Promise.all([profileResponse.json(), repositoriesResponse.json()]);
    if (!isValidGitHubPayload(profile, repositories)) throw new Error("GitHub API returned malformed data.");
    return { profile, repositories };
  };

  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

  const isValidGitHubPayload = (profile, repositories) => (
    isRecord(profile)
    && Array.isArray(repositories)
    && repositories.every((repository) => isRecord(repository) && typeof repository.name === "string" && repository.name.trim())
  );

  class DevHubApp {
    #document;
    #mount;
    #openTab;
    #fetchProfile;
    #window;
    #activeTab = "overview";
    #searchQuery = "";
    #languageFilter = "all";
    #panels = new Map();
    #searchInput;
    #languageSelect;
    #results;
    #toast;
    #statusMessage;
    #apiStatusElement;
    #profileSocial;
    #avatar;
    #avatarFallback;
    #tooltip;
    #retryButton;
    #apiStatus = "connecting";
    #requestGeneration = 0;
    #repositoryMetadata = new Map();
    #statusResetTimer = null;

    constructor({ mount, document = mount?.ownerDocument ?? globalScope?.document, openTab, fetchProfile } = {}) {
      if (!mount || !document?.createElement) {
        throw new TypeError("DevHubApp requires a mount element and document.");
      }
      this.#mount = mount;
      this.#document = document;
      this.#openTab = openTab ?? ((targetUrl, target, features) => {
        const view = this.#document.defaultView ?? globalScope;
        view.open(targetUrl, target, features);
      });
      const shouldAutoRefresh = fetchProfile === undefined;
      this.#fetchProfile = fetchProfile ?? ((username) => fetchGitHubProfile(username));
      this.#window = this.#buildWindow();
      this.#bindInteractions();
      this.#mount.append(this.#window);
      this.selectTab("overview");
      if (shouldAutoRefresh) void this.refreshProfile();
    }

    get windowElement() {
      return this.#window;
    }

    get activeTab() {
      return this.#activeTab;
    }

    get searchQuery() {
      return this.#searchQuery;
    }

    get languageFilter() {
      return this.#languageFilter;
    }

    get apiStatus() {
      return this.#apiStatus;
    }

    async refreshProfile() {
      const generation = ++this.#requestGeneration;
      this.#setApiStatus("connecting");
      try {
        const result = await this.#fetchProfile(DEVHUB_CONFIG.profile.githubUsername);
        if (generation !== this.#requestGeneration) return false;
        if (!isValidGitHubPayload(result?.profile, result?.repositories)) throw new Error("GitHub API returned malformed data.");
        this.#applyProfileMetadata(result.profile, result.repositories);
        this.#setApiStatus("connected");
        return true;
      } catch (_error) {
        if (generation !== this.#requestGeneration) return false;
        this.#setApiStatus("fallback");
        return false;
      }
    }

    selectTab(tabName) {
      if (!this.#panels.has(tabName)) return false;
      this.#activeTab = tabName;
      this.#window.querySelectorAll('[role="tab"]').forEach((tab) => {
        const selected = tab.dataset.devhubTab === tabName;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        tab.classList.toggle("devhub-tab--active", selected);
      });
      this.#panels.forEach((panel, name) => {
        panel.hidden = name !== tabName;
      });
      if (tabName === "repositories") this.#renderRepositoryResults();
      return true;
    }

    #buildWindow() {
      const windowElement = createElement(this.#document, "section", {
        className: "window devhub-window",
        id: "devhub-window",
        role: "dialog",
        "aria-labelledby": "devhub-window-title",
        "data-window": "",
        "data-app-window": "devhub",
        "data-window-width": "1060",
        "data-window-height": "680",
        "data-window-min-width": "720",
        "data-window-min-height": "500",
        "data-window-centered": ""
      });
      windowElement.hidden = true;

      const titleBar = createElement(this.#document, "div", { className: "title-bar devhub-window__title-bar" });
      const title = createElement(this.#document, "div", {
        className: "title-bar-text devhub-window__title",
        id: "devhub-window-title"
      });
      title.append(
        createElement(this.#document, "img", { src: "./assets/icons/devhub.png", alt: "", draggable: false }),
        createElement(this.#document, "span", { text: "DevHub - @xDele1ed" })
      );
      const controls = createElement(this.#document, "div", { className: "title-bar-controls" });
      ["Minimize", "Maximize", "Close"].forEach((label) => {
        controls.append(createElement(this.#document, "button", { type: "button", "aria-label": label }));
      });
      titleBar.append(title, controls);

      const body = createElement(this.#document, "div", { className: "window-body devhub-window__body" });
      const app = createElement(this.#document, "div", { className: "devhub-app" });
      app.append(this.#buildHeader(), this.#buildWorkspace(), this.#buildStatusBar());
      body.append(app);
      windowElement.append(titleBar, body);
      return windowElement;
    }

    #buildHeader() {
      const header = createElement(this.#document, "header", { className: "devhub-header" });
      const identity = createElement(this.#document, "div", { className: "devhub-brand" });
      identity.append(
        createElement(this.#document, "img", { className: "devhub-brand__logo", src: "./assets/icons/devhub.png", alt: "", draggable: false }),
        createElement(this.#document, "span", { className: "devhub-brand__name", text: "DevHub" })
      );

      const searchLabel = createElement(this.#document, "label", { className: "devhub-search" });
      searchLabel.append(createElement(this.#document, "span", { className: "devhub-search__icon", text: "⌕", "aria-hidden": "true" }));
      this.#searchInput = createElement(this.#document, "input", {
        type: "search",
        placeholder: "Type / to search",
        "aria-label": "Search repositories",
        "data-devhub-search": ""
      });
      searchLabel.append(this.#searchInput);

      const tabs = createElement(this.#document, "div", { className: "devhub-tabs", role: "tablist", "aria-label": "DevHub sections" });
      [
        ["overview", "▤", "Overview"],
        ["repositories", "▣", "Repositories"],
        ["skills", "⚡", "Skills"]
      ].forEach(([key, icon, label]) => {
        const tab = createElement(this.#document, "button", {
          type: "button",
          className: "devhub-tab",
          id: `devhub-tab-${key}`,
          role: "tab",
          "aria-controls": `devhub-panel-${key}`,
          "aria-selected": "false",
          "data-devhub-tab": key
        });
        tab.append(
          createElement(this.#document, "span", { className: "devhub-tab__icon", text: icon, "aria-hidden": "true" }),
          createElement(this.#document, "span", { text: label })
        );
        tabs.append(tab);
      });
      header.append(identity, searchLabel, tabs);
      return header;
    }

    #buildWorkspace() {
      const workspace = createElement(this.#document, "div", { className: "devhub-layout" });
      const main = createElement(this.#document, "main", { className: "devhub-main" });
      const overview = this.#buildOverviewPanel();
      const repositories = this.#buildRepositoriesPanel();
      const skills = this.#buildSkillsPanel();
      [overview, repositories, skills].forEach((panel) => {
        this.#panels.set(panel.dataset.devhubPanel, panel);
        main.append(panel);
      });
      workspace.append(this.#buildProfileSidebar(), main);
      return workspace;
    }

    #buildProfileSidebar() {
      const sidebar = createElement(this.#document, "aside", { className: "devhub-profile", "aria-label": "Developer profile" });
      const avatarWrap = createElement(this.#document, "div", { className: "devhub-avatar" });
      this.#avatar = createElement(this.#document, "img", {
        className: "devhub-avatar__image",
        src: DEVHUB_CONFIG.profile.avatarUrl,
        alt: "xDele1ed profile avatar",
        draggable: false
      });
      this.#avatarFallback = createElement(this.#document, "span", { className: "devhub-avatar__fallback", text: "XD", "aria-hidden": "true" });
      this.#avatarFallback.hidden = true;
      avatarWrap.append(this.#avatar, this.#avatarFallback, createElement(this.#document, "span", {
        className: "devhub-avatar__status",
        title: "Available",
        "aria-label": "Status: available"
      }));

      const identity = createElement(this.#document, "div", { className: "devhub-profile__identity" });
      identity.append(
        createElement(this.#document, "h1", { text: DEVHUB_CONFIG.profile.displayName }),
        createElement(this.#document, "p", { className: "devhub-profile__handle", text: `${DEVHUB_CONFIG.profile.githubUsername} · ${DEVHUB_CONFIG.profile.pronouns}` })
      );
      const bio = createElement(this.#document, "p", { className: "devhub-profile__bio", text: DEVHUB_CONFIG.profile.bio });
      const edit = createElement(this.#document, "button", {
        type: "button",
        className: "devhub-edit-profile",
        text: "Edit profile",
        title: "Profile editing is unavailable in this portfolio preview",
        disabled: true
      });
      this.#profileSocial = createElement(this.#document, "p", {
        className: "devhub-profile__social",
        "data-devhub-social": "",
        text: this.#socialText(DEVHUB_CONFIG.profile.followers, DEVHUB_CONFIG.profile.following)
      });
      const metadata = createElement(this.#document, "ul", { className: "devhub-profile__metadata" });
      PROFILE_META.forEach(({ icon, key }) => {
        const row = createElement(this.#document, "li");
        row.append(
          createElement(this.#document, "span", { className: "devhub-profile__meta-icon", text: icon, "aria-hidden": "true" }),
          createElement(this.#document, "span", { text: DEVHUB_CONFIG.profile[key] })
        );
        metadata.append(row);
      });
      const website = createElement(this.#document, "li");
      const websiteLink = createElement(this.#document, "a", {
        href: DEVHUB_CONFIG.profile.website,
        className: "devhub-link",
        text: "xdele1ed.is-a.dev",
        "data-devhub-external-url": DEVHUB_CONFIG.profile.website
      });
      website.append(
        createElement(this.#document, "span", { className: "devhub-profile__meta-icon", text: "↗", "aria-hidden": "true" }),
        websiteLink
      );
      metadata.append(website);

      const skillSection = createElement(this.#document, "section", { className: "devhub-profile__skills", "aria-labelledby": "devhub-sidebar-skills" });
      skillSection.append(createElement(this.#document, "h2", { id: "devhub-sidebar-skills", text: "Skills" }));
      const skillPills = createElement(this.#document, "div", { className: "devhub-skill-pills" });
      SKILL_GROUPS.flatMap(({ items }) => items).forEach(({ name }) => {
        skillPills.append(createElement(this.#document, "span", { className: "devhub-skill-pill", text: name }));
      });
      skillSection.append(skillPills);
      sidebar.append(avatarWrap, identity, bio, edit, this.#profileSocial, metadata, skillSection);
      return sidebar;
    }

    #buildPanel(name) {
      const panel = createElement(this.#document, "section", {
        className: `devhub-panel devhub-panel--${name}`,
        id: `devhub-panel-${name}`,
        role: "tabpanel",
        "aria-labelledby": `devhub-tab-${name}`,
        "data-devhub-panel": name
      });
      panel.hidden = name !== "overview";
      return panel;
    }

    #buildOverviewPanel() {
      const panel = this.#buildPanel("overview");
      const pinnedHeader = createElement(this.#document, "div", { className: "devhub-section-heading" });
      pinnedHeader.append(
        createElement(this.#document, "h2", { text: "Pinned repositories" }),
        createElement(this.#document, "span", { className: "devhub-section-heading__note", text: "Selected work" })
      );
      const pinnedGrid = createElement(this.#document, "div", { className: "devhub-repo-grid devhub-repo-grid--pinned" });
      REPOSITORIES.filter(({ pinned }) => pinned).forEach((repository) => pinnedGrid.append(this.#buildRepositoryCard(repository)));
      panel.append(pinnedHeader, pinnedGrid, this.#buildContributionSection(), this.#buildActivitySection());
      return panel;
    }

    #buildRepositoryCard(repository) {
      const card = createElement(this.#document, "article", {
        className: "devhub-repo-card",
        role: "link",
        tabIndex: 0,
        "aria-label": `Open ${repository.name}`,
        "data-devhub-repo": repository.key
      });
      const heading = createElement(this.#document, "div", { className: "devhub-repo-card__heading" });
      const name = createElement(this.#document, "h3");
      name.append(
        createElement(this.#document, "span", { className: "devhub-repo-card__icon", text: "▣", "aria-hidden": "true" }),
        createElement(this.#document, "span", { text: repository.name })
      );
      heading.append(name, createElement(this.#document, "span", { className: "devhub-repo-card__badge", text: repository.badge }));
      if (repository.externalIndicator) {
        heading.append(createElement(this.#document, "span", { className: "devhub-repo-card__external", text: "↗", "aria-hidden": "true" }));
      }
      const description = createElement(this.#document, "p", { className: "devhub-repo-card__description", text: repository.description });
      const metadata = this.#repositoryMetadata.get(repository.key) ?? {};
      const language = metadata.language ?? repository.language;
      const stars = Number.isFinite(metadata.stars) ? metadata.stars : repository.stars;
      const meta = createElement(this.#document, "div", { className: "devhub-repo-card__meta" });
      meta.append(
        createElement(this.#document, "span", { className: `devhub-language devhub-language--${LANGUAGE_CLASS[language] ?? "other"}`, "aria-hidden": "true" }),
        createElement(this.#document, "span", { className: "devhub-repo-card__language-label", text: language })
      );
      if (stars) meta.append(createElement(this.#document, "span", { className: "devhub-repo-card__stars", text: `☆ ${stars}` }));
      card.append(heading, description, meta);
      const activate = () => {
        if (!handleRepoCardClick(repository.key, this.#openTab)) this.#showUnavailableToast();
      };
      card.addEventListener("click", activate);
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activate();
      });
      return card;
    }

    #buildContributionSection() {
      const section = createElement(this.#document, "section", { className: "devhub-contributions", "aria-labelledby": "devhub-contributions-title" });
      section.append(createElement(this.#document, "h2", { id: "devhub-contributions-title", text: "195 contributions in the last year" }));
      const graph = createElement(this.#document, "div", { className: "devhub-contribution-graph" });
      const months = createElement(this.#document, "div", { className: "devhub-contribution-months", "aria-hidden": "true" });
      ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"].forEach((month) => {
        months.append(createElement(this.#document, "span", { text: month }));
      });
      const days = createElement(this.#document, "div", { className: "devhub-contribution-days", "aria-hidden": "true" });
      ["", "Mon", "", "Wed", "", "Fri", ""].forEach((day) => days.append(createElement(this.#document, "span", { text: day })));
      const cells = createElement(this.#document, "div", { className: "devhub-contribution-cells" });
      createContributionCalendar().forEach(({ date, count, level }) => {
        cells.append(createElement(this.#document, "button", {
          type: "button",
          className: `devhub-contribution-cell devhub-contribution-cell--${level}`,
          title: formatContributionLabel(date, count),
          "aria-label": formatContributionLabel(date, count),
          "data-contribution-date": date,
          "data-contribution-count": String(count),
          "data-contribution-level": String(level)
        }));
      });
      const legend = createElement(this.#document, "div", { className: "devhub-contribution-legend" });
      legend.append(createElement(this.#document, "span", { text: "Less" }));
      [0, 1, 2, 3, 4].forEach((level) => legend.append(createElement(this.#document, "span", {
        className: `devhub-contribution-cell devhub-contribution-cell--${level}`,
        "aria-hidden": "true"
      })));
      legend.append(createElement(this.#document, "span", { text: "More" }));
      graph.append(months, days, cells, legend);
      section.append(graph);
      return section;
    }

    #buildActivitySection() {
      const section = createElement(this.#document, "section", { className: "devhub-activity", "aria-labelledby": "devhub-activity-title" });
      section.append(createElement(this.#document, "h2", { id: "devhub-activity-title", text: "Contribution activity" }));
      const month = createElement(this.#document, "div", { className: "devhub-activity__month" });
      month.append(createElement(this.#document, "span", { text: "August 2026" }), createElement(this.#document, "span", { "aria-hidden": "true" }));
      const timeline = createElement(this.#document, "div", { className: "devhub-activity__timeline" });
      timeline.append(
        this.#buildActivityItem("●", "Created 39 commits in 3 repositories", [
          ["windows-7-website", "17 commits"],
          ["minecraft-setup", "12 commits"],
          ["xDele1ed-Portfolio", "10 commits"]
        ]),
        this.#buildActivityItem("▣", "Created 2 repositories", [
          ["xdele1edmc14/Infected-revamped", "Java · Aug 14"],
          ["xdele1edmc14/xDele1ed-Portfolio", "Python · Aug 3"]
        ]),
        this.#buildActivityItem("⑂", "Opened 2 pull requests in 2 repositories", [
          ["DaWHeL/Infected-plugin", "1 open"],
          ["xdele1edmc14/Infected-revamped", "1 merged"]
        ])
      );
      section.append(month, timeline);
      return section;
    }

    #buildActivityItem(icon, title, rows) {
      const item = createElement(this.#document, "article", { className: "devhub-activity-item" });
      item.append(createElement(this.#document, "span", { className: "devhub-activity-item__icon", text: icon, "aria-hidden": "true" }));
      const content = createElement(this.#document, "div", { className: "devhub-activity-item__content" });
      content.append(createElement(this.#document, "h3", { text: title }));
      const list = createElement(this.#document, "ul");
      rows.forEach(([name, detail]) => {
        const row = createElement(this.#document, "li");
        const repositoryUrl = this.#activityRepositoryUrl(name);
        const repositoryName = repositoryUrl
          ? createElement(this.#document, "a", {
            className: "devhub-link",
            text: name,
            href: repositoryUrl,
            target: "_blank",
            rel: "noopener noreferrer",
            "data-devhub-activity-url": repositoryUrl,
            "data-devhub-external-url": repositoryUrl
          })
          : createElement(this.#document, "span", { className: "devhub-link", text: name });
        row.append(repositoryName, createElement(this.#document, "span", { text: detail }));
        list.append(row);
      });
      content.append(list);
      item.append(content);
      return item;
    }

    #buildRepositoriesPanel() {
      const panel = this.#buildPanel("repositories");
      const heading = createElement(this.#document, "div", { className: "devhub-section-heading" });
      heading.append(createElement(this.#document, "h2", { text: "Repositories" }), createElement(this.#document, "span", { className: "devhub-section-heading__note", text: "6 projects" }));
      const toolbar = createElement(this.#document, "div", { className: "devhub-repository-toolbar" });
      const label = createElement(this.#document, "label");
      label.append(createElement(this.#document, "span", { text: "Language" }));
      this.#languageSelect = createElement(this.#document, "select", { "data-devhub-language": "", "aria-label": "Filter by language" });
      ["all", "Java", "JavaScript", "TypeScript", "GDScript", "Bash / Shell"].forEach((language) => {
        this.#languageSelect.append(createElement(this.#document, "option", { value: language, text: language === "all" ? "All languages" : language }));
      });
      this.#languageSelect.value = "all";
      label.append(this.#languageSelect);
      toolbar.append(label);
      this.#results = createElement(this.#document, "div", { className: "devhub-repository-results", "data-devhub-results": "" });
      panel.append(heading, toolbar, this.#results);
      return panel;
    }

    #buildSkillsPanel() {
      const panel = this.#buildPanel("skills");
      const heading = createElement(this.#document, "div", { className: "devhub-section-heading" });
      heading.append(createElement(this.#document, "h2", { text: "Technical skills" }), createElement(this.#document, "span", { className: "devhub-section-heading__note", text: "Current stack" }));
      const groups = createElement(this.#document, "div", { className: "devhub-skill-matrix" });
      SKILL_GROUPS.forEach((group) => {
        const article = createElement(this.#document, "article", { className: "devhub-skill-group" });
        article.append(
          createElement(this.#document, "h3", { text: group.title }),
          createElement(this.#document, "p", { text: group.description })
        );
        const list = createElement(this.#document, "ul");
        group.items.forEach(({ name, level }) => {
          const item = createElement(this.#document, "li");
          item.append(createElement(this.#document, "span", { text: name }), createElement(this.#document, "span", { className: "devhub-skill-group__level", text: level }));
          list.append(item);
        });
        article.append(list);
        groups.append(article);
      });
      panel.append(heading, groups);
      return panel;
    }

    #buildStatusBar() {
      const status = createElement(this.#document, "footer", { className: "devhub-statusbar" });
      this.#statusMessage = createElement(this.#document, "span", { text: "Ready", "data-devhub-status": "" });
      this.#apiStatusElement = createElement(this.#document, "span", { text: "Connecting to GitHub API", "data-devhub-api-status": "", "aria-live": "polite" });
      const version = createElement(this.#document, "span", { text: DEVHUB_CONFIG.version });
      this.#retryButton = createElement(this.#document, "button", { type: "button", className: "devhub-statusbar__retry", text: "Retry", "data-devhub-retry": "" });
      this.#retryButton.hidden = true;
      this.#tooltip = createElement(this.#document, "div", { className: "devhub-tooltip", role: "tooltip" });
      this.#tooltip.hidden = true;
      this.#toast = createElement(this.#document, "div", { className: "devhub-toast", role: "status", "aria-live": "polite" });
      this.#toast.hidden = true;
      status.append(this.#statusMessage, this.#apiStatusElement, this.#retryButton, version, this.#tooltip, this.#toast);
      return status;
    }

    #bindInteractions() {
      this.#window.querySelectorAll('[role="tab"]').forEach((tab) => {
        tab.addEventListener("click", () => this.selectTab(tab.dataset.devhubTab));
      });
      this.#window.querySelectorAll("[data-contribution-date]").forEach((cell) => {
        const showTooltip = () => {
          this.#tooltip.textContent = formatContributionLabel(cell.dataset.contributionDate, Number(cell.dataset.contributionCount));
          this.#tooltip.hidden = false;
          this.#tooltip.dataset.anchorDate = cell.dataset.contributionDate;
        };
        const hideTooltip = () => {
          this.#tooltip.hidden = true;
          delete this.#tooltip.dataset.anchorDate;
        };
        cell.addEventListener("focus", showTooltip);
        cell.addEventListener("mouseenter", showTooltip);
        cell.addEventListener("blur", hideTooltip);
        cell.addEventListener("mouseleave", hideTooltip);
      });
      this.#searchInput.addEventListener("input", () => {
        this.#searchQuery = this.#searchInput.value;
        this.#announceFiltering();
        if (this.#searchQuery.trim()) this.selectTab("repositories");
        else if (this.#activeTab === "repositories") this.#renderRepositoryResults();
      });
      this.#languageSelect.addEventListener("change", () => {
        this.#languageFilter = this.#languageSelect.value || "all";
        this.#announceFiltering();
        this.#renderRepositoryResults();
      });
      this.#retryButton.addEventListener("click", () => { void this.refreshProfile(); });
      this.#avatar.addEventListener("error", () => {
        this.#avatar.hidden = true;
        this.#avatarFallback.hidden = false;
      });
      this.#window.querySelectorAll("[data-devhub-external-url]").forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          this.#openTab(link.dataset.devhubExternalUrl, "_blank", "noopener,noreferrer");
        });
      });
      this.#window.addEventListener("keydown", (event) => this.#handleKeydown(event));
    }

    #renderRepositoryResults() {
      const repositories = filterRepositories(this.#effectiveRepositories(), this.#searchQuery, this.#languageFilter);
      this.#results.replaceChildren();
      if (repositories.length === 0) {
        const empty = createElement(this.#document, "div", { className: "devhub-empty", "data-devhub-empty": "" });
        empty.append(
          createElement(this.#document, "p", { text: "No repositories match your search." }),
          createElement(this.#document, "button", { type: "button", text: "Clear filters", "data-devhub-clear-filters": "" })
        );
        empty.querySelector('[data-devhub-clear-filters]').addEventListener("click", () => {
          this.#searchQuery = "";
          this.#languageFilter = "all";
          this.#searchInput.value = "";
          this.#languageSelect.value = "all";
          this.#announceFiltering();
          this.#renderRepositoryResults();
          this.#searchInput.focus();
        });
        this.#results.append(empty);
        return;
      }
      const grid = createElement(this.#document, "div", { className: "devhub-repo-list" });
      repositories.forEach((repository) => grid.append(this.#buildRepositoryCard(repository)));
      this.#results.append(grid);
    }

    #showUnavailableToast() {
      this.#toast.textContent = "This project link is unavailable.";
      this.#toast.hidden = false;
    }

    #socialText(followers, following) {
      return `${followers} ${followers === 1 ? "follower" : "followers"} · ${following} following`;
    }

    #handleKeydown(event) {
      const target = event.target;
      const isTypingTarget = target?.matches?.("input, textarea, select, [contenteditable]");
      if (event.key === "/" && !isTypingTarget) {
        event.preventDefault();
        this.#searchInput.focus();
        return;
      }

      const currentTab = target?.closest?.('[role="tab"]');
      if (currentTab && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        const tabs = [...this.#window.querySelectorAll('[role="tab"]')];
        const currentIndex = tabs.indexOf(currentTab);
        const direction = event.key === "ArrowRight" ? 1 : -1;
        tabs[(currentIndex + direction + tabs.length) % tabs.length].focus();
        return;
      }
      if (currentTab && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        this.selectTab(currentTab.dataset.devhubTab);
        return;
      }

      if (event.key !== "Escape") return;
      if (!this.#tooltip.hidden) {
        event.preventDefault();
        this.#tooltip.hidden = true;
        return;
      }
      if (!this.#toast.hidden) {
        event.preventDefault();
        this.#toast.hidden = true;
        return;
      }
      if (this.#searchQuery) {
        event.preventDefault();
        this.#searchQuery = "";
        this.#searchInput.value = "";
        this.#announceFiltering();
        if (this.#activeTab === "repositories") this.#renderRepositoryResults();
      }
    }

    #setApiStatus(status) {
      this.#apiStatus = status;
      const messages = {
        connecting: "Connecting to GitHub API",
        connected: "Connected to GitHub API",
        fallback: "Using saved profile snapshot"
      };
      this.#apiStatusElement.textContent = messages[status];
      this.#retryButton.hidden = status !== "fallback";
    }

    #applyProfileMetadata(profile, repositories) {
      const followers = Number.isFinite(profile.followers) ? profile.followers : DEVHUB_CONFIG.profile.followers;
      const following = Number.isFinite(profile.following) ? profile.following : DEVHUB_CONFIG.profile.following;
      this.#profileSocial.textContent = this.#socialText(followers, following);
      if (typeof profile.avatar_url === "string" && /^https:\/\//i.test(profile.avatar_url)) {
        this.#avatar.setAttribute("src", profile.avatar_url);
        this.#avatar.hidden = false;
        this.#avatarFallback.hidden = true;
      }

      this.#repositoryMetadata.clear();
      repositories.forEach((repository) => {
        const configured = REPOSITORIES.find(({ name }) => name.toLocaleLowerCase() === String(repository.name).toLocaleLowerCase());
        if (!configured) return;
        const metadata = {};
        if (Number.isFinite(repository.stargazers_count)) metadata.stars = repository.stargazers_count;
        if (typeof repository.language === "string" && repository.language) metadata.language = repository.language;
        this.#repositoryMetadata.set(configured.key, metadata);
      });
      this.#syncLanguageOptions();
      this.#refreshRenderedRepositoryMetadata();
    }

    #activityRepositoryUrl(name) {
      const repositoryName = String(name).split("/").pop().toLocaleLowerCase();
      return REPOSITORIES.find((repository) => repository.name.toLocaleLowerCase() === repositoryName)?.url ?? null;
    }

    #effectiveRepositories() {
      return REPOSITORIES.map((repository) => ({
        ...repository,
        ...(this.#repositoryMetadata.get(repository.key) ?? {})
      }));
    }

    #syncLanguageOptions() {
      const languages = [...new Set(this.#effectiveRepositories().map(({ language }) => language).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right));
      const selectedLanguage = languages.includes(this.#languageFilter) ? this.#languageFilter : "all";
      this.#languageSelect.replaceChildren(
        createElement(this.#document, "option", { value: "all", text: "All languages" }),
        ...languages.map((language) => createElement(this.#document, "option", { value: language, text: language }))
      );
      this.#languageFilter = selectedLanguage;
      this.#languageSelect.value = selectedLanguage;
      if (this.#activeTab === "repositories") this.#renderRepositoryResults();
    }

    #announceFiltering() {
      this.#statusMessage.textContent = "Filtering repositories";
      if (this.#statusResetTimer !== null) globalScope.clearTimeout(this.#statusResetTimer);
      this.#statusResetTimer = globalScope.setTimeout(() => {
        this.#statusMessage.textContent = "Ready";
        this.#statusResetTimer = null;
      }, 180);
    }

    #refreshRenderedRepositoryMetadata() {
      this.#window.querySelectorAll("[data-devhub-repo]").forEach((card) => {
        const metadata = this.#repositoryMetadata.get(card.dataset.devhubRepo);
        if (!metadata) return;
        const meta = card.querySelector(".devhub-repo-card__meta");
        const languageLabel = card.querySelector(".devhub-repo-card__language-label");
        const languageDot = card.querySelector(".devhub-language");
        if (metadata.language && languageLabel) {
          languageLabel.textContent = metadata.language;
          languageDot.className = `devhub-language devhub-language--${LANGUAGE_CLASS[metadata.language] ?? "other"}`;
        }
        let stars = card.querySelector(".devhub-repo-card__stars");
        if (Number.isFinite(metadata.stars) && metadata.stars > 0) {
          if (!stars) {
            stars = createElement(this.#document, "span", { className: "devhub-repo-card__stars" });
            meta.append(stars);
          }
          stars.textContent = `☆ ${metadata.stars}`;
        } else if (stars) {
          stars.textContent = "";
        }
      });
    }
  }

  const mountDevHubApp = (document = globalScope?.document) => {
    const mount = document?.querySelector?.("[data-desktop]");
    if (!mount || mount.querySelector?.('[data-app-window="devhub"]')) return null;
    return new DevHubApp({ mount, document });
  };

  if (globalScope?.document) mountDevHubApp(globalScope.document);

  return Object.freeze({
    DEVHUB_CONFIG,
    REPOSITORIES,
    SKILL_GROUPS,
    DevHubApp,
    createContributionCalendar,
    filterRepositories,
    fetchGitHubProfile,
    formatContributionLabel,
    handleRepoCardClick,
    mountDevHubApp
  });
});
