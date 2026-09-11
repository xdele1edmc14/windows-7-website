(function initializeMediaCenterData(globalScope, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.Windows7MediaCenterData = api;
})(typeof window === "object" ? window : (typeof globalThis === "object" ? globalThis : this), () => {
  "use strict";

  const base = "./assets/media center";
  const CATEGORIES = Object.freeze([
    "Thumbnails",
    "Posters",
    "PFPs"
  ]);

  const ASSETS = Object.freeze({
    wallpaper: `${base}/wallpaper.png`,
    logo: `${base}/main_logo.png`,
    intro: `${base}/intro.mp3`,
    sideButton: `${base}/sidebutton-click.mp3`,
    interact: `${base}/ui-interact.mp3`,
    confirm: `${base}/ui-confirm.mp3`
  });

  const project = (id, title, category, image) => Object.freeze({
    id,
    title,
    category,
    image: `${base}/${image}`
  });

  const PROJECTS = Object.freeze([
    project("thumbnail-1", "THUMBNAIL 1", "Thumbnails", "thumbnail_1.jpg"),
    project("thumbnail-2", "THUMBNAIL 2", "Thumbnails", "thumbnail_2.jpg"),
    project("thumbnail-3", "THUMBNAIL 3", "Thumbnails", "thumbnail_3.jpg"),
    project("poster-1", "POSTER 1", "Posters", "poster_1.png"),
    project("poster-2", "POSTER 2", "Posters", "poster_2.png"),
    project("pfp-1", "PFP 1", "PFPs", "pfp_1.png"),
    project("pfp-2", "PFP 2", "PFPs", "pfp_2.png"),
    project("pfp-3", "PFP 3", "PFPs", "pfp_3.png"),
    project("pfp-4", "PFP 4", "PFPs", "pfp_4.png"),
    project("pfp-5", "PFP 5", "PFPs", "pfp_5.png"),
    project("pfp-6", "PFP 6", "PFPs", "pfp_6.png")
  ]);

  return Object.freeze({ CATEGORIES, ASSETS, PROJECTS });
});
