(function initializeBootAssets(globalScope, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.Windows7BootAssets = api;
})(typeof window === "object" ? window : (typeof globalThis === "object" ? globalThis : this), () => {
  "use strict";

  // Document-relative URLs work from file://, a web root, or a subdirectory deploy.
  const ASSETS = Object.freeze({
    bootAnimation: "./assets/STARTLUP_ANIMATION.apng",
    biosAudio: "./assets/startup sound.mp3",
    startupAudio: "./assets/windows-7-startup.mp3",
    shutdownAudio: "./assets/windows_7_shut_down.mp3",
    loginAudio: "./assets/login.mp3",
    criticalStopAudio: "./assets/Windows Critical Stop.wav",
    navigationAudio: "./assets/Windows Navigation Start.wav",
    busy: "./assets/aero_busy.apng",
    deskView: "./assets/pc.png",
    deskAudio: "./assets/pc.mp3",
    wallpaper: "./assets/img0.png",
    loginWallpaper: "./assets/login_screen_wallpaper.jpg",
    userAvatar: "./assets/user_icon.png",
    startOrb: "./assets/start_menu_orb_unpressed.png",
    startOrbHover: "./assets/start_menu_orb_hovered.png",
    startOrbPressed: "./assets/start_menu_orb_pressed.png",
    about: "./assets/icons/about.png",
    chrome: "./assets/icons/Chrome-icon.png",
    youtube: "./assets/icons/youtube.svg",
    devhub: "./assets/icons/devhub.png",
    mediaCenter: "./assets/media center/main_logo.png",
    cmd: "./assets/icons/cmd.png",
    calculator: "./assets/icons/calculator.png",
    notepad: "./assets/icons/notepad.png",
    paint: "./assets/icons/paint.png",
    photoViewer: "./assets/icons/image.png",
    imageFile: "./assets/icons/image.png",
    imageFileFallback: "./assets/icons/image.ico",
    documents: "./assets/icons/documents.ico",
    pictures: "./assets/icons/pictures.ico",
    music: "./assets/icons/music.ico",
    computer: "./assets/icons/computer.ico",
    controlPanel: "./assets/icons/control_panel.ico",
    defaultPrograms: "./assets/icons/defaultprograms.ico",
    help: "./assets/icons/helpandsupport.ico",
    networkIcon: "./assets/icons/network.png",
    networkTypeIcon: "./assets/icons/chair.png",
    speakerHardware: "./assets/icons/speaker.png",
    volumeFull: "./assets/icons/Volfull.png",
    volumeMid: "./assets/icons/VolMid.png",
    volumeLow: "./assets/icons/VolLow.png",
    volumeMuted: "./assets/icons/novol.png",
    folderEmpty: "./assets/icons/Folder_empty.png",
    folderFull: "./assets/icons/Folder_Full.png",
    recycleEmpty: "./assets/icons/recycle_empty.png",
    recycleFull: "./assets/icons/recycle_full.png",
    textFile: "./assets/icons/textfile.png",
    quickAccess: "./assets/icons/quick access.ico",
    desktop: "./assets/icons/desktop.ico",
    downloads: "./assets/icons/downloads.ico",
    videos: "./assets/icons/videos.ico",
    systemDrive: "./assets/icons/system.ico",
    dvdDrive: "./assets/icons/dvddrive.ico",
    accessDenied: "./assets/icons/access_denied.ico",
    display: "./assets/display.png",
    leftArrow: "./assets/leftarrow.png",
    rightArrow: "./assets/rightarrow.png",
    contextDisplay: "./assets/icons/networkicon.png",
    contextGadgets: "./assets/icons/gadgets.png",
    contextPersonalize: "./assets/icons/personalize.png",
    cursorArrow: "./cursors/aero_arrow-001.png",
    cursorLink: "./cursors/aero_link-001.png",
    cursorMove: "./cursors/aero_move-001.png",
    cursorHorizontal: "./cursors/aero_ew-001.png",
    cursorVertical: "./cursors/aero_ns-001.png",
    cursorDiagonalDown: "./cursors/aero_nwse-001.png",
    cursorDiagonalUp: "./cursors/aero_nesw-001.png",
    cursorHelp: "./cursors/aero_helpsel-001.png",
    cursorUnavailable: "./cursors/aero_unavail-001.png"
  });

  const CONTROL_PANEL_ASSETS = Object.freeze([
    "data_usage-9_64x64.png",
    "display.png",
    "keybaord-5.png",
    "synccenter.png",
    "defender.png",
    "dateandtime.png",
    "backupandrestore.png",
    "mouse.png",
    "system_64x64.png",
    "windowsupdate_64x64.png",
    "easeofaccess.png",
    "gadgets_64x64.png",
    "taskbarandstartmenu_64x64.png",
    "HyperVWindows8.png",
    "speechandrecognition.png",
    "useraccounts-4_64x64.png"
  ].map((fileName) => `./assets/icons/controlpanel/${fileName}`));

  const NON_THEME_BOOT_ASSETS = Object.freeze([
    ...new Set([...Object.values(ASSETS), ...CONTROL_PANEL_ASSETS])
  ]);

  return Object.freeze({ ASSETS, NON_THEME_BOOT_ASSETS });
});
