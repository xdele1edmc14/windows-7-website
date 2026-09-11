(function exposeBootLoader(scope, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else scope.IOSBootLoader = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const IMAGES = Object.freeze(['./wallpaper.png', '../assets/Phone-UI/apple_logo.jpg']);

  async function prepareAssets({ document, framework, ImageCtor = globalThis.Image, timeoutMs = 20000 }) {
    if (typeof framework !== 'function') throw new Error('Framework7 could not load. Check your connection.');
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => !link.sheet)) {
      throw new Error('A stylesheet could not load. Check your connection.');
    }
    let timeout;
    const images = IMAGES.map(url => new Promise((resolve, reject) => {
      const image = new ImageCtor();
      image.onload = async () => {
        try { await image.decode?.(); resolve(); }
        catch { reject(new Error('Could not decode image: ' + url)); }
      };
      image.onerror = () => reject(new Error('Could not load image: ' + url));
      image.src = url;
    }));
    const fonts = (async () => {
      const loaded = await document.fonts.load('24px "Framework7 Icons"', 'wifi');
      if (!loaded.length) throw new Error('The icon font could not load.');
      await document.fonts.ready;
    })();
    try {
      await Promise.race([
        Promise.all([...images, fonts]),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Asset loading timed out. Check your connection.')), timeoutMs); })
      ]);
    } finally { clearTimeout(timeout); }
  }
  return { IMAGES, prepareAssets };
});
