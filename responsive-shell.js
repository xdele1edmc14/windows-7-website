(function exposeResponsiveShell(scope, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    scope.PortfolioShell = api.createResponsiveShell({
      window: scope, document: scope.document,
      windowsRoot: scope.document.getElementById('windows-7-root'),
      phone: scope.document.getElementById('iphone-portfolio')
    });
  }
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';

  function createResponsiveShell({ window, document, windowsRoot, phone }) {
    // Same boundary as the standalone phone frame. Width, not device detection,
    // controls presentation so rotation and browser resizing work immediately.
    const mobile = window.matchMedia('(max-width: 699.98px)');
    let current = null, factory = null, engine = null, phoneLoaded = false;
    let windowsFocus = null;
    function sync() {
      const next = mobile.matches ? 'iphone' : 'windows';
      if (next === 'windows') {
        // Freeze the last desktop geometry while hidden. Other desktop resize
        // observers keep seeing valid dimensions instead of a zero-size root.
        windowsRoot.style.width = window.innerWidth + 'px';
        windowsRoot.style.height = window.innerHeight + 'px';
      }
      if (next === current) return;
      if (next === 'iphone') windowsFocus = document.activeElement;
      current = next;
      document.documentElement.dataset.experience = next;
      document.title = next === 'iphone' ? 'iPhone — Portfolio' : 'Windows 7 — Portfolio';
      windowsRoot.inert = next !== 'windows';
      windowsRoot.setAttribute('aria-hidden', String(next !== 'windows'));
      phone.hidden = next !== 'iphone';
      phone.inert = next !== 'iphone';
      if (next === 'iphone' && !phoneLoaded) {
        phoneLoaded = true;
        phone.setAttribute('src', './Phone-UI/index.html');
      }
      if (next === 'windows' && factory && !engine) engine = factory();
      engine?.setPresentationActive(next === 'windows');
      if (next === 'iphone') phone.focus();
      else if (windowsFocus?.isConnected) windowsFocus.focus({ preventScroll: true });
    }
    window.addEventListener('resize', sync);
    mobile.addEventListener('change', sync);
    // Keyboard events inside the phone belong to its isolated document. Prevent
    // parent shortcuts from activating a hidden Windows screen before focus moves.
    document.addEventListener('keydown', event => {
      if (current === 'iphone') event.stopImmediatePropagation();
    }, true);
    sync();
    return {
      get experience() { return current; },
      registerWindows(start) {
        factory = start;
        if (current === 'windows' && !engine) {
          engine = factory();
          engine.setPresentationActive(true);
        }
      }
    };
  }
  return { createResponsiveShell };
});
